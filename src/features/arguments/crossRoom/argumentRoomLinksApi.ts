/**
 * QOL-042 — Linked prior argument reference: API client (caller-scoped).
 *
 * Typed Supabase wrappers for `public.argument_room_links`. Every call is
 * CALLER-SCOPED — it uses the shared `supabase` client under the user's
 * own JWT. RLS + the two BEFORE triggers do the enforcement (QOL-042
 * design §5.4 / §7):
 *
 *   - `listLinksForRoom`        — SELECT links on a source room.
 *   - `createArgumentRoomLink`  — INSERT a link (RLS + trigger gate it).
 *   - `removeArgumentRoomLink`  — UPDATE … SET is_removed = true.
 *   - `loadPriorRoomContext`    — caller-scoped SELECT on `debates` +
 *     `arguments` for the prior room. RLS returns argument rows ONLY to
 *     an authorized viewer; this function INSPECTS what came back to set
 *     the `LinkAccessState`.
 *
 * Doctrine anchors (cdiscourse-doctrine §6 / §8, supabase-edge-contract,
 * QOL-042 design §10):
 *
 *   - No service-role client. This file imports only the shared `supabase`
 *     client; it constructs no `createClient`. RLS is the guard.
 *   - No direct insert into `public.arguments`. The link is NOT an
 *     argument — `submit-argument` is never called from this module. The
 *     link writes only its own `argument_room_links` row.
 *   - Soft-remove only — `removeArgumentRoomLink` sets `is_removed = true`;
 *     it never DELETEs. There is no DELETE policy on the table.
 *   - A duplicate link (same source → target) is idempotent success — the
 *     `one_link_per_pair` UNIQUE conflict (Postgres code 23505) is treated
 *     as a no-op, not an error.
 *   - The access check is RLS-enforced server-side. `loadPriorRoomContext`
 *     only RENDERS the outcome: empty `arguments` rows → `title_only`;
 *     argument rows present → `authorized`; nothing resolvable →
 *     `unavailable`. The client never branches on a UI-only access guess.
 */
import { supabase, SUPABASE_CONFIGURED } from '../../../lib/supabase';
import type {
  ArgumentRoomLink,
  LinkAccessState,
  PriorRoomSummary,
} from './linkedPriorArgumentModel';
import {
  MAX_LINK_TARGET_CANDIDATES,
  type LinkTargetCandidate,
} from './linkTargetPickerModel';

// ── Result envelope ────────────────────────────────────────────

/** A uniform result envelope for the QOL-042 API calls. */
export type ArgumentRoomLinkResult<T> =
  | { ok: true; data: T; duplicate?: boolean }
  | { ok: false; error: string };

// ── Row shapes (the on-the-wire `argument_room_links` row) ──────

interface ArgumentRoomLinkRow {
  id: string;
  source_debate_id: string;
  target_debate_id: string;
  created_by: string;
  target_title_snapshot: string;
  note: string;
  is_removed: boolean;
  created_at: string;
}

/** The column list selected for an `argument_room_links` row. */
const LINK_COLUMNS =
  'id, source_debate_id, target_debate_id, created_by, target_title_snapshot, note, is_removed, created_at';

/** Maps an on-the-wire row to the domain `ArgumentRoomLink`. */
function mapLinkRow(row: ArgumentRoomLinkRow): ArgumentRoomLink {
  return {
    id: row.id,
    sourceDebateId: row.source_debate_id,
    targetDebateId: row.target_debate_id,
    createdBy: row.created_by,
    targetTitleSnapshot: row.target_title_snapshot ?? '',
    note: row.note ?? '',
    isRemoved: row.is_removed === true,
    createdAt: row.created_at,
  };
}

/** True when a Supabase error is a UNIQUE-key violation (duplicate link). */
export function isDuplicateLinkError(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505';
}

// ── listLinksForRoom ───────────────────────────────────────────

/**
 * Lists the active (`is_removed = false`) links whose SOURCE is
 * `sourceDebateId`, oldest first — the deterministic chip-row order
 * (QOL-042 design §8 "multiple links … created_at ASC"). RLS already
 * excludes removed rows and gates on source-room visibility.
 */
