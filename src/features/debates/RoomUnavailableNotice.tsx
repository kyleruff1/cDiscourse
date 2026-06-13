/**
 * ARG-ROOM-006 (item c) — direct-URL / deep-link "unavailable" notice.
 *
 * Shown when a deep link / notification points at a room id that is NOT in the
 * viewer's RLS-filtered `debates` list. By construction this covers BOTH a
 * private room the viewer is not a member of AND a nonexistent / typo'd id —
 * they are INDISTINGUISHABLE, which IS the no-enumeration guarantee (roadmap
 * §5): a non-member never learns whether a private room exists at a given URL.
 *
 * Presentational only. It renders cause-neutral copy (`ROOM_ACCESS_COPY`) —
 * it NEVER asserts "this room is private" (that would confirm existence). The
 * decision of WHEN to show it is made by `resolveRoomDeepLinkAccess` in
 * `roomAccessModel.ts`; this component takes a `visible` flag + an `onDismiss`.
 *
 * Reuses the established core `Modal` overlay pattern (PreferencesPopout /
 * DeletionRequestSheet) and the InviteRedeemGate panel a11y shape — no new
 * overlay mechanism, no router, no new dependency.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ROOM_ACCESS_COPY } from '../arguments/gameCopy';
import { SURFACE_TOKENS, CONTROL } from '../../lib/designTokens';

export interface RoomUnavailableNoticeProps {
  visible: boolean;
  onDismiss: () => void;
  /** accessibility-targets: snap (no animation) when motion is reduced. */
  reduceMotion?: boolean;
}

export function RoomUnavailableNotice({
  visible,
  onDismiss,
  reduceMotion = false,
}: RoomUnavailableNoticeProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.panel} testID="room-unavailable-notice">
          <Text style={styles.heading} accessibilityRole="header">
            {ROOM_ACCESS_COPY.unavailable_title}
          </Text>
          <Text style={styles.body}>{ROOM_ACCESS_COPY.unavailable_body}</Text>
          <Pressable
            style={styles.dismissButton}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={ROOM_ACCESS_COPY.unavailable_dismiss}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            testID="room-unavailable-dismiss"
          >
            <Text style={styles.dismissText}>{ROOM_ACCESS_COPY.unavailable_dismiss}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: SURFACE_TOKENS.overlay,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    padding: 24,
    gap: 14,
    alignItems: 'center',
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: SURFACE_TOKENS.textSecondary,
    textAlign: 'center',
  },
  dismissButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: CONTROL.primary.bg,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 6,
  },
  dismissText: {
    color: CONTROL.primary.fg,
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
});
