/**
 * OPS-MCP-KEY-LEVEL-FAIL-CLOSED — shared dispatcher helper for key-level
 * fail-closed with span-omission semantics.
 *
 * Replaces the packet-level death penalty (an entire response packet failing
 * the moment ONE evidenceSpan trips the doctrine ban-scan) with a KEY-LEVEL
 * death: the unclean key is OMITTED — it never returns and never persists its
 * span — while the clean sibling keys (independently verified clean against the
 * SAME byte-unchanged ban-list) survive.
 *
 * This module RELAXES NOTHING about what is banned. The ban-scan patterns are
 * byte-unchanged; every span is still scanned against the full ban-list; no
 * unclean span ever reaches the wire, the Edge, the database, or the client.
 * It only changes the CONSEQUENCE of a hit (key omitted vs. packet failed) and
 * acts as the deterministic server-side BACKSTOP for the model-side
 * narrow-the-span-or-set-false instruction.
 *
 * GATE-A amendment (collector placement): the unclean-key collector is a SHARED
 * helper in the dispatcher layer, parameterized by the family's own pattern
 * set. `findUncleanEvidenceSpanKeys(spans, patterns)` receives the SAME pattern
 * set the family's `banListScan` provider uses, so the drop decision and the
 * whole-packet scan can never diverge. A per-family `FamilyProviders` collector
 * field was REJECTED (it duplicates wiring per family for identical logic).
 *
 * Scope decision (J-only enablement on a shared mechanism): the mechanism is
 * family-agnostic, but key-level drop is ENABLED initially for Family J
 * (`sensitive_composer`) ONLY — `KEY_LEVEL_FAIL_CLOSED_FAMILIES`. J is
 * admin-validation-only (`productionEnabled:false`), so enabling key-level drop
 * for J has ZERO production blast radius. Widening to A–I (production-enabled)
 * is a separate, production-touching follow-up gated by its own
 * cdiscourse-doctrine §10a + production review.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — omission ASSERTS NOTHING; coerce-to-false (which
 *     would fabricate a negative finding the model never made) is rejected. No
 *     verdict token is emitted. The per-key drop is fail-CLOSED validation at
 *     the key scope.
 *   - cdiscourse-doctrine §3 — popularity / satire still earn no standing; a
 *     drop never grants standing.
 *   - cdiscourse-doctrine §10a — a clean sibling Observation remains a true
 *     structural observation of the move's own text and is not tainted by a
 *     sibling key's unclean span; the unclean key is omitted (no Observation
 *     made), never coerced into a fabricated one. Sensitive-composer keys stay
 *     composer-only.
 */
import type { McpBooleanObservationValidatedResponse } from './mcpBooleanObservationSchemaMirror.ts';
import { DOCTRINE_BAN_PATTERNS } from './doctrineBanList.ts';
import { FAMILY_J_BAN_PATTERNS } from './familyJBanListScan.ts';

/**
 * The family set for which an unclean evidenceSpan key is dropped by OMISSION
 * rather than failing the whole packet. Family J (`sensitive_composer`) only on
 * first ship — it is admin-validation-only, so this has zero production blast
 * radius. Widening is a separate review-gated follow-up.
 */
export const KEY_LEVEL_FAIL_CLOSED_FAMILIES: ReadonlySet<string> = new Set([
  'sensitive_composer',
]);

/**
 * The combined ban-pattern set for a key-level-fail-closed family — the SAME
 * `[...DOCTRINE_BAN_PATTERNS, ...FAMILY_J_BAN_PATTERNS]` stack that
 * `scanFamilyJBooleanResponseForBanList` builds internally, so the per-key drop
 * decision and the whole-packet scan are constructed from the identical two
 * byte-unchanged exported constants and can never diverge. Returns `null` for a
 * family not in `KEY_LEVEL_FAIL_CLOSED_FAMILIES`.
 */
export function banPatternsForKeyLevelFamily(family: string): readonly RegExp[] | null {
  if (family === 'sensitive_composer') {
    return [...DOCTRINE_BAN_PATTERNS, ...FAMILY_J_BAN_PATTERNS];
  }
  return null;
}

/**
 * Collect ALL evidenceSpan rawKeys whose span string matches any pattern in the
 * supplied set. The collector is span-content-based and value-agnostic: a key
 * whose observation value is `false` but whose span is nonetheless unclean is
 * still collected (defensive). Returns a SORTED, de-duplicated rawKey-name list
 * (never span content). Null spans never match.
 */
export function findUncleanEvidenceSpanKeys(
  spans: Readonly<Record<string, string | null>>,
  patterns: readonly RegExp[],
): string[] {
  const dirty: string[] = [];
  for (const [rawKey, span] of Object.entries(spans)) {
    if (typeof span !== 'string') continue;
    for (const pattern of patterns) {
      if (pattern.test(span)) {
        dirty.push(rawKey);
        break;
      }
    }
  }
  return dirty.sort();
}

/** A validated response that additionally names the omitted unclean keys. */
export type KeptResponseWithDroppedKeys = McpBooleanObservationValidatedResponse & {
  readonly keysDroppedForUncleanSpan: readonly string[];
};

/**
 * Build the `kept` response with every key in `droppedKeys` removed from
 * `observations` / `confidence` / `evidenceSpan` AND `checkedRawKeys`, and the
 * omitted key names recorded (sorted) in `keysDroppedForUncleanSpan`. Returns a
 * NEW object; never mutates the input.
 *
 * Internal-consistency invariant on the result (the anti-resurrection
 * invariant): `checkedRawKeys` == the surviving (cleanly-assessed) keys;
 * `keysDroppedForUncleanSpan` == the omitted keys; the two sets are disjoint
 * and their union is the model's originally-checked set. The schema validator's
 * key-set coordination holds on the result by construction.
 *
 * When `droppedKeys` is empty, the result is byte-identical to the input plus
 * an empty `keysDroppedForUncleanSpan` (the caller does not invoke this on the
 * zero-drop path — a fully clean packet is returned untouched).
 */
export function dropUncleanEvidenceSpanKeys(
  response: McpBooleanObservationValidatedResponse,
  droppedKeys: readonly string[],
): KeptResponseWithDroppedKeys {
  const dropSet = new Set(droppedKeys);

  const observations: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(response.observations)) {
    if (!dropSet.has(k)) observations[k] = v;
  }
  const confidence: Record<string, 'low' | 'medium' | 'high'> = {};
  for (const [k, v] of Object.entries(response.confidence)) {
    if (!dropSet.has(k)) confidence[k] = v;
  }
  const evidenceSpan: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(response.evidenceSpan)) {
    if (!dropSet.has(k)) evidenceSpan[k] = v;
  }
  const checkedRawKeys = response.checkedRawKeys.filter((k) => !dropSet.has(k));

  return {
    schemaVersion: response.schemaVersion,
    nodeId: response.nodeId,
    checkedRawKeys,
    observations,
    confidence,
    evidenceSpan,
    modelInfo: { ...response.modelInfo },
    keysDroppedForUncleanSpan: [...droppedKeys].sort(),
  };
}
