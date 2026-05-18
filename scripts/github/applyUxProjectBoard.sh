#!/usr/bin/env bash
# applyUxProjectBoard.sh
#
# Operator-runnable script that creates the missing QOL-NNN roadmap issues
# in `scripts/github/uxBoardCards.json`, adds each to the existing CDiscourse
# UX/UI Roadmap GitHub Project (#1 by default), and sets Status/Priority/
# Effort/Epic/Release/Phase from the catalogue.
#
# Project #1 fields, options, and existing issues #1-37 are assumed to be
# already in place (they were set up in an earlier session).
#
# Prerequisites:
#   1. Install gh from https://cli.github.com/
#   2. gh auth login
#   3. gh auth refresh -s project
#   4. cd into this repo
#
# Defaults (override with environment variables):
#   OWNER          - GitHub owner login (default: kyleruff1)
#   PROJECT_NUMBER - Project v2 number (default: 1)
#   REPO           - <owner>/<repo> (default: from `gh repo view`)
#
# Safety:
#   - Never prints tokens.
#   - Never deletes anything.
#   - Skips creating any issue whose prefix already appears in a repo issue.
#   - All issue bodies come from scripts/github/uxBoardCards.json (no
#     shell-injected text).
#   - All field IDs and option IDs are read live from `gh project field-list`
#     so the script does not embed stale schema identifiers.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CARDS_JSON="${REPO_ROOT}/scripts/github/uxBoardCards.json"

OWNER="${OWNER:-kyleruff1}"
PROJECT_NUMBER="${PROJECT_NUMBER:-1}"

if ! command -v gh >/dev/null 2>&1; then
  echo "[apply-ux-board] gh CLI not installed. See https://cli.github.com/" >&2
  exit 3
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "[apply-ux-board] gh not authenticated. Run: gh auth login" >&2
  exit 3
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "[apply-ux-board] jq is required to parse the catalogue." >&2
  exit 3
fi

REPO="${REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
echo "[apply-ux-board] owner=${OWNER}  project=#${PROJECT_NUMBER}  repo=${REPO}"

# ── 1. Ensure the 3 new labels exist ─────────────────────────────────
echo "[apply-ux-board] ensuring labels..."
jq -r '.labels[]? | "\(.name)\t\(.color)\t\(.description)"' "$CARDS_JSON" |
while IFS=$'\t' read -r name color description; do
  if gh label list --repo "$REPO" --limit 200 --json name --jq '.[].name' | grep -Fxq "$name"; then
    echo "  exists: $name"
  else
    gh label create "$name" --repo "$REPO" --color "$color" --description "$description"
    echo "  created: $name"
  fi
done

# ── 2. Resolve project + field IDs from live schema ──────────────────
PROJECT_ID="$(gh project list --owner "$OWNER" --limit 50 --format json |
  jq -r --argjson n "$PROJECT_NUMBER" '.projects[]? | select(.number==$n) | .id')"
if [[ -z "${PROJECT_ID:-}" ]]; then
  echo "[apply-ux-board] project #${PROJECT_NUMBER} not found for ${OWNER}" >&2
  exit 4
fi
FIELDS_JSON="$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --limit 50 --format json)"

field_id() { echo "$FIELDS_JSON" | jq -r --arg n "$1" '.fields[] | select(.name==$n) | .id'; }
opt_id()   { echo "$FIELDS_JSON" | jq -r --arg n "$1" --arg o "$2" '.fields[] | select(.name==$n) | .options[]? | select(.name==$o) | .id'; }

STATUS_ID="$(field_id Status)";   PRIORITY_ID="$(field_id Priority)"
EFFORT_ID="$(field_id Effort)";   EPIC_ID="$(field_id Epic)"
RELEASE_ID="$(field_id Release)"; PHASE_ID="$(field_id Phase)"

# ── 3. Create + wire each card ───────────────────────────────────────
echo "[apply-ux-board] creating roadmap issues..."
CARD_COUNT="$(jq '.cards | length' "$CARDS_JSON")"
for ((i=0; i<CARD_COUNT; i++)); do
  prefix="$(jq -r ".cards[$i].prefix" "$CARDS_JSON")"
  title="$(jq -r ".cards[$i].title" "$CARDS_JSON")"
  labels="$(jq -r ".cards[$i].labels | join(\",\")" "$CARDS_JSON")"
  body="$(jq -r ".cards[$i].body | join(\"\n\")" "$CARDS_JSON")"
  priority="$(jq -r ".cards[$i].priority" "$CARDS_JSON")"
  effort="$(jq -r ".cards[$i].effort" "$CARDS_JSON")"
  epic="$(jq -r ".cards[$i].epic" "$CARDS_JSON")"
  release="$(jq -r ".cards[$i].release" "$CARDS_JSON")"
  phase="$(jq -r ".cards[$i].phase" "$CARDS_JSON")"

  # Dedupe by prefix in issue title.
  EXISTING="$(gh issue list --repo "$REPO" --state all --search "$prefix in:title" --json number,title |
    jq -r '.[] | select(.title | startswith("'"$prefix"'")) | .number' | head -1 || true)"
  if [[ -n "${EXISTING:-}" ]]; then
    echo "  exists #${EXISTING}: $prefix -- skipping creation"
    continue
  fi

  echo "  creating: $title"
  ISSUE_URL="$(gh issue create --repo "$REPO" --title "$title" --body "$body" --label "$labels" | tail -1)"
  ITEM_JSON="$(gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$ISSUE_URL" --format json)"
  ITEM_ID="$(echo "$ITEM_JSON" | jq -r '.id')"
  echo "    added to project: item=$ITEM_ID"

  set_field() {
    local fname="$1" fid="$2" oname="$3"
    local oid; oid="$(opt_id "$fname" "$oname")"
    if [[ -z "$oid" ]]; then echo "    skip $fname=$oname (option not found)"; return; fi
    gh project item-edit --id "$ITEM_ID" --project-id "$PROJECT_ID" \
      --field-id "$fid" --single-select-option-id "$oid" >/dev/null
    echo "    $fname=$oname"
  }
  set_field Status   "$STATUS_ID"   Todo
  set_field Priority "$PRIORITY_ID" "$priority"
  set_field Effort   "$EFFORT_ID"   "$effort"
  set_field Epic     "$EPIC_ID"     "$epic"
  set_field Release  "$RELEASE_ID"  "$release"
  set_field Phase    "$PHASE_ID"    "$phase"
done

echo "[apply-ux-board] done. Review: https://github.com/users/${OWNER}/projects/${PROJECT_NUMBER}"
