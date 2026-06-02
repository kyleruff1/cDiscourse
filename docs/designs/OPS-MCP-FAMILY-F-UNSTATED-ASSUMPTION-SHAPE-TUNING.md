# OPS-MCP-FAMILY-F-UNSTATED-ASSUMPTION-SHAPE-TUNING — design (2026-06-02)

**Status:** Design draft — **DESIGN ONLY. No runtime source change in this card.**
**Epic:** Epic 12 / MCP semantic-referee track (ARCH-001 + OPS-MCP provider-reliability hardening)
**Trail:** #373 (cutover umbrella); PR #421/#423 (the STRICT RESPONSE-SHAPE CONTRACT + rule-6 mitigation pattern this card extends); PR #429 (Stage-1 synthetic launch-qualification — the burst that surfaced the residual); PR #432 (`failure_detail` persistence — makes future recurrences DB-readable); the R3 disambiguation of dead-letter `9ef5aab5`.

> **Sibling to** `docs/designs/OPS-MCP-FAMILY-E-RESPONSE-SHAPE-TUNING.md` (E mitigation) and the families-E-F tuning that shipped in PR #423. This card extends the exact same proven pattern to **one additional Family-F rawKey** that the R3 logs proved is an uncovered residual.

---

## 1. Why this card exists (R3 evidence — the smoking gun)

