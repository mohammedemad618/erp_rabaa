param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Email = "admin@enterprise.local",
  [string]$Password = "Admin@12345",
  [string]$OutDir = "docs/operations/reports"
)

$ErrorActionPreference = "Stop"

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

function Get-WeekStartUtc {
  param([datetime]$DateUtc)

  $daysFromMonday = ([int]$DateUtc.DayOfWeek + 6) % 7
  return $DateUtc.Date.AddDays(-$daysFromMonday)
}

function Get-IsoWeekNumber {
  param([datetime]$DateUtc)

  $daysOffset = 3 - (([int]$DateUtc.DayOfWeek + 6) % 7)
  $thursday = $DateUtc.Date.AddDays($daysOffset)
  $firstThursday = (Get-Date -Year $thursday.Year -Month 1 -Day 4).ToUniversalTime()
  $firstWeekStart = Get-WeekStartUtc -DateUtc $firstThursday
  return [int](($thursday - $firstWeekStart).TotalDays / 7) + 1
}

function Write-Line {
  param(
    [System.Collections.Generic.List[string]]$Lines,
    [string]$Text = ""
  )
  $Lines.Add($Text) | Out-Null
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

try {
  $loginResponse = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/auth/login" -Body @{
    email    = $Email
    password = $Password
  } -Session $session
  $loginBody = Parse-JsonBody -Step "Login" -Response $loginResponse
  if (-not $loginBody.authenticated) {
    throw "Unable to authenticate for weekly summary."
  }

  $requestsResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/requests" -Body $null -Session $session
  $requests = To-Array (Parse-JsonBody -Step "Travel requests" -Response $requestsResponse)

  $insightsResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/insights/overview" -Body $null -Session $session
  $insights = Parse-JsonBody -Step "Travel insights" -Response $insightsResponse

  $activePolicyResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/policy/active" -Body $null -Session $session
  $activePolicy = Parse-JsonBody -Step "Active policy" -Response $activePolicyResponse

  $policyVersionsResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/policy/versions" -Body $null -Session $session
  $policyVersions = To-Array (Parse-JsonBody -Step "Policy versions" -Response $policyVersionsResponse)

  $nowUtc = (Get-Date).ToUniversalTime()
  $weekStart = Get-WeekStartUtc -DateUtc $nowUtc
  $weekEnd = $weekStart.AddDays(6).AddHours(23).AddMinutes(59).AddSeconds(59)
  $generatedAt = $nowUtc.ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  $weekNumber = Get-IsoWeekNumber -DateUtc $nowUtc
  $weekLabel = "{0}-W{1}" -f $nowUtc.ToString("yyyy"), $weekNumber.ToString("00")

  $inFlightRequests = $requests | Where-Object {
    $_.status -in @("submitted", "manager_approved", "travel_review", "finance_approved")
  }
  $blockedPolicyRequests = $requests | Where-Object { $_.policyEvaluation.level -eq "blocked" }
  $bookedRequests = $requests | Where-Object { $_.status -eq "booked" }
  $closedRequests = $requests | Where-Object { $_.status -eq "closed" }

  $bookedReadyToClose = 0
  $bookedBlockedClose = 0
  foreach ($request in $bookedRequests) {
    $requestId = [string]$request.id
    if ([string]::IsNullOrWhiteSpace($requestId)) {
      continue
    }
    $closureResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/requests/$requestId/closure/readiness" -Body $null -Session $session
    $closureBody = Parse-JsonBody -Step "Closure readiness [$requestId]" -Response $closureResponse
    if ($closureBody.readiness.ready) {
      $bookedReadyToClose += 1
    } else {
      $bookedBlockedClose += 1
    }
  }

  $policyStatusMap = @{}
  foreach ($version in $policyVersions) {
    $status = [string]$version.status
    if ([string]::IsNullOrWhiteSpace($status)) {
      continue
    }
    if (-not $policyStatusMap.ContainsKey($status)) {
      $policyStatusMap[$status] = 0
    }
    $policyStatusMap[$status] += 1
  }

  $slaBreaches = To-Array $insights.slaBreaches
  $budgetRisks = To-Array $insights.budgetRisks

  if (-not [System.IO.Path]::IsPathRooted($OutDir)) {
    $repoRoot = (Resolve-Path (Join-Path (Split-Path -Parent $PSCommandPath) "..\..")).Path
    $OutDir = Join-Path $repoRoot $OutDir
  }
  if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
  }

  $outputPath = Join-Path $OutDir "weekly-executive-summary-$weekLabel.md"
  $lines = New-Object 'System.Collections.Generic.List[string]'

  Write-Line -Lines $lines -Text "# Travel ERP Weekly Executive Summary"
  Write-Line -Lines $lines
  Write-Line -Lines $lines -Text "- Generated at: $generatedAt"
  Write-Line -Lines $lines -Text "- Environment: $BaseUrl"
  Write-Line -Lines $lines -Text "- Week window: $($weekStart.ToString("yyyy-MM-dd")) to $($weekEnd.ToString("yyyy-MM-dd"))"
  Write-Line -Lines $lines -Text "- Active policy version: $($activePolicy.versionId)"
  Write-Line -Lines $lines

  Write-Line -Lines $lines -Text "## Executive KPI Snapshot"
  Write-Line -Lines $lines -Text "- Total requests: $($insights.totalRequests)"
  Write-Line -Lines $lines -Text "- In-flight requests: $($inFlightRequests.Count)"
  Write-Line -Lines $lines -Text "- Booked requests: $($bookedRequests.Count)"
  Write-Line -Lines $lines -Text "- Closed requests: $($closedRequests.Count)"
  Write-Line -Lines $lines -Text "- Policy blocked requests: $($blockedPolicyRequests.Count)"
  Write-Line -Lines $lines -Text "- Compliance rate: $($insights.complianceRate)%"
  Write-Line -Lines $lines -Text "- Blocked policy rate: $($insights.blockedPolicyRate)%"
  Write-Line -Lines $lines -Text "- Average lead time: $($insights.averageLeadTimeDays) days"
  Write-Line -Lines $lines -Text "- Average approval cycle: $($insights.averageApprovalCycleHours) hours"
  Write-Line -Lines $lines -Text "- Booked ready to close: $bookedReadyToClose"
  Write-Line -Lines $lines -Text "- Booked blocked from closure: $bookedBlockedClose"
  Write-Line -Lines $lines

  Write-Line -Lines $lines -Text "## Policy Governance"
  Write-Line -Lines $lines -Text "| Policy Status | Count |"
  Write-Line -Lines $lines -Text "|---|---:|"
  foreach ($key in ($policyStatusMap.Keys | Sort-Object)) {
    Write-Line -Lines $lines -Text "| $key | $($policyStatusMap[$key]) |"
  }
  if ($policyStatusMap.Keys.Count -eq 0) {
    Write-Line -Lines $lines -Text "| (none) | 0 |"
  }
  Write-Line -Lines $lines

  Write-Line -Lines $lines -Text "## Top SLA Breaches"
  if ($slaBreaches.Count -eq 0) {
    Write-Line -Lines $lines -Text "- No active SLA breaches."
  } else {
    Write-Line -Lines $lines -Text "| Request | Status | Elapsed (h) | Exceeded (h) |"
    Write-Line -Lines $lines -Text "|---|---|---:|---:|"
    foreach ($row in ($slaBreaches | Select-Object -First 10)) {
      Write-Line -Lines $lines -Text "| $($row.requestId) | $($row.status) | $($row.elapsedHours) | $($row.exceededHours) |"
    }
  }
  Write-Line -Lines $lines

  Write-Line -Lines $lines -Text "## Top Budget Risks"
  if ($budgetRisks.Count -eq 0) {
    Write-Line -Lines $lines -Text "- No active budget risks."
  } else {
    Write-Line -Lines $lines -Text "| Cost Center | Requests | Utilization | Risk |"
    Write-Line -Lines $lines -Text "|---|---:|---:|---|"
    foreach ($row in ($budgetRisks | Select-Object -First 10)) {
      Write-Line -Lines $lines -Text "| $($row.costCenter) | $($row.requests) | $($row.utilizationRatio) | $($row.riskLevel) |"
    }
  }
  Write-Line -Lines $lines

  Write-Line -Lines $lines -Text "## Recommended Actions (Next 7 Days)"
  Write-Line -Lines $lines -Text "1. Prioritize in-flight requests exceeding SLA thresholds."
  Write-Line -Lines $lines -Text "2. Resolve closure blockers for booked requests."
  Write-Line -Lines $lines -Text "3. Review high-utilization cost centers with finance."
  Write-Line -Lines $lines -Text "4. Validate policy version readiness before next activation."

  Set-Content -Path $outputPath -Value ($lines -join [Environment]::NewLine) -Encoding UTF8

  $logoutResponse = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/auth/logout" -Body @{} -Session $session
  $null = Parse-JsonBody -Step "Logout" -Response $logoutResponse

  Write-Host "Weekly executive summary generated: $outputPath"
  exit 0
} catch {
  Write-Host "Weekly executive summary generation failed."
  if ($Error.Count -gt 0) {
    Write-Host ($Error[0] | Out-String)
  } else {
    Write-Host "Unknown error."
  }
  exit 1
}
