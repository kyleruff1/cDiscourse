> **Status:** Verification companion to [`docs/designs/QOL-039.md`](./QOL-039.md).
> **Designer pass date:** 2026-05-24.
> **Pass branch:** `design/QOL-039-verification` (this file is the only diff).
> **Card:** QOL-039 — Public ↔ Private Room Visibility Transition Rules.
> **Epic:** Interaction (Rules UX). **Release:** 6.7. **Priority/Effort:** P1 / M.
> **Issue:** https://github.com/kyleruff1/cDiscourse/issues/208
> **Final card in the Interaction-epic dependency chain.** QOL-038 (PR #264) and
> QOL-040 (PR #265) have both shipped; this pass verifies QOL-039 against
> post-merge reality.

# QOL-039 — Verification + Enrichment Pass

The baseline design (`docs/designs/QOL-039.md`, 348 lines, dated 2026-05-21) is
thorough, doctrine-clean, and **pre-dates** the QOL-038 and QOL-040 merges. This
pass assesses the six designer-addendum questions plus three integration checks
against the **shipped** sibling code and migrations, and surfaces three items
that require operator judgment before the implementer can build.

The design's pure-TS model, RLS-replacement plan, neutral-copy contract, UI
states, doctrine self-check, and one-way-transition trigger are all preserved as
the canonical contract. The gaps are concentrated in three places: the notification
dispatch contract (Q4), the audit-trail scope (Q5), and the moderator policy
mismatch between the design's `canTransitionToPrivate` UI gate and the shipped
`room-notifications` Edge Function authorization (Q4 follow-on).

---

## §1 — Verdict Table

| # | Designer-addendum question | Verdict | Section |
|---|---|---|---|
| Q1 | Trigger conditions exhaustive + unambiguous? | **PASS** | §2 |
| Q2 | Participant-filtering rules handle edge cases (incl. QOL-038 pending invites)? | **PASS (with minor note)** | §3 |
| Q3 | RLS-policy changes compose correctly with shipped QOL-038 + QOL-040 RLS? | **PASS** | §4 |
| Q4 | Notification dispatch integrates with shipped QOL-040? | **NEEDS COORDINATION** | §5 |
| Q5 | Audit trail captures enough without privacy concerns? | **NEEDS COORDINATION** | §6 |
| Q6 | Reverse transition (private → public) accounted for? | **PASS** | §7 |

| # | Integration check | Verdict | Section |
|---|---|---|---|
| I1 | QOL-035 terminology (post-merge scrub) | **PASS** | §8.1 |
| I2 | OPS-001 four-class migration checklist | **PASS (with minor update)** | §8.2 |
| I3 | Migration filename slot (stale `20260521000001`) | **GAP FOUND — minor** | §8.3 |
| I4 | QOL-040 §17 follow-up (deep-link node pre-activation) | **OUT OF SCOPE for QOL-039** | §8.4 |

---

## §2 — Q1: Trigger conditions exhaustive + unambiguous?

**Verdict: PASS.**

The design's §5.1 (`canTransitionToPrivate`) and §5.2 (transition action) name
**one** trigger only: a **manual** action by the room creator (or a mod/admin —
the only structural ambiguity, resolved in §5 of this doc) on a `public` room.
There is no automatic trigger (e.g. "auto-private on N rejected chime-ins"); the
storyboards never imply one. The reverse direction is forbidden structurally
(§4.2 trigger + no API + no UI).

Preconditions:
- `currentVisibility === 'public'` (else `already_private`, action hidden)
- `callerUserId === createdByUserId || callerIsModeratorOrAdmin` (else `not_room_creator`)
- Status is `draft`/`open`/`locked`/`archived` (v1: never blocks on status; OQ-3
  reserves `room_archived` as a future blocker if the operator changes their mind)
- Two-step confirmation: open the entry → render consequences → user confirms

These are exhaustive for the v1 scope. The card never proposes auto-transitions
based on heat/popularity/standing (correct per `cdiscourse-doctrine` §1–§3).

**No design change required.**

---

## §3 — Q2: Participant-filtering rules handle edge cases (incl. QOL-038 pending invites)?

**Verdict: PASS (with one minor note for the implementer).**

The design's §5.4 `RoomVisibilityChangeEvent.audiences` partitions correctly:

| Class | Field | Source |
|---|---|---|
| Retained primaries | `retainedParticipantUserIds` | `debate_participants.user_id WHERE side IN ('affirmative','negative')` |
| Rejected chime-ins | `rejectedChimeInUserIds` | GAME-005 `MovedToObserverRecord` from the seat map |
| Other observers who keep read access | `nonParticipantObserverUserIds` | Everyone else who had pre-transition read access |

The design also explicitly covers (§7 / §14 / §15 OQ-2) the **QOL-038 pending-invite
edge case**: a user with an unredeemed invite has an `argument_room_invites` row
but **no** `debate_participants` row. QOL-038's shipped RLS on
`argument_room_invites` (see `supabase/migrations/20260524000013_qol_038_argument_room_invites.sql`
lines 140–147) grants the invitee SELECT visibility against their own row via
`argument_room_invites.invitee_email_lower = lower(auth.jwt() ->> 'email')`.
**This visibility is on the invite row, not on the debate row** — the invitee
can see "you have an invite to debate `<id>`" but cannot read the debate's
arguments until they redeem.

Implications for QOL-039:
1. **No new debate-side or invite-side RLS work required** for pending invitees.
   QOL-038's invite-row RLS continues to work after QOL-039 makes the debate
   private, because the invite SELECT policy makes no reference to debate
   visibility.
2. **Pending invitees are NOT in any QOL-039 audience.** They were not in
   `debate_participants`, so they are not in `retainedParticipantUserIds`. They
   were not in the prior `priorReadAccessIds` set (they could not read the
   debate before the transition). They get **no `room_made_private` notification**
   — and they should not, because their invite still works and the email path
   (when enabled) is owned by QOL-038. The next time they tap their invite link,
   QOL-038's `manage-room-invite` accept action enrols them as a normal primary,
   and they enter the now-private room with full access.

**Minor note for the implementer:** Add one sentence to the design's §6.4
("Private-room read-time chrome") clarifying that a pending invitee redeeming
into a now-private room is the normal QOL-038 accept flow — no special UI state,
no warning. The design implies this but doesn't say it.

**No structural design change required.**

---

## §4 — Q3: RLS-policy changes compose correctly with shipped QOL-038 + QOL-040 RLS?

**Verdict: PASS.**

The three shipped sibling-card RLS surfaces:

1. **QOL-038 `argument_room_invites`** (4 SELECT policies, no
   `authenticated` INSERT/UPDATE/DELETE policy — service-role only).
   Reads-only by inviter, invitee, room creator, mods. Composition with
   QOL-039's debate-side RLS replacements:
   - The "room creator sees every invite on a room they created" policy
     (`ari_select_room_creator`) does an `EXISTS public.debates …`
     subquery scoped by `d.created_by = auth.uid()`. After QOL-039 makes the
     debate private, **the room creator's `created_by = auth.uid()` arm of
     QOL-039's new `debates: select` policy (§4.3.2) still passes**, so the
     EXISTS subquery still resolves. No regression.
   - The "invitee sees their own invite" policy uses `auth.jwt() ->> 'email'` —
     no debate join, immune to QOL-039.

2. **QOL-040 `room_notifications`** (SELECT own + UPDATE own; no INSERT/DELETE
   for `authenticated` — service-role only). RLS is recipient-scoped, never
   references `debates.visibility`. Composition with QOL-039 is independent:
   QOL-039 changes who can read the **debate**; QOL-040 RLS gates who can read
   their **notifications**. A notification row for a private-room transition is
   readable by the recipient regardless of debate visibility (correct — the
   recipient must still see "this argument was made private" even though they
   can no longer read the debate itself, exactly as the design's §5.4 +
   `RoomVisibilityChangeEvent` contract requires).

3. **Baseline RLS** (`supabase/migrations/20260516000002_rls_policies.sql` +
   `20260516000006_fix_debates_rls_recursion.sql`):
   - The design's §4.3.2 / §4.3.3 / §4.3.4 reuse the existing `SECURITY DEFINER`
     helpers (`is_debate_participant`, `is_debate_open_or_locked`) and add two
     siblings (`is_debate_private`, `is_debate_open_or_locked_public`).
     **The pattern is identical** to the recursion-fix migration. No new join
     paths are introduced.
   - The design's §4.3.5 notes that `argument_tags` SELECT delegates through an
     `EXISTS public.arguments …` subquery (verified at
     `20260516000002_rls_policies.sql` lines 244–260). **Therefore the
     `argument_tags` policy inherits QOL-039's new `arguments` SELECT gating
     automatically — no separate `argument_tags` change is required.** The
     design's "if its policy contains a duplicated `debates`-status subquery,
     replace it" branch is unreachable for the live policy; the implementer can
     confirm and skip §4.3.5.

**No design change required.** The implementer should add one defensive
in-migration comment noting that `argument_tags` inherits visibility through
the `arguments` policy, so a future maintainer who refactors `argument_tags`
in isolation will know to preserve that delegation.

---

## §5 — Q4: Notification dispatch integrates with shipped QOL-040? **NEEDS COORDINATION**

**Verdict: NEEDS COORDINATION (two distinct items).**

### 5.1 — Item A: Dispatch payload shape mismatch

The design's §5.4 defines an event shape with a structured `audiences` object:

```ts
audiences: {
  retainedParticipantUserIds: ReadonlyArray<string>;
  rejectedChimeInUserIds: ReadonlyArray<string>;
  nonParticipantObserverUserIds: ReadonlyArray<string>;
}
```

The shipped `room-notifications` Edge Function
(`supabase/functions/room-notifications/index.ts`, lines 650–700) expects a
**flat** `priorReadAccessIds` array on the request body:

```ts
// from the shipped handler
const priorAccess: string[] = Array.isArray(
  (body as unknown as { priorReadAccessIds?: unknown }).priorReadAccessIds
)
  ? ((body as unknown as { priorReadAccessIds: unknown[] }).priorReadAccessIds as unknown[])
      .filter((x): x is string => typeof x === 'string')
  : [];
const recipients = priorAccess.filter(
  (id) => !currentPrimaries.has(id) && id !== callerId,
);
```

The shipped Edge Function:
- Trusts the caller's `priorReadAccessIds` (no re-derivation — the caller
  computed it from the in-session GAME-005 seat map + `debate_participants`
  query).
- Strips current primaries server-side defensively.
- Strips the caller (the room creator) defensively.
- Does **not** distinguish "rejected chime-in" from "non-participant observer"
  for the dispatch (both receive the same `room_made_private` notification with
  no per-class personalization). The design's separate `chime_in_rejected`
  notification (storyboard Step 15, second neutral notification) is a **separate
  trigger** the room creator/primary fires via the same Edge Function with
  `type: 'chime_in_rejected'`, NOT a sub-array of the `room_made_private`
  payload.

This is **doctrine-aligned** (the shipped contract is correct — it deliberately
strips structural personalization so the recipient can't infer their own
"class") but the **design's `audiences` partition is over-engineered relative
to the shipped contract**.

**Recommendation — designer:**

Replace the design's §5.4 `audiences` object with:

```ts
export interface RoomVisibilityChangeEvent {
  roomId: string;
  from: 'public';
  to: 'private';
  actorUserId: string;
  occurredAt: string;
  /**
   * Every user who had read access BEFORE the transition. Includes
   * current primaries (the Edge Function strips them defensively); the
   * client passes the raw set as derived from GAME-005's seat map +
   * `debate_participants` query at the moment of the UPDATE.
   *
   * Excludes pending QOL-038 invitees (they could not read the debate
   * before the transition; their invite remains valid).
   */
  priorReadAccessIds: ReadonlyArray<string>;
  /**
   * For follow-up `chime_in_rejected` notifications. Populated from
   * GAME-005's `MovedToObserverRecord` set. Each id triggers a
   * SEPARATE `room-notifications` call with type='chime_in_rejected'
   * — they are NOT part of the `room_made_private` payload.
   */
  rejectedChimeInUserIds: ReadonlyArray<string>;
}
```

The two notifications then dispatch as two separate `room-notifications` calls
(one with type `room_made_private` carrying `priorReadAccessIds`; one or more
with type `chime_in_rejected` per rejected chime-in's `argumentId`), matching
the shipped contract verbatim. **No QOL-040 Edge Function change required.**

The design's `retainedParticipantUserIds` field is dropped — the QOL-040 Edge
Function recomputes it from `debate_participants` and does not need the caller
to pass it.

### 5.2 — Item B: Moderator allowed at the UI/RLS layer but not at the dispatch layer

The design's §5.1 (`canTransitionToPrivate`) and §4.2 (one-way trigger) allow
**creator OR moderator/admin** to perform the transition. The shipped
`room-notifications` `handleRoomMadePrivate` (lines 650–700) hard-codes:

```ts
// from the shipped handler
if (debate.created_by !== callerId) return forbidden('not_creator');
```

A moderator transitioning a public room to private would:
1. Pass the §4.2 DB trigger (no mod restriction there)
2. Pass the §4.3.2 `debates` UPDATE RLS policy (already allows creator OR mod)
3. **Fail** the QOL-040 `room-notifications` authorization check → no
   `room_made_private` notification fires

This is a real integration gap. Three resolution options:

| Option | Description | Trade-off |
|---|---|---|
| **A (recommended)** | Tighten QOL-039's `canTransitionToPrivate` to **creator-only**, dropping the mod arm. The §5.1 `not_room_creator` code applies to mods too. The §4.2 trigger and `debates` UPDATE RLS keep their existing creator-or-mod permission (they are layered defense), but the UI never offers the action to a mod. | Loses the "abusive room going dark for cause" admin path. Matches storyboards exactly ("the creator toggles visibility"). Operator/admin retains a service-role intervention path (out of QOL-039 scope). |
| **B** | Widen QOL-040's `handleRoomMadePrivate` to also accept moderator/admin callers. Requires a small follow-up edit to a shipped QOL-040 file — adds an `is_moderator_or_admin()` profile lookup. | Modifies a shipped Edge Function (against this card's "no QOL-040 modifications" mandate from QOL-040 §E7.4). Best done as a small QOL-040 patch card. |
| **C** | Document the mismatch as an explicit gap: mod-initiated transitions succeed structurally (DB + RLS) but fire no `room_made_private` notification. | Storyboard violation — the prior-read-access observers would silently lose access. Not acceptable. |

**Recommendation:** **Option A** — narrow QOL-039 to creator-only for v1. Add a
follow-up card (`QOL-040.2: mod-initiated visibility transition notifications`)
if the operator wants the mod path later. This:
- Matches the storyboards' literal wording.
- Keeps QOL-039 from touching any shipped QOL-040 file (preserves the operator's
  read-only-from-QOL-040 mandate established in QOL-040 §E7.4).
- Preserves the design's three-layer defense for the DB+RLS path (no migration
  change), so a mod's service-role intervention still works structurally.

