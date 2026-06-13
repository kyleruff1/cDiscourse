# ARG-ROOM-003 — Create argument-room UX

Status: Design draft
Epic: Argument Room Visibility & Invite (ARG-ROOM-VISIBILITY-INVITE)
Release: 6.7
Issue: #614 — https://github.com/kyleruff1/cDiscourse/issues/614

---

## Goal

The live create surface — `src/features/arguments/startArgument/StartArgumentPage.tsx` — exposes **neither** visibility **nor** an invite today. Every argument it creates is public, with no way to start a private 1v1 and no way to bring one person in at creation (the create-time path calls `onCreate` with only `title` / `resolution` / `description`; StartArgumentPage.tsx:122-127).

ARG-ROOM-003 adds, to that one screen, the **author-facing surface** for the binding creation matrix:

- a Public / Private selector (default **Private**),
- one direct-invite email field,
- a capacity explainer (private = 1v1; public = up to five, one optional invite reserves a seat),
- the button-state + helper-copy matrix (Private + no email disabled; Public + no email enabled; two-or-more emails rejected),
- a post-create handoff that opens the room and surfaces the invite (with a retry path when the room is created but the invite send fails).

This card is the **client surface only**. It drives off the ARG-ROOM-001 pure validator (`deriveArgumentRoomCreation`) so the form and the server share one source of truth, and it ships **behind** ARG-ROOM-002's server enforcement so the UI is never the only gate. It rebuilds nothing: it reuses the shipped visibility radiogroup, the shipped invite wrapper + validators, the shipped capacity models, and the shipped visibility copy.

---

## Product contract (the matrix verbatim)

| Visibility | Direct invites | Reserved seat | Open slots after create | Total capacity | Valid? |
| --- | --- | --- | --- | --- | --- |
| Private | 0 | 0 | 0 | 2 | NO (private requires one invite) |
| Private | 1 | 1 | 0 | 2 | YES (default) |
| Public | 0 | 0 | 4 | 5 | YES |
| Public | 1 | 1 | 3 | 5 | YES |
| any | 2+ | — | — | — | NO (max one direct invite) |

One direct invite at creation. Private rooms are 1v1. Public rooms are capped at five active participants. A public direct invite reserves one of the five seats. Public with no invite is valid. Private with no invite is invalid. Observers are not active participants.

---

## Existing shipped state (file:line — what to REUSE)

This card is enforcement / live-surface exposure on top of shipped primitives. Each row below is **reused, not rebuilt**.

**The live create surface (the file this card edits)**
- `StartArgumentPage.tsx` — declaration-first create page on dark `SURFACE_TOKENS`. Component body 101-315; `onCreate` prop type 87; `onCreated?(debate, surface)` 94; `onCancel` 96; copy block 54-77.
- `handleSubmit` 114-142 builds a `CreateDebateInput` at 122-127 and calls `onCreate(input)` (132). There is no visibility, no invite, no capacity anywhere in this file today.
- The page already ships a **dark-theme radio pattern** with the color-independent glyph: `SurfaceOption` 319-356 (role `radio`, `accessibilityState={{ selected }}`, `hitSlop`, `●`/`○` + bolder label). The new visibility control matches this, in-file, rather than importing the light-themed orphan.
- Hosted by `ConversationGalleryScreen` (App.tsx wires `onCreate={create}` 821, `onCreatedWithSurface` 833-838, `showCreate`/`onShowCreateChange` 847-848). StartArgumentPage's own prop is `onCreated` (94); the gallery adapts it to `onCreatedWithSurface`.

**The visibility radiogroup to lift**
- `CreateDebateForm.tsx` — orphaned light-theme form. `VisibilityOption` radio component 20-54; the `radiogroup` wrapper with the two options 105-131; **default `'public'`** 61. We lift the **structure + semantics + copy wiring** (not the light StyleSheet).
- `ROOM_VISIBILITY_COPY` — `gameCopy.ts` 1604-1665: `group_label`, `option_public_label`/`option_public_helper`, `option_private_label`/`option_private_helper`, plus the private badge / no-access strings. Already ban-list scanned by `roomVisibilityModel.test.ts`.

