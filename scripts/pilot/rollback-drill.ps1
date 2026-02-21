param(
  [string]$CurrentBaseUrl = "http://localhost:3000",
  [string]$RollbackBaseUrl = "http://localhost:3000",
  [string]$Email = "admin@enterprise.local",
  [string]$Password = "Admin@12345",
  [string]$CurrentReleaseId = "current-candidate",
  [string]$RollbackReleaseId = "rollback-candidate",
  [string]$OutDir = "docs/operations/reports"
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

function Invoke-ScriptFile {
  param(
    [string]$ScriptPath,
    [string[]]$Arguments = @()
  )

  $argList = @("-ExecutionPolicy", "Bypass", "-File", $ScriptPath)
  if ($Arguments.Count -gt 0) {
    $argList += $Arguments
  }

  $output = & powershell @argList 2>&1
  if ($null -ne $output) {
    foreach ($line in $output) {
      Write-Host $line
    }
  }

  return [int]$LASTEXITCODE
}

function Invoke-SmokeCheck {
  param(
    [string]$SmokeScriptPath,
    [string]$BaseUrl,
    [string]$Email,
    [string]$Password,
    [string]$ReleaseId
  )

  $exitCode = Invoke-ScriptFile -ScriptPath $SmokeScriptPath -Arguments @(
    "-BaseUrl", $BaseUrl,
    "-Email", $Email,
    "-Password", $Password
  )

  return [pscustomobject]@{
    BaseUrl = $BaseUrl
    ReleaseId = $ReleaseId
    ExitCode = $exitCode
    Status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }
  }
}

function Ensure-HistoryFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    @(
      "# Travel ERP Rollback Drill History"
      ""
      "| Timestamp (UTC) | Current Release | Rollback Release | Current Result | Rollback Result | Overall | Report |"
      "|---|---|---|---|---|---|---|"
    ) | Set-Content -Path $Path -Encoding UTF8
  }
}

function Append-HistoryRow {
  param(
    [string]$Path,
    [string]$CurrentReleaseId,
    [string]$RollbackReleaseId,
    [string]$CurrentResult,
    [string]$RollbackResult,
    [string]$OverallResult,
    [string]$ReportPath
  )

  $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  Add-Content -Path $Path -Encoding UTF8 -Value "| $timestamp | $CurrentReleaseId | $RollbackReleaseId | $CurrentResult | $RollbackResult | $OverallResult | $ReportPath |"
}

$repoRoot = Resolve-RepoRoot
$resolvedOutDir = if ([System.IO.Path]::IsPathRooted($OutDir)) {
  $OutDir
} else {
  Join-Path $repoRoot $OutDir
}
Ensure-Directory -Path $resolvedOutDir

$smokeScriptPath = Join-Path $repoRoot "scripts/pilot/smoke-check.ps1"
$nowUtc = (Get-Date).ToUniversalTime()
$timestampToken = $nowUtc.ToString("yyyy-MM-dd-HHmmss")
$reportPath = Join-Path $resolvedOutDir "rollback-drill-$timestampToken.md"
$relativeReportPath = Convert-ToRepoRelativePath -RepoRoot $repoRoot -Path $reportPath

try {
  Write-Host "Rollback drill started."
  Write-Host "Validating current release smoke check..."

  $currentResult = Invoke-SmokeCheck -SmokeScriptPath $smokeScriptPath -BaseUrl $CurrentBaseUrl -Email $Email -Password $Password -ReleaseId $CurrentReleaseId

  Write-Host "Validating rollback release smoke check..."
  $rollbackResult = Invoke-SmokeCheck -SmokeScriptPath $smokeScriptPath -BaseUrl $RollbackBaseUrl -Email $Email -Password $Password -ReleaseId $RollbackReleaseId

  $overallResult = if ($currentResult.ExitCode -eq 0 -and $rollbackResult.ExitCode -eq 0) {
    "PASS"
  } else {
    "FAIL"
  }

  $generatedAtText = $nowUtc.ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  $lines = New-Object 'System.Collections.Generic.List[string]'
  $lines.Add("# Travel ERP Rollback Drill Report") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("- Generated at: $generatedAtText") | Out-Null
  $lines.Add("- Overall result: **$overallResult**") | Out-Null
  $lines.Add("") | Out-Null

  $lines.Add("## Smoke Validation Matrix") | Out-Null
  $lines.Add("| Scenario | Release ID | Base URL | Result | Exit Code |") | Out-Null
  $lines.Add("|---|---|---|---|---:|") | Out-Null
  $lines.Add("| Current release | $($currentResult.ReleaseId) | $($currentResult.BaseUrl) | $($currentResult.Status) | $($currentResult.ExitCode) |") | Out-Null
  $lines.Add("| Rollback target | $($rollbackResult.ReleaseId) | $($rollbackResult.BaseUrl) | $($rollbackResult.Status) | $($rollbackResult.ExitCode) |") | Out-Null
  $lines.Add("") | Out-Null

  $lines.Add("## Operator Notes") | Out-Null
  if ($overallResult -eq "PASS") {
    $lines.Add("- Both current and rollback smoke checks passed.") | Out-Null
    $lines.Add("- Rollback plan is validated for this drill window.") | Out-Null
  } else {
    $lines.Add("- One or more smoke checks failed.") | Out-Null
    $lines.Add("- Investigate failing environment before go-live.") | Out-Null
    $lines.Add("- Do not mark rollback readiness as complete until this drill passes.") | Out-Null
  }
  $lines.Add("") | Out-Null

  $lines.Add("## Sign-Off") | Out-Null
  $lines.Add("- [ ] Operations Lead") | Out-Null
  $lines.Add("- [ ] Platform/DevOps Owner") | Out-Null
  $lines.Add("- [ ] Product Owner") | Out-Null

  Set-Content -Path $reportPath -Value ($lines -join [Environment]::NewLine) -Encoding UTF8

  $historyPath = Join-Path $resolvedOutDir "rollback-drill-history.md"
  $relativeHistoryPath = Convert-ToRepoRelativePath -RepoRoot $repoRoot -Path $historyPath
  Ensure-HistoryFile -Path $historyPath
  Append-HistoryRow -Path $historyPath -CurrentReleaseId $CurrentReleaseId -RollbackReleaseId $RollbackReleaseId -CurrentResult $currentResult.Status -RollbackResult $rollbackResult.Status -OverallResult $overallResult -ReportPath $relativeReportPath

  Write-Host "Rollback drill report generated: $reportPath"
  Write-Host "Rollback drill history updated: $historyPath"

  if ($overallResult -ne "PASS") {
    exit 1
  }

  exit 0
} catch {
  Write-Host "Rollback drill execution failed."
  if ($Error.Count -gt 0) {
    Write-Host ($Error[0] | Out-String)
  } else {
    Write-Host "Unknown error."
  }
  exit 1
}
