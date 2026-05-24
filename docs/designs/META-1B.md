# META-1B — Realtime multi-user manual-tag sync

**Status:** Design draft
**Epic:** Rules UX / Metadata (Release 6.6 family — Timeline Tree Game Board; META card line)
**Release:** 6.8 (v2 boundary; operator-approved for implementation)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/77

---

## 0. Card-vs-reality discrepancies (read first)

| # | Card / launch prompt says | Reality | Resolution |
|---|---|---|---|
| 0.1 | Issue body footer: "## Do not implement yet — Blocked by META-1A" | META-1A (#76) **shipped** at commit `f59c126` (PR #134) on 2026-05-19; design + review docs are both present (`docs/designs/META-1A.md`, `docs/reviews/META-1A.md`). The persisted ledger, Edge Function, mirror, client wrapper, and read-path hydration are all live in `main`. The operator has authorized META-1B. | Treat META-1A as a fully-available stable read-only dependency. The implementer corrects the stale issue-body footer as a side-task before opening the META-1B PR (one line edit). |
| 0.2 | Launch prompt: "META-001 = #62 (PR #70 `b22f4ef`); META-1A = #76 (shipped); META-1B = #77" | All correct. The earlier issue-number confusion has been resolved upstream. | None — the prompt's correction map is authoritative. |
| 0.3 | Card scope: "Supabase Realtime subscription on `point_tags` table scoped to the open debate" | There is **no existing realtime subscription anywhere in `src/`**. The pre-implementer survey found a single `subscription.unsubscribe()` reference in `authApi.ts` + `AppSessionProvider.tsx`; both are `auth.onAuthStateChange` handles, not realtime channels. There is **zero** prior usage of `supabase.channel(...)`, `removeChannel`, `postgres_changes`, or `RealtimeChannel` in the production app. The `useNotifications.ts` comment explicitly notes "no realtime subscription in v1 — design §17". | META-1B is the first card to introduce a Supabase Realtime postgres-changes subscription in the production app. It must therefore establish the patterns the repo will reuse: channel naming, JWT-only auth (no service-role), teardown on unmount, reconcile on `SUBSCRIBED`/reconnect, echo suppression. See §5 for the canonical shape. |
| 0.4 | Card scope: "merges incoming tag changes into the local `MoveMetadataLedger`" | The room shell does not call `applyManualTag`/`removeManualTag` from `moveMetadataLedger.ts` on the in-memory ledger directly. It rebuilds the ledger from the loader's `pointTagsByArgumentId` map via `buildMoveMetadataLedger({ manualTagsByMessageId: persistedTagsToManualTagEntries(allRows) })` in `ArgumentGameSurface.tsx` (lines 399–426). | "Merge into local ledger" really means "update `pointTagsByArgumentId` in the loader hook's state, which feeds the existing `useMemo` that hydrates the ledger." No call into `moveMetadataLedger.applyManualTag` is needed — that path is for in-memory test-only scenarios. The realtime delta updates the loader state; the existing memo does the rest. |
| 0.5 | Card scope: "Reconcile-on-reconnect strategy for stale state after a network blip" | The loader already has a `refresh()` that re-runs `listArgumentsForDebate` + `fetchArgumentRelations`. That is a full-room refresh — heavy and not specific to `point_tags`. | Add a **scoped reconcile**: when the channel re-subscribes (initial `SUBSCRIBED` or reconnect after `CLOSED`/`CHANNEL_ERROR`), the implementer reads the current set of `argumentId`s from the loader, calls a new scoped helper `fetchPointTagsForArguments(ids)` exported from `argumentsApi.ts` (or co-located in `pointTagsApi.ts` — designer's preference per §5.3), and replaces `pointTagsByArgumentId` for those ids. Falls back to `refresh()` if the scoped fetch fails. |
| 0.6 | Acceptance criterion 3: "Network blip → reconnect reconciles to server state without losing local optimistic tags that hadn't yet committed" | META-001's *in-memory* `applyManualTag` is gated behind the Edge Function in META-1A; the room shell does not optimistically pre-write into `pointTagsByArgumentId`. (`handleApplyManualTag` in `ArgumentGameSurface.tsx` lines 672–696 calls the Edge Function and then `_onRefresh`.) There is no "optimistic uncommitted tag" sitting in the persisted-tag map. The optimistic UI the card refers to is META-001's *in-memory* `ManualTagEntry[]` ledger, which never lived in `point_tags`. | Reconcile cannot lose optimistic tags because optimistic tags do not live in the persisted-tag map. The reconcile only touches `pointTagsByArgumentId`; the in-memory ledger surface (if a future control re-introduces optimistic apply) remains untouched. The acceptance-criterion guard becomes: "reconcile does NOT clear the in-memory ledger's pending entries; reconcile replaces only `pointTagsByArgumentId`." See §7. |

None of these block the card. They are scoping corrections the implementer must apply.

---

## 1. Goal & scope

META-1A persisted the manual-tag vocabulary so two users who reload see the same set of tags. META-1B turns that persisted state into a **live signal**: when participant A applies `needs_source` on a move, participant B — already in the same room — sees the tag appear within ~1 s, without a refresh, **without polling**, and without trusting any client-side authority.

**In scope:**
- One Supabase Realtime `postgres_changes` subscription per open argument room, filtered by `debate_id`, listening to INSERT + UPDATE on `public.point_tags`.
- A pure-TS reducer that merges a realtime payload into the loader's `pointTagsByArgumentId` map.
- A scoped reconcile helper that re-fetches the active set of point-tags for the room's argument ids on `SUBSCRIBED` / reconnect.
- Echo suppression by row id (track recently-applied / recently-removed ids locally; ignore matching inbound events).
- Subscription teardown on room exit / unmount.
- A silent visual merge (the tag just appears, matching META-001's render path) **plus** an `AccessibilityInfo.announceForAccessibility` plain-language announcement for screen-reader users.

**Out of scope:**
- Push notifications (v1 scope ban).
- Realtime collaborative editing of argument bodies.
- Realtime on any other table (`arguments`, `flags`, `argument_tags`, `topic_satisfaction_checks`, `debate_participants`, etc.).
- Server-side broadcast filtering / row-level realtime authorization tuning (RLS-natural inheritance is sufficient — see §9).
- New write paths (the Edge Function from META-1A remains the only writer).
- Presence ("X is viewing this room") — explicitly not requested by the card and not required for the four acceptance criteria.
- Optimistic UI for tag application — the issue body explicitly defers it ("out: optimistic UI for tag application (already handled by META-001's in-memory layer)"). If a future control re-introduces optimistic apply via META-001's in-memory ledger, the reconcile strategy in §7 already handles it.

---

## 2. Source: issue body + META-1A review

The card text and META-1A's shipped surface are reproduced in §0 references. The four acceptance criteria, verbatim from the issue body:

1. Tag applied by user A appears in user B's room within ~1 s.
2. Tag removed by user A disappears in user B's room within ~1 s.
3. Network blip → reconnect reconciles to server state without losing local optimistic tags that hadn't yet committed.
4. No tag echo loop (own-write doesn't double-apply).

Plus three structural requirements:

- Subscription teardown on room exit; no leaked channels.
- No service-role in client; client uses authed JWT for subscription.
- All META-001 doctrine still applies.

META-1A's shipped surface this card builds on (canonical contract — do not modify):

- `src/features/metadata/pointTagsApi.ts`: `PersistedPointTag` interface, `applyManualTag` / `removeManualTag` wrappers, `persistedTagsToManualTagEntries` pure adapter.
- `src/features/arguments/useArgumentRoomMessages.ts`: provides `pointTagsByArgumentId: Record<string, PersistedPointTag[]>` (lines 32–34, 62, 102–117, 146).
- `src/features/arguments/ArgumentGameSurface.tsx`: lines 399–414 hydrate the ledger from `pointTagsByArgumentId`; lines 672–696 expose `handleApplyManualTag` / `handleRemoveManualTag`.
- `supabase/migrations/20260517000009_meta_1a_point_tags.sql`: `point_tags` table with `debate_id` FK, `removed_at` soft-delete column, RLS `pt_select_read_access` that delegates visibility to `public.arguments`.
- `supabase/functions/apply-manual-tag/index.ts`: the only write path; returns `{ argumentId, activeTags }`.

---

## 3. Problem statement

After META-1A shipped, two participants in the same room see the **same persisted set of tags** only at reload boundaries. Between reloads, tag changes by other participants are invisible. This breaks the "live game board" gameplay model the META card line is building toward: the doctrine that a manual tag is a *participant gameplay signal* depends on being **legible to all participants in real time**, not as a private annotation discovered only on the next reload.

The technical problem decomposes to:

1. **Transport.** Supabase Realtime over Postgres-changes is the obvious channel; we have not used it before, and the patterns we establish here will become the template for future realtime cards. We must do it in a way that respects every doctrine constraint (JWT-only, RLS-honored, no service-role, no AI).
2. **State integration.** The room shell already has a single source of truth for persisted tags (`pointTagsByArgumentId` in the loader hook). The realtime delta must update that map without invalidating META-001's in-memory ledger surface (which a future optimistic-UI control may use).
3. **Loops.** A user who applies a tag triggers an Edge Function INSERT that broadcasts back via the channel. Without suppression, the local optimistic state plus the inbound echo cause a duplicate or a flash. The four-criterion test demands this never happens.
4. **Resilience.** Mobile networks blip. After a blip, the channel may have missed events. We must reconcile without thrashing the room shell.
5. **Visibility safety.** A tag in a private room (QOL-039) must not broadcast to a user who cannot read the parent argument. Realtime row-broadcast respects the postgres-side RLS predicate; we must verify the inherited check is sufficient and document the natural delegation.

---

## 4. Data model + file changes

### Data model

**No schema change.** META-1B is purely additive in the client; no migration is required.

**Important note on Realtime publication:** Supabase Realtime broadcasts changes to a table only when that table is included in the `supabase_realtime` publication. The default Supabase project is configured with `FOR ALL TABLES` so `point_tags` is automatically included. If the operator's project narrowed the publication, they must run `ALTER PUBLICATION supabase_realtime ADD TABLE public.point_tags;` once — but this is operator infrastructure, not a code-bearing migration. See §15 OQ-1.

### New TypeScript types (client)

```ts
/** META-1B — Internal envelope for an inbound point_tags realtime event. */
export interface PointTagRealtimeEvent {
  kind: 'apply' | 'remove';
  row: PersistedPointTag;
}

/** META-1B — Subscription status used by the room shell for diagnostic copy. */
export type PointTagSubscriptionStatus =
  | 'idle'         // before the channel has been requested
  | 'subscribing'  // join in flight
  | 'subscribed'   // channel is live
  | 'reconnecting' // CHANNEL_ERROR / CLOSED → re-subscribe attempt in flight
  | 'failed';      // permanent failure (e.g., RLS denies SELECT on point_tags)
```

These live in a new file (see below); they are not added to `pointTagsApi.ts` to keep that file's surface frozen as META-1A's stable contract.

### New files

- `src/features/metadata/pointTagsRealtime.ts` — pure-TS reducer + helpers (no React, no Supabase imports). **Owns:**
  - `mergeRealtimeEvent(state, event)` — applies one event to a `Record<string, PersistedPointTag[]>` map; idempotent; preserves reference equality when the event is a no-op (e.g., apply of a row whose id is already present, or remove of a row not present in active state).
  - `mapPointTagsRealtimeRow(raw)` — converts a raw Supabase realtime payload row (snake_case) to `PersistedPointTag` (camelCase); shared with the scoped reconcile fetcher.
  - `shouldSuppressEcho(eventRowId, recentLocalIds)` — pure predicate.
  - `pruneExpiredLocalIds(map, nowMs, ttlMs)` — drops echo-tracker entries older than `ttlMs` (default 60_000 ms).
  - **~180 lines.**

- `src/features/metadata/usePointTagsRealtime.ts` — React hook that owns the channel lifecycle. **Owns:**
  - Channel creation: `supabase.channel(\`point_tags:debate:${debateId}\`)` with `{ config: { private: false } }`.
  - Filter: `{ event: '*', schema: 'public', table: 'point_tags', filter: \`debate_id=eq.${debateId}\` }`.
  - `INSERT` handler → `mergeRealtimeEvent(state, { kind: 'apply', row })` (after echo check).
  - `UPDATE` handler → if `removed_at != null`, treat as `{ kind: 'remove', row }`; otherwise treat as `{ kind: 'apply', row }` (cover the legacy case of a re-applied row via UPDATE — see §10.6).
  - `subscribe(status, err)` callback handles `SUBSCRIBED` (run reconcile), `CHANNEL_ERROR` / `CLOSED` (set `reconnecting`, schedule a reconnect with exponential backoff capped at 30 s), `TIMED_OUT` (one immediate retry).
  - Teardown: `supabase.removeChannel(channel)` on unmount AND on debateId change. Stores the channel reference in a `useRef` to avoid re-subscribing on re-render.
  - Returns `{ status, recentlyAppliedIds, recentlyRemovedIds, markLocalApply(rowId), markLocalRemove(rowId), reconcileNow() }`.
  - **~280 lines.**

- `src/features/arguments/fetchPointTagsForArguments.ts` — scoped reconcile fetcher (or co-located in `argumentsApi.ts` — see §5.3 decision below). **Owns:**
  - `fetchPointTagsForArguments(argumentIds: string[]): Promise<{ ok: true; data: PersistedPointTag[] } | { ok: false; error: string }>`.
  - Single `.from('point_tags').select(...).in('argument_id', ids).is('removed_at', null)` query.
  - **Decision:** put it in `argumentsApi.ts` next to the existing point-tags select in `fetchArgumentRelations`, exported as `fetchPointTagsForArguments`. This keeps the read-side surface unified and avoids a new module for a single function. The "new file" entry above is rewritten to "modified `argumentsApi.ts`."
  - **~40 lines added to existing file.**

- `__tests__/pointTagsRealtimeMerge.test.ts` — pure unit tests for the reducer + helpers. **~220 lines.**
- `__tests__/usePointTagsRealtime.test.ts` — hook tests with a mocked `supabase.channel(...)`. **~340 lines.**
- `__tests__/pointTagsRealtimeEcho.test.ts` — focused echo-suppression regression suite. **~180 lines.**
- `__tests__/pointTagsRealtimeReconcile.test.ts` — focused reconcile-on-reconnect suite + visibility-RLS isolation test (mocked). **~190 lines.**

### Modified files

- `src/features/arguments/argumentsApi.ts` — add `fetchPointTagsForArguments(argumentIds: string[])` + a shared `mapPointTagRow(raw)` helper that **both** `fetchArgumentRelations` and `fetchPointTagsForArguments` reuse (avoid duplication). The existing in-line mapping inside `fetchArgumentRelations` is refactored to call `mapPointTagRow`. **~+55 / -8 lines.**
- `src/features/arguments/useArgumentRoomMessages.ts` — integrate the hook. **One** of two integration shapes; the implementer chooses based on the simplest minimal-blast-radius result:
  - **Option A (preferred):** add an optional second parameter `{ enableRealtime?: boolean }` that defaults to `true`. The hook internally calls `usePointTagsRealtime(debateId, { onMergeEvent: (event) => setPointTags(updater) })`. `setPointTags` accepts a functional updater that calls `mergeRealtimeEvent(prev, event)`.
  - **Option B:** keep `useArgumentRoomMessages` realtime-agnostic; have `ArgumentGameSurface.tsx` wrap the room messages with `usePointTagsRealtime` and merge into its own derived state. Adds a second source of truth — rejected.
  - **Decision:** **Option A.** Realtime is part of "the room's view of point-tags," so it belongs in the loader that owns `pointTagsByArgumentId`. Option A also keeps `ArgumentGameSurface.tsx` reading from one map, which preserves the META-1A read-path memo's stable input.
  - **~+45 lines.**
- `src/features/arguments/ArgumentGameSurface.tsx` — minimal touch. Add the `AccessibilityInfo.announceForAccessibility` call when `pointTagsByArgumentId` grows or shrinks (a new effect that diffs current vs prior persisted-tag counts per argument and announces a plain-language line for the *latest* change). **No** modification to the existing memo at lines 399–426 (it transparently picks up the new map). **No** modification to `handleApplyManualTag` / `handleRemoveManualTag` (those are write paths; the hook's `markLocalApply` is called from the loader's `setPointTags` updater on the local write path — see §8).
  - **Trade-off note:** the announcement effect introduces a `useEffect` that depends on `pointTagsByArgumentId`. To keep memo stability for the META-001 ledger build, it compares prev/current via a stable diff helper (`diffPointTagSets`) and announces only when the active-tag *set* (not the array order) changes. Tests cover the no-op render case.
  - **~+38 lines.**
- `src/features/arguments/types.ts` — re-export `PointTagSubscriptionStatus` and `PointTagRealtimeEvent` from `pointTagsRealtime.ts` if and only if `ArgumentRoomMessagesResult` exposes the status. The status surfaces a small "Live updates: paused" / "Live updates: on" diagnostic (optional, see §6). **~+3 lines.**
- `docs/core/current-status.md` — bump test count after `npm run test`; add a META-1B note.
- `CLAUDE.md` — bump the "Current stage" line on stage completion (per repo convention).

**Total file footprint:** 3 new files (1 model, 1 hook, plus 4 test suites) + 4 modified files. No migration, no Edge Function change, no schema change.

### Deleted files

None.

---

## 5. Channel architecture (Q1)

### 5.1 Q1 verdict: PASS

The pre-implementer survey is confirmed: `src/` contains zero `channel(`, `subscribe(`, `removeChannel`, `postgres_changes`, or `RealtimeChannel` references. The two `subscription.unsubscribe()` hits in `authApi.ts` + `AppSessionProvider.tsx` are `auth.onAuthStateChange` handles. META-1B is the first card to introduce a Supabase Realtime postgres-changes subscription in the production app.

### 5.2 Canonical shape

```ts
// usePointTagsRealtime.ts — sketch
import { supabase } from '../../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function usePointTagsRealtime(
  debateId: string,
  options: { onMergeEvent: (event: PointTagRealtimeEvent) => void; onReconcileNeeded: () => Promise<void> }
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [status, setStatus] = useState<PointTagSubscriptionStatus>('idle');
  // … recentlyAppliedIds / recentlyRemovedIds Maps with TTL …

  useEffect(() => {
    if (!debateId) return;
    setStatus('subscribing');

    const channel = supabase
      .channel(`point_tags:debate:${debateId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'point_tags', filter: `debate_id=eq.${debateId}` },
        (payload) => handleInsert(payload.new),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'point_tags', filter: `debate_id=eq.${debateId}` },
        (payload) => handleUpdate(payload.new),
      )
      .subscribe(async (subStatus, err) => {
        if (subStatus === 'SUBSCRIBED') {
          setStatus('subscribed');
          await options.onReconcileNeeded();   // initial reconcile
        } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'CLOSED') {
          setStatus('reconnecting');
          scheduleReconnect();                  // exponential backoff, capped at 30 s
        } else if (subStatus === 'TIMED_OUT') {
          // one immediate retry, then back off
        }
        if (err) logRealtimeError(err);         // never logs payload bodies
      });

    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);     // hard teardown
      channelRef.current = null;
      setStatus('idle');
    };
  }, [debateId, options.onMergeEvent, options.onReconcileNeeded]);

  // … echo-suppression helpers …
}
```

### 5.3 Topic naming

`point_tags:debate:${debateId}`. One channel per room. The topic prefix `point_tags:` namespaces this card so future META-1C / observer-presence work does not collide.

### 5.4 Authentication

The shared `supabase` client (`src/lib/supabase.ts`) is created with the publishable anon key plus the authed JWT from `AsyncStorage`-backed sessions (`persistSession: true`, `autoRefreshToken: true`). Realtime inherits the same auth context automatically — no token is passed explicitly. **No service-role key is touched.** When the auth session refreshes, `supabase-js` re-authenticates the realtime socket transparently.

If the user signs out while a channel is open, the channel's auth will be downgraded to anon; for `point_tags` (RLS-gated by `arguments` SELECT visibility) this typically means the user can still read public-room rows but loses access to private-room rows. Since `useArgumentRoomMessages` unmounts on sign-out, the channel is torn down before the auth downgrade matters in practice.

### 5.5 Filter

`filter: \`debate_id=eq.${debateId}\`` is a server-side row filter. Combined with the table's RLS `pt_select_read_access` (delegates to `arguments` visibility), Realtime broadcasts a row to a subscriber **only if** the row's `debate_id` matches the filter **and** the subscriber's JWT can SELECT the row. This satisfies the QOL-039 visibility constraint without any extra client-side check (see §9).

