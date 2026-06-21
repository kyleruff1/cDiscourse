# AUTH-GOOGLE-SSO-005 — Preserve invite/room intent through Google SSO

**Status:** Design draft
**Epic:** Epic 18 — Google SSO (one-link account creation)
**Release:** Launch (priority p0)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/748

> Design-only. NO production code beyond what this doc specifies for the
> implementer; this doc itself writes none. NO provider call, NO hosted config
> change, NO secret, NO migration, NO Edge Function change, NO deploy. Strictly
> downstream of the merged readiness audit (`AUTH-GOOGLE-SSO-READINESS-001.md`,
> #768), the architecture design (`AUTH-GOOGLE-SSO-001.md` §6, #744), the
> continuity contract (`AUTH-FOUNDATION-INVITE-REDIRECT-001.md` §2, #742), the
> shipped Continue-with-Google UI + wrapper (`AUTH-GOOGLE-SSO-003.md`, #746,
> merged at `33e85a8`), the verified hosted config (#745), and the merged
> display-name coalescing migration (#747).

---

## Goal (one paragraph)

Guarantee that a pending invite/room intent survives a Google OAuth round-trip
and resumes deterministically at `InviteRedeemGate` after the `/auth/callback`
return, **without** changing any invite/seat/capacity rule, **without** a client
insert to `public.arguments`, **without** service-role in the client, and
**without** account enumeration. The acceptance path stays exactly the existing
server-side `acceptRoomInvite` → `manage-room-invite` Edge invoke. This card
re-uses the existing `pendingInviteIntent` store verbatim (it does NOT build a
parallel invite store) and makes the OAuth-callback → first-signed-in → gate
re-read **deterministic and tested** rather than incidental. The doctrine
constraints that shape this design: score/seat rules are server-owned and
untouched (cdiscourse-doctrine §1/§8), no secret/service-role in the client
(§6), plain-language no-enumeration error states (§9), and the v1→launch OAuth
scope change is the operator-ratified ADR #743 (§10 tension already resolved by
the epic). The invite half is **tests + a small hardening edit** because the
persistence layer is already provider-independent and the resume already works
by accident; the room-intent (returnTo) half is **deferred** because the Google
button is not reachable from a room/gallery in the current UI.

---

## Definitive answer to Q1 — does invite-through-Google work already?

**Yes, it works today — but only incidentally, and it is untested for the
`?code=` path.** This card converts the incidental behavior into a deterministic,
tested one with one small hardening edit; it does NOT need new runtime machinery.

### The traced end-to-end chain (Google invitee)

Pre-conditions: the invitee first taps the invite link — either the
`/invite/<token>` deep link (QOL-038) or the `/auth/callback?invite=<token>`
bridge (ARG-ROOM-004). On that cold start, `App.tsx` (the empty-deps one-shot,
`App.tsx:191-228`) calls `resolveColdStartInviteToken(window.location.href)`
(`src/features/invites/bridgedInviteToken.ts:83-87`), which matches both shapes →
`buildPendingInviteIntent` → `savePendingInviteIntentToStorage` (writes the
dedicated AsyncStorage key `cdiscourse:pending-invite-intent`,
`pendingInviteIntent.ts:35,:139-150`) → dispatch `SET_PENDING_INVITE_INTENT`.
**On web, AsyncStorage is localStorage, which survives a full-page navigation.**

The invitee is signed-out, so `pendingInviteIntent` is live → the gate renders
above everything else (`App.tsx:338-355`). (See Q2 for the reachability nuance
of how a Google button enters the picture — for Q1 we assume the invitee reaches
a Google sign-in.) They sign in with Google → `signInWithGoogle()`
(`signInWithGoogle.ts:57`) calls `supabase.auth.signInWithOAuth({ provider:
'google', options: { redirectTo: <origin>/auth/callback } })`. This is a
**full-page browser redirect** to Google and back. Everything in React state is
destroyed; **only the localStorage intent survives.**

The browser returns to `<origin>/auth/callback?code=<authcode>`. App boots fresh:

1. **`authCallback.active` is captured synchronously** (`App.tsx:140-144`,
   `isAuthCallbackPath('/auth/callback')` true) → `AuthCallbackScreen` renders at
   the HIGHEST priority (`App.tsx:321-335`), above the gate branch.
2. **The cold-start one-shot fires** (`App.tsx:191-228`):
   `resolveColdStartInviteToken('/auth/callback?code=...')` returns **null** — a
   Google return carries `?code=`, NOT `/invite/<token>` or `?invite=`
   (`bridgedInviteToken.ts:64-69`). The effect falls through to branch 2,
   `await loadPendingInviteIntentFromStorage(nowIso)` (`App.tsx:218`), which
   re-reads the persisted intent and dispatches `SET_PENDING_INVITE_INTENT`.
   **This is the load-bearing-by-accident re-read.**
3. **`AppSessionProvider`'s single `onAuthStateChange`** fires `INITIAL_SESSION`
   first; the `?code=` is not yet exchanged, so `session?.user` is null →
   `SIGNED_OUT` (`AppSessionProvider.tsx:45-48`). The reducer **preserves**
   `pendingInviteIntent` on `SIGNED_OUT` (`sessionState.ts:69-86`).
4. **`AuthCallbackScreen` consumes the URL** (`consumeAuthCallback`, the `code`
   branch, `consumeAuthCallback.ts:162-170`) → `exchangeCodeForSession` →
   session established → returns `{ status: 'success' }` (NOT `needs_password`,
   which is invite-email-only, `:51-54,:167`). The new session fires a SECOND
   `onAuthStateChange` event `SIGNED_IN` → dispatch `SIGNED_IN`
   (`AppSessionProvider.tsx:61-71`). The reducer again **preserves**
   `pendingInviteIntent` (`sessionState.ts:49-67`). Now `signedIn === true`.
5. **The user taps "Continue"** on the accepted screen → `finishAndExit`
   (`AuthCallbackScreen.tsx:93-102`) → `window.history.replaceState(null,'','/')`
   + `onDone()` → App flips `authCallback.active` to false (`App.tsx:333`).
6. **AppRoot re-renders:** `authCallback.active` false, status signed-in,
   `pendingInviteIntent` present → the gate mounts (`App.tsx:338`) with
   `signedIn=true` + `viewerEmail` set → the auto-accept effect fires
   `acceptRoomInvite({ token })` (`InviteRedeemGate.tsx:124-134`). Server-side
   email-binding governs: match → join; mismatch → `invite_email_mismatch` →
   `MismatchPanel`. On success App clears the intent
   (`clearPendingInviteIntentFromStorage` + `CLEAR_PENDING_INVITE_INTENT`,
   `App.tsx:242-249`) and folds the user into the room.

### Why it is "incidental" (the named gap #748 must close)

The readiness audit states it precisely
(`AUTH-GOOGLE-SSO-READINESS-001.md` §Lane-D-2/3, lines 175, 203;
`AUTH-FOUNDATION-INVITE-REDIRECT-001.md` §2, lines 41-43): there is **no
deterministic OAuth-callback → first-signed-in → gate re-read wire and no pure
resume-decision test for the `?code=` path.** The resume rides two coincidences:
(a) the empty-deps cold-start one-shot happens to also call the generic
`loadPendingInviteIntentFromStorage` fallback, and (b) the reducer happens to
preserve the intent across the `SIGNED_OUT`→`SIGNED_IN` churn. Both are true and
robust **today**, but nothing tests them for the Google path, and nothing
documents that the re-read MUST survive a future refactor of the cold-start
effect.

### The smallest fix

Add a **deterministic re-read on the auth-callback-done transition** (so the
re-read no longer depends solely on the empty-deps one-shot having already
resolved), plus the **pure resume-decision test**, the **gate RTL resume
variant**, and the **App.tsx source-scan wiring assertions**. The re-read is a
2-3 line addition to the existing `onDone` handler in `App.tsx`; it reuses the
existing `loadPendingInviteIntentFromStorage` helper and the existing
`SET_PENDING_INVITE_INTENT` dispatch. No new store, no new module, no callback
change, no `signInWithGoogle` change. (Full spec under "File changes" →
`App.tsx`.)

**Net: #748 is tests-mostly + one small client hardening edit. NOT GATE-C.**

---

## Q2 — room intent (debateId returnTo): DEFER (documented)

### Is a room → "Continue with Google" → return-to-that-room path reachable today?

**No.** Two independent facts make it unreachable:

1. **The Google button lives ONLY on `AuthScreen`.** A repo-wide search confirms
   `signInWithGoogle` is invoked from exactly one render site,
   `AuthScreen.tsx:173` (the gated provider region). There is **no inline Google
   sign-in** in any room surface, the Conversation Gallery, the side-action rail,
   or the invite gate. `InviteCredentialStep` (`InviteCredentialStep.tsx`) — the
   in-place credential step inside the invite gate — is **email/password only**;
   it has no Google affordance.
2. **`AuthScreen` is not reachable while an intent is live, and there is no
   room-intent store at all.** When `pendingInviteIntent` is present, the gate
   renders above `AuthScreen` (`App.tsx:338` precedes `:356`). For an ordinary
   signed-out user (no intent), `AuthScreen` IS shown — but there is **no
   persisted `selectedDebateId`/returnTo for a signed-out viewer**: the session
   snapshot is user-keyed and only written while signed in
   (`AppSessionProvider.tsx:90-95`), and an anonymous gallery/room viewer has no
   stored room target. So even if such a user tapped "Continue with Google" on
   `AuthScreen`, there is nothing today that records "send me back to room X."

Therefore a room→Google→return-to-room flow has **no entry point and no store**
in the current UI. Designing a room-intent persistence + return now would be
speculative machinery with zero reachable caller — exactly the "feature with no
caller" that the scope-reality audit rule (POSTRUN-UX001) says to defer.

### Decision: DEFER room intent; keep the general mechanism sound

- **Defer** the room-intent (`returnTo` debateId) store + return-routing to a
  future card, to be opened **when** an inline "Continue with Google" is wired
  into a signed-out room/gallery surface (i.e., when there is a reachable
  entry point that needs it).
- **Ensure the general mechanism is sound for that future card:** the invite
  resume this card hardens (deterministic re-read on the callback-done
  transition + the persisted-intent pattern) is the exact template a future
  room-intent store would mirror — a small pure model with the same safety
  doctrine (bounded TTL, malformed/stale drop, no secrets, AsyncStorage on web
  = survives the redirect, clear-after-resume, route back via EXISTING
  navigation, NO seat/capacity bypass). This card's "Out of scope" + this
  section are the breadcrumb for that follow-up.
- **The card explicitly allows this:** issue #748 + `AUTH-GOOGLE-SSO-001.md` §6
  scope the work to invite/redeem continuity ("if applicable"), and the
  readiness audit classifies room-intent as not-yet-reachable. Deferring is the
  honest call, not a gap.

> Follow-up card to file (NOT in this card's scope): **"Room-intent returnTo
> through Google SSO"** — blocked until an inline Google sign-in exists on a
> signed-out room/gallery surface; mirror `pendingInviteIntent`'s doctrine; route
> back via existing `selectDebate`/gallery navigation; no seat/capacity change.

---

## Q3 — does `signInWithGoogle` need to change?

**No.** Keep `signInWithGoogle()` argument-free and intent-agnostic.

The intent is persisted to localStorage at the **invite-link cold start**
(`App.tsx:206`, `savePendingInviteIntentToStorage`) — long before any Google
button is clickable, and certainly before the redirect. So at the moment the
button is pressed, the intent is ALREADY in storage; there is nothing to "flush
before redirect." A belt-and-suspenders flush inside the wrapper would:

- be redundant (storage already holds the intent),
- couple the auth wrapper to the invite store (a layering violation —
  `signInWithGoogle.ts` is doctrine-scoped to the provider call + redirect only,
  and is the single source-scan allow-list entry for `signInWithOAuth`), and
- have no value for the only reachable flow (invite-link-first), since that flow
  always persisted at cold start.

The one scenario where the in-memory intent might NOT yet be in storage is the
hypothetical "user already on a room/gallery with an in-memory room target taps
an inline Google button" — but that path **does not exist** (Q2). If/when it is
built, the **room-intent card** (deferred) owns persisting its target before
initiating the redirect; that belongs in the room surface's press handler, not
in the generic `signInWithGoogle` wrapper. So `signInWithGoogle` stays unchanged
in this card. (Risks section notes the one defensive alternative and why it is
rejected.)

---

## Mapping table — entry path → intent → storage → cleanup → rules → tests

| Entry path | Current pre-auth state | Current post-auth (Google return) | Intent that must survive | Storage mechanism | Cleanup rule | Invite/seat rule touched? | Safe-now / defer | Tests |
|---|---|---|---|---|---|---|---|---|
| `/invite/<token>` deep link → signed-out → Google sign-in → `/auth/callback?code=` | Gate renders; intent captured at cold start (`App.tsx:206`) | Cold-start branch-2 re-read (`App.tsx:218`) + reducer-preserved across `SIGNED_OUT`→`SIGNED_IN`; gate resumes after Continue | `pendingInviteIntent` `{ token, capturedAt }` | AsyncStorage key `cdiscourse:pending-invite-intent` (= localStorage on web → survives full-page redirect) | `clearPendingInviteIntentFromStorage` + `CLEAR_PENDING_INVITE_INTENT` on accept/exit (`App.tsx:242-254`) | **No** — `acceptRoomInvite` Edge-only, email-binding server-side | **Safe-now (harden + test)** | 748-T1, T2, T4, T5, T6, App-T1 |
| `/auth/callback?invite=<token>` bridge → signed-out → Google → `/auth/callback?code=` | Same as above (bridge token also captured by `resolveColdStartInviteToken`) | Same as above | `pendingInviteIntent` | Same AsyncStorage key | Same | **No** | **Safe-now (harden + test)** | 748-T1, T2, App-T1 |
| Normal Sign In (no invite) → Google → `/auth/callback?code=` | `AuthScreen` (no intent) | No intent in storage → branch-2 re-read returns null → no gate → normal signed-in shell | None (must NOT spuriously enter the gate) | n/a (storage empty) | n/a | No | Safe-now (test) | 748-T7 |
| Stale / malformed persisted intent → Google return | Gate would mis-fire if a stale intent leaked | `loadPendingInviteIntentFromStorage` drops stale (>24h) / malformed on read → null → no gate | n/a | AsyncStorage (dropped on read) | Dropped on read (no explicit clear needed) | No | Safe-now (test) | 748-T1 (stale/malformed) |
| Room/gallery → inline "Continue with Google" → return to that room | **Does not exist** (no inline Google button off `AuthScreen`; no room-intent store) | n/a | room `returnTo` (debateId) | n/a (deferred) | Would be No (route via existing nav) | **DEFER** | n/a (future card) |

---

## Data model

**No new data model in this card.** The invite case reuses the existing
`PendingInviteIntent` shape verbatim:

```ts
// src/features/invites/pendingInviteIntent.ts (UNCHANGED)
export interface PendingInviteIntent {
  token: string;        // raw invite token (never logged)
  capturedAt: string;   // ISO-8601; drives the 24h freshness drop
}
export const PENDING_INVITE_INTENT_STORAGE_KEY = 'cdiscourse:pending-invite-intent';
export const PENDING_INVITE_INTENT_FRESHNESS_MS = 24 * 60 * 60 * 1000;
```

No DB table, column, RLS policy, migration, or domain type is added. The session
slice (`pendingInviteIntent` on `AppSessionSnapshot`) and the reducer
preservation are already in place (`sessionState.ts:49-98`).

**Deferred (room intent) — NOT built in this card.** When the room-intent
follow-up lands, it would add a small pure model mirroring the above doctrine,
e.g.:

```ts
// FUTURE (deferred follow-up) — illustrative only, NOT part of #748
export interface PendingRoomReturnIntent {
  debateId: string;     // the room to return to (must be a real, navigable id)
  capturedAt: string;   // ISO-8601; bounded TTL drop on read
}
export const PENDING_ROOM_RETURN_STORAGE_KEY = 'cdiscourse:pending-room-return';
```

It would route back via the EXISTING `selectDebate`/gallery navigation
(`App.tsx` accepted-debate hand-off, `:362-364`), never a seat/capacity write.
The implementer of THIS card does NOT create this.

---

## File changes

### Production (1 file, a small hardening edit)

- **`App.tsx`** (~+6 lines net) — make the OAuth-callback → first-signed-in →
  gate re-read **deterministic** instead of relying solely on the empty-deps
  cold-start one-shot. The change is localized to the `onDone` handler passed to
  `<AuthCallbackScreen>` (`App.tsx:330-335`). Today:

  ```tsx
  // App.tsx ~330-335 (CURRENT)
  content = (
    <AuthCallbackScreen
      capturedUrl={authCallback.url}
      onDone={() => setAuthCallback({ active: false, url: '' })}
    />
  );
  ```

  Replace the inline `onDone` with a named `handleAuthCallbackDone` callback that
  ALSO re-reads the persisted intent before flipping the flag, so the gate sees a
  live `pendingInviteIntent` on the very next render regardless of cold-start
  timing:

  ```tsx
  // App.tsx — NEW (declared near the other invite handlers, ~App.tsx:250)
  // AUTH-GOOGLE-SSO-005 (#748) — when the /auth/callback consumer finishes
  // (e.g. a Google OAuth `?code=` return that established a session), re-read
  // the persisted invite intent and feed it into the gate DETERMINISTICALLY,
  // rather than depending on the empty-deps cold-start one-shot having already
  // resolved. Idempotent: if the cold-start effect already set the same intent,
  // SET_PENDING_INVITE_INTENT just re-sets the identical slice; if there is no
  // persisted intent (a normal Google sign-in with no invite), the load returns
  // null and we leave the gate un-mounted. Stale/malformed intents are dropped
  // inside the load helper. The token is never logged.
  const handleAuthCallbackDone = React.useCallback(async () => {
    setAuthCallback({ active: false, url: '' });
    try {
      const persisted = await loadPendingInviteIntentFromStorage(
        new Date().toISOString(),
      );
      if (persisted) {
        dispatch({ type: 'SET_PENDING_INVITE_INTENT', intent: persisted });
      }
    } catch {
      // Non-fatal — load never throws by contract; the try/catch is belt-and-
      // suspenders so a storage anomaly can never block leaving the callback.
    }
  }, [dispatch]);
  ```

  and wire it:

  ```tsx
  <AuthCallbackScreen capturedUrl={authCallback.url} onDone={handleAuthCallbackDone} />
  ```

  Notes for the implementer:
  - `loadPendingInviteIntentFromStorage` is ALREADY imported in `App.tsx` (used
    by the cold-start one-shot, `App.tsx:218`) — no new import.
  - `setAuthCallback` runs FIRST so the flag flip is never delayed by the async
    load (the gate mounts on the next render; the dispatched intent lands in the
    same or the immediately-following commit — both converge before the gate's
    auto-accept effect, which itself awaits `lookupInviteByToken`).
  - Do NOT remove the cold-start branch-2 re-read (`App.tsx:218`) — it still
    covers the plain cold-start-with-persisted-intent case (app killed
    mid-signup, reopened directly). The two paths are complementary and both
    idempotent (the reducer's `SET_PENDING_INVITE_INTENT` just sets the slice).
  - The order of the existing `authCallback.active` (highest) → `pendingInviteIntent`
    gate branch priority (`App.tsx:321-338`) is preserved — do NOT reorder.

### Tests (new + extended)

- **`__tests__/inviteResumeAfterOAuth.test.ts`** (NEW, ~140 lines) — the pure
  resume-decision test (748-T1) + a small pure helper if extracted (see "API /
  interface contracts"). Mirrors `pendingInviteIntent.test.ts` (AsyncStorage
  mock) and `authCallbackSmokeReadiness.test.ts` (synthetic-URL parse→consume).
- **`__tests__/appInviteResumeOAuthWiring.test.ts`** (NEW, ~70 lines) — App.tsx
  source-scan asserting the deterministic re-read wiring is present (App-T1).
  Mirrors `appInviteBridgeHandoff.test.ts` exactly (read `App.tsx`, assert
  structure; App.tsx is not rendered).
- **`__tests__/InviteRedeemGate.oauth.test.tsx`** (NEW, ~120 lines) OR extend
  `__tests__/InviteRedeemGate.newuser.test.tsx` — the gate RTL resume variant
  (748-T2/T4/T5). A new file is cleaner (keeps the existing suite focused on the
  email-credential path); reuse the same `inviteApi`/`authApi` mocks.
- **`__tests__/consumeAuthCallback.test.ts`** (EXTEND, +2-3 cases if not already
  covered) — assert a bare `?code=` (no `type`) → `{ status: 'success' }` for the
  OAuth-resume precondition (748-T3). NOTE: `authCallbackSmokeReadiness.test.ts`
  + `consumeAuthCallback.test.ts` likely already cover the `code`→`success` case;
  the implementer VERIFIES and only adds a case if the exact "bare `?code=` with
  no `type` param" assertion is missing. Do NOT duplicate existing coverage.

### Unchanged (explicitly NOT modified)

- `src/features/auth/signInWithGoogle.ts` — Q3: no change.
- `src/features/auth/consumeAuthCallback.ts` / `parseAuthCallbackUrl.ts` /
  `AuthCallbackScreen.tsx` — no callback change (only `App.tsx`'s `onDone`
  wiring changes; the screen's `onDone()` call site is unchanged — it just
  receives a richer callback).
- `src/features/invites/pendingInviteIntent.ts` — reused verbatim.
- `src/features/invites/InviteRedeemGate.tsx` / `inviteApi.ts` /
  `InviteCredentialStep.tsx` — the gate's auto-accept already fires on
  `signedIn`+pending+email; provider-agnostic, no change.
- `src/features/session/sessionState.ts` / `AppSessionProvider.tsx` — the intent
  preservation across `SIGNED_OUT`→`SIGNED_IN` is already in place + tested
  (`sessionReducerInvite.test.ts`).
- `src/features/auth/authProviderSlotModel.ts` / `googleAuthGate.ts` /
  `AuthScreen.tsx` — #746 surface, no change.

**Net: 1 production file changed (~+6 lines), 2-3 new test files, ≤1 extended
test file. No migration, no Edge Function, no `app.json`/`package.json` change.**

---

## API / interface contracts

This card adds **no new public production interface** beyond the App.tsx
`handleAuthCallbackDone` internal callback (above). It optionally extracts ONE
small pure helper to make 748-T1 a clean unit test:

### Optional pure helper (recommended for testability)

If the implementer wants the resume decision to be a pure, directly-unit-tested
function (rather than only asserted through the gate + App source-scan), extract:

```ts
// src/features/invites/pendingInviteIntent.ts (ADD — optional, pure, no I/O)
/**
 * AUTH-GOOGLE-SSO-005 (#748) — the resume DECISION for a callback-done
 * transition: given a (possibly null) loaded intent and the current signed-in
 * state, decide whether the InviteRedeemGate should mount and whether the
 * auto-accept will be eligible. Pure; no storage, no network. The actual
 * acceptance stays server-side in the gate; this only decides gate eligibility.
 */
export type InviteResumeDecision =
  | { resume: false }                                   // no live intent → no gate
  | { resume: true; token: string; autoAcceptEligible: boolean };

export function decideInviteResume(input: {
  intent: PendingInviteIntent | null;   // already freshness-checked by the loader
  signedIn: boolean;
  viewerEmail: string | null;
}): InviteResumeDecision {
  if (!input.intent) return { resume: false };
  return {
    resume: true,
    token: input.intent.token,
    // mirrors InviteRedeemGate.tsx:128 (signed-in + viewerEmail set → auto-fire)
    autoAcceptEligible: input.signedIn && !!input.viewerEmail,
  };
}
```

This is **optional** — the gate's own effect (`InviteRedeemGate.tsx:124-134`)
already encodes the auto-accept condition, and 748-T2 tests it via RTL. If the
helper is added it must NOT duplicate or replace the gate logic; it is a
testable mirror of the gate-mount decision and the App.tsx re-read can read
`persisted` and (optionally) consult it. The implementer may skip the helper and
rely on 748-T1 testing `loadPendingInviteIntentFromStorage` + 748-T2 testing the
gate; document which path was taken. **Recommendation: skip the helper unless the
reviewer wants a standalone pure-decision unit** — the load helper + gate effect
already are the decision, and adding a near-duplicate risks drift.

### Reused contracts (unchanged — listed so the implementer does not re-derive)

```ts
// pendingInviteIntent.ts
loadPendingInviteIntentFromStorage(nowIso: string): Promise<PendingInviteIntent | null>
clearPendingInviteIntentFromStorage(): Promise<void>

// inviteApi.ts — acceptance stays server-side, Edge-invoke-only
acceptRoomInvite(input: { token: string }): Promise<InviteApiResult<AcceptRoomInviteResponse>>
lookupInviteByToken(input: { token: string }): Promise<InviteApiResult<LookupInviteByTokenResponse>>

// consumeAuthCallback.ts — the OAuth `?code=` precondition
consumeAuthCallback({ client, parsed }): Promise<AuthCallbackOutcome>
// bare ?code= (type:null) → { status: 'success' }  (NOT needs_password)

// sessionState.ts — intent survives the auth churn (already tested)
SIGNED_IN / SIGNED_OUT both preserve snapshot.pendingInviteIntent
```

---

## Edge cases

The implementer MUST handle / assert each:

- **Empty inputs** — no persisted intent on the Google return:
  `loadPendingInviteIntentFromStorage` returns null → `handleAuthCallbackDone`
  dispatches nothing → no gate → normal signed-in shell. (Normal Sign In must
  NOT spuriously enter the gate — 748-T7.)
- **Stale intent (>24h)** — dropped inside the load helper (the 24h freshness
  window, `pendingInviteIntent.ts:63,:118-126`) → null → no gate.
- **Malformed / corrupt persisted JSON** — `loadPendingInviteIntentFromStorage`
  catches + returns null (`pendingInviteIntent.ts:159-172`) → no gate, no throw.
- **Cold-start one-shot vs callback-done race** — both call the same load helper
  and dispatch the same idempotent `SET_PENDING_INVITE_INTENT`; whichever lands
  first, the reducer just sets the slice, and the gate's auto-accept effect
  awaits `lookupInviteByToken` so it cannot fire before the intent is present.
  No double-accept (the gate fires accept once per `lookup_ok`+signed-in+pending;
  `acceptRoomInvite` is idempotent server-side per
  `InviteRedeemGate.newuser.test.tsx:179`).
- **Session established but Continue not yet tapped** — the gate does NOT mount
  while `authCallback.active` is true (`AuthCallbackScreen` is the higher-priority
  branch, `App.tsx:321`). The intent is NOT cleared during this window (cleanup
  only runs on accept-success/exit, `App.tsx:242-254`) — so the resume survives a
  user who lingers on the accepted screen. (Card-required: "not cleared before
  callback if session unavailable.")
- **Session unavailable / exchange fails** — `consumeAuthCallback` returns an
  error outcome (e.g. `network`/`expired`) → `AuthCallbackScreen` shows the
  recoverable error → on "Return to sign in" it calls the same
  `handleAuthCallbackDone`. The intent is re-read but `signedIn` is false (no
  session) → the gate mounts in its signed-out branch (lookup → SignedOutPrompt),
  NOT auto-accept. The intent is preserved (not cleared) so a later successful
  sign-in resumes. (Card-required: "not cleared before callback if session
  unavailable.")
- **Email mismatch (Google account email ≠ invited email)** — auto-accept fires
  optimistically (client cannot see the bound email), the Edge returns
  `invite_email_mismatch` → `MismatchPanel` plain copy → "Sign in as someone
  else" keeps the intent (`App.tsx:256-271`, `handleInviteSignOutAndRetry`).
  No enumeration: the client never learns the bound address
  (`inviteApi.ts:92-100`). (748-T4.)
- **Expired / revoked / already-used / room-closed / room-archived invite** —
  the gate's `lookup_ok` branch renders the matching plain panel
  (`InviteRedeemGate.tsx:289-312`); resume does not force-accept a dead invite.
- **Permission-denied / capacity-full** — server-side; the Edge returns the
  appropriate code → mapped to a plain panel (`AcceptErrorBranch`,
  `InviteRedeemGate.tsx:326-380`). The client never bypasses the seat/capacity
  check (acceptance is Edge-only).
- **Offline / network failure during resume** — `lookupInviteByToken` /
  `acceptRoomInvite` failures map to the retryable `NetworkPanel`
  (`InviteRedeemGate.tsx:543-558`); the intent is preserved for retry.
- **Doctrine-constraint edge case** — "what if a high-follower Google account
  signs in to accept?" Identity is orthogonal to seat/standing; signing in via
  Google grants no factual standing, no heat, no score, and no special seat
  priority (cdiscourse-doctrine §1-§3). Nothing in this card touches the standing
  economy or the seat-claim rules.
- **Native (iOS/Android)** — the whole `/auth/callback` path is web-only
  (`App.tsx:140-144` `typeof window` guard; `app.json` declares no deep-link
  `scheme`). On native, `handleAuthCallbackDone`'s web-only branch is never
  reached; the cold-start one-shot is also `typeof window`-guarded. Google ships
  web-first (architecture §8); native is out of lane.

---

## Test plan (every card-required case mapped)

Test-discipline: pure-model tests import the model directly (no React/Supabase);
the App.tsx wiring is asserted by source-scan (the established idiom,
`appInviteBridgeHandoff.test.ts`); the gate flow uses RTL with mocked
`inviteApi`/`authApi` (no live network, no live OAuth). **No live OAuth /
provider call in any test** — mock the wrapper/client.

### `__tests__/inviteResumeAfterOAuth.test.ts` (NEW) — pure resume decision (748-T1)

- **invite captured before a mocked Google redirect survives + is re-read**:
  `savePendingInviteIntentToStorage(fresh)` → simulate the redirect as a fresh
  module/storage read → `loadPendingInviteIntentFromStorage(now)` returns the
  same intent (mirrors `pendingInviteIntent.test.ts:139-145`).
- **stale intent (>24h) is ignored + effectively cleared on read** — load returns
  null (mirrors `pendingInviteIntent.test.ts:147-155`).
- **malformed / corrupt persisted intent is ignored** — load returns null
  (corrupt JSON + bad shape, mirrors `pendingInviteIntent.test.ts:170-174`).
- **normal sign-in captures nothing** — empty storage → load returns null → the
  resume decision is "no gate."
- **(if the optional `decideInviteResume` helper is added)** — `resume:false`
  for null intent; `resume:true, autoAcceptEligible:true` only when signedIn +
  viewerEmail; `autoAcceptEligible:false` when signed-out or no email.
- **the synthetic `?code=` callback parses→consumes to `success`** (resume
  readiness; may live here or in the consume test): build a synthetic
  `<origin>/auth/callback?code=fake-code` → `parseAuthCallbackUrl` →
  `{ kind:'code', type:null }` → `consumeAuthCallback({ mockClient })` →
  `{ status:'success' }` (NOT `needs_password`); assert `exchangeCodeForSession`
  was called and `setSession` was not (mirrors
  `authCallbackSmokeReadiness.test.ts:43-59`).

### `__tests__/appInviteResumeOAuthWiring.test.ts` (NEW) — App.tsx source-scan (App-T1)

Mirror `appInviteBridgeHandoff.test.ts` (read `App.tsx`; do NOT render it):

- App.tsx passes a NAMED callback (not the bare inline `setAuthCallback`) to
  `<AuthCallbackScreen onDone={…}>` — assert `handleAuthCallbackDone` exists and
  is wired (`onDone={handleAuthCallbackDone}`).
- `handleAuthCallbackDone` re-reads the persisted intent and dispatches it: the
  callback body contains `loadPendingInviteIntentFromStorage` AND
  `dispatch({ type: 'SET_PENDING_INVITE_INTENT'` AND
  `setAuthCallback({ active: false`.
- the cold-start branch-2 re-read is RETAINED (regression): App.tsx still
  contains the `loadPendingInviteIntentFromStorage` call inside the empty-deps
  effect (do not let the new wiring delete the old fallback).
- routing priority preserved: `if (authCallback.active)` still precedes
  `} else if (pendingInviteIntent) {` (mirrors
  `appInviteBridgeHandoff.test.ts:55-61`).

### `__tests__/InviteRedeemGate.oauth.test.tsx` (NEW) — gate resume RTL (748-T2/T4/T5)

Reuse the `inviteApi`/`authApi` mock pattern from
`InviteRedeemGate.newuser.test.tsx`:

- **resume → auto-accept on (signed-in + live pending + email)**: render the gate
  with `signedIn=true, viewerEmail='me@example.com'` and a pending lookup →
  `acceptRoomInvite` called once with `{ token }` → `onAccepted` called with the
  debateId (mirrors `InviteRedeemGate.newuser.test.tsx:117-181`). This is the
  "signed-in via Google" shape (the gate is provider-agnostic; the test proves
  the resume fires once a session exists, however established).
- **email mismatch → plain MismatchPanel, no enumeration**: `acceptRoomInvite`
  resolves `{ ok:false, error:{ error:'invite_email_mismatch' } }` → the mismatch
  panel renders, the tree never contains the invited `@`-address, and copy is
  plain (cross-check `inviteCopyDoctrine.test.ts` ban-list) (748-T4).
- **no-enumeration byte-identical render** — the signed-out gate render is
  identical regardless of invitee account state (reuse
  `InviteRedeemGate.newuser.test.tsx:184-227`) (748-T5).
- **expired / closed states render plainly** — pending→`expired` and
  `room_closed` lookups render the matching panel, NOT an auto-accept.

### `__tests__/consumeAuthCallback.test.ts` (EXTEND only if missing) (748-T3)

- bare `?code=` with NO `type` param → `{ status: 'success' }` (the OAuth-resume
  precondition). VERIFY this is not already covered before adding; if present,
  cite it in the design-review and add nothing.

### Doctrine ban-list / source-scan assertions (cross-cutting — 748-T6)

- **no service-role / no secret in any touched path** — extend or mirror the
  forbidden-token scan (`demoCorridorNoProvider.test.ts:31-66`) over `App.tsx`
  diff region + the new test files: zero `SERVICE_ROLE` / `service_role` /
  `ANTHROPIC_API_KEY`.
- **no client insert to `public.arguments`** — assert (source-scan or by reusing
  the readiness invariant) the resume path invokes `acceptRoomInvite`
  (Edge-only) and never `.from('arguments').insert` (mirrors the
  `AUTH-FOUNDATION-INVITE-REDIRECT-001.md` §3 invariant; `inviteApi.ts:212-216`).
- **no provider tokens stored** — assert the resume path persists only the
  invite token via the existing intent store; `handleAuthCallbackDone` writes no
  access/refresh token to storage (it only reads the intent + dispatches). A
  scan of `App.tsx`'s new region for `access_token` / `refresh_token` /
  `provider_token` returns none.
- **token never logged** — no `console.*` in `App.tsx`'s new region (lint
  enforces; assert in the source-scan that `handleAuthCallbackDone` contains no
  `console.`).
- **email/password fallback preserved** — assert the email-credential resume path
  is unchanged (the existing `InviteRedeemGate.newuser.test.tsx` provision→
  signin→accept suite stays green — it is NOT modified).
- **no Facebook** — assert no Facebook affordance/string is introduced anywhere
  in the diff (a simple `/facebook/i` scan over the new/changed files → none).
- **no seat/chime-in change** — assert `acceptRoomInvite` arg shape is unchanged
  (`{ token }`) and no seat/capacity/chime-in model is imported or touched in the
  diff.

### Test-count expectation

Test count goes UP (1 pure suite + 1 App source-scan suite + 1 gate RTL suite;
≤1 extended consume suite; no tests removed). The implementer captures the exact
`Test Suites: X passed / Tests: Y passed` line with an explicit exit 0 and
updates `docs/core/current-status.md` per test-discipline. **Baseline at design
time (CLAUDE.md / current-status.md) is 854 suites / 32,083 tests; the
implementer confirms the live baseline on the branch before claiming the delta —
do NOT author a stale count.**

---

## Dependencies (cards / docs / files)

- **Assumes #746 (AUTH-GOOGLE-SSO-003) is complete** — the live "Continue with
  Google" button + `signInWithGoogle` wrapper shipped at `33e85a8`. The resume
  flow is only exercisable once a Google sign-in can be initiated (gated by the
  operator's `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` flag + the hosted provider).
- **Assumes #745 (AUTH-GOOGLE-SSO-002) is complete** — hosted Google provider
  enabled + redirect allow-list covers `/auth/callback`. Required for the live
  round-trip to COMPLETE; not required for this card to merge (the tests mock the
  provider; the hardening edit is inert until a real Google return occurs).
- **Assumes #747 (AUTH-GOOGLE-SSO-004) is complete** — the display-name
  coalescing migration so a first-time Google invitee lands with a usable
  profile. Not consumed by this card's code; relevant to the live smoke.
- **Reads existing code (no change):**
  - `App.tsx` — cold-start one-shot (`:191-228`), gate branch (`:338-355`),
    `onDone` wiring (`:330-335`), accepted-debate hand-off (`:242-254,:362-364`).
  - `src/features/invites/pendingInviteIntent.ts` —
    `loadPendingInviteIntentFromStorage`, `clearPendingInviteIntentFromStorage`.
  - `src/features/invites/InviteRedeemGate.tsx` — auto-accept effect (`:124-134`).
  - `src/features/invites/inviteApi.ts` — `acceptRoomInvite` (Edge-only, `:212-216`).
  - `src/features/auth/consumeAuthCallback.ts` — `code`→`success` (`:162-170`).
  - `src/features/session/sessionState.ts` — intent preservation (`:49-98`).
  - `src/features/auth/signInWithGoogle.ts` — initiation wrapper (no change, Q3).
- **Reads the design chain:** `AUTH-GOOGLE-SSO-READINESS-001.md` (Lane D + §8 +
  F.3), `AUTH-FOUNDATION-INVITE-REDIRECT-001.md` §2, `AUTH-GOOGLE-SSO-001.md` §6.
- **Blocks:** the deferred **room-intent (returnTo) follow-up card** — that card
  builds on the deterministic re-read pattern this card establishes.

---

## Risks

- **Race subtlety between the cold-start one-shot and `handleAuthCallbackDone`.**
  Both dispatch `SET_PENDING_INVITE_INTENT` with the same loaded intent. This is
  safe (idempotent set; gate auto-accept awaits lookup). The reviewer should
  confirm the implementer did NOT remove the cold-start branch-2 fallback (the
  App-T1 regression assertion guards this) and did NOT introduce a second
  `CLEAR` that could wipe a just-set intent.
- **`onDone` is now async.** `AuthCallbackScreen` calls `onDone()` without
  awaiting it (`AuthCallbackScreen.tsx:101`). The new `handleAuthCallbackDone`
  returns a promise; the unawaited call is fine because it flips the flag
  synchronously first (`setAuthCallback` before the `await`) and the dispatch is
  fire-and-forget. The reviewer should confirm no floating-promise lint rule
  flags the `onDone={handleAuthCallbackDone}` prop pass (it does not — the
  callback type is `() => void` structurally; an async function is assignable).
  If a lint rule complains at the call site inside `AuthCallbackScreen`, that is
  pre-existing and out of scope (the screen is unchanged).
- **Over-engineering temptation (the optional pure helper).** Adding
  `decideInviteResume` risks drift from the gate's own condition. Recommendation:
  skip it unless the reviewer explicitly wants a standalone pure-decision unit;
  the load helper + gate effect already ARE the tested decision. Documented as a
  default-skip in "API / interface contracts."
- **Q3 belt-and-suspenders flush (rejected).** A defensive
  `savePendingInviteIntentToStorage` inside `signInWithGoogle` was considered and
  rejected (Q3): the invite flow always persists at cold start, so it is
  redundant, and it would couple the single-allow-list provider wrapper to the
  invite store. If a reviewer disagrees, the cost is a layering violation +
  widening the wrapper's responsibility — documented here so the trade-off is
  explicit.
- **Existing tests that might need updating.** None should need changing — the
  hardening is additive (a new named callback; the screen's `onDone()` call is
  unchanged). If any existing App-source-scan test pins the OLD inline
  `onDone={() => setAuthCallback(...)}` literal, it must be updated to the named
  callback; the implementer should grep for that literal before editing and
  update in lockstep (likely none, since `appInviteBridgeHandoff.test.ts` asserts
  routing priority, not the `onDone` literal).
- **No migration / no operator deploy required to merge** — the live behavior is
  gated by #745 + the Netlify flag, both already handled. The only operator
  action is the existing GATE-C smoke (below), which is unchanged by this card.
- **No live OAuth in tests.** All tests mock `consumeAuthCallback`'s client and
  `inviteApi`/`authApi`. No network, no provider call (cdiscourse-doctrine §7).

---

## Out of scope

- **Room-intent (returnTo debateId) store + return-routing** — DEFERRED (Q2). No
  reachable entry point today (no inline Google button off `AuthScreen`; no
  signed-out room target store). A future card owns it when an inline room/gallery
  Google sign-in exists.
- **Any change to `signInWithGoogle`** — Q3: unchanged.
- **Any callback / parser / consumer change** — only `App.tsx`'s `onDone` wiring
  changes; `consumeAuthCallback` / `parseAuthCallbackUrl` / `AuthCallbackScreen`
  are untouched.
- **Any invite/seat/capacity/email-binding rule change** — acceptance stays the
  existing server-side `acceptRoomInvite` Edge invoke; this card adds zero new
  authorization surface.
- **Any Edge Function / migration / RLS / hosted-config / secret change** — none.
  (If, during implementation, an Edge/RLS change appears truly necessary, HALT
  and surface it — per the issue, that would reclassify the card to GATE-C with
  heightened review. The default expectation, confirmed by this design, is
  client-only.)
- **Facebook / Apple** — not in this lane.
- **Native (iOS/Android) Google** — web-first; `app.json` declares no `scheme`.
- **Any room/seat/chime-in/mediator/submission semantics change** — none.
- **`.env` / `package.json` / `app.json` change, new dependency** — none.
- **Deploy / publish / Netlify flag flip** — Claude writes code + tests; the
  operator owns the (already-done) provider config and the runtime flag.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (score is gameplay, never truth)** — no
  score/standing/verdict surface touched; signing in via Google grants no factual
  standing. ✓
- **§2/§3 (heat / popularity not evidence)** — identity is orthogonal to standing;
  a Google account's follower/engagement count grants nothing. ✓
- **§4 (AI moderator limits)** — no AI call; pure auth/intent plumbing. ✓
- **§5 (rules engine sacred)** — the engine is not imported or touched. ✓
- **§6 (secrets policy)** — no client secret, no service-role. The resume path
  uses the public anon `supabase` client only (via the existing Edge invoke). No
  provider/access/refresh token is ever stored or logged; `handleAuthCallbackDone`
  reads only the invite token (never logged) and dispatches it.
  `grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" src/ app/` stays zero. ✓
- **§7 (no AI calls from the app)** — none. ✓
- **§8 (Supabase conventions)** — no migration, no RLS change, no table touched,
  **no direct client insert** to `public.arguments`; acceptance is Edge-invoke-
  only (`acceptRoomInvite` → `manage-room-invite`). RLS untouched. ✓
- **§9 (plain language)** — no new user-facing string is introduced; all
  invite/mismatch/expired/closed copy is the existing plain `inviteCopy` bundle
  (verdict-free, no internal codes). The mismatch path is plain + non-enumerating
  (the client never learns the bound email). ✓
- **§10 (v1 scope "no OAuth") — tension resolved** — ADR #743 ratified the
  Google-only launch scope change; this card is the invite-resume half, not a
  unilateral OAuth introduction. Apple/Facebook remain excluded. ✓
- **§10a (Observations vs Allegations)** — N/A (no node labels). ✓

**supabase-edge-contract** — no Edge Function change, no service-role in client,
no direct insert; acceptance is the existing Edge invoke; the email-binding +
capacity/seat checks stay server-side. ✓

**expo-rn-patterns** — no new dependency, no Bootstrap/icon lib; the only
production change is a React `useCallback` in `App.tsx` reusing existing imports;
pure helpers (if added) carry no React. ✓

**test-discipline** — new pure suite (resume decision) + App source-scan suite +
gate RTL suite; doctrine ban-list / forbidden-token / no-enumeration assertions;
test count goes up; the implementer captures the exact count with an exit 0. ✓

---

## Operator steps (if any)

**To merge:** None — pure client code + tests; not GATE-C (no migration, no Edge
Function, no hosted config write, no secret, no deploy). Automerge-eligible when
green.

**To exercise live (already-provisioned, NOT new for this card):** the resume is
only observable once the operator has (a) enabled the hosted Google provider
(#745, done) and (b) set `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true` in Netlify env +
redeployed (#746 operator step). No NEW operator action is introduced by #748.

**Pre-go-live smoke (operator, GATE-C-style, NOT run by Claude)** — the existing
`AUTH-GOOGLE-SSO-001.md` §9 / READINESS-001 F.4 step 4 covers the invite path:
open an invite link → sign in with Google → confirm auto-accept on email match,
and the plain mismatch/expired/closed state otherwise; confirm email/password
sign-in still works. This card does not change that smoke.

---

## Orchestrator-authored brief ledger

This design was produced from an orchestrator-authored brief (the task prompt),
not an operator-authored card. Per POSTRUN-UX001 discipline, the provenance of
each interpretive decision:

- **Derived from the merged source-of-truth chain (operator-validated):**
  - The OAuth-callback → first-signed-in → gate re-read is the named #748 gap —
    `AUTH-FOUNDATION-INVITE-REDIRECT-001.md` §2 (lines 41-43), restated in
    `AUTH-GOOGLE-SSO-READINESS-001.md` Lane D-3 (lines 183-189, 203) and §8 row
    #748 (line 253).
  - `?code=`→`success` (not `needs_password`) and "no callback change" —
    `AUTH-GOOGLE-SSO-001.md` §3/§6, verified live against `consumeAuthCallback.ts`.
  - The test matrix 748-T1…T7 — `AUTH-GOOGLE-SSO-READINESS-001.md` F.3.
  - #745/#746/#747 status — current-status.md + the merged design docs.
- **Derived from a pre-launch codebase survey (this session's reads):**
  - **Q1 traced end-to-end** against `App.tsx`, `AppSessionProvider.tsx`,
    `sessionState.ts`, `consumeAuthCallback.ts`, `AuthCallbackScreen.tsx`,
    `pendingInviteIntent.ts`, `bridgedInviteToken.ts` — the resume works
    incidentally; the exact re-read seam is the `onDone` handler.
  - **Q2 reachability** — `signInWithGoogle` is invoked ONLY from
    `AuthScreen.tsx:173` (repo grep); the invite gate's `SignedOutPrompt` +
    `InviteCredentialStep` are email/password only; the gate out-ranks
    `AuthScreen` while an intent is live (`App.tsx:338` precedes `:356`); no
    signed-out room target store exists. ⇒ room-intent is unreachable → defer.
  - **Q3** — the intent is persisted at the invite-link cold start
    (`App.tsx:206`) before any button is clickable ⇒ no flush-before-redirect
    needed in `signInWithGoogle`.
  - The App.tsx source-scan test idiom (`appInviteBridgeHandoff.test.ts`) and the
    gate RTL idiom (`InviteRedeemGate.newuser.test.tsx`) as the implementer's
    mirror patterns.
  - Baseline 854 suites / 32,083 tests (current-status.md AUTH-GOOGLE-SSO-003
    entry).
- **Resolved by orchestrator default (not explicit operator direction):**
  - The hardening edit lives in `App.tsx`'s `onDone` handler (a named
    `handleAuthCallbackDone`) rather than inside `AuthCallbackScreen` — keeps the
    callback consumer pure/auth-only and the orchestration in App.tsx where the
    intent + gate already live. **Reviewer may prefer a different seam; the
    trade-off is documented in File changes + Risks.**
  - The optional `decideInviteResume` pure helper is recommended-SKIP (avoid
    drift from the gate's own condition) — flagged for reviewer override.
  - A new gate RTL test FILE (`InviteRedeemGate.oauth.test.tsx`) rather than
    extending `InviteRedeemGate.newuser.test.tsx` — keeps the email-credential
    suite focused; either is acceptable.
  - Q3: reject the belt-and-suspenders flush in `signInWithGoogle` — documented
    with the rejected alternative.
- **Requires operator review post-ship (Operator-deferred review):**
  - Confirm the `App.tsx`-`onDone` seam (vs an alternative) is acceptable.
  - Confirm the room-intent (returnTo) DEFERRAL is the intended call, and file
    the follow-up card when an inline room/gallery Google sign-in is planned.
  - The existing GATE-C live smoke (invite-through-Google) is operator-run after
    the Netlify flag is set; unchanged by this card.

---

## Not GATE-C / automerge note

This card is **NOT GATE-C**: no migration, no Edge Function, no hosted config
write, no secret, no deploy, no service-role. Per the issue's own classification
and the readiness audit (§8 row #748: "likely client-only … GATE-C only if an
Edge/RLS change is needed"), it is a client intent-resume hardening + test card
that is inert until a real Google return occurs (gated by #745 + the operator's
runtime flag, both already handled). It is **automerge-eligible when green**
(typecheck + lint + full test suite pass, reviewer approves). If — contrary to
this design — the implementer finds an Edge/RLS change is genuinely required for
the OAuth redemption path, they must HALT and surface it, reclassifying the card
to GATE-C with heightened review.
