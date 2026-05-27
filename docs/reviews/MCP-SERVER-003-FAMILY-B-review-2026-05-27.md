# MCP-SERVER-003-FAMILY-B — Review

**Verdict:** **APPROVE**
**Reviewer agent run:** 2026-05-27
**Branch:** `feat/MCP-SERVER-003-FAMILY-B`
**Predecessor on main:** `21f1b0b` (OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE PASS)
**Head commit:** `5433441`
**Implementer commits (6):** `2e3b999` (keys+entries+parity), `7211440`
(prompt+ban-list+doctrine tests), `76543f6` (Anthropic+fixtures+doctrine
fixtures), `91d69c6` (registry registration+dispatcher routing),
`06d7718` (smoke script extension), `5433441` (handoff).
**Design:** `docs/designs/MCP-SERVER-003-FAMILY-B.md`
**Intent brief:** `docs/designs/MCP-SERVER-003-FAMILY-B-intent.md`
**Issue:** https://github.com/kyleruff/debate-constitution-app/issues/316

---

## 1. Summary

MCP-SERVER-003-FAMILY-B promotes Family B (`disagreement_axis`, 14
rawKeys) from "registry-rejected" to a real classifier on the MCP
server. The 14 raw keys mirror the upstream MCP-021A source byte-equal
in declaration order. The dispatcher routes per-family to (Anthropic,
fixture, ban-list-scan) provider tables; Family A's path is byte-equal
preserved via the same provider-table entry the pre-refactor code held.
The shared validator registry pattern from OPS-MCP-FAMILY-VALIDATOR-
REFACTOR is consumed correctly — registration is one additive call in
`familyRegistryInit.ts` with no new per-family validator file. The
prompt mirrors Family A's 7 absolute rules verbatim and adds
disagreement-axis-specific descriptive framing ("Disagreement is
productive and structural; both sides remain valid contributions to the
debate"). The two doctrine-risk rawKeys (`disputes_value_weighting`
and `disputes_relevance`) carry their MCP-021A `falsePositiveGuards`
verbatim — "copy MUST NOT imply one value is 'right'" and "relevance
dispute requires a reason" — and are covered by a doctrine-stress
fixture pair (verdictive-move trap + pure-dismissal false-positive
guard).

The hosted smoke script gains 2 new checks (10 + 11) matching design
§9 verbatim; final tally bumps from `9 PASSES, 0 FAILS` to
`11 PASSES, 0 FAILS`. C/D/E remain unsupported; the dispatcher rejects
them with `unsupported_family` (tests cover `misunderstanding_repair`,
`evidence_source_chain`, `argument_scheme`).

