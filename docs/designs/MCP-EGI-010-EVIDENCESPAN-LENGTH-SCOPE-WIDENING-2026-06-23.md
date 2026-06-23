# MCP-EGI-010 — Widen evidenceSpan length normalizer to post-MCP-EGI-009 burst rawKeys

**Status:** implemented, PR open, awaiting Gate B + merge + deploy.

**Date:** 2026-06-23

**Stack predecessor:** MCP-EGI-009 (key-set completion for 3 rawKeys; merged `c7a5623`, production-verified on Deno Deploy build `97308cj6v5t4`).

**Stack successor:** none committed; depending on next D3 burst outcome, MCP-EGI-011 (invalid_type class fix for `exception_reasoning_present`).

---

## Arithmetic reconciliation (6 vs 7 / 19 vs 20)

The post-MCP-EGI-009 D3 burst final-report prose said "6 newly observed" and "13 → 19", but the underlying failure table listed **7 distinct rawKeys** (multi-occurrence rows on `multiple_claims_present`, `missing_warrant`, and `separates_observation_from_inference` are repeat rows on the same rawKey, not distinct rawKeys). The correct count is:

| Item | Correct value |
|---|---|
| Newly-observed distinct length-overflow rawKeys | **7** |
| Final length-normalizer scope | **13 + 7 = 20** |

This card adds exactly the 7 confirmed rawKeys. The widening is evidence-backed (one or more burst rows per rawKey) and narrow (no categorical expansion).

---

## Burst evidence motivating MCP-EGI-010

Post-MCP-EGI-009 D3 pass-load against debate `4d75daeb-f09a-430d-aa01-3ee6374922c6` (root `bf41d7ec-28b9-45d9-ba36-089c61e1a9fb`, 2026-06-23T05:04:25Z, runId `28eb3908-2d39-4a37-a34a-3de5256ba807`; 8 targets × 9 families = 72 cells). This was the FIRST burst against the verified MCP-EGI-008 + MCP-EGI-009 production deploy.

### Why MCP-EGI-008 and MCP-EGI-009 worked

| Mechanism | In-scope rawKeys | Result |
|---|---|---|
| MCP-EGI-008 length normalizer | 13 | **0 in-scope length residuals**; 4 null-spans recorded; all in-scope positives ≤ 240 chars (max 240 exactly on `names_method_difference`); 48 positives across 12 of 13 rawKeys |
| MCP-EGI-009 key-set completion | 3 | **0 in-scope key-set-missing residuals**; 11 positives across 2 of 3 rawKeys |

Both mechanisms held under burst load. MCP-EGI-010 does NOT change either mechanism or either scope.

### The 7 new out-of-scope length-overflow rawKeys

All 12 unmasked rows carried `mcp_tool_reason = validation_failed` + `mcp_tool_detail_category = evidence_span_length_exceeded`:

| Family | dimension | rawKey | occurrences |
|---|---|---|---|
| A | `parent_relation` | `distinguishes_parent` | 1× |
| B | `disagreement_axis` | `disputes_scope` | 1× |
| C | `misunderstanding_repair` | `offers_candidate_understanding` | 1× |
| D | `evidence_source_chain` | `separates_observation_from_inference` | 2× |
| F | `critical_question` | `missing_warrant` | 2× |
| H | `claim_clarity` | `multiple_claims_present` | 3× |
| I | `thread_topology` | `introduces_sub_axis` | 1× |

Each rawKey verified in its named family registry:
- [`familyAKeys.ts:59`](../../mcp-server/lib/familyAKeys.ts) — `distinguishes_parent`
- [`familyBKeys.ts:62`](../../mcp-server/lib/familyBKeys.ts) — `disputes_scope`
- [`familyCKeys.ts:71`](../../mcp-server/lib/familyCKeys.ts) — `offers_candidate_understanding`
- [`familyDKeys.ts:121`](../../mcp-server/lib/familyDKeys.ts) — `separates_observation_from_inference`
- [`familyFKeys.ts:80`](../../mcp-server/lib/familyFKeys.ts) — `missing_warrant`
- [`familyHKeys.ts:92`](../../mcp-server/lib/familyHKeys.ts) — `multiple_claims_present`
- [`familyIKeys.ts:95`](../../mcp-server/lib/familyIKeys.ts) — `introduces_sub_axis`

