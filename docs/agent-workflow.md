# Agent workflow — how cards get built

This is the operator's reference for shipping a CDiscourse roadmap card with Claude Code subagents. The roadmap is in `docs/ux-ui-project-board.md` and tracked at https://github.com/users/kyleruff1/projects/1.

## TL;DR

```powershell
# 1. Pick a card from the project (e.g. TL-001) and move it to Design phase
.\.claude\scripts\spawn-card.ps1 TL-001

# 2. Paste the printed prompt into Claude Code. The designer agent produces
#    docs/designs/TL-001.md and commits it on feat/TL-001-<slug>.

# 3. Move to Build phase
.\.claude\scripts\spawn-card.ps1 TL-001 -Phase Build

# 4. Paste the printed prompt. The implementer writes code + tests + doc updates.

# 5. Move to Review phase
.\.claude\scripts\spawn-card.ps1 TL-001 -Phase Review

# 6. Paste the printed prompt. The reviewer produces docs/reviews/TL-001.md.

# 7. If Approve: push + open PR
.\.claude\scripts\spawn-card.ps1 TL-001 -Phase Done
git push -u origin feat/TL-001-<slug>
gh pr create --title "TL-001: Make Timeline the default room landing mode" --body-file docs/reviews/TL-001.md
```

## The pieces

### Agents (`.claude/agents/`)

Three roles, one per phase. Each is a markdown file with frontmatter that Claude Code reads as a subagent definition.

| Agent | Phase | Output | Does NOT |
| --- | --- | --- | --- |
| `roadmap-designer` | Design | `docs/designs/<code>.md` | write production code, install deps, push |
| `roadmap-implementer` | Build | Code + tests + `docs/current-status.md` update | redesign, deploy, push |
| `roadmap-reviewer` | Review | `docs/reviews/<code>.md` with verdict | modify code, push, open PR |

Each agent reads `CLAUDE.md`, the relevant skills, and the card's design doc (after designer). They commit on the branch but never push.

### Skills (`.claude/skills/`)

Eight knowledge files that the agents invoke to expand the HOW of each technical decision:

| Skill | Covers | When agents invoke it |
| --- | --- | --- |
| `cdiscourse-doctrine` | Universal product safety + secrets policy | Every card |
| `expo-rn-patterns` | Expo / RN dep policy + UI primitives | UI cards (Epic 1-9, 11) |
| `supabase-edge-contract` | RLS, Edge Function shape, migration discipline | DB / Edge / Auth cards (Epic 6, 9, 10) |
| `test-discipline` | Coverage rules, where tests live, ban-list patterns | Every card (in the test step) |
| `timeline-grammar` | Shape/color/stroke tokens, branch lanes | Visual + timeline cards (Epic 2, 3, 7) |
| `evidence-doctrine` | Evidence artifact model, anti-amplification, debt | Evidence cards (Epic 6, 11, 12) |
| `accessibility-targets` | a11y bar, screen-reader contract, keyboard nav | Any visible UI card |
| `point-standing-economy` | Scoring economy, bands, concession rules | Scoring + standing cards (Epic 6, 7) |

The agents pick the skills they need from the card's epic; you don't manually inject them.

### Orchestration (`.claude/scripts/spawn-card.ps1`)

One PowerShell script. Given a card code + target phase, it:

1. Looks up the GitHub issue by code.
2. Sets the **Phase** field on the GitHub Project item.
3. Saves the issue body to a temp file.
4. Prints the exact Claude Code prompt to paste back into your session.

It does NOT actually spawn the subagent — that part you do by pasting the prompt into Claude Code, which uses the Agent tool with `subagent_type='roadmap-designer'` (or implementer/reviewer) and `isolation='worktree'`.

### GitHub Project (Project #1)

Fields:
- **Status** — default kanban (Todo / In Progress / Done) — optional, not driven by the script
- **Phase** — driven by the script: Backlog / Design / Build / Review / Done / Blocked
- **Priority** — P0 / P1 / P2
- **Effort** — S / M / L / XL
- **Epic** — 14 epics
- **Release** — 6.5 / 6.6 / 6.7 / 6.8

Recommended views (create in the web UI):
1. **Now / Next / Later** — Board grouped by Release
2. **By Epic** — Board grouped by Epic
3. **Current pipeline** — Board grouped by Phase (shows what each agent is doing)
4. **P0 backlog** — Table filtered Priority=P0, sorted by Release

## The end-to-end loop per card

```
                ┌────────────────────────────────────────────┐
                │ Operator picks a card from the Project    │
                │ Phase: Backlog                            │
                └────────────────────────────────────────────┘
                                  │
                                  ▼
                ┌────────────────────────────────────────────┐
                │ .\spawn-card.ps1 <code>                   │
                │ Phase: Backlog -> Design                  │
                │ Prints designer prompt                    │
                └────────────────────────────────────────────┘
                                  │
                                  ▼
                ┌────────────────────────────────────────────┐
                │ Claude Code: Agent tool                   │
                │   subagent_type=roadmap-designer          │
                │   isolation=worktree                      │
                │   prompt=<designer prompt>                │
                │                                            │
                │ Designer reads card + skills, writes      │
                │ docs/designs/<code>.md, commits.          │
                └────────────────────────────────────────────┘
                                  │
                  ┌───────────────┴────────────────┐
                  │                                │
                  ▼                                ▼
       Design OK              Design says "Cannot proceed"
                  │                                │
                  ▼                                ▼
       .\spawn-card.ps1                  .\spawn-card.ps1
       <code> -Phase Build               <code> -Phase Blocked
                                          -Reason "..."
                  │
                  ▼
       Agent tool: roadmap-implementer
       Writes code + tests + doc updates
       Commits in coherent slices
                  │
                  ▼
       .\spawn-card.ps1 <code> -Phase Review
                  │
                  ▼
       Agent tool: roadmap-reviewer
       Writes docs/reviews/<code>.md
       Verdict: Approve / Changes / Block
                  │
       ┌──────────┼──────────────┐
       │          │              │
       ▼          ▼              ▼
    Approve    Changes         Block
       │       requested        │
       │          │             ▼
       │          ▼          Back to Build
       │       Implementer   or re-spawn
       │       addresses     Design
       │          │
       │          ▼
       │       Re-Review
       ▼
   .\spawn-card.ps1 <code> -Phase Done
   git push + gh pr create
   Operator runs deploy steps from design's "Operator steps"
```

