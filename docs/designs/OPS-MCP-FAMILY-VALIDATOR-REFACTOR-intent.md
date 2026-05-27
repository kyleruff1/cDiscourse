# OPS-MCP-FAMILY-VALIDATOR-REFACTOR — Intent Brief

**Card:** OPS-MCP-FAMILY-VALIDATOR-REFACTOR — Multi-family shared
boolean-observation request validator (Stage 0 prerequisite for
MCP-SERVER-003-BATCH-B-C-D-E)

**Goal:** refactor the MCP server's boolean-observation request
validation from Family-A-specific to a shared multi-family registry
pattern, while preserving Family A behavior byte-equal. Prepares
the validator/registry surface so each new family (B, C, D, E, F,
G, H, I, J) can register additively without duplicating validator
files.

**This card is:**

* A server-side internal refactor of `mcp-server/lib/familyABooleanRequestSchema.ts`
  and the registry pattern that supports it.
* S-M effort: ~2-3 hours pipeline + ~10-15 min smoke.
* Stage 0 prerequisite for MCP-SERVER-003-BATCH-B-C-D-E.

**This card is NOT:**

* A Family B/C/D/E support card. After this card ships, Family B
  can register itself with a one-line addition rather than creating
  `familyBBooleanRequestSchema.ts`.
* A taxonomy card (no changes to `src/features/nodeLabels/`).
* A prompt or classifier change (no changes to `familyAPrompt.ts`,
  `familyAAnthropic.ts`, `familyABanListScan.ts`).
* An Edge Function or UI card.

---

## 1. Sequencing chain

```
MCP-021A  taxonomy + parser:                       d6648b4
MCP-021B  persistence + Source 6 adapter:          eaa1aeb (smoke PASS)
MCP-021C-EDGE  runtime spine:                      9a4de95
MCP-SERVER-001  server foundation:                 8a1652c (smoke PASS bae4984)
MCP-SERVER-002  Family A classifier:               27bb837 (smoke PASS fc28605)
MCP-021C-EDGE-SMOKE  PASS:                         ebf4482
MCP-021C-EDGE-RESPONSE-SUMMARY-FIX:                c5c6d9b
MCP-021C-FAMILY-A-PROD-SMOKE  PASS:                67fcba5
MCP-021C-AUTO-TRIGGER-FAMILY-A:                    2af7195
MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE  PASS:        e281753
Current HEAD must be:                              e281753 or later
```

---

## 2. Why this card exists

### Inspection finding

From the operator's MCP-021A family-registry inspection report
(2026-05-26):

> "The shared `SUPPORTED_FAMILIES` constant in
> `familyABooleanRequestSchema.ts` is currently single-string
> `['parent_relation']`; if B/C/D/E ship as separate cards rather
> than at once, the validator/registry split needs to either be
> per-family-file (e.g., `familyBBooleanRequestSchema.ts`) or
> refactored to a shared `boolean-request-schema.ts` keyed by
> family — recommend the refactor as an OPS prerequisite to avoid
> four near-duplicate validator files."

### Cost of not doing this card

Without this refactor the B/C/D/E batch produces four near-duplicate
validator files (one per family) that each restate the same
`schemaVersion` / `nodeId` / `currentText` / `parentText` /
`threadContextExcerpt` / `requestedFamilies` / `requestedRawKeys` /
`definitions` / `timeoutMs` checks. The refactor pays for itself
before Family C ships.

### What this card produces

A shared `FamilyValidatorRegistry` pattern: Family A self-registers,
`getSupportedFamilies()` derives the truth, `validateFamilyBooleanRequest`
routes to the correct family. Adding Family B becomes one
`registerFamily('disagreement_axis', { rawKeys: FAMILY_B_RAW_KEYS,
classifierSetVersion: 'family-b-v1' })` call.

---

## 3. Strict scope

**ALLOWED:**

* Rename `mcp-server/lib/familyABooleanRequestSchema.ts` →
  `mcp-server/lib/familyBooleanRequestSchema.ts`.
* Introduce `mcp-server/lib/familyRegistry.ts` (new) holding the
  `FamilyValidatorRegistry` pattern.
* Family A self-registers at init time (Decision 4 chooses approach).
* Refactor `validateFamilyABooleanRequest` →
  `validateFamilyBooleanRequest`.
* Update `mcp-server/tools/classifyArgumentBooleanObservations.ts`
  imports to the new validator name.
* Update `mcp-server/tests/familyAKeysParity.test.ts` to read raw
  keys via the registry (still hard-fails on drift).
* New tests for the registry pattern + refactored validator (+30 to
  +60 tests forecast).
* `docs/core/current-status.md` handoff section.

