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

function Get-IsoWeekNumber {
  param([datetime]$DateUtc)

  $daysOffset = 3 - (([int]$DateUtc.DayOfWeek + 6) % 7)
  $thursday = $DateUtc.Date.AddDays($daysOffset)
  $firstThursday = (Get-Date -Year $thursday.Year -Month 1 -Day 4).ToUniversalTime()
  $firstWeekStart = $firstThursday.Date.AddDays(-(([int]$firstThursday.DayOfWeek + 6) % 7))
  return [int](($thursday - $firstWeekStart).TotalDays / 7) + 1
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

function Parse-GoNoGoReport {
  param([string]$ReportPath)

  $lines = Get-Content -Path $ReportPath
  $decision = "UNKNOWN"
  $criteria = New-Object 'System.Collections.Generic.List[object]'

  foreach ($line in $lines) {
    if ($line -match "^- Decision:\s+\*\*(.+)\*\*") {
      $decision = $Matches[1].Trim()
      continue
    }

    if (-not $line.StartsWith("|")) {
      continue
    }

    $cells = $line.Trim().Trim("|").Split("|")
    if ($cells.Count -ne 4) {
      continue
    }

    $criterion = $cells[0].Trim()
    $actual = $cells[1].Trim()
    $threshold = $cells[2].Trim()
    $status = $cells[3].Trim()

    if ($criterion -eq "Criterion" -or $criterion -eq "---") {
      continue
    }

    if ($status -notin @("PASS", "FAIL", "SKIPPED")) {
      continue
    }

    $criteria.Add([pscustomobject]@{
        Criterion = $criterion
        Actual = $actual
        Threshold = $threshold
        Status = $status
      }) | Out-Null
  }

  return [pscustomobject]@{
    Decision = $decision
    Criteria = $criteria.ToArray()
  }
}

function Ensure-HistoryFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    @(
      "# Travel ERP Release Readiness History"
      ""
      "| Timestamp (UTC) | Go/No-Go Decision | Release Readiness | Weekly Summary | Go/No-Go Report |"
      "|---|---|---|---|---|"
    ) | Set-Content -Path $Path -Encoding UTF8
  }
}

function Append-HistoryRow {
  param(
    [string]$Path,
    [string]$Decision,
    [string]$Readiness,
    [string]$WeeklySummaryPath,
    [string]$GoNoGoReportPath
  )

  $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  Add-Content -Path $Path -Encoding UTF8 -Value "| $timestamp | $Decision | $Readiness | $WeeklySummaryPath | $GoNoGoReportPath |"
}

$repoRoot = Resolve-RepoRoot
$resolvedOutDir = if ([System.IO.Path]::IsPathRooted($OutDir)) {
  $OutDir
} else {
  Join-Path $repoRoot $OutDir
}
Ensure-Directory -Path $resolvedOutDir

$nowUtc = (Get-Date).ToUniversalTime()
$reportDate = $nowUtc.ToString("yyyy-MM-dd")
$weekNumber = Get-IsoWeekNumber -DateUtc $nowUtc
$weekLabel = "{0}-W{1}" -f $nowUtc.ToString("yyyy"), $weekNumber.ToString("00")

$weeklySummaryScriptPath = Join-Path $repoRoot "scripts/pilot/weekly-executive-summary.ps1"
$goNoGoScriptPath = Join-Path $repoRoot "scripts/pilot/go-no-go-decision.ps1"

