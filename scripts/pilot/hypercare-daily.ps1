param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Email = "admin@enterprise.local",
  [string]$Password = "Admin@12345",
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

function Ensure-ExecutionLog {
  param([string]$LogPath)

  if (-not (Test-Path $LogPath)) {
    @(
      "# Travel ERP Hypercare Execution Log"
      ""
      "| Timestamp (UTC) | Status | Detail |"
      "|---|---|---|"
    ) | Set-Content -Path $LogPath -Encoding UTF8
  }
}

function Append-ExecutionLog {
  param(
    [string]$LogPath,
    [string]$Status,
    [string]$Detail
  )

  $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
  Add-Content -Path $LogPath -Encoding UTF8 -Value "| $timestamp | $Status | $Detail |"
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

$repoRoot = Resolve-RepoRoot
$resolvedOutDir = if ([System.IO.Path]::IsPathRooted($OutDir)) {
  $OutDir
} else {
  Join-Path $repoRoot $OutDir
}

Ensure-Directory -Path $resolvedOutDir

$executionLogPath = Join-Path $resolvedOutDir "hypercare-execution-log.md"
Ensure-ExecutionLog -LogPath $executionLogPath

$smokeScriptPath = Join-Path $repoRoot "scripts/pilot/smoke-check.ps1"
$dailyReportScriptPath = Join-Path $repoRoot "scripts/pilot/daily-health-report.ps1"

try {
  Write-Host "Hypercare daily run started."

  $smokeExitCode = Invoke-ScriptFile -ScriptPath $smokeScriptPath -Arguments @{
    BaseUrl = $BaseUrl
    Email = $Email
    Password = $Password
  }
  if ($smokeExitCode -ne 0) {
    throw "Smoke check failed with exit code $smokeExitCode."
  }

  $reportExitCode = Invoke-ScriptFile -ScriptPath $dailyReportScriptPath -Arguments @{
    BaseUrl = $BaseUrl
    Email = $Email
    Password = $Password
    OutDir = $resolvedOutDir
  }
  if ($reportExitCode -ne 0) {
    throw "Daily health report failed with exit code $reportExitCode."
  }

  $reportDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
  $reportRelativePath = "docs/operations/reports/daily-health-report-$reportDate.md"
  Append-ExecutionLog -LogPath $executionLogPath -Status "SUCCESS" -Detail "Smoke + report completed ($reportRelativePath)."
  Write-Host "Hypercare daily run completed successfully."
  exit 0
} catch {
  $message = if ($null -ne $_ -and $null -ne $_.Exception) { $_.Exception.Message } else { "Unknown failure." }
  Append-ExecutionLog -LogPath $executionLogPath -Status "FAILED" -Detail $message
  Write-Host "Hypercare daily run failed."
  Write-Host $message
  exit 1
}
