/**
 * MCP-EGI-006 — Server-side null normalization for overlong compound
 * evidenceSpan values.
 *
 * Three D3 canary attempts (post-MCP-EGI-002 / 003 / 005) confirmed the
 * E/G/I dead-letter trail via the MCP-EGI-003 row-level discriminator:
 *
 *   validator_path = evidenceSpan.<rawKey>
 *   mcp_tool_reason = validation_failed
 *   mcp_tool_detail_category = evidence_span_length_exceeded
 *
 * The MCP-EGI-005 prompt-side "you MUST set evidenceSpan.<rawKey> to null"
 * instruction was proven insufficient: the model still drafts >240-char
 * anchors for the four compound structural rawKeys when the input is
 * comparison-dense. The next deterministic fix is a pre-validation
 * server-side normalizer that converts overlong strings on those exact
 * rawKeys to `null`, which the validator already accepts (string|null).
 *
 * Behavior:
 *   - Iterates the packet's evidenceSpan keys.
 *   - For each compound rawKey in `EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS`
 *     (MCP-EGI-006 opened with 4 keys: tradeoff_reasoning_present,
 *     convergent_premise_structure, synthesis_proposed, compares_options;
 *     MCP-EGI-007 added a 5th: reason_present;
 *     MCP-EGI-008 widened by 8 more on burst evidence: contrasts_with_parent,
 *     preserves_face_while_disagreeing, provides_alternate_interpretation,
 *     evidence_gap_present, names_method_difference, analogy_reasoning_present,
 *     separates_normative_from_empirical, claim_present — for a final scope of 13):
 *       IF the value is a string longer than MAX_EVIDENCE_SPAN_CHARS,
 *       AND it does NOT contain doctrine-banned content under the family's
 *       byte-unchanged pattern stack,
 *       THEN replace with null.
 *   - All other rawKeys, all non-string values, all <=240-char strings:
 *     byte-identical. Observations / confidence / checkedRawKeys / non-target
 *     keys / modelInfo: untouched.
 *   - Returns the normalized packet (NEW object when mutated, the original
 *     when not) plus a list of structural events for safe logging.
 *
 * Doctrine preservation:
 *   - An overlong string containing banned content is NOT normalized — the
 *     validator rejects it for length, so the existing reject path holds
 *     and no banned content is silently dropped. The ban pattern stack used
 *     here is the byte-identical set returned by
 *     `banPatternsForKeyLevelFamily()`, which is itself sourced from the
 *     same constants the family's `scanFamily<X>BooleanResponseForBanList`
 *     stacks; the no-divergence rule from OPS-MCP-KEY-LEVEL-FAIL-CLOSED
 *     carries forward.
 *
 * Preservation manifest:
 *   - `validateMcpBooleanObservationResponse` UNCHANGED.
 *   - `MAX_EVIDENCE_SPAN_CHARS = 240` UNCHANGED.
 *   - All ban patterns UNCHANGED.
 *   - All family scanners UNCHANGED.
 *   - All prompts UNCHANGED.
 *   - `observations` / `confidence` / `checkedRawKeys` / `modelInfo`
 *     UNCHANGED.
 *   - Non-target rawKey spans UNCHANGED.
 *   - Non-string, missing, key-set-mismatched values UNCHANGED (validator
 *     still rejects).
 *   - Schema, retry, drainer, concurrency, familyRegistry UNCHANGED.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — normalization to null asserts NOTHING; the
 *     existing observation+confidence remain the model's stated finding;
 *     only the structural anchor is removed for length reasons.
 *   - cdiscourse-doctrine §10a — observations vs allegations; nulling a
 *     compound anchor on length is a STRUCTURAL act, not a quality verdict.
 *
 * Safe log event shape (emitted by the tool dispatcher after this helper):
 *   {
 *     event: 'boolean_observations_evidence_span_normalized',
 *     family, rawKey, path: 'evidenceSpan.<rawKey>',
 *     category: 'evidence_span_length_exceeded_to_null',
 *     originalLength, maxLength,
 *     schemaVersion?, requestId?
 *   }
 * NEVER carries:
 *   - the raw evidenceSpan string value,
 *   - the raw packet,
 *   - the raw prompt / argument body / model response,
 *   - any auth/bearer/JWT/API-key/service-role/env value.
 */
import { MAX_EVIDENCE_SPAN_CHARS } from './mcpBooleanObservationSchemaMirror.ts';
import { banPatternsForKeyLevelFamily } from './keyLevelFailClosed.ts';
import { banScanMatches } from './banScanNormalize.ts';

