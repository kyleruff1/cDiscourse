/**
 * UX-MEDIATOR-002 — MediatorNodeInspectDetail component tests.
 *
 * The read-only mediator-state detail block shown INSIDE the Inspect overlay
 * after the one-chip soup collapse. Verifies it renders the state label +
 * helper + next-move pathway, suppresses cleanly (null marker → null render),
 * omits the next-move row when there is no available pathway, and leaks no
 * internal codes / banned tokens.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { MediatorNodeInspectDetail } from '../src/features/mediator/MediatorNodeInspectDetail';
import type { NodeMediatorMarker } from '../src/features/mediator/nodeMediatorMarkers';
import { _forbiddenMediatorTokens } from '../src/features/mediator';

function marker(
  p: Partial<NodeMediatorMarker> & { code: NodeMediatorMarker['code']; label: string },
): NodeMediatorMarker {
  return { nodeId: p.nodeId ?? 'n1', code: p.code, label: p.label, isImpasse: p.isImpasse ?? false };
}

function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object') return collectText((node as { children?: unknown }).children);
  return [];
}

describe('UX-MEDIATOR-002 MediatorNodeInspectDetail', () => {
  it('renders nothing when there is no marker', () => {
    expect(
      render(
        <MediatorNodeInspectDetail marker={null} helper="x" nextMoveLabel="y" />,
      ).toJSON(),
    ).toBeNull();
  });

  it('renders the state label, helper sentence and next-move pathway', () => {
    const { getByText, getByTestId } = render(
      <MediatorNodeInspectDetail
        marker={marker({ code: 'needs_evidence', label: 'Needs evidence' })}
        helper="A source or quote was asked for and is still owed."
        nextMoveLabel="Provide a source"
      />,
    );
    expect(getByText('Needs evidence')).toBeTruthy();
    expect(getByText('A source or quote was asked for and is still owed.')).toBeTruthy();
    expect(getByText('What would help next: Provide a source')).toBeTruthy();
    expect(getByTestId('mediator-node-inspect-detail-n1')).toBeTruthy();
  });

  it('omits the next-move row when no pathway is available (e.g. impasse)', () => {
    const { queryByTestId, getByText } = render(
      <MediatorNodeInspectDetail
        marker={marker({ code: 'structured_impasse', label: 'Structured impasse', isImpasse: true })}
        helper="Both sides made the case and no new pathway is available at the moment."
        nextMoveLabel={null}
      />,
    );
    expect(getByText('Structured impasse')).toBeTruthy();
    expect(queryByTestId('mediator-node-inspect-detail-n1-next-move')).toBeNull();
  });

  it('omits the helper row when there is no helper', () => {
    const { queryByTestId, getByText } = render(
      <MediatorNodeInspectDetail
        marker={marker({ code: 'needs_evidence', label: 'Needs evidence' })}
        helper=""
        nextMoveLabel={null}
      />,
    );
    expect(getByText('Needs evidence')).toBeTruthy();
    expect(queryByTestId('mediator-node-inspect-detail-n1-helper')).toBeNull();
  });

  it('suppresses a label that reads as a raw internal code', () => {
    expect(
      render(
        <MediatorNodeInspectDetail
          marker={marker({ code: 'needs_evidence', label: 'needs_evidence' })}
          helper="x"
          nextMoveLabel={null}
        />,
      ).toJSON(),
    ).toBeNull();
  });

  it('renders no internal codes and no ban-list tokens', () => {
    const banned = _forbiddenMediatorTokens();
    const labels = [
      'Needs evidence',
      'Definition not shared',
      'Scope mismatch',
      'Missing link',
      'Structured impasse',
      'Blocked evidence path',
      'Partially narrowed',
    ];
    const helpers = [
      'A source or quote was asked for and is still owed.',
      'The two sides are using a term differently — pin it down together.',
      'This answers a broader or narrower claim than the point — narrow or branch it.',
      'The conclusion depends on a step that has not been spelled out.',
    ];
    for (const label of labels) {
      for (const helper of helpers) {
        const tree = render(
          <MediatorNodeInspectDetail
            marker={marker({ code: 'needs_evidence', label })}
            helper={helper}
            nextMoveLabel="Provide a source"
          />,
        ).toJSON();
        for (const text of collectText(tree)) {
          const lower = text.toLowerCase();
          for (const token of banned) expect(lower.includes(token)).toBe(false);
        }
      }
    }
  });

  it('marks the group header for accessibility', () => {
    const { getByText } = render(
      <MediatorNodeInspectDetail
        marker={marker({ code: 'needs_evidence', label: 'Needs evidence' })}
        helper="x is owed"
        nextMoveLabel="Provide a source"
      />,
    );
    // The block carries its OWN labelled header — it never collapses the
    // mediator state into the Observation/Allegation groups (§10a).
    expect(getByText('Mediator state')).toBeTruthy();
  });
});