All 7 families are members of `KEY_LEVEL_FAIL_CLOSED_FAMILIES` and `banPatternsForKeyLevelFamily()` already composes each family's byte-identical ban-pattern stack.

### What MCP-EGI-010 does NOT include

- **`exception_reasoning_present` (E `argument_scheme`)** — 1× row this burst with `mcp_tool_detail_category = evidence_span_invalid_type` (model emitted a non-string evidenceSpan value, not an overlong string). This is a different validation class and requires either a prompt-side discipline reinforcement OR a server-side type-coercion-to-null pre-validation pass. **Deferred to MCP-EGI-011.**
- **MCP-EGI-009 key-set completion scope** — unchanged at 3 rawKeys (`question_invites_revision`, `action_item_proposed`, `unclear_reference_present`).

---

## Exact final length-normalizer scope (20 rawKeys)

```ts
export const EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS: ReadonlySet<string> = new Set([
  // MCP-EGI-006 (4)
  'tradeoff_reasoning_present',        // E
  'convergent_premise_structure',      // E
  'synthesis_proposed',                // G
  'compares_options',                  // I

  // MCP-EGI-007 (+1)
  'reason_present',                    // H

  // MCP-EGI-008 (+8)
  'contrasts_with_parent',             // A
  'preserves_face_while_disagreeing',  // B
  'provides_alternate_interpretation', // C
  'evidence_gap_present',              // D
  'names_method_difference',           // D
  'analogy_reasoning_present',         // E
  'separates_normative_from_empirical',// G
  'claim_present',                     // H

  // MCP-EGI-010 (+7) — THIS CARD
  'distinguishes_parent',              // A
  'disputes_scope',                    // B
  'offers_candidate_understanding',    // C
  'separates_observation_from_inference', // D
  'missing_warrant',                   // F  (Family F's FIRST length-normalize rawKey)
  'multiple_claims_present',           // H
  'introduces_sub_axis',               // I
]);
```

Set size: **20**. Drift-guard test pins exact sorted list + `size === 20`.

---

## Why this is evidence-backed scope widening, not categorical expansion

The MCP-EGI-006 → 007 → 008 → 010 sequence has only ever added rawKeys with explicit row-level burst evidence (`failure_detail.mcp_tool_reason = 'validation_failed'` + `mcp_tool_detail_category = 'evidence_span_length_exceeded'` + `validator_path = 'evidenceSpan.<rawKey>'`). The locked set never includes a rawKey on speculative grounds.

- The 7 new rawKeys are exactly the 7 distinct length-overflow rawKeys the post-MCP-EGI-009 burst surfaced.
- The 1 invalid_type rawKey from the same burst is OUT of this card's scope (different class).
- The 80-key non-target Family H test (`quantifier_present`) still proves that adjacent Family H rawKeys without burst evidence are NOT normalized.

If a future burst surfaces additional rawKeys with the same length-overflow signature, those get a separate card (MCP-EGI-012, etc.). The framework is permanently evidence-driven.

---

## Why the validator remains UNCHANGED

`validateMcpBooleanObservationResponse` is unchanged. The MCP-EGI-010 widening only adds to the LIST of rawKeys whose evidenceSpan strings get nulled BEFORE validation. The validator's reject-on-overlength still fires for any unnormalized packet (proven per-target by the "doctrine preservation — overlong + banned content NOT normalized" templated test, which calls the real validator on the unnormalized banned packet).

---

## Why the ban-list remains PRESERVED

The widening is BYTE-EQUAL to MCP-EGI-008's doctrine-preservation contract. Per-target test: an overlong evidenceSpan string containing a banned token (`winner` from shared `DOCTRINE_BAN_PATTERNS`) is NOT normalized. The validator's length-reject still fires AND no banned content is silently discarded. This holds for all 7 new rawKeys because each family's ban-pattern stack composes the same `DOCTRINE_BAN_PATTERNS` baseline (Families A/B/C/D use only it; Families F/H/I additionally stack their per-family `FAMILY_<X>_BAN_PATTERNS`).

