# MCP-SERVER-001 — Operator-hosted MCP Server Foundation and Contract Compatibility

**Status:** Design draft (designer phase)
**Card:** MCP-SERVER-001
**Track:** MCP-SERVER-* (new track; distinct from MCP-021)
**Priority:** P0 / Urgent
**Effort:** M-L
**Branch:** `feat/MCP-SERVER-001-operator-hosted-mcp-server-foundation`
**Issue:** (filed by operator; not yet numbered)
**Intent brief:** `docs/designs/MCP-SERVER-001-intent.md` (operator-authored at `b6ec691`)
**Predecessor evidence:** MCP-018 adapter shipped without server; MCP-021C-EDGE infrastructure shipped without live MCP path; current Supabase secrets confirm `SEMANTIC_REFEREE_MCP_URL` + `SEMANTIC_REFEREE_MCP_TOKEN` are ABSENT

---

## §1 — Scope-reality audit (Phase A.1, A.2, A.3 consolidated)

### 1.1 Phase A.1 — MCP-018 adapter wire contract (BINDING; verbatim extraction)

Direct read of `supabase/functions/_shared/semanticReferee/mcpAdapter.ts` (lines 146-228) + `mcpAdapterCore.ts` (lines 38-138) at branch base commit.

**Tool name (verbatim):**
```
classify_semantic_move
```
Source: `mcpAdapterCore.ts` line 38: `export const MCP_CLASSIFY_TOOL_NAME = 'classify_semantic_move';`

**Request envelope shape (SIMPLIFIED, NOT JSON-RPC `tools/call`):**
```json
{
  "tool": "classify_semantic_move",
  "input": {
    "moveBodyRedacted": "<string>",
    "parentBodyRedacted": "<string|undefined>",
    "roomContext": {
      "debateMode": "<string|undefined>",
      "selectedAction": "<string|undefined>",
      "selectedMoveType": "<string|undefined>",
      "side": "<affirmative|negative|observer|moderator|undefined>",
      "actorRole": "<initiator|primary_opponent|chime_in|observer|undefined>"
    },
    "requestedClassifiers": ["<SemanticClassifierId>", ...],
    "contentHash": "<string>",
    "roomId": "<string>",
    "moveId": "<string|undefined>",
    "parentId": "<string|undefined>",
    "promptVersionHint": "<string|undefined>"
  }
}
```
Source: `mcpAdapterCore.ts` lines 111-137 (`buildMcpToolRequestBody`).

**This is NOT a JSON-RPC `tools/call` envelope.** Three structural confirmations:
- No top-level `jsonrpc: "2.0"` field
- No top-level `id` field
- No `method: "tools/call"` field; the `tool` name sits at the outer envelope, not under `params.name`

This finding is the binding input to Phase A.8 (lifecycle decision).

**HTTP request:**
- Method: `POST`
- URL: `Deno.env.get('SEMANTIC_REFEREE_MCP_URL')` (https-only; non-https → `url_missing`)
- Headers: `Content-Type: application/json`, `Authorization: Bearer <SEMANTIC_REFEREE_MCP_TOKEN>`
- Body: `JSON.stringify(requestBody)`
- Timeout: `AbortSignal.timeout(MCP_REQUEST_TIMEOUT_MS)` where `MCP_REQUEST_TIMEOUT_MS = 15_000` ms (`mcpAdapterCore.ts:48`)

**Response shapes accepted (in priority order, `extractMcpPacket` lines 184-222):**
1. `{ result: {...} }` — direct packet object under `result`
2. `{ output: {...} }` — direct packet object under `output`
3. `{ content: [...] }` — array of typed blocks; first `{type: 'json', json: {...}}` block wins, otherwise first `{type: 'text', text: '...JSON...'}` block parsed via `parseJsonFromContent`