export async function listLinksForRoom(
  sourceDebateId: string,
): Promise<ArgumentRoomLinkResult<ArgumentRoomLink[]>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };
  if (!sourceDebateId) return { ok: false, error: 'sourceDebateId required' };

  const { data, error } = await supabase
    .from('argument_room_links')
    .select(LINK_COLUMNS)
    .eq('source_debate_id', sourceDebateId)
    .eq('is_removed', false)
    .order('created_at', { ascending: true });

  if (error) {
    return { ok: false, error: `listLinksForRoom failed: ${sanitizeError(error)}` };
  }
  const rows = (data ?? []) as ArgumentRoomLinkRow[];
  return { ok: true, data: rows.map(mapLinkRow) };
}

// ── createArgumentRoomLink ─────────────────────────────────────

/** Input to `createArgumentRoomLink`. */
export interface CreateArgumentRoomLinkInput {
  /** The NEW room that will carry the chip. */
  sourceDebateId: string;
  /** The PRIOR settled room being referenced. */
  targetDebateId: string;
  /**
   * The prior room's title at link-creation time. The link author IS
   * authorized on the target at creation, so they can read it. ≤ 200
   * chars (the DB CHECK clamps; longer titles are trimmed here first).
   */
  targetTitleSnapshot: string;
  /** Optional one-line reason. ≤ 280 chars (trimmed + clamped here). */
  note?: string;
  /** `profiles.id` of the link author — must equal the caller (RLS check). */
  createdBy: string;
}

/** Max length of the snapshot title — mirrors the DB CHECK. */
export const MAX_TARGET_TITLE_SNAPSHOT_CHARS = 200;
/** Max length of the link note — mirrors the DB CHECK. */
export const MAX_LINK_NOTE_CHARS = 280;

/**
 * Inserts an `argument_room_links` row. RLS (`created_by = auth.uid()` +
 * source-room participant) and the `link_target_must_be_locked` trigger
 * (target is `locked` + readable) gate the write — the client does not
 * re-implement those checks.
 *
 * A `one_link_per_pair` UNIQUE conflict is treated as IDEMPOTENT SUCCESS:
 * the existing link row is fetched and returned, so re-linking a prior
 * room is a safe no-op (QOL-042 design §8).
 *
 * The link is NOT an argument — this never calls `submit-argument` and
 * never writes `public.arguments`.
 */
export async function createArgumentRoomLink(
  input: CreateArgumentRoomLinkInput,
): Promise<ArgumentRoomLinkResult<ArgumentRoomLink>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };
  if (!input.sourceDebateId || !input.targetDebateId) {
    return { ok: false, error: 'sourceDebateId and targetDebateId required' };
  }
  if (input.sourceDebateId === input.targetDebateId) {
    return { ok: false, error: 'A room cannot reference itself.' };
  }
  if (!input.createdBy) return { ok: false, error: 'createdBy required' };

  const titleSnapshot = String(input.targetTitleSnapshot ?? '')
    .trim()
    .slice(0, MAX_TARGET_TITLE_SNAPSHOT_CHARS);
  const note = String(input.note ?? '')
    .trim()
    .slice(0, MAX_LINK_NOTE_CHARS);

  const { data, error } = await supabase
    .from('argument_room_links')
    .insert({
      source_debate_id: input.sourceDebateId,
      target_debate_id: input.targetDebateId,
      created_by: input.createdBy,
      target_title_snapshot: titleSnapshot,
      note,
    })
    .select(LINK_COLUMNS)
    .single();

  if (error) {
    // A duplicate link is idempotent success — fetch and return the
    // existing active row for this (source, target) pair.
    if (isDuplicateLinkError(error)) {
      const existing = await supabase
        .from('argument_room_links')
        .select(LINK_COLUMNS)
        .eq('source_debate_id', input.sourceDebateId)
        .eq('target_debate_id', input.targetDebateId)
        .eq('is_removed', false)
        .maybeSingle();
      if (!existing.error && existing.data) {
        return {
          ok: true,
          data: mapLinkRow(existing.data as ArgumentRoomLinkRow),
          duplicate: true,
        };
      }
    }
    return { ok: false, error: `createArgumentRoomLink failed: ${sanitizeError(error)}` };
  }
  if (!data) {
    return {
      ok: false,
      error:
        'createArgumentRoomLink failed: no row returned (the prior argument may not be settled, or you may not be a participant of this room).',
    };
  }
  return { ok: true, data: mapLinkRow(data as ArgumentRoomLinkRow) };
}

