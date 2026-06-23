# MCP-EGI-012 — Categorical evidenceSpan length normalization for valid family rawKeys

**Status:** implemented, PR open, awaiting Gate B + merge + deploy.

**Date:** 2026-06-23

**Stack predecessor:** MCP-EGI-010 (length scope widened 13 → 20, merged `dba3293`, production-verified on Deno Deploy build `6hnrgszgahev`).

**Stack successor:** none committed. MCP-EGI-011 (`exception_reasoning_present` invalid-type fix) remains independently advanceable; did not recur in the D3-010 burst.

---

## Why narrow allowlist widening was not converging

The MCP-EGI-006 → 007 → 008 → 010 trajectory grew the hand-maintained `EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS` allowlist as follows:

| Card | Set size | Net add | Trigger burst |
|---|---|---|---|
| MCP-EGI-006 | 4 | +4 (E/E/G/I) | D3 canary on `26fbeb1` |
| MCP-EGI-007 | 5 | +1 (H `reason_present`) | D3 canary on post-006 |
| MCP-EGI-008 | 13 | +8 (A/B/C/D/D/E/G/H) | D3 burst on post-007 |
| MCP-EGI-010 | 20 | +7 (A/B/C/D/F/H/I) | D3 burst on post-009 |
| **D3-010** | n/a | **+10 NEW** out-of-scope rawKeys surfaced | D3 burst on post-010 |

Each successive burst surfaced 7-10 new previously-unobserved rawKeys with the same overflow signature (`mcp_tool_reason=validation_failed` + `mcp_tool_detail_category=evidence_span_length_exceeded`). The trajectory is not converging — every comparison-dense input shape surfaces a new failure surface.

The model's behavior: under comparison-dense input, it organically writes >240-char anchors on many compound structural rawKeys regardless of which rawKey is requested. The prior prompt-side discipline (MCP-EGI-005 rule-6/7/8 wording) reduces but does not eliminate this. The deterministic server-side fix (Pass 1 null-normalization) was the right shape from MCP-EGI-006 onward; the only error was making the rule scope key-specific instead of family-categorical.

---

## D3-010 burst evidence motivating MCP-EGI-012

Post-MCP-EGI-010 D3 pass-load against the verified MCP-EGI-010 production deploy:
- debate `f4655492-d24b-4223-aa64-de17a577f8c1`
- root `be103472-9e4c-4020-8fb5-8c6686c1f334`
- runId `28eb3908-2d39-4a37-a34a-3de5256ba807` (corrected: actual `719b7b8f-7ac7-44df-bb79-4ea3d38e210c`)
- 8 targets × 9 families = 72 cells
- Verified production: commit `dba3293` / Deno Deploy build `6hnrgszgahev`

### MCP-EGI-008 + MCP-EGI-009 + MCP-EGI-010 in-scope effectiveness

All three mechanisms worked AS DESIGNED:
- **0 in-scope length residuals** on the 20-key MCP-EGI-010 scope
- **0 in-scope key-set-missing residuals** on the 3-key MCP-EGI-009 scope
- **11 null-spans recorded** in this burst (vs 4 in D3-009) — Pass 1 firing harder under the expanded scope
- All in-scope positives ≤ 240 chars; max 233 on `synthesis_proposed`
- `exception_reasoning_present` (Family E, MCP-EGI-011 candidate) did NOT recur as invalid_type

### 10 new out-of-scope length rawKeys

| Family | rawKey | occurrences |
|---|---|---|
| A | `summarizes_parent` | 1× |
| A | `supports_parent` | 1× |
| A | `challenges_parent` | 1× |
| B | `disagreement_present` | 1× |
| B | `disputes_evidence_applicability` | 1× |
| C | `scope_mismatch_identified` | 1× |
| D | `concrete_example_provided` | 1× |
| F | `example_representativeness_unclear` | 1× |
| G | `defines_next_evidence_needed` | 1× |
| G | `unresolved_point_isolated` | 1× |

All 10 verified members of their named family registries.

---

## Why categorical family-valid length normalization is the right invariant

The underlying invariant that holds for every burst we've examined:

> **An over-240-character `evidenceSpan.<rawKey>` string is structurally invalid regardless of which family-valid rawKey it appears under. `null` is schema-accepted as the advisory anchor fallback. So an overlong clean string on any family-valid rawKey should null-normalize.**

This is the same rule MCP-EGI-006/007/008/010 applied to the narrow allowlist; MCP-EGI-012 just makes the rule categorical.

**Why this is doctrinally safe (per the same arguments that justified MCP-EGI-006):**
- `null` is an existing schema-valid value for `evidenceSpan.<rawKey>` — the validator accepts `string | null` for every entry.
- `null` makes NO semantic claim — the model's `observations[<rawKey>]` boolean and `confidence[<rawKey>]` band remain its stated finding byte-equal.
- The MCP-EGI-005 prompt instruction "set null when you have no anchor" is already advice the model is expected to follow; categorical Pass 1 just enforces the same when the model emits an overlong anchor instead.
- Ban-list precedence preserved per-family — overlong banned strings are NOT normalized; the validator's length-reject still fires.
- No semantic content moves; no truncation; no rawKey fabrication.

