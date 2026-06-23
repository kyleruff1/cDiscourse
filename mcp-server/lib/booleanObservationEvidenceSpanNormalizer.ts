/**
 * MCP-EGI-006/007/008 + MCP-EGI-009 — Server-side pre-validation
 * normalization for two evidenceSpan validation classes:
 *
 *   Pass 1 (MCP-EGI-006/007/008) — length-overflow null normalization
 *   for the locked 13-key compound rawKey set whose anchors organically
 *   exceed `MAX_EVIDENCE_SPAN_CHARS` on comparison-dense input.
 *
 *   Pass 2 (MCP-EGI-009) — key-set completion to null for the locked
 *   3-key set whose model output included the rawKey in observations,
 *   confidence, and checkedRawKeys but omitted the corresponding
 *   evidenceSpan entry. Repairs a structural map-coordination omission;
 *   preserves the model's semantic decision byte-equal.
 *
 * Both passes are no-op when the trigger conditions are absent. Both
 * preserve doctrine (the length pass via ban-list scan; the key-set pass
 * by never overwriting present values and never fabricating semantic
 * observations). The two passes target disjoint rawKey sets — see the
 * disjointness invariant on `EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS`.
 *
 * --- Pass 1 origin (MCP-EGI-006) ---
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
 * Safe log event shapes (emitted by the tool dispatcher after this helper):
 *
 *   Length pass:
 *   {
 *     event: 'boolean_observations_evidence_span_normalized',
 *     family, rawKey, path: 'evidenceSpan.<rawKey>',
 *     category: 'evidence_span_length_exceeded_to_null',
 *     originalLength, maxLength,
 *     schemaVersion?, requestId?
 *   }
 *
 *   Key-set pass:
 *   {
 *     event: 'boolean_observations_evidence_span_key_completed',
 *     family, rawKey, path: 'evidenceSpan.<rawKey>',
 *     category: 'evidence_span_key_set_missing_to_null',
 *     schemaVersion?, requestId?
 *   }
 *
 * NEVER carries:
 *   - the raw evidenceSpan string value,
 *   - the raw packet,
 *   - the raw prompt / argument body / model response,
 *   - any auth/bearer/JWT/API-key/service-role/env value.
 */
