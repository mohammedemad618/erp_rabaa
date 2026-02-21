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

function Build-StatusMap {
  param([object[]]$Requests)
  $map = [ordered]@{
    draft = 0
    submitted = 0
    manager_approved = 0
    travel_review = 0
    finance_approved = 0
    booked = 0
    closed = 0
    rejected = 0
    cancelled = 0
  }

  foreach ($request in $Requests) {
    $status = [string]$request.status
    if ($map.Contains($status)) {
      $map[$status] += 1
    }
  }
  return $map
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
    throw "Unable to authenticate for daily health report."
  }

  $requestsResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/requests" -Body $null -Session $session
  $requestsBody = To-Array (Parse-JsonBody -Step "Travel requests" -Response $requestsResponse)

  $insightsResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/insights/overview" -Body $null -Session $session
  $insightsBody = Parse-JsonBody -Step "Travel insights" -Response $insightsResponse

  $policyResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/policy/active" -Body $null -Session $session
  $policyBody = Parse-JsonBody -Step "Active policy" -Response $policyResponse

  $policyVersionsResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/policy/versions" -Body $null -Session $session
  $policyVersions = To-Array (Parse-JsonBody -Step "Policy versions" -Response $policyVersionsResponse)

  $bookedRequests = $requestsBody | Where-Object { $_.status -eq "booked" }
  $closureReadyCount = 0
  $closureBlockedCount = 0

  foreach ($request in $bookedRequests) {
    $requestId = [string]$request.id
    if ([string]::IsNullOrWhiteSpace($requestId)) {
      continue
    }
    $closureResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/requests/$requestId/closure/readiness" -Body $null -Session $session
    $closureBody = Parse-JsonBody -Step "Closure readiness [$requestId]" -Response $closureResponse
    if ($closureBody.readiness.ready) {
      $closureReadyCount += 1
    } else {
      $closureBlockedCount += 1
    }
  }

  if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
  }

  $nowUtc = (Get-Date).ToUniversalTime()
  $reportDate = $nowUtc.ToString("yyyy-MM-dd")
  $reportTime = $nowUtc.ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  $reportPath = Join-Path $OutDir "daily-health-report-$reportDate.md"

  $statusMap = Build-StatusMap -Requests $requestsBody
  $slaBreaches = To-Array $insightsBody.slaBreaches
  $budgetRisks = To-Array $insightsBody.budgetRisks

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

  $lines = New-Object 'System.Collections.Generic.List[string]'
  Write-Line -Lines $lines -Text "# Travel ERP Daily Health Report"
  Write-Line -Lines $lines
  Write-Line -Lines $lines -Text "- Generated at: $reportTime"
  Write-Line -Lines $lines -Text "- Environment: $BaseUrl"
  Write-Line -Lines $lines -Text "- Active policy version: $($policyBody.versionId)"
  Write-Line -Lines $lines

  Write-Line -Lines $lines -Text "## Executive Summary"
  Write-Line -Lines $lines -Text "- Total requests: $($insightsBody.totalRequests)"
  Write-Line -Lines $lines -Text "- Booked requests: $($insightsBody.bookedRequests)"
  Write-Line -Lines $lines -Text "- Compliance rate: $($insightsBody.complianceRate)%"
  Write-Line -Lines $lines -Text "- Blocked policy rate: $($insightsBody.blockedPolicyRate)%"
  Write-Line -Lines $lines -Text "- Avg lead time (days): $($insightsBody.averageLeadTimeDays)"
  Write-Line -Lines $lines -Text "- Avg approval cycle (hours): $($insightsBody.averageApprovalCycleHours)"
  Write-Line -Lines $lines -Text "- Booked requests ready to close: $closureReadyCount"
  Write-Line -Lines $lines -Text "- Booked requests blocked from closure: $closureBlockedCount"
  Write-Line -Lines $lines

  Write-Line -Lines $lines -Text "## Request Status Distribution"
  Write-Line -Lines $lines -Text "| Status | Count |"
  Write-Line -Lines $lines -Text "|---|---:|"
  foreach ($key in $statusMap.Keys) {
    Write-Line -Lines $lines -Text "| $key | $($statusMap[$key]) |"
  }
  Write-Line -Lines $lines

  Write-Line -Lines $lines -Text "## Policy Version Distribution"
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
    foreach ($row in ($slaBreaches | Select-Object -First 5)) {
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
    foreach ($row in ($budgetRisks | Select-Object -First 5)) {
      Write-Line -Lines $lines -Text "| $($row.costCenter) | $($row.requests) | $($row.utilizationRatio) | $($row.riskLevel) |"
    }
  }
  Write-Line -Lines $lines

  Write-Line -Lines $lines -Text "## Actions"
  Write-Line -Lines $lines -Text "1. Review blocked booked requests and resolve closure blockers."
  Write-Line -Lines $lines -Text "2. Review top SLA breaches with approvers."
  Write-Line -Lines $lines -Text "3. Review high budget risk cost centers with finance."

  Set-Content -Path $reportPath -Value ($lines -join [Environment]::NewLine) -Encoding UTF8

  $logoutResponse = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/auth/logout" -Body @{} -Session $session
  $null = Parse-JsonBody -Step "Logout" -Response $logoutResponse

  Write-Host "Daily health report generated: $reportPath"
  exit 0
} catch {
  Write-Host "Daily health report generation failed."
  if ($Error.Count -gt 0) {
    Write-Host ($Error[0] | Out-String)
  } else {
    Write-Host "Unknown error."
  }
  exit 1
}