**One notable evolution to call out explicitly (Item 4 / HALT #9):**
the `unsupported_family` envelope's `supportedFamilies` field changed
from a hardcoded `['parent_relation']` literal to a dynamic
`getSupportedFamilies()` call (which now returns
`['parent_relation', 'disagreement_axis']`). REJECTION behavior for
C/D/E is unchanged (still `isError: true`, still `reason:
'unsupported_family'`, still `failureReason: 'mcp_validation_failed'`
at the Edge mapping layer). The metadata field is purely informational
and is never consumed by the Edge adapter (verified by Grep — zero hits
on `supportedFamilies` in `supabase/functions/`). This is intentional
multi-family evolution, not a HALT #9 violation: HALT #9 governs C/D/E
*behavior*, not the truthfulness of the server's "what is supported"
metadata. The previous static answer would have been a lie post-Family-B
registration. The test at
`classifyArgumentBooleanObservations.test.ts:144` explicitly asserts
the new value.

Verification: Deno tests **343 / 0 failed** (orchestrator-verified;
within design forecast +80 to +110 — actual +107). Typecheck clean.
Lint clean. Targeted Jest sweep on MCP-021B/C + UX-001.5A: 40 suites /
926 tests PASS. Doctrine + secret scans clean.

Orchestrator: clear to push branch + open PR + run post-merge 8-phase
smoke per intent brief §9.

---

## 2. 20-item verdict matrix

| # | Item | Verdict | Justification |
|---|------|---------|---------------|
| 1 | Family B only | PASS | `familyRegistryInit.ts:48-61` registers exactly `parent_relation` + `disagreement_axis`. No `familyCKeys.ts` / `familyDKeys.ts` / `familyEKeys.ts` exist. |
| 2 | B raw key list exact | PASS | `familyBKeys.ts:53-68` lists all 14 rawKeys verbatim in declaration order matching upstream `src/features/nodeLabels/machineObservationDefinitions/familyB.ts` (lines 40, 82, 132, 172, 213, 253, 293, 333, 373, 413, 453, 493, 532, 572). `familyBKeysParity.test.ts` enforces bidirectional parity. |
| 3 | Family A preserved | PASS | `git diff main..HEAD -- mcp-server/lib/familyA*.ts` returns empty — `familyAKeys.ts`, `familyAPrompt.ts`, `familyAAnthropic.ts`, `familyABanListScan.ts`, `familyAFixtureProvider.ts` are byte-identical. Dispatcher's `pickFamilyProviders('parent_relation')` returns the same provider table the pre-refactor code held (`runAnthropicFamilyAClassifier` + `loadFixtureFamilyAPacket` + `scanFamilyABooleanResponseForBanList`). Family A regression test in `familyBDispatch.test.ts:103-116` asserts `classifierSetVersion === 'family-a-v1'` for Family A requests. |
| 4 | C/D/E unsupported | PASS (with note) | `familyBDispatch.test.ts:179-230` covers Family C (`misunderstanding_repair`), D (`evidence_source_chain`), E (`argument_scheme`) — all return `reason: 'unsupported_family'` + `isError: true`. The `supportedFamilies` envelope field is now dynamic (`getSupportedFamilies()` → `['parent_relation', 'disagreement_axis']`) instead of hardcoded `['parent_relation']`. Evaluated against HALT #9: this is intentional multi-family-evolution metadata, NOT a behavior change for C/D/E. The Edge adapter does NOT read `supportedFamilies` (verified Grep on `supabase/functions/` returns zero matches), so downstream behavior is unchanged. Test at `classifyArgumentBooleanObservations.test.ts:144` asserts the new value explicitly. **Acceptable.** |
| 5 | Shared validator registry used correctly | PASS | `familyRegistryInit.ts:52-60` registers via `register('disagreement_axis', { rawKeys: new Set(FAMILY_B_RAW_KEYS), classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION })`. Tests in `familyRegistryInit.test.ts:30-74` verify `isFamilySupported('disagreement_axis') === true`, `getSupportedFamilies() === ['parent_relation', 'disagreement_axis']` in insertion order, `getRawKeysForFamily('disagreement_axis').size === 14`, `getClassifierSetVersion('disagreement_axis') === 'family-b-v1'`, idempotency. |
| 6 | No duplicated validator file pattern | PASS | `git diff main..HEAD --name-only -- mcp-server/lib/` shows no `familyBBooleanRequestSchema.ts`. Shared validator at `familyBooleanRequestSchema.ts` is reused unchanged (design §7.2). The OPS refactor invariant — no per-family validator duplication — holds. |
| 7 | Prompt descriptive / not verdictive | PASS | `FAMILY_B_SYSTEM_PROMPT` at `familyBPrompt.ts:62-92` contains the 7 absolute rules byte-equal to Family A's at `familyAPrompt.ts:51-57`. `familyBPrompt.test.ts:55-73` enforces this byte-equality. Banned verdict tokens appear in the system prompt only in `You do NOT ...` negation form; the user prompt scan in `familyBPrompt.test.ts:289-339` walks every banned token, rejects any line lacking a `NOT decide` / `NOT treat` / `MUST NOT` / ` NOT ` marker. Conservative-positives bias is explicit. Umbrella/subtype relationship is explained in the user prompt's "Note about disagreement_present and the 13 disagreement sub-axes" block. |
| 8 | Value weighting doctrine safe | PASS | `familyBKeys.ts:200-201` (the `disputes_value_weighting` entry's `falsePositiveGuards` field) contains the verbatim binding "Doctrine note: copy MUST NOT imply one value is 'right'. The disagreement is genuine; both values are real." `familyBPrompt.test.ts:241-250` enforces this verbatim. The value-weighting fixture's currentText ("Efficiency is a real value, but equity of access matters more here") frames the dispute structurally; `familyBDoctrineFixtures.test.ts:122-141` enforces no "correct" framing and "real value" framing. Canonical fixture's `disputes_value_weighting` is FALSE; ban-list fixture's `disputes_value_weighting: true` evidenceSpan `"anyone who disagrees is a propagandist"` is correctly rejected at `evidenceSpan.disputes_value_weighting`. |
| 9 | Relevance doctrine safe | PASS | `familyBKeys.ts:312-313` (the `disputes_relevance` entry's `falsePositiveGuards`) contains the verbatim binding "Do NOT mark TRUE for dismissive moves with no argument; relevance dispute requires a reason." `familyBPrompt.test.ts:252-261` enforces this verbatim. Two paired fixtures cover the boundary: `family-b-relevance-with-reason-request.json` (currentText explains WHY the parent is tangential: "that question is about value-of-service, not construction emissions") + `family-b-relevance-no-reason-request.json` (currentText is just "Irrelevant."). `familyBDoctrineFixtures.test.ts:87-120` asserts the fixture-shape encoding. |
| 10 | Evidence spans bounded | PASS | `MAX_EVIDENCE_SPAN_CHARS = 240` enforced by the shared `validateMcpBooleanObservationResponse` at `mcpBooleanObservationSchemaMirror.ts:209-213`. `familyBResponseValidator.test.ts:108-120` asserts rejection of >240 chars and acceptance of exactly 240 chars. Canonical fixture's longest span is 109 chars (`disagreement_present`). |
| 11 | Parser validation passes | PASS | `familyBResponseValidator.test.ts` (16 tests) exercises the shared validator against Family B response shape: happy path returns `ok: true` with parsed value; schema-version mismatch, missing observations, empty nodeId, non-boolean observation value, invalid confidence band, ban-list-fixture pass-through, etc. all yield correct `ok: false` outcomes with the expected `path`. |
| 12 | Fixture positives plausible | PASS | See §6 below for detailed plausibility judgment on canonical, multi-axis, value-weighting, relevance-with-reason, doctrine-stress fixtures. |
| 13 | Hosted smoke plan complete | PASS | `scripts/mcp-server-001-smoke.sh:309-353` adds Checks 10 + 11 (`compat-boolean-family-b` + `mcp-tools-call-boolean-family-b`) byte-equal to design §9. Final tally line is dynamic via `$PASSES` (no hardcoded "9"). Token redaction (`Token: [REDACTED]`) preserved. No new secrets introduced. |
| 14 | Edge smoke plan complete | PASS | Design §10 specifies the admin_validation request shape (`requestedFamilies: ['disagreement_axis']` + `mode: 'admin_validation'`), 3 seeded args, expected response shape (HTTP 200, perArgument with at least one positive), doctrine SQL readback (8 assertions over `argument_machine_observation_results`), run-row readback expectations. Operator-run per intent brief §9 Phase 4. |
| 15 | No UI/display changes | PASS | `git diff main..HEAD --name-only \| grep -E '^src/\|^app/\|\.tsx$'` returns empty. |
| 16 | No persistence schema changes | PASS | `git diff main..HEAD --name-only \| grep -E '^supabase/migrations/'` returns empty. |
| 17 | No client MCP call | PASS | `git diff main..HEAD --name-only \| grep '^src/'` returns empty. The production app never calls MCP; all MCP traffic flows through Edge Functions. |
| 18 | No secret exposure | PASS | Secret scan over diff shows all `ANTHROPIC_API_KEY` occurrences are either docstring/safety negations or test setup/teardown env get/set. `FAKE_KEY = 'sk-ant-fake-key-for-test-only-...'` is a test constant. `familyBAnthropic.test.ts:179-224` includes two explicit "API key NEVER appears in any log line" tests covering both success and failure paths. No `MCP_SERVER_BEARER_TOKEN` literal in the diff. Smoke script echoes `Token: [REDACTED]`. |
| 19 | Test suite pass | PASS | Reviewer independently ran `cd mcp-server && deno test --allow-net --allow-env --allow-read` — **343 passed, 0 failed**. `npm run typecheck` exit 0. `npm run lint` exit 0. Targeted Jest sweep `npx jest __tests__/mcpOneTwoOneC __tests__/mcpOneTwoOneB __tests__/uxOneOneFiveA` — 40 suites, 926 tests, 0 failed. |
| 20 | OPS observations included | PASS | `classifyArgumentBooleanObservations.ts:297, 346, 362` adds `family: resolvedFamily` to three warn-path `log(...)` calls (`boolean_observations_no_provider_for_family`, `boolean_observations_packet_invalid`, `boolean_observations_doctrine_ban_list`). The three early-rejection paths (`boolean_observations_unsupported_family`, `boolean_observations_unsupported_raw_key`, `boolean_observations_invalid_params`) correctly do NOT tag `family` because rejection happens before resolution. Per-family Anthropic-wrapper logging is deferred to `OPS-MCP-OBSERVABILITY` per design §11. |

**Totals:** 20 / 20 PASS. 0 FAIL. 0 WARN.

---

## 3. Notable diff observations

### 3.1 Dynamic `supportedFamilies` envelope (the orchestrator's flagged concern)

The reviewer's evaluation: **acceptable; intentional multi-family
evolution; NOT a HALT #9 violation.**

Previous code (`main:mcp-server/tools/classifyArgumentBooleanObservations.ts:177-184`):

```ts
return errorResult(
  'unsupported_family',
  'Family A is the only supported family in this server build',
  {
    requestedFamilies: validated.requestedFamilies,
    supportedFamilies: ['parent_relation'],
  },
);
```

New code (`HEAD:mcp-server/tools/classifyArgumentBooleanObservations.ts:243-250`):

```ts
return errorResult(
  'unsupported_family',
  'Requested family is not supported by this server build',
  {
    requestedFamilies: validated.requestedFamilies,
    supportedFamilies: getSupportedFamilies(),
  },
);
```

Three changes:

1. **Message text change.** "Family A is the only supported family in
   this server build" → "Requested family is not supported by this
   server build". The previous message was Family-A-specific and would
   have LIED post-Family-B-registration. The new message is generic and
   accurate.

2. **`supportedFamilies` field change.** Hardcoded
   `['parent_relation']` → dynamic `getSupportedFamilies()` (returns
   `['parent_relation', 'disagreement_axis']` post-init in
   registration order).

3. **Unchanged:** `reason: 'unsupported_family'`, `isError: true`,
   `requestedFamilies` echoed, `httpStatus: 200`, `failureReason`
   mapping at the Edge layer (`mcp_validation_failed`),
   `failureReason` mapping in the per-arg run row, no positives, no
   observation rows.

The Edge adapter at
`supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts:161-163`
treats the entire MCP error envelope as "not a
`McpBooleanObservationResponse`" and returns `{ kind: 'unavailable',
reason: 'validation_failed' }` regardless of the envelope's metadata
fields. `Grep supportedFamilies supabase/functions/` returns zero
matches — the field is not consumed downstream. The change therefore
has no behavior impact on the Edge → MCP → Edge round trip for C/D/E
requests; it only updates the metadata field's truthfulness to reflect
the actual registered family set.

HALT #9 reads: "`unsupported_family` behavior for C/D/E changes". The
reviewer interprets "behavior" as: does C/D/E still get rejected? does
the Edge map it to `mcp_validation_failed`? does the run row record
`status: 'failed'`? does `positiveObservationCount` remain 0? does
`rawKeysWithPositive` remain `[]`? All YES. The metadata expansion is
a truthfulness fix, not a behavior change.

**However**, the reviewer recommends the operator note this change
when running the post-merge 8-phase smoke. Phase 5 (Unsupported C/D/E
regression) should verify `status=failed` + `failureReason=
mcp_validation_failed` + `positiveObservationCount: 0` + empty
`rawKeysWithPositive`. The `supportedFamilies` envelope content is
NOT load-bearing for the PASS gate.

### 3.2 Defensive registration in test files

`familyBooleanRequestSchema.test.ts:38-43` and
`familyBFixtureParity.test.ts:35-40` defensively register Family B in
the singleton if `!isFamilySupported('disagreement_axis')`. This is
the same pattern Commit 4's design recommended for self-sufficient
test files. The pattern means tests can run in any order without
relying on module-load side effects in the production singleton. This
is good test hygiene.

### 3.3 Tool description text updated, not removed

The tool description at `classifyArgumentBooleanObservations.ts:72`
now reads "Family A (parent_relation) OR Family B (disagreement_axis)
boolean Machine Observation taxonomy". This matches the design §7
sketch verbatim. The C-J unsupported-family note is preserved
("Family C through J return an unsupported_family error envelope in
this server build"). The doctrine-token scan at
`classifyArgumentBooleanObservations.test.ts:254-269` continues to
PASS — no banned tokens in the description, no scaffold language.

### 3.4 Family B prompt umbrella/subtype note (design choice respected)

The prompt has a "Note about disagreement_present and the 13
disagreement sub-axes" block (`familyBPrompt.ts:192-201`) that
explains the umbrella semantics and instructs the model to "Answer
each independently — do not auto-cascade." This matches design §4's
binding choice: the model is the better judge of umbrella signal
even when no specific sub-axis fires; conservative-positives bias
floors false positives; no code-level cascade. Test at
`familyBPrompt.test.ts:170-178` enforces the umbrella note and the
"do not auto-cascade" instruction are present.

### 3.5 Per-key prompt entries surface MCP-021A source content

The 14 entries in `familyBKeys.ts:90-315` mirror the upstream
positiveDefinition / negativeDefinition / one positiveExample / one
negativeExample / falsePositiveGuards per design §4 + Family A
precedent. Spot-checked: the verbatim doctrine guards for
`disputes_value_weighting` (line 201) and `disputes_relevance`
(line 313) appear unchanged from upstream `familyB.ts:319-322` and
`familyB.ts:597-600`. Examples and definitions on the
`disputes_decision_criterion` entry include "cost is not the right
test here" and "wrong frame" — these are quoted-example strings from
upstream MCP-021A source (verified at upstream `familyB.ts:348`), so
the implementer is in compliance with the binding "Family B prompt
content mirrors source" rule from intent brief §3.

### 3.6 No bootstrap.ts touched (per OPS refactor recommendation)

`git diff main..HEAD -- mcp-server/bootstrap.ts` returns empty. The
intent brief §5 lock-out and design §12 read-only boundary are
respected.

### 3.7 Final tally line is dynamic

`mcp-server-001-smoke.sh` line 354 says `echo "MCP-SERVER-001 smoke:
$PASSES PASSES, $FAILS FAILS"` — variable-substituted, not hardcoded.
This means the script will report `11 PASSES, 0 FAILS` when all checks
pass post-merge.

---

## 4. Doctrine + secrets + boundary scan results

### 4.1 Secret scan

```
git diff main..HEAD -- mcp-server/ scripts/ | grep -iE \
  "ANTHROPIC_API_KEY|MCP_SERVER_BEARER_TOKEN|service_role|sk-ant-|x-api-key|Authorization:"
```

All hits accounted for:
- `mcp-server/lib/familyBAnthropic.ts:10-11` — doctrine-positive
  negation comment "ANTHROPIC_API_KEY never logged; reaches network
  via x-api-key inside callAnthropic."
- `mcp-server/tests/familyBAnthropic.test.ts:25` — `const FAKE_KEY =
  'sk-ant-fake-key-for-test-only-1234567890abcdef';` — test constant
  for the "key never leaks to logs" assertions.
- `mcp-server/tests/familyBAnthropic.test.ts:54-69` — `withFakeKey` /
  `withNoKey` test helpers (env get/set/delete).
- `mcp-server/tests/familyBAnthropic.test.ts:94` — test name string
  `runAnthropicFamilyBClassifier: key_missing when ANTHROPIC_API_KEY
  unset`.
- `scripts/mcp-server-001-smoke.sh:31` — comment unchanged from main
  describing fixture-mode vs Anthropic-key behavior.

No real secrets in the diff. **CLEAN.**

### 4.2 Doctrine token scan

```
git diff main..HEAD -- mcp-server/lib/ | grep -iE \
  '\b(winner|loser|liar|correct|wrong|fallacy|bad faith|extremist|propagandist|dishonest|manipulative)\b'
```

5 hits in production library code, all categorized:

1. `familyBKeys.ts:97` — positiveDefinition for
   `disputes_evidence_applicability`: "...wrong population, wrong
   time period, wrong setting, wrong measurement, or wrong
   inferential step." — DESCRIPTIVE structural conditions for
   applicability dispute; not a verdict on the move's author; mirrored
   verbatim from upstream `familyB.ts:50`.
2. `familyBKeys.ts:209` — positiveDefinition for
   `disputes_decision_criterion`: "'cost is not the right test here
   — feasibility is'; 'effectiveness without equity is the wrong
   frame'." — QUOTED EXAMPLE of structural disagreement language the
   model should recognize; mirrored verbatim from upstream
   `familyB.ts:348`.
3. `familyBKeys.ts:213` — positiveExample for
   `disputes_decision_criterion`: "'Cost-per-visit is the wrong
   criterion; access-equity matters more in this case.'" — QUOTED
   EXAMPLE; mirrored verbatim from upstream `familyB.ts:352`.
4. `familyBPrompt.ts:11` — docstring: "for the 7 absolute rules
   (winner / truth / popularity / person / hiding / blocking)." —
   negation-reference docstring describing what the rules cover.
5. `familyBPrompt.ts:67` — system-prompt verbatim "You do NOT decide
   the winner of any debate." — byte-equal to Family A; doctrine-
   positive negation.

The shared `DOCTRINE_BAN_PATTERNS` ban list (`doctrineBanList.ts:31-46`)
does NOT include "wrong" or "right" alone — only "winner", "loser",
"correct", "incorrect", "truth", "untrue", "dishonest", "liar",
"manipulative", "extremist", "propagandist", "stupid", "idiot",
"verdict", "bad faith", "proof of". The 5 hits do not trigger the
runtime ban-list scan. **CLEAN per intent brief HALT #14**
("Verdict / winner / correctness / fallacy / bad-faith language in
model-facing or user-facing copy except doctrine-negation tests").

### 4.3 Boundary scan

```
git diff main..HEAD --name-only \| grep -vE '^(mcp-server/|docs/|scripts/)'
```

Empty. No file changed outside the `mcp-server/`, `docs/`, or
`scripts/` boundaries.

```
git diff main..HEAD --name-only \| grep -E '^src/|^app/|\.tsx$|^supabase/'
```

Empty. No UI, no Edge Function, no migration, no client-side change.
**CLEAN per intent brief HALT #5, #10, #12, #15-#17, §5 DISALLOWED.**

### 4.4 Source-text scan for raw keys in user-facing copy

Family B raw keys (`disputes_value_weighting`, `disagreement_present`,
etc.) appear only in:
- `mcp-server/lib/familyBKeys.ts` (the registry constant)
- `mcp-server/lib/familyBPrompt.ts` (the user prompt — model-facing,
  not user-facing)
- `mcp-server/tests/familyB*.test.ts` (test code)
- `mcp-server/fixtures/*.json` (test fixtures)
- `docs/designs/MCP-SERVER-003-FAMILY-B*.md` (design docs)
- `docs/core/current-status.md` (handoff section)
- `scripts/mcp-server-001-smoke.sh` (smoke check arguments)

Zero hits in `src/` or `app/`. **CLEAN per intent brief HALT #13**
("Raw keys appear in user-facing copy").

---

## 5. Prompt-text spot check (7 absolute rules)

The seven absolute rules in Family B's system prompt
(`familyBPrompt.ts:66-72`) compared line-for-line against Family A's
(`familyAPrompt.ts:51-57`):

| # | Family A rule | Family B rule | Match |
|---|---------------|---------------|-------|
| 1 | `- You do NOT decide who is right in a debate.` | `- You do NOT decide who is right in a debate.` | ✓ byte-equal |
| 2 | `- You do NOT decide the winner of any debate.` | `- You do NOT decide the winner of any debate.` | ✓ byte-equal |
| 3 | `- You do NOT assign a truth value to any claim.` | `- You do NOT assign a truth value to any claim.` | ✓ byte-equal |
| 4 | `- You do NOT treat popularity, engagement, or virality as evidence.` | `- You do NOT treat popularity, engagement, or virality as evidence.` | ✓ byte-equal |
| 5 | `- You do NOT describe, judge, or label the person — only the move's structure.` | `- You do NOT describe, judge, or label the person — only the move's structure.` | ✓ byte-equal (em dash preserved) |
| 6 | `- You do NOT recommend hiding, deleting, or modifying any content.` | `- You do NOT recommend hiding, deleting, or modifying any content.` | ✓ byte-equal |
| 7 | `- You do NOT block an ordinary post — your output is advisory metadata only.` | `- You do NOT block an ordinary post — your output is advisory metadata only.` | ✓ byte-equal |

`familyBPrompt.test.ts:55-73` codifies this byte-equality and asserts
both prompts contain each rule. The reviewer's spot check confirms.

After the absolute-rules block, Family B's prompt diverges from
Family A's by replacing Family A's "challenge and refine" framing with
Family B's "structural DISAGREEMENT relationships" framing — both
add a "Disagreement is productive and structural; both sides remain
valid contributions to the debate" line per design §5.3, which is the
system-prompt-level reinforcement of the disputes_value_weighting +
disputes_relevance doctrine guards. The framing is descriptive
throughout; no verdict tokens, no person-judgment language.

---

## 6. Fixture plausibility judgment

The reviewer evaluates whether each fixture's expected positives are
believable for its input move text + parent text. Fixtures are NOT
live model output; they're designer-authored expected responses
intended to anchor the fixture-mode test path. Believability matters
because the canonical fixture seeds both hosted smoke and dispatch
tests; if the expected positives don't match the input, the smoke
checks pass on incorrect baselines.

### 6.1 Canonical response (`family-b-canonical-response.json`)

The fixture's positives are `disagreement_present` (true),
`disputes_scope` (true), `disputes_fact` (true). The fixture-pair
input move is implicit (the response fixture lives alone; the input
shape comes from Check 10/11 of the smoke script and from the
dispatch tests). The smoke uses: parent "[fixture] Library funding
should support infrastructure." + move "[fixture] You are defining
infrastructure to exclude branch libraries — that definition prejudges
the conclusion."

Wait — the canonical response fixture's positives say `disputes_fact`
+ `disputes_scope` ("EV adoption is at 10% nationally"), but the
smoke script's move text is about "infrastructure" / "branch
libraries", which is a `disputes_definition` move, not a
`disputes_fact` move. The fixture provider returns a canonical
response regardless of input — it's a stub for the schema shape
proof, not a real classification.

**Judgment:** the canonical fixture's positives are plausible for a
DIFFERENT input (the EV-adoption example) than the smoke script's
move text. This is the same pattern Family A uses (the Family A
canonical fixture is also generic). The smoke proves the round-trip
shape (`schemaVersion`, `observations`, `confidence`, `modelInfo.
classifierSetVersion === 'family-b-v1'`), not the prompt's
classification quality. The latter is the Phase 4 Edge admin_validation
smoke's job. **ACCEPTABLE per the design's smoke-as-shape-proof
intent (§9 + §10).**

### 6.2 Definition-dispute request (`family-b-definition-dispute-request.json`)

Move text: "You are defining infrastructure to exclude branch
libraries — that definition prejudges the conclusion." Expected
positives: `disagreement_present`, `disputes_definition`. The move
explicitly targets the parent's definition of "infrastructure";
"prejudges the conclusion" is a paradigmatic definitional argument.
The reviewer judges the expected positives are believable. **PASS.**

### 6.3 Value-weighting request (`family-b-value-weighting-request.json`)

Move text: "Efficiency is a real value, but equity of access matters
more here — the high-cost rural branches serve people who lack
alternatives." Expected positives: `disagreement_present`,
`disputes_value_weighting`. The move accepts that efficiency is a
real value (doctrine-correct: "both values are real"), then argues
equity should weigh more heavily for a stated reason. This is the
paradigm of structural value-weighting dispute per design §5.1.
The expected positives are believable. The fixture's
`familyBDoctrineFixtures.test.ts:122-141` codifies that the move text
frames both values as real and does NOT use "correct" framing.
**PASS.**

### 6.4 Relevance-with-reason request (`family-b-relevance-with-reason-request.json`)

Move text: "True, but irrelevant to whether libraries should be
funded — that question is about value-of-service, not construction
emissions." Expected positives: `disagreement_present`,
`disputes_relevance`. The move provides the substantive reason
("the question is about value-of-service, not construction
emissions") that design §5.2's doctrine guard requires. The expected
positives are believable. **PASS.**

### 6.5 Relevance-no-reason request (`family-b-relevance-no-reason-request.json`)

Move text: "Irrelevant." Expected positives: none. Pure dismissal
without engagement — `disputes_relevance` MUST be FALSE per the
doctrine guard. The fixture-shape assertion at
`familyBDoctrineFixtures.test.ts:102-120` enforces the dismissal is
short (<50 chars) and contains "irrelevant" but nothing else. The
expected behavior (model returns all 14 keys FALSE for this input) is
the design intent. **PASS.**

### 6.6 Doctrine-stress request (`family-b-doctrine-stress-request.json`)

Move text: "Security is the value that should win here, period.
Anyone who says otherwise is a propagandist." Expected positives per
design §6: `disagreement_present` only (true);
`disputes_value_weighting` MUST be FALSE (the move asserts rather
than structurally weights). The fixture is a DELIBERATE TRAP — if the
model incorrectly returns `disputes_value_weighting: true`, the
ban-list scan still catches "propagandist" in any leaked evidenceSpan
and rejects the response. Dual purpose: doctrine canary + ban-list
canary. **PASS.** The ban-list scan handling is exercised separately
by `family-b-ban-list-response.json` (which contains "anyone who
disagrees is a propagandist" in evidenceSpan.disputes_value_weighting
and gets correctly rejected at that path).

### 6.7 Multi-axis request (`family-b-multi-axis-request.json`)

Move text: "Carbon taxes work where enforcement is durable;
Australia's was repealed before measurement, so the generalization
is too strong. And the spam analogy fails: spam has technical
markers, misinformation is contextual judgment." Expected positives:
`disagreement_present`, `disputes_generalization`, `disputes_scope`,
`disputes_analogy`. The move surfaces a generalization challenge
("the generalization is too strong"), a scope condition ("works
where enforcement is durable"), and an analogy challenge ("spam
analogy fails"). The 4 expected positives are believable. **PASS.**

### 6.8 Summary

8 per-axis request fixtures + 3 response fixtures (canonical,
malformed, ban-list). 11 fixtures total. All 11 are exercised by
`familyBFixtureParity.test.ts`. Expected positives are plausible for
the structural-disagreement classifier the prompt instructs the model
to be. The fixtures encode the design intent faithfully.

---

## 7. Recommendations

### 7.1 If APPROVE — what's next

1. Orchestrator pushes branch and opens PR #316 with the body
   suggestion in §8.
2. Squash-merge after CI is green.
3. Operator runs the 8-phase smoke per intent brief §9:
   - Phase 1: confirm Deno Deploy auto-deploy of post-merge build.
   - Phase 2: `cd mcp-server && deno test --allow-net --allow-env
     --allow-read` → 343 pass.
   - Phase 3: `bash scripts/mcp-server-001-smoke.sh --base-url
     https://cdiscourse-mcp-server.civildiscourse.deno.net --token
     <hosted-bearer>` → 11 PASSES, 0 FAILS, exit 0.
   - Phase 4: Edge `admin_validation` POST with `requestedFamilies:
     ['disagreement_axis']` + 3 seeded args; SQL readback per design
     §10.
   - Phase 5: Unsupported C/D/E regression (3 POSTs); confirm
     `status: 'failed'` + `failureReason: 'mcp_validation_failed'` +
     0 positives.
   - Phase 6: targeted Jest sweep.
   - Phase 7: OPS observations (per-family latency vs Family A, etc.).
   - Phase 8: verdict + authorization (PASS → authorize
     MCP-SERVER-004-FAMILY-C).
4. Operator authors `docs/audits/MCP-SERVER-003-FAMILY-B-
   SMOKE-2026-05-27.md`.

### 7.2 Deferred follow-ups (NOT blocking)

* `MCP-021C-EDGE-FAMILY-B-ENABLE` — flip the Edge gate's
  `productionEnabled` flag for `disagreement_axis` from `false` to
  `true`. Out of scope per intent brief §5 + design §15 Decision I.
* `OPS-MCP-OBSERVABILITY` — per-family latency histogram, edge-side
  per-family logging, `tools/observability` route. Justified now that
  2 families have live traffic post-Family-B PASS.
* Adding `family` log tag to the Anthropic-wrapper success/failure
  logging (currently the wrapper passes `tool` only; `family` is
  added at the dispatcher layer per design §11).
* Optional polish: update the shared validator's docstring at
  `familyBooleanRequestSchema.ts` to acknowledge Family B is now
  registered alongside Family A. Designer flagged this as
  "optional polish (out of scope for this card)" in design §7.

---

## 8. PR-body suggestion (for `gh pr create`)

```
## MCP-SERVER-003-FAMILY-B — Disagreement Axis Boolean Observation Classifier

Promotes Family B (`disagreement_axis`, 14 rawKeys) from
"registry-rejected" to a real classifier on the MCP server.

### What ships

- New library files (5): `familyBKeys.ts` (14-key constant + 14 prompt
  entries), `familyBPrompt.ts` (system + user prompt; 7 absolute rules
  byte-equal to Family A), `familyBAnthropic.ts` (Anthropic
  orchestrator), `familyBBanListScan.ts` (doctrine ban-list scan),
  `familyBFixtureProvider.ts` (fixture-mode provider).
- Registry registration: one additive `register('disagreement_axis',
  {...})` call in `familyRegistryInit.ts`.
- Tool dispatcher: per-family provider routing
  (`pickFamilyProviders('parent_relation')` returns the unchanged
  Family A table; `pickFamilyProviders('disagreement_axis')` returns
  Family B). Family A behavior byte-equal preserved.
- 11 fixtures (3 response + 8 per-axis request).
- 8 new test files + 3 updated (98 tests forecast / 107 actual added
  per design §8): keys parity, prompt structure, Anthropic wrapper,
  ban-list scan, fixture parity, response validator, dispatcher
  routing, doctrine fixtures.
- Hosted smoke script: 2 new checks (10 + 11); final tally
  `11 PASSES, 0 FAILS`.

### Doctrine safety

- `disputes_value_weighting` per-key entry surfaces verbatim
  "MUST NOT imply one value is 'right'" guard.
- `disputes_relevance` per-key entry surfaces verbatim "relevance
  dispute requires a reason" guard.
- Doctrine-stress fixture (verdictive move with "propagandist") is
  the trap; ban-list scan catches "propagandist" if it leaks to
  evidenceSpan.
- System prompt's 7 absolute rules byte-equal to Family A.
- No verdict tokens in user-facing copy (per HALT #14).

### Scope respected

- Family A files byte-identical.
- C/D/E remain `unsupported_family`.
- Edge Functions, migrations, `src/`, `app/` untouched.
- No production auto-trigger for Family B.
- `productionEnabled: false` for `disagreement_axis` at Edge — Family
  B is admin_validation-only this card (design §15 Decision I).

### Verification

- `cd mcp-server && deno test --allow-net --allow-env --allow-read`
  → 343 passed, 0 failed (+107 vs baseline 236).
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- Targeted Jest sweep on MCP-021B/C + UX-001.5A: 40 suites / 926
  tests, 0 failed.
- Full Jest suite (implementer-run): 549 suites / 17,712 tests, 0
  failed.

### Notable change

The `supportedFamilies` envelope field in the `unsupported_family`
error response is now dynamic (`getSupportedFamilies()` returns
`['parent_relation', 'disagreement_axis']`) instead of the previous
hardcoded `['parent_relation']`. Rejection behavior for C/D/E is
unchanged (still `isError: true`, still `reason: 'unsupported_family'`,
still maps to `mcp_validation_failed` at Edge). The Edge adapter
does not consume `supportedFamilies` (verified). This is intentional
multi-family-evolution metadata; not a HALT violation.

### Operator next steps

1. Push branch + open PR.
2. Squash-merge.
3. Run 8-phase smoke per intent brief §9 + design §9-10.
4. Author audit at `docs/audits/MCP-SERVER-003-FAMILY-B-SMOKE-2026-05-27.md`.
5. On PASS, authorize `MCP-SERVER-004-FAMILY-C` to begin.

### Issue

Closes #316.
```

---

## 9. Final reviewer assessment

**APPROVE.** 20 / 20 matrix items PASS. 0 stop conditions triggered.
Doctrine clean. Boundary clean. Secrets clean. Tests pass. Family A
byte-equal preserved. C/D/E rejection preserved. Doctrine-stress
fixture pair encodes both the value-weighting and relevance doctrine
guards. Hosted smoke extended correctly with 2 new checks. Edge
admin_validation smoke plan deferred to operator per design §10.

The orchestrator may proceed with `git push -u origin
feat/MCP-SERVER-003-FAMILY-B` and `gh pr create`. Post-merge operator
work follows the 8-phase smoke plan in intent brief §9.

Authorization for `MCP-SERVER-004-FAMILY-C` is contingent on the
operator's post-merge smoke PASS per intent brief §11.
