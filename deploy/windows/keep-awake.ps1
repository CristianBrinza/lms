# ─────────────────────────────────────────────────────────────────────────────
# Keeps the LMS server PC working around the clock. Run once in an elevated PowerShell:
#   powershell -ExecutionPolicy Bypass -File deploy\windows\keep-awake.ps1
#
# - never sleeps or hibernates on mains power (the screen may still turn off)
# - checks that Docker Desktop starts when you sign in and uses WSL 2
# - reminds you to turn on automatic sign-in, so a reboot (Windows Update) brings everything back
# ─────────────────────────────────────────────────────────────────────────────
$ErrorActionPreference = 'Stop'

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Run this in PowerShell as Administrator.' -ForegroundColor Red
  exit 1
}

Write-Host 'Power: never sleep or hibernate on mains power'
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /hibernate off

$settings = Join-Path $env:APPDATA 'Docker\settings-store.json'
if (-not (Test-Path $settings)) { $settings = Join-Path $env:APPDATA 'Docker\settings.json' }
if (Test-Path $settings) {
  $json = Get-Content $settings -Raw | ConvertFrom-Json
  $json | Add-Member -NotePropertyName 'AutoStart' -NotePropertyValue $true -Force
  $json | Add-Member -NotePropertyName 'OpenUIOnStartupDisabled' -NotePropertyValue $true -Force
  $json | ConvertTo-Json -Depth 20 | Set-Content $settings -Encoding UTF8
  Write-Host 'Docker Desktop: starts when you sign in (restart Docker Desktop to apply)'
} else {
  Write-Host 'Docker Desktop settings not found: install Docker Desktop, then run this again.' -ForegroundColor Yellow
}

$wsl = wsl --status 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host 'WSL is not installed: wsl --install -d Ubuntu' -ForegroundColor Yellow }

Write-Host ''
Write-Host 'Last step, by hand: automatic sign-in after a restart.' -ForegroundColor Cyan
Write-Host '  Win+R → netplwiz → untick "Users must enter a user name and password" (or Settings → Accounts → Sign-in options).'
Write-Host '  Then a Windows Update restart signs in, Docker Desktop starts, and the containers come back by themselves.'
