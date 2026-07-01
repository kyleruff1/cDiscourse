# PRIVATE-GROUPS-001 — Review

**Verdict:** Changes requested
**Reviewer agent run:** 2026-07-01
**Branch:** docs/private-groups-001-model-design
**Design:** docs/designs/PRIVATE-GROUPS-001.md
**PR:** https://github.com/kyleruff1/cDiscourse/pull/852
**Baseline:** main @ 2f3c75c

## Summary

A DESIGN-ONLY doc that specifies the load-bearing net-new pillar of PRODUCT-REDIRECT-001:
the persistent `circle` entity (circle-of-N with the 1:1 pair as `member_count = 2`), its
membership + invite tables, a nullable `debates.circle_id` FK, four SECURITY DEFINER RLS
helpers, and the integration contract for every downstream card. The diff is exactly one
new file (662 lines) — docs-only gate passes. The product decision is resolved honestly with
a three-option comparison and substrate-grounded rejections; the 1:1 case is genuinely
first-class (a WHERE-clause constraint, not a fork). Every "reuse QOL-038/039/COV-004/
ARG-ROOM-002" claim was spot-checked against source and holds. Privacy, soft-delete,
migration-sequencing, backfill, and rollback are all reasoned. **One substantive gap keeps
this from Approve:** the RLS composition prose (Invariant 2) asserts the circle-visibility
arm "additionally requires `d.visibility` to already be private-and-scoped," but the actual
SQL for `is_argument_visible_in_circle` gates only on `d.circle_id IS NOT NULL` +
`is_circle_member` — it does NOT contain a `visibility = 'private'` predicate. The
private-forcing (Invariant 1) is deferred to an unconstrained future app path plus a
source-scan test, not a DB constraint. This is a spec-tightening request, not a leak and not
a design defect (the arm cannot expose anything to a non-member), but the implementation card
would inherit an ambiguous spec whose prose overstates the SQL.

## Verification

| Check | Result |
|---|---|
| typecheck / lint / test | N/A — docs-only PR, zero code/test files in diff |
| Diff footprint | 1 file added: `docs/designs/PRIVATE-GROUPS-001.md` (+662) |
| current-status.md touched | No (grep count 0) — boundary respected |
| Secret scan | clean (no key/token/JWT/Bearer/Authorization hits in diff) |
| Doctrine/verdict scan | clean — only "winner/loser" occurrences are the doctrine self-check explicitly stating the model does NOT apply those labels |
| Migration apply | N/A — no migration file in this PR (implementation is a deferred GATE-C card) |

## Design conformance (8 audit criteria)

- [x] **1. DOCS-ONLY** — exactly one new file under `docs/designs/`; no code, no migration, no config, no current-status.md.
- [x] **2. Decision quality** — group-vs-1:1 resolved (circle-of-N chosen). Honest 3-option table (A circle-of-N / B pair-primary / C dual-entity). B rejected on the C(N,2) pair-explosion + "single relationship evaporates at pair granularity" reasoning; C rejected on double RLS surface + polymorphic `scope_kind` tax. 1:1 is first-class as `member_count = 2`, a WHERE clause not a schema fork — consistent with the operator's 1:1-PvP emphasis.
- [~] **3. RLS soundness** — helpers follow the house pattern (`LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`, REVOKE-from-PUBLIC + grant-to-authenticated); every table has explicit RLS posture (RLS-enabled, no authenticated write policies, service-role Edge writes only); recursion landmine acknowledged with the `20260516000006` precedent. **Gap:** Invariant 2 prose ≠ helper SQL (see Blockers §1). The composition IS safe in the leak direction (the circle arm requires `is_circle_member` of that specific circle, so no non-member ever gains a read; a public-hall room is already world-readable so adding circle members is a no-op), but the spec is internally inconsistent.
- [x] **4. Reuse honesty** — every cited behavior verified against source (see "Reuse verification" below).
- [x] **5. Privacy invariants** — membership-gated reads, no cross-circle leakage (single FK, not join table, with the "room in two circles" leak explicitly forbidden), author-of-source-move removal right established as an invariant, export opt-in deferred to PRIVACY-001, no public leaderboard / no ranking / no popularity signal, nudges in-app + opt-in + never cross-circle, soft-remove ≠ erasure.
- [x] **6. Migration/rollout** — implementation deferred to GATE-C; sequential timestamp correct (predecessor `20260630000001` IS the real current head on main); never-edit-applied convention stated; **no-backfill decision reasoned on consent grounds** (existing rooms never opted into a persistent memory boundary → keep `circle_id = NULL`); purely-additive; rollback posture stated (drop-in-follow-up, non-destructive because `circle_id` defaults NULL).
- [x] **7. Unblock map** — per-card consumption table (QUOTE-FORGE-001 / LORE-001 / HIGHLIGHT-001 / MEMORY-LANE-001 / STYLE-001 / UX-COMPOSER-001 / PRIVATE-GROUPS-002/003) is concrete: each row names the exact helper(s) and column(s) consumed. QUOTE-FORGE/LORE discovery is correctly circle-scoped to satisfy the "no argument search" guard.
- [x] **8. Soft-delete + doctrine** — `is_deleted`/`deleted_at` on circles, `is_removed`/`removed_at` on members, status-flip on invites; no hard delete anywhere; no verdict/moralized framing; circle name/description correctly treated as user content (scanned in rendered UI, not rejected at input).

