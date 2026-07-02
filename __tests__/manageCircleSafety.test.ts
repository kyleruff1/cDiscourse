/**
 * PRIVATE-GROUPS-002 (#859) — static safety scan of the manage-circle Edge
 * Function.
 *
 * Mirrors manageRoomInviteSafety.test.ts. The function uses Deno-only imports
 * (npm:zod via circleSchemas, ../_shared/supabaseClients) and cannot be loaded
 * by Jest, so doctrine §5.7 logging rules + §6 secrets policy are enforced by a
 * source-text scan.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'manage-circle', 'index.ts'),
  'utf8',
);

const CONFIG = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'config.toml'),
  'utf8',
);

describe('manage-circle — handler structure', () => {
  it('declares each of the six action handlers as a named async function', () => {
    expect(SRC).toMatch(/async function handleCreate\b/);
    expect(SRC).toMatch(/async function handleRename\b/);
    expect(SRC).toMatch(/async function handleSoftDelete\b/);
    expect(SRC).toMatch(/async function handleTransferOwnership\b/);
    expect(SRC).toMatch(/async function handleRemoveMember\b/);
    expect(SRC).toMatch(/async function handleListMine\b/);
  });

  it('routes each action by literal in the discriminated switch', () => {
    for (const action of [
      'create',
      'rename',
      'soft_delete',
      'transfer_ownership',
      'remove_member',
      'list_mine',
    ]) {
      expect(SRC).toContain(`case '${action}'`);
    }
  });

  it('uses ManageCircleRequestSchema.safeParse before reading the body shape', () => {
    expect(SRC).toContain('ManageCircleRequestSchema.safeParse');
  });

  it('resolves the caller via createCallerClient + getUser in every handler', () => {
    // The shared resolveCaller helper wraps createCallerClient + getUser; each
    // handler calls it (or, for list_mine, uses the caller client directly).
    expect(SRC).toContain('createCallerClient');
    expect(SRC).toMatch(/auth\.getUser\(\)/);
    expect(SRC).toMatch(/async function resolveCaller/);
    // Every mutating handler calls resolveCaller at its start.
    for (const name of [
      'handleCreate',
      'handleRename',
      'handleSoftDelete',
      'handleTransferOwnership',
      'handleRemoveMember',
    ]) {
      const start = SRC.indexOf(`async function ${name}`);
      const nextDecl = SRC.indexOf('async function ', start + 1);
      const end = nextDecl > 0 ? nextDecl : SRC.length;
      const region = SRC.slice(start, end);
      expect(region).toContain('resolveCaller');
    }
  });

  it('owner-gated mutations authorize via is_circle_owner (through authorizeOwner) BEFORE mutating', () => {
    // authorizeOwner reads circles.owner_id === caller. rename / soft_delete /
    // transfer_ownership / remove_member each call it before any update.
    expect(SRC).toMatch(/async function authorizeOwner/);
    for (const name of [
      'handleRename',
      'handleSoftDelete',
      'handleTransferOwnership',
      'handleRemoveMember',
    ]) {
      const start = SRC.indexOf(`async function ${name}`);
      const nextDecl = SRC.indexOf('async function ', start + 1);
      const end = nextDecl > 0 ? nextDecl : SRC.length;
      const region = SRC.slice(start, end);
      const authzIdx = region.indexOf('authorizeOwner');
      const updateIdx = region.search(/\.update\(/);
      expect(authzIdx).toBeGreaterThan(-1);
      if (updateIdx > -1) expect(authzIdx).toBeLessThan(updateIdx);
    }
  });

  it('create calls the create_circle RPC with p_owner_id = the caller (never client-supplied)', () => {
    expect(SRC).toContain("rpc('create_circle'");
    expect(SRC).toMatch(/p_owner_id:\s*callerId/);
  });
});

describe('manage-circle — logging rules (doctrine §5.7)', () => {
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

describe('manage-circle — PII safety (never another member email)', () => {
  it('list_mine returns circle metadata + role only, never an email field', () => {
    const start = SRC.indexOf('async function handleListMine');
    const region = SRC.slice(start);
    expect(region).not.toMatch(/invitee_email_lower|inviteeEmail|\bemail\b/i);
  });
});

describe('manage-circle — error shape (codes, not stack traces)', () => {
  it('surfaces stable jsonError codes', () => {
    for (const code of [
      'not_circle_owner',
      'circle_not_found',
      'circle_deleted',
      'member_not_found',
      'already_owner',
      'cannot_remove_owner',
    ]) {
      expect(SRC).toContain(`'${code}'`);
    }
  });

  it('has no banned verdict/framing token in any user-visible message', () => {
    const BANNED = [
      'winner', 'loser', 'liar', 'dishonest', 'bad faith', 'manipulative',
      'extremist', 'propagandist', 'stupid', 'idiot', 'troll',
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

describe('manage-circle — config.toml registration', () => {
  it('registers [functions.manage-circle] with verify_jwt = true', () => {
    expect(CONFIG).toMatch(/\[functions\.manage-circle\]\s*\nverify_jwt = true/);
  });
});
