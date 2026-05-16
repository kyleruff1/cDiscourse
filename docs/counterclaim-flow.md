# CDiscourse — Counterclaim Flow

_Stage 6.1.0 — 2026-05-16_

## Concept

When starting an Argument Room, a user may optionally tee up the **obvious counter** to their own claim. This makes the room immediately more interesting and invites the other side to respond.

---

## What the Counterclaim Is

- **Optional.** The main claim is required; the counter is not.
- **User-provided.** The user writes the opposing view themselves.
- **Submitted through normal flow.** No direct DB inserts. No bypass of `submit-argument`.
- **Not auto-submitted.** The counter claim draft is modeled and copied, but not submitted unless the user explicitly goes through the compose flow.

---

## UX Copy

| UI Prompt | Copy |
|---|---|
| Main claim prompt | "What are you claiming?" |
| Counter prompt | "Want to tee up the obvious counter?" |
| Basis/receipts | "What receipts or basis do you have?" |
| Context | "Let the other side refute your basis." |
| No basis needed | "You can start clean and add receipts later." |

---

## Data Flow (Stage 6.1.0)

1. User opens "New Argument Room" (creates a debate)
2. User enters title + main claim
3. User optionally enters counter claim text
4. UI calls `createRoomWithOptionalCounterDraft` to validate and preview moves
5. Validation shows user what the initial exchange would look like
6. User submits main claim via existing `submitArgumentDraft` flow
7. Counter claim is not auto-submitted — future stage may submit as the initial reply

---

## Allowed Next Steps (Future Stages)

- Stage 6.1.x: Wire counter claim draft into a second composer pass after room creation
- The counter must go through `submit-argument` Edge Function
- The counter's `parentId` must point to the root claim argument

---

## Source Files

- `src/features/arguments/counterClaim.ts` — pure model helpers
