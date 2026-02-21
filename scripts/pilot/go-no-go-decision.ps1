param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Email = "admin@enterprise.local",
  [string]$Password = "Admin@12345",
  [string]$OutDir = "docs/operations/reports",
  [double]$MinComplianceRate = 95,
  [double]$MaxBlockedPolicyRate = 5,
  [int]$MaxBookedBlockedClosure = 0,
  [int]$OpenSev1 = 0,
  [int]$OpenSev2 = 0,
  [switch]$RunQualityGates,
  [switch]$RunPerformanceGate,
  [switch]$RunSecurityGate,
  [switch]$SkipSmoke
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
  $resolvedScriptDir = Split-Path -Parent $PSCommandPath
  return (Resolve-Path (Join-Path $resolvedScriptDir "..\..")).Path
}

function Ensure-Directory {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session
  )

  $requestParams = @{
    Method          = $Method
    Uri             = $Url
    WebSession      = $Session
    UseBasicParsing = $true
    ErrorAction     = "Stop"
  }

  if ($null -ne $Body) {
    $requestParams.ContentType = "application/json"
    $requestParams.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }

  return Invoke-WebRequest @requestParams
}

function Parse-JsonBody {
  param(
    [string]$Step,
    [Microsoft.PowerShell.Commands.WebResponseObject]$Response
  )

  try {
    return $Response.Content | ConvertFrom-Json
  } catch {
    throw "$Step returned non-JSON response."
  }
}

function To-Array {
  param([object]$Value)
  if ($null -eq $Value) {
    return @()
  }
  if ($Value -is [System.Array]) {
    return $Value
  }
  return @($Value)
}

function Invoke-ScriptFile {
  param(
    [string]$ScriptPath,
    [hashtable]$Arguments
  )

  $argList = @("-ExecutionPolicy", "Bypass", "-File", $ScriptPath)
  foreach ($key in $Arguments.Keys) {
    $argList += "-$key"
    $argList += [string]$Arguments[$key]
  }

  $output = & powershell @argList 2>&1
  if ($null -ne $output) {
    foreach ($line in $output) {
      Write-Host $line
    }
  }
  return [int]$LASTEXITCODE
}

function Invoke-CliCommand {
  param(
    [string]$Name,
    [string]$Command,
    [string]$WorkDir
  )

  Write-Host "Running quality gate: $Name"
  Push-Location $WorkDir
  try {
    $output = & cmd.exe /c $Command 2>&1
    if ($null -ne $output) {
      foreach ($line in $output) {
        Write-Host $line
      }
    }
    return [int]$LASTEXITCODE
  } finally {
    Pop-Location
  }
}

function Add-Check {
  param(
    [System.Collections.Generic.List[object]]$Checks,
    [string]$Name,
    [string]$Actual,
    [string]$Threshold,
    [string]$Status,
    [bool]$Required = $true,
    [string]$Detail = ""
  )

  $Checks.Add([pscustomobject]@{
      Name = $Name
      Actual = $Actual
      Threshold = $Threshold
      Status = $Status
      Required = $Required
      Detail = $Detail
    }) | Out-Null
}

function Ensure-HistoryFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    @(
      "# Travel ERP Go-No-Go Decision History"
      ""
      "| Timestamp (UTC) | Decision | Compliance Rate | Blocked Policy Rate | Open SEV-1 | Open SEV-2 |"
      "|---|---|---:|---:|---:|---:|"
    ) | Set-Content -Path $Path -Encoding UTF8
  }
}

function Append-HistoryRow {
  param(
    [string]$Path,
    [string]$Decision,
    [double]$ComplianceRate,
    [double]$BlockedPolicyRate,
    [int]$OpenSev1,
    [int]$OpenSev2
  )

  $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  Add-Content -Path $Path -Encoding UTF8 -Value "| $timestamp | $Decision | $ComplianceRate | $BlockedPolicyRate | $OpenSev1 | $OpenSev2 |"
}

function Get-IsoWeekNumber {
  param([datetime]$DateUtc)

  $daysOffset = 3 - (([int]$DateUtc.DayOfWeek + 6) % 7)
  $thursday = $DateUtc.Date.AddDays($daysOffset)
  $firstThursday = (Get-Date -Year $thursday.Year -Month 1 -Day 4).ToUniversalTime()
  $firstWeekStart = $firstThursday.Date.AddDays(-(([int]$firstThursday.DayOfWeek + 6) % 7))
  return [int](($thursday - $firstWeekStart).TotalDays / 7) + 1
}

