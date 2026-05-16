# CDiscourse — Next Prompts

The next three recommended session prompts, in order. Run `npm run checkpoint` first to confirm the current stage.

---

## Prompt 1 — Stage 5.5.1: Composer State, Draft Identity, Draft Persistence Hook

> Implement Stage 5.5.1: composer state management and draft persistence.
>
> **Do not build any UI yet. Do not call submitArgumentDraft. Do not add dependencies.**
>
> Build `src/features/arguments/useComposerDraft.ts` — a hook the ComposerScreen will consume.
>
> What the hook must do:
> - Accept `(debateId: string)` as argument.
> - On mount, check `state.snapshot.activeDraft`. If one exists for this debateId, adopt it. Otherwise create a fresh `ComposerDraftSession` with a newly generated UUID for `draftId` and dispatch `DRAFT_STARTED`.
> - Expose `draft: ComposerDraftSession | null`, `updateDraft(patch: Partial<ComposerDraftSession>)`, and `clearDraft()`.
> - `updateDraft` must: dispatch `DRAFT_UPDATED` to the session reducer, then debounce-save to AsyncStorage via `saveDraft` from `src/features/session/sessionStorage.ts` (300–500ms debounce).
> - `clearDraft` must: dispatch `DRAFT_CLEARED`, then call `deleteDraft` from `sessionStorage.ts`.
> - Use `getParentArgumentForComposer` from `src/features/arguments/composerHandoff.ts` to expose `parentArgument: ArgumentRow | null` derived from the viewport.
> - UUID generation: use `crypto.randomUUID()` — it is available in Hermes (React Native ≥ 0.71) without a dependency.
>
> Note: `ComposerDraftSession`, `DRAFT_STARTED`, `DRAFT_UPDATED`, `DRAFT_CLEARED` are all already implemented in `src/features/session/`. `saveDraft` / `deleteDraft` / `loadDraft` are in `src/features/session/sessionStorage.ts`. No new session actions are needed.
>
> Wire `selectReplyTarget` / `clearReplyTarget` from `composerHandoff.ts` into `useArgumentViewport` so that tapping any `ArgumentNode` in the tree dispatches `SELECT_PARENT` and optionally auto-switches to the Compose tab.
>
> Write tests in `__tests__/composerDraft.test.ts` covering:
> - Fresh draft creates a new UUID on first call.
> - Adopts existing activeDraft rather than creating a duplicate.
> - `updateDraft` dispatches DRAFT_UPDATED with the patch merged correctly.
> - `clearDraft` dispatches DRAFT_CLEARED.
>
> Run `npm run typecheck && npm run lint && npm run test` before finishing.
> Commit with: `"feat: Stage 5.5.1 — useComposerDraft hook and draft persistence"`

---

## Prompt 2 — Stage 5.5.2: Composer UI and Client-Side Constitution Preview (No Submit)

> Implement Stage 5.5.2: the Composer screen UI with live client-side validation preview.
>
> **Do not call submitArgumentDraft yet. Do not implement realtime, pagination, audio, or semantic AI. Do not add dependencies.**
>
> Build `src/features/arguments/ComposerScreen.tsx`. Wire it into `App.tsx` so `activeTab === 'composer'` renders `<ComposerScreen debate={currentDebate} />` (replacing the current EmptyState). Show an EmptyState when no debate is selected.
>
> The screen must use `useComposerDraft` (from Stage 5.5.1) and must:
> - Load constitution data (rules, tagDefs, flagDefs) from Supabase via a `useConstitution(constitutionId: string)` hook in `src/features/arguments/useConstitution.ts`. Fetch once per debate selection; show a loading indicator while fetching.
> - Show a parent argument preview bar (using `getParentArgumentForComposer`) with a "× Clear reply target" control.
> - Show an argument type selector limited to `getAllowedReplyTypesForParent(cache, viewport, rules, ['thesis', 'claim'])`.
> - Show a `body` multiline TextInput. Enforce the character limit from the `C-LENGTH-001` rule (`length_body` in `constitution_rules`) — show a character counter.
> - Show a `target_excerpt` TextInput only when a parent is selected.
> - Show a `disagreement_axis` picker only when argumentType is `rebuttal` or `counter_rebuttal`.
> - Call `evaluateArgumentDraft` from `src/domain/constitution/evaluateArgumentDraft.ts` on every draft change (debounced 300ms). Display blocking errors as red inline banners. Display warnings as amber banners. All banners are informational only — do not block the user from editing.
> - Show a disabled "Submit" button (grayed out, no action) as a visual placeholder. Label it "Submit argument".
> - Use only React Native primitives: View, Text, TextInput, Pressable, ScrollView.
>
> The `useConstitution` hook fetches from: `constitution_versions` (by id), `constitution_rules` (where constitution_id = ? AND enabled = true), `tag_definitions` (enabled = true), `flag_definitions` (enabled = true). Use `adaptDbConstitutionVersion`, `adaptDbRule`, `adaptDbTagDef`, `adaptDbFlagDef` from `src/domain/constitution/dbAdapters.ts` on the raw rows.
>
> Add tests for `useConstitution` hook behavior (mock Supabase) in `__tests__/useConstitution.test.ts`.
>
> Run `npm run typecheck && npm run lint && npm run test` before finishing.
> Commit with: `"feat: Stage 5.5.2 — ComposerScreen UI with live validation preview"`

