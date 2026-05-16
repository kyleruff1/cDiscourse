# CDiscourse — Browser Visual Test Guide

_Stage 6.1.0 — updated 2026-05-16_

## How to Launch

```bash
npm run web -- --clear
# or
npx expo start --web --clear
```

Local URL: **http://localhost:8081**

The bundler starts Metro, builds the JS bundle (~4 s cold), and opens a browser tab automatically (or navigate manually).

---

## Launch Status (2026-05-16)

| Check | Result |
|---|---|
| `npm run web -- --clear` | ✅ Launched — 352 modules bundled in 4.1 s |
| Metro URL | http://localhost:8081 |
| Bundle errors | None |
| Runtime errors on first load | Unknown — requires browser inspection |
| Supabase configured | ❌ `.env` not present — UI shows config error notice |
| Submit-argument reachable | ❌ Not deployed — submit button disabled when not configured |

---

## Section A — App Boot

Verify in browser:

- [ ] Browser opens without red screen
- [ ] No unhandled runtime exception in console (F12 → Console)
- [ ] No repeated console error loop
- [ ] App shows signed-out / auth screen or configuration notice
- [ ] Missing Supabase config is shown clearly (should show: "Supabase is not configured. Copy .env.example to .env…")

---

## Section B — Auth Surface

**Without .env (expected default state):**

- [ ] Auth screen renders with sign-in form
- [ ] Error notice "Supabase is not configured…" is visible
- [ ] Email and password inputs are present
- [ ] Pressing Sign In with no credentials stays disabled (button disabled when email/password empty)
- [ ] App does not crash

**With .env configured (requires real Supabase project):**

- [ ] Sign-up form renders on toggle
- [ ] Sign-in form renders
- [ ] Invalid email shows validation error
- [ ] Valid sign-in works with test credentials
- [ ] Sign out works
- [ ] Browser refresh preserves auth shell

---

## Section B.5 — Argument-First Navigation (Stage 6.0.3+)

- [ ] Top tab bar shows: Arguments | Account | Debug (dev only)
- [ ] No "Debates", "Debate", or "Compose" tab visible in top bar
- [ ] Tab label reads "Arguments" (not "Debates")

---

## Section B.6 — Gamified Room Toolbar (Stage 6.1.0)

When inside an Argument Room:

- [ ] Room toolbar visible below room header
- [ ] "Argument Room" label visible in toolbar
- [ ] "Thread" chip visible and selectable (tree view)
- [ ] "Tracks" chip visible and selectable (timeline view)
- [ ] "Invite" chip visible and tappable
- [ ] Tapping "Invite" opens InvitePanel inline
- [ ] InvitePanel shows: title, subtitle, email/name input, copy buttons
- [ ] InvitePanel shows "Invite sending coming later." notice
- [ ] InvitePanel can be closed with ✕ button
- [ ] Switching to "Tracks" view shows: Core, Counters, Receipts, Clarifications, Concessions, Tangents lane headers
- [ ] Switching back to "Thread" shows nested tree view
- [ ] View toggle does not lose argument data

---

---

## Section C — Argument Rooms / Debate List / Create / Select

**Without .env:**

- [ ] No crash — screen shows config/fetch error or empty state

**With .env:**

- [ ] Debate list loads or shows empty state
- [ ] Create debate form is usable
- [ ] Created debate appears in list
- [ ] Joining a side works or shows a clear RLS/backend error
- [ ] Selecting a debate switches to the debate room tab

---

## Section D — Argument Tree

- [ ] Empty argument state renders readable ("No arguments yet…")
- [ ] Arguments render in stable order if any exist
- [ ] Argument type, side, body visible in each node
- [ ] Tags, flags, topic badges render without overflow
- [ ] Reply button is visible on each node
- [ ] Tapping Reply switches to Compose tab and passes parent context

---

## Section E — Inline Composer (Root — Start an Argument)

- [ ] "Start an argument" button visible at bottom of room view when tree is showing
- [ ] Tapping "Start an argument" opens the inline composer (replaces tree view)
- [ ] Composer header reads "Your Move" (not "Compose")
- [ ] Resolution bar shows room resolution text
- [ ] Root mode notice: "Root-level argument — only thesis or claim allowed at root"
- [ ] Conversation Move Navigator shows root move chips (start_thesis, make_claim)
- [ ] Type picker shows only Thesis / Claim for root (no parent)
- [ ] Side picker: Affirmative / Negative / Neutral
- [ ] Body text input works; character counter updates (0/2000)
- [ ] Evidence section labeled "Receipts"
- [ ] Client validation preview appears once required fields are filled
- [ ] Discard button returns to tree view (no separate Compose tab)
- [ ] Draft recovery notice appears after reload if draft was dirty