**The one-direct-invite stack (QOL-038 / QOL-040)**
- `createRoomInvite(input)` — `inviteApi.ts` 142-151: thin client wrapper over the `manage-room-invite` Edge Function (`action: 'create'`). Never imports a service-role key, never inserts into `argument_room_invites` directly. Response shape `CreateRoomInviteResponse` 42-55 carries `notification: 'queued' | 'sent' | 'not_configured'`, `reused`, and `inviteLink: string | null` (raw token, inviter-only, only when email delivery is off).
- `validateInviteEmailInput(email)` — `inviteCopy.ts` 186-193: returns `null` on valid, else the inline error string. Single-email shape check; reused verbatim.
- `InvitePanel.tsx` single-field pattern — email `TextInput` 117-131 (`keyboardType="email-address"`, `autoCapitalize="none"`, `accessibilityLabel`), validate-then-submit 64-77, link-box affordance 150-177, `handleCopyLink` (selectable `<Text>`, no clipboard import) 79-85. Copy in `INVITE_PANEL_COPY` (`inviteCopy.ts` 80-103): `emailLabel`, `emailPlaceholder`, `copyLinkButton`, `copyLinkSuccess`, `emailedNotice`, `sendButton`/`sendingButton`.
- `maskInviteeEmail(emailLower)` — `inviteModel.ts` 147-159: `a•••@example.com` for any inviter-visible echo after submit.
- `IntendedSeat = 'respondent' | 'co_primary'` — `inviteModel.ts` 25; the create-time invite passes `'respondent'` (the wrapper default, inviteApi.ts:149).
- Email delivery is **default OFF** (`INVITE_EMAIL_ENABLED`; QOL-040 owns the flip). At create time, `createRoomInvite` returns `notification: 'not_configured'` plus a raw `inviteLink`. The raw token is **unrecoverable later** (room-notifications `inviteLink` is null; the hash is one-way), so the create-time response is the only chance to surface the copy-link affordance.

**The shipped room-creation path (unchanged by this card)**
- `useDebates().create` — `useDebates.ts` 40-52; `UseDebatesResult.create` 11. App passes it as `onCreate` (App.tsx:821).
- `createDebate(input, userId)` — `debatesApi.ts` 107-151: RLS-gated client `INSERT` into `public.debates` with `created_by = auth.uid()`, accepts `input.visibility` (default `'public'` at 125), auto-joins the creator as side `'moderator'` 146-148.
- `CreateDebateInput.visibility?: RoomVisibility` already exists — `types.ts` 43-54. No type change is needed to pass visibility.

**The capacity models (read-only reference; numbers sourced, not re-hardcoded)**
- `publicSeatModel.ts` — `PUBLIC_ROOM_SEAT_CAP = 6` (62), `PRIMARY_SEAT_COUNT = 2` (68). This is the GAME-005 active-seat cap.
- `roomContractModel.ts` — `RoomType = 'private' | 'public'` (26); private-room seating via `invitedOpponentUserId` (338-351); `ROOM_CONTRACT_COPY` 101-113.

---

## Divergence from shipped (what this card adds / changes)

1. **Visibility selector on the live surface.** StartArgumentPage gains a Public / Private radiogroup. The orphaned `CreateDebateForm` had one but is not mounted; this is the first time the live create path exposes the choice.

2. **Default flips to Private.** The shipped defaults are public (`CreateDebateForm.tsx:61`, `createDebate` 125). This card sets the **selector's initial state to `'private'`** per the matrix ("YES (default)" row). Consequence: a freshly opened create page has the submit button **disabled** until the author either adds one invite email (private 1v1) or switches to Public. The form always passes an **explicit** `visibility` to `createDebate`, so the API's public default is never relied on.

3. **One direct-invite field at creation.** New. Reuses `validateInviteEmailInput` + the `InvitePanel` single-field markup. The field is **required for Private, optional for Public**, and rejects two-or-more addresses.

