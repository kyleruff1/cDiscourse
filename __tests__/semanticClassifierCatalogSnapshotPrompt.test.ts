/**
 * MCP-MOD-004 — `buildClassifierPrompt` byte-identity snapshot.
 *
 * The behavior-preservation regression check for MCP-MOD-004. Captures the
 * `buildClassifierPrompt` output for a fixed deterministic sample (the first
 * three catalog ids, declaration order) and asserts it matches a golden file
 * byte-for-byte.
 *
 * The golden file was captured BEFORE the catalog refactor was introduced and
 * committed to the branch as
 * `__tests__/__fixtures__/semanticClassifierCatalog/firstThreeIdsGolden.txt`.
 * Any drift in the catalog's `structuralQuestion`, in the prompt assembly
 * mechanism, in the worked example, or in the redacted-input block will fail
 * this test. The fixture is the explicit pre-refactor reference; touching the
 * fixture without a corresponding `SEED_PROMPT_VERSION` bump is a doctrine
 * violation (MCP-MOD-003 inventory §6).
 *
 * The sample request mirrors `docs/architecture/semantic-referee-prompt-template.md`
 * § "Deterministic sample — first three catalog ids".
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildClassifierPrompt } from './_helpers/semanticRefereeDeno';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

const GOLDEN_PATH = path.join(
  process.cwd(),
  '__tests__/__fixtures__/semanticClassifierCatalog/firstThreeIdsGolden.txt',
);

const SAMPLE_REQUEST: ClassifyMoveRequest = {
  roomId: 'room-doc-sample',
  moveBodyRedacted: '[MOVE_BODY]',
  parentBodyRedacted: '[PARENT_BODY]',
  roomContext: { debateMode: 'standard' },
  requestedClassifiers: ['responds_to_parent', 'introduces_new_issue', 'asks_for_evidence'],
  contentHash: 'h0',
};

describe('MCP-MOD-004 — buildClassifierPrompt byte-identity snapshot', () => {
  it('the golden file exists at the documented path', () => {
    expect(fs.existsSync(GOLDEN_PATH)).toBe(true);
  });

  it('buildClassifierPrompt(SAMPLE_REQUEST) matches the golden file byte-for-byte', () => {
    const golden = fs.readFileSync(GOLDEN_PATH, 'utf8');
    const actual = buildClassifierPrompt(SAMPLE_REQUEST);
    expect(actual).toBe(golden);
  });

  it('the prompt output is non-empty and contains the three requested question lines', () => {
    const actual = buildClassifierPrompt(SAMPLE_REQUEST);
    expect(actual.length).toBeGreaterThan(0);
    for (const id of SAMPLE_REQUEST.requestedClassifiers) {
      expect(actual).toContain(`- ${id}:`);
    }
  });

  it('the prompt output is stable across repeated invocations (no time / randomness)', () => {
    const first = buildClassifierPrompt(SAMPLE_REQUEST);
    const second = buildClassifierPrompt(SAMPLE_REQUEST);
    expect(first).toBe(second);
  });
});
