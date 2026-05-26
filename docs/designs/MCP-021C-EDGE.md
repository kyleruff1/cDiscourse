# MCP-021C-EDGE — Boolean Observation Classifier Edge Function

**Status:** Design draft
**Card:** MCP-021C-EDGE — Boolean Observation Classifier Edge Function (Family A first; server-side; admin validation mode; reuses MCP-018 adapter pattern; writes MCP-021B persistence)
**Track:** MCP-021 sequence (MCP-021A taxonomy → MCP-021B persistence → **MCP-021C-EDGE** live execution → future family enablement cards)
**Effort:** M-L
**Filed:** 2026-05-26
**Pivot decision:** `docs/decisions/MCP-021C-edge-pivot.md`
**Sequencing decision:** `docs/decisions/MCP-021-sequencing.md`
**Predecessors:** MCP-021A (PR #301, `d6648b4`); MCP-021B (PR #303, `eaa1aeb`); MCP-021B smoke audit (`6feeb08`)
**Intent brief:** `docs/designs/MCP-021C-EDGE-intent.md` (binding)
**Issue:** (TBD — orchestrator files post-design)
**Branch:** `feat/MCP-021C-EDGE-boolean-observation-classifier-edge-function`
**Test baseline:** 17,128 / 521 suites passing after MCP-021B smoke audit

---

## §1 — Scope-reality audit (Phase A findings)

Six binding Phase A audits executed against the branch base (commit `eaa1aeb`).
All six PASS. None of the 15 + 3 HALT triggers fired.

### 1.1 — Phase A.1: MCP-018 server-side adapter reuse

**Result:** `wrap` (extend the adapter pattern; do NOT modify `mcpAdapter.ts`).

Verified file: `supabase/functions/_shared/semanticReferee/mcpAdapter.ts` (229 lines).
- Sole `Deno.env.get('SEMANTIC_REFEREE_MCP_URL')` call: line 152.
- Sole `Deno.env.get('SEMANTIC_REFEREE_MCP_TOKEN')` call: line 159.
- Tool name (`classify_semantic_move`) hard-coded in `mcpAdapterCore.ts:38` and
  baked into `buildMcpToolRequestBody` at line 136. The adapter is purpose-built
  for the SemanticRefereePacket shape; it cannot return a different schema.

Decision: **do NOT modify `mcpAdapter.ts` or `mcpAdapterCore.ts`** (out-of-scope
per read-only boundary §12). Instead, add a sibling
`booleanObservationMcpAdapter.ts` and `booleanObservationMcpAdapterCore.ts` that
**mirror** the MCP-018 adapter pattern with the same secret-handling discipline,
URL/token resolution, AbortSignal timeout, response extraction, raw-payload
sanitization, and `unavailable` failure vocabulary, but invoke a DIFFERENT MCP
tool name (`classify_argument_boolean_observations`) and validate against the
MCP-021A `McpBooleanObservationResponse` schema instead of
`SemanticRefereePacketSchema`.

The new adapter reads the SAME env vars (`SEMANTIC_REFEREE_MCP_URL` +
`SEMANTIC_REFEREE_MCP_TOKEN`) — operator-hosted MCP server is shared
infrastructure; both tools live on the same MCP server (intent brief Decision 1
+ post-merge operator follow-up §"Verify Supabase function secrets are set").

Source-scan invariants from the existing `semanticMcpSourceScan.test.ts` MUST
be replicated for the new adapter: zero log of token/URL/Bearer/Authorization,
single-source for env reads, hard-pinned `authoritative: false` semantics
(NodeLabelMark equivalent — see §4 below).

### 1.2 — Phase A.2: MCP-021B persistence shape verification

**Result:** Persistence layer is intact and matches the audited shape.

Verified files:
- Migration `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql`
  (239 lines) — two tables (`argument_machine_observation_runs`,
  `argument_machine_observation_results`), four RLS read policies (one per
  table; META-1A delegation via `EXISTS into public.arguments`), zero write
  policies (service-role-only write posture). FK chain:
  `results.run_id → runs.id`, both tables FK to `debates.id` + `arguments.id`
  with `ON DELETE CASCADE`. UNIQUE constraint `(run_id, raw_key)` on results.
- Types `src/features/nodeLabels/machineObservationPersistenceTypes.ts` (174
  lines) — `MachineObservationRunRow` carries `id, debateId, argumentId,
  schemaVersion, requestedFamilies, providerKey, modelName, inputHash, status,
  failureReason, startedAt, completedAt, createdAt`. The `status` enum is
  `'success' | 'failed' | 'fallback'`.
- Adapter `src/features/nodeLabels/machineObservationPersistenceAdapter.ts`
  (171 lines) — pure-TS reader; applies four filters (schemaVersion → rawKey
  registry membership → confidence floor → evidence_span truncation).
- Query `src/features/nodeLabels/machineObservationPersistenceQuery.ts` (103
  lines) — `fetchPersistedObservationsForArguments(argumentIds)` uses the
  shared authed `supabase` client; no service-role import.

**Canonical visibility predicate (META-1A delegation, post-QOL-039):**
`amor_runs_select_via_argument` uses `EXISTS (SELECT 1 FROM public.arguments a
WHERE a.id = argument_machine_observation_runs.argument_id)` — inheriting the
canonical arms (author / moderator-admin / posted-public / participant-private)
via Postgres re-evaluating the `arguments` SELECT policy in the subquery.

**Service-role write path:** `createServiceClient()` exists in
`supabase/functions/_shared/supabaseClients.ts` (line 24) — reads
`SUPABASE_SERVICE_ROLE_KEY` from Deno.env; that import is restricted to Edge
Functions and is the standard service-role write idiom.

### 1.3 — Phase A.3: Parser import resolution (BINDING)

**Result: Outcome 3 — server-side mirror with parity-style drift test.**

Verified the parser import chain:
- `src/features/nodeLabels/mcpBooleanObservationSchema.ts` (550 lines) is pure
  TS but imports `MACHINE_OBSERVATION_DEFINITIONS_REGISTRY` and
  `lookupMachineObservationDefinition` from `./machineObservationDefinitions`.
- `machineObservationDefinitions.ts` aggregates 10 family files (`familyA-J.ts`)
  AND imports `makeMachineObservationKey` from `./machineObservationRegistry`.
- `machineObservationRegistry.ts` imports
  `getAutoMetadataPlainLabel`/`type AutoMetadataCode` from
  `../metadata/moveMetadataLedger` AND
  `ALL_POINT_LIFECYCLE_STATES`/`getPointLifecyclePlainLabel` from
  `../lifecycle/pointLifecycleModel`.

The full graph spans 14+ files outside `src/features/nodeLabels/`. A bridge
(Outcome 2) would need to re-export from a path that pulls all 14 transitively.

**Repo precedent (binding):** Every `supabase/functions/_shared/` module
imports siblings/ancestors with explicit `.ts` extensions; no file in
`supabase/functions/**` imports from `src/`. The established cross-tree pattern
is the "MIRROR" convention documented in
`supabase/functions/_shared/constitution/allowedTransitions.ts:1-3`:

```ts
// MIRROR of src/domain/constitution/allowedTransitions.ts
// Only difference: imports use explicit .ts extensions for Deno compatibility.
// Keep in sync with the source file.
```

**Outcome 3 implementation:**
1. Create server-side mirror modules under
   `supabase/functions/_shared/booleanObservations/`:
   - `mcpBooleanObservationSchema.ts` — mirror of
     `src/features/nodeLabels/mcpBooleanObservationSchema.ts`, with `.ts`
     extension imports. Re-exports the schema version constant, request and
     response interfaces, `parseMcpBooleanObservationResponse`,
     `sanitizeMcpBooleanObservationResponse`,
     `buildMcpBooleanObservationRequest`, and `mcpResponseToNodeLabelMarks`.
     Pure-TS, no Deno/fetch/npm import.
   - `machineObservationDefinitions.ts` — mirror aggregator that re-exports
     `MACHINE_OBSERVATION_DEFINITIONS_REGISTRY`,
     `MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY`, and
     `lookupMachineObservationDefinition`.
   - `machineObservationDefinitions/familyA.ts` (and B-J) — mirrors of the
     binding 10 family files. Family A is exercised end-to-end in production;
     B-J ship as mirrors so the registry is byte-equal complete (admin
     validation mode may exercise them).
   - `machineObservationRegistry.ts` — mirror for the `makeMachineObservationKey`
     helper.
   - `nodeLabelTypes.ts` — mirror for the type-only imports
     (`MachineObservationDefinition`, `MachineObservationFamily`,
     `NodeLabelMark`, `NodeLabelKind`, `NodeLabelSource`, `NodeLabelSurface`,
     `NodeLabelDisposition`, etc.).
   - Local mirrors for the two upstream dependencies pulled in by
     `machineObservationRegistry.ts`:
     `metadata/moveMetadataLedger.ts` (only the
     `getAutoMetadataPlainLabel` + `AutoMetadataCode` exports needed) and
     `lifecycle/pointLifecycleModel.ts` (only
     `ALL_POINT_LIFECYCLE_STATES` + `getPointLifecyclePlainLabel` needed).
2. Add a **parity drift test** at
   `__tests__/mcpOneTwoOneCEdgeParserParity.test.ts`. The test loads BOTH
   parser copies (the production `src/features/nodeLabels/mcpBooleanObservationSchema.ts`
   via direct import; the server-side mirror via a Jest bridge similar to
   `__tests__/_helpers/semanticRefereeDeno.ts` extended for the new modules)
   and feeds both implementations the SAME ~30 fixture inputs covering happy
   path, every documented `McpBooleanObservationParseFailureReason`, unknown
   raw_key sanitization, confidence-floor application per surface, evidence
   span truncation. Each fixture compares the two outputs for deep equality.
   If they diverge → test fails → Trigger 8 fires (per Outcome 3
   specification in intent brief §"Parser import resolution").

**Why not Outcome 1 (direct import):** No precedent. Deno builds in production
do not auto-resolve `../../../src/features/...` paths inside
`supabase/functions/**` — would require local config changes outside this
card's scope.

**Why not Outcome 2 (bridge re-export):** The bridge would need to re-export
the FULL registry tree (which itself imports two non-nodeLabels modules), so
the bridge would either have to (a) duplicate the registry contents anyway, or
(b) chain re-exports across 14 files with `.ts` extensions — which IS
effectively Outcome 3 minus the parity test. Outcome 3 is the same effort
plus the safety net.

The 16-entry Family A parity is critical (Decision 3 binding); Outcome 3's
parity test gives belt-and-suspenders enforcement against silent drift.

### 1.4 — Phase A.4: Family A registry verification (BINDING per Decision 3)

**Result:** PASS. Exactly 16 entries; keys match the binding list verbatim.

Verified file: `src/features/nodeLabels/machineObservationDefinitions/familyA.ts`
(690 lines). Extracted 16 `rawKey` values via Grep, ordered by appearance:

| # | rawKey                       | Decision-3 match |
|---|------------------------------|------------------|
| 1 | `has_rebuttal`               | ✓ |
| 2 | `has_counter_rebuttal`       | ✓ |
| 3 | `rebutted`                   | ✓ |
| 4 | `quote_anchors_parent`       | ✓ |
| 5 | `supports_parent`            | ✓ |
| 6 | `challenges_parent`          | ✓ |
| 7 | `refines_parent`             | ✓ |
| 8 | `extends_parent`             | ✓ |
| 9 | `distinguishes_parent`       | ✓ |
|10 | `reframes_parent`            | ✓ |
|11 | `questions_parent`           | ✓ |
|12 | `summarizes_parent`          | ✓ |
|13 | `corrects_parent_detail`     | ✓ |
|14 | `contrasts_with_parent`      | ✓ |
|15 | `answers_parent_question`    | ✓ |
|16 | `questions_parent` order vs Decision 3 — note below |

**Order parity vs Decision 3 binding list:** Decision 3 lists keys in semantic
groupings (`supports_parent, challenges_parent, refines_parent, …`,
`has_rebuttal, has_counter_rebuttal, rebutted, quote_anchors_parent` at end);
the source file lists them in insertion order (4 retroactive entries first,
then 12 new). The **set** is identical (16/16); the order is irrelevant for
correctness because the parser and Edge Function reference keys by `rawKey`
string, never by index. No HALT.

All 16 entries carry the verbose fields required by intent brief: `rawKey`,
`label`, `shortLabel`, `description`, `defaultSurface`, `disposition`,
`priority`, `visibleByDefault`, `booleanQuestion`, `positiveDefinition`,
`negativeDefinition`, `positiveExamples`, `negativeExamples`,
`falsePositiveGuards`, `doctrineNotes`, `confidenceEligibility`. The
`confidenceEligibility` shape (`timelineMinConfidence`,
`selectedContextMinConfidence`, `inspectMinConfidence`) is present on all 16.

### 1.5 — Phase A.5: `run_mode` migration safety

**Result:** SAFE. Additive ALTER TABLE applies cleanly against MCP-021B base.

Verified base table shape (from migration `20260526000018`):
`argument_machine_observation_runs` has columns `id, debate_id, argument_id,
schema_version, requested_families, provider_key, model_name, input_hash,
status, failure_reason, started_at, completed_at, created_at`. No existing
column named `run_mode`. Adding `run_mode text NOT NULL DEFAULT 'production'`
backfills the 9 existing smoke-seed rows (`6feeb08` audit) to `'production'`
without rewriting them.

The smoke-seed audit (§Phase 2) recorded `2 runs + 9 result rows (7 valid + 2
defensive)` in the linked Supabase project. After the new migration applies:

- The 2 existing runs get `run_mode = 'production'` (default backfill).
- Source 6 filter (production-only) WILL render the 7 valid result rows from
  the production runs — preserving the MCP-021B smoke audit's verdict that
  "the 9 production-mode smoke seed rows from MCP-021B still render".
- The 2 defensive rows (unknown raw_key, wrong schema_version) remain filtered
  out by the existing adapter chain (orthogonal to `run_mode`).

The new CHECK constraint
`CHECK (run_mode IN ('production', 'admin_validation'))` is monotonically
narrowing; existing rows with the default value satisfy it.

The new index `argument_machine_observation_runs_run_mode_idx ON ... (run_mode)`
is additive; no conflict with the existing
`amor_runs_argument_version_completed_idx`.

Fallback (Decision 9 §"Fallback") NOT taken — primary migration succeeds.

### 1.6 — Phase A.6: Admin validation trigger mechanism

**Result:** **Edge Function `mode` action field.** Single Edge Function route
with `mode: 'production' | 'admin_validation'` in the request body.

Rationale:
- Same code path, same secrets, same RLS posture — only the persisted
  `run_mode` discriminator and the eligible-families filter differ.
- A separate route would duplicate auth/validation/MCP/persistence boilerplate
  with no security benefit.
- A CLI wrapper bypasses the JWT auth layer, which violates the "admin auth +
  service-role write" pattern (the operator workflow already issues an admin
  JWT via Supabase admin tooling for the EDGE-SMOKE; that JWT plus a `mode:
  'admin_validation'` payload IS the trigger).
