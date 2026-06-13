/**
 * AUTH-CALLBACK-CONSUMER-001 — seed-smoke readiness proof.
 *
 * Drives a SYNTHETIC invite callback URL through the real parser and the real
 * consumer (with a mock client) and proves the full parse → consume →
 * needs_password chain. Entirely mock-driven: no live send, no network. This
 * is the green-light the testing-run doc cites.
 */
import fs from 'fs';
import path from 'path';
import {
  parseAuthCallbackUrl,
  redactAuthCallbackUrl,
} from '../src/lib/auth/parseAuthCallbackUrl';
import { consumeAuthCallback } from '../src/features/auth/consumeAuthCallback';
import type { AuthCallbackClient } from '../src/features/auth/consumeAuthCallback';

// The exact synthetic shape the seed invite will land as (implicit flow,
// fragment token). Obviously-fake values — never a real token.
const SYNTHETIC_INVITE_CALLBACK_URL =
  'https://dev.cdiscourse.com/auth/callback#access_token=fake.aaa.bbb&refresh_token=fake-refresh&expires_in=3600&token_type=bearer&type=invite';

function makeMockClient(): jest.Mocked<AuthCallbackClient> {
  return {
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    setSession: jest.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    exchangeCodeForSession: jest.fn().mockResolvedValue({ data: { session: {} }, error: null }),
  } as jest.Mocked<AuthCallbackClient>;
}

describe('seed-smoke readiness — synthetic invite callback', () => {
  it('parses the synthetic invite URL to tokens(type=invite)', () => {
    const parsed = parseAuthCallbackUrl(SYNTHETIC_INVITE_CALLBACK_URL);
    expect(parsed).toEqual({
      kind: 'tokens',
      accessToken: 'fake.aaa.bbb',
      refreshToken: 'fake-refresh',
      type: 'invite',
      expiresIn: 3600,
    });
  });

  it('parse → consume(mock) → needs_password', async () => {
    const client = makeMockClient();
    const parsed = parseAuthCallbackUrl(SYNTHETIC_INVITE_CALLBACK_URL);
    const outcome = await consumeAuthCallback({ client, parsed });
    expect(outcome).toEqual({ status: 'needs_password' });
  });

  it('the mock client.setSession received exactly the parsed fragment tokens', async () => {
    const client = makeMockClient();
    const parsed = parseAuthCallbackUrl(SYNTHETIC_INVITE_CALLBACK_URL);
    await consumeAuthCallback({ client, parsed });
    expect(client.setSession).toHaveBeenCalledWith({
      access_token: 'fake.aaa.bbb',
      refresh_token: 'fake-refresh',
    });
    expect(client.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('a diagnostic of the synthetic URL never reveals the token', () => {
    const redacted = redactAuthCallbackUrl(SYNTHETIC_INVITE_CALLBACK_URL);
    expect(redacted).not.toContain('fake.aaa.bbb');
    expect(redacted).not.toContain('fake-refresh');
    expect(redacted).toContain('access_token=***');
  });
});

describe('seed-smoke readiness — no live send is possible from these modules', () => {
  // Strip comments before scanning for CODE capability — a doc comment that
  // names the upstream invite flow is prose, not a send seam (mirrors the
  // InviteRedeemGate.test.tsx comment-stripping discipline).
  function readCode(...segs: string[]): string {
    const raw = fs.readFileSync(path.join(process.cwd(), ...segs), 'utf8');
    return raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  }
  const parser = readCode('src', 'lib', 'auth', 'parseAuthCallbackUrl.ts');
  const consumer = readCode('src', 'features', 'auth', 'consumeAuthCallback.ts');
  const copy = readCode('src', 'features', 'auth', 'authCallbackCopy.ts');

  it('neither the parser nor the consumer performs a fetch', () => {
    expect(parser).not.toMatch(/\bfetch\s*\(/);
    expect(consumer).not.toMatch(/\bfetch\s*\(/);
  });

  it('no module CALLS an invite-send / edge-function seam', () => {
    for (const src of [parser, consumer, copy]) {
      expect(src).not.toMatch(/inviteUserByEmail\s*\(/);
      expect(src).not.toContain('edgeFunctions');
      expect(src).not.toContain('admin-users');
      expect(src).not.toMatch(/sendInvite\w*\s*\(/);
    }
  });

  it('the parser imports nothing (fully pure)', () => {
    expect(parser).not.toMatch(/^import\s/m);
  });
});
