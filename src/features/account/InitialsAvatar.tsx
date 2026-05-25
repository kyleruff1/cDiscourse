/**
 * PR-004 — InitialsAvatar (formerly GeneratedAvatar from PR-001).
 *
 * A deterministic identity glyph: initials drawn over a hashed colour
 * circle. Pure — no network, no storage, no upload. After the PR-004
 * pivot away from uploaded avatars, this is the canonical user-identity
 * glyph for v1.
 *
 * Moved from src/features/preferences/GeneratedAvatar.tsx (PR-001) to
 * signal that the avatar is no longer a preferences cosmetic — it is
 * the identity primitive. The original GeneratedAvatar named export is
 * preserved for back-compat (testID `generated-avatar` and the
 * PR-001 test assertions stay intact); the new identity-facing import
 * is the `InitialsAvatar` alias.
 *
 * Doctrine:
 *   - No image upload, no storage path. The deterministic colour comes
 *     from a hashed seed (preferably userId for stability across
 *     display-name changes).
 *   - The 8-colour palette is hand-picked for >=4.5:1 contrast against
 *     the fixed `#f8fafc` text colour (WCAG AA).
 *   - Empty / null displayName falls back to '?'.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Eight muted-but-distinct background hues, picked deterministically. */
const AVATAR_BG_PALETTE = [
  '#4338ca',
  '#0f766e',
  '#9333ea',
  '#b45309',
  '#0e7490',
  '#be123c',
  '#15803d',
  '#6d28d9',
];

/** Stable string hash (djb2). Pure / deterministic. */
export function hashAvatarSeed(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 33) ^ seed.charCodeAt(i);
  }
  return Math.abs(h);
}

/** Up to two uppercase initials from a display name. Falls back to "?". */
export function deriveAvatarInitials(displayName: string | null): string {
  const trimmed = (displayName ?? '').trim();
  if (!trimmed) return '?';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Deterministic background colour for an avatar seed. */
export function deriveAvatarColor(seed: string): string {
  return AVATAR_BG_PALETTE[hashAvatarSeed(seed) % AVATAR_BG_PALETTE.length];
}

/** Returns the full palette (exposed for tests + contrast verification). */
export function getAvatarBackgroundPalette(): readonly string[] {
  return AVATAR_BG_PALETTE;
}

interface Props {
  /** Display name used to derive initials. */
  displayName: string | null;
  /** Stable seed (the user id) used to pick the background colour. */
  seed: string | null;
  /** Diameter in logical px. Default 56. */
  size?: number;
  /** High-contrast preference — thickens the ring for legibility. */
  highContrast?: boolean;
}

export function GeneratedAvatar({ displayName, seed, size = 56, highContrast }: Props) {
  const initials = deriveAvatarInitials(displayName);
  const bg = deriveAvatarColor(seed ?? displayName ?? '?');

  return (
    <View
      testID="generated-avatar"
      accessibilityRole="image"
      accessibilityLabel={`Generated avatar showing the initials ${initials}`}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderWidth: highContrast ? 3 : 1,
        },
      ]}
    >
      <Text
        style={[styles.initials, { fontSize: Math.round(size * 0.38) }]}
        numberOfLines={1}
      >
        {initials}
      </Text>
    </View>
  );
}

/**
 * PR-004 — `InitialsAvatar` is the identity-facing alias. New consumers
 * should import this name. The original `GeneratedAvatar` export remains
 * to keep PR-001 testIDs and tests stable (back-compat).
 */
export const InitialsAvatar = GeneratedAvatar;

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#f8fafc',
  },
  initials: {
    color: '#f8fafc',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
