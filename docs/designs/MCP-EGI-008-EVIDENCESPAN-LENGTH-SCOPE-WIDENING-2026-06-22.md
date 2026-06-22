# MCP-EGI-008 — Widen evidenceSpan length normalizer to burst-observed rawKeys

**Status:** Implementation PR open (this lane). Stop at PR; no merge, no deploy.
**Lane:** mcp-server normalizer scope widening by exactly 8 rawKeys on burst evidence. Deno Deploy-bearing after merge; validator / ban-list / prompts / dispatcher / Edge / Supabase / migration UNCHANGED.
**Tracking:** new MCP-EGI-008 GitHub issue (created in P5), #793 (MCP-EGI-007), #791 (MCP-EGI-006), #786 (D3 lane), #783 (MCP-EGI-001 root).
**Trigger:** post-MCP-EGI-007 D3 burst on `88636f4` (debate `bd7b732c-306a-4c11-b5c3-9d3cafd2bbbc`, 2026-06-22T08:15:54Z; 8 targets × 9 families = 72 cells) surfaced 8 NEW `evidence_span_length_exceeded` rawKeys outside the prior 5-key locked scope, on top of the canary-clean shape that preceded it.

---

## 1. Goal

Extend the existing locked `EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS` set from 5 keys (MCP-EGI-006/007) to 13 keys, adding exactly the 8 rawKeys named by the burst's row evidence. Mechanism, dispatcher wiring, validator, ban-list patterns, prompts, all other surfaces remain byte-unchanged.

## 2. Confirmed post-MCP-EGI-007 burst evidence

From `argument_machine_observation_runs` for the 8 burst targets (snapshot at early-stop 2026-06-22T08:16:22Z, 28 s post-submit):

**10 `evidence_span_length_exceeded` rows on 8 distinct NEW rawKeys:**

| validator_path | family | hits | targets |
|----------------|--------|------|---------|
| `evidenceSpan.contrasts_with_parent` | A `parent_relation` | **3** | `2646f970`, `648be076`, `6a691ee7` (recurring across 3 of 8 targets) |
| `evidenceSpan.evidence_gap_present` | D `evidence_source_chain` | 1 | `6a691ee7` |
| `evidenceSpan.names_method_difference` | D `evidence_source_chain` | 1 | `2646f970` |
| `evidenceSpan.analogy_reasoning_present` | E `argument_scheme` | 1 | `6a691ee7` |
| `evidenceSpan.preserves_face_while_disagreeing` | B `disagreement_axis` | 1 | `6a691ee7` |
| `evidenceSpan.provides_alternate_interpretation` | C `misunderstanding_repair` | 1 | `a77f3149` |
| `evidenceSpan.claim_present` | H `claim_clarity` | 1 | `deee1b22` |
| `evidenceSpan.separates_normative_from_empirical` | G `resolution_progress` | 1 | `deee1b22` |

**Also surfaced — 3 `evidence_span_key_set_missing` rows (different validation class, deferred to MCP-EGI-009):**

| validator_path | family | reason |
|----------------|--------|--------|
| `evidenceSpan.unclear_reference_present` | H `claim_clarity` | key-set asymmetry, not length |
| `evidenceSpan.action_item_proposed` | G `resolution_progress` | key-set asymmetry, not length |
| `evidenceSpan.question_invites_revision` | F `critical_question` | key-set asymmetry, not length |

These 3 are explicitly **NOT addressed in this card** — they require a different fix (prompt-side key-set coordination or server-side key-set normalization). MCP-EGI-009 is the follow-up lane.

## 3. Why the canary passed but burst failed

The post-MCP-EGI-007 canary (target `a5dff296-…`, 2026-06-22T08:00:44Z) cleared 9/9 att 1, with all 5 in-scope normalizer keys behaving correctly. The canary used a single comparison-dense rebuttal — one shape. The burst used 8 different rebuttals (each a different comparison-dense angle on the same library funding root), exercising a wider rawKey surface. Concretely:

- Canary rawKeys observed positive (5 in-scope): `tradeoff_reasoning_present`, `synthesis_proposed`, `compares_options`, `reason_present`. None of the 8 new burst rawKeys was triggered by that single target's content.
- Burst rawKeys observed positive (5 in-scope + 8 new): all of the above plus `contrasts_with_parent`, `evidence_gap_present`, `names_method_difference`, `analogy_reasoning_present`, `preserves_face_while_disagreeing`, `provides_alternate_interpretation`, `claim_present`, `separates_normative_from_empirical` — each surfaced by content variation across the 8 targets.

The burst is a stricter test surface and exposed scope-too-narrow. The mechanism (normalize-or-skip per rawKey membership) is sound.

## 4. Why the MCP-EGI-006 + MCP-EGI-007 mechanism worked under burst

Across 181 result rows persisted on the 8 burst targets, the 5 in-scope rawKeys behaved exactly per design:

| rawKey | family | positives | null spans | non-null | max non-null | Mechanism |
|--------|--------|-----------|------------|----------|---------------|-----------|
| `tradeoff_reasoning_present` | E | 7 | 1 | 6 | 226 | MCP-EGI-006 fired 1× |
| `convergent_premise_structure` | E | 0 | 0 | 0 | — | not flagged (normal) |
| `synthesis_proposed` | G | 5 | 3 | 2 | 219 | MCP-EGI-006 fired 3× |
| `compares_options` | I | 8 | 5 | 3 | 220 | MCP-EGI-006 fired 5× |
| `reason_present` | H | 7 | 5 | 2 | 159 | **MCP-EGI-007 fired 5× ✓** |

MCP-EGI-007 demonstrated under load that the normalizer fires deterministically when the model overflows and the row lands cleanly with `evidence_span=null`. This card extends the same mechanism to 8 more rawKeys without any other surface change.

## 5. Exact 8 new rawKeys

```
contrasts_with_parent                  // Family A / parent_relation
preserves_face_while_disagreeing       // Family B / disagreement_axis
provides_alternate_interpretation      // Family C / misunderstanding_repair
evidence_gap_present                   // Family D / evidence_source_chain
names_method_difference                // Family D / evidence_source_chain
analogy_reasoning_present              // Family E / argument_scheme
separates_normative_from_empirical     // Family G / resolution_progress
claim_present                          // Family H / claim_clarity
```

Each rawKey verified to belong to its named family per `mcp-server/lib/family<X>Keys.ts` (the per-family rawKey enumeration files). Each family verified to be a member of `KEY_LEVEL_FAIL_CLOSED_FAMILIES` (`mcp-server/lib/keyLevelFailClosed.ts:77-88`), so `banPatternsForKeyLevelFamily()` already composes the byte-identical ban-pattern stack the family scanner uses — no ban-list change.

## 6. Final 13-key normalizer scope

| # | rawKey | Family | Card |
|---|--------|--------|------|
| 1 | `tradeoff_reasoning_present` | E `argument_scheme` | MCP-EGI-006 |
| 2 | `convergent_premise_structure` | E `argument_scheme` | MCP-EGI-006 |
| 3 | `synthesis_proposed` | G `resolution_progress` | MCP-EGI-006 |
| 4 | `compares_options` | I `thread_topology` | MCP-EGI-006 |
| 5 | `reason_present` | H `claim_clarity` | MCP-EGI-007 |
| 6 | `contrasts_with_parent` | A `parent_relation` | MCP-EGI-008 |
| 7 | `preserves_face_while_disagreeing` | B `disagreement_axis` | MCP-EGI-008 |
| 8 | `provides_alternate_interpretation` | C `misunderstanding_repair` | MCP-EGI-008 |
| 9 | `evidence_gap_present` | D `evidence_source_chain` | MCP-EGI-008 |
| 10 | `names_method_difference` | D `evidence_source_chain` | MCP-EGI-008 |
| 11 | `analogy_reasoning_present` | E `argument_scheme` | MCP-EGI-008 |
| 12 | `separates_normative_from_empirical` | G `resolution_progress` | MCP-EGI-008 |
| 13 | `claim_present` | H `claim_clarity` | MCP-EGI-008 |

