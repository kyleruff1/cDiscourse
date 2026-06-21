/**
 * AUTH-GOOGLE-SSO-005 (#748) — pure resume-decision tests for the
 * invite-through-Google round trip.
 *
 * The invite intent is persisted to a dedicated AsyncStorage key (=
 * localStorage on web) at the invite-link cold start, LONG before any
 * Google button is clickable. A Google sign-in is a full-page browser
 * redirect to Google and back to `<origin>/auth/callback?code=...`; every
 * piece of React state is destroyed, so ONLY the persisted intent survives.
 * On the return the deterministic `handleAuthCallbackDone` re-read (in
 * App.tsx) loads that intent and dispatches it so the InviteRedeemGate
 * resumes.
 *
 * These tests prove the persistence-survives-the-redirect property and the
 * pure resume DECISION (no React, no live OAuth, no network):
 *   - 748-T1: a fresh intent survives a simulated redirect (re-read), stale
 *     / malformed intents are dropped on read, a normal sign-in (no invite)
 *     captures nothing;
 *   - the `decideInviteResume` pure helper: signed-in + fresh intent →
 *     resume (auto-accept eligible); stale / none → no resume; signed-out
 *     or no-email → resume but NOT auto-accept-eligible;
 *   - 748-T3 precondition: a synthetic bare `?code=` (no `type`) callback
 *     parses → consumes (mock client) to `{ status: 'success' }` (NOT
 *     `needs_password`), which is what establishes the session the gate
 *     resumes off.
 *
 * Mirrors `pendingInviteIntent.test.ts` (AsyncStorage mock) and
 * `authCallbackSmokeReadiness.test.ts` (synthetic-URL parse → consume).
 * No live OAuth / provider call (cdiscourse-doctrine §7).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  decideInviteResume,
  loadPendingInviteIntentFromStorage,
  savePendingInviteIntentToStorage,
  type PendingInviteIntent,
} from '../src/features/invites/pendingInviteIntent';
import { parseAuthCallbackUrl } from '../src/lib/auth/parseAuthCallbackUrl';
import { consumeAuthCallback } from '../src/features/auth/consumeAuthCallback';
import type { AuthCallbackClient } from '../src/features/auth/consumeAuthCallback';

const GOOD_TOKEN = 'aB12345678901234567890123456789012345678901';

// ── 748-T1 — the persisted intent survives the redirect (re-read) ──

describe('AUTH-GOOGLE-SSO-005 — invite intent survives a (mocked) Google redirect', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('a fresh intent captured before the redirect is re-read after the return', async () => {
    // Captured at the invite-link cold start, before the Google button is
    // clickable. AsyncStorage is localStorage on web → survives the full-page
    // redirect to Google and back to /auth/callback?code=...
    const nowIso = new Date().toISOString();
    const fresh: PendingInviteIntent = { token: GOOD_TOKEN, capturedAt: nowIso };
    await savePendingInviteIntentToStorage(fresh);

    // Simulate the deterministic callback-done re-read (handleAuthCallbackDone
    // calls exactly loadPendingInviteIntentFromStorage(now)).
    const reRead = await loadPendingInviteIntentFromStorage(nowIso);
    expect(reRead).toEqual(fresh);
  });

  it('a stale intent (>24h) is ignored AND effectively cleared on read', async () => {
    const stale: PendingInviteIntent = {
      token: GOOD_TOKEN,
      capturedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    };
    await savePendingInviteIntentToStorage(stale);
    const reRead = await loadPendingInviteIntentFromStorage(new Date().toISOString());
    expect(reRead).toBeNull();
  });

  it('a malformed / corrupt persisted intent is ignored (no throw, no gate)', async () => {
    await AsyncStorage.setItem('cdiscourse:pending-invite-intent', '{{not valid json}}');
    const reRead = await loadPendingInviteIntentFromStorage(new Date().toISOString());
    expect(reRead).toBeNull();
  });

  it('a normal sign-in (no invite) captures nothing → the re-read returns null', async () => {
    // Storage is empty: a plain Google "Sign In" with no invite never wrote
    // an intent at cold start. The callback-done re-read finds nothing.
    const reRead = await loadPendingInviteIntentFromStorage(new Date().toISOString());
    expect(reRead).toBeNull();
  });

  it('the persisted blob is token-free of provider/access/refresh tokens (only the invite token + capturedAt)', async () => {
    const nowIso = new Date().toISOString();
    await savePendingInviteIntentToStorage({ token: GOOD_TOKEN, capturedAt: nowIso });
    const raw = await AsyncStorage.getItem('cdiscourse:pending-invite-intent');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string) as Record<string, unknown>;
    // Exactly two keys — the invite token + the capture time. No OAuth secret.
    expect(Object.keys(parsed).sort()).toEqual(['capturedAt', 'token']);
    expect(raw).not.toContain('access_token');
    expect(raw).not.toContain('refresh_token');
    expect(raw).not.toContain('provider_token');
    expect(raw).not.toContain('id_token');
  });
});

// ── decideInviteResume — the pure resume DECISION ──────────────

describe('AUTH-GOOGLE-SSO-005 — decideInviteResume (pure mirror of the gate-mount decision)', () => {
  const FRESH: PendingInviteIntent = { token: GOOD_TOKEN, capturedAt: '2026-06-20T12:00:00.000Z' };

  it('no live intent → no resume (no gate)', () => {
    expect(decideInviteResume({ intent: null, signedIn: true, viewerEmail: 'me@example.com' })).toEqual({
      resume: false,
    });
    // Even when not signed in, a null intent means no gate.
    expect(decideInviteResume({ intent: null, signedIn: false, viewerEmail: null })).toEqual({
      resume: false,
    });
  });

  it('signed-in + fresh intent + viewer email → resume, auto-accept eligible', () => {
    expect(
      decideInviteResume({ intent: FRESH, signedIn: true, viewerEmail: 'me@example.com' }),
    ).toEqual({ resume: true, token: GOOD_TOKEN, autoAcceptEligible: true });
  });

  it('signed-out + fresh intent → resume (gate mounts) but NOT auto-accept eligible', () => {
    // The session is unavailable (e.g. the exchange failed) → the gate mounts
    // in its signed-out branch (lookup → SignedOutPrompt), not auto-accept.
    expect(
      decideInviteResume({ intent: FRESH, signedIn: false, viewerEmail: null }),
    ).toEqual({ resume: true, token: GOOD_TOKEN, autoAcceptEligible: false });
  });

  it('signed-in but no viewer email yet → resume but NOT auto-accept eligible', () => {
    // The gate awaits the viewer email before firing the optimistic accept.
    expect(
      decideInviteResume({ intent: FRESH, signedIn: true, viewerEmail: null }),
    ).toEqual({ resume: true, token: GOOD_TOKEN, autoAcceptEligible: false });
  });

  it('never returns the bound/invited email (no enumeration) — the decision carries only the token', () => {
    const decision = decideInviteResume({
      intent: FRESH,
      signedIn: true,
      viewerEmail: 'viewer@example.com',
    });
    // The decision exposes the token (a capability the holder already has) and
    // the eligibility flag — never any email address.
    expect(JSON.stringify(decision)).not.toContain('@');
  });
});

// ── 748-T3 precondition — the synthetic ?code= callback consumes to success ──

const FAKE_CODE = 'fake-oauth-code-xyz';

function makeMockClient(): jest.Mocked<AuthCallbackClient> {
  return {
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    setSession: jest.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    exchangeCodeForSession: jest.fn().mockResolvedValue({ data: { session: {} }, error: null }),
  } as jest.Mocked<AuthCallbackClient>;
}

describe('AUTH-GOOGLE-SSO-005 — synthetic Google ?code= callback parses → consumes to success', () => {
  // The exact shape a Google OAuth return lands as: a bare `?code=` query with
  // NO `type` param (NOT the implicit-flow `#access_token=` invite shape).
  const SYNTHETIC_OAUTH_CALLBACK_URL = `https://dev.cdiscourse.com/auth/callback?code=${FAKE_CODE}`;

  it('parses the synthetic OAuth URL to code(type=null)', () => {
    const parsed = parseAuthCallbackUrl(SYNTHETIC_OAUTH_CALLBACK_URL);
    expect(parsed).toEqual({ kind: 'code', code: FAKE_CODE, type: null });
  });

  it('parse → consume(mock) → success (NOT needs_password — that is invite-email-only)', async () => {
    const client = makeMockClient();
    const parsed = parseAuthCallbackUrl(SYNTHETIC_OAUTH_CALLBACK_URL);
    const outcome = await consumeAuthCallback({ client, parsed });
    expect(outcome).toEqual({ status: 'success' });
  });

  it('the mock client.exchangeCodeForSession received the code; setSession was not called', async () => {
    const client = makeMockClient();
    const parsed = parseAuthCallbackUrl(SYNTHETIC_OAUTH_CALLBACK_URL);
    await consumeAuthCallback({ client, parsed });
    expect(client.exchangeCodeForSession).toHaveBeenCalledWith(FAKE_CODE);
    expect(client.setSession).not.toHaveBeenCalled();
  });
});