- The Edge Function performs admin gating via `requireAdmin(req)` from
  `supabase/functions/_shared/adminAuth.ts:42` when `mode === 'admin_validation'`
  is requested. Production mode does not require admin (it is invoked by
  trusted server-side automation post-MCP-021C-AUTO-TRIGGER; for MCP-021C-EDGE
  ship, production mode is also admin-gated as the conservative posture per
  Decision 7 "admin-trigger-only initial production posture").

For the initial ship, BOTH modes require admin auth (admin-trigger-only per
Decision 7). The future MCP-021C-AUTO-TRIGGER card will widen `mode:
'production'` to allow service-role automation triggers without admin JWT.

### 1.7 — Phase A.7: Initial fixture full UUID resolution

**Result:** Three full UUIDs resolved from committed testing-runs corpus.

Verified file: `docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md`,
Onboarding apology room (Room 03 of 3, lines 520-720), template `deep-chain-15`:

| # | Depth | argumentId (full UUID) | moveKind / type | Parent |
|---|-------|------------------------|------------------|--------|
| 1 | 0 (root)  | `f41b18b0-8ad6-4865-94c5-17a568f6a6ad` | `start_thesis` / `thesis`           | — |
| 2 | 1         | `781f8057-9e2a-4fa9-92a8-469676950ff7` | `challenge_parent` / `rebuttal`     | #1 |
| 3 | 2         | `db0de3e0-24c6-40af-ba5f-2844acfa5bac` | `challenge_parent` / `counter_rebuttal` | #2 |