**Inner packet shape (the MCP server's contractual return):**
```typescript
{
  binaries: Array<{
    classifierId: SemanticClassifierId,    // one of 35 ids (catalog v1)
    value: 0 | 1,
    confidence: 'low' | 'medium' | 'high',
    reasonCode: string,                     // snake_case, <=280 chars
    evidenceSpan?: string,                  // <=280 chars
    parentSpan?: string                     // <=280 chars
  }>,
  routeSuggestion: SemanticRouteSuggestion,    // 7 values
  frictionSuggestion: SemanticFrictionSuggestion, // 8 values
  scoreHints: {
    continuityCredit: number,         // 0..3 int
    evidencePressure: number,         // 0..3 int
    branchHygiene: number,            // 0..3 int
    synthesisReadiness: number,       // 0..3 int
    sourceChainDebt: number,          // 0..3 int
    unresolvedRedirectRisk: number    // 0..3 int
  },
  modelVersion?: string  // optional; boundary stamps a default when absent
}
```

The MCP server returns ONLY the structural fields. Identity fields (`packetVersion`, `promptVersion`, `provider`, `authoritative`, `inputHash`, `contentHash`, `roomId`, `moveId`, `parentId`, `selectedAction`, `selectedMoveType`, `debateMode`) are stamped by the adapter (`stampPacketIdentity`, `mcpAdapter.ts:102-138`). `provider` is hard-set to `'mcp'`; `authoritative` is hard-pinned `false`.

**Adapter failure modes (`mcpAdapter.ts` + `mcpAdapterCore.ts`):**
| Trigger | `McpUnavailableReason` |
|---|---|
| URL absent / empty / non-https | `url_missing` |
| Token absent / empty | `token_missing` |
| `fetch` throws (DNS/TLS/reset/timeout) | `network_error` |
| HTTP 429 | `rate_limited` |
| Any other non-OK HTTP | `api_error` |
| Non-JSON body / unrecognised envelope | `parse_failure` |
| `SemanticRefereePacketSchema` rejects | `validation_failed` |
| `scanPacketContent` rejects | `validation_failed` |

**Env var names (verbatim):**
- `SEMANTIC_REFEREE_MCP_URL` (read at `mcpAdapter.ts:152`; the ONLY file reading it)
- `SEMANTIC_REFEREE_MCP_TOKEN` (read at `mcpAdapter.ts:159`; the ONLY file reading it)

**Request-body builder function name (verbatim):** `buildMcpToolRequestBody` (`mcpAdapterCore.ts:111`).

### 1.2 Phase A.2 — MCP-021C-EDGE adapter wrapper tool name (verbatim)

Direct read of `supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapterCore.ts` line 44-45:

```typescript
export const MCP_BOOLEAN_OBSERVATION_TOOL_NAME =
  'classify_argument_boolean_observations';
```

**Tool name (verbatim):** `classify_argument_boolean_observations`. Sole tool-name reference; pinned in the ledger.

**Request envelope shape (mirrors MCP-018's simplified shape):**
```json
{
  "tool": "classify_argument_boolean_observations",
  "input": {
    "schemaVersion": "mcp-021.machine-observations.boolean.v1",
    "nodeId": "<string>",
    "parentNodeId": "<string|null>",
    "currentText": "<sanitized string>",
    "parentText": "<sanitized string|null>",
    "threadContextExcerpt": "<sanitized string>",
    "requestedFamilies": ["<MachineObservationFamily>", ...],
    "requestedRawKeys": ["<rawKey>", ...],
    "definitions": { "<rawKey>": <MachineObservationDefinition>, ... },
    "timeoutMs": 12000
  }
}
```
Source: `booleanObservationMcpAdapterCore.ts:118-137` (`buildBooleanObservationToolRequestBody`).

**Inner response shape (`McpBooleanObservationResponse` from `src/features/nodeLabels/mcpBooleanObservationSchema.ts:98-129`):**
```typescript
{
  schemaVersion: 'mcp-021.machine-observations.boolean.v1',
  nodeId: string,
  checkedRawKeys: string[],
  observations: Record<string, boolean>,       // per-rawKey result
  confidence: Record<string, 'low'|'medium'|'high'>,  // REQUIRED
  evidenceSpan: Record<string, string | null>, // per-rawKey, <=240 chars
  modelInfo: {
    provider: 'mcp',                            // hard-pinned at parser
    serverName: string,
    classifierSetVersion: string
  }
}
```

**Same response-extraction shapes (1/2/3):** identical to MCP-018 (`extractBooleanObservationResponse` lines 176-216 mirrors `extractMcpPacket`).

**Env var names (shared with MCP-018):** `SEMANTIC_REFEREE_MCP_URL` + `SEMANTIC_REFEREE_MCP_TOKEN`. The MCP-021C-EDGE adapter wrapper reads the same two secrets — one MCP server, two tools.

### 1.3 Phase A.3 — MCP Streamable HTTP spec compliance

Per the official MCP specification at `modelcontextprotocol.io` (Streamable HTTP transport, current revision `2025-06-18` / `2025-11-25` as of authoring):

**Endpoint:** single MCP endpoint path (convention `/mcp`). Server MUST:
- Accept POST with JSON-RPC 2.0 envelopes
- Accept GET for SSE stream (server-initiated messages); v1 of this server returns `405 Method Not Allowed` with documented rationale (no server-initiated push needed for stateless `tools/call`)
- Accept `Accept: application/json, text/event-stream` (we return `application/json` for v1)
- Validate `Origin` header when present (mitigates DNS rebinding); reject invalid origins with HTTP 403
- Handle `MCP-Protocol-Version` header (echo current targeted version on response)

**JSON-RPC 2.0 envelope (official MCP `tools/call`):**
```json
{
  "jsonrpc": "2.0",
  "id": "<request id>",
  "method": "tools/call",
  "params": {
    "name": "classify_semantic_move",
    "arguments": { /* per the tool's inputSchema */ }
  }
}
```

**Other required methods:**
- `initialize` / `notifications/initialized` — capability handshake
- `tools/list` — returns array of tool definitions (name, title, description, inputSchema, outputSchema)
- `tools/call` — invokes a named tool

**Spec version targeted:** `2025-11-25` (latest stable as of authoring). Echo this value in the `MCP-Protocol-Version` response header. If client sends an older version, downgrade response shape accordingly (v1 only supports `2025-11-25`; older clients fall back to the adapter-compatibility endpoint per §5).

**GET /mcp rationale (v1 returns 405):** the two tools are stateless request/response. No long-running task notifications, no server-initiated prompts, no streaming progress. SSE adds operational complexity (connection bookkeeping, heartbeats, reconnect tokens) with zero v1 benefit. Future server-initiated push requires a separate card.

---

## §2 — Hosting choice (Phase A.4)

### 2.1 Hosting platform comparison

| Platform | HTTPS | Bearer auth (<10 lines) | Cold-start budget | Cost (free tier) | Deno/TS native | Operator familiarity |
|---|---|---|---|---|---|---|
| **Deno Deploy** | Default | Yes | <500ms typical | Generous free tier | Native | High (Supabase Edge Functions are Deno) |
| Cloudflare Worker | Default | Yes | <50ms typical | 100k req/day free | TS via Wrangler | Medium |
| Railway | TLS-terminated | Yes | 2-5s on free tier | Limited free tier | Native | Low |
| Fly.io | TLS-terminated | Yes | 5-30s on free tier | Limited free | Native | Low |

**Decision: Deno Deploy.** Rationale:
1. **Lowest conceptual drift** — same Deno runtime as Supabase Edge Functions. The MCP-018 adapter is Deno code; the MCP server can directly re-use the same idioms (`Deno.env.get`, `fetch`, `npm:zod@4`, AbortSignal.timeout).
2. **Cold-start budget** — sub-2s p99 acceptable for admin-trigger workflow; Deno Deploy isolates run cold-start in the 100-500ms range.
3. **Bearer auth** — trivial in 5 lines of middleware (`req.headers.get('Authorization')` + constant-time compare).
4. **Cost** — generous free tier covers MCP-SERVER-001 smoke and early MCP-SERVER-002 traffic.
5. **HTTPS by default** — `*.deno.dev` subdomain ships TLS; no operator-side cert work.

**Decision criteria scorecard (all 5 met):**
- (1) Server-side credential storage: Deno Deploy env vars / dashboard secrets ✓
- (2) HTTPS by default: `*.deno.dev` ✓
- (3) Bearer auth in <10 lines: ✓
- (4) Cold-start <2s: ✓ (typical 100-500ms)
- (5) Cost (free tier sufficient for MCP-SERVER-001-SMOKE): ✓

**Operator deploy command:** `deno deploy --project=<project-name> --prod main.ts` (or via Deno Deploy GitHub integration — operator decides post-merge).

**Logs access:** Deno Deploy dashboard → project → Logs tab; structured JSON logs filterable by request ID, tool name, status.

**Env var setup pattern:** Deno Deploy dashboard → Settings → Environment Variables. Set:
- `MCP_SERVER_BEARER_TOKEN` (the bearer all `/mcp` requests must present)
- `ANTHROPIC_API_KEY` (the model-provider credential)
- `MODEL_PROVIDER=anthropic`
- `MCP_SERVER_ENV=prod` (or `dev`/`staging` per environment)

---

## §3 — Server location (Phase A.5)

### 3.1 Decision: co-located under `mcp-server/`

**Rationale:**
- Ships fastest (no separate-repo overhead for MCP-SERVER-001 + MCP-SERVER-002)
- Single PR carries server + runbook + smoke + fixtures + presence tests
- Operator workflow (card lifecycle, gates, reviews) stays in this repo
- Extraction to separate repo deferred until a second consumer beyond CDiscourse appears (intent brief §"Decision 1" default lean)

### 3.2 Directory structure

```
mcp-server/
├── README.md                              # how to run locally
├── deno.json                              # Deno tasks + import map
├── main.ts                                # entrypoint: HTTP server bootstrap
├── src/
│   ├── server.ts                          # HTTP server + routing
│   ├── transport/
│   │   ├── jsonRpc.ts                     # JSON-RPC 2.0 envelope helpers
│   │   ├── streamableHttp.ts              # /mcp endpoint handler (official mode)
│   │   └── adapterCompat.ts               # /mcp/adapter-compat endpoint handler
│   ├── auth/
│   │   ├── bearer.ts                      # bearer-token validation middleware
│   │   └── origin.ts                      # Origin header validation
│   ├── lifecycle/
│   │   ├── initialize.ts                  # initialize + notifications/initialized
│   │   └── protocolVersion.ts             # MCP-Protocol-Version handling
│   ├── tools/
│   │   ├── registry.ts                    # tool registration + tools/list
│   │   ├── classifySemanticMove/
│   │   │   ├── tool.ts                    # tool definition (name, schemas)
│   │   │   ├── handler.ts                 # invocation handler
│   │   │   ├── prompt.ts                  # COPY of seedPrompt.ts canonical text
│   │   │   ├── systemPrompt.ts            # COPY of SEMANTIC_REFEREE_SYSTEM_PROMPT
│   │   │   ├── inputSchema.ts             # JSON schema for input
│   │   │   ├── outputSchema.ts            # JSON schema for SemanticRefereePacket structural subset
│   │   │   └── validation.ts              # response validation against output schema
│   │   └── classifyArgumentBooleanObservations/
│   │       ├── tool.ts                    # scaffolded definition
│   │       ├── handler.ts                 # returns documented "not_implemented" envelope
│   │       ├── inputSchema.ts             # JSON schema (MCP-021A wire shape)
│   │       └── outputSchema.ts            # JSON schema (MCP-021A response shape)
│   ├── providers/
│   │   ├── types.ts                       # ProviderClient interface
│   │   └── anthropicProvider.ts           # Anthropic Messages API client
│   ├── obs/
│   │   ├── logger.ts                      # structured logger (no PII, no secrets)
│   │   └── requestId.ts                   # request correlation ID
│   └── health.ts                          # GET /health handler
├── fixtures/
│   ├── classify-semantic-move.request.json
│   ├── classify-semantic-move.response.json
│   ├── classify-semantic-move.malformed-response.json
│   ├── classify-argument-boolean-observations.request.json
│   └── classify-argument-boolean-observations.scaffolded-response.json
└── __tests__/
    ├── health.test.ts                     # GET /health shape + auth posture
    ├── bearerAuth.test.ts                 # 401 on missing/invalid token
    ├── originValidation.test.ts           # 403 on invalid Origin
    ├── protocolVersion.test.ts            # MCP-Protocol-Version handling
    ├── toolsList.test.ts                  # tools/list returns both names
    ├── initialize.test.ts                 # initialize handshake
    ├── classifySemanticMove.test.ts       # tool happy path + schema rejection
    ├── classifySemanticMoveCompat.test.ts # adapter-compat endpoint
    ├── classifyArgumentBooleanObservations.test.ts  # scaffolded error envelope
    ├── timeout.test.ts                    # 30s request / 25s model timeout
    ├── structuredLogging.test.ts          # no secrets / no PII in logs
    ├── doctrineCompliance.test.ts         # ban-list scan of every prompt + response field
    └── fixtures.test.ts                   # deep-equal checks for committed fixtures
```

**Server tests live OUTSIDE CDiscourse's Jest budget.** Run via `cd mcp-server && deno test`. They do NOT count against CDiscourse's `npm run test` count.

### 3.3 How server tests stay separate from CDiscourse's `__tests__/`

- CDiscourse root Jest config (`jest.config.*`) excludes `mcp-server/**` via `testPathIgnorePatterns: ['/mcp-server/']` (single bounded edit if not already excluded)
- `mcp-server/__tests__/` uses Deno's built-in test runner (`Deno.test`)
- `mcp-server/deno.json` declares a `task` named `test`: `"test": "deno test --allow-net --allow-env"`
- No root `package.json` change

---

## §4 — MCP Streamable HTTP transport implementation

### 4.1 Endpoint shape

| Endpoint | Method | Purpose | Auth | Returns |
|---|---|---|---|---|
| `/health` | GET | health check | none (or bearer; designer recommends `none`) | JSON; no secrets |
| `/mcp` | POST | official JSON-RPC 2.0 MCP requests | bearer required | JSON-RPC response |
| `/mcp` | GET | SSE stream (server-initiated) | bearer required | **405 Method Not Allowed** (v1) |
| `/mcp/adapter-compat` | POST | MCP-018 simplified-envelope endpoint | bearer required | inner result object (`{result: {...}}`) |

### 4.2 JSON-RPC 2.0 supported methods on `/mcp` (official)

| Method | Purpose |
|---|---|
| `initialize` | Capability handshake (server returns `serverInfo` + `capabilities`) |
| `notifications/initialized` | Client confirms init complete (no response, JSON-RPC notification) |
| `tools/list` | Returns array of tool definitions (both `classify_semantic_move` and `classify_argument_boolean_observations`) |
| `tools/call` | Invokes a tool by name |
| `ping` | Optional health-check method (returns empty result) |

### 4.3 Adapter-compat envelope on `/mcp/adapter-compat`

Accepts MCP-018's exact simplified envelope:
```json
{ "tool": "classify_semantic_move", "input": { /* per Phase A.1 */ } }
```

Returns one of the three shapes the existing `extractMcpPacket` recognises:
```json
{ "result": { /* inner packet structural subset */ } }
```

The adapter-compat endpoint is a thin adapter: it parses the simplified body, dispatches to the same tool handler the official `/mcp` endpoint uses, and wraps the result in `{result: {...}}`. **No duplicate handler logic.**

### 4.4 Headers

**Required on every `/mcp` and `/mcp/adapter-compat` POST:**
- `Authorization: Bearer <token>` — constant-time compared to `MCP_SERVER_BEARER_TOKEN`
- `Content-Type: application/json` — rejected with 415 if absent or other

**Validated when present:**
- `Origin` — rejected (403) if not in `MCP_SERVER_ALLOWED_ORIGINS` env var list (empty list = allow all; designer recommends operator pin the Supabase project URL)
- `MCP-Protocol-Version` — server echoes its target version; if client sends a known older version, log a structured warning and continue (v1 supports only `2025-11-25`)

**Always set on response:**
- `Content-Type: application/json`
- `MCP-Protocol-Version: 2025-11-25`
- `X-Request-Id: <correlation id>` (echoed from `Mcp-Request-Id` if client sent one, else generated server-side)

---

## §5 — MCP lifecycle compatibility decision (Phase A.8)

### 5.1 Decision: Option C (both endpoints)

**Phase A.8 binding finding:** MCP-018's existing `buildMcpToolRequestBody` produces a **simplified envelope** (`{tool, input}`), NOT a JSON-RPC `tools/call` envelope. The body has no `jsonrpc`, no `id`, no `method`, no `params.name`. Modifying MCP-018's adapter is **explicitly out of scope** (intent brief §"Read-only API boundaries").

**Therefore Option C is required:**
- `/mcp` implements full official MCP Streamable HTTP (initialize + tools/list + tools/call + JSON-RPC 2.0 envelopes)
- `/mcp/adapter-compat` accepts MCP-018's simplified envelope, dispatches to the same tool handler, returns `{result: {...}}`

**Rationale:**
- Preserves MCP-018's deployed code unchanged
- Preserves MCP-021C-EDGE's deployed code unchanged (its adapter wrapper also sends the simplified envelope per `booleanObservationMcpAdapterCore.ts:118-137`)
- Protects future scalability — any new MCP client (e.g., a Claude Desktop integration) can use the official `/mcp` endpoint
- No duplicate logic — both endpoints route to the same tool handlers
- Single shared validation layer

### 5.2 Initialize handshake (official mode only)

Server responds to `initialize` with:
```json
{
  "jsonrpc": "2.0",
  "id": "<request id>",
  "result": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "tools": { "listChanged": false }
    },
    "serverInfo": {
      "name": "cdiscourse-mcp-server",
      "version": "0.1.0"
    }
  }
}
```

The adapter-compat endpoint does NOT require initialize — it's invoked on every request.

### 5.3 Acceptance criteria

- `tools/list` returns both tools after `initialize` in official mode
- `tools/call` for `classify_semantic_move` invokes the same handler the adapter-compat endpoint invokes
- MCP-018's current adapter call to `/mcp/adapter-compat` works unchanged
- MCP-021C-EDGE's current adapter call to `/mcp/adapter-compat` works unchanged
- Both modes covered by smoke-script phases (5.1 server local smoke phase tests both)

---

## §6 — `classify_semantic_move` tool design

### 6.1 Tool definition (official MCP `tools/list` entry)

```json
{
  "name": "classify_semantic_move",
  "title": "Semantic Move Classifier",
  "description": "Classifies a single argument move's structural properties — parent continuity, evidence hygiene, branch hygiene, constructive movement, debate-mode fit, friction. STRUCTURAL questions only — never assigns truth value, never picks a winner, never reads popularity as evidence. Returns a SemanticRefereePacket. Used by CDiscourse's semantic-referee Edge Function.",
  "inputSchema": {
    "type": "object",
    "required": ["moveBodyRedacted", "roomContext", "requestedClassifiers", "contentHash", "roomId"],
    "properties": {
      "moveBodyRedacted": { "type": "string", "minLength": 1, "maxLength": 8000 },
      "parentBodyRedacted": { "type": "string", "maxLength": 8000 },
      "roomContext": {
        "type": "object",
        "properties": {
          "debateMode": { "type": "string", "maxLength": 512 },
          "selectedAction": { "type": "string", "maxLength": 512 },
          "selectedMoveType": { "type": "string", "maxLength": 512 },
          "side": { "type": "string", "enum": ["affirmative","negative","observer","moderator"] },
          "actorRole": { "type": "string", "enum": ["initiator","primary_opponent","chime_in","observer"] }
        },
        "additionalProperties": false
      },
      "requestedClassifiers": {
        "type": "array",
        "minItems": 1,
        "maxItems": 5,
        "items": { "type": "string", "enum": ["responds_to_parent","introduces_new_issue","asks_for_evidence","provides_evidence","evidence_supports_claim","quote_anchors_parent","narrows_claim","concedes_narrow_point","requests_clarification","answers_clarification","shifts_to_person_or_intent","uses_popularity_as_evidence","contains_playable_hot_take","contains_unplayable_insult_only","is_satire_or_parody","uses_satire_as_evidence","cites_retraction","creates_source_chain_gap","suggests_side_branch","suggests_diagonal_tangent","fits_selected_debate_mode","needs_pre_send_pause","ready_for_synthesis","disputes_evidence_applicability","references_prior_agreement","provides_temporal_constraint","accepts_partial_with_caveat","provides_alternate_interpretation","opens_evidence_debt_marker","closes_evidence_debt_marker","supplies_corroborating_document","introduces_sub_axis","concedes_with_new_dispute","proposes_settlement_terms","accepts_settlement_terms"] }
      },
      "contentHash": { "type": "string", "minLength": 1, "maxLength": 512 },
      "roomId": { "type": "string", "minLength": 1, "maxLength": 512 },
      "moveId": { "type": "string", "minLength": 1, "maxLength": 512 },
      "parentId": { "type": "string", "minLength": 1, "maxLength": 512 },
      "promptVersionHint": { "type": "string", "minLength": 1, "maxLength": 512 }
    },
    "additionalProperties": false
  },
  "outputSchema": {
    "type": "object",
    "required": ["binaries", "routeSuggestion", "frictionSuggestion", "scoreHints"],
    "properties": {
      "binaries": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["classifierId", "value", "confidence", "reasonCode"],
          "properties": {
            "classifierId": { "type": "string" },
            "value": { "type": "integer", "minimum": 0, "maximum": 1 },
            "confidence": { "type": "string", "enum": ["low","medium","high"] },
            "reasonCode": { "type": "string", "minLength": 1, "maxLength": 280 },
            "evidenceSpan": { "type": "string", "maxLength": 280 },
            "parentSpan": { "type": "string", "maxLength": 280 }
          },
          "additionalProperties": false
        }
      },
      "routeSuggestion": { "type": "string", "enum": ["mainline","vertical_chime_branch","diagonal_tangent","outer_realm","cards_detail","synthesis_lane","no_route_change"] },
      "frictionSuggestion": { "type": "string", "enum": ["none","soft_chip","pre_send_pause","ask_for_quote","ask_for_source","suggest_branch","suggest_narrow","cooldown_notice"] },
      "scoreHints": {
        "type": "object",
        "required": ["continuityCredit","evidencePressure","branchHygiene","synthesisReadiness","sourceChainDebt","unresolvedRedirectRisk"],
        "properties": {
          "continuityCredit": { "type": "integer", "minimum": 0, "maximum": 3 },
          "evidencePressure": { "type": "integer", "minimum": 0, "maximum": 3 },
          "branchHygiene": { "type": "integer", "minimum": 0, "maximum": 3 },
          "synthesisReadiness": { "type": "integer", "minimum": 0, "maximum": 3 },
          "sourceChainDebt": { "type": "integer", "minimum": 0, "maximum": 3 },
          "unresolvedRedirectRisk": { "type": "integer", "minimum": 0, "maximum": 3 }
        },
        "additionalProperties": false
      },
      "modelVersion": { "type": "string", "maxLength": 512 }
    },
    "additionalProperties": false
  }
}
```

The `outputSchema` is the structural subset the MCP server is responsible for. The MCP-018 adapter stamps `packetVersion` / `promptVersion` / `provider` / `authoritative` / `inputHash` / `contentHash` / `roomId` / `moveId` / `parentId` / context fields — the server MUST NOT emit them (they would be ignored by `stampPacketIdentity`, but emitting them is wasteful).

### 6.2 Tool handler flow

```
1. Validate input against inputSchema (zod via npm:zod@4 in Deno)
   → invalid → JSON-RPC error code -32602 (Invalid params) on /mcp,
     or 400 with structured error on /mcp/adapter-compat
2. Generate request ID (correlation), log start (tool name, request ID, NO body)
3. Build Anthropic prompt:
   - System prompt: COPY of SEMANTIC_REFEREE_SYSTEM_PROMPT (from anthropicClassifierCore.ts:51-70)
   - User prompt: COPY of buildClassifierPrompt logic (from seedPrompt.ts:105-174)
4. Call Anthropic Messages API:
   - Model: claude-haiku-4-5 (default; ANTHROPIC_MODEL env override)
   - max_tokens: 900
   - temperature: 0
   - timeout: MCP_SERVER_MODEL_TIMEOUT_MS (25_000 default)
5. Extract `content[].type === 'text'` from response → parse JSON object from text
   → parse fail → return `isError: true` + content text "Model response was not valid JSON"
6. Validate parsed object against outputSchema
   → invalid → return `isError: true` + structured content `{reason: "validation_failed", path: <issue path>}`
7. Run doctrine ban-list scan (verdict tokens, person labels, secrets, PII)
   → fail → return `isError: true` + structured content `{reason: "validation_failed", layer: "content_scan"}`
8. Wrap and return:
   - On /mcp: { jsonrpc: "2.0", id, result: { content: [{type:"text",text:JSON.stringify(packet)}], structuredContent: packet, isError: false } }
   - On /mcp/adapter-compat: { result: <packet> }
9. Log end (tool name, request ID, duration_ms, status: "success")
```

### 6.3 Response shape per Decision 12 (structured tool output)

**Official MCP `tools/call` response (on `/mcp`):**
```json
{
  "jsonrpc": "2.0",
  "id": "<request id>",
  "result": {
    "content": [
      {"type": "text", "text": "<JSON-serialized structural subset>"}
    ],
    "structuredContent": { /* SemanticRefereePacket structural subset */ },
    "isError": false
  }
}
```

**Adapter-compat response (on `/mcp/adapter-compat`):**
```json
{
  "result": { /* SemanticRefereePacket structural subset */ }
}
```

This matches `extractMcpPacket`'s priority-1 shape (`{result: {...}}`); MCP-018's adapter parses it without modification.

---

## §7 — `classify_argument_boolean_observations` scaffold design

### 7.1 Tool definition (registered, schema-exposed, scaffolded invocation)

```json
{
  "name": "classify_argument_boolean_observations",
  "title": "Argument Boolean Observation Classifier",
  "description": "Scaffolded for MCP-SERVER-002; not yet implemented. Future: classifies an argument move against MCP-021A's boolean Machine Observation taxonomy (172-key vocabulary, family-sharded). When implemented, accepts McpBooleanObservationRequest and returns McpBooleanObservationResponse per the schema in src/features/nodeLabels/mcpBooleanObservationSchema.ts. Currently returns isError: true with reason: not_implemented.",
  "inputSchema": {
    "type": "object",
    "required": ["schemaVersion", "nodeId", "currentText", "threadContextExcerpt", "requestedFamilies", "requestedRawKeys", "definitions", "timeoutMs"],
    "properties": {
      "schemaVersion": { "type": "string", "const": "mcp-021.machine-observations.boolean.v1" },
      "nodeId": { "type": "string", "minLength": 1 },
      "parentNodeId": { "type": ["string","null"] },
      "currentText": { "type": "string" },
      "parentText": { "type": ["string","null"] },
      "threadContextExcerpt": { "type": "string" },
      "requestedFamilies": { "type": "array", "items": { "type": "string" } },
      "requestedRawKeys": { "type": "array", "items": { "type": "string" } },
      "definitions": { "type": "object", "additionalProperties": true },
      "timeoutMs": { "type": "integer", "minimum": 1, "maximum": 60000 }
    },
    "additionalProperties": false
  },
  "outputSchema": {
    "type": "object",
    "required": ["schemaVersion","nodeId","checkedRawKeys","observations","confidence","evidenceSpan","modelInfo"],
    "properties": {
      "schemaVersion": { "type": "string", "const": "mcp-021.machine-observations.boolean.v1" },
      "nodeId": { "type": "string" },
      "checkedRawKeys": { "type": "array", "items": { "type": "string" } },
      "observations": { "type": "object", "additionalProperties": { "type": "boolean" } },
      "confidence": { "type": "object", "additionalProperties": { "type": "string", "enum": ["low","medium","high"] } },
      "evidenceSpan": { "type": "object", "additionalProperties": { "type": ["string","null"] } },
      "modelInfo": {
        "type": "object",
        "required": ["provider","serverName","classifierSetVersion"],
        "properties": {
          "provider": { "type": "string", "const": "mcp" },
          "serverName": { "type": "string" },
          "classifierSetVersion": { "type": "string" }
        }
      }
    },
    "additionalProperties": false
  }
}
```

### 7.2 Scaffolded invocation handler

**Behavior:** validates input against inputSchema, then returns the documented error envelope. Does NOT call the model provider. Does NOT consume model tokens. Does NOT produce fake classifier output.

**Response (on `/mcp` official):**
```json
{
  "jsonrpc": "2.0",
  "id": "<request id>",
  "result": {
    "content": [
      {"type": "text", "text": "Tool scaffolded for MCP-SERVER-002; not yet implemented"}
    ],
    "structuredContent": {
      "reason": "not_implemented",
      "scaffoldedFor": "MCP-SERVER-002"
    },
    "isError": true
  }
}
```

**Response (on `/mcp/adapter-compat`):**
```json
{
  "result": {
    "isError": true,
    "reason": "not_implemented",
    "scaffoldedFor": "MCP-SERVER-002"
  }
}
```

Note: MCP-021C-EDGE's adapter wrapper interprets this via `parseMcpBooleanObservationResponse` (returns `{ok: false, reason: 'wrong_shape'}` since `schemaVersion` is absent), which the Edge Function maps to `validation_failed` → deterministic fallback. No user-facing error.

### 7.3 Why scaffold now (not later)

Per intent brief §"Decision 2 capability 3": proves the server architecture supports both tool shapes (the existing semantic-referee packet AND the new MCP-021A boolean response) without another architecture pivot when MCP-SERVER-002 lands. The `tools/list` response shows both tools today; MCP-SERVER-002 only swaps the handler body.

---

## §8 — Health endpoint design

### 8.1 Shape

`GET /health` returns:
```json
{
  "status": "ok",
  "version": "0.1.0",
  "environment": "prod",
  "supportedTools": ["classify_semantic_move", "classify_argument_boolean_observations"],
  "credentialsConfigured": true,
  "timestamp": "2026-05-26T13:15:00.000Z"
}
```

### 8.2 Field definitions

| Field | Type | Source |
|---|---|---|
| `status` | `"ok"` | constant when reachable |
| `version` | semver string | `mcp-server/deno.json` version field |
| `environment` | `"local" \| "dev" \| "staging" \| "prod"` | `MCP_SERVER_ENV` env var |
| `supportedTools` | array of tool names | server-side registry constant |
| `credentialsConfigured` | boolean | `(MCP_SERVER_BEARER_TOKEN && ANTHROPIC_API_KEY) != null` |
| `timestamp` | ISO-8601 | `new Date().toISOString()` |

### 8.3 Auth posture: NO authentication required

**Rationale:** the health endpoint is for uptime monitoring and the smoke script's first phase. It MUST NOT leak environment-sensitive data; `credentialsConfigured` is a boolean (not a value), `version` is the public semver, `environment` is a low-cardinality enum. No tokens, no provider info beyond a boolean.

Designer Phase A.4 confirmed: an unauthenticated health endpoint is safe AND simpler for the smoke script (no token needed for phase 1).

### 8.4 Not a model call

The endpoint runs no `fetch` to Anthropic. Cheap; safe to hit from monitoring at high frequency.

---

## §9 — Bearer auth design

### 9.1 Middleware

Every request to `/mcp` and `/mcp/adapter-compat` runs through bearer middleware BEFORE method dispatch:

```typescript
// Pseudocode
function bearerMiddleware(req: Request): Response | null {
  const auth = req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return errorResponse(401, 'unauthorized', 'Missing or invalid Authorization header');
  }
  const presented = auth.slice('Bearer '.length);
  const expected = Deno.env.get('MCP_SERVER_BEARER_TOKEN');
  if (!expected) {
    return errorResponse(500, 'server_misconfigured', 'Server bearer not configured');
  }
  if (!constantTimeEqual(presented, expected)) {
    return errorResponse(401, 'unauthorized', 'Invalid bearer token');
  }
  return null; // pass through
}
```

**Constant-time compare** prevents timing-side-channel token discovery.

### 9.2 401 envelope shape

**On `/mcp` (official):**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": -32000,
    "message": "unauthorized",
    "data": { "reason": "Missing or invalid Authorization header" }
  }
}
```
HTTP status: 401.

**On `/mcp/adapter-compat`:**
```json
{ "error": "unauthorized", "message": "Missing or invalid Authorization header" }
```
HTTP status: 401.

### 9.3 What MUST NOT be logged

- The presented bearer token value
- The expected bearer token value
- The Authorization header literal
- Any partial token (first 4 chars, last 4 chars, etc. — partial leaks compound across log lines)

### 9.4 What MAY be logged

- `requestId` (UUID, server-generated correlation id)
- `path` (`/mcp` or `/mcp/adapter-compat`)
- `reason` (`missing_header` / `wrong_scheme` / `token_mismatch`)
- HTTP method, response status

---

## §10 — Origin validation design

### 10.1 When Origin is validated

Per MCP spec, Origin SHOULD be validated when present (mitigates DNS rebinding from malicious local websites).

**Posture:**
- If `MCP_SERVER_ALLOWED_ORIGINS` env var is empty/unset → all origins allowed (legacy MCP-018 adapter doesn't send Origin from server-to-server calls; this is fine)
- If `MCP_SERVER_ALLOWED_ORIGINS` is non-empty (comma-separated) AND request includes `Origin` header AND Origin not in list → reject 403

### 10.2 403 envelope shape

```json
{ "error": "forbidden", "message": "Origin not in allowed list" }
```
HTTP status: 403. On `/mcp` wrapped in JSON-RPC error envelope (code -32000).

### 10.3 Operator recommendation in runbook

Pin `MCP_SERVER_ALLOWED_ORIGINS` to the Supabase project URL for the Edge Function caller. Server-to-server MCP-018 calls don't send Origin by default in Deno's `fetch`, so this primarily blocks browser-based attackers.

---

## §11 — MCP-Protocol-Version handling

### 11.1 Targeted version

`2025-11-25` (the latest stable as of authoring; pinned in ledger §24).

### 11.2 Request handling

| Client `MCP-Protocol-Version` header | Server behavior |
|---|---|
| Absent | Continue; assume `2025-11-25`; echo `2025-11-25` in response |
| `2025-11-25` | Continue; echo same in response |
| Older known version (e.g., `2025-06-18`) | Log structured warning; continue with `2025-11-25` semantics; echo `2025-11-25` |
| Unknown / future version | Log structured warning; continue with `2025-11-25` semantics; echo `2025-11-25` |

### 11.3 Response header

Every `/mcp` and `/mcp/adapter-compat` response sets:
```
MCP-Protocol-Version: 2025-11-25
```

---

## §12 — Server-side credential handling

### 12.1 Credentials held server-side

| Env var | Purpose | Where held |
|---|---|---|
| `MCP_SERVER_BEARER_TOKEN` | the bearer the Edge Function presents | Deno Deploy env vars |
| `ANTHROPIC_API_KEY` | the model-provider credential | Deno Deploy env vars |
| `MODEL_PROVIDER` | `"anthropic"` (v1 only) | Deno Deploy env vars |
| `ANTHROPIC_MODEL` | optional model override (`claude-haiku-4-5` default) | Deno Deploy env vars |
| `MCP_SERVER_ENV` | `"local"\|"dev"\|"staging"\|"prod"` | Deno Deploy env vars |
| `MCP_SERVER_PORT` | optional; default 8080 | local only (Deno Deploy assigns) |
| `MCP_SERVER_REQUEST_TIMEOUT_MS` | optional; default 30_000 | Deno Deploy env vars |
| `MCP_SERVER_MODEL_TIMEOUT_MS` | optional; default 25_000 | Deno Deploy env vars |
| `MCP_SERVER_ALLOWED_ORIGINS` | optional comma-separated allow-list | Deno Deploy env vars |

### 12.2 Never in

- CDiscourse `.env*` files
- CDiscourse `app/` or `src/`
- CDiscourse Supabase function secrets (those carry only `SEMANTIC_REFEREE_MCP_URL` + `SEMANTIC_REFEREE_MCP_TOKEN`, which point AT this server — NOT the server's credentials)
- Any git-tracked file in the CDiscourse repo
- GitHub Actions environment (no CI deploy in v1; operator deploys manually)

### 12.3 Two distinct trust boundaries

1. **CDiscourse Edge Function → MCP server:** authenticated with `SEMANTIC_REFEREE_MCP_TOKEN` (held in Supabase function secrets, presented to MCP server as `Bearer`)
2. **MCP server → Anthropic:** authenticated with `ANTHROPIC_API_KEY` (held only in Deno Deploy env vars)

The Anthropic API key is NEVER exposed to CDiscourse callers, NEVER returned in any response body, NEVER logged.

---

## §13 — Default model provider: Anthropic (Decision 13)

### 13.1 Model id

**Default:** `claude-haiku-4-5` (matches MCP-017 `DEFAULT_SEMANTIC_REFEREE_MODEL` constant in `anthropicClassifierCore.ts:36`).

**Override:** `ANTHROPIC_MODEL` env var on the server.

**Pinned snapshot form (operator option):** `claude-haiku-4-5-20251001` per anthropicClassifierCore.ts:29.

**Phase A.9 verified:** the model id is verifiable from the canonical source. No runbook placeholder needed.

### 13.2 Anthropic endpoint + API version

- Endpoint: `https://api.anthropic.com/v1/messages`
- API version header: `anthropic-version: 2023-06-01`
- API key header: `x-api-key: <ANTHROPIC_API_KEY>`

