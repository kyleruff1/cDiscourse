# CORPUS-30-QUALITY-001 — Fallback-reason histogram, samey-move Jaccard fix, attribution-gated reporter thresholds

**Card:** CORPUS-30-QUALITY-001 (issue #467)
**Type:** dev-tooling (`scripts/bot-fixtures/**` + `__tests__/**` only)
**Verified at HEAD:** `37ccd9e` (`37ccd9ed027c625686f3eee517d03a48df25a29d`)
**Status:** DESIGN ONLY — no code in this card. Stage gates below.
**Auto-merge eligible:** yes (dev-tooling + tests; no app/src, no DB, no Edge, no provider call).
**Sequencing:** This card MUST land before #468 (CORPUS-30-DIVERSITY-001). Both refactor the same §9 reporter twins; see "Sequencing" below.

---

## Constitutional acceptance-gate invariant (stated verbatim)

> AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine, `src/lib/constitution/engine.ts`, is the sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post.

This card touches **only** the offline bot-corpus reporter (`scripts/bot-fixtures/**`). It does not touch `submit-argument`, the classifier queue, the routing predicate, observations, the family registry, or any MCP path. Nothing here can block, reject, route, or delay a user post. The invariant is recorded because the corpus runner exercises `submit-argument` end-to-end; the reporter changes proposed here are read-only over already-emitted JSONL and never alter submission semantics.

---

## Scope

Three reporter-quality fixes, all confined to the two §9 reporter twins and the move renderer's telemetry surface:

1. **(a) Per-fallback-reason histogram.** Add a new event that carries the *individual* validation/alignment issue tokens per move (today they are collapsed to one coarse string), and add a reporter aggregation pass + Markdown section that ranks the dominant fallback cause. No per-fallback-reason histogram event exists today (verified: `runXaiAdversarialBotCorpus.js:2290-2356` reporter has no fallback aggregation; `xaiAdversarialMoveRenderer.js:748-762` surfaces only the terminal coarse reason).
2. **(b) Fix the samey-move green-on-empty / clone-only defect.** Replace exact-`tokenSetHash`-equality (a strict clone detector) with a real token-set Jaccard, computed over a body-free hashed-shingle fingerprint, in **both** twins. Add a hard halt guard: emit `severityBand: "n/a"` with `reason: "insufficient_samples"` when fewer than 50 non-empty body samples exist — never green-by-absence.
3. **(c) Reporter thresholds with attribution-presence gates.** Add the three card thresholds (`deterministicFallbackPct`, `topOpeningPhrasePct`, `sameyMoveMean`) with bands that emit `n/a` when the underlying signal is absent or under the sample floor — never green-by-absence.

All work lands in:
- `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js` (live runner report assembly twin)
- `scripts/bot-fixtures/xaiAdversarialReport.js` (post-hoc report twin)
- `scripts/bot-fixtures/xaiAdversarialMoveRenderer.js` (surface the per-issue tokens it already computes)
- `__tests__/**` (new + extended suites)

---

## Non-goals

Explicitly out of scope for this card (do not propose or implement):

- **No dissent-detector tightening, semantic redaction, ban-list expansion, or `submit-argument` validator hardening.** Operator policy `policy_no_censorship` governs; this card only *reports* on the existing pipeline.
- **No voice/spine assignment-axis change and no voice-distribution band recalibration** — that is #468 (CORPUS-30-DIVERSITY-001). This card leaves `assignVoiceId` (`corpusPoolDrivenPlanner.js:265-274`) and the hardcoded `5..12` voice band (`runXaiAdversarialBotCorpus.js:2147-2149`, `xaiAdversarialReport.js:400`) byte-equal.
- **No app/`src/` code, no DB migration, no Edge Function, no Anthropic/xAI/X API call** introduced by this card (doctrine §7).
- **No family-registry flip.** H/I/J stay `productionEnabled:false` (`familyRegistry.ts:106/111/116`); this card does not read or touch the registry.
- **No widening of an existing band to make a YELLOW or absent-data state read green.** That is a §4-T bar-lowering breach and a HALT trigger (see "HALT ceiling").

---

## Current production state

The corpus runner is a dev-tooling pipeline; "production state" here means the state of the committed reporter at HEAD `37ccd9e`.

**Samey-move check — live path is a strict clone detector that reads green on real similarity.**
`checkSameyMove()` in the runner has two branches. The live-mode `move_body_sample` branch flags a pair **only** when `list[i].tokenSetHash === list[j].tokenSetHash && list[i].tokenCount >= 4`, then returns:

```js
const yellow = false; // we only have strict clone detection here
const red = highPairs.length > 0;
return { source, highPairs, overallMean: 0, maxIntraThreadMean: 0, severityBand: classifySeverity(red, yellow) };
```
(`runXaiAdversarialBotCorpus.js:2224,2230-2236`)

Two distinct templated bodies almost never collide on a 16-hex SHA-256 prefix, so RED structurally cannot fire on real similarity; `yellow` is hardcoded `false`; `overallMean`/`maxIntraThreadMean` are **literal 0** — never computed. The result on every live prod corpus run is GREEN with `mean=0/max=0`, regardless of how repetitive the moves are. The only path that computes a real Jaccard (`>=0.60` for highPairs, real `overallMean`/`maxIntraThreadMean > 0.35` for yellow) is the dev/dry `bot_move_render` fallback (`runXaiAdversarialBotCorpus.js:2240-2277`), which live prod runs never reach because they emit `move_body_sample`.

**The defect is mirrored in the report twin.** `sameyMoveFromEvents()` has the same `move_body_sample` branch: flags only `tokenSetHash` equality with `tokenCount>=4`, returns `severityBand: highPairs.length > 0 ? 'red' : 'green'` with **no yellow band and no mean fields** (`xaiAdversarialReport.js:419-443`). Its `bot_move_render` fallback computes Jaccard but, like the runner, never sets a yellow mean band (`xaiAdversarialReport.js:457-476`). **Both files must change or the two report paths diverge** (verified: facts dimension "Corpus reporter internals", `xaiAdversarialReport.js:409-477`).

**Move-body sample event is body-free but single-hash.** `emitMoveBodySample` writes `{ scenarioId, runTag, seedId, threadIndex, moveId, moveIndex, tokenSetHash, tokenCount }` (`runXaiAdversarialBotCorpus.js:815-827`). Raw body never leaves the runner — only the 16-hex `tokenSetHash` + count reach committable output. `computeMoveBodySampleHash` internally computes a sorted `tokenSet` but emits only the hash + count (`runXaiAdversarialBotCorpus.js:694-703`). A real Jaccard between two moves needs set intersection, which a single scalar hash per move cannot provide.

**No per-fallback-reason histogram exists.** The renderer computes a per-move `issues` array (`banned_canned_phrase`, `forbidden_user_label:<label>`, `missing_concession_marker`, `missing_target_excerpt`, `too_short`, the `validateOptionAlignment` reason, the `validateSpineAlignment` reason) at `xaiAdversarialMoveRenderer.js:711-725`, then on final fallback **discards** it and returns only `validationFailureReason: 'validation_failed_after_retries'` + the single `alignmentFailureReason` (last option/spine reason) (`xaiAdversarialMoveRenderer.js:748-762`). The runner's `move_rendered` / `move_validated` events carry only those two coarse strings (`runXaiAdversarialBotCorpus.js:1007-1030`, note `issues: []` is emitted empty at :1029). The reporter never aggregates a fallback histogram (`runXaiAdversarialBotCorpus.js:2290-2356`).

**Observed run evidence.** Run `corpus-prod-synthetic-20260603-1924-d49e04cd`: Anthropic renderer calls **23 of 240** M3-M10-eligible moves = **9.6%**; deterministic_fallback ~217/240 ≈ 90.4% (`docs/testing-runs/2026-06-04-corpus-30-analysis.md:62-91`). The dominant fallback cause is *hypothesized* to be spine-alignment regex failures on Anthropic's JSON-wrapped output, but cannot be confirmed today because the per-issue tokens are discarded — which is exactly why this card adds the histogram *before* any threshold tuning (so we never tune a bar against an unknown cause).

**Classifier queue routing was OFF during that run** (percentage 0%) — unrelated to this card but recorded for completeness (`docs/testing-runs/2026-06-04-corpus-30-analysis.md:55-56`).

---

## RCA / problem summary

Three independent reporter defects, one shared root pattern (the report metric reads "green" when its underlying signal is **absent or degenerate**, not when the run is actually clean):

1. **Histogram gap (a).** The renderer knows *why* each move fell back (it builds the `issues` array) but throws that away at the fallback return, keeping one coarse terminal string. With ~90% fallback observed and the cause unconfirmed, no threshold can be honestly set. **Root cause:** lossy telemetry at `xaiAdversarialMoveRenderer.js:748-762` — the `issues` array is local and never emitted.

2. **Samey-move green-on-empty (b).** The live `move_body_sample` branch was written as a clone detector ("by construction" body-free), with `yellow` hardcoded `false` and means hardcoded `0`. The single per-move `tokenSetHash` carries no information for set-intersection, so the branch can detect only exact clones — and reports GREEN for everything else, including high real overlap. **Root cause:** the committable event shape (one scalar hash per move) is insufficient for Jaccard, and the code papered over that with `yellow=false` + `mean=0` instead of emitting `n/a`.

3. **Threshold absence (c).** The three card thresholds are not implemented at all; without them and without attribution-presence gates, the reporter has no fallback/opening-phrase/samey-mean bands, and any naive band would inherit the same green-on-empty failure mode.

The unifying fix: **a metric that lacks the data to judge must say `n/a`, never green.** Absence of evidence is not evidence of cleanliness (doctrine §3 in spirit — absence/zero-signal must not be read as a positive verdict; §4-T — no bar may be lowered, and reading green on absent data is a silent bar of zero).

---

## Why this is or is not a ceiling/limit

This is **not** a capacity/architecture ceiling. It is a reporter-correctness defect in dev-tooling. There is no provider-concurrency, queue-latency, or Edge-timeout dimension. The fix is bounded, deterministic, and offline.

The one genuine *limit* is the **body-free committable-output constraint**: the committable Markdown and the committed JSONL summary must never contain raw move bodies (verified design property: `runXaiAdversarialBotCorpus.js:680-703`, the "body itself never leaves the runner" comment; test `xaiAdversarialReport.samey-move-token-set.test.ts:8-13`). A real Jaccard needs set intersection, which a single scalar hash cannot provide. This card resolves the limit by emitting a **body-free hashed-shingle fingerprint** (each normalized token hashed to a short prefix; the *set of token hashes*, not the readable tokens), which supports set-intersection Jaccard while remaining non-reversible to readable body text. This keeps the body-free guarantee intact while making the metric real. This is a design choice, not a relitigation of the operator-ratified §9 default — the default permitted "richer Jaccard only where raw body is available in the gitignored JSONL"; the hashed-shingle set is the body-free way to get the same signal on the committable path.

---

## Architecture options considered

**Option A — Keep clone-only on the committable path; emit `n/a` for similarity; compute real Jaccard only in the gitignored dry-mode `bot_move_render` path.**
- Pro: smallest change; preserves today's body-free committable shape exactly.
- Con: leaves the live prod path with *no* real similarity signal — it would always read `n/a` for live runs, which is honest but useless for the dominant (live) path the card is trying to make trustworthy. Does not satisfy the card's intent ("real similarity, never green-on-empty").

**Option B (CHOSEN) — Emit a body-free hashed-shingle fingerprint on `move_body_sample`; compute token-set Jaccard over the shingle sets in both twins; gate on a 50-non-empty-sample floor → `n/a` below it.**
- Pro: real Jaccard on the live path; body-free (each token is individually hashed to a short prefix and only the *set of hashes* is emitted — no readable token survives, and order is destroyed by set-dedupe + sort); single threshold; deterministic.
- Con: a fingerprint is heavier than a single hash (a set of ~N short hashes per move vs. one). Mitigated: tokens are already deduped+sorted+stopword-stripped (`computeMoveBodySampleHash:694-702`), bounding set size; the committed JSONL is gitignored at full size and only the *summary* is committable.
- This is the option that satisfies all three card requirements without leaking body text.

**Option C — Emit the raw token-set (readable tokens) and compute Jaccard directly.**
- Pro: simplest Jaccard.
- Con: **rejected** — readable tokens in committable output is a body-leak risk and violates the body-free guarantee. Even stopword-stripped tokens can reconstruct claim fragments. Doctrine §10a (no sensitive content surfaced) + the existing leak-safe design forbid it.

**Histogram sub-options:**
- **H1 (CHOSEN)** — Emit the per-issue `issues` array on a new `move_fallback` event (or extend `move_validated.issues`, which is currently emitted empty at :1029) and aggregate a histogram in both twins. Reuses existing instrumentation points; the renderer already computes the array.
- **H2** — Re-derive the cause in the reporter from the coarse `validationFailureReason`+`alignmentFailureReason`. Rejected: lossy — the dominant *non-alignment* causes (banned phrase, too_short, missing marker) are invisible once collapsed.

---

## Chosen architecture

### (a) Per-fallback-reason histogram

1. **Renderer:** at the fallback return (`xaiAdversarialMoveRenderer.js:748-762`), include the full `issues` array (the local array already built at :712-725) on the returned object as `fallbackIssues: string[]`. Forbidden-user-label values are already shaped as `forbidden_user_label:<label>` — the histogram **buckets on the token prefix only** (`forbidden_user_label`), never the label value, so no user-classification string reaches the report (doctrine §1/§10a). Spine/option reasons are shaped `<reason>:<id>` and likewise bucket on prefix.
2. **Runner:** emit the array on `move_validated.issues` (replace the empty `issues: []` at `runXaiAdversarialBotCorpus.js:1029` with `rendered.fallbackIssues || []`) and/or a dedicated `move_fallback` event for moves whose `source === 'deterministic_fallback'`. Keep the existing coarse fields for back-compat.
3. **Both twins:** add `fallbackReasonHistogram(events)` that counts, across all fallback moves, each issue *prefix* (not the full token), returning a sorted `[reasonPrefix, count][]` plus the total fallback count and the non-seed move denominator. The Markdown adds a "Fallback reason histogram" subsection under §9.

Bucketing on the prefix guarantees the histogram cannot echo a banned label, a body excerpt, or an option/spine id payload (doctrine §1, §9, §10a). The full `<reason>:<id>` strings remain only in the gitignored JSONL for operator drill-down.

### (b) Samey-move Jaccard fix (BOTH twins)

1. **Fingerprint emit (`runXaiAdversarialBotCorpus.js:694-703,815-827`):** extend `computeMoveBodySampleHash` to also return `tokenHashes: string[]` — each normalized non-stopword token (len≥3) hashed `sha256(token).slice(0,8)`, deduped+sorted. `emitMoveBodySample` adds `tokenHashes` to the event. The readable token list is **never** emitted; only the set of 8-hex per-token hashes. `tokenSetHash` + `tokenCount` stay for back-compat and strict-clone detection.
2. **Reporter Jaccard (BOTH twins):** in the `move_body_sample` branch of `checkSameyMove` / `sameyMoveFromEvents`, when `tokenHashes` is present compute pairwise Jaccard over the hash-sets (intersection / union), exactly mirroring the existing `bot_move_render` Jaccard math (`runXaiAdversarialBotCorpus.js:2256-2269`, `xaiAdversarialReport.js:457-471`). Thresholds: pair is high-overlap at `>=0.60`; `yellow` when `overallMean > 0.35 || maxIntraThreadMean > 0.35` (same constants the dry path already uses). Compute and return real `overallMean` + `maxIntraThreadMean` (delete the literal `0`s and `yellow=false`).
3. **HARD HALT GUARD (sample floor):** count non-empty body samples = number of `move_body_sample` events with `tokenCount > 0` (or `tokenHashes.length > 0`). When that count `< 50`, return `severityBand: "n/a"`, `reason: "insufficient_samples"`, `sampleCount: <n>`, and DO NOT compute a green/yellow/red band. The metric NEVER reads green on absent or insufficient data. When the only available source is the legacy single-hash `move_body_sample` without `tokenHashes` (old JSONL), fall back to strict-clone detection but still apply the `n/a`-below-50 floor — never green.
4. **Twin parity test:** a test feeds the same synthetic event array to both `checkSameyMove` and `sameyMoveFromEvents` and asserts identical `severityBand`/`overallMean`/`maxIntraThreadMean`, so the two report paths cannot diverge again.

### (c) Reporter thresholds with attribution-presence gates

Add a `qualityThresholds(events)` aggregation (BOTH twins) producing three banded metrics; each carries an explicit `attributionPresent` flag and emits `n/a` when the signal is absent:

| Metric | Source signal | green | yellow | red | `n/a` (never green-by-absence) |
|---|---|---|---|---|---|
| `deterministicFallbackPct` | fallback share of non-seed (M3+) moves | `<=20%` | `20–40%` | `>40%` | no non-seed `move_validated` events present |
| `topOpeningPhrasePct` | most-common opening-phrase share | `<8%` | `8–15%` | `>15%` | no opening-phrase signal present |
| `sameyMoveMean` | samey-move `overallMean` | below threshold AND `>=50` samples | over threshold | clone pairs present | `<50` non-empty samples (`insufficient_samples`) |

`n/a` is rendered literally as `n/a` in the Markdown with the reason, never folded into green. Thresholds are constants (not env-tunable in this card). Opening-phrase extraction operates on the body-free path: it buckets the first hashed shingle of each move (from `tokenHashes[0]` after the existing sorted-set ordering is replaced by a *positional* first-token hash carried separately as `openingTokenHash`), so no readable opening phrase reaches committable output. (Open question O3 records the alternative of computing opening-phrase only in the gitignored dry path if positional emission is judged too rich.)

---

## Data model (JSONL event shape)

No DB. JSONL only (gitignored at full fidelity; committable Markdown is hash/count-only).

`move_body_sample` (extended — additive, back-compat):
```
{ scenarioId, runTag, seedId, threadIndex, moveId, moveIndex,
  tokenSetHash,            // unchanged: 16-hex sha256 prefix of sorted token-set
  tokenCount,              // unchanged
  tokenHashes,             // NEW: string[] of 8-hex per-token sha256 prefixes (sorted, deduped) — body-free
  openingTokenHash }       // NEW (optional): 8-hex hash of the first body token, for opening-phrase band
```

`move_validated` (extended — additive): `issues: string[]` populated with the renderer's `fallbackIssues` (was emitted empty at `:1029`).

New event `move_fallback` (optional, emitted only when `source === 'deterministic_fallback'`):
```
{ scenarioId, runTag, threadIndex, moveId, moveIndex, source, attempts, issues: string[] }
```

All new fields are body-free (hashes/enums/counts). No readable body token, no user label, no option/spine payload reaches the committable summary; full strings stay in the gitignored JSONL only.

---

## Worker/drainer model

Not applicable. This card is an offline reporter; there is no worker, drainer, queue, or async path. (Recorded per §8 template requirement.)

---

## Liveness and observability

- The histogram and the samey-move band make the dominant fallback cause and real move-similarity **visible** for the first time; today both are dark (90% fallback with unconfirmed cause; samey always green).
- Every new metric carries an explicit presence/sample flag; a reader can always distinguish "clean" (green with sufficient data) from "unknown" (`n/a`, reason stated). This is the observability invariant the card buys.
- No new logging of secrets, bodies, or labels (doctrine §6/§10a). Leak-safe scan suite `corpus30RunReportLeakage.test.ts` is extended to cover the new event fields + Markdown subsections.

---

## Cutover and rollback path

- **Cutover:** purely additive to dev-tooling. Merging the PR changes only `scripts/bot-fixtures/**` + `__tests__/**`. The next corpus run picks up the new events automatically; old JSONL (without `tokenHashes`) still parses (strict-clone fallback + `n/a` floor).
- **Rollback:** revert the PR. No migration, no Edge deploy, no env flag, no data backfill. Old reports remain valid; new fields are ignored by any consumer that does not read them.
- **No merge=deploy effect:** the change touches neither `supabase/functions/**` nor `supabase/migrations/**`, so the Supabase auto-apply chain (pipeline-governance-contract §5) is not triggered. `requiresMigration:false`, `requiresEdgeDeploy:false`, `requiresOperatorGateC:false`.

---

## Smoke plan

All offline; no provider call, no Supabase write (dry mode):

1. **Unit (Jest):** new + extended suites under `__tests__/` (see Test-count forecast). `npm run typecheck` + `npm run lint` + `npm run test` exit 0 with captured `Test Suites:`/`Tests:` lines.
2. **Twin-parity assertion:** synthetic event array → both `checkSameyMove` and `sameyMoveFromEvents` → identical band/means.
3. **Green-on-empty guard test:** feed 49 vs 50 non-empty samples → assert `n/a (insufficient_samples)` at 49 and a computed band at 50. Feed zero samples → `n/a (attribution_absent)`.
4. **Dry corpus run:** `node scripts/bot-fixtures/runXaiAdversarialBotCorpus.js --dry --scenarios N` (no `--pilot`, no env keys) and inspect the generated Markdown for: the new "Fallback reason histogram" subsection, a real samey-move band (not always green), and the three threshold rows with `n/a` where data is thin. Confirm no readable body token / no user label / no option-spine payload in the committable Markdown.
5. **Leak-safe scan:** extend `corpus30RunReportLeakage.test.ts` and run it against a generated report.

(No live `--pilot` run is required for this card; the live path is exercised by the existing run d49e04cd evidence. A live run, if the operator chooses, is gated by `.env.engagement-intelligence` + `--pilot` + env flags per doctrine §7 — not required for merge.)

---

## Open questions

- **O1.** Histogram event placement: extend `move_validated.issues` (already present, emitted empty) vs. a dedicated `move_fallback` event. Both are listed; the implementer picks one and documents it. Recommendation: populate `move_validated.issues` (lowest churn) and skip the separate event unless a non-validated fallback path needs it.
- **O2.** Fingerprint per-token hash width: 8-hex (32-bit) prefix has a non-zero token-collision rate that slightly inflates Jaccard. Is 8-hex acceptable, or should it be 12-hex? Recommendation: 8-hex (collision impact on a set-Jaccard mean is negligible at the token-count scale here; widening is cheap if a test shows drift).
- **O3.** Opening-phrase band (c): does emitting `openingTokenHash` (a single positional token hash) cross the body-free line? If the operator judges any positional token signal too rich for the committable path, compute `topOpeningPhrasePct` only in the gitignored dry path and emit `n/a` on the committable path. Flagged for operator ratification at GATE A.
- **O4.** Exact threshold constants for `topOpeningPhrasePct` are taken from the backlog card (`<8/8–15/>15`); confirm these against any updated sprint guidance before implementation.

---

## Stage gates before implementation

Per pipeline-governance-contract §2 stage machine (Phase 0 → DESIGN → GATE A → IMPLEMENT → GATE B → REVIEW → GATE C):

- **Phase 0:** complete (fact bundle `wcw6bxc56.output`; all six investigator dimensions + verify block read; samey-move + histogram facts confirmed).
- **DESIGN:** this doc.
- **GATE A (design approval):** operator/reviewer confirms (1) the body-free hashed-shingle fingerprint is an acceptable committable shape (O2/O3), (2) the `n/a`-below-50 floor is the agreed guard, (3) the #467→#468 sequencing is honored. **No bar-lowering** is permitted at GATE A — the samey-move band may only move from "always green" toward "honest n/a/yellow/red", never the reverse (§4-T).
- **IMPLEMENT:** code + tests; both twins changed together.
- **GATE B:** `typecheck`/`lint`/`test` green with captured exit codes; twin-parity + green-on-empty guard tests present.
- **REVIEW + GATE C:** reviewer re-runs the suite; confirms no app/src/DB/Edge/provider change; confirms no band reads green-on-empty. **GATE C is not operator-gated for merge** (dev-tooling, auto-merge-eligible) but the never-self-approve rule (§4-C/§4) still binds: the implementer may not self-approve a change that *relaxes* the new guard.

---

## Commit-slice plan

1. **Slice 1 — fingerprint emit (additive, no reader change):** extend `computeMoveBodySampleHash` + `emitMoveBodySample` with `tokenHashes` (+ optional `openingTokenHash`); add unit tests asserting the new fields are body-free and deterministic. Report behavior unchanged (still reads `tokenSetHash`).
2. **Slice 2 — samey-move Jaccard + `n/a` floor (BOTH twins):** rewrite the `move_body_sample` branch in `checkSameyMove` and `sameyMoveFromEvents` to compute real Jaccard over `tokenHashes`, real means, and the `<50 → n/a` guard; add twin-parity + green-on-empty tests.
3. **Slice 3 — fallback-reason histogram:** renderer surfaces `fallbackIssues`; runner emits them on `move_validated.issues`; both twins add `fallbackReasonHistogram` + Markdown subsection; tests assert prefix-only bucketing (no label/body/payload leak).
4. **Slice 4 — quality thresholds (c):** add `qualityThresholds` (BOTH twins) with the three banded metrics + attribution-presence gates + Markdown rows; tests for each band incl. the `n/a` path; extend leak-safe scan.

Slices are ordered so each is independently green; Slice 2 depends on Slice 1's event field.

---

## Test-count forecast

Baseline (test-discipline skill): **630 suites / 19263 passing / 1 skipped / 19264 total on main.** This card's IMPLEMENT phase projects **+30 to +45 tests across ~4 new/extended suites** (no test removed):

- `xaiAdversarialReport.samey-move-token-set.test.ts` (extend): real-Jaccard band, `n/a`-below-50 floor, twin parity. (~+8)
- `xaiAdversarialReport.attribution-absent-na.test.ts` (extend): `insufficient_samples` vs `attribution_absent`. (~+4)
- New `__tests__/xaiAdversarialReport.fallback-histogram.test.ts`: prefix bucketing, no-leak, dominant-cause ranking. (~+10)
- New `__tests__/xaiAdversarialReport.quality-thresholds.test.ts`: three bands × (green/yellow/red/`n/a`) + attribution-presence gate. (~+14)
- `corpus30RunReportLeakage.test.ts` (extend): new event fields + Markdown subsections. (~+4)
- `xaiAdversarialReport.diversity-checks.test.ts` (extend if §9 row text changes). (~+2)

DESIGN phase test delta: **0** (this doc only). Implementer confirms the exact new total against a captured `Test Suites:`/`Tests:` line at GATE B.

---

## HALT ceiling

This card HALTs and escalates (does not silently proceed) if any of the following is true:

- **Green-on-empty (primary §4-T trigger):** any new metric — samey-move, fallback %, opening-phrase % — would read `green` on absent or insufficient data. The samey-move metric MUST emit `severityBand: "n/a"` with `reason: "insufficient_samples"` when `N < 50` non-empty body samples; it must NEVER read green by absence. Widening any band to make a YELLOW (or an `n/a`) read green on absent data is a §4-T bar-lowering breach and a HALT trigger.
- **Twin divergence:** if a band/metric is changed in only one of the two twins (`runXaiAdversarialBotCorpus.js` and `xaiAdversarialReport.js`), the report paths diverge — HALT until both are changed and the parity test passes.
- **Body/label/payload leak:** if any readable body token, user label, or option/spine id payload would reach committable output — HALT (doctrine §1/§9/§10a).
- **Scope breach:** if the change touches anything outside `scripts/bot-fixtures/**` + `__tests__/**` (app/src, DB, Edge, provider, family registry, routing) — HALT.
- **Frozen-set touch:** any read or write that would flip H/I/J `productionEnabled`, arm routing, or raise the routing percentage — HALT (not in scope; flagged defensively).

---

## Current-status manifest stub

**MODIFIED:**
- `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js` — samey-move twin (`checkSameyMove`), `computeMoveBodySampleHash`/`emitMoveBodySample` fingerprint, `move_validated.issues` population, new `fallbackReasonHistogram` + `qualityThresholds` + Markdown subsections.
- `scripts/bot-fixtures/xaiAdversarialReport.js` — samey-move twin (`sameyMoveFromEvents`), `fallbackReasonHistogram` + `qualityThresholds` mirrors, Markdown subsections.
- `scripts/bot-fixtures/xaiAdversarialMoveRenderer.js` — surface `fallbackIssues` on the fallback return (`:748-762`).

**NEW:**
- `__tests__/xaiAdversarialReport.fallback-histogram.test.ts`
- `__tests__/xaiAdversarialReport.quality-thresholds.test.ts`

**BYTE-EQUAL preserved:**
- `scripts/bot-fixtures/corpusPoolDrivenPlanner.js` (voice/spine assignment — #468's surface, untouched here).
- The hardcoded `5..12` voice band in both twins (`runXaiAdversarialBotCorpus.js:2147-2149`, `xaiAdversarialReport.js:400`) — #468 owns it.
- `supabase/**`, `src/**`, `app/**`, `familyRegistry.ts` — untouched.

**Test deltas:** +30 to +45 (≈4 new/extended suites); from baseline 630 suites / 19263 passing. No test removed.

**Operator follow-up:** GATE A ratification of O2 (hash width) + O3 (opening-phrase positional emission). Optional live `--pilot` corpus run after merge to confirm the live samey-move band fires non-green on a real repetitive run (not required for merge).

**Discipline line:** Design-only; dev-tooling scope; no app/src/DB/Edge/provider change; no secret; frozen set untouched; every state claim carries a file:line or Phase-0 fact citation.

---

## Required-reading manifest for the later build phase

- `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js` — `checkSameyMove` (`:2158-2278`), `computeMoveBodySampleHash` (`:694-703`), `emitMoveBodySample` (`:814-827`), `move_rendered`/`move_validated` emit (`:1007-1030`), `classifySeverity` (`:1876-1880`), `runDiversityChecks` (`:2280-2288`), `buildMarkdownReport` §9 block (`:2347-2357`).
- `scripts/bot-fixtures/xaiAdversarialReport.js` — `sameyMoveFromEvents` (`:409-477`), `voiceDistributionFromEvents` (`:398-407`, byte-equal here), provider-tally mirror (`:485-511`).
- `scripts/bot-fixtures/xaiAdversarialMoveRenderer.js` — issue array + fallback return (`:711-762`).
- `__tests__/xaiAdversarialReport.samey-move-token-set.test.ts`, `__tests__/xaiAdversarialReport.attribution-absent-na.test.ts`, `__tests__/xaiAdversarialReport.diversity-checks.test.ts`, `__tests__/corpus30RunReportLeakage.test.ts` — existing patterns to mirror.
- `docs/testing-runs/2026-06-04-corpus-30-analysis.md:55-91,147-156` — the 23/240 Anthropic + ~90% fallback evidence that motivates the histogram.
- `docs/designs/SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:891-918,972-976` — the card's threshold definitions + HALT trigger.
- Skills: `cdiscourse-doctrine` (§1/§3/§4-T/§4-C/§7/§9/§10a), `test-discipline` (baseline + leak-safe pattern).

---

## Sequencing (binding)

**#467 (this card) MUST land BEFORE #468 (CORPUS-30-DIVERSITY-001).** Both refactor the §9 reporter twins (`runXaiAdversarialBotCorpus.js` + `xaiAdversarialReport.js`). #468 (voice/spine band recalibration or assignment-axis change) consumes the §9 structure this card stabilizes (the fallback histogram is in place before diversity diagnosis runs; per the sprint DAG, DIVERSITY is a soft-dep on QUALITY — `docs/designs/SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1002-1047`, dedup verdict #468). Unsequenced parallel PRs will collide on the §9 section. This card does not touch the voice band; #468 does — keeping the two PRs in order avoids a merge collision and a band-by-band divergence between the twins.
