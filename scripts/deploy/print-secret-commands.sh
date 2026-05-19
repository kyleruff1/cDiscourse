#!/usr/bin/env bash
# HOST-005 - POSIX wrapper for print-secret-commands.mjs.
#
# This wrapper does no logic of its own. It forwards every arg to the .mjs
# Node entrypoint. The agent never runs gcloud; this helper only prints
# operator-runnable command shapes to stdout.
#
# Usage:
#   ./scripts/deploy/print-secret-commands.sh --manifest=infra/secrets/cdiscourse-dev-manifest.json
#
# Exit codes (forwarded from the .mjs):
#   0 ok | 2 manifest error | 3 forbidden name | 4 value-shape literal | 5 missing flag

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENTRYPOINT="$REPO_ROOT/scripts/deploy/print-secret-commands.mjs"

exec node "$ENTRYPOINT" "$@"
