# UX-001 — Brand-Forward Simplified UX/UI Consolidation Epic

**Priority:** P0 / Urgent
**Effort:** XL (decomposed into 7 cards)
**Area:** UX/UI, Product Experience, App Shell, Timeline Interaction, Mobile/Tablet/Web Usability
**Filed:** 2026-05-25
**Status:** Active — Phase 1 in flight

## Epic intent

CDiscourse has reached a point where the core argument architecture is strong, but the visible product experience does not yet communicate that strength. The next priority is not adding another isolated feature surface. The next priority is consolidating the interface into a professional, brand-forward, timeline-first application shell that works across Android phones, iPhones, iPads, standard tablets, and desktop/laptop web browsers.

The product should become simpler without becoming less capable. The user should see the brand, the argument board, the selected context, and the composer. Everything else should be available through a predictable touch-first and keyboard-friendly system.

This epic protects prior investment. It does not discard the one-box composer, Act/Inspect/Go popouts, lifecycle model, metadata layer, semantic referee, action dock, selected-message readout, or keyboard navigation. It makes them feel like one product.

## Governing UX principle

The UI is reducible to this mental model.

The Timeline is where the argument lives. The selected node is what the user is focused on. The composer box is where the user acts. The context panel shows what the user is replying to. The Act menu shows what the user can do. The Inspect menu explains what the selected node means. The Go menu moves around the board. The Cards / Stack view provides deeper semantic detail without becoming the main interface. The header establishes the product identity and navigation context. The metadata and classifier layer annotates the board without dominating it.

## Card decomposition

UX-001 ships as seven coordinated cards. Each card is its own pipeline session with its own designer, implementer, reviewer phases. Cards reference this epic framing document and the prior phases' completion reports.

**UX-001.1 — Brand and app shell correction (M effort).** Phase 1 of the proposal. Logo treatment, header redesign, dark surface consistency, cross-device shell behavior. The implicit audit happens in this card's designer phase against the proposal's Phase 0 checklist; the audit findings inform this card's specific scope plus inform the framing for cards 2-7.

**UX-001.2 — Timeline-first viewport repair (M effort).** Phase 2 of the proposal. Timeline visibility in the first usable viewport, panel collapsing, selected-message readout capping, composer dock positioning, normal-zoom browser testing.

**UX-001.3 — Composer and context consolidation (L effort).** Phase 3 of the proposal. One-box composer as the central action surface, target context display, per-type draft buffers, mode switching without draft loss, mobile bottom-sheet behavior.

**UX-001.4 — Act / Inspect / Go simplification (L effort).** Phase 4 of the proposal. Three-menu interaction model, duplicate rail removal, key badges for browser, bottom sheets for touch, disabled-with-reason patterns.

**UX-001.5 — Metadata and semantic annotation pass (M effort).** Phase 5 of the proposal. Object-attached flags and tags, passive state indicators, consistent visual treatments (rings, badges, chips, outlines), no raw internal codes leaking, no verdict copy.

**UX-001.5A — Node Labels: Machine Observations and User Allegations (M effort, conditional).**

Planned adjacent card after UX-001.5. UX-001.5 creates the visual annotation primitives; UX-001.5A creates the source-aware label presentation system. Machine-created labels render as Observations. User-created labels render as Allegations. The card consumes currently available client-side sources first: persisted manual tags for Allegations, deterministic metadata/lifecycle/composition mutations for Observations, and raw classifier binaries only if the pre-launch source-access audit confirms they are available without backend work. Missing raw classifier sources become a follow-up backend/persistence card (UX-001.5B) rather than expanding UX-001.5A by default. Semantic referee outputs are Machine Observations with `source: "semantic_referee"`; no third top-level label kind. Full roadmap at docs/roadmap/UX-001.5A-node-labeling-observations-allegations.md.

**UX-001.5B — Persist or expose machine observation sources for node labels (conditional, S-or-M effort).**

Contingent prerequisite card. Filed only if UX-001.5A's pre-launch source-access audit determines that raw classifier binaries are not accessible per-node in client state without backend work. The card's scope is to make the inaccessible sources available; the UI rendering remains UX-001.5A's scope. If the audit finds all needed sources are already accessible, UX-001.5B is not filed.

