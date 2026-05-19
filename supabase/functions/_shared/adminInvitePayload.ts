/**
 * Pure builders for the `invite_user` admin action (QOL-024).
 *
 * Kept in a small, dependency-free module so the audit `payload` shape and
 * the client response shape can be unit-tested without loading the Deno-only
 * Edge Function. `__tests__/adminInviteUserAuditShape.test.ts` mirrors these
 * the same way `adminSchemas.test.ts` mirrors the zod schemas.
 *
 * Doctrine: the audit payload stores `emailDomain` (the part after `@`) only,
 * never the raw address; `redirectToProvided` is a boolean, never the URL.
 * The client response carries no link, no token, no email, no userId.
 */

/** The notification states the invite action can report to the client. */
export type InviteNotification = 'sent' | 'not_configured' | 'send_failed';

export interface InviteAuditPayloadInput {
  /** Full email address — only the domain is retained in the output. */
  email: string;
  /** Schema-constrained role — never 'admin'. */
  role: 'user' | 'moderator';
  /** Whether a redirectTo was supplied — the URL itself is never stored. */
  redirectToProvided: boolean;
}

export interface InviteAuditPayload {
  /** Domain only (substring after the first '@'), or null if malformed. */
  emailDomain: string | null;
  role: 'user' | 'moderator';
  /** Boolean — never the redirect URL string. */
  redirectToProvided: boolean;
  invited: true;
  notification: 'sent';
}

export interface InviteResponse {
  ok: true;
  invited: true;
  notification: 'sent';
}

/**
 * Build the `admin_audit_events.payload` for a successful invite. Stores the
 * email domain only — the raw address never reaches the audit row.
 */
export function buildInviteAuditPayload(input: InviteAuditPayloadInput): InviteAuditPayload {
  const atIndex = input.email.lastIndexOf('@');
  const emailDomain = atIndex >= 0 ? input.email.slice(atIndex + 1) || null : null;
  return {
    emailDomain,
    role: input.role,
    redirectToProvided: input.redirectToProvided,
    invited: true,
    notification: 'sent',
  };
}

/**
 * Build the client-facing response for a successful invite. Contains no link,
 * no token, no email, no userId — the admin already typed the address.
 */
export function buildInviteResponse(): InviteResponse {
  return { ok: true, invited: true, notification: 'sent' };
}
