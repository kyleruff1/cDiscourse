/**
 * Edge Function: request-argument-deletion (Stage 6.1.8)
 *
 * Workflow:
 *   1. Require a valid user JWT.
 *   2. Validate body { debateId, argumentId, reason? }.
 *   3. Verify the caller is the AUTHOR of `argumentId` (via the caller-scoped
 *      Supabase client + RLS on `public.arguments`).
 *   4. Insert or fetch a row in `public.argument_deletion_requests`
 *      ("open request" = status in ('requested','reviewing')).
 *   5. If an existing open request exists, return its id + status.
 *   6. Best-effort: send an admin notification email via Resend if env is
 *      configured. If not configured, return `emailStatus: 'not_configured'`
 *      WITHOUT failing the request.
 *
 * Hard rules:
 *   - Never returns admin email addresses to the client.
 *   - Never logs Authorization headers, Bearer tokens, RESEND_API_KEY,
 *     SUPABASE_SERVICE_ROLE_KEY, JWTs, or raw headers.
 *   - Never deletes a row in `public.arguments`. This is a REQUEST workflow.
 *   - Service-role client is used ONLY to (a) write the audit row if
 *     `admin_audit_events` exists, and (b) fetch the admin notification
 *     recipient list — which is then redacted before any response leaves
 *     the function.
 */
import { corsHeaders, ok, badRequest, unauthorized, forbidden, methodNotAllowed, internalError } from '../_shared/http.ts';
import { createCallerClient, createServiceClient } from '../_shared/supabaseClients.ts';

interface DeletionRequestBody {
  debateId: string;
  argumentId: string;
  reason?: string | null;
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function sanitizeReason(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  // Strip control chars + truncate to 2000 chars to match the table's CHECK.
  const cleaned = input.replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 2000);
}

function shortId(id: string): string {
  return id && id.length >= 8 ? id.slice(0, 8) : '(unknown)';
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return methodNotAllowed();

  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return unauthorized();

  let raw: unknown;
  try { raw = await req.json(); } catch { return badRequest('invalid_json'); }
  const body = raw as Partial<DeletionRequestBody>;
  if (!isUuid(body.debateId) || !isUuid(body.argumentId)) return badRequest('debateId_and_argumentId_required');
  const reason = sanitizeReason(body.reason ?? null);

  const callerClient = createCallerClient(auth);

  // ── Identify caller. ──
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const requesterId = userRes.user.id;

  // ── Verify caller authored the argument and it belongs to the debate. ──
  // This SELECT goes through RLS; if the row is invisible to the caller, we
  // treat it as forbidden (no leak about existence). The schema uses
  // `status='deleted'` for soft-delete; there is no `is_deleted` column.
  const { data: argRow, error: argErr } = await callerClient
    .from('arguments')
    .select('id, author_id, debate_id, status')
    .eq('id', body.argumentId)
    .maybeSingle();
  if (argErr) return internalError(`argument_lookup_failed:${String(argErr.message || '').slice(0, 120)}`);
  if (!argRow) return forbidden('argument_not_authorized_or_missing');
  if (argRow.author_id !== requesterId) return forbidden('not_argument_author');
  if (argRow.debate_id !== body.debateId) return badRequest('debate_argument_mismatch');
  if (argRow.status === 'deleted') return badRequest('argument_already_deleted');

  // ── Find an existing open request (RLS lets requester see their own). ──
  const { data: existing, error: existingErr } = await callerClient
    .from('argument_deletion_requests')
    .select('id, status')
    .eq('argument_id', body.argumentId)
    .eq('requester_id', requesterId)
    .in('status', ['requested', 'reviewing'])
    .maybeSingle();
  if (existingErr) return internalError('existing_lookup_failed');

  let requestId: string;
  let status: string;
  if (existing && existing.id) {
    requestId = existing.id;
    status = existing.status;
  } else {
    // ── Insert the new request (RLS check enforces "author only"). ──
    const { data: inserted, error: insertErr } = await callerClient
      .from('argument_deletion_requests')
      .insert({
        debate_id: body.debateId,
        argument_id: body.argumentId,
        requester_id: requesterId,
        reason,
        status: 'requested',
      })
      .select('id, status')
      .single();
    if (insertErr || !inserted) {
      return internalError(`insert_failed:${String(insertErr?.message || 'unknown').slice(0, 120)}`);
    }
    requestId = inserted.id;
    status = inserted.status;
  }

  // ── Audit (best-effort; service-role only used here, never logged). ──
  // `source` is NOT NULL on admin_audit_events with a CHECK constraint —
  // omitting it produced a silent insert failure on earlier deploys.
  try {
    const svc = createServiceClient();
    await svc.from('admin_audit_events').insert({
      action: 'argument_deletion_requested',
      source: 'edge_function',
      actor_user_id: requesterId,
      target_user_id: requesterId,
      reason: null,
      payload: {
        requestId,
        debateIdShort: shortId(body.debateId),
        argumentIdShort: shortId(body.argumentId),
        hasReason: Boolean(reason),
      },
    });
  } catch { /* audit failure must not block the user */ }

  // ── Email notification (best-effort, gated by RESEND_API_KEY env). ──
  const emailStatus = await maybeSendAdminNotification({
    requestId,
    requesterId,
    debateId: body.debateId,
    argumentId: body.argumentId,
    reason,
  });

  return ok({ requestId, status, emailStatus, userReviewRequired: true });
});