---

## Exact eligibility gates

For any `evidenceSpan.<rawKey>` entry:

```
NULL-NORMALIZE IF AND ONLY IF:
  family ∈ LENGTH_NORMALIZE_ELIGIBLE_FAMILIES  (A-I; J excluded)
  AND isRawKeySupportedForFamily(family, rawKey)  (family-valid)
  AND rawKey ∈ checkedRawKeys  (own property; model judged it)
  AND rawKey ∈ observations  (own property; model emitted obs)
  AND rawKey ∈ confidence  (own property; model emitted conf)
  AND typeof value === 'string'
  AND value.length > MAX_EVIDENCE_SPAN_CHARS  (= 240)
  AND !banScanMatches(value, banPatternsForKeyLevelFamily(family))
```

The structural gates (`checkedRawKeys`/`observations`/`confidence`) ensure normalization fires only when the model actually judged the rawKey. Nulling an evidenceSpan entry when the model didn't even decide the rawKey could obscure a malformed packet that the validator should reject for unrelated reasons.

---

## Why Family J is excluded

Family J `sensitive_composer` IS registered in the mcp-server `familyRegistry` singleton (so `isRawKeySupportedForFamily('sensitive_composer', someJKey)` would return TRUE for valid J rawKeys). But J is `productionEnabled: false` at the Edge boundary (`supabase/functions/_shared/booleanObservations/familyRegistry.ts:110-118`) and should not see production-shape packets in the normal flow.

Per the gate spec: "default is do not normalize J because J is production disabled." MCP-EGI-012 maintains this by explicit family allowlisting (`LENGTH_NORMALIZE_ELIGIBLE_FAMILIES`) — 9 production families A–I only.

If J is ever flipped to `productionEnabled: true` at the Edge, a fresh doctrine review is required (per `MCP-021C-EDGE-FAMILY-J` precedent) before adding `'sensitive_composer'` to the eligible set.

---

## Why key-set completion remains separate

`EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS` (MCP-EGI-009, 3 rawKeys: F `question_invites_revision`, G `action_item_proposed`, H `unclear_reference_present`) remains BYTE-EQUAL vs `dba3293`. Pass 2 logic is unchanged.

Rationale: key-set completion addresses a fundamentally different validation class (`evidence_span_key_set_missing` — rawKey absent from `evidenceSpan` when present in the other three maps). The 3 rawKeys are the model's documented blind spots; categorical key-set completion would require expanding `null`-fabrication beyond the model's judged rawKey set, which is a different doctrinal question.

The disjointness invariant continues to hold structurally: a single packet shape cannot simultaneously be "string longer than 240 chars on key X" AND "missing key X entirely", so the categorical length rule and the 3-key completion rule are orthogonal.

---

## Why invalid-type (`exception_reasoning_present`) remains separate

Did NOT recur in D3-010. The 1× row from D3-009 had `mcp_tool_detail_category = evidence_span_invalid_type` (model emitted a non-string evidenceSpan value, not an overlong string). Categorical length normalization addresses only the `string > 240` shape; an invalid-type value (object/array/boolean/number) is still preserved untouched by Pass 1 (the `typeof value !== 'string'` gate skips it) and the validator still rejects.

If `exception_reasoning_present` recurs in a future burst, **MCP-EGI-011** is the next narrow card (server-side type-coercion-to-null Pass 3 or prompt-side type-discipline reinforcement).

---

## Code surface

### Touched files (4)

| Path | Change | Purpose |
|---|---|---|
| [`mcp-server/lib/booleanObservationEvidenceSpanNormalizer.ts`](../../mcp-server/lib/booleanObservationEvidenceSpanNormalizer.ts) | +50 net | Categorical Pass 1 + `LENGTH_NORMALIZE_ELIGIBLE_FAMILIES` + DEPRECATED alias for the 20-key historical record + extended docstring |
| [`mcp-server/tests/booleanObservationEvidenceSpanNormalizer.test.ts`](../../mcp-server/tests/booleanObservationEvidenceSpanNormalizer.test.ts) | +80 net | 10 new TARGETS for third-burst rawKeys (40 templated tests) + categorical-invariant tests + 4 new negative tests (cross-family / unknown rawKey / `quantifier_present` under correct family / Family J exclusion) + updated MCP-EGI-009 disjointness test to reference deprecated constant |
| [`docs/designs/MCP-EGI-012-CATEGORICAL-EVIDENCESPAN-LENGTH-NORMALIZATION-2026-06-23.md`](MCP-EGI-012-CATEGORICAL-EVIDENCESPAN-LENGTH-NORMALIZATION-2026-06-23.md) | NEW | this doc |
| [`docs/core/current-status.md`](../core/current-status.md) | +1 entry | top entry |

### Preservation manifest (byte-equal vs `dba3293`)

