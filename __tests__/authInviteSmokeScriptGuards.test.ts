/**
 * AUTH-INVITE-BRANDED-SMOKE-2026-06-13 — invite smoke script safety guards.
 *
 * The operator smoke client (scripts/auth/sendInviteSmoke.js) must be dry-run by
 * default, refuse a live send / batch unless explicitly armed, validate targets
 * and redirects, redact secrets, and never introduce a service-role lane. These
 * tests pin every guard against the pure exported helpers (no network).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const smoke = require('../scripts/auth/sendInviteSmoke.js');

const SCRIPT_SRC = readFileSync(join(__dirname, '..', 'scripts/auth/sendInviteSmoke.js'), 'utf8');

const NO_FLAGS = {} as Record<string, string>;
const SEND_ARMED = { CDISCOURSE_ALLOW_INVITE_SEND_SMOKE: '1' };
const SEND_AND_BATCH = { CDISCOURSE_ALLOW_INVITE_SEND_SMOKE: '1', CDISCOURSE_ALLOW_INVITE_BATCH: '1' };
const GOOD_REDIRECT = 'https://dev-cdiscourse.netlify.app/auth/callback';

describe('parseArgs — defaults', () => {
  it('defaults to dry-run with no live flag', () => {
    const a = smoke.parseArgs([]);
    expect(a.dryRun).toBe(true);
    expect(a.live).toBe(false);
  });

  it('--live flips dryRun off', () => {
    const a = smoke.parseArgs(['--live', '--email', 'kyleruff+devtest99@gmail.com']);
    expect(a.live).toBe(true);
    expect(a.dryRun).toBe(false);
    expect(a.email).toBe('kyleruff+devtest99@gmail.com');
  });
});

describe('validateTargetEmail — devtest plus-address gate', () => {
  it('accepts the seed plus-addresses', () => {
    for (const n of [99, 98, 97]) {
      expect(smoke.validateTargetEmail(`kyleruff+devtest${n}@gmail.com`).ok).toBe(true);
      expect(smoke.isSeedEmail(`kyleruff+devtest${n}@gmail.com`)).toBe(true);
    }
  });

  it('refuses a non-devtest target unless --allow-non-devtest', () => {
    expect(smoke.validateTargetEmail('random@example.com').ok).toBe(false);
    expect(smoke.validateTargetEmail('random@example.com').reason).toBe('not_devtest_plus_address');
    expect(smoke.validateTargetEmail('random@example.com', { allowNonDevtest: true }).ok).toBe(true);
  });

  it('refuses a malformed email', () => {
    expect(smoke.validateTargetEmail('nope').ok).toBe(false);
  });
});

describe('expandBatchRange — bounded only', () => {
  it('expands the operator default 98..97 to two devtest addresses (descending)', () => {
    const r = smoke.expandBatchRange('98..97');
    expect(r.ok).toBe(true);
    expect(r.emails).toEqual(['kyleruff+devtest98@gmail.com', 'kyleruff+devtest97@gmail.com']);
  });

  it('refuses an over-cap range', () => {
    const r = smoke.expandBatchRange('1..200');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('range_exceeds_cap');
  });

  it('refuses a malformed range', () => {
    expect(smoke.expandBatchRange('abc').ok).toBe(false);
    expect(smoke.expandBatchRange('').ok).toBe(false);
  });
});

describe('validateRedirectTo — allow-list + /auth/callback', () => {
  it('accepts an allow-listed https callback', () => {
    expect(smoke.validateRedirectTo(GOOD_REDIRECT).ok).toBe(true);
  });

  it('accepts the localhost dev callback', () => {
    expect(smoke.validateRedirectTo('http://localhost:8081/auth/callback').ok).toBe(true);
  });

  it('refuses a non-allow-listed host', () => {
    expect(smoke.validateRedirectTo('https://evil.example.com/auth/callback').reason).toBe('redirect_host_not_allowlisted');
  });

  it('refuses a non-https remote redirect', () => {
    expect(smoke.validateRedirectTo('http://dev-cdiscourse.netlify.app/auth/callback').reason).toBe('redirect_not_https');
  });

  it('refuses a wrong path', () => {
    expect(smoke.validateRedirectTo('https://dev-cdiscourse.netlify.app/somewhere').reason).toBe('redirect_path_not_callback');
  });

  it('refuses a missing redirect', () => {
    expect(smoke.validateRedirectTo('').reason).toBe('redirect_missing');
  });
});

describe('resolvePlan — live-send + batch gating', () => {
  it('is dry-run by default (no flags, no live)', () => {
    const p = smoke.resolvePlan(smoke.parseArgs([]), NO_FLAGS);
    expect(p.mode).toBe('dry_run');
    expect(p.targets).toEqual(['kyleruff+devtest99@gmail.com']);
  });

  it('refuses a live send when CDISCOURSE_ALLOW_INVITE_SEND_SMOKE is not armed', () => {
    const args = smoke.parseArgs(['--live', '--email', 'kyleruff+devtest99@gmail.com', '--redirect-to', GOOD_REDIRECT, '--smtp-posture', 'custom']);
    const p = smoke.resolvePlan(args, NO_FLAGS);
    expect(p.mode).toBe('refused');
    expect(p.reason).toBe('live_send_not_armed');
  });

  it('allows a single live send when armed + valid redirect + smtp posture', () => {
    const args = smoke.parseArgs(['--live', '--email', 'kyleruff+devtest99@gmail.com', '--redirect-to', GOOD_REDIRECT, '--smtp-posture', 'custom']);
    const p = smoke.resolvePlan(args, SEND_ARMED);
    expect(p.mode).toBe('live_single');
    expect(p.targets).toEqual(['kyleruff+devtest99@gmail.com']);
  });

  it('refuses a live send with unknown SMTP posture', () => {
    const args = smoke.parseArgs(['--live', '--email', 'kyleruff+devtest99@gmail.com', '--redirect-to', GOOD_REDIRECT]);
    const p = smoke.resolvePlan(args, SEND_ARMED);
    expect(p.mode).toBe('refused');
    expect(p.reason).toBe('smtp_posture_unknown');
  });

  it('refuses a batch without CDISCOURSE_ALLOW_INVITE_BATCH', () => {
    const args = smoke.parseArgs(['--live', '--range', '98..97', '--redirect-to', GOOD_REDIRECT, '--smtp-posture', 'custom']);
    const p = smoke.resolvePlan(args, SEND_ARMED);
    expect(p.mode).toBe('refused');
    expect(p.reason).toBe('batch_not_armed');
  });

  it('allows a bounded batch when both flags armed', () => {
    const args = smoke.parseArgs(['--live', '--range', '98..97', '--redirect-to', GOOD_REDIRECT, '--smtp-posture', 'custom']);
    const p = smoke.resolvePlan(args, SEND_AND_BATCH);
    expect(p.mode).toBe('live_batch');
    expect(p.targets).toHaveLength(2);
  });

  it('refuses a non-devtest live target without override', () => {
    const args = smoke.parseArgs(['--live', '--email', 'random@example.com', '--redirect-to', GOOD_REDIRECT, '--smtp-posture', 'custom']);
    const p = smoke.resolvePlan(args, SEND_ARMED);
    expect(p.mode).toBe('refused');
    expect(p.reason).toContain('not_devtest_plus_address');
  });
});

describe('secret hygiene', () => {
  it('fingerprint exposes ONLY present + length — never the value or any character of it', () => {
    const secret = 'Zx9Q-vault-Kp7m-secret-tail';
    const fp = smoke.fingerprint(secret);
    expect(fp).toEqual({ present: true, length: secret.length });
    // No char preview at all: neither a prefix nor a suffix nor an `fp` field.
    expect(fp).not.toHaveProperty('fp');
    const json = JSON.stringify(fp);
    expect(json).not.toContain(secret);
    expect(json).not.toContain(secret.slice(0, 4)); // no prefix
    expect(json).not.toContain(secret.slice(-4)); // no suffix
    expect(smoke.fingerprint('').present).toBe(false);
  });

  it('buildRedactedPlan never carries a password or access-token fragment (prefix/suffix/whole)', () => {
    const plan = { mode: 'live_single', targets: ['kyleruff+devtest99@gmail.com'], redirectHost: 'dev-cdiscourse.netlify.app', smtpPosture: 'custom' };
    const pwd = 'Wn4t-the-actual-passw0rd-2026';
    const token = 'sbp_aabbccdd11223344eeff5566';
    const env = {
      CDISCOURSE_ADMIN_PASSWORD: pwd,
      CDISCOURSE_ADMIN_EMAIL: 'cdiscourse-admin-bot@example.com',
      EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
      SUPABASE_ACCESS_TOKEN: token,
    };
    const json = JSON.stringify(smoke.buildRedactedPlan(plan, env));
    for (const secret of [pwd, token]) {
      expect(json).not.toContain(secret);
      expect(json).not.toContain(secret.slice(0, 4)); // no prefix preview
      expect(json).not.toContain(secret.slice(-4)); // no suffix preview
    }
    const redacted = smoke.buildRedactedPlan(plan, env);
    expect(redacted.credentials.adminPassword).toEqual({ present: true, length: pwd.length });
    expect(redacted.credentials.adminEmail.present).toBe(true);
    expect(redacted.credentials.adminEmail).not.toHaveProperty('fp');
  });

  it('the script introduces NO service-role lane (no SERVICE_ROLE / service_role in source)', () => {
    expect(SCRIPT_SRC).not.toMatch(/SERVICE_ROLE/);
    expect(SCRIPT_SRC).not.toMatch(/service_role/);
  });

  it('the script never prints invite links or tokens', () => {
    // It must not reference action_link / TokenHash / a generate-link path.
    expect(SCRIPT_SRC).not.toMatch(/action_link/);
    expect(SCRIPT_SRC).not.toMatch(/generateLink/);
    expect(SCRIPT_SRC).not.toMatch(/TokenHash/);
  });

  it('the live path goes through the audited admin-users invite_user action (no direct admin API)', () => {
    expect(SCRIPT_SRC).toContain("action: 'invite_user'");
    expect(SCRIPT_SRC).toContain("functions.invoke('admin-users'");
    // The script must never CALL inviteUserByEmail directly — that admin-API
    // call lives ONLY inside the Edge function. (A doc-comment may name it.)
    expect(SCRIPT_SRC).not.toMatch(/\.inviteUserByEmail\(/);
  });
});
