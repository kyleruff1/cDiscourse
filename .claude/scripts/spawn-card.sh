#!/usr/bin/env bash
#
# Prepare a CDiscourse roadmap card for agent work: move it to the right Phase
# on the GitHub Project and print a copy-paste-ready Agent tool invocation
# for the next agent in the pipeline.
#
# Usage:
#   ./spawn-card.sh TL-001                # default: move to Design phase
#   ./spawn-card.sh TL-001 Build          # move to Build phase
#   ./spawn-card.sh TL-001 Review
#   ./spawn-card.sh TL-001 Done
#   ./spawn-card.sh TL-001 Blocked "design defect"
#   ./spawn-card.sh TL-001 Backlog
#
# Requirements:
#   - gh CLI authenticated with project scope
#   - jq
#
# Same behavior as spawn-card.ps1.

set -euo pipefail

CODE="${1:-}"
PHASE="${2:-Design}"
REASON="${3:-}"

if [[ -z "$CODE" ]]; then
  cat >&2 <<'USAGE'
Usage: ./spawn-card.sh <code> [phase] [reason]
  code:   roadmap card code (e.g. TL-001, EV-002)
  phase:  Design (default) | Build | Review | Done | Blocked | Backlog
  reason: required if phase is Blocked
USAGE
  exit 1
fi

case "$PHASE" in
  Design|Build|Review|Done|Blocked|Backlog) ;;
  *) echo >&2 "Invalid phase: $PHASE"; exit 1 ;;
esac

# Resolve gh — PATH first, then a Windows winget fallback.
if command -v gh >/dev/null 2>&1; then
  GH=gh
elif [[ -x "/c/Users/$USER/AppData/Local/Microsoft/WinGet/Packages/GitHub.cli_Microsoft.Winget.Source_8wekyb3d8bbwe/bin/gh.exe" ]]; then
  GH="/c/Users/$USER/AppData/Local/Microsoft/WinGet/Packages/GitHub.cli_Microsoft.Winget.Source_8wekyb3d8bbwe/bin/gh.exe"
else
  echo >&2 "Error: gh CLI not found. Install: winget install GitHub.cli  (or brew install gh / apt install gh)"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo >&2 "Error: jq is required. Install: winget install jqlang.jq  (or brew install jq / apt install jq)"
  exit 1
fi

PROJECT_NUMBER=1
PROJECT_OWNER="@me"
PROJECT_ID="PVT_kwHOAvpEDc4BYA8w"

echo "Looking up issue for $CODE..."
ISSUE=$("$GH" issue list --search "$CODE in:title" --json number,title,url,body --limit 5 \
  | jq -c --arg code "$CODE" '[.[] | select(.title | startswith($code))] | .[0]')

if [[ "$ISSUE" == "null" || -z "$ISSUE" ]]; then
  echo >&2 "No issue found with title matching '$CODE'. Did you create the roadmap issues?"
  exit 1
fi

ISSUE_NUMBER=$(jq -r '.number' <<<"$ISSUE")
ISSUE_TITLE=$(jq -r '.title' <<<"$ISSUE")
ISSUE_URL=$(jq -r '.url' <<<"$ISSUE")
ISSUE_BODY=$(jq -r '.body' <<<"$ISSUE")

echo "  -> Issue #$ISSUE_NUMBER: $ISSUE_TITLE"
echo "  -> $ISSUE_URL"

# Find the Project item for this issue.
ITEM_ID=$("$GH" project item-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json --limit 200 \
  | jq -r --arg code "$CODE" '.items[] | select(.content.title | startswith($code)) | .id' \
  | head -n1)

if [[ -z "$ITEM_ID" ]]; then
  echo >&2 "Issue '$CODE' is not in Project $PROJECT_NUMBER. Add it manually first."
  exit 1
fi

# Look up Phase field + target option id.
FIELDS=$("$GH" project field-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json)
PHASE_FIELD_ID=$(jq -r '.fields[] | select(.name == "Phase") | .id' <<<"$FIELDS")
PHASE_OPTION_ID=$(jq -r --arg p "$PHASE" '.fields[] | select(.name == "Phase") | .options[] | select(.name == $p) | .id' <<<"$FIELDS")