### 5.6 Teardown

- On unmount: `supabase.removeChannel(channel)`.
- On `debateId` change: the effect cleanup runs, removing the prior channel before subscribing to the new room.
- On sign-out: `useArgumentRoomMessages` is unmounted by its consuming screen, which triggers teardown.

The hook stores the channel in a `useRef` so that even if React strict-mode double-invokes the effect, the second invocation does not leak a second channel. The cleanup function uses the ref + a local variable for the channel binding to avoid the classic "captured-stale-channel" leak.

### 5.7 Backoff

- `CHANNEL_ERROR` / `CLOSED` → schedule a re-subscribe via `setTimeout(reconnect, backoffMs)`.
- `backoffMs = Math.min(30_000, 1_000 * 2 ** attempt)` with `attempt` reset on a successful `SUBSCRIBED`.
- Maximum 6 attempts before staying in `failed` until the user retries (manual `reconcileNow()` or unmount/remount).
- `TIMED_OUT` triggers one immediate retry (not counted toward `attempt`).

### 5.8 Logging

`logRealtimeError(err)` emits a structured log with the topic name, the status, and `err.message` if present. **Never logs payload bodies, never logs the auth header, never logs row content** — only error metadata. Reuses the existing structured-logger utility convention (search `src/lib/` for the logger; if none exists, fall back to `console.warn` with no payload — but check first since CLAUDE.md §"TypeScript conventions" bans `console.log` in committed code).

