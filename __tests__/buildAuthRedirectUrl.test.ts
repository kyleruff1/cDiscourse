/**
 * QOL-023 — pure unit suite for buildAuthRedirectUrl.
 *
 * The helper is 100% pure: no React, no Supabase, no fetch, no env mocking.
 * Imports the model directly.
 */
import {
  buildAuthRedirectUrl,
  InvalidAuthRedirectOrigin,
  DEFAULT_AUTH_ROUTES,
  DEV_FALLBACK_ORIGIN,
  HOSTED_FALLBACK_ORIGIN,
} from '../src/lib/auth/buildAuthRedirectUrl';

describe('buildAuthRedirectUrl — route defaulting by kind', () => {
  it('confirm_signup + hosted origin + isDev:false → /auth/callback', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'confirm_signup',
        runtimeOrigin: 'https://dev.cdiscourse.com',
        isDev: false,
      }),
    ).toBe('https://dev.cdiscourse.com/auth/callback');
  });

  it('magic_link defaults to /auth/callback', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'magic_link',
        runtimeOrigin: 'https://dev.cdiscourse.com',
        isDev: false,
      }),
    ).toBe('https://dev.cdiscourse.com/auth/callback');
  });

  it('invite defaults to /auth/callback', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'invite',
        runtimeOrigin: 'https://dev.cdiscourse.com',
        isDev: false,
      }),
    ).toBe('https://dev.cdiscourse.com/auth/callback');
  });

  it('email_change defaults to /auth/callback', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'email_change',
        runtimeOrigin: 'https://dev.cdiscourse.com',
        isDev: false,
      }),
    ).toBe('https://dev.cdiscourse.com/auth/callback');
  });

  it('password_reset defaults to /auth/reset', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'password_reset',
        runtimeOrigin: 'https://dev.cdiscourse.com',
        isDev: false,
      }),
    ).toBe('https://dev.cdiscourse.com/auth/reset');
  });

  it('DEFAULT_AUTH_ROUTES maps every kind', () => {
    expect(DEFAULT_AUTH_ROUTES.confirm_signup).toBe('/auth/callback');
    expect(DEFAULT_AUTH_ROUTES.magic_link).toBe('/auth/callback');
    expect(DEFAULT_AUTH_ROUTES.invite).toBe('/auth/callback');
    expect(DEFAULT_AUTH_ROUTES.email_change).toBe('/auth/callback');
    expect(DEFAULT_AUTH_ROUTES.password_reset).toBe('/auth/reset');
  });
});

describe('buildAuthRedirectUrl — origin fallback rules', () => {
  it('runtimeOrigin null + isDev:true → localhost dev path', () => {
    expect(
      buildAuthRedirectUrl({ kind: 'magic_link', runtimeOrigin: null, isDev: true }),
    ).toBe('http://localhost:8081/auth/callback');
  });

  it('runtimeOrigin null + isDev:false → hosted fallback, NOT localhost', () => {
    const result = buildAuthRedirectUrl({
      kind: 'magic_link',
      runtimeOrigin: null,
      isDev: false,
    });
    expect(result).toBe('https://dev.cdiscourse.com/auth/callback');
    expect(result).not.toContain('localhost');
  });

  it('empty-string runtimeOrigin is treated as null', () => {
    expect(
      buildAuthRedirectUrl({ kind: 'confirm_signup', runtimeOrigin: '', isDev: false }),
    ).toBe('https://dev.cdiscourse.com/auth/callback');
  });

  it('whitespace-only runtimeOrigin is treated as null', () => {
    expect(
      buildAuthRedirectUrl({ kind: 'confirm_signup', runtimeOrigin: '   ', isDev: true }),
    ).toBe('http://localhost:8081/auth/callback');
  });

  it('the fallback constants have the expected values', () => {
    expect(DEV_FALLBACK_ORIGIN).toBe('http://localhost:8081');
    expect(HOSTED_FALLBACK_ORIGIN).toBe('https://dev.cdiscourse.com');
  });
});

