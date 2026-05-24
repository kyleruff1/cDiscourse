# QOL-040 — Design verification + enrichment assessment

**Status:** Verification pass (2026-05-24 designer phase)
**Base:** `main` HEAD `84aeb23` (QOL-038 invite → signup/auth → argument-room return path).
**Original design:** [`docs/designs/QOL-040.md`](./QOL-040.md) (dated 2026-05-21).
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/209
**Skill consulted:** `cdiscourse-doctrine` (invoked before any read or write per the agent contract).

---

## §0 — Purpose

The QOL-040 design (2026-05-21) predates seven post-slate landings the
notification surface now has to integrate with:

| PR / commit | Date | What changed that QOL-040 must reconcile |
|---|---|---|
| #252 MCP-CAT-001 | 2026-05-23 | `SEMANTIC_CLASSIFIER_CATALOG` expanded 23 → 35 ids. No direct effect on QOL-040 (notifications never re-classify a move). |
| #253 QOL-035 | 2026-05-23 | Terminology scrub: `debate` → `argument`, `moderator` → `observer` / `admin`. QOL-040 must follow. |
| #254 band-space-rent smoke | 2026-05-23 | Smoke verification only. No effect. |
| #255 / #257 / #259 QOL-041 chain | 2026-05-23 | Concession list + acceptance gradient + fist-bump. QOL-040 reads the gradient for `concession_challenged` discrimination — the gradient now exists. |
| #262 OPS-001 | 2026-05-24 | Reviewer template strengthened with the four-class migration gate. QOL-040 ships a migration — the gate applies on review. |
| #264 QOL-038 | 2026-05-24 | Invite backend shipped. Email **deliberately deferred to QOL-040**: the `manage-room-invite` create response already returns `notification: 'queued' \| 'sent' \| 'not_configured'`, with `'queued'` (no email) hard-wired as the v1 shipped state. |

This document assesses the QOL-040 design against the five questions named
in the designer addendum, the QOL-038 integration surface, and the
issue-body-vs-addendum email tension. It sits beside the original design
and (where gaps are found) appends a single dated enrichment section to
the source design (§4 below).

---

## §1 — Q1: Notification storage model — **PASS (with one stale reference)**

> Does the design's `room_notifications` table shape include the necessary
> fields for each notification kind: recipient, source event (room +
> argument + optional invite), lifecycle state (created / delivered / read
> / dismissed / expired), created/read/dismissed/expired timestamps?

**Audit of the proposed schema (`docs/designs/QOL-040.md` §6.1):**

| Field requirement | Where addressed |
|---|---|
| Recipient user | `recipient_id uuid not null references auth.users(id) on delete cascade` |
| Source event — room | `debate_id uuid not null references public.debates(id) on delete cascade` |
| Source event — argument node (nullable for room-level events) | `argument_id uuid references public.arguments(id) on delete set null` |
| Source event — invite (optional) | Not present in the table; the design routes invite events through `type='invite'` + the invite's underlying row, not a direct FK. **Acceptable** — keeping `room_notifications` invite-agnostic avoids a coupling to QOL-038's exact column shape. The `invite_id` link can be added later if needed; routing today is via the notification's deep-link target (the room root, per §5 trigger 1). |
| Lifecycle states | `read_at timestamptz` + the implicit `created_at` (created → read). Explicit `dismissed_at` and `expired_at` are **not present**. See §3 below for why this is intentional and acceptable for v1. |
| Created timestamp | `created_at timestamptz not null default now()` |
| Read timestamp | `read_at timestamptz` |
| Per-trigger neutral metadata | `meta jsonb not null default '{}'` — bounded to neutral nouns per §6.3 (`classification`, `roomIsPrivate`, `actorNameVisible`, `actorDisplayName`). |

**RLS posture (OPS-001 four-class checklist):**

