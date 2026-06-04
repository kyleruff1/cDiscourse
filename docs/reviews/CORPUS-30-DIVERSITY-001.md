# CORPUS-30-DIVERSITY-001 — Review (GATE C)

**Verdict:** APPROVE
**Reviewer agent run:** 2026-06-04
**Branch:** feat/corpus-30-diversity-001 (HEAD `f73d287`)
**Design:** docs/designs/CORPUS-30-DIVERSITY-001.md (operator-decided axis (ii) — reporter-only band recalibration)
**Issue:** #468

## Executive summary

This card does exactly what the operator authorized at GATE A: it replaces the stale hardcoded voice-distribution band `count < 5 || count > 12` in BOTH §9 reporter twins (`runXaiAdversarialBotCorpus.js` `checkVoiceDistribution` and `xaiAdversarialReport.js` `voiceDistributionFromEvents`) with a stream-derived `recalibrateVoiceBand` (`expectedPerVoice = totalVoiceAssignments / distinctVoiceCount`), and leaves the planner byte-equal — `git diff main -- corpusPoolDrivenPlanner.js` and `corpusPoolDrivenPlannerConstants.js` are both empty. This is honest band-RECALIBRATION, not band-removal: the band reads GREEN on the planner's honest distribution (3 voices each at N over a 30-room stream) yet still fires YELLOW on a wildly imbalanced split (Tooth A — per-voice material deviation) and RED on a systemic run-wide collapse to ≤1 voice across ≥2 rooms (Tooth B — distinct-voice floor), while a single-room same-room collision stays YELLOW so the pre-existing 1-room collision guard is preserved unmodified. The recalibrated band emits `severityBand: 'n/a'` (never green) on an empty/incomplete voice stream, mirroring the `attribution_absent → n/a` posture #467 established. The two twins are byte-equivalent in executable logic, asserted by four JSON-equality lockstep tests. #467's `sameyMoveFromEvents` Jaccard, `fallbackReasonHistogram`, and `qualityThresholds` are present and untouched. The spine reframe is documentation-only (two identical Markdown note lines; no spine band or catalogue change). The full gate trilogy passes from a fresh worktree run: typecheck 0, lint 0, test 0 with 634 suites / 19332 passing / 1 skipped. No blockers.

## Verification

- typecheck: **pass** (exit 0)
- lint: **pass** (exit 0, `--max-warnings 0`)
- test: **pass** — `Test Suites: 634 passed, 634 total / Tests: 1 skipped, 19332 passed, 19333 total` (exit 0). Baseline on `9d2af44`: 633 suites / 19318 passing → +1 suite / +14 passing (the new `corpusVoiceAssignmentDiversity.test.ts`, 14 cases). No test removed or skipped.
- new suite: **pass** — `corpusVoiceAssignmentDiversity.test.ts` confirmed green in a targeted run (2 suites / 23 tests with the pre-existing diversity suite, exit 0).
- secret scan: **clean** (no ANTHROPIC/XAI/X_BEARER/SERVICE_ROLE/JWT/Bearer/Authorization in the diff)
- doctrine scan: **clean** (no winner/loser/liar/dishonest/bad-faith/manipulative/extremist/propagandist tokens introduced)
- skip scan: **clean** (zero `.skip`/`.only`/`xit`/`xdescribe`/`fit`/`fdescribe` in the new test)

## Per-check findings (the 7 adversarial checks)

### 1. Planner byte-equal (reporter-only gate) — PASS
`git diff main -- scripts/bot-fixtures/corpusPoolDrivenPlanner.js` is **empty** (exit 0, zero output). `corpusPoolDrivenPlannerConstants.js` (VOICES=8 / SPINES=9 catalogues) is also byte-equal (empty diff). `assignVoiceId` / `assignSpineId` unchanged. Axis (ii) reporter-only is honored — the planner is not touched. The new test additionally pins `assignVoiceId` determinism + catalogue membership (`corpusVoiceAssignmentDiversity.test.ts:187-208`).