---

## Prompt 3 — Stage 5.5.3: Submit via submitArgumentDraft with Idempotency and Error Handling

> Implement Stage 5.5.3: wire the "Submit argument" button to the Edge Function.
>
> **Do not add dependencies. Do not implement realtime. Do not insert posted arguments directly — always use submitArgumentDraft.**
>
> The submit flow must be:
> 1. On button press: generate a new UUID for `clientSubmissionId`, dispatch `SUBMISSION_QUEUED` with a `PendingSubmission` record.
> 2. Dispatch `SUBMISSION_STARTED`.
> 3. Call `submitArgumentDraft` from `src/lib/edgeFunctions.ts` with the full payload from the draft, passing `client_submission_id: pendingSubmission.clientSubmissionId`.
> 4a. On `ok: true`: dispatch `SUBMISSION_SUCCEEDED`, dispatch `DRAFT_CLEARED`, call `deleteDraft` from `sessionStorage.ts`, auto-switch to the `current_debate` tab, show a transient success banner on the tree screen.
> 4b. On `ok: false`: dispatch `SUBMISSION_FAILED` with the error string. Show the error inline in the ComposerScreen with a "Retry" button. Retry must reuse the same `clientSubmissionId` (idempotency).
>
> Note: `SUBMISSION_QUEUED`, `SUBMISSION_STARTED`, `SUBMISSION_SUCCEEDED`, `SUBMISSION_FAILED`, `ERROR_CLEARED` are already implemented in `src/features/session/sessionState.ts`. Do not add new session actions.
>
> The submit button must be disabled while `state.status === 'submitting'` and while `evaluateArgumentDraft` returns any `blockingErrors`.
>
> Display returned flags from the Edge Function response as dismissible amber/red banners in the tree screen (non-authoritative, `authoritative = false` is always implied for AI-sourced flags).
>
> Run `npm run typecheck && npm run lint && npm run test` before finishing.
> Commit with: `"feat: Stage 5.5.3 — submit argument via Edge Function with idempotency"`

---

## Prompt 4 — Stage 5.6: Expo Router Migration

> Migrate navigation from the manual `useState` tab switcher in `App.tsx` to Expo Router file-based routing.
>
> Install Expo Router (`npx expo install expo-router`). Create the file structure under `app/`. Auth guard should redirect unauthenticated users to `app/(auth)/sign-in.tsx`. The debate room and composer should be nested under a debate route. Move `MainAppShell` logic into route files. Keep `AppSessionProvider` wrapping the root layout.
>
> No new features — this is a pure routing migration. Run `npm run typecheck && npm run lint && npm run test` before finishing.

---

## Prompt 5 — Stage 5.7: Argument Tree Refresh + Pagination

> Implement Stage 5.7: argument tree pagination and background refresh.
>
> Extend `useArgumentViewport` to support cursor-based pagination for root and child arguments (`rootCursor` and per-parent cursors). Add a "Load more" button at the bottom of each expanded node when the server returned exactly `pageSize` results. Add a pull-to-refresh gesture on the tree `ScrollView` that calls `refresh()` from `useArgumentViewport`.
>
> Do not implement realtime subscriptions — polling only when user explicitly refreshes.
>
> Run `npm run typecheck && npm run lint && npm run test` before finishing.
