#!/usr/bin/env bash
# OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 window-close readiness (read-only).
#
# Runs the window-close READINESS report (arm time, window_close_at, seconds
# remaining, window_elapsed flag, non-smoke routed args) via a read-only
# project-linked db query. No privileged client; no operator account token is
# referenced; the linked db query authenticates via the project link.
# `set +x` keeps xtrace off.
set -uo pipefail
set +x

echo "=== Stage-1 window-close readiness (REPORT ONLY) ==="
npx supabase db query --linked --file scripts/ops-stage1-sql/stage1-window-close-readonly.sql

echo ""
echo "RESULT: read-only readiness report complete (inspect output above)."
echo "NOTE: this script is read-only. It does NOT close the observation window."
echo "      Closing the window, issuing any PASS verdict, and advancing the"
echo "      routing percentage above 1% are human decisions made AFTER the 24h"
echo "      window has elapsed. This script changes nothing."
