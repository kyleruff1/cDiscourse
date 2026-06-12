/**
 * MCP-SERVER-004-FAMILY-C — Doctrine ban-list scan for Family C response packets.
 *
 * Scans every string field in a validated Family C response for tokens
 * banned by `mcp-server/lib/doctrineBanList.ts`. Returns ok or the
 * specific failing path. Used by `classifyArgumentBooleanObservations.ts`
 * AFTER schema validation and BEFORE returning to the client.
 *
 * Fields scanned:
 *   - every evidenceSpan string (17 max — one per Family C rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * NOT scanned: nodeId, schemaVersion, checkedRawKeys entries, confidence
 * band values — these are constrained by the validator to non-prose
 * symbol sets.
 *
 * Reuses the shared DOCTRINE_BAN_PATTERNS constant (no Family-C-specific
 * patterns added in this card; future-card hook documented in design §4
 * Future-card hook).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — server never emits verdict tokens.
 *   - cdiscourse-doctrine §4 — AI moderator must not assign truth value.
 */
import type { McpBooleanObservationValidatedResponse } from './mcpBooleanObservationSchemaMirror.ts';
import { DOCTRINE_BAN_PATTERNS } from './doctrineBanList.ts';
import { banScanMatches } from './banScanNormalize.ts';

export type FamilyCBanListScanResult =
  | { ok: true }
  | { ok: false; path: string };

/**
 * Scan the validated response for doctrine ban-list hits. Returns
 * ok=true on clean output, or ok=false with the failing path on first match.
 */
export function scanFamilyCBooleanResponseForBanList(
  response: McpBooleanObservationValidatedResponse,
): FamilyCBanListScanResult {
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
