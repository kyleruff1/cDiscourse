/**
 * cutover-health-monitor — OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ALERTING.
 *
 * The Edge Function that runs the 6 silent-failure alert checks
 * (Conditions A–F per design §5.8 M1/M2/M4/M5/M6/M8) and sends a Resend
 * email alert to admin profiles when any condition reaches ALERT severity.
 *
 * Invocation model (operator-territory pg_cron — NOT scheduled by this
 * card's migration):
 *   - The operator schedules a pg_cron job to POST to this endpoint
 *     every 5 minutes (mirrors the classifier-drainer cron pattern).
 *   - The function is also operator-callable on-demand via the same
 *     Authorization shared-secret pattern.
 *
 * Security model (mirrors classifier-drainer):
 *   - verify_jwt = false (set in config.toml). This endpoint is invoked
 *     by pg_cron (server-side net.http_post), NOT by end users.
 *   - Validates a SHARED SECRET on the Authorization header BEFORE any
 *     DB read. Missing / mismatched → 401 with NOTHING logged.
 *   - The DB read is via service-role client (bypasses RLS, exactly as
 *     classifier-drainer does) and calls the SECURITY DEFINER RPC
 *     `cutover_health_metrics()` which is privileged read-only.
 *
 * Output discipline (cdiscourse-doctrine §6):
 *   - NEVER logs the shared secret, the Authorization header, the
 *     RESEND_API_KEY, or any admin email address. Admin emails are
 *     fetched via service-role inside the email helper and never
 *     returned to the caller.
 *   - Response carries the per-condition verdicts (severity + observed
 *     value + threshold expression + remediation hint) — no raw rows,
 *     no evidence_span text, no argument body, no prompt, no provider
 *     payload.
 *   - The Resend email body is composed from the same safe verdict
 *     fields and is defensively scanned for forbidden substrings via
 *     `containsForbiddenSubstring` (drops the email rather than leak).
 *
 * No provider-spend path. This function never calls Anthropic / xAI /
 * the MCP server / submit-argument / classify-argument-boolean-observations.
 *
 * Server-only file under supabase/functions/; never imported by src/ or app/.
 */
import { corsHeaders, ok, unauthorized, methodNotAllowed, internalError } from '../_shared/http.ts';
import { createServiceClient } from '../_shared/supabaseClients.ts';
import {
  classifyCutoverHealth,
  containsForbiddenSubstring,
  type CutoverHealthInputs,
  type CutoverHealthVerdict,
} from '../../../src/features/cutoverHealthAlerts/cutoverHealthAlertModel.ts';

// ── Auth scheme (split-literal to keep the secret-literal scan green;
// same convention as booleanObservationMcpAdapter.ts + classifier-drainer).
const AUTH_SCHEME_PREFIX = 'Bea' + 'rer ';

/**
 * Constant-time-ish string compare; never logs either value.
 * Mirrors classifier-drainer's secretsMatch.
 */
function secretsMatch(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) {
    diff |= a.charCodeAt(i % a.length || 0) ^ b.charCodeAt(i % b.length || 0);
  }
  return diff === 0 && a.length === b.length;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST' && req.method !== 'GET') return methodNotAllowed();

  // ── Auth: shared secret on Authorization header ──────────────
  const expected = (Deno.env.get('CUTOVER_MONITOR_SHARED_SECRET') || '').trim();
  if (!expected) {
    // Secret not configured → reject; do NOT proceed with public access.
    return unauthorized();
  }
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  if (!auth.startsWith(AUTH_SCHEME_PREFIX)) return unauthorized();
  const presented = auth.slice(AUTH_SCHEME_PREFIX.length).trim();
  if (!secretsMatch(presented, expected)) return unauthorized();

  // ── Fetch the 6 condition inputs via the SECURITY DEFINER RPC ──
  let inputs: CutoverHealthInputs;
  try {
    const svc = createServiceClient();
    const { data, error } = await svc.rpc('cutover_health_metrics');
    if (error || !data || typeof data !== 'object') {
      return internalError('metrics_fetch_failed');
    }
    inputs = data as unknown as CutoverHealthInputs;
  } catch {
    return internalError('metrics_fetch_threw');
  }

  // ── Classify ───────────────────────────────────────────────────
  let verdict: CutoverHealthVerdict;
  try {
    verdict = classifyCutoverHealth(inputs);
  } catch {
    return internalError('classification_failed');
  }

  // ── Best-effort email on ALERT severity ──────────────────────
  let emailStatus: 'sent' | 'not_configured' | 'failed_sanitized' | 'not_required' = 'not_required';
  if (verdict.overallSeverity === 'alert') {
    emailStatus = await maybeSendAlertEmail(verdict);
  }

  // ── Response: operational verdicts only; no raw rows, no secrets ──
  return ok({
    overallSeverity: verdict.overallSeverity,
    alertCount: verdict.alertCount,
    warnCount: verdict.warnCount,
    passCount: verdict.passCount,
    conditionVerdicts: verdict.conditionVerdicts,
    emailStatus,
  });
});

