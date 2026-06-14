/**
 * EMAIL-TRANSPORT-001 — smoke-script Lane-B dry-posture guards.
 *
 * The sendInviteSmoke.js script gained a pure, no-network description of the
 * product-email (Lane B) transport gate posture so the operator sees the inert
 * default before arming any hosted change. These tests pin:
 *   - the master gate OFF (default) predicts skipped_gate_off,
 *   - master ON but key/FROM missing predicts not_configured,
 *   - master ON + key + FROM predicts ready,
 *   - the redacted posture exposes presence-only fingerprints (never a value),
 *   - the script adds NO new send capability and reads no secret value.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// The smoke script is a CommonJS .js operator tool; require it (the same
// pattern authInviteSmokeScriptGuards.test.ts uses).
const smoke = require('../scripts/auth/sendInviteSmoke.js');
const SCRIPT_SRC = readFileSync(join(__dirname, '..', 'scripts/auth/sendInviteSmoke.js'), 'utf8');

describe('predictProductEmailStatus — gate ladder mirrors the orchestrator', () => {
  it('master gate OFF (default) → skipped_gate_off', () => {
    expect(smoke.predictProductEmailStatus({})).toBe('skipped_gate_off');
    expect(smoke.predictProductEmailStatus({ CDISCOURSE_EMAIL_TRANSPORT_ENABLED: 'false' })).toBe('skipped_gate_off');
    expect(smoke.predictProductEmailStatus({ CDISCOURSE_EMAIL_TRANSPORT_ENABLED: '0' })).toBe('skipped_gate_off');
  });

  it('master ON but RESEND_API_KEY or CDISCOURSE_EMAIL_FROM missing → not_configured', () => {
    expect(smoke.predictProductEmailStatus({ CDISCOURSE_EMAIL_TRANSPORT_ENABLED: 'true' })).toBe('not_configured');
    expect(
      smoke.predictProductEmailStatus({ CDISCOURSE_EMAIL_TRANSPORT_ENABLED: 'true', RESEND_API_KEY: 'k' }),
    ).toBe('not_configured');
    expect(
      smoke.predictProductEmailStatus({ CDISCOURSE_EMAIL_TRANSPORT_ENABLED: 'true', CDISCOURSE_EMAIL_FROM: 'CDiscourse <x@y.z>' }),
    ).toBe('not_configured');
  });

  it('master ON + key + FROM → ready', () => {
    expect(
      smoke.predictProductEmailStatus({
        CDISCOURSE_EMAIL_TRANSPORT_ENABLED: 'true',
        RESEND_API_KEY: 'k',
        CDISCOURSE_EMAIL_FROM: 'CDiscourse <x@y.z>',
      }),
    ).toBe('ready');
  });
});

describe('describeProductEmailPosture — presence-only, no secret value', () => {
  it('exposes the gate flags + presence fingerprints + predicted status', () => {
    const env = {
      CDISCOURSE_EMAIL_TRANSPORT_ENABLED: 'true',
      INVITE_EMAIL_ENABLED: 'true',
      CDISCOURSE_ALLOW_EMAIL_TRANSPORT_SMOKE: '1',
      RESEND_API_KEY: 're_some_actual_secret_value_2026',
      CDISCOURSE_EMAIL_FROM: 'CDiscourse <invites@mail.cdiscourse.com>',
      CDISCOURSE_EMAIL_REPLY_TO: 'support@cdiscourse.com',
    };
    const posture = smoke.describeProductEmailPosture(env);
    expect(posture.masterGateEnabled).toBe(true);
    expect(posture.inviteEmailEnabled).toBe(true);
    expect(posture.smokeArmed).toBe(true);
    expect(posture.predictedStatus).toBe('ready');
    // Presence + length only — never the value or any fragment.
    expect(posture.resendKey).toEqual({ present: true, length: env.RESEND_API_KEY.length });
    const json = JSON.stringify(posture);
    expect(json).not.toContain(env.RESEND_API_KEY);
    expect(json).not.toContain(env.RESEND_API_KEY.slice(0, 4));
    expect(json).not.toContain(env.RESEND_API_KEY.slice(-4));
  });

  it('the dry default posture is fully inert (no flags armed)', () => {
    const posture = smoke.describeProductEmailPosture({});
    expect(posture.masterGateEnabled).toBe(false);
    expect(posture.inviteEmailEnabled).toBe(false);
    expect(posture.smokeArmed).toBe(false);
    expect(posture.batchArmed).toBe(false);
    expect(posture.predictedStatus).toBe('skipped_gate_off');
    expect(posture.resendKey.present).toBe(false);
  });
});

describe('buildRedactedPlan — carries the product-email posture, no secret', () => {
  it('the dry plan includes the inert product-email posture', () => {
    const plan = { mode: 'dry_run', targets: ['kyleruff+devtest99@gmail.com'] };
    const redacted = smoke.buildRedactedPlan(plan, {});
    expect(redacted.productEmail).toBeDefined();
    expect(redacted.productEmail.predictedStatus).toBe('skipped_gate_off');
  });

  it('never echoes a RESEND_API_KEY value in the redacted plan', () => {
    const plan = { mode: 'dry_run', targets: ['kyleruff+devtest99@gmail.com'] };
    const secret = 're_DO_NOT_LEAK_THIS_2026_value';
    const json = JSON.stringify(smoke.buildRedactedPlan(plan, { RESEND_API_KEY: secret }));
    expect(json).not.toContain(secret);
    expect(json).not.toContain(secret.slice(0, 4));
    expect(json).not.toContain(secret.slice(-4));
  });
});

describe('smoke script — no new send capability, no secret read', () => {
  it('the Lane-B helpers open no network (no fetch / no resend host)', () => {
    // The product-email posture is a PURE prediction from env — never a send.
    const posStart = SCRIPT_SRC.indexOf('function predictProductEmailStatus');
    const posEnd = SCRIPT_SRC.indexOf('module.exports');
    const block = SCRIPT_SRC.slice(posStart, posEnd);
    expect(block).not.toMatch(/fetch\(/);
    expect(block).not.toMatch(/api\.resend\.com/);
    expect(block).not.toMatch(/inviteUserByEmail/);
  });

  it('the script still introduces NO service-role lane', () => {
    expect(SCRIPT_SRC).not.toMatch(/SERVICE_ROLE/);
    expect(SCRIPT_SRC).not.toMatch(/service_role/);
  });
});
