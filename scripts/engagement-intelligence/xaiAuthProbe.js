#!/usr/bin/env node
/**
 * Stage 6.1.3.2a — xAI auth reality check.
 *
 * Fail-closed probe that tells the operator EXACTLY one thing per run:
 * "is the xAI inference API reachable from this machine, and under what
 * authentication conditions?" It does not classify anything. It does not
 * send user / public-X text. It does not log keys, bearer tokens, headers,
 * or response bodies.
 *
 * Default mode is dry — no network. Live probing requires explicit flags.
 *
 * Modes:
 *   (no flags)                       dry env snapshot only, exit 0
 *   --probe-live                     auth probe; refuses if key is missing
 *   --probe-live --probe-missing-key explicit no-key probe; expects 401/403,
 *                                    treats 200 as a security anomaly
 *
 * The probe targets a HARMLESS read-only listing endpoint
 * (`GET /v1/models`). It never sends a prompt, classification payload, or
 * any user text. The body of the response is discarded; only the status
 * code and a sanitized category land in stdout.
 */
const fs = require('node:fs');
const path = require('node:path');

const XAI_BASE = 'https://api.x.ai';
const AUTH_PATH = '/v1/models';

// ── Argument parsing ───────────────────────────────────────────

function parseArgs(argv) {
  const args = { probeLive: false, probeMissingKey: false };
  for (const a of (argv || []).slice(2)) {
    if (a === '--probe-live') args.probeLive = true;
    else if (a === '--probe-missing-key') args.probeMissingKey = true;
  }
  return args;
}

// ── Env loading (no value printing) ────────────────────────────

const ENV_FILE = path.join(process.cwd(), '.env.engagement-intelligence');

function parseDotEnv(text) {
  const out = {};
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

/**
 * Returns ONLY booleans + a safe model name. Never returns secret values.
 */
function safeEnvSnapshot() {
  const fileExists = fs.existsSync(ENV_FILE);
  const parsed = fileExists ? parseDotEnv(fs.readFileSync(ENV_FILE, 'utf8')) : {};
  // process.env wins so CI can override.
  const merged = { ...parsed, ...process.env };
  const has = (k) => Boolean(merged[k] && String(merged[k]).length > 0);
  // The model name itself is safe metadata — but only if it does NOT look
  // like a secret string. Be paranoid: reject anything that contains the
  // classic prefixes we know are sensitive.
  const rawModel = String(merged.XAI_MODEL || '').trim();
  const looksLikeSecret = /(^|[^a-z])(sk-|xai-|sb_|eyJ|bearer)/i.test(rawModel) || rawModel.length > 80;
  const modelName = !rawModel ? null : looksLikeSecret ? '<rejected:not-a-model-name>' : rawModel;
  return {
    envFileExists: fileExists,
    hasXaiKey: has('XAI_API_KEY'),
    enableXai: String(merged.ENGAGEMENT_INTEL_ENABLE_XAI || '').toLowerCase() === 'true',
    modelName,
  };
}

// ── Sanitizer for any string we might log ──────────────────────

const SUPABASE_SECRET_PATTERN = new RegExp(`${['sb', 'secret'].join('_')}_[A-Za-z0-9_-]+`, 'gi');
const ANTHROPIC_SK_ANT = new RegExp(`${['sk', 'ant'].join('-')}-[A-Za-z0-9_-]+`, 'gi');
const XAI_KEY_RE = /xai-[A-Za-z0-9_-]+/gi;
const SK_GENERIC = /sk-[A-Za-z0-9_-]{16,}/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._-]{8,}/gi;
const AUTH_HEADER_RE = /(authorization|x-api-key|x-auth-token)\s*[:=]\s*\S+/gi;

function sanitize(text) {
  let s = String(text || '');
  s = s.replace(SUPABASE_SECRET_PATTERN, '[redacted]');
  s = s.replace(ANTHROPIC_SK_ANT, '[redacted]');
  s = s.replace(XAI_KEY_RE, '[redacted]');
  s = s.replace(SK_GENERIC, '[redacted]');
  s = s.replace(JWT_RE, '[redacted]');
  s = s.replace(BEARER_RE, 'Bearer [redacted]');
  s = s.replace(AUTH_HEADER_RE, '$1: [redacted]');
  return s;
}

// ── Network probe (single GET, body discarded) ─────────────────

/**
 * `useAuth=true`  → send Authorization: Bearer <key> (key never logged).
 * `useAuth=false` → send NO Authorization header (the "no-key" probe).
 *
 * Returns ONLY: { status, category, transportErrorCategory? }. The response
 * body is never read, parsed, or returned.
 */