## Reuse verification (spot-checked against source on main)

| Claim in doc | Source | Holds? |
|---|---|---|
| `argument_room_invites` = email-keyed, `token_hash` only, `expires_at` NOT NULL 14-day default, RLS with no authenticated writes, 4 SELECT arms, one-live partial index | `20260524000013_qol_038_argument_room_invites.sql` | ✅ exact |
| `is_argument_visible` mirrors canonical arms; derived tables delegate to it; drift test is `concessionAccessibilityRlsScan` | `20260630000001_cov_004_argument_visibility_helper.sql` | ✅ exact |
| `is_debate_private` / `is_debate_open_or_locked_public` + one-way public→private trigger; `visibility` defaults 'public' | `20260524000015_qol_039_room_visibility.sql` | ✅ exact |
| `manage-room-invite` has `verify_jwt = false` so `lookup_by_token` runs pre-signup; `enrolAndFlipInvite` inserts into `debate_participants`; `handleProvisionAndAccept` exists | `supabase/functions/manage-room-invite/index.ts` + `config.toml` | ✅ exact |
| `create_argument_room` RPC is SECURITY DEFINER granted to `service_role` only | `20260613000001_arg_room_002...` line 369 `GRANT EXECUTE ... TO service_role` | ✅ exact |
| Recursion-break precedent (`is_debate_participant`) | `20260516000006_fix_debates_rls_recursion.sql` (filename literally confirms) | ✅ exact |
| `is_debate_inactive`, `is_moderator_or_admin` exist for the circle helper to depend on | `20260606000001`, `20260516000002` | ✅ present |
| Proposed migration `20260701000001` is the next sequential after the current head | head on main = `20260630000001_cov_004...` | ✅ correct |
| config.toml must register new Edge Functions or they silently never deploy | `config.toml` uses explicit `[functions.<name>]` blocks | ✅ correct |

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language applied as a label (only meta-references in the self-check).
- [x] Score never blocks posting — N/A; no scoring surface introduced; the doc explicitly removes heat/ranking from the circle home.
- [x] No service-role in client code — all privileged writes routed through `manage-circle` / `manage-circle-invite` Edge Functions; client wrappers explicitly forbidden from direct `circles`/`circle_members` writes.
- [x] No direct insert into public.arguments — circle-scoping is a read grant + a nullable FK; nothing writes `arguments`.
- [x] No AI calls in production app paths — membership is deterministic SQL; explicitly stated no Anthropic/xAI/X.
- [x] Plain language only — exports strip machine internals; no raw codes surfaced.
- [x] Epic-specific doctrine (supabase-edge-contract): RLS always on, migrations append-only, soft-delete only, standard Edge Function shape (CORS→auth→validate→authorize→narrowest-client→audit→JSON, no secrets echoed), no service-role in client, no direct arguments insert. All present.

