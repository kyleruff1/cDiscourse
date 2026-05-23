# MCP semantic-referee smoke-test failure investigation — runId `51fc7750`

**Date**: 2026-05-22 (smoke-test ran 2026-05-23T00:01:45Z → 00:02:09Z UTC).
**Authority**: `docs/current-status.md` Stage 6.4 baseline + the autonomous-investigation prompt for fc1659d.
**Source artifact**: `logs/mcp-smoke-test/51fc7750.json` (gitignored).
**Edge Function logs**: Supabase MCP `get_logs` for project `qsciikhztvzzohssddrq`, service `edge-function`, time window
1779494505296 → 1779494529012 (the run window).
**Scope guard**: This document is a diagnosis. No production code, runtime config, or migration is changed by this file. The
fix scope is proposed at the end of the document and is the subject of the operator checkpoint that follows.

## Summary — two distinct root causes, not one

The smoke test surfaced two completely separate failures that happen to share the `'validation_failed'` token in their
respective error envelopes. They are NOT the same problem branching on parent-presence; they are two unrelated bugs that the
smoke test happened to expose in the same run.

| # | Failing call | HTTP | Outcome shape | Where the failure happened | Real cause |
|---|---|---|---|---|---|
| 1 | move 1, both batches | **422** | `{ error: 'validation_failed', issues: [...] }` | Inbound `.strict()` schema gate at `supabase/functions/semantic-referee/index.ts:65-72` | **Schema / mapper drift** — `roomContext.actorRole = 'moderator'` is not in the inbound enum |
| 2 | move 2 batches + flip probe | **200** | `{ enabled: false, reason: 'validation_failed' }` | Outbound packet validation inside the live Anthropic provider at `supabase/functions/_shared/semanticReferee/anthropicProvider.ts:187-194` | **Anthropic response failed validation** — either the `.strict()` packet schema or the content-safety scanner rejected the model's JSON. The function-level reason text is not surfaced in any log we have access to. |

In production today both bugs are masked. Failure 1 is masked because the production trigger gate
(`evaluateTrigger` in `src/features/semanticReferee/triggerGates.ts`) refuses post-submit moments when `actorRole` is
`'observer' | 'moderator'`, so the moderator's move never reaches `classifyMove`. Failure 2 is masked because the consuming
hook (`useSemanticReferee`) collapses `{ enabled: false }` of ANY reason into a silent `'fallback'` state — the user simply
sees the deterministic layer-1 UI. The system is degraded but stable: live Anthropic classification is non-functional on the
dev project, and the layer-1 fallback is what every user is actually seeing.

## Failure mode 1 — Move 1, HTTP 422

### What the smoke-test log says

```jsonc
// logs/mcp-smoke-test/51fc7750.json — m1 (truncated for clarity)
"moveId": "m1", "authorAlias": "Provocateur", "postSide": "affirmative",
"participantSide": "moderator", "postOk": true, "argumentId": "0fed9251-…",
"batches": [
  { "requestedClassifiers": ["answers_clarification", "introduces_new_issue",
                             "quote_anchors_parent", "responds_to_parent"],
    "latencyMs": 924, "ok": false,
    "error": "Edge Function returned a non-2xx status code" },
  { "requestedClassifiers": ["asks_for_evidence", "creates_source_chain_gap",
                             "evidence_supports_claim", "provides_evidence",
                             "uses_popularity_as_evidence"],
    "latencyMs": 1519, "ok": false,
    "error": "Edge Function returned a non-2xx status code" }
]
```

### What the Edge Function logs show

Two `POST 422` entries from the `semantic-referee` function, matching the smoke-test latencies within ~20ms:

```jsonc
// Edge Function logs (request-level)
{ "method": "POST", "status_code": 422, "execution_time_ms":  907,
  "timestamp": 1779494511185000, "version": "31" }   // m1 batch 1
{ "method": "POST", "status_code": 422, "execution_time_ms": 1327,
  "timestamp": 1779494512534000, "version": "31" }   // m1 batch 2
```

Status 422 is produced inside the function by `validationFailed(...)` (see `supabase/functions/_shared/http.ts`). The
function code calls `validationFailed` in exactly two places (`supabase/functions/semantic-referee/index.ts:65-72` and
`:79-87`):

