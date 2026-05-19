/**
 * QOL-023 — doctrine / safety scan for the auth-redirect helper modules.
 *
 * Verifies: no secret literals, no console.* calls, no offending-origin leak
 * in error messages, no banned verdict tokens, plain-language copy is clean,
 * the pure helper imports nothing from React / Supabase / a network library,
 * and the helper is side-effect-free and deterministic.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// authApi.ts transitively loads src/lib/supabase.ts, which imports the native
// AsyncStorage module. Mock it so the doctrine scan can import the plain-
// language copy constant without a native-module error.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  buildAuthRedirectUrl,
  InvalidAuthRedirectOrigin,
} from '../src/lib/auth/buildAuthRedirectUrl';
import { REDIRECT_INVALID_MESSAGE } from '../src/features/auth/authApi';

const HELPER_PATH = resolve(__dirname, '..', 'src', 'lib', 'auth', 'buildAuthRedirectUrl.ts');
const RESOLVER_PATH = resolve(__dirname, '..', 'src', 'lib', 'auth', 'resolveRuntimeOrigin.ts');

const helperSrc = readFileSync(HELPER_PATH, 'utf8');
const resolverSrc = readFileSync(RESOLVER_PATH, 'utf8');

// Assembled to avoid the test file itself triggering a self-scan.
const SECRET_LITERALS = [
  'SERVICE' + '_ROLE',
  'ANTHROPIC' + '_API_KEY',
  'XAI' + '_API_KEY',
  'RESEND' + '_API_KEY',
];

describe('buildAuthRedirectUrl.doctrine — no secrets in source', () => {
  it('the helper modules contain no secret-key literals', () => {
    for (const literal of SECRET_LITERALS) {
      expect(helperSrc).not.toContain(literal);
      expect(resolverSrc).not.toContain(literal);
    }
  });

  it('the helper modules contain no console.* calls', () => {
    for (const fn of ['console.log', 'console.error', 'console.warn']) {
      expect(helperSrc).not.toContain(fn);
      expect(resolverSrc).not.toContain(fn);
    }
  });
});

describe('buildAuthRedirectUrl.doctrine — error message hygiene', () => {
  it('does not embed the offending origin string in the thrown message', () => {
    let thrown: InvalidAuthRedirectOrigin | undefined;
    try {
      buildAuthRedirectUrl({
        kind: 'confirm_signup',
        runtimeOrigin: 'file:///etc/passwd',
        isDev: true,
      });
    } catch (e) {
      thrown = e as InvalidAuthRedirectOrigin;
    }
    expect(thrown).toBeInstanceOf(InvalidAuthRedirectOrigin);
    expect(thrown!.message).not.toContain('/etc/passwd');
    expect(thrown!.message).not.toContain('file:');
    // The message carries only the reason enum.
    expect(thrown!.message).toContain('forbidden_scheme');
  });

  it('every reason value yields a message that carries only the reason enum', () => {
    const cases: { origin: string; isDev: boolean; reason: string }[] = [
      { origin: 'file:///x', isDev: true, reason: 'forbidden_scheme' },
      { origin: 'http://evil.example', isDev: false, reason: 'insecure_scheme' },
      { origin: 'https://', isDev: false, reason: 'no_host' },
    ];
    for (const c of cases) {
      let thrown: InvalidAuthRedirectOrigin | undefined;
      try {
        buildAuthRedirectUrl({ kind: 'confirm_signup', runtimeOrigin: c.origin, isDev: c.isDev });
      } catch (e) {
        thrown = e as InvalidAuthRedirectOrigin;
      }
      expect(thrown!.reason).toBe(c.reason);
      expect(thrown!.message).toContain(c.reason);
      // The raw origin must never appear in the message.
      expect(thrown!.message).not.toContain(c.origin);
    }
  });

  it('thrown error message and reason carry no banned verdict tokens', () => {
    const BANNED = ['winner', 'loser', 'liar', 'true', 'false', 'correct', 'dishonest'];
    let thrown: InvalidAuthRedirectOrigin | undefined;
    try {
      buildAuthRedirectUrl({ kind: 'confirm_signup', runtimeOrigin: 'https://', isDev: false });
    } catch (e) {
      thrown = e as InvalidAuthRedirectOrigin;
    }
    for (const token of BANNED) {
      expect(thrown!.message.toLowerCase()).not.toContain(token);
      expect(thrown!.reason.toLowerCase()).not.toContain(token);
    }
  });
});

describe('buildAuthRedirectUrl.doctrine — plain-language copy', () => {
  it('the redirect_invalid copy has no snake_case and no internal code', () => {
    expect(REDIRECT_INVALID_MESSAGE.length).toBeGreaterThan(0);
    expect(REDIRECT_INVALID_MESSAGE).not.toMatch(/_/);
    expect(REDIRECT_INVALID_MESSAGE).not.toContain('invalid_auth_redirect_origin');
    expect(REDIRECT_INVALID_MESSAGE).not.toContain('reason');
  });
});

describe('buildAuthRedirectUrl.doctrine — purity guarantee', () => {
  it('the helper imports nothing from React / Supabase / a network library', () => {
    const importLines = helperSrc
      .split('\n')
      .filter((line) => line.trimStart().startsWith('import '));
    for (const line of importLines) {
      expect(line).not.toContain('@supabase/supabase-js');
      expect(line).not.toContain("'react'");
      expect(line).not.toContain("'react-native'");
      expect(line).not.toContain('axios');
      expect(line).not.toContain('node-fetch');
    }
    // The helper is fully self-contained — it has no import statements at all.
    expect(importLines.length).toBe(0);
  });

  it('does not mutate a frozen input object', () => {
    const input = Object.freeze({
      kind: 'confirm_signup' as const,
      runtimeOrigin: 'https://dev.cdiscourse.com',
      isDev: false,
    });
    expect(() => buildAuthRedirectUrl(input)).not.toThrow();
    expect(input.kind).toBe('confirm_signup');
    expect(input.runtimeOrigin).toBe('https://dev.cdiscourse.com');
    expect(input.isDev).toBe(false);
  });

  it('is deterministic — same input yields the same output across calls', () => {
    const input = {
      kind: 'password_reset' as const,
      runtimeOrigin: 'https://dev.cdiscourse.com',
      isDev: false,
    };
    const first = buildAuthRedirectUrl(input);
    const second = buildAuthRedirectUrl(input);
    const third = buildAuthRedirectUrl(input);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });
});
