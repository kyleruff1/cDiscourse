# MCP-SERVER-004-FAMILY-C — Intent Brief

**Card:** MCP-SERVER-004-FAMILY-C — Misunderstanding Repair Boolean
Observation Classifier (`misunderstanding_repair`).

**Goal:** ship Family C on the MCP server using the shared validator
registry proven by `OPS-MCP-FAMILY-VALIDATOR-REFACTOR` (`21f1b0b`)
and twice-exercised by `MCP-SERVER-002` (Family A,
`27bb837`/`fc28605`) and `MCP-SERVER-003-FAMILY-B`
(`ebbe389`/`05b42c3`). Then smoke through hosted MCP and Edge
`admin_validation`. Second family in the serial B/C/D/E batch.

**This card is:**

* Family C only. `misunderstanding_repair`. 17 rawKeys.
* Server-side classifier + Edge `admin_validation` exposure.
* `mcp-server-001-smoke.sh` extended with +2 Family C checks
  (final tally 13).
* `admin_validation`-only on the Edge Function. Production-mode
  enablement is deferred (separate card:
  `MCP-021C-EDGE-FAMILY-C-ENABLE`).

**This card is NOT:**

* A Family D / E / F / G / H / I / J card.
* A taxonomy-key change. The 17 keys come verbatim from MCP-021A
  source (`src/features/nodeLabels/machineObservationDefinitions/familyC.ts`).
* A Family C auto-trigger card. `MCP-021C-AUTO-TRIGGER` remains
  Family A only.
* A UI / display-cap / persistence-schema / Source-6-rendering
  change.
* A schema-version change.
  `mcp-021.machine-observations.boolean.v1` stays.
* A `familyAPrompt.ts` / `familyAAnthropic.ts` /
  `familyABanListScan.ts` change.
* A `familyBPrompt.ts` / `familyBAnthropic.ts` /
  `familyBBanListScan.ts` change.
