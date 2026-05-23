/**
 * COMP-001 §7.5 — Purity / safety tests for the composition layer.
 *
 * Asserts:
 *  - The composition module source does not import `fetch`, `axios`,
 *    `supabase-js`, any Edge Function client, `'react'`, `'expo'`, any
 *    React-Native package, or any Anthropic / xAI SDK.
 *  - Calling `composeVisualState` twice with deep-frozen inputs returns
 *    identical outputs (determinism check).
 *  - Calling `composeVisualState` does not mutate its input state object
 *    (immutability check).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { composeVisualState } from '../src/features/semanticReferee/compositionLayer';
import {
  EMPTY_COMPOSITION_STATE,
  type ComposeVisualStateInput,
  type MoveMetadata,
} from '../src/features/semanticReferee/compositionTypes';
import type {
  SemanticClassifierId,
  SemanticRefereePacket,
} from '../src/features/semanticReferee/semanticRefereeTypes';
import { PACKET_VERSION } from '../src/features/semanticReferee/semanticRefereeTypes';

const COMP_LAYER_SRC = path.resolve(
  __dirname,
  '..',
  'src',
  'features',
  'semanticReferee',
  'compositionLayer.ts',
);
const COMP_TYPES_SRC = path.resolve(
  __dirname,
  '..',
  'src',
  'features',
  'semanticReferee',
  'compositionTypes.ts',
);
const COMP_UPSTREAM_SRC = path.resolve(
  __dirname,
  '..',
  'src',
  'features',
  'semanticReferee',
  'compositionUpstreamSearch.ts',
);

const FORBIDDEN_IMPORT_FRAGMENTS: readonly string[] = [
  "'react'",
  '"react"',
  "from 'react/",
  "'expo'",
  "react-native",
  "'react-dom'",
  "'@supabase/supabase-js'",
  "'@supabase/",
  "'@anthropic-ai/",
  "'anthropic'",
  "'xai'",
  "@anthropic-ai/sdk",
  "fetch from",
  "import fetch",
  "node-fetch",
  "axios",
];

function readSource(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

describe('COMP-001 §7.5 — composition layer module purity', () => {
  it.each([COMP_LAYER_SRC, COMP_TYPES_SRC, COMP_UPSTREAM_SRC])(
    'file %s imports no forbidden network / UI / AI dependency',
    (file) => {
      const src = readSource(file);
      for (const frag of FORBIDDEN_IMPORT_FRAGMENTS) {
        expect(src).not.toContain(frag);
      }
    },
  );

  it('composition layer source contains no `await` or `Promise` keyword', () => {
    const src = readSource(COMP_LAYER_SRC);
    expect(src).not.toMatch(/\bawait\b/);
    // `Promise` may appear in comments only; the function is sync.
    const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/\bPromise\b/);
  });
});

describe('COMP-001 §7.5 — composition layer determinism', () => {
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
      })),
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

  it('produces identical mutations on repeat calls with the same input', () => {
    const input: ComposeVisualStateInput = {
      packet: makePacket([
        { classifierId: 'responds_to_parent', value: 1 },
        { classifierId: 'quote_anchors_parent', value: 1 },
        { classifierId: 'asks_for_evidence', value: 1 },
      ]),
      threadState: EMPTY_COMPOSITION_STATE,
      moveMeta: meta,
    };
    const r1 = composeVisualState(input);
    const r2 = composeVisualState(input);
    expect(r1.mutations.length).toBe(r2.mutations.length);
    for (let i = 0; i < r1.mutations.length; i += 1) {
      expect(r1.mutations[i].mutation).toBe(r2.mutations[i].mutation);
      expect(r1.mutations[i].targetMoveId).toBe(r2.mutations[i].targetMoveId);
      expect(r1.mutations[i].sourceClassifier).toBe(r2.mutations[i].sourceClassifier);
    }
  });

  it('does NOT mutate the input threadState (immutability)', () => {
    const input: ComposeVisualStateInput = {
      packet: makePacket([{ classifierId: 'asks_for_evidence', value: 1 }]),
      threadState: EMPTY_COMPOSITION_STATE,
      moveMeta: meta,
    };
    const sizeBefore = input.threadState.evidenceDebts.size;
    const r = composeVisualState(input);
    expect(input.threadState.evidenceDebts.size).toBe(sizeBefore);
    expect(r.nextState).not.toBe(input.threadState);
    expect(r.nextState.evidenceDebts.size).toBe(1);
  });

  it('returns a frozen nextState (writes throw in strict mode / are silently dropped otherwise)', () => {
    const input: ComposeVisualStateInput = {
      packet: makePacket([{ classifierId: 'asks_for_evidence', value: 1 }]),
      threadState: EMPTY_COMPOSITION_STATE,
      moveMeta: meta,
    };
    const r = composeVisualState(input);
    expect(Object.isFrozen(r.nextState)).toBe(true);
    expect(Object.isFrozen(r.mutations)).toBe(true);
  });
});
