/**
 * AUTH-INVITE-BRANDED-SMOKE-2026-06-13 — controlled invite smoke (operator tool).
 *
 * WHAT THIS IS
 *   A thin, dry-run-DEFAULT operator client over the EXISTING audited invite
 *   seam: the deployed `admin-users` Edge Function `invite_user` action
 *   (supabase/functions/admin-users/index.ts:364 handleInviteUser). That action
 *   calls `auth.admin.inviteUserByEmail`, which sends the Supabase "Invite user"
 *   email — branded by supabase/templates/invite.html.
 *
 * WHY NO SERVICE-ROLE HERE (doctrine §6)
 *   The service-role key lives ONLY inside Edge Functions. This script never
 *   reads it. For a LIVE send it authenticates as an ADMIN USER via JWT
 *   (email+password from env, the same pattern bot scripts use) and invokes the
 *   Edge Function, which enforces requireAdmin() + writes the admin audit row.
 *   The invite link/token never reaches this script (the Edge response carries
 *   no link, no token, no email — adminInvitePayload.ts buildInviteResponse).
 *
 * SAFETY POSTURE
 *   - DEFAULT is --dry-run: validates inputs and prints a REDACTED plan. No
 *     network, no credential read, no send.
 *   - A live send requires BOTH `--live` AND env CDISCOURSE_ALLOW_INVITE_SEND_SMOKE=1.
 *   - A batch requires BOTH `--range a..b` AND env CDISCOURSE_ALLOW_INVITE_BATCH=1.
 *   - Targets must match the kyleruff+devtestNN@gmail.com plus-address shape
 *     unless --allow-non-devtest is passed explicitly.
 *   - A live send requires --redirect-to <https .../auth/callback> in the
 *     redirect allow-list, and an explicit --smtp-posture (custom|default);
 *     `unknown` is refused.
 *   - Secrets are never printed: diagnostics show presence + length + a 4-char
 *     prefix/suffix fingerprint only. Invite links/tokens are never printed.
 *
 * USAGE
 *   node scripts/auth/sendInviteSmoke.js --dry-run --email kyleruff+devtest99@gmail.com
 *   node scripts/auth/sendInviteSmoke.js --live --email kyleruff+devtest99@gmail.com \
 *        --redirect-to https://dev-cdiscourse.netlify.app/auth/callback --smtp-posture custom
 *   node scripts/auth/sendInviteSmoke.js --live --range 98..97 \
 *        --redirect-to https://dev-cdiscourse.netlify.app/auth/callback --smtp-posture custom
 */

'use strict';

// Redirect hosts mirrored from supabase/config.toml additional_redirect_urls
// (:164-170). The live redirect must resolve to one of these hosts and the
// /auth/callback path (DEFAULT_AUTH_ROUTES.invite, buildAuthRedirectUrl.ts:50).
const ALLOWED_REDIRECT_HOSTS = Object.freeze([
  'localhost:8081',
  'dev-cdiscourse.netlify.app',
  'dev.cdiscourse.com',
]);

const SEED_EMAIL_RE = /^kyleruff\+devtest(\d{1,3})@gmail\.com$/;
const MAX_BATCH = 5; // hard cap — never infer a large range.

/**
 * Presence + length ONLY — never the value, and never any character of it.
 * (AUTH-URL-CONFIG-AND-RESEED-2026-06-13 hardening: the prior 4-char
 * prefix/suffix preview exposed too many characters of short secrets like a
 * password or access token. Diagnostics now carry no value fragment at all.)
 */
function fingerprint(value) {
  if (value === undefined || value === null || value === '') {
    return { present: false };
  }
  return { present: true, length: String(value).length };
}

/** True for the kyleruff+devtestNN@gmail.com plus-address shape. */
function isSeedEmail(email) {
  return typeof email === 'string' && SEED_EMAIL_RE.test(email);
}

/** Validate a single target email. Returns { ok, reason }. */
function validateTargetEmail(email, { allowNonDevtest = false } = {}) {
  if (typeof email !== 'string' || !email.includes('@') || email.length < 6) {
    return { ok: false, reason: 'malformed_email' };
  }
  if (!isSeedEmail(email) && !allowNonDevtest) {
    return { ok: false, reason: 'not_devtest_plus_address' };
  }
  return { ok: true };
}

/**
 * Expand a "98..97" range into [kyleruff+devtest98@…, kyleruff+devtest97@…].
 * Refuses missing/unbounded/over-cap ranges. Honours descending order (the
 * operator's stated intent: start=98 down through end=97).
 */
