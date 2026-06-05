/**
 * ADMIN-ARGUMENTS-003 — Admin Arguments view-preferences model (pure TS).
 *
 * No React. No Supabase. No network. No AI. The canonical shape for the
 * device-local view preferences of the Admin Arguments table, plus the pure
 * helpers that parse, patch, and resolve it. Mirrors the PR-001
 * `userPreferencesModel.ts` discipline 1:1 (versioned blob, defensive
 * `mergeWithDefaults`, immutable single-field patch).
 *
 * Doctrine (cdiscourse-doctrine §1/§6/§9):
 *   - Every field here is cosmetic VIEW state — density, sort order, which run
 *     family to show, which participant kind to show, how many rows to load.
 *     No value is ever an input to the Constitution engine, `argumentScoreModel`,
 *     `antiAmplification`, or any validation gate. A preference never makes a
 *     point stronger, weaker, or a post blocked.
 *   - The blob holds only enums + one bounded integer. No token, no secret, no
 *     auth material, no `profiles.role` — ever. It is device-local UI state,
 *     persisted to AsyncStorage with NO server write (pure-client).
 *
 * Scope note (ADMIN-ARGUMENTS-003):
 *   `participantKind` is part of the PERSISTED schema (the card lists it among
 *   the persistable prefs) but the bot/human FILTER is DEFERRED pending
 *   Blocker B1 (confirm the `profiles.is_bot` column name). The value is
 *   persisted and surfaced as honest "coming later" copy; it drives no active
 *   filter in v1. This mirrors PR-001 persisting the inert colour-blind modes.
 */

import {
  type AdminArgumentsSortField,
  type AdminArgumentsSortDirection,
} from './adminArgumentsApi';
import {
  type RunTagFilterValue,
  coerceRunTagFilterValue,
} from './adminArgumentsRunTagModel';

// ── Preference value types ──────────────────────────────────────

/**
 * Row density for the table. `comfortable` is today's spacing (unchanged);
 * `compact` tightens vertical padding so more rows fit on screen. Cosmetic.
 */
export type AdminArgumentsDensity = 'comfortable' | 'compact';

/**
 * Which participant kind to show. PERSISTED but INERT in v1 — the active
 * bot/human filter is deferred (Blocker B1). `all` is the only value that
 * has an effect today (it is a no-op filter).
 */
export type AdminArgumentsParticipantKind = 'all' | 'humans' | 'bots';

/** Allowed row-limit values. Mirrors the existing 50 / 100 / 200 chips. */
export type AdminArgumentsLimit = 50 | 100 | 200;

/** The full per-device Admin-Arguments view-preference blob. Versioned. */
export interface AdminArgumentsPrefs {
  /** Schema version — bump on any breaking shape change. */
  schemaVersion: 1;
  density: AdminArgumentsDensity;
  sortField: AdminArgumentsSortField;
  sortDirection: AdminArgumentsSortDirection;
  runTagFilter: RunTagFilterValue;
  /** PERSISTED but inert in v1 — bot/human filter deferred (Blocker B1). */
  participantKind: AdminArgumentsParticipantKind;
  limit: AdminArgumentsLimit;
}

// ── Allowed-value sets (for defensive parsing) ──────────────────

export const ALL_ADMIN_ARGUMENTS_DENSITIES: ReadonlyArray<AdminArgumentsDensity> =
  Object.freeze(['comfortable', 'compact']);

export const ALL_ADMIN_ARGUMENTS_SORT_FIELDS: ReadonlyArray<AdminArgumentsSortField> =
  Object.freeze(['updated_at', 'created_at']);

export const ALL_ADMIN_ARGUMENTS_SORT_DIRECTIONS: ReadonlyArray<AdminArgumentsSortDirection> =
  Object.freeze(['desc', 'asc']);

export const ALL_ADMIN_ARGUMENTS_PARTICIPANT_KINDS: ReadonlyArray<AdminArgumentsParticipantKind> =
  Object.freeze(['all', 'humans', 'bots']);

export const ALL_ADMIN_ARGUMENTS_LIMITS: ReadonlyArray<AdminArgumentsLimit> =
  Object.freeze([50, 100, 200]);

// ── Defaults ────────────────────────────────────────────────────

/**
 * The canonical defaults. They reproduce the table's pre-ADMIN-ARGUMENTS-003
 * behaviour exactly: `comfortable` density (today's spacing), `updated_at desc`
 * sort, no run filter (`all`), no participant filter (`all`), 50-row limit.
 * A fresh device sees the table exactly as before.
 */
export const DEFAULT_ADMIN_ARGUMENTS_PREFS: AdminArgumentsPrefs = Object.freeze({
  schemaVersion: 1,
  density: 'comfortable',
  sortField: 'updated_at',
  sortDirection: 'desc',
  runTagFilter: 'all',
  participantKind: 'all',
  limit: 50,
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

/** Narrows a numeric limit to an allowed value, falling back to the default. */
function pickLimit(value: unknown): AdminArgumentsLimit {
  return typeof value === 'number'
    && (ALL_ADMIN_ARGUMENTS_LIMITS as ReadonlyArray<number>).includes(value)
    ? (value as AdminArgumentsLimit)
    : DEFAULT_ADMIN_ARGUMENTS_PREFS.limit;
}

/**
 * Defensive parse of whatever AsyncStorage returns. Unknown keys are dropped,
 * missing keys are filled from defaults, wrong-typed values are replaced with
 * the default. Always returns a complete, valid `AdminArgumentsPrefs` — never
 * throws.
 */
export function mergeWithDefaults(partial: unknown): AdminArgumentsPrefs {
  if (typeof partial !== 'object' || partial === null || Array.isArray(partial)) {
    return { ...DEFAULT_ADMIN_ARGUMENTS_PREFS };
  }
  const p = partial as Record<string, unknown>;
  return {
    schemaVersion: 1,
    density: pick(
      p.density,
      ALL_ADMIN_ARGUMENTS_DENSITIES,
      DEFAULT_ADMIN_ARGUMENTS_PREFS.density,
    ),
    sortField: pick(
      p.sortField,
      ALL_ADMIN_ARGUMENTS_SORT_FIELDS,
      DEFAULT_ADMIN_ARGUMENTS_PREFS.sortField,
    ),
    sortDirection: pick(
      p.sortDirection,
      ALL_ADMIN_ARGUMENTS_SORT_DIRECTIONS,
      DEFAULT_ADMIN_ARGUMENTS_PREFS.sortDirection,
    ),
    runTagFilter: coerceRunTagFilterValue(p.runTagFilter),
    participantKind: pick(
      p.participantKind,
      ALL_ADMIN_ARGUMENTS_PARTICIPANT_KINDS,
      DEFAULT_ADMIN_ARGUMENTS_PREFS.participantKind,
    ),
    limit: pickLimit(p.limit),
  };
}

/**
 * Immutable single-field update. Returns a new object; `prev` is never
 * mutated. Other fields are preserved.
 */
export function applyPrefsPatch<K extends keyof AdminArgumentsPrefs>(
  prev: AdminArgumentsPrefs,
  key: K,
  value: AdminArgumentsPrefs[K],
): AdminArgumentsPrefs {
  return { ...prev, [key]: value };
}

/**
 * Vertical row padding (px) for a density mode. `comfortable` reproduces the
 * existing 6px cell padding; `compact` tightens to 3px. A pure mapping so the
 * UI and tests agree on one source of truth.
 */
export function densityToCellPaddingY(density: AdminArgumentsDensity): number {
  return density === 'compact' ? 3 : 6;
}
