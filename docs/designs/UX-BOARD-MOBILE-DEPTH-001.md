# UX-BOARD-MOBILE-DEPTH-001 — Mobile board reading-depth audit (390px)

**Issue:** #758 — *Mobile board reading-depth audit — taps/scrolls to read a full point at 390px.*
**Type:** Measured reading-depth audit (docs) + a bundled surface-local UI fix + tests. UI surface-local; no backend mutation (GATE-C: No).
**Surfaces read (read-only, `main`):** `src/features/arguments/RoomBoardLayout.tsx`, `TimelineSelectedReadoutPanel.tsx`, `timelineSelectedReadoutModel.ts`, `ArgumentReplySidecar.tsx`, `argumentReplySidecarModel.ts`, `ArgumentTimelineMap.tsx`, `BoardBottomChrome.tsx`, `ArgumentGameSurface.tsx` (mount sites), `src/features/mediator/DisagreementPointsRail.tsx`, `MediatorProgressNote.tsx`, `src/hooks/useHeaderBreakpoint.ts`.
**Doctrine:** high-trust MEDIATOR board. This audit measures interaction COST and truncation; it introduces no verdict / winner / loser / truth / score / heat / popularity / person-judgment, no new semantics, no topology change.

---

## 0. Why this audit exists

#691 assigns columns/panes per breakpoint and UX-BOARD-READABILITY-001 (#719, merged) did a one-time type-hierarchy/density polish, but **neither measures the interaction cost of reading a complete point on mobile.** The design's mobile loop is progressive disclosure; done badly, progressive disclosure buries load-bearing body text behind taps and clips it with `numberOfLines`. This document is the missing measurement: per reading step at 390px, the tap count, the scroll count, and any **truncation dead-end** (clamped text with no way to read the rest).

All measurements are read off the **phone band** render path. `resolveBand(390) === 'phone'` (`useHeaderBreakpoint.ts:70-75`), so `RoomBoardLayout` returns the single-column vertical stack (`RoomBoardLayout.tsx:80-96`): `topBanner → col1 (timeline) → col2 (readout + note + score + chips + composer) → col2Footer (Act/Inspect/Go) → col3 (Disagreement Points, collapsed sheet) → bottomChrome → overlays`.

---

## 1. The three reading depths (what a reader is trying to read)

The card names three reading depths. A "full point" is: **root claim → selected-node body (full) → parent excerpt → one mediator state → mediator note.**

1. **Argument path** — what nodes exist and the root claim.
2. **Selected point** — the selected node's own body in full, its parent context, its mediator state.
3. **Unresolved points + next move** — the live disagreement points and the suggested next step.

---

## 2. Measured baseline — taps / scrolls per step at 390px

Conventions: a **tap** is a discrete `Pressable` press; a **scroll** is one gesture in a scroll container. "From entry" assumes the room just opened with the default selection (latest or root). Counts cite the exact component lines.

### Step 1 — Argument path / root claim

| Sub-step | Affordance | Taps | Scrolls | Notes |
|---|---|---|---|---|
| See the node sequence | `ArgumentTimelineMap` horizontal `ScrollView` (`ArgumentTimelineMap.tsx:1124`); one `Pressable` per node (`:346-380`) | 0 | 0–1 (horizontal, only if a node is off-screen) | Nodes are a single horizontal rail; the rail is structure, not a feed. |
| Read the root claim's body | Tap the root node → `onNodeTap` activates it → readout panel re-renders with root as subject (`:351`) | 0–1 | 0 | 0 taps when root is the default selection at entry; 1 tap otherwise. Then proceed to Step 2 to read the body. |

**Step 1 cost:** 0–1 tap, 0–1 horizontal scroll. **No dead-end** — every node is reachable on the rail.

### Step 2 — Selected point (body full · parent · state) — *the hot path*

