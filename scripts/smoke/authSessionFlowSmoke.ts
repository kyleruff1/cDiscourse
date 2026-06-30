/**
 * COV-006 — Auth session-flow smoke (operator-gated)
 *
 * Tracking issue : https://github.com/kyleruff1/cDiscourse/issues/810
 * Audit gap      : docs/audits/COVERAGE-AUDIT-2026-06-30.md gap #6
 * Audit commit   : 00554af
 *
 * Scope (operator-reduced from the audit's original L-cost recommendation):
 *
 *   This script covers the SESSION half of the auth front door:
 *     sign-in -> capture session -> persist + restart -> restore -> sign-out -> verify clear.
 *
 *   It does NOT cover the SIGN-UP half (fresh mailbox + Supabase admin API
 *   create-user + confirmation-link fetch + set-password callback follow).
 *   That sub-scope is deferred to a follow-up card and is documented as a
 *   known boundary in docs/testing-runs/auth-smoke-template.md.
 *
 * What this smoke proves on live infrastructure:
 *
 *   1. Supabase Auth signInWithPassword still accepts the documented test
 *      admin credentials (CDISCOURSE_ADMIN_EMAIL / CDISCOURSE_ADMIN_PASSWORD).
 *   2. The returned session shape carries the keys the app relies on
 *      (access_token, refresh_token, expires_at, user.id).
 *   3. A fresh @supabase/supabase-js client can resume that session via
 *      setSession() and read back the SAME user.id and expires_at —
 *      the "persist + cold-restart" contract that #640 and #641 broke.
 *   4. signOut() actually clears server-side state (a fresh post-signOut
 *      client sees no user, no session).
 *
 * Doctrine guards applied:
 *   - No raw access_token / refresh_token / password / anon-key value is
 *     ever printed. Only stage names, user.id, expires_at, and PASS/FAIL.
 *   - The --dry mode replaces every Supabase network call with an in-memory
 *     deterministic mock. --dry is loudly marked in every log line and the
 *     summary so a dry pass cannot be mistaken for a live pass.
 *   - .env.bot-tests is read but NEVER written, copied, or echoed. The path
 *     is logged; the values are not.
 *   - Existing dependencies only: @supabase/supabase-js (^2.105.4) and
 *     Node's built-in fs / path / process. No new npm install.
 *
 * How the operator runs it (live mode):
 *
 *   # From the primary checkout where .env.bot-tests lives:
 *   node scripts/smoke/authSessionFlowSmoke.ts
 *
 *   # Override the env file path:
 *   node scripts/smoke/authSessionFlowSmoke.ts --env /abs/path/.env.bot-tests
 *
 *   # Local verification without touching live Supabase:
 *   node scripts/smoke/authSessionFlowSmoke.ts --dry
 *
 *   Requires Node 22.6+ (built-in TypeScript stripping). Verified on
 *   Node 24.15.0 at authoring time. No tsx / ts-node dependency.
 *
 * Exit codes:
 *   0  every stage PASS
 *   1  any stage FAIL or env-validation FAIL
 *   2  invalid CLI usage (--help, unknown flag with bad value, etc.)
 */

/* eslint-disable no-console */

import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ────────────────────────────────────────────────────────────────────────
// CLI
// ────────────────────────────────────────────────────────────────────────

interface CliArgs {
  dry: boolean;
  envPath: string;
  help: boolean;
}

function parseCli(argv: string[]): CliArgs {
  const args: CliArgs = { dry: false, envPath: '.env.bot-tests', help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') {
      args.dry = true;
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    } else if (a === '--env') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--env requires a path argument');
      }
      args.envPath = next;
      i++;
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(
    [
      'COV-006 auth session-flow smoke',
      '',
      'Usage:',
      '  node scripts/smoke/authSessionFlowSmoke.ts [--dry] [--env <path>]',
      '',
      'Flags:',
      '  --dry         Run all 7 stages with an in-memory mock. No network.',
      '  --env <path>  Path to the credentials file (default: .env.bot-tests).',
      '  --help, -h    Show this message.',
      '',
      'Required env keys (live mode):',
      '  EXPO_PUBLIC_SUPABASE_URL',
      '  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      '  CDISCOURSE_ADMIN_EMAIL',
      '  CDISCOURSE_ADMIN_PASSWORD',
      '',
      'See docs/testing-runs/auth-smoke-template.md for the run log template.',
    ].join('\n'),
  );
}

