# ADMIN-ARGS-INACTIVE-001 — GATE C Review

**Verdict:** **APPROVE**
**Reviewer agent run:** 2026-06-04
**Branch:** `feat/ADMIN-ARGS-INACTIVE-001-argument-inactive-state`
**Tip commit:** `919b371` (after 7 card commits over base `11f09bf`)
**Design:** `docs/designs/ADMIN-ARGS-INACTIVE-001.md` (723 lines + addendum)
**Issue:** #464
**Boundary attestation:** *No code modified. No push. No PR opened. No merge.*

---

## Executive summary

ADMIN-ARGS-INACTIVE-001 ships a reversible per-argument **inactive ↔ active** visibility state for admin moderation, encoded by three new nullable columns on `public.arguments` (`inactive_at`, `inactive_by`, `inactive_reason`), a new append-only `argument_inactive_audit` table with admin-only RLS, two new `admin-users` Edge actions (`set_argument_inactive`, `bulk_set_argument_inactive`) capped at 100 ids per bulk call with per-id result maps, a `Show inactives` toggle + bulk toolbar + per-row checkbox on `AdminArgumentsTab.tsx`, and a complete belt-and-braces filter chain across every non-admin argument loader (RLS policy successor + SQL predicate on four `argumentsApi.ts` list functions + one cross-room link loader + three pure-TS view-model filters). The migration is strictly additive (no edits to applied files, no widening of the existing `status` CHECK, no column drops). The §10a binding on `inactive_reason` is enforced by a leakage-scan test that asserts the token does not appear in any of 14 user-facing surface source files. Doctrine, secrets, RLS shape, and the constitutional acceptance-gate invariant are all preserved. Typecheck and lint pass; the test suite reports **629 suites / 19244 tests** with **only** the pre-existing FX-10 environmental flake failing (root cause: an untracked corpus file under `docs/testing-runs/` is absent in fresh worktree checkouts — predates this card by 9 days and is unrelated to its scope). Approved for operator merge.

---

## 1. Migration verification (heightened — migration-bearing card)

Migration file: `supabase/migrations/20260604000001_admin_args_inactive_001_argument_inactive_state.sql` (138 lines). Docker is not available in this environment (`docker info` returns `command not found`); the heightened textual review against the four OPS-001 issue classes was performed in full.

- **Class 1 (ambiguous column references in subqueries).** The successor SELECT policy at lines 114–133 has no subquery and no `EXISTS` — it uses three top-level OR arms. Bare column refs (`author_id`, `inactive_at`, `status`, `debate_id`) all resolve unambiguously to the policy-target table `public.arguments`. The helper functions `is_moderator_or_admin()`, `public.is_debate_open_or_locked_public(debate_id)`, `public.is_debate_participant(debate_id, auth.uid())` are called with positional arguments — the function-parameter names shadow inside the function body, no Class-1 ambiguity at the call site. Zero unresolved markers.
- **Class 2 (column-type mismatches).** `inactive_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL` matches `profiles.id uuid` (initial_schema.sql:24 establishes profiles.id as uuid). `actor_user_id uuid REFERENCES public.profiles(id)` — match. `argument_id uuid NOT NULL REFERENCES public.arguments(id) ON DELETE CASCADE` matches `arguments.id uuid` (initial_schema.sql:183). All FK types consistent.
- **Class 3 (implicit ordering dependencies).** Statement order in the migration is: ALTER ADD COLUMN (lines 29–32) → COMMENT ON COLUMN (lines 34–41) → CREATE INDEX on `arguments` (lines 46–52) → CREATE TABLE `argument_inactive_audit` (lines 59–67) → COMMENT ON TABLE (line 69) → CREATE INDEX on audit (lines 72–75) → ALTER TABLE ENABLE RLS (line 77) → CREATE POLICY SELECT / INSERT on audit (lines 80–92) → DROP POLICY IF EXISTS on arguments (lines 111–112) → CREATE POLICY successor (lines 114–133) → COMMENT ON POLICY (lines 135–137). ENABLE RLS precedes both CREATE POLICY statements on the audit table. The DROP POLICY IF EXISTS for both the qol_039 successor (line 111) and the new policy name (line 112, idempotent guard) precede the CREATE POLICY. No drop-column / drop-table statements (PR-004 motif is N/A here — this is pure addition). Zero unresolved markers.
- **Class 4 (function/trigger/extension dependencies).** `gen_random_uuid()` (line 60) — pgcrypto is enabled by every Supabase project by default (confirmed by the `pgcrypto` rationale comments across `20260524000013_qol_038_argument_room_invites.sql:12-13`, `20260524000014_qol_040_room_notifications.sql:14-15`, `20260528000021_arch_001_classifier_queue_substrate.sql:108`). `auth.uid()` — standard Supabase auth schema. `public.is_admin(auth.uid())` — defined in `20260516000007_stage6_admin_operations.sql`. `is_moderator_or_admin()` + `public.is_debate_open_or_locked_public(debate_id)` + `public.is_debate_participant(debate_id, auth.uid())` — defined in `20260516000002_rls_policies.sql` / `20260516000006_fix_debates_rls_recursion.sql` / `20260524000015_qol_039_room_visibility.sql`. No `COMMENT ON … ON storage.*` statements (PR-003 motif is N/A). No `GRANT` statements. Zero unresolved markers.

