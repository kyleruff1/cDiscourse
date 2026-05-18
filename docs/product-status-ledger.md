# Product status ledger

Append-only log of product status by issue. Maintained by the
issue-agent runner (`scripts/github/agentIssueRunner.js ledger`) and by
hand on the agent's sign-off step.

- **Date** — ISO date of the status entry (`YYYY-MM-DD`).
- **Issue** — `#<num>` and prefix (e.g., `#18 SW-001`).
- **Title** — the issue title at the time of the entry.
- **Status** — `Not Started | In Progress | Needs Review | Done | Blocked`.
- **Commit** — first 7 chars of the commit hash, or `—` if no commit yet.
- **Agent** — the charter that did the work, or `—` if pre-implementation.
- **Verification** — `tc=<pass|fail>; lint=<pass|fail>; tests=<count|fail>`.
- **Notes** — short. Link out to docs / other issues if needed.

The ledger is the **source of truth for product status in the repo**. It
is allowed to disagree with the GitHub Project board for short windows
(after a verified commit but before sign-off lands on GitHub); the
agent's job is to close those windows quickly via
`node scripts/github/agentIssueRunner.js signoff --issue <n> ...`.

> Append new rows at the **top** of the table below the header. Do not
> rewrite history — if status was wrong, append a new row with the
> correction and a Notes link.

## Entries

