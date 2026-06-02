#!/usr/bin/env bash
# OPS-MCP-STAGE1-LOCAL-SECRETS-AUTOMATION — verify local operator secrets presence.
#
# Reads .claude-tmp/operator-secrets.env (gitignored; operator-prepared) and
# confirms the THREE required secret NAMES are present and non-empty.
#
# SECURITY: prints ONLY presence/absence per NAME. NEVER prints a secret VALUE.
# `set +x` keeps xtrace off so the sourcing line is never echoed.
set -uo pipefail
set +x

SECRETS_FILE=".claude-tmp/operator-secrets.env"

if [ ! -f "$SECRETS_FILE" ]; then
  echo "MISSING: $SECRETS_FILE not found"
  echo "RESULT: FAIL"
  exit 2
fi

# shellcheck disable=SC1090
set -a
. "$SECRETS_FILE"
set +a

missing=0
for name in SUPABASE_ACCESS_TOKEN MCP_SERVER_BEARER_TOKEN CUTOVER_MONITOR_SHARED_SECRET; do
  # Indirect expansion to test non-empty WITHOUT printing the value.
  val="${!name:-}"
  if [ -n "$val" ]; then
    echo "PRESENT: $name"
  else
    echo "MISSING: $name"
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "RESULT: FAIL — one or more required secrets missing"
  exit 3
fi

echo "RESULT: PASS — all 3 operator secrets present (values never printed)"
