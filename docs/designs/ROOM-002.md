# ROOM-002 — ExchangeView Ringside re-weight (kind spines, actor-aware action rows)

**Status:** Design draft
**Epic:** Argument Surface Pivot — room surface (Milestone M-ASP-2, Phase P2)
**Release:** P2 · flag `room_exchange_v2` (LIVE in prod; client deploys gated by the deliberate netlify-prod push)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/885
**Supersedes (declutter half of):** https://github.com/kyleruff1/cDiscourse/issues/504

---

## Goal (one paragraph)

Re-weight the Exchange lens of the argument room from the shipped Stage-6.1.8 z-stacked bubble deck (scale / translate / rotate / opacity / zIndex transforms, one active bubble, controls scattered across rail + sidecar) into the **Ringside feed** — a transform-free linear back-and-forth of move cards with kind-color spines (timeline-grammar tokens), a quote/target context chip, ReceiptChip-contract proof chips, inline branch pills, and **one actor-aware action row on the active card**. The re-weight lives entirely behind the already-threaded `roomExchangeV2Enabled` prop: flag-on renders Ringside; flag-off renders today's `ArgumentBubbleStack` byte-identically. This is the A-side of the A×B hybrid (Design Pass §5 Direction A, §14): Ringside is the default lens, the Map (ROOM-004) its co-equal flip. Doctrine that shapes the design: **conversation-first, not data-rich** — per the PRODUCT-REDIRECT-001 close comment on #504, standing / heat / classifier detail stays behind the existing drawers (Inspect, Map sidecar); the card face carries only the one calm friendly-flag surface already threaded (`pointFeedbackFlags`). No verdict/standing/heat labels on the card, score never blocks anything, kind spines are shape+text first (color never the only signal), and the feed is transform-free so reduce-motion parity holds by construction.

---

## Scope-reality audit (pre-launch, per POSTRUN-UX001 rule)

Two assumptions in the brief were checked against the codebase before designing. Both hold with one scope correction.

1. **`roomExchangeV2Enabled` is already threaded to `ArgumentRoom`.** Confirmed: `ArgumentRoom` Props declares `roomExchangeV2Enabled?: boolean` (`ArgumentRoom.tsx:490`) and destructures it (`:532`). App.tsx is the sole flag consumer via `isRoomExchangeV2Enabled` from `src/lib/featureFlags.ts:96` (proven by `roomThreeFlagOff.test.tsx:61-63`). Today the flag ONLY gates the `ArgumentStateRail` mount in `topBanner` (`ArgumentRoom.tsx:2447`); it does **not** yet reach `ExchangeView`. ROOM-002 threads it one level deeper. No App.tsx flag change is required.

2. **`targetExcerpt` is NOT available in the room message path — SCOPE CORRECTION.** The brief's card anatomy lists a "quote/target chip". The room's `messages: ArgumentMessageInput[]` are assembled in `ArgumentTreeScreen.tsx:480-506` and the `ArgumentMessageInput` type (`argumentGameSurfaceModel.ts:62-95`) has **no `targetExcerpt` field** — only `attachedEvidence` is threaded from `clientValidation`. `ArgumentRow.targetExcerpt` exists (`types.ts:35`) but is dropped at the room boundary. **Correction:** the card's quote/target chip derives from `parentHint` (the "replying to: '…'" excerpt already on `ArgumentBubbleViewModel.parentHint`), which is the reply-context this card is answering. Surfacing the move's OWN `targetExcerpt` would require threading it through `ArgumentTreeScreen` → `ArgumentMessageInput` → the view-model — three files, one of them pinned-adjacent — and is deferred to a follow-up (see Out of scope). The Design Pass mock's `↩ 0:42 "cities that tried it"` marker chip is the voice twin of `target_excerpt` and belongs to the P4-P6 voice/marker layers, explicitly out of scope here.

No hard blockers. Effort estimate unchanged (M): the action-row derivation and the flag plumbing already exist; the net-new work is the presentational feed + card + a pure feed model.

---

## Data model

**No new data model.** No new types in `types.ts`, no schema, no migration, no Edge Function, no RLS. One new pure-TS view-model type is introduced in a new model file (not a domain type):

