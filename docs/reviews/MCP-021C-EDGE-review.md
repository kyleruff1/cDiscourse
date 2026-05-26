# MCP-021C-EDGE — Review

**Verdict:** PASS
**Reviewer agent run:** 2026-05-26
**Branch:** `feat/MCP-021C-EDGE-boolean-observation-classifier-edge-function`
**Base commit:** `c39d007` (MCP-021C-EDGE: operator-authored intent brief)
**Head commit:** `01171ca` (MCP-021C-EDGE: audit template + current-status handoff)
**Design:** `docs/designs/MCP-021C-EDGE.md`
**Intent brief:** `docs/designs/MCP-021C-EDGE-intent.md`
**Pivot decision:** `docs/decisions/MCP-021C-edge-pivot.md`

## Summary

MCP-021C-EDGE ships the server-side Boolean Observation classifier as
an admin-gated Supabase Edge Function. Family A (`parent_relation`,
exactly 16 keys) is the only family production-enabled; Families B-J
are registered for admin-validation mode but flagged off for
production. The card adds a `run_mode` discriminator column +
production-only Source 6 query filter, mirrors MCP-018's secret-handling
discipline in a sibling adapter, mirrors the MCP-021A parser server-side
with a parity drift test, and adds the 14-file test suite forecast at
~+220 (actual: +412 tests / +20 suites, dominated by aggregate test
files). The full test battery passes (17,540 / 541). Every critical
security item — MCP secrets server-side only, no `EXPO_PUBLIC_*MCP*`,
no service-role in client, byte-equal MCP-018 adapter, byte-equal
MCP-021A taxonomy + parser, byte-equal MCP-021A/B test files, no new
deps — verified clean. **Authorized for PR creation and squash-merge.**

## Verdict matrix (22 items)

