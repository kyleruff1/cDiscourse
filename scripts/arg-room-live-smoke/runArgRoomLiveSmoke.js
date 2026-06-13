/**
 * ARG-ROOM-007 — live-smoke matrix runner (operator tool).
 *
 * WHAT THIS IS
 *   A DRY-RUN-DEFAULT operator harness that verifies the deployed public /
 *   private argument-room invite feature end-to-end. It signs in as ordinary
 *   JWT accounts (admin / bot / devtest) and exercises the DEPLOYED Edge
 *   Functions (`create-argument-room`, `manage-room-invite`) plus RLS-scoped
 *   table reads — exactly the data-plane discipline of the ARG-ROOM-002 smoke.
 *
 * SAFETY POSTURE (mirrors scripts/auth/sendInviteSmoke.js)
 *   - DEFAULT is dry-run: prints the redacted plan + the 12-check matrix + each
 *     check's runtime disposition. NO network, NO sign-in, NO send, NO gate flip.
 *   - Live execution requires BOTH `--live` AND env
 *     CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE=1. Absent either → refused.
 *   - This harness NEVER arms a gate or a live send. It NEVER sets
 *     INVITE_EMAIL_ENABLED or the new-user Auth send — those are OPERATOR-armed
 *     deploy-function preconditions (read-only here, for the report header).
 *   - NO service-role key is read. Auth is user JWT only (functions.invoke sets
 *     the caller's auth header internally; this file constructs none by hand).
 *   - Rooms are created ONLY via the create-argument-room Edge (never a direct
 *     debates insert — the single direct insert in this file is the deliberate
 *     R3 door-refusal probe, which EXPECTS 42501).
 *
 * USAGE
 *   node scripts/arg-room-live-smoke/runArgRoomLiveSmoke.js                # dry-run
 *   CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE=1 \
 *     node scripts/arg-room-live-smoke/runArgRoomLiveSmoke.js --live --four-deployed
 *
 * See docs/designs/ARG-ROOM-007-LIVE-SMOKE-MATRIX.md for the full protocol and
 * docs/testing-runs/2026-06-13-arg-room-live-smoke.md for the report template.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  parseArgs,
  resolveSmokePlan,
  buildRedactedPlan,
  planCheckExecution,
} = require('./plan.js');
const { SMOKE_CHECKS, findCheck } = require('./smokeMatrix.js');
const { renderReport, scanForSecretLeak } = require('./report.js');

const SMOKE_LABEL = '[ARG-ROOM-007 smoke 2026-06-13]';

/**
 * Self-contained dotenv reader. Deliberately NOT importing
 * scripts/bot-fixtures/loadEnv.js (that dir is #623 territory the design keeps
 * untouched). Reads .env.bot-tests then .env, with process.env taking priority.
 */
function readSmokeEnv(cwd) {
  const dir = cwd || process.cwd();
  const merged = {};
  for (const name of ['.env.bot-tests', '.env']) {
    const p = path.join(dir, name);
    if (!fs.existsSync(p)) continue;
    const content = fs.readFileSync(p, 'utf8');
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && merged[key] === undefined) merged[key] = val;
    }
  }
  // process.env wins (operator may export gates / arm flags in the shell).
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && v !== '') merged[k] = v;
  }
  return merged;
}

/** Resolve the configured accounts (admin + bots A..E) from env. */
function resolveAccounts(env) {
  const accounts = [];
  if (env.CDISCOURSE_ADMIN_EMAIL && env.CDISCOURSE_ADMIN_PASSWORD) {
    accounts.push({ alias: 'admin', email: env.CDISCOURSE_ADMIN_EMAIL, password: env.CDISCOURSE_ADMIN_PASSWORD });
  }
  for (const a of ['A', 'B', 'C', 'D', 'E']) {
    const email = env[`CDISCOURSE_BOT_${a}_EMAIL`];
    const password = env[`CDISCOURSE_BOT_${a}_PASSWORD`];
    if (email && password) accounts.push({ alias: `bot-${a.toLowerCase()}`, email, password });
  }
  return accounts;
}