- **Class 1 (ambiguous column references):** The proposed policies
  (`room_notifications_select_own`, `room_notifications_update_own_read`)
  reference `auth.uid() = recipient_id`. The policy target table is
  `public.room_notifications`; `recipient_id` is unambiguous on that table.
  **No subquery joins** are present in either policy, so the QOL-041 motivating
  ambiguity class is structurally impossible. **PASS** — but the implementer
  should still write the policies with fully-qualified
  `room_notifications.recipient_id` per the OPS-001 defensive discipline
  (mirrors QOL-038's `argument_room_invites.invited_by` discipline).
- **Class 2 (column type mismatches):** All FKs target `uuid` columns
  (`auth.users.id`, `public.debates.id`, `public.arguments.id`). The local
  declarations are all `uuid`. **PASS.**
- **Class 3 (implicit ordering dependencies):** The design specifies
  `create table` → `create index` → `enable row level security` → `create
  policy`. This is the correct order. **PASS** — the implementer
  must preserve it in the SQL.
- **Class 4 (function/trigger/extension dependencies):** The design uses
  `gen_random_uuid()` for the `id` default, which requires `pgcrypto`. The
  QOL-038 migration documents the same dependency in its header (per
  OPS-001 §4); QOL-040 must do the same.

**ONE STALE REFERENCE.** Design §6.1 names the migration as
`supabase/migrations/20260522000010_qol040_room_notifications.sql`. That
filename now collides with three migrations that landed after the design
was written:

- `20260522000011_admin_ai_001_semantic_referee_runtime_config.sql`
- `20260522000012_qol_041_concession_acceptance.sql`
- `20260524000013_qol_038_argument_room_invites.sql`

The design itself flags this risk in the §6.1 second paragraph
(*"the implementer must re-check `supabase/migrations/` for the true next
number at build time"*) so it is not a design defect — it is a
build-time correctness item. The implementer must use
`20260524000014_qol_040_room_notifications.sql` (or later if more
migrations land before QOL-040). The proposed filename is not the design's
canonical contract — the **schema** is the design's contract, and that
holds.

**Verdict: PASS.** The implementer must (a) re-pick the migration number,
(b) use fully-qualified column references inside policies per OPS-001
defensive discipline, and (c) document the `pgcrypto` dependency in the
migration header per the QOL-038 precedent.

---

## §2 — Q2: Delivery channel abstraction — **GAP FOUND (load-bearing)**

> Does the design include a delivery-channel abstraction that supports
> both in-app (the primary v1 channel) AND email (the QOL-038-deferred
> secondary channel)? Is email delivery configuration-gated (disabled by
> default, enabled per environment via env var or runtime config)?

This is the load-bearing finding of the verification pass. Three
sources are in tension and must be reconciled before the implementer
proceeds.

### The three positions

| Source | What it says about email in QOL-040 |
|---|---|
| **Issue body #209 (Out of scope)** | "Push notifications excluded by v1 scope. In-app notifications only." |
| **QOL-040 design §1 (In scope) + §16 (Out of scope)** | "**No push notifications** — In-app only." "QOL-040 sends **no email**." Email is explicitly disclaimed. |
| **QOL-038 design §5.1.1 + §17.3 + shipped code** | "`INVITE_EMAIL_ENABLED=true` (operator-gated, delivered by QOL-040): the function calls the email provider (Resend, the same dependency `request-argument-deletion` already uses, with the same graceful `not_configured` fallback)." The shipped `CreateRoomInviteResponse.notification` type already lists `'queued' \| 'sent' \| 'not_configured'`, with QOL-038's review verdict naming *"QOL-040 owns the email flip"*. |
| **QOL-040 designer addendum (operator instruction for this pass)** | "Design for BOTH in-app AND email delivery (because QOL-038 deferred email here)." |

### Disambiguation: push ≠ email

The issue body and the doctrine both forbid **push notifications**
(mobile OS push, APNs/FCM, `expo-notifications` push token, background
delivery). **Email is a different channel** and is not in the
"What Not to Build (v1 scope)" list in either `CLAUDE.md` or the
`cdiscourse-doctrine` skill. The QOL-038 design and shipped code both
treat email as the QOL-040-owned delivery surface for the invite trigger
specifically.

The conflict is therefore narrow and reconcilable:

- **Push** stays out of scope (issue body + doctrine concur).
- **Email** is in scope **for the invite trigger only**, gated by an
  Edge-Function env flag (`INVITE_EMAIL_ENABLED`) that is **off by
  default**, mirroring `request-argument-deletion`'s gated
  `RESEND_API_KEY` pattern.
- **Email for the other 8 triggers** stays out of scope for v1. The
  design's §16 "no email digest" guarantee holds for everything that is
  not an invite.

### What the current design has, and what it lacks

The current design (§5 row 1, §6.4 second paragraph) describes the
`invite` trigger as producing an **in-app** notification only. It says
*"the in-app notification appears once they have an account; the email
is QOL-038's"*. But QOL-038 shipped without an email sender — its design
§5.1.1 and review verdict explicitly hand the email path to QOL-040, and
the shipped `CreateRoomInviteResponse.notification` field literally
lists `'sent'` as a return value that can never actually occur until
QOL-040 implements the email path.

If QOL-040 ships as currently designed, there is no card on the roadmap
that wires the `INVITE_EMAIL_ENABLED=true` path. The contract surface in
`src/features/invites/inviteApi.ts:46` becomes vestigial; the
`'queued'` → `'sent'` transition never happens; the invite-by-email
storyboard step (Scenario 1 Step 4, Scenario 2 Step 3) silently degrades
to "the inviter copies the link and pastes it elsewhere", which is the
Stage 6.1.0 placeholder behaviour the entire QOL-038 + QOL-040 pair was
meant to retire.

### Verdict: **GAP FOUND**

The current design closes a loop the shipped QOL-038 code is open on.

**Recommendation (the operator's call — surfaced here for decision):**
the design should **scaffold an email channel for the `invite` trigger
only**, off by default behind `INVITE_EMAIL_ENABLED`, calling the same
`maybeSendInviteEmail` helper that follows the
`request-argument-deletion` Resend pattern verbatim. The other 8
triggers stay in-app only. The §4 enrichment to the source design (see
below) proposes exactly this scaffold and no more.

The operator's verdict on whether to include the email scaffold is the
gate. If yes, the design is enriched per §4. If no, an explicit
follow-up card (e.g. QOL-040.1) must be carved out for the email path so
the QOL-038 contract surface does not stay vestigial.

---

## §3 — Q3: Notification lifecycle state machine — **PASS**

> The transitions: created → delivered → read; delivered → dismissed;
> delivered → expired. Every transition has clear triggering conditions?

The design's lifecycle is intentionally **minimal**:

- `created` is implied by row existence (`created_at` not null).
- `delivered` is **not modelled separately** — for an in-app channel, the
  poll-on-focus (`useNotifications` §6.6) means *"delivered"* and
  *"visible to the user"* are the same event. The design does not need
  an explicit `delivered_at` for v1. The dual nature only matters when a
  push channel is added (a future card outside QOL-040).
- `read` is modelled (`read_at timestamptz`). Transition triggered by
  tap on the row (`markNotificationRead`) or "Mark all read"
  (`markAllNotificationsRead`).
- `dismissed` and `expired` are **not modelled.** This is acceptable for
  v1 — a notification that the user did not read but no longer cares
  about simply sits in the list. The "expired" concept does not apply to
  in-app notifications the way it does to push notifications (where
  Apple/Google may drop a payload).

**One observation for the implementer.** The design's §11 test plan does
not name a test asserting `read_at` is **idempotent** — calling
`markNotificationRead(id)` twice should be a no-op. The implementer
should add `__tests__/notificationsApi.markRead.idempotent.test.ts` (or
fold the assertion into the existing
`__tests__/notificationsApi.test.ts` if it exists). Non-blocking, but
the lifecycle is cleaner with the assertion.

**Verdict: PASS.** The lifecycle is intentionally and correctly minimal
for the in-app-only v1.

---

## §4 — Q4: Deduplication and rate limiting — **PASS (with operator note)**

> Ten responses in 30 seconds should not produce ten separate
> notifications. Check dedup window, consolidation pattern, rate
> limits.

**Idempotency dedup (PASS):** the design's §10 explicitly names a
partial unique index on `(recipient_id, type, argument_id)` for the
argument-derived triggers (`new_response`, `concession_challenged`,
`source_requested`, `evidence_supplied`). A retried Edge Function
invocation is a no-op insert. This handles the **retry** dedup case
correctly.

**Volume dedup (NOT MODELLED):** the design does not model the case the
designer addendum names — *"ten responses in 30 seconds"*. Ten distinct
argument inserts in 30 seconds produce ten distinct rows with ten
distinct `argument_id`s. The partial unique index will **not** collapse
them. The user sees ten rows in their notification list.

**Why this is acceptable for v1:** each row represents a distinct user
action the recipient may want to navigate to. Collapsing them
("5 new responses since you last checked") would be a UX improvement,
but it requires either (a) a digest job (out of scope per design §16),
or (b) a list-screen-side aggregation pass that groups rows by room and
trigger type. The list-screen aggregation is purely a UI concern — it
doesn't require a schema change and can be added incrementally without
breaking the model.

**Recommendation (non-blocking):** the design's §17 "Open questions"
should add an item asking whether v1 should ship with a list-side
*display grouping* (the row count is collapsed visually under a single
"5 new responses in `<room title>`" header). This is a UI-only enrichment
that respects the existing model. The implementer can defer or ship at
their judgement. Recorded as an enrichment in §4 below.

**Rate limit on email send (PASS — when §2 enrichment lands):** if the
email scaffold from §2 lands, the `INVITE_EMAIL_ENABLED` env gate is the
v1 rate limit (off by default; flip per environment). The
`request-argument-deletion` precedent already swallows email-send
failures via the `failed_sanitized` status; QOL-040's email helper
should do the same.

**Verdict: PASS.** Retry dedup is modelled correctly. Volume dedup is
intentionally deferred and is a UI concern, not a model concern.

---

## §5 — Q5: Notification permissions / user preferences — **NEEDS COORDINATION**

> Some users want to disable kinds, set quiet hours, unsubscribe from
> email. Check existing user-preferences module integration.

The cascade pre-survey found two existing preference test files:

- `__tests__/userPreferencesModel.test.ts`
- `__tests__/preferencesDoctrine.test.ts`

These cover an **already-shipped** preferences module at
`src/features/preferences/`. The relevant file is
`src/features/preferences/userPreferencesModel.ts`:

```ts
export interface UserPreferences {
  schemaVersion: 1;
  density: DensityPreference;
  reduceMotion: ReduceMotionPreference;
  colorMode: ColorAccessibilityMode;
  defaultRoomEntry: DefaultRoomEntryPreference;
  defaultSideLabel: DefaultSideLabelPreference;
  /** Honest stub — persisted, drives nothing in v1 (no push notifications). */
  notificationsOptInStub: boolean;
}
```

And the matching copy in `src/features/preferences/preferencesCopy.ts`:

```ts
export const NOTIFICATIONS_COPY = {
  label: 'Notifications',
  helper:
    "Notifications aren't available yet. This remembers your choice for when they are.",
  switchAccessibilityLabel: 'Remember my notification choice',
} as const;
```

**Finding.** A `notificationsOptInStub` boolean already exists in the
preferences blob, defaulting to `false`, surfaced in `PreferencesPopout`
with copy that explicitly tells the user *"Notifications aren't
available yet. This remembers your choice for when they are."* QOL-040
is the card that **makes notifications available**. The stub's natural
behaviour change is:

- Rename / repurpose `notificationsOptInStub` → `notificationsEnabled`
  (or add a new field with deprecation note on the stub) — the user
  who flipped it on before QOL-040 shipped has expressed consent;
  flipping it from `false` to `true` is the user's call.
- The copy must change from *"aren't available yet"* to something honest
  about what is and isn't available (e.g. *"Show in-app notifications
  for replies, invites, and settlements."*).

The current QOL-040 design's §16 says preferences are a "possible v2
follow-up" — that was accurate at design time, before the preferences
module's `notificationsOptInStub` was added. As of HEAD `84aeb23`, the
stub is in production and tested. **QOL-040 must make a decision about
the stub**:

- **Option A (recommended).** Convert the stub into a real preference
  (`notificationsEnabled: boolean`, default `true`). If `false`, the
  client skips loading and badge polling; the Edge Function still writes
  rows (so the user opting back in catches up on history). Migration is
  device-local AsyncStorage only — no DB schema change. The honest-stub
  copy in `preferencesCopy.ts` is updated to plain-language description
  of what notifications cover.
- **Option B.** Leave the stub as-is and ship QOL-040 as
  always-notifications-on for every user. The stub stays a stub.
  Acceptable but contradicts the implicit promise of the existing copy
  (the user toggle is currently meaningless).
- **Option C.** Defer all preference work to a separate card. This
  contradicts the existing stub's copy more strongly than Option B (the
  card that "remembers your choice for when they are" available has
  shipped, and the choice is still ignored).

**Recommendation (the operator's call — surfaced here for decision):**
Option A. The stub was always written to be filled in by the card that
shipped real notifications; QOL-040 is that card. The change is small
(rename + repurpose, copy update, one test rewrite) and the alternative
is shipping a contradiction with the live preferences UI.

**Verdict: NEEDS COORDINATION.** The operator must pick Option A / B /
C. The §4 enrichment proposes Option A in detail and frames the
implementer work; if the operator picks B or C the enrichment is
trimmed to a one-liner pointing at the chosen option.

---

## §6 — QOL-038 integration assessment — **NEEDS COORDINATION**

Per the addendum: confirm the notification surface can consume QOL-038
events cleanly. Three trigger events are named.

### Event 1: `invite_created` → in-app + (optional) email to invitee

**The current design's position (§10 row 7).** The in-app `invite`
notification "is created at the moment the invited user accepts and an
account exists". This is **incorrect for the existing-user-on-platform
case**:

- Scenario: Alice (registered user) invites Bob (registered user) to a
  room.
- QOL-038's `manage-room-invite` create action writes the
  `argument_room_invites` row.
- The QOL-038 flow assumes Bob clicks a link to redeem (via email or
  manual share). But Bob is already on the platform — the right UX is
  to surface the invite in his in-app notification list **immediately**,
  not wait for him to tap a copy-pasted link.

The design's intent (§5 row 1: *"in-app notification appears once they
have an account"*) is right, but the **trigger moment** is wrong. The
in-app `invite` notification for an existing-account invitee must be
created at the moment `manage-room-invite` create succeeds, not at
accept. The accept-time creation is correct only for the
**brand-new-user-just-signed-up** case (the email-then-signup flow).

The fix is small: the `room-notifications` Edge Function's `invite`
action takes the invite row id, looks up whether
`invite.invitee_email_lower` matches any existing
`auth.users.email`; if yes, the notification is created at that moment
addressed to that user. If no, the row is **not** created at invite
time (the email path delivers it; the in-app row is created at accept).

This belongs in the §4 enrichment. The `manage-room-invite` Edge
Function does not need to change — it is the **caller** of
`room-notifications` that owns the conditional. The QOL-040 design must
clarify this caller relationship.

### Event 2: `invite_redeemed` → in-app to inviter

**The current design's position.** Not modelled. The 9-trigger
catalogue in §5 does **not** include an "invite redeemed" notification
to the inviter. Scenario 1 Step 6 of the public storyboard says
*"Alice receives a 'B has joined' notification"* — this is an essential
in-app event for the de-escalation use case (the inviter learns the
invitee accepted and is ready to argue).

This is a real gap in the trigger catalogue. The §4 enrichment must add
a 10th trigger: `invite_accepted_by_invitee`, addressed to the inviter,
fired by `manage-room-invite` accept action calling the same
`room-notifications` Edge Function. Neutral copy: *"`<invitee display
name>` joined: `<room title>`."* (or *"Someone joined: `<room title>`."*
if name-visibility is gated).

### Event 3: `invite_expired` → in-app to inviter

**The current design's position.** Not modelled. The QOL-038 design
mints invites with a 14-day TTL; an unredeemed invite silently expires.
Without a notification, the inviter has no signal — they may be sitting
on a stalled argument waiting for a response that will never come.

This is a smaller gap (an unredeemed invite is non-critical) but the
storyboard's de-escalation framing suggests the inviter should know.
**Recommendation:** add this as an OPTIONAL 11th trigger,
`invite_expired_notice`, **deferred to a follow-up card unless the
operator explicitly wants it in v1**. The TTL fires from no
user action — implementing it requires either a `pg_cron` job (out of
scope today) or a lazy-on-list-view derivation (acceptable but adds
complexity). Recommend deferral.

### Integration mechanics (RLS + caller contract)

**Read-only from QOL-040's perspective: PARTIAL CONFIRM.**

- QOL-040's `room-notifications` Edge Function is the *consumer* — it
  reads `argument_room_invites` to look up invitee email and inviter
  display name, but it does not modify the table. **PASS.**
- The proposed RLS on `room_notifications` (§6.1) does not depend on
  `argument_room_invites`. **PASS.**
- The QOL-038 `argument_room_invites` table has an RLS policy
  `ari_select_invitee_own` that uses `auth.jwt() ->> 'email'` for
  the invitee read. For QOL-040 to look up "is this email a registered
  user", it needs `svc.auth.admin.listUsers()` (as
  `request-argument-deletion` does) or a `profiles` join via the
  service-role client. **The design does not name this lookup path
  today** — the §4 enrichment must.

### Anonymous-invite-redemption case

The QOL-038 flow supports a brand-new user signing up via an invite
link. During the signup window, the user has no `auth.users` row;
during email confirmation, they have a row but it's unconfirmed. The
QOL-040 design's `room_notifications.recipient_id` has a hard FK to
`auth.users(id) on delete cascade`. **PASS** — the design correctly
defers the in-app notification creation until the user exists
(§10 row 7, line 614-616). The brand-new-user case lands them directly
in the room via QOL-038's `pendingInviteIntent` flow; an in-app
notification at that moment would be redundant. The §4 enrichment
doesn't need to change this — it must only clarify the trigger moment
for the existing-account-invitee case.

### Verdict: **NEEDS COORDINATION**

The integration model is **not clean** as written:

1. Trigger moment for `invite` notification is wrong for the
   existing-account case.
2. The `invite_redeemed` trigger is missing entirely from the
   9-trigger catalogue.
3. The optional `invite_expired` trigger is worth surfacing for the
   operator.
4. The "email is already a registered user?" lookup path is unnamed.

The §4 enrichment addresses items 1, 2, and 4. Item 3 is flagged for
operator judgement and recommended for deferral.

---

## §7 — Issue-body-vs-addendum email tension — recommendation

The issue body says *"Push notifications excluded by v1 scope. In-app
notifications only."* The designer addendum says *"design for BOTH
in-app AND email delivery"*. These are **not contradictory**:

- **Push** stays out (issue body + `CLAUDE.md` "no push notifications"
  agree).
- **Email** for the `invite` trigger is in scope, gated and off by
  default (the operator's addendum is the explicit authorisation; the
  QOL-038 design and shipped code are the matching half).
- **Email** for all other triggers is out (no email digest, no email
  on every reply).

**Recommendation.** Treat the addendum as the operative instruction;
the issue body's "in-app only" wording is read as "no push", and the
narrow email scaffold for the invite trigger is added per §4. This
matches QOL-038's design § 5.1.1, QOL-038's review verdict, and the
existing `request-argument-deletion` email-helper precedent.

If the operator disagrees and wants the design to stay strictly in-app
with NO email even for the invite trigger, a separate card (QOL-040.1
or equivalent) must own the email scaffold so the QOL-038 contract
surface does not stay vestigial. Either resolution is defensible; the
verification doc records the question.

---

## §8 — Enrichment summary

Three enrichments are appended to `docs/designs/QOL-040.md` as one new
final section titled **"QOL-040 design enrichment (2026-05-24 designer
pass)"**. The enrichments are:

1. **Email scaffold for the `invite` trigger only.** Off by default
   behind `INVITE_EMAIL_ENABLED`, mirrors `request-argument-deletion`'s
   Resend pattern verbatim (`'sent' | 'not_configured' |
   'failed_sanitized'` outcome enum). Reconciles the QOL-038 contract.
2. **Trigger catalogue correction.** Move the `invite` trigger creation
   moment to be conditional on existing-account vs new-account. Add a
   10th trigger `invite_accepted_by_invitee` (in-app to inviter when an
   invite is redeemed). Flag an optional 11th trigger
   `invite_expired_notice` and **recommend deferral**.
3. **Preferences integration.** Convert the existing
   `notificationsOptInStub` (already in
   `src/features/preferences/userPreferencesModel.ts` with honest-stub
   copy in `preferencesCopy.ts`) into a real preference
   (`notificationsEnabled: boolean`, default `true`), with the
   honest-stub copy rewritten to describe what notifications cover.

The enrichment **does not contradict or invalidate** any other section
of the existing design. It addresses:

- §2: email-channel gap.
- §5: preferences integration.
- §6: QOL-038 integration mechanics.

It does **not** modify:

- The 9 existing triggers' copy, recipient sets, or deep-link targets
  (except adding 1 new trigger).
- The §6.1 schema (except clarifying the stale migration filename).
- §7 UI states.
- §9 visibility-safe-copy doctrine.
- §10–§18 sections.

---

## §9 — Terminology refresh observations (for the implementer)

QOL-035 (#253, 2026-05-23) scrubbed `debate` → `argument` and
`moderator` → `observer` / `admin` from user-facing copy. The QOL-040
design predates that scrub by 2 days. Spot-check of the design's
notification copy intents shows them already aligned (§5 uses
*"argument"* consistently — *"New response in: `<room title>`."*, *"This
argument is settled"*, etc., and never *"debate"*). **PASS — no copy
remediation needed in the design.**

The implementer must still apply the QOL-035 discipline when writing
the actual code:

- File-level: `src/features/notifications/` is a NEW folder; no QOL-035
  rename needed.
- Variable names: internal identifiers like `debate_id` /
  `debateId` STAY (per QOL-035 internal-code exemption); user-facing
  strings say *"argument"*.
- `gameCopy.toPlainLanguage` is the universal mapper (the design's
  §6.7 already names it as a "possibly modified" file). The
  notification copy is plain enough that `toPlainLanguage` likely needs
  no new entries — confirm at implementation time.

---

## §10 — Cascade-test implications

The OPS-001 reviewer template (PR #262) requires migration-bearing
cards to either run `npx supabase db reset` (Docker available) or pass
a heightened four-class textual review (Docker unavailable). QOL-040
ships a migration. The implementer should:

1. Use the corrected migration timestamp (§1 finding) —
   `20260524000014` at minimum, re-checked at commit time.
2. Document the `pgcrypto` dependency in the migration header per the
   QOL-038 precedent.
3. Fully-qualify column references inside policies
   (`room_notifications.recipient_id`) per QOL-038 defensive discipline,
   even though no subquery joins are present in the v1 design.

Two existing tests will likely require updates:

- `__tests__/userPreferencesModel.test.ts` — if Option A from §5 lands,
  this test must be updated to assert the new `notificationsEnabled`
  field shape (or the renamed `notificationsOptInStub`). The cascade
  update is small (the test fixture gains a field; existing assertions
  stay).
- `__tests__/preferencesDoctrine.test.ts` — likely no change (it
  asserts the doctrine of the copy, not the field name; if the new copy
  is doctrine-clean, the test stays green).

QOL-038 ships **219 new tests across 11 new suites** per the QOL-038
review. The QOL-040 implementer should not be alarmed at a high test
count for QOL-040 — the design's §11 names roughly 11-13 new test files
(pure model + edge function + UI). 100+ new test cases is the realistic
floor.

---

## §11 — Doctrine self-check on this verification pass

This verification doc adds documentation only and does not propose any
new user-facing strings beyond the implementer-guidance examples in §5
(which are direct copies of the design's §5 catalogue) and §6 (which
quotes Scenario 1 Step 6). The doctrine constraints from
`cdiscourse-doctrine`:

- **§1 (no truth labels).** Zero banned tokens (`winner`, `loser`,
  `correct`, `true`, `false`, `liar`, `dishonest`, `bad faith`,
  `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot`) in
  any added text in either this doc or the §4 enrichment to the source
  design.
- **§4 (AI moderator limits).** No AI is added by this pass.
- **§6 (secrets).** No secret value appears in any added text. The
  email scaffold from §2 / §4 reuses the existing
  `request-argument-deletion` Resend pattern (the precedent's
  `RESEND_API_KEY` is sourced from `Deno.env` only inside the Edge
  Function; never in client code).
- **§7 (no AI calls from production app).** The notification surface
  is pure deterministic copy + a deterministic recipient resolver. No
  AI.
- **§8 (Supabase conventions).** The enrichment does not propose any
  new schema beyond what §6.1 of the source design already specifies.
  RLS posture unchanged. No client INSERT/DELETE policies. Email gate
  follows the existing `INVITE_EMAIL_ENABLED` pattern (no new env var
  invented; the QOL-038 design already names this var).
- **§10 (v1 scope guards).** Push stays out. Email is added only for
  the invite trigger, off by default. No voting, no search, no public
  API, no OAuth.

---

## §12 — Summary

| Question | Verdict | Action |
|---|---|---|
| Q1 — Notification storage model | **PASS** | One implementer item: re-pick migration timestamp (current `20260522000010` collides with three later migrations). Document `pgcrypto` dependency. Use fully-qualified column references defensively. |
| Q2 — Delivery channel abstraction (email) | **GAP FOUND** | §4 enrichment adds an email scaffold for the `invite` trigger only, off by default behind `INVITE_EMAIL_ENABLED`, mirroring `request-argument-deletion`. Operator confirmation requested via §7. |
| Q3 — Notification lifecycle state machine | **PASS** | Non-blocking: add an idempotency test for `markNotificationRead`. |
| Q4 — Deduplication and rate limiting | **PASS** | Non-blocking: §17 of the design should add an open question about list-side display grouping for high-volume rooms. |
| Q5 — Notification permissions / preferences | **NEEDS COORDINATION** | §4 enrichment proposes Option A (convert existing `notificationsOptInStub` into real `notificationsEnabled`). Operator must pick A / B / C. |
| QOL-038 integration | **NEEDS COORDINATION** | §4 enrichment fixes the trigger-moment for existing-account invitee + adds 10th trigger `invite_accepted_by_invitee` to inviter + names the "email already registered?" lookup path. Optional 11th trigger `invite_expired_notice` flagged for operator and recommended for deferral. |
| Issue-body-vs-addendum email tension | **RECONCILABLE** | Push ≠ email. Push stays out. Email is added narrowly per §4. Recommend the operator endorse the addendum's broader scope; alternative is a follow-up card. |
| Terminology refresh | Note for implementer | Design copy already QOL-035-compliant. Apply QOL-035 discipline at implementation time. |
| Cascade-test implications | Note for implementer / reviewer | OPS-001 migration gate applies. Two existing preference tests will need fixture updates if Option A lands. |

The design at `docs/designs/QOL-040.md` is **enriched in place** with
the appended §"QOL-040 design enrichment (2026-05-24 designer pass)"
section. The implementer should treat this verification doc + the
enriched original design as the complete design input for the QOL-040
implementation phase, pending operator decisions on the three
NEEDS-COORDINATION items.
