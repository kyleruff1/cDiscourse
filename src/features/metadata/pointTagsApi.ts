/**
 * META-1A — Client wrapper + adapter for the persisted manual-tag ledger.
 *
 * Owns:
 *   - `PersistedPointTag` — the client TypeScript shape mirroring a
 *     `public.point_tags` row.
 *   - `applyManualTag` / `removeManualTag` — typed wrappers that route
 *     through the `apply-manual-tag` Edge Function. This file NEVER inserts
 *     or updates `point_tags` directly: the Edge Function is the single
 *     write path.
 *   - `persistedTagsToManualTagEntries` — a pure adapter that converts
 *     persisted rows into META-001 `ManualTagEntry[]`, grouped by
 *     argumentId, for `buildMoveMetadataLedger`'s `manualTagsByMessageId`.
 *
 * Doctrine: a manual tag is a participant gameplay annotation, never a
 * verdict. This file imports no service-role / Anthropic keys; the wrapper
 * only calls `supabase.functions.invoke`.
 */
import { supabase } from '../../lib/supabase';
import { makeManualTagDedupeKey } from './manualTagModel';
import type { ManualTagCode, ManualTagEntry } from './moveMetadataLedger';

// ── Persisted-row shape ───────────────────────────────────────

/** A persisted manual-tag row. Mirrors `public.point_tags` (active rows). */
export interface PersistedPointTag {
  id: string;
  debateId: string;
  argumentId: string;
  tagCode: ManualTagCode;
  /** profiles.id of the applier. */
  taggedBy: string;
  /** ISO-8601. */
  createdAt: string;
  /** ISO-8601 when soft-deleted; null while active. */
  removedAt: string | null;
}

// ── Edge Function request / response types ────────────────────

export interface ApplyManualTagInput {
  debateId: string;
  argumentId: string;
  tagCode: ManualTagCode;
}

/** One active tag in the Edge Function response. */
export interface ApplyManualTagActiveTag {
  id: string;
  tagCode: ManualTagCode;
  /** profiles.id — opaque id only, never an email or display name. */
  taggedBy: string;
  createdAt: string;
}

export interface ApplyManualTagResponse {
  argumentId: string;
  /** The full set of ACTIVE tags on the argument after the mutation. */
  activeTags: ApplyManualTagActiveTag[];
}

export interface ApplyManualTagOutcome {
  ok: true;
  data: ApplyManualTagResponse;
}

export interface ApplyManualTagFailure {
  ok: false;
  error: { error: string; reason?: string; detail?: string };
  status: number;
}

export type ApplyManualTagResult = ApplyManualTagOutcome | ApplyManualTagFailure;

// ── Internal — invoke the Edge Function ───────────────────────

async function invokeApplyManualTag(
  action: 'apply' | 'remove',
  input: ApplyManualTagInput,
): Promise<ApplyManualTagResult> {
  const { data, error } = await supabase.functions.invoke<ApplyManualTagResponse>(
    'apply-manual-tag',
    {
      body: {
        action,
        debateId: input.debateId,
        argumentId: input.argumentId,
        tagCode: input.tagCode,
      },
    },
  );

  if (error) {
    let errorBody: { error: string; reason?: string; detail?: string } = { error: 'network_error' };
    try {
      const raw = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (raw?.json) {
        errorBody = (await raw.json()) as { error: string; reason?: string; detail?: string };
      }
    } catch {
      // ignore parse failures
    }
    const status =
      (error as { status?: number }).status ??
      ((error as { name?: string }).name === 'FunctionsFetchError' ? 503 : 500);
    return { ok: false, error: errorBody, status };
  }

  if (!data) {
    return { ok: false, error: { error: 'empty_response' }, status: 500 };
  }

  return { ok: true, data };
}

// ── Public wrappers ───────────────────────────────────────────

/** Apply a manual tag to a move via the apply-manual-tag Edge Function. */
export async function applyManualTag(
  input: ApplyManualTagInput,
): Promise<ApplyManualTagResult> {
  return invokeApplyManualTag('apply', input);
}

/** Soft-delete (remove) a manual tag the caller previously applied. */
export async function removeManualTag(
  input: ApplyManualTagInput,
): Promise<ApplyManualTagResult> {
  return invokeApplyManualTag('remove', input);
}

// ── Pure adapter ──────────────────────────────────────────────

/**
 * Convert persisted `point_tags` rows into META-001 `ManualTagEntry[]`,
 * grouped by `argumentId`, for `buildMoveMetadataLedger`'s
 * `manualTagsByMessageId` input.
 *
 * - Rows with `removedAt != null` are dropped (soft-deleted).
 * - `dedupeKey` is reconstructed via `makeManualTagDedupeKey(code,
 *   taggedBy)` so it matches META-001's in-memory key exactly.
 * - `appliedByActorRole` is set to a stable placeholder
 *   (`'participant_affirmative'`): `point_tags` does not persist the
 *   actor role (it can change over time), and no consumer of *persisted*
 *   tags reads that field — only `code` + `dedupeKey` are load-bearing
 *   for rendering. This is a documented limitation (design Edge case #11).
 *
 * Pure. No network. No mutation of the input.
 */
export function persistedTagsToManualTagEntries(
  rows: PersistedPointTag[],
): Map<string, ManualTagEntry[]> {
  const out = new Map<string, ManualTagEntry[]>();
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    if (!row) continue;
    if (row.removedAt != null) continue;
    const entry: ManualTagEntry = {
      code: row.tagCode,
      appliedByUserId: row.taggedBy,
      appliedByActorRole: 'participant_affirmative',
      appliedAt: row.createdAt,
      dedupeKey: makeManualTagDedupeKey(row.tagCode, row.taggedBy),
      note: null,
    };
    const list = out.get(row.argumentId);
    if (list) {
      list.push(entry);
    } else {
      out.set(row.argumentId, [entry]);
    }
  }
  return out;
}
