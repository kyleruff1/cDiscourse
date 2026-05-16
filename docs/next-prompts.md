# CDiscourse — Next Prompts

The next recommended session prompts, in order. Run `npm run checkpoint` first to confirm the current stage.

---

## Prompt 1 — Stage 6.0.3 Visual Smoke Test (inline composer)

> Stage 6.0.3 is complete. Run the browser smoke test for the new argument-first UX.
>
> Run:
> ```bash
> npm run web -- --clear
> ```
>
> Walk through `docs/browser-visual-test.md` sections A–K:
> - A. App boot — no red screen, Supabase configured
> - B. Auth — sign up, sign in, sign out, refresh preserves session
> - C. Argument rooms — create, list, join, select (was "Debates")
> - D. Argument tree — empty state, existing arguments, reply button
> - E. Inline composer root — "Start an argument" opens "Your Move" composer
> - F. Inline composer reply — "Reply" opens composer with parent context; Discard returns to tree
> - G. Submit — root claim through submitArgumentDraft, argument row visible, tree refreshes
> - H. Server 422 — invalid argument shape, error shown, draft preserved
> - I. Idempotency — retry same payload, no duplicate row
> - J. Session recovery — refresh preserves auth + room + draft state
> - K. Account tab — email, masked ID, role, editable display name
>
> Confirm: no top-level "Compose" tab visible, "Arguments" tab label visible.
>
> Update `docs/live-smoke-debug-log.md` with results. When sections A–K pass, proceed to Prompt 2.

---

## Prompt 2 — Stage 6.0.2: Move Qualifiers, Quote Anchoring, and Turn-Status Governance

> Stage 5.5.5 is complete. Smoke test is complete (or accepted as known gap). 506 tests pass.
>
> Stage 6.0.2 adds three pure-TypeScript/React layers to the composer UX. No DB migration, no Anthropic calls, no persistence for `UserResponseMark`.
>
> ### Deliverables
>
> **New pure-TS models:**
> - `src/features/arguments/moveQualifiers.ts` — 25 `MoveQualifierCode` values. Functions: `getQualifierOptionsForMove(moveKind)`, `getPrimaryQualifierOptionsForMove` (first 5), `getOverflowQualifierOptionsForMove` (rest), `mapQualifierToDraftPatch(code, draft)`, `mergeQualifierTags(existing, incoming)`, `qualifierRequiresSpecificity(code)`.
> - `src/features/arguments/quoteAnchors.ts` — `QuoteAnchor`, `QuoteToken`, `QuoteAnchorCandidate`. Functions: `tokenizeQuoteText(text)`, `getQuoteTextFromRange(tokens, start, end)`, `buildQuoteAnchorCandidates(parentBody)` (returns top 3 sentence-level candidates), `quoteAnchorToTargetExcerpt(anchor)`.
> - `src/features/arguments/turnStatus.ts` — `TurnResponseStatus` union (11 values: 'pending_reply' | 'replied' | 'awaiting_my_response' | 'conceded' | 'synthesized' | 'evidence_added' | 'clarified' | 'challenged' | 'counter_challenged' | 'stale' | 'resolved'). `UserResponseMark` union (9 values: 'noted' | 'bookmarked' | 'agree' | 'partially_agree' | 'disagree' | 'needs_more_evidence' | 'conceding_this' | 'challenging_this' | 'skipping_for_now'). Functions: `deriveTurnStatus(argument, parentArgument, childArguments)`, `getUserResponseMarkOptions()`, `getTurnStatusDisplay(status)` → `{ label, color, icon }`.
>
> **New UI components:**
> - `src/features/arguments/MoveQualifierPicker.tsx` — shows up to 5 primary qualifiers as chips + "More flavor" expander for overflow. Emits `onQualifierToggle(code)`.
> - `src/features/arguments/QuoteAnchorSelector.tsx` — shows "Be specific: [quote]" button when parent body available. Falls back to manual text input. Emits `onAnchorSelect(excerpt)`.
> - `src/features/arguments/TurnStatusBadge.tsx` — compact pill badge for `ArgumentNode`. Props: `status: TurnResponseStatus`. Read-only display.
> - `src/features/arguments/UserResponseMarkPicker.tsx` — shows 9 `UserResponseMark` options. Local `useState` only — no DB call. Emits `onMarkSelect(mark)`. Concession copy must be self-directed ("I'm conceding this point") — never mock the opponent.
>
> **State updates:**
> - Add optional fields to `ComposerDraft` in `composerState.ts`: `moveKind?: ConversationMoveKind | null`, `quoteAnchor?: string | null`, `primaryMoveQualifierCode?: string | null`, `moveQualifierCodes?: string[]`, `targetExcerptManuallyEdited?: boolean`.
> - Update `draftToSession` / `sessionToDraft` to round-trip these new fields.
>
> **Wire into ArgumentComposer:**
> - Below the `ConversationMoveNavigator`, add `MoveQualifierPicker` (shown when `moveKind` is set).
> - Add `QuoteAnchorSelector` in the target excerpt area (shown when `parentArgument` is set).
> - Add `UserResponseMarkPicker` below the body input (shown always when `parentArgument` is set).
>
> **Tests (3 new files):**
> - `__tests__/moveQualifiers.test.ts`
> - `__tests__/quoteAnchors.test.ts`
> - `__tests__/turnStatus.test.ts`
>
> **Docs:**
> - `docs/conversation-ux-map.md`
> - `docs/turn-response-governance.md`
> - `docs/transcript-language-processor-system-prompt.md`
>
> **Hard constraints:**
> - Do NOT call Anthropic. Do NOT create a new Supabase migration.
> - Do NOT persist `UserResponseMark` to the DB — local state only.
> - Concession labels must be self-directed: "I'm conceding this point" — never imply the opponent is wrong.
>
> Run `npm run typecheck && npm run lint && npm run test` before finishing.
> Commit: `"feat: Stage 6.0.2 — move qualifiers quote anchoring and turn status UX"`

---

## Prompt 3 — Stage 6.0.3: Visual Smoke Test of Move Navigator UX

> After Stage 6.0.2, run a visual smoke test of the new UX in the browser:
> - Move navigator shows correct chips (2 root / up to 5 reply)
> - Challenge axis sub-picker appears
> - Qualifier chips appear and toggle
> - Quote anchor selector shows parent sentences
> - Turn status badge renders
> - UserResponseMarkPicker shows 9 options, local state only

---

## Prompt 4 — Stage 6.1: Wire "Process Draft" Button (AI Advisory)

> Only after: smoke test complete, ANTHROPIC_API_KEY rotated, Stage 6.0.2 complete.
>
> Wire a "Help me structure this" button into `ArgumentComposer` that calls `processLanguageDraft` and displays suggestions in a review panel. The AI suggestion step is never in the critical path — it never gatekeeps submission.
>
> Do NOT call Anthropic automatically on every keystroke. User must tap the button explicitly.
> Do NOT let AI suggestions override deterministic Constitution validation.
> Do NOT auto-submit from AI suggestions.

---

## Notes

Stage 6.0.3 complete as of 2026-05-16.
Infrastructure live: project `qsciikhztvzzohssddrq`, migrations applied (0001–0006), `submit-argument` ACTIVE.
Argument-first UX (inline composer, no Compose tab), fixture skills, and 4 fixture scenarios committed.
594 tests pass. TypeScript strict mode clean.

**Safe to run fixture counter-test: YES — use `/argument-counter-runner sports-play-in`.**
**Safe to continue Stage 6.0.2: YES — after smoke test passes.**

See `docs/current-status.md` for full status.
