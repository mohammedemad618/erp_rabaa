param(
  [string]$TaskName = "TravelERP-HypercareDaily",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if ($DryRun) {
  Write-Host "DryRun mode. Task not removed."
  Write-Host "Task Name: $TaskName"
  exit 0
}

& schtasks.exe /Delete /TN $TaskName /F | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Unable to remove scheduled task. schtasks exited with code $LASTEXITCODE."
}

Write-Host "Scheduled task removed successfully."
Write-Host "Task Name: $TaskName"
