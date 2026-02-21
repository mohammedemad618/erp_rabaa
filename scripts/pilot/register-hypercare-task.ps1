param(
  [string]$TaskName = "TravelERP-HypercareDaily",
  [string]$Time = "08:30",
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Email = "admin@enterprise.local",
  [string]$Password = "Admin@12345",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
  $resolvedScriptDir = Split-Path -Parent $PSCommandPath
  return (Resolve-Path (Join-Path $resolvedScriptDir "..\..")).Path
}

if (-not $Time -or $Time -notmatch "^\d{2}:\d{2}$") {
  throw "Time must be in HH:mm format (example: 08:30)."
}

$repoRoot = Resolve-RepoRoot
$hypercareScriptPath = Join-Path $repoRoot "scripts/pilot/hypercare-daily.ps1"

if (-not (Test-Path $hypercareScriptPath)) {
  throw "Hypercare script not found at $hypercareScriptPath"
}

$taskCommand = "powershell.exe -ExecutionPolicy Bypass -File `"$hypercareScriptPath`" -BaseUrl `"$BaseUrl`" -Email `"$Email`" -Password `"$Password`""

if ($DryRun) {
  Write-Host "DryRun mode. Task not registered."
  Write-Host "Task Name: $TaskName"
  Write-Host "Schedule: Daily at $Time"
  Write-Host "Command: $taskCommand"
  exit 0
}

& schtasks.exe /Create /TN $TaskName /TR $taskCommand /SC DAILY /ST $Time /F | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Unable to register scheduled task. schtasks exited with code $LASTEXITCODE."
}

Write-Host "Scheduled task registered successfully."
Write-Host "Task Name: $TaskName"
Write-Host "Schedule: Daily at $Time"
