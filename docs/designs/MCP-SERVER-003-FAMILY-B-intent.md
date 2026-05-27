# MCP-SERVER-003-FAMILY-B — Intent Brief

**Card:** MCP-SERVER-003-FAMILY-B — Disagreement Axis Boolean
Observation Classifier (`disagreement_axis`).

**Goal:** ship Family B on the MCP server using the shared validator
registry introduced by `OPS-MCP-FAMILY-VALIDATOR-REFACTOR`, then
smoke it through hosted MCP and Edge `admin_validation`. This is the
first family in the serial B/C/D/E batch.

**This card is:**

* Family B only. `disagreement_axis`. 14 rawKeys.
* Server-side classifier + Edge `admin_validation` exposure.
* `mcp-server-001-smoke.sh` updated to cover Family B in the hosted
  smoke. Tested locally + on hosted Deno Deploy.
* Optional manual production-mode smoke if the designer concludes
  the Edge family gate already supports it safely (Stage 1
  Decision I).

**This card is NOT:**

* A Family C/D/E card.
* A taxonomy-key change. The 14 keys come verbatim from MCP-021A
  source.
* A Family B production auto-trigger card. (`MCP-021C-AUTO-TRIGGER`
  remains Family A only.)
* A UI / display-cap / persistence-schema / Source-6-rendering
  change.
* A schema-version change. `mcp-021.machine-observations.boolean.v1`
  stays.
* A `familyAPrompt.ts` / `familyAAnthropic.ts` /
  `familyABanListScan.ts` change.

---

## 1. Sequencing chain

```
MCP-021A  taxonomy + parser:                       d6648b4
MCP-021B  persistence + Source 6 adapter:          eaa1aeb (smoke 6feeb08)
MCP-021C-EDGE  runtime spine:                      9a4de95
MCP-SERVER-001  server foundation:                 8a1652c (smoke bae4984)
MCP-SERVER-002  Family A classifier:               27bb837 (smoke fc28605)
MCP-021C-EDGE-SMOKE  PASS:                         ebf4482
MCP-021C-EDGE-RESPONSE-SUMMARY-FIX:                c5c6d9b
MCP-021C-FAMILY-A-PROD-SMOKE  PASS:                67fcba5
MCP-021C-AUTO-TRIGGER-FAMILY-A  + smoke PASS:      e281753
OPS-MCP-FAMILY-VALIDATOR-REFACTOR  shipped:        75008f9
OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE  PASS:     21f1b0b
Current HEAD must be:                              21f1b0b or later
```

If `21f1b0b` is missing from main, HALT.

---

## 2. Validator-refactor prerequisite PASS

The post-merge smoke at `21f1b0b` confirmed:

* Family A behavior is preserved byte-equal end-to-end after the
  shared-registry refactor.
* Hosted MCP server runs the post-refactor code on Deno Deploy.
* Edge `admin_validation` for Family A returns the same 3 positives
  on the seeded args (`challenges_parent`, `distinguishes_parent`,
  `quote_anchors_parent`).
* `disagreement_axis` is correctly rejected by the registry
  (status=`failed`, `failureReason=mcp_validation_failed`,
  `rawKeysWithPositive=[]`).

This card builds on that proof. Family B implementation = one
`registerFamily('disagreement_axis', ...)` call in
`familyRegistryInit.ts` (per the operator-blessed registry pattern)
+ Family-B-specific prompt, fixtures, tests, and tool-handler
dispatch.

---

## 3. Family B raw key list (binding; verbatim from MCP-021A source)

Source: `src/features/nodeLabels/machineObservationDefinitions/familyB.ts`.
Verified by Phase 0 grep: 14 rawKey declarations, declaration order:

1. `disputes_evidence_applicability` (retroactive ai_classifier; Family B Inspect-only sub-axis)
2. `disagreement_present` (UMBRELLA; Timeline-eligible per Decision 4)
3. `disputes_definition` (Inspect-only)
4. `disputes_scope` (Inspect-only)
5. `disputes_fact` (Inspect-only)
6. `disputes_causal_link` (Inspect-only)
7. `disputes_value_weighting` (Inspect-only; **DOCTRINE RISK**)
8. `disputes_decision_criterion` (Inspect-only)
9. `disputes_generalization` (Inspect-only)
10. `disputes_analogy` (Inspect-only)
11. `disputes_interpretation` (Inspect-only)
12. `disputes_priority_order` (Inspect-only)
13. `disputes_remedy_or_solution` (Inspect-only)
14. `disputes_relevance` (Inspect-only; **DOCTRINE RISK**)

