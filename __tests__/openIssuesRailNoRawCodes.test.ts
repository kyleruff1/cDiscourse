/**
 * REF-006-RAIL — no-raw-codes scan.
 *
 *   - No rendered string trips `looksLikeInternalCode` (`gameCopy.ts:906`).
 *   - The `issue.id` (`issue:<node>:<relation>:<axis>`) and every
 *     `sourceCode` / `rawKey` never appear in the rendered tree's text.
 *   - The row key IS the id but is never text content (only React key / testID).
 *
 * A `.ts` file (per the named test plan) → the component is mounted via
 * `React.createElement`, not JSX.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { OpenIssuesRail } from '../src/features/arguments/openIssuesRail/OpenIssuesRail';
import {
  buildOpenIssuesLedger,
  type OpenIssueLedgerCandidate,
} from '../src/features/arguments/openIssuesRail/openIssuesRailModel';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';
import { makeRailCandidate, makeRailIssue, makeRailMove } from './fixtures/openIssuesRailFixtures';

const NOOP = () => {};

/** Depth-first collect every leaf string (the actual rendered text). */
function collectText(node: unknown, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === 'string') {
    if (node.length > 0) out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return out;
  }
  const n = node as { children?: unknown };
  if (n.children != null) collectText(n.children, out);
  return out;
}

/** Depth-first collect every populated accessibilityLabel (screen-reader text). */
function collectA11yLabels(node: unknown, out: string[] = []): string[] {
  if (node == null || typeof node === 'string') return out;
  if (Array.isArray(node)) {
    for (const child of node) collectA11yLabels(child, out);
    return out;
  }
  const n = node as { props?: Record<string, unknown>; children?: unknown };
  const label = n.props?.accessibilityLabel;
  if (typeof label === 'string' && label.length > 0) out.push(label);
  if (n.children != null) collectA11yLabels(n.children, out);
  return out;
}

function richLedger() {
  const candidates: OpenIssueLedgerCandidate[] = [
    makeRailCandidate(
      makeRailIssue({
        id: 'issue:node-7:asks_source:evidence',
        targetNodeId: 'node-7',
        burden: 'source_owed',
        state: 'source_requested',
        contestedProposition: 'Bikes are safer than cars in dense downtown cores.',
        nextBestMoves: [makeRailMove('ask_source', 'Ask for a source')],
        refereeObservations: [
          { sourceCode: 'source_chain_gap', line: 'This move asks for a source.', toneGlyph: 'arrow', kind: 'machine_observation' },
        ],
      }),
      3,
      true,
    ),
    makeRailCandidate(
      makeRailIssue({
        id: 'issue:node-2:narrows:scope',
        targetNodeId: 'node-2',
        burden: 'none',
        state: 'narrowed',
        contestedProposition: 'The claim now applies only to peak commuting hours.',
      }),
      2,
    ),
  ];
  return buildOpenIssuesLedger(candidates, { maxEntries: 48 });
}

describe('REF-006-RAIL no-raw-codes — no rendered string trips looksLikeInternalCode', () => {
  it('every leaf text string is plain language (never an internal code)', () => {
    const ledger = richLedger();
    const tree = render(
      React.createElement(OpenIssuesRail, {
        ledger,
        defaultCollapsed: false,
        onJump: NOOP,
        onInspect: NOOP,
        onMove: NOOP,
      }),
    ).toJSON();
    const texts = collectText(tree);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      expect(looksLikeInternalCode(t)).toBe(false);
    }
  });

  it('every accessibilityLabel is plain language (never an internal code)', () => {
    const ledger = richLedger();
    const tree = render(
      React.createElement(OpenIssuesRail, {
        ledger,
        defaultCollapsed: false,
        onJump: NOOP,
        onInspect: NOOP,
        onMove: NOOP,
      }),
    ).toJSON();
    const labels = collectA11yLabels(tree);
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) {
      // The a11y sentence can contain plain prose; assert it never carries the
      // raw id / a sourceCode token.
      expect(l).not.toContain('issue:node-');
      expect(l).not.toContain('source_chain_gap');
      expect(l).not.toContain('asks_source');
    }
  });
});

describe('REF-006-RAIL no-raw-codes — issue.id / sourceCode / rawKey never reach the text', () => {
  it('the issue.id never appears as rendered text (it is React key + testID only)', () => {
    const ledger = richLedger();
    const tree = render(
      React.createElement(OpenIssuesRail, {
        ledger,
        defaultCollapsed: false,
        onJump: NOOP,
        onInspect: NOOP,
        onMove: NOOP,
      }),
    ).toJSON();
    const texts = collectText(tree).join('\n');
    for (const entry of ledger.entries) {
      expect(texts).not.toContain(entry.key); // the id is never text
    }
    // The relation/axis raw tokens in the id never leak as text.
    expect(texts).not.toContain('asks_source');
    expect(texts).not.toContain('source_chain_gap');
  });

  it('the row key still equals the issue id (carried only as a handle)', () => {
    const ledger = richLedger();
    expect(ledger.entries[0].key).toBe('issue:node-7:asks_source:evidence');
    // …and that handle is verified above to never be text content.
  });
});