---

## 6. UI indicator (Q2)

### 6.1 Q2 verdict: PASS (silent visual + screen-reader announcement)

The card / issue body explicitly frames the design as "merge into the local `MoveMetadataLedger`" — there is **no UI affordance** for "a tag appeared because someone else applied it." The tag simply appears. This is the lightest-weight option, the closest to a chat client's bubble-appearance pattern, and the most consistent with META-001's render path (the ledger does not annotate per-source-of-event in any user-facing surface).

But silent-visual is insufficient for users on screen readers — the tag appears on the screen but is never announced. Per the `accessibility-targets` skill, we must announce it via `AccessibilityInfo.announceForAccessibility`. This matches the pattern in `src/features/refereeBanners/RefereeBannerView.tsx` (line 95) and `src/features/arguments/ArgumentTimelineMap.tsx` (line 591).

### 6.2 Visual: silent

When `pointTagsByArgumentId` changes (because the realtime hook merged an event), the existing `useMemo` at `ArgumentGameSurface.tsx:399–414` re-runs, the metadata ledger rebuilds, and any tag-rendering surface (currently transitive via the ledger; will become more visible as SC-004 / TimelineNodeActionDock lands the user-facing tag chip control) updates. **No toast. No animation. No banner.** Doctrine-clean: no verdict, no ranking, no person attribution.

