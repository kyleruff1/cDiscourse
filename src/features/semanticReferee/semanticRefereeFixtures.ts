/**
 * MCP-011 — Semantic referee fixtures + deterministic mock provider.
 *
 * 18 fixture groups (MCP-011 §10): valid packets, malformed payloads that trip
 * each rejection path, and cache-key pairs. Plus the deterministic
 * `mockFixtureProvider` — a TEST/DEV fixture source, NEVER a runtime provider.
 *
 * HARD RULE (MCP-011 §12): every fixture is synthetic, minimal, and obviously
 * fake. No fixture contains a real secret, a real API key, a real @handle, a
 * real post id, a real URL, a real email, or copied hostile text. Strings that
 * must TRIP the secret / PII scanners are ASSEMBLED by concatenation at module
 * load — no contiguous real-key-shaped literal sits in this file.
 *
 * SAFETY-SCAN NOTE: the malformed fixtures below deliberately carry synthetic
 * verdict / person / secret-shape strings so the validator's rejection tests
 * have something to reject. Documented expected false positive (MCP-011 §16).
 *
 * Pure TypeScript — no network, no Supabase, no React, no `Deno`, no env.
 */

import { parseSemanticPacket } from './semanticRefereeValidator';
import type { SemanticCacheKeyInput } from './semanticRefereeCacheKey';
import {
  PACKET_VERSION,
  SCORE_HINT_MAX,
} from './semanticRefereeTypes';
import type {
  SemanticClassifierId,
  SemanticRefereePacket,
  SemanticRejectionCode,
  SemanticScoreHints,
} from './semanticRefereeTypes';

// ── Synthetic shape builders (assembled at module load — never literal) ──

/**
 * A key-shaped string built by concatenation so no contiguous real-key-shaped
 * literal exists in the committed source. It only matches the SHAPE the
 * secret-shape scanner detects; it is not a real credential.
 */
const SYNTHETIC_SECRET_SHAPE = 'sk-' + 'ant-' + 'X'.repeat(24);

/** A synthetic @handle-shaped string — matches the PII shape, not a real user. */
const SYNTHETIC_HANDLE_SHAPE = '@' + 'fixture' + 'user';

/** A synthetic URL-shaped string — not a real link. */
const SYNTHETIC_URL_SHAPE = 'https://' + 'example' + '.invalid/' + 'fixture';

// ── Score-hint helpers ────────────────────────────────────────────

function zeroScoreHints(): SemanticScoreHints {
  return {
    continuityCredit: 0,
    evidencePressure: 0,
    branchHygiene: 0,
    synthesisReadiness: 0,
    sourceChainDebt: 0,
    unresolvedRedirectRisk: 0,
  };
}

function scoreHints(partial: Partial<SemanticScoreHints>): SemanticScoreHints {
  return { ...zeroScoreHints(), ...partial };
}

// ── 1. Valid packets ──────────────────────────────────────────────

const validMinimal: SemanticRefereePacket = {
  packetVersion: PACKET_VERSION,
  promptVersion: 'mcp-semantic-referee-prompt-v0',
  modelVersion: 'mock-model-0',
  provider: 'mock',
  authoritative: false,
  inputHash: 'inputhash-minimal',
  contentHash: 'contenthash-minimal',
  roomId: 'room-minimal',
  binaries: [
    {
      classifierId: 'responds_to_parent',
      value: 1,
      confidence: 'high',
      reasonCode: 'parent_continuity_direct_claim_response',
    },
  ],
  routeSuggestion: 'no_route_change',
  frictionSuggestion: 'none',
  scoreHints: zeroScoreHints(),
};