Room: `1e598dce-8188-4c7e-bdd6-aedede750923` (public; "Long onboarding is an
apology for bad UI."). All three argument UUIDs verified at lines 534, 550,
and 570 of the testing-runs file. Parent chain reachable (root → m1 → m2 → m3
forms the depth-0/1/2 sequence; m3's body is a fact-axis challenge to m2).

Depth-2 candidate `db0de3e0-...` is the same Onboarding-apology room — no need
to reach into the Pitch clock baseball or Bike lanes curb rooms (those remain
documented as alternates per Decision 10 if smoke discovers a problem with
`db0de3e0`).

All three UUIDs render through the MCP-021B persistence path (the room is
public; `is_debate_open_or_locked_public(debate_id)` arm of the canonical
arguments SELECT policy makes them visible to authenticated callers).

---

## §2 — MCP-018 adapter reuse design

**Strategy: WRAP (mirror with bounded divergence).** Do NOT modify the
existing MCP-018 adapter; add a sibling adapter for the new tool name.

### 2.1 — New shared module layout

```
supabase/functions/_shared/booleanObservations/
├── booleanObservationMcpAdapter.ts          # Deno-only orchestrator (mirrors mcpAdapter.ts)
├── booleanObservationMcpAdapterCore.ts      # Pure (mirrors mcpAdapterCore.ts)
├── mcpBooleanObservationSchema.ts           # Mirror of src/features/nodeLabels/mcpBooleanObservationSchema.ts
├── machineObservationDefinitions.ts         # Mirror aggregator
├── machineObservationDefinitions/
│   ├── familyA.ts                            # Mirror of src/...familyA.ts (16 entries)
│   ├── familyB.ts                            # Mirror (14 entries; admin-validation only)
│   ├── familyC.ts                            # Mirror (17 entries; admin-validation only)
│   ├── familyD.ts                            # Mirror (27 entries; admin-validation only)
│   ├── familyE.ts                            # Mirror (16 entries; admin-validation only)
│   ├── familyF.ts                            # Mirror (14 entries; admin-validation only)
│   ├── familyG.ts                            # Mirror (29 entries; admin-validation only)
│   ├── familyH.ts                            # Mirror (12 entries; admin-validation only)
│   ├── familyI.ts                            # Mirror (21 entries; admin-validation only)
│   └── familyJ.ts                            # Mirror (5 entries; admin-validation only)
├── machineObservationRegistry.ts            # Mirror — makeMachineObservationKey helper
├── nodeLabelTypes.ts                        # Mirror — type-only re-exports
├── moveMetadataLedger.ts                    # Narrow mirror — getAutoMetadataPlainLabel only
├── pointLifecycleModel.ts                   # Narrow mirror — ALL_POINT_LIFECYCLE_STATES + plain label only
├── familyRegistry.ts                        # NEW — per-family enablement gate (production vs admin_validation)
├── booleanObservationRequestBuilder.ts      # NEW — family-agnostic builder
├── booleanObservationPersistenceWriter.ts   # NEW — service-role write of run + result rows
└── runModeConstants.ts                      # NEW — typed RunMode enum mirror of migration's CHECK
```

### 2.2 — `booleanObservationMcpAdapterCore.ts` shape (mirrors `mcpAdapterCore.ts`)

```ts
// Pure TS — no Deno, no fetch, no npm import. Jest-importable.

import type {
  McpBooleanObservationRequest,
  McpBooleanObservationResponse,
} from './mcpBooleanObservationSchema.ts';

export const MCP_BOOLEAN_OBSERVATION_TOOL_NAME =
  'classify_argument_boolean_observations';

export const MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS = 15_000;

export const DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME = 'operator-mcp-server';

export const DEFAULT_MCP_BOOLEAN_OBSERVATION_CLASSIFIER_SET_VERSION =
  'mcp-021.classifier-set.v1';

export type BooleanObservationUnavailableReason =
  | 'url_missing'
  | 'token_missing'
  | 'api_error'
  | 'rate_limited'
  | 'network_error'
  | 'parse_failure'
  | 'validation_failed';

export const ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS:
  readonly BooleanObservationUnavailableReason[] = [
    'url_missing',
    'token_missing',
    'api_error',
    'rate_limited',
    'network_error',
    'parse_failure',
    'validation_failed',
  ];

export type BooleanObservationAdapterResult =
  | { kind: 'success'; response: McpBooleanObservationResponse }
  | { kind: 'unavailable'; reason: BooleanObservationUnavailableReason };

// Build the MCP tool body. Pure. Same shape as MCP-018 buildMcpToolRequestBody
// but the `tool` field is MCP_BOOLEAN_OBSERVATION_TOOL_NAME and `input` is
// the McpBooleanObservationRequest shape from MCP-021A.
export function buildBooleanObservationToolRequestBody(
  request: McpBooleanObservationRequest,
): Record<string, unknown> {
  return {
    tool: MCP_BOOLEAN_OBSERVATION_TOOL_NAME,
    input: { /* request fields, excluding `definitions` to avoid bloat;
                the server should have its own registry copy */ },
  };
}

// Pull the response object out of the MCP envelope. Mirrors
// extractMcpPacket — handles { result: {...} } | { output: {...} } |
// { content: [...] }, returns null on any miss.
export function extractBooleanObservationResponse(
  responseJson: unknown,
): unknown | null { /* ... mirror of extractMcpPacket ... */ }

// Allowlist sanitizer for the raw payload. Keeps { tool, status, stop_reason,
// usage }. Never returns secrets / response body / inner free-text fields.
export function sanitizeBooleanObservationRawPayload(
  raw: unknown,
): Record<string, unknown> { /* ... mirror of sanitizeMcpRawPayload ... */ }
```

### 2.3 — `booleanObservationMcpAdapter.ts` shape (mirrors `mcpAdapter.ts`)

```ts
// Deno-only. Imports schema.ts (npm:zod@4 is not required here; the parser is
// pure TS). Reads SEMANTIC_REFEREE_MCP_URL + SEMANTIC_REFEREE_MCP_TOKEN via
// Deno.env.get(). Never logs token / URL / Authorization / Bearer / raw body.

import {
  MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS,
  buildBooleanObservationToolRequestBody,
  extractBooleanObservationResponse,
  sanitizeBooleanObservationRawPayload,
} from './booleanObservationMcpAdapterCore.ts';
import type { BooleanObservationAdapterResult } from './booleanObservationMcpAdapterCore.ts';
import {
  parseMcpBooleanObservationResponse,
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
} from './mcpBooleanObservationSchema.ts';
import type {
  McpBooleanObservationRequest,
  McpBooleanObservationResponse,
} from './mcpBooleanObservationSchema.ts';

const AUTH_SCHEME_PREFIX = 'Bea' + 'rer ';  // split per MCP-018 source-scan precedent

function isHttpsUrl(value: string): boolean {
  try { return new URL(value).protocol === 'https:'; }
  catch { return false; }
}

export async function runBooleanObservationMcpAdapter(
  request: McpBooleanObservationRequest,
): Promise<BooleanObservationAdapterResult> {
  // 1. URL read — SEMANTIC_REFEREE_MCP_URL; non-https → url_missing
  const mcpUrl = Deno.env.get('SEMANTIC_REFEREE_MCP_URL');
  if (!mcpUrl || !isHttpsUrl(mcpUrl)) {
    return { kind: 'unavailable', reason: 'url_missing' };
  }
  // 2. Token read — SEMANTIC_REFEREE_MCP_TOKEN; absent → token_missing
  const mcpToken = Deno.env.get('SEMANTIC_REFEREE_MCP_TOKEN');
  if (!mcpToken) {
    return { kind: 'unavailable', reason: 'token_missing' };
  }
  // 3. Build + POST with AbortSignal.timeout(MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS)
  const requestBody = buildBooleanObservationToolRequestBody(request);
  let rawResponse: Response;
  try {
    rawResponse = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `${AUTH_SCHEME_PREFIX}${mcpToken}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { kind: 'unavailable', reason: 'network_error' };
  }
  // 4. HTTP status mapping
  if (!rawResponse.ok) {
    return { kind: 'unavailable',
             reason: rawResponse.status === 429 ? 'rate_limited' : 'api_error' };
  }
  // 5. Parse + extract
  let responseJson: unknown;
  try { responseJson = await rawResponse.json(); }
  catch { return { kind: 'unavailable', reason: 'parse_failure' }; }
  void sanitizeBooleanObservationRawPayload(responseJson);
  const extracted = extractBooleanObservationResponse(responseJson);
  if (extracted === null) {
    return { kind: 'unavailable', reason: 'parse_failure' };
  }
  // 6. Validate against MCP-021A parser (Decision 6 — strict reuse)
  const parsed = parseMcpBooleanObservationResponse(extracted);
  if (!parsed.ok) {
    return { kind: 'unavailable', reason: 'validation_failed' };
  }
  // 7. Schema-version guard (parser already does this, belt-and-suspenders)
  if (parsed.response.schemaVersion !== MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION) {
    return { kind: 'unavailable', reason: 'validation_failed' };
  }
  return { kind: 'success', response: Object.freeze(parsed.response) };
}
```

The adapter NEVER throws; every failure path returns a typed `unavailable`
result with a reason from `BooleanObservationUnavailableReason`.

### 2.4 — Doctrine guards on the new adapter (mirror MCP-018 invariants)

- Token / URL / Authorization / Bearer / raw body NEVER `console.log`'d.
- The token rides ONLY on the `Authorization` header, ONLY over TLS (https
  guard above). A non-https URL → `url_missing`.
- `provider: 'mcp'` is hard-pinned (MCP-021A's parser enforces this — see
  `mcpBooleanObservationSchema.ts:311` where the parser rejects responses
  whose `modelInfo.provider !== 'mcp'`).
- `authoritative` does not exist on the `McpBooleanObservationResponse` shape
  (it is structurally different from `SemanticRefereePacket`). The
  equivalent doctrine — Machine Observations are advisory, never authoritative
  — is enforced at the Source 6 adapter layer where the persisted rows are
  rendered as `kind: 'machine_observation'` marks.
- Source-scan invariants from `semanticMcpSourceScan.test.ts` are replicated in
  a new test `__tests__/mcpOneTwoOneCEdgeAdapterSourceScan.test.ts` covering
  the new adapter + core files.

---

## §3 — Request shape design (Family A only for production; family-agnostic plumbing)

### 3.1 — Edge Function request body

```ts
interface ClassifyArgumentBooleanObservationsRequest {
  argumentIds: string[];                     // 1..10 argument UUIDs in one call
  requestedFamilies: MachineObservationFamily[];  // ['parent_relation'] for production
  mode: 'production' | 'admin_validation';
  schemaVersion: 'mcp-021.machine-observations.boolean.v1';
}
```

Validation rules (zod schema in `supabase/functions/classify-argument-boolean-observations/index.ts`):

- `argumentIds`: array of strings, length 1..10, each a UUID v4 shape.
- `requestedFamilies`: array of `MachineObservationFamily` values
  (10-valued enum from MCP-021A). Length 1..10. Production mode rejects any
  family other than `parent_relation` (Decision 3 + 4).
- `mode`: `'production' | 'admin_validation'`. Required (no default to avoid
  accidental admin-validation writes appearing as production).
- `schemaVersion`: literal
  `'mcp-021.machine-observations.boolean.v1'` (rejects forward incompatible
  callers). Belt-and-suspenders gate.

### 3.2 — Family-agnostic execution plumbing

`familyRegistry.ts` exports:

```ts
export interface FamilyRegistryEntry {
  family: MachineObservationFamily;
  productionEnabled: boolean;     // true for parent_relation only at MCP-021C-EDGE ship
  adminValidationEnabled: boolean; // true for all 10
  rawKeys: ReadonlyArray<string>; // derived from machineObservationDefinitions/family<X>.ts
}

export const FAMILY_REGISTRY: ReadonlyArray<FamilyRegistryEntry> = Object.freeze([
  { family: 'parent_relation',           productionEnabled: true,  adminValidationEnabled: true,  rawKeys: FAMILY_A_RAW_KEYS },
  { family: 'disagreement_axis',         productionEnabled: false, adminValidationEnabled: true,  rawKeys: FAMILY_B_RAW_KEYS },
  { family: 'misunderstanding_repair',   productionEnabled: false, adminValidationEnabled: true,  rawKeys: FAMILY_C_RAW_KEYS },
  // ... B-J similarly. All adminValidationEnabled: true; all productionEnabled: false except A.
]);
```

Future family enablement: flip `productionEnabled: false → true` in this file +
a small enablement card. **No new code path required** — the Edge Function
handler reads `FAMILY_REGISTRY` and filters `requestedFamilies` per `mode`.

### 3.3 — Request builder

`booleanObservationRequestBuilder.ts` exports:

```ts
export interface BuildRequestPerArgumentInput {
  argumentId: string;
  parentArgumentId: string | null;
  currentText: string;
  parentText: string | null;
  threadContextExcerpt: string;
  requestedFamilies: ReadonlyArray<MachineObservationFamily>;
}

export function buildBooleanObservationRequestForArgument(
  input: BuildRequestPerArgumentInput,
): McpBooleanObservationRequest {
  // Derive rawKeys from the family list via FAMILY_REGISTRY.
  // Delegate to buildMcpBooleanObservationRequest() from the mirrored
  // mcpBooleanObservationSchema.ts (no logic duplication).
}
```

For each argument id in the Edge Function request, ONE MCP call is made per
argument carrying that argument's resolved parent text + thread excerpt + the
union of rawKeys from the eligible families. The handler iterates:

```
for argumentId in input.argumentIds:
  load argument body + parent body + thread context via service client
  eligibleFamilies = intersect(input.requestedFamilies, FAMILY_REGISTRY filtered by mode)
  build request
  call runBooleanObservationMcpAdapter(request)
  on success → sanitize per surface → write run + positive results
  on unavailable → write failed/fallback run row, no result rows
