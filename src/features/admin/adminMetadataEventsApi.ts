/**
 * META-1C — Admin metadata-event audit log data layer.
 *
 * Reads the META-1A `public.point_tags` table (the persisted manual-tag
 * ledger) joined to `public.arguments`, `public.debates`, and
 * `public.profiles`, and expands each row into 1 or 2 chronological audit
 * events (an `applied` event always; a `removed` event when `removed_at` is
 * set).
 *
 * Admin RLS already permits the SELECT: the `point_tags` SELECT policy
 * (`pt_select_read_access`) defers to the `arguments` SELECT policy, whose
 * admin clause (`OR is_moderator_or_admin()`) lets an admin read every row.
 * No Edge Function and no service-role path is needed — this mirrors the
 * established `adminArgumentsApi.loadAdminArguments` direct-admin-RLS-read
 * pattern verbatim.
 *
 * Pure data layer — no UI imports. The `expandPointTagRowToEvents` adapter
 * is a pure, side-effect-free function (no network, fully unit-testable).
 *
 * Doctrine: the audit surface states neutral facts ("user X applied tag Y on
 * argument Z at time T"). It renders no verdict about any person and never
 * fabricates an apply-time role — `point_tags` stores no apply-time role, so
 * the actor's CURRENT role is shown, honestly labeled.
 */
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import {
  ALL_MANUAL_TAG_CODES,
  getManualTagPlainLabel,
  type ManualTagCode,
} from '../metadata/moveMetadataLedger';

// ── Public types ──────────────────────────────────────────────

/** The kind of audit event a point_tags row expands into. */
export type MetadataAuditEventKind = 'applied' | 'removed';

/**
 * The actor's CURRENT role context — not their role at apply-time.
 * `point_tags` stores no apply-time role (META-1A deliberately omitted it),
 * so the audit surface shows the actor's current values, honestly labeled.
 */
export interface AuditActorRole {
  /** profiles.role — 'admin' | 'moderator' | 'user'. */
  appRole: 'admin' | 'moderator' | 'user';
  /**
   * debate_participants.side for the audited debate, or null when the actor
   * has no participant row (e.g. an admin who never joined the debate).
   */
  debateSide: 'affirmative' | 'negative' | 'observer' | null;
}

/**
 * One row in the AdminMetadataEventsTab. A point_tags row produces one
 * 'applied' event and (when removed_at is set) one 'removed' event.
 */
export interface MetadataAuditEvent {
  /** Stable id: `${pointTagId}:applied` or `${pointTagId}:removed`. */
  eventId: string;
  /** The source point_tags row id. */
  pointTagId: string;
  kind: MetadataAuditEventKind;
  /** ISO-8601 — created_at for 'applied', removed_at for 'removed'. */
  occurredAt: string;
  debateId: string;
  debateTitle: string | null;
  argumentId: string;
  /**
   * Short excerpt of the tagged move's body (≤ ~160 chars, whitespace
   * collapsed). Null when the argument row is not embedded.
   */
  argumentExcerpt: string | null;
  argumentSide: string | null;
  /** True when the tagged argument is soft-deleted / status 'deleted'. */
  argumentDeleted: boolean;
  tagCode: ManualTagCode;
  /** Plain-language label from gameCopy PLAIN_LANGUAGE_COPY. */
  tagPlainLabel: string;
  /** The actor of THIS event — tagger for 'applied', remover for 'removed'. */
  actorId: string | null;
  actorDisplayName: string | null;
  actorRole: AuditActorRole | null;
}

export interface LoadMetadataAuditOptions {
  /**
   * Required — the surface is always debate-scoped (the card scopes the
   * surface to a single debate). When null the loader returns [].
   */
  debateId: string | null;
  /** Cap rows fetched from point_tags. Defaults to 200, max 500. */
  limit?: number;
  /** Sort direction on occurredAt. Defaults to 'desc' (newest first). */
  sortDirection?: 'desc' | 'asc';
}

/** A debate the admin can pick in the debate selector. */
export interface AuditDebateOption {
  debateId: string;
  title: string | null;
}

// ── Raw row shapes (PostgREST embedded select) ────────────────

