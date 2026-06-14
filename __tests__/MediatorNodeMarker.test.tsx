/**
 * UX-MEDIATOR-002 — MediatorNodeMarker component tests.
 *
 * Read-only compact node marker. Verifies it renders one safe plain-language
 * label, hides when there is no marker, and leaks no internal codes / banned
 * tokens.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { MediatorNodeMarker } from '../src/features/mediator/MediatorNodeMarker';
import type { NodeMediatorMarker } from '../src/features/mediator/nodeMediatorMarkers';
import { _forbiddenMediatorTokens } from '../src/features/mediator';

function marker(p: Partial<NodeMediatorMarker> & { code: NodeMediatorMarker['code']; label: string }): NodeMediatorMarker {
  return { nodeId: p.nodeId ?? 'n1', code: p.code, label: p.label, isImpasse: p.isImpasse ?? false };
}

function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object') return collectText((node as { children?: unknown }).children);
  return [];
}

describe('UX-MEDIATOR-002 MediatorNodeMarker', () => {
  it('renders nothing when there is no marker', () => {
    expect(render(<MediatorNodeMarker marker={null} />).toJSON()).toBeNull();
  });

  it('renders the plain-language label for an actionable state', () => {
    const { getByText, getByTestId } = render(
      <MediatorNodeMarker marker={marker({ code: 'needs_evidence', label: 'Needs evidence' })} />,
    );
    expect(getByText('Needs evidence')).toBeTruthy();
    expect(getByTestId('mediator-node-marker-n1')).toBeTruthy();
  });

  it('renders the structured-impasse marker', () => {
    const { getByText } = render(
      <MediatorNodeMarker marker={marker({ code: 'structured_impasse', label: 'Structured impasse', isImpasse: true })} />,
    );
    expect(getByText('Structured impasse')).toBeTruthy();
  });

  it('renders no internal codes and no ban-list tokens', () => {
    const banned = _forbiddenMediatorTokens();
    const labels = ['Needs evidence', 'Definition needed', 'Scope mismatch', 'Off-point response', 'Structured impasse', 'Blocked evidence path'];
    for (const label of labels) {
      const tree = render(<MediatorNodeMarker marker={marker({ code: 'needs_evidence', label })} />).toJSON();
      for (const text of collectText(tree)) {
        const lower = text.toLowerCase();
        for (const token of banned) expect(lower.includes(token)).toBe(false);
        expect(text).not.toMatch(/[a-z]+_[a-z]+/); // no raw snake_case code
      }
    }
  });
});
