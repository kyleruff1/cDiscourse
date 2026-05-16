# CDiscourse — Next Prompts

The next recommended session prompts, in order. Run `npm run checkpoint` first to confirm the current stage.

---

## Prompt 1 — Stage 6.0.2: Move Qualifiers, Quote Anchoring, and Turn-Status Governance

> Stage 6.0.1 is complete. The move navigator is wired and 505 tests pass.
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
> - `__tests__/moveQualifiers.test.ts` — qualifier catalogue, `getQualifierOptionsForMove`, `mergeQualifierTags` dedup, `qualifierRequiresSpecificity`.
> - `__tests__/quoteAnchors.test.ts` — tokenizer, range extraction, candidate builder, anchor→excerpt conversion.
> - `__tests__/turnStatus.test.ts` — `deriveTurnStatus` for each of the 11 statuses, `getTurnStatusDisplay` returns label+color, `getUserResponseMarkOptions` returns 9 items.
>
> **Docs:**
> - `docs/conversation-ux-map.md` — full UX flow diagram with qualifier + anchor + status layers.
> - `docs/turn-response-governance.md` — governance rules: what `TurnResponseStatus` means, how `UserResponseMark` is local-only, why concession copy is self-directed.
> - `docs/transcript-language-processor-system-prompt.md` — the exact system prompt used in `anthropicProvider.ts`, documented for review.
>
> ### Hard constraints
> - Do NOT call Anthropic. Do NOT create a new Supabase migration.
> - Do NOT persist `UserResponseMark` to the DB in this stage — local state only.
> - Concession labels must be self-directed: "I'm conceding this point", "I'm narrowing my claim" — never imply the opponent is wrong or manipulative.
> - Do NOT infer manipulation, bad faith, dishonesty, truth, winner, hiding, or banning.
>
> Run `npm run typecheck && npm run lint && npm run test` before finishing.
> Commit: `"feat: Stage 6.0.2 — move qualifiers quote anchoring and turn status UX"`

---

## Prompt 2 — MVP Backend Validation (Supabase Setup)

Before running any of these steps, have Docker Desktop running and a Supabase project created at https://supabase.com.

```bash
# 1. Link the remote project
npx supabase link --project-ref <your-project-ref>

# 2. Push all migrations (0001–0005)
npx supabase db push --linked

# 3. Verify migrations applied cleanly
npx supabase db status
npx supabase db lint

# 4. Set Edge Function secrets
npx supabase secrets set ANTHROPIC_API_KEY=<your-key>

# 5. Deploy the submit-argument Edge Function
npx supabase functions deploy submit-argument

# 6. Create .env from the example (NEVER commit .env)
cp .env.example .env
# Fill in: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

# 7. Relaunch the browser app
npm run web -- --clear
```

Then complete the manual smoke test checklist: `docs/browser-visual-test.md`.

Goal: confirm that end-to-end argument submission (client → Edge Function → DB → argument tree) works with real Supabase.

---

## Prompt 2 — Stage 5.5.5: Viewport Refresh After Submit

> After a successful argument submission, the debate tab's argument tree should refresh automatically to show the newly posted argument.
>
> Current behavior: after `SUBMISSION_SUCCEEDED` and tab switch, the argument tree does not re-fetch. The user must pull-to-refresh manually to see their own argument.
>
> Implement a lightweight refresh mechanism:
> - After `SUBMISSION_SUCCEEDED` dispatched, call `refresh()` from `useArgumentViewport` in the debate-view tab.
> - The cleanest approach: lift a `refreshViewport` callback from `ArgumentTreeScreen` to `App.tsx`, and call it in `handleSubmitSuccess()`.
> - Do not implement realtime subscriptions. Poll or manual-trigger only.
> - Do not add dependencies.
>
> Run `npm run typecheck && npm run lint && npm run test` before finishing.
> Commit with: `"feat: Stage 5.5.5 — refresh argument tree after submit"`

---

## Prompt 3 — Stage 5.6: Expo Router Migration

> Migrate navigation from the manual `useState` tab switcher in `App.tsx` to Expo Router file-based routing.
>
> Install Expo Router: `npx expo install expo-router`.
> Create the file structure under `app/`. Auth guard should redirect unauthenticated users to `app/(auth)/sign-in.tsx`. The debate room and composer should be nested under a debate route. Move `MainAppShell` logic into route files. Keep `AppSessionProvider` wrapping the root layout.
>
> No new features — this is a pure routing migration.
> Run `npm run typecheck && npm run lint && npm run test` before finishing.

---

## Prompt 4 — Stage 5.7: Argument Tree Pagination and Pull-to-Refresh

> Extend `useArgumentViewport` to support cursor-based pagination for root and child arguments (`rootCursor` and per-parent cursors). Add a "Load more" button at the bottom of each expanded node when the server returned exactly `pageSize` results. Add a pull-to-refresh gesture on the tree `ScrollView` that calls `refresh()` from `useArgumentViewport`.
>
> Do not implement realtime subscriptions — manual refresh only.
> Run `npm run typecheck && npm run lint && npm run test` before finishing.

---

## Notes

Stages 5.5.1–5.5.4, 6.0, and 6.0.1 are complete.  
505 tests pass. TypeScript strict mode clean.  
See `docs/current-status.md` for full status.
