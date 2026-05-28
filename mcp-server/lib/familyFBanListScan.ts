/**
 * MCP-SERVER-007-FAMILY-F — Doctrine ban-list scan for Family F response packets.
 *
 * Scans every string field in a validated Family F response for tokens
 * banned by `mcp-server/lib/doctrineBanList.ts` AND for Family F-specific
 * CRITICAL-QUESTION verdict tokens (per intent §4 D5 BINDING). Returns ok
 * or the specific failing path. Used by `classifyArgumentBooleanObservations.ts`
 * AFTER schema validation and BEFORE returning to the client.
 *
 * Fields scanned:
 *   - every evidenceSpan string (14 max — one per Family F rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * NOT scanned: nodeId, schemaVersion, checkedRawKeys entries, confidence
 * band values — these are constrained by the validator to non-prose
 * symbol sets.
 *
 * EXTENSION: this Family F scanner uses the shared DOCTRINE_BAN_PATTERNS
 * AND ADDS Family F-specific patterns (FAMILY_F_BAN_PATTERNS) per
 * intent §4 D5 BINDING. The Family F-specific extensions are scoped to
 * THIS file only; the shared DOCTRINE_BAN_PATTERNS constant in
 * doctrineBanList.ts remains byte-equal preserved.
 *
 * Family F-specific tokens (D5 BINDING — 12 patterns):
 *   - CQ-specific compound phrases (4):
 *     - 'unmet-means-fallacy' (the existential CQ-as-verdict framing)
 *     - 'proves wrong' (CQ-as-refutation framing)
 *     - 'invalidates' (CQ-as-refutation framing)
 *     - 'refutes' (CQ-as-refutation framing)
 *   - Single-token verdict framings (defense-in-depth at F layer; Family E
 *     already scans these on its OWN responses, but a cross-family request
 *     that misroutes through F would bypass Family E's scanner):
 *     - 'fallacy'
 *     - 'fallacious'
 *     - 'flawed'
 *     - 'wrong'
 *   - Two-word phrases:
 *     - 'weak argument'
 *     - 'invalid argument'
 *     - 'bad reasoning'
 *     - 'proof of'
 *
 * Why Family-F-scoped and not shared:
 *   - 'invalidates' and 'refutes' may legitimately appear in Family B
 *     disputes_validity evidenceSpans ('the inference invalidates the
 *     parent's claim' — used descriptively, not as a CQ verdict). Promoting
 *     them to the shared list would break Family A/B/C/D outputs.
 *   - 'invalid' (standalone) is NOT in Family F's list — Family E scans it
 *     on E's own responses. F scans only 'invalid argument' as a two-word
 *     phrase, mirroring the more permissive CQ context where 'invalid' may
 *     occur in legitimate descriptive senses.
 *   - The Family F doctrine binding is existential at the CQ-as-verdict axis.
 *     This scanner is the runtime enforcement for the F-specific failure mode.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — server never emits verdict tokens.
 *   - cdiscourse-doctrine §4 — AI moderator must not assign truth value.
 *   - cdiscourse-doctrine §10a — CQs are descriptive structural probes;
 *     never adjudications.
 */
import type { McpBooleanObservationValidatedResponse } from './mcpBooleanObservationSchemaMirror.ts';
import { DOCTRINE_BAN_PATTERNS } from './doctrineBanList.ts';

/**
 * Family F-specific ban-list patterns per intent §4 D5 BINDING.
 *
 * Token boundary strategy mirrors the shared DOCTRINE_BAN_PATTERNS:
 *   - `(^|[^a-z0-9])` and `([^a-z0-9]|$)` recognise word breaks AND
 *     snake_case boundaries (since JS `\b` treats `_` as a word char).
 *   - Two-word phrases use `[\s_-]+` to match across space / underscore
 *     / hyphen separators (e.g., 'weak argument', 'weak_argument').
 *   - The CQ-specific compound 'unmet-means-fallacy' uses `[\s_-]+`
 *     for both internal separators.
 */
export const FAMILY_F_BAN_PATTERNS: readonly RegExp[] = Object.freeze([
  // D5 BINDING token list — CQ-as-verdict framings unique to Family F.
  // The CQ-specific compound phrase 'unmet-means-fallacy' captures the
  // exact failure mode the intent §6 trigger #17 enumerates.
  /(?:^|[^a-z0-9])unmet[\s_-]+means[\s_-]+fallacy(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])proves[\s_-]+wrong(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])invalidates(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])refutes(?:[^a-z0-9]|$)/i,

  // Single-token verdict framings (Family E precedent set; replicated for
  // defense-in-depth at the F layer — Family E already scans these on its
  // OWN responses, but a cross-family request that misroutes through F
  // would bypass Family E's scanner. Per intent §4 D5: scan at Family F.).
  /(?:^|[^a-z0-9])fallacy(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])fallacious(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])flawed(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])wrong(?:[^a-z0-9]|$)/i,

  // Two-word phrases.
  /(?:^|[^a-z0-9])weak[\s_-]+argument(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])invalid[\s_-]+argument(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])bad[\s_-]+reasoning(?:[^a-z0-9]|$)/i,
  // 'proof of' also exists in shared DOCTRINE_BAN_PATTERNS; we keep it here
  // for defense-in-depth. If a future refactor of the shared list ever
  // drops it, the Family F scan still catches it.
  /(?:^|[^a-z0-9])proof[\s_-]*of(?:[^a-z0-9]|$)/i,
]);

export type FamilyFBanListScanResult =
  | { ok: true }
  | { ok: false; path: string };

/**
 * Scan the validated response for doctrine ban-list hits. Runs the shared
 * patterns first, then the Family F-specific extensions. Returns ok=true
 * on clean output, or ok=false with the failing path on first match.
 */
export function scanFamilyFBooleanResponseForBanList(
  response: McpBooleanObservationValidatedResponse,
): FamilyFBanListScanResult {
  // Combined pattern list: shared first, then Family F-specific.
  const allPatterns: readonly RegExp[] = [
    ...DOCTRINE_BAN_PATTERNS,
    ...FAMILY_F_BAN_PATTERNS,
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
