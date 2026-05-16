# CDiscourse — Argument Timeline / Track View

_Stage 6.1.0 — 2026-05-16_

## Concept

The Argument Room displays argument history as a **timeline/track view**, similar to a DAW (Digital Audio Workstation) track layout.

Arguments are assigned to **lanes** based on their type and flags:

| Lane | Argument types | Color |
|---|---|---|
| Core | thesis, claim | Indigo (#6366f1) |
| Counters | rebuttal, counter_rebuttal | Red (#ef4444) |
| Receipts | evidence | Green (#10b981) |
| Clarifications | clarification_request | Amber (#f59e0b) |
| Concessions | concession, synthesis | Purple (#8b5cf6) |
| Tangents | off-track or weak-topic arguments | Gray (#6b7280) |

---

## Track Kind Mapping

| ArgumentType | TrackKind | Notes |
|---|---|---|
| thesis | core | |
| claim | core | |
| rebuttal | counter | |
| counter_rebuttal | counter | |
| evidence | receipts | |
| clarification_request | clarification | |
| concession | concession | |
| synthesis | concession | May be core if anchored to root |
| (any with off_track flag) | tangent | Overrides type-based lane |
| (any with weak topic + depth > 1) | tangent | |

---

## UI Components

### ArgumentTimelineScreen
- Wraps the pure `buildArgumentTimeline` model
- Shows a lane-per-track layout
- Toggle: "Active lanes only" vs "All lanes"
- Empty state: "No arguments yet. Start one."

### ArgumentTrack
- Single collapsible lane section
- Header: lane label + count chip + expand/collapse toggle
- Core and Counter lanes are expanded by default
- Other lanes start collapsed

### ArgumentTimelineNode
- Compact card per argument
- Left accent bar = lane color
- Shows: label (type + body excerpt), branch badge if off-track
- Selected node shows full status

---

## Switching Views

`ArgumentTreeScreen` accepts `viewMode?: 'tree' | 'timeline'`:
- When `viewMode === 'timeline'`, renders `ArgumentTimelineScreen` with the internal cache
- When `viewMode === 'tree'` (default), renders the existing nested tree
- Switching preserves the loaded cache (single `useArgumentViewport` instance)

The user-facing toggle in the app toolbar is labeled **Thread** (tree) and **Tracks** (timeline).

---

## What Is Not Implemented

- No canvas or SVG rendering.
- No actual waveform visualization.
- No audio tracks.
- No horizontal scrolling timeline (vertical stacked sections used instead).
- No argument drag-and-drop.

---

## Source Files

- `src/features/arguments/argumentTimeline.ts` — pure model
- `src/features/arguments/ArgumentTimelineScreen.tsx` — view
- `src/features/arguments/ArgumentTrack.tsx` — single lane component
- `src/features/arguments/ArgumentTimelineNode.tsx` — argument card
