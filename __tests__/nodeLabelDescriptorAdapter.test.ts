/**
 * UX-001.5A — Descriptor adapter tests.
 *
 * Maps acceptance criteria AC 6, 7, 15, 16 (no raw codes + no
 * provenance crossover).
 */

import {
  isAnnotationChipDescriptor,
  normalizeAnnotationChipDescriptor,
} from '../src/features/nodeAnnotations';
import {
  toAnnotationChipDescriptor,
  toAnnotationChipDescriptors,
} from '../src/features/nodeLabels/nodeLabelDescriptorAdapter';
import type { NodeLabelMark } from '../src/features/nodeLabels/nodeLabelTypes';

function mark(
  overrides: Partial<NodeLabelMark> & Pick<NodeLabelMark, 'rawKey' | 'source' | 'kind'>,
): NodeLabelMark {
  return {
    id: `${overrides.kind}:${overrides.source}:${overrides.rawKey}:msg-1`,
    rawKey: overrides.rawKey,
    kind: overrides.kind,
    source: overrides.source,
    label: overrides.label ?? 'Plain Label',
    shortLabel: overrides.shortLabel ?? 'Short',
    description: overrides.description ?? 'Plain language description.',
    defaultSurface: overrides.defaultSurface ?? 'timeline_node',
    disposition: overrides.disposition ?? 'rendered_now',
    priority: overrides.priority ?? 20,
    visibleByDefault: overrides.visibleByDefault ?? true,
  };
}

describe('UX-001.5A — toAnnotationChipDescriptor — Machine Observations', () => {
  const m = mark({
    rawKey: 'rebutted',
    source: 'lifecycle',
    kind: 'machine_observation',
    label: 'Under pressure',
    shortLabel: 'Pressured',
    description: 'This cluster is under pressure from a challenge.',
  });

  const desc = toAnnotationChipDescriptor(m);

  it('sets descriptor source to "machine"', () => {
    expect(desc.source).toBe('machine');
  });

  it('sets descriptor kind to "semantic"', () => {
    expect(desc.kind).toBe('semantic');
  });

  it('sets descriptor iconHint to "info"', () => {
    expect(desc.iconHint).toBe('info');
  });

  it('uses shortLabel as descriptor label', () => {
    expect(desc.label).toBe('Pressured');
  });

  it('uses description as descriptor tooltip', () => {
    expect(desc.tooltip).toBe('This cluster is under pressure from a challenge.');
  });

  it('uses category from mark.source', () => {
    expect(desc.category).toBe('lifecycle');
  });

  it('builds the "Machine observation:" ariaLabel prefix with full label', () => {
    expect(desc.ariaLabel).toBe('Machine observation: Under pressure');
  });

  it('preserves the mark id as descriptor id', () => {
    expect(desc.id).toBe(m.id);
  });
});

describe('UX-001.5A — toAnnotationChipDescriptor — User Allegations', () => {
  const m = mark({
    rawKey: 'needs_source',
    source: 'manual_tag',
    kind: 'user_allegation',
    label: 'Needs source',
    shortLabel: 'Needs src',
    description: 'A participant has flagged this as needing a source.',
  });

  const desc = toAnnotationChipDescriptor(m);

  it('sets descriptor source to "user"', () => {
    expect(desc.source).toBe('user');
  });

  it('sets descriptor kind to "flag"', () => {
    expect(desc.kind).toBe('flag');
  });

  it('sets descriptor iconHint to "warn"', () => {
    expect(desc.iconHint).toBe('warn');
  });

  it('uses shortLabel as descriptor label', () => {
    expect(desc.label).toBe('Needs src');
  });

  it('uses description as descriptor tooltip', () => {
    expect(desc.tooltip).toBe('A participant has flagged this as needing a source.');
  });

  it('uses category from mark.source ("manual_tag")', () => {
    expect(desc.category).toBe('manual_tag');
  });

  it('builds the "User allegation:" ariaLabel prefix with full label', () => {
    expect(desc.ariaLabel).toBe('User allegation: Needs source');
  });
});

describe('UX-001.5A — Descriptor passes isAnnotationChipDescriptor', () => {
  it('Machine Observation descriptor validates', () => {
    const desc = toAnnotationChipDescriptor(
      mark({ rawKey: 'rebutted', source: 'lifecycle', kind: 'machine_observation' }),
    );
    expect(isAnnotationChipDescriptor(desc)).toBe(true);
  });

  it('User Allegation descriptor validates', () => {
    const desc = toAnnotationChipDescriptor(
      mark({ rawKey: 'needs_source', source: 'manual_tag', kind: 'user_allegation' }),
    );
    expect(isAnnotationChipDescriptor(desc)).toBe(true);
  });
});

describe('UX-001.5A — Descriptor survives normalizeAnnotationChipDescriptor', () => {
  it('Machine Observation descriptor normalizes unchanged', () => {
    const desc = toAnnotationChipDescriptor(
      mark({ rawKey: 'rebutted', source: 'lifecycle', kind: 'machine_observation' }),
    );
    const normalized = normalizeAnnotationChipDescriptor(desc);
    expect(normalized).not.toBeNull();
    expect(normalized?.source).toBe('machine');
    expect(normalized?.kind).toBe('semantic');
  });

  it('User Allegation descriptor normalizes unchanged', () => {
    const desc = toAnnotationChipDescriptor(
      mark({ rawKey: 'needs_source', source: 'manual_tag', kind: 'user_allegation' }),
    );
    const normalized = normalizeAnnotationChipDescriptor(desc);
    expect(normalized).not.toBeNull();
    expect(normalized?.source).toBe('user');
    expect(normalized?.kind).toBe('flag');
  });
});

describe('UX-001.5A — toAnnotationChipDescriptors (array variant)', () => {
  it('maps every mark', () => {
    const marks = [
      mark({ rawKey: 'rebutted', source: 'lifecycle', kind: 'machine_observation' }),
      mark({ rawKey: 'needs_source', source: 'manual_tag', kind: 'user_allegation' }),
      mark({ rawKey: 'has_evidence', source: 'auto_metadata', kind: 'machine_observation' }),
    ];
    const result = toAnnotationChipDescriptors(marks);
    expect(result.length).toBe(3);
    expect(result[0].source).toBe('machine');
    expect(result[1].source).toBe('user');
    expect(result[2].source).toBe('machine');
  });

  it('returns [] for empty input', () => {
    expect(toAnnotationChipDescriptors([])).toEqual([]);
  });

  it('returns [] for non-array input', () => {
    expect(toAnnotationChipDescriptors(null as unknown as never)).toEqual([]);
  });
});

describe('UX-001.5A — No provenance crossover (cdiscourse-doctrine §10a)', () => {
  it('Machine Observation NEVER renders as User Allegation', () => {
    const m = mark({ rawKey: 'rebutted', source: 'lifecycle', kind: 'machine_observation' });
    const desc = toAnnotationChipDescriptor(m);
    expect(desc.source).not.toBe('user');
    expect(desc.ariaLabel).not.toContain('User allegation');
  });

  it('User Allegation NEVER renders as Machine Observation', () => {
    const m = mark({ rawKey: 'needs_source', source: 'manual_tag', kind: 'user_allegation' });
    const desc = toAnnotationChipDescriptor(m);
    expect(desc.source).not.toBe('machine');
    expect(desc.ariaLabel).not.toContain('Machine observation');
  });
});
