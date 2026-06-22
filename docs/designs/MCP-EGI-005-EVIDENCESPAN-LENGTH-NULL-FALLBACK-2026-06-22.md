# MCP-EGI-005 — Force null fallback for E/G/I compound evidenceSpan length cap

**Status:** Implementation PR open (#789 lane). Stop at PR; no merge, no deploy.
**Lane:** mcp-server prompt-only (Families E + G + I rule-6/7/8 reinforcement). Deno Deploy-bearing after merge; Edge/Supabase UNCHANGED.
**Tracking:** #789 (this card), #783 (MCP-EGI-001 root), #786 (next D3 canary lane).
**Trigger:** Post-MCP-EGI-003 D3 canary on `08ef334` (target `64907304-7aa2-499a-a3f2-187119ecfff2`) confirmed `evidence_span_length_exceeded` on all three failing rawKeys via the newly-unmasked `failure_detail` row evidence. The MCP-EGI-001 verdict `BLOCKED_SAFE_STRUCTURAL_DETAIL_NEEDED` is now revised to **`CONFIRMED_EVIDENCESPAN_LENGTH_CAP`**.

---

## 1. Goal

Make the null fallback for compound structural rawKey evidenceSpan strings DETERMINISTIC, so a model that drafts a >240-char anchor cannot choose length-overflow over null. Validator, ban-list, length cap, retry policy unchanged.

## 2. Confirmed post-#788 row evidence

From `argument_machine_observation_runs` (target `64907304-7aa2-499a-a3f2-187119ecfff2`, 2026-06-22):

| Family | State | Attempts | `failure_sub_reason` | `failure_detail->>'mcp_tool_reason'` | `failure_detail->>'mcp_tool_detail_category'` | `failure_detail->>'validator_path'` |
|--------|-------|----------|----------------------|---------------------------------------|-----------------------------------------------|-------------------------------------|
| A `parent_relation` | succeeded att 1 | — | — | — | — | — |
| B `disagreement_axis` | succeeded att 1 | — | — | — | — | — |
| C `misunderstanding_repair` | succeeded att 1 | — | — | — | — | — |
| D `evidence_source_chain` | succeeded att 1 | — | — | — | — | — |
| **E `argument_scheme`** | **dead_letter att 5** | 5 | `provider_server_error` | `validation_failed` | `evidence_span_length_exceeded` | `evidenceSpan.tradeoff_reasoning_present` |
| F `critical_question` | succeeded att 1 | — | — | — | — | — |
| **G `resolution_progress`** | **dead_letter att 5** | 5 | `provider_server_error` | `validation_failed` | `evidence_span_length_exceeded` | `evidenceSpan.synthesis_proposed` |
| H `claim_clarity` | succeeded att 1 | — | — | — | — | — |
| **I `thread_topology`** | **dead_letter att 5** | 5 | `provider_server_error` | `validation_failed` | `evidence_span_length_exceeded` | `evidenceSpan.compares_options` |

D recovered att 1 this canary (vs att 3 last canary — provider-transient distribution shifted; D is a genuine-transient case that #782 handles correctly). All three EGI rawKeys deterministically overflow.

## 3. Why #785 succeeded

The MCP-EGI-003 unmasking lane persisted exactly the fields it was designed to (`mcp_tool_reason`, `mcp_tool_detail_category`, dotted `validator_path`). The 6 succeeded cells correctly have NULL on all three new fields (no false positives). The unmasking lane selected this card's lane on row evidence rather than speculation.

## 4. Why #782 is retained

`evidence_source_chain` succeeded on attempt 1 this canary; on the prior canary it needed attempt 3. The provider-transient distribution is real, and #782's extended `[60,180,360,600]` cap-5 budget continues to handle it. The current blocker is NOT retry budget; it is the deterministic packet-shape residual on E/G/I.

## 5. Why #409 / capacity is not current

P1 evidence + 3 successive canaries with HTTP 200 / app-level validation failure prove the live cause is deterministic packet shape, not provider transient. No capacity / drain-pacing work is justified by row data.

## 6. Why validator + max cap are preserved

- `validateMcpBooleanObservationResponse` accepts `evidenceSpan.<key>` as `string | null`. Key-set coordination is satisfied by presence; setting `null` counts as present.
- No validator rule conditions evidenceSpan on the observation boolean. `observations.X=true + evidenceSpan.X=null` is fully accepted today.
- `MAX_EVIDENCE_SPAN_CHARS = 240` is the doctrine-correct cap; the prompt must conform to it, not the other way around.

The fix is therefore prompt-side only.

## 7. Prompt-only fix plan

Replace the discretionary "if no single anchor span fits, set the value to null" wording with a deterministic **LENGTH FALLBACK IS NULL — NEVER OVERFLOW** sub-block for each of the four named compound rawKeys.

### Surfaces

| File | rawKey reinforcement updated |
|------|------------------------------|
| `mcp-server/lib/familyEPrompt.ts` rule 7 | `convergent_premise_structure` |
| `mcp-server/lib/familyEPrompt.ts` rule 8 | `tradeoff_reasoning_present` |
| `mcp-server/lib/familyGPrompt.ts` rule 6 | `synthesis_proposed` |
| `mcp-server/lib/familyIPrompt.ts` rule 6 | `compares_options` |

### Sub-block contract (applied per rawKey)

- **Soft target under 200 chars; hard limit 240.**
- **MUST set to null on overflow:** "If the string you would emit is longer than 240 characters, OR if you are not confident you can keep it under 240 characters, you MUST set evidenceSpan.<rawKey> to null."
- **When in doubt, set null.**
- **True + null is valid** (synthetic schema example paired with the rawKey).
- **Negative instructions** — Do NOT truncate mid-sentence; Do NOT paraphrase into a longer string; Do NOT emit a multi-sentence span; Do NOT quote the whole comparison / pro-con / synthesis / premise list.
- Existing rule-6/7/8 type-forbid (no object / array / boolean / number / missing entry) preserved.
- 240-char cap citation preserved.
- False observation → null (unchanged).
- `abductive_explanation_present` reinforcement byte-equal anchors preserved (Family E).
- Strict response-shape contract block (rules 1–5) unchanged.

### Wording discipline

- "MUST" + closed conditions, not "may" / "if no single anchor span fits".
- No mention of "paraphrase" as a length-cap escape; if it's still allowed at all, it's bounded under 240 and secondary to null.
- No verdict / doctrine / fallacy tokens.

## 8. Tests

| Suite | Surface | Counts |
|-------|---------|--------|
| `mcp-server/tests/familyEPrompt.test.ts` | rule-7 + rule-8 deterministic-null + preservation | +3 tests |
| `mcp-server/tests/familyGPrompt.test.ts` | rule-6 deterministic-null + preservation | +2 tests |
| `mcp-server/tests/familyIPrompt.test.ts` | rule-6 deterministic-null + preservation | +2 tests |
| `mcp-server/tests/mcpEgiEvidenceSpanRegression.test.ts` | `observations.X=true + evidenceSpan.X=null` accepted for the 4 rawKeys | +4 tests (×4 cases) |

Total: **+11 Deno tests**.

Prompt tests assert each new sub-block:
- contains LENGTH FALLBACK IS NULL anchor,
- contains MUST-set-null + When-in-doubt + true+null example + no-truncate + no-longer-paraphrase + no-multi-sentence,
- preserves the rule-6/7/8 type-forbid + 240-char cap citation,
- introduces no banned verdict tokens.

Validator regression tests pin the true+null acceptance for the 4 rawKeys so the prompt-side null fallback is safe to instruct.

Tests do NOT assert that the next canary will pass. They prove prompt contract + validator acceptance only.

## 9. Verification

Local:
- `cd mcp-server && deno test --allow-net --allow-env --allow-read tests/familyEPrompt.test.ts tests/familyGPrompt.test.ts tests/familyIPrompt.test.ts tests/mcpEgiEvidenceSpanRegression.test.ts` — **149 / 0** (~0.25 s)
- `cd mcp-server && deno test --allow-net --allow-env --allow-read tests/` — **1810 / 0** (~7 s) — +11 net over the 1799 pre-EGI-005 baseline.
- `npm run typecheck` — clean.
- `npm run lint --max-warnings 0` — clean.
- `npm run test` (Jest full) — **32,166 passed / 1 skipped / 0 failed** across 859 suites (24.9 s) — byte-equal Jest surface since mcp-server is Deno-only.

## 10. Deploy implications

- **mcp-server prompt change is Deno Deploy-bearing.** Merge to `main` does NOT auto-deploy `mcp-server/`. Push/promote to Deno Deploy via the `deploy/civildiscourse/cdiscourse-mcp-server` integration is a SEPARATE operator action.
- Edge / Supabase / migration / config UNCHANGED.

## 11. Next D3 canary after deploy

Operator-gated provider spend. Recommend reusing the recovered `.tmp/d3-egi-004-canary-submit.js` harness (1 root + 1 comparison-dense target; smoke-tagged room). The next canary's row should show:
- **Success path:** the 3 EGI families succeed with `evidenceSpan.<rawKey>` set to a short anchor under 240 chars OR to null (true+null is now an explicit instruction the model may follow).
- **Continued failure path:** if `mcp_tool_detail_category` is still `evidence_span_length_exceeded`, the deterministic instruction was insufficient — escalate to a further-iteration prompt or an explicit Anthropic prompt-token-limit investigation.
- **Different failure shape:** if `mcp_tool_detail_category` is `evidence_span_invalid_type` / `evidence_span_key_set_*` / `doctrine_ban_list`, the next iteration targets that category.

The row will pick the next lane on its own.

## 12. Non-goals (explicit)

- NO validator change.
- NO ban-list change.
- NO `MAX_EVIDENCE_SPAN_CHARS` / `max_tokens` change.
- NO retry / backoff / drainer / concurrency change. #782 retained.
- NO familyRegistry change.
- NO Edge / Supabase function change.
- NO `mcp-server/tools/classifyArgumentBooleanObservations.ts` behavior change.
- NO fixture rewrite.
- NO Family I `productionEnabled` rollback.
- NO #409 capacity / drain-pacing work.
- NO migration.
- NO provider spend / no deploy in THIS prompt.

## 13. Preservation manifest

- `validateMcpBooleanObservationResponse` UNCHANGED.
- `MAX_EVIDENCE_SPAN_CHARS = 240` UNCHANGED.
- Doctrine ban-list scanners UNCHANGED.
- `FAMILY_E/G/I_MAX_TOKENS = 1500` UNCHANGED.
- `DRAINER_*` retry policy / backoff / concurrency UNCHANGED. #782 retained.
- `familyRegistry` UNCHANGED.
- `submit-argument` / Edge adapter / failure-detail builder UNCHANGED.
- Submission engine UNCHANGED.
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` UNCHANGED.
- `mcpBooleanObservationSchemaMirror.ts` UNCHANGED.
- No migrations / Edge / RLS / secret / env / `.env*` / `package.json` / lockfile / `app.json` / `supabase` tree change.

## 14. Acceptance

- Implementation PR (#789 lane) green locally.
- Operator deploys `mcp-server/` to Deno Deploy (separate operator action).
- Operator re-runs MCP-EGI-004 canary against the new revision.
- Row evidence picks the next gate.

---

_Doctrine: `cdiscourse-doctrine §1` (the new sub-block introduces no verdict tokens — banned-token scans assert), `§7` (no AI call from production app — server-side prompt rewrite), `§10a` (observation contract preserved — true+null is a valid observation, not an allegation). `test-discipline`: tests are part of "done"._