```ts
const parsed = ClassifyMoveRequestSchema.safeParse(rawBody);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => ({ path: i.path, message: i.message }));
  return validationFailed({ error: 'validation_failed', issues });
}
// ...
if (roomError || !room) {
  return validationFailed({ error: 'room_not_found_or_not_accessible' });
}
```

The MCP `get_logs` surface returns request-level edge-log rows only — not the function's `console` output — so we cannot
read the `issues[]` array directly. We can however reason from the request shape to which of the two `validationFailed`
sites was hit.

### Why move 1 fails — schema / mapper drift on `actorRole`

The smoke-test orchestrator (`scripts/bot-fixtures/runMcpSmokeTest.js:113-120`) ports the production mapper verbatim:

```js
function mapParticipantSideToActorRole(side) {
  switch (side) {
    case 'affirmative': return 'initiator';
    case 'negative':    return 'primary_opponent';
    case 'moderator':   return 'moderator';
    case 'observer':
    default:            return 'observer';
  }
}
```

This is the same mapping `src/features/semanticReferee/semanticTriggerInput.ts:86-100` produces in production. The mapper
returns `'moderator'` for a moderator-side participant.

The Edge Function inbound schema at `supabase/functions/_shared/semanticReferee/schema.ts:65-73` is `.strict()` and
constrains `actorRole`:

```ts
roomContext: z.object({
  debateMode: z.string().max(MAX_STRING_FIELD_LEN).optional(),
  selectedAction: z.string().max(MAX_STRING_FIELD_LEN).optional(),
  selectedMoveType: z.string().max(MAX_STRING_FIELD_LEN).optional(),
  side: z.enum(['affirmative', 'negative', 'observer', 'moderator']).optional(),
  actorRole: z.enum(['initiator', 'primary_opponent', 'chime_in', 'observer']).optional(),
}).strict(),
```

`'moderator'` is in `side`'s enum but NOT in `actorRole`'s enum. The smoke-test scenario assigns Provocateur
`participantSide: 'moderator'` (`runMcpSmokeTest.js:253`). Move 1 is Provocateur's move, so the classify payload sent
to the function has `roomContext.actorRole = 'moderator'`, which fails the inbound zod gate with a
`z.invalid_enum_value` issue on `["roomContext", "actorRole"]`. The function then returns `validationFailed(...)`, which
is HTTP 422 with body `{ error: 'validation_failed', issues: [{ path: ["roomContext","actorRole"], message: "..." }] }`.

The reason both batches fail identically is that both batches inherit the same `roomContext` from the same posted move. The
schema rejects them before the function ever looks at `requestedClassifiers`.

### Why this is invisible in production but real

The production hook (`src/features/arguments/useSemanticReferee.ts:377-390`) calls `evaluateTrigger` BEFORE
`classifyMove`, and `triggerGates.ts:225` refuses the post-submit moment when the actor is observer or moderator:

```ts
// triggerGates.ts (excerpt)
if (isNonParticipantRole(input.actorRole)) {
  return { allowed: false, reasonCode: 'non_participant_actor', /* … */ };
}
```

So in production, a moderator-side move never reaches the boundary — the trigger gate short-circuits it locally. The smoke
test deliberately bypasses `evaluateTrigger` (it calls `invokeClassifyMove` directly at
`runMcpSmokeTest.js:158-200`) so that it can exercise the boundary end-to-end. That bypass is what exposed the drift.

This is still a real bug: the contract between the production mapper, the trigger gate's union, and the boundary schema is
inconsistent. If `evaluateTrigger`'s non-participant guard is ever removed, weakened, or sidestepped by a future surface
(e.g. a moderator-as-participant variant of the room), `actorRole: 'moderator'` will reach the boundary in production and
produce identical 422s. The drift is a latent failure waiting on a future code path.

## Failure mode 2 — Move 2 + flip probe, HTTP 200 with `enabled: false`

### What the smoke-test log says

