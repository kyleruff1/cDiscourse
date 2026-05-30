# OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — Phase 1 (TYPE) design

**Status:** Design draft
**Epic:** Epic 12 / MCP semantic-referee track (OPS reliability card; not a board card)
**Release:** Post-Stage-6.4 OPS hardening (MCP-021C-EDGE auto-trigger family chain)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/365
**Intent (binding):** `docs/designs/OPS-MCP-RESULT-VALIDATION-BURST-HARDENING-intent.md`
**Card type:** production classifier-coverage RELIABILITY card. **Phase 1 of a multi-phase card.** This document designs **Phase 1 (TYPE) only** — the typed sub-reason at the failure point, the RETURN/log surface, and the sanitizer. NO fix, NO retry change, NO migration, NO concurrency change, NO Family H.

---

## Goal (one paragraph)

The `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION` smoke (PARTIAL) found 4/35 family runs failing with `failure_reason='mcp_validation_failed'` under a burst, clustered at peak 7–8 concurrency, ~4–8s duration — i.e. a **result-side** failure (the MCP server answered, but the answer failed the MCP-021A validator), not a request-corruption. Today the adapter **discards** the validator's granular `{reason, details}` (`booleanObservationMcpAdapter.ts:163`/`:168`) and collapses everything to a single opaque `validation_failed`, so the operator cannot tell *which* validation rule failed without re-running. Phase 1 stops the discard: it threads a **typed sub-reason** (a controlled `request_*` / `response_*` / `provider_*` vocabulary) plus a **bounded, sanitized detail** through the adapter result and onto the classify-function RETURN (`PerArgumentSummary`) and structured log — so the Phase 2 reproduction harness can read the dominant failure class **synchronously off the RETURN** (logs are not CLI-queryable per Phase 0 finding 0c). This is a **non-spend, type-only** change. Per the operator's Stage 2B decision it is a **log/RETURN path with NO migration, NO DB column** — the run row's `failure_reason` stays `mcp_validation_failed` for compatibility (audit-lint + prior smokes + existing readers key on that literal — HALT-9). The new `detail` field is a **secret-surface**; a pure allowlist sanitizer (cdiscourse-doctrine §6) guards it so no prompt, body, raw model response, JWT, Bearer, service-role, or API key can ever reach the RETURN or the log (HALT-4).

---

## Doctrine constraints that shape the design

- **cdiscourse-doctrine §6 (secrets)** — the new `detail` field extends the adapter's existing "never logs the token / URL / Authorization / Bearer / raw body" posture (`booleanObservationMcpAdapter.ts:1-54`). The sanitizer is an **allowlist**, not a denylist.
- **cdiscourse-doctrine §1 / §10a (no truth / structural only)** — the sub-reason vocabulary describes *transport + schema-shape* facts (`response_wrong_shape`, `provider_rate_limited`). It carries **no verdict, no truth value, no user-intent attribution**. It is not user-facing — it is an operator/diagnostic field on an admin-gated RETURN + an Edge log. No `gameCopy.toPlainLanguage` mapping is required (§9 applies to *user-facing* strings; this never renders to a user).
- **cdiscourse-doctrine §7 (no AI calls from the client)** — every file touched is under `supabase/functions/`. The source-scan test (`mcpOneTwoOneCEdgeAdapterSourceScan.test.ts` SCAN-19/20) already fences the whole `booleanObservations` tree out of `src/`/`app/`; the new pure module stays inside that fence.
- **Rules engine is sacred (§5)** — untouched. No file under `src/lib/constitution/` is in scope.

---

## Data model

**No new data model. No migration. No DB column.** (HALT-3.)

Phase 1 adds **TypeScript types only**, all server-side:

### New: `BooleanObservationFailureSubreason` (controlled union) + `ALL_…` constant

```ts
/**
 * Typed sub-reason vocabulary for a Boolean Observation adapter failure.
 * Operator/diagnostic ONLY — never user-facing, never persisted to a DB
 * column. The durable value is the request_ / response_ / provider_ split:
 * it tells Phase 2 which CLASS of failure dominates under burst.
 *
 * Doctrine: structural transport/schema facts only (cdiscourse-doctrine
 * §1/§10a) — no verdict, no truth, no user-intent.
 */
export type BooleanObservationFailureSubreason =
  // request-side (fast-reject; <~1s) — the move/body never reached the model
  | 'request_unsupported_family'
  | 'request_unsupported_raw_key'
  | 'request_invalid_source_subset'
  // response-side (slow-fail; ~full classifier duration) — the model
  // answered but the answer failed MCP-021A validation
  | 'response_not_json'
  | 'response_wrong_schema_version'
  | 'response_wrong_shape'
  | 'response_missing_required_field'
  | 'response_flag_count_too_high'
  | 'response_evidence_span_invalid'   // RESERVED — no emitter today
  | 'response_ban_list_violation'      // RESERVED — no emitter today
  // provider/transport
  | 'provider_timeout'                 // RESERVED — folded into network_error today
  | 'provider_rate_limited'
  | 'provider_api_error'
  | 'provider_network_error'
  // catch-all for a reason with no mapping (forward-compatible)
  | 'unknown';

export const ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS:
  readonly BooleanObservationFailureSubreason[] = [ /* …all 15 in order… */ ];
```

### New: `BooleanObservationFailureDetail` (bounded, sanitized, named-field shape)