const validContinuity: SemanticRefereePacket = {
  packetVersion: PACKET_VERSION,
  promptVersion: 'mcp-semantic-referee-prompt-v0',
  modelVersion: 'mock-model-0',
  provider: 'mock',
  authoritative: false,
  inputHash: 'inputhash-continuity',
  contentHash: 'contenthash-continuity',
  roomId: 'room-continuity',
  moveId: 'move-continuity',
  parentId: 'parent-continuity',
  binaries: [
    {
      classifierId: 'responds_to_parent',
      value: 1,
      confidence: 'high',
      reasonCode: 'parent_continuity_answers_scope_claim',
    },
    {
      classifierId: 'introduces_new_issue',
      value: 0,
      confidence: 'medium',
      reasonCode: 'parent_continuity_same_axis',
    },
  ],
  routeSuggestion: 'mainline',
  frictionSuggestion: 'none',
  scoreHints: scoreHints({ continuityCredit: 2 }),
};

const validEvidenceDebt: SemanticRefereePacket = {
  packetVersion: PACKET_VERSION,
  promptVersion: 'mcp-semantic-referee-prompt-v0',
  modelVersion: 'mock-model-0',
  provider: 'mock',
  authoritative: false,
  inputHash: 'inputhash-evidence',
  contentHash: 'contenthash-evidence',
  roomId: 'room-evidence',
  binaries: [
    {
      classifierId: 'creates_source_chain_gap',
      value: 1,
      confidence: 'medium',
      reasonCode: 'source_chain_no_origin_path',
    },
  ],
  routeSuggestion: 'no_route_change',
  frictionSuggestion: 'ask_for_source',
  scoreHints: scoreHints({ sourceChainDebt: 2, evidencePressure: 1 }),
};

const validBranchRecommendation: SemanticRefereePacket = {
  packetVersion: PACKET_VERSION,
  promptVersion: 'mcp-semantic-referee-prompt-v0',
  modelVersion: 'mock-model-0',
  provider: 'mock',
  authoritative: false,
  inputHash: 'inputhash-branch',
  contentHash: 'contenthash-branch',
  roomId: 'room-branch',
  binaries: [
    {
      classifierId: 'suggests_side_branch',
      value: 1,
      confidence: 'high',
      reasonCode: 'branch_routing_same_topic_chime_in',
    },
  ],
  routeSuggestion: 'vertical_chime_branch',
  frictionSuggestion: 'suggest_branch',
  scoreHints: scoreHints({ branchHygiene: 2 }),
};

const validSynthesisReadiness: SemanticRefereePacket = {
  packetVersion: PACKET_VERSION,
  promptVersion: 'mcp-semantic-referee-prompt-v0',
  modelVersion: 'mock-model-0',
  provider: 'mock',
  authoritative: false,
  inputHash: 'inputhash-synthesis',
  contentHash: 'contenthash-synthesis',
  roomId: 'room-synthesis',
  binaries: [
    {
      classifierId: 'ready_for_synthesis',
      value: 1,
      confidence: 'high',
      reasonCode: 'movement_shared_ground_reached',
    },
  ],
  routeSuggestion: 'synthesis_lane',
  frictionSuggestion: 'none',
  scoreHints: scoreHints({ synthesisReadiness: 3 }),
};

const validConflictRouted: SemanticRefereePacket = {
  packetVersion: PACKET_VERSION,
  promptVersion: 'mcp-semantic-referee-prompt-v0',
  modelVersion: 'mock-model-0',
  provider: 'mock',
  authoritative: false,
  inputHash: 'inputhash-conflict',
  contentHash: 'contenthash-conflict',
  roomId: 'room-conflict',
  binaries: [
    {
      classifierId: 'responds_to_parent',
      value: 0,
      confidence: 'low',
      reasonCode: 'parent_continuity_redirects_topic',
    },
  ],
  routeSuggestion: 'diagonal_tangent',
  frictionSuggestion: 'suggest_branch',
  scoreHints: scoreHints({ unresolvedRedirectRisk: 1 }),
};

