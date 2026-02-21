param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Email = "admin@enterprise.local",
  [string]$Password = "Admin@12345"
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
    Method      = $Method
    Uri         = $Url
    WebSession  = $Session
    UseBasicParsing = $true
    ErrorAction = "Stop"
  }

  if ($null -ne $Body) {
    $requestParams.ContentType = "application/json"
    $requestParams.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }

  return Invoke-WebRequest @requestParams
}

function Assert-Status {
  param(
    [string]$Step,
    [Microsoft.PowerShell.Commands.WebResponseObject]$Response,
    [int[]]$AllowedStatusCodes = @(200)
  )

  if ($AllowedStatusCodes -notcontains $Response.StatusCode) {
    throw "$Step failed. Expected status $($AllowedStatusCodes -join ", "), received $($Response.StatusCode)."
  }
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

Write-Host "Travel ERP pilot smoke check started against $BaseUrl"

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$checks = New-Object System.Collections.Generic.List[string]

try {
  $loginResponse = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/auth/login" -Body @{
    email    = $Email
    password = $Password
  } -Session $session
  Assert-Status -Step "Login" -Response $loginResponse
  $loginBody = Parse-JsonBody -Step "Login" -Response $loginResponse
  if (-not $loginBody.authenticated) {
    throw "Login failed. authenticated=false."
  }
  $checks.Add("Login") | Out-Null

  $sessionResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/auth/session" -Body $null -Session $session
  Assert-Status -Step "Session check" -Response $sessionResponse
  $sessionBody = Parse-JsonBody -Step "Session check" -Response $sessionResponse
  if (-not $sessionBody.authenticated) {
    throw "Session check failed. authenticated=false."
  }
  $checks.Add("Session API") | Out-Null

  $requestsResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/requests" -Body $null -Session $session
  Assert-Status -Step "Travel requests" -Response $requestsResponse
  $requestsBody = Parse-JsonBody -Step "Travel requests" -Response $requestsResponse
  if ($requestsBody -isnot [System.Array]) {
    throw "Travel requests payload is not an array."
  }
  $checks.Add("Travel requests API") | Out-Null

  $insightsResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/insights/overview" -Body $null -Session $session
  Assert-Status -Step "Travel insights" -Response $insightsResponse
  $insightsBody = Parse-JsonBody -Step "Travel insights" -Response $insightsResponse
  if ($null -eq $insightsBody.totalRequests) {
    throw "Travel insights payload is missing totalRequests."
  }
  $checks.Add("Travel insights API") | Out-Null

  $activePolicyResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/policy/active" -Body $null -Session $session
  Assert-Status -Step "Active policy" -Response $activePolicyResponse
  $activePolicyBody = Parse-JsonBody -Step "Active policy" -Response $activePolicyResponse
  if ([string]::IsNullOrWhiteSpace($activePolicyBody.versionId)) {
    throw "Active policy payload is missing versionId."
  }
  $checks.Add("Active policy API") | Out-Null

  $policyVersionsResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/policy/versions" -Body $null -Session $session
  Assert-Status -Step "Policy versions" -Response $policyVersionsResponse
  $policyVersionsBody = Parse-JsonBody -Step "Policy versions" -Response $policyVersionsResponse
  if ($policyVersionsBody -isnot [System.Array]) {
    throw "Policy versions payload is not an array."
  }
  $checks.Add("Policy versions API") | Out-Null

  if ($requestsBody.Count -gt 0) {
    $firstRequestId = $requestsBody[0].id
    if (-not [string]::IsNullOrWhiteSpace($firstRequestId)) {
      $closureResponse = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/api/travel/requests/$firstRequestId/closure/readiness" -Body $null -Session $session
      Assert-Status -Step "Closure readiness" -Response $closureResponse
      $closureBody = Parse-JsonBody -Step "Closure readiness" -Response $closureResponse
      if ($null -eq $closureBody.readiness) {
        throw "Closure readiness payload is missing readiness."
      }
      $checks.Add("Closure readiness API") | Out-Null
    }
  }

  $logoutResponse = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/auth/logout" -Body @{} -Session $session
  Assert-Status -Step "Logout" -Response $logoutResponse
  $checks.Add("Logout") | Out-Null

  Write-Host ""
  Write-Host "Pilot smoke check completed successfully."
  Write-Host "Validated checks:"
  foreach ($check in $checks) {
    Write-Host "- $check"
  }
  exit 0
} catch {
  Write-Host "Pilot smoke check failed."
  if ($Error.Count -gt 0) {
    Write-Host ($Error[0] | Out-String)
  } else {
    Write-Host "Unknown error during pilot smoke check."
  }
  exit 1
}
