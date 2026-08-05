# UX-FLAGS-005 — Feedback pending / retry / dead-letter UI states

**Status:** Design draft
**Epic:** Argument Surface Pivot (ASP) — Feedback flags (chain UX-FLAGS-001/002/003/004/005)
**Release:** Post M-ASP (asynchronous classifier UX)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/837
**Base:** `a8fac507` (main) · worktree `wt-ux-flags-005` · branch `feat/ux-flags-005-lifecycle`
**Design intent (authoritative):** `docs/designs/PRODUCT-REDIRECT-RECORDED-WIT-PRIVATE-MEMORY-2026-06-28.md` §7.4 "Feedback flags stay calm through the classifier lifecycle"; Design Pass §9 "Boolean MCP feedback (un-game-like)."

---

## Goal (one paragraph)

Classification is asynchronous (`submit-argument` → `enqueue_classifier_job` → `classifier-drainer` → `classify-argument-boolean-observations` → `argument_machine_observation_results`). While the pipeline is mid-flight the feedback-flags surface today shows the same empty state as "nothing to say" — a calm coincidence, but only a coincidence: after a `dead_letter` or `failed_terminal` outcome the surface also shows that empty state, and mid-flight it shows nothing for reasons the user cannot distinguish from a truly quiet room. This card gives the flag surface three EXPLICIT lifecycle states — **ready** (today's behavior; render pills or `null`), **pending** ("Still reading this…" calm plain-language line), and **failed** (SILENT — `null`, exactly like today's empty state — never a raw provider/error/dead-letter code, never a code word like `dead_letter` or `provider_server_error`). The choice is deliberate: on failure we do not apologize for the machine's limits, and we never surface an internal state name. Doctrine that shapes the design: **cdiscourse-doctrine §1** (advisory only; score never blocks posting; no verdict tokens ever surface — pending copy is patient, not urgent), **§4** (AI moderator hard limits — the surface renders **only** what the DB says already happened, no client AI, no client model call), **§6** (never surface provider bodies, error codes, or secrets in UI), **§9** (plain language — no `provider_*`, no `dead_letter`, no snake_case ever leaks), and the Design Pass §9 rule that machine feedback stays "un-game-like" (calm, optional, nothing required).

---

## Scope-reality audit (read this first — it reshapes the card)

Per the POSTRUN-UX001 scope-reality rule I audited the actual runtime chain before designing, because the card body's `**Technical dependencies:** Existing async classifier status` line is aspirational — the client currently has NO classifier-status read at all, only a result-row read. This changes the shape of the card meaningfully.

**What is actually there today (as of `a8fac507`):**

1. **Client read is result-only.** `fetchArgumentRelations` (`src/features/arguments/argumentsApi.ts:280-336`) accumulates positive result rows from `argument_machine_observation_results` and returns them under `persistedObservations`. The client hook `useArgumentRoomMessages` (`src/features/arguments/useArgumentRoomMessages.ts:191,205-210,217`) buckets those into `persistedObservationsByArgumentId: Record<argId, MachineObservationResultRow[]>`. `ArgumentRoom.tsx:1765-1772` derives `activePointFeedbackFlags` for the active node from that map; `PointFeedbackFlagsRow` (`src/features/feedbackFlags/PointFeedbackFlagsRow.tsx:75`) returns `null` for an empty list. **Nothing reads `argument_machine_observation_runs.state` on the client.** So a pending room and a settled-but-empty room are visually identical.

2. **The lifecycle states exist server-side, with a client-reachable RLS policy.** Migration `20260528000021_arch_001_classifier_queue_substrate.sql:152-154` adds the enum `state IN ('pending', 'leased', 'retry_scheduled', 'succeeded', 'failed_terminal', 'dead_letter')` on `argument_machine_observation_runs`. Migration `20260526000018_mcp_021b_machine_observation_results.sql:162-175` ships the SELECT policy `amor_runs_select_via_argument` that permits any authenticated caller who can see the argument to SELECT its runs (RLS gates visibility; non-participants of a private room already get zero rows). **The server side of the read is done.** No migration, no Edge Function, no RLS change needed to close the gap.

3. **The card body's boundary excludes the pipeline itself.** "Out of scope: The classifier pipeline itself." A client-side read of the already-existing `state` column, using the already-existing RLS SELECT policy, is a **new client read path** — not a pipeline change. This is unambiguously within scope: no server code moves, no queue behavior changes, no drainer change, no schema change. The only additive server surface is a documented one-line note under the existing META-1A / MCP-021B "documented exception to the Edge-Function-is-the-only-write-path rule" (this card ADDS ZERO writes; it adds one more `SELECT`).

4. **The card's "Likely files/components — `gameCopy.ts` lifecycle copy" is only half-right.** `gameCopy.ts` today has only two lifecycle-adjacent surface strings — `retryLabel: 'Retry'` (line 1017; a `RoomLoadErrorStrip` control label, not classifier lifecycle) and `ROOM_REALTIME_COPY.statusFailed: 'Live updates: paused — open the room again to retry'` (line 2230; realtime channel diagnostic, not classifier lifecycle). There is NO existing "still reading" / classifier-lifecycle copy family to "reuse". The card really wants: **add** this copy family and put it in the plain-language layer the doctrine ban-list guard `uxDoctrineCopyLint.test.ts` (issue #677 / #950 shipped in `a8fac507`) already scans. `gameCopy.ts` is in the Tier A scan set (line 198) — putting the new copy there means the guard sees it byte-for-byte on the next run. This is preferable to a new `*Copy.ts` file (which would require an edit to `uxDoctrineCopyLint.test.ts`'s `SCAN_SET_TIER_A` list — a burn-down cost the card does not need to pay).

