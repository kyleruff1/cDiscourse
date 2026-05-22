/**
 * MCP-017 — Node ↔ Deno content-safety ban-list parity.
 *
 * `contentSafetyScan.ts` (Deno boundary) is a parity-tested mirror of the
 * Stage-5 content scan in `semanticRefereeValidator.ts` (Node, MCP-011). The
 * Node validator imports Node `zod` and uses extensionless specifiers — the
 * Deno boundary cannot import it, so the ban-lists are duplicated. This suite
 * reads BOTH files AS SOURCE TEXT and fails the build if the ban-list constants
 * drift, so a new verdict / person token must be added to BOTH (design §8,
 * §11 risk "the Deno content scanner drifts from the Node validator").
 *
 * The Deno scanner must be a SUPERSET-OR-EQUAL of the Node validator: it must
 * reject everything the Node validator rejects. A token in the Node list but
 * missing from the Deno list is a failure.
 */
import * as fs from 'fs';
import * as path from 'path';

const NODE_VALIDATOR_PATH = path.join(
  process.cwd(),
  'src/features/semanticReferee/semanticRefereeValidator.ts',
);
const DENO_SCANNER_PATH = path.join(
  process.cwd(),
  'supabase/functions/_shared/semanticReferee/contentSafetyScan.ts',
);

const nodeSrc = fs.readFileSync(NODE_VALIDATOR_PATH, 'utf8');
const denoSrc = fs.readFileSync(DENO_SCANNER_PATH, 'utf8');

/**
 * Extract the string members of a named `const` array declaration from a
 * source file (e.g. `const VERDICT_TOKENS: readonly string[] = [ 'a', 'b' ];`).
 */
function extractArrayMembers(src: string, constName: string): string[] {
  const re = new RegExp(`${constName}[^=]*=\\s*\\[([\\s\\S]*?)\\]`, 'm');
  const match = re.exec(src);
  if (!match) {
    throw new Error(`could not find const array "${constName}"`);
  }
  return Array.from(match[1].matchAll(/'([^']*)'/g)).map((m) => m[1]);
}

describe('content-safety ban-list parity — verdict / person tokens', () => {
  it('the Deno VERDICT_TOKENS list is a superset-or-equal of the Node list', () => {
    const node = extractArrayMembers(nodeSrc, 'VERDICT_TOKENS');
    const deno = new Set(extractArrayMembers(denoSrc, 'VERDICT_TOKENS'));
    expect(node.length).toBeGreaterThan(0);
    for (const token of node) {
      expect(deno.has(token)).toBe(true);
    }
  });

  it('the Deno PERSON_LABEL_TOKENS list is a superset-or-equal of the Node list', () => {
    const node = extractArrayMembers(nodeSrc, 'PERSON_LABEL_TOKENS');
    const deno = new Set(extractArrayMembers(denoSrc, 'PERSON_LABEL_TOKENS'));
    expect(node.length).toBeGreaterThan(0);
    for (const token of node) {
      expect(deno.has(token)).toBe(true);
    }
  });

  it('the Deno PERSON_LABEL_PHRASES list is a superset-or-equal of the Node list', () => {
    const node = extractArrayMembers(nodeSrc, 'PERSON_LABEL_PHRASES');
    const deno = new Set(extractArrayMembers(denoSrc, 'PERSON_LABEL_PHRASES'));
    expect(node.length).toBeGreaterThan(0);
    for (const phrase of node) {
      expect(deno.has(phrase)).toBe(true);
    }
  });
});

describe('content-safety ban-list parity — smuggled field-name families', () => {
  for (const constName of [
    'BLOCK_FIELD_NAMES',
    'CHAIN_OF_THOUGHT_FIELD_NAMES',
    'RAW_PROMPT_FIELD_NAMES',
    'COPY_FIELD_NAMES',
  ]) {
    it(`the Deno ${constName} list is a superset-or-equal of the Node list`, () => {
      const node = extractArrayMembers(nodeSrc, constName);
      const deno = new Set(extractArrayMembers(denoSrc, constName));
      expect(node.length).toBeGreaterThan(0);
      for (const name of node) {
        expect(deno.has(name)).toBe(true);
      }
    });
  }
});

describe('content-safety ban-list parity — exact equality where the lists should match', () => {
  // For these four families the Deno and Node lists should be IDENTICAL — a
  // divergence in either direction is suspicious and fails here.
  for (const constName of [
    'VERDICT_TOKENS',
    'PERSON_LABEL_TOKENS',
    'BLOCK_FIELD_NAMES',
    'CHAIN_OF_THOUGHT_FIELD_NAMES',
  ]) {
    it(`${constName} is byte-identical between the Node validator and the Deno scanner`, () => {
      const node = extractArrayMembers(nodeSrc, constName);
      const deno = extractArrayMembers(denoSrc, constName);
      expect([...deno].sort()).toEqual([...node].sort());
    });
  }
});
