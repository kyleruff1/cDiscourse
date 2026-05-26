# MCP-SERVER-001 Design Intent Brief — Operator-hosted MCP Server Foundation

**Card:** MCP-SERVER-001 — Operator-hosted MCP Server Foundation and Contract Compatibility (minimal MCP-protocol-compliant server; MCP-018 wire compatibility; scaffolded boolean-observation tool; NO MCP-021A enablement; NO persistence writes; NO UI activation)
**Track:** MCP-SERVER-* (new track; distinct from MCP-021)
**Priority:** P0 / Urgent
**Effort:** M-L
**Filed:** 2026-05-26
**Author:** Operator-authored
**Status:** Binding for MCP-SERVER-001 designer phase. Stage 2 HALT is CONDITIONAL per autonomous-pipeline authorization.
**Predecessor evidence:** MCP-018 adapter shipped without server; MCP-021C-EDGE infrastructure shipped without live MCP path; current Supabase secrets confirm server has never been deployed
**Downstream cards (sequenced):** MCP-SERVER-001-SMOKE → ADMIN-MCP-001 → MCP-SERVER-002 → MCP-021C-EDGE-SMOKE → MCP-021C-FAMILY-A-PROD → MCP-SERVER-003+ / MCP-021C-FAMILY-B+ → OPS-MCP-OBSERVABILITY

---

## Why this brief exists

CDiscourse has been building the client side of an operator-hosted MCP integration across multiple cards:

- **MCP-018** shipped an Edge Function adapter that reads `SEMANTIC_REFEREE_MCP_URL` + `SEMANTIC_REFEREE_MCP_TOKEN` via `Deno.env.get()` and calls `classify_semantic_move` on a remote MCP server, validating the returned `SemanticRefereePacket` shape
- **MCP-021A** shipped the maximal 172-key boolean Machine Observation taxonomy + the pure-TS schema (`mcp-021.machine-observations.boolean.v1`) + the parser/sanitizer
- **MCP-021B** shipped durable persistence + RLS + Source 6 persisted-row adapter, verified end-to-end via the persisted-label smoke audit
- **MCP-021C-EDGE** shipped the server-side Edge Function spine (Family A first; admin validation mode; family-agnostic plumbing)

Each card correctly assumed a forthcoming operator-hosted MCP server existed. None of them was responsible for building that server. The gap is structural: the account UI's "Coming later (MCP-018)" affordance is the user-facing token of that gap; the missing Supabase secrets (`SEMANTIC_REFEREE_MCP_URL` + `SEMANTIC_REFEREE_MCP_TOKEN`) are the operational token.

MCP-SERVER-001 builds the missing upstream service.

---

## Central product rule

The operator-hosted MCP server is a separate, server-side, HTTPS-only, MCP-protocol-compliant service. It is not part of the CDiscourse app bundle. It is not part of Expo. It holds model-provider credentials (Anthropic API key) server-side only. The CDiscourse client never sees its URL, token, or model credentials.

The Supabase Edge Function layer is the ONLY authenticated client.

MCP-SERVER-001 ships the MINIMAL server. It does not ship the full 172-key boolean classifier. It ships MCP-018 wire compatibility (proves the protocol works end-to-end) and scaffolds the boolean-observation tool for MCP-SERVER-002 to flesh out.

---

## Binding decisions

### Decision 1 — New track, not a continuation of MCP-021

MCP-SERVER-* is a distinct track. MCP-021 describes the CLIENT side: taxonomy, schema, persistence, Edge Function runtime. MCP-SERVER-* describes the SERVER side: protocol, transport, tool implementations, credential isolation. They share a wire contract; they don't share a lifecycle.

The intent brief, design doc, review doc, deployment runbook, smoke script, and audit template all live under existing CDiscourse repo paths because that's where the operator manages card lifecycle. The server code itself may live in:

- (a) Co-located: a new top-level directory `mcp-server/` in this repo
- (b) Separate repo: standalone Git repository with its own CI

Designer's Phase A.5 decides between (a) and (b) and documents the choice. Default lean: **(a) co-located for MCP-SERVER-001 to ship fast; extract to (b) when a second consumer beyond CDiscourse needs the server**.

### Decision 2 — Three capabilities; nothing more

MCP-SERVER-001 ships exactly three server capabilities:

**Capability 1 — Health endpoint:** `GET /health` (or MCP-equivalent per spec). Returns:
- server version (semver)
- environment name ('local' | 'dev' | 'staging' | 'prod')
- supported tool names (array)
- whether provider credentials are configured (boolean; no value disclosed)
- timestamp

Not a model call. Cheap; safe to hit from monitoring; cheap smoke test.

**Capability 2 — `classify_semantic_move` tool:** MCP-018 wire compatibility. Accepts the exact request shape MCP-018's adapter sends. Returns the exact `SemanticRefereePacket` shape MCP-018's adapter validates. Designer Phase A.1 confirms both shapes from existing code; implementer commits fixtures derived from the actual adapter request builder.

**Capability 3 — `classify_argument_boolean_observations` tool (SCAFFOLDED, DISABLED):** Tool name registered with the MCP server. Schema metadata exposed via MCP `tools/list`. Tool invocation returns the documented error envelope: `isError: true, content: [{type: "text", text: "Tool scaffolded for MCP-SERVER-002; not yet implemented"}], structuredContent: {reason: "not_implemented", scaffoldedFor: "MCP-SERVER-002"}`.

Reason for scaffolding now: prove the server architecture supports both tool shapes (the existing semantic-referee packet AND the new MCP-021A boolean response) without another architecture pivot.

### Decision 3 — MCP Streamable HTTP transport with JSON-RPC 2.0

The server uses MCP's Streamable HTTP transport per the current spec. JSON-RPC 2.0 envelopes for all MCP messages.

Endpoint shape (default; designer Phase A.3 verifies against current MCP spec version):
- `POST /mcp` — JSON-RPC requests (tool calls, tools/list, initialize if applicable)
- `GET /mcp` — SSE stream OR 405 with documented rationale per Decision 11
- `GET /health` — non-MCP convenience endpoint

### Decision 4 — Bearer-token authentication on every MCP request

Every request to `/mcp` requires `Authorization: Bearer <token>` matching the server's configured `MCP_SERVER_BEARER_TOKEN`. Invalid or missing token returns HTTP 401 with a minimal JSON-RPC error envelope.

Health endpoint MAY be unauthenticated (designer Phase A decides; defensible either way). If unauthenticated, health MUST NOT leak environment-sensitive data (model name, provider details beyond a boolean `credentialsConfigured`). If authenticated, the smoke script handles the bearer.

### Decision 5 — Server-side model credentials only

The MCP server holds its own credentials for the model provider. These credentials are environment variables on the MCP server's host. They are NEVER:
- in the CDiscourse app bundle
- in the CDiscourse repo's `.env.example` or any env file
- in any Supabase function secret
- in any GitHub Actions environment
- in any user-readable Supabase Studio surface

The Supabase Edge Function authenticates to the MCP server with the bearer token. The MCP server authenticates to the model provider with its own credentials. Two distinct trust boundaries.

### Decision 6 — Hosting choice deferred to designer Phase A.4

Designer Phase A.4 compares at least:
- **Deno Deploy** — lowest conceptual drift from Supabase Edge Functions (also Deno); fast cold starts; bearer auth easy
- **Cloudflare Worker** — global edge; bearer auth easy; Workers KV for any state
- **Railway** — Node/Deno friendly; bearer auth easy; longer cold starts but supports persistent processes
- **Fly.io** — VM-style; full control; longer cold starts; bearer auth easy

Decision criteria (in order):
1. Server-side credential storage (all listed options pass)
2. HTTPS by default
3. Bearer auth implementable in <10 lines
4. Cold start latency acceptable for admin-trigger workflow (sub-2s acceptable for v1)
5. Cost (free tier sufficient for MCP-SERVER-001 smoke)
6. Operator's existing platform familiarity

Default lean: **Deno Deploy** for minimum drift from the Supabase Edge Function stack.

### Decision 7 — Smoke-testable with curl + bash against localhost first

The server MUST be smoke-testable with raw curl + bash against `http://localhost:<port>` before any host or Supabase dependency. This is the local-or-CI smoke that the deployment runbook documents.

