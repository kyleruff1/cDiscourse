/**
 * AUTH-CALLBACK-CONSUMER-001 — pure parser tests.
 *
 * Full branch coverage of parseAuthCallbackUrl / isAuthCallbackPath /
 * redactAuthCallbackUrl / describeAuthCallbackForDiagnostics. No mocks — the
 * module is pure (only `new URL`). Synthetic, non-secret tokens throughout;
 * the redaction tests prove no real token substring survives a diagnostic.
 */
import {
  parseAuthCallbackUrl,
  redactAuthCallbackUrl,
  describeAuthCallbackForDiagnostics,
  isAuthCallbackPath,
  type AuthCallbackParsed,
} from '../src/lib/auth/parseAuthCallbackUrl';

const ORIGIN = 'https://dev.cdiscourse.com';
const PATH = `${ORIGIN}/auth/callback`;

// Synthetic, obviously-fake values — never a real token.
const ACCESS = 'fake.aaa.bbb';
const REFRESH = 'fake-refresh-zzz';
const CODE = 'fake-code-xyz';
const HASH = 'fake-token-hash-123';

describe('isAuthCallbackPath', () => {
  it('matches the bare callback path', () => {
    expect(isAuthCallbackPath('/auth/callback')).toBe(true);
  });
  it('tolerates exactly one trailing slash', () => {
    expect(isAuthCallbackPath('/auth/callback/')).toBe(true);
  });
  it('does NOT match a near-miss path', () => {
    expect(isAuthCallbackPath('/auth/callbacks')).toBe(false);
    expect(isAuthCallbackPath('/auth/callback/extra')).toBe(false);
  });
  it('does NOT match the QOL-038 invite deep-link path', () => {
    expect(isAuthCallbackPath('/invite/abc')).toBe(false);
  });
  it('returns false for a non-string', () => {
    expect(isAuthCallbackPath(undefined as unknown as string)).toBe(false);
  });
});

describe('parseAuthCallbackUrl — tokens (implicit flow, fragment)', () => {
  it('parses an invite fragment token into kind=tokens with type=invite', () => {
    const parsed = parseAuthCallbackUrl(
      `${PATH}#access_token=${ACCESS}&refresh_token=${REFRESH}&expires_in=3600&token_type=bearer&type=invite`,
    );
    expect(parsed).toEqual({
      kind: 'tokens',
      accessToken: ACCESS,
      refreshToken: REFRESH,
      type: 'invite',
      expiresIn: 3600,
    });
  });

  it('parses a signup fragment token with type=signup', () => {
    const parsed = parseAuthCallbackUrl(
      `${PATH}#access_token=${ACCESS}&refresh_token=${REFRESH}&type=signup`,
    );
    expect(parsed.kind).toBe('tokens');
    if (parsed.kind === 'tokens') {
      expect(parsed.type).toBe('signup');
      expect(parsed.expiresIn).toBeNull();
    }
  });

  it('parses a fragment token with NO type (type=null)', () => {
    const parsed = parseAuthCallbackUrl(`${PATH}#access_token=${ACCESS}&refresh_token=${REFRESH}`);
    expect(parsed.kind).toBe('tokens');
    if (parsed.kind === 'tokens') expect(parsed.type).toBeNull();
  });

  it('does NOT treat a fragment with only access_token as tokens', () => {
    const parsed = parseAuthCallbackUrl(`${PATH}#access_token=${ACCESS}&type=invite`);
    expect(parsed.kind).not.toBe('tokens');
  });

  it('treats an empty access_token value as absent', () => {
    const parsed = parseAuthCallbackUrl(`${PATH}#access_token=&refresh_token=${REFRESH}`);
    expect(parsed.kind).not.toBe('tokens');
  });

  it('coerces a non-numeric expires_in to null', () => {
    const parsed = parseAuthCallbackUrl(
      `${PATH}#access_token=${ACCESS}&refresh_token=${REFRESH}&expires_in=soon`,
    );
    expect(parsed.kind).toBe('tokens');
    if (parsed.kind === 'tokens') expect(parsed.expiresIn).toBeNull();
  });
});

