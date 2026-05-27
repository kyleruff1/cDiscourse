# OPS-MCP-FAMILY-VALIDATOR-REFACTOR — Multi-family shared boolean-observation request validator

**Status:** Design draft
**Epic:** MCP / OPS — Stage 0 prerequisite for MCP-SERVER-003-BATCH-B-C-D-E
**Release:** Internal refactor (no operator deploy beyond Deno Deploy git auto-deploy)
**Issue:** https://github.com/civildiscourse/debate-constitution-app/issues/314
**Intent brief:** `docs/designs/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-intent.md`
**Predecessor HEAD on main:** `6ef132c` (intent brief commit)
**Branch:** `feat/OPS-MCP-FAMILY-VALIDATOR-REFACTOR`

---

## 1. Scope reality

This card is a server-side internal refactor of the MCP server's boolean-observation request validator. It is sequenced ahead of MCP-SERVER-003-BATCH-B-C-D-E so each future family (B, C, D, E, F, G, H, I, J) can register additively rather than creating four near-duplicate `familyXBooleanRequestSchema.ts` files.

**ALLOWED (mirror intent brief §3):**

* Rename `mcp-server/lib/familyABooleanRequestSchema.ts` → `mcp-server/lib/familyBooleanRequestSchema.ts`.
* Introduce `mcp-server/lib/familyRegistry.ts` (new) holding the `FamilyValidatorRegistry` pattern.
* Introduce `mcp-server/lib/familyRegistryInit.ts` (new) holding the explicit Family A registration call (Decision A.4).
* Refactor `validateFamilyABooleanRequest` → `validateFamilyBooleanRequest`.
* Rename internal types `FamilyARequestValidationFailure` / `FamilyARequestValidationResult` → `FamilyRequestValidationFailure` / `FamilyRequestValidationResult` (Decision A.3).
* Update `mcp-server/tools/classifyArgumentBooleanObservations.ts` to import the new validator name + side-effect-import the registry init module.
* Update `mcp-server/tests/familyAKeysParity.test.ts` to read raw keys via the registry (Decision A.5).
* Update `mcp-server/tests/classifyArgumentBooleanObservations.test.ts` + `mcp-server/tests/familyAFixtureParity.test.ts` to call the renamed validator function.
* New tests for the registry pattern + refactored validator (target +30 to +60).
* `docs/core/current-status.md` Phase framing handoff section (implementer adds; designer surfaces here as out-of-scope-for-this-doc but in-scope-for-implementer-checklist).

**DISALLOWED (mirror intent brief §3 + §5 HALTs):**

* Family B/C/D/E key registration in this card. `familyRegistryInit.ts` registers ONLY Family A.
* Schema version changes (`mcp-021.machine-observations.boolean.v1` stays).
* Parser / sanitizer contract changes.
* MCP server prompt changes (`familyAPrompt.ts`, `seedPrompt.ts` untouched).
* Edge Function changes — Edge Function calls the MCP server via JSON-RPC, not by importing validator functions; HALT #5 fires if implementer touches anything under `supabase/functions/`.
* MCP-021A taxonomy source-file changes (`src/features/nodeLabels/**`).
* Changes to Family A's 16 raw keys or `classifierSetVersion` (must stay `'family-a-v1'`).
* UI / display cap changes.
* Persistence layer changes.
* Production-trigger / auto-trigger changes.
* No backwards-compatibility shim. The rename is complete; all callers update to the new function name (Decision 5).

---

## 2. Current validator surface (Phase A.1)

### 2.1 Exact exports from `mcp-server/lib/familyABooleanRequestSchema.ts`

Confirmed by reading the file end-to-end (266 lines).

**Named type exports:**

```ts
export type FamilyARequestValidationFailure =
  | { ok: false; kind: 'invalid_params'; path: string; detail: string }
  | { ok: false; kind: 'unsupported_family'; requestedFamilies: readonly string[] }
  | { ok: false; kind: 'unsupported_rawKey'; unsupportedRawKeys: readonly string[] };

export type FamilyARequestValidationResult =
  | { ok: true; value: ValidatedFamilyARequest }   // ValidatedFamilyARequest re-imported from './familyAPrompt.ts'
  | FamilyARequestValidationFailure;
```

**Named value exports:**

```ts
export function validateFamilyABooleanRequest(raw: unknown): FamilyARequestValidationResult;
export { SUPPORTED_FAMILIES };  // readonly string[] = Object.freeze(['parent_relation']);
```

No default export. No re-exports of types from other files.

**Internal module-level constants (NOT exported, but binding):**

```ts
const SUPPORTED_FAMILIES: readonly string[] = Object.freeze(['parent_relation']);
const MAX_TIMEOUT_MS = 60000;
const MIN_TIMEOUT_MS = 1;
const MAX_BODY_LEN = 8000;
const MAX_THREAD_CONTEXT_LEN = 8000;
```

The four numeric constants are private; only `SUPPORTED_FAMILIES` is re-exported.

### 2.2 Imports the file makes

```ts
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from './mcpBooleanObservationSchemaMirror.ts';
import { FAMILY_A_RAW_KEYS } from './familyAKeys.ts';
import type { ValidatedFamilyARequest } from './familyAPrompt.ts';
```

### 2.3 Importers of the file (every site, from `Grep`)

**Production:**

| File | Line | Symbol |
| --- | --- | --- |
| `mcp-server/tools/classifyArgumentBooleanObservations.ts` | 39 | `import { validateFamilyABooleanRequest } from '../lib/familyABooleanRequestSchema.ts'` |
| `mcp-server/tools/classifyArgumentBooleanObservations.ts` | 164 | `const validated = validateFamilyABooleanRequest(args);` (only call site) |

**Tests:**

| File | Line | Symbol |
| --- | --- | --- |
| `mcp-server/tests/familyAFixtureParity.test.ts` | 24 | `import { validateFamilyABooleanRequest } from '../lib/familyABooleanRequestSchema.ts'` |
| `mcp-server/tests/familyAFixtureParity.test.ts` | 245 | `const result = validateFamilyABooleanRequest(wrapper.input);` |
| `mcp-server/tests/familyAFixtureParity.test.ts` | 256 | `const result = validateFamilyABooleanRequest(wrapper.input);` |

`mcp-server/tests/classifyArgumentBooleanObservations.test.ts` does NOT import the validator directly; it tests the tool handler that wraps it. Its assertions exercise the error envelope shapes end-to-end (`reason: 'invalid_params'`, `reason: 'unsupported_family'`, `reason: 'unsupported_rawKey'`), so a rename of the underlying validator function is invisible to this test file — but the error envelope shape returned by the tool handler MUST stay byte-equal.

