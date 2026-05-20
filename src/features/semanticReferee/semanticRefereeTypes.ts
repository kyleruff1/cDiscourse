/**
 * MCP-011 — Semantic referee canonical Node-side type contract.
 *
 * Re-states the `SemanticRefereePacket` / `SemanticBinarySample` shapes from
 * MCP-001 §7 verbatim, so downstream MCP cards (MCP-012 … MCP-016) import one
 * shared definition instead of minting local mirrors.
 *
 * This file is PURE TYPESCRIPT — type declarations + `const` arrays only.
 * It has NO runtime import (not even `zod`). Only `semanticRefereeValidator.ts`
 * imports `zod`. See MCP-011 design §7.
 *
 * Doctrine (MCP-011 §4):
 *   - `authoritative` is the literal `false` — the type makes any other value a
 *     compile error.
 *   - the packet has NO `block` field, NO truth field, NO user-facing copy field.
 *   - the catalog is the 23-id catalog v0 frozen by MCP-001 §7 — not widened here.
 */

// ── Primitive contract types (MCP-001 §7, verbatim) ───────────────

export type Binary01 = 0 | 1;

export type SemanticConfidence = 'low' | 'medium' | 'high';

/**
 * Catalog v0 — the 23-id curated set from MCP-001 §7 / §8.
 * The 90-seed bank (MCP-002) is a superset; widening this union is an
 * MCP-001 contract touch (a new design card) — see MCP-011 §20.
 */
export type SemanticClassifierId =
  | 'responds_to_parent'
  | 'introduces_new_issue'
  | 'asks_for_evidence'
  | 'provides_evidence'
  | 'evidence_supports_claim'
  | 'quote_anchors_parent'
  | 'narrows_claim'
  | 'concedes_narrow_point'
  | 'requests_clarification'
  | 'answers_clarification'
  | 'shifts_to_person_or_intent'
  | 'uses_popularity_as_evidence'
  | 'contains_playable_hot_take'
  | 'contains_unplayable_insult_only'
  | 'is_satire_or_parody'
  | 'uses_satire_as_evidence'
  | 'cites_retraction'
  | 'creates_source_chain_gap'
  | 'suggests_side_branch'
  | 'suggests_diagonal_tangent'
  | 'fits_selected_debate_mode'
  | 'needs_pre_send_pause'
  | 'ready_for_synthesis';

export type SemanticRouteSuggestion =
  | 'mainline'
  | 'vertical_chime_branch'
  | 'diagonal_tangent'
  | 'outer_realm'
  | 'cards_detail'
  | 'synthesis_lane'
  | 'no_route_change';

export type SemanticFrictionSuggestion =
  | 'none'
  | 'soft_chip'
  | 'pre_send_pause'
  | 'ask_for_quote'
  | 'ask_for_source'
  | 'suggest_branch'
  | 'suggest_narrow'
  | 'cooldown_notice';

export type SemanticProvider = 'mock' | 'mcp' | 'anthropic' | 'operator-selected';

/**
 * One binary sample — a single structural property classified `0` or `1`.
 * `reasonCode` is a bounded `snake_case` token; it is mapped to plain language
 * before it can reach a user surface (MCP-013/MCP-014). `confidence` is the
 * model's own uncertainty — never a verdict, never a truth probability.
 */
export type SemanticBinarySample = Readonly<{
  classifierId: SemanticClassifierId;
  value: Binary01;
  confidence: SemanticConfidence;
  reasonCode: string;
  evidenceSpan?: string;
  parentSpan?: string;
}>;

/**
 * `scoreHints` — integers in a small bounded range. These are *hints* for
 * MCP-003's ledger, not score deltas. The validator pins each to `0..3`.
 */
export type SemanticScoreHints = Readonly<{
  continuityCredit: number;
  evidencePressure: number;
  branchHygiene: number;
  synthesisReadiness: number;
  sourceChainDebt: number;
  unresolvedRedirectRisk: number;
}>;

/**
 * The full advisory packet. `authoritative` is the literal `false` — the
 * deterministic game never trusts it blindly. There is NO `block` field and
 * NO truth field anywhere in this contract.
 */
export type SemanticRefereePacket = Readonly<{
  packetVersion: 'mcp-semantic-referee-v0';
  promptVersion: string;
  modelVersion: string;
  provider: SemanticProvider;
  authoritative: false;
  inputHash: string;
  contentHash: string;
  roomId: string;
  moveId?: string;
  parentId?: string;
  selectedAction?: string;
  selectedMoveType?: string;
  debateMode?: string;
  binaries: readonly SemanticBinarySample[];
  routeSuggestion: SemanticRouteSuggestion;
  frictionSuggestion: SemanticFrictionSuggestion;
  scoreHints: SemanticScoreHints;
}>;

// ── Known-value constant arrays (the validator's domain checks read these) ──