**Append-only verification.** `git diff main..HEAD --name-only -- 'supabase/migrations/2026{05,06}*.sql'` returns empty. Only the new file `20260604000001_admin_args_inactive_001_argument_inactive_state.sql` is added; no applied migration file is edited. `cdiscourse-doctrine` §8 satisfied.

**Additive RLS verification.** The migration uses the qol_039 DROP-IF-EXISTS + CREATE pattern (`20260524000015_qol_039_room_visibility.sql:233-252` precedent). The dropped policy `"arguments: select own, participant-private, or posted-public"` is replaced by `"arguments: select active for own/participant/public; admins read all"` which preserves all three original arms (`is_moderator_or_admin()` unchanged; `author_id = auth.uid()` AND `inactive_at IS NULL`; `status = 'posted'` AND `inactive_at IS NULL` AND public/participant gating). Coverage on the existing dimension is equivalent for active rows; the narrowing on inactive rows is the card's explicit scope (locked operator decision #4 per design §14 addendum). Belt-and-braces second `DROP POLICY IF EXISTS` for the new policy name (line 112) makes the migration idempotent across partial re-runs.

**Status CHECK constraint untouched.** The existing CHECK `(status IN ('draft', 'posted', 'hidden', 'deleted'))` on `public.arguments` (`20260516000001_initial_schema.sql:194`) is NOT modified by the migration. The textual scan test `argumentInactiveMigrationShape.test.ts:56-60` asserts `not.toMatch(/CHECK\s*\(\s*status\s+IN/i)` — zero matches in the new migration. The `inactive` axis is orthogonal to `status`, as the design specified.

## 2. Edge Function review

The diff at `supabase/functions/admin-users/index.ts:317-484` (195 added lines) introduces two handlers (`handleSetArgumentInactive`, `handleBulkSetArgumentInactive`) plus the shared `applyInactiveTransition` private. **`requireAdmin`** remains the entry boundary at `index.ts:88-93` (unchanged) — non-admins are refused before any DB read or write. The service-role client `serviceClient` is created inside the handler scope and never leaks past the handler return; the client wrapper at `src/features/admin/adminArgumentsInactiveApi.ts:18-25` calls `adminUsers({...})` (the JWT-authenticated entry point), holds no service-role key, and never imports the Deno-only `_shared/adminInactiveSchemas.ts`.

**Logging discipline.** The handler block contains exactly one `console.error` site at the failure path (`index.ts:407`) which logs `'argument_inactive_audit_write_failed'` plus `auditErr.message` only — never the request body, never the reason, never the argumentId at info level. The leakage-scan test `argumentInactiveLeakageScan.test.ts:22-51` enforces this with five regexes (`console.log\(.*body`, `console.log\(.*reason`, `console.log\(.*Authorization`, `console.log\(.*payload`, and a scoped-block check that `argumentId` never reaches a `console.log` within the inactive section).