Mirrors `anthropicProvider.ts:56-59` constants.

### 13.3 Request body shape (Anthropic Messages API)

```json
{
  "model": "claude-haiku-4-5",
  "max_tokens": 900,
  "temperature": 0,
  "system": "<SEMANTIC_REFEREE_SYSTEM_PROMPT verbatim>",
  "messages": [{"role": "user", "content": "<buildClassifierPrompt output>"}]
}
```

### 13.4 Provider abstraction (forward-compatible)

Server exposes a `ProviderClient` interface internally:

```typescript
interface ProviderClient {
  generateStructural(input: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
    temperature: number;
    timeoutMs: number;
  }): Promise<{ ok: true; text: string } | { ok: false; reason: ProviderUnavailableReason }>;
}
```

`AnthropicProviderClient` is the v1 implementation. Future providers (OpenAI, local models) implement the same interface without changing tool contracts.

---

## §14 — Semantic-referee prompt source (Phase A.9 outcomes)

### 14.1 Prompt source file path (binding)

**Canonical prompt source:** `supabase/functions/_shared/semanticReferee/seedPrompt.ts`
**Canonical system prompt:** `supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts` lines 51-70

The MCP server's `src/tools/classifySemanticMove/prompt.ts` and `systemPrompt.ts` are **COPIES** of those two sources (under the server's directory tree, not via cross-tree import — keeps the server independently deployable).

