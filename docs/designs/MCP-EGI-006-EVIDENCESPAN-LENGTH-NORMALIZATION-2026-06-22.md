# MCP-EGI-006 — Server-side null normalization for overlong compound evidenceSpan values

**Status:** Implementation PR open (this lane). Stop at PR; no merge, no deploy.
**Lane:** mcp-server tool-dispatch normalization. Deno Deploy-bearing after merge; Edge / Supabase / validator / ban-list / prompts UNCHANGED.
**Tracking:** new MCP-EGI-006 GitHub issue (created in P5), #783 (MCP-EGI-001 root), #786 (D3 canary lane), #789 (MCP-EGI-005 prompt-side null fallback, retained).
**Trigger:** post-MCP-EGI-005 D3 canary on `82f4715` (target `fa8b28a2-5481-4437-b827-e60172d16a81`) still dead-lettered the three E/G/I rawKeys with `evidence_span_length_exceeded` under the MCP-EGI-003 row-level discriminator. The prompt-only `MUST set null` instruction (MCP-EGI-005) was insufficient to flip model behavior on the compound structural rawKeys.

---

## 1. Goal

Make the null fallback for overlong compound structural rawKey evidenceSpan strings DETERMINISTIC at the server boundary, so a model that drafts a >240-char anchor cannot stall the queue with a `validation_failed / evidence_span_length_exceeded` rejection. Validator, ban-list, length cap, retry policy, prompts, and ALL existing scanners remain UNCHANGED.

## 2. Confirmed post-MCP-EGI-005 row evidence

From `argument_machine_observation_runs` (target `fa8b28a2-5481-4437-b827-e60172d16a81`, 2026-06-22T03:45:44Z → 04:10:40Z, mcp-server production build `fyv06aqkpntj`):

| Family | State | Attempts | `failure_sub_reason` | `mcp_tool_reason` | `mcp_tool_detail_category` | `validator_path` |
|--------|-------|----------|----------------------|---------------------|-----------------------------|--------------------|
| A `parent_relation` | succeeded att 1 | — | — | — | — | — |
| B `disagreement_axis` | succeeded att 1 | — | — | — | — | — |
| C `misunderstanding_repair` | succeeded att 1 | — | — | — | — | — |
| D `evidence_source_chain` | dead_letter att 5 | `provider_server_error` | **null** | **null** | **null** | (separate transient — out of scope) |
| **E `argument_scheme`** | **dead_letter att 5** | 5 | `provider_server_error` | `validation_failed` | `evidence_span_length_exceeded` | `evidenceSpan.tradeoff_reasoning_present` |
| F `critical_question` | succeeded att 1 | — | — | — | — | — |
| **G `resolution_progress`** | **dead_letter att 5** | 5 | `provider_server_error` | `validation_failed` | `evidence_span_length_exceeded` | `evidenceSpan.synthesis_proposed` |
| H `claim_clarity` | succeeded att 1 | — | — | — | — | — |
| **I `thread_topology`** | **dead_letter att 5** | 5 | `provider_server_error` | `validation_failed` | `evidence_span_length_exceeded` | `evidenceSpan.compares_options` |

D is a single-data-point transient (see `MCP-EGI-005` doc §2 — D had succeeded att 1 on the prior canary). E/G/I are the deterministic packet-shape residual.

## 3. Why prompt-only failed

MCP-EGI-005 added the rule-6/7/8 deterministic-null contract to E/G/I user prompts:

> "If the string you would emit is longer than 240 characters, OR if you are not confident you can keep it under 240 characters, you MUST set evidenceSpan.<rawKey> to null. When in doubt, set null."

That rule sits AFTER the response-shape JSON example, which still illustrates `evidenceSpan: <short verbatim quote>` for the compound keys. On comparison-dense input the model draws on the schema example's pattern and drafts a multi-sentence anchor of natural length 250–400 chars, ignoring the textual rule. Three canaries (post-MCP-EGI-002, post-MCP-EGI-003, post-MCP-EGI-005) demonstrate the residual is not a prompt-wording problem but a model-behavior cap that pure prompt iteration cannot reliably break.

## 4. Why server-side normalization is now justified

