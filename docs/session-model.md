# CDiscourse — Session Model

How the app session works, what is persisted where, and how recovery happens after app reopen or mid-session interruption.

---

## Two Separate Session Layers

CDiscourse has two distinct session layers that must not be confused.

### Layer 1 — Supabase Auth Session

Managed entirely by `@supabase/supabase-js`. Persisted to AsyncStorage automatically via the `persistSession: true` option in `src/lib/supabase.ts`. This layer:

- Stores the JWT access token and refresh token
- Auto-refreshes the token before expiry
- Is the only source of truth for whether the user is authenticated
- **Must never be manually read, written, or cleared by app code.** Use `supabase.auth.getSession()` and `supabase.auth.signOut()` only.

The app should never store auth tokens in any other key in AsyncStorage. Supabase owns that space.

### Layer 2 — App Session Snapshot

A separate, app-managed JSON blob stored in AsyncStorage under a key derived from the user's ID (e.g. `cdiscourse:session:<userId>`). This layer:

- Stores which debate is selected, which argument is focused, what is in the composer
- Is best-effort: corrupt or missing data returns null, and the app falls back to the default state
- Is **not** authoritative — it reflects where the user was, not what the server has accepted
- **Never stores tokens, passwords, or sensitive credentials**

Defined in `src/features/session/types.ts` as `AppSessionSnapshot`.

---

## Debate Viewport

The `DebateViewport` describes what the user can see in the argument tree:

- `debateId` — which debate is open
- `focusedArgumentId` — the argument currently highlighted or scrolled to
- `selectedParentId` — the argument the user chose as their reply parent in the composer
- `rootCursor` — an argument id or ISO timestamp cursor for paginated/windowed tree loading; null means load from the top
- `expandedArgumentIds` — arguments whose children are visible
- `collapsedArgumentIds` — arguments whose children are hidden
- `lastLoadedAt` — ISO timestamp of the last successful tree fetch
- `lastSeenArgumentId` — the newest argument id the user has seen; used for "new argument" badges

The viewport is saved to AsyncStorage locally and optionally synced to `public.debate_user_state` on the server (so other devices can resume the same position).

---

## Focused Argument

The focused argument is the node the user last tapped or navigated to. It is used to:

- Scroll the tree to the right position on resume
- Pre-populate `selectedParentId` when the composer opens

Focused argument state is volatile (session only) and does not affect which arguments are visible — that is controlled by `expandedArgumentIds`.

---

## Selected Parent

When the user opens the composer to reply, `selectedParentId` is set to the argument they chose to reply to. The composer uses this to:

- Validate the allowed reply types (via `evaluateArgumentDraft`)
- Pre-fill `parentId` in the `ComposerDraftSession`

If the user taps a different argument before submitting, `selectedParentId` updates and the composer draft is updated accordingly (the `parentId` field on the draft changes).

---

## Draft Recovery

A `ComposerDraftSession` is saved to AsyncStorage on every keystroke (debounced). If the app is killed mid-composition:

1. On next open, `loadSessionSnapshot()` restores the `AppSessionSnapshot`
2. `resolveStatusFromSnapshot()` detects `activeDraft !== null` and sets status to `composing`
3. The UI restores the draft content from the snapshot

Drafts are also saved individually under `cdiscourse:draft:<userId>:<draftId>` and indexed by debate under `cdiscourse:draft-index:<userId>:<debateId>`. This allows listing all drafts for a debate without loading each one.

---

## Idempotent Submit

Every submission attempt generates a `PendingSubmission` with a `clientSubmissionId` (a client-generated UUID). The submission flow:

1. Client generates `clientSubmissionId = crypto.randomUUID()`
2. `PendingSubmission` is saved to the snapshot with `status: 'queued'`
3. Client calls `submitArgumentDraft({ ..., client_submission_id: clientSubmissionId })`
4. Server checks: does a row exist in `public.arguments` with `author_id = user.id AND client_submission_id = provided`?
   - **Yes → return existing argument** (200, `idempotent: true`). No duplicate insert.
   - **No → validate, insert, return new argument** (201). Stores `client_submission_id` in the row.
5. On success, snapshot updates `pendingSubmission.status = 'submitted'`

If the network drops after the server inserts but before the client receives the response, the client retries with the **same** `clientSubmissionId`. The server finds the existing row and returns it. No duplicate argument is created.

The database unique index `idx_arguments_author_client_submission_id` enforces this at the storage layer.

---

## What Happens After App Reopen

| Snapshot state | Resolved status | What the UI shows |
|---|---|---|
| No snapshot | `signed_out` or `unconfigured` | Sign-in screen |
| `userId` but no `selectedDebateId` | `signed_in_no_debate` | Debate list |
| `selectedDebateId` set, no pending/draft | `debate_selected` | Debate room, restored viewport |
| `activeDraft` present | `composing` | Debate room + composer open with draft |
| `pendingSubmission.status = 'queued'` | `recoverable_error` | Error banner with retry option |
| `pendingSubmission.status = 'failed'` | `recoverable_error` | Error banner with retry option |
| `pendingSubmission.status = 'submitting'` | `recoverable_error` | App was closed mid-submit — offer retry |
| `pendingSubmission.status = 'submitted'` | `debate_selected` | Clean state, submission complete |

The `sessionReducer` (`src/features/session/sessionState.ts`) maps `SessionAction` events to these states. It is a pure function — no side effects, no async.
