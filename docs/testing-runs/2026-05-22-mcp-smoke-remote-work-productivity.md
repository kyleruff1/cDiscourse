# MCP semantic-referee smoke test — remote work productivity scenario

**Date:** 2026-05-22
**Run id:** `51fc7750`
**Scenario:** `smoke-test-mcp-remote-work-productivity` (8-move adversarial scenario, committed 702dd65)
**Orchestrator:** `scripts/bot-fixtures/runMcpSmokeTest.js` (committed daf3dad)
**Log:** `logs/mcp-smoke-test/51fc7750.json` (gitignored; preserved locally for diagnosis)
**Status:** **TRUNCATED.** Halted on a defined stop condition at move m2; the mock pass did not run.

---

## Headline finding (one paragraph)

**The live `anthropic` provider returned a non-functional outcome on every classification attempt this smoke test made, in two distinct failure modes:** move m1's two batches both came back as supabase-js `Edge Function returned a non-2xx status code` (HTTP-layer error, before the boundary even saw a packet), and move m2's two batches plus the post-flip probe all returned a 2xx response carrying `{ enabled: false, reason: "validation_failed" }` (Anthropic responded, but its packet failed `SemanticRefereePacketSchema` validation at the boundary). The mock pass was never reached because the prompt's "halt on `enabled: false` at any point" stop condition fired at m2. The `provider_mode = mock` flip therefore did not happen during this run; the flip-back step did execute and confirmed the **admin Edge Function path is fully functional** (the ADMIN-AI-001 write path wrote a fresh audit row with no errors). The smoke test successfully surfaced a real production calibration problem the cross-provider comparison was designed to detect — even though it could not measure that comparison.

---

## Setup verification