**No importers outside `mcp-server/`.** Grep across `src/`, `supabase/`, `__tests__/` returned zero matches. The Edge Function calls the server over JSON-RPC; it does not import server-side TypeScript symbols. This is consistent with Decision 5 (no backwards-compat shim needed).

### 2.4 API surface to preserve byte-equal

**Function signature:**

```ts
validateFamilyABooleanRequest(raw: unknown): FamilyARequestValidationResult
```

**Failure-shape envelope (byte-equal preservation REQUIRED):**

```ts
// Path A — invalid_params (8 trigger paths in the current file)
{ ok: false, kind: 'invalid_params', path: <string>, detail: <string> }

// Path B — unsupported_family
{ ok: false, kind: 'unsupported_family', requestedFamilies: readonly string[] }

// Path C — unsupported_rawKey
{ ok: false, kind: 'unsupported_rawKey', unsupportedRawKeys: readonly string[] }
```

**Success-shape envelope (byte-equal preservation REQUIRED):**

```ts
{ ok: true, value: ValidatedFamilyARequest }
// ValidatedFamilyARequest = the interface from familyAPrompt.ts:77
```

**Error-envelope mapping at the tool handler boundary (`classifyArgumentBooleanObservations.ts:165-210`) — implementer must NOT touch:**

* `kind: 'unsupported_family'` → `errorResult('unsupported_family', 'Family A is the only supported family in this server build', { requestedFamilies, supportedFamilies: ['parent_relation'] })` — including the literal supportedFamilies tail.
* `kind: 'unsupported_rawKey'` → `errorResult('unsupported_rawKey', 'One or more requestedRawKeys are not in Family A', { unsupportedRawKeys })`.
* `kind: 'invalid_params'` → `errorResult('invalid_params', 'Input failed schema validation', { path, detail })`.

The string `'Family A is the only supported family in this server build'` is the literal returned to API clients. The refactor MUST preserve it byte-equal even though the validator is no longer Family-A-specific. (Decision 6: tools/list still advertises only Family A; the message is consistent with that.)

**Validation rules to preserve byte-equal:**

1. `raw` must be a plain object → `invalid_params` `$` / `'must be a plain object'`
2. `schemaVersion` must equal `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` → `invalid_params` `'schemaVersion'` / `` `expected ${X}; got ${Y}` ``
3. `nodeId` must be string, length [1, 512] → `invalid_params`
4. `parentNodeId` optional; if present, string|null, max 512 → `invalid_params`
5. `currentText` must be string, length [0, 8000] → `invalid_params`
6. `parentText` optional; if present, string|null, max 8000 → `invalid_params`
7. `threadContextExcerpt` must be string, length [0, 8000] → `invalid_params`
8. `requestedFamilies` must be string[]; each entry MUST be in `SUPPORTED_FAMILIES` → `unsupported_family`
9. `requestedRawKeys` must be string[]; each entry MUST be in `FAMILY_A_RAW_KEYS` → `unsupported_rawKey`
10. `definitions` must be plain object → `invalid_params`
11. `timeoutMs` must be integer in [1, 60000] → `invalid_params`

Empty arrays for `requestedFamilies` or `requestedRawKeys` are accepted (no entries fail the per-entry check); current test `'boolean tool empty requestedRawKeys is accepted (means: classify all 16)'` (line 239) confirms this; the refactor MUST preserve it.

---

## 3. Registry structure (Phase A.2)

### 3.1 Choice: frozen Map

**Decision: `Map<string, FamilyMetadata>` wrapped behind a class-style closure.**

Rationale:

* **Ordered iteration.** Map preserves insertion order; this matters because the implementer can rely on iteration order for deterministic tests (`registry-getSupportedFamilies-returns-only-registered` returns `['parent_relation']` in that order, not in some hash-bucket order).
* **Ergonomic `.keys()` / `.has()`.** `registry.isFamilySupported(family)` is a one-liner over `Map.has`; same for raw key lookup.
* **Freeze story.** The wrapper exposes only read methods after registration; underlying mutation is via `register(family, metadata)` which writes into the internal Map exactly once per family (duplicate registration throws — Decision 7).
* **No iteration of object prototypes.** `Record<string, FamilyMetadata>` would technically work but `Object.keys` skips prototype, which is fine, but Map is the idiomatic choice for "registry of unique keys → opaque metadata" and matches existing patterns in the repo (the `argumentTypes` registry pattern in `src/lib/constitution/`).

**Alternatives considered + rejected:**

* `Record<string, FamilyMetadata>` — works, but loses insertion order on iteration in some engines, and `'parent_relation' in record` is slightly noisier than `map.has('parent_relation')`.
* Class-based registry (`class FamilyValidatorRegistry { constructor() { this.map = new Map(); } register(...) {} ... }`) — the implementer MAY use a class as the public interface (recommended for `registry instanceof` ergonomics in tests), backed by a private Map. The structural choice "Map" is the binding decision; whether the public wrapper is a class or a module-level singleton with functions is a sub-decision left to the implementer with default = **module-level singleton exposing the 6 functions per Decision 2**, instantiated once in `familyRegistry.ts` itself.

### 3.2 `FamilyMetadata` shape

```ts
/**
 * Metadata a family registers about itself. The raw key set is a frozen
 * ReadonlySet (not an array) because the registry's hot path is membership
 * lookup (validator.requestedRawKeys ⊆ family.rawKeys), which is O(1) on a
 * Set vs O(n) on an array. The underlying source data (FAMILY_A_RAW_KEYS) is
 * still an array; the registry stores a derived Set.
 */
export interface FamilyMetadata {
  readonly rawKeys: ReadonlySet<string>;
  readonly classifierSetVersion: string;
}
```

### 3.3 Registry public API (per Decision 2)

```ts
// Module-level singleton instance exposed as 6 named functions. The
// implementer may also expose a `__resetRegistryForTests()` symbol marked
// internal; left to implementer's discretion but the test for double-
// registration needs a way to reset state between tests (or use a fresh
// in-memory registry per test).

export type SupportedFamily = string;  // narrows further once Family B-J register

export function register(family: SupportedFamily, metadata: FamilyMetadata): void;
export function getSupportedFamilies(): ReadonlyArray<SupportedFamily>;
export function getRawKeysForFamily(family: SupportedFamily): ReadonlySet<string>;
export function getClassifierSetVersion(family: SupportedFamily): string;
export function isFamilySupported(family: string): boolean;
export function isRawKeySupportedForFamily(family: string, rawKey: string): boolean;
```

**Behavior contracts:**

