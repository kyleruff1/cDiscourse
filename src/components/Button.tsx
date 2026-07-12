import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { BRAND, CONTROL } from '../lib/designTokens';

// UX-PR-A (#916) — per-variant spinner foreground. Replaces the prior
// primary-vs-rest ternary so no bare white literal survives and the
// secondary spinner stays the BRAND cream (BRAND.text.primary) exactly
// as UX-BRAND-001 shipped it. Module-local const; not exported.
const SPINNER_FG = {
  primary: CONTROL.primary.fg,
  secondary: BRAND.text.primary,
  danger: CONTROL.danger.fg,
} as const;

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  /**
   * Optional test hook forwarded to the underlying Pressable. Additive — when
   * omitted the Pressable receives no testID, so existing call sites are
   * unaffected. Added for AUTH-GOOGLE-SSO-003 (#746) so the gated
   * "Continue with Google" affordance is locatable by testID.
   */
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={SPINNER_FG[variant]}
        />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginVertical: 4,
  },
  primary: { backgroundColor: CONTROL.primary.bg },
  // UX-BRAND-001 — the secondary CTA was a dark slate label on a light-gray
  // border, near-invisible on the dark app backdrop. It now reads as a premium
  // ghost button: a restrained gold hairline border with a readable cream label.
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: BRAND.accent.goldBorder },
  // UX-PR-A (#916) — destructive control is a quiet bordered outline, NOT a
  // full-bleed red flood: transparent fill + a maroon hairline + a light-red
  // label. The meaning is carried by the label (and the button word), so the
  // faint border is color-independence-safe.
  danger: { backgroundColor: CONTROL.danger.bg, borderWidth: 1, borderColor: CONTROL.danger.borderColor },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  label: { fontSize: 15, fontWeight: '600' },
  primaryLabel: { color: CONTROL.primary.fg },
  secondaryLabel: { color: BRAND.text.primary },
  dangerLabel: { color: CONTROL.danger.fg },
});
