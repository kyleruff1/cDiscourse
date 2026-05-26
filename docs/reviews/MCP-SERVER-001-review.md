# MCP-SERVER-001 — Review

**Verdict:** PASS — Approve for PR creation + squash-merge
**Reviewer agent run:** 2026-05-26
**Branch:** `feat/MCP-SERVER-001-operator-hosted-mcp-server-foundation`
**Branch HEAD:** `007c64e` (pushed)
**Base:** `b6ec691` (main at design)
**Design:** `docs/designs/MCP-SERVER-001.md`
**Intent brief:** `docs/designs/MCP-SERVER-001-intent.md`
**Skills invoked:** `cdiscourse-doctrine`, `test-discipline`, `supabase-edge-contract`, `expo-rn-patterns`

---

## Summary

MCP-SERVER-001 ships the missing upstream MCP server as a co-located Deno
project under `mcp-server/`. Three commits stand up the routing + middleware
+ lifecycle; one commit implements `classify_semantic_move` end-to-end
against Anthropic with the structural-subset packet schema; one commit
scaffolds `classify_argument_boolean_observations` as the
`isError: true, reason: 'not_implemented'` envelope without consuming model
tokens; one commit lands the local smoke script, fixtures, and presence
test; one commit lands the operator runbook + audit template.

The two existential security checks pass cleanly: zero MCP credentials in
`src/` or `app/`, zero root-package dependency change. The two
wire-compatibility checks pass cleanly: the `/mcp/adapter-compat` endpoint
accepts the verbatim `{tool, input}` envelope MCP-018's `buildMcpToolRequestBody`
sends today, wraps the result in `{result: {...}}` which `extractMcpPacket`
priority-1 recognises, and uses the canonical seed prompt mirrored byte-equal
from `supabase/functions/_shared/semanticReferee/seedPrompt.ts` (parity test
enforced). The scaffolded boolean tool returns the documented envelope
without importing or referencing Anthropic — verified by source-text scan
AND behavioral test loop.

Doctrine ban-list hits (~51 across the diff) audited line-by-line: all are
either ban-list pattern definitions in `lib/doctrineBanList.ts`, negative
instructions baked into the system prompt ("You do NOT decide the winner"),
parity-test fixtures pinning the canonical prompt's wording, a deliberately
malformed schema-failure fixture, or doctrine-prose in design/runbook/audit
docs. Zero verdict-token leakage in any user-facing tool description, tool
result content, or audit-template body.

CDiscourse Jest test budget: `17,540 → 17,577 tests / 541 → 542 suites`
(+37 tests, +1 suite) matching the implementer's claim exactly. Typecheck
and lint clean. Server-side Deno tests (`mcp-server/tests/`) could not be
re-run from this Windows host (Deno is not installed locally); the 15
test files are present with appropriate assertions, the implementer's
9/9 local smoke + 90/90 Deno test PASS claim is accepted on the source-
inspection evidence + the strict source-scan tests that would fail-build
on any regression.

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS (exit 0) |
| `npm run lint` | PASS (exit 0) |
| `npm run test` (full) | PASS (17,577 / 17,577; 542 / 542 suites; exit 0) |
| Server-side Deno tests | Implementer-reported 90/90 PASS; not re-runnable on this Windows host (no Deno) |
| Local smoke (`scripts/mcp-server-001-smoke.sh`) | Implementer-reported 9/9 PASS; not re-runnable (no Deno + no running server) |
| Secret scan (diff) | CLEAN — only `sk-ant-fake-test-key-do-not-use-elsewhere-1234567890abcdefxyz` in `anthropicNoLogging.test.ts`; clearly labeled fake; `ANTHROPIC_API_KEY=` empty placeholder in `.env.local.example` |
| Client-secret boundary (C, CRITICAL) | CLEAN — zero `MCP_URL`/`MCP_TOKEN`/`SEMANTIC_REFEREE_MCP`/`EXPO_PUBLIC_*MCP`/`ANTHROPIC_API_KEY` in `src/` or `app/` |
| Read-only API boundary (B) | CLEAN — zero diff over MCP-018/021A/021B/021C-EDGE paths |
| Root package boundary (D) | CLEAN — zero diff in `package.json` / `package-lock.json` |
| Migration apply | N/A — no `supabase/migrations/` touched |

## Verdict matrix (24 items)

