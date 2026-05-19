# HOST-001 — PowerShell wrapper around inject-runtime-env.mjs.
#
# Usage:
#   ./scripts/build/inject-runtime-env.ps1
#   ./scripts/build/inject-runtime-env.ps1 -DryRun
#   ./scripts/build/inject-runtime-env.ps1 -Url 'https://x.supabase.co' -PublishableKey 'sb_publishable_...'
#
# Pulls values from env or from explicit parameters; never reads .env files.
# Delegates to the cross-platform Node entrypoint so the validation logic stays
# in one place.

[CmdletBinding()]
param(
  [string] $Url,
  [string] $PublishableKey,
  [string] $AppOrigin,
  [string] $DistDir = 'dist',
  [switch] $DryRun
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir '..\..')).Path
$NodeEntry = Join-Path $ScriptDir 'inject-runtime-env.mjs'

$nodeArgs = @($NodeEntry, "--dist-dir=$DistDir")
if ($DryRun) { $nodeArgs += '--dry' }
if ($PSBoundParameters.ContainsKey('Url') -and -not [string]::IsNullOrEmpty($Url)) {
  $nodeArgs += "--url=$Url"
}
if ($PSBoundParameters.ContainsKey('PublishableKey') -and -not [string]::IsNullOrEmpty($PublishableKey)) {
  $nodeArgs += "--publishable-key=$PublishableKey"
}
if ($PSBoundParameters.ContainsKey('AppOrigin') -and -not [string]::IsNullOrEmpty($AppOrigin)) {
  $nodeArgs += "--app-origin=$AppOrigin"
}

Push-Location $RepoRoot
try {
  & node @nodeArgs
  $exit = $LASTEXITCODE
}
finally {
  Pop-Location
}

exit $exit
