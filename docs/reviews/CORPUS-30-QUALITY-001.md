# CORPUS-30-QUALITY-001 — Review (GATE C)

**Verdict:** APPROVE
**Reviewer agent run:** 2026-06-04
**Branch:** feat/corpus-30-quality-001
**Design:** docs/designs/CORPUS-30-QUALITY-001.md
**Issue:** #467

---

## Executive summary

The build delivers exactly the three reporter-quality fixes the design specifies, with no scope creep. The load-bearing §4-T green-on-empty defect is genuinely fixed: the old `const yellow = false` + literal `overallMean/maxIntraThreadMean: 0` are gone, replaced by a real token-set Jaccard over a body-free hashed-shingle fingerprint (`tokenHashes`), and an `N < 50` → `n/a (insufficient_samples)` HARD GUARD fires on all three sample paths in both twins. The fallback-reason histogram surfaces the renderer's existing per-issue tokens additively (no move-generation change) and buckets on the issue *prefix* only, so no user-label value or option/spine id payload reaches committable Markdown. The two §9 reporter twins (`runXaiAdversarialBotCorpus.js`, `xaiAdversarialReport.js`) compute byte-equivalent logic and a parity test pins them. Boundary is clean (`scripts/bot-fixtures/**` + `__tests__/**` + `docs/core/current-status.md` only). Fresh-worktree gate is fully green: **633 suites / 19318 passing / 1 skipped / exit 0**. No secret, no truth-label, no submission-path change. Auto-merge-eligible.

---

## Verification