describe('buildAuthRedirectUrl — normalization', () => {
  it('strips a single trailing slash and does not double-slash', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'confirm_signup',
        runtimeOrigin: 'https://dev.cdiscourse.com/',
        isDev: false,
      }),
    ).toBe('https://dev.cdiscourse.com/auth/callback');
  });

  it('strips multiple trailing slashes', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'confirm_signup',
        runtimeOrigin: 'https://dev.cdiscourse.com///',
        isDev: false,
      }),
    ).toBe('https://dev.cdiscourse.com/auth/callback');
  });

  it('lowercases the host (scheme + host only)', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'invite',
        runtimeOrigin: 'https://DEV.CDiscourse.COM',
        isDev: false,
      }),
    ).toBe('https://dev.cdiscourse.com/auth/callback');
  });

  it('preserves a port', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'magic_link',
        runtimeOrigin: 'http://localhost:8081',
        isDev: true,
      }),
    ).toBe('http://localhost:8081/auth/callback');
  });

  it('discards a path segment present on the origin', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'confirm_signup',
        runtimeOrigin: 'https://dev.cdiscourse.com/app',
        isDev: false,
      }),
    ).toBe('https://dev.cdiscourse.com/auth/callback');
  });

  it('trims surrounding whitespace on the origin', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'confirm_signup',
        runtimeOrigin: '  https://dev.cdiscourse.com  ',
        isDev: false,
      }),
    ).toBe('https://dev.cdiscourse.com/auth/callback');
  });
});

describe('buildAuthRedirectUrl — explicit route override', () => {
  it('an explicit route overrides the per-kind default', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'password_reset',
        runtimeOrigin: 'https://dev.cdiscourse.com',
        isDev: false,
        route: '/custom',
      }),
    ).toBe('https://dev.cdiscourse.com/custom');
  });

  it('prepends a leading slash to a route that lacks one', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'email_change',
        runtimeOrigin: 'https://dev.cdiscourse.com',
        isDev: false,
        route: 'custom/path',
      }),
    ).toBe('https://dev.cdiscourse.com/custom/path');
  });

  it('treats an empty-string route as omitted (falls back to kind default)', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'password_reset',
        runtimeOrigin: 'https://dev.cdiscourse.com',
        isDev: false,
        route: '',
      }),
    ).toBe('https://dev.cdiscourse.com/auth/reset');
  });

  it('treats a whitespace-only route as omitted', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'confirm_signup',
        runtimeOrigin: 'https://dev.cdiscourse.com',
        isDev: false,
        route: '   ',
      }),
    ).toBe('https://dev.cdiscourse.com/auth/callback');
  });

  it('uses a route with a query string verbatim after slash-normalization', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'confirm_signup',
        runtimeOrigin: 'https://dev.cdiscourse.com',
        isDev: false,
        route: '/auth/callback?foo=bar',
      }),
    ).toBe('https://dev.cdiscourse.com/auth/callback?foo=bar');
  });
});

describe('buildAuthRedirectUrl — validation failures', () => {
  it('throws forbidden_scheme for file: even in a dev build', () => {
    let thrown: unknown;
    try {
      buildAuthRedirectUrl({
        kind: 'confirm_signup',
        runtimeOrigin: 'file:///etc/passwd',
        isDev: true,
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(InvalidAuthRedirectOrigin);
    expect((thrown as InvalidAuthRedirectOrigin).reason).toBe('forbidden_scheme');
  });

  it('throws forbidden_scheme for javascript:, data:, vbscript:, blob:', () => {
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,x',
      'vbscript:msgbox',
      'blob:https://x/abc',
    ]) {
      let reason: string | undefined;
      try {
        buildAuthRedirectUrl({ kind: 'confirm_signup', runtimeOrigin: bad, isDev: true });
      } catch (e) {
        reason = (e as InvalidAuthRedirectOrigin).reason;
      }
      expect(reason).toBe('forbidden_scheme');
    }
  });

  it('throws insecure_scheme for http:// in a non-dev build', () => {
    let thrown: unknown;
    try {
      buildAuthRedirectUrl({
        kind: 'confirm_signup',
        runtimeOrigin: 'http://evil.example',
        isDev: false,
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(InvalidAuthRedirectOrigin);
    expect((thrown as InvalidAuthRedirectOrigin).reason).toBe('insecure_scheme');
  });

  it('allows http:// in a dev build (the localhost path)', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'confirm_signup',
        runtimeOrigin: 'http://localhost:8081',
        isDev: true,
      }),
    ).toBe('http://localhost:8081/auth/callback');
  });

  it('throws no_host for an origin with no parseable host', () => {
    for (const bad of ['https://', 'https:///']) {
      let reason: string | undefined;
      try {
        buildAuthRedirectUrl({ kind: 'confirm_signup', runtimeOrigin: bad, isDev: false });
      } catch (e) {
        reason = (e as InvalidAuthRedirectOrigin).reason;
      }
      expect(reason).toBe('no_host');
    }
  });

  it('accepts a custom https host (the domain is not pinned)', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'confirm_signup',
        runtimeOrigin: 'https://preview.example.com',
        isDev: false,
      }),
    ).toBe('https://preview.example.com/auth/callback');
  });
});
