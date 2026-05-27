# MCP-SERVER-002-SMOKE — Audit template

**Card:** MCP-SERVER-002 — Family A Boolean Observation Tool (real classifier replaces scaffold; folded-in `actorRole='moderator'` enum + docs corrections)
**Predecessor:** MCP-SERVER-001-SMOKE (PASS as of 2026-05-26; commit `bae4984`)
**MCP server:** `https://cdiscourse-mcp-server.civildiscourse.deno.net` (Deno Deploy)
**Operator runs this template post-merge.** Claude does NOT deploy.

---

## What this smoke verifies

The classify_argument_boolean_observations tool was promoted from the
scaffolded `not_implemented` envelope to the real Family A classifier.
This template verifies the real classifier works end-to-end (local +
hosted + parser validation) without regressing the existing
`classify_semantic_move` tool.

The MCP-SERVER-002 smoke is shorter than MCP-SERVER-001's (3 phases vs 5)
because Supabase wiring is already validated in MCP-SERVER-001-SMOKE; this
template focuses on tool-implementation correctness.

---

## Phase 1 — Local smoke (both tools)

Run the MCP server locally with the fixture provider OR a real Anthropic key:

```bash
# Option A: fixture provider (offline; no Anthropic key required)
cd mcp-server
export MCP_SERVER_BEARER_TOKEN=local-smoke-test-token-abcdefghijklmnop1234567890abcdef
export MODEL_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-placeholder-for-local-fixture-smoke-do-not-use
export MCP_SERVER_ENV=local
export MCP_SERVER_USE_FIXTURE_PROVIDER=true
deno task start

# Option B: real Anthropic key (verifies live model call)
cd mcp-server
export MCP_SERVER_BEARER_TOKEN=<some-secure-token>
export MODEL_PROVIDER=anthropic
export ANTHROPIC_API_KEY=<real-anthropic-key>
export MCP_SERVER_ENV=local
deno task start
```

Then run the smoke script in a second terminal:

```bash
bash scripts/mcp-server-001-smoke.sh --base-url http://localhost:8080 --token <token>
```

Verify checks 1-9 all PASS, exit 0. Checks 5 + 9 now validate the REAL
Family A response shape (schemaVersion + observations + confidence +
modelInfo + classifierSetVersion='family-a-v1'), NOT the
not_implemented envelope.

- [ ] Local smoke 9/9 PASS via fixture provider (or via real Anthropic key)
- [ ] No regression on Checks 1-4 (semantic-move byte-equal)
- [ ] Check 5 validates real Family A response shape
- [ ] Check 9 validates real Family A response shape
- [ ] Server logs contain `anthropic_call_start` + `anthropic_call_success`
      tagged with `tool: 'classify_argument_boolean_observations'` (Option B
      only — fixture path skips Anthropic)

**Result:** PASS / FAIL
**Notes:**

---

## Phase 2 — Hosted deploy + hosted smoke

Deno Deploy auto-deploys on push to main (per MCP-SERVER-001 operator setup).
After the merge:

1. Wait for the Deno Deploy git integration to deploy the new build.
2. Verify hosted env vars unchanged (`ANTHROPIC_API_KEY` +
   `MCP_SERVER_BEARER_TOKEN` + `MODEL_PROVIDER=anthropic` +
   `MCP_SERVER_ENV=prod` + `ANTHROPIC_MODEL=claude-haiku-4-5`).
3. Run smoke against the hosted URL:

```bash
bash scripts/mcp-server-001-smoke.sh \
  --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net \
  --token <hosted-token>
```

Expected: 9/9 PASS. Checks 4 + 8 call real Anthropic for semantic-move
(regression). Checks 5 + 9 call real Anthropic for Family A.

**Capture the Family A response payload from Check 9 to `/tmp/family-a-response.json`
for Phase 3:**

```bash
curl --silent --show-error \
  -H "Authorization: Bearer <hosted-token>" \
  -H "Content-Type: application/json" \
  -X POST \
  --data '{"jsonrpc":"2.0","id":"smoke-capture-1","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-001","parentNodeId":null,"currentText":"[fixture] body","parentText":null,"threadContextExcerpt":"[fixture] thread","requestedFamilies":["parent_relation"],"requestedRawKeys":["supports_parent","challenges_parent","refines_parent"],"definitions":{},"timeoutMs":12000}}}' \
  https://cdiscourse-mcp-server.civildiscourse.deno.net/mcp \
  > /tmp/family-a-response.json
```

- [ ] Deno Deploy build deployed and active
- [ ] Hosted env vars unchanged
- [ ] Hosted smoke 9/9 PASS
- [ ] Family A response payload captured to `/tmp/family-a-response.json`

**Result:** PASS / FAIL
**Notes:**

---

## Phase 3 — MCP-021A parser validation

Run the validator script against the captured payload:

```bash
deno run --allow-read mcp-server/scripts/validate-family-a-response.ts /tmp/family-a-response.json
```

Expected output: `VALIDATE_FAMILY_A_RESPONSE: PASS`. Exit 0.

