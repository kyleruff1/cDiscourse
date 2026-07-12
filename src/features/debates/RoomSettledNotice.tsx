import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ROOM_SETTLE_COPY } from '../arguments/gameCopy';
import { buildSettleConsequences } from './settleRoomModel';
import type { DebateStatus } from './types';
import { RoomSettleConfirmation } from './RoomSettleConfirmation';

/**
 * SETTLE-001 (#911) — inline read-only notice shown in the composer slot when
 * a room is settled (status locked). Calm lifecycle cue, not a verdict: the
 * exchange stays readable, nothing is deleted. The creator (canReopen) also
 * gets a Re-open control that opens the reopen confirm sheet. Non-creators see
 * the notice only (read-only posture is actor-agnostic — nobody can post to a
 * locked room). Wrap-not-edit: the pinned composer files are untouched; App
 * mounts this instead of the suppressed composer.
 *
 * Comments are apostrophe-free for the naive quote-parity doctrine scanner.
 */
interface Props {
  status: DebateStatus;
  canReopen: boolean;
  onReopen: () => Promise<{ ok: boolean; error?: string }>;
  reduceMotion?: boolean;
}

export function RoomSettledNotice({ status, canReopen, onReopen, reduceMotion }: Props) {
  const [reopenConfirming, setReopenConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const consequences = useMemo(() => buildSettleConsequences('reopen'), []);

  const handleOpenReopen = useCallback(() => {
    setErrorMessage(null);
    setReopenConfirming(true);
  }, []);

  const handleCancelReopen = useCallback(() => {
    if (submitting) return;
    setReopenConfirming(false);
  }, [submitting]);

  const handleConfirmReopen = useCallback(async () => {
    setSubmitting(true);
    setErrorMessage(null);
    const res = await onReopen();
    setSubmitting(false);
    if (!res.ok) {
      setErrorMessage(ROOM_SETTLE_COPY.error_network);
      return;
    }
    setReopenConfirming(false);
  }, [onReopen]);

  // Defensive: the notice is only meaningful for a settled (locked) room. App
  // mounts it only when locked, but guard so an open/draft room never shows it.
  if (status !== 'locked') return null;

  return (
    <View
      style={styles.container}
      testID="room-settled-notice"
      accessibilityRole="summary"
      accessibilityLabel={`${ROOM_SETTLE_COPY.notice_settled_title}. ${ROOM_SETTLE_COPY.notice_settled_body}`}
    >
      <Text style={styles.title}>{ROOM_SETTLE_COPY.notice_settled_title}</Text>
      <Text style={styles.body}>{ROOM_SETTLE_COPY.notice_settled_body}</Text>
      {canReopen ? (
        <Pressable
          onPress={handleOpenReopen}
          accessibilityRole="button"
          accessibilityLabel={ROOM_SETTLE_COPY.action_reopen_label}
          accessibilityHint={ROOM_SETTLE_COPY.action_reopen_hint}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.reopenButton}
          testID="room-settled-reopen-action"
        >
          <Text style={styles.reopenLabel}>{ROOM_SETTLE_COPY.action_reopen_label}</Text>
        </Pressable>
      ) : null}
      {errorMessage ? (
        <Text style={styles.errorText} testID="room-settled-reopen-error">
          {errorMessage}
        </Text>
      ) : null}
      {canReopen ? (
        <RoomSettleConfirmation
          visible={reopenConfirming}
          mode="reopen"
          consequences={consequences}
          submitting={submitting}
          onConfirm={handleConfirmReopen}
          onCancel={handleCancelReopen}
          reduceMotion={reduceMotion}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Calm dark-surface card matching the room chrome; shape (border + padding)
  // carries the read-only posture, not color alone.
  container: {
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  body: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  reopenButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    marginTop: 2,
  },
  reopenLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  errorText: {
    fontSize: 12,
    color: '#fca5a5',
    marginTop: 2,
  },
});
