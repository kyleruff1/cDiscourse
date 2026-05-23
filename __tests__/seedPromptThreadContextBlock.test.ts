/**
 * MCP-MOD-008 — `buildClassifierPrompt` thread-context block.
 *
 * Pins the byte-for-byte format of the new "Room thread context" block that
 * `buildInputBlock` emits when `request.priorMovesRedacted` is non-empty. The
 * block sits ABOVE the parent + move blocks. When `priorMovesRedacted` is
 * absent or empty, the block is omitted entirely — the prompt collapses to
 * the pre-MCP-MOD-008 format so existing callers (smoke-test orchestrator,
 * fixtures) keep working unchanged.
 *
 * The prompt-version bump (`v1` → `v2`) is asserted in
 * `semanticRefereeSeedPromptEnumCoverage.test.ts`; here we focus on the
 * structural format.
 */
import { buildClassifierPrompt, SEED_PROMPT_VERSION } from './_helpers/semanticRefereeDeno';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

function makeRequest(overrides: Partial<ClassifyMoveRequest> = {}): ClassifyMoveRequest {
  return {
    roomId: 'room-1',
    moveBodyRedacted: 'A current move body.',
    parentBodyRedacted: 'A parent move body.',
    roomContext: {},
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'hash-1',
    ...overrides,
  };
}

describe('MCP-MOD-008 buildClassifierPrompt — prior-moves block presence', () => {
  it('omits the thread-context block when priorMovesRedacted is absent', () => {
    const prompt = buildClassifierPrompt(makeRequest());
    expect(prompt).not.toContain('Room thread context');
    // The pre-MCP-MOD-008 parent + move blocks are still there.
    expect(prompt).toContain('Parent move (the move being replied to):');
    expect(prompt).toContain('Move to classify:');
  });

  it('omits the thread-context block when priorMovesRedacted is an empty array', () => {
    const prompt = buildClassifierPrompt(
      makeRequest({ priorMovesRedacted: [] }),
    );
    expect(prompt).not.toContain('Room thread context');
  });

  it('emits the thread-context block when priorMovesRedacted has entries', () => {
    const prompt = buildClassifierPrompt(
      makeRequest({
        priorMovesRedacted: [
          { authorAlias: 'A', bodyRedacted: 'first prior move body' },
          { authorAlias: 'B', bodyRedacted: 'second prior move body' },
        ],
      }),
    );
    expect(prompt).toContain('Room thread context');
    expect(prompt).toContain('- Move 1 by A: first prior move body');
    expect(prompt).toContain('- Move 2 by B: second prior move body');
  });
});

describe('MCP-MOD-008 buildClassifierPrompt — block ordering', () => {
  it('emits the thread-context block ABOVE the parent + move blocks', () => {
    const prompt = buildClassifierPrompt(
      makeRequest({
        priorMovesRedacted: [
          { authorAlias: 'A', bodyRedacted: 'prior move body' },
        ],
      }),
    );
    const threadIdx = prompt.indexOf('Room thread context');
    const parentIdx = prompt.indexOf('Parent move');
    const moveIdx = prompt.indexOf('Move to classify');
    expect(threadIdx).toBeGreaterThan(-1);
    expect(parentIdx).toBeGreaterThan(-1);
    expect(moveIdx).toBeGreaterThan(-1);
    expect(threadIdx).toBeLessThan(parentIdx);
    expect(parentIdx).toBeLessThan(moveIdx);
  });

  it('preserves the chronological order of priorMovesRedacted entries', () => {
    const prompt = buildClassifierPrompt(
      makeRequest({
        priorMovesRedacted: [
          { authorAlias: 'A', bodyRedacted: 'oldest body' },
          { authorAlias: 'B', bodyRedacted: 'middle body' },
          { authorAlias: 'A', bodyRedacted: 'newest body' },
        ],
      }),
    );
    const oldestIdx = prompt.indexOf('oldest body');
    const middleIdx = prompt.indexOf('middle body');
    const newestIdx = prompt.indexOf('newest body');
    expect(oldestIdx).toBeGreaterThan(-1);
    expect(middleIdx).toBeGreaterThan(-1);
    expect(newestIdx).toBeGreaterThan(-1);
    expect(oldestIdx).toBeLessThan(middleIdx);
    expect(middleIdx).toBeLessThan(newestIdx);
  });
});

describe('MCP-MOD-008 buildClassifierPrompt — byte-for-byte format', () => {
  it('formats each entry as "- Move N by <alias>: <body>" with 1-indexed numbering', () => {
    const prompt = buildClassifierPrompt(
      makeRequest({
        priorMovesRedacted: [
          { authorAlias: 'A', bodyRedacted: 'first body' },
          { authorAlias: 'B', bodyRedacted: 'second body' },
          { authorAlias: 'C', bodyRedacted: 'third body' },
        ],
      }),
    );
    expect(prompt).toContain('- Move 1 by A: first body');
    expect(prompt).toContain('- Move 2 by B: second body');
    expect(prompt).toContain('- Move 3 by C: third body');
  });

  it('the thread-context block carries the documented preamble line', () => {
    const prompt = buildClassifierPrompt(
      makeRequest({
        priorMovesRedacted: [
          { authorAlias: 'A', bodyRedacted: 'body 1' },
        ],
      }),
    );
    expect(prompt).toContain('Room thread context (most recent move is the one to classify):');
  });

  it('an alias spanning the AA / AB wrap-around format is supported', () => {
    // Defensive — the unlikely 26+-distinct-author case. The helper allows
    // multi-char aliases up to the schema's MAX_ALIAS_LEN bound.
    const prompt = buildClassifierPrompt(
      makeRequest({
        priorMovesRedacted: [
          { authorAlias: 'Z', bodyRedacted: 'twenty-sixth body' },
          { authorAlias: 'AA', bodyRedacted: 'twenty-seventh body' },
        ],
      }),
    );
    expect(prompt).toContain('- Move 1 by Z: twenty-sixth body');
    expect(prompt).toContain('- Move 2 by AA: twenty-seventh body');
  });
});

describe('MCP-MOD-008 buildClassifierPrompt — interaction with the parent + move blocks', () => {
  it('still emits "Parent move: none" when parent is absent AND prior moves are present', () => {
    // A root-style move with a chime-in joining later might trigger this path.
    const prompt = buildClassifierPrompt(
      makeRequest({
        parentBodyRedacted: undefined,
        priorMovesRedacted: [
          { authorAlias: 'A', bodyRedacted: 'prior context move' },
        ],
      }),
    );
    expect(prompt).toContain('Parent move: none — this is a root move.');
    expect(prompt).toContain('Room thread context');
  });

  it('emits BOTH the prior-moves block AND the parent body when both are present', () => {
    const prompt = buildClassifierPrompt(
      makeRequest({
        parentBodyRedacted: 'The parent body.',
        priorMovesRedacted: [
          { authorAlias: 'A', bodyRedacted: 'a prior move body.' },
        ],
      }),
    );
    expect(prompt).toContain('a prior move body.');
    expect(prompt).toContain('The parent body.');
  });
});

describe('MCP-MOD-008 SEED_PROMPT_VERSION', () => {
  it('is v2 (bumped from v1 in MCP-MOD-008 for the structural format change)', () => {
    expect(SEED_PROMPT_VERSION).toBe('mcp-semantic-referee-prompt-v2');
  });
});