4. **Public active-participant cap 6 → 5.** Per the binding operator decision and the slate ADR, the public cap reconciles from the shipped GAME-005 `PUBLIC_ROOM_SEAT_CAP = 6` (`publicSeatModel.ts:62`) to **5**. ARG-ROOM-003 does **not** edit that constant and does **not** hardcode `5`: it reads the capacity numbers (total = 5, open slots = 4 or 3) from the ARG-ROOM-001 validator output, which owns the reconciled constant. The capacity-explainer copy says "five" only via that single source. (The constant edit and any GAME-005 seat-map follow-through belong to ARG-ROOM-001 / its ADR, not this UI card.)

5. **Two-step create handoff with an invite step.** Today `handleSubmit` is a single `onCreate` call. This card sequences `onCreate(visibility)` → read `debate.id` → `createRoomInvite(id, email)` when an email is present, with explicit failure semantics (below). The page gains a small post-create state to host the invite link / retry instead of navigating immediately.

6. **Form is validator-driven.** Button state, helper copy, and capacity numbers are all derived from `deriveArgumentRoomCreation` (ARG-ROOM-001) — the same function ARG-ROOM-002 runs server-side. The UI never re-implements the rule.

Everything else on the page (declaration focus, surface selector, optional framing taxonomy, dark theme) is unchanged.

---

## Chosen approach

### Layout

Insert one new section, **"Who can join,"** directly after the declaration block (StartArgumentPage.tsx:158-176) and before the "Open into" surface selector (179-204). It contains, top to bottom:

1. **Visibility radiogroup** — two options modeled on the in-file dark `SurfaceOption` (319-356), wired to `ROOM_VISIBILITY_COPY.option_public_*` / `option_private_*` / `group_label`. Initial state `'private'`.
2. **Invite email field** — the `InvitePanel` `TextInput` pattern (117-131): `keyboardType="email-address"`, `autoCapitalize="none"`, `accessibilityLabel`, inline error with `accessibilityLiveRegion="polite"`. Label/helper vary by visibility ("required" for Private, "optional" for Public).
3. **Capacity explainer** — one or two `<Text>` lines whose content is derived from the validator (see UI copy).

The submit button (existing, 282-296) keeps its role/state wiring; its `disabled` now reflects the validator, and a **visible helper line** above it states the disabled reason (color is never the only signal).

### State + validation (one source of truth)

```ts
const [visibility, setVisibility] = useState<RoomVisibility>('private'); // matrix default
const [inviteEmail, setInviteEmail] = useState('');

// ARG-ROOM-001 owns the rule; the UI only renders its output.
const creation = deriveArgumentRoomCreation({
  declaration,        // already required by isStartArgumentDraftSubmittable
  visibility,
  inviteEmailRaw: inviteEmail,
});
// creation.submitEnabled drives the button.
// creation.reason (a stable code) maps to helper copy via toCreateRoomHelper().
// creation.capacity { total, openSlots, reservedSeat } drives the explainer.
// creation.normalizedEmail is the lowercased single address, or null.
```

The button-state matrix the validator encodes (UI renders it):

| Visibility | Email field | Button | Helper line |
| --- | --- | --- | --- |
| Private | empty | **Disabled** | "Add one person's email to start a private argument — or choose Public to let anyone join." |
| Private | valid single | Enabled | capacity explainer (1v1) |
| Private | malformed | Disabled | `validateInviteEmailInput` string |
| Private | two-or-more | Disabled | multi-invite copy (below) |
| Public | empty | **Enabled** | capacity explainer (four open) |
| Public | valid single | Enabled | capacity explainer (one reserved, three open) |
| Public | malformed | Disabled | `validateInviteEmailInput` string |
| Public | two-or-more | Disabled | multi-invite copy (below) |

A non-empty-but-invalid email disables submit **even for Public** — the author clearly intends to invite, so we never silently drop a typo and create a room without the invite. (Empty + Public is the only "no invite" path.)

### Submit sequence + failure semantics

