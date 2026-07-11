# UX-COMPOSER-005 — Quote / callback injection into the composer

**Status:** Design draft
**Epic:** Argument Surface Pivot — A. Quote Forge / Call-Back Weaver (M-ASP-2)
**Release:** M-ASP-2
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/831
**Base:** `0284c516` (main) · worktree `wt-quote-pair` · branch `feat/quote-callback-pair`
**Sibling card (same worktree — do NOT design):** QUOTE-FORGE-002 #842 — the rendered
callback move (timeline/stack/ringside node treatment). This doc owns only the
**composer side**: the insert affordance, the inline draft echo, the submit payload,
and the room→room link write. Node rendering is #842. Shared-seam decisions are called
out in a dedicated section for the orchestrator to reconcile.

---

## Goal (one paragraph)

From the composer, a participant "weaves a callback": pulls an **exact prior line** from
a settled room they can read, plus a link to that room, into the current draft; it shows
inline as a distinct woven echo before send; on send, the exact excerpt is threaded into
the submitted move and a QOL-042 room→room link is recorded (§5.A / §6 "How quote/callback
injection works"). This card lights up the **dark half** of the QOL-042 substrate at the
node grain: QUOTE-FORGE-001 (#861) shipped the room-level chip + room picker; this card
adds the per-move excerpt capture, the draft echo, and the submit wiring. The doctrine
that shapes it: a callback is a **link identity** (an echo of a prior moment), never a
verdict / standing / heat / truth signal (cdiscourse-doctrine §1–§3); score never gates
posting and this affordance never touches validation (the excerpt is advisory metadata,
not a rule input); a private prior room leaks only `title_only` per QOL-042's existing
access model; no AI, no service-role, no new Edge behavior, no migration.

---

## Scope-reality audit (read first — it reshapes the persistence decision)

The card's "Likely files" line (`composerState.ts:19`, `composerSubmit.ts:94–98`,
`crossRoom/argumentRoomLinksApi.ts`, `crossRoom/linkedPriorArgumentModel.ts`) and §5.A's
"reuses `targetExcerpt` capture path (`composerState.ts:19` → `composerSubmit.ts:94–98` →
`submit-argument/index.ts:282,370`)" both **imply the callback excerpt is persisted via
`arguments.target_excerpt`.** The pre-launch reality audit shows that path is **wrong**,
for three independent reasons. Because this card is orchestrator-adjacent (paired with a
sibling that consumes its output) and the brief's persistence assumption is load-bearing,
the audit is mandatory (POSTRUN-UX001 scope-reality rule).

**What is actually there:**

1. **`target_excerpt` is "quote-the-PARENT", not a free excerpt slot.** The engine rail
   C-RAIL-001 (`src/domain/constitution/railsChecks.ts:120–122`) does
   `input.parentBody.includes(target.targetExcerpt)` — it expects the excerpt to be a
   substring of the **current room's parent body**. A cross-room callback line is *not*
   in the current parent's body. `messageQualifiers.ts:147` marks any move with a
   `targetExcerpt` as `quote_exact_bit`; `AdminArgumentsTab`, `refereeCardAssembly`, and
   `conversationMoves` all read `target_excerpt` as the in-room quote. Stuffing a
   foreign-room line there **mislabels the move** and cannot coexist with a genuine
   parent quote (there is exactly one `target_excerpt`). So `target_excerpt` is rejected
   as the callback channel.

2. **`argument_room_links` is room→room, one row per `(source,target)` pair.** Columns:
   `id, source_debate_id, target_debate_id, created_by, target_title_snapshot, note,
   is_removed, created_at` (`argumentRoomLinksApi.ts:55–68`). There is **no excerpt
   column and no argument-id column.** The link cannot carry a per-move exact excerpt,
   and the `one_link_per_pair` UNIQUE means a second callback to the same prior room
   returns the *existing* link (idempotent) — so `note` can hold at most one line and is
   the wrong grain for a per-move excerpt. The link is the durable **room reference**,
   not the node-level echo.

3. **`submit-argument` is byte-preserved (pinned boundary).**
   `__tests__/uxOneOneFiveReadOnlyBoundary.test.ts` confines any diff under
   `supabase/functions/submit-argument/` to the classifier-dispatch tail. And the
   ROOM-003 byte-shape census (`__tests__/roomThreeByteShapeContract.test.tsx`) asserts
   `buildSubmitArgumentPayload` emits **exactly** the required keys (+ optional
   `attached_evidence`, `target`) and **nothing else**. So I can add **no new top-level
   payload key** and can add **no new Edge field handling.** `server_validation` is
   **server-owned** (`index.ts:369`; the QOL-037 `evidence_response` block is copied into
   it *by the Edge*, `index.ts:353–355`) — the client cannot write it without an Edge
   change, which is out of scope.

**Consequence.** The only channel that (a) is client-writable, (b) lands verbatim in the
persisted row with **no Edge change**, (c) is a **separate field from `body`** (required
by #842's privacy gate — see reconciliation), and (d) is already on the read path, is
the existing permissive passthrough **`client_validation`**
(`validationSchemas.ts:115` `client_validation: z.record(z.unknown()).optional()`;
stored verbatim at `index.ts:368` `client_validation: data.client_validation ?? {}`;
read back by `argumentsApi.ts:140,74` as `clientValidation`). The callback ref is written
under a namespaced key `client_validation.crossRoomCallback`.

**Scope correction.** The brief's "reuses `targetExcerpt`" is honored as the **capture
UX precedent** (the same select-an-exact-line affordance), *not* as the persistence
column. Effort stays `M`. No migration, no Edge change.

---

## Data model

**No new table, no new column, no migration.** Three additive shapes: a draft field, a
persisted-ref type (the shared write/read contract), and a captured-selection type.

### 1. Draft state — additive OPTIONAL field on `ComposerDraft`

`src/features/arguments/composerState.ts` (`ComposerDraft`, ~line 19, NOT pinned):

```ts
export interface ComposerDraft {
  // …existing fields unchanged…
  targetExcerpt: string | null;      // UNCHANGED — the in-room quote-the-parent excerpt
  // NEW — the pending cross-room callback attached to this draft. OPTIONAL so
  // existing fixtures/drafts that omit it still type-check and JSON.stringify to
  // the identical fingerprint (undefined keys drop). null / absent = no callback.
  pendingCallback?: CrossRoomCallback | null;
}
```

`CrossRoomCallback` — the value held on the draft while composing (before send):

```ts
export interface CrossRoomCallback {
  /** The PRIOR settled room this callback echoes. The join key #842 resolves. */
  targetDebateId: string;
  /** The prior room's title, snapshotted at capture time (author was authorized). ≤ 200 chars. */
  targetTitleSnapshot: string;
  /** The EXACT prior line, verbatim from a move the weaver legitimately read. ≤ 240 chars (clamp at capture). */
  excerpt: string;
  /** The prior-room argument id the excerpt came from — for a FUTURE move-level deep-link. Not used for nav in v1. */
  capturedFromArgumentId: string | null;
}
```

### 2. Persisted ref — the shared WRITE/READ contract (`client_validation.crossRoomCallback`)

New shared module `src/features/arguments/crossRoom/crossRoomCallbackRef.ts` is the
**single source of truth** for what lands in the persisted row. This card WRITES it;
#842 READS it (its `readCallbackRef` adapter imports this type + key from here rather
than re-declaring `PersistedCallbackRef`, so the shape cannot drift).

