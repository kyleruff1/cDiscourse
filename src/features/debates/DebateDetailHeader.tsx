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

interface Props {
  debate: Debate;
  participantSide: ParticipantSide | string | null;
  onLeave: () => void;
  /**
   * GAME-004 — the derived 1v1 room contract projection. Optional: when
   * absent the header renders exactly as before (zero behavior change for any
   * caller that does not pass it).
   */
  roomContract?: RoomContractViewModel;
  /**
   * QOL-039 — caller user id; required for the visibility-transition
   * eligibility check. Optional so existing callers continue to work; if
   * absent, the `make private` action is hidden.
   */
  currentUserId?: string | null;
  /**
   * QOL-039 — optional GAME-005 seat map; drives the chime-in retention
   * count in the confirmation modal. If absent, the count is 0 and the
   * generic bullet renders.
   */
  publicRoomSeatMap?: PublicRoomSeatMap | null;
  /**
   * QOL-039 — optional callback fired after a successful transition. The
   * host typically refreshes the room so the badge appears and any gallery
   * lists drop the room for non-participants.
   */
  onVisibilityChanged?: (debateId: string) => void;
}

const SIDE_COLORS: Record<string, { bg: string; text: string }> = {
  affirmative: { bg: '#dcfce7', text: '#166534' },
  negative: { bg: '#fee2e2', text: '#991b1b' },
  observer: { bg: '#f3f4f6', text: '#374151' },
  moderator: { bg: '#ede9fe', text: '#5b21b6' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: '#d1fae5', text: '#065f46' },
  draft: { bg: '#fef3c7', text: '#92400e' },
  locked: { bg: '#fee2e2', text: '#991b1b' },
  archived: { bg: '#f3f4f6', text: '#6b7280' },
};

export function DebateDetailHeader({
  debate,
  participantSide,
  onLeave,
  roomContract,
  currentUserId,
  publicRoomSeatMap,
  onVisibilityChanged,
}: Props) {
  const sideColor = participantSide ? (SIDE_COLORS[participantSide] ?? SIDE_COLORS.observer) : null;
  const statusColor = STATUS_COLORS[debate.status] ?? STATUS_COLORS.open;

  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // QOL-039 — eligibility for the make-private action. The OD-1 gate is
  // creator-only at the UI layer; `callerIsModeratorOrAdmin` is RESERVED
  // and we pass `false` defensively (the model ignores it in v1).
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

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.badgeText, { color: statusColor.text }]}>
              {debate.status.toUpperCase()}
            </Text>
          </View>
          {sideColor && participantSide ? (
            <View style={[styles.badge, { backgroundColor: sideColor.bg }]}>
              <Text style={[styles.badgeText, { color: sideColor.text }]}>
                {participantSide.toUpperCase()}
              </Text>
            </View>
          ) : null}
          {/* QOL-039 — private-room badge. State indicator only; never a
              verdict. Shape (border + bold) carries meaning without color. */}
          {showPrivateBadge ? (
            <View
              style={styles.privateBadge}
              accessibilityLabel={ROOM_VISIBILITY_COPY.badge_private_a11y}
              testID="debate-private-badge"
            >
              <Text style={styles.privateBadgeText}>{ROOM_VISIBILITY_COPY.badge_private}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          {/* QOL-039 — make-private action (creator-only via OD-1 gate). */}
          {showMakePrivate ? (
            <Pressable
              onPress={handleOpenConfirm}
              style={styles.makePrivateButton}
              accessibilityRole="button"
              accessibilityLabel={ROOM_VISIBILITY_COPY.action_make_private_label}
              accessibilityHint={ROOM_VISIBILITY_COPY.action_make_private_hint}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="debate-make-private-action"
            >
              <Text style={styles.makePrivateText}>
                {ROOM_VISIBILITY_COPY.action_make_private_label}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onLeave}
            style={styles.leaveButton}
            accessibilityRole="button"
            accessibilityLabel="Leave argument"
          >
            <Text style={styles.leaveText}>Leave</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={2}>{debate.title}</Text>
      <Text style={styles.resolution} numberOfLines={3}>{debate.resolution}</Text>
      {errorMessage ? (
        <Text style={styles.errorText} testID="debate-make-private-error">
          {errorMessage}
        </Text>
      ) : null}
      {/* GAME-004 — 1v1 PvP seat strip. Renders only when the contract
          projection is supplied; absent → header is unchanged. */}
      {roomContract ? <RoomContractSeatStrip viewModel={roomContract} /> : null}
      {/* QOL-039 — confirmation modal. Mounted in the tree so it can show /
          hide based on `confirming` state. Renders nothing when not visible. */}
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
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  meta: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  // QOL-039 — private badge uses a border + bold weight so shape, not
  // color alone, conveys the state (accessibility-targets §3).
  privateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#f3f4f6',
  },
  privateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#111827',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  makePrivateButton: {
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  makePrivateText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  leaveButton: { paddingHorizontal: 12, paddingVertical: 6, minHeight: 44, justifyContent: 'center' },
  leaveText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  resolution: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#991b1b',
  },
});
