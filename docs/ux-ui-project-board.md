# UX/UI Project Board — Timeline-First Game Board

**Status:** Roadmap. **Nothing on this board is implemented yet** unless explicitly noted under "Baseline."
**Scope:** Stage 6.5–6.8 (Timeline Game Board, Interaction Rails, Evidence Layer, Profiles, Dev Hosting).
**Owner:** Kyler.
**Last updated:** 2026-05-18.

> **Companion doc:** [`docs/roadmap-timeline-tree-game-board.md`](roadmap-timeline-tree-game-board.md) — the Timeline Tree Game Board expansion (LIFE-001 / META-001 / SC-004 / GAME-001 / RULE-003 / AN-003 + scope additions on BR-001 / IX-001 / IX-002 / SC-003 / ST-002 / RULE-002 / GAL-002). Read it before starting any 6.6 Wave 1/2/3 card.

---

## Product thesis

CDiscourse should feel like a playable argument map. Users should land in the **argument timeline**, understand the fight in seconds, inspect the strongest and weakest talking points visually, open contextual tools without leaving the board, and switch to **Cards / Stack** only when they want richer card-level semantic detail.

The pivot this board encodes:

- **Timeline = primary gameplay surface.**
- **Stack / Cards = semantic detail / inspection surface.**

## Baseline already shipped (do not redo)

These are foundations the cards below build on. Do not re-implement them.

- **Stage 6.4** — Seamless conversation entry + observer-first side action rail. Gallery opens debates in Observer/read mode (no "choose side" modal). `ArgumentSideActionRail` collapsed by default. Section grouping: `Jump into a live dispute`, `Needs first rebuttal`, `Source trail fights`, `Hot but unresolved`, `Easy first move`, `My rooms`. `gameCopy.toPlainLanguage` maps internal codes to user prose.
- **Stage 6.3** — Conversation Gallery (cards, dedupe, 11 buckets, heat, temperament, signals, search, sort, pagination). Horizontal `ConversationMiniTimeline`. Lane fix: first child continues on parent's lane.
- **Stage 6.2** — Score / trend is non-blocking. Heat = activity / friction, not correctness. Popularity is never evidence.
- **Stage 6.1.8** — Argument Stack + horizontal DAW-style Timeline scaffold. Own bubbles never expose edit / disagree / flag / score. Deletion is a request, not a hard delete.

The doctrine that survives every card on this board:

- Score is gameplay analysis, **never** truth.
- Heat means activity / friction.
- Popularity is **not** evidence.
- AI never decides who is right.
- No "winner / loser / liar / true / false" copy in user surfaces.

---

## Board lanes

| Lane | Window | Releases |
| --- | --- | --- |
| **Now** | Sprint 1 | Release 6.5 |
| **Next** | Sprint 2–3 | Release 6.6, 6.7 |
| **Later** | Sprint 4 | Release 6.8 |
| **Infra / Parallel** | continuous | hosting, QA, a11y, analytics |
| **Research / Spike** | as needed | branch layout algo, avatar policy, `/dev` subpath routing |

---

## Release sequence

### Release 6.5 — Timeline-first board polish
Cards: TL-001, TL-002, TL-003, VG-001, SC-001, SC-002, PM-001.
**Definition of done:** Timeline is primary. Stack is details mode. Tapping nodes updates active point + side rail. No side declaration before entering. Tests pass.

### Release 6.6 — Branches, kinks, evidence gameplay + Timeline Tree Game Board
Cards (Wave 1 foundation): **BR-001 (tree + branch grammar)**, **LIFE-001 (point lifecycle metadata)**, **META-001 (tag / flag / metadata ledger)**.
Cards (Wave 2 board interaction): **SC-004 (timeline node action dock)**, **IX-001 (zoom + focus modes)**, **ST-002 (lifecycle-driven suggestions)**.
Cards (Wave 3 game constraints): **GAME-001 (exhaustion + moved-on rules)**, **RULE-003 (lifecycle-to-UX map)**, IX-002 (mini-map).
Cards (Wave 4 polish): EV-001 ✅, EV-002 ✅, EV-003, EV-004, RULE-001 ✅, RULE-002, GAL-002.
**Definition of done:** Branch/tangent paths visible. Point lifecycle visible without verdict copy. Board action dock drives the contextual move. Evidence + source-chain become interactive tools. No internal codes leak. Exhaustion / moved-on / ignored advisories are non-blocking.

### Release 6.7 — Profiles and preferences
Cards: PR-001, PR-002, PR-003, PR-004, IX-003.
**Definition of done:** User can inspect/update lightweight profile info. Avatar policy is safe. Preferences affect board density/motion/accessibility.