If a future card wants a subtle "new" pulse on the bubble whose tag changed, that is a separate card (file a follow-up — META-1B does not implement it). Including a flash here would create a UI affordance that has no doctrine-clean meaning in the absence of a "first appearance" anchor — the same tag may have existed for days but only just arrived in this client's session.

### 6.3 Screen-reader: plain-language announcement

```ts
// In ArgumentGameSurface.tsx — sketch
useEffect(() => {
  const diff = diffPointTagSets(prevPointTagsByArgumentId, pointTagsByArgumentId);
  if (diff.added.length === 0 && diff.removed.length === 0) return;
  // Announce the LATEST single change (deterministic by createdAt desc).
  const latest = pickLatestChange(diff);
  if (!latest) return;
  const label = getManualTagPlainLabel(latest.tagCode);    // META-001 plain-language helper
  const message = latest.kind === 'apply'
    ? ROOM_REALTIME_COPY.tagAppliedAnnouncement(label)     // "A '<label>' tag was added to a move."
    : ROOM_REALTIME_COPY.tagRemovedAnnouncement(label);    // "A '<label>' tag was removed from a move."
  try { AccessibilityInfo.announceForAccessibility(message); } catch { /* never throws to user */ }
}, [pointTagsByArgumentId]);
```

The strings live in a small new `ROOM_REALTIME_COPY` block added to `src/features/arguments/gameCopy.ts` (the canonical copy block), **not inlined**. The plain-language label comes from META-001's `getManualTagPlainLabel`. **No tagger identity** in the announcement — never "Alice added a tag" (PII + doctrine). **No verdict, no winner/loser, no "trending" language.**

### 6.4 Optional subscription-status diagnostic

The hook exposes `status: PointTagSubscriptionStatus`. The room shell **may** surface a tiny diagnostic chip ("Live updates: on" / "Live updates: paused — reconnecting") when status flips to `reconnecting` or `failed`. **Implementer's call**: if the existing room shell has no obvious place for a status chip, omit it (the silent fallback to refresh-on-success keeps the room usable). If added, the strings live in `gameCopy.ts` and use plain language. Out-of-band for screen readers — the announcement effect already covers actual deltas.

### 6.5 What the user does NOT see

- No toast.
- No tagger identity ("Someone added…" is also avoided — the announcement is move-anchored, not person-anchored).
- No truth label ("this point is now wrong/right").
- No engagement metric ("3 people tagged this").
- No popularity ranking.
- No flash / animation that suggests a verdict.

---

## 7. Reconcile strategy (Q3)

### 7.1 Q3 verdict: PASS

**Trigger:** the `.subscribe()` callback fires with `SUBSCRIBED` (initial subscription completes) or transitions through `reconnecting → SUBSCRIBED` (after a network blip). On every `SUBSCRIBED`, `onReconcileNeeded()` is called.

**Algorithm:**

1. Read the current argument-id set from the loader: `const argumentIds = Object.keys(pointTagsByArgumentId)` (plus any ids in `messages` that are not yet in the map, for completeness).
2. Call `fetchPointTagsForArguments(argumentIds)` — scoped read, no full-room refresh.
3. On `ok: true`:
   - Group the returned rows by `argumentId`.
   - Replace the per-argument arrays in `pointTagsByArgumentId` via the functional setter: `setPointTags(prev => mergeReconcileResult(prev, grouped, argumentIds))`.
   - `mergeReconcileResult` keeps any in-flight optimistic entries in `prev` that the server result does not yet contain (only relevant if META-1B's downstream wires META-001's in-memory optimistic layer — currently not wired; see §0.6).
   - Echo-suppression trackers (`recentlyAppliedIds`, `recentlyRemovedIds`) are **not** cleared on reconcile — they continue to suppress the inbound echo of the reconcile-result row that the local user themself applied just before the blip. (Their TTL is 60 s; after that they auto-expire.)
4. On `ok: false`:
   - Fallback to the loader's existing `refresh()` (full room reload). This is the safety net for the (rare) case where the scoped fetch fails.

