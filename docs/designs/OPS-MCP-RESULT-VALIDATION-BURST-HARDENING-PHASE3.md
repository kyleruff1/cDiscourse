# OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — Phase 3 (FIX) design

**Status:** Design draft
**Epic:** Epic 12 / MCP semantic-referee track (OPS reliability card; not a board card)
**Release:** Post-Stage-6.4 OPS hardening (MCP-021C-EDGE auto-trigger family chain)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/365
**Intent (binding):** `docs/designs/OPS-MCP-RESULT-VALIDATION-BURST-HARDENING-PHASE3-intent.md`
**Prior phases:** Phase 1 (TYPE) design `docs/designs/OPS-MCP-RESULT-VALIDATION-BURST-HARDENING.md` (MERGED — the sub-reason vocab + `buildFailureDetail` sanitizer + the adapter/core/log threading this phase extends).
**Card type:** the FIX cycle (2nd code merge). **Stage 2B APPROVED** (the retry/dispatch posture below is the operator's explicit pre-approval). NO migration, NO column, NO schema-mirror / prompt / taxonomy / family-key / Source-6 / flag / audit-lint / package.json change. Concurrency stays 2. Family H frozen.

This document designs **Phase 3 (FIX) only**: detect the MCP server's `{isError,...}` error envelope on `extracted` BEFORE the schema validator, type it as a provider/server error (`subReason='provider_server_error'`, carrier `reason='api_error'`), surface the server's short reason code through the existing sanitizer (`serverReason`), and let the **existing** bounded retry heal it. No fix beyond this. No retry/dispatch/concurrency config edit.

---

## Goal (one paragraph)

Phase 2 reproduced the ~11% production burst live (`maxObservedConcurrency≈30 → 3/30 = 10%` failures) and proved the dominant class **synchronously off the RETURN** (the Phase-1 surface): every failure was the MCP server's own error envelope `{ isError, reason, path, detail }` (`failureDetail.receivedKeys = ['isError','reason','path','detail']`), returned **under concurrent load**, and **mis-typed by the Edge adapter as `response_wrong_schema_version`**. The mis-type happens because the envelope reaches `parseMcpBooleanObservationResponse(extracted)` (the adapter's step 6), which fails at its very first check — the envelope has no `schemaVersion`, so step 2 returns `wrong_schema_version` — and Phase 1's `mapToFailureSubreason('validation_failed','wrong_schema_version')` faithfully types it `response_wrong_schema_version`. The root cause is **server-side under load**; the Edge mis-classification is the secondary bug Phase 3 corrects. The fix is a **single new detection branch in the Deno adapter**: when `extracted` is itself a `{ isError: true, … }` envelope, do NOT route it through the schema-version validator — instead return `{ kind:'unavailable', reason:'api_error', subReason:'provider_server_error', detail }`. Because `reason:'api_error'` maps (unchanged) to `failure_reason='mcp_api_error'`, which is **already** in `RETRYABLE_FAILURE_REASONS` (`autoTriggerDispatcher.ts:119`) with the existing bounded retry (one retry, 2s/8s backoff, concurrency 2), the server-side transient self-heals with **zero edit** to the retryable set, `MAX_ATTEMPTS`, the backoff, or the concurrency cap. The typed `subReason='provider_server_error'` carries the precise diagnosis; the server's short `reason` value rides through the Phase-1 sanitizer as a new allowlisted `serverReason` field (treated as an **untrusted** string — scrubbed for secret shapes + capped). Doctrine: this is operator/diagnostic plumbing only — no truth label, no user-facing string, no AI call, no secret surface widening, no submit-blocking.

---

## Doctrine constraints that shape the design

- **cdiscourse-doctrine §1 / §10a (no truth / structural only).** `provider_server_error` and `serverReason` describe a transport/server-side fact ("the MCP server returned its own error envelope"). They carry no verdict, no truth value, no user-intent. A ban-list test asserts the new vocab value is verdict-free. The classifier still produces only Machine Observations; a *failure* envelope is not a label on anyone's node.
- **cdiscourse-doctrine §6 (secrets).** The new `serverReason` is a value the **server** put in its response body — therefore **untrusted input**. It rides the SAME named-args-only + `looksSecret` scrub + cap machinery as Phase 1's `expected`/`schemaVersion`/`path`. The envelope's raw `detail` (free text, could be anything) is **never forwarded wholesale**. The allowed detail stays a closed allowlist: `{ serverReason, path, receivedKeys, family, schemaVersion, receivedType }`.
- **cdiscourse-doctrine §7 (no AI calls from the client).** Every touched file is under `supabase/functions/`. SCAN-19/20 fence the whole `booleanObservations` tree out of `src/`/`app/`; Phase 3 adds no new module and so adds no new fence entry.
- **Rules engine sacred (§5).** No file under `src/lib/constitution/`. Untouched.
- **Score never blocks posting (§1).** The dispatcher is fire-and-forget from `submit-argument`'s tail; the fix does not touch that posture. Adding a retry to a class that already had one does not make submit blocking.

---

## The bug, mechanically (so the implementer can confirm before changing anything)

Trace of an `{ isError: true, reason, path, detail }` envelope through today's adapter (`booleanObservationMcpAdapter.ts`, post-Phase-1):