5. **The card is design-first, not blocked, not already shipped.** `gh issue view 837` reports state `OPEN`. `git log --all --oneline --grep="UX-FLAGS-005\|feedback pending"` returns zero prior work in-flight. `git log --all --oneline --grep="837"` — no prior PR. A grep for `"still reading"` and adjacent copy in `src/` returns no matches. The predecessor UX-FLAGS-002 (#834) IS shipped and CLOSED — the row substrate this card extends is live at `PointFeedbackFlagsRow.tsx`. The chain-prior UX-FLAGS-004 (#836) shipped its intent-map + composer wiring — this card is the next link in the same feedback-flag chain.

**The reconciliation** — the card is orchestrator-approachable as-is IF the client-side status read is admitted into scope. I recommend admitting it (Path A below) because the alternative (Path B — heuristic derivation from "no rows yet and argument was posted N seconds ago") is doctrinally dirtier (guesses a timeout window, brittle to server latency, and pending vs failed cannot be distinguished without server signal). **Effort estimate:** unchanged from the card's implicit `s/m` band (pure-TS model + one Supabase read + prop-thread + component extension + copy family + tests).

---

## Data model

**No new table, no new column, no migration, no Edge Function, no RLS policy.** This card reads columns and rows that already exist under an RLS policy that already exists. It writes nothing.

The only new persisted-shape surface is the client-mapped view of `argument_machine_observation_runs`:

```ts
// src/features/nodeLabels/machineObservationPersistenceTypes.ts (additive)

/**
 * ARCH-001 queue lifecycle state (mirrors the CHECK on
 * argument_machine_observation_runs.state). Server-only vocabulary — a raw
 * value MUST NEVER be surfaced in UI. See UX-FLAGS-005 for the calm three-
 * state rollup (`PointFeedbackFlagsLifecycleState`) that IS surfaced.
 */
export type MachineObservationRunLifecycleState =
  | 'pending'
  | 'leased'
  | 'retry_scheduled'
  | 'succeeded'
  | 'failed_terminal'
  | 'dead_letter';

export const ALL_MACHINE_OBSERVATION_RUN_LIFECYCLE_STATES:
  ReadonlyArray<MachineObservationRunLifecycleState> = Object.freeze([
    'pending', 'leased', 'retry_scheduled',
    'succeeded', 'failed_terminal', 'dead_letter',
  ]);

export function isMachineObservationRunLifecycleState(
  value: unknown,
): value is MachineObservationRunLifecycleState {
  return typeof value === 'string' &&
    (ALL_MACHINE_OBSERVATION_RUN_LIFECYCLE_STATES as ReadonlyArray<string>).includes(value);
}

/**
 * The MINIMAL per-argument roll-up the client reads. Never a raw row, never a
 * per-family echo — the fetcher aggregates rows to this shape so nothing at
 * the seam can render a leaked code. `hasAnyRun` false ⇒ nothing enqueued yet
 * for this argument (treated as `ready`, doctrine-clean under "silent on
 * absence").
 */
export interface ArgumentClassifierLifecycleRollup {
  argumentId: string;
  hasAnyRun: boolean;
  hasAnyNonTerminal: boolean;   // any run in ('pending','leased','retry_scheduled')
  hasAnySucceeded: boolean;     // any run in ('succeeded')
  hasAnyTerminalFailure: boolean; // any run in ('failed_terminal','dead_letter')
}
```

The public 3-state discriminant lives one layer up:

```ts
// src/features/feedbackFlags/pointFeedbackFlagsLifecycleModel.ts (new, pure TS)

export type PointFeedbackFlagsLifecycleState = 'ready' | 'pending' | 'failed';

/**
 * Derive the calm 3-state discriminant from the per-argument roll-up + the
 * already-rendered flag list. The rule:
 *   - flags.length > 0                                 → 'ready'  (never obscure content)
 *   - hasAnyNonTerminal (still working)                → 'pending'
 *   - hasAnySucceeded (nothing to say)                 → 'ready'
 *   - hasAnyTerminalFailure ∧ ¬hasAnySucceeded         → 'failed'
 *   - !hasAnyRun (never enqueued)                      → 'ready'
 * Non-actionable defaults tilt toward 'ready' (renders null) under §1
 * "silent on absence" — we NEVER speak on uncertainty.
 */
export function derivePointFeedbackFlagsLifecycleState(input: {
  hasVisibleFlags: boolean;
  rollup: ArgumentClassifierLifecycleRollup | null | undefined;
}): PointFeedbackFlagsLifecycleState;
```

`derivePointFeedbackFlagsLifecycleState` is total, deterministic, JSON-serializable, and never returns an internal code.

---

## File changes

**New (2):**

- `src/features/feedbackFlags/pointFeedbackFlagsLifecycleModel.ts` — pure-TS 3-state discriminant + rollup helper (types + `derivePointFeedbackFlagsLifecycleState` + `foldRunRowsIntoRollup`). No React, no Supabase, no network. **~90 lines.**
- `src/features/feedbackFlags/pointFeedbackFlagsLifecycleQuery.ts` — Supabase read wrapper. Sibling to `machineObservationPersistenceQuery.ts` (same pattern; documented exception to the "Edge-Function-is-the-only-write-path" rule). Exports `fetchClassifierLifecycleForArguments(argumentIds): Promise<{ok:true;data:ArgumentClassifierLifecycleRollup[]}|{ok:false;error:string}>`. **~90 lines.**

**Modified (7):**

- `src/features/nodeLabels/machineObservationPersistenceTypes.ts` — additive: 3 exports (`MachineObservationRunLifecycleState`, `ALL_MACHINE_OBSERVATION_RUN_LIFECYCLE_STATES`, `isMachineObservationRunLifecycleState`) matching the migration CHECK byte-for-byte. **~+25 lines.**
- `src/features/feedbackFlags/PointFeedbackFlagsRow.tsx` *(NOT pinned)* — add optional `lifecycleState?: PointFeedbackFlagsLifecycleState` prop with default `'ready'` (byte-identical to today when absent). New empty-branch: `flags.length === 0 && lifecycleState === 'pending'` renders **one** small `<Text accessibilityRole="text">` with the "Still reading this…" copy; `flags.length === 0 && lifecycleState === 'failed'` returns `null` (silent doctrine); `flags.length === 0 && lifecycleState === 'ready'` returns `null` (current behavior). When `flags.length > 0` render exactly as today regardless of `lifecycleState` (pending never obscures actual content). **~+30 lines.**
- `src/features/feedbackFlags/index.ts` — `export * from './pointFeedbackFlagsLifecycleModel';` + `export * from './pointFeedbackFlagsLifecycleQuery';`. **~+2 lines.**
- `src/features/arguments/gameCopy.ts` — add one frozen object `POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY` next to `ROOM_REALTIME_COPY` (~line 2231), containing **exactly one** exported string: `pending`. NO failure string is added (failure is silent). Ban-list clean by construction (see §Decisions 2). **~+15 lines.** File already covered by `uxDoctrineCopyLint.test.ts` Tier A scan set — the guard will read the new literal on the next run.
- `src/features/arguments/useArgumentRoomMessages.ts` — new state slot `classifierLifecycleByArgumentId: Record<string, ArgumentClassifierLifecycleRollup>` populated from `fetchClassifierLifecycleForArguments(ids)` inside the initial load `Promise.all`. Return the new map alongside `persistedObservationsByArgumentId`. On error return an empty map (loading fails gracefully to `ready` — never surfaces the error). **~+30 lines.**
- `src/features/arguments/room/ArgumentRoom.tsx` *(NOT pinned)* — accept the new prop; extend the `activePointFeedbackFlags` memo to also compute `activePointLifecycleState` via `derivePointFeedbackFlagsLifecycleState({ hasVisibleFlags: visible.length > 0, rollup: classifierLifecycleByArgumentId[activeMessageId] })`; pass `lifecycleState` into the Timeline `PointFeedbackFlagsRow` (currently around line 3301). **~+15 lines.** Ringside + CardDetailPanel receive the prop with the same wiring (both mount the same row; consistency parity).
- `src/features/arguments/ArgumentTreeScreen.tsx` — one-hop prop pass `classifierLifecycleByArgumentId` from the hook to `ArgumentRoom` (mirrors the shipped `persistedObservationsByArgumentId` hop). **~+3 lines.**

**Deleted:** none.

**Explicitly NOT touched (pinned / byte-identical):** `friendlyFlagMap.ts`, `pointFeedbackFlagsModel.ts`, `feedbackFlagPriority.ts`, `flagComposerIntentMap.ts`, `PointFeedbackFlagPill.tsx`, the composer/OneBox pin set (`ArgumentComposer.tsx`, `ArgumentComposerDock.tsx`, `composer/*`, `oneBox/*`), the auto-metadata / manual-tag ledger, `machineObservationPersistenceQuery.ts` (the results fetcher stays result-only; the runs query is a sibling, not an edit), `supabase/functions/submit-argument/`, `supabase/functions/classifier-drainer/`, `supabase/functions/classify-argument-boolean-observations/`, every migration, `uxOneOneFiveReadOnlyBoundary.test.ts`'s pinned files. **NO server file is edited.**

---

## API / interface contracts

### `pointFeedbackFlagsLifecycleModel.ts` (pure TS)

```ts
export type PointFeedbackFlagsLifecycleState = 'ready' | 'pending' | 'failed';

export interface ArgumentClassifierLifecycleRollup {
  argumentId: string;
  hasAnyRun: boolean;
  hasAnyNonTerminal: boolean;
  hasAnySucceeded: boolean;
  hasAnyTerminalFailure: boolean;
}

/** Fold raw run rows into the minimal roll-up. Pure. Never throws. */
export function foldRunRowsIntoRollup(
  argumentId: string,
  runs: ReadonlyArray<{ state: MachineObservationRunLifecycleState }>,
): ArgumentClassifierLifecycleRollup;

/** Derive the 3-state discriminant. Total, deterministic. */
export function derivePointFeedbackFlagsLifecycleState(input: {
  hasVisibleFlags: boolean;
  rollup: ArgumentClassifierLifecycleRollup | null | undefined;
}): PointFeedbackFlagsLifecycleState;
```

Decision rules (order-of-precedence; enforced by tests):

1. `hasVisibleFlags === true` → `'ready'` (content beats posture — never obscure actual flags).
2. `rollup == null || !rollup.hasAnyRun` → `'ready'` (nothing enqueued; silent on absence).
3. `rollup.hasAnyNonTerminal === true` → `'pending'`.
4. `rollup.hasAnySucceeded === true` → `'ready'` (a succeeded run with zero results = a genuinely empty room; silent).
5. `rollup.hasAnyTerminalFailure === true && !rollup.hasAnySucceeded` → `'failed'`.
6. Fallback → `'ready'` (unreachable given the enum, defensive).

### `pointFeedbackFlagsLifecycleQuery.ts` (Supabase read)

```ts
export type FetchClassifierLifecycleResult =
  | { ok: true; data: ArgumentClassifierLifecycleRollup[] }
  | { ok: false; error: string };

export async function fetchClassifierLifecycleForArguments(
  argumentIds: ReadonlyArray<string>,
): Promise<FetchClassifierLifecycleResult>;
```

Contract:
- `!SUPABASE_CONFIGURED` OR `argumentIds` empty → `{ ok: true, data: [] }` (offline-safe, mirrors `fetchPersistedObservationsForArguments`).
- Hard cap of 1000 ids (mirrors the persisted-observations fetcher).
- SELECT is `.from('argument_machine_observation_runs').select('argument_id,state').in('argument_id', ids)`. No JOIN. No `.eq('run_mode', ...)` filter — pending/dead-lettered rows in `admin_validation` mode are still lifecycle activity for the owning argument; the source-6-filter is a *result rendering* concern and does not gate lifecycle roll-up (Decision 6).
- Errors return `{ ok: false, error: string }`. Callers degrade to an empty map, which folds into `'ready'` per rule 2 — a fetch failure is **NEVER** surfaced as a pending/failed state (never apologize for the machine, §4/§9). The `error` string is discarded at the hook boundary (never rendered).
- **No service-role. No mutation helper. No INSERT/UPDATE/DELETE export.** Read-only SELECT, documented exception to the "Edge Function is the only write path" rule (same posture as `fetchPersistedObservationsForArguments` and `fetchPointTagsForArguments`).

### `PointFeedbackFlagsRow` prop extension (byte-identical when omitted)

```ts
export interface PointFeedbackFlagsRowProps {
  flags: ReadonlyArray<PointFeedbackFlagViewModel>;
  heading?: string;
  suppressedCount?: number;
  onFlagIntent?: (flagKey: string) => void;
  /**
   * UX-FLAGS-005 — the calm 3-state discriminant. Default `'ready'` reproduces
   * the shipped UX-FLAGS-002 behavior byte-for-byte (render null on empty).
   */
  lifecycleState?: PointFeedbackFlagsLifecycleState;
  testID?: string;
}
```

Render contract (extends UX-FLAGS-002):

| `flags.length` | `lifecycleState` | Renders |
|---|---|---|
| `> 0` | any | the pill row exactly as today (content always wins) |
| `0` | `'ready'` (or omitted) | `null` — today's byte-identical empty state |
| `0` | `'pending'` | a single quiet `<Text accessibilityRole="text">Still reading this…</Text>` |
| `0` | `'failed'` | `null` — silent doctrine |

The pending line uses `SURFACE_TOKENS.textSecondary`, `TYPOGRAPHY.chipLabel.fontSize`, `SPACING.s` top margin — same design tokens the shipped row uses, so the row's rhythm stays visually identical. NO glyph, NO icon, NO color-only signal, NO animation (reduce-motion irrelevant).

### `POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY` (add to `gameCopy.ts` next to `ROOM_REALTIME_COPY`)

```ts
/**
 * UX-FLAGS-005 — feedback-flag lifecycle copy. Calm plain-language for the
 * "asynchronous classifier is mid-flight" state. NO failure copy is exported
 * — failure is SILENT (returns null in the component); we never apologize for
 * the machine and we never surface a provider/error/dead-letter code.
 *
 * Doctrine anchors: §1 (advisory, never a verdict), §4 (AI limits — the copy
 * describes a general "reading" process, not any judgement), §9 (plain
 * language — internal codes like `dead_letter`, `provider_server_error`,
 * `failed_terminal` MUST never appear).
 */
export const POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY = Object.freeze({
  /** Rendered when no flags are present yet AND at least one classifier run
   *  is in-flight for this argument. Present-continuous, calm, neutral. */
  pending: 'Still reading this…',
} as const);
```

Ban-list scan (verifies clean, self-check pre-commit):
- No token in `VERDICT_BANS` / `TRUTH_FRAME_BANS` / `PERSON_LABELS_BANS` / `FALLACY_BANS` / `EMOTION_INTENT_BANS` / `POPULARITY_HEAT_BANS` / `COLOR_VERDICT_PHRASE_BANS` / `SCORE_FRAME_BANS` / `WRONG_FRAME_BANS` / `HONEST_DISHONEST_BANS` / `WAVEFORM_CREDIBILITY_BANS` / `STORED_AUDIO_BANS`.
- The string `Still reading this…` decomposes to `still`, `reading`, `this` — none of which are banned. The horizontal ellipsis `…` is U+2026 (calm, matches the `RULE-005` pause voice); it is NOT a color/emoji/verdict token. `uxDoctrineCopyLint.test.ts` already scans `src/features/arguments/gameCopy.ts` (Tier A, line 198) so this literal will be walked automatically on the next run.

### `useArgumentRoomMessages` extension

```ts
export interface ArgumentRoomMessagesResult {
  // ...existing fields...
  persistedObservationsByArgumentId: Record<string, MachineObservationResultRow[]>;
  /** UX-FLAGS-005 — per-argument classifier lifecycle roll-up. Empty on
   *  load-fail (fold-back to 'ready' per §5 silent-on-uncertainty). */
  classifierLifecycleByArgumentId: Record<string, ArgumentClassifierLifecycleRollup>;
  loading: boolean;
  // ...existing fields...
}
```

Populated via one additional promise inside the load `Promise.all`:

```ts
const lifecycleRes = await fetchClassifierLifecycleForArguments(ids);
const lifecycleMap: Record<string, ArgumentClassifierLifecycleRollup> = {};
if (lifecycleRes.ok) {
  for (const r of lifecycleRes.data) lifecycleMap[r.argumentId] = r;
}
setClassifierLifecycle(lifecycleMap);
```

On error, `lifecycleMap` stays empty. Empty map → `derivePointFeedbackFlagsLifecycleState` returns `'ready'` → the row renders `null` on empty flags → byte-identical to today (silent-on-uncertainty).

### `ArgumentRoom` — extension to the active-node memo

```ts
const activePointLifecycleState = useMemo<PointFeedbackFlagsLifecycleState>(() => {
  if (!activeMessageId) return 'ready';
  return derivePointFeedbackFlagsLifecycleState({
    hasVisibleFlags: activePointFeedbackFlags.visible.length > 0,
    rollup: classifierLifecycleByArgumentId?.[activeMessageId] ?? null,
  });
}, [activeMessageId, activePointFeedbackFlags.visible.length, classifierLifecycleByArgumentId]);
```

Passed to the Timeline mount site: `<PointFeedbackFlagsRow ... lifecycleState={activePointLifecycleState} />`. Same wiring at the Ringside active-card mount site + the CardDetailPanel legacy-Cards mount site (three parity mounts — capability parity across lenses; see the UX-FLAGS-004 §6 Output-6 rule).

---

## Decisions (the seven the brief asks for)

### 1. State discriminant — what triggers each

- **Pending.** `hasVisibleFlags === false && rollup.hasAnyNonTerminal === true`. This includes newly-posted arguments whose first `pending` row exists, retry_scheduled between attempts, and leased rows a drainer is currently working. The card body says "still reading this update…" which implies triggering even when flags already exist. **I recommend against.** Precedence rule 1 (`hasVisibleFlags === true → 'ready'`) means pending is ONLY surfaced when there is currently no content to show — because the calm empty state IS the affordance. Layering "Still reading this…" ABOVE already-rendered pills would (a) suggest the shown pills are provisional (they aren't — result rows are terminal), (b) violate the Design Pass §9 "un-game-like" rule by adding cognitive load, and (c) contradict §1's "silent on absence" (pills present = we already said what we have). **Argument accepted:** pending fires only on empty. This also naturally covers the "still reading THIS update" case for a newly-posted argument — its first classifier row is `pending`, no results yet, empty flags → the line shows.

- **Retrying.** `state === 'retry_scheduled'` folds into `hasAnyNonTerminal`. **The card body says calm-silent posture — I recommend retry looks EXACTLY like pending; no visual distinction.** Reasons: (a) doctrine §1 (no verdict) + §9 (plain language) forbid surfacing the fact that a retry is happening — "retry" is an internal operational code (`retry_scheduled` is the raw column value, and a plain-language rewrite like "trying again" still implies something previously failed, which is judgement about the machine's competence); (b) the user's model is "we're still working on this", and pending ↔ retrying is a distinction WITHOUT a user-facing difference. The user sees "Still reading this…" through the entire non-terminal lifecycle. **Recommend.**

- **Failed / dead-lettered.** `hasAnyTerminalFailure === true && !hasAnySucceeded` (a mixed outcome — one family succeeded, another dead-lettered — still shows the successes on `hasVisibleFlags` gate; only a pure-failure argument hits `'failed'`). **Recommend: `'failed'` renders `null`.** Alternatives considered:
  - **(a) Render a subtle "we couldn't read this" line.** REJECT. Apologises for the machine's limits, adds noise, may read as accusing the user's post of being unreadable, and any string variant is a slippery slope toward surfacing a code word ("classifier didn't finish", "we tried but…"). Doctrine §4 (AI moderator hard limits — never assign a truth value; a "we couldn't read this" line implies the machine tried to make a judgement AND admits it did poorly, both of which foreground the machine's role that we want invisible).
  - **(b) Retry-linked chip that fires an operator-invisible re-enqueue.** REJECT. Card boundary excludes pipeline changes; also would need a new Edge Function (`re-enqueue-classifier-job`) which is outside scope.
  - **(c) Silent null.** ACCEPT. It reads exactly like the calm empty room a user has always seen. It costs the platform nothing except the classifier signal we already lost — and since the classifier is advisory (§1, §4), losing it should have zero user-observable cost. The dead-letter is an operational signal for the drainer's audit table, not a user event. **Recommend.**

### 2. Copy strategy — where the strings live

**Recommend adding `POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY` to `src/features/arguments/gameCopy.ts`** (not a new `pointFeedbackFlagsLifecycleCopy.ts` file). Reasons:

- **Doctrine ban-list coverage is automatic.** `gameCopy.ts` is line 198 of `uxDoctrineCopyLint.test.ts`'s `SCAN_SET_TIER_A`. Any new literal there is scanned on the next test run — no allowlist entry, no scan-set edit. A new `*Copy.ts` file would require an edit to `SCAN_SET_TIER_A` to satisfy the completeness ratchet (test 806-820), which is real code the reviewer would need to verify.
- **The card body says "reuse `gameCopy` lifecycle copy".** The literal reading is right (surface lives in `gameCopy.ts`); the fact that there's near-zero existing lifecycle copy there is a pre-existing gap this card fills. The precedent is `ROOM_REALTIME_COPY` (line 2219) — a small frozen object of related lifecycle-like strings shipped in the same file. This card mirrors that pattern.
- **Only ONE string is added.** `pending: 'Still reading this…'`. No `failed:` key exists — because failure is silent, no string is needed. This is doctrinally load-bearing: the *absence* of a failure string in the copy family is what enforces silent-on-failure at the source layer. If a future reviewer asks "shouldn't there be a `failed:` string?", the answer is in the JSDoc comment: NO — failure is silent, and the shape of this object is the enforcement.
- **`toPlainLanguage` router** (near line 197 of `gameCopy.ts`) is NOT the right place for these strings — that router maps INTERNAL CODES (`source_chain_lexical`, `topic_satisfaction_lexical`, etc.) to plain language for surface rendering. The pending state is not driven by an internal code (there is no `pending` code that comes back from a classifier and needs translation) — it's a client-derived posture. Wrapping the `pending` string into `toPlainLanguage` would misuse the router's purpose. The frozen copy object next to `ROOM_REALTIME_COPY` is the right pattern.

### 3. Component shape — extend, don't wrap

**Recommend extending `PointFeedbackFlagsRow.tsx`** with an optional `lifecycleState?: PointFeedbackFlagsLifecycleState` prop with default `'ready'`. Alternative: a sibling `PointFeedbackFlagsLifecycleRow.tsx` that wraps + delegates. Reasons to extend:

- **The empty-branch logic stays in one place.** UX-FLAGS-002 shipped the `flags.length === 0 → return null` branch in `PointFeedbackFlagsRow`. Splitting the "when to render null" logic across two files would create a coordination hazard — the wrapper's decision to render pending would depend on the wrappee's decision to render null, and any UX-FLAGS-002 change to the empty-branch logic would need mirror edits in the wrapper.
- **Byte-identity of every existing call site.** Every existing `<PointFeedbackFlagsRow flags={...} />` call site (three of them — `ArgumentRoom.tsx`, `RingsideCard.tsx`, `CardDetailPanel.tsx`) is byte-identical when the new prop is omitted. Only the three room-adjacent call sites gain the new prop; the flag row's own render contract is a superset.
- **The wrapper pattern would create a real extra file with no doctrine gain.** UX-FLAGS-003 (suppressedCount), UX-FLAGS-004 (onFlagIntent) both extended the row with optional props — the pattern is established. This card does the same.
- **Testing surface stays local.** All new empty-branch tests go in the extended `PointFeedbackFlagsRow.test.tsx` next to the existing empty-list test (line 42 of that file).

### 4. Doctrine posture

- **Never a raw error/provider code.** The lifecycle query returns a folded roll-up; the row NEVER receives a raw state string. The one visible string is `'Still reading this…'` — no `retry_scheduled`, no `dead_letter`, no `provider_server_error`, no `failed_terminal`, no `provider_*`, no `sub_reason`. Ban-list guaranteed by the scanner (§Test plan and §Doctrine self-check).
- **Pending copy is calm plain-language.** Not urgent, not apologetic, not gamified. No progress bar, no spinner, no percentage, no time-remaining estimate. The horizontal ellipsis carries the "in-progress" affordance without claiming a timeline. Reduce-motion is irrelevant (no animation).
- **Failed state renders `null` (silent).** No color, no icon, no strip, no toast, no announcement. `AccessibilityInfo.announceForAccessibility` is NOT called anywhere in the lifecycle path — the state transition is silent to screen readers by design (this state changes only when the drainer completes; announcing it would be chatty, and doctrine §1 forbids surfacing a failure to the user).
- **No color-only signal.** The pending copy is rendered in `SURFACE_TOKENS.textSecondary` — the same token the row's helper text uses. It reads as another calm text row, not as a signal to look at.
- **Reduce-motion safe by construction.** No animation, no transition, no fade. The state change is a synchronous rerender.
- **`accessibilityRole="text"`** on the pending line (matches the shipped `moreCount` line at `PointFeedbackFlagsRow.tsx:131`). **No `accessibilityLiveRegion`** — the user is not waiting on this; the drainer is asynchronous and the render is passive. A live-region announcement would (a) violate "sparingly" from the `accessibility-targets` skill "Screen-reader announcements" §, (b) chatter every 5-10 seconds under a busy drainer, and (c) contradict §1 (calm, not urgent).

### 5. Test plan

Pure-model discriminant tests + component render tests + doctrine ban-list + wiring + read-path tests. No wall-clock `toBeLessThan(ms)` assertions (LIFE-001/META-001 flake class per `test-discipline` skill).

- **`__tests__/pointFeedbackFlagsLifecycleModel.test.ts`** (pure model, deterministic):
  - `derivePointFeedbackFlagsLifecycleState` — 6-branch exhaustion (all 6 rules of the precedence table); every branch has an "happy" and a "boundary" input.
  - `foldRunRowsIntoRollup` — empty runs → `hasAnyRun:false`; single pending → non-terminal true; mix of `succeeded` + `failed_terminal` → both flags true; input-order independence; frozen-output check.
  - `isMachineObservationRunLifecycleState` — accepts all 6, rejects `''`, `null`, `'ok'`, `'error'`, `'unknown'`, `'pending_terminal'` (near-miss).
  - **Firing negative controls** — asserting the fn NEVER returns `'failed'` when a run has succeeded (rule 4 vs rule 5 collision — succeeded wins).
- **`__tests__/pointFeedbackFlagsLifecycleModelDoctrine.test.ts`** (doctrine ban-list scan):
  - Scan `POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY` values with the `friendlyFlagMapBanList` `BANNED_TOKENS` + `looksLikeInternalCode`; assert no snake_case, no `provider_*`, no `dead_letter`, no `failed_terminal`, no `retry_scheduled`, no `error`, no `failed`, no `winner/loser/liar/proof/wrong/score`, no `dishonest/manipulative/extremist`.
  - Assert the copy object has EXACTLY ONE key (`pending`) — a `failed:` key added later without doctrine ruling would fail this test loudly.
- **`__tests__/pointFeedbackFlagsLifecycleQuery.test.ts`** (read-path safety):
  - Mock the Supabase client; assert the SELECT columns are exactly `argument_id,state` (no wider column pull, no JOIN, no `.eq`).
  - Assert `!SUPABASE_CONFIGURED` and empty `argumentIds` short-circuit; hard cap `1000`; error path returns `{ ok: false, error }` and NEVER throws.
  - Assert the fetcher never issues INSERT/UPDATE/DELETE (source-scan: `.insert`, `.update`, `.delete`, `.upsert` do not appear in the file).
- **`__tests__/PointFeedbackFlagsRow.lifecycle.test.tsx`** (extend UX-FLAGS-002 render tests):
  - `flags=[], lifecycleState omitted` → `render(...).toJSON()` is `null` (byte-identical to UX-FLAGS-002 line 42 test).
  - `flags=[], lifecycleState='ready'` → `null`.
  - `flags=[], lifecycleState='pending'` → renders one `<Text>` with copy `Still reading this…`, `accessibilityRole='text'`, no button, no live-region.
  - `flags=[], lifecycleState='failed'` → `null` (silent doctrine).
  - `flags=[nonEmpty], lifecycleState='pending'` → renders the pill row exactly as today; the pending line is NOT present (content-wins precedent).
  - `flags=[nonEmpty], lifecycleState='failed'` → renders the pill row exactly as today.
  - Grayscale legibility: the pending line uses `SURFACE_TOKENS.textSecondary` — same token as the helper block; verified with a snapshot of `styles.pendingLine` composition (no color-only signal).
  - **Firing negative control** — assert the string `retry_scheduled` NEVER appears in `render(...).toJSON()` for any lifecycle input (including a hypothetical "raw" prop misuse where an implementer types the wrong string).
- **`__tests__/uxFlags005RoomWiring.test.tsx`** (ArgumentRoom + hook wiring):
  - Given a hook state with `classifierLifecycleByArgumentId[activeId] = { hasAnyRun:true, hasAnyNonTerminal:true, hasAnySucceeded:false, hasAnyTerminalFailure:false }` and empty `activePointFeedbackFlags.visible` → the mount site receives `lifecycleState='pending'` and renders the pending line.
  - Same with `hasAnyTerminalFailure:true, hasAnySucceeded:false` → `lifecycleState='failed'` and the row renders `null`.
  - Ringside parity + CardDetailPanel parity — same three-state assertion at each of the three mount sites.
  - `classifierLifecycleByArgumentId` empty (fetch failure) → `lifecycleState='ready'` (silent-on-uncertainty).
- **Contract preservation (run unchanged; must stay green):** `uxOneOneFiveReadOnlyBoundary.test.ts` (composer/OneBox zero-diff), `friendlyFlagMapBanList.test.ts`, `pointFeedbackFlagsModel.test.ts`, `feedbackFlagPriority.test.ts`, `flagComposerIntentMap.test.ts`, `PointFeedbackFlagsRow.test.tsx` (UX-FLAGS-002 existing tests), `uxDoctrineCopyLint.test.ts` (issue #677 / #950 — will now scan the new `pending` string on its next run).

**File/test budget:** 2 new source files + 7 modified; 4 new test files + 1 extended; **+~40-55 tests**.

### 6. Boundary + scope

- **No server change** (classifier pipeline out of scope per card). No new migration. No new Edge Function. No RLS change. No new secret. No new env variable.
- **No new dep, no new flag, no cohort-rollout.** The card sits BEHIND the existing shipped flag surface (UX-FLAGS-002 pills are always rendered when present); the lifecycle state is a passive readout, not a new user-visible affordance. No `EXPO_PUBLIC_FEEDBACK_FLAG_LIFECYCLE` flag is added — that would be over-engineering for a purely additive, silent-on-failure passive readout. If the operator wants to disable the pending line specifically, the seam is a one-line prop cap at `ArgumentRoom` (documented as Gaps §2 — deferred until asked).
- **One additional SELECT round-trip per room load.** The `fetchClassifierLifecycleForArguments` promise runs in parallel with the existing `fetchArgumentRelations` promise (both fired under a single `Promise.all` in the hook). Load-time impact: one extra HTTP round-trip, one indexed SELECT (`argument_machine_observation_runs` is indexed on `argument_id` via `amor_active_argument_family_idx` from `20260526000018`, and the SELECT only reads `argument_id,state`).
- **No realtime channel** for lifecycle updates in v1. A user who opens a room while classification is pending will see "Still reading this…" until they navigate away and back (which reloads the hook). Adding realtime for this is future work (Gaps §3 — deferred).
- **No admin surface change.** The Admin Classifier Health surface (`src/features/adminClassifierHealth/`) already reads its own admin-only aggregate — that surface is unchanged.

### 7. Reality-audit findings

Summarized in the Scope-reality audit above. The one interpretive judgment the reviewer should verify: I'm reading "Out of scope: The classifier pipeline itself" to permit a client-side READ of the queue's existing state column via the existing RLS SELECT policy. The alternative reading — "even a client-side lifecycle read is out of scope, so use a heuristic" — is defensible but produces a doctrinally weaker design (heuristic pending vs failed is unreliable). Flagged for operator confirmation in Gaps §1.

---

## Edge cases

- **Empty flag list, no runs (never enqueued)** → `rollup.hasAnyRun === false` → `'ready'` → `null` (byte-identical to today). Covers old rooms posted before ARCH-001 shipped.
- **Empty flag list, one pending run** → `'pending'` → pending line renders.
- **Empty flag list, one succeeded run with zero result rows** → `hasAnySucceeded === true` → rule 4 → `'ready'` → `null`. Genuinely empty room (classifier ran, had nothing to say). Silent — matches the "content-wins" precedent.
- **Empty flag list, one dead_letter run** → `'failed'` → `null` (silent doctrine).
- **Empty flag list, mixed pending + dead_letter** → `hasAnyNonTerminal:true` (pending wins in the precedence — rule 3 before rule 5) → `'pending'`. If a partial family failed but another is still working, we stay calm.
- **Empty flag list, mixed succeeded + dead_letter** → `hasAnySucceeded:true` → rule 4 → `'ready'`. A succeeded family took precedence over the dead-lettered one; the succeeded run had nothing to say, so we're silent.
- **Non-empty flag list, any lifecycle** → `hasVisibleFlags:true` → rule 1 → `'ready'` → the pill row renders as today. Pending never obscures content.
- **`activeMessageId` is null (no selection)** → memo returns `'ready'` early; the flag row is not mounted on the map/timeline anyway.
- **Hook fetch fails / offline** → `classifierLifecycleByArgumentId` stays empty → every argument folds to `'ready'` → every empty row stays null. **We NEVER surface a fetch error as a lifecycle state.**
- **Race: user navigates away mid-fetch** → the hook's `cancelled` sentinel prevents state updates; no torn state.
- **Race: drainer succeeds AFTER the hook loaded** → the row stays `'pending'` until the user reloads. Acceptable in v1 (no realtime); the resulting UI shows a stale "Still reading this…" that becomes stale-but-not-wrong until reload. NOT the failed state (which is silent), just a small staleness. Flagged as deferred realtime (Gaps §3).
- **User is unauthenticated** → RLS returns zero rows from both `fetchArgumentRelations` and `fetchClassifierLifecycleForArguments`; the map is empty; every argument folds to `'ready'`; empty rows render null (byte-identical to today).
- **User is authenticated but non-participant of a private room** → RLS returns zero rows via the same `amor_runs_select_via_argument` chain that already gates results; same fold-to-`'ready'` behavior.
- **Reduce motion** → nothing to disable (no animation).
- **Grayscale** → the pending line reads as text; no color meaning to lose.
- **Doctrine edge:** an argument marked `is_deleted: true` (soft-deleted per §8) whose queue rows still exist → the flag row is not mounted for a deleted argument (upstream gate in ArgumentRoom); moot.
- **`state` value future-widening** (server adds a new enum value in a later migration without updating the client) → `isMachineObservationRunLifecycleState` filters unknown values; the roll-up treats them as `hasAnyRun:false` for that row (unknown-safe under-classification is the doctrinally correct default; a firing negative control asserts this). Same posture the client already takes for unknown families.

---

## Test plan

See §Decisions 5 above for the full plan. TL;DR:

- 4 new test files (`pointFeedbackFlagsLifecycleModel.test.ts`, `pointFeedbackFlagsLifecycleModelDoctrine.test.ts`, `pointFeedbackFlagsLifecycleQuery.test.ts`, `uxFlags005RoomWiring.test.tsx`), 1 extended (`PointFeedbackFlagsRow.test.tsx` gains a `lifecycle` describe block or a new sibling `.lifecycle.test.tsx` — implementer's call).
- **Doctrine ban-list assertions** on `POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY` values AND on rendered strings from every lifecycle branch of `PointFeedbackFlagsRow`. Scan for the internal-code family (`retry_scheduled`, `dead_letter`, `failed_terminal`, `pending`, `leased`, `succeeded`), the raw-error family (`provider_*`, `error`, `failed`, `unauthorized`), and the shipped BANNED_TOKENS (`winner/loser/proof/wrong/liar/dishonest/manipulative/extremist/…`).
- **Firing negative control** for the read-path: the query file does NOT contain `.insert(`, `.update(`, `.delete(`, `.upsert(`, `SERVICE_ROLE`, `service_role`.
- Real-derivation over mocks where possible — the discriminant is pure TS, so the tests import the production function directly.

---

## Dependencies (cards / docs / files)

- **Blocked-by UX-FLAGS-002 (#834) — CLEARED.** The row substrate is shipped.
- **Blocked-by ARCH-001 (Card 1 + Card 2) — CLEARED.** The queue substrate, the `state` column, the RLS SELECT policy `amor_runs_select_via_argument`, and the enqueue-kick trigger are all shipped (migrations `20260528000021`, `20260528000022`, `20260528000023`; drainer + kick shipped Q2 2026 per `docs/core/current-status.md`).
- **Read-only exception:** this card adds one Supabase SELECT to the client (`argument_machine_observation_runs.select('argument_id,state')`). Same posture as `fetchPersistedObservationsForArguments`, `fetchPointTagsForArguments`, `fetchArgumentRelations` — documented exception to the "Edge Function is the only write path" rule. **No write. No service-role.**
- **Reuses the doctrine ban-list guard from #677 / #950.** New literals in `gameCopy.ts` are covered by the Tier A scan set automatically.
- **Reuses `useArgumentRoomMessages`** as the sole hook that hydrates room-level per-argument state. New map rides the same `Promise.all` slot.
- **Depends on the RLS chain: `argument_machine_observation_runs` → `arguments` → private-room membership (QOL-039 SECURITY DEFINER helpers).** Confirmed intact (migration `20260526000018` sets the policy; not modified since).
- **Blocks nothing hard.** Enables future realtime for classifier lifecycle (Gaps §3) and an admin-surfaced "arguments stuck in dead_letter" triage view (out of scope).

---

## Risks

- **Client-side reality of the "async status" the card assumed already existed.** The card body's `**Technical dependencies:** Existing async classifier status` implies the client-side hook already exposes lifecycle status. It does not (per the Scope-reality audit above). This card ships that read for the first time. If a reviewer expects a purely presentational card, this is the interpretive judgment they should verify. Mitigation: this is called out in the audit AND in Gaps §1 for operator ruling.
- **RLS SELECT policy chain deepening under load.** The runs table's SELECT policy is `EXISTS (SELECT 1 FROM arguments WHERE a.id = argument_machine_observation_runs.argument_id)`; the arguments table's own SELECT policy in turn checks the QOL-039 helpers. In a busy room this doubles up on the same helper the results fetcher already exercises for every read. Under normal load this is fine (both use the same indexes); under stress the two round-trips fire in parallel via `Promise.all` so latency is `max(A, B)` not `A + B`. **Implementer should confirm** the SELECT completes within the shipped 30s query budget under the room-size p95 (~200 arguments); if not, batch the query to 200 ids at a time using the same pagination the gallery loader uses.
- **Realtime staleness.** Without a realtime subscription on the runs table, a room opened while pending will show "Still reading this…" until the user leaves and returns. This is a UX cost (small — the user's next action will refresh) and a correctness cost of zero (the state was true at load time). Mitigation: deferred realtime is documented as Gaps §3.
- **Copy drift on future descriptor families.** If a future family lands with `pending`/`dead_letter` semantics that differ from ARCH-001's (unlikely — the CHECK is fixed), the roll-up will treat any non-terminal state as pending. This is the safer default (silent-on-uncertainty). A firing negative control test pins this.
- **Ban-list guard drift.** The guard's `walkCopyTsUnderFeatures` completeness ratchet (test 805) will FIRE if a stray `pointFeedbackFlagsLifecycleCopy.ts` is created without adding it to the scan set. Placing the copy IN `gameCopy.ts` sidesteps this — but if the implementer decides to split it out (Gaps §5), they must add the new file to `SCAN_SET_TIER_A` in `__tests__/uxDoctrineCopyLint.test.ts`.
- **Prop-thread hop.** `classifierLifecycleByArgumentId` rides the existing `persistedObservationsByArgumentId` chain (hook → `ArgumentTreeScreen` → `ArgumentRoom` → Ringside/CardDetailPanel). Miss a hop and the pending line never fires; a wiring test asserts each hop.
- **Failure mode of the `SELECT`.** If the query fails (auth expired, network transient), the roll-up map is empty → every row folds to `'ready'` → byte-identical to today. **We NEVER surface the fetch error.** Pinned by the read-path safety test.
- **Cursor thin-air / rendering:** the `null` render on `'failed'` is critical. If a future refactor of `PointFeedbackFlagsRow` inadvertently makes the failed branch render an empty `<View>` (which is not identical to `null` under RN Web — it inserts a DOM node with the row's margin/padding), the surface shifts vertically on failure. Test: `render(...).toJSON()` MUST equal `null` for both `'ready'` and `'failed'` empty inputs.

---

## Out of scope

- **Any pipeline change.** The classifier queue, drainer, MCP adapter, submit-argument enqueue, RLS policies, family registry, batching — all untouched. The pipeline is the "black box on the other end" this card observes but does not touch.
- **Realtime updates for classifier lifecycle.** v1 is load-time only. A future card can add a realtime channel on `argument_machine_observation_runs` (Gaps §3).
- **Admin-surface changes.** The Admin Classifier Health view (`src/features/adminClassifierHealth/`) already has its own aggregate; this card does not affect it.
- **Retry from the client.** No "try again" button, no client-initiated re-enqueue. The pipeline decides retry via `retry_scheduled`; the client observes the outcome.
- **A dead-letter triage surface.** A "which arguments failed classification" list would be admin-only and is a separate card.
- **Introducing a new flag or cohort rollout.** This is a passive, silent-on-failure additive readout; no flag is warranted.
- **Widening the failure story into a visible strip.** Deliberately excluded — `null` on failure is doctrinally load-bearing (§4, §9).
- **A new `MoveDraftPatch` / composer intent path.** The lifecycle line is text-only; not interactive.
- **Realtime announcement (`AccessibilityInfo.announceForAccessibility`) on lifecycle transitions.** Deliberately excluded (see Decision 4 — chatty, contradicts §1 calm).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks):** the lifecycle line is a state readout of the machine's *own work*, never a verdict about a claim or a person. "Still reading this…" says nothing about the truth of the post. The failure state is SILENT — no failure verdict is surfaced. ✔
- **§3 (popularity ≠ evidence):** no engagement, no popularity, no heat signal participates in the roll-up. The state is derived from the queue's own `state` column, not from views/likes/replies. ✔
- **§4 (AI moderator hard limits):** no AI call from the client (production app rule). No client-side model inference. No client-side classification. The client reads what the drainer already wrote and folds it. The AI moderator remains server-only. ✔
- **§6 (secrets / provider bodies):** the SELECT reads only `argument_id, state`. No `provider_key`, `model_name`, `input_hash`, `failure_reason`, `dead_letter_reason`, `failure_sub_reason`, `lease_owner`, `last_attempt_at` is pulled — every operational field stays server-side. Nothing sensitive can reach the wire, let alone the UI. ✔
- **§7 (no AI calls from prod app):** none. ✔
- **§8 (Supabase conventions):** no migration, no RLS change, no table change, no policy change. Reads a shipped column via a shipped SELECT policy. Never disables RLS. Writes nothing. ✔
- **§9 (plain language):** the ONLY visible string is `Still reading this…`. No internal code (`pending`, `retry_scheduled`, `dead_letter`, `failed_terminal`, `provider_*`, `sub_reason`, `family`, `rawKey`) ever reaches the UI. The ban-list guard from #677/#950 scans `gameCopy.ts` on every test run. ✔
- **§10a (Observations vs Allegations):** the lifecycle state is an *operational* observation about the machine's own work — not an Observation about a move and not an Allegation from a user. It sits outside the descriptor layer. It renders as a small text line adjacent to the pill row, never inside a pill (which would imply an Observation about the move). ✔
- **`expo-rn-patterns`:** RN primitives only (`<Text>`). No new dep. Reduce-motion N/A. No platform branch. ✔
- **`accessibility-targets`:** `accessibilityRole="text"` (correct for a passive readout, not a button). No 44×44 target requirement (non-interactive). No live-region (deliberately — see Decision 4). Grayscale-legible (no color meaning). No focus order impact. ✔
- **`test-discipline`:** 4 new test files + 1 extended; ban-list coverage; firing negative controls; no wall-clock budgets. ✔

---

## Operator steps (if any)

**None to ship the code** — pure client-side additive change. No migration to `db push`. No Edge Function to `functions deploy`. No secret to set. No flag to flip in Netlify env.

The card lands and the pending line appears in production the moment the bundle rolls to users, for any room with a classifier run mid-flight at read time.

If a live-verification is desired post-merge:
1. Open a public room with a very recent post (< a few seconds old); the pending line should appear on the fresh post's active-node flag row.
2. Wait 10-30 seconds for the drainer tick; the line should disappear and either flags appear (calmer) or the row silently renders null (also calm).
3. There is no dead-letter case to reproduce cleanly — it requires a real classifier failure. The operator's Admin Classifier Health view is the correct surface to confirm the pipeline is behaving normally.

---

## Acceptance mapping (card AC → design section)

| Card acceptance criterion | Design section |
|---|---|
| Pending state is calm and plain-language | §Decisions 1 ("pending"), §Decisions 2 (copy strategy — `'Still reading this…'`), §API/interface contracts (`POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY`), §Test plan (render + ban-list) |
| Failure surfaces nothing alarming | §Decisions 1 ("failed"), §Decisions 4 (never a raw provider/error code), §API/interface contracts (render contract — `'failed'` → `null`), §Test plan (`render(...).toJSON()` is `null`; firing negative control for internal codes) |
| Reuse `gameCopy` lifecycle copy | §Decisions 2 (`POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY` added to `gameCopy.ts` next to `ROOM_REALTIME_COPY`), §File changes |
| Never surface a raw provider/error code (privacy/safety) | §Doctrine self-check §6 + §9, §Test plan (ban-list scan for `provider_*`, `dead_letter`, `retry_scheduled`, `failed_terminal`, `error`, `failed`), §Decisions 4 |
| Out of scope: classifier pipeline itself | §Scope-reality audit (client-side READ admitted; no server change), §Out of scope, §File changes ("NO server file is edited") |
| Blocked by UX-FLAGS-002 | §Dependencies (CLEARED — row substrate shipped) |
| Existing async classifier status (tech dep) | §Scope-reality audit (finding — the client had NO status read; this card ships the read for the first time using the already-shipped RLS SELECT policy; no server change) |

---

## Gaps needing an orchestrator ruling

1. **Client-side READ of classifier lifecycle (blocking interpretive judgment).** The card body's "Out of scope: The classifier pipeline itself" line is being read as PERMITTING a client-side READ of the queue's already-shipped `state` column via the already-shipped RLS SELECT policy. The alternative reading — "even a client-side lifecycle read is out of scope" — is defensible but produces a doctrinally weaker design (a time-based heuristic cannot distinguish pending from failed reliably, and any heuristic guesses a timeout that the drainer's actual retry/backoff logic sets). **Recommend admitting the read** — no server change, no migration, one small SELECT, docs already record precedent for the read-only exception. Confirm.

2. **Kill-switch for the pending line specifically.** Recommended: no flag is added (the line is silent-on-failure and does not create user-visible risk). If the operator wants an explicit kill switch, the seam is a one-line prop cap at `ArgumentRoom` (`lifecycleState={activePointLifecycleState}` becomes `lifecycleState={FEEDBACK_LIFECYCLE_ENABLED ? activePointLifecycleState : 'ready'}` gated by a static env read per #776). Confirm.

3. **Realtime updates for classifier lifecycle (v2 deferral).** Recommended: v1 is load-time only; a user who opens a room while pending sees "Still reading this…" until they reload. Realtime would follow the `usePointTagsRealtime` precedent but requires a channel subscription on `argument_machine_observation_runs`. Defer to a follow-up card unless the operator asks otherwise. Confirm.

4. **CardDetailPanel legacy-Cards surface parity.** UX-FLAGS-004 explicitly left CardDetailPanel as read-only for v1. UX-FLAGS-005 is *purely* read-only (no interactivity added), so parity here is a one-line prop pass with zero interactivity risk. Recommend: **wire all three mount sites** (Timeline / Ringside / CardDetailPanel) — the surface consistency win costs nothing. Confirm, or authorize leaving CardDetailPanel read-only-empty for parity with UX-FLAGS-004.

5. **Copy file placement.** Recommended: inline in `gameCopy.ts` (see Decision 2 — already-scanned Tier A). If the operator prefers per-feature copy files (mirroring `moveMarksCopy.ts`, `sourceChainPresetCopy.ts`, `markerCopy.ts`), the implementer would create `src/features/feedbackFlags/pointFeedbackFlagsLifecycleCopy.ts` AND add it to `SCAN_SET_TIER_A` in `__tests__/uxDoctrineCopyLint.test.ts` (this is a real edit to the scan-set list — the completeness ratchet enforces classification). Confirm.
