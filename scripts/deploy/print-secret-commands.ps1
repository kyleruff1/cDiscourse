# HOST-005 - PowerShell wrapper for print-secret-commands.mjs.
#
# This wrapper does no logic of its own. It forwards every arg to the .mjs
# Node entrypoint. The agent never runs gcloud; this helper only prints
# operator-runnable command shapes to stdout.
#
# Usage:
#   .\scripts\deploy\print-secret-commands.ps1 --manifest=infra/secrets/cdiscourse-dev-manifest.json
#
# Forbidden inputs (refused by the .mjs):
#   - Any --value flag
#   - Any --data-file flag
#   - Reading .env* files
#
# All exit codes are forwarded from the .mjs:
#   0 ok | 2 manifest error | 3 forbidden name | 4 value-shape literal | 5 missing flag

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir '..\..')
$Entrypoint = Join-Path $RepoRoot 'scripts\deploy\print-secret-commands.mjs'

& node $Entrypoint @args
exit $LASTEXITCODE