**Bulk handler cap.** `BULK_INACTIVE_ID_CAP = 100` is declared at `supabase/functions/_shared/adminInactiveSchemas.ts:32` and enforced by `z.array(z.string().uuid()).min(1).max(BULK_INACTIVE_ID_CAP)` at line 58. Empty arrays rejected, non-uuid ids rejected, arrays of 101+ rejected. The schema test at `__tests__/adminInactiveSchemas.test.ts:50-53` asserts the constant. The bulk handler at `index.ts:441-471` iterates the (already-zod-capped) ids sequentially, collects per-id `PerIdInactiveResult { argumentId, ok, errorCode? }`, returns `{ results, appliedCount, failedCount }`. No silent partial failure.

**Atomicity.** The per-id `applyInactiveTransition` at `index.ts:328-373` reads `previous_inactive_at` via `.maybeSingle()`, then UPDATEs the row, then INSERTs the audit row. The design specified a single `WITH ... INSERT ... CTE` statement; the implementation uses **three sequential supabase-js calls** instead. This is a deviation from the design's strict atomicity contract — between the UPDATE and the INSERT, an audit-write failure leaves the column transition landed without an audit row, and the handler surfaces `audit_write_failed` (line 396). The implementer documented this exact failure mode at `index.ts:392-395` (explicit comment: "The column mutation already landed; an audit-write failure here would leave history incomplete. Surface the failure rather than silently succeeding so the operator can investigate"). This is a non-blocking design-conformance gap: the failure-mode is surfaced honestly and the operator can replay the audit row out-of-band; it does not violate any doctrine clause. A future card may collapse the three calls into an RPC for strict CTE atomicity.

**Mark-active symmetry.** When `inactive: false`, the handler stamps `newInactiveAt = null`, `newInactiveBy = null`, `newInactiveReason = null`, and the audit row is still inserted with `previous_inactive_at = <old non-null timestamp>` and `new_inactive_at = NULL` (line 380–386). Symmetric audit per locked operator decision #3.

**Audit row never stores body.** The `argument_inactive_audit` INSERT at `index.ts:380-386` writes `{ actor_user_id, argument_id, previous_inactive_at, new_inactive_at, reason }` — no `body` field. The migration table definition (line 59-67) has no `body` column. The textual test at `argumentInactiveMigrationShape.test.ts:101-104` asserts the audit table contains no `\bbody\s+text\b` clause.

**Wire-clean inactive_at.** The schema does not accept an `inactive_at` field on the wire (cf. `SetArgumentInactiveSchema` at `_shared/adminInactiveSchemas.ts:51-56`). The handler computes `newInactiveAt = inactive ? new Date().toISOString() : null` server-side (line 374). The client cannot pick an arbitrary historical timestamp.

**Reason cap deviation.** Design §5 line 237 specified `.max(500)` for the reason field; implementation uses `.max(2000)` (cf. `_shared/adminInactiveSchemas.ts:35` and mirrored in the test at line 18). This is a 4x widening relative to the design. It does not violate any doctrine clause — both 500 and 2000 are bounded and prevent unbounded audit payloads — but the operator should be aware. The widening is consistent across Edge, test, and client. Non-blocking; recorded as a documented design-conformance gap.

## 3. RLS shape verification

The migration drops `"arguments: select own, participant-private, or posted-public"` (the qol_039 successor) and creates `"arguments: select active for own/participant/public; admins read all"`. Per-arm coverage in the successor's USING clause (lines 118–132):

- **Admin/moderator arm:** `is_moderator_or_admin()` — unrestricted; no `inactive_at` predicate. The admin sees all rows including inactive. This is intentional (the entire point of the `Show inactives` toggle).
- **Author arm:** `(author_id = auth.uid() AND inactive_at IS NULL)` — author sees own drafts + posted active rows only. Author EXCLUDED from own inactive row per locked operator decision #4.
- **Posted-public / participant arm:** `(status = 'posted' AND inactive_at IS NULL AND (public.is_debate_open_or_locked_public(debate_id) OR public.is_debate_participant(debate_id, auth.uid())))` — non-admin viewers see active posted rows only.