```ts
const handleSubmit = async () => {
  if (!creation.submitEnabled) return;
  setSubmitting(true); setError(null);

  // 1. Create the room with an EXPLICIT visibility (shipped path).
  const created = await onCreate({
    title: pickDisplayTitle({ rootBody: declaration.trim() }),
    resolution: declaration.trim(),
    description: '',
    visibility,                       // 'public' | 'private'
  });
  if (!created) { setError(COPY.submitError); setSubmitting(false); return; }

  // 2. If an invite is present, create it (shipped Edge wrapper).
  if (creation.normalizedEmail) {
    const res = await onInvite({
      debateId: created.id,
      inviteeEmail: creation.normalizedEmail,
      intendedSeat: 'respondent',     // wrapper default; reserves one seat
    });
    if (!res.ok) {
      // ROOM EXISTS. Never silently drop the invite. Show a retry state.
      setPostCreate({ debate: created, invite: 'failed', email: creation.normalizedEmail });
      setSubmitting(false);
      return;
    }
    setPostCreate({ debate: created, invite: res.data, email: creation.normalizedEmail });
    setSubmitting(false);
    return;
  }

  // 3. No invite (public, no email) → open the room immediately.
  onCreated?.(created, surface);
  setSubmitting(false);
};
```

**Failure semantics (binding):** the room is created **before** the invite. If `createRoomInvite` fails, the room still exists and the creator is already auto-joined as moderator (`createDebate` 146-148). We do **not** delete the room (doctrine: `debates` are never hard-deleted; soft-delete is archive). Instead the page enters a post-create state with:

- "Your argument is ready, but we couldn't send the invite to `{maskInviteeEmail(email)}`."
- **Retry** → calls `onInvite` again with the same `debateId` + email.
- **Open the argument** → calls `onCreated(debate, surface)`; the in-room `InvitePanel` (canInvite gate App.tsx:906-910) remains a second retry path.

This is the "room exists, surface a retry, never silently drop" contract.

**Success state (post-create, §15):** generic, uniform copy that never reveals whether the invitee is a new or existing user (the `createRoomInvite` response carries no such signal — only `notification` + `inviteLink`).

- Headline: "Your argument is ready."
- Email **off** (default) + invite created: render the `INVITE_PANEL_COPY` link-box (selectable `<Text>` + `copyLinkButton` / `copyLinkSuccess`, mirroring `handleCopyLink` 79-85) so the inviter can share the link. This is the only place the raw create-time token can be surfaced, and only to the inviter, only this session, never logged.
- Email **on** (post-QOL-040): "We'll let them know by email." (uniform).
- **Open the argument** button → `onCreated(debate, surface)`.

### Why this is reuse, not a rebuild

- Visibility: lifts the QOL-039 radiogroup structure + `ROOM_VISIBILITY_COPY`.
- Invite: lifts the QOL-038 `validateInviteEmailInput`, `createRoomInvite`, `maskInviteeEmail`, and the `InvitePanel` field + link-box pattern.
- Room creation: untouched `createDebate` (already visibility-aware).
- Capacity: numbers from the ARG-ROOM-001 validator (which owns the reconciled `5`).
- Rule: the validator is the single source of truth; ARG-ROOM-002 re-runs it server-side.

---

## Alternatives rejected

1. **Re-skin and mount the orphaned `CreateDebateForm`.** Rejected: it is a light-theme `Screen` with a different field set (separate Title + Resolution), no invite, no capacity, no validator wiring, and it is not the live surface. Bolting onto the live `StartArgumentPage` (already dark, declaration-first, surface-aware) is less code and avoids a second create path.

2. **Hardcode `5` / the capacity strings in the UI.** Rejected: it would drift from the server cap the moment ARG-ROOM-001's constant changes. The UI reads capacity from the validator output so there is exactly one number.

3. **Enforce the matrix in the UI only.** Rejected by doctrine: the UI must not be the only gate. ARG-ROOM-002 owns server enforcement; this card depends on it and merges behind it.

4. **Roll the room back when the invite fails.** Rejected: `debates` rows are never hard-deleted (doctrine §8), and a created room with a failed invite is a recoverable state, not a corrupt one. Retry + in-room `InvitePanel` is the correct recovery.

5. **Hand the raw create-time token to the in-room `InvitePanel` via the navigation handoff.** Rejected for scope: it would require widening `onCreated` / `onCreatedWithSurface` and seeding `useRoomInvites` with an initial link. Surfacing the link-box on the create page (reusing `INVITE_PANEL_COPY`) keeps the change inside this one file and on the inviter's own surface, exactly as `InvitePanel` already does.

