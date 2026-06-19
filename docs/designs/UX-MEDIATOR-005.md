# UX-MEDIATOR-005 — Disagreement Points sheet + vocabulary (v4 board surface over the shipped rail)

**Status:** Design draft
**Epic:** 16 — CivilDiscourse v4 UX overhaul (`epic:civildiscourse-v4`)
**Release:** v4 UX overhaul slate
**Issue:** https://github.com/<owner>/debate-constitution-app/issues/686
**Base:** `b10f21a` · branch `feat/UX-MEDIATOR-005-rail`
**Lane:** UI (read-only projection of the once-derived board) · GATE-C: No (no deploy / migration / provider / backend mutation) · effort: L
**Depends on:** UX-MEDIATOR-001 (precedence + `v4DisplayStateFor`) · UX-MEDIATOR-002 (one chip + Inspect) · composes UX-MEDIATOR-003 (evidence rows) + UX-MEDIATOR-004 (definition/scope rows)

---

## Goal (one paragraph)

A `DisagreementPointsRail` is **already shipped and mounted** in `ArgumentGameSurface` (PRs #644–648; visible today as a collapsed "Disagreement points · N ▾" chip that expands to a read-only panel — side-anchored ≥720px, a capped bottom sheet <720px). This card does **NOT** rebuild that rail. It promotes the existing surface to the v4 "Disagreement Ledger" by adding the few v4 vocabulary/structure elements the shipped rail is missing: (1) the **state-distribution bar** + the "· N total" count framing in the header; (2) per-row **anchor framing** ("→ <node>" jump target made explicit, with the optional `↳ chime-in` contribution marker rendered **only when** the board carries that data — which it does not yet, see the scope-reality audit §0); (3) the **"Move forward: …"** lead-in promoted from the shipped "What would help next?" line so the sheet and rail share one row vocabulary. It reuses the SC-005 dock chassis (`resolveObserverDockVariant` / `resolveSheetMaxHeightPx`) the rail already imports, reuses the single-derivation board (`mediatorBoard` derived once in `ArgumentGameSurface`; never re-derived), and stays a pure read-only projection — no derivation, no network/AI, no mutation, never a submission gate. Doctrine (`cdiscourse-doctrine`): this is a **structure board, not a scoreboard** — no winner/loser/score/heat/popularity, ordering is by structural state never votes, every label flows through the shipped plain-language maps, and chime-in (when it exists) is a **contribution marker, never a third principal voice and never a state**.

---

## §0 Scope-reality audit (POSTRUN-UX001 rule — orchestrator-authored card, audit BEFORE build)

This card is layout-and-data-availability dependent, so a pre-build reality audit was run against the shipped board. Two findings change the scope:

### Finding A — the rail is ALREADY MOUNTED and VISIBLE (this is a DELTA card, not a build-the-sheet card)

The issue ("the full mobile SHEET is the GAP") is **partially stale against the current repo**. The shipped `DisagreementPointsRail.tsx` (659 lines) already:

- mounts in `ArgumentGameSurface.tsx:2321` with the once-derived `mediatorBoard`, the active node, viewport, reduce-motion, and a read-only `onJump`;
- renders **collapsed-by-default** as a toggle pill, then expands to a **bottom SHEET on narrow viewports** (`variant === 'sheet'`, `resolveObserverDockVariant(width) < 720`) or a **side panel on wide** (`variant === 'side'`, ≥720) — so the "swipe-up → sheet on mobile, persistent rail on tablet/desktop" responsive split the issue asks for **already exists**;
- lists live points (filtering `resolved_or_settled`), each with: one **structural state badge** (`point.plainLabel`), a **"What would help next?"** line (first available pathway step), the **evidence-debt count** + "Evidence that would help" + "Blocked evidence path" (UX-MEDIATOR-003 already composed via `getEvidenceDebtForPoint`), the **definition/scope bridge** (UX-MEDIATOR-004 already composed via `getDefinitionScopeBridgeForPoint`), a **"Currently active"** geometry mark, a **"View in timeline →"** jump, and a **"+N more"** overflow reveal;
- already handles empty / unavailable / reduce-motion / web-Escape / 44×44 targets / ban-list-clean copy.

**Conclusion:** the implementer must extend this file, not author a new `DisagreementPointsSheet`. A `DisagreementPointsSheet.tsx` would duplicate the chassis and violate "reuse, never re-implement." The v4 GAP vs the shipped rail is **narrow**: the distribution bar, the "· N total" count framing, the "Move forward:" lead-in rename, and the explicit anchor framing.

### Finding B — the board carries NO chime-in / principal / contribution data (the `↳ chime-in` marker is BLOCKED on UX-ROOM-1V1-CHIMEIN-001)

The acceptance criterion "chime-in-sourced rows show the `↳ chime-in` marker" **cannot be delivered in this card** as a real signal:

- `DisagreementPoint` and `PointAnchor` (`mediatorBoardTypes.ts:261-284`) carry `nodeId / parentNodeId / targetExcerpt / kind / state / memberNodeIds` — and **no** `contributionKind`, `principal`, `respondent`, or `chimeIn` field.
- A repo-wide grep of `src/features/mediator` for `contribution|principal|respondent|chime|originKind|anchorKind` returns **zero matches**.
- The principal-voice ↔ chime-in distinction is **owned by UX-ROOM-1V1-CHIMEIN-001** (CARDS L475-536), which is **not yet shipped**. Per that card's doctrine, "chime-in is a role + attached treatment, never itself the state," and "a first open public seat is the respondent principal seat, not a chime-in." There is no model today that tells the board whether a node came from a principal or a chime-in.

**Recommended scope correction:** deliver the `↳ chime-in` marker as a **rendering capability that is dormant until the data exists** — the row reads an *optional* `point.anchor.contributionKind` (added to the type as an optional field by a future card, or supplied by the board adapter once UX-ROOM-1V1-CHIMEIN-001 lands) and renders `↳ chime-in` only when it is present and equals `'chime_in'`. With no such data on the shipped board, **no row shows the marker** (the common path), which is correct and ban-list-safe. The card ships the *vocabulary + render slot*; the *signal* is wired by the chime-in card. This is called out as **Open question O-4** with a designer recommendation. Do NOT synthesize a chime-in marker from absent data (doctrine §4 / UX-MEDIATOR-001 §4 — observation-driven, never invented).

### Finding C — "12 total" is illustrative, not a literal cap

The design export's "Disagreement points · 12 total" is one screen's example count. The shipped rail already renders `· ${count}` (live count). The v4 ask is the word "**total**" framing + the **distribution bar**, not a literal 12. The implementer renders the live `count`; no fixture should pin "12."

**Effort re-estimate:** the issue labels this **L**. Given Findings A–C, the *code* delta is **S–M** (extend one component + one copy module + one tiny pure helper for the distribution buckets). The **L** is justified by the test surface (sheet + rail parity, distribution-bar math, ban-list, 390px, reduce-motion, chime-in-dormant) and the heavily-pinned mount file. Keep **L**; the work is test-and-care heavy, not code-heavy.

---

## 1. Inventory of the existing `DisagreementPointsRail`

### What it renders TODAY (the shipped surface)

| Element | Shipped behavior | testID | v4 status |
|---|---|---|---|
| Collapsed pill | `Disagreement points · N ▾` — toggle, 44×44, a11y button | `disagreement-points-rail-toggle` | **keep**; add "total" framing parity with the header |
| Expanded header title | `Disagreement points · N` (uppercase, focus-ring color), + Collapse control | `disagreement-points-rail-title` | **extend** → "· N total" + the distribution bar sits under it |
| **State-distribution bar** | **ABSENT** | — | **ADD** (the primary v4 gap) |
| Per-row state badge | `point.plainLabel` (one structural state), active variant by geometry | `disagreement-points-rail-row-<id>` | **keep**; project label through `v4DisplayStateFor` for v4 vocabulary parity (O-1) |
| Per-row "next step" | `What would help next? <pathway>` | (inside row) | **rename lead-in** → `Move forward: <pathway>` (O-2) |
| Per-row anchor / jump | `View in timeline →`, `onJump(point.anchor.nodeId)` | (inside row) | **extend** with explicit anchor framing + dormant `↳ chime-in` slot |
| Evidence (003) | count + "Evidence that would help" + "Blocked evidence path" | `disagreement-points-rail-evidence-*` / `-blocked-*` | **keep verbatim** (003 owns internals) |
| Definition/scope (004) | "Clarify the point" + definition/scope bridge | `disagreement-points-rail-bridge-*` | **keep verbatim** (004 owns internals) |
| "Currently active" mark | left accent bar (geometry) + "Currently active" word | `disagreement-points-rail-active-<id>` | **keep** |
| Overflow reveal | `+N more` after `DISAGREEMENT_POINTS_RAIL_INITIAL_ROWS` (6) | `disagreement-points-rail-overflow` | **keep** |
| Empty / unavailable | shipped copy | `-empty` / `-unavailable` | **keep** |

### Mount state — IS IT VISIBLE TODAY? **Yes.**

`ArgumentGameSurface.tsx:2321-2334` mounts `<DisagreementPointsRail board={mediatorBoard} activeNodeId={activeMessageId} … onJump={…} />`, collapsed-by-default, in the single-owner mutual-exclusion group with the Open Issues rail + side action rail (`isAnyPanelOpen={Boolean(selectedDockTarget) || openIssuesRailExpanded || sideRailExpanded}`). The board is the **once-derived** `mediatorBoard` (single-derivation invariant; the rail never re-derives). `onJump` sets the active message + selection status (a read-only navigation, no mutation).

### Responsive chassis it already reuses (SC-005)

- `resolveObserverDockVariant(width)` → `'sheet'` (<720) / `'side'` (≥720). The `'sheet'` variant is the **mobile bottom sheet**; `'side'` is the **tablet/desktop persistent panel** (`width: 380`, `alignSelf: 'flex-end'`). So the issue's "swipe-up sheet on mobile · persistent rail on tablet/desktop" is **the shipped variant split** — no new responsive code is needed.
- `resolveSheetMaxHeightPx(height)` caps the sheet (never full-screen, ~28% viewport, floor 168px).
- reduce-motion: snaps instead of animating (`effectiveReducedMotion` read from `AccessibilityInfo` + `reduceMotionOverride` prop), already mirrored from `OpenIssuesRail`.

### Gaps vs the v4 target (the entire delta)

1. **No state-distribution bar.** The v4 sheet/rail header carries a horizontal bar segmented by structural state (how many points are Needs evidence vs Definition not shared vs …). **ADD.**
2. **Header says "· N", v4 says "· N total".** Cosmetic copy framing. **ADD** word.
3. **Row lead-in is "What would help next?", v4 row vocabulary is "Move forward: …".** Copy rename (one shared lead-in for sheet + rail). **CHANGE** (O-2).
4. **Row badge uses the internal 13-code label**, v4 wants the nine-state display vocabulary. **CHANGE** via `v4DisplayStateFor` (O-1; the node chip already does this in UX-MEDIATOR-002).
5. **No `↳ chime-in` anchor marker** — and no data to drive it. **ADD a dormant render slot** (Finding B / O-4).

Everything else the v4 row needs (state chip, anchor jump, evidence rows, definition/scope rows, active mark, overflow, empty/unavailable, reduce-motion, 44×44) **already exists**.

---

## 2. The v4 rail row model

The v4 board answers four questions; each maps to an existing or added row field, all fed by the **once-derived board**:

| v4 question | Row field | Mediator-board output that feeds it | Status |
|---|---|---|---|
| **(1) What remains unresolved?** | **State chip** — ONE primary state | `v4DisplayStateFor(point.state)` → `plainLanguageForMediatorState(displayState)` (the nine-state display vocabulary; identical to the node chip's source in UX-MEDIATOR-002) | extend (project through `v4DisplayStateFor`, O-1) |
| **(2) What would move this forward?** | **"Move forward: …" line** | first `available` step of `board.pathwaysByPointId[point.id]` → `step.plainLabel` (already read by `nextStepLabelFor`); plus the 003 "Evidence that would help: <kinds>" and 004 "Clarify the point" bridge prompts (already composed) | rename lead-in (O-2) |
| **(3) What is blocked?** | **Blocked line** | `getEvidenceDebtForPoint(board, id).isBlocked` → "Blocked evidence path" (UX-MEDIATOR-003, already rendered); display state `evidence_blocked` also surfaces in the chip | keep verbatim |
| **(4) Can this point be narrowed?** | **State chip + bridge** | `narrowed` display state ("Partially narrowed") + the 004 scope bridge ("narrow the point or branch a separate claim") | keep verbatim |
| **anchor / jump** | **"View in timeline →" press → `onJump(point.anchor.nodeId)`**, plus the **dormant `↳ chime-in` marker** | `point.anchor.nodeId` (shipped); `point.anchor.contributionKind` (OPTIONAL, dormant — Finding B) | keep jump; add dormant marker slot |

**Each row anchors to a node** (the `point.anchor.nodeId`, already the jump target) and shows ONE primary state — it does **not** duplicate every Inspect detail (the per-node Inspect overlay, UX-MEDIATOR-002, owns the full Observation/Allegation provenance). The rail row is the **board-level summary**: one state, one "move forward," the blocked/narrow signals, and a jump. No chip soup back through the rail.

### The state-distribution bar (the one genuinely new visual)

A horizontal bar above the row list, segmented by structural display state, derived **purely** from the already-selected live points:

```ts
// New pure helper (no React) in mediatorRailCopy.ts OR a new mediatorDistribution.ts.
// Input: the live points (already filtered to non-resolved by selectLivePoints).
// Output: ordered segments [{ displayState, count }], highest-priority first,
// using V4_PRIMARY_STATE_PRIORITY for order and v4DisplayStateFor for bucketing.
export interface DisagreementDistributionSegment {
  displayState: V4MediatorStateCode;  // the nine-state vocabulary
  count: number;                      // points in this bucket
  plainLabel: string;                 // plainLanguageForMediatorState(displayState)
}
export function buildDisagreementDistribution(
  livePoints: ReadonlyArray<DisagreementPoint>,
): ReadonlyArray<DisagreementDistributionSegment>;
```

- **Order** by `V4_PRIMARY_STATE_PRIORITY` (impasse-first) so the bar reads structurally, never by count magnitude and never by votes (doctrine: ordering is structural).
- **Segment width** is proportional to `count / total` (flex-grow), so it is a *composition* bar, not a magnitude/heat bar.
- **Color is NOT the only signal:** each segment carries its `plainLabel` (or a count) as text and/or its `accessibilityLabel`; a grayscale render still reads "Needs evidence 4 · Definition not shared 2 · …" via the legend/labels. Premium-dark palette: gold (`SURFACE_TOKENS.focusRing`) reserved for the impasse segment + the active emphasis; indigo/purple functional tones for the rest; no red/green verdict pairing.
- It is the SAME data the rows render — a roll-up, not a second derivation.

---

## 3. Responsive surfaces (using EXISTING primitives)

| Surface | Viewport | Primitive (already in the shipped rail) | What renders |
|---|---|---|---|
| **Phone bottom sheet** | <720px (`resolveObserverDockVariant → 'sheet'`) | `expandedRootSheet` (top-rounded), `resolveSheetMaxHeightPx` cap, `Animated` slide (snapped under reduce-motion), web-Escape collapse | the collapsed pill ("swipe up" affordance is the toggle), then the count + **distribution bar** + sorted rows + overflow |
| **Tablet / desktop persistent panel** | ≥720px (`resolveObserverDockVariant → 'side'`) | `expandedRootSide` (`width: 380`, `alignSelf: 'flex-end'`, no slide animation) | the SAME header + **distribution bar** + rows; this is the "persistent right rail / Disagreement points column" the v4 design shows |

**No new layout primitive is introduced.** The phone-sheet / tablet-panel split is the shipped SC-005 `variant` branch. The distribution bar is a `<View flexDirection:'row'>` of flex-weighted `<View>` segments inside the existing header region — no new container chrome.

**Desktop right-column ledger note (the issue's "persistent rail on tablet/desktop"):** the shipped `'side'` variant already renders a 380px bottom-right-anchored panel, which satisfies "persistent rail." A *full-height right-column* ledger (docked alongside the board for the whole session) would be a **broader layout rewrite of `ArgumentGameSurface`'s flex tree** and is explicitly OUT of scope (§6). The shipped side panel is the safe v4 surface for this card; the full right-column is deferred to UX-RESPONSIVE-V4-001. **Open question O-3.**

**"Swipe up" gesture:** the design copy says "swipe up ↑." The shipped affordance is a **tap toggle** (a `Pressable` pill), not a pan gesture. A true swipe-to-expand pan handler would add a `PanResponder`/gesture dep surface and is not required for parity (tap-to-expand is reachable and touch-safe). **Recommendation: keep the tap toggle; render the "↑"/"▾" caret as the swipe-up *affordance hint*.** Adding a real pan gesture is a separate enhancement (noted, not built). **Open question O-3.**

---

## 4. Smallest-safe delta (exact files) + a SAFE mount point EXISTS

**A safe insertion/mount point EXISTS** — the rail is already mounted at `ArgumentGameSurface.tsx:2321` with the right board + props. **No `ArgumentGameSurface` mount change is required.** The delta lives inside the rail + its copy module + one tiny pure helper. This is NOT a design-only-stop card.

### CHANGE — `src/features/mediator/DisagreementPointsRail.tsx` (~40–60 lines net)

1. **Header:** render `· ${count} total` (was `· ${count}`); mount the **distribution bar** `<View testID="disagreement-points-rail-distribution">` directly under the title, fed by `buildDisagreementDistribution(livePoints)`. Each segment is a flex-weighted `<View>` with an `accessibilityLabel` ("Needs evidence: 4 of 12"); a compact text legend renders the same buckets for grayscale/screen-reader parity.
2. **Row state chip:** project the badge label through `v4DisplayStateFor(point.state)` (O-1) so the rail uses the nine-state display vocabulary — matching the node chip. `point.plainLabel` (internal 13-code label) stays available for Inspect/traceability; only the *rail display* projects. If O-1 is declined, leave the badge on `point.plainLabel` (still ban-list clean; the soup is already collapsed).
3. **Row "move forward" lead-in:** render `${DISAGREEMENT_POINTS_RAIL_COPY.moveForward} ${nextStepLabel}` (was `whatHelps`). One shared lead-in for sheet + side variants (same component, so parity is automatic).
4. **Anchor / chime-in slot:** keep the `View in timeline →` jump (unchanged). Add a **dormant** `↳ chime-in` marker rendered only when `point.anchor.contributionKind === 'chime_in'` (Finding B). With no such data on the shipped board, no row renders it. testID `disagreement-points-rail-chimein-<id>`.

### CHANGE — `src/features/mediator/mediatorRailCopy.ts` (~6 lines)

- Add `moveForward: 'Move forward:'` (the v4 row lead-in; ban-list clean).
- Add `chimeInMarker: '↳ chime-in'` (the contribution marker; ban-list clean — a contribution label, never a state/verdict).
- Add `totalSuffix: 'total'` (or render `· N total` inline). Keep the existing `whatHelps` export (do not delete — other tests/consumers may reference it; deprecate in a comment).

### ADD — the distribution helper (~40 lines, pure TS, no React)

- Either extend `mediatorRailCopy.ts` or add `src/features/mediator/mediatorDistribution.ts` exporting `DisagreementDistributionSegment` + `buildDisagreementDistribution(livePoints)`. **Recommendation: a new `mediatorDistribution.ts`** (keeps copy and math separate; matches the `*Display.ts` pattern in the module). Export it from `index.ts`.

### UNTOUCHED (preserve byte-for-byte / behavior)

- `src/features/arguments/ArgumentGameSurface.tsx` — mount site + single-derivation; **no change** (the rail already gets the right props).
- `deriveMediatorBoardState.ts`, `mediatorBoardTypes.ts` precedence/mapping, `nodeMediatorMarkers.ts`, `MediatorNodeMarker.tsx` (UX-MEDIATOR-002 owns the chip) — **no change**. (The optional `contributionKind?: 'chime_in' | 'principal'` field on `PointAnchor` is **NOT added here** unless O-4(b) is chosen — see O-4; default is to read it optionally so the type can stay untouched until the chime-in card adds it.)
- `evidenceDebtDisplay.ts` / `definitionScopeBridgeDisplay.ts` (003/004 internals) — **composed, not edited**.
- `mediatorPlainLanguage.ts` — **no label rename** (the "Definition not shared" rename is UX-MEDIATOR-004; the rail just consumes whatever the map returns).
- SC-005 chassis (`ObserverActionDockLayout.ts`) — **no change**.

### Net file count

- **Modified:** 2 (`DisagreementPointsRail.tsx`, `mediatorRailCopy.ts`) + 1 export line in `index.ts`.
- **New:** 1 (`mediatorDistribution.ts`) + 1 test file.
- **Deleted:** 0.

### Existing tests that PIN current behavior + reconciliation

| Test | Pins | Reconciliation |
|---|---|---|
| `__tests__/DisagreementPointsRail.test.tsx` "renders an Open point" / "Needs evidence" / "Structured impasse" | `getByText('Open')` etc. | **Stays green if O-1 NOT adopted** (label unchanged). If O-1 adopted, the displayed label for the four superset codes changes (e.g. an `off_point` point shows "Scope mismatch"); these fixtures use states already in the nine, so they are **unaffected** either way. |
| `DisagreementPointsRail.test.tsx` "no internal codes / no ban-list tokens" | every rendered string is ban-list clean + no snake_case | **Stays green** — the new "Move forward:", "total", "↳ chime-in", and distribution labels are all ban-list clean and snake_case-free; the test re-runs over the new text. |
| `DisagreementPointsRail.test.tsx` collapsed/empty/unavailable/jump/active | structural behaviors | **Stays green** — none of these change. |
| `__tests__/disagreementPointsRailEvidence.test.tsx` / `disagreementPointsRailBridge.test.tsx` | 003/004 row composition + the `'Definition needed …'` bridge copy | **Stays green** — 003/004 internals untouched; the lead-in rename touches `whatHelps` only, not the bridge/evidence copy. |

**Net:** the delta is additive (distribution bar + two copy lines + a dormant slot) plus one copy-lead-in rename and one optional label projection. No shipped fixture flips unless the implementer chooses to also rename the assertion text in lockstep with O-2.

---

## 5. Test plan (`__tests__/`, render + pure-model)

New file `__tests__/uxMediator005DisagreementSheet.test.tsx` (+ extend `DisagreementPointsRail.test.tsx` where natural):

- **Fixture with multiple points → one row per point.** A board with ≥6 live points of distinct states (needs_evidence, definition_not_shared, evidence_blocked, scope_mismatch, narrowed, structured_impasse) → assert one `disagreement-points-rail-row-<id>` per point (and the `+N more` overflow past 6).
- **Each row anchors to a node.** Press a row → `onJump` called with `point.anchor.nodeId` (regression of the shipped jump test, extended to confirm anchor framing).
- **Row state uses `v4DisplayStateFor`** (if O-1). Feed a point whose internal `point.state === 'off_point'`; assert the row badge reads the **display** label ("Scope mismatch"), not "Off-point response". (If O-1 declined, assert it reads `point.plainLabel`.)
- **"Move forward:" copy present.** Assert the row renders `Move forward: <pathway>` and does NOT render the old `What would help next?` lead-in (O-2). Assert the move-forward text is plain-language (e.g. "Provide a source").
- **Distribution bar renders + math.** Pure test of `buildDisagreementDistribution`: bucket counts sum to the live-point total; order matches `V4_PRIMARY_STATE_PRIORITY`; `resolved_or_settled` points are excluded (live filter); empty input → empty segments. Render test: `disagreement-points-rail-distribution` mounts with a segment per non-empty bucket, each with an `accessibilityLabel`.
- **Count framing.** Header reads `Disagreement points · N total` for live count N (no hard-coded 12; assert it tracks the fixture).
- **No chip-soup regression.** Assert each row shows exactly ONE primary state badge (not the node-level Observation/Allegation chips); the rail does not mount `NodeLabelStrip`/`AnnotationChipStrip` (those are node-surface, UX-MEDIATOR-002).
- **Chime-in marker is dormant by default, renders only with data.** With shipped board fixtures (no `contributionKind`), assert NO `disagreement-points-rail-chimein-*` renders. With a fixture point whose `anchor.contributionKind === 'chime_in'`, assert the `↳ chime-in` marker renders AND the row state chip is unchanged (chime-in is a contribution marker, never a state, never a third principal).
- **Mobile sheet reachable + touch-safe.** At width 390 (`variant === 'sheet'`): the toggle pill + collapse control + each row press target meet 44×44 (`minHeight`/`hitSlop`); the sheet is dismissible (collapse control + web-Escape); reduce-motion (`reduceMotionOverride`) snaps (no animated slide).
- **No sensitive composer-only marks in rows (§10a).** Assert the rail renders no `shifts_to_person_or_intent` / `contains_unplayable_insult_only` / `needs_pre_send_pause` string for any point (the board never promotes a sensitive composer-only observation to a point state; the rail reads `point.state` only).
- **Ban-list clean.** Re-run the shipped ban-list scan over all rendered text (rows + distribution labels + new copy): no `_forbiddenMediatorTokens()`, no snake_case, no winner/loser/score/heat/popularity/red-green token.
- **Existing mediator/rail tests stay green.** Full re-run of `__tests__/{DisagreementPointsRail,disagreementPointsRail*,mediatorBoardState,mediatorPrecedence,nodeMediatorMarkers,uxMediator002*,definitionScope*,evidenceDebtDisplay,roomMediatorAdapter,MediatorNodeMarker}.test.*`.
- **Gates:** `npm run typecheck`, `npm run lint`, `npm run test` all exit 0 (full suite, captured exit code per test-discipline gate-timeout rule); test count goes UP.

Coverage target: 100% branch on `buildDisagreementDistribution` (pure helper — engine-adjacent bar applies); render coverage for the new bar + lead-in + dormant chime-in slot.

**Handoff:** 390px overflow + reduce-motion broad QA hands off to UX-RESPONSIVE-V4-001 / UX-ACCESSIBILITY-001 (per the issue test plan); this card verifies the rail's own 390px + reduce-motion paths inline.

---

## 6. Non-goals (explicit)

- **NO new classifier, NO MCP, NO AI call** — the rail reads the already-derived board only.
- **NO persistence, NO migration, NO Edge Function, NO deploy, NO provider call, NO Supabase write, NO service-role.**
- **NO room / seat / invite / chime-in / submission-semantics change** — the `↳ chime-in` marker is a *render slot* for data UX-ROOM-1V1-CHIMEIN-001 will own; this card does not model chime-in, principals, or seats.
- **NO precedence-model change** — UX-MEDIATOR-001 owns `v4DisplayStateFor` + the priority order; this card consumes them.
- **NO node-chip change** — UX-MEDIATOR-002 owns the one-chip node markup + Inspect; this card does not touch `MediatorNodeMarker`/`nodeMediatorMarkers`.
- **NO evidence-blocked / definition-scope row internals** — UX-MEDIATOR-003/004 own them; this card composes the shipped display helpers verbatim.
- **NO broad `ArgumentGameSurface` layout rewrite / full-height right-column ledger** — deferred to UX-RESPONSIVE-V4-001 (the shipped `'side'` 380px panel is the v4 surface here).
- **NO real swipe/pan gesture handler** — the tap toggle + caret hint is the affordance; a pan gesture is a separate enhancement.
- **NO voting / scoring / winner / heat sort on points** — ordering is structural (`V4_PRIMARY_STATE_PRIORITY`), never by count, votes, or engagement.
- **NO label rename of `'Definition needed'`** — UX-MEDIATOR-004 owns it; the rail consumes whatever the map returns.

---

## 7. Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** rows show structural states ("Needs evidence", "Structured impasse", "Partially narrowed") + a "Move forward" step — never a verdict/person/truth label. The rail is read-only; its only verb is a navigation jump; it imports nothing from the engine and gates nothing. The distribution bar is a *composition* of structural states, not a score. PASS.
- **§2 (heat ≠ truth) / §3 (popularity is not evidence):** no heat/temperature/engagement/like/view/follower token enters any row, the distribution bar, or its ordering; ordering is `V4_PRIMARY_STATE_PRIORITY` (structure), never count/vote magnitude. The bar's segment widths show *composition*, not popularity. PASS.
- **§4 (AI moderator limits):** the board's machine observations are advisory and already persisted; this card moves none of them and asserts no truth; nothing runs on a network in the app. PASS.
- **§9 (plain language) + §10a (Observations vs Allegations):** every rendered string flows through `mediatorPlainLanguage` / `DISAGREEMENT_POINTS_RAIL_COPY` and is ban-list + snake_case scanned; the rail surfaces machine **Observations** as structural states, never a user **Allegation** as a state; no sensitive composer-only Observation reaches a row (the board never promotes them to a point state). Chime-in (when present) renders as a **contribution marker**, never a state and never a third principal. PASS.
- **§10 (v1 scope):** no voting/winner, no search, no OAuth, no push, no public API, no realtime body editing. PASS.
- **accessibility-targets:** 44×44 on the toggle / collapse / row-press / overflow targets (shipped + preserved); the distribution bar carries text/`accessibilityLabel` so color is not the only signal (grayscale-legible); reduce-motion snaps; the sheet is dismissible; no flash hazard (no pulsing glow). PASS.
- **expo-rn-patterns:** RN primitives only (`View`/`Text`/`Pressable`/`ScrollView`/`Animated`); the distribution bar is flex-weighted `<View>`s (no gradient/icon/chart dep); reuses `designTokens` + the SC-005 chassis; no new dependency. PASS.
- **test-discipline:** render tests (sheet + rail parity, distribution, one-row-per-point, anchor, move-forward, dormant chime-in, 390px, reduce-motion, ban-list, no-chip-soup, no-sensitive-marks) + pure-model coverage of `buildDisagreementDistribution`; full mediator/rail suite stays green; test count up; full-suite exit-0 gate. PASS (plan).

---

## 8. Dependencies (cards / docs / files)

- **Depends on UX-MEDIATOR-001** (merged) — consumes `v4DisplayStateFor` + `V4_PRIMARY_STATE_PRIORITY` + the display vocabulary. `docs/designs/UX-MEDIATOR-001.md`.
- **Depends on UX-MEDIATOR-002** (merged) — the one-chip / Inspect model defines the row-vs-Inspect division of labor (the rail row is the board summary; Inspect owns full provenance). `docs/designs/UX-MEDIATOR-002.md`.
- **Composes UX-MEDIATOR-003 + UX-MEDIATOR-004** — reuses `getEvidenceDebtForPoint` / `getDefinitionScopeBridgeForPoint` already wired into the shipped rail; does not re-implement their internals.
- **Reads existing (no re-derivation):** the once-derived `mediatorBoard` (`ArgumentGameSurface.tsx:~683` → `:2322`), `selectLivePoints` (in the rail), `board.pathwaysByPointId`, `DISAGREEMENT_POINTS_RAIL_COPY`, the SC-005 chassis (`resolveObserverDockVariant` / `resolveSheetMaxHeightPx`).
- **Reuses the shipped surface:** `DisagreementPointsRail.tsx` (#644–648) — **extends, never rebuilds** (issue: "extends #599 REF-006-RAIL, #588 REF-005").
- **BLOCKED-data dependency:** the real `↳ chime-in` signal depends on **UX-ROOM-1V1-CHIMEIN-001** (principal-voice ↔ chime-in model, not yet shipped). This card ships the render slot; that card supplies the data. (Finding B / O-4.)
- **Single-derivation invariant** (`memory: mediator-board-single-derivation`): board derived ONCE, shared by rail + node markup — this card adds no second derivation; the distribution roll-up is computed from the already-selected live points inside the rail.
- **Design source of truth:** `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-CARDS.md` L1001-1075; `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md`; `docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md`; `docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md`.

---

## 9. Risks

- **R1 — Stale issue premise ("build the sheet").** The sheet/rail responsive split already ships; building a new `DisagreementPointsSheet` would duplicate the chassis and break "reuse, never re-implement." **Mitigation:** §0 Finding A + §4 pin the delta to extending the shipped file; the implementer must read the rail first.
- **R2 — Chime-in marker with no data.** Delivering `↳ chime-in` as a live signal is impossible (no board data; chime-in model unshipped). Synthesizing it would violate doctrine §4. **Mitigation:** dormant render slot keyed on an OPTIONAL `anchor.contributionKind`; default path shows nothing; the chime-in card wires it later. O-4.
- **R3 — Distribution-bar color-only meaning.** A segmented bar can become color-only. **Mitigation:** each segment carries text/`accessibilityLabel`; a compact legend renders the same buckets; grayscale-legible test.
- **R4 — O-1 label projection touches rail snapshots.** Projecting the badge through `v4DisplayStateFor` changes the label for `off_point`/`key_detail_unavailable`/`value_tradeoff` points. **Mitigation:** O-1 is offered as a decision; the shipped rail fixtures use states already in the nine, so they are unaffected; if adopted, add a fixture for a collapsed code.
- **R5 — "total" / "Move forward:" copy churn.** Renaming the lead-in could flip a fixture asserting "What would help next?". **Mitigation:** grep `__tests__` for `whatHelps` / "What would help" before editing; update in lockstep; keep the old copy key exported (deprecated) to avoid import breaks.
- **R6 — `ArgumentGameSurface` is heavily pinned.** Even though no mount change is needed, the rail is rendered through the surface in integration tests. **Mitigation:** the delta is inside the rail component; run the full suite (not a tailed run) to catch any surface-level snapshot.

---

## 10. Out of scope (explicit) — see §6.

(Consolidated in §6 Non-goals.)

---

## 11. Operator steps (if any)

**None — pure code change.** No `db push`, no `functions deploy`, no env var, no migration, no deploy. The implement step ships a UI delta inside the already-mounted rail, merged via the normal green-PR path; the single-derivation site picks it up with no operator action.

---

## Open questions for the operator (each with a designer recommendation)

- **O-1 (row state vocabulary — visible label):** Should the rail row badge project through `v4DisplayStateFor` (nine-state display vocabulary — so an internal `off_point` reads "Scope mismatch"), matching the UX-MEDIATOR-002 node chip, or keep the shipped `point.plainLabel` (13-code labels, zero label churn)? **Recommendation: project through `v4DisplayStateFor`** — it makes the rail vocabulary identical to the node chip (the issue's "sheet and rail share the same row vocabulary"), keeps `point.state` intact for Inspect, and is a ~2-line change. Decline only if the operator wants the absolute-minimum diff.

- **O-2 (row lead-in copy):** Rename the row's "What would help next?" lead-in to the v4 "Move forward:" (one shared lead-in for sheet + side)? **Recommendation: yes** — it is the named v4 row vocabulary; keep the old copy key exported-but-deprecated to avoid import breaks; update any fixture asserting the old string in lockstep.

- **O-3 (desktop surface prominence + swipe gesture):** (a) Keep the shipped `'side'` 380px bottom-right persistent panel as the tablet/desktop surface and the **tap toggle** (with a "↑" caret as the swipe-up hint) — zero layout rewrite; OR (b) commit this card to a **full-height right-column ledger** + a real **swipe/pan gesture**. **Recommendation: (a)** — the full right-column is a broad `ArgumentGameSurface` flex rewrite (UX-RESPONSIVE-V4-001's job), and a pan gesture is an enhancement, not parity. The shipped side panel + tap toggle already satisfy "persistent rail on tablet/desktop · sheet on mobile."

- **O-4 (chime-in marker — data path):** The `↳ chime-in` marker has no board data today (Finding B). (a) Ship a **dormant render slot** that reads an OPTIONAL `point.anchor.contributionKind` (added later by UX-ROOM-1V1-CHIMEIN-001 or its adapter) — no type change here, no synthesis, marker invisible until data arrives; OR (b) add the optional `contributionKind?: 'principal' | 'chime_in'` field to `PointAnchor` **now** (still always undefined until the chime-in card populates it). **Recommendation: (a)** — keeps the mediator types untouched and avoids a field the producer can't yet fill; the chime-in card owns both the field and the data. Either way: never synthesize the marker from absent data.

- **O-5 (default-open vs toggle):** The rail is collapsed-by-default today (observer-first). Keep collapsed-by-default, or default-open on wide viewports where the side panel has room? **Recommendation: keep collapsed-by-default** — it preserves the shipped single-owner mutual-exclusion behavior with the Open Issues + side action rails and avoids three panels fighting for the same space; the v4 "promote to information architecture" intent is satisfied by the always-present pill + the richer expanded content.

---

## Recommended implement-step scope

Touch **2 files + 1 export line + 1 new helper + 1 new test**:

1. `src/features/mediator/DisagreementPointsRail.tsx` — header "· N total" + mount the distribution bar; row "Move forward:" lead-in; row badge through `v4DisplayStateFor` (O-1); dormant `↳ chime-in` slot (O-4a).
2. `src/features/mediator/mediatorRailCopy.ts` — add `moveForward`, `chimeInMarker`, `totalSuffix`; keep `whatHelps` (deprecated comment).
3. `src/features/mediator/mediatorDistribution.ts` (new) — `DisagreementDistributionSegment` + `buildDisagreementDistribution`; export from `src/features/mediator/index.ts`.
4. `__tests__/uxMediator005DisagreementSheet.test.tsx` (new) + targeted extensions to `__tests__/DisagreementPointsRail.test.tsx`.

Run `npm run typecheck && npm run lint && npm run test` (full suite, exit-0); confirm the mediator + rail suites are green and the test count goes up. No `ArgumentGameSurface` mount change; no backend, no migration, no deploy.
