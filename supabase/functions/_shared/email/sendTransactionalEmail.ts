/**
 * EMAIL-TRANSPORT-001 — the single Edge-facing seam for product email
 * (Lane B). The Edge functions call ONLY this; the provider details, the
 * gating, the safety scan, and the sender-identity resolution all live here.
 *
 * Gate resolution (server-side, all default-safe):
 *   masterEnabled = CDISCOURSE_EMAIL_TRANSPORT_ENABLED === 'true'   (default OFF)
 *   if (!masterEnabled)                          -> skipped_gate_off   (NO network)
 *   provider = getEmailProvider(env)             // null when key missing
 *   if (!provider || !CDISCOURSE_EMAIL_FROM)     -> not_configured     (NO network)
 *   if (!recipient is plausible)                 -> not_configured     (NO network)
 *   if (!assertNoBannedTokens(rendered))         -> blocked_banned_copy (NO network)
 *   result = await provider.send(...)            // fetch(); never logs key/body/recipient
 *
 * The returned `EmailSendResult` is audit-safe: NO recipient, NO provider id,
 * NO body, NO key. The caller (room-notifications) maps it back to its own
 * status union; no secret crosses this boundary.
 *
 * The sender identity (`from`, `replyTo`) is resolved from Deno.env HERE — the
 * caller does not pass it. `from`/`replyTo` are NOT secrets but are kept out of
 * the caller surface so the lane's identity is configured in one place.
 */
import {
  getEmailProvider,
  type EmailProvider,
  type EmailSendResult,
  type TransactionalEmailMessage,
} from './emailProvider.ts';
import { assertNoBannedTokens, isPlausibleEmail } from './safety.ts';
import type { RenderedEmail } from './emailTemplates.ts';

export interface SendTransactionalEmailInput {
  to: string;
  /** Produced by an emailTemplates render fn. */
  rendered: RenderedEmail;
}

type EnvBag = Record<string, string | undefined>;

/** The product-lane master gate predicate. Default OFF. */
function isTransportMasterEnabled(env: EnvBag): boolean {
  return (env.CDISCOURSE_EMAIL_TRANSPORT_ENABLED || '').trim().toLowerCase() === 'true';
}

/**
 * Resolve the gated provider + sender identity and send. Returns the audit-safe
 * result. `env` + `providerOverride` are injectable for tests; production reads
 * Deno.env and the real provider factory.
 */
export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
  options?: { env?: EnvBag; provider?: EmailProvider | null },
): Promise<EmailSendResult> {
  const env: EnvBag = options?.env ?? denoEnvBag();

  // 1. Master gate — OFF (default) short-circuits with NO network.
  if (!isTransportMasterEnabled(env)) {
    return { status: 'skipped_gate_off' };
  }

  // 2. Provider + sender identity — missing either => not_configured, no send.
  const provider = options?.provider !== undefined ? options.provider : getEmailProvider(env);
  const from = (env.CDISCOURSE_EMAIL_FROM || '').trim();
  if (!provider || !from) {
    return { status: 'not_configured' };
  }

  // 3. Recipient sanity — empty/garbage => not_configured, no send.
  const to = (input.to || '').trim();
  if (!isPlausibleEmail(to)) {
    return { status: 'not_configured' };
  }

  // 4. Defense-in-depth ban-list scan over the rendered copy — block, no send.
  const { subject, html, text } = input.rendered;
  if (!assertNoBannedTokens(subject, html, text)) {
    return { status: 'blocked_banned_copy' };
  }

  // 5. Build the audit-safe message + send. The provider drains the body and
  //    never logs the key/body/recipient.
  const replyTo = (env.CDISCOURSE_EMAIL_REPLY_TO || '').trim();
  const message: TransactionalEmailMessage = {
    to,
    from,
    subject,
    html,
    text,
    ...(replyTo ? { replyTo } : {}),
  };
  return provider.send(message);
}

/** Read the relevant env keys off Deno.env into a plain bag (no secret echo). */
function denoEnvBag(): EnvBag {
  return {
    CDISCOURSE_EMAIL_TRANSPORT_ENABLED: Deno.env.get('CDISCOURSE_EMAIL_TRANSPORT_ENABLED') ?? undefined,
    CDISCOURSE_EMAIL_PROVIDER: Deno.env.get('CDISCOURSE_EMAIL_PROVIDER') ?? undefined,
    CDISCOURSE_EMAIL_FROM: Deno.env.get('CDISCOURSE_EMAIL_FROM') ?? undefined,
    CDISCOURSE_EMAIL_REPLY_TO: Deno.env.get('CDISCOURSE_EMAIL_REPLY_TO') ?? undefined,
    RESEND_API_KEY: Deno.env.get('RESEND_API_KEY') ?? undefined,
  };
}