```ts
/** The exact object stored at arguments.client_validation.crossRoomCallback. Advisory, non-blocking. */
export interface CrossRoomCallbackRef {
  /** The prior room echoed — #842's join key into its resolved QOL-042 link (one link per target/room). */
  targetDebateId: string;
  /** The exact echoed prior line, snapshotted at weave time. ≤ 240 chars. */
  excerpt: string;
  /** Prior room title snapshot — a title-only fallback + origin label seed. ≤ 200 chars. */
  targetTitleSnapshot: string;
  /** Prior-room argument id of the echoed move (future move-level deep-link). Optional. */
  capturedFromArgumentId?: string | null;
  /** Schema tag for forward-compat / adapter validation. Literal 1. */
  v: 1;
}

/** The reserved key inside client_validation. */
export const CROSS_ROOM_CALLBACK_KEY = 'crossRoomCallback' as const;

/** Pure. Returns a new client_validation object with the callback ref merged in (never mutates input). */
export function writeCrossRoomCallback(
  clientValidation: Record<string, unknown> | undefined,
  callback: CrossRoomCallback,
): Record<string, unknown>;

/** Pure. Extracts + validates a CrossRoomCallbackRef from a client_validation blob, or null. */
export function readCrossRoomCallback(clientValidation: unknown): CrossRoomCallbackRef | null;
```

> **Note — join key is `targetDebateId`, not `linkId`.** #842's draft assumes the ref
> carries `linkId` (the `argument_room_links.id`). Under the honest submit ordering
> (below), the link is created **after** the move is posted, so its `id` is **not known**
> when the ref is written. `targetDebateId` **is** known at capture time and uniquely
> identifies the room's one link per target — so it is the correct, ordering-independent
> join key. This is reconciliation item #1.

### 3. Captured selection — the picker/line-capture return

`src/features/arguments/crossRoom/callbackCaptureModel.ts` (new, pure): a
`CallbackCaptureResult = { targetDebateId, targetTitleSnapshot, excerpt, capturedFromArgumentId }`
plus `clampCallbackExcerpt(raw): string` (trim + `.slice(0, 240)`) and
`isCaptureUsable(result): boolean` (non-empty excerpt + non-empty targetDebateId + not
self-room). This is what the capture flow produces and `pendingCallback` is set from.

---

## File changes

### New files

