/**
 * RESEED-001 — redactor (license + secrets leak fence).
 *
 * Applied to ANY string bound for a committed file / the Markdown report.
 * Strips:
 *   - raw source-host URLs (args.me, debate.org, idebate.org — full URLs AND
 *     bare hosts) — CC-BY attribution URLs must live ONLY in the gitignored
 *     bank, never in a committed file.
 *   - `sk-ant-*` (Anthropic keys)
 *   - `sb_secret_*` (Supabase service-role-shaped secrets)
 *   - JWT-shape (`eyJ...`)
 *   - `Bearer <token>`
 *   - `Authorization: <value>` headers
 *   - email addresses
 *
 * CommonJS / pure.
 */

// Order matters: host/URL scrubs first, then key/token, then email.
const SOURCE_URL_RE =
  /https?:\/\/(?:www\.)?(?:args\.me|debate\.org|idebate\.org)[^\s"'<>)\]]*/gi;
const SOURCE_HOST_BARE_RE = /\b(?:www\.)?(?:args\.me|debate\.org|idebate\.org)\b/gi;
const ANTHROPIC_KEY_RE = /sk-ant-[A-Za-z0-9_-]+/gi;
const SUPABASE_SECRET_RE = /sb_secret_[A-Za-z0-9_-]+/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._-]+/gi;
const AUTH_HEADER_RE = /(authorization)\s*[:=]\s*\S+/gi;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function redact(text) {
  let s = String(text == null ? '' : text);
  s = s.replace(SOURCE_URL_RE, '[source-url-redacted]');
  s = s.replace(SOURCE_HOST_BARE_RE, '[source-host-redacted]');
  s = s.replace(ANTHROPIC_KEY_RE, '[redacted]');
  s = s.replace(SUPABASE_SECRET_RE, '[redacted]');
  s = s.replace(JWT_RE, '[redacted]');
  s = s.replace(BEARER_RE, 'Bearer [redacted]');
  s = s.replace(AUTH_HEADER_RE, '$1: [redacted]');
  s = s.replace(EMAIL_RE, '[email-redacted]');
  return s;
}

module.exports = {
  redact,
  SOURCE_URL_RE,
  SOURCE_HOST_BARE_RE,
};