## Blockers (Changes requested — one item)

1. **`docs/designs/PRIVATE-GROUPS-001.md:291–300` vs `:386` — Invariant-2 prose overstates the helper SQL; the private-forcing is not self-enforced.**
   The prose (line 386) states the circle-visibility arm "additionally requires `d.visibility` to already be private-and-scoped," but the SQL body of `is_argument_visible_in_circle` (lines 291–300) contains no `d.visibility = 'private'` predicate — it gates only on `a.status='posted' AND a.inactive_at IS NULL AND NOT is_debate_inactive(...) AND d.circle_id IS NOT NULL AND is_circle_member(...)`. Invariant 1 (line 374) — "a room with `circle_id IS NOT NULL` must set `visibility='private'` at creation" — is deferred to "the future room-creation path" and "asserted in the implementation card's RLS scan," i.e. an application-level invariant + a source-scan, NOT a DB constraint. This is not a leak (the arm requires `is_circle_member` of that specific circle, so no non-member gains access, and a public room is already world-readable), but the spec is internally inconsistent and hands the implementer an ambiguous contract. **Fix (pick one, defense-in-depth preferred):** (a) add the `and d.visibility = 'private'` predicate directly to the circle arm in `is_argument_visible_in_circle` so the helper is self-enforcing and the prose becomes true, and/or (b) specify a DB-level guarantee that `circle_id IS NOT NULL ⟹ visibility = 'private'` (a CHECK-via-trigger or a `create_circle_room`/adoption RPC that sets both atomically) rather than relying solely on an app path + `circleVisibilityCompositionRlsScan`. Then reconcile the Invariant-2 prose to match whichever mechanism is chosen.

## Suggestions (non-blocking)

1. **`circle_members.role` cascade under owner account deletion.** `owner_id` on `circles` is `on delete cascade` (owner deletion cascades the whole circle), while `circle_members.user_id` is also `on delete cascade`. Confirm in the implementation card that deleting an owner's `auth.users` row and cascading the `circles` row is the intended product behavior (a whole friend group vanishes when the owner deletes their account) vs. the `transfer_ownership`-then-leave path — the doc mentions ownership must "always resolve / never be orphaned" but the cascade means owner-deletion destroys the group rather than orphaning it. Worth one sentence making the account-deletion-of-owner semantics explicit for PRIVATE-GROUPS-002.

2. **`circle_invites.invitee_profile_id` references `public.profiles`** (matching `argument_room_invites`) while the membership/ownership FKs reference `auth.users`. This mirrors the existing invite table exactly, so it's consistent — but the implementer should note the two-FK-target pattern is intentional (bind-at-accept to profiles, write-attribution to auth.users) so it isn't "cleaned up" into one target.

3. **Second (config.toml) migration.** The doc flags that `manage-circle` / `manage-circle-invite` must be registered in `config.toml` or they silently never deploy. Good catch and consistent with operator memory — consider having the implementation card make the config.toml edit part of the SAME PR as the function dirs so a reviewer can see registration and function land together (the note already exists; just reinforcing the coupling).

## Operator next steps

- This is a **design-only** doc. After Changes-requested item #1 is addressed by re-spawning the designer (or a quick doc edit), the operator can:
  - Push is already done (branch exists on origin) / PR #852 open.
  - Re-review the single doc edit, then squash-merge: `gh pr merge 852 --squash --delete-branch`.
- **No deploy, no migration, no DDL/DML, no Edge deploy, no provider spend** for this card — it is documentation only.
- The implementation is a **later migration-bearing GATE-C card** that consumes this spec; its deploy steps (`npx supabase db push --linked`, `config.toml` registration + `functions deploy manage-circle{,-invite}`) are named in the design's Operator-steps section and inherit heightened migration-apply verification.
- Post-merge worktree cleanup per roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)".