**DISALLOWED:**

* Family B/C/D/E key registration in this card.
* Schema version changes (`mcp-021.machine-observations.boolean.v1`
  stays).
* Parser / sanitizer contract changes.
* MCP server prompt changes (`familyAPrompt.ts`, `seedPrompt.ts`
  untouched).
* Edge Function changes beyond test-only import path updates
  (Edge Function calls the server via JSON-RPC, not by importing
  validator functions).
* MCP-021A taxonomy source-file changes
  (`src/features/nodeLabels/**`).
* Changes to Family A's 16 raw keys or classifier-set-version
  (must stay `'family-a-v1'`).
* UI / display cap changes.
* Persistence layer changes.
* Production-trigger / auto-trigger changes.

---

## 4. Binding decisions (1-8)

### Decision 1 — Refactor approach: rename + extend

**Default path:**

* Rename `familyABooleanRequestSchema.ts` →
  `familyBooleanRequestSchema.ts` (drop the "A"; signals multi-family
  scope).
* Introduce a family registry structure (Map or Record) keyed by
  family id → validator metadata.
* Family A registers itself into the registry from its existing
  `familyAKeys.ts` data.
* `SUPPORTED_FAMILIES` becomes a derived value: `registry.keys()`.

**Alternative considered + rejected:** per-family validator files
(`familyABooleanRequestSchema.ts`, `familyBBooleanRequestSchema.ts`,
etc.) — exactly what this card exists to prevent.

### Decision 2 — Registry structure

A `FamilyValidatorRegistry` exposing:

* `register(familyId, { rawKeys, classifierSetVersion })`
* `getSupportedFamilies(): ReadonlyArray<MachineObservationFamily>`
* `getRawKeysForFamily(familyId): ReadonlySet<string>`
* `getClassifierSetVersion(familyId): string`
* `isFamilySupported(familyId): boolean`
* `isRawKeySupportedForFamily(familyId, rawKey): boolean`

Family A registers itself at module load (or in a register function
called from tool init). The registry is the single source of truth
for "what families does this MCP server support".

### Decision 3 — Validator function signature

Preserve the existing function signature exactly. Callers should NOT
need to change beyond the function name. Current shape:

```
validateFamilyABooleanRequest(input): ValidationResult
```

Refactored shape:

```
validateFamilyBooleanRequest(input): ValidationResult
```

Callers update the function name only. No new arguments. No new
return shape. Error envelope (`invalid_params` / `unsupported_family`
/ `unsupported_rawKey`) byte-equal.

### Decision 4 — Family A registration: explicit, not implicit

Family A's registration happens via an explicit call:

```ts
registerFamily('parent_relation', {
  rawKeys: FAMILY_A_RAW_KEYS,
  classifierSetVersion: 'family-a-v1',
});
```

This makes the pattern visible: future families add one
`registerFamily(...)` call. The MCP server's initialization path
shows all supported families at a glance.

The designer's Phase A.4 audit chooses among three places to put
that call (module side-effect, tool init, dedicated init module).
Default = dedicated init module.

### Decision 5 — Backwards-compatibility shim: NO

This is a server-side internal refactor. There are no external
consumers (the Edge Function calls the MCP server via JSON-RPC,
not by importing validator functions). All callers of
`validateFamilyABooleanRequest` are inside `mcp-server/`.

**Default: NO backwards-compat shim.** Rename the function. Update
callers. Delete the old import paths cleanly. If the rename causes
unexpected breakage in test discovery, the designer can re-evaluate.

**Alternative if rename surfaces unexpected callers:** keep
`validateFamilyABooleanRequest` as a thin wrapper that calls
`validateFamilyBooleanRequest` with `family='parent_relation'`;
mark as `@deprecated`; remove in a follow-up card.

### Decision 6 — tools/list output: stays Family A only

The MCP server's `tools/list` response advertises which families
the `classify_argument_boolean_observations` tool supports. After
this refactor, that list MUST still be exactly `['parent_relation']`.

If the implementer accidentally derives tools/list from
`registry.getSupportedFamilies()` — which is correct future
behavior — verify that registry only has Family A registered at
this point. The "is the list still Family A only" check is part of
the reviewer matrix (Item G).

### Decision 7 — Test surface: extend, don't duplicate

Family A's existing validator tests should be UPDATED to call the
new function name, not duplicated. New tests for the registry
pattern:

* `registry-registers-family-a`
* `registry-rejects-double-registration` (defensive)
* `registry-supported-families-returns-only-registered`
* `registry-isFamilySupported-correctly-reports`
* `validateFamilyBooleanRequest-routes-to-correct-family`
* `validateFamilyBooleanRequest-rejects-unsupported-family`
* `validateFamilyBooleanRequest-rejects-unsupported-rawKey-per-family`