const validLowConfidence: SemanticRefereePacket = {
  packetVersion: PACKET_VERSION,
  promptVersion: 'mcp-semantic-referee-prompt-v0',
  modelVersion: 'mock-model-0',
  provider: 'mock',
  authoritative: false,
  inputHash: 'inputhash-lowconf',
  contentHash: 'contenthash-lowconf',
  roomId: 'room-lowconf',
  binaries: [
    {
      classifierId: 'contains_playable_hot_take',
      value: 1,
      confidence: 'low',
      reasonCode: 'mode_fit_provocative_but_claim_shaped',
    },
  ],
  routeSuggestion: 'no_route_change',
  frictionSuggestion: 'none',
  scoreHints: zeroScoreHints(),
};

/** Group 1-6 + 15 — packets that pass `parseSemanticPacket`. */
export const VALID_FIXTURES: Readonly<Record<string, SemanticRefereePacket>> = Object.freeze({
  validMinimal,
  validContinuity,
  validEvidenceDebt,
  validBranchRecommendation,
  validSynthesisReadiness,
  validConflictRouted,
  validLowConfidence,
});

// ── 2. Malformed payloads ─────────────────────────────────────────

export interface MalformedFixture {
  id: string;
  /** Group number per MCP-011 §10 (7..16); extra cases use 16. */
  group: number;
  /** A string for non-JSON; an object for the rest. Typed `unknown` by design. */
  raw: unknown;
  expectedRejectionCodes: readonly SemanticRejectionCode[];
  /** Plain-language description of the defect — no hostile text. */
  note: string;
}

/** A known-good base object the malformed fixtures mutate. */
function basePacketObject(): Record<string, unknown> {
  return {
    packetVersion: PACKET_VERSION,
    promptVersion: 'mcp-semantic-referee-prompt-v0',
    modelVersion: 'mock-model-0',
    provider: 'mock',
    authoritative: false,
    inputHash: 'inputhash-base',
    contentHash: 'contenthash-base',
    roomId: 'room-base',
    binaries: [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'parent_continuity_direct_claim_response',
      },
    ],
    routeSuggestion: 'no_route_change',
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 0,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
  };
}

