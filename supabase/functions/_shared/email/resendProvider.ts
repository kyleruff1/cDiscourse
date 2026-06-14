/**
 * EMAIL-TRANSPORT-001 — Resend HTTP adapter (Lane B / product email).
 *
 * THE ONLY place the provider key + the `authorization: Bearer ...` header
 * live. It POSTs to `https://api.resend.com/emails` via Deno `fetch()` — no
 * nodemailer, no SMTP socket. Lifts + generalizes the shipped
 * `room-notifications` `maybeSendInviteEmail` fetch block so the two cannot
 * drift.
 *
 * Secret discipline (cdiscourse-doctrine §6 + supabase-edge-contract):
 *   - `RESEND_API_KEY` is read from Deno.env HERE and nowhere else for the
 *     product lane.
 *   - The Authorization header is built in-place inside the headers object
 *     literal; the key is NEVER assigned to a variable that lands in a log
 *     line, NEVER logged, NEVER returned.
 *   - The response body is drained without being echoed.
 *   - The returned `EmailSendResult` is audit-safe (no recipient, no body, no
 *     key) — only a neutral status + a coarse provider class.
 *   - A 4xx/5xx/throw never blocks the caller's user action; it returns
 *     `failed_sanitized` with the class so the operator can reconcile later.
 */
import type {
  EmailProvider,
  EmailSendResult,
  TransactionalEmailMessage,
} from './emailProvider.ts';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export const resendProvider: EmailProvider = {
  id: 'resend',

  async send(message: TransactionalEmailMessage): Promise<EmailSendResult> {
    const apiKey = (Deno.env.get('RESEND_API_KEY') || '').trim();
    // Defensive: the factory already gated on key presence, but never send
    // without one — and never log its absence with the key name in a value.
    if (!apiKey) {
      return { status: 'not_configured' };
    }

    const payload: Record<string, unknown> = {
      from: message.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    };
    if (message.replyTo) payload.reply_to = message.replyTo;

    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Built in-place; the key is never assigned to a logged variable.
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Drain the body without echoing it.
        try { await res.text(); } catch { /* swallow */ }
        const providerStatusClass = res.status >= 500 ? 'provider_5xx' : 'provider_4xx';
        return { status: 'failed_sanitized', providerStatusClass };
      }

      // Drain the success body too (we do not surface the provider message id —
      // keeping the result audit-safe). Best-effort.
      try { await res.text(); } catch { /* swallow */ }
      return { status: 'sent', providerStatusClass: 'ok' };
    } catch {
      // Network error / DNS / abort. Non-blocking.
      return { status: 'failed_sanitized', providerStatusClass: 'network_error' };
    }
  },
};
