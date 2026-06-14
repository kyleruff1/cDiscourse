/**
 * QOL-040 / EMAIL-TRANSPORT-001 — email scaffold behaviour matrix tests for the
 * existing-user invite send in supabase/functions/room-notifications/index.ts.
 *
 * The function file uses Deno-only imports and cannot be loaded by Jest. We
 * assert the matrix by source-scanning the control-flow shape — the same
 * pattern the roomNotifications.edge.test.ts file uses.
 *
 * EMAIL-TRANSPORT-001 re-point: the inline Resend fetch was lifted into the
 * shared `_shared/email/` module. The fetch-shape matrix (gate -> key/from ->
 * 2xx/non-2xx/exception) now lives in `resendProviderRequest.test.ts` +
 * `emailMasterGate.test.ts` (which exercise the real modules, not a scan).
 * `maybeSendInviteEmail` is now a thin BEHAVIOR-PRESERVING wrapper:
 *   1. per-feature + master gate (isInviteEmailEnabled) -> not_configured, no send
 *   2. renders via renderArgumentRoomInviteEmail
 *   3. dispatches through the single sendTransactionalEmail seam
 *   4. maps the audit-safe status back to the QOL-038 union (sent | not_configured | queued)
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'room-notifications', 'index.ts'),
  'utf8',
);

// Extract the maybeSendInviteEmail function body.
function helperBody(src: string): string {
  const start = src.indexOf('async function maybeSendInviteEmail');
  expect(start).toBeGreaterThan(-1);
  // End at the next top-level `async function` or `Deno.serve`.
  const nextDecl = (() => {
    const a = src.indexOf('async function ', start + 1);
    const b = src.indexOf('Deno.serve', start);
    if (a > 0 && (b < 0 || a < b)) return a;
    if (b > 0) return b;
    return src.length;
  })();
  return src.slice(start, nextDecl);
}

const HELPER = helperBody(SRC);

describe('maybeSendInviteEmail — gate: per-feature + master gate off → not_configured, no send', () => {
  it('returns not_configured early when the product-lane gate is not armed', () => {
    // isInviteEmailEnabled composes CDISCOURSE_EMAIL_TRANSPORT_ENABLED &&
    // INVITE_EMAIL_ENABLED. The guard returns not_configured BEFORE any render
    // or dispatch.
    expect(HELPER).toMatch(/if \(!isInviteEmailEnabled\(\)\) return 'not_configured';/);
    const gateIdx = HELPER.search(/isInviteEmailEnabled\(\)/);
    const dispatchIdx = HELPER.indexOf('sendTransactionalEmail(');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(dispatchIdx);
  });

  it('returns not_configured for an empty recipient before any dispatch', () => {
    expect(HELPER).toMatch(/if \(!recipient\) return 'not_configured';/);
    const recipIdx = HELPER.search(/if \(!recipient\)/);
    const dispatchIdx = HELPER.indexOf('sendTransactionalEmail(');
    expect(recipIdx).toBeGreaterThan(-1);
    expect(recipIdx).toBeLessThan(dispatchIdx);
  });
});

describe('maybeSendInviteEmail — delegates to the shared transactional seam', () => {
  it('renders the invite via the shared renderArgumentRoomInviteEmail', () => {
    expect(HELPER).toContain('renderArgumentRoomInviteEmail(');
    // The visibility is mapped from roomIsPrivate (no enumeration of seat etc).
    expect(HELPER).toMatch(/roomVisibility: input\.roomIsPrivate \? 'private' : 'public'/);
  });

  it('dispatches through sendTransactionalEmail (the single seam), not an inline fetch', () => {
    expect(HELPER).toContain('sendTransactionalEmail(');
    // The inline Resend fetch + Bearer header must be GONE from this file.
    expect(HELPER).not.toContain('api.resend.com');
    expect(HELPER).not.toContain('Bearer ${apiKey}');
    expect(SRC).not.toContain('api.resend.com');
  });
});

describe('maybeSendInviteEmail — maps the audit-safe result to the QOL-038 union', () => {
  it("maps 'sent' -> 'sent'", () => {
    expect(HELPER).toMatch(/case 'sent':\s*\n\s*return 'sent';/);
  });

  it("maps 'skipped_gate_off' and 'not_configured' -> 'not_configured'", () => {
    expect(HELPER).toContain("case 'skipped_gate_off':");
    expect(HELPER).toContain("case 'not_configured':");
    // both fall through to the same return.
    const block = HELPER.slice(HELPER.indexOf("case 'skipped_gate_off':"));
    expect(block).toMatch(/case 'skipped_gate_off':\s*\n\s*case 'not_configured':\s*\n\s*return 'not_configured';/);
  });

  it("maps 'failed_sanitized' and 'blocked_banned_copy' -> 'queued'", () => {
    expect(HELPER).toContain("case 'failed_sanitized':");
    expect(HELPER).toContain("case 'blocked_banned_copy':");
    // The failure tail returns 'queued'.
    const failIdx = HELPER.indexOf("case 'failed_sanitized':");
    const queuedIdx = HELPER.indexOf("return 'queued';", failIdx);
    expect(queuedIdx).toBeGreaterThan(failIdx);
  });

  it('logs a structured failure entry without echoing the key/body/recipient', () => {
    expect(HELPER).toContain('invite_email_send_failed');
    const start = HELPER.indexOf('invite_email_send_failed');
    const block = HELPER.slice(start, start + 400);
    expect(block).not.toMatch(/apiKey/);
    expect(block).not.toMatch(/recipient/);
    expect(block).not.toMatch(/res\.text\(\)/);
  });
});

describe('maybeSendInviteEmail — InviteEmailStatus union shape (unchanged)', () => {
  it('matches QOL-038 contract: sent | not_configured | queued', () => {
    // The union literal must be exactly these three values. The refactor
    // preserves the caller-facing union; the new audit-safe statuses live in
    // the shared module's EmailSendStatus, not here.
    expect(SRC).toMatch(/type InviteEmailStatus = 'sent' \| 'not_configured' \| 'queued'/);
  });
});