### Release 6.8 — Public dev deployment
Cards: HOST-001, HOST-002, HOST-003, AN-002.
**Definition of done:** Dev app reachable at `cdiscourse.com/dev` (or documented fallback `dev.cdiscourse.com`). SPA refresh works. Environment clearly marked dev. Smoke test passes.

---

# Epics & Cards

## Epic 1 — Timeline as Primary Landing Surface

### TL-001 — Make Timeline the default room landing mode
- **Priority:** P0 — **Effort:** M — **Release:** 6.5
- **Why:** Timeline reads as a game board; Stack reads as a detail view.
- **Scope:** Change room default from `stack` → `timeline`. New rooms land on Timeline with root selected. Stack remains a visible toggle (relabel to "Cards"). Preserve active message across mode switches. `needs_first_rebuttal` cards activate root; others activate latest.
- **Acceptance:** Normal conversation → Timeline. Side rail collapsed on entry. Observer unless already a participant. Switching to Cards shows same active message.
- **Tests:** `roomEntryDefaultMode.test.ts` covering non-participant, existing participant, new debate creation, no-modal-on-entry.

### TL-002 — Timeline onboarding focus on the first point
- **Priority:** P0 — **Effort:** S/M — **Release:** 6.5
- **Scope:** First node gets a "Root" marker. Root popover: "This is the opening claim." Root → first-rebuttal edge uses distinct grammar ("first clash"). No-rebuttal rooms show "Be the first rebuttal." Long timelines keep "Back to root" accessible.
- **Acceptance:** Root never visually lost. No-rebuttal rooms make first move obvious. No tutorial modal.

### TL-003 — Timeline board shell with no page redirect
- **Priority:** P0 — **Effort:** M — **Release:** 6.5
- **Scope:** Timeline stays inside the room surface. Quick tools open popovers / drawers / sidecars in-place. No route transition for observe / join / reply / qualifier / source. Stack/Cards is a surface toggle, not a route.
- **Acceptance:** All quick actions preserve current room. Browser back doesn't strand a popover.

---

## Epic 2 — Timeline Visual Design System

### VG-001 — Argument visual grammar: shape, color, weight, texture
- **Priority:** P0 — **Effort:** L — **Release:** 6.5

| Meaning | Shape | Color | Stroke | Label |
| --- | --- | --- | --- | --- |
| Root claim | Rounded square / flag tab | Indigo | Solid | Root |
| Claim / support | Circle | Indigo/blue | Normal | Claim |
| Rebuttal / challenge | Diamond | Orange/red | Bold left edge | Challenge |
| Evidence | Hexagon | Cyan/green | Inner receipt mark | Evidence |
| Source-chain demand | Hexagon + dotted ring | Cyan/teal | Dotted ring | Source? |
| Clarification | Circle + question notch | Amber | Light pulse | Clarify |
| Concession / narrowing | Pill | Purple | Soft gradient | Narrowed |
| Synthesis | Large pill / joined capsule | Purple/green | Double border | Synthesis |
| Tangent / branch | Bent connector | Slate/amber | Dashed edge | Side issue |
| Flag / moderation | Warning marker | Red/slate | Crosshatch | Review |
| Weak / unsupported | Same base | Muted fill | Dashed border | Weak |
| Strong / supported | Same base | Saturated fill | Solid/glow border | Strong |

- **Acceptance:** Shape never depends on color alone. Strong/weak via stroke/weight/texture. 44px min tap target. Accessibility labels describe meaning. No truth/winner copy.

### VG-002 — Gradient wave rail
- **Priority:** P0 — **Effort:** M/L — **Release:** 6.6
- **Scope:** Segmented gradient main rail blending prior+next node colors, tone overlay, evidence-risk overlay, active-path highlight. RN `<View>` segments first; no new deps. Heat = activity, not correctness.
- **Acceptance:** Active path glows. Tangent rail kinks/breaks. Hot unresolved warm but never labeled "right." Legible at 250+ messages.

### VG-003 — Bootstrap-inspired design tokens without importing Bootstrap
- **Priority:** P1 — **Effort:** M — **Release:** 6.5/6.6
- **Recommendation:** Do **not** add Bootstrap as an RN dep. Build a token layer: `spacing.xs/s/m/l/xl`, `radius.sm/md/lg/pill`, `status.info/warning/danger/success/neutral`, `surface.base/elevated/overlay`, `rail.active/inactive`, `argument.claim/challenge/evidence/clarify/concede/branch`.
- **Acceptance:** Single token source for timeline / rail / sidecar / quick actions / profile popout. Web + mobile share naming.

---

## Epic 3 — Branches, Tangents, and Kinks