```jsonc
// logs/mcp-smoke-test/51fc7750.json — m2 (truncated for clarity)
"moveId": "m2", "authorAlias": "Revocateur", "postSide": "negative",
"participantSide": "negative", "postOk": true, "argumentId": "60329022-…",
"batches": [
  { "requestedClassifiers": ["answers_clarification","introduces_new_issue",
                             "quote_anchors_parent","responds_to_parent"],
    "latencyMs": 3459, "ok": true,
    "enabled": false, "disabledReason": "validation_failed" },
  { "requestedClassifiers": ["asks_for_evidence","creates_source_chain_gap",
                             "evidence_supports_claim","provides_evidence",
                             "uses_popularity_as_evidence"],
    "latencyMs": 5301, "ok": true,
    "enabled": false, "disabledReason": "validation_failed" }
]
// …and the flip probe at the end:
"probe": { "latencyMs": 2391, "ok": true, "enabled": false,
           "disabledReason": "validation_failed" }
```

### What the Edge Function logs show

Three `POST 200` entries from the `semantic-referee` function — successful HTTP, the function reached the end and returned a
typed disabled outcome. Execution times match the smoke-test latencies within ~10ms:

```jsonc
// Edge Function logs (request-level)
{ "status_code": 200, "execution_time_ms": 3445,
  "timestamp": 1779494518810000, "version": "32" }   // m2 batch 1
{ "status_code": 200, "execution_time_ms": 5288,
  "timestamp": 1779494524112000, "version": "32" }   // m2 batch 2
{ "status_code": 200, "execution_time_ms": 2376,
  "timestamp": 1779494528190000, "version": "32" }   // flip probe
```

These are believable Anthropic Haiku 4.5 round-trip latencies — the API call did happen.

### Where `'validation_failed'` is emitted inside the function

The only code path that produces a 200 + `{ enabled: false, reason: 'validation_failed' }` is the live Anthropic provider
at `supabase/functions/_shared/semanticReferee/anthropicProvider.ts:187-194`:

```ts
const schemaResult = SemanticRefereePacketSchema.safeParse(stamped);
if (!schemaResult.success) {
  return { kind: 'unavailable', reason: 'validation_failed' };
}
const contentResult = scanPacketContent(stamped);
if (!contentResult.ok) {
  return { kind: 'unavailable', reason: 'validation_failed' };
}
```

`SemanticRefereePacketSchema` (`schema.ts:116-136`) is `.strict()` on every nested object, pins
`authoritative` to `z.literal(false)`, requires `binaries[i].value` to be `z.union([z.literal(0), z.literal(1)])`,
constrains `confidence` to `'low' | 'medium' | 'high'`, and requires a full 6-field `scoreHints` object of integers `0..3`.

`scanPacketContent` (`contentSafetyScan.ts:50-78, 207-226`) walks the parsed object and rejects:
- a string field whose `snake_case` segments include any verdict token from
  `[winner, loser, won, lost, right, wrong, true, false, correct, incorrect, proven, defeated]`;
- a string field including a person-label token `[liar, lying, dishonest, manipulative, troll, propagandist, extremist, stupid, idiot, dumb, smart]`
  or the phrase `bad faith`;
- a secret-shaped or PII-shaped string;
- an off-contract key (e.g. `reasoning`, `analysis`, `block`, `gate`, `message`).

Both walls produce the same `'validation_failed'` reason — and crucially, neither writes a `console` line distinguishing
which wall fired or what specifically failed. So we can SEE that something the model returned was rejected, but we cannot
tell from the available logs whether it was a schema mismatch or a content-scan rejection, or which field caused it.

### Probable causes — ranked, all consistent with what we know

The probe payload sends a 5-char body `'probe'`, a single classifier `'responds_to_parent'`, and a participant side
`'affirmative'`. It is the simplest possible request. It still fails. That, combined with the m2 batches failing
identically, says the failure is **systematic in the model's output shape, not data-dependent**. Candidates:

1. **`reasonCode` contains a banned verdict token** (high likelihood). Haiku 4.5, asked to label a structural binary
   verdict 0/1 with a `snake_case` `reasonCode`, naturally produces values like `false_premise`, `true_to_topic`,
   `correct_form`, `incorrect_scope`, `wrong_side`. Five of these literal segments — `false`, `true`, `correct`,
   `incorrect`, `wrong` — are in the verdict ban-list. A single binary whose `reasonCode` contains any of them fails
   `scanPacketContent`. The prompt at `seedPrompt.ts:139-148` tells the model not to include a *blocking / verdict /
   truth / winner field*, but does not forbid those tokens inside an otherwise-valid `reasonCode` string. This is the
   single most likely explanation for a deterministic, systematic rejection.