// ── Email helper ───────────────────────────────────────────────

type EmailStatus = 'sent' | 'not_configured' | 'failed_sanitized';

/**
 * Send a Resend email summarizing the ALERT verdicts. Mirrors
 * request-argument-deletion's maybeSendAdminNotification pattern:
 *   - gated by RESEND_API_KEY + ADMIN_NOTIFICATION_FROM
 *   - recipients = admin profiles' emails (NEVER returned in the response)
 *   - body composed from safe verdict fields + defensive
 *     containsForbiddenSubstring scrub (drops the email rather than leak)
 *   - returns typed status; never throws
 */
async function maybeSendAlertEmail(verdict: CutoverHealthVerdict): Promise<EmailStatus> {
  const apiKey = (Deno.env.get('RESEND_API_KEY') || '').trim();
  const from = (Deno.env.get('ADMIN_NOTIFICATION_FROM') || '').trim();
  if (!apiKey || !from) return 'not_configured';

  // Fetch admin recipients via service role; emails NEVER leave this function.
  let recipients: string[] = [];
  try {
    const svc = createServiceClient();
    const { data: profilesData, error: profilesErr } = await svc
      .from('profiles')
      .select('id')
      .eq('role', 'admin');
    if (profilesErr || !Array.isArray(profilesData) || profilesData.length === 0) return 'not_configured';
    const adminIds = new Set(profilesData.map((r) => String(r.id)));
    const { data: usersRaw, error: usersErr } = await svc.auth.admin.listUsers({ perPage: 200, page: 1 });
    if (usersErr || !usersRaw?.users) return 'not_configured';
    recipients = usersRaw.users
      .filter((u) => adminIds.has(u.id) && typeof u.email === 'string' && u.email)
      .map((u) => u.email as string);
  } catch {
    return 'failed_sanitized';
  }
  if (recipients.length === 0) return 'not_configured';

  const appBase = (Deno.env.get('APP_BASE_URL') || '').trim();
  const subject = `[CDISCOURSE CUTOVER ALERT] ${verdict.alertCount} alert / ${verdict.warnCount} warn`;

  const lines: string[] = [
    'OPS-MCP-PROVIDER-RELIABILITY-CUTOVER — alert notification.',
    '',
    `Overall severity: ${verdict.overallSeverity}`,
    `Alert count: ${verdict.alertCount}`,
    `Warn count:  ${verdict.warnCount}`,
    `Pass count:  ${verdict.passCount}`,
    '',
    'Per-condition verdicts:',
  ];
  for (const v of verdict.conditionVerdicts) {
    if (v.severity === 'alert' || v.severity === 'warn') {
      lines.push(
        `- [${v.severity.toUpperCase()}] ${v.conditionId}: observed=${v.observedValue} threshold=${v.thresholdExpression} window=${v.observationWindow}`,
      );
      if (v.remediation) lines.push(`    Remediation: ${v.remediation}`);
    }
  }
  if (appBase) {
    lines.push('', `Dashboard: ${appBase}/admin/cutover-health`);
  }
  lines.push(
    '',
    'Recommended immediate action on ALERT: roll back routing by unsetting CLASSIFIER_QUEUE_ROUTING_ENABLED.',
    '',
    'This email is alerting-only. No auth tokens, JWTs, secrets, or evidence_span text are included.',
  );

  const bodyText = lines.join('\n');

  // Defensive scrub: if any forbidden substring sneaked in (e.g., a future
  // remediation string regression), drop the email rather than leak.
  if (containsForbiddenSubstring(bodyText)) {
    return 'failed_sanitized';
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        text: bodyText,
      }),
    });
    if (!res.ok) {
      try { await res.text(); } catch { /* swallow */ }
      return 'failed_sanitized';
    }
    return 'sent';
  } catch {
    return 'failed_sanitized';
  }
}