### 2. Twin lockstep — PASS
`recalibrateVoiceBand` is defined in both twins. After stripping comments/blank lines, the two function bodies are byte-identical (36 code lines each, zero diff). `VOICE_BAND_LOW_FACTOR = 0.5` / `VOICE_BAND_HIGH_FACTOR = 2.0` match (runner :2272-2273, report :413-414). `classifySeverity` is identical in both. The collision algorithm (one collision per `(scenarioId, voiceId)` pair via a `__collision__:` sentinel set) and the `maxRoomVoiceCardinality` / `voiceRoomCount` accumulation are identical. The redundant n/a wrapper that previously lived in `aggregateDiversityChecks` (and owned a divergent collision count) was removed; the band helper now owns the gate in both paths. Four parity tests assert `JSON.stringify(report) === JSON.stringify(runner)` on honest / collapse / imbalanced / empty streams (`corpusVoiceAssignmentDiversity.test.ts:141-166`). The only twin difference is comment verbosity — cosmetic, no behavioral effect.

### 3. Honest recalibration, NOT silenced YELLOW (§4-T) — PASS (load-bearing)
- GREEN on the planner's honest distribution: `checkVoiceDistribution(honestStream(30))` → `severityBand:'green'`, `expectedPerVoice:30`, `distinctVoiceCount:3`, `expectedDistinctVoices:3` (synthesizer counts), `outOfBand:[]`, `degenerateCollapse:null` (`:82-93`). A second case at N=12 proves the expectation moves with the stream and is NOT reverse-fit to the last run (`:95-102`).
- Teeth intact: (a) all assignments collapse to 1 voice over 30 rooms → **RED** (`:104-111`, `degenerateCollapse.severity === 'red'`); (b) wildly imbalanced split (24/3/3, cardinality 1 so Tooth B inert) → **YELLOW** via Tooth A with `outOfBand.length > 0`, no collapse, no collision (`:113-122`). The band can both pass green and fire — not teeth-removed.
- Derivation documented: the comment above `recalibrateVoiceBand` names the planner property it depends on (B bot accounts × N rooms → B voices each at N; `expectedPerVoice = totalVoiceAssignments / distinctVoiceCount`; `expectedDistinctVoices = max per-room voice cardinality`) — not a magic interval.
- 1-room subtlety preserved: `severity = (distinctVoiceCount <= 1 && voiceRoomCount >= 2) ? 'red' : 'yellow'` gates RED on ≥2 voice-bearing rooms. The pre-existing `xaiAdversarialReport.diversity-checks.test.ts:112-119` (single-room `s1` collision → `collisions.length === 1`, `severityBand === 'yellow'`) was **NOT modified** (`git diff main --name-only -- '__tests__/**'` lists only the new file) and passes honestly under the new band (targeted run green). The systemic 30-room collapse is RED; the 1-room case is YELLOW — exactly as the implementer flagged.

### 4. n/a on insufficient/empty data — PASS
Empty `bot_assignment` stream → `severityBand:'n/a'`, `reason:'attribution_absent'`, never green (`:124-129`). `bot_assignment` present but an entry lacks `voiceId` → `n/a` / `attribution_absent`, never green (`:131-139`). The helper has its own zero-total backstop in addition to the caller's presence gate, and the n/a path is in twin-lockstep (`:162-166`). Mirrors the #467 `attribution_absent → n/a` posture.

### 5. Determinism — PASS
No `Math.random` / `Date.now` / `new Date()` in `recalibrateVoiceBand` or `checkVoiceDistribution` (source scan empty). Determinism test asserts byte-identical output twice for both twins on a fixed stream (`:168-176`).

