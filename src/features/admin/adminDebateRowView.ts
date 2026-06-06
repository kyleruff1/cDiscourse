/**
 * ADMIN-CONV-INACTIVE-001 — pure projector from the admin loader row
 * (`AdminDebateRow`) to the render view-model (`AdminDebateRowView`).
 *
 * This is the §10a leak gate, expressed in the type system. The projector
 * DROPS `inactiveReason` (and `inactiveBy`) so the rendered view-model has no
 * field carrying the admin-only reason — the admin sees WHAT is inactive (an
 * `inactiveAt`-derived badge), never WHY, on any rendered surface.
 *
 * Pure-TS: no React, no Supabase, no fetch — unit-testable in isolation.
 */
import type { AdminDebateRow, AdminDebateRowView } from './types';

/**
 * Project a loader row onto the reason-free render view-model. `isInactive` is
 * derived from `inactiveAt` only; `inactiveReason` and `inactiveBy` are dropped
 * at this boundary and never reach a rendered surface.
 */
export function toAdminDebateRowView(row: AdminDebateRow): AdminDebateRowView {
  return {
    id: row.id,
    title: row.title,
    resolution: row.resolution,
    status: row.status,
    visibility: row.visibility,
    createdByDisplayName: row.createdByDisplayName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    inactiveAt: row.inactiveAt,
    isInactive: row.inactiveAt !== null,
  };
}
