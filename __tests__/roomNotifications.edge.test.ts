/**
 * QOL-040 — static safety scan of the room-notifications Edge
 * Function. Mirrors the manageRoomInviteSafety pattern.
 *
 * The function file uses Deno-only imports (createServiceClient,
 * Deno.env.get, Deno.serve) and cannot be loaded by Jest. Instead
 * we scan the source for the structural + logging + handler
 * invariants the design names.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'room-notifications', 'index.ts'),
  'utf8',
);

describe('room-notifications — handler structure', () => {
  it('declares each of the six handlers as a named async function', () => {
    expect(SRC).toMatch(/async function handleInvite\b/);
    expect(SRC).toMatch(/async function handleInviteAcceptedByInvitee\b/);
    expect(SRC).toMatch(/async function handleArgumentSettled\b/);
    expect(SRC).toMatch(/async function handleChimeInPosted\b/);
    expect(SRC).toMatch(/async function handleChimeInRejected\b/);
    expect(SRC).toMatch(/async function handleRoomMadePrivate\b/);
  });

  it('routes each trigger type by literal in the discriminated switch', () => {
    for (const t of [
      'invite',
      'invite_accepted_by_invitee',
      'argument_settled',
      'chime_in_posted',
      'chime_in_rejected',
      'room_made_private',
    ]) {
      expect(SRC).toContain(`case '${t}'`);
    }
  });

  it('requires a JWT (unauthorized() on missing Authorization header)', () => {
    expect(SRC).toMatch(/if \(!auth\) return unauthorized\(\)/);
  });

  it('validates the JWT via createCallerClient + getUser', () => {
    expect(SRC).toContain('createCallerClient');
    expect(SRC).toMatch(/auth\.getUser\(\)/);
  });

  it('re-derives every authorisation decision from the DB (does not trust caller claims)', () => {
    // Every handler re-derives the caller's role from the DB:
    //   - invite: invited_by === callerId
    //   - invite_accepted_by_invitee: invitee_profile_id === callerId
    //   - argument_settled: caller side is affirmative/negative
    //   - chime_in_posted: caller side is observer/moderator
    //   - chime_in_rejected: caller side is affirmative/negative
    //   - room_made_private: caller is debate.created_by
    expect(SRC).toContain("invite.invited_by !== callerId");
    expect(SRC).toContain("invite.invitee_profile_id !== callerId");
    expect(SRC).toContain("debate.created_by !== callerId");
  });

  it('responds with { delivered } only (never returns recipient lists)', () => {
    // The success response shape returns `delivered: <count>` for the
    // notification triggers and, for the invite trigger, a branch-INDEPENDENT
    // `delivered: 0, notification` (constant — no existing-vs-new enumeration).
    // It NEVER includes a list of recipient ids or emails.
    expect(SRC).toContain('delivered: 0, notification');
    // Find every ok<RoomNotificationResponse>(…) call and
    // assert the body literal contains only { delivered, … }
    // with no recipient/email keys.
    const okMatches = SRC.match(/ok<RoomNotificationResponse>\(\{[^}]*\}\)/g) || [];
    expect(okMatches.length).toBeGreaterThan(0);
    for (const call of okMatches) {
      expect(call.toLowerCase()).not.toMatch(/recipient_id/);
      expect(call.toLowerCase()).not.toMatch(/email:/);
    }
  });
});

describe('room-notifications — logging rules (doctrine §5.7)', () => {
  it('contains no console.log anywhere', () => {
    expect(SRC).not.toMatch(/console\.log/);
  });

  it('console.* lines never reference Authorization, JWT, RESEND key, or recipient email', () => {
    const lines = SRC.split('\n');
    const offending: string[] = [];
    for (const line of lines) {
      if (!line.match(/console\.(error|warn|info|debug)/)) continue;
      const lower = line.toLowerCase();
      if (lower.includes('authorization')) offending.push(line.trim());
      if (lower.includes('resend_api_key')) offending.push(line.trim());
      if (lower.includes('service_role')) offending.push(line.trim());
      if (lower.includes('invite_email_from')) offending.push(line.trim());
    }
    expect(offending).toEqual([]);
  });

  it('contains no literal SERVICE_ROLE_KEY env var reference in code (comments allowed)', () => {
    // Strip block + line comments and re-scan. The leading
    // file header legitimately mentions SUPABASE_SERVICE_ROLE_KEY
    // in its "never logs" list. Any reference in code would be
    // suspicious.
    const stripped = SRC
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(stripped).not.toContain('SERVICE_ROLE_KEY');
    expect(SRC).toContain('createServiceClient');
  });
});

describe('room-notifications — email scaffold (gated, off by default)', () => {
  // EMAIL-TRANSPORT-001 re-point: the inline Resend fetch + Bearer header moved
  // into the shared `_shared/email/` module. The fetch-shape assertions FOLLOW
  // the code to resendProvider.ts / sendTransactionalEmail.ts (asserted in
  // resendProviderRequest.test.ts + emailMasterGate.test.ts +
  // roomNotifications.email.safety.test.ts). These room-notifications scans now
  // assert the wrapper delegates correctly and carries no inline send.
  const PROVIDER_SRC = fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'functions', '_shared', 'email', 'resendProvider.ts'),
    'utf8',
  );
  const ORCH_SRC = fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'functions', '_shared', 'email', 'sendTransactionalEmail.ts'),
    'utf8',
  );

  it('declares maybeSendInviteEmail as a named async function', () => {
    expect(SRC).toMatch(/async function maybeSendInviteEmail\b/);
  });

  it('gates the product lane on the composed master + per-feature gate (default OFF)', () => {
    // isInviteEmailEnabled now composes CDISCOURSE_EMAIL_TRANSPORT_ENABLED &&
    // INVITE_EMAIL_ENABLED — both required, both default OFF.
    expect(SRC).toContain("Deno.env.get('CDISCOURSE_EMAIL_TRANSPORT_ENABLED')");
    expect(SRC).toContain("Deno.env.get('INVITE_EMAIL_ENABLED')");
    expect(SRC).toMatch(/return master && perFeature;/);
    // The wrapper returns not_configured when the gate is off (no send).
    expect(SRC).toMatch(/if \(!isInviteEmailEnabled\(\)\) return 'not_configured';/);
  });

  it('delegates the send through the shared sendTransactionalEmail seam (no inline fetch)', () => {
    expect(SRC).toContain('sendTransactionalEmail(');
    expect(SRC).toContain('renderArgumentRoomInviteEmail(');
    // The inline Resend fetch + Bearer header are GONE from this file.
    expect(SRC).not.toContain('https://api.resend.com/emails');
    expect(SRC).not.toContain('Bearer ${apiKey}');
  });

  it('the shared orchestrator enforces the master gate first, then the provider/FROM (no network when off)', () => {
    expect(ORCH_SRC).toContain('CDISCOURSE_EMAIL_TRANSPORT_ENABLED');
    expect(ORCH_SRC).toContain("status: 'skipped_gate_off'");
    expect(ORCH_SRC).toContain("status: 'not_configured'");
    expect(ORCH_SRC).toContain('CDISCOURSE_EMAIL_FROM');
  });

  it('the shared Resend provider POSTs with the Authorization header built in-place', () => {
    expect(PROVIDER_SRC).toContain('https://api.resend.com/emails');
    const authLine = PROVIDER_SRC.split('\n').find((l) => l.includes('Bearer ${apiKey}'));
    expect(authLine).toBeDefined();
    expect(authLine?.toLowerCase()).not.toMatch(/console\./);
  });

  it('the shared Resend provider drains the body without echoing it', () => {
    expect(PROVIDER_SRC).toContain('if (!res.ok)');
    expect(PROVIDER_SRC).toContain('await res.text()');
    expect(PROVIDER_SRC).toContain("status: 'failed_sanitized'");
    expect(PROVIDER_SRC).toContain("status: 'sent'");
  });

  it('the InviteEmailStatus union is exactly sent | not_configured | queued (caller surface unchanged)', () => {
    expect(SRC).toMatch(/type InviteEmailStatus = 'sent' \| 'not_configured' \| 'queued'/);
  });
});

describe('room-notifications — never returns email or recipient details', () => {
  it('the response shape does not include `email` or `recipients` keys', () => {
    expect(SRC).not.toMatch(/email:\s*recipient/);
    expect(SRC).not.toMatch(/recipients:\s*\[/);
  });
});

describe('room-notifications — the eleventh trigger is intentionally absent', () => {
  it('does NOT declare an invite_expired_notice case in the action switch', () => {
    expect(SRC).not.toContain("case 'invite_expired_notice'");
    expect(SRC).not.toContain("'invite_expired_notice'");
  });

  it('does NOT declare a handleInviteExpiredNotice handler', () => {
    expect(SRC).not.toMatch(/handleInviteExpiredNotice/);
  });
});
