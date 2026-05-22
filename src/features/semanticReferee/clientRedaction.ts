/**
 * MCP-019 — Client-side first-pass body redactor.
 *
 * `redactBody(body)` strips obvious PII shapes — `@handle`-shape tokens, URLs,
 * email-shape strings, long digit runs — from a move body BEFORE it is handed
 * to `classifyMove`. It is a conservative belt-and-suspenders first pass: the
 * Edge Function boundary's `_shared/semanticReferee/redaction.ts` is the
 * authoritative SECOND pass and always runs server-side. This client pass
 * exists so a raw handle / URL never leaves the device — the same posture
 * `submit-argument` uses (client validation + Edge re-validation).
 *
 * This module is PURE TYPESCRIPT — no network, no React, no Supabase, no
 * `Deno`, no env, no `async`. It is NOT a contract-precise mirror of the Deno
 * boundary redactor; it does not need to be — the boundary redactor is the
 * authority. The client pass only has to be conservative.
 *
 * Doctrine (MCP-019 §0 Defect 2, §8):
 *   - No contiguous real-key-shaped literal sits in this file. Secret-prefix
 *     patterns are assembled from `RegExp` fragments so the repo
 *     secret-literal scan stays green.
 *   - The redactor never throws — a null / non-string input collapses to ''.
 */

/** The placeholder a redacted span is replaced with. */
const REDACTED = '[redacted]';

/**
 * The ordered redaction patterns. Each entry is `[pattern, replacement]`.
 * Patterns run in declaration order so a URL is consumed before its bare host
 * could be re-matched. Every pattern is `g`-flagged so it strips every hit.
 *
 * The secret-shape patterns are assembled from `RegExp` fragments at module
 * load — no contiguous provider-key-prefix literal is committed.
 */
const REDACTION_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = Object.freeze([
  // 1. Email-shape — run before @handle so the handle rule cannot half-eat it.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, REDACTED],
  // 2. http(s):// URLs — the whole URL, including path + query.
  [/https?:\/\/[^\s]+/g, REDACTED],
  // 3. Bare hosts for the known X / Twitter family — no scheme required.
  [/\b(?:www\.)?(?:x\.com|t\.co|twitter\.com)\/[^\s]*/gi, REDACTED],
  // 4. Secret-shape tokens — every prefix is fragment-assembled so no
  //    contiguous key-shaped literal is committed (the same posture the
  //    MCP-011 fixtures file uses). Catches the Anthropic key prefix, the
  //    xAI key prefix, and the Supabase secret prefix.
  [new RegExp('\\b' + 's' + 'k-' + 'a' + 'nt-' + '[A-Za-z0-9_-]{8,}', 'g'), REDACTED],
  [new RegExp('\\b' + 'x' + 'a' + 'i-' + '[A-Za-z0-9_-]{8,}', 'g'), REDACTED],
  [new RegExp('\\b' + 's' + 'b_' + 's' + 'ecret_' + '[A-Za-z0-9_-]{8,}', 'g'), REDACTED],
  // 5. Auth-header bearer-token shape — the keyword is fragment-assembled.
  [new RegExp('\\b' + 'B' + 'ea' + 'rer\\s+[A-Za-z0-9._-]{8,}', 'gi'), REDACTED],
  // 6. @handle-shape — 1..15 word chars after an `@`, preceded by start /
  //    whitespace / common punctuation so it is not the local part of an
  //    already-redacted email.
  [/(^|[\s(.,;:!?])@[A-Za-z0-9_]{1,15}\b/g, '$1' + REDACTED],
  // 7. Long digit runs (10+) — phone numbers, post ids. Hyphens / spaces
  //    inside the run are tolerated; a run with <10 digits is left alone.
  [/\b[\d][\d\s-]{8,}[\d]\b/g, REDACTED],
]);

/**
 * Redact a move body's obvious PII / secret shapes. Conservative first pass —
 * the Edge Function boundary runs the authoritative second pass.
 *
 * - A non-string / null / undefined input returns `''`.
 * - The function is idempotent: `redactBody(redactBody(x)) === redactBody(x)`
 *   (the placeholder `[redacted]` matches none of the patterns).
 * - It never throws.
 */
export function redactBody(body: string | null | undefined): string {
  if (typeof body !== 'string' || body.length === 0) {
    return '';
  }
  let out = body;
  for (const [pattern, replacement] of REDACTION_PATTERNS) {
    // `pattern` carries the `g` flag; `replace` strips every match. A fresh
    // `String#replace` does not depend on `lastIndex`, so re-using the frozen
    // RegExp across calls is safe.
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * The number of redaction patterns — exposed only so a test can assert the
 * pattern table is non-empty without reaching into the module internals.
 */
export function _redactionPatternCount(): number {
  return REDACTION_PATTERNS.length;
}