Total new tests target: +30 to +60. If forecast exceeds +150, HALT
(scope is wrong).

### Decision 8 — Parity test extension

The existing `mcp-server/tests/familyAKeysParity.test.ts`
hardcodes `length=16` and the 16 raw key names. Per the inspection
report:

> "Parity enforced by `mcp-server/tests/familyAKeysParity.test.ts`
> (reads both source files, hard-fails on drift)"

This file MUST continue to work after refactor. The parity check
between MCP-021A source and the server-side mirror is structural.
The test can be UPDATED to import via the registry (call
`registry.getRawKeysForFamily('parent_relation')` instead of
importing `FAMILY_A_RAW_KEYS` directly), but it must keep enforcing
the parity invariant.

---

## 5. Conditional HALT triggers (20)

### Protocol + Security (1-6)

1. Proposes Family B/C/D/E key registration in this card.
2. Proposes schema version change.
3. Proposes parser/sanitizer contract change.
4. Proposes MCP server prompt change.
5. Proposes Edge Function change beyond test-only import path
   updates.
6. Logs raw argument body, raw prompt, bearer token, or API key.

### Scope (7-13)

7. Proposes new taxonomy keys.
8. Proposes UI/display cap changes.
9. Proposes persistence layer changes.
10. Proposes production-trigger changes.
11. Proposes auto-trigger changes.
12. Proposes any change to MCP-021A registry source files.
13. Proposes changes to Family A's 16 raw keys or
    `classifierSetVersion` (must stay `'family-a-v1'`).

### Architecture (14-18)

14. Family A behavior is NOT byte-equal after refactor.
15. `tools/list` output falsely advertises B/C/D/E support.
16. `unsupported_family` error envelope shape changes.
17. `invalid_params` error envelope shape changes.
18. Test count forecast exceeds +150 (refactor should not balloon
    test surface; if it does, scope is wrong).

### Doctrine + Working tree (19-20)

19. Verdict/winner/correctness/fallacy/bad-faith language appears
    in user-facing strings (defensive; refactor shouldn't touch
    user-facing strings).
20. Working tree contains unclassified untracked files at PR
    creation (operator-territory `docs/testing-runs/` +
    `netlify-prod.git` + `mcp021c-edge-smoke-*` +
    `phase5-mcpserver002-*` are KNOWN exclusions).

Any ONE fires HALT. Stage 2A surfaces and waits for operator review.

---

## 6. Required designer Phase A audits (6)

### A.1 — Current validator surface enumeration

* Identify exact exports from `familyABooleanRequestSchema.ts`.
* Identify all importers in `mcp-server/` (and elsewhere if any).
* Document the current API surface to be preserved.

### A.2 — Registry structure design

* Choose: `Map<string, FamilyMetadata>` vs `Record<string,
  FamilyMetadata>` vs class-based registry.
* **Default:** Map (allows ordered iteration; ergonomic `.keys()`
  etc.).
* Document choice + rationale.

### A.3 — Naming

* Confirm new file: `familyBooleanRequestSchema.ts` (drop "A").
* Confirm new function name: `validateFamilyBooleanRequest`.
* Confirm new types: `SupportedFamily` (alias of
  `MachineObservationFamily` intersected with registered keys).
* Document any naming alternatives considered.

### A.4 — Family A registration call site

* Where does Family A self-register?
  * **Option 1:** Module side-effect at top of `familyAKeys.ts`.
  * **Option 2:** Explicit call from tool init in
    `classifyArgumentBooleanObservations.ts`.
  * **Option 3:** Dedicated registry-init module that registers all
    currently-supported families.
* **Default:** Option 3 (explicit init module; makes future family
  additions obvious; the init module is the diff readers look at).
* Document choice.

### A.5 — Parity test refactor approach

* Confirm `familyAKeysParity.test.ts` continues to work.
* Decide whether parity test imports from registry or from
  `familyAKeys` directly.
* **Default:** imports from registry (proves the registry is the
  source of truth).

### A.6 — Test plan

* Forecast test delta: +30 to +60 (HALT at +150).
* Enumerate new test names (per Decision 7).
* Confirm existing Family A validator tests are UPDATED not
  duplicated.

---

## 7. Required tests (+30 to +60 forecast)

### Registry-pattern tests (new)

* Registry registers Family A correctly.
* Registry rejects double-registration (defensive).
* `getSupportedFamilies()` returns only `['parent_relation']`.
* `isFamilySupported()` returns true for `parent_relation`, false
  for `disagreement_axis` / `misunderstanding_repair` / etc.
