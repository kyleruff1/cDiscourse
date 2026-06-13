/**
 * ARG-ROOM-004 (#615) — regression guard: the `?invite=<token>` bridge does NOT
 * widen the auth-secret parser.
 *
 * The bridge token is read by the standalone `extractBridgedInviteToken`
 * helper. `parseAuthCallbackUrl` must remain auth-only: adding `?invite=…` to
 * any callback URL must produce the SAME discriminated outcome as without it,
 * and the parser must never surface the invite token in any field.
 */
import {
  parseAuthCallbackUrl,
  type AuthCallbackParsed,
} from '../src/lib/auth/parseAuthCallbackUrl';

const ORIGIN = 'https://dev-cdiscourse.netlify.app';
const TOKEN = 'A'.repeat(43);

/** Insert `?invite=<token>` into the query of a callback URL (before any #frag). */
function withInvite(url: string): string {
  const hashIdx = url.indexOf('#');
  const base = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const frag = hashIdx >= 0 ? url.slice(hashIdx) : '';
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}invite=${TOKEN}${frag}`;
}

const CASES: Array<{ name: string; url: string }> = [
  {
    name: 'implicit-flow tokens fragment',
    url: `${ORIGIN}/auth/callback#access_token=AT&refresh_token=RT&type=invite&expires_in=3600`,
  },
  {
    name: 'recoverable error fragment',
    url: `${ORIGIN}/auth/callback#error=access_denied&error_code=otp_expired&error_description=expired`,
  },
  {
    name: 'PKCE code query',
    url: `${ORIGIN}/auth/callback?code=abc123&type=invite`,
  },
  {
    name: 'token_hash unsupported',
    url: `${ORIGIN}/auth/callback?token_hash=th_value`,
  },
  {
    name: 'empty callback',
    url: `${ORIGIN}/auth/callback`,
  },
];

describe('parseAuthCallbackUrl — bridge purity (un-widened)', () => {
  it.each(CASES)('$name: outcome is identical with and without ?invite=', ({ url }) => {
    const without = parseAuthCallbackUrl(url);
    const withTok = parseAuthCallbackUrl(withInvite(url));
    expect(withTok).toEqual(without);
  });

  it('never echoes the invite token in any parsed field', () => {
    for (const { url } of CASES) {
      const parsed: AuthCallbackParsed = parseAuthCallbackUrl(withInvite(url));
      expect(JSON.stringify(parsed)).not.toContain(TOKEN);
    }
  });

  it('does not introduce an "invite" kind', () => {
    const parsed = parseAuthCallbackUrl(`${ORIGIN}/auth/callback?invite=${TOKEN}`);
    // A bare callback carrying only ?invite= is still `empty` to the auth
    // parser — it consumes no auth material from the query param.
    expect(parsed.kind).toBe('empty');
  });
});
