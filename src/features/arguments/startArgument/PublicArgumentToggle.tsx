/**
 * START-003 (#875) — PublicArgumentToggle.
 *
 * The public two-tap ceremony, mounted in the StartArgumentSheet Advanced slot.
 * Controlled + self-contained + mount-agnostic: it receives the sheet-held
 * `visibility` (for init/reset) and emits the RESOLVED creation visibility via
 * `onChange`. It emits `onChange('public')` ONLY on the confirm transition; a
 * single switch tap emits `'private'` (the preview is still private). The
 * transient `previewing_public` state lives INSIDE this component and never
 * reaches the sheet visibility (which is only 'public' | 'private').
 *
 * The consequences panel reuses ONLY existing choke-point copy for its two
 * bullets — ROOM_VISIBILITY_COPY.option_public_helper (visibility) and
 * fillArgumentRoomCapacityCopy over ARGUMENT_ROOM_CREATE_COPY.capacity_public_*
 * (capacity) — so the cap/open numbers are validator-derived, never literals.
 *
 * Doctrine: no verdict / heat / popularity / persuasion copy; visibility is an
 * access property, never a standing. No new secret, no Edge, no migration.
 *
 * A11y: switch carries role + checked + disabled + label + hint; the switch sits
 * in a >= 44px row (the platform Switch ignores hitSlop); confirm/cancel are
 * >= 44px Pressables. State is color-independent — panel-absent = private,
 * status text = previewing, a check glyph + status text = confirmed. The panel
 * is a conditional mount (snap show/hide), reduce-motion safe by construction.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SURFACE_TOKENS, CONTROL, SPACING, RADIUS, TOUCH_TARGET } from '../../../lib/designTokens';
import type { RoomVisibility } from '../../debates/types';
import {
  ROOM_VISIBILITY_COPY,
  ARGUMENT_ROOM_CREATE_COPY,
  PUBLIC_ARGUMENT_TOGGLE_COPY,
  fillArgumentRoomCapacityCopy,
} from '../gameCopy';
import {
  nextPublicToggleState,
  resolveCreationVisibility,
  isPublicPreviewVisible,
  isSwitchOn,
  initialStateForVisibility,
  type PublicToggleState,
  type PublicToggleEvent,
} from './publicArgumentToggleModel';

export interface PublicArgumentToggleProps {
  /** The sheet committed visibility. Inits/resets internal state. */
  visibility: RoomVisibility;
  /** Emits the RESOLVED creation visibility. 'public' ONLY on confirm. */
  onChange: (visibility: RoomVisibility) => void;
  /** Validator-derived numbers for the capacity bullet (never literals). */
  capacityPreview: { capacity: number; open: number; reservedInviteSeats?: 0 | 1 };
  /** Optional — disables switch + confirm while the sheet is submitting. */
  disabled?: boolean;
}