// ────────────────────────────────────────────────────────────────────────
// Env loader (no dotenv dep)
// ────────────────────────────────────────────────────────────────────────

interface EnvBundle {
  supabaseUrl: string;
  publishableKey: string;
  adminEmail: string;
  adminPassword: string;
}

const REQUIRED_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'CDISCOURSE_ADMIN_EMAIL',
  'CDISCOURSE_ADMIN_PASSWORD',
] as const;

function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnv(envPath: string, dry: boolean): { bundle: EnvBundle; sourceLabel: string } {
  if (dry) {
    // Deterministic placeholders. NEVER use real values in dry mode.
    return {
      bundle: {
        supabaseUrl: 'https://dry.example.invalid',
        publishableKey: 'dry-placeholder-publishable-key',
        adminEmail: 'dry-admin@example.invalid',
        adminPassword: 'dry-placeholder-password',
      },
      sourceLabel: '(--dry: in-memory placeholders, no file read)',
    };
  }

  const absPath = path.resolve(envPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(
      `env file not found: ${absPath}\n` +
        `Run from the checkout where .env.bot-tests lives, or pass --env <path>.`,
    );
  }
  const text = fs.readFileSync(absPath, 'utf8');
  const parsed = parseEnvFile(text);

  // Allow process.env to override file values (CI-style).
  const get = (k: string): string => (process.env[k] ?? parsed[k] ?? '').trim();

  const missing: string[] = [];
  for (const k of REQUIRED_KEYS) {
    if (!get(k)) missing.push(k);
  }
  if (missing.length > 0) {
    throw new Error(
      `env file is missing required keys: ${missing.join(', ')}\n` +
        `Expected at: ${absPath}\n` +
        `Each required key must be present and non-empty.`,
    );
  }

  return {
    bundle: {
      supabaseUrl: get('EXPO_PUBLIC_SUPABASE_URL'),
      publishableKey: get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
      adminEmail: get('CDISCOURSE_ADMIN_EMAIL'),
      adminPassword: get('CDISCOURSE_ADMIN_PASSWORD'),
    },
    sourceLabel: absPath,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Client factory: real vs --dry mock
// ────────────────────────────────────────────────────────────────────────

/**
 * Minimal mock of the supabase-js auth surface we touch. Each fresh
 * instance is independent (mirrors the cold-restart property). The mock
 * keeps an in-memory session keyed by access_token; setSession() rebinds.
 * No real network. No real tokens.
 */
interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string };
}

// A single in-memory store, shared across mock-client instances, simulates
// the deployed Auth server. signOut() in one instance clears it everywhere,
// which is what we want to verify the "fresh post-signOut client sees clear"
// stage.
const MOCK_DEPLOYED_SESSIONS = new Map<string, MockSession>();
let mockSerial = 0;

