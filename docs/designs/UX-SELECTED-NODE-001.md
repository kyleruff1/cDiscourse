# UX-SELECTED-NODE-001 — Selected node "center of the room" treatment (Inspect drawer + responding-to anchor; reuses 001–005)

**Status:** Design draft
**Epic:** 16 — CivilDiscourse v4 UX overhaul (`epic:civildiscourse-v4`)
**Release:** v4 UX overhaul slate
**Issue:** https://github.com/<owner>/debate-constitution-app/issues/687
**Base:** `5b764a4` · branch `feat/UX-SELECTED-NODE-001-center`
**Lane:** UI (read-only projection of the once-derived board + shipped sidecar model) · GATE-C: **No** (UI; read-only detail projection; no deploy / migration / provider / backend mutation) · effort: **M**
**Depends on (all merged on main):** UX-MEDIATOR-001 (precedence + `v4DisplayStateFor`) · UX-MEDIATOR-002 (one chip + chip-adjacent Inspect caret + `MediatorNodeInspectDetail` + `NodeLabelInspectGroups` overlay) · UX-MEDIATOR-003 (evidence-blocked copy) · UX-MEDIATOR-004 (definition/scope copy) · UX-MEDIATOR-005 (Disagreement Points rail). Extends #135 (IX-004), #10 (SC-002), #63 (SC-004), CARD-VIEW-DETAIL-HUB-001 #517. Does **not** subsume #504 (CARD-VIEW-DATA-001).

---

## ⚠️ SUPERSEDED SCOPE NOTE (implement amendment — read first)