import { MAX_EVIDENCE_SPAN_CHARS } from './mcpBooleanObservationSchemaMirror.ts';
import { banPatternsForKeyLevelFamily } from './keyLevelFailClosed.ts';
import { banScanMatches } from './banScanNormalize.ts';
import { isRawKeySupportedForFamily } from './familyRegistry.ts';
// Side-effect import: triggers initializeFamilyRegistry() at line 233 so the
// singleton has A-J registered before Pass 1 calls isRawKeySupportedForFamily().
// This module is the canonical init point per design §3.3.
import './familyRegistryInit.ts';

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
 *
 * MCP-EGI-010 widens by exactly 7 additional rawKeys on the basis of the
 * post-MCP-EGI-009 D3 burst (debate `4d75daeb-f09a-430d-aa01-3ee6374922c6`,
 * 2026-06-23T05:04:25Z; 8 targets × 9 families = 72 cells, runId
 * `28eb3908-2d39-4a37-a34a-3de5256ba807`). The burst was the FIRST one to
 * run against the verified MCP-EGI-008 + MCP-EGI-009 production deploy
 * (`c7a5623` / Deno Deploy build `97308cj6v5t4`). The 13 length-target
 * rawKeys of MCP-EGI-008 and the 3 key-set rawKeys of MCP-EGI-009 BOTH
 * worked as designed (zero in-scope length residuals; zero in-scope
 * key-set-missing residuals; 4 length null-spans recorded across in-scope
 * keys; all in-scope positives ≤ 240 chars, max 240 exactly on
 * `names_method_difference`). The next-out-of-scope failure surface
 * surfaced under a fresh comparison-dense input: 12 unmasked
 * `evidence_span_length_exceeded` rows across 7 NEW distinct rawKeys
 * (with `multiple_claims_present` recurring 3×, `missing_warrant` and
 * `separates_observation_from_inference` recurring 2×):
 *   - `distinguishes_parent`                  (Family A / parent_relation)
 *   - `disputes_scope`                        (Family B / disagreement_axis)
 *   - `offers_candidate_understanding`        (Family C / misunderstanding_repair)
 *   - `separates_observation_from_inference`  (Family D / evidence_source_chain)
 *   - `missing_warrant`                       (Family F / critical_question)
 *   - `multiple_claims_present`               (Family H / claim_clarity)
 *   - `introduces_sub_axis`                   (Family I / thread_topology)
 *
 * Each of the 7 newly-implicated rawKey families (A/B/C/D/F/H/I) is already
 * a member of `KEY_LEVEL_FAIL_CLOSED_FAMILIES` and
 * `banPatternsForKeyLevelFamily()` already composes the family's byte-
 * identical ban-pattern stack — same no-divergence rule that carried
 * forward from MCP-EGI-006/007/008. NO dispatcher rewiring, NO ban-list
 * change, NO validator change, NO prompt edit required. Note Family F
 * (`critical_question`) gains its FIRST length-normalize rawKey here;
 * `banPatternsForKeyLevelFamily('critical_question')` already returns the
 * `[...DOCTRINE_BAN_PATTERNS, ...FAMILY_F_BAN_PATTERNS]` stack the
 * Family F scanner uses.
 *
 * MCP-EGI-010 does NOT include the 1 `evidence_span_invalid_type` rawKey
 * the same burst also surfaced (`exception_reasoning_present` on Family E
 * argument_scheme) — that is a different validation class (model emitted
 * a non-string evidenceSpan value, not an overlong string) and is
 * deferred to a separate MCP-EGI-011 lane.
 *
 * MCP-EGI-012 replaces the hand-maintained allowlist trajectory with a
 * categorical rule on the basis of the post-MCP-EGI-010 D3 burst (runId
 * `719b7b8f-7ac7-44df-bb79-4ea3d38e210c`, debate `f4655492-...`,
 * 2026-06-23T19:09:56Z). That burst surfaced 10 NEW out-of-scope length-
 * overflow rawKeys (`summarizes_parent` / `supports_parent` /
 * `challenges_parent` A; `disagreement_present` /
 * `disputes_evidence_applicability` B; `scope_mismatch_identified` C;
 * `concrete_example_provided` D; `example_representativeness_unclear` F;
 * `defines_next_evidence_needed` / `unresolved_point_isolated` G). The
 * prior two bursts each surfaced 7 and 10 new rawKeys respectively; the
 * narrow-widening trajectory was not converging.
 *
 * Pass 1 now derives eligibility from a categorical invariant rather than
 * a frozen rawKey allowlist: an over-240-character evidenceSpan string on
 * a family-valid rawKey, with the model's structural decision recorded in
 * checkedRawKeys + observations + confidence, and clean under the family
 * ban-list stack, is null-normalized. Pass 2 (MCP-EGI-009 key-set
 * completion) remains byte-equal at exactly 3 rawKeys. The hand-maintained
 * `EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS_DEPRECATED` constant is retained
 * (frozen) only as a historical record of the prior allowlist trajectory.
 *
 * Family J `sensitive_composer` is explicitly EXCLUDED from
 * `LENGTH_NORMALIZE_ELIGIBLE_FAMILIES` despite being registered in the
 * mcp-server familyRegistry singleton, because J is `productionEnabled:false`
 * at the Edge boundary and should not see production-shape packets. If J
 * is ever flipped on at the Edge, a fresh doctrine review is required.
 */
/**
 * MCP-EGI-012 — DEPRECATED hand-maintained 20-key length-normalize allowlist.
 *
 * Retained exported and frozen as a historical record of the keys that earned
 * coverage under the explicit allowlist trajectory (MCP-EGI-006 → 007 → 008 →
 * 010). NOT consulted by Pass 1 anymore. Pass 1 now uses the categorical
 * `LENGTH_NORMALIZE_ELIGIBLE_FAMILIES` ∩ family-valid rawKey rule instead.
 *
 * This export exists only so historical drift tests can still introspect the
 * prior allowlist contents without re-deriving them. Do NOT add new keys here.
 * Categorical eligibility is the source of truth; this constant is frozen.
 */