export function PublicArgumentToggle({
  visibility,
  onChange,
  capacityPreview,
  disabled,
}: PublicArgumentToggleProps) {
  const [state, setState] = useState<PublicToggleState>(() =>
    initialStateForVisibility(visibility),
  );

  // A9 — when the sheet resets visibility to 'private' externally (target
  // change / re-open), snap the internal state back to private. No stale
  // public_confirmed survives.
  useEffect(() => {
    if (visibility === 'private') setState('private');
  }, [visibility]);

  const dispatch = (event: PublicToggleEvent) => {
    const next = nextPublicToggleState(state, event);
    setState(next);
    onChange(resolveCreationVisibility(next));
  };

  const switchOn = isSwitchOn(state);
  const previewVisible = isPublicPreviewVisible(state);
  const confirmed = state === 'public_confirmed';

  const reserved: 0 | 1 = capacityPreview.reservedInviteSeats === 1 ? 1 : 0;
  const capacityBullet = fillArgumentRoomCapacityCopy(
    reserved === 1
      ? ARGUMENT_ROOM_CREATE_COPY.capacity_public_reserved
      : ARGUMENT_ROOM_CREATE_COPY.capacity_public_open,
    { capacity: capacityPreview.capacity, open: capacityPreview.open },
  );

  return (
    <View style={styles.container} testID="public-argument-toggle">
      <View style={styles.switchRow}>
        <View style={styles.switchTextCol}>
          <Text style={styles.switchLabel}>{PUBLIC_ARGUMENT_TOGGLE_COPY.switch_label}</Text>
          <Text style={styles.helper}>{PUBLIC_ARGUMENT_TOGGLE_COPY.switch_helper}</Text>
        </View>
        <Switch
          testID="public-argument-toggle-switch"
          value={switchOn}
          onValueChange={(v) => dispatch(v ? 'flip_on' : 'flip_off')}
          disabled={disabled}
          accessibilityRole="switch"
          accessibilityLabel={PUBLIC_ARGUMENT_TOGGLE_COPY.switch_label}
          accessibilityHint={PUBLIC_ARGUMENT_TOGGLE_COPY.switch_a11y_hint}
          accessibilityState={{ checked: switchOn, disabled: disabled === true }}
        />
      </View>

      {previewVisible ? (
        <View style={styles.panel} testID="public-argument-toggle-panel">
          <View style={styles.statusRow}>
            {confirmed ? (
              <Text
                style={styles.confirmGlyph}
                accessibilityLabel={PUBLIC_ARGUMENT_TOGGLE_COPY.confirmed_glyph_a11y}
                testID="public-argument-toggle-confirmed-glyph"
              >
                {'✓ '}
              </Text>
            ) : null}
            <Text style={styles.status} testID="public-argument-toggle-status">
              {confirmed
                ? PUBLIC_ARGUMENT_TOGGLE_COPY.status_confirmed
                : PUBLIC_ARGUMENT_TOGGLE_COPY.status_not_yet_public}
            </Text>
          </View>

          {/* Two consequence bullets — each its own <Text>, choke-point sourced. */}
          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText} testID="public-argument-toggle-visibility-bullet">
              {ROOM_VISIBILITY_COPY.option_public_helper}
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText} testID="public-argument-toggle-capacity-bullet">
              {capacityBullet}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => dispatch('dismiss')}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={PUBLIC_ARGUMENT_TOGGLE_COPY.cancel}
              hitSlop={TOUCH_TARGET.hitSlopCompact}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              testID="public-argument-toggle-cancel"
            >
              <Text style={styles.cancelLabel}>{PUBLIC_ARGUMENT_TOGGLE_COPY.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={() => dispatch('confirm')}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={PUBLIC_ARGUMENT_TOGGLE_COPY.confirm}
              accessibilityState={{ disabled: disabled === true }}
              hitSlop={TOUCH_TARGET.hitSlopCompact}
              style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}
              testID="public-argument-toggle-confirm"
            >
              <Text style={styles.confirmLabel}>{PUBLIC_ARGUMENT_TOGGLE_COPY.confirm}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.s,
    padding: SPACING.m,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.overlay,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.m,
    minHeight: 44,
  },
  switchTextCol: { flex: 1, gap: 2 },
  switchLabel: { fontSize: 14, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  helper: { fontSize: 12, color: SURFACE_TOKENS.textSecondary, lineHeight: 16 },

  panel: { gap: SPACING.s, marginTop: SPACING.xs },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  confirmGlyph: { fontSize: 13, fontWeight: '800', color: SURFACE_TOKENS.textPrimary },
  status: { fontSize: 13, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },

  bulletRow: { flexDirection: 'row', gap: SPACING.s },
  bulletDot: { fontSize: 13, color: SURFACE_TOKENS.textMuted, width: 12, textAlign: 'center' },
  bulletText: { fontSize: 13, color: SURFACE_TOKENS.textSecondary, flex: 1, lineHeight: 18 },

  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.s, marginTop: SPACING.xs },
  cancelBtn: {
    minHeight: 44,
    paddingHorizontal: SPACING.m,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: CONTROL.secondary.borderColor,
    backgroundColor: CONTROL.secondary.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: { fontSize: 14, fontWeight: '600', color: CONTROL.secondary.fg },
  confirmBtn: {
    minHeight: 44,
    paddingHorizontal: SPACING.m,
    borderRadius: RADIUS.md,
    backgroundColor: CONTROL.primary.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLabel: { fontSize: 14, fontWeight: '700', color: CONTROL.primary.fg },
  pressed: { opacity: 0.8 },
});
