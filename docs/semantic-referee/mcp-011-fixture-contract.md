# MCP-011 — Fixture catalog reference

One-page catalog of the semantic-referee fixture set shipped by MCP-011. It is a
reference for future MCP cards' designers — the authoritative source is the code
in `src/features/semanticReferee/semanticRefereeFixtures.ts`.

**Card:** MCP-011 — Mock semantic-referee packet validator and fixture provider
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/178
**Design:** [`docs/designs/MCP-011.md`](../designs/MCP-011.md)

---

## What this card ships

- `src/features/semanticReferee/semanticRefereeTypes.ts` — the canonical
  Node-side `SemanticRefereePacket` / `SemanticBinarySample` contract
  (re-stated verbatim from MCP-001 §7), constant arrays, and the
  `SemanticRejectionCode` vocabulary.
- `src/features/semanticReferee/semanticRefereeValidator.ts` — `parseSemanticPacket`
  (a `zod@4` structural schema plus a pure-TS content-safety scanner) and the
  `isCreditEligible` / `creditEligibleBinaries` / `looksLikeInternalCode` predicates.
- `src/features/semanticReferee/semanticRefereeFixtures.ts` — the 18 fixture
  groups plus the deterministic `mockFixtureProvider`.
- `src/features/semanticReferee/semanticRefereeCacheKey.ts` — `buildSemanticCacheKey`
  / `serializeSemanticCacheKey` / `hashClassifierSet`.
- `src/features/semanticReferee/index.ts` — the public re-export surface.

It calls no provider, makes no network call, adds no Edge Function, reads no env
var, renders no UI, and adds no dependency (`zod@4` was already present).

## The 18 fixture groups

| # | Fixture group | Kind | Expected outcome |
|---|---|---|---|
| 1 | Valid minimal packet (`validMinimal`) — one binary, `no_route_change`, all `scoreHints` 0 | valid | accepted |
| 2 | Valid continuity packet (`validContinuity`) — `responds_to_parent: 1`, `mainline` | valid | accepted |
| 3 | Valid evidence-debt packet (`validEvidenceDebt`) — `creates_source_chain_gap: 1`, `sourceChainDebt` hint | valid | accepted |
| 4 | Valid branch-recommendation packet (`validBranchRecommendation`) — `suggests_side_branch: 1`, `vertical_chime_branch` | valid | accepted |
| 5 | Valid synthesis-readiness packet (`validSynthesisReadiness`) — `ready_for_synthesis: 1` | valid | accepted |
| 6 | Valid conflict-routed packet (`validConflictRouted`) — `responds_to_parent: 0`, `confidence: low` | valid | accepted |
| 7 | Malformed JSON (`malformed_non_json`) — `raw` is a non-parseable string | malformed | `non_json` |
| 8 | `authoritative: true` (`malformed_authoritative_true`) | malformed | `authoritative_not_false` |
| 9 | Verdict token in a `reasonCode` (`malformed_verdict_token`) | malformed | `verdict_token` |
| 10 | Person label in a string field (`malformed_person_label`) | malformed | `person_label` |
| 11 | Synthetic key-shaped string (`malformed_secret_shape`) | malformed | `secret_shape` |
| 12 | Unknown classifier id (`malformed_unknown_classifier`) | malformed | `unknown_classifier_id` |
| 13 | Unknown route suggestion (`malformed_unknown_route`) | malformed | `unknown_route_suggestion` |
| 14 | Non-binary classifier value (`malformed_non_binary_value`) | malformed | `non_binary_value` |
| 15 | Low-confidence no-credit case (`validLowConfidence`) | **valid** | accepted; `isCreditEligible` → false |
| 16 | Duplicate classifier conflict (`malformed_duplicate_classifier`) | malformed | `duplicate_classifier_id` |
| 17 | Cache-key stable case (`cachekey_stable_reorder`) — identical up to classifier order | cache-key | `same_key` |
| 18 | Cache-key invalidation case (`cachekey_promptversion_invalidates`) | cache-key | `different_key` |

