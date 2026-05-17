# Argument Stack + Timeline Game Surface

_Stage 6.1.8 — 2026-05-17_

## What this is

A new interactive surface for the argument-room screen. Replaces the comment-thread feel with a stack of overlapping bubble cards (latest message always on top) plus a horizontal DAW/sleep-map-style timeline scrubber. The user always sees the most recent message first.

This stage is **UI-only except for one migration + one Edge Function** (deletion request workflow). No Anthropic, xAI, or X API calls. The Admin Arguments table + Debate list table from Stage 6.1.6b remain unchanged — only the argument-room interaction surface is replaced.

## Modes

- **Stack Mode** (default): overlapping bubble cards. Latest active. Older cards fan up + rotate slightly behind the active one with reduced scale + opacity. Tap a non-active bubble to bring it forward. Long-press toggles modes; the explicit toggle button works on every platform.
- **Timeline Mode**: horizontal scrubber. One marker per message. Beginning / middle / end timestamps below the rail (DAW-inspired). Tap a marker to activate that message. Scrubber is horizontally scrollable.

Both modes share an `activeMessageId`. Switching modes never resets it.

## Bubble controls (actor-aware)

| Actor       | Allowed controls |
| ---         | --- |
| Self        | `view_qualifiers`, `request_deletion` (only when no open request) |
| Other       | `reply`, `disagree`, `flag`, `ask_for_source`, `ask_for_quote`, `branch`, `view_qualifiers` |
| Bot         | Same as Other (interactable, not deletable by viewer) |
| Admin       | Other-set; admin-only moderation controls remain on the Admin surface, not here |

**No body-edit affordance is exposed anywhere.** Posted message bodies are immutable. The control union does not include `edit` and the deterministic test asserts that.

## Title behavior

The debate title is optional and **independent from the root argument body**.

- If `debate.title` is non-empty → show it.
- Else → display root claim body excerpt.
- Else → display `Untitled argument`.

Editing the title:
- Goes through `updateDebateTitle(debateId, title)` in `src/features/debates/debateTitleApi.ts`.
- Updates only `public.debates.title`. Never touches `public.arguments.body`.
- Authorization is enforced by RLS on `public.debates` (creator OR admin).
- Max 120 chars. Empty allowed (means "fall back to excerpt").
- Trims whitespace + strips control characters before submit.

## Deletion request workflow

Posted bodies are immutable, but a user can **request** deletion of their own argument. An admin reviews and decides; this stage does NOT perform deletion.

### Data model (migration 0008)

`public.argument_deletion_requests`:
- `id`, `debate_id`, `argument_id`, `requester_id`, `reason`, `status`, `created_at`, `resolved_at`, `resolved_by`, `admin_note`
- `status` ∈ `requested | reviewing | approved | rejected | cancelled`
- One open request per `(argument_id, requester_id)` via a partial unique index
- RLS:
  - INSERT: only the argument's author can insert a request for it
  - SELECT: requester sees own; admins see all
  - UPDATE: admins only (`is_admin(auth.uid())`)

### Edge Function: `request-argument-deletion`

JWT-verified. Validates UUIDs. Re-uses existing open requests. Writes an `admin_audit_events` row best-effort. Optionally sends an admin email via Resend.

Environment variables (none required):
- `RESEND_API_KEY` — when absent, request is still recorded; response carries `emailStatus: "not_configured"`.
- `ADMIN_NOTIFICATION_FROM` — sender (e.g. `CDiscourse Admin <no-reply@…>`).
- `ADMIN_NOTIFICATION_REPLY_TO` (optional)
- `APP_BASE_URL` (optional) — used to build a link in the email body.

Email body includes:
- short request id
- short requester id
- short debate id
- short argument id
- redacted reason (max 600 chars)
- admin link (if `APP_BASE_URL` is configured)
- a line stating "admin must review and delete manually from the admin tooling"

**Never includes** auth tokens, provider secrets, full JWTs, or admin email addresses in the response payload.

### Client flow

Own bubble's `Request deletion` action → `DeletionRequestSheet` modal → optional reason → `requestArgumentDeletion(...)` → success copy explains:
- `sent`: "An admin notification email has been sent."
- `not_configured`: "Admin email notifications are not configured yet."
- `failed_sanitized`: "The notification email could not be sent; the request itself is recorded."

The bubble's `Request deletion` button is suppressed while an open request already exists (the chip becomes `Deletion requested`).

## Component map

| File | Role |
| --- | --- |
| `src/features/arguments/argumentGameSurface.ts` | Pure TS types + helpers. |
| `src/features/arguments/ArgumentGameSurface.tsx` | Mode-switching orchestrator. |
| `src/features/arguments/ArgumentBubbleStack.tsx` | Overlapping 3D-ish stack. |
| `src/features/arguments/ArgumentTimelineScrubber.tsx` | Horizontal DAW-style rail. |
| `src/features/arguments/ArgumentBubbleCard.tsx` | One card / one expanded marker. |
| `src/features/arguments/ArgumentBubbleActions.tsx` | Orbit-style action chips. |
| `src/features/arguments/ArgumentDraftQualifierCards.tsx` | Pop-out advisory cards on the draft surface. |
| `src/features/arguments/DeletionRequestSheet.tsx` | Modal sheet for own-bubble deletion request. |
| `src/features/debates/debateTitleHelpers.ts` | Pure validator + display helpers. |
| `src/features/debates/debateTitleApi.ts` | `updateDebateTitle` (RLS-gated). |
| `src/lib/edgeFunctions.ts` | `requestArgumentDeletion` wrapper. |
| `supabase/migrations/20260517000008_stage6_1_8_argument_deletion_requests.sql` | Migration + RLS. |
| `supabase/functions/request-argument-deletion/index.ts` | Edge Function. |

## Safety

- No Anthropic / xAI / X API call.
- No bypass of `submit-argument`. No direct insert into `public.arguments`.
- No message-body edit affordance anywhere.
- No service-role usage in client code.
- No admin email addresses are returned to the client.
- The system never labels speakers `winner` / `loser` / `liar` / `dishonest` / `bad faith` / `manipulative` / `extremist` / `propagandist` / `troll` / `bot` / `astroturfer`. Verdict tokens are defensively redacted from displayed titles and bodies as a backstop.
- The deletion-request workflow is REQUEST-ONLY. No row in `public.arguments` is auto-deleted.
- Email provider missing is graceful — the request is still recorded and the user gets a safe message.

## Manual browser verification

1. `npm run web -- --clear`
2. Sign in as a normal user.
3. Open any debate room. Confirm:
   - The room renders the new game surface.
   - Latest message is on top of the stack.
   - Mode toggle button flips between `Stack` and `Timeline`.
   - Active card shows action chips matching the actor (own vs other).
   - Own bubble's `Request deletion` opens the sheet.
   - Submitting with a Resend env absent shows the "not configured" copy.
4. Open Admin → Arguments and Debate list. Confirm they are still sortable tables (Stage 6.1.6b unchanged).

## What this stage did NOT change

- Admin Arguments table — still sortable Created / Last Updated columns.
- Debate list table — still sortable Created / Last Updated columns.
- `submit-argument` Edge Function — unchanged.
- `public.arguments` — schema unchanged; no body editing path added.
- xAI / Anthropic adapters — untouched.