export const MALFORMED_FIXTURES: readonly MalformedFixture[] = Object.freeze([
  // Group 7 — non-JSON.
  {
    id: 'malformed_non_json',
    group: 7,
    raw: 'this is not { valid json',
    expectedRejectionCodes: ['non_json'],
    note: 'raw is a string that does not parse as JSON',
  },
  // Group 8 — authoritative: true.
  {
    id: 'malformed_authoritative_true',
    group: 8,
    raw: { ...basePacketObject(), authoritative: true },
    expectedRejectionCodes: ['authoritative_not_false'],
    note: 'authoritative is true rather than the literal false',
  },
  // Group 9 — verdict token in a reasonCode.
  {
    id: 'malformed_verdict_token',
    group: 9,
    raw: {
      ...basePacketObject(),
      binaries: [
        {
          classifierId: 'responds_to_parent',
          value: 1,
          confidence: 'high',
          // Synthetic reasonCode: a known family with a banned outcome token.
          reasonCode: 'parent_continuity_winner_detected',
        },
      ],
    },
    expectedRejectionCodes: ['verdict_token'],
    note: 'a reasonCode segment contains an outcome / verdict token',
  },
  // Group 10 — person label in a string field.
  {
    id: 'malformed_person_label',
    group: 10,
    raw: {
      ...basePacketObject(),
      binaries: [
        {
          classifierId: 'responds_to_parent',
          value: 1,
          confidence: 'high',
          reasonCode: 'parent_continuity_direct_claim_response',
          evidenceSpan: 'the move calls the speaker a troll',
        },
      ],
    },
    expectedRejectionCodes: ['person_label'],
    note: 'an evidenceSpan contains a person-label token',
  },
  // Group 11 — secret-shaped string.
  {
    id: 'malformed_secret_shape',
    group: 11,
    raw: {
      ...basePacketObject(),
      binaries: [
        {
          classifierId: 'responds_to_parent',
          value: 1,
          confidence: 'high',
          reasonCode: 'parent_continuity_direct_claim_response',
          // Synthetic key-shaped string assembled at module load.
          evidenceSpan: 'leaked token ' + SYNTHETIC_SECRET_SHAPE,
        },
      ],
    },
    expectedRejectionCodes: ['secret_shape'],
    note: 'an evidenceSpan carries a synthetic key-shaped string',
  },
  // Group 12 — unknown classifier id.
  {
    id: 'malformed_unknown_classifier',
    group: 12,
    raw: {
      ...basePacketObject(),
      binaries: [
        {
          classifierId: 'not_a_real_classifier',
          value: 1,
          confidence: 'high',
          reasonCode: 'parent_continuity_direct_claim_response',
        },
      ],
    },
    expectedRejectionCodes: ['unknown_classifier_id'],
    note: 'a binary names a classifierId outside catalog v0',
  },
  // Group 13 — unknown route suggestion.
  {
    id: 'malformed_unknown_route',
    group: 13,
    raw: { ...basePacketObject(), routeSuggestion: 'teleport_lane' },
    expectedRejectionCodes: ['unknown_route_suggestion'],
    note: 'routeSuggestion is not a known route value',
  },
  // Group 14 — non-binary classifier value.
  {
    id: 'malformed_non_binary_value',
    group: 14,
    raw: {
      ...basePacketObject(),
      binaries: [
        {
          classifierId: 'responds_to_parent',
          value: 2,
          confidence: 'high',
          reasonCode: 'parent_continuity_direct_claim_response',
        },
      ],
    },
    expectedRejectionCodes: ['non_binary_value'],
    note: 'a binary value is 2 rather than 0 or 1',
  },
  // Group 16 — duplicate classifier id with conflicting values.
  {
    id: 'malformed_duplicate_classifier',
    group: 16,
    raw: {
      ...basePacketObject(),
      binaries: [
        {
          classifierId: 'responds_to_parent',
          value: 1,
          confidence: 'high',
          reasonCode: 'parent_continuity_direct_claim_response',
        },
        {
          classifierId: 'responds_to_parent',
          value: 0,
          confidence: 'low',
          reasonCode: 'parent_continuity_redirects_topic',
        },
      ],
    },
    expectedRejectionCodes: ['duplicate_classifier_id'],
    note: 'two binaries classify the same classifierId with conflicting values',
  },
  // ── Extra malformed coverage (MCP-011 §10, all group 16) ──
  {
    id: 'malformed_top_level_array',
    group: 16,
    raw: [basePacketObject()],
    expectedRejectionCodes: ['top_level_array'],
    note: 'the payload is a top-level array, not an object',
  },
  {
    id: 'malformed_block_field',
    group: 16,
    raw: { ...basePacketObject(), block: true },
    expectedRejectionCodes: ['block_field'],
    note: 'a block field is smuggled onto the packet',
  },
  {
    id: 'malformed_chain_of_thought_field',
    group: 16,
    raw: { ...basePacketObject(), reasoning: 'a paragraph of model deliberation' },
    expectedRejectionCodes: ['chain_of_thought_field'],
    note: 'a reasoning / chain-of-thought field is smuggled onto the packet',
  },
  {
    id: 'malformed_raw_prompt_field',
    group: 16,
    raw: { ...basePacketObject(), prompt: 'the original system prompt echoed back' },
    expectedRejectionCodes: ['raw_prompt_field'],
    note: 'a raw-prompt field is smuggled onto the packet',
  },
  {
    id: 'malformed_copy_field_smuggled',
    group: 16,
    raw: { ...basePacketObject(), bannerText: 'a user-facing banner string' },
    expectedRejectionCodes: ['copy_field_smuggled'],
    note: 'a user-facing copy field is smuggled onto the packet',
  },
  {
    id: 'malformed_score_hint_out_of_range',
    group: 16,
    raw: {
      ...basePacketObject(),
      scoreHints: {
        continuityCredit: SCORE_HINT_MAX + 6,
        evidencePressure: 0,
        branchHygiene: 0,
        synthesisReadiness: 0,
        sourceChainDebt: 0,
        unresolvedRedirectRisk: 0,
      },
    },
    expectedRejectionCodes: ['score_hint_out_of_range'],
    note: 'a scoreHints integer exceeds the bounded range',
  },
  {
    id: 'malformed_pii_handle_shape',
    group: 16,
    raw: {
      ...basePacketObject(),
      binaries: [
        {
          classifierId: 'responds_to_parent',
          value: 1,
          confidence: 'high',
          reasonCode: 'parent_continuity_direct_claim_response',
          evidenceSpan: 'cites ' + SYNTHETIC_HANDLE_SHAPE,
        },
      ],
    },
    expectedRejectionCodes: ['pii_shape'],
    note: 'an evidenceSpan carries a synthetic @handle-shaped string',
  },
  {
    id: 'malformed_pii_url_shape',
    group: 16,
    raw: {
      ...basePacketObject(),
      binaries: [
        {
          classifierId: 'responds_to_parent',
          value: 1,
          confidence: 'high',
          reasonCode: 'parent_continuity_direct_claim_response',
          parentSpan: 'links to ' + SYNTHETIC_URL_SHAPE,
        },
      ],
    },
    expectedRejectionCodes: ['pii_shape'],
    note: 'a parentSpan carries a synthetic URL-shaped string',
  },
  {
    id: 'malformed_reason_code_too_long',
    group: 16,
    raw: {
      ...basePacketObject(),
      binaries: [
        {
          classifierId: 'responds_to_parent',
          value: 1,
          confidence: 'high',
          reasonCode: 'parent_continuity_' + 'x'.repeat(300),
        },
      ],
    },
    expectedRejectionCodes: ['field_too_long'],
    note: 'a reasonCode exceeds the maximum length',
  },
  {
    id: 'malformed_reason_code_unknown_family',
    group: 16,
    raw: {
      ...basePacketObject(),
      binaries: [
        {
          classifierId: 'responds_to_parent',
          value: 1,
          confidence: 'high',
          reasonCode: 'nonsense_family_unmapped_token',
        },
      ],
    },
    expectedRejectionCodes: ['unknown_reason_code'],
    note: 'a reasonCode uses no known reason-code family prefix',
  },
  {
    id: 'malformed_unknown_confidence',
    group: 16,
    raw: {
      ...basePacketObject(),
      binaries: [
        {
          classifierId: 'responds_to_parent',
          value: 1,
          confidence: 'extremely-sure',
          reasonCode: 'parent_continuity_direct_claim_response',
        },
      ],
    },
    expectedRejectionCodes: ['unknown_confidence'],
    note: 'a binary confidence is not low / medium / high',
  },
  {
    id: 'malformed_unknown_friction',
    group: 16,
    raw: { ...basePacketObject(), frictionSuggestion: 'shut_it_down' },
    expectedRejectionCodes: ['unknown_friction_suggestion'],
    note: 'frictionSuggestion is not a known friction value',
  },
  {
    id: 'malformed_missing_required_field',
    group: 16,
    raw: (() => {
      const obj = basePacketObject();
      delete obj.roomId;
      return obj;
    })(),
    expectedRejectionCodes: ['missing_field'],
    note: 'a required top-level field (roomId) is absent',
  },
  {
    id: 'malformed_not_an_object',
    group: 16,
    raw: 42,
    expectedRejectionCodes: ['not_an_object'],
    note: 'the payload is a number, not an object',
  },
]);

