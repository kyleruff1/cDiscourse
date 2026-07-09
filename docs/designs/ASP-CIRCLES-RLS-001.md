# ASP-CIRCLES-RLS-001 — Wire the dormant circle read-arm into debates/arguments SELECT policies (migration)

**Status:** Design draft
**Epic:** PRODUCT-REDIRECT-001 / Argument Surface Pivot (ASP) — Milestone M-ASP-1
**Release:** P1 companion (migration-bearing; merge = auto-apply, operator-gated)
**Issue:** https://github.com/civildiscourse/debate-constitution-app/issues/882
**Canonical spec:** `docs/designs/START-002.md` §5 (companion migration design — merged on main)
**Base:** `feat/asp-circles-rls-001-read-arm` off `f26c985` (main, includes the merged circles pair #839/#840)

---

## Goal (one paragraph)

START-002 (#839) shipped circle-scoped room *creation* but deferred its AC2 — "a second circle member reads the room." The SECURITY DEFINER helpers that would grant that read (`is_circle_member`, `is_argument_visible_in_circle`) were shipped in the circles foundation migration (`20260702000001`) **granted to `authenticated` but wired to ZERO policies**. As a result a circle room is readable only by its creator (via the `created_by` arm); every other circle member gets a not-found experience. This card writes **one additive migration** that adds a circle-member read arm to the `debates` SELECT policy and the `arguments` SELECT policy, exactly per `START-002.md` §5, closing AC2. It is the hard pre-flip gate for `home_v2`: until it merges, a non-creator member cannot read a circle room, so the circle-home lane (#840) would show empty for members. Doctrine shaping the design: a circle is an **access boundary, never a ranking or verdict** (cdiscourse-doctrine §1–§3); **RLS stays ON**; the change is **strictly additive** (permissive OR-composition — it can only widen, never narrow, read access); **no write path, no service-role, no client change, no helper edit**; and **no applied migration file is edited** (append-only — a brand-new file only).

---

## 1. Problem & scope

**Problem.** `is_argument_visible_in_circle` and `is_circle_member` are defined and `grant execute … to authenticated` (`20260702000001:303, 369`) but **called by zero policies**. The live SELECT policies on `public.debates` and `public.arguments` (net policy from `20260606000001`, applied *before* the circles migration, which did not touch them) contain no circle-member arm. START-002 selected Option 1 (split): it shipped creation + creator-read only and deferred the read arm to this card. This gap is latent because nothing wrote `debates.circle_id` before START-002; the #860 production smoke exercised circle *management*, never a circle-*room read*.

**In scope.**
- One additive migration that appends a circle-member arm to the `debates` SELECT policy and the `arguments` SELECT policy, wiring the two shipped helpers per `START-002.md` §5.
- RLS text-scan tests proving: additive-only (canonical policies untouched), correct arm shape, single-composition-point routing for arguments, non-narrowing invariance for non-circle rows, and the four OPS-001 issue classes are clean.
- A `docs/core/current-status.md` H2 entry with the confirmed post-migration test count.

**Out of scope (see §9).** No Edge changes, no client changes, no new tables/columns, no change to non-circle visibility, no write-path (INSERT/UPDATE/DELETE) policy changes, no helper edits, no invite/participant/notification semantics.

---

## 2. Policy-landscape audit — the load-bearing section

### 2.1 The shipped-but-dormant helpers (`20260702000001`)

| Object | Signature | Security | Granted to | What it checks |
|---|---|---|---|---|
| `is_circle_member` | `(p_circle_id uuid, p_user_id uuid default auth.uid()) → boolean` | `SECURITY DEFINER STABLE`, `set search_path = public` | `authenticated` (line 303); REVOKEd from PUBLIC | live (`is_removed=false`) member row in `circle_members` **AND** `NOT is_circle_deleted(p_circle_id)` |
| `is_argument_visible_in_circle` | `(arg_id uuid, viewer_id uuid) → boolean` | `SECURITY DEFINER STABLE`, `set search_path = public` | `authenticated` (line 369); REVOKEd from PUBLIC | `public.is_argument_visible(arg_id, viewer_id)` (canonical, **by CALL**) **OR** a circle branch: arg `posted` + `inactive_at is null` + `NOT is_debate_inactive` + `d.circle_id is not null` + `d.visibility='private'` + `is_circle_member(d.circle_id, viewer_id)` |
| `is_circle_deleted` | `(p_circle_id uuid) → boolean` | `SECURITY DEFINER STABLE` | **definer-only** — NOT granted to authenticated (oracle avoidance) | circle soft-deleted |
| `is_debate_inactive` | `(uuid) → boolean` | (defined `20260606000001`, already used by the live arguments policy) | — | debate inactive/cascade gate |

**Recursion + privilege verdict.** Both wired helpers are `SECURITY DEFINER` → when a SELECT policy calls them they read `circle_members` / `circles` / `arguments` / `debates` **as the definer, bypassing those tables' RLS**, so no policy recursion is introduced (the `is_circle_member` inside the debates policy does not re-enter `debates` RLS; the `is_argument_visible_in_circle` inside the arguments policy reads `arguments`/`debates` as definer, not through the arguments SELECT policy). Both are `STABLE` (planner can fold/cache within a statement) and `search_path`-hardened (`set search_path = public`, the COV-004 house pattern). Both are already granted to `authenticated` — **this migration needs ZERO new GRANT.** `debates.circle_id` carries a partial index `debates_circle_id … where circle_id is not null` (`20260702000001:244`), and the `debates_circle_requires_private` CHECK guarantees `circle_id IS NOT NULL ⇒ visibility='private'`.

### 2.2 The net current SELECT policy set (chain reconstruction)

I reconstructed the net (post-DROP/replace) policy set by walking every `CREATE`/`DROP POLICY` on the two tables across all migrations. Each successor drops its predecessor by name, so the **net live policy is the last CREATE in each chain**:

**`public.debates` SELECT chain →** net live policy is from `20260606000001`:

- initial schema → `20260516000006` (`"debates: select open, own, or participant"`) → `20260524000015` qol_039 (`"debates: select public-open, own, or participant"`) → **`20260606000001` `"debates: select active public-open, own, or participant; admins read all"`** ← LIVE

```
CREATE POLICY "debates: select active public-open, own, or participant; admins read all"
ON public.debates FOR SELECT TO authenticated
USING (
  is_moderator_or_admin()
  OR (created_by = auth.uid() AND inactive_at IS NULL)
  OR (public.is_debate_participant(id, auth.uid()) AND inactive_at IS NULL)
  OR (visibility = 'public' AND status IN ('open','locked') AND inactive_at IS NULL)
);
```

**`public.arguments` SELECT chain →** net live policy is from `20260606000001`:

- initial (`"arguments: select posted in readable debates or own"`) → `20260524000015` qol_039 (`"arguments: select own, participant-private, or posted-public"`) → `20260604000001` (`"arguments: select active for own/participant/public; admins read all"`) → **`20260606000001` `"arguments: select active for own/participant/public; active debate; admins read all"`** ← LIVE

```
CREATE POLICY "arguments: select active for own/participant/public; active debate; admins read all"
ON public.arguments FOR SELECT TO authenticated
USING (
  is_moderator_or_admin()
  OR (author_id = auth.uid() AND inactive_at IS NULL AND NOT public.is_debate_inactive(debate_id))
  OR (
    status = 'posted' AND inactive_at IS NULL AND NOT public.is_debate_inactive(debate_id)
    AND (public.is_debate_open_or_locked_public(debate_id) OR public.is_debate_participant(debate_id, auth.uid()))
  )
);
```

Note: COV-004 (`20260630000001`) introduced `is_argument_visible` and rewrote only the **concession/reactions** SELECT policies to call it — it did **not** re-create the arguments SELECT policy, so the arguments policy above (which inlines the arms) is still the net live one. The circles migration (`20260702000001`) did not touch either policy.

**Permissiveness (the key property).** Neither policy specifies `AS RESTRICTIVE`, so **both are PERMISSIVE**. Postgres combines multiple permissive SELECT policies for the same role with **OR**. Therefore a new permissive policy `TO authenticated` **unions** with the existing one and can only **widen** access — it is structurally incapable of narrowing anyone's current read access. This is the entire safety basis for the additive-policy pattern below.

### 2.3 What a circle room looks like to a non-creator member today (the bug)

A circle room is `visibility='private'` (CHECK-enforced) + `circle_id IS NOT NULL`. For a live circle member who is **not** the creator and **not** a participant:

- **debates policy:** admin ✗, `created_by=me` ✗, participant ✗, `visibility='public'` ✗ → **0 rows** (not readable).
- **arguments policy:** admin ✗, `author_id=me` ✗, `is_debate_open_or_locked_public` ✗ (private), `is_debate_participant` ✗ → **0 rows**.

This card adds exactly the missing member arm to each.

---

## 3. The migration SQL (verbatim)

New file: **`supabase/migrations/20260709000001_asp_circles_rls_001_circle_read_arm.sql`**

> Filename note: the only hard invariant is a timestamp **strictly greater than `20260702000001`** and highest-sequential at build time. `20260709000001` matches the intended build date; if the implementer commits on 2026-07-08, `20260708000001` is equally valid. Do not reuse or edit any existing file.

```sql
-- ============================================================
-- Migration: 20260709000001_asp_circles_rls_001_circle_read_arm
-- Card: ASP-CIRCLES-RLS-001 (#882) — wire the dormant circle read-arm into the
--   debates + arguments SELECT policies.
-- Epic: PRODUCT-REDIRECT-001 / Argument Surface Pivot (M-ASP-1).
-- Canonical spec: docs/designs/START-002.md §5 (companion migration design).
-- Closes START-002 (#839) deferred AC2 ("a second circle member reads the
--   room"). Pre-flip gate for home_v2.
--
-- Sequential after 20260702000001_private_groups_002_circles.sql (highest
--   applied timestamp at build time).
--
-- ── What this migration does (strictly additive) ────────────
--   Adds ONE new PERMISSIVE SELECT policy to public.debates and ONE new
--   PERMISSIVE SELECT policy to public.arguments. Each OR-composes with the
--   existing live SELECT policy (Postgres unions permissive policies with OR),
--   so the delta can only WIDEN read access, never narrow it. The existing
--   canonical policies are NOT dropped, NOT recreated, NOT edited — their text
--   is byte-identical after this migration.
--
--   The two new arms grant read access to LIVE CIRCLE MEMBERS of a
--   circle-scoped room (debates.circle_id IS NOT NULL) via the SECURITY
--   DEFINER helpers shipped (but wired to zero policies) in 20260702000001:
--   is_circle_member (debates arm) and is_argument_visible_in_circle
--   (arguments arm). No helper is created or edited here.
--
-- ── Non-narrowing invariance (the safety proof) ─────────────
--   * debates: for every row with circle_id IS NULL, the new arm's leading
--     conjunct `debates.circle_id IS NOT NULL` is FALSE => the arm is FALSE =>
--     the OR-union equals the existing policy result (byte-identical for all
--     existing non-circle rooms) and is_circle_member is never evaluated.
--   * arguments: for every arg whose debate has circle_id IS NULL, the new arm
--     calls is_argument_visible_in_circle, whose circle branch is guarded by
--     `d.circle_id is not null` (FALSE here) so is_circle_member never fires;
--     the helper's first branch is a CALL to the canonical is_argument_visible,
--     which returns exactly what the existing inline policy already grants — so
--     the union is unchanged for non-circle args. The ONLY net-new access is a
--     live circle member reading posted, active args in an active private
--     circle-scoped room (== AC2).
--
-- ── OPS-001 four-class compliance (Docker-less heightened review) ──
--   Class 1 (ambiguous column): NEITHER policy has a subquery in its text
--     (is_circle_member / is_argument_visible_in_circle are function calls; the
--     only join lives INSIDE the SECURITY DEFINER helper, already Class-1
--     audited by 20260702000001). Every column is table-qualified
--     (debates.circle_id / debates.visibility / debates.inactive_at;
--     arguments.status / arguments.inactive_at / arguments.debate_id /
--     arguments.id). `status` and `inactive_at` exist on BOTH tables — both are
--     qualified, so no ambiguity is possible.
--   Class 2 (type mismatch): no new column / FK / CHECK. All comparisons are
--     uuid<->uuid (circle_id / id / debate_id vs auth.uid()), text<->text
--     literal (status='posted', visibility='private'), or timestamptz null-check
--     (inactive_at IS NULL).
--   Class 3 (statement order): only two CREATE POLICY statements. debates /
--     arguments exist + RLS-enabled since the initial schema (applied). Each
--     `drop policy if exists <new-name>` precedes the `create policy <new-name>`
--     on the SAME table (targets ONLY the new names — a no-op on first apply).
--     No new table / column / index / trigger; no DROP of any object; no CREATE
--     POLICY before ENABLE RLS (RLS already on).
--   Class 4 (function/extension deps): references only objects created + granted
--     in EARLIER APPLIED migrations —
--       public.is_circle_member(uuid,uuid)              20260702000001 (grant -> authenticated, line 303)
--       public.is_argument_visible_in_circle(uuid,uuid) 20260702000001 (grant -> authenticated, line 369)
--       public.is_debate_inactive(uuid)                 20260606000001 (already used by the live arguments policy)
--     auth.uid() from the Supabase auth schema (present by default). No new
--     extension, no gen_random_uuid(), no new GRANT (all grants pre-exist), no
--     COMMENT ON ... ON storage.* (COMMENT targets are public.* tables the
--     migration role owns).
--
-- ── Doctrine ────────────────────────────────────────────────
--   RLS stays ENABLED on both tables (never disabled). A circle is an ACCESS
--   boundary, never a ranking or verdict (cdiscourse-doctrine 1-3) — these arms
--   grant READ access to members, nothing more. No write-path change, no
--   service-role, no client change, no helper edit. Append-only: no applied
--   migration file is edited (brand-new file); the existing policies are not
--   dropped.
-- ============================================================

-- ── debates SELECT — additive circle-member arm ─────────────
-- New PERMISSIVE policy; OR-composes with
-- "debates: select active public-open, own, or participant; admins read all"
-- (20260606000001), which is NOT touched. The drop-if-exists targets ONLY this
-- new policy name (a no-op on first apply; present for re-runnability).
drop policy if exists debates_select_circle_member on public.debates;
create policy debates_select_circle_member
  on public.debates
  for select
  to authenticated
  using (
    debates.circle_id is not null                        -- short-circuit: non-circle rooms exit here (is_circle_member never fires)
    and debates.visibility = 'private'                   -- defense-in-depth (debates_circle_requires_private already guarantees this)
    and debates.inactive_at is null                      -- conservative posture: members do not see an inactive circle room (mirrors the creator/participant arms)
    and public.is_circle_member(debates.circle_id, auth.uid())
  );

comment on policy debates_select_circle_member on public.debates is
  'ASP-CIRCLES-RLS-001 (#882): additive PERMISSIVE circle-member read arm for circle-scoped rooms. Grants SELECT to a live member (is_circle_member) of the room''s circle. OR-composes with the canonical debates SELECT policy (unchanged); provably non-narrowing (circle_id IS NULL => arm FALSE => existing result). Wires the dormant is_circle_member helper (20260702000001) per docs/designs/START-002.md section 5.';

-- ── arguments SELECT — additive circle-member arm ───────────
-- New PERMISSIVE policy; OR-composes with
-- "arguments: select active for own/participant/public; active debate; admins read all"
-- (20260606000001), which is NOT touched. Routes the circle read through the
-- shipped composite helper is_argument_visible_in_circle (the SINGLE
-- circle-visibility composition point — NEVER re-inlines the circle-visibility
-- logic; circleVisibilityCompositionRlsScan is the lockstep alarm bell). The
-- leading posted/inactive gates match START-002.md section 5 and are cheap
-- column predicates that filter before the STABLE helper call.
drop policy if exists arguments_select_circle_member on public.arguments;
create policy arguments_select_circle_member
  on public.arguments
  for select
  to authenticated
  using (
    arguments.status = 'posted'
    and arguments.inactive_at is null
    and not public.is_debate_inactive(arguments.debate_id)
    and public.is_argument_visible_in_circle(arguments.id, auth.uid())
  );

comment on policy arguments_select_circle_member on public.arguments is
  'ASP-CIRCLES-RLS-001 (#882): additive PERMISSIVE circle-member read arm for arguments in circle-scoped rooms. Calls the shipped composite helper is_argument_visible_in_circle (20260702000001) — the single circle-visibility composition point (never re-inlined; circleVisibilityCompositionRlsScan is the alarm bell). OR-composes with the canonical arguments SELECT policy (unchanged); provably non-narrowing. Wires the dormant helper per docs/designs/START-002.md section 5.';
```

---

## 4. Design decisions (explicit)

### D1 — Additive NEW policies, not DROP+CREATE of the canonical policy

`START-002.md` §5 phrases the wiring as "DROP+CREATE the current successor policy, appending one arm." I chose the **stronger** form: **two new permissive policies that OR-compose**, leaving the canonical policies' text untouched. Both forms are RLS-equivalent (permissive policies OR together), but the new-policy form is strictly safer and more auditable:

- The canonical policy text is **provably byte-identical** after this migration — no re-typing of the existing arms (which risks silently dropping a `NOT is_debate_inactive(...)` cascade gate during transcription).
- Zero DROP of a live functional policy → no Class-3 drop/recreate ordering to verify, no window where a policy is absent.
- A reviewer audits ~15 lines of new SQL against the four issue classes, not a full re-diff of two of the most security-sensitive policies in the schema.

The `drop policy if exists <new-name>` lines target **only the two new names** (idempotency for re-runs); on first apply they are no-ops. The additive-only tests (§8) pin that the canonical names are never dropped.

### D2 — debates arm: direct `is_circle_member`, circle_id short-circuit first

`(debates.circle_id is not null AND debates.visibility='private' AND debates.inactive_at is null AND is_circle_member(debates.circle_id, auth.uid()))`, exactly per §5. Leading `circle_id is not null` guarantees `is_circle_member` never evaluates for the ~600 existing non-circle rooms. `visibility='private'` is redundant-but-defensive (the CHECK guarantees it; keeping it makes the arm true-by-inspection even if the CHECK were ever relaxed — mirrors the helper's own defense-in-depth at `20260702000001:360`). `inactive_at is null` matches the conservative posture of the sibling creator/participant arms (a member does not see an inactive circle room). No `status` gate on the debates arm (a circle member reads the room like a participant, in any status) — matches §5.

### D3 — arguments arm: route through `is_argument_visible_in_circle`, never re-inline

The card and §5 both direct the arguments read to go through the **single composition point** `is_argument_visible_in_circle` — the helper exists precisely for this. I explicitly reject the alternative of inlining a `circle_id`-guarded `EXISTS (SELECT 1 FROM public.debates d …)` circle predicate in the policy: that would create a **second, divergent copy** of the circle-visibility logic in a policy — exactly the inline-and-diverge hazard the helper (and its `circleVisibilityCompositionRlsScan` alarm bell) were built to prevent. The composite helper self-guards its circle branch on `d.circle_id is not null`, so `is_circle_member` still never fires for non-circle args. The redundant re-evaluation of the canonical `is_argument_visible` for non-circle args is a **performance** note (§10 R2), not a correctness or doctrine concern — and Postgres evaluates the cheaper existing-policy arms in the OR-union, and my leading `status='posted' AND inactive_at is null` column predicates gate the STABLE helper.

### D4 — Non-circle invariance is provable, not asserted

For `circle_id IS NULL` debates rows the new debates arm is `FALSE` by its leading conjunct → OR-union = existing result. For args whose debate is non-circle, `is_argument_visible_in_circle` = `is_argument_visible(...) OR (… d.circle_id is not null …=FALSE)` = `is_argument_visible(...)`, which is exactly what the existing inline arguments policy already grants → OR-union unchanged. So the **only** net-new access this migration produces is: *a live circle member reads posted, active args (and the room row) in an active private circle-scoped room.* This is AC2, and nothing else moves.

### D5 — No new GRANT, no helper edit

Audit confirms both helpers are already `grant execute … to authenticated` (`20260702000001:303, 369`) and REVOKEd from PUBLIC. `is_debate_inactive` is applied (`20260606000001`) and already used by the live arguments policy. So the migration contains **zero** `grant`, `create or replace function`, or helper edit — pinned by a §8 test.

### D6 — Rollback is a forward down-migration, stated honestly

Merge auto-applies via the Supabase GitHub integration; a `git revert` of the merge does **not** un-apply an applied migration. Rollback is therefore a **new** migration that `DROP POLICY IF EXISTS debates_select_circle_member ON public.debates;` + `DROP POLICY IF EXISTS arguments_select_circle_member ON public.arguments;`. Because the policies are purely additive, dropping them restores the prior creator-only circle-read behavior with zero effect on non-circle access. See §10 R3 and §11.

---

## 5. Data model

**No new data model.** Zero new tables, columns, types, constraints, indexes, functions, or grants. The migration adds exactly two `CREATE POLICY` statements (+ their `COMMENT ON POLICY` and idempotency `DROP POLICY IF EXISTS`). It reads existing objects only:

- `public.debates` (columns `circle_id`, `visibility`, `inactive_at`) — all present since `20260702000001` / initial schema.
- `public.arguments` (columns `status`, `inactive_at`, `debate_id`, `id`) — initial schema.
- Functions `is_circle_member`, `is_argument_visible_in_circle`, `is_debate_inactive`, `auth.uid()` — all applied.

---

## 6. API / interface contracts

No application-facing API changes. The RLS contract delta (what the anon-key + caller-JWT PostgREST surface returns) is:

- `supabase.from('debates').select(...).eq('id', <circleRoomId>)` as a **live circle member (non-creator, non-participant)** → **1 row** (was 0).
- `supabase.from('arguments').select(...).eq('debate_id', <circleRoomId>)` as a **live circle member** → the **posted, active** args (was 0).
- Same reads as a **non-member** → **0 rows** (unchanged).
- Any read of a **non-circle** room / its args → **byte-identical to today** (non-circle invariance).

No `debatesApi.ts` / `argumentsApi.ts` / Edge change is required — existing RLS-scoped reads simply start returning the member's circle rooms once the policy lands (this is what unblocks HOME-003's member lane and #840).

---

## 7. File-by-file change list

- **new** `supabase/migrations/20260709000001_asp_circles_rls_001_circle_read_arm.sql` (~90 lines incl. the OPS-001 header + comments; ~15 lines of executable SQL) — the two additive policies (§3).
- **new** `__tests__/circleReadArmRlsScan.test.ts` (~130 lines) — the text-scan suite (§8), modeled on `debateInactiveCascadeRlsScan.test.ts` + `circleRlsScan.test.ts`.
- **modified** `docs/core/current-status.md` (+1 H2 entry, ~1 paragraph) — the card entry with the **confirmed** post-migration test count (implementer captures the real `Test Suites: … / Tests: …` line + exit 0 before writing it), following the START-002 entry format. Must include the verbatim `No Anthropic/xAI/X API call …` boundary line and the operator deploy/verify steps.

**Not touched:** any `src/**`, `app/**`, `supabase/functions/**`, any existing migration file, `CLAUDE.md` stage line (bumped on *stage* completion, not per card — this is a card), and every existing test file (the two anchor scans — `circleVisibilityCompositionRlsScan.test.ts` and `debateInactiveCascadeRlsScan.test.ts` — scan *other* migration files this card does not modify, so they stay green with zero edits).

---

## 8. Test plan (Docker-less textual lane)

Docker is unavailable, so the RLS proof at CI time is the house `fs.readFileSync` text-scan over the new migration SQL (the migration text is the single chokepoint contract). New suite **`__tests__/circleReadArmRlsScan.test.ts`**:

**Presence + numbering**
- `__tests__/circleReadArmRlsScan.test.ts` — the new migration file exists at its locked path and its numeric timestamp prefix is `> 20260702000001`.
- both policies are created with the exact names `debates_select_circle_member` / `arguments_select_circle_member`, each `for select to authenticated`.

**Additive-only (THE load-bearing safety scan)**
- the migration does **NOT** contain a DROP of the canonical `"debates: select active public-open, own, or participant; admins read all"`.
- the migration does **NOT** contain a DROP of the canonical `"arguments: select active for own/participant/public; active debate; admins read all"`.
- the **only** `DROP POLICY` statements target the two new names, on their matching tables (Class-3 marker d).
- the migration does **NOT** re-CREATE either canonical policy name.

**debates arm shape (happy path)**
- the `debates_select_circle_member` USING body matches, in order, `debates.circle_id is not null`, `debates.visibility = 'private'`, `debates.inactive_at is null`, `public.is_circle_member(debates.circle_id, auth.uid())`.

**arguments arm shape (happy path) + single-composition-point (edge case: no re-inline)**
- the `arguments_select_circle_member` USING body matches `arguments.status = 'posted'`, `arguments.inactive_at is null`, `not public.is_debate_inactive(arguments.debate_id)`, `public.is_argument_visible_in_circle(arguments.id, auth.uid())`.
- the arguments policy body does **NOT** call `is_circle_member` directly and does **NOT** contain a raw `select … from public.debates` subquery (routes through the composite helper only — the recursion-landmine / no-inline pin).

**Non-narrowing invariance (edge case)**
- the debates arm's first predicate is the `circle_id is not null` short-circuit (asserts it precedes the `is_circle_member` call in the body).

**OPS-001 four-class + doctrine pins**
- Class 1: every column ref in both bodies is table-qualified — negative-control scan asserts no bare ` status =`, ` inactive_at`, ` circle_id`, ` visibility`, ` debate_id` without a `debates.`/`arguments.`/`d.`/`a.` prefix in the policy USING bodies.
- Class 4 / D5: the migration contains **no** `create or replace function`, **no** `grant execute`, **no** `create extension` (no helper edit, no new grant).
- RLS-on invariance: the migration contains **no** `disable row level security`, **no** `for insert|update|delete` policy, **no** `drop table`, **no** `alter table … drop`.
- ban-list: the migration text contains no verdict tokens (`winner|loser|liar|true|false|correct|dishonest|bad faith|manipulative|extremist|propagandist`) — light doctrine scan (mirrors the house pattern; circle name/desc are user content and do not appear in this migration).

**Expected delta:** **+1 suite (`circleReadArmRlsScan`), ≈ +18–22 tests.** Baseline **933 suites / 33,285 tests (1 pre-existing skip)** → **≈ 934 suites / ≈ 33,305 tests**. No existing suite changes count. The implementer must capture the real `Test Suites:`/`Tests:` line with exit 0 and write the exact number into `current-status.md` (test-discipline gate-timeout rule).

**What the text-scan does NOT prove (deferred to the operator smoke, §12):** that the policy *evaluates* correctly at runtime (member reads 1 row, non-member reads 0). Docker `db reset` is unavailable in this session; the runtime proof is the authed member-read smoke in §12.

---

## 9. Out of scope

- Any **write-path** policy (INSERT/UPDATE/DELETE) on `debates`, `arguments`, or any circle table — all circle writes stay in the service-role Edge Functions.
- Any **helper edit** — `is_circle_member` / `is_argument_visible_in_circle` are used as-is; the lockstep composition (`is_argument_visible_in_circle` ↔ `is_argument_visible`) is not modified.
- Any change to **non-circle** visibility, the one-way `public→private` visibility rule, participant/seat semantics, invites, or notifications.
- **`debate_participants`** SELECT (circle members are not made participants — the whole point is member read *without* participation).
- Any **client / Edge / config.toml** change; any `src/**` or `app/**` change.
- Flipping `home_v2` (a separate operator action, gated on this card merging first).
- The `circleVisibilityCompositionRlsScan` and `debateInactiveCascadeRlsScan` anchor tests (they scan unmodified migrations; untouched here).

---

## 10. Risks

- **R1 — RLS widening is THE risk.** A new SELECT policy on two of the most sensitive tables must be provably scoped to circle members *of that circle*. Mitigation: the arm is anchored to `is_circle_member(debates.circle_id, auth.uid())` (debates) and `is_argument_visible_in_circle(arguments.id, auth.uid())` (arguments) — both require live membership of the room's *own* circle; the composite helper additionally requires `d.circle_id is not null AND d.visibility='private'`. Non-narrowing invariance (§4 D4) is provable, not asserted, and pinned by the §8 additive-only + short-circuit scans. The runtime negative controls (non-member → 0 rows; non-circle room → unchanged) are in the §12 smoke.
- **R2 — per-row STABLE function cost.** The new arguments policy adds a per-candidate-row `is_argument_visible_in_circle` evaluation, gated behind cheap column predicates (`status='posted' AND inactive_at is null AND NOT is_debate_inactive`). Because the policies OR-compose, rows already visible via the existing policy are TRUE regardless, and the leading predicates filter most rows before the helper. This mirrors the per-row `is_debate_inactive` / `is_debate_participant` calls the *current* policy already makes; acceptable at present scale (hundreds of debates, thousands of args; circle rooms are ~0 today). The `debates_circle_id` partial index supports the helper's circle-branch join.
- **R3 — merge = auto-apply; rollback is forward-only.** The Supabase GitHub integration applies this migration on merge; a `git revert` does **not** un-apply it. Rollback is a new down-migration dropping the two policies (§11) — clean because the change is purely additive. Because `home_v2` is OFF in prod and no client has created a circle room yet, the live blast radius is ≈ **0 rows affected** until `home_v2` flips and a member creates a circle room — the safest possible landing.
- **R4 — Docker-less verification.** CI cannot `db reset`; the four-issue-class textual review (§8 self-check + reviewer's heightened lane) plus the post-merge authed smoke (§12) are the substitute. The migration is deliberately ~15 lines of executable SQL to make that textual review trivial.

---

## 11. Rollback story (honest)

There is **no auto-rollback**. A revert-merge does not un-apply an applied migration under the Supabase integration. To revert the behavior, ship a **new** migration (e.g. `<later-ts>_asp_circles_rls_001_rollback.sql`) containing:

```sql
drop policy if exists debates_select_circle_member on public.debates;
drop policy if exists arguments_select_circle_member on public.arguments;
```

This restores the prior creator-only circle-read behavior with **zero** effect on non-circle access (the arms were purely additive). Never edit or delete the applied forward migration file.

---

## 12. Post-merge verification plan (operator / next session)

Two stages. The first confirms the policies exist and the canonical policies are unchanged; the second confirms they *evaluate* correctly.

### 12.1 Policy presence (CLI `db query` lane — no Docker needed)

Use the `npx supabase db query` CLI lane (the management-API `/database/query` is 403 with the PAT; the CLI lane executes read SQL against the linked project — see the `supabase-db-query-linked-dml-lane` memory). Confirm the two new policies exist and the canonical ones survive:

```sql
select tablename, policyname, cmd, permissive, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('debates','arguments')
  and cmd = 'SELECT'
order by tablename, policyname;
```

Expect **four** SELECT rows: per table, the canonical `… admins read all` policy (untouched) **and** the new `…_select_circle_member` policy, each `permissive = PERMISSIVE`, `roles = {authenticated}`.

### 12.2 Authed member-read smoke (the runtime proof)

**Fixtures needed:** a circle with **2 live members** (owner A + member B) and **1 circle-scoped room** with ≥1 posted argument, plus a **non-member** user C.

Build (via the shipped service-role Edge Functions + the authed client, `.env.bot-tests` lane):
1. As **A**: `manage-circle` create → circle X; `manage-circle-invite` mint → invite B; as **B** accept → B is a live member of X.
2. As **A**: create a circle-scoped room in X (`create-argument-room` with `circle_id=X`, the START-002 path) and post an argument (`submit-argument`).

Assert (authed anon-key + caller JWT, RLS-scoped):
- **B (live member, non-creator, non-participant):** `from('debates').select('id').eq('id', room)` → **1 row**; `from('arguments').select('id').eq('debate_id', room)` → **≥1 row** (the posted arg). *(Pre-migration both were 0 — this is the AC2 proof.)*
- **C (non-member):** the same two reads → **0 rows** (negative control).
- **Non-circle invariance control:** any user reads a **non-circle private room they are not in** → **0 rows** (unchanged), and a public room → unchanged.

Record the result in the review/verification doc; this is the substitute for the `db reset` runtime check.

---

## 13. Dependencies (cards / docs / files)

- **Assumes complete:** #839 START-002 (merged; stamps `debates.circle_id`, ships the two helpers granted-but-dormant) and #859 PRIVATE-GROUPS-002 (`20260702000001` — the helpers, `debates.circle_id`, `debates_circle_requires_private`, circle SELECT policies).
- **Reads existing:** the net `debates` / `arguments` SELECT policies (`20260606000001`); `is_circle_member`, `is_argument_visible_in_circle`, `is_debate_inactive` (all applied).
- **Canonical spec:** `docs/designs/START-002.md` §5.
- **Blocks:** the `home_v2` pre-flip gate (until this merges, non-creator members cannot read circle rooms) and #840's circle-home **member** lane (a non-creator member's `debates WHERE circle_id=…` returns rows only after this lands).

---

## 14. Doctrine self-check

- **cdiscourse-doctrine §1–§3 (no truth/heat/popularity):** the arms grant *read access* by circle membership — an access boundary, never a ranking, verdict, or truth label. No user-facing string is added (SQL comments only; scanned for verdict tokens by §8). ✓
- **cdiscourse-doctrine §4/§7 (no AI):** no AI call, no Edge, no classifier — pure RLS. ✓
- **cdiscourse-doctrine §5 (engine sacred):** untouched. ✓
- **cdiscourse-doctrine §6 (secrets):** no secret, no key, no `.env`. ✓
- **cdiscourse-doctrine §8 / supabase-edge-contract §4–§5 (RLS + migration discipline):** RLS stays ENABLED on both tables (no `disable`); the migration is a **new** file (append-only — no applied file edited); no direct-insert path added; SELECT-only, no write policy. ✓
- **supabase-edge-contract (no service-role in client):** zero client/Edge change; helpers are `SECURITY DEFINER` server-side functions already granted to `authenticated`. ✓
- **START-002 §5 lockstep contract:** the arguments arm routes through `is_argument_visible_in_circle` (never re-inlines the circle-visibility logic); `circleVisibilityCompositionRlsScan` remains the alarm bell and is untouched. ✓
- **v1 scope (§10 doctrine):** no voting/scoring/search/OAuth/push/public-API — a read-access RLS arm only. ✓

---

## 15. Operator steps

- **Gate:** operator go required before the pipeline runs this card (labeled `gated` + `migration` + `deploy-gated`).
- **Deploy (after merge):** the migration **auto-applies** on merge to `main` via the Supabase GitHub integration. If a manual apply is ever needed: `npx supabase db push --linked`.
- **Verify (after apply):** run §12.1 (pg_policies presence via `npx supabase db query`) then §12.2 (authed member-read smoke: member → rows, non-member → 0, non-circle → unchanged).
- **Then:** #882 closes and the `home_v2` pre-flip gate is satisfied. `home_v2` remains OFF until the operator flips it separately.
- **Rollback (if ever):** ship a new drop-policy migration (§11); do **not** edit the applied file.

---

## Implementer note: cannot proceed to "done" — frozen anchor `circleMigration.test.ts` cannot stay both UNMODIFIED and green (operator decision required)

**Status:** migration + new scan suite implemented and green; card BLOCKED on a pre-existing anchor tripwire the design (§7) did not account for.

**What was built (correct, committed):**
- `supabase/migrations/20260709000001_asp_circles_rls_001_circle_read_arm.sql` — byte-equal to §3 (diff exit 0; 8367 bytes / 121 lines).
- `__tests__/circleReadArmRlsScan.test.ts` — 25 tests, all green in isolation; typecheck + lint clean.

**The blocker.** The existing anchor `__tests__/circleMigration.test.ts:37` — `it('is the highest sequential migration (no later 14-digit timestamp)')` — reads the WHOLE `supabase/migrations/` directory and asserts that `20260702000001_private_groups_002_circles.sql` has the highest 14-digit timestamp of any file there:

```
for (const f of files) {
  if (f === path.basename(migPath)) continue;
  const other = Number(f.match(/^(\d{14})/)?.[1] ?? '0');
  expect(other).toBeLessThan(oursStamp);   // fails: 20260709000001 > 20260702000001
}
```

This is a **self-pin tripwire** that fires on the addition of ANY later migration. This card's migration (`20260709000001`, whose timestamp MUST be strictly greater than `20260702000001` per §3 and supabase-edge-contract append-only discipline) necessarily trips it. There is no timestamp that both satisfies "sequential-after-circles" and leaves this anchor green — the two requirements are mutually exclusive.

**Why this is a STOP, not a silent fix.** The spawn-card prompt makes `circleMigration.test.ts` a hard boundary: it must "remain UNMODIFIED and green" and there must be "zero existing test-file modifications." Given the anchor's content, UNMODIFIED and green cannot both hold once this card's migration exists. Resolving it requires editing a file the card explicitly froze — a test-suite-policy decision the operator/designer reserved (the design's §7 deliberately reasoned the anchors would stay untouched). The implementer will not silently edit a frozen anchor, and will not ship a red suite as "done."

**Blast radius is exactly this one assertion.** Full-suite run: 934 suites / 33,311 tests → 2 failed. The second failure (`pointLifecycleModel.test.ts`, LIFE-001) is the documented wall-clock flake — it PASSES isolated (76/76) and is not in this diff. The other directory-reading anchors are unaffected: `semanticRuntimeConfigMigration.test.ts:143` checks a PREDECESSOR position (stable); the two `uxOneOneFiveA*` tests match a name pattern this migration does not hit. So `circleMigration.test.ts:37` is the sole real, deterministic new red.

**Decision needed from operator/designer — pick one:**
- **Option A (re-point the tripwire; smallest edit).** Authorize a one-assertion update to `circleMigration.test.ts:37-47` so the "highest migration" is now `20260709000001_asp_circles_rls_001_circle_read_arm.sql` (or add it to an allowlist of later migrations). Standard per-migration maintenance edit; ~5 changed lines in one suite. Requires lifting the "circleMigration UNMODIFIED" boundary for this card.
- **Option B (relax the tripwire permanently).** Change the assertion from "no later migration exists" to "the circles migration's timestamp is well-formed and greater than its documented predecessor (`20260630000001_cov_004…`)", so it never again fires on unrelated future migrations. Larger semantic change to the anchor's intent; also a `circleMigration.test.ts` edit.
- **Option C.** Some other operator-preferred resolution.

The implementer stopped here and did NOT write the §7 `current-status.md` "done" entry (slice 3), since the card is not green end-to-end. Once the operator rules, the remaining work is the chosen anchor edit + the current-status entry, then final green gate.