### BR-001 — Tangent kink model / argument tree layout foundation
- **Priority:** P0 — **Effort:** L — **Release:** 6.6 — **Wave:** 1 — **Agent:** timeline-ui-agent / roadmap-designer first
- **Status:** Build complete, awaiting Review. See `docs/designs/BR-001.md` + `docs/current-status.md` BR-001 entry.
- **Model:** Five-value `RailBranchKind` (`'main' | 'tangent' | 'kink_start' | 'kink_end' | 'detached'`) is preserved from VG-002's surface lock. Topology classifier in `src/features/arguments/branchTopologyModel.ts`: `deriveBranchKindFromConstitutionModel({ fromNode, toNode, isDetached, siblingIndex, isEvidenceThread, hasTangentLexicalCode })` + `buildBranchKindMap` (two-pass O(n)) + `buildEvidenceThreadMap` (≥ 50% non-root evidence-like + size ≥ 2). Collapse state: `BranchCollapseState = Readonly<Record<branchRootMessageId, 'collapsed' | 'expanded'>>`, `toggleBranchCollapse`, `applyActiveAutoExpand`, `buildCollapsedRailInputs` → `RailStubViewModel[]`. Stub component `BranchCollapseStub.tsx` (24×24 pill, anchored to branch root, `hitSlop` ≥ 14, plain-English a11y label, reuses VG-001 `BRAND.surface.appElevated` + `node.kindColor` — no new color token). `LIFE-001` cluster type + branchKind label set above remain Wave-1 future scope.
- **Scope additions (Timeline Tree Game Board):** Tree layout, not only kink graphics. Branch cluster click focuses a region (area-click selection). Collapsed branch stubs show count + branchKind icon + lifecycle summary chip. Active node inside collapsed branch auto-expands. Tree layout must remain deterministic across 250+ messages and testable.
- **Acceptance:** First child continues mainline when appropriate. Additional children branch up/down deterministically. Branches render visible kinks/stubs. Active path visible through branches. 250+ message stress fixture remains legible with IX-001 density hooks.
- **Tests:** sibling lane determinism · branch type classification · collapsed branch stub count · active path auto-expansion · missing parent / detached branch handling · 250+ message fixture.

### BR-002 — Split-screen branch inspector
- **Priority:** P2 — **Effort:** L/XL — **Release:** 6.6+
- **Scope:** Click branch label → branch inspector. Left: main timeline context. Right/bottom: branch timeline. "Return to mainline" CTA. No new route.

---

## Epic 4 — Sidecars, Popovers, Quick Tools

### SC-001 — Consolidate controls into the side action rail
- **Priority:** P0 — **Effort:** M/L — **Release:** 6.5
- **Baseline:** `ArgumentSideActionRail` already exists (Stage 6.4) with observer / participant-other / own-bubble action sets.
- **Scope:** Rail always available in Timeline mode, collapsed by default. Expanding shows grouped tools: Watch/Observe · Join side · Reply · Evidence · Branch · Review/flag · Share. Tap updates active node + contextual rail. Long-press → mini popover when feasible.
- **Acceptance:** No side declaration before entering. Join only via explicit Join For / Join Against. No redirects. Own-bubble safety unchanged.

### SC-002 — Timeline node popover
- **Priority:** P0/P1 — **Effort:** M — **Release:** 6.5
- **Contents:** message preview · node status · strength band · tone/temperature · quick actions (Reply, Challenge, Source?, Quote?, Evidence, Concede, Branch) · "Open details" → sidecar.
- **Acceptance:** Tap node → active. Second tap / info icon → popover. Popover doesn't block timeline nav. Uses same action mapping as rail.

### SC-003 — Sidecar as detail inspector, not action dumping ground
- **Priority:** P1 — **Effort:** M — **Release:** 6.6 — **Wave:** 2
- **Sections:** "What this move says" · "Why it matters" · "What is unresolved" · "Where it sits" · "Suggested next move" · "Semantic flags" (deeper in Stack mode).
- **Acceptance:** Timeline sidecar concise. No body editing. No internal snake_case codes.
- **Boundary:** SC-003 is the **detail inspector**. The **action dock** is SC-004. SC-003 surfaces lifecycle state + unresolved axes + suggested next move; SC-004 owns the contextual move palette.

