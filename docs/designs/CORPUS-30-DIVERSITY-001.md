# CORPUS-30-DIVERSITY-001 — Voice + spine diversity tuning (corpus runner / reporter)

**Verified-at-HEAD:** `37ccd9e` (`37ccd9ed027c625686f3eee517d03a48df25a29d` — `feat(ADMIN-ARGS-INACTIVE-001) … (#480)`)
**Issue:** #468 (OPEN, dev-tooling-only) — refinement, not a duplicate.
**Type:** dev-tooling. Touches `scripts/bot-fixtures/**` + `__tests__/**` ONLY.
**Depends on:** #467 (CORPUS-30-QUALITY-001) — lands first. Same §9-reporter twin files. See "§9-reporter twin-file collision" below.
**Status:** DESIGN. No code in this card.

---

## Constitutional acceptance-gate invariant (verbatim)

> AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine, `src/lib/constitution/engine.ts`, is the sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post.

This card touches the bot-fixture corpus runner + its Markdown reporter only. It does NOT touch `submit-argument`, the classifier queue, routing, observations, MCP, or `engine.ts`. The invariant is unaffected and is stated here because the card is adjacent to corpus runs that exercise the submit path. The corpus runner posts through the ordinary `submit-argument` flow (no direct insert, no service-role); voice/spine ids are structural metadata stamped onto bot personas — they never gate, reject, or delay any post.

---

## Scope

In scope (dev-tooling only):

1. **Voice-assignment diversity.** `assignVoiceId(runId, botUserId)` keys on `runId + botUserId` only (`corpusPoolDrivenPlanner.js:272`). With 3 bot accounts × 30 scenarios this deterministically yields exactly 3 voices, each at count = 30, out of an 8-voice catalogue (`corpusPoolDrivenPlannerConstants.js:22-31`). Tune the diversity so a 30-room run uses materially more of the catalogue, **OR** recalibrate the reporter band to planner reality — the axis is an **operator decision surfaced at GATE A** (below).
2. **Voice-distribution reporter band.** The reporter band `count < 5 || count > 12` is hardcoded in BOTH twin files (`runXaiAdversarialBotCorpus.js:2148`, `xaiAdversarialReport.js:400`). It was tuned for a per-slot distribution the current per-bot-account planner never produces, so all 3 observed voices land out-of-band → YELLOW (`docs/testing-runs/2026-06-04-corpus-30-analysis.md:90`).
3. **Spine saturation reframe.** `assignSpineId(runId, threadIndex, moveIndex, prevSpine)` is already deterministic per `(runId, threadIndex, moveIndex)` with a `+1 mod SPINES.length` no-repeat-prior advance (`corpusPoolDrivenPlanner.js:286-291`); 9 spines spread 9/9 with run-wide max share 13% (under the 0.35 saturation threshold, `xaiAdversarialReport.js:323`). Its YELLOW is **only** the per-thread repeated-thread check (`repeatedWithin`, 16 threads) + 2 low-diversity windows (`docs/testing-runs/2026-06-04-corpus-30-analysis.md:89,121`). Reframe spine as **"stricter than voices" — a documented expectation, not a regression** — and decide whether the spine band needs any change at all.
4. **New deterministic test:** `__tests__/corpusVoiceAssignmentDiversity.test.ts`.

Out of scope (non-goals):

