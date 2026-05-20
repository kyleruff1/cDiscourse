# META-1A — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-19
**Branch:** feat/META-1A-persisted-manual-tag-ledger
**Design:** docs/designs/META-1A.md

## Summary

META-1A persists META-001's previously in-memory manual-tag ledger as a shared
gameplay artifact: a new `point_tags` table with RLS, an `apply-manual-tag`
Edge Function as the single write path, a Deno-side eligibility mirror, a client
wrapper + pure adapter, and a loader extension that hydrates persisted tags into
the room shell's metadata ledger on every refresh. The implementation tracks the
unusually detailed design — including all 10 §0 card-vs-reality corrections —
faithfully. The migration is a correct append-only file with soft-delete-only
semantics (no `for delete` policy), the Edge Function follows the
`request-argument-deletion` template exactly (caller-scoped writes, service-role
confined to one best-effort audit row), and the Deno eligibility mirror is
byte-structurally identical to META-001's client table with a parity test that
genuinely enforces it. The write-trigger UI is honestly deferred as a follow-up;
META-1A wires the persisted-tag *read* path, satisfying the card's "UI reflects
persisted state" criterion. Verification is clean: typecheck, lint, 4608/4608
tests across 159/159 suites (+64 tests / +4 suites vs the 4544/155 baseline).
No doctrine violations, no secret leaks, no direct `point_tags` writes from
`src/`. End-to-end behavior (live migration + deployed function + RLS) is
necessarily verified post-merge by the operator smoke — the pre-merge gate is
the test suite, which executes the eligibility logic rather than only scanning
source.

## Verification

- typecheck: pass
- lint: pass (`--max-warnings 0`, clean)
- test: 4544 → 4608 tests / 155 → 159 suites (+64 / +4)
- META-1A suites in isolation: 5 files / 102 tests, all pass
- secret scan: clean (4 grep hits are all benign — a test asserting the wrapper
  does NOT import the key, and design-doc prose; no secret values)
- doctrine scan: clean (no verdict / amplification / person-attribution tokens
  in the migration, function, mirror, or modified `src/`)

## Design conformance