export const EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS_DEPRECATED: ReadonlySet<string> = new Set([
  // MCP-EGI-006
  'tradeoff_reasoning_present',
  'convergent_premise_structure',
  'synthesis_proposed',
  'compares_options',
  // MCP-EGI-007
  'reason_present',
  // MCP-EGI-008
  'contrasts_with_parent',
  'preserves_face_while_disagreeing',
  'provides_alternate_interpretation',
  'evidence_gap_present',
  'names_method_difference',
  'analogy_reasoning_present',
  'separates_normative_from_empirical',
  'claim_present',
  // MCP-EGI-010
  'distinguishes_parent',
  'disputes_scope',
  'offers_candidate_understanding',
  'separates_observation_from_inference',
  'missing_warrant',
  'multiple_claims_present',
  'introduces_sub_axis',
]);

/**
 * MCP-EGI-012 — Locked set of family identifiers eligible for the categorical
 * length-overflow null-normalization. Families A–I are the 9 production
 * families (`productionEnabled: true` at the Edge); Family J `sensitive_composer`
 * is explicitly EXCLUDED here even though it is registered in the mcp-server
 * `familyRegistry` singleton, because (a) J is `productionEnabled: false` at
 * the Edge boundary and should not see production-shape packets, and (b) the
 * gate-A spec for MCP-EGI-012 explicitly says default-do-not-normalize J.
 *
 * If J is ever flipped to `productionEnabled: true` at the Edge boundary, a
 * fresh card (not this one) must re-evaluate whether to include
 * 'sensitive_composer' here; the doctrine review at that point would also
 * cover MCP-021C-EDGE-FAMILY-J / cdiscourse-doctrine §10a.
 */
export const LENGTH_NORMALIZE_ELIGIBLE_FAMILIES: ReadonlySet<string> = new Set([
  'parent_relation',          // Family A
  'disagreement_axis',        // Family B
  'misunderstanding_repair',  // Family C
  'evidence_source_chain',    // Family D
  'argument_scheme',          // Family E
  'critical_question',        // Family F
  'resolution_progress',      // Family G
  'claim_clarity',            // Family H
  'thread_topology',          // Family I
]);

/**
 * MCP-EGI-009 — Locked set of rawKeys for which a MISSING evidenceSpan entry
 * is structurally completed to `null` before validation. Disjoint from the
 * length-normalization set; addresses a different validation class.
 *
 * Burst evidence (post-MCP-EGI-007 D3 pass-load, debate
 * `bd7b732c-306a-4c11-b5c3-9d3cafd2bbbc`, 2026-06-22T08:15:54Z;
 * 8 targets × 9 families = 72 cells) surfaced 3 distinct rawKeys with the
 * row-level discriminator:
 *
 *   validator_path = evidenceSpan.<rawKey>
 *   mcp_tool_reason = validation_failed
 *   mcp_tool_detail_category = evidence_span_key_set_missing
 *
 * On those rows the model included the rawKey in `observations`, `confidence`,
 * and `checkedRawKeys` — meaning the model DID make a semantic decision —
 * but omitted the corresponding `evidenceSpan.<rawKey>` entry. The validator's
 * key-set coordination requires the four maps to align on the same rawKey
 * set; the omission rejects the entire packet.
 *
 *   - `question_invites_revision`              (Family F / critical_question)
 *   - `action_item_proposed`                   (Family G / resolution_progress)
 *   - `unclear_reference_present`              (Family H / claim_clarity)
 *
 * Each rawKey is verified in its named family registry
 * (`familyFKeys.ts` / `familyGKeys.ts` / `familyHKeys.ts`). All three families
 * are members of `KEY_LEVEL_FAIL_CLOSED_FAMILIES`, so the existing dispatcher
 * routing already invokes the normalizer with a non-null family pattern stack
 * for the relevant tool call.
 *
 * Completion to `null` is doctrine-safe:
 *   - `null` is an existing valid value for `evidenceSpan.<rawKey>` (the
 *     schema mirror accepts `string | null`).
 *   - `null` makes NO semantic claim — the model's observation boolean and
 *     confidence value remain its stated finding.
 *   - The existing prompt instruction "set evidenceSpan.<rawKey> to null when
 *     you have no anchor" implicitly admits null as the correct value for a
 *     key the model judged but cannot anchor.
 *   - The validator remains unchanged: a missing key on the unnormalized
 *     packet still fails the key-set coordination check.
 *   - No ban-list scan is required (no content is ever moved or fabricated;
 *     null is structurally orthogonal to doctrine).
 *
 * Disjointness invariant: this set MUST be disjoint from
 * `EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS`. Length-overflow is a content-shape
 * residual on a present rawKey; key-set-missing is a coordination residual on
 * an absent rawKey. A rawKey appearing in both sets would be a contract bug
 * (the same packet shape cannot simultaneously be "string longer than 240
 * chars" AND "missing entirely"). The dedicated regression test asserts
 * `EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS ∩ EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS
 * === ∅`.
 */