### SC-004 — Timeline node action dock
- **Priority:** P0/P1 — **Effort:** M/L — **Release:** 6.6 — **Wave:** 2 — **Agent:** sidecar-tools-agent — **Status:** Build complete (awaiting Review).
- **Goal:** Compact action dock anchored on the Timeline / Tree surface for the selected node / cluster.
- **Required actions:** Reply · Challenge · Ask source · Ask quote · Clarify · Add evidence · Narrow · Concede · Confirm · Mark moved on · Mark ignored · Branch · Synthesize · Flag · Open Cards detail.
- **Acceptance:** Dock appears near selected node/cluster or as bottom rail on narrow screens. Own-message restrictions preserved (only `Open Cards detail · Mark synthesis-ready · Mark narrowed · Request deletion`). Observer matrix preserved. Actions create non-accusatory composer presets. Open Cards detail does not route away.
- **Tests:** observer action matrix · participant-other matrix · own-message matrix · node selection updates dock · no route transition · preset mapping · ban-list across produced strings.
- **Implementation:** `src/features/arguments/timelineNodeActionDockModel.ts` (new, pure-TS) · `TimelineNodeActionDock.tsx` (new, RN) · `quickActionPresets.ts` extended (`narrow / confirm / synthesize` + 3 preset bodies) · `ArgumentTimelineMap.tsx` + `ArgumentGameSurface.tsx` integration (5 new optional props, lifecycle + metadata + dock model build, selection state, mutual exclusion with SC-002 popover). Tests: `__tests__/timelineNodeActionDock{Model,Doctrine,ForbiddenImports,SelectionExclusion}.test.ts` (+129 tests). See `docs/designs/SC-004.md`.

---

## Epic 5 — Stack Mode as Semantic Detail View

### ST-001 — Reposition Stack as "Card Details"
- **Priority:** P1 — **Effort:** S/M — **Release:** 6.5
- **Recommended label:** `Timeline` and `Cards`.
- **Scope:** Card view shows semantic flags · suggested reply flags · evidence/source-chain hints · parent/child path · score/trend detail · moderation-safe advisories · "Back to map" CTA.

### ST-002 — Suggested reply flags per bubble card
- **Priority:** P1 — **Effort:** M — **Release:** 6.6 — **Wave:** 2
- **Inputs:** disagreement axis · sourceChainRisk · evidentiaryRisk · latest move type · active path depth · no-rebuttal · stopReason · branch/tangent status · statement standing · **LIFE-001 point lifecycle state** · **META-001 manual tags + auto metadata**.
- **Suggested moves:** Ask source · Ask quote · Narrow · Concede · Confirm · Challenge mechanism · Challenge scope · Branch tangent · Synthesize.
- **Acceptance:** Suggestions deterministic + explainable, never block posting, never label people, map to quick-action presets. Card shows *why* a move is suggested (lifecycle / tag derivation surface).
- **Tests:** suggestion derivation table · copy ban-list · composer preset mapping · no forced action.

---

## Epic 6 — Evidence and Source-Chain Gameplay

### EV-001 — Evidence object model v1
- **Priority:** P0/P1 — **Effort:** L — **Release:** 6.6 — **Status:** Build complete (awaiting Review).
- **Object:** `EvidenceArtifact { id, argumentId, kind: 'url'|'quote'|'source_text'|'dataset'|'screenshot_redacted'|'manual_citation', label, url?, sourceText?, quote?, sourceChainStatus: 'no_source'|'unverified'|'source_no_quote'|'source_and_quote'|'broken'|'primary_present', risk: 'low'|'medium'|'high'|'unknown', addedByUserId, createdAt }`. `no_source` is aggregate-only (returned by the chip / timeline helpers when the artifact list is empty, never by `deriveSourceChainStatus`).
- **Acceptance:** Pure-TS adapter over the existing `attached_evidence` payload — zero schema change in v1. Receipt chip + timeline-node contracts exported. Source-chain status visible on node. Missing evidence only blocks explicit Evidence posts — ordinary replies stay postable. EV-002 / EV-003 / EV-004 consume the locked exports.
- **Implementation:** `src/features/evidence/evidenceModel.ts` (+ `index.ts`); `__tests__/evidenceModel.test.ts` (+64 tests); `docs/evidence-object-model.md`.

### EV-002 — Source-chain popover
- **Priority:** P0/P1 — **Effort:** M — **Release:** 6.6
- **States:** No source → "Ask for source" · Source no quote → "Ask for quote" · Both → "Inspect receipt" · Broken → "Source trail is weak" · Primary present → "Source trail anchored."
- **Acceptance:** Dotted teal ring on source-chain nodes. Insert composer preset, never accuses. Popularity never treated as evidence.

### EV-003 — Evidence debt tracker
- **Priority:** P1 — **Effort:** L — **Release:** 6.6
- **Debt types:** source needed · quote needed · scope example needed · definition needed · mechanism needed · counterexample needed · primary record needed.
- **Display:** debt chip on node · debt count in sidecar · debt badges on branch line · "resolve debt" quick action.
- **Acceptance:** Per move, not global. Resolvable by later moves. Never declares original point false. Influences strength visuals, not truth labels.

