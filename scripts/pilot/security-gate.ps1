param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$OutDir = "docs/operations/reports",
  [string]$AdminEmail = "admin@enterprise.local",
  [string]$AdminPassword = "Admin@12345",
  [string]$ManagerEmail = "manager@enterprise.local",
  [string]$ManagerPassword = "Manager@12345",
  [string]$AgentEmail = "agent@enterprise.local",
  [string]$AgentPassword = "Agent@12345",
  [string]$AuditorEmail = "auditor@enterprise.local",
  [string]$AuditorPassword = "Auditor@12345",
  [string]$FinanceEmail = "finance@enterprise.local",
  [string]$FinancePassword = "Finance@12345"
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

function Convert-ToRepoRelativePath {
  param(
    [string]$RepoRoot,
    [string]$Path
  )

  $fullPath = if (Test-Path $Path) {
    (Resolve-Path $Path).Path
  } else {
    [System.IO.Path]::GetFullPath($Path)
  }

  if ($fullPath.StartsWith($RepoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    $relative = $fullPath.Substring($RepoRoot.Length).TrimStart([char[]]@('\', '/'))
    return $relative.Replace('\', '/')
  }

  return $fullPath
}

function Invoke-RequestWithStatus {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session
  )

  $requestParams = @{
    Method          = $Method
    Uri             = $Url
    UseBasicParsing = $true
    ErrorAction     = "Stop"
  }

  if ($null -ne $Session) {
    $requestParams.WebSession = $Session
  }

  if ($null -ne $Body) {
    $requestParams.ContentType = "application/json"
    $requestParams.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }

  try {
    $response = Invoke-WebRequest @requestParams
    return [pscustomobject]@{
      StatusCode = [int]$response.StatusCode
      Content = [string]$response.Content
    }
  } catch {
    if (-not $_.Exception.Response) {
      throw
    }

    $statusCode = [int]$_.Exception.Response.StatusCode.value__
    $content = ""

    try {
      $stream = $_.Exception.Response.GetResponseStream()
      if ($null -ne $stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $content = $reader.ReadToEnd()
        $reader.Dispose()
        $stream.Dispose()
      }
    } catch {
      $content = ""
    }

    return [pscustomobject]@{
      StatusCode = $statusCode
      Content = [string]$content
    }
  }
}

function Assert-Login {
  param(
    [string]$Email,
    [string]$Password,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session
  )

  $login = Invoke-RequestWithStatus -Method "POST" -Url "$BaseUrl/api/auth/login" -Body @{
    email = $Email
    password = $Password
  } -Session $Session

  if ($login.StatusCode -ne 200) {
    throw "Login failed for $Email (status $($login.StatusCode))."
  }

  $payload = $null
  try {
    $payload = $login.Content | ConvertFrom-Json
  } catch {
    throw "Login response was not JSON for $Email."
  }

  if (-not $payload.authenticated) {
    throw "Login response authenticated=false for $Email."
  }
}

function Invoke-Logout {
  param([Microsoft.PowerShell.Commands.WebRequestSession]$Session)
  $null = Invoke-RequestWithStatus -Method "POST" -Url "$BaseUrl/api/auth/logout" -Body @{} -Session $Session
}

function Ensure-HistoryFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    @(
      "# Travel ERP Security Gate History"
      ""
      "| Timestamp (UTC) | Overall | Passed | Failed | Report |"
      "|---|---|---:|---:|---|"
    ) | Set-Content -Path $Path -Encoding UTF8
  }
}

function Append-HistoryRow {
  param(
    [string]$Path,
    [string]$Overall,
    [int]$Passed,
    [int]$Failed,
    [string]$ReportPath
  )

  $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  Add-Content -Path $Path -Encoding UTF8 -Value "| $timestamp | $Overall | $Passed | $Failed | $ReportPath |"
}

function Add-CheckResult {
  param(
    [System.Collections.Generic.List[object]]$Results,
    [string]$Name,
    [int]$ExpectedStatus,
    [int]$ActualStatus,
    [string]$Detail
  )

  $status = if ($ExpectedStatus -eq $ActualStatus) { "PASS" } else { "FAIL" }
  $Results.Add([pscustomobject]@{
      Name = $Name
      ExpectedStatus = $ExpectedStatus
      ActualStatus = $ActualStatus
      Status = $status
      Detail = $Detail
    }) | Out-Null
}

$repoRoot = Resolve-RepoRoot
$resolvedOutDir = if ([System.IO.Path]::IsPathRooted($OutDir)) { $OutDir } else { Join-Path $repoRoot $OutDir }
Ensure-Directory -Path $resolvedOutDir

$generatedAtUtc = (Get-Date).ToUniversalTime()
$reportDate = $generatedAtUtc.ToString("yyyy-MM-dd")
$reportPath = Join-Path $resolvedOutDir "security-gate-$reportDate.md"
$results = New-Object 'System.Collections.Generic.List[object]'

$anonymousSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$managerSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$agentSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$auditorSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$financeSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

try {
  $anonymousTravel = Invoke-RequestWithStatus -Method "GET" -Url "$BaseUrl/api/travel/requests" -Body $null -Session $anonymousSession
  Add-CheckResult -Results $results -Name "Anonymous access to travel requests is blocked" -ExpectedStatus 401 -ActualStatus $anonymousTravel.StatusCode -Detail "GET /api/travel/requests"

  $anonymousSalesTransition = Invoke-RequestWithStatus -Method "POST" -Url "$BaseUrl/api/sales/orders/TRX-9999/transition" -Body @{
    transitionId = "review_ocr"
  } -Session $anonymousSession
  Add-CheckResult -Results $results -Name "Anonymous access to sales transition API is blocked" -ExpectedStatus 401 -ActualStatus $anonymousSalesTransition.StatusCode -Detail "POST /api/sales/orders/TRX-9999/transition"

  $anonymousOcrExtract = Invoke-RequestWithStatus -Method "POST" -Url "$BaseUrl/api/ocr/extract" -Body $null -Session $anonymousSession
  Add-CheckResult -Results $results -Name "Anonymous access to OCR extract API is blocked" -ExpectedStatus 401 -ActualStatus $anonymousOcrExtract.StatusCode -Detail "POST /api/ocr/extract"

  Assert-Login -Email $ManagerEmail -Password $ManagerPassword -Session $managerSession
  $managerFinanceSync = Invoke-RequestWithStatus -Method "POST" -Url "$BaseUrl/api/travel/requests/TRV-9999/finance/sync" -Body $null -Session $managerSession
  Add-CheckResult -Results $results -Name "Manager cannot execute finance sync" -ExpectedStatus 403 -ActualStatus $managerFinanceSync.StatusCode -Detail "POST /api/travel/requests/TRV-9999/finance/sync"

  $managerPolicyActivate = Invoke-RequestWithStatus -Method "POST" -Url "$BaseUrl/api/travel/policy/versions/POL-9999/activate" -Body @{} -Session $managerSession
  Add-CheckResult -Results $results -Name "Manager cannot activate policy versions" -ExpectedStatus 403 -ActualStatus $managerPolicyActivate.StatusCode -Detail "POST /api/travel/policy/versions/POL-9999/activate"
  Invoke-Logout -Session $managerSession

  Assert-Login -Email $AgentEmail -Password $AgentPassword -Session $agentSession
  $agentAudit = Invoke-RequestWithStatus -Method "GET" -Url "$BaseUrl/api/travel/reports/audit" -Body $null -Session $agentSession
  Add-CheckResult -Results $results -Name "Agent cannot export travel audit report" -ExpectedStatus 403 -ActualStatus $agentAudit.StatusCode -Detail "GET /api/travel/reports/audit"
  $agentSalesTransition = Invoke-RequestWithStatus -Method "POST" -Url "$BaseUrl/api/sales/orders/TRX-9999/transition" -Body @{
    transitionId = "review_ocr"
  } -Session $agentSession
  Add-CheckResult -Results $results -Name "Agent reaches sales transition handler (not forbidden)" -ExpectedStatus 404 -ActualStatus $agentSalesTransition.StatusCode -Detail "POST /api/sales/orders/TRX-9999/transition"
  $agentOcrExtract = Invoke-RequestWithStatus -Method "POST" -Url "$BaseUrl/api/ocr/extract" -Body $null -Session $agentSession
  Add-CheckResult -Results $results -Name "Agent reaches OCR extract handler (not forbidden)" -ExpectedStatus 400 -ActualStatus $agentOcrExtract.StatusCode -Detail "POST /api/ocr/extract"
  Invoke-Logout -Session $agentSession

  Assert-Login -Email $AuditorEmail -Password $AuditorPassword -Session $auditorSession
  $auditorAudit = Invoke-RequestWithStatus -Method "GET" -Url "$BaseUrl/api/travel/reports/audit" -Body $null -Session $auditorSession
  Add-CheckResult -Results $results -Name "Auditor can export travel audit report" -ExpectedStatus 200 -ActualStatus $auditorAudit.StatusCode -Detail "GET /api/travel/reports/audit"
  $auditorSalesTransition = Invoke-RequestWithStatus -Method "POST" -Url "$BaseUrl/api/sales/orders/TRX-9999/transition" -Body @{
    transitionId = "review_ocr"
  } -Session $auditorSession
  Add-CheckResult -Results $results -Name "Auditor cannot execute sales transition" -ExpectedStatus 403 -ActualStatus $auditorSalesTransition.StatusCode -Detail "POST /api/sales/orders/TRX-9999/transition"
  $auditorOcrExtract = Invoke-RequestWithStatus -Method "POST" -Url "$BaseUrl/api/ocr/extract" -Body $null -Session $auditorSession
  Add-CheckResult -Results $results -Name "Auditor cannot execute OCR extraction" -ExpectedStatus 403 -ActualStatus $auditorOcrExtract.StatusCode -Detail "POST /api/ocr/extract"
  Invoke-Logout -Session $auditorSession

  Assert-Login -Email $FinanceEmail -Password $FinancePassword -Session $financeSession
  $financeSyncMissingRequest = Invoke-RequestWithStatus -Method "POST" -Url "$BaseUrl/api/travel/requests/TRV-9999/finance/sync" -Body $null -Session $financeSession
  Add-CheckResult -Results $results -Name "Finance reaches sync handler (not forbidden)" -ExpectedStatus 404 -ActualStatus $financeSyncMissingRequest.StatusCode -Detail "POST /api/travel/requests/TRV-9999/finance/sync"
  Invoke-Logout -Session $financeSession

  Assert-Login -Email $AdminEmail -Password $AdminPassword -Session $adminSession
  $adminAudit = Invoke-RequestWithStatus -Method "GET" -Url "$BaseUrl/api/travel/reports/audit" -Body $null -Session $adminSession
  Add-CheckResult -Results $results -Name "Admin can export travel audit report" -ExpectedStatus 200 -ActualStatus $adminAudit.StatusCode -Detail "GET /api/travel/reports/audit"
  Invoke-Logout -Session $adminSession

  $failed = @($results | Where-Object { $_.Status -eq "FAIL" })
  $passed = @($results | Where-Object { $_.Status -eq "PASS" })
  $overall = if ($failed.Count -gt 0) { "FAIL" } else { "PASS" }

  $generatedAtText = $generatedAtUtc.ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  $relativeReportPath = Convert-ToRepoRelativePath -RepoRoot $repoRoot -Path $reportPath

  $lines = New-Object 'System.Collections.Generic.List[string]'
  $lines.Add("# Travel ERP Security Gate Report") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("- Generated at: $generatedAtText") | Out-Null
  $lines.Add("- Environment: $BaseUrl") | Out-Null
  $lines.Add("- Overall result: **$overall**") | Out-Null
  $lines.Add("- Passed checks: $($passed.Count)") | Out-Null
  $lines.Add("- Failed checks: $($failed.Count)") | Out-Null
  $lines.Add("") | Out-Null

  $lines.Add("## Check Results") | Out-Null
  $lines.Add("| Check | Expected Status | Actual Status | Status | Detail |") | Out-Null
  $lines.Add("|---|---:|---:|---|---|") | Out-Null
  foreach ($result in $results) {
    $lines.Add("| $($result.Name) | $($result.ExpectedStatus) | $($result.ActualStatus) | $($result.Status) | $($result.Detail) |") | Out-Null
  }
  $lines.Add("") | Out-Null

  $lines.Add("## Outcome") | Out-Null
  if ($overall -eq "PASS") {
    $lines.Add("- Security gate checks passed for permission boundaries and protected APIs.") | Out-Null
  } else {
    $lines.Add("- One or more security gate checks failed.") | Out-Null
    $lines.Add("- Review permission guards and route authorization before go-live.") | Out-Null
  }

  Set-Content -Path $reportPath -Value ($lines -join [Environment]::NewLine) -Encoding UTF8

  $historyPath = Join-Path $resolvedOutDir "security-gate-history.md"
  Ensure-HistoryFile -Path $historyPath
  Append-HistoryRow -Path $historyPath -Overall $overall -Passed $passed.Count -Failed $failed.Count -ReportPath $relativeReportPath

  Write-Host "Security gate report generated: $reportPath"
  Write-Host "Security gate history updated: $historyPath"
  Write-Host "Security gate result: $overall"

  if ($overall -ne "PASS") {
    exit 1
  }
  exit 0
} catch {
  Write-Host "Security gate execution failed."
  if ($Error.Count -gt 0) {
    Write-Host ($Error[0] | Out-String)
  } else {
    Write-Host "Unknown error."
  }
  exit 1
}
