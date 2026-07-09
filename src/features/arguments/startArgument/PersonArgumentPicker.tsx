/**
 * START-001 (#827) — PersonArgumentPicker.
 *
 * The person-first first step of the StartArgumentSheet: a source-ordered list
 * of recent opponents, an invite-by-email field, and the open-floor row LAST.
 * Presentational + controlled — it emits a `PersonTarget` via `onChange` and
 * renders selection from `value`. It holds NO visibility state and never
 * decides public/private (START-003 owns that ceremony); it never reads a
 * feature flag (App.tsx is the sole flag consumer).
 *
 * Doctrine:
 *   - No `profiles` search / directory / global user search. Recents come from
 *     the viewer OWN sent invites (RLS `ari_select_inviter_own`); e-mail entry
 *     is the only path to a stranger. A person is named only by a MASKED
 *     address, never a verdict.
 *   - Ordering is fixed by the pure `orderPickerRows` (recents -> circles ->
 *     e-mail -> open-floor-LAST); the UI cannot reorder it.
 *
 * A11y: rows >= 52px with >= 44px hit targets; `accessibilityRole` + `Label` +
 * `State` on every pressable; selection carried by a filled/hollow glyph +
 * bolder label (color is never the only signal); the disclosure is a snap
 * conditional mount (reduce-motion safe).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SURFACE_TOKENS, SPACING, RADIUS, TOUCH_TARGET } from '../../../lib/designTokens';
import { InitialsAvatar } from '../../account/InitialsAvatar';
import { START_SHEET_COPY } from '../gameCopy';
import {
  orderPickerRows,
  type PersonTarget,
  type RecentOpponent,
  type CircleOption,
} from './personArgumentPickerModel';

export interface PersonArgumentPickerProps {
  value: PersonTarget | null;
  onChange: (target: PersonTarget) => void;
  recents: RecentOpponent[];
  /** START-002 slot — default []. */
  circles?: CircleOption[];
  /** Inline validation copy for the typed e-mail (from the creation matrix). */
  emailReason?: string | null;
}