export const EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS: ReadonlySet<string> = new Set([
  'question_invites_revision', // Family F — MCP-EGI-009
  'action_item_proposed', // Family G — MCP-EGI-009
  'unclear_reference_present', // Family H — MCP-EGI-009
]);

/** Category constant for the length-overflow normalization action (MCP-EGI-006/007/008). */
export const EVIDENCE_SPAN_NORMALIZATION_CATEGORY =
  'evidence_span_length_exceeded_to_null' as const;

/** Event name constant for the length-overflow normalization log line. */
export const EVIDENCE_SPAN_NORMALIZATION_EVENT_NAME =
  'boolean_observations_evidence_span_normalized' as const;

/**
 * MCP-EGI-009 — Category constant for the key-set-missing completion action.
 *
 * Distinct from the length-overflow category so structured-log readers and
 * downstream classifier-queue diagnostics can tell the two normalizers apart.
 */
export const EVIDENCE_SPAN_KEY_SET_COMPLETION_CATEGORY =
  'evidence_span_key_set_missing_to_null' as const;

/** MCP-EGI-009 — Event name constant for the key-set-completion log line. */
export const EVIDENCE_SPAN_KEY_SET_COMPLETION_EVENT_NAME =
  'boolean_observations_evidence_span_key_completed' as const;

/**
 * Unified event shape used by both normalization passes.
 *
 * - The `event` + `category` fields discriminate length-overflow events
 *   (MCP-EGI-006/007/008) from key-set-completion events (MCP-EGI-009).
 * - `originalLength` / `maxLength` are present ONLY on length-overflow events.
 *   They are optional on the shared interface so the dispatcher's structured
 *   log call stays byte-equal across both passes (undefined values are safely
 *   omitted by the log helper). No raw evidenceSpan value, raw packet, raw
 *   prompt, raw body, or raw model response is ever carried.
 */
export interface EvidenceSpanNormalizationEvent {
  readonly event:
    | typeof EVIDENCE_SPAN_NORMALIZATION_EVENT_NAME
    | typeof EVIDENCE_SPAN_KEY_SET_COMPLETION_EVENT_NAME;
  readonly family?: string;
  readonly rawKey: string;
  readonly path: string;
  readonly category:
    | typeof EVIDENCE_SPAN_NORMALIZATION_CATEGORY
    | typeof EVIDENCE_SPAN_KEY_SET_COMPLETION_CATEGORY;
  readonly originalLength?: number;
  readonly maxLength?: number;
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

