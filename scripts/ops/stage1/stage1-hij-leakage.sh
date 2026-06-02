#!/usr/bin/env bash
# OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 H/I/J leakage check (read-only).
#
# Runs the non-production-family (claim_clarity/thread_topology/
# sensitive_composer) leakage count since the 1% arm via a read-only
# project-linked db query. Expected result: 0. No privileged client; no
# operator account token is referenced; the linked db query authenticates via
# the project link. `set +x` keeps xtrace off.
set -uo pipefail
set +x

echo "=== Stage-1 H/I/J leakage (expect 0) ==="
npx supabase db query --linked --file scripts/ops-stage1-sql/stage1-hij-leakage.sql

echo ""
echo "RESULT: read-only leakage check complete (inspect output above; expect 0)."
echo "NOTE: this script is read-only. It does NOT close the observation window"
echo "      and does NOT change the routing percentage."
