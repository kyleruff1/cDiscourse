# 2026-05-18 — Overnight work audit

Audit pass covering all work merged to `main` in the overnight window since
the previous status anchor (2026-05-17 ~21:00 PT / 2026-05-18 ~04:00 UTC).
This pass is **docs + Project board reconciliation only** — no code changes.

## A. Latest main state

| Field | Value |
|---|---|
| branch | `main` |
| origin/main commit | `674f905` |
| local main commit | `674f905` |
| working tree | clean for tracked files (`.claude/worktrees/` untracked, local agent artifact, gitignore candidate) |
| typecheck | pass |
| lint | pass |
| tests | pass — 2201 tests / 88 suites |
| skills:validate | pass (bot-provocateur + bot-revocateur) |
| checkpoint | clean (no `ANTHROPIC_API_KEY` or `SERVICE_ROLE_KEY` in client paths) |

## B. Overnight merged work

Window: PRs merged between 2026-05-18 07:20Z and 2026-05-18 08:28Z plus
the immediately preceding infra commits.

| Merge commit | PR | Title | Issue(s) | Verification evidence | Ledger before | Project before | Audit verdict |
|---|---|---|---|---|---|---|---|
| `674f905` | #55 | BRAND-001 global CivilDiscourse identity + dark theme | #46 BRAND-001 | tc/lint/tests pass on `main` after merge; +24 `__tests__/appHeader.test.ts` | absent | Status=Done, Phase=Backlog (drift) | Done — ledger row appended, Phase corrected to Done |
| `63f2ac5` | #54 | RULE-001: Semantic rule-to-UI affordance map | #32 RULE-001 | tc/lint/tests pass on `main` | Not Started | Done | Done — ledger row appended |
| `2eb9d75` | #53 | AN-001: Deterministic board diagnostics model | #34 AN-001 | tc/lint/tests pass on `main` | Not Started | Done | Done — ledger row appended |
| `d2e5438` | #52 | HOST-003: Deployment smoke checklist — lock against landed sister cards | #29 HOST-003 | tc/lint/tests pass on `main` | Not Started | In Progress (drift; issue already CLOSED) | Done — ledger row appended, Project Status+Phase corrected to Done |
| `fe8b712` | #51 | SC-001: rail action grouping + contract lock | #9 SC-001 | tc/lint/tests pass on `main` | Not Started | Done | Done — ledger row appended |
| `9f4d289` | #50 | VG-001: argument visual grammar | #4 VG-001 | tc/lint/tests pass on `main` | Not Started | Done | Done — ledger row appended |
| `68f7402` | #49 | VG-003: design tokens layer | #6 VG-003 | tc/lint/tests pass on `main` | Not Started | Done | Done — ledger row appended |
| `1cf6c81` | #48 | SC-002: timeline node popover | #10 SC-002 | tc/lint/tests pass on `main` | Not Started | Done | Done — ledger row appended |
| `f986e6a` | #47 | Roadmap cycle — 8 UX cards bundled | #1 TL-001, #2 TL-002, #3 TL-003, #12 ST-001, #18 SW-001, #28 HOST-002, #29 HOST-003 (initial), #37 PM-002 | tc/lint/tests pass on `main` | all Not Started | all Done | Done — ledger rows appended per card |
| `1798a0e` | #45 | Agent issue runner + three-agent workflow docs | (infra) | tc/lint/tests pass on `main` | n/a (no roadmap issue) | n/a | infra — no ledger row required |
| `261be28` | #38 | Agent workflow + UX/UI roadmap infrastructure | (infra) | tc/lint/tests pass on `main` | n/a | n/a | infra — no ledger row required |

## C. Project drawdown — corrections applied this pass

| Issue | Code | Current Project Phase | Current Project Status | Desired Phase / Status | Action taken |
|---|---|---|---|---|---|
| #29 | HOST-003 | (unset) | In Progress | Done / Done | `gh project item-edit` — Status → Done, Phase → Done |
| #46 | BRAND-001 | Backlog | Done | Done / Done | `gh project item-edit` — Phase → Done (Status already Done) |

All other Done items already had `Status=Done` on the board; no further
field mutations were required.

## D. Remaining queue — next 5 recommended cards

Sorted by Priority then Release then Effort, ignoring cards blocked by an
unlanded dependency. `EV-002`, `EV-003`, `EV-004` are excluded because
they are explicitly blocked by `EV-001` per the board doctrine. `BR-002`
and `IX-002` are excluded because they are blocked by `BR-001`. `ST-002`
and `GAL-002` are no longer blocked since `RULE-001` shipped.