6. **Combine create + invite into one new Edge call now.** Rejected as out of scope for a UI card — that is an ARG-ROOM-002 server decision (see Open questions). The form is structured so the two-call sequence can later collapse to one Edge call without changing any control or copy.

---

## Data / API shape

**No new table, no migration, no new Edge Function, no hosted-config write.** This card is pure client UI over shipped wrappers.

**Consumed from ARG-ROOM-001 (validator — owned there, consumed here).** `deriveArgumentRoomCreation` is pure TS (no React, no network). ARG-ROOM-001 owns the exact shape; ARG-ROOM-003 consumes at minimum:

```ts
interface ArgumentRoomCreationDecision {
  submitEnabled: boolean;
  reason: ArgumentRoomCreationReason | null;   // stable code, mapped to copy (never echoed raw)
  normalizedEmail: string | null;              // single lowercased address, or null
  visibility: 'public' | 'private';
  capacity: {
    total: number;        // 2 (private) | 5 (public) — 5 is the reconciled constant
    reservedSeat: 0 | 1;  // 1 when a public/private invite is present
    openSlots: number;    // 0 (private) | 4 | 3 (public)
  };
}
// reason ∈ e.g. 'private_requires_invite' | 'invalid_email' | 'multiple_invites' | 'ok'
```

**New StartArgumentPage props (additive, defaulted so existing mounts compile):**

```ts
interface StartArgumentPageProps {
  onCreate: (input: CreateDebateInput) => Promise<Debate | null>;   // unchanged (already visibility-aware)
  onCreated?: (debate: Debate, surface: StartArgumentSurface) => void; // unchanged
  onCancel: () => void;                                             // unchanged
  // NEW — injected for testability, defaults to the real wrapper:
  onInvite?: (input: CreateRoomInviteInput) => Promise<InviteApiResult<CreateRoomInviteResponse>>;
}
```

`onInvite` defaults to `createRoomInvite` (`inviteApi.ts:142`). App.tsx needs no new prop (the default covers production); tests inject a mock. `CreateDebateInput` already carries `visibility?` (`types.ts:53`), so the form just sets it.

**New copy block in `gameCopy.ts`** — `ARGUMENT_ROOM_CREATE_COPY` (ban-list scanned), plus a `toCreateRoomHelper(reason)` mapper that converts each validator reason code to plain language and **suppresses** unknown codes (returns the generic fallback, never the raw code).

---

## UI copy (ban-list-clean)

All strings live in `gameCopy.ts` and are scanned by the doctrine ban-list. They avoid every verdict / person token **and** the invite-framing bans (`challenger`, `opponent`, `debate challenge`, `game invite`) so the strictest scan passes. Reused: `ROOM_VISIBILITY_COPY.*`, `validateInviteEmailInput` strings, `INVITE_PANEL_COPY` link-box strings.

```ts
export const ARGUMENT_ROOM_CREATE_COPY = Object.freeze({
  // Section
  who_can_join_label: 'Who can join',

  // Invite field (create-time framing; visibility-dependent helper)
  invite_field_label: 'Invite one person (email)',
  invite_field_placeholder: 'name@example.com',
  invite_helper_private: 'A private argument needs one person. Add their email.',
  invite_helper_public: 'Optional. Add one person to save them a seat — or leave this empty.',

  // Capacity explainer (templated from validator output)
  capacity_private: 'Just the two of you. Invite one person to start.',
  capacity_public_open: 'Up to five people can take part. {open} seats stay open for the first to reply.',
  capacity_public_reserved:
    'Up to five people can take part. One seat is saved for the person you invite; {open} stay open for the first to reply.',

  // Button-state helper (disabled reasons)
  helper_private_needs_invite:
    'Add one person’s email to start a private argument — or choose Public to let anyone join.',
  helper_multiple_invites:
    'You can invite one person when you start. Add more once the argument is open.',

  // Post-create success (generic — never reveals new vs existing user)
  post_create_ready: 'Your argument is ready.',
  post_create_open_button: 'Open the argument',
  post_create_emailed: 'We’ll let them know by email.',
  post_create_share_link: 'Share this link with the person you invited.',

  // Invite-failure retry (room exists; never silently drop)
  invite_failed_title: 'Your argument is ready, but we couldn’t send the invite.',
  invite_failed_retry: 'Retry invite',
  invite_failed_open: 'Open the argument',
} as const);
```

