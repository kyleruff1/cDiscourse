# SETTLE-001 — Host settle/lock room affordance (feeds the weave picker pool)

**Status:** Design draft
**Epic:** Argument Surface Pivot (ASP) · room UX lane (parent epic #826)
**Release:** ASP room-UX follow-ups (P2)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/911

---

## Goal (one paragraph)

The host (room creator) needs a calm, creator-only affordance to **settle** their argument — a state transition that flips `debates.status` from `open` to `locked`. Settling makes the room read-only for new moves (the deployed `submit-argument` already rejects posts unless `status ∈ {open, draft}`), keeps everything readable, and — the reason this card exists — makes the room eligible as a **weave-link target**. The already-live `quote_forge` picker only offers rooms whose `status = 'locked'` (mirrors the `link_target_must_be_locked` BEFORE-INSERT trigger on `argument_room_links`), yet **zero client lanes set `status='locked'` today**, so that pool can only grow via manual DB edits. This card ships the producer that feeds the live consumer. Doctrine shapes every choice: settling describes the **room's lifecycle**, never a verdict — no winner/loser/decided/final framing, no score or standing effect (the engine and `antiAmplification` are untouched). The write is a plain RLS-gated `UPDATE` via the `debatesApi` pattern — **no Edge Function, no migration, no new dependency, no service-role** — because a status transition has none of the cross-cutting side-effects that pushed QOL-039's visibility transition onto an Edge.

---

## Reality audit (pre-launch, per POSTRUN-UX001 scope-reality rule)

This card's success depends on current composer-mount placement and current status-gating behaviour, so a reality audit ran before design (findings are load-bearing):

1. **Locked-room rendering TODAY — audited honestly.** A repo-wide search of `src/` for any `debate.status`-based post/composer gating (`status === 'locked'`, `status !== 'open'`, `acceptingArguments`, etc.) returns **zero** gates. `debate.status` is read only for (a) the `DebateDetailHeader` visibility-eligibility context + its status chip (`debate.status.toUpperCase()`), (b) `DebateListScreen` / `conversationGalleryModel` list display, and (c) `timelineDensityLensModel` gallery signals. **No surface suppresses the composer or pre-checks status before posting.** Therefore, TODAY, opening a locked room renders the composer normally, and a user who types + submits hits `submit-argument:156` and gets the raw rejection `"Debate is not accepting new arguments"`. → The settled-state rendering IS in scope: this card must surface the read-only posture calmly and suppress the composer when `status='locked'`.
2. **Composer mount site — the wrap point.** Both live compose surfaces mount in **`App.tsx`** (un-pinned): `ArgumentComposerDock` (line ~1527, `visible={composerOpen}`) and `ArgumentEntryComposer` (line ~1548, gated by the LIVE `room_exchange_v2` flag — the primary compose surface). Neither is gated on status. The pinned composer files (`ArgumentComposer`, `ArgumentComposerDock`, `OneBox`, `composer/*`) are **not** edited — suppression happens at the un-pinned `App.tsx` mount (wrap-not-edit).
3. **Current data availability.** Zero locked rooms exist in prod except any hand-edited for the `quote_forge` smoke. So the composer-suppression behaviour change affects essentially no existing rooms until hosts start settling — low blast radius.
4. **Allowed vs required file scope.** The card's "pure client (no migration, no Edge, no new dep)" scope is accurate and sufficient. One expansion the card did not name explicitly: the settled-state suppression must live in **`App.tsx`** (the composer mount site), not in the pinned composer files. This is still "pure client." No hard blockers.
5. **Trigger/RLS blocker check — clear.** See Doctrine self-check + Risks: the only trigger on `debates` is column-scoped to `visibility`; status transitions (both directions) are unconstrained and permitted for the creator by the existing RLS UPDATE policy. Re-open (locked→open) needs zero backend.

---

## Data model

**No new data model. No migration.** The card rides entirely on existing schema:

- `public.debates.status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','locked','archived'))` — initial schema `20260516000001`, line 144-145. `'locked'` is already a legal value; the CHECK enforces the *set*, never a *direction*, so `open→locked` and `locked→open` are both CHECK-legal.
- RLS UPDATE policy `"debates: creator or mod can update"` (`20260516000002_rls_policies.sql:162-166`):
  ```sql
  ON public.debates FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_moderator_or_admin())
  WITH CHECK (created_by = auth.uid() OR is_moderator_or_admin());
  ```
  No column restriction, no status-value restriction, no directionality. A creator may set `status` to any legal value in either direction. `WITH CHECK` re-passes because `created_by` is unchanged.
- `is_debate_open_or_locked` (`20260516000006:80`) keeps `status IN ('open','locked')` readable — locked rooms stay fully readable.

The client-side `Debate` type already carries the fields the surface needs (`src/features/debates/types.ts`):
- `status: DebateStatus` where `DebateStatus = 'draft' | 'open' | 'locked' | 'archived'`
- `createdBy: string` — the room-owner column the RLS policy keys on (the creator gate MUST use this, not the participant `side`; see Risks §7).

New **pure-TS model types** (no DB, client-only) in `src/features/debates/settleRoomModel.ts` — mirrors `roomVisibilityModel.ts`:

```ts
export type SettleMode = 'settle' | 'reopen';

/** Stable internal reason code; each maps to plain language via ROOM_SETTLE_COPY. */
export type SettleReason =
  | 'eligible'
  | 'not_room_creator'
  | 'not_open'        // settle requires status='open'
  | 'not_locked';     // reopen requires status='locked'

export interface SettleContext {
  roomId: string;
  roomStatus: DebateStatus;
  callerUserId: string;
  createdByUserId: string;
}

export interface SettleEligibility {
  allowed: boolean;
  reason: SettleReason;
}

/** Bullet codes rendered in the confirm sheet; each maps to a ROOM_SETTLE_COPY string. */
export type SettleConsequence =
  // settle mode
  | 'no_new_moves'
  | 'stays_readable'
  | 'becomes_linkable'
  | 'reversible'
  // reopen mode
  | 'new_moves_allowed'
  | 'content_unchanged'
  | 'existing_links_kept';

export interface SettleConsequences {
  mode: SettleMode;
  effects: ReadonlyArray<SettleConsequence>;
}
```

---

## File changes

### New files
- `src/features/debates/settleRoomModel.ts` (~130 lines) — pure model. Exports the types above plus:
  - `canSettleRoom(ctx: SettleContext): SettleEligibility` — `allowed` only when `callerUserId === createdByUserId` **and** `roomStatus === 'open'`. Non-creator → `not_room_creator`; creator on non-open → `not_open`.
  - `canReopenRoom(ctx: SettleContext): SettleEligibility` — `allowed` only when `callerUserId === createdByUserId` **and** `roomStatus === 'locked'`. Non-creator → `not_room_creator`; creator on non-locked → `not_locked`.
  - `buildSettleConsequences(mode: SettleMode): SettleConsequences` — fixed effect list per mode (settle: `no_new_moves`, `stays_readable`, `becomes_linkable`, `reversible`; reopen: `new_moves_allowed`, `content_unchanged`, `existing_links_kept`).
  - Re-exports `ROOM_SETTLE_COPY` (model-scoped caller convenience, mirrors `roomVisibilityModel`). NO React, NO Supabase, NO network imports. Comments apostrophe-free (doctrine-scanner safety).
- `src/features/debates/RoomSettleConfirmation.tsx` (~140 lines) — mode-parameterized confirm modal. Direct structural clone of `MakePrivateConfirmation.tsx`: `<Modal transparent animationType={reduceMotion ? 'none' : 'fade'}>`, `accessibilityRole="alert"`, bullets from `SettleConsequences.effects` mapped to `ROOM_SETTLE_COPY`, Cancel + primary Pressables with `minHeight:44` + `accessibilityRole="button"` + `accessibilityState={{ busy: submitting }}`. Props: `{ visible, mode, consequences, submitting, onConfirm, onCancel, reduceMotion? }`.
- `src/features/debates/RoomSettledNotice.tsx` (~110 lines) — inline (non-modal) calm read-only strip shown in the composer area when `status='locked'`. Renders the settled headline + "still readable" line (`ROOM_SETTLE_COPY.notice_*`). When `canReopen` (creator-only) it also renders a "Re-open" `Pressable` (44px) that owns its own `reopenConfirming` + `submitting` state and mounts `<RoomSettleConfirmation mode="reopen" …>`. Props: `{ status, canReopen, onReopen, reduceMotion? }` where `onReopen: () => Promise<{ ok: boolean; error?: string }>`.

### Modified files
- `src/features/arguments/gameCopy.ts` (+~48 lines) — add a frozen `ROOM_SETTLE_COPY` block (action labels/hints, confirm scaffolding per mode, effect bullets per `SettleConsequence` code, settled-notice copy, reason codes, neutral error copy). Doctrine-clean; see § Copy below.
- `src/features/debates/debatesApi.ts` (+~46 lines) — add `settleDebate(debateId)` + `reopenDebate(debateId)` (direct RLS `UPDATE`; see § API contracts). Nothing existing changes.
- `src/features/debates/useDebates.ts` (+~38 lines) — add `settle(debateId)` + `reopen(debateId)` to `UseDebatesResult`, each calling the api then **optimistically patching** the local `debates` list (mirrors the existing `join` local-patch at lines 79-83), `refresh()`-on-error as reconciliation. Existing methods untouched.
- `src/features/debates/DebateDetailHeader.tsx` (+~44 lines) — add a **"Settle this argument"** row to the existing overflow inline panel (creator-gated via `canSettleRoom`, shown only when `status='open'`), mirroring the existing `showMakePrivate` row. Owns `settleConfirming` + `settleSubmitting` state and mounts `<RoomSettleConfirmation mode="settle" …>`. New optional props: `onSettle?: () => Promise<{ ok: boolean; error?: string }>`. (Additive — the file is NOT zero-diff pinned; see Pins.)
- `App.tsx` (+~28 lines) — (a) compute `const roomAcceptsMoves = currentDebate.status === 'open' || currentDebate.status === 'draft';`; (b) gate the two composer mounts on it (`visible={composerOpen && roomAcceptsMoves}`, `roomExchangeV2Enabled && roomAcceptsMoves`, and pass `onComposerExpand` only when accepting); (c) render `<RoomSettledNotice>` in the composer slot when `currentDebate.status === 'locked'`; (d) pass `onSettle` to `DebateDetailHeader` and `onReopen` + `canReopen` to the notice, both wired to `useDebates().settle/reopen`.
- `src/features/debates/index.ts` (+~4 lines) — export `settleRoomModel` surface + the two new components.
- `__tests__/copySystemBanList.test.ts` (+2 lines) — add `ROOM_SETTLE_COPY` to the `SHIPPED_COPY_CONSTANTS` scan list (this test scans a hardcoded list; a new copy block is NOT auto-covered — see Risks §2).

### Deleted files
None.

---

## API / interface contracts

### `debatesApi.ts` — the write lane (direct RLS UPDATE, no Edge)

```ts
/**
 * SETTLE-001 — settle (lock) a room via the existing RLS UPDATE policy
 * "debates: creator or mod can update". Direct client UPDATE (no Edge, no
 * migration) — the joinDebate precedent, NOT the QOL-039 Edge precedent,
 * because a status transition has no participant-drop / chime-in-reject /
 * notification / audit side-effects. Doctrine: a lifecycle state, never a
 * verdict; no score/standing effect.
 */
export async function settleDebate(debateId: string): Promise<DebateApiResult<{ status: 'locked' }>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };
  const { error } = await supabase
    .from('debates')
    .update({ status: 'locked' })
    .eq('id', debateId);
  if (error) return { ok: false, error: error.message }; // RLS denial surfaces honestly (neutral fallback in the hook)
  return { ok: true, data: { status: 'locked' } };
}

/** SETTLE-001 — re-open (unlock) a settled room. Same policy lane, reverse direction. */
export async function reopenDebate(debateId: string): Promise<DebateApiResult<{ status: 'open' }>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };
  const { error } = await supabase
    .from('debates')
    .update({ status: 'open' })
    .eq('id', debateId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { status: 'open' } };
}
```

Notes: RLS enforces creator-or-mod at the DB; the client UI additionally gates to creator-only (below). A non-creator whose request somehow reached the DB is denied by RLS (defence in depth). Neither function reads or returns any other row field. No `.select()` chained (the UPDATE returns nothing; the hook applies the known new status optimistically).

### `useDebates.ts` — optimistic local patch (mirrors `join`)

```ts
settle: (debateId: string) => Promise<{ ok: boolean; error?: string }>;
reopen: (debateId: string) => Promise<{ ok: boolean; error?: string }>;
```
Implementation mirrors `join` (lines 74-95): on `ok`, `setDebates(prev => prev.map(d => d.id === debateId ? { ...d, status: <'locked'|'open'> } : d))` so `currentDebate` (derived in `useCurrentDebate`) re-renders immediately with the new status → the settled state appears with no refetch/flicker. On failure, set the neutral error and call `void refresh()` to reconcile the list against the server.

### `settleRoomModel.ts` — eligibility

```ts
canSettleRoom(ctx: SettleContext): SettleEligibility   // allowed iff caller===creator && status==='open'
canReopenRoom(ctx: SettleContext): SettleEligibility   // allowed iff caller===creator && status==='locked'
buildSettleConsequences(mode: SettleMode): SettleConsequences
```

### Component props

```ts
// RoomSettleConfirmation.tsx
interface Props { visible: boolean; mode: SettleMode; consequences: SettleConsequences;
                  submitting: boolean; onConfirm: () => void; onCancel: () => void; reduceMotion?: boolean; }

// RoomSettledNotice.tsx
interface Props { status: DebateStatus; canReopen: boolean;
                  onReopen: () => Promise<{ ok: boolean; error?: string }>; reduceMotion?: boolean; }

// DebateDetailHeader.tsx — additive optional prop
onSettle?: () => Promise<{ ok: boolean; error?: string }>;   // creator settle write, provided by App via useDebates
```

### Copy (`ROOM_SETTLE_COPY`, doctrine-clean; final wording is the implementer's within the ban-list)

- `action_settle_label`: "Settle this argument"
- `action_settle_hint`: "No new moves can be added. The argument stays readable, and other rooms can link to it."
- `confirm_settle_title`: "Settle this argument?"
- `confirm_intro`: "Here is what changes:"
- `confirm_settle_primary`: "Settle" · `confirm_cancel`: "Cancel"
- `effect_no_new_moves`: "No new moves can be added — the exchange pauses as it stands."
- `effect_stays_readable`: "Everything stays readable — nothing is deleted or hidden."
- `effect_becomes_linkable`: "Other arguments can point to this one as a settled prior point."
- `effect_reversible`: "You can re-open it any time."
- `settle_toast`: "This argument is settled. You can re-open it any time."
- `notice_settled_title`: "This argument is settled"
- `notice_settled_body`: "No new moves are being added. You can still read everything here."
- `action_reopen_label`: "Re-open this argument"
- `action_reopen_hint`: "New moves can be added again."
- `confirm_reopen_title`: "Re-open this argument?"
- `confirm_reopen_primary`: "Re-open"
- `effect_new_moves_allowed`: "New moves can be added again."
- `effect_content_unchanged`: "Everything here stays exactly as it is."
- `effect_existing_links_kept`: "Any arguments that already linked to this one stay linked."
- `reason_not_room_creator`: "Only the person who started this argument can settle it."
- `error_network`: "Could not save the change. Try again in a moment."

Banned tokens explicitly avoided (per `copySystemBanList`): winner, loser, score, verdict, truth, wrong, decided, final, correct, "closed the case". "Settled" is the codebase's established lexical for `status='locked'` (QOL-042 trigger comment) and reads as a lifecycle state, not an outcome.

---

## Edge cases

- **Non-creator opens the room** (participant / observer / mod / admin): never sees the Settle action nor the Re-open action (UI gated creator-only via `canSettleRoom`/`canReopenRoom`). They DO see the settled-state notice + suppressed composer when the room is locked (read-only posture is actor-agnostic — nobody can post to a locked room).
- **Creator on a `draft` or `archived` room**: `canSettleRoom` returns `not_open` → the Settle action is absent (no silent no-op; the row simply does not render, mirroring `showMakePrivate`). Archived is out of scope (§ Non-goals) — the composer is still suppressed for archived (`roomAcceptsMoves` false) but the notice text is written for `locked`; archived never occurs in v1 (no client lane sets it).
- **Double-tap / concurrent settle by the same creator**: the confirm's `submitting` state disables both buttons during the write (mirrors make-private). The write is idempotent (`UPDATE … SET status='locked'` on an already-locked row succeeds, no-op).
- **RLS denial mid-flight** (e.g., ownership changed, session expired): the api returns `{ ok:false, error }`; the hook surfaces the neutral `error_network` copy and reconciles via `refresh()`. Never a raw Postgres string in the UI beyond the neutral fallback.
- **Offline / network failure**: same neutral-error path; no optimistic patch is applied on failure (patch only on `ok`), so the UI does not falsely show "settled".
- **New participants after settle**: the `debate_participants` INSERT policy already blocks joining a non-open/draft room (`20260516000002:187-188`). So settling also prevents new joins — a natural corollary of "no new moves." Documented here rather than added as a fourth confirm bullet to keep the sheet calm (implementer may add an `effect_no_new_joiners` bullet if the operator prefers).
- **Concurrent-settle race for a stale participant** (participant had the room loaded as `open`; the creator settles from another client): the participant's client has not refetched, so their composer is still mounted; a submit hits the existing `submit-argument` rejection. This is a rare, pre-existing raw-error path and is **out of scope** (see § Out of scope) — mapping that rejection code gracefully would require touching pinned composer/submit surfaces. The normal path (any client that knows `status='locked'`) is fully handled by App.tsx suppression.
- **Weave feedback loop (settling to become linkable)**: this is the point, not a bug — a settled room enters the `quote_forge` pool (`argumentRoomLinksApi` filters `.eq('status','locked')`).
- **Re-open of a room with inbound weave links**: those links were valid at INSERT time (the `link_target_must_be_locked` trigger only fires BEFORE INSERT). Re-opening to `open` does NOT cascade-delete them (no trigger on `debates.status`); the links persist and still resolve. Surfaced honestly by the `effect_existing_links_kept` bullet.

---

## Test plan

All pure-TS models get full public-function coverage; UI mirrors existing RTL patterns. Named files:

- `__tests__/settleRoomModel.test.ts` — **actor + status matrix** for `canSettleRoom` / `canReopenRoom`: creator+open→settle allowed; creator+locked→reopen allowed; creator+draft→`not_open`; creator+archived→`not_open`; non-creator (participant / observer / mod-side) on any status→`not_room_creator`; `buildSettleConsequences('settle'|'reopen')` returns the exact fixed effect lists.
- `__tests__/settleRoomModel.banlist.test.ts` — scans every `ROOM_SETTLE_COPY` string (via `flattenStrings`) against the doctrine ban-list (winner/loser/score/verdict/truth/wrong/decided/final/correct/…), **with a firing negative control** (a deliberately-violating string like "This side is the winner." trips the same matcher) proving the guard is live. Mirrors `roomVisibilityModel.banlist.test.ts`.
- `__tests__/copySystemBanList.test.ts` — **modified**: `ROOM_SETTLE_COPY` added to `SHIPPED_COPY_CONSTANTS` so the centralized system-wide scan covers it (the existing positive/negative controls already prove the matcher fires).
- `__tests__/debatesApiSettle.test.ts` — `settleDebate` / `reopenDebate` with a mocked `supabase` (house convention): assert the exact call shape `from('debates').update({status:'locked'|'open'}).eq('id', id)`, the happy `{ ok:true }` return, and the error path returns `{ ok:false, error }` (no `.select`, no service-role, no second table touched).
- `__tests__/RoomSettleConfirmation.test.tsx` — renders the right title + bullets per `mode`; **no write fires without confirm** (only `onConfirm` triggers the callback; `onCancel` / backdrop does not); buttons expose role + label + `accessibilityState.busy`; 44px targets; `reduceMotion` → `animationType='none'`.
- `__tests__/RoomSettledNotice.test.tsx` — renders the settled notice for `status='locked'`; **creator (`canReopen=true`) sees the Re-open pressable, non-creator (`canReopen=false`) does not**; the re-open confirm gates the `onReopen` call; a11y (role/label/state, 44px).
- `__tests__/DebateDetailHeader.settle.test.tsx` — **integration actor matrix**: creator + open → "Settle this argument" row present in overflow, confirm gates `onSettle`; creator + locked → Settle row absent (re-open lives on the notice); non-creator → row never present at any status; make-private behaviour unchanged (co-existence). Mirrors `DebateDetailHeader.visibility.test.tsx`.
- **Pinned-file zero-diff**: no new arm needed — the existing `uxOneOneFiveReadOnlyBoundary.test.ts` already `git diff main`-pins the composer/OneBox/submit files; this design touches none of them, so that suite stays green. The design MUST keep `App.tsx`'s composer suppression additive (it edits mount conditions in `App.tsx`, which is un-pinned, NOT the pinned composer files).
- **LIFE-001 / META-001 wall-clock note**: those two perf tests flake under full-suite parallel load but pass isolated; if either reddens in the full run and is not in this branch's diff, re-run it isolated before attributing it to this card (per `docs` known-flake note).

**Test-count budget:** ~ +6 new suites, roughly **+55–70 tests** (model matrix ~20, two ban-lists ~8, api ~6, three component/integration suites ~25-35). Net suite count goes UP.

---

## Dependencies (cards / docs / files)

- **Consumes / completes `quote_forge` (LIVE):** `src/features/arguments/crossRoom/argumentRoomLinksApi.ts:288-289` selects link targets with `.eq('status','locked')`. This card is the first client producer of `status='locked'`, so it directly grows that picker pool. Without it, the pool only grows by manual DB edits (the gap the issue was filed for).
- **Reuses the QOL-039 pattern** (`roomVisibilityModel.ts`, `MakePrivateConfirmation.tsx`, `DebateDetailHeader.tsx` overflow-panel wiring) — same shapes, different transition. Studies BOTH write precedents and deliberately picks the **direct-RLS-UPDATE** one (`joinDebate`), not the Edge one (`transitionRoomToPrivate`).
- **Reads existing** `Debate.status` + `Debate.createdBy` (`types.ts`), `useDebates.join`'s optimistic-patch pattern, `useCurrentDebate`'s list-derived `currentDebate`.
- **Assumes** the RLS UPDATE policy + status CHECK + column-scoped visibility trigger are as read from the migrations (verified in Doctrine self-check). No migration dependency.
- **Blocks nothing** but usefully un-gates any future card that wants a populated settled-rooms pool (weave analytics, gallery "settled" bucket, etc.).

---

## Risks

1. **Status ↔ visibility confusion (highest-value guard).** `status` and `visibility` are orthogonal columns. This card touches **only `status`** and must never write `visibility`. Verified: the only trigger on `debates` is `debates_enforce_visibility_one_way` (`20260524000015:120-123`), declared `BEFORE UPDATE OF visibility` — it fires *only* when `visibility` is in the SET list, and its body checks only `OLD.visibility='private' AND NEW.visibility='public'`. A `update({ status })` call never lists `visibility`, so the trigger never fires; even if it did, it is inert for status. → **Re-open (locked→open) is completely unconstrained; zero backend needed.** The implementer must not add `visibility` to any settle/reopen UPDATE.
2. **`copySystemBanList` does not auto-discover new copy.** `SHIPPED_COPY_CONSTANTS` is a hardcoded import list; forgetting to add `ROOM_SETTLE_COPY` means the system-wide scan silently skips the new copy. The dedicated `settleRoomModel.banlist.test.ts` is the belt; the `copySystemBanList` edit is the suspenders. Both are required.
3. **Doctrine-scanner apostrophe gotcha.** `uxOneOneTwoDoctrine`'s naive quote-parity scanner treats one apostrophe in any covered file's comment as file-wide string poison. Keep comments in `settleRoomModel.ts`, `gameCopy.ts` additions, and the edited `DebateDetailHeader.tsx` apostrophe-free, and run the doctrine suite pre-commit.
4. **`DebateDetailHeader` load-bearing pins.** The file is NOT zero-diff pinned (relaxed by UX-BOARD-READABILITY-001) but three pins remain: the strip-height cap (`uxOneOneTwoCompactStripHeight.test.tsx`, ≤48/56/64) — safe because the Settle row lives in the overflow **panel** below the strip row, not the row; the API-presence pin (`uxOneOneSixReadOnlyBoundary.test.ts:140-141`, `requiredApi:['DebateDetailHeader']`) — additive props/testIDs are safe; and topology (`uxBoardRail002Topology.test.tsx`). Keep the existing `debate-make-private-*` testIDs; add new ones (`debate-settle-action`, etc.) rather than renaming.
5. **Editing a widely-used hook (`useDebates`).** Additive only (two new methods mirroring `join`); the existing `debates/loading/error/refresh/create/join` surface is unchanged. Low risk but re-run any `useDebates`/room-shell suites.
6. **Composer suppression ripple.** Gating the two `App.tsx` composer mounts on `roomAcceptsMoves` is a real behaviour change for locked rooms (composer now suppressed for everyone). Verified low-risk: ~zero locked rooms exist today, and the change is strictly an improvement (no more raw submit errors in locked rooms). It must not disturb the open/draft path (default `roomAcceptsMoves === true`).
7. **Host-not-creator edge — the `moderator` SIDE trap.** The participant `side` value `'moderator'` denotes the host/creator's *seat*, but the authoritative owner field is `created_by`. The creator gate MUST be `callerUserId === debate.createdBy` (what the RLS UPDATE policy keys on), NOT `participantSide === 'moderator'`. Using the side would (a) mis-gate a mod/admin who is not the creator and (b) diverge from the RLS boundary (UI could offer an action the DB then denies). This mirrors `canTransitionToPrivate`'s `callerUserId !== createdByUserId` check exactly. Platform mods/admins do not see the in-room settle control (UI is creator-only, even though RLS also permits mods) — consistent with QOL-039.

---

## Out of scope

- **Archival** (`status='archived'`) — untouched; no client lane sets it.
- **Any change to `submit-argument`** or the QOL-042 `link_target_must_be_locked` trigger.
- **Graceful mapping of the concurrent-settle raw submit error** for a stale participant mid-compose (rare, pre-existing; would require touching pinned composer/submit surfaces). A follow-up card could map the `submit-argument` rejection code through `gameCopy.toPlainLanguage` at a non-pinned seam.
- **Verdict / summary / "who won" generation on settle** — forbidden by doctrine; explicitly not built.
- **Moderator bulk settle tooling**, admin settle from the gallery/list, notifications on settle (no QOL-040-style dispatch — a status change has no notification requirement).
- **A settled chip on the `ArgumentStateRail`** — the rail is a "writes-nothing" presentational model; a settled indicator chip is a nice-to-have deferred (the header status chip already reads "LOCKED" on tablet/wide, and the settled notice is the primary read-only cue). If desired later, it is an additive `StateRailChipKind` in a separate card.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth/verdict labels):** Settling is a lifecycle state (`open→locked`), never a verdict. Copy avoids winner/loser/decided/final/correct/verdict/score (enforced by two ban-list tests). No standing/score effect — the engine (`src/domain/constitution/engine.ts`) and `src/features/pointStanding/antiAmplification.ts` are not imported or touched.
- **cdiscourse-doctrine §1 (score never blocks posting):** Unchanged — posting is gated by validation + `status` (a lifecycle gate that already exists in `submit-argument`), never by score. This card adds no score gate.
- **cdiscourse-doctrine §6/§7 (secrets / no service-role / no AI):** The write is a client anon-key RLS-gated `UPDATE`. No service-role, no Edge, no Anthropic/xAI/X call, no `.env` touched. `grep SERVICE_ROLE|ANTHROPIC_API_KEY src/` stays zero.
- **cdiscourse-doctrine §8 (RLS/migrations):** No migration; no RLS disabled; the existing creator-or-mod UPDATE policy is the authoritative gate; the client UI adds a creator-only narrowing on top (defence in depth, never a replacement).
- **cdiscourse-doctrine §9 (plain language):** No internal code reaches the UI; every user-facing string lives in `ROOM_SETTLE_COPY`; reason codes map to plain language (unknown codes suppressed by the confirm/notice which only render known effect codes).
- **cdiscourse-doctrine §10 (v1 scope):** No voting/winner, no realtime edit, no OAuth/search/push/public-API. Settle is a lifecycle control, not a scoring system.
- **accessibility-targets:** Confirm modal + notice reuse the 44px-target Pressable pattern with `accessibilityRole`/`accessibilityLabel`/`accessibilityState`; the modal is `role="alert"`; motion respects `reduceMotion` (`animationType='none'`, sourced from `src/features/preferences/useReduceMotion.ts` — reuse, never re-inline); no animation is essential (calm affordance, no scale/gradient).
- **expo-rn-patterns:** RN primitives only (`View`/`Text`/`Pressable`/`Modal`); no new dependency; model file is pure TS; new surfaces plug into the existing `DebateDetailHeader` overflow + `App.tsx` mount rather than duplicating room chrome.
- **test-discipline:** Tests are part of this card (models 100%, ban-list with firing control, actor matrix, api call-shape, component a11y). Count goes up.

