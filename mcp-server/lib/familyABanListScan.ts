/**
 * MCP-SERVER-002 — Doctrine ban-list scan for Family A response packets.
 *
 * Scans every string field in a validated Family A response for tokens
 * banned by `mcp-server/lib/doctrineBanList.ts`. Returns ok or the
 * specific failing path. Used by `classifyArgumentBooleanObservations.ts`
 * AFTER schema validation and BEFORE returning to the client.
 *
 * Fields scanned:
 *   - every evidenceSpan string (16 max — one per rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * NOT scanned: nodeId, schemaVersion, checkedRawKeys entries, confidence
 * band values — these are constrained by the validator to non-prose
 * symbol sets.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — server never emits verdict tokens.
 *   - cdiscourse-doctrine §4 — AI moderator must not assign truth value.
 */
import type { McpBooleanObservationValidatedResponse } from './mcpBooleanObservationSchemaMirror.ts';
import { DOCTRINE_BAN_PATTERNS } from './doctrineBanList.ts';

export type FamilyABanListScanResult =
  | { ok: true }
  | { ok: false; path: string };

/**
 * Scan the validated response for doctrine ban-list hits. Returns
 * ok=true on clean output, or ok=false with the failing path on first match.
 */
export function scanFamilyABooleanResponseForBanList(
  response: McpBooleanObservationValidatedResponse,
): FamilyABanListScanResult {
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
