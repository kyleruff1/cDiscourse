# CDiscourse — Testing Gap Audit

_Stage 5.5.4.5 — created 2026-05-16_

Current baseline: **386 tests, 12 suites** — all pass. Typecheck and lint clean.

This document maps every meaningful behavior in the codebase against what is actually tested. Use it to prioritize which gaps to fill before MVP demo or before each backend validation milestone.

---

## Status Key

- ✅ Tested — automated test exists
- ⚠️ Partially tested — behavior is reachable but edge cases are missing
- ❌ Not tested — no automated test exists (may be manually tested or blocked by Supabase)
- 🔲 Blocked — cannot be tested until Supabase is configured / Docker running

---

## A. Auth / Session

| Behavior | Existing test file(s) | Status | Notes | Needs Supabase | Priority |
|---|---|---|---|---|---|
| `SUPABASE_CONFIGURED = false` → app dispatches `SIGNED_OUT` on boot | — | ❌ | `AppSessionProvider` has this branch; only covered by browser visual check | No | **High** |
| `validateAuthInput` — valid email/password | `sessionBoot.test.ts` | ✅ | Full coverage across 7 cases | No | — |
| `validateAuthInput` — invalid cases | `sessionBoot.test.ts` | ✅ | Empty, short password, bad email | No | — |
| Auth state boot: INITIAL_SESSION fires with null session → `SIGNED_OUT` | `sessionBoot.test.ts` | ✅ | Reducer path tested | No | — |
| Auth state boot: INITIAL_SESSION fires with user → `SNAPSHOT_RESTORED` or `SIGNED_IN` | `sessionBoot.test.ts` | ✅ | Via reducer | No | — |
| Sign-out clears all session state | `sessionBoot.test.ts`, `session.test.ts` | ✅ | Multiple scenarios including composing, recoverable_error | No | — |
| Corrupt session snapshot → `SIGNED_IN` fallback | `session.test.ts`, `sessionBoot.test.ts` | ✅ | Null, array, string, malformed JSON | No | — |
| No token stored in code (security audit) | checkpoint secret scan | ✅ | `ANTHROPIC_API_KEY`/`SERVICE_ROLE_KEY` absent from `src/app/` | No | — |
| `signInWithEmailPassword` actually calls Supabase | — | ❌ | `authApi.ts` calls `supabase.auth.signInWithPassword`; not tested with mock | Yes (mock) | Medium |
| `signUpWithEmailPassword` calls Supabase | — | ❌ | Same — no mock test for API layer | Yes (mock) | Medium |
| `signOut` clears Supabase session | — | ❌ | Not tested | Yes (mock) | Low |

**Missing unit test:** `SUPABASE_CONFIGURED = false` path in `AppSessionProvider` — mock `SUPABASE_CONFIGURED = false` in a provider test to verify `SIGNED_OUT` is dispatched without calling `supabase.auth.onAuthStateChange`.

---

## B. Debate Lifecycle

| Behavior | Existing test file(s) | Status | Notes | Needs Supabase | Priority |
|---|---|---|---|---|---|
| `DEBATE_SELECTED` sets debateId, clears draft/viewport | `session.test.ts`, `debates.test.ts`, `sessionBoot.test.ts` | ✅ | Full reducer coverage | No | — |
| `VIEWPORT_UPDATED` does not overwrite dirty draft | `debates.test.ts` | ✅ | Explicitly tested | No | — |
| `isAlreadyJoinedError` (23505 code) | `debates.test.ts` | ✅ | And negative cases | No | — |
| Full debate flow sequence (reducer) | `debates.test.ts` | ✅ | Sign-in → select → viewport → deselect | No | — |
| `listDebates` API call (Supabase) | — | ❌ | `debatesApi.ts` not unit tested | Yes (mock) | High |
| `createDebate` API call (Supabase) | — | ❌ | Not tested | Yes (mock) | High |
| `joinDebate` actual Supabase call | — | ❌ | Join error normalization tested; API call not | Yes (mock) | Medium |
| RLS error display for unauthorized access | — | 🔲 | Requires live Supabase + RLS policies applied | Yes (live) | High |
| Debate detail data fetched after selection | — | 🔲 | `useCurrentDebate` — not unit tested | Yes (mock) | Medium |
| Debate status transitions (open → closed) | — | ❌ | No status-gate tests | Yes (live) | Low |

**Missing unit test:** Mock `supabase.from` to verify `listDebates`, `createDebate`, `joinDebate` call the correct table with correct `.select/.insert/.upsert` chains and map results to `Debate[]`.

---

## C. Argument Viewport / Cache