Family B implementation MUST mirror this list exactly. Drift fails
the parity test and HALT trigger #2.

`classifierSetVersion` for Family B: `'family-b-v1'` (mirrors the
Family A pattern `'family-a-v1'`).

---

## 4. Family B doctrine risks

### 4.1 `disputes_value_weighting` — DOCTRINE RISK

MCP-021A registry attaches an explicit `falsePositiveGuards` clause:

> "Doctrine note: copy MUST NOT imply one value is 'right'. The
> disagreement is genuine; both values are real."

The Family B prompt MUST:

* Frame value-weighting disagreement as a structural sub-axis, never
  as a correctness judgment.
* Never produce a positive that suggests one value "wins" or is
  "correct" over the other.
* Treat both values in the dispute as real, productive, and
  unresolved by the move alone.

### 4.2 `disputes_relevance` — DOCTRINE RISK

MCP-021A registry attaches an explicit `falsePositiveGuards` clause:

> "Do NOT mark TRUE for dismissive moves with no argument; relevance
> dispute requires a reason."

The Family B prompt MUST:

* Require a substantive reason for the relevance challenge, not just
  dismissal.
* Treat relevance disputes as productive sub-axes when accompanied
  by a reason.
* Never frame relevance disagreement as "the parent is irrelevant
  as a person/contributor".

### 4.3 Cross-key doctrine constraint

All 14 disagreement outputs must remain **descriptive structural
facts** (per cdiscourse-doctrine §10a), never verdictive judgments
about who is right. The prompt's system block MUST mirror Family
A's 7 absolute rules verbatim, then add disagreement-axis-specific
framing that preserves descriptive posture.

---

## 5. Strict scope

**ALLOWED:**

* Add `mcp-server/lib/familyBKeys.ts` (binding 14-rawKey constant +
  classifier-set-version + per-key prompt entries).
* Add `mcp-server/lib/familyBPrompt.ts` (Family B system + user
  prompt; descriptive doctrine framing).
* Add `mcp-server/lib/familyBAnthropic.ts` (Family B Anthropic
  call) OR reuse a shared generic wrapper if the designer chooses
  reuse and the test plan covers parity.
* Add `mcp-server/lib/familyBBanListScan.ts` (Family B response
  doctrine ban-list scan) OR reuse a shared family ban-list wrapper
  if the designer chooses reuse with parity tests.
* Add `mcp-server/lib/familyBFixtureProvider.ts` for fixture-mode
  Family B responses.
* Add Family B fixtures under `mcp-server/fixtures/`.
* Add Family B tests under `mcp-server/tests/`.
* Edit `mcp-server/lib/familyRegistryInit.ts` to register
  `disagreement_axis`.
* Edit `mcp-server/tools/classifyArgumentBooleanObservations.ts` to
  route Family B requests to the new handler.
* Edit `mcp-server-001-smoke.sh` to add Family B coverage (hosted
  smoke).
* Update `docs/core/current-status.md` handoff section.

**DISALLOWED:**

* Family C/D/E key registration. `familyRegistryInit.ts` registers
  exactly `parent_relation` + `disagreement_axis` after this card.
* MCP-021A source-file changes (`src/features/nodeLabels/**`).
* Schema version changes
  (`mcp-021.machine-observations.boolean.v1` stays).
* Family A prompt / Anthropic / ban-list-scan changes
  (`familyAPrompt.ts`, `familyAAnthropic.ts`,
  `familyABanListScan.ts` untouched).
* Family A key mirror changes
  (`mcp-server/lib/familyAKeys.ts` — the 16 raw keys + `family-a-v1`
  constant are byte-identical).
* Edge Function changes beyond test-only import-path updates.
  (Edge calls MCP server via JSON-RPC.)
