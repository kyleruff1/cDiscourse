/**
 * EMAIL-TRANSPORT-001 — provider-agnostic transactional-email interface +
 * factory (Lane B / product email).
 *
 * The `EmailProvider` interface is the swap seam: the default is Resend; a
 * Postmark adapter (documented, not built this card) would implement the same
 * interface and be selected by `CDISCOURSE_EMAIL_PROVIDER=postmark`. No call
 * site outside the concrete provider module knows the provider's specifics.
 *
 * The `EmailSendResult` is AUDIT-SAFE by construction: it carries NO recipient,
 * NO provider id string, NO body, NO key — only a neutral `status` and a
 * coarse `providerStatusClass`. The `emailNoTokenLeak` + `emailNoLogLeak` tests
 * enforce this.
 *
 * Pure-ish module: the factory reads `CDISCOURSE_EMAIL_PROVIDER` + the provider
 * key presence from the supplied `env` object (Deno.env in production). It
 * NEVER reads `.env` files and NEVER returns / logs a key value.
 */
import { resendProvider } from './resendProvider.ts';

export type EmailProviderId = 'resend' | 'postmark';

export interface TransactionalEmailMessage {
  /** Single recipient (one product invite at a time). */
  to: string;
  /** CDISCOURSE_EMAIL_FROM, e.g. "CDiscourse <invites@mail.cdiscourse.com>". */
  from: string;
  /** CDISCOURSE_EMAIL_REPLY_TO, e.g. "support@cdiscourse.com". */
  replyTo?: string;
  subject: string;
  html: string;
  /** Plain-text fallback — required; never HTML-only. */
  text: string;
  // NO token field, NO secret field, NO internal-code field by construction.
}

/**
 * The outcome of a transactional send. Audit-safe: carries NO recipient, NO
 * provider id, NO body, NO key.
 *
 *   - 'sent'               — provider returned a 2xx.
 *   - 'not_configured'     — master gate ON but provider key / FROM missing.
 *   - 'skipped_gate_off'   — master gate OFF (the default). No network.
 *   - 'failed_sanitized'   — provider 4xx/5xx or a network/throw; body drained,
 *                            never echoed. The user action is never blocked.
 *   - 'blocked_banned_copy'— the rendered copy tripped the ban-list. No send.
 */
export type EmailSendStatus =
  | 'sent'
  | 'not_configured'
  | 'skipped_gate_off'
  | 'failed_sanitized'
  | 'blocked_banned_copy';

export type ProviderStatusClass = 'ok' | 'provider_4xx' | 'provider_5xx' | 'network_error';

export interface EmailSendResult {
  status: EmailSendStatus;
  /** Coarse class only — never the response body. */
  providerStatusClass?: ProviderStatusClass;
}

export interface EmailProvider {
  readonly id: EmailProviderId;
  send(message: TransactionalEmailMessage): Promise<EmailSendResult>;
}

type EnvBag = Record<string, string | undefined>;

/**
 * Resolve the configured provider, or `null` when its key (and the FROM
 * address) are missing. `null` → the orchestrator returns `not_configured`
 * with NO network call. Default provider is Resend.
 *
 * The factory NEVER returns the key value — it only checks presence to decide
 * whether the provider is usable.
 */
export function getEmailProvider(env: EnvBag): EmailProvider | null {
  const providerId = ((env.CDISCOURSE_EMAIL_PROVIDER || 'resend').trim().toLowerCase()) as EmailProviderId;

  if (providerId === 'resend') {
    const key = (env.RESEND_API_KEY || '').trim();
    if (!key) return null;
    return resendProvider;
  }

  // Postmark is the DOCUMENTED swap path; the adapter is intentionally not
  // built this card (see design Out of scope). Returning null keeps the lane
  // inert until the adapter ships.
  if (providerId === 'postmark') {
    return null;
  }

  return null;
}