Sequence:
1. `cd mcp-server && npm install && npm run dev` (or chosen runtime equivalent) starts the server on localhost
2. Set local env: `MCP_SERVER_BEARER_TOKEN`, `MODEL_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `MCP_SERVER_ENV=local`
3. `bash scripts/mcp-server-001-smoke.sh --base-url http://localhost:<port> --token <token>` exits 0 with all checks green
4. THEN: deploy to chosen host per runbook
5. THEN: re-run smoke against deployed URL
6. THEN: set Supabase function secrets
7. THEN: run integration smoke (MCP-SERVER-001-SMOKE audit)

The local smoke MUST pass before any hosted deployment instructions are considered complete.

### Decision 8 — Structured logging; no PII; no secrets

Server logs MUST include:
- request ID (correlation ID for tracing)
- timestamp
- tool name
- response time (ms)
- status (success / failure / timeout)
- error class if failure

Server logs MUST NOT include:
- bearer tokens
- model API keys
- raw prompt bodies (a SHA-256 hash of the prompt is acceptable for debugging)
- raw model responses (a hash of the response is acceptable)
- user identifiers from upstream callers
- argument body text or any room content

This protects the operator from accidentally logging sensitive content during prompt engineering iteration.

### Decision 9 — Timeout discipline

Server enforces:
- Per-request timeout: 30 seconds default (configurable via `MCP_SERVER_REQUEST_TIMEOUT_MS`)
- Per-tool-call upstream model timeout: 25 seconds default (configurable via `MCP_SERVER_MODEL_TIMEOUT_MS`)

If the upstream model exceeds the timeout, the server returns a structured timeout error matching the MCP error envelope spec. The Edge Function caller already handles timeouts (per MCP-018 adapter design).

### Decision 10 — Account UI "Coming later (MCP-018)" remains "coming later"

The account UI affordance is NOT activated by MCP-SERVER-001. It activates only after the full sequence:
1. MCP-SERVER-001 ships
2. MCP-SERVER-001-SMOKE post-merge audit passes
3. Supabase function secrets are set
4. MCP-018 routes through the live server
5. **ADMIN-MCP-001** card flips the affordance live

This sequencing keeps the user-facing affordance honest: it stays "coming later" until the path is operational end-to-end.

### Decision 11 — Protocol compliance surface

MCP-SERVER-001 MUST implement enough of the official MCP Streamable HTTP contract to interoperate with MCP-018's adapter AND with future MCP clients:

- Single MCP endpoint path, default `/mcp`
- JSON-RPC 2.0 request/response envelopes
- Supports `tools/list` (returns both tools' metadata)
- Supports `tools/call` (invokes the named tool with provided arguments)
- Validates `Authorization: Bearer <token>` on every `/mcp` request
- Validates `Origin` header when present; invalid origins return HTTP 403 with structured error
- Accepts `Accept: application/json, text/event-stream`
- Handles `MCP-Protocol-Version` header; target protocol version documented in the design ledger
- Returns `Content-Type: application/json` for non-streaming responses in v1
- MAY return HTTP 405 for `GET /mcp` (SSE) if streaming is not implemented in v1; the choice MUST be documented against the current spec

If the existing MCP-018 adapter is NOT currently protocol-complete (for example, if it posts a simplified tool-call body instead of a full initialize/tools/list/tools/call sequence), designer Phase A.8 MUST document the compatibility shim explicitly and decide:

- **A. strict official MCP endpoint only** — requires updating MCP-018 adapter (out of scope; defer to a future card)
- **B. MCP-018 compatibility endpoint only** — preserves current code but does not conform to MCP spec
- **C. both official `/mcp` and adapter-compat endpoint** — protects future scalability AND preserves current code

**Default: C (both endpoints) if Phase A.8 finds MCP-018 currently uses a simplified envelope.** If MCP-018 already speaks full official MCP, only `/mcp` is needed.

### Decision 12 — Structured tool output

`classify_semantic_move` MUST return the SemanticRefereePacket in `structuredContent` when called through official MCP `tools/call`. The response shape:

```json
{
  "content": [
    {"type": "text", "text": "<JSON-serialized SemanticRefereePacket>"}
  ],
  "structuredContent": { /* SemanticRefereePacket shape */ },
  "isError": false
}
```

The `content` text block preserves backward compatibility with MCP-018's existing extraction logic (which may parse the text block today). The `structuredContent` block exposes the typed schema for any future MCP client that uses `outputSchema` validation.

Tool definition for `classify_semantic_move` MUST include:
- `name`: `"classify_semantic_move"` (verbatim per Phase A.1)
- `title`: human-readable label
- `description`
- `inputSchema`: JSON schema matching the adapter's request body shape
- `outputSchema`: JSON schema matching SemanticRefereePacket

Tool definition for `classify_argument_boolean_observations` MUST include:
- `name`: per Phase A.2 (likely matches the Edge Function name; designer verifies)
- `title`
- `description`: includes "Scaffolded for MCP-SERVER-002; not yet implemented" explicitly
- `inputSchema`: JSON schema matching MCP-021A request shape
- `outputSchema`: JSON schema matching MCP-021A `McpBooleanObservationResponse` shape

The scaffolded boolean tool invocation returns:
```json
{
  "content": [
    {"type": "text", "text": "Tool scaffolded for MCP-SERVER-002; not yet implemented"}
  ],
  "structuredContent": {
    "reason": "not_implemented",
    "scaffoldedFor": "MCP-SERVER-002"
  },
  "isError": true
}
```

It MUST NOT produce fake boolean classifier output. It MUST NOT call the model provider. It MUST NOT consume model tokens.

### Decision 13 — Default model provider: Anthropic

Default provider for MCP-SERVER-001 is Anthropic, because:
- CDiscourse's existing semantic-referee track has Anthropic provider precedent
- The linked Supabase project already has `ANTHROPIC_API_KEY` configured
- MCP-018's adapter validates response shapes consistent with Anthropic-style structured output

The server MUST still expose a provider abstraction internally:
- `provider = "anthropic"` in v1
- Future providers (OpenAI, local models) can be added without changing tool contracts

Designer Phase A.9 verifies the exact model id to use (e.g., `claude-sonnet-4-5-20250929` or whichever is current). If the model id cannot be verified from existing semantic-referee prompt sources, ship with a runbook placeholder requiring operator confirmation before deployment. Do NOT default to a guessed model id.

---

## Required local run mode

Server MUST support local execution:

```
cd mcp-server
npm install   # or chosen-runtime equivalent
npm run dev   # or chosen-runtime equivalent
```

Local environment variables required:
- `MCP_SERVER_BEARER_TOKEN` — any non-empty value for local dev
- `MODEL_PROVIDER` — `"anthropic"` (Decision 13)
- `ANTHROPIC_API_KEY` (or provider-specific key) — operator's local dev key
- `MCP_SERVER_ENV` — `"local"`
- `MCP_SERVER_PORT` — optional; default 8080 (or chosen-runtime default)

Local smoke command:

```
bash scripts/mcp-server-001-smoke.sh --base-url http://localhost:8080 --token <token>
```

The local smoke MUST exit 0 with all checks green before any hosted deployment instructions are considered complete.

---

## Required production deliverables

1. **MCP server implementation** (location per Decision 1):
   - Implementation per Decision 6 hosting platform choice
   - All capabilities from Decision 2
   - Protocol compliance per Decisions 11 + 12
   - Bearer auth per Decision 4
   - Server-side credentials per Decision 5
   - Streamable HTTP transport per Decision 3
   - Structured logging per Decision 8
   - Timeout discipline per Decision 9
   - Local run mode per "Required local run mode" above

2. **Tool contract documentation** under `docs/designs/` or co-located with server code:
   - `classify_semantic_move` request/response JSON schemas (matching MCP-018 adapter)
   - `classify_argument_boolean_observations` request/response JSON schemas (matching MCP-021A wire contract)
   - Health endpoint response schema
   - MCP protocol version targeted

3. **Deployment runbook** at `docs/deployment/mcp-server-001-runbook.md`:
   - Step-by-step deployment to the chosen host
   - Environment variable setup on the host (model credentials, bearer token)
   - HTTPS configuration if not host-default
   - First-deploy verification with curl smoke
   - Bearer token rotation procedure
   - Logs access procedure
   - Supabase secret-setting instructions (`SEMANTIC_REFEREE_MCP_URL` + `SEMANTIC_REFEREE_MCP_TOKEN`)
   - Roll-back command (unset Supabase secrets to revert MCP-018 to dormant state)

4. **Local smoke script** at `scripts/mcp-server-001-smoke.sh`:
   - Accepts `--base-url` and `--token` arguments
   - Verifies health endpoint (200; required fields present; no secrets leaked)
   - Verifies `tools/list` returns both tool names
   - Verifies `classify_semantic_move` with a known fixture returns valid SemanticRefereePacket
   - Verifies `classify_argument_boolean_observations` returns the documented `isError: true, reason: "not_implemented"` envelope
   - Verifies bearer auth enforcement (request without bearer returns 401)
   - Exits 0 on all pass; non-zero with diagnostic on any fail
   - Runs against localhost OR deployed URL; same script

5. **Required fixtures** at `mcp-server/fixtures/` (or chosen path):
   - `classify-semantic-move.request.json` — generated from MCP-018's actual request-body builder output OR copied exactly from a test that already asserts it
   - `classify-semantic-move.response.json` — passes the MCP-018 adapter's SemanticRefereePacket validation
   - `classify-argument-boolean-observations.request.json` — matches MCP-021A wire contract (used by MCP-SERVER-002 when it implements the real tool)
   - `classify-argument-boolean-observations.scaffolded-response.json` — the documented "not yet implemented" envelope
   - Fixtures are deep-equal-checkable by the smoke script and the reviewer's verdict matrix

6. **Integration smoke template** at `docs/audits/MCP-SERVER-001-smoke-template.md`:
   - Operator copies to a dated audit doc post-merge
   - Phases:
     1. Server local smoke (operator runs `npm run dev` + smoke script)
     2. Server hosted deploy (operator deploys per runbook)
     3. Hosted smoke (smoke script against deployed URL)
     4. Supabase secrets set
     5. MCP-018 routes through server (operator triggers semantic-referee path; verifies real `SemanticRefereePacket` returns)
   - Verdict: PASS / PARTIAL / FAIL
   - Common failure_reason interpretations

7. **Bounded edits** in the CDiscourse repo:
   - Append MCP-SERVER-001 section to `docs/core/current-status.md`
   - Latest implementer card HTML comment block at top of current-status.md
   - NO changes to existing MCP-018 adapter files
   - NO changes to MCP-021A/B/C files
   - NO changes to UX files

8. **Tests** (split by location):
   - Server-side unit tests live with server code (e.g., `mcp-server/__tests__/`) — these use the server's own test runner (Deno test, Vitest, etc.); they do NOT count against CDiscourse's Jest test budget
   - Server-side tests cover: health endpoint shape; bearer auth enforcement; tool registration (both names); scaffolded tool returns documented error; timeout enforcement; Origin validation; protocol-version handling; both tools' input/output schema validation; fixture deep-equal checks
   - CDiscourse repo tests: presence tests only — verify runbook exists with required sections; verify smoke script exists and is executable; verify integration smoke template exists with required phases; verify fixtures exist with required JSON shape
   - CDiscourse-side test count delta forecast: +10 to +30 (presence tests only); if forecast exceeds +300, HALT (Trigger 23)

---

## Strict out of scope (any item HALTS)

1. Client-side MCP call (Trigger 1)
2. EXPO_PUBLIC_* MCP credentials (Trigger 2)
3. Exposing MCP credentials to app/client (Trigger 3)
4. Enabling MCP-021A 172-key taxonomy (Trigger 9)
5. Persisting classifier rows from this card (Trigger 10)
6. Display cap change / new UI (Trigger 11)
7. New taxonomy key (Trigger 12)
8. Activating account UI "Coming later (MCP-018)" affordance (Trigger 13)
9. Implementing Family A boolean classifier (Trigger 14; MCP-SERVER-002 territory)
10. Hosted deployment without operator authorization (Deployment Authority Rule)
11. Verdict/correctness/winner/fallacy/bad-faith language (Trigger 21)
12. Hosting choice lacking the 5 required properties (Trigger 22)
13. New package dependency in CDiscourse root (Dependency Boundary rule below)
14. Modification of MCP-018 adapter files
15. Modification of MCP-021A/B/C files
16. Modification of UX-001.5A or UX-001.6 files

---

## Dependency boundary

If server is co-located (Decision 1 option (a)):
- Server lives under `mcp-server/` with its own `package.json` or runtime config
- Dependencies in `mcp-server/package.json` are allowed
- Root `package.json` and root `package-lock.json` MUST NOT change

If the chosen runtime uses Deno:
- Dependencies imported through Deno-compatible module specifiers (e.g., `https://deno.land/std@<version>/...`) or a server-local config file (`deno.json`)
- Root app dependency graph remains untouched

If server is separate-repo (Decision 1 option (b)):
- Dependency choices live in the separate repo
- CDiscourse repo gets only runbook + smoke script + fixtures + presence tests + handoff doc

---

## Server test commands

If co-located, add to runbook:
- `mcp-server` local test command (e.g., `cd mcp-server && deno test` or `cd mcp-server && npm test`)
- Optional root script ONLY if it does NOT mutate root package deps:
  - `npm run test:mcp-server` may shell into `mcp-server` if it can be added via npm scripts without touching the dependency graph
- Reviewer MUST run both:
  1. Root app gates: typecheck/lint/`npm test`
  2. Server gates: `mcp-server` test command per runbook

If a root script would require root package modification, skip it and document the manual server test command in the runbook only.

---

## Read-only API boundaries (CDiscourse repo)

MCP-SERVER-001 MAY modify (CDiscourse repo, bounded):
- New: server code (if co-located) at `mcp-server/`
- New: `docs/designs/MCP-SERVER-001-intent.md` (this brief)
- New: `docs/designs/MCP-SERVER-001.md` (designer output)
- New: `docs/reviews/MCP-SERVER-001-review.md`
- New: `docs/deployment/mcp-server-001-runbook.md`
- New: `docs/audits/MCP-SERVER-001-smoke-template.md`
- New: `scripts/mcp-server-001-smoke.sh`
- New: server unit tests under `mcp-server/__tests__/` (if co-located)
- New: minimal `__tests__/mcpServerOnePresence.test.ts` (verifies runbook + smoke script + template + fixtures all exist with required sections)
- Bounded edit: append MCP-SERVER-001 section to `docs/core/current-status.md`

MCP-SERVER-001 MAY NOT modify:
- Any existing MCP-018 adapter file
- Any MCP-021A taxonomy / schema / definition file
- Any MCP-021B persistence file
- Any MCP-021C-EDGE file
- Any UX file
- Root `package.json` / `package-lock.json`
- Any Supabase migration
- Any existing Edge Function

---

## Designer required reading (in order)

1. `docs/designs/MCP-SERVER-001-intent.md` (this brief)
2. `docs/core/current-status.md` MCP-018 section
3. `supabase/functions/_shared/semanticReferee/mcpAdapter.ts` + `mcpAdapterCore.ts` (binding source for `classify_semantic_move` wire contract)
4. `docs/designs/MCP-021A.md` (boolean taxonomy + schema)
5. `src/features/nodeLabels/mcpBooleanObservationSchema.ts` (wire contract for the scaffolded boolean tool)
6. `docs/designs/MCP-021C-EDGE.md` (Edge Function caller; second tool's wire contract)
7. `supabase/functions/classify-argument-boolean-observations/` + `supabase/functions/_shared/booleanObservations/` (MCP-021C-EDGE's adapter wrapper; verifies the tool name expected from the server)
8. Any MCP-018 runbook in `docs/deployment/`
9. `docs/decisions/MCP-021C-edge-pivot.md` (motivating context)
10. Official Model Context Protocol specification at modelcontextprotocol.io (or successor official site): Streamable HTTP transport, tools spec, lifecycle/initialize spec, security considerations
11. Hosting platform docs for the chosen host (Deno Deploy, Cloudflare Worker, Railway, Fly, etc.)
12. Existing semantic-referee prompt sources (Phase A.9): any docs under `docs/designs/MCP-017*.md`, `docs/designs/MCP-018*.md`, any prompt constants in `supabase/functions/_shared/semanticReferee/`, test fixtures validating SemanticRefereePacket

---

## Required designer Phase A audits

**Phase A.1 — MCP-018 adapter wire contract extraction:**
- Read `mcpAdapter.ts` and `mcpAdapterCore.ts`
- Document: exact tool name called (`classify_semantic_move` verbatim verified)
- Document: exact request body shape sent (JSON-RPC envelope if used; otherwise the simplified body)
- Document: exact response shape expected (`SemanticRefereePacket` fields verbatim)
- Document: exact failure modes the adapter handles (timeout, parse fail, validation fail)
- Document: exact env var names read
- Document: the name of the request-body builder function (likely `buildMcpToolRequestBody` or similar)

**Phase A.2 — MCP-021C-EDGE adapter wrapper tool name:**
- Read MCP-021C-EDGE's Edge Function + shared booleanObservations modules
- Document: exact tool name MCP-021C-EDGE will call when secrets are set
- This becomes the second tool name in MCP-SERVER-001's scaffold and MCP-SERVER-002's full implementation

**Phase A.3 — MCP Streamable HTTP spec compliance:**
- Read the current MCP specification's transport section
- Confirm endpoint shape (POST + optional GET; SSE handshake if applicable)
- Confirm JSON-RPC 2.0 envelope expectations
- Confirm `Accept`, `Origin`, `MCP-Protocol-Version` header handling
- Document spec version targeted
- Document explicit rationale for any GET/SSE 405 decision

**Phase A.4 — Hosting platform comparison:**
- Compare Deno Deploy, Cloudflare Worker, Railway, Fly.io against the 5 decision criteria
- Recommendation with rationale
- Document chosen platform's bearer-auth pattern, env var setup, deploy command, logs access

**Phase A.5 — Server location decision (co-located vs separate repo):**
- Weigh Decision 1 (a) vs (b)
- Document the choice
- If (a) co-located, decide directory structure (`mcp-server/`) and how to keep server tests separate from CDiscourse's `__tests__/`
- If (b) separate repo, document new repo name, hosting, and how CDiscourse references it

**Phase A.6 — Local run mode design:**
- Verify `npm run dev` (or chosen-runtime equivalent) works
- Document local env vars
- Document local port default
- Confirm smoke script works against `http://localhost:<port>`

**Phase A.7 — Integration smoke template design:**
- Design post-merge MCP-SERVER-001-SMOKE template
- 5 phases per Decision 7 + Required Deliverable 6
- Common failure_reason interpretations table

**Phase A.8 — MCP lifecycle compatibility decision:**
- Determine whether MCP-SERVER-001 needs to implement `initialize` / `initialized` lifecycle messages for the chosen transport AND for MCP-018 compatibility
- If MCP-018 currently bypasses initialize and calls a tool directly, document the bypass as adapter-compatibility mode, NOT as the canonical MCP mode
- Decide between Decision 11 options A / B / C
- Acceptance criteria:
  - `tools/list` and `tools/call` work after `initialize` in official mode
  - MCP-018's current adapter call works unchanged in compatibility mode (if option B or C chosen)
  - Both modes (if option C) covered by tests OR smoke script fixtures

**Phase A.9 — Semantic-referee prompt source audit:**
- Identify the canonical prompt source for `classify_semantic_move`
- Candidates to inspect: semantic-referee seed prompt docs; MCP-017 / SMOKE-FIX prompt docs; current Edge Function provider prompt constants; test fixtures validating SemanticRefereePacket
- Document:
  - Prompt file path (the binding source of truth)
  - Model id (per Decision 13)
  - Response schema (SemanticRefereePacket)
  - One positive fixture (becomes `classify-semantic-move.response.json`)
  - One malformed-response fixture (used in server tests to verify schema validation rejects bad shapes)
  - Validation fallback behavior (what the server returns when the model returns a malformed response)
- If no canonical prompt source exists, HALT (Trigger 19). MCP-SERVER-001 cannot implement `classify_semantic_move` reliably without a canonical prompt contract.

If ANY of triggers 1-23 + 24-26 fires during Phase A, HALT immediately.

---

## Designer deliverable

Create `docs/designs/MCP-SERVER-001.md` with required sections:

1. Scope-reality audit (Phase A.1, A.2, A.3 findings consolidated)
2. Hosting choice (Phase A.4) + rationale
3. Server location decision (Phase A.5) + repo structure
4. MCP Streamable HTTP transport implementation (Decision 11)
5. MCP lifecycle compatibility decision (Phase A.8): option A / B / C with rationale
6. `classify_semantic_move` tool design (wire-compatible with MCP-018; structured tool output per Decision 12)
7. `classify_argument_boolean_observations` scaffold design (wire-compatible with MCP-021C-EDGE; documented "not yet implemented" error envelope per Decision 12)
8. Health endpoint design
9. Bearer auth design (including 401 envelope shape)
10. Origin validation design
11. MCP-Protocol-Version handling
12. Server-side credential handling
13. Default model provider: Anthropic (Decision 13); model id resolved from Phase A.9
14. Semantic-referee prompt source (Phase A.9 outcomes; prompt file path; positive + malformed fixtures)
15. Structured logging design (per Decision 8)
16. Timeout discipline (per Decision 9)
17. Local run mode (per "Required local run mode")
18. Deployment runbook outline
19. Local smoke script outline
20. Fixtures (request + response for both tools)
21. Integration smoke template outline (post-merge audit)
22. Read-only API boundary list
23. Conditional HALT trigger table (all triggers 1-23 + 24-26)
24. Brief ledger

---

## Brief ledger requirement

MCP-SERVER-001's design document MUST include a ledger naming:

- MCP-018 adapter wire contract (tool name, request shape, response shape, env var names — all verified verbatim against shipped code)
- MCP-018 envelope shape: official JSON-RPC `tools/call` OR simplified compatibility envelope (Phase A.8 binding)
- MCP-021C-EDGE tool name (verified verbatim against shipped Edge Function code)
- MCP-SERVER-001 endpoint decision: official `/mcp` only / adapter-compat only / both (Decision 11 + Phase A.8)
- Exact JSON-RPC method names supported
- MCP protocol version targeted
- Whether GET/SSE on `/mcp` is implemented OR intentionally returns 405 in v1 (with documented rationale)
- Hosting platform chosen + rationale + cold-start latency budget
- Server location (co-located vs separate repo)
- Default model provider: Anthropic; model id from Phase A.9
- Semantic-referee prompt source file path (Phase A.9 binding)
- Fixtures: paths + derivation method (generated from `buildMcpToolRequestBody` output OR copied from existing test)
- Operator-deferred review items

---

## Post-merge operator follow-up (NOT part of the pipeline)

After MCP-SERVER-001 merges, the operator runs MCP-SERVER-001-SMOKE:

**Phase 1 — Local smoke:**
1. `cd mcp-server && npm install && npm run dev` (or chosen-runtime equivalent)
2. Set local env (`MCP_SERVER_BEARER_TOKEN`, `ANTHROPIC_API_KEY`, etc.)
3. `bash scripts/mcp-server-001-smoke.sh --base-url http://localhost:<port> --token <token>`
4. Expected: all checks PASS

**Phase 2 — Hosted deploy:**
1. Follow `docs/deployment/mcp-server-001-runbook.md` to deploy to the chosen host
2. Set host-side env (model credentials, bearer token) per runbook
3. Note the deployed URL

**Phase 3 — Hosted smoke:**
1. `bash scripts/mcp-server-001-smoke.sh --base-url https://<deployed> --token <token>`
2. Expected: all checks PASS

**Phase 4 — Supabase secrets:**
1. `npx supabase secrets set SEMANTIC_REFEREE_MCP_URL=https://<deployed> --project-ref qsciikhztvzzohssddrq`
2. `npx supabase secrets set SEMANTIC_REFEREE_MCP_TOKEN=<token> --project-ref qsciikhztvzzohssddrq`
3. Verify: `npx supabase secrets list --project-ref qsciikhztvzzohssddrq | grep SEMANTIC_REFEREE_MCP`

**Phase 5 — MCP-018 integration:**
1. Trigger the existing semantic-referee path (per MCP-018 runbook)
2. Verify real `SemanticRefereePacket` returns from the Edge Function
3. Verify no `deterministic_fallback` outcomes on test calls

**Record results** in `docs/audits/MCP-SERVER-001-smoke-<date>.md` using the committed template.

**Verdict:**
- **PASS** (all 5 phases): MCP-SERVER-002 + ADMIN-MCP-001 are AUTHORIZED to file
- **PARTIAL** (server up, MCP-018 route works, but some diagnostic fails): document; decide between fix card vs ship MCP-SERVER-002 anyway
- **FAIL** (server doesn't deploy or MCP-018 route fails): file MCP-SERVER-001-FIX scoped to the specific defect

The pipeline does NOT auto-run the smoke — that requires operator credentials, host access, and Supabase secret-set privileges.
