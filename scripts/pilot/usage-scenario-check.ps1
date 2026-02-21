param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$OutDir = "docs/operations/reports",
  [string]$AgentEmail = "agent@enterprise.local",
  [string]$AgentPassword = "Agent@12345",
  [string]$ManagerEmail = "manager@enterprise.local",
  [string]$ManagerPassword = "Manager@12345",
  [string]$TravelDeskEmail = "traveldesk@enterprise.local",
  [string]$TravelDeskPassword = "TravelDesk@12345",
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

function Invoke-ApiRequest {
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
    $requestParams.Body = ($Body | ConvertTo-Json -Depth 15 -Compress)
  }

  try {
    $response = Invoke-WebRequest @requestParams
    $content = [string]$response.Content
    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($content)) {
      try {
        $json = $content | ConvertFrom-Json
      } catch {
        $json = $null
      }
    }

    return [pscustomobject]@{
      StatusCode = [int]$response.StatusCode
      Content = $content
      Json = $json
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

    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($content)) {
      try {
        $json = $content | ConvertFrom-Json
      } catch {
        $json = $null
      }
    }

    return [pscustomobject]@{
      StatusCode = $statusCode
      Content = $content
      Json = $json
    }
  }
}

function Start-RoleSession {
  param(
    [string]$Email,
    [string]$Password
  )

  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $login = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl/api/auth/login" -Body @{
    email = $Email
    password = $Password
  } -Session $session

  if ($login.StatusCode -ne 200 -or -not $login.Json -or -not $login.Json.authenticated) {
    throw "Authentication failed for $Email (status=$($login.StatusCode))."
  }

  return $session
}

function Stop-RoleSession {
  param([Microsoft.PowerShell.Commands.WebRequestSession]$Session)
  $null = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl/api/auth/logout" -Body @{} -Session $Session
}

function Add-StepResult {
  param(
    [System.Collections.Generic.List[object]]$Results,
    [string]$Step,
    [string]$Expected,
    [string]$Actual,
    [string]$Status,
    [string]$Detail
  )

  $Results.Add([pscustomobject]@{
      Step = $Step
      Expected = $Expected
      Actual = $Actual
      Status = $Status
      Detail = $Detail
    }) | Out-Null
}

function Ensure-HistoryFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    @(
      "# Travel ERP Usage Scenario History"
      ""
      "| Timestamp (UTC) | Overall | Request ID | Report |"
      "|---|---|---|---|"
    ) | Set-Content -Path $Path -Encoding UTF8
  }
}

function Append-HistoryRow {
  param(
    [string]$Path,
    [string]$Overall,
    [string]$RequestId,
    [string]$ReportPath
  )

  $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  Add-Content -Path $Path -Encoding UTF8 -Value "| $timestamp | $Overall | $RequestId | $ReportPath |"
}

$repoRoot = Resolve-RepoRoot
$resolvedOutDir = if ([System.IO.Path]::IsPathRooted($OutDir)) { $OutDir } else { Join-Path $repoRoot $OutDir }
Ensure-Directory -Path $resolvedOutDir

$generatedAtUtc = (Get-Date).ToUniversalTime()
$reportDate = $generatedAtUtc.ToString("yyyy-MM-dd")
$reportPath = Join-Path $resolvedOutDir "usage-scenario-check-$reportDate.md"
$results = New-Object 'System.Collections.Generic.List[object]'

$requestId = ""
$agentSession = $null
$managerSession = $null
$travelDeskSession = $null
$financeSession = $null

