/**
 * MCP-SERVER-009-FAMILY-H — Doctrine ban-list scan for Family H response packets.
 *
 * Scans every string field in a validated Family H response for tokens
 * banned by `mcp-server/lib/doctrineBanList.ts` AND for Family H-specific
 * CLARITY-VERDICT tokens (per design §A.3.3 D5 BINDING + operator Stage
 * 2B ban-list extension). Returns ok or the specific failing path. Used
 * by `classifyArgumentBooleanObservations.ts` AFTER schema validation
 * and BEFORE returning to the client.
 *
 * Fields scanned:
 *   - every evidenceSpan string (12 max — one per Family H rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * NOT scanned: nodeId, schemaVersion, checkedRawKeys entries, confidence
 * band values — these are constrained by the validator to non-prose
 * symbol sets.
 *
 * EXTENSION: this Family H scanner uses the shared DOCTRINE_BAN_PATTERNS
 * AND ADDS Family H-specific patterns (FAMILY_H_BAN_PATTERNS) per design
 * §A.3.3 D5 BINDING. The Family H-specific extensions are scoped to THIS
 * file only; the shared DOCTRINE_BAN_PATTERNS constant in
 * doctrineBanList.ts remains byte-equal preserved (H adds its OWN scan;
 * HALT 5 guard).
 *
 * The shared DOCTRINE_BAN_PATTERNS already covers: winner, loser, correct,
 * incorrect, truth, untrue, dishonest, liar, manipulative, extremist,
 * propagandist, stupid, idiot, verdict, bad faith, proof of. So
 * winner/loser/correct/incorrect/truth are already caught; H adds the
 * clarity-quality verdict tokens NOT already covered.
 *
 * Family H-specific tokens (D5 BINDING — 17 patterns total):
 *
 *   Single-word tokens (9):
 *     - 'weak'         — "claim is weak" / "weak argument" is the canonical H verdict
 *     - 'sloppy'       — "sloppy reasoning" / "sloppy writing" — clarity verdict
 *     - 'lazy'         — "lazy argument" / "lazy claim" — speaker label
 *     - 'careless'     — "careless writing" — speaker label
 *     - 'confused'     — "confused argument" / "confused speaker" — speaker-mental-state label
 *     - 'unsound'      — "unsound argument" — argument-quality verdict
 *     - 'unsupported'  — "unsupported claim" — the `reason_missing` verdict drift; canonical
 *     - 'incoherent'   — "incoherent argument" — argument-quality verdict
 *     - 'illogical'    — "illogical argument" — argument-quality verdict
 *
 *   Compound phrases (8):
 *     - 'bad reasoning'           — quality verdict on reasoning
 *     - 'bad argument'            — canonical clarity verdict compound
 *     - 'bad writing'             — speaker-skill verdict
 *     - 'argument is incomplete'  — `conclusion_missing` verdict drift; canonical
 *     - 'argument is unsupported' — `reason_missing` verdict drift; canonical
 *     - 'argument is weak'        — quality verdict; canonical
 *     - 'claim fails'             — claim-as-failed verdict
 *     - 'claim is wrong'          — truth-verdict compound (shared catches 'incorrect' not 'wrong')
 *
 * Why Family-H-scoped and not shared:
 *   - 'weak' / 'sloppy' / 'lazy' / 'unsupported' / 'unsound' are NOT promoted
 *     to the shared DOCTRINE_BAN_PATTERNS because they can legitimately
 *     appear in OTHER families' descriptive evidence_spans (e.g., a Family D
 *     evidence_span quoting a source like "the bridge had a weak foundation"
 *     is descriptive history, not a debate verdict; a Family B 'weak' could
 *     quote a stance label). Scoping them to Family H's scan keeps A-G
 *     outputs working while existentially blocking the H failure mode. This
 *     is the exact precedent set by F scoping invalidates/refutes/wrong to
 *     its own scan, and G scoping won/lost/ahead/behind to its own scan,
 *     rather than the shared list.
 *   - 'wrong' is added to H's scan (matching G's operator extension) —
 *     operator binding records that bare 'wrong' is the canonical clarity-
 *     truth verdict and H needs it explicitly. Note F also has its own
 *     'wrong' scan; H adds it again because H's scan is independent of F's
 *     (the wrong-canonical-verdict shows up across families).
 *   - 'winner'/'loser'/'correct'/'incorrect'/'truth' are already shared, so
 *     H does NOT re-add them (they would double-match harmlessly, but the
 *     F/G precedent keeps the H list to the NOT-already-covered tokens).
 *   - Boundary strategy is byte-identical to FAMILY_F_BAN_PATTERNS and
 *     FAMILY_G_BAN_PATTERNS: `(?:^|[^a-z0-9])TOKEN(?:[^a-z0-9]|$)` for
 *     single tokens (recognises word AND snake_case breaks), `[\s_-]+` for
 *     phrase separators. This ensures 'wonderful' does NOT match anything,
 *     'weakly'/'weakened' do NOT match 'weak' (suffix continues into alpha
 *     → no boundary; the strict boundary form is the binding choice
 *     mirroring G; if a future smoke surfaces a 'weakly'-shaped doctrine
 *     leak, the operator can amend).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — server never emits verdict tokens.
 *   - cdiscourse-doctrine §4 — AI moderator must not assign truth value.
 *   - cdiscourse-doctrine §10a — claim-clarity states are descriptive
 *     structural observations; never quality verdicts on the move or speaker.
 */
