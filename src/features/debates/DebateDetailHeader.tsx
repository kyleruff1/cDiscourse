/**
 * UX-001.2 — Compact room/context strip.
 *
 * Replaces the prior two-row DebateDetailHeader (status row + title + resolution)
 * with a single-row compact strip that meets the UX-001.2 height cap (48 / 56 / 64
 * per band). The strip is the one in-room object allowed above the Timeline by
 * default; the global tab bar is hidden in room-active view (see App.tsx).
 *
 * The strip carries (left → right reading order):
 *   1. Leave-room control (with `accessibilityLabel="Leave argument"` preserved)
 *   2. Title (single line, truncated)
 *   3. Status chip (tablet/wide only)
 *   4. Side chip (tablet/wide only)
 *   5. Private-room badge (when applicable)
 *   6. Timeline / Cards segmented toggle (single source of truth)
 *   7. Overflow trigger `⋯` (opens inline panel with invite + make-private + dev chips
 *      + the GAME-004 seat strip, all of which previously lived in the toolbar / row)
 *
 * The make-private modal and `RoomContractSeatStrip` (GAME-004) are unchanged in
 * behavior — they simply mount inside the overflow inline panel rather than at the
 * top of the header.
 *
 * Doctrine guards preserved verbatim:
 *   - `canTransitionToPrivate({ callerIsModeratorOrAdmin: false })` — OD-1 gate
 *   - `transitionRoomToPrivate` is the only write path (no direct UPDATE)
 *   - `ROOM_VISIBILITY_COPY.error_network` is the user-facing fallback
 *   - Private badge: shape (border + bold weight) carries meaning beyond color
 *   - Every Pressable carries `accessibilityRole="button"` + label + 44px hit
 *     target (via `minHeight` OR `hitSlop`)
 *   - No verdict tokens, no truth labels, no banned copy
 */
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Debate, ParticipantSide } from './types';
import { RoomContractSeatStrip } from './RoomContractSeatStrip';
import type { RoomContractViewModel } from './roomContractModel';
import { ROOM_VISIBILITY_COPY } from '../arguments/gameCopy';
import { canTransitionToPrivate, buildTransitionConsequences } from './roomVisibilityModel';
import { transitionRoomToPrivate } from './debatesApi';
import { MakePrivateConfirmation } from './MakePrivateConfirmation';
import type { PublicRoomSeatMap } from './publicSeatModel';
import { useHeaderBreakpoint, type Band } from '../../hooks/useHeaderBreakpoint';
import type { ArgumentViewMode } from '../arguments/ArgumentTreeScreen';
import { VIEW_MODE_COPY } from '../arguments/viewModeCopy';
import { INVITE_PANEL_COPY } from '../invites/inviteCopy';

interface Props {
  debate: Debate;
  participantSide: ParticipantSide | string | null;
  onLeave: () => void;
  /**
   * GAME-004 — derived 1v1 room contract projection. Renders the seat strip
   * inside the overflow inline panel when supplied.
   */
  roomContract?: RoomContractViewModel;
  /**
   * QOL-039 — caller user id; required for the visibility-transition
   * eligibility check. Without it the `make private` action is hidden.
   */
  currentUserId?: string | null;
  /**
   * QOL-039 — optional GAME-005 seat map; drives the chime-in retention
   * count in the confirmation modal.
   */
  publicRoomSeatMap?: PublicRoomSeatMap | null;
  /**
   * QOL-039 — optional callback fired after a successful transition.
   */
  onVisibilityChanged?: (debateId: string) => void;
  /**
   * UX-001.2 — Timeline/Cards toggle state. Single source of truth lives
   * in MainAppShell; the strip displays it and forwards user changes via
   * `onSetViewMode`. Optional so external callers and tests can mount the
   * header without the toggle.
   */
  viewMode?: ArgumentViewMode;
  /** UX-001.2 — Timeline/Cards toggle callback. */
  onSetViewMode?: (mode: ArgumentViewMode) => void;
  /**
   * UX-001.2 — invite trigger; opens / closes the App.tsx invite panel
   * mount (which already toggles via `inviteOpen`).
   */
  onToggleInvite?: () => void;
  /** UX-001.2 — invite is currently open (drives chevron + label state). */
  inviteOpen?: boolean;
  /**
   * UX-001.2 — dev-only Tree-mode toggle. The chip appears inside the
   * overflow panel when `__DEV__` is true and the prop is supplied.
   */
  onSetDevTreeMode?: () => void;
  /**
   * UX-001.2 — dev-only Tracks-mode toggle. The chip appears inside the
   * overflow panel when `__DEV__` is true and the prop is supplied.
   */
  onSetDevTracksMode?: () => void;
}

