/**
 * QOL-033 — GoPopout: the navigate-and-re-view popout.
 *
 * The third popout that stands on the QOL-030 chassis (`Popout` /
 * `PopoutGroup` / `PopoutEntry`), beside Act (QOL-031) and Inspect
 * (QOL-032). The Go popout is the *traverse / re-view* surface — it moves
 * the viewport and reconfigures the board's render mode (QOL-033 design
 * §1 / §3).
 *
 * Unlike Act and Inspect, Go is NOT anchored to a node — it is about the
 * whole board, anchored to a fixed board corner (design §3.1). It opens
 * fast, never hides the board, dismisses on `Esc` / scrim / selection.
 *
 * Layout (design §5 wireframe):
 *  - Four control groups via `buildGoPopout` → `PopoutGroup` rows:
 *    Jump · View · Density · Lens.
 *  - The embedded IX-002 `TimelineMiniMap` strip, rendered READ-ONLY below
 *    the controls when the conversation is long enough (design §3.4 / §6).
 *
 * Doctrine / accessibility (QOL-033 design §8, cdiscourse-doctrine,
 * accessibility-targets):
 *  - Go performs NO write and NO content mutation — every handler only
 *    reconfigures the viewport or the render mode. The component imports no
 *    Supabase, no network, no AI.
 *  - A lens DIMS, never hides — `onSelectLens` sets a `GoLens`; the dimming
 *    is IX-001's `applyTimelineLens`, which can never remove a node.
 *  - "Hot zone" is an ACTIVITY signal — the mini-map + the Go label both
 *    frame it as activity, never a result.
 *  - The mini-map is a PROJECTION — `GoPopout` consumes the already-built
 *    `TimelineMiniMapModel`; it re-derives nothing (IX-002's locked
 *    doctrine).
 *  - Every row is a ≥ 44×44 `Pressable` with a role + label (the chassis
 *    `PopoutEntry` enforces this).
 *
 * Presentational only — the pure logic is `goPopoutModel.ts`.
 */
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SURFACE_TOKENS, SPACING } from '../../../lib/designTokens';
import type {
  MiniMapJumpRequest,
  MiniMapViewportWindow,
  TimelineMiniMapModel,
} from '../timelineMiniMapModel';
import { TimelineMiniMap } from '../TimelineMiniMap';
import type { GalleryDensityMode } from '../timelineDensityLensModel';
import type { BoxView } from './boxModel';
import { Popout } from './Popout';
import { PopoutGroup, type PopoutGroupEntry } from './PopoutGroup';
import {
  buildGoPopout,
  getGoLensCopy,
  goEntryToDensityMode,
  goEntryToJumpTarget,
  goEntryToLens,
  goEntryToView,
  showsEmbeddedMiniMap,
  type GoEntryId,
  type GoEntryKind,
  type GoJumpTarget,
  type GoLens,
} from './goPopoutModel';

// ── Props ──────────────────────────────────────────────────────