## Why three agents and not one

A single agent that designs + builds + reviews has all three problems compressed into one context: it can build to its own design and "review" its own code without the friction that catches mistakes. The three-agent split:

- Forces the design to be **written down** before code starts (so a fresh implementer can follow it).
- Lets the implementer fail gracefully — if the design is wrong, the implementer surfaces it without paper-overing.
- Gives the reviewer an independent context with no investment in the design choices.

The cost is two extra commits per card. The benefit is a clean audit trail and earlier detection of doctrine drift.

## Why one card per worktree

Each card gets `.claude/worktrees/<auto-slug>` (created by `isolation: "worktree"`) and a `feat/<code>-<slug>` branch off `main`. This means:

- Multiple cards can be in flight simultaneously (different agents, different worktrees).
- No agent steps on another agent's changes.
- Merge to main is per-card, so a stalled card never blocks others.
- A reverted PR removes only that card's changes.

**Working-directory discipline.** Any agent — or the orchestrator — that inspects git state must first run `git rev-parse --show-toplevel` to confirm whether it is in a worktree or the main checkout. A fresh worktree legitimately has an empty `git status` and none of the main checkout's untracked files; misreading that as data loss caused a false "main corrupted" alarm once. The `reset --hard` reflog entry from worktree setup is normal — it operates on the worktree's own HEAD, not `main`. Worktree isolation works correctly; the only failure mode is diagnostic confusion.

## Doctrine that ALL agents must respect

Pulled from `cdiscourse-doctrine` skill — re-stated here so it's visible without invoking the skill:

1. No truth / winner / loser language in user-facing strings.
2. Score never blocks posting. Validation can, score can't.
3. Heat = activity, not correctness. Popularity is not evidence.
4. AI moderator never decides who is right. AI calls only in Edge Functions, not the client app.
5. The rules engine (`src/lib/constitution/engine.ts`) is pure TS — no React, no Supabase, no fetch.
6. No service-role key in client. No direct insert into `public.arguments` from client. RLS always on.
7. Plain language for users — no raw `snake_case_codes` in UI strings.
8. v1 will not build: voting, search, push notifications, OAuth, public API.
9. Soft-delete `arguments` only. Soft-dismiss `flags` only.
10. Tests are part of "done", not a follow-up.

## When things break

- **Designer says "Cannot proceed"** — read the design doc; the issue is at the top. Likely doctrine conflict or under-specified card. Fix the card body and re-spawn, or split the card.
- **Implementer says "Cannot proceed"** — the design has a defect. Re-spawn designer with the implementer's note.
- **Reviewer says "Block"** — read the review's blockers. If it's an implementation gap, re-spawn implementer. If it's a design defect, re-spawn designer.
- **Tests fail on main before designer starts** — fix main first. The whole pipeline assumes a green baseline.
- **A skill is missing/wrong** — edit the skill file. Skills are versioned in `.claude/skills/<name>/SKILL.md`.

## Troubleshooting — GitHub CLI on Windows

`scripts/github/agentIssueRunner.js` (used by `npm run github:agent:queue` and `npm run github:agent:ledger`) shells out to `gh`. On Windows the resolver tries `gh.exe`, then `gh.cmd`, then bare `gh`, with `GH_BIN` overriding all three. If `npm run github:agent:queue` exits with `failed to list open issues (gh exit code null)` or `GitHub CLI not found`, walk through this checklist before touching the runner:

```powershell
where gh                    # confirms a `gh` is on PATH and shows which file
gh --version                # confirms it actually runs
gh auth status              # confirms a token is loaded
gh auth refresh -s project  # add Project v2 scope if "project" is missing
```

If `where gh` returns an absolute path but the runner still fails, set `GH_BIN` to that exact path for the current session:

```powershell
$env:GH_BIN = 'C:\Users\<you>\AppData\Local\Microsoft\WinGet\Packages\GitHub.cli_Microsoft.Winget.Source_8wekyb3d8bbwe\bin\gh.exe'
```

Note on WinGet exit code 43 (`No applicable update found` / `Existing package already installed`): this is **not** a fatal install error — it usually means GitHub CLI is already installed and WinGet found nothing newer. Move on to `gh --version` and `gh auth status`; no reinstall is required.

The runner never logs the token, the `Authorization` header, or `gh auth status` raw output.

## What this workflow does NOT do

- Does NOT push to remote automatically. Operator pushes.
- Does NOT open PRs automatically. Operator runs `gh pr create`.
- Does NOT deploy Supabase migrations or Edge Functions. Operator runs `npx supabase ...`.
- Does NOT auto-merge. Operator merges after review and any human review.
- Does NOT poll the Project board for new cards. You drive cadence via `spawn-card.ps1`.

If you want auto-deploy or auto-merge, that's a `/schedule` or CI job, not the per-card agent loop.
