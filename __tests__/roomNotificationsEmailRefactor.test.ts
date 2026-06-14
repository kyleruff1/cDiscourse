/**
 * EMAIL-TRANSPORT-001 — test class 11: room-notifications email refactor.
 *
 * Proves the existing-user branch now calls the shared sendTransactionalEmail
 * seam (no inline fetch), the product-lane gate is the composed master +
 * per-feature gate (default OFF → no network), and the branch-independent
 * response shape is unchanged (no existing-vs-new enumeration).
 *
 * room-notifications/index.ts is Deno-only (Deno.serve at top level) so this is
 * a source-scan; the seam's runtime behavior is proven against the real
 * orchestrator in emailMasterGate.test.ts.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'room-notifications', 'index.ts'),
  'utf8',
);

describe('room-notifications email refactor — delegates to the shared module', () => {
  it('imports sendTransactionalEmail + renderArgumentRoomInviteEmail from _shared/email', () => {
    expect(SRC).toMatch(/import \{ sendTransactionalEmail \} from '\.\.\/_shared\/email\/sendTransactionalEmail\.ts'/);
    expect(SRC).toMatch(/import \{ renderArgumentRoomInviteEmail \} from '\.\.\/_shared\/email\/emailTemplates\.ts'/);
  });

  it('the inline Resend fetch + Bearer header are GONE from room-notifications', () => {
    expect(SRC).not.toContain('https://api.resend.com/emails');
    expect(SRC).not.toContain('Bearer ${apiKey}');
    expect(SRC).not.toContain("Deno.env.get('INVITE_EMAIL_FROM')");
  });

  it('maybeSendInviteEmail returns not_configured before any dispatch when the gate is off', () => {
    const idx = SRC.indexOf('async function maybeSendInviteEmail');
    const block = SRC.slice(idx, idx + 1400);
    const gateIdx = block.indexOf('if (!isInviteEmailEnabled()) return \'not_configured\';');
    const dispatchIdx = block.indexOf('sendTransactionalEmail(');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(dispatchIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(dispatchIdx);
  });
});

describe('room-notifications email refactor — gate composition (documented behavior change)', () => {
  it('the product lane requires BOTH the master + per-feature gate', () => {
    const idx = SRC.indexOf('function isInviteEmailEnabled');
    const block = SRC.slice(idx, idx + 500);
    expect(block).toContain("CDISCOURSE_EMAIL_TRANSPORT_ENABLED");
    expect(block).toContain("INVITE_EMAIL_ENABLED");
    expect(block).toMatch(/return master && perFeature;/);
  });

  it('the Auth bridge gate (Lane A) is NOT subsumed by the product master gate', () => {
    const idx = SRC.indexOf('function isInviteAuthBridgeEnabled');
    const block = SRC.slice(idx, idx + 400);
    expect(block).toContain('INVITE_AUTH_BRIDGE_ENABLED');
    expect(block).not.toContain('CDISCOURSE_EMAIL_TRANSPORT_ENABLED');
  });
});

describe('room-notifications email refactor — no-enumeration preserved', () => {
  it('the invite handler return is branch-independent (constant delivered + posture status)', () => {
    expect(SRC).toContain('delivered: 0, notification: resolveInviteNotificationStatus()');
    // Only ONE such return literal — both existing + new branches converge here.
    const occurrences = (SRC.match(/delivered: 0, notification: resolveInviteNotificationStatus\(\)/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('resolveInviteNotificationStatus is posture-based across both lanes', () => {
    const idx = SRC.indexOf('function resolveInviteNotificationStatus');
    const block = SRC.slice(idx, idx + 400);
    expect(block).toMatch(/isInviteEmailEnabled\(\) \|\| isInviteAuthBridgeEnabled\(\)/);
  });

  it('the response shape never includes a recipient or email field', () => {
    const okMatches = SRC.match(/ok<RoomNotificationResponse>\(\{[^}]*\}\)/g) || [];
    expect(okMatches.length).toBeGreaterThan(0);
    for (const call of okMatches) {
      expect(call.toLowerCase()).not.toMatch(/recipient/);
      expect(call.toLowerCase()).not.toMatch(/email:/);
    }
  });
});
