#!/usr/bin/env bash
# OPS-MCP-STAGE1-LOCAL-SECRETS-AUTOMATION — read-only cron + queue verification.
#
# Confirms both crons are active with the documented schedules and that the
# queue is inert. Uses ONLY read-only `supabase db query --linked` SELECTs.
# No operator secrets are sourced or used here (the linked db query
# authenticates via the project link, not the account PAT).
set -uo pipefail
set +x

echo "=== cron state (arch-001-classifier-drain-tick + cutover-health-monitor-tick) ==="
npx supabase db query --linked --file .claude-tmp/load-smoke-queries/phase2-cron-state.sql

echo ""
echo "=== drainer freshness (M1) ==="
npx supabase db query --linked --file .claude-tmp/load-smoke-queries/m1-drainer-freshness.sql

echo ""
echo "=== queue depth (M2) — expect non_terminal_rows = 0 ==="
npx supabase db query --linked --file .claude-tmp/load-smoke-queries/m2-queue-depth.sql

echo ""
echo "RESULT: read-only verification complete (inspect output above)"
