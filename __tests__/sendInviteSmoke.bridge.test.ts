/**
 * ARG-ROOM-004 (#615) — dry-plan smoke assertions for the `?invite=<token>`
 * bridge redirect. No sends; pure validation of the operator tool.
 *
 * Review finding #5: the bridge-redirect dry assertion validates against the
 * HOSTED `additional_redirect_urls` allow-list (supabase/config.toml) — not the
 * script's local ALLOWED_REDIRECT_HOSTS, which has drifted (it lists
 * `dev.cdiscourse.com`, absent from config.toml).
 *
 * Imports the CJS operator script via require (mirrors
 * authInviteSmokeScriptGuards.test.ts).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const smoke = require('../scripts/auth/sendInviteSmoke.js');

const CONFIG = readFileSync(join(process.cwd(), 'supabase', 'config.toml'), 'utf8');
const HOSTED_HOSTS: string[] = smoke.deriveHostedRedirectHosts(CONFIG);
const TOKEN = 'A'.repeat(43);

describe('deriveHostedRedirectHosts — parses config.toml additional_redirect_urls', () => {
  it('includes the concrete deployed + localhost hosts', () => {
    expect(HOSTED_HOSTS).toContain('dev-cdiscourse.netlify.app');
    expect(HOSTED_HOSTS).toContain('localhost:8081');
  });

  it('excludes wildcard hosts (cannot match a concrete redirect exactly)', () => {
    for (const h of HOSTED_HOSTS) {
      expect(h).not.toContain('*');
    }
  });

  it('catches the local-list drift: dev.cdiscourse.com is NOT in the hosted list', () => {
    // ALLOWED_REDIRECT_HOSTS lists dev.cdiscourse.com, but config.toml does not.
    expect(smoke.ALLOWED_REDIRECT_HOSTS).toContain('dev.cdiscourse.com');
    expect(HOSTED_HOSTS).not.toContain('dev.cdiscourse.com');
  });
});

describe('validateBridgeRedirect — ?invite= redirect against the hosted allow-list', () => {
  it('accepts an allow-listed /auth/callback?invite=<token> redirect', () => {
    const res = smoke.validateBridgeRedirect(
      `https://dev-cdiscourse.netlify.app/auth/callback?invite=${TOKEN}`,
      HOSTED_HOSTS,
    );
    expect(res.ok).toBe(true);
    expect(res.host).toBe('dev-cdiscourse.netlify.app');
    // Length only — never the token value (no-secret diagnostics).
    expect(res.inviteTokenLength).toBe(TOKEN.length);
    expect(JSON.stringify(res)).not.toContain(TOKEN);
  });

  it('rejects a host that is not in the hosted allow-list (incl. the drifted one)', () => {
    expect(
      smoke.validateBridgeRedirect(`https://evil.example.com/auth/callback?invite=${TOKEN}`, HOSTED_HOSTS).ok,
    ).toBe(false);
    expect(
      smoke.validateBridgeRedirect(`https://dev.cdiscourse.com/auth/callback?invite=${TOKEN}`, HOSTED_HOSTS).reason,
    ).toBe('redirect_host_not_allowlisted');
  });

  it('rejects a non-/auth/callback path', () => {
    expect(
      smoke.validateBridgeRedirect(`https://dev-cdiscourse.netlify.app/invite/${TOKEN}?invite=${TOKEN}`, HOSTED_HOSTS).reason,
    ).toBe('redirect_path_not_callback');
  });

  it('rejects a missing / malformed invite token', () => {
    expect(
      smoke.validateBridgeRedirect('https://dev-cdiscourse.netlify.app/auth/callback', HOSTED_HOSTS).reason,
    ).toBe('invite_token_shape_invalid');
    expect(
      smoke.validateBridgeRedirect('https://dev-cdiscourse.netlify.app/auth/callback?invite=short', HOSTED_HOSTS).reason,
    ).toBe('invite_token_shape_invalid');
  });

  it('rejects non-https (except localhost http)', () => {
    expect(
      smoke.validateBridgeRedirect(`http://dev-cdiscourse.netlify.app/auth/callback?invite=${TOKEN}`, HOSTED_HOSTS).reason,
    ).toBe('redirect_not_https');
    expect(
      smoke.validateBridgeRedirect(`http://localhost:8081/auth/callback?invite=${TOKEN}`, HOSTED_HOSTS).ok,
    ).toBe(true);
  });
});

describe('sendInviteSmoke — no-secret diagnostics + refusal posture (unchanged)', () => {
  it('fingerprint exposes presence + length only — never any value character', () => {
    const fp = smoke.fingerprint('super-secret-value');
    expect(fp).toEqual({ present: true, length: 'super-secret-value'.length });
    expect(JSON.stringify(fp)).not.toContain('super-secret');
  });

  it('refuses a live send when the armed env flag is absent', () => {
    const plan = smoke.resolvePlan(
      { dryRun: false, live: true, email: 'kyleruff+devtest99@gmail.com', range: null, redirectTo: null, smtpPosture: 'custom', allowNonDevtest: false },
      {},
    );
    expect(plan.mode).toBe('refused');
    expect(plan.reason).toBe('live_send_not_armed');
  });

  it('default dry-run plan does no send', () => {
    const plan = smoke.resolvePlan(
      { dryRun: true, live: false, email: 'kyleruff+devtest99@gmail.com', range: null, redirectTo: null, smtpPosture: 'unknown', allowNonDevtest: false },
      {},
    );
    expect(plan.mode).toBe('dry_run');
  });
});
