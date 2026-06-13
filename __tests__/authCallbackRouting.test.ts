/**
 * AUTH-CALLBACK-CONSUMER-001 — routing + regression + doctrine guard.
 *
 * Pins the invite redirect target, the App.tsx capture wiring (synchronous,
 * window-guarded, detectSessionInUrl untouched), the no-secret rule across the
 * four new files, and that the existing sign-in / sign-up / reset wrappers are
 * behaviourally unchanged (only the two new exports were appended).
 */
import fs from 'fs';
import path from 'path';
import { buildAuthRedirectUrl } from '../src/lib/auth/buildAuthRedirectUrl';
import { isAuthCallbackPath } from '../src/lib/auth/parseAuthCallbackUrl';

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('invite redirect still targets /auth/callback (pin)', () => {
  it('buildAuthRedirectUrl({kind:invite}) ends with /auth/callback', () => {
    expect(
      buildAuthRedirectUrl({
        kind: 'invite',
        runtimeOrigin: 'https://dev.cdiscourse.com',
        isDev: false,
      }),
    ).toBe('https://dev.cdiscourse.com/auth/callback');
  });

  it('confirm_signup / magic_link / email_change also target /auth/callback', () => {
    for (const kind of ['confirm_signup', 'magic_link', 'email_change'] as const) {
      expect(
        buildAuthRedirectUrl({ kind, runtimeOrigin: 'https://dev.cdiscourse.com', isDev: false }),
      ).toBe('https://dev.cdiscourse.com/auth/callback');
    }
  });
});

describe('isAuthCallbackPath truth table', () => {
  it.each([
    ['/auth/callback', true],
    ['/auth/callback/', true],
    ['/auth/callbacks', false],
    ['/auth/callback/extra', false],
    ['/invite/abc', false],
    ['/', false],
    ['', false],
  ])('%s → %s', (input, expected) => {
    expect(isAuthCallbackPath(input as string)).toBe(expected);
  });
});

describe('App.tsx — capture wiring', () => {
  const app = read('App.tsx');

  it('imports isAuthCallbackPath and AuthCallbackScreen', () => {
    expect(app).toContain('isAuthCallbackPath');
    expect(app).toContain('AuthCallbackScreen');
  });

  it('captures the callback SYNCHRONOUSLY in a useState initializer', () => {
    // A function initializer runs at first render, before any effect.
    expect(app).toMatch(/useState<\{\s*active:\s*boolean;\s*url:\s*string\s*\}>\(\(\)\s*=>/);
  });

  it('guards the capture with typeof window', () => {
    expect(app).toMatch(/typeof window === 'undefined'/);
    expect(app).toContain('isAuthCallbackPath(pathname)');
  });

  it('routes the callback branch as the highest priority in the content switch', () => {
    // The authCallback branch must appear before the unconfigured / invite /
    // signed_out / shell branches.
    const branchIdx = app.indexOf('if (authCallback.active)');
    const unconfiguredIdx = app.indexOf("state.status === 'unconfigured'");
    const signedOutIdx = app.indexOf("state.status === 'signed_out'");
    expect(branchIdx).toBeGreaterThan(0);
    expect(branchIdx).toBeLessThan(unconfiguredIdx);
    expect(branchIdx).toBeLessThan(signedOutIdx);
  });

  it('flips the flag off via onDone', () => {
    expect(app).toMatch(/onDone=\{\(\) => setAuthCallback\(\{ active: false, url: '' \}\)\}/);
  });
});

describe('supabase.ts — detectSessionInUrl stays false', () => {
  const supa = read('src/lib/supabase.ts');
  it('still sets detectSessionInUrl: false', () => {
    expect(supa).toContain('detectSessionInUrl: false');
  });
  it('does NOT flip detectSessionInUrl to true', () => {
    expect(supa).not.toContain('detectSessionInUrl: true');
  });
});

describe('no service-role / Anthropic secret in any new client file', () => {
  const NEW_FILES = [
    'src/lib/auth/parseAuthCallbackUrl.ts',
    'src/features/auth/consumeAuthCallback.ts',
    'src/features/auth/authCallbackCopy.ts',
    'src/features/auth/AuthCallbackScreen.tsx',
  ];
  it.each(NEW_FILES)('%s contains no SERVICE_ROLE / ANTHROPIC_API_KEY', (rel) => {
    const src = read(rel);
    expect(src).not.toContain('SERVICE_ROLE');
    expect(src).not.toContain('service_role');
    expect(src).not.toContain('ANTHROPIC_API_KEY');
  });
});

describe('authApi.ts — existing wrappers unchanged, two exports appended', () => {
  const api = read('src/features/auth/authApi.ts');

  it('keeps the existing sign-in / sign-up / reset / signOut wrappers', () => {
    expect(api).toContain('export async function signInWithEmailPassword(');
    expect(api).toContain('export async function signUpWithEmailPassword(');
    expect(api).toContain('export async function sendPasswordResetEmail(');
    expect(api).toContain('export async function signOut(');
    expect(api).toContain('export function validateAuthInput(');
  });

  it('does not alter the sign-in / sign-up call shape', () => {
    expect(api).toContain('supabase.auth.signInWithPassword({ email, password })');
    expect(api).toContain('supabase.auth.signUp({');
  });

  it('appends the two new exports', () => {
    expect(api).toContain('export function validateNewPassword(');
    expect(api).toContain('export async function setInvitedUserPassword(');
  });

  it('set-password wraps updateUser, not a direct insert', () => {
    expect(api).toContain('supabase.auth.updateUser({ password })');
  });
});
