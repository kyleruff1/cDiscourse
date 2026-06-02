#!/usr/bin/env bash
# OPS-MCP-STAGE1-LOCAL-SECRETS-AUTOMATION — disarm Stage 1 (rollback to inert).
#
# Sets the Supabase Edge Function env vars back to safe defaults:
#   CLASSIFIER_QUEUE_ROUTING_ENABLED=false
#   CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0
# via `supabase secrets set`, authenticated with the operator's
# SUPABASE_ACCESS_TOKEN sourced from the gitignored
# .claude-tmp/operator-secrets.env. Prints UTC_DISARMED_TIMESTAMP.
#
# Use this IMMEDIATELY on any Stage 1 rollback trigger.
#
# SECURITY: `set +x` keeps xtrace off; the PAT is never echoed; the values
# being set (false / 0) are not secret.
set -uo pipefail
set +x

PROJECT_REF="qsciikhztvzzohssddrq"
SECRETS_FILE=".claude-tmp/operator-secrets.env"

if [ ! -f "$SECRETS_FILE" ]; then
  echo "ABORT: $SECRETS_FILE not found"
  exit 2
fi

# shellcheck disable=SC1090
set -a
. "$SECRETS_FILE"
set +a

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "ABORT: SUPABASE_ACCESS_TOKEN not set in $SECRETS_FILE"
  exit 3
fi

echo "Disarming: CLASSIFIER_QUEUE_ROUTING_ENABLED=false + CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0 ..."
SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" npx supabase secrets set \
  CLASSIFIER_QUEUE_ROUTING_ENABLED=false \
  CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0 \
  --project-ref "$PROJECT_REF"
set_rc=$?
echo "secrets set exit code: $set_rc"
if [ "$set_rc" -ne 0 ]; then
  echo "WARNING: supabase secrets set returned rc=$set_rc — VERIFY MANUALLY that routing is OFF."
  exit 4
fi

echo "UTC_DISARMED_TIMESTAMP: $(date -u +%FT%TZ)"
echo "RESULT: Stage 1 disarmed (routing OFF, percentage 0)."
