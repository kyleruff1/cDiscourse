/**
 * PR-001 — User preferences model (pure TypeScript).
 *
 * No React. No Supabase. No network. No AI. The canonical shape for the
 * device-local preference blob surfaced by the "My preferences" popout,
 * plus the pure helpers that parse, patch, and resolve it.
 *
 * Doctrine (cdiscourse-doctrine §1/§6/§10):
 *   - A preference is cosmetic. No value here is ever an input to the
 *     Constitution engine, `argumentScoreModel`, `antiAmplification`, or
 *     any validation gate. A preference never makes a point stronger,
 *     weaker, or a post blocked.
 *   - The blob holds only enums + one boolean. No token, no secret, no
 *     auth material, no `profiles.role` — ever.
 *   - The notification field is an honest stub: v1 has no push.
 *
 * Display name and contact email are deliberately NOT in this blob:
 *   - Display name is account data (`profiles.display_name`), written
 *     via the existing `updateOwnDisplayName` path.
 *   - Contact email is read-only, sourced from `fetchCurrentAuthUser()`.
 * Putting either in AsyncStorage would let the device copy drift from
 * Supabase.
 */

import type { TimelineDensityMode } from '../arguments/timelineNodeVisualModel';

// ── Preference value types ──────────────────────────────────────

/** Visual density — drives VG-004's `TimelineDensityMode` 1:1. */
export type DensityPreference = 'compact' | 'normal' | 'expanded';

/** Reduce-motion override that composes on top of the OS setting. */
export type ReduceMotionPreference = 'system' | 'on' | 'off';

/**
 * Colour accessibility mode. v1: only `default` and `high_contrast`
 * have a real effect. The three colour-blind simulation values are
 * PERSISTED but inert in v1 — no palette-swap layer exists to drive
 * them yet (a separate VG card). The popout shows honest "coming
 * later" copy for those three.
 */
export type ColorAccessibilityMode =
  | 'default'
  | 'high_contrast'
  | 'protanopia' // persisted, v1 no-op
  | 'deuteranopia' // persisted, v1 no-op
  | 'tritanopia'; // persisted, v1 no-op

/** Which mode a room opens in. Mirrors the Observer-first default. */
export type DefaultRoomEntryPreference = 'observe' | 'last_used';

/** Default side label shown in the composer / side rail. Cosmetic only. */
export type DefaultSideLabelPreference = 'for_against' | 'side_a_b';

/** The full per-user preference blob. Versioned for forward-safe migration. */
export interface UserPreferences {
  /** Schema version — bump on any breaking shape change. */
  schemaVersion: 1;
  density: DensityPreference;
  reduceMotion: ReduceMotionPreference;
  colorMode: ColorAccessibilityMode;
  defaultRoomEntry: DefaultRoomEntryPreference;
  defaultSideLabel: DefaultSideLabelPreference;
  /** Honest stub — persisted, drives nothing in v1 (no push notifications). */
  notificationsOptInStub: boolean;
}

// ── Allowed-value sets (for defensive parsing) ──────────────────

export const ALL_DENSITY_PREFERENCES: ReadonlyArray<DensityPreference> =
  Object.freeze(['compact', 'normal', 'expanded']);

export const ALL_REDUCE_MOTION_PREFERENCES: ReadonlyArray<ReduceMotionPreference> =
  Object.freeze(['system', 'on', 'off']);

export const ALL_COLOR_ACCESSIBILITY_MODES: ReadonlyArray<ColorAccessibilityMode> =
  Object.freeze(['default', 'high_contrast', 'protanopia', 'deuteranopia', 'tritanopia']);

export const ALL_DEFAULT_ROOM_ENTRY_PREFERENCES: ReadonlyArray<DefaultRoomEntryPreference> =
  Object.freeze(['observe', 'last_used']);

export const ALL_DEFAULT_SIDE_LABEL_PREFERENCES: ReadonlyArray<DefaultSideLabelPreference> =
  Object.freeze(['for_against', 'side_a_b']);

// ── Defaults ────────────────────────────────────────────────────

