# CDiscourse — Next Prompts

The next three recommended session prompts, in order. Run `npm run checkpoint` first to confirm the current stage.

---

## Prompt 1 — Stage 5.5: Argument Composer Screen

> Implement Stage 5.5: the Argument Composer screen (the "Compose" tab in the main shell).
>
> The Composer tab (`activeTab === 'composer'`) should show a compose form for the debate currently selected in `state.snapshot.selectedDebateId`. If no debate is selected, show an EmptyState.
>
> The composer must:
> - Use `getParentArgumentForComposer` and `getAllowedReplyTypesForParent` from `src/features/arguments/composerHandoff.ts` to determine what type of argument can be posted (root or reply).
> - Show an argument type selector (tabs or picker) limited to allowed types from the constitution rules.
> - Show a body input (multiline TextInput, max 1000 chars per `C-LENGTH-001`).
> - Show a target excerpt input (optional — only for reply arguments).
> - Show a disagreement axis picker (only for `rebuttal` / `counter_rebuttal`).
> - Run `evaluateArgumentDraft` from `src/domain/constitution/evaluateArgumentDraft.ts` on change to display inline blocking errors and warnings before submit.
> - On submit, call `submitArgumentDraft` from `src/lib/edgeFunctions.ts` with a client-generated UUID in `client_submission_id` (use `PendingSubmission.clientSubmissionId`).
> - After successful submit, dispatch `ARGUMENT_SUBMITTED` to the session reducer and clear the draft.
> - Do NOT directly insert posted arguments into `public.arguments` — always use the Edge Function.
> - Do NOT implement realtime subscriptions, moderation queue UI, or audio.
>
> Wire `selectReplyTarget` / `clearReplyTarget` from `composerHandoff.ts` so that tapping an `ArgumentNode` in the tree sets the reply target and auto-switches to the Compose tab.
>
> Store drafts in `state.snapshot.activeDraft` (already typed in session). Sync the draft to AsyncStorage via the session reducer's `DRAFT_UPDATED` action.
>
> Run `npm run typecheck && npm run lint && npm run test` before finishing.

---

## Prompt 2 — Stage 5.6: Expo Router Migration

> Migrate navigation from the manual `useState` tab switcher in `App.tsx` to Expo Router file-based routing.
>
> Install Expo Router (`npx expo install expo-router`). Create the file structure under `app/`. Auth guard should redirect unauthenticated users to `app/(auth)/sign-in.tsx`. The debate room and composer should be nested under a debate route. Move `MainAppShell` logic into route files. Keep `AppSessionProvider` wrapping the root layout.
>
> No new features — this is a pure routing migration. Run `npm run typecheck && npm run lint && npm run test` before finishing.

---

## Prompt 3 — Stage 5.7: Argument Tree Refresh + Pagination

> Implement Stage 5.7: argument tree pagination and background refresh.
>
> Extend `useArgumentViewport` to support cursor-based pagination for root and child arguments (`rootCursor` and per-parent cursors). Add a "Load more" button at the bottom of each expanded node when the server returned exactly `pageSize` results. Add a pull-to-refresh gesture on the tree `ScrollView` that calls `refresh()` from `useArgumentViewport`.
>
> Do not implement realtime subscriptions — polling only when user explicitly refreshes.
>
> Run `npm run typecheck && npm run lint && npm run test` before finishing.
