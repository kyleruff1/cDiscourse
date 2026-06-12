/**
 * MCP-SERVER-011-FAMILY-J — Doctrine ban-list scan for Family J response packets.
 *
 * Scans every string field in a validated Family J response for tokens
 * banned by `mcp-server/lib/doctrineBanList.ts` AND for Family J-specific
 * PERSON-DIRECTED tokens (per design §6 BINDING). Returns ok or the specific
 * failing path. Used by `classifyArgumentBooleanObservations.ts` AFTER schema
 * validation and BEFORE returning to the client.
 *
 * THIS IS THE RUNTIME BACKSTOP for the most sensitive prompt in the system.
 * If a model response slips into characterizing the author (a slur, a
 * person-label, an "ad hominem"/"personal attack" verdict), this scan rejects
 * it (validation_failed / doctrine_ban_list) rather than returning it. The
 * adversarial existential fixture proves it: slur in the INPUT, clean OUTPUT.
 *
 * Fields scanned:
 *   - every evidenceSpan string (5 max — one per Family J rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * NOT scanned: nodeId, schemaVersion, checkedRawKeys entries, confidence
 * band values — these are constrained by the validator to non-prose
 * symbol sets.
 *
 * EXTENSION: this Family J scanner uses the shared DOCTRINE_BAN_PATTERNS
 * AND ADDS Family J-specific patterns (FAMILY_J_BAN_PATTERNS) per design §6
 * BINDING. The Family J-specific extensions are scoped to THIS file only;
 * the shared DOCTRINE_BAN_PATTERNS constant in doctrineBanList.ts remains
 * byte-equal preserved (J adds its OWN scan; HALT 5 guard).
 *
 * The shared DOCTRINE_BAN_PATTERNS already covers: winner, loser, correct,
 * incorrect, truth, untrue, dishonest, liar, manipulative, extremist,
 * propagandist, stupid, idiot, verdict, bad faith, proof of. So the
 * truth/verdict/liar/manipulative/extremist/propagandist/bad-faith tokens are
 * already caught; J adds the person/intent-directed tokens NOT already
 * covered. This is the inverse of I (whose list was the SMALLEST) — J's is
 * the LARGEST family-local list because the person-verdict surface is the
 * biggest.
 *
 * Family J-specific tokens (design §6 BINDING — 18 patterns total; finalized
 * against the antiAmplification.ts FORBIDDEN_USER_LABELS list +
 * moveMetadataLedger.ts _forbiddenMetadataTokens; only the tokens NOT already
 * in the shared list are added):
 *
 *   Single-word person/intent labels (11):
 *     - 'troll'          — the canonical person-label drift; appears in
 *                          antiAmplification FORBIDDEN_USER_LABELS + ledger
 *     - 'bot'            — person-label; STRICT boundary ('robot' does NOT match)
 *     - 'astroturf*'      — astroturf / astroturfer / astroturfing
 *     - 'toxic'          — person/move characterization
 *     - 'hostile'        — person/state characterization
 *     - 'abus*'          — abuse / abusive / abuser
 *     - 'aggressive'     — person/state characterization
 *     - 'uncivil'        — person/conduct characterization
 *     - 'incivility'     — person/conduct characterization
 *     - 'gullible'       — the uses_satire_as_evidence person-label drift
 *     - 'unhinged'       — the needs_pre_send_pause emotional-state drift
 *
 *   Compound phrases (7):
 *     - 'ad hominem'             — the shifts_to_person_or_intent verdict drift
 *     - 'personal attack*'       — 'personal attack' / 'personal attacks' / 'personal attacking'
 *     - 'attack* the person'     — 'attacks the person' / 'attacking the person'
 *     - 'bad actor'             — person-label
 *     - 'name calling'          — 'name calling' / 'name-calling'
 *     - 'fake news'             — the uses_satire_as_evidence truth-verdict drift
 *     - 'losing it'             — the needs_pre_send_pause emotional-state drift
 *
 * Why Family-J-scoped and not shared:
 *   - 'troll' / 'bot' / 'toxic' / 'hostile' / 'aggressive' etc. are NOT
 *     promoted to the shared DOCTRINE_BAN_PATTERNS because they can
 *     legitimately appear in OTHER families' descriptive evidence_spans
 *     (e.g., a Family D evidence_span quoting a source like "the soil was
 *     toxic" is descriptive history, not a person verdict; a Family I
 *     evidence_span could quote 'bot traffic' as a topic). Scoping them to
 *     Family J's scan keeps A-I outputs working while existentially blocking
 *     the J failure mode. This is the exact precedent set by F/G/H/I scoping
 *     their own verdict tokens to their own scans, rather than the shared list.
 *   - 'liar' / 'manipulative' / 'extremist' / 'propagandist' / 'bad faith'
 *     (the antiAmplification labels that overlap the shared list) are NOT
 *     re-added — the shared list already catches them (F/G/H/I precedent:
 *     family lists carry only the NOT-already-covered tokens).
 *   - Boundary strategy mirrors FAMILY_H/I_BAN_PATTERNS:
 *     `(?:^|[^a-z0-9])TOKEN(?:[^a-z0-9]|$)` for single tokens (recognises word
 *     AND snake_case breaks; 'bot' does NOT match 'robot'), `[\s_-]+` for
 *     phrase separators. The `astroturf\w*` / `abus\w*` / `attack\w*` /
 *     `personal[\s_-]+attack\w*` forms catch the inflections ('astroturfer',
 *     'abusive', 'attacking') with one pattern each.
 *
 * CAUTION — the verbatim-quote tension (binding test design, design §6):
 * for shifts_to_person_or_intent, a legitimate evidence_span quotes the
 * move's own person-directed wording (e.g. "because you work for an EV
 * company"). The prompt instructs the model to anchor the STRUCTURAL wording,
 * not the slur — so a clean evidence_span passes, while a model that echoes
 * "you're such a troll" is rejected. The adversarial existential fixture
 * proves exactly this: slur in the INPUT, clean OUTPUT. A FAIL is HALT + revert.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — server never emits verdict tokens.
 *   - cdiscourse-doctrine §3 — popularity / satire never treated as evidence.
 *   - cdiscourse-doctrine §4 — AI moderator must not assign truth value.
 *   - cdiscourse-doctrine §10a — sensitive-composer observations are
 *     descriptive structural observations of the move's own text; never
 *     characterizations of the person or their intent.
 */
