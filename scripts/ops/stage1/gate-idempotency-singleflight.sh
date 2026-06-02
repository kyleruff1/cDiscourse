#!/usr/bin/env bash
# OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — gate probe E3/E4 (read-only).
#
# Runs the idempotency + single-flight check: duplicate_success_cells
# (expected 0 — the one-success-per-cell partial unique index forbids it)
# and overlapping_drain_pairs (expected 0 — the single-flight TTL lease
# forbids two concurrent drains). Either value > 0 is a HALT signal.
# Read-only SELECT only; no change to routing percentage, env, or any row.
#
# Auth: the linked db query authenticates via the project link, not a
# privileged client and not the operator account token. No operator secret
# is sourced or used here; operator secret NAMES are referenced by name
# only elsewhere, never a value.
set -uo pipefail
set +x

echo "=== Stage-1 gate E3/E4 — idempotency + single-flight (read-only) ==="
npx supabase db query --linked --file scripts/ops-stage1-sql/04-idempotency-and-singleflight.sql

echo ""
echo "RESULT: read-only check complete. Expect duplicate_success_cells=0 and overlapping_drain_pairs=0."