- **No corpus re-run.** The next operator-run corpus picks up the new assignment; Claude never triggers a run.
- **No Anthropic / xAI / X API call.** No Supabase write. No service-role. No direct insert into `public.arguments`.
- **No app/`src` change, no Edge Function source edit, no MCP server change, no migration, no DB write.**
- **No new voices added to the 8-voice catalogue** (`VOICES`, `corpusPoolDrivenPlannerConstants.js:22-31`) — catalogue expansion is a separate, larger call (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1020`).
- **No persona-prompt content change.** This card changes assignment + reporting, not persona text (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1021`).
- **No cross-room persona continuity** (a bot's voice consistent across multiple rooms). The operator explicitly chose per-room-role if axis (i) is taken (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1022`).
- **No band-widening to mask absent data.** §4-T binds (see HALT ceiling).

---

## Current production state

The corpus runner is dev-tooling under `scripts/bot-fixtures/`; there is no "production" surface here. The frozen-set and acceptance-gate invariants are unchanged by this card. State as observed at HEAD `37ccd9e`:

| Fact | Value | Cite |
|---|---|---|
| `assignVoiceId` key | `uintHash(`${runId}:voice:${botUserId}`) % VOICES.length` — `runId + botUserId` only; no threadIndex, no role | `corpusPoolDrivenPlanner.js:272` |
| `VOICES` catalogue | 8 entries (`empiricist`, `mechanism_hunter`, `definitions_lawyer`, `analogist`, `steelman_cutter`, `scope_narrower`, `systems_thinker`, `plain_skeptic`) | `corpusPoolDrivenPlannerConstants.js:22-31` |
| `assignSpineId` key | `uintHash(`${runId}:spine:${threadIndex}:${moveIndex}`) % SPINES.length`, then `+1 mod` if it equals `previousSpineId` | `corpusPoolDrivenPlanner.js:286-291` |
| `SPINES` catalogue | 9 entries (`quote-led` … `second-order-effect-led`) | `corpusPoolDrivenPlannerConstants.js:33-43` |
| Voice band (runner twin) | `if (count < 5 || count > 12) outOfBand.push(...)` | `runXaiAdversarialBotCorpus.js:2148` |
| Voice band (report twin) | identical `if (count < 5 || count > 12)` | `xaiAdversarialReport.js:400` |
| Voice severity | `yellow = collisions.length > 0 || outOfBand.length > 0` | `runXaiAdversarialBotCorpus.js:2150`; `xaiAdversarialReport.js:405` |
| `bot_assignment` event | carries `assignments[].{slot,alias,skillRole,skillHash,voiceId}` + `voiceIdByAlias`; `slot ∈ {provocateur, revocateur, synthesizer}` (3 personas) | `runXaiAdversarialBotCorpus.js:793-806` (slot at :800) |
| Voice call site | `assignVoiceId(runId, botA/B/C.userId)` — `threadIndex` and per-persona `slot/role` are BOTH in scope here | `runXaiAdversarialBotCorpus.js:748-756` |
| Spine saturation threshold | `v / totalMoves > 0.35` → saturated | `xaiAdversarialReport.js:323` |
| Spine YELLOW source | per-thread `repeatedWithin` (count ≥ 2) → yellow; cross-thread (≥ 3) → red | `xaiAdversarialReport.js:316-318,342` |
| Observed voices | 3 of 8 (`analogist`, `scope_narrower`, `plain_skeptic` — 30 each) | `docs/testing-runs/2026-06-04-corpus-30-analysis.md:99-103` |
| Observed spines | 9 of 9, max run-wide share 13%, all under 0.35 | `docs/testing-runs/2026-06-04-corpus-30-analysis.md:107-121` |
| Routing during the analyzed run | OFF (percentage dial at 0%) | `docs/testing-runs/2026-06-04-corpus-30-analysis.md:55-56` |
| Existing voice/spine determinism test | `__tests__/corpusPoolDrivenPlanner.voice-spine.test.ts` (6 tests) | file present |

---

## RCA / problem summary

The voice YELLOW is **structural, not a regression**: `assignVoiceId` is keyed on `runId + botUserId` (`corpusPoolDrivenPlanner.js:272`), so a fixed pool of 3 bot accounts produces exactly 3 voices for the whole run, each at count = 30 — and the reporter band `5..12` (`runXaiAdversarialBotCorpus.js:2148`, `xaiAdversarialReport.js:400`) was tuned for a per-slot distribution the planner never emits. Both observations (`out-of-band voices = 3`, `collisions = 0`) are correct telemetry of a working planner under a stale band (`docs/testing-runs/2026-06-04-corpus-30-analysis.md:90`). There is no bug in the planner; there is a mismatch between the assignment axis and the reporter's expectation.

The spine YELLOW is **a stricter-than-voices artifact, also not a regression**: spine assignment IS per-`(runId, threadIndex, moveIndex)` with no-repeat-prior (`corpusPoolDrivenPlanner.js:286-291`), the run-wide spread is healthy (9/9, max 13% — under 0.35), and YELLOW fires only on the per-thread `repeatedWithin` heuristic + 2 low-diversity windows (`xaiAdversarialReport.js:316-318`; `docs/testing-runs/2026-06-04-corpus-30-analysis.md:89,121`). With 9 spines × 10 moves per thread, some within-thread repeats are unavoidable by the pigeonhole principle — that is a documented expectation, not a defect.

---

## Why this is or is not a ceiling/limit

This is **not** a capacity/concurrency ceiling and has no relationship to the `#371`/`#373` provider-capacity supersession or the ARCH-001 Postgres async queue (recorded-rejected / chosen-path facts; not re-litigated here). It is a **reporter calibration + assignment-axis tuning** task in dev-tooling. The frozen set (H/I/J `productionEnabled:false`) is untouched; this card does not flip any family flag, arm routing, or raise any routing percentage. The only "limit" is intentional: the 8-voice / 9-spine catalogues are deliberately small (catalogue expansion is explicitly out of scope), and spine is structurally stricter than voice — both are documented expectations, not ceilings to break.

---

## Architecture options considered

The card spec elevates the **voice-assignment axis** to an operator decision at GATE A (do not decide alone). Three options:

### Option (i) — per-thread / per-room-role rotation inside the planner

Change `assignVoiceId` to key on `runId + threadIndex + role + botUserId` (operator-stated form, `SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:994,1009`), with a deterministic same-room collision-avoidance re-roll: if a room's assigned voices collide, extend the hash key with a salt counter and retry up to `K=8` before giving up (never falls back to non-determinism). The call site already has `threadIndex` + per-persona `slot/role` in scope (`runXaiAdversarialBotCorpus.js:748-756,800`), so no new instrumentation is needed.

- **Pro:** uses ≥ 6 of 8 voices across a 30-room run; persona continuity holds *within* a room (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1002-1003`).
- **Con:** **changes the determinism contract.** The signature/keying of `assignVoiceId` changes, so `corpusPoolDrivenPlanner.voice-spine.test.ts` and the `bot_assignment`/per-move `voiceId` stamping (`runXaiAdversarialBotCorpus.js:751-756,968`) shift. Any cross-run voice expectation breaks. The reporter band must still be recalibrated to the new per-slot count (60 role slots in a 2-role × 30-room run, or 90 if synthesizer counts — `SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1005`).

### Option (ii) — reporter-band recalibration to planner reality (axis unchanged)

Leave `assignVoiceId` keyed on `runId + botUserId`; recalibrate the reporter band to the expected count per voice ≈ N / botCount (e.g., with 3 bots over 30 scenarios, each voice's expected slot count is ~ moves/3). State the band as "expected ≈ N/botCount; YELLOW only on material deviation."

- **Pro:** zero determinism-contract change; smallest diff; honest telemetry — the band finally matches what the planner emits.
- **Con:** does NOT increase catalogue usage; a 3-bot run still uses only 3 voices (the band just stops calling it YELLOW). Does not satisfy the backlog's stated "uses ≥ 6 of 8 voices" outcome (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1002`) unless bot-pool size grows.

### Option (iii) — hybrid

Take axis (i) per-room-role rotation **and** recalibrate the band to the resulting per-slot count. This is the backlog's own remediation form (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1009-1010`): assignment refactor + band recalibrated to "≥ 6 distinct voices across the run AND ≤ 1 same-room collision per 10 rooms."

- **Pro:** satisfies both diversity AND honest-band goals.
- **Con:** largest diff; changes the determinism contract AND both reporter twins; most test churn.

### Operator sub-decision — synthesizer as its own voice slot (8 vs 9)

The `bot_assignment` event has 3 personas: `slot ∈ {provocateur, revocateur, synthesizer}` (`runXaiAdversarialBotCorpus.js:800`). The expected per-slot count differs by whether synthesizer counts as a voice-bearing role: 60 role slots if 2-role, 90 if synthesizer counts (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1005`). **This sub-decision belongs to the operator at GATE A** and changes both the band math and whether the synthesizer participates in the collision-avoidance pass.

---

## Chosen architecture

**Deferred to the operator at GATE A.** The card spec is explicit: surface the voice-assignment axis — (i) per-room-role rotation vs (ii) reporter-band recalibration vs (iii) hybrid — AND the synthesizer-slot question (8 vs 9) as an operator decision; do NOT decide alone. The design records the three options + their determinism-contract consequences above so the operator can choose at GATE A. The implementer implements the operator-selected axis only.

**Invariant binding all three options** (so the implementer cannot drift):

- The chosen axis MUST remain fully deterministic — same `(runId, …)` input → same output, twice (enforced by the new test + the existing `voice-spine.test.ts`).
- No `Math.random`, no wall-clock, no env-dependent branch in assignment.
- The per-move `voiceId` + `spineId` MUST stay emitted on every `move_rendered` / `bot_assignment` event so the reporter observability contract (`CORPUS-30-POOL-DRIVEN-PLANNER.md` — "voiceId must remain emitted per move", `SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1029`) is preserved.
- Any band change MUST emit `n/a` (never `green`) when the underlying sample is empty (the green-on-empty HALT trigger; §4-T).
- **Spine is reframed, not silently re-banded:** the reporter's spine-saturation YELLOW is documented as "spines are stricter than voices — within-thread repeats are expected by pigeonhole; this is not a planner regression" (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1004,1011`). The implementer decides at GATE A whether spine needs any band change at all or ships voice-only and opens a `CORPUS-SPINE-CATALOG-EXPANSION` follow-up (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1037`).

---

## §9-reporter twin-file collision (load-bearing — depends on #467)

The voice-distribution + samey-move + spine-saturation logic exists in **DUPLICATE** across two files that #467 and #468 both edit:

- `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js` — live-run report assembly (`checkVoiceDistribution` ~:2128-2156; `checkSameyMove` ~:2158).
- `scripts/bot-fixtures/xaiAdversarialReport.js` — the report twin (`voiceDistributionFromEvents` :385-407; `sameyMoveFromEvents` :409; `spineSaturation` :320-325,344).

Both #467 (CORPUS-30-QUALITY-001 — fallback histogram + samey-move fix + thresholds) and #468 (this card — voice band) rewrite the same §9 reporter section in BOTH twins. **#467 lands first** (card spec; sprint DAG places DIVERSITY after QUALITY, `SPRINT-CORPUS30-ADMIN-HIJ-BACKLOG.md:99`). Sequencing requirement, stated explicitly:

1. #467 merges first — it adds the fallback-reason histogram and fixes the samey-move green-on-empty defect in both twins.
2. #468 rebases on the post-#467 §9 structure and changes the **voice-distribution band** (and any spine reframe) in both twins.
3. Any band/metric change MUST be applied to BOTH twins identically, or the live-run report path and the offline report path diverge.

Note: the backlog card body for #468 optimistically says "Dependencies: None hard … can run in parallel" (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1031-1033`). That is superseded by the twin-file reality the Phase 0 inventory confirmed — the two cards DO collide on the shared §9 reporter section, so #467 lands first and #468 rebases. This refinement is the load-bearing correction this design records.

---

## Data model

None. No DB, no migration, no schema change. The only "data" is the in-memory `bot_assignment` event shape (`runXaiAdversarialBotCorpus.js:793-806`) and the gitignored JSONL the reporter reads — both pre-existing. Voice/spine ids are structural strings from frozen catalogues; no truth/popularity/person-label tokens appear in any id (`corpusPoolDrivenPlannerConstants.js:17-19`).

## Worker/drainer model

Not applicable. This card does not touch the classifier queue, the drainer, or any worker. (ARCH-001 drainer facts are out of scope and not re-litigated.)

---

## Liveness and observability

- The voice/spine ids must keep flowing on every per-move event (`move_rendered` / `move_validated` / `bot_assignment`) so the reporter can recompute distributions — this is the existing observability contract and must not regress.
- The reporter's voice-distribution + spine-saturation sections render a `severityBand` (`green`/`yellow`/`red`/`n/a`). The `n/a` path is the green-on-empty backstop: when no `bot_assignment` events carry `voiceId`, the band reads `n/a` and never `green` (the same posture already used by `repeatedOption`/`spineSaturation` at `xaiAdversarialReport.js:331-349`). The new voice band MUST adopt the same `attribution_absent → n/a` posture.
- No new telemetry instrumentation is needed for axis (i): `threadIndex` + `slot/role` are already in scope at the `assignVoiceId` call site (`runXaiAdversarialBotCorpus.js:748-756,800`).

---

## Cutover and rollback path

- **Cutover:** merge to `main`. Dev-tooling only (`scripts/bot-fixtures/**` + `__tests__/**`). The next operator-run corpus picks up the new assignment/band. No deploy, no migration, no Edge Function redeploy — `supabase/functions/**` and `supabase/migrations/**` are untouched, so merge ≠ deploy (pipeline-governance-contract §5).
- **Rollback:** `git revert` of the single squash-merge commit. No state to unwind — no DB rows written, no corpus re-run triggered by Claude, no flag flipped. The previous voice band + assignment keying are restored by the revert.

---

## Smoke plan

No live provider call, no Supabase write, no corpus run by Claude. "Smoke" here is the local gate trilogy plus a determinism + green-on-empty regression check:

1. `npm run typecheck` → exit 0.
2. `npm run lint` → exit 0 (recall: `.claude-tmp/*.ts` scratch can trip lint — keep scratch as `.txt`; no stray `.ts`).
3. `npm run test` → exit 0; capture the `Test Suites: X passed / Tests: Y passed` line + exit code (test-discipline: tailed output is not a green gate).
4. The new `corpusVoiceAssignmentDiversity.test.ts` asserts, on a synthetic 30-room input: (a) the chosen-axis distribution hits the operator-selected diversity target (e.g., ≥ 6 voices for axis (i)/(iii); or the recalibrated band passes for axis (ii)); (b) same input → same assignment, twice (determinism); (c) no same-room collision when N-roles ≤ N-voices; (d) the band reads `n/a` (never `green`) on an empty `bot_assignment` stream.
5. Confirm the band change is byte-identical across both twin files (`runXaiAdversarialBotCorpus.js` + `xaiAdversarialReport.js`) — divergence is a defect.

---

## Open questions

1. **OPERATOR (GATE A):** which voice-assignment axis — (i) per-room-role rotation (changes determinism contract), (ii) reporter-band recalibration to planner reality (expected ≈ N/botCount), or (iii) hybrid? Default per backlog remediation is (iii) but the card spec forbids deciding alone.
2. **OPERATOR (GATE A):** does the synthesizer count as its own voice-bearing slot (8-voice math over 60 role slots vs 9-voice/90)? This changes the band math and the collision-avoidance pass (`runXaiAdversarialBotCorpus.js:800`; `SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1005`).
3. **OPERATOR (GATE A):** does spine need any band change, or is the "stricter than voices" documentation sufficient (ship voice-only + open `CORPUS-SPINE-CATALOG-EXPANSION`)? (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1037`).
4. Exact recalibrated band thresholds for the chosen axis are operator-confirmed at GATE A; the design records the backlog's proposed "≥ 6 distinct voices AND ≤ 1 same-room collision per 10 rooms" (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1010`) as the candidate, not as decided.
5. If axis (i)/(iii) is chosen, the `K=8` collision-re-roll cap and the salt-counter key form are the backlog's proposal (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1009`); confirm the exact hash-key string at implement time so it stays deterministic and collision-free for N-roles ≤ N-voices.

---

## Stage gates before implementation

Per pipeline-governance-contract §2 (Phase 0 → DESIGN → GATE A → IMPLEMENT → GATE B → REVIEW → GATE C):

- **GATE A (operator):** approve the voice-assignment axis (i/ii/iii) + the synthesizer-slot decision (8 vs 9) + the spine reframe disposition. The implementer does NOT pick the axis. Confirm #467 has merged (twin-file dependency).
- **GATE B:** committed diff + green `typecheck`/`lint`/`test` including the green-on-empty regression guard and the determinism assertion; band change byte-identical across both twins.
- **REVIEW:** roadmap-reviewer re-runs the gate trilogy, confirms determinism, confirms no app/`src`/DB/Edge/MCP/migration change, confirms no frozen-flag flip.
- **GATE C:** autonomous green squash-merge permitted (dev-tooling only; auto-merge-eligible). **Never-self-approve (§4-C / §4-T):** Claude never triggers a corpus run, never calls Anthropic/xAI/X, never deploys, never widens a band to hide absent data.

---

## Commit-slice plan

Single PR (small, dev-tooling). Suggested commit slices inside it:

1. **Slice 1 — assignment axis (operator-selected).** Implement the GATE-A-chosen axis in `corpusPoolDrivenPlanner.js` (axis (i)/(iii)) or leave assignment unchanged (axis (ii)). Keep determinism; no `Math.random`.
2. **Slice 2 — reporter band recalibration in both twins.** Apply the recalibrated voice band identically to `runXaiAdversarialBotCorpus.js` + `xaiAdversarialReport.js`; add the `attribution_absent → n/a` posture for the voice band; reframe/adjust the spine band per GATE A.
3. **Slice 3 — tests.** `__tests__/corpusVoiceAssignmentDiversity.test.ts` (+ any determinism/band assertions). Update `corpusPoolDrivenPlanner.voice-spine.test.ts` ONLY if axis (i)/(iii) changes the assignment signature (and only to reflect the new deterministic contract — never to weaken an assertion).
4. **Slice 4 — current-status manifest update.** Record the new test count after a captured green run.

---

## Test-count forecast

Baseline (test-discipline): **630 suites / 19263 passing / 1 skipped / 19264 total** on main.

- NEW: `__tests__/corpusVoiceAssignmentDiversity.test.ts` — ~6-10 cases (determinism, ≥6-voice / recalibrated-band target, no same-room collision when N-roles ≤ N-voices, `n/a`-on-empty green-on-empty guard, synthesizer-slot math per GATE A).
- POSSIBLY MODIFIED: `corpusPoolDrivenPlanner.voice-spine.test.ts` — only if axis (i)/(iii) changes the assignment keying (assertions updated to the new deterministic contract; count net-neutral or up).
- Forecast: **+1 suite, +6 to +10 tests**, net non-decreasing. Exact count captured from a green `npm run test` line + exit code before the current-status update (no count claimed from tailed output).

---

## HALT ceiling

HALT and surface to the operator if any of the following becomes true:

- A proposed band can read **`green` on empty data** (the "samey-move incident" repeated). Empty samples MUST read `n/a`, never `green` (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:974`; §4-T no-bar-lowering).
- The fix requires touching `app/`, `src/`, any Edge Function source, the MCP server, a migration, or any DB write — that exits the dev-tooling lane and is NOT this card.
- The fix would flip any `productionEnabled` flag (H/I/J stay `false`), arm routing, or raise any routing percentage.
- Spine cannot be tuned without re-architecting the catalogue — ship voice-only and open `CORPUS-SPINE-CATALOG-EXPANSION` instead of forcing a spine change (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1037`).
- The voice-distribution band change cannot be made byte-identical across both twins.

---

## Current-status manifest stub

```
MODIFIED:
  scripts/bot-fixtures/corpusPoolDrivenPlanner.js          (axis i/iii only; unchanged for axis ii)
  scripts/bot-fixtures/runXaiAdversarialBotCorpus.js       (voice band recalibration — twin 1)
  scripts/bot-fixtures/xaiAdversarialReport.js             (voice band recalibration — twin 2; identical to twin 1)
  __tests__/corpusPoolDrivenPlanner.voice-spine.test.ts    (ONLY if axis i/iii changes assignment keying)
NEW:
  __tests__/corpusVoiceAssignmentDiversity.test.ts
BYTE-EQUAL preserved:
  scripts/bot-fixtures/corpusPoolDrivenPlannerConstants.js (VOICES/SPINES catalogues untouched)
  supabase/functions/**                                    (no Edge change → merge ≠ deploy)
  supabase/migrations/**                                   (no migration)
  src/lib/constitution/engine.ts                           (sole gate, untouched)
  supabase/functions/_shared/booleanObservations/familyRegistry.ts:106/111/116 — H/I/J productionEnabled:false (frozen set untouched)
TEST DELTAS:
  +1 suite, +6..+10 tests (captured from a green run before status update)
OPERATOR FOLLOW-UP:
  GATE A: pick voice axis (i/ii/iii) + synthesizer-slot (8 vs 9) + spine disposition.
  Confirm #467 merged before this PR (twin-file dependency).
  Operator runs the next corpus to pick up the new assignment (Claude never triggers it).
DISCIPLINE LINE:
  NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO service-role. NO migration.
  NO Edge Function source edit. NO MCP server change. NO corpus re-run. NO direct insert into public.arguments.
  Deterministic. No green-on-empty band. Frozen set untouched.
```

---

## Required-reading manifest for the later build phase

1. `scripts/bot-fixtures/corpusPoolDrivenPlanner.js:263-292` — `assignVoiceId` / `assignSpineId` (the assignment to change for axis i/iii).
2. `scripts/bot-fixtures/corpusPoolDrivenPlannerConstants.js:22-43` — frozen `VOICES` (8) / `SPINES` (9) catalogues (do NOT expand).
3. `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js:748-806` — voice call site + `bot_assignment` event (`slot` incl. `synthesizer` at :800).
4. `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js:2128-2156` — `checkVoiceDistribution` (twin 1 band).
5. `scripts/bot-fixtures/xaiAdversarialReport.js:300-407` — `voiceDistributionFromEvents` (twin 2 band) + `spineSaturation` + `repeatedOption` (the `attribution_absent → n/a` posture to mirror).
6. `__tests__/corpusPoolDrivenPlanner.voice-spine.test.ts` — existing determinism contract.
7. `docs/testing-runs/2026-06-04-corpus-30-analysis.md:89-121` — observed voice (3/8) + spine (9/9) telemetry + YELLOW rationale.
8. `docs/designs/SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:981-1051` — the #468 card body + operator-stated remediation + acceptance criteria.
9. `docs/designs/CORPUS-30-POOL-DRIVEN-PLANNER.md` — observability invariants (voiceId emitted per move).
10. `.claude/skills/cdiscourse-doctrine` (§1, §3, §4-C, §4-T, §5) + `.claude/skills/test-discipline` + `docs/core/pipeline-governance-contract.md` (§2, §4, §5).
11. #467 (CORPUS-30-QUALITY-001) merged diff — the post-#467 §9 reporter structure to rebase on.

---

## Doctrine compliance

- **§1 no truth labels / §3 popularity-not-evidence:** voice/spine ids are structural metadata; no id or band label is a verdict, person-label, or popularity signal (`corpusPoolDrivenPlannerConstants.js:17-19`). Diversity/band counts are mechanism metrics, never standing/truth claims.
- **§4 AI moderator advisory-only / acceptance-gate invariant:** unaffected — this card touches only the bot-fixture runner + reporter, never `submit-argument`/classifier/queue/routing/`engine.ts`. The verbatim invariant is stated above.
- **§4-C never-self-approve / §4-T no bar-lowering:** the band MUST NOT be widened to hide absent data; green-on-empty is a HALT. No frozen-flag flip.
- **§5 engine.ts sole gate:** untouched.
- **§6 secrets / §7 no AI from production app:** no secret printed; the corpus runner's Anthropic/xAI paths are operator-gated under `scripts/bot-fixtures/` and are NOT invoked by this card.
- **§8 / §9 / §10a:** no migration, no user-facing string, no node-label change.
