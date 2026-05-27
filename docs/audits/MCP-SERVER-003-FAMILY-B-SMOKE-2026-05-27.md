# MCP-SERVER-003-FAMILY-B-SMOKE — Post-merge 8-phase audit

**Date:** 2026-05-27
**Operator:** Kyler
**Predecessor:** MCP-SERVER-003-FAMILY-B shipped at `ebbe389` (PR #317).
**Audit doctrine:** Verifies the disagreement-axis (`disagreement_axis`)
boolean-observation classifier works end-to-end through the
shared validator registry introduced by
OPS-MCP-FAMILY-VALIDATOR-REFACTOR, while preserving Family A
behavior byte-equal and continuing to reject unsupported families
(C/D/E) at the MCP-server layer. PASS authorizes
MCP-SERVER-004-FAMILY-C.

## Verdict

**PASS.** Family B is operational on the hosted MCP server and via
Edge `admin_validation`, with Family A preserved and C/D/E still
rejected:

* **Local Deno suite:** 343 passed / 0 failed (+107 vs pre-Family-B
  baseline of 236; within design forecast +80 to +110).
* **Hosted MCP server (Deno Deploy, post-merge auto-deploy):**
  `MCP-SERVER-001 smoke: 11 PASSES, 0 FAILS` (bumped from the
  9/9 OPS-refactor baseline; the 2 new checks
  `[10-compat-boolean-family-b]` + `[11-mcp-tools-call-boolean-family-b]`
  prove Family B is live on the deployed build with `family-b-v1`
  classifier set and 14 raw keys).
* **Edge Function `admin_validation`:** HTTP 200 for 3 seeded args
  with `requestedFamilies: ['disagreement_axis']`. arg2 returned
  3 Family B positives (`disagreement_present`, `disputes_scope`,
  `disputes_causal_link`); arg3 returned 4 positives, INCLUDING
  the doctrine-risk key `disputes_value_weighting`. arg1 (root)
  correctly returned 0 positives (Family B is about move posture
  toward its parent; root has no parent).
* **Unsupported C/D/E rejection regression:** All three of
  `misunderstanding_repair` / `evidence_source_chain` /
  `argument_scheme` correctly rejected (status=`failed`,
  `failureReason=mcp_validation_failed`, 0 positives, empty
  rawKeys); no Family A or Family B leakage.
* **Targeted regression suites:** 40 Jest suites / 926 tests / 0
  failed across `mcpOneTwoOneB*`, `mcpOneTwoOneC*`,
  `uxOneOneFiveA*`. Typecheck + lint exit 0.

**Authorization:** `MCP-SERVER-004-FAMILY-C` is **AUTHORIZED to
begin**.

---

## Phase 1 — Pre-flight

**Status:** PASS

`main` at `ebbe389`
(`MCP-SERVER-003-FAMILY-B: Disagreement Axis Boolean Observation
Classifier (#317)`). Working tree contains only the 10 known
operator-territory untracked files
(`docs/testing-runs/2026-05-25-*`, `mcp021c-edge-smoke-*`,
`netlify-prod.git`, `phase5-mcpserver002-*`) — none are this
card's territory.

Predecessor audits present:

| Audit | Path |
| --- | --- |
| OPS validator-refactor smoke | `docs/audits/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE-2026-05-27.md` |
| AUTO-TRIGGER FAMILY A smoke | `docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-2026-05-26.md` |
| FAMILY A PROD smoke | `docs/audits/MCP-021C-FAMILY-A-PROD-SMOKE-2026-05-26.md` |
| MCP-SERVER-002 smoke | `docs/audits/MCP-SERVER-002-SMOKE-2026-05-26.md` |

Hosted server health
(`GET https://cdiscourse-mcp-server.civildiscourse.deno.net/health`):

```
{
  "status": "ok",
  "version": "0.1.0",
  "environment": "prod",
  "supportedTools": ["classify_semantic_move", "classify_argument_boolean_observations"],
  "credentialsConfigured": true,
  "protocolVersion": "2025-11-25",
  "timestamp": "2026-05-27T11:49:11.683Z"
}
```

Edge Functions ACTIVE:

| Function | Version | Updated |
| --- | --- | --- |
| `semantic-referee` | 143 | 2026-05-27 11:47:24 UTC |
| `classify-argument-boolean-observations` | 29 | 2026-05-27 11:47:24 UTC |

The Edge Function version jumped from 27 (OPS-refactor smoke
audit's snapshot) to 29 after the Family B merge auto-deploy at
`2026-05-27 11:47:24 UTC` — ~2 minutes after PR #317 squash-merged.
Auto-deploy succeeded.

---

## Phase 2 — Local Deno regression

**Status:** PASS

```
cd mcp-server && deno test --allow-net --allow-env --allow-read
→ ok | 343 passed | 0 failed (2s)
```

Test delta against the pre-Family-B baseline (236, set by the
OPS validator-refactor smoke): **+107 tests**. Design §8 forecast
was +80 to +110; observed +107 lands at the upper end of that
range. The new tests cover Family B keys (parity), prompt
(doctrine assertions), Anthropic wrapper, ban-list scan, fixtures
(11 total — 8 request + 3 response), response validator, dispatcher,
and doctrine-fixtures smoke.

---

## Phase 3 — Hosted MCP server smoke

**Status:** PASS

Operator ran `scripts/mcp-server-001-smoke.sh` against
`https://cdiscourse-mcp-server.civildiscourse.deno.net` with the
hosted token. The script's Family B checks (added in commit
`06d7718`) bumped the tally from 9 → 11.

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
PASS [10-compat-boolean-family-b]
PASS [11-mcp-tools-call-boolean-family-b]

MCP-SERVER-001 smoke: 11 PASSES, 0 FAILS
EXIT: 0
```

Acceptance criteria satisfied:

1. `HOSTED SMOKE EXIT: 0` — present.
2. `Token: [REDACTED]` — present; no token value leaked.
3. All 11 named checks PASS, including the binding Family B pair
   (`[10-compat-boolean-family-b]` and
   `[11-mcp-tools-call-boolean-family-b]`).
4. Final tally `11 PASSES, 0 FAILS`.
5. Final `EXIT: 0`.

The 2 new Family B checks specifically verify, per the smoke
script's per-check assertions:

* Check 10: hosted server returns a Family B response whose
  `modelInfo.classifierSetVersion === 'family-b-v1'`.
* Check 11: `tools/call` against `classify_argument_boolean_observations`
  with a Family B request returns a structured response whose
  `modelInfo.classifierSetVersion === 'family-b-v1'`.

Family A checks 5 and 9 continue to pass against the same hosted
server, proving the post-merge build serves BOTH families correctly
through the shared validator registry.

**Operator token-lifecycle note (operator-attested):** before this
hosted smoke, the operator updated Supabase
`SEMANTIC_REFEREE_MCP_TOKEN` to match the current hosted bearer
token. The token itself is not included in any audit artifact.

---

## Phase 4 — Edge Function `admin_validation` regression

**Status:** PASS

Bot-admin JWT acquired via `/auth/v1/token?grant_type=password`
using `.env.bot-tests` admin credentials (same pattern as the OPS
validator-refactor smoke Phase 3). Token written only to
`%TEMP%/family-b-smoke-admin-jwt.txt` (not committed; never
printed). Safe-summary fields:

| Field | Value |
| --- | --- |
| Token length | 988 chars |
| Parts | 3 (valid JWT shape) |
| `role` | `authenticated` |
| `expiresAt` | 1h from acquisition |

POSTed `admin_validation` request with the 3 seeded args from the
predecessor smokes (`f41b18b0-…`, `781f8057-…`, `db0de3e0-…`),
`requestedFamilies: ['disagreement_axis']`, `schemaVersion:
mcp-021.machine-observations.boolean.v1`:

```
HTTP 200 | time_total=16.220674s
```

Per-argument summary (verbatim from the Edge Function response):

| index | argumentId | runId | status | failureReason | positiveCount | rawKeysWithPositive |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `f41b18b0-…` (arg1 root) | `d47a59e8-…` | `success` | `none` | 0 | `[]` |
| 1 | `781f8057-…` (arg2 rebuttal) | `e531a784-…` | `success` | `none` | 3 | `disagreement_present`, `disputes_scope`, `disputes_causal_link` |
| 2 | `db0de3e0-…` (arg3 counter-rebuttal) | `51650537-…` | `success` | `none` | 4 | `disagreement_present`, `disputes_scope`, `disputes_causal_link`, `disputes_value_weighting` |

Response top-level shape:

```
topLevelKeys: ['mode', 'schemaVersion', 'perArgument']
mode: admin_validation
schemaVersion: mcp-021.machine-observations.boolean.v1
perArgumentCount: 3
```

Observations:

* arg1 (root) returned 0 Family B positives — correct: Family B
  is `disagreement_axis`, which describes a move's posture toward
  its parent; a root has no parent.
* arg2 + arg3 produced 7 Family B positives total across 4 distinct
  rawKeys (`disagreement_present` umbrella + 3 subtype axes:
  `disputes_scope`, `disputes_causal_link`,
  `disputes_value_weighting`).
* The umbrella `disagreement_present` is true on both arg2 and
  arg3, consistent with MCP-021A Decision 4 (umbrella reflects
  presence of any subtype).
* `disputes_value_weighting` landed on arg3. This is the
  doctrine-risk key with the binding MCP-021A `falsePositiveGuards`
  clause ("copy MUST NOT imply one value is 'right'"). The
  successful per-arg row is the structural fact ("a value-weighting
  disagreement is present"); the doctrine-safe prompt + server-side
  doctrine ban-list scan ensure no verdict tokens reach the
  persisted evidence spans.

This satisfies the intent brief §9 Phase 4 PASS criteria:

* At least ONE positive Family B row persisted: ✓ (7 positives
  total across arg2+arg3).
* All Family B rawKeys valid: ✓ (4 distinct positives, all in the
  14-key binding set).
* Family B Edge `admin_validation` works end-to-end: ✓.

---

## Phase 5 — Unsupported C/D/E rejection regression

**Status:** PASS

POSTed three `admin_validation` requests with unsupported
families (`misunderstanding_repair`, `evidence_source_chain`,
`argument_scheme`) against arg2 (`781f8057-…`):

| Family | HTTP | status | failureReason | positives | rawKeys |
| --- | --- | --- | --- | --- | --- |
| C — `misunderstanding_repair` | 200 | `failed` | `mcp_validation_failed` | 0 | `[]` |
| D — `evidence_source_chain` | 200 | `failed` | `mcp_validation_failed` | 0 | `[]` |
| E — `argument_scheme` | 200 | `failed` | `mcp_validation_failed` | 0 | `[]` |

Rejection chain identical to the OPS validator-refactor smoke
Phase 4 chain, now also exercised against the post-Family-B build:

1. Hosted MCP server's `validateFamilyBooleanRequest` calls
   `isFamilySupported(family)` against the registry. The registry
   now has `['parent_relation', 'disagreement_axis']` registered.
   Each of C/D/E returns `false`; the validator returns
   `{ ok: false, kind: 'unsupported_family', requestedFamilies:
   [<the unsupported family>] }`.
2. Tool handler maps to `errorResult('unsupported_family', '…',
   { requestedFamilies, supportedFamilies: getSupportedFamilies() })`.
   Note: the `supportedFamilies` field in the rejection envelope is
   now dynamic and reflects the actual registered set
   `['parent_relation', 'disagreement_axis']` (intentional
   multi-family evolution; reviewer judged this NOT a HALT
   violation because REJECTION behavior is unchanged and the
   Edge adapter does not consume this field).
3. Edge Function adapter receives the MCP error envelope; the
   error doesn't match `McpBooleanObservationResponse` shape;
   adapter returns `{ kind: 'unavailable', reason:
   'validation_failed' }`.
4. `classifyArgumentCore.ts` maps `validation_failed` → persisted
   `failureReason: 'mcp_validation_failed'` for the per-arg
   summary.

No Family A or Family B keys leaked. No observation rows persisted
for the rejected requests. The registry boundary holds.

---

## Phase 6 — Targeted regression suites

**Status:** PASS

| Gate | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` (post-merge) | 0 | clean |
| `npm run lint` (post-merge) | 0 | clean |
| `npx jest --testPathPattern="(mcpOneTwoOneB\|mcpOneTwoOneC\|uxOneOneFiveA)"` | 0 | 40 suites / 926 tests / 0 failed |
| `cd mcp-server && deno test --allow-net --allow-env --allow-read` (post-merge) | 0 | 343 passed / 0 failed |

The targeted Jest run covers MCP-021B persistence + RLS, MCP-021C
edge / family-A / family-registry / auto-trigger / source-6 tests,
and UX-001.5A label-doctrine / aria-label / call-site-wiring
tests. All continue to pass against the post-Family-B tree.

---

## Phase 7 — OPS observations

**Telemetry signals (informal; from this smoke run only):**

| Signal | Value |
| --- | --- |
| Hosted smoke total wall time | not captured (operator-territory) |
| Edge admin_validation HTTP time | 16.22 s for 3 args × 1 family |
| C rejection HTTP time | 2.91 s |
| D rejection HTTP time | 1.31 s |
| E rejection HTTP time | 1.28 s |
| Family B positives observed | 7 across 2 args (3 + 4) |
| Distinct Family B rawKeys triggered | 4 of 14 (`disagreement_present`, `disputes_scope`, `disputes_causal_link`, `disputes_value_weighting`) |

**Suggested follow-on:**

* `OPS-MCP-OBSERVABILITY` — 2 families now have live traffic
  (Family A continuous via AUTO-TRIGGER; Family B via this smoke
  + future operator-run admin_validation calls). Per-family
  latency + token-usage breakdown becomes valuable. Designer §11
  noted the server-side `family` log tag was added in this card;
  Edge-side per-family tags remain deferred to the observability
  card.
* `MCP-021C-EDGE-FAMILY-B-ENABLE` — production-mode enablement
  for Family B remains gated by the Edge family registry
  (`productionEnabled: false`). This card stays admin_validation-only;
  production-mode enablement is a separate operator-sequenced card.
* `MCP-SERVER-004-FAMILY-C` — next family in the serial B/C/D/E
  batch. Family C is `misunderstanding_repair` with 17 keys (4
  retroactive + 13 new) per MCP-021A registry §3.3.

**Doctrine signals:**

* The fact that `disputes_value_weighting` landed on arg3 is a
  productive PASS, not a failure: it proves the doctrine-safe
  prompt detects value-weighting disputes WITHOUT requiring the
  model to make a correctness judgment. The persisted rawKey is
  the structural fact "value-weighting disagreement is present";
  the doctrine ban-list scan + the prompt's verbatim guards
  prevent any verdict token from accompanying the positive.

---

## Phase 8 — Verdict + authorization

### Verdict: PASS

All 8 phases clean:

* Phase 1 pre-flight: PASS (HEAD at `ebbe389`; hosted server
  prod-healthy; Edge Functions auto-deployed at `11:47:24 UTC`).
* Phase 2 local Deno regression: PASS (343/0; +107 vs baseline).
* Phase 3 hosted MCP direct smoke: PASS (11/11 incl. 2 new
  Family B checks).
* Phase 4 Edge `admin_validation` regression: PASS (HTTP 200;
  3 success; arg2+arg3 = 3+4 Family B positives including
  `disputes_value_weighting`).
* Phase 5 unsupported C/D/E rejection: PASS (3/3 rejected; no
  family leakage).
* Phase 6 targeted regression suites: PASS (typecheck 0, lint 0,
  Jest 40/926, Deno 343/343).
* Phase 7 OPS observations: captured.
* Phase 8 verdict: PASS.

### Authorization state

| Card | Status |
| --- | --- |
| MCP-SERVER-003-FAMILY-B | **PASS** (this audit) |
| MCP-SERVER-003-FAMILY-B-SMOKE | **PASS** (this audit) |
| Family B hosted MCP support | **OPERATIONAL** |
| Family B Edge `admin_validation` | **OPERATIONAL** |
| MCP-SERVER-004-FAMILY-C | **AUTHORIZED to begin** — next in the serial B/C/D/E batch |
| MCP-SERVER-003-BATCH-C-D-E | Remains serial — Family D begins only after Family C PASS |
| OPS-MCP-OBSERVABILITY | **AUTHORIZED to design** — 2 families have live traffic; per-family telemetry now valuable |
| MCP-021C-EDGE-FAMILY-B-ENABLE | **DEFERRED** — production-mode Family B enablement remains a separate card; Edge `productionEnabled: false` for `disagreement_axis` stays as-is |
| Family B production auto-trigger | **NOT ENABLED** — explicitly out of scope for this card; gated on production-mode enablement |
| Family A operational status | Unchanged (production auto-trigger + admin_validation + manual production-mode all continue to route through the shared validator + Family A path) |

### Operator follow-up (post-audit)

* Delete `%TEMP%/family-b-smoke-admin-jwt.txt` and
  `%TEMP%/family-b-smoke-*.json` (admin JWT + Edge request /
  response artifacts; operator-territory; never committed).
* Token-lifecycle hygiene: hosted bearer token + Supabase
  `SEMANTIC_REFEREE_MCP_TOKEN` are now both on the current value
  (operator-attested); rotate per operator policy.
* `MCP-SERVER-004-FAMILY-C` may begin. Family C
  (`misunderstanding_repair`) adds 17 raw keys (4 retroactive + 13
  new) per MCP-021A registry. The registration is a one-line
  addition inside `mcp-server/lib/familyRegistryInit.ts` (mirrors
  the Family B pattern); the implementation pattern (keys + prompt +
  Anthropic + ban-list + fixtures + tests + smoke-script
  extension) is now well-established.

### Skill compliance

* `cdiscourse-doctrine`: verdict-token scan over all evidence files
  + audit doc → zero occurrences in user-facing strings, error
  envelopes, or log payloads. The `disputes_value_weighting`
  positive observed on arg3 demonstrates that the doctrine-safe
  prompt correctly detects value-weighting disputes WITHOUT
  introducing correctness judgments.
* `test-discipline`: +107 tests delta (Deno) verified in Phase 2
  and Phase 6; 40 suites / 926 tests targeted Jest run; no
  `.skip` / `xfail` introduced.
* `evidence-doctrine`: `disputes_evidence_applicability` (the
  retroactive Family B key inherited from MCP-021A) is one of the
  14 registered; the registry parity test enforces all 14 keys
  match the upstream MCP-021A source verbatim.
* `supabase-edge-contract`: no Edge Function code changes were
  made in this card (the Edge family registry was already correctly
  configured for `disagreement_axis` at
  `supabase/functions/_shared/booleanObservations/familyRegistry.ts:69-72`
  with `adminValidationEnabled: true, productionEnabled: false`).
  Phase 4 + Phase 5 evidence proves the Edge Function's stable
  JSON-RPC integration with the MCP server functions correctly for
  both Family A (preserved) and Family B (new).
