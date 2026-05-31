# MCP-SERVER-009-FAMILY-H — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-31
**Branch:** feat/MCP-SERVER-009-FAMILY-H
**Design:** docs/designs/MCP-SERVER-009-FAMILY-H.md (commit `c45b034`)
**Intent brief:** docs/designs/MCP-SERVER-009-FAMILY-H-intent.md (on main since #387)
**HEAD:** 3e191f5 (10 commits ahead of origin/main)

## Summary

Family H (claim_clarity) ships on the MCP server in admin_validation-only posture
as designed. The 12-key uniform ai_classifier surface is the byte-for-byte
structural mirror of Family G's pattern with one structural simplification (no
exclusion list — H is uniform-source) and one structural amplification (4
HIGHEST-risk verdict-adjacent keys vs G's 1 axis-partner). The 5-layer doctrine
defense is intact: the absolute-rules block is byte-equal to A–G; the system
prompt's CRITICAL DOCTRINE paragraphs encode absence-is-not-failure,
broad-is-not-weak, unclear-is-not-speaker-error, and an explicit forbidden-token
enumeration; each of the 4 HIGHEST-risk keys
(`claim_specificity_low`, `conclusion_missing`, `reason_missing`,
`unclear_reference_present`) carries the verbatim per-key DOCTRINE paragraph in
its `falsePositiveGuards`; the H-LOCAL ban-list scanner adds 17 clarity-verdict
patterns (9 single-word + 8 compound) that the shared `DOCTRINE_BAN_PATTERNS`
does not cover, leaving the shared list byte-equal per HALT 5; the 4 mandatory
adversarial fixtures (C/D/E/F) carry verdict words in the INPUT and assert the
OUTPUT cannot echo them; the smoke template's Phase 4b carries
binding `evidence_span` inspection-pattern language so the Card 2 retroactive
L5 re-lint will pass. Tests: 1191/1191 Deno pass (+150 from baseline 1041);
18721/18721 Jest pass (+8 from baseline 18713; the new
`mcpOneTwoOneCEdgeFamilyRegistryFamilyH.test.ts` adds 8 FH-1..FH-8 assertions).
A–G + every protected file (`doctrineBanList.ts`, `seedPrompt.ts`,
`anthropicCall.ts`, `providerConcurrency.ts`,
`mcpBooleanObservationSchemaMirror.ts`, Edge `familyRegistry.ts`, Edge
`booleanObservationRequestBuilder.ts`, `audit-lint-rules.cjs`, `src/`,
`supabase/migrations/`, `package.json`, the shared registry Jest file) are
byte-equal-preserved per HALT 4 + HALT 5 + HALT 12 + HALT 13.

## Verification

- typecheck: PASS (exit 0)
- lint: PASS (exit 0)
- test (Jest): 18713 → 18721 (+8 tests; 592 → 593 suites; exit 0)
- test (Deno mcp-server): 1041 → 1191 (+150 tests; exit 0)
- targeted Jest (`Family.*H|claim.clarity`): 8 / 8 pass (FH-1..FH-8)
- targeted Jest (`mcpOneTwoOneCEdgeFamilyRegistry*`): 59 / 59 pass (all 4 files)
- secret scan: CLEAN (the `sk-ant-fake-key-for-test-only-1234567890abcdef`
  literal in `familyHAnthropic.test.ts:28` is byte-identical to the same
  literal in `familyE/F/GAnthropic.test.ts:28`; it is the standard
  fake-key fixture used to exercise the auth-header construction path
  without contacting Anthropic, and it is not a real key prefix in any
  sense — it is the documented test pattern across A–G)
- doctrine scan: CLEAN (every match for `weak|sloppy|lazy|careless|confused|
  unsound|incoherent|illogical` in lib/fixture/tool sources lives inside a
  doctrine-negation context — comments, MUST NOT clauses, banned-list
  enumerations, or the intentional ban-list-violation fixture
  `family-h-ban-list-response.json` which exists explicitly to be
  REJECTED by the scanner)
- migration apply: not applicable — this card adds no migration; the
  `git diff origin/main..HEAD -- supabase/migrations/` confirms zero lines

## Design conformance

- [x] All design file-changes are present (5 new lib files + 11 fixtures
  + 6 dedicated Deno test files + 1 new Edge Jest file + 5 retargeted
  cross-family dispatch tests + smoke script Checks 22+23 + smoke
  template + current-status.md doc note)
- [x] No undocumented file-changes (every diffed file maps to a
  design §File-changes entry; nothing in `src/`, `supabase/`,
  `package.json`, `audit-lint-rules.cjs`, the shared Edge registry
  test, or A–G lib files moves)
- [x] Data model matches design — `FAMILY_H_RAW_KEYS` is frozen, 12
  entries, declaration order matches upstream familyH.ts; verified
  via `Grep` on `src/features/nodeLabels/machineObservationDefinitions/
  familyH.ts` returning the 12 `rawKey:` literals in exactly the
  same order as `mcp-server/lib/familyHKeys.ts:86-99`;
  `FAMILY_H_CLASSIFIER_SET_VERSION = 'family-h-v1'` per
  design §A.1.1; no `FAMILY_H_EXCLUDED_DETERMINISTIC_RAW_KEYS`
  (uniform-source precedent matching E + F per design §A.1.1);
  `FAMILY_H_MAX_TOKENS = 1500`, `FAMILY_H_TEMPERATURE = 0`,
  `FAMILY_H_MAX_BODY_FIELD_LEN = 8000` per design §A.2
- [x] API contracts match design — `runAnthropicFamilyHClassifier`,
  `loadFixtureFamilyHPacket`, `scanFamilyHBooleanResponseForBanList`,
  `FAMILY_H_BAN_PATTERNS` (17 patterns, frozen, readonly RegExp[]),
  `FamilyHBanListScanResult`, `ValidatedFamilyHRequest`,
  `FamilyHPromptEntry`, `FAMILY_H_PROMPT_ENTRIES` (12 entries, each
  with the 7 required string fields including `falsePositiveGuards`),
  `buildFamilyHUserPrompt` all present and match the design §API
  contracts block byte-for-byte structurally
- [x] Dispatcher wiring matches design — `pickFamilyProviders` adds
  the `if (family === 'claim_clarity')` block after the
  `'resolution_progress'` block;
  `FamilyProviders.anthropic` union adds `ValidatedFamilyHRequest`
  preserving A–G entries; tool description string updates with
  H paragraph; the "Family H through J" → "Family I through J"
  unsupported-set adjustment is the documented retarget

## Doctrine self-check (all confirmed)

- [x] No truth/winner/loser language in user-facing strings — the H
  system prompt explicitly forbids "weak", "strong", "bad", "good",
  "sloppy", "sound", "valid", "invalid", "complete", "incomplete",
  "supported", "unsupported"; each of the 4 HIGHEST-risk keys' per-key
  guards repeats the forbidden-token enumeration; the H-LOCAL
  ban-list scanner rejects 17 clarity-verdict patterns at runtime
  (proven by `familyHAdversarialDoctrine.test.ts:423-452`: explicit
  per-token assertion)
- [x] Score never blocks posting — H is admin_validation-only at the
  Edge (`familyRegistry.ts:104-108` byte-equal: `productionEnabled:
  false`, `adminValidationEnabled: true`); the production auto-trigger
  excludes H entirely; submit-argument never gates on H classification
  (verified by absence of any `submit-argument`/`autoTriggerDispatcher`
  diff line touching H)
- [x] No service-role in client code — `familyHAnthropic.ts` reaches
  Anthropic via `callAnthropic` on the Deno-side MCP server; no `src/`
  file imports any H module (verified by `git diff origin/main..HEAD
  -- src/` returning zero lines); the H Anthropic key path is
  x-api-key inside the server-side `callAnthropic` skeleton, which is
  HALT-5 byte-equal
- [x] No direct insert into public.arguments — H emits structural
  observations only; the persisted target is
  `argument_machine_observation_results.evidence_span` (existing
  column written by the Edge Function), not `public.arguments`; H
  has zero migration footprint and zero schema change
- [x] No AI calls in production app paths — every H file is under
  `mcp-server/` (Deno target); no `src/` or `app/` file imports any
  H module; the production auto-trigger excludes H per the Edge
  registry `productionEnabled: false` gate; HALT 7 satisfied
- [x] Plain language only — H emits structural rawKeys (`claim_present`,
  `reason_present`, `conclusion_missing`, `reason_missing`,
  `multiple_claims_present`, `claim_specificity_high`,
  `claim_specificity_low`, `quantifier_present`, `modal_language_present`,
  `hedging_present`, `unclear_reference_present`,
  `provides_temporal_constraint`); the `gameCopy.toPlainLanguage`
  mapping is a UI-layer concern downstream of this server, and the
  H rawKeys are added to the existing wire schema, not surfaced as
  user-facing strings in this card
- [x] Epic-specific doctrine — `supabase-edge-contract` rules
  (no service-role in client, no direct insert into `public.arguments`,
  no AI calls from `src/`, no migration edit, RLS preserved): all
  satisfied by absence of any matching diff line.
  `cdiscourse-doctrine §10a` (Observations vs Allegations): every H
  rawKey is `source: 'ai_classifier'` per upstream familyH.ts (12
  declarations verified by Grep); none of the 12 keys imply a person
  or intent — `unclear_reference_present` explicitly carries the
  upstream guard against speaker-skill verdicts (familyHKeys.ts:312-314)

## Test coverage

- [x] New public functions have unit tests — each of
  `runAnthropicFamilyHClassifier`, `loadFixtureFamilyHPacket`,
  `scanFamilyHBooleanResponseForBanList`, `buildFamilyHUserPrompt`,
  `FAMILY_H_RAW_KEYS`, `FAMILY_H_CLASSIFIER_SET_VERSION`,
  `FAMILY_H_PROMPT_ENTRIES`, `FAMILY_H_BAN_PATTERNS` has dedicated
  test coverage across the 6 dedicated Deno files
- [x] User-facing strings have ban-list assertion — `familyHPrompt.
  test.ts` "DOCTRINE BAN-LIST scan" assertion (the run output
  surfaces it as a green test);
  `familyHAdversarialDoctrine.test.ts:423-452` asserts the 17 D5
  patterns are each present and that the array length is exactly 17;
  `familyHBanListScan.test.ts` runs ~30 tests covering each of the
  9 single-word + 8 phrase patterns + the shared
  `DOCTRINE_BAN_PATTERNS` patterns, near-miss words, the malformed-
  response rejection path, the modelInfo.serverName scan, and the
  modelInfo.classifierSetVersion scan
- [x] Edge cases from design §"Edge cases" have tests — empty
  requestedRawKeys (familyHPrompt.test.ts "default request includes
  all 12 rawKeys"; familyBooleanRequestSchema.test.ts "valid-family-h-
  request-with-empty-rawKeys-passes"); cross-family rejection
  (familyBooleanRequestSchema.test.ts "cross-family-rejection-family-
  a-key-under-claim-clarity" + "cross-family-rejection-family-h-key-
  under-resolution-progress"); Anthropic failures
  (familyHAnthropic.test.ts: key_missing / HTTP 429 / HTTP 500 /
  TimeoutError / non-JSON / plain prose / 11 tests total);
  fixture-load failure (familyHFixtureProvider.ts catches via
  try/catch, returns `{ok: false, reason: 'fixture_load_failed'}`,
  tested via the fixture-provider load test)
- [x] Adversarial doctrine fixtures — the 4 HIGHEST-risk per-key
  fixtures (C/D/E/F) verified at the test layer: each input contains
  the verdict words; each fixture is parseable; each requests the
  expected rawKey; the simulated-clean output passes the scan;
  the simulated-dirty output FAILS the scan
  (familyHAdversarialDoctrine.test.ts lines 147-266 + 472-566); the
  axis-partner key `claim_specificity_low` carries the
  "AXIS-PARTNER EXISTENTIAL" callout and the dirty-spans-list test
  (lines 525-537)
- [x] No skipped/only tests — `git diff origin/main..HEAD` contains
  zero `.skip` / `.only` / `xit` / `xdescribe` additions
- [x] No new console.log — verified by inspection of all 5 new lib
  files + 6 new Deno test files; the only `log()` calls are
  structured logger usage in `familyHFixtureProvider.ts` (matching
  G's `familyGFixtureProvider.ts:39-41 + :48-52` precedent)

## Critical review lenses (per chain prompt §5)

1. **Doctrine leakage walk:** The 7 absolute rules block in the system
   prompt is byte-equal to A–G. The CRITICAL DOCTRINE block (lines
   100-138 of familyHPrompt.ts) explicitly forbids verdict framing
   with 5 absences-and-broadness paragraphs and an enumerated
   forbidden-token list. The 4 HIGHEST-risk per-key guards each
   contain verbatim "MUST NOT contain: …" with the specific
   forbidden-token enumeration. The 11 fixtures: the canonical-met,
   canonical-unmet, supplementary (multi-claim, hedging), and
   canonical-response JSONs are all doctrine-clean; the 4 adversarial
   fixtures (C/D/E/F) carry verdict words ONLY in the INPUT
   `currentText`, never in the expected/canonical OUTPUT; the
   intentional ban-list-violation fixture
   (`family-h-ban-list-response.json`) IS dirty by design — that is
   the test fixture against which the runtime scanner is verified.
   The 4 HIGHEST-risk keys (`claim_specificity_low`,
   `conclusion_missing`, `reason_missing`, `unclear_reference_present`)
   each carry the verbatim DOCTRINE paragraph forbidding `weak / sloppy
   / lazy / careless / confused / unsound / unsupported / incoherent
   / illogical / wrong / "bad reasoning" / "bad argument" / "bad
   writing" / "argument is incomplete" / "argument is unsupported" /
   "argument is weak" / "claim fails"`. CLEAN.

2. **A-G behavior drift:** `git diff origin/main..HEAD -- mcp-server/
   lib/familyA*.ts ... mcp-server/lib/familyG*.ts` returns zero lines.
   Dispatcher `pickFamilyProviders` adds only the H block after the G
   block; A–G routing is unchanged (confirmed by reading the diff
   region around lines 332-355 of `classifyArgumentBooleanObservations.ts`
   — the new H block is appended after the existing G block, before
   the `return null` defensive default). The `FamilyProviders.anthropic`
   union adds `ValidatedFamilyHRequest` at the end; A–G entries are
   preserved in order. CLEAN.

3. **Key mismatch:** Verified via `Grep` on `src/features/nodeLabels/
   machineObservationDefinitions/familyH.ts` that the 12 `rawKey:`
   literals appear in this exact order: `provides_temporal_constraint`,
   `claim_present`, `reason_present`, `conclusion_missing`,
   `reason_missing`, `multiple_claims_present`, `claim_specificity_high`,
   `claim_specificity_low`, `quantifier_present`, `modal_language_present`,
   `hedging_present`, `unclear_reference_present`. The server-side
   `FAMILY_H_RAW_KEYS` array in `mcp-server/lib/familyHKeys.ts:86-99`
   contains the same 12 strings in the same order. Upstream has
   exactly 12 `source: 'ai_classifier'` declarations and zero
   `source: 'auto_metadata'` and zero `source: 'lifecycle'` (verified by
   Grep `source:\s*['"](ai_classifier|auto_metadata|lifecycle)['"]`
   returning 12). HALT 3 PASS confirmed at the review boundary.

4. **Missing evidence_span smoke proof:** The smoke template at
   `docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-template.md` carries
   `Audit-Lint: v1` at line 3. The "L5 BINDING — operator obligation"
   block at lines 22-51 carries BINDING (not optional) language:
   "The audit author MUST treat Phase 4b as binding-required (NOT
   optional) regardless of CI's current scope. The audit MUST include
   explicit `evidence_span` inspection language…". Phase 4b at lines
   169-224 carries multiple binding-required L5_PERSISTED_
   INSPECTION_PATTERNS hits: the literal `\bevidence_span\b` (line 49),
   `SELECT … evidence_span` (line 188, in the SQL block), `| evidence_span |`
   (line 204, in the resolution table header), `persisted evidence`
   (line 178), `direct-output inspection` framing throughout. The
   verdict-rules paragraph (Phase 8 line 296-299) names the binding
   firing-count asymmetry. The pre-push checklist (line 306) requires
   `node scripts/ops/audit-lint.mjs <audit> exit 0` before push.
   The retroactive Card 2 L5 re-lint will PASS this audit format
   per design §A.5 D9/D13. CLEAN.

5. **Unexpected Edge/registry changes:** `git diff origin/main..HEAD
   -- supabase/functions/_shared/booleanObservations/familyRegistry.ts`
   returns zero lines. `git diff origin/main..HEAD --
   supabase/functions/_shared/booleanObservations/
   booleanObservationRequestBuilder.ts` returns zero lines (HALT 12
   inapplicable: H is uniform `ai_classifier` so no
   `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry is required). `git diff
   origin/main..HEAD -- __tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts`
   returns zero lines (the new `…FamilyH.test.ts` is additive, not a
   replacement). CLEAN.

6. **Edge Jest test correctness:** `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyH.test.ts`
   has exactly 8 tests FH-1..FH-8 mirroring the FamilyE structure:
   FH-1 entry exists; FH-2 `productionEnabled: false` (pre Card 3
   flip); FH-3 `adminValidationEnabled: true`; FH-4 H absent from
   `edgeProductionEnabledFamilies()`; FH-5 H present in
   `edgeAdminValidationEnabledFamilies()`; FH-6
   `edgeFilterFamiliesForMode(['claim_clarity'], 'production')` = `[]`;
   FH-7 `edgeFilterFamiliesForMode(['claim_clarity'], 'admin_validation')`
   = `['claim_clarity']`; FH-8 `EDGE_FAMILY_REGISTRY[7].family ===
   'claim_clarity'` (index 7 = 8th entry, A→J order preserved). All
   8 tests pass in the targeted Jest run. CLEAN.

## Carry-forward invariants (preserved)

- A–G byte-equal (HALT 4) — verified by `git diff` returning zero
  lines on every `familyA*.ts` … `familyG*.ts` file.
- Shared `doctrineBanList.ts`, `seedPrompt.ts`, `anthropicCall.ts`,
  `mcpBooleanObservationSchemaMirror.ts`, `providerConcurrency.ts`
  byte-equal (HALT 5) — verified by `git diff` returning zero lines.
- Edge `familyRegistry.ts` H entry byte-equal — Card 3 territory; H
  entry remains `{productionEnabled: false, adminValidationEnabled: true}`
  at `supabase/functions/_shared/booleanObservations/
  familyRegistry.ts:104-108`. HALT 13 satisfied.
- `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` untouched (HALT 12
  inapplicable; H is uniform). The existing D + G entries remain
  byte-equal.
- No migration; `supabase/migrations/` diff = 0 lines.
- `package.json` byte-equal — no dependency change.
- `src/features/nodeLabels/**` read-only — `git diff` returns zero
  lines.
- `scripts/ops/audit-lint-rules.cjs` byte-equal — adding `family_h`
  to `DOCTRINE_RISK_FAMILIES` is Card 2, not this card.
- `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` byte-equal
  (the additive parallel file is the Card-3-flip baseline; not a
  replacement of the shared file).

## Migration-bearing card check

NO migration in this card. Document of absence: `git diff
origin/main..HEAD -- supabase/migrations/` returns zero lines; no SQL
files touched. The heightened-review path is not triggered. The
"Verification" table records this as "Migration apply: not applicable
— no migration in this card; supabase/migrations/ diff = 0 lines".

## Blockers (none)

No issues rise to BLOCK or CHANGES-REQUESTED. The implementation
matches the design verbatim; tests pass; doctrine surface is intact.

## Suggestions (non-blocking; deferrable)

1. The "near-miss words" assertion at familyHAdversarialDoctrine.test.ts:454-465
   demonstrates that `weakened` / `carelessness` / `wonderful` are not
   flagged by the strict-boundary patterns. The implementer correctly
   carried this as a documented design decision per design §"Risks". If
   a future smoke surfaces a `weakly`-shaped doctrine leak, an
   operator amendment can widen the patterns to `\bweak\w*\b`. This
   is informational; no action required for Card 1.

2. The smoke template binds Phase 4b as operator-mandatory for L5
   satisfaction. The operator's post-merge run must populate the
   "fixture", "raw_key", "persisted evidence_span", "clarity-verdict
   token?" rows in the table at lines 204-211, OR leave the row
   templates intact and explicitly mark Phase 4b NOT-RUN (which caps
   the verdict at PARTIAL but still satisfies the L5 retroactive
   lint due to the inspection-pattern language). No action required
   from the implementer; this is the operator's post-merge
   responsibility.

3. The intentional ban-list-violation fixture
   `family-h-ban-list-response.json` carries `"the claim is weak and
   the speaker is sloppy"` as its `evidenceSpan.claim_specificity_low`.
   This is the test fixture against which the runtime scanner is
   verified, but it is also the one place in the diff that contains a
   bare verdict-token sequence. This is intentional and matches G's
   `ban-list-response.json` precedent exactly; the
   `familyHAdversarialDoctrine.test.ts:331-346` test asserts the
   scanner correctly rejects it with path `evidenceSpan.claim_
   specificity_low`. No action required.

## Operator next steps

- Push the branch: `git push -u origin feat/MCP-SERVER-009-FAMILY-H`
- Open PR: `gh pr create --title "MCP-SERVER-009-FAMILY-H: ship Family H
  claim_clarity admin_validation-only (Card 1/3)" --body-file
  docs/reviews/MCP-SERVER-009-FAMILY-H.md`
- Deploy steps after merge: NONE — both the MCP server (Deno Deploy)
  and the Edge Functions (Supabase GitHub integration) auto-deploy
  on merge to `main`. No `npx supabase db push` (no migration). No
  `npx supabase functions deploy` (auto). No env var change.
- Post-merge smoke (operator-run): execute the 8-phase smoke at
  `docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-template.md`:
  - Phase 3: `MCP_HOSTED_TOKEN=<redacted> bash scripts/mcp-server-001-smoke.sh
    https://cdiscourse-mcp-server.civildiscourse.deno.net` expect
    23/23 PASSES exit 0.
  - Phase 4 + 4b: live Edge admin_validation against Fixtures C/D/E/F;
    query persisted `argument_machine_observation_results.evidence_span`
    rows; scan for the 17 D5 clarity-verdict tokens.
  - Phase 6: re-run `npm run typecheck` / `npm run lint` / `npx jest`
    / `cd mcp-server && deno test`; capture exit codes.
  - Phase 7: 8-family operational state table; CI provenance.
  - Phase 8: pre-push `node scripts/ops/audit-lint.mjs
    docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-<date>.md` exit 0.
- Post-merge worktree cleanup: per `.claude/agents/roadmap-reviewer.md`
  § "Post-merge worktree cleanup (operator step)" — from the main repo
  root, run `git worktree list | grep feat/MCP-SERVER-009-FAMILY-H`,
  then `git worktree remove -f -f <path>`, then
  `git branch -D feat/MCP-SERVER-009-FAMILY-H`, then verify with
  `git worktree list | grep -c agent` returning 0.
- Chain follow-up: Card 2 (`MCP-SERVER-009-FAMILY-H-AUDIT-LINT-L5`)
  authorized to run after this card lands (doctrine-risk YES; design
  §A.5 D9/D13 records the Gate A determination). Card 2 will add
  `family_h` to `DOCTRINE_RISK_FAMILIES` in
  `scripts/ops/audit-lint-rules.cjs`. Card 3
  (`MCP-021C-EDGE-FAMILY-H-ENABLE`) flips the Edge production gate
  + re-measures 8-family latency.
