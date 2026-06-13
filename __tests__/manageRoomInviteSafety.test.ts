/**
 * QOL-038 — static safety scan of the manage-room-invite Edge Function.
 *
 * Doctrine §5.7 logging rules + cdiscourse-doctrine §6 (secrets policy)
 * are enforced by a source-text scan because the function file uses
 * Deno-only imports (npm:zod, ../_shared/supabaseClients) and cannot be
 * loaded by Jest. This is the same pattern adminInviteUserAuditShape.test.ts
 * uses for the admin-users function.
 *
 * The scan asserts:
 *   - No console.log anywhere (the repo no-console rule + §5.7).
 *   - No `console.*(...Authorization...)` reference.
 *   - No raw `Authorization` header value is ever interpolated into a log
 *     line (the function legitimately reads the header but never echoes
 *     it).
 *   - No SERVICE_ROLE_KEY / RESEND_API_KEY literal reference (the
 *     function uses createServiceClient, not the raw env var).
 *   - No raw token interpolation into a console.* call.
 *   - No full email is included in an audit payload (the function emits
 *     emailDomain only).
 *   - The five action handlers each exist as a named handler.
 *   - The function uses createCallerClient + getUser at the START of
 *     every action that mutates state (defense-in-depth against a
 *     verify_jwt=false config drift).
 *   - Every error path returns a code, not a stack trace.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'manage-room-invite', 'index.ts'),
  'utf8',
);

describe('manage-room-invite — handler structure', () => {
  it('declares each of the five action handlers as a named async function', () => {
    expect(SRC).toMatch(/async function handleCreate\b/);
    expect(SRC).toMatch(/async function handleRevoke\b/);
    expect(SRC).toMatch(/async function handleListForDebate\b/);
    expect(SRC).toMatch(/async function handleLookupByToken\b/);
    expect(SRC).toMatch(/async function handleAccept\b/);
  });

  it('routes each action by literal in the discriminated switch', () => {
    for (const action of ['create', 'revoke', 'list_for_debate', 'lookup_by_token', 'accept']) {
      expect(SRC).toContain(`case '${action}'`);
    }
  });

  it('uses ManageRoomInviteRequestSchema.safeParse before reading the body shape', () => {
    expect(SRC).toContain('ManageRoomInviteRequestSchema.safeParse');
  });

  it('validates the JWT (via createCallerClient + getUser) at the start of every mutating handler', () => {
    // Each handler body must contain the createCallerClient + getUser pair.
    const handlers = ['handleCreate', 'handleRevoke', 'handleListForDebate', 'handleAccept'];
    for (const name of handlers) {
      const startIdx = SRC.indexOf(`async function ${name}`);
      expect(startIdx).toBeGreaterThan(-1);
      // Scope the region to JUST this handler (up to the next `async
      // function` declaration). A bare 4000-char window would leak into
      // the following handler.
      const nextDecl = SRC.indexOf('async function ', startIdx + 1);
      const end = nextDecl > 0 ? nextDecl : SRC.length;
      const region = SRC.slice(startIdx, end);
      expect(region).toContain('createCallerClient');
      expect(region).toMatch(/auth\.getUser\(\)/);
    }
  });

  it('handleLookupByToken does NOT require a JWT (the token IS the auth)', () => {
    const start = SRC.indexOf('async function handleLookupByToken');
    expect(start).toBeGreaterThan(-1);
    // End the region at the NEXT `async function` declaration so we don't
    // accidentally scan into handleAccept (which legitimately reads a JWT).
    const nextDecl = SRC.indexOf('async function ', start + 1);
    const end = nextDecl > 0 ? nextDecl : start + 4000;
    const region = SRC.slice(start, end);
    // The single-action exception: no createCallerClient + getUser pair.
    expect(region).not.toContain('createCallerClient');
    expect(region).not.toMatch(/auth\.getUser\(\)/);
    // It must use service-role for the read.
    expect(region).toContain('createServiceClient');
  });
});

describe('manage-room-invite — logging rules (doctrine §5.7)', () => {
  it('contains no console.log anywhere (repo no-console rule)', () => {
    expect(SRC).not.toMatch(/console\.log/);
  });

  it('the only console.* references are an error-channel log of a stable error label, no headers or tokens', () => {
    const lines = SRC.split('\n');
    const offending: string[] = [];
    for (const line of lines) {
      const m = line.match(/console\.(error|warn|info|debug)/);
      if (!m) continue;
      // Whitelist: a `console.error('label', body.action | invite.id, ...)`
      // shape is fine. Reject any line that mentions Authorization /
      // token / SERVICE_ROLE on the same statement.
      const lower = line.toLowerCase();
      if (lower.includes('authorization')) offending.push(line.trim());
      if (lower.includes('token')) offending.push(line.trim());
      if (lower.includes('service_role')) offending.push(line.trim());
      if (lower.includes('resend_api_key')) offending.push(line.trim());
    }
    expect(offending).toEqual([]);
  });

  it('contains no literal SERVICE_ROLE_KEY env var reference', () => {
    // The function uses createServiceClient (which reads the env inside
    // the supabaseClients module). Direct env-var literal here would be
    // unusual and a sign of leakage risk.
    expect(SRC).not.toContain('SERVICE_ROLE_KEY');
    // The shared helper reference is allowed and expected:
    expect(SRC).toContain('createServiceClient');
  });

  it('contains no literal RESEND_API_KEY env var reference (this card does not send email)', () => {
    expect(SRC).not.toContain('RESEND_API_KEY');
  });
});

describe('manage-room-invite — PII safety in audit payloads', () => {
  // The audit helper writes an admin_audit_events row. The function must
  // emit `emailDomain` only, never `inviteeEmailLower` or the raw email.
  it('audit calls store emailDomain only, never the full invitee email', () => {
    // Find every writeInviteAudit invocation and assert the payload
    // object does NOT mention `invitee_email_lower` or `inviteeEmail`.
    const auditCallRegex = /writeInviteAudit\([\s\S]*?\)/g;
    const matches = SRC.match(auditCallRegex) || [];
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      expect(m).not.toContain('invitee_email_lower');
      expect(m).not.toContain('inviteeEmail');
    }
  });

  it('audit calls store debateIdShort, never the full debate_id', () => {
    const auditCallRegex = /writeInviteAudit\([\s\S]*?\)/g;
    const matches = SRC.match(auditCallRegex) || [];
    for (const m of matches) {
      // Best-shape check: a `debateId:` key (vs `debateIdShort:`) inside
      // the payload would be a leak.
      expect(m).not.toMatch(/\bdebateId:/);
    }
  });
});

describe('manage-room-invite — error shape', () => {
  it('returns codes via jsonError, not stack traces', () => {
    // Every 4xx/409 path returns a jsonError(...) — assert at least one
    // representative error code from the design's §5.6 error shape table
    // is present in the source. No `throw new Error(` reach the response
    // body — they are caught by the top-level try/catch and mapped to
    // internalError().
    for (const code of [
      'cannot_invite_self',
      'room_not_visible',
      'not_allowed_to_invite',
      'room_archived',
      'room_closed',
      'room_already_has_invite', // ARG-ROOM-006 item (g)
      'not_pending',
      'invite_revoked',
      'invite_expired',
      'invite_already_accepted',
      'invite_not_found',
      'invite_email_mismatch',
    ]) {
      expect(SRC).toContain(`'${code}'`);
    }
  });

  it('the unique-violation race on create reads the existing row and returns reused: true', () => {
    expect(SRC).toContain('reused: true');
  });

  it('the §17 archived branch is present in BOTH lookup_by_token AND accept', () => {
    const lookupStart = SRC.indexOf('async function handleLookupByToken');
    const lookupRegion = SRC.slice(lookupStart, lookupStart + 6000);
    expect(lookupRegion).toContain('room_archived');

    const acceptStart = SRC.indexOf('async function handleAccept');
    const acceptRegion = SRC.slice(acceptStart, acceptStart + 6000);
    expect(acceptRegion).toContain('room_archived');
  });
});

describe('manage-room-invite — doctrine: no banned framing in error messages', () => {
  const BANNED = [
    'winner',
    'loser',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    // Issue-non-negotiable per QOL-038:
    'debate challenge',
    'game invite',
    'challenger',
  ];

  it('no user-visible error message contains a verdict / banned-framing token', () => {
    // The function's user-visible strings are the messages in
    // jsonError(status, code, message) — scan only those second-string
    // arguments. The function source also uses GAME-004 internal terms
    // like "opponent" in code comments; those are internal and not part
    // of the user-facing copy doctrine.
    const messageRegex = /jsonError\([^,]+,\s*'[^']+',\s*'([^']+)'\)/g;
    const messages: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = messageRegex.exec(SRC)) !== null) {
      messages.push(m[1].toLowerCase());
    }
    expect(messages.length).toBeGreaterThan(0);
    for (const msg of messages) {
      for (const token of BANNED) {
        expect(msg).not.toContain(token);
      }
    }
  });
});
