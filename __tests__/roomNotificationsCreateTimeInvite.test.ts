/**
 * ARG-ROOM-004 (#615) — static source-scan of the create-time invite
 * orchestration added to `room-notifications` `handleInvite`.
 *
 * The Deno function cannot be Jest-imported (npm:/Deno.env/Deno.serve), so the
 * contract is enforced by a source-text scan — the same pattern as
 * roomNotifications.edge.test.ts.
 *
 * Pins the design-review findings:
 *  - [blocking] the new-user `inviteUserByEmail` call is gated by an in-function
 *    `INVITE_AUTH_BRIDGE_ENABLED` flag (default OFF → lands DORMANT),
 *  - [should]   the inviter-facing `notification` is a single branch-INDEPENDENT
 *    gate-posture predicate (no existing-vs-new enumeration),
 *  - the existing-user Resend link is reconciled (built from origin + token,
 *    no longer the hardcoded `null`),
 *  - no raw token / email / redirect is ever logged.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'room-notifications', 'index.ts'),
  'utf8',
);

function sliceBetween(src: string, startMarker: string, endMarker: string): string {
  const start = src.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf(endMarker, start + startMarker.length);
  return src.slice(start, end > start ? end : src.length);
}

const HANDLE_INVITE = sliceBetween(
  SRC,
  'async function handleInvite(',
  'async function handleInviteAcceptedByInvitee',
);

describe('ARG-ROOM-004 — new-user Auth-invite bridge gate (lands dormant)', () => {
  it('declares an isInviteAuthBridgeEnabled() gate reading INVITE_AUTH_BRIDGE_ENABLED', () => {
    const gate = sliceBetween(SRC, 'function isInviteAuthBridgeEnabled', '\n}');
    expect(gate).toContain("Deno.env.get('INVITE_AUTH_BRIDGE_ENABLED')");
    // Default OFF: only the literal string 'true' arms it.
    expect(gate).toMatch(/=== 'true'/);
  });

  it('issues the inviteUserByEmail CALL exactly once, ONLY inside the bridge gate', () => {
    // Count the actual method call (`.inviteUserByEmail(`), not the word in
    // comments. It must appear exactly once — only the new-user branch sends.
    const callOccurrences = (SRC.match(/\.inviteUserByEmail\(/g) || []).length;
    expect(callOccurrences).toBe(1);
    // The call sits inside the `else if (isInviteAuthBridgeEnabled())` branch:
    // the gate check precedes the call, which precedes the handler's return.
    const gateIdx = HANDLE_INVITE.indexOf('else if (isInviteAuthBridgeEnabled())');
    const callIdx = HANDLE_INVITE.indexOf('.inviteUserByEmail(');
    const returnIdx = HANDLE_INVITE.indexOf('return ok<RoomNotificationResponse>');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(callIdx).toBeGreaterThan(gateIdx);
    expect(returnIdx).toBeGreaterThan(callIdx);
  });

  it('routes the new-user redirect through buildBridgeRedirect (?invite=<token>)', () => {
    expect(HANDLE_INVITE).toContain('buildBridgeRedirect(requestOrigin, body.inviteToken)');
    const builder = sliceBetween(SRC, 'function buildBridgeRedirect', '\n}');
    expect(builder).toContain('/auth/callback?invite=');
  });

  it('wraps inviteUserByEmail in try/catch so a failed/rate-limited send never throws', () => {
    const branch = HANDLE_INVITE.slice(HANDLE_INVITE.indexOf('else if (isInviteAuthBridgeEnabled())'));
    expect(branch).toMatch(/try\s*\{[\s\S]*inviteUserByEmail[\s\S]*\}\s*catch/);
  });
});

describe('ARG-ROOM-004 — existing-user Resend link reconciliation', () => {
  it('builds the email link from origin + token (no longer hardcoded null)', () => {
    expect(HANDLE_INVITE).toContain('inviteLink: buildInviteLinkFromOrigin(requestOrigin, body.inviteToken)');
    // The old `const inviteLink: string | null = null;` must be gone.
    expect(HANDLE_INVITE).not.toMatch(/const inviteLink: string \| null = null/);
  });

  it('still calls the shipped gated maybeSendInviteEmail for existing users', () => {
    expect(HANDLE_INVITE).toContain('maybeSendInviteEmail(');
    // maybeSendInviteEmail remains defined in room-notifications (NOT lifted).
    expect(SRC).toMatch(/async function maybeSendInviteEmail\b/);
  });
});

describe('ARG-ROOM-004 — uniform notification (no enumeration)', () => {
  it('the invite response derives notification from resolveInviteNotificationStatus()', () => {
    expect(HANDLE_INVITE).toContain('notification: resolveInviteNotificationStatus()');
    // The pre-ARG-ROOM-004 per-branch leak (`notification: emailStatus`) is gone.
    expect(HANDLE_INVITE).not.toContain('notification: emailStatus');
    // Response still carries the shipped shape.
    expect(HANDLE_INVITE).toContain('delivered, notification');
  });

  it('resolveInviteNotificationStatus reads ONLY the env gates (branch-independent)', () => {
    const fn = sliceBetween(SRC, 'function resolveInviteNotificationStatus', '\n}');
    expect(fn).toContain('isInviteEmailEnabled()');
    expect(fn).toContain('isInviteAuthBridgeEnabled()');
    // It must NOT read which branch ran or any per-branch transport result.
    expect(fn).not.toMatch(/inviteeUserId|delivered|emailStatus|invitee_profile_id/);
  });

  it('both transports default OFF — isInviteEmailEnabled also gates on the literal true', () => {
    const fn = sliceBetween(SRC, 'function isInviteEmailEnabled', '\n}');
    expect(fn).toContain("Deno.env.get('INVITE_EMAIL_ENABLED')");
    expect(fn).toMatch(/=== 'true'/);
  });
});

describe('ARG-ROOM-004 — token discipline + no-leak', () => {
  it('validates the inbound inviteToken shape before use', () => {
    expect(SRC).toContain('isValidBridgeToken(body.inviteToken)');
    const v = sliceBetween(SRC, 'function isValidBridgeToken', '\n}');
    expect(v).toContain('INVITE_TOKEN_MIN_LENGTH');
    expect(v).toContain('INVITE_TOKEN_MAX_LENGTH');
  });

  it('no console.* line references the raw token, redirect, recipient email, or the Auth invite email arg', () => {
    const lines = SRC.split('\n');
    const offenders: string[] = [];
    for (const line of lines) {
      if (!/console\.(error|warn|info|debug|log)/.test(line)) continue;
      const lower = line.toLowerCase();
      if (
        lower.includes('invitetoken') ||
        lower.includes('redirectto') ||
        lower.includes('recipient') ||
        lower.includes('inviteuserbyemail') ||
        lower.includes('invitelink')
      ) {
        offenders.push(line.trim());
      }
    }
    expect(offenders).toEqual([]);
  });

  it('contains no console.log anywhere (doctrine §5.7)', () => {
    expect(SRC).not.toMatch(/console\.log/);
  });
});
