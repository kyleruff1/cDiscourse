/**
 * INTEL-002 (#901) — specificity KPI readout copy (pure TypeScript).
 *
 * The admin-only advisory readout strings, in ONE place so the ban-list test has
 * a single surface to scan. Literal counts (design D9) — never a verdict, never a
 * per-person score. Ban-list clean.
 */
import type {
  AggregateSpecificityKpi,
  RoomSpecificityKpi,
} from '../intel/markerSpecificityModel';

/**
 * The marker-visibility caveat: timestamp_markers RLS is circle/room-scoped, so
 * the admin aggregate covers only rooms whose markers this admin can see. The
 * copy is honest about that bound rather than fabricating a global number.
 */
export const SPECIFICITY_VISIBILITY_CAVEAT = 'Counts reflect markers visible to you.';

/** Per-room chip: a literal "N of M replies pinned a moment", or "No replies yet". */
export function roomSpecificityChipText(kpi: RoomSpecificityKpi): string {
  if (kpi.totalReplies === 0) return 'No replies yet';
  return `${kpi.markerLinkedReplies} of ${kpi.totalReplies} replies pinned a moment`;
}

/** Aggregate line: a pooled literal count across the visible rooms. */
export function aggregateSpecificityText(kpi: AggregateSpecificityKpi): string {
  if (kpi.totalReplies === 0) return 'No replies loaded yet';
  const roomWord = kpi.roomCount === 1 ? 'room' : 'rooms';
  return `${kpi.markerLinkedReplies} of ${kpi.totalReplies} replies across ${kpi.roomCount} ${roomWord} pinned a moment`;
}
