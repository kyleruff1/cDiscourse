# MCP-EGI-013 — Categorical evidenceSpan key-set completion for family-valid rawKeys

**Status:** designed, implemented, PR open, awaiting Gate B review.
**Date:** 2026-06-24
**Author:** roadmap-implementer (with operator Gate A authorization).
**Base commit:** `b1d608b` (MCP-EGI-012 merged + production-verified on Deno Deploy build `2y11j9b5rq53`).

---

## TL;DR

Replace the hand-maintained 3-key key-set-completion allowlist (MCP-EGI-009) with a categorical rule: for any family-valid A–I rawKey the model declared in `checkedRawKeys` + `observations` + `confidence` but omitted from `evidenceSpan`, the normalizer adds `evidenceSpan.<rawKey> = null` before validation.

Mirrors the MCP-EGI-012 categorical length-normalization pattern. Same eligibility set (`LENGTH_NORMALIZE_ELIGIBLE_FAMILIES`, A–I; Family J excluded). Same family-valid lookup (`isRawKeySupportedForFamily`). Same never-overwrite + structural-gate safety. **No body-scanning** — the operator gate-A guidance is explicit: safety comes from family-validity + structural gates + never-overwrite, not from any text scan of the missing entry (there is no string to scan).

---

## Motivating evidence

**Post-MCP-EGI-012 D3 burst (run `4a94f0b1-30b7-4b01-beb4-1ed2d6509f73`, 2026-06-24T06:05:19Z) result:**

| metric | value |
|---|---|
| 8 targets × 9 families | 72 expected cells |
| succeeded | 71 |
| retry_scheduled | 1 |
| dead_letter | 0 |
| `evidence_span_length_exceeded` failures | **0** (categorical length rule WORKED) |
| `exception_reasoning_present` invalid_type recurrence | none |
| in-scope `evidence_span_key_set_missing` (3-key MCP-EGI-009) | 0 |

**Decisive persistent residual:**

| arg | family | validator_path | mcp_tool_detail_category | state | attempt |
|---|---|---|---|---|---|
| `fce0023e` | B `disagreement_axis` | `evidenceSpan.disputes_generalization` | `evidence_span_key_set_missing` | retry_scheduled | 3 |

**Transient self-healed:**

| arg | family | validator_path | mcp_tool_detail_category | resolution |
|---|---|---|---|---|
| `3e067b95` | A `parent_relation` | `evidenceSpan.compares_parent_to_sibling_branch` | `evidence_span_key_set_missing` | succeeded att 2 |
| `b28fbe60` | B `disagreement_axis` | `modelInfo` | `missing_required_field` | succeeded att 2 (NOT evidenceSpan class — out of scope here) |

**Trajectory across the EGI lane:**

| burst | succeeded / 72 | dominant residual class |
|---|---|---|
| pre-EGI-008 | 0 / 72 | length-overflow + key-set-missing |
| post-EGI-008 / 009 / 010 (each) | 8 / 72 | length-overflow residual outside 13- / 13- / 20-key scope |
| post-EGI-012 | **71 / 72** | **key-set-missing residual outside 3-key scope** |

The narrow 3-key MCP-EGI-009 allowlist is on the same recurrence trajectory the length normalizer was on before MCP-EGI-012 collapsed it categorically. The categorical pattern is the principled successor.

---

## Why categorical length normalization worked

MCP-EGI-012 derived eligibility from `LENGTH_NORMALIZE_ELIGIBLE_FAMILIES ∩ isRawKeySupportedForFamily()` — a structural invariant grounded in the canonical family registry, not a hand-curated allowlist that drifts with each new burst. The categorical rule:

- closed the length-overflow surface across all 9 production families A–I in **one** PR,
- requires no further widening on new bursts,
- preserves all ban-list / validator / prompt / dispatcher / cap doctrine,
- excludes Family J explicitly (productionEnabled:false at the Edge).

MCP-EGI-013 applies the same pattern to the key-set-missing class.

---

## Why narrow key-set completion is now showing recurrence

The MCP-EGI-009 3-key allowlist (`question_invites_revision`, `action_item_proposed`, `unclear_reference_present`) was scoped to the specific burst evidence that motivated it. The D3-012 burst surfaced `disputes_generalization` (Family B) outside that scope — the model legitimately judged a Family B rawKey, included it in `observations`/`confidence`/`checkedRawKeys`, but omitted the corresponding `evidenceSpan` entry. The 3-key allowlist couldn't catch it.

Same recurrence shape MCP-EGI-006 → 007 → 008 → 010 had on length. Same answer: go categorical.

---

## Exact categorical key-set eligibility gates

For each rawKey to be completed by Pass 2:

1. **Family eligibility.** `family` is in `LENGTH_NORMALIZE_ELIGIBLE_FAMILIES` (A–I, exactly 9 entries). Family J `sensitive_composer` is excluded (productionEnabled:false at the Edge — same exclusion as Pass 1).
2. **Family-valid rawKey.** `isRawKeySupportedForFamily(family, rawKey)` returns true. Singleton registry from `familyRegistry.ts`, initialized at module load via the side-effect import of `familyRegistryInit.ts`. Same source-of-truth Pass 1 uses.
3. **Semantic anchor present.** `rawKey` is in `checkedRawKeys` (the model's declared structural decision).
4. **Observations + confidence present.** `rawKey` is an own property of both `observations` and `confidence`.
5. **Absent from evidenceSpan.** `rawKey` is NOT an own property of `evidenceSpan` (and was not added by Pass 1 earlier in the same call — `hasOwnProperty(normalizedSpans, rawKey)` is the guard).
6. **evidenceSpan is a plain object.** Same precondition as Pass 1.

When all 6 gates pass: `evidenceSpan[rawKey] = null` (a schema-valid value per the `string | null` validator type).

**Iteration source:** `checkedRawKeys` (Set<string>). This is the semantic "model judged this rawKey" anchor. Iterating it bounds the work to declared rawKeys only — no fabrication of decisions the model didn't make.

---

## Why Family J is excluded

Family J `sensitive_composer` is registered in the `familyRegistry` singleton (so `isRawKeySupportedForFamily('sensitive_composer', 'shifts_to_person_or_intent')` returns true) but is `productionEnabled: false` at the Edge boundary. Production-shape packets should never carry Family J. Excluding it from `LENGTH_NORMALIZE_ELIGIBLE_FAMILIES` keeps the normalizer fail-closed for J's untested-in-production prompt path.

If J is ever flipped to `productionEnabled: true` at the Edge, a separate doctrine review is required (same gate as MCP-EGI-012). Not this card.

---

## Why `modelInfo missing_required_field` is out of scope

The D3-012 burst also surfaced one transient `missing_required_field` row with `validator_path = modelInfo`. That's a schema-level field-missing class (the response was missing the `modelInfo` envelope), not an `evidenceSpan` key-set class. Self-healed on retry. MCP-EGI-013's scope is **evidenceSpan key-set completion only**. The modelInfo class lives in a different validator branch; if it recurs persistently, a separate card handles it.

---

## Why `exception_reasoning_present` invalid-type stays separate

`exception_reasoning_present` (Family E) surfaced in a prior burst as `evidence_span_invalid_type` (the model emitted a non-string evidenceSpan value, e.g. an object). It did NOT recur in D3-012. MCP-EGI-013 still does NOT touch invalid-type values — the validator's type-branch reject still fires. MCP-EGI-011 remains the candidate card if invalid-type recurs.

---

## Why validator remains unchanged

The validator already accepts `null` as a valid evidenceSpan value (`Readonly<Record<string, string | null>>`). Completing a missing key to null produces a packet the validator accepts. The validator's key-set-coordination check (every observations key must exist in evidenceSpan) still fires on unnormalized packets — the normalizer is not a validator relaxation, it's a pre-validation map-coordination repair.

---

## Why no ban-list bypass occurs

The categorical Pass 2 does NOT scan strings. The operator gate-A guidance is explicit: there is no evidenceSpan string when the key is missing, so there is nothing to scan. Safety comes from:

- **Family-validity gate** — only rawKeys the canonical registry knows about for the packet's family.
- **Structural gates** — only rawKeys the model already judged (checkedRawKeys + observations + confidence).
- **Never-overwrite gate** — Pass 2's `hasOwnProperty(normalizedSpans, rawKey)` guard preserves any present value (string, null, invalid shape) byte-equal. Existing strings still flow through Pass 1's length+ban-scan if they're overlong; Pass 2 never touches them.
- **No content fabrication** — `null` makes no semantic claim. The model's `observations` + `confidence` decisions remain its stated finding.

A ban-list scan would be incoherent here: scanning what? There's no string. The doctrine preservation Pass 1 needs (an overlong string containing banned content must NOT be silently dropped via null) does not apply to Pass 2 (there is no string to silently drop).

---

## Why `MAX_EVIDENCE_SPAN_CHARS` stays 240

This card doesn't change length-overflow behavior. The cap remains 240. Pass 1 still null-normalizes overlong family-valid strings; Pass 2 only acts on absent keys.

---

## Why `max_tokens` / retry / drainer / concurrency / familyRegistry are not the current lever

- `max_tokens`: the failing packets had structural completion gaps, not truncation gaps. Increasing max_tokens would not fix a model that declares a rawKey in checkedRawKeys but emits no evidenceSpan entry.
- Retry: the D3-012 burst showed 2 of 3 transient validation failures self-heal on attempt 2. `#782` retry-budget is retained as defensive transient support. The persistent residual (`disputes_generalization` at attempt 3) is deterministic — a retry can't fix a deterministic model omission. The fix has to be server-side normalization.
- Drainer / concurrency: unaffected by this class.
- familyRegistry: unchanged read-only consumer. Definitions are not modified.

---

## Logging / no-raw-value policy

- Pass 2 events carry only structural identifiers: `event`, `family`, `rawKey`, `path`, `category`, `schemaVersion`, `requestId`. No raw evidenceSpan value (the entry is being created, not transformed; no string exists). No raw packet, prompt text, body, or model response.
- Sentinel-leak test asserts no SENTINEL value leaks into event metadata.

---

## Tests

**Added:**

- **Categorical-completion TARGETS loop** — one representative rawKey per production family A–I (9 entries), each tested for: (a) missing key completed to null + event metadata, (b) unnormalized packet still fails validator, (c) already-null preserved no-op, (d) already-string preserved byte-equal, (e) already-invalid type preserved + validator rejects, (f) missing from observations → not completed, (g) missing from confidence → not completed, (h) missing from checkedRawKeys → not completed, (i) extra unsanctioned key not removed. **9 × 9 = 81 new tests.**
- **Coverage invariant** — `CATEGORICAL_KEY_SET_TARGETS` exercises exactly the 9 eligible families. (+1)
- **Family J exclusion** — `shifts_to_person_or_intent` (registered Family J rawKey) NOT completed when family='sensitive_composer'. (+1)
- **Cross-family negative** — Family A rawKey under family='disagreement_axis' NOT completed. (+1)
- **Unknown rawKey negative** — fake rawKey NOT completed. (+1)
- **Pass 1 regression** — length-overflow Pass 1 unchanged when Pass 2 active in same packet. (+1)
- **Pass 2 class-only** — Pass 2 only ever produces key-set events, never length events. (+1)
- **Mixed-class regression** — length pass + categorical-key-set pass both fire when applicable. (+1)
- **Leak audit** — no raw content in events. (+1)
- **D3-012 burst residual regression** — `disputes_generalization` directly tested. (+1)

**Updated:**

- **MCP-EGI-009 3-key set frozen historical** — renamed constant + comment reframe.
- **MCP-EGI-009 multi-key test** — switched from cross-family rawKeys (never realistic) to 3 same-family Family H rawKeys.
- **MCP-EGI-009 non-target test** — was the EGI-009 narrow-scope guard for `cited_source_present`; **flipped** to the EGI-013 positive (the rawKey is now categorical-completed); replacement Family D rawKey `evidence_supports_claim` selected.

**Removed (obsoleted by EGI-012/013):**

- **MCP-EGI-006 "non-target rawKey: 241-char string NOT normalized"** — obsoleted by EGI-012 categorical length. Successor coverage: cross-family test at line 429+ (`quantifier_present` under Family E).
- **MCP-EGI-006 "target rawKey missing from evidenceSpan: NOT normalized"** — obsoleted by EGI-013 categorical key-set completion. Successor coverage: the EGI-013 TARGETS loop.

**Total test surface:** mcp-server Deno suite previously 1992 passed; this PR brings the count up by the new EGI-013 tests less the removed EGI-006 obsoletes (final count reported in P4).

---

## Deploy note (Deno Deploy-bearing)

The mcp-server change ships via the canonical Deno Deploy GitHub integration. On merge, the integration auto-builds the new commit and the operator confirms production-alias binding via the Deno Deploy dashboard in a separate `GATE-DEPLOY/VERIFY mcp-server` gate. **This card stops at PR.** No manual deploy, no settings mutation, no env change.

---

## D3 / D4 status after merge

- **D3** stays **FAIL** until the next burst against the verified MCP-EGI-013 production revision.
- **D4** stays **BLOCKED** (separate operator decision; not advanced by this card).
- `#786` stays open.
- `#782` retained.
- Family I `productionEnabled:true` retained.

---

## Next burst expectations (post-EGI-013 deploy)

- **Most likely:** D3 burst passes 72/72 or near-72. The categorical key-set rule should close the key-set-missing surface across A–I in one step.
- **If `exception_reasoning_present` invalid_type recurs:** MCP-EGI-011 becomes the next narrow card.
- **If `modelInfo missing_required_field` persists:** separate envelope-class card.
- **If a new validation class surfaces:** the row-level discriminator (MCP-EGI-003) will name it; next card scoped to that class.

The narrow-widening trajectory is closed for length (EGI-012) and key-set (EGI-013). Future cards address new validation classes, not new rawKeys within an existing class.