**The global / room-level "left rail" recommendation in this design is SUPERSEDED and moved to [UX-BOARD-RAIL-001 (#706)](./UX-BOARD-RAIL-001.md).** The original §16 O-2 already flagged that a left-rail "would force a layout rewrite of the timeline flex tree — broader than this card." That room-level rail / board-topology decision now lives entirely in UX-BOARD-RAIL-001. The board-rail merge that records this was **docs-only**, so this card's code baseline is unchanged (`b8b6d3a` design commit == `54e537f` main code at implement time).

**This card is now ACTIVE-POINT TREATMENT ONLY** — a strictly LOCAL, in-the-selected-card delta. It does **NOT** introduce, relocate, or modify any room-level rail, column layout, or timeline topology. The revised operator-locked local-only scope is:

1. **Restrained GOLD selected halo** on the selected-node card — `BRAND.accent.gold` (existing token, no new hex), visually distinct from the existing indigo (`GLOW.activePath`) active-path glow. Applied to the selected-node **readout card** (`TimelineSelectedReadoutPanel`), NOT to the VG-004 timeline-node halo token (`GLOW.selectedHalo` stays cream — it is pinned by `argumentNodeVisualVG004.test.ts` and owned by VG-004; changing it is out of scope here).
2. **Local in-card LEFT ACCENT only** — a left-edge accent stripe rendered INSIDE the selected-node card's own bounds (part of the card), **NOT a separate left column or board rail**. This is the load-bearing boundary: the accent lives within the selected card, never as a room-level layout column.
3. **Top anchor "Responding to this point"** where composition is bound — reuses the shipped `TimelineSelectedReadoutPanel` compact slot (O-2 = top anchor). On phone widths this is the form factor; on wider widths the in-card left accent appears but stays PART OF THE CARD.
4. **Parent / target excerpt** (`parentBodyPreview`, ≤120 chars — data already on the model) rendered inside the selected card; rendered only when the data exists.
5. **ONE primary v4 state chip** (no chip soup); secondary metadata stays in Inspect (unchanged from UX-MEDIATOR-002).
6. **Inspect drawer (O-4):** the four already-mounted Inspect siblings are sectioned into "Why this state · Other structure notes · Move forward · History" via a NEW local presentational wrapper `src/features/mediator/SelectedNodeInspectDrawer.tsx` — a LOCAL Inspect-overlay presentation change, NOT a board change. Inspect stays reachable via the UX-MEDIATOR-002 chip-adjacent caret (≥44px).
7. **Act dominant** in the Act/Inspect/Go dock; Inspect + Go stay secondary but ≥44px. Extends the EXISTING `board-menu-trigger-row` dock (styling only; routing untouched).
8. **"Go to parent point"** read-only jump — reuses `setActiveMessageId(parentMessageId)` (the same nav the 005 rail uses); rendered only when the parent-node-id data already exists; does NOT alter routing semantics.

**FORBIDDEN in this amended card (→ deferred to UX-BOARD-RAIL-001 / UX-BOARD-RAIL-002):** any room-level/persistent rail, any timeline flex-direction / width-model / geometry change, any global room column layout, any `DisagreementPointsRail` / `ArgumentSideActionRail` relocation, any scroll-anchoring or virtual-list rewrite, any backend / schema / RLS / submit / classifier / provider change. If the implementation appears to require any of these, STOP — it belongs to UX-BOARD-RAIL-001/002, not here.

The remainder of this document is the original design; where it (e.g. §16 O-1, O-2) discusses a left-rail or a cream/gold/indigo halo *token swap on the timeline node*, the amended scope above governs: gold halo on the selected-node **card** (not the VG-004 node token), top anchor (no left rail), and the new `SelectedNodeInspectDrawer.tsx` wrapper.

---

## §0 Scope-reality audit (POSTRUN-UX001 rule — orchestrator-authored card, audit BEFORE build)

This card's success depends on **current layout, current data availability, and current source placement**, so a pre-build reality audit was run against the shipped stack at base `5b764a4`. The audit reshapes the card from "build the v4 Inspect drawer + selected-node anatomy" into a **narrow reconciliation delta**, because most of the selected-node infrastructure already shipped with the mediator stack (#644–#648) and the IX-004 / SC-003 / SC-004 readout stack.

### Finding A — the v4 "Inspect drawer" ALREADY EXISTS as four mounted sibling overlays

The issue says "Today there is no v4 Inspect drawer." **Stale against the current repo.** `ArgumentGameSurface.tsx` already mounts, under the single `inspectVisible && activeMessageId` gate, a coherent Inspect surface composed of four read-only sibling overlays (L2503–2590):

| Mount | testID | What it renders | v4 drawer section it serves |
|---|---|---|---|
| `MediatorNodeInspectDetail` | `mediator-node-inspect-detail-active` | state label + helper sentence + `What would help next: <pathway>` | **WHY THIS STATE? + WHAT WOULD MOVE THIS FORWARD?** |
| `NodeLabelInspectGroups` | `ux001-5a-inspect-groups-overlay` | Machine Observations group + User Allegations group (uncapped, plain-language) | **OTHER STRUCTURE NOTES** (manual tags + machine obs) |
| `MetadataDiffInspector` | `metadata-diff-inspector` | recorded metadata changes (narrowed, qualifier change, …) | **HISTORY** (structural moves) |
| `InspectOpenIssueDetail` | `ref004-inspect-open-issue-detail` | the issue's source provenance | (deep provenance; REF-004) |

**Conclusion:** the four v4 drawer sections (why this state · other structure notes · what would move it forward · history) are **already reachable** from the shipped Inspect overlays. This card does NOT author a new `InspectDrawer.tsx`. It (1) **structures** these siblings into the four named v4 sections with section headers so they read as one drawer (a small wrapper + headers, not a rebuild), and (2) closes the two genuine gaps the audit found (Findings B + C).

### Finding B — the responding-to anchor + parent excerpt DATA ALREADY EXISTS but is only PARTIALLY surfaced

The issue's headline render — "Responding to · Maya's claim" anchor + parent excerpt — is **data-available today, partially rendered**:

- `argumentReplySidecarModel.ts` already produces **`parentHint`** (`"Replied to · #<ordinal> (<kindLabel>)"`, L373–375) AND **`parentBodyPreview`** (the parent body truncated to `PARENT_BODY_PREVIEW_CAP` = 120 chars, L376–377). Both are pure, deterministic, ban-list-safe, and already tested.
- `TimelineSelectedReadoutPanel.tsx` (mounted under the Timeline at L2215, `compact`) **renders `parentHint`** (the `parentLine`, L151–155) and an `Acting on: <short label>` line (L160–164) — **but it does NOT render `parentBodyPreview`** in compact mode (the parent body excerpt only appears in the expanded sidecar).

**Conclusion:** the parent/target **excerpt data exists on the model** — this is NOT a deferred "we have no data" case. The delta is (a) **promote `parentBodyPreview` into the compact selected-node view** as the v4 "Responding to … <excerpt>" anchor, and (b) **reframe the lead-in copy** from `"Replied to · #N (kind)"` / `"Acting on:"` to the v4 vocabulary `"Responding to this point"` (anchored where composition happens). This is a copy + one-field-promotion delta inside the shipped panel — **no model derivation, no new data path.** No person name is invented; the anchor uses the structural `#ordinal (kindLabel)` identity the model already returns, never a display name (the design export's "Maya's claim" is illustrative — the repo has no name on this path and must NOT synthesize one; see §7 copy + R3).

### Finding C — the "what would move it forward" chip set: UX-NEXT-MOVE-001 is NOT shipped

The issue routes the drawer's "what would move it forward" chips "to the same moves as UX-NEXT-MOVE-001." **Audit:** there is **no `docs/designs/UX-NEXT-MOVE-001.md`, no `nextMove*` model, and no `uxNextMove*` test** in the repo. UX-NEXT-MOVE-001 has not been designed or shipped.

**Conclusion:** the drawer's "what would move it forward" content MUST reuse the **already-shipped mediator pathway move set** — the same `nextMoveLabel` that `MediatorNodeInspectDetail` already renders (`plainLanguageForPathwayStep(firstAvailablePathwayStep)` from UX-MEDIATOR-001), which is the single, board-derived primary move for the node. This card renders the existing primary move **as the drawer's "Move forward:" content** and reserves a **render slot** for the richer multi-chip move set that UX-NEXT-MOVE-001 will supply later. It does NOT invent a move-suggestion engine (that is UX-NEXT-MOVE-001's owned scope, §9 non-goals). The acceptance "chips match the node's primary-move set" is satisfied by sourcing from the same board pathway the chip/dock already use — they are the same move by construction.

### Finding D — the selected-state halo + the Act/Inspect/Go dock + the one chip + the chip-adjacent Inspect caret ALL EXIST

- **Selected-state halo:** `GLOW.selectedHalo` (cream ring, `ringWidthPx: 3`, `BRAND.accent.cream`) and `GLOW.activePath` (indigo glow, `#a5b4fc`) are shipped tokens (VG-004) and **already render on the timeline node** (`ArgumentTimelineMap.tsx:278, 341` — indigo glow for active-path nodes, cream halo for the SC-004 selected/dock target). The "obvious selected state · restrained gold OR indigo halo" the brief asks for is **already a shipped affordance** — this card does NOT invent a halo; it makes a one-token **operator-facing color choice** (cream-today vs gold vs indigo) and confirms the anchor copy lands at the haloed node. **Open visual decision O-1.**
- **Act / Inspect / Go dock:** the `board-menu-trigger-row` (Act / Inspect / Go buttons, L2383–2474) is shipped, with key badges on web ≥1024 and 44×44 touch targets. This is the AIG dock the brief names. This card **extends its visual hierarchy** (make one action dominant) — it does NOT reinvent the dock. **Open visual decision O-3.**
- **One chip + chip-adjacent Inspect caret:** `mediator-node-chip-row` (one `MediatorNodeMarker` + the `mediator-node-inspect-caret` Pressable, L2235–2254) is shipped (UX-MEDIATOR-002 O-2). The chip-adjacent Inspect affordance the brief requires **already exists** and opens the drawer (`handleNodeChipInspect` → `setInspectVisible(true)`, L1729).

**Effort re-estimate:** the issue labels this **M**. Given Findings A–D, the *code* delta is **S–M** (section-header wrapper for the existing Inspect siblings + promote `parentBodyPreview` + reframe anchor copy + a few copy lines + AIG dominance styling + tests). The **M** is justified by the heavily-pinned mount file (`ArgumentGameSurface.tsx`), the cross-file copy reconciliation, and the test surface (four-section drawer render, anchor+excerpt, ban-list, 390px, reduce-motion). Keep **M**; the work is test-and-care heavy, not derivation-heavy. **This is NOT a design-only-stop card** — a safe mount point exists for every element of the delta.

---

## Goal (one paragraph)

When a user taps a node it must immediately answer three questions: **(1) What point am I on?** **(2) What remains unresolved?** **(3) What's the next useful move?** This card makes the selected node feel like the **center of the room** by composing the *already-shipped* mediator + readout surfaces into one coherent selected-node anatomy — the responding-to anchor (with the parent excerpt the model already carries), the ONE primary structural state chip (from UX-MEDIATOR-002's `v4DisplayStateFor`), the chip-adjacent Inspect affordance (UX-MEDIATOR-002 O-2), and the Act / Inspect / Go dock with one action visually dominant — and by **structuring the existing four Inspect overlays into the v4 drawer's four named sections** (why this state · other structure notes · what would move it forward · history). It reuses the board derived **once** in `ArgumentGameSurface` (single-derivation invariant; never re-derived), stays a pure read-only projection (no derivation, no network/AI, no mutation), and **never gates submission** — the deterministic Constitution engine (`src/domain/constitution/engine.ts`) remains the sole acceptance gate. It avoids **chip soup** (one primary chip; all secondary metadata stays in the drawer/Inspect) and keeps **sensitive composer-only Observations** off public/node surfaces. Doctrine (`cdiscourse-doctrine`): no truth/verdict/winner/loser/score/heat/popularity language; person-neutral structural copy; "WHY THIS STATE?" explains *structure*, not the person; classifiers advisory, never a gate.

---

## §1 Inventory — what EXISTS today (read before tabulating)

| Surface | File · site | What it does today |
|---|---|---|
| Timeline node + selected halo | `ArgumentTimelineMap.tsx:278,341` | indigo `GLOW.activePath` glow on active-path nodes; cream `GLOW.selectedHalo` ring on the SC-004 selected/dock target. Geometry survives reduce-motion (stroke), shadow drops to 0. |
| One primary state chip + Inspect caret | `ArgumentGameSurface.tsx:2235–2254` (`mediator-node-chip-row`, `mediator-node-marker-active`, `mediator-node-inspect-caret`) | `MediatorNodeMarker` (one chip, `v4DisplayStateFor`-projected) + a chip-adjacent `Inspect` Pressable (role=button, 44×44 via hitSlop) that opens the drawer. Self-hides for ordinary open/resolved nodes. |
| `MediatorNodeMarker` | `src/features/mediator/MediatorNodeMarker.tsx` | the one read-only state chip; impasse left-rule (geometry). UNTOUCHED by this card. |
| Compact selected-node readout | `TimelineSelectedReadoutPanel.tsx` (mounted `ArgumentGameSurface.tsx:2215`, `compact`) | renders `kindLine`, `bodyExcerpt`, **`parentHint`** (`Replied to · #N (kind)`), reply-count + branch, **`Acting on:`** line, expand-trigger to the 6-section sidecar. Does NOT render `parentBodyPreview` in compact. IX-004 live-region + selection announcement + stale banner inside. |
| Sidecar model (parent data source) | `argumentReplySidecarModel.ts:373–377` | produces **`parentHint`** AND **`parentBodyPreview`** (parent body truncated to 120 chars) — both already exist. |
| Inspect drawer = 4 mounted siblings | `ArgumentGameSurface.tsx:2529–2590` (gate `inspectVisible && activeMessageId`) | `MediatorNodeInspectDetail` (why-this-state + helper + next-move) · `NodeLabelInspectGroups` (Machine Observations / User Allegations) · `MetadataDiffInspector` (history) · `InspectOpenIssueDetail` (provenance). |
| `MediatorNodeInspectDetail` | `src/features/mediator/MediatorNodeInspectDetail.tsx` | state label + helper + `What would help next: <pathway>`. The "why this state" + "what would move forward" content. |
| Act / Inspect / Go dock | `ArgumentGameSurface.tsx:2383–2474` (`board-menu-trigger-row`) | three Pressables (Act / Inspect / Go), key badges on web ≥1024, 44×44, mutual-exclusion popouts (`ActPopout` / `InspectPopout` / `GoPopout`). |
| Disagreement Points rail row anchoring (005) | `DisagreementPointsRail.tsx` (mounted `ArgumentGameSurface.tsx:2321`) | one badge per point + "Move forward:" + "View in timeline →" jump → `setActiveMessageId(nodeId)`. Read-only. UNTOUCHED. |
| Side action rail | `ArgumentSideActionRail.tsx` (mounted `ArgumentGameSurface.tsx:2348`) | Act/Inspect/Go-adjacent verbs (Watch · Join · Ask source · …) — actor-aware. Reconcile, do not reinvent. |

**Key audit conclusions feeding the table:** the halo, the one chip, the chip-adjacent Inspect caret, the AIG dock, the four Inspect siblings, and the parent-excerpt data ALL exist. The card's job is **reconciliation + the two real gaps** (promote the parent excerpt into the compact anchor; add the four section headers to the Inspect drawer), plus operator-facing visual choices (halo color, anchor placement, dominant action).

---

## §4 THE COMPACT MAPPING TABLE (core deliverable)

Legend: **B-touched** = behavior touched (state/handlers); **D/API** = data/API touched; **safe** = safe-now vs deferred. Copy-to-avoid is the ban-list shorthand (no truth/verdict/score/heat/person — see §7).

| # | Surface | Current implementation | Desired v4 selected-node behavior | Source / model hook | Copy-to-use | Copy-to-avoid | B-touched | D/API | Safe-now / deferred | Test coverage |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Selected-state halo** (node) | Cream `GLOW.selectedHalo` ring + indigo `GLOW.activePath` glow already render on the selected/active timeline node (`ArgumentTimelineMap.tsx:278,341`) | Keep the **one restrained halo** on the selected node; confirm it reads as "center of the room"; pick the halo hue (cream-today / gold / indigo) via one token | `GLOW.selectedHalo` / `GLOW.activePath` (VG-004 tokens); `BRAND.accent.gold` available if O-1 picks gold | — (geometry only) | red/green; glow-as-strength; flash >3/s | **n** (token value only) | **n** | **safe-now** (token choice) | grayscale + reduce-motion halo test (extend `ArgumentTimelineMap` tests) |
| 2 | **Responding-to anchor** | `TimelineSelectedReadoutPanel` renders `parentHint` (`Replied to · #N (kind)`) + `Acting on:` line | Reframe lead-in to **"Responding to this point"** anchored where composition happens; keep the structural `#ordinal (kindLabel)` identity | `sidecar.parentHint` (exists); readout `actingOnShortLabel` | "Responding to this point" · "Respond to the exact point" | "Replied to" is fine to keep as sub-label; AVOID a fabricated display name ("Maya's claim") | **n** (copy) | **n** | **safe-now** | anchor copy render test |
| 3 | **Parent / target excerpt preview** | `parentBodyPreview` (parent body, ≤120 chars) **exists on the model** but is NOT rendered in compact view | **Render the parent excerpt** under the anchor in the compact selected-node view (the data exists — Finding B) | `sidecar.parentBodyPreview` (`argumentReplySidecarModel.ts:376`) | (excerpt is user text, verbatim/truncated) | AVOID summarizing/labeling the excerpt; no AI rewrite | **n** (render a field already in VM) | **n** | **safe-now** (data present) | parent-excerpt render test (present + truncated + absent→omit) |
| 4 | **ONE primary structural state chip** | `MediatorNodeMarker` (one chip, `v4DisplayStateFor`) in `mediator-node-chip-row` | Keep exactly ONE primary chip; secondary metadata stays in the drawer (no chip soup) | `getNodeMediatorMarker(board, activeMessageId)` (UX-MEDIATOR-002) | the nine v4 state labels (e.g. "Needs evidence", "Structured impasse") | "winner/loser/true/false/correct"; second competing chip | **n** | **n** | **safe-now** (unchanged) | no-chip-soup assertion (exactly one chip) |
| 5 | **Chip-adjacent Inspect affordance** | `mediator-node-inspect-caret` Pressable opens Inspect (`handleNodeChipInspect`) | Keep; this is the discoverable "open the drawer" tap | `setInspectVisible(true)` (L1729) | "Inspect structure" (caret label may stay "Inspect") | — | **n** | **n** | **safe-now** | a11y: role=button, label, expanded state, 44×44 |
| 6 | **Inspect drawer — "WHY THIS STATE?"** | `MediatorNodeInspectDetail` renders state label + helper | Add the section header **"Why this state"**; keep helper (structure, not the person) | `MediatorNodeInspectDetail` (existing); `helperForMediatorState` | "Why this state" · helper sentences (existing, person-neutral) | "AI thinks"; "decide for me"; any verdict | **n** (header only) | **n** | **safe-now** | section-header render + ban-list |
| 7 | **Inspect drawer — "OTHER STRUCTURE NOTES"** | `NodeLabelInspectGroups` (Machine Observations / User Allegations) | Add the section header **"Other structure notes"** above the two groups; keep §10a separation | `NodeLabelInspectGroups` (existing) | "Other structure notes" · "Machine Observations" / "User Allegations" (existing headers) | collapsing obs+allegations into "tags" | **n** (header only) | **n** | **safe-now** | groups still mount; headers present; no raw keys |
| 8 | **Inspect drawer — "WHAT WOULD MOVE THIS FORWARD?"** | `MediatorNodeInspectDetail` renders `What would help next: <pathway>` | Add header **"Move forward:"**; render the existing primary move; reserve a slot for UX-NEXT-MOVE-001's richer chip set | board pathway (`plainLanguageForPathwayStep`); shared with the dock's Act target | "Move forward:" · "Ask for a source" · "Define the key term" · "Narrow the claim" · "Branch the provable part" | — | **n** (header + render existing) | **n** | **safe-now** (multi-chip = deferred to UX-NEXT-MOVE-001) | move matches node primary-move; ban-list |
| 9 | **Inspect drawer — "HISTORY"** | `MetadataDiffInspector` renders recorded structural changes | Add header **"History"**; keep structural moves (narrowed, qualifier change), never popularity | `MetadataDiffInspector` (existing) | "History" · existing diff copy (narrowed, …) | likes/views/engagement/"trending" | **n** (header only) | **n** | **safe-now** (chime-in history = deferred) | header present; no popularity tokens |
| 10 | **Act / Inspect / Go dock** | three equal Pressables (`board-menu-trigger-row`) | Make **one action visually dominant** (Act, per S3 "Act dominant"); secondary stay ≥44×44 | the shipped dock (L2383); `ActPopout`/`InspectPopout`/`GoPopout` | "Move forward:" framing on Act | — | **n** (styling) | **n** | **safe-now** (styling); routing unchanged | dominant-styling test; 44×44 on all three |
| 11 | **Disagreement Points rail row anchor (005)** | one badge + "Move forward:" + jump | UNTOUCHED — it already anchors to the node; selected node syncs via `onJump`→`setActiveMessageId` | `DisagreementPointsRail` (005) | (consumes 005 copy) | — | **n** | **n** | **safe-now** (no change) | regression: rail still green |
| 12 | **Sensitive composer-only Observations** | excluded from `timeline_node` + `inspect` surfaces (`filterMarksBySurface`) | Stay hidden from the node + the drawer; never on public/target surfaces | `nodeLabelPresentationModel.isDispositionEligible` (existing) | — | any `shifts_to_person_or_intent` string on the node/drawer | **n** | **n** | **safe-now** (boundary preserved) | sensitive-never-on-node/drawer assertion |

**Safe-now vs deferred summary:** rows 1–12 are **all safe-now** as scoped (composition of shipped surfaces + copy + one-field promotion + styling). The **deferred slices** are narrower than the rows: the *multi-chip* "what would move it forward" set (→ **UX-NEXT-MOVE-001**), the *chime-in "added a source"* History entry (→ **UX-ROOM-1V1-CHIMEIN-001** supplies the data), and any *impasse-specific* drawer treatment (→ **UX-IMPASSE-001**). Each is a render slot, not synthesized data.

---

## §5 Required selected-node behavior — how the design satisfies it

The selected node must visually answer four things; each maps to a shipped or section-headed surface:

- **Which point is active** → the **cream/gold/indigo halo** (row 1) on the node + the **"Responding to this point"** anchor (row 2) + the **parent excerpt** (row 3).
- **What state it's in** → the **ONE primary state chip** (row 4) — no chip soup; secondary metadata is in the drawer.
- **What's in Inspect** → the **chip-adjacent Inspect caret** (row 5) opens the **four-section drawer** (rows 6–9).
- **The next useful move** → the drawer **"Move forward:"** section (row 8) + the **Act-dominant dock** (row 10), both sourced from the same board pathway.

**No chip soup:** exactly one chip renders by default (row 4, enforced by UX-MEDIATOR-002's `getNodeMediatorMarker` suppression). Everything else — machine observations, user allegations, metadata history, the why-this-state helper — lives in the drawer (rows 6–9). The compact readout adds only the anchor + excerpt (rows 2–3), which are *context*, not chips.

**Sensitive-mark handling:** composer-only Observations (`shifts_to_person_or_intent`, `contains_unplayable_insult_only`, `needs_pre_send_pause`) are already excluded from both the `timeline_node` and `inspect` surfaces by `filterMarksBySurface` (UX-MEDIATOR-002 §4). This card adds no path that widens exposure; a test asserts a sensitive code appears on **neither** the node nor the drawer for the target node.

**No new room/seat/chime-in semantics; no submit-path change; no backend/persistence change.** The anchor's `onJump`/selection sync reuses the shipped `setActiveMessageId` read-only navigation; the drawer is read-only; the dock routing is unchanged.

---

## §6 Act / Inspect / Go grammar — hierarchy delta vs the existing dock/rail

The brief's AIG grammar maps **onto the shipped `board-menu-trigger-row`** — extend, do not reinvent:

| Group | Brief verbs | Where they live today | This card's delta |
|---|---|---|---|
| **Act** = respond · ask source · narrow · concede · branch | `ActPopout` (`buildActPopout` 3-gate model) + the side action rail presets | **make Act the visually dominant trigger** (S3 "Act dominant") — larger weight / accent; secondary buttons stay ≥44×44 (O-3) |
| **Inspect** = structure notes · evidence debt · machine observations · parent relation | `InspectPopout` + the four drawer siblings (rows 6–9) | section-header the drawer; the chip-adjacent caret is the discoverable Inspect entry |
| **Go** = jump to parent · branch · open point · related disagreement | `GoPopout` (mini-map, jump-to-root/latest) + the 005 rail "View in timeline →" | **add "Go to parent point"** affordance from the anchor (reuses `parentNodeId` → `setActiveMessageId`); no new Go logic |

These are the **PRIMARY node controls**, not random tags. The only behavioral change is the optional **"Go to parent point"** jump wired off the anchor's `parentNodeId` (read-only `setActiveMessageId`, the same navigation the 005 rail already uses). **Open decision O-3** (which single action is dominant) — recommendation below. The dock's routing, popout models, and key-badge platform gating (`deriveMenuKeyBadgeContext`, web ≥1024) are **untouched**.

---

## §7 Copy

**Use (all ban-list clean, person-neutral, advisory):** "Responding to this point" · "What remains unresolved?" · "Move forward:" · "Inspect structure" · "Go to parent point" · "Ask for a source" · "Define the key term" · "Narrow the claim" · "Branch the provable part" · "Respond to the exact point" · "Why this state" · "Other structure notes" · "History". The nine v4 state labels and pathway labels come from the shipped `mediatorPlainLanguage.ts` maps (no new state copy authored here).

**Avoid (ban-list — fails the test):** decide for me · AI thinks · truth · verdict · winner · loser · score · fallacy · wrong · dishonest · bad faith · manipulative · hiding/withheld evidence · blame/fault · likes/views/followers/engagement/trending/viral.

**Person-name guard (R3):** the design export shows "Responding to · **Maya's claim**." The repo's `parentHint`/`parentBodyPreview` path carries **no author display name** — it returns a structural `#ordinal (kindLabel)` identity + the parent body excerpt. This card **must NOT synthesize a name** onto the anchor (no name field exists, and a name on a "responding to" anchor edges toward person-framing). The anchor reads "Responding to this point" + the structural identity + the excerpt. A name, if ever desired, is a separate decision with a data source — out of scope here.

All produced strings flow through the existing plain-language maps and are scanned by `_forbiddenMediatorTokens()` + a snake_case check (test-discipline ban-list pattern). The engine remains the **sole gate**; nothing in this card returns a posting decision.

---

## §8 Scope

**ALLOWED in implement:**
- Selected-node UI **layout/styling** (the halo color token choice O-1; anchor placement O-2; Act-dominance styling O-3).
- The selected-state affordance (confirm halo on the selected node; reduce-motion + grayscale legibility).
- **Parent/target excerpt preview** — promote the existing `parentBodyPreview` into the compact selected-node anchor (data already present, Finding B).
- Inspect-drawer **section headers** ("Why this state" · "Other structure notes" · "Move forward:" · "History") wrapping the four shipped sibling overlays so they read as one drawer; reduce-motion + dismissibility (reuse the shipped `inspectVisible` close path).
- Inspect trigger placement + touch-target refinement (the chip-adjacent caret already meets 44×44; confirm).
- Act/Inspect/Go visual hierarchy (one dominant action) + the **"Go to parent point"** jump off the anchor (read-only `setActiveMessageId`).
- Copy (§7), tests.

**FORBIDDEN:** new classifier · MCP · Family K/J · provider call · persistence/migration · Supabase write/service-role · room/seat/chime-in behavior · submit-path change · a move-suggestion engine (UX-NEXT-MOVE-001) · route/model/table/type rename · deployment · netlify-prod. No re-derivation of the board (single-derivation invariant). No new dependency.

---

## §9 The smallest-safe delta (files) + what stays

### CHANGE — `src/features/arguments/ArgumentGameSurface.tsx` (the mount site only, ~30–50 lines net)

1. **Drawer section headers (rows 6–9).** Wrap the four shipped Inspect siblings (L2529–2590) in a small section-headed structure: a `<Text accessibilityRole="header">` lead for "Why this state" (above `MediatorNodeInspectDetail`), "Other structure notes" (above `NodeLabelInspectGroups`), and "History" (above `MetadataDiffInspector`); the "Move forward:" header is rendered by `MediatorNodeInspectDetail`'s existing next-move line (rename its lead-in copy — see below). **Recommendation O-4: extract a tiny presentational wrapper** `SelectedNodeInspectDrawer.tsx` (~60 lines) that takes the four siblings as children/props + renders the headers, OR inline the headers (cheaper). The siblings themselves are **composed, not modified**.
2. **Act-dominant dock styling (row 10).** Apply a dominant style to the Act `Pressable` in `board-menu-trigger-row` (larger weight / accent fill); keep Inspect + Go ≥44×44. Styling only; routing untouched.
3. **"Go to parent point" jump (row, §6).** Wire an optional anchor affordance that calls `setActiveMessageId(parentNodeId)` (read-only) — the `parentId` is already on the active node.

### CHANGE — `src/features/arguments/TimelineSelectedReadoutPanel.tsx` (~10–15 lines)

4. **Responding-to anchor + parent excerpt (rows 2–3).** Reframe the compact `parentLine` lead-in to **"Responding to this point"** (keep the structural `#N (kind)` sub-label) and **render `viewModel.sidecar...parentBodyPreview`** under it (currently unused in compact). The data is already on the view model — this surfaces one existing field + one copy reframe. Omit the excerpt cleanly when absent (root node has no parent).

### CHANGE — `src/features/mediator/MediatorNodeInspectDetail.tsx` (≤2 copy lines, optional)

5. **"Move forward:" lead-in (row 8).** Optionally rename the shipped `What would help next: <pathway>` lead-in to the v4 **"Move forward: <pathway>"** for vocabulary parity with the 005 rail. Ban-list clean. **Lockstep:** update `__tests__/MediatorNodeInspectDetail.test.tsx` assertion. Offered as **O-5**; default is to keep the shipped lead-in and let the drawer's section header carry "Move forward:".

### (optional, O-1) `src/lib/designTokens.ts` — **NO change unless O-1 picks gold/indigo over today's cream**; even then it is selecting an existing token (`BRAND.accent.gold` / `GLOW.activePath.color`), not adding one.

### UNTOUCHED (preserve byte-for-byte / behavior)

- `MediatorNodeMarker.tsx`, `nodeMediatorMarkers.ts`, `deriveMediatorBoardState.ts`, `mediatorBoardTypes.ts`, `mediatorPlainLanguage.ts` (no state/precedence/copy change beyond the optional O-5 lead-in).
- `NodeLabelInspectGroups.tsx`, `MetadataDiffInspector.tsx`, `InspectOpenIssueDetail.tsx`, the whole `nodeLabels`/`nodeAnnotations` pipeline (composed, not edited).
- `DisagreementPointsRail.tsx` + the 005 rail mount (out of scope, regression only).
- `ArgumentSideActionRail.tsx`, `ActPopout`/`InspectPopout`/`GoPopout` + their models (the dock routing is unchanged).
- `argumentReplySidecarModel.ts` (read its existing `parentBodyPreview`; no model change).
- The single-derivation site (`deriveRoomMediatorBoardState` at `ArgumentGameSurface.tsx:~683`) — invariant preserved; board consumed, never re-derived.

### Net file count

- **Modified:** 2 (`ArgumentGameSurface.tsx`, `TimelineSelectedReadoutPanel.tsx`) + optional 1 (`MediatorNodeInspectDetail.tsx`, O-5).
- **New:** 0–1 (`SelectedNodeInspectDrawer.tsx` wrapper, O-4 recommended) + 1 test file.
- **Deleted:** 0.

### Existing tests that PIN current behavior + reconciliation

| Test | Pins | Reconciliation |
|---|---|---|
| `__tests__/uxOneOneTwoReadoutCompactMode.test.tsx` | the compact readout renders `kindLine`/`bodyExcerpt`/`parentHint`/`Acting on:` | **Extend** — add the new "Responding to this point" anchor + `parentBodyPreview`; update any assertion that pins the exact `parentHint` lead-in copy in lockstep. |
| `__tests__/timelineSelectedReadout*.test.*`, `timelineReadoutBanList.test.ts` | readout fields + ban-list | **Stays green** (ban-list re-runs over the new anchor/excerpt copy, which is clean); extend with the anchor assertion. |
| `__tests__/MediatorNodeInspectDetail.test.tsx` | renders state/helper/`What would help next:` | **Stays green if O-5 declined.** If O-5 (rename to "Move forward:"), update the assertion in lockstep. |
| `__tests__/uxMediator002NodeMarkup.test.tsx` | one chip + Inspect overlay siblings mount under the gate | **Stays green** — the section headers are siblings/wrappers; the four overlays still mount with their existing testIDs. |
| `__tests__/NodeLabelInspectGroups.test.tsx`, `MetadataDiffInspector.test.tsx` | the overlays' own rendering | **Stays green** — components unchanged; only a header is mounted above them. |
| `ArgumentGameSurface` wiring/integration tests | the mount tree (chip row, dock row, inspect gate) | **Extend** — assert the four section headers render when `inspectVisible`; assert the anchor+excerpt render in compact; assert Act-dominant styling marker. Run the **full suite** (not a tailed run — test-discipline gate-timeout rule). |

**Net:** the delta is additive (section headers + one promoted field + copy reframes + dominance styling). No shipped fixture flips except the readout compact-copy assertion (updated in lockstep) and the optional O-5 lead-in.

---

## §10 Test plan (`__tests__/`, render + a11y)

New file `__tests__/uxSelectedNode001CenterOfRoom.test.tsx` (+ targeted extensions to the readout + surface tests):

- **Three-question answer (acceptance core).** Render the selected-node subtree for an active node with a mediator state + a parent: assert (1) the anchor "Responding to this point" + parent excerpt render (what point), (2) exactly ONE primary state chip renders (what state), (3) the "Move forward:" content renders the node's board pathway move (next move).
- **Responding-to anchor + parent excerpt.** Present case: `parentBodyPreview` renders under the anchor; truncated case: ≤120 chars + ellipsis; **root node** (no parent): the anchor/excerpt are omitted cleanly (no empty chrome). Assert NO fabricated display name appears (no "Maya"-style synthesis).
- **Four-section drawer.** With `inspectVisible` true, assert all four section headers render — "Why this state" (+ `MediatorNodeInspectDetail`), "Other structure notes" (+ `NodeLabelInspectGroups` with both group headers), "Move forward:" (+ the board pathway move), "History" (+ `MetadataDiffInspector`). Assert **no raw classifier key** string leaks (no snake_case; ban-list clean).
- **"What would move it forward" matches the primary-move set.** Assert the drawer's move equals the same board pathway the node chip/dock use (sourced from `plainLanguageForPathwayStep(firstAvailablePathwayStep)`), proving the acceptance "chips match the node's primary-move set" by shared source.
- **No chip soup.** Default view mounts exactly one `mediator-node-marker-*`; no second chip surface; secondary metadata is only in the drawer.
- **Sensitive Observation never on node or drawer.** Feed a `composer_only` sensitive code; assert it appears in neither the node chip, the anchor, nor any drawer section.
- **Act-dominant dock.** Assert the Act trigger carries the dominant style marker; all three triggers (Act/Inspect/Go) keep role=button + label + 44×44 (or hitSlop).
- **Go-to-parent.** Assert the anchor's "Go to parent point" affordance calls `setActiveMessageId(parentNodeId)` (read-only nav); absent for root.
- **A11y + 390px + reduce-motion.** Anchor/excerpt/drawer legible at 390px (no overflow); drawer dismissible (reuse `inspectVisible` close); reduce-motion path (halo stroke survives, shadow→0; no new animation); grayscale-legible (halo geometry + text labels carry meaning).
- **Ban-list clean.** Scan all rendered strings (anchor, excerpt lead-in, four headers, move copy, dock) for `_forbiddenMediatorTokens()` + snake_case → none.
- **Regression (full suite).** Re-run `__tests__/{uxMediator00*,nodeMediatorMarkers,MediatorNodeMarker,MediatorNodeInspectDetail,NodeLabelInspectGroups,MetadataDiffInspector,DisagreementPointsRail,disagreementPointsRail*,timelineSelectedReadout*,uxOneOneTwoReadoutCompactMode,argumentReplySidecar*}.test.*` — all green; rail/board/chip behaviors unchanged.
- **Gates:** `npm run typecheck`, `npm run lint`, `npm run test` all exit 0 (full suite, captured exit code per test-discipline gate-timeout rule); test count goes UP.

---

## §11 Dependencies (cards / docs / files)

- **Depends on (merged):** UX-MEDIATOR-001 (`v4DisplayStateFor`, pathway labels), UX-MEDIATOR-002 (one chip + chip-adjacent Inspect caret + `MediatorNodeInspectDetail` + `NodeLabelInspectGroups`), UX-MEDIATOR-003 (evidence-blocked copy), UX-MEDIATOR-004 (definition/scope copy), UX-MEDIATOR-005 (rail). `docs/designs/UX-MEDIATOR-001..005.md`.
- **Extends:** #135 (IX-004 selected-message readout — `TimelineSelectedReadoutPanel`), #10 (SC-002 selection), #63 (SC-004 dock), CARD-VIEW-DETAIL-HUB-001 #517. **Does NOT subsume** #504 (CARD-VIEW-DATA-001) — consumes its data contract, never re-derives the board.
- **Reads existing (no re-derivation):** the once-derived `mediatorBoard` (`ArgumentGameSurface.tsx:~683`), `getNodeMediatorMarker`, `helperForMediatorState`/`plainLanguageForPathwayStep`, `argumentReplySidecarModel`'s `parentHint`/`parentBodyPreview`, the four Inspect siblings, the AIG dock, the VG-004 `GLOW`/`BRAND.accent` tokens.
- **Single-derivation invariant** (`memory: mediator-board-single-derivation`): the board is derived ONCE and shared by the rail + node markup + this card's drawer — never re-derived.
- **Engine path note** (`memory: claude-md-engine-path-stale`): the live engine is `src/domain/constitution/engine.ts`; this card imports neither engine — gate-independence is structural.
- **Design source of truth:** `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-CARDS.md` L1088–1147 (UX-SELECTED-NODE-001) + L747–812 (S3 anatomy / S4 drawer); `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md`; `docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md`.

---

## §12 Risks

- **R1 — `ArgumentGameSurface` is large and heavily-pinned.** Editing the Inspect-overlay mount tree risks an unrelated snapshot. **Mitigation:** the delta is localized (section headers around the four existing siblings + the compact-readout anchor); run the **full suite**, not a tailed run.
- **R2 — Drawer section headers vs the four overlays' own internal headers.** `NodeLabelInspectGroups` already has "Machine Observations"/"User Allegations" sub-headers; an outer "Other structure notes" header must read as a *section* lead, not a duplicate. **Mitigation:** distinct typography (section header vs group header); test asserts both levels present without redundancy.
- **R3 — Person-name temptation on the anchor.** The design export's "Maya's claim" could lead an implementer to synthesize a name. **Mitigation:** §7 person-name guard + a test asserting no fabricated name; the anchor uses the structural identity only.
- **R4 — UX-NEXT-MOVE-001 not shipped.** The "what would move it forward" chip set is a single board move today, not a multi-chip set. **Mitigation:** render the existing board pathway move + a render slot; the acceptance is met by shared source; the richer set is deferred (Finding C).
- **R5 — Halo color choice churn.** Switching the halo from cream (today) to gold/indigo touches `ArgumentTimelineMap` snapshots. **Mitigation:** O-1 is an operator decision; the default (keep cream) is zero-churn; gold/indigo selects an existing token, no new hex.
- **R6 — `parentBodyPreview` could be a hidden/deleted body.** **Mitigation:** the sidecar model already redacts/handles hidden bodies (`isHidden` path); the excerpt reuses that path verbatim; a test covers the hidden/absent case → omit.

---

## §13 Non-goals (explicit)

- **NO one-state chip collapse** — UX-MEDIATOR-002 owns it; this card consumes the one chip.
- **NO move-suggestion engine / multi-chip "next move" set** — **UX-NEXT-MOVE-001** owns it; this card renders the existing board move + a slot.
- **NO board re-derivation; NO `#504` (CARD-VIEW-DATA-001) subsumption** — consume, never re-derive.
- **NO room/seat/chime-in/submission-semantics change** — the History "chime-in added a source" entry is a deferred render slot (**UX-ROOM-1V1-CHIMEIN-001** supplies the data).
- **NO impasse-specific selected treatment** — deferred to **UX-IMPASSE-001**; this card shows the impasse state via the shipped chip/helper only.
- **NO cross-device QA matrix sign-off** — deferred to **UX-FEEDBACK-001 / UX-RESPONSIVE-V4-001 / UX-ACCESSIBILITY-001**; this card verifies its own 390px + reduce-motion + grayscale paths inline.
- **NO classifier/MCP/Family K/J, NO provider call, NO persistence/migration/Edge Function/deploy, NO Supabase write/service-role, NO new dependency, NO route/model/type rename.**

---

## §14 Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the selected-node surfaces show structural states + structural moves; "Why this state" explains structure, never the person; the drawer is read-only and imports nothing from the engine — it gates nothing. PASS.
- **§2 (heat ≠ truth) / §3 (popularity is not evidence):** no heat/temperature/engagement/like/view/follower token in the anchor, excerpt, drawer, or dock; the History section shows structural moves (narrowed, qualifier change), never popularity. PASS.
- **§4 (AI moderator limits):** the relocated/section-headed machine Observations are advisory, `authoritative:false`, never modify/hide/delete content, never run on a network in the app; this card moves none of them and asserts no truth. No AI call from the production app. PASS.
- **§9 (plain language):** every string flows through the shipped plain-language maps + the new ban-list-clean copy; no raw classifier key / snake_case reaches the UI (re-asserted by test). PASS.
- **§10a (Observations vs Allegations):** the one node chip is the structural machine **Observation**; the drawer keeps "Machine Observations" / "User Allegations" separate and labelled (never generic "tags"); sensitive composer-only Observations reach neither the node nor the drawer for the target node. PASS.
- **§10 (v1 scope):** no voting/winner, no search, no OAuth, no push, no public API, no realtime body editing. PASS.
- **accessibility-targets:** the chip-adjacent Inspect caret + the AIG triggers keep role=button + label + `accessibilityState` + 44×44 (hitSlop); the halo carries meaning by geometry (grayscale-legible); reduce-motion drops the halo shadow but keeps the stroke; the drawer is dismissible; anchor/excerpt/drawer fit 390px. PASS (plan).
- **expo-rn-patterns:** RN primitives only (`View`/`Text`/`Pressable`); reuses `designTokens` (`GLOW`/`BRAND.accent`/`SURFACE_TOKENS`/`TYPOGRAPHY`); no new dependency; section headers are `<Text accessibilityRole="header">`. PASS.
- **test-discipline:** render + a11y tests (three-question answer, anchor+excerpt, four-section drawer, primary-move match, no-chip-soup, sensitive-boundary, Act-dominant, go-to-parent, 390px, reduce-motion, ban-list) + full mediator/readout regression; test count up; full-suite exit-0 gate. PASS (plan).

---

## §15 Operator steps (if any)

**None — pure code change.** No `db push`, no `functions deploy`, no env var, no migration, no deploy, no netlify-prod. The implement step ships a UI delta (section headers + one promoted field + copy + styling) merged via the normal green-PR path; the single-derivation site picks it up with no operator action.

---

## §16 Open VISUAL / INTERACTION decisions for the operator (each with a designer recommendation)

- **O-1 (halo color — restrained gold vs indigo vs keep cream):** the selected node already wears the cream `GLOW.selectedHalo` ring (+ indigo `GLOW.activePath` glow on active-path nodes). The brief asks for "restrained gold OR indigo halo." Options: (a) **keep cream** (zero token churn, already shipped, reads as "selected"); (b) **gold** (`BRAND.accent.gold` `#C6A15B` — the UX-BRAND-001 restrained accent; "center of the room" warmth); (c) **indigo** (`GLOW.activePath.color` `#a5b4fc` — unifies selected with the active-path system). **Recommendation: (b) restrained gold** for the *selected* node specifically — it makes the center of the room distinct from the indigo "active path" system and is a one-token change to an existing accent (no new hex, ban-list-irrelevant since it is color). Falls back to (a) cleanly. Either way: geometry (ring width 3) carries the signal in grayscale.
- **O-2 (anchor placement — left-rail vs top):** the brief asks "left-rail or top anchor" where composition is anchored. Options: (a) **top anchor** above the node body / in the compact readout (where `parentHint` already renders — minimal move, matches S3 anatomy ② order); (b) **left-rail** beside the node. **Recommendation: (a) top anchor** — it reuses the shipped `TimelineSelectedReadoutPanel` slot (the parent line already renders there), so the excerpt promotion is a one-field addition with no new layout column; a left-rail would force a layout rewrite of the timeline flex tree (broader than this card). 
- **O-3 (which single Act/Inspect/Go action is dominant):** S3 says "Act dominant." Options: (a) **Act dominant** (respond is the most common useful move; matches the design export); (b) context-dependent dominance (Inspect dominant on impasse, etc.). **Recommendation: (a) Act dominant, static** — keeps the dock predictable and matches the export; context-dependent dominance is an enhancement that belongs with UX-NEXT-MOVE-001 / UX-IMPASSE-001. The dominant style is weight/accent only; all three stay ≥44×44 and route unchanged.
- **O-4 (drawer headers — wrapper component vs inline):** add the four section headers via (a) a small new pure presentational wrapper `SelectedNodeInspectDrawer.tsx`, or (b) inline in `ArgumentGameSurface`. **Recommendation: (a)** — matches the shipped "small read-only sibling overlay" pattern (`MediatorNodeInspectDetail`, `MetadataDiffInspector`), is independently testable, and keeps the heavily-pinned surface file from growing presentation logic.
- **O-5 (move lead-in copy):** rename `MediatorNodeInspectDetail`'s shipped `What would help next: <pathway>` to the v4 "Move forward: <pathway>" for vocabulary parity with the 005 rail, or keep it and let the drawer section header carry "Move forward:"? **Recommendation: keep the shipped lead-in; let the section header carry "Move forward:"** (zero test churn on `MediatorNodeInspectDetail.test.tsx`); rename only if the operator wants strict one-vocabulary parity (then update the assertion in lockstep).

---

## §17 Deferrals (named follow-up cards)

- **UX-NEXT-MOVE-001** — the richer multi-chip "what would move it forward" move-suggestion set (this card renders the single board pathway move + a render slot).
- **UX-IMPASSE-001** — any impasse-specific selected-node treatment (this card shows impasse via the shipped chip/helper only).
- **UX-FEEDBACK-001 / UX-RESPONSIVE-V4-001 / UX-ACCESSIBILITY-001** — broad cross-device QA matrix + reduce-motion/VoiceOver/TalkBack sign-off (this card verifies its own 390px + reduce-motion + grayscale paths inline).
- **UX-ROOM-1V1-CHIMEIN-001** — supplies the "chime-in added a source" History data (this card reserves the History render slot; never synthesizes chime-in).

---

## Recommended implement-step scope

Touch **2 files + 0–1 new wrapper + 0–1 optional copy line + 1 new test**:

1. `src/features/arguments/ArgumentGameSurface.tsx` — section-header the four shipped Inspect siblings (rows 6–9) via the O-4 wrapper or inline; Act-dominant styling on the dock (row 10); the "Go to parent point" jump off the anchor.
2. `src/features/arguments/TimelineSelectedReadoutPanel.tsx` — reframe the compact parent line to "Responding to this point" + render the existing `parentBodyPreview` (rows 2–3).
3. (O-4 = a) `src/features/arguments/SelectedNodeInspectDrawer.tsx` (new) — pure read-only section-headed wrapper.
4. (O-5, optional) `src/features/mediator/MediatorNodeInspectDetail.tsx` — "Move forward:" lead-in (lockstep test update).
5. (O-1, only if gold/indigo) `src/lib/designTokens.ts` consumption in `ArgumentTimelineMap.tsx` — select an existing accent token; no new hex.

Plus tests: `__tests__/uxSelectedNode001CenterOfRoom.test.tsx` (+ extend the readout compact + surface wiring tests). Run `npm run typecheck && npm run lint && npm run test` (full suite, exit-0); confirm the mediator + readout + rail suites are green and the test count goes UP. No backend, no migration, no deploy.

---

## Orchestrator-authored brief ledger (POSTRUN-UX001 lesson)

This card's issue (#687) is orchestrator/roadmap-authored, not operator-authored. Where each design decision came from:

- **Prior-Phase framing (operator-validated source-of-truth chain):** the single-derivation invariant, the one-chip + chip-adjacent Inspect caret, the four Inspect siblings, the `v4DisplayStateFor` vocabulary — all from the merged UX-MEDIATOR-001..005 designs + the shipped code.
- **Epic framing:** the v4 selected-node anatomy (S3) + the four-section Inspect drawer (S4) from `CIVILDISCOURSE-V4-UX-OVERHAUL-CARDS.md` L747–812, L1088–1147.
- **Pre-launch codebase survey (this §0 reality audit):** Finding A (drawer already = four mounted siblings), Finding B (`parentBodyPreview` already on the model, only partially surfaced), Finding C (UX-NEXT-MOVE-001 not shipped → reuse the board move), Finding D (halo/dock/chip/caret all shipped).
- **Resolved by orchestrator default (flagged for operator review):** O-1 (halo gold recommendation), O-2 (top-anchor placement), O-3 (Act-dominant), O-4 (wrapper component), O-5 (keep shipped lead-in). The person-name guard (§7 R3 — anchor uses structural identity, never a synthesized name) is an orchestrator interpretation of the doctrine §10a boundary against the design export's illustrative "Maya's claim."
- **Operator-deferred review:** the five O-decisions above; the named deferrals in §17. Post-ship revision (if any) should target these specific interpretations.