$repoRoot = Resolve-RepoRoot
$resolvedOutDir = if ([System.IO.Path]::IsPathRooted($OutDir)) {
  $OutDir
} else {
  Join-Path $repoRoot $OutDir
}
Ensure-Directory -Path $resolvedOutDir

$checks = New-Object 'System.Collections.Generic.List[object]'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$generatedAtUtc = (Get-Date).ToUniversalTime()

try {
  if (-not $SkipSmoke) {
    $smokeScriptPath = Join-Path $repoRoot "scripts/pilot/smoke-check.ps1"
    $smokeExitCode = Invoke-ScriptFile -ScriptPath $smokeScriptPath -Arguments @{
      BaseUrl = $BaseUrl
      Email = $Email
      Password = $Password
    }
    $smokeStatus = if ($smokeExitCode -eq 0) { "PASS" } else { "FAIL" }
    Add-Check -Checks $checks -Name "Pilot smoke check" -Actual ("ExitCode={0}" -f $smokeExitCode) -Threshold "ExitCode=0" -Status $smokeStatus -Required $true
    if ($smokeExitCode -ne 0) {
      throw "Smoke check failed with exit code $smokeExitCode."
    }
  } else {
    Add-Check -Checks $checks -Name "Pilot smoke check" -Actual "Skipped by parameter" -Threshold "ExitCode=0" -Status "SKIPPED" -Required $false
  }

  if ($RunQualityGates) {
    $lintExitCode = Invoke-CliCommand -Name "lint" -Command "npm run lint" -WorkDir $repoRoot
    Add-Check -Checks $checks -Name "Quality gate: lint" -Actual ("ExitCode={0}" -f $lintExitCode) -Threshold "ExitCode=0" -Status ($(if ($lintExitCode -eq 0) { "PASS" } else { "FAIL" })) -Required $true

    $testExitCode = Invoke-CliCommand -Name "test" -Command "npm test" -WorkDir $repoRoot
    Add-Check -Checks $checks -Name "Quality gate: test" -Actual ("ExitCode={0}" -f $testExitCode) -Threshold "ExitCode=0" -Status ($(if ($testExitCode -eq 0) { "PASS" } else { "FAIL" })) -Required $true

    $buildExitCode = Invoke-CliCommand -Name "build" -Command "npm run build" -WorkDir $repoRoot
    Add-Check -Checks $checks -Name "Quality gate: build" -Actual ("ExitCode={0}" -f $buildExitCode) -Threshold "ExitCode=0" -Status ($(if ($buildExitCode -eq 0) { "PASS" } else { "FAIL" })) -Required $true
  } else {
    Add-Check -Checks $checks -Name "Quality gates (lint/test/build)" -Actual "Not executed" -Threshold "All pass" -Status "SKIPPED" -Required $true -Detail "Run with -RunQualityGates to enforce."
  }

  if ($RunPerformanceGate) {
    $performanceScriptPath = Join-Path $repoRoot "scripts/pilot/performance-gate.ps1"
    $performanceExitCode = Invoke-ScriptFile -ScriptPath $performanceScriptPath -Arguments @{
      BaseUrl = $BaseUrl
      Email = $Email
      Password = $Password
      OutDir = $resolvedOutDir
    }
    Add-Check -Checks $checks -Name "Performance gate" -Actual ("ExitCode={0}" -f $performanceExitCode) -Threshold "ExitCode=0" -Status ($(if ($performanceExitCode -eq 0) { "PASS" } else { "FAIL" })) -Required $true
  } else {
    Add-Check -Checks $checks -Name "Performance gate" -Actual "Not executed" -Threshold "ExitCode=0" -Status "SKIPPED" -Required $false -Detail "Run with -RunPerformanceGate to enforce."
  }

  if ($RunSecurityGate) {
    $securityScriptPath = Join-Path $repoRoot "scripts/pilot/security-gate.ps1"
    $securityExitCode = Invoke-ScriptFile -ScriptPath $securityScriptPath -Arguments @{
      BaseUrl = $BaseUrl
      OutDir = $resolvedOutDir
    }
    Add-Check -Checks $checks -Name "Security gate" -Actual ("ExitCode={0}" -f $securityExitCode) -Threshold "ExitCode=0" -Status ($(if ($securityExitCode -eq 0) { "PASS" } else { "FAIL" })) -Required $true
  } else {
    Add-Check -Checks $checks -Name "Security gate" -Actual "Not executed" -Threshold "ExitCode=0" -Status "SKIPPED" -Required $false -Detail "Run with -RunSecurityGate to enforce."
  }

  $loginResponse = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/auth/login" -Body @{
    email    = $Email
    password = $Password
  } -Session $session
  $loginBody = Parse-JsonBody -Step "Login" -Response $loginResponse
  if (-not $loginBody.authenticated) {
    throw "Unable to authenticate for Go/No-Go decision generation."
  }

  $insightsResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/insights/overview" -Body $null -Session $session
  $insights = Parse-JsonBody -Step "Travel insights" -Response $insightsResponse

  $requestsResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/requests" -Body $null -Session $session
  $requests = To-Array (Parse-JsonBody -Step "Travel requests" -Response $requestsResponse)

  $activePolicyResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/policy/active" -Body $null -Session $session
  $activePolicy = Parse-JsonBody -Step "Active policy" -Response $activePolicyResponse

  $bookedRequests = $requests | Where-Object { $_.status -eq "booked" }
  $bookedBlockedClosure = 0
  foreach ($request in $bookedRequests) {
    $requestId = [string]$request.id
    if ([string]::IsNullOrWhiteSpace($requestId)) {
      continue
    }
    $closureResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/requests/$requestId/closure/readiness" -Body $null -Session $session
    $closureBody = Parse-JsonBody -Step "Closure readiness [$requestId]" -Response $closureResponse
    if (-not $closureBody.readiness.ready) {
      $bookedBlockedClosure += 1
    }
  }

  $complianceRate = [double]$insights.complianceRate
  $blockedPolicyRate = [double]$insights.blockedPolicyRate

  Add-Check -Checks $checks -Name "Compliance rate" -Actual ("{0}%" -f $complianceRate) -Threshold (">= {0}%" -f $MinComplianceRate) -Status ($(if ($complianceRate -ge $MinComplianceRate) { "PASS" } else { "FAIL" })) -Required $true
  Add-Check -Checks $checks -Name "Blocked policy rate" -Actual ("{0}%" -f $blockedPolicyRate) -Threshold ("<= {0}%" -f $MaxBlockedPolicyRate) -Status ($(if ($blockedPolicyRate -le $MaxBlockedPolicyRate) { "PASS" } else { "FAIL" })) -Required $true
  Add-Check -Checks $checks -Name "Open SEV-1 incidents" -Actual ([string]$OpenSev1) -Threshold "= 0" -Status ($(if ($OpenSev1 -eq 0) { "PASS" } else { "FAIL" })) -Required $true
  Add-Check -Checks $checks -Name "Open SEV-2 incidents" -Actual ([string]$OpenSev2) -Threshold "= 0" -Status ($(if ($OpenSev2 -eq 0) { "PASS" } else { "FAIL" })) -Required $true
  Add-Check -Checks $checks -Name "Booked requests blocked from closure" -Actual ([string]$bookedBlockedClosure) -Threshold ("<= {0}" -f $MaxBookedBlockedClosure) -Status ($(if ($bookedBlockedClosure -le $MaxBookedBlockedClosure) { "PASS" } else { "FAIL" })) -Required $true

  $requiredChecks = $checks | Where-Object { $_.Required }
  $failedRequired = $requiredChecks | Where-Object { $_.Status -eq "FAIL" }
  $skippedRequired = $requiredChecks | Where-Object { $_.Status -eq "SKIPPED" }

  $decision = if ($failedRequired.Count -gt 0) {
    "NO-GO"
  } elseif ($skippedRequired.Count -gt 0) {
    "CONDITIONAL-GO"
  } else {
    "GO"
  }

  $weekNumber = Get-IsoWeekNumber -DateUtc $generatedAtUtc
  $weekLabel = "{0}-W{1}" -f $generatedAtUtc.ToString("yyyy"), $weekNumber.ToString("00")
  $reportPath = Join-Path $resolvedOutDir "go-no-go-decision-$weekLabel.md"

  $lines = New-Object 'System.Collections.Generic.List[string]'
  $generatedAtText = $generatedAtUtc.ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  $weekStart = $generatedAtUtc.Date.AddDays(-(([int]$generatedAtUtc.DayOfWeek + 6) % 7))
  $weekEnd = $weekStart.AddDays(6)

  $lines.Add("# Travel ERP Go-No-Go Decision") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("- Decision: **$decision**") | Out-Null
  $lines.Add("- Generated at: $generatedAtText") | Out-Null
  $lines.Add("- Week: $weekLabel ($($weekStart.ToString("yyyy-MM-dd")) to $($weekEnd.ToString("yyyy-MM-dd")))") | Out-Null
  $lines.Add("- Environment: $BaseUrl") | Out-Null
  $lines.Add("- Active policy version: $($activePolicy.versionId)") | Out-Null
  $lines.Add("") | Out-Null

  $lines.Add("## Automated Criteria") | Out-Null
  $lines.Add("| Criterion | Actual | Threshold | Status |") | Out-Null
  $lines.Add("|---|---|---|---|") | Out-Null
  foreach ($check in $checks) {
    $lines.Add("| $($check.Name) | $($check.Actual) | $($check.Threshold) | $($check.Status) |") | Out-Null
  }
  $lines.Add("") | Out-Null

  $lines.Add("## KPI Snapshot") | Out-Null
  $lines.Add("- Total requests: $($insights.totalRequests)") | Out-Null
  $lines.Add("- In-flight requests: $((@($requests | Where-Object { $_.status -in @("submitted", "manager_approved", "travel_review", "finance_approved") })).Count)") | Out-Null
  $lines.Add("- Booked requests: $($bookedRequests.Count)") | Out-Null
  $lines.Add("- Closed requests: $((@($requests | Where-Object { $_.status -eq "closed" })).Count)") | Out-Null
  $lines.Add("- Compliance rate: $complianceRate%") | Out-Null
  $lines.Add("- Blocked policy rate: $blockedPolicyRate%") | Out-Null
  $lines.Add("- Average lead time: $($insights.averageLeadTimeDays) days") | Out-Null
  $lines.Add("- Average approval cycle: $($insights.averageApprovalCycleHours) hours") | Out-Null
  $lines.Add("") | Out-Null

  $lines.Add("## Risk Notes") | Out-Null
  if ($failedRequired.Count -eq 0 -and $skippedRequired.Count -eq 0) {
    $lines.Add("- No automated blocking risks detected.") | Out-Null
  } else {
    foreach ($check in ($failedRequired + $skippedRequired)) {
      $lines.Add("- [$($check.Status)] $($check.Name): actual=$($check.Actual), threshold=$($check.Threshold).") | Out-Null
    }
  }
  $lines.Add("") | Out-Null

  $lines.Add("## Decision Sign-Off") | Out-Null
  $lines.Add("- [ ] Product Owner") | Out-Null
  $lines.Add("- [ ] Operations Lead") | Out-Null
  $lines.Add("- [ ] Finance Lead") | Out-Null
  $lines.Add("- [ ] Security Owner (if applicable)") | Out-Null

  Set-Content -Path $reportPath -Value ($lines -join [Environment]::NewLine) -Encoding UTF8

  $historyPath = Join-Path $resolvedOutDir "go-no-go-history.md"
  Ensure-HistoryFile -Path $historyPath
  Append-HistoryRow -Path $historyPath -Decision $decision -ComplianceRate $complianceRate -BlockedPolicyRate $blockedPolicyRate -OpenSev1 $OpenSev1 -OpenSev2 $OpenSev2

  $logoutResponse = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/auth/logout" -Body @{} -Session $session
  $null = Parse-JsonBody -Step "Logout" -Response $logoutResponse

  Write-Host "Go/No-Go decision report generated: $reportPath"
  Write-Host "History updated: $historyPath"
  Write-Host "Decision result: $decision"
  exit 0
} catch {
  Write-Host "Go/No-Go decision generation failed."
  if ($Error.Count -gt 0) {
    Write-Host ($Error[0] | Out-String)
  } else {
    Write-Host "Unknown error."
  }
  exit 1
}