/** Print the human-readable dry-run matrix + per-check disposition. */
function printDryMatrix(plan, args) {
  const coreChecks = SMOKE_CHECKS.filter((c) => !c.regression);
  const dispositions = planCheckExecution(coreChecks, {
    accountCount: plan.accountCount,
    fourDeployed: !!args.fourDeployed,
  });
  const byId = new Map(dispositions.map((d) => [d.id, d]));

  console.log('\n[arg-room-smoke] 12-check live-smoke matrix (dry-run — no network):');
  for (const c of coreChecks) {
    const d = byId.get(c.id);
    const exp = JSON.stringify(c.expected);
    let note = d.disposition;
    if (d.disposition === 'accounts_insufficient') note += ` (covered_by: ${(d.coveredBy || []).join(', ')})`;
    if (d.disposition === 'dependency_not_deployed') note += ` (${d.reason})`;
    console.log(`  - ${c.id} [accts ${c.accountsNeeded}, verify ${c.verify}] expect ${exp} → ${note}`);
  }
  console.log('\n[arg-room-smoke] regression re-checks (already proven LIVE by the 002 smoke):');
  for (const c of SMOKE_CHECKS.filter((x) => x.regression)) {
    console.log(`  - ${c.id} expect ${JSON.stringify(c.expected)}`);
  }
  console.log(
    '\n[arg-room-smoke] dry-run only — no network, no sign-in, no email, no gate flip.' +
      '\n  Re-run with --live AND env CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE=1 to execute (operator-armed).' +
      '\n  Email-bearing checks (#9/#10/#11) additionally require ARG-ROOM-004 deployed (--four-deployed).',
  );
}

/** Make a fresh caller-scoped client signed in as the given account. */
async function signInClient(createClient, url, anon, account) {
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw new Error(`sign-in failed for ${account.alias}: ${error.message}`);
  return client;
}

/** Invoke a deployed Edge, returning { status, body }. functions.invoke sets the caller's auth internally. */
async function invokeEdge(client, name, body) {
  const { data, error } = await client.functions.invoke(name, { body });
  if (error && error.context && typeof error.context.status === 'number') {
    let parsed = null;
    try {
      parsed = await error.context.json();
    } catch {
      parsed = null;
    }
    return { status: error.context.status, body: parsed };
  }
  if (error) return { status: 0, body: { error: error.name || 'invoke_error' } };
  return { status: 200, body: data };
}

/** Extract the `?invite=<token>` token from a create-time inviteLink (creator-only surface). */
function tokenFromInviteLink(inviteLink) {
  if (typeof inviteLink !== 'string') return null;
  try {
    return new URL(inviteLink).searchParams.get('invite');
  } catch {
    return null;
  }
}

/**
 * Live execution. Operator-armed; never run by Claude or by the test suite.
 * Captures every Edge response, scans them for secret leakage, and prints a
 * redacted report block for pasting into the testing-runs doc.
 */