| Sub-step | Affordance | Taps | Scrolls | Notes |
|---|---|---|---|---|
| Body, first 2 lines | Compact `bodyLine`, `numberOfLines={2}` + `ellipsizeMode="tail"` (`TimelineSelectedReadoutPanel.tsx:193`) | 0 | 0 | Visible immediately; UX-BOARD-READABILITY-001 raised this 1→2 lines, 11→13px. |
| Parent excerpt (≤120 chars) | Compact `parentExcerptLine`, `numberOfLines={2}` (`:216`), capped at `PARENT_BODY_PREVIEW_CAP` | 0 | 0 | Visible in the "Responding to this point" anchor. |
| Expand to detail | "Show full details ▾" `Pressable` (`:249-261`) opens the sidecar inline, host capped at `max(160, 30% viewport)` (`:264`) | 1 | 0 | Affordance EXISTS — the compact panel is not a dead-end. |
| Body beyond 2 lines | Sidecar `WhatThisMoveSays` body `<Text style={styles.body}>` — **no `numberOfLines` clamp** (`ArgumentReplySidecar.tsx:120`) | 0 | 0–1 (inner, within the 30%/360px host) | BUT renders `section.bodyExcerpt`, truncated to **280 chars** + `…` (`argumentReplySidecarModel.ts:268,371`). |
| Body **beyond 280 chars** | — none — | **∞** | **∞** | **TRUNCATION DEAD-END.** No affordance reveals the rest of the body. |
| Mediator state ("Why it matters") | Sidecar `WhyItMatters` section, visible after the same expand (`ArgumentReplySidecar.tsx:147-154`) | 0 | 0–1 | Reachable inside the already-opened sidecar. |

**Step 2 cost (body ≤ 280 chars):** 1 tap + up to 1 inner scroll → full point readable.
**Step 2 cost (body > 280 chars):** the full body is **unreachable**. This is the audit's primary finding.

### Step 3 — Unresolved points + next move

