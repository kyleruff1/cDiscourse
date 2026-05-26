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
 * Word-boundary matching keeps neutral words ("hottake" inside a reason code
 * like "playable_hot_take") clear. Tokens that legitimately appear in a
 * structural reason code (e.g. "satire", "popularity") are NOT banned — only
 * verdict / person / truth language.
 */
export const DOCTRINE_BAN_PATTERNS: readonly RegExp[] = Object.freeze([
  /\bwinner\b/i,
  /\bloser\b/i,
  /\bcorrect\b/i,
  /\bincorrect\b/i,
  /\btruth\b/i,
  /\buntrue\b/i,
  /\bdishonest\b/i,
  /\bliar\b/i,
  /\bbad[\s_-]+faith\b/i,
  /\bmanipulative\b/i,
  /\bextremist\b/i,
  /\bpropagandist\b/i,
  /\bstupid\b/i,
  /\bidiot\b/i,
  /\bverdict\b/i,
  /\bproof[\s_-]*of\b/i,
]);
