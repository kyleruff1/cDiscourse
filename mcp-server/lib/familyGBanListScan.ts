/**
 * MCP-SERVER-008-FAMILY-G — Doctrine ban-list scan for Family G response packets.
 *
 * Scans every string field in a validated Family G response for tokens
 * banned by `mcp-server/lib/doctrineBanList.ts` AND for Family G-specific
 * RESOLUTION-VERDICT tokens (per design §A.3.3 D5 BINDING + operator
 * Stage 2B ban-list extension). Returns ok or the specific failing path.
 * Used by `classifyArgumentBooleanObservations.ts` AFTER schema validation
 * and BEFORE returning to the client.
 *
 * Fields scanned:
 *   - every evidenceSpan string (18 max — one per Family G rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * NOT scanned: nodeId, schemaVersion, checkedRawKeys entries, confidence
 * band values — these are constrained by the validator to non-prose
 * symbol sets.
 *
 * EXTENSION: this Family G scanner uses the shared DOCTRINE_BAN_PATTERNS
 * AND ADDS Family G-specific patterns (FAMILY_G_BAN_PATTERNS) per design
 * §A.3.3 D5 BINDING + the operator Stage 2B ban-list extension. The Family
 * G-specific extensions are scoped to THIS file only; the shared
 * DOCTRINE_BAN_PATTERNS constant in doctrineBanList.ts remains byte-equal
 * preserved (G adds its OWN scan).
 *
 * The shared DOCTRINE_BAN_PATTERNS already covers: winner, loser, correct,
 * incorrect, truth, untrue, dishonest, liar, manipulative, extremist,
 * propagandist, stupid, idiot, verdict, bad faith, proof of. So winner/loser
 * are already caught; G adds the verb/state forms and resolution-verdict
 * compounds NOT already covered.
 *
 * Family G-specific tokens (D5 BINDING + operator extension — 15 patterns):
 *   - Resolution-verdict single tokens (design §A.3.3; 7):
 *     - 'won'         — "X won" is verdict; not shared
 *     - 'lost'        — "X lost" is verdict
 *     - 'defeated'    — verdict
 *     - 'prevailed'   — verdict
 *     - 'capitulated' — verdict (concession-as-surrender)
 *     - 'ahead'       — "X is ahead" is who-is-winning framing
 *     - 'behind'      — "X is behind" is who-is-winning framing
 *   - Resolution-verdict compound phrases (design §A.3.3; 4):
 *     - 'settled in favor'    — adjudication
 *     - 'won the argument'    — the canonical G verdict compound
 *     - 'conceded the loss'   — concession-as-loss framing (existential)
 *     - 'lost the (point|argument|debate)' — loss-of-point framing
 *   - Operator Stage 2B ban-list extension (4; truth-adjacent + verdict):
 *     - 'settled the truth'   — settled-the-truth framing (the shared
 *                               'truth' token already catches the substring,
 *                               but the explicit phrase is added per operator)
 *     - 'proved'              — proof-as-verdict ('proof of' is shared, but
 *                               'proved' is a distinct token)
 *     - 'invalid'             — invalidity-as-verdict (F scoped only
 *                               'invalid argument'; operator requires bare
 *                               'invalid' for G)
 *     - 'wrong'               — wrongness-as-verdict (F scoped 'wrong' to its
 *                               own scan; operator requires it for G too)
 *
 * Why Family-G-scoped and not shared:
 *   - 'won' / 'lost' / 'ahead' / 'behind' are NOT promoted to the shared
 *     DOCTRINE_BAN_PATTERNS because they can legitimately appear in OTHER
 *     families' descriptive evidence_spans (e.g., a Family D evidence_span
 *     "the source notes the bill won committee approval" is descriptive
 *     history, not a debate verdict). Scoping them to Family G's scan keeps
 *     A-F outputs working while existentially blocking the G failure mode.
 *     This is the exact precedent set by F scoping invalidates/refutes/wrong
 *     to its own scan rather than the shared list.
 *   - 'invalid' / 'wrong' / 'proved' are similarly scoped to G (and F's own
 *     scan independently) so A-E descriptive outputs are not over-blocked.
 *   - Boundary strategy is byte-identical to FAMILY_F_BAN_PATTERNS:
 *     `(?:^|[^a-z0-9])TOKEN(?:[^a-z0-9]|$)` for single tokens (recognises
 *     word AND snake_case breaks), `[\s_-]+` for phrase separators. This
 *     ensures 'wonderful' does NOT match 'won', 'behindhand' does NOT match
 *     'behind', 'lostandfound' does NOT match 'lost', 'aheadofschedule' does
 *     NOT match 'ahead'.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — server never emits verdict tokens.
 *   - cdiscourse-doctrine §4 — AI moderator must not assign truth value.
 *   - cdiscourse-doctrine §10a — resolution-progress states are descriptive
 *     structural observations; never adjudications of who won.
 */