| Behavior | Existing test file(s) | Status | Notes | Needs Supabase | Priority |
|---|---|---|---|---|---|
| `mergeArguments` — no duplicate IDs | `argumentCache.test.ts` | ✅ | Deduplication tested | No | — |
| `mergeRelations` — merge child ID lists | `argumentCache.test.ts` | ✅ | | No | — |
| `markLoaded` / `isParentLoaded` | `argumentCache.test.ts` | ✅ | | No | — |
| `getKnownChildCount` | `argumentCache.test.ts` | ✅ | | No | — |
| `computeVisibleArgumentIds` — depth limit | `argumentCache.test.ts` | ✅ | `MAX_DISPLAY_DEPTH = 6` | No | — |
| `computeFocusedPath` | `argumentCache.test.ts` | ✅ | | No | — |
| Viewport reducer: `EXPAND`, `COLLAPSE`, `FOCUS`, `UNFOCUS` | `argumentCache.test.ts` | ✅ | | No | — |
| `getParentArgumentForComposer`, `getArgumentRelationsForDisplay` | `argumentCache.test.ts` | ✅ | | No | — |
| `listRootArguments` API call | — | ❌ | `argumentsApi.ts` not unit tested | Yes (mock) | High |
| `listChildArguments` API call | — | ❌ | Not tested | Yes (mock) | High |
| `fetchArgumentRelations` API call | — | ❌ | Not tested | Yes (mock) | Medium |
| Missing parent → detached argument list | `argumentCache.test.ts` | ⚠️ | Cache handles it; display not verified | No | Low |
| Hidden/deleted argument excluded from tree | — | ❌ | API filters by status; not tested | Yes (mock) | Medium |
| Argument tree renders after real data load | — | 🔲 | Integration — requires Supabase | Yes (live) | High |
| **Refresh after submit (known gap)** | — | ❌ | Tab switches but tree doesn't re-fetch | No | **High** |

**Missing unit test:** Mock `supabase.from` in `argumentsApi.ts` tests to verify root/child load, relation fetch, and `ARG_SELECT` column set. Add a test that `refresh()` from `useArgumentViewport` triggers a re-fetch.

---

## D. Composer State

| Behavior | Existing test file(s) | Status | Notes | Needs Supabase | Priority |
|---|---|---|---|---|---|
| `createEmptyDraft` — correct initial fields | `composerState.test.ts` | ✅ | Root and reply variants | No | — |
| `updateDraftField` — marks dirty, advances updatedAt | `composerState.test.ts` | ✅ | | No | — |
| `shouldRestoreDraft` — debateId match/mismatch | `composerState.test.ts` | ✅ | | No | — |
| `canClearParentWithoutConfirm` | `composerState.test.ts` | ✅ | | No | — |
| `normalizeAttachedEvidence` | `composerState.test.ts` | ✅ | | No | — |
| `draftToSession` / `sessionToDraft` round-trip | `composerState.test.ts` | ✅ | Including evidence `source_text` ↔ `sourceText` | No | — |
| Draft isolation across debates | `composerState.test.ts` | ✅ | `shouldRestoreDraft` mismatch case | No | — |
| `isDraftSubmittableShape` | `composerState.test.ts` | ✅ | null type, null side, blank body | No | — |
| Draft persistence to AsyncStorage | `session.test.ts` | ✅ | `saveDraft`, `loadDraft`, `deleteDraft`, index | No | — |
| `DRAFT_CLEARED` via `discardDraft` deletes from AsyncStorage | — | ⚠️ | `useArgumentComposer` calls `deleteDraft` — not tested as hook behavior | No | Medium |
| `target_excerpt` persisted after session round-trip | `composerState.test.ts` | ✅ | Full round-trip test covers it | No | — |
| `disagreementAxis` persisted after session round-trip | `composerState.test.ts` | ✅ | Full round-trip test covers it | No | — |

---

## E. Client Validation

| Behavior | Existing test file(s) | Status | Notes | Needs Supabase | Priority |
|---|---|---|---|---|---|
| `buildEvaluationInput` returns null for incomplete draft | `composerValidation.test.ts` | ✅ | Missing type, missing side | No | — |
| `buildEvaluationInput` maps all fields correctly | `composerValidation.test.ts` | ✅ | Including parent, evidence, target | No | — |
| `buildEvaluationInput` → `evaluateArgumentDraft` integration | `composerValidation.test.ts` | ✅ | Does not throw; axis rail satisfied | No | — |
| `getAllowedArgumentTypesForParent` — root, all parent types | `composerUI.test.ts` | ✅ | Thesis/claim/rebuttal/counter_rebuttal children | No | — |
| `getTagDefsForArgumentType` — filtering by type | `composerUI.test.ts` | ✅ | Axis tags, universal tags, disabled exclusion | No | — |
| `evaluateArgumentDraft` topic satisfaction | `evaluateArgumentDraft.test.ts`, `constitution/evaluateArgumentDraft.test.ts` | ✅ | On-topic, off-topic, weak-topic | No | — |
| Rails checks: length, evidence, root type, clarification question | `engine.test.ts`, `evaluateArgumentDraft.test.ts` | ✅ | Full rails coverage per `transitions.test.ts` | No | — |
| Supabase constitution fetch fallback to local v1 | — | ❌ | `useConstitution` hook — not unit tested | Yes (mock) | Medium |
| Constitution fallback when SUPABASE_CONFIGURED = false | — | ❌ | `useConstitution` always uses local fallback | No | Medium |

