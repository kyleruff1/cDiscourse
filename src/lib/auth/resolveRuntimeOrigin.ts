// QOL-023 — The impure boundary for auth-redirect URL construction.
//
// This module reads the environment (`window`, the HOST-001b runtime-env
// global, `process.env`, `__DEV__`) so that buildAuthRedirectUrl.ts can stay
// 100% pure. Callers do:
//
//   buildAuthRedirectUrl({
//     kind,
//     runtimeOrigin: resolveRuntimeOrigin(),
//     isDev: getIsDev(),
//   });
//
// Doctrine: the resolved origin is a PUBLIC URL, never a secret. No `.env*`
// file is read at runtime — values arrive via runtime-env injection (web) or
// babel-injected EXPO_PUBLIC_* (native + local dev), exactly like the existing
// public Supabase URL/key.

import { readRuntimeEnv } from '../supabase';

/**
 * Resolve the host origin for auth-redirect URL construction.
 *
 * Precedence:
 *   1. Web with a real location — `window.location.origin`. For the deployed
 *      SPA served from https://dev.cdiscourse.com this IS the correct origin,
 *      and it makes local `npm run web` "just work" (the browser's own
 *      dev-server origin). The string literal 'null' (a sandboxed-iframe
 *      origin) is skipped.
 *   2. Web Cloud Run shim — the HOST-001b __CDISCOURSE_RUNTIME_ENV__ global's
 *      EXPO_PUBLIC_APP_ORIGIN slot.
 *   3. Native + local dev — process.env.EXPO_PUBLIC_APP_ORIGIN (babel-injected).
 *   4. Otherwise null — buildAuthRedirectUrl's fallback rules take over.
 */
export function resolveRuntimeOrigin(): string | null {
  // 1. Web with a real browser location. typeof guard keeps this safe on
  //    React Native (no `window` global) and in Node tests.
  if (typeof window !== 'undefined') {
    const origin = window.location?.origin;
    if (typeof origin === 'string') {
      const trimmed = origin.trim();
      // 'null' is the literal a sandboxed iframe yields — not a real origin.
      if (trimmed.length > 0 && trimmed !== 'null') return trimmed;
    }
  }

  // 2. Web Cloud Run runtime-env shim.
  const injected = readRuntimeEnv().EXPO_PUBLIC_APP_ORIGIN;
  if (typeof injected === 'string' && injected.trim().length > 0) {
    return injected.trim();
  }

  // 3. Native + local dev — babel-injected EXPO_PUBLIC_*.
  const fromEnv = process.env.EXPO_PUBLIC_APP_ORIGIN;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  // 4. No origin available — let buildAuthRedirectUrl fall back.
  return null;
}

/**
 * True when this is a local development build.
 *
 * Fail-closed: when `__DEV__` is undefined (some Jest configs), return `false`
 * — treat an unknown build as production so the https-only rule is never
 * relaxed by accident.
 */
export function getIsDev(): boolean {
  return typeof __DEV__ !== 'undefined' ? __DEV__ : false;
}