| Rank | Issue | Code | Title | Priority | Release | Effort | Charter | Reason |
|---|---|---|---|---|---|---|---|---|
| 1 | #14 | EV-001 | Evidence object model v1 | P0 | 6.6 | L | evidence-rules-agent | Unblocks EV-002/3/4 (three P0/P1 downstreams). Pure-TS data model + receipt chip; no live deps. |
| 2 | #7 | BR-001 | Tangent kink model | P0 | 6.6 | L | timeline-ui-agent | Unblocks BR-002 + IX-002. Pure-TS lane model on top of existing `argumentGameSurfaceModel.computeLane`. |
| 3 | #5 | VG-002 | Gradient wave rail | P0 | 6.6 | L | timeline-ui-agent | Visual polish on top of shipped VG-001 + VG-003 tokens. RN primitives only. |
| 4 | #42 | QOL-018 | Repo-local Claude agent charters for CDiscourse | P1 | 6.5 | S | issue-implementer | Smallest open card; finishes the Release 6.5 project-mgmt slice. |
| 5 | #11 | SC-003 | Sidecar as detail inspector, not action dumping ground | P1 | 6.6 | M | sidecar-tools-agent | Builds on shipped SC-001 + SC-002. |

## E. Stale / duplicate / suspicious items

| Item | Problem | Suggested fix | Applied? |
|---|---|---|---|
| `scripts/github/agentIssueRunner.js` shell-out | Hardcodes `gh.cmd` for win32; this machine ships `gh.exe`. `gh exit code null` → ENOENT spawn failure. Affected `npm run github:agent:queue` and `npm run github:agent:ledger`. Worked around with `GH_BIN=...\gh.exe`. | Open a follow-up card (QOL-021?) to fall back to `gh.exe` then `gh.cmd` then `gh`, or honour `GH_BIN` consistently. | No — code fix is out of scope for this docs-only audit pass. Flagged. |
| `docs/product-status-ledger.md` row count | All 15 cards shipped overnight still read `Not Started`. | Append Done rows at the top per ledger contract. | Yes — appended in this pass. |
| `.claude/worktrees/pr-bodies/` | Untracked agent artifact dir; not gitignored. | Either gitignore the prefix or document it. | No — left alone; flagged. |
| Issue #45 / #38 | Both are infra PR self-issues (`feat: agent issue runner …` / `chore: add agent workflow …`), not roadmap cards. They show in the GitHub Issues listing as numeric-only-issue PR rows. Harmless. | No action. | n/a |
| `docs/next-prompts.md` | Still pinned to Stage 6.1.2 / 6.1.3 / 6.1.4 prompts. The canonical "what to do next" guidance has moved to `docs/current-status.md` Now/Next/Later + the Project queue. | Treat `next-prompts.md` as historical; do not extend. Audit doc + ledger now drive next-pick guidance. | No — left alone; flagged. |

## F. Operator decisions needed

| Decision | Options | Recommendation |
|---|---|---|
| Fix `agentIssueRunner.js` Windows shell-out for `gh.exe`. | (a) file QOL-021 card and schedule, (b) operator patches inline now, (c) leave with `GH_BIN` workaround documented. | (a) file QOL-021 — it's a 10-min fix that unblocks two npm scripts on this and any other Windows machine. |
| `.claude/worktrees/pr-bodies/` untracked dir. | (a) add `.claude/worktrees/` to `.gitignore`, (b) leave untracked, (c) commit. | (a) add to `.gitignore` — these are local agent artifacts that should never enter the repo. |

## Verification commands run during this audit

```bash
git status -sb
git fetch origin --prune
git pull --ff-only origin main          # 674f905 → already at tip after pull
npm run checkpoint                      # secret scan clean
npm run skills:validate                 # bot-provocateur + bot-revocateur pass
npm run typecheck                       # pass
npm run lint                            # pass (0 warnings)
npm run test                            # 2201 tests / 88 suites pass
GH_BIN=...\gh.exe npm run github:agent:ledger -- --dry   # confirms open queue
gh issue list / gh pr list / gh project item-list        # cross-checked all 15 cards
```

## Safety scan

| Scan | Result |
|---|---|
| secret-shape (Anthropic / OpenAI / xAI / X bearer / Supabase service / JWT) | clean across diff and staged |
| x-shape (`x.com/…/status`, `t.co/…`, `twitter.com/…/status`) | clean |
| verdict-token (`troll`, `liar`, `propagandist`, `winner`, `loser`, etc.) | clean |
| forbidden paths (`.env`, `logs/`, `artifacts/diagnostics/`, `node_modules`, `.expo`) | none staged |
