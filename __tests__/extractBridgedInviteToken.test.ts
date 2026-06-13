/**
 * ARG-ROOM-004 (#615) — the `/auth/callback?invite=<token>` → seat bridge
 * extractor + the combined cold-start resolver.
 *
 * Doctrine pins:
 *  - pure / never throws,
 *  - path-gated to `/auth/callback` (a stray `?invite=` elsewhere is ignored),
 *  - reads ONLY the query (never the implicit-flow `#access_token=…` fragment
 *    secrets — no secret leak),
 *  - token-shape-gated (a typo is never carried forward).
 */
import {
  extractBridgedInviteToken,
  resolveColdStartInviteToken,
} from '../src/features/invites/bridgedInviteToken';

const TOKEN = 'A'.repeat(43); // 43 base64url chars — within [32, 64]
const TOKEN2 = 'b'.repeat(40);
const ORIGIN = 'https://dev-cdiscourse.netlify.app';

describe('extractBridgedInviteToken — happy path', () => {
  it('reads a valid ?invite=<token> off /auth/callback', () => {
    expect(extractBridgedInviteToken(`${ORIGIN}/auth/callback?invite=${TOKEN}`)).toBe(TOKEN);
  });

  it('tolerates a trailing slash on the callback path', () => {
    expect(extractBridgedInviteToken(`${ORIGIN}/auth/callback/?invite=${TOKEN}`)).toBe(TOKEN);
  });

  it('reads the token when an implicit-flow fragment is ALSO present', () => {
    const url = `${ORIGIN}/auth/callback?invite=${TOKEN}#access_token=SECRET&refresh_token=SECRET2&type=invite`;
    expect(extractBridgedInviteToken(url)).toBe(TOKEN);
  });

  it('accepts http localhost (dev web)', () => {
    expect(extractBridgedInviteToken(`http://localhost:8081/auth/callback?invite=${TOKEN}`)).toBe(TOKEN);
  });
});

describe('extractBridgedInviteToken — no secret leak', () => {
  it('never returns a fragment auth-token value; only the query invite token', () => {
    const url = `${ORIGIN}/auth/callback?invite=${TOKEN}#access_token=eyJhbGSECRET.payload.sig&type=invite`;
    const out = extractBridgedInviteToken(url);
    expect(out).toBe(TOKEN);
    expect(out).not.toContain('access_token');
    expect(out).not.toContain('SECRET');
    expect(out).not.toContain('eyJ');
  });

  it('ignores a token placed in the FRAGMENT (query-only read)', () => {
    // `invite` in the fragment must NOT be read — only the query is consulted.
    expect(extractBridgedInviteToken(`${ORIGIN}/auth/callback#invite=${TOKEN}`)).toBeNull();
  });
});

describe('extractBridgedInviteToken — rejections (→ null, never throws)', () => {
  it('missing ?invite= param → null', () => {
    expect(extractBridgedInviteToken(`${ORIGIN}/auth/callback`)).toBeNull();
    expect(extractBridgedInviteToken(`${ORIGIN}/auth/callback?foo=bar`)).toBeNull();
  });

  it('empty ?invite= value → null', () => {
    expect(extractBridgedInviteToken(`${ORIGIN}/auth/callback?invite=`)).toBeNull();
  });

  it('token too short / too long / bad chars → null', () => {
    expect(extractBridgedInviteToken(`${ORIGIN}/auth/callback?invite=${'A'.repeat(20)}`)).toBeNull();
    expect(extractBridgedInviteToken(`${ORIGIN}/auth/callback?invite=${'A'.repeat(80)}`)).toBeNull();
    expect(extractBridgedInviteToken(`${ORIGIN}/auth/callback?invite=${'A'.repeat(42)}!`)).toBeNull();
  });

  it('non-callback path → null (path-gated)', () => {
    expect(extractBridgedInviteToken(`${ORIGIN}/invite/${TOKEN}?invite=${TOKEN}`)).toBeNull();
    expect(extractBridgedInviteToken(`${ORIGIN}/?invite=${TOKEN}`)).toBeNull();
    expect(extractBridgedInviteToken(`${ORIGIN}/auth/callbacks?invite=${TOKEN}`)).toBeNull();
    expect(extractBridgedInviteToken(`${ORIGIN}/auth/callback/extra?invite=${TOKEN}`)).toBeNull();
  });

  it('non-http(s) scheme → null', () => {
    expect(extractBridgedInviteToken(`cdiscourse://auth/callback?invite=${TOKEN}`)).toBeNull();
    expect(extractBridgedInviteToken(`ftp://x/auth/callback?invite=${TOKEN}`)).toBeNull();
  });

  it('non-string / malformed input → null, never throws', () => {
    for (const bad of [null, undefined, 42, {}, [], '', '   ', 'not a url', 'http://', '://x']) {
      expect(() => extractBridgedInviteToken(bad as unknown as string)).not.toThrow();
      expect(extractBridgedInviteToken(bad as unknown as string)).toBeNull();
    }
  });
});

describe('resolveColdStartInviteToken — combines /invite path + bridge query', () => {
  it('resolves the QOL-038 /invite/<token> deep-link path', () => {
    expect(resolveColdStartInviteToken(`${ORIGIN}/invite/${TOKEN}`)).toBe(TOKEN);
  });

  it('resolves the ARG-ROOM-004 /auth/callback?invite=<token> bridge', () => {
    expect(resolveColdStartInviteToken(`${ORIGIN}/auth/callback?invite=${TOKEN}`)).toBe(TOKEN);
  });

  it('returns null for a plain app URL with no invite', () => {
    expect(resolveColdStartInviteToken(`${ORIGIN}/`)).toBeNull();
    expect(resolveColdStartInviteToken(`${ORIGIN}/auth/callback`)).toBeNull();
  });

  it('prefers the /invite/<token> path form when both shapes are present', () => {
    // A /invite/<tokenA> path with a ?invite=<tokenB> query resolves to the
    // PATH token (parseInviteDeepLink wins; the bridge is the fallback).
    expect(resolveColdStartInviteToken(`${ORIGIN}/invite/${TOKEN}?invite=${TOKEN2}`)).toBe(TOKEN);
  });

  it('never throws on garbage input', () => {
    for (const bad of [null, undefined, 0, {}, '', 'xx']) {
      expect(() => resolveColdStartInviteToken(bad as unknown as string)).not.toThrow();
      expect(resolveColdStartInviteToken(bad as unknown as string)).toBeNull();
    }
  });
});