* A change to `mcp_validation_failed` envelope behavior for
  unsupported D / E / F / G / H / I / J families.

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
MCP-SERVER-003-FAMILY-B  shipped:                  ebbe389 (PR #317)
MCP-SERVER-003-FAMILY-B-SMOKE  PASS:               05b42c3
Current HEAD must be:                              05b42c3 or later
```

If `05b42c3` is missing from main, HALT.

---

## 2. What's already proven (do NOT re-prove)

The Family B PASS smoke at `05b42c3` confirmed:

* The shared validator registry pattern works for adding a second
  family (Family B registered cleanly via
  `registerFamily('disagreement_axis', ...)` in
  `familyRegistryInit.ts`).
* Two families can register additively. Family A behavior remains
  byte-equal end-to-end after Family B registration.
* Hosted MCP server auto-deploys per main commit; Family B
  reached production with no manual deploy step.
* Edge Function `admin_validation` chain works for new families
  via `mcp_validation_failed → success` transition path.
* `unsupported_family` rejection envelope reports dynamic
  `supportedFamilies` via `getSupportedFamilies()` (returns
  `['parent_relation', 'disagreement_axis']` post-Family B; will
  return `['parent_relation', 'disagreement_axis',
  'misunderstanding_repair']` post-Family C).

Family C implementation = one
`registerFamily('misunderstanding_repair', ...)` call in
`familyRegistryInit.ts` + Family-C-specific keys, prompt, ban-list
scan, fixture provider, Anthropic provider, fixtures, tests, smoke
checks, dispatcher routing, and the Edge `familyRegistry` entry.

---

## 3. Family C raw key list (binding; verbatim from MCP-021A source)

Source: `src/features/nodeLabels/machineObservationDefinitions/familyC.ts`.
Verified by Phase 0 grep: 17 rawKey declarations, declaration order:

1. `clarified` (RETROACTIVE; **lifecycle** source — special handling)
2. `requests_clarification` (RETROACTIVE; ai_classifier)
3. `answers_clarification` (RETROACTIVE; ai_classifier)
4. `provides_alternate_interpretation` (RETROACTIVE; ai_classifier)
5. `offers_candidate_understanding` (NEW; ai_classifier; **HIGH-SIGNAL grounding move per Clark & Brennan**)
6. `confirms_understanding` (NEW; ai_classifier)
7. `rejects_candidate_understanding` (NEW; ai_classifier; **DOCTRINE RISK** — must NOT be framed as wrong/bad)
8. `requests_restatement` (NEW; ai_classifier)
9. `self_initiates_self_repair` (NEW; ai_classifier)
10. `other_initiates_repair` (NEW; ai_classifier)
11. `acknowledges_misread` (NEW; ai_classifier; **DOCTRINE RISK** — must NOT frame author as having failed)
12. `flags_ambiguous_reference` (NEW; ai_classifier)
13. `flags_term_ambiguity` (NEW; ai_classifier)
14. `proposes_shared_definition` (NEW; ai_classifier)
15. `confirms_shared_definition` (NEW; ai_classifier)
16. `scope_mismatch_identified` (NEW; ai_classifier)
17. `question_answer_mismatch` (NEW; ai_classifier)

Family C implementation MUST mirror this list exactly. Drift fails
the parity test and HALT trigger #3.

`classifierSetVersion` for Family C: `'family-c-v1'` (mirrors the
Family A `'family-a-v1'` / Family B `'family-b-v1'` pattern).

**Source-provenance note:** Family C contains 1 `lifecycle` key
(`clarified`) and 16 `ai_classifier` keys. Per Family A precedent
(the `awaiting_*` lifecycle handling), the `clarified` key is
tree/cluster-dependent. The Family C prompt MUST include Family A's
"answer FALSE with low confidence when you only see the move text
(not the cluster lifecycle)" guidance for `clarified`. All 17 keys
are classifier-routed at the MCP layer for v1; subset filtering
(routing some keys out of the prompt) is a Family D problem, not
Family C.

---

## 4. Family C doctrine framing (per Decision 2)

Family C encodes the Schegloff/Sacks repair model and Clark &
Brennan grounding doctrine. The Family C prompt MUST:

### 4.1 Frame repair as **collaborative grounding**, not error-correction

* `rejects_candidate_understanding` is a *normal grounding signal*.
  The rejector is saying "that's not what I meant," not "you're
  wrong." Repair-positive, never adversarial. Symmetric to
  `confirms_understanding`.
* `acknowledges_misread` is *constructive*. Acknowledging prior
  misread is repair work, not an admission of failure. Earns
  engagement credit per `point-standing-economy`.
* `flags_term_ambiguity` is *engagement-positive*. Flagging
  ambiguity opens shared understanding; never accuses the parent
  author of lazy writing.
* `scope_mismatch_identified` is *descriptive*. The two arguments
  may be operating at different scopes — that's a structural fact,
  not a fault on either side.
* `requests_clarification` / `requests_restatement` are
  *non-adversarial*. The move asks for shared ground; it does NOT
  imply the parent was unclear or wrong.

### 4.2 Cross-key doctrine constraint

All 17 misunderstanding-repair outputs must remain **descriptive
structural facts** (per cdiscourse-doctrine §10a), never verdictive
judgments about who was confused, unclear, or wrong. The prompt's
system block MUST mirror Family A's 7 absolute rules verbatim, then
add repair-as-collaborative-grounding framing that preserves
descriptive posture and the Schegloff/Sacks / Clark & Brennan
grounding lineage.

### 4.3 Tree-dependency caveat for `clarified`

The `clarified` lifecycle key requires cluster-level context (a
clarification request followed by a clarifying response). When the
classifier sees only the move text and not the cluster, it MUST
answer FALSE with low confidence. Family A's `awaiting_*` lifecycle
handling is the precedent.

---

## 5. Strict scope

**ALLOWED:**

* Add `mcp-server/lib/familyCKeys.ts` (binding 17-rawKey constant +
  classifier-set-version + per-key prompt entries).
* Add `mcp-server/lib/familyCPrompt.ts` (Family C system + user
  prompt; collaborative-grounding doctrine framing).
* Add `mcp-server/lib/familyCAnthropic.ts` (Family C Anthropic
  call) OR reuse a shared generic wrapper if the designer chooses
  reuse and the test plan covers parity (Family B's choice).
* Add `mcp-server/lib/familyCBanListScan.ts` (Family C response
  doctrine ban-list scan) OR reuse a shared family ban-list wrapper
  if the designer chooses reuse with parity tests.
* Add `mcp-server/lib/familyCFixtureProvider.ts` for fixture-mode
  Family C responses.
* Add Family C fixtures under `mcp-server/fixtures/` (5 minimum per
  Decision 3).
* Add Family C tests under `mcp-server/tests/`.
* Edit `mcp-server/lib/familyRegistryInit.ts` to register
  `misunderstanding_repair`.
* Edit `mcp-server/tools/classifyArgumentBooleanObservations.ts` to
  route Family C requests to the new handler.
* Edit `mcp-server/lib/familyBooleanRequestSchema.ts` and
  `mcp-server/tests/familyBooleanRequestSchema.test.ts` ONLY as
  necessary to surface Family C through the shared validator
  (additive changes only).
* Edit `mcp-server/tests/familyRegistry.test.ts` to assert Family C
  registration.
* Edit `mcp-server-001-smoke.sh` to add Family C coverage (+2 checks).
* Edit `supabase/functions/_shared/booleanObservations/familyRegistry.ts`
  to add the `misunderstanding_repair` entry (additive;
  `adminValidationEnabled: true`, `productionEnabled: false`).
* Add a small Jest test for the Edge `familyRegistry` Family C entry
  under `__tests__/`.
* Update `docs/core/current-status.md` handoff section.
* Add `docs/audits/MCP-SERVER-004-FAMILY-C-SMOKE-template.md`.

**DISALLOWED:**

* Family D / E / F / G / H / I / J key registration.
  `familyRegistryInit.ts` registers exactly `parent_relation` +
  `disagreement_axis` + `misunderstanding_repair` after this card.
* MCP-021A source-file changes (`src/features/nodeLabels/**`).
* Schema version changes
  (`mcp-021.machine-observations.boolean.v1` stays).
* Family A prompt / Anthropic / ban-list-scan changes
  (`familyAPrompt.ts`, `familyAAnthropic.ts`,
  `familyABanListScan.ts`, `familyAKeys.ts` untouched
  byte-identical).
* Family B prompt / Anthropic / ban-list-scan changes
  (`familyBPrompt.ts`, `familyBAnthropic.ts`,
  `familyBBanListScan.ts`, `familyBKeys.ts` untouched
  byte-identical).
* Edge Function `classify-argument-boolean-observations/index.ts`
  changes (handler routes by family registry; no per-family
  handler change required for C).
* Production auto-trigger for Family C (`MCP-021C-AUTO-TRIGGER`
  remains Family A only; Family C `productionEnabled: false`).
* Source 6 rendering changes
  (`src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
  remains byte-equal; no Family C production rows written this card).
* UI / display-cap / persistence schema / migration changes.
* Client-side MCP call (HALT #10).
* Secret exposure in logs (HALT #11/#12).
* Raw keys in user-facing copy (HALT #20).
* Verdict / winner / correctness / fallacy / bad-faith language in
  model-facing or user-facing copy (HALT #19, except
  doctrine-negation tests).
* MAX_TOKENS envelope change unless designer Phase A.2 documents
  the token-budget reason in writing (HALT #15 triggers if a
  silent bump appears).

---

## 6. Conditional HALT triggers (22)

### Registry + refactor integrity (1-6)

1. `OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE` audit PASS missing
   from main.
2. `MCP-SERVER-003-FAMILY-B-SMOKE` audit PASS missing from main.
3. Family C raw key list differs from MCP-021A source
   (`src/features/nodeLabels/machineObservationDefinitions/familyC.ts`).
4. Any Family D / E registration proposed in this card.
5. Family A or Family B behavior changes proposed (not byte-equal).
6. `unsupported_family` behavior for D / E / F / G / H / I / J
   changes.

### Protocol + security (7-12)

7. Proposes new taxonomy keys.
8. Proposes MCP schema version change.
9. Proposes Family A or Family B prompt changes.
10. Proposes client-side MCP call (no `src/` changes).
11. Proposes exposing MCP bearer / Anthropic / service-role keys.
12. Logs raw argument body, raw prompt, raw model response, bearer
    token, or API key.

### Architecture (13-16)

13. Hosted smoke fails (runtime; re-evaluated post-implementer).
14. Family C requires schema mirror change (compound-key collision;
    if surfaces, HALT — that's Family D's problem, not C's).
15. Family C requires MAX_TOKENS bump (would suggest the 17-key
    prompt doesn't fit Family A's existing token envelope;
    investigate before proceeding).
16. Test forecast exceeds +300 without rationale (family-ship
    cards target +60 to +100; Family B was +98).

### Doctrine (17-21)

17. Prompt frames repair as "correct" vs "incorrect" understanding
    (repair is collaborative; no verdict territory).
18. Prompt treats `rejects_candidate_understanding` as negative
    (it's a normal grounding move; should be framed neutrally).
19. Verdict / winner / correctness / fallacy / bad-faith tokens in
    user-facing strings (except negation form).
20. Raw keys appear in user-facing copy (prompts are model-facing
    only).
21. Prompt implies misunderstanding is a failure on either side
    (Clark & Brennan grounding model: repair is shared work).

### Working tree (22)

22. Unclassified untracked files at PR creation
    (operator-territory `docs/testing-runs/`,
    `mcp021c-edge-smoke-*`, `netlify-prod.git`,
    `phase5-mcpserver002-*` are KNOWN exclusions).

Any ONE fires HALT. Stage 2A surfaces and waits for operator
review.

---

## 7. Required designer Phase A audits (A.1-A.6)

### A.1 — Family C source verification

* Open `src/features/nodeLabels/machineObservationDefinitions/familyC.ts`.
* Enumerate all rawKey entries.
* Confirm 17 total (4 retroactive + 13 new per inspection report).
* Verify each rawKey matches the §3 verbatim list.
* Document any deviation (and HALT if structural).

### A.2 — Prompt architecture

* Mirror Family A/B 7 absolute rules verbatim.
* Frame repair as collaborative grounding (§4).
* Frame all 17 keys with neutral, descriptive language.
* `clarified` requires the "answer FALSE with low confidence when
  you only see the move text (not the cluster)" guard (Family A's
  `awaiting_*` lifecycle precedent).
* Doctrine ban-list scan covers all repair-specific failure modes.
* Token budget: confirm 17 keys fit within MAX_TOKENS=1500
  envelope (Family A=16 keys; Family B=14; Family C=17 — closest
  test of the envelope yet). If tight, document headroom; HALT if
  estimate exceeds MAX_TOKENS.

### A.3 — Fixture design

* 5 fixtures (per Decision 3):
  - `family-c-canonical-request.json` (mixed-positive baseline)
  - `family-c-clarification-cycle-request.json` (covers
    `requests_clarification` + `answers_clarification`)
  - `family-c-candidate-understanding-request.json` (covers
    `offers_candidate_understanding` + `confirms_understanding` OR
    `rejects_candidate_understanding`)
  - `family-c-shared-definition-request.json` (covers
    `proposes_shared_definition` + `confirms_shared_definition`)
  - `family-c-no-repair-request.json` (no Family C positives;
    proves the classifier doesn't over-fire on adversarial Family
    B-style content)
* Each fixture: parent + child argument text + expected-positive
  key set.
* Document expected positives per fixture.
* Use real-text examples from seeded debates if possible (parallel
  to Family B's approach).

### A.4 — Doctrine scan strategy

* Mechanical copy of `familyBBanListScan.ts` →
  `familyCBanListScan.ts` (or reuse the shared family ban-list
  wrapper Family B established).
* No new banned tokens beyond Family A/B baseline.
* Add Family C-specific doctrine assertions in tests:
  - "no repair-as-failure framing"
  - "no error-correction framing"
  - "no candidate-understanding-rejection-as-wrong framing"
  - "no misunderstanding-as-author-fault framing"

### A.5 — Test plan

* Forecast test delta: **+60 to +100** (HALT at +300).
* Enumerate suite names:
  - `mcp-server/tests/familyCKeysParity.test.ts` (length === 17;
    matches MCP-021A source)
  - `mcp-server/tests/familyCFixtureParity.test.ts` (5 fixtures)
  - `mcp-server/tests/familyCPromptDoctrine.test.ts` (ban-list
    scan + repair-positive framing assertions)
  - `mcp-server/tests/familyCRequestValidation.test.ts` (registry
    route + raw-key validation)
  - `mcp-server/tests/familyCAnthropicShape.test.ts` (response
    parser)
  - `mcp-server/tests/familyRegistry.test.ts` (UPDATE: add C
    registration assertion)
  - `mcp-server/tests/familyBooleanRequestSchema.test.ts` (UPDATE:
    add C support assertion)
  - Jest side: 1-2 small parity tests for the Family C registry
    entry in Edge Function `familyRegistry.ts`.

### A.6 — Smoke plan

* 8-phase smoke matching Family B's pattern.
* Phase 3 hosted smoke: 13 checks (11 from B + 2 new C checks).
* Phase 4 Edge `admin_validation`: Family C against 3 seeded args
  (the same `f41b18b0…`, `781f8057…`, `db0de3e0…` set used for
  Family B's smoke).
* Phase 5: unsupported D / E / F / G / H / I / J rejection
  regression.
* Per Decision 9, **0 Family C positives across all 3 seeded args
  is an acceptable PARTIAL outcome** — the seeded args weren't
  designed for repair patterns; classifier silence on
  non-repair-targeted text is valid.

---

## 8. Test plan

Test forecast: **+60 to +100** new tests (HALT at +300). Target
range mirrors Family B (which was +98).

Required test categories (verbatim from designer charter):

* **Family C key parity against MCP-021A source** — re-uses the
  `familyBKeysParity.test.ts` pattern; reads both
  `mcp-server/lib/familyCKeys.ts` AND
  `src/features/nodeLabels/machineObservationDefinitions/familyC.ts`
  as source text; asserts the 17 binding rawKeys appear in both.
* **Registry registration of `misunderstanding_repair`** — extends
  `familyRegistry.test.ts` expectations: `getSupportedFamilies()`
  returns `['parent_relation', 'disagreement_axis',
  'misunderstanding_repair']` (in registration order);
  `isFamilySupported('misunderstanding_repair')` true.
* **Family C request validation** — valid Family C request shape
  passes; invalid rawKey (not in 17-key set) rejected with
  `unsupported_rawKey`.
* **Family C unsupported rawKey rejection** — request with a Family
  A or Family B rawKey under
  `requestedFamilies: ['misunderstanding_repair']` → rejected.
* **D/E/F/G/H/I/J unsupported-family rejection still works** —
  `requestedFamilies: ['evidence_source_chain']` →
  `unsupported_family`; same for each of D / E / F / G / H / I / J.
* **Family A canonical request still works** — bullet-proof
  regression: full 16-key Family A request still validates +
  routes correctly.
* **Family B canonical request still works** — bullet-proof
  regression: full 14-key Family B request still validates +
  routes correctly.
* **Family C fixture provider returns valid shape** — every Family
  C fixture loadable + parses against MCP-021A wire shape.
* **Family C Anthropic response parser validation** — mock
  Anthropic response with 17 Family C rawKeys → adapter returns
  validated `McpBooleanObservationResponse`.
* **Family C doctrine ban-list scan** — fixture response with a
  smuggled verdict / failure / wrong-framing token in
  `evidenceSpan` → ban-list scan rejects.
* **Family C `rejects_candidate_understanding` no-wrong-framing
  fixture** — positive must NOT imply the rejected candidate is
  "wrong"; ban-list scan + plain-text inspection asserts.
* **Family C `acknowledges_misread` no-author-fault fixture** —
  positive must NOT frame the misread as a failure of the
  original author; ban-list scan + plain-text inspection asserts.
* **Family C `flags_term_ambiguity` no-accusation fixture** —
  positive must NOT accuse the parent author of writing
  ambiguously.
* **tools/list does not misrepresent unsupported D/E/F/G/H/I/J** —
  tool description text mentions Family A / B / C; does NOT
  advertise D-J.
* **Hosted smoke script supports Family C** —
  `mcp-server-001-smoke.sh` emits PASS lines for
  `*-boolean-family-c` checks (12 and 13).
* **No client secrets** — defensive grep over diff.
* **No raw keys in user-facing output** — defensive scan; the
  validator and ban-list strip rawKeys from any user-bound string.
* **Edge `familyRegistry` Family C entry** — Jest test asserts
  `misunderstanding_repair` registered with
  `adminValidationEnabled: true`, `productionEnabled: false`.

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
`docs/audits/MCP-SERVER-004-FAMILY-C-SMOKE-<date>.md`

8 phases:

### Phase 1 — Pre-flight

* HEAD at merge SHA.
* Hosted MCP server ACTIVE; auto-deployed.
* Both Edge Functions ACTIVE.
* DB `config` provider_mode=mcp, enabled=true.

### Phase 2 — Local Deno regression

```
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

Expected: **403-443 / 0** (343 baseline + ~60-100 new Family C
tests). Family A still passes. Family B still passes.

### Phase 3 — Hosted MCP server smoke (13 checks; OPERATOR-RUN)

This phase requires `MCP_HOSTED_TOKEN` (operator-territory).
Operator pattern from prior smokes:

```
bash mcp-server/scripts/mcp-server-001-smoke.sh
```

Expected output:

```
HOSTED SMOKE EXIT: 0
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
PASS [12-compat-boolean-family-c]
PASS [13-mcp-tools-call-boolean-family-c]
MCP-SERVER-001 smoke: 13 PASSES, 0 FAILS
EXIT: 0
```

OPERATOR HALT: Phase 3 requires operator action (token). Standard
pattern from prior smokes. After operator pastes redacted PASS
output, continue to Phase 4.

### Phase 4 — Edge `admin_validation` smoke (Family C)

Acquire bot JWT (env-backed, per prior smokes).

Build Family C `admin_validation` payload:

```json
{
  "argumentIds": [
    "f41b18b0-8ad6-4865-94c5-17a568f6a6ad",
    "781f8057-9e2a-4fa9-92a8-469676950ff7",
    "db0de3e0-24c6-40af-ba5f-2844acfa5bac"
  ],
  "requestedFamilies": ["misunderstanding_repair"],
  "mode": "admin_validation",
  "schemaVersion": "mcp-021.machine-observations.boolean.v1"
}
```

POST to `classify-argument-boolean-observations`.

Expected:

* HTTP 200.
* 3 `perArgument` entries.
* All `status=success`.
* `positiveObservationCount >= 0` (Family C may have 0 positives
  on these args; document either way per Decision 9).
* `raw_keys ∈ Family C 17-key set`.
* No `mcp_validation_failed` envelope.

### Phase 5 — Unsupported D/E/F/G/H/I/J rejection regression

POST to `classify-argument-boolean-observations` with
`requestedFamilies=['evidence_source_chain']` (Family D).

Expected:

* HTTP 200; status=`failed`; `failureReason=mcp_validation_failed`;
  0 positives; no Family A/B/C leak.

Repeat for E (`argument_scheme`), F, G, H, I, J. Each should
reject.

### Phase 6 — Targeted regression suites

```
npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA)"
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

Expected: all exits 0.

### Phase 7 — OPS observations

* 3 families now operational on hosted MCP server.
  - Family A: production + auto-trigger live.
  - Family B: `admin_validation` only.
  - Family C: `admin_validation` only.
* `OPS-MCP-OBSERVABILITY` priority: STRONGLY RECOMMENDED as next
  OPS card (3 families is the threshold where ad-hoc SQL
  inspection becomes painful).

### Phase 8 — Verdict + authorization

* **PASS criteria:**
  * Phases 1-2 clean.
  * Phase 3 = 13/13.
  * Phase 4 = HTTP 200, valid Family C response shape, raw_keys ⊆
    Family C 17-key set.
  * Phase 5 = all unsupported families correctly rejected.
  * Phase 6 = all regressions pass.

* **PARTIAL:**
  * Phase 4 returns 0 positives across all 3 args (acceptable;
    repair signals are sparse on non-repair-targeted text;
    document but doesn't fail smoke per Decision 9).
  * Phase 6 single-suite regression independent of Family C.

* **FAIL:**
  * Phase 3 < 13 checks pass.
  * Phase 4 returns non-Family-C raw_keys (taxonomy violation).
  * Phase 5 any unsupported family accepted (security adjacent).
  * Phase 6 broad regression (Family A or B byte-equal failure).

* **Authorization after PASS:**
  * `MCP-SERVER-004-FAMILY-C-SMOKE: PASS`.
  * Family C `admin_validation` OPERATIONAL.
  * `MCP-SERVER-005-FAMILY-D` AUTHORIZED to begin — with
    **mandatory Stage-2B operator-decision checkpoint** for the
    ai_classifier subset filter decision (per inspection report;
    Family D is the design-heavy family with compound-key
    collision question).
  * `OPS-MCP-OBSERVABILITY` STRONGLY RECOMMENDED to ship before D
    (3 families now operational; ad-hoc inspection getting
    painful).

* **If PARTIAL:**
  * File scoped fix card.
  * Do NOT begin Family D until smoke clean.

* **If FAIL:**
  * File `MCP-SERVER-004-FAMILY-C-FIX`.
  * Do NOT begin Family D until refactor stable.
  * Consider revert if Family A or B regression detected.

---

## 10. Brief ledger

| Item | Status |
|---|---|
| Pre-flight PASS (HEAD `05b42c3`; family source 17 keys; predecessor audits present; Deno baseline 343/0) | ✓ |
| Intent brief authored | this file |
| Feature branch | `feat/MCP-SERVER-004-FAMILY-C` |
| Stage 1 designer subagent | next |
| Stage 2 conditional HALT eval | after designer |
| Stage 3 implementer subagent | conditional |
| Stage 4 reviewer subagent | conditional |
| Stage 5 PR + squash-merge + post-merge gates | conditional |
| Post-merge 8-phase smoke audit | operator action |

---

## 11. Authorization

After Family C PR merges and the 8-phase smoke PASSes:

* **MCP-SERVER-004-FAMILY-C: PASS**
* **MCP-SERVER-005-FAMILY-D: AUTHORIZED to begin** — with
  mandatory Stage-2B operator-decision checkpoint for the
  ai_classifier subset filter decision.
* `OPS-MCP-OBSERVABILITY` STRONGLY RECOMMENDED before D.
* Family C operational status: hosted MCP and Edge
  `admin_validation` only; **no production auto-trigger** until a
  separate card enables it (`MCP-021C-EDGE-FAMILY-C-ENABLE`).

If smoke FAILs, file `MCP-SERVER-004-FAMILY-C-FIX` and do NOT
begin Family D until stable.