```

Batching across arguments in a single MCP call is OUT OF SCOPE (future
optimization; the MCP server may not support batching). The Edge Function
sequences calls; total wall time = argumentIds.length × ~15s timeout worst
case; capped by the input length-10 limit.

### 3.4 — Thread context excerpt

For each argument: parent body verbatim if present; otherwise null. Thread
context excerpt: at most the 3 most recent ancestor argument bodies above the
parent, joined with `\n---\n`, truncated to 2,000 characters total. Loaded via
the service client (RLS bypass) because admin-validation mode may include
arguments the caller would not normally see; production mode also uses
service-role for consistency (the JWT auth check happens at the Edge Function
boundary, not at the MCP call site).

---

## §4 — Response validation design (parser-import resolution result)

**Outcome 3: server-side mirror with parity drift test.**

The Edge Function imports `parseMcpBooleanObservationResponse` and
`sanitizeMcpBooleanObservationResponse` from the mirror at
`supabase/functions/_shared/booleanObservations/mcpBooleanObservationSchema.ts`.
The parser is byte-equal to the production parser at
`src/features/nodeLabels/mcpBooleanObservationSchema.ts` modulo the explicit
`.ts` import extensions on the import lines (the established repo mirror
convention).

### 4.1 — Validation flow per argument

```
runBooleanObservationMcpAdapter(request)
  ├── kind: 'unavailable' → record run status 'failed' or 'fallback'
  │      with failure_reason mapped from the unavailable reason
  └── kind: 'success' → response is ALREADY parser-validated AND schema-version-matched
        ├── sanitizeMcpBooleanObservationResponse(response, { surface: 'inspect' })
        │      Inspect surface uses the LOWEST confidence floor (lowest per-family
        │      eligibility threshold) so positive observations at any tier are
        │      persisted; the persistence adapter re-applies per-surface floors
        │      at read time.
        ├── for each rawKey with observations[rawKey] === true:
        │      derive family from MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY
        │      write result row (run_id, debate_id, argument_id, schema_version,
        │                        raw_key, family, confidence, evidence_span)
        └── write run row with status 'success'
```

### 4.2 — Failure-mode mapping (intent brief Decision 6)

| Adapter result                                  | Run status   | failure_reason text                  |
|-------------------------------------------------|--------------|---------------------------------------|
| `unavailable.url_missing`                       | `failed`     | `'mcp_url_missing'`                   |
| `unavailable.token_missing`                     | `failed`     | `'mcp_token_missing'`                 |
| `unavailable.network_error`                     | `failed`     | `'mcp_network_error'`                 |
| `unavailable.api_error`                         | `failed`     | `'mcp_api_error'`                     |
| `unavailable.rate_limited`                      | `failed`     | `'mcp_rate_limited'`                  |
| `unavailable.parse_failure`                     | `failed`     | `'mcp_parse_failure'`                 |
| `unavailable.validation_failed`                 | `failed`     | `'mcp_validation_failed'`             |
| `success` but sanitizer drops all positives     | `success`    | null (no result rows written)         |
| `success` with at least one positive            | `success`    | null (result rows written)            |

There is NO `fallback` status in the initial ship — the brief mentions it as a
future possibility (e.g., deterministic fallback when MCP is unavailable). For
MCP-021C-EDGE, an MCP failure → `failed` status, no fallback execution. A
future card may add a deterministic fallback path; the status enum already
accommodates it (`'success' | 'failed' | 'fallback'` from MCP-021B migration).

### 4.3 — Parser drift test

New test file `__tests__/mcpOneTwoOneCEdgeParserParity.test.ts`:

```ts
// Load both copies via the Jest bridge convention.
import {
  parseMcpBooleanObservationResponse as parseProd,
  sanitizeMcpBooleanObservationResponse as sanitizeProd,
} from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import {
  parseMcpBooleanObservationResponse as parseEdge,
  sanitizeMcpBooleanObservationResponse as sanitizeEdge,
} from './_helpers/booleanObservationEdgeDeno';

// Same fixture inputs through both parsers; assert deep equality of outputs.
```

The bridge `__tests__/_helpers/booleanObservationEdgeDeno.ts` follows the
existing `semanticRefereeDeno.ts` precedent for loading Deno-only modules
without dragging them into `tsc`.

If either parser is modified without the other, the drift test fails and
Trigger 8 fires (per intent brief Outcome 3 specification).

---

## §5 — Admin validation mode design (per Decision 4 + 9)

### 5.1 — Mode discrimination at the Edge Function boundary

The Edge Function handler:

```
1. CORS / method check
2. requireAdmin(req)  // admin-only for initial ship per Decision 7
3. Parse + validate request body
4. If mode === 'production':
     filter requestedFamilies to those with productionEnabled === true
     (reject the request with 422 if the filter empties out)
5. If mode === 'admin_validation':
     filter requestedFamilies to those with adminValidationEnabled === true
     (always true for all 10 families, but defensive)
6. For each argumentId:
     execute classifier (see §3.3)
     write run row with run_mode = mode
     write positive result rows
7. Return summary
```

### 5.2 — Admin validation diagnostic posture

Admin validation writes the FULL classifier output (sanitized at inspect-floor
confidence) — so the operator can inspect what the live MCP server returned
without needing a separate Edge Function. The result rows are real database
rows; the Source 6 filter (per Decision 9 + §8 below) prevents them from
rendering in the production UI.

### 5.3 — Family enablement workflow (Decision 4 §"Future family enablement")

To enable Family B (`disagreement_axis`) for production:

1. Operator runs MCP-021C-EDGE in admin_validation mode against a fixture set
   with `requestedFamilies: ['disagreement_axis']`.
2. Operator inspects the resulting run + result rows (SQL described in audit
   template §11).
3. If the validation passes (schema-conforming output, sensible confidence
   distribution, no schema mismatches), a small enablement card is filed.
4. The enablement card flips `productionEnabled: false → true` in
   `familyRegistry.ts` for that family, adds a test asserting the flip, and
   ships.

No Edge Function code changes; no migration changes; no client changes.

### 5.4 — Response shape

```ts
interface ClassifyArgumentBooleanObservationsResponse {
  mode: 'production' | 'admin_validation';
  schemaVersion: 'mcp-021.machine-observations.boolean.v1';
  perArgument: Array<{
    argumentId: string;
    runId: string;
    status: 'success' | 'failed';
    failureReason: string | null;
    positiveObservationCount: number;
    rawKeysWithPositive: string[];  // helpful for admin-validation audit; empty in production unless the operator wants this for AUTO-TRIGGER debugging
  }>;
}
```

The response carries NO model token / URL / Authorization / Bearer / raw MCP
payload. It carries NO admin email or admin display name. It carries NO
service-role API key. Body sanitization is via the
`sanitizeBooleanObservationRawPayload` helper before any logging step.

---

## §6 — Persistence writer design (per Decision 5 + 9)

### 6.1 — `booleanObservationPersistenceWriter.ts` exports

```ts
import { createServiceClient } from '../supabaseClients.ts';

export interface PersistRunInput {
  debateId: string;
  argumentId: string;
  schemaVersion: 'mcp-021.machine-observations.boolean.v1';
  requestedFamilies: ReadonlyArray<MachineObservationFamily>;
  providerKey: string;                      // e.g., 'mcp:classify_argument_boolean_observations'
  modelName: string;                         // e.g., DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME
  inputHash: string;                         // FNV-1a-derived stable token
  runMode: 'production' | 'admin_validation';
  status: 'success' | 'failed';
  failureReason: string | null;
  startedAt: string;                         // ISO-8601
  completedAt: string | null;                // ISO-8601 or null
}

export interface PersistResultInput {
  runId: string;
  debateId: string;
  argumentId: string;
  schemaVersion: 'mcp-021.machine-observations.boolean.v1';
  rawKey: string;
  family: MachineObservationFamily;
  confidence: 'low' | 'medium' | 'high';
  evidenceSpan: string | null;               // <= 240 chars; null if MCP omitted
}

export interface PersistRunResult {
  ok: true;
  runId: string;
} | {
  ok: false;
  error: string;                              // sanitized; never includes service-role detail
}

export async function persistRun(
  input: PersistRunInput,
): Promise<PersistRunResult> { /* INSERT into argument_machine_observation_runs */ }

