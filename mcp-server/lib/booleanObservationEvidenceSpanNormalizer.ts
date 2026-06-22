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
 *   - For each of the four compound rawKeys
 *     (tradeoff_reasoning_present, convergent_premise_structure,
 *      synthesis_proposed, compares_options):
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
 * organically span 250+ chars on comparison-dense input and which the three
 * post-#788 D3 canaries confirmed as the live `evidence_span_length_exceeded`
 * surface. Constraining the set is doctrine-preserving: any future broadening
 * requires a separate card.
 */
export const EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS: ReadonlySet<string> = new Set([
  'tradeoff_reasoning_present', // Family E
  'convergent_premise_structure', // Family E
  'synthesis_proposed', // Family G
  'compares_options', // Family I
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