export const ALL_SEMANTIC_CLASSIFIER_IDS: readonly SemanticClassifierId[] = [
  'responds_to_parent',
  'introduces_new_issue',
  'asks_for_evidence',
  'provides_evidence',
  'evidence_supports_claim',
  'quote_anchors_parent',
  'narrows_claim',
  'concedes_narrow_point',
  'requests_clarification',
  'answers_clarification',
  'shifts_to_person_or_intent',
  'uses_popularity_as_evidence',
  'contains_playable_hot_take',
  'contains_unplayable_insult_only',
  'is_satire_or_parody',
  'uses_satire_as_evidence',
  'cites_retraction',
  'creates_source_chain_gap',
  'suggests_side_branch',
  'suggests_diagonal_tangent',
  'fits_selected_debate_mode',
  'needs_pre_send_pause',
  'ready_for_synthesis',
];

export const ALL_ROUTE_SUGGESTIONS: readonly SemanticRouteSuggestion[] = [
  'mainline',
  'vertical_chime_branch',
  'diagonal_tangent',
  'outer_realm',
  'cards_detail',
  'synthesis_lane',
  'no_route_change',
];

export const ALL_FRICTION_SUGGESTIONS: readonly SemanticFrictionSuggestion[] = [
  'none',
  'soft_chip',
  'pre_send_pause',
  'ask_for_quote',
  'ask_for_source',
  'suggest_branch',
  'suggest_narrow',
  'cooldown_notice',
];

export const ALL_CONFIDENCE_VALUES: readonly SemanticConfidence[] = [
  'low',
  'medium',
  'high',
];

export const ALL_SEMANTIC_PROVIDERS: readonly SemanticProvider[] = [
  'mock',
  'mcp',
  'anthropic',
  'operator-selected',
];

/** Versions the contract *shape*; a contract change bumps it (MCP-001 §18). */
export const PACKET_VERSION = 'mcp-semantic-referee-v0' as const;

/** `scoreHints` integer bounds — MCP-003 §6 assumption (MCP-011 §18 decision 4). */
export const SCORE_HINT_MIN = 0;
export const SCORE_HINT_MAX = 3;

/** `reasonCode` / span string fields are bounded — over-length → `field_too_long`. */
export const MAX_COPY_FIELD_LEN = 280;

/** Generic string-field length bound for ids / hashes / version strings. */
export const MAX_STRING_FIELD_LEN = 512;

/**
 * The six MCP-002 seed-bank reason-code family prefixes. The validator checks a
 * `reasonCode` against family + `snake_case` shape + length — NOT an exact
 * 90-entry allowlist (MCP-011 §18 decision 3). Listed without a trailing
 * underscore; the validator requires `<family>_<suffix>`.
 */
export const REASON_CODE_FAMILIES: readonly string[] = [
  'parent_continuity',
  'branch_routing',
  'evidence',
  'source_chain',
  'movement',
  'mode_fit',
  'friction',
  'banner',
];

/** The exact six `scoreHints` integer field names (MCP-001 §7). */
export const SCORE_HINT_FIELDS: readonly (keyof SemanticScoreHints)[] = [
  'continuityCredit',
  'evidencePressure',
  'branchHygiene',
  'synthesisReadiness',
  'sourceChainDebt',
  'unresolvedRedirectRisk',
];

// ── Validation-result vocabulary ──────────────────────────────────

/**
 * Every way a packet can be rejected. NOTE for safety scans: the tokens
 * `verdict_token` / `person_label` / `secret_shape` below are rejection-CODE
 * names — they are validator internals, not user-facing strings. Documented
 * expected false positive (MCP-011 §16).
 */
export type SemanticRejectionCode =
  | 'non_json'
  | 'not_an_object'
  | 'top_level_array'
  | 'unknown_field'
  | 'missing_field'
  | 'field_too_long'
  | 'authoritative_not_false'
  | 'block_field'
  | 'unknown_classifier_id'
  | 'duplicate_classifier_id'
  | 'unknown_route_suggestion'
  | 'unknown_friction_suggestion'
  | 'unknown_confidence'
  | 'non_binary_value'
  | 'score_hint_out_of_range'
  | 'unknown_reason_code'
  | 'verdict_token'
  | 'person_label'
  | 'secret_shape'
  | 'pii_shape'
  | 'chain_of_thought_field'
  | 'raw_prompt_field'
  | 'copy_field_smuggled';

/**
 * One rejection. `field` is a dotted path (e.g. `binaries[2].value`) — NEVER
 * the offending raw value. `detail` is SANITIZED — it describes the *kind* of
 * defect and never echoes a caught secret (MCP-011 §12).
 */
export interface SemanticPacketRejection {
  code: SemanticRejectionCode;
  field?: string;
  detail: string;
}

export type SemanticPacketValidationResult =
  | { ok: true; packet: SemanticRefereePacket }
  | { ok: false; rejections: readonly SemanticPacketRejection[] };
