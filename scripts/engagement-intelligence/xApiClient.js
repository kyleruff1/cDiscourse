/**
 * Minimal X API client used by the live collectors. DISABLED BY DEFAULT.
 *
 * - Refuses to issue any request unless `ENGAGEMENT_INTEL_ENABLE_X_API=true`
 *   AND a bearer token is present.
 * - All errors are scrubbed of bearer/header content before being surfaced.
 * - No browser automation. No unofficial endpoints. Official API only.
 *
 * CommonJS / pure module — the actual `fetch` is the only side effect, and it
 * is gated by `assertLiveAllowed`.
 */
const { loadEngagementEnv } = require('./loadEngagementEnv');

const X_API_BASE = 'https://api.x.com/2';

class XApiDisabledError extends Error {
  constructor(reason) {
    super(`X API disabled: ${reason}. Set ENGAGEMENT_INTEL_ENABLE_X_API=true and provide X_BEARER_TOKEN to enable.`);
    this.name = 'XApiDisabledError';
    this.reason = reason;
  }
}

function assertLiveAllowed() {
  const env = loadEngagementEnv();
  if (!env.enableXApi) throw new XApiDisabledError('env_flag_off');
  if (!env.hasXBearer) throw new XApiDisabledError('bearer_token_missing');
  return env;
}

function scrubError(err) {
  const msg = String((err && err.message) || err || 'unknown');
  return msg
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer <redacted>')
    .replace(/(authorization|x-auth-token|x-api-key)\s*[:=]\s*\S+/gi, '$1: <redacted>');
}

async function xApiFetch(endpoint, { query = {}, timeoutMs = 15000 } = {}) {
  assertLiveAllowed();
  const url = new URL(`${X_API_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.X_BEARER_TOKEN || ''}`,
        'User-Agent': 'cdiscourse-engagement-intelligence/0.1 (compliant pilot)',
      },
      signal: controller.signal,
    });
    if (res.status === 429) {
      const reset = res.headers.get('x-rate-limit-reset');
      throw new Error(`rate_limited; x-rate-limit-reset=${reset || 'unknown'}`);
    }
    if (!res.ok) {
      // Read minimal info; do not include headers / token in the message.
      const text = await res.text().catch(() => '');
      throw new Error(`x_api_status_${res.status}; body_preview=${String(text).slice(0, 200)}`);
    }
    return await res.json();
  } catch (err) {
    throw new Error(scrubError(err));
  } finally {
    clearTimeout(t);
  }
}

module.exports = {
  X_API_BASE,
  XApiDisabledError,
  assertLiveAllowed,
  scrubError,
  xApiFetch,
};