## Extra malformed coverage (beyond the named 18)

Each is a one-line `MalformedFixture` in the same shape, group `16`:

| Fixture id | Expected rejection |
|---|---|
| `malformed_top_level_array` | `top_level_array` |
| `malformed_block_field` | `block_field` |
| `malformed_chain_of_thought_field` | `chain_of_thought_field` |
| `malformed_raw_prompt_field` | `raw_prompt_field` |
| `malformed_copy_field_smuggled` | `copy_field_smuggled` |
| `malformed_score_hint_out_of_range` | `score_hint_out_of_range` |
| `malformed_pii_handle_shape` | `pii_shape` |
| `malformed_pii_url_shape` | `pii_shape` |
| `malformed_reason_code_too_long` | `field_too_long` |
| `malformed_reason_code_unknown_family` | `unknown_reason_code` |
| `malformed_unknown_confidence` | `unknown_confidence` |
| `malformed_unknown_friction` | `unknown_friction_suggestion` |
| `malformed_missing_required_field` | `missing_field` |
| `malformed_not_an_object` | `not_an_object` |

## Validator stages

`parseSemanticPacket(raw: unknown)` runs:

1. **JSON acceptance** — a string is `JSON.parse`d in a `try/catch`; a throw → `non_json`.
   A number / boolean / null → `not_an_object`.
2. **Top-level shape** — a top-level array → `top_level_array`; a non-object → `not_an_object`.
3. **Structural schema** — a `zod@4` `strictObject`; every unknown top-level key is flagged.
4. **Unknown-field classification** — each flagged key maps to its most specific code
   (`block_field`, `chain_of_thought_field`, `raw_prompt_field`, `copy_field_smuggled`,
   else `unknown_field`); a missing required field → `missing_field`.
5. **Content-safety scan** — every string field is scanned for verdict tokens,
   person labels, secret / JWT / Bearer / Authorization shapes, and `@handle` /
   URL / email / post-id shapes; a `reasonCode` is checked for the
   `<family>_<suffix>` shape against the eight reason-code families.
6. **Coherence** — two binaries for the same `classifierId` → `duplicate_classifier_id`.

It **collects all rejections** (a fixture test sees the complete failure set);
`{ ok: true }` is returned only when there are zero rejections. A rejected
packet is never partially used — the consumer falls back to deterministic
layer 1 and the post is unaffected. **Rejection messages are sanitized** — a
`SemanticPacketRejection.detail` describes the kind of defect and never echoes
the offending raw value.

## Operator decisions applied (MCP-011 §18)

1. Validator uses `zod@4` (already a dependency) for the structural schema plus
   a pure-TS content-safety scanner — no new dependency.
2. The cache key is the **superset** shape: `{ roomId, parentId, contentHash,
   promptVersion, classifierSetHash, roomMode, selectedAction }`.
3. `reasonCode` validation is family-prefix + `snake_case` shape + length bound —
   not an exact 90-entry allowlist.
4. `scoreHints` integers are bounded `0..3` (`SCORE_HINT_MAX = 3`).
5. This fixture-contract doc ships.

## Synthetic-fixture safety

Every fixture is synthetic, minimal, and obviously fake. Strings that must trip
the secret / PII scanners are **assembled by concatenation at module load** — no
contiguous real-key-shaped literal sits in the committed source. No fixture
contains a real secret, a real API key, a real `@handle`, a real post id, a real
URL, a real email, or copied hostile text. `semanticRefereeFixtures.test.ts`
self-scans the fixture module to prove it.

## `mockFixtureProvider` boundary

`mockFixtureProvider` is a **test/dev fixture source**, not a runtime provider.
It is deterministic, synchronous, always returns a valid `provider: 'mock'`,
`authoritative: false` packet, and **must not** be wired into any screen, the
composer, the submit path, the timeline, or any App route.