### 6. Boundary + #467 intact — PASS
`git diff main --name-only` = exactly `{__tests__/corpusVoiceAssignmentDiversity.test.ts, docs/core/current-status.md, scripts/bot-fixtures/runXaiAdversarialBotCorpus.js, scripts/bot-fixtures/xaiAdversarialReport.js}`. No `src` / Edge / DB / migration / provider / routing / familyRegistry touch. The `current-status.md` change is a single additive manifest comment line. **#467 intact:** `sameyMoveFromEvents`, `fallbackReasonHistogram`, `fallbackReasonPrefix`, `qualityThresholds`, `SAMEY_MOVE_SAMPLE_FLOOR` are all present in `xaiAdversarialReport.js`; the diff contains ZERO `+`/`-` lines referencing any of them — the diff is voice-band + spine-comment only, no #467 revert.

### 7. Acceptance-gate + policy + spine reframe — PASS
Reporter-only; no submission path, no `submit-argument`, no `engine.ts`, no classifier/queue/routing change (the only "submit-argument / public.arguments / engine.ts" string matches in the diff are inside the descriptive `current-status.md` manifest comments). `policy_no_censorship`: no ban-list / redaction / suppression / validator / dissent-detector change (scan empty) — the band MEASURES severity, it does not SUPPRESS, reject, route, or delay any post. Spine reframe is documentation-only: two identical `lines.push('  - _Spine note: spines are stricter than voices …_')` Markdown lines, no spine band threshold change, no spine catalogue change.

### Green gate — PASS
Fresh-worktree run: typecheck exit 0, lint exit 0, test exit 0 with `634 passed, 634 total / 1 skipped, 19332 passed, 19333 total` — matches the expected ≈634 suites / ≈19332 passing / 1 skipped. New `corpusVoiceAssignmentDiversity.test.ts` confirmed passing.

### §4-T / skip scan — PASS
Zero `.skip` / `.only` / `xit` / `xdescribe` / `fit` / `fdescribe` in the new test. No existing test file was modified by this branch (`git diff main --name-only -- '__tests__/**'` = the new file only) — no assertion weakened to hide a regression; the recalibrated band makes the unmodified pre-existing assertions pass honestly.

## Doctrine self-check

- [x] No truth/winner/loser language in user-facing strings — band labels are `green/yellow/red/n/a` severity, never verdicts
- [x] Score never blocks posting — reporter-only metric, no submission path
- [x] No service-role in client code — none touched
- [x] No direct insert into public.arguments — none
- [x] No AI calls in production app paths — none (dev-tooling reporter only)
- [x] Plain language only — no raw internal code leaks to a user surface (committable Markdown only; full reason:id stays in gitignored JSONL)
- [x] Epic-specific doctrine (cdiscourse-doctrine §4-T): band-recalibration not bar-lowering; n/a-never-green on empty; teeth (Tooth A + Tooth B) preserved and proven; frozen H/I/J flags untouched

## Blockers

None.

## Suggestions (non-blocking)

1. The `recalibrateVoiceBand` block comments diverge slightly in verbosity between the two twins (the runner copy has a fuller "n/a-on-empty backstop" and Tooth-B comment than the report copy). The executable code is byte-identical and the lockstep tests pin behavior, so this is harmless; a future shared-helper extraction would eliminate the comment-drift surface entirely. Defer — not worth a code change in a reporter-only card.

## Operator next steps

- Push the branch: `git push -u origin feat/corpus-30-diversity-001`
- Open PR: `gh pr create --title "CORPUS-30-DIVERSITY-001: voice-distribution band recalibrated to planner reality (reporter-only)" --body-file docs/reviews/CORPUS-30-DIVERSITY-001.md`
- Deploy steps: **none** — dev-tooling only (`scripts/bot-fixtures/**` + `__tests__/**` + `docs/`). No migration, no Edge Function, no deploy; merge ≠ deploy. The next operator-run corpus picks up the recalibrated band; Claude never triggers a run.
- GATE C: green squash-merge is permitted (dev-tooling, auto-merge-eligible) once the PR is green.
- Post-merge worktree cleanup per roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)".

## Boundary attestation

No code modified. No push. No PR opened. No merge. This review wrote only `docs/reviews/CORPUS-30-DIVERSITY-001.md` and commits it on the same `feat/corpus-30-diversity-001` branch.
