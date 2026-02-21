param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Email = "admin@enterprise.local",
  [string]$Password = "Admin@12345",
  [string]$OutDir = "docs/operations/reports",
  [int]$Iterations = 30,
  [double]$MaxAverageMs = 700,
  [double]$MaxP95Ms = 1200,
  [double]$MaxErrorRatePercent = 1
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

function Get-Percentile {
  param(
    [double[]]$Values,
    [double]$Percentile
  )

  if ($Values.Count -eq 0) {
    return 0
  }

  $sorted = $Values | Sort-Object
  $index = [int][Math]::Ceiling(($Percentile / 100.0) * $sorted.Count) - 1
  if ($index -lt 0) {
    $index = 0
  }
  if ($index -ge $sorted.Count) {
    $index = $sorted.Count - 1
  }
  return [double]$sorted[$index]
}

function Ensure-HistoryFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    @(
      "# Travel ERP Performance Gate History"
      ""
      "| Timestamp (UTC) | Overall | Iterations | Max Avg (ms) | Max P95 (ms) | Max Error (%) | Report |"
      "|---|---|---:|---:|---:|---:|---|"
    ) | Set-Content -Path $Path -Encoding UTF8
  }
}

function Append-HistoryRow {
  param(
    [string]$Path,
    [string]$Overall,
    [int]$Iterations,
    [double]$MaxAvg,
    [double]$MaxP95,
    [double]$MaxErrorPercent,
    [string]$ReportPath
  )

  $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  Add-Content -Path $Path -Encoding UTF8 -Value "| $timestamp | $Overall | $Iterations | $MaxAvg | $MaxP95 | $MaxErrorPercent | $ReportPath |"
}

$repoRoot = Resolve-RepoRoot
$resolvedOutDir = if ([System.IO.Path]::IsPathRooted($OutDir)) { $OutDir } else { Join-Path $repoRoot $OutDir }
Ensure-Directory -Path $resolvedOutDir

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$generatedAtUtc = (Get-Date).ToUniversalTime()
$reportDate = $generatedAtUtc.ToString("yyyy-MM-dd")
$reportPath = Join-Path $resolvedOutDir "performance-gate-$reportDate.md"

$targets = @(
  @{
    Name = "Auth session"
    Method = "GET"
    Url = "$BaseUrl/api/auth/session"
    ExpectedStatus = 200
  },
  @{
    Name = "Travel requests"
    Method = "GET"
    Url = "$BaseUrl/api/travel/requests"
    ExpectedStatus = 200
  },
  @{
    Name = "Travel insights overview"
    Method = "GET"
    Url = "$BaseUrl/api/travel/insights/overview"
    ExpectedStatus = 200
  },
  @{
    Name = "Active policy"
    Method = "GET"
    Url = "$BaseUrl/api/travel/policy/active"
    ExpectedStatus = 200
  },
  @{
    Name = "Policy versions"
    Method = "GET"
    Url = "$BaseUrl/api/travel/policy/versions"
    ExpectedStatus = 200
  }
)

