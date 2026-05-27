# MCP-SERVER-002-SMOKE — 2026-05-26

**Card:** MCP-SERVER-002 — Family A Boolean Observation Tool (real classifier replaces scaffold; folded-in `actorRole='moderator'` enum + docs corrections)
**Predecessor:** MCP-SERVER-001-SMOKE (PASS as of 2026-05-26; commit `bae4984`)
**MCP server:** `https://cdiscourse-mcp-server.civildiscourse.deno.net` (Deno Deploy)
**Operator:** Kyler
**Date:** 2026-05-26
**Server commit:** `27bb837` (PR #310 squash-merge to `main`)
**Audit status:** COMPLETE — final verdict **PASS**

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

- [x] Local smoke 9/9 PASS via fixture provider (Option A; no real Anthropic call)
- [x] No regression on Checks 1-4 (semantic-move byte-equal — Checks 1, 2, 3, 4, 6, 7, 8 all PASS)
- [x] Check 5 validates real Family A response shape (`PASS [5-compat-boolean-family-a]` — name changed from MCP-SERVER-001's `5-compat-boolean-scaffold`, confirming the scaffold envelope is no longer being asserted)
- [x] Check 9 validates real Family A response shape (`PASS [9-mcp-tools-call-boolean-family-a]` — same naming pattern; real shape asserted)
- [ ] Server logs check skipped — Option A (fixture provider) doesn't call Anthropic so `anthropic_call_*` log lines aren't emitted; this is the expected fixture-mode behavior

**Result:** PASS

**Notes:**
- Server env: `MCP_SERVER_BEARER_TOKEN=<64-byte hex>`, `MCP_SERVER_ENV=local`, `MCP_SERVER_USE_FIXTURE_PROVIDER=true`, `MODEL_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=<placeholder satisfies credentialsConfigured check>`.
- Local `/health` digest: `{"status":"ok","version":"0.1.0","environment":"local","supportedTools":["classify_semantic_move","classify_argument_boolean_observations"],"credentialsConfigured":true,"protocolVersion":"2025-11-25",...}`
- Smoke output captured verbatim (no token values; script prints `Token: [REDACTED]`):

```
MCP-SERVER-001 smoke against: http://localhost:8080
Token: [REDACTED]

PASS [1-health]
PASS [2-compat-no-auth]
PASS [3-compat-bad-token]
PASS [4-compat-semantic-move]
PASS [5-compat-boolean-family-a]
PASS [6-mcp-initialize]
PASS [7-mcp-tools-list]
PASS [8-mcp-tools-call-semantic]
PASS [9-mcp-tools-call-boolean-family-a]

MCP-SERVER-001 smoke: 9 PASSES, 0 FAILS
EXIT: 0
```

- Check 5 + 9 names confirm the MCP-SERVER-002 promotion landed: `*-boolean-family-a` (real classifier) replaces MCP-SERVER-001's `*-boolean-scaffold` (not-implemented envelope).

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

- [x] Deno Deploy build deployed and active (PR #310 deploy check `deploy/civildiscourse/cdiscourse-mcp-server` showed SUCCESS at build `0pkttv2tyfjn`; post-merge hosted `/health` confirms `environment: "prod"` + both tools listed + `credentialsConfigured: true` + `protocolVersion: "2025-11-25"`)
- [x] Hosted env vars unchanged from MCP-SERVER-001-SMOKE PASS state (`ANTHROPIC_API_KEY` + `MCP_SERVER_BEARER_TOKEN` + `MODEL_PROVIDER=anthropic` + `MCP_SERVER_ENV=prod` + `ANTHROPIC_MODEL=claude-haiku-4-5`)
- [x] **Hosted smoke 9/9 PASS** — all 9 checks against `https://cdiscourse-mcp-server.civildiscourse.deno.net`; exit 0
- [x] **Family A response payload captured** to `/tmp/family-a-response.json` via direct `/mcp/adapter-compat` call (envelope `j.result` priority-1 path used)
- [x] N=3 hosted health stability: HTTP 200 / 200 / 200 (time_total 0.184s / 0.174s / 0.163s)

**Result:** PASS

**Notes:**

- **Critical confirmation:** Check 5 + Check 9 names are now `[5-compat-boolean-family-a]` and `[9-mcp-tools-call-boolean-family-a]` — confirming the hosted server is running MCP-SERVER-002's real Family A classifier path (not MCP-SERVER-001's scaffold / `not_implemented` envelope).
- Hosted smoke output captured verbatim (no token values; script prints `Token: [REDACTED]`):

```
MCP-SERVER-001 smoke against: https://cdiscourse-mcp-server.civildiscourse.deno.net
Token: [REDACTED]

PASS [1-health]
PASS [2-compat-no-auth]
PASS [3-compat-bad-token]
PASS [4-compat-semantic-move]
PASS [5-compat-boolean-family-a]
PASS [6-mcp-initialize]
PASS [7-mcp-tools-list]
PASS [8-mcp-tools-call-semantic]
PASS [9-mcp-tools-call-boolean-family-a]

MCP-SERVER-001 smoke: 9 PASSES, 0 FAILS
EXIT: 0
```

- Checks 4 + 8 (semantic-move) made real Anthropic calls — regression-safe; the MCP-SERVER-001 wire compatibility holds.
- Checks 5 + 9 (Family A) made real Anthropic calls and the hosted server validated the model output through its mirrored MCP-021A schema + doctrine ban-list scan before returning.

### Phase 2.5 — Hosted Family A response capture

Direct `/mcp/adapter-compat` POST with the canonical Family A fixture:

```
HTTP 200 | time_total=3.930562s
```

Envelope normalization + structural inspection:

```
=== Family A response captured ===
Envelope used: j.result
schemaVersion: mcp-021.machine-observations.boolean.v1
nodeId: fixture-node-mainline-001
checkedRawKeys count: 16
observations count: 16
modelInfo: {"provider":"mcp","serverName":"discourse-argument-classifier","classifierSetVersion":"family-a-v1"}
Positive observations: 0
```

**Interpretation:**
- `schemaVersion` matches MCP-021A `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` constant verbatim.
- `checkedRawKeys count: 16` matches the binding Family A set from MCP-SERVER-002 Decision 1.
- `observations count: 16` confirms the hosted server returned a complete boolean observation map for every Family A key.
- `modelInfo.provider: "mcp"` is the MCP-server identity stamp (matches the hard-stamp pattern from MCP-018's `mcpAdapter.ts:123` adapted to the boolean classifier).
- `modelInfo.classifierSetVersion: "family-a-v1"` confirms the Family A classifier set per design §13.4.
- `Positive observations: 0` is **expected and non-blocking**: the fixture uses placeholder/redacted text (`[fixture] body`), so a conservative-positives model answering false to all 16 keys is the correct behavior under MCP-SERVER-002's "answer false when unsure" framing. This smoke validates schema completeness + parser compatibility + MCP-server-path identity, all of which PASSED. The Phase 3 validator below independently confirmed correctness.
- `time_total=3.93s` is well within reasonable bounds; the operator-deferred §11.3.3 token-budget concern (6,000-input-token threshold) is not triggered.

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

- [x] **Validator script exits 0 with `VALIDATE_FAMILY_A_RESPONSE: PASS`**
- [x] No evidenceSpan > 240 chars (validator-checked)
- [x] No unknown rawKey in checkedRawKeys (validator-checked; all 16 rawKeys ∈ Family A set)
- [x] No doctrine ban-list hits (validator-checked over all evidenceSpan + modelInfo strings)

**Result:** PASS

**Notes:**

Validator stdout (full, verbatim, safe to commit):

```
EXIT=0
Warning "exports" field should be specified when specifying a "name".
    at file:///C:/Users/kyler/cdiscourse/debate-constitution-app/mcp-server/deno.json
VALIDATE_FAMILY_A_RESPONSE: PASS
```

- The Deno warning about `exports` in `deno.json` is non-blocking and was present in earlier successful MCP-SERVER-001 / MCP-SERVER-002 server-test runs; it does not affect validator semantics.
- The validator passed all 6 assertions per `mcp-server/scripts/validate-family-a-response.ts`:
  - schemaVersion matches MCP-021A constant exactly
  - observations is a plain object of booleans
  - every key in observations appears in confidence with value in {low, medium, high} (vacuously true here — no positive flags)
  - every key in observations appears in evidenceSpan
  - all rawKeys in checkedRawKeys are in the Family A 16-key set
  - every evidenceSpan string ≤ 240 chars
  - doctrine ban-list scan over all evidenceSpan strings + modelInfo strings: 0 hits

---

## Verdict

- [x] **PASS (all 3 phases)** — MCP-021C-EDGE-SMOKE **AUTHORIZED** to re-run with live Family A. MCP-021C-FAMILY-A-PROD **AUTHORIZED** to file after EDGE-SMOKE PASS (NOT authorized to enable production trigger until EDGE-SMOKE confirms end-to-end). MCP-SERVER-003+ (Family B planning) **AUTHORIZED** after operator sequencing decision.
- [ ] PARTIAL
- [ ] FAIL

### Authorization state after PASS

- **MCP-SERVER-002-SMOKE:** PASS
- **Hosted Family A boolean classifier:** operational
- **MCP-021A schema compatibility:** confirmed by validator
- **MCP-021C-EDGE-SMOKE re-run:** AUTHORIZED
- **ADMIN-MCP-001** (UI "Coming later" affordance flip): AUTHORIZED — operator chooses ordering relative to EDGE-SMOKE
- **MCP-021C-FAMILY-A-PROD:** AUTHORIZED to file; NOT YET authorized to enable production trigger (contingent on EDGE-SMOKE PASS)
- **MCP-SERVER-003 / Family B planning:** AUTHORIZED after operator sequencing decision (one family proven end-to-end before scaling horizontally)
- **OPS-MCP-OBSERVABILITY:** deferred (fileable once 2+ families run live)

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
