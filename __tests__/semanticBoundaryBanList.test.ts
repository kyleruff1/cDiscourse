/**
 * MCP-016 — semantic-referee boundary doctrine ban-list scan.
 *
 * Scans every string the boundary can produce — every `reason` code, every
 * mock-emitted `reasonCode` / route / friction value, every fixture string
 * field — for verdict / person tokens. Zero matches (cdiscourse-doctrine §1).
 *
 * The boundary transports a structural-only packet; nothing it produces may
 * read as a truth label or a person label.
 */
import {
  runMockClassifier,
  SEMANTIC_REFEREE_FIXTURES,
  SEMANTIC_REFEREE_FIXTURE_KEYS,
} from './_helpers/semanticRefereeDeno';
import { ALL_SEMANTIC_CLASSIFIER_IDS } from '../src/features/semanticReferee';
import type { SemanticRefereePacket } from '../src/features/semanticReferee';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

/**
 * Verdict / person tokens. A produced string carrying any of these (as a
 * whole word or a `snake_case` segment) is a doctrine violation.
 */
const BANNED_TOKENS: readonly string[] = [
  'winner',
  'loser',
  'won',
  'lost',
  'right',
  'wrong',
  'true',
  'false',
  'correct',
  'incorrect',
  'proven',
  'defeated',
  'liar',
  'lying',
  'dishonest',
  'manipulative',
  'troll',
  'propagandist',
  'extremist',
  'stupid',
  'idiot',
  'dumb',
  'smart',
];

const BANNED_PHRASES: readonly string[] = ['bad faith'];

/** Split a string into lowercase word / snake_case segments. */
function tokenSegments(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((seg) => seg.length > 0);
}

/** Assert one string carries no banned token / phrase. */
function expectClean(value: string, context: string): void {
  const segments = new Set(tokenSegments(value));
  for (const token of BANNED_TOKENS) {
    if (segments.has(token)) {
      throw new Error(`banned token "${token}" found in ${context}: "${value}"`);
    }
  }
  const collapsed = value.toLowerCase().replace(/\s+/g, ' ');
  for (const phrase of BANNED_PHRASES) {
    if (collapsed.includes(phrase)) {
      throw new Error(`banned phrase "${phrase}" found in ${context}: "${value}"`);
    }
  }
}

/** Every string field a packet can carry. */
function packetStrings(packet: SemanticRefereePacket): string[] {
  const out: string[] = [
    packet.provider,
    packet.routeSuggestion,
    packet.frictionSuggestion,
  ];
  for (const binary of packet.binaries) {
    out.push(binary.classifierId, binary.confidence, binary.reasonCode);
    if (binary.evidenceSpan) out.push(binary.evidenceSpan);
    if (binary.parentSpan) out.push(binary.parentSpan);
  }
  return out;
}

function makeRequest(overrides: Partial<ClassifyMoveRequest> = {}): ClassifyMoveRequest {
  return {
    roomId: 'room-1',
    moveBodyRedacted: 'A move body.',
    roomContext: {},
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'hash-1',
    ...overrides,
  };
}

describe('ban-list — the reason codes the boundary returns', () => {
  it('the three disabled reason codes carry no banned token', () => {
    for (const reason of ['disabled', 'not_configured', 'not_implemented']) {
      expectClean(reason, 'disabled reason code');
    }
  });
});

describe('ban-list — every mock-produced packet string is clean', () => {
  it('the mock emits no banned token across every catalog-v0 classifier', () => {
    for (const id of ALL_SEMANTIC_CLASSIFIER_IDS) {
      const packet = runMockClassifier(makeRequest({ requestedClassifiers: [id] }));
      for (const str of packetStrings(packet)) {
        expectClean(str, `mock packet (classifier ${id})`);
      }
    }
  });

  it('the mock emits no banned token for a root move and a parented move', () => {
    for (const parented of [true, false]) {
      const packet = runMockClassifier(
        makeRequest(parented ? { parentId: 'p1', parentBodyRedacted: 'parent' } : {}),
      );
      for (const str of packetStrings(packet)) {
        expectClean(str, `mock packet (parented=${parented})`);
      }
    }
  });
});

describe('ban-list — every fixture string is clean', () => {
  it('no fixture packet carries a banned token in any string field', () => {
    for (const key of SEMANTIC_REFEREE_FIXTURE_KEYS) {
      const packet = SEMANTIC_REFEREE_FIXTURES[key];
      expectClean(key, `fixture key`);
      for (const str of packetStrings(packet)) {
        expectClean(str, `fixture "${key}"`);
      }
      expectClean(packet.inputHash, `fixture "${key}" inputHash`);
      expectClean(packet.contentHash, `fixture "${key}" contentHash`);
      expectClean(packet.modelVersion, `fixture "${key}" modelVersion`);
      expectClean(packet.promptVersion, `fixture "${key}" promptVersion`);
    }
  });
});
