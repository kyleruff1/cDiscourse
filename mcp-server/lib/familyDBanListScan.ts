/**
 * MCP-SERVER-005-FAMILY-D — Doctrine ban-list scan for Family D response packets.
 *
 * Scans every string field in a validated Family D response for tokens
 * banned by `mcp-server/lib/doctrineBanList.ts`. Returns ok or the
 * specific failing path. Used by `classifyArgumentBooleanObservations.ts`
 * AFTER schema validation and BEFORE returning to the client.
 *
 * Fields scanned:
 *   - every evidenceSpan string (19 max — one per Family D Subset rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * NOT scanned: nodeId, schemaVersion, checkedRawKeys entries, confidence
 * band values — these are constrained by the validator to non-prose
 * symbol sets.
 *
 * Reuses the shared DOCTRINE_BAN_PATTERNS constant (no Family-D-specific
 * patterns added in this card per design §4.4; future-card hook documented
 * for adding Family-D-scoped patterns if real-corpus reveals novel framing).
 * Adding `weak` / `dishonest` / `manipulative` to the global ban-list
 * would risk false positives in other families (e.g., Family B's
 * disputes_credibility might legitimately contain `manipulative` in an
 * evidenceSpan describing the parent's framing) — the per-key doctrine
 * tests in `familyDDoctrineFixtures.test.ts` cover the Family-D-specific
 * risks at the fixture boundary.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — server never emits verdict tokens.
 *   - cdiscourse-doctrine §4 — AI moderator must not assign truth value.
 *   - cdiscourse-doctrine §3 — popularity / repetition / engagement is
 *     NOT evidence; the model-response ban-list blocks verdict tokens,
 *     and `evidence_gap_present` enforces the anti-amplification anchor
 *     in the prompt itself.
 */
import type { McpBooleanObservationValidatedResponse } from './mcpBooleanObservationSchemaMirror.ts';
import { DOCTRINE_BAN_PATTERNS } from './doctrineBanList.ts';
import { banScanMatches } from './banScanNormalize.ts';

export type FamilyDBanListScanResult =
  | { ok: true }
  | { ok: false; path: string };

/**
 * Scan the validated response for doctrine ban-list hits. Returns
 * ok=true on clean output, or ok=false with the failing path on first match.
 */
export function scanFamilyDBooleanResponseForBanList(
  response: McpBooleanObservationValidatedResponse,
): FamilyDBanListScanResult {
  // Scan every evidenceSpan string via the shared raw-OR-normalized matcher
  // (OPS-MCP-BAN-SCAN-NORMALIZATION). DOCTRINE_BAN_PATTERNS is byte-unchanged.
  for (const [rawKey, span] of Object.entries(response.evidenceSpan)) {
    if (typeof span !== 'string') continue;
    if (banScanMatches(span, DOCTRINE_BAN_PATTERNS)) {
      return { ok: false, path: `evidenceSpan.${rawKey}` };
    }
  }

  // Scan modelInfo.serverName.
  if (banScanMatches(response.modelInfo.serverName, DOCTRINE_BAN_PATTERNS)) {
    return { ok: false, path: 'modelInfo.serverName' };
  }

  // Scan modelInfo.classifierSetVersion.
  if (banScanMatches(response.modelInfo.classifierSetVersion, DOCTRINE_BAN_PATTERNS)) {
    return { ok: false, path: 'modelInfo.classifierSetVersion' };
  }

  return { ok: true };
}