- `mcp-server/tools/classifyArgumentBooleanObservations.ts` UNCHANGED — dispatcher signature unchanged; routes to the same helper function
- `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` UNCHANGED — validator + `MAX_EVIDENCE_SPAN_CHARS = 240`
- `mcp-server/lib/keyLevelFailClosed.ts` / `mcp-server/lib/banScanNormalize.ts` / `mcp-server/lib/doctrineBanList.ts` UNCHANGED
- All 10 family scanners + prompts + keys UNCHANGED
- `mcp-server/lib/familyRegistry.ts` UNCHANGED — read-only consumer of the singleton's `isRawKeySupportedForFamily()`
- `mcp-server/lib/familyRegistryInit.ts` UNCHANGED — side-effect imported to ensure registration
- `EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS` UNCHANGED at 3 (MCP-EGI-009 byte-equal)
- Pass 2 (key-set completion) logic UNCHANGED
- `FAMILY_E/G/I_MAX_TOKENS = 1500` UNCHANGED
- `DRAINER_*` retry / backoff / concurrency UNCHANGED — `#782` retained
- `supabase/functions/**` / `supabase/migrations/**` / `supabase/config.toml` UNCHANGED
- `package.json` / lockfile / `app.json` UNCHANGED

### Backward compatibility

- `EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS` is renamed to `EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS_DEPRECATED` (still exported, contents byte-equal at 20 entries, no longer consulted by Pass 1). The DEPRECATED constant is frozen as a historical record of the prior allowlist trajectory and is pinned by a dedicated test.
- The MCP-EGI-009 disjointness invariant test now asserts disjointness against the DEPRECATED constant.

---

## Logging / no-raw-value policy

Pass 1 (length) event shape (unchanged from MCP-EGI-006):
- `event: 'boolean_observations_evidence_span_normalized'`
- `category: 'evidence_span_length_exceeded_to_null'`
- `originalLength`, `maxLength`
- `family`, `rawKey`, `path` (`evidenceSpan.<rawKey>`)
- `schemaVersion?`, `requestId?`

NEVER carries: raw evidenceSpan string value, raw packet, raw prompt / argument body / model response text, bearer / JWT / API-key / service-role / env value.

The categorical Pass 1 emits the same event shape; only the set of rawKeys that trigger the event has expanded.

---

## Tests

**Targeted Deno (`tests/booleanObservationEvidenceSpanNormalizer.test.ts`):** **182 / 0** (~27 ms) — was 138 on `dba3293`, +44 new tests:
- 40 templated tests for the 10 new third-burst rawKeys (4 templated per target × 10 targets)
- 2 new categorical-invariant tests (`LENGTH_NORMALIZE_ELIGIBLE_FAMILIES` size + sorted contents + Family J exclusion; `EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS_DEPRECATED` frozen contents)
- 4 new negative tests (cross-family mismatch / `quantifier_present` under correct family / unknown rawKey / Family J `sensitive_composer` excluded)
- Existing MCP-EGI-009 disjointness invariant test updated to reference the DEPRECATED constant

**Full mcp-server Deno:** exit 0.

**npm typecheck:** clean.

**npm lint --max-warnings 0:** clean.

**Full Jest:** (running at PR open time; see PR body for exact count).

---

## Deploy note: Deno Deploy bearing

MCP-EGI-012 changes are in `mcp-server/lib/` — deploy-bearing on the Deno Deploy production target `cdiscourse-mcp-server`. Merge triggers automatic build via the GitHub integration; production-alias promotion is operator-confirmed via `GATE-DEPLOY/VERIFY mcp-server` (same lane as MCP-EGI-005 through MCP-EGI-010).

This PR does NOT itself deploy. No `npx supabase functions deploy` needed — no Edge functions changed.

---

## Next D3 burst after deploy

D3 remains FAIL until:
1. PR merged + Deno Deploy production alias verified on the new build.
2. D3 burst rerun on the post-deploy revision.

Expected outcomes:
- **PASS:** all 72 cells succeed. The categorical rule closes the length-overflow surface across the 9 production families.
- **PARTIAL PASS (most likely):** length-overflow class fully cleared (no in-scope OR out-of-scope length residuals); any remaining residuals point to a different class. Most likely candidate is `exception_reasoning_present` invalid_type recurring → MCP-EGI-011.
- **PARTIAL PASS (new class):** length cleared; new class outside both length-overflow and key-set-missing surfaces.
- **FAIL (regression):** any in-scope rawKey fails on the new revision → deploy or merge regression.

D4 remains BLOCKED until D3 PASS.

---

## Doctrine anchors

- `cdiscourse-doctrine §1` — null-normalization of an overlong anchor asserts NOTHING; the model's observation+confidence remain its stated finding.
- `cdiscourse-doctrine §10a` — observations vs allegations; nulling on length is a STRUCTURAL act, not a quality verdict.
- OPS-MCP-KEY-LEVEL-FAIL-CLOSED — no divergence from family scanner ban-pattern stacks; the categorical rule uses the same `banPatternsForKeyLevelFamily()` lookup MCP-EGI-006 introduced.

---

## Operator-controlled gates remaining

- Gate B independent review of PR (next gate after this card's open).
- Gate merge.
- `GATE-DEPLOY/VERIFY mcp-server`.
- D3 burst rerun.
- D4 rerun (BLOCKED until D3 PASS).