**Prompt version:** `mcp-semantic-referee-prompt-v2` (from `seedPrompt.ts:46`). MCP server emits this as the `promptVersion` if the request doesn't supply `promptVersionHint`.

**Why copies, not imports:** the MCP server is a separately-deployed artifact. Cross-tree imports across `mcp-server/` and `supabase/functions/` would (a) entangle Docker-style deploy boundaries and (b) re-introduce the Jest/Deno bridge problem. Copies are explicit; a parity test (`mcp-server/__tests__/promptParity.test.ts`) reads both files as source text and fails if they drift on:
- Every system-prompt absolute rule
- The 35-id classifier enumeration
- The route/friction enumerations
- The structured-output instruction

### 14.2 Model id (Phase A.9 verified)

`claude-haiku-4-5` (see §13.1).

### 14.3 Response schema

The MCP server validates Anthropic's response against the structural-subset outputSchema (§6.1). Same schema the CDiscourse `SemanticRefereePacketSchema` validates the inner packet against, minus the identity fields the adapter stamps.

### 14.4 Positive fixture derivation

`mcp-server/fixtures/classify-semantic-move.response.json` is derived from `supabase/functions/_shared/semanticReferee/fixtures.ts` (`SEMANTIC_REFEREE_FIXTURES['fixture-content-hash-mainline']`), with the identity fields stripped (the server doesn't emit them). Verbatim values:

```json
{
  "binaries": [
    {
      "classifierId": "responds_to_parent",
      "value": 1,
      "confidence": "high",
      "reasonCode": "parent_continuity_direct_claim_response"
    }
  ],
  "routeSuggestion": "mainline",
  "frictionSuggestion": "none",
  "scoreHints": {
    "continuityCredit": 2,
    "evidencePressure": 0,
    "branchHygiene": 0,
    "synthesisReadiness": 0,
    "sourceChainDebt": 0,
    "unresolvedRedirectRisk": 0
  }
}
```

The corresponding request fixture (`classify-semantic-move.request.json`):

```json
{
  "moveBodyRedacted": "[fixture] I agree with the parent's claim that streetlights reduce nighttime accidents, and add that they specifically reduce pedestrian-vehicle accidents at intersections.",
  "parentBodyRedacted": "[fixture] Cities should install more streetlights because they reduce nighttime accidents.",
  "roomContext": {
    "debateMode": "structured_dispute",
    "side": "affirmative",
    "actorRole": "primary_opponent"
  },
  "requestedClassifiers": ["responds_to_parent"],
  "contentHash": "fixture-content-hash-mainline",
  "roomId": "fixture-room-mainline",
  "promptVersionHint": "mcp-semantic-referee-prompt-v2"
}
```

### 14.5 Malformed-response fixture (for schema rejection test)

`mcp-server/fixtures/classify-semantic-move.malformed-response.json`:
```json
{
  "binaries": [
    {
      "classifierId": "responds_to_parent",
      "value": 1,
      "confidence": "high",
      "reasonCode": "parent_continuity_direct_claim_response",
      "verdict": "correct"
    }
  ],
  "routeSuggestion": "mainline",
  "frictionSuggestion": "none",
  "scoreHints": { "continuityCredit": 2, "evidencePressure": 0, "branchHygiene": 0, "synthesisReadiness": 0, "sourceChainDebt": 0, "unresolvedRedirectRisk": 0 }
}
```

The smuggled `verdict: "correct"` field fails `additionalProperties: false` in the outputSchema's binary entry; the server returns `isError: true` + `validation_failed`. This validates the doctrine wall holds at the server boundary, not just the CDiscourse boundary.

### 14.6 Validation fallback behavior

If the model returns a malformed response:
1. Validation step (§6.2 step 6) detects the failure
2. Server logs `{semanticReferee: 'validation_failed', layer: 'schema', path: <issue path>, requestId}` — no body text logged
3. Server returns to caller `{isError: true, structuredContent: {reason: "validation_failed", path: <issue path>}}`
4. MCP-018 adapter sees a successful HTTP 200 but the parsed packet fails `SemanticRefereePacketSchema` (because `result` is the error envelope, not a packet) → adapter returns `{kind: 'unavailable', reason: 'validation_failed'}` → Edge Function falls back to deterministic packet → user sees layer-1 result

Doctrine wall holds at every layer.

---

## §15 — Structured logging design (Decision 8)

### 15.1 Logger interface

```typescript
function log(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  }));
}
```

Deno Deploy captures `console.log` as structured log entries.

### 15.2 Allowed fields

| Field | Type | Example |
|---|---|---|
| `requestId` | UUID | `"a1b2c3d4-..."` |
| `tool` | string | `"classify_semantic_move"` |
| `endpoint` | string | `"/mcp"` or `"/mcp/adapter-compat"` |
| `duration_ms` | number | `1234` |
| `status` | string | `"success" \| "failure" \| "timeout"` |
| `errorClass` | string | `"validation_failed" \| "model_timeout" \| "rate_limited"` |
| `httpStatus` | number | `200` |
| `promptHash` | string | SHA-256 hex of prompt text (for debugging) |
| `responseHash` | string | SHA-256 hex of response text (for debugging) |
| `protocolVersion` | string | `"2025-11-25"` |

### 15.3 FORBIDDEN fields (must never appear in logs)

- Bearer token (presented OR expected, full OR partial)
- `ANTHROPIC_API_KEY` (full OR partial)
- Raw prompt text (the SHA-256 hash is acceptable)
- Raw model response text (the SHA-256 hash is acceptable)
- User identifiers from upstream callers (roomId/moveId reach the server but are not logged — they could correlate to user behavior)
- Argument body text
- Any room content text
- The `Authorization` header value

### 15.4 Test: log line sanity

`mcp-server/__tests__/structuredLogging.test.ts` runs every tool handler with a known input and inspects emitted log lines for:
- All required fields present
- No forbidden fields present (regex scan for bearer-pattern, sk-ant- pattern, prompt body fragments)

---

## §16 — Timeout discipline (Decision 9)

### 16.1 Two timeouts

| Bound | Default | Env var | Applied at |
|---|---|---|---|
| Per-request | 30_000 ms | `MCP_SERVER_REQUEST_TIMEOUT_MS` | Server HTTP handler |
| Per-model-call | 25_000 ms | `MCP_SERVER_MODEL_TIMEOUT_MS` | Anthropic `fetch` via `AbortSignal.timeout` |

The model timeout < request timeout by 5s, so a timed-out model call returns an error envelope before the HTTP handler aborts.

### 16.2 Timed-out model call response

**On `/mcp`:**
```json
{
  "jsonrpc": "2.0",
  "id": "<request id>",
  "result": {
    "content": [{"type": "text", "text": "Model call exceeded timeout"}],
    "structuredContent": { "reason": "model_timeout", "timeoutMs": 25000 },
    "isError": true
  }
}
```

**On `/mcp/adapter-compat`:**
```json
{
  "result": {
    "isError": true,
    "reason": "model_timeout",
    "timeoutMs": 25000
  }
}
```

The MCP-018 adapter interprets this as `parse_failure` (since `result` is the error envelope, not a packet) → deterministic fallback.

### 16.3 Server request timeout (rare)

If somehow the server's outer 30s timeout fires before the model timeout responds, return:
```json
{
  "error": "request_timeout",
  "message": "Request exceeded 30000 ms"
}
```
HTTP status: 504. Logged as `{status: "timeout", endpoint, requestId}`.

---

## §17 — Local run mode (per "Required local run mode")

### 17.1 Commands

```bash
cd mcp-server
deno task dev            # starts server on http://localhost:8080
```

`deno.json` declares:
```json
{
  "tasks": {
    "dev": "deno run --allow-net --allow-env --watch main.ts",
    "test": "deno test --allow-net --allow-env",
    "start": "deno run --allow-net --allow-env main.ts"
  }
}
```

### 17.2 Local env vars required

`mcp-server/.env.local.example` (gitignored as `.env.local`):
```
MCP_SERVER_BEARER_TOKEN=local-dev-bearer-do-not-use-in-prod
MODEL_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...           # operator's local dev key
MCP_SERVER_ENV=local
MCP_SERVER_PORT=8080
```

Operator loads with `cp .env.local.example .env.local && vi .env.local`. Server reads via `Deno.env.get()` (Deno auto-loads `.env.local` when present in current directory, or operator can `source` them).

### 17.3 Local smoke command

```bash
bash scripts/mcp-server-001-smoke.sh \
  --base-url http://localhost:8080 \
  --token local-dev-bearer-do-not-use-in-prod
```

### 17.4 Acceptance

Local smoke MUST pass before any hosted deploy instruction is considered complete. Smoke script exit 0 = green.

---

## §18 — Deployment runbook outline

### 18.1 File path

`docs/deployment/mcp-server-001-runbook.md`

### 18.2 Required sections (operator-facing)

1. **What MCP-SERVER-001 shipped** — server location, capabilities, what's scaffolded
2. **Prerequisites** — Anthropic API key, Deno Deploy account, Supabase project link, MCP service token generated
3. **Phase 1: Local smoke** — clone repo; `cd mcp-server`; install Deno; copy `.env.local.example` → `.env.local`; populate; `deno task dev`; in another shell run `bash scripts/mcp-server-001-smoke.sh --base-url http://localhost:8080 --token <token>`; verify exit 0
4. **Phase 2: Deno Deploy deployment** — log into Deno Deploy; create project `cdiscourse-mcp-server`; configure GitHub integration OR upload via `deno deploy`; set env vars (bearer token, Anthropic key, MODEL_PROVIDER, MCP_SERVER_ENV=prod); note deployed URL
5. **Phase 3: Hosted smoke** — `bash scripts/mcp-server-001-smoke.sh --base-url https://cdiscourse-mcp-server.deno.dev --token <token>`; verify exit 0
6. **Phase 4: Supabase secrets** — `npx supabase secrets set SEMANTIC_REFEREE_MCP_URL=https://cdiscourse-mcp-server.deno.dev/mcp/adapter-compat --project-ref qsciikhztvzzohssddrq`; `npx supabase secrets set SEMANTIC_REFEREE_MCP_TOKEN=<token> --project-ref qsciikhztvzzohssddrq`; `npx supabase secrets list --project-ref qsciikhztvzzohssddrq | grep SEMANTIC_REFEREE_MCP`
7. **Phase 5: MCP-018 integration** — trigger semantic-referee path via existing MCP-018 runbook; verify real `SemanticRefereePacket` returns; record audit
8. **Token rotation** — set new token in Deno Deploy env vars; set same token in Supabase function secret; both roll forward together
9. **Logs access** — Deno Deploy dashboard → project → Logs
10. **Roll-back** — `npx supabase secrets unset SEMANTIC_REFEREE_MCP_URL --project-ref qsciikhztvzzohssddrq`; `npx supabase secrets unset SEMANTIC_REFEREE_MCP_TOKEN --project-ref qsciikhztvzzohssddrq`; MCP-018 adapter falls back to `not_configured` → deterministic; server stays deployed but unused
11. **Operator decisions** — Supabase URL value (with `/mcp/adapter-compat` suffix?); model id pinning (alias vs dated snapshot); allowed-origins pinning

### 18.3 Note the URL suffix decision

The MCP-018 adapter sends the simplified envelope. The Supabase secret `SEMANTIC_REFEREE_MCP_URL` MUST point at `/mcp/adapter-compat`, NOT `/mcp`. The runbook calls this out explicitly with the exact value:
```
SEMANTIC_REFEREE_MCP_URL=https://<deployed>/mcp/adapter-compat
```

### 18.4 Implementer commit cadence guidance

Six expected commits in implementer phase:
1. Server scaffold + protocol layer (deno.json, main.ts, server.ts, jsonRpc.ts, streamableHttp.ts, health.ts, logger.ts, requestId.ts) — green: server starts locally; GET /health returns 200
2. Lifecycle handshake (initialize.ts, protocolVersion.ts, tools/registry.ts, adapterCompat.ts) — green: tools/list returns both tools; initialize handshake works
3. `classify_semantic_move` tool implementation (full handler.ts, prompt.ts, systemPrompt.ts, inputSchema.ts, outputSchema.ts, validation.ts, providers/anthropicProvider.ts) — green: tool returns a packet on mock fixture
4. Scaffolded boolean tool (handler.ts + schemas) — green: tool returns documented `isError: true` envelope
5. Local smoke script + fixtures (scripts/mcp-server-001-smoke.sh, all 5 fixtures) — green: smoke against localhost passes
6. Deployment runbook + integration smoke template + handoff (runbook, audit template, CDiscourse current-status append, presence test) — green: runbook + template + script + fixtures all exist with required sections

---

## §19 — Local smoke script outline

### 19.1 File path

`scripts/mcp-server-001-smoke.sh`

### 19.2 Argument parsing

```bash
#!/usr/bin/env bash
# Arguments:
#   --base-url <url>   required; e.g., http://localhost:8080 or https://cdiscourse-mcp-server.deno.dev
#   --token <bearer>   required; matches MCP_SERVER_BEARER_TOKEN on server
#   --verbose          optional; prints per-check diagnostics
```

### 19.3 Checks (in order)

| # | Check | Expected | Exits non-zero on |
|---|---|---|---|
| 1 | GET /health | 200; JSON; required fields present; `credentialsConfigured: true`; no secrets in body | wrong status, missing field, secret-leak pattern |
| 2 | POST /mcp/adapter-compat without Authorization | 401; structured error envelope | wrong status, missing structured shape |
| 3 | POST /mcp/adapter-compat with WRONG Authorization | 401 | wrong status |
| 4 | POST /mcp/adapter-compat with valid bearer + `classify_semantic_move` fixture request | 200; `result` field present; structural-subset shape valid | wrong status, wrong shape |
| 5 | POST /mcp/adapter-compat with valid bearer + `classify_argument_boolean_observations` fixture request | 200; `result.isError: true`; `result.reason: "not_implemented"` | wrong status, wrong reason field |
| 6 | POST /mcp with valid bearer + `initialize` JSON-RPC | 200; `result.protocolVersion: "2025-11-25"`; serverInfo present | wrong version, missing serverInfo |
| 7 | POST /mcp with valid bearer + `tools/list` | 200; both tool names in result.tools[] | wrong tool count, missing names |
| 8 | POST /mcp with valid bearer + `tools/call` for `classify_semantic_move` | 200; `result.content[0].type: "text"`; `result.structuredContent` present; `result.isError: false` | wrong shape, isError true |
| 9 | POST /mcp with valid bearer + `tools/call` for `classify_argument_boolean_observations` | 200; `result.isError: true`; `result.structuredContent.reason: "not_implemented"` | wrong isError, wrong reason |

### 19.4 Output

- On all pass: `EXIT 0` + summary "MCP-SERVER-001 smoke: 9/9 PASS"
- On any fail: `EXIT 1` + per-check diagnostic (HTTP status, body excerpt with secrets redacted, expected vs actual)

### 19.5 No secrets in script output

Even on diagnostic output, the script MUST NOT echo:
- The token argument value
- The Authorization header literal
- Anthropic key fragments (the script doesn't see these, but defensive masking is documented in the script header)

---

## §20 — Fixtures (request + response for both tools)

### 20.1 File paths

All under `mcp-server/fixtures/`:

| File | Purpose |
|---|---|
| `classify-semantic-move.request.json` | Input fixture for tool 1; smoke script + tests use |
| `classify-semantic-move.response.json` | Expected output fixture for tool 1 (matches Anthropic mock OR known good response) |
| `classify-semantic-move.malformed-response.json` | Invalid output for schema-rejection test |
| `classify-argument-boolean-observations.request.json` | Input fixture for tool 2 (used by MCP-SERVER-002 + smoke) |
| `classify-argument-boolean-observations.scaffolded-response.json` | Documented "not_implemented" envelope |

### 20.2 Derivation method

| Fixture | Derivation |
|---|---|
| `classify-semantic-move.request.json` | Constructed to satisfy `buildMcpToolRequestBody`'s output shape; values from `SEMANTIC_REFEREE_FIXTURES['fixture-content-hash-mainline']` (`fixtures.ts`) extended with synthetic body text |
| `classify-semantic-move.response.json` | Structural subset of `SEMANTIC_REFEREE_FIXTURES['fixture-content-hash-mainline']` (identity fields stripped — server doesn't emit them) |
| `classify-semantic-move.malformed-response.json` | Same as above but with smuggled `verdict: "correct"` field (fails outputSchema's `additionalProperties: false`) |
| `classify-argument-boolean-observations.request.json` | Constructed to satisfy `buildBooleanObservationToolRequestBody`'s output shape; values from a synthetic move + parent + 1 family + 2 rawKeys |
| `classify-argument-boolean-observations.scaffolded-response.json` | The documented `{isError: true, reason: "not_implemented", scaffoldedFor: "MCP-SERVER-002"}` envelope |

### 20.3 Hard rule: synthetic + obviously fake

Every fixture body text begins with `[fixture]` so a content scanner can recognise them. No real @handle, no real URL, no real email, no real post id, no real user data. Every reasonCode value is from a known reason-code family.

### 20.4 Doctrine ban-list passes

Fixtures are scanned by `mcp-server/__tests__/doctrineCompliance.test.ts` for banned tokens (winner, loser, true, false, correct, dishonest, bad faith, manipulative, extremist, propagandist, stupid, idiot). Zero matches.

---

## §21 — Integration smoke template outline (post-merge audit)

### 21.1 File path

`docs/audits/MCP-SERVER-001-smoke-template.md`

### 21.2 Required template sections

Operator copies to a dated audit doc post-merge:

```markdown
# MCP-SERVER-001-SMOKE — <YYYY-MM-DD>

**Operator:** <name>
**Date:** <ISO date>
**Server URL:** <deployed URL>
**Server commit:** <git SHA of mcp-server/ at deploy time>
**Supabase project ref:** qsciikhztvzzohssddrq

## Phase 1 — Local smoke

- [ ] `cd mcp-server && deno task dev` started server on :8080
- [ ] `bash scripts/mcp-server-001-smoke.sh --base-url http://localhost:8080 --token <token>` exited 0
- [ ] All 9 checks PASS
- [ ] No secrets in stdout/stderr

**Result:** PASS / FAIL
**Notes:**

## Phase 2 — Hosted deploy

- [ ] Deployed to Deno Deploy project `cdiscourse-mcp-server`
- [ ] Env vars set: MCP_SERVER_BEARER_TOKEN, ANTHROPIC_API_KEY, MODEL_PROVIDER, MCP_SERVER_ENV=prod
- [ ] Deployed URL noted: ____________________

**Result:** PASS / FAIL
**Notes:**

## Phase 3 — Hosted smoke

- [ ] `bash scripts/mcp-server-001-smoke.sh --base-url https://<deployed> --token <token>` exited 0
- [ ] All 9 checks PASS
- [ ] Health endpoint reachable without bearer

**Result:** PASS / FAIL
**Notes:**

## Phase 4 — Supabase secrets

- [ ] `SEMANTIC_REFEREE_MCP_URL=https://<deployed>/mcp/adapter-compat` set in Supabase function secrets
- [ ] `SEMANTIC_REFEREE_MCP_TOKEN=<token>` set in Supabase function secrets
- [ ] `npx supabase secrets list --project-ref qsciikhztvzzohssddrq | grep SEMANTIC_REFEREE_MCP` shows both

**Result:** PASS / FAIL
**Notes:**

## Phase 5 — MCP-018 integration

- [ ] Triggered semantic-referee path on a test room
- [ ] Returned `SemanticRefereePacket` has `provider: 'mcp'` (NOT `'mock'`)
- [ ] `authoritative` is `false`
- [ ] `binaries[]` carries one entry per requested classifier
- [ ] No `deterministic_fallback` outcomes on N=3 test calls

**Result:** PASS / FAIL
**Notes:**

## Verdict

- **PASS** (all 5 phases): MCP-SERVER-002 + ADMIN-MCP-001 are AUTHORIZED to file
- **PARTIAL** (some checks fail; document specifics)
- **FAIL** (server doesn't deploy OR MCP-018 route fails): file MCP-SERVER-001-FIX

## Common failure_reason interpretations

| Symptom | Likely cause | Fix |
|---|---|---|
| Phase 1 health 401 | Health endpoint accidentally authed | Server misconfig |
| Phase 1 smoke check 4 fails with 401 | Token mismatch local | Re-set `.env.local` |
| Phase 3 smoke check 4 fails with `validation_failed` | Anthropic returned bad shape | Check Deno Deploy logs |
| Phase 5 returns `provider: 'mock'` | Provider flag not flipped OR Edge Function not redeployed | Re-set `SEMANTIC_REFEREE_PROVIDER=mcp`; redeploy semantic-referee |
| Phase 5 returns `enabled: false, reason: 'not_configured'` | Supabase secrets URL/TOKEN absent or wrong | Verify Phase 4; ensure URL has `/mcp/adapter-compat` suffix |
| Phase 5 returns `enabled: false, reason: 'parse_failure'` | Server returned unrecognised envelope shape | Verify server's adapter-compat endpoint returns `{result: {...}}` |
| Phase 5 returns `enabled: false, reason: 'validation_failed'` | Server returned a doctrine-violating packet | Check server logs; check ban-list scan; confirm prompt parity |
```

---

## §22 — Read-only API boundary list

### 22.1 MCP-SERVER-001 MAY modify (CDiscourse repo, bounded)

- New: `mcp-server/` (entire directory tree per §3.2)
- New: `docs/designs/MCP-SERVER-001.md` (this file)
- New: `docs/reviews/MCP-SERVER-001-review.md` (reviewer-authored later)
- New: `docs/deployment/mcp-server-001-runbook.md`
- New: `docs/audits/MCP-SERVER-001-smoke-template.md`
- New: `scripts/mcp-server-001-smoke.sh`
- New: `__tests__/mcpServerOnePresence.test.ts` (verifies runbook + smoke script + template + fixtures all exist with required sections)
- Bounded edit: append MCP-SERVER-001 section to `docs/core/current-status.md`
- Bounded edit (CONDITIONAL): `jest.config.*` to add `testPathIgnorePatterns: ['/mcp-server/']` IF Jest currently scans the new directory and finds nothing or errors

### 22.2 MCP-SERVER-001 MAY NOT modify

- Any existing MCP-018 adapter file (`supabase/functions/_shared/semanticReferee/mcpAdapter.ts`, `mcpAdapterCore.ts`, any sibling)
- Any MCP-021A taxonomy / schema / definition file (`src/features/nodeLabels/mcpBooleanObservationSchema.ts`, `machineObservationDefinitions/*`, `machineObservationRegistry.ts`, `nodeLabelTypes.ts`)
- Any MCP-021B persistence file (`supabase/migrations/20260526000018_*.sql`, `machineObservationPersistence*.ts`)
- Any MCP-021C-EDGE file (`supabase/functions/classify-argument-boolean-observations/*`, `supabase/functions/_shared/booleanObservations/*`)
- Any UX file (`UX-001.5A`, `UX-001.6`, anything under `src/features/nodeAnnotations/*`)
- Root `package.json` / `package-lock.json`
- Any Supabase migration
- Any existing Edge Function

---

## §23 — Conditional HALT trigger table (all 26)

| # | Trigger | Fired during Phase A? |
|---|---|---|
| 1 | Client-side MCP call proposed | NO — server is server-side only; client never sees URL/token |
| 2 | EXPO_PUBLIC_* MCP server URL proposed | NO — env vars are server-only (Deno Deploy) and Supabase function secrets |
| 3 | MCP credentials exposed to app/client | NO — two distinct trust boundaries; CDiscourse client has no MCP credentials |
| 4 | Server doesn't validate `Authorization: Bearer <token>` on /mcp | NO — bearer middleware required on every /mcp and /mcp/adapter-compat request |
| 5 | Server accepts invalid Origin header when Origin is present | NO — Origin validation when allow-list non-empty |
| 6 | Server logs raw prompt text, raw argument text, bearer, or model API key | NO — log forbidden-field list explicit; only hashes acceptable |
| 7 | Server returns model-generated free text as authoritative without schema validation | NO — outputSchema validation step 6 + ban-list scan step 7 |
| 8 | Server calls model provider before validating tool name + input schema match a registered tool | NO — input validation step 1 precedes model call step 4 |
| 9 | Enabling MCP-021A 172-key taxonomy | NO — `classify_argument_boolean_observations` is SCAFFOLDED, returns isError |
| 10 | Persisting classifier rows from this card | NO — server has no DB access |
| 11 | Display cap change / new UI | NO — server has no UI |
| 12 | New taxonomy key | NO — server consumes existing taxonomy as-is |
| 13 | Activating account UI "Coming later (MCP-018)" affordance | NO — that's ADMIN-MCP-001 |
| 14 | Implementing Family A classifier | NO — MCP-SERVER-002 territory |
| 15 | Cannot identify the exact MCP-018 adapter request/response shape | NO — extracted verbatim in §1.1 |
| 16 | Tool name for `classify_semantic_move` diverges | NO — verified verbatim against `MCP_CLASSIFY_TOOL_NAME` |
| 17 | Tool name for `classify_argument_boolean_observations` diverges | NO — verified verbatim against `MCP_BOOLEAN_OBSERVATION_TOOL_NAME` |
| 18 | Cannot resolve MCP lifecycle compatibility decision | NO — Option C resolved in §5 |
| 19 | Cannot identify canonical semantic-referee prompt source | NO — `seedPrompt.ts` + `anthropicClassifierCore.ts` per §14.1 |
| 20 | Server architecture not smoke-testable with curl + bash against localhost | NO — §17 + §19 demonstrate full smoke flow |
| 21 | Verdict/correctness/winner/fallacy/bad-faith language in any tool prompt, response field, audit template, runbook, or doc | NO — verified by ban-list scan in §20.4 + §15.3 forbidden fields |
| 22 | Hosting choice lacks one of: HTTPS, bearer auth, server-side credential storage, structured logging, timeout discipline | NO — Deno Deploy meets all 5 (§2.1 scorecard) |
| 23 | CDiscourse-side test count delta exceeds +300 | NO — only +10 to +30 presence tests forecast |
| 24 | Context window threshold (70%) | NO — under 50% at design completion |
| 25 | Interpretive judgment requires operator decision beyond brief | NO — defaults followed (Deno Deploy, co-located, Option C); deferred items in §24 ledger |
| 26 | Phase A reconciliation surfaces existing MCP-018 wiring materially different from brief assumptions | NO — wiring matches brief's Phase A.8 prediction (simplified envelope; brief Decision 11 default-C confirmed) |

**ALL 26 TRIGGERS: CLEAN.** Design proceeds.

---

## §24 — Brief ledger

This brief is **operator-authored** (the intent brief itself), so the orchestrator-authored ledger from POSTRUN-UX001 does not fully apply. Instead, this section records the binding factual extractions from Phase A audits and the design's deferred operator decisions.

### 24.1 MCP-018 adapter wire contract (verified verbatim against shipped code)

- **Tool name:** `classify_semantic_move` (`supabase/functions/_shared/semanticReferee/mcpAdapterCore.ts:38`)
- **Request envelope:** simplified `{tool, input}` shape (NOT JSON-RPC `tools/call`); see §1.1 for full shape
- **Request body builder:** `buildMcpToolRequestBody` (`mcpAdapterCore.ts:111-137`)
- **Response shapes accepted:** `{result: {...}}` / `{output: {...}}` / `{content: [...]}` (`extractMcpPacket` `mcpAdapterCore.ts:184-222`)
- **Env vars (verbatim):** `SEMANTIC_REFEREE_MCP_URL`, `SEMANTIC_REFEREE_MCP_TOKEN`
- **Request timeout:** 15_000ms (`MCP_REQUEST_TIMEOUT_MS` `mcpAdapterCore.ts:48`)

### 24.2 MCP-018 envelope shape (Phase A.8 binding)

**SIMPLIFIED compatibility envelope.** The shipped MCP-018 adapter does NOT speak full JSON-RPC `tools/call`. The body has no `jsonrpc`, no `id`, no `method`, no `params.name`. The tool name sits at the outer envelope.

### 24.3 MCP-021C-EDGE tool name (verified verbatim against shipped Edge Function code)

`classify_argument_boolean_observations` (`supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapterCore.ts:44-45`)

The MCP-021C-EDGE adapter wrapper sends the same simplified envelope shape as MCP-018 — confirmed by `buildBooleanObservationToolRequestBody` lines 118-137.

### 24.4 MCP-SERVER-001 endpoint decision

**Option C (both endpoints):**
- `/mcp` — official MCP Streamable HTTP / JSON-RPC 2.0 for future scalability
- `/mcp/adapter-compat` — MCP-018 + MCP-021C-EDGE simplified envelope for current callers

### 24.5 Exact JSON-RPC method names supported on `/mcp`

`initialize`, `notifications/initialized`, `tools/list`, `tools/call`, `ping`.

### 24.6 MCP protocol version targeted

`2025-11-25` (latest stable as of authoring; pinned in §11 and echoed in response headers).

### 24.7 GET /mcp on `/mcp`

**Returns 405 Method Not Allowed** in v1. Rationale: stateless request/response tools; no server-initiated push. Documented in §4.1 + §11.

### 24.8 Hosting platform chosen + cold-start budget

**Deno Deploy.** Cold-start budget: <2s p99 acceptable; typical 100-500ms for Deno Deploy.

### 24.9 Server location

**Co-located** under `mcp-server/`. Extraction to separate repo deferred until a second consumer.

### 24.10 Default model provider + model id (Phase A.9)

- **Provider:** Anthropic (Decision 13)
- **Default model id:** `claude-haiku-4-5` (`DEFAULT_SEMANTIC_REFEREE_MODEL`, `anthropicClassifierCore.ts:36`)
- **Override:** `ANTHROPIC_MODEL` env var on server
- **Optional pinned snapshot:** `claude-haiku-4-5-20251001`

### 24.11 Semantic-referee prompt source file path (Phase A.9 binding)

- Canonical user-prompt source: `supabase/functions/_shared/semanticReferee/seedPrompt.ts` (function `buildClassifierPrompt`; prompt version `mcp-semantic-referee-prompt-v2`)
- Canonical system-prompt source: `supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts` lines 51-70 (constant `SEMANTIC_REFEREE_SYSTEM_PROMPT`)
- Catalog source: `supabase/functions/_shared/semanticReferee/semanticClassifierCatalog.ts` (iterated by `buildClassifierPrompt`)

### 24.12 Fixtures: paths + derivation method

| Fixture | Derivation |
|---|---|
| `mcp-server/fixtures/classify-semantic-move.request.json` | Constructed to satisfy `buildMcpToolRequestBody`; values from `fixtures.ts['fixture-content-hash-mainline']` |
| `mcp-server/fixtures/classify-semantic-move.response.json` | Structural subset of `SEMANTIC_REFEREE_FIXTURES['fixture-content-hash-mainline']` (identity fields stripped) |
| `mcp-server/fixtures/classify-semantic-move.malformed-response.json` | Above + smuggled `verdict: "correct"` (fails outputSchema) |
| `mcp-server/fixtures/classify-argument-boolean-observations.request.json` | Constructed to satisfy `buildBooleanObservationToolRequestBody`; synthetic move + 1 family + 2 rawKeys |
| `mcp-server/fixtures/classify-argument-boolean-observations.scaffolded-response.json` | Documented `{isError: true, reason: "not_implemented", scaffoldedFor: "MCP-SERVER-002"}` envelope |

### 24.13 Test forecast

- **CDiscourse-side:** +10 to +30 presence tests (single new `__tests__/mcpServerOnePresence.test.ts`)
  - File-existence checks for runbook, smoke script (executable), audit template, all 5 fixtures
  - Runbook section presence (10+ required headings per §18.2)
  - Audit template section presence (5 phases per §21.2)
  - Smoke script header sanity (shebang, required arg parsing)
- **Server-side (OUTSIDE CDiscourse Jest budget):** ~50-80 Deno tests under `mcp-server/__tests__/` covering all §3.2 test files

### 24.14 Operator-deferred review items

Items the operator MAY want to revisit post-design, BEFORE the implementer begins:

1. **Hosting platform confirmation** — designer recommends Deno Deploy (default lean confirmed). Operator confirms or substitutes.
2. **Server location confirmation** — designer recommends co-located `mcp-server/`. Operator confirms or substitutes.
3. **Model id pinning policy** — designer defaults to alias `claude-haiku-4-5`. Operator decides whether prod pins to a dated snapshot (`claude-haiku-4-5-20251001`).
4. **Allowed-origins policy** — designer recommends pinning `MCP_SERVER_ALLOWED_ORIGINS` to the Supabase project URL at deploy time. Operator confirms.
5. **Default URL suffix for Supabase secret** — designer recommends `https://<deployed>/mcp/adapter-compat` (preserves MCP-018 + MCP-021C-EDGE unchanged). Operator confirms.
6. **Project name on Deno Deploy** — designer recommends `cdiscourse-mcp-server`. Operator chooses final name.
7. **CI/deploy workflow** — designer leaves CI out of scope for v1 (operator deploys manually via Deno Deploy dashboard). Operator may file a follow-up for automated deploy after first stable smoke.
8. **MCP-Protocol-Version version-pinning policy** — designer pins `2025-11-25` (latest at authoring). Operator confirms or pins to a different version.

### 24.15 Phase A audit summary

| Audit | Status | Key finding |
|---|---|---|
| Phase A.1 | CLEAN | Tool name `classify_semantic_move`; simplified envelope `{tool, input}`; env vars verified; timeout 15s |
| Phase A.2 | CLEAN | Tool name `classify_argument_boolean_observations`; same envelope shape |
| Phase A.3 | CLEAN | MCP spec `2025-11-25`; `/mcp` POST + 405 on GET; JSON-RPC 2.0 |
| Phase A.4 | CLEAN | Deno Deploy chosen (5/5 criteria met) |
| Phase A.5 | CLEAN | Co-located `mcp-server/` |
| Phase A.6 | CLEAN | `deno task dev` on port 8080; `.env.local` pattern; smoke script works against localhost |
| Phase A.7 | CLEAN | 5-phase template (local / hosted-deploy / hosted-smoke / Supabase / MCP-018-integration) with failure-reason interpretation table |
| Phase A.8 | CLEAN | Option C (both endpoints) — MCP-018 sends simplified envelope, not JSON-RPC `tools/call` |
| Phase A.9 | CLEAN | Prompt source `seedPrompt.ts` + `anthropicClassifierCore.ts`; model id `claude-haiku-4-5`; positive + malformed fixtures sourced |

---

## Doctrine self-check

| Doctrine | Constraint | How design respects it |
|---|---|---|
| cdiscourse-doctrine §1 | Score never blocks posting; no truth labels | Server returns advisory packet only; CDiscourse adapter hard-pins `authoritative: false`; all tool prompts ban verdict tokens (§14.1) |
| cdiscourse-doctrine §4 | AI moderator hard limits | Server is server-side only; no client-side AI; no truth value; no delete/hide/modify; tool descriptions explicitly state "STRUCTURAL questions only" |
| cdiscourse-doctrine §6 | Secrets policy | Two trust boundaries (CDiscourse↔server, server↔Anthropic); Anthropic key only on server; bearer constant-time compared; all forbidden fields listed (§15.3) |
| cdiscourse-doctrine §7 | No AI calls from production app | MCP server is operator-hosted, NOT part of Expo app bundle; CDiscourse client never sees server URL/token/model creds |
| cdiscourse-doctrine §10a | Observations vs Allegations | Server returns Observations only; tool name `classify_argument_boolean_observations` explicitly aligned with MCP-021A's Machine Observation taxonomy |
| test-discipline | Gate timeout handling | §16 documents two timeouts (30s request / 25s model); §19 smoke checks exit-code contract |
| supabase-edge-contract | No service-role in client | MCP server has no DB access; no service-role; Edge Function is the only authenticated client |

---

## Operator steps (post-merge, NOT part of this design)

This card is CODE-ONLY. The operator runs the smoke per §21 + the runbook in `docs/deployment/mcp-server-001-runbook.md`. No `npx supabase` command runs in this card's PR. The first MCP-server call is made by the operator after Phase 2 deploy + Phase 4 secret-set.

---

## End of design

Total sections: 24 + doctrine self-check + operator-steps note. All 26 HALT triggers CLEAN. All 9 Phase A audits documented. Design proceeds to implementer phase.
