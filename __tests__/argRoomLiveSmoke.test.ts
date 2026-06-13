/**
 * ARG-ROOM-007 — live-smoke harness safety + completeness guards.
 *
 * The operator smoke harness (scripts/arg-room-live-smoke/*.js) must be:
 *   - complete + well-formed (the frozen 12-check matrix + 3 regression checks),
 *   - dry-run by default; refuse live execution unless armed (env + --live),
 *   - redact secrets (present+length only; no raw token),
 *   - ban-list clean in its report (mirror + parity with the matrix ban-list),
 *   - free of any service-role lane and never set the email / auth-bridge gates.
 * These tests pin every guard against the PURE exported helpers (no network).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { _forbiddenArgumentRoomCreationTokens } from '../src/features/debates/argumentRoomCreationMatrix';

// ── Typed views over the CommonJS harness modules (no runtime effect; lets the
// pure helpers be exercised under strict noImplicitAny without explicit `any`).
interface SmokeCheck {
  id: string;
  title: string;
  accountsNeeded: number;
  needsSixAccounts: boolean;
  gateDependent: boolean;
  regression: boolean;
  expected: Record<string, unknown>;
  verify: string;
  coveredByIfInsufficientAccounts?: string[];
}
interface Disposition {
  id: string;
  disposition: string;
  coveredBy?: string[];
  reason?: string;
}
interface Fingerprint {
  present: boolean;
  length?: number;
}
interface ParsedArgs {
  dryRun: boolean;
  live: boolean;
  fourDeployed: boolean;
}
interface SmokePlan {
  mode: string;
  reason?: string | null;
  accountCount: number;
  checks: string[];
  regressionChecks: string[];
  fourDeployed?: boolean;
}
interface RedactedPlan {
  mode: string;
  credentials: { adminPassword: Fingerprint } & Record<string, unknown>;
  [k: string]: unknown;
}
interface MatrixModule {
  SMOKE_CHECKS: ReadonlyArray<SmokeCheck>;
  VERIFY_MODES: string[];
  findCheck(id: string): SmokeCheck | null;
  expectedForCheck(id: string): Record<string, unknown> | null;
  checksRequiringSixAccounts(): string[];
  gateDependentChecks(): string[];
  coreCheckIds(): string[];
  regressionCheckIds(): string[];
  assertOutcome(
    check: SmokeCheck,
    actual: { status?: number; body?: Record<string, unknown> | null; refused?: boolean; code?: string },
  ): { result: 'PASS' | 'FAIL'; detail: string; unexpected422: boolean };
}
interface PlanModule {
  fingerprint(value: unknown): Fingerprint;
  parseArgs(argv: string[]): ParsedArgs;
  countDistinctAccounts(env: Record<string, string>): number;
  isLiveArmed(env: Record<string, string>): boolean;
  resolveSmokePlan(args: ParsedArgs, env: Record<string, string>): SmokePlan;
  planCheckExecution(checks: ReadonlyArray<SmokeCheck>, ctx: { accountCount: number; fourDeployed: boolean }): Disposition[];
  buildRedactedPlan(plan: SmokePlan, env: Record<string, string>): RedactedPlan;
}
interface ReportModule {
  _forbiddenReportTokens(): string[];
  scanForSecretLeak(captured: unknown, options?: { allowedTokens: string[] }): string[];
  renderReport(results: unknown): string;
}
interface RunnerModule {
  SMOKE_LABEL: string;
  readSmokeEnv(cwd?: string): Record<string, string>;
  resolveAccounts(env: Record<string, string>): Array<{ alias: string; email: string; password: string }>;
  tokenFromInviteLink(link: unknown): string | null;
}

const matrix = require('../scripts/arg-room-live-smoke/smokeMatrix.js') as MatrixModule;
const plan = require('../scripts/arg-room-live-smoke/plan.js') as PlanModule;
const report = require('../scripts/arg-room-live-smoke/report.js') as ReportModule;
const runner = require('../scripts/arg-room-live-smoke/runArgRoomLiveSmoke.js') as RunnerModule;

const SCRIPTS_DIR = join(__dirname, '..', 'scripts/arg-room-live-smoke');
const RUNNER_SRC = readFileSync(join(SCRIPTS_DIR, 'runArgRoomLiveSmoke.js'), 'utf8');
const PLAN_SRC = readFileSync(join(SCRIPTS_DIR, 'plan.js'), 'utf8');
const REPORT_SRC = readFileSync(join(SCRIPTS_DIR, 'report.js'), 'utf8');
const MATRIX_SRC = readFileSync(join(SCRIPTS_DIR, 'smokeMatrix.js'), 'utf8');

const ARMED = { CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE: '1' } as Record<string, string>;
const NOT_ARMED = {} as Record<string, string>;

// ── smokeMatrix — completeness + well-formedness ────────────────

describe('smokeMatrix — the 12-check matrix is complete + well-formed', () => {
  it('defines exactly 12 core checks + 3 regression checks (15 total, frozen)', () => {
    expect(matrix.SMOKE_CHECKS).toHaveLength(15);
    expect(matrix.coreCheckIds()).toHaveLength(12);
    expect(matrix.regressionCheckIds()).toHaveLength(3);
    expect(Object.isFrozen(matrix.SMOKE_CHECKS)).toBe(true);
  });

  it('contains every required check id', () => {
    const ids = matrix.SMOKE_CHECKS.map((c) => c.id);
    for (const expected of [
      'public-no-invite-create',
      'public-one-invite-create',
      'private-one-invite-create',
      'private-no-invite-reject',
      'public-cap-5-refuse-6th',
      'reserved-invite-seat-acceptance',
      'observer-into-full-public',
      'wrong-user-invite-recovery',
      'new-user-invite-callback',
      'existing-user-invite-flow',
      'no-enumeration',
      'no-token-leakage',
      'max-one-direct-invite',
      'self-invite-refused',
      'direct-debates-insert-refused',
    ]) {
      expect(ids).toContain(expected);
    }
  });

  it('every check has a non-empty expected + a valid verify mode', () => {
    for (const c of matrix.SMOKE_CHECKS) {
      expect(c.expected && typeof c.expected === 'object').toBe(true);
      expect(Object.keys(c.expected).length).toBeGreaterThan(0);
      expect(matrix.VERIFY_MODES).toContain(c.verify);
    }
  });

  it('needsSixAccounts is true ONLY for the two public-cap-5 fill checks', () => {
    expect(matrix.checksRequiringSixAccounts().sort()).toEqual(
      ['observer-into-full-public', 'public-cap-5-refuse-6th'],
    );
    for (const c of matrix.SMOKE_CHECKS) {
      if (c.needsSixAccounts) expect(c.accountsNeeded).toBe(6);
    }
  });

  it('coveredByIfInsufficientAccounts is set on the two cap-5 checks (never a misleading PASS)', () => {
    for (const id of matrix.checksRequiringSixAccounts()) {
      const c = matrix.findCheck(id)!;
      expect(Array.isArray(c.coveredByIfInsufficientAccounts)).toBe(true);
      expect((c.coveredByIfInsufficientAccounts || []).length).toBeGreaterThan(0);
    }
  });

  it('gateDependent is true ONLY for the three email-bearing checks', () => {
    expect(matrix.gateDependentChecks().sort()).toEqual(
      ['existing-user-invite-flow', 'new-user-invite-callback', 'no-enumeration'],
    );
  });

  it('expectedForCheck is a pure lookup; null for an unknown id', () => {
    expect(matrix.expectedForCheck('private-no-invite-reject')).toEqual({
      status: 400,
      code: 'private_requires_invite',
    });
    expect(matrix.expectedForCheck('public-cap-5-refuse-6th')).toEqual({
      sqlState: '23514',
      code: 'room_capacity_reached',
    });
    expect(matrix.expectedForCheck('does-not-exist')).toBeNull();
  });

  it('accountsNeeded is always 1, 2, or 6', () => {
    for (const c of matrix.SMOKE_CHECKS) {
      expect([1, 2, 6]).toContain(c.accountsNeeded);
    }
  });
});

// ── smokeMatrix — assertOutcome self-assertion (ARG-ROOM-007A) ──

describe('smokeMatrix — assertOutcome (real PASS/FAIL, no unearned PASS)', () => {
  const find = (id: string) => matrix.findCheck(id)!;

  it('PASS when a status-only check matches (public no-invite → 200)', () => {
    const o = matrix.assertOutcome(find('public-no-invite-create'), { status: 200, body: { debateId: 'x' } });
    expect(o.result).toBe('PASS');
    expect(o.unexpected422).toBe(false);
  });

  it('FAIL + unexpected422 when a 200-expecting create returns 422 (the ARG-ROOM-007A bug)', () => {
    const o = matrix.assertOutcome(find('public-no-invite-create'), {
      status: 422,
      body: { error: 'validation_failed' },
    });
    expect(o.result).toBe('FAIL');
    expect(o.unexpected422).toBe(true);
  });

  it('FAIL when private-no-invite returns 422 instead of 400/private_requires_invite', () => {
    const o = matrix.assertOutcome(find('private-no-invite-reject'), {
      status: 422,
      body: { error: 'validation_failed' },
    });
    expect(o.result).toBe('FAIL');
    expect(o.unexpected422).toBe(true);
  });

  it('PASS when private-no-invite returns the correct 400/private_requires_invite', () => {
    const o = matrix.assertOutcome(find('private-no-invite-reject'), {
      status: 400,
      body: { error: 'private_requires_invite' },
    });
    expect(o.result).toBe('PASS');
  });

  it('FAIL when status matches but the code does not', () => {
    const o = matrix.assertOutcome(find('private-no-invite-reject'), {
      status: 400,
      body: { error: 'some_other_code' },
    });
    expect(o.result).toBe('FAIL');
    expect(o.unexpected422).toBe(false);
  });

  it('one-invite create requires an inviteId — 200 without inviteId is a FAIL', () => {
    expect(matrix.assertOutcome(find('public-one-invite-create'), { status: 200, body: { inviteId: 'abc' } }).result).toBe('PASS');
    expect(matrix.assertOutcome(find('public-one-invite-create'), { status: 200, body: {} }).result).toBe('FAIL');
    expect(matrix.assertOutcome(find('private-one-invite-create'), { status: 200, body: { inviteId: 'abc' } }).result).toBe('PASS');
  });

  it('accept check matches the body.status code (reserved → accepted)', () => {
    const o = matrix.assertOutcome(find('reserved-invite-seat-acceptance'), { status: 200, body: { status: 'accepted' } });
    expect(o.result).toBe('PASS');
    expect(matrix.assertOutcome(find('reserved-invite-seat-acceptance'), { status: 0, body: null }).result).toBe('FAIL');
  });

  it('R1 — an EXPECTED 422 is a PASS and is NOT flagged unexpected422', () => {
    const o = matrix.assertOutcome(find('max-one-direct-invite'), { status: 422, body: { error: 'validation_failed' } });
    expect(o.result).toBe('PASS');
    expect(o.unexpected422).toBe(false);
  });

  it('R3 — door probe PASS only when refused with SQLSTATE 42501', () => {
    expect(matrix.assertOutcome(find('direct-debates-insert-refused'), { refused: true, code: '42501' }).result).toBe('PASS');
    expect(matrix.assertOutcome(find('direct-debates-insert-refused'), { refused: false, code: undefined }).result).toBe('FAIL');
    expect(matrix.assertOutcome(find('direct-debates-insert-refused'), { refused: true, code: '23514' }).result).toBe('FAIL');
  });

  it('wrong-user recovery PASS only on 403/invite_email_mismatch', () => {
    expect(matrix.assertOutcome(find('wrong-user-invite-recovery'), { status: 403, body: { error: 'invite_email_mismatch' } }).result).toBe('PASS');
    expect(matrix.assertOutcome(find('wrong-user-invite-recovery'), { status: 200, body: { status: 'accepted' } }).result).toBe('FAIL');
  });
});

// ── plan — dry-by-default + arm gating ──────────────────────────

describe('plan — dry-by-default, operator-armed', () => {
  it('parseArgs defaults to dry-run (no --live)', () => {
    const a = plan.parseArgs([]);
    expect(a.dryRun).toBe(true);
    expect(a.live).toBe(false);
    expect(a.fourDeployed).toBe(false);
  });

  it('--live flips dryRun off; --four-deployed is opt-in', () => {
    const a = plan.parseArgs(['--live', '--four-deployed']);
    expect(a.live).toBe(true);
    expect(a.dryRun).toBe(false);
    expect(a.fourDeployed).toBe(true);
  });

  it('is dry-run by default (no flags)', () => {
    const p = plan.resolveSmokePlan(plan.parseArgs([]), NOT_ARMED);
    expect(p.mode).toBe('dry_run');
  });

  it('refuses a live run when CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE is not armed', () => {
    const p = plan.resolveSmokePlan(plan.parseArgs(['--live']), NOT_ARMED);
    expect(p.mode).toBe('refused');
    expect(p.reason).toBe('live_not_armed');
  });

  it('allows a live run only when --live AND the env gate are both present', () => {
    const p = plan.resolveSmokePlan(plan.parseArgs(['--live']), ARMED);
    expect(p.mode).toBe('live');
  });

  it('counts distinct provisioned accounts (admin + bots A..E)', () => {
    expect(plan.countDistinctAccounts({})).toBe(0);
    expect(
      plan.countDistinctAccounts({
        CDISCOURSE_ADMIN_EMAIL: 'a@x.com',
        CDISCOURSE_BOT_A_EMAIL: 'b@x.com',
        CDISCOURSE_BOT_B_EMAIL: 'c@x.com',
      }),
    ).toBe(3);
    expect(
      plan.countDistinctAccounts({
        CDISCOURSE_ADMIN_EMAIL: 'a@x.com',
        CDISCOURSE_BOT_A_EMAIL: 'b@x.com',
        CDISCOURSE_BOT_B_EMAIL: 'c@x.com',
        CDISCOURSE_BOT_C_EMAIL: 'd@x.com',
        CDISCOURSE_BOT_D_EMAIL: 'e@x.com',
        CDISCOURSE_BOT_E_EMAIL: 'f@x.com',
      }),
    ).toBe(6);
  });
});

describe('plan — planCheckExecution disposition (review #2/#3)', () => {
  const coreChecks = matrix.SMOKE_CHECKS.filter((c) => !c.regression);

  it('marks #5/#7 accounts_insufficient with covered_by when fewer than 6 accounts', () => {
    const out = plan.planCheckExecution(coreChecks, { accountCount: 4, fourDeployed: true });
    const byId = new Map(out.map((d) => [d.id, d]));
    for (const id of ['public-cap-5-refuse-6th', 'observer-into-full-public']) {
      const d = byId.get(id)!;
      expect(d.disposition).toBe('accounts_insufficient');
      expect((d.coveredBy || []).length).toBeGreaterThan(0);
    }
  });

  it('runs #5/#7 when 6 accounts exist', () => {
    const out = plan.planCheckExecution(coreChecks, { accountCount: 6, fourDeployed: true });
    const d = out.find((x) => x.id === 'public-cap-5-refuse-6th')!;
    expect(d.disposition).toBe('run');
  });

  it('marks email-bearing checks dependency_not_deployed when 004 is not deployed (never a misleading FAIL)', () => {
    const out = plan.planCheckExecution(coreChecks, { accountCount: 6, fourDeployed: false });
    const byId = new Map(out.map((d) => [d.id, d]));
    for (const id of ['new-user-invite-callback', 'existing-user-invite-flow', 'no-enumeration']) {
      const d = byId.get(id)!;
      expect(d.disposition).toBe('dependency_not_deployed');
    }
  });

  it('runs the non-gated, account-sufficient checks', () => {
    const out = plan.planCheckExecution(coreChecks, { accountCount: 6, fourDeployed: true });
    const d = out.find((x) => x.id === 'public-no-invite-create')!;
    expect(d.disposition).toBe('run');
  });
});

// ── plan — secret redaction ─────────────────────────────────────

describe('plan — secret hygiene', () => {
  it('fingerprint exposes ONLY present + length — never the value', () => {
    const secret = 'Zx9Q-vault-Kp7m-secret-tail';
    const fp = plan.fingerprint(secret);
    expect(fp).toEqual({ present: true, length: secret.length });
    const json = JSON.stringify(fp);
    expect(json).not.toContain(secret);
    expect(json).not.toContain(secret.slice(0, 4));
    expect(plan.fingerprint('').present).toBe(false);
    expect(plan.fingerprint(undefined).present).toBe(false);
  });

  it('buildRedactedPlan carries no secret value and no raw token field', () => {
    const pwd = 'Wn4t-the-actual-passw0rd-2026';
    const env = {
      CDISCOURSE_ADMIN_EMAIL: 'cdiscourse-admin@example.com',
      CDISCOURSE_ADMIN_PASSWORD: pwd,
      CDISCOURSE_BOT_A_EMAIL: 'a@x.com',
      CDISCOURSE_BOT_A_PASSWORD: 'botpw-A-secret-value',
      EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
    };
    const p = plan.resolveSmokePlan(plan.parseArgs([]), env);
    const redacted = plan.buildRedactedPlan(p, env);
    const json = JSON.stringify(redacted);
    for (const secret of [pwd, 'botpw-A-secret-value']) {
      expect(json).not.toContain(secret);
      expect(json).not.toContain(secret.slice(0, 6));
    }
    expect(redacted.credentials.adminPassword).toEqual({ present: true, length: pwd.length });
    // No raw-token VALUE field of any kind (the `no-token-leakage` check id is
    // an allowed label; what must never appear is a carried token value/link).
    expect(json).not.toContain('inviteLink');
    expect(json).not.toContain('token_hash');
    expect(json).not.toContain('tokenHash');
  });
});

// ── report — ban-list parity + no verdict copy + no-leak scan ────

describe('report — ban-list mirror + parity (review #1)', () => {
  it('_forbiddenReportTokens MIRRORS _forbiddenArgumentRoomCreationTokens exactly', () => {
    expect(report._forbiddenReportTokens().slice().sort()).toEqual(
      _forbiddenArgumentRoomCreationTokens().slice().sort(),
    );
  });

  it('renderReport emits no banned verdict / person / amplification token', () => {
    const md = report.renderReport({
      headSha: '8929bde',
      harnessCmd: 'node scripts/arg-room-live-smoke/runArgRoomLiveSmoke.js --live',
      gatesArmed: { inviteEmail: false, newUserSend: false },
      accountCount: 6,
      accountsLabel: 'admin + A/B/C/D/E',
      outcome: { passed: 12, total: 12, regressionPassed: 3, regressionTotal: 3 },
      preconditions: [{ gate: 'ARG-ROOM-004 deployed', result: 'confirmed', evidence: 'merge=deploy' }],
      results: [
        { num: 1, title: 'public/no-invite create', accts: 1, expected: '200', actual: '200', result: 'PASS' },
        { num: 5, title: 'public cap-5 sixth seat refused', accts: 6, expected: '23514', actual: '23514', result: 'PASS' },
      ],
      noEnum: 'Keys + status + notification identical; only inviteId / inviteLink differ.',
      noLeak: 'Response scan clean.',
    });
    const lower = md.toLowerCase();
    for (const token of report._forbiddenReportTokens()) {
      expect(lower).not.toContain(token);
    }
  });

  it('renderReport produces the full template even from an empty results object', () => {
    const md = report.renderReport({});
    expect(md).toContain('# ARG-ROOM-007 — live-smoke matrix');
    expect(md).toContain('## Results');
    expect(md).toContain('## Cleanup / disarm');
    const lower = md.toLowerCase();
    for (const token of report._forbiddenReportTokens()) {
      expect(lower).not.toContain(token);
    }
  });
});

describe('report — scanForSecretLeak', () => {
  const RAW = 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0'; // 40-char base64url, not a UUID
  const OTHER = 'Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4J3i2H1g0';

  it('flags a planted raw token-shape value not in the whitelist', () => {
    expect(scanLen({ body: { token: RAW } })).toBeGreaterThan(0);
  });

  it('flags a JWT-shape, a Bearer header, and a sha-256 hash', () => {
    expect(scanLen({ a: 'eyJhbGciOiJI.eyJzdWIiOiIx.SflKxwRJSMeKb' })).toBeGreaterThan(0);
    expect(scanLen({ a: 'Bearer abc.def.ghijk' })).toBeGreaterThan(0);
    expect(scanLen({ a: 'a'.repeat(64) })).toBeGreaterThan(0);
  });

  it("returns clean for a tokenEcho equal to the caller's OWN supplied token", () => {
    expect(report.scanForSecretLeak({ body: { tokenEcho: RAW } }, { allowedTokens: [RAW] })).toEqual([]);
  });

  it('still flags a DIFFERENT invite token even when the whitelist holds another', () => {
    expect(report.scanForSecretLeak({ body: { token: OTHER } }, { allowedTokens: [RAW] }).length).toBeGreaterThan(0);
  });

  it('does not flag UUID debateId / inviteId fields', () => {
    expect(
      report.scanForSecretLeak({
        body: { debateId: '6095fc1d-a754-4d3d-bf31-99bf93b61414', inviteId: 'fc930abd-7ce0-407a-b0d2-317c518312ba' },
      }),
    ).toEqual([]);
  });

  it('does not flag the creator-only create-time inviteLink token (whitelisted)', () => {
    expect(
      report.scanForSecretLeak(
        { body: { inviteLink: `https://abc.supabase.co/auth/callback?invite=${RAW}` } },
        { allowedTokens: [RAW] },
      ),
    ).toEqual([]);
  });

  function scanLen(captured: unknown): number {
    return report.scanForSecretLeak(captured, { allowedTokens: [] }).length;
  }
});

// ── runner — source guards (no service-role / no gate flip / Edge-only create) ──

describe('runner — source guards', () => {
  it('requiring the module exports the pure helpers and performs no network', () => {
    expect(typeof runner.readSmokeEnv).toBe('function');
    expect(typeof runner.resolveAccounts).toBe('function');
    expect(typeof runner.tokenFromInviteLink).toBe('function');
    expect(runner.SMOKE_LABEL).toContain('ARG-ROOM-007');
  });

  it('tokenFromInviteLink extracts the token from BOTH the path and query forms', () => {
    // The deployed create-argument-room / manage-room-invite emit a PATH-style
    // link `<origin>/invite/<token>` — the format the harness actually receives.
    expect(runner.tokenFromInviteLink('https://cdiscourse-smoke.local/invite/ABC123def_token-45')).toBe('ABC123def_token-45');
    expect(runner.tokenFromInviteLink('https://x.app/invite/tok99/')).toBe('tok99');
    // The 004 auth-bridge query form is still supported as a fallback.
    expect(runner.tokenFromInviteLink('https://x.supabase.co/auth/callback?invite=abc123')).toBe('abc123');
    expect(runner.tokenFromInviteLink('not a url')).toBeNull();
    expect(runner.tokenFromInviteLink(null)).toBeNull();
  });

  it('introduces NO service-role lane in any harness source file', () => {
    for (const src of [RUNNER_SRC, PLAN_SRC, REPORT_SRC, MATRIX_SRC]) {
      expect(src).not.toMatch(/SERVICE_ROLE/);
      expect(src).not.toMatch(/service_role/);
    }
  });

  it('the runner constructs no auth header by hand (no Authorization / Bearer literal)', () => {
    expect(RUNNER_SRC).not.toMatch(/Authorization/);
    expect(RUNNER_SRC).not.toMatch(/Bearer/);
  });

  it('the harness NEVER ARMS INVITE_EMAIL_ENABLED or INVITE_AUTH_BRIDGE_ENABLED (read-for-report is allowed)', () => {
    for (const src of [RUNNER_SRC, PLAN_SRC]) {
      // No ASSIGNMENT to either gate. A read (`=== 'true'`) to report the gate's
      // posture in the header is the safe, intent-preserving pattern — the harness
      // must never SET a gate, only observe it (ARG-ROOM-007A: report honesty).
      expect(src).not.toMatch(/INVITE_EMAIL_ENABLED\s*=[^=]/);
      expect(src).not.toMatch(/INVITE_AUTH_BRIDGE_ENABLED\s*=[^=]/);
    }
  });

  it('creates rooms ONLY via the create-argument-room Edge', () => {
    expect(RUNNER_SRC).toContain("'create-argument-room'");
  });

  it('every create-argument-room body carries the required resolution field (ARG-ROOM-007A)', () => {
    // The deployed schema requires title + resolution + visibility (.strict()).
    // Omitting resolution was the 422 bug; pin that every create body includes it.
    const createBodies = RUNNER_SRC.match(/'create-argument-room',\s*\{[\s\S]*?\}\)/g) || [];
    expect(createBodies.length).toBeGreaterThanOrEqual(6);
    for (const body of createBodies) {
      expect(body).toContain('resolution');
    }
    expect(RUNNER_SRC).toContain('SMOKE_RESOLUTION');
  });

  it('self-asserts real PASS/FAIL and exits nonzero on failure (no unearned PASS / no masked 422)', () => {
    expect(RUNNER_SRC).toContain('assertOutcome');
    expect(RUNNER_SRC).toContain('process.exitCode = 1');
    expect(RUNNER_SRC).toMatch(/unexpected422|UNEXPECTED 422/);
    // The old blanket TBD result for create checks is gone.
    expect(RUNNER_SRC).not.toContain("result: 'TBD (operator verifies vs RLS read)'");
  });

  it('uses exactly one direct debates insert, and it is the R3 door-refusal probe', () => {
    const inserts = RUNNER_SRC.match(/\.from\(['"]debates['"]\)[\s\S]{0,40}?\.insert/g) || [];
    expect(inserts).toHaveLength(1);
    expect(RUNNER_SRC).toContain('DOOR_REFUSAL_PROBE');
  });

  it('guards all I/O behind the require.main entry (nothing runs on require)', () => {
    expect(RUNNER_SRC).toContain('require.main === module');
  });
});
