# cdiscourse-mcp-server

Operator-hosted MCP server for CDiscourse.

## What this is

A Deno HTTP server that implements two endpoints over the Model Context Protocol (MCP) Streamable HTTP transport plus a back-compat envelope endpoint, fronting the existing semantic-referee Anthropic prompt:

- `GET /health` — uptime + capability ping (unauthenticated)
- `POST /mcp` — official MCP Streamable HTTP (JSON-RPC 2.0); bearer required
- `POST /mcp/adapter-compat` — simplified `{tool, input}` envelope used by the
  current MCP-018 + MCP-021C-EDGE adapters; bearer required

The simplified envelope is what the shipped Supabase Edge Function adapters
send today; the official `/mcp` endpoint exists so future callers (e.g.
Claude Desktop) can speak the spec without modification.

Server version: `0.1.0` (matches `deno.json`).
MCP spec version targeted: `2025-11-25`.

## Tools exposed

| Tool name | Status |
| --- | --- |
| `classify_semantic_move` | Implemented (calls Anthropic via the canonical seed prompt) |
| `classify_argument_boolean_observations` | Scaffolded — returns `{isError: true, reason: "not_implemented"}`; does NOT call Anthropic. Real implementation lands in MCP-SERVER-002. |

The server returns the structural-subset SemanticRefereePacket. Identity fields
(`packetVersion`, `promptVersion`, `provider`, `authoritative`, etc.) are
stamped by the CDiscourse-side `stampPacketIdentity` adapter — the server MUST
NOT emit them.

## Local development

```bash
cd mcp-server
cp .env.local.example .env.local
# Edit .env.local with your local-dev bearer + Anthropic key
deno task dev
# Server listens on http://localhost:8080
```

In another shell:

```bash
bash scripts/mcp-server-001-smoke.sh \
  --base-url http://localhost:8080 \
  --token <bearer-from-.env.local>
```

Expected: `9/9 PASS`, exit 0.

### Fixture provider for offline smoke

When `MCP_SERVER_USE_FIXTURE_PROVIDER=true` the server bypasses the real
Anthropic call and returns the fixture packet from
`fixtures/classify-semantic-move.response.json`. This lets the smoke script
exercise tool invocation without consuming live Anthropic tokens. Production
deploys MUST NOT set this flag.

## Tests

```bash
deno task test
```

Runs every test file under `mcp-server/tests/`. These tests are independent
of the CDiscourse Jest suite and do NOT count against the CDiscourse test
budget.

## Doctrine

- The server returns advisory, structural answers only. No truth labels,
  no winners, no verdicts.
- The Anthropic API key is held server-side ONLY. It is never logged,
  never echoed in any response body, never returned to the caller.
- The bearer token is constant-time compared. Neither the presented nor
  expected value is ever logged.
- Argument body text is NEVER logged. Prompt and response SHA-256 hashes
  are acceptable for debugging.

## Deployment

See `docs/deployment/mcp-server-001-runbook.md` (repo root). The runbook
covers Deno Deploy setup, env-var configuration, hosted smoke, Supabase
secrets wiring, and rollback.
