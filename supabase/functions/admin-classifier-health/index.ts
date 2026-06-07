/**
 * admin-classifier-health — OPS-MCP-OBSERVABILITY-002.
 *
 * Admin-gated, JWT-verified Edge READ function that aggregates the health of
 * `public.argument_machine_observation_runs` into COUNTS ONLY (plus a
 * metadata-only CSV export). It is the FIRST READER of the `failure_detail`
 * jsonb column (write-only until now).
 *
 * Acceptance-gate invariant (binding):
 *   "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The
 *    deterministic rules engine, src/lib/constitution/engine.ts, is the sole
 *    gate. Classifiers run after an argument is stored. No path may block,
 *    reject, route, or delay an ordinary user post."
 * This is an OPERATIONAL DIAGNOSTIC READ surface. No write path, no
 * re-trigger, no routing control, no productionEnabled flip. It cannot
 * block/route/delay any user post.
 *
 * Security model (mirrors admin-users):
 *   - verify_jwt = true (config.toml + platform default).
 *   - requireAdmin(req): Authorization → auth.getUser() → profiles.role='admin'
 *     via service-role. Missing/invalid token → 401; non-admin → 403.
 *   - The service-role client is used ONLY after the admin check.
 *   - NEVER logs the Authorization header, the service-role key, or any secret.
 *
 * Leak boundary (cdiscourse-doctrine §6):
 *   - The SELECT is COLUMN-EXPLICIT. It lists ONLY: status, state,
 *     failure_reason, failure_sub_reason, dead_letter_reason, run_mode,
 *     requested_families, family, started_at, completed_at, failure_detail.
 *     It NEVER selects `body`, NEVER joins `argument_machine_observation_results`,
 *     NEVER touches `evidence_span`, NEVER `SELECT *`.
 *   - `failure_detail` is read STRICTLY through the RunRowFailureDetail
 *     allow-list keys (validator_path / reason / family / correlation_id /
 *     attempt_count / run_mode / schema_version). An unexpected key is ignored.
 *   - When a runTag filter is supplied, `debates(title, run_tag)` is joined —
 *     the room TITLE plus the durable `run_tag` column only (never a body,
 *     never a span). The durable `run_tag` is the canonical runTag
 *     (DEVEX-RUNTAG-COLUMN-SWAP-001); the title is the legacy fallback (the
 *     model reads only its trailing `[<runTag> tNN]` suffix). run_tag carries
 *     no new sensitivity beyond the title (per the #476 migration comment).
 *   - Before returning, `containsForbiddenSubstring` (mirroring
 *     cutover-health-monitor) scrubs the JSON + CSV; a hit drops to an error
 *     rather than leak.
 *
 * No provider-spend path. This function never calls Anthropic / xAI / the MCP
 * server / submit-argument / classify-argument-boolean-observations.
 *
 * Server-only file under supabase/functions/; never imported by src/ or app/.
 */
import {
  corsHeaders,
  ok,
  unauthorized,
  forbidden,
  methodNotAllowed,
  validationFailed,
  internalError,
} from '../_shared/http.ts';
import { requireAdmin } from '../_shared/adminAuth.ts';
import type { createServiceClient } from '../_shared/supabaseClients.ts';
import { AdminClassifierHealthRequestSchema } from '../_shared/adminClassifierHealthSchemas.ts';
import { aggregateClassifierHealth } from '../_shared/adminClassifierHealth/classifierHealthModel.ts';
import { buildClassifierHealthCsv } from '../_shared/adminClassifierHealth/classifierHealthCsv.ts';
import { containsForbiddenSubstring } from '../_shared/cutoverHealthAlertModel.ts';
import type {
  ClassifierHealthRunRow,
  ClassifierHealthFailureDetail,
  ClassifierHealthFilter,
} from '../_shared/adminClassifierHealth/types.ts';

/**
 * The EXPLICIT column allow-list for the aggregate read. NEVER `*`. NEVER
 * `body`. NEVER a join to results / evidence_span. When a runTag filter is
 * supplied, a `debates(title, run_tag)` join is added — the room TITLE (for the
 * legacy suffix fallback) plus the durable `run_tag` column (the canonical
 * runTag, DEVEX-RUNTAG-COLUMN-SWAP-001). Both carry no new sensitivity beyond
 * the title (per the #476 migration comment); only counts are surfaced.
 */