---

## Section F — Inline Composer (Reply)

- [ ] Tapping "Reply" on an argument node opens the inline composer (replaces tree)
- [ ] Composer header reads "Your Move"
- [ ] Parent panel shows parent type / side / body excerpt
- [ ] target_excerpt field is visible and editable
- [ ] Rebuttal / counter_rebuttal types show disagreementAxis picker (Fact / Definition / Causal / Value / Evidence / Logic / Scope)
- [ ] Concession type shows concession-specific guidance copy
- [ ] Clarification type shows clarification-specific guidance copy
- [ ] Evidence fields render: URL, citation label, source text
- [ ] Validation preview shows: blocking errors, warnings, topic scores (resolution/parent/combined), matched/missing terms, Constitution source chip

---

## Section G — Submit Flow

**Without submit-argument deployed:**

- [ ] Submit button is disabled (no Supabase configured)
- [ ] "Supabase not configured — submit disabled" notice is visible
- [ ] App does not crash when submit cannot be reached

**With submit-argument deployed (requires live Supabase + deployed function):**

- [ ] Valid root claim submits
- [ ] Success clears draft
- [ ] App switches to debate tab after success
- [ ] Server validation errors (422) display below validation panel
- [ ] 422 error preserves draft (draft is not cleared on server rejection)
- [ ] Network failure preserves draft
- [ ] Retry uses same client_submission_id when payload unchanged
- [ ] Editing after failure creates a new submission identity (new UUID)
- [ ] Direct client insert path is not used (all submits go through submit-argument Edge Function)

---

## Section H — Session Recovery

- [ ] Browser refresh preserves signed-in shell (if auth configured)
- [ ] Selected debate recovers after refresh
- [ ] Dirty draft recovers (recovery notice shown)
- [ ] Reply target state is understandable after reload
- [ ] Failed pending submission state is shown, not silent

---

## Section I — Responsive Layout

Test at these widths (browser dev tools → responsive):

| Width | What to check |
|---|---|
| 390 px | Mobile — submit panel not clipped, composer scrollable |
| 768 px | Tablet — layout readable, tab bar usable |
| 1280 px | Desktop — text inputs reachable, no extreme stretch |

- [ ] No clipped submit or error panels at any width
- [ ] Composer scroll works on narrow viewport
- [ ] Validation panel is readable
- [ ] Argument tree indentation does not overflow at depth 6
- [ ] Tab bar remains usable at all widths

---

## Section J — Console / Runtime

Open browser DevTools (F12 → Console):

- [ ] No redbox / full-screen red error overlay
- [ ] No infinite render loop (no repeated identical log lines)
- [ ] No unhandled promise rejection warnings
- [ ] No service role key visible in any console output
- [ ] No raw secret printed to console

---

## Section K — Account Screen

- [ ] Account tab is visible in tab bar when signed in
- [ ] Screen shows: masked user ID (`…` + last 8 chars), email, role label (e.g., "Participant")
- [ ] Display name is shown or placeholder "Not set" if missing
- [ ] Edit button opens inline text input with current name
- [ ] Saving a valid name shows "Display name saved." for 2 seconds then clears
- [ ] Save button is disabled when the input is empty or only whitespace
- [ ] Cancel button returns to display mode without saving
- [ ] No role-change UI anywhere in the screen
- [ ] "Role changes and account management…" note card is visible
- [ ] Sign Out button is red, tapping it signs out and returns to auth screen
- [ ] Supabase-not-configured state shows clear error message (no crash)

---

## Dev Visual Harness

A dev-only visual harness has NOT been created. If Supabase is not configured and the composer/debate UI is unreachable, visual testing covers:

- Auth screen (shows config notice)
- Compose tab entry point (accessible via debug tab or nav)
- Composer root mode (no debate required for layout inspection)

To test with real data, configure `.env` with a real Supabase project. See `.env.example`.

---

## Warnings Noted at Launch (non-blocking)

| Warning | Severity | Action |
|---|---|---|
| `jest-expo@55.0.17` — expected `~54.0.17` | Info | Update in a future maintenance session |
| `tsconfig.json#include` auto-updated by Expo | Info | Commit the updated tsconfig if changed |
