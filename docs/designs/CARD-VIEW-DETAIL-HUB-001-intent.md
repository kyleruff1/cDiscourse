# CARD-VIEW-DETAIL-HUB-001 Design Intent Brief — Cards screen as the canonical per-node DETAIL HUB

**Card:** CARD-VIEW-DETAIL-HUB-001 — make the Cards screen the canonical per-node DETAIL HUB, sharing ONE detail primitive with the Timeline detail panel (no fork)
**Epic:** Epic 2 / Epic 8 (argument node rendering · timeline + cards surface) — UI/UX only
**Release:** UX track (Stage 6.x, post-#516)
**Priority:** P1
**Effort:** M–L (3-slice UI/model card; pure `src/**`)
**Filed:** 2026-06-06
**Author:** Orchestrator-authored (see ledger — operator's visual intent captured from screenshots; no operator-authored prose brief)
**Status:** Proposed — binding for the designer phase; the design doc (`CARD-VIEW-DETAIL-HUB-001.md`) carries the resolved architecture + Open Questions.
**Extends:** CARD-VIEW-DATA-001 / #516

---

## Why now

#516 made the Cards view's per-node detail panel **default-visible** (no tap) and
display-only. The operator's annotated screenshots ask for the next step: turn
that panel into the **full detail hub** — the deep, multi-column read of one
argument node — by adopting the structure the Timeline detail panel already uses
(WHAT THIS MOVE SAYS / WHY IT MATTERS / WHAT IS UNRESOLVED + the italic
replied-to quote + the Standing/Tone/Heat strip) and exposing more than the
Timeline node shows: the parent quote, all relevant semantic tags, and the
classifier feedback from all (production) MCP families.

The danger the card exists to prevent is a **forked detail implementation** —
the Cards hub drifting away from the Timeline detail as each gains features
independently. So the card's first move is structural: extract ONE shared pure
detail view-model + builders that both surfaces consume, then project two thin
surface-specific views. Share the model, project the view.

---

## What success looks like

- The Cards view is the canonical per-node detail hub: a full, default-visible,
  multi-column read of one node — narrative spine (3 sections) + detail blocks
  (classifier, evidence, semantic tags) + Standing/Tone/Heat strip + italic
  parent quote.
- The Timeline detail and the Cards hub derive their narrative structure from
  **one shared module**; a parity test proves neither surface forks the
  derivation logic. The Timeline detail's visual behavior is **unchanged** (a
  thin projection refactor).
- The five markup asks are addressed: (i) italic replied-to parent quote,
  (ii) full semantic tags, (iii) all-families (A–G) classifier feedback,
  (iv) "Add Classifier" disambiguated to display-expansion (Open Question for
  operator), (v) Standing/Tone/Heat strip.
- Everything stays display-only except genuine navigation; advisory framing and
  PIPS-not-numbers preserved; `inactive_reason` never exposed; H/I/J never on the
  hub; pure `src/**` (no migration, no Edge, no provider call, no Supabase
  write).

---

## What's explicitly out (Non-goals)

- **No tab consolidation** (OPEN/OBS are viewer-role / status chips in the room
  header, not surface tabs — confirmed by read; folding them into a tab strip is
  a follow-on card).
- **No moderation or mutation surface** — no moderate/reactivate/re-classify/
  flag-mutation, and crucially **no "Add Classifier"-as-write action** (that
  would need an Edge write-path + RLS + actor matrix = a separate card; flagged
  as a HALT/disambiguate Open Question).
- **No migration / Edge / `supabase/**`**, no new fetch/read path, no
  service-role, no Supabase write, no provider/AI call.
- **No change to what classifiers compute or how they route** — presentation
  only; the hub re-displays already-computed output.
- **No `inactive_reason` exposure** (WHAT is inactive via `inactiveAt`-derived
  `isInactive`, never WHY).
- **No H / I / J on the hub** — "all families" = A–G only (§10a; H/I/J are
  `future_source` / `composer_only` and are dropped by the existing surface
  filter).
- **No Timeline navigation / rail grammar change.**
- **No propagation to other surfaces** (DebateListScreen / gallery / View-as /
  UserDetail) — explicit FAST-FOLLOW.
- **No v1-scope violation** — no voting/winner, search, push, OAuth, public API.

---

## Orchestrator-authored brief ledger (POSTRUN-UX001 requirement)

This brief is **orchestrator-authored**, not operator-authored. The ledger below
maps where each input came from and where orchestrator judgment substituted for
explicit operator direction, so post-ship revision (if any) can target the
specific interpretations.

### Derived from the operator's visual intent (screenshots → markup inventory)

Source: `.claude-tmp/CARD-VIEW-DETAIL-HUB-001-markup-inventory.md` (the
orchestrator captured the operator's three annotated screenshots because the
workflow code-discovery agents cannot see images).

- The five markup asks (i parent quote · ii full tags · iii all-families
  classifiers · iv "Add Classifier" · v Standing/Tone/Heat strip).
- The Timeline detail panel as the structural north star (the 3 narrative
  sections + italic quote + S/T/H strip).
- The wide multi-column layout signal (the two flanking empty rectangles →
  semantic-tags column · centered move · classifier column).

### Derived from the Phase 0 code-discovery brief

Source: `.claude-tmp/CARD-VIEW-DETAIL-HUB-001-discovery.md` + the designer's
confirming reads of the cited files.

- The information inventory + data-source map (every datum exists upstream;
  zero new fetch).
- The DRY-anchor analysis (share model, project view) → Fork 2.
- The enrichment data-flow + the three not-yet-threaded datums (parent body
  preview, tone/heat bands, the uncapped classifier set).
- The MCP family coverage table (A–G `productionEnabled`; H/I/J excluded by
  disposition) and the cap-lift options.
- The tab-model finding (OPEN/OBS are not surface tabs) → Fork 6.

### Derived from a pre-launch codebase survey (designer confirming reads)

The designer read the actual files to verify the discovery brief's claims and
corrected path drift (the card-detail model lives under
`src/features/arguments/cardView/`, not the abbreviated path in the brief):

- `cardDetailModel.ts`, `cardClassifierStripModel.ts`, `CardDetailPanel.tsx`,
  `argumentReplySidecarModel.ts`, `nodeLabelPresentationModel.ts`
  (`enforceInspectGroupedView` is the uncapped path), `nodeLabelTypes.ts`
  (family lives on the parallel registry, not on `NodeLabelMark`),
  `machineObservationDefinitions.ts` (`lookupMachineObservationDefinitionByRawKey`
  for rawKey→family), `argumentArtifactModel.ts` (`isInactive` temporal-only),
  `argumentGameSurfaceModel.ts` (node carries tone/heat/standing bands +
  bodyPreview), `ArgumentGameSurface.tsx:770-830` (the `activeCardDetail` wiring),
  `DebateDetailHeader.tsx` (OBS = viewer-role side chip).

### Resolved by orchestrator default (not explicit operator direction)

These the designer decided as engineering invariants or recommendations; the
operator has not explicitly ruled on them. Each is also surfaced as an Open
Question for ratification:

- **Fork 2 (DRY anchor):** share the pure view-model + named builders; project
  two thin components; do NOT merge the rendered components. (Engineering
  invariant; not deferred.)
- **Fork 3 (merge):** adopt the narrative spine, fold #516's enumerated zones
  into it. (Recommended; visual-reframe flagged as OQ-3.)
- **Cap-lift (ask iii):** adopt the existing uncapped `enforceInspectGroupedView`
  at the `selected_context` surface filter + add per-family grouping; A–G only.
  (Recommended; flagged OQ-iii.)
- **Full tags (ask ii):** group by Observation vs Allegation per §10a.
  (Recommended; flagged OQ-ii.)
- **Parent quote (ask i):** 120-char cap + no-quote graceful degrade.
  (Recommended; flagged OQ-i.)
- **Default/expand (Fork 5)** + **responsive 3-col ≥1024 / stacked** layout.
  (Recommended; flagged OQ-5 / OQ-5b.)
- **Navigation (Forks 4/7):** one card = one node; Prev/Next buttons (no swipe);
  parent token switches the active card. (Recommended; flagged OQ-4 / OQ-7.)

### Requires operator review post-ship / pre-build (Operator-deferred review)

The implementer should NOT build past these until the operator ratifies:

- **OQ-iv — "Add Classifier" (HALT/disambiguate):** display-expansion (in scope)
  vs mutation action (forbidden here; separate write-path card). The design
  recommends and assumes **display-expansion** and designs **no** mutation
  action. Operator must confirm before the build, or file a separate card if a
  real add-action is wanted.
- **OQ-3 — narrative reframe** of the existing flat 8-zone Cards panel.
- **OQ-5 — PRIMARY/SECONDARY split** (or "everything always visible on the wide
  hub").
- The remaining Open Questions (OQ-i, OQ-ii, OQ-iii, OQ-4, OQ-5b, OQ-7) carry
  recommended defaults and can proceed on the recommendation unless the operator
  objects.

---

## Deliverables

1. `docs/designs/CARD-VIEW-DETAIL-HUB-001.md` — the design document (resolved
   architecture, component plan, adversarial-check set, slices, Open Questions).
2. `docs/designs/CARD-VIEW-DETAIL-HUB-001-intent.md` — this intent brief.

(The eventual implementer card delivers the `src/**` change + tests + a
`current-status.md` handoff section. This designer card delivers the two docs
only.)