import type { McpBooleanObservationValidatedResponse } from './mcpBooleanObservationSchemaMirror.ts';
import { DOCTRINE_BAN_PATTERNS } from './doctrineBanList.ts';

/**
 * Family H-specific ban-list patterns per design §A.3.3 D5 BINDING.
 *
 * Token boundary strategy mirrors the shared DOCTRINE_BAN_PATTERNS:
 *   - `(?:^|[^a-z0-9])` and `(?:[^a-z0-9]|$)` recognise word breaks AND
 *     snake_case boundaries (since JS `\b` treats `_` as a word char).
 *   - Phrases use `[\s_-]+` to match across space / underscore / hyphen
 *     separators (e.g., 'argument is incomplete', 'argument_is_incomplete').
 */
export const FAMILY_H_BAN_PATTERNS: readonly RegExp[] = Object.freeze([
  // ── Clarity-verdict single tokens (design §A.3.3; 9) ──
  /(?:^|[^a-z0-9])weak(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])sloppy(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])lazy(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])careless(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])confused(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])unsound(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])unsupported(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])incoherent(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])illogical(?:[^a-z0-9]|$)/i,

  // ── Clarity-verdict compound phrases (design §A.3.3; 8) ──
  /(?:^|[^a-z0-9])bad[\s_-]+reasoning(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])bad[\s_-]+argument(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])bad[\s_-]+writing(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])argument[\s_-]+is[\s_-]+incomplete(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])argument[\s_-]+is[\s_-]+unsupported(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])argument[\s_-]+is[\s_-]+weak(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])claim[\s_-]+fails(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])claim[\s_-]+is[\s_-]+wrong(?:[^a-z0-9]|$)/i,
]);

export type FamilyHBanListScanResult =
  | { ok: true }
  | { ok: false; path: string };

/**
 * Scan the validated response for doctrine ban-list hits. Runs the shared
 * patterns first, then the Family H-specific extensions. Returns ok=true
 * on clean output, or ok=false with the failing path on first match.
 */
export function scanFamilyHBooleanResponseForBanList(
  response: McpBooleanObservationValidatedResponse,
): FamilyHBanListScanResult {
  // Combined pattern list: shared first, then Family H-specific.
  const allPatterns: readonly RegExp[] = [
    ...DOCTRINE_BAN_PATTERNS,
    ...FAMILY_H_BAN_PATTERNS,
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