describe('parseAuthCallbackUrl — code (PKCE, query)', () => {
  it('parses a query code into kind=code with the type', () => {
    const parsed = parseAuthCallbackUrl(`${PATH}?code=${CODE}&type=invite`);
    expect(parsed).toEqual({ kind: 'code', code: CODE, type: 'invite' });
  });

  it('parses a query code with no type (type=null)', () => {
    const parsed = parseAuthCallbackUrl(`${PATH}?code=${CODE}`);
    expect(parsed).toEqual({ kind: 'code', code: CODE, type: null });
  });
});

describe('parseAuthCallbackUrl — error', () => {
  it('parses an error in the QUERY', () => {
    const parsed = parseAuthCallbackUrl(
      `${PATH}?error=server_error&error_description=Something+went+wrong`,
    );
    expect(parsed.kind).toBe('error');
    if (parsed.kind === 'error') {
      expect(parsed.error).toBe('server_error');
      expect(parsed.description).toBe('Something went wrong');
      expect(parsed.recoverable).toBe(false);
    }
  });

  it('parses an error in the FRAGMENT (implicit-flow denial)', () => {
    const parsed = parseAuthCallbackUrl(
      `${PATH}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`,
    );
    expect(parsed.kind).toBe('error');
    if (parsed.kind === 'error') {
      expect(parsed.error).toBe('access_denied');
      expect(parsed.errorCode).toBe('otp_expired');
    }
  });

  it('marks otp_expired as recoverable', () => {
    const parsed = parseAuthCallbackUrl(`${PATH}#error=access_denied&error_code=otp_expired`);
    expect(parsed.kind === 'error' && parsed.recoverable).toBe(true);
  });

  it('marks access_denied as recoverable even without an error_code', () => {
    const parsed = parseAuthCallbackUrl(`${PATH}#error=access_denied`);
    expect(parsed.kind === 'error' && parsed.recoverable).toBe(true);
  });

  it('marks a non-expiry error as NOT recoverable', () => {
    const parsed = parseAuthCallbackUrl(`${PATH}?error=server_error&error_code=unexpected_failure`);
    expect(parsed.kind === 'error' && parsed.recoverable).toBe(false);
  });

  it('treats error_description alone (no error name) as an error', () => {
    const parsed = parseAuthCallbackUrl(`${PATH}#error_description=Link+has+expired`);
    expect(parsed.kind).toBe('error');
    if (parsed.kind === 'error') expect(parsed.errorCode).toBeNull();
  });
});

describe('parseAuthCallbackUrl — unsupported / empty', () => {
  it('flags a token_hash link as unsupported(token_hash)', () => {
    const parsed = parseAuthCallbackUrl(`${PATH}?token_hash=${HASH}&type=invite`);
    expect(parsed).toEqual({ kind: 'unsupported', reason: 'token_hash' });
  });

  it('flags a non-URL string as unsupported(unparseable)', () => {
    expect(parseAuthCallbackUrl('not-a-valid-url')).toEqual({
      kind: 'unsupported',
      reason: 'unparseable',
    });
  });

  it('returns empty for a bare /auth/callback with no params', () => {
    expect(parseAuthCallbackUrl(PATH)).toEqual({ kind: 'empty' });
  });

  it('returns empty for an empty string', () => {
    expect(parseAuthCallbackUrl('')).toEqual({ kind: 'empty' });
  });
});

describe('parseAuthCallbackUrl — precedence', () => {
  it('error outranks leftover tokens (error > tokens)', () => {
    const parsed = parseAuthCallbackUrl(
      `${PATH}#error=access_denied&error_code=otp_expired&access_token=${ACCESS}&refresh_token=${REFRESH}`,
    );
    expect(parsed.kind).toBe('error');
  });

  it('error outranks a code (error > code)', () => {
    const parsed = parseAuthCallbackUrl(`${PATH}?error=access_denied&code=${CODE}`);
    expect(parsed.kind).toBe('error');
  });

  it('fragment tokens outrank a query code (tokens > code)', () => {
    const parsed = parseAuthCallbackUrl(
      `${PATH}?code=${CODE}#access_token=${ACCESS}&refresh_token=${REFRESH}&type=invite`,
    );
    expect(parsed.kind).toBe('tokens');
  });
});

