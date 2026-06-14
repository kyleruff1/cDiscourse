/**
 * AUTH-CALLBACK-CONSUMER-001 — consumer tests.
 *
 * The consumer takes an INJECTED client, so these tests never touch the real
 * Supabase singleton and make no network call. A source-scan asserts the
 * module imports no `lib/supabase`, calls no `fetch`, and contains no
 * `console.*` (a token-bearing parse flows through here).
 */
import fs from 'fs';
import path from 'path';
import { consumeAuthCallback, DEFAULT_CONSUME_TIMEOUT_MS } from '../src/features/auth/consumeAuthCallback';
import type { AuthCallbackClient } from '../src/features/auth/consumeAuthCallback';
import type { AuthCallbackParsed } from '../src/lib/auth/parseAuthCallbackUrl';

const ACCESS = 'fake.aaa.bbb';
const REFRESH = 'fake-refresh-zzz';
const CODE = 'fake-code-xyz';

function makeClient(overrides: Partial<AuthCallbackClient> = {}): jest.Mocked<AuthCallbackClient> {
  return {
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    setSession: jest.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    exchangeCodeForSession: jest.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    ...overrides,
  } as jest.Mocked<AuthCallbackClient>;
}

/** A promise that never settles — simulates a hung GoTrue fetch (no timeout in the SDK). */
function hung(): Promise<{ data: { session: unknown | null }; error: { message: string } | null }> {
  return new Promise(() => {});
}

const tokens = (type: string | null): AuthCallbackParsed => ({
  kind: 'tokens',
  accessToken: ACCESS,
  refreshToken: REFRESH,
  type,
  expiresIn: 3600,
});
const code = (type: string | null): AuthCallbackParsed => ({ kind: 'code', code: CODE, type });

