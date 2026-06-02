#!/usr/bin/env bash
# OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — gate probe E1 (read-only).
#
# Runs the organic-vs-smoke routed-arg split: shows whether any ORGANIC
# cells have routed (vs smoke-tagged ones that route regardless of
# percentage) and the terminal-state breakdown per bucket. Read-only
# SELECT only; no change to routing percentage, env, or any row.
#
# Auth: the linked db query authenticates via the project link, not a
# privileged client and not the operator account token. No operator secret
# is sourced or used here; operator secret NAMES are referenced by name
# only elsewhere, never a value.
set -uo pipefail
set +x

echo "=== Stage-1 gate E1 — organic vs smoke routed split (read-only) ==="
npx supabase db query --linked --file scripts/ops-stage1-sql/02-organic-vs-smoke-routed.sql

echo ""
echo "RESULT: read-only check complete. Inspect the 'organic' row for routed_args and terminal states."
