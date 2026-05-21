/**
 * MCP-016 — Semantic referee deterministic mock classifier.
 *
 * `runMockClassifier(request)` produces a schema-valid `SemanticRefereePacket`
 * from the `ClassifyMoveRequest` alone — NO network, NO env, NO randomness.
 * Same request → byte-identical packet (the boundary is stateless and
 * idempotent). Every packet carries `provider: 'mock'`,
 * `authoritative: false`, `packetVersion: 'mcp-semantic-referee-v0'`.
 *
 * This is the DEFAULT and PRIMARY provider for MCP-016. It mirrors the
 * deterministic-derivation style of `languageProcessing/mockProvider.ts`.
 *
 * Pure TypeScript — no Deno-only API. Synchronous. No I/O.
 *
 * Doctrine: the mock NEVER emits a verdict / person token in any string field
 * (`reasonCode`, spans). It classifies structural properties only. Confidence
 * is the mock's own determinism marker, never a truth probability.
 */
import {
  PACKET_VERSION,
} from './types.ts';
import type {
  Binary01,
  ClassifyMoveRequest,
  SemanticBinarySample,
  SemanticClassifierId,
  SemanticConfidence,
  SemanticFrictionSuggestion,
  SemanticRefereePacket,
  SemanticRouteSuggestion,
  SemanticScoreHints,
} from './types.ts';

/** Stable prompt / model version strings the mock stamps onto every packet. */
const MOCK_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v0';
const MOCK_MODEL_VERSION = 'mock-semantic-referee-v0';

/**
 * A small deterministic 32-bit string hash (FNV-1a). Used to derive a stable
 * `inputHash` and to make per-classifier `value` / `confidence` choices vary
 * across requests WITHOUT any randomness — the same string always hashes the
 * same way.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply via shift-adds, kept in unsigned range.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/** A short lowercase hex token from a 32-bit hash. */
function hashToken(hash: number): string {
  return hash.toString(16).padStart(8, '0');
}

const ZERO_SCORE_HINTS: SemanticScoreHints = {
  continuityCredit: 0,
  evidencePressure: 0,
  branchHygiene: 0,
  synthesisReadiness: 0,
  sourceChainDebt: 0,
  unresolvedRedirectRisk: 0,
};

/**
 * Per-classifier deterministic projection. For each requested classifier the
 * mock derives a structural `value`, a `confidence`, and a contract-valid
 * `reasonCode` (a known reason-code family + a structural suffix). The choice
 * is a pure function of the classifier id, whether a parent exists, and the
 * request's content hash — never random.
 */
const CLASSIFIER_REASON_FAMILY: Readonly<Record<SemanticClassifierId, string>> = {
  responds_to_parent: 'parent_continuity',
  introduces_new_issue: 'branch_routing',
  asks_for_evidence: 'evidence',
  provides_evidence: 'evidence',
  evidence_supports_claim: 'evidence',
  quote_anchors_parent: 'parent_continuity',
  narrows_claim: 'movement',
  concedes_narrow_point: 'movement',
  requests_clarification: 'friction',
  answers_clarification: 'parent_continuity',
  shifts_to_person_or_intent: 'friction',
  uses_popularity_as_evidence: 'evidence',
  contains_playable_hot_take: 'mode_fit',
  contains_unplayable_insult_only: 'friction',
  is_satire_or_parody: 'mode_fit',
  uses_satire_as_evidence: 'evidence',
  cites_retraction: 'source_chain',
  creates_source_chain_gap: 'source_chain',
  suggests_side_branch: 'branch_routing',
  suggests_diagonal_tangent: 'branch_routing',
  fits_selected_debate_mode: 'mode_fit',
  needs_pre_send_pause: 'friction',
  ready_for_synthesis: 'movement',
};

function confidenceFor(hash: number): SemanticConfidence {
  const bucket = hash % 3;
  if (bucket === 0) return 'low';
  if (bucket === 1) return 'medium';
  return 'high';
}

/**
 * Build one binary sample for a requested classifier. Deterministic in
 * `classifierId`, `hasParent`, and `contentHash`.
 */
function buildBinary(
  classifierId: SemanticClassifierId,
  hasParent: boolean,
  contentHash: string,
): SemanticBinarySample {
  const seed = fnv1a(`${classifierId}|${hasParent ? 'p' : 'r'}|${contentHash}`);
  // `responds_to_parent` for a root move (no parent) is structurally 0.
  const value: Binary01 =
    classifierId === 'responds_to_parent' && !hasParent ? 0 : ((seed & 1) as Binary01);
  const confidence = confidenceFor(seed);
  const family = CLASSIFIER_REASON_FAMILY[classifierId];
  const reasonCode = `${family}_mock_${value === 1 ? 'present' : 'absent'}`;
  return {
    classifierId,
    value,
    confidence,
    reasonCode,
  };
}

/**
 * Derive a route suggestion deterministically from the binary set. The mock
 * keeps this conservative: it only suggests a route change when a routing
 * classifier fired; otherwise `no_route_change`.
 */
function deriveRoute(binaries: readonly SemanticBinarySample[]): SemanticRouteSuggestion {
  const fired = (id: SemanticClassifierId) =>
    binaries.some((b) => b.classifierId === id && b.value === 1);
  if (fired('ready_for_synthesis')) return 'synthesis_lane';
  if (fired('suggests_side_branch')) return 'vertical_chime_branch';
  if (fired('suggests_diagonal_tangent')) return 'diagonal_tangent';
  if (fired('introduces_new_issue')) return 'outer_realm';
  return 'no_route_change';
}