INSERT and UPDATE policies on `public.arguments` are NOT modified (admin transitions go through the Edge Function with service-role bypass; author UPDATE on own row is the unchanged pre-existing policy from `20260516000002_rls_policies.sql:233-237`).

The new audit table `public.argument_inactive_audit` has `ENABLE ROW LEVEL SECURITY` (line 77), a SELECT policy on `is_admin(auth.uid())` (lines 80–84), an INSERT policy on `is_admin(auth.uid())` (lines 88–92), and **NO UPDATE policy, NO DELETE policy** — append-only at the policy layer. The migration-shape test at `argumentInactiveMigrationShape.test.ts:124-134` asserts `not.toMatch` for both `FOR UPDATE` and `FOR DELETE` policies on the audit table.

## 4. Surface inventory tick-off

The 12 surface clusters from the Phase 0 fact bundle's `track_a_surface_inventory` dimension, traced through the diff:

- **Surface 1 (`adminArgumentsApi.loadAdminArguments`).** `src/features/admin/adminArgumentsApi.ts:122-127` adds the `if (!options.includeInactives) q = q.is('inactive_at', null);` gate. The `includeInactives` option flows from the AdminArgumentsTab `Show inactives` toggle (default off). Admin-only loader; RLS already permits SELECTing inactive rows.
- **Surfaces 2a/2b (`admin-users.get_user_detail` / `view_as_snapshot`).** Per locked operator decision #1, these are **intentionally unfiltered**. The diff at `admin-users/index.ts` adds the two new handlers without touching the get_user_detail / view_as_snapshot recentArguments queries. Admin posture parity with the existing `deleted` state preserved.
- **Surface 3a (`ArgumentTreeScreen`).** Consumes rows from `useArgumentRoomMessages` / `useArgumentViewport`, both backed by `argumentsApi.ts` list functions (surface 3f).
- **Surface 3d/3e/3f (`argumentsApi.ts` four list functions).** All four list functions at `argumentsApi.ts:155-160` (`listRootArguments`), `:197-202` (`listArgumentsForDebateIds`), `:233-238` (`listArgumentsForDebate`), `:262-267` (`listChildArguments`) add `.is('inactive_at', null)` after the `.eq('status', 'posted')` filter. Confirmed by `argumentInactiveLeakageScan.test.ts:116-122` (expects at least 4 matches).
- **Surface 4b (`ConversationGalleryScreen` + `useGalleryArguments`).** `useGalleryArguments.ts` calls `listArgumentsForDebateIds` (covered by 3f). Belt-and-braces extension at `src/features/debates/conversationGalleryModel.ts:868-872` extends the filter from `m.status !== 'deleted'` to `m.status !== 'deleted' && (m.inactiveAt ?? null) === null`.
- **Surface 4c (`conversationGalleryModel.buildGallery`).** Covered above; absence of `inactiveAt` is treated as active.
- **Surface 4d/4e (`useRoomContract` + `roomContractModel`).** `useRoomContract.ts` calls `listArgumentsForDebate` (covered by 3f). `roomContractModel.ts:307-318` (`resolveOpeningArgumentId`) and `:461-477` (`latestMainlineAuthor`) each add `(a.inactiveAt ?? null) === null` to their existing `a.status === 'posted'` filters.
- **Surface 4f (`botRoomPolicyModel`).** `botRoomPolicyModel.ts:238-242` (`resolveRootArgument`) extends the filter to `a.parentId === null && a.status === 'posted' && (a.inactiveAt ?? null) === null`.
- **Surface 5b (`loadPriorRoomContext` cross-room link).** `crossRoom/argumentRoomLinksApi.ts:303-310` adds `.is('inactive_at', null)` after `.eq('status', 'posted')`.
- **Surface 6 (pure-TS view models — Sidecar, TimelinePopover, NodeLabelStrip, etc.).** Consume already-filtered rows from upstream loaders; the belt-and-braces filters in `conversationGalleryModel` / `roomContractModel` / `botRoomPolicyModel` are the third layer.
- **Surface 7a/7b (AdminMetadataEventsTab + MCP-021B persisted observation query).** Out of scope per design §8 (read auxiliary tables, not `public.arguments`). The implementer correctly did not touch them.