Notes: `{open}` is filled from `capacity.openSlots` (4 or 3). The capacity strings are the single place "five" appears, and the **number 5 itself** comes from the validator, not this string (the word is fixed; the slot counts are interpolated). The retry title shows `maskInviteeEmail(email)`, never the raw address verbatim.

---

## Tests (named)

Per test-discipline: tests ship with the card. UI tests use React Testing Library (JSDOM); copy tests are pure scans.

**UI behavior — `__tests__/startArgumentVisibilityInvite.test.tsx`**
1. `defaults the visibility selector to Private` — Private radio `accessibilityState.selected === true`, Public `false`, `●` on Private.
2. `switches to Public when the Public option is pressed`.
3. `disables submit when Private is selected and the invite email is empty` — button `accessibilityState.disabled === true`.
4. `enables submit when Public is selected and the invite email is empty`.
5. `enables submit when Private is selected and a valid invite email is entered`.
6. `rejects a two-or-more email paste and keeps submit disabled` — pasting `a@b.com, c@d.com` shows the exact `helper_multiple_invites` string; submit stays disabled.
7. `shows the validateInviteEmailInput error for a malformed single email` — and submit is disabled even when Public.
8. `renders the 1v1 capacity explainer for Private`.
9. `renders the four-open capacity explainer for Public with no invite`.
10. `renders the one-reserved-three-open capacity explainer for Public with an invite`.
11. `calls onCreate with the explicit visibility, then onInvite with the normalized email` — asserts call order and that `onInvite` is **not** called when the email is empty (public no-invite path).
12. `opens the created room via onCreated after a successful create and invite`.
13. `surfaces a retry and does not delete the room when the invite send fails` — `onInvite` rejected → retry control visible, masked email shown, `onCreated` not auto-called; pressing Retry re-invokes `onInvite`.
14. `surfaces the copy-link affordance only when email delivery is off and a link is present`.

**Accessibility — same suite (or `__tests__/startArgumentVisibilityInviteA11y.test.tsx`)**
15. `exposes radiogroup + two radio roles with selected state on the visibility options`.
16. `renders the disabled-submit reason as visible helper text` (a `<Text>` node carrying the reason — not color alone).
17. `the invite TextInput exposes an accessibilityLabel and email keyboard/autoCapitalize settings`.

**Copy / doctrine — `__tests__/argumentRoomCreateCopyDoctrine.test.ts`**
18. `every ARGUMENT_ROOM_CREATE_COPY string is free of banned framing tokens` — scans winner/loser/true/false/liar/dishonest/bad faith/manipulative/extremist/propagandist **and** challenger/opponent.
19. `no create-room UI string contains snake_case / an internal code` — guards the "no raw codes" rule.
20. `toCreateRoomHelper maps every validator reason to plain language and suppresses unknown codes` — unknown reason → generic fallback, never the raw code.
21. `the post-create success copy is identical regardless of any new-vs-existing-user signal` — uniform string (account-enumeration guard).

---

## Doctrine compliance

- **§1 / §2 / §3 (no verdict, no truth, no popularity):** the surface is room setup; no score, no heat, no standing copy. Ban-list tests 18-19 enforce it.
- **§4 / §7 (no AI, no client AI calls):** none added; the create + invite path is RLS insert + the existing Edge wrapper.
- **§6 (secrets):** no service-role key, no `ANTHROPIC_API_KEY`. `createRoomInvite` routes through `manage-room-invite` (inviteApi.ts:142-151). The only sensitive value touched is the inviter's own raw `inviteLink`, surfaced exactly as `InvitePanel` already does — to the inviter, never logged.
- **§8 (Supabase conventions):** no migration; `debates` never hard-deleted (the failed-invite path keeps the room). The **new enforcement** (cap, one-invite, private-requires-invite) is **not** a new direct client insert — `createDebate` is the shipped RLS-gated insert, the invite goes through the Edge Function, and authoritative enforcement is ARG-ROOM-002 server-side. The UI is the friendly first gate, not the only gate.
- **§9 (plain language):** validator reason codes are mapped through `toCreateRoomHelper`; unknown codes suppressed (test 20).
- **No account enumeration:** post-create success copy is uniform; the `createRoomInvite` response exposes no new-vs-existing signal (test 21). `maskInviteeEmail` is used for any post-submit echo.
- **Accessibility-targets:** radiogroup + radio roles, 44px targets (`SurfaceOption` minHeight 44 / `hitSlop`), `●`/`○` color-independent glyph, `TextInput` label, `accessibilityLiveRegion="polite"` errors, disabled reason as visible text. No animation added → reduce-motion is a no-op (confirmed in Open questions).

