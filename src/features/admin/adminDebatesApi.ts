/**
 * ADMIN-CONV-INACTIVE-001 — Admin Debates tab loader.
 *
 * Reads recent `public.debates` rows joined with `public.profiles`
 * (display name) for the creator. Admin RLS already permits the SELECT via
 * the `is_moderator_or_admin()` arm of the debates SELECT policy; no Edge
 * Function or service-role path is needed for the read.
 *
 * Pure data layer — no UI imports.
 *
 * FK-PINNING (OPS-ADMIN-ARGS-PROFILES-EMBED-001 lesson, applied debate-side):
 *   After this card's migration, `public.debates` has TWO FKs to
 *   `public.profiles` — `created_by → debates_created_by_fkey` (initial schema)
 *   and `inactive_by → debates_inactive_by_fkey` (this card). A bare
 *   `profiles(...)` embed is therefore ambiguous and PostgREST rejects it.
 *   We pin the creator FK (`profiles!debates_created_by_fkey(...)`) so the
 *   relationship resolves; the returned JSON key stays `profiles`. We
 *   intentionally do NOT embed the inactivator's profile (`inactive_by`) —
 *   doctrine §10a (never surface who inactivated a row).
 */
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import type { AdminDebateRow } from './types';

export type AdminDebatesSortField = 'updated_at' | 'created_at';
export type AdminDebatesSortDirection = 'desc' | 'asc';

export interface LoadAdminDebatesOptions {
  /** Cap rows returned. Defaults to 50. Clamped to [1, 500]. */
  limit?: number;
  /** Sort column. Defaults to `updated_at`. */
  sortField?: AdminDebatesSortField;
  /** Sort direction. Defaults to `desc` (newest first). */
  sortDirection?: AdminDebatesSortDirection;
  /**
   * When true, includes inactive rows (`inactive_at IS NOT NULL`). Default
   * `false`. The admin Show-inactives toggle drives this; admin posture is
   * already gated by RLS (`is_moderator_or_admin()`).
   */
  includeInactives?: boolean;
}

interface RawDebateRow {
  id: string;
  title: string | null;
  resolution: string;
  status: string;
  visibility: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // ADMIN-CONV-INACTIVE-001 — lifecycle visibility columns. All nullable.
  // `inactive_reason` is admin-only; the loader row carries it but the render
  // view-model (toAdminDebateRowView) STRUCTURALLY omits it (doctrine §10a).
  inactive_at: string | null;
  inactive_by: string | null;
  inactive_reason: string | null;
  // Creator profile, FK-pinned to debates_created_by_fkey. The JSON key stays
  // `profiles`. The inactivator's profile is NEVER embedded.
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
}

function asDisplayName(j: RawDebateRow['profiles']): string | null {
  if (!j) return null;
  if (Array.isArray(j)) return j[0]?.display_name ?? null;
  return j.display_name ?? null;
}

export async function loadAdminDebates(options: LoadAdminDebatesOptions = {}): Promise<AdminDebateRow[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const sortField: AdminDebatesSortField = options.sortField === 'created_at' ? 'created_at' : 'updated_at';
  const sortDirection: AdminDebatesSortDirection = options.sortDirection === 'asc' ? 'asc' : 'desc';

  let q = supabase
    .from('debates')
    .select(
      [
        'id', 'title', 'resolution', 'status', 'visibility', 'created_by',
        'created_at', 'updated_at',
        'inactive_at', 'inactive_by', 'inactive_reason',
        // FK-pinned creator embed. `debates` has two FKs to `profiles`
        // (created_by + inactive_by from this card); a bare `profiles(...)`
        // embed is ambiguous and PostgREST rejects it. We intentionally do
        // NOT embed the inactivator's profile (§10a).
        'profiles!debates_created_by_fkey(display_name)',
      ].join(','),
    )
    .order(sortField, { ascending: sortDirection === 'asc' })
    .limit(limit);

  // ADMIN-CONV-INACTIVE-001 — Show-inactives toggle. Default OFF: SQL-layer
  // exclusion of `inactive_at IS NOT NULL` rows. Admin RLS already permits
  // SELECTing inactive rows; this predicate is the loader-side filter that
  // backs the Show-inactives toggle.
  if (!options.includeInactives) q = q.is('inactive_at', null);

  const { data, error } = await q;
  if (error) throw new Error(`loadAdminDebates failed: ${error.message}`);
  const rows = (data ?? []) as unknown as RawDebateRow[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    resolution: r.resolution,
    status: r.status,
    visibility: r.visibility,
    createdBy: r.created_by,
    createdByDisplayName: asDisplayName(r.profiles),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    inactiveAt: r.inactive_at,
    inactiveBy: r.inactive_by,
    inactiveReason: r.inactive_reason,
  }));
}