export function PersonArgumentPicker({
  value,
  onChange,
  recents,
  circles = [],
  emailReason,
}: PersonArgumentPickerProps) {
  const typedEmail = value?.kind === 'email' ? value.email : '';
  const hasTypedEmail = typedEmail.trim().length > 0;
  const rows = orderPickerRows(recents, circles, hasTypedEmail);

  return (
    <View style={styles.container} testID="person-argument-picker">
      <Text style={styles.sectionLabel}>{START_SHEET_COPY.whoStepLabel}</Text>
      <Text style={styles.helper}>{START_SHEET_COPY.whoStepHelper}</Text>

      {recents.length === 0 ? (
        <Text style={styles.recentsEmpty} testID="person-picker-recents-empty">
          {START_SHEET_COPY.recentsEmpty}
        </Text>
      ) : null}

      <View style={styles.rows}>
        {rows.map((row) => {
          if (row.kind === 'recent' && row.recent) {
            const recent = row.recent;
            const selected = value?.kind === 'profile' && value.email === recent.email;
            return (
              <Pressable
                key={row.key}
                onPress={() => onChange({ kind: 'profile', email: recent.email })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Recent: ${recent.maskedEmail}`}
                accessibilityHint={START_SHEET_COPY.recentRowA11yHint}
                hitSlop={TOUCH_TARGET.hitSlopCompact}
                style={[styles.row, selected && styles.rowSelected]}
                testID={`person-picker-recent-${recent.email}`}
              >
                <Text style={[styles.check, selected && styles.checkOn]}>
                  {selected ? '●' : '○'}
                </Text>
                <InitialsAvatar
                  displayName={recent.maskedEmail.charAt(0)}
                  seed={recent.email}
                  size={36}
                />
                <View style={styles.rowTextCol}>
                  <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>
                    {recent.maskedEmail}
                  </Text>
                  <Text style={styles.rowSublabel}>{START_SHEET_COPY.recentsLabel}</Text>
                </View>
              </Pressable>
            );
          }

          if (row.kind === 'circle' && row.circle) {
            // START-002 (#839) — a circle audience. Selecting it forces the room
            // private (the circle IS the audience). The member count is a
            // STRUCTURAL size, never a ranking. The lock glyph carries the
            // private meaning independent of color (grayscale-legible).
            const circle = row.circle;
            const selected = value?.kind === 'circle' && value.circleId === circle.id;
            const countLabel =
              typeof circle.memberCount === 'number' && circle.memberCount > 0
                ? `${circle.memberCount} ${circle.memberCount === 1 ? 'person' : 'people'}`
                : null;
            return (
              <Pressable
                key={row.key}
                onPress={() => onChange({ kind: 'circle', circleId: circle.id, label: circle.label })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={
                  `Argue inside the circle ${circle.label}` +
                  (countLabel ? `, ${countLabel}` : '') +
                  '. Stays private.'
                }
                accessibilityHint={START_SHEET_COPY.circleRowA11yHint}
                hitSlop={TOUCH_TARGET.hitSlopCompact}
                style={[styles.row, selected && styles.rowSelected]}
                testID={`person-picker-circle-${circle.id}`}
              >
                <Text style={[styles.check, selected && styles.checkOn]}>
                  {selected ? '●' : '○'}
                </Text>
                <Text style={styles.circleGlyph} accessibilityElementsHidden>
                  {'●●'}
                </Text>
                <View style={styles.rowTextCol}>
                  <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>
                    {circle.label}
                  </Text>
                  <Text style={styles.rowSublabel}>
                    {countLabel
                      ? `${START_SHEET_COPY.circlesLabel} · ${countLabel}`
                      : START_SHEET_COPY.circlesLabel}
                  </Text>
                </View>
              </Pressable>
            );
          }

          if (row.kind === 'email_entry') {
            const emailActive = value?.kind === 'email';
            return (
              <View
                key={row.key}
                style={[styles.emailBlock, emailActive && styles.emailBlockActive]}
                testID="person-picker-email"
              >
                <Text style={styles.emailLabel}>{START_SHEET_COPY.emailEntryLabel}</Text>
                <Text style={styles.helper}>{START_SHEET_COPY.emailEntryHelper}</Text>
                <TextInput
                  value={typedEmail}
                  onChangeText={(text) => onChange({ kind: 'email', email: text })}
                  placeholder={START_SHEET_COPY.emailEntryPlaceholder}
                  placeholderTextColor={SURFACE_TOKENS.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.emailInput}
                  accessibilityLabel={START_SHEET_COPY.emailEntryA11yLabel}
                  testID="person-picker-email-input"
                />
                {emailReason ? (
                  <Text
                    style={styles.emailReason}
                    accessibilityLiveRegion="polite"
                    testID="person-picker-email-reason"
                  >
                    {emailReason}
                  </Text>
                ) : null}
              </View>
            );
          }

          // open_floor — always last, visually distinct.
          const openSelected = value?.kind === 'open_floor';
          return (
            <Pressable
              key={row.key}
              onPress={() => onChange({ kind: 'open_floor' })}
              accessibilityRole="radio"
              accessibilityState={{ selected: openSelected }}
              accessibilityLabel={START_SHEET_COPY.openFloorLabel}
              accessibilityHint={START_SHEET_COPY.openFloorA11yHint}
              hitSlop={TOUCH_TARGET.hitSlopCompact}
              style={[styles.row, styles.openFloorRow, openSelected && styles.rowSelected]}
              testID="person-picker-open-floor"
            >
              <Text style={[styles.check, openSelected && styles.checkOn]}>
                {openSelected ? '●' : '○'}
              </Text>
              <View style={styles.rowTextCol}>
                <Text style={[styles.rowLabel, openSelected && styles.rowLabelSelected]}>
                  {START_SHEET_COPY.openFloorLabel}
                </Text>
                <Text style={styles.rowSublabel}>{START_SHEET_COPY.openFloorHelper}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.xs },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  helper: { fontSize: 12, color: SURFACE_TOKENS.textSecondary, lineHeight: 16 },
  recentsEmpty: {
    fontSize: 12,
    color: SURFACE_TOKENS.textMuted,
    lineHeight: 16,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  rows: { gap: SPACING.s, marginTop: SPACING.s },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    minHeight: 52,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.elevated,
  },
  rowSelected: { borderWidth: 2, borderColor: SURFACE_TOKENS.focusRing },
  openFloorRow: {
    borderStyle: 'dashed',
    backgroundColor: SURFACE_TOKENS.overlay,
    marginTop: SPACING.s,
  },
  check: { fontSize: 15, color: SURFACE_TOKENS.textMuted, width: 18, textAlign: 'center' },
  checkOn: { color: SURFACE_TOKENS.textPrimary },
  // START-002 — a small two-dot glyph so a circle row reads as a group even in
  // grayscale (shape carries meaning, not color). Decorative; hidden from a11y.
  circleGlyph: { fontSize: 12, color: SURFACE_TOKENS.textSecondary, width: 22, textAlign: 'center', letterSpacing: -2 },
  rowTextCol: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: SURFACE_TOKENS.textSecondary },
  rowLabelSelected: { fontWeight: '800', color: SURFACE_TOKENS.textPrimary },
  rowSublabel: { fontSize: 11, color: SURFACE_TOKENS.textMuted, lineHeight: 15 },

  emailBlock: {
    gap: SPACING.xs,
    padding: SPACING.m,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.elevated,
  },
  emailBlockActive: { borderWidth: 2, borderColor: SURFACE_TOKENS.focusRing },
  emailLabel: { fontSize: 14, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  emailInput: {
    marginTop: SPACING.xs,
    minHeight: 44,
    backgroundColor: SURFACE_TOKENS.inputBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    fontSize: 15,
    color: SURFACE_TOKENS.textPrimary,
  },
  emailReason: { fontSize: 12, color: '#fcd34d', lineHeight: 16, marginTop: SPACING.xs },
});
