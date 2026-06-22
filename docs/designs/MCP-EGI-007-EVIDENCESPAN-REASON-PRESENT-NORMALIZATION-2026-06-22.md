# MCP-EGI-007 — Extend server-side evidenceSpan normalizer to Family H `reason_present`

**Status:** Implementation PR open (this lane). Stop at PR; no merge, no deploy.
**Lane:** mcp-server normalizer scope widening by exactly one rawKey. Deno Deploy-bearing after merge; validator / ban-list / prompts / Edge / Supabase / migration / dispatcher wiring UNCHANGED.
**Tracking:** new MCP-EGI-007 GitHub issue (created in P5), #791 (MCP-EGI-006 normalizer), #786 (D3 canary lane), #783 (MCP-EGI-001 root).
**Trigger:** post-MCP-EGI-006 D3 canary on `a0fc1c3` (target `72a5526c-7ab1-4ca4-85f7-1a651ad64565`) confirmed MCP-EGI-006's normalizer cleared the original three failing rawKeys (E `tradeoff_reasoning_present`, G `synthesis_proposed`, I `compares_options` all succeeded att 1 with `evidence_span=null`) but exposed a fifth compound rawKey with the same overflow shape: H `evidenceSpan.reason_present`.

---

## 1. Goal

Add `reason_present` (Family H / `claim_clarity`) to the existing locked `EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS` set so the MCP-EGI-006 mechanism (server-side null normalization with ban-list preservation) covers the now-confirmed fifth rawKey. Mechanism, dispatcher wiring, validator, ban-list, prompts, and all other surfaces are byte-unchanged.

## 2. Confirmed post-MCP-EGI-006 row evidence

From `argument_machine_observation_runs` (target `72a5526c-7ab1-4ca4-85f7-1a651ad64565`, 2026-06-22T05:43:53Z → 06:08:04Z, mcp-server production build `de7vap7ybm6j`):

| Family | State | Attempts | `failure_sub_reason` | `mcp_tool_reason` | `mcp_tool_detail_category` | `validator_path` |
|--------|-------|----------|----------------------|---------------------|-----------------------------|--------------------|
| A `parent_relation` | succeeded att 1 | — | — | — | — | — |
| B `disagreement_axis` | succeeded att 1 | — | — | — | — | — |
| C `misunderstanding_repair` | succeeded att 1 | — | — | — | — | — |
| D `evidence_source_chain` | succeeded att 1 | — | — | — | — | — |
| E `argument_scheme` | succeeded att 1 | — | — | — | — | — |
| F `critical_question` | succeeded att 1 | — | — | — | — | — |
| G `resolution_progress` | succeeded att 1 | — | — | — | — | — |
| **H `claim_clarity`** | **dead_letter att 5** | 5 | `provider_server_error` | **`validation_failed`** | **`evidence_span_length_exceeded`** | **`evidenceSpan.reason_present`** |
| I `thread_topology` | succeeded att 1 | — | — | — | — | — |

The three MCP-EGI-006 target rawKeys that appeared as positives on this canary all landed with `evidence_span=null` exactly per the normalizer's contract:

| rawKey | family | observation | confidence | span_is_null |
|--------|--------|-------------|------------|--------------|
| `compares_options` | I (`thread_topology`) | TRUE | high | **true** |
| `synthesis_proposed` | G (`resolution_progress`) | TRUE | high | **true** |
| `tradeoff_reasoning_present` | E (`argument_scheme`) | TRUE | high | **true** |

MCP-EGI-006 worked decisively for its scope. The new residual is scope-too-narrow, not mechanism failure.

Safe correlation ID for operator Deno log inspection: H `claim_clarity` `4af3df8d-113e-4666-b0a5-56c34ee5b112`.

## 3. Optional no-spend historical audit

From `argument_machine_observation_results` for `family='claim_clarity' AND raw_key='reason_present'`:

| Metric | Value |
|--------|-------|
| n persisted positives | 80 |
| min span length | 30 |
| avg span length | 130.7 |
| max span length | 233 |
| n null | 0 (no MCP-EGI-006 nulls because reason_present was not yet in scope) |
| n with span > 240 | 0 (overflow was validator-rejected before persistence) |
| n with span > 200 (soft target) | 9 (11%) |

The 9 / 80 = 11% near-cap rate on persisted positives + the just-confirmed canary overflow together justify a minimal widening to include `reason_present`. No categorical expansion is justified by this evidence.

## 4. Why MCP-EGI-006 worked for original keys

`booleanObservationEvidenceSpanNormalizer.ts` runs BEFORE schema validation in the dispatcher (Step 3.5 in `classifyArgumentBooleanObservations.ts:646`). For each rawKey in `EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS` whose evidenceSpan is a string longer than `MAX_EVIDENCE_SPAN_CHARS` (240) and ban-clean under the family's pattern stack, the helper rewrites the value to `null`. The validator already accepts `string | null` for evidenceSpan values, so the rewrite is structurally invisible — the only behavioral change is that previously-failing rows now persist with `null` instead of dead-lettering. The canary above proves this on the three E/G/I rawKeys.

## 5. Why residual is scope-too-narrow, not mechanism failure

`reason_present` is one of the 12 Family H ai_classifier rawKeys (per `mcp-server/lib/familyHKeys.ts:88-89` and dispatcher tool description) — a descriptive formulation-state observation about whether the move contains a reason. On comparison-dense input the model's "reason" anchor naturally spans multiple sentences and crosses the 240-char cap. Same structural shape as the E/G/I four (compound multi-clause anchors). The MCP-EGI-006 design doc §5 explicitly locked the scope to 4 keys with "any widening is a separate card" — this card is that follow-up.

## 6. Exact new rawKey

```
reason_present (Family H / claim_clarity)
```

Resulting locked set is exactly:

```
tradeoff_reasoning_present     // Family E
convergent_premise_structure   // Family E
synthesis_proposed             // Family G
compares_options               // Family I
reason_present                 // Family H — MCP-EGI-007
```

The drift guard regression test (`MCP-EGI-007 — exports the five confirmed compound rawKeys`) pins this set against accidental further widening.

## 7. Why this is minimal scope widening, not categorical expansion

Three reasons against broader scope:

1. **Live evidence is one rawKey.** Only `reason_present` has both (a) a confirmed dead-letter on the post-MCP-EGI-006 canary and (b) historical evidence (~11% near-cap rate on persisted positives) that the overflow surface is real and recurring.
2. **MCP-EGI-006 design doctrine.** "Any widening is a separate card" with evidence-driven scope. A categorical sweep across the 12 H rawKeys or the remaining F / G rawKeys would extend coverage to rawKeys without confirmed overflow evidence; that risks normalizing keys that should be persisting their structural anchors (e.g., short factual observations).
3. **Doctrine preservation surface.** Each rawKey added to the set is a key where the ban-list scanner is effectively pre-empted by null normalization (the overlong+banned guard preserves the ban-list reject but the clean overflow path discards the model's anchor). Smaller scope = smaller doctrine surface = easier audit.

If further H / F / G keys emerge on later canaries, each gets its own evidence-driven follow-up card.

## 8. Why validator + max cap remain unchanged

- The validator at `mcpBooleanObservationSchemaMirror.ts:38` accepts `evidenceSpan.<key>` as `string | null` for ALL rawKeys (no per-family branching), so widening the normalizer set requires no validator change.
- The validator's true+null acceptance is already pinned by `mcpEgiEvidenceSpanRegression.test.ts` and the MCP-EGI-006 normalizer regression tests.
- `MAX_EVIDENCE_SPAN_CHARS = 240` is the doctrine-correct cap; raising it would just move the boundary, not eliminate it.

## 9. Why ban-list remains preserved

Family H is already a member of `KEY_LEVEL_FAIL_CLOSED_FAMILIES` at `keyLevelFailClosed.ts:85`. `banPatternsForKeyLevelFamily('claim_clarity')` returns `[...DOCTRINE_BAN_PATTERNS, ...FAMILY_H_BAN_PATTERNS]` — the byte-identical pattern stack `scanFamilyHBooleanResponseForBanList` builds internally. The normalizer's `if (banScanMatches(value, patterns)) continue;` decision at `booleanObservationEvidenceSpanNormalizer.ts:179` therefore preserves the ban-list-vs-length precedence for `reason_present` exactly as it does for the original four rawKeys: a 241-char `reason_present` containing banned content is NOT normalized and the validator's length reject still fires.

The OPS-MCP-KEY-LEVEL-FAIL-CLOSED no-divergence rule (the pattern stack used here = the pattern stack the family scanner uses) carries forward unchanged.

## 10. Why max_tokens / retry / capacity are not the current lever

- `max_tokens=1500` per family already allows comfortable response size; the failure is the model's anchor exceeding the 240-char SPAN cap, not the total response running out of tokens.
- #782's cap-5 / `[60,180,360,600]` retry budget cannot help here because the failure is deterministic packet-shape rejection: every attempt produces the same overflow string.
- The single dead-letter on the post-MCP-EGI-006 canary did consume cap-5; no provider/capacity transient is implicated.

## 11. Logging / no raw-value policy

Unchanged from MCP-EGI-006:

```
{
  event: 'boolean_observations_evidence_span_normalized',
  family, rawKey, path: 'evidenceSpan.<rawKey>',
  category: 'evidence_span_length_exceeded_to_null',
  originalLength, maxLength,
  schemaVersion?, requestId?
}
```

No raw evidenceSpan string. No raw packet. No raw prompt / argument body / response. No bearer / JWT / API-key / service-role / env values. The existing sentinel-based leak audit test (which runs against every target rawKey via the for-loop) covers `reason_present` automatically.

## 12. Tests

**Surfaces changed:**

| File | Change |
|------|--------|
| `mcp-server/lib/booleanObservationEvidenceSpanNormalizer.ts` | Add 1 entry (`reason_present`) to the locked set; update the doc comment to mention 4 → 5 rawKeys. |
| `mcp-server/tests/booleanObservationEvidenceSpanNormalizer.test.ts` | Add `claim_clarity / reason_present` to the `TARGETS` array (auto-templates 4 tests); update the locked-set drift guard from 4-key to 5-key; add one new explicit test that the adjacent non-target Family H rawKey `claim_present` is NOT normalized (proves the widening is narrow). |

**Test deltas:**

| Group | Δtests | What is proven |
|-------|--------|----------------|
| Templated under TARGETS (per-target) | +4 | `reason_present` 241→null; 240→preserved; post-normalization validation; doctrine preservation (overlong + `winner` NOT normalized). |
| Explicit narrow-widening | +1 | `claim_present` (Family H sibling) overlong is NOT normalized — widening is narrow, not categorical. |
| Locked-set drift guard | +0 (rewritten 4→5) | Future widening requires a separate card. |

Net: **+5 tests** over the MCP-EGI-006 baseline of 35.

## 13. Verification (this PR, no provider spend)

| Command | Result |
|---------|--------|
| `cd mcp-server && deno test --allow-net --allow-env --allow-read tests/booleanObservationEvidenceSpanNormalizer.test.ts` | **40 / 0** (~15 ms) — +5 net over the 35 MCP-EGI-006 baseline |
| `cd mcp-server && deno test --allow-net --allow-env --allow-read tests/` | **1850 / 0** (~7 s) — +5 net over the 1845 MCP-EGI-006 baseline |
| `npm run typecheck` | clean |
| `npm run lint --max-warnings 0` | (run-time gate; see PR body) |
| `npm test` (full Jest) | (run-time gate; see PR body) |

## 14. Deploy implications

- mcp-server change is **Deno Deploy-bearing.** Merge to `main` does NOT auto-deploy `mcp-server/`. The GitHub integration `deploy/civildiscourse/cdiscourse-mcp-server` builds the new commit but production-alias promotion is an operator dashboard action (per the verified MCP-EGI-005 + MCP-EGI-006 pattern). Operator gate.
- Edge / Supabase / migration / config / `.env*` UNCHANGED.

## 15. Next D3 canary after deploy

After operator-verified production deploy, the next canary should show:

- **Success path:** all 9 cells succeed att 1. For positives on any of the 5 locked-set rawKeys, `evidence_span` is either a short anchor (≤ 240) or `null`. D3 PASS gate is "0 dead-letter on the target across 9 family cells."
- **Continued residual on a 6th compound rawKey:** if the failing row's `validator_path` is `evidenceSpan.<some-other-rawKey>` with `mcp_tool_detail_category = evidence_span_length_exceeded`, that names the next-card lane. MCP-EGI-006 + MCP-EGI-007 mechanism is reused; only the locked set widens.
- **Different shape (`evidence_span_invalid_type` / `evidence_span_key_set_*` / `doctrine_ban_list`):** that category names the next iteration's lane.

The row will pick the next lane on its own.

## 16. Non-goals (explicit)

- NO validator change.
- NO ban-list change.
- NO `MAX_EVIDENCE_SPAN_CHARS` change.
- NO `max_tokens` change.
- NO retry / backoff / drainer / concurrency change. #782 retained.
- NO familyRegistry change. Family I `productionEnabled:true` retained.
- NO Edge / Supabase function change. No `supabase/migrations/**`.
- NO prompt change. The MCP-EGI-005 deterministic null contract remains in the user prompts as the model-side instruction; the MCP-EGI-006 + MCP-EGI-007 server-side normalizer is the deterministic backstop.
- NO dispatcher wiring change. The MCP-EGI-006 Step-3.5 insertion already covers every family because the normalizer is keyed by rawKey membership, not family routing.
- NO categorical expansion across the 12 H / remaining F / G rawKeys. This card adds exactly one rawKey.
- NO fixture rewrite.
- NO Family I rollback.
- NO #409 capacity / drain-pacing work.
- NO migration.
- NO provider spend / no deploy in THIS prompt.
- NO D3 / D4 advance in THIS prompt.

## 17. Preservation manifest

- `validateMcpBooleanObservationResponse` UNCHANGED.
- `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` UNCHANGED.
- `MAX_EVIDENCE_SPAN_CHARS = 240` UNCHANGED.
- `DOCTRINE_BAN_PATTERNS` UNCHANGED.
- `FAMILY_E/F/G/H/I/J_BAN_PATTERNS` UNCHANGED.
- All family scanners (`scanFamily<X>BooleanResponseForBanList`) UNCHANGED.
- All family prompts UNCHANGED.
- `FAMILY_E/G/I_MAX_TOKENS = 1500` UNCHANGED.
- `DRAINER_*` retry policy / backoff / concurrency UNCHANGED. #782 retained.
- `familyRegistry` UNCHANGED.
- `submit-argument` / Edge adapter / failure-detail builder UNCHANGED.
- `mcp-server/lib/keyLevelFailClosed.ts` UNCHANGED.
- `mcp-server/lib/banScanNormalize.ts` UNCHANGED.
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` UNCHANGED (MCP-EGI-006 dispatcher wiring already routes via rawKey membership, not family-specific code paths).
- No migrations / Edge / RLS / secret / env / `.env*` / `package.json` / lockfile / `app.json` / `supabase` tree change.

## 18. Acceptance

- Implementation PR green locally (40 + 1850 + typecheck + lint + Jest).
- Operator independent Gate B review (separate gate).
- Operator merge.
- Operator deploys `mcp-server/` to Deno Deploy (separate operator action).
- Operator re-runs MCP-EGI-004 canary against the new revision.
- Row evidence picks the next gate.

---

_Doctrine: `cdiscourse-doctrine §1` (no verdict tokens added; tests assert), `§7` (no AI call from production app — server-side mutator only), `§10a` (observation contract preserved — true+null is a valid observation, not an allegation); `test-discipline`: tests are part of "done"._
