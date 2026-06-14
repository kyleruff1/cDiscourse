/**
 * EMAIL-TRANSPORT-001 — pure email-safety utilities (Lane B / product email).
 *
 * Defense-in-depth, no I/O. These are imported by both the template render
 * layer and the orchestrator (`sendTransactionalEmail.ts`) so a banned-copy
 * or hostile-input slip is caught BEFORE any provider call.
 *
 * Doctrine (cdiscourse-doctrine §1 / §9): a transactional email NEVER carries
 * a winner/loser/truth/verdict token, an accusation word, or an internal
 * validation code. `assertNoBannedTokens` is the runtime gate; the
 * `emailCopyDoctrine` test is the static one.
 *
 * Pure module: no Deno.env, no fetch, no secret. Safe to import anywhere on
 * the Edge runtime; carries no provider key by construction.
 */

/**
 * The doctrine ban-list (cdiscourse-doctrine §1 + the invite-specific
 * `challenger` / `opponent`). Any of these appearing in rendered email copy is
 * a hard block. Lower-cased; matching is whole-word, case-insensitive.
 *
 * NOTE on `correct`: the word appears as a SUBSTRING in benign words
 * ("incorrect"). We list both `correct` and `incorrect` and match on word
 * boundaries so the scan flags the standalone tokens, never a coincidental
 * substring inside an unrelated word.
 */
export const EMAIL_BANNED_TOKENS: ReadonlyArray<string> = Object.freeze([
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'truth',
  'verdict',
  'correct',
  'incorrect',
  'untrue',
  'challenger',
  'opponent',
]);

/**
 * Strip HTML tags + control characters and clamp to a maximum length. The
 * single sanitizer used before any user-supplied string (room title, inviter
 * name) is interpolated into a template. Lifts `safeLine` from the shipped
 * `room-notifications` `maybeSendInviteEmail`.
 */
export function sanitizeLine(value: unknown, maxLength = 200): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Escape the five HTML special characters so a sanitized value can be placed
 * inside an HTML text node without injecting markup. Applied AFTER
 * `sanitizeLine` (which already strips tags) as a second layer — a stray `&`
 * or `<` must never reach the rendered HTML un-escaped.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * True iff none of the banned tokens appears (whole-word, case-insensitive) in
 * the supplied text. The orchestrator runs this over the rendered
 * subject+html+text and refuses to send (`blocked_banned_copy`) on a false.
 */
export function assertNoBannedTokens(...parts: Array<string | null | undefined>): boolean {
  const haystack = parts.filter((p): p is string => typeof p === 'string').join('\n').toLowerCase();
  for (const token of EMAIL_BANNED_TOKENS) {
    // Word-boundary match: the token must not be a substring of a larger word.
    // `\b` works for tokens with internal spaces ('bad faith') too.
    const re = new RegExp(`(^|[^a-z0-9])${escapeForRegExp(token)}([^a-z0-9]|$)`, 'i');
    if (re.test(haystack)) return false;
  }
  return true;
}

function escapeForRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The validated, sanitized room context the template render fn consumes. */
export interface SanitizedRoomContext {
  roomTitle: string;
  roomVisibility: 'public' | 'private';
  inviterDisplayName: string | null;
}

/**
 * Neutralize hostile / malformed room context. An empty room title falls back
 * to the neutral phrase "an argument" (mirrors the shipped
 * `maybeSendInviteEmail`); a missing/blank inviter name becomes `null` (the
 * template renders the neutral "Someone"); visibility defaults to `private`
 * (the more conservative copy) on an unrecognized value.
 */
export function sanitizeRoomContext(input: {
  roomTitle?: unknown;
  roomVisibility?: unknown;
  inviterDisplayName?: unknown;
}): SanitizedRoomContext {
  const title = sanitizeLine(input.roomTitle, 200);
  const inviter = sanitizeLine(input.inviterDisplayName, 80);
  const visibility = input.roomVisibility === 'public' ? 'public' : 'private';
  return {
    roomTitle: title.length > 0 ? title : 'an argument',
    roomVisibility: visibility,
    inviterDisplayName: inviter.length > 0 ? inviter : null,
  };
}

/**
 * A minimal email-shape check (presence + single `@` + a dot in the domain).
 * Used only to refuse an empty/garbage recipient before a send — NOT a full
 * RFC validator (the provider does the authoritative validation).
 */
export function isPlausibleEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 6 || trimmed.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
