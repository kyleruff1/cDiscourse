# ARG-ROOM-008 — Re-surface the create-time invite copy-link

**Issue:** #625 · **Epic:** Rules UX · **Lane:** UI (client-only) · **Gate:** STANDARD (mergeable when green)
**Status:** implemented · **Branch:** `feat/ARG-ROOM-008-invite-copy-link`

## Problem (the ARG-ROOM-003 user-exposure gate)

ARG-ROOM-003's create surface defaults to **Private**, and a private room
**requires** one invite. The atomic `create-argument-room` Edge returns the raw
`inviteLink` (the one-time token, inviter-only, never stored / never
re-fetchable) — but `createDebate` mapped to a `Debate` and **discarded the
link** (`debatesApi.ts`, the old `return { ok: true, data: mapDebateRow(...) }`).

With invite email OFF (the QOL-040 default) and ARG-ROOM-002's
one-pending-invite-per-room unique index (the in-room `InvitePanel` cannot mint
a second link), the invitee of a default-path private room was **unreachable**.
ARG-ROOM-004 already consumed the link internally for the (dormant) gated email
send, but never surfaced it to the creator.

This card stops discarding the link and renders it once on the create surface,
reusing the shipped `INVITE_PANEL_COPY` copy-link affordance. **It adds no
`supabase/**` file** — the Edge already returns the link.

## Chosen approach — (a) widen `createDebate`'s result-shape

The card offered two threading options:
- **(a)** widen `createDebate`'s success to carry the optional `inviteLink`
  alongside the `Debate`, updating its callers; or
- **(b)** have `StartArgumentPage` call `createArgumentRoom` directly for the
  invite case.

**Chosen: (a).** Reason: option (b) would force the page to re-implement
`createDebate`'s body for the invite case — the room-row reload **and** the
ARG-ROOM-004 `notifyCreateTimeInvite` fire-and-forget call — duplicating logic
the card explicitly requires to stay intact and risking divergence of the 004
path. Option (a) keeps the 004 notify path exactly where it is (inside
`createDebate`, untouched) and only stops *discarding* the link; the trigger for
showing the box is the synchronous return value of the very call that created
the room, which is the cleanest, most local trigger.

### New result type

`src/features/debates/types.ts`:
```ts
export interface CreatedRoom {
  debate: Debate;
  inviteLink: string | null; // raw token, inviter-only, once; null = no invite
}
```

### Threaded through (callers updated, all compiling)

- `createDebate(...)` → `Promise<DebateApiResult<CreatedRoom>>`; returns
  `{ debate: mapDebateRow(...), inviteLink: created.data.inviteLink }`. The 004
  `notifyCreateTimeInvite` fire-and-forget block is byte-unchanged.
- `useDebates().create` → `Promise<CreatedRoom | null>` (prepends
  `result.data.debate` to the list, returns the whole `CreatedRoom`).
- `ConversationGalleryScreen.onCreate` / `DebateListScreen.onCreate` /
  `StartArgumentPage.onCreate` prop types widened to `=> Promise<CreatedRoom |
  null>`. The gallery passes `onCreate` straight through (no consumption). The
  legacy dev-only `DebateListScreen` uses only `created.debate` to open the room
  (it does not render the box).

## The one-time copy-link box (`StartArgumentPage`)

On a successful create:
- **link present** (private always; public-with-invite) → set local
  `createdInvite` state `{ debate, surface, inviteLink }` and render an
  early-return **success interstitial** that replaces the form. Navigation is
  **deferred** — navigating straight into the room would strand the invitee
  because the link is the only client-side moment that token exists.
- **link null** (public, no invite) → call `onCreated(debate, surface)`
  immediately (existing behaviour, no regression).

The interstitial reuses the shipped affordance:
- `INVITE_PANEL_COPY.copyLinkButton` / `copyLinkSuccess` for the copy control
  (same vocabulary as the in-room `InvitePanel` link box).
- The raw link renders as **selectable monospace `<Text>`** (no clipboard
  import; the user long-presses to copy — mirrors `InvitePanel.handleCopyLink`).
- New generic copy in `ARGUMENT_ROOM_CREATE_COPY` (`invite_link_box_title`,
  `invite_link_box_helper`, `invite_link_continue_label`) — automatically
  scanned by the existing `argumentRoomCreateCopyDoctrine` ban-list test.
- "Continue to the argument" clears `createdInvite` (so the link is **not
  re-exposed**) and then fires the deferred `onCreated(debate, surface)`.

## Doctrine / safety

- **Inviter-only:** the success state is reachable only by the creator who just
  submitted the form; no other actor renders it (structural). Pinned by a test
  asserting the box is absent on initial render.
- **One-time:** `Continue` clears the link from state; there is no affordance
  that brings it back. Pinned by a test.
- **Never logged:** no `console.*` in `StartArgumentPage.tsx` (static scan); a
  behavioural test spies on all `console` methods across the full flow and
  asserts the raw token never appears.
- **Never persisted:** the link lives only in in-memory React state (mirrors
  `InvitePanel.lastInviteLink`); the page imports no storage API (static scan
  bans `AsyncStorage`/`SecureStore`/`localStorage`/`MMKV`/…).
- **No enumeration:** the copy is generic — it names no one and reveals nothing
  about whether the invitee already has a registered identity. Ban-list covers
  the enumeration tokens.
- **No service-role, no AI, no `supabase/**` change.** The ARG-ROOM-004 notify
  path and all existing `createDebate` callers are unaffected (pinned by the
  unchanged + extended `debatesApi.visibility` and the green
  `StartArgumentPage` / `startArgumentVisibilityInvite` suites).

## Accessibility

- Copy control + Continue button: `accessibilityRole="button"`,
  `accessibilityLabel`, `minHeight: 44` (plus `hitSlop` on copy). Pinned.
- Link text is selectable `<Text>` (all text inside `<Text>`).
- Color is not the only signal (the controls carry text labels).

## Files

- `src/features/debates/types.ts` — `CreatedRoom`.
- `src/features/debates/debatesApi.ts` — `createDebate` returns `CreatedRoom`.
- `src/features/debates/useDebates.ts` — `create` returns `CreatedRoom | null`.
- `src/features/debates/ConversationGalleryScreen.tsx` — prop type only.
- `src/features/debates/DebateListScreen.tsx` — prop type + `handleCreate`.
- `src/features/arguments/gameCopy.ts` — 3 new `ARGUMENT_ROOM_CREATE_COPY` keys.
- `src/features/arguments/startArgument/StartArgumentPage.tsx` — the success
  interstitial + the deferred-handoff flow.
- Tests: new `__tests__/startArgumentInviteLinkBox.test.tsx` (+13); updated
  `StartArgumentPage`, `startArgumentVisibilityInvite`, `debatesApi.visibility`
  fakes/assertions for the result-shape change.

## Gates

`npm run typecheck` exit 0 · `npm run lint` exit 0 · `npm run test` exit 0
(781 suites / 30847 passed, +13; 1 pre-existing skip). **No operator
follow-up** — pure client change; merge is not a deploy.
