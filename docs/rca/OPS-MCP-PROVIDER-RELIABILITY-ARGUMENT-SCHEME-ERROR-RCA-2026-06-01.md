# OPS-MCP-PROVIDER-RELIABILITY-ARGUMENT-SCHEME-ERROR-RCA — read-only RCA (2026-06-01)

Audit-Lint: v1
Audit-type: rca

**Date:** 2026-06-01 UTC
**Operator:** Kyler
**Card:** OPS-MCP-PROVIDER-RELIABILITY-ARGUMENT-SCHEME-ERROR-RCA
**Issue / trail:** #373 (cutover umbrella); follow-up from PR #416 queue-load-smoke FAIL
**Base HEAD at execution:** `b6d351e` (PR #416 merge — queue-load-smoke FAIL audit)
**Mandate type:** Read-only, docs-only — no code, migration, retry policy, drainer cap, family-registry, MCP server, prompt, source-6, schema-mirror, or package change.

**Scope:** Characterize why the `argument_scheme` family (a.k.a. Family E) has been the dominant `provider_server_error` victim across six successive load-bearing drills (2026-05-29 → 2026-06-01), most recently producing 3/56 dead-letter cells in the queue-load-smoke (PR #416). This RCA does NOT propose code changes. It documents the failure-class signature, ranks hypotheses by evidence weight, identifies observability gaps that prevent a definitive root cause, and recommends concrete probes the operator may authorize as separate follow-up cards.

**Verdict:** **FINDINGS — no single hypothesis confirmed; six probes recommended.** The diagnostic gap is structural (the queue table persists no inner `serverReason` from the MCP server's isError envelope), so this RCA cannot conclusively choose between the three plausible root causes. The most actionable next step is **(R1) — add a `failure_detail` JSON column to `argument_machine_observation_runs`**, which would distinguish Anthropic 5xx from MCP-side validation rejection on the next drill.

---

## 1. The pattern

`argument_scheme` is the consistent #1 victim of the `mcp_api_error` / `provider_server_error` failure class. Cross-drill evidence:

| Drill (date) | Audit | `argument_scheme` failures | Other family failures | Failure-class signature |
|---|---|---:|---|---|
| BURST-HARDENING-PHASE4-SMOKE (2026-05-29) | `docs/audits/OPS-MCP-RESULT-VALIDATION-BURST-HARDENING-PHASE4-SMOKE-2026-05-29.md` | 1 cell × 2 attempts ({isError} both) | critical_question 1 cell terminal | hot-window retry re-entered before transient resolved |
| RETRY-TUNING-PHASE4-SMOKE (2026-05-30) | `docs/audits/OPS-MCP-RESULT-VALIDATION-RETRY-TUNING-PHASE4-SMOKE-2026-05-30.md` | 1 cell × 2 attempts ({isError} both) | evidence_source_chain 1 cell | deep overload pocket; 7–10s backoff insufficient |
| ARCH-001-CARD2-SMOKE (2026-05-31) | `docs/audits/ARCH-001-CARD2-SMOKE-2026-05-31.md` | 1 cell × 3 attempts → dead_letter | — | provider_server_error / retry_attempts_exhausted |
| ARCH-001-CARD3-SMOKE (2026-05-31) | `docs/audits/ARCH-001-CARD3-SMOKE-2026-05-31.md` | 4 cells (2, 3, 3, 4 attempts) | — | provider_server_error / retry_attempts_exhausted; mean lifecycle 396–795s |
| MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE (2026-06-01) | `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md` | 5 cells across canary + 3 burst args | claim_clarity 2, critical_question 2, disagreement_axis 2 | legacy direct-dispatch; H-ENABLE smoke FAIL (terminal coverage hole that triggered the cutover) |
| **QUEUE-LOAD-SMOKE (2026-06-01)** | `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-2026-06-01.md` (PR #416) | **3 cells × 4 attempts → all dead_letter** | **0 on other A-G families** | **provider_server_error / retry_attempts_exhausted; single-family clustering; queue path bounded by C=3** |

The pattern crosses two distinct dispatch architectures (legacy direct-dispatch in the H-ENABLE smoke; ARCH-001 queue path in the recent four drills) and three retry policies ([2, 8]s burst-hardening, [30, 120]s queue-path, [60, 180, 360]s legacy). Across all six drills, `argument_scheme` carries 15 of the recorded ~24 attributable provider_server_error / mcp_api_error cells — ≈ 62% — despite being one of seven equally-fanned A-G production families (expected baseline 14%).

The cross-architecture, cross-retry-policy persistence rules out "drainer concurrency" or "retry backoff" alone as the proximate cause. Whatever drives the elevated rate is something specific to `argument_scheme` itself.

## 2. The failure-class signature

For the QUEUE-LOAD-SMOKE drill (the most recent and most instrumented):

- failure_reason = `mcp_api_error` (top-level)
- failure_sub_reason = `provider_server_error` (the typed enum)
- dead_letter_reason = `retry_attempts_exhausted`
- attempt_count = 4 (full retry exhaustion under DRAINER_MAX_ATTEMPTS = 4)
- All 3 dead-letter cells: same family (`argument_scheme`)
- All 3 dead-letter cells: last_attempt_at = `2026-06-01T15:31:01.067493Z` (same drainer tick claimed the 4th attempt for all three)
- Lifecycle 809–810s (claim → terminal)

The failure_sub_reason `provider_server_error` is defined in `supabase/functions/_shared/booleanObservations/booleanObservationFailureSubreason.ts:71` as "body-level `{ isError }` envelope (Phase 3)". Per the design comment in `supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts:253-274`:

> "OPS-MCP-RESULT-VALIDATION-BURST-HARDENING (Phase 3): detect the MCP server's OWN error envelope BEFORE the schema validator. Under concurrent load the server returns `{ isError, reason, path, detail }`; routing it through parseMcpBooleanObservationResponse mis-types it as `response_wrong_schema_version` (it has no schemaVersion — Phase 2). It is a provider/server transient — type it `provider_server_error`, carry it on the existing `api_error` reason..."

This means `provider_server_error` collapses ANY MCP-server-side `{ isError: true }` envelope into a single typed reason, regardless of what the inner `reason` field actually was. The inner reason could be:
- `api_error` — MCP server's downstream Anthropic call failed (HTTP 5xx, network, timeout)
- `validation_failed` — MCP server's packet schema validator rejected the model response
- `validation_failed` (via ban-list scan path) — MCP server's family-specific ban-list scan rejected an evidenceSpan or modelInfo field
- `unsupported_family` / `unsupported_rawKey` / `invalid_params` — defensive MCP-side input rejection (unlikely under our request shape)
- `unknown` — adapter exception path

**We cannot distinguish these from the queue table.** The schema (per the diagnostic at `.claude-tmp/load-smoke-queries/diag-runs-schema.sql`) carries only the typed text columns `failure_reason` / `failure_sub_reason` / `dead_letter_reason`. There is no JSON column persisting the `BooleanObservationFailureDetail` interface — which the adapter does construct in code (`booleanObservationMcpAdapter.ts:269-274` builds `serverReason` + `path` + `receivedKeys` into a `buildFailureDetail(...)` result) but the drainer (or upstream caller) discards before persistence.

This is the single largest diagnostic gap that this RCA surfaces.

## 3. Structural facts ruled OUT as the proximate cause

The following surface differences were checked and **do NOT** explain why `argument_scheme` is the chronic victim:

| Surface | Family E | Other A-G | Verdict |
|---|---|---|---|
| Prompt file size | 245 lines / 11,665 bytes | A: 195/8292 · B: 222/9788 · C: 241/11053 · D: 269/12584 · F: 279/14231 · G: 270/14149 · H: 289/15188 | E is **middle of pack**; F/G/H/D are larger. Refutes "large prompt" hypothesis. |
| Output schema keys file | 371 lines / 25,814 bytes | A: 346/21298 · B: 315/22024 · C: 374/26375 · D: 456/27040 · F: 339/26653 · G: 446/31096 · H: 315/25234 | E is middle of pack. Refutes "large schema" hypothesis. |
| MAX_TOKENS | 1500 | A/B/C/F/G/H: 1500 · D: 1800 | E is **identical** to A/B/C/F/G/H. Refutes "tighter output budget" as proximate. |
| Temperature | 0 | All: 0 | Identical. |
| Raw key count | 16 | A: 16 · B: 14 · C: 17 · D: 25 · F: 14 · G: 18 (ai_classifier) · H: 12 | E is middle of pack. |
| Estimated output utilization | 16 × ~85 = ~1360 / 1500 = **91%** | A: 16 × ~80 = 1280 / 1500 = 85% · C: 17 × ~85 = 1445 / 1500 = **96%** · F: 14 × ~85 = 1190 / 1500 = 79% | E is **second-tightest** behind C. C should be a chronic victim if budget pressure were proximate — it is not. |
| Anthropic adapter | 51 lines | A: 48 · B: 48 · C: 48 · D: 52 · F: 52 · G: 53 · H: 53 | E is middle of pack. |
| MCP_FETCH_TIMEOUT_MS | 15000 (single global) | All same | No family-specific timeout. |

## 4. Structural facts that PLAUSIBLY contribute (but are not confirmed)

### 4a. Family E has the most aggressive family-specific ban-list scan

`mcp-server/lib/familyEBanListScan.ts` (128 lines) adds 11 family-specific patterns ON TOP OF the shared `DOCTRINE_BAN_PATTERNS`. Comparison:

| Family | Scan file lines | Family-specific patterns | Common-English-word patterns |
|---|---:|---:|---|
| A (parent_relation) | 61 | 0 | — |
| B (disagreement_axis) | 64 | 0 (uses shared only) | — |
| C (misunderstanding_repair) | 65 | 0 (uses shared only) | — |
| D (evidence_source_chain) | 75 | small additions | — |
| **E (argument_scheme)** | **128** | **11** (largest set) | **`invalid` (standalone), `wrong` (standalone), `flawed` (standalone), `weak argument`, `bad reasoning`, `flawed reasoning`, `logical error`, `informal fallacy`, `proof of`, `fallacy`, `fallacious`** |
| F (critical_question) | 147 | yes (largest line count, but mostly domain-specific) | — |
| G (resolution_progress) | 175 | yes (largest line count, mostly scope-specific) | — |
| H (claim_clarity) | 168 | yes | — |

E's family-specific patterns include several **common English words** (`invalid`, `wrong`, `flawed`) that any prose evidenceSpan could plausibly contain. Per the design comment in `familyEBanListScan.ts:38-46`:

> "Why Family-E-scoped and not shared: 'invalid' may legitimately appear in Family B disputes_validity evidenceSpans ... Promoting 'invalid' to the shared list would break Family A/B/C/D outputs."

So `invalid` was deliberately scoped to E only because it conflicts with other families' normal output — but THIS scoping makes E's ban-list strict in a way no other family's is. If the model anchors an evidenceSpan on input text containing "wrong", "invalid", or "flawed", the scan rejects.

**Mitigation strength against THIS drill specifically:** the 20 burst-body templates (`.claude-tmp/queue-load-smoke-burst.cjs:83-171`) are civic / public-records / transit / urbanism prose; grep finds **zero matches** for any of `wrong`, `invalid`, `flawed`, `fallacy`, `fallacious`, `bad reasoning`, `logical error`, `proof of`, `weak argument`. So if the rejection happened via this path, the offending token came from the **model's own response wording** in evidenceSpan or modelInfo (not echoed from input body) — possible but not directly evidenced.

### 4b. Family E's prompt has the most extensive "doctrine-risk" framing

Per `familyEPrompt.ts:21-95`, the E system prompt carries:

- Explicit doctrine-risk anchors for three schemes (slippery_slope, abductive_explanation, analogy_reasoning) instructing the model to NEVER use "fallacy / fallacious / weak / invalid / flawed / wrong / bad reasoning / logical error / proof of" in evidenceSpan
- A conservative-positives bias reminder (schemes are usually sparse; 0–2 schemes per move)
- Cross-family pointer ("critical questions live in Family F, not here")

This makes E's prompt structurally distinct from other A-G families in TWO ways:
- E explicitly enumerates forbidden vocabulary that the ban-list scan then enforces — a closed loop
- E asks the model to perform meta-reasoning ("classify the inferential PATTERN; do NOT label it as a fallacy"), which other families do not require

If the model occasionally violates the doctrine-risk instruction under burst load (e.g., the model "thinks" a slippery-slope detection requires the word "fallacy" to justify its evidenceSpan), the response is rejected by `familyEBanListScan`. This is a model-behavior hypothesis, not a code defect — but it would explain the cross-drill consistency. Other families don't have this closed-loop fail mode because their ban-lists don't enforce common English vocabulary.

### 4c. Family E's request shape may map to a specific Anthropic backend slice

Speculative but consistent with the data: Anthropic backend load-balancing may route requests by prompt signature (token-shape fingerprint). If Family E's system+user prompt always produces a similar signature, multiple concurrent E calls may queue on the same backend slice. Under burst, this slice could 429 / 5xx independently of the others. This is unverified — Anthropic does not publish backend routing internals.

## 5. Ranked hypotheses (read-only inference)

Cross-drill evidence is consistent with **multiple hypotheses sharing responsibility** rather than a single dominant cause. Ranked by combined evidence weight:

**H1 — Family-E ban-list scan rejects model-generated evidenceSpans more often than other families' scans** (HIGH evidence weight; needs persistence-side observability to confirm).

- E's family-specific ban-list is uniquely strict on common English vocabulary (`invalid`, `wrong`, `flawed`)
- E's prompt explicitly forbids the same tokens, creating a closed enforcement loop
- Cross-drill consistency aligns with a model-behavior issue (occasional doctrine-instruction violation under burst load) rather than a code defect
- Refutation if confirmed: would predict failure_sub_reason should distinguish ban-list vs Anthropic-5xx; the Phase-3 hardening collapsed both into `provider_server_error`, hiding this signal

**H2 — Anthropic backend transient instability on E's prompt signature** (MEDIUM evidence; speculative on Anthropic-side; testable via fixture-mode probe).

- Cross-architecture consistency (E victim on legacy direct-dispatch AND queue path) suggests a provider-side rather than dispatch-side cause
- Single-tick clustering in QUEUE-LOAD-SMOKE (all 3 last_attempt_at = 15:31:01.067) could be a load-balancer hot-window effect, but this is one observation
- Refutation if confirmed: would predict fixture-mode burst (no Anthropic call) should NOT show argument_scheme bias

**H3 — Output-token-budget pressure on E's response** (LOW-MEDIUM evidence; structurally plausible but contradicted by Family C).

- E utilizes ~91% of MAX_TOKENS at 16 × ~85 = ~1360
- C utilizes ~96% at 17 × ~85 = ~1445 and is NOT a chronic victim
- Truncation would map to `response_wrong_shape` not `provider_server_error` UNLESS the MCP server detects truncation and emits isError → typed as provider_server_error (possible)
- Refutation if confirmed: would predict raising MAX_TOKENS for E specifically (e.g., to 1800 like D) reduces the rate

**H4 — Anthropic prompt-cache or rate-limit interaction with E's request signature** (LOW evidence; speculative).

- Tier-1 Anthropic accounts may have per-prompt-hash rate limits we're unaware of
- Cross-drill consistency could indicate Anthropic's internal handling
- Unverifiable without Anthropic-side telemetry

**H5 — MCP server internal race on Family E specifically** (LOW evidence; would require code defect specific to E's handler).

- Tested by: searching for E-specific code paths beyond prompt + ban-list scan. None found in the dispatcher (`classifyArgumentBooleanObservations.ts:297-363`) — E shares the same dispatch shape as A/B/C/D/F/G/H
- Refutes H5 by structural symmetry; the dispatcher is generic

## 6. Diagnostic gaps (this RCA's primary finding)

The queue table `public.argument_machine_observation_runs` is missing the structured `failure_detail` field that the in-code `BooleanObservationFailureDetail` interface defines (`booleanObservationFailureSubreason.ts:107-131`). The adapter builds the detail (serverReason / path / receivedKeys / etc.) and returns it, but no persistence path captures it. Result: post-mortem cannot distinguish the four `{isError}` causes.

| Persisted field today | Status | Gap |
|---|---|---|
| `failure_reason` (text) | Present (e.g., `mcp_api_error`) | Coarse rollup |
| `failure_sub_reason` (text) | Present (e.g., `provider_server_error`) | Typed enum, but collapses the 4 inner causes per Phase-3 hardening |
| `dead_letter_reason` (text) | Present (e.g., `retry_attempts_exhausted`) | Terminal-state label |
| `failure_detail` (jsonb) | **MISSING** | Would carry `serverReason`, `path`, `receivedKeys`, `validatorReason` — distinguishes H1 from H2 |

Additional gaps:
- MCP server-side per-isError-emission structured log (would link request → serverReason in observability tooling without a DB schema change)
- Anthropic response timing + status capture on success path (would let us see if E's mean latency or status distribution differs from other families)
- Fixture-mode burst harness (would isolate Anthropic-side vs MCP-internal causes)

## 7. Recommended probes (each operator-gated; this RCA proposes only)

This RCA recommends six probes. Each is an operator-gated follow-up card; this RCA does NOT execute or schedule them.

| ID | Probe | Type | Distinguishes |
|---|---|---|---|
| R1 | Add `failure_detail` jsonb column to `public.argument_machine_observation_runs`; route adapter's existing `buildFailureDetail(...)` output into it; persist `serverReason` + `path` + `receivedKeys` + `validatorReason` per terminal cell | migration + drainer wiring | H1 vs H2 vs H3 (post next drill) |
| R2 | Read-only audit: scan `mcp-server/` runtime logs for per-isError-emission entries and characterize the distribution of inner `reason` values for `argument_scheme` calls | docs-only (operator pulls logs) | H1 vs H2 (if MCP server logs are retained at sufficient depth) |
| R3 | Add structured log line in `mcp-server/tools/classifyArgumentBooleanObservations.ts` `errorResult(...)` path that emits family + inner-reason + correlation_id — backfills observability without changing on-disk schema | code (one log statement) | Same as R1 but cheaper to ship |
| R4 | Fixture-mode burst: set `MCP_SERVER_USE_FIXTURE_PROVIDER=true` and run the same N=8 burst; if argument_scheme STILL fails, the issue is MCP-internal (H1 / H5); if it succeeds, the issue is Anthropic-side (H2 / H4) | live drill (operator-authorized; no Anthropic spend) | Definitively partitions provider-side from MCP-internal causes |
| R5 | After R1/R3 ship: rerun queue-load-smoke and read the distribution of `failure_detail.serverReason` per family. Confirm H1 / H2 directly | live drill | Confirms top hypothesis |
| R6 | If R5 confirms H1: review whether `familyEBanListScan` should be loosened (e.g., remove the `wrong` / `invalid` / `flawed` standalone patterns) or whether the E prompt should be tightened to reduce model-side doctrine violations. Doctrine review required | docs + design | Long-term fix path |

Recommended order: R3 → R5 → R1 (production-grade persistence) → R4 (provider partition) → R2 (log archeology if available) → R6 (doctrine review).

## 8. What this RCA does NOT do

- Does NOT modify source code, migrations, retry policy, drainer concurrency, family registry, MCP server, prompts, ban-list, schema mirror, or package files.
- Does NOT propose a Stage 1 routing flip. Stage 1 remains UNAUTHORIZED per the PR #416 verdict.
- Does NOT re-enable Family H production. H remains production-disabled per `familyRegistry.ts:106`.
- Does NOT start Family I. I remains scoping-only.
- Does NOT execute any of the recommended probes — each probe is an operator-gated follow-up card.
- Does NOT claim a definitive root cause. The diagnostic gap (no `failure_detail` persistence) blocks definitive attribution.

## 9. Provenance + boundary compliance

- **CC provider-spend invocations this card:** **0**. No `submit-argument` / `classify-argument-boolean-observations` / MCP / Anthropic / xAI / X API call.
- **CC writes (DB):** **0**. Read-only `SELECT` SQL via `npx supabase db query --linked --file <path>`. Five diagnostic queries added in-flight (`diag-retry-scheduled.sql`, `diag-state-breakdown.sql`, `diag-failure-detail.sql`, `diag-runs-schema.sql`, `diag-timing-trace.sql`); all under `.claude-tmp/load-smoke-queries/` (gitignored); all pass `assert-read-only.cjs` (zero INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE/GRANT/REVOKE/MERGE/COPY/CALL/EXECUTE; zero `evidence_span` SELECT).
- **CC writes (file system):** this RCA doc under `docs/rca/`. No edits to `supabase/`, `src/`, `app/`, `mcp-server/`, `package.json`, `scripts/`, migrations, `familyRegistry.ts`, retry policy, drainer constants, prompts, ban-list files, schema mirror, or any runtime flag.
- **Mutations:** **0** by CC. No env / Vault / cron / percentage / routing-flag change.
- **Routing flag at RCA time:** `CLASSIFIER_QUEUE_ROUTING_ENABLED = false` (operator-attested stand-down at 2026-06-01T17:28:03Z; verified inert in PR #416 Phase (f)). Percentage stays 0.
- **Family roster at RCA time:** A-G production-enabled; H/I/J production-disabled (`familyRegistry.ts` lines 96 / 101 / 106 / 111 / 116 — all confirmed in PR #416 Phase 0).
- **Burst harness:** NOT executed this card. The `.claude-tmp/queue-load-smoke-burst.cjs` artifact from PR #416 was not re-run.
- **Boundary attestation:** zero source / migration / cron / Vault / percentage / familyRegistry / package / retry-policy / drainer / ban-list / prompt / schema-mirror change by CC. RCA stays in `docs/rca/`.
- **Output discipline:** no JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / prompt text / raw provider payloads written to this audit.

## 10. Follow-up tracking

- The six probes in §7 are recommendations only; operator decides which to schedule and in what order.
- This RCA closes the OPS-MCP-PROVIDER-RELIABILITY-ARGUMENT-SCHEME-ERROR-RCA card as **FINDINGS** (read-only mandate fulfilled). Subsequent execution is operator-territory.
- Family H production retry remains gated. No Stage 1.
- The chronic argument_scheme victim pattern is the only follow-up blocker; once the next drill (post-R1/R3) attributes the inner cause, the cutover umbrella can move forward with a targeted mitigation rather than a blind retry.