Every non-admin surface has at minimum two layers (RLS + loader SQL predicate). Three pure-TS view-model entry points (gallery, room contract, bot policy) add a third belt-and-braces layer. Direct-URL leak coverage in §5.

## 5. Direct-URL leak risk

The Phase 0 fact-bundle audit established that `.eq('id', argumentId)` against `public.arguments` returns zero hits in `src/`. There is no public `getArgumentById` in the client. All access flows through the four list loaders + the admin loader + `argumentRoomLinksApi.loadPriorRoomContext` + the admin-users service-role Edge Function. The diff confirms this by extending each of those entry points with `inactive_at IS NULL`.

When a non-admin opens a focus URL `/debate/<id>?focus=<inactive-argument-id>`, the flow is: (i) the focus argumentId is passed to `useArgumentViewport` / `useArgumentRoomMessages` → calls `argumentsApi` list functions → list does not include the row (RLS + SQL predicate both exclude it); (ii) the rendered tree does not contain the focused row; (iii) the UI shows the standard "argument not found" experience. The leakage-scan test at `argumentInactiveLeakageScan.test.ts:116-140` asserts the four `argumentsApi.ts` list calls each carry `.is('inactive_at', null)` and that the pure-TS belt-and-braces filters in `conversationGalleryModel` + `roomContractModel` match `(...inactiveAt\s*\?\?\s*null)`. The "this is hidden, but here's the body" failure mode is structurally impossible across the verified surface inventory.

## 6. §10a binding: `inactive_reason` leakage scan

`__tests__/argumentInactiveLeakageScan.test.ts:53-88` enumerates 14 user-facing argument render files (the design §7 forbidden-surfaces list verbatim: `ArgumentTreeScreen`, `ArgumentBubbleStack`, `ArgumentTimelineScreen`, `ConversationGalleryScreen`, `ConversationMiniTimeline`, `ArgumentReplySidecar`, `TimelineSelectedReadoutPanel`, `TimelineNodePopover`, `NodeLabelStrip`, `AnnotationChipStrip`, `MetadataDiffInspector`, `EvidenceDebtChip`, `ArgumentScoreTracker`, `DebateListScreen`). For each existing file, the test asserts the file does NOT contain `inactiveReason` or `inactive_reason`. Files absent in this snapshot are skipped with `it.skip` (defensible no-op — the contract is "if a file exists, it must not contain inactiveReason"; the skip semantics are correct). Test passes in the test run captured in §9.

The AdminArgumentsTab sub-scan at `argumentInactiveLeakageScan.test.ts:90-108` asserts the tab renders the `label="Inactive"` / `label="Active"` chip and references `r.inactiveAt` but explicitly does NOT reference `r.inactiveReason` (the reason is reserved for an admin row-detail affordance which is out of scope for this card). Verified by direct grep: the tab source contains zero matches for `inactiveReason`. §10a binding holds.

## 7. Ban-list scan: `delete / remove / archive / clean slate`

