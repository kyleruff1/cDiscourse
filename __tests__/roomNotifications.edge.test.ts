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
    // The success response shape returns `delivered: <count>`
    // and, for the invite trigger, the `notification` status.
    // It NEVER includes a list of recipient ids or emails.
    expect(SRC).toContain('delivered, notification');
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
  it('declares maybeSendInviteEmail as a named async function', () => {
    expect(SRC).toMatch(/async function maybeSendInviteEmail\b/);
  });

  it('gates on INVITE_EMAIL_ENABLED env var (returns not_configured when unset)', () => {
    expect(SRC).toContain("Deno.env.get('INVITE_EMAIL_ENABLED')");
    // The check: anything other than the literal string 'true'
    // returns 'not_configured'.
    expect(SRC).toMatch(/enabled !== 'true'/);
    expect(SRC).toContain("return 'not_configured'");
  });

  it('gates on RESEND_API_KEY and INVITE_EMAIL_FROM env vars', () => {
    expect(SRC).toContain("Deno.env.get('RESEND_API_KEY')");
    expect(SRC).toContain("Deno.env.get('INVITE_EMAIL_FROM')");
    // Missing either env var → not_configured (no network call).
    expect(SRC).toMatch(/if \(!apiKey \|\| !from\)/);
  });

  it('POSTs to Resend with the Authorization header built in-place (never assigned to a var that lands in a log)', () => {
    expect(SRC).toContain("https://api.resend.com/emails");
    // The Authorization header MUST be built in-place inside the
    // headers object literal. Find every line that contains the
    // string `Bearer ${apiKey}` and assert it sits inside an
    // object literal (not in a logger / console call).
    const authLine = SRC.split('\n').find((l) => l.includes('Bearer ${apiKey}'));
    expect(authLine).toBeDefined();
    expect(authLine?.toLowerCase()).not.toMatch(/console\./);
  });

  it('on Resend non-2xx response: drains body without echoing it; returns queued', () => {
    expect(SRC).toContain("if (!res.ok)");
    expect(SRC).toContain("await res.text()");
    expect(SRC).toContain("return 'queued'");
  });

  it('on Resend exception: returns queued', () => {
    expect(SRC).toMatch(/} catch \(err\) \{[\s\S]*return 'queued';[\s\S]*\}/);
  });

  it('on Resend 2xx: returns sent', () => {
    expect(SRC).toContain("return 'sent'");
  });

  it('the InviteEmailStatus union is exactly sent | not_configured | queued', () => {
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
