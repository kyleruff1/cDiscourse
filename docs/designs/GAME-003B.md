# GAME-003B — Argument Setup Screen — Design Stub

**Status:** Design stub — created 2026-05-21. The prefix `GAME-003B` is legacy
(it follows GAME-003 "argument modes"); **user-facing copy must never call this
a "game".**

> **Naming note.** The card prefix stays `GAME-003B` for roadmap continuity
> (renaming a roadmap prefix is churn). The *screen* is named, in all
> normal-user copy, **"Argument setup"** / **"Start an argument"** — never
> "game", never "debate".

## Source storyboards / source analysis

- `docs/ux-storyboards/roommates-dishes-public-argument.md` — Steps 1–3:
  "Start an argument" → compose screen → root claim.
- `docs/ux-storyboards/band-space-rent-private-evidence-argument.md` — Step 1:
  private argument started, respondent invited, optional title.
- `docs/designs/QOL-030.md` — the `root_claim` box type carries room setup.
- `docs/current-status.md` — GAME-003 "argument modes" complete; GAME-003B
  (the mode setup screen) named as the follow-up.

## Problem statement

Starting an argument needs a setup step: title, visibility, invited respondent,
observer/chime-in policy, argument mode, and category tags. Today there is no
coherent setup screen — and the legacy `CreateDebateForm` is a bespoke screen
that uses discouraged "debate" wording. The one-box composer (QOL-030) makes the
`root_claim` box the first interaction; the setup fields need a home that feeds
that box.

## Why this card matters now

- QOL-030's `root_claim` box is the *only* box that also configures the room —
  GAME-003B defines those configuration fields.
- `CreateDebateForm` is a bespoke surface flagged for retirement; its
  replacement must exist before it is retired (P10).
- The terminology audit flags `CreateDebateForm` copy ("New Debate", "Create
  Debate"); GAME-003B is the doctrine-clean replacement.

## User-facing behavior

- The entry action is **"Start an argument"** (already the live label).
- It opens the one-box composer in `root_claim` type, with a setup panel.
- The user enters an optional title, picks visibility, optionally invites a
  respondent, sets observer/chime-in policy and argument mode, and posts the
  root claim — all without leaving the box.

## Data / semantic fields needed

Setup fields (feed the QOL-030 `root_claim` box + the new room record):

| Field | Notes |
|---|---|
| `title` | optional; **falls back to a root-claim excerpt** when blank; never mutates `arguments.body` |
| `visibility` | `public` / `private` (default public unless marked private) |
| `invitedRespondentEmail?` | email-only invite (see QOL-038) |
| `observerPolicy` | whether observers may watch (public rooms) |
| `chimeInAllowed` | whether chime-ins are permitted |
| `argumentMode` | the GAME-003 mode (consented strictness profile) |
| `evidenceExpected` | a hint flag, advisory |
| `categoryTags` | room category / semantic tags |

## UI states

- Composing root claim — setup panel visible.
- Private vs public selected — private hides the room from public lists.
- Invite pending vs no invite.
- Validation: a non-empty root claim is required to post; everything else
  optional.

Normal-user labels: **"Public argument" · "Private argument" · "Invite
respondent" · "Add evidence later" · "Allow chime-ins" · "Argument setup" ·
"Start argument"**.

**Forbidden labels:** "Start a game", "Start a debate", "Debate mode",
"Debate room", "Player".

## Permission / rules implications

- Anyone may start an argument; the creator is the first participant.
- Visibility default is public unless explicitly set private.
- The invite path is email-only (QOL-038 owns the auth-return routing).
- Posting the root claim goes through `submit-argument` — no direct insert.

## Dependencies

- QOL-030 — the one-box composer (`root_claim` box type).
- GAME-003 — the `argumentMode` vocabulary (shipped).
- QOL-038 — invite → signup/auth → room return path.
- QOL-039 — public ↔ private visibility rules.
- The Conversation Gallery (Epic 11) — a newly-created room must appear as one
  card.

## Supersedes / superseded-by

GAME-003B **supersedes the bespoke `CreateDebateForm`** surface. `CreateDebateForm`
is retired (P10) only after GAME-003B is implemented and tested. The internal
`debates` table is **not** renamed.

## Out of scope

- The invite backend / auth deep link (QOL-038).
- Visibility-transition rules after creation (QOL-039).
- Evidence upload storage.
- Voting / promotion.

## Acceptance criteria

- The setup screen feeds the QOL-030 `root_claim` box and the gallery state.
- **No user-facing "game" or "debate" term** — verified by
  `npm run ux:terminology:audit`.
- Title is optional and falls back to a root-claim excerpt; updating the title
  never mutates `arguments.body`.
- Public/private chosen before send; private rooms never appear on public lists.
- Root claim posts via `submit-argument`; no service-role, no direct insert.

## Test targets

- Setup field model — defaults, title fallback, visibility default.
- Terminology — no "game" / "debate" / "player" in any produced label.
- The root-claim post path uses `submit-argument`.
- A created room surfaces as exactly one gallery card.

## Implementation notes

- Build as a setup panel *inside* the QOL-030 `root_claim` box — not a separate
  bespoke screen.
- Reuse the GAME-003 `argumentModeModel` for the mode picker.
- `CreateDebateForm` stays until GAME-003B is green, then is retired in P10.

## Open questions

- Is `argumentMode` selectable at setup, or defaulted with a later change path?
  (Lean: selectable, with `casual` default — GAME-003's `DEFAULT_ARGUMENT_MODE`.)
- Do category/semantic tags reuse the existing qualifier vocabulary or a new
  closed room-category list?
- Should observer policy be a room-creation choice or always-on for public
  rooms? (Lean: always-on for public; the choice is chime-in permission.)
