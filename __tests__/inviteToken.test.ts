/**
 * QOL-038 — invite-token helper parity tests.
 *
 * The Deno-only `supabase/functions/_shared/inviteToken.ts` cannot be
 * loaded by Jest. We re-implement the same SHA-256 hex hash + base64url
 * random generator using Node's web-crypto and assert:
 *
 *  - the generated tokens pass `isValidInviteTokenShape` (the client
 *    parser's gate) — i.e. the two sides agree on what a "valid token"
 *    looks like;
 *  - the hash is deterministic (same raw → same hex), 64 chars, hex only;
 *  - different raw → different hex (sanity);
 *  - the source file of the Deno helper never `console.*`s the raw
 *    token, the Authorization header, or the SERVICE_ROLE key — a static
 *    scan asserts the doctrine of §5.7 ("Never log: raw token, …").
 */
import fs from 'fs';
import path from 'path';
import { webcrypto } from 'crypto';
import { isValidInviteTokenShape } from '../src/features/invites/inviteDeepLink';

// ── Re-implementation (mirror of inviteToken.ts) ───────────────

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = Buffer.from(binary, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

function mirrorGenerateInviteToken(): string {
  const bytes = new Uint8Array(32);
  webcrypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function mirrorHashInviteToken(rawToken: string): Promise<string> {
  if (typeof rawToken !== 'string' || rawToken.length === 0) {
    throw new Error('mirrorHashInviteToken: empty token');
  }
  const data = new TextEncoder().encode(rawToken);
  const digest = await webcrypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

// ── Tests ──────────────────────────────────────────────────────

describe('mirrorGenerateInviteToken', () => {
  it('produces a token that passes the client shape gate', () => {
    for (let i = 0; i < 50; i++) {
      const t = mirrorGenerateInviteToken();
      expect(isValidInviteTokenShape(t)).toBe(true);
    }
  });

  it('uses only base64url charset (no padding, no plus, no slash)', () => {
    const t = mirrorGenerateInviteToken();
    expect(t.includes('=')).toBe(false);
    expect(t.includes('+')).toBe(false);
    expect(t.includes('/')).toBe(false);
  });

  it('produces different values across calls (entropy sanity)', () => {
    const samples = new Set<string>();
    for (let i = 0; i < 100; i++) samples.add(mirrorGenerateInviteToken());
    expect(samples.size).toBe(100);
  });
});

describe('mirrorHashInviteToken', () => {
  it('is deterministic — same raw → same hex', async () => {
    const raw = mirrorGenerateInviteToken();
    const h1 = await mirrorHashInviteToken(raw);
    const h2 = await mirrorHashInviteToken(raw);
    expect(h1).toBe(h2);
  });

  it('produces 64 lower-case hex characters', async () => {
    const h = await mirrorHashInviteToken(mirrorGenerateInviteToken());
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different raw → different hex (collision sanity)', async () => {
    const a = await mirrorHashInviteToken(mirrorGenerateInviteToken());
    const b = await mirrorHashInviteToken(mirrorGenerateInviteToken());
    expect(a).not.toBe(b);
  });

  it('throws on empty input', async () => {
    await expect(mirrorHashInviteToken('')).rejects.toThrow();
  });

  it('produces the known SHA-256 hex for a fixed input', async () => {
    // RFC 6234 test vector for sha-256("abc")
    const expected =
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    expect(await mirrorHashInviteToken('abc')).toBe(expected);
  });
});

// ── Static source scan — the Deno helper itself ────────────────

describe('inviteToken.ts source scan — doctrine §5.7', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'functions', '_shared', 'inviteToken.ts'),
    'utf8',
  );

  it('never console.*s the raw token, Authorization, or SERVICE_ROLE', () => {
    // The file legitimately contains no console.* at all — the easiest
    // shape of the rule.
    expect(src).not.toMatch(/console\./);
  });

  it('contains no Authorization header literal', () => {
    expect(src.toLowerCase()).not.toContain('authorization');
  });

  it('contains no SERVICE_ROLE literal', () => {
    expect(src).not.toContain('SERVICE_ROLE');
    expect(src).not.toContain('service_role');
  });

  it('exports the two functions we test against', () => {
    expect(src).toMatch(/export function generateInviteToken\b/);
    expect(src).toMatch(/export async function hashInviteToken\b/);
  });
});