const SIDE_LABELS: Record<string, string> = {
  affirmative: 'FOR',
  negative: 'AGAINST',
  observer: 'OBS',
  moderator: 'MOD',
};

interface BandSizing {
  containerPaddingVertical: number;
  rowMinHeight: number;
  titleFontSize: number;
  chipFontSize: number;
  controlHitSlop: number;
  showStatusChip: boolean;
  showSideChip: boolean;
}

function bandSizing(band: Band): BandSizing {
  // The arithmetic below targets the Q10 strip totals:
  //   phone   = paddingVertical*2 + rowMinHeight + 1 (borderBottom) <= 48
  //   tablet  = paddingVertical*2 + rowMinHeight + 1 (borderBottom) <= 56
  //   wide    = paddingVertical*2 + rowMinHeight + 1 (borderBottom) <= 64
  //
  // Each Pressable preserves a 44×44 effective hit target via `hitSlop` even
  // when the visual minHeight is smaller. The chip text is hidden on phone
  // (icon-only) and shows short labels on tablet/wide.
  if (band === 'phone') {
    return {
      containerPaddingVertical: 4,
      rowMinHeight: 36,
      titleFontSize: 13,
      chipFontSize: 10,
      controlHitSlop: 6,
      showStatusChip: false,
      showSideChip: false,
    };
  }
  if (band === 'tablet') {
    return {
      containerPaddingVertical: 6,
      rowMinHeight: 38,
      titleFontSize: 14,
      chipFontSize: 11,
      controlHitSlop: 4,
      showStatusChip: true,
      showSideChip: true,
    };
  }
  // wide
  return {
    containerPaddingVertical: 8,
    rowMinHeight: 42,
    titleFontSize: 15,
    chipFontSize: 12,
    controlHitSlop: 2,
    showStatusChip: true,
    showSideChip: true,
  };
}