export interface GoPopoutProps {
  /** Drives mount + the flash animation. */
  visible: boolean;
  /** Close the Go popout — bound to the close control, scrim, Esc, back. */
  onClose: () => void;
  /**
   * The IX-002 mini-map model — consumed READ-ONLY. Drives the Jump entries'
   * enabled state and the embedded mini-map strip.
   */
  miniMap: TimelineMiniMapModel;
  /**
   * The slice of the conversation visible in the MAIN timeline (IX-002's
   * `buildViewportWindow` output). Passed straight to the embedded mini-map.
   */
  viewportWindow: MiniMapViewportWindow;
  /** The currently-active board view (Timeline / Cards). */
  view: BoxView;
  /** The currently-active IX-001 density mode. */
  density: GalleryDensityMode;
  /** The currently-active Go focus lens. */
  lens: GoLens;
  /**
   * Fired for a Jump entry — the host pans / focuses the board. NO route
   * transition (design §3.2). `branch_list` opens a branch sub-picker; the
   * host decides how (the §5 wireframe shows a nested list).
   */
  onJump: (target: GoJumpTarget) => void;
  /** Fired when a mini-map region / chip / marker is tapped — pans the board. */
  onMiniMapJump: (request: MiniMapJumpRequest) => void;
  /** Fired continuously while the mini-map viewport window is dragged. */
  onScrubViewport?: (centreFraction: number) => void;
  /** Fired for a View entry — switches Timeline ⇄ Cards (presentation only). */
  onSelectView: (view: BoxView) => void;
  /** Fired for a Density entry — sets the IX-001 density (timeline-only). */
  onSelectDensity: (density: GalleryDensityMode) => void;
  /**
   * Fired for a Lens entry — sets the active `GoLens`. The lens DIMS,
   * never hides; the host applies `applyTimelineLens` / `activePathLens`.
   * Tapping the already-active lens clears it back to `none` (a toggle).
   */
  onSelectLens: (lens: GoLens) => void;
  /** PR-001 effective reduce-motion — threaded into the chassis + mini-map. */
  reduceMotionOverride?: boolean;
  /** testID passthrough for the popout root. */
  testID?: string;
}

// ── Entry-kind → chassis kind ──────────────────────────────────

/**
 * Map a `GoEntryKind` onto the chassis `PopoutEntryKind`. Every Go entry
 * navigates / re-views — none composes or writes — so the jump entries are
 * `navigate` and the view / density / lens entries are `direct` (a direct
 * render-mode toggle, no box opens).
 */
function goEntryKindToChassisKind(
  kind: GoEntryKind,
): PopoutGroupEntry['kind'] {
  return kind === 'jump' ? 'navigate' : 'direct';
}

// ── Component ──────────────────────────────────────────────────

/**
 * The Go popout — four control groups on the QOL-030 chassis plus the
 * embedded IX-002 mini-map strip.
 */
