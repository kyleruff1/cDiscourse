/**
 * ARG-ROOM-004 (#615) — App.tsx wiring for the `/auth/callback?invite=<token>`
 * → seat bridge handoff. Source-scan (App.tsx is not rendered directly in the
 * suite; same pattern as authCallbackRouting.test.ts).
 *
 * Pins:
 *  - the bridge token is captured via resolveColdStartInviteToken,
 *  - [review #2] capture lives in the COLD-START EFFECT (dispatch/await safe),
 *    NOT the synchronous useState initializer (render-phase),
 *  - the captured token flows build → persist → dispatch (reusing the shipped
 *    pendingInviteIntent path),
 *  - the routing priority is preserved (AuthCallbackScreen runs ABOVE the
 *    InviteRedeemGate, so set-password happens before auto-accept).
 */
import fs from 'fs';
import path from 'path';

const APP = fs.readFileSync(path.join(process.cwd(), 'App.tsx'), 'utf8');

describe('App.tsx — bridge capture wiring', () => {
  it('imports the combined cold-start resolver', () => {
    expect(APP).toContain('resolveColdStartInviteToken');
    // The old direct parseInviteDeepLink import in the invites barrel block is
    // superseded by the combined resolver (which wraps it).
    expect(APP).toMatch(/resolveColdStartInviteToken,\n {2}buildPendingInviteIntent,/);
  });

  it('captures the cold-start token from window.location.href', () => {
    expect(APP).toContain('resolveColdStartInviteToken(window.location.href)');
  });

  it('captures in the cold-start EFFECT, not the synchronous useState initializer', () => {
    const useStateIdx = APP.indexOf('useState<{ active: boolean; url: string }>');
    const initEnd = APP.indexOf('});', useStateIdx);
    const initBlock = APP.slice(useStateIdx, initEnd);
    // The render-phase initializer must NOT do the (async, dispatching) capture.
    expect(initBlock).not.toContain('resolveColdStartInviteToken');

    const effectStart = APP.indexOf('React.useEffect', initEnd);
    const usageIdx = APP.indexOf('resolveColdStartInviteToken(window.location.href)');
    expect(effectStart).toBeGreaterThan(useStateIdx);
    expect(usageIdx).toBeGreaterThan(effectStart);
  });

  it('the captured token flows build → persist → dispatch (reusing the shipped path)', () => {
    const effectStart = APP.indexOf('resolveColdStartInviteToken(window.location.href)');
    const effectEnd = APP.indexOf('}, []);', effectStart);
    const block = APP.slice(effectStart, effectEnd);
    expect(block).toContain('buildPendingInviteIntent(token, nowIso)');
    expect(block).toContain('savePendingInviteIntentToStorage(intent)');
    expect(block).toContain("dispatch({ type: 'SET_PENDING_INVITE_INTENT', intent })");
  });
});

describe('App.tsx — routing priority preserved (set-password before auto-accept)', () => {
  it('AuthCallbackScreen branch runs above the InviteRedeemGate branch', () => {
    const authIdx = APP.indexOf('if (authCallback.active)');
    const pendingIdx = APP.indexOf('} else if (pendingInviteIntent) {');
    expect(authIdx).toBeGreaterThan(-1);
    expect(pendingIdx).toBeGreaterThan(authIdx);
  });

  it('still renders InviteRedeemGate for a live pending intent (auto-accept seam)', () => {
    expect(APP).toContain('<InviteRedeemGate');
    expect(APP).toContain('token={pendingInviteIntent.token}');
  });
});