/**
 * The exact compound structural rawKey set whose evidenceSpan anchors
 * organically span 250+ chars on comparison-dense input and which the live
 * D3 canary evidence confirmed as the `evidence_span_length_exceeded`
 * surface. Constraining the set is doctrine-preserving: any future broadening
 * requires a separate card.
 *
 * MCP-EGI-006 (PR #792, merged `a0fc1c3`) opened the set with the four
 * rawKeys named by the prior three D3 canaries:
 *   - `tradeoff_reasoning_present`     (Family E / argument_scheme)
 *   - `convergent_premise_structure`   (Family E / argument_scheme)
 *   - `synthesis_proposed`             (Family G / resolution_progress)
 *   - `compares_options`               (Family I / thread_topology)
 *
 * MCP-EGI-007 widens by exactly one rawKey on the basis of the
 * post-MCP-EGI-006 D3 canary (target `72a5526c-7ab1-4ca4-85f7-1a651ad64565`,
 * 2026-06-22T05:43:53Z → 06:08:04Z). On that canary the original four
 * rawKeys cleared att 1 with `evidence_span=null` exactly per the MCP-EGI-006
 * contract; the remaining residual was a fifth rawKey with the same overflow
 * shape:
 *   - `reason_present`                 (Family H / claim_clarity)
 *     - validator_path = `evidenceSpan.reason_present`
 *     - mcp_tool_reason = `validation_failed`
 *     - mcp_tool_detail_category = `evidence_span_length_exceeded`
 *
 * `reason_present` is rawKey #3 of the 12 Family H ai_classifier set per
 * `mcp-server/lib/familyHKeys.ts`. Family H is already a member of
 * `KEY_LEVEL_FAIL_CLOSED_FAMILIES`, so `banPatternsForKeyLevelFamily()`
 * already composes the byte-identical `[...DOCTRINE_BAN_PATTERNS,
 * ...FAMILY_H_BAN_PATTERNS]` stack the Family H scanner uses. Widening this
 * set to include `reason_present` therefore requires NO dispatcher
 * rewiring, NO ban-list change, NO validator change, NO prompt edit.
 *
 * MCP-EGI-008 widens by exactly 8 additional rawKeys on the basis of the
 * post-MCP-EGI-007 D3 burst/pass-load (debate
 * `bd7b732c-306a-4c11-b5c3-9d3cafd2bbbc`, 2026-06-22T08:15:54Z; 8 targets ×
 * 9 families = 72 cells). The canary's single-target shape exercised only
 * the original 5 rawKeys; the burst's 8-target shape surfaced 8 additional
 * `evidence_span_length_exceeded` rawKeys on out-of-scope keys. Burst row
 * evidence (10 length-overflow rows across 8 distinct rawKeys; `contrasts_with_parent`
 * recurring on 3 of 8 targets):
 *   - `contrasts_with_parent`                  (Family A / parent_relation)
 *   - `preserves_face_while_disagreeing`       (Family B / disagreement_axis)
 *   - `provides_alternate_interpretation`      (Family C / misunderstanding_repair)
 *   - `evidence_gap_present`                   (Family D / evidence_source_chain)
 *   - `names_method_difference`                (Family D / evidence_source_chain)
 *   - `analogy_reasoning_present`              (Family E / argument_scheme)
 *   - `separates_normative_from_empirical`     (Family G / resolution_progress)
 *   - `claim_present`                          (Family H / claim_clarity)
 *
 * Historical persisted-positives audit (read-only) confirms all 8 are real
 * overflow surfaces (300 / 100 / 50 / 26 / 24 / 16 / 12 / 11 persisted positives
 * respectively; max lengths 153-236 chars; `evidence_gap_present` had 36 of
 * 300 = 12% over the 200-char soft target with one at 236).
 *
 * Each of the 7 newly-implicated families (A/B/C/D/E/G/H) is already a member
 * of `KEY_LEVEL_FAIL_CLOSED_FAMILIES` and `banPatternsForKeyLevelFamily()`
 * already composes its byte-identical ban-pattern stack — same no-divergence
 * rule that carried forward from MCP-EGI-006/007. NO dispatcher rewiring,
 * NO ban-list change, NO validator change, NO prompt edit required.
 *
 * MCP-EGI-008 does NOT include the 3 `evidence_span_key_set_missing` rawKeys
 * the burst also surfaced (`unclear_reference_present`, `action_item_proposed`,
 * `question_invites_revision`) — those are a different validation class and
 * are deferred to a separate MCP-EGI-009 lane (key-set coordination, not
 * length-overflow).
 */