### EV-004 — Evidence symmetry with game rules
- **Priority:** P1 — **Effort:** M — **Release:** 6.6
- **Mapping:** `source_chain` → trail chip + dotted edge · `evidence` → receipt chip + hex shape · `scope` → bracket icon · `definition` → key-term icon · `logic` → chain icon · `causal` → arrow icon · `anti_amplification` → crowd-slash icon · `synthesis_ready` → merge icon · `max_depth_reached` → stalemate band.
- **Acceptance:** Plain-language only. Raw validation codes never user-visible.

---

## Epic 7 — Strength / Weakness Visualization

### SW-001 — Strong vs weak talking point bands
- **Priority:** P0/P1 — **Effort:** M — **Release:** 6.5/6.6
- **Soft labels** (Timeline):
  - Pretty wrong → "Needs work"
  - Slightly wrong → "Thin"
  - Neutral → "Neutral"
  - Slightly right → "Some support"
  - Maybe right but misguided → "Has a point, but risky"
  - Pretty right → "Well supported"
  - Completely right → "Strongly supported"
- **Stack/Cards** may show the richer seven-band label.
- **Acceptance:** No "winner/loser/truth" label. Strength via shape/stroke/texture, not only color.

### SW-002 — Heat, momentum, trend without truth claims
- **Priority:** P1 — **Effort:** M — **Release:** 6.6
- **Inputs:** move count · recent activity · branch depth · unresolved debt · repeated axis pressure · no-rebuttal · synthesis-ready.
- **Acceptance:** Heat ≠ correctness. Popularity ≠ evidence. Quiet rooms framed as easy entry.

---

## Epic 8 — Timeline Interaction Mechanics

### IX-001 — Timeline zoom and density modes
- **Priority:** P0/P1 — **Effort:** L — **Release:** 6.6 — **Wave:** 2
- **Density modes:** Compact (dots, label on active) · Normal (shapes + short labels) · Expanded (shapes + badges + snippets).
- **Focus lenses (new):** Active path · Branch cluster · Unresolved only · Evidence / source only.
- **Area-click selection:** Clicking a branch lane / cluster focuses that cluster (drives SC-004 dock).
- **Acceptance:** 5-message timeline isn't sparse. 300-message remains navigable. Zoom persists per session. Density changes preserve active node. Focus lens hides only visually; data remains intact. No inaccessible tap targets (44px min). No new dependency.
- **Tests:** density model · focus filter model · active node preserved across density change · tap target minimums · accessibility labels.

### IX-002 — Timeline mini-map overview
- **Priority:** P1 — **Effort:** M/L — **Release:** 6.6/6.7 — **Wave:** 3
- **Scope additions (Timeline Tree Game Board):** Mini-map summarizes branch clusters, unresolved points, exhausted points, active path. Clicking mini-map region pans / focuses the tree. Supports branch collapse / expand.
- **Acceptance:** Mini-map visually distinct from main map. No route transition. Works with 250+ messages.
- **Tests:** region summary · click-to-focus model · collapsed branch count · active path indicator.

### IX-003 — Keyboard and accessibility navigation
- **Priority:** P1 — **Effort:** M — **Release:** 6.7
- **Acceptance:** Arrow L/R moves active node. Home/End → root/latest on web. Accessibility roles + selected state. Nodes expose type, ordinal, strength, branch, active.

---

## Epic 9 — Profile, Preferences, Avatar, Identity

### PR-001 — "My preferences" popout
- **Priority:** P1 — **Effort:** M — **Release:** 6.7
- **Fields:** display name · avatar preview · contact email · notification stub · default room entry preference · visual density · color accessibility · reduce motion · default side label preference.
- **Acceptance:** Popout/drawer. No role escalation. No hidden auth fields.

### PR-002 — Profile tag popout
- **Priority:** P2 — **Effort:** M — **Release:** 6.7
- **Allowed:** topic interests · debate style · availability · accessibility preference.
- **Disallowed:** protected-class targeting, party-affiliation requirement, "expert" without verification, hostile labels, ideology/personality scoring.
- **Acceptance:** Optional. Max 3–5 visible. No effect on truth/score. No effect on validation gates.

### PR-003 — Avatar upload policy and storage
- **Priority:** P1/P2 — **Effort:** L — **Release:** 6.7
- **Policy:** Bucket `profile-avatars` · Max 2 MB · jpg/png/webp · resize 256×256 + 64×64 thumb · public read opt-in else signed · no EXIF · strip metadata pre-upload · default generated avatar.
- **Acceptance:** Upload/change/remove flows. URL not user-editable raw. MIME + size validation. No service-role in client. Storage RLS prevents arbitrary overwrite.

### PR-004 — Contact information update
- **Priority:** P2 — **Effort:** M/L — **Release:** 6.7
- **Scope:** Email change via Supabase auth update (not profile-only mutation). Verification-pending state. User id never exposed beyond masked/debug. Display name separate from email.
- **Acceptance:** No role/id/email escalation through profile payload.

