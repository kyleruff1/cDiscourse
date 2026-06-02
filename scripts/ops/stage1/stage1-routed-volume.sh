#!/usr/bin/env bash
# OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 routed volume (read-only).
#
# Runs the routed-volume split (total / non-smoke / smoke distinct routed args
# since the 1% arm) via a read-only project-linked db query. No privileged
# client; no operator account token is referenced; the linked db query
# authenticates via the project link. `set +x` keeps xtrace off.
set -uo pipefail
set +x

echo "=== Stage-1 routed volume (total vs non-smoke vs smoke) ==="
npx supabase db query --linked --file scripts/ops-stage1-sql/stage1-routed-volume.sql

echo ""
echo "RESULT: read-only volume report complete (inspect output above)."
echo "NOTE: this script is read-only. It does NOT close the observation window"
echo "      and does NOT change the routing percentage."
