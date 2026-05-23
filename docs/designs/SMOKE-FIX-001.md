# SMOKE-FIX-001 — Restore the live Anthropic semantic-referee provider after smoke-test 51fc7750

**Card:** SMOKE-FIX-001 (Rules UX · P1 · S · Release 6.9).
**Status:** Design draft.
**Epic:** Rules UX.
**Issue:** filed against `kyleruff1/cDiscourse`; added to GitHub Project #1.
**Investigation:** `docs/testing-runs/2026-05-22-smoke-test-failure-investigation.md` (commit `dd2dec0`).
**Smoke-test log:** `logs/mcp-smoke-test/51fc7750.json` (gitignored).
**Companion contracts:** MCP-016 (boundary), MCP-017 (live Anthropic provider), MCP-018 (`mcp` provider — touched only by parity test), MCP-019 (room hook + trigger gate), ADMIN-AI-001 (admin runtime config).

---

## 1. Goal (one paragraph)

The 2026-05-23T00:01:45Z smoke-test run (`runId 51fc7750`) failed all five live Anthropic classify attempts in two distinct
ways: move 1 produced HTTP 422 at the inbound `.strict()` schema gate because the production
`mapParticipantSideToActorRole` emits `'moderator'`, which is missing from
`supabase/functions/_shared/semanticReferee/schema.ts:71`'s `actorRole` enum; move 2 + the post-flip probe produced HTTP 200
with `{ enabled: false, reason: 'validation_failed' }` because the live Haiku 4.5 response failed either the outbound packet
schema or the content-safety scanner, and the function emits no log line that names which check rejected what. SMOKE-FIX-001
lands the two narrow, additive fixes those failures call for — (a) widen the inbound `actorRole` enum to match the production
`SemanticActorRole` union plus add a parity test, and (b) add one sanitized `console.warn` line at each `validation_failed`
return in `anthropicProvider.ts` naming the layer (schema vs content_scan), the schema issue path, or the sanitized
content-scan detail — so the next smoke-test re-run proves move 1 succeeds AND surfaces the named cause of the
move-2/probe rejection in the function logs. A follow-up card (SMOKE-FIX-002) then ships the targeted remediation based on
that named cause.

---

## 2. Scope

### In scope

- **Fix A — schema widening.** Add `'moderator'` to the `actorRole` enum at
  `supabase/functions/_shared/semanticReferee/schema.ts:71`.
- **Fix A — parity test.** A new Jest test that loads the schema source and asserts every member of the production
  `SemanticActorRole` union (`src/features/semanticReferee/triggerGates.ts:57-63`) appears in the Deno schema's `actorRole`
  enum. Mirrors the existing `__tests__/semanticAnthropicContentScanParity.test.ts` posture (source-scan, not Deno-import).
- **Fix B1 — sanitized diagnostic log line.** In `supabase/functions/_shared/semanticReferee/anthropicProvider.ts`, before
  each of the two `return { kind: 'unavailable', reason: 'validation_failed' }` returns, emit one structured `console.warn`
  line naming the layer and the sanitized failure detail (schema `path` array OR content-scan category text). NEVER logs
  the response body, the model text, a `reasonCode` literal, an evidence span, an API key, an Authorization header, a JWT,
  the room id, or any user id; the existing per-request `inputHash` correlator is the only id allowed.
- **Fix B1 — unit test.** A new Jest test asserting the log line's shape (layer enum, path/detail presence, sanitized
  content) and absence of forbidden fields (API key, `Authorization`, raw response text, room id, user id, reasonCode
  literals). Mirrors the existing `__tests__/semanticAnthropicSourceScan.test.ts` posture.
- **Updated `docs/core/current-status.md`.** Re-baselines Stage 6.4 with a SMOKE-FIX-001 footnote that names the new function
  log format and points to this design.

### Out of scope (explicitly — do NOT design or implement in this card)

