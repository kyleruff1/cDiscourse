#!/usr/bin/env bash
# OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — gate probe E8/E9 (read-only).
#
# Runs the drainer-freshness (M1) + queue-depth (M2) probe TOGETHER and
# prints a plain-language drainer_reading: 'idle_empty' (M2=0, stale M1 is
# fine), 'fresh_working' (M2>0 and M1<120s), or 'STUCK' (M2>0 and M1>=120s,
# the only E8 failure). Read-only SELECT only; no change to routing
# percentage, env, or any row.
#
# Auth: the linked db query authenticates via the project link, not a
# privileged client and not the operator account token. No operator secret
# is sourced or used here; operator secret NAMES are referenced by name
# only elsewhere, never a value.
set -uo pipefail
set +x

echo "=== Stage-1 gate E8/E9 — drainer freshness (M1) + queue depth (M2) (read-only) ==="
npx supabase db query --linked --file scripts/ops-stage1-sql/05-drainer-freshness-and-depth.sql

echo ""
echo "RESULT: read-only check complete. 'idle_empty' is healthy; only 'STUCK' (M2>0 and M1>=120s) fails E8."