| Sub-step | Affordance | Taps | Scrolls | Notes |
|---|---|---|---|---|
| Mediator note | `MediatorProgressNote` renders directly below the panel; static `<Text>`, wraps, never overflows (`MediatorProgressNote.tsx:80-81`) | 0 | 0–1 (vertical, if below the fold) | Non-interactive by design (no tap-to-rate). |
| Open the points list | `DisagreementPointsRail` collapsed pill on phone (`presentation='sheet'`, collapsed by default, `DisagreementPointsRail.tsx:176-178`) → tap toggle (`:381`) | 1 | 0 | Bottom sheet, height-capped (`resolveSheetMaxHeightPx`). |
| Read a point's next step | Row's "Move forward: …" line, `numberOfLines={2}` (`:671-675`) | 0 | 0–1 (within the rail's own `ScrollView`, `:488`) | Each row is read-only; the only verb is the "View in timeline →" jump. |
| Reveal points past the initial cap | "+N more points" overflow `Pressable` (`:516-527`) | 0–1 | 0–1 | Only when live points exceed `DISAGREEMENT_POINTS_RAIL_INITIAL_ROWS`. |
| Jump to a point's node | Row press → `onJump(anchor.nodeId)` (`:638-640`) → returns to Step 2 for that node | 1 | 0 | Read-only navigation. |

**Step 3 cost:** 1 tap to open the sheet; +1 for overflow; the next-step guidance lines are 2-line clamped but each is a complete actionable phrase (not a truncated body), so **no dead-end** — the load-bearing guidance is fully shown.

---

## 3. Findings

**F-1 (the one true dead-end — load-bearing).** The selected-node body is reachable in 1 tap to the sidecar, but the sidecar renders the **280-char excerpt** (`bodyExcerpt`), not the full body. For a body > 280 chars the remainder is unreachable at 390px. The model already exposes `isTruncated` + `fullBodyLength` and explicitly documents `fullBodyLength` as being "for an optional 'show full body' affordance" (`argumentReplySidecarModel.ts:111-113`), and the redacted **full** body is already in hand as `rawBody = viewModel.body ?? ''` (`:366`). The affordance was scaffolded but never wired. This is the card's "clamped body with no expand affordance" dead-end.

**F-2 (not a dead-end — affordance present).** The compact panel's 2-line `bodyLine` clamp is paired with the "Show full details" expand trigger (`TimelineSelectedReadoutPanel.tsx:193,249`). The first clamp is intentional progressive disclosure with a working escape hatch; no fix needed.

**F-3 (not a dead-end).** The parent excerpt (≤120 chars), the per-point "Move forward" line (2 lines), and the evidence lines are bounded *summaries / complete phrases*, not truncated bodies. Reading the parent's full body is an explicit navigation ("Go to parent point →", `:226`) that re-runs Step 2 for the parent — by design, one point at a time.

**F-4 (depth is acceptable elsewhere).** The hot reading path (root claim → selected body → parent → state → note) is **0–1 + 1 = ≤ 2 taps** for a body ≤ 280 chars, with at most 2 short scrolls (one horizontal on the rail, one vertical to the note). Only F-1 pushes the path to unbounded.

**F-5 (no overflow risk surfaced).** All compact/sidecar/rail text wraps or scrolls inside bounded containers (`MediatorProgressNote.tsx:80-81` notes the 390px no-overflow intent; the sidecar caps at `maxHeight:360`, `ArgumentReplySidecar.tsx:249`; the expanded host caps at 30% viewport). No surface measured here introduces a horizontal-overflow class like the masthead-logo precedent (`resolveMastheadLogoHeightPx`).

---

## 4. Targeted fix (before / after)

**Fix F-1 — Show-full-body toggle inside the sidecar.** Carry the redacted full body on the view-model (`bodyFull`, additive) and, when `section.isTruncated`, render a read-only "Show full body / Show less" `Pressable` modeled byte-for-byte on the in-file SemanticFlags "Show details" toggle (`ArgumentReplySidecar.tsx:204-239`). The 280-char `bodyExcerpt` cap, `isTruncated`, `fullBodyLength`, and `truncateAtWordBoundary` are unchanged (their tests stay green). No `TextInput` / `editable` / `onChangeText` / action callback is added — it is a disclosure toggle, not an edit/action/submit (the SC-003↔SC-004 boundary scans stay clean).

| Reading step | Before (taps to full body) | After (taps to full body) |
|---|---|---|
| Body ≤ 280 chars | 1 (Show full details) | 1 (unchanged) |
| Body > 280 chars | **unbounded — dead-end** | **2** (Show full details → Show full body) |

Touch targets: the toggle inherits `SHOW_DETAILS_HIT_SLOP` (8px each side) + the `showDetailsButton` `minHeight:28` (`ArgumentReplySidecar.tsx:36,323-329`) → ≥44 effective, matching the budget the existing flags toggle already passes.

No fix is taken for F-2/F-3/F-4/F-5 — they already meet the disclosure intent and changing them would risk the #691 breakpoint system or the #683 derivation, both explicit non-goals.

---

## 5. Acceptance mapping (#758)

- *Measured reading-depth baseline doc with before/after* → §2 (per-step taps/scrolls cited from components) + §4 (before/after table). ✓
- *Full selected-node body reachable at 390px with no truncation dead-end* → §4 fix closes F-1 (the only dead-end). ✓
- *No 390px overflow regression; touch targets ≥44* → §3 F-5 (bounded containers, no new width math) + §4 (toggle inherits the ≥44 budget); regression re-asserted via the existing masthead-guard precedent (`appHeaderResponsiveLogo.test.ts`) and the sidecar/host caps. ✓
- *Tests assert the body-expand affordance renders when clamped + the reading path passes the depth target* → see the bundled test spec on the issue (model: `bodyFull` reachable on truncation; component: `sidecar-show-full-body` gated on `isTruncated`; depth target = 2 taps to the full body). ✓

---

## 6. Doctrine + boundary attestation

- Reading/disclosure only. No verdict / score / winner / loser / AI-judge / red-green / likes-heat / person-judgment introduced. Unknown/insufficient stays unknown; disclosure never upgrades a state's claim. The mediator note stays advisory.
- Does NOT change room/seat/chime-in/submission semantics, the #691 breakpoint/column system, or the #683 mediator derivation/markup.
- No copied reference slogans; no new user-facing copy beyond the plain "Show full body" / "Show less" toggle labels (which pass the ban-list / snake_case scan).
- NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy · NO dependency install · NO app.json change.