function expandBatchRange(spec) {
  if (typeof spec !== 'string' || !/^\d{1,3}\.\.\d{1,3}$/.test(spec)) {
    return { ok: false, reason: 'range_missing_or_malformed' };
  }
  const [a, b] = spec.split('..').map((n) => parseInt(n, 10));
  const step = a >= b ? -1 : 1;
  const nums = [];
  for (let n = a; step > 0 ? n <= b : n >= b; n += step) nums.push(n);
  if (nums.length === 0) return { ok: false, reason: 'empty_range' };
  if (nums.length > MAX_BATCH) return { ok: false, reason: 'range_exceeds_cap' };
  return { ok: true, emails: nums.map((n) => `kyleruff+devtest${n}@gmail.com`) };
}

/** Validate a live redirect URL against the allow-list + /auth/callback path. */
function validateRedirectTo(url) {
  if (typeof url !== 'string' || url.length === 0) {
    return { ok: false, reason: 'redirect_missing' };
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'redirect_unparseable' };
  }
  const isLocalhostHttp = parsed.protocol === 'http:' && parsed.host === 'localhost:8081';
  if (parsed.protocol !== 'https:' && !isLocalhostHttp) {
    return { ok: false, reason: 'redirect_not_https' };
  }
  if (!ALLOWED_REDIRECT_HOSTS.includes(parsed.host)) {
    return { ok: false, reason: 'redirect_host_not_allowlisted' };
  }
  if (parsed.pathname !== '/auth/callback') {
    return { ok: false, reason: 'redirect_path_not_callback' };
  }
  return { ok: true, host: parsed.host };
}

/** Parse argv (after `node script.js`). Pure. */
function parseArgs(argv) {
  const out = { dryRun: true, live: false, email: null, range: null, redirectTo: null, smtpPosture: 'unknown', allowNonDevtest: false, reinvite: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--live') { out.live = true; out.dryRun = false; }
    else if (a === '--dry-run') { out.dryRun = true; out.live = false; }
    else if (a === '--allow-non-devtest') out.allowNonDevtest = true;
    else if (a === '--reinvite') out.reinvite = true;
    else if (a === '--email') out.email = argv[++i] ?? null;
    else if (a === '--range') out.range = argv[++i] ?? null;
    else if (a === '--redirect-to') out.redirectTo = argv[++i] ?? null;
    else if (a === '--smtp-posture') out.smtpPosture = argv[++i] ?? 'unknown';
  }
  return out;
}

/**
 * Decide the action from parsed args + env flags. Returns a discriminated
 * result the caller acts on. Pure — env is passed in, never read here.
 * mode: 'dry_run' | 'live_single' | 'live_batch' | 'refused'.
 */
function resolvePlan(args, env) {
  const sendArmed = env.CDISCOURSE_ALLOW_INVITE_SEND_SMOKE === '1';
  const batchArmed = env.CDISCOURSE_ALLOW_INVITE_BATCH === '1';

  // Resolve targets.
  let targets;
  if (args.range) {
    const r = expandBatchRange(args.range);
    if (!r.ok) return { mode: 'refused', reason: r.reason };
    targets = r.emails;
  } else {
    const email = args.email || env.CDISCOURSE_INVITE_SEED_EMAIL || 'kyleruff+devtest99@gmail.com';
    targets = [email];
  }

  // Validate every target.
  for (const t of targets) {
    const v = validateTargetEmail(t, { allowNonDevtest: args.allowNonDevtest });
    if (!v.ok) return { mode: 'refused', reason: `${v.reason}:${t}` };
  }

  if (args.dryRun || !args.live) {
    return { mode: 'dry_run', targets };
  }

  // ── live path gates ──
  if (!sendArmed) return { mode: 'refused', reason: 'live_send_not_armed' }; // CDISCOURSE_ALLOW_INVITE_SEND_SMOKE != 1
  const redir = validateRedirectTo(args.redirectTo);
  if (!redir.ok) return { mode: 'refused', reason: redir.reason };
  if (args.smtpPosture !== 'custom' && args.smtpPosture !== 'default') {
    return { mode: 'refused', reason: 'smtp_posture_unknown' };
  }
  if (targets.length > 1) {
    if (!batchArmed) return { mode: 'refused', reason: 'batch_not_armed' }; // CDISCOURSE_ALLOW_INVITE_BATCH != 1
    return { mode: 'live_batch', targets, redirectTo: args.redirectTo, redirectHost: redir.host, smtpPosture: args.smtpPosture };
  }
  return { mode: 'live_single', targets, redirectTo: args.redirectTo, redirectHost: redir.host, smtpPosture: args.smtpPosture };
}