---

## Epic 10 — Hosting cdiscourse.com/dev

### HOST-001 — Dev hosting architecture
- **Priority:** P0 (if public testing imminent) — **Effort:** M/L — **Release:** 6.8
- **Decision:** `/dev` path is riskier than `dev.cdiscourse.com` for an Expo web app (asset paths + router paths + SPA fallback must respect subpath). **Spike required before commit.**
- **Options:** A) `dev.cdiscourse.com` (recommended fallback) · B) `cdiscourse.com/dev` via reverse proxy rewrite.
- **Scope:** Web dev build profile · base path config · hosting provider · DNS · SPA fallback · safe public env only · deploy checklist.
- **Acceptance:** App loads at chosen URL. Nested-route refresh works. Static assets resolve. Supabase public URL/key from safe env. No service-role / API keys. No console 404s.

### HOST-002 — Dev environment banner
- **Priority:** P0 — **Effort:** S/M — **Release:** 6.8
- **Scope:** "CDiscourse Dev" banner · commit hash/build version · "Test data may be reset" notice · "Report issue" link · bot/test rooms clearly labeled.

### HOST-003 — Deployment smoke checklist
- **Priority:** P0 — **Effort:** S — **Release:** 6.8
- **Checks:** signup/login · gallery loads · duplicate-gen rooms collapsed · open room → Timeline · observer rail collapsed · explicit join · post a move · Timeline ↔ Cards · evidence popover · preferences popout · default avatar · no console 404s · no service-role · no raw validation codes.

---

## Epic 11 — Conversation Gallery and Project Board Entry

### GAL-001 — Upgrade gallery sections into play lanes
- **Priority:** P1 — **Effort:** M — **Release:** 6.6
- **Sections:** Jump in now · Needs first rebuttal · Source trail fights · Evidence needed · Definition fights · Logic traps · Tangents/branches · Almost synthesis · Quiet beginner rooms · My active rooms.
- **Acceptance:** Deterministic grouping. Filter by action. Duplicate generated rooms remain collapsed. Heat framed as activity.

### GAL-002 — Entry cards with first suggested move
- **Priority:** P1 — **Effort:** M — **Release:** 6.6 — **Wave:** 4
- **Examples:** "Be the first rebuttal" · "Ask for the source" · "Challenge the mechanism" · "Narrow the claim" · "Offer synthesis" · "Watch first" · "Join when ready."
- **Acceptance:** Hint from model fields, not AI call. Maps to quick action in rail. Short plain-language. No internal codes.
- **Scope addition (Timeline Tree Game Board):** Once LIFE-001 lands, hint source moves to the *root cluster lifecycle state* of the room rather than the current heat / bucket heuristic. Stale-derivation guard: hint recomputes every load.

---

## Epic 12 — Evidence-Enhanced Game Rules and Flow

### LIFE-001 — Point lifecycle metadata model
- **Priority:** P0 — **Effort:** L — **Release:** 6.6 — **Wave:** 1 — **Agent:** evidence-rules-agent + timeline-ui-agent
- **Goal:** Pure-TS lifecycle model for individual points and point clusters. Computed deterministically from existing `public.arguments` + `attached_evidence` + semantic flags. No persistence.
- **States:** `open · answered · rebutted · clarified · sourced · quote_requested · source_requested · narrowed · conceded · confirmed · synthesis_ready · moved_on_by_affirmative · moved_on_by_negative · ignored_by_affirmative · ignored_by_negative · ignored_by_both · exhausted · branch_recommended · archived_or_resolved`.
- **Acceptance:** Lifecycle summary computable from a message cluster. Ordinary replies remain postable. Exhaustion / moved-on / ignored-by-side states are advisories only — never block. No user-facing `snake_case`. No truth / verdict / person-label copy.
- **Tests:** each state derivation · ignored-by-one-side · ignored-by-both · concession / narrowing path · synthesis-ready path · repeated-axis-pressure exhaustion · ban-list across labels.

