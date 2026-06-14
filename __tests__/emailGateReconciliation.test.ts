/**
 * EMAIL-TRANSPORT-001 — test class 3: gate reconciliation + no-enumeration.
 *
 * - Product lane sends only when CDISCOURSE_EMAIL_TRANSPORT_ENABLED &&
 *   INVITE_EMAIL_ENABLED (both required).
 * - INVITE_AUTH_BRIDGE_ENABLED (Lane A / Auth bridge) is NOT governed by the
 *   product master gate — it stays an independent gate.
 * - resolveInviteNotificationStatus stays branch-independent (single posture),
 *   so existing-vs-new is indistinguishable.
 *
 * room-notifications/index.ts calls Deno.serve at top level (not Jest-loadable),
 * so the gate composition is asserted by source-scan; the master-gate runtime
 * effect is proven against the real orchestrator in emailMasterGate.test.ts.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'room-notifications', 'index.ts'),
  'utf8',
);

function fnBody(name: string): string {
  const start = SRC.indexOf(`function ${name}`);
  expect(start).toBeGreaterThan(-1);
  const braceStart = SRC.indexOf('{', start);
  let depth = 0;
  let i = braceStart;
  for (; i < SRC.length; i += 1) {
    if (SRC[i] === '{') depth += 1;
    else if (SRC[i] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return SRC.slice(start, i + 1);
}

describe('product lane gate composition (master + per-feature)', () => {
  it('isInviteEmailEnabled requires BOTH CDISCOURSE_EMAIL_TRANSPORT_ENABLED and INVITE_EMAIL_ENABLED', () => {
    const body = fnBody('isInviteEmailEnabled');
    expect(body).toContain("Deno.env.get('CDISCOURSE_EMAIL_TRANSPORT_ENABLED')");
    expect(body).toContain("Deno.env.get('INVITE_EMAIL_ENABLED')");
    expect(body).toMatch(/return master && perFeature;/);
  });
});

describe('Auth bridge gate stays independent (Lane A, not subsumed)', () => {
  it('isInviteAuthBridgeEnabled reads ONLY INVITE_AUTH_BRIDGE_ENABLED', () => {
    const body = fnBody('isInviteAuthBridgeEnabled');
    expect(body).toContain("Deno.env.get('INVITE_AUTH_BRIDGE_ENABLED')");
    // The Auth bridge must NOT be gated by the product master switch.
    expect(body).not.toContain('CDISCOURSE_EMAIL_TRANSPORT_ENABLED');
  });
});

describe('no-enumeration: resolveInviteNotificationStatus stays a single posture', () => {
  it('returns queued when EITHER lane is armed, not_configured when both off — branch-independent', () => {
    const body = fnBody('resolveInviteNotificationStatus');
    // The posture is: (Lane B) isInviteEmailEnabled OR (Lane A) isInviteAuthBridgeEnabled.
    expect(body).toMatch(/isInviteEmailEnabled\(\) \|\| isInviteAuthBridgeEnabled\(\)/);
    expect(body).toContain("'queued'");
    expect(body).toContain("'not_configured'");
  });

  it('the invite handler returns a constant delivered:0 + posture status (no existing-vs-new leak)', () => {
    // The single return at the end of handleInvite is branch-independent.
    expect(SRC).toContain('delivered: 0, notification: resolveInviteNotificationStatus()');
  });
});