- **The actual remediation of move-2 / probe's `validation_failed` cause.** That fix waits for B1's logs to name a category.
  It ships as a separate card (SMOKE-FIX-002, Category 1, scoped after a re-run).
- **Any change to the production `mapParticipantSideToActorRole`** (`src/features/semanticReferee/semanticTriggerInput.ts`).
  Narrowing the mapper would ripple into MCP-015's override-role handling and is unnecessary — widening the schema is the
  smaller, safer diff.
- **Any change to `evaluateTrigger` or `isNonParticipantRole`** in `src/features/semanticReferee/triggerGates.ts`. The
  trigger gate's refusal of observer/moderator post-submits is already the right production behavior; this card does not
  touch it.
- **Any change to the smoke-test orchestrator's bypass-the-trigger-gate posture.** The smoke test deliberately exercises
  the boundary end-to-end; that is the correct behavior. Once Fix A widens the schema, the smoke test's existing
  `participantSide: 'moderator'` for Provocateur becomes valid and no orchestrator change is needed.
- **Any change to the production trigger-gate `SemanticActorRole` union itself.** The parity test asserts the schema is a
  SUPERSET of the union; the union does not move.
- **Re-deploying `semantic-referee` from this card.** The redeploy is an operator action (see §6).
- **Re-running the smoke test from this card.** The re-run is the acceptance criterion that the operator triggers after
  the redeploy.
- **Any change to the live provider's prompt, the content-safety ban-lists, the outbound packet schema, or the
  classifier catalog.** Those are SMOKE-FIX-002 territory.
- **Any change to `process-language-draft`, MCP-018's `mcpAdapter.ts`, the admin-users function, or the runtime config
  RPC.** Those are out of scope; this card touches only the semantic-referee tree.
- **Adding a `'moderator'` case to MCP-015's `mapParticipantSideToOverrideActorRole`.** That mapper has its own union
  (`SemanticOverrideActorRole`) and already handles moderator (mapped to `'admin'`); it is unrelated.
- **v1-scope-excluded features** — no voting, no winner-producing scoring, no real-time collab, no push notifications.

---

## 3. Doctrine constraints (the lines a reviewer enforces)

Any violation is a blocker.

1. **No regression on disabled-by-default.** `SEMANTIC_REFEREE_ENABLED` and `?? 'mock'` fallback stay byte-identical. The
   existing "default is mock" test must keep passing untouched.
2. **No service-role, no privileged write, no migration, no RLS change.** This card reads no `SUPABASE_SERVICE_ROLE_KEY`,
   builds no service-role client, writes no table, no migration, no RLS change.
3. **No secret ever logged.** The new `console.warn` line never includes `ANTHROPIC_API_KEY`, an `Authorization` header
   value, a Bearer token, a JWT, an `sk-ant-…` / `xai-…` / `sb_secret_…` literal, an X handle, a URL, an email, or any
   long digit run. The unit test in §5 enforces this by asserting these substrings never appear in the captured log.
4. **No raw response content logged.** The log emits only the schema issue `path` array (e.g. `["binaries", 0, "value"]`)
   or the sanitized content-scan `detail` string (which is already category-only by construction in
   `contentSafetyScan.ts:228-230`). The model's text, a literal `reasonCode` value, an `evidenceSpan` value, the Anthropic
   raw payload, and the full `stamped` object are never logged.
5. **The packet contract is untouched.** No widening of `SemanticRefereePacketSchema`. No new field in
   `ClassifyMoveRequest` or `SemanticRefereePacket`. No change to `PACKET_VERSION`. No change to `ClassifyMoveDisabledReason`
   in either the Deno or Node twin.
6. **The widening is additive on a strict enum.** Adding `'moderator'` to `actorRole`'s enum can only ACCEPT requests
   the strict gate previously rejected; it cannot reject a request that previously passed. The change is monotone in the
   safe direction.