- [x] All design file-changes are present (8 new files: migration, Edge
  Function, mirror, client wrapper, 4 test suites; 9 modified files matching
  the design's modified-files list)
- [x] No undocumented file-changes (19-file footprint; the `docs/` and
  `argumentCache.test.ts` edits are documented; the
  `composerHandoff.ts` / `useArgumentViewport.ts` edits are the mechanical
  consequence of the additive `pointTags` field on `ArgumentRelations` — no
  behavioral change)
- [x] Data model matches design — 8 columns, soft-delete (`removed_at` /
  `removed_by`), 10-code `CHECK IN`, FKs to `public.profiles` (not
  `auth.users`), partial active indexes + partial unique index
- [x] API contracts match design — Edge Function two-action shape
  (`apply` / `remove`), `{ argumentId, activeTags }` response, `_shared/http.ts`
  error envelope, `supabase.functions.invoke('apply-manual-tag', …)` wrapper

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — `point_tags`
  stores only a `tag_code` from the locked 10-code META-001 gameplay
  vocabulary; the ban-list test scans migration + function + mirror.
- [x] Score never blocks posting — tagging is a separate action from
  `submit-argument`; `point_tags` has no score / count / engagement column.
- [x] No service-role in client code — `src/` diff has zero `SERVICE_ROLE` /
  `createServiceClient` / `ANTHROPIC_API_KEY` hits; the wrapper only calls
  `supabase.functions.invoke`. `pointTagsApi.test.ts` enforces this.
- [x] No direct insert into `public.arguments` — META-1A does not touch
  `arguments` writes at all.
- [x] No direct `point_tags` write from any `src/` client — the only
  `point_tags` reference in `src/` is the read-only `.select(...).is('removed_at',
  null)` in `argumentsApi.ts` (line ~243), the design's documented read
  exception. No `.insert` / `.update` / `.delete` anywhere in `src/`.
- [x] No AI calls in production app paths — the Edge Function is pure
  CRUD + eligibility; the ban-list test asserts no `anthropic` / `api.x.ai` /
  `openai`.
- [x] Plain language only — no raw internal codes leak; the migration /
  function comments frame a tag as a "gameplay annotation" that "never rules on
  a person."
- [x] Epic-specific doctrine — **supabase-edge-contract**: Edge Function is the
  single write path; caller-scoped client used for the argument lookup AND the
  insert/update (RLS as defense-in-depth); service-role confined to one
  best-effort `admin_audit_events` row (single `createServiceClient()` call,
  `try/catch`, never blocks the user); migration is append-only (`…0009…`,
  correct next timestamp after `…0008…`); RLS enabled; soft-delete only, no
  `for delete` policy. **evidence-doctrine**: a manual tag is a participant
  gameplay annotation, never a verdict; banned person-attribution labels appear
  in no column / value / comment / response field; `point_tags` records neither
  engagement nor factual-standing credit.

## Test coverage

- [x] New public functions have unit tests — `isApplyAllowed` (executed over the
  full 80-case matrix via the mirror), `persistedTagsToManualTagEntries`
  (happy path, soft-delete drop, dedupeKey reconstruction, empty/non-array
  defense, two-tagger case), `applyManualTag` / `removeManualTag` (apply/remove
  routing, success, structured-error unwrap, `FunctionsFetchError` → 503,
  empty-response).
- [x] Doctrine ban-list assertions present — `pointTagsMigration.test.ts` and
  `applyManualTagEdgeFunction.test.ts` both scan for verdict / amplification /
  attribution tokens, reusing META-001's `_forbiddenMetadataTokens()`.
- [x] Edge cases from the design covered — soft-delete (`removed_at` set),
  no `for delete` policy, 23505 idempotency, debate/argument mismatch, deleted
  argument, invisible-argument forbidden, admin-removes-others (`tagged_by`
  filter dropped), 10-code `CHECK` exact count.
- [x] Mirror parity enforced — `pointTagsEligibilityMirror.test.ts` imports the
  client `MANUAL_TAG_ELIGIBILITY_TABLE` + `ALL_MANUAL_TAG_CODES` and asserts the
  Deno mirror declares the same 10 keys with the same 4 booleans each; also
  asserts the mirror imports nothing from `src/` and no Supabase/Deno runtime.
- [x] UI card — META-1A is loader/model-heavy; the read-path wiring in
  `ArgumentGameSurface.tsx` is covered transitively by the existing surface
  suites (4608/4608 pass, including the unchanged META-001 metadata regression).

## Scrutiny notes (non-blocking — verified, no action needed)

1. **Migration internals.** `point_tags` has `removed_at` + `removed_by`
   (soft-delete); the `tag_code` `CHECK IN` lists exactly the 10
   `ALL_MANUAL_TAG_CODES` values from `moveMetadataLedger.ts` verbatim
   (cross-checked); `tagged_by` FKs `public.profiles(id)` with `on delete
   cascade`; `removed_by` FKs `public.profiles(id)` `on delete set null`;
   `debate_id` / `argument_id` FK with `on delete cascade`; RLS is enabled;
   exactly 3 named policies (`pt_insert_eligible` / `pt_select_read_access` /
   `pt_update_soft_delete`), each preceded by `drop policy if exists`; the
   partial unique index `point_tags_one_active_per_tagger` on
   `(argument_id, tag_code, tagged_by) WHERE removed_at IS NULL`; partial
   active-row indexes on `argument_id` and `debate_id`; no `for delete` policy.
   The RLS policies use `EXISTS` subqueries against `public.arguments` (not a
   `debates` self-reference) — no recursion path; this matches migration 0008's
   shape and `public.is_admin` is defined in migration 0007.
2. **RLS visibility delegation.** `pt_insert_eligible` / `pt_select_read_access`
   `EXISTS` against `public.arguments` without re-checking debate visibility —
   correct: `arguments` itself has RLS, so a caller-scoped `EXISTS` inherits
   arguments-level visibility; participant/observer eligibility is enforced in
   the Edge Function with RLS as defense-in-depth, exactly as the design states.
3. **Edge Function.** CORS/OPTIONS handled, non-POST → `methodNotAllowed`, JWT
   required, caller-scoped client for the argument lookup and the
   insert/update, single `createServiceClient()` call confined to the
   best-effort `admin_audit_events` row inside `try/catch`, 23505 treated as
   idempotent success, soft-delete via `removed_at` UPDATE (never `.delete()`),
   admin path drops the `tagged_by` filter, no `Authorization`/key logging, no
   AI call. The `{ argumentId, activeTags }` response carries only opaque
   `profiles.id` values — no email / display name. The `admin_audit_events`
   insert columns (`action`, `source`, `actor_user_id`, `target_user_id`,
   `reason`, `payload`) all exist in migration 0007 and `source:'edge_function'`
   satisfies that table's `source` CHECK.
4. **Deno mirror.** `_shared/pointTagEligibility.ts` is structurally identical
   to META-001's client `MANUAL_TAG_ELIGIBILITY_TABLE`; the parity test
   genuinely enforces same-10-keys / same-4-booleans, and the 80-case matrix
   test *executes* `isApplyAllowed` (not a source scan).
5. **Comment reword.** The implementer reworded three doctrine-explaining
   comments to avoid the literal words "verdict" / "engagement" (both are in
   `_forbiddenMetadataTokens()` and the ban-list test scans comments too). The
   replacements — "never rules on a person or asserts a fact" and "no count, no
   score, and no activity-volume column" — preserve the doctrine meaning fully
   and are accurate. Sound.
6. **Read path wired; write trigger deferred (honest).** `ArgumentGameSurface.tsx`
   replaces the empty-`Map` placeholder with a `Map` built from
   `pointTagsByArgumentId` via `persistedTagsToManualTagEntries`; the
   `handleApplyManualTag` / `handleRemoveManualTag` callbacks are implemented and
   route through the Edge Function with refresh-on-success, then `void`-ed
   pending the follow-up tag-apply control. The "UI reflects persisted state"
   criterion is met by the read path; the follow-up framing is accurate — no
   tag-apply UI affordance exists in the current surface to wire to.

## Blockers

None.

## Suggestions (non-blocking)

1. The two `void handleApplyManualTag;` / `void handleRemoveManualTag;`
   statements in `ArgumentGameSurface.tsx` are a deliberate lint-satisfier for
   the deferred write path. When the follow-up tag-apply control card lands,
   delete those `void` lines and pass the callbacks into the dock. Harmless as
   shipped; just a marker to clean up later.
2. `persistedTagsToManualTagEntries` sets `appliedByActorRole` to a fixed
   `'participant_affirmative'` placeholder because `point_tags` does not persist
   the actor role (design Edge case #11). This is correct for v1 — no consumer
   of *persisted* tags reads that field — but if a future META card surfaces
   "who applied this tag and in what role," it will need either a stored column
   or a join. Already documented in the design and the adapter's docstring;
   noting it so the follow-up card's designer sees it.

## Operator next steps

- Push the branch: `git push -u origin feat/META-1A-persisted-manual-tag-ledger`
- Open PR: `gh pr create --title "META-1A: Persisted manual-tag ledger (point_tags table + Edge Function)" --body-file docs/reviews/META-1A.md`
- Deploy steps (post-merge, **in this exact order** — the function writes to
  `point_tags`, so the table must exist first):
  1. Apply the migration: `npx supabase db push --linked`
     Verify: `npx supabase db status` (lists `20260517000009_meta_1a_point_tags`)
     and `npx supabase db lint` (no new plpgsql errors).
  2. Deploy the Edge Function (AFTER step 1):
     `npx supabase functions deploy apply-manual-tag --linked`
  3. RLS post-deploy smoke:
     - As a debate participant, tag another participant's move `needs_source`
       → expect `200`; the tag appears for a second user on reload.
     - As an observer (joined `side='observer'`, or never joined), attempt the
       same → expect `403 not_eligible`; confirm no `point_tags` row was written.
     - As the author of a move, attempt `needs_source` on the own bubble →
       expect `403`; then `concession_offered` on the own bubble → expect `200`.
     - Remove a tag you applied → expect `200`; the row's `removed_at` is set
       and it disappears from the room shell; confirm the row still exists in
       `point_tags` (soft-delete, not hard-deleted).
     - As an admin, confirm you can apply all 10 codes and remove others' tags.
- No new environment variables or secrets are introduced; `apply-manual-tag`
  reuses the standard `SUPABASE_URL` / `SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY` every Edge Function already has.
