# CARD-VIEW-DETAIL-HUB-001 — Cards screen as the canonical per-node DETAIL HUB

**Status:** **Ratified** (operator design-review 2026-06-06; visibility clarification + all OQ resolutions folded in)
**Date:** 2026-06-06
**Owner:** roadmap-designer (orchestrator-spawned)
**Extends:** CARD-VIEW-DATA-001 / #516 (the display-only Cards detail panel this card builds on)
**Epic:** Epic 2 / Epic 8 (argument node rendering · timeline + cards surface) — UI/UX only
**Release:** UX track (Stage 6.x, post-#516); ships with the next Expo build
**Surface:** `src/**` only. No migration, no Edge, no `supabase/**`, no provider call, no Supabase write.

> **This is a DESIGN-ONLY artifact.** It describes the change a later implementer
> card will build. No production code is written by this card. Every file path,
> shape, and builder name below is a *plan*, not an implementation.

---

## 0. Ratification (operator design-review, 2026-06-06)

**RATIFIED with one binding clarification:** on the **Card page, "Full details"
is NOT a collapsed / tap-gated disclosure** — the Card is the read-everything
surface where details are **always rendered and visible by default** (lower in
visual hierarchy / below fold / in columns is fine; hidden behind a tap is not).
**Tap-to-reveal belongs only to the Timeline page.** Fork 5 / §7.1 are updated to
encode this, and a new adversarial check (#14) locks "Card-visible vs
Timeline-disclosed."

- **Fork 2 approved** — share the pure detail model, project separate Cards +
  Timeline renderers; do NOT merge render components. `argumentDetailModel.ts` is
  the shared derivation layer; the two renderers keep their different disclosure
  postures.
- **Explicit A–G family display gate is required** and must NOT trust
  `rendered_now` alone; the seeded Family I (`thread_topology`) negative test is a
  hard adversarial test.

**Open Question resolutions (operator):**
- **OQ-iv** — display-expansion ONLY; **do not use the label "Add Classifier"**
  (implies mutation) → neutral heading e.g. "Classifier observations" / "All
  classifier observations (A–G)" / "Classifier evidence". Any write / recompute /
  pin action = a SEPARATE Edge/Admin card.
- **OQ-i** — 120-char parent quote; use the already-computed parent excerpt if
  available, else a neutral placeholder ("Parent unavailable" / "Parent not
  loaded"); no fetch.
- **OQ-ii** — group tags by doctrine category (Observations / Allegations /
  structural labels / status chips); neutral language; never author judgments.
- **OQ-iii** — A–G only (regardless of `rendered_now` from H/I/J); family-grouped;
  uncapped within the allowed set; visible evidence spans/details on the Card;
  seeded Family I negative test required.
- **OQ-3** — accept the three-section narrative spine; #516's flat panel becomes a
  prior data slice, not the final IA.
- **OQ-4** — buttons-only Prev/Next; chronological; no wrap; disabled at
  boundaries; no overlay carousel.
- **OQ-5** — visual hierarchy ONLY, not disclosure on the Card (see clarification
  above).
- **OQ-5b** — 3 columns ≥1024; stacked below; same content + same order
  discipline; never drop sections on mobile, only reflow.
- **OQ-7** — parent token switches the active card (no inline overlay).
- **OQ-fam** — real follow-on: gate the new hub now; then file/update a follow-on
  to apply the same family display gate to #516's existing strip (latent
  inconsistency exists *before* Family I enablement — do not wait for #392/#394).

---

## 1. Header

Make the CDiscourse **Cards** view the canonical per-node **DETAIL HUB** — the
deep, default-visible, multi-column read of a single argument node — while the
**Timeline** view stays the chronological overview + navigator with its lighter
tap-to-reveal detail. Both surfaces consume **ONE shared pure detail
view-model + named pure builders** so the narrative detail structure lives in a
single place and never forks.

---

## 2. Context & problem

### 2.1 What #516 shipped (inherited baseline)

CARD-VIEW-DATA-001 (#516) added `buildCardDetailViewModel` +
`CardDetailPanel.tsx`: an **8-zone, display-only** detail panel rendered inline
on the ACTIVE card by default (no tap), under
`src/features/arguments/cardView/`. Zones today: step-reference → category +
qualifier → classifier strip (capped ≤3) → evidence + debt → standing →
lifecycle → semantic flags. Every zone is `accessibilityRole="text"`; the only
interactive element is the step-reference parent token (`#N` → jump to parent).

The Timeline side has a parallel-but-forked detail stack: `ArgumentReplySidecar`
(`SidecarViewModel`, 6 narrative sections behind a "Hide full details" expand)
plus its timeline-only wrapper affordances. The two stacks share exactly **one**
derived datum today: the Cards Zone 8 reuses the sidecar's `semantic_flags`
chip labels (`ArgumentGameSurface.tsx:782-788`).

### 2.2 The operator's visual intent (markup north star)

From the operator's three annotated screenshots
(`.claude-tmp/CARD-VIEW-DETAIL-HUB-001-markup-inventory.md`):

- The **Timeline detail panel IS the structure** the operator wants the Cards
  screen to become — its three narrative sections (WHAT THIS MOVE SAYS / WHY IT
  MATTERS / WHAT IS UNRESOLVED), its **italic replied-to quote box**, and its
  **Standing / Tone / Heat strip**.
- The Cards screen should expose **more** than the Timeline node currently
  shows: (i) the italic replied-to **parent quote** (Timeline has it; Cards
  lacks it), (ii) **all relevant** semantic tags (not a truncated 2-chip
  subset), (iii) **all MCP families'** classifier feedback (not the ≤3 cap).
- The two large empty rectangles flanking the centered card signal a **wide
  multi-column layout**: semantic-tags column · centered move · MCP-family
  classifier column.
- "Add Classifier" is the one genuinely ambiguous ask (Open Question §12).

### 2.3 Why Cards should be the hub

The surface code already encodes this division: `VIEW_MODE_COPY` calls Cards the
"deeper card-inspection mode" and Timeline the "primary board"
(`viewModeCopy.ts`), with `DEFAULT_VIEW_MODE='timeline'`. Cards is doctrinally
the deep-read surface already; #516 made it default-visible. This card finishes
the job: it lifts the Cards detail to the operator's full multi-column hub and —
critically — re-anchors the narrative structure on a shared primitive so the
Timeline detail and the Cards hub never drift apart.

---

## 3. Doctrine section (VERBATIM — HARD constraints inherited from #463 / #516)

These are restated verbatim from the card brief §2. They bind the eventual
build, not just this design.

1. **Acceptance-gate invariant:** `src/lib/constitution/engine.ts` (pure TS) is
   the SOLE submission acceptance gate. This card and its eventual build are
   PRESENTATION ONLY — they change how an already-stored node is DISPLAYED. No
   change to submission acceptance; no moderate/modify/reactivate; no
   classifier/provider call; no routing/family-state change.
2. **§10a / policy_no_censorship — `inactive_reason` non-exposure.** The hub
   shows WHAT is inactive (the `inactiveAt`-derived `isInactive` badge), NEVER
   WHY. `inactive_reason`/`inactive_by` are not fields on any proposed
   view-model, not in any SELECT, not in any rendered label. Enforced at type
   level + poisoned-fixture test in the eventual build.
3. **Display-only labels except real navigation.** Every detail element is a
   display-only label (`accessibilityRole="text"`) EXCEPT genuine navigation
   affordances (the parent-jump/reply token; node-to-node nav). No detail
   element becomes an action surface (no moderate/reactivate/re-classify/
   flag-mutation control).
4. **Classifier strip is advisory, never a verdict** — "what the referee
   noticed — advisory, not a verdict." Observations describe the TEXT, never
   judge the author.
5. **Confidence as PIPS, not numbers.**
6. **Pure `src/**` — not deploy-bearing.** Eventual build: no migration, no
   Edge, no `supabase/**`. Ships with the next Expo build; rollback = code
   revert, no state to unwind.
7. **DRY with the Timeline detail (THE engineering invariant).** The narrative
   detail structure must live in ONE place both Timeline and Cards consume. A
   forked detail implementation is the failure mode this card exists to prevent.

### 3.1 Doctrine-skill cross-checks (applied to this design)

- **cdiscourse-doctrine §1 / §2 / §3:** no truth/winner labels; "Standing"
  describes a point's game standing not truth; "Heat" describes activity not
  correctness or popularity; Standing/Tone/Heat bands all describe the TEXT, not
  the author. Score never blocks posting (this is presentation only).
- **cdiscourse-doctrine §9 / §10a:** every rendered label routes through
  `toPlainLanguageOrSuppress` or the definition registry; unknown internal
  codes are suppressed, not echoed. Machine Observations vs User Allegations
  stay distinct (the classifier strip is Observations-only).
- **timeline-grammar:** the hub renders the same type/strength/heat grammar the
  Timeline uses; it must NOT invent a new visual that drifts into a truth claim.
  Standing band stays the band, never "Correct"/"True". Grayscale snapshots
  must remain legible (shape/glyph carry meaning, not color alone).
- **accessibility-targets:** every Pressable ≥44×44 (or `hitSlop`); the only
  Pressables on the hub are navigation (parent token, prev/next, spine);
  everything else is `accessibilityRole="text"`. Multi-column reflow preserves
  reading order. Reduce-motion honored (the panel is static; no toggle
  animation required for default-visible content).

---

## 4. Information inventory (per-node facts; data sources confirmed read-only)

All facts below already exist, hydrated from pre-computed structures in
`ArgumentGameSurface` (`timelineMap`, `lifecycleMap`, `metadataLedger`,
`evidenceDebts`, `manualTagsByMessageId`, `persistedObservationsByArgumentId`,
`artifactsByMessageId`, `viewModels`, `sorted`). **Zero new fetch, zero
service-role, zero AI round.** Surfacing more on the hub is a *threading +
view-model extension* exercise, not a data-fetch exercise.

> Note on paths: the discovery brief abbreviated some paths; the verified
> locations are under `src/features/arguments/cardView/` for the card-detail
> model + panel.

| Fact | Tag | Data source (verified) |
|---|---|---|
| Move type / kind | display-only | `viewModels[].kindLabel`; threaded via `kindLabelOf` → `cardDetailModel.ts` |
| Side | display-only | `viewModels[].sideLabel`; `ArgumentBubbleViewModel.sideLabel` |
| Body | display-only | rendered by the card face (`ArgumentBubbleCard.tsx`), NOT the detail panel |
| **Replied-to / parent quote text** | display-only | parent node `bodyPreview` (`argumentGameSurfaceModel.ts:643`, `shortBodyPreview`); sidecar truncates to 120 (`argumentReplySidecarModel.ts:393-395`). **NOT threaded into Cards today** — new input |
| Standing band | display-only | `timelineMap.nodes[].standingBand` (`argumentGameSurfaceModel.ts:664`); labels `standingBandCopy.ts`. On card via `standingHint` (Zone 6) |
| **Tone band** | display-only | `timelineMap.nodes[].toneBand` (`:665`); `inferToneBand` (`:1013`). **NOT threaded into Cards today** |
| **Heat / temperature band** | display-only | `timelineMap.nodes[].temperatureBand` (`:666`); `inferTemperatureBand` (`:1022`). **NOT threaded into Cards today** |
| Category | display-only | `_categoryLabelById[id]` → Zone 2 |
| Qualifier(s) | display-only | `activeViewModel.qualifierBadges` → Zone 2 |
| Classifier marks (machine observations) | display-only | `persistedObservationsByArgumentId[id]` (`ArgumentGameSurface.tsx:189`) → `buildCardClassifierStrip` (`cardClassifierStripModel.ts`); family on the parallel registry via `lookupMachineObservationDefinitionByCompoundKey(source, rawKey).family` (`machineObservationDefinitions.ts:149`). **Hub gating is by family allow-list (A–G `productionEnabled:true`), NOT disposition alone — see §6.5 step 1b** |
| Evidence sources | display-only | `artifactsByMessageId[id]` → `artifactsToEvidenceSources` (Zone 5) |
| Evidence debt | display-only | `evidenceDebts` → `getNodeEvidenceDebtSummary`/`getNodeEvidenceDebtChip` (Zone 5) |
| Lifecycle (cluster state) | display-only | `lifecycleMap.byMessage.get(id).clusterState` → `toPlainLanguageOrSuppress` (Zone 7) |
| Disagreement axis | display-only | `lifecycleMap.byMessage.get(id).axis` |
| Semantic flags | display-only | sidecar `semantic_flags.chips` → Cards Zone 8 (`ArgumentGameSurface.tsx:782-788`) |
| Auto-metadata codes | display-only | `metadataLedger.byMessage.get(id).autoDerivedMetadata` |
| Manual tag entries (User Allegations) | display-only | `manualTagsByMessageId.get(id)` |
| **Step reference (position context)** | **navigation** | `buildStepReferenceLine` (`cardStepReferenceModel.ts`); `parentOrdinalToken` + `parentMessageId` — the ONE tappable element today |
| Reply / descendant count | display-only | `timelineMap.nodes[].replyCount` / `descendantCount` |
| **Parent ordinal token** | **navigation** | `CardStepReferenceHeader.tsx:74-86` → `onActivateAncestor(parentMessageId)` |
| `isInactive` badge | display-only | `deriveRevisionIsInactive(row)` = `(row.inactiveAt ?? null) !== null` (`argumentArtifactModel.ts:108`). **Temporal-only. Never reads `inactiveReason`.** |

**Hard exclusion:** `inactiveReason` / `inactive_by` are not on any view-model,
not in any input, not in any rendered label (Doctrine §2). The comment at
`argumentArtifactModel.ts:14-18` states `inactiveReason` is never read — that
invariant is preserved.

---

## 5. Resolved architecture (the seven forks)

### Fork 1 — Cards ↔ Timeline division of labor — **RESOLVED**

**Decision.** Codify the existing division; move **nothing** between surfaces.

- **Timeline = the primary board.** Chronological overview, spine/scrubber
  navigation, rail grammar, the *lighter inline summary* of the active node
  behind its existing "Hide full details" expand (`ArgumentReplySidecar` in
  condensed mode). Unchanged in behavior.
- **Cards = the deep per-node read (the HUB).** Full, multi-column,
  default-visible (no tap) detail of one node. This is where the operator's
  three new exposures land (parent quote, all tags, all-families classifiers)
  plus the Standing/Tone/Heat strip.

**Rationale.** Discovery confirms Cards is already doctrinally the
"deeper card-inspection mode." Reassigning responsibilities between surfaces
would expand blast radius and risk the Timeline's stable navigation. The card's
value is *depth on Cards + a shared primitive*, not a re-layout of Timeline.

### Fork 2 — the DRY anchor — **RESOLVED (engineering invariant; not deferred)**

**Decision = "share the model, project the view."**

1. **Extract a shared pure superset detail view-model** into a new module —
   `src/features/arguments/detail/argumentDetailModel.ts` (proposed name) —
   exporting a `ArgumentDetailViewModel` with a `surface: 'timeline' | 'cards'`
   discriminator and **optional slices**, where each consumer renders the slices
   it needs.
2. **Move the already-pure named builders** into (or re-export from) that shared
   module so BOTH surfaces import them from one place:
   `buildStepReferenceLine`, `buildCardClassifierStrip`,
   `buildSectionSemanticFlags` (the sidecar's semantic-flag chip builder),
   `artifactsToEvidenceSources`, and the **band formatters** (a single shared
   `formatStandingLine` / `formatToneLine` / `formatHeatLine` family — today the
   sidecar emits raw band tokens; the shared formatters route bands through
   plain-language maps, see §6.4).
3. **Project two thin surface-specific render components** from the shared model:
   `ArgumentReplySidecar` (timeline projection — 6 sections, ScrollView,
   condensed) and `CardDetailPanel` / its hub successor (cards projection —
   multi-column zones, default-visible). **Do NOT merge the two rendered
   components in this card** — the ScrollView/6-section vs inline/multi-column
   divergence makes a single rendered primitive over-reach.

**Shape (superset model).** JSON-serializable, pure-TS, no React:

```ts
// src/features/arguments/detail/argumentDetailModel.ts  (proposed)
export type DetailSurface = 'timeline' | 'cards';

export interface ArgumentDetailViewModel {
  surface: DetailSurface;
  activeMessageId: string;

  // ── narrative spine (the markup's three sections) ──
  whatThisMoveSays: DetailMoveSaysSlice;          // body excerpt, side/kind/actor, createdAt, parent quote, S/T/H strip
  whyItMatters: DetailWhyItMattersSlice;          // lifecycle label + helper (suppress unknown)
  whatIsUnresolved: DetailUnresolvedSlice;        // open requests / debts / "Nothing unresolved here."

  // ── enumerated signals (#516's zones, folded into the spine) ──
  stepReference: CardStepReferenceLine;           // navigation (parent token)
  category: string | null;
  qualifiers: ReadonlyArray<string>;
  classifier: ArgumentDetailClassifierSlice;      // family-grouped, surface-scoped cap (see Fork 3 / ask iii)
  evidence: CardDetailEvidenceZone;               // sources + debt
  standing: { label: string | null };
  semanticTags: ArgumentDetailTagsSlice;          // full tags (ask ii) — manual + auto + dropped qualifiers
  whereItSits: DetailWhereItSitsSlice | null;     // timeline-only slice; null on cards

  // ── lifecycle badge (temporal-only) ──
  isInactive: boolean;                            // from inactiveAt ONLY — never inactiveReason
}
```

Each surface selects slices: the **cards** projection renders the full
`semanticTags` + uncapped family-grouped `classifier` + the parent-quote zone +
the S/T/H strip; the **timeline** projection renders the condensed slices behind
"Hide full details" exactly as today. `whereItSits` is timeline-only (`null` on
cards). `CardDetailViewModel` (the #516 shape) can be retained as a derived
narrowing of the superset, or the cards projection consumes the superset
directly — implementer's choice within Slice 1, but the **derivation logic lives
in one place** either way.

**Invariant the test must lock (Fork 2 proof):** both `ArgumentReplySidecar`
(timeline) and the Cards hub component consume the SAME shared builders/model —
a test asserting neither surface re-implements the narrative derivation (no
forked detail logic). See §10.

**Rationale.** Discovery is decisive: the pure view-model is feasible and
recommended; merging the rendered components is over-reach. This is the no-fork
win the card exists to claim.

### Fork 3 — narrative vs enumerated vs merged — **RESOLVED (MERGE)**

**Decision.** Adopt the markup's **narrative sections as the spine**, folding
#516's enumerated signals into the appropriate section/slice of the superset
model. Exact section → slice mapping:

| Markup narrative section | Folds in (#516 enumerated signals) |
|---|---|
| **WHAT THIS MOVE SAYS** | move type/side/actor, created-at + relative, body excerpt, **parent quote (ask i)**, category + qualifier, **Standing / Tone / Heat strip (ask v)** |
| **WHY IT MATTERS** | lifecycle state (plain-language; unknown suppressed), disagreement axis |
| **WHAT IS UNRESOLVED** | evidence debt summary, open requests (`source_requested` / `quote_requested` / `no_response_after_n_turns` / `point_stalled`) |
| **(zone, rendered after the spine on cards)** | **Classifier strip — all relevant families (ask iii)**, **Evidence sources**, **Semantic tags — all relevant (ask ii)** |

The classifier / evidence / semantic-tags blocks are not naturally part of the
three narrative sentences, so on the Cards hub they render as **labeled detail
blocks below the spine** (consistent with #516's current zone ordering), placed
in the wide multi-column layout (§7): semantic-tags column · centered spine ·
classifier column.

**Open-Question flag:** the merge re-frames #516's flat 8-zone Cards panel into
a 3-section narrative spine + detail blocks. The *content* is a superset of
today's; the *visual feel* shifts from "flat label list" to "narrative + columns"
(matching the operator's Timeline north star). Surfaced as **OQ-3** for operator
ratification of the visual reframe.

### Fork 4 — node navigation in Cards — **RESOLVED**

**Decision.** **One card = one node.** The narrative spine doubles as the
jump-navigator (the step-reference parent token switches the active node). For
sequential reading, keep **Prev / Next** exactly as today: strictly
chronological, **no wrap**, disabled at the ends
(`getPreviousMessageId` / `getNextMessageId`, `argumentGameSurfaceModel.ts:240-254`).
All navigation funnels through the single shared `activeMessageId` — the hub
inherits this for free.

**Open-Question flag:** the gesture model for Prev/Next on the Cards hub
(swipe-to-advance vs buttons-only) is operator-discretion → **OQ-4**. Default
recommendation: keep the existing buttons; do not add swipe in this card
(swipe + multi-column scroll can conflict; defer).

### Fork 5 — visual hierarchy, NOT disclosure — **RATIFIED (operator 2026-06-06)**

**Decision.** On the **Card page, ALL detail is always rendered and visible by
default** — the Card is the read-everything surface. "PRIMARY vs SECONDARY" is a
**visual-hierarchy** distinction ONLY (primary = top / above-fold; secondary =
lower sections/columns, possibly below the fold) — it is **NOT** a collapsed
tap-to-reveal disclosure, and there is **no "Full details" expand button on the
Card.**

- **PRIMARY (top / above-fold):** move type/side, body, why-it-matters
  one-liner, unresolved status, `isInactive` badge, **Standing / Tone / Heat
  strip**.
- **SECONDARY (lower sections/columns — still visible by default, NO tap):** the
  full replied-to parent quote, the all-families advisory classifier feedback
  (with visible evidence spans/details), the full semantic-tag set, and lifecycle
  minutiae.

**Tap-to-reveal belongs ONLY to the Timeline page.** The Timeline projection
(`ArgumentReplySidecar`) keeps its existing "Hide full details" collapsed
disclosure unchanged. The two surfaces differ precisely in disclosure posture —
**Card = visible-by-default; Timeline = tap-to-reveal** — which is the core
invariant the shared-model / projected-view split (Fork 2) exists to support
(same derivation, different disclosure). This aligns with the standing project
doctrine: "card page = readily loaded and visible by default; timeline page =
tap-to-reveal."

**Responsive multi-column layout** is part of this fork — see §7.

### Fork 6 — OPEN / OBS — **RESOLVED (out of scope; confirmed by read)**

**Decision.** This card does **NOT** affect `OPEN` / `OBS`. Confirmed by read:

- `OBS` is a viewer-**ROLE** side chip in `DebateDetailHeader.tsx`
  (`SIDE_LABELS: { observer: 'OBS', ... }`, `:98-103`) — it renders in the room
  header, driven by `viewerRole` / observer state, independent of which surface
  (`mode: 'stack' | 'timeline'`) renders.
- `OPEN` is the room status chip (open/closed), also header-level.
- The actual surface toggle is the two-view Cards/Timeline switch owned by
  `ArgumentGameSurface` (`mode`, `toggleSurfaceMode`).

Tab consolidation (folding OPEN/OBS into a unified tab strip with Cards/Timeline)
is a **FOLLOW-ON card, explicitly NOT this scope** (Non-goal §13).

### Fork 7 — parent-jump / reply-thread navigation — **RESOLVED**

**Decision.** The `#N` parent token **switches the active card** to the
referenced node (consistent with one-card-one-node + the single shared
`activeMessageId` + #516's existing `onActivateAncestor` → `handleActivate`
path). No new selection state.

**Open-Question flag:** overlay-the-parent-inline vs switch-the-active-card is
operator-discretion → **OQ-7**. Recommendation: **switch** (matches the existing
contract and the one-node-per-card model; an inline overlay would introduce a
second selection concept). The italic parent *quote* (ask i) already gives the
reader the parent's gist without a jump, so the switch is for "go read the full
parent," not "peek."

---

## 6. Component plan

> All new surface lives under `src/**`. **No** migration, **no** Edge, **no**
> `supabase/**`, **no** new read path, **no** provider call. Every new datum is
> threaded from a structure `ArgumentGameSurface` already computes.

### 6.1 New shared module — `src/features/arguments/detail/argumentDetailModel.ts`

- **Responsibility:** the superset `ArgumentDetailViewModel` (Fork 2 shape) +
  `buildArgumentDetailViewModel(input, surface)` pure builder. Re-exports the
  named pure builders so both surfaces import from one place.
- **Inputs:** a superset of `BuildCardDetailViewModelInput` +
  `BuildSidecarViewModelInput`, all already in scope at the
  `ArgumentGameSurface` mount. Adds three new threaded inputs (below).
- **Purity:** pure TS, JSON-serializable, deterministic; no React, no Supabase,
  no network, no AI, no `Date.now()`, no `Math.random()`, no input mutation.
- **Estimated size:** ~250–350 LOC (mostly slice assembly + re-exports; the
  derivation already exists in the two source models).

### 6.2 New threading on the input (the three new datums)

1. **`parentBodyPreview: string | null`** (ask i) — the parent node's
   `bodyPreview` (already 96-char via `shortBodyPreview`), looked up by
   `parentIdOf(activeMessageId)` against `timelineMap` (the sidecar already does
   this at `argumentReplySidecarModel.ts:393-395`). Threaded into the
   `whatThisMoveSays` slice.
2. **`toneBand: TimelineToneBand`** and **`temperatureBand: TimelineTemperatureBand`**
   (ask v) — read off `timelineMap.nodes[activeMessageId]` (already computed,
   `argumentGameSurfaceModel.ts:665-666`). Threaded into the S/T/H strip.
3. **the full uncapped classifier set + manual/auto tags** (asks ii, iii) — the
   rows already in scope (`persistedObservationsByArgumentId[id]`,
   `manualTagsByMessageId.get(id)`, `metadataLedger.byMessage.get(id)`), surfaced
   through the cap-lift builder (§6.5) and the full-tags builder (§6.6).

### 6.3 The two thin projection components

- **`ArgumentReplySidecar` (timeline projection):** refactored to consume the
  shared `ArgumentDetailViewModel` (`surface:'timeline'`). Renders 6 sections in
  ScrollView, condensed. **Thin refactor only** — no visual change to the
  Timeline detail. Est. delta ~40–80 LOC (swap the model source; keep the JSX).
- **`CardDetailPanel` → Cards hub component (cards projection):** consumes the
  shared model (`surface:'cards'`). Renders the narrative spine + detail blocks
  in the multi-column layout (§7), with the PRIMARY/SECONDARY *visual hierarchy*
  (Fork 5 — always visible by default, **NO Card expand**).
  Est. delta ~150–250 LOC (new parent-quote zone, S/T/H strip, family-grouped
  classifier rendering, full-tags rendering, responsive column wrapper). The
  existing #516 zones are reused, not rewritten.

### 6.4 Band formatters (shared, plain-language)

Today `formatToneLine`/`formatHeatLine` emit the raw band token (e.g.
"Tone: calm"). For the hub, define plain-language band maps in the shared module:

- `STANDING` already has `standingBandCopy.ts` (`STANDING_BAND_SOFT_LABEL`,
  `formatStandingBandShort`) — reuse.
- `TONE` map (calm/measured/heated/hostile/unknown) and `HEAT/TEMPERATURE` map
  (cool/mild/warm/hot/unknown) → short plain-language labels that describe the
  **TEXT, not the author** and pass the verdict-token ban-list. Example framing:
  Tone = "Calm" / "Measured" / "Heated" / "Hostile" / "—"; Heat = "Cool" /
  "Mild" / "Warm" / "Hot" / "—". These are activity/friction descriptors of the
  text (timeline-grammar: heat ≠ truth, heat ≠ popularity). The shared formatter
  is used identically by both the Cards strip and the Timeline strip so the two
  never diverge.

> **Doctrine note for the implementer:** "hostile"/"heated" describe the *text's*
> register, never a judgment of the person. The strip caption (or a11y label)
> should make this explicit, e.g. "How this message reads" not "How this person
> is." Pass the ban-list recursively over all strip strings.

### 6.5 Cap-lift for the all-families classifier (ask iii)

**Decision.** Adopt the **inspect-grouped uncapped builder** path
(`enforceInspectGroupedView`) for the **hub surface only**, fed
**surface-filtered marks at the `selected_context` surface**. Concretely:

1. Build per-node marks exactly as `buildCardClassifierStrip` does through step 4
   (`adaptAllSourcesForNode({ surface: 'selected_context' })` →
   `combinePerNodeMarks` → `filterMarksBySurface(_, 'selected_context')` →
   `dedupePerNodeMarks`). `filterMarksBySurface` at `selected_context` drops
   `composer_only` (Family J — all entries) and `inspect_only`, and Family H
   (`claim_clarity` — entirely `future_source`). **⚠️ Disposition filtering alone
   is NOT sufficient to exclude Family I.** Verified against
   `machineObservationDefinitions/familyI.ts`: Family I (`thread_topology`,
   `productionEnabled:false`) has **3 entries dispositioned `rendered_now`** —
   `no_response_after_n_turns` (:160), `repeated_axis_pressure` (:186),
   `ignored_by_both` (:355) — which WOULD pass `filterMarksBySurface(_,
   'selected_context')`. The cap-lift (step 2) *amplifies* this by removing the
   ≤3 ceiling that today only incidentally hides them. There is **no upstream
   `productionEnabled` family gate** in the cardView / classifier-strip path
   (confirmed: zero `productionEnabled` / `familyRegistry` reference in
   `src/features/arguments/cardView/` or `nodeLabelPresentationModel.ts`).
1b. **Add an EXPLICIT family allow-list gate — the authoritative §10a hub gate.**
   After disposition filtering, drop any mark whose family is not in the
   `productionEnabled:true` set **A–G** (`parent_relation`, `disagreement_axis`,
   `misunderstanding_repair`, `evidence_source_chain`, `argument_scheme`,
   `critical_question`, `resolution_progress`). Derive the allow-list from the
   family registry's `productionEnabled` flag (single source of truth) — do NOT
   hard-code codes that could drift. This makes the hub provably H/I/J-free
   **regardless of per-entry disposition or future family enablement**: note
   that #392 / #394 are in-flight cards that ENABLE Family I — if they land,
   disposition-only filtering would silently start leaking Family I's three
   `rendered_now` entries to participants; the family gate prevents that.
   "All relevant families" = A–G, enforced **by family**, backstopped by
   disposition.
2. Replace step 5 (`enforceSelectedContextDisplayCap`, the ≤3 cap) with
   `enforceInspectGroupedView` (unbounded) **for the hub surface only**. The
   Timeline node strip and the existing ≤3 selected-context cap are unchanged.
3. **Add per-family grouping** (new): for each surviving Observation mark, look
   up its family via `lookupMachineObservationDefinitionByCompoundKey(mark.source, mark.rawKey)?.family`
   (the ACTUAL registry export, verified in `machineObservationDefinitions.ts:149` —
   NOT the non-existent `…ByRawKey`; the family lives on the parallel registry `MachineObservationDefinition`,
   not on `NodeLabelMark`). Group chips under plain-language **family headings**
   (A parent_relation → "How it relates to the parent", B disagreement_axis →
   "What the disagreement is about", etc. — exact plain-language family labels
   defined as locked constants in the shared module; **no raw family codes
   rendered**). Marks whose `rawKey` has no registry entry fall into an
   "Other observations" group (never the raw code).

**New builder:** `buildHubClassifierGroups(input)` in the shared module (or
adjacent to `cardClassifierStripModel.ts`), returning
`{ groups: Array<{ familyLabel: string; chips: CardClassifierChip[] }>,
advisoryCaption, emptyStateCopy, hasSignals }`. Confidence stays PIPS; the
advisory caption stays `"What the referee noticed — advisory, not a verdict."`

**Why not "raise the ≤3 cap"?** Raising the numeric cap on the existing
`enforceSelectedContextDisplayCap` would diverge the selected-context cap used by
other consumers. Adopting the existing uncapped inspect builder is lower-risk and
already §10a-correct. **Why not a new surface key?** A new
`NodeLabelSurface` value would ripple through the disposition matrix and the MCP
confidence-eligibility map — over-reach. The hub reuses `selected_context`
filtering + the uncapped grouping. (Cap-lift is a real design decision — flagged
**OQ-iii** for operator confirmation of "uncapped, family-grouped, A–G only.")

### 6.6 Full semantic tags (ask ii)

**Decision.** Expand Zone 8 beyond today's flag-label subset to the **full
relevant tag set**, grouped by Observation vs Allegation (the §10a distinction):

- **Auto-metadata (Observations)** — `metadataLedger.byMessage.get(id).autoDerivedMetadata`
  codes → `toPlainLanguageOrSuppress` (unknown suppressed).
- **Manual tags (Allegations)** — `manualTagsByMessageId.get(id)` →
  plain-language labels (the existing sidecar `buildSectionSemanticFlags` already
  produces these chips with `family: 'manual_tag' | 'auto_metadata'`).
- **Dropped-tag qualifiers** — surfaced as labels where present.

All routed through `toPlainLanguageOrSuppress`; **no snake_case leak**. Render in
the semantic-tags column (§7). Reuse the sidecar's `buildSectionSemanticFlags`
(promoted to the shared module) so Cards and Timeline produce identical chip
labels — the existing single reuse point becomes a *shared builder*, eliminating
the last fork.

### 6.7 Parent comparison bubble (ask i) — Slice 3 operator refinement (2026-06-06)

> **Operator refinement (2026-06-06).** Slice 2 shipped the parent quote as an
> inline, in-flow display-only zone ("Replied to" heading + italic text /
> neutral placeholder). The operator's Slice-3 instruction UPGRADES that into a
> visually-distinct **off-center, above-centerpiece comparison bubble** so the
> reader can tell, at a glance, that the parent is the OTHER party's move. The
> inline parent-quote zone is REMOVED so the parent appears exactly once (as the
> bubble).

The parent now renders as `model.parentComparison`
(`DetailParentComparisonBubble`, built by `buildParentComparisonBubble` in the
shared `detail/argumentDetailModel.ts`). The bubble carries:

- the italic replied-to **quote** inside quote marks (reuses the Slice-2
  `buildParentQuoteSlice`; ≤ `PARENT_BODY_PREVIEW_CAP` = **120** chars),
- a plain-language **actor label** (e.g. "Other side") — a color-INDEPENDENT cue
  for WHO made the parent move,
- the **reference** `#N · kind` (e.g. "#6 · rebuttal"),
- the parent's **actor** + its **color pair** (`ACTOR_BUBBLE_COLOR`).

**Color grammar (timeline-grammar).** The bubble is filled + stroked in the
parent's **actor / side color**, mirroring the Timeline's `actorTone`
(`self → cyan`, `other → indigo`, `bot → purple`, `admin → amber`,
`unknown → slate`) so the two surfaces read as one system. The color encodes
WHO, never a verdict / truth / correctness signal, and is DIFFERENT from the
centerpiece card's surface so the two moves contrast. Meaning is ALSO carried by
SHAPE (the off-center bubble + the italic quote) and the plain-language actor +
reference labels, so color is never the only signal (grayscale snapshot stays
legible).

**Position.** The bubble sits ABOVE + OFF-CENTER the centerpiece card
(`alignSelf: flex-start` + a small negative left margin) so the centerpiece
reads as the obvious focus.

**Navigation (Fork 7).** The **reference** (`#N · kind`) is the ONLY interactive
affordance in the bubble — a real `Pressable` (role button, ≥44×44 via hitSlop)
that switches the active card to the parent via `onActivateAncestor`. It is
emitted as a button only when BOTH the parent ordinal AND the parent message id
resolve; when the id is missing the reference renders as display-only text (no
dangling tappable affordance).

**Graceful degrade.** When the parent is the root / soft-deleted / RLS-hidden /
out-of-slice, the resolved `parentBodyPreview` is empty and the bubble degrades
to `kind: 'none'` — the consumer renders **NOTHING** (no bubble, no placeholder).
The absence of the bubble is the entire signal; the hub NEVER invents a quote and
NEVER shows a "(hidden because …)" reason (that would leak `inactive_reason`-class
info, §10a).

### 6.8 Wiring in `ArgumentGameSurface`

The single `activeCardDetail` memo (`ArgumentGameSurface.tsx:770-830`) is
extended to call `buildArgumentDetailViewModel(..., 'cards')` with the three new
inputs (parent body preview, tone/heat bands, the uncapped classifier path). The
`sidecarViewModel` memo (`:721-737`) is refactored to call the same shared
builder with `'timeline'`. No new fetch; the new inputs are read off
`timelineMap` (already a dependency). Est. delta ~40–60 LOC in the surface
(mostly memo input wiring).

---

## 7. Visual hierarchy (always-visible on Card) + responsive multi-column layout

### 7.0 Comparison-style centerpiece + stylized MCP presentation (Slice 3 operator refinement, 2026-06-06)

> **Operator refinement (2026-06-06).** Slice 3 adds the operator's
> comparison-style framing on top of the ratified §7.1 / §7.2 invariants (which
> are UNCHANGED). The active/current message card is the OBVIOUS CENTERPIECE of
> the page; the replied-to parent renders as the off-center colored comparison
> bubble above it (§6.7). The hub's MCP feedback is presented as stylized
> flags / labels / helpers / banners, not plain text rows.

- **Comparison-style centerpiece.** The hub renders three logical regions —
  **centerpiece** (the parent comparison bubble above + the centerpiece card:
  step-ref, category, S/T/H strip, evidence, standing, lifecycle), the
  **classifier column**, and the **semantic-tags column**. The centerpiece card
  sits on an elevated surface (`SURFACE_TOKENS.overlay` + rounded border) so it
  reads as the focus; the parent bubble's distinct actor color contrasts with it
  (§6.7).
- **Stylized MCP presentation.** The hub surfaces the ALREADY-COMPUTED MCP
  output — the family-grouped classifier Observations (A–G), the full semantic
  tags, the S/T/H strip, evidence, lifecycle — as stylized **flags · labels ·
  helpers · banners** (plain-language family headings, the advisory caption
  banner, confidence PIPS, evidence-span helper lines, doctrine-grouped tag
  blocks). It does NOT invent new classifier data and does NOT call any model;
  "taking full advantage of MCP feedback" = surfacing the TypeScript
  observations + plain-language helpers the registry / `gameCopy` already
  produce, stylized. Meaning is carried by shape / glyph / label, NOT color
  alone (color-independent; grayscale snapshot stays legible).

### 7.1 Visual hierarchy — NOT disclosure (Fork 5, RATIFIED)

On the **Card page every section is rendered and visible by default — no tap, no
collapsed disclosure.** PRIMARY/SECONDARY is purely visual ordering:

- **PRIMARY (top / above-fold):** type/side, body, why-it-matters one-liner,
  unresolved status, `isInactive` badge, Standing/Tone/Heat strip.
- **SECONDARY (lower sections/columns — visible by default, NO tap):** full
  parent quote, all-families family-grouped classifiers (with evidence
  spans/details), full semantic tags, lifecycle minutiae.
- **The Card has NO "Full details" expand.** The only Card `Pressable`s are
  navigation (parent token, Prev/Next, spine). Reduce-motion is a non-issue for
  always-visible content (no toggle animation exists).
- **Tap-to-reveal is the TIMELINE page's posture only** — `ArgumentReplySidecar`
  keeps its "Hide full details" collapsed disclosure unchanged.

### 7.2 Responsive multi-column (the operator's wide-layout signal)

Implemented via the pure helper `hubColumnLayout(width, platformOs)` (shared
`detail/argumentDetailModel.ts`), which returns the layout mode + the visual
column order + the stable SR reading order. The breakpoint reuses the existing
≥1024 boundary (`HUB_WIDE_LAYOUT_WIDTH_THRESHOLD`, the iPad-Pro-landscape width
`menuKeyBadgeModel` uses).

- **Wide viewport (web AND width ≥ 1024):** three columns — **semantic-tags
  column (left) · centerpiece (the comparison bubble above + the centerpiece
  card + S/T/H strip + lifecycle) · classifier (family-grouped) column
  (right)** (the operator's two flanking regions, with the centerpiece visually
  centered between them).
- **Narrow viewport (phone / tablet portrait) AND ALL native platforms:** single
  stacked column — centerpiece first, then the classifier block, then the
  semantic-tags block (reading order preserved). No horizontal scroll trap;
  columns reflow via flex wrap. Native is always stacked (touch-first) regardless
  of width, matching `hubColumnLayout`'s `{platformOs, windowWidth}` encoding.
- The layout decision is pure presentation (a width-driven flex direction).
  **SR reading order is ALWAYS `centerpiece → classifiers → tags`**
  (`HUB_READING_ORDER`) regardless of visual column order; on the wide layout the
  visual order is `tags · centerpiece · classifier` so the centerpiece is
  centered, while the canonical reading order is the order used on every native /
  stacked viewport. The same sections are present in BOTH layouts — narrow only
  reflows, it never drops a section.

(Resolved per **OQ-5b**: 3-col ≥1024, stacked below.)

---

## 8. Node navigation model (Forks 4 + 7)

- **One card = one node.** The active node is the single shared `activeMessageId`
  owned by `ArgumentGameSurface`.
- **Sequential reading:** Prev / Next (chronological, no wrap, disabled at ends)
  — unchanged from today.
- **Spine as jump-navigator:** the step-reference parent token (`#N`) switches
  the active card to the parent (`onActivateAncestor` → existing `handleActivate`
  path). Null for roots / unresolvable parents.
- **No new selection state** (inherited #516 invariant; locked by
  `timelineSelectionSharedAcrossModes.test.ts`).
- Keyboard nav on web (←/→ Prev/Next; Home/End; Enter/Space; Esc) is inherited
  from `keyboardNavigationModel.ts` and is not changed.

---

## 9. Test forecast

All new logic is pure-TS model code → unit-testable without React/Supabase.
Component projections get React Testing Library + snapshot/grayscale tests.
Rough forecast (final count confirmed by the implementer's captured
`Test Suites / Tests` line; THR-4: **no existing test relaxed or removed**):

- **`__tests__/argumentDetailModel.test.ts`** (new shared model) — ~25–35 tests:
  happy path per slice; surface discriminator selects correct slices; parent
  quote present / soft-deleted-degrade / out-of-slice; tone/heat plain-language
  mapping; determinism + non-mutation; empty/degenerate inputs (no throw).
- **`__tests__/hubClassifierGroups.test.ts`** (new cap-lift + grouping) — ~15–20
  tests: uncapped vs the old ≤3; per-family grouping via registry lookup;
  unknown-rawKey → "Other observations" (never raw code); §10a — H/I/J
  (composer_only / future_source) never appear; confidence PIPS not numbers;
  advisory caption present.
- **`__tests__/cardDetailHubFullTags.test.ts`** (full tags) — ~8–12 tests:
  manual + auto + dropped tags surfaced; Observation vs Allegation split;
  unknown code suppressed (no snake_case leak); parity with sidecar chip labels.
- **`__tests__/argumentDetailParity.test.ts`** (Fork 2 DRY proof) — ~5–8 tests:
  both surfaces call the same shared builders; the narrative derivation is not
  duplicated; identical inputs → identical shared-slice output across surfaces.
- **`CardDetailPanel.test.tsx` / new `ArgumentDetailHub.test.tsx`** — ~12–18
  tests: parent-quote italic zone renders + degrades; S/T/H strip renders
  plain-language; family-grouped classifiers render with PIPS; **the Card renders
  ALL sections visible-by-default with NO expand/disclosure — the only Card
  buttons are navigation** (check #14); responsive 3-col ≥1024 vs stacked (same
  content, same order); grayscale snapshot legible; reduce-motion path.
- **Ban-list + doctrine tests** (extend the existing suites, do not relax):
  verdict-token ban-list recursive over every output string of the new model and
  every rendered string of the new component; `inactive_reason` poisoned-fixture
  never present; `isInactive` derived from `inactiveAt` only.

Net: **+~70–90 tests** across ~5 new/extended suites. (Baseline as of Stage 6.4
is 1805 tests / 70 suites; the implementer captures the exact post-card count.)

---

## 10. Adversarial-check set for the eventual build (enumerated)

The implementer MUST add a test for each:

1. **`inactive_reason` never exposed** — poisoned fixture sets
   `lifecycleState: 'inactive_reason'` (and `inactive_by`); `JSON.stringify(model)`
   and every rendered string contain neither. (Extends
   `cardDetailModel.test.ts:253-261`.)
2. **`isInactive` from `inactiveAt` only** — a fixture with `inactiveAt` set but
   no/absent reason yields `isInactive: true`; the model never reads or surfaces
   any reason field.
3. **No mutation handler / no moderation action** — the hub has no
   moderate/reactivate/re-classify/"add classifier"-as-write/flag-mutation
   handler; the only Card Pressables are navigation (parent token, prev/next,
   spine). **No "Full details" expand exists on the Card** (see check #14). Test
   asserts no `onPress` on any detail label.
4. **Classifier advisory, not verdict** — the advisory caption is present; no
   verdict token in any chip/group/strip string; group/family labels are
   structural, never judgments.
5. **Confidence as PIPS, not numbers** — every classifier confidence renders as
   1–3 pips; no rendered classifier string matches `/[0-9]/` for confidence.
6. **The shared primitive is genuinely shared (Fork 2)** — a test asserts BOTH
   the timeline projection and the cards projection consume the same shared
   builder/model; the narrative derivation appears in exactly one module (no
   forked detail logic).
7. **H/I/J never on the hub — by FAMILY GATE, not disposition alone** — Families
   H (claim_clarity), I (thread_topology), J (sensitive_composer) are absent from
   the hub classifier output. **The test MUST seed a Family I `rendered_now` mark**
   (e.g. `no_response_after_n_turns`) — not only `future_source` / `composer_only`
   marks — and assert it does NOT render, proving the explicit family allow-list
   gate (§6.5 step 1b); disposition filtering alone lets those 3 Family I entries
   through. Also seed H and J marks and assert absence. (A regression here is the
   exact leak the family gate exists to stop, especially once #392/#394 enable
   Family I.)
8. **No migration / Edge / `supabase/**`** — `git diff` for the build touches
   only `src/**` and `__tests__/**`; no `supabase/`, no migration file.
9. **No provider call** — no Anthropic/xAI/X/AI call introduced in `src/**`
   (grep-clean per cdiscourse-doctrine §7).
10. **Acceptance-gate preserved** — `engine.ts` untouched; the build is
    presentation only.
11. **No existing test relaxed (THR-4)** — test count goes UP; no `.skip` /
    `.only` / removed assertion; the #516 inherited tests still pass byte-for-byte
    behavior.
12. **Verdict-token ban-list recursive over all output strings** — model output
    AND rendered component strings (`winner / loser / true / false / liar /
    dishonest / bad faith / manipulative / extremist / propagandist / correct`).
13. **No snake_case internal-code leak** — every label routes through
    `toPlainLanguageOrSuppress` / the definition registry; unknown codes
    suppressed; no rendered string matches an internal-code pattern.
14. **Card-visible vs Timeline-disclosed (RATIFIED invariant)** — a test asserts
    the **Card** detail renders ALL sections (parent quote, classifiers, full
    tags, lifecycle) **without any tap/expand** — no collapsed disclosure, **no
    "Full details" Pressable on the Card** — while the **Timeline** projection
    retains its tap-to-reveal "Hide full details" disclosure. Card =
    visible-by-default; Timeline = tap-to-reveal. (Regression guard for the
    operator's binding ratification clarification.)

---

## 11. Slices

- **Slice 1 — extract the shared model + builders + parity tests.** Create
  `argumentDetailModel.ts`; move/re-export the named pure builders; refactor the
  sidecar + card-detail builders to consume the shared model; add the Fork 2
  parity test. **No new user-visible content yet** — pure refactor, behavior
  byte-equal. This is the no-fork foundation and lands first.
- **Slice 2 — wire the Cards hub asks i / ii / iii / v + cap-lift.** Thread
  `parentBodyPreview`, `toneBand`, `temperatureBand`; add the parent-quote zone,
  the S/T/H strip (shared formatters), the full-tags block, and the
  family-grouped uncapped classifier (`buildHubClassifierGroups`). Add the
  classifier + tags + doctrine/ban-list tests.
- **Slice 3 — visual-hierarchy layout + responsive multi-column + navigation.**
  Add the always-visible PRIMARY/SECONDARY visual hierarchy (**NO Card expand**),
  the responsive 3-col/stacked layout (`hubColumnLayout`, same content + same
  order), and confirm navigation (Prev/Next + spine jump). Add the layout +
  card-visible-vs-timeline-disclosed (check #14) + grayscale + a11y tests.
- **FAST-FOLLOW (NOT this card):** propagate the shared detail model to the
  OTHER surfaces — `DebateListScreen`, the Conversation Gallery, "View as", and
  `UserDetail`. Explicit follow-on; out of this card's scope.

---

## 12. Open Questions for operator (each with a recommended answer)

- **OQ-iv — "Add Classifier" — RESOLVED (operator 2026-06-06): display-expansion
  ONLY; do NOT use the label "Add Classifier" (implies mutation). Use a neutral
  heading e.g. "Classifier observations" / "All classifier observations (A–G)" /
  "Classifier evidence". Any write / recompute / pin action is a SEPARATE
  Edge/Admin card.** (Original framing retained below for context.) The markup's
  bottom-center "Add Classifier" box was ambiguous: (a) a label marking the
  classifier zone that should render the all-families feedback (display
  expansion — **in scope**), or (b) a literal "add a classifier" **mutation
  action** (FORBIDDEN here — it would require an Edge write-path + RLS + an actor
  matrix = a SEPARATE card, and violates the #516 display-only + read-only
  invariant). **Recommended reading: (a) display-expansion** — this is the zone
  that the all-families family-grouped classifier feedback fills. **This design
  does NOT design any mutation/add-action.** Operator must ratify (a) before the
  build; if the operator means (b), file a separate write-path card.
- **OQ-i — parent-quote truncation length + fallback.** Recommend **120 chars**
  (match the sidecar's `PARENT_BODY_PREVIEW_CAP`) and a no-quote graceful
  degrade for soft-deleted/RLS-hidden/out-of-slice parents (omit the italic box;
  never leak a "hidden because" reason).
- **OQ-ii — full semantic tags grouping.** Recommend grouping by Observation
  (auto-metadata) vs Allegation (manual tags) per §10a, all plain-language,
  unknown suppressed. Confirm whether dropped-tag qualifiers should render as a
  third group or inline.
- **OQ-iii — classifier cap-lift shape.** Recommend **uncapped + per-family
  grouped + A–G only** (H/I/J excluded by disposition, non-negotiable). Confirm
  the operator wants per-family headings (vs one flat uncapped list).
- **OQ-3 — narrative reframe (Fork 3).** The merge reframes #516's flat 8-zone
  Cards panel into a 3-section narrative spine + detail blocks. Recommended:
  proceed (it matches the Timeline north star). Confirm the visual reframe.
- **OQ-4 — Prev/Next gesture (Fork 4).** Recommend buttons-only (no swipe in
  this card; swipe + multi-column scroll conflict). Confirm.
- **OQ-5 — PRIMARY/SECONDARY split (Fork 5) — RESOLVED (operator):** visual
  hierarchy ONLY, NOT disclosure on the Card. On the Card everything is visible
  by default (**no "Full details" expand**); secondary detail sits lower / in
  columns. Mobile reflows the same content in the same order. Tap-to-reveal is
  Timeline-only. (See §7.1 + adversarial check #14.)
- **OQ-5b — responsive breakpoint (Fork 5/§7).** Recommend 3-col at ≥1024 (reuse
  the existing boundary), stacked below. Confirm.
- **OQ-7 — parent-jump model (Fork 7).** Recommend **switch the active card** to
  the parent (matches the one-node-per-card + shared `activeMessageId`
  contract), with the italic parent quote giving the gist without a jump.
  Confirm switch vs inline overlay.
- **OQ-fam — latent `familyI.ts` disposition inconsistency (FYI + follow-on).**
  Family I (`thread_topology`) is `productionEnabled:false` at the registry
  level, yet 3 of its entries are dispositioned `rendered_now`
  (`familyI.ts:160/186/355`). This card's hub is made safe by the explicit family
  allow-list gate (§6.5 step 1b) regardless. **But the same disposition-only
  filter is used by the EXISTING #516 Cards strip and the Timeline node strip** —
  so if Family I is enabled (#392/#394), those surfaces would begin showing the 3
  `rendered_now` entries to participants. Recommend a **separate follow-on** to
  either reconcile those 3 dispositions to `future_source` or formalize the
  family-`productionEnabled` gate repo-wide. **NOT this card's fix** — flagged for
  operator awareness because it intersects the in-flight Family I enablement work.

---

## 13. Non-goals (explicit)

- **No tab consolidation** (OPEN/OBS into a unified tab strip) — Fork 6
  follow-on.
- **No moderation / mutation surface** — no moderate, reactivate, re-classify,
  flag-mutation, or "Add Classifier"-as-write. Display-only (Doctrine §1/§3).
- **No migration / Edge / `supabase/**`** — pure `src/**`; rollback = code
  revert.
- **No provider / classifier behavior change** — the hub changes how existing,
  already-computed classifier output is *displayed*; it does not change what
  classifiers compute, run, or route. No AI round, no family-state change.
- **No `inactive_reason` exposure** — WHAT is inactive, never WHY.
- **No H / I / J on the hub** — "all families" = A–G only (§10a).
- **No change to Timeline navigation or rail grammar** — the Timeline detail
  becomes a thin projection of the shared model with **no visual change**.
- **No new fetch / read path / service-role / Supabase write.**
- **No propagation to other surfaces** (DebateListScreen / gallery / View-as /
  UserDetail) — explicit FAST-FOLLOW, not this card.
- **No v1-scope violation** — no voting/winner, no search, no push, no OAuth, no
  public API.
