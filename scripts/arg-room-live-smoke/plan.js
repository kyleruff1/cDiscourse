/**
 * ARG-ROOM-007 — live-smoke plan resolution + redaction (pure).
 *
 * DRY-BY-DEFAULT, OPERATOR-ARMED (mirrors scripts/auth/sendInviteSmoke.js)
 *   The harness is dry-run unless the operator EXPLICITLY arms it with BOTH:
 *     1. CLI flag `--live`, and
 *     2. env `CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE=1`.
 *   Absent either → `refused` (live) or `dry_run` (no --live). This module is
 *   PURE: env is passed in, never read here; no network; no clock.
 *
 * WHAT THIS NEVER DOES
 *   - Never sets / flips the invite-email transport gate or the new-user
 *     auth-bridge gate (those are OPERATOR-armed deploy-function gates; the
 *     invite-email gate is read-only here for the report header only).
 *   - Never reads or carries a service-role key.
 *   - Never emits a secret VALUE — only `{ present, length }` fingerprints.
 */

'use strict';

const {
  SMOKE_CHECKS,
  coreCheckIds,
  regressionCheckIds,
} = require('./smokeMatrix.js');

/**
 * Presence + length ONLY — never the value, and never any character of it.
 * (Mirrors sendInviteSmoke.fingerprint — the no-secret diagnostics posture.)
 */
function fingerprint(value) {
  if (value === undefined || value === null || value === '') {
    return { present: false };
  }
  return { present: true, length: String(value).length };
}

/** Parse argv (after `node script.js`). Pure. Dry-run is the default. */
function parseArgs(argv) {
  const out = { dryRun: true, live: false, fourDeployed: false };
  const list = Array.isArray(argv) ? argv : [];
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i];
    if (a === '--live') {
      out.live = true;
      out.dryRun = false;
    } else if (a === '--dry-run') {
      out.dryRun = true;
      out.live = false;
    } else if (a === '--four-deployed') {
      // Operator asserts ARG-ROOM-004 is deployed (enables the email-bearing
      // checks #9/#10/#11). The runner additionally PROBES which Edge emits the
      // create-time invite email and records it in the report Preconditions.
      out.fourDeployed = true;
    }
  }
  return out;
}

/**
 * Count distinct provisioned JWT accounts from env. Pure.
 * admin + bots A..E with a non-empty email. The cap-5 fill checks (#5/#7) need
 * this to be >= 6; the runner branches each check on the REAL resolved count
 * (review finding #2 — `loadEnv.js` guarantees only admin + A + B; C/D/E optional).
 */
function countDistinctAccounts(env) {
  const e = env || {};
  let n = 0;
  if (e.CDISCOURSE_ADMIN_EMAIL) n += 1;
  for (const alias of ['A', 'B', 'C', 'D', 'E']) {
    if (e[`CDISCOURSE_BOT_${alias}_EMAIL`]) n += 1;
  }
  return n;
}

/** True iff the operator armed the live gate via env. Pure. */
function isLiveArmed(env) {
  return (env || {}).CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE === '1';
}

/**
 * Decide the run mode from parsed args + env flags. Pure.
 * mode: 'dry_run' | 'live' | 'refused'.
 */
function resolveSmokePlan(args, env) {
  const a = args || {};
  const accountCount = countDistinctAccounts(env);
  const base = {
    checks: coreCheckIds(),
    regressionChecks: regressionCheckIds(),
    accountCount,
  };

  if (a.dryRun || !a.live) {
    return { mode: 'dry_run', ...base };
  }
  if (!isLiveArmed(env)) {
    // --live passed but the env gate is not armed → refuse (never self-arm).
    return { mode: 'refused', reason: 'live_not_armed', ...base };
  }
  return { mode: 'live', fourDeployed: !!a.fourDeployed, ...base };
}

/**
 * Map each check to a runtime disposition given the resolved context. Pure.
 *   - 'accounts_insufficient' for #5/#7 when fewer than 6 accounts exist
 *     (carries `coveredBy` so the report records test-coverage, never a false PASS).
 *   - 'dependency_not_deployed' for #9/#10/#11 when ARG-ROOM-004 is not deployed
 *     (a first-class SKIP, never a false FAIL — review finding #3).
 *   - 'run' otherwise.
 */
function planCheckExecution(checks, context) {
  const list = Array.isArray(checks) ? checks : [];
  const ctx = context || {};
  const accountCount = typeof ctx.accountCount === 'number' ? ctx.accountCount : 0;
  const fourDeployed = !!ctx.fourDeployed;
  return list.map((check) => {
    if (check.needsSixAccounts && accountCount < 6) {
      return {
        id: check.id,
        disposition: 'accounts_insufficient',
        coveredBy: check.coveredByIfInsufficientAccounts || [],
        reason: `requires >= 6 accounts; ${accountCount} provisioned`,
      };
    }
    if (check.gateDependent && !fourDeployed) {
      return {
        id: check.id,
        disposition: 'dependency_not_deployed',
        reason: 'ARG-ROOM-004 not deployed',
      };
    }
    return { id: check.id, disposition: 'run' };
  });
}

/**
 * Build the REDACTED plan printed before any live execution. No secret VALUE,
 * no raw token. Credentials are present+length fingerprints only. The email
 * transport gate is reported as a present/state flag — never its value.
 */
function buildRedactedPlan(plan, env) {
  const e = env || {};
  const p = plan || {};
  const fp = (alias) => ({
    email: fingerprint(e[`CDISCOURSE_BOT_${alias}_EMAIL`]),
    password: fingerprint(e[`CDISCOURSE_BOT_${alias}_PASSWORD`]),
  });
  return {
    mode: p.mode || 'dry_run',
    reason: p.reason || null,
    liveArmed: isLiveArmed(e),
    fourDeployed: !!p.fourDeployed,
    accountCount: typeof p.accountCount === 'number' ? p.accountCount : countDistinctAccounts(e),
    checkCount: SMOKE_CHECKS.length,
    coreChecks: coreCheckIds(),
    regressionChecks: regressionCheckIds(),
    // Email transport gate posture — state only, value NEVER carried.
    emailGate: { inviteEmailEnabled: e.INVITE_EMAIL_ENABLED === 'true' },
    credentials: {
      supabaseUrl: fingerprint(e.EXPO_PUBLIC_SUPABASE_URL || e.SUPABASE_URL),
      adminEmail: fingerprint(e.CDISCOURSE_ADMIN_EMAIL),
      adminPassword: fingerprint(e.CDISCOURSE_ADMIN_PASSWORD),
      botA: fp('A'),
      botB: fp('B'),
      botC: fp('C'),
      botD: fp('D'),
      botE: fp('E'),
    },
  };
}

module.exports = {
  fingerprint,
  parseArgs,
  countDistinctAccounts,
  isLiveArmed,
  resolveSmokePlan,
  planCheckExecution,
  buildRedactedPlan,
};