**UX-001.6 — Cross-device QA and visual polish (M effort).** Phase 6 of the proposal. Test matrix across Android phone, iPhone, iPad, standard tablet, desktop browser, laptop browser, narrow window, wide window. Final visual polish pass.

**UX-001.7 — Professional visual design system consolidation (M effort).** Section 10 of the proposal. Unified visual tokens for surfaces, typography, spacing, focus rings, touch targets, density modes. Standardizes the design language across everything the prior cards touched.

Total epic card count (revised): seven primary cards (UX-001.1 through UX-001.7) plus one conditional adjacent card (UX-001.5A) plus one contingent prerequisite card (UX-001.5B). Most likely total: eight to nine cards depending on UX-001.5A's audit findings.

## Non-negotiables (across all UX-001 cards)

The logo must be larger and more visually featured, especially on tablet, desktop, and browser layouts.

The header must look professional, intentional, and brand-forward.

The timeline must be visible as a primary element whenever the timeline view is active.

The browser version must not require unreasonable zooming to see the timeline.

The active board must not be pushed below excessive panels, static divs, secondary controls, or expanded readouts.

The composer must clearly show what node, message, evidence item, concession set, or branch the user is acting on.

The composer must remain contextual and persistent rather than behaving like an unrelated form.

Timeline and Cards / Stack must be quickly flippable while preserving selected node, draft, target, and context.

Mobile and tablet experiences must use touch-first interaction patterns: half-docks, bottom sheets, contextual popouts, and large hit targets.

Browser experience must support reliable keyboard navigation and shortcut-driven operation.

Metadata, tags, lifecycle state, AI/MCP checker flags, and classifier outputs must render as compact annotations attached to the relevant object.

No raw internal codes should appear in user-facing UI.

No semantic flag or checker output should visually imply truth, correctness, winning, losing, or verdict.

The redesign must preserve the existing doctrine: semantic and lifecycle signals are advisory gameplay/context signals, not truth labels.

## Non-goals (across all UX-001 cards)

Do not rebuild the product from scratch.

Do not replace the one-box composer architecture.

Do not replace Act / Inspect / Go with a new menu model.

Do not add a new backend write path.

Do not add new semantic referee behavior.

Do not introduce truth, winner, loser, proof, or verdict language.

Do not expose raw internal codes to normal users.

Do not remove existing functionality merely to simplify the screen.

Do not introduce push notifications, OAuth changes, public API endpoints, search infrastructure, or any feature beyond the consolidation scope.

## Read-only stable APIs (across all UX-001 cards)

All cards listed in the proposal's "Relevant existing work" section are considered shipped or non-blocking. The epic consolidates them visually but does not modify their underlying source files. The list includes BRAND-001, BRAND-002, QOL-030 through QOL-033, COMPOSER-002, SC-004, SC-005, IX-001 through IX-004, LIFE-001, META-001, RULE-003, COMP-001, QOL-035, plus all other shipped cards from the recent flurry: QOL-036, QOL-036.1, QOL-038, QOL-039, QOL-040, QOL-040.3, QOL-041, META-1A, META-1B, PR-003, PR-004, OPS-001 through OPS-004.

If any UX-001 card surfaces a need to modify a prior card's source file (e.g., the timeline component file that QOL-040.3 deep-link node activation uses), the card's designer surfaces the need explicitly and the operator authorizes the specific modification as a bounded read-only boundary exception. The default is no modification.

## Conditional gates between cards

UX-001 cards launch sequentially in fresh sessions rather than as chained queues. Each card's completion report includes a framing update that informs the next card's launch prompt. The pattern mirrors the PR-003 to PR-004 sequence: the prior card establishes patterns; the next card consumes them.

The exception is UX-001.6 (cross-device QA) and UX-001.7 (visual design system consolidation), which may be launched in parallel or interleaved depending on what the prior cards surface.

## Acceptance criteria (epic-level)

The epic is substantively complete when all of the following hold.

The app has a professional, coherent global visual identity.

The logo is visibly larger and meaningfully featured, especially on wide screens and tablets.