const RUN_COLUMNS =
  'status, state, failure_reason, failure_sub_reason, dead_letter_reason, run_mode, requested_families, family, started_at, completed_at, failure_detail';
const RUN_COLUMNS_WITH_DEBATE = `${RUN_COLUMNS}, debates(title, run_tag)`;

/** Cap the rows pulled per request — an aggregate read, not a row dump. */
const MAX_RUN_ROWS = 50_000;

/**
 * Read `failure_detail` STRICTLY through the RunRowFailureDetail allow-list.
 * Any other key on the stored jsonb is IGNORED (never echoed). Returns `null`
 * when no allow-listed field is present.
 */
function readFailureDetailAllowListed(raw: unknown): ClassifierHealthFailureDetail | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: ClassifierHealthFailureDetail = {};
  if (typeof src.validator_path === 'string') out.validator_path = src.validator_path;
  if (typeof src.reason === 'string') out.reason = src.reason;
  if (typeof src.family === 'string') out.family = src.family;
  if (typeof src.correlation_id === 'string') out.correlation_id = src.correlation_id;
  if (typeof src.attempt_count === 'number') out.attempt_count = src.attempt_count;
  if (typeof src.run_mode === 'string') out.run_mode = src.run_mode;
  if (typeof src.schema_version === 'string') out.schema_version = src.schema_version;
  return Object.keys(out).length > 0 ? out : null;
}

