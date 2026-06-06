# ADMIN-CONV-INACTIVE-001 — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-06-06
**Branch:** feat/admin-conv-inactive-recovered
**HEAD:** 9600c7aa02f3ff1f50cb6d0617fadfc6565215f9
**Base:** origin/main 78e4689 (merge-base = 78e4689, clean 3-commit stack)
**Design:** docs/designs/ADMIN-CONV-INACTIVE-001.md
**Issue:** #502
**GATE:** C (deploy-bearing: migration + Edge → operator-gated merge; Claude does NOT push/PR/merge)

## Summary

The recovered branch ships the debate-level mirror of #480: a reversible,
admin-only per-debate `inactive_at` visibility state plus THE CASCADE (an
inactive debate's arguments also drop out of every non-admin SELECT), enforced
entirely in RLS. The implementation matches the design faithfully (the only
delta is the migration rename `20260605000001`→`20260606000001` to avoid the
collision with the merged #510 corpus30 migration, which is correctly reflected
in every referencing test). Migration is strictly additive (3 nullable columns
+ 2 partial indexes + an append-only `debate_inactive_audit` table with no
UPDATE/DELETE policy + a recursion-safe SECURITY DEFINER helper + two DROP+CREATE
SELECT policy successors). The §10a leak gate is enforced in the type system
(`AdminDebateRowView` structurally omits `inactiveReason`) and proven by a
poisoned-fixture test. The two CRITICAL findings (④ DROP targets, ⑤ Edge
response) both PASS. Full suite 663/663 suites, 19850 passed, exit 0;
typecheck 0; lint 0. No blocking gaps.

## Verification
- typecheck: pass (exit 0)
- lint: pass (exit 0, --max-warnings 0)
- test: 663 suites / 19850 passed (1 pre-existing skip, not introduced by this branch); exit 0
- secret scan: clean (two regex hits are a NOT-present assertion in a test + a doctrine self-check line in the design doc — no live secrets)
- doctrine scan: clean (no verdict/truth tokens in non-doc/non-test added lines; no SERVICE_ROLE/ANTHROPIC_API_KEY in client paths; no direct insert into public.arguments; no console.log added; no .skip/.only added)
- Migration apply: heightened-review pass — Docker not available (`docker info` exit non-zero / daemon not running); classes 1–4 scanned with zero unresolved markers

## Design conformance
- [x] All design file-changes are present (migration, 2 shared schema files, loader, view-model, client wrappers, tab, AdminScreen wiring, edgeFunctions types, types.ts, 7 test files)
- [x] No undocumented file-changes (the migration rename + corpus30 future-proof are documented recovery deltas; argumentInactiveRlsScan update was flagged in the design's Risks)
- [x] Data model matches design (3 nullable columns; audit table shape verbatim; AdminDebateRow carries reason, AdminDebateRowView omits it)
- [x] API contracts match design (set/bulk_set_debate_inactive; per-id `{debateId, ok, errorCode?}`; cap 100; reason ≤2000)

## Doctrine self-check (all ✓)
- [x] No truth/winner/loser language in user-facing strings (only `Inactive`/`Active` lifecycle badges; ban-list test passes)
- [x] Score never blocks posting (inactivation is a post-storage visibility filter; no submission/validation path touched)
- [x] No service-role in client code (`adminDebatesInactiveApi` calls the Edge Function; loader uses anon-RLS read; grep clean)
- [x] No direct insert into public.arguments (none added)
- [x] No AI calls in production app paths (no classifier/Anthropic/xAI/X/MCP surface in this card)
- [x] Plain language only (literal `Inactive`/`Active`/`Mark inactive` copy; no internal codes leak to UI)
- [x] §8 RLS always on / append-only migration / no hard delete (audit table has no UPDATE/DELETE policy; verb pair is inactive↔active; reversible)
- [x] §10a sensitive content off public surfaces — `inactive_reason` lives in the audit row only; structurally absent from the render view-model; FK-pin avoids embedding the inactivator's profile
- [x] supabase-edge-contract: standard admin-users shape; requireAdmin before any DB read; service-role only after admin check; server-stamped inactive_at; cascade enforced in RLS (single chokepoint)

## ④ CRITICAL — DROP-target finding: PASS
The migration's `DROP POLICY` statements target the ACTUAL current policy
names on main:
- **debates SELECT**: current canonical name on main is `"debates: select
  public-open, own, or participant"` (qol_039 / 20260524000015:189). The
  migration line 164 drops exactly this name. No post-qol_039 migration
  re-creates the debates SELECT policy (mcp_021b only mentions it in
  comments). The old un-gated policy is removed; no orphan survives.
- **arguments SELECT**: current canonical name on main is `"arguments: select
  active for own/participant/public; admins read all"` (#480 /
  20260604000001:114). The migration line 205 drops exactly this name.
- Both successor names are also dropped IF EXISTS (lines 165, 206) for
  idempotency. The cascade is NOT bypassed — the new gated policy is the only
  surviving SELECT policy on each table.

## ⑤ CRITICAL — Edge-response finding: PASS
The Edge response NEVER echoes `inactive_reason`:
- `applyDebateInactiveTransition` returns `PerIdDebateInactiveResult` =
  `{debateId, ok, errorCode?}` only; the `reason` param flows solely into the
  audit-row INSERT (index.ts:1078), never into the returned object.
- `handleSetDebateInactive` returns `ok({ result })` (index.ts:1123);
  `handleBulkSetDebateInactive` returns `{results, appliedCount, failedCount}`
  (index.ts:1168). No reason field on the wire.
- On `inactive: false` the reason is server-nulled (index.ts:1053).
- The loader pins the creator FK `profiles!debates_created_by_fkey`
  (adminDebatesApi.ts:85) and never embeds the inactivator (`inactive_by`).
- §10a: `toAdminDebateRowView` drops `inactiveReason` + `inactiveBy`; the
  poisoned-fixture test (`debateInactiveReasonNeverRendered.test.tsx`) proves
  `'leak-canary-REASON'` never renders. The leakage source-scan asserts no
  console.* in the new handler region logs reason/title/resolution/Authorization/body.

## Heightened migration review (Docker unavailable → textual, classes 1–4)
- **Class 1 (ambiguous column refs)**: PASS. The cascade is delegated to a
  SECURITY DEFINER helper that takes `debate_id` as a parameter
  (`is_debate_inactive(p_debate_id uuid)`, body `d.id = p_debate_id`, fully
  qualified) — it avoids the in-policy correlated-subquery pattern that caused
  QOL-041's 42702. Policy-target columns (`inactive_at`, `created_by`,
  `author_id`, `status`) are bare references on the single policy-target table
  with no name-sharing join. No asymmetric qualification.
- **Class 2 (type mismatches)**: PASS. `inactive_by uuid → profiles.id (uuid)`;
  `debate_id uuid → debates.id (uuid)`; `actor_user_id uuid → profiles.id
  (uuid)`; all timestamps `timestamptz`. No mismatched CHECK/FK/join types.
- **Class 3 (ordering deps)**: PASS. Columns before their indexes; audit table
  before its indexes/RLS/policies; RLS ENABLE before policies; helper function
  before REVOKE/GRANT and before the arguments policy that calls it; DROP before
  CREATE for both policies. No DROP COLUMN / DROP TABLE (strictly additive).
- **Class 4 (function/extension deps)**: PASS. `is_debate_open_or_locked_public`
  (20260524000015), `is_debate_participant` (20260516000006), `is_admin`
  (20260516000007), `is_moderator_or_admin` (20260516000002) all defined by
  prior applied migrations. `gen_random_uuid()` is the established platform
  baseline (used in every prior table incl. the immediate-prior #480 audit
  table). `auth.uid()` + `TO authenticated` are Supabase-standard. No
  `COMMENT ON ... storage.*` (no 42501 ownership risk). REVOKE PUBLIC /
  GRANT authenticated on the helper is correct.

## Lifecycle
- active→inactive and inactive→active both supported (`markDebateInactive` /
  `markDebateActive` + bulk variants); symmetric audit row written per
  transition (previous_inactive_at + new_inactive_at).
- No hard delete; verb pair is inactive↔active. Audit table stores only
  timestamps/reason/actor — never debate title/resolution or argument bodies.

## Compat with #510 (corpus30)
- The future-proof change to `corpus30RunTagPersist.test.ts` is sound: it now
  asserts the corpus30 migration (a) exists, (b) has a predecessor (idx > 0),
  (c) sorts after that predecessor — replacing the brittle "global-newest"
  assertion that this card's newer migration would otherwise break. It does NOT
  weaken #510's additive intent: the run_tag column / partial-index / nullable /
  no-DEFAULT / predecessor-untouched assertions are all retained untouched.
- `debateInactiveMigrationShape.test.ts` and `debateInactiveCascadeRlsScan.test.ts`
  both reference the renamed `20260606000001`. `argumentInactiveRlsScan.test.ts`
  was correctly updated (THIS_CARD_MIG → 20260606000001, #480 name is the DROP
  target). `qol039Migration.test.ts` reads its own migration file (not a stale
  current-state assertion). Full suite green confirms no stale name breaks.

## Test coverage
- [x] New pure function (`toAdminDebateRowView`) has unit tests
  (`adminDebateRowView.test.ts`) incl. the leak-canary projection test
- [x] User-facing strings have verdict-token ban-list assertion
  (`debateInactiveBanList.test.ts`, scope incl. the tab)
- [x] Edge cases from design covered: schema bounds (cap/empty/uuid/reason ≤2000),
  cascade composition (RLS scan), reason-never-rendered (poisoned fixture),
  show-inactives toggle + bulk + per-row actions (RTL tab test)
- [x] Migration shape invariants (no DROP TABLE, no status-CHECK widen,
  SECURITY DEFINER + locked search_path, audit no UPDATE/DELETE)
- Test delta: +7 new files; full suite 663 suites / 19850 tests, exit 0

## Blockers
None.

## Suggestions (non-blocking)
1. The migration filename in the design doc body (§"File changes",
   §"API/interface", §"Operator steps") still reads `20260605000001`; the
   shipped file is `20260606000001`. The design doc is the GATE-A artifact and
   was not re-edited during recovery (correctly — reviewer does not edit the
   design). A one-line addendum noting the recovery rename would help a future
   reader, but this is cosmetic and out of scope for this review.
2. `adminDebatesApi.loadAdminDebates` performs the in-tab `search` filter
   client-side after the limit (consistent with `AdminArgumentsTab`); fine for
   the admin-tool scale, noted only for parity awareness.

## Operator next steps
This card is **deploy-bearing (migration + Edge) → operator-gated merge.**
Claude does NOT push/PR/merge. After APPROVE the orchestrator presents at the
operator gate. When the operator proceeds:
- Push: `git push -u origin feat/admin-conv-inactive-recovered`
- Open PR: `gh pr create --title "ADMIN-CONV-INACTIVE-001: reversible admin conversation inactivation (#502)" --body-file docs/reviews/ADMIN-CONV-INACTIVE-001.md`
- Merge = deploy: the Supabase GitHub integration auto-applies the migration
  and redeploys `admin-users` on merge to main. If auto-apply does not fire:
  - `npx supabase db push --linked`
  - `npx supabase functions deploy admin-users --linked`
- Post-merge verify (read-only): `npx supabase db status` (confirm
  20260606000001 listed); `npx supabase db lint`
- Post-merge worktree cleanup (operator step; commands in
  roadmap-reviewer.md § "Post-merge worktree cleanup")
