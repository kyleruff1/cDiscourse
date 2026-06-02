#!/usr/bin/env bash
# OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — gate probe E5/E6 (read-only).
#
# Runs the routing-liveness + isolation-leakage probe: per recent routed
# arg, counts routing rows (family not null), legacy rows (family null —
# must be 0), and gated-family H/I/J rows (must be 0). Read-only SELECT
# only; makes no change to routing percentage, env, or any row.
#
# Auth: the linked db query authenticates via the project link, not a
# privileged client and not the operator account token. No operator secret
# is sourced or used here; operator secret NAMES are referenced by name
# only elsewhere, never a value.
set -uo pipefail
set +x

echo "=== Stage-1 gate E5/E6 — routing liveness + leakage (read-only) ==="
npx supabase db query --linked --file scripts/ops-stage1-sql/01-routing-liveness-and-leakage.sql

echo ""
echo "RESULT: read-only check complete. Expect legacy_rows=0 and hij_rows=0 on every routed arg."