/** A profiles embed (tagger or remover). PostgREST may return null. */
interface RawProfileEmbed {
  id: string | null;
  display_name: string | null;
  role: string | null;
}

/** The `arguments` embed. */
interface RawArgumentEmbed {
  id: string | null;
  body: string | null;
  side: string | null;
  status: string | null;
  debate_id: string | null;
}

/** The `debates` embed. */
interface RawDebateEmbed {
  id: string | null;
  title: string | null;
}

/**
 * One raw `point_tags` row as returned by the embedded select. PostgREST
 * returns to-one embeds as either an object or a single-element array
 * depending on the relation cardinality; we normalize both.
 */
export interface RawPointTagAuditRow {
  id: string | null;
  debate_id: string | null;
  argument_id: string | null;
  tag_code: string | null;
  tagged_by: string | null;
  created_at: string | null;
  removed_at: string | null;
  removed_by: string | null;
  arguments: RawArgumentEmbed | RawArgumentEmbed[] | null;
  debates: RawDebateEmbed | RawDebateEmbed[] | null;
  tagger: RawProfileEmbed | RawProfileEmbed[] | null;
  remover: RawProfileEmbed | RawProfileEmbed[] | null;
}

// ── Embed flatteners (mirror adminArgumentsApi `as*` helpers) ──

function asOne<T>(j: T | T[] | null | undefined): T | null {
  if (!j) return null;
  if (Array.isArray(j)) return j[0] ?? null;
  return j;
}

/** Coerce an arbitrary profiles.role string to the typed app-role union. */
function asAppRole(role: string | null | undefined): AuditActorRole['appRole'] {
  if (role === 'admin' || role === 'moderator') return role;
  return 'user';
}

/**
 * Coerce a debate_participants.side string to the typed audit side union.
 * The DB allows `moderator` as a side value; the audit surface treats a
 * moderator side as "no debater side" (null) — the moderator app-role is
 * surfaced separately via `appRole`. Honest, no fabricated side.
 */
export function asDebateSide(side: string | null | undefined): AuditActorRole['debateSide'] {
  if (side === 'affirmative' || side === 'negative' || side === 'observer') return side;
  return null;
}

function isManualTagCode(code: string | null | undefined): code is ManualTagCode {
  return typeof code === 'string'
    && (ALL_MANUAL_TAG_CODES as ReadonlyArray<string>).includes(code);
}

