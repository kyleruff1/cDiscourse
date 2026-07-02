/**
 * PRIVATE-GROUPS-002 (#859) — static safety scan of the manage-circle-invite
 * Edge Function.
 *
 * Mirrors manageRoomInviteSafety.test.ts. Enforces doctrine §5.7 logging rules
 * + §6 secrets policy + the email-binding-before-provisioning spine + the
 * token-only-in-create-response rule + config registration, via source-text
 * scan (the function uses Deno-only imports and cannot be loaded by Jest).
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'manage-circle-invite', 'index.ts'),
  'utf8',
);

const CONFIG = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'config.toml'),
  'utf8',
);

describe('manage-circle-invite — handler structure', () => {
  it('declares each of the six action handlers as a named async function', () => {
    expect(SRC).toMatch(/async function handleCreate\b/);
    expect(SRC).toMatch(/async function handleRevoke\b/);
    expect(SRC).toMatch(/async function handleListForCircle\b/);
    expect(SRC).toMatch(/async function handleLookupByToken\b/);
    expect(SRC).toMatch(/async function handleAccept\b/);
    expect(SRC).toMatch(/async function handleProvisionAndAccept\b/);
  });

  it('routes each action by literal in the discriminated switch', () => {
    for (const action of [
      'create',
      'revoke',
      'list_for_circle',
      'lookup_by_token',
      'accept',
      'provision_and_accept',
    ]) {
      expect(SRC).toContain(`case '${action}'`);
    }
  });

  it('uses ManageCircleInviteRequestSchema.safeParse before reading the body shape', () => {
    expect(SRC).toContain('ManageCircleInviteRequestSchema.safeParse');
  });

  it('validates the JWT (createCallerClient + getUser) at the start of every JWT-bound handler', () => {
    const handlers = ['handleCreate', 'handleRevoke', 'handleListForCircle', 'handleAccept'];
    for (const name of handlers) {
      const start = SRC.indexOf(`async function ${name}`);
      expect(start).toBeGreaterThan(-1);
      const nextDecl = SRC.indexOf('async function ', start + 1);
      const end = nextDecl > 0 ? nextDecl : SRC.length;
      const region = SRC.slice(start, end);
      expect(region).toContain('createCallerClient');
      expect(region).toMatch(/auth\.getUser\(\)/);
    }
  });

  it('create is owner-gated via is_circle_owner BEFORE minting a token', () => {
    const start = SRC.indexOf('async function handleCreate');
    const nextDecl = SRC.indexOf('async function ', start + 1);
    const region = SRC.slice(start, nextDecl > 0 ? nextDecl : SRC.length);
    const ownerIdx = region.indexOf("rpc('is_circle_owner'");
    const mintIdx = region.indexOf('generateInviteToken');
    expect(ownerIdx).toBeGreaterThan(-1);
    expect(mintIdx).toBeGreaterThan(-1);
    expect(ownerIdx).toBeLessThan(mintIdx);
  });

  it('lookup_by_token is service-role only — no JWT (the token IS the auth)', () => {
    const start = SRC.indexOf('async function handleLookupByToken');
    const nextDecl = SRC.indexOf('async function ', start + 1);
    const region = SRC.slice(start, nextDecl > 0 ? nextDecl : start + 6000);
    expect(region).not.toContain('createCallerClient');
    expect(region).not.toMatch(/auth\.getUser\(\)/);
    expect(region).toContain('createServiceClient');
  });

  it('lookup_by_token never returns the member list (only circle name + masked state)', () => {
    const start = SRC.indexOf('async function handleLookupByToken');
    const nextDecl = SRC.indexOf('async function ', start + 1);
    const region = SRC.slice(start, nextDecl > 0 ? nextDecl : start + 6000);
    // It reads circles + profiles(display_name) only — never circle_members.
    expect(region).not.toMatch(/from\('circle_members'\)/);
  });

  it('provision_and_accept is service-role only and enforces email-binding BEFORE provisioning', () => {
    const start = SRC.indexOf('async function handleProvisionAndAccept');
    const region = SRC.slice(start);
    expect(region).not.toContain('createCallerClient');
    const bindingIdx = region.indexOf("'invite_email_mismatch'");
    const createUserIdx = region.indexOf('auth.admin.createUser');
    expect(bindingIdx).toBeGreaterThan(-1);
    expect(createUserIdx).toBeGreaterThan(-1);
    expect(bindingIdx).toBeLessThan(createUserIdx);
  });

  it('accept + provision enroll into circle_members with role member', () => {
    expect(SRC).toMatch(/async function enrolAndFlipInvite/);
    expect(SRC).toMatch(/from\('circle_members'\)/);
    expect(SRC).toMatch(/role:\s*'member'/);
  });

  it('never returns a JWT / session / raw token from accept or provision', () => {
    // The success bodies carry circleId + status only — no session/jwt/token.
    const acceptStart = SRC.indexOf('async function handleAccept');
    const acceptRegion = SRC.slice(acceptStart, SRC.indexOf('async function ', acceptStart + 1));
    expect(acceptRegion).not.toMatch(/session|access_token|refresh_token|\bjwt\b/i);
  });
});

describe('manage-circle-invite — raw token only in the create response', () => {
  it('the raw token (inviteLink) is built ONLY inside handleCreate', () => {
    const createStart = SRC.indexOf('async function handleCreate');
    const createEnd = SRC.indexOf('async function ', createStart + 1);
    const createRegion = SRC.slice(createStart, createEnd);
    expect(createRegion).toContain('inviteLink');
    // No other handler references the raw token / inviteLink.
    const outside = SRC.slice(0, createStart) + SRC.slice(createEnd);
    expect(outside).not.toContain('inviteLink');
    // generateInviteToken() is INVOKED only in create (the import line lives
    // outside, so scan for the call form with parens).
    expect(createRegion).toContain('generateInviteToken()');
    expect(outside).not.toContain('generateInviteToken()');
  });
});

describe('manage-circle-invite — logging rules (doctrine §5.7)', () => {
  it('contains no console.log anywhere', () => {
    expect(SRC).not.toMatch(/console\.log/);
  });

  it('no console.* line mentions Authorization / token / SERVICE_ROLE / RESEND', () => {
    const offending: string[] = [];
    for (const line of SRC.split('\n')) {
      if (!/console\.(error|warn|info|debug)/.test(line)) continue;
      const lower = line.toLowerCase();
      if (lower.includes('authorization')) offending.push(line.trim());
      if (lower.includes('token')) offending.push(line.trim());
      if (lower.includes('service_role')) offending.push(line.trim());
      if (lower.includes('resend_api_key')) offending.push(line.trim());
    }
    expect(offending).toEqual([]);
  });

  it('contains no literal SERVICE_ROLE_KEY / RESEND_API_KEY env reference', () => {
    expect(SRC).not.toContain('SERVICE_ROLE_KEY');
    expect(SRC).not.toContain('RESEND_API_KEY');
    expect(SRC).toContain('createServiceClient');
  });
});

describe('manage-circle-invite — PII safety in list/log output', () => {
  it('list_for_circle masks the invitee email (never returns the raw lower email)', () => {
    const start = SRC.indexOf('async function handleListForCircle');
    const nextDecl = SRC.indexOf('async function ', start + 1);
    const region = SRC.slice(start, nextDecl > 0 ? nextDecl : SRC.length);
    expect(region).toContain('maskEmail');
    expect(region).not.toMatch(/inviteeEmail:\s*/); // never a raw email field key
  });

  it('the create log stores emailDomain only, never the full email', () => {
    // The single console.error in create carries emailDomain(...) not the raw
    // invitee email.
    expect(SRC).toMatch(/emailDomain:\s*emailDomain\(/);
  });
});

