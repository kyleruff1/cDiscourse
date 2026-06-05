/**
 * OPS-MCP-OBSERVABILITY-002 — typed client wrapper for the
 * admin-classifier-health Edge read function.
 *
 * Thin pass-through over `supabase.functions.invoke('admin-classifier-health')`.
 * The client never holds a service-role key — the Edge Function verifies the
 * JWT and checks `profiles.role = 'admin'` before any read. This wrapper is
 * READ-ONLY: there is no mutation action, no re-trigger, no arm/flip control.
 *
 * Doctrine:
 *   - No service key, no direct DB access — the Edge Function is the only path.
 *   - The verdict carries counts + grouping keys + plain-language labels only;
 *     never a raw row, never a body, never an evidence_span.
 */
import { supabase } from '../../lib/supabase';
import type { ClassifierHealthVerdict } from '../adminClassifierHealth/types';

/** The filter the panel sends (snake_case wire shape the Edge schema expects). */
export interface ClassifierHealthFilterInput {
  status?: string;
  state?: string;
  family?: string;
  run_mode?: string;
  failure_reason?: string;
  failure_sub_reason?: string;
  failure_detail_reason?: string;
  from_iso?: string;
  to_iso?: string;
  run_tag?: string;
}

export interface ClassifierHealthError {
  error: string;
  reason?: string;
  detail?: string;
  issues?: Array<{ path?: (string | number)[]; message: string }>;
}

export type ClassifierHealthResult =
  | { ok: true; data: ClassifierHealthVerdict }
  | { ok: false; error: ClassifierHealthError; status: number };

export type ClassifierHealthCsvResult =
  | { ok: true; csv: string }
  | { ok: false; error: ClassifierHealthError; status: number };

/** Strip undefined / empty values so the strict Edge schema never sees them. */
function cleanFilter(filter: ClassifierHealthFilterInput): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(filter)) {
    if (typeof v === 'string' && v.trim().length > 0) out[k] = v.trim();
  }
  return out;
}

async function parseInvokeError(error: unknown): Promise<{ body: ClassifierHealthError; status: number }> {
  let body: ClassifierHealthError = { error: 'network_error' };
  try {
    const raw = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (raw?.json) body = (await raw.json()) as ClassifierHealthError;
  } catch {
    /* ignore parse failures */
  }
  const status =
    (error as { status?: number }).status ??
    ((error as { name?: string }).name === 'FunctionsFetchError' ? 503 : 500);
  return { body, status };
}

/** Read the classifier-health aggregate verdict (JSON). Never throws. */
export async function loadClassifierHealth(
  filter: ClassifierHealthFilterInput = {},
): Promise<ClassifierHealthResult> {
  const { data, error } = await supabase.functions.invoke<ClassifierHealthVerdict>(
    'admin-classifier-health',
    { body: { ...cleanFilter(filter), format: 'json' } },
  );
  if (error) {
    const { body, status } = await parseInvokeError(error);
    return { ok: false, error: body, status };
  }
  if (!data) return { ok: false, error: { error: 'empty_response' }, status: 500 };
  return { ok: true, data };
}

/**
 * Export the metadata-only CSV. The function returns `text/csv`; `invoke`
 * surfaces it as a string (or Blob on some platforms — both are handled).
 * Never throws.
 */
export async function exportClassifierHealthCsv(
  filter: ClassifierHealthFilterInput = {},
): Promise<ClassifierHealthCsvResult> {
  const { data, error } = await supabase.functions.invoke<unknown>('admin-classifier-health', {
    body: { ...cleanFilter(filter), format: 'csv' },
  });
  if (error) {
    const { body, status } = await parseInvokeError(error);
    return { ok: false, error: body, status };
  }
  if (data == null) return { ok: false, error: { error: 'empty_response' }, status: 500 };
  if (typeof data === 'string') return { ok: true, csv: data };
  // Blob (web) — read as text.
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    const csv = await data.text();
    return { ok: true, csv };
  }
  // Fallback: stringify whatever shape came back.
  return { ok: true, csv: String(data) };
}

/** Map an error to operator-directed copy (no snake_case leak to the admin). */
export function classifierHealthErrorMessage(err: ClassifierHealthError, status: number): string {
  if (status === 403 || err.error === 'forbidden') return 'Admin access required.';
  if (status === 401 || err.error === 'unauthorized') return 'Sign in required.';
  if (status === 404 || err.error === 'function_not_found') {
    return 'admin-classifier-health function is not deployed yet.';
  }
  if (err.detail) return err.detail;
  if (err.reason) return err.reason;
  return err.error;
}
