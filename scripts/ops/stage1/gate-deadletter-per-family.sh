#!/usr/bin/env bash
# OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — gate probe E1/E2 (read-only).
#
# Runs the per-family terminal-state breakdown so an ISOLATED dead-letter
# is distinguishable from a CLUSTER. Per the roadmap budget rule: one
# isolated typed dead-letter is within tolerance; a per-family dead_letter
# count > 1 (especially in argument_scheme) is a HALT signal. Read-only
# SELECT only; no change to routing percentage, env, or any row.
#
# Auth: the linked db query authenticates via the project link, not a
# privileged client and not the operator account token. No operator secret
# is sourced or used here; operator secret NAMES are referenced by name
# only elsewhere, never a value.
set -uo pipefail
set +x

echo "=== Stage-1 gate E1/E2 — per-family terminal-state breakdown (read-only) ==="
npx supabase db query --linked --file scripts/ops-stage1-sql/03-deadletter-and-per-family.sql

echo ""
echo "RESULT: read-only check complete. A per-family dead_letter > 1 (cluster) is a HALT signal."
