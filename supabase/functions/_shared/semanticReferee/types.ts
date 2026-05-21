/**
 * MCP-016 — Semantic referee boundary types (Deno-side mirror).
 *
 * DOCUMENTED MIRROR of the canonical Node-side contract:
 *   src/features/semanticReferee/semanticRefereeTypes.ts  (owned by MCP-011)
 *
 * The Deno tree cannot import the Node file directly — the Node file uses
 * extensionless imports (Jest / Node toolchain) while the Deno tree needs
 * `.ts`-extension specifiers. This is the same dual-mirror arrangement the
 * `languageProcessing/` scaffold already lives with
 * (`languageProcessing/types.ts` documents `MIRROR: src/features/.../types.ts`).
 *
 * PARITY: `__tests__/semanticDenoNodeParity.test.ts` reads BOTH this file and
 * the Node upstream as source text and fails the build if the contract surface
 * (the classifier-id union, every `ALL_*` array, the `SemanticRefereePacket`
 * field set, `PACKET_VERSION`, `SCORE_HINT_MIN/MAX`) drifts. A future MCP-001
 * contract change must update BOTH files.
 *
 * This file is PURE TYPESCRIPT — type declarations + `const` arrays only. It
 * uses no Deno-only API so the parity test can compare it structurally.
 *
 * Doctrine (MCP-001 §7, cdiscourse-doctrine §1):
 *   - `authoritative` is the literal `false` — the type makes any other value a
 *     compile error.
 *   - the packet has NO `block` field, NO truth field, NO user-facing copy field.
 *   - the catalog is the 23-id catalog v0 frozen by MCP-001 §7 — not widened.
 *
 * MCP-016 also adds the boundary-only transport types that have no Node-side
 * home in MCP-011 (`ClassifyMoveRoomContext`, `ClassifyMoveRequest`,
 * `ClassifyMoveOutcome`). Their Node-side twins live in `src/lib/edgeFunctions.ts`
 * next to the `classifyMove` wrapper (roadmap §6 reconciliation 1).
 */

// ── Primitive contract types (MCP-001 §7, verbatim) ───────────────

export type Binary01 = 0 | 1;

export type SemanticConfidence = 'low' | 'medium' | 'high';

/**
 * Catalog v0 — the 23-id curated set from MCP-001 §7 / §8.
 * Widening this union is an MCP-001 contract touch (a new design card).
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

/** `reasonCode` / span string fields are bounded — over-length is rejected. */
export const MAX_COPY_FIELD_LEN = 280;

/** Generic string-field length bound for ids / hashes / version strings. */
export const MAX_STRING_FIELD_LEN = 512;

/** The exact six `scoreHints` integer field names (MCP-001 §7). */
export const SCORE_HINT_FIELDS: readonly (keyof SemanticScoreHints)[] = [
  'continuityCredit',
  'evidencePressure',
  'branchHygiene',
  'synthesisReadiness',
  'sourceChainDebt',
  'unresolvedRedirectRisk',
];

// ── Boundary-only transport types (MCP-016 — no MCP-011 Node home) ────
//
// These have no twin in MCP-011's `semanticRefereeTypes.ts`. Their Node-side
// twins live in `src/lib/edgeFunctions.ts` next to the `classifyMove` wrapper.
// They are NOT part of the parity surface — the parity test compares only the
// MCP-001 contract types above.

/**
 * Room / context the boundary needs to interpret a move. Optional fields —
 * a pre-send draft may not yet have selected an action or move type.
 */
export interface ClassifyMoveRoomContext {
  /** GAME-003 room mode code. */
  debateMode?: string;
  /** Quick-action preset the user picked. */
  selectedAction?: string;
  /** Declared argumentType. */
  selectedMoveType?: string;
  side?: 'affirmative' | 'negative' | 'observer' | 'moderator';
  actorRole?: 'initiator' | 'primary_opponent' | 'chime_in' | 'observer';
}

/**
 * Inbound request to the `semantic-referee` Edge Function. Bodies arrive
 * ALREADY redacted by the caller; the function runs a defensive second pass
 * (`redaction.ts`) before any provider sees them. The request carries NO
 * `block` field, NO truth field, NO score delta — nothing that can ask the
 * model for a verdict.
 */
export interface ClassifyMoveRequest {
  /** RLS-checked: the caller must be able to see this room. */
  roomId: string;
  /** Omitted for a pre-send draft. */
  moveId?: string;
  parentId?: string;
  /** 1..8000 chars (matches the process-language-draft cap). */
  moveBodyRedacted: string;
  /** <= 8000 chars. Absent for a root move. */
  parentBodyRedacted?: string;
  roomContext: ClassifyMoveRoomContext;
  /** 1..5 entries, each a SemanticClassifierId (MCP-001 §9 caps a prompt at 5). */
  requestedClassifiers: string[];
  promptVersionHint?: string;
  /** Hash of moveBodyRedacted — non-empty. */
  contentHash: string;
}

/**
 * Reason a classify did not produce a packet. NOTE the omission of MCP-009's
 * `'key_missing'` — MCP-016 has no live provider, so a key is never read and
 * `key_missing` is never produced. It re-enters the union only when the
 * live-provider pilot card adds the `anthropic` provider.
 */
export type ClassifyMoveDisabledReason = 'disabled' | 'not_configured' | 'not_implemented';

/**
 * Outbound response. `{ enabled: false }` is a NORMAL, EXPECTED outcome — it is
 * the default state of the whole feature. The consumer treats it identically to
 * an error: fall back to the deterministic layer-1 result.
 */
export type ClassifyMoveOutcome =
  | { enabled: false; reason: ClassifyMoveDisabledReason }
  | { enabled: true; packet: SemanticRefereePacket };
