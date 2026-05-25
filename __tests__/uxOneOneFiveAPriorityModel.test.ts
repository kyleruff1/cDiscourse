/**
 * UX-001.5A — Priority model tests (designer-added test file 10).
 *
 * Covers PRIORITY_BY_SOURCE, comparePriorityThenAlphabetical, and
 * resolveSourceForDuplicateText.
 */

import {
  PRIORITY_BY_SOURCE,
  comparePriorityThenAlphabetical,
  resolveSourceForDuplicateText,
} from '../src/features/nodeLabels/nodeLabelPriorityModel';
import {
  ALL_NODE_LABEL_SOURCES,
  type NodeLabelMark,
  type NodeLabelSource,
} from '../src/features/nodeLabels/nodeLabelTypes';

function mark(
  source: NodeLabelSource,
  priority: number,
  label = 'Label',
  rawKey = 'rk',
): NodeLabelMark {
  return {
    id: `id:${source}:${rawKey}:${priority}`,
    rawKey,
    kind: source === 'manual_tag' ? 'user_allegation' : 'machine_observation',
    source,
    label,
    shortLabel: label,
    description: 'desc',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority,
    visibleByDefault: true,
  };
}

describe('UX-001.5A — PRIORITY_BY_SOURCE', () => {
  it('has an entry for every NodeLabelSource value', () => {
    for (const source of ALL_NODE_LABEL_SOURCES) {
      expect(PRIORITY_BY_SOURCE[source]).toBeDefined();
      expect(typeof PRIORITY_BY_SOURCE[source]).toBe('number');
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(PRIORITY_BY_SOURCE)).toBe(true);
  });

  it('manual_tag is the highest-priority source (lowest number)', () => {
    const values = ALL_NODE_LABEL_SOURCES.map((s) => PRIORITY_BY_SOURCE[s]);
    const minValue = Math.min(...values);
    expect(PRIORITY_BY_SOURCE.manual_tag).toBe(minValue);
  });

  it('future_source is the lowest-priority source (highest number)', () => {
    const values = ALL_NODE_LABEL_SOURCES.map((s) => PRIORITY_BY_SOURCE[s]);
    const maxValue = Math.max(...values);
    expect(PRIORITY_BY_SOURCE.future_source).toBe(maxValue);
  });

  it('lifecycle is higher-priority than auto_metadata', () => {
    expect(PRIORITY_BY_SOURCE.lifecycle).toBeLessThan(PRIORITY_BY_SOURCE.auto_metadata);
  });

  it('auto_metadata is higher-priority than semantic_referee', () => {
    expect(PRIORITY_BY_SOURCE.auto_metadata).toBeLessThan(PRIORITY_BY_SOURCE.semantic_referee);
  });

  it('semantic_referee is higher-priority than composition_mutation', () => {
    expect(PRIORITY_BY_SOURCE.semantic_referee).toBeLessThan(
      PRIORITY_BY_SOURCE.composition_mutation,
    );
  });

  it('composition_mutation is higher-priority than ai_classifier', () => {
    expect(PRIORITY_BY_SOURCE.composition_mutation).toBeLessThan(
      PRIORITY_BY_SOURCE.ai_classifier,
    );
  });
});

describe('UX-001.5A — comparePriorityThenAlphabetical', () => {
  it('returns negative when a.priority < b.priority', () => {
    expect(comparePriorityThenAlphabetical(mark('lifecycle', 14), mark('lifecycle', 30))).toBeLessThan(0);
  });

  it('returns positive when a.priority > b.priority', () => {
    expect(comparePriorityThenAlphabetical(mark('lifecycle', 30), mark('lifecycle', 14))).toBeGreaterThan(0);
  });

  it('returns zero when both fields are equal', () => {
    expect(comparePriorityThenAlphabetical(mark('lifecycle', 14, 'X'), mark('lifecycle', 14, 'X'))).toBe(0);
  });

  it('breaks priority ties by source priority', () => {
    expect(
      comparePriorityThenAlphabetical(mark('lifecycle', 20), mark('auto_metadata', 20)),
    ).toBeLessThan(0);
  });

  it('breaks remaining ties by label alphabetically', () => {
    expect(
      comparePriorityThenAlphabetical(
        mark('lifecycle', 20, 'Apple'),
        mark('lifecycle', 20, 'Banana'),
      ),
    ).toBeLessThan(0);
  });

  it('is stable for arrays', () => {
    const marks = [
      mark('lifecycle', 30, 'Zebra'),
      mark('lifecycle', 14, 'Alpha'),
      mark('lifecycle', 20, 'Bravo'),
    ];
    const sorted = [...marks].sort(comparePriorityThenAlphabetical);
    expect(sorted.map((m) => m.priority)).toEqual([14, 20, 30]);
  });
});

describe('UX-001.5A — resolveSourceForDuplicateText', () => {
  it('keeps the higher-priority source when sources differ', () => {
    const lifecycleMark = mark('lifecycle', 20);
    const autoMark = mark('auto_metadata', 20);
    expect(resolveSourceForDuplicateText(autoMark, lifecycleMark)).toBe(lifecycleMark);
  });

  it('keeps the manual_tag entry over an auto_metadata entry', () => {
    const manualMark = mark('manual_tag', 30);
    const autoMark = mark('auto_metadata', 20);
    expect(resolveSourceForDuplicateText(manualMark, autoMark)).toBe(manualMark);
  });

  it('keeps the lower per-mark priority when sources match', () => {
    const a = mark('lifecycle', 30);
    const b = mark('lifecycle', 14);
    expect(resolveSourceForDuplicateText(a, b)).toBe(b);
  });

  it('keeps a (stable) on a complete tie', () => {
    const a = mark('lifecycle', 14);
    const b = mark('lifecycle', 14);
    expect(resolveSourceForDuplicateText(a, b)).toBe(a);
  });
});