1. `extracted = extractBooleanObservationResponse(responseJson)` (**actual line 172**, not `:154` — see "Anchor line-number correction"). The MCP server wraps its envelope in a recognized container (`{ result: {…} }` / `{ output: {…} }` / a `content[type:'json'].json` block), so `extractBooleanObservationResponse` returns the inner `{ isError, reason, path, detail }` object. (Phase 2's `receivedKeys=['isError','reason','path','detail']` is decisive: those keys can only have been read off `extracted`, which means `extracted` IS the envelope, not `null`.)
2. `extracted === null` check (**line 173**) — does NOT fire (`extracted` is a non-null object).
3. `parsed = parseMcpBooleanObservationResponse(extracted)` (**actual line 192**, not `:161`). Inside the parser: `isPlainObject(candidate)` is true → `parsed = candidate`; step 2 reads `parsed['schemaVersion']` → `undefined` → `undefined !== MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` → returns `{ ok:false, reason:'wrong_schema_version', details:'expected …; got undefined' }` (`mcpBooleanObservationSchema.ts:213-219`).
4. `mapToFailureSubreason('validation_failed','wrong_schema_version')` → `response_wrong_schema_version`.

**That step-3 routing is the bug.** A server-side error envelope is not a wrong-schema response; it is a provider/server transient. Phase 3 inserts the detection BEFORE step 3 so the envelope never reaches the parser.

### Anchor line-number correction (the implementer must read, not trust, the line numbers)

The intent and Phase-1 brief reference `:154` (extract) and `:161` (parse). In the **current** (post-Phase-1) `booleanObservationMcpAdapter.ts` the true anchors have shifted because Phase 1 added comment/threading lines:

| Intent anchor | Actual current line | What is there |
|---|---|---|
| `:154` extract | **`:172`** | `const extracted = extractBooleanObservationResponse(responseJson);` |
| (null guard) | **`:173-181`** | `if (extracted === null) { return … 'parse_failure' … }` |
| `:161` parse | **`:192`** | `const parsed = parseMcpBooleanObservationResponse(extracted);` |
| `:163` collapse | **`:193-205`** | `if (!parsed.ok) { return … 'validation_failed' … }` |
| `:168` belt-and-suspenders | **`:211-223`** | schema-version re-check guard |

The implementer must anchor on the **identifiers** (`extractBooleanObservationResponse`, the `extracted === null` guard, `parseMcpBooleanObservationResponse`), not the literal line numbers.

---

## Scope point 1 — the detection predicate + exact insertion point

### Predicate

A reusable, pure, total guard. Detection is on the **already-extracted** object — NOT on the raw `responseJson`, NOT inside the parser.

```ts
/**
 * True when the MCP server returned its OWN error envelope on the
 * extracted response object — a top-level `{ isError: true, … }` shape.
 * This is a provider/server-side error signal, NOT a schema-shape failure;
 * it MUST NOT be routed through parseMcpBooleanObservationResponse (which
 * would mis-type it as `wrong_schema_version` because the envelope has no
 * schemaVersion — OPS-MCP-RESULT-VALIDATION-BURST-HARDENING Phase 2).
 *
 * Pure, never throws. `isError` must be the boolean literal `true`
 * (a falsey or absent `isError` is NOT an error envelope — see Edge cases).
 */
function isServerErrorEnvelope(
  extracted: unknown,
): extracted is { isError: true; reason?: unknown; path?: unknown; detail?: unknown } {
  return (
    typeof extracted === 'object' &&
    extracted !== null &&
    !Array.isArray(extracted) &&
    (extracted as Record<string, unknown>).isError === true
  );
}
```

Notes:
- The predicate body is the same `isPlainObject` shape the adapter core already uses (`booleanObservationMcpAdapterCore.ts:156-158`) plus a strict `=== true` on `isError`. **Strict equality, not truthiness** — `isError: 1` / `isError: 'true'` / a key named `isError` holding an object must NOT trip detection (HALT-7's inverse: do not over-broaden the catch).
- The exact predicate the intent specifies (`isPlainObject(extracted) && extracted.isError === true`) is satisfied; this version additionally narrows the TS type so the subsequent `extracted.reason` / `extracted.path` reads are typed.
- The implementer MAY reuse the core's `isPlainObject` if it is exported; it is currently a private helper in the core, so the cleanest path is to inline the three-part object check in the adapter (the adapter already inlines `isHttpsUrl`). Either is acceptable; do **not** export a new symbol from the schema-mirrored files.

### Insertion point (exact)

Between the `extracted === null` guard (current `:173-181`) and the `parseMcpBooleanObservationResponse` call (current `:192`). The new block reads:

```ts
  const extracted = extractBooleanObservationResponse(responseJson);
  if (extracted === null) {
    return {
      kind: 'unavailable',
      reason: 'parse_failure',
      subReason: mapToFailureSubreason('parse_failure'),
    };
  }

  // ── OPS-MCP-RESULT-VALIDATION-BURST-HARDENING (Phase 3): detect the MCP
  //    server's OWN error envelope BEFORE the schema validator. Under
  //    concurrent load the server returns `{ isError, reason, path, detail }`;
  //    routing it through parseMcpBooleanObservationResponse mis-types it as
  //    `response_wrong_schema_version` (Phase 2). It is a provider/server
  //    transient — type it `provider_server_error`, carry it on the existing
  //    `api_error` reason so the EXISTING bounded retry (1 retry / 2s,8s /
  //    concurrency 2) heals it with NO dispatch-config edit. The server's
  //    short `reason` value rides the Phase-1 sanitizer as `serverReason`
  //    (UNTRUSTED — scrubbed + capped); the raw `detail` is NEVER forwarded.
  if (isServerErrorEnvelope(extracted)) {
    return {
      kind: 'unavailable',
      reason: 'api_error',
      subReason: 'provider_server_error',
      detail: buildFailureDetail({
        serverReason:
          typeof extracted.reason === 'string' ? extracted.reason : undefined,
        path: typeof extracted.path === 'string' ? extracted.path : undefined,
        receivedKeysFrom: extracted,
        // No `family` is plumbed at this site today (the adapter does not
        // hold the family literal); the request carries requestedFamilies
        // but the single-family is the dispatcher's concern. Leave family
        // unset — the dispatcher's log already tags `family` separately.
      }),
    };
  }

  const parsed = parseMcpBooleanObservationResponse(extracted);
  …
```

Decisions baked into the block:
- `subReason: 'provider_server_error'` is set **directly** (not via `mapToFailureSubreason`) — exactly like the belt-and-suspenders site at `:215` sets `'response_wrong_schema_version'` directly. The envelope is not a `validation_failed` collapse, so there is no `validatorReason` to delegate. (The vocab + map still gain the value for completeness — see scope point 2.)
- `reason: 'api_error'` — the carrier (scope point 2). NOT `'validation_failed'`. This is the lever.
- `serverReason` and `path` are forwarded **with scrub** (treated as untrusted server strings; see scope point 3). `receivedKeysFrom: extracted` records the envelope's key names (`['isError','reason','path','detail']` → identifier-shaped, capped) so the Phase-2-style diagnosis is preserved on the RETURN/log. The raw `detail` string is **never read** (no `detail:` arg exists on `FailureDetailInput`).

---

## Scope point 2 — `api_error`-reuse vs new `server_error` reason (DECISION + justification)

**DECISION: reuse the existing `api_error` adapter reason. Do NOT add a `server_error` reason. Do NOT edit `RETRYABLE_FAILURE_REASONS`.**

### Why api_error-reuse is correct (the narrow-dispatch lever)

The retry decision is `isSummaryRetryable(summary)` (`autoTriggerDispatcher.ts:216-220`), which is `summary.status==='failed' && RETRYABLE_FAILURE_REASONS.has(summary.failureReason)`. The retryable set is `{ mcp_network_error, mcp_api_error, mcp_rate_limited }` (`:119-123`). `unavailableReasonToFailureReason('api_error')` returns `'mcp_api_error'` (`classifyArgumentCore.ts:171-172`), which IS in the set. Therefore an envelope mapped to `reason:'api_error'`:

1. flows through the **unchanged** `classifyArgumentCore` unavailable branch (`:245-276`), which already reads `adapterResult.subReason` / `.detail` and sets `failureReason = unavailableReasonToFailureReason('api_error') = 'mcp_api_error'`, `failureSubReason = 'provider_server_error'`, `failureDetail = <sanitized>`;
2. is retryable via the **unchanged** `isSummaryRetryable` (because `'mcp_api_error' ∈ RETRYABLE_FAILURE_REASONS`);
3. is healed by the **unchanged** loop (`MAX_ATTEMPTS=2` → one retry; `RETRY_BACKOFF_MS=[2000,8000]`; bounded `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES`).

So api_error-reuse delivers the operator-approved "max one retry + bounded backoff + concurrency 2" with **NO edit** to `RETRYABLE_FAILURE_REASONS`, `MAX_ATTEMPTS`, `RETRY_BACKOFF_MS`, or `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES`. This is the smallest possible dispatch change — in fact **zero** dispatch change (the dispatcher and core are byte-equal; only the adapter gains the detection branch).

### Does api_error-reuse HARMFULLY conflate genuine HTTP api_errors? (the intent's escape hatch — evaluated)

No. The conflation is **only at the coarse `failure_reason` level**, and at that level the two classes are intentionally identical:

- A genuine HTTP `api_error` (non-OK, non-429 status — adapter `:145-152`) → `reason:'api_error'`, `subReason:'provider_api_error'`, `failure_reason='mcp_api_error'`, **retryable**.
- The `{isError}` envelope → `reason:'api_error'`, `subReason:'provider_server_error'`, `failure_reason='mcp_api_error'`, **retryable**.

Both are **transient provider/server-side conditions that SHOULD retry** — that is the whole point of `mcp_api_error` being in the retryable set. The precise diagnosis is preserved by the **distinct `subReason`** (`provider_api_error` vs `provider_server_error`) on the RETURN + log, exactly the Phase-1 design intent (the generic `failure_reason` carries compat + retryability; the typed `subReason` carries the precise class). There is no behavior the operator would want to differ between the two at the retry layer. **Conclusion: api_error-reuse is not harmful; it is the designed-for path. Default chosen.**

The alternative (a new `server_error` reason + a `RETRYABLE_FAILURE_REASONS` entry) is rejected: it would require editing the dispatcher's retryable set (touching dispatch config — a HALT-adjacent surface that THR-7/FAIL-10 lock), add a new `unavailableReasonToFailureReason` arm, and a new `BooleanObservationUnavailableReason` union member (which is in the schema-adjacent core) — all for zero behavioral gain over the distinct `subReason`. Larger surface, no benefit.

### The `provider_server_error` vocab addition + map / exhaustiveness impact

`booleanObservationFailureSubreason.ts`:

- Add `'provider_server_error'` to the `BooleanObservationFailureSubreason` union, in the **provider/transport** group (next to `provider_api_error`):
  ```ts
    // provider/transport
    | 'provider_timeout' // RESERVED — folded into network_error today
    | 'provider_rate_limited'
    | 'provider_api_error'
    | 'provider_server_error' // body-level { isError } envelope (Phase 3)
    | 'provider_network_error'
  ```
- Add `'provider_server_error'` to `ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS` in the **same declared position** (so the "declared order" assertion in the failure-subreason suite stays a deterministic, ordered list). The constant grows from 15 → **16** values.
- **`mapToFailureSubreason` impact:** the adapter sets `provider_server_error` **directly** (the envelope is not a validator collapse), so the *value* does not need a new return arm in `mapToFailureSubreason`. BUT the union is now wider, so any exhaustive `switch` over `BooleanObservationFailureSubreason` would break. Audit shows the two switches in the module are over **`McpBooleanObservationParseFailureReason`** (`mapValidatorReason`) and over **`BooleanObservationUnavailableReason`** (`mapToFailureSubreason`) — **neither switches over `BooleanObservationFailureSubreason`**, so neither needs a new arm. The `_exhaustive: never` guards are over the *input* unions (validator reasons / adapter reasons), which are unchanged. **No exhaustiveness break.** (The design intent — "keep the vocab complete" — is satisfied by the union + `ALL_…` additions; the map is whole because nothing maps *to* `provider_server_error`, the adapter sets it inline, mirroring the existing `response_wrong_schema_version` belt-and-suspenders precedent.)
- The distinction the intent requires is preserved: `provider_api_error` (HTTP-level, adapter `:145-152`) stays HTTP-level; `provider_server_error` is the NEW body-level `{isError}` envelope class. They are siblings, never merged.

---

## Scope point 3 — the `serverReason` sanitizer extension

`booleanObservationFailureSubreason.ts` — extend BOTH the input and the output, through the SAME machinery. `serverReason` and `path` come **from the server response body → UNTRUSTED** → forwarded **with scrub + cap** (NOT a static-allowlist field, NOT echoed raw).

### Output interface — add `serverReason`

```ts
export interface BooleanObservationFailureDetail {
  validatorReason?: McpBooleanObservationParseFailureReason;
  path?: string;
  expected?: string;
  receivedType?: string;
  receivedKeys?: string[];
  checkedRawKey?: string;
  schemaVersion?: string;
  family?: MachineObservationFamily;
  /**
   * OPS-MCP-RESULT-VALIDATION-BURST-HARDENING (Phase 3): the MCP server's
   * OWN short error code, read off its `{ isError, reason }` envelope under
   * load. UNTRUSTED server input — scrubbed for secret shapes + capped, the
   * same way `expected`/`schemaVersion` are. NEVER the raw `detail` blob.
   */
  serverReason?: string;
}
```

### Input — add `serverReason` to `FailureDetailInput`

```ts
export interface FailureDetailInput {
  validatorReason?: McpBooleanObservationParseFailureReason;
  path?: string;
  expected?: string;
  received?: unknown;
  receivedKeysFrom?: unknown;
  checkedRawKey?: string;
  schemaVersion?: string;
  family?: MachineObservationFamily;
  /** UNTRUSTED server-supplied error code; scrubbed + capped like `expected`. */
  serverReason?: string;
}
```

### Builder body — one new block, mirroring `expected`

Insert alongside the `expected` handling (`buildFailureDetail`, ~`:349-351`):

```ts
  if (typeof input.serverReason === 'string' && !looksSecret(input.serverReason)) {
    detail.serverReason = input.serverReason.slice(0, MAX_EXPECTED_PATH_CHARS);
  }
```

And add `serverReason` to the **defense-in-depth scrub pass** (~`:386-397`), mirroring the `expected`/`schemaVersion` deletes:

```ts
  if (detail.serverReason !== undefined && looksSecret(detail.serverReason)) {
    delete detail.serverReason;
  }
```

And include `serverReason` in the **graceful-degradation cap** if it could push the serialized size over budget. The existing cap order (drop `receivedKeys` → truncate `path`/`expected` → fall back to `{validatorReason, schemaVersion}`) is sufficient: `serverReason` is already `slice(0, 200)`-capped on entry, and the last-resort `minimal` object drops it. **No new cap tier needed** — but the implementer should re-truncate `serverReason` in the same tier as `path`/`expected` for symmetry:

```ts
  // tier 2 (alongside path/expected truncation):
  if (typeof detail.serverReason === 'string') {
    detail.serverReason = detail.serverReason.slice(0, MAX_EXPECTED_PATH_CHARS);
  }
```

### Forward-with-scrub vs untrusted — explicit

- `serverReason` — **untrusted server string, forwarded with scrub**. It is NOT validated against a static allowlist (the server can emit any short code; we don't want to drop legitimate diagnostic codes). It IS run through `looksSecret` (drops anything matching a secret shape) and `slice(0, 200)` (cap). This matches Phase 1's treatment of `expected`/`schemaVersion` (also forwarded-with-scrub, not allowlisted).
- `path` (when sourced from the envelope at the new site) — **untrusted server string, but still allowlist-gated** by the EXISTING `ALLOWED_DETAIL_PATHS` check in `buildFailureDetail` (`:345`). A server `path` value not in the validator's known field-path allowlist is **dropped** (returns absent). This is *stricter* than `serverReason` and is correct: a `path` is supposed to be a structural field path; if the server sends junk there, dropping it loses nothing. (Net effect: at the new envelope site, `path` will usually be dropped unless the server happens to name a real schema field — that is acceptable; `serverReason` + `receivedKeys` carry the diagnosis.)
- `receivedKeysFrom: extracted` — the envelope's **key names only** (`deriveReceivedKeys`), identifier-stripped + capped + secret-scrubbed (existing machinery). Values are never read.
- The envelope's raw `detail` — **never forwarded.** There is no `detail` arg on `FailureDetailInput`; the raw blob has no entry point. (HARD BAN preserved: prompt, body, raw model/provider payload, JWT, Bearer, service-role, Authorization, API key.)

---

## Scope point 4 — retry narrowly (confirm: NO dispatch-config edit)

- **Only** the `{isError}` / `provider_server_error` class gains retry-on-this-path, and it does so **solely** because it is carried on `api_error` (already retryable). No new class becomes retryable.
- `response_wrong_shape`, `response_missing_required_field`, `response_not_json`, and the belt-and-suspenders `response_wrong_schema_version` stay **NON-retryable** — they still map to `reason:'validation_failed'`/`'parse_failure'` → `failure_reason='mcp_validation_failed'`/`'mcp_parse_failure'`, NEITHER of which is in `RETRYABLE_FAILURE_REASONS`. Phase 2 only observed the envelope, never these — they stay non-retryable. (HALT-1 guard.)
- **`RETRYABLE_FAILURE_REASONS` is UNEDITED.** `MAX_ATTEMPTS` (2), `RETRY_BACKOFF_MS` ([2000,8000]), and `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` are UNEDITED. The dispatcher and `classifyArgumentCore` are **byte-equal** (the threading they need already shipped in Phase 1).
- Max ONE retry. Concurrency 2. No broad/global retry. (HALT-1/2 respected.)

**Confirmation: no dispatch-config edit is needed.** The only production-code change is in `booleanObservationMcpAdapter.ts` (the detection branch) and `booleanObservationFailureSubreason.ts` (the `+1` vocab value and the `serverReason` field). The retry path is delivered entirely by the existing, unchanged dispatch machinery via the `api_error` carrier.

---

## Scope point 5 — preserve compatibility (the diff boundary)

### Files changed (the ONLY production-code edits)

All under `supabase/functions/_shared/booleanObservations/`. Estimates are net new/changed lines.

- **`booleanObservationMcpAdapter.ts`** (Deno-only) — add the `isServerErrorEnvelope` predicate (or inline check) + the detection `return` block between the `extracted === null` guard and the `parseMcpBooleanObservationResponse` call. No other return changes. **~18–28 lines** (predicate + block + comment).
- **`booleanObservationFailureSubreason.ts`** (pure) — add `'provider_server_error'` to the union + `ALL_…` (16 values); add `serverReason` to `FailureDetailInput` + `BooleanObservationFailureDetail`; add the `serverReason` build block + the defense-in-depth scrub delete + the tier-2 re-truncate. **~12–18 lines.**

### Files explicitly NOT changed (byte-equal — the diff boundary)

- **`autoTriggerDispatcher.ts`** — byte-equal. `RETRYABLE_FAILURE_REASONS`, `MAX_ATTEMPTS`, `RETRY_BACKOFF_MS`, `isSummaryRetryable`, `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES`, the loop, and the terminal-failure log emit (which already passes `failure_sub_reason`/`failure_detail`) are unchanged. The new `provider_server_error` value + `serverReason` field flow through the existing `failure_sub_reason: terminal?.failureSubReason` / `failure_detail: terminal?.failureDetail` (`:349-350`) with NO edit.
- **`classifyArgumentCore.ts`** — byte-equal. The unavailable branch (`:245-276`) already reads `adapterResult.subReason` / `.detail` and sets `failureSubReason`/`failureDetail`; `unavailableReasonToFailureReason('api_error') → 'mcp_api_error'` (`:171-172`) is unchanged; the `failure_reason` pipeline is intact. **No edit.**
- **`autoTriggerLog.ts`** — byte-equal. `AutoTriggerLogFields.failure_sub_reason` / `.failure_detail` are typed via the imported `BooleanObservationFailureSubreason` / `BooleanObservationFailureDetail`; the wider union + new field are picked up by the import automatically. **No edit.**
- **`booleanObservationMcpAdapterCore.ts`** — byte-equal. `BooleanObservationUnavailableReason`, `ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS`, `BooleanObservationAdapterResult`, `extractBooleanObservationResponse`, `sanitizeBooleanObservationRawPayload`, `buildBooleanObservationToolRequestBody` are unchanged. (`extractBooleanObservationResponse` already passes the envelope through to `extracted` — confirmed; no edit needed.)
- **`mcpBooleanObservationSchema.ts`** + its two mirrors (`mcp-server/lib/mcpBooleanObservationSchemaMirror.ts`, `src/features/nodeLabels/mcpBooleanObservationSchema.ts`) — byte-equal. The validator, `McpBooleanObservationParseFailureReason`, `MAX_*` constants stay schema-mirror-parity-pinned (HALT-5/schema-mirror). The fix does NOT teach the parser about `isError` (that would be a schema-mirror change); it detects the envelope *before* the parser.
- **No migration** (`supabase/migrations/`). **No DB column** (`failure_subreason`/`failure_detail`/`server_reason`). (HALT-3.)
- **`familyRegistry.ts`, `booleanObservationRequestBuilder.ts`, `persistenceWriter.ts`, `runModeConstants.ts`, `boundedConcurrencyRunner.ts`, `autoTriggerConcurrency.ts`, `classify-argument-boolean-observations/index.ts`, `submit-argument/index.ts`** — untouched. No family enabled → no Family H (HALT). No prompt / taxonomy / Source-6 / production-flag / audit-lint / package.json change (HALT-5).

---

## Scope point 6 — test plan (the operator's required a–h) + file names

The coverage-wall split is the repo's established one (confirmed in the Phase-1 suites): the **pure module** (`booleanObservationFailureSubreason.ts`) and the **pure schema/core helpers** (`mcpBooleanObservationSchema.ts`, `booleanObservationMcpAdapterCore.ts`) are **Jest-loadable** via the `_helpers/booleanObservation*Deno.ts` bridges → behavioral tests; the **Deno adapter** (`booleanObservationMcpAdapter.ts`) and the **npm-coupled** `classifyArgumentCore.ts` / `autoTriggerDispatcher.ts` are **NOT Jest-loadable** → source-scan. Phase 3 matches that split exactly.

### Recovery/retry seam DECISION (no new production seam)

The intent invites "a thin loadable seam … if a behavioral retry-recovery test needs one." **Decision: do NOT add a production seam.** The recovery semantics (e/f) decompose into two provable halves, mirroring how Phase 1 + the parallelization card proved retry:

1. **Behavioral half (Jest-loadable):** the envelope is classified into the **retryable `api_error`/`mcp_api_error` class**, and the bug-vs-fix routing is provable on the pure schema bridge:
   - `edgeExtractBooleanObservationResponse({result:{isError:true,reason:'overloaded',path:'x',detail:'…'}})` returns the `{isError,…}` object (so detection on `extracted` is viable).
   - `edgeParseMcpBooleanObservationResponse({isError:true,reason:'overloaded'})` returns `{ok:false, reason:'wrong_schema_version'}` — **the bug, reproduced behaviorally** (proves WHY the envelope must be intercepted first).
   - `edgeBuildFailureDetail({serverReason:'overloaded', receivedKeysFrom:{isError:true,reason:'x',path:'y',detail:'z'}})` returns a detail carrying `serverReason:'overloaded'` and `receivedKeys` including `isError`.
2. **Source-scan half (the loop mechanism):** the dispatcher's retry loop is byte-equal — `mcp_api_error ∈ RETRYABLE_FAILURE_REASONS` (FAIL-10/THR-7, confirmed unchanged), `MAX_ATTEMPTS=2`, break-on-success — so a `mcp_api_error` failure followed by a success recovers, and a repeated `mcp_api_error` fails after exactly one retry. The adapter source-scan proves the envelope is mapped to `reason:'api_error'` + `subReason:'provider_server_error'` and NOT to `validation_failed`/`response_wrong_schema_version`.

This is an honest behavioral proof of the **fix's decision logic** + a source-scan of the **unchanged loop** — the strongest evidence the coverage wall allows without moving dispatch config (which would be HALT-adjacent). The "recovers to SUCCESS" claim (e) is the conjunction: *(behavioral) envelope → retryable `mcp_api_error` class* ∧ *(source-scan) the unchanged loop recovers a `mcp_api_error` on a subsequent success*. Documented as such in the test comments so a reviewer reads the composition, not a gap.

### New test file: `__tests__/mcpOneTwoOneCServerErrorEnvelope.test.ts` (the Phase-3 bulk)

Behavioral (via the `_helpers/booleanObservationFailureSubreasonDeno.ts` + `_helpers/booleanObservationEdgeDeno.ts` bridges) + adapter source-scan, all in one Phase-3-named suite.

- **(a) envelope detected BEFORE schema validation** — `SEV-1`: source-scan `booleanObservationMcpAdapter.ts` — the `isError` detection block's index is **less than** the `parseMcpBooleanObservationResponse(` call index (detection precedes the parser); AND the detection block's index is **greater than** the `extracted === null` guard index (it sits after extraction). `SEV-2` (behavioral, the bug reproduction): `edgeParseMcpBooleanObservationResponse({isError:true,reason:'overloaded'})` → `reason==='wrong_schema_version'` (proves that IF the envelope reached the parser it would mis-type — the justification for detecting first).
- **(b) typed sub-reason = `provider_server_error`** — `SEV-3` (source-scan): the adapter's `isError` block sets `subReason: 'provider_server_error'` and the literal does NOT appear anywhere paired with a `validation_failed` reason. `SEV-4` (behavioral): `EDGE_ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS` contains `'provider_server_error'`, in the provider group, and the constant length is 16.
- **(c) generic `mcp_api_error` maps correctly** — `SEV-5` (source-scan, confirms FAIL-4 unchanged): `classifyArgumentCore.ts` still maps `'api_error' → 'mcp_api_error'`. `SEV-6` (source-scan): the adapter's `isError` block uses `reason: 'api_error'` (the carrier), NOT `reason: 'validation_failed'`.
- **(d) envelope is retryable** — `SEV-7` (source-scan, confirms FAIL-10/THR-7 unchanged): `RETRYABLE_FAILURE_REASONS` still contains `mcp_api_error` and still does NOT contain `mcp_validation_failed`; `MAX_ATTEMPTS=2` byte-equal; `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` referenced. (This is the "retryable" assertion; combined with SEV-5/SEV-6 it proves the envelope rides the retryable class.)
- **(e) first-attempt `{isError}` then valid → recovers to SUCCESS** — `SEV-8` (composition test, documented): behavioral leg asserts `edgeMapToFailureSubreason('api_error') === 'provider_api_error'` (the carrier reason is a provider class) and the envelope → `api_error` (SEV-6); source-scan leg asserts the loop `break`s on `lastSummary.status === 'success'` (the success short-circuit at `:287-303` is byte-equal) so a retry attempt that returns success terminates with `outcome:'triggered'`. The test comment states the conjunction explicitly.
- **(f) repeated `{isError}` → fails after bounded retry, typed + sanitized** — `SEV-9` (composition): source-scan leg asserts the loop's terminal emit (`:336-353`) passes `failure_sub_reason: terminal?.failureSubReason` + `failure_detail: terminal?.failureDetail`, and the retry is bounded by `MAX_ATTEMPTS=2` (one retry); behavioral leg asserts a repeated-envelope detail is sanitized (`edgeBuildFailureDetail` over the envelope yields only allowlisted fields). Combined: a repeated envelope fails after exactly one retry, surfacing `failureSubReason:'provider_server_error'` + a sanitized `failureDetail` on the RETURN/log.
- **(g) ordinary malformed response still types `response_*` and is NOT broadly retried** — `SEV-10` (behavioral regression): `edgeMapToFailureSubreason('validation_failed','wrong_shape') === 'response_wrong_shape'` and `('validation_failed','missing_required_field') === 'response_missing_required_field'` — unchanged by the envelope branch. `SEV-11` (source-scan regression): `RETRYABLE_FAILURE_REASONS` does NOT contain `mcp_validation_failed` (a malformed-schema failure is NOT retryable); the adapter's `validation_failed` collapse site (`:193-205`) is byte-equal (still delegates via `mapToFailureSubreason('validation_failed', parsed.reason)`). `SEV-12` (behavioral, the discriminator): a non-`isError` object (`{schemaVersion:'wrong'}`) does NOT satisfy `isServerErrorEnvelope` — proved by reproducing that such an object routes to the parser → `wrong_schema_version` (i.e. the fix does NOT swallow ordinary wrong-schema responses into the envelope path).
- **(h) banned detail stripped + no raw model/provider/prompt/auth in return/log** — `SEV-13` (behavioral HOSTILE, the HALT-4 wall): `edgeBuildFailureDetail({ serverReason:<a Bearer-token shape>, path:<a JWT triple>, receivedKeysFrom:{ 'sb_secret_…':1, prompt:'…', authorization:'…' }, expected:<sk-ant- shape> })` → assert the result contains **none** of the banned shapes (regexes assembled from fragments), `serverReason` is **dropped** when it trips `looksSecret`, and `receivedKeys` are identifier-shaped name-only. `SEV-14` (behavioral): a benign `serverReason:'rate_limit_exceeded'` survives (proves scrub is shape-based, not a blanket drop) and is `slice`-capped. `SEV-15` (behavioral): a 5000-char `serverReason` → result serialized length ≤ 2000 (the cap holds) and `serverReason` is ≤ 200 chars.

### Edited test files (the established suites — confirm-unchanged + extend)

- **`__tests__/mcpOneTwoOneCEdgeAdapterSourceScan.test.ts`** — add `SCAN-26..28`: the adapter contains the `isError` detection (`/\.isError\s*===\s*true/` after the `extracted === null` guard); the adapter's `isError` block carries `reason: 'api_error'` and `subReason: 'provider_server_error'` (NOT `validation_failed`); SCAN-23's "never reads `parsed.details`" is **re-confirmed** (the new block reads `extracted.reason`/`extracted.path`, NOT `parsed.details` — the `.details` ban stays green because `extracted.reason` ≠ `parsed.details`). SCAN-17 already covers the new file for no-secret-literal (the file isn't new; only +1 value + 1 field). SCAN-24/25 (no console / no Deno.env in the pure module) stay green.
- **`__tests__/booleanObservationFailureSubreason.test.ts`** — add: `ALL_…` length is 16 and contains `'provider_server_error'` in the provider group (declared-order assertion updated to 16); the ban-list assertion scans the now-16-value list for verdict tokens (so `provider_server_error` is proven verdict-free); the sanitizer `serverReason` cases (forward benign, scrub secret-shape, cap 200, contributes to the 2000 serialized cap, dropped-when-secret). These are the behavioral home for SEV-13..15's sanitizer specifics if the implementer prefers them co-located with the other `buildFailureDetail` tests rather than in the new file — **either placement is fine; do not duplicate.**
- **`__tests__/mcpOneTwoOneCAutoTriggerFailureMode.test.ts`** — add `FAIL-26`: confirm (no code change expected) `RETRYABLE_FAILURE_REASONS` is byte-equal (still the 3-element set; `mcp_api_error` present, `mcp_validation_failed` absent) AFTER Phase 3 — the HALT-1 regression guard. FAIL-1..25 stay green untouched.

### Doctrine ban-list assertion

Folded into `booleanObservationFailureSubreason.test.ts` (extended): no value in `ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS` (now 16) contains any of `winner|loser|true|false|correct|liar|dishonest|bad faith|manipulative|extremist|propagandist|stupid|idiot`. (`provider_server_error` and `serverReason` are structural transport facts — verdict-free.)

### Forecast

**+18 to +26 tests** (new suite SEV-1..15 ≈ 15; failure-subreason additions ≈ 5–8; adapter source-scan SCAN-26..28 ≈ 3; FAIL-26 ≈ 1; ban-list extension is an edit). Within the intent's **+15..+30** band; **well under the +50 HALT ceiling.** No HALT fired.

---

## Scope point 7 — reviewer-focus list (intent §7)

1. **Not a broad retry.** The ONLY class that newly retries-on-this-path is the `{isError}`/`provider_server_error` envelope, and ONLY because it is carried on the already-retryable `api_error`. Confirm `RETRYABLE_FAILURE_REASONS` is **byte-equal** (3 elements; `mcp_validation_failed` absent). (HALT-1.)
2. **Retry only for the typed provider/server class.** `response_wrong_shape`/`missing_field`/`not_json`/the belt-and-suspenders `response_wrong_schema_version` stay NON-retryable (their `failure_reason` is not in the set). Confirm the adapter's `validation_failed`/`parse_failure` collapse sites are byte-equal.
3. **Concurrency bounded 2.** `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` UNEDITED; no concurrency >2. (HALT-2.)
4. **Retry doesn't bypass doctrine guards.** No truth label; `provider_server_error`/`serverReason` are verdict-free (ban-list test). The classifier still produces only Machine Observations.
5. **No submit-blocking reintroduced.** `submit-argument` is byte-equal; the dispatcher stays fire-and-forget. Adding a retry to an already-retryable class does not change the fire-and-forget posture. (HALT-6.)
6. **Typing safe/sanitized.** `serverReason` is untrusted-input forwarded-with-scrub (`looksSecret` + 200-cap); the raw `detail` is never forwarded; the HOSTILE test proves banned shapes are stripped. The detail allowlist stays closed. (HALT-4.)
7. **No migration slipped in.** Zero files under `supabase/migrations/`; no `failure_subreason`/`failure_detail`/`server_reason` column. (HALT-3.)
8. **No family/prompt/schema-mirror change.** `familyRegistry.ts` byte-equal (no Family H); `mcpBooleanObservationSchema.ts` + its two mirrors byte-equal (the fix detects the envelope BEFORE the parser, never teaches the parser about `isError`); no prompt/taxonomy/Source-6/flag/audit-lint/package.json. (HALT-5/7.)
9. **The envelope is detected, not routed through the validator.** Confirm the `isError` block precedes `parseMcpBooleanObservationResponse(extracted)` and the envelope never reaches the parser. (HALT-7 — the bug.)

---

## Scope point 8 — Phase 4 (gated SPEND, post-merge) — context only, NOT built here

Per intent §6.8, AFTER this Phase-3 merge auto-deploys: a canary-first, synthetic smoke-tagged verify of families A–G (no H/I/J), concurrency ≤2, confirming 7 production families, no duplicate runs, overlap=2, submit nonblocking, no 429, **p95 < 30s WITH the retry in place** (a retry adds a ~5s second attempt — must not breach the 30s budget), and **run-completeness** (every (argument,family) cell ends `status=success`). Phase 4 is a separate operator-approved SPEND step; nothing in it is designed or built in this card.

---

## Edge cases (the implementer must handle each)

- **Envelope with a missing/non-string `reason`** — `isError: true` present but `reason` absent or non-string. Detection still fires (the predicate keys only on `isError === true`). `buildFailureDetail` receives `serverReason: undefined` (the inline `typeof extracted.reason === 'string' ? … : undefined`), so `serverReason` is simply absent from the detail. `receivedKeys` still records `['isError', …]`. No crash; the envelope is still typed `provider_server_error` and is still retryable. The diagnosis degrades gracefully to "an isError envelope with keys X" — strictly better than the current `response_wrong_schema_version` mis-type.
- **Object that is NOT an error envelope (`isError` falsey / absent / non-`true`)** — e.g. `{ isError: false, schemaVersion: '…', … }` (a normal response that happens to carry an `isError:false` field) OR `{ schemaVersion: 'wrong' }` (a genuine wrong-schema response). The strict `=== true` predicate does NOT fire → the object proceeds to `parseMcpBooleanObservationResponse` exactly as today → a genuine wrong-schema response still types `response_wrong_schema_version` and stays NON-retryable. **The fix is surgical: it intercepts ONLY `isError === true` envelopes.** (SEV-12 proves this.)
- **The belt-and-suspenders schema-version path (`:211-223`)** — unreachable by an `isError` envelope (the envelope is intercepted earlier and never reaches `parsed.response`). This guard still fires only for a parser-OK response whose `schemaVersion` somehow mismatches — byte-equal behavior, still types `response_wrong_schema_version` directly. No interaction with the new branch.
- **Envelope nested differently than expected** — if a future server wraps `{isError}` such that `extractBooleanObservationResponse` returns `null` (not the envelope), the existing `extracted === null` guard fires first → `parse_failure`/`response_not_json` (NON-retryable). That is the pre-Phase-3 behavior for an unrecognized envelope; Phase 3 does not regress it. (Phase 2 proved the current server nests it recognizably, so `extracted` IS the envelope today; this edge is forward-defense only.)
- **Envelope `detail` is a huge/hostile blob** — never read (no `detail:` arg). `receivedKeysFrom: extracted` records only the key names (`detail` as a *name*, 6 chars, identifier-shaped), never its value. The cap + scrub guard the rest. (SEV-13/15.)
- **`serverReason` carries a secret shape** (a misbehaving/compromised server echoing a token in its `reason`) — `looksSecret` drops it; the field is absent. (HALT-4; SEV-13.)
- **`path` from the envelope is junk** (not a known schema field) — `ALLOWED_DETAIL_PATHS` gate drops it. No leak, minor diagnosis loss (acceptable; `serverReason`+`receivedKeys` carry the signal).
- **Concurrent burst (the originating scenario)** — the fix adds no shared mutable state; `isServerErrorEnvelope` + `buildFailureDetail` are pure per-call. Each concurrent envelope is classified independently. The bounded-concurrency dispatch (=2) and the per-family retry are unchanged. Under the burst, each of the (formerly) 3/30 mis-typed failures now types `provider_server_error` + retries once with 2s/8s backoff — the backoff spaces the retry off the burst peak, which is exactly the heal the operator approved.
- **Doctrine edge — does `provider_server_error` or `serverReason` imply a verdict?** No. "The MCP server returned its own error envelope under load" is a transport/server fact. `serverReason` is the server's short code, scrubbed. Neither says "wrong", "false", "winner", "bad faith". The ban-list test locks this.

---

## Risks

- **Over-broadening the catch (the central correctness risk).** A truthiness check (`if (extracted.isError)`) would swallow `{isError:0}`, `{isError:''}`, or even a node whose data legitimately includes an `isError`-shaped field, hiding real wrong-schema/wrong-shape failures behind a retryable `provider_server_error`. **Mitigation:** strict `=== true`; SEV-12 proves a non-`true` object still routes to the parser. The reviewer must confirm the strict equality.
- **Anchor line-number drift.** The intent says `:154`/`:161`; Phase 1 shifted the real anchors to `:172`/`:192`. A careless implementer trusting the literal numbers would insert the block in the wrong place. **Mitigation:** the "Anchor line-number correction" table; anchor on identifiers, not numbers.
- **Schema-mirror tripwire (HALT-5/7).** The tempting "fix" is to teach `parseMcpBooleanObservationResponse` to recognize `{isError}` — that touches the parity-pinned `mcpBooleanObservationSchema.ts` (and its two mirrors) and would mis-type the envelope as a schema concern rather than a transport one. **Mitigation:** the design forbids any parser edit; detection is in the adapter, before the parser.
- **`serverReason` secret-surface regression (HALT-4).** `serverReason` is the FIRST detail field sourced directly from the server response body (Phase 1's `expected`/`schemaVersion` were constants/version strings; `path` was allowlist-gated). It is the new secret-surface entry point. **Mitigation:** forwarded-with-scrub (`looksSecret` + cap), the raw `detail` never forwarded, the HOSTILE test (SEV-13) is migration-grade. The reviewer should treat `serverReason` as the verification focal point.
- **Reviewer may read "recovers to SUCCESS" (e) as un-proven behaviorally.** Because the dispatcher loop is not Jest-loadable, the recovery claim is a documented composition (behavioral classification + source-scanned loop). **Mitigation:** the test comments state the conjunction explicitly; FAIL-8/10 + THR-7 already lock the loop; this matches how every prior MCP-021C card proved retry. A reviewer expecting a single behavioral "two-call recovery" test should be pointed at the coverage-wall note in `_helpers/booleanObservationEdgeDeno.ts`.
- **`ALL_…` declared-order assertion breakage.** Adding `provider_server_error` mid-array shifts indices; a test asserting exact contents/length must be bumped 15→16. **Mitigation:** SEV-4 + the failure-subreason suite edit explicitly set 16 and the provider-group position.
- **No operator deploy beyond the auto-deploy.** The change ships to production on the next merge-to-main (Supabase GitHub integration redeploys Edge Functions on merge). The change is additive + inert except the new retry-on-envelope behavior, which is bounded by the existing loop. No migration → no `db push`.

---

## Out of scope (explicit — reduces scope creep)

- **Any broad retry / dispatch-config change.** `RETRYABLE_FAILURE_REASONS`, `MAX_ATTEMPTS`, `RETRY_BACKOFF_MS`, `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` stay byte-equal. (HALT-1/2.)
- **A new `server_error` adapter reason / a new `RETRYABLE_FAILURE_REASONS` entry.** Rejected in favor of `api_error`-reuse (scope point 2).
- **Teaching the parser about `isError`.** The parser + its mirrors stay byte-equal. (HALT-5/7.)
- **Any migration / DB column / `serverReason` persistence.** Log/RETURN only, per Stage 2B. (HALT-3.)
- **Distinguishing `provider_timeout` from `provider_network_error`, evidence-span / ban-list detectors.** Phase-1 reserved entries stay reserved; no new emitters minted.
- **Any Family H work / family flip / concurrency change / Source-6 / prompt / taxonomy / flag / audit-lint / package.json.** Frozen. (HALT.)
- **Phase 4 verify / Phase 5 verdict.** Context only (scope point 8); not built here.
- **User-facing surfacing.** `provider_server_error`/`serverReason` are operator/diagnostic; no UI, no `gameCopy` entry, no timeline render.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels):** `provider_server_error` + `serverReason` are transport/server-side facts; a ban-list test (extended to 16 values) asserts no verdict token. The `detail` carries structural names + typeofs + a scrubbed short code — no truth claim is expressible. ✔
- **cdiscourse-doctrine §3 (popularity ≠ evidence):** untouched — no engagement/heat input anywhere in scope. ✔
- **cdiscourse-doctrine §5 (rules engine sacred):** no file under `src/lib/constitution/`; the touched files are the Edge tree. The schema parser + its mirrors are byte-equal. ✔
- **cdiscourse-doctrine §6 (secrets):** `serverReason` is untrusted server input forwarded-with-scrub (`looksSecret` + 200-cap) through the EXISTING named-args-only builder; the raw envelope `detail` is never forwarded (no entry point); the cap + defense-in-depth scrub + HOSTILE test (SEV-13) hold the line. The allowlist stays closed (`{serverReason, path, receivedKeys, family, schemaVersion, receivedType}`). ✔
- **cdiscourse-doctrine §7 (no AI calls from the client):** every touched file is under `supabase/functions/`; SCAN-19/20 fence the tree out of `src/`/`app/`; no new module added → no new fence entry needed. ✔
- **cdiscourse-doctrine §8 (Supabase conventions):** no migration, no RLS change, no table/column change. ✔
- **cdiscourse-doctrine §9 (plain language):** N/A — operator/diagnostic field, never user-facing; §9 governs user-facing strings. ✔
- **cdiscourse-doctrine §10a (Observations vs Allegations):** the classifier still produces only Machine Observations; a server *error envelope* is a failure diagnostic, not a label on anyone's node. ✔
- **test-discipline:** the pure module (`provider_server_error` value + `serverReason` sanitizer) gets behavioral Jest tests incl. the HOSTILE wall; the bug-vs-fix routing is proved behaviorally on the pure schema bridge; the Deno adapter + dispatcher are source-scanned (the established coverage wall); the doctrine ban-list test is extended to 16; forecast +18..+26 (under +50). ✔
- **HALT triggers:** none fired. No broad retry (the retryable set is byte-equal); concurrency unchanged; no migration/column; banned detail structurally cannot reach the return/log (incl. `serverReason`, scrubbed); no schema-mirror/prompt/flag/audit-lint/package.json; submit stays non-blocking; the envelope is **detected before** the schema validator (the bug is corrected, not routed through); forecast within band. ✔

---

## Operator steps (if any)

**None for the design.** For the eventual **implementation** merge: the Supabase GitHub integration auto-redeploys Edge Functions on merge to `main` (per memory "Supabase merge auto-deploy"), so no manual `functions deploy` is required — the detection branch + the additive vocab/field ship with the next deploy. There is **no migration**, so **no `db push`**. (Phase 4's gated SPEND verify is a separate, operator-approved step — NOT part of this Phase 3 implementation.)