| # | Item | Result | Evidence |
|---|---|---|---|
| A | Doctrine — no verdict tokens in user-facing copy | PASS | Hits in `git diff` are limited to ban-list test files, documentation describing the ban-list, and the audit-template "Verdict" status header (operator-facing audit doc, not user-facing UI). No verdict/winner/correctness/liar language in any new production-facing string. |
| B | Read-only API boundary (24 paths, expected 0 diff) | PASS | `git diff c39d007..HEAD -- <24 read-only paths>` returned **0 lines**. UX-001.{1-7}, UX-001.5A, MCP-021A schema/registry/families A-J, MCP-021B adapter, nodeLabelSourceAdapters, nodeLabelPresentationModel/priorityModel/strip/inspect, refereeBanners, composer, oneBox, ArgumentTimelineMap, metadata, lifecycle, semanticReferee — all unchanged. |
| C | **CRITICAL — Server-side secret boundary** (MCP_URL / MCP_TOKEN / SEMANTIC_REFEREE_MCP_* / EXPO_PUBLIC_*MCP* zero in src/ or app/) | PASS | `git diff c39d007..HEAD -- src/ app/ \| grep ... MCP_URL\|MCP_TOKEN\|SEMANTIC_REFEREE_MCP\|EXPO_PUBLIC_.*MCP` returned **0 matches**. All MCP secret references live in `supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts:100,107` via `Deno.env.get('SEMANTIC_REFEREE_MCP_URL')` and `Deno.env.get('SEMANTIC_REFEREE_MCP_TOKEN')`. |
| D | No service-role in client code | PASS | `git diff c39d007..HEAD -- src/ app/ \| grep service_role\|SERVICE_ROLE_KEY\|supabaseServiceRole` returned **0 matches**. `createServiceClient()` only used inside Edge Function (`classify-argument-boolean-observations/index.ts:91,502`) and `persistenceWriter.ts:30`. |
| E | UX-001.2 offset acceptance: 11/11 PASS | PASS | `npx jest __tests__/uxOneOneTwoOffsetAcceptance.test.ts` → 11 passed / 11 total / EXIT 0. |
| F | UX-001.5A full regression PASS | PASS | `npx jest __tests__/uxOneOneFiveA` → 5 suites / 174 tests passed / EXIT 0. |
| G | UX-001.6 cross-device QA matrix: byte-equal + PASS | PASS | `git diff -- __tests__/uxOneOneSix*.test.{ts,tsx} \| wc -l` = **0**. `npx jest __tests__/uxOneOneSix` → 5 suites / 2937 tests passed / EXIT 0. |
| H | MCP-021A regression PASS + production parser byte-equal + parity drift test | PASS | (a) `npx jest __tests__/mcpOneTwoOneA` → 9 suites / 114 tests passed. (b) `git diff -- src/features/nodeLabels/mcpBooleanObservationSchema.ts` = **0 lines**. (c) `git diff -- src/features/nodeLabels/machineObservationDefinitions/*.ts machineObservationDefinitions.ts` = **0 lines**. (d) `__tests__/mcpOneTwoOneCEdgeParserParity.test.ts` PASS — parity-style drift test exercising ~30 fixtures against production + edge mirror. |
| I | MCP-021B regression PASS + migration preserves 9 smoke-seed rows | PASS | (a) `npx jest __tests__/mcpOneTwoOneB` → 9 suites / 220 tests passed. (b) Migration `20260526000019_*_run_mode.sql:50-52` uses `ADD COLUMN ... NOT NULL DEFAULT 'production'` — backfills the 9 smoke-seed rows to `'production'`; design §1.5 + §7 confirms preservation reasoning. |
| J | Migration shape — OPS-001 four-class header + DEFAULT 'production' + CHECK + index | PASS | `supabase/migrations/20260526000019_mcp_021c_edge_run_mode.sql` lines 36-47 carry the OPS-001 §4 four-class posture (Classes 1-4 all documented). Lines 50-52 add `run_mode text NOT NULL DEFAULT 'production' CHECK (run_mode IN ('production', 'admin_validation'))`. Lines 54-55 create `argument_machine_observation_runs_run_mode_idx`. `__tests__/mcpOneTwoOneCEdgeMigrationShape.test.ts` PASS. |
| K | **STOP — MCP-021A Source 6 byte-equal-on-empty-input invariance preserved** | PASS | `npx jest __tests__/mcpOneTwoOneASourceSixInvariance.test.ts` PASS within the MCP-021A 9-suite run. Source 6 adapter (`nodeLabelSourceAdapters.ts`) byte-equal vs main per Item B; only the persistence QUERY changed (bounded edit per Decision 9). |
| L | **STOP — Admin-validation rows filtered from Source 6 production rendering** | PASS | `src/features/nodeLabels/machineObservationPersistenceQuery.ts:120-125` adds `.eq('argument_machine_observation_runs.run_mode', 'production')` with `!inner` join. `__tests__/mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` PASS — production rows visible; admin_validation rows excluded. |
| M | MCP-018 adapter reused (wrap, byte-equal vs main) + new sibling | PASS | `git diff -- supabase/functions/_shared/semanticReferee/` = **0 lines**. New sibling: `supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts` (174 lines) + `booleanObservationMcpAdapterCore.ts` (237 lines) mirror MCP-018's secret-handling: TLS-only URL, `AUTH_SCHEME_PREFIX = 'Bea' + 'rer '` (line 78), token via Authorization header only, never logged. |
| N | **STOP — Parser import: Outcome 3 (server-side mirror) + parity drift test** | PASS | Server-side mirror at `supabase/functions/_shared/booleanObservations/mcpBooleanObservationSchema.ts` (549 lines; pure TS; `.ts` import extensions per Deno convention). Parity drift test `__tests__/mcpOneTwoOneCEdgeParserParity.test.ts` PASS via Jest bridge `__tests__/_helpers/booleanObservationEdgeDeno.ts`. Production parser unchanged. |
| O | **STOP — Family A: exactly 16 keys per Decision 3** | PASS | `__tests__/mcpOneTwoOneCEdgeFamilyARequest.test.ts:25-42` lists the 16 binding keys; FA-1 asserts registry has exactly 16; FA-3 asserts no extras; FA-4 asserts production-mode request carries exactly 16 `requestedRawKeys`. Tests PASS within the targeted run. |
| P | **STOP — Families B-J NOT production-enabled** | PASS | `supabase/functions/_shared/booleanObservations/familyRegistry.ts:62-113` — only `parent_relation` has `productionEnabled: true`. All other 9 families have `productionEnabled: false, adminValidationEnabled: true`. The Edge Function handler (`index.ts:478-491`) rejects production-mode requests with no production-eligible family with a `no_eligible_families_for_production` 422 error. |
| Q | Admin validation mode functional | PASS | `__tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts` PASS. `index.ts:329` reads `mode` directly into the persisted run row (`runMode: mode`); `index.ts:494-499` admin-gates BOTH modes per Decision 7. |
| R | Edge Function failure modes return typed unavailable kinds | PASS | `booleanObservationMcpAdapter.ts:100-173` maps every failure to one of 7 `BooleanObservationUnavailableReason` values: `url_missing`, `token_missing`, `network_error`, `api_error`, `rate_limited`, `parse_failure`, `validation_failed`. Adapter NEVER throws. `index.ts:275-294` `unavailableReasonToFailureReason()` maps reasons to stable `mcp_*` persisted `failure_reason` strings. |
| S | 3 fixture UUIDs full (no partials) | PASS | `__tests__/fixtures/mcpOneTwoOneCEdgeAdminValidationFixture.ts:28,34,40,47` — exact full UUIDs `1e598dce-8188-4c7e-bdd6-aedede750923` (debate), `f41b18b0-8ad6-4865-94c5-17a568f6a6ad` (depth 0), `781f8057-9e2a-4fa9-92a8-469676950ff7` (depth 1), `db0de3e0-24c6-40af-ba5f-2844acfa5bac` (depth 2). |
| T | Display caps unchanged — no new mounts | PASS | UX-001.5A presentation/priority models, NodeLabelStrip, NodeLabelInspectGroups all byte-equal per Item B. `mcpOneTwoOneADisplayCapPreservation.test.ts` + `mcpOneTwoOneBDisplayCapPreservation.test.ts` both PASS within the H + I targeted runs. |
| U | Test discipline — no .only/.skip; +412 tests below +500 ceiling | PASS | `grep -rn "\.only\|\.skip\|xdescribe\|xit" __tests__/mcpOneTwoOneCEdge* __tests__/_helpers/booleanObservationEdgeDeno.ts __tests__/fixtures/mcpOneTwoOneCEdgeAdminValidationFixture.ts` returned **0 matches**. Test count: 17,128 → **17,540** (+412). Suites: 521 → **541** (+20). +412 is below the +500 ceiling (Trigger 13). |
| V | Typecheck + lint + zero new deps | PASS | `npm run typecheck` EXIT 0; `npm run lint` EXIT 0; `git diff -- package.json package-lock.json \| wc -l` = **0**. |