2. **`binaries[i].value` is a JSON boolean instead of integer `0`/`1`** (medium likelihood). The schema accepts
   `z.union([z.literal(0), z.literal(1)])` only. A model that emits `value: true` would fail. The system prompt and the
   user prompt both say "0 or 1", but a Haiku-class model can drift.

3. **The model emitted an off-contract field** (medium likelihood). The model might add a `reasoning` or `analysis` key
   despite the system-prompt prohibition. The packet schema is `.strict()` and would reject it, and the content scanner
   would also reject it as a smuggled `CHAIN_OF_THOUGHT_FIELD_NAMES` member.

4. **A required field is missing** (lower likelihood). If the model fails to produce `routeSuggestion`,
   `frictionSuggestion`, or a complete `scoreHints`, the schema rejects it. Less likely because the user prompt is
   explicit about all three, and Haiku 4.5 is usually good at structured output.

5. **`confidence` is an out-of-enum value** (lower likelihood). The model might use `'very_high'`, `'med'`, or a numeric
   value.

We CANNOT distinguish between these without a diagnostic log line. The investigation report's verdict on this is:
**we know the layer that's rejecting the response, we do not yet know the specific field or token that triggers the
rejection**.

## Cross-cutting observation — Edge Function version transition mid-run

The Edge Function logs show `version: "31"` for the m1 calls and `version: "32"` for everything afterward (m2, probe, both
admin-users flip calls). The transition window is between t=1779494512534000 (m1 batch 2 ends) and
t=1779494518810000 (m2 batch 1 starts) — about 6 seconds. There was no operator deployment in that window; the smoke-test
orchestrator does not deploy. The most likely explanation is a Supabase runtime promotion of a recently-deployed
version (the function shows version 32 as the active deployment now) that happened to be promoted between m1 and m2's
invocations. This is interesting context but **does NOT change the diagnosis**:

- Failure mode 1 fires at the inbound schema gate, which is identical between v31 and v32 source (no recent commits
  touched the schema).
- Failure mode 2 fires at the outbound validation gate; v32 is the version we have source for and would re-deploy from.

If a redeploy were the issue, we would see m1's 422s persist after the redeploy too. Instead the 422 stopped and the
200+`validation_failed` started, because they are two different failures on two different inputs.

## Fix scope

### Fix A — schema / mapper drift on `actorRole` (failure mode 1)

**What changes**: add `'moderator'` to the inbound `roomContext.actorRole` enum at
`supabase/functions/_shared/semanticReferee/schema.ts:71` so it becomes
`z.enum(['initiator', 'primary_opponent', 'chime_in', 'observer', 'moderator']).optional()`.

**Why widen the schema, not narrow the mapper**: the union in
`src/features/semanticReferee/triggerGates.ts:57-63` is the production source of truth for `SemanticActorRole`; the schema
should mirror it. The trigger gate's `isNonParticipantRole` check (`triggerGates.ts:178`) treats observer and moderator
identically as non-participants, so the boundary doesn't need to discriminate either — it just needs to accept what
the production mapper emits. Narrowing the mapper to drop `'moderator'` would change the production union and ripple
into MCP-015's override-role handling (`useSemanticReferee.ts:196-210` maps `'moderator' → 'admin'` for a different
purpose). The schema-widening fix is the smaller diff.

**Files touched**:
- `supabase/functions/_shared/semanticReferee/schema.ts` — one-line enum addition.
- A new parity test that asserts `SemanticActorRole` (Node side) is a subset of the schema's `actorRole` enum (Deno side).
  This is the pattern the codebase already uses for the content-safety scanner (the `semanticAnthropicContentScanParity`
  test referenced in `contentSafetyScan.ts:25-28`). Add as `__tests__/semanticRefereeActorRoleParity.test.ts`.

**Tests**:
- New parity test described above.
- Existing Deno schema tests should not regress — the change is additive on a strict enum.