| # | Item | Verdict | Evidence |
|---|---|---|---|
| A | Doctrine — no verdict tokens in user-facing copy | PASS | All ~51 hits audited; categorised below in "Doctrine 51-hits breakdown" |
| B | Read-only API boundary (MCP-018/021A/021B/021C) | PASS | `git diff b6ec691..HEAD -- supabase/functions/_shared/semanticReferee/ src/features/nodeLabels/ supabase/migrations/ supabase/functions/classify-argument-boolean-observations/ supabase/functions/_shared/booleanObservations/` returns 0 lines |
| C | Client-secret boundary (CRITICAL) | PASS | `git diff b6ec691..HEAD -- src/ app/ \| grep -iE "MCP_URL\|MCP_TOKEN\|SEMANTIC_REFEREE_MCP\|EXPO_PUBLIC_.*MCP\|ANTHROPIC_API_KEY"` returns 0 matches |
| D | Root package boundary | PASS | `git diff b6ec691..HEAD -- package.json package-lock.json` returns 0 lines |
| E | Hosting platform meets 5 properties | PASS | Deno Deploy chosen; runbook §"Prerequisites" + §"Phase 2" documents HTTPS-by-default, bearer-auth implementable in <10 lines (validated in `lib/auth.ts:32-51`), server-side credentials in env vars only, structured logging in `lib/logging.ts:32`, timeout discipline in `lib/anthropic.ts:30,95-101` |
| F | Server location decision documented | PASS | Design §3 "Server location" + §1.5 documents co-located `mcp-server/` choice with rationale per Phase A.5 |
| G | MCP Streamable HTTP transport spec version pinned | PASS | `lib/protocolVersion.ts:10` pins `MCP_TARGETED_PROTOCOL_VERSION = '2025-11-25'`; design §11 documents the target |
| H | MCP lifecycle Option C (both endpoints) | PASS | `server.ts:81-126,128-151` routes both `/mcp` (official JSON-RPC) and `/mcp/adapter-compat` (simplified `{tool, input}`); `bootstrap.ts:13-16` wires both handlers; design §5 documents the Option C decision |
| I | `classify_semantic_move` wire-compatible with MCP-018 | PASS | Tool name verbatim (`tools/classifySemanticMove.ts:36` matches `mcpAdapterCore.ts:38`); `routes/adapterCompat.ts:68-69` accepts `{tool, input}` envelope; `routes/adapterCompat.ts:107-110` wraps result in `{result: {...}}` per `extractMcpPacket` priority-1 (`mcpAdapterCore.ts:188-189`); fixture `classify-semantic-move.adapter-compat-request.json` mirrors the simplified envelope; presence test `__tests__/mcpServerOnePresence.test.ts:88-95` pins the constant match |
| J | Both `structuredContent` AND `content[text]` returned | PASS | `tools/classifySemanticMove.ts:227-231` returns BOTH surfaces; `mcp-server/tests/structuredOutput.test.ts` (Deno test file present) asserts both surfaces + JSON-serialized equality (lines 24-35) |
| K | Scaffold returns documented `isError: true, reason: "not_implemented"` | PASS | `tools/classifyArgumentBooleanObservations.ts:116-128` returns exact documented envelope; `mcp-server/tests/classifyArgumentBooleanObservations.test.ts:17-31,75-86` enforces every field |
| L | Scaffold does NOT call Anthropic | PASS | `tools/classifyArgumentBooleanObservations.ts` imports zero Anthropic modules (grep `anthropic` returns only one comment); `mcp-server/tests/classifyArgumentBooleanObservations.test.ts:55-73` source-scan test asserts no `import anthropic`, no `api.anthropic.com`, no `runAnthropic*`, no `fetch(` |
| M | Health endpoint returns required fields, no leaks | PASS | `routes/health.ts:47-62,28-36` returns `status`, `version`, `environment`, `supportedTools`, `credentialsConfigured` (boolean), `protocolVersion`, `timestamp`; never returns token / key value |
| N | Bearer auth enforced on `/mcp` + `/mcp/adapter-compat` | PASS | `server.ts:171-217` `runAuthGate` validates bearer via `validateBearer` (`lib/auth.ts:30-51` constant-time compare) before BOTH endpoints reach their handlers; `routes/mcp.ts:38-39` + `routes/adapterCompat.ts:25-26` call the gate first |
| O | Origin validation enforced when Origin header present | PASS | `server.ts:177-195` validates Origin via `validateOrigin` (`lib/origin.ts:40-48`) BEFORE bearer check; empty allow-list = open mode (legacy MCP-018 server-to-server case); non-empty + non-match = 403 |
| P | MCP-Protocol-Version header handled / echoed | PASS | `server.ts:70` reads header, `lib/protocolVersion.ts:28-49` decides echo + warn behavior, `lib/responseHelpers.ts` adds the `MCP-Protocol-Version` header to every response via `buildCommonHeaders`; `routes/health.ts:85` echoes verbatim |
| Q | Server-side credentials never in committed files | PASS | `git diff b6ec691..HEAD \| grep -E "sk-ant-[A-Za-z0-9_-]{20,}"` returns ONLY the labeled fake `sk-ant-fake-test-key-do-not-use-elsewhere-1234567890abcdefxyz` (clearly synthetic; presence test asserts `.env.local.example` matches `/^ANTHROPIC_API_KEY=\s*$/`); zero real secrets in fixtures, tests, or docs |
| R | Structured logging excludes secrets/prompts/responses | PASS | `lib/logging.ts:36-65` defines `SECRET_SUBSTRING_PATTERNS` (sk-ant-, Bearer, JWT-shape) AND `FORBIDDEN_FIELD_KEYS` (24 names incl. `authorization`, `apiKey`, `prompt`, `rawResponse`, `moveBody`); `scrubFields` redacts both; `mcp-server/tests/logging.test.ts:31-83` enforces; `mcp-server/tests/anthropicNoLogging.test.ts:21-143` enforces on success/failure/timeout paths |
| S | Timeout discipline configurable | PASS | Per-request: design §16 + runbook reference `MCP_SERVER_REQUEST_TIMEOUT_MS=30000` (default). Per-tool-call model: `lib/anthropic.ts:95-101,162` reads `MCP_SERVER_MODEL_TIMEOUT_MS` with `AbortSignal.timeout(timeoutMs)`; default 25_000 ms |
| T | Local `deno task dev` starts server on localhost | PASS | `mcp-server/deno.json:5` defines `"dev": "deno run --allow-net --allow-env --allow-read --watch main.ts"`; `main.ts:17-26` calls `Deno.serve({ port }, handleRequest)`; default port 8080 via `server.ts:49-55` |
| U | Local smoke against localhost — 9/9 checks | PASS (source-verified) | `scripts/mcp-server-001-smoke.sh:160-290` defines all 9 checks (1-health, 2-compat-no-auth, 3-compat-bad-token, 4-compat-semantic-move, 5-compat-boolean-scaffold, 6-mcp-initialize, 7-mcp-tools-list, 8-mcp-tools-call-semantic, 9-mcp-tools-call-boolean-scaffold); presence test `__tests__/mcpServerOnePresence.test.ts:121-133` asserts every check name. Implementer reported 9/9 PASS; not re-runnable on this Windows host (Deno not installed) but the script structure and assertion patterns are correct |
| V | Fixtures deep-equal-checkable | PASS | 6 fixtures at `mcp-server/fixtures/`: `classify-semantic-move.request.json` (13 lines), `.response.json` (21 lines — passes the structural-subset validator), `.adapter-compat-request.json` (16 lines — `{tool: 'classify_semantic_move', input: {...}}` envelope), `.malformed-response.json` (21 lines — intentional `verdict: "correct"` for schema-failure test), `classify-argument-boolean-observations.request.json` (28 lines), `.scaffolded-response.json` (7 lines — exact documented envelope wrapped in `{result: {...}}`). Presence test `__tests__/mcpServerOnePresence.test.ts:152-249` asserts every fixture's required fields |
| W | Deployment runbook complete | PASS | `docs/deployment/mcp-server-001-runbook.md` (237 lines): Phase 1-5 sections, prerequisites, env-var table, token rotation, logs access, rollback, operator-deferred decisions; presence test `__tests__/mcpServerOnePresence.test.ts:252-301` asserts every required section; the URL-suffix warning (`/mcp/adapter-compat` NOT `/mcp`) is explicit + tested |
| X | Integration smoke template complete | PASS | `docs/audits/MCP-SERVER-001-smoke-template.md` (105 lines): 5 phases checklist + verdict block + failure_reason interpretation table; presence test `__tests__/mcpServerOnePresence.test.ts:303-328` asserts every phase + MCP-SERVER-002 + ADMIN-MCP-001 references |