---

## F. Submit Flow

| Behavior | Existing test file(s) | Status | Notes | Needs Supabase | Priority |
|---|---|---|---|---|---|
| `createSubmissionFingerprint` — deterministic, tag-sorted | `composerSubmit.test.ts` | ✅ | 10 cases | No | — |
| `shouldReuseClientSubmissionIdForRetry` — all status/fingerprint cases | `composerSubmit.test.ts` | ✅ | 5 cases | No | — |
| `getOrCreateClientSubmissionId` — reuse vs new UUID | `composerSubmit.test.ts` | ✅ | 4 cases | No | — |
| `buildSubmitArgumentPayload` — field mapping, excludes forbidden fields | `composerSubmit.test.ts` | ✅ | `author_id`, `depth`, `status`, `server_validation` excluded | No | — |
| `buildSubmitArgumentPayload` includes `target_excerpt` | `composerSubmit.test.ts` | ✅ | | No | — |
| `buildSubmitArgumentPayload` includes `disagreement_axis` | `composerSubmit.test.ts` | ✅ | | No | — |
| `buildSubmitArgumentPayload` includes `attached_evidence` | `composerSubmit.test.ts` | ✅ | Including snake_case mapping | No | — |
| `buildSubmitArgumentPayload` includes `client_submission_id` | `composerSubmit.test.ts`, `session.test.ts` | ✅ | | No | — |
| `extractServerValidationError` — blockingErrors, reason, fallback | `composerSubmit.test.ts` | ✅ | 4 cases | No | — |
| `isIdempotentSuccess` — true/false/absent | `composerSubmit.test.ts` | ✅ | 4 cases | No | — |
| Client blocking errors prevent submit (button disabled) | — | ❌ | Component-level; no automated test | No | **High** |
| Success: `SUBMISSION_SUCCEEDED` → `DRAFT_CLEARED` → `deleteDraft` | — | ❌ | Reducer transitions tested; end-to-end flow not | No | **High** |
| Success: `onSubmitSuccess` called (tab switch) | — | ❌ | Requires React component test | No | **High** |
| 422: draft preserved, server errors displayed | — | ❌ | Not tested | No | **High** |
| Network failure: draft preserved | — | ❌ | Not tested | No | **High** |
| Unchanged retry reuses `clientSubmissionId` | `composerSubmit.test.ts` | ✅ | Pure helper test | No | — |
| Changed draft after failure → new `clientSubmissionId` | `composerSubmit.test.ts` | ✅ | Fingerprint mismatch → new UUID | No | — |
| Idempotent success treated as success (no double-clear) | — | ❌ | `isIdempotentSuccess` tested; component behavior not | No | Medium |
| No direct posted-argument insert path in client | Grep / code review | ✅ | No `supabase.from('arguments').insert` in src/ | No | — |
| **Known consistency gap:** `shouldReusePendingSubmission` (draftId-based) vs `shouldReuseClientSubmissionIdForRetry` (fingerprint-based) | `composerState.test.ts` confirms old helper; `composerSubmit.test.ts` confirms new | ⚠️ | Old helper not used in submit path; both exported. Tag changes do NOT trigger new ID via old helper but DO via fingerprint. Production path uses fingerprint — correct. Old helper is dead code risk. | No | Medium |

---

## G. Edge Function Contract

| Behavior | Existing test file(s) | Status | Notes | Needs Supabase | Priority |
|---|---|---|---|---|---|
| `verify_jwt = true` in `config.toml` | Config grep | ✅ | Line 370 confirms | No | — |
| Request schema accepts `client_submission_id` | `_shared/validationSchemas.ts` + type inspection | ✅ | `z.string().uuid().optional()` | No | — |
| Idempotency scoped to `author_id` + `client_submission_id` | Edge Function code + type | ✅ | Logic verified; not live-tested | No | — |
| 422 response shape matches `SubmitArgumentError` client type | Type inspection | ✅ | `blockingErrors[]` mapped | No | — |
| Existing idempotent submission returns existing argument | — | 🔲 | Requires live Edge Function | Yes (live) | High |
| Service role key not in `src/` or `app/` | Checkpoint secret scan | ✅ | Clean | No | — |
| No unauthorized table insert (RLS enforcement) | — | 🔲 | Requires live DB | Yes (live) | High |
| Migration 0004 prevents client inserts of `status='posted'` | Code review | ✅ | RLS policy documented in migration | No | — |

