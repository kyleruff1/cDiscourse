# MCP-SERVER-005-FAMILY-D — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-27
**Branch:** `feat/MCP-SERVER-005-FAMILY-D`
**Design:** `docs/designs/MCP-SERVER-005-FAMILY-D.md` (with Stage 2B section prepended at `b0aebbe`)
**Intent brief:** `docs/designs/MCP-SERVER-005-FAMILY-D-intent.md`
**HEAD:** `607aafa` (6 implementation commits on `5e0bbf8` designer base)
**main HEAD:** `bd3dbdf`

## Summary

Family D (`evidence_source_chain`) ships in the operator-bound **Subset
path**: the 19 `ai_classifier` rawKeys from upstream `familyD.ts` are
registered in the MCP server; the 8 deterministic keys (5 auto_metadata +
3 lifecycle; 6 unique strings) are explicitly excluded, with a hard
registry boundary that returns `unsupported_rawKey` when any caller
requests them under `evidence_source_chain`. The
Family-D-specific `MAX_TOKENS=1800` (+300 from the A/B/C baseline) is
isolated to the Family D file; Family A/B/C still emit 1500. The schema
mirror, Edge familyRegistry, Edge auto-trigger, MCP-021A taxonomy
(`src/features/nodeLabels/**`), Family A/B/C lib files, and Supabase
migrations are byte-equal preserved against `bd3dbdf`. The 3 doctrine-risk
keys (`anecdote_used`, `burden_request_present`, `evidence_gap_present`)
each carry the verbatim doctrine guard from the design's §4 in their
prompt-entry `falsePositiveGuards` strings, with dedicated banned-token
fixture tests asserting they never imply weakness, verdict, or failure.
The 7 absolute rules in the system prompt are byte-equal to Family A/B/C.
Test count moved 467 → 614 Deno (+147), 17,924 → 17,932 Jest (+8); the
+147 overshoot vs the +120 design upper-band is fully accounted for by
the 4-way cross-family rejection coverage (6 directional combinations vs
Family C's 3-way), the 6 excluded-deterministic-key rejection tests, and
the 9 per-key doctrine assertions. All gates exit 0.

## Verification

- typecheck: **pass** (exit 0)
- lint: **pass** (exit 0)
- Deno test (mcp-server): **614 passed / 0 failed** (467 baseline → +147)
- Jest test (full): **17,932 passed / 0 failed; 564 suites** (17,924 → +8)
- Targeted Jest sweep: **1146 / 55 suites passed**
  (`mcpOneTwoOneB | mcpOneTwoOneC | familyD | uxOneOneFiveA |
   opsMcpObservability | opsMcpTestDataCleanup |
   opsMcpIdempotencyHardening`)
- Secret scan: **clean** (only `sk-ant-fake-key-for-test-only-...` in
  test fixtures, matches Family A/B/C precedent; `ANTHROPIC_API_KEY`
  mentions are doctrine-comment references, not key leaks)
- Doctrine scan: **clean** (verdict tokens appear only in negation form
  or as comment-level discussion of what to ban)
- Migration apply: **n/a** — no migration in this card
  (`supabase/migrations/` diff is empty)

## Top 3 things

1. **Subset boundary is hard-enforced** — `mcp-server/lib/familyDKeys.ts:85-105`
   freezes the 19 ai_classifier rawKeys; `:119-129` freezes the 6
   excluded-deterministic strings; `tests/familyDKeysParity.test.ts:85-99,157-196`
   asserts the Subset is exactly the upstream ai_classifier slice AND
   that the 6 excluded strings are absent; `tests/familyDDispatch.test.ts:338-364`
   asserts every excluded key returns `unsupported_rawKey` (not silent
   false). Stage 2B HALT trigger #15 / #18-22 safeguards all enforced.

2. **MAX_TOKENS isolation is byte-clean** — `mcp-server/lib/familyDPrompt.ts:56`
   sets `FAMILY_D_MAX_TOKENS = 1800`. `familyAPrompt.ts:27`,
   `familyBPrompt.ts:36`, `familyCPrompt.ts:40` still read 1500. No
   global `MAX_TOKENS` constant moved. The +300 bump is exactly what
   Stage 2B approved; HALT trigger #15 satisfied per design §2.

3. **3 doctrine-risk keys carry verbatim guards** —
   `familyDKeys.ts:357-358` (`evidence_gap_present` carries the
   anti-amplification anchor: "Popularity / repetition / engagement are
   NOT evidence ... does NOT imply the move is dishonest, low-quality,
   or manipulative"); `:389-390` (`anecdote_used`: "anecdote is
   legitimate evidence in some contexts ... copy must NOT imply
   weakness"); `:453-454` (`burden_request_present`: "descriptively,
   not as a verdict on which side is right"). Each is asserted verbatim
   by `tests/familyDDoctrineFixtures.test.ts:54-69, 95-103, 129-142`.

## 24-item verdict matrix

| # | Item | Verdict | Evidence |
|---|---|---|---|
| A | familyDKeys.ts has exactly 19 ai_classifier rawKeys | PASS | `familyDKeys.ts:85-105` (19 entries); `familyDKeysParity.test.ts:50-69, 157-196` (upstream 27/27 + ai_classifier=19 set-equality) |
| B | 8 deterministic keys NOT in FAMILY_D_RAW_KEYS | PASS | `familyDKeys.ts:119-129` (6 unique excluded strings); `tests/familyDKeysParity.test.ts:85-99` |
| C | FAMILY_D_CLASSIFIER_SET_VERSION = 'family-d-v1' as const | PASS | `familyDKeys.ts:132` |
| D | FAMILY_D_MAX_TOKENS = 1800 | PASS | `familyDPrompt.ts:56`; `familyDAnthropic.ts:45` consumes it |
| E | FAMILY_A/B/C_MAX_TOKENS still = 1500 (NOT global bump) | PASS | `familyAPrompt.ts:27`, `familyBPrompt.ts:36`, `familyCPrompt.ts:40` — all unchanged |
| F | Compound-key response shape NOT introduced | PASS | Schema mirror byte-equal (see Doctrine Deep Check 2); only `'<source>:<rawKey>'` strings in diff are in the design doc's §3 comparison of the path NOT taken |
| G | 8 deterministic keys rejected with unsupported_rawKey | PASS | `tests/familyDDispatch.test.ts:338-364` iterates all 6 unique excluded strings; log capture confirms `boolean_observations_unsupported_raw_key` envelope; `familyBooleanRequestSchema.test.ts:+150` validator-level test |
| H | Family D registered with 19 keys in familyRegistryInit.ts | PASS | `familyRegistryInit.ts:82-85`; `tests/familyRegistryInit.test.ts:+1 (family-d-has-19-rawKeys-Subset)` |
| I | familyA*.ts byte-equal preserved | PASS | `git diff bd3dbdf..HEAD -- mcp-server/lib/familyA*.ts` → empty |
| J | familyB*.ts byte-equal preserved | PASS | `git diff bd3dbdf..HEAD -- mcp-server/lib/familyB*.ts` → empty |
| K | familyC*.ts byte-equal preserved | PASS | `git diff bd3dbdf..HEAD -- mcp-server/lib/familyC*.ts` → empty |
| L | mcpBooleanObservationSchemaMirror.ts byte-equal preserved | PASS | `git diff` → empty |
| M | Edge familyRegistry.ts byte-equal preserved | PASS | `git diff` → empty; Family D entry at lines 84-88 (`productionEnabled: false`, `adminValidationEnabled: true`) unchanged |
| N | Edge autoTriggerDispatcher.ts byte-equal preserved | PASS | `git diff` → empty; no Family D in production list (registry-derived via `productionEnabledFamilies()`) |
| O | src/features/nodeLabels/** byte-equal preserved | PASS | `git diff` → empty; no `src/` file touched in this card |
| P | supabase/migrations/** unchanged | PASS | `git diff bd3dbdf..HEAD -- supabase/migrations/` → empty |
| Q | Test forecast +147 vs +120 upper | PASS (within band, well under +300 HALT) | 9 new test files (2,612 lines); overshoot driven by 4-way cross-family rejection (6 directions vs Family C's 3), 6 excluded-key tests, 3 doctrine-risk keys × 3 angles. Net-additive defensive coverage per design §6 anticipation |
| R | 3 doctrine-risk keys covered | PASS | `tests/familyDDoctrineFixtures.test.ts:29-69` (anecdote_used), `:71-103` (burden_request_present), `:105-142` (evidence_gap_present + anti-amplification anchor) |
| S | Excluded-key rejection tests present | PASS | `tests/familyDDispatch.test.ts:338-364`; `tests/familyBooleanRequestSchema.test.ts:+rejects-excluded-deterministic-rawKeys-as-unsupported-rawKey` |
| T | Family A/B/C behavior preservation tests (4-way cross-family rejection) | PASS | `tests/familyDDispatch.test.ts:191-309` (6 directional combinations); `tests/familyRegistry.test.ts:+four-way-cross-family-rejection`; `tests/familyBooleanRequestSchema.test.ts` 6 new cross-family rejection tests |
| U | classifierSetVersion='family-d-v1' assertion present | PASS | `tests/familyDKeys.test.ts`, `tests/familyDDispatch.test.ts:112`, `tests/familyDFixtureParity.test.ts`, `tests/familyDPrompt.test.ts`, fixture file at `family-d-canonical-response.json:91` |
| V | 7 absolute rules from Family C present verbatim in familyDPrompt.ts | PASS | `familyDPrompt.ts:81-87` byte-equal to `familyAPrompt.ts:51-57`, `familyBPrompt.ts:66-72`, `familyCPrompt.ts:73-79`; `tests/familyDPrompt.test.ts:62-86` asserts byte-equal with Family A/B/C |
| W | No verdict tokens in non-negation form in any new code/test | PASS | All verdict-token matches in diff are inside negation forms ("does NOT imply", "do NOT mark TRUE") or are doctrine-comment references discussing what to ban |
| X | No raw body / evidence_span / secret in any new log line | PASS | `familyDAnthropic.ts` reuses `callAnthropic` (proven safe by `anthropicNoLogging.test.ts`); `tests/familyDAnthropic.test.ts:181-225` asserts API key never appears in success or failure log lines |

**24/24 PASS.** No matrix item FAIL. No STOP condition triggered.

## Operator Stage 2B binding decision compliance scan

| # | Stage 2B binding constraint | Compliance | Evidence |
|---|---|---|---|
| 1 | Support only 19 ai_classifier Family D keys | YES | `familyDKeys.ts:85-105` (19 entries, frozen) |
| 2 | Exclude 8 deterministic keys (5 auto_metadata + 3 lifecycle) | YES | `familyDKeys.ts:119-129` (6 unique excluded strings = 8 declarations after dedup); registry rejects all 6 with `unsupported_rawKey` |
| 3 | NO compound-key response shape | YES | Schema mirror byte-equal; no compound-key keys in production code |
| 4 | NO MCP-021A schema mirror alteration | YES | `git diff` of `mcpBooleanObservationSchemaMirror.ts` → empty |
| 5 | NO duplicate rawKey disambiguation in this card | YES | Subset excludes the 2 collision rawKeys (source_requested + quote_requested under both source types); collision disappears by exclusion |
| 6 | Family D MAX_TOKENS = 1800 (not global) | YES | `familyDPrompt.ts:56`; A/B/C still 1500 |
| 7 | Family A/B/C remain at 1500 | YES | `familyAPrompt.ts:27`, `familyBPrompt.ts:36`, `familyCPrompt.ts:40` unchanged |
| 8 | Register evidence_source_chain with 19 keys | YES | `familyRegistryInit.ts:82-85` |
| 9 | Family D admin_validation-only; productionEnabled=false | YES | Edge `familyRegistry.ts:84-88` unchanged; `tests/mcpOneTwoOneCEdgeFamilyRegistryFamilyD.test.ts:FD-2, FD-4` assert |
| 10 | NO Edge familyRegistry production flag changes | YES | Edge file byte-equal preserved |
| 11 | NO auto-trigger inclusion for Family D | YES | `autoTriggerDispatcher.ts` byte-equal; uses registry-derived `productionEnabledFamilies()` which excludes Family D |
| 12 | NO Source 6 / persistence / Family A/B/C code changes | YES | `src/features/nodeLabels/machineObservationPersistenceQuery.ts` byte-equal; Family A/B/C libs byte-equal |
| 13 | E/F/G/H/I/J remain unsupported | YES | `tests/familyDDispatch.test.ts:311-336` (E rejected); `tests/familyBDispatch.test.ts:+G replaces stale D test`; `tests/classifyArgumentBooleanObservations.test.ts:122` (E rejected, supportedFamilies has 4 entries) |
| 14 | 8 excluded deterministic rawKeys return `unsupported_rawKey`/`invalid_params` (NOT silent false) | YES | `tests/familyDDispatch.test.ts:338-364`; log capture confirms `boolean_observations_unsupported_raw_key` envelope |

**14/14 binding items compliant.** No Stage 2B violation detected.

## Doctrine deep-check findings

1. **Family A/B/C lib byte-equal scan:** `git diff bd3dbdf..HEAD --
   mcp-server/lib/familyA*.ts mcp-server/lib/familyB*.ts
   mcp-server/lib/familyC*.ts` returned **0 lines**. PASS.

2. **Schema mirror byte-equal:** `git diff bd3dbdf..HEAD --
   mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` returned **0
   lines**. PASS.

3. **Edge Function byte-equal:** `git diff bd3dbdf..HEAD --
   supabase/functions/` returned **0 lines**. PASS.

4. **Source 6 byte-equal:** `git diff bd3dbdf..HEAD --
   src/features/nodeLabels/machineObservationPersistenceQuery.ts`
   returned **0 lines**. No file under `src/` modified in this card.
   PASS.

5. **No migration:** `git diff bd3dbdf..HEAD --
   supabase/migrations/` returned **0 lines**. PASS.

6. **19-key inventory verification:** Read `familyDKeys.ts:85-105`.
   Confirmed exactly these 19 rawKeys in declaration order matching
   upstream `familyD.ts` ai_classifier-source declarations:
   `asks_for_evidence, provides_evidence, evidence_supports_claim,
   creates_source_chain_gap, opens_evidence_debt_marker,
   closes_evidence_debt_marker, supplies_corroborating_document,
   source_provided, quote_provided, concrete_example_requested,
   concrete_example_provided, evidence_claim_present,
   evidence_gap_present, source_chain_repair, anecdote_used,
   statistic_used, external_authority_used,
   evidence_quality_questioned, burden_request_present`. Set-equality
   enforced by `tests/familyDKeysParity.test.ts:157-196`. PASS.

7. **8 excluded keys verification:** `FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS`
   at `familyDKeys.ts:119-129` contains the 6 unique strings
   `has_evidence, source_requested, quote_requested, source_attached,
   quote_attached, sourced` (since `source_requested` and
   `quote_requested` are the same string across auto_metadata + lifecycle
   source types, the 8 upstream declarations dedupe to 6 unique rawKey
   strings; the comment at `:126-127` documents this). None of these
   appear in `FAMILY_D_RAW_KEYS`. Comments and `falsePositiveGuards`
   strings reference `has_evidence` and `source_attached` correctly —
   they appear ONLY in negation/exclusion context ("Do NOT confuse
   with has_evidence (auto-metadata structural fact; excluded from
   Subset)" at `:182, :278, :342`). PASS.

8. **MAX_TOKENS isolation:** Confirmed via grep:
   - `familyAPrompt.ts:27` — `FAMILY_A_MAX_TOKENS = 1500` ✓
   - `familyBPrompt.ts:36` — `FAMILY_B_MAX_TOKENS = 1500` ✓
   - `familyCPrompt.ts:40` — `FAMILY_C_MAX_TOKENS = 1500` ✓
   - `familyDPrompt.ts:56` — `FAMILY_D_MAX_TOKENS = 1800` ✓
   - `familyDAnthropic.ts:45` consumes `FAMILY_D_MAX_TOKENS` (not a
     shared global). PASS.

9. **3 doctrine-risk key guards (verbatim from design §4):**
   - `anecdote_used` (`familyDKeys.ts:389-390`): "Doctrine note: anecdote
     is legitimate evidence in some contexts — particularly for existence
     claims, mechanism examples, and lived-experience domains; copy must
     NOT imply weakness." ✓
   - `burden_request_present` (`familyDKeys.ts:453-454`): "Doctrine note:
     burden-of-demonstration framing is debated philosophical territory;
     CDiscourse treats it descriptively, not as a verdict on which side
     is right." ✓
   - `evidence_gap_present` (`familyDKeys.ts:357-358`): "Doctrine note:
     evidence_gap_present indicates a structural state of the move; it
     does NOT imply the move is dishonest, low-quality, or manipulative.
     Popularity / repetition / engagement are NOT evidence
     (cdiscourse-doctrine §3)..." ✓
   Each is asserted byte-includes by `tests/familyDDoctrineFixtures.test.ts:54-69,
   95-103, 129-142`. PASS.

10. **Excluded-key rejection mechanism:** The registry's
    `validateFamilyBooleanRequest` rejects unknown rawKeys with
    `kind: 'unsupported_rawKey'` and a per-key `unsupportedRawKeys`
    array. The error envelope returned by
    `handleClassifyArgumentBooleanObservations` is
    `{ reason: 'unsupported_rawKey', unsupportedRawKeys: [...] }`
    with `isError: true`. Test at `tests/familyDDispatch.test.ts:338-364`
    iterates all 6 unique excluded strings and asserts the envelope shape
    per key. Log capture during test run shows
    `event: 'boolean_observations_unsupported_raw_key', reason:
    'unsupported_rawKey', status: 'rejected', httpStatus: 200`. The
    envelope shape matches the existing `unsupported_family` rejection
    pattern (same `errorResult()` builder; same isError boundary;
    different `reason` string). PASS.

11. **Fixture content safety:** Verified all 8 new fixture JSON files:
    - `family-d-canonical-request.json` — fictional EPA report, EV
      emissions data; structural example only.
    - `family-d-canonical-response.json` — `family-d-v1` classifier
      version; 19-key response with structural evidenceSpans
      ("Per the 2024 EPA report Table 3.1", "40% drop in tailpipe
      emissions from 2020 to 2023"); no verdict tokens.
    - `family-d-source-provided-request.json` — structural source
      provision example.
    - `family-d-evidence-gap-request.json` — adversarial test:
      "Crime rates have dropped 30% since 2010, and everyone knows
      policy X caused outcome Y" — uses `everyone knows` as the
      anti-amplification trap marker (correct test framing; the move
      itself is the unevidenced claim being classified, not a verdict).
    - `family-d-anecdote-used-request.json` — lived-experience-domain
      anecdote ("When I worked at the library").
    - `family-d-no-evidence-request.json` — Family-C-style content
      ("Are you saying libraries are public goods...") to prove
      Family D doesn't misclassify Family C content as evidence
      signal.
    - `family-d-malformed-response.json` — intentional malformation
      (missing confidence entry).
    - `family-d-ban-list-response.json` — intentional ban-list trigger:
      evidenceSpan contains "the author is dishonest about the
      evidence" (correct use: test fixture proves the
      `scanFamilyDBooleanResponseForBanList` rejects banned tokens).
    No real-world political figures. No real argument body text from
    production data. No secrets. All move text prefixed with
    `[fixture]` marker. PASS.

12. **Test forecast +147 vs +120 upper:** Net-additive defensive
    coverage:
    - 9 new test files (2,612 lines total)
    - 4-way cross-family rejection adds 6 directional combinations
      (Family A↔D, B↔D, C↔D; vs Family C's 3-way of A↔C, B↔C only)
    - 6 excluded-deterministic-key rejection tests (mandated by Stage 2B
      §G safeguard)
    - 9 per-key doctrine assertions (3 doctrine-risk keys × 3 angles:
      prompt-entry inspection, evidenceSpan content, anti-bias scan)
    - 1 new Jest test (`mcpOneTwoOneCEdgeFamilyRegistryFamilyD.test.ts`,
      8 assertions FD-1 through FD-8)
    Test count overshoot vs design §6 upper-band (+120) is +27 (+22.5%),
    well below the +300 HALT trigger #24 threshold (49% of cap). The
    overshoot was anticipated in the design ("designer's forecast lands
    at the upper band due to the 4-way cross-family rejection tests").
    PASS — net-additive defensive boundary preservation, not test-bloat.

## Specific actionable comments

None. All matrix items PASS. No FAIL conditions. No Stage 2B binding
violation.

## Optional polish suggestions (non-blocking)

1. **Future operator-card hook documented but not actionable here:** The
   8 deterministic keys are deferred to a future card
   (`MCP-021C-EDGE-FAMILY-D-DETERMINISTIC-KEYS` per `familyDKeys.ts:22`).
   The current implementation leaves a clean seam: the Edge adapter can
   compute these keys deterministically without ever touching the MCP
   server. No action in this card.

2. **The `BC carbon tax` and `Tokyo bike lanes` references in
   `familyDKeys.ts` examples** (`:194, :211-212`) are real-world
   policy examples used to illustrate evidence/claim matching. They are
   structural and benign (parallel to Family C's library funding
   examples), but operators reviewing the corpus should know these
   examples will be visible in classifier prompts. No change needed —
   they are doctrine-clean.

3. **The `evidence_gap_present` `falsePositiveGuards` is the longest
   guard string in the file** (`familyDKeys.ts:358`, ~700 chars). It
   bundles 4 doctrine rules: value/normative exclusion, hedged-claim
   exclusion, attached-evidence exclusion, and anti-amplification
   anchor. The bundling is intentional per design §4.3 and the tests
   assert each fragment by `includes()`. If future Family E/F/G work
   surfaces similar guard-bundling, a designer might consider a
   shared guard-template pattern. Not actionable here.

4. **The 8 declarations / 6 unique rawKey strings semantics for the
   excluded list** is explained in code comments
   (`familyDKeys.ts:113-118, :126-127`) and in `tests/familyDKeysParity.test.ts:85-99`
   commentary, but a future reader unfamiliar with the upstream
   compound-key design might miss the distinction. The current
   documentation is sufficient; no change needed.

## Recommendation to operator

**PR title:** `MCP-SERVER-005-FAMILY-D: Family D 19-key ai_classifier
Subset (admin_validation only; MAX_TOKENS=1800)`

**PR body (suggested):**
```
Adds Family D (`evidence_source_chain`) to the hosted MCP server in the
Stage 2B-approved Subset path. The 19 ai_classifier rawKeys from upstream
`familyD.ts` are routed through Anthropic; the 8 deterministic keys (5
auto_metadata + 3 lifecycle; 6 unique strings) are explicitly excluded
and return `unsupported_rawKey` at the registry boundary.

## Stage 2B binding compliance (14/14)
- Subset path (19 keys), no compound-key shape, no schema mirror change.
- MAX_TOKENS=1800 (Family-D-specific); A/B/C remain at 1500.
- Edge familyRegistry preserved at `productionEnabled: false,
  adminValidationEnabled: true`.
- No auto-trigger inclusion for Family D.
- No Family A/B/C / Source 6 / persistence / migration changes.
- 8 excluded deterministic rawKeys rejected with `unsupported_rawKey`
  (NOT silent false).

## Doctrine
- 7 absolute rules byte-equal across Family A/B/C/D system prompts.
- 3 doctrine-risk keys carry verbatim guards: `anecdote_used` (NOT
  weakness), `burden_request_present` (NOT verdict),
  `evidence_gap_present` (NOT failure; anti-amplification anchor).
- Doctrine ban-list scan reuses shared DOCTRINE_BAN_PATTERNS; no
  Family-D-specific patterns added per design §4.4.

## Test coverage
- 614 / 0 Deno tests (+147; 467 baseline)
- 17,932 / 0 Jest tests (+8)
- Typecheck + lint exit 0
- 9 new Family D test files + 1 new Jest test + 4 updated test files
- 4-way cross-family rejection coverage (6 directional combinations)

## Post-merge
- Deno Deploy auto-deploys the post-merge build to
  https://cdiscourse-mcp-server.civildiscourse.deno.net.
- Operator runs the 8-phase smoke per design §9 with the audit
  template at `docs/audits/MCP-SERVER-005-FAMILY-D-SMOKE-template.md`.
- 15-check hosted MCP smoke (Family A 1-9, B 10-11, C 12-13, D 14-15).
- Edge admin_validation smoke against 3 seeded args; 0 positives is
  acceptable PARTIAL per intent brief §9 Decision 9.
```

## Operator next steps

1. **Push the branch** (from main repo root, not from worktree):
   ```bash
   git push -u origin feat/MCP-SERVER-005-FAMILY-D
   ```

2. **Open the PR:**
   ```bash
   gh pr create --title "MCP-SERVER-005-FAMILY-D: Family D 19-key ai_classifier Subset (admin_validation only; MAX_TOKENS=1800)" \
                --body-file docs/reviews/MCP-SERVER-005-FAMILY-D.md
   ```

3. **Post-merge:** No Supabase deploy (no migration, no Edge change).
   Deno Deploy auto-deploys the post-merge build. Operator runs the
   8-phase smoke (`docs/designs/MCP-SERVER-005-FAMILY-D.md` §9) and
   captures the audit at
   `docs/audits/MCP-SERVER-005-FAMILY-D-SMOKE-<date>.md`.

4. **Post-merge worktree cleanup** (from main repo root):
   ```bash
   git worktree list | grep "feat/MCP-SERVER-005-FAMILY-D"
   git worktree remove -f -f ".claude/worktrees/agent-<hash>"
   git branch -D feat/MCP-SERVER-005-FAMILY-D
   git worktree list | grep -c "agent-<hash>"   # must print 0
   ```
   (Use the UNC long-path workaround `Remove-Item "\\?\<path>" -Recurse
   -Force` from PowerShell if `git worktree remove` fails with
   "Filename too long".)