| Field | Value |
|---|---|
| Linked Supabase project | `qsciikhztvzzohssddrq` |
| `semantic-referee` function version | v28 (per `npx supabase functions list` 2026-05-22 21:58:24 UTC) |
| `admin-users` function version | v83 (same redeploy) |
| Initial `provider_mode` | `anthropic` |
| Initial `enabled` | `true` |
| Initial `anthropicKeyPresent` | `true` |
| Initial `updated_at` | `2026-05-22T19:22:14.095757+00:00` (ADMIN-AI-001's seed) |
| Final `provider_mode` | `anthropic` (restored) |
| Final `enabled` | `true` |
| Final `updated_at` | `2026-05-23T00:02:05.319+00:00` (this run's flip-back wrote an audit row) |
| Scenario file | `fixtures/argument-scenarios/smoke-test-mcp-remote-work-productivity.json` |

The setup was clean. The runtime config showed the expected post-ADMIN-AI-001 state. `anthropicKeyPresent: true` confirms `ANTHROPIC_API_KEY` is set as a Supabase secret on the function.

---

## Provider flip propagation timing

Only the **flip-back** (mock → anthropic) executed, because the run halted before the first flip would have run.

| Phase | Value (ms since epoch) | Note |
|---|---|---|
| `t1` — before flip | `1779494524188` | After the anthropic pass halted |
| `t2` — flip complete | `1779494525875` | Admin EF returned |
| `t3` — probe returned | `1779494528266` | First post-flip classify call returned |
| Flip Edge Function duration | **1687 ms** | `admin-users set_semantic_config` round trip |
| Propagation (t3 − t2) | **2391 ms** | Time from flip-complete to first post-flip referee response |
| Probe response | `{ enabled: false, reason: "validation_failed" }` | Same validation failure |
| Probe provider field | `null` (no packet) | Cannot confirm which provider handled it |

**Caveat:** because the probe returned `enabled: false`, it carries no `packet.provider` field, so the propagation measurement does not confirm "the next call after the flip ran under the new provider." It does confirm the **admin Edge Function write path itself works** — the flip request returned `{ providerMode: 'anthropic', enabled: true, updatedAt: '2026-05-23T00:02:05.319+00:00' }` and a follow-up `get_semantic_config` showed the new row. So **ADMIN-AI-001's write path is verified functional**; what the smoke test could *not* verify is whether the new provider mode propagates to the next `semantic-referee` invocation, because the boundary's validator rejected every response that would have carried the `provider` field.

The anthropic→mock pre-flip measurement is **not available** — that step did not execute.

---

## Per-move data

### m1 — Provocateur thesis (root claim with twenty-percent figure)

| Field | Value |
|---|---|
| Posted | ✓ (`0fed9251-b902-4cc2-8c59-4043a2061473`) |
| Post latency | 2489 ms |
| Body length (redacted) | 711 chars |
| Parent body length | 0 (root) |
| Classify total latency | 2443 ms |
| Predicted signal | `introduces_new_issue=1`, `responds_to_parent=0`, `provides_evidence=0` |
| Actual signal (anthropic) | **No packet — both batches returned `Edge Function returned a non-2xx status code`** |
| Actual signal (mock) | not run |
| Banner / override | n/a (no packet) |

Both classify batches failed at the HTTP layer. Latencies (924 ms, 1519 ms) suggest the Edge Function *was* reached and *did* attempt to call Anthropic; the non-2xx status would have been either a 4xx (request validation at the boundary refused something) or a 5xx (Anthropic API error propagated as 5xx). The supabase-js wrapper does not surface the specific status in its `error.message`; the function logs would carry the actual response shape and status code.

### m2 — Revocateur source request (challenges "at least twenty percent")

| Field | Value |
|---|---|
| Posted | ✓ (`60329022-a6dd-49b8-a246-1c925bf06ad0`) |
| Post latency | 2647 ms |
| Body length (redacted) | 491 chars |
| Parent body length | 711 chars (m1) |
| Classify total latency | 8760 ms |
| Predicted signal | `responds_to_parent=1`, `asks_for_evidence=1`, `creates_source_chain_gap=0` |
| Actual signal (anthropic) | **No packet — both batches returned `{ enabled: false, reason: "validation_failed" }`** |
| Actual signal (mock) | not run |
| Banner / override | n/a (no packet) |

Both classify batches succeeded at the HTTP layer (2xx) but the boundary's validator rejected Anthropic's response. The per-batch latencies (3459 ms, 5301 ms) are consistent with real Anthropic calls completing, meaning the model returned *something* — that something just didn't conform to `SemanticRefereePacketSchema`. The stop condition fired here.

### m3–m8

**Not posted.** The run halted at m2 per the prompt's "halt on `enabled: false` at any point" stop condition.

---

## Aggregate analysis

| Metric | Value |
|---|---|
| Total moves posted | 2 of 16 planned (m1, m2 — anthropic pass only) |
| Total `submit-argument` calls | 2 (both succeeded with `argument.id` returned) |
| Total `semantic-referee` calls | 5 (m1: 2 batches, m2: 2 batches, post-flip probe: 1) |
| `semantic-referee` calls that returned a usable packet | **0** |
| `semantic-referee` calls returning HTTP non-2xx | 2 (m1's batches) |
| `semantic-referee` calls returning `enabled: false, validation_failed` | 3 (m2's batches + the probe) |
| Per-provider prediction-match rate | not computable (no packets) |
| Banner emissions | 0 |
| Override-surface triggers | 0 |
| Anthropic API calls actually executed | ~5 (each `semantic-referee` invocation attempts one Anthropic call when provider=anthropic) |
| Estimated cost | < $0.05 (well under a dollar; ~5 Haiku-class calls) |
| `admin-users` calls | 3 (initial `get_semantic_config`, flip-back `set_semantic_config`, final `get_semantic_config`) — **all 3 succeeded** |
| Latency distribution (m1 batches) | 924, 1519 ms |
| Latency distribution (m2 batches) | 3459, 5301 ms |
| Probe latency | 2391 ms |
| Total elapsed (run start → log written) | 23716 ms |

---

## Doctrine compliance

- **No verdict / winner / loser / truth tokens leaked.** No successful packets were produced, so there were none to leak from. The disabled outcomes carry only the bounded `reason` token (`validation_failed`) — a validator code, not a verdict.
- **No `authoritative: true` field appeared.** No successful packets returned at all.
- **No `block` field appeared.** Same.
- **No client-side AI calls.** All AI happened server-side via the `semantic-referee` Edge Function (its internal Anthropic call). The orchestrator script makes no `fetch` to any AI provider from the orchestrator process.
- **No service-role key usage.** All Supabase calls used the publishable anon key plus the bot/admin JWTs returned by `auth.signInWithPassword`.
- **No direct insert into `public.arguments`.** All 2 posted moves went through `submit-argument`.
- **Direct insert into `debates`** for room creation — explicitly permitted by the verification scan (scan 5) since no `create-debate` Edge Function exists; the runner's established pattern.
- **No secrets in this report.** The log file (gitignored) carries packet fields but no API key, JWT, Authorization header, or email; the orchestrator's redactor would catch those if they appeared in any body.

---

## Findings

**Finding 1 — the live `anthropic` provider is non-functional for this scenario shape.** Five Anthropic-mediated classification calls were attempted; zero produced a usable packet. The two failure modes are distinct and meaningful: m1's HTTP non-2xx errors suggest the boundary refused the request OR Anthropic itself errored before producing a response, while m2's and the probe's `enabled: false, reason: validation_failed` outcomes mean Anthropic *did* respond but its output failed the boundary's `SemanticRefereePacketSchema` check. This is a calibration issue between the prompt the function ships and the schema the validator enforces. Because the failure rate is 100% — including a minimal 3-character probe body with one classifier — the issue is not specific to my move bodies; it is systemic to the deployed prompt/model/validator triple as it currently sits.

**Finding 2 — the smoke test's cross-provider comparison cannot be made from this run, but the smoke-test framework itself is sound.** The orchestrator wired the auth, posting, classify, flip, and probe flows correctly. The halting behavior fired exactly as the prompt's stop condition specified. The flip-back to anthropic restored the system to its starting state cleanly. The admin Edge Function `set_semantic_config` write path returned a successful response and updated the `semantic_referee_runtime_config` row with a fresh `updated_at` and the admin's display name — confirming ADMIN-AI-001's write path is functional in production. The infrastructure works; what failed is the live provider's response shape.

**Finding 3 — the architectural observation about paired classifiers was not exercised.** The scenario's m5+m6 anti-amplification exchange was meant to demonstrate the catalog's asymmetry (speaker-side `uses_popularity_as_evidence=1` paired with the challenger's `asks_for_evidence=1` + `requests_clarification=1`, but no paired challenger classifier). The run halted at m2 before either move 5 or 6 was posted, so this observation remains an architectural prediction the verification scans surfaced rather than empirical data this smoke test confirmed.

---

## Recommendations

1. **File a follow-up card to diagnose the `validation_failed` rate.** The investigation needs Supabase Edge Function logs (`mcp__plugin_supabase_supabase__get_logs` against the `semantic-referee` function, filtered to the m1/m2 timestamps) to see the actual response Anthropic returned and the specific rejection codes the validator produced. Likely root causes to check: (a) the model version pinned in the function may have shifted response shape since MCP-017 shipped; (b) the prompt may need a stricter "respond in this exact JSON shape" instruction; (c) the `SemanticRefereePacketSchema` may need to be slightly more permissive about fields the model genuinely cannot produce for every input. The fix may be a one-character prompt change or a schema relaxation; without the logs, it is guesswork.

2. **Re-run this smoke test once the validation issue is fixed.** The scenario JSON is preserved and the orchestrator script is committed; a re-run is a single `node scripts/bot-fixtures/runMcpSmokeTest.js` invocation. The prediction tables already use the real catalog vocabulary, so the analysis can proceed directly to comparison once packets actually return.

3. **File a separate card for the validator regex tightening in `scripts/skills/validateBotSkills.js`.** Scan 1 of the verification report identified that the validator's `^---\s*$/m` check conflates markdown horizontal rules with frontmatter delimiters. The fix is a one-line regex change; out of scope for the smoke test but worth a small QOL card.

4. **Consider whether the smoke test should distinguish the two failure modes** (HTTP non-2xx vs `enabled: false, validation_failed`) in its own logic. They are different failure modes with different root causes; the current orchestrator script treats both as "halt and surface" which is correct, but the per-move-comparison output would be more useful if each had a separate status field. Minor improvement to the orchestrator; the existing JSON log already distinguishes them, so the report can read either pattern without re-running.

5. **Modularity refactor slate context.** The smoke test was intended to inform the upcoming modularity refactor (classifier catalog inventory, prompt template inventory, source-of-truth extraction). The data it produced is thin, but the architectural finding it surfaced is still useful: **the live anthropic provider's output is the boundary's responsibility to validate, and the validator's strictness is what makes the smoke test halt safely.** That contract held; the contract's empirical calibration against current model output is what needs work. The modularity refactor can treat the prompt + schema + validator as one coherent unit that needs versioning and end-to-end testing rather than as three loosely coupled pieces.

---

## What the orchestrator script did *right*

The orchestrator script (`scripts/bot-fixtures/runMcpSmokeTest.js`) implemented the full hook-mimic correctly: client-side `redactBody`, `planClassifierBatches` over `POST_SUBMIT_CLASSIFIER_SET`, per-batch invocation, `mergePacketBinaries`. It restored the runtime provider to anthropic at run-end. It captured all latencies, request/response shapes (minus the response bodies for non-2xx), and the full flip timing measurement. The log at `logs/mcp-smoke-test/51fc7750.json` is the canonical artifact for any future diagnosis. The script is committed (`daf3dad`) and can be re-invoked after the validation_failed root cause is addressed.

The orchestrator did NOT mimic the hook's `evaluateTrigger` gate (which would have refused Bot A's moves entirely because `participantSide=moderator` fails the gate). Bypassing that gate is correct for the smoke test — we *want* every move classified for the comparison — and documented inline in the script's comments.