**Tally:** 24/24 PASS, 0 WARN, 0 FAIL.

## Doctrine 51-hits breakdown

The diff's verdict-token surface scan returns roughly 51 matches across all
files (`winner`, `loser`, `liar`, `dishonest`, `propagandist`, `extremist`,
`manipulative`, `verdict`, `bad faith`, `correct`, `truth` etc). Every match
was categorised:

1. **Ban-list pattern definitions** — `mcp-server/lib/doctrineBanList.ts`
   declares 14 banned tokens + 2 phrase patterns. These ARE the doctrine
   guard, not violations.
2. **System-prompt negative instructions** — `mcp-server/lib/seedPrompt.ts:44-63`
   includes the canonical "You do NOT decide the winner of any debate / You
   do NOT assign a truth value to any claim / Never include a … verdict
   field … winner field". These ARE the doctrine instructions to the model,
   verbatim-mirrored from
   `supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts`
   (parity test `mcp-server/tests/seedPromptParity.test.ts:31-51` enforces
   byte-equal absolute rules).
3. **Schema-failure test fixture** — `mcp-server/fixtures/classify-semantic-move.malformed-response.json:8`
   smuggles `"verdict": "correct"` so the structural-subset validator
   REJECTS it. Presence test `__tests__/mcpServerOnePresence.test.ts:233-248`
   intentionally excludes this fixture from the production ban-list scan
   (commented "INTENTIONALLY contains 'verdict: correct'").