**Risk profile**: very low. The change widens what is accepted; no existing valid request becomes invalid. Production is
already not sending `'moderator'` (the trigger gate stops it), so no observable production behavior changes either way.

**Deployment**: requires `npx supabase functions deploy semantic-referee --linked` after merge. Operator action.

**Rollback**: revert the one-line change and redeploy.

### Fix B — Anthropic response failing validation (failure mode 2)

**This is genuinely diagnostic-bottlenecked.** The fix needs two phases.

**Phase B1 — add a sanitized failure-category log line**. In `anthropicProvider.ts:187-194`, before each `return { kind:
'unavailable', reason: 'validation_failed' }`, emit one `console.warn` line of the form:

```ts
console.warn(JSON.stringify({
  semanticReferee: 'validation_failed',
  layer: 'schema' | 'content_scan',
  // For schema failures: the first issue's path array, e.g. ["binaries", 0, "value"].
  path: schemaResult.error.issues[0]?.path,
  // For content failures: the sanitized category text (e.g. "binaries[0].reasonCode contained a verdict / outcome token").
  detail: contentResult.detail,
  // Stable per-request correlator so logs can be joined to the smoke-test log.
  inputHash: stamped.inputHash,
}));
```

Critical doctrine constraints on this log line, mirroring how `process-language-draft`'s provider already logs:

- The log NEVER includes the response body, the model's text, a `reasonCode` literal, an evidence span, an Anthropic raw
  field, the API key, the Authorization header, a JWT, or any room/user identifier other than the deterministic
  `inputHash` (which is already a non-secret per-request correlator stamped at line 92-94 of `anthropicProvider.ts`).
