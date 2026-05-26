/**
 * MCP-SERVER-001 — Doctrine ban-list.
 *
 * Pattern set scanned across every string field in a model response packet
 * (every binary's reasonCode + evidenceSpan + parentSpan, route + friction
 * suggestions, modelVersion). A match causes the packet to be rejected with
 * `reason: validation_failed, detail: doctrine_ban_list` — the server NEVER
 * returns a packet that contains verdict / person / truth tokens.
 *
 * This mirrors the patterns the CDiscourse-side `scanPacketContent` enforces.
 * The ban-list is enforced at TWO layers (server + adapter) so any drift on
 * either side still blocks doctrine violations.
 *
 * Matching strategy:
 *   - We use a "boundary" that recognises both word breaks AND snake_case
 *     boundaries. JS regex `\b` treats underscore as a word character, so
 *     plain `\bwinner\b` would MISS `winner_decided` (the most realistic
 *     reason-code shape). We use `(^|[^a-z0-9])` and `([^a-z0-9]|$)` to also
 *     break on `_` / `-` / space.
 *   - Neutral substrings like "hottake" inside `playable_hot_take` remain
 *     clear because the banned tokens are full words ("winner", "loser",
 *     etc.) not fragments.
 */
const TOKEN_BOUNDARY_START = '(^|[^a-z0-9])';
const TOKEN_BOUNDARY_END = '([^a-z0-9]|$)';

function tokenPattern(token: string): RegExp {
  return new RegExp(`${TOKEN_BOUNDARY_START}${token}${TOKEN_BOUNDARY_END}`, 'i');
}

const BANNED_TOKENS: readonly string[] = Object.freeze([
  'winner',
  'loser',
  'correct',
  'incorrect',
  'truth',
  'untrue',
  'dishonest',
  'liar',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'verdict',
]);

export const DOCTRINE_BAN_PATTERNS: readonly RegExp[] = Object.freeze([
  ...BANNED_TOKENS.map((t) => tokenPattern(t)),
  // Two-word phrases — `bad faith`, `proof of`. Match across `_`, `-`, or
  // space separators.
  /(?:^|[^a-z0-9])bad[\s_-]+faith(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])proof[\s_-]*of(?:[^a-z0-9]|$)/i,
]);
