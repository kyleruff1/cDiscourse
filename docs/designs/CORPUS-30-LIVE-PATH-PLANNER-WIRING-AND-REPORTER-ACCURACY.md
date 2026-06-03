# CORPUS-30-LIVE-PATH-PLANNER-WIRING-AND-REPORTER-ACCURACY — design (2026-06-03)

> **Status:** DESIGN ONLY. No production code, no runtime change, no test runs, no provider calls, no Supabase mutation. Stops at **GATE A** for operator design review.
>
> **Card chain:** `CORPUS-30-POOL-DRIVEN-PLANNER` (merged at #456) → `CORPUS-30-DRY-STAGE-RUNBOOK` (#457) → `CORPUS-30-TINY-STAGE-RUNBOOK` (#458) → tiny stage fired (runId `0d507a4c`, runTag `corpus-prod-synthetic-20260603-1621-0d507a4c`) → this card scopes the bugs that tiny surfaced.
>
> **Origin:** the tiny run posted 18 arguments to pre-launch prod synthetic successfully, but exposed three technical gaps in the merged PR #456 implementation that have to land before the 30 stage produces useful evidence. The hostile-source / classification policy is **explicitly out of scope** (settled operator decision: "we're not in the business of censorship; the truth will self-heal misinformation").
>
> **Governance:** runs under `docs/core/pipeline-governance-contract.md` v1. §3 HALT conditions + §4 never-self-approve apply. Pre-launch prod synthetic only — not dev, not organic, not ramp evidence.

> **Acceptance-gate invariant (unchanged):** AI/MCP classifiers are never the submission acceptance gate. The pure rules engine remains the sole gate. Classifiers run after a post is stored. This card changes no code in `src/lib/constitution/engine.ts` and no submission gating.

---

## 1. Why this card exists (with file:line evidence from runId `0d507a4c`)

The tiny stage exercised PR #456 end-to-end against pre-launch prod synthetic. 3 debates inserted, 18 arguments posted, runTag in the new format, no boundary leaks, no service-role usage. The 30 stage is **not blocked on policy** — it's blocked on three technical gaps that make the planner work invisible and the reporter's "all-green" verdict spurious:

### Gap 1: live-path planner not wired

`scripts/bot-fixtures/runXaiAdversarialBotCorpus.js` calls `seedAssignment` (the seed-pool layer) but **does not** carry per-move attribution through to `move_validated` events on the live path. Evidence from the tiny-run JSONL (`logs/engagement-intelligence/2026-06-03T16-21-44-263Z-0d507a4c-xai-adversarial-semantic-corpus.jsonl`):

```
bankName occurrences:    0   (expected: 18, one per move)
optionIndex occurrences: 0   (expected: 18)
spineId occurrences:     0   (expected: 18)
voiceId occurrences:     3   (only inside scenario_build.botAssignment.voiceIdByAlias;
                              NOT on bot_assignment events; NOT on move_validated)
seedId occurrences:      9   (3 scenarios × {seed_assignment, scenario_build, room_summary})
threadIndex occurrences: 3   (scenario_build only; absent from move_validated)
optionId occurrences:    0
```

`seed_assignment` event (planner top-level) fires correctly:
```json
{"stage":"seed_assignment","runTag":"corpus-prod-synthetic-20260603-1621-0d507a4c",
 "requested":3,"eligible":5,"total":5,
 "assignedSeedIds":["42583d37e44133fe","1b5494fb95d0f6bf","66830e8c47948aff"]}
```

But `move_validated` carries **only** `runId · ts · stage · sourceMode · skillGate · scenarioId · moveId · validated · issues · seed · keywordRelaxationApplied`. None of the planner's per-move fields. The runner's live-path move loop is still the legacy free-form Anthropic continuation, not the planner-aware `renderAlignedAdversarialMove` path the design (`CORPUS-30-POOL-DRIVEN-PLANNER.md` §7.3) specified.

This is functionally a partial integration: PR #456 wired the planner's seed-layer into `runXaiAdversarialBotCorpus.js` live path, but the option/voice/spine layers stayed in the dry-mode branch only.

### Gap 2: §9 reporter computing greens on absent data

The tiny-run Markdown (`docs/testing-runs/2026-06-03-xai-adversarial-bot-corpus.md` line 46-50) emits:

```
- Duplicate-seed: severityBand=`green` · total=3 · unique=3 · duplicates=0
- Repeated-option (within thread): severityBand=`green` · repeated within=0 · cross-thread collisions=0
- Spine saturation: severityBand=`green` · repeated-threads=0 · low-diversity windows=0
- Voice distribution: severityBand=`green` · collisions=0 · out-of-band voices=0
- Samey-move (text distance): severityBand=`green` · high-overlap pairs=0 · overall mean=0 · max intra-thread mean=0
```

Only **duplicate-seed** has real data behind it (3 unique seedIds from `assignedSeedIds`). The other four are greens by **absence of attribution**: no bankName/optionIndex emitted → no repeated bankName/optionIndex → green. No spineId → no spine saturation → green. No voiceId on moves → no out-of-band voice → green. The samey-move `mean=0` / `max=0` is suspicious — possibly the reporter isn't computing on body text at all, given the runner's JSONL stripped bodies from `move_validated`.

A green reporter signal that's mechanically derivable from `count == 0` is a metric-honesty bug. **30 with this reporter would emit five greens regardless of run quality.**

### Gap 3: Markdown summary contradicts observed reality

Same Markdown file, "Run counts" section:

```
- xAI calls: (not wired in this commit)
- Anthropic calls: (not wired in this commit)
- Supabase writes: 0
```

But:
- The harvest at Step 1 made live xAI X-Search calls (mode=live, sources=5, 2 usable + 3 synthetic fallback — confirmed in `logs/engagement-intelligence/2026-06-03T16-18-50-141Z-d292664b-xai-adversarial-harvest.jsonl`).
- The bot fixture made 9 real Anthropic calls (`source:"anthropic"` count on `move_rendered` = 9 of 18).
- 18 arguments + 3 debates + 6 participants = **27 Supabase writes** under the bot RLS, confirmed by DB query (`SELECT count(*) FROM public.arguments WHERE debate_id IN (... WHERE title LIKE '%<runTag>%')` → 18).

The committable summary is therefore an inaccurate record of what the run actually did. 30 with this summary would produce a doc that says "Supabase writes: 0" while having posted 180 arguments — a credibility problem for any later operator reading it.

---

## 2. Explicitly OUT of scope (settled operator policy)

To be explicit about what this card does **not** change, so the implementer can't drift into it:

- **The dissent-detector classification thresholds.** The current `xaiDissentDetector` lets argument-bearing-but-hostile content through as a "usable dissent." That's the policy: hostile rhetoric is **input** for the bot adversarial process; the bots convert it through structured pressure into source-chain/scope/mechanism challenges; truth self-heals through argument. CDiscourse's product hypothesis. No classifier-tightening pivot here.
- **Move-level re-redaction on `source:xai_seed` bodies.** Same reason — M1/M2 are theses being argued, not bot endorsements. Harvester identifier-stripping (handles/URLs/IDs/JWTs/bearers/emails) stays; semantic redaction of "controversial content" does not get added.
- **Soft-deleting the existing tiny-run rows (`corpus-prod-synthetic-20260603-1621-0d507a4c`).** They stay. "Fresh start = filtered view" doctrine (operator skill §49). They demonstrate the product working as designed — bots converting hostile rhetoric to structured pressure.
- **`submit-argument` validator hardening.** No new ban-list or new validator gate. The acceptance-gate invariant stays as-is.

This card is a **wiring and reporter-accuracy** card. Nothing more.

---

## 3. Required reading (the inputs this design honors)

- `docs/designs/CORPUS-30-POOL-DRIVEN-PLANNER.md` — §4 pool schema, §5 seedAssignment, §6 selectOption, §7 voice/spine separation, §7.3 move-renderer binding props, §8 attribution fields, §9 reporter checks.
- `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js` — the dry-mode branch wires the planner; the live-mode branch around the move loop is where the wiring needs to land.
- `scripts/bot-fixtures/xaiAdversarialMoveRenderer.js` — `renderAlignedAdversarialMove` exists; it just isn't called on the live path.
- `scripts/bot-fixtures/corpusPoolDrivenPlanner.js` — `selectOption` + per-thread `usedOptions` Set + `bank_exhausted_reset` already implemented.
- `scripts/bot-fixtures/xaiAdversarialReport.js` + `scripts/engagement-intelligence/xaiAdversarialCorpusReport.js` — §9 check emitters need an "attribution-absent" fallback severity.
- Tiny-run evidence: the JSONL + Markdown paths cited in §1.

---

## 4. The three fixes (each scoped tight)

### Fix 1 — wire the per-move planner into the live path of `runXaiAdversarialBotCorpus.js`

For every move M1..M(maxDepth) inside each scenario, the live-mode move loop must:

1. **Compute `(bankName, optionIndex)` via `MOVE_PLAN` + `selectOption`.** Already implemented; just not called on the live path. Use the per-thread `usedOptionsForThread` Map state across the scenario.
2. **Assign `voiceId` per bot at `bot_assignment`** via `assignVoiceId(runId, botUserId)` — stamp it on the bot_assignment event (not only inside `voiceIdByAlias` on `scenario_build`). Lift the per-bot voiceId so it's accessible to every subsequent `move_validated`.
3. **Assign `spineId` per move** via `assignSpineId(runId, threadIndex, moveIndex, previousSpineId)` with the no-repeat-prior constraint.
4. **Call `renderAlignedAdversarialMove({ selectedOption, voiceId, spineId, attribution, ...existing })`** instead of the legacy renderer. The aligned renderer is already implemented in `xaiAdversarialMoveRenderer.js`; the live path just needs to call it with the binding props instead of the legacy free-form path.
5. **Emit attribution fields on every `move_validated` event:** `runId · runTag · seedId · threadIndex · role · moveIndex · bankName · optionIndex · optionId · voiceId · spineId · attribution`.
6. **Preserve all existing fallback behavior** — Anthropic call → validation → one retry → `deterministic_fallback` is unchanged; the new aligned validators (option-alignment, spine-alignment) layer on top, with the same retry/fallback policy.

**Anti-goal:** do not change the existing dry-mode path. The dry-mode integration works; mirror its planner-call shape into the live-mode branch.

### Fix 2 — §9 reporter computes on real data OR emits N/A when attribution absent

Each of the five §9 checks needs an **attribution-presence precondition**:

- **Repeated-option (within thread)**: if `move_validated` events lack `bankName` AND `optionIndex` on ≥1 move in the run → emit `severityBand: n/a · reason: "attribution_absent"` instead of green.
- **Spine saturation**: same — if `spineId` absent on ≥1 move → `severityBand: n/a`.
- **Voice distribution**: if `voiceId` absent on `bot_assignment` events → `n/a`.
- **Samey-move (text distance)**: needs a body source. The runner today strips body from `move_validated`. Two options for the implementer to pick:
  - **(a)** Have the runner emit a separate `move_body_sample` JSONL event carrying a hash + a normalized token-set per move (no raw body in committable docs; the gitignored JSONL carries the source-of-truth). The reporter computes Jaccard on the token-sets.
  - **(b)** The reporter reads `submit_result.body` (if present) and falls back to N/A if absent. Need to confirm whether the runner emits `submit_result.body` on the live path.

Recommendation: **(a)** — keeps body OUT of committable Markdown by construction; the reporter only ever sees the token-set hash.

- **Duplicate-seed**: already works correctly (operates on `seed_assignment.assignedSeedIds`); no change.

**A green can only be emitted when the underlying metric is computable from non-zero input.** A zero count where the data was absent is `n/a`, not `green`.

### Fix 3 — Markdown summary tracks actual xAI / Anthropic / Supabase counts

Two paths:

1. **Tally JSONL events on emit.** Maintain a small counter object in the runner that increments on each provider call + each Supabase write, then write the final counts into `run_summary` and the Markdown.
2. **Aggregate at report time.** The reporter reads the JSONL and counts:
   - `xai_*` events with a non-zero http-status → xAI call count.
   - `anthropic_*` / `move_rendered` events with `source:"anthropic"` → Anthropic call count.
   - `submit_result` events with `status:"posted"` → Supabase write count (plus 1 per `debate_inserted` + 1 per `participant_inserted` if those events exist).

Recommendation: **both.** The runner emits a `provider_call_summary` event right before `run_summary`. The Markdown reads that summary. Belt and suspenders; the Markdown stops lying when the runner crashes mid-flight (the counter is what got emitted).

The current Markdown disclaimer text ("(not wired in this commit)") gets removed entirely. Replaced with real counts or, if the count is genuinely zero, the literal `0`.

---

## 5. File changes (paths + nature; no code yet)

### Modified (additive — no behavior regression)

- **`scripts/bot-fixtures/runXaiAdversarialBotCorpus.js`** — wire planner into the live-mode move loop per Fix 1. Emit attribution on `move_validated`. Emit per-bot `voiceId` on `bot_assignment`. Add a `provider_call_summary` event before `run_summary`. ~+200 lines.
- **`scripts/bot-fixtures/xaiAdversarialReport.js`** — extend each §9 check with the attribution-presence precondition per Fix 2. Add the body-token-set computation if going with option (a). ~+80 lines.
- **`scripts/engagement-intelligence/xaiAdversarialCorpusReport.js`** — same precondition logic for the corpus-level reporter. ~+40 lines.
- **`scripts/bot-fixtures/xaiAdversarialMoveRenderer.js`** — likely no change needed; `renderAlignedAdversarialMove` already exists. Verify only.
- **`scripts/bot-fixtures/corpusPoolDrivenPlanner.js`** — no change; this module already works correctly in dry. Verify only.

### Not modified

- **`xaiAdversarialSourceHarvest.js`** — out of scope; the harvester works.
- **`xaiAdversarialOptionBankBuilder.js`** — out of scope; the builder works (5/5 eligible on the tiny harvest).
- **`xaiDissentDetector.js`** — **out of scope (operator policy: no classifier tightening).**
- **`xaiSourceRedactor.js`** — **out of scope (operator policy: no semantic redaction added).**
- **`supabase/functions/submit-argument/`** — out of scope; validator stays as is.
- **3 SKILL.md files** — out of scope.
- **`mcp-server/**`, `supabase/migrations/**`, `package.json`, `package-lock.json`, `familyRegistry.ts`, `src/lib/constitution/engine.ts`, `src/features/**`** — all out of scope.

---

## 6. Test plan (added under `__tests__/`)

| Test | Asserts |
|---|---|
| `runXaiAdversarialBotCorpus.live-path-attribution.test.ts` | Live-mode subprocess test (using the dry-fixture banked pool) emits `move_validated` events with all 11 attribution fields (runId · runTag · seedId · threadIndex · role · moveIndex · bankName · optionIndex · optionId · voiceId · spineId · attribution). No live provider call. |
| `runXaiAdversarialBotCorpus.live-path-voice-stamp.test.ts` | `bot_assignment` events carry the resolved `voiceId` (not just inside `voiceIdByAlias`). |
| `runXaiAdversarialBotCorpus.live-path-aligned-renderer.test.ts` | Live-mode calls `renderAlignedAdversarialMove` (mock the renderer to verify the call signature includes `selectedOption`/`voiceId`/`spineId`). Existing fallback behavior preserved. |
| `xaiAdversarialReport.attribution-absent-na.test.ts` | When `move_validated` events lack `bankName`/`optionIndex`/`spineId`/`voiceId`, each §9 check emits `severityBand: n/a · reason: "attribution_absent"` — NOT green. |
| `xaiAdversarialReport.samey-move-token-set.test.ts` | The samey-move check operates on hashed token-sets from a `move_body_sample` JSONL event. Reporter never sees raw body. |
| `xaiAdversarialReport.provider-call-tally.test.ts` | Markdown summary's "Run counts" section reports actual xAI / Anthropic / Supabase counts when the JSONL contains the events (no "(not wired)" disclaimers). |
| `runXaiAdversarialBotCorpus.provider-call-summary.test.ts` | Runner emits `provider_call_summary` event before `run_summary` with `xaiCalls`, `anthropicCalls`, `supabaseWrites` fields. |

Target test delta: **+25 to +45 tests**. Baseline: 614 suites / 19056 tests.

---

## 7. Verification stages (CLAUDE never executes; operator runs each)

| Stage | Command | What Claude verifies (read-only) |
|---|---|---|
| **Dry re-validate** | `node scripts/bot-fixtures/runXaiAdversarialBotCorpus.js --dry --scenarios 2 --max-depth 6 --banked-pool <existing-pool>` | Dry mode still emits full attribution (regression guard); reporter §9 still green-on-real-data |
| **Tiny re-run (live, small)** | `node scripts/bot-fixtures/runXaiAdversarialBotCorpus.js --pilot --scenarios 3 --max-depth 6 --banked-pool <fresh-pool> --run-kind corpus-prod-synthetic` | **Live mode now emits the same 11 attribution fields the dry mode does.** Reporter §9 emits real greens (or honest n/a with explanation), not absent-data greens. Markdown summary reports real xAI / Anthropic / Supabase counts. Then visual review per the tiny runbook §7 — bots argue the seed coherently with diverse voices/spines now visibly attributed. |
| **30** | Per the 30 runbook (next session) | Same checks at 30-thread scale. Spine saturation across 180 moves should land within band; voice distribution should hit the 5-10-per-voice target. |

The next live run uses the same tiny runbook procedure but against the **fixed** runner. The 18 existing rows from `corpus-prod-synthetic-20260603-1621-0d507a4c` stay where they are (per operator policy).

---

## 8. Hard boundaries (binding)

- **No xAI / Anthropic / X / Supabase / classifier call** in this card's implementation (design only).
- **No service-role usage. No direct insert/update/delete in `public.arguments`. No migration.**
- **No queue routing arm. No 5%. No H/I/J flip.**
- **No skill .md edit. No `package.json` edit. No new npm aliases.**
- **No dissent-detector tightening, no semantic redaction added, no submit-argument validator change** (operator policy: truth self-heals through structured argument; no censorship pivot).
- **No deletion of the existing tiny-run rows.**

---

## 9. Open questions for the operator (GATE A)

1. **Fix 2 samey-move source** — option (a) `move_body_sample` event with hashed token-sets, OR option (b) reporter reads `submit_result.body` with N/A fallback? Recommendation: **(a)** for the body-out-of-Markdown-by-construction property.
2. **N/A severity vs new RED severity** when attribution is absent? Recommendation: **`n/a` with explanatory `reason` string.** A red would imply "run is bad"; the run might just be older and not yet have attribution data — `n/a` is more accurate. The 30-runbook can require all five checks `severityBand ∈ {green}` (rejecting both yellow and n/a) to PASS.
3. **Counter-tally vs read-time aggregation** for Fix 3 — recommendation: **both**, per §4 above.

---

## 10. Risks

- **R1: Live-path move loop is structurally different enough from dry that mirroring isn't a simple branch fold.** Mitigation: implementer reads dry-mode wiring first, isolates the differences, names them. If the dry/live divergence is structural (e.g. dry uses a synchronous fake renderer; live uses an async Anthropic call), the abstraction lives at the renderer-input layer (which is exactly what `renderAlignedAdversarialMove` is). The fix should still be additive.
- **R2: `voiceId` is currently inside `scenario_build.botAssignment.voiceIdByAlias` keyed by alias.** Lifting it to `bot_assignment.voiceId` per-bot means deciding on a clear mapping from `(alias, scenarioId) → voiceId`. The planner's `assignVoiceId(runId, botUserId)` exists; this is just plumbing.
- **R3: `move_body_sample` JSONL event adds data weight.** Mitigation: token-set hashes are ≤32 hex chars; per-move overhead is small; the event is gitignored anyway.
- **R4: A genuine green that gets re-classified as n/a after the fix could read as a regression.** Mitigation: name this explicitly in the implementation card's PR body — "n/a after this fix is the new honest signal; the prior all-green was spurious."
- **R5: The 18 rows in prod synthetic remain as they are.** Operator-acknowledged; no Claude action needed. The runTag prefix isolates them.

---

## 11. Acceptance criteria (implementation card)

The implementation card (`CORPUS-30-LIVE-PATH-PLANNER-WIRING-AND-REPORTER-ACCURACY-IMPLEMENTATION`) is done when:

1. All §5 file changes land additively; no behavior regression on existing dry-mode tests.
2. Test count strictly increases (target +25 to +45); zero new `.skip`/`.only`.
3. `npm run typecheck` / `lint` / `test` all EXIT 0.
4. A subprocess test of the live-mode move loop (mocking the Anthropic call) emits all 11 attribution fields on every `move_validated`.
5. Reporter test confirms `severityBand: n/a` (with `reason: "attribution_absent"`) on a JSONL that lacks attribution; AND real greens on a JSONL that has attribution.
6. Reporter Markdown emits real `xaiCalls` / `anthropicCalls` / `supabaseWrites` integers (no "(not wired)" disclaimers).
7. Secret/leak scan clean. No raw body in committable Markdown summary.
8. `mcp-server/**`, `supabase/**`, `package.json`, `package-lock.json`, `familyRegistry.ts`, `engine.ts`, the 3 SKILL.md files, `xaiDissentDetector.js`, `xaiSourceRedactor.js`, and `submit-argument` are byte-equal pre/post.
9. PR opens at **GATE B**. Per §5 of the governance contract this is a non-deploy, no-§4-surface, dev-tooling-only change → auto-merge-eligible on green if the card explicitly allows it.

---

## 12. Sequencing (after GATE A approval)

```
GATE A (this card) → operator confirms §9 open questions
       ↓
IMPLEMENTATION card → §5 file changes + §6 tests, PR
       ↓
GATE B (operator reviews diff + gates)
       ↓
GATE C (operator merge decision; auto-merge eligible per §5)
       ↓
Dry re-validate (operator runs the dry path against the fixed runner;
   Claude verifies attribution + honest reporter signals)
       ↓
Tiny re-run (operator runs --pilot --scenarios 3 against pre-launch prod synthetic;
   Claude reads the new JSONL; the §9 checks now compute on real data;
   the Markdown summary tracks real counts)
       ↓
Visual review + decision on 30
```

The existing `corpus-prod-synthetic-20260603-1621-0d507a4c` rows are not touched. A new runTag (`corpus-prod-synthetic-<later-YYYYMMDD-HHMM>-<8hex>`) tags the next tiny.