// ── removeArgumentRoomLink ─────────────────────────────────────

/**
 * Soft-removes a link — `UPDATE … SET is_removed = true`. The link author
 * or an admin may do this (RLS). The `link_columns_immutable` trigger
 * permits the `is_removed` change and rejects any other column edit. The
 * link is NEVER hard-deleted; the prior room is untouched.
 */
export async function removeArgumentRoomLink(
  linkId: string,
): Promise<ArgumentRoomLinkResult<{ linkId: string }>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };
  if (!linkId) return { ok: false, error: 'linkId required' };

  const { data, error } = await supabase
    .from('argument_room_links')
    .update({ is_removed: true })
    .eq('id', linkId)
    .select('id')
    .maybeSingle();

  if (error) {
    return { ok: false, error: `removeArgumentRoomLink failed: ${sanitizeError(error)}` };
  }
  if (!data) {
    return {
      ok: false,
      error:
        'removeArgumentRoomLink failed: no row updated (the link is missing, or you are not its author).',
    };
  }
  return { ok: true, data: { linkId: (data as { id: string }).id } };
}

// ── listLinkTargetCandidates ───────────────────────────────────

/**
 * The `debates` row shape read for a link-target candidate. `circle_id`
 * exists on `debates` (PRIVATE-GROUPS-002) but is not carried by the shared
 * `Debate` type; the picker reads it here rather than widening that type.
 */
interface LinkTargetCandidateRow {
  id: string;
  title: string | null;
  status: string | null;
  circle_id: string | null;
}

/**
 * Lists the PRIOR rooms the caller may reference from `currentDebateId` —
 * a caller-scoped `.select()` on `debates`, NOT a free-text search
 * (QUOTE-FORGE-001 design §Picker · Query). RLS returns only the rooms the
 * caller can already read; the `status = 'locked'` filter mirrors the
 * `link_target_must_be_locked` trigger so the picker never offers a room a
 * create would be rejected on. Recency-ordered (`updated_at desc`, an
 * ACTIVITY fact — never heat / score). Fetches `MAX + 1` rows so the caller
 * can flag "more not shown" without a second count query.
 *
 * The current room is excluded server-side (`.neq('id', current)`). Each
 * row maps to a `LinkTargetCandidate` with `sameCircle = false` — the pure
 * `buildLinkTargetPickerModel` sets the real `sameCircle` flag against the
 * current room's circle id.
 */
export async function listLinkTargetCandidates(
  currentDebateId: string,
): Promise<ArgumentRoomLinkResult<LinkTargetCandidate[]>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };
  if (!currentDebateId) return { ok: false, error: 'currentDebateId required' };

  const { data, error } = await supabase
    .from('debates')
    .select('id, title, status, circle_id')
    .eq('status', 'locked')
    .neq('id', currentDebateId)
    .order('updated_at', { ascending: false })
    .limit(MAX_LINK_TARGET_CANDIDATES + 1);

  if (error) {
    return { ok: false, error: `listLinkTargetCandidates failed: ${sanitizeError(error)}` };
  }
  const rows = (data ?? []) as LinkTargetCandidateRow[];
  const candidates: LinkTargetCandidate[] = rows.map((row) => ({
    debateId: row.id,
    title: row.title ?? '',
    circleId: row.circle_id ?? null,
    sameCircle: false,
  }));
  return { ok: true, data: candidates };
}

// ── loadCurrentRoomCircleId ────────────────────────────────────

/**
 * Reads the current room's `circle_id` (PRIVATE-GROUPS-002) so the picker
 * can segment same-circle candidates first. The shared `Debate` type does
 * not carry `circle_id`, so this one-row caller-scoped read supplies it
 * without widening that type / the `listDebates` select. Every room today
 * has `circle_id = null` (zero backfill), so this returns `null` until
 * circles carry rooms. RLS gates the read to a room the caller can see.
 */
export async function loadCurrentRoomCircleId(
  currentDebateId: string,
): Promise<ArgumentRoomLinkResult<string | null>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };
  if (!currentDebateId) return { ok: false, error: 'currentDebateId required' };

  const { data, error } = await supabase
    .from('debates')
    .select('circle_id')
    .eq('id', currentDebateId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: `loadCurrentRoomCircleId failed: ${sanitizeError(error)}` };
  }
  const row = data as { circle_id: string | null } | null;
  return { ok: true, data: row?.circle_id ?? null };
}