* Production auto-trigger for Family B
  (`MCP-021C-AUTO-TRIGGER-FAMILY-A` remains Family A only).
* UI / display-cap / Source-6-rendering changes.
* Persistence schema changes.
* Client-side MCP call (HALT #10).
* Secret exposure in logs (HALT #11).
* Raw keys in user-facing copy (HALT #13).
* Verdict / winner / correctness / fallacy / bad-faith language in
  model-facing or user-facing copy (HALT #14, except
  doctrine-negation tests).

---

## 6. Conditional HALT triggers (21)

1. `OPS-MCP-FAMILY-VALIDATOR-REFACTOR` smoke PASS audit missing.
2. Family B raw key list differs from MCP-021A source.
3. Any Family C/D/E registration appears.
4. Any taxonomy key added or renamed.
5. MCP schema version changes.
6. Family A prompt changes.
7. Family A key mirror changes except shared import/registry usage
   that tests prove byte-equivalent.
8. `parent_relation` behavior changes.
9. `unsupported_family` behavior for C/D/E changes.
10. Client-side MCP call introduced.
11. MCP bearer / Anthropic / service-role secrets exposed.
12. UI or display-cap changes.
13. Raw keys appear in user-facing copy.
14. Verdict / winner / correctness / fallacy / bad-faith language in
    model-facing or user-facing copy except doctrine-negation tests.
15. Family B prompt frames disagreement as who is right/wrong.
16. Family B prompt treats relevance disagreement as dismissal.
17. Family B prompt treats value weighting as a correctness
    judgment.
18. Hosted smoke fails.
19. Edge `admin_validation` smoke fails.
20. Test forecast exceeds +300 without explicit rationale.
21. Working tree contains unclassified untracked files at PR
    creation (operator-territory `docs/testing-runs/`,
    `mcp021c-edge-smoke-*`, `netlify-prod.git`,
    `phase5-mcpserver002-*` are KNOWN exclusions).

Any ONE fires HALT.

---

## 7. Implementation deliverables

### 7.1 New files (likely)

* `mcp-server/lib/familyBKeys.ts` — frozen 14-rawKey constant
  + per-rawKey `FamilyBPromptEntry` blocks
  + `FAMILY_B_CLASSIFIER_SET_VERSION = 'family-b-v1'`.
* `mcp-server/lib/familyBPrompt.ts` — system prompt mirrors Family
  A's 7 absolute rules verbatim, adds disagreement-axis framing;
  `buildFamilyBUserPrompt(request)`.
* `mcp-server/lib/familyBAnthropic.ts` (or shared generic wrapper).
* `mcp-server/lib/familyBBanListScan.ts` (or shared family ban-list
  wrapper) — scans Family B response evidence spans for
  verdict/winner/correctness/fallacy/bad-faith tokens.
* `mcp-server/lib/familyBFixtureProvider.ts` — env-gated fixture
  mode for tests.
* Family B fixtures under `mcp-server/fixtures/`:
  * `classify-argument-boolean-observations.family-b-canonical-response.json`
  * `classify-argument-boolean-observations.family-b-malformed-response.json`
  * `classify-argument-boolean-observations.family-b-ban-list-response.json`
  * Plus per-axis request/response fixtures the designer enumerates.

### 7.2 Edited files

* `mcp-server/lib/familyRegistryInit.ts` — add Family B registration.
* `mcp-server/tools/classifyArgumentBooleanObservations.ts` —
  dispatch to Family B handler when
  `requestedFamilies` ⊆ `['disagreement_axis']`.
* `mcp-server/lib/familyBooleanRequestSchema.ts` — designer
  evaluates whether request-validation logic needs per-family hooks
  (Family A and B differ in rawKey set per family).
* `scripts/mcp-server-001-smoke.sh` — add Family B coverage
  (likely 2-3 new PASS checks like
  `compat-boolean-family-b` + `mcp-tools-call-boolean-family-b`).
* `docs/core/current-status.md` — handoff section.

### 7.3 Locked out

* `mcp-server/lib/familyAPrompt.ts`
* `mcp-server/lib/familyAAnthropic.ts`
* `mcp-server/lib/familyABanListScan.ts`
* `mcp-server/lib/familyAFixtureProvider.ts`
* `mcp-server/lib/familyAKeys.ts` (16 keys + `family-a-v1` constant
  byte-identical)
* `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts`
* `mcp-server/lib/seedPrompt.ts`
* `src/features/nodeLabels/**`
* `supabase/functions/**`
* `mcp-server/bootstrap.ts` (designer recommends SKIP per OPS
  refactor §8)
* Any migration file
* Any Family C/D/E file

---

## 8. Test plan

Test forecast: **+60 to +120** new tests (HALT at +300). Target
range mirrors Family A's test surface (Family A introduced 16-key
registry + prompt + fixture + ban-list + parity tests; Family B has
14 keys + 2 doctrine-risk fixtures = similar surface plus the
shared-registry test extensions for "is `disagreement_axis` now
registered correctly").

Required test categories:

* **Family B key parity against MCP-021A source** — re-uses the
  `familyAKeysParity.test.ts` pattern; reads both
  `mcp-server/lib/familyBKeys.ts` AND
  `src/features/nodeLabels/machineObservationDefinitions/familyB.ts`
  as source text; asserts the 14 binding rawKeys appear in both.
* **Registry registration of `disagreement_axis`** — extends
  `familyRegistryInit.test.ts` expectations:
  `getSupportedFamilies()` returns `['parent_relation',
  'disagreement_axis']` (in registration order); `isFamilySupported('disagreement_axis')` true.
* **Family B request validation** — valid Family B request shape
  passes; invalid rawKey (not in 14-key set) rejected with
  `unsupported_rawKey`.
* **Family B unsupported rawKey rejection** — request with a Family
  A rawKey under `requestedFamilies: ['disagreement_axis']` →
  rejected.
* **C/D/E unsupported-family rejection still works** —
  `requestedFamilies: ['misunderstanding_repair']` →
  `unsupported_family`.
* **Family A canonical request still works** — bullet-proof
  regression test: full 16-key Family A request still validates +
  routes correctly.
* **Family B fixture provider returns valid shape** — every Family
  B fixture loadable + parses against MCP-021A wire shape.
* **Family B Anthropic response parser validation** — mock
  Anthropic response with 14 Family B rawKeys → adapter returns
  validated `McpBooleanObservationResponse`.
* **Family B doctrine ban-list scan** — fixture response with a
  smuggled verdict token in `evidenceSpan` → ban-list scan
  rejects.
* **Family B value-weighting no-correctness fixture** —
  `disputes_value_weighting` positive must NOT imply a value is
  "right"; ban-list scan + plain-text inspection asserts.
* **Family B relevance no-dismissal fixture** —
  `disputes_relevance` positive must come with a reason; pure
  dismissal triggers a false-positive guard.
* **tools/list does not misrepresent unsupported C/D/E** — tool
  description text continues to mention Family A (or now Family
  A + Family B); does NOT advertise C/D/E.
* **Hosted smoke script supports Family B** — `mcp-server-001-smoke.sh`
  emits PASS lines for `*-boolean-family-b` checks.
* **No client secrets** — defensive grep over diff.
* **No raw keys in user-facing output** — defensive scan; the
  validator and ban-list strip rawKeys from any user-bound
  string.

### Verification gates

```
npm run typecheck
npm run lint
cd mcp-server && deno test --allow-net --allow-env --allow-read
cd ..
npx jest __tests__/mcpOneTwoOneC __tests__/mcpOneTwoOneB __tests__/uxOneOneFiveA
npm test
```

All exit 0.

---

## 9. Smoke plan (post-merge; operator-run)

Audit file:
`docs/audits/MCP-SERVER-003-FAMILY-B-SMOKE-2026-05-27.md`

8 phases:

### Phase 1 — Pre-flight

* HEAD at merge SHA.
* Hosted server ACTIVE.
* Edge Functions ACTIVE.
* `disagreement_axis` now supported at the MCP layer; advertised
  per tool description text where appropriate.

### Phase 2 — Local server smoke

* `cd mcp-server && deno test --allow-net --allow-env --allow-read`
  → 0 / all pass.
* Family A still passes locally.
* Family B local fixture passes.
* C/D/E still unsupported.

### Phase 3 — Hosted MCP direct smoke

* `scripts/mcp-server-001-smoke.sh` (with Family B coverage)
  against the hosted Deno Deploy endpoint.
* Family B direct call to `/mcp/adapter-compat` with a Family B
  request.
* Response shape valid against MCP-021A.
* Expected Family B positives appear.
* Doctrine ban-list scan returns 0 in evidence spans.

### Phase 4 — Edge `admin_validation` smoke

* POST to Edge `classify-argument-boolean-observations` with
  `requestedFamilies: ['disagreement_axis']` +
  `mode: 'admin_validation'` against three seeded or designer-
  chosen fixtures.
* Run rows persisted in `machine_observation_runs` (or equivalent
  table per MCP-021B + MCP-021C).
* Positive observation rows persisted where expected.
* At least ONE real positive Family B row written.

### Phase 5 — Unsupported C/D/E regression

* POST with `requestedFamilies: ['misunderstanding_repair']` →
  status=`failed`, `failureReason=mcp_validation_failed`, no
  positives, no observation rows.
* Same for `evidence_source_chain`, `argument_scheme`.

### Phase 6 — Targeted tests

* `npx jest __tests__/mcpOneTwoOneB __tests__/mcpOneTwoOneC
  __tests__/uxOneOneFiveA` all pass.
* `cd mcp-server && deno test --allow-net --allow-env --allow-read`
  passes.

### Phase 7 — OPS observations

* Note any latency / token-usage anomalies vs Family A.
* Flag whether OPS-MCP-OBSERVABILITY card should be sequenced now
  that 2 families have live traffic.

### Phase 8 — Verdict + authorization

* **PASS criteria:**
  * Family B direct hosted smoke PASSes.
  * Family B Edge `admin_validation` smoke PASSes.
  * At least one real positive Family B row persisted.
  * All Family B rawKeys valid (14/14).
  * Evidence spans ≤ 240 chars.
  * Doctrine scan returns 0.
  * Family A remains passing.
  * C/D/E remain unsupported.
  * Tests pass.

* **PARTIAL:**
  * Server smoke passes; Edge smoke not completed.
  * No production / auto-trigger authorization granted.

* **FAIL:**
  * Family A regression.
  * C/D/E accidentally supported.
  * Doctrine violation.
  * Family B parser / schema failure.
  * Hosted smoke failure.

* **Authorization after PASS:**
  * `MCP-SERVER-004-FAMILY-C` AUTHORIZED to begin.
  * `MCP-SERVER-003-BATCH-C-D-E` remains serial.
  * `OPS-MCP-OBSERVABILITY` remains planned/considered once 2+
    families show live traffic (this PASS qualifies).
  * Do NOT enable Family B auto-trigger yet unless a separate card
    does it.

---

## 10. OPS observation plan

Hooks the designer should plumb (no production change; observation
only):

* Family-tagged logging at the MCP-server tool handler — emit `tool`
  + `family` + `status` + `httpStatus` in the `log(...)` calls.
* Family-tagged logging at the Edge Function adapter — emit
  `requestedFamilies` count + first element in the run-tracking row
  metadata.
* Optional: per-family latency histogram exposed via
  `tools/observability` route (out of scope for this card; flag if
  designer thinks it's overdue).

These hooks set up `OPS-MCP-OBSERVABILITY` (next card after Family
B PASS).

---

## 11. Authorization

After Family B PR merges and the 8-phase smoke PASSes:

* **MCP-SERVER-003-FAMILY-B: PASS**
* **MCP-SERVER-004-FAMILY-C: AUTHORIZED to begin**
* `MCP-SERVER-003-BATCH-C-D-E` remains serial; each future family
  is a separate card with its own design + intent + smoke.
* Family B operational status: hosted MCP and Edge
  `admin_validation` only; **no production auto-trigger** until a
  separate card enables it.

If smoke FAILs, file `MCP-SERVER-003-FAMILY-B-FIX` and do NOT
begin Family C until stable.