7. **No client surface change.** `src/features/semanticReferee/` and `src/features/arguments/useSemanticReferee.ts` are
   not modified. No new prop, no new type, no new export.
8. **`process-language-draft` and `mcpAdapter.ts` are not modified.** SMOKE-FIX-001 stays inside `anthropicProvider.ts`,
   `schema.ts`, plus the two new test files and `docs/core/current-status.md`.
9. **Idempotent under re-deploy.** Running the migration is not part of this card (there is no migration). Running
   `supabase functions deploy semantic-referee --linked` twice in a row is a no-op.

---

## 4. Background — the two failure modes (summary; full detail in the investigation report)

| # | Call | HTTP | Inner outcome | Root cause |
|---|---|---|---|---|
| 1 | move 1, both batches | 422 | `{ error: 'validation_failed', issues: [...] }` | `roomContext.actorRole = 'moderator'` is not in the inbound `.strict()` schema's `actorRole` enum (`schema.ts:71`). |
| 2 | move 2 + flip probe | 200 | `{ enabled: false, reason: 'validation_failed' }` | The Haiku 4.5 response failed the outbound `SemanticRefereePacketSchema` or `scanPacketContent`. The function emits no log naming which check fired. |

Failure 1 is masked in production because `evaluateTrigger` refuses post-submit moments for observer/moderator actor
roles before any classify call. The smoke test bypasses `evaluateTrigger` to exercise the boundary end-to-end, which is
the correct test posture; Fix A makes the boundary contract match what the production mapper emits.

Failure 2 is masked in production because `useSemanticReferee.ts:442-444` collapses every `{ enabled: false }` reason
into a silent inert `'fallback'` state. The user sees the deterministic layer-1 UI. The Anthropic provider runs, gets a
response, rejects it, and the system degrades safely — but the live classification is non-functional. We cannot fix the
rejection without knowing why it fires; Fix B1 makes the cause visible without leaking content.

---

## 5. File changes

### 5.1 `supabase/functions/_shared/semanticReferee/schema.ts`

One-line change at line 71:

```ts
// before
actorRole: z.enum(['initiator', 'primary_opponent', 'chime_in', 'observer']).optional(),
// after
actorRole: z.enum(['initiator', 'primary_opponent', 'chime_in', 'observer', 'moderator']).optional(),
```

Nothing else moves. The schema's `roomContext.side` enum at line 70 already includes `'moderator'`; this change brings
`actorRole`'s enum into agreement with it.

### 5.2 `supabase/functions/_shared/semanticReferee/anthropicProvider.ts`

Two log lines inserted at the two existing `return { kind: 'unavailable', reason: 'validation_failed' }` sites
(lines 187-190 and 191-194 of the current file). The exact structure:

```ts
// At line 187-190 — schema validation failure
const schemaResult = SemanticRefereePacketSchema.safeParse(stamped);
if (!schemaResult.success) {
  console.warn(JSON.stringify({
    semanticReferee: 'validation_failed',
    layer: 'schema',
    path: schemaResult.error.issues[0]?.path ?? [],
    inputHash: typeof stamped.inputHash === 'string' ? stamped.inputHash : null,
  }));
  return { kind: 'unavailable', reason: 'validation_failed' };
}

// At line 191-194 — content-safety scan failure
const contentResult = scanPacketContent(stamped);
if (!contentResult.ok) {
  console.warn(JSON.stringify({
    semanticReferee: 'validation_failed',
    layer: 'content_scan',
    detail: contentResult.detail,
    inputHash: typeof stamped.inputHash === 'string' ? stamped.inputHash : null,
  }));
  return { kind: 'unavailable', reason: 'validation_failed' };
}
```

What the log carries and what it does NOT:

