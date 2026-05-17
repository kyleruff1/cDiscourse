/**
 * Stage 6.1.9 — xAI source redactor.
 *
 * Strips raw X identifiers, secrets, and abusive raw text from any string
 * before it leaves the harvester or enters a committed artifact.
 *
 * Pure CommonJS. No network. No filesystem.
 *
 * Contract:
 *   - @handles (1–15 chars) → `<x-handle>`
 *   - x.com / twitter.com / t.co URLs (with or without scheme) → `<x-link>`
 *   - raw 15–20 digit post-id-like strings → `<x-id>`
 *   - emails → `<email>`
 *   - JWT-shape → `[redacted]`
 *   - Bearer tokens / Authorization headers → `Bearer [redacted]` / `Authorization: [redacted]`
 *   - sk-ant-… / xai-… / sb_secret_… → `[redacted]`
 *   - control characters → stripped
 *
 * Abuse handling:
 *   - The redactor never rewrites slurs / threats / doxxing inline. The
 *     CALLER must run `classifyAbuseRisk()` first; if it returns `high`,
 *     the body is reduced to a category placeholder and the original is
 *     discarded. The redactor only strips identifiers + secrets.
 */
const SECRET_REPLACERS = [
  [/sk-ant-[A-Za-z0-9_-]+/gi, '[redacted]'],
  [/xai-[A-Za-z0-9_-]+/gi, '[redacted]'],
  [/sb_secret_[A-Za-z0-9_-]+/gi, '[redacted]'],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, '[redacted]'],
  [/eyJ[A-Za-z0-9_-]{20,}/g, '[redacted]'],
  [/Authorization\s*:\s*Bearer\s+\S+/gi, 'Authorization: [redacted]'],
  [/Authorization\s*:\s*\S+/gi, 'Authorization: [redacted]'],
  [/Bearer\s+[A-Za-z0-9._-]{8,}/g, 'Bearer [redacted]'],
];

const X_IDENTIFIER_REPLACERS = [
  // Scheme-bearing URLs first so the bare-host pass doesn't double-replace.
  [/https?:\/\/(?:x|twitter)\.com\/[^\s)]+/gi, '<x-link>'],
  [/https?:\/\/t\.co\/[^\s)]+/gi, '<x-link>'],
  // Bare-host fallback.
  [/\b(?:x|twitter)\.com\/[^\s)]+/gi, '<x-link>'],
  [/\bt\.co\/[^\s)]+/gi, '<x-link>'],
  // X handles (1–15 alphanumerics + underscore, per X policy).
  [/@([A-Za-z0-9_]{1,15})\b/g, '<x-handle>'],
  // Raw post-id-like 15–20 digit strings appearing standalone.
  [/\b\d{15,20}\b/g, '<x-id>'],
  // Email-like.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>'],
];

function stripControlChars(s) {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Run redaction over an arbitrary string. Safe to call on log lines,
 * report copy, fixture bodies, and provider response text.
 */
function redactRaw(input) {
  if (input == null) return '';
  let s = String(input);
  for (const [re, sub] of SECRET_REPLACERS) s = s.replace(re, sub);
  for (const [re, sub] of X_IDENTIFIER_REPLACERS) s = s.replace(re, sub);
  s = stripControlChars(s);
  return s.trim();
}

// ── Abuse classification ────────────────────────────────────────

// All lexemes are placeholders that name CATEGORIES of harmful text.
// They do not enumerate slurs themselves. The classifier flags categories
// and the caller decides whether to retain the body, redact it to a
// placeholder, or drop it entirely.

const SLUR_HEURISTIC_TOKENS = ['slur', '[slur]', '[slur-redacted]', '<slur>'];
const THREAT_LEXEMES = [
  'kill yourself', 'go die', 'i will hurt you', "i'll hurt you",
  "you'll die", 'you will die', 'should be killed', 'wish you were dead',
  'threat:', '<threat>',
];
const DOXX_LEXEMES = [
  'home address', 'phone number is', 'lives at ', 'doxx', '<doxx>',
];
const SEXUALIZED_ABUSE_LEXEMES = [
  '<sexual-abuse>', '[sexual-abuse]',
];
const PROTECTED_CLASS_ATTACK_LEXEMES = [
  '<protected-class-attack>', '[protected-class-attack]',
];

function hasAny(text, list) {
  const lc = String(text || '').toLowerCase();
  return list.some((w) => lc.includes(w.toLowerCase()));
}

function classifyAbuseRisk(input) {
  const s = String(input || '');
  if (!s.trim()) return { level: 'none', categories: [] };
  const categories = [];
  if (hasAny(s, THREAT_LEXEMES)) categories.push('threat');
  if (hasAny(s, DOXX_LEXEMES)) categories.push('doxx');
  if (hasAny(s, SEXUALIZED_ABUSE_LEXEMES)) categories.push('sexualized_abuse');
  if (hasAny(s, PROTECTED_CLASS_ATTACK_LEXEMES)) categories.push('protected_class_attack');
  if (hasAny(s, SLUR_HEURISTIC_TOKENS)) categories.push('slur_marker');
  // Pure-insult heuristic: short body that contains no claim language.
  const trimmed = s.trim();
  const noClaimVerbs = !/\b(because|so|therefore|prove|source|quote|evidence|axis|scope|definition|cause|reason)\b/i.test(trimmed);
  const allCapsRatio = (trimmed.replace(/[^A-Z]/g, '').length / Math.max(1, trimmed.length));
  const isShort = trimmed.length < 80;
  const looksRanty = noClaimVerbs && isShort && allCapsRatio > 0.25;
  if (looksRanty) categories.push('rant_only');

  let level = 'none';
  if (categories.includes('threat') || categories.includes('doxx')
      || categories.includes('sexualized_abuse')
      || categories.includes('protected_class_attack')) {
    level = 'high';
  } else if (categories.includes('slur_marker')) {
    level = 'medium';
  } else if (categories.includes('rant_only')) {
    level = 'low';
  }
  return { level, categories };
}

/**
 * Convert a raw reply body into the "playable skeleton" the corpus runner
 * can use. The original abusive text is NEVER returned when level === 'high'.
 */
function convertHostileBody(rawBody) {
  const cleaned = redactRaw(rawBody);
  const risk = classifyAbuseRisk(cleaned);
  if (risk.level === 'high') {
    return {
      kept: false,
      level: risk.level,
      categories: risk.categories,
      placeholder: '[redacted: high-risk source text — original discarded; argument skeleton not playable]',
      bodyForAnnotation: '',
    };
  }
  if (risk.level === 'medium') {
    return {
      kept: false,
      level: risk.level,
      categories: risk.categories,
      placeholder: '[redacted: medium-risk source text; convert to source-chain or quote-anchor demand instead]',
      bodyForAnnotation: '',
    };
  }
  return {
    kept: true,
    level: risk.level,
    categories: risk.categories,
    placeholder: null,
    bodyForAnnotation: cleaned,
  };
}

module.exports = {
  redactRaw,
  classifyAbuseRisk,
  convertHostileBody,
  SECRET_REPLACERS,
  X_IDENTIFIER_REPLACERS,
};
