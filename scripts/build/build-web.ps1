# HOST-001 — PowerShell wrapper for the Expo Web build.
#
# Usage:
#   ./scripts/build/build-web.ps1                  # real build
#   ./scripts/build/build-web.ps1 -DryRun          # plan only
#   ./scripts/build/build-web.ps1 -OutputDir custom-dist
#
# Doctrine:
#   - Does NOT read .env* files.
#   - Does NOT call Anthropic / xAI / X / Supabase / Resend.
#   - Does NOT deploy. Only produces ./<OutputDir>.
#   - Refuses if OutputDir resolves outside the repo root.

[CmdletBinding()]
param(
  [switch] $DryRun,
  [string] $OutputDir = 'dist'
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir '..\..')).Path

$resolvedOut = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $OutputDir))
if (-not $resolvedOut.StartsWith($RepoRoot)) {
  Write-Error "refused: OutputDir resolves outside repo root: $resolvedOut"
  exit 2
}

Write-Output "[build-web] repo root: $RepoRoot"
Write-Output "[build-web] output dir: $resolvedOut"
Write-Output ("[build-web] mode: " + (& { if ($DryRun) { 'dry-run (plan only)' } else { 'apply' } }))

if ($DryRun) {
  Write-Output "[build-web] would run: npx expo export --platform web --output-dir $OutputDir"
  Write-Output "[build-web] dry-run complete. No build executed."
  exit 0
}

if (-not (Test-Path $resolvedOut)) {
  New-Item -ItemType Directory -Force -Path $resolvedOut | Out-Null
}

Push-Location $RepoRoot
try {
  & npx expo export --platform web --output-dir $OutputDir
  $exit = $LASTEXITCODE
}
finally {
  Pop-Location
}

if ($exit -ne 0) {
  Write-Error "[build-web] expo export exited with status $exit"
  exit $exit
}

$files = Get-ChildItem -Recurse -File $resolvedOut
$count = $files.Count
$bytes = ($files | Measure-Object -Property Length -Sum).Sum
if ($null -eq $bytes) { $bytes = 0 }
$human = if ($bytes -lt 1024) { "$bytes B" } elseif ($bytes -lt 1MB) { "{0:N1} KiB" -f ($bytes / 1KB) } else { "{0:N2} MiB" -f ($bytes / 1MB) }
Write-Output "[build-web] dist summary: $count files, $human"

if ($count -eq 0) {
  Write-Error "[build-web] refused: dist is empty after build."
  exit 3
}
exit 0