Coverage: 8 of 9 production families (A/B/C/D/E/G/H/I; only F `critical_question` is not represented; F has no length-residual rawKey in burst evidence). Drift guard tests pin this exact 13-key set.

## 7. Why evidence-backed widening, not categorical expansion

Three reasons against a categorical pass over all multi-sentence-anchor rawKeys:

1. **Live evidence is precise.** Only the 8 named rawKeys have BOTH burst row-level evidence AND historical persisted-length confirmation (300 / 100 / 50 / 26 / 24 / 16 / 12 / 11 persisted positives respectively across the 8 keys; max lens 153-236 chars; `evidence_gap_present` had 36 of 300 = 12% above the 200 soft target). Categorical expansion would extend coverage to rawKeys without confirmed overflow, risking unnecessary nulling.
2. **MCP-EGI-006/007 doctrine.** "Any widening is a separate card" with evidence-driven scope. This card honors that.
3. **Doctrine surface.** Each rawKey added to the set is a key where the ban-list scanner is effectively pre-empted by null normalization. Smaller surface = easier audit.

Future rawKeys can be added in subsequent evidence-driven cards.

## 8. Why key-set-missing is separate (MCP-EGI-009)

`evidence_span_key_set_missing` is a fundamentally different validation class:
- **Length-overflow** (MCP-EGI-008): model emitted a span string longer than 240 chars. Fix: server-side null normalization. Validator-side: rejection by length.
- **Key-set missing** (MCP-EGI-009 lane): model emitted a key in `observations` + `confidence` + `checkedRawKeys` but MISSING the same key from `evidenceSpan` (or vice versa). Fix: prompt-side key-set coordination reinforcement OR server-side key-set normalization to fabricate the missing entry. Validator-side: rejection by asymmetry.

These can't share a fix. MCP-EGI-008 explicitly leaves `unclear_reference_present` / `action_item_proposed` / `question_invites_revision` for MCP-EGI-009.

## 9. Why validator + max cap remain unchanged

- The validator at `mcpBooleanObservationSchemaMirror.ts:38` accepts `evidenceSpan.<key>` as `string | null` for ALL rawKeys (no per-family / per-key branching). Widening the normalizer set requires no validator change.
- The validator's true+null acceptance is pinned by the MCP-EGI-006/007 regression tests and extended by the MCP-EGI-008 templated tests for each new rawKey.
- `MAX_EVIDENCE_SPAN_CHARS = 240` is the doctrine-correct cap; raising it would just move the boundary, not eliminate it.

## 10. Why ban-list remains preserved

For each of the 8 new rawKeys, ban-list preservation is automatic:

- Each rawKey's family is in `KEY_LEVEL_FAIL_CLOSED_FAMILIES` (lines 77-88 of `keyLevelFailClosed.ts` — all 10 production families A–J are members).
- `banPatternsForKeyLevelFamily(family)` already composes the byte-identical pattern stack each family's scanner builds internally (the OPS-MCP-KEY-LEVEL-FAIL-CLOSED no-divergence rule).
- The normalizer's existing `if (banScanMatches(value, patterns)) continue;` decision (`booleanObservationEvidenceSpanNormalizer.ts:179`) preserves the ban-list-vs-length precedence for each new rawKey exactly as for the original 5.
- The auto-templated doctrine-preservation test (added via `TARGETS` array) uses `winner` from shared `DOCTRINE_BAN_PATTERNS` and verifies each new rawKey's overflow-with-banned-content path is NOT normalized.

## 11. Why max_tokens / retry / capacity are not the current lever