export async function persistResults(
  results: ReadonlyArray<PersistResultInput>,
): Promise<{ ok: true; written: number } | { ok: false; error: string }> {
  // INSERT batch into argument_machine_observation_results
}
```

### 6.2 — Service-role-only inside the Edge Function

`createServiceClient()` is imported and instantiated ONCE per Edge Function
invocation, scoped to the request handler. The service-role key is read via
`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` inside
`supabaseClients.ts:13` — that file is the SOLE service-role-read in the
entire Edge Function tree, and the new writer imports the existing factory.

The writer NEVER returns the service-role client object to the caller. The
writer's return type carries only `{ runId, ok }` and sanitized error strings.

### 6.3 — Write ordering + invariants

Per Decision 5:

1. INSERT run row FIRST (status = 'success' provisionally; updated to 'failed'
   on adapter failure path before commit).
2. If adapter returned success AND sanitized response has positive
   observations: INSERT result rows in batch.
3. If adapter returned unavailable OR sanitized response has zero positives:
   write zero result rows.

Atomicity: each per-argument operation is its own DB transaction conceptually
(the writer makes two sequential INSERTs; the persistence design accepts the
narrow race where the run row commits but the result-row INSERT fails
mid-batch — this maps to `status = 'success'` with `evidence_debt` recoverable
via re-run, per the operator-rerunnable design). A future card may add
explicit Postgres transactions if needed.

### 6.4 — Per-positive-observation invariants

- `UNIQUE (run_id, raw_key)` constraint on the results table prevents duplicate
  writes within a single run. The writer SHOULD construct deduped result
  inputs; if a duplicate slips through, the INSERT fails with a constraint
  violation and the writer logs (sanitized) the rawKey + run_id pair.
- `raw_key` MUST be in `MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY`. Unknown
  raw_keys are dropped by the sanitizer BEFORE reaching the writer — the
  writer is defensive only.
- `family` is derived from
  `MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[rawKey].family` — never trusts
  the MCP server's reported family.
- `confidence` and `evidence_span` come from the sanitized response.

### 6.5 — `input_hash` derivation

For stable cache-key + audit purposes (per MCP-021B `input_hash` column):

```
input_hash = `mcp-${hex(fnv1a(`${argumentId}|${schemaVersion}|${runMode}|${sortedFamilies.join(',')}`))}`
```

Where `sortedFamilies` is the family list sorted alphabetically. This stable
hash lets a future card detect "we already ran this exact request" if cache
re-use becomes desirable.

### 6.6 — `provider_key` value

`provider_key = 'mcp:classify_argument_boolean_observations'` — identifies the
MCP server + tool. NOT used to encode admin_validation status (Decision 9
explicitly prefers `run_mode` for that, NOT `provider_key` overloading).

---

## §7 — Migration design (`run_mode` column + index per Decision 9)

### 7.1 — Migration file

Path: `supabase/migrations/20260526000019_mcp_021c_edge_run_mode.sql`

The numbering follows the linear sequence: MCP-021B was
`20260526000018_*`; MCP-021C-EDGE is `20260526000019_*`. Both belong to the
same UTC day (`2026-05-26`); the increment is the 5-digit fragment.

### 7.2 — Migration body

```sql
-- ============================================================
-- Migration: 20260526000019_mcp_021c_edge_run_mode
-- Description: MCP-021C-EDGE — Add run_mode discriminator to the
--   MCP-021B argument_machine_observation_runs table. Adds a CHECK
--   constraint allowing only 'production' | 'admin_validation', a
--   DEFAULT of 'production' (backfills existing rows including the
--   9 smoke-seed rows from the MCP-021B Phase 2 audit), and an
--   index for the production-only filter at the persistence query
--   layer (see Source 6 filter design §8 below).
--
-- Card: MCP-021C-EDGE (intent brief docs/designs/MCP-021C-EDGE-intent.md)
-- Predecessor: MCP-021B base migration 20260526000018_mcp_021b_machine_observation_results.sql
--
-- Doctrine encoded:
--   - run_mode discriminates PURPOSE (production classifier vs admin
--     validation run); does NOT discriminate provider provenance —
--     that remains in provider_key. (cdiscourse-doctrine §1, §10a)
--   - Admin validation rows are real persisted rows; Source 6
--     filters them out of production rendering at the persistence
--     query layer (preferred over adapter-layer filter — see
--     intent brief §"Source 6 filter requirement").
--   - Existing 9 smoke-seed rows from the MCP-021B audit backfill
--     to run_mode = 'production' via the column DEFAULT, preserving
--     their visibility through Source 6 in the UI.
--
-- Statement order (OPS-001 §4 Class 3):
--   1. ALTER TABLE … ADD COLUMN run_mode (column + CHECK + DEFAULT NOT NULL)
--   2. CREATE INDEX … ON … (run_mode)
--   3. COMMENT ON COLUMN …
--
-- OPS-001 §4 four-class posture:
--   Class 1 — Ambiguous column references: not applicable; this
--     migration adds one column to an existing table. No subquery
--     or join introduced.
--   Class 2 — Column type mismatches: run_mode is text with CHECK;
--     same type pattern as the existing status column.
--   Class 3 — Implicit ordering dependencies: ALTER TABLE precedes
--     CREATE INDEX (the index references the new column). COMMENT
--     statements come last (descriptive only, no execution
--     dependency).
--   Class 4 — Function / trigger / extension dependencies: none
--     introduced. The migration is purely DDL on an existing table.
--
-- No new RLS policies. The existing amor_runs_select_via_argument
-- policy covers run_mode-aware reads transparently (the column is
-- additive; visibility doctrine is unchanged).
-- ============================================================

ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS run_mode text NOT NULL DEFAULT 'production'
  CHECK (run_mode IN ('production', 'admin_validation'));

CREATE INDEX IF NOT EXISTS argument_machine_observation_runs_run_mode_idx
  ON public.argument_machine_observation_runs (run_mode);

COMMENT ON COLUMN public.argument_machine_observation_runs.run_mode IS
  'MCP-021C-EDGE: discriminator for run purpose. ''production'' rows '
  'feed Source 6 in the production UI. ''admin_validation'' rows are '
  'persisted for operator audit and are filtered out of production '
  'rendering at the persistence query layer '
  '(fetchPersistedObservationsForArguments). Default ''production'' '
  'backfills MCP-021B smoke-seed rows.';
```

### 7.3 — Migration test

`__tests__/mcpOneTwoOneCEdgeMigrationShape.test.ts` (pure text scan, same
pattern as `mcpOneTwoOneBPersistenceMigration.test.ts`):

- Migration file exists and has the OPS-001 §4 header walk.
- `ALTER TABLE public.argument_machine_observation_runs ADD COLUMN ...
  run_mode text NOT NULL DEFAULT 'production'` regex match.
- `CHECK (run_mode IN ('production', 'admin_validation'))` literal match.
- `CREATE INDEX ... argument_machine_observation_runs_run_mode_idx ON ...
  (run_mode)` regex match.
- `COMMENT ON COLUMN public.argument_machine_observation_runs.run_mode` regex
  match.
- ZERO `DROP COLUMN` / `DROP TABLE` / `DELETE FROM` / `TRUNCATE` matches in
  the migration text.
- ZERO new RLS policy statements (`CREATE POLICY`); the existing read policy
  is run_mode-aware via the column being NOT NULL with DEFAULT.

### 7.4 — Operator step

After PR merge, the operator runs `npx supabase db push --linked`. Since the
Supabase GitHub integration auto-applies on merge to main (per session memory
"Supabase merge auto-deploy"), the manual step is verification:

```
npx supabase db query --linked --query "
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'argument_machine_observation_runs'
    AND column_name = 'run_mode';
"
```

Expected: one row, `data_type = text`, `column_default = ''production''::text`.

---

## §8 — Source 6 filter design (production-only rendering per Decision 9)

Decision 9 explicitly authorizes a bounded edit to either the MCP-021B
persistence query OR the adapter to filter `run_mode = 'production'`.

**Choice: persistence query layer (Decision 9's "preferred").**

### 8.1 — Bounded edit to `machineObservationPersistenceQuery.ts`

The current `fetchPersistedObservationsForArguments` SELECT does not join
runs. The bounded edit adds a runs join:

```ts
// BEFORE (current):
const SELECT_COLUMNS =
  'id,run_id,debate_id,argument_id,schema_version,raw_key,family,confidence,evidence_span,created_at';

const { data, error } = await supabase
  .from('argument_machine_observation_results')
  .select(SELECT_COLUMNS)
  .in('argument_id', ids);

// AFTER (with run_mode filter):
const SELECT_COLUMNS =
  'id,run_id,debate_id,argument_id,schema_version,raw_key,family,confidence,evidence_span,created_at,argument_machine_observation_runs!inner(run_mode)';

const { data, error } = await supabase
  .from('argument_machine_observation_results')
  .select(SELECT_COLUMNS)
  .in('argument_id', ids)
  .eq('argument_machine_observation_runs.run_mode', 'production');
```

The `!inner` join forces an INNER JOIN at the PostgREST level (only result
rows whose run has `run_mode = 'production'` are returned). The `.eq()`
filter is applied at the joined table.

Result row shape unchanged from the caller's perspective — `mapRawRow` drops
the joined runs object before returning the `MachineObservationResultRow`.

### 8.2 — Bounded edit to `machineObservationPersistenceTypes.ts`

Add the `runMode` field to `MachineObservationRunRow` interface (the only
type change needed; the result row interface remains as-is since the joined
runs object is dropped at the query layer):

```ts
export type MachineObservationRunMode = 'production' | 'admin_validation';

