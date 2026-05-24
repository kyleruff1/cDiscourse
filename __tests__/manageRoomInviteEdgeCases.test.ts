/**
 * QOL-038 — edge-case + auth-matrix contract assertions on the
 * manage-room-invite Edge Function, via static source scan.
 *
 * The function file uses Deno-only imports and cannot be loaded by Jest.
 * The mirror-test pattern (see __tests__/inviteSchemas.test.ts) covers
 * the schema; this file covers the §5 / §10 / §17 design contract by
 * scanning the function's source for the load-bearing branches.
 *
 * Each assertion names the design section it enforces.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'manage-room-invite', 'index.ts'),
  'utf8',
);

// Scope helpers — limit a search to a single handler's body.
function regionFor(handlerName: string): string {
  const start = SRC.indexOf(`async function ${handlerName}`);
  if (start < 0) return '';
  const nextDecl = SRC.indexOf('async function ', start + 1);
  const end = nextDecl > 0 ? nextDecl : SRC.length;
  return SRC.slice(start, end);
}

// ── §5.1 create ────────────────────────────────────────────────

describe('§5.1 create — auth + state checks', () => {
  const region = regionFor('handleCreate');

  it('returns 401 on missing JWT (no authHeader)', () => {
    expect(region).toMatch(/if \(!authHeader\) return unauthorized\(\)/);
  });

  it('rejects self-invite with 400 cannot_invite_self', () => {
    expect(region).toContain('cannot_invite_self');
  });

  it('reads the debate via caller-scoped client (RLS does visibility)', () => {
    expect(region).toMatch(/callerClient[\s\S]{0,200}\.from\('debates'\)/);
  });

  it('returns 403 room_not_visible when the debate is not visible to the caller', () => {
    expect(region).toContain('room_not_visible');
  });

  it('returns 409 room_archived when the debate.status = archived (QOL-038 §17 enrichment)', () => {
    expect(region).toContain('room_archived');
  });

  it('returns 409 room_closed when the debate is locked / settled', () => {
    expect(region).toContain('room_closed');
  });

  it('returns 403 not_allowed_to_invite for an observer', () => {
    expect(region).toContain('not_allowed_to_invite');
  });

  it('checks for a pre-existing pending invite and returns reused: true', () => {
    expect(region).toContain('reused: true');
  });

  it('mints the token + hashes it via the shared helpers', () => {
    expect(region).toContain('generateInviteToken()');
    expect(region).toContain('hashInviteToken(rawToken)');
  });

  it('inserts via service-role client (privileged write)', () => {
    expect(region).toMatch(/svc[\s\S]{0,200}\.from\('argument_room_invites'\)[\s\S]{0,200}\.insert/);
  });
});

// ── §5.2 revoke ────────────────────────────────────────────────

describe('§5.2 revoke — auth + state checks', () => {
  const region = regionFor('handleRevoke');

  it('returns 401 on missing JWT', () => {
    expect(region).toMatch(/if \(!authHeader\) return unauthorized\(\)/);
  });

  it('returns 403 invite_not_visible when the invite is not visible to the caller', () => {
    expect(region).toContain('invite_not_visible');
  });

  it('returns 409 not_pending when status != pending', () => {
    expect(region).toContain('not_pending');
  });

  it('updates via service-role client', () => {
    expect(region).toMatch(/svc[\s\S]{0,300}\.update\(/);
  });
});

// ── §5.3 list_for_debate ───────────────────────────────────────

describe('§5.3 list_for_debate — auth + projection', () => {
  const region = regionFor('handleListForDebate');

  it('returns 401 on missing JWT', () => {
    expect(region).toMatch(/if \(!authHeader\) return unauthorized\(\)/);
  });

  it('reads via caller-scoped client (RLS is the visibility gate)', () => {
    expect(region).toContain('callerClient');
    expect(region).toMatch(/\.from\('argument_room_invites'\)/);
  });

  it('does NOT select token_hash (the inviter never needs it)', () => {
    // The select() argument string must not contain `token_hash`.
    const selectMatch = region.match(/\.select\([^)]+\)/);
    expect(selectMatch).not.toBeNull();
    expect(selectMatch![0]).not.toContain('token_hash');
  });

  it('emits maskEmail (the local part is masked)', () => {
    expect(region).toContain('maskEmail');
  });
});

// ── §5.4 lookup_by_token (unauthenticated) ─────────────────────

describe('§5.4 lookup_by_token — unauthenticated + minimal projection', () => {
  const region = regionFor('handleLookupByToken');

  it('does NOT require a JWT (no createCallerClient call)', () => {
    expect(region).not.toContain('createCallerClient');
  });

  it('returns 404 invite_not_found for an unknown token', () => {
    expect(region).toContain('invite_not_found');
  });

  it('treats a pending+expired row as expired in the response', () => {
    expect(region).toContain("liveStatus = 'expired'");
  });

  it('returns room: null and the bare status for non-pending live status', () => {
    // The branch is "if (liveStatus !== 'pending') return ok({ ... room: null }".
    expect(region).toMatch(/if \(liveStatus !== 'pending'\)/);
    expect(region).toContain('room: null');
  });

  it('returns room_archived for debate.status = archived (QOL-038 §17 enrichment)', () => {
    expect(region).toContain("status: 'room_archived'");
  });

  it('returns room_closed for debate.status = locked / settled', () => {
    expect(region).toContain("status: 'room_closed'");
  });

  it('emits only display-safe fields (title, invitedByDisplayName) — no email, no body', () => {
    // The pending success branch.
    expect(region).toContain('invitedByDisplayName');
    // Defensive: the function must never emit invitee_email_lower from
    // this action.
    expect(region).not.toContain('invitee_email_lower:');
    expect(region).not.toContain('inviteeEmail');
  });

  it('echoes the token back to the gate via tokenEcho (so it can carry into accept)', () => {
    expect(region).toContain('tokenEcho');
  });
});

// ── §5.5 accept — the security spine ───────────────────────────

describe('§5.5 accept — auth + email-binding + enrolment', () => {
  const region = regionFor('handleAccept');

  it('returns 401 on missing JWT', () => {
    expect(region).toMatch(/if \(!authHeader\) return unauthorized\(\)/);
  });

  it('returns 404 invite_not_found for an unknown token_hash', () => {
    expect(region).toContain('invite_not_found');
  });

  it('returns 409 invite_revoked for a revoked invite', () => {
    expect(region).toContain('invite_revoked');
  });

  it('returns 409 invite_expired for an expired invite (TTL or stored)', () => {
    expect(region).toContain('invite_expired');
  });

  it('is idempotent when same redeemer re-accepts (returns accepted)', () => {
    expect(region).toMatch(/invitee_profile_id === callerId/);
  });

  it('returns 409 invite_already_accepted when someone else already redeemed it', () => {
    expect(region).toContain('invite_already_accepted');
  });

  it('returns 403 invite_email_mismatch when caller email != invited email (the security spine)', () => {
    expect(region).toContain('invite_email_mismatch');
    expect(region).toMatch(/callerEmail[\s\S]{0,80}!==[\s\S]{0,80}invitee_email_lower/);
  });

  it('returns 409 room_archived (QOL-038 §17 enrichment)', () => {
    expect(region).toContain('room_archived');
  });

  it('returns 409 room_closed when the debate is locked / settled', () => {
    expect(region).toContain('room_closed');
  });

  it('enrols the participant via service-role client', () => {
    expect(region).toMatch(/svc[\s\S]{0,400}\.from\('debate_participants'\)[\s\S]{0,200}\.insert/);
  });

  it('flips the invite to accepted via service-role client', () => {
    expect(region).toMatch(/svc[\s\S]{0,200}\.from\('argument_room_invites'\)[\s\S]{0,200}\.update/);
  });

  it('the participant insert tolerates a unique-violation (already a participant)', () => {
    // 23505 = Postgres unique_violation.
    expect(region).toContain("'23505'");
  });
});

// ── §10 edge cases ─────────────────────────────────────────────

describe('§10 edge cases — race conditions + idempotency', () => {
  const createRegion = regionFor('handleCreate');

  it('§10 row 5 — partial unique index race on create returns the existing row idempotently', () => {
    // The function catches the insert error, re-reads the row, and
    // returns `reused: true`.
    expect(createRegion).toMatch(/insertErr[\s\S]*?\!inserted/);
    expect(createRegion).toContain('raced');
    expect(createRegion).toContain('reused: true');
  });

  it('§10 row 6 — invitee already a participant in the room is a no-op insert', () => {
    const acceptRegion = regionFor('handleAccept');
    // unique-violation tolerated by 23505 branch.
    expect(acceptRegion).toContain("'23505'");
  });
});