export function GoPopout({
  visible,
  onClose,
  miniMap,
  viewportWindow,
  view,
  density,
  lens,
  onJump,
  onMiniMapJump,
  onScrubViewport,
  onSelectView,
  onSelectDensity,
  onSelectLens,
  reduceMotionOverride,
  testID,
}: GoPopoutProps) {
  // The four control groups — `buildGoPopout` resolves each entry's active
  // + disabled state against the current view / density / lens / mini-map.
  const goGroups = useMemo(
    () => buildGoPopout({ miniMap, view, density, lens }),
    [miniMap, view, density, lens],
  );

  /**
   * Handle a Go-entry selection. Each entry only reconfigures the viewport
   * or the render mode — Go performs no write (design §8). A disabled entry
   * never reaches here (the chassis `PopoutEntry` blocks its press).
   */
  const handleEntry = useCallback(
    (entryId: GoEntryId, kind: GoEntryKind) => {
      switch (kind) {
        case 'jump': {
          const target = goEntryToJumpTarget(entryId);
          if (target !== null) {
            onJump(target);
            // A jump is a one-shot navigation — dismiss on selection
            // (design §3.1 "dismisses on … selection"). `branch_list`
            // opens a sub-picker; the host keeps it open if it wants.
            if (target !== 'branch_list') onClose();
          }
          return;
        }
        case 'view_toggle': {
          const nextView = goEntryToView(entryId);
          if (nextView !== null) onSelectView(nextView);
          return;
        }
        case 'density': {
          const nextDensity = goEntryToDensityMode(entryId);
          if (nextDensity !== null) onSelectDensity(nextDensity);
          return;
        }
        case 'lens': {
          const nextLens = goEntryToLens(entryId);
          if (nextLens !== null) {
            // Tapping the active lens toggles it off — back to `none`
            // (the unfiltered baseline; the board stops dimming).
            onSelectLens(nextLens === lens ? 'none' : nextLens);
          }
          return;
        }
        default: {
          // Exhaustiveness guard — unreachable for the typed union.
          const never: never = kind;
          return never;
        }
      }
    },
    [lens, onClose, onJump, onSelectDensity, onSelectLens, onSelectView],
  );

  // Map the model groups onto the chassis `PopoutGroup` shape.
  const popoutGroups = useMemo(
    () =>
      goGroups.map((group) => ({
        id: group.id,
        label: group.label,
        entries: group.entries.map<PopoutGroupEntry>((entry) => ({
          key: entry.id,
          label: entry.label,
          accessibilityLabel: entry.accessibilityLabel,
          kind: goEntryKindToChassisKind(entry.kind),
          keyBadge: entry.keyBadge,
          // The active View / Density / Lens entry is emphasized — it reuses
          // the chassis `isPromoted` styling (a raised surface + heavier
          // text + a leading marker) to read as "currently selected".
          isPromoted: entry.isActive,
          isDisabled: entry.isDisabled,
          disabledReason: entry.disabledReason,
          onPress: () => handleEntry(entry.id, entry.kind),
        })),
      })),
    [goGroups, handleEntry],
  );

  // The lens helper line — shown under the Lens group so the user always
  // sees what the active lens does (and that it dims, never hides).
  const lensCopy = useMemo(() => getGoLensCopy(lens), [lens]);

  // Whether the embedded mini-map strip renders (IX-002's node threshold).
  const showMiniMap = showsEmbeddedMiniMap(miniMap);

  return (
    <Popout
      visible={visible}
      title="Go"
      onClose={onClose}
      reduceMotionOverride={reduceMotionOverride}
      testID={testID ?? 'one-box-go-popout'}
    >
      {/* ── The four control groups — Jump · View · Density · Lens. ── */}
      {popoutGroups.map((group) => (
        <View key={group.id}>
          <PopoutGroup
            label={group.label}
            entries={group.entries}
            showHeader
            testID={`go-popout-group-${group.id}`}
          />
          {/* The Lens group carries a one-line helper: what the active lens
              does, and the doctrine that it dims (never hides). */}
          {group.id === 'lens' ? (
            <Text style={styles.lensHelper} testID="go-popout-lens-helper">
              {lens === 'none'
                ? `${lensCopy.helper} A lens dims other moves — it never hides them.`
                : `${lensCopy.helper} Dimmed moves stay fully navigable.`}
            </Text>
          ) : null}
        </View>
      ))}

      {/* ── The embedded IX-002 mini-map — a one-strip board overview.
          Consumed READ-ONLY: GoPopout passes the already-built model
          straight through; the mini-map re-derives nothing. Below IX-002's
          node threshold the strip renders nothing (design §6). ── */}
      {showMiniMap ? (
        <View style={styles.miniMapWrap} testID="go-popout-mini-map-wrap">
          <TimelineMiniMap
            model={miniMap}
            viewportWindow={viewportWindow}
            onJump={onMiniMapJump}
            onScrubViewport={onScrubViewport}
            reduceMotion={reduceMotionOverride}
            initiallyExpanded
          />
        </View>
      ) : (
        // The §6 short-argument case — the strip is omitted, but a one-line
        // note keeps the popout from looking truncated.
        <Text style={styles.miniMapNote} testID="go-popout-mini-map-note">
          The overview map appears once the conversation grows longer.
        </Text>
      )}
    </Popout>
  );
}

const styles = StyleSheet.create({
  lensHelper: {
    fontSize: 12,
    color: SURFACE_TOKENS.textMuted,
    paddingHorizontal: SPACING.m,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.s,
  },
  miniMapWrap: {
    marginTop: SPACING.s,
    borderTopWidth: 1,
    borderTopColor: SURFACE_TOKENS.border,
  },
  miniMapNote: {
    fontSize: 12,
    color: SURFACE_TOKENS.textMuted,
    paddingHorizontal: SPACING.m,
    paddingTop: SPACING.s,
    paddingBottom: SPACING.xs,
  },
});
