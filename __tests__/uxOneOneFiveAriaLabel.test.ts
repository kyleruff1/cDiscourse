/**
 * UX-001.5 — Screen-reader label builder.
 *
 * Tests every path of `buildAnnotationAriaLabel`,
 * `buildAnnotationAriaLabelForCluster`, and
 * `buildAnnotationStripAriaLabel`:
 *   - explicit ariaLabel override wins;
 *   - per-kind word ("Note", "Flag", "Lifecycle", etc.);
 *   - tooltip appended as a second sentence;
 *   - cluster joins labels with ", ";
 *   - strip uses singular/plural item noun;
 *   - all output is plain English (no internal codes, no verdict words).
 */
import {
  buildAnnotationAriaLabel,
  buildAnnotationAriaLabelForCluster,
  buildAnnotationStripAriaLabel,
} from '../src/features/nodeAnnotations/annotationAriaLabel';
import type { AnnotationChipDescriptor } from '../src/features/nodeAnnotations/annotationChipDescriptor';

describe('UX-001.5 — buildAnnotationAriaLabel — explicit override', () => {
  it('returns descriptor.ariaLabel verbatim when set', () => {
    const d: AnnotationChipDescriptor = {
      id: 'x',
      label: 'Source gap',
      ariaLabel: 'Explicit override label.',
    };
    expect(buildAnnotationAriaLabel(d)).toBe('Explicit override label.');
  });

  it('trims an explicit override', () => {
    const d: AnnotationChipDescriptor = {
      id: 'x',
      label: 'Source gap',
      ariaLabel: '   Explicit override label.   ',
    };
    expect(buildAnnotationAriaLabel(d)).toBe('Explicit override label.');
  });

  it('does NOT use empty / whitespace-only ariaLabel as override', () => {
    const d: AnnotationChipDescriptor = {
      id: 'x',
      label: 'Source gap',
      kind: 'flag',
      ariaLabel: '   ',
    };
    expect(buildAnnotationAriaLabel(d)).toBe('Flag: Source gap.');
  });
});

describe('UX-001.5 — buildAnnotationAriaLabel — kind-derived composition', () => {
  it('flag kind starts with "Flag:"', () => {
    expect(
      buildAnnotationAriaLabel({ id: 'x', label: 'Source gap', kind: 'flag' }),
    ).toBe('Flag: Source gap.');
  });

  it('semantic kind starts with "Note:"', () => {
    expect(
      buildAnnotationAriaLabel({ id: 'x', label: 'Recently moved on', kind: 'semantic' }),
    ).toBe('Note: Recently moved on.');
  });

  it('lifecycle kind starts with "Lifecycle:"', () => {
    expect(
      buildAnnotationAriaLabel({ id: 'x', label: 'Narrowed', kind: 'lifecycle' }),
    ).toBe('Lifecycle: Narrowed.');
  });

  it('evidence kind starts with "Evidence:"', () => {
    expect(
      buildAnnotationAriaLabel({ id: 'x', label: 'Receipt attached', kind: 'evidence' }),
    ).toBe('Evidence: Receipt attached.');
  });

  it('state kind starts with "State:"', () => {
    expect(
      buildAnnotationAriaLabel({ id: 'x', label: 'Active', kind: 'state' }),
    ).toBe('State: Active.');
  });

  it('context kind starts with "Context:"', () => {
    expect(
      buildAnnotationAriaLabel({ id: 'x', label: 'Branch tangent', kind: 'context' }),
    ).toBe('Context: Branch tangent.');
  });

  it('undefined kind starts with "Annotation:"', () => {
    expect(buildAnnotationAriaLabel({ id: 'x', label: 'Hello' })).toBe(
      'Annotation: Hello.',
    );
  });
});

