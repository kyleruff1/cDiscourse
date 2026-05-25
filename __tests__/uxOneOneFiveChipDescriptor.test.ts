/**
 * UX-001.5 — `AnnotationChipDescriptor` shape + helpers.
 *
 * Tests the pure-TS descriptor module:
 *   - the descriptor type accepts all required + optional + UX-001.5A
 *     forward-compatibility fields,
 *   - `isAnnotationChipDescriptor` rejects every invalid shape and
 *     accepts every valid one,
 *   - `normalizeAnnotationChipDescriptor` trims, validates enums,
 *     suppresses snake_case-leak labels, returns null for unrecoverable
 *     input.
 */
import {
  ANNOTATION_CHIP_ICON_HINTS,
  ANNOTATION_CHIP_KINDS,
  ANNOTATION_CHIP_SOURCES,
  isAnnotationChipDescriptor,
  normalizeAnnotationChipDescriptor,
  type AnnotationChipDescriptor,
} from '../src/features/nodeAnnotations/annotationChipDescriptor';

describe('UX-001.5 — AnnotationChipDescriptor — vocabularies', () => {
  it('exports the six structural kinds', () => {
    expect(ANNOTATION_CHIP_KINDS).toEqual([
      'state',
      'context',
      'lifecycle',
      'evidence',
      'flag',
      'semantic',
    ]);
  });

  it('exports the seven iconHint values', () => {
    expect(ANNOTATION_CHIP_ICON_HINTS).toEqual([
      'info',
      'warn',
      'check',
      'time',
      'evidence',
      'flag',
      'cluster',
    ]);
  });

  it('exports the two UX-001.5A source values', () => {
    expect(ANNOTATION_CHIP_SOURCES).toEqual(['machine', 'user']);
  });
});

describe('UX-001.5 — isAnnotationChipDescriptor', () => {
  it('returns true for the minimum-valid descriptor', () => {
    const d: AnnotationChipDescriptor = { id: 'x', label: 'Source gap' };
    expect(isAnnotationChipDescriptor(d)).toBe(true);
  });

  it('returns true for a fully-populated descriptor including UX-001.5A fields', () => {
    const d: AnnotationChipDescriptor = {
      id: 'x',
      label: 'Source gap',
      kind: 'flag',
      iconHint: 'warn',
      tooltip: 'A primary source is needed.',
      ariaLabel: 'Flag: Source gap.',
      source: 'machine',
      category: 'rule_001_advisory',
    };
    expect(isAnnotationChipDescriptor(d)).toBe(true);
  });

  it('returns false for null / undefined / primitives / arrays', () => {
    expect(isAnnotationChipDescriptor(null)).toBe(false);
    expect(isAnnotationChipDescriptor(undefined)).toBe(false);
    expect(isAnnotationChipDescriptor('x')).toBe(false);
    expect(isAnnotationChipDescriptor(42)).toBe(false);
    expect(isAnnotationChipDescriptor([])).toBe(false);
  });

  it('returns false when id or label is missing or empty', () => {
    expect(isAnnotationChipDescriptor({ label: 'x' })).toBe(false);
    expect(isAnnotationChipDescriptor({ id: 'x' })).toBe(false);
    expect(isAnnotationChipDescriptor({ id: '', label: 'x' })).toBe(false);
    expect(isAnnotationChipDescriptor({ id: 'x', label: '' })).toBe(false);
  });

  it('returns false for unknown kind / iconHint / source', () => {
    expect(
      isAnnotationChipDescriptor({ id: 'x', label: 'L', kind: 'not_a_kind' }),
    ).toBe(false);
    expect(
      isAnnotationChipDescriptor({
        id: 'x',
        label: 'L',
        iconHint: 'not_a_hint',
      }),
    ).toBe(false);
    expect(
      isAnnotationChipDescriptor({ id: 'x', label: 'L', source: 'unknown' }),
    ).toBe(false);
  });

  it('returns false when tooltip / ariaLabel / category are not strings', () => {
    expect(
      isAnnotationChipDescriptor({ id: 'x', label: 'L', tooltip: 42 }),
    ).toBe(false);
    expect(
      isAnnotationChipDescriptor({ id: 'x', label: 'L', ariaLabel: 42 }),
    ).toBe(false);
    expect(
      isAnnotationChipDescriptor({ id: 'x', label: 'L', category: 42 }),
    ).toBe(false);
  });
});