- `semanticReferee: 'validation_failed'` — a fixed marker for grep / Supabase Studio filter.
- `layer: 'schema' | 'content_scan'` — names the wall.
- `path` (schema only) — the zod issue path array, e.g. `["binaries", 0, "value"]`. No VALUE.
- `detail` (content_scan only) — the sanitized category string from `contentSafetyScan.ts:228-230`. Already
  category-only by construction (e.g. "binaries[0].reasonCode contained a verdict / outcome token"). No VALUE.
- `inputHash` — the deterministic, non-secret per-request correlator already stamped on the packet at lines 92-94 of
  the same file. Lets us join a Supabase log line to a smoke-test log entry by run+request.

What is NEVER in the log:

- The Anthropic response body, the model text, the parsed JSON, or any string from `stamped` other than `inputHash`.
- The API key, the Authorization header, a Bearer token, a JWT, an `sk-ant-…` / `xai-…` / `sb_secret_…` literal.
- The room id, the move id, the parent id, any participant id, any X handle, any email, any URL, any post id.
- The actual `reasonCode`, `evidenceSpan`, or `parentSpan` value that triggered the rejection.

`console.warn` (not `console.log`) so the line surfaces at the "warn" level in Supabase Studio's function-logs view.
`JSON.stringify` so the line is grep-parseable. The line is single-shot per failed call — the function's HTTP response is
unchanged.

### 5.3 New test — `__tests__/semanticRefereeActorRoleParity.test.ts`

A source-scan test mirroring the posture of `__tests__/semanticAnthropicContentScanParity.test.ts`. Reads the schema file
as text and the trigger-gates file as text, extracts the two unions / enums, and asserts the schema enum is a SUPERSET
of `SemanticActorRole`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'supabase/functions/_shared/semanticReferee/schema.ts');
const GATES_PATH = path.join(REPO_ROOT, 'src/features/semanticReferee/triggerGates.ts');

