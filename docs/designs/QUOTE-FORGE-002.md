# QUOTE-FORGE-002 — Linked callback visual treatment (rendered move)

**Status:** Design draft
**Epic:** Argument Surface Pivot — A. Quote Forge / Call-Back Weaver (M-ASP-2)
**Release:** M-ASP-2
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/842
**Base:** `0284c516` (main) · worktree `wt-quote-pair` · branch `feat/quote-callback-pair`
**Sibling card (same worktree, do not design):** UX-COMPOSER-005 #831 — composer-side insert + draft echo + submit wiring.

---

## Goal (one paragraph)

When a participant "weaves a callback" — pulls an exact prior line from a settled
room into a new move — that posted move must be **instantly recognizable as an echo
of a prior moment**, not a plain reply (§5.A "it renders as a visually distinct linked
echo"). This card owns only the **rendered move**: how a callback move looks on the
three room surfaces (Timeline map node, Stack card, Ringside card). It builds on the
QOL-042 / QUOTE-FORGE-001 cross-room-link substrate (`crossRoom/`, PR #861) and reuses
that substrate's **three-state RLS-derived access model** (`authorized` / `title_only`
/ `unavailable`) so a private prior room never leaks past its title snapshot. The
callback identity is a **LINK identity** (an echo of a prior moment), never a
strength / standing / heat / truth signal — per `timeline-grammar` and
`cdiscourse-doctrine` §1–§3 the visual must not read as a verdict. No celebration /
confetti (that is QUOTE-FORGE-004, out of scope; §9 "un-game-like").

---

## Scope-reality audit (read this first — it reshapes the card)

The card's "Likely files" line assumes detection is `argument_room_links` rows "joined
to the move". **That join does not exist in the schema today.** The pre-launch reality
audit (this card is orchestrator-adjacent and the assumption is load-bearing, so the
audit is mandatory — POSTRUN-UX001 scope-reality rule):

**What is actually there:**

- `argument_room_links` (`src/features/arguments/crossRoom/argumentRoomLinksApi.ts`)
  is **room-to-room only**: columns `id, source_debate_id, target_debate_id,
  created_by, target_title_snapshot, note, is_removed, created_at`. There is **no
  `source_argument_id`** (the move that IS the callback) and **no
  `target_argument_id`** (the exact prior move being echoed).
- A posted move (`ArgumentRow`, `src/features/arguments/types.ts`) carries **no
  cross-room reference field**. It has `targetExcerpt` (an in-room quote, also used by
  MARK / ask_quote — cannot alone identify a *cross-room* callback), `parentId`
  (in-room), and two JSONB blobs `clientValidation` / `serverValidation`.
- QUOTE-FORGE-001 (#861) renders a **room-level chip row**
  (`LinkedPriorArgumentChipRow`) in the timeline header — "this room references a prior
  room". It is **not** a per-move marker and is **not** flag-gated (mounts live,
  renders nothing when there are no chips). `useLinkedPriorRooms` is called
  unconditionally in `ArgumentTreeScreen.FullRoomGameSurfaceMount`.

**The hard blocker:** a callback *move* cannot be distinguished from a plain reply
after a page reload unless a **per-move callback reference is persisted**. Room-level
links are the wrong grain (one link row is shared by every callback move in the room to
the same prior room). Therefore this card has a **hard dependency on UX-COMPOSER-005
#831 persisting a per-move callback reference** at submit time. This design specifies
the exact read shape it needs and flags the persistence decision as the #1
reconciliation seam (below). If #831 does **not** persist a per-move reference, this
card cannot deliver its acceptance criterion and must not ship — the two are an atomic
pair.

**Scope correction:** the card stays a small (`effort:s`) render card, but its
correctness is gated on the shared persistence seam. No migration is required if #831
persists into an existing JSONB column (the QOL-037 `evidenceResponse` precedent — see
Data model). This design is written to consume that seam and to **degrade to a plain
move** whenever the reference is absent, malformed, or the feature flag is off.

---

## Data model

**No new table, no new column, no migration.** This card is pure render + a pure
view-model deriver. It *reads* a per-move callback reference that #831 persists into an
existing JSONB column, and it *reads* the already-resolved QOL-042 link access state.

### The persisted per-move reference (READ shape — authored by #831, consumed here)

The precedent is QOL-037 `evidenceResponse`: `submit-argument/index.ts:353-355` copies
an optional advisory client block **verbatim** into `server_validation`; it is never
validated, never blocks the post, and is render-time-derived by the client. `rail_payload`
is **not** usable — it is overwritten server-side by the rails engine
(`index.ts:351,372`). A callback reference is exactly this kind of advisory client
metadata, so the recommended home is `server_validation.crossRoomCallback` (equally
viable: `client_validation.crossRoomCallback`, the `attachedEvidence` precedent). This
card is agnostic to which block — it reads a normalized ref via one adapter.

```ts
/**
 * The minimal per-move callback reference this card READS. Authored + persisted
 * by UX-COMPOSER-005 #831 at submit time. Advisory, non-blocking (QOL-037 shape).
 * This card never writes it.
 */
export interface PersistedCallbackRef {
  /**
   * The argument_room_links row id the callback rides. #831 has this at create
   * time (it creates the link, then posts the move). This is the JOIN KEY into
   * the already-resolved QOL-042 chip (access state + prior room title + nav).
   */
  linkId: string;
  /**
   * The exact echoed prior line, snapshotted at weave time (author was authorized
   * on the prior room then). Treated as PRIOR-ROOM CONTENT: rendered only in the
   * `authorized` access state (privacy gate below). <= 280 chars (clamp at read).
   */
  echoedExcerpt: string;
  /**
   * Optional prior-room argument id of the echoed move (the exact moment). Captured
   * for a future move-level deep-link; NOT used for nav in v1 (nav is room-level).
   */
  targetArgumentId?: string | null;
}
```

### The echo view-model (this card's output — the single derivation)

```ts
export type CallbackEchoAccessState = 'authorized' | 'title_only' | 'unavailable';

/**
 * One woven-echo decoration for one callback move. Built ONCE per room by
 * buildCallbackEchoesByMessageId and SHARED by all three surfaces (Timeline node,
 * Stack card, Ringside card) — the mediator-board single-derivation rule.
 */
export interface CallbackEchoViewModel {
  /** The current-room move this echo decorates. */
  messageId: string;
  /** The argument_room_links row id (join key back to the QOL-042 chip). */
  linkId: string;
  /** The prior room being echoed; drives nav. Null when unresolved. */
  targetDebateId: string | null;
  /** Access to the prior room's content — REUSED from the QOL-042 chip, not re-derived. */
  accessState: CallbackEchoAccessState;
  /** Prior room title (live or snapshot) for the origin line. '' when unavailable. */
  originTitle: string;
  /**
   * The echoed prior line. PRESENT ONLY in `authorized`. '' in `title_only` /
   * `unavailable` — the privacy invariant (a non-authorized viewer never receives
   * prior-room body text through this field).
   */
  echoedExcerpt: string;
  /** True in `title_only` — the origin renders as a locked line. */
  isLocked: boolean;
  /** True only in `authorized` — tapping opens the prior room via existing nav. */
  canOpenOrigin: boolean;
  /** Plain-English origin line (authorized / locked / unavailable copy). */
  originLine: string;
  /** Verbose screen-reader label for the whole echo — no verdict / snake_case. */
  accessibilityLabel: string;
}
```

The deriver returns `null` for any move with no (or malformed) callback ref → the move
renders as an ordinary reply (additive, never crowds a non-callback move).

---

## API / interface contracts

### New pure model — `src/features/arguments/crossRoom/callbackEchoModel.ts`

```ts
/** One resolved prior link, assembled by the room shell from useLinkedPriorRooms. */
export interface ResolvedPriorLink {
  linkId: string;
  targetDebateId: string | null;         // from hook.targetDebateIdForLink(linkId)
  accessState: CallbackEchoAccessState;  // from the QOL-042 chip.accessState
  title: string;                         // chip.title (live-or-snapshot / '' unavailable)
}

/** Derive one echo VM for a move. Pure, deterministic. Returns null when not a callback. */
export function deriveCallbackEcho(input: {
  messageId: string;
  ref: PersistedCallbackRef | null;      // adapter-extracted from the move's JSONB
  link: ResolvedPriorLink | null;        // resolved link for ref.linkId, or null
}): CallbackEchoViewModel | null;

/** Batch: build the per-message echo map ONCE for the room. Pure. */
export function buildCallbackEchoesByMessageId(input: {
  moves: ReadonlyArray<{ messageId: string; ref: PersistedCallbackRef | null }>;
  linksById: ReadonlyMap<string, ResolvedPriorLink>;
}): Record<string, CallbackEchoViewModel>;   // only callback moves get an entry

/** Adapter: normalize the persisted JSONB block into a PersistedCallbackRef | null. */
export function readCallbackRef(serverValidation: unknown, clientValidation: unknown): PersistedCallbackRef | null;
```

Derivation rules (all pure, no `Date.now()`, no network, no AI):

- `ref` absent / not an object / `linkId` missing → `null` (not a callback).
- `link` unresolved (no entry for `ref.linkId`) → `accessState = 'unavailable'`,
  `originTitle = ''`, `echoedExcerpt = ''`, `isLocked = false`, `canOpenOrigin = false`,
  `originLine = CALLBACK_ECHO_COPY.unavailable`.
- `link.accessState === 'unavailable'` → same as above.
- `link.accessState === 'title_only'` → `originTitle = link.title` (snapshot title),
  `echoedExcerpt = ''` (**privacy gate**), `isLocked = true`, `canOpenOrigin = false`,
  `originLine = CALLBACK_ECHO_COPY.lockedOrigin(link.title)`.
- `link.accessState === 'authorized'` → `originTitle = link.title`,
  `echoedExcerpt = clamp(ref.echoedExcerpt, 280)`, `isLocked = false`,
  `canOpenOrigin = link.targetDebateId != null`,
  `originLine = CALLBACK_ECHO_COPY.origin(link.title)`.

### New copy — `src/features/arguments/crossRoom/callbackEchoCopy.ts`

```ts
export const CALLBACK_ECHO_COPY = Object.freeze({
  identityLabel: 'Woven callback',
  origin: (title: string) => `Callback to “${title}”`,
  lockedOrigin: (title: string) => `Callback to “${title}”`,
  lockLine: 'Private — only its participants can open it. You can see the title here as context.',
  unavailable: 'Linked prior argument is no longer available.',
  openOriginA11yHint: 'Opens the settled prior argument, read-only.',
  lockedA11yHint: 'This prior argument is private. You are not a participant on it.',
});
```

Ban-list reused from QOL-042: `_forbiddenLinkedPriorTokens()`
(`crossRoom/linkedPriorArgumentCopy.ts`). "callback" / "echo" / "woven" / "from" /
"prior" carry no verdict or amplification meaning.

### New presentational — `src/features/arguments/crossRoom/CallbackEchoStrip.tsx`

```ts
interface Props {
  echo: CallbackEchoViewModel;
  /** Open the prior room. Reuses the QOL-042 nav channel (targetDebateId). */
  onOpenOrigin?: (targetDebateId: string) => void;
  /** 'strip' (Stack / Ringside / popover — full quote strip + origin) | 'badge' (unused; NodeDot renders its own). */
  variant?: 'strip';
}
```

Renders (RN primitives only, no new dep): a `⤴` glyph (the **same** glyph
`LinkedPriorArgumentChipRow` uses, so the two read as one family) + identity label +
(authorized only) a left-double-bordered quote strip with the echoed line + the origin
line (`🔒` prefix when `isLocked`). When `canOpenOrigin`, the origin line is a
`<Pressable accessibilityRole="button">` with `hitSlop` to 44×44; otherwise plain
`<Text>` with the lock reason as `accessibilityHint`.

### Timeline node — additive prop on `ArgumentTimelineMap`

```ts
// New optional prop, mirroring artifactsByMessageId (EV-002):
callbackEchoByMessageId?: Record<string, CallbackEchoViewModel>;
```

`NodeDot` receives `callbackEcho={callbackEchoByMessageId?.[n.messageId] ?? null}` and,
when present, renders a small corner **echo badge** (the `⤴` glyph in a bordered pill —
color-independent) and appends the echo's short a11y fragment (`", callback to a prior
argument"` / `", callback to a private prior argument"`) to the node's
`accessibilityLabel`. The tiny node shows the badge only; the full quote strip lives in
the node popover / sidecar and on the larger Stack / Ringside cards. The badge is
strength-independent: it never reads `standingBand` / `toneBand` / `heat`.

### Ringside — injected join on `buildRingsideFeed`

Mirror `proofChipCountFor` (ROOM-002 pattern): add
`callbackEchoFor?: (messageId: string) => CallbackEchoViewModel | null` to
`RingsideFeedInput`, and `callbackEcho: CallbackEchoViewModel | null` to
`RingsideCardViewModel`. `RingsideCard.tsx` renders `<CallbackEchoStrip>` in the
existing chip region (near `quoteChip` / the proof-chip row, ~L166/L236).

### Nav — reuse, no new machinery

Tapping an authorized echo calls `onOpenOrigin(targetDebateId)` wired to the existing
`onOpenPriorRoom(targetDebateId)` (App.tsx `handleOpenPriorRoom` →
`resolveRoomDeepLinkAccess` + `selectDebate`, App.tsx:751). This is the **same**
access-guarded room-open QUOTE-FORGE-001 uses (it maps `linkId → targetDebateId` via
`hook.targetDebateIdForLink`; the echo VM already carries `targetDebateId`, so it calls
the handler directly). `title_only` / `unavailable` echoes are non-tappable — matching
the chip's disabled-Open behavior. Move-level deep-link to the exact prior node
(`targetArgumentId`) is **out of scope** (nav is room-level today — see Gaps).

---

## File changes

New:

- `src/features/arguments/crossRoom/callbackEchoModel.ts` — types + `deriveCallbackEcho`
  + `buildCallbackEchoesByMessageId` + `readCallbackRef` adapter. Pure TS. ~190 lines.
- `src/features/arguments/crossRoom/callbackEchoCopy.ts` — `CALLBACK_ECHO_COPY` + reuse
  QOL-042 ban-list. ~55 lines.
- `src/features/arguments/crossRoom/CallbackEchoStrip.tsx` — presentational strip
  (Stack / Ringside / popover). RN primitives. ~140 lines.

Modified (render side — this card):

- `src/features/arguments/ArgumentTimelineMap.tsx` — add `callbackEchoByMessageId` prop;
  thread to `NodeDot`; render the corner echo badge; append a11y fragment. Additive.
  ~40 lines. (File is relaxed from the zero-diff boundary — operator-authorized
  2026-06-15 — so additive presentational edits are permitted **with justification**;
  the load-bearing `buildArgumentTimelineMap` contract is untouched.)
- `src/features/arguments/ArgumentBubbleStack.tsx` — render `<CallbackEchoStrip>` on the
  active card. Additive. ~20 lines. (Not pinned.)
- `src/features/arguments/room/RingsideCard.tsx` — render `<CallbackEchoStrip>` in the
  chip region. Additive. ~20 lines.
- `src/features/arguments/room/ringsideFeedModel.ts` — add `callbackEchoFor` join +
  `callbackEcho` VM field. Additive. ~12 lines.
- Room shell(s) that already build `artifactsByMessageId` and hold `useLinkedPriorRooms`
  — `src/features/arguments/room/ArgumentRoom.tsx` (+ `MapView.tsx`) and/or
  `ArgumentTreeScreen.tsx`: build `callbackEchoByMessageId` ONCE (assemble
  `linksById` from `useLinkedPriorRooms` chips + `targetDebateIdForLink`, read each
  move's ref via `readCallbackRef`), thread the map + `callbackEchoFor` to the three
  surfaces, gate on the feature flag. ~50–70 lines total across shells. (Mirror the
  `argumentGameSurfaceEvidence.ts` / `artifactsByMessageId` threading exactly.)

Shared seam with #831 (added ONCE — see reconciliation):

- `src/lib/featureFlags.ts` — register a new default-OFF ASP flag `quote_forge`
  (static `process.env.EXPO_PUBLIC_QUOTE_FORGE` read; the eighth/ninth hard-coded
  literal — never a computed key, per `featureFlagsStaticEnv.test.ts`).
- `App.tsx` — one accessor read; prop-thread `quoteForgeEnabled` to the room shells
  exactly like `proofDrawerEnabled` / `moveMarksEnabled`.

Deleted: none.

---

## Edge cases

- **Not a callback (negative control):** move with no ref → deriver returns `null` →
  ordinary reply, zero echo chrome. Must be a firing negative control in tests.
- **Malformed ref:** `ref` present but `linkId` missing / not a string / not an object
  → `null`. No throw.
- **Ref present, link unresolved** (link soft-removed, or `loadPriorRoomContext`
  failed): `accessState = 'unavailable'` → neutral origin line, no excerpt, no tap.
- **`title_only` (inaccessible prior room):** `echoedExcerpt = ''` — the echoed prior
  line is **never** emitted; only the locked origin line (snapshot title). This is the
  privacy invariant with a dedicated test (below).
- **`unavailable`:** neutral "no longer available" line; no title, no excerpt, no tap.
- **Feature flag off:** the room shell threads no echo map → every callback move renders
  as an ordinary reply (body intact). Graceful degradation; no content is ever hidden,
  only the echo chrome.
- **Callback to a room the author later loses access to / that gets deleted:** access is
  re-resolved on every load via `loadPriorRoomContext` (the QOL-042 hook) → degrades to
  `title_only` / `unavailable` automatically; the render follows.
- **Multiple callbacks to the same prior room:** each move has its own ref (per-move
  grain); all share one `ResolvedPriorLink` (one access resolution — reuse). Correct.
- **Reduce motion:** the echo is static chrome (glyph + strip + text); nothing to
  disable. No animation added.
- **Own callback move:** self-authored callback still renders the echo (it's a link
  identity, not a score/flag) — consistent with own-bubble control doctrine (own bubbles
  hide edit/disagree/flag/score, but the echo is content chrome, not a control).
- **Empty / whitespace echoedExcerpt in authorized:** treat as no quote strip (render
  origin line only); do not render an empty bordered strip.

---

## Test plan

Pure-model + render tests. Real-derivation assertions run the **production**
`buildCallbackEchoesByMessageId` / `deriveCallbackEcho` (not fixture echoes of the
expected output). No wall-clock `toBeLessThan(ms)` budget assertions anywhere (avoids
the LIFE-001 / META-001 full-suite flake class — `pointLifecycleModel.test.ts` /
`moveMetadataLedger.test.ts`).

- `__tests__/callbackEchoModel.test.ts`
  - happy path: authorized ref → VM with `echoedExcerpt` populated, `canOpenOrigin`,
    `originLine = "Callback to …"`.
  - **firing negative control:** move with `ref = null` → `deriveCallbackEcho` returns
    `null`; `buildCallbackEchoesByMessageId` has **no** entry for it (assert the map key
    is absent, not just falsy).
  - malformed ref (`{}`, `{ linkId: 3 }`, non-object) → `null`, no throw.
  - **inaccessible / `title_only` arm (privacy invariant):** authorized-looking ref but
    `link.accessState = 'title_only'` → `echoedExcerpt === ''`, `isLocked === true`,
    `canOpenOrigin === false`, `originLine` is the locked line. Assert the produced VM
    (and its `accessibilityLabel`) contains **none** of the prior excerpt substring.
  - `unavailable` + unresolved-link arms.
  - determinism: same input → deep-equal output across two builds.
  - reuse: two callback moves to the same `linkId` produce two VMs from one
    `ResolvedPriorLink` (single access resolution).
- `__tests__/callbackEchoCopy.test.ts`
  - ban-list scan (`_forbiddenLinkedPriorTokens`) over every `CALLBACK_ECHO_COPY` string
    and over `origin(title)` / `lockedOrigin(title)` with a benign title.
  - no snake_case / internal-code leak.
- `__tests__/callbackEchoStrip.test.tsx` (RTL / JSDOM)
  - authorized: renders glyph + quote strip + tappable origin; fires `onOpenOrigin`
    with `targetDebateId`.
  - `title_only`: renders the locked origin line, **does not render the quote strip**,
    origin is not a button; assert the prior excerpt string is absent from the tree.
  - `unavailable`: neutral line only.
  - a11y: role `button` + label + `hitSlop`/44×44 on the tappable origin; color is not
    the only signal (glyph + text present with color tokens neutralized — grayscale
    legibility).
- `__tests__/quoteForge002TimelineBadge.test.tsx` (or extend an existing timeline render
  test) — NodeDot renders the echo badge when `callbackEchoByMessageId[id]` is present;
  renders nothing when absent; the node `accessibilityLabel` gains the callback fragment
  and never gains it for a plain node.
- `__tests__/ringsideFeedModel.test.ts` (extend) — `callbackEchoFor` join populates
  `card.callbackEcho`; absent join → `null`; no other card field changes.
- **Contract preservation:** run `__tests__/argumentTimelineMap.test.ts` unchanged — all
  existing `buildArgumentTimelineMap` chronology / edge / lane / band / a11y assertions
  still pass (the new prop is additive; the model is untouched). Confirm the boundary
  suite `__tests__/uxOneOneFiveReadOnlyBoundary.test.ts` still passes (composer / oneBox
  pins are not touched by this card).
- **Flag static-env guard:** extend `__tests__/featureFlagsStaticEnv.test.ts` for the new
  `EXPO_PUBLIC_QUOTE_FORGE` static literal (only if this card owns the flag registration
  — see reconciliation).

---

## Dependencies (cards / docs / files)

- **Hard dependency on UX-COMPOSER-005 #831** for the per-move persisted callback
  reference (`PersistedCallbackRef`). Without it, a callback move is indistinguishable
  from a plain reply after reload and this card cannot meet its acceptance criterion.
  The two are an atomic pair on one flag.
- Assumes **QUOTE-FORGE-001 (#861) is complete** — reuses `useLinkedPriorRooms`,
  `buildLinkedPriorArgumentChip` (access state + title), `linkedPriorArgumentCopy`
  (ban-list, lock-line phrasing), and the `onOpenPriorRoom` nav channel.
- Reads `submit-argument`'s `server_validation` (or `client_validation`) JSONB round-trip
  (`argumentsApi.ts` select at L140; `types.ts` `ArgumentRow.serverValidation`).
- Mirrors the evidence threading precedent
  (`argumentGameSurfaceEvidence.ts` → `artifactsByMessageId`) and the ROOM-002 Ringside
  injected-join pattern.
- Reuses the `⤴` glyph + three-state grammar from `LinkedPriorArgumentChipRow`.

---

## Risks

- **Persistence-seam divergence (top risk):** if #831 persists the reference in a shape
  other than `PersistedCallbackRef` (different keys, different JSONB block, or embeds the
  excerpt in `body`), the `readCallbackRef` adapter must be reconciled. Isolate all
  coupling in that single adapter so a mismatch is a one-file fix. **If #831 embeds the
  echoed excerpt directly into the move `body`, the access gate cannot suppress it** —
  the body renders verbatim to `title_only` viewers, defeating the privacy invariant.
  Strongly recommend #831 keep the excerpt as a **separate snapshot field**, not inline
  in `body` (reconciliation item #2).
- **`ArgumentTimelineMap.tsx` is relaxed but contract-pinned:** keep edits additive and
  presentational; do not touch `buildArgumentTimelineMap`. Re-run
  `argumentTimelineMap.test.ts` to prove the contract holds.
- **Flag static-env web-bundle trap:** the new flag MUST be a static
  `process.env.EXPO_PUBLIC_QUOTE_FORGE` dot read (never computed) or it silently forces
  OFF in the Netlify bundle while jest stays green (the #776 class;
  `featureFlagsStaticEnv.test.ts`).
- **Two shells:** the echo map must be threaded in BOTH the legacy shell path
  (`ArgumentTreeScreen`) and the room_exchange_v2 shell (`ArgumentRoom` / `MapView`) so
  the Timeline echo appears regardless of surface; Ringside echo additionally requires
  room_exchange_v2 (Ringside only mounts then). Missing one shell = echo silently absent
  there.
- **Grayscale legibility:** the badge is a glyph in a bordered pill; verify it reads
  without its color token (grayscale snapshot) so identity is not color-only.

---

## Out of scope

- The composer-side insert, draft echo, and submit wiring (**UX-COMPOSER-005 #831**) —
  including how the reference is captured/persisted. This card only *reads* it.
- The "Echo landed" celebration / micro-animation (**QUOTE-FORGE-004**). No confetti,
  no celebratory motion — the treatment stays neutral (§9).
- Reverse back-reference display ("called back 3×"), callback *search*, callback
  anniversaries (later QUOTE-FORGE / MEMORY-LANE cards; search also collides with the
  v1 "no argument search" non-goal).
- Move-level deep-link into the exact prior node (`targetArgumentId`) — nav is room-level
  today; captured for the future, not wired here (see Gaps).
- Any migration / new column / Edge Function change.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels):** the echo is a LINK identity ("Woven
  callback" / "Callback to …"); it never says the prior argument was correct / won /
  proved. Copy is ban-list-scanned. Score is never touched; the echo never blocks
  posting (render-only). ✔
- **§2 (heat ≠ truth) / §3 (popularity ≠ evidence):** the echo reads no `heat`,
  `toneBand`, `standingBand`, engagement, or count — it is strength-independent. ✔
- **§4 (AI limits):** no AI anywhere; pure deriver + render. ✔
- **§6 (secrets) / §7 (no AI from prod):** no keys, no provider calls, no service-role;
  reads under the caller's JWT via the existing QOL-042 hook (RLS-enforced). ✔
- **§8 (Supabase conventions):** no migration, no RLS change; access is the RLS-derived
  three-state model from QOL-042, unchanged. ✔
- **§9 (plain language):** every user string is in `CALLBACK_ECHO_COPY`; no internal
  code reaches the UI. ✔
- **timeline-grammar (visuals never drift to truth):** the callback is a **new node
  decoration carrying the LINK signal** (not type / strength / heat / selection). Its
  encoding is glyph + bordered strip + text (color-independent, verified grayscale). It
  does not alter the existing shape/stroke/strength mapping. Skill token table gains a
  "callback echo" decoration note (permanent addition). ✔
- **accessibility-targets:** tappable origin is a `Pressable` with role/label/state +
  44×44 hitSlop; badge/strip are color-independent; a11y label is verbose and
  verdict-free; reduce-motion N/A (static). ✔
- **Privacy (card requirement):** `title_only` / `unavailable` never emit the prior
  excerpt or any prior body — the deriver forces `echoedExcerpt = ''` off the authorized
  path; a dedicated test asserts the prior text is absent from the VM and the rendered
  tree. ✔

---

## Operator steps (if any)

None from this card as a pure code change. The **feature-flag flip is operator-gated**:
after the pair (#831 + #842) merges, the operator sets
`EXPO_PUBLIC_QUOTE_FORGE=true` (Netlify env, like the other ASP flags) to roll out
callback weave — and can flip it off as a kill switch. No `db push`, no
`functions deploy` from this card. (If #831's submit wiring is a `submit-argument` Edge
change, its own design owns that deploy step.)

---

## Shared-seam reconciliation list (orchestrator — #831 ⇄ #842)

1. **Per-move persistence shape + location (blocking).** #842 reads
   `PersistedCallbackRef { linkId, echoedExcerpt, targetArgumentId? }` via one
   `readCallbackRef` adapter. #831 must persist at minimum `linkId` + `echoedExcerpt`
   into an existing JSONB column (recommended `server_validation.crossRoomCallback`, the
   QOL-037 `evidenceResponse` precedent — advisory, non-blocking, no migration). Agree
   the exact keys + block so the adapter matches.
2. **Excerpt not inline in `body`.** #831 should persist the echoed excerpt as a separate
   snapshot field, NOT concatenated into the move `body`, or #842's access gate cannot
   suppress it for `title_only` viewers (privacy invariant). If #831 must inline it,
   escalate — the privacy contract changes.
3. **Shared feature flag (single unit).** Both cards ride ONE flag. Recommendation:
   a NEW default-OFF `quote_forge` (see Flag recommendation). Decide **which card
   registers it** in `featureFlags.ts` + `featureFlagsStaticEnv.test.ts` (recommend the
   first-merged card, or a tiny shared precursor) so the two don't both edit the registry
   and collide.
4. **`linkId` availability at submit.** #831 has the `linkId` after `createArgumentRoomLink`
   (or the idempotent duplicate return). Confirm it threads that id into the persisted
   ref (the join key #842 depends on).
5. **Nav channel.** Both reuse `onOpenPriorRoom(targetDebateId)` (App.tsx:751) — no new
   nav. #842's echo tap needs `targetDebateId`, resolved from `linkId` via the
   `useLinkedPriorRooms` mapping already in the shells.

---

## Gaps needing an orchestrator ruling

- **Move-level deep-link:** nav opens the prior ROOM, not the exact prior node. Capturing
  `targetArgumentId` is cheap now; wiring a node-level deep-link is a separate affordance
  (no prior-room node-scroll entry point exists today). Confirm room-level open is
  acceptable for v1 (recommended) and defer node-level to a later card.
- **Own-move echo visibility:** confirmed-safe (echo is content chrome, not a score/flag)
  but flag if product wants own callbacks visually quieter.
- **Ringside gating:** Ringside echo requires room_exchange_v2 AND quote_forge; Timeline /
  Stack echo requires quote_forge only. Confirm this per-surface gating is intended
  (natural given each surface's existing mount gate).

---

## Orchestrator reconciliation addendum (implementation — feat/quote-callback-pair)

Recorded at implementation time (roadmap-implementer). The design body above is the
spec; where a design assumption conflicts with the binding orchestrator rulings below,
**the rulings win**. This addendum is identical on both `QUOTE-FORGE-002.md` (#842, render
side) and `UX-COMPOSER-005.md` (#831, composer side) so the pair reads as one contract.

- **R1 — Persisted ref home.** The per-move callback ref lives at
  `arguments.client_validation.crossRoomCallback` (namespaced key on the existing
  permissive passthrough). This card's original `server_validation` recommendation is
  **overruled** — `server_validation` is Edge-owned and `submit-argument` stays
  byte-preserved. The excerpt is a **separate field** in that block, never woven into
  `body`. `readCallbackRef` reads `client_validation` only (server blob ignored) and
  delegates the shape validation to the shared `crossRoom/crossRoomCallbackRef.ts`
  (`readCrossRoomCallback`) authored by #831, so the read/write shapes cannot drift.
- **R2 — Join key `targetDebateId`, not `linkId`.** The ref carries `targetDebateId`; the
  resolved-link lookup this card builds is keyed by `targetDebateId` (one QOL-042 link per
  target room, so equivalent to a `linkId` join). `capturedFromArgumentId`/`targetArgumentId`
  is captured for a future move-level deep-link but nav stays room-level via the shipped
  `onOpenPriorRoom(targetDebateId)`.
- **R3 — Privacy framing is UX-consistency, not RLS.** The excerpt sits in a broadly-readable
  JSONB column; the deriver forcing `echoedExcerpt = ''` for `title_only` / `unavailable`
  is a UX-consistency render treatment per the acceptance criterion, documented in code + docs
  as **NOT** an RLS / privacy boundary — a `title_only` viewer's network response still
  contains the excerpt bytes; the client simply does not render them. No copy promises
  secrecy of the excerpt. A ref present with **no matching link row** renders the
  locked / unavailable arm — never an excerpt without an authorized access state resolved
  from `useLinkedPriorRooms`.
- **R4 — Shared 9th default-OFF flag `quote_forge`** (`EXPO_PUBLIC_QUOTE_FORGE`), registered
  by #831 (write side) in `featureFlags.ts` + `featureFlagsStaticEnv.test.ts`; this card
  consumes the accessor via App.tsx prop-threading only (zero `featureFlags` imports under
  `src/features`). Flag-off ⇒ byte-identical surfaces (no echo chrome). Ringside echo mounts
  only where Ringside mounts (`room_exchange_v2`) AND `quote_forge` on; Timeline / Stack echo
  require `quote_forge` only.
- **R5–R7** — minimal capture (no span-select / no search), link created post-submit-success
  (idempotent, degrade on failure per R3), excerpt snapshot persists with no redaction
  machinery, own-authored callbacks render identically.

**Implementation-topology adaptation (recorded honestly).** `callbackEchoByMessageId` is
derived **ONCE** in `ArgumentTreeScreen.FullRoomGameSurfaceMount` — the single shell owning
BOTH the per-move refs (`rows[].clientValidation`, read via `readCallbackRef`) AND the
resolved QOL-042 links (`useLinkedPriorRooms.chips` + `targetDebateIdForLink`) — and threaded
down through `ArgumentGameSurface`/`ArgumentRoom` to the Timeline map, Stack, and Ringside
feed. The design recommended building it in `ArgumentRoom.tsx`; that component lacks the
`useLinkedPriorRooms` handles and the raw `clientValidation`, so `FullRoomGameSurfaceMount`
is the correct single-derivation site (still derived once, threaded to all three surfaces).
`ArgumentTimelineMap.tsx` edits are additive presentational only (the file is relaxed from
zero-diff but contract-pinned by `argumentTimelineMap.test.ts`); `buildArgumentTimelineMap`
is untouched.