// ── 3. Cache-key fixtures ─────────────────────────────────────────

export interface CacheKeyFixture {
  id: string;
  /** Group 17 (stable) | 18 (invalidation). */
  group: number;
  inputA: SemanticCacheKeyInput;
  inputB: SemanticCacheKeyInput;
  expect: 'same_key' | 'different_key';
  note: string;
}

export const CACHE_KEY_FIXTURES: readonly CacheKeyFixture[] = Object.freeze([
  // Group 17 — stable key under classifier-id reorder.
  {
    id: 'cachekey_stable_reorder',
    group: 17,
    inputA: {
      roomId: 'room-cache',
      parentId: 'parent-cache',
      contentHash: 'contenthash-cache',
      promptVersion: 'mcp-semantic-referee-prompt-v0',
      classifierIds: ['responds_to_parent', 'narrows_claim'],
      roomMode: 'casual',
      selectedAction: 'reply',
    },
    inputB: {
      roomId: 'room-cache',
      parentId: 'parent-cache',
      contentHash: 'contenthash-cache',
      promptVersion: 'mcp-semantic-referee-prompt-v0',
      classifierIds: ['narrows_claim', 'responds_to_parent'],
      roomMode: 'casual',
      selectedAction: 'reply',
    },
    expect: 'same_key',
    note: 'two inputs identical up to classifier-id order produce one key',
  },
  // Group 18 — invalidation on promptVersion change.
  {
    id: 'cachekey_promptversion_invalidates',
    group: 18,
    inputA: {
      roomId: 'room-cache',
      parentId: 'parent-cache',
      contentHash: 'contenthash-cache',
      promptVersion: 'mcp-semantic-referee-prompt-v0',
      classifierIds: ['responds_to_parent'],
      roomMode: 'casual',
      selectedAction: 'reply',
    },
    inputB: {
      roomId: 'room-cache',
      parentId: 'parent-cache',
      contentHash: 'contenthash-cache',
      promptVersion: 'mcp-semantic-referee-prompt-v1',
      classifierIds: ['responds_to_parent'],
      roomMode: 'casual',
      selectedAction: 'reply',
    },
    expect: 'different_key',
    note: 'two inputs differing only in promptVersion produce different keys',
  },
]);

