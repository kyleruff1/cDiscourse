/**
 * META-1C — Pure view-model helpers for AdminMetadataEventsTab.
 *
 * The filter, role-label, and actor-role-format logic the tab renders. Kept
 * pure (no React, no Supabase, no network) so it is fully unit-testable —
 * the repo's component-test discipline drives the UI through pure helpers
 * like this rather than a runtime renderer.
 *
 * Doctrine: every label produced here is a neutral, fact-only description.
 * No verdict tokens, no person-attribution. The role labels describe the
 * actor's CURRENT role, never a fabricated apply-time role.
 */
import type { AuditActorRole, MetadataAuditEvent } from './adminMetadataEventsApi';

// ── Actor-role filter ─────────────────────────────────────────

/**
 * The actor-role filter chip set. `Admin` / `Moderator` filter on the
 * actor's current `appRole`; `Affirmative` / `Negative` / `Observer` filter
 * on their current `debateSide` in the audited debate.
 */
export type AuditRoleFilter =
  | 'all'
  | 'admin'
  | 'moderator'
  | 'affirmative'
  | 'negative'
  | 'observer';

export const ALL_AUDIT_ROLE_FILTERS: ReadonlyArray<AuditRoleFilter> = Object.freeze([
  'all',
  'admin',
  'moderator',
  'affirmative',
  'negative',
  'observer',
]);

export const AUDIT_ROLE_FILTER_LABELS: Readonly<Record<AuditRoleFilter, string>> = Object.freeze({
  all: 'All roles',
  admin: 'Admin',
  moderator: 'Moderator',
  affirmative: 'Affirmative',
  negative: 'Negative',
  observer: 'Observer',
});

/** The event-kind filter — "applied vs removed" (replaces the dropped
 *  "lifecycle transition" chip; auto-metadata is never persisted). */
export type AuditEventKindFilter = 'all' | 'applied' | 'removed';

// ── Filter state ──────────────────────────────────────────────

export interface MetadataAuditFilters {
  /** Free-text search over move excerpt / actor / debate title / tag label. */
  search: string;
  /** A `ManualTagCode` value, or 'all' for no constraint. */
  tagCode: string;
  /** An actor-role filter, or 'all'. */
  role: AuditRoleFilter;
  /** An event-kind filter, or 'all'. */
  kind: AuditEventKindFilter;
}

// ── Actor-role formatting ─────────────────────────────────────

/**
 * Human-readable label for an actor's CURRENT role context. Honest by
 * construction — when the actor has no debater side the label shows only the
 * app role (no fabricated side). Returns '—' for a null actor (e.g. a
 * `removed` event whose remover profile was deleted).
 *
 * Examples: `Admin`, `Moderator`, `Participant · Affirmative`,
 * `Participant · Observer`, `Participant`.
 */
export function formatActorRole(role: AuditActorRole | null | undefined): string {
  if (!role) return '—';
  if (role.appRole === 'admin') return 'Admin';
  if (role.appRole === 'moderator') return 'Moderator';
  // app-level 'user' — describe their debate side when known.
  if (role.debateSide === 'affirmative') return 'Participant · Affirmative';
  if (role.debateSide === 'negative') return 'Participant · Negative';
  if (role.debateSide === 'observer') return 'Participant · Observer';
  return 'Participant';
}

/**
 * True when an event's actor matches the given role filter. `all` always
 * matches. `admin` / `moderator` match the app role; the side filters match
 * the debate side.
 */
export function eventMatchesRoleFilter(
  event: MetadataAuditEvent,
  filter: AuditRoleFilter,
): boolean {
  if (filter === 'all') return true;
  const role = event.actorRole;
  if (!role) return false;
  if (filter === 'admin') return role.appRole === 'admin';
  if (filter === 'moderator') return role.appRole === 'moderator';
  // Side filters — the actor's current debate side.
  return role.debateSide === filter;
}

// ── Composite filter ──────────────────────────────────────────

/**
 * Apply the search box + the three chip filters to a loaded event list.
 * Pure, deterministic, order-preserving — the input list is already sorted
 * by the loader, so this never re-sorts.
 */
export function filterMetadataAuditEvents(
  events: MetadataAuditEvent[],
  filters: MetadataAuditFilters,
): MetadataAuditEvent[] {
  const needle = filters.search.trim().toLowerCase();
  return events.filter((e) => {
    if (filters.tagCode !== 'all' && e.tagCode !== filters.tagCode) return false;
    if (filters.kind !== 'all' && e.kind !== filters.kind) return false;
    if (!eventMatchesRoleFilter(e, filters.role)) return false;
    if (needle.length > 0) {
      const haystack = [
        e.argumentExcerpt ?? '',
        e.actorDisplayName ?? '',
        e.debateTitle ?? '',
        e.tagPlainLabel,
      ].join(' ').toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}