/** Whitespace-collapsed body excerpt — mirrors AdminArgumentsTab `shortenBody`. */
function shortenBody(body: string | null | undefined, max = 160): string | null {
  if (typeof body !== 'string') return null;
  const s = body.replace(/\s+/g, ' ').trim();
  if (s.length === 0) return null;
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

// ── The pure row-to-events adapter ────────────────────────────

/**
 * Expand one persisted `point_tags` row into its audit events:
 *   - always one 'applied' event (created_at / tagged_by);
 *   - one 'removed' event when removed_at is set (removed_at / removed_by).
 *
 * `actorRole.debateSide` is left null here — `loadMetadataAuditEvents` fills
 * it via the `debate_participants` lookup. `actorRole.appRole` is read from
 * the tagger/remover profile embed.
 *
 * Pure: no network, no mutation, fully unit-testable. A row this adapter
 * cannot key (null `id`) yields `[]` rather than throwing — a single bad row
 * never blanks the whole page. An unrecognized `tag_code` yields `[]` too
 * (the CHECK constraint makes this near-impossible, but the adapter never
 * trusts raw input — matches `asTagCodes` in adminArgumentsApi).
 */
export function expandPointTagRowToEvents(
  row: RawPointTagAuditRow,
): MetadataAuditEvent[] {
  if (!row || typeof row.id !== 'string' || row.id.length === 0) return [];
  if (typeof row.argument_id !== 'string' || row.argument_id.length === 0) return [];
  if (typeof row.debate_id !== 'string' || row.debate_id.length === 0) return [];
  if (!isManualTagCode(row.tag_code)) return [];
  if (typeof row.created_at !== 'string' || row.created_at.length === 0) return [];

  const tagCode = row.tag_code;
  const argument = asOne(row.arguments);
  const debate = asOne(row.debates);
  const tagger = asOne(row.tagger);
  const remover = asOne(row.remover);

  const debateTitle = debate?.title ?? null;
  const argumentExcerpt = shortenBody(argument?.body ?? null);
  const argumentSide = argument?.side ?? null;
  const argumentStatus = argument?.status ?? null;
  // Edge case #7 — admin RLS reads soft-deleted arguments; the audit event
  // still renders, with a "deleted move" sub-label so the admin knows the
  // move no longer appears in the room. Tag history is preserved.
  const argumentDeleted = argumentStatus === 'deleted';
  const tagPlainLabel = getManualTagPlainLabel(tagCode);

  const events: MetadataAuditEvent[] = [];

  // Applied event — always present.
  const appliedActorRole: AuditActorRole | null = row.tagged_by
    ? { appRole: asAppRole(tagger?.role), debateSide: null }
    : null;
  events.push({
    eventId: `${row.id}:applied`,
    pointTagId: row.id,
    kind: 'applied',
    occurredAt: row.created_at,
    debateId: row.debate_id,
    debateTitle,
    argumentId: row.argument_id,
    argumentExcerpt,
    argumentSide,
    argumentDeleted,
    tagCode,
    tagPlainLabel,
    actorId: typeof row.tagged_by === 'string' ? row.tagged_by : null,
    actorDisplayName: tagger?.display_name ?? null,
    actorRole: appliedActorRole,
  });

  // Removed event — only when removed_at is set. removed_by may be null
  // (META-1A's removed_by is `on delete set null`) — the event still renders
  // with a null actor (edge case #5).
  if (typeof row.removed_at === 'string' && row.removed_at.length > 0) {
    const removedActorRole: AuditActorRole | null = row.removed_by
      ? { appRole: asAppRole(remover?.role), debateSide: null }
      : null;
    events.push({
      eventId: `${row.id}:removed`,
      pointTagId: row.id,
      kind: 'removed',
      occurredAt: row.removed_at,
      debateId: row.debate_id,
      debateTitle,
      argumentId: row.argument_id,
      argumentExcerpt,
      argumentSide,
      argumentDeleted,
      tagCode,
      tagPlainLabel,
      actorId: typeof row.removed_by === 'string' ? row.removed_by : null,
      actorDisplayName: remover?.display_name ?? null,
      actorRole: removedActorRole,
    });
  }

  return events;
}

// ── The committed PostgREST select string ─────────────────────

/**
 * The exact `point_tags` embedded select META-1C commits. Exported so the
 * test suite can assert the shape (PostgREST disambiguates the two
 * `profiles` embeds by the FK constraint name; the `tagger:` / `remover:`
 * aliases keep the mapper readable).
 */
export const POINT_TAGS_AUDIT_SELECT =
  'id, debate_id, argument_id, tag_code, tagged_by, created_at, '
  + 'removed_at, removed_by, '
  + 'arguments!inner ( id, body, side, status, debate_id ), '
  + 'debates!inner ( id, title ), '
  + 'tagger:profiles!point_tags_tagged_by_fkey ( id, display_name, role ), '
  + 'remover:profiles!point_tags_removed_by_fkey ( id, display_name, role )';

// ── Sort ──────────────────────────────────────────────────────

/**
 * Sort expanded events chronologically by `occurredAt`. Real
 * `Date.getTime()` comparison; the secondary key is `eventId` so the order
 * is stable when two events share a millisecond (edge case #13).
 */
export function sortMetadataAuditEvents(
  events: MetadataAuditEvent[],
  direction: 'desc' | 'asc',
): MetadataAuditEvent[] {
  const sign = direction === 'asc' ? 1 : -1;
  return events.slice().sort((a, b) => {
    const ta = new Date(a.occurredAt).getTime();
    const tb = new Date(b.occurredAt).getTime();
    const safeA = Number.isNaN(ta) ? 0 : ta;
    const safeB = Number.isNaN(tb) ? 0 : tb;
    if (safeA !== safeB) return (safeA - safeB) * sign;
    // Stable secondary key — deterministic, keeps tests non-flaky.
    return a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0;
  });
}

// ── Loaders ───────────────────────────────────────────────────

/**
 * Load the chronological metadata-event audit log for one debate.
 *
 * Flow: caller-scoped `point_tags` select (RLS-gated) → pure row-to-events
 * expansion → `debate_participants` side enrichment → post-expansion
 * chronological sort. The post-expansion sort is required because a
 * `removed` event's `occurredAt` is `removed_at`, not the row's
 * `created_at` — ordering the rows alone would not order the events.
 */
export async function loadMetadataAuditEvents(
  options: LoadMetadataAuditOptions,
): Promise<MetadataAuditEvent[]> {
  if (!SUPABASE_CONFIGURED) return [];
  if (!options || options.debateId == null) return [];

  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);
  const sortDirection: 'desc' | 'asc' = options.sortDirection === 'asc' ? 'asc' : 'desc';

  const { data, error } = await supabase
    .from('point_tags')
    .select(POINT_TAGS_AUDIT_SELECT)
    .eq('debate_id', options.debateId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`loadMetadataAuditEvents failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawPointTagAuditRow[];
  const events: MetadataAuditEvent[] = [];
  for (const r of rows) {
    for (const e of expandPointTagRowToEvents(r)) events.push(e);
  }

  // Actor-side enrichment — one caller-scoped query for the whole page.
  const actorIds = Array.from(
    new Set(
      events
        .map((e) => e.actorId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );
  if (actorIds.length > 0) {
    const sideByActor = await loadActorSides(options.debateId, actorIds);
    for (const e of events) {
      if (e.actorRole && e.actorId) {
        e.actorRole.debateSide = sideByActor.get(e.actorId) ?? null;
      }
    }
  }

  return sortMetadataAuditEvents(events, sortDirection);
}

/**
 * One caller-scoped `debate_participants` query that maps each actor id to
 * their `side` in the audited debate. Admin RLS on `debate_participants`
 * permits this. An actor with no participant row is simply absent from the
 * map (the caller defaults `debateSide` to null).
 */
export async function loadActorSides(
  debateId: string,
  actorIds: string[],
): Promise<Map<string, AuditActorRole['debateSide']>> {
  const out = new Map<string, AuditActorRole['debateSide']>();
  if (!SUPABASE_CONFIGURED || actorIds.length === 0) return out;
  const { data, error } = await supabase
    .from('debate_participants')
    .select('user_id, side')
    .eq('debate_id', debateId)
    .in('user_id', actorIds);
  if (error) return out;
  for (const row of (data ?? []) as Array<{ user_id: string; side: string | null }>) {
    if (typeof row.user_id === 'string') {
      out.set(row.user_id, asDebateSide(row.side));
    }
  }
  return out;
}

/**
 * Load the debates that actually have `point_tags` rows, for the debate
 * selector. RLS scopes the result to the admin's visible set (all debates
 * for an admin). De-duped by debate_id, sorted by title.
 */
export async function loadAuditDebateOptions(): Promise<AuditDebateOption[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const { data, error } = await supabase
    .from('point_tags')
    .select('debate_id, debates!inner ( id, title )')
    .limit(1000);
  if (error) {
    throw new Error(`loadAuditDebateOptions failed: ${error.message}`);
  }
  const rows = (data ?? []) as unknown as Array<{
    debate_id: string | null;
    debates: RawDebateEmbed | RawDebateEmbed[] | null;
  }>;
  return dedupeDebateOptions(rows);
}

/**
 * Pure helper — de-dupes raw `point_tags` debate rows into a sorted, unique
 * `AuditDebateOption[]`. Extracted so it is unit-testable without a network.
 */
export function dedupeDebateOptions(
  rows: Array<{
    debate_id: string | null;
    debates: RawDebateEmbed | RawDebateEmbed[] | null;
  }>,
): AuditDebateOption[] {
  const byId = new Map<string, AuditDebateOption>();
  for (const r of rows) {
    if (typeof r.debate_id !== 'string' || r.debate_id.length === 0) continue;
    if (byId.has(r.debate_id)) continue;
    const debate = asOne(r.debates);
    byId.set(r.debate_id, { debateId: r.debate_id, title: debate?.title ?? null });
  }
  return Array.from(byId.values()).sort((a, b) => {
    const ta = (a.title ?? '').toLowerCase();
    const tb = (b.title ?? '').toLowerCase();
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.debateId < b.debateId ? -1 : 1;
  });
}