async function runLive(plan, env, args) {
  const { createClient } = require('@supabase/supabase-js');
  const url = env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const anon = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    console.error('[arg-room-smoke] REFUSED: missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
    process.exitCode = 2;
    return;
  }
  const accounts = resolveAccounts(env);
  if (accounts.length < 2) {
    console.error('[arg-room-smoke] REFUSED: need at least an admin + one bot account to run the core checks.');
    process.exitCode = 2;
    return;
  }

  const coreChecks = SMOKE_CHECKS.filter((c) => !c.regression);
  const dispositions = new Map(
    planCheckExecution(coreChecks, {
      accountCount: plan.accountCount,
      fourDeployed: !!args.fourDeployed,
    }).map((d) => [d.id, d]),
  );

  const captured = []; // every Edge response body, scanned for leaks at the end.
  const ownTokens = []; // caller-supplied tokens + the creator-only create-time inviteLink token (whitelist).
  const results = [];
  const preconditions = [];

  const creator = accounts.find((a) => a.alias === 'admin') || accounts[0];
  const invitee = accounts.find((a) => a !== creator);

  let creatorClient;
  try {
    creatorClient = await signInClient(createClient, url, anon, creator);
  } catch (e) {
    console.error(`[arg-room-smoke] REFUSED: ${e.message}`);
    process.exitCode = 2;
    return;
  }

  // ── Precondition probe (review finding #4): which Edge emits the create-time
  // invite email under the deployed 004? Record it; the operator confirms via
  // Deno logs. The accept path is always manage-room-invite accept.
  preconditions.push({
    gate: 'Create-time invite email emitter (probe)',
    result: args.fourDeployed ? 'probe-on-create' : 'n/a (004 not asserted deployed)',
    evidence: 'create-argument-room RPC mints the invite row; the send seam per the deployed 004 — confirm via Deno logs (short-id + email-domain only)',
  });
  preconditions.push({
    gate: 'Resolved distinct accounts',
    result: String(plan.accountCount),
    evidence: 'admin + bots A..E with a configured email',
  });
  preconditions.push({
    gate: 'ARG-ROOM-004 deployed (email-bearing checks)',
    result: args.fourDeployed ? 'asserted by operator' : 'not asserted',
    evidence: '--four-deployed flag + operator confirmation',
  });

  const record = (check, status, body, actualLabel) => {
    captured.push({ check: check.id, status, body });
    results.push({
      num: check.id,
      title: check.title,
      accts: check.accountsNeeded,
      expected: JSON.stringify(check.expected),
      actual: actualLabel,
      result: 'TBD (operator verifies vs RLS read)',
    });
  };

  // The runner walks the core checks in dependency order. Each check that is
  // dispositioned 'run' executes; 'accounts_insufficient' / 'dependency_not_deployed'
  // record an explicit SKIP (never a false PASS/FAIL).
  try {
    for (const check of coreChecks) {
      const disp = dispositions.get(check.id);
      if (disp && disp.disposition !== 'run') {
        results.push({
          num: check.id,
          title: check.title,
          accts: check.accountsNeeded,
          expected: JSON.stringify(check.expected),
          actual: disp.disposition === 'accounts_insufficient'
            ? `SKIP — covered_by: ${(disp.coveredBy || []).join(', ')}`
            : `SKIP — ${disp.reason}`,
          result: 'SKIP',
        });
        continue;
      }

      if (check.id === 'public-no-invite-create') {
        const r = await invokeEdge(creatorClient, 'create-argument-room', {
          visibility: 'public',
          title: `${SMOKE_LABEL} public-no-invite`,
        });
        record(check, r.status, r.body, `status ${r.status}`);
      } else if (check.id === 'public-one-invite-create' || check.id === 'private-one-invite-create') {
        const visibility = check.id === 'public-one-invite-create' ? 'public' : 'private';
        const r = await invokeEdge(creatorClient, 'create-argument-room', {
          visibility,
          title: `${SMOKE_LABEL} ${visibility}-one-invite`,
          invite: { email: invitee.email },
        });
        const tok = tokenFromInviteLink(r.body && r.body.inviteLink);
        if (tok) ownTokens.push(tok);
        record(check, r.status, r.body, `status ${r.status}, inviteId ${r.body && r.body.inviteId ? 'set' : 'null'}`);
      } else if (check.id === 'private-no-invite-reject') {
        const r = await invokeEdge(creatorClient, 'create-argument-room', {
          visibility: 'private',
          title: `${SMOKE_LABEL} private-no-invite`,
        });
        record(check, r.status, r.body, `status ${r.status}, code ${r.body && r.body.error}`);
      } else if (check.id === 'reserved-invite-seat-acceptance') {
        // Mint a fresh private room + invite to the invitee, then accept as the invitee.
        const created = await invokeEdge(creatorClient, 'create-argument-room', {
          visibility: 'private',
          title: `${SMOKE_LABEL} accept-flow`,
          invite: { email: invitee.email },
        });
        const tok = tokenFromInviteLink(created.body && created.body.inviteLink);
        if (tok) ownTokens.push(tok);
        let acceptStatus = 0;
        let acceptBody = null;
        if (tok) {
          const inviteeClient = await signInClient(createClient, url, anon, invitee);
          const acc = await invokeEdge(inviteeClient, 'manage-room-invite', { action: 'accept', token: tok });
          acceptStatus = acc.status;
          acceptBody = acc.body;
          await inviteeClient.auth.signOut();
        }
        record(check, acceptStatus, acceptBody, `accept status ${acceptStatus}, ${acceptBody && acceptBody.status}`);
      } else if (check.id === 'wrong-user-invite-recovery') {
        // Mint an invite to the invitee, then attempt accept as a DIFFERENT account.
        const wrongUser = accounts.find((a) => a !== creator && a !== invitee);
        const created = await invokeEdge(creatorClient, 'create-argument-room', {
          visibility: 'private',
          title: `${SMOKE_LABEL} wrong-user`,
          invite: { email: invitee.email },
        });
        const tok = tokenFromInviteLink(created.body && created.body.inviteLink);
        if (tok) ownTokens.push(tok);
        let st = 0;
        let bd = null;
        if (tok && wrongUser) {
          const wrongClient = await signInClient(createClient, url, anon, wrongUser);
          const acc = await invokeEdge(wrongClient, 'manage-room-invite', { action: 'accept', token: tok });
          st = acc.status;
          bd = acc.body;
          await wrongClient.auth.signOut();
        } else {
          results.push({
            num: check.id,
            title: check.title,
            accts: check.accountsNeeded,
            expected: JSON.stringify(check.expected),
            actual: 'SKIP — needs a third distinct account',
            result: 'SKIP',
          });
          continue;
        }
        record(check, st, bd, `status ${st}, code ${bd && bd.error}`);
      } else if (check.id === 'no-token-leakage') {
        // Mint a room+invite, then list_for_debate (inviter) + lookup_by_token.
        const created = await invokeEdge(creatorClient, 'create-argument-room', {
          visibility: 'private',
          title: `${SMOKE_LABEL} no-leak`,
          invite: { email: invitee.email },
        });
        const tok = tokenFromInviteLink(created.body && created.body.inviteLink);
        if (tok) ownTokens.push(tok);
        const debateId = created.body && created.body.debateId;
        if (debateId) {
          const list = await invokeEdge(creatorClient, 'manage-room-invite', { action: 'list_for_debate', debateId });
          captured.push({ check: `${check.id}:list`, status: list.status, body: list.body });
        }
        if (tok) {
          const look = await invokeEdge(creatorClient, 'manage-room-invite', { action: 'lookup_by_token', token: tok });
          captured.push({ check: `${check.id}:lookup`, status: look.status, body: look.body });
        }
        record(check, created.status, created.body, 'scanned below');
      } else {
        // Account-gated (#5/#7) and email-bearing (#9/#10/#11) checks that
        // reached here are 'run' but their orchestration (cap-fill / browser
        // set-password) is operator-driven; record an explicit operator step.
        results.push({
          num: check.id,
          title: check.title,
          accts: check.accountsNeeded,
          expected: JSON.stringify(check.expected),
          actual: 'OPERATOR — see runbook (cap-fill / browser set-password / gate-armed)',
          result: 'TBD',
        });
      }
    }
  } finally {
    await creatorClient.auth.signOut().catch(() => {});
  }

  // ── No-token-leakage scan over every captured response (#12). The caller's
  // own create-time inviteLink token(s) are whitelisted; a DIFFERENT invite's
  // token in any body is a FAIL.
  const leaks = scanForSecretLeak(captured, { allowedTokens: ownTokens });
  const noLeak = leaks.length === 0
    ? 'Response scan clean — no raw token / JWT-shape / auth-prefixed header / hash outside the creator-only create-time inviteLink. Log half: operator-confirm via Deno logs (short-id + email-domain only).'
    : `LEAK DETECTED in: ${leaks.join('; ')}`;

  const report = renderReport({
    headSha: env.CDISCOURSE_SMOKE_HEAD_SHA || null,
    harnessCmd: 'node scripts/arg-room-live-smoke/runArgRoomLiveSmoke.js --live',
    gatesArmed: { inviteEmail: env.INVITE_EMAIL_ENABLED === 'true', newUserSend: args.fourDeployed },
    accountCount: plan.accountCount,
    accountsLabel: 'admin + accounts A/B/C [+ D/E]',
    outcome: { passed: 'TBD', total: 12, regressionPassed: 'TBD', regressionTotal: 3 },
    preconditions,
    results,
    noLeak,
  });

  console.log('\n[arg-room-smoke] captured responses scanned for secret leakage:', leaks.length === 0 ? 'CLEAN' : 'LEAK');
  console.log('\n[arg-room-smoke] report block (paste into docs/testing-runs/2026-06-13-arg-room-live-smoke.md):\n');
  console.log(report);
  console.log(
    '\n[arg-room-smoke] live run done. DISARM: archive every "' + SMOKE_LABEL + '" room (status flip, never hard delete),' +
      ' revoke leftover pending invites, return INVITE_EMAIL_ENABLED to OFF, unset CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE.',
  );
}

