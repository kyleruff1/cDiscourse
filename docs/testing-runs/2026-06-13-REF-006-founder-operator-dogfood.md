# REF-006 — Founder/operator dogfood run (2026-06-13)

## 1. Header

| Field | Value |
|---|---|
| Card | REF-006 — Human usability smoke (5-task first-user pass) |
| Issue | [#589](https://github.com/kyleruff1/cDiscourse/issues/589) |
| HEAD SHA | `ae157d7` (`main == origin/main`, verified) |
| Run mode | **C — ready-to-run shell** (see § Run-mode determination) |
| Date | 2026-06-13 |
| Operator / agent role | Claude Code (agent), static inspection + baseline verification only |
| App route / command used | None executed as a cold-viewer run — the corridor entry is `App.tsx:760-766` ("See how it works" → `setDemoCorridorOpen(true)`), rendered at `App.tsx:711-712`. No app launch / device / browser session was performed. |
| Baseline counts | Full Jest **745 suites / 30245 passed + 1 pre-existing skip / 0 failures**; `npm run typecheck` exit 0 |

### Run-mode determination (the honest gate)

REF-006's evidence is, by the protocol's own definition, **human comprehension on a rendered device**: "the participant drives the device," "no documentation is provided," and the operator dry walk-through is "operator runs this checklist **once, solo**" on a build (`docs/testing-runs/REF-006-usability-smoke-protocol.md:24-27,:175-179`). The §6 task rubric asks perceptual questions — *can the viewer find* X, *does it feel like* procedural guidance — that cannot be answered without a human watching a rendered UI.

- **Mode A (actual corridor run) — NOT AVAILABLE.** CDiscourse is an Expo React Native mobile app. Exercising the shipped "See how it works" corridor as a cold viewer requires a device/simulator (`expo start`) or a rendered web bundle (`expo start --web` / `npm run web:build`) viewed and tapped in a browser. This session has no simulator, device, browser-automation, or screenshot capability; the agent cannot perceive a rendered surface, tap an affordance, or stopwatch human comprehension. The corridor's jest component tests (`__tests__/DemoCorridorScreen.test.tsx` et al.) are **instrument validation** — exactly the thing §3.7(7) and the protocol's "instrument vs usability" preamble say is *not* UX evidence.
- **Mode B (operator notes encoding) — NOT AVAILABLE.** No manual observations were supplied in this session.
- **→ Mode C.** Per §2 ("No invented dogfood observations… produce a ready-to-run report shell and stop") and §9 decision-tree option 6, this run produces the shell, confirms the **instrument is green and safe** via static inspection (clearly labeled, not dogfood), and recommends **NO CARD YET**. No human-comprehension task is scored PASS/FAIL; none was run.

---

## 2. Executive verdict

- **Recruitable now?** **NOT ENOUGH EVIDENCE.** The instrument is shipped, green, doctrinally clean, and provably safe (static checks below). Whether a cold first-timer *understands the loop in under 3 minutes* is unmeasured — that is precisely the human evidence this run could not fabricate.
- **One-sentence reason.** The corridor compiles, mounts the real components, and cannot submit or spend, but recruitability is a perception claim and no human (operator or participant) has yet walked it.
- **Primary recommended next card.** **NO CARD YET** — run the operator dry walk-through (Mode A, human) first; the next product card is chosen from *its* findings, not from this shell.

---

## 3. Task score table

All ten §6 tasks are **NOT_RUN** for human comprehension (no cold-viewer session occurred). The "Static note" column records only what is verifiable from code + tests at `ae157d7` — a readiness signal, **not** a usability result.

| # | Task | Result | Time / friction | Static note (code/test fact — NOT dogfood evidence) | Severity |
|---|---|---|---|---|---|
| 1 | Cold entry — find "See how it works" | NOT_RUN | — | Entry affordance exists: `App.tsx:760-766`, label `See how it works` (`corridorModel.ts:110`), a11y label present (`:111`). Visibility/findability is unmeasured. | — |
| 2 | Disputed point identifiable | NOT_RUN | — | Fixture has one disputed sub-claim owing a source; corridor focuses it (`corridorModel.ts:310-318`); Referee Card renders `Point under dispute: "…"`. Human identification unmeasured. | — |
| 3 | Open Issues rail answers the 5 orientation questions | NOT_RUN | — | Rail shipped (REF-006-RAIL, `openIssuesRail/openIssuesRailModel.ts`); plain-language state/burden + next-move per entry. Whether a viewer *reads* it that way is unmeasured. | — |
| 4 | Referee Card reads as guidance, not verdict | NOT_RUN | — | Copy is ban-list-clean by construction (`demoCorridorCopy.test.ts` scans every atom; doctrine §1). The *felt* tone is unmeasured. | — |
| 5 | One immediately-valid next move is obvious | NOT_RUN | — | `ask_source` / `narrow` are engine-valid as-offered; `add_evidence` / `branch` after the corridor-instructed completion (`demoCorridorEngineValidity.test.tsx:153-189`). Obviousness is unmeasured. | — |
| 6 | Inspect shows detail without raw codes by default | NOT_RUN | — | Raw keys confined to the Inspect overlay (REF-004 `InspectOpenIssueDetail`); `demoCorridorCopy`/no-raw-code scans hold. Human inspect path unmeasured. | — |
| 7 | Invalid move → recovery route, not bare rejection | NOT_RUN | — | `nextBestMoves ⊆` engine survivors; `branch_tangent` recovery (REF-002/004). Whether the viewer *experiences* it as recovery is unmeasured. | — |
| 8 | Request review / Mark concern feels procedural | NOT_RUN | — | Bounded concern object (REF-005); person-directed types moderator-visible pre-review. Felt framing unmeasured. (Known label split: `Request review` vs `Send for review`.) | — |
| 9 | Demo safety (fixture / no-provider / no-credential / no-prod-submit) | **STATIC PASS** | — | **Verified, not dogfood:** corridor source contains no `supabase` / `submitArgumentDraft` / `fetch(` (`demoCorridorNoProvider.test.ts:31-56`); mounts real `ArgumentGameSurface` + `OneBox` (`:65-71`); `makeDemoBeforeSubmit` always returns `false` (`corridorModel.ts:441-446`); assembled-Post regression presses the real Post button and asserts `submitArgumentDraft` never called (`demoCorridorEngineValidity.test.tsx:22-24,:233-259`). | — |
| 10 | Recruitability (<3 min for a new person) | NOT_RUN | — | 7-step script, one-primary-action invariant (`countPrimaryActions`, `corridorModel.ts:289-291`); design estimates ~170s happy path. The estimate is not a measurement. | — |

---

## 4. Stopwatch log

No stopwatch was started — no cold-viewer run occurred. Fields left for the operator's Mode A pass:

| Beat | Time |
|---|---|
| Start (corridor entry) | ___ |
| First orientation | ___ |
| Disputed point identified | ___ |
| Rail understood | ___ |
| Referee Card understood | ___ |
| First valid move found | ___ |
| First move completed | ___ |
| Stuck / finish | ___ |

---

## 5. Stuck-point ledger (§7 taxonomy)

**Empty — no human observations were collected.** No stuck point may be recorded without a run; inventing one would violate §2. The operator's Mode A pass populates this using the categories: copy confusion · navigation confusion · too many surfaces · unclear burden/debt · referee feels accusatory · cannot find next move · wants to accuse not request remedy · derived-state mismatch · demo framing · rail ordering/filtering · valid-move-too-slow · accessibility/mobile target.

---

## 6. Overridable verdicts

For each overridable, the **code fact** is static-verifiable and recorded; the **human verdict** is explicitly deferred to the operator's run (it is a perception question this shell cannot answer).

### 6.1 Stand-in-participant framing
- **Code fact (`corridorModel.ts:112-113`):** the first beat shows *"Step into one side of a live dispute. You are a stand-in here — nothing you do leaves this walkthrough."* (`viewerRole='participant'` resolution from DEMO-001's design).
- **Human verdict:** **DEFERRED — NOT ENOUGH EVIDENCE.** Whether this clarifies or makes the viewer feel they are role-playing an artificial scene is the operator's call after the walkthrough. Options on the table (report-only, do not implement): keep as-is · minor copy polish · replace with neutral guided-demo framing · new demo card.

### 6.2 Conceded issues remain in the rail
- **Code fact (`openIssuesRail/openIssuesRailModel.ts:221-226,:233-234,:260`):** `conceded` is intentionally **not** in `TERMINAL_DISPLAY_STATES`, so a conceded issue stays visible (ranked low, `ledgerRank.conceded = 6`); removal is a documented one-line change (add `'conceded'` to the terminal set).
- **Human verdict:** **DEFERRED — NOT ENOUGH EVIDENCE.** Whether keeping conceded issues visible reads as helpful history or as rail noise is the operator's call after the walkthrough. Options (report-only): keep visible · keep visible but collapsed · move to Inspect/history · hide from default rail after concession.

---

## 7. Doctrine check (static — verifiable without a human)

| Doctrine line | Status | Evidence |
|---|---|---|
| No AI truth adjudication | HOLDS | Corridor is fixture + UI only; no classifier/provider in path (`demoCorridorNoProvider.test.ts`). |
| No winner/loser language | HOLDS | `demoCorridorCopy.test.ts` scans every copy atom against the 16 verdict/person tokens. |
| No public person/intent accusation | HOLDS | No allegation surface in the corridor; REF-005 person-directed concerns are moderator-visible pre-review (upstream). |
| Classifiers advisory + asynchronous | HOLDS | Corridor renders the shipped advisory surfaces; nothing in it gates a post. |
| Deterministic engine is the only submit gate | HOLDS | `evaluateArgumentDraft` is the gate; corridor's `onBeforeSubmit` returns `false` before any submit (`corridorModel.ts:441-446`). |
| No raw internal codes in default copy | HOLDS | Plain moves only (`corridorModel.ts:16-19,:136-139`); no-raw-code scans pass. |

---

## 8. Safety / technical check (static)

| Check | Status | Evidence |
|---|---|---|
| No provider call | PASS | No `anthropic`/`xai`/`x-api`/`fetch(` in `src/features/demoCorridor/**` (`demoCorridorNoProvider.test.ts:31-56`). |
| No production submit | PASS | `makeDemoBeforeSubmit` → `false`; assembled-Post regression asserts `submitArgumentDraft` never called (`demoCorridorEngineValidity.test.tsx:22-24,:259`). |
| No credential use | PASS | This run read no `.env*` / secrets / tokens; corridor needs none. |
| No Supabase write | PASS | No `supabase` import in the corridor path; no write performed by this run. |
| No source edit | PASS | This run edits only `docs/testing-runs/**` (+ optional `docs/core/next-prompts.md`). |
| No MCP deploy-bearing change | PASS | No `mcp-server/**` touched. |
| Baseline green | PASS | 745/30245 + 1 skip; typecheck exit 0; `main == origin/main` @ `ae157d7`. |

---

## 9. Next-card recommendation

- **Primary next card: NO CARD YET.**
- **Rationale.** §9's decision tree routes to "NO CARD YET" when **no actual dogfood evidence was collected** — which is the case here. COPY-POLISH, REF-006-RAIL-ITERATION, DEMO-001-POLISH, REF-005B, and DOGFOOD-BETA-READINESS are all *evidence-gated*: each is chosen by a *specific* stuck-point class, and there are no stuck points yet. Picking one now would be fabricating the evidence that selects it.
- **The single real next action (not a product card):** the **operator runs the dry walk-through** (`REF-006-usability-smoke-protocol.md:175-193`, 8 checkboxes) once, solo, on a build — Mode A, human — then either runs 1–3 first-timers or pastes notes back for a Mode B encoding. That produces the stuck-point ledger that selects the next card.
- **Secondary candidates (contingent, listed not chosen).** Should the operator's run surface friction, the likely mapping is: *rail orientation/noise* → REF-006-RAIL-ITERATION (incl. the §6.2 conceded decision); *label/debt/card wording* → COPY-POLISH; *corridor framing/timing/first-click* (incl. the §6.1 stand-in decision) → DEMO-001-POLISH; *concern flow understood, persistence missing* → REF-005B (GATE-C); *clean completion* → DOGFOOD-BETA-READINESS.
- **Automerge posture (of any follow-up).** COPY-POLISH / RAIL-ITERATION / DEMO-001-POLISH: prefer-eligible if UI/fixture-only, green, no sensitive-visibility/persistence/provider/submit change. REF-005B: GATE-C, operator-gated, no automerge. BETA-READINESS: split docs/tests (eligible) from product changes (gated).

---

## 10. Appendix

### Load-bearing citations (`file:line@ae157d7`)
- Corridor entry: `App.tsx:711-712,:760-766` · stand-in framing copy `corridorModel.ts:112-113`.
- 7-step machine + one-primary-action invariant: `corridorModel.ts:185-251,:289-291`.
- No-submit seam: `corridorModel.ts:433-446`.
- No-provider scan: `__tests__/demoCorridorNoProvider.test.ts:29-95`.
- Engine validity + assembled-Post regression: `__tests__/demoCorridorEngineValidity.test.tsx:138-259`.
- Rail conceded handling: `src/features/arguments/openIssuesRail/openIssuesRailModel.ts:221-260`.
- Protocol + dry walk-through: `docs/testing-runs/REF-006-usability-smoke-protocol.md:24-27,:175-193`.

### Commands run (read-only / baseline)
- `git status --short` · `git rev-parse --show-toplevel` · `git branch --show-current` · `git rev-parse HEAD` · `git fetch origin main` · `main` vs `origin/main` equality.
- `npm run typecheck` → exit 0.
- `npx jest --silent` → 745 suites / 30245 passed + 1 skip / 0 failures.
- `gh issue view 589`.

### Artifacts
- None produced beyond this report. No screenshots/logs (no rendered session). The web build path (`npm run web:build:dry`) is available to the operator as an optional pre-walkthrough build-readiness check but is not UX evidence.
