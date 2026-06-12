/**
 * MCP-SERVER-006-FAMILY-E — Doctrine ban-list scan for Family E response packets.
 *
 * Scans every string field in a validated Family E response for tokens
 * banned by `mcp-server/lib/doctrineBanList.ts` AND for Family E-specific
 * verdict tokens (per amendment §3 BINDING). Returns ok or the specific
 * failing path. Used by `classifyArgumentBooleanObservations.ts` AFTER
 * schema validation and BEFORE returning to the client.
 *
 * Fields scanned:
 *   - every evidenceSpan string (16 max — one per Family E rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * NOT scanned: nodeId, schemaVersion, checkedRawKeys entries, confidence
 * band values — these are constrained by the validator to non-prose
 * symbol sets.
 *
 * EXTENSION: this Family E scanner uses the shared DOCTRINE_BAN_PATTERNS
 * AND ADDS Family E-specific patterns (FAMILY_E_BAN_PATTERNS) per
 * amendment §3 BINDING. The Family E-specific extensions are scoped to
 * THIS file only; the shared DOCTRINE_BAN_PATTERNS constant in
 * doctrineBanList.ts remains byte-equal preserved.
 *
 * Family E-specific tokens (amendment §3 BINDING):
 *   - 'fallacy' (the existential doctrine constraint)
 *   - 'fallacious'
 *   - 'invalid' (standalone, e.g. "invalid", "invalid argument")
 *   - 'flawed' (e.g. "flawed", "flawed reasoning")
 *   - 'wrong' (e.g. "wrong", "is wrong")
 *   - 'weak argument' (two-word phrase)
 *   - 'bad reasoning' (two-word phrase)
 *   - 'flawed reasoning' (two-word phrase)
 *   - 'logical error' (two-word phrase)
 *   - 'informal fallacy' (two-word phrase)
 *   - 'proof of' (two-word phrase; also in shared for defense-in-depth)
 *
 * Why Family-E-scoped and not shared:
 *   - 'invalid' may legitimately appear in Family B disputes_validity
 *     evidenceSpans ("the inference is invalid in this case"). Promoting
 *     'invalid' to the shared list would break Family A/B/C/D outputs.
 *   - 'wrong' may legitimately appear in Family C acknowledges_misread
 *     evidenceSpans ("I had you wrong on the scope").
 *   - The Family E doctrine binding is existential: slippery_slope MUST
 *     NOT be labeled a fallacy. This scanner is the runtime enforcement.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — server never emits verdict tokens.
 *   - cdiscourse-doctrine §4 — AI moderator must not assign truth value.
 *   - cdiscourse-doctrine §10a — schemes are descriptive observations;
 *     never adjudications.
 */
import type { McpBooleanObservationValidatedResponse } from './mcpBooleanObservationSchemaMirror.ts';
import { DOCTRINE_BAN_PATTERNS } from './doctrineBanList.ts';
import { banScanMatches } from './banScanNormalize.ts';

/**
 * Family E-specific ban-list patterns per amendment §3 BINDING.
 *
 * Token boundary strategy mirrors the shared DOCTRINE_BAN_PATTERNS:
 *   - `(^|[^a-z0-9])` and `([^a-z0-9]|$)` recognise word breaks AND
 *     snake_case boundaries (since JS `\b` treats `_` as a word char).
 *   - Two-word phrases use `[\s_-]+` to match across space / underscore
 *     / hyphen separators (e.g., "weak argument", "weak_argument").
 */
export const FAMILY_E_BAN_PATTERNS: readonly RegExp[] = Object.freeze([
  // Single-token fallacy framings (existential doctrine constraint).
  /(?:^|[^a-z0-9])fallacy(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])fallacious(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])invalid(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])flawed(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])wrong(?:[^a-z0-9]|$)/i,
  // Two-word phrases.
  /(?:^|[^a-z0-9])weak[\s_-]+argument(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])invalid[\s_-]+argument(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])bad[\s_-]+reasoning(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])flawed[\s_-]+reasoning(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])logical[\s_-]+error(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])informal[\s_-]+fallacy(?:[^a-z0-9]|$)/i,
  // 'proof of' also exists in shared DOCTRINE_BAN_PATTERNS; we keep it here
  // for defense-in-depth. If a future refactor of the shared list ever
  // drops it, the Family E scan still catches it.
  /(?:^|[^a-z0-9])proof[\s_-]*of(?:[^a-z0-9]|$)/i,
]);

export type FamilyEBanListScanResult =
  | { ok: true }
  | { ok: false; path: string };

/**
 * Scan the validated response for doctrine ban-list hits. Runs the shared
 * patterns first, then the Family E-specific extensions. Returns ok=true
 * on clean output, or ok=false with the failing path on first match.
 */
export function scanFamilyEBooleanResponseForBanList(
  response: McpBooleanObservationValidatedResponse,
): FamilyEBanListScanResult {
  // Combined pattern list: shared first, then Family E-specific.
  const allPatterns: readonly RegExp[] = [
    ...DOCTRINE_BAN_PATTERNS,
    ...FAMILY_E_BAN_PATTERNS,
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
