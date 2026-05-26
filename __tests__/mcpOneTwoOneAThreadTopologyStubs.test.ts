/**
 * MCP-021A — Thread-topology auto-metadata deriver stubs.
 *
 * Per Decision 7 + design §3.9 + design §11: MCP-021A ships NO-OP STUBS
 * only. The actual derivers are MCP-021C territory. These tests verify
 * the stubs return [] / null deterministically for every input,
 * preserving byte-equal runtime behavior.
 *
 * Doctrine anchor: design Decision 7 — "MCP-021A only adds registry
 * entries (NOT the derivation), so deriver remains a no-op stub until
 * MCP-021C wires actual computation."
 */

import {
  deriveAllThreadTopologyAutoMetadata,
  deriveMergesThread,
  deriveReferencesAncestorNode,
  deriveReferencesSiblingNode,
  deriveSplitsThread,
  type ThreadTopologyAutoMetadataInput,
} from '../src/features/nodeLabels/threadTopologyAutoMetadata';

const MINIMAL_INPUT: ThreadTopologyAutoMetadataInput = {
  nodeId: 'node-1',
  parentNodeId: null,
};

const RICH_INPUT: ThreadTopologyAutoMetadataInput = {
  nodeId: 'node-deep',
  parentNodeId: 'node-parent',
  siblingNodeIds: ['node-sib-1', 'node-sib-2'],
  ancestorNodeIds: ['node-root', 'node-grand', 'node-parent'],
  crossReferences: [
    { targetNodeId: 'node-sib-1' },
    { targetNodeId: 'node-root' },
  ],
};

describe('MCP-021A — deriveSplitsThread (no-op stub)', () => {
  it('returns [] for minimal input', () => {
    expect(deriveSplitsThread(MINIMAL_INPUT)).toEqual([]);
  });

  it('returns [] for rich input with siblings', () => {
    expect(deriveSplitsThread(RICH_INPUT)).toEqual([]);
  });

  it('returns [] for input with no siblings array', () => {
    expect(deriveSplitsThread({ nodeId: 'x', parentNodeId: 'y' })).toEqual([]);
  });
});

describe('MCP-021A — deriveMergesThread (no-op stub)', () => {
  it('returns [] for minimal input', () => {
    expect(deriveMergesThread(MINIMAL_INPUT)).toEqual([]);
  });

  it('returns [] for rich input with cross-references', () => {
    expect(deriveMergesThread(RICH_INPUT)).toEqual([]);
  });
});

describe('MCP-021A — deriveReferencesSiblingNode (no-op stub)', () => {
  it('returns [] for minimal input', () => {
    expect(deriveReferencesSiblingNode(MINIMAL_INPUT)).toEqual([]);
  });

  it('returns [] for input with sibling cross-reference', () => {
    expect(deriveReferencesSiblingNode(RICH_INPUT)).toEqual([]);
  });
});

describe('MCP-021A — deriveReferencesAncestorNode (no-op stub)', () => {
  it('returns [] for minimal input', () => {
    expect(deriveReferencesAncestorNode(MINIMAL_INPUT)).toEqual([]);
  });

  it('returns [] for input with ancestor cross-reference', () => {
    expect(deriveReferencesAncestorNode(RICH_INPUT)).toEqual([]);
  });
});

describe('MCP-021A — deriveAllThreadTopologyAutoMetadata aggregator (no-op stub)', () => {
  it('returns [] for minimal input', () => {
    expect(deriveAllThreadTopologyAutoMetadata(MINIMAL_INPUT)).toEqual([]);
  });

  it('returns [] for rich input', () => {
    expect(deriveAllThreadTopologyAutoMetadata(RICH_INPUT)).toEqual([]);
  });

  it('returns [] for a battery of varied inputs (deterministic stub)', () => {
    const batteryInputs: ThreadTopologyAutoMetadataInput[] = [
      { nodeId: 'a', parentNodeId: null },
      { nodeId: 'b', parentNodeId: 'a' },
      { nodeId: 'c', parentNodeId: 'b', siblingNodeIds: [] },
      { nodeId: 'd', parentNodeId: 'b', siblingNodeIds: ['e', 'f'] },
      { nodeId: 'g', parentNodeId: 'b', ancestorNodeIds: ['root', 'a', 'b'] },
      {
        nodeId: 'h',
        parentNodeId: 'b',
        crossReferences: [{ targetNodeId: 'root' }],
      },
    ];
    for (const input of batteryInputs) {
      expect(deriveAllThreadTopologyAutoMetadata(input)).toEqual([]);
    }
  });
});