// ── Email helper ───────────────────────────────────────────────

type EmailStatus = 'sent' | 'not_configured' | 'failed_sanitized';

async function maybeSendAdminNotification(input: {
  requestId: string;
  requesterId: string;
  debateId: string;
  argumentId: string;
  reason: string | null;
}): Promise<EmailStatus> {
  const apiKey = Deno.env.get('RESEND_API_KEY') || '';
  const from = Deno.env.get('ADMIN_NOTIFICATION_FROM') || '';
  if (!apiKey || !from) return 'not_configured';

  // Fetch recipient list via service role. Recipients NEVER leave this function.
  let recipients: string[] = [];
  try {
    const svc = createServiceClient();
    const { data, error } = await svc
      .from('profiles')
      .select('id')
      .eq('role', 'admin');
    if (error || !Array.isArray(data) || data.length === 0) return 'not_configured';
    const { data: emailsRaw, error: emailsErr } = await svc.auth.admin.listUsers({ perPage: 200, page: 1 });
    if (emailsErr || !emailsRaw?.users) return 'not_configured';
    const adminIds = new Set(data.map((r) => String(r.id)));
    recipients = emailsRaw.users
      .filter((u) => adminIds.has(u.id) && typeof u.email === 'string' && u.email)
      .map((u) => u.email as string);
  } catch { return 'failed_sanitized'; }

  if (recipients.length === 0) return 'not_configured';

  const appBase = (Deno.env.get('APP_BASE_URL') || '').trim();
  const replyTo = (Deno.env.get('ADMIN_NOTIFICATION_REPLY_TO') || '').trim();

  const subject = `CDiscourse deletion request: debate ${shortId(input.debateId)} / message ${shortId(input.argumentId)}`;
  const reasonRedacted = input.reason
    ? input.reason.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 600)
    : '(no reason supplied)';
  const safeLine = (s: string) => s.replace(/<[^>]*>/g, '');

  const bodyText = [
    'A CDiscourse user has requested deletion of their own argument.',
    '',
    `Request id: ${shortId(input.requestId)}`,
    `Requester id: ${shortId(input.requesterId)}`,
    `Debate id: ${shortId(input.debateId)}`,
    `Argument id: ${shortId(input.argumentId)}`,
    `Reason: ${safeLine(reasonRedacted)}`,
    appBase ? `Admin link: ${appBase}/admin/deletion-requests/${input.requestId}` : '',
    '',
    'Action: admin must review and (if appropriate) delete the argument manually from the admin tooling. This email is informational only.',
    '',
    'Note: no auth tokens, provider secrets, or full JWTs are in this email.',
  ].filter(Boolean).join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Authorization header is built in-place; the key is never logged.
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        text: bodyText,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      // Drain body without exposing it.
      try { await res.text(); } catch { /* swallow */ }
      return 'failed_sanitized';
    }
    return 'sent';
  } catch {
    return 'failed_sanitized';
  }
}