The ban-list source files are byte-equal vs `c7a5623`:
- `mcp-server/lib/doctrineBanList.ts` UNCHANGED
- `mcp-server/lib/familyA/B/C/D/E/F/G/H/I/JBanListScan.ts` UNCHANGED
- `mcp-server/lib/keyLevelFailClosed.ts` UNCHANGED
- `mcp-server/lib/banScanNormalize.ts` UNCHANGED

---

## Why max cap remains 240

`MAX_EVIDENCE_SPAN_CHARS = 240` is unchanged. The cap is a doctrine boundary — anchor spans should fit in roughly two well-formed sentences. Widening the normalizer to MORE rawKeys does not loosen this constraint; the normalizer still NULLS overlong strings rather than truncating them, and the validator still rejects 241-char strings when the normalizer hasn't been applied (per-target validator-preservation test).

---

## Why max_tokens / retry / capacity / drain pacing are NOT the current lever

The MCP-EGI-010 failures are deterministic per-call validation rejections, not transport/retry/capacity issues:
- `mcp_tool_reason = validation_failed` (server-side per-call decision, not provider 5xx)
- `failure_sub_reason = provider_server_error` (the Edge adapter's masking of `mcp_validation_failed` as `provider_server_error` is intentional pre-MCP-EGI-003; the row-level discriminator carries the real reason)
- Rows survived the drainer's full retry budget; the failure is deterministic per-call
- `FAMILY_E/G/I_MAX_TOKENS = 1500` unchanged — not a truncation issue
- `DRAINER_*` retry / backoff / concurrency unchanged — #782 retained

---

## Logging / no-raw-value policy

Pass 1 (length) event shape (unchanged):
- `event: 'boolean_observations_evidence_span_normalized'`
- `category: 'evidence_span_length_exceeded_to_null'`
- `originalLength`, `maxLength`
- `family`, `rawKey`, `path` (`evidenceSpan.<rawKey>`)
- `schemaVersion?`, `requestId?`

**NEVER carries:**
- the raw evidenceSpan string value (sentinel-pinned leak-audit test)
- the raw packet
- the raw prompt / argument body / model response text
- any bearer / JWT / API-key / service-role / env value

The new MCP-EGI-010 rawKeys flow through the same event-emission code path; no new log shape introduced.

---

## Code surface

### Touched files (4)

| Path | Lines | Purpose |
|---|---|---|
| [`mcp-server/lib/booleanObservationEvidenceSpanNormalizer.ts`](../../mcp-server/lib/booleanObservationEvidenceSpanNormalizer.ts) | +7 set entries + ~40 lines docstring | Add 7 rawKeys to locked set + extended file-level doc |
| [`mcp-server/tests/booleanObservationEvidenceSpanNormalizer.test.ts`](../../mcp-server/tests/booleanObservationEvidenceSpanNormalizer.test.ts) | +50 lines (7 new TARGETS + drift-guard update) | 28 new templated tests (4 per target × 7 new targets) + drift guard 13 → 20 |
| [`docs/designs/MCP-EGI-010-EVIDENCESPAN-LENGTH-SCOPE-WIDENING-2026-06-23.md`](MCP-EGI-010-EVIDENCESPAN-LENGTH-SCOPE-WIDENING-2026-06-23.md) | NEW | this doc |
| [`docs/core/current-status.md`](../core/current-status.md) | +1 entry | top entry |

### Preservation manifest (byte-equal vs `c7a5623`)

- `mcp-server/tools/classifyArgumentBooleanObservations.ts` UNCHANGED — dispatcher Step-3.5 invocation routes by rawKey-membership against the locked set; widening the set alone is sufficient
- `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` UNCHANGED — validator + `MAX_EVIDENCE_SPAN_CHARS = 240`
- `mcp-server/lib/keyLevelFailClosed.ts` UNCHANGED
- `mcp-server/lib/banScanNormalize.ts` UNCHANGED
- `mcp-server/lib/doctrineBanList.ts` UNCHANGED
- All 10 family scanners + prompts + keys UNCHANGED
- `mcp-server/lib/familyRegistry.ts` UNCHANGED — Family I `productionEnabled: true` retained
- `EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS` UNCHANGED at 3 (MCP-EGI-009 byte-equal)
- `FAMILY_E/G/I_MAX_TOKENS = 1500` UNCHANGED
- All retry / drainer / concurrency settings UNCHANGED — `#782` retained
- `supabase/functions/**` / `supabase/migrations/**` / `supabase/config.toml` UNCHANGED
- `src/lib/constitution/**` / `src/domain/constitution/**` UNCHANGED
- `package.json` / lockfile / `app.json` UNCHANGED

### Disjointness preservation

`EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS ∩ EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS === ∅` invariant. The 7 new rawKeys are length-overflow targets, structurally orthogonal to the 3 key-set-missing targets. The bidirectional disjointness test (from MCP-EGI-009) still passes — it loops over both sets and asserts non-membership in the other.

---

## Tests

**Targeted Deno (`tests/booleanObservationEvidenceSpanNormalizer.test.ts`):** **138 / 0** (~26 ms) — was 110 on `c7a5623`, +28 new MCP-EGI-010 templated tests (4 per target × 7 new targets).

Per new rawKey (×7):
1. 241-char string normalized to null + safe event metadata (`category`, `originalLength`, `maxLength`)
2. Exactly 240-char string preserved (boundary)
3. Post-normalization packet validates and observation preserved
4. Doctrine preservation — overlong + banned `winner` content NOT normalized (validator still rejects)

Plus drift-guard update: sorted 20-key list + `size === 20`.

**Full mcp-server Deno:** exit 0.

**npm typecheck:** clean.

**npm lint --max-warnings 0:** clean.

**Full Jest:** (running at PR open time; see PR body for the exact count).

---

## Deploy note: Deno Deploy bearing

MCP-EGI-010 changes are in `mcp-server/lib/` — deploy-bearing on the Deno Deploy production target `cdiscourse-mcp-server`. Merge triggers automatic build via the GitHub integration; production-alias promotion is operator-confirmed via `GATE-DEPLOY/VERIFY mcp-server` (same lane as MCP-EGI-005 through MCP-EGI-009).

This PR does NOT itself deploy. No `npx supabase functions deploy` needed — no Edge functions changed.

---

## Next D3 burst after deploy

D3 remains FAIL until:
1. PR merged + Deno Deploy production alias verified on the new build.
2. D3 burst rerun on the post-deploy revision exercises BOTH the 20-key length normalizer AND the 3-key key-set completion.

Possible outcomes:
- **PASS:** all 72 cells succeed. The 20-key length scope clears the rerun, the 3-key key-set scope clears the rerun, and no new validation class surfaces.
- **PARTIAL PASS:** length + key-set residuals both clear; any remaining residuals point to a different validation class — most likely the deferred `evidence_span_invalid_type` on `exception_reasoning_present` (would activate MCP-EGI-011) OR yet-newer length-overflow rawKeys (would seed MCP-EGI-012).
- **FAIL (regression):** any in-scope rawKey fails on the new revision → deploy or merge regression.
- **FAIL (new class):** new validation class outside both locked sets → evidence-driven next card.

D4 remains BLOCKED until D3 PASS.

---

## Doctrine anchors

- `cdiscourse-doctrine §1` — null-normalization of an overlong anchor asserts NOTHING; the model's observation + confidence remain its stated finding; only the structural anchor is removed for length reasons.
- `cdiscourse-doctrine §10a` — observations vs allegations; nulling a compound anchor on length is a STRUCTURAL act, not a quality verdict.
- OPS-MCP-KEY-LEVEL-FAIL-CLOSED — no divergence from family scanner ban-pattern stacks; each new rawKey's family uses the byte-identical stack the family's scanner builds.

---

## Operator-controlled gates remaining

- Gate B independent review of PR (next gate after this card's open).
- Gate merge.
- `GATE-DEPLOY/VERIFY mcp-server`.
- D3 burst rerun.
- D4 rerun (BLOCKED until D3 PASS).
