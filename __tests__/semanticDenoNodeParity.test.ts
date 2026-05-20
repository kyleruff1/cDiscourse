/**
 * MCP-016 — Node ↔ Deno semantic-referee contract parity.
 *
 * The MCP-001 `SemanticRefereePacket` contract is mirrored in TWO trees:
 *   - Node (canonical): src/features/semanticReferee/semanticRefereeTypes.ts
 *     (owned by MCP-011, merged).
 *   - Deno (mirror): supabase/functions/_shared/semanticReferee/types.ts
 *     (owned by MCP-016).
 *
 * The Deno tree cannot be imported under Jest (`.ts` specifiers + `npm:` deps in
 * sibling files), and the Node tree cannot be imported into Deno. This suite
 * reads BOTH files AS SOURCE TEXT and asserts the contract surface is
 * identical, so a future MCP-001 contract change MUST update both. If the two
 * drift, the build fails here (MCP-009 §"Risks", MCP-011 §20 open question 5).
 *
 * The Node side is also imported as runtime values — the Node `ALL_*` arrays
 * are the ground truth the Deno source text is checked against.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_SEMANTIC_CLASSIFIER_IDS,
  ALL_ROUTE_SUGGESTIONS,
  ALL_FRICTION_SUGGESTIONS,
  ALL_CONFIDENCE_VALUES,
  ALL_SEMANTIC_PROVIDERS,
  PACKET_VERSION,
  SCORE_HINT_MIN,
  SCORE_HINT_MAX,
  SCORE_HINT_FIELDS,
} from '../src/features/semanticReferee';

const NODE_TYPES_PATH = path.join(
  process.cwd(),
  'src/features/semanticReferee/semanticRefereeTypes.ts',
);
const DENO_TYPES_PATH = path.join(
  process.cwd(),
  'supabase/functions/_shared/semanticReferee/types.ts',
);

const nodeSrc = fs.readFileSync(NODE_TYPES_PATH, 'utf8');
const denoSrc = fs.readFileSync(DENO_TYPES_PATH, 'utf8');

/**
 * Extract the string members of a named `const` array declaration from a
 * source file (e.g. `export const ALL_X: ... = [ 'a', 'b' ];`).
 */
function extractArrayMembers(src: string, constName: string): string[] {
  const re = new RegExp(`${constName}[^=]*=\\s*\\[([\\s\\S]*?)\\]`, 'm');
  const match = re.exec(src);
  if (!match) return [];
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

describe('Deno types.ts — mirror provenance', () => {
  it('documents that it is a mirror of the Node canonical file', () => {
    expect(denoSrc).toMatch(/MIRROR/i);
    expect(denoSrc).toMatch(/semanticRefereeTypes\.ts/);
  });

  it('points at this parity test', () => {
    expect(denoSrc).toMatch(/semanticDenoNodeParity\.test\.ts/);
  });

  it('imports nothing from src/ (the Deno tree cannot) and no npm: dependency', () => {
    expect(denoSrc).not.toMatch(/from ['"]\.\.\/\.\.\/.*src/);
    expect(denoSrc).not.toMatch(/from ['"]npm:/);
  });
});

describe('Deno ↔ Node parity — ALL_SEMANTIC_CLASSIFIER_IDS', () => {
  it('the Deno array lists exactly the Node catalog-v0 classifier ids, in order', () => {
    const denoIds = extractArrayMembers(denoSrc, 'ALL_SEMANTIC_CLASSIFIER_IDS');
    expect(denoIds).toEqual([...ALL_SEMANTIC_CLASSIFIER_IDS]);
  });

  it('the Deno SemanticClassifierId union lists every catalog id', () => {
    for (const id of ALL_SEMANTIC_CLASSIFIER_IDS) {
      expect(denoSrc).toContain(`'${id}'`);
    }
  });
});

describe('Deno ↔ Node parity — route / friction / confidence / provider arrays', () => {
  it('ALL_ROUTE_SUGGESTIONS matches the Node array', () => {
    expect(extractArrayMembers(denoSrc, 'ALL_ROUTE_SUGGESTIONS')).toEqual([
      ...ALL_ROUTE_SUGGESTIONS,
    ]);
  });

  it('ALL_FRICTION_SUGGESTIONS matches the Node array', () => {
    expect(extractArrayMembers(denoSrc, 'ALL_FRICTION_SUGGESTIONS')).toEqual([
      ...ALL_FRICTION_SUGGESTIONS,
    ]);
  });

  it('ALL_CONFIDENCE_VALUES matches the Node array', () => {
    expect(extractArrayMembers(denoSrc, 'ALL_CONFIDENCE_VALUES')).toEqual([
      ...ALL_CONFIDENCE_VALUES,
    ]);
  });

  it('ALL_SEMANTIC_PROVIDERS matches the Node array', () => {
    expect(extractArrayMembers(denoSrc, 'ALL_SEMANTIC_PROVIDERS')).toEqual([
      ...ALL_SEMANTIC_PROVIDERS,
    ]);
  });
});

describe('Deno ↔ Node parity — packet-version + score-hint bounds', () => {
  it('PACKET_VERSION matches', () => {
    expect(denoSrc).toContain(`PACKET_VERSION = '${PACKET_VERSION}'`);
    expect(nodeSrc).toContain(`PACKET_VERSION = '${PACKET_VERSION}'`);
  });

  it('SCORE_HINT_MIN / SCORE_HINT_MAX match the Node bounds', () => {
    expect(denoSrc).toMatch(new RegExp(`SCORE_HINT_MIN\\s*=\\s*${SCORE_HINT_MIN}\\b`));
    expect(denoSrc).toMatch(new RegExp(`SCORE_HINT_MAX\\s*=\\s*${SCORE_HINT_MAX}\\b`));
  });

  it('SCORE_HINT_FIELDS lists the same six scoreHints field names', () => {
    expect(extractArrayMembers(denoSrc, 'SCORE_HINT_FIELDS')).toEqual([...SCORE_HINT_FIELDS]);
  });
});

describe('Deno ↔ Node parity — SemanticRefereePacket field set', () => {
  /** The 17 fields of the MCP-001 packet contract (MCP-001 §7). */
  const PACKET_FIELDS = [
    'packetVersion',
    'promptVersion',
    'modelVersion',
    'provider',
    'authoritative',
    'inputHash',
    'contentHash',
    'roomId',
    'moveId',
    'parentId',
    'selectedAction',
    'selectedMoveType',
    'debateMode',
    'binaries',
    'routeSuggestion',
    'frictionSuggestion',
    'scoreHints',
  ];

  it('the Deno SemanticRefereePacket declares exactly the Node field set', () => {
    // Isolate each file's `SemanticRefereePacket = Readonly<{ ... }>` block.
    const blockRe = /SemanticRefereePacket\s*=\s*Readonly<\{([\s\S]*?)\}>/;
    const nodeBlock = blockRe.exec(nodeSrc)?.[1] ?? '';
    const denoBlock = blockRe.exec(denoSrc)?.[1] ?? '';
    expect(nodeBlock.length).toBeGreaterThan(0);
    expect(denoBlock.length).toBeGreaterThan(0);
    for (const field of PACKET_FIELDS) {
      expect(nodeBlock).toMatch(new RegExp(`\\b${field}\\??:`));
      expect(denoBlock).toMatch(new RegExp(`\\b${field}\\??:`));
    }
  });

  it('the Deno packet pins authoritative to the literal false', () => {
    expect(denoSrc).toMatch(/authoritative:\s*false/);
    expect(nodeSrc).toMatch(/authoritative:\s*false/);
  });
});