---

## §6 — Q5: Audit trail captures enough without privacy concerns? **NEEDS COORDINATION**

**Verdict: NEEDS COORDINATION.**

The design's §4.1 last paragraph and §11 (Out of Scope) explicitly defer an
audit table:

> No second column for "transitioned vs created private." The card needs only
> the current state. If audit history is later wanted, that is a separate
> append-only `room_visibility_changes` audit table — explicitly out of scope.

The operator's prompt explicitly raises the bar:

> "the audit trail should record the transition timestamp, the trigger
> condition (manual moderator action with the moderator's identity, or
> automatic with the triggering condition named), the retained participant
> count, the dropped participant count, and any chime-ins that were rejected."

These are incompatible. The design ships *current state* only; the operator
wants a *transition log*. Three resolution options:

| Option | Description | Trade-off |
|---|---|---|
| **A** | Ship the design as-is — no audit table. The `RoomVisibilityChangeEvent` payload (§5.4) is the in-flight contract; nothing is persisted beyond `debates.visibility`. | Simplest. Aligns with v1 scope discipline. Operator's audit requirement goes unmet. |
| **B (recommended if operator requires audit)** | Add a new `room_visibility_changes` audit table to QOL-039's migration (same migration, same operator deploy). Insert-only, mod/admin SELECT, service-role INSERT (or insert via a `BEFORE UPDATE` trigger on `debates.visibility`). Records: `id`, `debate_id`, `from_visibility`, `to_visibility`, `actor_user_id`, `actor_role` (creator / mod / admin), `transitioned_at`, `retained_participant_count`, `dropped_observer_count`, `rejected_chime_in_count`. **Counts only** — no user IDs in the audit row (privacy: a future operator scanning audit rows cannot reconstruct which named observer lost access). The structured payload of who-was-affected stays in the in-flight `RoomVisibilityChangeEvent` only, where it's needed only briefly to dispatch notifications. | Privacy-safe (counts not identities). Matches the operator's literal requirement. Adds ~30 lines to the QOL-039 migration. |
| **C** | Defer the audit table to a separate `OPS-002` card. QOL-039 ships without it; QOL-040's existing `admin_audit_events` is not reused (its event types are scoped to user-management actions, not room-visibility). | Splits the work cleanly. May leave an audit gap for some weeks. |