- typecheck: **pass** (exit 0)
- lint: **pass** (exit 0, `--max-warnings 0`)
- test: **633 suites / 19318 passing / 1 skipped / 19319 total — exit 0** (matches the implementer's documented `631→633 suites / 19281→19318 passing` delta; FX-10 baseline failure is resolved by #490, so the clean worktree is fully green)
- card suites (explicit re-run): `corpusFallbackHistogramAndSameyMove` + `xaiAdversarialReport.quality-thresholds` + `xaiAdversarialReport.samey-move-token-set` → **3 suites / 48 tests passed, exit 0**
- secret scan: **clean** (ANTHROPIC/XAI/X_BEARER/SERVICE_ROLE/sb_secret_/sk-ant-/Bearer/JWT — zero added-line hits)
- doctrine scan: **clean** (no winner/loser/liar/truth tokens in added lines; no direct `public.arguments` insert; no `CLASSIFIER_QUEUE_ROUTING_*` read)

---

## Per-check findings (1–8)

### 1. Green-on-empty HARD GUARD (§4-T) — PASS

The old defect is removed and the guard is comprehensive in **both twins**:

- Old literals GONE: `runXaiAdversarialBotCorpus.js` no longer contains `const yellow = false; // we only have strict clone detection here` (removed at the live `move_body_sample` branch; runner.diff lines 236, 240). The report twin's old `severityBand: highPairs.length > 0 ? 'red' : 'green'` with no means is replaced (report.diff lines 160-167). A test asserts the literal is gone: `corpusFallbackHistogramAndSameyMove.test.ts:199`.
- `N<50 → n/a (insufficient_samples)` fires on all three paths: live fingerprint (`runXaiAdversarialBotCorpus.js` ~`:2376-2384`/twin `xaiAdversarialReport.js` ~`:123-131`), legacy clone-fallback (gated by the same floor above it; the legacy branch is only reached *after* the floor check, runner ~`:2388-2410`), and dev/dry `bot_move_render` (runner ~`:2455-2463`, twin ~`:201-210`). `SAMEY_MOVE_SAMPLE_FLOOR = 50` is a source constant in both files.
- Metric genuinely fires YELLOW and RED (band not widened to silence): `corpusFallbackHistogramAndSameyMove.test.ts:127-142` (`yellow` reachable at mean 0.385 with no high pair; `red` reachable on clones). `samey-move-token-set.test.ts:71-80` (real `overallMean > 0` on clones, not the literal 0).
- 49→n/a, 50→real band, 0→attribution_absent, and twin honors the floor: `corpusFallbackHistogramAndSameyMove.test.ts:160-191`; `samey-move-token-set.test.ts:92-108,131-139,157-170`.

No path can read green on absent/insufficient data.

### 2. Twin lockstep — PASS

Both twins emit identical metric/histogram/threshold shapes. The constants (`50 / 0.60 / 0.35`), `jaccardSets`/`sameyJaccardSets`, `sameyMovePairwise`/`sameyPairwise`, the `N<50` floor, `fallbackReasonHistogram` (prefix bucketing, `unspecified` bucket, sorted `[prefix,count][]`), `qualityThresholds`, and `openingPhraseTopShare` are byte-equivalent in logic across `runXaiAdversarialBotCorpus.js` and `xaiAdversarialReport.js`. Parity tests pin both report paths: `corpusFallbackHistogramAndSameyMove.test.ts:79-83` (histogram `b).toEqual(a)`), `:144-151` + `samey-move-token-set.test.ts:110-119` (samey band/means), `:184-191` (n/a floor), `quality-thresholds.test.ts:145-149` (`qualityThresholds` `toEqual` over two fixtures). No divergence.

### 3. Jaccard correctness + determinism — PASS

`hashToken = sha256(token).slice(0,8)` is deterministic and per-normalized-token; the emitted `tokenHashes` is the deduped+sorted set of these. Set intersection/union over the 8-hex prefixes equals it over the underlying tokens modulo collision; a 32-bit-prefix collision between two distinct stopword-stripped tokens within one small per-move set is negligible, and the design documents the reasoning (O2, design §94/§213). Real `overallMean` (mean pairwise Jaccard) and `maxIntraThreadMean` (max per-thread mean) are computed in `sameyMovePairwise`/`sameyPairwise` — non-zero on overlapping fixtures (`corpusFallbackHistogramAndSameyMove.test.ts:112-118`), exactly 0 on disjoint (`:120-125`). Determinism is test-proven (`:106-108,153-156`; `quality-thresholds.test.ts:151-153`); no `Math.random`/`Date.now` in the new functions.

### 4. Leak-safety of the new event fields (§6/§10a) — PASS

`tokenHashes` = set of 8-hex per-token sha256 prefixes (non-reversible; order destroyed by dedup+sort). `openingTokenHash` = single positional sha256 prefix of the first body token. Neither carries raw body, raw tokens, X handle, URL, or secret. The emit-shape contract is test-pinned: `samey-move-token-set.test.ts:172-195` asserts the `emitMoveBodySample` block contains `tokenHashes`/`openingTokenHash` but **no** `body:` / `tokenSet:` / `tokens:` key. The histogram buckets on the issue prefix only — `corpusFallbackHistogramAndSameyMove.test.ts:69-77` proves `troll` (a `forbidden_user_label:troll` value) and `opt-3` (an option id) are suppressed while only the prefix survives. Opening-phrase signal is body-free (`quality-thresholds.test.ts:102-108`). No raw body content leaks into any event.

### 5. Renderer behavior unchanged — PASS

`git diff main -- scripts/bot-fixtures/xaiAdversarialMoveRenderer.js` is **+28 lines, 0 removed** — strictly additive. It surfaces the already-built per-issue `issues` array on a new `fallbackIssues` field at the three existing fallback returns (`no_anthropic_client`, `ai_call_failed`, `validation_failed_after_retries`). No new fallback reason is invented; which body a move renders and when it falls back are untouched (the fallback decision logic and `return` of the rendered body are unchanged).

### 6. Policy + boundary + acceptance-gate — PASS

- **policy_no_censorship:** No dissent-detector tightening, semantic redaction, ban-list expansion, or submit-argument/validator change (added-line grep for `submit-argument|dissentDetect|banList|redact` → zero). The histogram measures fallback reasons; it suppresses nothing.
- **Voice band untouched:** `count < 5 || count > 12` does not appear in either twin's diff (that's #468).
- **Planner untouched:** `corpusPoolDrivenPlanner.js` is not in the changed-file set.
- **Boundary:** changed files ⊆ `scripts/bot-fixtures/**` + `__tests__/**` + `docs/core/current-status.md` (+ this review doc). No `src`/Edge/DB/migration/provider file.
- **Runner never reads `CLASSIFIER_QUEUE_ROUTING_*`:** zero added-line hits.
- **Acceptance-gate:** reporter-only; no submission path; the constitutional invariant is preserved verbatim (design §12).

### 7. Green gate (fresh worktree) — PASS

From the worktree on `feat/corpus-30-quality-001`: typecheck exit 0, lint exit 0, `npm run test` → `Test Suites: 633 passed, 633 total / Tests: 1 skipped, 19318 passed, 19319 total`, exit 0. The card's new suites are among the 633 and pass on explicit re-run (48 tests). No suite fails; FX-10 is resolved by #490, so no known-unrelated failure remains. **This is the gate for the auto-merge decision and it is green.**

### 8. §4-T / skip scan — PASS

Added-line grep for `.skip|.only|xit(|xdescribe|fit(|fdescribe` → zero. The three modified test files were updated for the new metric shape, not loosened: the samey red/green fixtures grew from 2 samples to 60 to clear the new `N<50` floor while asserting the *same* red/green bands (and the red test was strengthened with `overallMean > 0`); the attribution-absent regression test added 60 disjoint fingerprints so the samey check legitimately reads green. Scaling a fixture past a newly-raised floor is a §4-T bar-raise, not a bar-lowering — no assertion was weakened to hide a regression.

---

## Blockers

None.

## Suggestions (non-blocking)

1. The runner exports `qualityThresholds`/`fallbackReasonHistogram` but builds the Markdown inline in `buildMarkdownReport`, while the twin exposes `renderFallbackReasonHistogramSection`/`renderQualityThresholdsSection`. A shared render export on the runner would let a future test assert Markdown-string parity (not just data parity) across twins. Current data-level parity tests are sufficient; this is a nice-to-have.
2. O2 (8-hex hash width) and O3 (positional `openingTokenHash` on the committable path) were design open-questions for GATE A ratification. The implementation took 8-hex + positional emission; both are body-free and test-covered. If an operator later judges the positional opening signal too rich, the design already names the gitignored-only fallback. No action needed for merge.

---

## Boundary attestation

No code modified. No push. No PR opened. No merge.
