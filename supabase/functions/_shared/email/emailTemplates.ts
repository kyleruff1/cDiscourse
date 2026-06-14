/**
 * EMAIL-TRANSPORT-001 — pure transactional-email render functions
 * (Lane B / product email).
 *
 * PURE: no env, no fetch, no I/O. Every render fn takes ONE sanitized input
 * object and returns `{ subject, html, text }` — so it is unit-testable for
 * ban-list compliance + structure without a network.
 *
 * Doctrine (cdiscourse-doctrine §1/§2/§3/§9):
 *   - No winner/loser/truth/verdict/accusation copy; no `challenger`/`opponent`.
 *   - No heat / popularity / engagement / standing language — only the neutral
 *     public/private capacity facts.
 *   - No internal validation codes; normal-user prose only.
 *   - The raw token appears ONLY inside the CTA href (`redemptionUrl`), never as
 *     a standalone field or visible text.
 *
 * Email-client constraints mirror `supabase/templates/invite.html`: table
 * layout, inline CSS, max-width container, a bulletproof CTA with a >=44px tap
 * target, a plain-text fallback (never HTML-only).
 */
import { escapeHtml, sanitizeRoomContext } from './safety.ts';

export interface ArgumentRoomInviteEmailInput {
  /** Room context; clamped + HTML-stripped before use. */
  roomTitle: string;
  roomVisibility: 'public' | 'private';
  /** Optional; absent => neutral "Someone". */
  inviterDisplayName?: string | null;
  /**
   * App-controlled redemption route, e.g. `${origin}/invite/${token}`. The
   * token appears ONLY inside this URL — never as a standalone field.
   */
  redemptionUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const VISIBILITY_COPY: Record<'public' | 'private', { label: string; capacity: string }> = {
  private: {
    label: 'This is a private argument.',
    capacity: 'Private rooms are 1v1 by invitation.',
  },
  public: {
    label: 'This is a public argument.',
    capacity: 'Public rooms allow up to 5 active participants; observers are uncapped.',
  },
};

/**
 * Escape a redemption URL for safe placement inside an `href="..."` attribute.
 * Only attribute-breaking characters are escaped (the URL itself is built
 * server-side from a validated token + sanitized origin, so it is already
 * safe; this is defense-in-depth so a stray quote can never break out).
 */
function escapeHref(url: string): string {
  return String(url)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Render the ARG-ROOM product invite email (existing + new invitees use the
 * same neutral copy — no-enumeration). Returns HTML + a plain-text fallback.
 */
export function renderArgumentRoomInviteEmail(input: ArgumentRoomInviteEmailInput): RenderedEmail {
  const ctx = sanitizeRoomContext({
    roomTitle: input.roomTitle,
    roomVisibility: input.roomVisibility,
    inviterDisplayName: input.inviterDisplayName,
  });
  const room = ctx.roomTitle;
  const inviter = ctx.inviterDisplayName;
  const vis = VISIBILITY_COPY[ctx.roomVisibility];
  const url = typeof input.redemptionUrl === 'string' ? input.redemptionUrl : '';

  const subject = "You've been invited to an argument";

  const introText = inviter
    ? `${inviter} invited you to an argument on CDiscourse.`
    : 'You have been invited to an argument on CDiscourse.';

  // ── Plain-text fallback ──
  const text = [
    introText,
    '',
    `Room: ${room}`,
    vis.label,
    vis.capacity,
    '',
    `Open invitation: ${url}`,
    '',
    'This invitation was sent to this email address. If you weren\'t expecting this, you can ignore it.',
    '',
    'CDiscourse — structured disagreement, focused on the claim.',
  ].join('\n');

  // ── HTML ──
  const introHtml = escapeHtml(introText);
  const roomHtml = escapeHtml(room);
  const visLabelHtml = escapeHtml(vis.label);
  const visCapacityHtml = escapeHtml(vis.capacity);
  const hrefSafe = escapeHref(url);

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="x-ua-compatible" content="IE=edge" />
    <title>You've been invited to an argument</title>
    <style>
      @media (max-width: 600px) {
        .cd-container { width: 100% !important; }
        .cd-pad { padding-left: 24px !important; padding-right: 24px !important; }
        .cd-cta { display: block !important; width: 100% !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f5f7; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#f4f5f7;">
      You've been invited to an argument on CDiscourse.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" class="cd-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e3e6ea;">
            <tr>
              <td class="cd-pad" style="padding:32px 40px 8px 40px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <span style="display:inline-block; font-size:20px; line-height:24px; font-weight:700; color:#1f2a37; letter-spacing:-0.2px;">CDiscourse</span>
              </td>
            </tr>
            <tr>
              <td class="cd-pad" style="padding:8px 40px 0 40px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <h1 style="margin:0; font-size:24px; line-height:30px; font-weight:700; color:#111827;">You've been invited to an argument</h1>
              </td>
            </tr>
            <tr>
              <td class="cd-pad" style="padding:16px 40px 0 40px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <p style="margin:0 0 16px 0; font-size:16px; line-height:24px; color:#374151;">${introHtml}</p>
                <p style="margin:0 0 8px 0; font-size:16px; line-height:24px; color:#374151;">Room: <strong>${roomHtml}</strong></p>
                <p style="margin:0 0 4px 0; font-size:14px; line-height:22px; color:#4b5563;">${visLabelHtml}</p>
                <p style="margin:0 0 16px 0; font-size:14px; line-height:22px; color:#6b7280;">${visCapacityHtml}</p>
              </td>
            </tr>
            <tr>
              <td class="cd-pad" style="padding:8px 40px 8px 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="#2563eb" style="border-radius:8px;">
                      <a class="cd-cta" href="${hrefSafe}" target="_blank" rel="noopener noreferrer"
                         style="display:inline-block; min-height:24px; padding:14px 28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:16px; line-height:24px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
                        Open invitation
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="cd-pad" style="padding:8px 40px 0 40px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <p style="margin:0 0 6px 0; font-size:13px; line-height:20px; color:#6b7280;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin:0; font-size:13px; line-height:20px; word-break:break-all;">
                  <a href="${hrefSafe}" target="_blank" rel="noopener noreferrer" style="color:#2563eb; text-decoration:underline;">${hrefSafe}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td class="cd-pad" style="padding:24px 40px 0 40px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <p style="margin:0; font-size:13px; line-height:20px; color:#6b7280;">
                  This invitation was sent to this email address. If you weren't expecting this, you can ignore it.
                </p>
              </td>
            </tr>
            <tr>
              <td class="cd-pad" style="padding:24px 40px 32px 40px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; border-top:1px solid #eef0f2;">
                <p style="margin:16px 0 0 0; font-size:12px; line-height:18px; color:#9ca3af;">
                  CDiscourse — structured disagreement, focused on the claim.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}
