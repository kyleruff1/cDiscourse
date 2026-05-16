# Skill: transcript-lang-min

Staged implementation guide for the CDiscourse language-processing and conversation-move features.
Invoke this skill when continuing Stage 6.x work.

## Scope Guard (read before writing any code)

1. Do NOT call Anthropic from the client. All AI calls go through Supabase Edge Functions only.
2. `AI_LANGUAGE_PROCESSING_ENABLED=false` by default. Never set it to true in app code.
3. Do NOT auto-submit arguments. The user controls every submission.
4. Do NOT infer user intent, winner, truth, bad faith, or manipulation.
5. Do NOT create a new Supabase migration unless the stage explicitly requires one.
6. The deterministic Constitution engine is primary and authoritative. AI is advisory only.

## Stage Map

| Stage | Status | Description |
|---|---|---|
| 6.0 | Complete | Server-only language-processing scaffold (Anthropic + mock providers) |
| 6.0.1 | Complete | Deterministic conversation move navigator (no AI) |
| 6.0.2 | Next | Move qualifiers, quote anchoring, turn-status governance |
| 6.1 | Future | Wire "Process draft" button into ArgumentComposer |
| 6.2 | Future | Speech-to-text integration |

## Stage 6.0.2 Deliverables

### New files
- `src/features/arguments/moveQualifiers.ts` — 25 `MoveQualifierCode` values
- `src/features/arguments/quoteAnchors.ts` — QuoteAnchor, tokenize, buildCandidates
- `src/features/arguments/turnStatus.ts` — TurnResponseStatus (11), UserResponseMark (9)
- `src/features/arguments/MoveQualifierPicker.tsx` — max 5 primary chips + overflow
- `src/features/arguments/QuoteAnchorSelector.tsx`
- `src/features/arguments/TurnStatusBadge.tsx`
- `src/features/arguments/UserResponseMarkPicker.tsx` — local state, no DB
- `__tests__/moveQualifiers.test.ts`
- `__tests__/quoteAnchors.test.ts`
- `__tests__/turnStatus.test.ts`
- `docs/conversation-ux-map.md`
- `docs/turn-response-governance.md`
- `docs/transcript-language-processor-system-prompt.md`

### Modified files
- `src/features/arguments/composerState.ts` — add optional fields: `moveKind?`, `quoteAnchor?`, `primaryMoveQualifierCode?`, `moveQualifierCodes?`, `targetExcerptManuallyEdited?`
- `src/features/arguments/ArgumentComposer.tsx` — wire all new Stage 6.0.2 components

### Constraints (Stage 6.0.2)
- Do NOT call Anthropic
- Do NOT create a new Supabase migration
- Do NOT persist UserResponseMark to DB (local state only)
- Concession copy must be self-directed: "I'm conceding this point" — never mock the opponent

## Key File Locations

| What | Path |
|---|---|
| Move model | `src/features/arguments/conversationMoves.ts` |
| Navigator UI | `src/features/arguments/ConversationMoveNavigator.tsx` |
| Language processing types | `src/features/languageProcessing/types.ts` |
| Edge Function | `supabase/functions/process-language-draft/index.ts` |
| Client wrapper | `src/lib/edgeFunctions.ts` → `processLanguageDraft()` |
| Docs | `docs/transcript-language-processing.md`, `docs/semantic-review.md` |

## Running Tests

```bash
npm run test -- --testPathPattern=conversationMoves
npm run test -- --testPathPattern=languageProcessing
npm run typecheck
npm run lint
```