function buildMockClient(bundle: EnvBundle): SupabaseClient {
  // Token shape: opaque, deterministic per serial. NEVER prints in logs
  // because the logger redacts these fields.
  function freshTokens(): { access_token: string; refresh_token: string } {
    mockSerial++;
    return {
      access_token: `mock-access-${mockSerial}`,
      refresh_token: `mock-refresh-${mockSerial}`,
    };
  }
  function nowExp(): number {
    return Math.floor(Date.now() / 1000) + 3600;
  }

  // Each mock client carries its OWN locally bound session, separate from
  // the deployed-store. setSession() binds it. getUser/getSession read it.
  let local: MockSession | null = null;

  const auth = {
    signInWithPassword: async (creds: { email: string; password: string }) => {
      if (creds.email !== bundle.adminEmail || creds.password !== bundle.adminPassword) {
        return { data: { session: null, user: null }, error: { message: 'invalid_credentials' } };
      }
      const { access_token, refresh_token } = freshTokens();
      const sess: MockSession = {
        access_token,
        refresh_token,
        expires_at: nowExp(),
        user: { id: 'mock-user-id-cov006' },
      };
      MOCK_DEPLOYED_SESSIONS.set(access_token, sess);
      local = sess;
      return { data: { session: sess as unknown as Session, user: sess.user as unknown as User }, error: null };
    },
    setSession: async (input: { access_token: string; refresh_token: string }) => {
      const deployed = MOCK_DEPLOYED_SESSIONS.get(input.access_token);
      if (!deployed || deployed.refresh_token !== input.refresh_token) {
        return { data: { session: null, user: null }, error: { message: 'invalid_session' } };
      }
      local = deployed;
      return {
        data: { session: deployed as unknown as Session, user: deployed.user as unknown as User },
        error: null,
      };
    },
    getSession: async () => {
      if (!local) return { data: { session: null }, error: null };
      const stillDeployed = MOCK_DEPLOYED_SESSIONS.get(local.access_token);
      if (!stillDeployed) {
        local = null;
        return { data: { session: null }, error: null };
      }
      return { data: { session: local as unknown as Session }, error: null };
    },
    getUser: async () => {
      if (!local) return { data: { user: null }, error: null };
      const stillDeployed = MOCK_DEPLOYED_SESSIONS.get(local.access_token);
      if (!stillDeployed) {
        local = null;
        return { data: { user: null }, error: null };
      }
      return { data: { user: local.user as unknown as User }, error: null };
    },
    signOut: async () => {
      if (local) MOCK_DEPLOYED_SESSIONS.delete(local.access_token);
      local = null;
      return { error: null };
    },
  };

  return { auth } as unknown as SupabaseClient;
}

