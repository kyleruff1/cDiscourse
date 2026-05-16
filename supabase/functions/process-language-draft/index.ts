/**
 * process-language-draft — language-processing Edge Function.
 *
 * Processes a rough typed draft or transcript into structured debate draft suggestions.
 * Advisory only — never submits arguments, never hides content, never decides truth.
 * User must review all suggestions before submitting.
 *
 * Security model:
 *   - verify_jwt = true (set in config.toml).
 *   - Requires authenticated user; checks debate membership via callerClient (RLS).
 *   - ANTHROPIC_API_KEY read only via Deno.env — never returned to caller.
 *   - Returns { enabled: false } when AI_LANGUAGE_PROCESSING_ENABLED !== 'true'.
 *   - Does not write to public.arguments.
 *   - Does not call submit-argument.
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
import { LanguageProcessingInputSchema } from '../_shared/languageProcessing/schema.ts';
import { processWithConfiguredProvider } from '../_shared/languageProcessing/providers.ts';

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
  const parsed = LanguageProcessingInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path,
      message: i.message,
    }));
    return validationFailed({ error: 'validation_failed', issues });
  }

  const input = parsed.data;

  // ── Debate access check ───────────────────────────────────────
  // Verify the caller can see this debate (RLS on debates table).
  if (input.debateId) {
    const { data: debate, error: debateError } = await callerClient
      .from('debates')
      .select('id')
      .eq('id', input.debateId)
      .maybeSingle();

    if (debateError || !debate) {
      return validationFailed({ error: 'debate_not_found_or_not_accessible' });
    }
  }

  // ── Process ───────────────────────────────────────────────────
  let outcome: Awaited<ReturnType<typeof processWithConfiguredProvider>>;
  try {
    outcome = await processWithConfiguredProvider(input);
  } catch (err) {
    return internalError(`Language processing failed: ${String(err)}`);
  }

  // ── Return result ─────────────────────────────────────────────
  // Disabled: return { enabled: false, reason } — 200, not an error.
  // Enabled:  return full LanguageProcessingResult with enabled: true.
  // In both cases the client checks outcome.enabled before rendering suggestions.
  return ok(outcome);
});
