-- ============================================================
-- Migration: 20260523000001_qol_041_1_fix_concession_acceptances_policies
-- Description: QOL-041.1 — fix-forward for the QOL-041 deploy-blocker.
--
--   The companion migration
--   `20260522000012_qol_041_concession_acceptance.sql` failed to apply
--   to the remote database with:
--
--     ERROR: column reference "debate_id" is ambiguous (SQLSTATE 42702)
--     at statement 18 (create policy ca_insert_receiver ...)
--
--   Per CLAUDE.md doctrine ("Never edit an applied migration — write a
--   new one"), the original migration file is NOT edited. This is a
--   pure fix-forward.
--
--   Root cause: five unqualified `debate_id` references in three INSERT
--   policy WITH-CHECK subqueries. Each bare reference is ambiguous
--   between the outer policy-target row (the row being inserted) and
--   the subquery's joined row:
--
--     - ci_insert_author      (public.concession_items)         — 2 refs
--     - ca_insert_receiver    (public.concession_acceptances)   — 2 refs
--     - mr_insert_reactor     (public.move_reactions)           — 1 ref
--
--   The original migration's transaction rolled back at the second
--   policy, so the same bug exists in ci_insert_author (defined
--   earlier) and mr_insert_reactor (defined later) — they were never
--   created on the remote.
--
--   The fix is to qualify each outer-row reference with the policy's
--   target table name (e.g. `concession_items.debate_id` instead of
--   bare `debate_id`). Policy logic is preserved verbatim — only the
--   column-reference disambiguation changes.
--
--   No new tables, no new columns, no data migrations, no ALTER TABLE,
--   no RLS toggling. DROP-and-recreate policies only.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1) ci_insert_author — concession_items (2 refs at original lines 92, 98)
-- ──────────────────────────────────────────────────────────────

-- ── INSERT — the conceding-party author writes the row; the
--    submit-argument Edge Function is the real gate, RLS is
--    defense-in-depth. The argument must belong to the debate and the
--    author must be the row's author_id. The outer `debate_id` reference
--    is now qualified as `concession_items.debate_id` (QOL-041.1
--    SQLSTATE 42702 fix). ──
drop policy if exists ci_insert_author on public.concession_items;
create policy ci_insert_author
  on public.concession_items
  for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.arguments a
      where a.id = argument_id
        and a.debate_id = concession_items.debate_id
        and a.author_id = author_id
    )
    and exists (
      select 1 from public.arguments p
      where p.id = conceded_to_argument_id
        and p.debate_id = concession_items.debate_id
    )
  );

-- ──────────────────────────────────────────────────────────────
-- 2) ca_insert_receiver — concession_acceptances (2 refs at original
--    lines 198, 209). This is the policy whose ambiguity triggered
--    the original SQLSTATE 42702 failure.
-- ──────────────────────────────────────────────────────────────

-- ── INSERT — only the receiver of the original concession may grade
--    it. The receiver is the AUTHOR of the conceded-to node behind the
--    concession_item_id. The submit-argument Edge Function enforces
--    this authoritatively; RLS is defense-in-depth. Outer `debate_id`
--    references are now qualified as `concession_acceptances.debate_id`
--    (QOL-041.1 SQLSTATE 42702 fix). ──
drop policy if exists ca_insert_receiver on public.concession_acceptances;
create policy ca_insert_receiver
  on public.concession_acceptances
  for insert
  with check (
    auth.uid() = receiver_id
    -- The receiving argument must belong to the same debate and be
    -- authored by the receiver.
    and exists (
      select 1 from public.arguments r
      where r.id = argument_id
        and r.debate_id = concession_acceptances.debate_id
        and r.author_id = receiver_id
    )
    -- The conceded-to node's author MUST be the receiver — only the
    -- participant the concession was MADE TO may grade it.
    and exists (
      select 1
      from public.concession_items ci
      join public.arguments p
        on p.id = ci.conceded_to_argument_id
      where ci.id = concession_item_id
        and ci.debate_id = concession_acceptances.debate_id
        and p.author_id = receiver_id
    )
  );

-- ──────────────────────────────────────────────────────────────
-- 3) mr_insert_reactor — move_reactions (1 ref at original line 286)
-- ──────────────────────────────────────────────────────────────

-- ── INSERT — the reactor may insert as themselves on a move they can
--    see. The eligibility rule "no fist-bump on your own move" is
--    enforced in the `react-to-move` Edge Function (RLS does not have
--    cheap access to the argument's author_id without a join — the
--    function is the authoritative gate). RLS is defense-in-depth.
--    Outer `debate_id` reference is now qualified as
--    `move_reactions.debate_id` (QOL-041.1 SQLSTATE 42702 fix). ──
drop policy if exists mr_insert_reactor on public.move_reactions;
create policy mr_insert_reactor
  on public.move_reactions
  for insert
  with check (
    auth.uid() = reactor_id
    and exists (
      select 1 from public.arguments a
      where a.id = argument_id
        and a.debate_id = move_reactions.debate_id
    )
  );
