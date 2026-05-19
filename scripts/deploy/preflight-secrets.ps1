# HOST-005 - PowerShell wrapper for preflight-secrets.mjs.
#
# Forwards every arg to the .mjs Node entrypoint. The .mjs invokes the local
# `gcloud` binary to verify that the manifest's named secrets exist and have
# at least one ENABLED version. It NEVER calls `gcloud secrets versions access`
# (which would read a value).
#
# Usage:
#   .\scripts\deploy\preflight-secrets.ps1 --manifest=infra/secrets/cdiscourse-dev-manifest.json --strict-project
#
# Exit codes (forwarded from the .mjs):
#   0 ok | 2 manifest error | 3 gcloud missing | 4 project mismatch | 5 no enabled version |
#   6 secret missing | 7 gcloud subprocess non-zero

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir '..\..')
$Entrypoint = Join-Path $RepoRoot 'scripts\deploy\preflight-secrets.mjs'

& node $Entrypoint @args
exit $LASTEXITCODE