- `max_tokens=1500` per family already allows comfortable response size; the failure is the model's anchor exceeding the 240-char SPAN cap, not the total response running out of tokens.
- #782's cap-5 / `[60,180,360,600]` retry budget cannot help because the failure is deterministic packet-shape rejection: every retry produces the same overflow string. #782 retained as the defensive transient-absorption layer.
- The 13 MCP-residual rows from the burst will dead-letter naturally at att 5 under existing budget — no #782 action needed.

## 12. Logging / no raw-value policy

Unchanged from MCP-EGI-006/007:

```
{
  event: 'boolean_observations_evidence_span_normalized',
  family, rawKey, path: 'evidenceSpan.<rawKey>',
  category: 'evidence_span_length_exceeded_to_null',
  originalLength, maxLength,
  schemaVersion?, requestId?
}
```

No raw evidenceSpan string. No raw packet. No raw prompt / argument body / response. No bearer / JWT / API-key / service-role / env values. The sentinel-based leak audit test (which runs against every target rawKey via the for-loop) covers all 13 rawKeys automatically.

## 13. Tests

**Surfaces changed:**

| File | Change |
|------|--------|
| `mcp-server/lib/booleanObservationEvidenceSpanNormalizer.ts` | Add 8 entries to locked set; expand doc comment from 5-key to 13-key scope. |
| `mcp-server/tests/booleanObservationEvidenceSpanNormalizer.test.ts` | Add 8 new TARGETS entries (auto-templates 4 tests each = +32 templated tests); update drift guard from 5-key to 13-key sorted assertion; replace `claim_present` narrow-widening sibling regression with `quantifier_present` (claim_present is now IN scope); add new MCP-EGI-009-scope-boundary test asserting key-set-missing rawKeys are NOT normalized. |

**Test deltas:**

| Group | Δtests | What is proven |
|-------|--------|----------------|
| Templated under TARGETS (per-target × 8 new) | +32 | Each new rawKey: 241→null; 240→preserved; post-norm validation; doctrine preservation (overlong + `winner` NOT normalized). |
| Narrow-widening relocation | 0 net | `claim_present` (now in scope) → `quantifier_present` (still out of scope, Family H sibling). |
| Key-set-missing scope boundary | +1 | Asserts `unclear_reference_present` missing-key case is NOT normalized by this normalizer (deferred to MCP-EGI-009). |
| Drift guard | 0 net (5→13 rewrite) | Locks the exact 13-key set + size === 13. |

Net: **+33 tests** over the 40-test MCP-EGI-007 baseline. Total normalizer test count: **73**.

## 14. Verification (this PR, no provider spend)

| Command | Result |
|---------|--------|
| `cd mcp-server && deno test --allow-net --allow-env --allow-read tests/booleanObservationEvidenceSpanNormalizer.test.ts` | **73 / 0** (~20 ms, +33 net over the 40 MCP-EGI-007 baseline) |
| `cd mcp-server && deno test --allow-net --allow-env --allow-read tests/` | (full mcp-server suite; see PR body for count) |
| `npm run typecheck` | (run-time gate; see PR body) |
| `npm run lint --max-warnings 0` | (run-time gate; see PR body) |
| `npm test` (full Jest) | (run-time gate; see PR body) |

## 15. Deploy implications

- mcp-server change is **Deno Deploy-bearing.** Merge to `main` does NOT auto-deploy `mcp-server/`. The GitHub integration `deploy/civildiscourse/cdiscourse-mcp-server` builds the new commit but production-alias promotion is an operator dashboard action (per the verified MCP-EGI-005 / 006 / 007 pattern). Operator gate.
- Edge / Supabase / migration / config / `.env*` UNCHANGED.

## 16. Next D3 burst after deploy

After operator-verified production deploy, the next burst should show:

- **Burst-PASS path:** all 72 cells succeed att 1. For positives on any of the 13 locked-set rawKeys, `evidence_span` is either a short anchor (≤ 240) or `null`. Pass-load bar: "0 dead-letter across 72 cells."

