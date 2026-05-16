# CDiscourse — Gamified Copy Map

_Stage 6.1.0 — 2026-05-16_

## Purpose

Maps user-facing copy strings to their internal codes. The source of truth is `src/features/arguments/gameCopy.ts`.

## Rules

- Use **playful labels** in UI display.
- Use **neutral codes** in data and logic layers.
- Never use insulting labels.
- Never claim the system knows truth, winner, or loser.
- "Winner/loser" may be user-declared posture only — never system fact.
- Use "currently ahead" instead of "winner."
- Use "surrendered/conceded" instead of "loser."

---

## Room Copy

| Key | Copy |
|---|---|
| `ROOM_COPY.title` | Argument Room |
| `ROOM_COPY.startArgument` | Start an argument |
| `ROOM_COPY.inviteChallenger` | Invite a challenger |
| `ROOM_COPY.whatAreClaiming` | What are you claiming? |
| `ROOM_COPY.teeUpCounter` | Tee up the obvious counter |
| `ROOM_COPY.dropBasis` | Drop your basis |

---

## Move Copy

| Key | Copy |
|---|---|
| `MOVE_COPY.challenge` | Challenge |
| `MOVE_COPY.clarify` | Clarify |
| `MOVE_COPY.dropReceipts` | Drop receipts |
| `MOVE_COPY.concede` | Concede |
| `MOVE_COPY.narrow` | Narrow it |
| `MOVE_COPY.synthesize` | Synthesize |
| `MOVE_COPY.branchOff` | Branch this off |
| `MOVE_COPY.yourMove` | Your Move |

---

## Receipt Copy

| Key | Copy |
|---|---|
| `RECEIPT_COPY.receipts` | Receipts |
| `RECEIPT_COPY.dropReceipts` | Drop receipts |
| `RECEIPT_COPY.showMeSource` | Show me the source |
| `RECEIPT_COPY.basis` | Basis |

---

## Concession Copy

| Key | Copy |
|---|---|
| `CONCESSION_COPY.concedePoint` | Concede the point |
| `CONCESSION_COPY.surrenderCompletely` | Surrender completely |
| `CONCESSION_COPY.onlyMostlyWrong` | I'm only MOSTLY wrong |
| `CONCESSION_COPY.misunderstoodContext` | I misunderstood the context |
| `CONCESSION_COPY.narrowDispute` | Narrow the dispute |

---

## Resting Status Copy

| Key | Copy |
|---|---|
| `STATUS_COPY.open` | Open |
| `STATUS_COPY.currentlyAhead` | Currently ahead |
| `STATUS_COPY.moreSupported` | More supported |
| `STATUS_COPY.needsReceipts` | Needs receipts |
| `STATUS_COPY.offTrack` | Off track |
| `STATUS_COPY.branchRecommended` | Branch recommended |
| `STATUS_COPY.peaceTreatyIsh` | Peace treaty-ish |
| `STATUS_COPY.mightBothBeWrong` | You might both be wrong |

---

## Timeline / Track Copy

| Key | Copy |
|---|---|
| `TIMELINE_COPY.core` | Core |
| `TIMELINE_COPY.counters` | Counters |
| `TIMELINE_COPY.receipts` | Receipts |
| `TIMELINE_COPY.clarifications` | Clarifications |
| `TIMELINE_COPY.concessions` | Concessions |
| `TIMELINE_COPY.tangents` | Tangents |
| `TIMELINE_COPY.branchThisOff` | Branch this off |
| `TIMELINE_COPY.followThisTrack` | Follow this track |
| `TIMELINE_COPY.backToCore` | Back to core |

---

## Source File

`src/features/arguments/gameCopy.ts`