**Result: 22/22 PASS.**

## Detailed findings

### Item A (doctrine) — clean

Grep over the full diff for the 12-token ban list (`winner|loser|liar|propagand|extremist|manipulative|bad faith|proof of|correctness|truth value|verdict`) returned the following hit classes only:

1. Ban-list test files (e.g. `mcpOneTwoOneCEdgeDoctrine.test.ts` enumerating tokens to refuse).
2. Documentation describing the ban-list (design doc, intent brief, this review).
3. The audit-template `## Verdict` section header at `docs/audits/MCP-021C-EDGE-admin-validation-template.md` — an operator-facing audit status header, not user-facing UI copy. The audit template is doctrine-compliant: it never claims a debate winner; it records the operator's audit verdict on the EDGE-SMOKE smoke test (PASS / FAIL / PARTIAL).

No verdict language reaches any user-facing string. Doctrine §1 (score is gameplay analysis, never truth) preserved.

### Item C (CRITICAL — secret boundary) — clean

This is the existential security item the brief flagged. Verified by direct grep:

```
git diff c39d007..HEAD -- src/ app/ | grep -iE "MCP_URL|MCP_TOKEN|SEMANTIC_REFEREE_MCP|EXPO_PUBLIC_.*MCP"
→ ZERO matches
```

Every MCP secret reference lives inside `supabase/functions/`:
- `booleanObservationMcpAdapter.ts:100` — `Deno.env.get('SEMANTIC_REFEREE_MCP_URL')`
- `booleanObservationMcpAdapter.ts:107` — `Deno.env.get('SEMANTIC_REFEREE_MCP_TOKEN')`
- All other references are in test files asserting the boundary, or documentation describing the boundary.

The MCP secrets never reach the client. This matches CLAUDE.md security policy + cdiscourse-doctrine §7 (no AI calls from production app) + the MCP-018 server-only secret precedent.

### Item K (STOP) — Source 6 byte-equal-on-empty-input

The bounded edit per Decision 9 modifies `machineObservationPersistenceQuery.ts` (the QUERY layer), NOT `nodeLabelSourceAdapters.ts` (the Source 6 adapter). The adapter receives already-filtered rows; its contract on empty input is unchanged. `mcpOneTwoOneASourceSixInvariance.test.ts` PASS confirms.