- `src/features/arguments/crossRoom/crossRoomCallbackRef.ts` — shared persisted-ref type
  + `CROSS_ROOM_CALLBACK_KEY` + `writeCrossRoomCallback` + `readCrossRoomCallback`. Pure
  TS, no React/Supabase. **~90 lines.** (The write/read contract shared with #842.)
- `src/features/arguments/crossRoom/callbackCaptureModel.ts` — `CrossRoomCallback` type
  (re-export from composerState or co-locate), `CallbackCaptureResult`,
  `clampCallbackExcerpt`, `isCaptureUsable`, and a pure
  `deriveCallbackEchoPreview(callback): CallbackEchoPreview` that produces the inline
  draft-echo view-model (header, quoted line, origin line, remove-a11y). Pure TS. **~120 lines.**
- `src/features/arguments/crossRoom/callbackComposerCopy.ts` — every user-facing string
  for the composer-side surface (insert affordance, capture sheet, draft echo, remove,
  errors), plus a `_forbiddenCallbackComposerTokens()` ban-list (reuses/extends the
  QOL-042 `_forbiddenLinkedPriorTokens`). Pure TS. **~70 lines.**
- `src/features/arguments/crossRoom/CallbackDraftEcho.tsx` — presentational inline echo
  chip rendered in the entry composer when `pendingCallback` is set: distinct woven-echo
  look (glyph + quoted line + origin + a **Remove** control). RN primitives only. **~120 lines.**
- `src/features/arguments/crossRoom/CallbackCaptureSheet.tsx` — the line-capture step:
  after the shipped room picker returns a `targetDebateId`, lists that room's authorized
  posted moves (via `listArgumentsForDebate`) as tappable rows; tapping captures the
  move body verbatim (clamped) → `CallbackCaptureResult`. RN primitives (bottom sheet <
  720 / side panel ≥ 720, mirroring `ArgumentComposerDock`). **~180 lines.** *(Scope
  note: see "Capture UX" below — this is the minimal verbatim-capture surface; its depth
  is a scope decision.)*
- `src/features/arguments/crossRoom/useCallbackInsertion.ts` — the composer-side hook
  that orchestrates: open room picker → open capture sheet → set `pendingCallback` on the
  active draft (via `useArgumentComposer.updateField`); expose `clearCallback()`. **~120 lines.**

### Modified files (all edits additive; byte-identical when the flag is off / no callback)

- `src/features/arguments/composerState.ts` — add optional `pendingCallback?` to
  `ComposerDraft`; round-trip it through `draftToSession` / `sessionToDraft`. **~8 lines.**
  (Named seam, NOT pinned.)
- `src/features/session/types.ts` — add optional `pendingCallback?` to
  `ComposerDraftSession`. **~2 lines.** (NOT pinned.)
- `src/features/arguments/composerHelpers.ts` — `createEmptyDraft` sets
  `pendingCallback: null`; `updateDraftField`'s `Partial` already covers it. **~2 lines.**
  (NOT pinned.)
- `src/features/arguments/composerSubmit.ts` — (a) `createSubmissionFingerprint` includes
  `pendingCallback` (drops to identical string when undefined, so existing fingerprints
  are byte-stable); (b) `buildSubmitArgumentPayload` emits
  `client_validation: writeCrossRoomCallback(undefined, draft.pendingCallback)` **only
  when `draft.pendingCallback` is set** — callback-less drafts emit no `client_validation`
  key (census stays green). **~14 lines.** (Named seam, NOT pinned.)
- `src/features/arguments/composerValidation.ts` — extend `buildEvaluationInput` /
  the client char-budget so the **projected final body is unaffected** (the excerpt is
  NOT woven into body), and add an advisory pre-send check: `excerpt` non-empty +
  `targetDebateId` present + not self-room. Never blocks (advisory only). **~10 lines.**
  (NOT pinned.)
- `src/features/arguments/composer/useEntryComposerSubmit.ts` — on
  `SUBMISSION_SUCCEEDED`, capture the just-submitted `draft.pendingCallback` *before*
  `DRAFT_CLEARED`, and invoke a new additive-optional prop
  `onCallbackPosted?(callback, newArgumentId?)` (wired by the shell to
  `createArgumentRoomLink` + chip refresh). Absent → no-op (byte-identical). **~12 lines.**
  (NOT pinned; mirrors the MARK-002 `newArgumentId` widening at lines 38–40, 81–84.)
- `src/features/arguments/composer/ArgumentEntryComposer.tsx` — additive-optional props
  `onInsertCallback?`, `pendingCallback?`, `onRemoveCallback?`; render a **Callback slot**
  in the bar action row and the `<CallbackDraftEcho>` above the input **only when the
  props are present**; absent → byte-identical bar (mirrors the PROOF-002 `onOpenProof?`
  and MARK-002 `pendingMarkerScope` additive-optional precedents at lines 65–90). **~30 lines.**
  (NOT pinned.)
- `src/features/arguments/room/ArgumentRoom.tsx` — thread the callback props to
  `ArgumentEntryComposer`; wire `onCallbackPosted` → `linkedPrior.createLink` +
  `linkedPrior.refresh`; gate all of it on the `quote_forge` boolean threaded from
  `ArgumentTreeScreen`. **~35 lines.** (NOT pinned; additive, mirrors the
  `linkedPriorChips` threading already present at lines 501, 600, 2927.)
- `src/features/arguments/ArgumentTreeScreen.tsx` — the room shell already holds
  `useLinkedPriorRooms` (line 390) and the shipped `LinkTargetPickerSheet` (line 669);
  mount `useCallbackInsertion` + the `CallbackCaptureSheet`; pass the `quote_forge`
  boolean + handlers down to `ArgumentRoom`. **~45 lines.** (NOT pinned.)
- `src/lib/featureFlags.ts` — register the new default-OFF `quote_forge` flag (see Flag
  posture). **~14 lines.** (NOT pinned. Reconciliation item #3 — register ONCE.)
- `App.tsx` — one `isQuoteForgeEnabled()` accessor read; prop-thread `quoteForgeEnabled`
  to the shell exactly like `proofDrawerEnabled` / `moveMarksEnabled` (lines 613–616).
  **~4 lines.** (NOT pinned.)

### Deleted files

None.

### Explicitly NOT edited (pinned zero-diff — verified against `uxOneOneFiveReadOnlyBoundary.test.ts`)

`ArgumentComposer.tsx`, `ArgumentComposerDock.tsx`,
`composer/{ComposerContextStrip,CollapsedComposerStrip,composerDraftRegistry,composerKeyboardModel,useComposerFocusContext,composerActingOnModel,composerHaptics}`,
`oneBox/{OneBox,ActPopout,GoPopout,Popout}.tsx`, `validationActionMap.ts`, and the
`submit-argument` auth/validation/insert path. The callback affordance lives **only** on
the unpinned `ArgumentEntryComposer` bar and its unpinned shells (see "Where the
affordance lives").

---

## API / interface contracts

### `crossRoomCallbackRef.ts` (write side — this card)

```ts
export function writeCrossRoomCallback(
  clientValidation: Record<string, unknown> | undefined,
  callback: CrossRoomCallback,
): Record<string, unknown> {
  return {
    ...(clientValidation ?? {}),
    [CROSS_ROOM_CALLBACK_KEY]: {
      targetDebateId: callback.targetDebateId,
      excerpt: String(callback.excerpt ?? '').trim().slice(0, 240),
      targetTitleSnapshot: String(callback.targetTitleSnapshot ?? '').trim().slice(0, 200),
      capturedFromArgumentId: callback.capturedFromArgumentId ?? null,
      v: 1 as const,
    },
  };
}
```

`readCrossRoomCallback(blob)` returns the ref only when `blob` is an object, has a
`crossRoomCallback` object, `v === 1`, `targetDebateId` is a non-empty string, and
`excerpt` is a string; else `null`. It clamps `excerpt`/`targetTitleSnapshot` on read too
(defensive). #842's `readCallbackRef(serverValidation, clientValidation)` calls
`readCrossRoomCallback(clientValidation)` (server-side blob ignored — see reconciliation).

### `composerSubmit.ts` — payload emission (only change to the pure mapper)

```ts
export function buildSubmitArgumentPayload(draft: ComposerDraft, clientSubmissionId: string): SubmitArgumentInput {
  const payload: SubmitArgumentInput = { /* …unchanged required keys… */ };
  if (draft.attachedEvidence.length > 0) { /* …unchanged… */ }
  const hasTarget = draft.targetExcerpt != null || draft.disagreementAxis != null;
  if (hasTarget) { /* …unchanged… */ }
  // NEW — only when a callback is attached. No key emitted otherwise (census stays green).
  if (draft.pendingCallback) {
    payload.client_validation = writeCrossRoomCallback(payload.client_validation, draft.pendingCallback);
  }
  return payload;
}
```

`SubmitArgumentInput.client_validation` already exists (`edgeFunctions.ts:69`,
`client_validation?: Record<string, unknown>`) — **no new top-level key**, so the byte
census's exact-key assertions for callback-less drafts are untouched.

### `useEntryComposerSubmit.ts` — post-success link (honest ordering)

```ts
export function useEntryComposerSubmit(
  onSubmitSuccess: (newArgumentId?: string) => void,
  onCallbackPosted?: (callback: CrossRoomCallback, newArgumentId?: string) => void, // NEW additive-optional
): UseEntryComposerSubmitResult { … }
// inside submit(), on result.ok, BEFORE DRAFT_CLEARED:
const postedCallback = draft.pendingCallback ?? null;
// …existing SUBMISSION_SUCCEEDED + DRAFT_CLEARED + deleteDraft…
onSubmitSuccess(newArgumentId);
if (postedCallback && onCallbackPosted) onCallbackPosted(postedCallback, newArgumentId);
```

### `ArgumentEntryComposer` — additive-optional props

```ts
export interface ArgumentEntryComposerProps {
  // …existing…
  /** quote_forge only. Opens the room-picker → capture flow. Absent => no Callback slot (byte-identical). */
  onInsertCallback?: () => void;
  /** The callback attached to the active draft, if any. Drives the inline echo. */
  pendingCallback?: CrossRoomCallback | null;
  /** Remove the attached callback before send. */
  onRemoveCallback?: () => void;
}
```

### Room→room link creation — reuse the SHIPPED API, no Edge

`onCallbackPosted` (in the shell) calls the shipped
`createArgumentRoomLink({ sourceDebateId, targetDebateId, targetTitleSnapshot, createdBy })`
(`argumentRoomLinksApi.ts:155`) — caller-scoped, RLS + trigger enforced, **idempotent**
on `(source,target)` (23505 → existing row). Then `linkedPrior.refresh()` so #842's
chip resolves. No `submit-argument` change; no service-role.

### Line-capture read — reuse the SHIPPED API

`CallbackCaptureSheet` lists the picked room's posted moves via the shipped
`listArgumentsForDebate(targetDebateId)` (`argumentsApi.ts:224`, ARG_SELECT includes
`body`), which RLS gates to rows the caller may read. Tapping a row →
`clampCallbackExcerpt(row.body)` → `CallbackCaptureResult`.

---

## Where the insert-callback affordance lives (both surfaces)

- **`room_exchange_v2` ON (LIVE in prod) — the ROOM-003 one-bar `ArgumentEntryComposer`:**
  the affordance is a **Callback slot** in the bar's action row (peer to the shipped
  Source/More slots), gated on `quote_forge`. Tapping it runs `useCallbackInsertion`
  (room picker → capture sheet). The attached callback renders as `<CallbackDraftEcho>`
  above the input. This is the primary surface (`room_exchange_v2` is live), so the
  callback ships **dark behind `quote_forge`** even though the bar is live.
- **Legacy dock (`ArgumentComposer` / `ArgumentComposerDock`, pinned):** **NOT wired.**
  These are zero-diff pinned. Per §6 the callback lives in the "More context / Guide my
  point" modifier pop-out; the pinned dock hosts that pop-out, but wiring it would edit a
  pinned file. The callback affordance therefore rides the **unpinned entry composer
  only.** With `room_exchange_v2` live in prod the entry composer *is* the reachable
  reply surface, so no user-facing gap. (If product later wants callbacks in the pinned
  dock, that is a separate unpin card — flagged in Gaps.)

Rationale: this exactly follows the PROOF-002 / MARK-002 precedent — App reads the flag,
threads an optional handler + pending-state prop, the unpinned bar renders the surface
only when present, and the pinned dock is never touched.

---

## Submit ordering, idempotency, and cleanup (the honest sequence)

Two artifacts persist: (A) the **excerpt ref** inside the move's `client_validation`
(written at submit, in the byte-preserved insert path), and (B) the **room→room link**
(written after success). They are deliberately **decoupled** so a failure of one never
loses the other.

1. **Insert (client-only):** capture → `pendingCallback` on the draft. **No network
   write.** Removable via the echo's Remove control (`clearCallback`). Abandoning the
   draft leaves **no orphan** (no link, no row — the classic orphan-link problem is
   avoided precisely by deferring the link).
2. **Send:** `buildSubmitArgumentPayload` embeds `client_validation.crossRoomCallback`
   → `submit-argument` inserts the move with the ref. The **exact excerpt is threaded
   into the move here** (acceptance criterion #1).
3. **On success:** `onCallbackPosted` → `createArgumentRoomLink(...)` (idempotent) →
   `linkedPrior.refresh()`. The link powers #842's access-state chip + nav.

**Failure matrix:**

| Failure | State after | Recovery |
|---|---|---|
| Submit fails (step 2) | No move, no link. Draft retained with `pendingCallback` (retry reuses `clientSubmissionId` — same fingerprint). | User re-sends. Idempotent submit returns the same move on retry. |
| Submit OK, link create fails (step 3, network) | Move posted **with the excerpt ref**; **no room link yet.** #842 finds no link for `targetDebateId` → renders `unavailable` (excerpt suppressed by its access gate) until the link exists. | Show a **non-blocking** notice ("Callback posted — couldn't attach the prior-room link. Retry."); a Retry re-runs `createArgumentRoomLink` (idempotent). The move is never lost. |
| Two callbacks → same prior room | Two moves each carry their own ref; both resolve to the **one** idempotent `(source,target)` link. Correct — the link is room-level context, the echoes are per-move. | n/a |
| Duplicate submit (idempotent retry) | Same move id returned; `onCallbackPosted` may fire twice → `createArgumentRoomLink` idempotent → same link. | n/a (idempotent both layers). |

**Idempotency invariant:** neither layer double-inserts — `submit-argument` dedupes on
`client_submission_id`; `createArgumentRoomLink` dedupes on `(source,target)`.

---

## Access / privacy invariants (state + test)

- **INV-1 — weaver-capture gate (the composer never fabricates an excerpt).** A
  `pendingCallback.excerpt` may ONLY originate from `listArgumentsForDebate` rows that RLS
  returned to the **weaver** (they were an authorized reader of the prior room at capture
  time). The composer never types/synthesizes/back-fills an excerpt from a room the weaver
  cannot read. If `listArgumentsForDebate` returns zero authorized moves (prior room is
  `title_only`/`unavailable` **to the weaver**), the capture sheet shows the QOL-042
  `titleOnlyLockLine` and offers **no excerpt** — the callback degrades to a room-link
  only (or is not attachable). *Test:* given a capture sheet fed an empty authorized-moves
  list, no `pendingCallback.excerpt` can be set (the produced `CallbackCaptureResult` is
  `isCaptureUsable === false`).
- **INV-2 — link-chip access reused verbatim (no change).** Downstream viewers' access to
  the prior room is re-derived per viewer by QOL-042's `loadPriorRoomContext` →
  `buildLinkedPriorArgumentChip` (`authorized` / `title_only` / `unavailable`). #842 gates
  the rendered excerpt on that state and forces `echoedExcerpt = ''` off the `authorized`
  path. This card changes none of it. *Test (this card):* `writeCrossRoomCallback` never
  emits an access field and never fetches — access is not this card's to decide.
- **INV-3 — open tension: the excerpt sits in a broadly-readable field (needs a ruling
  for the QOL-039 era).** The ref lives in `arguments.client_validation`, which
  `argumentsApi` returns to **every current-room viewer**. So #842's render-time gate is
  the **only** protection: a viewer who can read the current room but not the prior room
  gets the excerpt suppressed **by the client render**, not by RLS. **Today this is moot**
  — QOL-039 (per-viewer private rooms) is not shipped and `loadPriorRoomContext` notes
  every open/locked room is currently readable, so no viewer is denied the prior room.
  **When QOL-039 lands,** a viewer without prior-room access could read the raw excerpt
  from the JSONB in the network response even though #842 hides it. Fully closing that
  requires the excerpt to live behind RLS (a schema change) — **out of scope here.**
  Recommendation: ship v1 (excerpt in `client_validation`, render-gated), and file a
  QOL-039-era follow-up to move the excerpt behind an access-checked read if per-viewer
  privacy is required. This is reconciliation item #2 / a Gap. *(Note: this is strictly
  better than the body-weave alternative, which #842 rejected because the body cannot be
  gated at all.)*

---

## Copy (doctrine-clean; exact strings)

`callbackComposerCopy.ts` (`CALLBACK_COMPOSER_COPY`, frozen):

```ts
insertAffordanceLabel: 'Weave a callback',
insertAffordanceA11y: 'Weave a callback — pull an exact line from a settled prior argument into this draft',
captureSheetTitle: 'Pick the line to call back',
captureSheetEmpty: "You don't have any settled arguments to reference yet.",
captureRoomStepTitle: 'Reference a prior argument',      // reuses QOL-042 createAffordance phrasing
echoHeader: 'Woven callback',
echoOrigin: (title: string) => `Callback to “${title}”`,
echoRemoveLabel: 'Remove callback',
echoRemoveA11y: 'Remove the woven callback from this draft',
lockedCaptureLine: 'Private — only its participants can open it. You can see the title here as context.',
linkAttachFailed: "Callback posted — couldn't attach the prior-room link. Retry.",
linkAttachRetryLabel: 'Retry link',
```

Doctrine: no verdict tokens; "callback / echo / woven / prior / from" carry no
verdict/amplification meaning. The word **"proof"** is banned box copy
(`oneBox/boxModel.ts:667 _forbiddenBoxTokens`) — none of the strings use it; the source
affordance is unaffected. `_forbiddenCallbackComposerTokens()` reuses the QOL-042
`_forbiddenLinkedPriorTokens()` set (verdict + amplification tokens + "access denied") and
is scanned across every string incl. the `echoOrigin(title)` interpolation with a benign
title. No internal code (`crossRoomCallback`, `client_validation`, `targetDebateId`) ever
appears in a user string.

---

## Edge cases

- **Empty / whitespace excerpt at capture:** `isCaptureUsable === false` → no
  `pendingCallback` set; the sheet keeps the user on the line list. Never persist an empty
  echo.
- **Excerpt longer than 240 chars:** `clampCallbackExcerpt` trims (write + read side). The
  echo shows the clamped line; no body-length coupling (excerpt is not in `body`).
- **Self-reference (targetDebateId === current room):** rejected at capture
  (`isCaptureUsable`) and by `createArgumentRoomLink` ("A room cannot reference itself.").
- **Prior room `title_only`/`unavailable` to the weaver:** capture sheet shows the lock
  line; no excerpt attachable (INV-1).
- **Callback removed before send:** `clearCallback` sets `pendingCallback = null` → no
  `client_validation` emitted → move posts as an ordinary reply; no link created.
- **Composer collapse/restore mid-draft:** `pendingCallback` round-trips through
  `draftToSession`/`sessionToDraft` (session persistence), so it survives collapse and app
  backgrounding exactly like `targetExcerpt`/`attachedEvidence`.
- **Submit fails after capture:** draft (incl. `pendingCallback`) retained; retry reuses
  the same `clientSubmissionId` (fingerprint includes `pendingCallback`, so a *changed*
  callback correctly mints a new id).
- **Link create fails after post:** non-blocking notice + idempotent Retry (failure
  matrix). The excerpt is already in the move.
- **Offline at capture:** `listArgumentsForDebate` fails → capture sheet shows the empty /
  could-not-load state (reuse `couldNotRefresh` phrasing); no partial callback.
- **Concurrent edits / two devices:** each device's draft holds its own `pendingCallback`;
  no shared mutable state. The link is idempotent so concurrent posts converge on one link.
- **Observer / not-seated user:** `canCreatePriorLink(participantSide)` (shipped,
  `linkTargetPickerModel.ts:94`) already excludes `observer`; the Callback slot is hidden
  for observers (they cannot post a move anyway).
- **Doctrine edge — "does the callback affect standing/heat?":** No. The excerpt is
  advisory metadata in `client_validation` (the engine never reads `client_validation`);
  it is not a rule input, not `target_excerpt`, not evidence. It cannot earn or suppress
  factual standing. The room link is room-level context (QOL-042 doctrine: activity, never
  score).
- **Flag off:** no Callback slot, no capture flow, no `pendingCallback` ever set → no
  `client_validation.crossRoomCallback` ever written → the whole surface is inert and
  byte-identical.

---

## Test plan

Pure-model + wiring tests. Real-derivation (run the production
`writeCrossRoomCallback`/`readCrossRoomCallback`/`buildSubmitArgumentPayload`, never a
fixture echo of the expected output). Firing negative controls for every scan. No
wall-clock `toBeLessThan(ms)` budget assertions anywhere (avoids the LIFE-001 / META-001
full-suite flake class). Pinned-file zero-diff preserved.

- `__tests__/crossRoomCallbackRef.test.ts`
  - `writeCrossRoomCallback` merges the ref under `crossRoomCallback`, preserves existing
    `client_validation` keys, clamps excerpt/title, sets `v: 1`, and **does not mutate**
    the input object (deep-equal the original after the call).
  - `readCrossRoomCallback` round-trips a written ref; returns **`null`** (firing negative
    control) for: `undefined`, `{}`, `{ crossRoomCallback: null }`, `{ crossRoomCallback:
    { targetDebateId: '' } }`, wrong `v`, non-object input — **no throw**.
  - determinism: same input → deep-equal output twice.
- `__tests__/composerSubmit.test.ts` (extend the existing suite)
  - a draft **without** `pendingCallback` emits **no** `client_validation` key (guards the
    byte census).
  - a draft **with** `pendingCallback` emits `client_validation.crossRoomCallback` with
    exactly `{ targetDebateId, excerpt, targetTitleSnapshot, capturedFromArgumentId, v }`
    and **no** other top-level payload key added.
  - `createSubmissionFingerprint` is **byte-identical** for a callback-less draft vs the
    pre-change output (fixture pin), and **differs** when `pendingCallback` changes.
- `__tests__/roomThreeByteShapeContract.test.tsx` — **run UNCHANGED**; assert it still
  passes (the additive optional field + conditional emission keep every existing key
  census + dual-render deep-equal green).
- `__tests__/callbackCaptureModel.test.ts`
  - `clampCallbackExcerpt` (trim + 240 cap); `isCaptureUsable` (empty excerpt / empty
    target / self-room → false; valid → true) — **INV-1 test**: an empty authorized-moves
    input can never yield a usable capture.
  - `deriveCallbackEchoPreview` produces the header/quoted-line/origin/remove-a11y for a
    valid callback; determinism.
- `__tests__/callbackComposerCopy.test.ts`
  - ban-list scan (`_forbiddenCallbackComposerTokens`) over every string **and** over
    `echoOrigin('Bike-lane baseline')` — firing negative control (a string containing a
    banned token fails).
  - no snake_case / internal-code (`crossRoomCallback`, `client_validation`,
    `targetDebateId`) leak in any user string.
- `__tests__/callbackDraftEcho.test.tsx` (RTL / JSDOM)
  - renders the echo header + quoted line + origin + a Remove `Pressable`
    (`accessibilityRole="button"`, 44×44 via `hitSlop`, `accessibilityLabel`); pressing
    Remove fires `onRemoveCallback`.
  - color-independence: the echo identity (glyph + text) is legible with color tokens
    neutralized (grayscale).
- `__tests__/useEntryComposerSubmit.test.tsx` (extend)
  - on success **with** a `pendingCallback`, `onCallbackPosted(callback, newArgumentId)`
    fires **once** with the just-submitted callback; on success **without**, it does not
    fire; on submit failure it does not fire and the draft (incl. `pendingCallback`) is
    retained.
- `__tests__/argumentEntryComposerCallback.test.tsx` (or extend the entry-composer suite)
  - with `onInsertCallback`+`pendingCallback` props present, the Callback slot + echo
    render; **absent → byte-identical** bar (snapshot / query count unchanged).
- `__tests__/uxOneOneFiveReadOnlyBoundary.test.ts` — **run UNCHANGED**; assert the pinned
  composer/oneBox/submit-path diffs stay empty.
- `__tests__/featureFlagsStaticEnv.test.ts` — extend for the new static
  `EXPO_PUBLIC_QUOTE_FORGE` literal + ban the dynamic form (only if this card owns the
  flag registration — reconciliation item #3).

---

## Dependencies (cards / docs / files)

- **Assumes QUOTE-FORGE-001 (#861) is complete** because this card reuses its picker
  (`LinkTargetPickerSheet`), its hook (`useLinkedPriorRooms` — for `createLink` +
  `refresh` + chip resolution), and the QOL-042 access model. Confirmed shipped
  (`git log`: PR #861, merge `c1799d76`; substrate present in `crossRoom/`).
- **Reads** the shipped `createArgumentRoomLink` (`argumentRoomLinksApi.ts:155`) and
  `listArgumentsForDebate` (`argumentsApi.ts:224`) — both caller-scoped, RLS-gated, no
  Edge, no service-role.
- **Reads/writes** the `client_validation` round-trip (`submit-argument/index.ts:368`
  store; `argumentsApi.ts:140,74` read) — the permissive `z.record(z.unknown())` passthrough.
- **Blocks / atomically paired with QUOTE-FORGE-002 (#842)** — #842 reads the
  `CrossRoomCallbackRef` this card writes. They must merge together behind one flag
  (below). #842 is design-drafted in this worktree at `docs/designs/QUOTE-FORGE-002.md`.
- **Design doc §5.A / §6.221** (`PRODUCT-REDIRECT-RECORDED-WIT-PRIVATE-MEMORY-2026-06-28.md`)
  — the ratified woven-echo concept.

---

## Risks

- **Persistence-seam divergence with #842 (top risk).** #842's draft assumes the ref
  carries `linkId` and lists `server_validation.crossRoomCallback` as the recommended
  home. Both are **infeasible** here: `linkId` is unknown at ref-write time under the
  safe post-success ordering, and `server_validation` is **server-owned** (writing it
  needs an Edge change, which is out of scope). This card's contract is
  **`client_validation.crossRoomCallback`, keyed on `targetDebateId`.** #842's
  `readCallbackRef` must read `client_validation` and join on `targetDebateId`. If the
  orchestrator instead mandates `linkId`, this card must switch to **create-link-at-insert**
  ordering (accepting orphan-link risk on draft abandon) — a real change. Isolate all
  coupling in `crossRoomCallbackRef.ts` so a mismatch is a one-file fix. **Reconciliation
  item #1.**
- **Flag double-registration.** Both cards need `quote_forge`. If both edit
  `featureFlags.ts` + `featureFlagsStaticEnv.test.ts`, they collide on merge. Exactly one
  card registers it. **Reconciliation item #3.**
- **`client_validation` semantic overload.** The field name reads "validation"; the
  callback is content-adjacent metadata. Mitigated by the namespaced `crossRoomCallback`
  key + `v: 1` tag. A reviewer may object; the audit shows it is the only client-writable
  passthrough without an Edge change. Document the rationale in the PR.
- **`ArgumentEntryComposer` render pins.** The bar has render/snapshot tests
  (`roomThreeByteShapeContract`, entry-composer suites). Keep every edit additive-optional
  and prove byte-identical when the props are absent, or those pins fire.
- **Capture-UI depth (scope creep).** `CallbackCaptureSheet` reads one room's moves — this
  is bounded (not cross-room *search*, which is QUOTE-FORGE-003 / the v1 "no argument
  search" non-goal). Keep it a plain tappable list of the picked room's authorized moves;
  do not add typeahead/search. Flagged as a scope decision (Gaps).
- **QOL-039-era excerpt exposure (INV-3).** The render-time gate is the only privacy
  protection for the excerpt until per-viewer private rooms ship; noted as a follow-up.
- **`fingerprint` change.** Adding `pendingCallback` to `createSubmissionFingerprint` is
  safe **only** because `JSON.stringify` drops `undefined` — verify the fixture-pinned
  fingerprint test stays byte-stable for callback-less drafts.

---

## Out of scope

- The rendered callback **node** treatment on timeline/stack/ringside — **QUOTE-FORGE-002
  #842** (sibling). This card renders **only** the inline **draft** echo (pre-send), which
  is self-contained and shares the woven-echo visual *vocabulary* (glyph + quoted strip +
  origin line) as a reconciliation seam, not the node view-model.
- The **prior-room picker** — shipped (QUOTE-FORGE-001 #861); reused, not rebuilt.
- **Cross-room callback search** — QUOTE-FORGE-003 (#843); collides with the v1 "no
  argument search" non-goal. The capture sheet lists **one** already-picked room's moves.
- The **"Echo landed" celebration** — QUOTE-FORGE-004. No confetti / motion here.
- **Move-level deep-link** into the exact prior node (`capturedFromArgumentId` is captured
  but not wired to nav — nav is room-level today).
- Wiring the callback into the **pinned legacy dock** (`ArgumentComposer`) — would edit a
  pinned file; separate unpin card if product wants it.
- Any **migration / new column / Edge Function change / service-role** use.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels):** the callback is a link identity ("Woven
  callback" / "Callback to …"); it never says the prior argument won/proved/was correct.
  Copy is ban-list-scanned. **Score never blocks posting** — the excerpt is advisory
  `client_validation` metadata the engine never reads; the affordance touches no validation
  outcome. ✔
- **§2 (heat ≠ truth) / §3 (popularity ≠ evidence):** the echo reads no heat, standing,
  engagement, or count. The room link is activity-level context (QOL-042), never score. ✔
- **§4 (AI limits):** no AI anywhere — pure capture + pure write + shipped caller-scoped
  reads. ✔
- **§6 (secrets) / §7 (no AI/service-role from prod):** no keys, no provider calls, **no
  service-role** — the link write and moves read run under the caller's JWT via the shipped
  QOL-042 / arguments APIs (RLS-enforced). No `.env*` touched. ✔
- **§8 (Supabase conventions):** no migration, no RLS change, no direct
  `public.arguments` insert (the move goes through the unchanged `submit-argument`); the
  link is a soft-removable `argument_room_links` row via the shipped API; access is the
  RLS-derived QOL-042 model, unchanged. ✔
- **§9 (plain language):** every user string is in `callbackComposerCopy.ts`; no internal
  code (`crossRoomCallback`, `client_validation`, `targetDebateId`) reaches the UI. ✔
- **§10a (observations vs allegations):** the callback is neither — it is the author's own
  cited content + a room reference; it makes no machine claim about a person and asserts no
  truth. ✔
- **expo-rn-patterns:** RN primitives only (`View`/`Text`/`Pressable`), no new dep; the
  bottom-sheet/side-panel mirror `ArgumentComposerDock`; model files are pure TS. ✔
- **accessibility-targets:** the Callback slot, capture rows, and Remove control are
  `Pressable` with role/label/state + 44×44 (`hitSlop`); the echo identity is
  color-independent (glyph + text); reduce-motion N/A (static chrome). ✔
- **Privacy (card requirement):** INV-1 (weaver-capture gate) + INV-2 (QOL-042 link access
  reused verbatim) + INV-3 (open QOL-039 tension flagged); the composer never fabricates an
  excerpt from a room the weaver cannot read. ✔
- **v1 scope guards:** no voting/winner, no argument search (capture is one-room browse),
  no OAuth/push/public-API/real-time-edit. ✔

---

## Operator steps (if any)

**None from this card as a pure code change** — no migration, no Edge deploy (the
`client_validation` passthrough uses the *existing* permissive schema; `submit-argument`
is byte-preserved). The **only** operator step is the shared **feature-flag flip**, gated
until the pair (#831 + #842) merges: set `EXPO_PUBLIC_QUOTE_FORGE=true` (Netlify env, like
the other ASP flags) to roll callback weave out, and flip it off as a kill switch. It
ships **dark** at merge because the flag defaults OFF.

---

## Shared-seam reconciliation list (orchestrator — #831 ⇄ #842)

1. **Persisted ref: home, key, and join key (blocking).** This card writes
   **`arguments.client_validation.crossRoomCallback`** = `{ targetDebateId, excerpt,
   targetTitleSnapshot, capturedFromArgumentId?, v: 1 }`, defined in the shared
   `crossRoom/crossRoomCallbackRef.ts`. #842's design assumes `server_validation` +
   `linkId`; **both must change**: `server_validation` is server-owned (needs an Edge
   change — out of scope), and `linkId` is unknown at write time under the safe ordering.
   Agree: #842 imports `CrossRoomCallbackRef` + `CROSS_ROOM_CALLBACK_KEY` from the shared
   module, reads `client_validation`, and **joins on `targetDebateId`** (one link per
   target/room, so equivalent to a `linkId` join). #842 already has
   `targetDebateIdForLink`; it needs the inverse (link-by-targetDebateId), a trivial map
   from `useLinkedPriorRooms` chips.
2. **Excerpt is a separate JSONB field, NOT inline in `body` (agrees with #842 item #2).**
   Confirmed — the excerpt lives in `client_validation.crossRoomCallback.excerpt`, so
   #842's render-time access gate can suppress it for `title_only` viewers. **Caveat
   (INV-3):** `client_validation` is broadly readable by current-room viewers, so the gate
   is a *render* gate, not RLS. Fine for v1 (QOL-039 absent); a QOL-039-era follow-up is
   needed for true per-viewer redaction (schema change). Confirm v1 acceptance.
3. **Single shared feature flag `quote_forge` (default-OFF).** Adopt #842's proposed name
   `quote_forge` / `EXPO_PUBLIC_QUOTE_FORGE`. **Register it in exactly one card** — recommend
   **#831 (this card, the write/persistence side)** owns the `featureFlags.ts` +
   `featureFlagsStaticEnv.test.ts` registration since it merges the substrate the flag
   guards; #842 consumes the accessor only. (Alternatively a tiny shared precursor.)
4. **Woven-echo visual vocabulary.** This card's `<CallbackDraftEcho>` (draft) and #842's
   `<CallbackEchoStrip>` (rendered node) should share the same glyph (`⤴`), header ("Woven
   callback"), origin phrasing ("Callback to …"), and quoted-strip treatment so a draft
   echo and its posted node read as one family. Neither owns the other's component; align
   the copy constants (both can import `echoOrigin`/`echoHeader` from
   `crossRoom/callbackComposerCopy.ts` **or** #842's `callbackEchoCopy.ts` — pick one home
   to avoid duplicate strings).
5. **Link availability for #842's nav + chip.** #842 opens the prior room via
   `onOpenPriorRoom(targetDebateId)` and resolves access via the QOL-042 chip — both need
   the **room link to exist.** This card creates it **post-submit-success** (idempotent);
   on a transient link-create failure the echo degrades to `unavailable` until retried.
   Confirm this degradation is acceptable (recommended) vs. requiring create-at-insert.

---

## Gaps needing an orchestrator ruling

- **Join key `targetDebateId` vs `linkId`** (reconciliation #1). Recommend `targetDebateId`
  (ordering-independent). If `linkId` is mandated, this card switches to create-link-at-insert
  and accepts orphan-link-on-abandon.
- **Capture-UI depth.** Recommend the minimal verbatim line-capture (one-room tappable
  move list). Confirm this is the intended scope for "reuses `targetExcerpt` capture" (vs a
  richer span-selection UI, which would enlarge the card) and that browsing one picked
  room's moves does not tread on the QUOTE-FORGE-003 search boundary.
- **Legacy dock coverage.** The callback rides the unpinned entry composer only; the pinned
  `ArgumentComposer` dock is not wired. Confirm acceptable (recommended, since
  `room_exchange_v2` is live) or spin an unpin card.
- **QOL-039-era excerpt redaction** (INV-3). Confirm v1 ships with the render-gated
  excerpt in `client_validation`, and file a follow-up to move it behind RLS when
  per-viewer private rooms land.
- **Own-move callback.** Own callbacks render the draft echo (content, not a control/score)
  — consistent with the own-bubble control doctrine. Flag if product wants own callbacks
  visually quieter.

---

## Orchestrator reconciliation addendum (implementation — feat/quote-callback-pair)

Recorded at implementation time (roadmap-implementer). The design body above is the
spec; where a design assumption conflicts with the binding orchestrator rulings below,
**the rulings win** (they resolve every open Gap and shared-seam item). This addendum is
identical on both `UX-COMPOSER-005.md` (#831, composer side) and `QUOTE-FORGE-002.md`
(#842, render side) so the pair reads as one contract.

- **R1 — Persisted ref home.** The per-move callback ref lives at
  `arguments.client_validation.crossRoomCallback` (namespaced key on the existing
  permissive `z.record(z.unknown())` passthrough). #842's `server_validation` assumption is
  **overruled** — `server_validation` is Edge-owned and `submit-argument` stays
  byte-preserved. The excerpt is a **separate field** inside that block
  (`crossRoomCallback.excerpt`), never woven into `body`. Single source of truth:
  `crossRoom/crossRoomCallbackRef.ts` (this card writes; #842 reads).
- **R2 — Join key `targetDebateId`.** The ref joins on `targetDebateId`, not `linkId`
  (`linkId` is unknown at ref-write time under the safe post-success link ordering). The
  ref also carries `capturedFromArgumentId` (future move-level deep-link), but nav stays
  room-level via the shipped `onOpenPriorRoom(targetDebateId)` channel. #842's
  `readCallbackRef` reads this shape and degrades to a plain move on an absent / malformed
  ref.
- **R3 — Privacy framing is UX-consistency, not RLS.** The excerpt is author-republished
  speech in a broadly-readable JSONB column (equivalent to a body-paste). #842's
  render-time suppression (`echoedExcerpt` forced empty for `title_only` / `unavailable`)
  ships as a UX-consistency treatment per the card acceptance criterion and is documented
  in code + docs as **NOT** an RLS / privacy boundary. No copy promises secrecy of the
  excerpt (the "Private …" lock line describes the prior ROOM's QOL-042 access state, which
  IS RLS-derived — not the excerpt). Additional rule: a ref present with **no matching
  link row** (post-success link write failed) renders the locked / unavailable arm — never
  an excerpt without an authorized access state resolved from `useLinkedPriorRooms`.
- **R4 — One new 9th default-OFF flag `quote_forge` (`EXPO_PUBLIC_QUOTE_FORGE`).**
  Registered exactly once in `featureFlags.ts` + `featureFlagsStaticEnv.test.ts` by this
  card (the write side). Both surfaces consume via App.tsx prop-threading — **zero
  `featureFlags` imports under `src/features`**. Flag-off ⇒ byte-identical surfaces AND no
  `crossRoomCallback` key emitted in the submit payload (ROOM-003 deep-equal census stays
  green). Ringside echo mounts only where Ringside mounts (`room_exchange_v2`) AND
  `quote_forge` on; Timeline / Stack echo require `quote_forge` only.
- **R5 — Minimal capture UI.** Pick a verbatim line from the shipped capture substrate (the
  linked-prior room content the viewer legitimately sees via `listArgumentsForDebate`). No
  span-selection UI, no cross-room search (that is QUOTE-FORGE-003 / the v1 no-search
  guard). The legacy pinned dock gets nothing — the affordance exists only on the unpinned
  `ArgumentEntryComposer` surface.
- **R6 — Link created POST-submit-success** via the shipped idempotent
  `createArgumentRoomLink`; a link-write failure degrades per R3 (no retry machinery).
- **R7 — Excerpt snapshot persists** (MARK-002 server-snapshotted-quote precedent); no
  redaction machinery. Own-authored callbacks render identically (no quieter variant).

**Implementation-topology adaptation (recorded honestly).** The #831 file-list assumed
`ArgumentEntryComposer` is rendered inside `room/ArgumentRoom.tsx` and that
`useCallbackInsertion` + `CallbackCaptureSheet` mount in `ArgumentTreeScreen`. In the live
tree, `ArgumentEntryComposer` is mounted directly in `App.tsx` (sibling of
`ArgumentTreeScreen`), and `useLinkedPriorRooms` lives in
`ArgumentTreeScreen.FullRoomGameSurfaceMount` (which also owns the `rows` carrying
`clientValidation` and renders all three surfaces via `ArgumentGameSurface`/`ArgumentRoom`).
Therefore: (a) the composer-side capture flow (`useCallbackInsertion` + `CallbackCaptureSheet`
+ `LinkTargetPickerSheet`) mounts in **App.tsx** next to the entry composer, writing
`pendingCallback` onto the shared session draft and creating the room link on submit-success;
and (b) the #842 echo map (`callbackEchoByMessageId`) is derived **ONCE** in
`FullRoomGameSurfaceMount` — the single shell owning BOTH the per-move refs
(`rows[].clientValidation`) AND the resolved QOL-042 links — and threaded down through
`ArgumentGameSurface`/`ArgumentRoom` to Timeline / Stack / Ringside. This honors the
single-derivation rule (derived once, threaded to all three) and the intent of every design
contract; only the mount coordinates differ from the design's file-list. `pendingCallback`
stays on the session draft so `buildSubmitArgumentPayload` reads it (submit path unchanged).
```