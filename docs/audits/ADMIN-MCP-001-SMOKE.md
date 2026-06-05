# ADMIN-MCP-001 — semantic-referee `mcp` write-path end-to-end smoke

**Issue:** #477. **Operator-run.** Claude produced this four-phase skeleton; the
operator fills in every `<fill in>` and the per-phase + final verdicts after
running the live path. Claude makes NO provider call and is shown NO token / URL
/ packet body.

Audit-Lint: v1

**Audit doctrine.** This smoke verifies that an admin flipping the
semantic-referee provider to `CD - MCP Server` (`providerMode = 'mcp'`) results
in exactly one advisory referee packet reaching the operator-hosted MCP server's
`/mcp/adapter-compat` endpoint, and that the returned packet is advisory only
(`authoritative: false`), affects no score / standing / posting decision, and
leaks no MCP URL / token / hostname to the client. The write-path **code audit**
(all 7 layers PASS, autonomous `src/**`-only merge class) is recorded in
`docs/audits/ADMIN-MCP-001-WRITE-PATH-AUDIT.md`; this doc closes the live loop.

## Verdict

**TBD.** Fill in after running the four phases below.

## Hard rules honored

- No secrets / JWTs / bearer tokens / API keys / MCP URL / MCP token committed
  or pasted into this doc.
- No Edge Function code modified for this smoke (the write-path audit landed
  `src/**`-only; if the operator chose to apply the optional Layer 5 doctrine
  comment, that is a separate Edge-touching change with its own GATE C).
- No `mcp-server/` source change.
- The runtime config MAY be flipped to `mcp` for the smoke; record the original
  value first and restore it after if the operator does not intend `mcp` to
  remain the live provider.

---

## Phase 0 — Pre-flight + deploy verification

Git state at smoke start:

```
HEAD: <fill in commit SHA on main after the squash-merge>
Title: feat(ADMIN-MCP-001): autonomous Layers 1-3+7 audit + tests + smoke skeleton (#477)
```

Confirm the MCP secrets are set on the linked project (operator verifies via
SHA-256 digest — never printed):

```
SEMANTIC_REFEREE_MCP_URL    present: <yes/no>   digest matches expected: <yes/no>
SEMANTIC_REFEREE_MCP_TOKEN  present: <yes/no>   digest matches expected: <yes/no>
```

Record the current runtime config so it can be restored:

```sql
SELECT id, provider_mode, enabled, updated_at
FROM public.semantic_referee_runtime_config
WHERE id = true;
```

| Field | Value (before smoke) |
|---|---|
| `provider_mode` | `<fill in>` |
| `enabled` | `<fill in>` |

---

## Phase 1 — Admin flip to `mcp` persists (the write path)

**Setup:** Operator-authenticated admin session in the app.

**Action:** Open Admin → Semantic Referee. Confirm the provider selector shows a
selectable **CD - MCP Server** row (not disabled, no "Coming later" copy). Tap
it. It should apply **one-click** — no Anthropic-style confirmation panel.

**Verify (UI):**
- The status card shows `Provider mode: CD - MCP Server`.
- The success note reads `Provider mode is now CD - MCP Server.`.

**Verify (DB):**

```sql
SELECT provider_mode, enabled, updated_by, updated_at
FROM public.semantic_referee_runtime_config
WHERE id = true;
```

Expected: `provider_mode = 'mcp'`; `updated_by` = the admin's user id;
`updated_at` later than Phase 0.

**Verify (audit row):**

```sql
SELECT actor_user_id, previous_mode, new_mode, previous_enabled, new_enabled, created_at
FROM public.semantic_referee_config_audit
ORDER BY created_at DESC
LIMIT 1;
```

Expected: `new_mode = 'mcp'`; `previous_mode` = the Phase 0 value.

**Phase 1 verdict:** `<PASS | PARTIAL | FAIL>`.

---

## Phase 2 — One referee call reaches `/mcp/adapter-compat`

**Setup:** `provider_mode = 'mcp'`, `enabled = true`. A debate room with a move
that satisfies the semantic-referee trigger gates.

**Action:** Post (or re-trigger) one move that fires the advisory referee.

**Verify (Edge logs — `semantic-referee` function):** exactly one structured log
line for the call, showing the provider resolved to `mcp` and the adapter
dispatched. Record one **redacted** sample (NO URL, NO token, NO Authorization,
NO raw packet body):

```json
{
  "event": "<fill in>",
  "provider": "mcp",
  "outcome": "<packet | unavailable>",
  "reason": "<fill in if unavailable>",
  "latency_ms": "<fill in>"
}
```

**Verify (MCP server logs):** one inbound request to `POST /mcp/adapter-compat`
correlated in time with the Edge dispatch.

```
mcp-server request: POST /mcp/adapter-compat   status: <fill in>   at: <fill in>
```

**Phase 2 verdict:** `<PASS | PARTIAL | FAIL>`.

---

## Phase 3 — The packet is advisory only (doctrine)

**Verify** the returned/persisted packet (whichever surface the operator can
inspect):
- `authoritative` is `false` (the Edge `mcpAdapter.ts` hard-pins this; confirm
  the live value matches).
- No score, standing band, or posting decision changed as a result of the
  packet. The move posted regardless; validation, not the referee, is the only
  thing that can block.
- The packet carries no truth/winner/loser verdict language (the content-safety
  scan wall is `contentSafetyScan.ts`; confirm the live packet rendered through
  the normal plain-language path, no raw classifier ids).

**Phase 3 verdict:** `<PASS | PARTIAL | FAIL>`.

---

## Phase 4 — Client leak re-check + restore

**Verify (client leak):** with the live `mcp` path exercised, confirm the client
never saw the MCP URL / token / hostname / `/mcp/adapter-compat` path. The
static wall is `__tests__/adminMcpClientLeakScan.test.ts` +
`__tests__/semanticMcpSourceScan.test.ts`; spot-check the running app's network
panel shows only the `admin-users` / `semantic-referee` Edge endpoints (the
project Supabase URL), never the MCP host.

```
network panel hosts observed (redact project ref if needed): <fill in>
MCP host observed in client traffic: <expected: NO>
```

**Restore (if `mcp` was a smoke-only flip):**

```sql
UPDATE public.semantic_referee_runtime_config
SET provider_mode = '<Phase 0 value>', enabled = <Phase 0 value>
WHERE id = true;
```

**Phase 4 verdict:** `<PASS | PARTIAL | FAIL>`.

---

## Conclusion

`<Fill in: overall PASS / PARTIAL / FAIL and a one-line summary. PASS requires
Phase 1 + Phase 2 + Phase 3 all PASS; Phase 4 leak re-check NO-leak.>`

## Operator follow-up

- If all phases PASS: the `mcp` semantic-referee provider write path is verified
  end to end; close #477.
- If Phase 2 FAILs (no request reached `/mcp/adapter-compat`): re-confirm the
  MCP secrets (Phase 0 digests) and the resolver wiring
  (`providerRoutingCore.ts:141-150`); file a fix card if the resolver path is
  the cause.
- If Phase 3 FAILs (packet not advisory): STOP — this is a doctrine breach; file
  a P0 fix card and flip `provider_mode` back off the `mcp` path.
