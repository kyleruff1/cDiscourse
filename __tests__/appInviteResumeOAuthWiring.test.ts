/**
 * AUTH-GOOGLE-SSO-005 (#748) — App.tsx wiring for the deterministic
 * invite-intent re-read on the auth-callback-done transition. Source-scan
 * (App.tsx is not rendered directly in the suite; same pattern as
 * appInviteBridgeHandoff.test.ts / authCallbackRouting.test.ts).
 *
 * Pins:
 *  - App.tsx passes a NAMED callback (handleAuthCallbackDone), not the bare
 *    inline `() => setAuthCallback(...)`, to <AuthCallbackScreen onDone={…}>;
 *  - handleAuthCallbackDone flips the callback flag, re-reads the persisted
 *    intent, and dispatches it (SET_PENDING_INVITE_INTENT);
 *  - the cold-start branch-2 re-read is RETAINED (regression guard — the new
 *    wiring must not delete the old fallback);
 *  - the routing priority is preserved (AuthCallbackScreen runs ABOVE the
 *    InviteRedeemGate);
 *  - the new region logs no token (no console.*) and stores no OAuth token.
 */
import fs from 'fs';
import path from 'path';

const APP = fs.readFileSync(path.join(process.cwd(), 'App.tsx'), 'utf8');

describe('App.tsx — deterministic invite-intent re-read wiring (callback-done)', () => {
  it('passes a NAMED handleAuthCallbackDone callback to <AuthCallbackScreen onDone={…}> (not the bare inline setAuthCallback)', () => {
    expect(APP).toContain('const handleAuthCallbackDone = React.useCallback(');
    expect(APP).toContain('onDone={handleAuthCallbackDone}');
    // The old inline literal must be gone from the AuthCallbackScreen prop.
    expect(APP).not.toContain("onDone={() => setAuthCallback({ active: false, url: '' })}");
  });

  it('handleAuthCallbackDone flips the flag, re-reads the persisted intent, and dispatches it', () => {
    const start = APP.indexOf('const handleAuthCallbackDone = React.useCallback(');
    expect(start).toBeGreaterThan(-1);
    // Bound the callback body at its useCallback dependency-array close.
    const end = APP.indexOf('}, [dispatch]);', start);
    expect(end).toBeGreaterThan(start);
    const body = APP.slice(start, end);
    expect(body).toContain("setAuthCallback({ active: false, url: '' })");
    expect(body).toContain('loadPendingInviteIntentFromStorage');
    expect(body).toContain("dispatch({ type: 'SET_PENDING_INVITE_INTENT', intent: persisted })");
  });

  it('the new callback region logs no token (no console.*) and persists no OAuth token', () => {
    const start = APP.indexOf('const handleAuthCallbackDone = React.useCallback(');
    const end = APP.indexOf('}, [dispatch]);', start);
    const body = APP.slice(start, end);
    expect(body).not.toMatch(/console\./);
    // The re-read only READS the intent + dispatches; it writes no access /
    // refresh / provider token to storage.
    expect(body).not.toContain('access_token');
    expect(body).not.toContain('refresh_token');
    expect(body).not.toContain('provider_token');
    expect(body).not.toContain('setItem');
  });
});

describe('App.tsx — cold-start branch-2 re-read retained (regression guard)', () => {
  it('still re-reads a persisted intent in the empty-deps cold-start effect (do not delete the fallback)', () => {
    // The cold-start one-shot still calls loadPendingInviteIntentFromStorage
    // for the plain "app killed mid-signup, reopened directly" case.
    const effectStart = APP.indexOf('resolveColdStartInviteToken(window.location.href)');
    expect(effectStart).toBeGreaterThan(-1);
    const effectEnd = APP.indexOf('}, []);', effectStart);
    expect(effectEnd).toBeGreaterThan(effectStart);
    const block = APP.slice(effectStart, effectEnd);
    expect(block).toContain('loadPendingInviteIntentFromStorage(nowIso)');
    expect(block).toContain("dispatch({ type: 'SET_PENDING_INVITE_INTENT', intent: persisted })");
  });

  it('App.tsx contains loadPendingInviteIntentFromStorage at least twice (cold-start + callback-done)', () => {
    const matches = APP.match(/loadPendingInviteIntentFromStorage/g) ?? [];
    // import + cold-start call + callback-done call → at least 3 occurrences.
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});

describe('App.tsx — routing priority preserved (callback above the invite gate)', () => {
  it('AuthCallbackScreen branch runs above the InviteRedeemGate branch', () => {
    const authIdx = APP.indexOf('if (authCallback.active)');
    const pendingIdx = APP.indexOf('} else if (pendingInviteIntent) {');
    expect(authIdx).toBeGreaterThan(-1);
    expect(pendingIdx).toBeGreaterThan(authIdx);
  });

  it('still renders InviteRedeemGate for a live pending intent (the resume seam)', () => {
    expect(APP).toContain('<InviteRedeemGate');
    expect(APP).toContain('token={pendingInviteIntent.token}');
  });
});

describe('App.tsx — no provider secret / service-role in the auth-resume wiring', () => {
  it('App.tsx contains no SERVICE_ROLE / service_role / ANTHROPIC_API_KEY literal', () => {
    expect(APP).not.toContain('SERVICE_ROLE');
    expect(APP).not.toContain('service_role');
    expect(APP).not.toContain('ANTHROPIC_API_KEY');
  });

  it('App.tsx introduces no Google OAuth client-secret literal', () => {
    expect(APP).not.toContain('GOCSPX');
    expect(APP).not.toContain('GOOGLE_OAUTH_CLIENT_SECRET');
  });
});