import type { McpBooleanObservationValidatedResponse } from './mcpBooleanObservationSchemaMirror.ts';
import { DOCTRINE_BAN_PATTERNS } from './doctrineBanList.ts';

/**
 * Family G-specific ban-list patterns per design §A.3.3 D5 BINDING +
 * operator Stage 2B ban-list extension.
 *
 * Token boundary strategy mirrors the shared DOCTRINE_BAN_PATTERNS:
 *   - `(?:^|[^a-z0-9])` and `(?:[^a-z0-9]|$)` recognise word breaks AND
 *     snake_case boundaries (since JS `\b` treats `_` as a word char).
 *   - Phrases use `[\s_-]+` to match across space / underscore / hyphen
 *     separators (e.g., 'settled in favor', 'settled_in_favor').
 */
export const FAMILY_G_BAN_PATTERNS: readonly RegExp[] = Object.freeze([
  // ── Resolution-verdict single tokens (design §A.3.3; 7) ──
  /(?:^|[^a-z0-9])won(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])lost(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])defeated(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])prevailed(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])capitulated(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])ahead(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])behind(?:[^a-z0-9]|$)/i,

  // ── Resolution-verdict compound phrases (design §A.3.3; 4) ──
  // 'settled in favor' — the design §A.3.3 binding token. The optional
  // intervening possessive (`(?:\w+[\s_'-]+)?`) also catches the natural
  // phrasings "settled in your favor" / "settled in X's favor" /
  // "settled in the pro side's favor", which design §A.4 Fixture E
  // explicitly requires the OUTPUT not to echo ("MUST NOT echo 'settled in
  // favor' / 'in your favor'").
  /(?:^|[^a-z0-9])settled[\s_-]+in[\s_-]+(?:\w+[\s_'-]+)?favor(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])won[\s_-]+the[\s_-]+argument(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])conceded[\s_-]+the[\s_-]+loss(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])lost[\s_-]+the[\s_-]+(?:point|argument|debate)(?:[^a-z0-9]|$)/i,

  // ── Operator Stage 2B ban-list extension (4) ──
  // 'settled the truth' — 'truth' is shared, but the explicit phrase is
  // added per the operator binding for defense-in-depth.
  /(?:^|[^a-z0-9])settled[\s_-]+the[\s_-]+truth(?:[^a-z0-9]|$)/i,
  // 'proved' — distinct from the shared 'proof of'.
  /(?:^|[^a-z0-9])proved(?:[^a-z0-9]|$)/i,
  // 'invalid' — bare token (F scoped only 'invalid argument'; operator
  // requires bare 'invalid' for G). Boundary stops 'invalidates' matching
  // ('invalid' + 'a' is not a boundary).
  /(?:^|[^a-z0-9])invalid(?:[^a-z0-9]|$)/i,
  // 'wrong' — wrongness-as-verdict.
  /(?:^|[^a-z0-9])wrong(?:[^a-z0-9]|$)/i,
]);

export type FamilyGBanListScanResult =
  | { ok: true }
  | { ok: false; path: string };

/**
 * Scan the validated response for doctrine ban-list hits. Runs the shared
 * patterns first, then the Family G-specific extensions. Returns ok=true
 * on clean output, or ok=false with the failing path on first match.
 */
export function scanFamilyGBooleanResponseForBanList(
  response: McpBooleanObservationValidatedResponse,
): FamilyGBanListScanResult {
  // Combined pattern list: shared first, then Family G-specific.
  const allPatterns: readonly RegExp[] = [
    ...DOCTRINE_BAN_PATTERNS,
    ...FAMILY_G_BAN_PATTERNS,
  ];

  // Scan every evidenceSpan string.
  for (const [rawKey, span] of Object.entries(response.evidenceSpan)) {
    if (typeof span !== 'string') continue;
    for (const pattern of allPatterns) {
      if (pattern.test(span)) {
        return { ok: false, path: `evidenceSpan.${rawKey}` };
      }
    }
  }

  // Scan modelInfo.serverName.
  for (const pattern of allPatterns) {
    if (pattern.test(response.modelInfo.serverName)) {
      return { ok: false, path: 'modelInfo.serverName' };
    }
  }

  // Scan modelInfo.classifierSetVersion.
  for (const pattern of allPatterns) {
    if (pattern.test(response.modelInfo.classifierSetVersion)) {
      return { ok: false, path: 'modelInfo.classifierSetVersion' };
    }
  }

  return { ok: true };
}