```ts
// src/features/arguments/room/ringsideFeedModel.ts  (NEW, pure TS, no React/Supabase/network/AI)
import type {
  ArgumentBubbleControl,
  ArgumentBubbleViewModel,
  TimelineKindColorFamily,
} from '../argumentGameSurfaceModel';
import type { RailAction } from '../railActionCategories';

/** One Ringside card, projected from data the orchestrator already holds. */
export interface RingsideCardViewModel {
  messageId: string;
  ordinal: number;               // 1-based chronological index (from VM)
  actorLabel: string;            // "You" / "Other voice" / "Bot" / "Admin" (color-independent)
  actor: ArgumentBubbleControl extends never ? never : ArgumentBubbleViewModel['actor'];
  sideLabel: string;             // "Aff" / "Neg" / "Obs" / "Mod" / "—" (from VM.sideLabel)
  kindLabel: string;             // "claim" / "rebuttal" / "evidence" ... (from VM.kindLabel)
  kindColorFamily: TimelineKindColorFamily; // spine family (joined from timeline node)
  spineColor: string;            // TIMELINE_KIND_COLORS[kindColorFamily]
  body: string;                  // already redacted upstream (VM.body)
  createdAtLabel: string;
  relativeLabel: string;
  quoteChip: string | null;      // parentHint — the reply-context excerpt (NOT targetExcerpt)
  proofChipCount: number;        // count of attached evidence artifacts for this move
  owedReceiptChip: boolean;      // true when an evidence debt is owed on this move
  branchPill: RingsideBranchPill | null; // reply/descendant count → deep-link to Map
  friendlyFlagCount: number;     // count of the one calm friendly-flag surface (active card only)
  isActive: boolean;
  isLatest: boolean;
  isOwn: boolean;                // actor === 'self'
  deletionRequested: boolean;
  /** The FULL actor-aware action contract for this card. See "action-row contract" below. */
  actionRow: RingsideActionRow;
}

export interface RingsideBranchPill {
  descendantCount: number;       // node.descendantCount (0 hides the pill)
  label: string;                 // e.g. "3 replies →" (plain, no heat/verdict)
}

/** Actor-aware action row. Exactly one of the two variants is populated. */
export type RingsideActionRow =
  | { kind: 'participant'; controls: ArgumentBubbleControl[] } // from VM.allowedControls
  | { kind: 'observer'; actions: RailAction[] };               // from getRailActions('observer', actor)

export interface RingsideFeedViewModel {
  cards: RingsideCardViewModel[];
  activeMessageId: string | null;
}
```

The model is a **pure projection** — it joins already-derived structures (`ArgumentBubbleViewModel[]`, per-message enrichment) into card view-models. It never fetches, never mutates, never derives standing/heat/classifier signals. All doctrine-sensitive fields (standing band, tone, temperature, classifier marks) are intentionally absent from the card face.

---

## Design decisions (explicit)

### D1 — Render architecture: new sibling `RingsideFeed.tsx`, selected inside `ExchangeView` by the flag prop (PREFERRED)

`ExchangeView` gains one new prop, `roomExchangeV2Enabled?: boolean`, plus the projected `ringsideFeed?: RingsideFeedViewModel | null`. Inside `ExchangeView`:

```tsx
if (props.roomExchangeV2Enabled && props.ringsideFeed) {
  return <RingsideFeed feed={props.ringsideFeed} viewerRole={...} onCardAction={...} onActivate={...} />;
}
// else: today's stack subtree, TEXTUALLY UNCHANGED  (<ArgumentBubbleStack> + conditional <ArgumentBubbleActions>)
```

The existing `<ArgumentBubbleStack>` + conditional `<ArgumentBubbleActions>` JSX is preserved **verbatim** as the else-branch — this is what keeps flag-off byte-identical and keeps the `argumentGameSurfaceSemanticWiring` pin (`EXCHANGE_VIEW` must contain `/ArgumentBubbleStack/`) green. The Ringside feed is a NEW sibling component; the deck renderer (`ArgumentBubbleStack` / `ArgumentBubbleCard`) is **never modified or deleted**.

Rejected: **in-place conditional inside `ArgumentBubbleStack`.** It would couple the transform-free feed to the deck's scale/rotate/zIndex machinery, risk the flag-off byte-identity proof, and force `ArgumentBubbleCard` (which is dense card-detail-coupled) into a major rewrite — a separate refactor per the expo-rn-patterns "if your design forces a major rewrite, stop" rule.

### D2 — The action row reuses the EXISTING derivation; it does NOT fork (see full contract section)

**Key finding (surfaced for the reviewer):** the brief says the Stage-6.4 actor contract "lives in `railActionCategories` / `ArgumentSideActionRail`." Post-UX-001.4 that is only half-true. UX-001.4 **emptied** the rail's per-actor sets — `SELF_ACTIONS = []`, `PARTICIPANT_OTHER_ACTIONS = [reply, disagree]` only (`ArgumentSideActionRail.tsx:92-125`); the migrated codes (ask_source, ask_quote, split_branch, flag, qualifiers, request_deletion) moved to the "Act" popout. The **full** actor contract the issue enumerates (own = qualifiers + request-deletion; opponent = reply/disagree/ask-source/ask-quote/split-branch/flag/qualifiers) lives in `argumentGameSurfaceModel`'s `OTHER_USER_CONTROLS` / `SELF_CONTROLS` / `getBubbleControlsForActor` (`:189-203, :328-339`), already baked into `ArgumentBubbleViewModel.allowedControls` and already consumed by the `ArgumentBubbleActions` chip cluster. So the Ringside action row reuses **two existing derivations, no new table**:

- **Participant viewer** → `activeCard.allowedControls` (the full `getBubbleControlsForActor` contract) dispatched via `onBubbleAction` → `handleBubbleAction`.
- **Observer viewer** → `getRailActions('observer', actor)` (the rail's observer set) dispatched via `onRailAction` → `handleRailAction`.

Both derivations and both dispatch handlers are **already props on `ExchangeView`** (`viewerRole`, `activeViewModel`, `onBubbleAction`, `onRailAction`). ROOM-002 adds no new action code and no new handler.

### D3 — Card anatomy is conversation-first (standing/heat/classifier stay behind drawers)

Per the #504 PRODUCT-REDIRECT-001 close comment ("the data-rich centerpiece goal is inverted; MCP as friendly optional flags at LOWER density") and the issue's own doctrine self-check ("advisory chips stay behind existing drawers"), the Ringside card face carries **only**:

- kind spine (left edge, `TIMELINE_KIND_COLORS[kindColorFamily]`) + a text kind label (shape+text carry meaning; color supplementary)
- author/side header (`actorLabel` + `sideLabel`, both plain text)
- body (≥15px floor)
- quote/target context chip (`parentHint`, tappable → activates ancestor)
- proof chips (ReceiptChip contract) + owed-receipt chip (EvidenceDebtChip contract) when present
- inline branch pill (descendant count → deep-links to Map for deep forks, per Design Pass §5A CON)
- ONE calm friendly-flag row on the **active** card only (the already-threaded `pointFeedbackFlags` → `PointFeedbackFlagsRow`)
- the actor-aware action row on the **active** card only

Standing bands, tone/temperature, classifier marks, the 6-section sidecar, the referee card, the metadata inspector — all remain reachable via the existing Inspect popout / `activeCardDetail` and the Map lens (ROOM-004's sidecar owns the full-parity read). The card does not re-render them. This keeps the A/B split honest: Ringside = fast conversation; Map = data-rich review.

### D4 — KPI path: open → latest active → action row → reply scopes composer (≤2 taps)

Traced handler chain (pinned by the KPI-path test):
1. Room opens → `initialActiveId` = entry-hint or latest (`ArgumentRoom.tsx:576-596`) → `activeMessageId` set → the **latest card is active by default** (0 taps).
2. **Tap 1:** user taps **Reply** on the active card's action row → `RingsideFeed` calls `onCardAction('reply', messageId)` → `onBubbleAction('reply', messageId)` (prop) → `handleBubbleAction` (`:1826`) → `handleAction('reply', …)` → `onAction?.('reply', messageId, null)` → `ArgumentTreeScreen.handleAction` (`:510`) → `onReply(messageId, arg)` opens/scopes the one-bar composer to that message.
3. **Tap 2:** send in the one-bar `ArgumentEntryComposer` (mounted in App.tsx behind the same flag). Posted reply in ≤2 taps.

### D5 — Slices (each its own PR under the bundle branch)

- **S1 — pure feed model.** `ringsideFeedModel.ts` + `ringsideFeedModel.test.ts`. Card view-models from `ArgumentBubbleViewModel[]` + per-message enrichment (kindColorFamily, descendant count, proof/debt, parentHint) + actor-aware action-row derivation (reuse `allowedControls` / `getRailActions`). No UI.
- **S2 — Ringside card + feed view + RNTL.** `RingsideCard.tsx`, `RingsideFeed.tsx`, render tests (kind/actor/state matrix, a11y floors, reduce-motion parity, copy ban-list).
- **S3 — flag wiring inside `ExchangeView` + orchestrator projection + flag-off byte-identity proof + parity-selection extension.** Thread `roomExchangeV2Enabled` + `ringsideFeed` into `ExchangeView`; build the projection in `ArgumentRoom` (memoized, only when the flag is on); `roomTwoFlagOff.test.tsx`; extend `timelineSelectionSharedAcrossModes`.

### D6 — Non-goals (structural)

No MapView edits (ROOM-004 owns them), no composer/dock/oneBox edits (pinned), no stack-renderer deletion, no new action codes, no Edge/migration, no engine change, no voice/marker layers.

---

## The action-row contract (authoritative — ROOM-004's Map popover MIRRORS this)

This section is the single source of truth for **which action codes render for which actor class, and how they dispatch**. ROOM-004's Map-node popover consumes the SAME two derivations and the SAME handlers so the A×B capability-parity rule (Design Pass §6) holds: view choice is a lens, never a capability gate.

### Actor classes and their action sets

| Viewer role | Active card actor | Action set source (EXISTING derivation) | Ordered codes | Dispatch handler | Code type |
|---|---|---|---|---|---|
| `participant` | `self` (own move) | `getBubbleControlsForActor('self')` → `VM.allowedControls` | `view_qualifiers`, `request_deletion` | `onBubbleAction` → `handleBubbleAction` | `ArgumentBubbleControl` |
| `participant` | `other` / `bot` / `admin` / `unknown` | `getBubbleControlsForActor('other')` → `VM.allowedControls` | `reply`, `disagree`, `flag`, `ask_for_source`, `ask_for_quote`, `branch`, `view_qualifiers` | `onBubbleAction` → `handleBubbleAction` | `ArgumentBubbleControl` |
| `observer` | any | `getRailActions('observer', actor)` | `watch`, `join_aff`, `join_neg`, `share` | `onRailAction` → `handleRailAction` | `RailActionCode` |

Notes that bind the implementer AND ROOM-004:

- **Never fork the sets.** The participant sets come from `VM.allowedControls` (already actor-gated by `getBubbleControlsForActor`, `argumentGameSurfaceModel.ts:328`). The observer set comes from `getRailActions('observer', …)` (`ArgumentSideActionRail.tsx:121`). Do not re-enumerate codes in a parallel constant — that is the drift the `roomActionCodes.ts` `satisfies` guard and `railActionGrouping.test.ts` exist to prevent.
- **`request_deletion` is disabled (not hidden) when `deletionRequested` is true** — mirror `ArgumentBubbleActions.tsx:52` (`disabled` chip, label "Deletion requested", `accessibilityState.disabled`). The self set omits `request_deletion` entirely when `hasOpenDeletionRequest` per `getBubbleControlsForActor` — the VM already reflects this, so the row just renders `allowedControls`.
- **Dispatch routing already exists** (do not re-implement): `handleBubbleAction` intercepts `flag` → `RequestReviewComposer` (`:1831`) and delegates `request_deletion` → `handleAction` → `setDeletionTarget` (deletion sheet, `:1812`); every other control → `onAction` → composer. `handleRailAction` routes `join_aff`/`join_neg`/`share`/`watch`/`open_timeline` locally and maps the rest via `railActionToBubbleControl` (`:1935`).
- **Observer seat-fullness** (disabled Join chips when the room is full) is owned by the still-mounted `ArgumentSideActionRail` (`canClaimActiveSeat`). The Ringside observer row renders the observer actions and dispatches via `onRailAction`; it does NOT re-implement seat-full disabling (out of scope; the rail remains the seat authority). Note this in the row so ROOM-004 makes the same choice.
- **One primary action per element** (#504 affordance fix): the first code of each set renders as the primary tone; the rest are quiet ghost chips (Design Pass §5A "quiet ghost actions"). No element carries two competing primary affordances.

### Parity contract for ROOM-004 (one line)

> ROOM-004's Map-node popover, for a given `(viewerRole, actor, messageId)`, renders the SAME ordered codes from the SAME source (`allowedControls` for participants, `getRailActions('observer', actor)` for observers) and dispatches through the SAME `onBubbleAction` / `onRailAction` handlers `ArgumentRoom` already passes to `MapView` (`onAction={handleBubbleAction}` is already wired at `ArgumentRoom.tsx:2540`).

---

## Pin-relaxation inventory (required)

Every source-scan / boundary / render suite that fires on `ExchangeView` / `ArgumentRoom` / `argumentGameSurfaceModel` edits, classified **additive-safe** (no change needed) vs **NOTEd relaxation** (a pin must be relaxed with a comment). Verified by `git grep` over `__tests__/`.

### Directly name `ExchangeView` (4 suites) — all ADDITIVE-SAFE

| Suite | What it pins | Verdict |
|---|---|---|
| `argumentGameSurfaceSemanticWiring.test.tsx:97,101` | `EXCHANGE_VIEW` contains `/ArgumentBubbleStack/`; `SURFACE` contains `/<ExchangeView/` | ADDITIVE-SAFE — the stack subtree stays as the flag-off else-branch; the `<ExchangeView>` mount stays. |
| `timelineSelectionSharedAcrossModes.test.ts:187` | `ArgumentRoom` passes `activeMessageId={activeMessageId}` to `<ExchangeView>` | ADDITIVE-SAFE — that prop is unchanged; extend this suite (S3) to assert the selection is shared into `ringsideFeed` too. |
| `uxOneOneSixReadOnlyBoundary.test.ts:124-125` | `ExchangeView.tsx` exports `ExchangeView` + `ExchangeViewProps`; `ArgumentRoom` exports `ArgumentRoom` + `Props` | ADDITIVE-SAFE — exports kept; new props are additive to `ExchangeViewProps`. |
| `uxOneOneTwoDoctrine.test.ts:47` | `ExchangeView.tsx` has no verdict token inside any string literal | ADDITIVE-SAFE **with a hazard** — new copy must be ban-list clean AND all comments in `ExchangeView.tsx` must stay **apostrophe-free** (the scanner's naive `STRING_RE` treats one stray apostrophe as an open quote and poisons the whole file — see MEMORY "Doctrine scanner apostrophe gotcha"). Run this suite pre-push. |

### Fire on `ArgumentRoom` source ordering / doctrine (ADDITIVE-SAFE, do not reorder cols)

| Suite | What it pins | Verdict |
|---|---|---|
| `uxOneOneTwoChromeLayerRemovals.test.ts:143,167` | `<MapView>` precedes `<ArgumentScoreTracker>`; `<TimelineSelectedReadoutPanel>` follows `<MapView>` in `ArgumentRoom` | ADDITIVE-SAFE — ROOM-002 touches only the `mode === 'stack'` (`<ExchangeView>`) branch and the col1 body; it does not reorder col1/col2 or the MapView branch. |
| `uxOneOneTwoDoctrine.test.ts:46` | `ArgumentRoom.tsx` verdict-token scan | ADDITIVE-SAFE — apostrophe-free comments + ban-list-clean copy. |
| `argumentGameSurfaceSemanticWiring.test.tsx` (SURFACE pins) | referee/override wiring in the surface | ADDITIVE-SAFE — untouched. |

### New files must be ADDED to existing scan lists (additive)

- `RingsideFeed.tsx`, `RingsideCard.tsx` carry user-facing copy → **add** to `uxOneOneTwoDoctrine.test.ts` `UX_001_2_FILES` (additive; keeps their copy ban-list-clean). Keep comments apostrophe-free.
- `ringsideFeedModel.ts` is pure TS → covered by its own `ringsideFeedModel.test.ts` (ban-list assertion on any label strings it produces).
- Optionally add the three new room files to `uxOneOneSixReadOnlyBoundary.test.ts` requiredApi pins (additive) so a future card cannot silently drop their exports — recommended but not required by ROOM-002 acceptance.

### Verdict

**No NOTEd relaxation is required.** Every pin that fires is additive-safe because the re-weight is a NEW sibling branch gated behind the flag; the flag-off stack path is preserved verbatim. The `uxOneOneFive*` list (composer / dock / oneBox) pins OTHER files zero-diff — those are untouched. The single hazard is the doctrine-scanner apostrophe gotcha on `ExchangeView.tsx` / `ArgumentRoom.tsx` / the two new UI files; mitigation is apostrophe-free comments + a pre-push run of `uxOneOneTwoDoctrine`.

---

## File-by-file change list (with anchors)

### New files

- `src/features/arguments/room/ringsideFeedModel.ts` — pure feed model (~180-220 lines). Exports `RingsideCardViewModel`, `RingsideFeedViewModel`, `RingsideActionRow`, `RingsideBranchPill`, `buildRingsideFeed(input)`. No React/Supabase/network/AI. Consumes `TIMELINE_KIND_COLORS` + `TimelineKindColorFamily` from `argumentGameSurfaceModel` and `RailAction` from `railActionCategories`.
- `src/features/arguments/room/RingsideFeed.tsx` — transform-free linear feed container (~120-160 lines). Maps `feed.cards` → `<RingsideCard>`, owns no state/derivation; every value is a prop. Renders the active card's friendly-flag row (`PointFeedbackFlagsRow`) and action row.
- `src/features/arguments/room/RingsideCard.tsx` — single move card (~180-220 lines). Kind spine, header, body, quote chip, proof chips (`ReceiptChip` / `EvidenceDebtChip`), branch pill, actor-aware action row.
- `__tests__/ringsideFeedModel.test.ts` — S1 model matrix (~40-60 tests).
- `__tests__/ringsideFeed.test.tsx` — S2 RNTL render + a11y + interaction (~25-40 tests).
- `__tests__/roomTwoFlagOff.test.tsx` — S3 flag-off byte-identity proof (~10-15 tests), modeled on `roomThreeFlagOff.test.tsx`.

### Modified files

- `src/features/arguments/room/ExchangeView.tsx` — **~30-40 lines added.** Add two props to `ExchangeViewProps` (`roomExchangeV2Enabled?: boolean`, `ringsideFeed?: RingsideFeedViewModel | null`, plus the card-action handler already covered by `onBubbleAction`/`onRailAction`). Add the flag-on early-return rendering `<RingsideFeed>`; the existing stack subtree stays as the else-branch **verbatim** (byte-identical). Keep the `ArgumentBubbleStack` import (pin at `argumentGameSurfaceSemanticWiring:97`). Comments apostrophe-free.
- `src/features/arguments/room/ArgumentRoom.tsx` — **~30-40 lines added.** Build `ringsideFeed` via `buildRingsideFeed(...)` memoized on `viewModels` + `nodeByMessageId` + `artifactsByMessageId` + `evidenceDebts` (all already derived, `:714, :751, :769, :787`) — gated so it is only built when `roomExchangeV2Enabled` (else `null`). Pass `roomExchangeV2Enabled` + `ringsideFeed` to `<ExchangeView>` at `:2501`. No col reordering; no new handler (reuse `handleBubbleAction` / `handleRailAction`). Comments apostrophe-free.
- `__tests__/uxOneOneTwoDoctrine.test.ts` — **add** `RingsideFeed.tsx` + `RingsideCard.tsx` to `UX_001_2_FILES` (additive).
- `__tests__/timelineSelectionSharedAcrossModes.test.ts` — extend to assert the shared `activeMessageId` flows into `ringsideFeed.activeMessageId` (S3).
- `docs/core/current-status.md` — add the ROOM-002 Phase-framing H2 section + new test count (per multi-card chain protocol).

### Deleted files

- None. The stack renderer (`ArgumentBubbleStack.tsx`, `ArgumentBubbleCard.tsx`, `ArgumentBubbleActions.tsx`) is retained for the flag-off path and deleted by a later card only after the re-weight is proven in prod.

---

## Component spec

### `RingsideFeed` (props / states / testIDs)

```ts
interface RingsideFeedProps {
  feed: RingsideFeedViewModel;
  viewerRole: RailViewerRole;
  onActivate: (messageId: string) => void;            // = handleActivate (shared selection)
  onActivateAncestor: (messageId: string) => void;    // quote-chip tap = handleActivate
  onCardAction: (control: ArgumentBubbleControl, messageId: string) => void; // = onBubbleAction
  onRailAction: (code: RailActionCode, ctx: { activeMessageId: string | null }) => void; // = onRailAction
  onOpenMap: () => void;                              // branch-pill deep-link → setMode('timeline')
  pointFeedbackFlags: PrioritizedPointFeedbackFlags | null; // active-card calm flag row
  reduceMotion?: boolean;
}
```

- **States:** empty (no messages → nothing, room shell handles empty), normal, observer (action row = observer set), participant (action row = allowedControls). Own vs other active card drives the action set.
- **testIDs:** `ringside-feed`, `ringside-card-<messageId>`, `ringside-card-active-<messageId>`, `ringside-action-<code>-<messageId>`, `ringside-quote-chip-<messageId>`, `ringside-proof-chip-<messageId>`, `ringside-branch-pill-<messageId>`.

### `RingsideCard` a11y floors (accessibility-targets + timeline-grammar)

- Card is a `Pressable` (tap = activate): `accessibilityRole="button"`, `accessibilityState={{ selected: isActive }}`, verbose label per timeline-grammar node contract: `` `${kindLabel} by ${actorLabel} on side ${sideLabel}, position ${ordinal} of ${total}${isActive ? ', active' : ''}${branchPill ? `, ${branchPill.label}` : ''}` `` (NO standing/heat/verdict in the label — those are not on this card).
- **Every action-row target ≥44×44** (visual or `hitSlop`). Note this is an improvement over the legacy `ArgumentBubbleActions` chip cluster (`minHeight: 36`); the issue AC requires 44px+.
- **Color never the only signal:** kind spine pairs the color with the text `kindLabel`; the grayscale snapshot must still read the kind. Add a grayscale/no-color assertion.
- **Quote/proof/branch chips** are real `Pressable`s with role + label + 44px; display-only text (header, timestamps, friendly-flag captions) uses label styling with **no clickable box** (#504 affordance sweep, applied to the card only — the timeline is ROOM-004/untouched here).
- **Reduce-motion parity by construction:** the feed is a plain vertical list — no scale/rotate/opacity/zIndex transforms, no active-scale animation. There is nothing to disable, so reduce-motion is satisfied structurally. The `reduceMotion` prop is threaded for symmetry with the rest of the room but has no motion to gate. Add an explicit test asserting no `Animated`/transform is used in `RingsideCard`.
- **Keyboard nav (web):** the feed participates in the existing room Tab order; card activation via Enter/Space on the focused card. Arrow-key sibling nav is owned by the existing `resolveStackKeyEffect` path and is out of scope for ROOM-002 (the feed reuses `onActivate`/prev/next handlers if wired; not required by AC).

### Kind spine token binding (timeline-grammar)

Spine color = `TIMELINE_KIND_COLORS[kindColorFamily]` (`argumentGameSurfaceModel.ts:824`): claim `#6366f1`, challenge `#f97316`, evidence `#06b6d4`, clarify `#f59e0b`, concede `#a855f7`, flag `#ef4444`, default `#475569`. The family comes from `getKindFamily(argumentType)` — the feed model must join to the timeline node's `kindColorFamily` (the VM's `kindLabel` is a display string like "counter-rebuttal" that does NOT map through `KIND_COLOR_FAMILY`; the raw `argumentType` does). The implementer joins `RingsideCardViewModel` to `nodeByMessageId.get(messageId).kindColorFamily` (already built at `ArgumentRoom.tsx:751`). No new color hex; no shape drifts into a truth claim (shape+text = kind, not "correct/wrong").

---

## Copy plan

Choke points (all new strings routed ban-list clean, plain language only, no internal codes):

- Action labels reuse the shipped `CONTROL_LABEL` map (`ArgumentBubbleActions.tsx:16`) and `OBSERVER_COPY` / `RailAction.label` — no new action copy invented.
- Branch pill: `` `${descendantCount} ${descendantCount === 1 ? 'reply' : 'replies'} →` `` — activity count, never heat/verdict.
- Quote chip prefix: reuse the existing parent-hint phrasing already on `VM.parentHint` (e.g. "replying to: '…'") — no new copy.
- Kind label: reuse `VM.kindLabel` (already plain). No standing/heat words on the card.
- Ban-list: no `winner / loser / correct / incorrect / liar / dishonest / bad faith / manipulative / extremist / propagandist / stupid / idiot / truth`. Enforced by adding the two UI files to `uxOneOneTwoDoctrine` + a dedicated ban-list assertion in `ringsideFeedModel.test.ts` and `ringsideFeed.test.tsx`.
- All comments in scanned files (`ExchangeView.tsx`, `ArgumentRoom.tsx`, `RingsideFeed.tsx`, `RingsideCard.tsx`) **apostrophe-free** (write "does not" not "doesn't").

---

## Test plan

Baseline: **934 suites / 33,311 tests** (per the brief). Expected delta: **+3 suites, ~+75-115 tests** (S1 model ~40-60, S2 RNTL ~25-40, S3 flag-off ~10-15), plus small additions to two extended suites. No test removed.

- `__tests__/ringsideFeedModel.test.ts` (S1):
  - Feed-model matrix: for each kind family (claim/challenge/evidence/clarify/concede/flag/default) → correct `spineColor` + `kindColorFamily`.
  - Actor matrix → action-row variant: participant+self → `{kind:'participant', controls:[view_qualifiers, request_deletion]}`; participant+other → `{kind:'participant', controls:[reply, disagree, flag, ask_for_source, ask_for_quote, branch, view_qualifiers]}`; observer → `{kind:'observer', actions:[watch, join_aff, join_neg, share]}`.
  - `request_deletion` omitted from self set when `deletionRequested`/`hasOpenDeletionRequest`.
  - `quoteChip` = `parentHint` (null for root); `proofChipCount` from artifacts; `owedReceiptChip` from debt; `branchPill` null when descendantCount 0.
  - `activeMessageId` propagation; `isLatest`/`isActive`/`isOwn` correctness.
  - Ban-list: no banned verdict token in any produced label.
  - Empty input → empty cards, null active.
- `__tests__/ringsideFeed.test.tsx` (S2, RNTL):
  - Renders one card per message, transform-free (assert no `Animated`/transform in `RingsideCard`).
  - Active card shows the action row + friendly-flag row; inactive cards do not show the action row.
  - Actor matrix in the DOM: own active card renders only Qualifiers + Request deletion; opponent active card renders the 7-code set; observer renders watch/join/share.
  - Fire Reply on the active opponent card → `onCardAction('reply', messageId)` called.
  - Fire an observer action → `onRailAction('join_aff', {activeMessageId})` called.
  - `request_deletion` disabled state when `deletionRequested`.
  - a11y floors: every action `Pressable` ≥44×44 (visual or hitSlop), role+label+state present; grayscale/no-color legibility (spine + text kind).
  - Branch pill tap → `onOpenMap` called.
- `__tests__/roomTwoFlagOff.test.tsx` (S3), modeled on `roomThreeFlagOff.test.tsx`:
  - Logic identity: `ringsideMounted(flag)` → `flag`; stack path is the else-branch.
  - Source pins: `ExchangeView.tsx` renders `<ArgumentBubbleStack` in the flag-off branch (byte-identical stack subtree present) and `<RingsideFeed` only in the flag-on branch.
  - `ArgumentRoom` passes `roomExchangeV2Enabled` + `ringsideFeed` to `<ExchangeView>`; builds `ringsideFeed` as `null` when the flag is off (no wasted derivation).
  - The new files import no `featureFlags` (App.tsx stays the sole consumer).
- `__tests__/timelineSelectionSharedAcrossModes.test.ts` (extend): the shared `activeMessageId` flows into `ringsideFeed.activeMessageId` (selection survives lens switch both directions — the parity invariant).
- KPI-path test (in `ringsideFeed.test.tsx`): active-by-default = latest; Reply on the active card dispatches `('reply', latestId)` through the chain (≤2 taps).
- Full gates: `npm run typecheck`, `npm run lint`, `npm run test` (capture the `Test Suites` / `Tests` line + `EXIT: 0`), `npm run web:build` (RN-Web bundle parity — no asset-require or color-token regressions).

---

## Dependencies (cards / docs / files)

- Assumes **ASP-EXTRACT-001 (#864, shipped)** is complete because `ExchangeView` / `ArgumentRoom` / `roomActionCodes` / `MapView` exist as the extraction seam this card edits.
- Assumes **ROOM-001 rail (#876, shipped)** and **ROOM-003 bar (#829, shipped)** because the Ringside feed composes with the top state rail (`ArgumentStateRail`, mounted behind the same flag at `ArgumentRoom.tsx:2447`) and the bottom one-bar composer (`ArgumentEntryComposer`, mounted in App.tsx behind the same flag).
- Reads existing derivations in `ArgumentRoom`: `viewModels` (`:714`), `nodeByMessageId` (`:751`), `artifactsByMessageId` (`:769`), `evidenceDebts` (`:787`), `activeViewModel.allowedControls`, `getRailActions` (`ArgumentSideActionRail.tsx:121`), `handleBubbleAction` (`:1826`), `handleRailAction` (`:1935`).
- Reuses `TIMELINE_KIND_COLORS` (`argumentGameSurfaceModel.ts:824`), `ReceiptChip` + `EvidenceDebtChip` + `getNodeEvidenceDebtChip` (`src/features/evidence/`), `PointFeedbackFlagsRow` (`src/features/feedbackFlags/`).
- **Pairs with ROOM-004 (Map parity)** on this one bundle branch — ROOM-004 mirrors "The action-row contract" section verbatim. ROOM-002 owns that contract; ROOM-004 consumes it.
- **Blocks** future PROOF-series and voice/marker (P4-P6) cards that render inside a Ringside card, because they extend the card anatomy defined here.

---

## Risks

- **The flag is LIVE in prod.** `room_exchange_v2` is enabled server-side; the flag-on Ringside path ships at the next deliberate netlify-prod push. Any regression in the Ringside branch reaches users immediately after that push. Mitigation: the flag-off stack path is preserved byte-identical (regression-proof for the current live client) and gated by the `roomTwoFlagOff` proof; the flag-on path must pass the full RNTL matrix + `web:build` before the operator pushes.
- **ExchangeView regression surface.** `ExchangeView` feeds both lenses via `ArgumentRoom`; a botched early-return could break the stack path. Mitigation: additive early-return, else-branch verbatim, `argumentGameSurfaceSemanticWiring` + `roomTwoFlagOff` pins.
- **The stack must stay reachable flag-off.** Do not delete `ArgumentBubbleStack`/`ArgumentBubbleCard`/`ArgumentBubbleActions`; they are the live client today.
- **Doctrine-scanner apostrophe gotcha** (MEMORY): a single apostrophe in any comment of a scanned file (`ExchangeView.tsx`, `ArgumentRoom.tsx`, the two new UI files) poisons `uxOneOneTwoDoctrine`'s string parser and flags distant innocent lines. Mitigation: apostrophe-free comments + run the suite pre-push.
- **Kind-family join subtlety:** the VM's `kindLabel` ("counter-rebuttal") does NOT map through `KIND_COLOR_FAMILY`; only the raw `argumentType` does. The model MUST source `kindColorFamily` from the timeline node (`nodeByMessageId`), not from `kindLabel`. A wrong join yields all-default (slate) spines — add a model test per kind.
- **`web:build` gate** (MEMORY): jest mocks asset requires; a wrong relative path or RN-Web layout quirk passes jest but breaks Metro/Netlify. Run `npm run web:build` before claiming done.

---

## Out of scope (explicit — reduces scope creep)

- MapView / Map popover edits — **ROOM-004** owns them (this card only defines the contract they mirror).
- Composer / dock / oneBox edits — pinned zero-diff by `uxOneOneFive*` / `uxOneOneSix*`.
- Deleting the stack renderer — a later card, after prod-proving.
- New action codes or new dispatch semantics.
- The move's own `targetExcerpt` quote chip — not threaded into the room message path today (reality-audit finding); the card uses `parentHint`. Threading `targetExcerpt` is a follow-up (touches `ArgumentTreeScreen` + `ArgumentMessageInput` + the VM).
- Voice/marker layers, timestamp rebuttal chips (Design Pass P4-P6).
- Standing/heat/classifier zones on the card face — kept behind the existing Inspect popout + Map sidecar (ROOM-004) per doctrine.
- Any Edge Function, migration, RLS, or engine change.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks):** the card face carries no standing/heat/verdict; the action row contains only Constitution moves + read affordances; nothing on the card gates posting. Ban-list enforced on all new copy + files added to `uxOneOneTwoDoctrine`. PASS.
- **cdiscourse-doctrine §2-3 (heat = activity, popularity ≠ evidence):** the branch pill shows a plain reply/descendant count (activity), never framed as importance or correctness; no engagement metric grants standing. PASS.
- **cdiscourse-doctrine §4/§7 (AI moderator limits; no client AI):** the feed model is pure TS — no Anthropic/xAI/X/network/AI, no classifier call, post-store read only (it never runs a classifier; classifier marks stay off the card). PASS.
- **cdiscourse-doctrine §5 (engine sacred):** untouched. PASS.
- **cdiscourse-doctrine §6 (secrets):** no keys, no service-role, `grep` for `ANTHROPIC_API_KEY|SERVICE_ROLE` over the diff must be empty. PASS.
- **cdiscourse-doctrine §8 (Supabase conventions):** no migration, no RLS change, no row mutation from the component. PASS.
- **cdiscourse-doctrine §9 (plain language):** no internal codes on the card; action labels reuse shipped plain-language maps. PASS.
- **cdiscourse-doctrine §10a (Observations vs Allegations):** machine-observation/classifier chips are NOT rendered on the Ringside card — they stay behind Inspect / Map, so the card never renders a machine mark as if a person alleged it. PASS.
- **timeline-grammar (shape/color/no truth drift):** kind spine binds to `TIMELINE_KIND_COLORS` via `kindColorFamily`; color is paired with the text `kindLabel` (shape+text primary, color supplementary); grayscale snapshot test asserts legibility. Kind labels never say "correct/true/right". PASS.
- **accessibility-targets:** ≥44×44 on every action target (improving on the legacy 36px chips); role+label+state on every pressable; color-independent state words; reduce-motion parity by construction (transform-free feed). PASS.
- **expo-rn-patterns:** RN primitives only (`View`/`Text`/`Pressable`); no new dep; pure `*Model.ts` with no React import; reuses existing components rather than rebuilding. PASS.
- **A×B capability-parity (Design Pass §6, binding):** every action code is reachable from both lenses through the SAME derivation + handlers; the read-detail (classifier/standing) reachable via the shared Inspect + Map sidecar. View choice is a lens, not a capability gate. PASS.

---

## Operator steps (if any)

**None for merge — pure client code change.** The `room_exchange_v2` flag is already LIVE server-side; merging ROOM-002 does NOT change the live site. The flag-on Ringside path becomes visible only when the operator runs the deliberate **netlify-prod push** (strict FF push + poll the deployed JS bundle hash for the new build), after the full gates + `web:build` pass. No `supabase db push`, no `functions deploy`, no env var.
