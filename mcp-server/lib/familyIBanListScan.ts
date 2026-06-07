/**
 * MCP-SERVER-010-FAMILY-I — Doctrine ban-list scan for Family I response packets.
 *
 * Scans every string field in a validated Family I response for tokens
 * banned by `mcp-server/lib/doctrineBanList.ts` AND for Family I-specific
 * TOPOLOGY-VERDICT tokens (per design §A.3.3 D6 BINDING). Returns ok or the
 * specific failing path. Used by `classifyArgumentBooleanObservations.ts`
 * AFTER schema validation and BEFORE returning to the client.
 *
 * Fields scanned:
 *   - every evidenceSpan string (6 max — one per Family I rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * NOT scanned: nodeId, schemaVersion, checkedRawKeys entries, confidence
 * band values — these are constrained by the validator to non-prose
 * symbol sets.
 *
 * EXTENSION: this Family I scanner uses the shared DOCTRINE_BAN_PATTERNS
 * AND ADDS Family I-specific patterns (FAMILY_I_BAN_PATTERNS) per design
 * §A.3.3 D6 BINDING. The Family I-specific extensions are scoped to THIS
 * file only; the shared DOCTRINE_BAN_PATTERNS constant in
 * doctrineBanList.ts remains byte-equal preserved (I adds its OWN scan;
 * HALT 5 guard).
 *
 * The shared DOCTRINE_BAN_PATTERNS already covers: winner, loser, correct,
 * incorrect, truth, untrue, dishonest, liar, manipulative, extremist,
 * propagandist, stupid, idiot, verdict, bad faith, proof of. So the
 * truth/winner/person tokens are already caught; I adds the topology-verdict
 * tokens NOT already covered.
 *
 * Family I-specific tokens (D6 BINDING — 8 patterns total, the SMALLEST
 * family-local list of any family because the doctrine surface is the
 * smallest):
 *
 *   Single-word patterns (5):
 *     - 'off-topic' / 'offtopic' — the canonical introduces_new_issue verdict drift
 *     - 'derail' (+ 'derailing') — "derailing the thread"; motive/quality verdict on a topology move
 *     - 'evasive' (+ 'evading' / 'evade') — speaker-motive verdict
 *     - 'rehash' (+ 'rehashing') — the returns_to_prior_issue verdict drift
 *     - 'repetitive' — the returns_to_prior_issue verdict drift ("going in circles")
 *
 *   Compound phrases (3):
 *     - 'going in circles' — the canonical returns_to_prior_issue verdict compound
 *     - 'changing the subject' — the introduces_new_issue motive-verdict compound
 *     - 'beating a dead horse' — the returns_to_prior_issue motive-verdict compound
 *
 * Why Family-I-scoped and not shared:
 *   - 'off-topic' / 'derail*' / 'evasive' / 'rehash*' / 'repetitive' are NOT
 *     promoted to the shared DOCTRINE_BAN_PATTERNS because they can
 *     legitimately appear in OTHER families' descriptive evidence_spans
 *     (e.g., a Family A evidence_span quoting a move's own text). Scoping
 *     them to Family I's scan keeps A-H outputs working while existentially
 *     blocking the I failure mode. This is the exact precedent set by F
 *     scoping invalidates/refutes/wrong, G scoping won/lost/ahead/behind,
 *     and H scoping weak/sloppy/lazy to their own scans, rather than the
 *     shared list.
 *   - 'winner'/'loser'/'correct'/'incorrect'/'truth' are already shared, so
 *     I does NOT re-add them (the F/G/H precedent keeps the I list to the
 *     NOT-already-covered tokens).
 *   - Boundary strategy mirrors FAMILY_F/G/H_BAN_PATTERNS:
 *     `(?:^|[^a-z0-9])TOKEN(?:[^a-z0-9]|$)` for single tokens (recognises
 *     word AND snake_case breaks), `[\s_-]+` for phrase separators. The
 *     `derail\w*` / `evasive|evad\w*` / `rehash\w*` forms catch the verb
 *     inflections ('derailing', 'evading'/'evade', 'rehashing') with one
 *     pattern each; the strict boundary form ensures a benign word like
 *     'topical' does NOT match 'off-topic' and bare 'circle' does NOT match
 *     the 'going in circles' phrase.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — server never emits verdict tokens.
 *   - cdiscourse-doctrine §3 — popularity / virality of an external source
 *     is never treated as evidence.
 *   - cdiscourse-doctrine §10a — thread-topology relations are descriptive
 *     structural observations; never verdicts on the move or speaker.
 */
import type { McpBooleanObservationValidatedResponse } from './mcpBooleanObservationSchemaMirror.ts';
import { DOCTRINE_BAN_PATTERNS } from './doctrineBanList.ts';

/**
 * Family I-specific ban-list patterns per design §A.3.3 D6 BINDING.
 *
 * Token boundary strategy mirrors the shared DOCTRINE_BAN_PATTERNS:
 *   - `(?:^|[^a-z0-9])` and `(?:[^a-z0-9]|$)` recognise word breaks AND
 *     snake_case boundaries (since JS `\b` treats `_` as a word char).
 *   - `off[\s_-]?topic` matches 'off-topic', 'off topic', 'off_topic', and
 *     'offtopic' (the optional separator).
 *   - `derail\w*` catches 'derail' AND 'derailing' / 'derailment'.
 *   - `evasive` and `evad\w*` together catch 'evasive', 'evading', 'evade'.
 *   - `rehash\w*` catches 'rehash' AND 'rehashing'.
 *   - Phrases use `[\s_-]+` to match across space / underscore / hyphen
 *     separators.
 */
export const FAMILY_I_BAN_PATTERNS: readonly RegExp[] = Object.freeze([
  // ── Topology-verdict single tokens (design §A.3.3; 5) ──
  /(?:^|[^a-z0-9])off[\s_-]?topic(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])derail\w*(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])(?:evasive|evad\w*)(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])rehash\w*(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])repetitive(?:[^a-z0-9]|$)/i,

  // ── Topology-verdict compound phrases (design §A.3.3; 3) ──
  /(?:^|[^a-z0-9])going[\s_-]+in[\s_-]+circles(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])changing[\s_-]+the[\s_-]+subject(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])beating[\s_-]+a[\s_-]+dead[\s_-]+horse(?:[^a-z0-9]|$)/i,
]);

export type FamilyIBanListScanResult =
  | { ok: true }
  | { ok: false; path: string };

/**
 * Scan the validated response for doctrine ban-list hits. Runs the shared
 * patterns first, then the Family I-specific extensions. Returns ok=true
 * on clean output, or ok=false with the failing path on first match.
 */
export function scanFamilyIBooleanResponseForBanList(
  response: McpBooleanObservationValidatedResponse,
): FamilyIBanListScanResult {
  // Combined pattern list: shared first, then Family I-specific.
  const allPatterns: readonly RegExp[] = [
    ...DOCTRINE_BAN_PATTERNS,
    ...FAMILY_I_BAN_PATTERNS,
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