// ── loadPriorRoomContext ───────────────────────────────────────

/** The result of resolving a prior room's context. */
export interface PriorRoomContext {
  /** The viewer's access to the prior room's content. */
  accessState: LinkAccessState;
  /** The read-only prior-room summary for `buildLinkedPriorArgumentChip`. */
  summary: PriorRoomSummary;
}

/**
 * Resolves a prior (target) room's context under the caller's JWT
 * (QOL-042 design §6.4 / §7.5).
 *
 * Two caller-scoped reads:
 *   1. `SELECT id, title, status FROM debates WHERE id = <target>`.
 *      Today (QOL-039 absent) the `debates` SELECT policy returns this row
 *      for any open/locked room — so a live title is generally available.
 *      Once QOL-039 lands a non-participant gets zero rows for a private
 *      room and the live title is absent (the chip then falls back to the
 *      link's snapshot title).
 *   2. `SELECT id FROM arguments WHERE debate_id = <target> AND
 *      status = 'posted'`. The existing `arguments` SELECT policy returns
 *      rows ONLY to an authorized reader. Zero rows back → the viewer is
 *      not authorized.
 *
 * Access derivation — the function INSPECTS the RLS outcome, it does not
 * guess:
 *   - argument rows came back            → `authorized`.
 *   - zero argument rows, debates row OK → `title_only` (the room exists
 *     and is readable as metadata, but its content is gated).
 *   - neither resolvable                 → `unavailable`.
 *
 * `moveCount` is the count of posted argument rows the caller could read —
 * an ACTIVITY fact, never a score. `resolvedTangentCount` is left to the
 * caller's tangent fetch (this function does not classify tangents).
 */
export async function loadPriorRoomContext(
  targetDebateId: string,
): Promise<ArgumentRoomLinkResult<PriorRoomContext>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };
  if (!targetDebateId) return { ok: false, error: 'targetDebateId required' };

  // Read 1 — the prior room's `debates` row (id, title, status). RLS
  // decides whether the caller may see it at all.
  const debateRes = await supabase
    .from('debates')
    .select('id, title, status')
    .eq('id', targetDebateId)
    .maybeSingle();

  if (debateRes.error) {
    return { ok: false, error: `loadPriorRoomContext failed: ${sanitizeError(debateRes.error)}` };
  }
  const debateRow = debateRes.data as
    | { id: string; title: string; status: string }
    | null;

  // Read 2 — the prior room's posted argument rows. RLS returns rows ONLY
  // to an authorized reader; a non-authorized reader gets zero rows.
  // ADMIN-ARGS-INACTIVE-001 — belt-and-braces filter; RLS already excludes
  // inactive rows for non-admin viewers.
  const argsRes = await supabase
    .from('arguments')
    .select('id')
    .eq('debate_id', targetDebateId)
    .eq('status', 'posted')
    .is('inactive_at', null);

  if (argsRes.error) {
    return { ok: false, error: `loadPriorRoomContext failed: ${sanitizeError(argsRes.error)}` };
  }
  const argumentRows = (argsRes.data ?? []) as Array<{ id: string }>;
  const hasArgumentRows = argumentRows.length > 0;

  // Derive the access state purely from what RLS returned.
  let accessState: LinkAccessState;
  if (hasArgumentRows) {
    accessState = 'authorized';
  } else if (debateRow) {
    // The room is readable as metadata but its content is gated.
    accessState = 'title_only';
  } else {
    accessState = 'unavailable';
  }

  const summary: PriorRoomSummary = {
    liveTitle: debateRow ? debateRow.title ?? null : null,
    moveCount: hasArgumentRows ? argumentRows.length : null,
    // resolvedTangentCount is set by the caller's tangent fetch — this
    // function does not classify tangent nodes.
    resolvedTangentCount: null,
  };

  return { ok: true, data: { accessState, summary } };
}

// ── Internal — error sanitisation ──────────────────────────────

/**
 * Trims a Supabase error to a short, safe message before it reaches the
 * UI. Never echoes a key, a header, or a JWT (a Supabase `PostgrestError`
 * carries none of those, but the clamp is defensive).
 */
function sanitizeError(error: { message?: string } | null | undefined): string {
  return String(error?.message ?? 'unknown error').slice(0, 240);
}
