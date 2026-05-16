# CDiscourse — Conversation Move Navigation

_Last updated: 2026-05-16_

## What This Is

The Conversation Move Navigator is a deterministic, AI-free UI layer that presents plain-language move options to users composing arguments. It translates colloquial intent ("I want to challenge this") into Constitution-valid argument types (e.g., `rebuttal`).

This is NOT:
- An AI assistant
- A content moderation layer
- A speech-to-text system

This IS:
- A deterministic UI component that derives options from Constitution transition rules
- A mapping layer between user intent and argument type + disagreement axis
- Advisory — the user can override any suggested type via the type picker below

---

## Move Taxonomy

### Root moves (no parent)

| Move | Resulting type | Description |
|---|---|---|
| `start_thesis` | `thesis` | Open a new line of argument |
| `make_claim` | `claim` | Make a substantive, falsifiable assertion |

### Reply moves (up to 5 per parent type, filtered by Constitution)

| Move | Resulting type | Notes |
|---|---|---|
| `challenge_parent` | `rebuttal` or `counter_rebuttal` | Requires challenge axis. Resolves to counter_rebuttal if parent is rebuttal. |
| `ask_clarification` | `clarification_request` | Must end with ? (Constitution enforced). |
| `add_evidence` | `evidence` | Requires at least one source (Constitution enforced). |
| `concede_or_narrow` | `concession` | Acknowledge the parent point has merit. |
| `synthesize_thread` | `synthesis` | Terminal — no further replies allowed. |

---

## Challenge Axes (7)

When `challenge_parent` is selected, users must name the layer of disagreement:

| Axis | Suggested tag | Description |
|---|---|---|
| `fact` | `fact_disagreement` | Dispute a factual claim |
| `definition` | `definition_disagreement` | Challenge how a key term is defined |
| `causal` | `causal_disagreement` | Challenge a cause-and-effect relationship |
| `value` | `value_disagreement` | Challenge underlying values or priorities |
| `evidence` | `evidence_challenge` | Challenge quality or existence of supporting evidence |
| `logic` | `logic_challenge` | Challenge the logical structure or inference |
| `scope` | `scope_challenge` | Challenge the scope or applicability of the argument |

---

## Architecture

```
[User opens ArgumentComposer]
        ↓
[ConversationMoveNavigator]
  ├─ No parent → shows getRootMoveOptions() [2 options]
  └─ Parent selected → shows getReplyMoveOptions(parentType, rules) [≤5 options]
        ↓ (user selects a move)
[mapMoveToDraftPatch(selection, parent, rules)]
  └─ Returns { argumentType, disagreementAxis, targetExcerpt, suggestedTagCodes, moveKind }
        ↓
[handleMovePatch in ArgumentComposer]
  └─ Calls updateField({ argumentType, disagreementAxis, targetExcerpt })
  └─ Merges suggestedTagCodes without duplicates
        ↓
[User can still override type, axis, tags via existing pickers]
        ↓
[Deterministic Constitution validation — always authoritative]
```

---

## File Map

| File | Purpose |
|---|---|
| `src/features/arguments/conversationMoves.ts` | Pure TS model — move taxonomy, axis catalogue, patch mapping |
| `src/features/arguments/ConversationMoveNavigator.tsx` | UI component — chip selectors, axis sub-picker, warnings |
| `__tests__/conversationMoves.test.ts` | 62 tests covering all functions |

---

## What the Navigator Does NOT Do

- Does not call Anthropic or any AI provider
- Does not auto-submit arguments
- Does not override deterministic Constitution rules
- Does not lock users into a move — the type picker below can override any selection
- Does not persist `moveKind` to the draft (Stage 6.0.2 adds that field to `ComposerDraft`)

---

## Progressive Disclosure (MoveStep)

The `getVisibleMoveSteps` function returns the ordered set of composer sections for the current draft state:

```
move_selection → target_excerpt (reply only) → challenge_axis (challenge only) → evidence_fields (evidence) → body → validation_preview
```

---

## Next Steps

- **Stage 6.0.2:** Add `moveKind` to `ComposerDraft` for persistence, add `MoveQualifierPicker`, `QuoteAnchorSelector`, `TurnStatusBadge`, and `UserResponseMarkPicker`.
- **Stage 6.1:** Wire "Process draft" button to call `processLanguageDraft` edge function and display language-processing suggestions.