`__tests__/argumentInactiveBanList.test.ts:47-48` defines the regex `\b(delete|deletes|deleted|deleting|remove|removes|removed|removing|archive|archives|archived|archiving|clean[\s-]slate)\b` (case-sensitive per the design's SQL-vs-product separation: PostgreSQL keywords like `ON DELETE CASCADE` are upper-case syntax, never product copy). Scanned files: the migration, `_shared/adminInactiveSchemas.ts`, `src/features/admin/adminArgumentsInactiveApi.ts` — zero matches across all three (confirmed manually via `Grep` tool).

**Design-conformance gap.** Design §10 specified the ban-list scan would extend to extended files (`AdminArgumentsTab.tsx`, `adminArgumentsApi.ts`, `argumentsApi.ts`, etc.) using a diff-scope filter that ignores pre-existing tokens. The implementer chose to scan only the three strictly-new files and rely on the existing per-file surface tests for the extended files. This is a scope contraction relative to the design but defensible — the extended files contain pre-existing `'deleted'` literals that the design §10 file-level allowlist already concedes are "allowlisted at the line level," and implementing the line-level diff-scope filter without false positives is non-trivial. Recorded as non-blocking; future cards may tighten the scan if needed. The plain-language entries are still scanned for the verdict-token ban via `argumentInactiveBanList.test.ts:92-115` (the inactive block in `gameCopy.ts` regex-extracted and scanned for banned + verdict tokens).

## 8. Plain-language mapping

`src/features/arguments/gameCopy.ts:198-204` adds four entries to `PLAIN_LANGUAGE_COPY`:

- `inactive: 'Inactive (hidden from default views)'`
- `inactive_at: 'Marked inactive at'`
- `inactive_by: 'Marked inactive by'`
- `inactive_reason: 'Admin note (admin-only)'`

`__tests__/argumentInactivePlainLanguage.test.ts:10-65` asserts each maps to a non-empty plain-language string with no snake_case leak in the rendered value (regex `/\b[a-z]+_[a-z]+\b/`), no banned lifecycle vocabulary, and no verdict tokens. The reason mapping additionally asserts it is generic (contains `'admin'`) and does not echo any free-text. The ban-list regex extraction at `argumentInactiveBanList.test.ts:100-103` matches the four-entry block and confirms the block is free of banned + verdict tokens. None of the four user-visible strings contains `delete`, `remove`, `archive`, or `clean slate`. Plain-language coverage clean.

## 9. Test count + green-gate verification

From the worktree at `feat/ADMIN-ARGS-INACTIVE-001-argument-inactive-state` HEAD `919b371`:

| Command | Exit code | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | clean (eslint . --ext .ts,.tsx --max-warnings 0) |
| `npm run test -- --silent` | non-zero (1 suite failed, 1 test failed) | **see below** |
| Migration apply | heightened-review pass — Docker not available (`docker info` returns `command not found`); classes 1–4 scanned with zero unresolved markers |

**Test suite totals.** `Test Suites: 1 failed, 628 passed, 629 total`. `Tests: 1 failed, 1 skipped, 19242 passed, 19244 total`. Baseline on main HEAD `11f09bf`: 621 suites / 19097 tests. **Delta: +8 suites / +147 tests** — exactly matches the addendum's claimed forecast.

**Failure analysis.** The single failed suite is `__tests__/mcpOneTwoOneCEdgeFixtureUUIDs.test.ts` at FX-10 (`expect(fs.existsSync(CORPUS_PATH)).toBe(true)` at line 97). The dependency `docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md` is **not tracked in git** and is absent in fresh worktree checkouts. `git log --oneline --all -- __tests__/mcpOneTwoOneCEdgeFixtureUUIDs.test.ts` returns commit `9a4de95` (2026-05-26, MCP-021C-EDGE) — 9 days before the earliest ADMIN-ARGS-INACTIVE-001 commit (`0968f9a`, 2026-06-04 02:01:27). The test was created with a fragile design (asserting existence of an untracked file); the FX-10 failure cannot have been introduced by this card. Per the operator's prompt, §4-A applies (do NOT propose modifying the failing test) and §4-T applies (do NOT propose lowering the FX-10 bar) — the implementer correctly left it alone. The single skipped test is the `it.skip` in `argumentInactiveLeakageScan.test.ts:79` for user-facing files absent in this snapshot — defensible no-op semantics.

**All new tests from this card pass.** The PASS lines in the run output include `argumentInactivePlainLanguage.test.ts`, `argumentArtifactInactiveResilience.test.ts`, and the rest of the new test files are absent from the FAIL list. Zero new-test failures.

## 10. §4-A self-attestation cross-check

Three patched surface tests; each is a legitimate accommodation, not an assertion loosening:

- **`__tests__/adminArguments.test.ts:201`.** BEFORE: `loadAdminArguments\(\{\s*limit,\s*sortField,\s*sortDirection\s*\}\)`. AFTER: `loadAdminArguments\(\{[\s\S]{0,200}?limit,[\s\S]{0,200}?sortField,[\s\S]{0,200}?sortDirection/`. The exact 3-field shape is relaxed to "the three fields flow through to the loader (in any order, with optional siblings)." This accommodates the new `includeInactives` field added to the call site. The assertion intent (sortField + sortDirection actually flow through) is preserved.
- **`__tests__/adminSecurity.test.ts:174-189`.** BEFORE: `handlerBlock = indexSrc.slice(indexSrc.indexOf('async function handleSetSemanticConfig'))` (slices to EOF). AFTER: slices from the same start but stops at the `'ADMIN-ARGS-INACTIVE-001 — per-argument inactive'` marker so the block does NOT include the new section's `from('arguments')` call. The assertion `expect(handlerBlock).not.toMatch(/from\('arguments'\)/)` is preserved — but it now correctly scopes to the semantic-config region. Without this fix, the test would fail because the new section legitimately reads from `arguments` (for the per-id `previous_inactive_at` SELECT). The fix is the slice-boundary correction, not assertion loosening.
- **`__tests__/argumentRoomLinksApi.test.ts:61-69`.** Adds `builder.is = (col, val) => { call.eqArgs.push([col, val]); return builder; }` to the mock. The SUT (`crossRoom/argumentRoomLinksApi.ts:309-310`) now chains `.is('inactive_at', null)`; the mock previously had no `.is` method which would throw on call. The mock now accepts and records the chain. No assertion loosened.

All three patches preserve intent.

## 11. §4-C self-attestation

`git diff main..HEAD --name-only | grep -E 'familyRegistry'` returns empty. H/I/J `productionEnabled` flags untouched. §4-C never-self-approve constraint satisfied.

## 12. §4-T self-attestation

The grep for `\.skip|\.todo|xit\(|xdescribe\(` across new test files in the diff returns exactly one match: the `it.skip` in `argumentInactiveLeakageScan.test.ts:79` which skips the assertion for user-facing files absent in the current snapshot. The skip semantics correctly preserve the contract ("if a file exists, it must not contain inactiveReason") rather than failing on a non-existent path. This is not a §4-T threshold lowering; it is conditional test scoping. Zero `.todo`, zero `xit`, zero `xdescribe`. No threshold lowered, no test skipped to make a failing check pass.

## 13. Secrets / leak scan

- `.env*` files: none modified.
- Service-role key in client code: `Grep` over `src/` for `SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE` returns one match at `src/features/devFixtures/argumentScenarioValidation.ts:24` — a regex pattern in a pre-existing dev-fixtures *validation* (i.e., a guard that scans test fixtures for forbidden tokens), authored by `83ef344` (Stage 6.0.3) and `dd6ddb1` long before this card. Not card-introduced.
- `ANTHROPIC_API_KEY` in client code: zero hits in the diff.
- Secret scan over the entire diff (`grep -iE 'ANTHROPIC_API_KEY|XAI_API_KEY|X_BEARER_TOKEN|SUPABASE_SERVICE_ROLE_KEY|sb_secret_|sk-ant-|Bearer |eyJ[A-Za-z0-9_-]{20,}'`): zero hits.
- Audit row contents (per `applyInactiveTransition` at `index.ts:380-386` and the migration table definition at lines 59-67): `actor_user_id`, `argument_id`, `previous_inactive_at`, `new_inactive_at`, `reason`, `created_at`. No body, no client IP, no JWT, no email. Reason is a bounded `text` (zod-capped at 2000 chars).
- Edge handler `console.error` sites log event names + error messages only; the leakage-scan test enforces no `body|reason|Authorization|payload|argumentId` ever reaches a `console.log` in the inactive section.

## 14. Constitutional invariant

`git diff main..HEAD --name-only | grep -iE 'constitution/engine|submit-argument|classifierQueueRouting|autoTriggerDispatcher|familyRegistry'` returns empty. None of:

- `src/lib/constitution/engine.ts`
- `supabase/functions/submit-argument/index.ts`
- `supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts`
- `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts`
- `supabase/functions/_shared/booleanObservations/familyRegistry.ts`

is touched. The submission acceptance gate (engine + submit-argument) remains the sole gate; `inactive_at` operates as a post-storage visibility filter only. The card's §3 invariant holds.

---

## Pre-existing test condition (NOT card-introduced)

The single failing test `__tests__/mcpOneTwoOneCEdgeFixtureUUIDs.test.ts:97` (FX-10) depends on the untracked file `docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md`. This file is present in main's working directory (so `npm run test` on main HEAD `11f09bf` passes per the operator's captured baseline) but absent in a fresh worktree checkout. The failing test was added 2026-05-26 in MCP-021C-EDGE (commit `9a4de95`), 9 days before this card's earliest commit. The flake is environmental, not card-introduced. Per §4-A and §4-T, the implementer correctly did not modify the test or relax the bar. A separate operator card is required to fix the test's fragile design (depending on an untracked corpus file is a test-design smell, but fixing it is out of this card's scope).

## Findings summary

**Doctrine-conformance gaps (non-blocking, recorded for operator awareness):**

1. **Reason cap 500 → 2000.** Design §5 lines 237/245 specified `.max(500)`; implementation uses `.max(2000)`. Consistent across Edge schema, mirrored test schema, and client wrapper. Both values are bounded.
2. **Atomicity contract three-call instead of CTE.** Design §5 line 306 specified a single `WITH ... INSERT` CTE; implementation uses three sequential supabase-js calls. The implementer documented the resulting `audit_write_failed` failure mode honestly. No doctrine violation; future card may tighten to RPC.
3. **Ban-list scan strictly-new files only.** Design §10 specified scanning extended files via a diff-scope filter; implementation scans only the three strictly-new files. The extended files are covered by per-file surface tests + the verdict-token block-scan in `argumentInactiveBanList.test.ts:92-115`.

**Blockers:** *none.*

---

## Operator next steps

Governance contract §5 applies: the PR touches `supabase/migrations/**` AND `supabase/functions/**` → **merge = deploy**. Operator-only merge.

```powershell
# 1. From the main repo root (not from this worktree), push the branch.
git push -u origin feat/ADMIN-ARGS-INACTIVE-001-argument-inactive-state

# 2. Open the PR (operator-only).
gh pr create --title "ADMIN-ARGS-INACTIVE-001: reversible inactive visibility state for whole arguments (admin-initiated; audited)" --body-file docs/reviews/ADMIN-ARGS-INACTIVE-001.md

# 3. Squash-merge after green CI. The Supabase GitHub integration auto-applies
#    the new migration AND auto-redeploys the admin-users Edge Function on
#    merge to main (CLAUDE.md memory `supabase-merge-autodeploy`).

# 4. If the GitHub-integration auto-apply does not fire, run manually:
npx supabase db push --linked
npx supabase functions deploy admin-users --linked

# 5. Post-deploy verification (read-only):
npx supabase db status      # confirm 20260604000001 listed
npx supabase db lint        # plpgsql linting

# 6. Post-merge worktree cleanup (from the main repo root, not from inside any worktree).
git worktree list | grep "feat/ADMIN-ARGS-INACTIVE-001-argument-inactive-state"
git worktree remove -f -f ".claude/worktrees/agent-aa38277036af52387"
git branch -D feat/ADMIN-ARGS-INACTIVE-001-argument-inactive-state
git worktree list | grep -c "agent-aa38277036af52387"   # must print 0
```

No `.env` changes. No secret rotations. No `familyRegistry` flips. No routing arm changes. No MCP server changes.

---

## Boundary attestation

No code modified. No push. No PR opened. No merge. This document is the only artifact written by the reviewer pass; it is committed on the same `feat/ADMIN-ARGS-INACTIVE-001-argument-inactive-state` branch with message `review(ADMIN-ARGS-INACTIVE-001): GATE C verdict — APPROVE`.