The privacy guardrail in Option B is the load-bearing piece: the audit row must
carry **counts** (not user IDs) so a future operator running `SELECT * FROM
room_visibility_changes` does not see "user X is in the dropped-observer list
for a room they were observing without anyone else being able to reconstruct
that affiliation from current state." This matches the design's §5.5 redaction
contract for QOL-040, applied at the audit layer.

**Operator decision required** (binding for the implementer):

1. **Option A** (no audit, ship the design as-is)?
2. **Option B** (add the counts-only audit table to QOL-039's migration)?
3. **Option C** (defer the audit to OPS-002)?

The designer recommends **Option B** because:
- It directly addresses the operator's stated requirement.
- Counts are doctrine-safe (no identity exposure).
- It's a small addition (~30 lines + one RLS policy block) that lives in the
  same migration the implementer is already writing.
- It avoids a follow-up card that would re-touch the `debates`-visibility
  pipeline a few weeks later.

If the operator selects Option B, the implementer adds:

```sql
CREATE TABLE public.room_visibility_changes (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id                   uuid NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  from_visibility             text NOT NULL CHECK (from_visibility IN ('public', 'private')),
  to_visibility               text NOT NULL CHECK (to_visibility IN ('public', 'private')),
  actor_user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_role                  text NOT NULL CHECK (actor_role IN ('creator', 'moderator', 'admin')),
  trigger_condition           text NOT NULL DEFAULT 'manual_creator_action'
                                CHECK (trigger_condition IN ('manual_creator_action', 'manual_moderator_action', 'manual_admin_action')),
  retained_participant_count  integer NOT NULL DEFAULT 0 CHECK (retained_participant_count >= 0),
  dropped_observer_count      integer NOT NULL DEFAULT 0 CHECK (dropped_observer_count >= 0),
  rejected_chime_in_count     integer NOT NULL DEFAULT 0 CHECK (rejected_chime_in_count >= 0),
  transitioned_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.room_visibility_changes ENABLE ROW LEVEL SECURITY;

-- SELECT: mods/admins read all rows.
CREATE POLICY rvc_select_mod_or_admin
  ON public.room_visibility_changes FOR SELECT
  TO authenticated
  USING (public.is_moderator_or_admin());

-- SELECT: the room creator reads their own room's history.
CREATE POLICY rvc_select_room_creator
  ON public.room_visibility_changes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.debates d
      WHERE d.id = room_visibility_changes.debate_id
        AND d.created_by = auth.uid()
    )
  );

-- NO INSERT/UPDATE/DELETE policy for authenticated.
-- INSERT is via the client's API wrapper at transition time (uses the caller's
-- JWT; the transition itself is already authorized, so the audit insert is a
-- safe-side-effect — write it from the same `transitionRoomToPrivate` wrapper
-- as a second statement in a transaction).
```

Wait — that needs reconsideration. INSERT via the authenticated client would
require an INSERT policy. The cleaner shape:

- **Either** add an INSERT policy `WITH CHECK (actor_user_id = auth.uid() AND
  EXISTS (room creator OR mod check))`, **or**
- Move the audit-insert into a small Edge Function `record-visibility-transition`
  that takes the counts + does the UPDATE + the INSERT atomically via
  service-role.

The Edge Function path is cleaner (atomicity, no client INSERT policy needed,
follows the same precedent as `manage-room-invite`) but it means the design's
§4.4 ("a client `UPDATE`, not an Edge Function") needs revisiting if Option B
is selected. **Surface this to the operator as part of the Option B decision.**

If Option B is selected and the operator prefers the Edge Function path:
- New Edge Function `record-visibility-transition` (~80 lines).
- The client wrapper `transitionRoomToPrivate` calls the function instead of
  doing a direct UPDATE.
- The Edge Function: JWT-verified, re-derives creator-or-mod authorization,
  runs the UPDATE + the audit INSERT in a single transaction via service-role,
  emits the `RoomVisibilityChangeEvent` payload back to the client for QOL-040
  dispatch.

If Option B with the client-INSERT path:
- The migration adds the table + the INSERT policy `WITH CHECK (actor_user_id
  = auth.uid())` and the SELECT policies above.
- The client wrapper does two writes (UPDATE then INSERT) — not atomic; a
  network failure between them leaves an orphaned visibility-change without an
  audit row. Acceptable for v1; the audit is best-effort.

---

## §7 — Q6: Reverse transition (private → public) accounted for?

**Verdict: PASS.**

The design's §4.2 specifies a `BEFORE UPDATE OF visibility` trigger that raises
`room_visibility_is_one_way` on any `private → public` attempt — at the DB
layer, below RLS, below the API wrapper, below the UI. Mods/admins are
**not** exempted (correct per the privacy doctrine that re-exposing a private
room is never appropriate).

The operator's prompt explicitly confirms one-way is honored. **No design
change required.**

---

## §8 — Integration Checks

### 8.1 — I1: QOL-035 terminology

The design already uses `argument` not `debate` in user-facing copy
(verified in §6 + §11 of the design). The `debates` table name remains
internal; the badge says "Private", not "Private debate"; consequences bullets
say "this argument". **PASS.** No design change required.

### 8.2 — I2: OPS-001 four-class migration checklist

The design's migration plan (§4.1–§4.3) preemptively addresses:

| Class | Risk | Design coverage |
|---|---|---|
| 1 (ambiguous column refs) | None likely — the design's RLS policies do not contain subqueries that join multiple tables with shared column names. The only EXISTS subqueries are scoped by `d.id = p_debate_id` inside `SECURITY DEFINER` helpers, fully qualified. | **PASS.** Implementer should preserve the qualified names per QOL-038's precedent. |
| 2 (type mismatches) | None — `visibility text CHECK (...)` mirrors the existing `status text CHECK (...)` on `debates`. | **PASS.** |
| 3 (statement order) | The migration must apply in this order: ADD COLUMN → COMMENT → CREATE TRIGGER FUNCTION → CREATE TRIGGER → CREATE HELPER FUNCTIONS → REVOKE/GRANT → DROP POLICY → CREATE POLICY (four times). The design's §4 already implies this order; the implementer must preserve it. | **PASS (with note).** Add explicit ordering comment in the migration header. |
| 4 (function/extension dependencies) | None new — reuses existing `SECURITY DEFINER` pattern and `is_moderator_or_admin()` / `is_debate_participant()` / `is_debate_open_or_locked()` helpers. **No new extension dependency** (no `pgcrypto` usage — no `gen_random_uuid()` calls in this migration unless Option B audit table is selected, in which case `pgcrypto` becomes a dependency the implementer must document in the file header per QOL-038's precedent). | **PASS (with conditional update).** If Option B is selected, document `pgcrypto` dependency. |

### 8.3 — I3: Migration filename slot (stale `20260521000001`)

**GAP FOUND — minor.** The design's `20260521000001_qol039_room_visibility.sql`
is stale. The latest applied migration is `20260524000014_qol_040_room_notifications.sql`.

**Recommendation:** Use `20260524000015_qol_039_room_visibility.sql` (or the
next free slot after the latest applied migration at commit time). The design's
own caveat ("timestamp must sort after the latest existing migration … confirm
at write time") is the canonical instruction; the implementer reads the live
migrations directory.

If Option B (audit table) is selected, the implementer can choose to:
- Bundle the audit table into the same migration (`20260524000015`), keeping
  the deploy a single `db push`, OR
- Ship two migrations (`20260524000015_qol_039_room_visibility.sql` +
  `20260524000016_qol_039_visibility_change_audit.sql`) for cleaner blame
  history.

The designer recommends **one bundled migration** for v1 — both pieces are part
of the same atomic feature deploy.

### 8.4 — I4: QOL-040 §17 follow-up (deep-link node pre-activation)

The QOL-040 §17 follow-up concerns the deep-link route's argument-node
pre-activation for notifications. QOL-039's `room_made_private` notification
**deliberately resolves to a `null` deep link** (see `resolveDeepLink` in
`src/features/notifications/notificationModel.ts:279`) — the recipient no
longer has access, so there is no node to navigate to. **The §17 follow-up does
not apply to QOL-039.**

QOL-039's `chime_in_rejected` notifications (one per rejected chime-in,
dispatched separately per §5.1 above) DO carry an `argumentId` and rely on the
existing deep-link resolution. The pre-activation behavior is whatever QOL-040
ships; QOL-039 does not need to drive new pre-activation logic.

**No coordination required.** No new follow-up card from QOL-039.

---

## §9 — Operator Decisions — RESOLVED (2026-05-24)

The operator resolved all three NEEDS COORDINATION items on 2026-05-24. The
canonical decisions and their full rationale are recorded in
[`docs/designs/QOL-039.md` §E1](./QOL-039.md#e1--operator-decisions-2026-05-24).
Summary table:

| # | Decision | Operator selection | Implementation reference |
|---|---|---|---|
| OD-1 | Moderator allowance for `→ private` transition | **Option A** — creator-only UI gate; DB+RLS retain mod path as defense-in-depth; QOL-040.2 reserved as follow-up. | Design §E1.1, §E1.4 — `canTransitionToPrivate` drops the mod arm. |
| OD-2 | Audit trail table | **Option B** — ship `room_visibility_changes` in QOL-039's migration; counts-only privacy guard; chime-in argument IDs (not user IDs) for moderation review. | Design §E1.2 — full column shape + RLS policies + OPS-001 four-class checklist. |
| OD-3 | Edge Function path or client INSERT-policy path | **Edge Function path** — new `record-visibility-transition` function handles atomic UPDATE + audit INSERT + notification dispatch. | Design §E1.3 — full Edge Function specification + tests + cross-function call pattern. |

**Implementer status:** unblocked. Proceed with the build using
`docs/designs/QOL-039.md` (including the §E1 enrichment) + this verification
doc (with §9 marked RESOLVED) + the six minor updates in §10 as the canonical
contract.

---

## §10 — Minor Updates — APPLIED via design §E1 (2026-05-24)

All six minor updates were captured in the design enrichment §E1 (or the §E1.4
–E1.8 sub-sections that cross-reference each item). Status:

| # | Update | Status | Reference |
|---|---|---|---|
| 1 | Migration filename `20260521000001` → `20260524000015` | APPLIED | Design §E1.7. |
| 2 | `RoomVisibilityChangeEvent` shape → flat `priorReadAccessIds` + `rejectedChimeInUserIds` + `rejectedChimeInArgumentIds` | APPLIED | Design §E1.5. |
| 3 | `argument_tags` delegation confirmation comment | APPLIED | Design §E1.6. |
| 4 | `canTransitionToPrivate` simplification to creator-only (per OD-1) | APPLIED | Design §E1.4. |
| 5 | §6.4 QOL-038 pending invitee clarification | APPLIED | Design §E1.8. |
| 6 | §11 Out of Scope update — remove "audit table out of scope" bullet (per OD-2) | APPLIED | Design §E1.2 explicitly removes the bullet; the audit table is now in scope. |

The implementer reads design §E1 (including §E1.1–E1.8) as the canonical
specification for each of these updates.

---

## §11 — Readiness — UNBLOCKED (2026-05-24)

Operator decisions OD-1, OD-2, OD-3 are resolved (see §9 above). The six §10
minor updates are applied via design §E1. The implementer proceeds with the
build using `docs/designs/QOL-039.md` §E1 as the canonical operator-decisions
contract alongside the original design above.

### Original readiness assessment (preserved for posterity)

**Status:** Blocked on operator decisions OD-1, OD-2, OD-3. After those are
recorded, the implementer can proceed with the build using:

- This verification doc as the integration contract;
- The original design doc as the canonical UI / model / RLS-replacement spec;
- The minor updates in §10 to be applied in-place by the implementer at build
  start.

No QOL-038 or QOL-040 source file is modified by QOL-039's build (per the
operator's read-only mandate for sibling shipped cards).

## §12 — Cross-references

- Sibling verification docs: [`QOL-038-verification.md`](./QOL-038-verification.md),
  [`QOL-040-verification.md`](./QOL-040-verification.md).
- Shipped sibling files (read-only from QOL-039):
  - `supabase/migrations/20260524000013_qol_038_argument_room_invites.sql`
  - `supabase/migrations/20260524000014_qol_040_room_notifications.sql`
  - `supabase/functions/manage-room-invite/index.ts`
  - `supabase/functions/room-notifications/index.ts`
  - `src/features/invites/inviteModel.ts`
  - `src/features/notifications/notificationModel.ts`
- Baseline RLS (read-only from QOL-039):
  - `supabase/migrations/20260516000002_rls_policies.sql`
  - `supabase/migrations/20260516000006_fix_debates_rls_recursion.sql`
- Doctrine anchors: `cdiscourse-doctrine` skill §1–§10;
  `supabase-edge-contract` skill (Edge Function shape + RLS pattern library);
  `accessibility-targets` (private-room badge UI).
- OPS-001 reviewer template: `.claude/agents/roadmap-reviewer.md` §
  "Migration-bearing card verification (mandatory)".