/** Build the REDACTED plan printed before any send. No secrets, no links. */
function buildRedactedPlan(plan, env) {
  return {
    mode: plan.mode,
    reason: plan.reason ?? null,
    targets: plan.targets ?? null,
    redirectHost: plan.redirectHost ?? null,
    smtpPosture: plan.smtpPosture ?? 'n/a',
    batchEnabled: env.CDISCOURSE_ALLOW_INVITE_BATCH === '1',
    sendArmed: env.CDISCOURSE_ALLOW_INVITE_SEND_SMOKE === '1',
    credentials: {
      supabaseUrl: fingerprint(env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL),
      adminEmail: fingerprint(env.CDISCOURSE_ADMIN_EMAIL),
      adminPassword: fingerprint(env.CDISCOURSE_ADMIN_PASSWORD),
    },
  };
}

module.exports = {
  ALLOWED_REDIRECT_HOSTS,
  MAX_BATCH,
  SEED_EMAIL_RE,
  fingerprint,
  isSeedEmail,
  validateTargetEmail,
  expandBatchRange,
  validateRedirectTo,
  parseArgs,
  resolvePlan,
  buildRedactedPlan,
};

// ── CLI entry (network only on the live path; nothing runs on require) ──
if (require.main === module) {
  /* eslint-disable no-console */
  (async () => {
    const args = parseArgs(process.argv.slice(2));
    const plan = resolvePlan(args, process.env);
    const redacted = buildRedactedPlan(plan, process.env);
    console.log('[invite-smoke] plan:', JSON.stringify(redacted, null, 2));

    if (plan.mode === 'refused') {
      console.error(`[invite-smoke] REFUSED: ${plan.reason}`);
      process.exitCode = 2;
      return;
    }
    if (plan.mode === 'dry_run') {
      console.log('[invite-smoke] dry-run only — no network, no send. Re-run with --live (and the armed flags) to send.');
      return;
    }

    // Live path — authenticate as an ADMIN USER (JWT) and invoke the
    // admin-users Edge Function. No service-role is read here.
    const { createClient } = require('@supabase/supabase-js');
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anon = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const adminEmail = process.env.CDISCOURSE_ADMIN_EMAIL;
    const adminPassword = process.env.CDISCOURSE_ADMIN_PASSWORD;
    if (!url || !anon || !adminEmail || !adminPassword) {
      console.error('[invite-smoke] REFUSED: missing one of EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY / CDISCOURSE_ADMIN_EMAIL / CDISCOURSE_ADMIN_PASSWORD (env).');
      process.exitCode = 2;
      return;
    }
    const client = createClient(url, anon, { auth: { persistSession: false } });
    const { error: signInErr } = await client.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
    if (signInErr) {
      console.error(`[invite-smoke] REFUSED: admin sign-in failed (${signInErr.message}).`);
      process.exitCode = 2;
      return;
    }

    for (const email of plan.targets) {
      // Pre-check existence via the admin list_users search (admin-only).
      const { data: listData } = await client.functions.invoke('admin-users', {
        body: { action: 'list_users', search: email, perPage: 5 },
      });
      const exists = Array.isArray(listData?.users) && listData.users.some((u) => (u.email || '').toLowerCase() === email.toLowerCase());
      if (exists && !args.reinvite) {
        console.log(`[invite-smoke] SKIP ${email}: account already exists (pass --reinvite to override).`);
        continue;
      }
      const { data, error } = await client.functions.invoke('admin-users', {
        body: { action: 'invite_user', email, role: 'user', redirectTo: plan.redirectTo },
      });
      // The Edge response carries no link/token/email — safe to log verbatim.
      if (error) {
        console.error(`[invite-smoke] ${email}: invite call FAILED — category=${error.name || 'invoke_error'}.`);
      } else {
        console.log(`[invite-smoke] ${email}: invite call returned`, JSON.stringify(data));
      }
    }
    await client.auth.signOut();
    console.log('[invite-smoke] done. Next: confirm receipt + rendering in the target Gmail inbox/spam/promotions, then account creation per the smoke report.');
  })().catch((err) => {
    console.error('[invite-smoke] unexpected error:', err && err.message ? err.message : String(err));
    process.exitCode = 1;
  });
  /* eslint-enable no-console */
}