| Date | Issue | Title | Status | Commit | Agent | Verification | Notes |
|---|---|---|---|---|---|---|---|
| 2026-05-18 | #46 BRAND-001 | Global app shell: dark theme + CivilDiscourse logo header | Done | abba2e8 | timeline-ui-agent | tc=pass; lint=pass; tests=2201 | Merged via PR #55. Project Phase corrected Backlog → Done. Audit: `docs/project-audits/2026-05-18-overnight-work-audit.md`. |
| 2026-05-18 | #32 RULE-001 | Semantic rule-to-UI affordance map | Done | bc4fe3c | evidence-rules-agent | tc=pass; lint=pass; tests=2201 | Merged via PR #54. Unblocks ST-002 + GAL-002. |
| 2026-05-18 | #34 AN-001 | Deterministic board diagnostics model | Done | 7faefb6 | analytics-agent | tc=pass; lint=pass; tests=2201 | Merged via PR #53. |
| 2026-05-18 | #29 HOST-003 | Deployment smoke checklist | Done | a6ccd3a | hosting-dev-agent | tc=pass; lint=pass; tests=2201 | Merged via PR #52 (and earlier PR #47). Project Status corrected In Progress → Done. |
| 2026-05-18 | #9 SC-001 | Consolidate controls into side action rail | Done | b0dea59 | sidecar-tools-agent | tc=pass; lint=pass; tests=2201 | Merged via PR #51. |
| 2026-05-18 | #4 VG-001 | Argument visual grammar | Done | a31ac6c | timeline-ui-agent | tc=pass; lint=pass; tests=2201 | Merged via PR #50. Unblocks SW-001 (already shipped). |
| 2026-05-18 | #6 VG-003 | Bootstrap-inspired design tokens | Done | 2ac1135 | timeline-ui-agent | tc=pass; lint=pass; tests=2201 | Merged via PR #49. |
| 2026-05-18 | #10 SC-002 | Timeline node popover | Done | 31cb20e | sidecar-tools-agent | tc=pass; lint=pass; tests=2201 | Merged via PR #48. |
| 2026-05-18 | #37 PM-002 | Now/Next/Later tracker in current-status.md | Done | 01b0ff7 | issue-implementer | tc=pass; lint=pass; tests=2201 | Merged via PR #47 bundle. |
| 2026-05-18 | #28 HOST-002 | Dev environment banner and safety boundary | Done | 874a70a | hosting-dev-agent | tc=pass; lint=pass; tests=2201 | Merged via PR #47 bundle. |
| 2026-05-18 | #18 SW-001 | Strong vs weak talking point bands | Done | a17907a | timeline-ui-agent | tc=pass; lint=pass; tests=2201 | Merged via PR #47 bundle. |
| 2026-05-18 | #12 ST-001 | Reposition Stack as Card Details | Done | 70b646f | sidecar-tools-agent | tc=pass; lint=pass; tests=2201 | Merged via PR #47 bundle. |
| 2026-05-18 | #3 TL-003 | Timeline board shell with no page redirect | Done | e26bb82 | timeline-ui-agent | tc=pass; lint=pass; tests=2201 | Merged via PR #47 bundle. |
| 2026-05-18 | #2 TL-002 | Timeline onboarding focus on first point | Done | 1d4b925 | timeline-ui-agent | tc=pass; lint=pass; tests=2201 | Merged via PR #47 bundle. |
| 2026-05-18 | #1 TL-001 | Make Timeline the default room landing mode | Done | 6b660cd | timeline-ui-agent | tc=pass; lint=pass; tests=2201 | Merged via PR #47 bundle. |
| 2026-05-18 | #36 PM-001 | Create docs/ux-ui-project-board.md | Done | f8b23c6 | project-board-manager | tc=pass; lint=pass; tests=1899 | Doc landed in board commit. |
| 2026-05-18 | #44 QOL-020 | Open-room engagement runner patch | Not Started | — | — | — | New card. |
| 2026-05-18 | #43 QOL-019 | Bot tester prompt refresh | Not Started | — | — | — | New card. |
| 2026-05-18 | #42 QOL-018 | Repo-local Claude agent charters | In Progress | this commit | project-board-manager | tc=pass; lint=pass; tests=1899 | Charters doc + workflow doc + runner scaffold landing now; final sign-off when runner tests are green. |
| 2026-05-18 | #41 QOL-017 | GitHub Projects automation script | Needs Review | f8b23c6 | project-board-manager | tc=pass; lint=pass; tests=1899 | Dry-run + operator bash + tests live; --apply path delegates to bash for now. Operator verification = run `bash scripts/github/applyUxProjectBoard.sh` once and confirm idempotent. |
| 2026-05-18 | #40 QOL-016 | Supabase Auth + redirect audit | Not Started | — | — | — | Blocked on HOST-001 URL decision. |
| 2026-05-18 | #39 QOL-015 | Admin email delivery validation | Not Started | — | — | — | See `docs/admin-email-validation-plan.md` M1–M5. |
| 2026-05-18 | #37 PM-002 | Now/Next/Later tracker in current-status.md | Not Started | — | — | — | Small docs card. |
| 2026-05-18 | #35 AN-002 | Visual QA snapshots | Not Started | — | — | — | Fixture timelines for visual review. |
| 2026-05-18 | #34 AN-001 | Deterministic board diagnostics | Not Started | — | — | — | Pure-model dev/debug board readout. |
| 2026-05-18 | #33 RULE-002 | Evidence symmetry between validation and visuals | Not Started | — | — | — | |
| 2026-05-18 | #32 RULE-001 | Semantic rule-to-UI map | Not Started | — | — | — | |
| 2026-05-18 | #31 GAL-002 | Entry cards with first suggested move | Not Started | — | — | — | |
| 2026-05-18 | #30 GAL-001 | Gallery sections as scrum-like play lanes | Not Started | — | — | — | |
| 2026-05-18 | #29 HOST-003 | Deployment smoke checklist | Not Started | — | — | — | Depends on HOST-001 URL choice. |
| 2026-05-18 | #28 HOST-002 | Dev environment banner | Not Started | — | — | — | Small UI card. |
| 2026-05-18 | #27 HOST-001 | Dev hosting architecture | Not Started | — | — | — | Spike both URL options first. |
| 2026-05-18 | #26 PR-004 | Contact information update | Not Started | — | — | — | |
| 2026-05-18 | #25 PR-003 | Avatar upload policy and storage | Not Started | — | — | — | |
| 2026-05-18 | #24 PR-002 | Profile tag popout | Not Started | — | — | — | |
| 2026-05-18 | #23 PR-001 | My preferences popout | Not Started | — | — | — | |
| 2026-05-18 | #22 IX-003 | Keyboard and accessibility navigation | Not Started | — | — | — | |
| 2026-05-18 | #21 IX-002 | Timeline mini-map overview | Not Started | — | — | — | |
| 2026-05-18 | #20 IX-001 | Timeline zoom and density modes | Not Started | — | — | — | |
| 2026-05-18 | #19 SW-002 | Heat, momentum, trend without truth claims | Not Started | — | — | — | |
| 2026-05-18 | #18 SW-001 | Strong vs weak talking point bands | Not Started | — | — | — | P0 candidate for first implementer pass. |
| 2026-05-18 | #17 EV-004 | Evidence symmetry with game rules | Not Started | — | — | — | |
| 2026-05-18 | #16 EV-003 | Evidence debt tracker | Not Started | — | — | — | |
| 2026-05-18 | #15 EV-002 | Source-chain popover | Not Started | — | — | — | P0 candidate for first implementer pass. |
| 2026-05-18 | #14 EV-001 | Evidence object model v1 | Not Started | — | — | — | Foundation for EV-002/3/4. |
| 2026-05-18 | #13 ST-002 | Suggested reply flags per bubble card | Not Started | — | — | — | |
| 2026-05-18 | #12 ST-001 | Reposition Stack as Card Details | Not Started | — | — | — | |
| 2026-05-18 | #11 SC-003 | Sidecar as detail inspector | Not Started | — | — | — | |
| 2026-05-18 | #10 SC-002 | Timeline node popover | Not Started | — | — | — | P0 candidate for first implementer pass. |
| 2026-05-18 | #9 SC-001 | Consolidate controls into side action rail | Not Started | — | — | — | P0 candidate. Charter: sidecar-tools-agent. |
| 2026-05-18 | #8 BR-002 | Split-screen branch inspector | Not Started | — | — | — | |
| 2026-05-18 | #7 BR-001 | Tangent kink model | Not Started | — | — | — | |
| 2026-05-18 | #6 VG-003 | Bootstrap-inspired design tokens | Not Started | — | — | — | |
| 2026-05-18 | #5 VG-002 | Gradient wave rail | Not Started | — | — | — | |
| 2026-05-18 | #4 VG-001 | Argument visual grammar | Not Started | — | — | — | P0 candidate for first implementer pass. |
| 2026-05-18 | #3 TL-003 | Timeline board shell with no page redirect | Not Started | — | — | — | |
| 2026-05-18 | #2 TL-002 | Timeline onboarding focus on first point | Not Started | — | — | — | |
| 2026-05-18 | #1 TL-001 | Make Timeline the default room landing mode | Not Started | — | — | — | Recommended first issue: small surface, clear acceptance criteria. Charter: timeline-ui-agent. |

---

## How the runner uses this file

`node scripts/github/agentIssueRunner.js ledger --dry` re-derives the
"Not Started" rows from open GitHub issues and prints them so a human
can paste them in. The runner never auto-overwrites this file — appends
only happen by hand or by an explicit sign-off command.

The reason for keeping this in git (vs. only on the project board) is
that the ledger gives every PR / commit a stable anchor that survives
GitHub project re-orgs.
