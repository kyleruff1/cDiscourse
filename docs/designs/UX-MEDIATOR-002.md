# UX-MEDIATOR-002 — One-primary-state-chip node markup ("collapse the chip soup")

**Status:** Design draft
**Epic:** 16 — CivilDiscourse v4 UX overhaul (`epic:civildiscourse-v4`)
**Release:** v4 UX overhaul slate
**Issue:** https://github.com/<owner>/debate-constitution-app/issues/683
**Base:** `ef71928` · branch `feat/UX-MEDIATOR-002-one-chip`
**Lane:** UI-model (consumes the pure board; no backend mutation) · GATE-C: No · effort: M
**Depends on:** UX-MEDIATOR-001 (precedence + `v4DisplayStateFor`) — `docs/designs/UX-MEDIATOR-001.md`

---

## Goal (one paragraph)

Today **two markups mount per timeline node by default** — `MediatorNodeMarker`
(one mediator state chip) and `NodeLabelStrip` (one Machine-Observation chip + one
User-Allegation chip + an overflow indicator). That stacked default is the "chip
soup" the v4 design (S1 → S2) collapses: many competing signals → **one primary
state + one move**, with everything else in Inspect. This card makes the **default
view of a node render exactly ONE primary state chip** — the structural Observation
derived once via UX-MEDIATOR-001's `v4DisplayStateFor(point.state)` — and **relocates
the rest of the per-node intelligence (the Observation/Allegation chips and their
overflow) into the already-shipped Inspect overlay** (`NodeLabelInspectGroups`). No
intelligence is deleted; the visible noise on the default surface is collapsed.
The chip is read-only, never a submission gate, carries no verdict/person/intent
copy (cdiscourse-doctrine §1–§3), and preserves the Observations-vs-Allegations
boundary (§10a): the one default chip is the machine **Observation** (structural
state); user **Allegations** and the secondary machine Observations live in Inspect,
where the two groups stay labelled and separate. Sensitive composer-only Observations
(`shifts_to_person_or_intent`, etc.) continue to never reach the target's node on
any surface. The board is **derived ONCE** in `ArgumentGameSurface` and shared — this
card re-uses that single derivation and never re-derives (single-derivation invariant).

---

## 1. Inventory of current per-node markup (the "soup" to collapse)

### Default-view surfaces that mount per (active) node TODAY

`ArgumentGameSurface.tsx` mounts the per-node markup as **siblings below the
Timeline** for the active node. There are exactly **two default-view markups**, and
each can render multiple atoms:

| # | Component | Mount site | What it renders by default | Source family | Atoms |
|---|---|---|---|---|---|
| A | `MediatorNodeMarker` | `ArgumentGameSurface.tsx:2177` | 1 mediator **state** chip (plain-language label, calm left-rule when `structured_impasse`) | **mediator-state** (machine Observation) | 1 |
| B | `NodeLabelStrip` | `ArgumentGameSurface.tsx:2189` | 1 Machine-Observation chip + 1 User-Allegation chip + overflow indicator | **lifecycle / auto-metadata / manual-tag (user) / classifier (machine)** | up to 2 + overflow |

**The soup = A and B stacked.** Two adjacent chip surfaces, two different visual
grammars (mediator marker vs `AnnotationChipStrip`), feeding from two derivations
(the mediator board + the node-label source adapters). On a node that is, say,
`needs_evidence` AND has a lifecycle Observation AND a user tag, the user sees the
mediator chip **and** an Observation chip **and** an Allegation chip **and** "+N"
— four competing atoms with no single "state."

#### What B (`NodeLabelStrip`) actually pulls (the six source adapters)

`NodeLabelStrip` → `computeNodeLabelStripDescriptors` → `adaptAllSourcesForNode`
(`src/features/nodeLabels/nodeLabelSourceAdapters.ts`), combined →
`enforceTimelineNodeDisplayCap` (1 Observation + 1 Allegation + overflow):

- **Source 1 — manual_tag** → User **Allegation** (`user_allegation`).
- **Source 2 — auto_metadata** → Machine **Observation** (`machine_observation`).
- **Source 3 — lifecycle** → Machine **Observation** (cluster/contribution state).
- **Source 4 — compositionMutation** → Machine **Observation**.
- **Source 5 — semanticRefereeNodeMount** → Machine **Observation** (advisory).
- **Source 6 — rawClassifier** (MCP-021B persisted rows) → Machine **Observation**.

