#!/usr/bin/env bash
# HOST-005 - POSIX wrapper for preflight-secrets.mjs.
#
# Forwards every arg to the .mjs Node entrypoint.
#
# Exit codes (forwarded from the .mjs):
#   0 ok | 2 manifest error | 3 gcloud missing | 4 project mismatch | 5 no enabled version |
#   6 secret missing | 7 gcloud subprocess non-zero

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENTRYPOINT="$REPO_ROOT/scripts/deploy/preflight-secrets.mjs"

exec node "$ENTRYPOINT" "$@"
