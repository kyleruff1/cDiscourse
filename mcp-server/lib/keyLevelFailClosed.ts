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
 * Scope (OPS-MCP-KEY-LEVEL-FAIL-CLOSED-WIDENING): the mechanism is
 * family-agnostic and key-level drop is now ENABLED for ALL TEN registered
 * families (A–J) via `KEY_LEVEL_FAIL_CLOSED_FAMILIES`. The J-only first ship
 * (PR #576) was live-proven on the admin-validation-only `sensitive_composer`
 * family; this widening lifts that bound to the production families (A–I) after
 * the live proof. Production semantics are IDENTICAL to J's — the only delta
 * for the production families is that an unclean key now dies ALONE (clean
 * siblings survive) instead of failing the whole packet, and the production
 * queue-drainer path persists the drop names on its SUCCESS branch
 * (`finalize_classifier_job` gains an additive `p_dropped_unclean_span_keys`).
 * The §10a doctrine-review merge gate from the J card carries forward.
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
import { banScanMatches } from './banScanNormalize.ts';
import { FAMILY_E_BAN_PATTERNS } from './familyEBanListScan.ts';
import { FAMILY_F_BAN_PATTERNS } from './familyFBanListScan.ts';
import { FAMILY_G_BAN_PATTERNS } from './familyGBanListScan.ts';
import { FAMILY_H_BAN_PATTERNS } from './familyHBanListScan.ts';
import { FAMILY_I_BAN_PATTERNS } from './familyIBanListScan.ts';
import { FAMILY_J_BAN_PATTERNS } from './familyJBanListScan.ts';

/**
 * The family set for which an unclean evidenceSpan key is dropped by OMISSION
 * rather than failing the whole packet.
 *
 * OPS-MCP-KEY-LEVEL-FAIL-CLOSED-WIDENING: extended from J-only to ALL TEN
 * registered families (A–J). The J-only mechanism (PR #576) was live-proven on
 * the admin-validation-only sensitive_composer family with zero production
 * blast radius; this widening lifts that bound to the production families after
 * the live proof. Production semantics are IDENTICAL to J's: every span is
 * still scanned against the byte-unchanged ban-list, no unclean span ever
 * reaches the wire / Edge / database / client, and the change is fail-CLOSED
 * (an unclean key is omitted, never coerced into a fabricated finding). The
 * difference for A–I is purely that an unclean key now dies ALONE (clean
 * siblings survive) instead of killing the whole packet — and that the
 * production queue-drainer path now persists the drop names on its SUCCESS
 * branch (omission + alert-never-gate observability covers production volumes).
 */
export const KEY_LEVEL_FAIL_CLOSED_FAMILIES: ReadonlySet<string> = new Set([
  'parent_relation', // Family A
  'disagreement_axis', // Family B
  'misunderstanding_repair', // Family C
  'evidence_source_chain', // Family D
  'argument_scheme', // Family E
  'critical_question', // Family F
  'resolution_progress', // Family G
  'claim_clarity', // Family H
  'thread_topology', // Family I
  'sensitive_composer', // Family J
]);

/**
 * The combined ban-pattern set for a key-level-fail-closed family — the SAME
 * stack the family's `scanFamily<X>BooleanResponseForBanList` builds internally,
 * so the per-key drop decision and the whole-packet scan are constructed from
 * the identical byte-unchanged exported constants and can NEVER diverge (the
 * design's no-divergence rule). Returns `null` for a family not in
 * `KEY_LEVEL_FAIL_CLOSED_FAMILIES`.
 *
 * Pattern-stack provenance (verified against each scan module, byte-for-byte):
 *   - A–D (parent_relation, disagreement_axis, misunderstanding_repair,
 *     evidence_source_chain) scan with `DOCTRINE_BAN_PATTERNS` ALONE — those
 *     four modules export no family-specific pattern array (none exists).
 *   - E–J each scan with `[...DOCTRINE_BAN_PATTERNS, ...FAMILY_<X>_BAN_PATTERNS]`
 *     and export their `FAMILY_<X>_BAN_PATTERNS` constant, which is imported
 *     here unchanged. The ban patterns themselves are NEVER modified by this
 *     card — this function only re-composes the already-exported constants.
 */
export function banPatternsForKeyLevelFamily(family: string): readonly RegExp[] | null {
  switch (family) {
    // Families A–D: shared doctrine patterns only (no family-specific array).
    case 'parent_relation':
    case 'disagreement_axis':
    case 'misunderstanding_repair':
    case 'evidence_source_chain':
      return [...DOCTRINE_BAN_PATTERNS];
    // Families E–J: shared doctrine patterns + the family's own extensions,
    // in the SAME order the family's scan composes them.
    case 'argument_scheme':
      return [...DOCTRINE_BAN_PATTERNS, ...FAMILY_E_BAN_PATTERNS];
    case 'critical_question':
      return [...DOCTRINE_BAN_PATTERNS, ...FAMILY_F_BAN_PATTERNS];
    case 'resolution_progress':
      return [...DOCTRINE_BAN_PATTERNS, ...FAMILY_G_BAN_PATTERNS];
    case 'claim_clarity':
      return [...DOCTRINE_BAN_PATTERNS, ...FAMILY_H_BAN_PATTERNS];
    case 'thread_topology':
      return [...DOCTRINE_BAN_PATTERNS, ...FAMILY_I_BAN_PATTERNS];
    case 'sensitive_composer':
      return [...DOCTRINE_BAN_PATTERNS, ...FAMILY_J_BAN_PATTERNS];
    default:
      return null;
  }
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
    // OPS-MCP-BAN-SCAN-NORMALIZATION: the shared raw-OR-normalized matcher (the
    // single no-divergence choke point) replaces the inline raw-only loop. The
    // pattern set is byte-unchanged; this only makes the same boundary
    // evasion-resistant (homoglyph / diacritic / leet / zero-width). The
    // `typeof span !== 'string'` skip above stays (MIX keyNull null-skip pin).
    if (banScanMatches(span, patterns)) {
      dirty.push(rawKey);
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
