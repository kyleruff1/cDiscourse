/**
 * ARG-ROOM-002 (#613) — static source-scan of the create-argument-room Edge
 * Function + its config.toml registration.
 *
 * The function uses Deno-only imports (npm:zod@4, ../_shared/supabaseClients,
 * Deno.serve) and cannot be loaded by Jest, so the contract is enforced by a
 * source-text scan — the same pattern manageRoomInviteSafety /
 * recordVisibilityTransition.edge use. Runtime happy/refused paths are verified
 * by the operator with `supabase functions serve` post-deploy.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'create-argument-room', 'index.ts'),
  'utf8',
);

const CONFIG = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'config.toml'),
  'utf8',
);

describe('create-argument-room — entry + standard Edge shape', () => {
  it('declares a Deno.serve entry handler', () => {
    expect(SRC).toMatch(/Deno\.serve\(async \(req: Request\)/);
  });

  it('routes a CORS preflight on OPTIONS', () => {
    expect(SRC).toContain("req.method === 'OPTIONS'");
    expect(SRC).toContain('corsHeaders');
  });

  it('rejects non-POST with methodNotAllowed()', () => {
    expect(SRC).toContain("req.method !== 'POST'");
    expect(SRC).toContain('methodNotAllowed()');
  });

  it('requires a JWT — unauthorized() when the Authorization header is missing', () => {
    expect(SRC).toMatch(/if \(!authHeader\) return unauthorized\(\)/);
  });

  it('validates the body with the schema before reading its shape', () => {
    expect(SRC).toContain('CreateArgumentRoomSchema.safeParse');
    expect(SRC).toContain('validationFailed');
  });

  it('validates the JWT via createCallerClient + getUser (defense-in-depth)', () => {
    expect(SRC).toContain('createCallerClient');
    expect(SRC).toMatch(/auth\.getUser\(\)/);
  });
});

describe('create-argument-room — schema enforces at most one invite', () => {
  it('accepts a SINGLE optional invite object (not an array) and is .strict()', () => {
    expect(SRC).toMatch(/invite:\s*InviteObject\.optional\(\)/);
    expect(SRC).toMatch(/\.strict\(\)/);
  });

  it('the invite object carries email + intendedSeat enum', () => {
    expect(SRC).toMatch(/email:\s*z\.string\(\)\.email\(\)/);
    expect(SRC).toMatch(/intendedSeat:\s*z\.enum\(\['respondent', 'co_primary'\]\)/);
  });
});

describe('create-argument-room — binding matrix enforced server-side', () => {
  it('rejects private + no invite with private_requires_invite (400)', () => {
    expect(SRC).toMatch(/body\.visibility === 'private' && !hasInvite/);
    expect(SRC).toContain("'private_requires_invite'");
    expect(SRC).toContain('400');
  });

  it('rejects a self-invite with cannot_invite_self (400)', () => {
    expect(SRC).toMatch(/callerEmail === inviteeEmailLower/);
    expect(SRC).toContain("'cannot_invite_self'");
  });

  it('maps the RPC private_requires_invite / room_capacity_reached re-assertions to stable codes', () => {
    expect(SRC).toMatch(/includes\('private_requires_invite'\)/);
    expect(SRC).toMatch(/includes\('room_capacity_reached'\)/);
  });
});

describe('create-argument-room — service-role RPC is the sole creator', () => {
  it('calls the create_argument_room RPC via the service-role client', () => {
    expect(SRC).toContain('createServiceClient');
    expect(SRC).toMatch(/\.rpc\('create_argument_room'/);
  });

  it('passes the caller id from the JWT as p_created_by (never a client-supplied id)', () => {
    expect(SRC).toMatch(/p_created_by:\s*callerId/);
  });

  it('does NOT insert into debates directly (creation goes through the RPC)', () => {
    expect(SRC).not.toMatch(/\.from\('debates'\)[\s\S]{0,40}\.insert/);
  });
});

describe('create-argument-room — raw token discipline', () => {
  it('mints the token in Deno and hashes it before it reaches Postgres', () => {
    expect(SRC).toContain('generateInviteToken()');
    expect(SRC).toMatch(/hashInviteToken\(rawToken\)/);
    // Only the HASH is sent to the RPC, never the raw token.
    expect(SRC).toMatch(/p_token_hash:\s*tokenHash/);
    expect(SRC).not.toMatch(/p_token_hash:\s*rawToken/);
  });

  it('returns the invite link ONLY from a sanitised request origin', () => {
    expect(SRC).toContain('sanitiseOriginForLink');
    expect(SRC).toMatch(/inviteLink/);
  });

  it('never logs the raw token, the Authorization header, or the service-role key', () => {
    expect(SRC).not.toMatch(/console\.log/);
    const lines = SRC.split('\n');
    const offending: string[] = [];
    for (const line of lines) {
      if (!/console\.(error|warn|info|debug)/.test(line)) continue;
      const lower = line.toLowerCase();
      if (lower.includes('authorization')) offending.push(line.trim());
      if (lower.includes('rawtoken') || lower.includes('raw_token')) offending.push(line.trim());
      if (lower.includes('service_role')) offending.push(line.trim());
    }
    expect(offending).toEqual([]);
  });

  it('contains no literal SERVICE_ROLE_KEY reference (uses createServiceClient)', () => {
    expect(SRC).not.toContain('SERVICE_ROLE_KEY');
  });
});

describe('create-argument-room — no account enumeration', () => {
  it('returns a uniform response shape — no user-exists signal', () => {
    expect(SRC).not.toMatch(/user_exists|userExists|account_exists|is_new_user|existing_user/i);
  });

  it('does not branch on whether the invited email maps to an account', () => {
    // The function never reads auth.users / admin.listUsers / inviteUserByEmail
    // — the new-user-vs-existing-user decision is made OUTSIDE this function.
    expect(SRC).not.toMatch(/admin\.listUsers|inviteUserByEmail|from\('users'\)/);
  });

  it('logs the invitee email DOMAIN only (via the emailDomain helper), never a raw-email field', () => {
    // The structured success log derives the domain with emailDomain(...); the
    // only console reference to the address is wrapped in that helper.
    expect(SRC).toMatch(/emailDomain:\s*inviteeEmailLower \? emailDomain\(inviteeEmailLower\) : null/);
    // No console line emits a raw `email:` / `inviteeEmail:` value field.
    const lines = SRC.split('\n');
    for (const line of lines) {
      if (!/console\.(error|warn|info|debug)/.test(line)) continue;
      expect(line).not.toMatch(/\b(invitee)?[Ee]mail:\s*(inviteeEmailLower|body|input)/);
    }
  });
});

describe('create-argument-room — error shape + doctrine copy', () => {
  it('returns stable codes via jsonError, never a stack trace', () => {
    for (const code of [
      'private_requires_invite',
      'cannot_invite_self',
      'room_capacity_reached',
      'no_active_constitution',
    ]) {
      expect(SRC).toContain(`'${code}'`);
    }
  });

  it('no user-visible message contains a verdict / removal token', () => {
    const BANNED = [
      'winner', 'loser', 'correct', 'true', 'false', 'liar', 'dishonest',
      'bad faith', 'manipulative', 'extremist', 'propagandist',
      'kicked', 'banned', 'booted', 'challenger', 'opponent',
    ];
    const messageRegex = /jsonError\([^,]+,\s*'[^']+',\s*'([^']+)'\)/g;
    const messages: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = messageRegex.exec(SRC)) !== null) messages.push(m[1].toLowerCase());
    expect(messages.length).toBeGreaterThan(0);
    for (const msg of messages) {
      for (const token of BANNED) expect(msg).not.toContain(token);
    }
  });
});

describe('create-argument-room — config.toml registration (auto-deploy)', () => {
  it('declares the [functions.create-argument-room] block', () => {
    expect(CONFIG).toContain('[functions.create-argument-room]');
  });

  it('sets verify_jwt = true (creation requires a signed-in caller)', () => {
    const idx = CONFIG.indexOf('[functions.create-argument-room]');
    expect(idx).toBeGreaterThanOrEqual(0);
    const tail = CONFIG.slice(idx + '[functions.create-argument-room]'.length);
    const nextSectionIdx = tail.search(/\n\[/);
    const block = nextSectionIdx >= 0 ? tail.slice(0, nextSectionIdx) : tail;
    expect(block).toMatch(/verify_jwt = true/);
    expect(block).not.toMatch(/verify_jwt = false/);
  });
});
