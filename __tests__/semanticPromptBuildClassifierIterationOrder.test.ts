/**
 * MCP-MOD-005 — `buildClassifierPrompt` iteration-order pin.
 *
 * After the MCP-MOD-005 refactor, `buildClassifierPrompt` iterates
 * `SEMANTIC_CLASSIFIER_CATALOG` directly. Iteration order is the catalog's
 * declaration order, which matches `ALL_SEMANTIC_CLASSIFIER_IDS`. This test
 * pins that property: for `requestedClassifiers = ALL_SEMANTIC_CLASSIFIER_IDS`,
 * the question-line order in the prompt must match the catalog's declaration
 * order exactly.
 *
 * The risk this test addresses (per MCP-MOD-005 design §9): "Iteration order
 * silently changes when the catalog is reordered." A future change to the
 * catalog that reorders ids is a behaviour change the smoke-test baseline must
 * also accept; this test makes the order change visible at unit-test time so
 * it can be reviewed deliberately.
 *
 * Pure-TS. No network. No Supabase. No React. Uses the
 * `_helpers/semanticRefereeDeno.ts` Jest bridge to load the Deno modules.
 */
import {
  buildClassifierPrompt,
  DENO_SEMANTIC_CLASSIFIER_CATALOG,
  DENO_ALL_SEMANTIC_CLASSIFIER_IDS,
} from './_helpers/semanticRefereeDeno';
import { ALL_SEMANTIC_CLASSIFIER_IDS } from '../src/features/semanticReferee';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

function makeRequest(
  requestedClassifiers: readonly string[],
): ClassifyMoveRequest {
  return {
    roomId: 'room-iter-order',
    moveBodyRedacted: '[MOVE_BODY]',
    parentBodyRedacted: '[PARENT_BODY]',
    roomContext: { debateMode: 'standard' },
    requestedClassifiers: [...requestedClassifiers],
    contentHash: 'hash-iter-order',
  };
}

/**
 * Extract the per-id question lines from a rendered prompt in the order they
 * appear. Returns the ids only (the structural questions are byte-identical to
 * the catalog and are already covered by other tests).
 */
function extractQuestionLineIds(prompt: string): string[] {
  const lines = prompt.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    // Question lines look like `- <id>: <question>`. The id matches the
    // snake_case alphanumeric vocabulary used by every catalog id.
    const match = line.match(/^- ([a-z][a-z0-9_]*): /);
    if (match) result.push(match[1]);
  }
  return result;
}

describe('MCP-MOD-005 — buildClassifierPrompt iteration order', () => {
  it('emits question lines in catalog declaration order when all ids are requested in catalog order', () => {
    const prompt = buildClassifierPrompt(
      makeRequest([...ALL_SEMANTIC_CLASSIFIER_IDS]),
    );
    const ids = extractQuestionLineIds(prompt);
    expect(ids).toEqual([...ALL_SEMANTIC_CLASSIFIER_IDS]);
  });

  it('emits question lines in catalog declaration order when all ids are requested in REVERSE order (iteration source is the catalog, not the request)', () => {
    const reversed = [...ALL_SEMANTIC_CLASSIFIER_IDS].reverse();
    const prompt = buildClassifierPrompt(makeRequest(reversed));
    const ids = extractQuestionLineIds(prompt);
    // The new function iterates the catalog, so output is catalog order
    // regardless of caller order.
    expect(ids).toEqual([...ALL_SEMANTIC_CLASSIFIER_IDS]);
  });

  it('the catalog declaration order matches ALL_SEMANTIC_CLASSIFIER_IDS exactly', () => {
    const catalogIds = DENO_SEMANTIC_CLASSIFIER_CATALOG.map((entry) => entry.id);
    expect(catalogIds).toEqual([...DENO_ALL_SEMANTIC_CLASSIFIER_IDS]);
    expect(catalogIds).toEqual([...ALL_SEMANTIC_CLASSIFIER_IDS]);
  });

  it('preserves catalog order for a contiguous catalog subsequence', () => {
    // Request the 3rd through 8th catalog ids in catalog order.
    const slice = ALL_SEMANTIC_CLASSIFIER_IDS.slice(2, 8);
    const prompt = buildClassifierPrompt(makeRequest(slice));
    const ids = extractQuestionLineIds(prompt);
    expect(ids).toEqual([...slice]);
  });

  it('emits exactly one question line per unique catalog id even when caller repeats ids', () => {
    const repeated = [
      ALL_SEMANTIC_CLASSIFIER_IDS[0],
      ALL_SEMANTIC_CLASSIFIER_IDS[2],
      ALL_SEMANTIC_CLASSIFIER_IDS[2],
      ALL_SEMANTIC_CLASSIFIER_IDS[0],
      ALL_SEMANTIC_CLASSIFIER_IDS[5],
    ];
    const prompt = buildClassifierPrompt(makeRequest(repeated));
    const ids = extractQuestionLineIds(prompt);
    // De-duplication keeps each id once and the catalog-order iteration emits
    // them in catalog declaration order: indices 0, 2, 5.
    expect(ids).toEqual([
      ALL_SEMANTIC_CLASSIFIER_IDS[0],
      ALL_SEMANTIC_CLASSIFIER_IDS[2],
      ALL_SEMANTIC_CLASSIFIER_IDS[5],
    ]);
  });
});