try {
  Write-Host "Release readiness orchestration started."

  $weeklySummaryExitCode = Invoke-ScriptFile -ScriptPath $weeklySummaryScriptPath -Arguments @(
    "-BaseUrl", $BaseUrl,
    "-Email", $Email,
    "-Password", $Password,
    "-OutDir", $resolvedOutDir
  )
  if ($weeklySummaryExitCode -ne 0) {
    throw "Weekly executive summary failed with exit code $weeklySummaryExitCode."
  }

  $goNoGoArguments = @(
    "-BaseUrl", $BaseUrl,
    "-Email", $Email,
    "-Password", $Password,
    "-OutDir", $resolvedOutDir,
    "-MinComplianceRate", [string]$MinComplianceRate,
    "-MaxBlockedPolicyRate", [string]$MaxBlockedPolicyRate,
    "-MaxBookedBlockedClosure", [string]$MaxBookedBlockedClosure,
    "-OpenSev1", [string]$OpenSev1,
    "-OpenSev2", [string]$OpenSev2
  )

  if ($RunQualityGates) {
    $goNoGoArguments += "-RunQualityGates"
  }
  if ($RunPerformanceGate) {
    $goNoGoArguments += "-RunPerformanceGate"
  }
  if ($RunSecurityGate) {
    $goNoGoArguments += "-RunSecurityGate"
  }
  if ($SkipSmoke) {
    $goNoGoArguments += "-SkipSmoke"
  }

  $goNoGoExitCode = Invoke-ScriptFile -ScriptPath $goNoGoScriptPath -Arguments $goNoGoArguments
  if ($goNoGoExitCode -ne 0) {
    throw "Go/No-Go generation failed with exit code $goNoGoExitCode."
  }

  $weeklySummaryPath = Join-Path $resolvedOutDir "weekly-executive-summary-$weekLabel.md"
  $goNoGoReportPath = Join-Path $resolvedOutDir "go-no-go-decision-$weekLabel.md"
  $goNoGoHistoryPath = Join-Path $resolvedOutDir "go-no-go-history.md"

  if (-not (Test-Path $weeklySummaryPath)) {
    throw "Weekly summary report not found at $weeklySummaryPath."
  }
  if (-not (Test-Path $goNoGoReportPath)) {
    throw "Go/No-Go report not found at $goNoGoReportPath."
  }
  if (-not (Test-Path $goNoGoHistoryPath)) {
    throw "Go/No-Go history not found at $goNoGoHistoryPath."
  }

  $goNoGoReport = Parse-GoNoGoReport -ReportPath $goNoGoReportPath
  $decision = [string]$goNoGoReport.Decision
  $criteria = if ($null -eq $goNoGoReport.Criteria) { @() } else { [object[]]$goNoGoReport.Criteria }
  $failedCriteria = @($criteria | Where-Object { $_.Status -eq "FAIL" })
  $skippedCriteria = @($criteria | Where-Object { $_.Status -eq "SKIPPED" })

  $readiness = switch ($decision) {
    "GO" { "READY" }
    "CONDITIONAL-GO" { "READY-WITH-RISKS" }
    default { "NOT-READY" }
  }

  $relativeWeeklySummary = Convert-ToRepoRelativePath -RepoRoot $repoRoot -Path $weeklySummaryPath
  $relativeGoNoGoReport = Convert-ToRepoRelativePath -RepoRoot $repoRoot -Path $goNoGoReportPath
  $relativeGoNoGoHistory = Convert-ToRepoRelativePath -RepoRoot $repoRoot -Path $goNoGoHistoryPath

  $releaseReadinessPath = Join-Path $resolvedOutDir "release-readiness-$reportDate.md"
  $relativeReleaseReadinessPath = Convert-ToRepoRelativePath -RepoRoot $repoRoot -Path $releaseReadinessPath
  $generatedAtText = $nowUtc.ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  $weekStart = $nowUtc.Date.AddDays(-(([int]$nowUtc.DayOfWeek + 6) % 7))
  $weekEnd = $weekStart.AddDays(6)

  $lines = New-Object 'System.Collections.Generic.List[string]'
  $lines.Add("# Travel ERP Release Readiness Report") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("- Generated at: $generatedAtText") | Out-Null
  $lines.Add("- Environment: $BaseUrl") | Out-Null
  $lines.Add("- Week: $weekLabel ($($weekStart.ToString("yyyy-MM-dd")) to $($weekEnd.ToString("yyyy-MM-dd")))") | Out-Null
  $lines.Add("- Go/No-Go decision: **$decision**") | Out-Null
  $lines.Add("- Release readiness status: **$readiness**") | Out-Null
  $lines.Add("") | Out-Null

  $lines.Add("## Evidence Artifacts") | Out-Null
  $lines.Add("| Artifact | Path |") | Out-Null
  $lines.Add("|---|---|") | Out-Null
  $lines.Add("| Weekly executive summary | $relativeWeeklySummary |") | Out-Null
  $lines.Add("| Go/No-Go decision report | $relativeGoNoGoReport |") | Out-Null
  $lines.Add("| Go/No-Go history | $relativeGoNoGoHistory |") | Out-Null
  $lines.Add("| Release readiness report | $relativeReleaseReadinessPath |") | Out-Null
  $lines.Add("") | Out-Null

  $lines.Add("## Automated Gate Results") | Out-Null
  if ($criteria.Count -eq 0) {
    $lines.Add("- No automated criteria were parsed from the Go/No-Go report.") | Out-Null
  } else {
    $lines.Add("| Criterion | Actual | Threshold | Status |") | Out-Null
    $lines.Add("|---|---|---|---|") | Out-Null
    foreach ($criterion in $criteria) {
      $lines.Add("| $($criterion.Criterion) | $($criterion.Actual) | $($criterion.Threshold) | $($criterion.Status) |") | Out-Null
    }
  }
  $lines.Add("") | Out-Null

  $lines.Add("## Risk Notes") | Out-Null
  if ($failedCriteria.Count -eq 0 -and $skippedCriteria.Count -eq 0) {
    $lines.Add("- No automated blockers detected.") | Out-Null
  } else {
    foreach ($criterion in $failedCriteria) {
      $lines.Add("- [FAIL] $($criterion.Criterion): actual=$($criterion.Actual), threshold=$($criterion.Threshold).") | Out-Null
    }
    foreach ($criterion in $skippedCriteria) {
      $lines.Add("- [SKIPPED] $($criterion.Criterion): actual=$($criterion.Actual), threshold=$($criterion.Threshold).") | Out-Null
    }
  }
  $lines.Add("") | Out-Null

  $lines.Add("## Manual Go-Live Checklist (Sign-Off)") | Out-Null
  $lines.Add("- [ ] Runbook approved") | Out-Null
  $lines.Add("- [ ] Escalation matrix approved and distributed") | Out-Null
  $lines.Add("- [ ] On-call rota confirmed for launch week") | Out-Null
  $lines.Add("- [ ] Rollback drill validated") | Out-Null
  $lines.Add("- [ ] Training completion evidence attached") | Out-Null
  $lines.Add("- [ ] Product owner sign-off") | Out-Null
  $lines.Add("- [ ] Operations lead sign-off") | Out-Null
  $lines.Add("- [ ] Finance lead sign-off") | Out-Null
  $lines.Add("- [ ] Security owner sign-off (if applicable)") | Out-Null

  Set-Content -Path $releaseReadinessPath -Value ($lines -join [Environment]::NewLine) -Encoding UTF8

  $historyPath = Join-Path $resolvedOutDir "release-readiness-history.md"
  Ensure-HistoryFile -Path $historyPath
  Append-HistoryRow -Path $historyPath -Decision $decision -Readiness $readiness -WeeklySummaryPath $relativeWeeklySummary -GoNoGoReportPath $relativeGoNoGoReport

  Write-Host "Release readiness report generated: $releaseReadinessPath"
  Write-Host "Release readiness history updated: $historyPath"
  Write-Host "Release readiness status: $readiness"
  exit 0
} catch {
  Write-Host "Release readiness orchestration failed."
  if ($Error.Count -gt 0) {
    Write-Host ($Error[0] | Out-String)
  } else {
    Write-Host "Unknown error."
  }
  exit 1
}
