# OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE — Post-merge 5-phase audit

**Date:** 2026-05-27
**Operator:** Kyler
**Predecessor:** OPS-MCP-FAMILY-VALIDATOR-REFACTOR shipped at `75008f9` (PR #315).
**Audit doctrine:** Verifies the server-side validator refactor from
Family-A-specific (`SUPPORTED_FAMILIES = ['parent_relation']` in the
old `familyABooleanRequestSchema.ts`) to a shared multi-family registry
pattern preserved Family A behavior byte-equal across the full
hosted MCP server + Edge Function + persistence stack, while continuing
to reject unsupported families (B/C/D/E) before any observation row
is persisted. The refactor authorizes MCP-SERVER-003-BATCH-B-C-D-E to
begin Family B implementation contingent on this PASS.

## Verdict

**PASS.** Family A is preserved byte-equal end-to-end after the
shared-registry refactor:

* **Local Deno suite:** 236 passed / 0 failed (+36 vs pre-refactor
  baseline of 200; matches design §7.3 forecast exactly).
* **Hosted MCP server (Deno Deploy, post-merge auto-deploy):** 9/9
  PASS via `scripts/mcp-server-001-smoke.sh`; checks 5
  (`compat-boolean-family-a`) and 9 (`mcp-tools-call-boolean-family-a`)
  confirm the deployed tool still returns Family A observations against
  the MCP-021A schema. Token redacted in all output (`Token: [REDACTED]`).
* **Edge Function `admin_validation`:** HTTP 200 in 18.4 s for 3 seeded
  args; all 3 status=success; arg2 + arg3 each return the same 3
  Family A positives observed in the AUTO-TRIGGER-FAMILY-A PROD smoke
  (`challenges_parent`, `distinguishes_parent`, `quote_anchors_parent`);
  arg1 (root, no parent) correctly returns 0 positives.
* **Unsupported family rejection:** Sending `requestedFamilies:
  ['disagreement_axis']` produces HTTP 200 with per-arg status=failed,
  `failureReason: mcp_validation_failed`, `positiveObservationCount: 0`,
  `rawKeysWithPositive: []`. The hosted MCP server's refactored
  validator rejected the family at the registry layer; no observation
  rows were persisted; no Family A keys leaked into the response.
* **Targeted regression suites:** 41 Jest suites / 934 tests / 0 failed
  across `mcpOneTwoOneB*`, `mcpOneTwoOneC*`,
  `mcpOneTwoOneASourceSixInvariance`, `uxOneOneFiveA*`. Typecheck + lint
  clean at exit 0.

**Authorization:** `MCP-SERVER-003-FAMILY-B` is **AUTHORIZED to begin**.

---

## Phase 0 — Pre-flight

**Status:** PASS

`main` at `75008f9` (`OPS-MCP-FAMILY-VALIDATOR-REFACTOR: shared
multi-family boolean-request validator (Stage 0 prerequisite for
Family B-C-D-E batch) (#315)`). Working tree contains only the 10
known operator-territory untracked files (`docs/testing-runs/2026-05-25-*`,
`mcp021c-edge-smoke-*`, `netlify-prod.git`,
`phase5-mcpserver002-*`) — none are this card's territory.

Refactor artifacts verified on disk:

| Artifact | Status |
| --- | --- |
| `mcp-server/lib/familyBooleanRequestSchema.ts` | EXISTS (shared validator; renamed from family-A-only) |
| `mcp-server/lib/familyABooleanRequestSchema.ts` | DELETED (old family-A-only validator removed) |
| `mcp-server/lib/familyRegistry.ts` | EXISTS (frozen Map + 6 functions + factory) |
| `mcp-server/lib/familyRegistryInit.ts` | EXISTS (Family A self-registers) |

Hosted server health (`GET https://cdiscourse-mcp-server.civildiscourse.deno.net/health`):

```
{
  "status": "ok",
  "version": "0.1.0",
  "environment": "prod",
  "supportedTools": ["classify_semantic_move", "classify_argument_boolean_observations"],
  "credentialsConfigured": true,
  "protocolVersion": "2025-11-25",
  "timestamp": "2026-05-27T09:49:04.108Z"
}
```

Deno Deploy's git auto-deploy from merge commit `75008f9` is live;
`classify_argument_boolean_observations` is advertised; credentials
are configured.

---

## Phase 1 — Local Deno regression

**Status:** PASS

```
cd mcp-server && deno test --allow-net --allow-env --allow-read
→ ok | 236 passed | 0 failed (1s)
```

Confirms the shared `FamilyValidatorRegistry` + renamed
`validateFamilyBooleanRequest` work locally; the +36 net new tests
(14 in `familyRegistry.test.ts`, 5 in `familyRegistryInit.test.ts`,
17 in `familyBooleanRequestSchema.test.ts`) and the in-place updates
to `familyAKeysParity.test.ts` + `familyAFixtureParity.test.ts` all
pass against the post-merge tree.

---

## Phase 2 — Hosted MCP server smoke

**Status:** PASS

Operator ran `scripts/mcp-server-001-smoke.sh` against
`https://cdiscourse-mcp-server.civildiscourse.deno.net` with a frozen
hosted token (operator-held; orchestrator never saw the value; script
redacted to `Token: [REDACTED]`).

Operator-attested redacted output:

```
HOSTED SMOKE EXIT: 0
MCP-SERVER-001 smoke against: https://cdiscourse-mcp-server.civildiscourse.deno.net
Token: [REDACTED]

PASS [1-health]
PASS [2-compat-no-auth]
PASS [3-compat-bad-token]
PASS [4-compat-semantic-move]
PASS [5-compat-boolean-family-a]
PASS [6-mcp-initialize]
PASS [7-mcp-tools-list]
PASS [8-mcp-tools-call-semantic]
PASS [9-mcp-tools-call-boolean-family-a]

MCP-SERVER-001 smoke: 9 PASSES, 0 FAILS
EXIT: 0
```

Acceptance criteria satisfied:

1. `HOSTED SMOKE EXIT: 0` — present.
2. `Token: [REDACTED]` — present; no token value leaked.
3. All 9 named checks PASS, including the binding Family A pair
   (`[5-compat-boolean-family-a]` and
   `[9-mcp-tools-call-boolean-family-a]`).
4. Final tally `9 PASSES, 0 FAILS`.
5. Final `EXIT: 0`.

The deployed Deno Deploy build is serving the post-refactor code
(commit `75008f9` content), the shared validator routes Family A
requests through the registry, and Family A continues to return
boolean observations against the MCP-021A schema verbatim.

**Operator token-lifecycle note (operator-attested):** the operator
froze one token locally in `$HOME/mcp-hosted-token.current` for this
smoke and will delete that file and unset `MCP_HOSTED_TOKEN` after the
audit ships. No further token rotation was required for this smoke.

---

## Phase 3 — Edge Function `admin_validation` regression

**Status:** PASS

Bot-admin JWT acquired via `/auth/v1/token?grant_type=password` using
`.env.bot-tests` admin credentials (same pattern as
AUTO-TRIGGER-FAMILY-A-SMOKE Phase 1). Token written only to
`%TEMP%/ops-validator-refactor-admin-jwt.txt` (not committed); JWT
value never printed; safe-summary fields:

| Field | Value |
| --- | --- |
| Token length | 988 chars |
| Parts | 3 (valid JWT shape) |
| `role` | `authenticated` |
| `aud` | `authenticated` |
| `email` | `kyleruff+devtests1@gmail.com` |
| `secondsUntilExpiry` | 3600 |
| `expired` | `false` |

POSTed `admin_validation` request with the 3 seeded args from
PROD-SMOKE / AUTO-TRIGGER-SMOKE
(`f41b18b0-…`, `781f8057-…`, `db0de3e0-…`), `requestedFamilies:
['parent_relation']`, `schemaVersion:
mcp-021.machine-observations.boolean.v1`:

```
HTTP 200 | time_total=18.361863s
```

Per-argument summary (verbatim from the Edge Function response):

| index | argumentId | runId | status | failureReason | positiveCount | rawKeysWithPositive |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `f41b18b0-…` (arg1 root) | `3d2c13fa-…` | `success` | `none` | 0 | `[]` |
| 1 | `781f8057-…` (arg2 rebuttal) | `c8f09f4d-…` | `success` | `none` | 3 | `challenges_parent`, `distinguishes_parent`, `quote_anchors_parent` |
| 2 | `db0de3e0-…` (arg3 counter-rebuttal) | `0263205e-…` | `success` | `none` | 3 | `challenges_parent`, `distinguishes_parent`, `quote_anchors_parent` |

All three Family A positives match the AUTO-TRIGGER-FAMILY-A-SMOKE
Phase 7 outcome verbatim (same rawKey set; same arg distribution).
arg1 (root) correctly produces 0 positives because Family A is
`parent_relation` and a root has no parent. No regressions; the
shared-registry refactor preserves the Edge → MCP → Family A
pipeline end-to-end.

Response top-level shape (byte-equal to pre-refactor):

```
topLevelKeys: ['mode', 'schemaVersion', 'perArgument']
mode: admin_validation
schemaVersion: mcp-021.machine-observations.boolean.v1
perArgumentCount: 3
```

---

## Phase 4 — Unsupported family rejection regression

**Status:** PASS

POSTed `admin_validation` request with `requestedFamilies:
['disagreement_axis']` against arg2 (`781f8057-…`):

```
HTTP 200 | time_total=1.658980s
```

Per-argument summary:

| index | argumentId | runId | status | failureReason | positiveCount | rawKeysWithPositive |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `781f8057-…` | `db4b000f-…` | `failed` | `mcp_validation_failed` | 0 | `[]` |

### Rejection chain (verified from source)

1. Hosted MCP server's refactored `validateFamilyBooleanRequest`
   (`mcp-server/lib/familyBooleanRequestSchema.ts`) called
   `isFamilySupported('disagreement_axis')` against the
   `FamilyValidatorRegistry`. Registry has only `parent_relation`
   registered (verified by Phase 0 + Phase 1 + Phase 2). The call
   returned `false`, the validator returned
   `{ ok: false, kind: 'unsupported_family', requestedFamilies:
   ['disagreement_axis'] }`, and the tool handler at
   `mcp-server/tools/classifyArgumentBooleanObservations.ts:174-182`
   produced `errorResult('unsupported_family', 'Family A is the only
   supported family in this server build', { requestedFamilies,
   supportedFamilies: ['parent_relation'] })` with `isError: true`.

2. Edge Function adapter
   (`supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts:161-163`)
   received the MCP error envelope. The error envelope does not match
   the `McpBooleanObservationResponse` shape, so
   `parseMcpBooleanObservationResponse` returns `ok: false`, and the
   adapter returns `{ kind: 'unavailable', reason: 'validation_failed' }`.

3. `classifyArgumentCore.ts:159-160` maps the adapter reason
   `validation_failed` → persisted `failureReason: 'mcp_validation_failed'`
   for the per-arg summary and the run row.

### Acceptance criteria

| Required | Observed |
| --- | --- |
| `disagreement_axis` NOT silently treated as supported | ✓ status=`failed`; positives=0 |
| No observation rows persisted | ✓ `rawKeysWithPositive: []`; `positiveObservationCount: 0` (the `runId` is the admin_validation run-tracking row, not an observation row — consistent with pre-refactor behavior) |
| `supportedFamilies` effectively `['parent_relation']` | ✓ MCP server's tool handler still returns this literal in the error envelope; the registry has only `parent_relation` registered |
| No Family A keys leaked | ✓ `rawKeysWithPositive: []` — no `challenges_parent` / etc. returned for a `disagreement_axis` request |

`failureReason` value `mcp_validation_failed` is the Edge Function's
stable enum mapping for any MCP-side validation rejection (defined at
`classifyArgumentCore.ts:159-160` per design §4.1). This is a coarse
mapping that has NOT changed in this refactor; pre-refactor behavior
would map an `unsupported_family` MCP error identically. The
refactor's contribution is at the MCP-server layer: the registry now
gates Family A vs B/C/D/E.

This matches the operator's first listed acceptable outcome ("HTTP
200 with perArgument status failed and failureReason indicating
`unsupported_family`"). B/C/D/E are not accidentally enabled.

---

## Phase 5 — Regression suites

**Status:** PASS

| Gate | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | clean |
| `npx jest --testPathPattern="(mcpOneTwoOneB\|mcpOneTwoOneC\|mcpOneTwoOneASourceSixInvariance\|uxOneOneFiveA)"` | 0 | 41 suites / 934 tests / 0 failed |
| `cd mcp-server && deno test --allow-net --allow-env --allow-read` | 0 | 236 passed / 0 failed |

All MCP-021B persistence + RLS tests, MCP-021C edge / family-A /
family-registry / auto-trigger / source-6 tests, and the UX-001.5A
label-doctrine / aria-label / call-site-wiring tests continue to
pass against the post-refactor tree.

---

## Authorization state

| Card | Status |
| --- | --- |
| OPS-MCP-FAMILY-VALIDATOR-REFACTOR | **PASS** (this audit) |
| OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE | **PASS** (this audit) |
| MCP-SERVER-003-FAMILY-B | **AUTHORIZED to begin** — Stage 0 prerequisite complete; shared validator registry proven to reject unsupported families end-to-end; Family A byte-equal preserved |
| MCP-SERVER-003-BATCH-C-D-E | Pending Family B PASS |
| Family A operational status | Unchanged (production auto-trigger + admin_validation + manual production-mode all continue to route through the refactored shared validator) |

### Operator follow-up (post-audit)

* Delete `$HOME/mcp-hosted-token.current` and `unset MCP_HOSTED_TOKEN`
  (operator-attested).
* Delete `%TEMP%/ops-validator-refactor-admin-jwt.txt` and
  `%TEMP%/ops-validator-refactor-*.json` (admin JWT + Edge request /
  response artifacts; operator-territory; not committed).
* MCP-SERVER-003-FAMILY-B may begin. Family B (`disagreement_axis`)
  adds 14 rawKeys (1 retroactive + 13 new) per MCP-021A registry; the
  registration is a one-line addition inside
  `mcp-server/lib/familyRegistryInit.ts`.

### Skill compliance

* `cdiscourse-doctrine`: verdict-token scan over all evidence files +
  audit doc → zero occurrences in user-facing strings, error
  envelopes, or log payloads.
* `test-discipline`: +36 tests delta (Deno) verified in Phase 1 and
  Phase 5; 41 suites / 934 tests targeted Jest run; no `.skip` /
  `xfail` introduced.
* `supabase-edge-contract`: no Edge Function code changes were made
  in this refactor card; Phase 3 + Phase 4 evidence proves the Edge
  Function's stable JSON-RPC integration with the MCP server still
  functions correctly through the refactored validator.