---

## Operator steps (if any)

**None beyond the standard client publish.** No DB migration (`npx supabase db push`), no Edge deploy, no new env var, no service-role. The change is pure client code that reaches production via the normal `netlify-prod` web publish that any merged client change rides (strict fast-forward push + deployed-bundle-hash poll + a Sign-In smoke), per the repo's committed-bundle deploy model.

**Reconciliation point for the operator — flag posture (designer recommendation: unflagged QOL):**

| Option | Verdict | Why |
|---|---|---|
| **Unflagged QOL** | **Recommended** | Completes an already-live feature's loop (`quote_forge`'s pool is empty without a producer). Sibling room-management controls (make-private, invite, the QOL-042 weave trigger) all shipped **unflagged** — none is an ASP flag. The control is creator-only, confirm-gated, and reversible → minimal blast radius. No new `EXPO_PUBLIC_*` var, no `featureFlagsStaticEnv` static-read guard entry, no two-site env flip, no bundle-poll gate. |
| Ride an existing live flag (e.g. `quote_forge`) | Not recommended | Backwards coupling: settle is the **producer**, `quote_forge` the **consumer**. Gating the producer on the consumer's flag means turning `quote_forge` off would also strip hosts of the ability to settle rooms at all. Settle is independently useful (a lifecycle read-only control). |
| New 12th ASP flag | Not recommended | Adds real operator friction (new env var on dev + netlify-prod, `featureFlagsStaticEnv` static-read addition, bundle-hash poll, a new smoke gate) for a host-only, reversible, confirm-guarded control. There is no cohort machinery to justify a staged ramp. |

Because the recommended posture is **unflagged**, merging makes the affordance live on the next `netlify-prod` publish — this card is the **first client lane to write `status='locked'`**. The operator should confirm they want settle live-on-merge (vs. a one-flag ramp) before the implementer merges. This is the single decision to ratify; everything else is determined by the existing RLS/trigger/pin facts documented above.
