# ARG-ROOM-006 — Visibility / Feed / Access Integration

| Field | Value |
|---|---|
| **Status** | Design draft |
| **Card** | ARG-ROOM-006 (#617) — **operator-rescoped** from "One-invite lifecycle management" to **Visibility / feed / access integration** |
| **Epic** | Rules UX (argument-room visibility/invite slate) |
| **Release** | 6.7 |
| **Lane** | Pure model + read-only UI (standard-gated) **+ one GATE-C Edge copy fix (item g)** |
| **Baseline** | `main @ 8929bde` (ARG-ROOM-001/002/003 + QOL-038/039/040 all shipped) |
| **Slate** | `docs/roadmap-expansions/2026-06-13-public-private-argument-room-invites-roadmap.md` |
| **Depends on** | ARG-ROOM-005 (seat-state model), ARG-ROOM-002 (#613, deployed), QOL-039 (#208), QOL-038 (#207), #607/#608 (invite return path) |
| **Doctrine anchors** | `cdiscourse-doctrine` §1 (no verdict copy), §2–3 (heat/popularity never gate access), §8 (RLS on, never disabled; migrations append-only), §9 (plain language via `gameCopy`), §10a (Observations vs Allegations); roadmap §1 (four seat states), §5 (security posture: no enumeration, no raw token, RLS never disabled) |
| **Stamp** | 2026-06-13 |

> **Scope note (binding).** This card is the operator-rescoped #617: **discoverability + route/access behavior + the user-facing full / reserved / private / public states.** It does **NOT** do invite sending, and it does **NOT** do the originally-filed view/revoke/resend lifecycle (revoke already ships in `InvitePanel`; resend is out). It is the **access/route/copy layer** that sits on top of ARG-ROOM-002's server enforcement and ARG-ROOM-005's seat-state model.

---

## 1. Goal

Integrate the surfaces around what a user can **SEE** and **DO** once a room exists, so the four seat states and the two visibilities (already enforced server-side by ARG-ROOM-002 and already privacy-gated by QOL-039) are **coherently exposed and route-correct** on the client:

- **(a)** public open/locked rooms appear in the discovery feed/gallery; private rooms do not (to non-members);
- **(b)** private rooms stay hidden to non-members (verify QOL-039 RLS + `classifyCardToSection → my_rooms`; never weaken);
- **(c)** a deep-link / direct URL to a room the viewer cannot see renders a **neutral "unavailable" state indistinguishable from "nonexistent"** (no enumeration), RLS-respecting, **no new RLS needed**;
- **(d)** an invitee signed in as the wrong account gets recoverable copy (verify the shipped `InviteRedeemGate` mismatch path);
- **(e)** **full-room** and **reserved-seat** user-facing copy (consuming ARG-ROOM-005's seat model);
- **(f)** the public-vs-private observer/participant distinction is visible in the surfaces;
- **(g)** the **23505 relabel deferred from ARG-ROOM-002**: a second-invite `23505` from `manage-room-invite create` now means "this room already has a live invite (to anyone)" — surface neutral copy, not a `500` mislabel.

The net-new product code is a **single pure model** (`roomAccessModel.ts`) plus thin read-only wiring; the only `supabase/**` touch is the minimal item-(g) Edge branch.

---

## 2. Product contract

### Binding invariant (restated verbatim from roadmap §1)

> One direct invite at creation. Private rooms are 1v1 (max 2 active participants). Public rooms are capped at five active participants. A public direct invite reserves one of the five seats. Public with no invite is valid. Private with no invite is invalid. Observers are not active participants. Max one direct invite per room.

### The four seat states — how 006 SURFACES each (never collapse them)

| Seat state (roadmap §1) | Source of truth | How 006 surfaces it on the access layer |
|---|---|---|
| **Active participant** (`side ∈ affirmative/negative/moderator`) | ARG-ROOM-002 cap trigger + ARG-ROOM-005 seat model | Counts toward "full". The viewer who is one sees **`Continue →`**. Never a verdict — "full" is a **seat fact**. |
| **Observer / reader** (`side = observer`) | uncapped, first-class | **`Observe →` is offered on every readable room regardless of "full".** Observers are never blocked by capacity (doctrine: observers uncapped). |
| **Pending reserved invite seat** (live `argument_room_invites`) | QOL-038 + ARG-ROOM-005 | Surfaced **only to those RLS already lets see invites** (creator/participant/mod) as "a seat is saved for an invited person" — **never enumerated to a non-member, never names WHO** (`maskInviteeEmail` only). |
| **Open public seat** (`cap − active − reserved`) | `roomCapacityModel.canJoinActive` | "Open seat — observe or join." When zero → **`public_full`** ("Seats are full — you can still observe."). |

Doctrine binding on every string 006 emits: visibility is an **access** property; capacity/seat/heat are **activity**; **none is a verdict** (roadmap §5). No `winner/loser/correct/true/false/liar/…` tokens. No popularity input to access or seating.

---

## 3. Existing shipped state — REUSE, do not rebuild

**Most of this card's substrate is already shipped.** The cited file:line are verified at `main @ 8929bde`.

### Enforcement & privacy (already TRUE server-side — 006 only surfaces it)

| Shipped seam | file:line | What it already gives 006 |
|---|---|---|
| Visibility column + one-way trigger | `supabase/migrations/20260524000015_qol_039_room_visibility.sql:85-87`, `:103-123` | `debates.visibility` (`public`/`private`, default public), public→private only. |
| **Private-hidden RLS** (the privacy guarantee for item b/c) | same migration `:189-198` (debates SELECT), `:210-219` (participants SELECT), `:236-252` (arguments SELECT), helper `is_debate_private` `:130-141` | A private room + its arguments are **invisible to non-participants at the DB**. `listDebates` simply never receives them. **This is what makes item (c) need NO new RLS.** |
| Capacity + private-requires-invite + **one-invite-per-room** | `supabase/migrations/20260613000001_arg_room_002_room_capacity_and_creation.sql:211-265` (`enforce_room_capacity` trigger), `:273-275` (`argument_room_invites_one_live_per_room` partial-unique index), `:282-291` (public-only client self-join), `:299-369` (`create_argument_room` RPC), `:391` (DROP client `debates` INSERT) | Cap/"full" and "max one live invite per room" are **already enforced**. 006 does not re-enforce — it surfaces. **Item (g) exists because of the `:273-275` index.** |
| Create Edge error mapping | `supabase/functions/create-argument-room/index.ts:124-131`, `:171-184` (`room_capacity_reached → 409`, `private_requires_invite → 400`) | The create path already returns neutral capacity codes. |
| Live proof | `docs/testing-runs/2026-06-13-arg-room-002-gatec-deploy-smoke.md:32-33` (DOOR `42501`, B6 `room_capacity_reached`), `:43` ("`23505` relabel … owned by ARG-ROOM-006") | The cap trigger + closed door are **proven live**; the 23505 relabel is explicitly assigned to this card. |

### Pure models & copy (the seams 006 composes)

| Shipped seam | file:line | Reuse |
|---|---|---|
| Creation matrix + caps | `src/features/debates/argumentRoomCreationMatrix.ts:62-63` (`PUBLIC_ACTIVE_PARTICIPANT_CAP=5`, `PRIVATE_ACTIVE_PARTICIPANT_CAP=2`), `:340-356` (`fitsPublicCapacity`/`fitsPrivateCapacity`) | Cap constants — single source of truth. **006 imports, never re-literals.** |
| **Seat-fit twin** | `src/features/debates/roomCapacityModel.ts:42-48` (`roomActiveSeatCap`), `:95-103` (`canJoinActive` = `active+reserved+1<=cap`) | 006's full/open derivation **calls `canJoinActive`** — no new seat math. |
| Public seat map | `src/features/debates/publicSeatModel.ts:67` (`PUBLIC_ROOM_SEAT_CAP=5`), `:145-163` (`isCapReached`, `openChimeInSeatCount`), `:493` (`buildPublicRoomSeatMap`) | Active/observer/overflow derivation (the substrate ARG-ROOM-005 surfaces; 006 consumes its summary). |
| Gallery model + **private→my_rooms routing** | `src/features/debates/conversationGalleryModel.ts:295` (`visibility` on card), `:1003` (coercion), `:1530-1543` (`classifyCardToSection`: `if (card.visibility === 'private') return 'my_rooms'`) | **Item (a)/(b) feed routing already exists.** 006 verifies + pins, adds the badge/access line. |
| Gallery action label | `src/features/debates/ConversationGalleryScreen.tsx:636` (`hasUserJoined ? 'Continue →' : openStatus==='open' ? 'Observe →' : 'Open →'`) | 006 **reuses this label policy** verbatim; no new label vocabulary. |
| RLS-filtered list (no belt-WHERE) | `src/features/debates/debatesApi.ts:76-105` (`listDebates`), `:45-47` (`coerceVisibility`) | The feed source; RLS is authoritative. 006 adds no WHERE clause. |
| Visibility copy incl. no-access + private badge | `src/features/arguments/gameCopy.ts:1610-1671` (`ROOM_VISIBILITY_COPY`, incl. `:1648-1650` `badge_private`/`badge_private_a11y`, `:1669-1670` `no_access_title`/`no_access_body`) | 006 **reuses the private badge**; the deep-link unavailable copy is discussed in Open Questions (enumeration nuance). |
| Plain-language gate | `gameCopy.ts:865-878` (`toPlainLanguage`), `:1028-1089` (`GALLERY_SECTION_DEFINITIONS`) | Section copy + the suppress-unknown-codes discipline. |
| **Wrong-user recovery (item d) — already shipped** | `src/features/invites/inviteCopy.ts:115-118` (`emailMismatchTitle`/`emailMismatchBody`/`emailMismatchSignInElse`), `src/features/invites/InviteRedeemGate.tsx:270-279` (`invite_email_mismatch → MismatchPanel`), `:402-418` (`MismatchPanel` + `onSignOutAndRetry`); accept email-binding spine `supabase/functions/manage-room-invite/index.ts:561-563` | **006 verifies + pins; no behavior change required.** |
| Invite return path | `src/features/auth/consumeAuthCallback.ts`, `App.tsx:307-324` (`InviteRedeemGate` above the shell), `:261-262` (no-router TL-003 invariant) | The invitee return loop. 006 adds the deep-link **resolver** for the not-in-list case. |
| Mask + invite error map | `src/features/invites/inviteModel.ts:147-159` (`maskInviteeEmail`), `inviteCopy.ts:171-179` (`plainLanguageForInviteError`) + `ERROR_CODE_MAP` `:145-168` | 006 adds **one** `ERROR_CODE_MAP` key for item (g). |

### What 002/003 already cover (so 006 does NOT duplicate)

- **002** owns: the cap trigger, the per-room one-live-invite index, private-requires-invite at the DB, the create RPC, the closed direct-insert door. 006 **never re-enforces capacity or visibility** — it reads and renders.
- **003** owns: the live create surface (visibility radio + one invite). 006 touches **no** create UI. (003 is merged but not yet user-deployed per CLAUDE.md — 006's surfaces are independent of that frontend gate.)
- **QOL-039** owns: the make-private transition + `roomVisibilityModel.ts`. 006 touches **no** transition logic.

---

## 4. Net-new vs already-shipped (explicit)

| Operator sub-item | Already shipped | **Net-new in 006** | Gating |
|---|---|---|---|
| **(a)** public listed | gallery `visibility` field + `classifyCardToSection`; RLS feed | Verification tests; public/private **badge** + **access line** on the card | standard |
| **(b)** private hidden | QOL-039 RLS + `classifyCardToSection → my_rooms` (`:1543`) | **Verify, do not weaken**: pin tests; `feedVisibilityForCard` belt-and-suspenders predicate | standard |
| **(c)** direct-URL access | QOL-039 RLS withholds private rooms; `ROOM_VISIBILITY_COPY.no_access_*` | **`resolveRoomDeepLinkAccess`** resolver: not-in-RLS-list → unified neutral "unavailable" (private-no-access ≡ nonexistent). **No new RLS.** | standard |
| **(d)** wrong-user recovery | `InviteRedeemGate` MismatchPanel + `emailMismatch*` copy | **Verify + pin** (no behavior change) | standard |
| **(e)** full + reserved copy | cap enforced (002); seat model (005); `canJoinActive` | **`deriveRoomAccessView`** → `public_open/public_reserved/public_full` + copy | standard |
| **(f)** public vs private observer/participant distinction | `badge_private`; `OBSERVER_COPY` | Access-view `badgeLabel` + `accessLine`; observers-always-`Observe →` rule | standard |
| **(g)** 23505 relabel | per-room index (002 `:273-275`); accept-path 23505 (different) at `manage-room-invite:600-607` | **One branch** in `manage-room-invite create` + one `ERROR_CODE_MAP` key | **GATE-C (supabase/\*\*)** |

**Bottom line:** items (a)–(f) are a pure model + read-only UI + copy, all in `src/` → **standard-gated**. **Only item (g)** touches `supabase/**` → **GATE-C, recommended as its own PR** (see §10).

---

## 5. Data / API shape

All new TS is **pure** — no React, no Supabase, no network, no `async`, no clock, no randomness; JSON-serializable in/out; frozen output — mirroring `src/domain/constitution/engine.ts` and the sibling `argumentRoomCreationMatrix.ts` discipline.

### 5.1 New pure model — `src/features/debates/roomAccessModel.ts`

```ts
import { roomActiveSeatCap, canJoinActive } from './roomCapacityModel';
import type { ArgumentRoomVisibility } from './argumentRoomCreationMatrix';
import { ROOM_ACCESS_COPY, ROOM_VISIBILITY_COPY } from '../arguments/gameCopy';

/** The access state a viewer has toward a room. NEVER a verdict. */
export type RoomAccessState =
  | 'public_open'        // public, an active seat is claimable (or counts unknown → safe default)
  | 'public_reserved'    // public, a seat is reserved for an invited person (only when reserved data is viewer-visible)
  | 'public_full'        // public, all active seats filled — observe-only
  | 'private_member'     // private, viewer is creator/participant/mod — full access
  | 'private_no_access'; // private, viewer is not a member — render identically to "unavailable"

/** Does the room appear in the public discovery feed for THIS viewer? */
export type RoomFeedVisibility = 'listed' | 'hidden';

/**
 * The seat-state summary 006 CONSUMES from ARG-ROOM-005 (or, until 005 lands,
 * from publicSeatModel.buildPublicRoomSeatMap + a participant projection).
 * `activeCount`/`reservedCount` are nullable: a NON-member browsing a public
 * room cannot (and must not) see reserved invites (QOL-038 RLS), so counts may
 * be absent — the deriver degrades to `public_open` rather than guessing.
 */
export interface RoomSeatStateSummary {
  visibility: ArgumentRoomVisibility;
  openStatus: 'open' | 'draft' | 'locked' | 'archived';
  isMember: boolean;                 // viewer is creator/participant/mod (hasUserJoined || myParticipantSide != null)
  activeCount: number | null;        // non-observer participants; null = not viewer-visible
  reservedCount: number | null;      // live pending invites that reserve a seat; null = not viewer-visible
}

export interface RoomAccessView {
  state: RoomAccessState;
  feedVisibility: RoomFeedVisibility;
  canObserve: boolean;               // true for any readable room (observers uncapped)
  canClaimSeat: boolean;             // open active seat AND status 'open' AND not already member
  cap: 2 | 5;
  openSlots: number | null;          // cap - active - reserved, clamped; null when counts absent
  badgeLabel: string;                // ROOM_VISIBILITY_COPY.option_public_label / option_private_label
  accessLine: string;                // plain-language, ban-list-clean, NO enumeration
  /** Reuses the shipped gallery label policy (ConversationGalleryScreen:636). */
  actionLabel: 'Observe →' | 'Continue →' | 'Open →';
}

/** The single decision function. Pure + deterministic + frozen output. */
export function deriveRoomAccessView(input: RoomSeatStateSummary): RoomAccessView;

/**
 * Direct-URL / deep-link resolver (item c). Given a requested room id and the
 * set of ids the RLS-filtered list returned, classify the outcome. `unavailable`
 * covers BOTH private-no-access AND nonexistent — they are indistinguishable by
 * construction, which is the no-enumeration guarantee. Pure; takes NO network.
 */
export function resolveRoomDeepLinkAccess(input: {
  requestedDebateId: string;
  loadedDebateIds: ReadonlySet<string> | ReadonlyArray<string>;
}): { outcome: 'resolved' | 'unavailable' };

/**
 * Belt-and-suspenders feed predicate (item b). A private card the viewer is not
 * in must be 'hidden'. RLS already withholds it; this guards the seam where a
 * private card reaches the client (participant) but a public-discovery lane must
 * still exclude it. Mirrors the classifyCardToSection:1543 rule.
 */
export function feedVisibilityForCard(card: {
  visibility: 'public' | 'private';
  isMember: boolean;
}): RoomFeedVisibility;

/** Ban-list support (scanned by tests, like _forbiddenArgumentRoomCreationTokens). */
export function _forbiddenRoomAccessTokens(): string[];
```

**Deriver decision order** (fixed, stable — like `deriveArgumentRoomCreation`):

1. `private` + `!isMember` → `private_no_access`, `feedVisibility: 'hidden'`, `canObserve: false`, `canClaimSeat: false`. (This branch should rarely render — RLS means a non-member never holds a private card; it's the safe terminal.)
2. `private` + `isMember` → `private_member`, `hidden`, `canObserve: true`, `actionLabel: 'Continue →'`.
3. `public`, `cap = roomActiveSeatCap('public') = 5`, `feedVisibility: 'listed'`, `canObserve: true`:
   - counts absent (`activeCount == null`) → **`public_open`** (safe non-enumerating default), `openSlots: null`, `canClaimSeat = openStatus==='open' && !isMember`.
   - `reservedCount > 0 && canJoinActive(active, reserved, 5)` and viewer may see reserved → **`public_reserved`**.
   - `!canJoinActive(active, reserved, 5)` → **`public_full`**, `canClaimSeat: false` (but `canObserve: true`).
   - else → **`public_open`**.
4. `actionLabel`: `isMember → 'Continue →'`; `openStatus==='open' → 'Observe →'`; else `'Open →'` (verbatim reuse of the shipped policy).

`canClaimSeat` is **never** true for an observer-only "full" room; `canObserve` is **always** true for a readable room — encoding the doctrine that observers are uncapped.

### 5.2 New copy — `src/features/arguments/gameCopy.ts` (`ROOM_ACCESS_COPY`)

Authored as a frozen block beside `ROOM_VISIBILITY_COPY` (same module the ban-list + plain-language tests already scan). Minimal strings; **ARG-ROOM-007 owns final vocabulary polish** — 006 authors only what it needs to function.

```ts
export const ROOM_ACCESS_COPY = Object.freeze({
  // Public access lines (one per public_* state).
  public_open_line: 'Open seat — observe or step in.',
  public_reserved_line: 'A seat is saved for an invited person. You can still observe.',
  public_full_line: 'Seats are full — you can still observe.',
  // Private (member view reuses ROOM_VISIBILITY_COPY.badge_private).
  private_member_line: 'Private — you are in this argument.',
  // Unified deep-link "unavailable" (item c) — IDENTICAL for nonexistent and
  // private-no-access (no enumeration). See Open Question 1 for the wording
  // decision vs the existing no_access_* copy.
  unavailable_title: 'This argument isn’t available',
  unavailable_body: 'The link may be wrong, or it may be limited to its members.',
} as const);
```

### 5.3 Item (g) — `manage-room-invite create` 23505 relabel (GATE-C)

The bug: `handleCreate` insert (`supabase/functions/manage-room-invite/index.ts:261-295`) handles `23505` by re-reading **by `(debate_id, invitee_email_lower, pending)`** (`:278-284`). After ARG-ROOM-002's per-room index (`:273-275`), a 23505 can fire for a **different** email already holding the room's one live invite → the re-read finds nothing → returns `internalError('invite_insert_failed')` (a `500` mislabel).

**Minimal fix** (one branch; no new query shape beyond a pending-exists check):

```ts
// inside the insertErr recovery, AFTER the same-email re-read returns null:
const { count: pendingForRoom } = await svc
  .from('argument_room_invites')
  .select('id', { count: 'exact', head: true })
  .eq('debate_id', body.debateId)
  .eq('status', 'pending');                 // debate_id only — the per-room index
if ((pendingForRoom ?? 0) > 0) {
  // The room already has its one live invite (to SOMEONE — never say who).
  return jsonError(409, 'room_already_has_invite',
    'This argument already has an invite waiting.');
}
return internalError('invite_insert_failed'); // genuine failure
```

Plus **one** standard-gated key in `src/features/invites/inviteCopy.ts` `ERROR_CODE_MAP` (`:145-168`):

```ts
room_already_has_invite: 'This argument already has an invite waiting.',
```

Doctrine for (g): the 409 message is neutral, names no one, and reveals no email (no enumeration); `room_already_has_invite` flows through `plainLanguageForInviteError` (`:171-179`) so no raw code reaches the user. The count check uses `head: true` (no row bodies, no token, no email leaked).

---

## 6. File changes

| File | Change | Gating |
|---|---|---|
| `src/features/debates/roomAccessModel.ts` | **NEW** pure model (§5.1) | standard |
| `src/features/arguments/gameCopy.ts` | **NEW** `ROOM_ACCESS_COPY` block (§5.2) | standard |
| `src/features/debates/ConversationGalleryScreen.tsx` | Render public/private **badge** + `accessLine` from `deriveRoomAccessView`; keep the `:636` action-label policy; pass the (005-sourced or degraded) seat summary | standard |
| `src/features/debates/DebateListScreen.tsx` | Same badge + access line on the list rows (parity with gallery) | standard |
| `App.tsx` (room-open / notification deep-link callback near `:483`/`deepLinkEntryHint` use) | On a deep-link/`activeArgumentId` whose room id is **not** in the RLS-filtered `debates`, call `resolveRoomDeepLinkAccess` → render the unified `ROOM_ACCESS_COPY.unavailable_*` state instead of silently dropping to gallery | standard (read-only; **no RLS**) |
| `src/features/invites/InviteRedeemGate.tsx` | **No change** — verify + pin the existing mismatch path (item d) | standard (tests only) |
| **`supabase/functions/manage-room-invite/index.ts`** | **Item (g)** — one branch in `handleCreate` (§5.3) | **GATE-C** |
| `src/features/invites/inviteCopy.ts` | **Item (g)** — one `ERROR_CODE_MAP` key | standard |

**No migration. No RLS change. No new Edge Function.** The only `supabase/**` edit is the item-(g) branch in an existing Edge Function.

---

## 7. Edge cases

1. **Participant whose room just went private** — `classifyCardToSection:1543` already routes their private card to `my_rooms`; `deriveRoomAccessView` → `private_member`. No public-lane leak.
2. **Notification deep-link to an argument in a room the viewer can no longer see** (dropped on a make-private, or never a member) — room id absent from RLS list → `resolveRoomDeepLinkAccess → 'unavailable'` → unified neutral copy. **Identical** to a typo'd/nonexistent id (no enumeration).
3. **Non-member browsing a public room** — `reservedCount`/`activeCount` are `null` (QOL-038 RLS hides invites; gallery doesn't fetch active counts) → deriver returns `public_open` (safe), `canObserve: true`. Never claims "reserved" it can't see.
4. **Public room at cap with an open observer slot** — `canJoinActive` false → `public_full`, but `canObserve: true` and `Observe →` still offered (observers uncapped). "Full" is a seat fact, not a verdict.
5. **Locked / archived / draft public room** — `actionLabel` falls to `'Open →'` (status ≠ open); `canClaimSeat: false`. Reuses the shipped label policy.
6. **Wrong-account invitee (item d)** — `accept` returns `invite_email_mismatch` (`manage-room-invite:561-563`) → `MismatchPanel` (`InviteRedeemGate:270-279`) with `Sign in as someone else`. Recovery copy names the **viewer's** email only, never the invitee's (no enumeration). Verified, not rebuilt.
7. **Item (g) genuine insert failure vs per-room-index race** — the pending-exists check disambiguates: pending exists → neutral 409; none → real 500. Idempotent **same-email** reuse (`:243-254`, `:285-293`) is unchanged.
8. **Item (g) self-invite + already-has-invite** — self-invite is rejected earlier (`:183-185`) before any insert, so the 23505 path is never reached for a self-invite.
9. **Visibility coercion of a pre-migration/unknown value** — `coerceVisibility` (`debatesApi.ts:45-47`) → `public`; deriver treats anything ≠ `private` as public (matrix-consistent).

---

## 8. Test plan

Each case labeled **[pure-model]** (import the model directly, no React/Supabase), **[integration-mocked]** (RTL / mocked Edge client), or **[live-provable]** (verifiable against the deployed stack with existing accounts). New tests live beside the cited siblings; the suite must stay green and the count must rise (test-discipline; baseline per CLAUDE.md current-stage line).

**`roomAccessModel` (new `__tests__/roomAccessModel.test.ts`)**
- **[pure-model]** `public` + counts absent → `public_open`, `canObserve`, `feedVisibility 'listed'`, `actionLabel 'Observe →'`.
- **[pure-model]** `public` + `active+reserved=5` → `public_full`, `canClaimSeat:false`, `canObserve:true`.
- **[pure-model]** `public` + `reserved=1, active=1` (viewer-visible) → `public_reserved`, `openSlots=3`.
- **[pure-model]** `private` + `!isMember` → `private_no_access`, `hidden`, `canObserve:false`.
- **[pure-model]** `private` + `isMember` → `private_member`, `Continue →`.
- **[pure-model]** cap parity: `cap===5` public / `===2` private via `roomActiveSeatCap` (no re-literal).
- **[pure-model]** `resolveRoomDeepLinkAccess`: id in set → `resolved`; absent → `unavailable` (asserts private-no-access and nonexistent return the **same** outcome — the enumeration invariant).
- **[pure-model]** `feedVisibilityForCard`: private+non-member → `hidden`; public → `listed`.
- **[pure-model]** ban-list: every emitted `accessLine`/`badgeLabel`/`unavailable_*` string is free of `_forbiddenRoomAccessTokens()` (verdict/amplification/person tokens) and is not `looksLikeInternalCode`.

**Gallery / feed (extend `conversationGalleryModel.visibility.test.ts`, `galleryLaneDerivation.test.ts`, `galleryLaneFilter.test.tsx`)**
- **[pure-model]** private card → `my_rooms`, excluded from all public-discovery lanes (**pin `classifyCardToSection:1543` — do not weaken**, item b).
- **[pure-model]** public open/locked card → discovery lane, `feedVisibility 'listed'` (item a).
- **[integration-mocked]** gallery card renders the public/private badge + access line; "full" public card still shows `Observe →` (items e/f).

**Direct-URL / deep-link (new `__tests__/roomDeepLinkAccess.test.tsx` or extend App routing tests)**
- **[integration-mocked]** notification `activeArgumentId` for a room not in the mocked RLS list → unified `unavailable_*` state, not a crash/silent drop (item c).
- **[integration-mocked]** same render for a private-no-access id and a nonexistent id (no enumeration).

**Wrong-user recovery (extend `inviteCopy.test.ts`; add `InviteRedeemGate` render test)**
- **[integration-mocked]** mocked `accept → invite_email_mismatch` → `MismatchPanel`; copy contains the viewer email, never the invitee email; `Sign in as someone else` present (item d).

**Item (g) — 23505 relabel (extend `manageRoomInviteEdgeCases.test.ts`, `manageRoomInviteSafety.test.ts`, `inviteCopy.test.ts`)**
- **[integration-mocked]** insert 23505 + same-email pending exists → idempotent `reused:true` (regression — unchanged).
- **[integration-mocked]** insert 23505 + only a **different**-email pending exists → `409 room_already_has_invite` (not `500`), message names no email/token.
- **[integration-mocked]** insert 23505 + no pending → `invite_insert_failed` (genuine failure preserved).
- **[pure-model]** `ERROR_CODE_MAP['room_already_has_invite']` maps to neutral copy; `plainLanguageForInviteError('room_already_has_invite')` ≠ raw code.
- **[live-provable]** against the deployed Edge: create one invite on a room, then create a second invite to a **different** email on the same room → `409 room_already_has_invite` (today: `500`). Provable with the existing admin/bot accounts and the smoke `draft` room `fc930abd…` from `2026-06-13-arg-room-002-gatec-deploy-smoke.md:39`.

**Cross-cutting**
- **[live-provable]** private-hidden RLS: an authed non-member `listDebates` never returns a private smoke room (re-uses the QOL-039/002 RLS already proven live).
- **[live-provable, constrained]** public cap "full" surfacing requires ≥6 distinct accounts to fill 5 seats; only 4 test accounts exist (per smoke doc `:35-36`). Surface the `public_full` **mechanism** via the live trigger (already proven at the private cap, `:33`) + `[pure-model]` deriver coverage; document the 6-account scenario as not-live-exercised, consistent with the 002 smoke.

**a11y (accessibility-targets)**
- **[integration-mocked]** badge + access line: all text inside `<Text>`; the public/private badge carries an `accessibilityLabel` (reuse `ROOM_VISIBILITY_COPY.badge_private_a11y` for private); color is not the only signal (label text carries it); any new Pressable meets 44×44 (hitSlop) with `accessibilityRole`/`Label`/`State`. The `unavailable` panel reuses the `InviteRedeemGate` `PanelLayout` a11y pattern.

---

## 9. Doctrine compliance

- **No verdict copy.** Every emitted string describes **access** (public/private) or **seat activity** (open/reserved/full) — never `winner/loser/correct/true/false/liar/…`. "Full" is a **seat fact**. Enforced by `_forbiddenRoomAccessTokens()` + the gameCopy ban-list scan. Heat/popularity are never read by `roomAccessModel`.
- **No enumeration.** `resolveRoomDeepLinkAccess` collapses private-no-access and nonexistent into one `unavailable` outcome (identical copy). The feed never lists private rooms to non-members (QOL-039 RLS + `feedVisibilityForCard`). Item (g)'s 409 reveals no email/token; the count check uses `head:true`. The mismatch panel echoes only the viewer's own email.
- **No raw token / no secret.** 006 adds no token surface; item (g) reads no token (it counts by `debate_id`/`status` only). `maskInviteeEmail` remains the only email echo.
- **RLS never disabled; migrations append-only.** **006 writes no migration and changes no policy.** The privacy guarantee is QOL-039's existing RLS; 006 is a read/route/copy layer over it.
- **No service-role in client.** The deep-link resolver and access model are pure client logic over already-RLS-filtered data; item (g) stays inside the Edge Function (service-role never leaves it).
- **Plain language (§9).** New copy lives in `gameCopy.ts` / `inviteCopy.ts` and routes through `plainLanguageForInviteError` / direct ban-list-scanned constants; unknown codes are never echoed.

### GATE-C call-out + STOP-AT-PR

- **Items (a)–(f): standard-gated.** Pure model + read-only UI + `src/` copy. **No `supabase/**` change, no RLS, no access-control change** — therefore the operator's "STOP-AT-PR if access-control or RLS is touched" trigger **does not fire** for these. Item (c) explicitly needs **no** RLS/read change (QOL-039 already enforces it); if a future maintainer believes it does, that is a redesign, not this card.
- **Item (g): GATE-C + STOP-AT-PR.** `manage-room-invite` is config.toml-registered (`supabase/config.toml:427-428`) → **merge = deploy** via the Supabase GitHub integration. **Recommendation: ship item (g) as its own GATE-C PR** (operator-gated merge, never self-approved), so the standard-gated UI/model bulk (a–f) merges independently and the deploy-bearing Edge change carries the explicit operator gate. **Deploy step (operator):** none beyond the gated merge — the GitHub integration redeploys `manage-room-invite` on merge to `main`; no migration to push.

---

## 10. Dependencies

- **ARG-ROOM-005 (#616, design pending)** — provides the seat-state model (active/observer/reserved/open) that 006's `RoomSeatStateSummary` consumes for `public_reserved`/`public_full`. **006 is not hard-blocked:** if 005 has not landed, `deriveRoomAccessView` degrades to visibility-only states (`public_open`/`private_member`/`private_no_access`) using `roomCapacityModel.canJoinActive` + `publicSeatModel.buildPublicRoomSeatMap`, and the full/reserved refinement is additive when 005's counts arrive. 006 must **not** re-implement seat math — it imports `roomActiveSeatCap`/`canJoinActive`.
- **ARG-ROOM-002 (#613, deployed)** — the cap trigger, per-room invite index, and private-requires-invite that 006 surfaces; the index is the direct cause of item (g).
- **QOL-039 (#208)** — the visibility RLS that makes item (b)/(c) need no new access change.
- **QOL-038 (#207)** — `manage-room-invite` (item g locus) + `maskInviteeEmail`.
- **#607/#608** — the invitee return path / `InviteRedeemGate` that item (d) verifies.
- **ARG-ROOM-007 (#618)** — owns final plain-language vocabulary; 006 authors minimal `ROOM_ACCESS_COPY` and flags wording polish to 007.

---

## 11. Open questions

1. **Deep-link "unavailable" wording vs the shipped `no_access_*` copy.** `ROOM_VISIBILITY_COPY.no_access_body` (`gameCopy.ts:1670`) asserts *"It is private — only invited people can read it."* On the **deep-link** path the client only knows "not in my RLS list" — it cannot tell private-no-access from nonexistent — so asserting "it is private" would (a) be wrong for a typo'd id and (b) confirm a private room exists at that URL (a soft enumeration). **Recommendation:** use the cause-neutral `ROOM_ACCESS_COPY.unavailable_*` for the deep-link path, and reserve `no_access_*` for the case where the app has **positive** knowledge the room is private (a member viewing the private badge). Operator/007 to confirm the exact wording.
2. **Should `public_reserved` ever surface to a non-member?** Per QOL-038 RLS a non-member cannot see invites, so 006 degrades to `public_open` when reserved data is absent. Confirm we do **not** want a generic "a seat may be reserved" hint for non-members (it would be a faint enumeration signal). Recommendation: **no** — keep `public_open`.
3. **Item (g) PR split.** Confirm item (g) ships as a separate GATE-C PR (recommended) vs folded into the 006 UI PR with a HARD-STOP-before-merge note. The slate's GATE-C posture (roadmap §5, §2 build order) favors the split.
4. **DebateListScreen parity scope.** Confirm 006 should add the badge/access line to **both** `ConversationGalleryScreen` and `DebateListScreen`, or gallery-only this card (list is a secondary/admin-adjacent surface).