- The validator already accepts `string | null` for `evidenceSpan.<rawKey>`. There is no schema-side change to make.
- The validator already accepts `observations.X = true + evidenceSpan.X = null` (pinned by MCP-EGI-005's regression test).
- The Edge / drainer / queue / Anthropic call costs incurred to discover the overlong-string failure are FIVE retry attempts per dead-letter, each consuming a `[60,180,360,600]` backoff window. That is the most expensive path in the system.
- The cheapest fix that closes the residual deterministically is a `len > 240 → null` rewrite at the server boundary BEFORE schema validation runs.
- The doctrine preservation question is answered without weakening any existing guarantee:
  - If the overlong string contains banned content under the family's byte-unchanged pattern stack, the normalizer leaves it alone — the validator's length reject still fires, and the existing ban-list-vs-length precedence holds. No banned content is silently discarded.
  - If the overlong string is clean, nulling it is structurally equivalent to a model that successfully followed the MCP-EGI-005 instruction.
- The pattern stack used here is `banPatternsForKeyLevelFamily()` — the IDENTICAL byte-unchanged set the family scanner stacks (OPS-MCP-KEY-LEVEL-FAIL-CLOSED's no-divergence rule carries forward).

## 5. Target rawKeys (locked scope)

```
tradeoff_reasoning_present     // Family E / argument_scheme
convergent_premise_structure   // Family E / argument_scheme
synthesis_proposed             // Family G / resolution_progress
compares_options               // Family I / thread_topology
```

These are the exact four compound structural rawKeys named by the post-#788 row evidence (across canaries 00:44 and 03:45). Any widening is a separate card. The set is exported as `EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS` and pinned by a regression test (drift-blocker).

## 6. Surfaces changed

| File | Change |
|------|--------|
| `mcp-server/lib/booleanObservationEvidenceSpanNormalizer.ts` | **NEW** — pure helper `normalizeLongEvidenceSpansForBooleanObservations(packet, options)` + 4-key set + event/category constants. |
| `mcp-server/tools/classifyArgumentBooleanObservations.ts` | **+wiring** — imports the helper; inserts a Step 3.5 call between provider result check (line 632) and validator call (line 635) with `family: resolvedFamily`; emits one structured `boolean_observations_evidence_span_normalized` info log per normalized rawKey. Validator call, ban-list scan, all other code paths byte-identical. |
| `mcp-server/tests/booleanObservationEvidenceSpanNormalizer.test.ts` | **NEW** — 35 tests. |

## 7. Helper contract

```ts
export const EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS: ReadonlySet<string>;
export const EVIDENCE_SPAN_NORMALIZATION_EVENT_NAME =
  'boolean_observations_evidence_span_normalized';
export const EVIDENCE_SPAN_NORMALIZATION_CATEGORY =
  'evidence_span_length_exceeded_to_null';

export interface EvidenceSpanNormalizationEvent {
  event: 'boolean_observations_evidence_span_normalized';
  family?: string;
  rawKey: string;
  path: string; // 'evidenceSpan.<rawKey>'
  category: 'evidence_span_length_exceeded_to_null';
  originalLength: number;
  maxLength: number;
  schemaVersion?: string;
  requestId?: string;
}

export function normalizeLongEvidenceSpansForBooleanObservations(
  packet: unknown,
  options?: { family?: string; schemaVersion?: string; requestId?: string },
): { packet: Record<string, unknown>; events: readonly EvidenceSpanNormalizationEvent[] };
```

Behavior:

1. Non-object packet → passthrough (validator rejects shape).
2. Non-object `evidenceSpan` → passthrough (validator rejects shape).
3. Missing / unrecognised family → conservative no-op (no silent drop of unscanned content).
4. For each `evidenceSpan[rawKey]`:
   - If rawKey ∉ `EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS` → preserve.
   - If `typeof value !== 'string'` → preserve (validator rejects type).
   - If `value.length <= MAX_EVIDENCE_SPAN_CHARS` → preserve.
   - If `banScanMatches(value, banPatternsForKeyLevelFamily(family))` → preserve (validator rejects length; doctrine preserved).
   - Else → set `null`, emit one event.
5. Returns the NEW packet (spread-cloned at top level + new `evidenceSpan`) when any mutation fires; the input packet by reference otherwise.
6. `observations` / `confidence` / `checkedRawKeys` / `modelInfo` are NEVER touched — references identity-preserved.

## 8. Doctrine preservation

- §1 — normalization to null asserts NOTHING; the model's stated observation and confidence remain. The structural anchor is removed because it exceeds the length cap, not because the server has formed a verdict on the move.
- §10a — observations vs allegations: nulling a compound anchor on length is a STRUCTURAL act, not a quality verdict.
- §6 — the safe log event carries `family / rawKey / path / category / originalLength / maxLength / schemaVersion / requestId` and NEVER the raw span value, the raw packet, the prompt, the argument body, or any secret. A leak-audit test serializes the event and asserts a sentinel value never appears.
- Ban-list intent — the overlong string is scanned BEFORE the null decision. A match leaves the value untouched so the validator's length reject still fires and the existing ban-list-vs-length precedence is preserved. No banned content is silently dropped.

## 9. Tests

**`mcp-server/tests/booleanObservationEvidenceSpanNormalizer.test.ts`** — **35 Deno tests:**

| Group | Count | What is proven |
|-------|-------|----------------|
| Key-set + constants | 2 | The 4 locked rawKeys + stable event / category names. |
| Per-target normalization (×4 keys) | 4 | 241-char string normalized to null for each compound rawKey. |
| Boundary preservation (×4 keys) | 4 | Exactly 240-char string preserved (no off-by-one). |
| Post-normalization validation (×4 keys) | 4 | Validator now accepts; `observations`/`confidence` intact. |
| Doctrine preservation (×4 keys) | 4 | Overlong + banned content (`winner`) NOT normalized; validator still rejects for length. |
| Out-of-scope rawKey | 1 | `cited_source_present` overlong still fails validator. |
| Type branches (object, array, boolean, number) | 4 | Validator's type-branch still rejects all four. |
| Missing key | 1 | Key-set asymmetry still fails validator. |
| False observation + overlong | 1 | Observation-value-agnostic normalization. |
| Missing family option | 1 | Conservative no-op (no silent drop). |
| Non-object packet / non-object spans | 2 | Passthrough; validator handles. |
| Multi-key partial | 1 | Only the overlong target is normalized; siblings byte-equal. |
| Leak audit | 1 | Event JSON never contains the raw span. |
| Validator preservation | 2 | `MAX_EVIDENCE_SPAN_CHARS=240` pinned; direct validator rejects 241. |
| Dispatcher source-wiring | 2 | Tool dispatch imports the helper, calls it before the validator, receives `resolvedFamily`, emits the log with only safe fields. |
| Identity preservation | 1 | `observations` / `confidence` / `checkedRawKeys` references preserved. |

No fixture-driven dispatcher tests are added — the wiring is proven by source-level structural assertion + the existing dispatcher test fleet (Family E/G/I/J dispatch tests) covers the call shape independently.

## 10. Verification (this PR, no provider spend)

| Command | Result |
|---------|--------|
| `cd mcp-server && deno test --allow-net --allow-env --allow-read tests/booleanObservationEvidenceSpanNormalizer.test.ts` | **35 / 0** (~16 ms) |
| `cd mcp-server && deno test --allow-net --allow-env --allow-read tests/familyEPrompt.test.ts tests/familyGPrompt.test.ts tests/familyIPrompt.test.ts tests/mcpEgiEvidenceSpanRegression.test.ts tests/booleanObservationEvidenceSpanNormalizer.test.ts` | **184 / 0** (~310 ms) |
| `cd mcp-server && deno test --allow-net --allow-env --allow-read tests/` | **1845 / 0** (~7 s) — +35 net over the 1810 MCP-EGI-005 baseline |
| `npm run typecheck` | clean |
| `npm run lint --max-warnings 0` | (run-time gate; see PR body) |
| `npm test` (full Jest) | (run-time gate; see PR body) |

## 11. Deploy implications

- mcp-server change is **Deno Deploy-bearing.** Merge to `main` does NOT auto-deploy `mcp-server/`. The GitHub integration `deploy/civildiscourse/cdiscourse-mcp-server` builds the new commit but production-alias promotion is an operator dashboard action (per the verified MCP-EGI-005 pattern). Operator gate.
- Edge / Supabase / migration / config / `.env*` UNCHANGED.

## 12. Next D3 canary after deploy

After operator-verified production deploy, the next canary's row should show one of:

- **Success path:** the 3 EGI families succeed; on rows where the compound rawKey was positive, `evidenceSpan.<rawKey>` is either a short anchor under 240 chars OR null. Where the rawKey was positive AND the model emitted >240 chars, the success row will carry null; the normalizer's log event records the rawKey/family/originalLength. D3 PASS gate is "0 dead-letter on the target across 9 family cells."

- **Continued failure path under a NEW shape:** if `mcp_tool_detail_category` is `evidence_span_invalid_type` / `evidence_span_key_set_*` / `doctrine_ban_list`, the row evidence picks the next iteration's lane. The length-residual lane (this card) is closed.

- **Continued failure path under length (would be a bug in this PR):** must not happen. If it does, the normalizer was not invoked (deploy regression) or the rawKey was not in scope (a fifth rawKey exists). Investigate by hosted-MCP replay of the row's correlation_id.

The row will pick the next lane on its own.

## 13. Non-goals (explicit)

- NO validator change.
- NO ban-list change. No pattern added, removed, or reordered.
- NO `MAX_EVIDENCE_SPAN_CHARS` change.
- NO `max_tokens` change.
- NO retry / backoff / drainer / concurrency change. #782 retained.
- NO familyRegistry change. Family I `productionEnabled:true` retained.
- NO Edge / Supabase function change. No `supabase/migrations/**`.
- NO prompt change. The MCP-EGI-005 deterministic null contract remains in the user prompts as the model-side instruction; the server-side normalizer is the deterministic backstop.
- NO fixture rewrite.
- NO Family I rollback.
- NO #409 capacity / drain-pacing work.
- NO migration.
- NO provider spend / no deploy in THIS prompt.
- NO D3 / D4 advance in THIS prompt.

## 14. Preservation manifest

- `validateMcpBooleanObservationResponse` UNCHANGED (no edit, no re-export).
- `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` UNCHANGED.
- `MAX_EVIDENCE_SPAN_CHARS = 240` UNCHANGED.
- `DOCTRINE_BAN_PATTERNS` UNCHANGED.
- `FAMILY_E/F/G/H/I/J_BAN_PATTERNS` UNCHANGED.
- All family scanners (`scanFamily<X>BooleanResponseForBanList`) UNCHANGED.
- All family prompts (`familyEPrompt.ts` / `familyGPrompt.ts` / `familyIPrompt.ts`) UNCHANGED — MCP-EGI-005's rule-6/7/8 deterministic-null wording remains.
- `FAMILY_E/G/I_MAX_TOKENS = 1500` UNCHANGED.
- `DRAINER_*` retry policy / backoff / concurrency UNCHANGED. #782 retained.
- `familyRegistry` UNCHANGED.
- `submit-argument` / Edge adapter / failure-detail builder UNCHANGED.
- `mcp-server/lib/keyLevelFailClosed.ts` UNCHANGED.
- `mcp-server/lib/banScanNormalize.ts` UNCHANGED.
- No migrations / Edge / RLS / secret / env / `.env*` / `package.json` / lockfile / `app.json` / `supabase` tree change.

## 15. Acceptance

- Implementation PR green locally (35 + 1845 + typecheck + lint + Jest).
- Operator independent Gate B review (separate gate).
- Operator merge.
- Operator deploys `mcp-server/` to Deno Deploy (separate operator action).
- Operator re-runs MCP-EGI-004 canary against the new revision.
- Row evidence picks the next gate.

---

_Doctrine: `cdiscourse-doctrine §1` (no verdict tokens added; tests assert), `§7` (no AI call from production app — server-side mutator only), `§10a` (observation contract preserved — true+null is a valid observation, not an allegation); `test-discipline`: tests are part of "done"._