/**
 * The canonical defaults. `resolveNodeGapPx(undefined)` already returns
 * the VG-004 `'normal'` value (44px), so `'normal'` is the density
 * default — wiring the density input does not silently move the board
 * for an existing user.
 */
export const DEFAULT_USER_PREFERENCES: UserPreferences = Object.freeze({
  schemaVersion: 1,
  density: 'normal',
  reduceMotion: 'system',
  colorMode: 'default',
  defaultRoomEntry: 'observe',
  defaultSideLabel: 'for_against',
  notificationsOptInStub: false,
});

// ── Pure helpers ────────────────────────────────────────────────

/** Narrows `value` to a member of `allowed`, falling back to `fallback`. */
function pick<T extends string>(
  value: unknown,
  allowed: ReadonlyArray<T>,
  fallback: T,
): T {
  return typeof value === 'string' && (allowed as ReadonlyArray<string>).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Defensive parse of whatever AsyncStorage returns. Unknown keys are
 * dropped, missing keys are filled from defaults, wrong-typed values
 * are replaced with the default. Always returns a complete, valid
 * `UserPreferences` — never throws.
 */
export function mergeWithDefaults(partial: unknown): UserPreferences {
  if (typeof partial !== 'object' || partial === null || Array.isArray(partial)) {
    return { ...DEFAULT_USER_PREFERENCES };
  }
  const p = partial as Record<string, unknown>;
  return {
    schemaVersion: 1,
    density: pick(p.density, ALL_DENSITY_PREFERENCES, DEFAULT_USER_PREFERENCES.density),
    reduceMotion: pick(
      p.reduceMotion,
      ALL_REDUCE_MOTION_PREFERENCES,
      DEFAULT_USER_PREFERENCES.reduceMotion,
    ),
    colorMode: pick(
      p.colorMode,
      ALL_COLOR_ACCESSIBILITY_MODES,
      DEFAULT_USER_PREFERENCES.colorMode,
    ),
    defaultRoomEntry: pick(
      p.defaultRoomEntry,
      ALL_DEFAULT_ROOM_ENTRY_PREFERENCES,
      DEFAULT_USER_PREFERENCES.defaultRoomEntry,
    ),
    defaultSideLabel: pick(
      p.defaultSideLabel,
      ALL_DEFAULT_SIDE_LABEL_PREFERENCES,
      DEFAULT_USER_PREFERENCES.defaultSideLabel,
    ),
    notificationsOptInStub:
      typeof p.notificationsOptInStub === 'boolean'
        ? p.notificationsOptInStub
        : DEFAULT_USER_PREFERENCES.notificationsOptInStub,
  };
}

/**
 * Immutable single-field update. Returns a new object; `prev` is never
 * mutated. Other fields are preserved.
 */
export function applyPreferencePatch<K extends keyof UserPreferences>(
  prev: UserPreferences,
  key: K,
  value: UserPreferences[K],
): UserPreferences {
  return { ...prev, [key]: value };
}

/**
 * Compose the reduce-motion override on top of the OS setting:
 *   - `system` → obey the OS (today's behaviour).
 *   - `on`     → motion is always reduced, regardless of the OS.
 *   - `off`    → motion is never reduced, regardless of the OS.
 */
export function resolveEffectiveReduceMotion(
  pref: ReduceMotionPreference,
  osReduceMotion: boolean,
): boolean {
  if (pref === 'on') return true;
  if (pref === 'off') return false;
  return osReduceMotion;
}

/**
 * Map a density preference to VG-004's `TimelineDensityMode`. The two
 * enums are intentionally congruent (identity map); this helper exists
 * so the dependency is explicit and test-pinned — if VG-004 ever adds a
 * density mode, this function is the single place the mapping breaks.
 */
export function densityToTimelineMode(d: DensityPreference): TimelineDensityMode {
  return d;
}

/** True when the colour mode is the one with a real v1 effect beyond `default`. */
export function isHighContrast(mode: ColorAccessibilityMode): boolean {
  return mode === 'high_contrast';
}
