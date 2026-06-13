# UX/UI Project Board — Timeline-First Game Board

**Status:** Roadmap. **Nothing on this board is implemented yet** unless explicitly noted under "Baseline."
**Scope:** Stage 6.5–6.9 (Timeline Game Board, Interaction Rails, Evidence Layer, Profiles, Dev Hosting, Admin/email/test infra).
**Owner:** Kyler.
**Last updated:** 2026-05-22.

> **Companion doc:** [`docs/roadmap-timeline-tree-game-board.md`](roadmap-timeline-tree-game-board.md) — the Timeline Tree Game Board expansion (LIFE-001 / META-001 / SC-004 / GAME-001 / RULE-003 / AN-003 + scope additions on BR-001 / IX-001 / IX-002 / SC-003 / ST-002 / RULE-002 / GAL-002). Read it before starting any 6.6 Wave 1/2/3 card.

> **Live GitHub mirror:** This doc is mirrored on **GitHub Project #1
> "CDiscourse UX/UI Roadmap"** (owner `kyleruff1`,
> <https://github.com/users/kyleruff1/projects/1>). The canonical card
> catalogue for the `QOL-NNN` cards not already covered by a
> TL/VG/BR/SC/ST/EV/SW/IX/PR/HOST/GAL/RULE/AN/PM issue is
> `scripts/github/uxBoardCards.json`; `npm run github:ux-board:dry`
> validates and previews it. Setup + field schema:
> [`docs/github-projects-setup.md`](github-projects-setup.md).
>
> **2026-05-22 board reconciliation pass:** all 13 then-open roadmap
> issues are on Project #1 (PR-004 #26 and META-1D #79 were added this
> pass — they were the only two missing). Two project fields, **Risk**
> (Low/Medium/High) and **Area** (UX/UI/Data/Validation/Supabase/Docs/
> Testing/GitHub Projects/Agents), were created. The `QOL-001…014`
> "new card" numbers from earlier roadmap drafts are **superseded** —
> their content is already tracked by existing TL/VG/BR/SC/ST/EV/SW/IX/
> PR/HOST/AN issues; see the `supersededByExisting` map in
> `uxBoardCards.json`. `QOL-015…042` already exist as issues
> (#39–#44, #199–#211) — most closed (shipped). No duplicate cards
> were created.

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

## Supersession map — the one-box interface (QOL-030…033)

> Added 2026-05-21 from [`docs/project-audits/2026-05-21-roadmap-collision-supersession-analysis.md`](project-audits/2026-05-21-roadmap-collision-supersession-analysis.md).
> **Read this before picking up any SC / RULE-005 / IX-001 / IX-002 / COMPOSER / ST-001 card.**

The one-box interface design (QOL-030 foundation + QOL-031/032/033 popouts)
**supersedes the build requirements** of a web of earlier cards. "Supersede"
here is precise:

- **Pure models survive.** `channelModel`, `timelineNodeActionDockModel`,
  `sourceChainPopoverModel`, `timelineMiniMapModel`, `ObserverActionDockLayout`,
  and `buildSidecarViewModel` are reused unchanged.
- **The React shell re-houses** under the QOL-030 popout chassis / one-box
  composer. **Do not implement a superseded card as a standalone bespoke
  surface.**

| Superseded / amended card | Status | Re-housed under |
|---|---|---|
| SC-001 side action rail | Superseded | QOL-031 Act popout |
| SC-002 timeline node popover | Superseded | QOL-032 Inspect popout |
| SC-003 sidecar detail inspector | Superseded | QOL-032 Inspect popout |
| SC-004 timeline node action dock | Superseded | QOL-031 Act popout |
| RULE-005 `ChannelChipRow` surface | Superseded — chip-row UI only; the channel model survives | QOL-031 Act popout (the flash-popout decision menu) |
| IX-001 density + focus lenses | Partially superseded | QOL-033 Go popout consumes the lenses; the **density core remains undefined** — see the `docs/designs/IX-001.md` stub |
| IX-002 mini-map | Superseded — surface only; the `timelineMiniMapModel` projection survives | QOL-033 Go popout |
| COMPOSER-001 composer prefill wiring | Superseded | QOL-030 one-box composer |
| COMPOSER-002 in-room composer dock | Superseded | QOL-030 one-box composer |
| ST-001 "Card Details" Stack mode | **Amended, not superseded** | QOL-030 decision D2 — Cards view becomes *authorable* through the one-box surface; ST-001's "inspection only" contract is widened, not removed |

### Roadmap conflict resolution

- **QOL-030** is the foundation — the one-box composer + the flash-popout
  chassis. Build it first.
- **QOL-031 / QOL-032 / QOL-033** are the popout-specific expansions (Act /
  Inspect / Go). Build them sequentially — each only after the previous is green.
- **QOL-034…042** are the storyboard-pass cards (renumbered from QOL-021…029
  after the collision fix — see the analysis doc). Independent of the one-box
  build order.
- **EV-003, IX-001, GAME-003B** are blank cards the storyboards depend on; each
  now has a design stub under `docs/designs/` and must be designed before
  confident implementation.
- The semantic-referee stack (MCP-011…016) stays **separate** from the
  deterministic flash menu — the Act popout is engine-gated, not AI-gated.

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

### Release 6.9 — Admin / email / test infra
Cards: QOL-015 (admin email delivery validation, #39), QOL-016 (Supabase Auth email + redirect audit, #40), plus QA / corpus-tester hardening (QOL-019 #43, QOL-020 #44).
**Definition of done:** The `request-argument-deletion` admin notification path is mock-validated; Supabase Auth email templates + redirect URLs are audited for the dev deployment; bot-tester prompts and the open-room engagement runner are tightened — all behind the operator approval gate, no live email sent by an agent. The project Release field still lists 6.5–6.8 only; 6.9 cards carry the `release:6.9` **label** until `6.9` is added to the field in the web UI (see `docs/github-projects-setup.md`).

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

### VG-004 — High-tech board visual polish without new dependencies
- **Priority:** P1 — **Effort:** M — **Release:** 6.6
- **Status:** Build complete. See `docs/designs/VG-004.md` + `docs/core/current-status.md` VG-004 entry.
- **Scope:** Six render-only refinements on `ArgumentTimelineMap`'s `NodeDot`: node-level active-path glow, selected-node halo, evidence "receipt" inner mark, branch-stub glyph refinement, tone tint on active-path nodes only, density-aware inter-node spacing (`resolveNodeGapPx`). New pure model `timelineNodeVisualModel.ts`. `GLOW` + `RECEIPT_MARK` token blocks added to `designTokens.ts` (reuse existing hex — no new color). No `react-native-svg`, no new dependency. Operator Q1 answered option (b): default board density loosened 28→44px (`{ compact: 28, normal: 44, expanded: 64 }`).
- **Acceptance:** Glow / halo are strength-independent (never read standing / heat / score). Tone tint reads tone/temperature only, active-path nodes only, alpha ≤ 0.18. Every state has a non-color signal + plain-English `accessibilityFragment` with no verdict / amplification copy. Reduce-motion drops the soft shadow, keeps the 2px stroke + halo + tint + receipt mark.
- **Tests:** density resolution · glow / halo / receipt / tone-tint derivation · doctrine strength-independence · `accessibilityFragment` ban-list · `buildBranchCollapseStubLabelParts` · token assertions · source-scan invariants · density-preserves-active-node.

---

## Epic 3 — Branches, Tangents, and Kinks

### BR-001 — Tangent kink model / argument tree layout foundation
- **Priority:** P0 — **Effort:** L — **Release:** 6.6 — **Wave:** 1 — **Agent:** timeline-ui-agent / roadmap-designer first
- **Status:** Build complete, awaiting Review. See `docs/designs/BR-001.md` + `docs/core/current-status.md` BR-001 entry.
- **Model:** Five-value `RailBranchKind` (`'main' | 'tangent' | 'kink_start' | 'kink_end' | 'detached'`) is preserved from VG-002's surface lock. Topology classifier in `src/features/arguments/branchTopologyModel.ts`: `deriveBranchKindFromConstitutionModel({ fromNode, toNode, isDetached, siblingIndex, isEvidenceThread, hasTangentLexicalCode })` + `buildBranchKindMap` (two-pass O(n)) + `buildEvidenceThreadMap` (≥ 50% non-root evidence-like + size ≥ 2). Collapse state: `BranchCollapseState = Readonly<Record<branchRootMessageId, 'collapsed' | 'expanded'>>`, `toggleBranchCollapse`, `applyActiveAutoExpand`, `buildCollapsedRailInputs` → `RailStubViewModel[]`. Stub component `BranchCollapseStub.tsx` (24×24 pill, anchored to branch root, `hitSlop` ≥ 14, plain-English a11y label, reuses VG-001 `BRAND.surface.appElevated` + `node.kindColor` — no new color token). `LIFE-001` cluster type + branchKind label set above remain Wave-1 future scope.
- **Scope additions (Timeline Tree Game Board):** Tree layout, not only kink graphics. Branch cluster click focuses a region (area-click selection). Collapsed branch stubs show count + branchKind icon + lifecycle summary chip. Active node inside collapsed branch auto-expands. Tree layout must remain deterministic across 250+ messages and testable.
- **Acceptance:** First child continues mainline when appropriate. Additional children branch up/down deterministically. Branches render visible kinks/stubs. Active path visible through branches. 250+ message stress fixture remains legible with IX-001 density hooks.
- **Tests:** sibling lane determinism · branch type classification · collapsed branch stub count · active path auto-expansion · missing parent / detached branch handling · 250+ message fixture.

### BR-002 — Split-screen branch inspector
- **Priority:** P2 — **Effort:** L/XL — **Release:** 6.6+
- **Scope:** Click branch label → branch inspector. Left: main timeline context. Right/bottom: branch timeline. "Return to mainline" CTA. No new route.

### BR-003 — Tangent / outer-orbit routing (structural redirect, no person labels)
- **Priority:** P1 — **Effort:** M — **Release:** 6.6-adjacent — **Agent:** roadmap-implementer. Issue #117.
- **Status:** Build complete, awaiting Review. See `docs/designs/BR-003.md` + `docs/core/current-status.md` BR-003 entry.
- **Model:** New pure-TS `src/features/arguments/tangentRoutingModel.ts` — `assessTangentRisk({ draft, parent, lifecycle, manualTags, tangentContext?, selectedChannel? })` returns `{ risk: 'none' | 'possible' | 'strong', reason, suggestedAction }` from typed structural fields only (argument type, RULE-005 channel, qualifier tag codes, parent META-001 auto-metadata, parent LIFE-001 axis, BR-001 `RailBranchKind`). Five `RedirectReason`s — `introduces_new_axis` / `no_signal_about_parent` / `mode_demands_response` / `repeated_off_path` / `user_marked_tangent` — each describes the move's relationship to its parent, never the person. `countRecentTangentMoves` is BR-003's own deterministic per-side off-path counter over BR-001 topology (`REPEATED_OFF_PATH_THRESHOLD = 3`). `buildMainlineDemotionAdvisory` is a reversible, person-free thread advisory. `suggestedActionToQuickAction` reuses the existing `branch` / `clarify` quick actions.
- **Integration:** plugs into RULE-004's merged `preSendReviewModel` — `AdvisoryKind` gains one member (`tangent_redirect`), `ADVISORY_DEFINITIONS` one entry, `PreSendReviewInput` one optional `tangentContext` field, `buildPreSendReview` one derivation step. `PreSendReviewSheet.tsx` is unchanged (its generic advisory loop renders the new kind). When `tangentContext` is omitted the review is byte-identical to merged RULE-004. De-dup: `tangent_redirect` is suppressed when it would only echo RULE-004's `asks_new_question` for the same tangent tag.
- **Acceptance:** advisory only — adds zero blocking rules; "Send to side branch" carries via RULE-005's existing `branch_tangent` channel + `branch_this_off` qualifier through the unchanged `submit-argument` path (BR-001 topology then classifies the edge as `kink_start`). Deterministic — no AI, no keyword-gate on body text, no heat/popularity input. No migration, no Edge Function, no operator deploy.

### BR-004 — Branch grammar: mainline, vertical chime-in, diagonal tangent
- **Priority:** P1 — **Effort:** L — **Release:** 6.6 — **Agent:** roadmap-implementer. Issue #143.
- **Status:** Build complete, awaiting Review. See `docs/designs/BR-004.md` + `docs/core/current-status.md` BR-004 entry.
- **Model:** New pure-TS `src/features/arguments/branchGrammarModel.ts` — `BranchDirection` (`mainline | chime_in_vertical | tangent_diagonal | evidence_passthrough`), a presentational grammar enum distinct from BR-001's locked `RailBranchKind` topology enum. `deriveBranchDirection(origin)` is a 5-rule ordered derivation reading only structural fields (topology classification, evidence-thread boolean, explicit qualifier codes, advisory routing inputs) — never heat / popularity / reply count / participant count / recency / strength bands. `buildBranchGrammarMap` (O(n), derives `participantCount` / `lastActivityAt` / `unresolvedAxisCount` / `primaryPartyEngaged` / `offshootDepthCapReached` from existing timeline-map data), `buildCollapsedBranchSummary` (the four-field collapsed-stub contract), `resolveBranchSelectionHandoff` (IX-004-shaped), `suggestedActionToBranchDirection` / `overrideLaneToBranchDirection` (the BR-003 + MCP-010 advisory bridges), `TANGENT_DEPTH_CAP = 3`. New `branchGrammarRenderContract.ts` — `buildBranchDirectionVisual` maps each direction to VG-001/VG-002's existing shape/position/stroke tokens; `evidence_passthrough` returns `inherit` for every token; no new VG token.
- **Integration:** minimal additive wiring in `ArgumentTimelineMap.tsx` (builds the grammar map + a `CollapsedBranchSummary` per collapse stub; new optional `principalActorLabels` prop) + `BranchCollapseStub.tsx` (new optional additive `summary` prop — falls back to BR-001's `+N` when absent). `BRANCH_GRAMMAR_COPY` block added to `gameCopy.ts`. Consumes BR-001 / BR-003 / IX-004 / RULE-005 / VG-001/VG-002 read-only; BR-001's `RailBranchKind`, the BR-003 routing model, IX-004's panel, and the rules engine are untouched. MCP-010's `SemanticOverrideLane` (design-only at build time) is mirrored locally — see the design-doc implementer note.
- **Acceptance:** a branch direction describes a move's STRUCTURAL position, never its truth / heat / popularity / author — a chime-in never auto-promotes to the mainline however active it becomes. The three directions are distinguishable without color (each carries a pairwise-unique position+shape+stroke triple). `evidence_passthrough` never restyles an evidence/source branch. Plain-language labels via `BRANCH_GRAMMAR_COPY`; ban-list clean. Deterministic — no AI / network. No migration, no Edge Function, no operator deploy.

---

## Epic 4 — Sidecars, Popovers, Quick Tools

### SC-001 — Consolidate controls into the side action rail

> ⚠ **Superseded — re-housed by QOL-031 (Act popout).** The role-gated action-set model survives; the rail React shell folds into the Act popout. Do not build as a standalone surface. See the Supersession map.
- **Priority:** P0 — **Effort:** M/L — **Release:** 6.5
- **Baseline:** `ArgumentSideActionRail` already exists (Stage 6.4) with observer / participant-other / own-bubble action sets.
- **Scope:** Rail always available in Timeline mode, collapsed by default. Expanding shows grouped tools: Watch/Observe · Join side · Reply · Evidence · Branch · Review/flag · Share. Tap updates active node + contextual rail. Long-press → mini popover when feasible.
- **Acceptance:** No side declaration before entering. Join only via explicit Join For / Join Against. No redirects. Own-bubble safety unchanged.

### SC-002 — Timeline node popover

> ⚠ **Superseded — re-housed by QOL-032 (Inspect popout).** The `sourceChainPopoverModel` pure model survives; the popover React shell folds into the Inspect popout. Do not build as a standalone surface. See the Supersession map.
- **Priority:** P0/P1 — **Effort:** M — **Release:** 6.5
- **Contents:** message preview · node status · strength band · tone/temperature · quick actions (Reply, Challenge, Source?, Quote?, Evidence, Concede, Branch) · "Open details" → sidecar.
- **Acceptance:** Tap node → active. Second tap / info icon → popover. Popover doesn't block timeline nav. Uses same action mapping as rail.

### SC-003 — Sidecar as detail inspector, not action dumping ground

> ⚠ **Superseded — re-housed by QOL-032 (Inspect popout).** `buildSidecarViewModel` survives; the sidecar surface folds into the Inspect popout. Do not build as a standalone surface. See the Supersession map.
- **Priority:** P1 — **Effort:** M — **Release:** 6.6 — **Wave:** 2
- **Sections:** "What this move says" · "Why it matters" · "What is unresolved" · "Where it sits" · "Suggested next move" · "Semantic flags" (deeper in Stack mode).
- **Acceptance:** Timeline sidecar concise. No body editing. No internal snake_case codes.
- **Boundary:** SC-003 is the **detail inspector**. The **action dock** is SC-004. SC-003 surfaces lifecycle state + unresolved axes + suggested next move; SC-004 owns the contextual move palette.

### SC-004 — Timeline node action dock

> ⚠ **Superseded — re-housed by QOL-031 (Act popout).** `timelineNodeActionDockModel` survives; the dock React shell folds into the Act popout. Do not build as a standalone surface. See the Supersession map.
- **Priority:** P0/P1 — **Effort:** M/L — **Release:** 6.6 — **Wave:** 2 — **Agent:** sidecar-tools-agent — **Status:** Build complete (awaiting Review).
- **Goal:** Compact action dock anchored on the Timeline / Tree surface for the selected node / cluster.
- **Required actions:** Reply · Challenge · Ask source · Ask quote · Clarify · Add evidence · Narrow · Concede · Confirm · Mark moved on · Mark ignored · Branch · Synthesize · Flag · Open Cards detail.
- **Acceptance:** Dock appears near selected node/cluster or as bottom rail on narrow screens. Own-message restrictions preserved (only `Open Cards detail · Mark synthesis-ready · Mark narrowed · Request deletion`). Observer matrix preserved. Actions create non-accusatory composer presets. Open Cards detail does not route away.
- **Tests:** observer action matrix · participant-other matrix · own-message matrix · node selection updates dock · no route transition · preset mapping · ban-list across produced strings.
- **Implementation:** `src/features/arguments/timelineNodeActionDockModel.ts` (new, pure-TS) · `TimelineNodeActionDock.tsx` (new, RN) · `quickActionPresets.ts` extended (`narrow / confirm / synthesize` + 3 preset bodies) · `ArgumentTimelineMap.tsx` + `ArgumentGameSurface.tsx` integration (5 new optional props, lifecycle + metadata + dock model build, selection state, mutual exclusion with SC-002 popover). Tests: `__tests__/timelineNodeActionDock{Model,Doctrine,ForbiddenImports,SelectionExclusion}.test.ts` (+129 tests). See `docs/designs/SC-004.md`.

### COMPOSER-001 — Wire SC-004 narrow/confirm/synthesize preset bodies into composer prefill

> ⚠ **Superseded — re-housed by QOL-030 (one-box composer).** The composer dock becomes the OneBox; preset prefill is the per-type schema. Do not build as a standalone surface. See the Supersession map.
- **Priority:** P2 — **Effort:** S — **Release:** 6.6 — **Wave:** 2 — **Agent:** roadmap-implementer — **Status:** Build complete (awaiting Review).
- **Goal:** Close the seam-wiring gap from the SC-004 review: the dock model returns the right `MoveDraftPatch` for `narrow` / `confirm` / `synthesize`, but `ArgumentGameSurface.handleActionDockAction` discarded it and the user landed in a blank composer.
- **Acceptance:** Dispatching `action=narrow` opens the composer with `argumentType='concession'` + `body=NARROW_PRESET_BODY` + `narrow_scope` tag. `confirm` opens with `body=CONFIRM_PRESET_BODY` (no forced argumentType). `synthesize` opens with `argumentType='synthesis'` + `body=SYNTHESIZE_PRESET_BODY`. EV-002 presets (`source` / `quote` / `weak_source`) still prefill correctly (regression). Non-preset actions (`reply` / `branch` / `flag` / `mark_moved_on` / `mark_ignored` / `open_cards_detail` / `expand_branch`) open the composer with `null` patch (no auto-fill).
- **Implementation:** `src/features/arguments/ArgumentGameSurface.tsx` — `onAction` prop gains optional `preset?: MoveDraftPatch | null` third argument; `handleActionDockAction` computes the patch via `actionDockToComposerPreset(action, target, parentType)` once and threads it through `handleAction(control, messageId, preset)`. `src/features/arguments/ArgumentTreeScreen.tsx` — `FullRoomGameSurfaceMount.handleAction` accepts an `explicitPreset` argument and prefers it over the EV-002 fallback. Composer surface zero-diff. No new dependency. No service-role. No migration. No Edge Function. No AI call. Tests: `__tests__/argumentGameSurfaceDockComposerWiring.test.ts` (+65 tests). Issue #84.

---

## Epic 5 — Stack Mode as Semantic Detail View

### ST-001 — Reposition Stack as "Card Details"

> ⚠ **Amended (not superseded) by QOL-030 decision D2.** Cards view becomes *authorable* through the one-box surface; ST-001's "inspection only / no body editing" contract is widened, not removed. See the Supersession map.
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
- **Priority:** P1 — **Effort:** L — **Release:** 6.6 — **Status:** Build complete (awaiting Review). Issue #16.
- **Debt kinds** (source-obligation set, deliberately NOT the point-standing `_needed` axis-debt vocabulary — see `docs/designs/EV-003.md` §4.1): `source` · `quote` · `receipt` · `context` · `primary_record`.
- **Statuses:** `requested` · `supplied` · `challenged` · `accepted_by_participant` · `accepted_by_both` · `unresolved` · `stale` · `branched`.
- **Display:** obligation chip on the timeline node (beside the EV-002 receipt chip — both axes at once) · per-room "Evidence requested" / "Source still owed" gallery card signals · open-debt count drives the `source_chain_fight` lane.
- **Implementation:** `src/features/evidence/evidenceDebtModel.ts` (render-time-derived — no migration, no `evidence_debt` table); `EvidenceDebtChip.tsx`; wired into `timelineNodePopoverModel` / `TimelineNodePopover` / `ArgumentGameSurface` / `conversationGalleryModel`; `__tests__/evidenceDebtModel.test.ts` + `EvidenceDebtChip.test.tsx` (+142 tests); `docs/evidence-object-model.md`.
- **Acceptance:** Per move, not global. Resolvable by later moves. Never declares the original point false (advisory — never enters the validator, emits no `PointStandingDelta`). Influences strength visuals, not truth labels.

### EV-004 — Evidence symmetry with game rules
- **Priority:** P1 — **Effort:** M — **Release:** 6.6
- **Mapping:** `source_chain` → trail chip + dotted edge · `evidence` → receipt chip + hex shape · `scope` → bracket icon · `definition` → key-term icon · `logic` → chain icon · `causal` → arrow icon · `anti_amplification` → crowd-slash icon · `synthesis_ready` → merge icon · `max_depth_reached` → stalemate band.
- **Acceptance:** Plain-language only. Raw validation codes never user-visible.

### EV-005 — Evidence-to-evidence interaction (annotations on evidence)
- **Priority:** P1 — **Effort:** L — **Release:** v1 — **Status:** Build complete (awaiting Review). Issue #120.
- **Object:** `EvidenceAnnotation { id, evidenceArtifactId, kind (one of 18 source/record-descriptive kinds), note?, addedByUserId, createdAt, depth: 0|1, parentAnnotationId? }`. `summariseAnnotations` derives an `EvidenceAnnotationStatusChip` (`anchored | conflict_open | context_open | paywalled | broken | unknown`) with deterministic priority `conflict_open > context_open > broken > paywalled > anchored > unknown`.
- **Surface:** the EV-002 `SourceChainPopover` renders the read-only annotation stream + status chip below "Inspect receipt"; an interactive "Add an annotation" picker (`AddAnnotationSheet`, a `Modal` bottom-sheet from RN primitives only, 18/3 eligibility-gated radio options + a ≤140-char note field) persists an add through the new `annotate-evidence` Edge Function. The annotation count reflects into the shared `ReceiptChip` contract → surfaces in Cards + Timeline with no new component.
- **Acceptance:** An annotation describes the source / record, never accuses a person — no verdict / winner / truth / person-attribution token in any of the 18 labels/helpers, the 6 status labels/helpers, the synthesis prompt, or the picker copy. An annotation never converts popularity into factual standing and has no path to a `PointStandingDelta`. An annotation never blocks an ordinary post; no AI authors one. Annotations on annotations are capped at one level — beyond that the picker is replaced by a "Summarise this evidence thread" synthesis prompt. No DB migration (V1 persists in the existing `client_validation` jsonb; the `evidence_annotations` table is V2). No service-role in client.
- **Implementation:** `src/features/evidence/evidenceModel.ts` (additive EV-005 section) + `EvidenceAnnotationChip.tsx` + `AddAnnotationSheet.tsx` + `evidenceAnnotationApi.ts`; `supabase/functions/annotate-evidence/index.ts` + `_shared/evidenceAnnotationEligibility.ts` + the `[functions.annotate-evidence]` `config.toml` block; EV-002 `SourceChainPopover` / `sourceChainPopoverModel` / `TimelineNodePopover` extended with additive optional props; 8 new test suites. `docs/edge-functions.md` documents `annotate-evidence`.

### QOL-036 — Payment / screenshot evidence metadata object
- **Priority:** P1 — **Effort:** M — **Release:** 6.7 — **Status:** Build complete (awaiting Review). Issue #205.
- **Object:** an **additive** `payment?: PaymentEvidenceMetadata` sub-object on the EV-001 `EvidenceArtifact`, present only when `kind === 'payment_screenshot'` (the seventh `EvidenceArtifactKind`). `PaymentEvidenceMetadata { confidence (pinned 'user_asserted'), platform?, paidAt?, amount? { value, currency }, payer?/payee? (redacted `PaymentParty`), noteText?, claimedApplicability? { statement, periodLabel?, obligationRef? }, hasScreenshotImage?, redactionConfirmed? }`. New types `EvidenceConfidence` / `EvidenceAmount` / `PaymentParty` / `ClaimedApplicability`; new helpers `detectRawAccountData` / `findRawAccountDataFields` / `redactPaymentParty` / `getPaymentEvidenceLabel` / `summarizePaymentEvidence`.
- **Acceptance:** A payment screenshot proves *at most that a payment object exists* — `confidence` pinned to `user_asserted`, no `verified`/`proven`/`valid` field, no `PointStandingDelta`. Existence ≠ applicability — separate `amount`/`paidAt`/`noteText`/`claimedApplicability` axes; QOL-036 stores only the *claimed* side (the dispute is QOL-037). No raw account / card / routing / IBAN data is required, accepted, or stored — the adapter strips a `payment` object that carries one and downgrades the kind to `screenshot_redacted`. Strictly additive — every existing `EvidenceArtifact` field + every existing consumer (EV-002 / EV-003 / EV-005 / `ReceiptChip` / timeline) compiles and behaves identically. Plain-language, ban-list-clean. **No migration, no Edge Function, no `submit-argument` change** (adapter-only, EV-001 path b).
- **Implementation:** `src/features/evidence/evidenceModel.ts` (additive QOL-036 section) + `index.ts` re-exports; `__tests__/paymentEvidenceMetadata.test.ts` (+98 tests; one existing `evidenceModel.test.ts` test updated six → seven kinds); `docs/evidence-object-model.md`. Consumed by QOL-037 (applicability dispute) and the QOL-030 `add_evidence` box.

### QOL-036.1 — Composition-layer integration for payment-evidence pill state
- **Priority:** P2 — **Effort:** M — **Release:** 6.7 — **Status:** Build complete (awaiting Review). Issue #270.
- **Object:** a new pure-TS deriver `derivePaymentEvidencePillState(input): PaymentEvidencePillState` that merges COMP-001 composition mutations with QOL-037 + EV-003 layer-1 derivations to compose the payment artifact's two existing chips (applicability + obligation). The four COMP-001 mutations map onto two orthogonal axes via the frozen `MUTATION_TO_PILL_STATE` table: `evidence_applicability_disputed` → `applicability_disputed`, `corroborating_document_attached` → `applicability_supported`, `evidence_debt_opened` → `requested`, `evidence_debt_resolved` → `supplied`. Conflict resolution via `PILL_STATE_CONFLICT_RULE`: within-axis last-wins by `sourceMoveId.createdAt`; cross-axis orthogonal stack; cross-layer last-wins with layer-1 ties (layer-1 = user action is more deliberate); when chronology is unknown, layer-1 wins as a safe default; a more-advanced layer-1 obligation lifecycle (`accepted_by_both`) is never regressed by a layer-2 mutation. Provenance enum `PaymentEvidencePillProvenance` (`layer1 | layer2 | layer1_with_layer2_corroboration | layer2_overrides_layer1`) for tests and a future Inspect read-view.
- **Acceptance:** Adds NO new chip, NO new enum value, NO new component, NO new verdict. Authors zero user-facing strings — `applicabilityChip` passes through `summarizeApplicabilityChip` (QOL-037); `debtChipStatus` is the EV-003 enum the existing renderer maps to its chip. Imports nothing from `pointStanding/` — a pill flip is a structural indicator, never a standing reward (anti-amplification preserved). Pill visibility = artifact visibility (existing RLS, no new gate). Observer-mode backward-compatible: empty mutation arrays → layer-1-only derivation, byte-identical to pre-QOL-036.1. The deriver is pure: no React, no Supabase, no network, no AI, no `Date.now()` / `new Date()`, no `console.log`. **No migration, no Edge Function, no `submit-argument` change** (consumer-only, pure-TS adapter). Caller uses `useSemanticReferee.getMutationsForMove(artifactArgumentId)` as the established COMP-001 accessor pattern; no hook surface change.
- **Implementation:** `src/features/evidence/paymentEvidencePillState.ts` (~530 lines, new); `src/features/evidence/index.ts` (re-exports); JSDoc-only annotations on the four COMP-001 rule branches in `src/features/semanticReferee/compositionLayer.ts` (R-EV-01, R-EV-02, R-EV-APP-01, R-CAT-Corroborating) pointing back to QOL-036.1 as the consumer — NO logic change; `__tests__/paymentEvidencePillState.test.ts` (+59 tests covering mapping table, conflict rule, four happy paths, layer-1-only regression, layer-1+layer-2 corroboration, within-axis last-wins, cross-layer conflict, cross-axis orthogonality, observer-mode, §8 edge cases 1–15, doctrine ban-list with word-boundary match, purity, determinism, backward-compat). Future consumer: the room render layer's wiring of `derivePaymentEvidencePillState` into `ArgumentGameSurface.tsx` is a separate small follow-up — QOL-036.1 ships the pure model only.

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

> ⚠ **Partially superseded by QOL-033 (Go popout).** The Go popout consumes the focus lenses; the **density core is (re)defined** by the design stub at `docs/designs/IX-001.md`. See the Supersession map.
- **Priority:** P0/P1 — **Effort:** L — **Release:** 6.6 — **Wave:** 2
- **Density modes:** Compact (dots, label on active) · Normal (shapes + short labels) · Expanded (shapes + badges + snippets).
- **Focus lenses (new):** Active path · Branch cluster · Unresolved only · Evidence / source only.
- **Area-click selection:** Clicking a branch lane / cluster focuses that cluster (drives SC-004 dock).
- **Acceptance:** 5-message timeline isn't sparse. 300-message remains navigable. Zoom persists per session. Density changes preserve active node. Focus lens hides only visually; data remains intact. No inaccessible tap targets (44px min). No new dependency.
- **Tests:** density model · focus filter model · active node preserved across density change · tap target minimums · accessibility labels.

### IX-002 — Timeline mini-map overview

> ⚠ **Superseded — re-housed by QOL-033 (Go popout).** The `timelineMiniMapModel` projection survives; the mini-map surface folds into the Go popout. Do not build as a standalone surface. See the Supersession map.
- **Priority:** P1 — **Effort:** M/L — **Release:** 6.6/6.7 — **Wave:** 3
- **Scope additions (Timeline Tree Game Board):** Mini-map summarizes branch clusters, unresolved points, exhausted points, active path. Clicking mini-map region pans / focuses the tree. Supports branch collapse / expand.
- **Acceptance:** Mini-map visually distinct from main map. No route transition. Works with 250+ messages.
- **Tests:** region summary · click-to-focus model · collapsed branch count · active path indicator.

### IX-003 — Keyboard and accessibility navigation
- **Priority:** P1 — **Effort:** M — **Release:** 6.7 — **Status:** Build complete. See `docs/designs/IX-003.md` + `docs/core/current-status.md` IX-003 entry.
- **Acceptance:** Arrow L/R moves active node. Home/End → root/latest on web. Accessibility roles + selected state. Nodes expose type, ordinal, strength, branch, active.
- **Tests:** traversal resolver (arrows / Home / End / cold-start / Enter-Space / Escape / unhandled / empty / single-node / detached / no-mutation) · `isTimelineNavKey` · `deriveBranchLabel` · `buildNodeAccessibilityLabel` per-band strength + verdict ban-list · source-scan wiring (web `onKeyDown` guard, `preventDefault`, Prev/Next disabled state, `tabIndex`, no new dependency, pure-model isolation).

---

## Epic 9 — Profile, Preferences, Avatar, Identity

### PR-001 — "My preferences" popout
- **Priority:** P1 — **Effort:** M — **Release:** 6.7
- **Fields:** display name · avatar preview · contact email · notification stub · default room entry preference · visual density · color accessibility · reduce motion · default side label preference.
- **Acceptance:** Popout/drawer. No role escalation. No hidden auth fields.
- **Status:** Complete — `src/features/preferences/` ships the nine-field core-`Modal` bottom-sheet (no router drawer, no new dependency), device-local AsyncStorage preference blob (`schemaVersion: 1`, no migration), the VG-004 density wire, and the reduce-motion override. Display name stays an account write; contact email is read-only with an honest "changes coming later" note (PR-004 owns the email-change flow); the notification toggle and the 3 colour-blind sim modes persist-but-inert with honest copy. +63 tests. See `docs/core/current-status.md`.

### PR-002 — Profile tag popout
- **Priority:** P2 — **Effort:** M — **Release:** 6.7
- **Allowed:** topic interests · debate style · availability · accessibility preference.
- **Disallowed:** protected-class targeting, party-affiliation requirement, "expert" without verification, hostile labels, ideology/personality scoring.
- **Acceptance:** Optional. Max 3–5 visible. No effect on truth/score. No effect on validation gates.
- **Status:** Complete — `src/features/profileTags/` ships a closed, curated 28-tag vocabulary across the four allowed categories (no free-text entry, no "custom/other" escape hatch — the closed list is the doctrine mechanism that makes the DISALLOWED list test-enforceable), a separate device-local AsyncStorage tag blob (`schemaVersion: 1`, no migration), and a `ProfileTagPopout` core-`Modal` reached from a new "Profile tags" row inside PR-001's preferences popout. `MAX_PROFILE_TAGS = 5` enforced on read, in the model, and in the UI; tags are optional (0 valid). v1 ships tags self-visible only; shared/other-user visibility is a noted v2 follow-up. The named validation-gate immutability test proves byte-identical engine/score/anti-amplification output with and without tags plus bidirectional import isolation; the named tag-vocabulary safety test exhaustively scans the vocabulary for forbidden tokens. +87 tests. See `docs/core/current-status.md`.

### PR-003 — Avatar upload policy and storage
- **Priority:** P1/P2 — **Effort:** L — **Release:** 6.7
- **Policy:** Bucket `profile-avatars` · Max 2 MB · jpg/png/webp · resize 256×256 + 64×64 thumb · public read opt-in else signed · no EXIF · strip metadata pre-upload · default generated avatar.
- **Acceptance:** Upload/change/remove flows. URL not user-editable raw. MIME + size validation. No service-role in client. Storage RLS prevents arbitrary overwrite.
- **Status:** Build complete — Profile epic opener. New `supabase/migrations/20260525000016_pr_003_profile_avatars.sql` creates public-read `profile-avatars` bucket (2 MiB cap, JPG/PNG/WebP allowlist), adds four columns to `public.profiles` (`avatar_path`, `avatar_thumb_path`, `avatar_updated_at`, `avatar_moderation_status` default 'allowed'), and narrows the profiles UPDATE policy to freeze the four avatar columns against client-JWT writes via a same-table OLD subselect. New `supabase/functions/upload-avatar/index.ts` Edge Function dispatches three actions (upload / remove / read_url_for_user); upload decodes via `imagescript@1.2.17`, resizes to 256x256 + 64x64, re-encodes as WebP (EXIF stripped by construction), writes via service-role. Storage path is server-derived from `auth.uid()`. JWT verify runs before action switch. `read_url_for_user` honours the `avatar_moderation_status='removed'` gate (returns null URLs → client silently falls back to `GeneratedAvatar`). New `src/features/account/avatarApi.ts` client wrapper; new `src/features/account/AvatarUploadSection.tsx` mounted inside `AccountScreen`'s existing card above the User ID row (Q1 pattern PR-004 mirrors with `contact-` prefix). Optimistic UI (Q6) + two-tap remove (no Modal dep). +250 tests / +5 suites. `expo-image-picker@~17.0.11` installed via `npx expo install`. **Operator:** `npx supabase db push --linked` + `npx supabase functions deploy upload-avatar --linked`. See `docs/core/current-status.md` § PR-003 Profile epic framing.

### PR-004 — Contact information update + avatar pivot to initials
- **Priority:** P2 — **Effort:** M (revised from L post-pivot) — **Release:** 6.7
- **Status:** Build complete — Profile epic closer. Two coordinated halves: (a) deprecate PR-003's avatar pipeline (operator pivot to initials-based identity glyph), (b) add the missing contact-info edit surface (display name + email via `supabase.auth.updateUser`).
- **Scope (landed):**
  - New SQL migration `supabase/migrations/20260525000017_pr_004_deprecate_avatar_pipeline.sql` drops the storage SELECT policy on `profile-avatars`, drops the four `profiles.avatar_*` columns, drops the narrowed UPDATE policy from migration 16, restores the byte-equal original UPDATE policy from migration 02. OPS-001 four-class header walks each class inline. NO `COMMENT ON POLICY ... ON storage.*` (per 2026-05-24 PR-003 known-blockers lesson). Bucket persists empty (storage_admin ownership boundary; dashboard-deletable).
  - `src/features/preferences/GeneratedAvatar.tsx` moved to `src/features/account/InitialsAvatar.tsx` with a back-compat re-export shim at the original path. New `InitialsAvatar` named export alias is the identity-facing import; the original `GeneratedAvatar` name is preserved so PR-001 testIDs + tests stay byte-identical.
  - New `src/features/account/contactApi.ts` (~165 lines) wraps `supabase.auth.updateUser({ email })` — the FIRST use of that SDK method in the codebase. Pure helpers (`validateEmail`, `messageForContactError`); short-circuits (same-as-current case-insensitive, invalid shape, no session); error mappings for `already registered` / `already in use` / `rate limit` / `failed to fetch`. Never writes to `public.profiles` (`auth.users.email` is the source of truth).
  - New `src/features/account/ContactInfoSection.tsx` (~430 lines) mounts inside `AccountScreen`'s existing card with three rows: InitialsAvatar header, display-name edit (replaces the prior inline edit machinery), email row with verification-pending state. OLD email stays visible until Supabase auth fires `onAuthStateChange` post-verify; explicit "Cancel pending change" affordance clears local UI only (the verification email has already been sent — Supabase trust boundary). Every Pressable: role + label + state + 44 px target. Inline errors: `accessibilityLiveRegion="polite"`. testID prefix `contact-*` on 13 elements (Q1 PR-003 pattern preserved with the new prefix).
  - DELETED: `src/features/account/avatarApi.ts`, `src/features/account/AvatarUploadSection.tsx`, `supabase/functions/upload-avatar/` (whole dir), 5 PR-003 test files (~1,930 lines of test source). `[functions.upload-avatar]` block removed from `supabase/config.toml`. `expo-image-picker@~17.0.11` removed from `package.json`. `AccountScreen.tsx` rewritten to delegate contact-info to ContactInfoSection; User ID / Role / ADMIN? rows remain. `accountApi.fetchOwnProfile` SELECT narrowed; `AvatarModerationStatus` type + 4 avatar fields removed from `UserProfile`.
- **PR-003 patterns:** Q1 (screen extension) PRESERVED with `contact-*` testID prefix; Q6 (optimistic UI) PRESERVED in the email-change row state machine; Q2/Q3/Q4/Q5 SUPERSEDED via migration 17 + file deletions.
- **Acceptance (verified):** Email update flow uses Supabase auth update (not `profiles` mutation). Verification-pending state surfaced as a local UI affordance with explicit cancel. User id stays masked-last-8 in AccountScreen. Display name remains a separate `profiles.display_name` write (allowlist preserved: `buildProfileUpdatePayload` writes only `display_name`). No role/id/email escalation surface. Net **-108 tests / +0 suites** (5 added + 5 removed; doctrine-compliant per test-discipline "unless a card explicitly removes tests with a documented reason" — the reason is the pivot, documented in design §0 and known-blockers).
- **Operator follow-up:** `npx supabase db push --linked` (apply migration 17) + `npx supabase functions delete upload-avatar --linked` (remove deployed Edge Function). Optional dashboard cleanup: delete the empty `profile-avatars` bucket via the Supabase dashboard. See `docs/core/current-status.md` § PR-004 entry and `docs/designs/PR-004.md`.

---

## Epic 10 — Hosting cdiscourse.com/dev

Master plan: [`docs/deployment/google-cloud-run-hosting-plan.md`](deployment/google-cloud-run-hosting-plan.md). Companion Vertex AI note (separate from app hosting): [`docs/deployment/claude-code-vertex-ai-note.md`](deployment/claude-code-vertex-ai-note.md).

### HOST-001 — Dev hosting architecture (Google Cloud Run) — Build complete
- **Status:** Build complete on `feat/HOST-001-dev-hosting-architecture-google-cloud-ru`, awaiting operator deploy.
- **Priority:** P0 — **Effort:** L — **Release:** 6.8
- **Target:** Google Cloud Run service `cdiscourse-dev` reachable at `https://dev.cdiscourse.com` (D3 locked). Cloud Run domain mapping maps a domain to `/`, **not** a path prefix — `cdiscourse.com/dev` is not pursued.
- **Scope (landed):** `Dockerfile` + `.dockerignore` at repo root · `scripts/build/build-web.{mjs,ps1,sh}` + `scripts/build/inject-runtime-env.{mjs,ps1,sh}` · `scripts/runtime/server.mjs` (Cloud Run entrypoint, vendors `serve@14.2.6` exact-pinned) · `infra/cloud-run/cdiscourse-dev.template.yaml` Cloud Run service template · `infra/iam/cdiscourse-dev-runner.iam.yaml` + `infra/iam/cdiscourse-deployer.iam.yaml` IAM templates · `src/lib/supabase.ts` patched to read `window.__CDISCOURSE_RUNTIME_ENV__` first then `process.env` (HOST-001b folded; #92 closes on merge) · `docs/deployment/host-001-operator-runbook.md` 23-step operator runbook · `__tests__/supabaseClientRuntimeEnv.test.ts` + `__tests__/dockerfileShape.test.ts` + `__tests__/hostOneBuildScripts.test.ts` (+84 tests total). `npm run web:build` + `npm run web:build:dry` scripts added.
- **Acceptance (verified by tests + design):** Cloud Run service template applies cleanly with the operator runbook (gated by `--no-allow-unauthenticated`, never world-readable in v0). Secret Manager bind shape locked (only `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — service-role / Anthropic / xAI / Bearer / Resend denylisted in Dockerfile, Cloud Run YAML, IAM YAMLs, scripts). Image baked-build-args carry build-time identity only; runtime config arrives at container start so digest-only promotion (HOST-008) is correct. Smoke H1 + H2 are operator-runnable from the runbook; H3 deferred (no `/healthz` route inside `serve`; HOST-003a will add it).
- **Operator follow-up before deploy:** Phase 1 (project + identity), Phase 2 (Artifact Registry), Phase 3 (HOST-005 secret create + bind), Phase 4 (image build + push), Phase 5 (deploy + smoke). No `gcloud` / `docker` command executed by the agent.

### HOST-002 — Dev environment banner ✅ shipped
- **Priority:** P0 — **Effort:** S/M — **Release:** 6.8
- **Scope:** "CDiscourse Dev" banner · commit hash/build version · "Test data may be reset" notice · "Report issue" link · bot/test rooms clearly labeled.

### HOST-003 — Deployment smoke checklist ✅ shipped
- **Priority:** P0 — **Effort:** S — **Release:** 6.8
- **Checks:** signup/login · gallery loads · duplicate-gen rooms collapsed · open room → Timeline · observer rail collapsed · explicit join · post a move · Timeline ↔ Cards · evidence popover · preferences popout · default avatar · no console 404s · no service-role · no raw validation codes.
- **Pending amendment** (proposed in hosting plan §12): add H1 (TLS healthy via `curl -I`) and H2 (Cloud Run revision matches expected SHA) for the Cloud Run path.

### HOST-004 — Google Cloud Run dev deploy scripts + Artifact Registry
- **Priority:** P0 — **Effort:** M — **Release:** 6.8
- **Scope:** `scripts/deploy/gcloud-preflight.*` (gcloud installed, project set, git clean, branch expected) · `scripts/deploy/deploy-cloud-run-dev.*` (build → push → `gcloud run deploy`, dry-run default, never echoes secrets) · `scripts/deploy/README.md`. No production deploy. Refuse to grant `roles/run.invoker` to `allUsers` without explicit `--allow-public` flag.

### HOST-005 — Secret Manager migration + Cloud Run binding
- **Priority:** P0 — **Effort:** S — **Release:** 6.8
- **Scope:** Operator-run secret creation + version-add commands (documented, never agent-run). `scripts/deploy/secrets-template.md` listing required secret names. Cloud Run binds Supabase URL + publishable key via `--set-secrets=`. Service-role / Anthropic / xAI keys do **not** appear in Cloud Run bindings — they stay in Supabase Function secrets.

### HOST-006 — DNS strategy for dev.cdiscourse.com
- **Priority:** P0 — **Effort:** S — **Release:** 6.8
- **Scope:** Documented decision (Option A keep GoDaddy as authority, Option B migrate to Cloud DNS). Operator-run GoDaddy DNS record set required by chosen Cloud Run mapping or HTTPS LB path. `docs/deployment/dns-runbook.md` with both options + rollback. No DNS records on apex / www.

### HOST-007 — Dev access control
- **Priority:** P0 — **Effort:** M — **Release:** 6.8
- **Scope:** Either Option A (`--no-allow-unauthenticated` + IAP + IAM `roles/run.invoker` grants per tester) or Option B (HTTPS LB + serverless NEG + Cloud Armor IP allowlist with operator-captured CIDR). Plan recommends A. Anonymous browser requests return 401 / 403; allowlisted requests return the app.

### HOST-008 — Production promotion pipeline (stub + design)
- **Priority:** P1 — **Effort:** L — **Release:** 6.8
- **Scope:** `scripts/deploy/promote-cloud-run-prod.*` stub that refuses without `--i-understand-this-is-production` flag. Design doc covering separate Supabase project for prod, separate service account `cdiscourse-prod-runner`, separate Secret Manager namespace (`cdiscourse-prod-*`), prod DNS cutover plan. **No production deploy in this card.**

---

## Epic 11 — Conversation Gallery and Project Board Entry

### GAL-001 — Upgrade gallery sections into play lanes ✅ (Wave 4)
- **Priority:** P1 — **Effort:** M — **Release:** 6.6 — **Status:** Implemented
- **Sections (rendered order):** My active rooms · Needs first rebuttal · Jump in now · Source trail fights · Evidence needed · Definition fights · Logic traps · Tangents and branches · Almost synthesis · Quiet beginner rooms.
- **Acceptance met:** Deterministic 14-row priority chain in `classifyCardToSection` (joined > no-rebuttal > 4 lifecycle priorities > 5 bucket priorities > overheated-heat fallback > SW-002 entryOpportunity tie-breakers > quiet_beginner_rooms fallback). Single-select lane chip row replaces the Stage 6.3 bucket chip row. Duplicate generated rooms remain collapsed via the existing dedupe model. Heat framed as activity / friction (`jump_in` helper: "Active back-and-forth — a fresh move lands cleanly.").
- **Behaviour change:** Stage 6.4's `hot_unresolved` lane is retired; cards split between `jump_in` (hot_now / overheated) and `logic_traps` (unresolved_deep_chain). `easy_first_move` renamed to `quiet_beginner_rooms`. See `docs/core/current-status.md` § GAL-001.

### GAL-002 — Entry cards with first suggested move
- **Priority:** P1 — **Effort:** M — **Release:** 6.6 — **Wave:** 4
- **Examples:** "Be the first rebuttal" · "Ask for the source" · "Challenge the mechanism" · "Narrow the claim" · "Offer synthesis" · "Watch first" · "Join when ready."
- **Acceptance:** Hint from model fields, not AI call. Maps to quick action in rail. Short plain-language. No internal codes.
- **Scope addition (Timeline Tree Game Board):** Once LIFE-001 lands, hint source moves to the *root cluster lifecycle state* of the room rather than the current heat / bucket heuristic. Stale-derivation guard: hint recomputes every load.

---

## Epic 12 — Evidence-Enhanced Game Rules and Flow

> **Acknowledgment note (2026-05-31):** Shipped MCP family + ARCH work — Family D/E/F/G server cards, MCP-021C edge-enable cards (B/C, D, E, F, G), the audit-lint L5 doctrine-risk rules for those families, ARCH-001 Cards 1 / 2A / 2 / 3 — is documented in commit history + the per-card audit docs (`docs/audits/`) + the rolling `docs/core/current-status.md` entries. **Retroactive issue backfill is OUT OF SCOPE** for this restoration card. The entries below cover the queued forward-looking work; future cards should land with issues at issue time.

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
- **META-1A follow-up (Release 6.8, complete):** the manual-tag ledger is now **persisted** — new `public.point_tags` table + RLS, the `apply-manual-tag` Edge Function as the single write path, a client wrapper, and a room-shell loader extension that hydrates persisted tags on every refresh. Auto-derived metadata stays render-time-derived per META-001. Write-trigger UI is a thin follow-up; the read path is live. See `docs/designs/META-1A.md`.
- **META-1B follow-up (Release 6.8, complete):** persisted tags now **propagate live** — a Supabase Realtime postgres-changes subscription on `point_tags` scoped to the open debate. Other participants' tag changes appear within ~1 s without a refresh and without polling. Implementation establishes the realtime-channel pattern the repo will reuse (META-1B is the first card to introduce one): topic `point_tags:debate:${debateId}`, JWT-only auth via the shared client (no service-role), exponential backoff capped 30 s / max 6 attempts, scoped reconcile-on-SUBSCRIBED via `fetchPointTagsForArguments`, echo suppression by row id (apply) + by predicate (remove), full teardown on unmount / debateId change. Silent visual merge through the META-001 read path + `AccessibilityInfo.announceForAccessibility` move-anchored copy (no tagger identity, no verdict). RLS-natural QOL-039 visibility (private-room broadcasts reach only authorized subscribers via the existing `pt_select_read_access` policy). **No migration, no Edge Function change, no schema change.** The only operator post-deploy check is verifying `point_tags` is in the `supabase_realtime` publication (default Supabase setup includes `FOR ALL TABLES`; almost certainly no action needed). See `docs/designs/META-1B.md`.
- **META-1C follow-up (Release 6.8, complete):** the admin investigation surface for the persisted ledger — a new admin **Metadata Events** tab that lists `point_tags` manual-tag *events* (each tag applied, each tag removed) chronologically for a selected debate, with tag-code / actor-role / applied-vs-removed filter chips and a sortable Created column. Pure client-side direct admin-RLS read (mirrors `AdminArgumentsTab`) — **no Edge Function, no migration, no operator deploy step**. The actor-role column shows the actor's **current** role, honestly labeled (never a fabricated apply-time role). Auditing auto-metadata / lifecycle-causation is out of scope — those events were never persisted. See `docs/designs/META-1C.md`.

### GAME-001 — Point exhaustion and timeout rules
- **Priority:** P1 — **Effort:** M/L — **Release:** 6.6 — **Wave:** 3 — **Agent:** evidence-rules-agent / point-standing-economy
- **Goal:** Non-blocking advisories for stale / ignored / exhausted / synthesis-ready clusters. Pure model.
- **Acceptance:** Repeated same-axis pressure produces `exhausted` advisory. One-party nonresponse produces `ignored_by_<side>` advisory. Both-party dormancy produces `ignored_by_both` advisory. Concession + narrowing + no unresolved debt produces `synthesis_ready`. **No blocking output**. **No truth verdict**. **No "winner / loser"**. **No automated punishment**.
- **Tests:** no blocking output · repeated-axis exhaustion · one-party ignored · two-party ignored · synthesis-ready · copy ban-list.

### GAME-005 — Public room participant seats and chime-in governance
- **Priority:** P1 — **Effort:** L — **Release:** 6.7 — **Agent:** roadmap-implementer. Issue #142.
- **Status:** Build complete, awaiting Review. See `docs/designs/GAME-005.md` + `docs/core/current-status.md` GAME-005 entry.
- **Model:** New pure-TS `src/features/debates/publicSeatModel.ts` (beside GAME-004's `roomContractModel.ts`) — extends GAME-004's 1v1 `RoomContract`. `SeatRole` (`initiator | primary_opponent | chime_in` — `chime_in` is a DERIVED read-time role only, never written to `debate_participants.side`), `PublicSeat`, `PublicRoomSeatMap`, `MovedToObserverRecord`, `GovernanceReaction`, `GovernanceReactionKind` (`useful · off_track · needs_source · move_to_tangent`), `PUBLIC_ROOM_SEAT_CAP = 6` **[reconciled 6→5 by ARG-ROOM-001 — roadmap §4.1 operator decision 2; the live constant is now 5, public chime-in capacity 3]**, `CHIME_IN_GOVERNANCE_WINDOW_MS = 24h`. `buildPublicRoomSeatMap` derives the 6-seat layout at read-time (seats 1-2 from the GAME-004 contract; chime-ins fill 3-6 in first-qualifying-move claim order via the reused GAME-004 `isQualifyingResponse`; 7th+ → overflow observer, no failure state). `evaluateChimeInStanding` returns `observer_only` only when two DISTINCT primaries apply a non-retracted `off_track` reaction within one window span — fully reversible via retraction; `useful`/`needs_source`/`move_to_tangent` never demote. `canApplyGovernanceReaction` is the actor matrix (only the two primaries govern; governance pauses when a primary seat is open). `buildPublicRoomMetricsViewModel` / `buildGovernanceControlViewModel` for the UI.
- **Integration:** thin read-time React layer — `ChimeInGovernanceControl.tsx` (the four structural reactions, OP + Primary Opponent only; ≥44px hit targets; applied state shape+text not color), `PublicRoomMetricsStrip.tsx` (informational non-correctness metrics; branch states from BR-004 `CollapsedBranchSummary`), `useChimeInGovernance.ts` (in-session reaction state, no I/O). `CHIME_IN_GOVERNANCE_COPY` block added to `gameCopy.ts`. Consumes GAME-004's `RoomContract` + `isQualifyingResponse` and BR-004's `CollapsedBranchSummary` / `buildCollapsedBranchSummary` read-only — GAME-004, BR-004, and IX-004 are untouched. Room-shell mount wiring (metrics strip + governance control) is a small additive follow-up step.
- **Acceptance:** a seat describes a structural game ROLE, never the person; a governance reaction describes participation STRUCTURE, never correctness — the four kinds are not votes; losing a seat (observer-fallback) is a structural transition, never a penalty — a moved-to-observer user keeps full read access and their branch stays on the record (collapsed into "Side branches" via BR-004). Heat / popularity / reply count / standing are never inputs — seat order is first-qualifying-move chronology only; `publicSeatModel.ts` imports nothing from any score / heat module. Plain-language labels via `CHIME_IN_GOVERNANCE_COPY`; ban-list clean. Deterministic — no AI / network. No migration, no Edge Function, no schema write, no operator deploy.

### GAME-006 — Jump Branch: once-per-room cross-branch participation
- **Priority:** P2 — **Effort:** M — **Release:** 6.7 — **Agent:** roadmap-implementer. Issue #144.
- **Status:** Build complete, awaiting Review. See `docs/designs/GAME-006.md` + `docs/core/current-status.md` GAME-006 entry.
- **Model:** New pure-TS `src/features/debates/jumpBranchModel.ts` (beside GAME-005's `publicSeatModel.ts`) — extends GAME-005's public-room seat layer; consumes GAME-004's `RoomContract` / `isQualifyingResponse` and BR-004's `BranchDirection` / `BranchGrammarNode` as types. `JumpBranchRecord` (`participantUserId / fromBranchId / toBranchId / at / viaArgumentId`), `JumpDenyReason` (7 values), `JumpEligibility`, `BranchEngagementState`, `JumpControlViewModel`, `JumpMarkerViewModel`, `MAX_JUMPS_PER_ROOM = 1`. DERIVE-NOT-PERSIST: a jump IS a move whose branch placement differs from the participant's home branch — `listJumpsForParticipant` / `jumpsUsed` recompute from existing `arguments` rows on every room load; no `jump_branch_records` table, no migration. `canJump(participant, room, destination)` is a deterministic 7-reason predicate (fixed precedence, no clock) reading only seat role, used-jump count, and destination structural state. `buildBranchEngagementMap` / `buildJumpControlViewModel` / `buildJumpMarkers` for the UI.
- **Integration:** thin read-time React layer — `JumpBranchControl.tsx` (the confirm-required two-step Jump action; a disabled state always carries a visible plain-language reason — no silent no-op; ≥44px hit targets; enabled/disabled distinction shape+text not color) and `JumpBranchMarker.tsx` (the old-branch "departed" + destination "arrival" structural markers; non-interactive). `JUMP_BRANCH_COPY` block added to `gameCopy.ts`. A jump commits via the EXISTING `submit-argument` path — no new write path. GAME-004, GAME-005, BR-004, and IX-004 are untouched. Room-shell mount wiring (Jump control + markers) is a small additive follow-up step.
- **Acceptance:** a Jump describes structural MOVEMENT, never a verdict, never a quality/truth signal, never the person. The Jump action is deliberate and confirm-required — never accidental. `canJump` reads no heat / popularity / reply count / standing; `jumpBranchModel.ts` imports nothing from any score / heat module. The old branch is never deleted or hidden — the departed marker is additive. A jump never changes which seat a participant holds. Plain-language labels via `JUMP_BRANCH_COPY`; ban-list clean; `looksLikeInternalCode` false for every visible string. Deterministic — no AI / network. No migration, no Edge Function, no schema write, no operator deploy.

### GAME-008 — Bot public-room policy and public argument seeding
- **Priority:** P2 — **Effort:** M — **Release:** 6.7 — **Agent:** roadmap-implementer. Issue #147.
- **Status:** Build complete, awaiting Review. See `docs/designs/GAME-008.md` + `docs/core/current-status.md` GAME-008 entry.
- **Model:** New pure-TS `src/features/debates/botRoomPolicyModel.ts` (beside GAME-005's `publicSeatModel.ts`) — the product-level policy for bots in public argument rooms; consumes GAME-004's `RoomType` / `RoomArgumentInput` as types. `BOT_ROOM_POLICY` is a single frozen app-wide constant (`botsMayCreate 'public_only'`, `botMarkingRequired`, `botMayBePrimaryOpponentOfRealUser false`, `botMayJoinPrivateRoomWithRealUser false`, `botsYieldSeatsToRealUsers true`). `isBotSeededRoom` is a PURE PREDICATE over already-derived per-argument `isBot` hints (the GAME-004 `RoomArgumentInput.isBot` seam, lifted to a per-user `BotParticipantHint`) — absent hint => fail-safe-human; NOT a DB query (there is no `profiles.is_bot` column; a first-class flag is a deferred future migration card). `looksLikeBotSeedTag` reuses the gallery model `SUFFIX_TAG_PATTERNS` family — a no-migration, no-query hint source. `assertBotRoomEligibility` is a policy GATE (predicate, never a trigger) with four deny reasons (`bots_create_public_only · bot_primary_against_real_user · bot_in_private_room_with_real_user · bot_chime_in_not_permitted`). `buildBotMarkingViewModel` builds the read-time `BotMarkingViewModel` bot-marking view contract. The module exports NO posting / scheduling / harvest function — proven by an API-surface test.
- **Integration:** thin read-time React layer — `BotParticipantMarker.tsx` (the individual "Test bot" marker on a bot participant in-room; renders nothing for a non-bot) and `BotRoomMarker.tsx` (the non-alarming room-level "Test room" / "Bot-seeded test room" affordance for the gallery card + room header). Both non-interactive (no `Pressable`), color-independent (dashed border + glyph + literal text), each marker root carries a verbose `accessibilityLabel`. `BOT_MARKER_COPY` block added to `gameCopy.ts`. `ConversationGalleryScreen.tsx` mounts `<BotRoomMarker context="gallery">` additively on a bot-seeded card via `looksLikeBotSeedTag` (the documented no-query degraded fallback). GAME-004, GAME-005, and BR-004 are untouched (consumed as types). The per-participant in-room marker mount is a small additive follow-up step.
- **Acceptance:** a bot marker describes the ACCOUNT TYPE ("Test bot"), never a verdict — bots never decide who is right. Bots → public rooms only; never a private 1v1 with a real user; never misrepresented as the human Primary Opponent. The marker copy is neutral, non-alarming, non-deceptive — never a "this is a human" framing. `assertBotRoomEligibility` is a GATE, never a TRIGGER — GAME-008 enables zero live bot posting (no corpus run, no harvest, no scheduler, no AI/xAI/Anthropic call). `botRoomPolicyModel.ts` imports nothing from any score / standing / heat module. Plain-language labels via `BOT_MARKER_COPY`; ban-list clean; `looksLikeInternalCode` false for every visible string. Deterministic — no AI / network. No migration, no Edge Function, no schema change, no `profiles.is_bot` column, no operator deploy.

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

### RULE-005 — Structured argument channels (move-type field model)

> ⚠ **Chip-row surface superseded — re-housed by QOL-031 (Act popout).** The `channelModel` pure model survives unchanged; only the `ChannelChipRow` UI folds into the flash-popout decision menu. See the Supersession map.
- **Priority:** P0 — **Effort:** L — **Release:** 6.6 — **Status:** Complete. Issue #115.
- **Goal:** A thin plain-language "channel" layer above the 8 Constitution argument types — a small vocabulary (`reply · challenge · clarify · ask_source · ask_quote · add_evidence · narrow · concede · confirm · synthesize · branch_tangent · meta_process`, plus 2 reserved for EV-005 / GAME-003) describing the *structural purpose* of a composed move so the composer can deterministically suggest the fitting channel and optionally reveal helper fields.
- **Delivered:** pure-TS `src/features/arguments/channelModel.ts` (`MoveChannel` enum, `CHANNEL_DEFINITIONS`, deterministic 6-rule `suggestChannelFromDraft`, `channelToDraftPatch`, render-time `deriveChannelForPostedMove`) + `ChannelChipRow` selector + collapsed `ChannelHelperFields`, wired into the COMPOSER-002 dock. A channel suggestion is advisory — it never blocks a post, never reads heat / popularity, never makes an AI call (RULE-006 owns AI channel detection). The channel is a draft-time advisory field — it does NOT persist in v1; a posted move's channel is re-derived at render time. No migration, no Edge Function. See `docs/designs/RULE-005.md`.
- **Acceptance:** every channel has a definition with plain-language purpose + optional fields + suggested followups · the suggestion is deterministic and never blocks · no verdict / amplification / snake_case in any produced string · the chip row meets the accessibility bar (radio role, 44×44, color-independent suggested affordance).
- **Tests:** the model vocabulary + definitions · the 6-rule derivation table + forward/reverse parity · advisory-not-block + heat-independence guarantee · ban-list across produced strings · chip-row / helper-field pure helpers. +123 tests / +5 suites.

### RULE-004 — Pause-before-send move review (advisory friction with payoff)
- **Priority:** P1 — **Effort:** M — **Release:** 6.6 — **Status:** Complete. Issue #114.
- **Goal:** One short, non-judgemental review chance on the Post intent — surface a small list of advisories (a wide claim, topic drift, a new question, an Evidence move with no source, a deep reply, the permanent-record reminder, a channel mismatch) and always hand back a useful next move (narrow, branch, add a source, save a draft).
- **Delivered:** pure-TS `src/features/arguments/preSendReviewModel.ts` (`buildPreSendReview`, 7 `AdvisoryKind`s, `ADVISORY_DEFINITIONS`, `projectBlockKind`, `transformationToQuickAction`) + a thin `PreSendReviewSheet.tsx` overlay shown by the COMPOSER-002 dock on the Post intent. Advisories are `info` / `soft` only — they never block a post; "Post anyway" is always available unless an EXISTING `evaluateArgumentDraft` structural block is hit (RULE-004 adds zero new blocking rules — `structuralBlocks[]` is a read-only projection of the engine's `blockingErrors`). Deterministic — no AI / network; the body is read for length / `?`-shape only, never keyword-gated. `channel_mismatch` absorbs RULE-005's channel-mismatch via the shared `ChannelSuggestion` (no change to `channelModel.ts` / `ChannelChipRow.tsx`). No migration, no Edge Function, no persistence, no new dependency. See `docs/designs/RULE-004.md`.
- **Acceptance:** the pre-send review never blocks a post (advisory only) · the sheet hides "Post anyway" only when the engine genuinely blocks · no new blocking rule, no AI call, no keyword-gate on body text · no verdict / amplification / snake_case in any produced string · the sheet meets the accessibility bar (button roles, 44×44, color-independent section markers, reduce-motion snap).
- **Tests:** the per-rule derivation table for all 8 rules · the structuralBlocks projection · the deterministic-no-AI + no-keyword-block + heat-independence guarantees · the RULE-005 channel_mismatch reconciliation · the advisory-never-blocks guarantee · accessibility + a doctrine ban-list scan. +84 tests / +4 suites.

### MCP-011 — Mock semantic-referee packet validator and fixture provider
- **Priority:** P1 — **Effort:** M — **Release:** 6.8 — **Agent:** roadmap-implementer. Issue #178.
- **Status:** Build complete, awaiting Review. See `docs/designs/MCP-011.md` + `docs/semantic-referee/mcp-011-fixture-contract.md` + `docs/core/current-status.md` MCP-011 entry.
- **Goal:** The first safe, no-live-call layer of the MCP semantic-referee stack — the pure-TypeScript foundation MCP-012 … MCP-016 build on. Establishes `src/features/semanticReferee/` with the canonical Node-side packet contract, a strict packet validator that rejects every malformed / off-contract / unsafe provider output, a deterministic mock fixture provider + adversarial malformed-fixture set, and an order-normalized cache-key helper.
- **Delivered:** 5 new pure-TS files in `src/features/semanticReferee/` — `semanticRefereeTypes.ts` (the `SemanticRefereePacket` / `SemanticBinarySample` contract from MCP-001 §7, 23-id catalog v0, `SemanticRejectionCode` vocabulary), `semanticRefereeValidator.ts` (`parseSemanticPacket` — a `zod@4` `strictObject` schema + a pure-TS content-safety scanner; `isCreditEligible` / `creditEligibleBinaries` / `looksLikeInternalCode`), `semanticRefereeFixtures.ts` (18 fixture groups + the deterministic `mockFixtureProvider`, a TEST/DEV source never wired to a screen), `semanticRefereeCacheKey.ts` (the MCP-004 five-tuple superset key + FNV-1a hash, no `crypto`), `index.ts`. Plus `docs/semantic-referee/mcp-011-fixture-contract.md`. Modifies no existing file. No provider call, no network, no Edge Function, no env read, no UI, no new dependency (`zod@4` already present), no migration. See `docs/designs/MCP-011.md`.
- **Acceptance:** the validator accepts all valid fixtures and rejects every malformed fixture with the correct `SemanticRejectionCode` (non-JSON, top-level array, `authoritative: true`, unknown classifier / route / friction / confidence, non-`0/1` value, out-of-range score hint, unknown reason code, verdict token, person label, secret / JWT / Bearer / handle / URL / email / post-id shape, chain-of-thought / raw-prompt / smuggled-copy field, `block` field, duplicate classifier id) · `authoritative` is pinned to the literal `false` · a rejected packet is never partially used and rejection `detail` never echoes the offending raw value · low-confidence packets validate but yield zero credit-eligible binaries · the cache key is order-normalized, total, and stable, and changes when `promptVersion` changes · no file imports a provider SDK / `fetch` / Supabase / React / `Deno` / `process.env`.
- **Tests:** the validator accept/reject coverage · fixture integrity + mock-provider determinism · cache-key normalization + invalidation · the no-live-AI source scan. +146 tests / +4 suites.

### MCP-012 — Semantic call router implementation (mock-only)
- **Priority:** P1 — **Effort:** M — **Release:** 6.8 — **Agent:** roadmap-implementer. Issue #179.
- **Status:** Build complete, awaiting Review. See `docs/designs/MCP-012.md` + `docs/core/current-status.md` MCP-012 entry.
- **Goal:** The pure-TypeScript semantic call router — a deterministic translator from a UI / game event into the decision "should a semantic-referee classifier call be made, and of what?", and never "should this post be allowed?". Realizes MCP-004's design (trigger gates, batching ≤5/call, in-memory LRU cache store, token budget, retry policy) and consumes — not re-creates — MCP-011's frozen contract.
- **Delivered:** 5 new pure-TS files in `src/features/semanticReferee/` — `triggerGates.ts` (`evaluateTrigger`, six trigger moments, the exhaustive eight-event forbidden enum, `TriggerReasonCode`, `SYNTHESIS_TRIGGER_MIN_EVENTS = 6`), `classifierBatching.ts` (`planClassifierBatches`, `BATCH_CAP = 5`, the five A-E `SEMANTIC_BATCH_GROUPS` partitioning MCP-011's 23-id catalog), `semanticCache.ts` (`SemanticPacketCache` — in-memory LRU keyed by MCP-011's `serializeSemanticCacheKey`, never re-derived; `DEFAULT_CACHE_CAPACITY = 256`), `tokenBudget.ts` (`estimatePacketTokens` / `isWithinBudget`, `SEMANTIC_PACKET_TOKEN_BUDGET = 1500`), `retryPolicy.ts` (`SEMANTIC_RETRY_POLICY`, `shouldRetry`, the retryable/terminal `SemanticErrorClass` partition). One modified file — `index.ts` (append-only). No provider call, no network, no Edge Function, no env read, no UI, no new dependency, no migration. See `docs/designs/MCP-012.md`.
- **Acceptance:** forbidden events (keystroke / hover / timeline-selection / observer-browsing / scroll / focus / blur / gallery-browsing) produce zero provider calls — proven by the `semanticNoCallOnDraftEdit` spy · `planClassifierBatches` never emits a batch larger than 5 and classifier ids are order-normalized · the cache key reuses MCP-011's `serializeSemanticCacheKey` · no network import, no Supabase import, no `.env` read.
- **Tests:** the allowed-vs-forbidden trigger table + totality · the batch-cap + catalog-partition + order-normalization · the LRU cache get/set/has/delete/eviction/recency + no-TTL · the no-call spy proof · token-budget over-estimation + inclusive ceiling · retry-policy descriptor + transient/terminal partition · the doctrine ban-list scan · the forbidden-import source scan. +158 tests / +8 suites.

### MCP-016 — Edge Function mock boundary scaffold
- **Priority:** P2 — **Effort:** M — **Release:** 6.8 — **Agent:** roadmap-implementer. Issue #183.
- **Status:** Build complete, awaiting Review. See `docs/designs/MCP-016.md` + `docs/core/current-status.md` MCP-016 entry.
- **Goal:** Implement MCP-009's server-side `semantic-referee` Edge Function boundary **in mock mode only** — the structural seam between the deterministic stack and a (future) AI provider, JWT-protected, schema-validated, and fully tested, with no live AI in the loop. Built third in the MCP slate (after the pure-TS foundation MCP-011 and consumers MCP-012/013) so its outbound schema can be proven equivalent to MCP-011's Node-side contract by a parity test.
- **Delivered:** 1 new Edge Function (`supabase/functions/semantic-referee/index.ts`) + 8 new `supabase/functions/_shared/semanticReferee/` modules (`types.ts` Deno mirror of MCP-011's contract, `schema.ts` `npm:zod@4` inbound + outbound validators, `redaction.ts` defensive pass, `mockProvider.ts` deterministic classifier + fallback, `fixtureProvider.ts` + `fixtures.ts`, `providerRouting.ts` pure zod-free routing core, `providers.ts` Deno registry wrapper) + the `classifyMove` client wrapper appended to `src/lib/edgeFunctions.ts` + the additive `[functions.semantic-referee]` `verify_jwt = true` block in `supabase/config.toml`. The default and only-wired providers are `mock` (default) + `fixture`; the `anthropic` / `mcp` registry slots are stubbed `{ enabled: false, reason: 'not_implemented' }` with no module behind them. No live provider call, no provider key read, no service-role, no `public.arguments` insert, no migration, no dependency install, no `.env` change. See `docs/designs/MCP-016.md`.
- **Acceptance:** disabled-by-default — `SEMANTIC_REFEREE_ENABLED` unset → `{ enabled: false }`, HTTP 200, no provider selected, no key read · the provider registry defaults to `mock`; `anthropic` / `mcp` slots are stubbed off · no provider key required, no live call, no service-role, no `public.arguments` insert · the outbound packet schema pins `authoritative` to `z.literal(false)` and is `.strict()` — a widened packet falls back to a deterministic minimal packet · the Node ↔ Deno parity test passes.
- **Tests:** disabled-by-default + provider-spy · provider-registry mock-default routing · inbound request schema + outbound packet schema (re-declared + Deno source-parity) · deterministic mock provider · fixture provider hit/miss · boundary fallback · Edge Function auth / invalid-input / RLS source-shape · doctrine ban-list scan · no-live-call source scan · forbidden-secrets source scan · Node↔Deno parity · the `classifyMove` wrapper. +210 tests / +14 suites.
- **Operator follow-up (separate, out of scope for this card):** `npx supabase functions deploy semantic-referee --linked`; optionally `npx supabase secrets set SEMANTIC_REFEREE_ENABLED=true SEMANTIC_REFEREE_PROVIDER=mock`. The live-provider pilot is a separate, explicitly operator-approved card.

### MCP-SERVER-009-FAMILY-H — `claim_clarity` server-side admin_validation ship
- **Priority:** P1 — **Effort:** M — **Release:** 6.8 — **Wave:** 2 — **Agent:** roadmap-designer → roadmap-implementer → roadmap-reviewer. Issue #389 (filed by OPS-WORKFLOW-RESTORATION Phase 4).
- **Status:** Authorized, not started. See `docs/designs/MCP-SERVER-009-FAMILY-H-intent.md`.
- **Goal:** Server-side ship of Family H (`claim_clarity`, 12 keys uniform `ai_classifier`) on the hosted MCP server with admin_validation-only Edge posture. Card 1 of the H 3-card chain.
- **Acceptance:** 5 `familyH*.ts` files mirror Family G structure; doctrine-risk = YES with 4 HIGH-risk per-key `falsePositiveGuards`; `FAMILY_H_BAN_PATTERNS` Family-H-LOCAL; smoke template carries `Audit-Lint: v1`; A–G byte-equal; HALT 3 PASS (uniform ai_classifier confirmed); operator post-merge smoke PASS unblocks Card 2.
- **Tests:** +110 to +160 net Deno + ~8 Jest (HALT 8 ceiling +250).

### OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK — L5 mechanization for `family_h`
- **Priority:** P1 — **Effort:** S — **Release:** 6.8 — **Wave:** 2 — **Agent:** roadmap-designer → roadmap-implementer → roadmap-reviewer. Issue #390.
- **Status:** Authorized, not started; CONDITIONAL on Card 1 (MCP-SERVER-009-FAMILY-H) smoke PASS. See `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-intent.md`.
- **Goal:** Append `family_h` + `claim_clarity` + highest-doctrine-risk H classifier key to `DOCTRINE_RISK_FAMILIES` Set in `scripts/ops/audit-lint-rules.cjs`. Card 2 of the H chain. DATA-only.
- **Acceptance:** Set membership tests pin all 3 new entries; Family A–G byte-equal; L5 fires on a Family H audit doc that omits `evidence_span` inspection; 3 fixtures self-validate.
- **Tests:** +10 to +15 net Jest (HALT 8 ceiling +30).

### MCP-021C-EDGE-FAMILY-H-ENABLE — production-mode flip for `claim_clarity` (8th production family)
- **Priority:** P1 — **Effort:** S — **Release:** 6.8 — **Wave:** 2 — **Agent:** roadmap-designer → roadmap-implementer → roadmap-reviewer. Issue #391.
- **Status:** Authorized, not started; CONDITIONAL on Cards 1+2 smoke PASS. See `docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE-intent.md`.
- **Goal:** Flip `familyRegistry.ts` Family H `productionEnabled: false → true`. Card 3 of the H chain. Production family count 7→8.
- **Acceptance:** One-character flip in `familyRegistry.ts` (HALT 12); 6 stale-assertion test updates (SEVEN → EIGHT count); new `__tests__/edgeFamilyHProductionEnable.test.ts` ~19 tests; smoke template Phase 6 doctrine `evidence_span` inspection BINDING (L5 CI-mechanical because Card 2 added `family_h` to `DOCTRINE_RISK_FAMILIES`).
- **Tests:** +15 to +25 net Jest (HALT 8 ceiling +35).

### MCP-SERVER-010-FAMILY-I — `thread_topology` server-side admin_validation ship (mixed-source)
- **Priority:** P1 — **Effort:** M — **Release:** 6.8 — **Wave:** 3 — **Agent:** roadmap-designer → roadmap-implementer → roadmap-reviewer. Issue #392.
- **Status:** Authorized, not started; predecessor = Family H chain CLOSED. See `docs/designs/MCP-SERVER-010-FAMILY-I-intent.md`.
- **Goal:** Server-side ship of Family I (`thread_topology`, 21 keys, 6 `ai_classifier` subset routed via MCP path, 8 `auto_metadata` + 7 `lifecycle` routed via non-MCP paths). Card 1 of the I 3-card chain. Mixed-source per Family D precedent.
- **Acceptance:** `familyIKeys.ts` = 6-key ai_classifier subset; `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry for `thread_topology` per D precedent; doctrine-risk = LOW (per Phase 1 verification); A–H byte-equal; HALT 14 trigger if subset wrong.
- **Tests:** +60 to +110 net Deno + ~8 Jest.

### OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK — L5 mechanization for `family_i` (CONDITIONAL)
- **Priority:** P2 — **Effort:** S — **Release:** 6.8 — **Wave:** 3 — **Agent:** roadmap-designer → roadmap-implementer → roadmap-reviewer. Issue #393.
- **Status:** Authorized, not started; CONDITIONAL on Card 1 doctrine-risk verdict (if LOW, this card may be SKIPPED → 2-card chain). See `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK-intent.md`.
- **Goal:** Append `family_i` + `thread_topology` + highest-risk I classifier key (if MEDIUM+) to `DOCTRINE_RISK_FAMILIES` Set. DATA-only.
- **Acceptance:** Same shape as H audit-lint card. CONDITIONAL.
- **Tests:** +10 to +15 net Jest.

### MCP-021C-EDGE-FAMILY-I-ENABLE — production-mode flip for `thread_topology` (9th production family, mixed-source)
- **Priority:** P2 — **Effort:** S — **Release:** 6.8 — **Wave:** 3 — **Agent:** roadmap-designer → roadmap-implementer → roadmap-reviewer. Issue #394.
- **Status:** Authorized, not started; CONDITIONAL on Cards 1+2 (or 1 alone if Card 2 SKIPPED) smoke PASS. See `docs/designs/MCP-021C-EDGE-FAMILY-I-ENABLE-intent.md`.
- **Goal:** Flip Family I `productionEnabled: false → true`. Card 3 of the I chain. Production family count 8→9. Subset filter for I STAYS PRESENT (mixed-source).
- **Acceptance:** One-character flip (HALT 12); subset filter preserved (HALT 13 INVERSE for I); 8-phase smoke; Phase 6 doctrine intensity per Card 2 shipped vs SKIPPED.
- **Tests:** +15 to +25 net Jest.

### MCP-BOOLEAN-BATCHING-INFRA-001 — request batching for >20-key families (plumbing only)
- **Priority:** P1 — **Effort:** M — **Release:** 6.8 — **Wave:** 2 — **Agent:** roadmap-designer → roadmap-implementer → roadmap-reviewer.
- **Status:** Build complete, awaiting Review. STACKED on Build-2 Family-F HEAD `2d4fa70`. See `docs/designs/MCP-BOOLEAN-BATCHING-DESIGN-001.md` + the MCP-BOOLEAN-BATCHING-INFRA-001 entry in `docs/core/current-status.md`.
- **Goal:** Add the deterministic chunking + merge plumbing so a production family with >20 classified keys can be classified despite the per-response `MAX_FLAGS_PER_RESPONSE = 20` cap — UNBLOCKS Families D (22) and G (21). Plumbing ONLY: adds NO family keys and NO new booleans (D/G consume this in later cards). Pure-TS `booleanObservationBatching.ts` (`chunkRawKeys` / `buildBatchRequestFromFull` / `mergeBatchResponses`); the direct (`classifyArgumentCore.ts`) + drainer (`classifierDrainerClassify.ts`) paths loop the adapter once per batch, share one run_id, and run the unchanged sanitize/persist tail. Out-of-band batch metadata (no schema bump, no wire change, no DDL). DEPLOY-BEARING (Edge mirror + mcp-server) but INERT until a family exceeds 20.
- **Acceptance:** `BATCH_SIZE = 16`, split-threshold = 20; ≤20 families → exactly 1 byte-identical batch (A/B/C/E/F unchanged, proven against the real builder); >20 proven with a synthetic fixture; per-batch response passes the UNCHANGED validator; a 21-entry single response still rejects (cap intact); one run per (argument, family), positives unioned, no double-count; all-or-nothing on any batch failure (no positive rows persisted; direct path aligned to the drainer) + leak-safe `failure_detail {batchIndex,batchTotal,reason}`; family-granularity retry on the drainer; no schema-version bump; batch metadata never on the wire; `engine.ts` untouched; full `mcpOneTwoOneBReadOnlyBoundary` suite green.
- **Tests:** +72 batching tests (3 new suites; reconciled onto main) + intent-preserving source-scan updates; mcp-server Deno 1388/0.
- **Operator follow-up (deploy-bearing → GATE-C):** merge → Edge `classify-argument-boolean-observations` auto-deploys; redeploy the standalone `mcp-server` (Deno Deploy — no functional change this card; keeps trees in sync). NO `npx supabase db push` (no DDL). Batching is dormant until Family D/G land.

### OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE — backfill observability for Family G
- **Priority:** P2 — **Effort:** S — **Release:** 6.8 — **Wave:** 2 — **Agent:** roadmap-designer → roadmap-implementer → roadmap-reviewer. Issue #395.
- **Status:** Queued; should have shipped post-G-enable (2026-05-29). See `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE-intent.md`.
- **Goal:** Update per-family SQL files in `scripts/ops/sql/` + manifest + runbook to include Family G alongside A–F. Trivial follow-up.
- **Acceptance:** SQL CASE statements / family-key-counts include G; manifest references "7 production families"; new `__tests__/opsMcpObservabilityFamilyGCoverage.test.ts` per D/E/F precedent; observability test isolation rules honored (`scripts/ops/sql/` count/ownership conventions).
- **Tests:** +20 to +50 net Jest.

### OPS-MCP-OBSERVABILITY-FAMILY-H-COVERAGE — backfill observability for Family H
- **Priority:** P2 — **Effort:** S — **Release:** 6.8 — **Wave:** 3 — **Agent:** roadmap-designer → roadmap-implementer → roadmap-reviewer. Issue #396.
- **Status:** Queued; predecessor = MCP-021C-EDGE-FAMILY-H-ENABLE smoke PASS. See `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-H-COVERAGE-intent.md`.
- **Goal:** Update per-family SQL + manifest to include H alongside A–G (8 production families).
- **Acceptance:** Same shape as G observability card.
- **Tests:** +20 to +50 net Jest.

### OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE — backfill observability for Family I (mixed-source)
- **Priority:** P2 — **Effort:** M — **Release:** 6.8 — **Wave:** 3 — **Agent:** roadmap-designer → roadmap-implementer → roadmap-reviewer. Issue #397.
- **Status:** Queued; predecessor = MCP-021C-EDGE-FAMILY-I-ENABLE smoke PASS. See `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE-intent.md`.
- **Goal:** Update per-family SQL + manifest to include I (9 production families). Source-mode breakdown added per D precedent (mixed-source visibility).
- **Acceptance:** SQL includes I; source-mode breakdown distinguishes MCP-routed vs non-MCP keys.
- **Tests:** +25 to +55 net Jest.

### OPS-FAMILY-J-SCOPING-AUDIT — audit-only investigation (does J need production-enable cards?)
- **Priority:** P2 — **Effort:** S — **Release:** 6.8 — **Wave:** 2 — **Agent:** CC main-thread (no subagent delegation required). Issue #398.
- **Status:** Authorized; preliminary Phase 1 finding predicts N=0 production cards needed. See `docs/designs/OPS-FAMILY-J-SCOPING-AUDIT-intent.md`.
- **Goal:** Walk the composer_only / inspect_only disposition gates for Family J's 5 keys (3 composer_only + 2 inspect_only). Confirm gating + write `docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-<date>.md` with verdict: "Family J needs N production-enable cards" where N ∈ {0, 1, ...}.
- **Acceptance:** Audit doc carries `Audit-Lint: v1` marker; per-key gate walk across 4 surfaces; integration path verification; test coverage assessment; conclusion + recommendation.
- **Tests:** none (audit-only; no code change).

---

## Epic 13 — Board-Level Analytics Without AI Calls

### AN-001 — Deterministic board diagnostics
- **Priority:** P2 — **Effort:** M — **Release:** 6.7
- **Outputs:** hot zones · unresolved axes · strong/weak counts · evidence-debt count · branch count · synthesis-ready count · no-rebuttal count.
- **Acceptance:** Pure deterministic. No xAI/Anthropic. UI tests + debug only.

### AN-003 — Tree playability diagnostics
- **Priority:** P2 — **Effort:** M — **Release:** 6.7 — **Wave:** 4 — **Agent:** analytics-agent
- **Status:** Pure model + 29-test suite complete (`src/features/analytics/treePlayabilityDiagnostics.ts`). The §5 dev-script snapshot generator is blocked on a repo-level TS-runtime constraint — see the Implementer note in `docs/designs/AN-003.md`.
- **Goal:** Pure-model diagnostics for whether a tree is playable: number of unresolved points · number of exhausted / stale points · branch depth · average actions to reach active unresolved point · source / evidence debt concentration · nodes with no available suggested action.
- **Acceptance:** Pure model. Dev / debug output only. No public scoring verdict. No xAI / Anthropic call.
- **Tests:** deep-tree fixture · unresolved-point count · branch-overload indicator · no truth / verdict copy.

### AN-002 — Visual QA snapshots
- **Priority:** P2 — **Effort:** M — **Release:** 6.8
- **Status:** Pure-TS fixtures module + 34-test suite complete (`src/features/analytics/visualQaFixtures.ts`). 8 named deterministic builders + `VISUAL_QA_FIXTURES` registry; hand-authored browser visual checklist at `docs/visual-qa-snapshots.md`. Dev / QA-only — never imported by `app/`.
- **Fixtures:** no-rebuttal · straight 10-move chain · source-chain fight · evidence-heavy branch · tangent/kink · synthesis path · 250-node stress · avatar/profile display.
- **Acceptance:** Pure model. Fixture model tests pass. Checklist doc references every fixture. No AI / Supabase / verdict / popularity signal.

---

## Epic 14 — UX Project Board Itself

### PM-001 — Create `docs/core/ux-ui-project-board.md`
- **Priority:** P0 — **Effort:** S — **Status:** ✅ Done (this file).

### PM-002 — Add "Now/Next/Later" tracker to `docs/core/current-status.md`
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
5. **Test count drift** — existing CLAUDE.md tracks test counts precisely. New cards must update `docs/core/current-status.md` only after tests actually pass.

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

1. Read `CLAUDE.md`, `docs/core/current-status.md`, `docs/seamless-conversation-entry.md`, `docs/argument-stack-timeline-surface.md`, `docs/conversation-gallery-ux.md`, `docs/browser-visual-test.md`.
2. Baseline: `git status -sb`, `npm run typecheck`, `npm run lint`, `npm run test`.
3. Implement TL-001 → TL-003, ST-001 (rename), VG-001 (token mapper), SC-002 (node popover), SC-001 (rail consolidation).
4. Update `docs/core/current-status.md`, `docs/browser-visual-test.md`, `docs/argument-stack-timeline-surface.md`.
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