/**
 * Derive a friction suggestion deterministically from the binary set. Friction
 * is advisory — it is never a block.
 */
function deriveFriction(binaries: readonly SemanticBinarySample[]): SemanticFrictionSuggestion {
  const fired = (id: SemanticClassifierId) =>
    binaries.some((b) => b.classifierId === id && b.value === 1);
  if (fired('creates_source_chain_gap')) return 'ask_for_source';
  if (fired('asks_for_evidence')) return 'ask_for_quote';
  if (fired('needs_pre_send_pause')) return 'pre_send_pause';
  if (fired('suggests_side_branch')) return 'suggest_branch';
  if (fired('narrows_claim')) return 'suggest_narrow';
  return 'none';
}

/** Clamp a derived hint into the contract's `0..3` integer range. */
function clampHint(value: number): number {
  if (value < 0) return 0;
  if (value > 3) return 3;
  return Math.trunc(value);
}

/**
 * Derive `scoreHints` deterministically from the binary set. These are HINTS
 * for MCP-003's ledger — not score deltas. The mock keeps them small.
 */
function deriveScoreHints(binaries: readonly SemanticBinarySample[]): SemanticScoreHints {
  const count = (id: SemanticClassifierId) =>
    binaries.filter((b) => b.classifierId === id && b.value === 1).length;
  return {
    continuityCredit: clampHint(count('responds_to_parent') + count('answers_clarification')),
    evidencePressure: clampHint(count('asks_for_evidence') + count('creates_source_chain_gap')),
    branchHygiene: clampHint(count('suggests_side_branch') + count('suggests_diagonal_tangent')),
    synthesisReadiness: clampHint(count('ready_for_synthesis') * 2),
    sourceChainDebt: clampHint(count('creates_source_chain_gap')),
    unresolvedRedirectRisk: clampHint(count('introduces_new_issue')),
  };
}

/**
 * Run the deterministic mock classifier. Returns a frozen, schema-valid
 * `SemanticRefereePacket`. Same `ClassifyMoveRequest` → byte-identical packet.
 */
export function runMockClassifier(request: ClassifyMoveRequest): SemanticRefereePacket {
  const hasParent = Boolean(request.parentId) || request.parentBodyRedacted !== undefined;
  const promptVersion = request.promptVersionHint ?? MOCK_PROMPT_VERSION;

  // De-duplicate requested classifier ids while preserving first-seen order —
  // the schema already caps the array at 5 and each entry is a known id.
  const seen = new Set<string>();
  const uniqueClassifiers: SemanticClassifierId[] = [];
  for (const id of request.requestedClassifiers) {
    if (!seen.has(id)) {
      seen.add(id);
      uniqueClassifiers.push(id as SemanticClassifierId);
    }
  }

  const binaries: SemanticBinarySample[] = uniqueClassifiers.map((id) =>
    Object.freeze(buildBinary(id, hasParent, request.contentHash)),
  );

  const inputHash = `mock-${hashToken(
    fnv1a(
      `${request.roomId}|${request.contentHash}|${promptVersion}|${uniqueClassifiers
        .slice()
        .sort()
        .join(',')}`,
    ),
  )}`;

  const packet: SemanticRefereePacket = {
    packetVersion: PACKET_VERSION,
    promptVersion,
    modelVersion: MOCK_MODEL_VERSION,
    provider: 'mock',
    authoritative: false,
    inputHash,
    contentHash: request.contentHash,
    roomId: request.roomId,
    binaries: Object.freeze(binaries),
    routeSuggestion: deriveRoute(binaries),
    frictionSuggestion: deriveFriction(binaries),
    scoreHints: Object.freeze(
      binaries.length > 0 ? deriveScoreHints(binaries) : { ...ZERO_SCORE_HINTS },
    ),
  };

  // Attach optional ids only when present (the schema rejects empty strings).
  const withOptionals: SemanticRefereePacket = {
    ...packet,
    ...(request.moveId ? { moveId: request.moveId } : {}),
    ...(request.parentId ? { parentId: request.parentId } : {}),
    ...(request.roomContext.selectedAction
      ? { selectedAction: request.roomContext.selectedAction }
      : {}),
    ...(request.roomContext.selectedMoveType
      ? { selectedMoveType: request.roomContext.selectedMoveType }
      : {}),
    ...(request.roomContext.debateMode ? { debateMode: request.roomContext.debateMode } : {}),
  };

  return Object.freeze(withOptionals);
}

/**
 * The deterministic minimal fallback packet — emitted when a provider's output
 * fails the outbound `SemanticRefereePacketSchema`. All binaries empty, no
 * route change, no friction, all `scoreHints` 0. Never a thrown error.
 */
export function buildFallbackPacket(request: ClassifyMoveRequest): SemanticRefereePacket {
  const promptVersion = request.promptVersionHint ?? MOCK_PROMPT_VERSION;
  const base: SemanticRefereePacket = {
    packetVersion: PACKET_VERSION,
    promptVersion,
    modelVersion: MOCK_MODEL_VERSION,
    provider: 'mock',
    authoritative: false,
    inputHash: `mock-fallback-${hashToken(fnv1a(`${request.roomId}|${request.contentHash}`))}`,
    contentHash: request.contentHash,
    roomId: request.roomId,
    binaries: Object.freeze([]),
    routeSuggestion: 'no_route_change',
    frictionSuggestion: 'none',
    scoreHints: Object.freeze({ ...ZERO_SCORE_HINTS }),
  };
  return Object.freeze({
    ...base,
    ...(request.moveId ? { moveId: request.moveId } : {}),
    ...(request.parentId ? { parentId: request.parentId } : {}),
  });
}
