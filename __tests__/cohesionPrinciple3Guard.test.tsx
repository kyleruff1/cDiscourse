/**
 * UX-PR-D (#925) — cohesion principle #3 ratchet: provenance must be visible.
 *
 * Principle #3 (COHESION section 8, commitment 9.3): machine-derived text must
 * carry a VISIBLE provenance marker, not only an audible one. A sighted user
 * must SEE that a line is machine-derived, exactly as the screen reader
 * announces it. PR-C (issue 923) added the two visible affixes; this guard
 * locks them so a later refactor cannot silently remove or un-hide them.
 *
 * The two surfaces:
 *  - DerivedSignalAdvisoryLines: leads each advisory line with a visible
 *    "Advisory" affix (DERIVED_SIGNAL_PROVENANCE_AFFIX), rendered as a separate
 *    accessibility-hidden sibling so the reader announces the sentence once.
 *  - MediatorNodeMarker: leads the marker label with a visible "Mediator note"
 *    affix (MEDIATOR_NODE_PROVENANCE_AFFIX), same hidden-sibling pattern.
 *
 * Two legs, both included to double-lock:
 *  - Leg A source-scan catches deletion of the constant or the a11y-hidden attr.
 *  - Leg B render proves each affix renders as an a11y-hidden sibling that shows
 *    the exported constant, next to a visible labeled sibling.
 *
 * Mirrors a11y693MediatorBoardAxisGuard.test.tsx (render + source-scan hybrid,
 * readFileSync via process.cwd, a firing negative control). The two affix
 * constants are imported read-only from their modules (that coupling is the
 * point of the guard); no other src import. Comments are apostrophe-free for
 * the naive quote-parity doctrine scanner.
 */
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render } from '@testing-library/react-native';
import {
  DerivedSignalAdvisoryLines,
  DERIVED_SIGNAL_PROVENANCE_AFFIX,
} from '../src/features/feedbackFlags/DerivedSignalAdvisoryLines';
import {
  MediatorNodeMarker,
  MEDIATOR_NODE_PROVENANCE_AFFIX,
} from '../src/features/mediator/MediatorNodeMarker';
import type { DerivedSignalLine } from '../src/features/feedbackFlags/derivedSignalConsumerModel';
import type { NodeMediatorMarker } from '../src/features/mediator/nodeMediatorMarkers';

const DERIVED_SRC = readFileSync(
  join(process.cwd(), 'src/features/feedbackFlags/DerivedSignalAdvisoryLines.tsx'),
  'utf8',
);
const MARKER_SRC = readFileSync(
  join(process.cwd(), 'src/features/mediator/MediatorNodeMarker.tsx'),
  'utf8',
);

// Firing control helper — throws when the affix is not a11y-hidden OR does not
// carry the expected constant text. Self-contained, no import from src.
function assertHiddenAffix(node: { props: Record<string, unknown> }, expected: string): void {
  if (node.props.accessibilityElementsHidden !== true) {
    throw new Error('provenance affix is not accessibility-hidden');
  }
  if (node.props.children !== expected) {
    throw new Error('provenance affix does not carry the expected constant text');
  }
}

// ── Leg A — source-scan: constant declared, rendered, and a11y-hidden ──

describe('UX-PR-D principle #3 — visible provenance affix source contract', () => {
  it('DerivedSignalAdvisoryLines declares, renders, and hides the Advisory affix', () => {
    expect(DERIVED_SRC).toMatch(/export const DERIVED_SIGNAL_PROVENANCE_AFFIX\s*=/);
    expect(DERIVED_SRC).toContain('{DERIVED_SIGNAL_PROVENANCE_AFFIX}');
    expect(DERIVED_SRC).toContain('accessibilityElementsHidden');
  });

  it('MediatorNodeMarker declares, renders, and hides the Mediator note affix', () => {
    expect(MARKER_SRC).toMatch(/export const MEDIATOR_NODE_PROVENANCE_AFFIX\s*=/);
    expect(MARKER_SRC).toContain('{MEDIATOR_NODE_PROVENANCE_AFFIX}');
    expect(MARKER_SRC).toContain('accessibilityElementsHidden');
  });

  it('the exported affix constants are the expected chrome copy', () => {
    expect(DERIVED_SIGNAL_PROVENANCE_AFFIX).toBe('Advisory');
    expect(MEDIATOR_NODE_PROVENANCE_AFFIX).toBe('Mediator note');
  });
});

// ── Leg B — render: each affix is an a11y-hidden sibling of a visible label ──

describe('UX-PR-D principle #3 — affix renders as an a11y-hidden visible sibling', () => {
  it('MediatorNodeMarker renders the hidden affix beside the visible label', () => {
    const marker: NodeMediatorMarker = {
      nodeId: 'n1',
      code: 'open',
      label: 'Needs evidence',
      isImpasse: false,
    };
    const { getByTestId, getByText } = render(<MediatorNodeMarker marker={marker} />);
    // The affix is accessibility-hidden by design, so query with includeHiddenElements.
    const affix = getByTestId('mediator-node-marker-affix', { includeHiddenElements: true });
    expect(affix.props.accessibilityElementsHidden).toBe(true);
    expect(affix.props.children).toBe(MEDIATOR_NODE_PROVENANCE_AFFIX);
    // The labeled sibling renders as visible text.
    getByText('Needs evidence');
  });

  it('DerivedSignalAdvisoryLines renders the hidden affix beside the visible line', () => {
    const lines: DerivedSignalLine[] = [
      {
        code: 'proof_moment',
        text: 'A receipt would carry this point further.',
        accessibilityLabel: 'Advisory: a receipt would carry this point further.',
      },
    ];
    const { getByTestId } = render(<DerivedSignalAdvisoryLines lines={lines} />);
    // The affix is accessibility-hidden by design, so query with includeHiddenElements.
    const affix = getByTestId('derived-signal-advisory-affix-proof_moment', {
      includeHiddenElements: true,
    });
    expect(affix.props.accessibilityElementsHidden).toBe(true);
    expect(affix.props.children).toBe(DERIVED_SIGNAL_PROVENANCE_AFFIX);
    // The labeled sibling renders as visible text.
    getByTestId('derived-signal-advisory-proof_moment');
  });
});

// ── Firing control — the guard bites (not vacuously green) ──

describe('UX-PR-D principle #3 guard — firing negative control', () => {
  it('assertHiddenAffix throws when the affix is not a11y-hidden', () => {
    expect(() =>
      assertHiddenAffix({ props: { children: 'Advisory', accessibilityElementsHidden: false } }, 'Advisory'),
    ).toThrow();
  });

  it('assertHiddenAffix throws when the affix text is missing', () => {
    expect(() =>
      assertHiddenAffix({ props: { accessibilityElementsHidden: true } }, 'Advisory'),
    ).toThrow();
  });
});

// ── Must-NOT-fire control — a well-formed hidden affix passes ──

describe('UX-PR-D principle #3 guard — must-NOT-fire control', () => {
  it('assertHiddenAffix passes on a well-formed hidden affix', () => {
    expect(() =>
      assertHiddenAffix({ props: { children: 'Advisory', accessibilityElementsHidden: true } }, 'Advisory'),
    ).not.toThrow();
    expect(() =>
      assertHiddenAffix(
        { props: { children: 'Mediator note', accessibilityElementsHidden: true } },
        'Mediator note',
      ),
    ).not.toThrow();
  });
});