The Stage-1 synthetic launch-qualification (PR #429) produced exactly one terminal dead-letter: argId `9ef5aab5…`, family `critical_question`, `state=dead_letter`, `attempt_count=4`, `dead_letter_reason=retry_attempts_exhausted`. The queue row recorded `failure_reason=mcp_api_error` / `failure_sub_reason=provider_server_error`, which (per the #429/#431 audits) was read as a provider-side 5xx.

The Deno Deploy **R3 logs** (`boolean_observation_tool_error` events, read-only, 2026-06-02T08:32–08:48Z window) disambiguated the inner cause. Safe aggregates (no body/prompt/evidence_span text/payload):

- **5 `boolean_observation_tool_error` events** in the window; **5/5 `reason = validation_failed`** — **0 × `provider_server_error`** in the R3 log.
- **5/5 co-occurred with `boolean_observations_packet_invalid`** (the packet-shape signature).
- **0 `doctrine_ban_list` co-occurrences** (not a ban-list issue).
- **61 `anthropic_call_success` events with `httpStatus=200`**, the earliest (08:32:02) preceding the first failure (08:33:40) — the provider was healthy; the failure is downstream MCP-021A packet validation.
- **`critical_question` path = `evidenceSpan.unstated_assumption`, count = 4** (= `9ef5aab5`'s four attempts, all failing on the same rawKey).
- `argument_scheme` path = `evidenceSpan.abductive_explanation_present`, count = 1 (recovered on retry; E finished 8/8 — see §3).

**Verdict: packet/schema residual, not provider-side, not ban-list.** `9ef5aab5` was **synthetic** (smoke-tagged N=8 qualification burst; `organic_non_smoke_routed_args = 0` since arm), so it is **not** a Stage-1 organic-rollback trigger — but it is a real, reproducible Family-F mitigation gap.

## 2. Why the queue row looked like `provider_server_error`

The Edge adapter (`booleanObservationMcpAdapter.ts`) buckets **any** MCP server `{ isError, reason, path }` envelope as `subReason = 'provider_server_error'`, and stuffs the *real* inner reason into `detail.serverReason` + the field path into `detail.path`. So a genuine Anthropic 5xx **and** a packet-shape validation failure both surface as `provider_server_error` in the queue row. The distinguisher (`reason=validation_failed` + `path=evidenceSpan.unstated_assumption` + `packet_invalid`) lives only in the **R3 Deno log** and — going forward — in the **`failure_detail`** column (PR #432). `9ef5aab5` predates the #432 deploy, so its `failure_detail` is NULL; the disambiguation required the Deno log. This is the exact same illusion that made the original `argument_scheme` cluster *look* provider-side until R3 (PR #418) revealed `validation_failed`.

## 3. Why the retry budget exhausted (deterministic, not transient)

All **4** of `9ef5aab5`'s attempts failed on the **same** path (`evidenceSpan.unstated_assumption`) with the **same** reason (`validation_failed` + `packet_invalid`). A deterministic same-path failure across all four attempts is **not** a transient the 4-attempt retry budget can absorb — the model keeps producing the same malformed packet for that rawKey.

Contrast the lone `argument_scheme` event in the same window (`evidenceSpan.abductive_explanation_present`): it failed **once** then **recovered on retry** (E finished 8/8). The difference is the mitigation: PR #421/#423 added **per-rawKey rule-6 RAWKEY-SHAPE REINFORCEMENT** for E's `abductive_explanation_present` and F's `alternative_explanation_available` — **but not for F's `unstated_assumption`** (`familyFPrompt.ts:299-312` names only `alternative_explanation_available`). `unstated_assumption` is a real Family-F rawKey (`familyFKeys.ts:70,132`, `ai_classifier`) with **no** targeted reinforcement → the residual.

## 4. Relationship to #432 (failure_detail) and the cutover chain

- **PR #432** (now deployed): future `critical_question` `provider_server_error` cells persist `detail.serverReason` + `validator_path` straight to `failure_detail`, so the next recurrence is a one-query DB read — no Deno-log pull needed. This card's fix reduces the *rate* of such failures; #432 makes any residual *observable* in the DB.
- **PR #421/#423** established the pattern this card mirrors. **PR #425/#426** PASS-LOAD drills had zero terminal failures because their transient floor landed on *covered* rawKeys; `9ef5aab5` is the first observed exhaustion on an *uncovered* F rawKey.

## 5. Proposed fix (the implementation card — NOT this card)

Mirror the existing rule-6 pattern exactly, for one more rawKey:

- In `mcp-server/lib/familyFPrompt.ts`, add a **RAWKEY-SHAPE REINFORCEMENT** clause for **`evidenceSpan.unstated_assumption`**, identical in form to the existing `alternative_explanation_available` clause (rule 6, lines 299-312). **Number it as a new rule (e.g. rule 7)** so it does not collide with rule 6, and mirror rule 6's exact 5-part shape (header naming the key · allowed values: string ≤ 240 chars / `null` · forbidden: object / array / boolean / number / missing · `true`→string, `false`→`null` · the closing `evidenceSpan.unstated_assumption` validator-path sentence):
  - Explicitly state the allowed value: **a JSON string ≤ 240 chars OR `null`**.
  - Explicitly **forbid** object, array, boolean, number, and a missing entry.
  - `null` when `observations.unstated_assumption` is false; a single string ≤ 240 chars (or null if no anchoring span) when true.
- Keep `FAMILY_F_SYSTEM_PROMPT`, `FAMILY_F_MAX_TOKENS` (1500), the STRICT RESPONSE-SHAPE CONTRACT block, and all other rawKeys **byte-equal** except the additive reinforcement clause.
- **Doctrine guard (shape-only).** The new clause is JSON-type-shape reinforcement **only** — it MUST NOT introduce any quality / verdict / fallacy framing. The existing `unstated_assumption` doctrine guard (`familyFKeys.ts:144-145`, which forbids `fallacy` / `weak` / `invalid` / `flawed` tokens in the evidenceSpan) stays intact, enforced by the isolated banned-token (doctrine) scan named in the Tests below.
- **No validator relaxation, no ban-list relaxation, no schema-mirror change, no key change, no taxonomy change** — the validator already rejects the malformed shape (that is *why* the cell dead-letters); the fix is to make the model emit the correct shape, not to loosen the gate.

### Tests (part of the implementation card's deliverable)
- `mcp-server/tests/familyFPrompt.test.ts`: a new test anchoring the `unstated_assumption` RAWKEY-SHAPE REINFORCEMENT heading + the allowed-string-or-null enumeration + the forbidden-object/array/boolean/number language + an isolated banned-token (doctrine) scan of the new clause.
- `mcp-server/tests/familyFResponseValidator.test.ts`: regression(s) proving `evidenceSpan.unstated_assumption` as object / array / boolean / number is rejected, and string-≤240 / null is accepted (mirror the `alternative_explanation_available` cases shipped in PR #423).

## 6. Verification (for the implementation card)

- Targeted Family-F Deno tests (`deno test` on the F prompt + validator suites).
- Full MCP Deno test suite.
- `npm run typecheck` · `npm run lint` · `npm run test` (Jest).
- Secret / provider-endpoint / leak scans on the touched files.
- `audit-lint` on the implementation card's audit.
- **Deploy step (operator):** push `cdiscourse-mcp-server` to Deno Deploy after merge (the merge-auto-deploy covers `supabase/functions/` only, not `mcp-server/`).
- Hosted MCP smoke `scripts/mcp-server-001-smoke.sh` → **23/23 PASS**.
- N=1 canary + N=8 load smoke (operator-gated synthetic spend, canary-then-burst discipline) to confirm `evidenceSpan.unstated_assumption` no longer dead-letters; read the persisted `failure_detail` (now live) on any residual.

## 7. Boundaries (binding)

- **DESIGN ONLY in this card** — no `mcp-server/` runtime change, no prompt change in this PR. The implementation is a **separate operator-authorized mitigation card**.
- No Family H/I/J enablement. No advance above 1% / no 5% authorization. No `familyRegistry` change.
- **No validator relaxation. No ban-list relaxation.** The validator/ban-list are working correctly; the fix is prompt-side shape reinforcement only.
- No prompt changes while Stage 1 is live **unless the operator explicitly authorizes an emergency mitigation**. (Stage 1 is currently **CLOSED at `PASS-STAGE-1-PLUMBING` and disarmed to baseline** — see the Stage-1 audit — so the implementation card can proceed under a normal operator authorization rather than an emergency one.)
- No secret / body / prompt / evidence_span text / raw provider payload in any artifact — only the structural R3 aggregates above.

## 8. Open questions

1. **Scope of the reinforcement sweep:** should the implementation card reinforce **only** `unstated_assumption` (the one proven residual), or proactively cover the remaining F ai_classifier rawKeys without targeted reinforcement (`missing_warrant`, `analogy_mapping_missing`, `consequence_probability_unclear`, …) in the same pass? Recommendation: start with `unstated_assumption` (evidence-driven, minimal blast radius), and let the next load drill surface any further residual now that `failure_detail` makes them DB-visible.
2. **Token budget:** `FAMILY_F_MAX_TOKENS` stays 1500 (the failure is shape-correctness, not truncation — same finding as PR #423's E/F tuning). Confirm no bump needed.