```ts
/**
 * The sanitized detail attached to an unavailable adapter result. EVERY
 * field is an allowlisted structural fragment — NEVER the prompt, body,
 * raw model response, or any secret. Built by re-derivation from named
 * parts (see "Sanitizer design"); `parsed.details` is NOT forwarded
 * verbatim. All fields optional; the whole object is capped.
 */
export interface BooleanObservationFailureDetail {
  /** The validator's controlled reason enum (NOT free text). */
  validatorReason?: McpBooleanObservationParseFailureReason;
  /** Structural path of the failing field, e.g. 'modelInfo.provider'. From a static allowlist. */
  path?: string;
  /** What the validator expected, e.g. 'mcp'. From a static allowlist / a constant. */
  expected?: string;
  /** typeof the received value, e.g. 'string' | 'number' | 'object' | 'undefined'. NEVER the value. */
  receivedType?: string;
  /** The KEYS present on the received object (names only, capped count). NEVER the values. */
  receivedKeys?: string[];
  /** The rawKey the adapter checked, when relevant (registry key, structural). */
  checkedRawKey?: string;
  /** Echo of the schema version constant in play (a version string, not data). */
  schemaVersion?: string;
  /** The family the request targeted, when relevant. */
  family?: MachineObservationFamily;
}
```

### Extended: `BooleanObservationAdapterResult` (the `unavailable` variant)

```ts
export type BooleanObservationAdapterResult =
  | { kind: 'success'; response: McpBooleanObservationResponse }
  | {
      kind: 'unavailable';
      reason: BooleanObservationUnavailableReason;   // UNCHANGED — 'validation_failed' preserved (HALT-9)
      subReason?: BooleanObservationFailureSubreason; // NEW, optional
      detail?: BooleanObservationFailureDetail;       // NEW, optional, sanitized
    };
```

### Extended: `PerArgumentSummary`

```ts
export interface PerArgumentSummary {
  argumentId: string;
  runId: string | null;
  status: 'success' | 'failed';
  failureReason: string | null;       // UNCHANGED — still 'mcp_validation_failed' for the validator path
  positiveObservationCount: number;
  rawKeysWithPositive: string[];
  failureSubReason?: BooleanObservationFailureSubreason; // NEW, optional
  failureDetail?: BooleanObservationFailureDetail;       // NEW, optional, sanitized
}
```

### Extended: `AutoTriggerLogFields` (structured-log surface)

```ts
export interface AutoTriggerLogFields {
  /* …existing fields… */
  failure_sub_reason?: BooleanObservationFailureSubreason; // NEW, optional
  failure_detail?: BooleanObservationFailureDetail;        // NEW, optional, sanitized
}
```

---

## Enum home (DECISION + justification)

**Home: a new pure module `supabase/functions/_shared/booleanObservations/booleanObservationFailureSubreason.ts`.**

It exports `BooleanObservationFailureSubreason`, `ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS`, `BooleanObservationFailureDetail`, the pure mapping function `mapToFailureSubreason(...)`, and the pure sanitizer `buildFailureDetail(...)`.

Why a new module and **not** the alternatives:

1. **NOT in `mcpBooleanObservationSchema.ts`.** That file is **schema-mirrored** — `MCP-SERVER-002` (`mcp-server/tests/mcpBooleanObservationSchemaParity.test.ts`) pins the schemaVersion literal, `MAX_EVIDENCE_SPAN_CHARS=240`, `MAX_FLAGS_PER_RESPONSE=20`, and the **6 validator failure-reason values** across `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` ⇄ `src/features/nodeLabels/mcpBooleanObservationSchema.ts`. Adding the sub-reason vocabulary there would touch a schema-mirrored file — **HALT-7 ("no schema-mirror change")**. The validator's `McpBooleanObservationParseFailureReason` union stays byte-equal; I do not add `duplicate_node_id` handling *to the union* (see Mapping table).
2. **NOT inline in `booleanObservationMcpAdapterCore.ts`** (the secondary option the contract allowed). The Core file is fine doctrinally (not mirrored, already Jest-loadable), but the sub-reason mapping **must consume the validator's `McpBooleanObservationParseFailureReason` type**, which `Core` does not currently import. A standalone module keeps the mapping + sanitizer co-located and independently unit-testable, and keeps the Core file's responsibility (request build / response extract / raw-payload sanitize) unmuddied. The new module imports the failure-reason *type* from `mcpBooleanObservationSchema.ts` (type-only import — does not mutate the mirrored file).
3. The new module is **pure TS** (zero `Deno.`/`fetch`/`npm:`), so it is **Jest-loadable and behaviorally testable** — the mapping and the sanitizer get real unit tests, not just source-scan.

`BooleanObservationAdapterResult` stays in `booleanObservationMcpAdapterCore.ts` (its current home, line 100); it gains a type-only import of the two new types from the new module.

---

## Mapping table (explicit — maps ONLY what the code emits today)

`mapToFailureSubreason` is a pure function. Phase 1 wires the validator and adapter reasons; reserved entries are declared in the union but have **no emitter** (do NOT invent emitters — intent §2).

### Validator reasons (`McpBooleanObservationParseFailureReason` → sub-reason)

| Validator `reason` (from `parseMcpBooleanObservationResponse`) | Emitted today? | → `subReason` |
|---|---|---|
| `not_json` | yes | `response_not_json` |
| `wrong_schema_version` | yes | `response_wrong_schema_version` |
| `wrong_shape` | yes | `response_wrong_shape` |
| `missing_required_field` | yes | `response_missing_required_field` |
| `flag_count_too_high` | yes | `response_flag_count_too_high` |
| `duplicate_node_id` | **declared in the union, NOT emitted** by the current parser body | `unknown` (defensive default; see note) |

> **`duplicate_node_id` note (real edge):** the schema's `McpBooleanObservationParseFailureReason` union (`mcpBooleanObservationSchema.ts:139`) carries `duplicate_node_id`, but the function body of `parseMcpBooleanObservationResponse` never returns it. The contract/intent list of 5 validator reasons omits it. Because it is *type-reachable* (a future parser edit could return it) my mapping's `switch` over `McpBooleanObservationParseFailureReason` must be **exhaustive**, so I map `duplicate_node_id → 'unknown'` rather than minting a speculative `response_duplicate_node_id` (which is not in the approved vocabulary and would be an un-emitted invention — intent §2). The exhaustive switch is enforced by a TS `never` check on the default arm.