`filterMarksBySurface(..., 'timeline_node')` already excludes `composer_only`
(sensitive), `inspect_only`, and `future_source` dispositions from B's default view.

### Inspect surface that ALREADY exists (the destination for the collapse)

| Component | Mount site | Gate | What it renders |
|---|---|---|---|
| `NodeLabelInspectGroups` | `ArgumentGameSurface.tsx:2477` | `inspectVisible && activeMessageId` | "Machine Observations" group (header + count + chips) + "User Allegations" group (header + count + chips), **unbounded**, full provenance preserved, `inspect` surface (includes `inspect_only` marks excluded from the timeline node) |

This overlay is the natural, already-shipped home for the collapsed detail. It is
fed by the **same source adapters** as B, but with `surface: 'inspect'` and
`enforceInspectGroupedView` (no cap), and it keeps the Observations/Allegations
groups labelled and separate (§10a-clean). **It does NOT currently include the
mediator state** — only the node-label sources.

### What is NOT in scope of the soup (mounted but not per-node-default)

- `DisagreementPointsRail` (`ArgumentGameSurface.tsx:~2267`) — the **room-wide** rail,
  one badge per point. Not a per-node markup. Redesigning it is **out of scope**
  (UX-MEDIATOR-005); it already consumes one state per point.
- `enforceSelectedContextDisplayCap` (3+3) exists in the model but is **not mounted**
  in `ArgumentGameSurface` — there is no selected-context strip today, so nothing to
  collapse there.
- `OpenIssuesRail`, `TimelineSelectedReadoutPanel`, `ArgumentScoreTracker`,
  `RefereeBannerView` — separate chrome, not per-node chip markup.

### Soup-source summary (the eight signals the v4 design names)

| Signal family | Surfaced today via | After this card |
|---|---|---|
| **Mediator structural state** (lifecycle/evidence/definition/scope/impasse roll-up) | A (`MediatorNodeMarker`) | **the ONE default chip** (`v4DisplayStateFor`) |
| **Lifecycle Observation** (B Source 3) | B chip | Inspect (Machine Observations) |
| **Auto-metadata Observation** (B Source 2) | B chip | Inspect (Machine Observations) |
| **Composition-mutation Observation** (B Source 4) | B chip | Inspect (Machine Observations) |
| **Semantic-referee Observation** (B Source 5) | B chip | Inspect (Machine Observations) |
| **Classifier Observation** (B Source 6, MCP-021B) | B chip | Inspect (Machine Observations) |
| **Manual-tag Allegation** (B Source 1) | B chip | Inspect (User Allegations) |
| **Overflow "+N"** | B indicator | absorbed into Inspect (full, uncapped) |

---

## 2. The one-chip default

### What renders

On the default (non-Inspect) view, a node shows **exactly one** primary state chip:
the existing `MediatorNodeMarker` (component A), **unchanged in its visual grammar**,
fed by `getNodeMediatorMarker(board, nodeId)`. Component B (`NodeLabelStrip`) **no
longer mounts in the default view**. There is no second chip surface.

### The label

- Plain-language, derived through UX-MEDIATOR-001's display projection:
  `v4DisplayStateFor(point.state)` → `plainLanguageForMediatorState(displayState)`.
  The chip text is one of the v4 nine display labels (ban-list clean):
  "Open" · "Needs evidence" · "Blocked evidence path" · "Definition needed" ·
  "Scope mismatch" · "Missing link" · "Partially narrowed" · "Structured impasse" ·
  "Difference of recollection".
- `getNodeMediatorMarker` already suppresses the non-actionable states (`open`,
  `resolved_or_settled`, `accounts_differ`) so an ordinary open node carries **no
  chip** (zero soup, not "Open" everywhere). Preserved verbatim.
- **No label rename in this card.** Keep `'Definition needed'` and `'Missing link'`
  exactly as shipped. The `'Definition needed' → 'Definition not shared'` rename is
  **UX-MEDIATOR-004** (explicit non-goal §9).

### Consuming the v4 display state (the one delta to A's feed)

UX-MEDIATOR-001 ships `v4DisplayStateFor(code)`, the total 13→9 display projection.
Today `getNodeMediatorMarker` returns the **internal** 13-code (`off_point`,
`key_detail_unavailable`, `value_tradeoff` can surface as their own labels). The
v4 collapse wants the **display** vocabulary, so the marker's `code`/`label` should
be projected through `v4DisplayStateFor` so, e.g., a node whose internal state is
`off_point` shows the v4 "Scope mismatch" chip (its display collapse), while
`point.state` keeps `off_point` for Inspect/traceability. **Designer recommendation
+ Open question O-1** below — this is the only behavioral change to A; if the operator
prefers zero copy churn, A is left exactly as-is and only B is unmounted (still
collapses the soup, but the chip keeps the 13-code label set). The smallest *visible*
collapse is achieved either way; projecting through `v4DisplayStateFor` is the
faithful v4 vocabulary.