**Why scoped reconcile and not full-room refresh:** the full-room refresh re-fetches messages + tags + flags + checks + topic-satisfaction-checks. On a 200-message room with a brief blip, that is an unnecessary blast radius — the scoped reconcile touches only `point_tags`. The fallback is still there.

**Why no incremental "diff replay":** Supabase Realtime does not provide a "missed events since timestamp T" replay API. The scoped re-fetch is the canonical way to converge after a missed-events window.

### 7.2 What survives reconcile

- **In-flight optimistic tags (if any future control adds them via META-001's `applyManualTag` in-memory function):** preserved. The reconcile only touches `pointTagsByArgumentId`. META-001's in-memory ledger entries that have not yet been persisted are stored separately (they are not in `pointTagsByArgumentId`). The implementer must not call any function that clears the in-memory ledger as part of reconcile.
- **Echo-tracker entries:** preserved (TTL-based expiration only).
- **The realtime channel itself:** preserved on reconnect; only torn down on unmount or `debateId` change.
- **Other loader state (messages, tags, flags, checks):** untouched.

### 7.3 What does NOT survive reconcile

- Server-removed rows: any row that was active locally but `removed_at IS NOT NULL` on the server (or absent from the scoped fetch's `.is('removed_at', null)` result) is dropped from the local map.
- Local rows for arguments not in `argumentIds` are not touched (those arguments are not loaded in this room).

### 7.4 Edge case: empty argument list

If `argumentIds` is empty (room with zero messages), the scoped fetch is skipped and `pointTagsByArgumentId` is set to `{}`. `mergeReconcileResult` handles this trivially.

### 7.5 Edge case: SUBSCRIBED fires before initial load

If the channel subscribes before the loader's initial fetch completes (rare timing — the hook is mounted at the same time as the loader effect), the first `onReconcileNeeded` may see an empty `argumentIds`. That is benign: the loader's initial fetch will populate `pointTagsByArgumentId` from `fetchArgumentRelations`, and any subsequent realtime event will merge in normally. The reconcile may also fire again on the next reconnect.

---

## 8. Echo suppression (Q4)

### 8.1 Q4 verdict: PASS

**Mechanism: ID-keyed local-write tracking with TTL.**

The Edge Function's response (`{ argumentId, activeTags: [{ id, tagCode, taggedBy, createdAt }, ...] }`) includes the **row id** of every active tag on the argument, including the just-applied / just-removed one. The client wrapper already exposes this in the success result. META-1B uses it to track which row ids were *just touched locally* and suppresses inbound realtime events whose row id matches.

### 8.2 Tracking

The hook exposes:

```ts
markLocalApply(rowId: string): void;   // call after a successful Edge Function apply that produced rowId
markLocalRemove(rowId: string): void;  // call after a successful Edge Function remove of rowId
```

Internally these maintain two `Map<string, number>` with `rowId → expirationMs`. Default TTL: **60 seconds** (a wide-enough margin to cover realtime latency on poor networks; narrow enough that a long-running session does not accumulate stale entries).

### 8.3 Wiring at the call sites

`ArgumentGameSurface.tsx`'s `handleApplyManualTag` / `handleRemoveManualTag` currently invoke the Edge Function and refresh. META-1B extends them:

```ts
// Sketch — inside handleApplyManualTag
const result = await applyManualTag({ debateId, argumentId, tagCode });
if (result.ok) {
  // Mark every active tag row that may echo back to us.
  // The just-applied row is identifiable because (taggedBy === callerId && tagCode === <ours>).
  const ownNew = result.data.activeTags.find(
    (t) => t.taggedBy === currentUserId && t.tagCode === tagCode
  );
  if (ownNew) realtimeMarkers.markLocalApply(ownNew.id);
  _onRefresh();
}
```

For removes, the Edge Function does not return the row id of the soft-deleted row in `activeTags` (since it's no longer active). The hook handles this by exposing `markLocalRemoveByPredicate({ argumentId, tagCode, taggedByUserId })` which suppresses the *next* matching UPDATE event within the TTL window. Pattern is uglier but unavoidable for removes; the predicate matches at most one row.

**Decision:** the implementer adds a `markLocalRemoveByPredicate` to `usePointTagsRealtime.ts` exactly because the remove flow cannot otherwise know the row id. The predicate is consumed once and discarded.

### 8.4 Suppression check

Inside `handleInsert(rawRow)`:

```ts
const row = mapPointTagsRealtimeRow(rawRow);
if (recentlyAppliedIds.has(row.id)) {
  recentlyAppliedIds.delete(row.id);  // one-shot consumption
  return;                              // suppress; local state already has it
}
onMergeEvent({ kind: 'apply', row });
```

Inside `handleUpdate(rawRow)` (only UPDATEs with `removed_at != null` flow as removes):

```ts
const row = mapPointTagsRealtimeRow(rawRow);
if (row.removedAt != null) {
  // Remove flow.
  if (recentlyRemovedIds.has(row.id) || matchesRemovePredicate(row)) {
    return;                            // suppress
  }
  onMergeEvent({ kind: 'remove', row });
} else {
  // Rare: UPDATE that does not set removed_at (e.g., a future admin tool edits something).
  // Treat as apply / reapply.
  if (recentlyAppliedIds.has(row.id)) {
    recentlyAppliedIds.delete(row.id);
    return;
  }
  onMergeEvent({ kind: 'apply', row });
}
```

### 8.5 What echo suppression does NOT cover

- **Two tabs same user.** A user opens the room in two tabs (web). Tab A applies a tag; tab B's realtime channel fires INSERT for the same row id, but tab B has not seen any local apply, so it does NOT suppress. **Correct behavior:** the tag appears in tab B. This is not a loop; it is the multi-tab single-user case (see §10.5).
- **Two users same room.** User A applies; user B's channel fires INSERT; user B has not marked anything locally; row appears. Correct.
- **Multiple participants applying the same tag code on the same move.** Different row ids; both flow through normally; both are visible to all participants. The unique partial index on `(argument_id, tag_code, tagged_by) WHERE removed_at IS NULL` prevents duplicates *from the same tagger*, not from different taggers.
- **Long-deferred reconcile after TTL expiry.** If a user applies a tag, goes offline for > 60 s, and reconnects, the echo tracker has expired; the reconcile-on-reconnect would re-fetch the row, see it is already present (it was inserted into local state by the optimistic apply), and `mergeReconcileResult` would idempotently keep it. No duplication.

### 8.6 Regression test

`__tests__/pointTagsRealtimeEcho.test.ts` covers:

1. Apply own tag → Edge Function returns row id X → channel fires INSERT for row X → state changes exactly once.
2. Remove own tag → channel fires UPDATE with `removed_at != null` for row Y → state changes exactly once.
3. Two participants apply different tag codes → two INSERTs → state shows both.
4. TTL expiry: row id added at t0, INSERT at t1 = t0 + 61_000 → state is updated (no suppression) — but in this case the local optimistic state already contains the row, so `mergeRealtimeEvent` is a no-op (idempotency by row id).

---

## 9. QOL-039 visibility compatibility

### 9.1 RLS-natural inheritance

The `point_tags` SELECT RLS policy (`pt_select_read_access`, migration `…0009`, line 89) is:

```sql
create policy pt_select_read_access
  on public.point_tags
  for select
  using (
    exists (
      select 1 from public.arguments a
      where a.id = argument_id
    )
  );
```

This delegates the visibility check to `public.arguments`'s own RLS. The `arguments` SELECT policy in turn delegates to `public.debates` visibility (via the standard repo pattern; reviewed in META-1A and the QOL-039 migration). So:

- **Public room:** any authenticated user can SELECT the room's arguments (RLS permits). They will receive realtime broadcasts for `point_tags` rows in that room.
- **Private room (post-QOL-039 `public→private` transition):** only `debate_participants` rows with matching user ids can SELECT arguments. Realtime broadcasts are therefore delivered only to those subscribers. A user who lost read access at the transition will stop receiving broadcasts the next time their auth context is reevaluated.

### 9.2 Realtime row filtering

Supabase Realtime evaluates the postgres-side RLS predicate **for the subscriber's JWT** when deciding whether to deliver a row. This is the documented behavior for `postgres_changes` filters on RLS-enabled tables (in fact RLS-enabled tables require RLS to be considered to enable realtime). The combination of `filter: debate_id=eq.${debateId}` + the table's RLS gives the right inheritance: a private-room tag broadcast reaches only authorized subscribers.

### 9.3 Edge case: transition mid-session

A user is observing room R as a non-participant; the creator transitions R from public to private. The user's existing realtime subscription on `point_tags:debate:R` may continue to fire briefly until the broker re-evaluates RLS for the subscriber. Three observations:

1. The user's `useArgumentRoomMessages` loader will fail or return empty on the next refresh (RLS denies SELECT on `arguments`). The room shell then surfaces the QOL-039-shipped "you no longer have access" path.
2. Even if a `point_tags` event briefly leaks during the window, the merged event's row id refers to an argument the user can no longer fetch via `fetchPointTagsForArguments` (reconcile returns empty for those ids on the next subscription cycle).
3. The hook is unmounted on navigation away from the room, which removes the channel. So the leak window is bounded.

**No additional code needed.** The QOL-039 transition path is independent of META-1B's realtime layer; META-1B inherits the visibility guarantee via RLS.

### 9.4 Audit

The `apply-manual-tag` Edge Function already writes an `admin_audit_events` row on every apply/remove (META-1A). META-1B does not change audit behavior; realtime deltas are not separately audited (they are projections of the Edge Function writes, which are already audited).

---

## 10. Edge cases

1. **Empty debateId.** Hook does not subscribe; `status` stays `idle`. No channel is created.
2. **debateId changes mid-session (router-driven navigation).** Cleanup runs (`removeChannel`), then the new effect subscribes to the new room. The echo-tracker maps are reset (they belong to the prior session).
3. **Unmount during `subscribing`.** The cleanup function captures the channel via the local variable from the effect closure; `removeChannel` is safe to call on a still-subscribing channel.
4. **Channel-teardown leak (suspected regression).** `useRef` for the channel + cleanup uses the local variable. Test asserts that mounting/unmounting 100 times leaves `supabase.getChannels()` empty. Hook tests with a mocked client count calls to `removeChannel`.
5. **Multiple tabs, same user.** Each tab has its own channel; tag applied in tab A → Edge Function INSERT → both tabs receive the broadcast. Tab A suppresses (own row id is tracked). Tab B does not suppress (it has no local marker). Tab B's state is updated. Result: both tabs converge. This is correct behavior and explicitly NOT a loop. Tested in `usePointTagsRealtime.test.ts`.
6. **Rapid tag toggle.** User applies `needs_source`, then removes it, then re-applies, all within 500 ms. Edge Function serializes: apply (row R1 inserted) → remove (R1 soft-deleted; new row id is the same R1) → apply (insert; partial unique index allows because R1 has `removed_at`; new row R2 inserted). Realtime fires INSERT R1, UPDATE R1 (removed_at set), INSERT R2. Echo suppression handles each in turn. State converges to {R2 active}.
7. **Apply on a soft-deleted argument.** The Edge Function rejects (badRequest `argument_deleted`); no INSERT is broadcast.
8. **Apply that hits the partial unique index (same tagger, same code, same argument, both active).** The Edge Function treats `23505` as idempotent; no new row is created; no INSERT broadcast. The original row was already in local state.
9. **Apply that hits the partial unique index but row was previously soft-deleted.** A new row is inserted; INSERT fires for the new row id; echo-suppression of the local marker handles the local-write case.
10. **Two participants concurrent apply of the same code on the same move.** Two different `tagged_by` values → two different rows → two INSERTs → both visible.
11. **Room-deleted-while-subscribed.** Debates are not hard-deleted (per CLAUDE.md). If the room is archived, the user remains subscribed but receives no new rows (no new writes). Their navigation away unmounts the channel.
12. **Network blip < 1 s.** Channel auto-reconnects through Phoenix transport with no `CLOSED` event; no reconcile needed. No code change required.
13. **Network blip > 1 s.** Channel transitions to `CLOSED` or `CHANNEL_ERROR`; hook schedules reconnect; on `SUBSCRIBED`, reconcile runs and converges state.
14. **Realtime publication missing `point_tags`.** Subscription succeeds but no events arrive. The operator must run `ALTER PUBLICATION supabase_realtime ADD TABLE public.point_tags;` once (see §15 OQ-1). The implementer cannot detect this from the client cleanly; the operator-deploy notes call it out.
15. **RLS denies SELECT on `point_tags` (e.g., misconfigured policy).** Subscribe returns `CHANNEL_ERROR`; the backoff retries up to 6 times and stays in `failed`. The room is still functional via the loader's existing refresh path.
16. **Realtime is disabled at the project level.** Same as #15 from the client's perspective; backoff exhausts; falls back to refresh-on-success. The acceptance criteria become best-effort (~1 s latency degrades to "next refresh").
17. **Auth session expired during subscription.** `supabase-js` auto-refreshes the JWT; the realtime socket re-authenticates transparently. If refresh fails, the user is signed out and `useArgumentRoomMessages` unmounts the hook (teardown is automatic).
18. **Realtime payload missing fields.** `mapPointTagsRealtimeRow` validates that `id`, `debate_id`, `argument_id`, `tag_code`, `tagged_by`, `created_at` are present strings; missing fields → log + drop the event. Never throws.
19. **Doctrine edge — does heat / popularity influence the realtime path?** No. The broadcast is by row id and `debate_id` only. There is no engagement counter, no score, no popularity-aware rate limit, no AI filtering. Wrong-but-loud and right-but-quiet tags produce identical realtime traffic when the same write happens.
20. **Doctrine edge — does the announcement reveal tagger identity?** No. `getManualTagPlainLabel` returns the code's plain-language label only; the announcement string template has no slot for `taggedBy`. Tests assert no PII slot exists in any `ROOM_REALTIME_COPY` string.

---

## 11. Test plan

The test files live under `__tests__/`. Each suite uses the Jest convention already established by `pointTagsApi.test.ts` (`jest.mock('../src/lib/supabase', () => …)`).

### 11.1 `__tests__/pointTagsRealtimeMerge.test.ts` (~220 lines, pure unit)

- `mergeRealtimeEvent` apply: row added to empty map.
- `mergeRealtimeEvent` apply: row added to existing argument array.
- `mergeRealtimeEvent` apply: same row id present already → returns reference-equal state (idempotency).
- `mergeRealtimeEvent` remove: row removed from existing array.
- `mergeRealtimeEvent` remove: row not present → returns reference-equal state.
- `mergeRealtimeEvent` remove: argument array becomes empty → key removed from map (not left as `[]`).
- `mapPointTagsRealtimeRow`: snake_case → camelCase, including `removed_at: null` and `removed_at: '2026-...'`.
- `mapPointTagsRealtimeRow`: missing required field → returns null; caller drops the event.
- `pruneExpiredLocalIds`: expired entries removed; in-window entries preserved.
- Doctrine ban-list scan: source file contains no verdict / amplification / engagement tokens (reuses META-001's `_forbiddenMetadataTokens()`).

### 11.2 `__tests__/usePointTagsRealtime.test.ts` (~340 lines, mocked client)

- Mounts the hook with a mocked `supabase.channel(...)` that returns a stub channel with `on`, `subscribe`, and tracks state transitions.
- On mount: `channel('point_tags:debate:abc')` called; `.on('postgres_changes', { event: 'INSERT', ... filter: 'debate_id=eq.abc' }, fn)` called; `.on('postgres_changes', { event: 'UPDATE', ... filter }, fn)` called; `.subscribe(fn)` called.
- On `SUBSCRIBED`: `status` is `subscribed`; `onReconcileNeeded` is called once.
- On `CHANNEL_ERROR`: `status` is `reconnecting`; backoff scheduled.
- On `CLOSED`: same as CHANNEL_ERROR.
- On unmount: `supabase.removeChannel(channel)` called exactly once.
- On `debateId` change: previous channel removed; new channel created with new filter.
- Strict-mode double-mount: only one channel survives, exactly one `removeChannel` per teardown.
- 100x mount/unmount loop: `removeChannel` call count matches; no leaked channels.
- Error path: `subscribe(cb, err)` invoked with `err` → log called; payload bodies not in log args.

### 11.3 `__tests__/pointTagsRealtimeEcho.test.ts` (~180 lines, focused regression)

- Apply own tag: `markLocalApply(rowId)` registered → channel fires INSERT for `rowId` → `onMergeEvent` NOT called.
- Two consecutive INSERTs for different row ids → both flow through.
- Apply other's tag (no marker registered): INSERT → `onMergeEvent` called.
- Remove own tag with `markLocalRemoveByPredicate`: UPDATE with removed_at → `onMergeEvent` NOT called; predicate is consumed (a second UPDATE matching the same predicate WOULD flow through).
- TTL expiry: `markLocalApply` at t0; advance fake timers to t0 + 60_001 ms; INSERT at that time → `onMergeEvent` IS called (suppression expired); but state-level idempotency still keeps the local state correct.

### 11.4 `__tests__/pointTagsRealtimeReconcile.test.ts` (~190 lines)

- On `SUBSCRIBED`: `fetchPointTagsForArguments(currentArgumentIds)` called.
- Reconcile result includes a row not in local state → row added.
- Reconcile result omits a row in local state (server soft-deleted while we were offline) → row removed.
- Reconcile fails → fallback to `refresh()` is invoked.
- Empty `argumentIds` → fetch skipped; state set to `{}`.
- Reconcile preserves echo-tracker entries (TTL only).
- **QOL-039 visibility isolation** (mocked, RLS not actually exercised): when the test mock's `fetchPointTagsForArguments` returns `ok: false` with `error: 'rls_denied'`, the reconcile falls back to refresh — which in turn surfaces the existing QOL-039 "no access" path. This is a wiring-level test, not an RLS test (RLS is exercised on the operator's live DB; see §"Pre-merge verification limit").

### 11.5 Existing-suite regression

All META-001 + META-1A suites must still pass unchanged:

- `__tests__/pointTagsApi.test.ts` — wrapper + adapter; unaffected.
- `__tests__/applyManualTagEdgeFunction.test.ts` — Edge Function contract; unaffected.
- `__tests__/pointTagsEligibilityMirror.test.ts` — mirror parity; unaffected.
- `__tests__/pointTagsMigration.test.ts` — migration shape; unaffected.
- The metadata ledger suites — ledger build path is unchanged; META-1B only changes the *source* of `pointTagsByArgumentId`.

**Estimated test-count delta:** +~95–115 tests across 4 new suites. The implementer captures the exact count from `npm run test` and updates `docs/core/current-status.md`.

**Pre-merge verification limit:** META-1B's *end-to-end* realtime behavior cannot be verified before merge — it needs a live channel + a deployed Realtime publication. The pre-merge gate is the test suite + `npm run typecheck` + `npm run lint`: the merge reducer is executed in tests, the hook lifecycle is exercised with a mocked client, the echo suppression is regression-tested, and the reconcile fallback is tested. The operator performs a **post-deploy smoke** (see §"Operator steps" implied in the implementer doc — out of scope for the design).

### 11.6 Doctrine ban-list assertions

Every new source file (`pointTagsRealtime.ts`, `usePointTagsRealtime.ts`, the new `argumentsApi.ts` additions, the new `gameCopy.ts` block, and the announcement effect in `ArgumentGameSurface.tsx`) is scanned for verdict / amplification / engagement / person-attribution tokens via META-001's `_forbiddenMetadataTokens()`. Asserted in `pointTagsRealtimeMerge.test.ts` and `usePointTagsRealtime.test.ts`.

---

## 12. Doctrine & safety self-check

**cdiscourse-doctrine:**

- §1 *No truth labels; score never blocks posting.* META-1B broadcasts only `point_tags` rows whose `tag_code` is a META-001 gameplay code. The announcement copy in `ROOM_REALTIME_COPY` uses `getManualTagPlainLabel(code)` exclusively — no verdict prose. Realtime cannot block posting; the `submit-argument` flow is separate. ✓
- §2 *Heat means activity / friction, not correctness.* The realtime channel is by row id and debate id only; no engagement-weighted prioritization, no popularity-aware rate limit. The announcement does not say "trending" or "popular." ✓
- §3 *Popularity is not evidence.* No engagement counter is read by any code path in this card. ✓
- §4 *AI moderator limits.* META-1B makes no AI call. The realtime hook is pure transport + state. ✓
- §5 *Rules engine is sacred.* `src/lib/constitution/engine.ts` is not touched. ✓
- §6 *Secrets policy.* Realtime auth uses the publishable anon key + the authed JWT from the existing client; no service-role key is touched. `pointTagsRealtime.ts` and `usePointTagsRealtime.ts` import nothing from a secret-bearing module. ✓
- §7 *No AI calls from the production app.* None added. ✓
- §8 *Supabase conventions.* No new migration, no new RLS, no new policy. The `point_tags` table's existing RLS does the visibility work. ✓
- §9 *Plain language for users.* All user-facing copy lives in `gameCopy.ts` (`ROOM_REALTIME_COPY`); raw codes never leak; `getManualTagPlainLabel` is used. ✓
- §10 *v1 scope guards.* No voting, no scoring, no push notifications, no OAuth, no public API, no argument search. **No realtime collaborative editing** — META-1B broadcasts tag *applications* only, never edits to argument body. ✓

**supabase-edge-contract:**

- *No service-role in client.* Realtime auth is JWT-only via the shared client. ✓
- *No direct insert/update into `point_tags` from the client.* Realtime is read-only; subscriptions cannot write. The existing Edge Function remains the sole write path. ✓
- *RLS always on; migrations append-only.* No migration. The existing RLS does the work. ✓
- *Edge Function shape.* No Edge Function added or modified. ✓
- *Logging rules.* `logRealtimeError` logs status + topic + error message only; never payload bodies; never the auth header; never the key. ✓

**evidence-doctrine:**

- *A manual tag is a participant gameplay annotation, never a verdict.* The broadcast does not reframe the tag; it just makes it appear faster. The announcement label is the META-001 plain-language code label, which is doctrine-clean by construction. ✓
- *Banned person-attribution labels.* The announcement copy has no slot for `taggedBy`; tests assert. ✓
- *Engagement credit ≠ factual-standing credit.* Realtime broadcasts do not produce either credit. ✓

**accessibility-targets:**

- *Screen-reader announcement on dynamic content arrival.* The `useEffect` diffs `pointTagsByArgumentId` and calls `AccessibilityInfo.announceForAccessibility`. ✓
- *Reduce-motion safety.* No animation is introduced; "silent visual merge" is reduce-motion-safe by construction. ✓
- *No color-only indicator.* No new visual indicator is introduced (silent + announcement). ✓

**expo-rn-patterns:**

- *No new dependency.* Uses the already-installed `@supabase/supabase-js` realtime primitive. ✓
- *RN-safe primitives only.* `AccessibilityInfo` is the canonical RN module. ✓
- *No web-only deps.* None. ✓

**test-discipline:**

- *Tests ship with the card.* 4 new suites, ~95–115 tests. Reducer is executed; hook lifecycle is exercised; echo regression is its own suite; reconcile is its own suite. ✓
- *No `.skip` / `.only`.* ✓
- *Doctrine ban-list scan.* Included in the merge and hook suites. ✓

---

## 13. Dependencies

- **META-1A — shipped (#76, PR #134, commit `f59c126`).** This card reads `PersistedPointTag`, `persistedTagsToManualTagEntries`, `applyManualTag` / `removeManualTag` from `pointTagsApi.ts`. META-1A is treated as a stable, frozen API.
- **META-001 — shipped.** `getManualTagPlainLabel`, `_forbiddenMetadataTokens`, the 10-code `ManualTagCode` vocabulary, and the in-memory `MoveMetadataLedger` shape. Not modified.
- **QOL-039 — shipped (#268).** Room-visibility model; no code change required because RLS-inheritance handles broadcast visibility (§9).
- **`@supabase/supabase-js` 2.x.** Already installed; provides `channel(...)`, `removeChannel(...)`, and the typed `postgres_changes` `on()` overload (confirmed in `node_modules/@supabase/realtime-js/dist/main/RealtimeChannel.d.ts:262–274`).
- **No other card blocks this one.** META-1B blocks future cards: any "live observer presence" surface, any META-1C admin audit live feed, and any timeline-node "just changed" badge.

---

## 14. Out of scope

- **Push notifications** for tag changes (v1 scope ban).
- **Realtime collaborative editing** of argument bodies (v1 scope ban).
- **Realtime for tables other than `point_tags`.** No `arguments` / `flags` / `argument_tags` / `topic_satisfaction_checks` / `debate_participants` / `debates` realtime is added.
- **Presence indicator** ("3 users viewing"). Not in the issue body; would require its own design.
- **Server-side broadcast rate limit / coalescing.** Supabase Realtime handles this; the client trusts the broker.
- **Animation / pulse effect** on the bubble whose tag just changed (file a separate UI follow-up if needed).
- **Toast / banner notification.** Excluded per §6.
- **Persisted presence** (last-seen, online state). Out of scope.
- **Mod-only realtime channel** that observes all rooms. Out of scope.
- **Schema changes to `point_tags`** (e.g., adding a `note` column, an `actor_role` column). Out of scope; META-1A documented these as additive future migrations.
- **Operator deploy / publication setup.** The implementer documents the post-merge step ("verify `point_tags` is in `supabase_realtime` publication") in the implementer doc / PR body. The design notes it in §15 OQ-1. No code change is required in this card to enable it.

---

## 15. Open questions

### OQ-1 — Realtime publication membership for `point_tags`

**Question:** Is the operator's Supabase project configured with the default `supabase_realtime` publication that covers `FOR ALL TABLES`, or has it been narrowed?

**Why it matters:** If narrowed, the subscription will succeed but no events will be delivered. The fix is a one-line `ALTER PUBLICATION` that the operator runs once, post-deploy. The implementer cannot detect this from the client cleanly (a subscribed channel that receives no events is indistinguishable from a quiet room).

**Recommendation:** the implementer adds a checklist line to the PR body / implementer doc: *"Operator: verify `point_tags` is in the `supabase_realtime` publication via the Supabase dashboard Database → Publications. If absent, run `ALTER PUBLICATION supabase_realtime ADD TABLE public.point_tags;` once."* No code change is required either way. This is the standard Supabase Realtime deploy step and does not require a roadmap card.

**Decision needed from operator:** None — just verify post-deploy. The default Supabase setup includes `FOR ALL TABLES`, so the answer is almost certainly "no action needed."

### OQ-2 — Subscription-status diagnostic chip (§6.4)

**Question:** Should the room shell surface a "Live updates: paused — reconnecting" diagnostic to the user when the channel is in `reconnecting` / `failed`?

**Why it matters:** Without it, the user sees the room silently stop updating during a network blip. With it, the user knows it's a transient issue.

**Recommendation:** the implementer ships **without** the chip in v1. The acceptance criteria do not require it, and the silent-fallback-to-refresh path keeps the room functional. If user feedback indicates confusion during blips, file a follow-up card to add the chip. The hook's `status` field is exposed precisely to make this trivial to add later.

**Decision needed from operator:** None — implementer ships without. (This is documented as the design's recommendation, not an operator decision.)

No other open questions surface from Q1–Q4. The design is implementable as written.