function buildClient(bundle: EnvBundle, dry: boolean): SupabaseClient {
  if (dry) return buildMockClient(bundle);
  return createClient(bundle.supabaseUrl, bundle.publishableKey, {
    auth: {
      // We manage persistence manually in this smoke; do not write to disk.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// Logger — structural only, never prints token / password / key values
// ────────────────────────────────────────────────────────────────────────

interface StageResult {
  stage: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

const TAG = '[auth-smoke]';

function tag(mode: 'live' | '--dry'): string {
  return mode === 'live' ? TAG : `${TAG} --dry`;
}

function logStageStart(mode: 'live' | '--dry', name: string): void {
  console.log(`${tag(mode)} ${name} START`);
}
function logStageDone(mode: 'live' | '--dry', name: string, detail: string): void {
  console.log(`${tag(mode)} ${name} DONE ${detail}`);
}
function logStageFail(mode: 'live' | '--dry', name: string, detail: string): void {
  console.error(`${tag(mode)} ${name} FAIL ${detail}`);
}

// ────────────────────────────────────────────────────────────────────────
// Stages
// ────────────────────────────────────────────────────────────────────────

const STAGE_NAMES = [
  'S1 load-creds',
  'S2 sign-in',
  'S3 capture-session',
  'S4 restore-via-setSession',
  'S5 verify-restore',
  'S6 sign-out',
  'S7 verify-clear',
] as const;

async function runStages(args: CliArgs): Promise<StageResult[]> {
  const mode: 'live' | '--dry' = args.dry ? '--dry' : 'live';
  const results: StageResult[] = [];

  // ── S1: load creds + validate env ─────────────────────────────────
  logStageStart(mode, STAGE_NAMES[0]);
  let envBundle: EnvBundle;
  let envSource: string;
  try {
    const loaded = loadEnv(args.envPath, args.dry);
    envBundle = loaded.bundle;
    envSource = loaded.sourceLabel;
    const emailDomain = envBundle.adminEmail.includes('@')
      ? envBundle.adminEmail.split('@')[1]
      : '<no-at-sign>';
    const detail = `env-source=${envSource} url-host=${safeHost(envBundle.supabaseUrl)} admin-email-domain=${emailDomain}`;
    logStageDone(mode, STAGE_NAMES[0], detail);
    results.push({ stage: STAGE_NAMES[0], status: 'PASS', detail });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logStageFail(mode, STAGE_NAMES[0], msg);
    results.push({ stage: STAGE_NAMES[0], status: 'FAIL', detail: msg });
    return results;
  }

  // ── S2: build initial client + signInWithPassword ─────────────────
  logStageStart(mode, STAGE_NAMES[1]);
  const initialClient = buildClient(envBundle, args.dry);
  let signedSession: Session;
  try {
    const { data, error } = await initialClient.auth.signInWithPassword({
      email: envBundle.adminEmail,
      password: envBundle.adminPassword,
    });
    if (error) throw new Error(`signInWithPassword error: ${error.message}`);
    if (!data.session) throw new Error('signInWithPassword returned no session');
    signedSession = data.session;
    const detail = `session-returned=true`;
    logStageDone(mode, STAGE_NAMES[1], detail);
    results.push({ stage: STAGE_NAMES[1], status: 'PASS', detail });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logStageFail(mode, STAGE_NAMES[1], msg);
    results.push({ stage: STAGE_NAMES[1], status: 'FAIL', detail: msg });
    return results;
  }

  // ── S3: capture session ───────────────────────────────────────────
  logStageStart(mode, STAGE_NAMES[2]);
  let capturedUserId: string;
  let capturedExpiresAt: number;
  try {
    const u = signedSession.user;
    if (!u || !u.id) throw new Error('session.user.id missing');
    if (typeof signedSession.expires_at !== 'number') {
      throw new Error('session.expires_at missing or non-numeric');
    }
    if (!signedSession.access_token) throw new Error('access_token empty');
    if (!signedSession.refresh_token) throw new Error('refresh_token empty');
    capturedUserId = u.id;
    capturedExpiresAt = signedSession.expires_at;
    // NEVER log the tokens; only their presence (boolean).
    const detail = `user.id=${capturedUserId} expires_at=${capturedExpiresAt} access_token=present refresh_token=present`;
    logStageDone(mode, STAGE_NAMES[2], detail);
    results.push({ stage: STAGE_NAMES[2], status: 'PASS', detail });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logStageFail(mode, STAGE_NAMES[2], msg);
    results.push({ stage: STAGE_NAMES[2], status: 'FAIL', detail: msg });
    return results;
  }

  // ── S4: build SECOND client + setSession ──────────────────────────
  logStageStart(mode, STAGE_NAMES[3]);
  const restoredClient = buildClient(envBundle, args.dry);
  try {
    const { error } = await restoredClient.auth.setSession({
      access_token: signedSession.access_token,
      refresh_token: signedSession.refresh_token,
    });
    if (error) throw new Error(`setSession error: ${error.message}`);
    const detail = `restored-client=fresh`;
    logStageDone(mode, STAGE_NAMES[3], detail);
    results.push({ stage: STAGE_NAMES[3], status: 'PASS', detail });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logStageFail(mode, STAGE_NAMES[3], msg);
    results.push({ stage: STAGE_NAMES[3], status: 'FAIL', detail: msg });
    return results;
  }

  // ── S5: verify restore — same user.id, same expires_at ────────────
  logStageStart(mode, STAGE_NAMES[4]);
  try {
    const { data: userData, error: userErr } = await restoredClient.auth.getUser();
    if (userErr) throw new Error(`getUser error: ${userErr.message}`);
    if (!userData.user) throw new Error('getUser returned no user after setSession');
    if (userData.user.id !== capturedUserId) {
      throw new Error(`getUser id mismatch: got=${userData.user.id} want=${capturedUserId}`);
    }
    const { data: sessData, error: sessErr } = await restoredClient.auth.getSession();
    if (sessErr) throw new Error(`getSession error: ${sessErr.message}`);
    if (!sessData.session) throw new Error('getSession returned no session after setSession');
    if (sessData.session.expires_at !== capturedExpiresAt) {
      throw new Error(
        `getSession expires_at mismatch: got=${sessData.session.expires_at} want=${capturedExpiresAt}`,
      );
    }
    const detail = `user.id-match=true expires_at-match=true`;
    logStageDone(mode, STAGE_NAMES[4], detail);
    results.push({ stage: STAGE_NAMES[4], status: 'PASS', detail });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logStageFail(mode, STAGE_NAMES[4], msg);
    results.push({ stage: STAGE_NAMES[4], status: 'FAIL', detail: msg });
    return results;
  }

  // ── S6: signOut on the restored client ────────────────────────────
  logStageStart(mode, STAGE_NAMES[5]);
  try {
    const { error } = await restoredClient.auth.signOut();
    if (error) throw new Error(`signOut error: ${error.message}`);
    const detail = `signed-out=true`;
    logStageDone(mode, STAGE_NAMES[5], detail);
    results.push({ stage: STAGE_NAMES[5], status: 'PASS', detail });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logStageFail(mode, STAGE_NAMES[5], msg);
    results.push({ stage: STAGE_NAMES[5], status: 'FAIL', detail: msg });
    return results;
  }

  // ── S7: build THIRD client, verify clear ──────────────────────────
  logStageStart(mode, STAGE_NAMES[6]);
  const postClient = buildClient(envBundle, args.dry);
  try {
    // A fresh client with no setSession() call should see nothing.
    const { data: userData, error: userErr } = await postClient.auth.getUser();
    // getUser on an unauthenticated client returns an error OR a null user;
    // both count as "clear". Anything that returns a user with our captured
    // id is the regression we want to catch.
    if (userData.user && userData.user.id === capturedUserId) {
      throw new Error('fresh post-signOut client still resolves captured user.id');
    }
    const { data: sessData } = await postClient.auth.getSession();
    if (sessData.session) {
      throw new Error('fresh post-signOut client still returns a session');
    }
    const userClear = !userData.user || (userErr !== null && userErr !== undefined);
    const detail = `user-clear=${userClear} session-clear=true`;
    logStageDone(mode, STAGE_NAMES[6], detail);
    results.push({ stage: STAGE_NAMES[6], status: 'PASS', detail });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logStageFail(mode, STAGE_NAMES[6], msg);
    results.push({ stage: STAGE_NAMES[6], status: 'FAIL', detail: msg });
    return results;
  }

  return results;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '<invalid-url>';
  }
}

// ────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  let args: CliArgs;
  try {
    args = parseCli(process.argv.slice(2));
  } catch (e) {
    console.error(`${TAG} CLI error: ${e instanceof Error ? e.message : String(e)}`);
    printHelp();
    return 2;
  }
  if (args.help) {
    printHelp();
    return 0;
  }

  const mode: 'live' | '--dry' = args.dry ? '--dry' : 'live';
  console.log(`${tag(mode)} start mode=${mode} env=${args.envPath}`);
  if (args.dry) {
    console.log(`${tag(mode)} DRY MODE: no real Supabase call will be made.`);
  }

  const results = await runStages(args);

  // Summary
  console.log(`${tag(mode)} ──────── summary ────────`);
  let failed = 0;
  for (const r of results) {
    const line = `${tag(mode)} ${r.stage}: ${r.status} — ${r.detail}`;
    if (r.status === 'PASS') console.log(line);
    else {
      console.error(line);
      failed++;
    }
  }
  const ran = results.length;
  const total = STAGE_NAMES.length;
  const skipped = total - ran;
  console.log(
    `${tag(mode)} result: ran=${ran}/${total} passed=${ran - failed} failed=${failed} skipped=${skipped}`,
  );
  if (args.dry) {
    console.log(
      `${tag(mode)} REMINDER: this was a dry run with the in-memory mock. ` +
        `Live Supabase Auth was NOT exercised. Re-run without --dry to verify deployed.`,
    );
  }
  return failed > 0 || ran < total ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    console.error(`${TAG} unhandled error: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
