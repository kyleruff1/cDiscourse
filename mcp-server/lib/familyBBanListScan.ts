/**
 * MCP-SERVER-003-FAMILY-B — Doctrine ban-list scan for Family B response packets.
 *
 * Scans every string field in a validated Family B response for tokens
 * banned by `mcp-server/lib/doctrineBanList.ts`. Returns ok or the
 * specific failing path. Used by `classifyArgumentBooleanObservations.ts`
 * AFTER schema validation and BEFORE returning to the client.
 *
 * Fields scanned:
 *   - every evidenceSpan string (14 max — one per Family B rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * NOT scanned: nodeId, schemaVersion, checkedRawKeys entries, confidence
 * band values — these are constrained by the validator to non-prose
 * symbol sets.
 *
 * Reuses the shared DOCTRINE_BAN_PATTERNS constant (no Family-B-specific
 * patterns added in this card; future-card hook documented in design §5.4).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — server never emits verdict tokens.
 *   - cdiscourse-doctrine §4 — AI moderator must not assign truth value.
 */
import type { McpBooleanObservationValidatedResponse } from './mcpBooleanObservationSchemaMirror.ts';
import { DOCTRINE_BAN_PATTERNS } from './doctrineBanList.ts';

export type FamilyBBanListScanResult =
  | { ok: true }
  | { ok: false; path: string };

/**
 * Scan the validated response for doctrine ban-list hits. Returns
 * ok=true on clean output, or ok=false with the failing path on first match.
 */
export function scanFamilyBBooleanResponseForBanList(
  response: McpBooleanObservationValidatedResponse,
): FamilyBBanListScanResult {
  // Scan every evidenceSpan string.
  for (const [rawKey, span] of Object.entries(response.evidenceSpan)) {
    if (typeof span !== 'string') continue;
    for (const pattern of DOCTRINE_BAN_PATTERNS) {
      if (pattern.test(span)) {
        return { ok: false, path: `evidenceSpan.${rawKey}` };
      }
    }
  }

  // Scan modelInfo.serverName.
  for (const pattern of DOCTRINE_BAN_PATTERNS) {
    if (pattern.test(response.modelInfo.serverName)) {
      return { ok: false, path: 'modelInfo.serverName' };
    }
  }

  // Scan modelInfo.classifierSetVersion.
  for (const pattern of DOCTRINE_BAN_PATTERNS) {
    if (pattern.test(response.modelInfo.classifierSetVersion)) {
      return { ok: false, path: 'modelInfo.classifierSetVersion' };
    }
  }

  return { ok: true };
}