---

## GATE-C + merge posture

- **GATE-C:** **Not deploy-bearing.** UI-only — no migration, no Edge Function change, no Deno / Supabase deploy, no hosted-config or env write. Standard gates apply: `npm run typecheck`, `npm run lint`, `npm run test` all green with the test count up.
- **Dependency sequencing (binding):** merges **after** ARG-ROOM-001 (the validator `deriveArgumentRoomCreation` must exist to import and to source the reconciled cap) and **must not reach users ahead of** ARG-ROOM-002 (server enforcement) — otherwise the UI is the only gate, which doctrine forbids. Order: 001 → 002 → 003.
- **Merge posture:** case-by-case automerge — eligible once green, reviewed, and the two dependencies are satisfied. If ARG-ROOM-002 is still open, this card may merge to `main` but should sit behind 002's landing before the create surface is enabled for users (or ship co-gated with it).

---

## Risks

1. **UI-as-only-gate.** Mitigated by the hard ARG-ROOM-002 dependency; the form drives off the same validator the server runs.
2. **Two-step create→invite non-atomicity.** The room can exist while the invite fails. Mitigated by the explicit retry state + the in-room `InvitePanel` second path; never a silent drop, never a room rollback.
3. **Raw token on a new surface.** The create-time `inviteLink` appears on the post-create panel. Mitigated: inviter-only, single session, never logged, mirrors the shipped `InvitePanel` consumer; gated to email-off.
4. **Default-Private behavior change.** Today every room is public; now the author must choose (and Private starts disabled). Mitigated by the explicit helper line + capacity explainer; the friction is intentional per the matrix.
5. **Cap copy drift (6 vs 5).** Mitigated by sourcing the number from the ARG-ROOM-001 validator; the UI never hardcodes `5`. If 001 ships before its constant is reconciled, the explainer would show the wrong count — call out in review that 001's constant must be 5 when 003 merges.
6. **Private-requires-invite is cross-operation.** The invite is created after the room, so the client cannot guarantee a private room ends up with exactly one invite if step 2 fails and the user dismisses. Mitigated by the retry state; the durable guarantee is ARG-ROOM-002's (see Open questions).

---

## Open questions

1. **How does ARG-ROOM-002 enforce private-requires-invite server-side?** A deferred check / trigger with a grace window, or by moving creation into one `create-argument-room` Edge call that writes room + invite atomically? If the latter, ARG-ROOM-003's two-call `handleSubmit` collapses to a single Edge call — the form is structured so the controls and copy do not change. Confirm before implementation so the page calls the final shape once.
2. **`intendedSeat` for the public reserved seat.** This card passes `'respondent'` (the wrapper default) for both Private and Public. Confirm with ARG-ROOM-002 that a public reserved seat should be `'respondent'` and not a distinct literal.
3. **Where the reconciled cap constant lives.** ARG-ROOM-001 is assumed to own `5` (and to reconcile `publicSeatModel.ts:62` 6 → 5). Confirm the validator exports the capacity numbers ARG-ROOM-003 reads, so no second constant is introduced.
4. **Reduce-motion.** The create page has no animations today and this card adds none, so reduce-motion is a no-op. Confirm no transition is added during implementation.
5. **Surface ordering.** "Who can join" is proposed directly after the declaration and before "Open into." Confirm this ordering reads correctly for screen-reader focus order (declaration → who can join → open into → optional framing).
