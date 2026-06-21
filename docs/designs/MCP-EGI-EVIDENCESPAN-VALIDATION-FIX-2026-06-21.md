# MCP-EGI-EVIDENCESPAN-VALIDATION-FIX (2026-06-21)

**Status:** Design / issue-correction only (no production code change in this prompt).
**Lane:** mcp-server prompt hardening (Families G + I to E's strict contract; per-rawKey reinforcement for `convergent_premise_structure`, `tradeoff_reasoning_present`, `synthesis_proposed`, `compares_options`) + Edge observability follow-up.
**Tracking:** MCP-EGI-001 (to be created), MCP-EGI-002 (prompt hardening), MCP-EGI-003 (Edge unmasking), MCP-EGI-004 (D3 re-smoke).
**Supersedes interpretation of:** #394 (capacity hypothesis), #552 (drain-retry hypothesis), #782 (retry-budget bump as a D3 fix).
**Does not roll back:** Family I `productionEnabled:true`, `#782` (retained as a defensive improvement for genuine long transients), drain concurrency / pacing, retry budget.

---

## 1. Goal

Pin the inner root cause of the 2026-06-21 D3 dead-letter cluster on Families E (`argument_scheme`), G (`resolution_progress`), and I (`thread_topology`) — and choose the minimal, validator-preserving fix lane.

## 2. Corrected diagnosis

**Class:** `MCP_TOOL_VALIDATION_RESIDUAL_MASKED_AS_PROVIDER_SERVER_ERROR`.

After model success (HTTP 200 from Anthropic), the hosted MCP server's own structural validator rejects the model's response packet at path `evidenceSpan.<rawKey>` and returns an `{ isError: true, reason: 'validation_failed', path, detail }` envelope to the Edge. The Edge classifies that envelope as `api_error` + sub-reason `provider_server_error` and intentionally drops the validator's `detail` string. The persisted row therefore reads as if it were a provider 5xx, masking a deterministic schema mismatch.

Three preceding capacity-class hypotheses (drainer overload, retry budget, drain pacing / #409) are SUPERSEDED for this cluster, but #782 is RETAINED — it remains a correct improvement for genuine long-tail provider transients; it just cannot resolve a deterministic packet-shape residual.

## 3. P1 evidence (operator-supplied)

- `thread_topology` request `08beddd5-e0ef-4041-91cd-eb98f3559e33` (TraceID `ca66412dbb09b45816a84b106e513c2d`, revision `hbj3av5vdbmg`):
  lifecycle `anthropic_call_start → anthropic_call_success → boolean_observations_packet_invalid → boolean_observation_tool_error → compat_tools_call`.
  Anthropic HTTP 200, ~2627 ms. Inbound `/mcp/adapter-compat` HTTP 200.
  Inner reason `validation_failed`, schemaVersion `mcp-021.machine-observations.boolean.v1`, path `evidenceSpan.compares_options`.
- Confirmed family-path mapping (rawKey → owning family in source):
  - `thread_topology` → `evidenceSpan.compares_options` (Family I) — Anthropic 200, ~2627 ms
  - `argument_scheme` → `evidenceSpan.convergent_premise_structure` and `evidenceSpan.tradeoff_reasoning_present` (Family E) — Anthropic 200, ~6041 ms
  - `resolution_progress` → `evidenceSpan.synthesis_proposed` (Family G) — Anthropic 200, ~2930 ms
- Resource refutation (6-hour window):
  38 total requests, ~2.4 s total CPU, peak memory ~190 MiB, V8 GC ~0 ms, zero HTTP error-status bars. Both legs HTTP 200. The failure is application-level schema validation, invisible to HTTP / resource metrics.
- Query convention: the events are `boolean_observation_tool_error` and `boolean_observations_packet_invalid` — NOT `dead_letter` / `deadletter`.
- Logs expose `path` only; validator `detail` is structurally absent from both the Deno log emitter and the Edge `failure_detail` row (see §5 below).

## 4. Why capacity / retry / drain pacing are ruled out for THIS cluster

- Anthropic 200 + adapter-compat 200 + Deno resource bars at baseline (38 reqs / 6h / ~2.4 s CPU / ~190 MiB peak / zero V8 GC) refute provider overload / drainer overload / resource exhaustion as the cause.
- The retry-budget extension in #782 was sized to ~26 min worst-case backoff for ~13–15 min `provider_server_error` transients. It will not reschedule away a deterministic packet shape — the same rejection happens at attempt 5.
- Drain pacing / #409 is a topology-aware provider-reliability lane for genuinely-long transients (>~20 min) or capacity-bounded overload. Neither condition is present in P1.

These lanes remain valid for OTHER failure classes. They are simply not the lever for `evidenceSpan.<rawKey>` validation_failed under HTTP 200.

## 5. Validator contract — pinned from source

`mcp-server/lib/mcpBooleanObservationSchemaMirror.ts`:
- `MAX_EVIDENCE_SPAN_CHARS = 240` ([mcpBooleanObservationSchemaMirror.ts:38](mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:38)).
- evidenceSpan value rule: each entry MUST be `string | null` ([:212-218](mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:212)).
- Length cap: each string entry length ≤ `MAX_EVIDENCE_SPAN_CHARS` ([:219-225](mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:219)).
- Key-set coordination:
  - every key in `observations` MUST appear in `evidenceSpan` ([:239-245](mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:239)),
  - every key in `evidenceSpan` MUST appear in `observations` ([:256-263](mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:256)),
  - every key in `observations` MUST appear in `checkedRawKeys` ([:267-275](mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:267)).
- There is NO verbatim-substring requirement.
- The doctrine ban-list scan is a SEPARATE step (the tool dispatch's Step 5) and emits the distinct event `boolean_observations_doctrine_ban_list` with `detail: 'doctrine_ban_list'` ([mcp-server/tools/classifyArgumentBooleanObservations.ts:716-723](mcp-server/tools/classifyArgumentBooleanObservations.ts:716)) — NOT `boolean_observations_packet_invalid`. P1 surfaced the latter, so this is structural validation, not a ban-list residual.

**Exact validator paths that produce `evidenceSpan.<rawKey>` and their `detail` strings** (validator source-derived; mirrored locally in `.claude-tmp/egi-evidencespan-discriminator.mjs`):

| validator path | detail |
|----------------|--------|
| `evidenceSpan.<key>` | `value must be string or null` (object/array/boolean/number) |
| `evidenceSpan.<key>` | `length N exceeds max 240` (string > 240 chars) |
| `evidenceSpan.<key>` | `rawKey present in observations but missing from evidenceSpan` |
| `evidenceSpan.<key>` | `rawKey present in evidenceSpan but missing from observations` |

All four detail strings are STRUCTURAL — they name no values.

## 6. Why the `detail` discriminator is currently invisible

- The MCP server's `emitToolErrorLog` allowlist logs `tool / reason / family / requestId / mode / schemaVersion / classifierSetVersion / serverName / path / status` and does NOT log `detail` ([mcp-server/tools/classifyArgumentBooleanObservations.ts:334-345](mcp-server/tools/classifyArgumentBooleanObservations.ts:334)).
- The Edge `booleanObservationMcpAdapter.ts:264-276` detects the `{ isError, reason, path, detail }` envelope and builds a Phase-1 sanitized `failure_detail` carrying `serverReason` + `path` only; the comment is explicit: "the raw `detail` is NEVER forwarded (no `detail:` arg exists on FailureDetailInput)" ([booleanObservationMcpAdapter.ts:261-274](supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts:261)).
- The `RunRowFailureDetail` jsonb shape ([classifierRunRowFailureDetail.ts:43-51](supabase/functions/_shared/booleanObservations/classifierRunRowFailureDetail.ts:43)) carries `validator_path`, `reason`, `family`, `correlation_id`, `attempt_count`, `run_mode`, `schema_version` — no `validator_detail` key.

So the operator's P1 surface (`path = evidenceSpan.<rawKey>`) does NOT distinguish length / type / key-set-asymmetry shape, even though the validator itself emits a discriminating detail string at construction time. This is a deliberate Phase-1 leak-safety posture, not an oversight, and unmasking belongs in MCP-EGI-003.

## 7. Prompt contract — pinned from source

| Family | Strict 5-rule contract | Per-rawKey shape reinforcement | Failing key(s) in P1 |
|--------|-----------------------|-------------------------------|----------------------|
| E (`argument_scheme`) | YES — KEY-SET EQUALITY / EVERY REQUESTED RAWKEY ONCE / EVIDENCESPAN VALUE TYPE / NULL FOR FALSE / SELF-CHECK ([familyEPrompt.ts:234-272](mcp-server/lib/familyEPrompt.ts:234)) | Only for `abductive_explanation_present` ([familyEPrompt.ts:274-286](mcp-server/lib/familyEPrompt.ts:274)). NOT for `convergent_premise_structure` or `tradeoff_reasoning_present`. | `convergent_premise_structure`, `tradeoff_reasoning_present` |
| G (`resolution_progress`) | NO — only two-rule hint ("every key in observations MUST also appear in confidence and evidenceSpan" / "every key in checkedRawKeys MUST appear in observations" — [familyGPrompt.ts:258-260](mcp-server/lib/familyGPrompt.ts:258)). No value-type rule, no 240-char-cap statement, no null-for-false rule, no self-check, no per-key reinforcement. | None. | `synthesis_proposed` |
| I (`thread_topology`) | NO — same weaker two-rule hint ([familyIPrompt.ts:270-272](mcp-server/lib/familyIPrompt.ts:270)). | None. | `compares_options` |

The four failing keys are precisely the rawKeys whose semantic shape tempts a structural / compound `evidenceSpan` value:

- `convergent_premise_structure` — by definition a LIST of independent reasons. Positive example in source: `"It works for three independent reasons: cost, equity, and feasibility."` ([familyEKeys.ts:394](mcp-server/lib/familyEKeys.ts:394)). Tempts an array or a `>240`-char concatenation.
- `tradeoff_reasoning_present` — tempts an object like `{ pro: "...", con: "..." }`.
- `synthesis_proposed` — combining "BOTH sides' elements" ([familyGPrompt.ts:107-108](mcp-server/lib/familyGPrompt.ts:107)) tempts an object like `{ sideA: ..., sideB: ... }`.
- `compares_options` — "weighs two+ options on stated criteria" ([familyIKeys.ts:41](mcp-server/lib/familyIKeys.ts:41)) tempts an array or option-keyed object.

## 8. Root-cause verdict

**Verdict: `CONFIRMED_PROMPT_SCHEMA_MISMATCH` for Families G + I, compounded with `BLOCKED_SAFE_STRUCTURAL_DETAIL_NEEDED` for the specific live-rejected value shape across all four failing keys.**

Discipline:
- The validator contract is `string | null`, length ≤ 240, with key-set coordination (proven from source, §5).
- Family G and Family I prompts source-provably DO NOT carry the value-type / null-for-false / 240-char-cap / self-check rules; they carry only a two-rule key-set hint (proven from source, §7). That is a real contract gap, independent of which specific live shape was rejected.
- Family E's per-key reinforcement covers only `abductive_explanation_present`; the two failing Family E rawKeys are compound-structural and rely on the general rule 3. The general rule reads "no scheme has a special nested or structured evidenceSpan shape," which is correct contractually but is the rule most likely to be ignored when the model encounters a multi-axis positive at low temperature.
- The specific live rejected SHAPE — length / type / key-set asymmetry — is NOT determinable from current logs or the row's `failure_detail`. The discriminator is structurally suppressed by the Phase-1 leak-safety posture (§6).
- Real organic positive arguments CAN hit these four rawKeys. This is NOT fixture-only.

We do NOT classify this as `CONFIRMED_EVIDENCESPAN_LENGTH_CAP` or `CONSISTENT_WITH_LENGTH_CAP_BUT_UNCONFIRMED`. Length is one of four candidate live shapes; none is confirmed in the absence of detail.

## 9. Local zero-spend discriminator (recorded)

`.claude-tmp/egi-evidencespan-discriminator.mjs` mirrors the validator and enumerates every variant for the four failing keys (short string / null / 240 / 241 / object / array / boolean / number / missing entry / extra entry). It prints only `(family, key, variant, ok, validator_path, validator_detail)` — no raw spans, no prompt text, no provider call. Result:

- All four candidate live shapes (length>240, non-string non-null type, missing entry, extra entry) produce `path = evidenceSpan.<rawKey>` with structurally distinct `detail` strings.
- `null`, short string, and exactly 240 chars always pass.
- The validator's behavior is the same for all four failing keys; there is no per-key validator branch.

The discriminator confirms the candidate set is FOUR shapes, and that without the validator detail we cannot pick among them for the live cluster.

## 10. Fix decision tree

1. **Prompt hardening only (recommended primary lane — MCP-EGI-002):**
   - Lift Family E's STRICT RESPONSE-SHAPE CONTRACT block (rules 1–5) into Family G and Family I prompts, byte-for-byte adjusted for family-specific framing.
   - Add per-rawKey shape reinforcement (rule 6 equivalent) for `convergent_premise_structure` and `tradeoff_reasoning_present` in Family E, and for `synthesis_proposed` (Family G) and `compares_options` (Family I). Each reinforcement names the rawKey, lists the allowed shapes (string ≤ 240 OR null), and forbids the structural shapes (`{quote, band}` objects, `["a","b"]` arrays, booleans, numbers, missing entries).
   - This covers ALL FOUR validator paths simultaneously — independent of which specific live shape was rejected.
2. **Prompt hardening + validator regression tests (MCP-EGI-002 §test plan):** add per-key prompt-validator tests that assert the prompt forbids object/array/boolean/number/missing/extra entries for each of the four failing keys; add validator regression cases that document each of the four detail strings.
3. **Edge failure-detail unmasking (MCP-EGI-003 — observability lane):** thread a structural-only validator-detail discriminator through the existing `failure_detail` jsonb without exposing values. Two safe variants — (a) extend the typed sub-reason vocabulary (a fresh `response_evidence_span_value_invalid_type` / `response_evidence_span_length_exceeded` / `response_evidence_span_key_set_asymmetric` triple, mapped from the validator detail string), or (b) add a static-allowlist `validator_detail_category` field. EITHER is safe — both name structural CATEGORIES, never values.
4. **Fixture rewrite:** NOT in scope. The fixture is useful precisely because it deterministically exercises these structural keys; rewriting it would mask, not fix.

## 11. Recommended minimal fix (MCP-EGI-002 outline)

- Files expected: `mcp-server/lib/familyGPrompt.ts`, `mcp-server/lib/familyIPrompt.ts`, `mcp-server/lib/familyEPrompt.ts` (only the per-rawKey reinforcement block at the bottom), plus the family prompt tests under `mcp-server/tests/`.
- Validator gate `validateMcpBooleanObservationResponse` is UNCHANGED.
- Ban-list scan UNCHANGED.
- `MAX_TOKENS` unchanged (1500 for E/G/I).
- `MAX_EVIDENCE_SPAN_CHARS = 240` unchanged.
- Retry policy + drain concurrency + pacing UNCHANGED.

## 12. Non-goals (explicit)

- NO validator relaxation.
- NO ban-list relaxation.
- NO retry-budget change. #782 stays merged.
- NO drain pacing / #409 lane.
- NO Family I `productionEnabled` rollback.
- NO fixture rewrite before root-cause design is approved.
- NO `MAX_EVIDENCE_SPAN_CHARS` bump (the cap is doctrine-correct; the prompt must conform to it).
- NO mcp-server prompt/schema/validator edit in THIS prompt (this is design + issue trail only).
- NO provider spend in THIS prompt.
- NO deploy in THIS prompt.

## 13. File surfaces expected in the future implementation card

| File | Change shape |
|------|--------------|
| `mcp-server/lib/familyGPrompt.ts` | Add Family-E-equivalent STRICT RESPONSE-SHAPE CONTRACT block + rule-6 per-key reinforcement for `synthesis_proposed`. |
| `mcp-server/lib/familyIPrompt.ts` | Same — add strict block + rule-6 per-key reinforcement for `compares_options`. |
| `mcp-server/lib/familyEPrompt.ts` | Add rule-6 per-key reinforcement for `convergent_premise_structure` and `tradeoff_reasoning_present` (existing strict block kept byte-equal). |
| `mcp-server/tests/familyGPrompt.test.ts` | Add tests asserting the new strict block + per-key reinforcement; assert no doctrine ban-list tokens introduced. |
| `mcp-server/tests/familyIPrompt.test.ts` | Same as G. |
| `mcp-server/tests/familyEPrompt.test.ts` | Add per-key tests for the two new reinforced keys. |
| `mcp-server/tests/familyEResponseValidator.test.ts` / `familyGResponseValidator.test.ts` / `familyIResponseValidator.test.ts` | Regression cases per failing rawKey × variant (object / array / 241-char string / missing entry). |
| (MCP-EGI-003 only) `supabase/functions/_shared/booleanObservations/booleanObservationFailureSubreason.ts` | Wire a structural `validator_detail_category` discriminator OR mint typed sub-reasons. |

## 14. Test plan (for the implementation card)

- Prompt tests assert the strict response-shape contract block is present in Families G + I, byte-equivalent to Family E's rules 1–5 modulo family-specific framing.
- Tests assert per-key shape reinforcement for: `convergent_premise_structure`, `tradeoff_reasoning_present`, `synthesis_proposed`, `compares_options`. Each test asserts the rule names the rawKey, names the four forbidden shapes, and points at the validator path.
- Tests assert "no banned doctrine/verdict tokens introduced by new prompt text" — reuse the prevailing per-family ban-list-source-scan pattern.
- Validator regression cases per family encode each of the four detail strings as expected outputs for the canonical bad packet shape — the discriminator output table in §9 is a ready-made fixture.
- Edge mapping test (MCP-EGI-003): assert that the new structural discriminator never echoes a value, only a category.

## 15. Preservation manifest

- `validateMcpBooleanObservationResponse` UNCHANGED.
- Ban-list scanners UNCHANGED.
- `MAX_TOKENS` (1500 for E/G/I), `FAMILY_*_MAX_BODY_FIELD_LEN`, `FAMILY_*_TEMPERATURE` UNCHANGED.
- `MAX_EVIDENCE_SPAN_CHARS = 240` UNCHANGED.
- `DRAINER_MAX_ATTEMPTS`, `DRAINER_PROVIDER_SERVER_ERROR_MAX_ATTEMPTS`, backoff schedules UNCHANGED.
- `familyRegistry` UNCHANGED.
- `submit-argument` / `classify-argument-boolean-observations` Edge dispatch surface UNCHANGED.
- Submission engine (`src/lib/constitution/engine.ts`, `src/domain/constitution/engine.ts`) UNCHANGED — this is post-storage / advisory.
- No migrations.
- No env / secret / cron mutation.

## 16. Deploy / operator notes

- Any `mcp-server/` prompt change is **Deno Deploy-bearing**. The Supabase GitHub integration does NOT deploy `mcp-server/` on merge to `main` — that path goes to Deno Deploy via the `deploy/civildiscourse/cdiscourse-mcp-server` integration. Push/promote remains operator-only.
- Post-deploy D3 re-smoke is a SEPARATE authorized provider spend (MCP-EGI-004): Family I canary first; if clean (0 dead-letter, ≥1 Family-I positive), then the N=8 / 72-cell burst. PASS bar unchanged: 0 terminal dead-letters across E/G/I cells.
- A clean re-smoke earns the 9-family PASS-LOAD but does NOT advance the organic queue-routing percentage ladder.
- If the re-smoke STILL dead-letters `evidenceSpan.<rawKey>` at the same paths after the prompt hardening lands, the next lever is the MCP-EGI-003 unmasking (so we can see length vs type vs asymmetry on the live wire) before any further prompt rewrite.

## 17. Acceptance

- Implementation PR (MCP-EGI-002) green locally on `npm run typecheck`, `npm run lint`, `npm run test`.
- Per-family prompt + validator regression tests added, including a no-banned-tokens scan on the new prompt text.
- Operator deploys `mcp-server/` to Deno (GATE-MERGE + Deno push/promote).
- D3 re-smoke canary 9/9, 0 dead-letter (MCP-EGI-004). Burst gated behind canary.
- D4 remains BLOCKED until clean re-smoke.
- #782 retained as a defensive improvement.
- Family I `productionEnabled:true` retained.

---

_Doctrine: `cdiscourse-doctrine §1` (the prompt hardening adds no verdict tokens — the strict-contract block names structural shapes, not adjudications); `§7` (no AI call from production app — this is a server-side prompt rewrite); `§10a` (observations, not allegations — the rule-6 reinforcement explicitly notes the validator path, never a verdict). `test-discipline`: tests are part of "done," not a follow-up._
