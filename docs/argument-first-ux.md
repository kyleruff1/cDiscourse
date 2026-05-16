# CDiscourse — Argument-First UX

_Stage 6.0.3 — 2026-05-16_

## Language Direction

CDiscourse uses "argument-first" language in all user-facing surfaces. Internal code and database tables may still use "debate" terminology, but the product communicates around **arguments** and **argument rooms**.

| Old label | New label |
|---|---|
| Debates | Arguments (tab) |
| Debate Room | Argument Room |
| Debate tab | (removed — room is within Arguments tab) |
| Compose tab | (removed — composer opens inline) |
| Create Debate | Start an argument room (future wording) |
| Compose | Your Move |
| Source / evidence | Receipts |

Database tables (`debates`, `debate_participants`) are NOT renamed in this stage. The rename is UI-only.

---

## Top-Level Navigation

### Before (Stage 5.x)

```
Debates | Debate | Compose | Account | Debug
```

- `Debates` — list of rooms
- `Debate` — shown only when room selected
- `Compose` — full-screen tab for argument composition
- `Account` — profile
- `Debug` — dev only

Problems:
- "Compose" is a separate destination that users have to hunt for.
- Two debate tabs is redundant and confusing.
- Having `Compose` adjacent to `Account` implies equal weight.
- Root composition starts from a blank wall of controls.

### After (Stage 6.0.3)

```
Arguments | Account | Debug (dev only)
```

- `Arguments` tab handles everything: list, selected room, and inline composer.
- No separate Compose tab.
- Composer appears inline, replacing the tree while open.

### Within the Arguments Tab

**No room selected:**
Shows the argument room list (currently labeled as debate list — UI label refinement is a later stage).

**Room selected, composer closed:**
```
[Room header — resolution + leave button]
[Argument tree]
[+ Start an argument] ← bottom bar button
```

**Room selected, composer open:**
```
[Your Move header — "Your Move" + Discard button]
[Inline ArgumentComposer — scrollable]
```

The tree is hidden while the composer is open (replace model, not overlay). This avoids scroll-in-scroll complexity.

---

## Composer UX Progression

The composer shows controls in a progressive order that matches how a user thinks:

1. **Conversation Move Navigator** — "Pick your move" (thesis, claim, challenge, etc.)
2. **Target panel** — reply context shown above, quote anchor if replying
3. **Argument type picker** — secondary confirmation (auto-set by move navigator)
4. **Side picker** — Affirmative / Negative / Neutral
5. **Body input** — write the argument
6. **Disagreement axis** — shown only for rebuttals/counter-rebuttals
7. **Tags** — secondary, collapsed by default in a future stage
8. **Receipts (evidence)** — shown but secondary; labeled "Receipts" for tone
9. **Validation preview** — compact summary of Constitution check
10. **Submit button**

Future: hide tags, evidence, and full validation behind an "Advanced structure" collapsible.

---

## Tone and Playful Labels

The product can be playful in display-only labels. These labels never affect internal argument codes or Constitution logic.

**Safe playful labels (use in display metadata only):**
- "I'm only MOSTLY wrong about this" — concession
- "Peace treaty-ish" — concession or synthesis
- "Context goblin defeated" — evidence-driven concession
- "Surrender completely" — full concession
- "Receipt accepted" — acknowledging good evidence

**Hard rules:**
- Never mock the opponent.
- Never shame the user.
- Never call anyone a liar.
- Never say "bad faith" or "manipulation."
- Never infer who won.
- Playful labels are `displayMeta` fields — internal codes stay neutral.

---

## What Is Not Changed in This Stage

- Database table names (`debates`, `debate_participants`) — unchanged
- `DebateListScreen`, `DebateDetailHeader`, `useDebates` — unchanged internally
- `ArgumentComposer` logic — unchanged; only `onClose` prop added and header/copy updated
- `ConversationMoveNavigator` — unchanged
- `submitArgumentDraft` — the only submit path; unchanged
- RLS policies — unchanged
- All Constitution rules — unchanged

---

## Implementation Notes

- `src/features/arguments/roomNavigation.ts` — pure helpers for tab labels and composer visibility state
- `App.tsx` now uses `ArgumentRoomTab = 'arguments' | 'account' | 'debug'`
- `composerOpen: boolean` state in `MainAppShell` replaces the `'composer'` tab
- `handleStartArgument` opens the composer for root arguments
- `handleReply` opens the composer with reply context
- `handleComposerClose` and `handleSubmitSuccess` close the composer
- `handleLeaveRoom` closes composer and deselects the room