describe('UX-001.5 — normalizeAnnotationChipDescriptor', () => {
  it('returns null for null / undefined / non-object', () => {
    expect(normalizeAnnotationChipDescriptor(null)).toBeNull();
    expect(normalizeAnnotationChipDescriptor(undefined)).toBeNull();
    expect(
      normalizeAnnotationChipDescriptor('x' as unknown as Partial<AnnotationChipDescriptor>),
    ).toBeNull();
  });

  it('returns null when id or label is missing or empty after trim', () => {
    expect(normalizeAnnotationChipDescriptor({ id: '   ', label: 'L' })).toBeNull();
    expect(normalizeAnnotationChipDescriptor({ id: 'x', label: '   ' })).toBeNull();
    expect(normalizeAnnotationChipDescriptor({ id: 'x' })).toBeNull();
    expect(normalizeAnnotationChipDescriptor({ label: 'L' })).toBeNull();
  });

  it('returns null for snake_case-leak labels (doctrine §9 backstop)', () => {
    // Internal-code leaks must be rejected at the descriptor boundary.
    expect(
      normalizeAnnotationChipDescriptor({ id: 'x', label: 'topic_satisfaction_lexical' }),
    ).toBeNull();
    expect(
      normalizeAnnotationChipDescriptor({ id: 'x', label: 'source_chain_lexical' }),
    ).toBeNull();
    expect(
      normalizeAnnotationChipDescriptor({ id: 'x', label: 'anti_amplification' }),
    ).toBeNull();
    // Mixed-case word with snake_case in the middle is still rejected.
    expect(
      normalizeAnnotationChipDescriptor({ id: 'x', label: 'Note: evidence_debt_unresolved' }),
    ).toBeNull();
  });

  it('trims label and id', () => {
    const result = normalizeAnnotationChipDescriptor({ id: '  x  ', label: '  L  ' });
    expect(result).toEqual({ id: 'x', label: 'L' });
  });

  it('suppresses unknown kind / iconHint / source values', () => {
    const result = normalizeAnnotationChipDescriptor({
      id: 'x',
      label: 'L',
      kind: 'invented_kind' as unknown as AnnotationChipDescriptor['kind'],
      iconHint: 'invented_hint' as unknown as AnnotationChipDescriptor['iconHint'],
      source: 'invented' as unknown as AnnotationChipDescriptor['source'],
    });
    expect(result).toEqual({ id: 'x', label: 'L' });
  });

  it('preserves valid kind / iconHint / source / tooltip / ariaLabel / category', () => {
    const result = normalizeAnnotationChipDescriptor({
      id: 'x',
      label: 'Source gap',
      kind: 'flag',
      iconHint: 'warn',
      tooltip: '  A primary source is needed.  ',
      ariaLabel: '  Flag: Source gap.  ',
      source: 'machine',
      category: '  rule_001_advisory  ',
    });
    expect(result).toEqual({
      id: 'x',
      label: 'Source gap',
      kind: 'flag',
      iconHint: 'warn',
      tooltip: 'A primary source is needed.',
      ariaLabel: 'Flag: Source gap.',
      source: 'machine',
      category: 'rule_001_advisory',
    });
  });

  it('omits empty tooltip / ariaLabel / category after trim', () => {
    const result = normalizeAnnotationChipDescriptor({
      id: 'x',
      label: 'L',
      tooltip: '   ',
      ariaLabel: '   ',
      category: '   ',
    });
    expect(result).toEqual({ id: 'x', label: 'L' });
  });
});