describe('semantic-referee actorRole parity (Node union ⊆ Deno schema enum)', () => {
  it('every SemanticActorRole value appears in the schema actorRole enum', () => {
    const schemaSrc = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const gatesSrc = fs.readFileSync(GATES_PATH, 'utf8');

    const schemaEnumMatch = schemaSrc.match(
      /actorRole:\s*z\.enum\(\[([^\]]+)\]\)/,
    );
    expect(schemaEnumMatch).not.toBeNull();
    const schemaEnum = new Set(
      Array.from(schemaEnumMatch![1].matchAll(/'([a-z_]+)'/g)).map((m) => m[1]),
    );

    // SemanticActorRole's body in triggerGates.ts is a 4-line discriminated union.
    const unionMatch = gatesSrc.match(
      /export type SemanticActorRole =([\s\S]*?);/,
    );
    expect(unionMatch).not.toBeNull();
    const unionMembers = Array.from(unionMatch![1].matchAll(/'([a-z_]+)'/g)).map(
      (m) => m[1],
    );

    for (const member of unionMembers) {
      expect(schemaEnum.has(member)).toBe(true);
    }
  });
});
```

The test is a SOURCE-SCAN, not a Deno import — `schema.ts` imports `npm:zod@4` and is not Jest-importable, exactly the
same constraint that already drives `semanticAnthropicContentScanParity.test.ts`.

### 5.4 New test — `__tests__/semanticAnthropicValidationLogShape.test.ts`

A unit test that imports the (pure-TS) part of the new log construction. Two strategies are acceptable; the design
recommends the second:

- **Strategy 1 (rejected)**: import `anthropicProvider.ts` directly. Blocked — that file imports `npm:zod@4` via
  `schema.ts`, the same Jest-importability constraint that drove MCP-017's existing test split.
- **Strategy 2 (recommended)**: source-scan `anthropicProvider.ts` and assert (a) BOTH `console.warn` calls are present
  with the expected shape, (b) the JSON keys are limited to `semanticReferee / layer / path / detail / inputHash`, (c) NO
  log line interpolates `stamped` (except `stamped.inputHash`), `responseJson`, `contentText`, `parsed`, `apiKey`,
  `requestBody`, `request.roomId`, `request.moveId`, or `request.parentId`. This is the same posture as the existing
  `__tests__/semanticAnthropicSourceScan.test.ts`.

The recommended test additionally asserts the forbidden-substring list — the literal strings `ANTHROPIC_API_KEY`,
`Authorization`, `Bearer`, `sk-ant-`, `xai-`, `sb_secret_` (assembled from fragments at runtime so the test itself does
not commit a key-shaped literal) — do not appear anywhere inside the two `console.warn` call sites.

### 5.5 `docs/core/current-status.md` footnote

A 3-line addition under the Stage 6.4 line documenting the new function log format and pointing to this design. No
status change; Stage 6.4 stays current.

---

## 6. Deployment plan (operator action only)

This card writes code and tests. Deployment is the operator's action. The card is "done" when the diff is merged and the
acceptance criteria below are all green; the smoke-test re-run is the operator's acceptance check, executed AFTER the
operator deploys.

Operator-only steps, in order, after merge:

1. `npx supabase functions deploy semantic-referee --linked` — picks up Fix A (the schema enum widening) and Fix B1 (the
   log lines).
2. Re-run the smoke test: `node scripts/bot-fixtures/runMcpSmokeTest.js` (the same invocation that produced
   `logs/mcp-smoke-test/51fc7750.json`). Expectation: move 1 succeeds; move 2 + probe will EITHER also succeed (if the
   live response now passes both walls — possible if the v32 deployment captured a stale change) OR continue to return
   `{ enabled: false, reason: 'validation_failed' }`, AND the Supabase Studio function logs now name the
   `layer / path / detail / inputHash` for each rejection. The operator captures the new run log and the function-log
   lines as input to SMOKE-FIX-002.
3. (Implicit) No secret change. No migration. No admin runtime-config change. The runtime config stays
   `providerMode: 'anthropic', enabled: true` exactly as the smoke-test log recorded.

Nothing this card lands runs automatically on merge. There is no CI deploy step. No GitHub Actions workflow is added,
modified, or triggered.

---

## 7. Rollback plan

Three reversible levels, in order of escalating action:

1. **Code rollback** (default): revert the SMOKE-FIX-001 merge commit. The schema reverts to the pre-fix enum and the
   `console.warn` calls disappear. The system returns to the exact pre-fix state — degraded but stable, with the
   layer-1 fallback intact.
2. **Deploy rollback** (if step 1 isn't enough — e.g. the redeploy is what introduced an issue): redeploy from a
   pre-SMOKE-FIX-001 commit with `npx supabase functions deploy semantic-referee --linked`. Supabase keeps the prior
   versioned deployment available; the operator can also pin to a specific version via the dashboard if the function
   keeps both versions live.
3. **Provider flip** (escape hatch if both above leave the system worse than degraded): the admin UI's
   `set_semantic_config` action flips `providerMode` from `'anthropic'` to `'mock'`. This stops every live Anthropic
   call instantly; users continue to see layer-1 fallback. This is the same flip the smoke test exercises and the
   propagation is sub-3-seconds (`51fc7750.json` recorded `propagationMs: 2391`).

Nothing the card lands can make the system "worse than degraded." Failure mode 1 cannot get worse because Fix A only
WIDENS what is accepted. Failure mode 2 cannot get worse because Fix B1 only ADDS log lines; the return path is byte-
identical.

---

## 8. Test plan

### 8.1 Required passing CI commands

- `npm run typecheck` — no `any`, no new untyped surface.
- `npm run lint` — no new lint warnings.
- `npm run test` — all existing tests pass; the two new tests in §5.3 and §5.4 are added to the suite.

### 8.2 Required new tests

- `__tests__/semanticRefereeActorRoleParity.test.ts` (Fix A; §5.3) — fails the build if a future drift adds a member to
  `SemanticActorRole` without widening the schema enum.
- `__tests__/semanticAnthropicValidationLogShape.test.ts` (Fix B1; §5.4) — fails the build if the log line is reshaped to
  include a forbidden field, or removed from one of the two sites.

### 8.3 Hard acceptance criterion — smoke-test re-run

After the operator deploys (§6), running `node scripts/bot-fixtures/runMcpSmokeTest.js` MUST produce a new run-log file
under `logs/mcp-smoke-test/` in which:

- Move 1's two batches each return `ok: true` (the inbound schema accepts `actorRole: 'moderator'`).
- Move 2's two batches and the post-flip probe EITHER also return `ok: true, enabled: true` (the Anthropic response now
  passes both walls) OR continue to return `ok: true, enabled: false, disabledReason: 'validation_failed'` — but in this
  second case the Supabase Studio function logs MUST contain three `console.warn` entries (one per failing call), each
  with shape `{ semanticReferee: 'validation_failed', layer, path|detail, inputHash }`, where:
  - `layer` is one of `'schema' | 'content_scan'`;
  - `path` (if present) is an array of strings and numbers, e.g. `["binaries", 0, "value"]`;
  - `detail` (if present) is a sanitized category string from `contentSafetyScan.ts`;
  - `inputHash` matches an `inputHash` value the function would have stamped onto the (failed) packet — verifiable by
    re-running the deterministic `inputHash` derivation on the smoke-test's redacted request.

Smoke-test re-run is a manual operator step — the card design treats the re-run output as the acceptance check, NOT as
part of CI. The card is "ready to close" when both new tests pass, the typecheck + lint + test trio is green, the
function is deployed, and the new run log + function logs match the criterion above. If move 2's `validation_failed`
persists, SMOKE-FIX-002 picks it up — that does NOT block closing SMOKE-FIX-001.

### 8.4 What this card does NOT test

- It does not test that move 2 now SUCCEEDS. Whether move 2 succeeds depends on the Anthropic response shape, which is
  the input to SMOKE-FIX-002. SMOKE-FIX-001 only delivers (a) move 1 success AND (b) a named cause when move 2 still
  fails.
- It does not add an integration test against a real Anthropic call. No live API call from CI; the existing source-scan
  posture is enforced.

---

## 9. Acceptance criteria (checkbox set for the GitHub issue)

- [ ] `supabase/functions/_shared/semanticReferee/schema.ts:71`'s `actorRole` enum is
      `['initiator', 'primary_opponent', 'chime_in', 'observer', 'moderator']`.
- [ ] `supabase/functions/_shared/semanticReferee/anthropicProvider.ts` emits a single `console.warn(JSON.stringify({...}))`
      line before each of the two `return { kind: 'unavailable', reason: 'validation_failed' }` returns, carrying only
      `{ semanticReferee, layer, (path | detail), inputHash }`.
- [ ] `__tests__/semanticRefereeActorRoleParity.test.ts` exists, source-scans both files, and asserts the schema enum is
      a superset of the production `SemanticActorRole` union.
- [ ] `__tests__/semanticAnthropicValidationLogShape.test.ts` exists, source-scans `anthropicProvider.ts`, and asserts
      both log lines are present, well-shaped, and never reference forbidden identifiers (`stamped` body, `responseJson`,
      `contentText`, `apiKey`, `request.roomId`, `request.moveId`, `request.parentId`, `Authorization`, `Bearer`,
      assembled-fragment key prefixes).
- [ ] `npm run typecheck && npm run lint && npm run test` all pass.
- [ ] No change to `src/features/`, `src/lib/edgeFunctions.ts`, `src/features/semanticReferee/triggerGates.ts`,
      `src/features/semanticReferee/semanticTriggerInput.ts`, MCP-018's `mcpAdapter.ts`, `process-language-draft`, or any
      migration. No change to `PACKET_VERSION`, `ClassifyMoveDisabledReason`, or `SemanticActorRole`.
- [ ] `docs/core/current-status.md` carries the 3-line footnote naming the new log format.
- [ ] After operator deploy + smoke-test re-run: move 1 succeeds; move 2 + probe either succeed OR fail with the new
      `{layer, path|detail, inputHash}` log line for each failing call.

---

## 10. Risks and open questions

### Risks

- **The schema widening unmasks an unrelated downstream bug** that previously was hidden behind the 422 rejection (e.g.,
  a moderator-side classify request that succeeds inbound now triggers an outbound packet shape we haven't seen).
  Mitigation: the outbound wall (`SemanticRefereePacketSchema` + `scanPacketContent`) still applies; an unsafe outbound
  packet still becomes `{ enabled: false, reason: 'validation_failed' }` and the user still sees the layer-1 fallback.
- **The new log line subtly leaks something we didn't anticipate** (e.g. a future schema-issue path that includes a
  user-supplied string). Mitigation: the test in §5.4 asserts a closed set of allowed keys and an open-ended forbidden-
  substring scan; any future change to the log shape must pass that test. zod issue paths are arrays of (string | number)
  drawn from schema field names — none of those are user-supplied strings.
- **The smoke test's run-log file is gitignored**, so the acceptance check evidence is operator-local. Mitigation: the
  card asks the operator to attach the relevant portions of the new run log and the function-log lines as a comment on
  the GitHub issue when closing, with secrets redacted. No code change is needed; this is a process note in the issue
  body.

### Open questions (each has a recommendation; flag any disagreement during review)

- **Should `console.warn` use a `console.error` instead?** Recommendation: `console.warn`. The function returns HTTP 200
  with an `{ enabled: false }` envelope; the user sees the layer-1 fallback; nothing is broken from the caller's view.
  `console.warn` is the right severity level. It also matches `process-language-draft`'s sibling-provider log posture.
- **Should the log line include the failing classifier batch?** Recommendation: NO. The smoke-test log already carries
  `requestedClassifiers` per batch and the `inputHash` joins the function log to it. Adding the batch to the function
  log only duplicates information and risks accidental over-logging.
- **Should we ALSO log on the OTHER `'unavailable'` reasons** (`key_missing`, `api_error`, `rate_limited`,
  `network_error`, `parse_failure`)? Recommendation: NO for SMOKE-FIX-001. Those reasons already correspond to clear
  HTTP-level events that are visible at the request-log layer or in Anthropic's billing dashboard. Adding them here would
  expand scope; if a future card wants uniform structured logging on every `unavailable` reason, it ships its own design.
- **Should the parity test ASSERT EQUALITY** between the schema enum and the production union, not just superset?
  Recommendation: SUPERSET ONLY. The schema can legitimately accept more values than the production mapper emits today
  (e.g. a future client variant). Equality would break the first time someone adds an actor role to the schema for an
  experimental surface before the mapper catches up.

---

## 11. Follow-ups (NOT part of this card)

- **SMOKE-FIX-002** — Targeted remediation of move 2 + probe's `validation_failed` once SMOKE-FIX-001's log line names a
  category. Most likely one of: a content-scanner exemption for the `reasonCode` field (since classifier reason codes are
  structural, not verdicts on participants); a seed-prompt tightening that names forbidden tokens by example; or a tiny
  coercion step in `parseJsonFromContent` for boolean-vs-integer `value`. Designed AFTER SMOKE-FIX-001 ships and the
  smoke-test re-run produces the named cause.
- **Modularity slate** (separate roadmap track) — Documentation reorg, classifier-catalog inventory, prompt-template
  inventory, source-of-truth extraction, prompt-template refactor, banner/ledger refactor, move-position tracking, and
  the move-position-aware triggering rule. Independent of SMOKE-FIX-001 / SMOKE-FIX-002 and proceeds in its own
  dependency order.