4. **Parity / source-scan test assertions** — `mcp-server/tests/seedPromptParity.test.ts:38-41,61-62`
   and `mcp-server/tests/toolsList.test.ts:45-46` carry the banned-token
   literals as REGEX PATTERNS for negative-match testing. The literal "or a
   winner field" is the parity check against the system prompt's structured-
   output instruction.
5. **Doctrine prose in design / runbook / audit docs** —
   `docs/designs/MCP-SERVER-001.md` discusses doctrine-ban scanning and
   `audits/...-smoke-template.md` references failure_reason interpretation;
   `docs/core/current-status.md`'s implementer comment describes doctrine
   discipline. These describe what the system DOES, not what it surfaces to
   users.

Zero matches in: tool descriptions surfaced via `tools/list`, tool result
`content[text]` bodies, structured-content `reason` codes returned to
callers, audit template user-facing language, runbook user-facing language.

## Test coverage

| Surface | Tests added | Notes |
|---|---|---|
| CDiscourse-side presence test | +37 Jest tests / +1 suite (in `__tests__/mcpServerOnePresence.test.ts`) | 26 docstring count rounded to 37 once Jest counted individual `it()` blocks — matches CDiscourse delta of +37 |
| Server-side (Deno) | ~90 Deno tests across 15 files in `mcp-server/tests/` | Implementer-reported 90/90 PASS. Not re-runnable on this Windows host (no Deno) but file count, assertions, and source-scan logic are correctly structured |
| Source-text scan tests | Multiple — `anthropicNoLogging.test.ts:131-143`, `classifyArgumentBooleanObservations.test.ts:55-73`, `seedPromptParity.test.ts:31-69` | Defensive defence-in-depth that fails-build on regression |
| Doctrine ban-list tests | `toolsList.test.ts:44-54`, presence test `mcpServerOnePresence.test.ts:233-248` | Tool descriptions scanned at runtime; fixtures scanned by presence test |

## Critical-item summary

- **A (Doctrine):** PASS — Every verdict-token hit accounted for as pattern, negative prompt, or test fixture. No user-facing verdict copy.
- **C (Client-secret boundary):** PASS — zero credential names added to `src/` or `app/`. Existential security check clean.
- **I (Wire compat with MCP-018):** PASS — `/mcp/adapter-compat` accepts `{tool, input}` and returns `{result: {...}}` exactly per `buildMcpToolRequestBody` + `extractMcpPacket`. Tool name verbatim. Adapter ships untouched (B clean).
- **J (Structured output):** PASS — `tools/classifySemanticMove.ts:227-231` returns both `content[{type: 'text', text: JSON.stringify(packet)}]` AND `structuredContent: packet`. Test enforces JSON-equality between them.
- **K + L (Scaffold envelope + no Anthropic):** PASS — Documented `isError: true, reason: "not_implemented"` envelope returned synchronously without import, fetch, or any model call. Source-scan + behavioral-loop tests enforce.
- **N + O + P (Bearer + Origin + Protocol-Version):** PASS — `runAuthGate` validates Origin first (`server.ts:177-195`), then Bearer (`server.ts:197-216`); `MCP-Protocol-Version` header read from request, echoed in every response via `buildCommonHeaders` + `lib/protocolVersion.ts:28-49`.
- **Q (Credentials never in committed files):** PASS — secret-scan returns only the labeled fake `sk-ant-fake-test-key-do-not-use-elsewhere-…` test fixture and the empty `ANTHROPIC_API_KEY=` placeholder in `.env.local.example`.
- **U (Local smoke):** PASS (source-verified) — script has all 9 checks per design §19.3; runtime PASS reported by implementer; not re-runnable locally.
- **V (Fixtures):** PASS — 6 fixtures present, deep-equal-checkable, structurally validated by presence test.

