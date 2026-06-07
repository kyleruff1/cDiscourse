/**
 * CARD-VIEW-REFINE-001 — source-provenance label model.
 *
 * The classifier chip now carries a plain-language provenance badge derived
 * from the mark's raw `NodeLabelSource` code. Doctrine §9 / §10a: the raw
 * snake_case code must NEVER surface; unknown codes are SUPPRESSED (→ null).
 */
import {
  markToChip,
  sourceProvenanceLabel,
} from '../src/features/arguments/cardView/cardClassifierStripModel';
import { ALL_NODE_LABEL_SOURCES } from '../src/features/nodeLabels/nodeLabelTypes';
import type { NodeLabelMark } from '../src/features/nodeLabels/nodeLabelTypes';

const BANNED = [
  'winner', 'loser', 'correct', 'incorrect', 'true', 'false', 'liar',
  'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist',
  'stupid', 'idiot',
];

describe('sourceProvenanceLabel', () => {
  it('maps each known machine-observation source to plain language', () => {
    expect(sourceProvenanceLabel('auto_metadata')).toBe('From system metadata');
    expect(sourceProvenanceLabel('lifecycle')).toBe('From the move’s lifecycle');
    expect(sourceProvenanceLabel('ai_classifier')).toBe('From the AI classifier');
    expect(sourceProvenanceLabel('semantic_referee')).toBe('From the referee');
  });

  it('SUPPRESSES (→ null) an unknown / empty code — never echoes the raw code', () => {
    expect(sourceProvenanceLabel('totally_unknown_code')).toBeNull();
    expect(sourceProvenanceLabel('')).toBeNull();
    expect(sourceProvenanceLabel(null)).toBeNull();
    expect(sourceProvenanceLabel(undefined)).toBeNull();
  });

  it('every resolved label is plain-language (no snake_case leak) + ban-list clean', () => {
    for (const src of ALL_NODE_LABEL_SOURCES) {
      const label = sourceProvenanceLabel(src);
      if (label == null) continue; // suppressed codes are fine
      // No raw code echoed.
      expect(label).not.toBe(src);
      // No snake_case token.
      expect(label).not.toMatch(/[a-z]+_[a-z]/);
      const lower = label.toLowerCase();
      for (const b of BANNED) {
        expect(lower).not.toContain(b);
      }
    }
  });
});

describe('markToChip carries the resolved provenance label', () => {
  function mark(over: Partial<NodeLabelMark> = {}): NodeLabelMark {
    return {
      id: 'm:auto_metadata:has_rebuttal:n1',
      rawKey: 'has_rebuttal',
      source: 'auto_metadata',
      kind: 'machine_observation',
      label: 'Has a rebuttal',
      shortLabel: 'Rebutted',
      description: 'This move has a challenge child.',
      confidence: 'high',
      disposition: 'rendered_now',
      defaultSurface: 'selected_context',
      priority: 10,
      visibleByDefault: true,
      ...(over as Partial<NodeLabelMark>),
    } as NodeLabelMark;
  }

  it('populates sourceProvenanceLabel from mark.source', () => {
    const chip = markToChip(mark());
    expect(chip.category).toBe('auto_metadata'); // raw code retained internally
    expect(chip.sourceProvenanceLabel).toBe('From system metadata'); // plain language for UI
  });

  it('suppresses the badge for an unknown source', () => {
    const chip = markToChip(mark({ source: 'future_source' }));
    expect(chip.sourceProvenanceLabel).toBeNull();
  });
});