describe('redactAuthCallbackUrl', () => {
  it('replaces access_token and refresh_token values with ***', () => {
    const redacted = redactAuthCallbackUrl(
      `${PATH}#access_token=${ACCESS}&refresh_token=${REFRESH}&type=invite`,
    );
    expect(redacted).toContain('access_token=***');
    expect(redacted).toContain('refresh_token=***');
    expect(redacted).not.toContain(ACCESS);
    expect(redacted).not.toContain(REFRESH);
    // Non-secret params survive.
    expect(redacted).toContain('type=invite');
  });

  it('redacts a query code but NOT the non-secret error_code', () => {
    const redacted = redactAuthCallbackUrl(`${PATH}?code=${CODE}&error_code=otp_expired`);
    expect(redacted).toContain('code=***');
    expect(redacted).not.toContain(CODE);
    expect(redacted).toContain('error_code=otp_expired');
  });

  it('redacts a token_hash value', () => {
    const redacted = redactAuthCallbackUrl(`${PATH}?token_hash=${HASH}`);
    expect(redacted).toContain('token_hash=***');
    expect(redacted).not.toContain(HASH);
  });

  it('returns an empty string for a non-string input (never throws)', () => {
    expect(redactAuthCallbackUrl(undefined as unknown as string)).toBe('');
  });
});

describe('describeAuthCallbackForDiagnostics', () => {
  it('summarises a tokens parse with NO token value in the output', () => {
    const parsed = parseAuthCallbackUrl(
      `${PATH}#access_token=${ACCESS}&refresh_token=${REFRESH}&type=invite`,
    );
    const desc = describeAuthCallbackForDiagnostics(parsed);
    expect(desc).toEqual({
      kind: 'tokens',
      type: 'invite',
      hasCode: false,
      hasTokens: true,
      errorCode: null,
      reason: null,
    });
    const serialized = JSON.stringify(desc);
    expect(serialized).not.toContain(ACCESS);
    expect(serialized).not.toContain(REFRESH);
  });

  it('summarises a code parse', () => {
    const desc = describeAuthCallbackForDiagnostics(parseAuthCallbackUrl(`${PATH}?code=${CODE}`));
    expect(desc.hasCode).toBe(true);
    expect(JSON.stringify(desc)).not.toContain(CODE);
  });

  it('summarises an error parse with the non-secret error code', () => {
    const desc = describeAuthCallbackForDiagnostics(
      parseAuthCallbackUrl(`${PATH}#error=access_denied&error_code=otp_expired`),
    );
    expect(desc.kind).toBe('error');
    expect(desc.errorCode).toBe('otp_expired');
  });

  it('summarises an unsupported parse with the reason', () => {
    const desc = describeAuthCallbackForDiagnostics(
      parseAuthCallbackUrl(`${PATH}?token_hash=${HASH}`),
    );
    expect(desc).toMatchObject({ kind: 'unsupported', reason: 'token_hash' });
    expect(JSON.stringify(desc)).not.toContain(HASH);
  });
});

describe('parseAuthCallbackUrl — never throws on garbage', () => {
  const garbage: unknown[] = [
    '',
    '   ',
    '#',
    '?',
    'http://',
    '%%%',
    '::::',
    'javascript:alert(1)',
    'a'.repeat(5000),
    null,
    undefined,
    42,
    {},
  ];
  it.each(garbage.map((g) => [String(typeof g) + ':' + String(g).slice(0, 12), g]))(
    'tolerates %s without throwing',
    (_label, value) => {
      let parsed: AuthCallbackParsed | null = null;
      expect(() => {
        parsed = parseAuthCallbackUrl(value as string);
      }).not.toThrow();
      expect(parsed).not.toBeNull();
    },
  );
});
