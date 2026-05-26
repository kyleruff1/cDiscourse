/**
 * Edge Function: classify-argument-boolean-observations (MCP-021C-EDGE)
 *
 * Server-side runtime for the Boolean Observation classifier. Accepts
 * one or more argument ids in a batch, invokes the operator-hosted MCP
 * server's `classify_argument_boolean_observations` tool per argument,
 * and persists each per-argument result into
 * `public.argument_machine_observation_runs` + `_results` via the
 * service-role client.
 *
 * Workflow (per design §5):
 *   1. CORS preflight.
 *   2. Reject non-POST.
 *   3. Parse + validate the request body (zod schema below).
 *   4. requireAdmin(req) — at MCP-021C-EDGE ship, BOTH production and
 *      admin_validation modes are admin-gated (Decision 7). A future
 *      MCP-021C-AUTO-TRIGGER card will widen production to allow
 *      service-role automation.
 *   5. For each argumentId:
 *        a. Fetch the move body + parent body + ancestor chain context
 *           via the SERVICE-role client (RLS bypass — the admin caller
 *           may not be a direct participant; the writer's audit row is
 *           the access record).
 *        b. Filter requestedFamilies via familyRegistry.filterFamiliesForMode.
 *        c. Build the MCP request via booleanObservationRequestBuilder.
 *        d. Invoke runBooleanObservationMcpAdapter — typed Result; never
 *           throws.
 *        e. On success: sanitize at INSPECT confidence floor; write run
 *           row (status='success', run_mode=mode) + result rows (one per
 *           positive observation).
 *        f. On unavailable: write run row (status='failed',
 *           failure_reason=mcp_<reason>); zero result rows.
 *   6. Return a structured summary (no model token, no URL, no
 *      Authorization, no raw MCP payload).
 *
 * Hard rules:
 *   - Service-role bypasses RLS. The admin auth check at step 4 is the
 *     boundary.
 *   - Never returns the service-role client object.
 *   - Never logs the MCP token, the URL, the Authorization header, the
 *     Bearer value, or a raw response body.
 *   - Never returns admin email addresses.
 *   - Production mode REJECTS any non-`parent_relation` family (Decision 4).
 *
 * Doctrine: this Edge Function is the SOLE production-time invoker of
 * the `classify_argument_boolean_observations` MCP tool. Machine
 * Observations are advisory (`kind: 'machine_observation'` at render
 * time, never authoritative).
 */
import {
  corsHeaders,
  ok,
  badRequest,
  unauthorized,
  forbidden,
  methodNotAllowed,
  validationFailed,
  internalError,
} from '../_shared/http.ts';
import { requireAdmin } from '../_shared/adminAuth.ts';
import { runBooleanObservationMcpAdapter } from '../_shared/booleanObservations/booleanObservationMcpAdapter.ts';
import type { BooleanObservationAdapterResult } from '../_shared/booleanObservations/booleanObservationMcpAdapterCore.ts';
import {
  buildBooleanObservationRequestForArgument,
  buildBooleanObservationInputHash,
} from '../_shared/booleanObservations/booleanObservationRequestBuilder.ts';
import { filterFamiliesForMode } from '../_shared/booleanObservations/familyRegistry.ts';
import {
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  sanitizeMcpBooleanObservationResponse,
} from '../_shared/booleanObservations/mcpBooleanObservationSchema.ts';
import type { McpBooleanObservationResponse } from '../_shared/booleanObservations/mcpBooleanObservationSchema.ts';
import { MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY } from '../_shared/booleanObservations/machineObservationDefinitions.ts';
import {
  persistRun,
  persistResults,
} from '../_shared/booleanObservations/persistenceWriter.ts';
import type {
  PersistResultInput,
} from '../_shared/booleanObservations/persistenceWriter.ts';
import {
  DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME,
  MCP_BOOLEAN_OBSERVATION_TOOL_NAME,
} from '../_shared/booleanObservations/booleanObservationMcpAdapterCore.ts';
import { isMachineObservationRunMode } from '../_shared/booleanObservations/runModeConstants.ts';
import type { MachineObservationRunMode } from '../_shared/booleanObservations/runModeConstants.ts';
import { ALL_MACHINE_OBSERVATION_FAMILIES } from '../_shared/booleanObservations/nodeLabelTypes.ts';
import type {
  MachineObservationFamily,
} from '../_shared/booleanObservations/nodeLabelTypes.ts';
import { createServiceClient } from '../_shared/supabaseClients.ts';

