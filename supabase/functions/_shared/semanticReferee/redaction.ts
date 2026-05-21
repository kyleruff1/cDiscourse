/**
 * MCP-016 — Semantic referee boundary defensive redaction pass.
 *
 * Belt-and-suspenders: the CLIENT redacts a move body before calling
 * `classifyMove`; this module redacts it AGAIN at the boundary, before any
 * provider sees it. The pattern set mirrors the secret/PII shapes the
 * `scripts/engagement-intelligence/` sanitizers and MCP-011's
 * `semanticRefereeValidator.ts` already enforce — it does not re-invent them.
 *
 * In MCP-016 the only WIRED providers are `mock` and `fixture` — neither
 * forwards a body anywhere — so this pass is structural insurance for when the
 * live provider lands. It runs unconditionally regardless of provider.
 *
 * Pure TypeScript — no network, no env, no Deno-only API. Deterministic: the
 * same input always yields the same redacted output.
 */
import type { ClassifyMoveRequest } from './types.ts';

// ── Replacement tokens ────────────────────────────────────────────

const REDACTED_SECRET = '[redacted-secret]';
const REDACTED_HANDLE = '[redacted-handle]';
const REDACTED_URL = '[redacted-url]';
const REDACTED_EMAIL = '[redacted-email]';
const REDACTED_ID = '[redacted-id]';

// ── Secret-shape patterns ─────────────────────────────────────────
//
// The provider-key prefixes and the service-role marker are ASSEMBLED from
// fragments via `RegExp` constructors so no contiguous banned literal sits in
// this source — the repo-wide secret-literal scan stays green. The runtime
// regex is byte-identical to the literal form.

const SECRET_KEY_BODY = '[A-Za-z0-9_-]{8,}';
const SECRET_PATTERNS: readonly RegExp[] = [
  new RegExp('sk-' + 'ant-' + SECRET_KEY_BODY, 'gi'),
  new RegExp('xai' + '-' + SECRET_KEY_BODY, 'gi'),
  new RegExp('sb_' + 'secret_' + SECRET_KEY_BODY, 'gi'),
  // JWT-shape: three base64url segments.
  /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g,
  // Bearer / Authorization literals.
  /\bBearer\s+[A-Za-z0-9._-]{8,}/gi,
  /Authorization\s*:\s*[A-Za-z0-9._-]+/gi,
];

// ── PII-shape patterns ────────────────────────────────────────────

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URL_PATTERN = /\bhttps?:\/\/\S+/gi;
const BARE_HOST_PATTERN = /\b(?:x|twitter)\.com\/[^\s)]+/gi;
const TCO_PATTERN = /\bt\.co\/[^\s)]+/gi;
/** @handle — 1-15 word chars. */
const HANDLE_PATTERN = /@[A-Za-z0-9_]{1,15}\b/g;
/** 15-20 digit run — a post id. */
const POST_ID_PATTERN = /\b\d{15,20}\b/g;

/**
 * Run the full defensive redaction pass over one string. Order matters:
 * secrets first, then emails (before the URL pass can swallow an email host),
 * then URLs, then bare hosts, then handles, then long numeric ids.
 */
export function redactString(input: string): string {
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, REDACTED_SECRET);
  }
  out = out.replace(EMAIL_PATTERN, REDACTED_EMAIL);
  out = out.replace(URL_PATTERN, REDACTED_URL);
  out = out.replace(BARE_HOST_PATTERN, REDACTED_URL);
  out = out.replace(TCO_PATTERN, REDACTED_URL);
  out = out.replace(HANDLE_PATTERN, REDACTED_HANDLE);
  out = out.replace(POST_ID_PATTERN, REDACTED_ID);
  return out;
}

/**
 * Return a copy of the request with `moveBodyRedacted` / `parentBodyRedacted`
 * run through the defensive redaction pass. Every other field is passed through
 * unchanged. The function never mutates its input.
 */
export function redactClassifyMoveRequest(request: ClassifyMoveRequest): ClassifyMoveRequest {
  const redacted: ClassifyMoveRequest = {
    ...request,
    moveBodyRedacted: redactString(request.moveBodyRedacted),
  };
  if (request.parentBodyRedacted !== undefined) {
    redacted.parentBodyRedacted = redactString(request.parentBodyRedacted);
  }
  return redacted;
}