describe('UX-001.5 — buildAnnotationAriaLabel — tooltip', () => {
  it('appends the tooltip as a second sentence', () => {
    expect(
      buildAnnotationAriaLabel({
        id: 'x',
        label: 'Source gap',
        kind: 'flag',
        tooltip: 'A primary source is needed',
      }),
    ).toBe('Flag: Source gap. A primary source is needed.');
  });

  it('does not double-up periods when label already ends in one', () => {
    expect(
      buildAnnotationAriaLabel({
        id: 'x',
        label: 'Source gap.',
        kind: 'flag',
        tooltip: 'A primary source is needed.',
      }),
    ).toBe('Flag: Source gap. A primary source is needed.');
  });

  it('ignores empty tooltip', () => {
    expect(
      buildAnnotationAriaLabel({
        id: 'x',
        label: 'Source gap',
        kind: 'flag',
        tooltip: '   ',
      }),
    ).toBe('Flag: Source gap.');
  });
});

describe('UX-001.5 — buildAnnotationAriaLabelForCluster', () => {
  it('joins multiple ariaLabels with comma + space', () => {
    expect(
      buildAnnotationAriaLabelForCluster([
        { kind: 'flag', ariaLabel: 'Source gap' },
        { kind: 'lifecycle', ariaLabel: 'Narrowed' },
        { kind: 'evidence', ariaLabel: 'Receipt attached' },
      ]),
    ).toBe('3 annotations: Source gap, Narrowed, Receipt attached');
  });

  it('uses singular "annotation" for one item', () => {
    expect(
      buildAnnotationAriaLabelForCluster([{ kind: 'flag', ariaLabel: 'Source gap' }]),
    ).toBe('1 annotation: Source gap');
  });

  it('returns "No annotations." for empty arrays', () => {
    expect(buildAnnotationAriaLabelForCluster([])).toBe('No annotations.');
  });

  it('returns "No annotations." when every badge label is empty', () => {
    expect(
      buildAnnotationAriaLabelForCluster([
        { kind: 'flag', ariaLabel: '   ' },
        { kind: 'flag', ariaLabel: '' },
      ]),
    ).toBe('No annotations.');
  });

  it('filters empty labels from the list while keeping the count honest', () => {
    expect(
      buildAnnotationAriaLabelForCluster([
        { kind: 'flag', ariaLabel: 'A' },
        { kind: 'flag', ariaLabel: '   ' },
        { kind: 'flag', ariaLabel: 'B' },
      ]),
    ).toBe('2 annotations: A, B');
  });
});

describe('UX-001.5 — buildAnnotationStripAriaLabel', () => {
  it('uses the plain-language section name for "flags"', () => {
    expect(
      buildAnnotationStripAriaLabel(
        [
          { id: 'a', label: 'A', kind: 'flag' },
          { id: 'b', label: 'B', kind: 'flag' },
        ],
        'flags',
      ),
    ).toBe('Semantic flags: 2 items.');
  });

  it('uses singular noun for one item', () => {
    expect(
      buildAnnotationStripAriaLabel([{ id: 'a', label: 'A' }], 'flags'),
    ).toBe('Semantic flags: 1 item.');
  });

  it('reports "no items" for an empty list', () => {
    expect(buildAnnotationStripAriaLabel([], 'flags')).toBe(
      'Semantic flags: no items.',
    );
  });

  it('falls back to "Annotations" for an unknown section id', () => {
    expect(
      buildAnnotationStripAriaLabel([{ id: 'a', label: 'A' }], 'unknown'),
    ).toBe('Annotations: 1 item.');
  });

  it('maps every known section id to a plain label', () => {
    expect(buildAnnotationStripAriaLabel([], 'flags')).toContain('Semantic flags');
    expect(buildAnnotationStripAriaLabel([], 'unresolved')).toContain(
      'What is unresolved',
    );
    expect(buildAnnotationStripAriaLabel([], 'sits')).toContain('Where it sits');
    expect(buildAnnotationStripAriaLabel([], 'matters')).toContain('Why it matters');
    expect(buildAnnotationStripAriaLabel([], 'says')).toContain('What this move says');
    expect(buildAnnotationStripAriaLabel([], 'next_move')).toContain(
      'Suggested next move',
    );
    expect(buildAnnotationStripAriaLabel([], 'evidence_detail')).toContain(
      'Evidence detail',
    );
  });
});