if [[ -z "$PHASE_FIELD_ID" || "$PHASE_FIELD_ID" == "null" ]]; then
  echo >&2 "Project has no 'Phase' field. Re-run setup."
  exit 1
fi
if [[ -z "$PHASE_OPTION_ID" || "$PHASE_OPTION_ID" == "null" ]]; then
  echo >&2 "Phase '$PHASE' is not a valid option."
  exit 1
fi

echo "Setting Phase = $PHASE ..."
"$GH" project item-edit \
  --project-id "$PROJECT_ID" \
  --id "$ITEM_ID" \
  --field-id "$PHASE_FIELD_ID" \
  --single-select-option-id "$PHASE_OPTION_ID" >/dev/null
echo "  -> OK"

# Compute slug for the branch name.
SLUG=$(echo "$ISSUE_TITLE" \
  | sed -E "s/^${CODE}[[:space:]]*-[[:space:]]*//" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g' \
  | sed -E 's/^-+|-+$//g' \
  | cut -c1-40 \
  | sed -E 's/-+$//')
BRANCH="feat/$CODE-$SLUG"

# Save context for the agent to reference.
CTX_DIR="${TMPDIR:-/tmp}/cd-roadmap-context"
mkdir -p "$CTX_DIR"
CTX_FILE="$CTX_DIR/$CODE.md"
{
  echo "# $ISSUE_TITLE"
  echo
  echo "Issue: $ISSUE_URL"
  echo "Branch: $BRANCH"
  echo
  echo "---"
  echo
  echo "$ISSUE_BODY"
} > "$CTX_FILE"

echo "  Context saved: $CTX_FILE"
echo

# Print the next-step Agent tool invocation.
echo "============================================================"
echo " NEXT STEP - paste this into your Claude Code session"
echo "============================================================"
echo

case "$PHASE" in
  Design)
    cat <<EOF
Use the Agent tool with subagent_type='roadmap-designer' and isolation='worktree':

Prompt:
  Design card $CODE ($ISSUE_TITLE).
  Issue: $ISSUE_URL
  Branch (create with this name): $BRANCH
  The card body is at: $CTX_FILE

  Read the card body, then follow the roadmap-designer agent definition:
  produce docs/designs/$CODE.md, commit with message:
  'design: $CODE - <title>'.

  Do NOT write production code. Do NOT push.
EOF
    ;;
  Build)
    cat <<EOF
Use the Agent tool with subagent_type='roadmap-implementer' (no new worktree).

Prompt:
  Implement card $CODE ($ISSUE_TITLE).
  Issue: $ISSUE_URL
  The design doc is at: docs/designs/$CODE.md
  Branch: $BRANCH (already exists)

  Follow the roadmap-implementer agent definition. Phases: verify baseline,
  implement per design, test as you go, lint/typecheck before commits,
  update docs/core/current-status.md, final verification.

  Do NOT push. Do NOT deploy. Do NOT redesign.
EOF
    ;;
  Review)
    cat <<EOF
Use the Agent tool with subagent_type='roadmap-reviewer' (no new worktree).

Prompt:
  Review card $CODE ($ISSUE_TITLE).
  Issue: $ISSUE_URL
  Design: docs/designs/$CODE.md
  Branch: $BRANCH

  Follow the roadmap-reviewer agent definition. Produce docs/reviews/$CODE.md
  with verdict (Approve / Changes requested / Block) and commit it.
  Do NOT modify production code. Do NOT push.
EOF
    ;;
  Done)
    cat <<EOF
Card marked Done. Operator next steps:
  1. Push the branch: git push -u origin $BRANCH
  2. Open PR:         gh pr create --title '${CODE}: <title>' --body-file docs/reviews/$CODE.md
  3. Run operator deploy steps from docs/designs/$CODE.md if any.
  4. After merge, close issue #$ISSUE_NUMBER (auto-closes if PR references it).
EOF
    ;;
  Blocked)
    cat <<EOF
Card marked Blocked. Reason: $REASON
Add a comment on the issue documenting the blocker:
  gh issue comment $ISSUE_NUMBER --body 'Blocked: $REASON'
EOF
    ;;
  Backlog)
    echo "Card returned to Backlog. No agent action."
    ;;
esac

echo
echo "============================================================"