export function DebateDetailHeader({
  debate,
  participantSide,
  onLeave,
  roomContract,
  currentUserId,
  publicRoomSeatMap,
  onVisibilityChanged,
  viewMode,
  onSetViewMode,
  onToggleInvite,
  inviteOpen,
  onSetDevTreeMode,
  onSetDevTracksMode,
}: Props) {
  const { band } = useHeaderBreakpoint();
  const sizing = useMemo(() => bandSizing(band), [band]);

  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const eligibility = useMemo(() => {
    if (!currentUserId) {
      return { allowed: false, reason: 'not_room_creator' as const };
    }
    return canTransitionToPrivate({
      roomId: debate.id,
      currentVisibility: debate.visibility,
      roomStatus: debate.status,
      callerUserId: currentUserId,
      createdByUserId: debate.createdBy,
      callerIsModeratorOrAdmin: false,
    });
  }, [currentUserId, debate.id, debate.visibility, debate.status, debate.createdBy]);

  const consequences = useMemo(
    () =>
      buildTransitionConsequences(
        {
          roomId: debate.id,
          currentVisibility: debate.visibility,
          roomStatus: debate.status,
          callerUserId: currentUserId ?? '',
          createdByUserId: debate.createdBy,
          callerIsModeratorOrAdmin: false,
        },
        publicRoomSeatMap ?? null,
      ),
    [debate.id, debate.visibility, debate.status, debate.createdBy, currentUserId, publicRoomSeatMap],
  );

  const handleOpenConfirm = useCallback(() => {
    setErrorMessage(null);
    setConfirming(true);
  }, []);

  const handleCancel = useCallback(() => {
    if (submitting) return;
    setConfirming(false);
  }, [submitting]);

  const handleConfirm = useCallback(async () => {
    setSubmitting(true);
    setErrorMessage(null);
    const res = await transitionRoomToPrivate(debate.id);
    setSubmitting(false);
    if (!res.ok) {
      setErrorMessage(res.error || ROOM_VISIBILITY_COPY.error_network);
      return;
    }
    setConfirming(false);
    onVisibilityChanged?.(debate.id);
  }, [debate.id, onVisibilityChanged]);

  const showMakePrivate = eligibility.allowed && debate.visibility === 'public';
  const showPrivateBadge = debate.visibility === 'private';
  const showToggle = Boolean(viewMode && onSetViewMode);
  const showOverflow = Boolean(onToggleInvite) || showMakePrivate || (__DEV__ && (onSetDevTreeMode || onSetDevTracksMode));
  const sideLabel = participantSide ? SIDE_LABELS[participantSide] || null : null;

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        paddingVertical: sizing.containerPaddingVertical,
      },
    ],
    [sizing.containerPaddingVertical],
  );

  const rowStyle = useMemo(
    () => [styles.row, { minHeight: sizing.rowMinHeight }],
    [sizing.rowMinHeight],
  );

  const titleStyle = useMemo(
    () => [styles.title, { fontSize: sizing.titleFontSize }],
    [sizing.titleFontSize],
  );

  return (
    <View style={containerStyle} testID="debate-detail-header">
      <View style={rowStyle}>
        <Pressable
          onPress={onLeave}
          style={styles.leaveButton}
          accessibilityRole="button"
          accessibilityLabel="Leave argument"
          hitSlop={{ top: sizing.controlHitSlop + 6, bottom: sizing.controlHitSlop + 6, left: sizing.controlHitSlop + 6, right: sizing.controlHitSlop + 6 }}
          testID="debate-detail-leave"
        >
          <Text style={[styles.leaveGlyph, { fontSize: sizing.chipFontSize + 2 }]}>‹</Text>
          {band !== 'phone' ? (
            <Text style={[styles.leaveText, { fontSize: sizing.chipFontSize }]}>Leave</Text>
          ) : null}
        </Pressable>
        <Text
          style={titleStyle}
          numberOfLines={1}
          ellipsizeMode="tail"
          testID="debate-detail-title"
        >
          {debate.title}
        </Text>
        {sizing.showStatusChip ? (
          <View
            style={styles.statusChip}
            testID="debate-detail-status-chip"
            accessibilityLabel={`Room status ${debate.status}`}
          >
            <Text style={[styles.statusChipText, { fontSize: sizing.chipFontSize }]}>
              {debate.status.toUpperCase()}
            </Text>
          </View>
        ) : null}
        {sizing.showSideChip && sideLabel ? (
          <View
            style={styles.sideChip}
            testID="debate-detail-side-chip"
            accessibilityLabel={`Your side ${sideLabel}`}
          >
            <Text style={[styles.sideChipText, { fontSize: sizing.chipFontSize }]}>{sideLabel}</Text>
          </View>
        ) : null}
        {showPrivateBadge ? (
          <View
            style={styles.privateBadge}
            accessibilityLabel={ROOM_VISIBILITY_COPY.badge_private_a11y}
            testID="debate-private-badge"
          >
            <Text style={[styles.privateBadgeText, { fontSize: sizing.chipFontSize }]}>
              {band === 'phone' ? 'P' : ROOM_VISIBILITY_COPY.badge_private}
            </Text>
          </View>
        ) : null}
        {showToggle ? (
          <View style={styles.toggleGroup}>
            <Pressable
              onPress={() => onSetViewMode?.('timeline')}
              style={[styles.toggleChip, viewMode === 'timeline' && styles.toggleChipActive]}
              accessibilityRole="button"
              accessibilityLabel={VIEW_MODE_COPY.timeline.accessibilityLabel}
              accessibilityHint={VIEW_MODE_COPY.timeline.accessibilityHint}
              accessibilityState={{ selected: viewMode === 'timeline' }}
              hitSlop={{ top: sizing.controlHitSlop + 6, bottom: sizing.controlHitSlop + 6, left: sizing.controlHitSlop + 4, right: sizing.controlHitSlop + 4 }}
              testID="debate-detail-toggle-timeline"
            >
              <Text style={[styles.toggleChipText, viewMode === 'timeline' && styles.toggleChipTextActive, { fontSize: sizing.chipFontSize }]}>
                {VIEW_MODE_COPY.timeline.label}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onSetViewMode?.('stack')}
              style={[styles.toggleChip, viewMode === 'stack' && styles.toggleChipActive]}
              accessibilityRole="button"
              accessibilityLabel={VIEW_MODE_COPY.cards.accessibilityLabel}
              accessibilityHint={VIEW_MODE_COPY.cards.accessibilityHint}
              accessibilityState={{ selected: viewMode === 'stack' }}
              hitSlop={{ top: sizing.controlHitSlop + 6, bottom: sizing.controlHitSlop + 6, left: sizing.controlHitSlop + 4, right: sizing.controlHitSlop + 4 }}
              testID="debate-detail-toggle-cards"
            >
              <Text style={[styles.toggleChipText, viewMode === 'stack' && styles.toggleChipTextActive, { fontSize: sizing.chipFontSize }]}>
                {VIEW_MODE_COPY.cards.label}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {showOverflow ? (
          <Pressable
            onPress={() => setOverflowOpen((v) => !v)}
            style={styles.overflowButton}
            accessibilityRole="button"
            accessibilityLabel="More room options"
            accessibilityState={{ expanded: overflowOpen }}
            hitSlop={{ top: sizing.controlHitSlop + 6, bottom: sizing.controlHitSlop + 6, left: sizing.controlHitSlop + 6, right: sizing.controlHitSlop + 6 }}
            testID="debate-detail-overflow-trigger"
          >
            <Text style={[styles.overflowGlyph, { fontSize: sizing.chipFontSize + 2 }]}>⋯</Text>
          </Pressable>
        ) : null}
      </View>
      {errorMessage ? (
        <Text style={styles.errorText} testID="debate-make-private-error">
          {errorMessage}
        </Text>
      ) : null}
      {overflowOpen ? (
        <View style={styles.overflowPanel} testID="debate-detail-overflow-panel">
          {onToggleInvite ? (
            <Pressable
              onPress={() => onToggleInvite?.()}
              style={styles.overflowRow}
              accessibilityRole="button"
              accessibilityLabel={INVITE_PANEL_COPY.toolbarChipAccessibility}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              testID="debate-detail-overflow-invite"
            >
              <Text style={styles.overflowRowText}>
                {inviteOpen ? 'Close invite' : INVITE_PANEL_COPY.toolbarChipLabel}
              </Text>
            </Pressable>
          ) : null}
          {showMakePrivate ? (
            <Pressable
              onPress={handleOpenConfirm}
              style={styles.overflowRow}
              accessibilityRole="button"
              accessibilityLabel={ROOM_VISIBILITY_COPY.action_make_private_label}
              accessibilityHint={ROOM_VISIBILITY_COPY.action_make_private_hint}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              testID="debate-make-private-action"
            >
              <Text style={styles.overflowRowText}>
                {ROOM_VISIBILITY_COPY.action_make_private_label}
              </Text>
            </Pressable>
          ) : null}
          {__DEV__ && onSetDevTreeMode ? (
            <Pressable
              onPress={() => onSetDevTreeMode?.()}
              style={styles.overflowRow}
              accessibilityRole="button"
              accessibilityLabel="Tree view (dev)"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              testID="debate-detail-overflow-tree-dev"
            >
              <Text style={styles.overflowRowText}>Thread (dev)</Text>
            </Pressable>
          ) : null}
          {__DEV__ && onSetDevTracksMode ? (
            <Pressable
              onPress={() => onSetDevTracksMode?.()}
              style={styles.overflowRow}
              accessibilityRole="button"
              accessibilityLabel="Tracks lane view (dev)"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              testID="debate-detail-overflow-tracks-dev"
            >
              <Text style={styles.overflowRowText}>Tracks (dev)</Text>
            </Pressable>
          ) : null}
          {roomContract ? (
            <View style={styles.overflowSeatStrip}>
              <RoomContractSeatStrip viewModel={roomContract} />
            </View>
          ) : null}
        </View>
      ) : null}
      <MakePrivateConfirmation
        visible={confirming}
        consequences={consequences}
        submitting={submitting}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // UX-001.2 — compact strip surface. paddingVertical is band-aware (set
  // inline above). borderBottomWidth: 1 + paddingVertical*2 + rowMinHeight
  // fits within 48/56/64 per band.
  container: {
    backgroundColor: '#0b1220',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    minHeight: 36,
    justifyContent: 'center',
  },
  leaveGlyph: { color: '#fca5a5', fontWeight: '700' },
  leaveText: { color: '#fca5a5', fontWeight: '600' },
  title: {
    flex: 1,
    color: '#f8fafc',
    fontWeight: '700',
  },
  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusChipText: {
    color: '#cbd5e1',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sideChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
  },
  sideChipText: {
    color: '#e2e8f0',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  privateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#94a3b8',
    backgroundColor: '#1e293b',
  },
  privateBadgeText: {
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#f8fafc',
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 2,
  },
  toggleChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#1f2937',
  },
  toggleChipActive: { backgroundColor: '#312e81' },
  toggleChipText: { color: '#94a3b8', fontWeight: '600' },
  toggleChipTextActive: { color: '#e2e8f0', fontWeight: '700' },
  overflowButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1f2937',
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowGlyph: { color: '#e2e8f0', fontWeight: '700' },
  overflowPanel: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    gap: 4,
  },
  overflowRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
  },
  overflowRowText: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 12,
  },
  overflowSeatStrip: {
    marginTop: 4,
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#fca5a5',
  },
});
