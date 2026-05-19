/**
 * QOL-024 — invite_user audit-payload + response-safety.
 *
 * Tests the pure builders in `supabase/functions/_shared/adminInvitePayload.ts`.
 * That file uses no Deno-only imports, so Jest can load it directly. The
 * doctrine guarantee under test: a raw email / a redirect URL / a token / a
 * link / a userId never reaches an audit row or the client response.
 *
 * The final case is a static source scan of the Edge Function handler.
 */
import fs from 'fs';
import path from 'path';
import {
  buildInviteAuditPayload,
  buildInviteResponse,
} from '../supabase/functions/_shared/adminInvitePayload';
import { adminErrorMessage } from '../src/features/admin/adminHelpers';

describe('buildInviteAuditPayload — email is reduced to a domain', () => {
  it('stores emailDomain = the substring after @, never the full email', () => {
    const payload = buildInviteAuditPayload({
      email: 'tester@example.com',
      role: 'user',
      redirectToProvided: false,
    });
    expect(payload.emailDomain).toBe('example.com');
    expect(JSON.stringify(payload)).not.toContain('tester@example.com');
    expect(JSON.stringify(payload)).not.toContain('tester');
  });

  it('handles a malformed email with no @ by storing emailDomain = null', () => {
    const payload = buildInviteAuditPayload({
      email: 'not-an-email',
      role: 'user',
      redirectToProvided: false,
    });
    expect(payload.emailDomain).toBeNull();
  });
});

describe('buildInviteAuditPayload — redirect URL is never stored', () => {
  it('stores redirectToProvided as a boolean, never a URL string', () => {
    const provided = buildInviteAuditPayload({
      email: 'a@b.com',
      role: 'user',
      redirectToProvided: true,
    });
    expect(typeof provided.redirectToProvided).toBe('boolean');
    expect(provided.redirectToProvided).toBe(true);
    const serialized = JSON.stringify(provided);
    expect(serialized).not.toContain('http');
  });
});

describe('buildInviteAuditPayload — exact key set', () => {
  it('has exactly emailDomain / role / redirectToProvided / invited / notification', () => {
    const payload = buildInviteAuditPayload({
      email: 'a@b.com',
      role: 'moderator',
      redirectToProvided: true,
    });
    expect(Object.keys(payload).sort()).toEqual(
      ['emailDomain', 'invited', 'notification', 'redirectToProvided', 'role'].sort(),
    );
    // No leak-prone keys.
    for (const banned of ['email', 'redirectTo', 'token', 'link', 'userId', 'password']) {
      expect(payload).not.toHaveProperty(banned);
    }
  });

  it('only ever stores role user or moderator — never admin', () => {
    for (const role of ['user', 'moderator'] as const) {
      const payload = buildInviteAuditPayload({ email: 'a@b.com', role, redirectToProvided: false });
      expect(payload.role).toBe(role);
      expect(payload.role).not.toBe('admin');
    }
  });
});

describe('buildInviteResponse — client response carries no secrets / PII', () => {
  it('returns exactly { ok: true, invited: true, notification: "sent" }', () => {
    expect(buildInviteResponse()).toEqual({ ok: true, invited: true, notification: 'sent' });
  });

  it('contains no email-shaped / link / token substring', () => {
    const serialized = JSON.stringify(buildInviteResponse());
    for (const banned of ['@', 'http', 'token', 'link', 'userId', 'Bearer ', 'eyJ']) {
      expect(serialized).not.toContain(banned);
    }
  });

  it('notification is the literal "sent" on the happy path', () => {
    const notification: 'sent' | 'not_configured' | 'send_failed' = buildInviteResponse().notification;
    expect(notification).toBe('sent');
  });
});

describe('invite_user — doctrine ban-list', () => {
  const BANNED = ['winner', 'loser', 'liar', 'correct', 'dishonest', 'bad faith', 'propagandist'];

  it('neither the audit payload nor the response contains verdict tokens', () => {
    const blob = (
      JSON.stringify(buildInviteAuditPayload({ email: 'a@b.com', role: 'user', redirectToProvided: true })) +
      JSON.stringify(buildInviteResponse())
    ).toLowerCase();
    for (const banned of BANNED) {
      expect(blob).not.toContain(banned);
    }
  });
});

describe('invite_email_not_configured — plain-language mapping', () => {
  it('maps to operator-directed copy with no snake_case and no raw code echo', () => {
    const copy = adminErrorMessage({ error: 'invite_email_not_configured' }, 422);
    expect(copy).not.toMatch(/_/);
    expect(copy).not.toMatch(/invite_email_not_configured/);
    expect(copy.length).toBeGreaterThan(0);
  });
});

describe('admin-users handler — static source-scan', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'functions', 'admin-users', 'index.ts'),
    'utf8',
  );

  it('contains the handleInviteUser handler', () => {
    expect(src).toMatch(/async function handleInviteUser\b/);
  });

  it('uses inviteUserByEmail, never a generateLink call for invites', () => {
    expect(src).toMatch(/inviteUserByEmail/);
    // generateLink is still used by handleSendPasswordReset; assert the invite
    // handler region itself never *calls* it (a comment mentioning the name
    // for rationale is fine — only `generateLink(` is the forbidden token).
    const inviteRegion = src.slice(
      src.indexOf('async function handleInviteUser'),
      src.indexOf('async function handleSendPasswordReset'),
    );
    expect(inviteRegion.length).toBeGreaterThan(0);
    expect(inviteRegion).not.toMatch(/generateLink\s*\(/);
  });

  it('the handler never logs Authorization, the invite link, or redirectTo', () => {
    const inviteRegion = src.slice(
      src.indexOf('async function handleInviteUser'),
      src.indexOf('async function handleSendPasswordReset'),
    );
    expect(inviteRegion).not.toMatch(/console\.log/);
    expect(inviteRegion).not.toMatch(/console\.(error|warn|info)\([^)]*Authorization/i);
    expect(inviteRegion).not.toMatch(/console\.\w+\([^)]*redirectTo/);
  });

  it('contains no console.log anywhere in the file (repo no-console rule)', () => {
    expect(src).not.toMatch(/console\.log/);
  });
});