describe('manage-circle-invite — error shape', () => {
  it('surfaces stable jsonError codes', () => {
    for (const code of [
      'cannot_invite_self',
      'not_circle_owner',
      'circle_not_found',
      'circle_deleted',
      'invite_not_visible',
      'not_pending',
      'invite_revoked',
      'invite_expired',
      'invite_already_accepted',
      'invite_not_found',
      'invite_email_mismatch',
      'account_exists',
    ]) {
      expect(SRC).toContain(`'${code}'`);
    }
  });

  it('has no banned verdict/framing token in any user-visible message', () => {
    const BANNED = [
      'winner', 'loser', 'liar', 'dishonest', 'bad faith', 'manipulative',
      'extremist', 'propagandist', 'stupid', 'idiot', 'troll', 'challenger',
    ];
    const messageRegex = /jsonError\([^,]+,\s*'[^']+',\s*'([^']+)'\)/g;
    const messages: string[] = [];
    let mm: RegExpExecArray | null;
    while ((mm = messageRegex.exec(SRC)) !== null) messages.push(mm[1].toLowerCase());
    expect(messages.length).toBeGreaterThan(0);
    for (const msg of messages) {
      for (const token of BANNED) expect(msg).not.toContain(token);
    }
  });
});

describe('manage-circle-invite — config.toml registration', () => {
  it('registers [functions.manage-circle-invite] with verify_jwt = false', () => {
    expect(CONFIG).toMatch(/\[functions\.manage-circle-invite\]\s*\nverify_jwt = false/);
  });
});
