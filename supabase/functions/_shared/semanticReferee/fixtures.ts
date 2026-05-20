/**
 * MCP-016 — Semantic referee local-development fixture map.
 *
 * A handful of synthetic, obviously-fake `SemanticRefereePacket`s — one per
 * route-suggestion family — keyed by `contentHash`. The `fixtureProvider`
 * reads this map so a developer can exercise realistic, NAMED packets without
 * a live call. On a miss the provider falls through to the deterministic mock.
 *
 * HARD RULE: every fixture is synthetic and obviously fake. No real secret, no
 * real @handle, no real URL, no real email, no real post id. Every string
 * field is a contract-valid `snake_case` reason code from a known reason-code
 * family — no verdict / person token anywhere.
 *
 * Pure TypeScript — no Deno-only API. No network. No env.
 */
import { PACKET_VERSION } from './types.ts';
import type { SemanticRefereePacket, SemanticScoreHints } from './types.ts';

const FIXTURE_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v0';
const FIXTURE_MODEL_VERSION = 'fixture-semantic-referee-v0';

function zeroHints(): SemanticScoreHints {
  return {
    continuityCredit: 0,
    evidencePressure: 0,
    branchHygiene: 0,
    synthesisReadiness: 0,
    sourceChainDebt: 0,
    unresolvedRedirectRisk: 0,
  };
}

function hints(partial: Partial<SemanticScoreHints>): SemanticScoreHints {
  return { ...zeroHints(), ...partial };
}

/**
 * The checked-in fixture map. Keys are SYNTHETIC content-hash strings — a
 * developer passes one of these as `contentHash` to exercise the named packet.
 */
export const SEMANTIC_REFEREE_FIXTURES: Readonly<Record<string, SemanticRefereePacket>> =
  Object.freeze({
    // ── Mainline continuity ──────────────────────────────────────
    'fixture-content-hash-mainline': Object.freeze({
      packetVersion: PACKET_VERSION,
      promptVersion: FIXTURE_PROMPT_VERSION,
      modelVersion: FIXTURE_MODEL_VERSION,
      provider: 'mock',
      authoritative: false,
      inputHash: 'fixture-input-mainline',
      contentHash: 'fixture-content-hash-mainline',
      roomId: 'fixture-room-mainline',
      binaries: Object.freeze([
        Object.freeze({
          classifierId: 'responds_to_parent' as const,
          value: 1 as const,
          confidence: 'high' as const,
          reasonCode: 'parent_continuity_direct_claim_response',
        }),
      ]),
      routeSuggestion: 'mainline',
      frictionSuggestion: 'none',
      scoreHints: Object.freeze(hints({ continuityCredit: 2 })),
    }),

    // ── Source-chain gap → ask for source ────────────────────────
    'fixture-content-hash-source-gap': Object.freeze({
      packetVersion: PACKET_VERSION,
      promptVersion: FIXTURE_PROMPT_VERSION,
      modelVersion: FIXTURE_MODEL_VERSION,
      provider: 'mock',
      authoritative: false,
      inputHash: 'fixture-input-source-gap',
      contentHash: 'fixture-content-hash-source-gap',
      roomId: 'fixture-room-source-gap',
      binaries: Object.freeze([
        Object.freeze({
          classifierId: 'creates_source_chain_gap' as const,
          value: 1 as const,
          confidence: 'medium' as const,
          reasonCode: 'source_chain_no_origin_path',
        }),
      ]),
      routeSuggestion: 'no_route_change',
      frictionSuggestion: 'ask_for_source',
      scoreHints: Object.freeze(hints({ sourceChainDebt: 2, evidencePressure: 1 })),
    }),

    // ── Side-branch suggestion ───────────────────────────────────
    'fixture-content-hash-branch': Object.freeze({
      packetVersion: PACKET_VERSION,
      promptVersion: FIXTURE_PROMPT_VERSION,
      modelVersion: FIXTURE_MODEL_VERSION,
      provider: 'mock',
      authoritative: false,
      inputHash: 'fixture-input-branch',
      contentHash: 'fixture-content-hash-branch',
      roomId: 'fixture-room-branch',
      binaries: Object.freeze([
        Object.freeze({
          classifierId: 'suggests_side_branch' as const,
          value: 1 as const,
          confidence: 'high' as const,
          reasonCode: 'branch_routing_same_topic_chime_in',
        }),
      ]),
      routeSuggestion: 'vertical_chime_branch',
      frictionSuggestion: 'suggest_branch',
      scoreHints: Object.freeze(hints({ branchHygiene: 2 })),
    }),

    // ── Diagonal tangent ─────────────────────────────────────────
    'fixture-content-hash-tangent': Object.freeze({
      packetVersion: PACKET_VERSION,
      promptVersion: FIXTURE_PROMPT_VERSION,
      modelVersion: FIXTURE_MODEL_VERSION,
      provider: 'mock',
      authoritative: false,
      inputHash: 'fixture-input-tangent',
      contentHash: 'fixture-content-hash-tangent',
      roomId: 'fixture-room-tangent',
      binaries: Object.freeze([
        Object.freeze({
          classifierId: 'suggests_diagonal_tangent' as const,
          value: 1 as const,
          confidence: 'medium' as const,
          reasonCode: 'branch_routing_off_axis_but_related',
        }),
      ]),
      routeSuggestion: 'diagonal_tangent',
      frictionSuggestion: 'suggest_branch',
      scoreHints: Object.freeze(hints({ unresolvedRedirectRisk: 1 })),
    }),

    // ── Synthesis readiness ──────────────────────────────────────
    'fixture-content-hash-synthesis': Object.freeze({
      packetVersion: PACKET_VERSION,
      promptVersion: FIXTURE_PROMPT_VERSION,
      modelVersion: FIXTURE_MODEL_VERSION,
      provider: 'mock',
      authoritative: false,
      inputHash: 'fixture-input-synthesis',
      contentHash: 'fixture-content-hash-synthesis',
      roomId: 'fixture-room-synthesis',
      binaries: Object.freeze([
        Object.freeze({
          classifierId: 'ready_for_synthesis' as const,
          value: 1 as const,
          confidence: 'high' as const,
          reasonCode: 'movement_shared_ground_reached',
        }),
      ]),
      routeSuggestion: 'synthesis_lane',
      frictionSuggestion: 'none',
      scoreHints: Object.freeze(hints({ synthesisReadiness: 3 })),
    }),

    // ── Pre-send pause (friction only, no route change) ──────────
    'fixture-content-hash-pause': Object.freeze({
      packetVersion: PACKET_VERSION,
      promptVersion: FIXTURE_PROMPT_VERSION,
      modelVersion: FIXTURE_MODEL_VERSION,
      provider: 'mock',
      authoritative: false,
      inputHash: 'fixture-input-pause',
      contentHash: 'fixture-content-hash-pause',
      roomId: 'fixture-room-pause',
      binaries: Object.freeze([
        Object.freeze({
          classifierId: 'needs_pre_send_pause' as const,
          value: 1 as const,
          confidence: 'low' as const,
          reasonCode: 'friction_heated_phrasing_observed',
        }),
      ]),
      routeSuggestion: 'no_route_change',
      frictionSuggestion: 'pre_send_pause',
      scoreHints: Object.freeze(zeroHints()),
    }),
  });

/** Every synthetic fixture key — exported so tests can iterate the map. */
export const SEMANTIC_REFEREE_FIXTURE_KEYS: readonly string[] = Object.freeze(
  Object.keys(SEMANTIC_REFEREE_FIXTURES),
);
