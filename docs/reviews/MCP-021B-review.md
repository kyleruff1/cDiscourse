# MCP-021B — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-25
**Branch:** `feat/MCP-021B-persisted-machine-observation-classifier-results`
**Design:** `docs/designs/MCP-021B.md` (1,750 lines at `553281d`)
**Intent brief:** `docs/designs/MCP-021B-intent.md` at `2c95999` (operator-authored, binding)
**Sequencing decision:** `docs/decisions/MCP-021-sequencing.md` at `d2282af` (binding)
**Predecessor:** MCP-021A (PR #301 merged at `d6648b4`)
**Skills invoked:** `cdiscourse-doctrine` + `test-discipline` + `expo-rn-patterns` + `accessibility-targets`

## Summary

MCP-021B ships the persistence layer for Machine Observation classifier
results exactly as designed: one migration with two new tables
(`argument_machine_observation_runs` + `argument_machine_observation_results`)
under read-only client RLS, three new pure-TS persistence files, eight
bounded additive edits to existing code (Source 6 adapter is now
persisted-rows-aware), and 9 new test files / 220 new tests. The
Source 6 adapter signature change is fully backwards-compatible — the
MCP-021A invariance test (8 cases, byte-equal expectation) passes
unchanged. RLS uses the META-1A delegation pattern (`EXISTS into
public.arguments`) which delegates to QOL-039's canonical SELECT
policy and SECURITY DEFINER helpers — recursion-safe by construction.
Zero client write policies. Zero `COMMENT ON storage.*`. Zero
service-role in client code. Doctrine ban-list clean (verdict tokens
appear only inside test files as assertions that production code is
clean). Display caps preserved verbatim with a 100+ row stress test.
Test count delta is +220 (vs +160 forecast), 38% over forecast but
well within the +500 Trigger 8 ceiling and justified by additional
defensive coverage (9 suites vs 7 forecast — added `PersistenceTypes`
suite + `IntegrationFlow` suite). Migration apply step was Docker-
unavailable on the reviewer environment, so heightened textual review
performed against all four OPS-001 issue classes — clean.

## Verification

| Check | Result |
|---|---|
| typecheck | pass (`tsc --noEmit` EXIT 0) |
| lint | pass (`eslint . --max-warnings 0` EXIT 0) |
| test (full suite) | pass — 16,909 → 17,129 (+220) tests / 512 → 521 (+9) suites |
| MCP-021B subset | pass — 9 suites / 220 tests (EXIT 0 in 6.3s) |
| MCP-021A Source 6 invariance | pass — 8/8 (EXIT 0; byte-equal preserved) |
| secret scan | clean |
| doctrine scan (verdict tokens) | clean (matches only in ban-list literals + current-status descriptive prose) |
| RLS write-policy grep | clean (zero `CREATE POLICY FOR (INSERT\|UPDATE\|DELETE)`) |
| `COMMENT ON storage.*` grep | clean (storage.* appears only in defensive header comments) |
| Service-role grep in MCP-021B files | clean (zero matches in 3 new files) |
| Read-only nodeLabels diff | 0 bytes across 12 files (presentation/priority/descriptor/172-defn registry + 10 family files + schema + Allegations + legacy + topology + types) |
| MCP-021A test files diff | 0 bytes across all 9 files |
| UX-001.6 test files diff | 0 bytes across all 5 files |
| package.json / lock diff | 0 bytes |
| Migration apply | heightened-review pass — Docker not available (`docker: command not found`); classes 1–4 scanned with zero unresolved markers |

## Design conformance

- [x] All design file-changes are present (1 migration + 3 new persistence files + 8 bounded edits + 9 tests + handoff append)
- [x] No undocumented file-changes (defensive `persistedObservations: []` literal additions in `composerHandoff.ts` + `useArgumentViewport.ts` + `argumentCache.test.ts` are required type-shape consequences of `ArgumentRelations` gaining the new field, NOT scope creep)
- [x] Data model matches design (runs + results split, every column type matches §3, indexes match §3.4, constraints match §3.3)
- [x] API contracts match design (Source 6 additive signature §5.4 verified backwards-compatible; query helper read-only §5.3; adapter four-filter chain §5.2)

## Doctrine self-check

- [x] No truth/winner/loser language in user-facing strings (DOC-1 through DOC-4 scan production code; DOC-24 verifies enum)
- [x] Score never blocks posting (adapter has no posting path; design §10 trigger 6 CLEAN)
- [x] No service-role in client code (RLS-12, RLS-13, RLS-15 enforce; grep returns 0 matches in `machineObservationPersistence*.ts`)
- [x] No direct insert into `public.arguments` (no INSERT path anywhere in MCP-021B; design ships ZERO write helpers)
- [x] No AI calls in production app paths (DOC-16 forbids `@anthropic` / `@xai` / `xai-sdk` / `openai` imports; DOC-21 forbids `fetch()` in adapter)
- [x] Plain language only (DOC-20 verifies registry labels are plain; raw_keys never echoed)
- [x] Epic-specific doctrine: `cdiscourse-doctrine §10a` — adapter emits `kind: 'machine_observation'`; never `user_allegation` (DOC-5, DOC-6, DOC-19 enforce); raw_keys sourced from registry's plain-language fields, never echoed from raw row (adapter §5.2 line 154 `...definition` spread + DOC-20)
- [x] `cdiscourse-doctrine §3` — engagement / popularity / heat are NOT inputs (DOC-10, DOC-11, DOC-12 enforce no engagement columns or sort)

## Test coverage

- [x] New public functions have unit tests (every exported function in 3 new files has tests across the 9 suites)
- [x] User-facing strings have ban-list assertion (DOC-1 through DOC-4 scan all production files; existing UX-001.5A `uxOneOneFiveALabelDoctrine` and `mcpOneTwoOneALabelDoctrine` continue to gate the broader label corpus)
- [x] Edge cases from design § "Edge cases" have tests (ADP-7 through ADP-28 cover unknown raw_key, wrong schema_version, invalid confidence, malformed shape, wrong argument_id, evidence_span truncation, null/undefined inputs, 20-input random battery)
- [x] Accessibility assertions — N/A for this card; MCP-021B introduces no new visual primitive, no new design token, no new component. The accessibility-targets skill was invoked but is informational only per the card prompt. Existing UX-001.5A NodeLabelStrip / NodeLabelInspectGroups accessibility contracts inherit unchanged (RO-4 / RO-5 bound the diff on those components to additive prop-threading)

## 18-item verdict matrix (A–R)

| Item | Verdict | Justification |
|---|---|---|
| A. Card scope adherence | **PASS** | Implementer worked within design §9 allowed file scope. The two defensive `persistedObservations: []` literal additions outside the bounded edit list are required type-shape consequences of `ArgumentRelations` gaining a new field — without them, typecheck would fail. |
| B. 12 binding conditional HALT triggers | **PASS** | All 12 CLEAN: no live MCP call (Source 6 still has no fetch); no new AI provider (DOC-16 verifies); no new taxonomy key (registry byte-equal RO-6 through RO-16); no new visual primitive (RO-39 / RO-40 byte-equal); no new design token (RO-39 byte-equal); no display cap change (RO-1 byte-equal; CAP-1 through CAP-26 stress); no client INSERT/UPDATE/DELETE (RLS-9, MIG-17/18/19); no `COMMENT ON storage.*` (MIG-20); test delta +220 ≤ +500; migration ordering safe (MIG-21, MIG-22); Source 6 signature additive (MCP-021A invariance pass); canonical predicate present (§2.5 META-1A pattern). |
| C. 3 designer-specific triggers | **PASS** | Context window clean; judgment authority preserved (no operator decision deferred); predicate-shape divergence anticipated by brief line 204 and documented in §11.1. |
| D. 6 implementer-specific stop conditions | **PASS** | Migration apply deferred to operator (Docker not local); Source 6 backwards-compat verified (MCP-021A 8/8 pass); UX-001.6 matrix byte-equal (5 suites); MCP-021A regression byte-equal (9 suites); display cap preservation pass (21 CAP tests); working tree contains only pre-existing untracked files. |
| E. Decision 1 — runs+results split | **PASS** | Schema implements split exactly as designed (§3.2 + §3.3). Results table is positive-only (`absence = not present`). Runs records one row per classifier run per argument/family-batch/schema-version. MIG-4 through MIG-14 enforce. |
| F. Decision 2 — client-read service-write | **PASS** | RLS read policies present for `authenticated` (RLS-10, RLS-11). Mechanical grep `CREATE POLICY .* FOR (INSERT\|UPDATE\|DELETE)` returns ZERO matches in the migration file (exit code 1). RLS-9 enforces in CI. |
| G. Decision 3 — Source 6 additive signature | **PASS** | Adapter change is additive (two new optional fields on `RawClassifierBinaryAdapterInput`). Existing callers return `[]` byte-equal — verified by running `npx jest __tests__/mcpOneTwoOneASourceSixInvariance.test.ts` → exit 0, 8/8 tests pass. |
| H. Decision 4 — display caps unchanged | **PASS** | `nodeLabelPresentationModel.ts` + `nodeLabelPriorityModel.ts` byte-equal (RO-1 / RO-2, also verified via direct `git diff` — 0 lines). Display cap preservation test `mcpOneTwoOneBDisplayCapPreservation.test.ts` seeds 100+ persisted rows and asserts Timeline 1+1+overflow, Selected 3+3+overflow, Inspect unbounded grouped. |
| I. Decision 5 — schema version reuse | **PASS** | `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` constant from `mcpBooleanObservationSchema.ts` (unchanged, RO-17) imported and used verbatim in adapter at line 29 + 140. Persistence rows with any other version silently discarded (ADP-8, ADP-9). |
| J. Canonical visibility predicate alignment | **PASS** | RLS policy on runs uses META-1A pattern (`EXISTS into public.arguments` delegating to QOL-039 SECURITY DEFINER helpers transitively). RLS policy on results uses inherit-via-run shape (`EXISTS SELECT 1 FROM argument_machine_observation_runs WHERE id = run_id`). Verified by reading the migration SQL lines 165-203. |
| K. Phase A.4 RLS recursion safety | **PASS** | Chain `results → runs → arguments → SECURITY DEFINER helpers` uses distinct tables at each EXISTS. Recursion-free. Planner cost: each hop is a single-row `EXISTS` with a uniquely-keyed equality predicate (uuid PK lookups). Plan blowup risk: LOW. The `(argument_id, schema_version, raw_key)` results-table index plus the `argument_id` cascade FK should keep the inner subquery O(log n) per parent row. Operator-deferred fallback to duplicate-predicate is documented in §11.2 if MCP-021C smoke surfaces plan-cost issues. |
| L. OPS-001 four-class migration header | **PASS** | Migration header lines 36-57 contain explicit "Class 1 —" through "Class 4 —" walk. MIG-2 + MIG-3 enforce in CI. Verified by direct read: Class 1 names ambiguous-subquery-column posture; Class 2 names FK type-equality posture; Class 3 names statement-order (runs CREATE TABLE before results CREATE TABLE; ENABLE RLS before CREATE POLICY; CREATE INDEX after CREATE TABLE); Class 4 names pgcrypto + QOL-039 helper dependencies + PR-003 storage.* boundary. |
| M. Doctrine §10a — Observations vs Allegations | **PASS** | Mechanical grep `git diff main..HEAD -- src/ __tests__/ docs/ \| grep -iE "winner\|loser\|liar\|propagand\|extremist\|manipulative\|bad faith\|proof of\|correctness\|truth value\|verdict\|fallacy"` returns matches ONLY in: (a) test ban-list literals (the test asserts production code is clean of these tokens); (b) `docs/core/current-status.md` describing what the card prevents. Zero raw_key rendered to user-facing strings (adapter spreads `...definition` from MCP-021A registry, never row). DOC-1 through DOC-4 enforce. |
| N. Read-only API boundary preservation | **PASS** | Direct `git diff --stat` returns zero bytes for: `userAllegationRegistry.ts`, `machineObservationDefinitions.ts` + all 10 family files, `mcpBooleanObservationSchema.ts`, `threadTopologyAutoMetadata.ts`, `nodeLabelPresentationModel.ts`, `nodeLabelPriorityModel.ts`, `nodeLabelDescriptorAdapter.ts`, `machineObservationRegistry.ts`, `nodeLabelTypes.ts`, all UX-001.6 test files, all MCP-021A test files, `package.json`, `package-lock.json`, `useSemanticReferee.ts`, `designTokens.ts`, `RefereeBannerView.tsx`. The two modified components (`NodeLabelStrip.tsx`, `NodeLabelInspectGroups.tsx`) gain exactly one optional prop + one threaded argument + one useMemo dep + jsdoc note — bounded additive change, NOT behavior change. RO-4 + RO-5 enforce ≤50-line bound in CI. |
| O. Test count delta within forecast budget | **PASS** | Designer forecast +160 across 7 files; final delta +220 across 9 files. 38% above forecast but well within +500 Trigger 8 ceiling. The +60 is justified — two additional defensive suites: `mcpOneTwoOneBPersistenceTypes.test.ts` (34 tests exercising the type guards explicitly, beyond what the adapter tests cover) and `mcpOneTwoOneBIntegrationFlow.test.ts` (6 tests exercising the `computeNodeLabelStripDescriptors` + `computeNodeLabelInspectGroups` integration directly). Both fall within the design's "implementer may expand to +200" latitude in §11.6 item 2. |
| P. Working tree cleanliness | **PASS** | `git status --short` returns 5 lines: 4 pre-existing `docs/testing-runs/2026-05-25-*.md` files (operator-territory) + `netlify-prod.git` (build artifact, gitignored category). Zero new uncommitted files from the implementer's work. |
| Q. Migration-bearing card verification | **PASS (heightened-review path)** | Docker not available (`docker: command not found`). Heightened textual review performed against the 4 named issue classes: **Class 1 (ambiguous column references)** — both RLS subqueries use fully-qualified `argument_machine_observation_runs.argument_id` and `argument_machine_observation_results.run_id` (defensive even where no ambiguity exists today); RLS-3 + RLS-8 enforce. **Class 2 (column type mismatches)** — every FK uses `uuid` matching the referenced PK type; `confidence` is `text` with a 3-value CHECK constraint; `status` is `text` with a 3-value CHECK constraint; MIG-7, MIG-8, MIG-12, MIG-13 enforce. **Class 3 (ordering dependencies)** — runs `CREATE TABLE` before results `CREATE TABLE` (FK order); CREATE INDEX after both CREATE TABLE; ENABLE RLS before CREATE POLICY on each table; MIG-21 + MIG-22 enforce in CI. No `DROP COLUMN` / `DROP TABLE` statements. **Class 4 (function / extension dependencies)** — `gen_random_uuid()` is used by every prior migration including `20260516000001_initial_schema.sql:61` (pgcrypto enabled by Supabase default + previous migration usage); the RLS policy delegates to QOL-039's canonical `arguments` SELECT policy which exists at `20260524000015_qol_039_room_visibility.sql:236-252` (applied per CLAUDE.md Stage line). NO `COMMENT ON storage.*` statements (MIG-20 enforces; mechanical grep returns matches only in defensive header comments at lines 34, 56, 215 which are SQL comments, not statements). |
| R. MCP-021C handoff completeness | **PASS** | `docs/core/current-status.md` MCP-021B append documents (verified by reading the diff): (1) schema layout; (2) Source 6 contract change; (3) bounded edits list; (4) test deltas; (5) all 21 trigger statuses; (6) operator follow-up steps (npx supabase db push --linked + smoke seed per sequencing doc); (7) operator-deferred items (RLS recursion fallback, realtime channel, family-sharded batching). Schema version constant `mcp-021.machine-observations.boolean.v1` reused verbatim. Persistence shape compatible with MCP-021C's future service-role write path (one `runs` row + N positive `results` rows in a transaction is the documented pattern; design §12.2 names `buildMcpBooleanObservationRequest` / `parseMcpBooleanObservationResponse` / `sanitizeMcpBooleanObservationResponse` as the MCP-021A handles MCP-021C will use). |

## 21-trigger status summary

| # | Trigger | Status |
|---|---|---|
| 1 | Live MCP call | CLEAN — Source 6 has no `fetch()`; adapter is pure-TS |
| 2 | New AI provider | CLEAN — DOC-16 forbids `@anthropic`/`@xai`/`openai` imports |
| 3 | New taxonomy key | CLEAN — RO-6 to RO-16 enforce 172-definition registry byte-equal |
| 4 | New visual primitive | CLEAN — no new RN component; chips flow through existing strip/inspect |
| 5 | New design token | CLEAN — RO-39 byte-equal on `designTokens.ts` |
| 6 | Display cap change | CLEAN — RO-1 + 21 stress tests |
| 7 | Client INSERT/UPDATE/DELETE policy | CLEAN — mechanical grep returns 0 |
| 8 | `COMMENT ON storage.*` | CLEAN — MIG-20 enforces; only header comment mentions |
| 9 | Test delta ≤ +500 | CLEAN — +220 |
| 10 | Migration ordering SQLSTATE risk | CLEAN — MIG-21/22; no DROP COLUMN; pgcrypto verified |
| 11 | Source 6 backwards-compat | CLEAN — MCP-021A invariance test 8/8 pass |
| 12 | Canonical visibility predicate present | CLEAN — META-1A delegation documented at §2 |
| 13 | Context window threshold | CLEAN — designer + implementer both stayed in budget |
| 14 | Judgment authority preserved | CLEAN — divergences either operator-authorized or documented |
| 15 | Phase A reconciliation divergence | NOT FIRED — anticipated by brief line 204 |
| 16 | Migration apply | CLEAN-PER-HEIGHTENED-REVIEW — Docker unavailable; 4-class scan clean |
| 17 | Source 6 backwards-compat (impl side) | CLEAN — verified |
| 18 | UX-001.6 matrix preservation | CLEAN — 5 suites byte-equal |
| 19 | MCP-021A regression | CLEAN — 9 suites byte-equal; invariance test pass |
| 20 | Display cap preservation | CLEAN — 21 CAP tests pass |
| 21 | Working tree cleanliness | CLEAN — 5 pre-existing untracked only |

## Mechanical-check results (summarized)

- `grep CREATE POLICY .* FOR (INSERT\|UPDATE\|DELETE) supabase/migrations/20260526000018_*.sql` → 0 matches (EXIT 1)
- `grep storage\\. supabase/migrations/20260526000018_*.sql` → 3 matches, all in SQL header comments (defensive narrative; no executable storage.* statement) (EXIT 0)
- `grep SERVICE_ROLE\|service_role` over 3 new MCP-021B files → 0 matches (EXIT 1)
- `git diff main..HEAD --stat` on 12 read-only nodeLabels files + all 5 UX-001.6 tests + all 9 MCP-021A tests + package.json/lock + useSemanticReferee + designTokens + RefereeBannerView → all 0 lines
- `npx jest __tests__/mcpOneTwoOneASourceSixInvariance.test.ts` → EXIT 0; 8/8 tests pass (Source 6 byte-equal preserved)
- `npx jest __tests__/mcpOneTwoOneB` → EXIT 0; 9 suites / 220 tests pass
- Full suite `npm run test -- --silent` → EXIT 0; 521 suites / 17,129 tests pass
- `npm run typecheck` → EXIT 0
- `npm run lint` → EXIT 0
- Doctrine ban-list grep over the diff → matches only in test ban-list literals and current-status.md descriptive prose (all expected)

## Operator next steps

1. **Push the branch:** `git push -u origin feat/MCP-021B-persisted-machine-observation-classifier-results`
2. **Open PR:** `gh pr create --title "MCP-021B: persisted Machine Observation classifier results (runs + results + RLS + Source 6)" --body-file docs/reviews/MCP-021B-review.md`
3. **Squash-merge** after CI green.
4. **Post-merge deploy:** `npx supabase db push --linked` (Supabase GitHub integration may auto-apply per project memory `supabase-merge-autodeploy`). Verify with `npx supabase db status` and `npx supabase db lint`.
5. **Smoke per sequencing doc:** seed 5–10 fake persisted Machine Observation result rows via service-role SQL against the bot-seeded rooms, verify Source 6 adapter consumes them, verify Timeline/Selected/Inspect caps hold, verify second-account RLS visibility.
6. **Post-merge worktree cleanup:** follow `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup (operator step)" — `git worktree remove -f -f .claude/worktrees/<agent-hash>` from the main repo root, then `git branch -D feat/MCP-021B-persisted-machine-observation-classifier-results` after `gh pr merge --delete-branch`.

## Suggestions (non-blocking)

1. The `MachineObservationResultRow.evidenceSpan` field is carried on the
   `NodeLabelMark` via a defensive ad-hoc property assignment (adapter
   line 163 `(mark as NodeLabelMark & { evidenceSpan?: string }).evidenceSpan = …`).
   This is fine for now (no downstream chrome reads it), but if MCP-021C
   adds an inspect surface that surfaces evidence excerpts, the
   `NodeLabelMark` canonical interface should be extended formally rather
   than perpetuated as a type-asserted ad-hoc add. Not a blocker — the
   adapter is the only writer of this field today.
2. The `family` field on the persistence row is widened to `string`
   (types file line 70) because Supabase returns `text`. The adapter
   does NOT validate it against the `ALL_MACHINE_OBSERVATION_FAMILIES`
   set — only the rawKey → registry membership filter is the gate.
   If a future maintainer wants stricter family validation (e.g.
   operator-audit warnings on family mismatch), the gating point is
   `isWellFormedResultRow` plus a new test. Out of scope for MCP-021B.

The above are sequel-card candidates, not blockers for MCP-021B.