- **Continued residual on `evidence_span_key_set_missing` only:** 3 known rawKeys (`unclear_reference_present`, `action_item_proposed`, `question_invites_revision`) are NOT addressed here; they'll continue to dead-letter under the same shape. That's MCP-EGI-009's lane.

- **Continued length residual on a NEW rawKey** (a 14th compound key): names the next-card lane. Mechanism reused; locked set widens further.

- **Different shape** (`evidence_span_invalid_type` / `evidence_span_key_set_extra` / `doctrine_ban_list`): that category names the next iteration's lane.

The row evidence picks the next gate.

## 17. Non-goals (explicit)

- NO validator change.
- NO ban-list change.
- NO `MAX_EVIDENCE_SPAN_CHARS` change.
- NO `max_tokens` change.
- NO retry / backoff / drainer / concurrency change. #782 retained.
- NO familyRegistry change. Family I `productionEnabled:true` retained.
- NO Edge / Supabase function change. No `supabase/migrations/**`.
- NO prompt change. The MCP-EGI-005 deterministic null contract remains in the user prompts as the model-side instruction; the server-side normalizer is the deterministic backstop.
- NO dispatcher wiring change. The MCP-EGI-006 Step-3.5 insertion already covers every family because the normalizer is keyed by rawKey membership, not family routing.
- NO key-set-missing fix (deferred to MCP-EGI-009).
- NO categorical expansion across all multi-sentence rawKeys. This card adds exactly 8 rawKeys with burst row evidence.
- NO fixture rewrite.
- NO Family I rollback.
- NO #409 capacity / drain-pacing work.
- NO migration.
- NO provider spend / no deploy in THIS prompt.
- NO D3 / D4 advance in THIS prompt.

## 18. Preservation manifest

- `validateMcpBooleanObservationResponse` UNCHANGED (no edit, no re-export).
- `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` UNCHANGED.
- `MAX_EVIDENCE_SPAN_CHARS = 240` UNCHANGED.
- `DOCTRINE_BAN_PATTERNS` UNCHANGED.
- `FAMILY_A/B/C/D/E/F/G/H/I/J_BAN_PATTERNS` UNCHANGED.
- All family scanners (`scanFamily<X>BooleanResponseForBanList`) UNCHANGED.
- All family prompts UNCHANGED — MCP-EGI-005's rule-6/7/8 deterministic-null wording retained as the model-side instruction.
- `FAMILY_E/G/I_MAX_TOKENS = 1500` UNCHANGED.
- `DRAINER_*` retry policy / backoff / concurrency UNCHANGED. #782 retained.
- `familyRegistry` UNCHANGED. Family I `productionEnabled:true` retained.
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` UNCHANGED (MCP-EGI-006 dispatcher wiring routes by rawKey membership, no per-family code path needed).
- `mcp-server/lib/keyLevelFailClosed.ts` UNCHANGED.
- `mcp-server/lib/banScanNormalize.ts` UNCHANGED.
- `submit-argument` / Edge adapter / failure-detail builder UNCHANGED.
- No migrations / Edge / RLS / secret / env / `.env*` / `package.json` / lockfile / `app.json` / `supabase` tree change.

## 19. Acceptance

- Implementation PR green locally (73 + full mcp-server Deno suite + typecheck + lint + Jest).
- Operator independent Gate B review (separate gate).
- Operator merge.
- Operator deploys `mcp-server/` to Deno Deploy (separate operator action).
- Operator re-runs MCP-EGI-004 burst against the new revision.
- Row evidence picks the next gate (MCP-EGI-009 for key-set-missing, OR D3 declared closed if burst is clean).

---

_Doctrine: `cdiscourse-doctrine §1` (no verdict tokens added; tests assert), `§7` (no AI call from production app — server-side mutator only), `§10a` (observation contract preserved — true+null is a valid observation, not an allegation); `test-discipline`: tests are part of "done"._