### Adapter reasons (`BooleanObservationUnavailableReason` → sub-reason)

| Adapter `reason` (collapse site) | Emitted today? | → `subReason` |
|---|---|---|
| `parse_failure` (`:156` extract-null, and `:147` non-JSON body) | yes | `response_not_json` |
| `network_error` (`:130`) | yes | `provider_network_error` |
| `rate_limited` (`:138`) | yes | `provider_rate_limited` |
| `api_error` (`:138`) | yes | `provider_api_error` |
| `validation_failed` (`:163`/`:168`) | yes — but this is the COLLAPSE site | **delegated to the validator map above** (the adapter passes the validator's `parsed.reason` into `mapToFailureSubreason`); `:168` (schema-version belt-and-suspenders) → `response_wrong_schema_version` |
| `url_missing` (`:102`) | yes | **unset** (see decision) |
| `token_missing` (`:109`) | yes | **unset** (see decision) |

### DECISIONS the contract asked for

- **`url_missing` / `token_missing` → leave `subReason` UNSET (not `unknown`).**
  Rationale: these are **operator-config** failures that already map to *distinct* `failure_reason` strings (`mcp_url_missing` / `mcp_token_missing`) via `unavailableReasonToFailureReason`. They are unambiguous on their own; a sub-reason adds nothing and `unknown` would falsely imply "we couldn't classify it." Leaving `subReason` absent is the honest signal: *"no finer class needed — the top-level failure_reason already says it."* (Contract offered "unset or `unknown`"; unset is the more truthful of the two.)

- **Reserved entries (`request_*` beyond the subset path, `response_evidence_span_invalid`, `response_ban_list_violation`, `provider_timeout`) → RESERVE-ONLY. Do NOT add finer detection now.**
  Rationale (intent §2 default): "do not invent emitters speculatively." These describe failure modes Phase 1's *current code* cannot distinguish:
  - `response_evidence_span_invalid` / `response_ban_list_violation` — the MCP-021A validator does **not** have a distinct evidence-span-invalid or ban-list reason today (an oversized evidence span is *truncated*, not rejected — `truncateEvidenceSpan`, schema `:171`; there is no ban-list check in the validator at all). Minting a detector would be new validation logic = **out of Phase 1 scope** and arguably a schema change (HALT-7). Reserve.
  - `request_*` (the three request-side classes) — the contract's burst is **response-side** (slow-fail). The `request_invalid_source_subset` class is the *fast-reject* Card 1A (Family-G) phenomenon; the request-side path that would emit these (`booleanObservationRequestBuilder` / source-subset validation) is **not in scope** for this card (HALT-7 "no family-key change"). They are reserved so the vocabulary is whole and the duration discriminator test can assert the *response_* side without the *request_* side needing a live emitter. (The behavioral "fast request-side failure types as `request_*`" test feeds a **synthetic** `unavailable` result carrying a `request_*` subReason directly into the summary builder — it does not require a real request-side emitter; see Test plan.)

- **`provider_timeout` vs `provider_network_error` — RESERVE `provider_timeout`; map the adapter's `network_error` to `provider_network_error` for now.**
  Rationale: the adapter **folds a timeout abort into `network_error`** today — the `try/catch` around `fetch` (`:126-131`) catches both a DNS/TLS/reset failure *and* an `AbortSignal.timeout` abort, and returns the single `reason:'network_error'`. There is no place in the current code where a timeout is distinguishable from a generic network error **without new logic** (e.g. inspecting `err.name === 'TimeoutError'` / `AbortError` inside the catch). Adding that discrimination is a behavior change to the adapter beyond "stop discarding," so it is **deferred** (it is a natural Phase 3 candidate if Phase 2 shows provider-side dominance). For Phase 1, `provider_timeout` is reserved in the vocabulary (so the durable request/response/provider split is complete) but **has no emitter**. **Is it worth distinguishing?** Yes, *eventually* — a timeout under burst points at concurrency/backoff tuning, whereas a reset points at the provider. But distinguishing it is a Phase 3 fix decision (Stage 2B-gated per intent), not a Phase 1 type-only change. Decision: **reserve, do not detect now.**

---

## API / interface contracts

### `mapToFailureSubreason` (pure)

```ts
/**
 * Map an adapter unavailable reason (+ the optional validator parse reason
 * captured at the collapse site) to the typed sub-reason. Pure, total,
 * exhaustive. Never throws.
 *
 * @param adapterReason  the BooleanObservationUnavailableReason
 * @param validatorReason optional — the parser's reason, present ONLY when
 *                        adapterReason === 'validation_failed' (or the
 *                        parse_failure path forwards it). undefined otherwise.
 * @returns a BooleanObservationFailureSubreason, or `undefined` for the
 *          operator-config reasons (url_missing / token_missing) where
 *          a sub-reason adds nothing.
 */
export function mapToFailureSubreason(
  adapterReason: BooleanObservationUnavailableReason,
  validatorReason?: McpBooleanObservationParseFailureReason,
): BooleanObservationFailureSubreason | undefined;
```

### `buildFailureDetail` (pure sanitizer — see Sanitizer design)

```ts
/**
 * Build a SANITIZED, bounded BooleanObservationFailureDetail from named,
 * allowlisted structural fields. NEVER forwards free text. Returns
 * `undefined` when no safe fields are available (so the optional field
 * stays absent rather than empty).
 */
export function buildFailureDetail(
  input: FailureDetailInput,
): BooleanObservationFailureDetail | undefined;

/** All fields optional; the builder reads ONLY these named parts. */
export interface FailureDetailInput {
  validatorReason?: McpBooleanObservationParseFailureReason;
  path?: string;          // structural; allowlisted set or constant
  expected?: string;      // a constant / enum literal (e.g. 'mcp')
  receivedType?: string;  // a typeof string
  receivedKeys?: string[];// object key NAMES only
  checkedRawKey?: string; // a registry rawKey
  schemaVersion?: string; // the schema version constant
  family?: MachineObservationFamily;
}
```

### `unavailableReasonToFailureReason` — UNCHANGED

`classifyArgumentCore.ts:145` stays byte-equal. `validation_failed → 'mcp_validation_failed'` still holds (HALT-9). The sub-reason is **additive**; the top-level `failureReason` string is **not** derived from it.

---

## File changes

All paths under `supabase/functions/_shared/booleanObservations/` unless noted. Estimates are net new/changed lines.

### New files
- **`booleanObservationFailureSubreason.ts`** — the enum + `ALL_…` constant + `BooleanObservationFailureDetail` + `mapToFailureSubreason` + `buildFailureDetail` (the sanitizer). Pure TS, zero `Deno.`. **~140–180 lines.**

### Modified files
- **`booleanObservationMcpAdapterCore.ts`** — extend the `unavailable` variant of `BooleanObservationAdapterResult` with optional `subReason?` + `detail?`; add a type-only import of the two new types. The `BooleanObservationUnavailableReason` union, `ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS`, the request-builder, the extractor, and `sanitizeBooleanObservationRawPayload` stay **byte-equal**. **~8–12 lines.**
- **`booleanObservationMcpAdapter.ts`** (Deno-only) — at each unavailable `return`, populate `subReason` (+ `detail` where a safe field exists):
  - `:102` `url_missing` → `{ reason:'url_missing' }` (no subReason — decision).
  - `:109` `token_missing` → `{ reason:'token_missing' }` (no subReason).
  - `:130` `network_error` → add `subReason: mapToFailureSubreason('network_error')` (= `provider_network_error`); no detail (the caught error is not inspected/logged — posture preserved).
  - `:138` `rate_limited`/`api_error` → add the mapped `subReason`; `detail` may carry `{ /* http status class */ }` only if expressed as a structural constant — **decision: no detail here** (status is already implied by the sub-reason; keep minimal).
  - `:147` + `:156` `parse_failure` → `subReason: 'response_not_json'`; `detail` = `buildFailureDetail({ validatorReason: undefined, receivedType: <typeof extracted/responseJson> })` — **only the typeof**, never the body.
  - `:163` `validation_failed` (the main collapse) → capture `parsed.reason` + re-derive allowlisted parts; `subReason: mapToFailureSubreason('validation_failed', parsed.reason)`; `detail: buildFailureDetail({ validatorReason: parsed.reason, schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION, /* path/expected/receivedType re-derived from `extracted`, NOT from parsed.details */ })`. **`reason:'validation_failed'` is PRESERVED.**
  - `:168` schema-version belt-and-suspenders → `subReason: 'response_wrong_schema_version'`; `detail` carries `schemaVersion` (the expected constant) + `receivedType` of the mismatched version. **`reason:'validation_failed'` PRESERVED.**
  - Add a type-only import of the new sub-reason types + a value import of `mapToFailureSubreason` / `buildFailureDetail`. **~25–40 lines.**
- **`classifyArgumentCore.ts`** — extend `PerArgumentSummary` with `failureSubReason?` + `failureDetail?` (interface, `:65`); in the `adapterResult.kind === 'unavailable'` branch (`:227-251`) read `adapterResult.subReason` / `.detail` and set them on the returned summary. `failureReason` (= `unavailableReasonToFailureReason(adapterResult.reason)`) is **unchanged**. The success path and the persist-failure paths set neither field (they stay absent). **~12–18 lines.**
- **`autoTriggerLog.ts`** — extend `AutoTriggerLogFields` with `failure_sub_reason?` + `failure_detail?` (optional). The `emitAutoTriggerLog` body (the single `console.info(JSON.stringify(...))`) is unchanged — the spread already carries any present fields. **~4–6 lines.**
- **`autoTriggerDispatcher.ts`** — at the existing `emitAutoTriggerLog({... outcome:'failed' ...})` sites (the per-family terminal-failure emit `:336-346`), pass `failure_sub_reason: terminal?.failureSubReason` and `failure_detail: terminal?.failureDetail` (read off the `PerArgumentSummary` the loop already holds). The `AutoTriggerOutcome` interface, `RETRYABLE_FAILURE_REASONS`, `isSummaryRetryable`, the retry loop, the bounded-concurrency dispatch, and the return type are **byte-equal** (no retry/dispatch change — HALT-1/5). **~4–8 lines.** *(Optional but recommended: the structured-log surface the intent asks for in §3(b). If the reviewer prefers the smallest diff, the dispatcher edit can be dropped and the classify-function RETURN alone satisfies the Phase 2 harness — the RETURN is the load-bearing surface; the log is "supplementary." Design keeps it in; calls it out as severable.)*

### NOT modified (explicitly byte-equal — the diff boundary)
- **No migration file.** (HALT-3.) Nothing under `supabase/migrations/`.
- **`mcpBooleanObservationSchema.ts`** — the validator + its `McpBooleanObservationParseFailureReason` union + `MAX_*` constants stay byte-equal (schema-mirror; HALT-7).
- **`mcp-server/lib/mcpBooleanObservationSchemaMirror.ts`** and **`src/features/nodeLabels/mcpBooleanObservationSchema.ts`** — untouched (mirror parity preserved).
- **`unavailableReasonToFailureReason`** — byte-equal; `mcp_validation_failed` literal preserved (HALT-9).
- **`classify-argument-boolean-observations/index.ts`** — untouched; it passes `PerArgumentSummary[]` straight through (`:94`) and never iterates keys, so the new optional fields ride along on the admin response with no code change.
- **`familyRegistry.ts`, `booleanObservationRequestBuilder.ts`, `persistenceWriter.ts`, `runModeConstants.ts`, `boundedConcurrencyRunner.ts`, `autoTriggerConcurrency.ts`** — untouched.
- **No prompt / taxonomy / flag flip / Source-6 / production-flag / audit-lint / package.json change.** (HALT-6/7.) No `productionEnabledFamilies()` change → no new family enabled → no Family H (HALT-6).

---

## Sanitizer design (the new `detail` is a secret-surface — HALT-4)

**Mechanism: build from named, allowlisted fields only. Re-derive — do NOT forward `parsed.details` verbatim.**

### Allowlist (the ONLY fields that may appear in `detail`)
`{ validatorReason, path, expected, receivedType, receivedKeys, checkedRawKey, schemaVersion, family }` — exactly the contract's set. Each is structural:
- `validatorReason` — a value of the controlled `McpBooleanObservationParseFailureReason` enum (not free text).
- `path` — a structural field path drawn from a **static allowlist** of the validator's known field paths (`schemaVersion`, `nodeId`, `checkedRawKeys`, `observations`, `confidence`, `evidenceSpan`, `modelInfo`, `modelInfo.provider`, `modelInfo.serverName`, `modelInfo.classifierSetVersion`). A path not in the allowlist is dropped.
- `expected` — a constant/enum literal the validator expects (e.g. `'mcp'`, the schemaVersion constant). Never a runtime value from the response body.
- `receivedType` — `typeof received` (one of `string|number|boolean|object|undefined|function|symbol|bigint`). **Never the value.** The builder coerces to the typeof string itself, so even if a caller passes the value by mistake, the builder stores `typeof value`, not the value. *(Defensive: the builder computes the typeof internally; callers pass the raw value to a `receivedTypeOf` arg, never a pre-formatted string.)*
- `receivedKeys` — `Object.keys(receivedObject)` (names only), **capped to the first 32 keys**, each key **capped to 64 chars** and **stripped of any non-`[A-Za-z0-9_]` character** (a rawKey/field name is identifier-shaped; this prevents a malicious key name from smuggling a body). Values are never read.
- `checkedRawKey` — must be a known registry rawKey (validated against `MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY`); an unknown key is dropped (matches the schema's "never echo unknown rawKeys" rule, schema §10a).
- `schemaVersion` — the schema version **constant** in play.
- `family` — a `MachineObservationFamily` enum value.

### Hard ban (the builder structurally cannot emit these)
Because the builder accepts **only** the named args above and never a free-text blob, the banned classes have no entry point: raw prompt, argument body, raw/whole model response, full provider payload, JWT, Bearer, service-role key, Authorization header, API key. There is **no `extra`/`message`/`details` pass-through field** on `FailureDetailInput`. To make the guarantee testable (HOSTILE fixture), the builder additionally runs a **final defense-in-depth scrub** over every string it is about to store:
- reject (drop the field) if it matches any secret shape — assembled from fragments so the source carries no contiguous literal: `sk`+`-ant-`, `xai`+`-`, `sb`+`_secret_`, a JWT triple `eyJ…\.…\.…`, `Bea`+`rer ` + token, `Authorization`, `SERVICE_ROLE`.
- **cap** the serialized `JSON.stringify(detail)` to **≤ 2000 chars**; if over, drop `receivedKeys` first, then truncate `path`/`expected` to 200 chars each, then — as a last resort — return `{ validatorReason, schemaVersion }` only. The cap is enforced on the serialized object, not per field, so the total can never exceed the budget.

### Forward-vs-rederive DECISION on `parsed.details`: **RE-DERIVE. Do NOT forward `parsed.details` as-is.**
- **Today** `parsed.details` *is* structurally safe: I audited every `details: …` literal in `parseMcpBooleanObservationResponse`. They are static strings except two interpolations: `` `expected ${SCHEMA}; got ${String(schemaVersion)}` `` (interpolates the **received schemaVersion** — a version string, attacker-influenceable but not body text) and `` `observations has ${n} entries; max ${MAX}` `` (`n` is an integer). No `details` string interpolates `currentText`, `parentText`, `nodeId`'s body, evidence spans, or any model free-text.
- **But** forwarding `parsed.details` verbatim would **couple my secret-surface guarantee to an unrelated file's internal string construction.** A future MCP-021x edit to `mcpBooleanObservationSchema.ts` (e.g. adding `` `got value "${parsed.nodeId}"` `` or echoing an offending field's value) would silently widen the leak through my forwarded field, with no test on *this* card catching it. The schema file is also schema-mirrored — its evolution is governed by a different gate.
- **Therefore:** the adapter passes `parsed.reason` (the controlled enum) into `buildFailureDetail` as `validatorReason`, and re-derives `path` / `expected` / `receivedType` / `receivedKeys` from the **`extracted` object the adapter already holds** (using the static path allowlist + typeof + key-names), *not* from `parsed.details`. `parsed.details` (the free-text string) is **never read** by the adapter and **never reaches** `detail`. This makes the §6 guarantee **self-contained on this card** and independent of the schema file. (Cost: a few lines of re-derivation in the adapter. Benefit: the hostile-fixture test fully exercises the *only* path that can reach `detail`.)

---

## Edge cases

- **`validation_failed` with `parsed.reason === 'duplicate_node_id'`** — type-reachable though not currently emitted; `mapToFailureSubreason` returns `'unknown'` (exhaustive switch, `never`-checked). No crash, no invented sub-reason.
- **`validation_failed` where the parser was reached via the belt-and-suspenders schema-version guard (`:168`)** — there is **no `parsed`** object at that site (the parser already returned ok, then we re-check the version). The adapter sets `subReason: 'response_wrong_schema_version'` directly (no `parsed.reason` available) and a `detail` with `schemaVersion` only.
- **`parse_failure` from a non-JSON body (`:147`) vs an unrecognized envelope (`:156`)** — both map to `response_not_json`. The `:147` case has no `extracted`; `detail` carries `receivedType` of the raw body (`typeof responseJson` after the throw is unavailable, so detail is `undefined` or just `receivedType:'string'` if the text was captured pre-parse — **decision: `:147` emits no detail**, only the sub-reason; `:156` emits `receivedType: typeof extracted` which is always `'object'` or `null`-derived — actually `extracted===null`, so `receivedType:'object'` is wrong; **decision: `:156` also emits no `receivedType`** — it carries `subReason` only, since "extract returned null" has no structural field to name). *Net:* the two parse_failure sites carry `subReason` and **no detail** — there is nothing safe and informative to add, and forcing a field risks a wrong type label.
- **`url_missing` / `token_missing`** — `subReason` absent, `detail` absent. The top-level `failure_reason` (`mcp_url_missing` / `mcp_token_missing`) is the whole signal.
- **Adapter success** — `PerArgumentSummary.failureSubReason` / `.failureDetail` are absent (the success branch sets neither). `failureReason` is `null` as before.
- **Persist-run-failed / persist-results-failed / argument_not_found** — these are **classifier-side** failures (not adapter-unavailable). They keep their existing `failureReason` (`persist_run_failed`, `persist_results_failed:…`, `argument_not_found`) and set **no** sub-reason (the sub-reason vocabulary is for *adapter* failures; a persist failure is a different class and is already distinct in `failureReason`). Documented so the implementer does not back-fill a sub-reason there.
- **`detail` over 2000 chars** — the cap degrades gracefully (drop `receivedKeys` → truncate strings → `{validatorReason, schemaVersion}`); never throws, never exceeds budget.
- **Empty/garbage `receivedKeys`** — a non-object received value yields `receivedKeys: undefined` (the builder only computes keys for a plain object). A huge object yields ≤32 sanitized key names.
- **Concurrent bursts** (the originating scenario) — Phase 1 adds no shared mutable state; `mapToFailureSubreason` / `buildFailureDetail` are pure and per-call. Bounded concurrency (=2 effective at the dispatch layer; the smoke's 7–8 was cross-argument) is unchanged (HALT-5). The sub-reason is computed per failing call independently.
- **Doctrine edge — does any sub-reason imply a verdict?** No. Walk the vocabulary: every value names a transport or schema-shape fact. None says "wrong", "false", "winner", "bad faith". The `detail` carries only structural field names + typeofs + a version string. No truth claim is expressible.

---

## Test plan (test-discipline)

Pure modules get **behavioral** Jest tests; the Deno adapter gets **source-scan** coverage for the threading + the no-secret guarantee. New/edited test files:

### New: `__tests__/booleanObservationFailureSubreason.test.ts` (pure, behavioral) — the bulk
- **Mapping coverage (one assertion per emitted reason):**
  - validator `not_json→response_not_json`, `wrong_schema_version→response_wrong_schema_version`, `wrong_shape→response_wrong_shape`, `missing_required_field→response_missing_required_field`, `flag_count_too_high→response_flag_count_too_high`.
  - validator `duplicate_node_id→unknown` (the reserved/un-emitted edge).
  - adapter `parse_failure→response_not_json`, `network_error→provider_network_error`, `rate_limited→provider_rate_limited`, `api_error→provider_api_error`.
  - adapter `validation_failed` **with** a `validatorReason` delegates to the validator map; `validation_failed` **without** a `validatorReason` → `unknown` (or the belt-and-suspenders direct `response_wrong_schema_version` is set by the adapter, tested in the source-scan suite).
  - adapter `url_missing→undefined`, `token_missing→undefined` (the unset decision).
  - `ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS` contains exactly the 15 vocabulary values, in declared order; the `mapToFailureSubreason` switch is exhaustive (a `never` compile guard + a runtime test that every `BooleanObservationUnavailableReason` produces a defined-or-deliberately-undefined result).
- **Sanitizer — HOSTILE fixture (the HALT-4 wall):**
  - a `FailureDetailInput` whose `path`/`expected`/`receivedKeys` smuggle: a fake prompt string, `Bea`+`rer `+a 24-char token, an `sb`+`_secret_`+… shape, an `sk`+`-ant-`+… shape, a JWT triple, an `Authorization` header line, a 5000-char body blob → assert each banned field is **dropped/scrubbed** and the result contains **none** of the banned shapes (regexes assembled from fragments).
  - the **cap**: an input producing > 2000 serialized chars → assert `JSON.stringify(result).length <= 2000` and the graceful-degradation order (receivedKeys dropped first).
  - `receivedKeys` cap: 100 keys with 200-char names + punctuation → assert ≤32 keys, each ≤64 chars, identifier-shaped only.
  - `receivedType` never carries a value: pass a value object → assert the stored field equals its `typeof`, not the value.
  - `checkedRawKey` unknown → dropped; known registry key → kept.
  - empty input → `buildFailureDetail` returns `undefined` (absent field, not `{}`).

### New: `__tests__/mcpOneTwoOneCFailureSubreasonThreading.test.ts` (behavioral, via Jest-loadable `classifyArgumentCore`)
- **Duration discriminator (the contract's headline tests):**
  - a **fast request-side** failure: inject a mock adapter returning `{ kind:'unavailable', reason:'validation_failed', subReason:'request_invalid_source_subset', detail }` → assert `classifyOneArgumentCore(...)`'s `PerArgumentSummary.failureSubReason === 'request_invalid_source_subset'` and starts with `request_`.
  - a **slow response-shape** failure: inject `{ ..., reason:'validation_failed', subReason:'response_wrong_shape', detail:{ validatorReason:'wrong_shape', path:'modelInfo.provider', expected:'mcp', receivedType:'string' } }` → assert `failureSubReason === 'response_wrong_shape'` and starts with `response_`; assert `failureDetail` round-trips the allowlisted fields. *(The mock adapter carries the synthetic sub-reasons; this test does not need a real request-side emitter — it proves the **threading + surface**, which is Phase 1's deliverable.)*
- **Compat retention (HALT-9):** for the response-shape failure above, assert `summary.failureReason === 'mcp_validation_failed'` (unchanged) AND `summary.status === 'failed'`. A second assertion: `unavailableReasonToFailureReason('validation_failed') === 'mcp_validation_failed'` still holds.
- **Success path:** a `{ kind:'success', ... }` mock → `failureSubReason`/`failureDetail` are `undefined`; `failureReason` is `null`.
- **Persist/argument-not-found classes** carry no sub-reason (assert absent).
- **Reader tolerance:** construct a `PerArgumentSummary` with the new optional fields and exercise the dispatcher's reader predicates against it — `isSummaryRetryable(summary)` behaves identically (the new fields don't change retryability), and a summary with `failureSubReason` set still routes through the existing `failureReason`-based branches. *(Uses the Jest-loadable dispatcher helpers if importable; otherwise covered by source-scan below.)*

### Edited: source-scan suites (the Deno adapter + dispatcher are not Jest-loadable)
- **`__tests__/mcpOneTwoOneCEdgeAdapterSourceScan.test.ts`** — add:
  - the adapter file imports `mapToFailureSubreason` + `buildFailureDetail` from `booleanObservationFailureSubreason.ts`.
  - the adapter still carries `reason: 'validation_failed'` at the collapse sites (the literal is present) — HALT-9 source proof.
  - the adapter **never reads `parsed.details`** (assert the source does NOT contain `parsed.details` / `.details`) — proves the re-derive decision.
  - the new file `booleanObservationFailureSubreason.ts` carries no contiguous secret-shaped literal (extend the SCAN-17 loop to include it) and no `console.log`.
  - the new file appears in **no** `src/`/`app/` import (extend SCAN-19/20's fenced-tree list).
- **`__tests__/mcpOneTwoOneCAutoTriggerFailureMode.test.ts`** (already a source-scan of `classifyArgumentCore.ts`) — add: `coreText` sets `failureSubReason` / `failureDetail` in the unavailable branch and reads `adapterResult.subReason` / `.detail`; `failureReason` mapping (FAIL-1..7) assertions are **unchanged** (regression proof that the existing strings still appear).

### Edited (REQUIRED — these existing tests would otherwise contradict the change)
- **`__tests__/mcpOneTwoOneCEdgeResponseSummaryFix.test.ts` `REG-8`** — its **title + comment** say "PerArgumentSummary contract is preserved (no new fields; no removed fields)". The assertions only check the 6 existing fields are *present* (so they pass with new optional fields), but the **documented intent** is now false. Update REG-8's title/comment to "the six load-bearing fields are preserved; Phase 1 adds optional `failureSubReason`/`failureDetail`" and (optionally) add positive assertions that the two new fields are present + optional. Without this edit the test is misleading, not red — but test-discipline forbids leaving a contradicted intent in place.
- **`__tests__/mcpOneTwoOneCEdgeFunctionHandler.test.ts` `EFH-26`** — verify (no code change expected): the new field names `failureSubReason` / `failureDetail` contain none of the banned substrings the test scans for (`Authorization` / `Bearer` / `[Tt]oken` / `[Ss]erviceClient` / `SERVICE_ROLE`). Confirmed they do not. If the implementer renames a field, re-check. The design pins the names so EFH-26 stays green with no edit.

### Doctrine ban-list assertion
- In `booleanObservationFailureSubreason.test.ts`: assert no value in `ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS` contains any of `winner|loser|true|false|correct|liar|dishonest|bad faith|manipulative|extremist|propagandist|stupid|idiot` (the sub-reason vocabulary is verdict-free). Cheap, and it locks the doctrine boundary.

### Forecast
**+22 to +30 tests** (mapping ≈ 11, sanitizer ≈ 8, threading/compat ≈ 6, source-scan additions ≈ 4, doctrine ≈ 1; REG-8/EFH-26 are edits, not adds). Within the intent's +15..+35 band; **well under the +60 HALT-10 ceiling.**

---

## Dependencies (cards / docs / files)

- **Assumes** the `MCP-021C-EDGE` auto-trigger chain (Families A–F enabled, bounded-concurrency dispatch) is complete — it is (CLAUDE.md / `current-status.md`: the dispatcher, `classifyArgumentCore`, the validator, and the source-scan tests all exist as anchored).
- **Reads** `parseMcpBooleanObservationResponse`'s `{ok:false, reason}` (`mcpBooleanObservationSchema.ts:190+`) — consumes the **type** `McpBooleanObservationParseFailureReason` (type-only import; the file is not modified).
- **Reads** `BooleanObservationUnavailableReason` (`booleanObservationMcpAdapterCore.ts:74`) and `MachineObservationFamily` (`nodeLabelTypes.ts`).
- **Reads** the registry `MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY` (for the `checkedRawKey` allowlist check).
- **Blocks Phase 2** (the gated SPEND reproduction harness): Phase 2 reads `PerArgumentSummary.failureSubReason` synchronously off the admin_validation RETURN to find the dominant class. Phase 1's RETURN extension is the prerequisite.
- **Informs Phase 3** (the FIX, branch-selected by Phase 2's dominant class) — but Phase 1 implements no fix.

---

## Risks

- **HALT-7 schema-mirror tripwire (mitigated):** the easy mistake is putting the enum (or a `response_duplicate_node_id`) into `mcpBooleanObservationSchema.ts`, which is parity-pinned by `MCP-SERVER-002`. The design forbids touching that file or its two mirrors. Implementer must keep the new vocabulary in `booleanObservationFailureSubreason.ts`.
- **Secret-surface regression (the central risk):** the `detail` field is the only new place a secret could leak. Mitigated by (a) named-arg-only builder (no free-text entry point), (b) re-derive not forward (`parsed.details` never read), (c) defense-in-depth scrub + cap, (d) the hostile-fixture test. The reviewer should treat this as a migration-grade verification surface.
- **`REG-8` "no new fields" intent:** an existing test documents the opposite of this change. It does not go red (assertions only check presence), so a careless implementer might leave its misleading title. The design flags the edit as REQUIRED.
- **Deno adapter is not Jest-loadable:** the threading at the collapse sites is verified by source-scan only (the proven pattern). The *behavioral* proof rides on the Jest-loadable `classifyArgumentCore` + the pure module; the adapter source-scan asserts the wiring. This split matches the repo's established coverage wall for `booleanObservationMcpAdapter.ts`.
- **`provider_timeout` / reserved entries look like dead code:** a reviewer may flag the reserved union members as unused. They are intentional (the durable request/response/provider split). The `ALL_…` constant + the ban-list/exhaustiveness tests reference them, so they are not literally unused; the design documents the reserve-only decision.
- **No operator deploy in Phase 1 itself**, but the change is in the `submit-argument` background path's dependency tree — it ships to production on the next merge-to-main auto-deploy (the Supabase GitHub integration redeploys Edge Functions on merge). The behavior change is *additive and inert* (extra optional fields on a RETURN + log); it cannot change the run row, the `failure_reason`, or whether submit is blocked.

---

## Out of scope (explicit — reduces scope creep)

- **Any retry / fix.** No change to `RETRYABLE_FAILURE_REASONS`, `MAX_ATTEMPTS`, the backoff, or whether `mcp_validation_failed` becomes retryable. That is **Phase 3**, branch-selected by Phase 2. (HALT-1.)
- **Any migration / DB column / jsonb / `failure_subreason` persistence.** Stage 2B chose log/RETURN-only. A `OPS-MCP-FAILURE-SUBREASON-PERSISTENCE` card is filed *only* on a recurrence trigger. (HALT-3.)
- **Any concurrency change.** `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` stays 2; the bounded-concurrency runner is untouched. (HALT-5.)
- **Any Family H work** (admin included) — frozen. No `productionEnabledFamilies()` change → no new family. (HALT-6.)
- **Any prompt / taxonomy / schema / flag / Source-6 / production-flag / audit-lint / package.json change.** (HALT-7.)
- **New validation logic** — no evidence-span-invalid detector, no ban-list checker, no timeout/abort discrimination in the fetch catch. Those would mint emitters for the reserved entries; reserved means reserved.
- **The Phase 2 reproduction harness, Phase 4 verify, Phase 5 verdict** — context only; not built here.
- **User-facing surfacing** — the sub-reason is operator/diagnostic; no UI, no `gameCopy` entry, no timeline render.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels):** the sub-reason vocabulary is transport/schema-shape only; a ban-list test asserts none of the values contains a verdict token. The `detail` carries structural field names + typeofs + a version string — no truth claim is expressible. ✔
- **cdiscourse-doctrine §3 (popularity ≠ evidence):** untouched — no engagement/heat input anywhere in scope. ✔
- **cdiscourse-doctrine §5 (rules engine sacred):** no file under `src/lib/constitution/`; the new module is pure but lives in the Edge tree. ✔
- **cdiscourse-doctrine §6 (secrets):** the `detail` extends the adapter's "never logs token/URL/Authorization/Bearer/raw body" posture via an allowlist builder + re-derive (no `parsed.details` forward) + defense-in-depth scrub + 2000-char cap; hostile-fixture test proves it. The new file carries no contiguous secret literal (source-scan). ✔
- **cdiscourse-doctrine §7 (no AI calls from the client):** every touched file is under `supabase/functions/`; SCAN-19/20 fence the tree out of `src/`/`app/`, extended to the new file. ✔
- **cdiscourse-doctrine §8 (Supabase conventions):** no migration, no RLS change, no table change. ✔
- **cdiscourse-doctrine §9 (plain language):** N/A — the sub-reason is never user-facing; §9 governs user-facing strings. (Documented so a reviewer doesn't demand a `gameCopy` mapping.) ✔
- **cdiscourse-doctrine §10a (Observations vs Allegations):** the classifier still produces only Machine Observations; the sub-reason is a *failure* diagnostic, not a label on anyone's node. ✔
- **test-discipline:** pure modules (mapping, sanitizer) get behavioral Jest tests with failure cases; the Jest-loadable `classifyArgumentCore` threading is behaviorally tested; the Deno adapter gets source-scan; existing-test edits (REG-8) are called out; the doctrine ban-list test is included; forecast +22..+30 (under +60). ✔
- **HALT triggers:** none fired. The change is type-only, additive, preserves `reason:'validation_failed'` and `failure_reason='mcp_validation_failed'`, adds no migration/retry/concurrency/family/prompt/schema/flag change, and the banned detail structurally cannot reach the RETURN/log. ✔

---

## Operator steps (if any)

**None for the design.** For the eventual **implementation** merge: the Supabase GitHub integration auto-redeploys Edge Functions on merge to `main` (per memory: "Supabase merge auto-deploy"), so no manual `functions deploy` is required — the additive optional fields ship inertly with the next deploy. There is **no migration**, so **no `db push`**. (Phase 2's gated SPEND reproduction is a separate, operator-approved step — not part of this Phase 1 implementation.)