The validator asserts:
- schemaVersion equals `'mcp-021.machine-observations.boolean.v1'`
- observations is a plain object of booleans
- every key in observations appears in confidence with value in `{low, medium, high}`
- every key in observations appears in evidenceSpan (string or null)
- all rawKeys in checkedRawKeys are in the Family A 16-key set
- every evidenceSpan string ≤ 240 chars
- doctrine ban-list scan over all evidenceSpan strings + modelInfo strings: 0 hits

- [ ] Validator script exits 0 with `VALIDATE_FAMILY_A_RESPONSE: PASS`
- [ ] No evidenceSpan > 240 chars
- [ ] No unknown rawKey in checkedRawKeys
- [ ] No doctrine ban-list hits

**Result:** PASS / FAIL
**Notes:**

---

## Verdict

- [ ] **PASS (all 3 phases)** — MCP-021C-EDGE-SMOKE AUTHORIZED to re-run with live
      Family A. MCP-021C-FAMILY-A-PROD AUTHORIZED to file (auto-trigger on
      argument post). MCP-SERVER-003+ (Family B prep) AUTHORIZED.
- [ ] **PARTIAL** — Phase 1+2 PASS but Phase 3 finds a validation issue, OR
      Phase 1 PASS but Phase 2 fails on a single deploy-config issue: scope a
      fix card; do NOT authorize MCP-021C-EDGE-SMOKE re-run.
- [ ] **FAIL** — Phase 1 fails OR Phase 2 fails on a fundamental Anthropic /
      parser / model issue: file MCP-SERVER-002-FIX.

---

## Common failure_reason interpretations

| Symptom | Likely cause | Fix |
|---|---|---|
| Check 5 or 9 returns `validation_failed` | Anthropic returned a Family A packet the server rejected | Check Deno Deploy logs; the response likely tripped the schema-shape mirror or the doctrine ban-list scan |
| Check 5 or 9 returns `unsupported_family` | Smoke request body uses a non-`parent_relation` family | Confirm the request body in the smoke script uses `requestedFamilies: ["parent_relation"]` |
| Check 5 or 9 returns `unsupported_rawKey` | Smoke request body uses a rawKey outside Family A's 16 | Confirm the rawKey list (designer-bound; see `mcp-server/lib/familyAKeys.ts`) |
| Check 5 or 9 returns `key_missing` | Anthropic key blank on Deno Deploy AND fixture flag not set | Set `MCP_SERVER_USE_FIXTURE_PROVIDER=true` for offline smoke, OR set `ANTHROPIC_API_KEY` |
| Validator fails on `evidenceSpan` > 240 | Anthropic returned an oversized evidence span | Operator-deferred decision §11.3: switch model to `claude-sonnet-4-5` OR tighten the prompt's evidenceSpan length cap (out of scope for this card) |
| Validator fails on unknown rawKey | Anthropic invented a rawKey outside Family A | Likely a model hallucination; the server's validator catches this, but the Phase 3 validator catches a regression case where validator didn't catch it |
| Validator finds doctrine ban-list hit | Anthropic returned a verdict-like evidenceSpan | The server's ban-list scan should have caught it; if this Phase 3 finds one, the server's ban-list patterns need a new entry — file MCP-SERVER-002-FIX |
| Hosted smoke returns 502/503 on Check 4 or 5 | Deno Deploy build broken | Check Deno Deploy build logs; redeploy if needed |
| Hosted smoke returns 401 | Hosted bearer token changed | Re-fetch from Deno Deploy env vars |
| Family A response token usage > 6000 input tokens | Prompt size larger than design's budget estimate | Operator-deferred decision §11.3.4: file follow-up before MCP-SERVER-003 (Family B). Out of scope for MCP-SERVER-002. |

---

## Operator-deferred decisions to record

Per design §11.3, the following are surfaced post-smoke for explicit operator review:

1. **Model recommendation**: stay with `claude-haiku-4-5` OR switch to
   `claude-sonnet-4-5` for nuanced relational keys
   (has_counter_rebuttal / quote_anchors_parent / distinguishes_parent /
   reframes_parent). Stay with haiku for v1; if smoke output shows
   systematic under-detection, operator flips `ANTHROPIC_MODEL` env on Deno
   Deploy without a code change.
2. **auto_metadata + lifecycle keys (has_rebuttal, has_counter_rebuttal,
   rebutted)**: should the Edge Function compute these deterministically and
   skip the model, OR should the model attempt to infer them from move
   text? Deferred to MCP-021C-FAMILY-A-PROD design phase.
3. **Token budget**: if first hosted Family A response exceeds 6,000 input
   tokens (Anthropic `usage.input_tokens`), file a follow-up before
   MCP-SERVER-003 to implement the abbreviation strategy (design §2.2).
4. **`actorRole='moderator'` inputSchema enum reconciliation**:
   `mcp-server/tools/classifySemanticMove.ts` inputSchema enum still lists
   only the original 4 actorRoles (per MCP-SERVER-002 read-only boundary).
   Validator accepts moderator, but the documented JSON schema does not.
   Decide whether to file a follow-up to reconcile.
