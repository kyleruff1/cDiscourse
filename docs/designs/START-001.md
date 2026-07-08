# START-001 — Person-first start sheet + PersonArgumentPicker

**Status:** Design draft
**Epic:** Argument Surface Pivot (ASP-000, #826) — Milestone M-ASP-1
**Release:** Phase P1 (`home_v2`)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/827 (rewrite of #827 / UX-COMPOSER-001; closes it at merge)
**Branch:** `feat/start-001-003-person-first` (shared with START-003, base `e3d2819`)

---

## Goal (one paragraph)

Invert the start flow from declaration-first to **person-first**: `who → what → advanced`.
Today `StartArgumentPage.tsx` (903 lines) asks you to type a point at the void, then
negotiate visibility + a raw invite e-mail. START-001 wraps that *exact* shipped creation
machinery in a new **StartArgumentSheet** whose first step is a **PersonArgumentPicker**
(recent opponents → e-mail → "No one — open floor" last), and whose Advanced section
(collapsed) hosts the public-visibility ceremony that START-003 plugs into. The doctrine
that shapes this design: private-by-default is *strengthened* — picking a person makes
private the grammatical default and public a deliberate two-tap exception
(cdiscourse-doctrine §10 v1 scope: **no global user search / no OAuth**); the deterministic
`deriveArgumentRoomCreation` matrix stays the single creation decision function (no forked
logic); `create-argument-room` and every RLS/migration are untouched; the picker reads
**only the viewer's own data** through an existing RLS policy — no `profiles` enumeration,
no new Edge Function, no service-role. Everything is gated behind the shipped `home_v2`
flag and is byte-identically inert when the flag is OFF.

---

## Scope-reality audit (READ FIRST — a brief assumption is corrected here)

Per the POSTRUN-UX001 scope-reality rule, the brief's stated recents source was audited
against the shipped schema **before** design. The finding changes the data source (not the
scope) and is flagged for operator review in the ledger at the end of this doc.

**Brief says:** recent opponents derive from "the viewer's own `debate_participants`
co-participation rows."

**Reality (verified against the shipped schema + client reads):**

1. The create path invites **by e-mail only**. `create-argument-room` /
   `deriveArgumentRoomCreation` accept `invite: { email }` and nothing else. A "recent
   opponent" must therefore resolve to an **invitable e-mail** to feed the byte-identical
   payload — a bare `user_id` is not invitable without changing the Edge RPC (a hard
   non-goal).
2. `debate_participants` cannot yield an invitable *or* displayable identity for the
   person-first (private) case:
   - RLS `"debate_participants: select own or open debate"`
     (`20260516000002_rls_policies.sql:175`) shows the viewer **only their own row** in a
     **private** room. Co-participant rows are readable only in *public* rooms — the
     opposite of the 1:1 private default this card centers on.
   - Even where a co-participant `user_id` is readable, there is **no client-readable
     `user_id → email`** path (`public.profiles` has **no email column**; e-mails live in
     `auth.users`, which is not client-readable) and **no `user_id → display_name`** path
     wired into any surface the app already loads. The gallery/home "name" is synthetic:
     `deriveStarterDisplay()` returns `User · abcd…wxyz` (`conversationGalleryModel.ts:1076`,
     comment: *"The Debates API doesn't surface display names"*).
3. Circles have **no client read path**: `circleModel.ts` is a pure model and explicitly
   states *"circlesApi / circleInviteApi / useCircles … are OUT OF SCOPE (owned by
   PRIVATE-GROUPS #839/#840/#843)."* Adding one is a non-goal.

**The only client-readable, invitable, viewer-scoped identity the shipped schema exposes is
the viewer's own sent invites.** `argument_room_invites` carries `invitee_email_lower`
(full), and RLS policy **`ari_select_inviter_own`**
(`20260524000013_qol_038_argument_room_invites.sql:112` — `using (invited_by = auth.uid())`)
lets the inviter read their own rows directly via PostgREST. Because every **private** room
*requires* an invite at creation (`private_requires_invite`), the set of e-mails the viewer
has invited **is** "the people I have started arguments with." This realizes the brief's
*intent* ("start from a person you've argued with") using the only in-scope invitable source.

**Decision:** recents derive from `argument_room_invites` (viewer's own rows), not
`debate_participants`. This is *more* conservative than the brief's non-goal ("only the
viewer's OWN recents") — it is strictly `invited_by = auth.uid()`. See Design decision 1.

---

## Data model

**No new tables, columns, migrations, RLS policies, or Edge Functions.** No changes to
`create-argument-room`, its RPC, or the capacity trigger.

### One new read (client-side, RLS-scoped) — enumerate + cite policy

A single new PostgREST read is introduced (there is no existing "list my sent invites"
client read to reuse; `manage-room-invite.list_for_debate` is per-debate and returns
*masked* e-mails via an Edge Function):

```ts
// src/features/arguments/startArgument/recentOpponentsApi.ts
supabase
  .from('argument_room_invites')
  .select('invitee_email_lower, debate_id, created_at, status')
  .eq('invited_by', userId)             // redundant with RLS; explicit for clarity
  .order('created_at', { ascending: false })
  .limit(50);
```

- **RLS basis:** `ari_select_inviter_own` — `for select to authenticated using
  (argument_room_invites.invited_by = auth.uid())`. The `.eq('invited_by', userId)` merely
  mirrors the policy; the policy is authoritative. No other policy is relied on.
- **No enumeration:** the read returns only rows the *caller* created. It cannot see any
  other user's invites, any `profiles` row, or any e-mail the caller did not type.
- **No service-role, no Edge Function, no migration.** Direct anon-keyed PostgREST read.

### Pure-model types (new)

```ts
// src/features/arguments/startArgument/personArgumentPickerModel.ts

/** The value the picker emits. Both 'profile' and 'email' resolve to a create
 *  invite of shape { email } — the kind is UI/telemetry provenance only. */
export type PersonTarget =
  | { kind: 'profile'; email: string; id?: string | null } // a recent opponent (history)
  | { kind: 'email'; email: string }                        // a freshly typed address
  | { kind: 'open_floor' };                                 // public, no invite

/** One recent opponent, derived from the viewer's own invite rows. */
export interface RecentOpponent {
  /** Full normalised e-mail — the invitable value fed to the create payload. */
  email: string;
  /** Display-only masked form (j•••@example.com) via maskInviteeEmail. */
  maskedEmail: string;
  /** Most-recent invite time (ms) for this e-mail — sort key only. */
  lastInvitedAtMs: number;
}

/** Raw row shape the api returns (mirrors the select above). */
export interface RecentInviteRow {
  invitee_email_lower: string;
  debate_id: string;
  created_at: string;
  status: string;
}

/** A circle option slot — RESERVED for START-002; always [] in START-001. */
export interface CircleOption { id: string; label: string; }
```

### Derivations (pure, unit-tested)

- `deriveRecentOpponents(rows: RecentInviteRow[], limit = 8): RecentOpponent[]` — dedupe by
  `invitee_email_lower` (keep the newest `created_at`), sort desc by time, cap at `limit`.
  Uses `normaliseInviteeEmail` + `maskInviteeEmail` (from `invites/inviteModel.ts`) — no new
  regex, no new masking.
- `personTargetToCreationIntent(target, visibility): { visibility; directInviteEmails: string[] }`
  — maps a `PersonTarget` + chosen visibility into the exact `deriveArgumentRoomCreation`
  input. `profile`/`email` → `{ visibility: 'private', directInviteEmails: [target.email] }`;
  `open_floor` → `{ visibility: 'public', directInviteEmails: [] }`.
- `orderPickerRows(recents, circles, hasTypedEmail)` — enforces the fixed order
  **recents → circles → e-mail → open-floor-last** and the invariant that `open_floor` is
  always the last row.

The sheet **never** builds a `CreateDebateInput` itself; it always routes the resolved
e-mail string through `deriveArgumentRoomCreation` (see Design decision 3) so
`normalisedDirectInviteEmail` is the single source of the payload's invite address.

---

## Design decisions (the six)

### 1. Recents source — viewer's own sent invites (not `debate_participants`)

Recent opponents = distinct `invitee_email_lower` from the viewer's own
`argument_room_invites` rows (RLS `ari_select_inviter_own`), newest-first, displayed
**masked**, carrying the **full** e-mail internally for the create payload. Justification is
the Scope-reality audit above: this is the only client-readable, invitable, viewer-scoped
identity; it is strictly `invited_by = auth.uid()` (more conservative than the brief's
non-goal); it produces a real e-mail so the byte-identical create payload works unchanged.
**Hard non-goal held:** no `profiles` `select`/`ilike`, no directory endpoint, no global
search — e-mail entry remains the only path to people you have never argued with. A
source-scan test asserts no `from('profiles')` search query exists in any new picker file
(mirrors `roomVisibilityModel.sourceScan.test.ts`).

### 2. Sheet vs page + mount — new App.tsx branch, flag-off byte-identical

The Design Pass calls for a sheet ("starting never feels like leaving"). The shell is
state-flag nav with **no router** and no shipped modal-nav dependency, so the cheapest
wiring that keeps flag-off byte-identical is a **full-screen conditional mount** presented
as a sheet (rounded top, sheet chrome), mirroring how `StartArgumentPage` already
conditional-mounts — **not** an RN `Modal` and **not** a new nav dep (expo-rn-patterns:
try primitives first). Wiring:

- **Flag OFF:** nothing changes. `startArgumentOpen` only reaches the *existing*
  `StartArgumentPage` through `ConversationGalleryScreen`'s `showCreate` exactly as today
  (lane is never `'home'` when the flag is off, so the gallery block always renders). The
  `StartArgumentPage.tsx` file is **untouched**; the existing suites stay green untouched.
- **Flag ON:** add ONE top-level branch in `App.tsx` that renders `StartArgumentSheet` when
  `homeV2Enabled && startArgumentOpen` (guarded to `activeTab === 'arguments' && !hasDebate
  && !notificationsOpen && !aboutOpen && !demoCorridorOpen`), placed to take precedence over
  both the `ArgumentHome` and gallery blocks. Change the gallery prop from
  `showCreate={startArgumentOpen}` to `showCreate={startArgumentOpen && !homeV2Enabled}`,
  so under flag-on ALL start entries (Home's "+ Start an argument" — already wired
  `onStart={() => setStartArgumentOpen(true)}` at `App.tsx:976`; and the gallery's
  "+ New room") open the new sheet, and the old page never co-renders. When the flag is
  OFF, `!homeV2Enabled` is `true`, so `showCreate` evaluates identically to today — the
  rendered output is unchanged.

**Flag ownership / allowlist:** the flag read stays in `App.tsx` (the nav seam, already the
*sole* allowlisted consumer per `featureFlagsStaticEnv.test.ts:112`). `StartArgumentSheet`
and the picker are presentational — they **do not import `featureFlags`** — so the positive
allowlist test needs **no change** (STEP 2 question resolved: App.tsx does the gating).

### 3. Creation contract — byte-identical via the single decision function

The sheet's submit is structurally identical to `StartArgumentPage.handleSubmit`
(`StartArgumentPage.tsx:198–254`). The picker (recent row *or* typed field) produces a
single `inviteEmail` **string**; the sheet feeds it through the *same*
`deriveArgumentRoomCreation({ visibility, directInviteEmails: inviteEmail.trim().length > 0
? [inviteEmail] : [] })` call, and builds `CreateDebateInput` from **its** outputs:

```ts
const input: CreateDebateInput = {
  title: pickDisplayTitle({ rootBody: trimmed }),   // same helper
  resolution: trimmed,                               // same
  description: '',                                   // same
  visibility,                                        // same
  ...(creation.normalisedDirectInviteEmail
    ? { invite: { email: creation.normalisedDirectInviteEmail } }
    : {}),                                           // same
};
```

`deriveArgumentRoomCreation` remains **the** single creation decision function — zero forked
validity/capacity logic. Private + exactly-one-invite stays the default; the one-time
invite-link success box (ARG-ROOM-008, `StartArgumentPage.tsx:279–331`) is reused verbatim
(same `ARGUMENT_ROOM_CREATE_COPY.invite_link_*` + `INVITE_PANEL_COPY` constants). The
`onCreate` prop is the same `useDebates().create` → `createDebate` → `createArgumentRoom`
chain, so the `supabase.functions.invoke('create-argument-room', { body })` request body is
identical by construction. **Contract test** (the load-bearing test of the card) constructs
equivalent inputs for the old page path and the new sheet path and asserts the produced
`CreateDebateInput` objects are `toEqual` deep-equal.

### 4. START-003 mount contract — the Advanced slot + visibility owner

`StartArgumentSheet` **owns** the two pieces START-003 needs and exposes a typed slot:

- **Visibility state owner:** the sheet holds `const [visibility, setVisibility] =
  useState<RoomVisibility>('private')` and `const [advancedExpanded, setAdvancedExpanded] =
  useState(false)`. Default is always `'private'`. Selecting **"No one — open floor"** sets
  `advancedExpanded = true` and **leaves `visibility` at `'private'`** (public is OFF by
  default even here, per Design Pass J4) — flipping to public is START-003's ceremony.
- **Slot:** inside the collapsed Advanced `<View testID="start-sheet-advanced">`, the sheet
  renders `props.renderPublicToggle?.(slotProps) ?? null`. START-003 owns
  `PublicArgumentToggle.tsx` and supplies the render-prop at the `App.tsx` mount; if it is
  not yet wired the sheet still compiles and the slot is empty. This decouples the two files
  in the shared branch (START-001 owns the slot *type* + placement + state; START-003 owns
  the toggle component + the two-tap ceremony).

**`PublicToggleSlotProps` (what the sheet passes into the slot):**

| Prop | Type | Meaning |
|---|---|---|
| `visibility` | `RoomVisibility` | Current sheet visibility (owned above). |
| `onChange` | `(v: RoomVisibility) => void` | START-003 calls `onChange('public')` **only after** its own second explicit confirm; `onChange('private')` to revert. |
| `capacityPreview` | `ArgumentRoomCreationDerived` | Result of `deriveArgumentRoomCreation` for a public/no-invite preview, so the consequences copy (`fillArgumentRoomCapacityCopy`, `ROOM_VISIBILITY_COPY`) is fed real seat numbers — never inline prose. |
| `expanded` | `boolean` | `advancedExpanded`; START-003 may use it to focus the toggle on expand. |

START-001 leaves the toggle/ceremony **entirely** to START-003 (non-goal: no PublicArgumentToggle here).

### 5. Slices

- **S1 — pure model (fully unit-tested):** `personArgumentPickerModel.ts` (`PersonTarget`,
  `deriveRecentOpponents`, `personTargetToCreationIntent`, `orderPickerRows`, open-floor-last
  invariant, ban-list tokens) + `recentOpponentsApi.ts` (the RLS-scoped read; thin, tested
  with a mocked supabase client). No React.
- **S2 — sheet + picker UI:** `StartArgumentSheet.tsx`, `PersonArgumentPicker.tsx`,
  `useRecentOpponents.ts`. RNTL suites (J3, J4-partial, empty-recents).
- **S3 — flag wiring + flag-off proof:** `App.tsx` mount branch + gallery `showCreate`
  gate; `index.ts` exports; flag-off byte-identical test.

### 6. Circles + other non-goals

**Circles are OMITTED from START-001's rendered UI** (not shown greyed). Justification: no
client read path exists (`useCircles`/`circlesApi` are out of scope), so a
"Circles — coming soon" row would be dead UI that fails the actionable-state bar and risks
reading as a broken control. The picker **model reserves the slot** — `PersonArgumentPicker`
accepts a `circles: CircleOption[]` prop defaulting to `[]`, and `orderPickerRows` already
positions circles between recents and e-mail — so **START-002** (#839, additive `circle_id`
audience) plugs in data with no model or ordering change. Also out of scope: START-003's
toggle/ceremony, START-002's `circle_id` creation path, notification changes, any router.

---

## File-by-file change list (with anchors + line estimates)

**New files**

- `src/features/arguments/startArgument/personArgumentPickerModel.ts` (~180 lines) — pure
  model: types above + `deriveRecentOpponents` / `personTargetToCreationIntent` /
  `orderPickerRows` + `_forbiddenPersonPickerTokens()` for the ban-list test. No React,
  no Supabase.
- `src/features/arguments/startArgument/recentOpponentsApi.ts` (~55 lines) —
  `listRecentOpponentInvites(userId): Promise<RecentInviteRow[]>`. The single RLS-scoped
  `argument_room_invites` read; `SUPABASE_CONFIGURED` guard; returns `[]` on error (recents
  are optional — never block the sheet).
- `src/features/arguments/startArgument/useRecentOpponents.ts` (~45 lines) — hook wrapping
  the api (loading / error / `RecentOpponent[]`), mirrors `useGalleryArguments` shape.
- `src/features/arguments/startArgument/PersonArgumentPicker.tsx` (~230 lines) — the
  searchable list (recents chips → [circles slot, empty] → e-mail field → open-floor row).
- `src/features/arguments/startArgument/StartArgumentSheet.tsx` (~330 lines) — who → what →
  advanced sheet; wraps the ARG-ROOM-008 success box + submit verbatim.

**New tests**

- `__tests__/personArgumentPickerModel.test.ts` (~30 cases)
- `__tests__/startArgumentSheetCreationContract.test.ts` (the load-bearing deep-equal test)
- `__tests__/personArgumentPicker.test.tsx` (RNTL: ordering, empty-recents, invalid e-mail)
- `__tests__/startArgumentSheet.test.tsx` (RNTL: J3, J4-partial, private-default copy)
- `__tests__/startArgumentSheetFlagOff.test.tsx` (flag-off byte-identical / old-page-only)

**Modified files**

- `App.tsx` — add the `StartArgumentSheet` top-level mount branch (~18 lines); change the
  gallery `showCreate` prop to `startArgumentOpen && !homeV2Enabled` (1 line). No new
  `featureFlags` import (already imported). Flag read stays here.
- `src/features/arguments/startArgument/index.ts` — export `StartArgumentSheet`,
  `PersonArgumentPicker`, and the model types/functions (~8 lines).
- `src/features/arguments/gameCopy.ts` — add a frozen `START_SHEET_COPY` group with the new
  person-first strings (see Copy plan). ~20 lines. `HOME_COPY` (`gameCopy.ts:1466`),
  `ROOM_VISIBILITY_COPY` (`:1705`), `ARGUMENT_ROOM_CREATE_COPY` capacity keys (`:1920`) are
  reused, not duplicated.
- `__tests__/gameCopy.test.ts` — import `START_SHEET_COPY` and add it to the scanned copy
  groups (the ban-list `it('no copy group contains forbidden terms')` at `gameCopy.test.ts:34`).

**Deleted files:** none — the old `StartArgumentPage` stays mounted one release (flag-off path).

---

## API / interface contracts

```ts
// StartArgumentSheet.tsx
interface StartArgumentSheetProps {
  /** SAME existing creation path the page uses (useDebates().create). */
  onCreate: (input: CreateDebateInput) => Promise<CreatedRoom | null>;
  /** Landing hand-off after create (mirror onCreatedWithSurface). */
  onCreated?: (debate: Debate, surface: StartArgumentSurface) => void;
  onCancel: () => void;
  /** Recent-opponent data (from useRecentOpponents at the App.tsx mount). */
  recents: RecentOpponent[];
  recentsLoading?: boolean;
  /** START-002 slot — [] in START-001. */
  circles?: CircleOption[];
  /** START-003 slot — the PublicArgumentToggle. Undefined => empty Advanced. */
  renderPublicToggle?: (props: PublicToggleSlotProps) => React.ReactNode;
}

// PersonArgumentPicker.tsx
interface PersonArgumentPickerProps {
  value: PersonTarget | null;
  onChange: (target: PersonTarget) => void;
  recents: RecentOpponent[];
  circles?: CircleOption[];                 // default []
  /** Inline validation copy for the typed e-mail (from the creation matrix). */
  emailReason?: string | null;
}
```

- `recentOpponentsApi.listRecentOpponentInvites(userId: string): Promise<RecentInviteRow[]>`
- `useRecentOpponents(userId: string | null): { recents: RecentOpponent[]; loading: boolean; error: string | null; refresh(): void }`
- Reused verbatim: `deriveArgumentRoomCreation`, `plainLanguageForCreationReason`,
  `fillArgumentRoomCapacityCopy`, `ROOM_VISIBILITY_COPY`, `ARGUMENT_ROOM_CREATE_COPY`,
  `pickDisplayTitle`, `normaliseInviteeEmail`, `maskInviteeEmail`, `InitialsAvatar`
  (`{ displayName, seed, size }`).

---

## Edge cases

- **Empty recents (first-run):** actionable empty state — the e-mail field is the primary
  affordance; copy invites typing an address. Never a dead "no recents" dead-end.
- **Recents read fails / offline:** `listRecentOpponentInvites` returns `[]`; the sheet
  renders with e-mail + open-floor only. Recents are an accelerator, never a gate.
- **Same e-mail in recents twice (multiple past rooms):** `deriveRecentOpponents` dedupes by
  `invitee_email_lower`, keeping the newest `created_at`.
- **Same person in recents *and* a (future) circle:** `orderPickerRows` dedupes across
  sources by e-mail so a person shows once (recents win, being higher priority).
- **Invalid typed e-mail:** the picker surfaces `plainLanguageForCreationReason('invalid_email')`
  inline (same amber explainer as the page); submit stays disabled — matrix-owned, never a
  bespoke regex.
- **Multi-address paste in the e-mail field:** `deriveArgumentRoomCreation` returns
  `too_many_direct_invites` → the specific plain-language line (not a generic invalid-email),
  exactly as today.
- **Pick a person, then switch to open floor:** visibility reverts to `'private'` unless
  START-003's toggle is flipped + confirmed; the prior invite string is cleared from the
  creation intent so no stale invite rides a public create.
- **Open floor selected but toggle never confirmed:** `visibility` stays `'private'` and
  `directInviteEmails` is empty → `deriveArgumentRoomCreation` returns
  `private_requires_invite` → submit disabled with the matrix's plain-language reason (public
  is genuinely unreachable in < 2 explicit taps — the J4 invariant).
- **Concurrent create / double-tap submit:** the same `submitting` guard as the page; the
  disabled state + guard clause prevent a second invoke.
- **Permission-denied on create (Edge refuses):** `onCreate` resolves falsy / throws → the
  same neutral `submitError` copy; the sheet stays open, nothing is lost.
- **Doctrine edge — heat/popularity:** the picker orders recents strictly by
  **recency of invite** (`created_at`), never by heat, engagement, or any popularity signal.
  Recency is a structural fact, not a ranking of people.

---

## Test plan

- `__tests__/personArgumentPickerModel.test.ts` — `deriveRecentOpponents` (dedupe, sort,
  cap, masked form); `personTargetToCreationIntent` for all three kinds; `orderPickerRows`
  fixed order + **open-floor-last invariant**; cross-source dedupe (recents vs circle);
  `PersonTarget` shape guards; ban-list scan of `_forbiddenPersonPickerTokens()`.
- `__tests__/startArgumentSheetCreationContract.test.ts` — **the load-bearing test**:
  for matched inputs (visibility, invite e-mail, declaration, framing defaults) the sheet's
  produced `CreateDebateInput` is `toEqual` deep-equal to what `StartArgumentPage`'s submit
  produces; assert `deriveArgumentRoomCreation` is the sole normaliser (invite email ===
  `creation.normalisedDirectInviteEmail`).
- `__tests__/startArgumentSheet.test.tsx` (RNTL) — **J3**: pick recent → type point →
  Start → `onCreate` called with the private+1-invite payload → ARG-ROOM-008 link box shown
  when a link is returned → Continue hands off. Assert the "Private — just you and <name>"
  copy renders. **J4-partial**: open-floor row is last + visually distinct; selecting it
  expands Advanced; visibility stays private; submit blocked until the (injected stub)
  toggle confirms public — proving public needs ≥ 2 explicit taps.
- `__tests__/personArgumentPicker.test.tsx` (RNTL) — source order (recents → e-mail →
  open-floor); empty-recents actionable state; invalid-email inline reason; rows ≥ 52px;
  `accessibilityRole` on every pressable row.
- `__tests__/startArgumentSheetFlagOff.test.tsx` — with `home_v2` OFF, the sheet branch is
  not mounted and `ConversationGalleryScreen` renders the existing `StartArgumentPage`
  (byte-identical path).
- **Source-scan tests** (add to a new picker source-scan test or extend
  `roomVisibilityModel.sourceScan.test.ts` idiom): no `from('profiles')` search/`ilike` in
  any new picker file; consequences/capacity copy referenced from `gameCopy` constants only.
- **Regression (must stay green untouched):** `__tests__/StartArgumentPage.test.tsx`,
  `__tests__/startArgumentInviteLinkBox.test.tsx`,
  `__tests__/startArgumentVisibilityInvite.test.tsx`,
  `__tests__/startArgumentFramingDisclosure.test.tsx`,
  `__tests__/argumentRoomCreationMatrix.test.ts`, all four `roomVisibilityModel.*` suites.
- **Ban-list:** `__tests__/gameCopy.test.ts` extended to scan `START_SHEET_COPY`.

**Expected test delta vs baseline (905 suites / 32,978 tests):** ~ +5 suites, ~ +70–90
tests. The implementer MUST capture the actual `Test Suites: X passed … / Tests: Y passed …`
line with exit code 0 and record it in `current-status.md`; this design does not assert a
final absolute count.

---

## Dependencies (cards / docs / files)

- **Assumes complete:** ASP-FLAGS-001 (#873 — `home_v2` flag + `isHomeV2Enabled`, present at
  base `e3d2819`); HOME-001 (#874 — `ArgumentHome` with `onStart` at `App.tsx:976`, the
  sheet's entry point); ARG-ROOM-002/003/008 (creation matrix + Edge + link box, all shipped).
- **Reads existing:** `deriveArgumentRoomCreation` (`argumentRoomCreationMatrix.ts`),
  `createDebate`/`createArgumentRoom` (`debatesApi.ts`), the `ari_select_inviter_own` RLS
  policy (`20260524000013_…invites.sql`), `InitialsAvatar` (`account/InitialsAvatar.tsx`),
  `inviteModel` mask/normalise helpers, `gameCopy` copy constants.
- **Shares the branch with START-003** (`feat/start-001-003-person-first`): START-001 owns
  the sheet skeleton + Advanced slot type + visibility state; START-003 supplies
  `PublicArgumentToggle` via the `renderPublicToggle` slot. Do not edit `START-003.md` or
  `PublicArgumentToggle.tsx`.
- **Unblocks:** START-002 (#839 — additive `circle_id` audience fills the reserved circles
  slot). Independent of the voice gate (survives a NO on VOICE-ADR-002 D1).

---

## Risks

- **Scope-creep to user search (the named hazard).** Guarded three ways: (1) the recents
  read is `argument_room_invites` scoped to `invited_by = auth.uid()` — structurally
  incapable of enumerating others; (2) circles are omitted, not a search box; (3) a
  source-scan test bans any `from('profiles')` search/`ilike` in new picker files. E-mail
  entry is the only path to strangers — by design, not omission.
- **App.tsx anchor drift.** The mount branch depends on the exact `homeV2Enabled` /
  `startArgumentOpen` / `galleryLane` / `activeTab` guards around `App.tsx:957–1058`. If
  those anchors move, the branch guard must be re-derived. The implementer must re-read that
  region before editing (it changed under HOME-001 recently).
- **`deriveStarterDisplay` is synthetic.** Recents display a masked e-mail, not a name/avatar
  of the real person (no display-name plumbing exists). This is honest but less rich than the
  Design Pass mock's avatar chips; richer identity is deferred until a peer display-name read
  is designed (out of scope here). Flagged in the ledger.
- **Copy scanning.** New `START_SHEET_COPY` must be added to `gameCopy.test.ts`'s scanned
  groups or the ban-list gains a blind spot. Called out in the file list.
- **Comment hygiene for scanned files.** `gameCopy.ts` and `roomVisibilityModel` sit under
  ban-list/source-scan tests; any new code comment in a scanned file must be **apostrophe-free**
  (the naive quote-parity scanner gotcha) — do not write `don't`/`viewer's` in those comments.
- **Recents privacy display.** Show the **masked** e-mail (`maskInviteeEmail`) in the UI;
  carry the full e-mail only in the `PersonTarget`/create payload. Never render a full
  invitee address in the list (consistent with `summariseInviteForInviter`).

---

## Out of scope

- START-003's `PublicArgumentToggle` and the public two-tap ceremony (this card provides only
  the slot + visibility owner).
- START-002's `circle_id` creation audience and any circle read path (`useCircles`/`circlesApi`).
- Any change to `create-argument-room`, its RPC, the capacity trigger, or any migration/RLS.
- A `user_id`-based invite path (the create path stays e-mail-only).
- Peer `profiles` display-name / avatar plumbing; global user search / directory.
- Notification changes, router introduction, HOME/ROOM/composer/voice/taxonomy redesign.
- Weakening the one-way visibility rule (`roomVisibilityModel.ts`) or QOL-039 invariants —
  START-001 only sets *initial* visibility at creation and never transitions, so the one-way
  rule is untouched by construction.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the picker labels
  people only as *invitees* (an address), never with judgment; no verdict/standing token
  anywhere; no scoring surface exists here. Submission is gated only by the deterministic
  creation matrix, never by score.
- **§2–§3 (heat/popularity ≠ signal):** recents are ordered by invite recency (structural),
  never by heat, engagement, view/follower counts. No popularity input touches ordering.
- **§4/§7 (AI limits; no AI from the app):** no AI/classifier/MCP call on any path — room
  creation stays behind `deriveArgumentRoomCreation` + the existing Edge Function.
- **§6 (secrets) / no service-role in client:** the one new read is anon-keyed PostgREST
  under `ari_select_inviter_own`; no service-role, no key material, no Edge Function.
- **§8 (RLS / migrations):** no migration, no RLS change; the read relies on an existing
  policy cited by name.
- **§9 (plain language):** invalid-email + capacity + consequences copy all route through the
  shipped `plainLanguageForCreationReason` / `ARGUMENT_ROOM_CREATE_COPY` / `ROOM_VISIBILITY_COPY`
  — no raw codes echoed. New strings live in a `START_SHEET_COPY` group covered by the
  ban-list test.
- **§10 (v1 scope — no OAuth, no search):** person-first start adds **no** user search and
  **no** directory; e-mail is the only reach-a-stranger path. Private-by-default is
  strengthened; public is the deliberate two-tap exception.
- **accessibility-targets:** picker rows ≥ 52px (Design Pass) and ≥ 44px hit targets;
  `accessibilityRole="button"`/`"radio"` + `accessibilityState` + labels on every pressable;
  color-independent selection (● / ○ glyph + weight, matching the page's pattern);
  reduce-motion safe (Advanced disclosure is a conditional mount, no animation); verified at
  the 390px band via existing breakpoints. Screen-reader label for a recent row names the
  masked address + "recent" provenance, never a verdict.

---

## Operator steps (if any)

**None — pure code change.** No migration (`db push`), no Edge Function deploy. The card
ships with `home_v2` **OFF**; to preview the new start flow the operator sets
`EXPO_PUBLIC_HOME_V2=true` (already the HOME-001 gate) — not a START-001-specific step.

---

## Orchestrator-authored brief interpretation ledger

This design was authored from an orchestrator-provided brief + Design Pass, not a fully
operator-validated brief. Where designer judgment substituted for explicit operator
direction:

- **Derived from prior Phase framing / shipped code (source-of-truth chain):** the mount
  seam (App.tsx `home_v2` gate + `onStart`), the creation-path reuse, the ARG-ROOM-008 link
  box, and the `home_v2` flag gate are all read directly from the shipped code at base
  `e3d2819`.
- **Resolved by scope-reality audit (designer judgment over the brief's literal text):**
  the **recents source is `argument_room_invites` (viewer's own sent invites), not
  `debate_participants`.** The brief's literal "debate_participants co-participation rows"
  cannot produce an invitable identity under the shipped e-mail-only create path + RLS; the
  invites source realizes the brief's *intent* while staying strictly viewer-scoped. **This
  is the primary item for operator review.**
- **Resolved by designer default:** circles are **omitted** (not greyed) in START-001 while
  the model reserves the slot; recents **display masked e-mails** (no real name/avatar,
  because no peer display-name read is plumbed); recents cap = 8, read `limit` = 50.
- **Operator-deferred review:** (1) confirm the invites-based recents source is acceptable
  product-wise (vs. waiting for a peer display-name/identity read); (2) confirm masked-email
  recents chips are acceptable UX vs. the Design Pass's avatar-chip mock; (3) confirm circles
  omission (vs. a disabled "coming soon" row).