try {
  $agentSession = Start-RoleSession -Email $AgentEmail -Password $AgentPassword
  $managerSession = Start-RoleSession -Email $ManagerEmail -Password $ManagerPassword
  $travelDeskSession = Start-RoleSession -Email $TravelDeskEmail -Password $TravelDeskPassword
  $financeSession = Start-RoleSession -Email $FinanceEmail -Password $FinancePassword

  $departureDate = $generatedAtUtc.AddDays(5).ToString("o")
  $returnDate = $generatedAtUtc.AddDays(8).ToString("o")

  $createResponse = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl/api/travel/requests" -Body @{
    employeeName = "Usage Scenario Employee"
    employeeEmail = "usage.scenario@enterprise.local"
    employeeGrade = "staff"
    department = "Operations"
    costCenter = "CC-OPS-901"
    tripType = "domestic"
    origin = "Riyadh"
    destination = "Jeddah"
    departureDate = $departureDate
    returnDate = $returnDate
    purpose = "Usage scenario validation run"
    travelClass = "economy"
    estimatedCost = 2200
    currency = "SAR"
  } -Session $agentSession

  if ($createResponse.StatusCode -eq 201 -and $createResponse.Json -and $createResponse.Json.id) {
    $requestId = [string]$createResponse.Json.id
    Add-StepResult -Results $results -Step "Create request" -Expected "201 + requestId" -Actual "201 + $requestId" -Status "PASS" -Detail "Request created successfully."
  } else {
    Add-StepResult -Results $results -Step "Create request" -Expected "201 + requestId" -Actual ([string]$createResponse.StatusCode) -Status "FAIL" -Detail "Unable to create request."
    throw "Failed to create travel request for usage scenario."
  }

  $submitResponse = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl/api/travel/requests/$requestId/transition" -Body @{
    transitionId = "submit_request"
  } -Session $agentSession
  if ($submitResponse.StatusCode -eq 200 -and $submitResponse.Json -and $submitResponse.Json.toStatus -eq "submitted") {
    Add-StepResult -Results $results -Step "Submit request" -Expected "200 + toStatus=submitted" -Actual "200 + toStatus=submitted" -Status "PASS" -Detail "Employee submitted request."
  } else {
    Add-StepResult -Results $results -Step "Submit request" -Expected "200 + toStatus=submitted" -Actual ([string]$submitResponse.StatusCode) -Status "FAIL" -Detail "Submit transition failed."
    throw "Failed to submit request."
  }

  $managerApproveResponse = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl/api/travel/requests/$requestId/transition" -Body @{
    transitionId = "approve_manager"
  } -Session $managerSession
  if ($managerApproveResponse.StatusCode -eq 200 -and $managerApproveResponse.Json -and $managerApproveResponse.Json.toStatus -eq "manager_approved") {
    Add-StepResult -Results $results -Step "Manager approval" -Expected "200 + toStatus=manager_approved" -Actual "200 + toStatus=manager_approved" -Status "PASS" -Detail "Manager approved request."
  } else {
    Add-StepResult -Results $results -Step "Manager approval" -Expected "200 + toStatus=manager_approved" -Actual ([string]$managerApproveResponse.StatusCode) -Status "FAIL" -Detail "Manager approval failed."
    throw "Failed manager approval transition."
  }

  $travelReviewResponse = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl/api/travel/requests/$requestId/transition" -Body @{
    transitionId = "start_travel_review"
  } -Session $travelDeskSession
  if ($travelReviewResponse.StatusCode -eq 200 -and $travelReviewResponse.Json -and $travelReviewResponse.Json.toStatus -eq "travel_review") {
    Add-StepResult -Results $results -Step "Travel desk review" -Expected "200 + toStatus=travel_review" -Actual "200 + toStatus=travel_review" -Status "PASS" -Detail "Travel desk moved request to review."
  } else {
    Add-StepResult -Results $results -Step "Travel desk review" -Expected "200 + toStatus=travel_review" -Actual ([string]$travelReviewResponse.StatusCode) -Status "FAIL" -Detail "Travel review transition failed."
    throw "Failed travel review transition."
  }

  $financeApproveResponse = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl/api/travel/requests/$requestId/transition" -Body @{
    transitionId = "approve_finance"
  } -Session $financeSession
  if ($financeApproveResponse.StatusCode -eq 200 -and $financeApproveResponse.Json -and $financeApproveResponse.Json.toStatus -eq "finance_approved") {
    Add-StepResult -Results $results -Step "Finance approval" -Expected "200 + toStatus=finance_approved" -Actual "200 + toStatus=finance_approved" -Status "PASS" -Detail "Finance approved request."
  } else {
    Add-StepResult -Results $results -Step "Finance approval" -Expected "200 + toStatus=finance_approved" -Actual ([string]$financeApproveResponse.StatusCode) -Status "FAIL" -Detail "Finance approval transition failed."
    throw "Failed finance approval transition."
  }

  $confirmBookingTransition = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl/api/travel/requests/$requestId/transition" -Body @{
    transitionId = "confirm_booking"
  } -Session $travelDeskSession
  if ($confirmBookingTransition.StatusCode -eq 200 -and $confirmBookingTransition.Json -and $confirmBookingTransition.Json.toStatus -eq "booked") {
    Add-StepResult -Results $results -Step "Booking confirmation transition" -Expected "200 + toStatus=booked" -Actual "200 + toStatus=booked" -Status "PASS" -Detail "Booking state confirmed."
  } else {
    Add-StepResult -Results $results -Step "Booking confirmation transition" -Expected "200 + toStatus=booked" -Actual ([string]$confirmBookingTransition.StatusCode) -Status "FAIL" -Detail "Confirm booking transition failed."
    throw "Failed booking confirmation transition."
  }

  $bookingUpdateResponse = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl/api/travel/requests/$requestId/booking" -Body @{
    vendor = "Usage Scenario Vendor"
    bookingReference = "BK-$requestId"
    ticketNumber = "ETKT-$requestId"
    bookedAt = $generatedAtUtc.AddDays(5).ToString("o")
    totalBookedCost = 2100
    currency = "SAR"
  } -Session $travelDeskSession
  if ($bookingUpdateResponse.StatusCode -eq 200 -and $bookingUpdateResponse.Json -and $bookingUpdateResponse.Json.request -and $bookingUpdateResponse.Json.request.booking) {
    Add-StepResult -Results $results -Step "Booking record update" -Expected "200 + booking persisted" -Actual "200 + booking persisted" -Status "PASS" -Detail "Booking metadata saved."
  } else {
    Add-StepResult -Results $results -Step "Booking record update" -Expected "200 + booking persisted" -Actual ([string]$bookingUpdateResponse.StatusCode) -Status "FAIL" -Detail "Booking update failed."
    throw "Failed booking record update."
  }

  $expenseSubmitResponse = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl/api/travel/requests/$requestId/expenses" -Body @{
    category = "hotel"
    amount = 900
    currency = "SAR"
    expenseDate = $generatedAtUtc.AddDays(6).ToString("o")
    merchant = "Usage Scenario Hotel"
    description = "Usage scenario expense"
    receiptFileName = "usage-scenario-receipt.pdf"
    receiptMimeType = "application/pdf"
    receiptSizeInBytes = 2400
  } -Session $agentSession

  $expenseId = ""
  if ($expenseSubmitResponse.StatusCode -eq 201 -and $expenseSubmitResponse.Json -and $expenseSubmitResponse.Json.expense -and $expenseSubmitResponse.Json.expense.id) {
    $expenseId = [string]$expenseSubmitResponse.Json.expense.id
    Add-StepResult -Results $results -Step "Expense submission" -Expected "201 + expenseId" -Actual "201 + $expenseId" -Status "PASS" -Detail "Expense submitted."
  } else {
    Add-StepResult -Results $results -Step "Expense submission" -Expected "201 + expenseId" -Actual ([string]$expenseSubmitResponse.StatusCode) -Status "FAIL" -Detail "Expense submission failed."
    throw "Failed expense submission."
  }

  $expenseApproveResponse = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl/api/travel/requests/$requestId/expenses/$expenseId/decision" -Body @{
    decision = "approve"
  } -Session $financeSession
  if ($expenseApproveResponse.StatusCode -eq 200 -and $expenseApproveResponse.Json -and $expenseApproveResponse.Json.expense -and $expenseApproveResponse.Json.expense.status -eq "approved") {
    Add-StepResult -Results $results -Step "Expense approval" -Expected "200 + expense.status=approved" -Actual "200 + expense.status=approved" -Status "PASS" -Detail "Expense approved by finance."
  } else {
    Add-StepResult -Results $results -Step "Expense approval" -Expected "200 + expense.status=approved" -Actual ([string]$expenseApproveResponse.StatusCode) -Status "FAIL" -Detail "Expense approval failed."
    throw "Failed expense approval."
  }

  $financeSyncResponse = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl/api/travel/requests/$requestId/finance/sync" -Body $null -Session $financeSession
  if ($financeSyncResponse.StatusCode -eq 200 -and $financeSyncResponse.Json -and $financeSyncResponse.Json.batchId) {
    Add-StepResult -Results $results -Step "Finance sync" -Expected "200 + batchId" -Actual "200 + $($financeSyncResponse.Json.batchId)" -Status "PASS" -Detail "ERP sync completed."
  } else {
    Add-StepResult -Results $results -Step "Finance sync" -Expected "200 + batchId" -Actual ([string]$financeSyncResponse.StatusCode) -Status "FAIL" -Detail "Finance sync failed."
    throw "Failed finance sync."
  }

  $closureReadinessResponse = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl/api/travel/requests/$requestId/closure/readiness" -Body $null -Session $financeSession
  if ($closureReadinessResponse.StatusCode -eq 200 -and $closureReadinessResponse.Json -and $closureReadinessResponse.Json.readiness) {
    $tripCompletedCheck = $closureReadinessResponse.Json.readiness.checks | Where-Object { $_.code -eq "trip_completed" } | Select-Object -First 1
    if ($closureReadinessResponse.Json.readiness.ready -eq $false -and $tripCompletedCheck -and $tripCompletedCheck.passed -eq $false) {
      Add-StepResult -Results $results -Step "Closure readiness validation" -Expected "200 + ready=false (trip_not_completed)" -Actual "200 + ready=false" -Status "PASS" -Detail "Trip is not yet completed, closure correctly blocked."
    } else {
      Add-StepResult -Results $results -Step "Closure readiness validation" -Expected "200 + ready=false (trip_not_completed)" -Actual "200 + unexpected readiness state" -Status "FAIL" -Detail "Unexpected closure readiness state."
      throw "Unexpected closure readiness response."
    }
  } else {
    Add-StepResult -Results $results -Step "Closure readiness validation" -Expected "200 + readiness payload" -Actual ([string]$closureReadinessResponse.StatusCode) -Status "FAIL" -Detail "Failed closure readiness call."
    throw "Failed closure readiness call."
  }

  $closeTripResponse = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl/api/travel/requests/$requestId/transition" -Body @{
    transitionId = "close_trip"
  } -Session $financeSession
  if ($closeTripResponse.StatusCode -eq 409 -and $closeTripResponse.Json -and $closeTripResponse.Json.code -eq "transition_not_allowed") {
    Add-StepResult -Results $results -Step "Close trip attempt before return date" -Expected "409 transition_not_allowed" -Actual "409 transition_not_allowed" -Status "PASS" -Detail "Close trip is correctly blocked before trip completion."
  } else {
    Add-StepResult -Results $results -Step "Close trip attempt before return date" -Expected "409 transition_not_allowed" -Actual ([string]$closeTripResponse.StatusCode) -Status "FAIL" -Detail "Unexpected close trip behavior before return date."
    throw "Unexpected close trip behavior."
  }

  if ($agentSession) { Stop-RoleSession -Session $agentSession }
  if ($managerSession) { Stop-RoleSession -Session $managerSession }
  if ($travelDeskSession) { Stop-RoleSession -Session $travelDeskSession }
  if ($financeSession) { Stop-RoleSession -Session $financeSession }

  $passed = @($results | Where-Object { $_.Status -eq "PASS" }).Count
  $failed = @($results | Where-Object { $_.Status -eq "FAIL" }).Count
  $overall = if ($failed -eq 0) { "PASS" } else { "FAIL" }
  $generatedAtText = $generatedAtUtc.ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  $relativeReportPath = Convert-ToRepoRelativePath -RepoRoot $repoRoot -Path $reportPath

  $lines = New-Object 'System.Collections.Generic.List[string]'
  $lines.Add("# Travel ERP Usage Scenario Check") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("- Generated at: $generatedAtText") | Out-Null
  $lines.Add("- Environment: $BaseUrl") | Out-Null
  $lines.Add("- Scenario request ID: $requestId") | Out-Null
  $lines.Add("- Overall result: **$overall**") | Out-Null
  $lines.Add("- Passed steps: $passed") | Out-Null
  $lines.Add("- Failed steps: $failed") | Out-Null
  $lines.Add("") | Out-Null

  $lines.Add("## Step Results") | Out-Null
  $lines.Add("| Step | Expected | Actual | Status | Detail |") | Out-Null
  $lines.Add("|---|---|---|---|---|") | Out-Null
  foreach ($row in $results) {
    $lines.Add("| $($row.Step) | $($row.Expected) | $($row.Actual) | $($row.Status) | $($row.Detail) |") | Out-Null
  }

  Set-Content -Path $reportPath -Value ($lines -join [Environment]::NewLine) -Encoding UTF8

  $historyPath = Join-Path $resolvedOutDir "usage-scenario-history.md"
  Ensure-HistoryFile -Path $historyPath
  Append-HistoryRow -Path $historyPath -Overall $overall -RequestId $requestId -ReportPath $relativeReportPath

  Write-Host "Usage scenario report generated: $reportPath"
  Write-Host "Usage scenario history updated: $historyPath"
  Write-Host "Usage scenario result: $overall"

  if ($overall -ne "PASS") {
    exit 1
  }
  exit 0
} catch {
  if ($agentSession) { Stop-RoleSession -Session $agentSession }
  if ($managerSession) { Stop-RoleSession -Session $managerSession }
  if ($travelDeskSession) { Stop-RoleSession -Session $travelDeskSession }
  if ($financeSession) { Stop-RoleSession -Session $financeSession }

  Write-Host "Usage scenario check failed."
  if ($Error.Count -gt 0) {
    Write-Host ($Error[0] | Out-String)
  } else {
    Write-Host "Unknown error."
  }
  exit 1
}