- For schema failures, only the `path` array is logged — not the offending VALUE.
- For content failures, only the SANITIZED `detail` from `contentSafetyScan.ts:228-230` is logged — that text never echoes
  the offending value (it's already category-only by design).

**Files touched**: `supabase/functions/_shared/semanticReferee/anthropicProvider.ts`. Possibly a tiny shared formatter
in `_shared/semanticReferee/` if we want the format reusable. Source-scan test
`__tests__/semanticAnthropicSourceScan.test.ts` must keep passing (no key / no header / no Authorization literal).

**Tests**: add a unit-level test that the new log line is called with the right `layer`/`path`/`detail` shape and NEVER
with raw response text. Existing tests should not regress.

**Risk profile**: very low. Pure additive logging. No behavior change.

**Deployment**: requires redeploying `semantic-referee`. Operator action.

**Rollback**: revert the log line.

**Phase B2 — actual fix, designed AFTER B1 ships and one smoke-test re-run gives us the category**. Until we see what
`layer` and `path`/`detail` say, we cannot responsibly pick between the remediation options. Each option is small but
they are mutually exclusive:

- **Option B2a** (if the failure is a banned token inside `reasonCode`): tighten the seed prompt to forbid the specific
  verdict / person tokens by name; OR loosen the content scanner so that `reasonCode` is exempted from the
  verdict ban-list (since a classifier's `reasonCode` is structural, not a verdict on a participant); OR add a tiny
  post-processing step that rewrites `reasonCode` segments through a fixed whitelist before the scanner runs.
- **Option B2b** (if `binaries[i].value` is boolean): tighten the seed prompt with a worked example showing `0`/`1`; OR
  add a tiny coercion step in `parseJsonFromContent` that converts `true`/`false` to `1`/`0`.
- **Option B2c** (if a smuggled field is present): tighten the system prompt; we already strip it.
- **Option B2d** (if a required field is missing): tighten the prompt; or fall back to the deterministic mock packet for
  the missing field.
- **Option B2e** (if `confidence` is out of enum): tighten the prompt; or coerce common variants (`'very_high'` → `'high'`).

The Phase B2 card will name exactly one of these options once B1's logs land.

**Phase B2 risk profile**: depends on the option. Most are small. The most invasive (option B2a's scanner exemption) is
still narrow because `scanPacketContent` is one file.

### Fix C (orthogonal, optional) — smoke-test ergonomics

The smoke test deterministically triggers failure mode 1 because it bypasses the trigger gate. We could:

- C1. Update `runMcpSmokeTest.js` to use a participant side that maps to a valid `actorRole` (e.g. set Provocateur's
  participant side to `'affirmative'` to match its post side). This works around the bug but doesn't fix it.
- C2. Update the smoke test to run `evaluateTrigger` first and skip `classifyMove` for non-participant moments. This
  defeats the smoke test's purpose of exercising the boundary end-to-end.
- C3. After Fix A lands, leave the smoke test as-is. The schema-widening fix means the smoke test's `'moderator'` mapping
  now passes the boundary, and the smoke test continues to exercise the full boundary path.

Recommend C3 — the smoke test correctly exposes the latent contract bug; the fix is to resolve the contract, not to
silence the messenger.

## Recommendation — category classification

**Category 1: small focused fix, single card, recommended sequence.**

Fix A and Fix B1 (the diagnostic logging) are both Category 1 — each is a sub-50-line, single-file change with very low
risk. They are independent (Fix A is on the inbound boundary; Fix B1 is on the outbound provider). They can both ship in
one card titled along the lines of `SMOKE-FIX-001: actor-role schema widening + Anthropic validation-failure
diagnostic log`. After that card lands and the smoke test re-runs:

- Move 1 should produce a successful 200 with an enabled packet (or a different failure reason — but not the actorRole
  drift).
- Move 2 + probe should still return 200 + `enabled: false`, but the function logs will now name the `layer` and
  `path`/`detail` of the rejection. The operator can read those, and the follow-up card `SMOKE-FIX-002` (also Category 1)
  ships the targeted Phase B2 fix.

**If the operator prefers two cards from the start** (cleaner separation of inbound vs outbound concerns), Fix A becomes
its own Category 1 card (`SMOKE-FIX-001a`) and Fix B1 becomes a separate Category 1 card (`SMOKE-FIX-001b`). The total
diff size is identical; only the staging differs.

**Neither fix is Category 3** — neither needs the modularity refactor as a precondition. The schema enum, the inbound
boundary, the live provider, and the content scanner are each in one well-bounded file. Touching them does not require
restructuring the classifier catalog or extracting a source-of-truth first.

The modularity slate should still proceed in dependency order after the fix lands. The fix and the modularity refactor are
independent; the fix restores live classification quickly and the modularity refactor pays for itself across the next 6+
classifier-related cards.

## Diagnostic gaps surfaced by this run

These should inform the modularity slate, the operator's deploy posture, and the smoke test's future shape:

1. **The MCP `get_logs` tool returns only request-level edge-log rows, not function `console` output.** This is why we
   cannot read the function's internal `issues[]` array or distinguish schema-failure from content-scan-failure for
   failure mode 2. The Supabase Studio Logs UI has the function logs; the MCP tool's `get_logs` endpoint does not surface
   them at this time. Fix B1 (diagnostic logging) is the cheap workaround.
2. **No structured failure category is exported from the function on a `validation_failed` outcome.** The wire response
   is `{ enabled: false, reason: 'validation_failed' }` only. The smoke test would benefit from a sanitized failure
   subcategory carried back to the client (without ever echoing raw content). Out of scope for this investigation; a
   candidate for a later modularity card if the slate reaches it.
3. **No parity test ties the production `SemanticActorRole` union to the Deno schema enum.** Adding one is part of Fix A.
4. **The smoke test does not exercise the `'affirmative'` × non-root case AND the `'moderator'` × root case AND the
   `'observer'` × any case in one run.** A future expansion of the smoke-test scenario could explicitly cover all four
   `actorRole` enum values (and one moderator variant after Fix A widens the contract) so a future drift is caught
   immediately.

## Action item — operator checkpoint

Per the autonomous prompt, this document ends here. The next stage (fix planning) does not begin until the operator
confirms:

1. The fix scope as written (Fix A + Fix B1 in one Category 1 card, with Fix B2 as a follow-up after the diagnostic log
   gives us a category), OR
2. A different scope (e.g. split Fix A and Fix B1 into two cards; OR add Fix C1 if there is a reason to make the smoke
   test pass without changing the schema; OR fold Fix A into the modularity slate's source-of-truth extraction card).

The smoke-test framework at `scripts/bot-fixtures/runMcpSmokeTest.js` plus the verification scans introduced in commit
`764d241` together form the regression harness; re-running the smoke test after the fix lands is the hard acceptance
criterion.
