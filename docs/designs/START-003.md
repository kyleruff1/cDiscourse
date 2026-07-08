# START-003 — Public room two-tap ceremony with consequences preview

**Status:** Design draft
**Epic:** ASP-000 (#826) — Argument Surface program · Lane ux (start ceremony) · Phase 1 · Milestone M-ASP-1
**Release:** Ships behind `home_v2` in the START-001 PR lane (`feat/start-001-person-picker`, flag OFF, old page kept one release)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/875

---

## Goal (one paragraph)

Public is a deliberate mode, never a default (Design Pass §2 principle 3; already law at `StartArgumentPage.tsx:127-131`). Today the create surface offers Public/Private as a flat radio pair — a *single* tap (`fireEvent.press(start-argument-visibility-public)`) flips the room public. START-003 replaces that one-tap flip, inside the NEW person-first start sheet (START-001), with a deliberate ceremony: a `PublicArgumentToggle` that is OFF by default in every entry path, that on flip renders a consequences preview sourced only from existing choke points (`fillArgumentRoomCapacityCopy` + `ROOM_VISIBILITY_COPY`), and that requires a SECOND explicit confirm ("Make it public") before the creation payload may carry `visibility: 'public'`. The doctrine constraint that shapes the whole design is: **a room can never become public with fewer than two deliberate taps** (issue AC; Design Pass §4 J4). The design guarantees this structurally by routing the "what visibility does create receive?" decision through a pure model that returns `'public'` for exactly one state — `public_confirmed` — reachable from the default only via `flip_on` then `confirm`. The creation matrix (`deriveArgumentRoomCreation`), the one-way public→private rule (`roomVisibilityModel.ts`), and the seat model (`oneToOneRoomModel.ts`) are all consumed verbatim; this card adds no data model, no Edge change, no migration.

---

## Interface contract with START-001 (numbered ASSUMPTIONS the implementer MUST reconcile)

A second designer is authoring `docs/designs/START-001.md` (the StartArgumentSheet + PersonArgumentPicker) concurrently. `PublicArgumentToggle` is designed **mount-agnostic** — a self-contained controlled component with a narrow props contract — so it survives reasonable differences in the sheet skeleton. Before coding, the implementer MUST reconcile each assumption below against the FINAL START-001 design. Where the sheet differs, the fix is on the wiring side (how the sheet passes props / reads `onChange`), never inside `PublicArgumentToggle` itself.

- **A1 — Advanced-section slot.** The sheet exposes an "Advanced" section that can host arbitrary child content (a render slot / children). `PublicArgumentToggle` mounts there. START-003 does NOT assume a specific slot prop name or testID — it assumes only that *some* mount point exists inside Advanced. Reconcile the exact insertion point with START-001.
- **A2 — Open-floor auto-expand, never auto-flip.** Selecting "No one — open floor" in `PersonArgumentPicker` causes the SHEET to auto-expand the Advanced section. It MUST NOT touch the toggle's state. The toggle owns its own OFF-default; the sheet owns section expansion. (AC: "Toggle remains OFF immediately after selecting 'No one — open floor'.")
- **A3 — Visibility state ownership.** The SHEET owns the committed `visibility: RoomVisibility` value it threads into `deriveArgumentRoomCreation` and `CreateDebateInput`. `PublicArgumentToggle` is a controlled component: it receives `visibility` (for init/reset) and emits committed changes via `onChange`. The transient `previewing_public` state lives INSIDE the toggle and is never represented in the sheet's `visibility` (which is only `'public' | 'private'`).
- **A4 — `onChange` is the only channel that can produce `'public'`.** The sheet MUST derive the visibility it sends to create from the value delivered by `PublicArgumentToggle.onChange` — and from nothing else. The toggle emits `onChange('public')` ONLY on the confirm transition. If START-001 instead reads visibility from some other signal (e.g., the picker's open-floor selection), that is a two-tap-invariant violation and must be corrected to route through `onChange`.
- **A5 — capacityPreview is validator-derived.** For the open-floor path the sheet passes `directInviteEmails: []` to `deriveArgumentRoomCreation({ visibility: 'public', directInviteEmails: [] })` and hands the toggle `capacityPreview = { capacity: derived.capacity, open: derived.openSlots, reservedInviteSeats: derived.reservedInviteSeats }`. The cap number (5) and open count (4) come from the validator, never a literal. (Mirrors `StartArgumentPage.tsx:173-184`.)
- **A6 — Creation path is verbatim.** The sheet's create flow is the EXISTING `deriveArgumentRoomCreation → onCreate(CreateDebateInput)` path (identical to `StartArgumentPage.handleSubmit`). START-003 changes nothing in the matrix or the create call; it only governs which `visibility` the sheet holds.
- **A7 — Default visibility is `'private'`.** The sheet initializes `visibility` to `'private'` (matches `StartArgumentPage.tsx:131`). The toggle's mount initializer maps `'private' → private` internal state, `'public' → public_confirmed`. On a fresh/re-opened sheet the default is always `'private'`.
- **A8 — Flag gating lives in the sheet.** START-001 gates the sheet behind `home_v2` (`isHomeV2Enabled()`, `src/lib/featureFlags.ts`). `PublicArgumentToggle` carries NO flag check itself; flag-OFF simply means the sheet (and therefore the toggle) never mounts, and the legacy `StartArgumentPage` flat-radio path is byte-identical.
- **A9 — Sheet re-open resets to private.** When the sheet is dismissed and re-opened, START-001 remounts the toggle (or resets `visibility` to `'private'`). Either path yields the `private` internal state (fresh mount → initializer; prop reset → the reset effect in §Component spec). No stale `public_confirmed` survives a re-open. (AC: "sheet re-open" cannot yield a public payload without both taps.)
- **A10 — Submit gating is the sheet's, and the matrix already enforces it.** In the open-floor path, while the toggle is `private`/`previewing_public` the resolved visibility is `'private'` and there is no invite, so `deriveArgumentRoomCreation` returns `valid: false` (`private_requires_invite`) and the sheet's submit stays disabled. Only after `confirm` does visibility become `'public'`, making `public + no invite` valid and enabling submit. START-003 relies on this existing behavior; it does not add its own submit gate. (See Risks for the open-floor disabled-reason copy nuance.)

If START-001's final design contradicts A3/A4 (visibility not routed through `onChange`), the implementer MUST stop and surface it — that pairing is the load-bearing guarantee of the two-tap invariant.

**Sequencing fallback (toggle before the sheet exists):** `PublicArgumentToggle` is self-contained enough to also be mounted in today's `StartArgumentPage` if the implementer sequences START-003 before START-001 lands. If so, it MUST be mounted behind `home_v2` and must NOT disturb the flag-OFF flat-radio path that `__tests__/startArgumentVisibilityInvite.test.tsx` pins (that suite renders `StartArgumentPage` with no flag and asserts the flat radio). Wiring the toggle into the legacy page is **out of scope** for this card's primary plan (see Out of scope); the mount-agnostic contract exists so the option survives, not because the card exercises it.

---

## Data model

**No new data model.** No new TypeScript persisted type, no SQL, no migration, no Edge Function, no RLS. The card adds:

- One pure-TS UI state enum (`PublicToggleState`) and its transition function — an in-component state machine, not a persisted shape.
- One additive frozen copy block (`PUBLIC_ARGUMENT_TOGGLE_COPY`) in `gameCopy.ts`.

The room that results from a confirmed-public creation is an ordinary public `debates` row created by the unchanged `create-argument-room` path; its `public_respondent_seat_open` display state is derived at room-load time by the EXISTING `deriveRoomOneToOneDisplayState` (`oneToOneRoomModel.ts`) — public + `opponentSeatIsOpen === true`. No new deriver.

---

## Design decisions (the six explicit decisions)

### 1. State machine

```
PublicToggleState = 'private' | 'previewing_public' | 'public_confirmed'
PublicToggleEvent = 'flip_on' | 'flip_off' | 'confirm' | 'dismiss'
```

Transition table (all cells defined; unspecified events are no-ops that return the same state):

| from \ event        | flip_on            | flip_off  | confirm            | dismiss   |
|---------------------|--------------------|-----------|--------------------|-----------|
| `private`           | `previewing_public`| `private` | `private`          | `private` |
| `previewing_public` | `previewing_public`| `private` | `public_confirmed` | `private` |
| `public_confirmed`  | `public_confirmed` | `private` | `public_confirmed` | `private` |

Key properties:
- **No single event from `private` reaches `public_confirmed`.** The only path is `private --flip_on--> previewing_public --confirm--> public_confirmed` (exactly two events).
- **Retreat paths exist at both steps:** `flip_off` (switch back off) and `dismiss` ("Keep it private") from `previewing_public` OR `public_confirmed` return to `private`.
- The create payload carries `'public'` from `public_confirmed` ONLY:

```
resolveCreationVisibility(state): RoomVisibility =
  state === 'public_confirmed' ? 'public' : 'private'
```

`private` and `previewing_public` both resolve to `'private'`. This is the single choke point the two-tap proof pins.

### 2. Consequences preview content (choke-point sourced only)

On `previewing_public` (and `public_confirmed`) the component renders a consequences panel of **exactly two stacked bullets**, each its own `<Text>` (no prose concatenation), sourced only from existing `gameCopy.ts` choke points:

1. **Visibility bullet** — `ROOM_VISIBILITY_COPY.option_public_helper`
   → "A public 1:1 — anyone can find, read, and observe this argument. Point-scoped chime-ins may open once both seats are filled."
2. **Capacity bullet** — `fillArgumentRoomCapacityCopy(template, { capacity, open })` where `template = ARGUMENT_ROOM_CREATE_COPY.capacity_public_reserved` when `capacityPreview.reservedInviteSeats === 1`, else `ARGUMENT_ROOM_CREATE_COPY.capacity_public_open`.
   For open-floor (no invite → `reservedInviteSeats: 0`) this is `capacity_public_open` filled with the validator's numbers → "Up to 5 people can take an active seat. 4 stay open for the first to reply. Readers can watch without using a seat."

No new *consequence* copy is authored. The cap/open numbers are the validator's (`deriveArgumentRoomCreation`), never literals. **Deliberately NOT shown:** any public→private one-way transition copy — that rule (`roomVisibilityModel.ts` `effect_one_way`) describes an in-room visibility change and is out of scope at creation time; surfacing it here would be misleading and would pull `roomVisibilityModel` transition copy into a creation surface it does not govern.

### 3. Two-tap proof (design of the tests that make a <2-tap public payload impossible)

The proof is layered so it holds at the model level (unit) AND the rendered level (RNTL):

1. **Transition invariant (unit):** for EVERY `PublicToggleEvent e`, `nextPublicToggleState('private', e) !== 'public_confirmed'`. Proves no single event from the default reaches confirmed.
2. **Resolve invariant (unit):** `resolveCreationVisibility(s) === 'public'` iff `s === 'public_confirmed'`; `=== 'private'` for `private` and `previewing_public`. Iterate all three states.
3. **Minimal-path length (unit):** enumerate reachability — assert no length-1 event sequence from `private` yields `public_confirmed`, and that `[flip_on, confirm]` (length 2) does. This is the literal "fewer than two deliberate taps is impossible" assertion.
4. **`onChange` emission invariant (RNTL):** render `PublicArgumentToggle` with an `onChange` spy. Fire the switch once (one tap). Assert `onChange` was NEVER called with `'public'` (it emits `'private'` — the resolved value is still private). Assert the consequences panel is visible. Then fire the confirm control (second tap) and assert `onChange('public')` fires exactly once.
5. **Sheet-analog negative (RNTL):** a tiny in-test harness component wraps the toggle, records the latest `visibility` delivered by `onChange`, and exposes a "create" button that reads that recorded value. After ONE tap (flip only), press create → recorded visibility is `'private'`. This models the AC "constructing sheet state with `visibility: 'public'` but no confirmed flag still produces a private creation request" — here it is structurally impossible for the harness to hold `'public'` after one tap because the toggle never emitted it.

### 4. Regression guarantee (suites that must pass unmodified)

START-003 touches NO file that these suites exercise (the matrix module, the legacy page, and the `ARGUMENT_ROOM_CREATE_COPY` block are all byte-unchanged), so all three stay byte-identical and green:

- `__tests__/argumentRoomCreationMatrix.test.ts` — pins `deriveArgumentRoomCreation`. Untouched: START-003 imports the matrix read-only and adds no reason code.
- `__tests__/startArgumentVisibilityInvite.test.tsx` — pins the legacy `StartArgumentPage` flat-radio + 8-cell submit matrix. Untouched: START-003 does not modify `StartArgumentPage.tsx`.
- `__tests__/argumentRoomCreateCopyDoctrine.test.ts` — scans `Object.values(ARGUMENT_ROOM_CREATE_COPY)` only (verified: line 25 `const NEW_COPY_VALUES = Object.values(ARGUMENT_ROOM_CREATE_COPY)`). The new `PUBLIC_ARGUMENT_TOGGLE_COPY` block is a SEPARATE export and is not swept into this suite, so it stays green unchanged.
- `__tests__/oneToOneRoomModel.test.ts` — pins `deriveRoomOneToOneDisplayState` incl. `public_respondent_seat_open`. Untouched: START-003 reuses the deriver and adds no new state.

Adding `PUBLIC_ARGUMENT_TOGGLE_COPY` to `gameCopy.ts` is purely additive (append a new `export const` block; edit no existing block), so no existing gameCopy consumer or scan changes behavior.

### 5. Component contract

`PublicArgumentToggle` (`src/features/arguments/startArgument/PublicArgumentToggle.tsx`) — controlled, self-contained, dark-surface (`SURFACE_TOKENS`).

```ts
interface PublicArgumentToggleProps {
  /** The sheet's committed visibility. Inits/resets internal state:
   *  'private' → private, 'public' → public_confirmed. */
  visibility: RoomVisibility;                 // 'public' | 'private'
  /** Emits the RESOLVED creation visibility on every committed change.
   *  'public' is emitted ONLY on the confirm transition. */
  onChange: (visibility: RoomVisibility) => void;
  /** Validator-derived numbers for the capacity bullet (never literals). */
  capacityPreview: { capacity: number; open: number; reservedInviteSeats?: 0 | 1 };
  /** Optional — disables the switch + confirm while the sheet is submitting. */
  disabled?: boolean;
}
```

Internal: `useState<PublicToggleState>` initialized from `visibility` (`'public' → public_confirmed`, else `private`); a `useEffect` resets internal to `private` when the `visibility` prop transitions to `'private'` externally (covers A9 sheet reset). Every user event calls `next = nextPublicToggleState(state, event)`, `setState(next)`, then `onChange(resolveCreationVisibility(next))`.

testIDs (stable):
- `public-argument-toggle` (container)
- `public-argument-toggle-switch` (the `Switch`)
- `public-argument-toggle-panel` (consequences panel; mounted only when state !== 'private')
- `public-argument-toggle-visibility-bullet`, `public-argument-toggle-capacity-bullet`
- `public-argument-toggle-status` (color-independent status text)
- `public-argument-toggle-confirm` ("Make it public"), `public-argument-toggle-cancel` ("Keep it private")

Confirm-chrome reuse: the panel mirrors the **pattern** of `MakePrivateConfirmation.tsx` — stacked bullet rows (`bulletDot` + `bulletText` `<Text>` pair), a two-button action row, calm non-scare wording — but is rendered **inline in the dark sheet**, NOT via `MakePrivateConfirmation` itself (that component is light-themed `#fff` and hard-bound to `ROOM_VISIBILITY_COPY.confirmation_*` + the `TransitionConsequences` shape for the make-private action). The switch primitive follows `PreferenceRow.tsx`'s `PreferenceToggleRow` (`<Switch accessibilityRole="switch" accessibilityState={{ checked }} />`).

A11y floor:
- Switch: `accessibilityRole="switch"`, `accessibilityState={{ checked: state !== 'private', disabled }}`, `accessibilityLabel` = `PUBLIC_ARGUMENT_TOGGLE_COPY.switch_label`, `accessibilityHint` = `switch_a11y_hint` (states that turning on shows a preview and confirmation is still required). The switch sits in a `minHeight: 44` row; confirm/cancel are `Pressable`s with `minHeight: 44` (+ `hitSlop`) and `accessibilityRole="button"`.
- **Color-independent states:** state is carried by structure + glyph text, not color — `private` = panel absent; `previewing_public` = panel present + status text `status_not_yet_public` ("Not public yet — confirm below."); `public_confirmed` = panel present + a `✓ ` glyph (its own `<Text>`) + status text `status_confirmed`. A grayscale snapshot stays legible.
- **Screen reader:** the two consequence bullets are plain `<Text>` (read verbatim); the confirm button label reads the action name (no color/shape dependency).
- **Reduce motion:** the panel appears/disappears via conditional mount (snap), no custom `Animated` — reduce-motion-safe by construction (mirrors the framing disclosure at `StartArgumentPage.tsx:489`). The platform `Switch` thumb animation is a system control (acceptable, like scroll inertia); no reduce-motion listener needed.

### 6. Non-goals (explicit)

- No change to the one-way public→private rule (`roomVisibilityModel.ts`, `MakePrivateConfirmation.tsx`) — creation-time only.
- No seat/capacity model change (`publicSeatModel.ts`, `oneToOneRoomModel.ts` reused read-only).
- No Edge Function or migration (`create-argument-room` contract untouched; `circle_id` is START-002, not here).
- No gallery / The Floor change — the created public room appearing on The Floor with the respondent seat open is EXISTING behavior once it is public (HOME-001 display side).
- No default change — private-by-default is strengthened, never eased.

---

## File changes

**New files**

- `src/features/arguments/startArgument/publicArgumentToggleModel.ts` — pure-TS state machine. Exports `PublicToggleState`, `PublicToggleEvent`, `ALL_PUBLIC_TOGGLE_STATES`, `nextPublicToggleState(state, event)`, `resolveCreationVisibility(state)`, `isPublicPreviewVisible(state)` (`=== state !== 'private'`), `isSwitchOn(state)`. No React, no Supabase, no gameCopy import (logic only). Type-only import of `RoomVisibility` from `../../debates/types`. ~90-120 lines.
- `src/features/arguments/startArgument/PublicArgumentToggle.tsx` — the controlled view described in Design decision 5. Imports the model, `ROOM_VISIBILITY_COPY`, `ARGUMENT_ROOM_CREATE_COPY`, `fillArgumentRoomCapacityCopy`, `PUBLIC_ARGUMENT_TOGGLE_COPY` from `../gameCopy`, and design tokens. ~190-240 lines.
- `__tests__/publicArgumentToggleModel.test.ts` — state-machine matrix + two-tap unit proof (decisions 3.1-3.3) + a `deriveRoomOneToOneDisplayState` reuse assertion (created-public-room fixture → `public_respondent_seat_open`). ~130-160 lines.
- `__tests__/PublicArgumentToggle.test.tsx` — RNTL: default OFF, flip→panel, one-tap-never-public + sheet-analog negative (decisions 3.4-3.5), confirm→public, retreat paths, bullet strings exact, a11y (switch role/state/checked, 44px confirm/cancel, color-independent glyph+status, reduce-motion conditional-mount). ~180-220 lines.
- `__tests__/publicArgumentToggleCopyDoctrine.test.ts` — ban-list scan over `Object.values(PUBLIC_ARGUMENT_TOGGLE_COPY)` (reuse `_forbiddenArgumentRoomCreationTokens()`), no snake_case leak, no account-enumeration token, all non-empty. ~60-80 lines. (Mirrors `argumentRoomCreateCopyDoctrine.test.ts`.)

**Modified files**

- `src/features/arguments/gameCopy.ts` — append ONE new frozen block `PUBLIC_ARGUMENT_TOGGLE_COPY` (see Copy plan). Purely additive — no existing block edited. ~25 lines. (Comments in this scanner-covered file MUST be apostrophe-free per the doctrine-scanner gotcha.)

**Deleted files** — none.

Optional (reconcile with START-001): if `src/features/arguments/startArgument/` gains a barrel `index.ts`, export `PublicArgumentToggle` from it; otherwise the sheet imports the component directly. Do not create a barrel speculatively.

---

## API / interface contracts

Pure model (`publicArgumentToggleModel.ts`):

```ts
export type PublicToggleState = 'private' | 'previewing_public' | 'public_confirmed';
export type PublicToggleEvent = 'flip_on' | 'flip_off' | 'confirm' | 'dismiss';
export const ALL_PUBLIC_TOGGLE_STATES: ReadonlyArray<PublicToggleState>;

export function nextPublicToggleState(state: PublicToggleState, event: PublicToggleEvent): PublicToggleState;
export function resolveCreationVisibility(state: PublicToggleState): RoomVisibility; // 'public' iff public_confirmed
export function isPublicPreviewVisible(state: PublicToggleState): boolean;           // state !== 'private'
export function isSwitchOn(state: PublicToggleState): boolean;                       // state !== 'private'
```

Component props: see Design decision 5. The sheet↔toggle contract is the numbered A1-A10 assumptions above; the single load-bearing pair is A3+A4 (visibility routed through `onChange`, `'public'` emitted only on confirm).

Reused read-only (no signature change): `deriveArgumentRoomCreation` / `ArgumentRoomCreationDerived` (`argumentRoomCreationMatrix.ts`); `deriveRoomOneToOneDisplayState` (`oneToOneRoomModel.ts`); `ROOM_VISIBILITY_COPY`, `ARGUMENT_ROOM_CREATE_COPY`, `fillArgumentRoomCapacityCopy` (`gameCopy.ts`).

---

## Edge cases

- **Empty / open-floor with toggle OFF.** Open-floor + `private` (default) + no invite → `deriveArgumentRoomCreation` returns `valid: false` (`private_requires_invite`) → sheet submit disabled. Correct: the only way open-floor produces a valid room is the two-tap public ceremony (or backing out to pick a person). START-003 relies on the existing matrix for this; it adds no gate.
- **Flip on, then flip off (retreat step 1).** `previewing_public --flip_off--> private`; `onChange('private')`; panel unmounts. No public payload.
- **Confirm, then flip off (retreat step 2).** `public_confirmed --flip_off--> private`; `onChange('private')`. A confirmed-public choice is fully reversible before create.
- **Dismiss from preview / confirmed.** "Keep it private" → `private`; same as flip_off.
- **Sheet re-open (A9).** Fresh mount initializes from `visibility='private' → private`; OR a prop reset to `'private'` triggers the reset effect. No stale `public_confirmed`. Cannot yield public without two fresh taps.
- **Programmatic / prop-injected `visibility: 'public'` without a confirm tap.** If the sheet mounts the toggle with `visibility='public'`, the initializer maps it to `public_confirmed` — but that only happens because the sheet already holds a committed public value, which it can only have obtained from a prior `onChange('public')` (i.e., a prior confirm). The toggle never fabricates `'public'` from a preview. The two-tap invariant is about *becoming* public within a session; a rehydrated already-public sheet is not a new <2-tap path.
- **Disabled while submitting.** `disabled` freezes the switch + confirm so a double-submit cannot re-transition mid-create.
- **Doctrine edge — "does heat/popularity influence the toggle?"** No. The consequences panel is static structural copy; nothing about engagement, virality, or standing enters the toggle, its copy, or its state. Visibility is an access property, never a verdict (`roomVisibilityModel.ts` doctrine).
- **Doctrine edge — "does the preview persuade?"** No urgency, countdown, or persuasion copy nudging the flip (AC + doctrine self-check). The switch helper states OFF-by-default plainly; the confirm is a neutral "Make it public".

---

## Test plan

- `__tests__/publicArgumentToggleModel.test.ts`
  - Transition matrix: every (state, event) cell returns the table value in Design decision 1.
  - Two-tap unit proof 3.1: `∀ e. nextPublicToggleState('private', e) !== 'public_confirmed'`.
  - Two-tap unit proof 3.2: `resolveCreationVisibility(s) === 'public'` iff `s === 'public_confirmed'`; `'private'` for the other two (iterate `ALL_PUBLIC_TOGGLE_STATES`).
  - Two-tap unit proof 3.3: no length-1 event path from `private` reaches `public_confirmed`; `[flip_on, confirm]` does.
  - Helpers: `isSwitchOn` / `isPublicPreviewVisible` true for `previewing_public` + `public_confirmed`, false for `private`.
  - Reuse assertion: `deriveRoomOneToOneDisplayState({ visibility: 'public', opponentSeatIsOpen: true })` === `'public_respondent_seat_open'` (created-public-room fixture; existing deriver, no new deriver) and `{ visibility: 'private', opponentSeatIsOpen: null }` === `'private_invited_access'`.
- `__tests__/PublicArgumentToggle.test.tsx` (RNTL)
  - Default render: switch `checked === false`, panel (`public-argument-toggle-panel`) absent.
  - Flip on: panel present; visibility bullet === `ROOM_VISIBILITY_COPY.option_public_helper`; capacity bullet === `fillArgumentRoomCapacityCopy(ARGUMENT_ROOM_CREATE_COPY.capacity_public_open, { capacity, open })` for the passed `capacityPreview`.
  - Two-tap proof 3.4: after one switch tap, `onChange` never called with `'public'`; after confirm, `onChange('public')` called once.
  - Sheet-analog negative 3.5: harness records latest `onChange` value; create after one tap → `'private'`.
  - Retreat: flip_off from preview and from confirmed both emit `'private'` and unmount the panel; "Keep it private" (`dismiss`) same.
  - A11y: switch `accessibilityRole==='switch'`, `accessibilityState.checked` tracks state; confirm + cancel `minHeight >= 44` and `accessibilityRole==='button'`; color-independent — `previewing_public` shows `status_not_yet_public`, `public_confirmed` shows the `✓` glyph + `status_confirmed` (assert the text nodes, not colors); reduce-motion — panel is a conditional mount (assert no `Animated` in the tree / snap show-hide).
  - `disabled` freezes switch + confirm.
- `__tests__/publicArgumentToggleCopyDoctrine.test.ts`
  - Ban-list: no value in `PUBLIC_ARGUMENT_TOGGLE_COPY` contains a `_forbiddenArgumentRoomCreationTokens()` token (verdict / person / amplification / `challenger` / `opponent`).
  - No snake_case internal-code leak; no account-enumeration token; all values non-empty strings.
- Regression pins (run unmodified, must stay green — Design decision 4): `argumentRoomCreationMatrix.test.ts`, `startArgumentVisibilityInvite.test.tsx`, `argumentRoomCreateCopyDoctrine.test.ts`, `oneToOneRoomModel.test.ts`.

**Expected test delta vs baseline (905 suites / 32,978 tests):** +3 new suites, approximately +40 to +48 tests. The implementer MUST capture the exact `Test Suites: … / Tests: …` line with a captured exit code 0 and record it in `current-status.md` (do not cite an estimate as the final count).

---

## Dependencies (cards / docs / files)

- **Depends on START-001** (StartArgumentSheet + PersonArgumentPicker, rewrite of #827) — the toggle mounts in its Advanced section; same PR 04 lane, `home_v2` flag. START-001 does not need to be complete to WRITE this design, but the wiring (A1-A10) must reconcile against START-001's final design before the implementer wires the toggle into the sheet.
- Reads `deriveArgumentRoomCreation` (`argumentRoomCreationMatrix.ts`) and `fillArgumentRoomCapacityCopy` / `ARGUMENT_ROOM_CREATE_COPY` (`gameCopy.ts`) for capacityPreview.
- Reads `ROOM_VISIBILITY_COPY` (`gameCopy.ts`) for the visibility bullet.
- Reads `deriveRoomOneToOneDisplayState` (`oneToOneRoomModel.ts`) for the created-room seat-derivation test (reuse).
- Follows `PreferenceRow.tsx` (`PreferenceToggleRow`) switch pattern and `MakePrivateConfirmation.tsx` confirm-chrome pattern (pattern only, not the light-themed component).
- HOME-001 supplies The Floor surface where the created public room appears (display side only; does not block this card's creation logic).

---

## Risks

- **START-001 skeleton drift.** If START-001's Advanced slot / visibility ownership diverges from A1-A10 (especially A3/A4), the wiring changes. Mitigation: the toggle is controlled + mount-agnostic; the two-tap guarantee lives in the pure model + the `onChange`-only-emits-public-on-confirm rule, which are independent of the sheet skeleton. If A3/A4 cannot hold, STOP and surface.
- **Open-floor disabled-reason copy nuance.** In the open-floor + toggle-OFF state, the matrix's disabled reason is `private_requires_invite` → "A private argument needs one invite so someone can join you." — slightly odd phrasing for an open-floor context. This is EXISTING copy owned by `argumentRoomCreationMatrix.ts` and is a START-001 UX concern, not START-003's to fix. Flag to the operator; do not change the matrix copy in this card (would break the byte-identical matrix regression pin).
- **Apostrophe-scanner gotcha in `gameCopy.ts`.** `gameCopy.ts` is scanner-covered; a stray apostrophe in a new comment can poison string parsing file-wide (see MEMORY: doctrine-scanner apostrophe gotcha). Author `PUBLIC_ARGUMENT_TOGGLE_COPY` comments apostrophe-free and run the doctrine suite pre-push.
- **RN `Switch` and `hitSlop`.** The platform `Switch` does not honor `hitSlop` the way `Pressable` does; guarantee the 44px target by placing the switch inside a `minHeight: 44` row (do NOT rely on `hitSlop` on the `Switch`). The confirm/cancel `Pressable`s use `minHeight: 44` directly.
- **Worktree write-slip.** Per MEMORY (worktree-agent Write slips to primary): after writing, verify the file is in the worktree and NOT in the primary checkout (`docs/designs/` is a real dir in both). Verification is part of this design task's close-out.

---

## Out of scope

- Wiring `PublicArgumentToggle` into the legacy `StartArgumentPage.tsx` (kept one release behind `home_v2`; the flat-radio path stays byte-identical and its regression suite untouched). The mount-agnostic contract exists as a capability, not a task.
- Any change to the one-way public→private rule, `MakePrivateConfirmation`, or in-room visibility transitions.
- Any change to the creation matrix, seat/capacity model, or `create-argument-room` Edge Function (incl. START-002's `circle_id` slice).
- The picker's open-floor selection UX, the Advanced-section expand behavior, and submit-button gating (all START-001).
- The Floor / gallery display of the created public room (HOME-001).
- Voice, proof drawer, marks, or any other ASP surface flag.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting; no service-role):** the toggle, its model, and its copy produce no verdict/winner/loser/true/false token (pinned by `publicArgumentToggleCopyDoctrine.test.ts` reusing `_forbiddenArgumentRoomCreationTokens()`). No score, no gating of posting — the only gate is the deterministic creation matrix, unchanged. No service-role, no secret, no client AI call.
- **cdiscourse-doctrine §2/§3 (heat/popularity are not inputs):** heat, engagement, virality, and standing never enter the toggle state, its copy, or its capacity numbers. Visibility is an access property, never a verdict.
- **Private-by-default (doctrine law):** strengthened, not weakened. Public now costs two explicit deliberate taps (`flip_on` then `confirm`); OFF in every entry path incl. open-floor; no persuasion/urgency copy nudging the flip. Proven structurally (Design decision 3).
- **One-way visibility rule (`roomVisibilityModel.ts`):** untouched. START-003 is creation-time only; it never adds a public→private→public loop and deliberately omits the one-way transition bullet from the creation preview.
- **Deterministic engine sole gate:** no AI anywhere in the ceremony; all copy is static `gameCopy.ts`; the creation decision remains `deriveArgumentRoomCreation`.
- **Mark the point, not the person:** the consequences copy describes the ROOM (who can read, seat capacity), never a person; no verdict vocabulary in new strings.
- **cdiscourse-doctrine §9 (plain language):** the two consequence bullets reuse already-plain-language choke-point strings; the new control copy is plain and carries no internal `snake_case` code (pinned by the copy-doctrine test).
- **accessibility-targets:** switch role + `accessibilityState.checked`, ≥44px confirm/cancel (via `minHeight`, not `hitSlop`-on-Switch), consequences readable by screen reader (plain `<Text>` bullets), color-independent states (glyph + status text), reduce-motion-safe conditional-mount panel.
- **No new secret, no Edge change, no migration, no service-role in client.**

---

## Operator steps (if any)

**None — pure code change.** No migration, no Edge Function deploy, no manual env var. The `home_v2` runtime flag that gates the sheet (and therefore this toggle) is set operator-side as part of the START-001 rollout, not by this card. Flag OFF = today's behavior byte-identical.