describe('consumeAuthCallback — tokens (setSession)', () => {
  it('calls setSession with exactly { access_token, refresh_token }', async () => {
    const client = makeClient();
    await consumeAuthCallback({ client, parsed: tokens('invite') });
    expect(client.setSession).toHaveBeenCalledTimes(1);
    expect(client.setSession).toHaveBeenCalledWith({ access_token: ACCESS, refresh_token: REFRESH });
    expect(client.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('invite tokens → needs_password', async () => {
    const out = await consumeAuthCallback({ client: makeClient(), parsed: tokens('invite') });
    expect(out).toEqual({ status: 'needs_password' });
  });

  it('signup tokens → success (already has a password)', async () => {
    const out = await consumeAuthCallback({ client: makeClient(), parsed: tokens('signup') });
    expect(out).toEqual({ status: 'success' });
  });

  it('magiclink tokens → success', async () => {
    const out = await consumeAuthCallback({ client: makeClient(), parsed: tokens('magiclink') });
    expect(out).toEqual({ status: 'success' });
  });

  it('email_change tokens → success', async () => {
    const out = await consumeAuthCallback({ client: makeClient(), parsed: tokens('email_change') });
    expect(out).toEqual({ status: 'success' });
  });

  it('tokens with NO type → success (cannot prove invite)', async () => {
    const out = await consumeAuthCallback({ client: makeClient(), parsed: tokens(null) });
    expect(out).toEqual({ status: 'success' });
  });
});

describe('consumeAuthCallback — code (exchangeCodeForSession)', () => {
  it('calls exchangeCodeForSession with the code', async () => {
    const client = makeClient();
    await consumeAuthCallback({ client, parsed: code('invite') });
    expect(client.exchangeCodeForSession).toHaveBeenCalledWith(CODE);
    expect(client.setSession).not.toHaveBeenCalled();
  });

  it('invite code → needs_password', async () => {
    const out = await consumeAuthCallback({ client: makeClient(), parsed: code('invite') });
    expect(out).toEqual({ status: 'needs_password' });
  });

  it('code with no type → success', async () => {
    const out = await consumeAuthCallback({ client: makeClient(), parsed: code(null) });
    expect(out).toEqual({ status: 'success' });
  });
});

describe('consumeAuthCallback — setSession / exchange error mapping', () => {
  it('maps a network message → network', async () => {
    const client = makeClient({
      setSession: jest.fn().mockResolvedValue({ data: { session: null }, error: { message: 'Network request failed' } }),
    });
    const out = await consumeAuthCallback({ client, parsed: tokens('invite') });
    expect(out).toEqual({ status: 'error', reason: 'network' });
  });

  it('maps an expired/invalid message → expired', async () => {
    const client = makeClient({
      setSession: jest.fn().mockResolvedValue({ data: { session: null }, error: { message: 'Token has expired or is invalid' } }),
    });
    const out = await consumeAuthCallback({ client, parsed: tokens('invite') });
    expect(out).toEqual({ status: 'error', reason: 'expired' });
  });

  it('maps an unrecognised message → unknown', async () => {
    const client = makeClient({
      setSession: jest.fn().mockResolvedValue({ data: { session: null }, error: { message: 'kaboom' } }),
    });
    const out = await consumeAuthCallback({ client, parsed: tokens('invite') });
    expect(out).toEqual({ status: 'error', reason: 'unknown' });
  });

  it('maps an exchange error message → mapped reason', async () => {
    const client = makeClient({
      exchangeCodeForSession: jest.fn().mockResolvedValue({ data: { session: null }, error: { message: 'failed to fetch' } }),
    });
    const out = await consumeAuthCallback({ client, parsed: code('invite') });
    expect(out).toEqual({ status: 'error', reason: 'network' });
  });

  it('a rejected setSession promise → network (never throws out)', async () => {
    const client = makeClient({ setSession: jest.fn().mockRejectedValue(new Error('boom')) });
    const out = await consumeAuthCallback({ client, parsed: tokens('invite') });
    expect(out).toEqual({ status: 'error', reason: 'network' });
  });

  it('a rejected exchange promise → network', async () => {
    const client = makeClient({ exchangeCodeForSession: jest.fn().mockRejectedValue(new Error('boom')) });
    const out = await consumeAuthCallback({ client, parsed: code('invite') });
    expect(out).toEqual({ status: 'error', reason: 'network' });
  });
});

describe('consumeAuthCallback — timeout guard (AUTH-CALLBACK-TIMEOUT-001)', () => {
  it('tokens: a hung setSession resolves to error:network within timeoutMs (no infinite hang)', async () => {
    const client = makeClient({ setSession: jest.fn().mockReturnValue(hung()) });
    const out = await consumeAuthCallback({ client, parsed: tokens('invite'), timeoutMs: 20 });
    expect(out).toEqual({ status: 'error', reason: 'network' });
  });

  it('code: a hung exchangeCodeForSession resolves to error:network within timeoutMs', async () => {
    const client = makeClient({ exchangeCodeForSession: jest.fn().mockReturnValue(hung()) });
    const out = await consumeAuthCallback({ client, parsed: code('invite'), timeoutMs: 20 });
    expect(out).toEqual({ status: 'error', reason: 'network' });
  });

  it('empty: a hung getSession resolves to error:network within timeoutMs', async () => {
    const client = makeClient({ getSession: jest.fn().mockReturnValue(hung()) });
    const out = await consumeAuthCallback({ client, parsed: { kind: 'empty' }, timeoutMs: 20 });
    expect(out).toEqual({ status: 'error', reason: 'network' });
  });

  it('a fast client still resolves normally well before the timeout (no false timeout)', async () => {
    const out = await consumeAuthCallback({ client: makeClient(), parsed: tokens('invite'), timeoutMs: 5000 });
    expect(out).toEqual({ status: 'needs_password' });
  });

  it('exports a bounded default timeout', () => {
    expect(typeof DEFAULT_CONSUME_TIMEOUT_MS).toBe('number');
    expect(DEFAULT_CONSUME_TIMEOUT_MS).toBeGreaterThan(0);
    expect(DEFAULT_CONSUME_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});

describe('consumeAuthCallback — empty (getSession idempotency probe)', () => {
  it('empty + live session → already_session', async () => {
    const client = makeClient({
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }),
    });
    const out = await consumeAuthCallback({ client, parsed: { kind: 'empty' } });
    expect(out).toEqual({ status: 'already_session' });
    expect(client.setSession).not.toHaveBeenCalled();
  });

  it('empty + no session → error:link_invalid', async () => {
    const out = await consumeAuthCallback({ client: makeClient(), parsed: { kind: 'empty' } });
    expect(out).toEqual({ status: 'error', reason: 'link_invalid' });
  });

  it('empty + getSession error → mapped error', async () => {
    const client = makeClient({
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: { message: 'network down' } }),
    });
    const out = await consumeAuthCallback({ client, parsed: { kind: 'empty' } });
    expect(out).toEqual({ status: 'error', reason: 'network' });
  });
});

describe('consumeAuthCallback — error / unsupported never call the client', () => {
  it('recoverable error → expired, no client call', async () => {
    const client = makeClient();
    const out = await consumeAuthCallback({
      client,
      parsed: { kind: 'error', error: 'access_denied', errorCode: 'otp_expired', description: null, recoverable: true },
    });
    expect(out).toEqual({ status: 'error', reason: 'expired' });
    expect(client.getSession).not.toHaveBeenCalled();
    expect(client.setSession).not.toHaveBeenCalled();
    expect(client.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('non-recoverable error → link_invalid, no client call', async () => {
    const out = await consumeAuthCallback({
      client: makeClient(),
      parsed: { kind: 'error', error: 'server_error', errorCode: null, description: null, recoverable: false },
    });
    expect(out).toEqual({ status: 'error', reason: 'link_invalid' });
  });

  it('unsupported → link_invalid, no client call', async () => {
    const client = makeClient();
    const out = await consumeAuthCallback({ client, parsed: { kind: 'unsupported', reason: 'token_hash' } });
    expect(out).toEqual({ status: 'error', reason: 'link_invalid' });
    expect(client.setSession).not.toHaveBeenCalled();
    expect(client.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe('consumeAuthCallback — no token is ever logged', () => {
  it('never calls console.* during a tokens consume', async () => {
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
      jest.spyOn(console, 'info').mockImplementation(() => undefined),
    ];
    await consumeAuthCallback({ client: makeClient(), parsed: tokens('invite') });
    for (const s of spies) {
      expect(s).not.toHaveBeenCalled();
      s.mockRestore();
    }
  });
});

describe('consumeAuthCallback — source scan (only the injected client is touched)', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src', 'features', 'auth', 'consumeAuthCallback.ts'),
    'utf8',
  );
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  it('does NOT import the supabase singleton', () => {
    expect(code).not.toMatch(/from ['"].*lib\/supabase['"]/);
  });
  it('performs no fetch of its own', () => {
    expect(code).not.toMatch(/\bfetch\s*\(/);
  });
  it('contains no console.*', () => {
    expect(code).not.toMatch(/console\./);
  });
  it('contains no SERVICE_ROLE / ANTHROPIC_API_KEY literal', () => {
    expect(code).not.toContain('SERVICE_ROLE');
    expect(code).not.toContain('service_role');
    expect(code).not.toContain('ANTHROPIC_API_KEY');
  });
});