### META-001 — Move tag / flag / metadata event ledger
- **Priority:** P0/P1 — **Effort:** L — **Release:** 6.6 — **Wave:** 1 — **Agent:** evidence-rules-agent
- **Goal:** Define how **manual user tags**, **auto-derived metadata**, and **moderation flags** are represented and kept hard-separated for each move and point cluster.
- **Manual tags:** `needs_source · needs_quote · definition_issue · scope_issue · causal_mechanism · evidence_debt · concession_offered · narrowed_claim · tangent · ready_for_synthesis`.
- **Auto metadata:** `has_reply · has_rebuttal · has_counter_rebuttal · has_evidence · source_requested · quote_requested · source_attached · quote_attached · participant_skipped_node · no_response_after_n_turns · repeated_axis_pressure · branch_suggested · branch_created · point_stalled · point_exhausted · synthesis_candidate`.
- **Acceptance:** Manual tag model exists (render-time only in v1, no persistence). Auto metadata derivation model exists. UI contract exposes plain-language labels via RULE-003. Existing semantic flags map cleanly into the model. Moderation flags remain isolated.
- **Tests:** no raw code labels in UI contract · manual tag dedupe · auto-tag derivation table · card detail contract shape · timeline summary contract · ban-list across produced strings.

### GAME-001 — Point exhaustion and timeout rules
- **Priority:** P1 — **Effort:** M/L — **Release:** 6.6 — **Wave:** 3 — **Agent:** evidence-rules-agent / point-standing-economy
- **Goal:** Non-blocking advisories for stale / ignored / exhausted / synthesis-ready clusters. Pure model.
- **Acceptance:** Repeated same-axis pressure produces `exhausted` advisory. One-party nonresponse produces `ignored_by_<side>` advisory. Both-party dormancy produces `ignored_by_both` advisory. Concession + narrowing + no unresolved debt produces `synthesis_ready`. **No blocking output**. **No truth verdict**. **No "winner / loser"**. **No automated punishment**.
- **Tests:** no blocking output · repeated-axis exhaustion · one-party ignored · two-party ignored · synthesis-ready · copy ban-list.

### RULE-001 — Semantic rule-to-UI map
- **Priority:** P1 — **Effort:** M — **Release:** 6.6

```ts
source_chain      -> "Ask for the source"
evidence_debt     -> "Needs receipts"
scope             -> "Narrow the claim"
definition        -> "Define the term"
logic             -> "Challenge the inference"
causal            -> "Challenge the mechanism"
anti_amplification -> "Popularity is not proof"
synthesis_ready   -> "Offer synthesis"
```

- **Acceptance:** `toPlainLanguage` covers every code in timeline/sidecar. Unknown snake_case suppressed. Tests assert no internal-code leak.

### RULE-002 — Evidence symmetry between validation and visuals
- **Priority:** P1 — **Effort:** M — **Release:** 6.6
- **Mapping:** Weak topic → "May be drifting" chip · Parent nonresponsive → "Reconnect to parent?" · Missing source → source-chain action · Missing quote → quote request · Scope risk → narrow action · Definition ambiguity → clarify/define.
- **Acceptance:** Warnings become suggested moves. One click from timeline. Ordinary replies stay postable.
- **Cross-ref:** RULE-003 owns the lifecycle-state-to-UX label map; RULE-002 stays focused on validation-warning-to-suggested-move mapping.

### RULE-003 — Lifecycle-to-UX doctrine map
- **Priority:** P1 — **Effort:** M — **Release:** 6.6 — **Wave:** 3 — **Agent:** sidecar-tools-agent / evidence-rules-agent
- **Goal:** Map every LIFE-001 lifecycle state + META-001 metadata tag to a plain-language label, helper line, icon, and allowed action set. Sits beside RULE-001 (semantic-code map) and RULE-002 (validation-to-suggested-move map).
- **Acceptance:** No raw internal codes in UI. No truth labels. No user / person labels. Every lifecycle state has a safe label / helper / action mapping. Ban-list assertion across produced strings.
- **Tests:** all states have labels · ban-list assertion · no snake_case visible · no produced action creates a blocked ordinary reply path.

---

## Epic 13 — Board-Level Analytics Without AI Calls

### AN-001 — Deterministic board diagnostics
- **Priority:** P2 — **Effort:** M — **Release:** 6.7
- **Outputs:** hot zones · unresolved axes · strong/weak counts · evidence-debt count · branch count · synthesis-ready count · no-rebuttal count.
- **Acceptance:** Pure deterministic. No xAI/Anthropic. UI tests + debug only.

### AN-003 — Tree playability diagnostics
- **Priority:** P2 — **Effort:** M — **Release:** 6.7 — **Wave:** 4 — **Agent:** analytics-agent
- **Goal:** Pure-model diagnostics for whether a tree is playable: number of unresolved points · number of exhausted / stale points · branch depth · average actions to reach active unresolved point · source / evidence debt concentration · nodes with no available suggested action.
- **Acceptance:** Pure model. Dev / debug output only. No public scoring verdict. No xAI / Anthropic call.
- **Tests:** deep-tree fixture · unresolved-point count · branch-overload indicator · no truth / verdict copy.

