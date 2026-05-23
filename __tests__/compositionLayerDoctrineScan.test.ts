/**
 * COMP-001 §7.4 — Doctrine-scan tests for the composition layer.
 *
 * Two assertions:
 *
 *  1. Every value in `NodeVisualMutationType` contains no token from the
 *     verdict ban-list and no token from the person-label ban-list.
 *  2. For every composition rule's emitted mutation across a wide range of
 *     packet shapes, the same scan passes.
 *
 * Doctrine (cdiscourse-doctrine §1, §3): the composition layer maps
 * structural patterns to typed enum values. NEVER a verdict; NEVER a person
 * label. The CI suite fails if any mutation value contains a banned token.
 */

import { composeVisualState } from '../src/features/semanticReferee/compositionLayer';
import {
  ALL_NODE_VISUAL_MUTATION_TYPES,
  EMPTY_COMPOSITION_STATE,
  type AncestorMoveSummary,
  type ComposeVisualStateInput,
  type MoveMetadata,
  type NodeVisualMutationType,
} from '../src/features/semanticReferee/compositionTypes';
import type {
  SemanticBinarySample,
  SemanticClassifierId,
  SemanticRefereePacket,
} from '../src/features/semanticReferee/semanticRefereeTypes';
import {
  ALL_SEMANTIC_CLASSIFIER_IDS,
  PACKET_VERSION,
} from '../src/features/semanticReferee/semanticRefereeTypes';

const VERDICT_BAN_LIST: readonly string[] = [
  'winner',
  'loser',
  'truth',
  ' true',
  ' false',
  'correct',
  'wrong',
  'right',
  'proven',
  'defeated',
  'won',
  'lost',
];

const PERSON_LABEL_BAN_LIST: readonly string[] = [
  'liar',
  'lying',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'dumb',
  'troll',
];

function scanString(s: string): { offending: string; banlist: 'verdict' | 'person' } | null {
  const lower = s.toLowerCase();
  for (const token of VERDICT_BAN_LIST) {
    // Use simple substring match — we accept "right" matching "alright" as a
    // false-positive risk; the enum values are short snake_case identifiers
    // so the risk is minimal. The test sources are also reviewed.
    if (lower.includes(token)) {
      return { offending: token, banlist: 'verdict' };
    }
  }
  for (const token of PERSON_LABEL_BAN_LIST) {
    if (lower.includes(token)) {
      return { offending: token, banlist: 'person' };
    }
  }
  return null;
}

describe('COMP-001 §7.4 — doctrine scan on NodeVisualMutationType values', () => {
  it.each(ALL_NODE_VISUAL_MUTATION_TYPES)(
    'mutation type "%s" contains no verdict or person-label token',
    (t: NodeVisualMutationType) => {
      const hit = scanString(t);
      expect(hit).toBeNull();
    },
  );
});

describe('COMP-001 §7.4 — doctrine scan on emitted mutations across all rules', () => {
  function makePacket(
    binaries: Array<{ classifierId: SemanticClassifierId; value: 0 | 1 }>,
  ): SemanticRefereePacket {
    return {
      packetVersion: PACKET_VERSION,
      promptVersion: 'mcp-semantic-referee-prompt-v0',
      modelVersion: 'mock-model-0',
      provider: 'mock',
      authoritative: false,
      inputHash: 'h',
      contentHash: 'h',
      roomId: 'r',
      binaries: binaries.map((b) => ({
        classifierId: b.classifierId,
        value: b.value,
        confidence: 'high',
        reasonCode: `${b.classifierId}_test`,
      })) as readonly SemanticBinarySample[],
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

  const meta: MoveMetadata = {
    moveId: 'm2',
    parentId: 'm1',
    authorId: 'authorB',
    authorMovePosition: 'subsequent',
  };

  const ancestors: AncestorMoveSummary[] = [
    { moveId: 'm1', parentId: null, authorId: 'authorA' },
  ];

  // Test all-ones across the entire current catalog — every rule fires.
  it('emits no banned token across the all-ones packet (every active rule fires)', () => {
    const allOnes = ALL_SEMANTIC_CLASSIFIER_IDS.map((id) => ({ classifierId: id, value: 1 as const }));
    const input: ComposeVisualStateInput = {
      packet: makePacket(allOnes),
      threadState: EMPTY_COMPOSITION_STATE,
      moveMeta: meta,
      ancestors,
    };
    const result = composeVisualState(input);
    for (const m of result.mutations) {
      const hit = scanString(m.mutation);
      expect(hit).toBeNull();
      // sourceClassifier values are catalog ids or 'exemption'/'derived';
      // scan those too defensively (they're constants, but rules drift).
      const srcHit = scanString(String(m.sourceClassifier));
      expect(srcHit).toBeNull();
    }
  });

  it('emits no banned token on the root exemption path', () => {
    const result = composeVisualState({
      threadState: EMPTY_COMPOSITION_STATE,
      moveMeta: { ...meta, moveId: 'm1', parentId: null },
    });
    for (const m of result.mutations) {
      expect(scanString(m.mutation)).toBeNull();
    }
  });
});
