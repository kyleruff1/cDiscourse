#!/usr/bin/env bash
# OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 one-row snapshot (read-only).
#
# Runs the single-row Stage-1 health snapshot (routed args, non-smoke routed
# args, H/I/J leakage, M1 drainer freshness, M2 non-terminal backlog) via a
# read-only project-linked db query. No privileged client; no operator account
# token is referenced; the linked db query authenticates via the project link.
# `set +x` keeps xtrace off so nothing is echoed beyond the explicit lines.
set -uo pipefail
set +x

echo "=== Stage-1 snapshot (routed / non-smoke / H-I-J / M1 / M2) ==="
npx supabase db query --linked --file scripts/ops-stage1-sql/stage1-snapshot.sql

echo ""
echo "RESULT: read-only snapshot complete (inspect output above)."
echo "NOTE: this script is read-only. It does NOT close the observation window"
echo "      and does NOT change the routing percentage."