import type { McpBooleanObservationValidatedResponse } from './mcpBooleanObservationSchemaMirror.ts';
import { DOCTRINE_BAN_PATTERNS } from './doctrineBanList.ts';
import { banScanMatches } from './banScanNormalize.ts';

/**
 * Family J-specific ban-list patterns per design §6 BINDING.
 *
 * Token boundary strategy mirrors the shared DOCTRINE_BAN_PATTERNS:
 *   - `(?:^|[^a-z0-9])` and `(?:[^a-z0-9]|$)` recognise word breaks AND
 *     snake_case boundaries (since JS `\b` treats `_` as a word char).
 *   - `astroturf\w*` catches 'astroturf' / 'astroturfer' / 'astroturfing'.
 *   - `abus\w*` catches 'abuse' / 'abusive' / 'abuser'.
 *   - `personal[\s_-]+attack\w*` catches 'personal attack' / 'personal attacks'.
 *   - `attack\w*[\s_-]+the[\s_-]+person` catches 'attacks the person' /
 *     'attacking the person'.
 *   - Phrases use `[\s_-]+` to match across space / underscore / hyphen
 *     separators (e.g., 'ad hominem', 'ad-hominem', 'name-calling').
 */
export const FAMILY_J_BAN_PATTERNS: readonly RegExp[] = Object.freeze([
  // ── Person/intent single tokens (design §6; 11) ──
  /(?:^|[^a-z0-9])troll(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])bot(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])astroturf\w*(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])toxic(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])hostile(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])abus\w*(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])aggressive(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])uncivil(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])incivility(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])gullible(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])unhinged(?:[^a-z0-9]|$)/i,

  // ── Person/intent compound phrases (design §6; 7) ──
  /(?:^|[^a-z0-9])ad[\s_-]+hominem(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])personal[\s_-]+attack\w*(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])attack\w*[\s_-]+the[\s_-]+person(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])bad[\s_-]+actor(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])name[\s_-]+calling(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])fake[\s_-]+news(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])losing[\s_-]+it(?:[^a-z0-9]|$)/i,
]);

export type FamilyJBanListScanResult =
  | { ok: true }
  | { ok: false; path: string };

/**
 * Scan the validated response for doctrine ban-list hits. Runs the shared
 * patterns first, then the Family J-specific extensions. Returns ok=true
 * on clean output, or ok=false with the failing path on first match.
 */
export function scanFamilyJBooleanResponseForBanList(
  response: McpBooleanObservationValidatedResponse,
): FamilyJBanListScanResult {
  // Combined pattern list: shared first, then Family J-specific.
  const allPatterns: readonly RegExp[] = [
    ...DOCTRINE_BAN_PATTERNS,
    ...FAMILY_J_BAN_PATTERNS,
  ];

  // Scan every evidenceSpan string via the shared raw-OR-normalized matcher
  // (OPS-MCP-BAN-SCAN-NORMALIZATION). The `allPatterns` stack is byte-unchanged.
  for (const [rawKey, span] of Object.entries(response.evidenceSpan)) {
    if (typeof span !== 'string') continue;
    if (banScanMatches(span, allPatterns)) {
      return { ok: false, path: `evidenceSpan.${rawKey}` };
    }
  }

  // Scan modelInfo.serverName.
  if (banScanMatches(response.modelInfo.serverName, allPatterns)) {
    return { ok: false, path: 'modelInfo.serverName' };
  }

  // Scan modelInfo.classifierSetVersion.
  if (banScanMatches(response.modelInfo.classifierSetVersion, allPatterns)) {
    return { ok: false, path: 'modelInfo.classifierSetVersion' };
  }

  return { ok: true };
}