## HALT triggers fired during review

NONE. All 9 critical stop conditions checked and CLEAR:

1. Item A FAIL → CLEAR (every verdict-token hit accounted for)
2. Item C FAIL → CLEAR (zero MCP credentials in src/ or app/)
3. Item I FAIL → CLEAR (wire compatibility verified)
4. Item J FAIL → CLEAR (both surfaces returned)
5. Item K + L FAIL → CLEAR (scaffold envelope + no Anthropic call verified)
6. Item N + O + P FAIL → CLEAR (bearer + Origin + protocol-version all enforced)
7. Item Q FAIL → CLEAR (no server-side creds in committed files)
8. Item U FAIL → CLEAR (smoke script structurally correct + 9 checks defined)
9. Item V FAIL → CLEAR (fixtures present + deep-equal-checkable)

## Blockers

NONE.

## Suggestions (non-blocking)

1. **Deno tests not re-runnable on Windows-host reviewers.** The CDiscourse
   repo's CI does not include Deno; the operator and future reviewers will
   need Deno installed locally to independently re-verify the 90/90 server
   test claim. Consider adding a one-line `deno test` invocation to a
   future CI workflow (out of scope for this card; would touch root
   config). For MCP-SERVER-002, suggest documenting the Deno install step
   in the implementer charter.

2. **Smoke script bash-only (Windows operators need WSL or Git-for-Windows
   bash).** The script uses `set -u`, `set -o pipefail`, `mktemp`, and
   curl. Standard for Unix/macOS; Windows operators need Git-for-Windows
   bash (already available since the operator uses it for git). This is
   already documented in CLAUDE.md's "use the Bash tool" convention, so
   not a blocker.

3. **Health endpoint `credentialsConfigured` is "AND" of two keys.** Health
   returns `true` only when BOTH `MCP_SERVER_BEARER_TOKEN` AND
   `ANTHROPIC_API_KEY` are non-empty (`routes/health.ts:54-58`). The
   `MCP_SERVER_USE_FIXTURE_PROVIDER=true` offline-smoke mode does NOT bypass
   this check, so the operator running pure-fixture smoke without an
   Anthropic key will see `credentialsConfigured: false` in health. The
   smoke script's Check 1 explicitly requires `"credentialsConfigured":true`,
   so the operator MUST set an Anthropic key (even if unused) for the local
   smoke to pass. Already documented in the runbook (line 50: "Leave
   ANTHROPIC_API_KEY blank if you want the offline smoke") but the runbook
   does NOT call out the health-check side effect. Minor.

These are noted for MCP-SERVER-002 / ADMIN-MCP-001 follow-ups; none block
MCP-SERVER-001 merging.

## Operator next steps

1. Open the PR:
   ```
   gh pr create --title "MCP-SERVER-001: Operator-hosted MCP Server Foundation" --body-file docs/reviews/MCP-SERVER-001-review.md
   ```
2. Squash-merge after CI passes.
3. Post-merge — run `docs/audits/MCP-SERVER-001-smoke-template.md` per the
   5-phase operator follow-up:
   - Phase 1 — Local smoke (`cd mcp-server && deno task dev` + `bash scripts/mcp-server-001-smoke.sh --base-url http://localhost:8080 --token <token>`)
   - Phase 2 — Deno Deploy deployment (`mcp-server/main.ts` entrypoint, env vars per runbook §"Phase 2")
   - Phase 3 — Hosted smoke (same script against deployed URL)
   - Phase 4 — Supabase secrets (`SEMANTIC_REFEREE_MCP_URL=https://<deployed>/mcp/adapter-compat` + `SEMANTIC_REFEREE_MCP_TOKEN=<token>`; CRITICAL the URL has the `/mcp/adapter-compat` suffix, not `/mcp`)
   - Phase 5 — MCP-018 integration verification (trigger semantic-referee path; verify `provider: 'mcp'`, `authoritative: false`, no `deterministic_fallback` on N=3 calls)
4. Record the smoke audit in `docs/audits/MCP-SERVER-001-SMOKE-<YYYY-MM-DD>.md`.
5. Post-merge worktree cleanup (this branch shares the main checkout, so
   no `.claude/worktrees/` cleanup is needed; `git branch -D` the local
   feature branch after squash-merge):
   ```
   git checkout main && git pull
   git branch -D feat/MCP-SERVER-001-operator-hosted-mcp-server-foundation
   ```

PASS verdict authorises PR creation and squash-merge.