export const EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS: ReadonlySet<string> = new Set([
  'tradeoff_reasoning_present', // Family E — MCP-EGI-006
  'convergent_premise_structure', // Family E — MCP-EGI-006
  'synthesis_proposed', // Family G — MCP-EGI-006
  'compares_options', // Family I — MCP-EGI-006
  'reason_present', // Family H — MCP-EGI-007
  'contrasts_with_parent', // Family A — MCP-EGI-008
  'preserves_face_while_disagreeing', // Family B — MCP-EGI-008
  'provides_alternate_interpretation', // Family C — MCP-EGI-008
  'evidence_gap_present', // Family D — MCP-EGI-008
  'names_method_difference', // Family D — MCP-EGI-008
  'analogy_reasoning_present', // Family E — MCP-EGI-008
  'separates_normative_from_empirical', // Family G — MCP-EGI-008
  'claim_present', // Family H — MCP-EGI-008
]);

/** Single category constant for the only normalization action this helper performs. */
export const EVIDENCE_SPAN_NORMALIZATION_CATEGORY =
  'evidence_span_length_exceeded_to_null' as const;

/** Single event name constant for the dispatcher's structured log line. */
export const EVIDENCE_SPAN_NORMALIZATION_EVENT_NAME =
  'boolean_observations_evidence_span_normalized' as const;

export interface EvidenceSpanNormalizationEvent {
  readonly event: typeof EVIDENCE_SPAN_NORMALIZATION_EVENT_NAME;
  readonly family?: string;
  readonly rawKey: string;
  readonly path: string;
  readonly category: typeof EVIDENCE_SPAN_NORMALIZATION_CATEGORY;
  readonly originalLength: number;
  readonly maxLength: number;
  readonly schemaVersion?: string;
  readonly requestId?: string;
}

export interface EvidenceSpanNormalizationOptions {
  readonly family?: string;
  readonly schemaVersion?: string;
  readonly requestId?: string;
}

export interface EvidenceSpanNormalizationResult {
  readonly packet: Record<string, unknown>;
  readonly events: readonly EvidenceSpanNormalizationEvent[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Pure normalizer. Returns a new packet when at least one normalization
 * fires; otherwise returns the input packet by reference (events array is
 * empty in that case).
 */
export function normalizeLongEvidenceSpansForBooleanObservations(
  packet: unknown,
  options: EvidenceSpanNormalizationOptions = {},
): EvidenceSpanNormalizationResult {
  // Defensive: a non-object packet would be rejected by the validator on
  // shape. The normalizer makes no decisions about it.
  if (!isPlainObject(packet)) {
    return { packet: packet as Record<string, unknown>, events: [] };
  }
  const spans = packet.evidenceSpan;
  if (!isPlainObject(spans)) {
    // Non-object evidenceSpan: let the validator reject it.
    return { packet, events: [] };
  }

  const { family } = options;
  // Pattern stack is the byte-identical set the family scanner stacks; if
  // the family is not recognised by the key-level-fail-closed lookup we
  // conservatively skip normalization (no silent drop of unscanned content).
  const patterns =
    family !== undefined ? banPatternsForKeyLevelFamily(family) : null;
  if (patterns === null) {
    return { packet, events: [] };
  }

  const events: EvidenceSpanNormalizationEvent[] = [];
  const normalizedSpans: Record<string, unknown> = { ...spans };
  let mutated = false;

  for (const [rawKey, value] of Object.entries(spans)) {
    if (!EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS.has(rawKey)) continue;
    if (typeof value !== 'string') continue;
    if (value.length <= MAX_EVIDENCE_SPAN_CHARS) continue;

    // Doctrine preservation: an overlong string containing banned content
    // is NOT normalized — the validator's length reject still fires, and
    // the existing ban-list-vs-length precedence is preserved. Nulling
    // would silently discard the banned content, which is unsafe.
    if (banScanMatches(value, patterns)) continue;

    normalizedSpans[rawKey] = null;
    mutated = true;
    events.push({
      event: EVIDENCE_SPAN_NORMALIZATION_EVENT_NAME,
      family,
      rawKey,
      path: `evidenceSpan.${rawKey}`,
      category: EVIDENCE_SPAN_NORMALIZATION_CATEGORY,
      originalLength: value.length,
      maxLength: MAX_EVIDENCE_SPAN_CHARS,
      schemaVersion: options.schemaVersion,
      requestId: options.requestId,
    });
  }

  if (!mutated) return { packet, events: [] };

  return {
    packet: { ...packet, evidenceSpan: normalizedSpans },
    events,
  };
}