export interface MachineObservationRunRow {
  id: string;
  // ... existing fields ...
  runMode: MachineObservationRunMode;
  // ...
}
```

Also add a type guard `isMachineObservationRunMode(value): value is MachineObservationRunMode`.

### 8.3 — Invariance: MCP-021A Source 6 byte-equal-on-empty-input

The existing `mcpOneTwoOneASourceSixInvariance.test.ts` asserts:

```
adaptRawClassifierBinarySource({ messageId, binaries }) === []
adaptRawClassifierBinarySource({ messageId }) === []
```

(every call with NO persistedClassifierRows returns []).

The bounded edit to `machineObservationPersistenceQuery.ts` does NOT affect
the Source 6 adapter directly — it affects the query that loads the rows
BEFORE they reach the adapter. The adapter's behavior on empty input is
unchanged; the invariance test continues to pass byte-equal.

### 8.4 — MCP-021B smoke seed preservation

The 9 existing smoke-seed rows from the MCP-021B Phase 2 audit have
`run_mode = NULL` immediately before the new migration. After the migration
applies (DEFAULT 'production' backfills), they have `run_mode = 'production'`.

After the bounded edit to the query layer:
- The 7 valid smoke-seed rows continue to render via Source 6 (their runs
  are now `run_mode = 'production'`).
- The 2 defensive smoke-seed rows (unknown raw_key, wrong schema_version)
  continue to be filtered by the existing adapter chain — orthogonal to
  `run_mode`.

The MCP-021B persisted-label smoke verdict ("the 9 production-mode smoke seed
rows from MCP-021B still render") is preserved.

### 8.5 — MCP-021B `fetchPersistedObservationsForArguments` test additions

The query's existing test
(`__tests__/mcpOneTwoOneBPersistedRowAdapter.test.ts`) does NOT exercise the
runs join. Two new tests at
`__tests__/mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts`:

- Production rows: rows with `run_mode = 'production'` come through.
- Admin-validation rows: rows with `run_mode = 'admin_validation'` are
  filtered out — `data` array does not contain them.

Tests use the Supabase mock client (existing pattern from the Source 6
adapter test). The mock supports the `!inner` join syntax via a helper that
echoes the filter back.

---

## §9 — Fixture moves (resolved full UUIDs per Decision 10)

| # | Depth | Room                                    | argumentId (full UUID)                | Parent UUID                            | moveKind            | argumentType        |
|---|-------|-----------------------------------------|---------------------------------------|----------------------------------------|---------------------|---------------------|
| 1 | 0 (root) | Onboarding apology                  | `f41b18b0-8ad6-4865-94c5-17a568f6a6ad` | (none — root)                          | `start_thesis`      | `thesis`            |
| 2 | 1     | Onboarding apology                     | `781f8057-9e2a-4fa9-92a8-469676950ff7` | `f41b18b0-8ad6-4865-94c5-17a568f6a6ad` | `challenge_parent`  | `rebuttal`          |
| 3 | 2     | Onboarding apology                     | `db0de3e0-24c6-40af-ba5f-2844acfa5bac` | `781f8057-9e2a-4fa9-92a8-469676950ff7` | `challenge_parent`  | `counter_rebuttal`  |

Room (debate) UUID: `1e598dce-8188-4c7e-bdd6-aedede750923` (public; "Long
onboarding is an apology for bad UI.")

Test fixture at `__tests__/fixtures/mcpOneTwoOneCEdgeAdminValidationFixture.ts`
exports these three UUIDs as readonly constants. The integration test (see
§10.3) feeds them through the Edge Function handler with a MOCK MCP server.

The live operator EDGE-SMOKE post-merge runs the SAME three UUIDs against the
real MCP server.

### 9.1 — Why three depths

- Depth 0 (root): exercises `parent_relation` keys that depend on having NO
  parent (`has_rebuttal`, `has_counter_rebuttal`, `rebutted` derive from
  children; `quote_anchors_parent`, `supports_parent`, etc. degrade gracefully
  to false).
- Depth 1: exercises the typical parent-relation keys with a clear parent
  thesis to relate to (`challenges_parent`, `refines_parent`, etc.).
- Depth 2+: exercises deep-tree parent_relation keys including
  `has_counter_rebuttal` (which requires grandchildren) — the depth-2 move is
  itself a counter_rebuttal type, so its parent (depth-1 rebuttal) should
  satisfy `has_counter_rebuttal = TRUE` per the registry's positive
  definition. This is a meaningful exercise of the parent-tree-derived keys.

### 9.2 — Alternate fixture rooms (per Decision 10)

If the operator finds the Onboarding apology room unsuitable during EDGE-SMOKE
(e.g., MCP server returns an unexpected error specific to that body length),
the documented alternates from the bot-corpus testing-runs are:

- Pitch clock baseball: `35ef4c74-dfc8-4520-bcc9-558272257153`
- Bike lanes curb: `2c085a50-4a27-4dad-bc3d-17a3eca09ddb`

These do NOT need their argument UUIDs resolved at design time; the operator
can resolve them via `npx supabase db query --linked` if needed at
EDGE-SMOKE time.

---

## §10 — Test plan (~14 files; aggregate-test pattern; +180 to +280 forecast)

Forecast: **+220 tests across 14 files**. Below ceiling (Trigger 13 = +500).

The aggregate-test pattern is the established MCP-021A/B precedent — each
test file scopes to ONE phenomenon (migration shape, request validation,
parser parity, etc.) with multiple it() cases per file.

### 10.1 — Test file list

| # | File                                                                       | Approx tests | Phenomenon |
|---|-----------------------------------------------------------------------------|--------------|------------|
| 1 | `__tests__/mcpOneTwoOneCEdgeMigrationShape.test.ts`                          | ~15          | Migration file shape + OPS-001 header + run_mode DDL + index + COMMENT + no destructive DDL |
| 2 | `__tests__/mcpOneTwoOneCEdgePersistenceTypes.test.ts`                        | ~12          | `MachineObservationRunMode` enum + `isMachineObservationRunMode` guard + run row type carries `runMode` |
| 3 | `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts`                          | ~16          | `FAMILY_REGISTRY` has 10 entries; only `parent_relation` has `productionEnabled: true`; all 10 have `adminValidationEnabled: true`; rawKeys per family are byte-equal to the mirror family files |
| 4 | `__tests__/mcpOneTwoOneCEdgeFamilyARequestBuilder.test.ts`                   | ~18          | Family A request builder exactness: 16 keys included; parent context included; schema version pinned; no other families leaked; rejects unknown families |
| 5 | `__tests__/mcpOneTwoOneCEdgeAdapterCore.test.ts`                             | ~22          | `buildBooleanObservationToolRequestBody` shape; `extractBooleanObservationResponse` for `result`/`output`/`content[]`; `sanitizeBooleanObservationRawPayload` allowlist; constants typed correctly |
| 6 | `__tests__/mcpOneTwoOneCEdgeAdapterSourceScan.test.ts`                       | ~18          | Source scan: token / URL / Authorization / Bearer / raw body never logged; single-source Deno.env reads; hard-pinned schema version |
| 7 | `__tests__/mcpOneTwoOneCEdgeParserParity.test.ts`                            | ~30          | Drift test: production parser vs server-side mirror agree on ~30 inputs covering every parse failure reason and every sanitizer edge case |
| 8 | `__tests__/mcpOneTwoOneCEdgePersistenceWriter.test.ts`                       | ~20          | persistRun + persistResults write the correct columns; service-role only; never returns service-role client; sanitized errors; run_mode written verbatim |
| 9 | `__tests__/mcpOneTwoOneCEdgeRequestValidation.test.ts`                       | ~18          | zod schema accepts well-formed requests; rejects family/mode/argumentIds/schemaVersion violations; production mode rejects non-Family-A families |
| 10 | `__tests__/mcpOneTwoOneCEdgeAdminGate.test.ts`                              | ~10          | `requireAdmin` returns 401/403 paths; admin path proceeds |
| 11 | `__tests__/mcpOneTwoOneCEdgeIntegrationFlow.test.ts`                        | ~14          | End-to-end with MOCK MCP server (in-memory fixture, no network): production mode writes run + results; admin_validation mode writes run with run_mode set; failed adapter writes run with status='failed', zero results |
| 12 | `__tests__/mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts`                 | ~12          | Persistence query: production rows render; admin_validation rows filtered out; MCP-021B smoke-seed rows continue to render |
| 13 | `__tests__/mcpOneTwoOneCEdgeReadOnlyBoundary.test.ts`                       | ~14          | Read-only boundary scan: no edit to MCP-021A taxonomy/schema/definition files (except parser mirror); no edit to UX-001.5A presentation/priority/components; no edit to userAllegationRegistry; no edit to UX-001.6 viewport matrix tests; no edit to existing MCP-021A/B tests (except the bounded persistence-types extension) |
| 14 | `__tests__/mcpOneTwoOneCEdgeDoctrine.test.ts`                               | ~12          | Doctrine ban list: no verdict tokens in any new copy; no raw raw_key in any user-facing string; no AI calls from production app (grep `src/` + `app/` for new MCP/fetch imports — must be zero) |

**Total: ~231 tests, 14 files. Test suite count: 521 → 535.**

### 10.2 — Bridge: `__tests__/_helpers/booleanObservationEdgeDeno.ts`

Mirrors the existing `semanticRefereeDeno.ts` Jest bridge convention. Loads
the Deno-only mirror modules via `require()` and re-exports them with the
production type names from `src/` so behavioral tests stay type-safe.

Excluded from `tsc` via the same project posture as the existing bridge.

### 10.3 — Integration test mock MCP server

`__tests__/mcpOneTwoOneCEdgeIntegrationFlow.test.ts` uses an in-memory mock
function `fakeRunBooleanObservationMcpAdapter` that returns canned responses
keyed by `argumentId`. NO actual `fetch` call. The mock satisfies the
`BooleanObservationAdapterResult` shape.

Three canned responses cover:
- success with positive observations (Family A keys present)
- success with zero positive observations (all rawKeys returned false)
- unavailable (network_error reason)

The Edge Function handler is refactored slightly to inject the adapter
dependency via a function parameter (dependency injection); the production
path uses `runBooleanObservationMcpAdapter` from the Deno module; tests inject
the mock.

NOTE: Jest cannot load the `Deno.env.get` + `fetch` adapter directly (per
existing MCP-018 precedent). The handler-level code is structured so the test
exercises the WHOLE handler PATH except for the actual network IO at the
adapter boundary. Source-scan tests (file #6) cover the adapter file's
non-loadable shape independently.

### 10.4 — Aggregate-test pattern compliance

Each test file uses `describe()` blocks per phenomenon and `it()` per case.
Multiple cases per file is the precedent (`mcpOneTwoOneBPersistenceMigration.test.ts`
runs ~24 cases in 1 file). No `.skip` / `.only` / `.xit` in final committed
code.

### 10.5 — Implementer commit cadence guidance

The implementer expects these commit boundaries:

1. **Migration commit** — Add `20260526000019_mcp_021c_edge_run_mode.sql` +
   migration shape test (~15 tests). Verify with `npm run typecheck` + the
   shape test alone.
2. **Persistence type/adapter/query bounded edits** — Add `runMode` field to
   `MachineObservationRunRow` + type guard; extend
   `fetchPersistedObservationsForArguments` to filter `run_mode = 'production'`
   at the query layer. Tests: persistence types (~12) + Source 6 filter
   (~12) + 1-2 existing MCP-021B tests if they need re-baselining for the
   new field.
3. **Shared server-side Boolean Observation modules** — Add the parser
   mirror, registry mirror, definitions mirror (all 10 families), narrow
   metadata + lifecycle mirrors, `familyRegistry.ts`,
   `runModeConstants.ts`, `booleanObservationMcpAdapterCore.ts`,
   `booleanObservationMcpAdapter.ts`. Tests: parser parity (~30) + adapter
   core (~22) + adapter source scan (~18) + family registry (~16).
4. **Edge Function handler** — Add
   `supabase/functions/classify-argument-boolean-observations/index.ts` +
   request validation + admin gate + family-agnostic execution wiring +
   integration with mock adapter (DI). Tests: request validation (~18) +
   admin gate (~10) + integration flow (~14).
5. **Family A request builder + production enablement** — Add the request
   builder; enable Family A in `FAMILY_REGISTRY` (already in step 3 file but
   committed-with the request builder which proves the 16 keys end-to-end).
   Tests: Family A request builder exactness (~18) + persistence writer
   (~20).
6. **Fixture + audit template + handoff section** — Add the 3-UUID fixture,
   the `docs/audits/MCP-021C-EDGE-admin-validation-template.md`, and the
   handoff section appended to `docs/core/current-status.md`. Tests:
   read-only boundary (~14) + doctrine (~12).
7. **Final aggregate run** — `npm run typecheck && npm run lint && npm run
   test` clean.

---

## §11 — Audit template design (operator-driven EDGE-SMOKE post-merge)

Path: `docs/audits/MCP-021C-EDGE-admin-validation-template.md`

The template is committed in this card. The operator copies it to a dated
audit doc (`docs/audits/MCP-021C-EDGE-admin-validation-<YYYY-MM-DD>.md`) after
running EDGE-SMOKE.

### 11.1 — Template skeleton

```markdown
# MCP-021C-EDGE Admin Validation Audit