* `isRawKeySupportedForFamily()` returns correct values for all
  16 Family A keys + sample unsupported keys.

### Refactored validator tests (renamed)

* `validateFamilyBooleanRequest` with valid Family A request →
  success.
* With Family A + unsupported rawKey → `unsupported_rawKey` error
  (envelope shape byte-equal to pre-refactor).
* With unsupported family → `unsupported_family` error (envelope
  shape byte-equal).
* With mixed valid + invalid keys → `invalid_params` error
  (envelope shape byte-equal).
* Existing Family A validator behavior tests UPDATED to call new
  function name; all PASS.

### Parity (updated)

* `familyAKeysParity.test.ts` reads from registry; PASS.

### Tools/list regression

* `tools/list` output still advertises only Family A.

**HARD CAP:** If forecast exceeds +150 new tests, scope is wrong;
HALT.

---

## 8. Smoke plan (single-phase post-merge smoke)

Audit file: `docs/audits/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE-<date>.md`

### Phase 1 — Pre-flight

* HEAD at refactor merge SHA.
* Hosted MCP server still ACTIVE.
* Family A still the only family advertised via `tools/list`.

### Phase 2 — Hosted MCP server smoke (Family A still works)

* Direct call to `/mcp/adapter-compat` with Family A request.
* Validate response shape against MCP-021A schema.
* Confirm `classifierSetVersion` still `'family-a-v1'`.
* Confirm 16 raw keys still expected.

### Phase 3 — Edge Function `admin_validation` regression

* Acquire JWT via env-backed bot login (same as AUTO-TRIGGER-SMOKE).
* POST to `classify-argument-boolean-observations` with
  `admin_validation` mode + the 3 seeded args.
* Verify response shape unchanged.
* Verify persistence rows written with same metadata as EDGE-SMOKE.

### Phase 4 — Unsupported family rejection regression

* POST to `classify-argument-boolean-observations` with
  `requestedFamilies=['disagreement_axis']` + `admin_validation`
  mode.
* Verify error envelope = `unsupported_family` (byte-equal to
  pre-refactor envelope).

### Phase 5 — Regression tests

```
npx jest __tests__/mcpOneTwoOneC
npx jest __tests__/mcpOneTwoOneB
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

### Phase 6 — Audit doc finalization

Required sections: header, 5-phase outcomes, verdict,
authorizations.

### Verdict rules

**PASS:**

* All 5 phases clean.
* Family A behavior byte-equal verified end-to-end.
* Family B/C/D/E correctly rejected by `unsupported_family` path.
* No regressions.

**PARTIAL:**

* Family A still works but `tools/list` output drift.
* OR one regression suite fails (independent of refactor).

**FAIL:**

* Family A response shape changed.
* Family A `admin_validation` persistence shape changed.
* Family A unexpectedly returns errors for valid requests.
* Error envelope shape changed.
* B/C/D/E accidentally enabled.

---

## 9. Brief ledger

| Item | Source / Path | Why it matters |
| --- | --- | --- |
| `mcp-server/lib/familyABooleanRequestSchema.ts` | Current single-family validator | The file to refactor |
| `mcp-server/lib/familyAKeys.ts` | 16 raw keys + `family-a-v1` | Read-only; supplies registration data |
| `mcp-server/tools/classifyArgumentBooleanObservations.ts` | Tool importing the validator | Caller; must use new function name |
| `mcp-server/tests/familyAKeysParity.test.ts` | Parity test | Must continue to work; reads via registry |
| `mcp-server/lib/familyAPrompt.ts` | System + user prompt | Read-only; out of scope |
| `mcp-server/lib/familyAAnthropic.ts` | Anthropic call | Read-only; out of scope |
| `mcp-server/lib/familyABanListScan.ts` | Doctrine ban-list scan | Read-only; out of scope |
| `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` | Wire-shape validator | Read-only; out of scope |
| `src/features/nodeLabels/**` | MCP-021A taxonomy source | Read-only; out of scope (HALT #12) |
| `supabase/functions/**` | Edge Function | Read-only beyond test-only path updates (HALT #5) |

---

## 10. Authorization

After this card's PR merges and post-merge smoke PASSes:

* **OPS-MCP-FAMILY-VALIDATOR-REFACTOR: PASS**
* **MCP-SERVER-003-BATCH-B-C-D-E: STAGE 0 COMPLETE; AUTHORIZED to
  begin Family B (MCP-SERVER-003-FAMILY-B).**
* Family A operational status: unchanged.

If smoke FAILs, file `OPS-MCP-FAMILY-VALIDATOR-REFACTOR-FIX` and do
NOT begin any family-batch work until the refactor is stable.