async function probeAuth({ useAuth, keyFromEnv }) {
  const url = `${XAI_BASE}${AUTH_PATH}`;
  const headers = { 'User-Agent': 'cdiscourse-xai-auth-probe/0.1' };
  if (useAuth) {
    if (!keyFromEnv) throw new Error('useAuth requested but no key provided');
    headers.Authorization = `Bearer ${keyFromEnv}`;
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
    // We deliberately do NOT read res.text() / res.json(). Some responses can
    // echo a request id that includes auth fragments; we want zero risk of
    // accidentally writing one to disk.
    try { if (typeof res.body?.cancel === 'function') res.body.cancel(); } catch { /* ignore */ }
    const status = res.status;
    let category;
    if (status === 200) category = useAuth ? 'auth_ok' : 'unexpected_unauthenticated_access';
    else if (status === 401) category = 'auth_required_401';
    else if (status === 403) category = 'auth_required_403';
    else if (status === 404) category = 'endpoint_unknown_404';
    else if (status === 429) category = 'rate_limited_429';
    else if (status >= 500) category = 'upstream_5xx';
    else category = `other_${status}`;
    return { status, category };
  } catch (err) {
    // Network / DNS / timeout. Sanitize aggressively before anyone sees it.
    const msg = sanitize(err && (err.cause?.code || err.code || err.message) || 'unknown_error');
    let transportErrorCategory = 'unknown_transport_error';
    if (/abort/i.test(msg)) transportErrorCategory = 'timeout';
    else if (/enotfound|getaddrinfo|dns/i.test(msg)) transportErrorCategory = 'dns_failure';
    else if (/econnrefused|econnreset|epipe/i.test(msg)) transportErrorCategory = 'connection_refused_or_reset';
    else if (/cert|ssl|tls/i.test(msg)) transportErrorCategory = 'tls_error';
    return { status: 0, category: 'transport_error', transportErrorCategory };
  } finally {
    clearTimeout(t);
  }
}

// ── Main entry ─────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const snapshot = safeEnvSnapshot();

  // Step 1: always print the safe snapshot.
  console.log('[xai-auth-probe] mode=' + (args.probeLive ? 'live' : 'dry'));
  console.log('[xai-auth-probe] env: ' + JSON.stringify({
    envFileExists: snapshot.envFileExists,
    hasXaiKey: snapshot.hasXaiKey,
    enableXai: snapshot.enableXai,
    modelName: snapshot.modelName,
  }));

  if (!args.probeLive) {
    console.log('[xai-auth-probe] dry auth probe only; no network');
    return 0;
  }

  // ── Live path. Read the key from .env file or process env. NEVER log it. ──
  let keyFromEnv = process.env.XAI_API_KEY;
  if (!keyFromEnv && snapshot.envFileExists) {
    const parsed = parseDotEnv(fs.readFileSync(ENV_FILE, 'utf8'));
    if (parsed.XAI_API_KEY) keyFromEnv = parsed.XAI_API_KEY;
  }
  const hasKey = Boolean(keyFromEnv && keyFromEnv.length > 0);

  if (!hasKey && !args.probeMissingKey) {
    console.log('[xai-auth-probe] refusing: XAI_API_KEY is missing and --probe-missing-key was not passed');
    console.log('[xai-auth-probe] result: ' + JSON.stringify({ ran: false, reason: 'no_key_no_explicit_flag' }));
    return 0;
  }

  console.log(`[xai-auth-probe] performing one GET ${AUTH_PATH} (no prompt, no body read) authMode=${hasKey ? 'with-key' : 'no-key'}`);
  const result = await probeAuth({ useAuth: hasKey, keyFromEnv: hasKey ? keyFromEnv : null });

  // Safety: 200 without a key is a security anomaly. Surface loudly.
  if (result.category === 'unexpected_unauthenticated_access') {
    console.error('[xai-auth-probe] ALERT: status=200 with NO Authorization header. This contradicts xAI auth requirements.');
    console.error('[xai-auth-probe] result: ' + JSON.stringify(result));
    return 2;
  }

  console.log('[xai-auth-probe] result: ' + JSON.stringify(result));
  return 0;
}

if (require.main === module) {
  main().then((code) => process.exit(code || 0)).catch((err) => {
    console.error('[xai-auth-probe] fatal: ' + sanitize(err && err.message));
    process.exit(99);
  });
}

module.exports = {
  parseArgs,
  parseDotEnv,
  safeEnvSnapshot,
  sanitize,
  probeAuth,
  XAI_BASE,
  AUTH_PATH,
};