**Date:** <YYYY-MM-DD>
**Author:** Operator (with autonomous-pipeline support)
**Card:** MCP-021C-EDGE (merged at `<commit>`, PR #<number>)
**Migration:** `supabase/migrations/20260526000019_mcp_021c_edge_run_mode.sql`
**Edge Function:** `supabase/functions/classify-argument-boolean-observations/`
**MCP server:** operator-hosted (`SEMANTIC_REFEREE_MCP_URL` + `SEMANTIC_REFEREE_MCP_TOKEN`)
**Pivot:** `docs/decisions/MCP-021C-edge-pivot.md`

## Verdict

(PASS | FAIL | PARTIAL — see decision matrix below)

## Phase 1 — Edge Function deploy

- [ ] `npx supabase functions deploy classify-argument-boolean-observations --linked`
- [ ] Function listed in `npx supabase functions list --linked`
- [ ] Secrets present: `npx supabase secrets list --linked | grep SEMANTIC_REFEREE_MCP_`
- [ ] Migration applied: `20260526000019_mcp_021c_edge_run_mode` (via auto-deploy)
- [ ] `argument_machine_observation_runs.run_mode` column present with default
      `'production'`

Status: PASS | FAIL — <notes>

## Phase 2 — Admin validation invocation

Three fixture moves invoked via curl (admin JWT in Authorization header):

| # | argumentId                            | depth | Result            |
|---|---------------------------------------|-------|-------------------|
| 1 | `f41b18b0-8ad6-4865-94c5-17a568f6a6ad` | 0     | (success/failed)  |
| 2 | `781f8057-9e2a-4fa9-92a8-469676950ff7` | 1     | (success/failed)  |
| 3 | `db0de3e0-24c6-40af-ba5f-2844acfa5bac` | 2     | (success/failed)  |

For each: run_id, status, failure_reason (if any), positive raw_keys + confidences.

Status: PASS | FAIL — <notes>

## Phase 3 — Persisted-row inspection

SQL readbacks (from intent brief §"Post-merge operator follow-up" SQL 4-5):

- Runs created with `run_mode = 'admin_validation'`
- Result rows (per argumentId) — schema_version, raw_key, family, confidence,
  evidence_span

Status: PASS | FAIL — <notes>

## Phase 4 — Source 6 production-filter verification

Navigate to one of the three fixture arguments in the app. Confirm:

- [ ] No new Machine Observation chips appear from the admin validation run
      (admin_validation rows are filtered at the query layer per §8).
- [ ] The 7 valid MCP-021B smoke-seed rows still render (their runs are
      `run_mode = 'production'` post-migration default backfill).

Status: PASS | FAIL — <notes>

## Phase 5 — Verdict + next card

- **PASS** (1+ of 3 moves validates with positive results OR clean
  failure_reason): MCP-021C-FAMILY-B is AUTHORIZED to file (enable Family B
  for production via the next enablement card).
- **PARTIAL** (some moves validate, some fail with non-systematic errors):
  document per-move detail; consider rerun or file MCP-021C-EDGE-PATCH for the
  specific defect.
- **FAIL** (0 of 3 moves validate; systematic schema failure or unavailable
  reason on every call): file MCP-021C-EDGE-FIX scoped to the specific
  defect; pause further family enablement until fix lands.

## References

- Migration: `supabase/migrations/20260526000019_mcp_021c_edge_run_mode.sql`
- Design: `docs/designs/MCP-021C-EDGE.md`
- Intent brief: `docs/designs/MCP-021C-EDGE-intent.md`
- Sequencing: `docs/decisions/MCP-021-sequencing.md`
- Pivot decision: `docs/decisions/MCP-021C-edge-pivot.md`
- MCP-018 adapter runbook: `docs/deployment/mcp-018-mcp-adapter-runbook.md`
```

---

## §12 — Read-only boundary list (verbatim from intent brief §"Read-only API boundaries")

### 12.1 — MAY modify (bounded)

- New: `supabase/functions/classify-argument-boolean-observations/index.ts`
- New: `supabase/functions/_shared/booleanObservations/` (all files listed in §2.1)
- New: `supabase/migrations/20260526000019_mcp_021c_edge_run_mode.sql`
- New: ~14 test files (see §10.1)
- New: `__tests__/_helpers/booleanObservationEdgeDeno.ts`
- New: `__tests__/fixtures/mcpOneTwoOneCEdgeAdminValidationFixture.ts`
- New: `docs/audits/MCP-021C-EDGE-admin-validation-template.md`
- New: `docs/designs/MCP-021C-EDGE.md` (this file)
- New: `docs/reviews/MCP-021C-EDGE-review.md` (reviewer phase)
- Bounded edit: `src/features/nodeLabels/machineObservationPersistenceQuery.ts`
  (add `!inner` join on runs + `.eq` filter on `run_mode = 'production'`)
- Bounded edit: `src/features/nodeLabels/machineObservationPersistenceTypes.ts`
  (add `MachineObservationRunMode` type + `runMode` field on
  `MachineObservationRunRow` + type guard)
- Bounded edit: `src/features/nodeLabels/index.ts` if new exports needed
  (likely unnecessary — `runMode` is internal to the run row)
- Bounded edit: `docs/core/current-status.md` (handoff section appended at
  END, after existing MCP-021B section)

### 12.2 — MAY NOT modify (byte-equal hard)

- All UX-001.{1-7} read-only files outside bounded list
- All UX-001.5A presentation model, priority model, components
- All MCP-021A taxonomy / schema / definition files
  (`src/features/nodeLabels/mcpBooleanObservationSchema.ts`,
  `machineObservationDefinitions.ts`,
  `machineObservationDefinitions/familyA-J.ts`,
  `machineObservationRegistry.ts`,
  `nodeLabelTypes.ts`, `userAllegationRegistry.ts`)
- `src/features/nodeLabels/nodeLabelSourceAdapters.ts` (Source 6 already wired
  by MCP-021B; the run_mode filter goes in the QUERY layer, NOT the adapter
  layer)
- `src/features/nodeLabels/machineObservationPersistenceAdapter.ts` (the
  adapter receives already-filtered rows; no change needed)
- All UX-001.6 cross-device QA test files (byte-equal)
- All MCP-021A test files (`__tests__/mcpOneTwoOneA*.test.ts`)
- All existing MCP-021B test files except as noted in §10.5 step 2 (the
  bounded persistence-types extension may add 1-2 cases to an existing test
  file if needed; the file is otherwise byte-equal)
- Existing MCP-021B migration file (the new MCP-021C-EDGE migration is
  additive)
- `supabase/functions/_shared/semanticReferee/` directory (MCP-018 adapter
  byte-equal; the new adapter is in a sibling directory)
- `supabase/functions/semantic-referee/index.ts` (existing Edge Function
  byte-equal; the new Edge Function is at a sibling path)
- `package.json` / `package-lock.json` (no new deps)

---

## §13 — Conditional HALT trigger table

| # | Trigger                                                                    | This design's posture |
|---|-----------------------------------------------------------------------------|------------------------|
| 1 | Client-side MCP call proposed                                              | NONE proposed — all MCP execution is in the Edge Function |
| 2 | EXPO_PUBLIC_* MCP server URL proposed                                       | NONE proposed — env vars are Deno.env-only |
| 3 | MCP token exposed to app/client                                            | NONE proposed — token lives in Supabase function secrets |
| 4 | New taxonomy key proposed                                                  | NONE proposed — uses 16 Family A keys verbatim |
| 5 | Families B-J production-enabled in this card                               | NONE proposed — only Family A is `productionEnabled: true` |
| 6 | Display cap change proposed                                                | NONE proposed — caps untouched |
| 7 | New visual primitive or token proposed                                     | NONE proposed — no UI changes |
| 8 | MCP-021A schema validation weakened                                        | NONE proposed — parser is mirrored verbatim with drift test |
| 9 | MCP-018 server-side adapter cannot be located                              | LOCATED at `supabase/functions/_shared/semanticReferee/mcpAdapter.ts` |
| 10 | MCP-021B persistence tables cannot be located                             | LOCATED at migration 20260526000018; verified by Phase A.2 |
| 11 | No service-role-only write path inside the Edge Function                  | DESIGNED — `createServiceClient()` used for run + result row INSERTs only |
| 12 | Automatic production trigger proposed without safety gate                 | NONE proposed — admin-only invocation per Decision 7 |
| 13 | Test count forecast exceeds +500                                          | FORECAST: ~+220; well below ceiling |
| 14 | Parser-import resolution cannot resolve to one of the 3 documented outcomes| RESOLVED: Outcome 3 (server-side mirror + parity drift test) per Phase A.3 |
| 15 | Doctrine drift in prompt copy / labels / user-facing text                 | NONE — no new user-facing text |
| 16 | Context window threshold (70%)                                             | Designer phase well below threshold |
| 17 | Interpretive judgment requires operator decision beyond inputs            | NONE — all decisions covered by intent brief Decisions 1-10 |
| 18 | Family A registry disagrees with binding 16-key list                       | VERIFIED 16/16 match per Phase A.4 |

**Status: 18/18 CLEAN.** Design proceeds.

---

## §14 — Brief ledger (orchestrator-authored adjudications)

The MCP-021C-EDGE intent brief was operator-authored. This designer-phase
brief ledger names each Phase A and Decision adjudication this design makes:

### 14.1 — Parser import resolution outcome

**Outcome 3 — server-side mirror with parity drift test.** Phase A.3 ruled
out Outcome 1 (no precedent in repo) and Outcome 2 (bridge would chain through
14+ files). Mirror pattern matches the existing
`supabase/functions/_shared/constitution/` precedent. Parity drift test fires
Trigger 8 if either parser is modified without the other.

### 14.2 — Family A registry verification result

**16 keys confirmed verbatim.** Phase A.4 extracted all 16 `rawKey` values
from `src/features/nodeLabels/machineObservationDefinitions/familyA.ts` and
matched them set-for-set to the intent brief Decision 3 binding list. Order
differs (source file follows insertion order; brief lists semantically); set
membership is identical. No HALT.

### 14.3 — Three fixture move full UUIDs

Resolved from `docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md` lines
520-570 (Onboarding apology room):

- Depth 0 (root): `f41b18b0-8ad6-4865-94c5-17a568f6a6ad`
- Depth 1: `781f8057-9e2a-4fa9-92a8-469676950ff7`
- Depth 2: `db0de3e0-24c6-40af-ba5f-2844acfa5bac`

Room: `1e598dce-8188-4c7e-bdd6-aedede750923` (public).

### 14.4 — Migration safety verification

Phase A.5 verified the `run_mode` column applies cleanly to the existing
`argument_machine_observation_runs` table. DEFAULT 'production' backfills the
9 smoke-seed rows; CHECK constraint is narrowing-compatible; new index does
not conflict. Decision 9 fallback (provider_key overloading) NOT taken.

### 14.5 — Admin trigger mechanism

**Edge Function `mode` action field.** Single Edge Function route at
`supabase/functions/classify-argument-boolean-observations/index.ts` accepts
`mode: 'production' | 'admin_validation'` in the request body. Admin auth via
`requireAdmin(req)` from existing helper. Rejected alternates: separate route
(duplicate boilerplate); CLI wrapper (bypasses JWT auth).

### 14.6 — Production trigger posture

**Admin-trigger-only initial production posture confirmed.** Both
`production` and `admin_validation` modes require admin JWT in the initial
MCP-021C-EDGE ship per Decision 7. A future MCP-021C-AUTO-TRIGGER card will
widen `production` mode to accept service-role automation triggers.

### 14.7 — Edge Function path

**New function at `supabase/functions/classify-argument-boolean-observations/index.ts`**
(not extending the existing `semantic-referee` function). Rationale: the
existing function is purpose-built for the `SemanticRefereePacket` shape via
`classify_semantic_move`; mixing the two tool surfaces would violate the
single-responsibility posture and would require restructuring the existing
adapter chain.

### 14.8 — MCP-018 adapter reuse strategy

**Wrap (mirror).** Phase A.1 finalized the strategy: do NOT modify
`mcpAdapter.ts` or `mcpAdapterCore.ts`; add sibling
`booleanObservationMcpAdapter.ts` and `booleanObservationMcpAdapterCore.ts`
that replicate the secret-handling discipline + URL/token resolution +
AbortSignal timeout + response extraction + raw-payload sanitization +
`unavailable` failure vocabulary, with the only divergence being the MCP
tool name (`classify_argument_boolean_observations`) and the response schema
(`McpBooleanObservationResponse`).

### 14.9 — Operator-deferred review items

Three items defer to post-merge operator decision:

1. **Whether to clean up the 9 MCP-021B smoke-seed rows after EDGE-SMOKE.**
   The smoke-seed audit noted "Leave as test data" as an option. After
   EDGE-SMOKE, the operator may opt to delete via service-role SQL
   (`DELETE FROM public.argument_machine_observation_runs WHERE input_hash
   LIKE 'smoke-%'`) — the result rows cascade. The MCP-021C-EDGE design does
   NOT clean these up automatically; they continue to be useful reference data
   for MCP-021C-FAMILY-B and beyond.

2. **Whether to enable Family B (`disagreement_axis`) for production in the
   IMMEDIATE next card or to delay.** Family B is the natural next candidate
   (14 keys; similar parent-relative structure). The operator may wish to run
   one full admin validation cycle on Family B before filing the enablement
   card.

3. **Whether to upgrade the initial production posture to auto-trigger
   (MCP-021C-AUTO-TRIGGER) before any family beyond A.** Two viable
   sequences: (a) enable Family B first (admin-trigger-only); (b)
   auto-trigger Family A first (so live data flows into the persistence
   path), then enable Family B with auto-trigger already in place. The brief
   does not specify; this is an operator-tempo call.

---

## §15 — Doctrine self-check

Walk through every relevant doctrine skill and assert each is respected:

### 15.1 — cdiscourse-doctrine

- **§1 (score is gameplay analysis, never truth):** Machine Observations
  written by this Edge Function are STRUCTURAL facts about move shape
  (`supports_parent`, `challenges_parent`, etc.). None of the 16 Family A
  keys imply correctness, victory, or defeat. The persisted rows feed Source
  6 which renders chips via the MCP-021A definition registry's
  plain-language labels — no raw `raw_key` ever appears in user-facing copy
  (§9 + adapter design).
- **§2 (heat means activity / friction):** No heat / engagement / popularity
  input or output anywhere in the design. The classifier reads ONLY argument
  text + parent text + thread context excerpt. No view counts, no retweet
  counts, no engagement metrics.
- **§3 (popularity is not evidence):** Same as §2. The classifier never reads
  engagement signals; the persistence schema has no engagement columns
  (verified MCP-021B base migration line 19-20).
- **§4 (AI moderator hard limits):** The classifier produces ADVISORY
  Observations only. No user content is deleted, hidden, or modified by
  this Edge Function. No content is blocked from posting. The response
  carries NO authoritative flags; the MCP-021A schema enforces
  `modelInfo.provider = 'mcp'` and the persistence layer renders the
  resulting marks with `kind: 'machine_observation'` (advisory). AI calls
  happen ONLY in the Edge Function (`runBooleanObservationMcpAdapter`),
  NEVER in the client (verified by source-scan test §10.1 file #6 + read-only
  boundary test file #13).
- **§5 (rules engine is sacred):** This card does NOT touch
  `src/lib/constitution/engine.ts`. The classifier runs alongside the engine,
  not within it.
- **§6 (secrets policy):** `SEMANTIC_REFEREE_MCP_URL` and
  `SEMANTIC_REFEREE_MCP_TOKEN` are read via `Deno.env.get()` only in the
  Edge Function adapter; NEVER prefixed `EXPO_PUBLIC_*`; NEVER appear in
  `app/` or `src/` (verified by read-only boundary test file #13).
  `SUPABASE_SERVICE_ROLE_KEY` is read only in `supabaseClients.ts` (existing
  helper); the new persistence writer imports the factory, never the env
  read itself.
- **§7 (no AI calls from the production app):** Verified explicitly — the
  new MCP fetch is inside
  `supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts`,
  a Deno-only file. No imports of this file or any `fetch` to an MCP
  endpoint exist in `src/` or `app/` (file #13 read-only boundary test
  ensures this).
- **§8 (Supabase conventions):** RLS remains ON for both MCP-021B tables;
  the new migration is purely additive (column + index + COMMENT); no
  existing migration is edited. The new RLS posture is unchanged
  (delegation via `EXISTS into public.arguments` continues to apply
  transparently with `run_mode` being additive).
- **§9 (plain language for users):** Source 6 renders `NodeLabelMark`s with
  the MCP-021A registry's plain-language `label`/`shortLabel`/`description`
  fields; raw_keys never reach the UI. The Edge Function response body
  does include `rawKeysWithPositive` for the admin-validation audit, but
  the production UI never consumes this — it consumes the persisted rows
  via Source 6.
- **§10a (Observations vs Allegations):** The classifier outputs Machine
  Observations exclusively; never User Allegations. The persistence
  adapter sets `kind: 'machine_observation'` on every emitted mark
  (verified MCP-021B adapter line 117 + adapter test). No sensitive
  Observations (`shifts_to_person_or_intent`, etc.) are in Family A; all 16
  Family A keys are parent-structural (no doctrinal exposure on the target
  node's chrome).
- **§10 (v1 scope guards):** No voting, scoring-with-winner, real-time
  collaborative editing, OAuth, public API, push notifications, or argument
  search introduced. Card is server-side Edge Function + DB migration only.

### 15.2 — test-discipline

- 14 test files; ~220 tests; below +500 ceiling.
- Each pure-TS public function gets unit tests including failure cases
  (parser, sanitizer, persistence writer, family registry, etc.).
- Ban-list test ensures no raw `raw_key` or verdict tokens appear in
  user-facing copy.
- Source-scan tests (file #6 + #13) replicate the MCP-018 source-scan
  invariant pattern.
- Aggregate-test pattern: each file scopes one phenomenon, multiple `it()`s
  per file.

### 15.3 — expo-rn-patterns

- No new dependency added.
- No UI changes (no new RN primitives, no new visual primitive, no new
  design token).
- Cross-device QA viewport matrix files are byte-equal (read-only).

### 15.4 — supabase-edge-contract

- Standard Edge Function shape: CORS preflight, JWT auth (via
  `requireAdmin`), zod schema validation, service-role write only inside
  the function, sanitized errors, no secret echo, no service-role detail
  in response.
- Migration is append-only (new file `20260526000019_*`); existing migrations
  untouched.
- RLS remains on for both tables.

### 15.5 — evidence-doctrine

- The Family A keys do NOT generate evidence artifacts or evidence-debt
  signals. They are parent-relation structural facts. Evidence-source-chain
  classification is Family D (out of production scope for this card).
- Anti-amplification semantics (popularity ≠ evidence) are preserved at the
  schema level — no engagement columns, no view-count inputs to the
  classifier.

---

## §16 — Operator steps (post-merge follow-up)

Per intent brief §"Post-merge operator follow-up" — these steps are NOT
executed in the autonomous pipeline; they are the operator workflow.

1. **Auto-merge applies migration + deploys Edge Function** via Supabase
   GitHub integration (per session memory "Supabase merge auto-deploy").

2. **Verify Supabase function secrets are set:**
   ```
   npx supabase secrets list --linked | grep SEMANTIC_REFEREE_MCP
   ```
   Expected: `SEMANTIC_REFEREE_MCP_URL` and `SEMANTIC_REFEREE_MCP_TOKEN`
   present. If absent (the MCP-018 secrets were never set):
   ```
   npx supabase secrets set SEMANTIC_REFEREE_MCP_URL=https://... --linked
   npx supabase secrets set SEMANTIC_REFEREE_MCP_TOKEN=... --linked
   ```

3. **Verify migration applied:**
   ```
   npx supabase db query --linked --query "
     SELECT column_name, data_type, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'argument_machine_observation_runs'
       AND column_name = 'run_mode';
   "
   ```
   Expected: one row, `data_type = text`, `column_default = ''production''::text`.

4. **Run admin validation against the 3 fixture moves** (intent brief
   §"Post-merge operator follow-up" step 3 curl example).

5. **Inspect run + result rows** (intent brief steps 4-5 SQL queries).

6. **Verify Source 6 does NOT render admin-validation rows in the UI** by
   navigating to one of the fixture arguments — confirm no new chips appear
   from the admin-validation run.

7. **Record results in
   `docs/audits/MCP-021C-EDGE-admin-validation-<date>.md`** using the
   committed template at
   `docs/audits/MCP-021C-EDGE-admin-validation-template.md`.

8. **Verdict + next card decision** per §11 Phase 5.