### Color / tone tokens (reuse existing — no new tokens)

`MediatorNodeMarker` already uses only `SURFACE_TOKENS` + `BORDER_WIDTH` + `RADIUS`
+ `SPACING` + `TYPOGRAPHY` from `src/lib/designTokens.ts`:

- fill `SURFACE_TOKENS.raised` (`#162033`), border `SURFACE_TOKENS.border`
  (`#1e293b`), text `SURFACE_TOKENS.textPrimary` (`#e2e8f0`, 11.4:1 contrast).
- `structured_impasse` → a **left rule** (`borderLeftWidth: 3`,
  `SURFACE_TOKENS.focusRing` `#a5b4fc`, ≥3:1) — geometry, not color alone
  (accessibility-targets "color is never the only signal"). Preserved verbatim.
- **No new hex literal, no new color token.** (NodeLabelStrip's test pins "no hex
  literal in NodeLabelStrip.tsx"; we are not editing that file's styles.)

### Accessibility (the chip)

- Today the chip is `accessibilityRole="text"` (a read-only badge), label
  `"Mediator note: <label>"`. **Preserved.** It is non-interactive, so no 44px
  target applies to the chip itself.
- **When the Inspect trigger is the interactive element** (see §3), it — not the
  chip — carries `accessibilityRole="button"`, `accessibilityLabel`,
  `accessibilityState`, and the 44×44 target. Keeping the chip itself non-interactive
  avoids a double-tappable surface and matches the shipped read-only contract.

---

## 3. The Inspect affordance (where the collapsed detail goes)

### Mechanism: reuse the shipped Inspect overlay — do NOT build a new popout/sheet

The smallest-safe mechanism is the **already-shipped Inspect path**, not a new
component:

1. The board-level **Inspect** control already exists (`InspectPopout`,
   `inspectVisible` state, the Act/Inspect/Go dock). Opening Inspect already mounts
   `NodeLabelInspectGroups` (the Machine Observations + User Allegations grouped
   view) for the active node at `ArgumentGameSurface.tsx:2477`.
2. **All of B's detail is already reachable there** — `NodeLabelInspectGroups` reads
   the same source adapters with `surface: 'inspect'` (a *superset* of what B's
   timeline view showed: it adds `inspect_only` marks and removes the 1+1 cap). So
   relocating B's content to Inspect requires **zero new rendering code** for the
   Observation/Allegation half of the collapse — it is already rendered there.
3. **The one addition:** the mediator structural state and its helper sentence are
   NOT in `NodeLabelInspectGroups` today. To honor "do not delete intelligence,"
   Inspect must show the **full mediator picture** for the node — not just the one
   chip — so the user can see *why* the state is what it is (the lifecycle trace,
   the open debt, the contributing Observations). This is added as a small,
   read-only **mediator-state detail block** at the top of the Inspect overlay (see
   §5 for the component decision).

### What Inspect preserves (nothing deleted, just relocated)

- **All Machine Observations** for the node (lifecycle, auto-metadata, composition
  mutation, semantic referee, classifier) — already rendered by
  `NodeLabelInspectGroups` "Machine Observations" group.
- **All User Allegations** (manual tags) — already rendered by the "User
  Allegations" group.
- **The full overflow** — Inspect is uncapped (`enforceInspectGroupedView`), so the
  "+N" that B hid is now fully visible.
- **The mediator structural state + helper** — the primary chip's state, plus
  `helperForMediatorState(displayState)` ("A source or quote was asked for and is
  still owed.", etc.), plus the next-move pathway label
  (`plainLanguageForPathwayStep`), as a read-only block. (NEW small block.)

### The Observations/Allegations distinction stays visible in Inspect (§10a)

`NodeLabelInspectGroups` renders **two separately-headed groups** ("Machine
Observations" / "User Allegations") with per-group counts. The one default chip is
the structural machine Observation; the Inspect detail keeps machine signals and
user signals in distinct, labelled groups. **The two are never collapsed into generic
"tags"** — preserved verbatim; no change to that component's grouping.

### Where the Inspect trigger lives + its a11y

The user opens this via the **existing Inspect control** (the board Act/Inspect/Go
dock — `inspectVisible`), which is already a touch-safe, role-`button`, labelled
control. **No new trigger is required** for the default-node case: the collapse is
"one chip by default; the rest is one Inspect tap away," and that tap is the existing
Inspect affordance.

- **Open question O-2:** should the one chip *itself* (or a tiny "Inspect" caret
  beside it) be the trigger, for discoverability, rather than relying on the board
  Inspect dock? Designer recommendation below.

---

## 4. Sensitive Observations — boundary preserved

Per cdiscourse-doctrine §10a, sensitive composer-only Observations
(`shifts_to_person_or_intent`, `contains_unplayable_insult_only`,
`needs_pre_send_pause`) must **never** surface on the target's node, on any surface.

This card preserves that boundary structurally and adds no path that could break it:

- **The one default chip** comes from the mediator board, which (UX-MEDIATOR-001 §5)
  never promotes a sensitive composer-only Observation to a point/node primary state.
  Unchanged.
- **Inspect** is fed by `filterMarksBySurface(..., 'inspect')`, which returns `false`
  for the `composer_only` and `hidden_sensitive` dispositions
  (`nodeLabelPresentationModel.isDispositionEligible`). Sensitive marks are
  `composer_only` and are **excluded from the `inspect` surface** — they only ever
  reach the `composer` surface. Unchanged.
- **Net:** moving B's content from the default view into Inspect does **not** widen
  exposure — Inspect already filtered sensitive marks out before this card. A test
  asserts a sensitive composer-only code never appears in either the default chip or
  the Inspect overlay for a node it targets.

---

## 5. Smallest-safe delta (components to change in implement) + what stays

### CHANGE — `src/features/arguments/ArgumentGameSurface.tsx` (the mount site only)

This is the **single source of the per-node markup** and the one file that owns the
double-mount. The delta is a mount change, not a derivation change:

1. **Unmount `NodeLabelStrip` from the default view.** Delete the `NodeLabelStrip`
   block (`:2188-2207`). The board is still derived once; B's *content* is not lost
   — it is the same source-adapter output already rendered by
   `NodeLabelInspectGroups` in the Inspect overlay (`:2477`). (~20 lines removed.)
2. **Keep `MediatorNodeMarker` as the one default chip** (`:2177-2180`). Optionally
   project its `code`/`label` through `v4DisplayStateFor` (O-1). (0–2 lines.)
3. **Add the mediator-state detail block to the Inspect overlay** so the chip's
   *reasoning* is preserved on Inspect (state label + helper + next-move pathway,
   read-only). Two implementation options — **designer recommendation: Option (a)**:
   - **(a)** A tiny new pure presentational component
     `src/features/mediator/MediatorNodeInspectDetail.tsx` (~50 lines) — read-only,
     RN primitives only, reuses `SURFACE_TOKENS`/`TYPOGRAPHY`, takes the
     `NodeMediatorMarker` + `helperForMediatorState` + pathway label as props.
     Mounted as a sibling **above** `NodeLabelInspectGroups` inside the same
     `inspectVisible && activeMessageId` gate (~10 lines at the mount site).
   - **(b)** Inline the block directly in `ArgumentGameSurface` (no new file, ~15
     lines). Cheaper, but mixes presentation into the surface; (a) is more testable
     and matches the shipped "small read-only sibling overlay" pattern
     (`NodeLabelInspectGroups`, `MetadataDiffInspector`).

### UNTOUCHED (preserve byte-for-byte / behavior)

- `src/features/mediator/MediatorNodeMarker.tsx` — the chip component itself
  (visual grammar, impasse left-rule, a11y). *(Only its caller's argument changes
  under O-1, not the component.)*
- `src/features/mediator/nodeMediatorMarkers.ts` — selection/suppression priority.
  *(If O-1 is adopted, the `v4DisplayStateFor` projection is applied at the marker's
  `label`/`code` mapping, a ~4-line additive change here; otherwise untouched.)*
- `src/features/mediator/deriveMediatorBoardState.ts`, `mediatorBoardTypes.ts`,
  `mediatorPlainLanguage.ts` — **no precedence/copy change** (UX-MEDIATOR-001/004 own
  those).
- `src/features/nodeLabels/NodeLabelStrip.tsx` — **not deleted, not edited.** It is
  simply no longer mounted in the default view. (It remains exported and tested for
  its pure helper; a future selected-context surface could reuse it. Keeping the file
  avoids breaking its tests and its `nodeLabels/index.ts` export.)
- `src/features/nodeLabels/NodeLabelInspectGroups.tsx` + the whole `nodeLabels`
  source-adapter / presentation-model / descriptor pipeline — **unchanged**; Inspect
  already renders the relocated content.
- `src/features/nodeAnnotations/*` primitives — unchanged.
- `DisagreementPointsRail.tsx` and the rail mount — unchanged (out of scope §9).
- The single-derivation site (`deriveRoomMediatorBoardState` in
  `ArgumentGameSurface`) — invariant preserved; the board is consumed, never
  re-derived.

### Net file count

- **Modified:** 1 (`ArgumentGameSurface.tsx`) — unmount B, keep A, mount the Inspect
  detail block. Optionally 1 more (`nodeMediatorMarkers.ts`) if O-1 is adopted.
- **New:** 0–1 (`MediatorNodeInspectDetail.tsx`, recommended Option (a)).
- **Deleted:** 0.

### Existing tests that PIN the current multi-chip markup (must be reconciled in implement)

| Test file | What it pins | Reconciliation in implement |
|---|---|---|
| `__tests__/NodeLabelStrip.test.tsx` | `computeNodeLabelStripDescriptors` behavior + that the component composes `AnnotationChipStrip` + no new hex/primitive | **Stays green** — the file is not edited; the pure helper still works. The component just isn't mounted in the default view. If any assertion checks that `NodeLabelStrip` is *mounted* in `ArgumentGameSurface`, that assertion must move to assert it is mounted **in Inspect only / not in the default view** (see ArgumentGameSurface wiring tests below). |
| `__tests__/MediatorNodeMarker.test.tsx:48` | the marker renders labels incl. `'Definition needed'`, `'Off-point response'`, `'Scope mismatch'`, etc.; no ban-list tokens | **Stays green if O-1 not adopted.** If O-1 (project through `v4DisplayStateFor`) is adopted, the marker for an internal `off_point` will render `'Scope mismatch'` not `'Off-point response'`; that test feeds the marker an explicit label so it still passes, but `nodeMediatorMarkers.test.ts` (which maps code→label) needs updating to expect the display-projected label. |
| `__tests__/nodeMediatorMarkers.test.ts` | `getNodeMediatorMarker` code/label/priority, `NODE_MARKER_PRIORITY[0]==='structured_impasse'` | **Untouched if O-1 not adopted.** If O-1 adopted: update the label/code expectations for the 4 collapsed codes (`off_point`→`scope_mismatch`, `key_detail_unavailable`→`evidence_blocked`, `value_tradeoff`→`open`-display-suppressed, `missing_mechanism` keeps "Missing link") in lockstep. |
| `__tests__/NodeLabelInspectGroups.test.tsx` | the two-group Observations/Allegations Inspect view | **Stays green** — that component is unchanged; the new mediator detail block is a *sibling*, not a modification. |
| `ArgumentGameSurface` wiring/integration tests (any that assert the default view mounts both `mediator-node-marker-active` and `node-label-strip-*`) | the **double-mount** | **Must change** — these are the tests that encode the soup. Update to assert: default view mounts exactly `mediator-node-marker-active` (one chip), `node-label-strip-*` is NOT in the default tree, and the Inspect overlay (when open) mounts `ux001-5a-inspect-groups-overlay` + the new mediator detail block. *(The implement step greps for `node-label-strip` and `mediator-node-marker` testIDs in the `__tests__` tree to find every pin before editing.)* |

**Reconciliation principle:** the soup is encoded as "both A and B mount by default."
The implement step must locate every test that asserts that pairing and flip it to
"A mounts by default; B's content is in Inspect." No pure-model test changes except
the optional O-1 label projection.

---

## 6. Responsive / a11y

- **The one chip** is `alignSelf: 'flex-start'`, single-line (`numberOfLines={1}`),
  read-only `Text`. It does not overflow at 320/360/390/414 — it shrinks to its label
  width and truncates with ellipsis at the smallest band. No horizontal scroller, no
  multi-chip row to wrap. **Removing B** also removes B's `AnnotationChipStrip` row,
  which is the wider, wrap-prone element — so this card *reduces* overflow risk at
  small widths.
- **The Inspect trigger** is the existing board Inspect control, already verified
  touch-safe (44×44 / `hitSlop`) and role-`button` with a label. If O-2's chip-caret
  trigger is adopted, that caret must meet 44×44 via `hitSlop` and carry
  `accessibilityRole="button"`, `accessibilityLabel="Inspect this node's details"`,
  `accessibilityState={{ expanded: inspectVisible }}` at every band.
- **Inspect detail block** is read-only `Text` (role `text`); group headers in
  `NodeLabelInspectGroups` already carry their labels + counts. The mediator detail
  block's state label, helper sentence, and next-move label are each their own
  `<Text>` (all strings inside `<Text>`; no raw strings in `View`).
- **Reduce motion:** the chip has no animation; the impasse treatment is a static
  left rule (no glow pulse). No motion is added. (Reduce-motion handoff to
  UX-ACCESSIBILITY-001 unchanged.)
- **Color independence:** the impasse left-rule carries meaning by geometry; the
  chip's meaning is carried by its text label, not color. Grayscale-legible.

---

## 7. Test plan (`__tests__/`)

New / updated tests:

- **`__tests__/uxMediator002NodeMarkup.test.tsx`** (new) — the core acceptance:
  - **Exactly one primary state chip by default.** Render `ArgumentGameSurface` (or
    the minimal node-markup subtree) for an active node with a mediator state AND
    node-label marks present; assert the default tree contains exactly one
    `mediator-node-marker-*` and **does NOT contain** any `node-label-strip-*`.
  - **Ordinary open node carries no chip.** A node whose state is `open`/`resolved`
    renders no `mediator-node-marker-*` (suppression preserved).
  - **Inspect reveals the preserved detail.** With `inspectVisible` true, assert the
    Inspect overlay mounts `ux001-5a-inspect-groups-overlay` (Machine Observations +
    User Allegations groups) AND the new mediator detail block (state label + helper
    + next-move pathway). Assert the Observation/Allegation **group headers** are both
    present (the §10a distinction is visible in Inspect).
  - **Nothing deleted.** Given a node with N machine Observations + M user Allegations
    (N+M > 2, i.e. the old strip would have shown overflow), assert all N+M appear in
    Inspect (uncapped) — the relocated content is complete.
  - **Sensitive Observation never on the target node.** Feed a `composer_only`
    sensitive code (`shifts_to_person_or_intent`); assert it appears in **neither**
    the default chip nor the Inspect overlay for that node.
  - **Labels ban-list clean.** Scan all rendered strings (chip + Inspect block) for
    `_forbiddenMediatorTokens()` and snake_case leaks → none.
  - **A11y.** The chip has `accessibilityRole="text"`; if O-2's caret trigger is
    adopted, it has role `button` + label + `accessibilityState.expanded` + 44×44
    (or `hitSlop`).
- **`__tests__/nodeMediatorMarkers.test.ts`** (update **only if O-1 adopted**) —
  expect `v4DisplayStateFor`-projected label/code for the 4 collapsed internal codes.
- **`__tests__/MediatorNodeInspectDetail.test.tsx`** (new, if Option (a)) — pure
  render test: shows the state label, helper, and pathway; renders nothing when
  marker is null; no ban-list tokens; RN-primitive only (no new hex).
- **Regression — rail untouched.** Re-run `__tests__/{disagreementPointsRail*,
  mediatorBoardState,mediatorPrecedence,nodeMediatorMarkers,NodeLabelStrip,
  NodeLabelInspectGroups,nodeLabelPresentationModel,nodeLabelSourceAdapters,
  roomMediatorAdapter}.test.*` — all green; the rail's one-badge-per-point behavior
  is unchanged.
- **Gates:** `npm run typecheck`, `npm run lint`, `npm run test` all exit 0; test
  count goes up.

---

## 8. Dependencies (cards / docs / files)

- **Depends on UX-MEDIATOR-001** (merged) — consumes `v4DisplayStateFor` + the v4
  display vocabulary for the one chip's label (O-1). `docs/designs/UX-MEDIATOR-001.md`.
- **Reads existing (no re-derivation):** the once-derived `MediatorBoardState`
  (`deriveRoomMediatorBoardState` at `ArgumentGameSurface.tsx:~683`),
  `getNodeMediatorMarker`, `plainLanguageForMediatorState`/`helperForMediatorState`/
  `plainLanguageForPathwayStep` (`mediatorPlainLanguage.ts`), the `nodeLabels`
  source-adapter pipeline (already feeding `NodeLabelInspectGroups`).
- **Reuses shipped Inspect path:** `InspectPopout` + `inspectVisible` +
  `NodeLabelInspectGroups` (`ArgumentGameSurface.tsx:2477`) — the relocation target.
- **Single-derivation invariant** (`memory: mediator-board-single-derivation`):
  board derived ONCE, shared by rail + node markup — this card adds no second
  derivation.
- **Blocks / feeds:** UX-SELECTED-NODE-001 (deeper selected-node anatomy — consumes
  the one-chip default), UX-NEXT-MOVE-001 (Act suggestions off the one state),
  UX-MEDIATOR-004 (the "Definition not shared" rename — touches the chip's label
  text only after this card lands).

---

## 9. Risks

- **R1 — A wiring test asserts the double-mount.** The soup is encoded somewhere as
  "both markers mount." *Mitigation:* the implement step greps `__tests__` for
  `node-label-strip` and `mediator-node-marker` before editing, and flips the
  double-mount assertion to single-chip-default + content-in-Inspect.
- **R2 — Relocating B could *appear* to lose content if Inspect's surface filter
  diverges from B's timeline filter.** They differ on purpose (Inspect is a
  superset: adds `inspect_only`, removes the 1+1 cap, still excludes sensitive). The
  "nothing deleted" test (§7) proves every timeline-eligible mark still appears in
  Inspect. *Mitigation:* the test asserts N+M completeness.
- **R3 — O-1 label-projection churn.** Projecting the chip through `v4DisplayStateFor`
  changes the chip label for `off_point`/`key_detail_unavailable`/`value_tradeoff`
  nodes, touching `nodeMediatorMarkers.test.ts`. *Mitigation:* O-1 is offered as a
  decision; if deferred, the card is a pure mount change with zero label churn and
  still collapses the soup.
- **R4 — Discoverability of relocated detail.** If the only way to reach the moved
  content is the board Inspect dock, users may not find it. *Mitigation:* O-2 (a
  chip-side "Inspect" caret) is offered; designer recommends adopting it for
  discoverability since the whole point is "one chip, detail one tap away."
- **R5 — `ArgumentGameSurface` is large and heavily-pinned.** Editing its mount tree
  risks an unrelated snapshot. *Mitigation:* the delta is localized to two adjacent
  sibling blocks (`:2177-2207`) + one Inspect-overlay sibling (`:2477`); run the
  full suite, not a tailed run (test-discipline gate-timeout rule).

---

## 10. Out of scope (explicit non-goals)

- **NO precedence-model change** — UX-MEDIATOR-001 owns the derivation + `v4DisplayStateFor`.
- **NO Disagreement Points rail redesign** beyond it consuming the one-chip vocabulary
  — UX-MEDIATOR-005. The rail is untouched here.
- **NO chime-in** mechanics.
- **NO persistence / migration / Edge Function / deploy / provider call.**
- **NO MCP / classifier activation** — Inspect renders *already-persisted* observation
  rows only (MCP-021B path), exactly as today.
- **NO new mediator state codes.**
- **NO submission-gate / room-seat change** — role/seat/chime-in/voice remain badges,
  never the state; the chip never gates posting.
- **NO `'Definition needed' → 'Definition not shared'` visible rename** — UX-MEDIATOR-004.
- **NO selected-context (3+3) strip** — not mounted today; not added here.
- **NO deletion of `NodeLabelStrip`** — it is unmounted from the default view, not
  removed from the repo (keeps its tests + export intact).

---

## 11. Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the one
  chip is a structural state ("Needs evidence", "Structured impasse"), never a
  verdict/person/truth label; it is read-only and gates nothing. PASS.
- **§2 (heat ≠ truth):** no heat/temperature/engagement signal enters the chip or the
  Inspect detail. PASS.
- **§3 (popularity is not evidence):** no like/view/follower/amplification token in
  any rendered string (ban-list test). PASS.
- **§4 (AI moderator limits):** the relocated Machine Observations are advisory,
  `authoritative:false`, never modify/hide/delete content, never run on a network in
  the app. This card moves *where* they render, not *what* they are. PASS.
- **§9 (plain language):** every rendered string flows through the plain-language
  maps (`mediatorPlainLanguage`, the `nodeLabels` descriptor adapter); snake_case
  leaks are stripped at the descriptor boundary and re-asserted by the new test. PASS.
- **§10a (Observations vs Allegations):** the one default chip is the structural
  machine **Observation**; the Inspect detail keeps the "Machine Observations" and
  "User Allegations" groups separate and labelled (never generic "tags"); sensitive
  composer-only Observations reach **neither** surface for the target node (the
  `inspect`/`timeline_node` surface filters exclude `composer_only`). PASS.
- **§10 (v1 scope):** no voting/winner, no search, no OAuth, no push, no public API,
  no realtime body editing. PASS.
- **accessibility-targets:** chip stays read-only `text`; the interactive Inspect
  trigger is 44×44 + role `button` + label + `accessibilityState`; color independence
  preserved (impasse left-rule); no new motion. PASS.
- **test-discipline:** new render tests (one-chip-default, Inspect-reveals-detail,
  nothing-deleted, sensitive-boundary, ban-list, a11y) + regression re-run of the
  mediator/node-label/rail suites; test count up; full-suite exit-0 gate. PASS (plan).

---

## 12. Operator steps (if any)

**None — pure code change.** No `db push`, no `functions deploy`, no env var, no
migration. The implement step ships a UI-model delta (mount change + one small
read-only Inspect block) merged via the normal green-PR path; the single-derivation
site picks up the new behavior with no operator action.

---

## Open questions for the operator (with designer recommendation)

- **O-1 (chip vocabulary — visible label decision):** Should the one default chip
  render the **v4 display vocabulary** (project the marker through
  `v4DisplayStateFor`, so an internal `off_point` shows "Scope mismatch", etc.), or
  keep the **shipped 13-code labels** on the chip (zero label churn)?
  **Recommendation: project through `v4DisplayStateFor`** — it is the faithful v4
  collapse the card is named for, keeps `point.state` intact for Inspect, and is a
  ~4-line additive change with a lockstep `nodeMediatorMarkers.test.ts` update. If
  the operator wants the absolute-minimum diff, defer the projection and the card is
  a pure mount change (still collapses the soup visually).

- **O-2 (Inspect trigger prominence — discoverability):** Reach the relocated detail
  via (a) the **existing board Act/Inspect/Go dock only** (zero new UI), or (b) add a
  small **"Inspect" caret beside the one chip** (44×44 `hitSlop`, role `button`,
  `accessibilityState.expanded`) so the detail is discoverably one tap from the chip?
  **Recommendation: (b)** — the card's whole premise is "one chip, detail one tap
  away"; a chip-adjacent caret makes that obvious. Falls back to (a) cleanly if the
  operator prefers no new affordance.

- **O-3 (mediator detail block — file vs inline):** Add the mediator-state Inspect
  detail as (a) a small new pure component `MediatorNodeInspectDetail.tsx`, or (b)
  inline in `ArgumentGameSurface`? **Recommendation: (a)** — matches the shipped
  "small read-only sibling overlay" pattern (`NodeLabelInspectGroups`,
  `MetadataDiffInspector`), is independently testable, and keeps the surface file
  from growing presentation logic.

- **O-4 (rail consistency):** This card leaves `DisagreementPointsRail` as-is
  (one badge per point already). Should the rail's badge label also adopt the
  `v4DisplayStateFor` vocabulary in lockstep, or is that explicitly UX-MEDIATOR-005?
  **Recommendation: defer to UX-MEDIATOR-005** (rail redesign is its card); if O-1
  ships the display vocabulary on nodes, note the rail will briefly show the 13-code
  labels until 005 — acceptable and called out here.

---

## Recommended implement-step scope

Touch **1 file** (mount change) + **0–1 new file** + **0–1 optional helper line**:

1. `src/features/arguments/ArgumentGameSurface.tsx` — unmount `NodeLabelStrip`
   (`:2188-2207`); keep `MediatorNodeMarker` (`:2177-2180`); mount the mediator-state
   Inspect detail block (sibling of `NodeLabelInspectGroups` under the existing
   `inspectVisible && activeMessageId` gate).
2. (O-3 = a) `src/features/mediator/MediatorNodeInspectDetail.tsx` — new pure
   read-only block.
3. (O-1) `src/features/mediator/nodeMediatorMarkers.ts` — project the marker label/code
   through `v4DisplayStateFor`.
4. (O-2 = b) the chip-adjacent "Inspect" caret trigger in `ArgumentGameSurface`.

Plus tests: `__tests__/uxMediator002NodeMarkup.test.tsx` (+ `MediatorNodeInspectDetail.test.tsx`
if O-3=a; update `nodeMediatorMarkers.test.ts` if O-1). Run
`npm run typecheck && npm run lint && npm run test` (full suite, exit-0); confirm the
mediator + node-label + rail suites are green and the test count goes up. No backend,
no migration, no deploy.
