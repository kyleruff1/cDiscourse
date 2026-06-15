import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { BRAND } from '../lib/designTokens';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
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
          color={variant === 'primary' ? '#fff' : BRAND.text.primary}
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
  primary: { backgroundColor: '#6366f1' },
  // UX-BRAND-001 — the secondary CTA was a dark slate label on a light-gray
  // border, near-invisible on the dark app backdrop. It now reads as a premium
  // ghost button: a restrained gold hairline border with a readable cream label.
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: BRAND.accent.goldBorder },
  danger: { backgroundColor: '#ef4444' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  label: { fontSize: 15, fontWeight: '600' },
  primaryLabel: { color: '#fff' },
  secondaryLabel: { color: BRAND.text.primary },
  dangerLabel: { color: '#fff' },
});