* `register(family, metadata)` throws `Error('family already registered: ' + family)` if called twice for the same family (defensive; Decision 7 — `registry-rejects-double-registration` test). Throws `Error('rawKeys must be non-empty Set')` if metadata.rawKeys is empty. Throws `Error('classifierSetVersion must be non-empty string')` if metadata.classifierSetVersion is empty.
* `getSupportedFamilies()` returns a frozen array snapshot of the Map keys (insertion-order). Returns `[]` if registry is empty.
* `getRawKeysForFamily(family)` returns the frozen Set bound at register time. **Throws `Error('family not registered: ' + family)`** if the family is not registered. (Decision: throw rather than return null/empty — the caller is expected to gate on `isFamilySupported` first; an unregistered lookup is a programmer error.) Test case `registry-getRawKeysForFamily-throws-for-unregistered-family` covers this.
* `getClassifierSetVersion(family)` returns the bound string; same throw behavior as `getRawKeysForFamily`.
* `isFamilySupported(family)` returns boolean; never throws.
* `isRawKeySupportedForFamily(family, rawKey)` returns false if family is not registered (does NOT throw — this is the "polite" predicate used in the validator's hot path); returns false if family is registered but rawKey is not in its set; returns true otherwise.

The validator (`validateFamilyBooleanRequest`) uses `isFamilySupported` + `isRawKeySupportedForFamily` for the request-path checks; it does NOT call `getRawKeysForFamily` directly because that would throw on unregistered families and the existing validator's `unsupported_family` path returns a structured error envelope, not an exception.

### 3.4 SUPPORTED_FAMILIES derivation

`SUPPORTED_FAMILIES` becomes a derived value: `getSupportedFamilies()`. The existing `export { SUPPORTED_FAMILIES }` from `familyBooleanRequestSchema.ts` is REMOVED. No production code imports it (Grep confirmed); the only consumer is internal to the file (`if (!SUPPORTED_FAMILIES.includes(family))`).

If the implementer finds an importer of `SUPPORTED_FAMILIES` during refactor that the designer missed, that is a HALT-trigger-adjacent flag — surface it and re-evaluate Decision 5 (backwards-compat shim).

---

## 4. Naming decisions (Phase A.3)

### 4.1 File name

* **New:** `mcp-server/lib/familyBooleanRequestSchema.ts` (drop "A"; signals multi-family scope).
* **Old:** `mcp-server/lib/familyABooleanRequestSchema.ts` — DELETED (`git mv` in implementation; not kept as a stub).

### 4.2 Function name

* **New:** `validateFamilyBooleanRequest(raw: unknown): FamilyRequestValidationResult`
* **Old:** `validateFamilyABooleanRequest` — REMOVED.

Per Decision 5 (no backwards-compat shim), the implementer does NOT keep `validateFamilyABooleanRequest` as a thin wrapper.

### 4.3 Type names

* **New:** `FamilyRequestValidationFailure` + `FamilyRequestValidationResult` (drop "A" — same rationale as the file rename).
* **Old:** `FamilyARequestValidationFailure` + `FamilyARequestValidationResult` — REMOVED.

The rename cascades into ZERO production callers (`Grep "FamilyARequestValidation"` returns matches only inside `familyABooleanRequestSchema.ts` itself, and the call site in `classifyArgumentBooleanObservations.ts` uses the type implicitly through the function return value — no `FamilyARequestValidationResult` literal appears in that file).

### 4.4 New type introductions

```ts
// New in familyRegistry.ts
export type SupportedFamily = string;  // initially aliases string; future families may narrow via const-union

export interface FamilyMetadata {
  readonly rawKeys: ReadonlySet<string>;
  readonly classifierSetVersion: string;
}

// New in familyBooleanRequestSchema.ts
export type FamilyRequestValidationFailure =
  | { ok: false; kind: 'invalid_params'; path: string; detail: string }
  | { ok: false; kind: 'unsupported_family'; requestedFamilies: readonly string[] }
  | { ok: false; kind: 'unsupported_rawKey'; unsupportedRawKeys: readonly string[] };

export type FamilyRequestValidationResult =
  | { ok: true; value: ValidatedFamilyARequest }  // still ValidatedFamilyARequest — see 4.5
  | FamilyRequestValidationFailure;
```

### 4.5 What stays "A"-named

`ValidatedFamilyARequest` (in `familyAPrompt.ts:77`) is **NOT renamed.** Rationale:

* Renaming it cascades into `familyAPrompt.ts` (definer), `familyAAnthropic.ts` (consumer in `runAnthropicFamilyAClassifier`), and any prompt-construction code that types the request — out of scope for this card (HALT #4 fires if implementer touches `familyAPrompt.ts` beyond the import statement update).
* The success-envelope value type is still semantically a Family A request. The success envelope's `value` field is the Family A-shaped object, even though the validator function is now multi-family-capable.
* Future families (B-J) will introduce their own `ValidatedFamilyBRequest` etc., and the validator's success-envelope type will need to widen to a discriminated union — that's MCP-SERVER-003's problem, not this card's.

**Alternatives considered + rejected:**

* Rename `ValidatedFamilyARequest` → `ValidatedFamilyRequest` and widen to `ValidatedFamilyRequest = ValidatedFamilyARequest | ValidatedFamilyBRequest | ...` — would require touching `familyAPrompt.ts` and `familyAAnthropic.ts`, both HALT-listed. Defer to the family-B card.
* Make `validateFamilyBooleanRequest` return a generic `ValidatedFamilyRequest<F extends SupportedFamily>` — adds parametric complexity for zero current benefit. Defer.

---

## 5. Family A registration approach (Phase A.4)

### 5.1 Choice: dedicated init module

**Decision: Option 3 — `mcp-server/lib/familyRegistryInit.ts`** (intent brief default).

Rationale:

* **Diff visibility for future families.** When MCP-SERVER-003-FAMILY-B lands, the diff is a 4-line addition inside `familyRegistryInit.ts`. Anyone reading the PR sees "this card registers Family B" without spelunking into `familyAKeys.ts` or the tool handler.
* **Init-order determinism.** `familyRegistryInit.ts` is side-effect-imported by `classifyArgumentBooleanObservations.ts` (the tool that uses the registry) AND by the parity test (so the test sees the registered state). Single import point = single source of truth for "what's registered".
* **No top-of-file side effects in data modules.** `familyAKeys.ts` stays a pure data module (Option 1 rejected — would couple data to registration). The tool handler stays focused on tool handling (Option 2 rejected — registration would be repeated/scattered as future families land).

### 5.2 File contents (sketch)

```ts
// mcp-server/lib/familyRegistryInit.ts
/**
 * MCP-SERVER family registry initialization.
 *
 * This module is side-effect-imported from:
 *   - mcp-server/tools/classifyArgumentBooleanObservations.ts (production)
 *   - mcp-server/tests/familyAKeysParity.test.ts (parity test)
 *   - mcp-server/tests/familyRegistry.test.ts (registry tests)
 *
 * When a new family lands (Family B / C / D / E / F / G / H / I / J),
 * the diff is one additional registerFamilyXXX() call in this file.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — every family is a structural-observation
 *     grouping; no family encodes a verdict or judgment.
 */
import { register } from './familyRegistry.ts';
import { FAMILY_A_RAW_KEYS, FAMILY_A_CLASSIFIER_SET_VERSION } from './familyAKeys.ts';

let initialized = false;

export function initializeFamilyRegistry(): void {
  if (initialized) return;
  initialized = true;

  register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),       // wraps the frozen array
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
}

// Top-of-file side effect: initialize on first import. Idempotent.
initializeFamilyRegistry();
```

**Why the idempotent guard?** Deno's module cache makes import deduplication automatic, but the guard makes the explicit `initializeFamilyRegistry()` function call safe to invoke from tests that want to ensure the registry is initialized (defensive; pattern parallels the auto-trigger init pattern from MCP-021C-AUTO-TRIGGER-FAMILY-A).

**Why expose `initializeFamilyRegistry()` AND a top-of-file side effect?** The top-of-file side effect handles the production import path. The exported function lets tests (notably `registry-rejects-double-registration`) test the double-registration behavior without relying on module-load ordering. If the implementer prefers a single approach, they MAY drop the top-of-file side effect and require every importer to call `initializeFamilyRegistry()` explicitly — both work; default is "both" so the production path stays one-liner.

### 5.3 Import wiring

**`mcp-server/tools/classifyArgumentBooleanObservations.ts`:**

```ts
// (existing imports)
import { validateFamilyBooleanRequest } from '../lib/familyBooleanRequestSchema.ts';
// NEW — side-effect import to ensure registry is initialized before validator runs
import '../lib/familyRegistryInit.ts';
```

**`mcp-server/lib/familyBooleanRequestSchema.ts` (the renamed validator):**

Does NOT side-effect-import `familyRegistryInit.ts`. Rationale: the validator is a pure function over `(raw, registry)`; it queries the registry but does not initialize it. The caller (`classifyArgumentBooleanObservations.ts`) owns initialization. This keeps `familyBooleanRequestSchema.ts` test-friendly — tests can construct an empty registry, register a fake family, and exercise the validator without the production Family A registration polluting state.

**Tests that depend on the production registry state:**

* `mcp-server/tests/familyAKeysParity.test.ts` — side-effect-imports `familyRegistryInit.ts`.
* `mcp-server/tests/classifyArgumentBooleanObservations.test.ts` — already imports the tool handler, which transitively side-effect-imports the init. No new import needed.
* `mcp-server/tests/familyAFixtureParity.test.ts` — currently imports `validateFamilyABooleanRequest` from the schema file. After refactor, imports `validateFamilyBooleanRequest` AND side-effect-imports `familyRegistryInit.ts` (the schema file itself does not init the registry).

**Tests that exercise the registry in isolation:**

* `mcp-server/tests/familyRegistry.test.ts` (NEW) — uses a freshly-constructed registry per test (NOT the singleton). Implementer choice: either expose a `createFamilyRegistry(): FamilyRegistry` factory alongside the singleton, OR expose a `__resetRegistryForTests()` symbol. Default = factory; cleaner.

---

## 6. Parity test handling (Phase A.5)

### 6.1 Decision: parity test imports raw keys via the registry

Per intent brief Decision 8 default. Rationale: the registry is the source of truth post-refactor; the parity test should validate THE source of truth against upstream.

### 6.2 Invariants preserved

The parity test enforces three things; all three must continue to work byte-equal:

1. Every server-side `FAMILY_A_RAW_KEYS` literal appears in upstream `familyA.ts` (line 20-33 of current test).
2. Every upstream rawKey extracted by regex appears in the server-side constant (line 35-62 of current test).
3. Upstream has exactly 16 rawKey declarations (line 50-54, hardcoded `length !== 16`).

The refactor preserves invariant #3 hardcoded as 16 (Decision: "keep `length === 16` hardcoded as a binding contract" per the designer prompt; matches the existing test pattern). This is the binding contract — if MCP-021A ever changes Family A's count, the test fails loud, and the operator must explicitly bump both sides.

### 6.3 Exact line changes

**`mcp-server/tests/familyAKeysParity.test.ts`:**

```diff
- import { FAMILY_A_RAW_KEYS } from '../lib/familyAKeys.ts';
+ import '../lib/familyRegistryInit.ts';  // side-effect: register Family A
+ import { getRawKeysForFamily } from '../lib/familyRegistry.ts';

+ const FAMILY_A_RAW_KEYS = Array.from(getRawKeysForFamily('parent_relation'));
```

After this change, line 22 (`for (const rawKey of FAMILY_A_RAW_KEYS)`) and line 56 (`if (!FAMILY_A_RAW_KEYS.includes(upstreamKey))`) work unchanged because the local `FAMILY_A_RAW_KEYS` is now an array derived from the registry rather than a direct import.

Line 50-54 (`if (upstreamKeys.length !== 16)`) stays unchanged. The hardcoded `16` continues to be the binding contract.

Test names stay unchanged so test-discovery + CI history is preserved.

### 6.4 Risk: implementer over-rewrites

If the implementer rewrites the parity test to compute `16` from the upstream regex match count (e.g., `if (FAMILY_A_RAW_KEYS.length !== upstreamKeys.length)` without the `!== 16` assertion), the parity check becomes a tautology — both sides would pass with 14 or 18 keys and no one would notice. The hardcoded `16` is the safety net; preserve it.

**Designer guidance to implementer:** keep both assertions: (a) `upstreamKeys.length === 16` (binding), AND (b) `FAMILY_A_RAW_KEYS.length === upstreamKeys.length` (parity).

### 6.5 Other Family A-related tests that may shift

Outside scope of the parity test but flagged here:

* `mcp-server/tests/familyAKeys.test.ts:42` hardcodes `assertEquals(FAMILY_A_RAW_KEYS.length, 16);` — this test imports `FAMILY_A_RAW_KEYS` directly from `familyAKeys.ts`, which is unchanged by this refactor. Test continues to pass as-is. NO refactor needed.
* `mcp-server/tests/familyAPrompt.test.ts:24-26` imports `FAMILY_A_RAW_KEYS` + `FAMILY_A_CLASSIFIER_SET_VERSION` from `familyAKeys.ts`. Unchanged.

---

## 7. Test plan (Phase A.6)

### 7.1 Total forecast: +42 tests

Below baseline; well under the +60 ceiling and the +150 HALT.

### 7.2 New tests by file

**NEW FILE: `mcp-server/tests/familyRegistry.test.ts` — 14 tests**

(Uses a factory `createFamilyRegistry()` for isolation; each test instantiates fresh.)

1. `registry-newly-constructed-is-empty` — `getSupportedFamilies()` returns `[]`; `isFamilySupported('parent_relation')` returns false.
2. `registry-registers-family-a` — call `register('parent_relation', metadata)`; `getSupportedFamilies()` returns `['parent_relation']`; `isFamilySupported('parent_relation')` true.
3. `registry-register-throws-on-double-registration` — register twice for same family; second call throws `Error('family already registered: parent_relation')`.
4. `registry-register-throws-on-empty-rawKeys` — register with `rawKeys: new Set()`; throws.
5. `registry-register-throws-on-empty-classifierSetVersion` — register with `classifierSetVersion: ''`; throws.
6. `registry-getSupportedFamilies-returns-frozen-snapshot` — register Family A; mutate the returned array (`.push('disagreement_axis')` — should fail because frozen) OR confirm subsequent calls don't see the mutation.
7. `registry-getSupportedFamilies-preserves-insertion-order` — register Family A, register a fake Family B; assert order is `['parent_relation', 'fake_b']` not alphabetical.
8. `registry-isFamilySupported-true-for-registered` — registers Family A; `isFamilySupported('parent_relation')` true.
9. `registry-isFamilySupported-false-for-unregistered` — `isFamilySupported('disagreement_axis')` false; `isFamilySupported('not_a_family')` false.
10. `registry-getRawKeysForFamily-returns-all-16-for-family-a` — register Family A; assert returned Set has size 16 and contains every binding rawKey.
11. `registry-getRawKeysForFamily-throws-for-unregistered-family` — `getRawKeysForFamily('disagreement_axis')` throws `Error('family not registered: disagreement_axis')`.
12. `registry-getClassifierSetVersion-returns-family-a-v1` — register Family A with `FAMILY_A_CLASSIFIER_SET_VERSION`; assert returns `'family-a-v1'`.
13. `registry-isRawKeySupportedForFamily-true-for-all-16-keys` — register Family A; assert `isRawKeySupportedForFamily('parent_relation', key)` true for each of the 16 binding keys.
14. `registry-isRawKeySupportedForFamily-false-for-sample-unsupported` — register Family A; assert false for `'fictional_raw_key_xyz'`, `'disputes_scope'` (Family B candidate), and false for `isRawKeySupportedForFamily('disagreement_axis', 'supports_parent')` (correct family-keying — even a valid Family A key returns false when queried under a different family).

**NEW FILE: `mcp-server/tests/familyRegistryInit.test.ts` — 5 tests**

(Tests the init module specifically; uses the singleton registry.)

1. `familyRegistryInit-registers-family-a-on-import` — side-effect import; `isFamilySupported('parent_relation')` true.
2. `familyRegistryInit-registers-only-family-a` — `getSupportedFamilies()` returns exactly `['parent_relation']`, length 1.
3. `familyRegistryInit-family-a-has-16-rawKeys` — `getRawKeysForFamily('parent_relation').size === 16`.
4. `familyRegistryInit-family-a-classifier-version-is-family-a-v1` — `getClassifierSetVersion('parent_relation') === 'family-a-v1'`.
5. `familyRegistryInit-initializeFamilyRegistry-is-idempotent` — call `initializeFamilyRegistry()` twice; no throw on the second call (covers Decision 5.2 idempotent guard).

**UPDATED FILE: `mcp-server/tests/familyBooleanRequestSchema.test.ts` (renamed in-place from… wait, there is NO existing test file for the schema directly)**

The only existing test that imports `validateFamilyABooleanRequest` directly is `familyAFixtureParity.test.ts` (which is a fixture parity test, not a validator behavior test). There is NO pre-refactor `familyABooleanRequestSchema.test.ts`. Validator behavior is currently tested at the tool-handler boundary in `classifyArgumentBooleanObservations.test.ts`.

This means a NEW `familyBooleanRequestSchema.test.ts` file is desirable to exercise the validator in isolation (post-refactor). 17 tests:

**NEW FILE: `mcp-server/tests/familyBooleanRequestSchema.test.ts` — 17 tests**

(Tests `validateFamilyBooleanRequest` directly, separate from the tool-handler integration. Validates byte-equal envelope shapes.)

1. `validateFamilyBooleanRequest-valid-family-a-request-passes` — full valid request → `{ ok: true, value: ... }` with all fields populated.
2. `validateFamilyBooleanRequest-empty-requestedRawKeys-array-accepted` — passes; means "classify all 16".
3. `validateFamilyBooleanRequest-empty-requestedFamilies-array-accepted` — passes; no per-entry check fires.
4. `validateFamilyBooleanRequest-rejects-non-object-with-invalid_params` — `raw: 'string'` → `{ ok: false, kind: 'invalid_params', path: '$', detail: 'must be a plain object' }` (byte-equal).
5. `validateFamilyBooleanRequest-rejects-bad-schemaVersion` — `schemaVersion: 'wrong'` → `{ ok: false, kind: 'invalid_params', path: 'schemaVersion', detail: <byte-equal expected/got string> }`.
6. `validateFamilyBooleanRequest-rejects-non-string-nodeId` — `{ ok: false, kind: 'invalid_params', path: 'nodeId', detail: 'must be string' }`.
7. `validateFamilyBooleanRequest-rejects-empty-nodeId` — length 0 → `'length below 1'`.
8. `validateFamilyBooleanRequest-rejects-oversized-nodeId` — length 513 → `'length above 512'`.
9. `validateFamilyBooleanRequest-rejects-oversized-currentText` — length 8001 → `'length above 8000'`.
10. `validateFamilyBooleanRequest-rejects-oversized-parentText` — length 8001 → `'length above 8000'`.
11. `validateFamilyBooleanRequest-rejects-oversized-threadContextExcerpt` — length 8001 → `'length above 8000'`.
12. `validateFamilyBooleanRequest-rejects-unsupported-family-with-byte-equal-envelope` — `requestedFamilies: ['disagreement_axis']` → `{ ok: false, kind: 'unsupported_family', requestedFamilies: ['disagreement_axis'] }`.
13. `validateFamilyBooleanRequest-rejects-unsupported-rawKey-with-byte-equal-envelope` — `requestedRawKeys: ['supports_parent', 'fictional_raw_key_xyz']` → `{ ok: false, kind: 'unsupported_rawKey', unsupportedRawKeys: ['fictional_raw_key_xyz'] }` (only the unsupported one in the envelope; the supported one is filtered out — matches current behavior).
14. `validateFamilyBooleanRequest-rejects-non-plain-object-definitions` — `definitions: []` (array, not plain object) → `'definitions' / 'must be plain object'`.
15. `validateFamilyBooleanRequest-rejects-non-integer-timeoutMs` — `timeoutMs: 12.5` → `'timeoutMs' / 'must be integer'`.
16. `validateFamilyBooleanRequest-rejects-timeoutMs-below-1` — `timeoutMs: 0` → `'out of range 1..60000'`.
17. `validateFamilyBooleanRequest-rejects-timeoutMs-above-60000` — `timeoutMs: 60001` → `'out of range 1..60000'`.

**UPDATED FILE: `mcp-server/tests/familyAKeysParity.test.ts` — 0 net new tests**

In-place edit per §6.3. Existing 2 tests stay; their assertions don't change.

**UPDATED FILE: `mcp-server/tests/familyAFixtureParity.test.ts` — 0 net new tests, 3 function-name updates**

In-place edit. Existing tests stay. Line 24 import + lines 245 + 256 call sites update to `validateFamilyBooleanRequest`. No new tests added; this file's job is fixture parity, not validator behavior.

**UPDATED FILE: `mcp-server/tests/classifyArgumentBooleanObservations.test.ts` — 0 net new tests**

Already exercises validator error envelopes end-to-end through the tool handler (lines 96-209 cover invalid_params / unsupported_family / unsupported_rawKey / timeoutMs / missing-field). No update needed — the file does NOT import `validateFamilyABooleanRequest` directly. NO changes.

### 7.3 Net count delta

* New: 14 (registry) + 5 (init) + 17 (schema direct) = **+36**
* Updated in-place (no net delta): 2 tests in `familyAFixtureParity.test.ts` get function-name updates; 2 tests in `familyAKeysParity.test.ts` get import updates.

**Total forecast: +36 tests.** Well within the +30 to +60 band; far from the +150 HALT.

If the implementer adds ANY of the following, expect deviation:
* +6 tests if implementer adds explicit "Family A is the only registered family" assertions across multiple files for triangulation. Defensive; acceptable.
* +5 tests if implementer adds boundary tests for parentText being undefined vs null vs empty string. Acceptable.
* >+10 tests over the forecast → review test scope; may be over-engineering. HALT at +150.

### 7.4 Tests UPDATED vs NEW classification

| File | Classification | Reason |
| --- | --- | --- |
| `familyRegistry.test.ts` | NEW | No pre-refactor counterpart |
| `familyRegistryInit.test.ts` | NEW | No pre-refactor counterpart |
| `familyBooleanRequestSchema.test.ts` | NEW | No pre-refactor counterpart; validator was only tested via tool handler |
| `familyAKeysParity.test.ts` | UPDATED in place | Decision A.5 — import via registry |
| `familyAFixtureParity.test.ts` | UPDATED in place | Function-name change at call sites |
| `classifyArgumentBooleanObservations.test.ts` | UNCHANGED | Does not import the validator directly |
| `familyAKeys.test.ts` | UNCHANGED | Imports `FAMILY_A_RAW_KEYS` from `familyAKeys.ts`, which is unchanged |
| `familyAPrompt.test.ts` | UNCHANGED | Same |
| `familyAAnthropic.test.ts` | UNCHANGED | Does not import the validator |
| `familyABanListScan.test.ts` | UNCHANGED | Out of scope |
| `familyAResponseValidator.test.ts` | UNCHANGED | Tests the response validator, not the request validator |
| `mcpBooleanObservationSchemaParity.test.ts` | UNCHANGED | Tests the response schema mirror |

---

## 8. Read-only boundary list

The implementer MUST NOT touch any of these files:

**Server-side libs (out of scope):**
* `mcp-server/lib/familyAPrompt.ts` — prompt construction; HALT #4 if touched beyond import-statement updates (none needed).
* `mcp-server/lib/familyAAnthropic.ts` — Anthropic call wrapper; HALT #4.
* `mcp-server/lib/familyABanListScan.ts` — doctrine ban-list scan; HALT #4.
* `mcp-server/lib/familyAFixtureProvider.ts` — fixture loader; not touched.
* `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` — response schema validator; not touched.
* `mcp-server/lib/seedPrompt.ts` — semantic-move seed prompt; HALT #4.
* `mcp-server/lib/familyAKeys.ts` — DATA module; the refactor REGISTERS Family A using `FAMILY_A_RAW_KEYS` + `FAMILY_A_CLASSIFIER_SET_VERSION`, but does NOT mutate or extend the file. HALT #13 if implementer touches the 16-key array or the version constant.
* `mcp-server/lib/anthropic.ts` / `anthropicCall.ts` — provider transport.
* `mcp-server/lib/doctrineBanList.ts` — universal ban-list patterns.
* `mcp-server/lib/auth.ts` / `logging.ts` / `jsonRpc.ts` / `origin.ts` / `protocolVersion.ts` / `toolDispatch.ts` / `toolRegistry.ts` — orchestration.
* `mcp-server/lib/responseHelpers.ts` / `fixtureProvider.ts` / `semanticRefereePacketSchema.ts` — semantic-referee path.

**Server-side tools (out of scope beyond import statement updates):**
* `mcp-server/tools/classifySemanticMove.ts` — semantic-move tool; not touched.

**Server-side routes (out of scope):**
* `mcp-server/routes/health.ts` / `mcp.ts` / `adapterCompat.ts` — request routing.

**Server-side scripts (out of scope):**
* `mcp-server/scripts/validate-family-a-response.ts` — Phase 3 smoke validator; reads `FAMILY_A_RAW_KEYS` directly from `familyAKeys.ts`. Does NOT need updating for this refactor (Decision A.5 only re-routes the parity test via the registry; this script can continue importing the data module directly).

**Server-side entrypoints:**
* `mcp-server/main.ts` — Deno.serve bootstrap.
* `mcp-server/bootstrap.ts` — route handler wiring. The implementer may consider side-effect-importing `familyRegistryInit.ts` here for "register on server boot" semantics, but the default plan in §5.3 (tool-side import) is sufficient and lower risk. If the implementer chooses to add the import here too, it's idempotent and harmless. Designer recommendation: SKIP — keep init responsibility at the tool layer where the registry is consumed.

**Upstream taxonomy (HALT #12):**
* `src/features/nodeLabels/**` — MCP-021A taxonomy source files. Not touched.

**Edge Functions (HALT #5):**
* `supabase/functions/**` — Edge Function code. Not touched. Edge Function calls MCP server via JSON-RPC.

**Migrations (HALT #9):**
* No migrations in this card. Persistence layer untouched.

**Fixtures (touched only via test parity verification, not modified):**
* `mcp-server/fixtures/classify-argument-boolean-observations.*.json` — fixture files. Their CONTENTS are not modified; tests continue to load them as-is.

**Docs:**
* `docs/designs/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-intent.md` — operator-authored intent brief; read-only.
* `docs/audits/MCP-SERVER-002-SMOKE-2026-05-26.md` — reference for byte-equal preservation discipline; read-only.
* `docs/core/current-status.md` — implementer adds a Phase framing handoff section (in-scope for implementer).

---

## 9. HALT trigger table (intent brief §5; designer assessment per row)

| # | HALT trigger | Designer assessment |
| --- | --- | --- |
| 1 | Proposes Family B/C/D/E key registration | DOES NOT FIRE — `familyRegistryInit.ts` registers only Family A; future families are explicit follow-on card work. |
| 2 | Proposes schema version change | DOES NOT FIRE — `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` (`mcp-021.machine-observations.boolean.v1`) imported unchanged from `mcpBooleanObservationSchemaMirror.ts`. |
| 3 | Proposes parser/sanitizer contract change | DOES NOT FIRE — validation rules from §2.4 preserved byte-equal; only the function name changes. |
| 4 | Proposes MCP server prompt change | DOES NOT FIRE — `familyAPrompt.ts`, `seedPrompt.ts`, `familyAAnthropic.ts`, `familyABanListScan.ts` all read-only-listed in §8. |
| 5 | Proposes Edge Function change beyond test-only import path updates | DOES NOT FIRE — Edge Function does not import server-side validator (Grep confirmed); no Edge Function changes proposed in this design. |
| 6 | Logs raw argument body, raw prompt, bearer token, API key | DOES NOT FIRE — no new logging proposed; existing log calls in `classifyArgumentBooleanObservations.ts:167-208` unchanged (those log `requestId` + `reason` + `status` + `httpStatus`, no bodies). |
| 7 | Proposes new taxonomy keys | DOES NOT FIRE — `FAMILY_A_RAW_KEYS` array unchanged; no new keys introduced. |
| 8 | Proposes UI/display cap changes | DOES NOT FIRE — `MAX_EVIDENCE_SPAN_CHARS = 240`, `MAX_FLAGS_PER_RESPONSE = 20`, `MAX_BODY_LEN = 8000`, `MAX_THREAD_CONTEXT_LEN = 8000` all preserved verbatim. |
| 9 | Proposes persistence layer changes | DOES NOT FIRE — no SQL, no migration, no Supabase changes in this card. |
| 10 | Proposes production-trigger changes | DOES NOT FIRE — `MCP-021C-AUTO-TRIGGER-FAMILY-A` runtime trigger is unaffected by an internal validator rename. |
| 11 | Proposes auto-trigger changes | DOES NOT FIRE — same as #10. |
| 12 | Proposes any change to MCP-021A registry source files | DOES NOT FIRE — `src/features/nodeLabels/**` is on the read-only list in §8. |
| 13 | Proposes changes to Family A's 16 raw keys or `classifierSetVersion` | DOES NOT FIRE — `familyAKeys.ts` is on the read-only list; the rename does not touch the data. |
| 14 | Family A behavior is NOT byte-equal after refactor | **POTENTIAL RISK** — flagged. The 17 schema-direct tests in §7.2 explicitly assert byte-equal envelope shapes for every failure path. The 11 tests in `classifyArgumentBooleanObservations.test.ts` exercise the tool-handler boundary unchanged. If implementer changes ANY validation rule message string (e.g., `'must be string'` → `'must be a string'`), this HALT fires. Designer mitigation: §2.4 lists all 11 validation rules verbatim with their literal detail strings; implementer must copy-paste preserve. |
| 15 | `tools/list` output falsely advertises B/C/D/E support | DOES NOT FIRE — `toolRegistry.ts` builds `tools/list` from the static `CLASSIFY_BOOLEAN_OBSERVATIONS_TOOL` metadata, not from the runtime registry. Tool description still mentions "Family A (parent_relation)" verbatim. If the implementer DOES re-source the tool description from `getSupportedFamilies()`, it must continue to return `['parent_relation']` until B lands — design defaults to NOT doing this (out of scope; description-text refactor is a separate card). |
| 16 | `unsupported_family` error envelope shape changes | DOES NOT FIRE — §2.4 specifies the byte-equal envelope; test 12 in §7.2 asserts it; tool-handler tests (line 125-143 of existing test file) also assert it. |
| 17 | `invalid_params` error envelope shape changes | DOES NOT FIRE — §2.4 specifies the byte-equal envelope; tests 4-11, 14-17 in §7.2 assert it. |
| 18 | Test count forecast exceeds +150 | DOES NOT FIRE — forecast is **+36 tests**; 75% under the +150 ceiling. |
| 19 | Verdict/winner/correctness/fallacy/bad-faith language in user-facing strings | DOES NOT FIRE — the only user-facing strings in this refactor are the unchanged error messages from §2.4 (`'must be string'`, `'length above 8000'`, `'Family A is the only supported family in this server build'`, etc.). None contain banned tokens. Designer self-scanned this design doc for the words `winner`, `loser`, `correct`, `truth`, `liar`, `fallacy`, `bad faith`, `extremist`, `propagandist` and found ZERO occurrences in any string that would land in user UI or API responses (occurrences are confined to this HALT row and the doctrine self-check section, which are designer-prose). |
| 20 | Working tree contains unclassified untracked files at PR creation | DOES NOT FIRE if implementer adheres to baseline. Known operator-territory exclusions per intent brief: `docs/testing-runs/`, `netlify-prod.git`, `mcp021c-edge-smoke-*`, `phase5-mcpserver002-*`. These are already untracked at the predecessor HEAD and are NOT part of this card. |

**Summary:** 19 of 20 HALTs do not fire under the design. **HALT #14 (byte-equal preservation) is the dominant risk** and is mitigated by:
* Explicit literal-string preservation in §2.4.
* Byte-equal envelope assertions in tests 4-17 of §7.2.
* Preserved tool-handler integration tests in `classifyArgumentBooleanObservations.test.ts` (unchanged).
* Smoke plan §8 of intent brief explicitly captures Phase 3 (`unsupported_family` rejection regression) for end-to-end verification.

---

## 10. Brief ledger

| File | Why it matters | In/Out scope |
| --- | --- | --- |
| `mcp-server/lib/familyABooleanRequestSchema.ts` | The file being refactored; current single-family validator | **IN — renamed to `familyBooleanRequestSchema.ts`** |
| `mcp-server/lib/familyAKeys.ts` | Supplies `FAMILY_A_RAW_KEYS` + `FAMILY_A_CLASSIFIER_SET_VERSION` for Family A registration | **IN — read-only consumer; data not modified** |
| `mcp-server/lib/familyRegistry.ts` | NEW — `FamilyValidatorRegistry` pattern | **IN — new file** |
| `mcp-server/lib/familyRegistryInit.ts` | NEW — explicit Family A registration call site | **IN — new file** |
| `mcp-server/tools/classifyArgumentBooleanObservations.ts` | Tool handler that imports the validator | **IN — function-name update + side-effect import of registry init** |
| `mcp-server/tests/familyAKeysParity.test.ts` | Parity test between MCP-021A and the server-side mirror | **IN — re-routed to import via registry** |
| `mcp-server/tests/familyAFixtureParity.test.ts` | Fixture parity test that calls the validator directly | **IN — function-name update at 3 call sites** |
| `mcp-server/tests/classifyArgumentBooleanObservations.test.ts` | Tool-handler integration test | **NOT TOUCHED — doesn't import validator directly** |
| `mcp-server/tests/familyRegistry.test.ts` | NEW — registry behavior tests | **IN — new file** |
| `mcp-server/tests/familyRegistryInit.test.ts` | NEW — init module tests | **IN — new file** |
| `mcp-server/tests/familyBooleanRequestSchema.test.ts` | NEW — validator direct tests with byte-equal envelope assertions | **IN — new file** |
| `mcp-server/lib/familyAPrompt.ts` | Defines `ValidatedFamilyARequest` (success-envelope value type) | **OUT — HALT #4** |
| `mcp-server/lib/familyAAnthropic.ts` | Anthropic transport for Family A classification | **OUT — HALT #4** |
| `mcp-server/lib/familyABanListScan.ts` | Doctrine ban-list scan over Family A responses | **OUT — HALT #4** |
| `mcp-server/lib/familyAFixtureProvider.ts` | Loads fixture response packets | **OUT** |
| `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` | Response wire-shape validator + schemaVersion constant | **OUT — provides `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` import only** |
| `mcp-server/lib/seedPrompt.ts` | Semantic-move seed prompt | **OUT — HALT #4** |
| `mcp-server/scripts/validate-family-a-response.ts` | Phase 3 smoke validator script | **OUT — continues to import `FAMILY_A_RAW_KEYS` directly from `familyAKeys.ts`** |
| `mcp-server/bootstrap.ts` | Route handler wiring | **OUT — implementer may add init import here but default is to keep init at tool layer (§5.3)** |
| `mcp-server/main.ts` | Deno.serve entry point | **OUT** |
| `mcp-server/routes/**` | HTTP routes | **OUT** |
| `mcp-server/fixtures/**` | Fixture JSON files | **OUT — contents unchanged** |
| `src/features/nodeLabels/**` | MCP-021A upstream taxonomy source | **OUT — HALT #12** |
| `supabase/functions/**` | Edge Function code | **OUT — HALT #5; no consumer of the validator** |
| `__tests__/**` | Jest tests | **OUT — none import the validator** |
| `docs/designs/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-intent.md` | Operator-authored intent brief | **OUT — read-only spec** |
| `docs/audits/MCP-SERVER-002-SMOKE-2026-05-26.md` | Predecessor smoke audit | **OUT — read-only reference** |
| `docs/core/current-status.md` | Stage status; gets a Phase framing handoff section after implementer commits | **OUT-for-designer / IN-for-implementer** |

---

## Doctrine self-check

* **cdiscourse-doctrine §1 (Score is gameplay, not truth):** This refactor never touches any user-facing string. The validator's error messages (`'must be string'`, `'length above 8000'`, `'Family A is the only supported family in this server build'`) contain no verdict tokens. The structured-content fields (`requestedFamilies`, `unsupportedRawKeys`) are pure machine-readable arrays. PASS.
* **cdiscourse-doctrine §4 (AI moderator limits):** No AI call introduced; this is a request validator. The validator runs BEFORE any Anthropic call. PASS.
* **cdiscourse-doctrine §5 (rules engine is sacred):** `src/lib/constitution/engine.ts` not touched. PASS.
* **cdiscourse-doctrine §6 (secrets policy):** No new env reads; no new log statements; no bearer-token handling. Existing `log(...)` calls in `classifyArgumentBooleanObservations.ts` preserved unchanged. PASS.
* **cdiscourse-doctrine §7 (no AI calls from production app):** This card touches `mcp-server/` only. `mcp-server/` is the server side, not the production app. No new client AI calls. PASS.
* **cdiscourse-doctrine §10a (Observations vs Allegations):** This refactor is at the request-validator layer, below the observation-emit layer. The `MachineObservationFamily` type comes from upstream `src/features/nodeLabels/nodeLabelTypes.ts` and is not redefined here. PASS.
* **test-discipline:** +36 tests forecast; all enumerated by name in §7.2; new files have clear ownership; existing tests preserved (test count goes UP, not DOWN). Test count of refactored validator surface (§7.2 line items 4-17 plus tool-handler tests 96-209) provides byte-equal verification. PASS.
* **supabase-edge-contract:** No Edge Function changes; HALT #5 explicitly guards against this. Edge Function continues to call the MCP server via JSON-RPC; the rename of an internal server-side function is invisible to the Edge Function. PASS.

---

## Operator steps (if any)

**None — pure server-side refactor.**

After the implementer's PR merges to main:
* Deno Deploy auto-deploys the new build (per MCP-SERVER-001 operator setup; confirmed in `docs/audits/MCP-SERVER-002-SMOKE-2026-05-26.md` Phase 2).
* No Supabase migration; no Edge Function deploy needed.
* The post-merge smoke per intent brief §8 is the operator's verification step; the smoke script and audit-doc template are part of the implementer's deliverable.

---

## Open question for the operator

None blocking. One soft question for future-proofing:

* **Should `bootstrap.ts` side-effect-import `familyRegistryInit.ts`** in addition to the tool-handler import? Doing so would guarantee the registry is initialized at server-boot time even if the tool handler is somehow not imported during a future refactor. Designer default: NO (keep init at the tool layer; smaller blast radius if Family B later wants a different init pattern). Operator may override during implementation review.