---

## H. Browser / Runtime

| Behavior | Existing test file(s) | Status | Notes | Needs Supabase | Priority |
|---|---|---|---|---|---|
| Missing `.env` → config notice in `AuthScreen` | Browser visual (A section) | ⚠️ | Code-verified; not automated | No | Medium |
| `SUPABASE_CONFIGURED` guards submit button | Code review | ✅ | `!SUPABASE_CONFIGURED` in canSubmit | No | — |
| App boots without crash | Browser visual | ⚠️ | Expo Web launched; browser check required | No | **High** |
| Auth screen renders | Browser visual (B section) | 🔲 | Requires browser | No | **High** |
| Debate list empty/config state renders | Browser visual (C section) | 🔲 | Requires browser | No | **High** |
| Composer root layout renders | Browser visual (E section) | 🔲 | Requires browser | No | **High** |
| No redbox or infinite render loop | Browser visual (J section) | 🔲 | Requires browser DevTools | No | **High** |
| 390px / 768px / 1280px layout | Browser visual (I section) | 🔲 | Requires browser | No | Medium |
| Submit disabled when Supabase unconfigured | Code review + browser (G section) | ⚠️ | Code-verified; browser confirmation pending | No | High |

---

## I. Deployment Readiness

| Behavior | Existing test file(s) | Status | Notes | Needs Supabase | Priority |
|---|---|---|---|---|---|
| Migrations numbered in order (0001–0005) | Code review | ✅ | Sequential timestamps | No | — |
| Migration 0005 depends only on prior tables | Code review | ✅ | No forward references | No | — |
| RLS documented and enabled on all tables | Migration 0002 + 0004 | ✅ | All tables `ENABLE ROW LEVEL SECURITY` | No | — |
| `.env` in `.gitignore` | `.gitignore` inspection | ✅ | Line 34: `.env` | No | — |
| `.env.example` safe (no real secrets) | File inspection | ✅ | Only placeholder values | No | — |
| Function deploy command documented | `docs/known-blockers.md`, `docs/mvp-smoke-test.md` | ✅ | | No | — |
| Migrations applied to a real DB | — | 🔲 | Blocked by Docker / no linked project | Yes (live) | **High** |
| Edge Function deployed and reachable | — | 🔲 | Not deployed | Yes (live) | **High** |

---

## Priority Summary

### High Priority (before MVP demo)
1. **Browser smoke test** — complete Sections A–J of `docs/browser-visual-test.md` with a configured Supabase
2. **Live argument submission** — configure `.env`, deploy `submit-argument`, test success/422/retry paths
3. **Submit lifecycle unit tests** — mock `submitArgumentDraft` in a component or hook test to verify: success clears draft, 422 preserves draft, network failure preserves draft, button disabled during submission
4. **`listDebates`/`createDebate` API mocks** — verify Supabase query shape
5. **`listRootArguments`/`listChildArguments` API mocks** — verify `ARG_SELECT` column set
6. **Viewport refresh after submit** — implement Stage 5.5.5

### Medium Priority (before sustained production use)
1. Auth API mock tests (`signIn`, `signUp`, `signOut`)
2. `useConstitution` fallback test (mock Supabase error → local v1 used)
3. `SUPABASE_CONFIGURED = false` boot path unit test
4. Idempotent success component behavior
5. Hidden/deleted argument exclusion from tree

### Low Priority (post-MVP)
1. Debate status gating (open → closed)
2. `signOut` Supabase call test
3. Full end-to-end integration tests (Playwright or similar)

---

## Known Code Consistency Issue

`composerHelpers.ts` exports two pre-fingerprint retry helpers:
- `shouldReusePendingSubmission(existing, draft)` — checks `draftId` only; does NOT check content
- `shouldCreateNewClientSubmissionId(prev, next)` — checks body/type/side/parentId; does NOT check tags, targetExcerpt, disagreementAxis, attachedEvidence

The production submit path in `ArgumentComposer.tsx` uses `composerSubmit.ts::getOrCreateClientSubmissionId` (fingerprint-based) — correct.

The old helpers from `composerHelpers.ts` are exported and tested but not used in the actual submit flow. They are effectively dead code for the submit path and could mislead future contributors. Suggested remediation: either deprecate them explicitly or remove them in a cleanup pass. Do not change this without updating `composerState.test.ts` and the export list in `index.ts`.