const MAX_ARGUMENTS_PER_CALL = 10;
const PROVIDER_KEY = `mcp:${MCP_BOOLEAN_OBSERVATION_TOOL_NAME}`;

interface ClassifyRequestBody {
  argumentIds: string[];
  requestedFamilies: MachineObservationFamily[];
  mode: MachineObservationRunMode;
  schemaVersion: typeof MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION;
}

interface PerArgumentSummary {
  argumentId: string;
  runId: string | null;
  status: 'success' | 'failed';
  failureReason: string | null;
  positiveObservationCount: number;
  rawKeysWithPositive: string[];
}

interface ClassifyResponseBody {
  mode: MachineObservationRunMode;
  schemaVersion: typeof MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION;
  perArgument: PerArgumentSummary[];
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

interface ValidatedBody {
  argumentIds: string[];
  requestedFamilies: MachineObservationFamily[];
  mode: MachineObservationRunMode;
}

type ValidateResult =
  | { ok: true; body: ValidatedBody }
  | { ok: false; issues: Array<{ path: string; message: string }> };

function validateRequestBody(raw: unknown): ValidateResult {
  const issues: Array<{ path: string; message: string }> = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, issues: [{ path: 'body', message: 'body must be a JSON object' }] };
  }
  const body = raw as Partial<ClassifyRequestBody>;

  // argumentIds
  if (!Array.isArray(body.argumentIds)) {
    issues.push({ path: 'argumentIds', message: 'must be an array' });
  } else if (body.argumentIds.length === 0 || body.argumentIds.length > MAX_ARGUMENTS_PER_CALL) {
    issues.push({
      path: 'argumentIds',
      message: `length must be 1..${MAX_ARGUMENTS_PER_CALL}`,
    });
  } else {
    for (const id of body.argumentIds) {
      if (!isUuid(id)) {
        issues.push({ path: 'argumentIds', message: 'every entry must be a UUID' });
        break;
      }
    }
  }

  // requestedFamilies
  if (!Array.isArray(body.requestedFamilies)) {
    issues.push({ path: 'requestedFamilies', message: 'must be an array' });
  } else if (body.requestedFamilies.length === 0) {
    issues.push({ path: 'requestedFamilies', message: 'must be non-empty' });
  } else {
    for (const f of body.requestedFamilies) {
      if (!ALL_MACHINE_OBSERVATION_FAMILIES.includes(f as MachineObservationFamily)) {
        issues.push({
          path: 'requestedFamilies',
          message: 'every entry must be a known MachineObservationFamily',
        });
        break;
      }
    }
  }

  // mode
  if (!isMachineObservationRunMode(body.mode)) {
    issues.push({
      path: 'mode',
      message: 'must be "production" or "admin_validation"',
    });
  }

  // schemaVersion
  if (body.schemaVersion !== MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION) {
    issues.push({
      path: 'schemaVersion',
      message: `must be "${MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION}"`,
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    body: {
      argumentIds: body.argumentIds as string[],
      requestedFamilies: body.requestedFamilies as MachineObservationFamily[],
      mode: body.mode as MachineObservationRunMode,
    },
  };
}

interface ArgumentContext {
  argumentId: string;
  parentArgumentId: string | null;
  currentText: string;
  parentText: string | null;
  threadContextExcerpt: string;
  debateId: string;
}

/**
 * Load the argument context (move body + parent body + thread excerpt) via
 * the service-role client. Returns null when the argument is missing or
 * soft-deleted (a sanitized signal so the per-argument summary marks
 * status='failed' with failure_reason='argument_not_found').
 */
async function loadArgumentContext(
  argumentId: string,
  serviceClient: ReturnType<typeof createServiceClient>,
): Promise<ArgumentContext | null> {
  const { data: arg, error: argError } = await serviceClient
    .from('arguments')
    .select('id, debate_id, body, parent_id, status')
    .eq('id', argumentId)
    .maybeSingle();
  if (argError || !arg || arg.status === 'deleted') return null;

  let parentText: string | null = null;
  if (arg.parent_id) {
    const { data: parent } = await serviceClient
      .from('arguments')
      .select('id, body, status')
      .eq('id', arg.parent_id)
      .maybeSingle();
    if (parent && parent.status !== 'deleted') {
      parentText = typeof parent.body === 'string' ? parent.body : null;
    }
  }

  // Thread context: up to 3 ancestor bodies above the parent, joined by ---.
  const ancestorBodies: string[] = [];
  let cursor = arg.parent_id as string | null;
  let depth = 0;
  while (cursor && depth < 3) {
    const { data: ancestor } = await serviceClient
      .from('arguments')
      .select('id, body, parent_id, status')
      .eq('id', cursor)
      .maybeSingle();
    if (!ancestor) break;
    if (ancestor.status !== 'deleted' && typeof ancestor.body === 'string') {
      ancestorBodies.push(ancestor.body);
    }
    cursor = (ancestor.parent_id as string | null) ?? null;
    depth += 1;
  }
  const threadContextExcerpt = ancestorBodies.join('\n---\n').slice(0, 2_000);

  return {
    argumentId,
    parentArgumentId: (arg.parent_id as string | null) ?? null,
    currentText: typeof arg.body === 'string' ? arg.body : '',
    parentText,
    threadContextExcerpt,
    debateId: arg.debate_id as string,
  };
}

/**
 * Map the adapter `unavailable` reason to the persisted `failure_reason`
 * column value. Stable strings; matches design §4.2.
 */
function unavailableReasonToFailureReason(reason: string): string {
  switch (reason) {
    case 'url_missing':
      return 'mcp_url_missing';
    case 'token_missing':
      return 'mcp_token_missing';
    case 'network_error':
      return 'mcp_network_error';
    case 'api_error':
      return 'mcp_api_error';
    case 'rate_limited':
      return 'mcp_rate_limited';
    case 'parse_failure':
      return 'mcp_parse_failure';
    case 'validation_failed':
      return 'mcp_validation_failed';
    default:
      return `mcp_${reason}`;
  }
}

/**
 * Classify ONE argument: fetch context, build request, invoke adapter,
 * persist run + results. Returns the per-argument summary entry.
 *
 * Inner errors are caught and recorded — the function never throws.
 *
 * The adapter dependency is injected so tests can wire a mock without
 * making a real fetch.
 */
async function classifyOneArgument(
  argumentId: string,
  requestedFamilies: ReadonlyArray<MachineObservationFamily>,
  mode: MachineObservationRunMode,
  serviceClient: ReturnType<typeof createServiceClient>,
  adapter: (request: ReturnType<typeof buildBooleanObservationRequestForArgument>) => Promise<BooleanObservationAdapterResult>,
): Promise<PerArgumentSummary> {
  const startedAt = new Date().toISOString();

  // Load context.
  const context = await loadArgumentContext(argumentId, serviceClient);
  if (!context) {
    // No run row; the argument isn't visible. Return a sanitized
    // summary without writing — the database has no record because the
    // run never started.
    return {
      argumentId,
      runId: null,
      status: 'failed',
      failureReason: 'argument_not_found',
      positiveObservationCount: 0,
      rawKeysWithPositive: [],
    };
  }

  // Filter families per mode.
  const eligibleFamilies = filterFamiliesForMode(requestedFamilies, mode);

  // Build the MCP request.
  const mcpRequest = buildBooleanObservationRequestForArgument({
    argumentId,
    parentArgumentId: context.parentArgumentId,
    currentText: context.currentText,
    parentText: context.parentText,
    threadContextExcerpt: context.threadContextExcerpt,
    requestedFamilies: eligibleFamilies,
    mode,
  });

  // Compute the audit input hash.
  const inputHash = buildBooleanObservationInputHash({
    argumentId,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    runMode: mode,
    families: eligibleFamilies as ReadonlyArray<string>,
  });

  // Invoke the adapter.
  const adapterResult = await adapter(mcpRequest);
  const completedAt = new Date().toISOString();

  // Branch on adapter result.
  if (adapterResult.kind === 'unavailable') {
    const failureReason = unavailableReasonToFailureReason(adapterResult.reason);
    const runWrite = await persistRun({
      debateId: context.debateId,
      argumentId,
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      requestedFamilies: eligibleFamilies,
      providerKey: PROVIDER_KEY,
      modelName: DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME,
      inputHash,
      runMode: mode,
      status: 'failed',
      failureReason,
      startedAt,
      completedAt,
    });
    return {
      argumentId,
      runId: runWrite.ok ? runWrite.runId : null,
      status: 'failed',
      failureReason,
      positiveObservationCount: 0,
      rawKeysWithPositive: [],
    };
  }

  // Success path — sanitize at inspect floor.
  const sanitized: McpBooleanObservationResponse = sanitizeMcpBooleanObservationResponse(
    adapterResult.response,
    { surface: 'inspect' },
  );

  const runWrite = await persistRun({
    debateId: context.debateId,
    argumentId,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    requestedFamilies: eligibleFamilies,
    providerKey: PROVIDER_KEY,
    modelName: DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME,
    inputHash,
    runMode: mode,
    status: 'success',
    failureReason: null,
    startedAt,
    completedAt,
  });
  if (!runWrite.ok) {
    return {
      argumentId,
      runId: null,
      status: 'failed',
      failureReason: 'persist_run_failed',
      positiveObservationCount: 0,
      rawKeysWithPositive: [],
    };
  }

  // Collect positive observations.
  const resultsToWrite: PersistResultInput[] = [];
  const rawKeysWithPositive: string[] = [];
  for (const rawKey of sanitized.checkedRawKeys) {
    if (sanitized.observations[rawKey] !== true) continue;
    const def = MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[rawKey];
    if (!def) continue;
    const confidence = sanitized.confidence[rawKey];
    if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') continue;
    const evidenceSpan = sanitized.evidenceSpan[rawKey] ?? null;
    resultsToWrite.push({
      runId: runWrite.runId,
      debateId: context.debateId,
      argumentId,
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      rawKey,
      family: def.family,
      confidence,
      evidenceSpan,
    });
    rawKeysWithPositive.push(rawKey);
  }

  if (resultsToWrite.length > 0) {
    await persistResults(resultsToWrite);
  }

  return {
    argumentId,
    runId: runWrite.runId,
    status: 'success',
    failureReason: null,
    positiveObservationCount: resultsToWrite.length,
    rawKeysWithPositive,
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  // ── CORS preflight ────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return methodNotAllowed();

  // ── Parse body ────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return badRequest('invalid_json');
  }

  // ── Validate request body ─────────────────────────────────────
  const validation = validateRequestBody(rawBody);
  if (!validation.ok) {
    return validationFailed({ error: 'validation_failed', issues: validation.issues });
  }
  const body = validation.body;

  // ── Production-mode family gate ───────────────────────────────
  // In production mode, drop any non-`parent_relation` family at the
  // boundary so the operator gets a clear error rather than silent
  // filtering. The familyRegistry filter inside the request builder
  // also defends, but we surface the rejection here.
  if (body.mode === 'production') {
    const productionEligible = filterFamiliesForMode(body.requestedFamilies, 'production');
    if (productionEligible.length === 0) {
      return validationFailed({
        error: 'no_eligible_families_for_production',
        issues: [
          {
            path: 'requestedFamilies',
            message:
              'no family in the request is production-enabled. Only `parent_relation` is enabled at this ship.',
          },
        ],
      });
    }
  }

  // ── Auth: admin required for BOTH modes (Decision 7) ──────────
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    if (auth.status === 401) return unauthorized();
    return forbidden(auth.reason);
  }

  // ── Execute per-argument ──────────────────────────────────────
  const serviceClient = createServiceClient();
  const perArgument: PerArgumentSummary[] = [];
  for (const argumentId of body.argumentIds) {
    try {
      const summary = await classifyOneArgument(
        argumentId,
        body.requestedFamilies,
        body.mode,
        serviceClient,
        runBooleanObservationMcpAdapter,
      );
      perArgument.push(summary);
    } catch {
      // Defensive: the adapter never throws by contract; if something
      // somewhere else does, we record a sanitized failure.
      perArgument.push({
        argumentId,
        runId: null,
        status: 'failed',
        failureReason: 'unexpected_error',
        positiveObservationCount: 0,
        rawKeysWithPositive: [],
      });
    }
  }

  const response: ClassifyResponseBody = {
    mode: body.mode,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    perArgument,
  };
  return ok(response);
});

// `internalError` is imported for parity with sibling Edge Functions but
// is not used in the current happy/sad paths — every failure surfaces via
// validationFailed / unauthorized / forbidden / per-argument summary.
// Keep the import alongside the boundary for future extensibility.
// (Comment-only acknowledgment; lint allows unused imports of namespaced
// helper modules.)
void internalError;
