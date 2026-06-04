# CORPUS-30 — Results Analysis + Product Readout

`Audit-Lint: v1`

**Card:** `CORPUS-30-RESULTS-001` (GitHub issue [#466](https://github.com/kyleruff1/cDiscourse/issues/466))
**Run analyzed:** `corpus-prod-synthetic-20260603-1924-d49e04cd` (runId `d49e04cd`, 2026-06-03 19:24 UTC live).
**Phase 7 input:** [`2026-06-04-corpus-30-phase7-observation.md`](./2026-06-04-corpus-30-phase7-observation.md) (PR #482).
**Source reports:** [`2026-06-03-xai-adversarial-bot-corpus.md`](./2026-06-03-xai-adversarial-bot-corpus.md), [`2026-06-03-xai-adversarial-corpus-summary.md`](./2026-06-03-xai-adversarial-corpus-summary.md) (PR #481).

---

## 1. Synthetic-evidence disclaimer (binding for every claim below)

Per `cdiscourse-doctrine §3` (popularity / engagement is not evidence) and the operator's settled policy `policy_no_censorship` (truth self-heals through argument; hostile rhetoric is INPUT to the bot adversarial process, not defect): **this analysis is product-mechanism evidence on pre-launch prod synthetic data. It is NOT organic traffic evidence, NOT ramp evidence, NOT factual standing of any claim, and NOT a verdict on any author**. The 300/300 posting result is **submission-path mechanism telemetry**, not user truth. Severity bands describe playability/diversity; they describe nothing about correctness.

---

## 2. Executive verdict

**The submission path works at scale. The renderer is brittle. The classifier substrate has burst-failure under autonomous concurrency.**

| Dimension | Result |
|---|---|
| Posting mechanism (300 / 300 args via `submit-argument`) | **PASS** |
| Acceptance-gate boundary (no AI/MCP gate; `engine.ts` sole gate) | **PASS** |
| Anti-amplification doctrine surfaced & honored | **PASS** |
| Renderer Anthropic-success rate (M3-M10 only — see §4) | **9.6% — FAIL-LIKE** |
| Diversity §9 — duplicate-seed | **GREEN** |
| Diversity §9 — repeated-option | **YELLOW** |
| Diversity §9 — spine saturation | **YELLOW** |
| Diversity §9 — voice distribution | **YELLOW (structural — see §6)** |
| Diversity §9 — samey-move | **GREEN BUT KNOWN-DEFECTIVE (see §7)** |
| Phase 7 A-G coverage (per arg) | **PASS (zero gaps)** |
| Phase 7 A-G success rate | **40.5% Σ — PARTIAL** |
| Phase 7 H/I/J leakage | **ZERO** |

The headline number 300 / 300 = **mechanism evidence, not quality evidence**.

---

## 3. What this corpus proved

- **`submit-argument` accepts 300 bot posts across 30 debates without service-role, without direct insert, without acceptance-gate AI involvement.** This is real and load-bearing. The constitutional invariant (sole gate is `engine.ts`) was preserved across 300 acceptance decisions.
- **The pool-driven planner (CORPUS-30-POOL-DRIVEN-PLANNER, PR #456 → fix PR #459) deterministically assigns seeds, options, voices, and spines per the design spec.** Bank exhaustion + linear-probe reuse-avoidance behaved as the design intended.
- **The auto-trigger dispatcher fires for every production-enabled family on every accepted insert.** Phase 7 confirms zero coverage gaps for A-G; H/I/J `productionEnabled: false` gate held with zero leakage.
- **The redactor (`xaiSourceRedactor`) and the bot-skill gate (`scripts/skills/validateBotSkills.js`) operated as designed.** Compliance checklist in the source report (`docs/testing-runs/2026-06-03-xai-adversarial-bot-corpus.md` § Compliance) ticked all six rows.
- **Provider routing is `mcp`.** Operator-authorized flip on 2026-06-03 held through the run; the classifier substrate dispatched into the operator-hosted MCP server, not the Anthropic adapter.
- **Anti-amplification doctrine is intact.** All replies tagged amplification-risk = 0; source-chain-risk HIGH = 0; the doctrine surface is alive in the production code path.

---

## 4. What this corpus did NOT prove

- **It is not organic traffic.** All 300 args were bot posts. Engagement signals are bot-generated.
- **It is not a ramp signal.** Classifier queue routing was off; the percentage dial stays at 0% pending P1 organic Stage-1 evidence.
- **It is not a factual-standing claim about any topic.** Per §3 anti-amplification.
- **It is not an Anthropic-renderer reliability claim.** The renderer's Anthropic call ratio is **23 of 240 = 9.6% on M3-M10** (M1/M2 are seeded banked, never call Anthropic). The dominant fallback is `deterministicSkeletonFill` — likely spine-alignment regex failures hitting Anthropic's JSON-wrapped output (per Phase 0 fact `anthropic_fallback_spine_alignment_likely_dominant`). This is operator-relevant but does NOT impeach the mechanism; the deterministic fallback respects the same banked-pool selections.
- **It is not a "Family H is ready" claim.** H production retry remains gated on the three-conjunctive-condition E#7 criterion; this synthetic corpus alone is necessary-but-not-sufficient.

---

## 5. Counts (mechanism telemetry, not quality verdict)

| Metric | Value |
|---|---:|
| Debates created | 30 |
| Arguments posted | 300 |
| Anthropic calls (renderer) | 23 |
| Anthropic-eligible moves (M3-M10) | 240 |
| xAI calls (post-harvest) | 0 |
| Supabase writes | 420 |
| Synthetic fallbacks | 0 (real harvest only) |
| Source-chain risk HIGH replies | 0 |
| Amplification risk HIGH replies | 0 |
| `argument_machine_observation_runs` rows | 3,155 (per Phase 7 §1) |
| A-G success rows | 1,277 |
| A-G failed rows | 1,878 |
| H/I/J production rows | 0 |
| Auto-trigger MAX_ATTEMPTS=2 retries observed | yes (3,155 / 300 / 7 ≈ 1.5 attempts / family-arg) |

---

## 6. Diversity §9 read

| Check | Severity | Counts | Read |
|---|---|---|---|
| Duplicate-seed | GREEN | 30/30 unique | Pool selection is deterministic and no repeats inside or across threads. |
| Repeated-option | YELLOW | repeated within = 1; cross-thread = 0 | Reuse-avoidance + linear-probe operated as designed; the 1 within-thread repeat is at the bank-exhaustion boundary — expected. |
| Spine saturation | YELLOW | repeated-threads = 16; low-diversity windows = 2 | Spine deterministic per (runId, threadIndex, moveIndex) with +1-mod-9 no-repeat-prior advance. 9 spines × 10 moves yields some within-thread repeats; YELLOW here is a band-tuning concern, not a planner regression. CORPUS-30-DIVERSITY-001 (#468) covers tuning. |
| Voice distribution | YELLOW | collisions = 0; out-of-band voices = 3 | **Structural**: `assignVoiceId(runId, botUserId)` is per-bot-account-per-run (per Phase 0 fact `voice_assignment_per_bot_account_per_run`). With 3 bots × 30 scenarios → exactly 3 voices each at count = 30. The reporter's hardcoded 5..12 band was tuned for a scenario that the planner does not actually produce. CORPUS-30-DIVERSITY-001 (#468) covers band recalibration vs assignment-axis change. |
| Samey-move | GREEN (degenerate) | high-overlap pairs = 0; overall mean = 0; max intra-thread mean = 0 | **Known defective.** The runner's `checkSameyMove` live-path computes severity from EXACT `tokenSetHash` equality only (`runXaiAdversarialBotCorpus.js:2210-2236`); the yellow band is hardcoded `false`; `overallMean`/`maxIntraThreadMean` are literal 0 in the returned shape. Two distinct templated bodies almost never produce identical 16-char SHA-256-prefix hashes, so the metric structurally cannot fire RED on real similarity. CORPUS-30-QUALITY-001 (#467) replaces this with a real token-set Jaccard metric with attribution-presence gating. |

---

## 7. Voice + spine distribution (telemetry)

### Voices observed (3 of 8)

| Voice | Count |
|---|---:|
| `analogist` | 30 |
| `scope_narrower` | 30 |
| `plain_skeptic` | 30 |

`mechanism_hunter`, `historical_analogist` (or local equivalents), `definition_pedant`, `evidence_first`, `playable_yielder` — and any synthesizer slot — observed 0. The 8-voice band the reporter was tuned for never materializes because the planner deterministically picks one voice per bot account per run.

### Spines observed (9 of 9, healthy spread, run-wide max share 13%)

| Spine | Count | % of 300 |
|---|---:|---:|
| `definition-led` | 39 | 13.0% |
| `mechanism-led` | 38 | 12.7% |
| `analogy-led` | 37 | 12.3% |
| `question-led` | 35 | 11.7% |
| `quote-led` | 32 | 10.7% |
| `counterexample-led` | 31 | 10.3% |
| `scope-led` | 31 | 10.3% |
| `second-order-effect-led` | 29 | 9.7% |
| `concession-then-pivot` | 28 | 9.3% |

All under the 35% saturation threshold. YELLOW is on the per-thread repeated-thread check at ≥3 occurrences (16 threads) and the low-diversity-windows (2). This is band-tuning territory, not planner regression.

---

## 8. Classifier substrate (Phase 7 distilled)

Phase 7 confirmed:
- Coverage = complete (every arg has runs rows for every A-G family).
- Σ-success = 40.5%; per-family range 27.9-46.4%.
- `disagreement_axis` is the worst-hit family at 27.9% success — likely because it is the second family in registry order and competes for the same MCP worker slot at insert time under bounded concurrency = 2.
- 74.7% of failures are `mcp_api_error`; 25.3% are `mcp_network_error`. `failure_sub_reason` and `failure_detail` jsonb are NULL on the direct-dispatch path (queue-substrate / drainer-only fields).
- H/I/J production leakage = ZERO.

**Read.** The classifier substrate IS observable, the auto-trigger IS firing for the right families, the registry gate IS holding H/I/J — but reliability is below the bar that would justify ramp-percentage advancement. The 40.5% Σ-success rate is a real signal: under burst from 7 families dispatched at bounded-concurrency-2 per insert, the operator-hosted MCP server returns errors on more than half of attempts.

---

## 9. UI surface observations (from earlier session walk-throughs)

- **Admin > Arguments** before `ADMIN-ARGS-INACTIVE-001` (#464 / PR #480) — 300 bot rows + the existing population render flat with no grouping. Bot debates are visually distinguishable only by debate title runTag suffix and existing `BotRoomMarker`. The argument-list UX problem is documented as `ADMIN-ARGS-CANONICAL-001` (#463) — Argument-Artifact grouping is the operator-decision card pending.
- **Admin > Arguments** after `ADMIN-ARGS-INACTIVE-001` ships (PR #480 at operator-merge gate at audit time) — the Inactive column + bulk inactive workflow lets an operator hide bot debates without hard-delete, preserving the "fresh start = filtered view" doctrine.
- **Debate room** — the 30 bot debates render normally; the room-side `ArgumentSideActionRail` (Stage 6.4) treats observers and participants per the standard rules. No bot-specific UX needed.
- **Conversation gallery** — gallery dedupe at debate level collapses the suffix-tagged corpus rooms visually; the 30 corpus rooms appear as ~few "duplicate runs collapsed" cards. This is the existing behavior; no regression observed.

---

## 10. Source distribution by move index (telemetry)

| Move index | Source | Calls / 30 threads |
|---|---|---|
| M1, M2 | seeded banked (no Anthropic, no xAI) | 0 / 60 (by design) |
| M3 - M10 | renderer (Anthropic eligible) | 23 / 240 (~9.6%) |
| M3 - M10 | deterministic_fallback | ~217 / 240 (~90.4%) |
| (whole run) | xAI live | 0 (harvest was previous run) |

**Read.** The renderer's validation stack (length, banned phrases, concession marker, target excerpt, option alignment, spine alignment per regex) rejects most Anthropic outputs after a single retry, falling back to `deterministicSkeletonFill`. The deterministic fallback respects the same banked-pool selections, so move CONTENT remains aligned with the planner — but the model-bred diversity that Anthropic would provide is absent. CORPUS-30-QUALITY-001 (#467) is the card to fix this: add a fallback-reason histogram so the dominant cause of fallback is measurable, then tune the validation thresholds (without lowering bars — §4-T binds).

---

## 11. Bank exhaustion telemetry

The pool-driven planner's banks (`opening_claim_options`, `objection_options`, `evidence_pressure_options`, `alternative_explanation_options`, `concession_or_narrowing_options`, `resolution_pressure_options`) carry per-bank floors (`BANK_FLOORS`) of 4/4/4/3/3/3 options. With 30 threads × 10 moves and the MOVE_PLAN rotation, the run-wide repeated-option count of 1 within-thread and 0 cross-thread indicates the banks are not exhausting under this scale. The `bank_exhausted_reset` event was emitted 0 times (per the reporter `repeated-option` YELLOW row reading 1/0). At a larger scale (100+ threads) the banks WILL exhaust; CORPUS-30-DIVERSITY-001 (#468) discusses bank-floor tuning.

---

## 12. Acceptance-gate invariant — verified

- `src/lib/constitution/engine.ts` is sole gate. (Untouched by this corpus run.)
- `submit-argument` accepted 300 / 300 args.
- The auto-trigger dispatched 7 families per insert via `EdgeRuntime.waitUntil(autoTriggerPromise)` — **after** the insert returned. No classifier blocked or routed any post.
- Phase 7 confirms classifier rows exist post-fact. They are advisory Observations; nothing here is a gate.

This is the most load-bearing single fact in the run. The 300 / 300 success is mechanism evidence that the constitutional invariant scales.

---

## 13. The 30 rows preserved (operator policy)

The 30 debates + 300 args from this run **stay in the database**. Per the operator's "fresh start = filtered view" doctrine and the §8 soft-delete-only rule, mass-delete is not the cleanup mechanism. `ADMIN-ARGS-INACTIVE-001` (#464 / PR #480) gives admins the ability to filter them out of default views without erasing them.

---

## 14. Cross-references + follow-up cards

| Card | GitHub issue | Phase / status |
|---|---|---|
| `PHASE7-OBSERVATION-001` | #465 (PR #482 merged) | Audit doc consumed in §8 above |
| `CORPUS-30-RUN-COMMIT-001` | (no issue; PR #481 merged) | Source reports committed |
| `CORPUS-30-QUALITY-001` | #467 | Fallback-reason histogram + samey-move metric fix |
| `CORPUS-30-DIVERSITY-001` | #468 | Voice / spine tuning |
| `CORPUS-30-BACKLOG-001` (review board) | #474 | Human review board doc |
| `ADMIN-ARGS-INACTIVE-001` | #464 (PR #480 at GATE-C) | Hide bot rows without erasure |
| `ADMIN-ARGS-CANONICAL-001` | #463 | Argument-artifact grouping |
| `OPS-MCP-OBSERVABILITY-002` | #470 | Classifier health panel (consumes `failure_detail`) |
| `MCP-HIJ-000` ledger | #471 | Read-only H/I/J state ledger |
| Burst-hardening follow-up (Phase 7 § 7.1) | not yet filed | mcp_api_error pattern under direct-dispatch |
| Auto-trigger failure_detail fill (Phase 7 § 7.2) | not yet filed | populate `failure_detail` on direct-dispatch terminal failures |

---

## 15. Doctrine attestation

- §1 no truth labels. This doc uses gameplay-mechanism vocabulary only. 300 / 300 is "submission accepted", not "argument correct".
- §2 heat ≠ truth. Mechanism telemetry, never quality.
- §3 popularity not evidence. Synthetic-evidence disclaimer in §1 binds every claim.
- §4 AI moderator advisory-only. Constitutional invariant attested in §12.
- §4-C never-self-approve. No H/I/J flip proposed.
- §4-T no bar lowering. The 40.5% Σ-success rate is reported honestly; no looser threshold applied.
- §5 engine.ts sacred. Untouched.
- §6 secrets. No secret value in this doc.
- §7 no AI from production app. The corpus runner lives in `scripts/bot-fixtures/` only.
- §8 soft-delete only. The 30 rows stay; `ADMIN-ARGS-INACTIVE-001` is the visibility primitive.
- §9 plain-language mapping. Internal codes (`mcp_api_error`, `deterministicSkeletonFill`, `mcp_network_error`, etc.) appear with explicit operator-facing gloss.
- §10a Observations vs Allegations. Classifier rows are Observations; this doc does not promote any to Allegation.
- `policy_no_censorship`. The bot adversarial process treats hostile input as INPUT, not defect. This doc does not propose dissent-detector tightening, semantic redaction, ban-list expansion, or submit-argument validator hardening.

---

## 16. Verdict

The CORPUS-30 30-stage run proves the **submission mechanism + classifier substrate + anti-amplification doctrine + H/I/J freeze** scale to 300 args / 30 debates. The renderer's Anthropic-fallback rate, the classifier substrate's burst-failure rate, and the reporter's samey-move metric are operationally honest yellows / partials that the follow-up cards (`-QUALITY-001`, `-DIVERSITY-001`, `OPS-MCP-AUTO-TRIGGER-BURST-HARDENING-FOLLOWUP`) will address. **Synthetic mechanism PASS; quality + reliability PARTIAL.**