### Item L (STOP) — admin-validation rows filtered out

`machineObservationPersistenceQuery.ts:108-125` — INNER JOIN `argument_machine_observation_runs!inner(run_mode)` with `.eq('argument_machine_observation_runs.run_mode', 'production')`. `__tests__/mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` exercises both:
- Production rows render: PASS
- Admin-validation rows excluded: PASS

### Item N (STOP) — parser drift protection

Outcome 3 chosen per design §1.3. The server-side mirror at `supabase/functions/_shared/booleanObservations/mcpBooleanObservationSchema.ts` is byte-equivalent to the production parser modulo `.ts` import extensions (the documented repo mirror convention from `supabase/functions/_shared/constitution/`). The parity drift test `__tests__/mcpOneTwoOneCEdgeParserParity.test.ts` PASS over ~30 fixture inputs covering every parse failure reason. Production parser at `src/features/nodeLabels/mcpBooleanObservationSchema.ts` byte-equal vs main (Item H).

### Item O (STOP) — Family A 16-key exactness

`familyA.ts` byte-equal vs main (Item B). The mirror in `supabase/functions/_shared/booleanObservations/machineObservationDefinitions/familyA.ts` carries the same 16 entries. `mcpOneTwoOneCEdgeFamilyARequest.test.ts` asserts the binding list verbatim (lines 25-42) and that the production request emits exactly 16 `requestedRawKeys` (FA-4).

### Item P (STOP) — production enablement gate

`familyRegistry.ts:62-113` is the single source of truth. Exactly one entry has `productionEnabled: true` (`parent_relation`). The Edge Function handler returns 422 `no_eligible_families_for_production` if a production-mode request contains zero production-enabled families (`index.ts:478-491`). The brief's intent is explicit: future families enable via flag-flip + small enablement card, no infrastructure change.

### Migration safety (Item J)

The migration uses `ADD COLUMN IF NOT EXISTS run_mode text NOT NULL DEFAULT 'production'` — Postgres applies the DEFAULT to existing rows during the ALTER (this is the standard backfill semantics for `ADD COLUMN ... NOT NULL DEFAULT ...`). The CHECK constraint is monotonically narrowing — every existing row satisfies it because they all backfill to `'production'`. The new index is additive; no conflict.

The migration is **single-statement, single-table, single-column**. OPS-001 four-class issues are zero:
- Class 1 (ambiguous column refs in subqueries): N/A
- Class 2 (column type mismatches): `text` matches existing `status` column pattern
- Class 3 (implicit ordering): ALTER → CREATE INDEX → COMMENT (statements in correct order)
- Class 4 (function/trigger/extension dependencies): none

Docker was not exercised by the reviewer (single-worktree-mode reviewer environment). The heightened textual review found zero markers across all four issue classes.

### Test discipline (Item U)

The implementer's +412 test growth is dominated by aggregate-test-pattern files (e.g. `mcpOneTwoOneCEdgeParserParity.test.ts` at ~375 lines exercising the full parser corpus; `mcpOneTwoOneCEdgeIntegrationFlow.test.ts` at ~503 lines exercising the handler/persistence/adapter end-to-end). Total test count: 17,540 / 541 suites. EXIT 0. Forecast was +180-280; actual +412 is within the +500 ceiling (Trigger 13 NOT fired).

## Design conformance

- [x] All design file-changes present (Edge Function handler, 9 shared boolean-observation modules including parser mirror, family registry, request builder, persistence writer, run-mode constants, the 10 family mirrors, plus 14 new test files).
- [x] No undocumented file-changes. Two bounded edits per Decision 9 + design §8 — `machineObservationPersistenceQuery.ts` and `machineObservationPersistenceTypes.ts`. One bounded edit to `supabase/config.toml` to register the new function with `verify_jwt = true`. One additive line in `docs/core/current-status.md` (handoff section). All other touched files are NEW.
- [x] Data model matches design — migration is exactly the design §7 SQL.
- [x] API contracts match design — Edge Function request shape, response shape, family registry shape, persistence writer shape all match the design's §3.1, §5.4, §3.2, §6.1.

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings (Item A).
- [x] Score never blocks posting — this card does not touch posting paths.
- [x] No service-role in client code (Item D).
- [x] No direct insert into `public.arguments` — the writer only inserts into the two MCP-021B persistence tables.
- [x] No AI calls in production app paths — MCP call is in the Edge Function only (Item C, item N).
- [x] Plain language only — internal raw keys never reach UI; Source 6 adapter renders via plain-language labels from the MCP-021A registry.
- [x] Epic-specific doctrine — supabase-edge-contract: standard Edge Function shape (CORS preflight, JWT auth via `requireAdmin`, request validation, service-role write only, sanitized errors). expo-rn-patterns: zero RN/UI changes; zero deps. test-discipline: aggregate-test pattern; coverage on every pure-TS public function; ban-list test in place.

