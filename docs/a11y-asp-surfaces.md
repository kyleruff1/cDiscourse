# A11Y-693 — Argument Surface Pivot accessibility floor

**Card:** A11Y-693 (#693) — a11y + reduce-motion across the ASP surfaces, plus the
folded amendment **UX-BOARD-A11Y-AXIS-001** (board-axis color-independence guard).
**Design:** `docs/designs/A11Y-693-ASP.md` (authoritative).
**Scope:** UI-conformance + regression guards. No migration, no Edge Function, no
service-role, no AI call, no new dependency, no new feature flag.

This is the standing record of the accessibility contract for the Argument
Surface Pivot (ASP) surfaces and the mediator board. It exists so the coverage
map stays honest and a future edit that drops an attribute fails a test rather
than shipping a regression.

The contract is the project `accessibility-targets` skill: color is never the
only signal (shape / glyph / label / geometry carry meaning); no red/green
verdict pairing; every interactive element carries role + label (+ state where a
boolean applies) and a >= 44x44 target; reduce-motion degrades non-essential
motion to static; screen-reader labels describe the move / state, never a person,
and "unknown" reads as unknown.

---

## Audit matrix

Legend: **GREEN** = verified compliant (no code change); **FIXED** = a real gap
closed by this card; **N/A** = no interactive element / no animation (delegated
or static-by-construction). Cells key: 1 labels/roles · 2 keyboard reachability ·
3 color-independence · 4 touch targets >= 44 · 5 motion / reduce-motion.

| Surface (flag) | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| ProofDrawer (`proof_drawer` OFF) | GREEN | GREEN | **FIXED** | GREEN | N/A |
| ProofChip (`proof_drawer` OFF) | N/A delegated | N/A | N/A | N/A | N/A passthrough |
| BooleanFeedbackBar (`move_marks` OFF) | GREEN | GREEN | GREEN | GREEN | N/A |
| ArgumentStateRail (`room_exchange_v2` LIVE) | **FIXED** | GREEN | GREEN | GREEN | GREEN |
| ExchangeView (`room_exchange_v2` LIVE) | N/A passthrough | N/A | N/A | N/A | GREEN |
| RingsideFeed (`room_exchange_v2` LIVE) | N/A container | N/A | N/A | N/A | GREEN |
| RingsideCard (`room_exchange_v2` LIVE) | **FIXED** | GREEN | GREEN | GREEN | N/A |
| TimestampMarker (`timestamp_rebuttals` OFF) | GREEN | GREEN | GREEN | GREEN | N/A |
| MarkerPhrasePickerSheet (`timestamp_rebuttals` OFF) | GREEN | GREEN | GREEN | GREEN | N/A |
| CallbackEchoStrip (`quote_forge` OFF) | GREEN | GREEN | GREEN | GREEN | N/A |
| CallbackCaptureSheet (`quote_forge` OFF) | GREEN | GREEN | GREEN | GREEN | GREEN |
| CallbackDraftEcho (`quote_forge` OFF) | GREEN | GREEN | GREEN | GREEN | N/A |
| PointFeedbackFlagPill (#907) | GREEN | GREEN | GREEN | GREEN | N/A |
| PointFeedbackFlagsRow (#907) | GREEN | GREEN | GREEN | GREEN | N/A |
| MediatorNodeMarker (amendment) | GREEN | N/A | GREEN | N/A | N/A |
| DisagreementPointsRail (amendment) | GREEN | GREEN | GREEN | GREEN | GREEN |

The matrix is pinned by `__tests__/a11y693AspSurfaceAudit.test.ts` (source-scan
over the 14 ASP surface files x the 6-viewport grid) and the render guards in
`__tests__/a11y693GapFixes.test.tsx` and
`__tests__/a11y693MediatorBoardAxisGuard.test.tsx`.

### The four gaps closed

1. **RingsideCard root Pressable** — now `accessible={false}` so the nested
   controls (quote chip, action chips, feedback bar) stay individually focusable
   under iOS VoiceOver; the root still activates on tap. LIVE surface → shipped
   unflagged (a conformance correction, not a feature).
2. **RingsideCard quote chip** — now carries `accessibilityState={{ disabled }}`
   when there is no parent to jump to. LIVE → unflagged.
3. **ArgumentStateRail** — the non-pressable info-chip View and the overflow
   badge View now announce as static text (`accessibilityRole="text"`). LIVE →
   unflagged.
4. **ProofDrawer** — the selected prior-move now carries a non-color signal (a
   check affix + a thicker border) so selection reads in grayscale; the affix is
   visual-only and never leaks into the accessibility label. OFF flag → the fix
   rides `proof_drawer`, invisible until the flag flips.

---

## Board color-independence rule (amendment UX-BOARD-A11Y-AXIS-001)

The mediator board is the highest-risk, easiest-to-regress color-independence
surface, so its already-green reality is locked against regression:

- **Every live display state is a text label**, never a color. The 11 live v4
  display states (`ALL_V4_MEDIATOR_STATE_CODES`) each render a paired visible
  `<Text>` badge plus a non-empty `accessibilityLabel` on both
  `MediatorNodeMarker` and `DisagreementPointsRail`. A terminal
  `resolved_or_settled` point renders no badge (correct suppression), not an
  empty one.
- **The disagreement axis is never a colored dot.** `DisagreementPointKind` (the
  9 axes `fact | definition | scope | causal | value | evidence | logic |
  recollection | unaxed`) is a data field, not a rendered mark. Neither mediator
  surface binds a color to `point.kind`; the #679 oklch axis palette never
  shipped on these surfaces. Changing a point's axis adds no element and no color
  to the rendered tree.
- **No red/green verdict pairing.** The mediator emphasis palette is the neutral
  `SURFACE_TOKENS` set plus the single indigo `SURFACE_TOKENS.focusRing`
  (impasse emphasis). No `STATUS.danger` / `STATUS.success`, no saturated
  red/green hex — asserted at the source AND over the rendered palette.
- **Selection is geometry, not color.** The active row uses a left accent bar +
  bold + a "Currently active" word; the distribution and legend carry counts +
  text, never a magnitude/heat bar.

This is guarded by `__tests__/a11y693MediatorBoardAxisGuard.test.tsx`, which
asserts over the REAL vocabularies, includes a firing negative control
(`assertStateChipLabeled` throws on a colored-but-unlabeled chip), and stays
ban-list clean over `_forbiddenMediatorTokens()`.

---

## Reduce-motion floor

The ASP set is overwhelmingly static-by-construction. Every surface that
genuinely animates already gates its motion on reduce-motion:

- **DisagreementPointsRail** — the sheet slide (`Animated.timing`) snaps when
  reduce-motion is on.
- **CallbackCaptureSheet** — the Modal `animationType` is `'none'` under
  reduce-motion.
- **SourceChainPopover** (reached via ProofChip) — the
  `LayoutAnimation.configureNext` expand is skipped under reduce-motion.

The shared primitive is `src/features/preferences/useReduceMotion.ts`:

```ts
export function useReduceMotion(reduceMotionOverride?: boolean): boolean;
```

- A boolean `reduceMotionOverride` wins in both directions (a test seam + a
  parent-threaded value).
- Otherwise the live OS `AccessibilityInfo` value, subscribed to
  `reduceMotionChanged`.
- Default-safe: `false` until the async read resolves; `false` when the API
  rejects or is unavailable (web shim / jest). The default stays `false` to match
  every prior inline copy byte-for-byte (flipping it to `true` would flash
  static-then-animate on mount).

**Maintenance rule:** any NEW ASP motion must consult `useReduceMotion` (or accept
a threaded `reduceMotion` prop / read `AccessibilityInfo`). The audit test fails
any ASP surface that imports an animator (`Animated` / `LayoutAnimation` /
`reanimated` / a Modal `animationType`) without referencing a reduce-motion gate.
The `useReduceMotion` adoption is guarded by
`__tests__/a11y693ReduceMotionPrimitive.test.tsx`. Migrating the other ~6 files
that still hand-roll the inline effect (OpenIssuesRail, ArgumentTimelineMap,
ArgumentComposerDock, ArgumentSideActionRail, Popout, useUserPreferences) is a
separate dedupe card.

---

## Focus-visibility posture

The OFF-flag surfaces (TimestampMarker, MarkerPhrasePickerSheet, the Callback\*
family) render no explicit token `FOCUS_RING` on web. This is NOT a hard gap:
there is no global `outlineStyle:'none'` reset in `src`, so RN Web's
browser-default focus ring is not suppressed — every focusable Pressable already
shows a visible, distinct-from-hover focus indicator. Adopting the explicit
`FOCUS_RING` token (as `feedbackFlags` did) is a consistency enhancement, left as
optional polish; it must not expand into a churn refactor of shipped files.

---

## Deferred rows — BLOCKED ON #863 (VOICE-ADR-002)

Two re-scope surfaces are voice surfaces that **do not exist** and are blocked on
#863 (VOICE-ADR-002, operator D1-D8). Per the QA-001 BLOCKED-ON-#863 precedent
they are documented rows only, not audited cells:

| Deferred surface | Status |
|---|---|
| **playback gate** | Voice surface — not built. BLOCKED ON #863. |
| **recorder** | Voice surface — not built. BLOCKED ON #863. |

**Deferred-row maintenance rule:** these two rows **activate** (become real audit
rows with fixes + guards, added to `ASP_INTERACTIVE_FILES` in the audit test and
to the matrix above) only when #863 clears and the voice surfaces land. Until then
no code exists to audit; the rows exist so the coverage map is honest, not
silently missing.

---

## Files

- Hook: `src/features/preferences/useReduceMotion.ts`
- Gap fixes: `src/features/arguments/room/RingsideCard.tsx`,
  `src/features/arguments/room/ArgumentStateRail.tsx`,
  `src/features/proof/ProofDrawer.tsx`
- Hook adoption: `src/features/mediator/DisagreementPointsRail.tsx`
- Guards: `__tests__/a11y693AspSurfaceAudit.test.ts`,
  `__tests__/a11y693GapFixes.test.tsx`,
  `__tests__/a11y693ReduceMotionPrimitive.test.tsx`,
  `__tests__/a11y693MediatorBoardAxisGuard.test.tsx`

---

## A11Y-PR0 (#913) — overlay keyboard grammar (web-only)

Where A11Y-693 fixed the ASP surface floor (labels / color-independence /
reduce-motion), A11Y-PR0 adds the **overlay keyboard grammar** the live RN-web
platform was missing: programmatic focus management, Tab containment, focus
restore, and single-Escape arbitration. It changes no overlay content and no
room / seat / submission semantics; every primitive is `Platform.OS === 'web'`
guarded and is a stable no-op on native (VoiceOver / TalkBack use the rotor,
not Tab — a pinned invariant proved by a test). Design: `docs/designs/A11Y-PR0.md`.

**The web-only layer** (`src/features/a11y/`):

- `overlayFocusTrapModel.ts` — pure Tab-trap resolver + `FOCUSABLE_SELECTOR`.
- `overlayLayerStack.ts` — pure LIFO reducer + module singleton; the single
  arbiter of which layer owns Escape and the Tab trap.
- `useOverlayA11y.ts` — the web-only hook (capture trigger, register layer,
  initial focus, Tab trap, topmost-gated Escape, focus restore); native no-op.

**Adopters** (Option B — util + 5 overlays; `AddAnnotationSheet` + native SR
verification deferred to `A11Y-PR0-FOLLOW`):

| Surface | Focus trap | Escape ownership | Containment |
|---|---|---|---|
| `oneBox/Popout.tsx` | hook | inline Escape effect, topmost-gated (`manageEsc:false`) | Modal chassis |
| `ArgumentComposerDock.tsx` | hook | composer keydown handler guarded by `if (!isTopmost()) return;` (`manageEsc:false`) | Modal chassis |
| `PreSendReviewSheet.tsx` | hook | hook (`onDismiss: onBackToEditing`) | inline; inert scrim preserved |
| `markers/MarkerPhrasePickerSheet.tsx` | hook | hook (`onDismiss: onCancel`) | inline + web-only dismissing backdrop |
| `requestReview/RequestReviewComposer.tsx` | hook | hook (`onDismiss: onCancel`) | inline + web-only dismissing backdrop |

Marker / Request use the **additive** path (web-only backdrop + hook Escape, no
RN Modal-wrap) per the orchestrator ruling; native hardware-back parity for the
two is part of `A11Y-PR0-FOLLOW`. The pure `composerKeyboardModel` is untouched:
the dock gates at its handler via the shared stack, not by threading an
`overlayOpen` boolean into the pure model.

Room background suppression (`P0-3d`): `room/roomOpenMenuModel.ts`
(`computeRoomHasOpenMenu`) folds the marker + request sheets into the single
`hasOpenMenu` the board / stack keydown handlers read. Corridor nav (`P0-3c`):
`navigation/appPrimaryNavModel.ts` `PrimaryNavTransition.clearDemoCorridor`;
`App.tsx` `handlePrimaryNav` + the secondary tab-bar `onPress` clear the demo
corridor (the only paths that reach the account / admin / debug tabs), so it can
never co-render.

**Jest-provable vs RUNTIME-CHECK.** jsdom does not perform sequential focus
navigation or render a real portal, so the automated gate proves the pure models
plus the hook handler CALLS (`.focus()` / `preventDefault()` on the right node),
topmost gating, single-Escape arbitration, containment, and the native no-op
proof. The visual Tab-behind-modal cycle, the single-Escape visual dismissal,
the corridor co-render, and dock-scrim focusability are **RUNTIME-CHECK-only**
(operator smoke on dev-cdiscourse.netlify.app; see the design doc). Flag posture:
**UNFLAGGED** (a conformance fix on live surfaces).

### A11Y-PR0 files

- New: `src/features/a11y/{overlayFocusTrapModel,overlayLayerStack,useOverlayA11y,index}.ts`,
  `src/features/arguments/room/roomOpenMenuModel.ts`.
- Adopters: `oneBox/Popout.tsx`, `ArgumentComposerDock.tsx`, `PreSendReviewSheet.tsx`,
  `markers/MarkerPhrasePickerSheet.tsx`, `requestReview/RequestReviewComposer.tsx`,
  `room/ArgumentRoom.tsx`, `App.tsx`, `navigation/appPrimaryNavModel.ts`.
- Boundary: `__tests__/uxOneOneFiveReadOnlyBoundary.test.ts` relaxes Popout + Dock
  (NOTE blocks citing #913; companion pins `oneBoxPopoutChassis.test.tsx` /
  `composerDockA11y.test.ts` + uxOneOneSix `requiredApi`).
- Guards: `__tests__/a11y/{overlayFocusTrapModel,overlayLayerStack,useOverlayA11y,overlayEscSingleDismiss}`,
  `__tests__/{argumentRoomHasOpenMenu,markerPhrasePickerSheetContainment,requestReviewComposerContainment}`,
  `__tests__/arguments/roomOpenMenuModel`, `__tests__/navigation/appPrimaryNavCorridorNav`.
