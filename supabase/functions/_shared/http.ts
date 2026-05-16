/** Shared HTTP helpers for Supabase Edge Functions. */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function ok(body: unknown, status = 200): Response {
  return json(body, status);
}

export function created(body: unknown): Response {
  return json(body, 201);
}

export function badRequest(detail: string): Response {
  return json({ error: 'bad_request', detail }, 400);
}

export function unauthorized(): Response {
  return json({ error: 'unauthorized' }, 401);
}

export function forbidden(reason: string): Response {
  return json({ error: 'forbidden', reason }, 403);
}

export function methodNotAllowed(): Response {
  return json({ error: 'method_not_allowed' }, 405);
}

export function validationFailed(body: unknown): Response {
  return json(body, 422);
}

export function internalError(detail?: string): Response {
  return json({ error: 'internal_error', detail: detail ?? 'An unexpected error occurred.' }, 500);
}