module.exports = {
  SMOKE_LABEL,
  readSmokeEnv,
  resolveAccounts,
  tokenFromInviteLink,
};

// ── CLI entry (network only on the armed live path; nothing runs on require) ──
if (require.main === module) {
  (async () => {
    const args = parseArgs(process.argv.slice(2));
    const env = readSmokeEnv(process.cwd());
    const plan = resolveSmokePlan(args, env);
    const redacted = buildRedactedPlan(plan, env);
    console.log('[arg-room-smoke] plan:', JSON.stringify(redacted, null, 2));

    if (plan.mode === 'refused') {
      console.error(`[arg-room-smoke] REFUSED: ${plan.reason}`);
      console.error('  Live execution requires BOTH --live AND env CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE=1. This harness never self-arms.');
      process.exitCode = 2;
      return;
    }
    if (plan.mode === 'dry_run') {
      printDryMatrix(plan, args);
      return;
    }
    // mode === 'live'
    await runLive(plan, env, args);
  })().catch((err) => {
    console.error('[arg-room-smoke] unexpected error:', err && err.message ? err.message : String(err));
    process.exitCode = 1;
  });
}

// DOOR_REFUSAL_PROBE (R3): the ONLY direct `debates` write in this harness.
// It is NOT a room-creation path — every smoke room is created via the
// create-argument-room Edge above. This probe deliberately attempts a direct
// client insert and EXPECTS RLS refusal (42501), proving the door dropped by
// ARG-ROOM-002 stays closed (#623-independence). Operator-invoked only.
async function probeDoorRefusal(client) {
  const { error } = await client.from('debates').insert({ title: `${SMOKE_LABEL} door-probe` });
  return { refused: !!error, code: error && error.code };
}

module.exports.probeDoorRefusal = probeDoorRefusal;