The header looks intentional, not incidental.

The timeline is visible as a primary element whenever Timeline view is active.

Browser users do not need to zoom out to an unreasonable level to see the timeline.

The selected-node readout provides context without burying the board.

The composer clearly shows what the user is replying to or acting on.

The composer remains in-room and does not navigate to a separate full-page form.

The composer can transform based on action type while preserving drafts.

Timeline and Cards / Stack are quickly flippable and preserve active context.

Touch devices expose actions through ergonomic docks, sheets, and popouts.

Browser users have reliable keyboard navigation and shortcut help.

Act, Inspect, and Go are the primary menu model.

Metadata, tags, lifecycle states, and semantic flags are visually attached to relevant objects.

Passive flags do not look like primary actions.

No existing core functionality is deprecated.

No new backend write path is introduced.

No direct insert into arguments is introduced.

No service-role usage is introduced in the client.

No raw internal codes appear in normal user UI.

No UI copy implies truth, winner, loser, correctness, proof, or verdict.

The app feels usable on Android phone, iPhone, iPad, tablet, and web browser.

The product feels like one canonical system rather than a collection of separate feature cards.

Each card's acceptance criteria are a subset of these epic-level criteria, scoped to the card's specific phase.

## Cross-card patterns to establish in UX-001.1 (Phase 1)

UX-001.1 establishes several patterns subsequent cards will consume.

The first pattern is the breakpoint strategy. Phone, tablet, desktop, and wide-desktop breakpoints each have specific behaviors. UX-001.1 specifies the breakpoint values and the layout shifts at each breakpoint; subsequent cards consume the breakpoints rather than re-establishing them.

The second pattern is the dark surface hierarchy. The proposal names dark surface consistency as a goal; UX-001.1 specifies the surface levels (primary, secondary, tertiary) with concrete color tokens that subsequent cards reference.

The third pattern is the typography and spacing scale. Section 10 of the proposal names typography and spacing scale as visual system requirements; UX-001.1 either defers these to UX-001.7 (the dedicated visual design system card) or establishes a minimum baseline that UX-001.7 extends.

The fourth pattern is the responsive logo treatment. UX-001.1 specifies how the logo scales across breakpoints; subsequent cards (especially UX-001.2 timeline-first viewport) reference the logo's vertical footprint when calculating timeline placement.

The fifth pattern is the header information density. UX-001.1 specifies what content the header contains at each breakpoint; subsequent cards (especially UX-001.4 Act/Inspect/Go) reference the header's content boundaries when placing menu triggers.

## Coordination with the existing roadmap

UX-001 supersedes BR-002 (closed as artifact). The three indefinite deferrals (QOL-040.1 notification preferences, QOL-040.2 moderator-initiated visibility, COMP-001.1 composition refinements) remain Category D candidates with their original re-evaluation triggers; UX-001 does not surface or address them.

MCP-CAT-001 design orphan (#238) remains an operator-side action; UX-001 does not affect it.

The four OPS-class cards (OPS-001 migration verification, OPS-002 spawn-card alignment and cleanup, OPS-003 cleanup procedure hardening, OPS-004 four-signal sweep) remain the operational hygiene baseline that UX-001 cards consume without modification.

If a UX-001 card surfaces a new operational friction pattern (similar to how PR-003 surfaced storage COMMENT and PR-004 surfaced DROP COLUMN ordering), the card documents the pattern in known-blockers.md and the operator decides whether to file OPS-005 with the same scope discipline.

## Forward path

UX-001.1 launches in the next session. The launch prompt is operator-authored and stored separately.

After UX-001.1 ships, the orchestrator emits a completion report that includes a Phase 1 framing section naming the breakpoints, surface hierarchy, typography baseline, logo treatment, and header content density that subsequent cards consume.

UX-001.2 launches when the operator decides; the launch prompt is produced after UX-001.1 ships using the Phase 1 framing section as the primary input.

Subsequent cards follow the same pattern: ship one, produce framing, launch next.

The epic is expected to span 10-15 sessions over multiple days or weeks. The pipeline's operational hygiene investment from OPS-001 through OPS-004 makes the sustained shipping pattern feasible.