/** Map a raw DB row (allow-listed columns only) to the model row shape. */
function toModelRow(raw: Record<string, unknown>): ClassifierHealthRunRow {
  const families = Array.isArray(raw.requested_families)
    ? (raw.requested_families as unknown[]).filter((f): f is string => typeof f === 'string')
    : null;
  // `debates(title, run_tag)` arrives as a nested object (or array) when
  // joined; read ONLY the title string + the durable run_tag string.
  let debateTitle: string | null = null;
  let debateRunTag: string | null = null;
  const debates = raw.debates as unknown;
  if (debates && typeof debates === 'object') {
    const d = Array.isArray(debates) ? debates[0] : debates;
    if (d && typeof d === 'object') {
      const dr = d as Record<string, unknown>;
      if (typeof dr.title === 'string') debateTitle = dr.title;
      if (typeof dr.run_tag === 'string') debateRunTag = dr.run_tag;
    }
  }
  return {
    status: typeof raw.status === 'string' ? raw.status : null,
    state: typeof raw.state === 'string' ? raw.state : null,
    failure_reason: typeof raw.failure_reason === 'string' ? raw.failure_reason : null,
    failure_sub_reason: typeof raw.failure_sub_reason === 'string' ? raw.failure_sub_reason : null,
    dead_letter_reason: typeof raw.dead_letter_reason === 'string' ? raw.dead_letter_reason : null,
    run_mode: typeof raw.run_mode === 'string' ? raw.run_mode : null,
    requested_families: families,
    family: typeof raw.family === 'string' ? raw.family : null,
    started_at: typeof raw.started_at === 'string' ? raw.started_at : null,
    completed_at: typeof raw.completed_at === 'string' ? raw.completed_at : null,
    failure_detail: readFailureDetailAllowListed(raw.failure_detail),
    debate_title: debateTitle,
    debate_run_tag: debateRunTag,
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return methodNotAllowed();

  // ── 1. Parse + validate the filter body (strict; unknown keys rejected) ──
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    rawBody = {};
  }
  const parsed = AdminClassifierHealthRequestSchema.safeParse(rawBody ?? {});
  if (!parsed.success) {
    return validationFailed({
      error: 'validation_failed',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const body = parsed.data;

  // ── 2. Admin gate (after input validation; mirrors admin-users) ──────────
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    if (auth.status === 401) return unauthorized();
    return forbidden(auth.reason);
  }
  const { caller, serviceClient } = auth;

  // ── 3. Build the in-memory filter from the validated body ────────────────
  const filter: ClassifierHealthFilter = {
    status: body.status,
    state: body.state,
    family: body.family,
    run_mode: body.run_mode,
    failure_reason: body.failure_reason,
    failure_sub_reason: body.failure_sub_reason,
    failure_detail_reason: body.failure_detail_reason,
    runTag: body.run_tag,
    window:
      body.from_iso || body.to_iso
        ? { fromIso: body.from_iso, toIso: body.to_iso }
        : undefined,
  };
  // Conditionally join `debates(title, run_tag)` ONLY when a runTag filter is
  // supplied — the durable run_tag is canonical, the title is the legacy
  // fallback (DEVEX-RUNTAG-COLUMN-SWAP-001).
  const needsDebateJoin = Boolean(body.run_tag && body.run_tag.length > 0);

  // ── 4. Column-explicit aggregate read (service-role; AFTER admin check) ──
  let rows: ClassifierHealthRunRow[];
  try {
    const { data, error } = await serviceClient
      .from('argument_machine_observation_runs')
      .select(needsDebateJoin ? RUN_COLUMNS_WITH_DEBATE : RUN_COLUMNS)
      .limit(MAX_RUN_ROWS);
    if (error) {
      return internalError('runs_read_failed');
    }
    rows = (Array.isArray(data) ? data : []).map((r) => toModelRow(r as Record<string, unknown>));
  } catch {
    return internalError('runs_read_threw');
  }

  // ── 5. Aggregate into a counts-only verdict (pure-TS model) ──────────────
  const verdict = aggregateClassifierHealth(rows, filter);

  // ── 6. Serialize (json | csv) + leak-scrub before returning ──────────────
  const wantsCsv = body.format === 'csv';
  const csv = buildClassifierHealthCsv(verdict);
  const jsonString = JSON.stringify(verdict);

  // Defensive scrub: if any forbidden substring (secret-shape or verdict
  // token) sneaked into the serialized output, drop rather than leak.
  if (containsForbiddenSubstring(jsonString) || containsForbiddenSubstring(csv)) {
    return internalError('response_scrub_failed');
  }

  // ── 7. Audit row: actor + filter params ONLY (Q4; no row contents) ───────
  await writeClassifierHealthAudit(serviceClient, caller.userId, {
    action: wantsCsv ? 'export_classifier_health_csv' : 'view_classifier_health',
    filter: {
      status: body.status ?? null,
      state: body.state ?? null,
      family: body.family ?? null,
      run_mode: body.run_mode ?? null,
      failure_reason: body.failure_reason ?? null,
      failure_sub_reason: body.failure_sub_reason ?? null,
      failure_detail_reason: body.failure_detail_reason ?? null,
      from_iso: body.from_iso ?? null,
      to_iso: body.to_iso ?? null,
      run_tag: body.run_tag ?? null,
      format: body.format ?? 'json',
    },
    resultRowCount: verdict.totalRows,
  });

  // ── 8. Respond ───────────────────────────────────────────────────────────
  if (wantsCsv) {
    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="classifier-health.csv"',
      },
    });
  }
  return ok(verdict);
});

/**
 * Write an `admin_audit_events` row recording WHICH admin performed the read /
 * export and the FILTER PARAMETERS only — never any row contents, never any
 * count beyond the aggregate total. Audit failure is logged but never breaks
 * the read result (mirrors `writeAdminAudit`). The action string is panel-
 * specific (not in the admin-users WHITELISTED_ACTIONS union), so we insert
 * directly rather than via `writeAdminAudit`.
 */
async function writeClassifierHealthAudit(
  sc: ReturnType<typeof createServiceClient>,
  actorUserId: string,
  payload: {
    action: 'view_classifier_health' | 'export_classifier_health_csv';
    filter: Record<string, unknown>;
    resultRowCount: number;
  },
): Promise<void> {
  try {
    await sc.from('admin_audit_events').insert({
      actor_user_id: actorUserId,
      action: payload.action,
      source: 'edge_function',
      payload: { filter: payload.filter, resultRowCount: payload.resultRowCount },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('classifier_health_audit_write_failed', err);
  }
}