// ── 4. Deterministic mock provider ────────────────────────────────

/**
 * A request to the mock provider. NOT a runtime API — this type exists only so
 * test/dev code can ask for a deterministic valid packet.
 */
export interface MockClassifyRequest {
  /** Pick a named valid fixture; defaults to the minimal valid packet. */
  fixtureId?: keyof typeof VALID_FIXTURES;
  roomId: string;
  classifierIds: readonly SemanticClassifierId[];
  contentHash: string;
  promptVersion?: string;
}

/**
 * The deterministic mock provider — a TEST/DEV fixture source, NOT a runtime
 * provider. Pure and synchronous: the same request returns a byte-identical
 * packet. Every packet it returns passes `parseSemanticPacket`, carries
 * `provider: 'mock'` and `authoritative: false`. It NEVER returns a malformed
 * fixture. It must not be wired into any screen or post path (MCP-011 §14).
 */
export function mockFixtureProvider(request: MockClassifyRequest): SemanticRefereePacket {
  const fixtureId: keyof typeof VALID_FIXTURES = request.fixtureId ?? 'validMinimal';
  const base = VALID_FIXTURES[fixtureId] ?? VALID_FIXTURES.validMinimal;
  const promptVersion = request.promptVersion ?? base.promptVersion;

  // Deterministically project the requested classifier set onto the base
  // binaries: keep base binaries whose classifierId was requested; if none
  // match, keep the base binaries unchanged so the packet stays valid.
  const requested = new Set<string>(request.classifierIds.map((id) => String(id)));
  const filtered = base.binaries.filter((b) => requested.has(b.classifierId));
  const binaries = filtered.length > 0 ? filtered : base.binaries;

  const packet: SemanticRefereePacket = Object.freeze({
    ...base,
    provider: 'mock',
    authoritative: false,
    roomId: request.roomId,
    contentHash: request.contentHash,
    promptVersion,
    binaries: Object.freeze(binaries.map((b) => Object.freeze({ ...b }))),
    scoreHints: Object.freeze({ ...base.scoreHints }),
  });
  return packet;
}

// ── Internal self-check helpers (used by the fixture tests) ───────

/** True if every `VALID_FIXTURES` entry passes `parseSemanticPacket`. */
export function allValidFixturesValidate(): boolean {
  return Object.values(VALID_FIXTURES).every(
    (packet) => parseSemanticPacket(packet).ok,
  );
}
