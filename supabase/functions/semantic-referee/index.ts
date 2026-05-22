/**
 * semantic-referee — MCP semantic-referee Edge Function boundary (MCP-016).
 *
 * Implements MCP-009's server-side boundary in MOCK MODE ONLY. Takes a
 * redacted move + room context, runs the deterministic `mock` (or `fixture`)
 * classifier, and returns an advisory `SemanticRefereePacket`. Advisory only —
 * never submits an argument, never hides content, never decides truth.
 *
 * Security model:
 *   - verify_jwt = true (set in config.toml).
 *   - Requires an authenticated user; checks room visibility via the
 *     caller-scoped client (RLS on `debates`).
 *   - DISABLED BY DEFAULT — returns { enabled: false } when
 *     SEMANTIC_REFEREE_ENABLED !== 'true'. HTTP 200, not an error.
 *   - The only wired providers are `mock` + `fixture`. The `anthropic` / `mcp`
 *     registry slots are stubbed `{ enabled: false, reason: 'not_implemented' }`.
 *   - Reads NO provider key. Builds NO service-role client. Performs NO write.
 *   - Never inserts into public.arguments. Never calls submit-argument.
 *   - Never logs the Authorization header, a key, a JWT, or a raw body.
 *
 * Deploy is a SEPARATE operator action (out of scope for MCP-016).
 */
import {
  corsHeaders,
  ok,
  unauthorized,
  methodNotAllowed,
  validationFailed,
  badRequest,
  internalError,
} from '../_shared/http.ts';
import { createCallerClient } from '../_shared/supabaseClients.ts';
import { ClassifyMoveRequestSchema } from '../_shared/semanticReferee/schema.ts';
import { redactClassifyMoveRequest } from '../_shared/semanticReferee/redaction.ts';
import { classifyWithConfiguredProvider } from '../_shared/semanticReferee/providers.ts';
import type { ClassifyMoveRequest } from '../_shared/semanticReferee/types.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  // ── CORS preflight ────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return methodNotAllowed();
  }

  // ── Auth ──────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized();

  const callerClient = createCallerClient(authHeader);
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return unauthorized();

  // ── Parse body ────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return badRequest('Invalid JSON body.');
  }

  // ── Validate input ────────────────────────────────────────────
  const parsed = ClassifyMoveRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path,
      message: i.message,
    }));
    return validationFailed({ error: 'validation_failed', issues });
  }

  const input = parsed.data as ClassifyMoveRequest;

  // ── Room-access RLS check ─────────────────────────────────────
  // The caller-scoped client means RLS decides visibility. No service-role
  // client is built — the function performs no privileged write.
  const { data: room, error: roomError } = await callerClient
    .from('debates')
    .select('id')
    .eq('id', input.roomId)
    .maybeSingle();

  if (roomError || !room) {
    return validationFailed({ error: 'room_not_found_or_not_accessible' });
  }

  // ── Defensive redaction ───────────────────────────────────────
  // Belt-and-suspenders: the client redacts; the boundary redacts again
  // before any provider sees the body.
  const redactedInput = redactClassifyMoveRequest(input);

  // ── Classify ──────────────────────────────────────────────────
  // `classifyWithConfiguredProvider` is async since MCP-017 (the live
  // `anthropic` provider does a `fetch`). ADMIN-AI-001: it also takes the
  // caller-scoped client to resolve the persisted admin runtime config (the
  // SECURITY DEFINER RPC `get_semantic_referee_runtime_config`). It never
  // throws — the runtime-config resolver falls through to env on any DB
  // failure, and every provider failure path returns a typed
  // `{ enabled: false }` outcome — but the `try/catch` is kept as
  // belt-and-suspenders. The function still builds NO service-role client and
  // performs NO write — the config RPC is SELECT-only.
  let outcome: Awaited<ReturnType<typeof classifyWithConfiguredProvider>>;
  try {
    outcome = await classifyWithConfiguredProvider(redactedInput, callerClient);
  } catch (err) {
    return internalError(`Semantic classification failed: ${String(err)}`);
  }

  // ── Return result ─────────────────────────────────────────────
  // Disabled: { enabled: false, reason } — HTTP 200, not an error.
  // Enabled:  { enabled: true, packet } — schema-validated by the registry.
  // The consumer checks outcome.enabled before using the packet.
  return ok(outcome);
});
