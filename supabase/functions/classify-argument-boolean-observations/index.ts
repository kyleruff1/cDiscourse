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
 *      admin_validation modes are admin-gated (Decision 7). The
 *      MCP-021C-AUTO-TRIGGER-FAMILY-A card adds a SECOND server-side
 *      invocation path through the shared `classifyOneArgumentCore`
 *      helper (called from submit-argument's post-insert tail); the
 *      HTTP endpoint's admin gate is UNCHANGED.
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
import { ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS } from '../_shared/booleanObservations/booleanObservationMcpAdapterCore.ts';
import { filterFamiliesForMode } from '../_shared/booleanObservations/familyRegistry.ts';
import {
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
} from '../_shared/booleanObservations/mcpBooleanObservationSchema.ts';
import type {
  McpBooleanObservationRequest,
} from '../_shared/booleanObservations/mcpBooleanObservationSchema.ts';
import { isMachineObservationRunMode } from '../_shared/booleanObservations/runModeConstants.ts';
import type { MachineObservationRunMode } from '../_shared/booleanObservations/runModeConstants.ts';
import { ALL_MACHINE_OBSERVATION_FAMILIES } from '../_shared/booleanObservations/nodeLabelTypes.ts';
import type {
  MachineObservationFamily,
} from '../_shared/booleanObservations/nodeLabelTypes.ts';
import { createServiceClient } from '../_shared/supabaseClients.ts';
import {
  classifyOneArgumentCore,
} from '../_shared/booleanObservations/classifyArgumentCore.ts';
import type {
  PerArgumentSummary,
} from '../_shared/booleanObservations/classifyArgumentCore.ts';

const MAX_ARGUMENTS_PER_CALL = 10;

interface ClassifyRequestBody {
  argumentIds: string[];
  requestedFamilies: MachineObservationFamily[];
  mode: MachineObservationRunMode;
  schemaVersion: typeof MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION;
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

/**
 * Classify ONE argument — thin wrapper around the shared core.
 *
 * The per-argument classifier logic was lifted into
 * `../_shared/booleanObservations/classifyArgumentCore.ts` so the same
 * code can be invoked by the MCP-021C-AUTO-TRIGGER-FAMILY-A dispatcher
 * from `submit-argument`. The Edge Function HTTP handler keeps its
 * `requireAdmin` gate and response shape; per-argument behavior is
 * byte-equivalent to the pre-refactor inline implementation.
 */
const classifyOneArgument = classifyOneArgumentCore;

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

  // OPS-MCP-ADMIN-VALIDATION-TIMEOUT-HIERARCHY — adapter-injection wrap.
  // The admin_validation path is operator-driven (off the user's submit hot
  // path); give its caller-side abort enough headroom to EXCEED the MCP
  // server's 25s model budget (ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS=30s),
  // correcting the inverted hierarchy where the fixed 15s default killed a
  // valid 16-25s slow call (the Family-J E3 finding). The submit-path
  // auto-trigger (autoTriggerDispatcher.ts) and the production HTTP mode both
  // KEEP the bare 1-arg adapter reference (15s default) — byte-unchanged.
  const observationAdapter =
    body.mode === 'admin_validation'
      ? (request: McpBooleanObservationRequest) =>
          runBooleanObservationMcpAdapter(request, {
            timeoutMs: ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS,
          })
      : runBooleanObservationMcpAdapter;

  const perArgument: PerArgumentSummary[] = [];
  for (const argumentId of body.argumentIds) {
    try {
      const summary = await classifyOneArgument(
        argumentId,
        body.requestedFamilies,
        body.mode,
        serviceClient,
        observationAdapter,
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