try {
  if ($Iterations -lt 5) {
    throw "Iterations must be >= 5."
  }

  $loginResponse = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/auth/login" -Body @{
    email    = $Email
    password = $Password
  } -Session $session
  $loginBody = Parse-JsonBody -Step "Login" -Response $loginResponse
  if (-not $loginBody.authenticated) {
    throw "Unable to authenticate for performance gate."
  }

  $results = New-Object 'System.Collections.Generic.List[object]'

  foreach ($target in $targets) {
    $durations = New-Object 'System.Collections.Generic.List[double]'
    $errors = 0

    for ($index = 0; $index -lt $Iterations; $index += 1) {
      $watch = [System.Diagnostics.Stopwatch]::StartNew()
      $statusCode = $null

      try {
        $response = Invoke-WebRequest -Method $target.Method -Uri $target.Url -WebSession $session -UseBasicParsing -ErrorAction Stop
        $statusCode = [int]$response.StatusCode
      } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
          $statusCode = [int]$_.Exception.Response.StatusCode
        }
      } finally {
        $watch.Stop()
      }

      $durations.Add([double]$watch.Elapsed.TotalMilliseconds) | Out-Null

      if ($statusCode -ne $target.ExpectedStatus) {
        $errors += 1
      }
    }

    $durationsArray = [double[]]$durations.ToArray()
    $averageMs = if ($durationsArray.Count -eq 0) { 0 } else { [Math]::Round(($durationsArray | Measure-Object -Average).Average, 2) }
    $p95Ms = [Math]::Round((Get-Percentile -Values $durationsArray -Percentile 95), 2)
    $errorRate = [Math]::Round((($errors * 100.0) / $Iterations), 2)

    $status = if ($averageMs -le $MaxAverageMs -and $p95Ms -le $MaxP95Ms -and $errorRate -le $MaxErrorRatePercent) {
      "PASS"
    } else {
      "FAIL"
    }

    $results.Add([pscustomobject]@{
        Name = $target.Name
        AverageMs = $averageMs
        P95Ms = $p95Ms
        ErrorRate = $errorRate
        Errors = $errors
        Status = $status
      }) | Out-Null
  }

  $overall = if (($results | Where-Object { $_.Status -eq "FAIL" }).Count -gt 0) { "FAIL" } else { "PASS" }
  $generatedAtText = $generatedAtUtc.ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  $relativeReportPath = Convert-ToRepoRelativePath -RepoRoot $repoRoot -Path $reportPath

  $lines = New-Object 'System.Collections.Generic.List[string]'
  $lines.Add("# Travel ERP Performance Gate Report") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("- Generated at: $generatedAtText") | Out-Null
  $lines.Add("- Environment: $BaseUrl") | Out-Null
  $lines.Add("- Iterations per endpoint: $Iterations") | Out-Null
  $lines.Add("- Overall result: **$overall**") | Out-Null
  $lines.Add("- Thresholds: avg <= $MaxAverageMs ms, p95 <= $MaxP95Ms ms, error <= $MaxErrorRatePercent%") | Out-Null
  $lines.Add("") | Out-Null

  $lines.Add("## Endpoint Results") | Out-Null
  $lines.Add("| Endpoint | Average (ms) | P95 (ms) | Errors | Error Rate (%) | Status |") | Out-Null
  $lines.Add("|---|---:|---:|---:|---:|---|") | Out-Null
  foreach ($row in $results) {
    $lines.Add("| $($row.Name) | $($row.AverageMs) | $($row.P95Ms) | $($row.Errors) | $($row.ErrorRate) | $($row.Status) |") | Out-Null
  }
  $lines.Add("") | Out-Null

  $lines.Add("## Outcome") | Out-Null
  if ($overall -eq "PASS") {
    $lines.Add("- Performance gate passed within configured thresholds.") | Out-Null
  } else {
    $lines.Add("- One or more endpoints exceeded configured thresholds.") | Out-Null
    $lines.Add("- Investigate slow endpoints before production go-live.") | Out-Null
  }

  Set-Content -Path $reportPath -Value ($lines -join [Environment]::NewLine) -Encoding UTF8

  $historyPath = Join-Path $resolvedOutDir "performance-gate-history.md"
  Ensure-HistoryFile -Path $historyPath
  Append-HistoryRow -Path $historyPath -Overall $overall -Iterations $Iterations -MaxAvg $MaxAverageMs -MaxP95 $MaxP95Ms -MaxErrorPercent $MaxErrorRatePercent -ReportPath $relativeReportPath

  $logoutResponse = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/auth/logout" -Body @{} -Session $session
  $null = Parse-JsonBody -Step "Logout" -Response $logoutResponse

  Write-Host "Performance gate report generated: $reportPath"
  Write-Host "Performance gate history updated: $historyPath"
  Write-Host "Performance gate result: $overall"

  if ($overall -ne "PASS") {
    exit 1
  }
  exit 0
} catch {
  Write-Host "Performance gate execution failed."
  if ($Error.Count -gt 0) {
    Write-Host ($Error[0] | Out-String)
  } else {
    Write-Host "Unknown error."
  }
  exit 1
}