  // === Pass 1 — MCP-EGI-006/007/008/010/012 length-overflow normalization ===
  //
  // MCP-EGI-012 replaces the prior hand-maintained 20-key allowlist with a
  // categorical eligibility rule:
  //   - family must be in LENGTH_NORMALIZE_ELIGIBLE_FAMILIES (A-I; J excluded
  //     because J is productionEnabled:false at the Edge)
  //   - rawKey must be valid for the packet's family per the singleton's
  //     isRawKeySupportedForFamily(family, rawKey)
  //   - rawKey must be present in checkedRawKeys/observations/confidence
  //     (model judged it; structural gates beyond evidenceSpan key presence)
  //   - evidenceSpan[rawKey] must be a string > 240 chars
  //   - the string must be clean under the family ban-list stack
  //
  // The structural gates (checkedRawKeys/observations/confidence presence)
  // are required because nulling an evidenceSpan entry when the model didn't
  // even judge the rawKey could obscure a malformed packet that the validator
  // should reject for unrelated reasons.
  const familyEligible =
    family !== undefined && LENGTH_NORMALIZE_ELIGIBLE_FAMILIES.has(family);
  if (familyEligible) {
    const observations = packet.observations;
    const confidence = packet.confidence;
    const checkedRawKeys = packet.checkedRawKeys;
    const hasObs = isPlainObject(observations);
    const hasConf = isPlainObject(confidence);
    const checkedSet = Array.isArray(checkedRawKeys)
      ? new Set(checkedRawKeys.filter((k): k is string => typeof k === 'string'))
      : null;
    const familyStr = family as string;

    for (const [rawKey, value] of Object.entries(spans)) {
      if (typeof value !== 'string') continue;
      if (value.length <= MAX_EVIDENCE_SPAN_CHARS) continue;

      // Categorical eligibility: family-valid rawKey only.
      if (!isRawKeySupportedForFamily(familyStr, rawKey)) continue;

      // Structural map-coordination gates: only normalize if the model actually
      // judged this rawKey (present in obs + conf + checkedRawKeys).
      if (!hasObs) continue;
      if (!hasConf) continue;
      if (checkedSet === null) continue;
      if (!Object.prototype.hasOwnProperty.call(observations, rawKey)) continue;
      if (!Object.prototype.hasOwnProperty.call(confidence, rawKey)) continue;
      if (!checkedSet.has(rawKey)) continue;

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
  }

  // === Pass 2 — MCP-EGI-009 key-set completion ===
  //
  // For each rawKey in the locked completion set: if the rawKey is present
  // in observations + confidence + checkedRawKeys (i.e. the model made a
  // semantic decision about it) but missing from evidenceSpan (the model
  // omitted the anchor), add `evidenceSpan.<rawKey> = null`. This repairs
  // a structural key-set coordination omission while preserving the model's
  // observation+confidence decisions byte-equal. No ban-list scan is needed
  // — no content is moved or fabricated; null is structurally orthogonal
  // to doctrine.
  //
  // Critical safety: NEVER overwrites a present value. The
  // `hasOwnProperty(normalizedSpans, rawKey)` guard ensures that any
  // pre-existing value (including null, string, or an invalid shape that
  // the validator will reject) is left untouched. This preserves the
  // validator's existing power to reject malformed packets.
  const observations = packet.observations;
  const confidence = packet.confidence;
  const checkedRawKeys = packet.checkedRawKeys;
  if (
    isPlainObject(observations) &&
    isPlainObject(confidence) &&
    Array.isArray(checkedRawKeys)
  ) {
    const checkedSet = new Set(
      checkedRawKeys.filter((k): k is string => typeof k === 'string'),
    );
    for (const rawKey of EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(normalizedSpans, rawKey)) continue;
      if (!Object.prototype.hasOwnProperty.call(observations, rawKey)) continue;
      if (!Object.prototype.hasOwnProperty.call(confidence, rawKey)) continue;
      if (!checkedSet.has(rawKey)) continue;

      normalizedSpans[rawKey] = null;
      mutated = true;
      events.push({
        event: EVIDENCE_SPAN_KEY_SET_COMPLETION_EVENT_NAME,
        family,
        rawKey,
        path: `evidenceSpan.${rawKey}`,
        category: EVIDENCE_SPAN_KEY_SET_COMPLETION_CATEGORY,
        schemaVersion: options.schemaVersion,
        requestId: options.requestId,
      });
    }
  }

  if (!mutated) return { packet, events: [] };

  return {
    packet: { ...packet, evidenceSpan: normalizedSpans },
    events,
  };
}