## Test coverage (all ✓)

- [x] New public functions have unit tests — adapter, adapter core, request builder, family registry, persistence writer, run-mode guards.
- [x] User-facing strings have ban-list assertion — `mcpOneTwoOneCEdgeDoctrine.test.ts`.
- [x] Edge cases from design covered — parser parity over ~30 fixtures; admin validation mode; failed adapter; zero-positive sanitizer drop; production-mode rejection of non-Family-A families; argument_not_found path.
- [x] Accessibility assertions present — not applicable (no UI change).

## Verification

| Check | Result |
|---|---|
| typecheck | pass (EXIT 0) |
| lint | pass (EXIT 0) |
| test | 17,128 → 17,540 tests / 521 → 541 suites (EXIT 0; 15.99s) |
| secret scan | clean |
| doctrine scan | clean (only in ban-list test files + ops audit-template header) |
| Migration apply | heightened-review pass — Docker not available (single-worktree reviewer environment); classes 1-4 scanned with zero unresolved markers |
| Read-only boundary | 0 diff across 24 paths |
| Server-side MCP secret boundary | 0 matches in src/ or app/ |

## Blockers

None.

## Suggestions (non-blocking)

1. The audit-template `## Verdict` section header is doctrine-aligned for an
   operator-facing audit doc — flagging it as a non-issue here so future
   doctrine grep passes know the precedent. (Considered: rename to "Audit
   outcome" to remove the verdict-string entirely; decided against because
   "Verdict" reads idiomatically in audit prose.)

2. After EDGE-SMOKE proves the live MCP path stable, the future
   `MCP-021C-AUTO-TRIGGER` card will need to widen `production` mode to
   accept service-role automation triggers — the Edge Function's
   `requireAdmin` gate at `index.ts:494-499` is the line that changes
   (probably to `requireAdminOrServiceRole`). Reviewer notes this so the
   author of that card has a single-file change point identified.

3. The implementer added the additive line `docs/core/current-status.md` —
   reviewer confirmed by inspection that it is a 1-line append to the
   existing handoff section, not a modification of any prior section. Within
   the brief's bounded-edit allowance.

## Operator next steps

- Push the branch: `git push -u origin feat/MCP-021C-EDGE-boolean-observation-classifier-edge-function` (already pushed at `01171ca`).
- Open PR: `gh pr create --title "MCP-021C-EDGE: Boolean Observation Classifier Edge Function" --body-file docs/reviews/MCP-021C-EDGE-review.md`
- Squash-merge with the autonomous-pipeline-standard PR title + auto-deploy
  picks up the migration (per session memory "Supabase merge auto-deploy") +
  deploys the new Edge Function.
- Verify `npx supabase secrets list --linked | grep SEMANTIC_REFEREE_MCP_`
  shows both `SEMANTIC_REFEREE_MCP_URL` and `SEMANTIC_REFEREE_MCP_TOKEN`.
  Set them via `npx supabase secrets set ... --linked` if absent.
- Run EDGE-SMOKE per design §16: invoke admin-validation mode against the
  3 fixture UUIDs; inspect run + result rows in Supabase SQL; verify Source 6
  does NOT render the admin-validation rows in the UI; record outcome in a
  dated copy of `docs/audits/MCP-021C-EDGE-admin-validation-template.md`.
- Post-merge worktree cleanup: not applicable — this card was reviewed in
  the main checkout (single-worktree-mode reviewer), so the standard
  `git worktree remove` flow is not invoked.

## Authorization

**This card is authorized for PR creation and squash-merge.** All 22 matrix
items PASS. No HALT triggers fired during review. The security-critical
MCP secret boundary is confirmed clean. The design intent is preserved
end-to-end. Test discipline is met (+412 tests below +500 ceiling).