### AN-002 — Visual QA snapshots
- **Priority:** P2 — **Effort:** M — **Release:** 6.8
- **Fixtures:** no-rebuttal · straight 10-move chain · source-chain fight · evidence-heavy branch · tangent/kink · synthesis path · 250-node stress · avatar/profile display.

---

## Epic 14 — UX Project Board Itself

### PM-001 — Create `docs/ux-ui-project-board.md`
- **Priority:** P0 — **Effort:** S — **Status:** ✅ Done (this file).

### PM-002 — Add "Now/Next/Later" tracker to `docs/current-status.md`
- **Priority:** P1 — **Effort:** S — **Release:** 6.5
- **Acceptance:** Current stage identifies next UX target. Completed stages remain historically accurate. Test count updated only after actual implementation.

---

## Dependencies (selected)

- TL-001 blocks SC-002 (popover assumes Timeline default).
- VG-001 blocks SW-001 (strength bands need the visual-token layer).
- EV-001 blocks EV-002, EV-003, EV-004 (popover, debt tracker, symmetry all read the artifact model).
- RULE-001 blocks GAL-002, ST-002 (suggested-move copy lives there).
- BR-001 blocks BR-002, IX-002, LIFE-001, SC-004 (tree / cluster contract is the foundation).
- LIFE-001 blocks META-001, ST-002 expansion, GAL-002 expansion, GAME-001, RULE-003 (lifecycle state is the input).
- META-001 blocks SC-004 dock-content, ST-002 suggestion derivation, AN-003 diagnostics inputs.
- SC-004 blocks the dock-side acceptance of IX-001 area-click (focus drives dock contents).
- RULE-003 blocks any UI surface that renders LIFE-001 or META-001 labels.
- HOST-001 spike blocks HOST-002/003 (banner/smoke depend on chosen deployment URL).

---

## Risks

1. **`/dev` path hosting** is riskier than `dev.cdiscourse.com` for Expo web — asset paths, router paths, and SPA fallback must respect the subpath. **Spike before committing.**
2. **Avatar uploads** introduce storage, moderation, privacy, and metadata-stripping concerns. Not just a UI card — needs storage policy + RLS review.
3. **Branch/kink layout** can get complicated fast. First version must stay deterministic and conservative: mainline horizontal, first sibling continues, additional siblings branch up/down, collapse available.
4. **Strength/weakness visuals** must not drift into "true/false" or "winner/loser." Score remains gameplay analysis; score never blocks posting.
5. **Test count drift** — existing CLAUDE.md tracks test counts precisely. New cards must update `docs/current-status.md` only after tests actually pass.

---

## Hard constraints (apply to every card)

- Do not call xAI, Anthropic, X, or other external AI APIs from the app.
- Do not deploy Supabase functions from Claude sessions without explicit operator action.
- Do not use service-role in client.
- Do not direct-insert into `public.arguments` (use `submit-argument`).
- Do not edit `.env*`.
- Do not add dependencies unless impossible with React Native primitives — document instead.
- Do not expose raw internal validation codes to normal users.
- Do not introduce winner/loser/truth labels.
- Heat means activity/friction, not correctness.
- Popularity is not evidence.

---

## Implementation prompt (Release 6.5 starter)

See the paste-ready prompt in the project board issue for **TL-001 + the rest of 6.5**. Summary:

1. Read `CLAUDE.md`, `docs/current-status.md`, `docs/seamless-conversation-entry.md`, `docs/argument-stack-timeline-surface.md`, `docs/conversation-gallery-ux.md`, `docs/browser-visual-test.md`.
2. Baseline: `git status -sb`, `npm run typecheck`, `npm run lint`, `npm run test`.
3. Implement TL-001 → TL-003, ST-001 (rename), VG-001 (token mapper), SC-002 (node popover), SC-001 (rail consolidation).
4. Update `docs/current-status.md`, `docs/browser-visual-test.md`, `docs/argument-stack-timeline-surface.md`.
5. Secret-scan diffs.
6. Commit: `feat: make timeline the primary game board and add UX project roadmap`.

---

## Manual QA list (Release 6.5)

- Open a room from gallery → lands in Timeline, observer rail collapsed.
- Create a new debate → lands in Timeline, root selected.
- Tap latest node → side rail updates, popover available.
- Tap "Cards" → same active message in Stack view.
- Tap "Timeline" → returns to same active message + scroll position.
- Open a `needs_first_rebuttal` gallery card → root is active, callout visible.
- Own-bubble tap → only `Qualifiers` + `Request deletion` actions show.
- Other-bubble tap (as participant) → `Reply · Disagree · Ask source · Ask quote · Split branch · Flag · Qualifiers`.
- Long debate (50+ moves) → timeline remains navigable, no jank.
- Plain language only — no `source_chain_lexical`, no `topic_satisfaction_lexical`, no raw codes anywhere.
