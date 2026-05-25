/**
 * UX-001.5 — Descriptor forward compatibility with UX-001.5A.
 *
 * UX-001.5A's `NodeLabelMark` (per `docs/roadmap/UX-001.5A-...md`) adds
 * `source: 'machine' | 'user'` (top-level taxonomy) and a category
 * provenance string. UX-001.5's primitive layer must:
 *
 *   1. Accept `source` + `category` on a descriptor.
 *   2. Treat them as transparent payload — the descriptor remains a
 *      source-neutral primitive contract.
 *   3. Preserve them through `normalizeAnnotationChipDescriptor`.
 *
 * The TypeScript compile of this file is itself part of the
 * verification — a regression would show up as a `tsc --noEmit` error.
 */
import {
  isAnnotationChipDescriptor,
  normalizeAnnotationChipDescriptor,
  ANNOTATION_CHIP_SOURCES,
  type AnnotationChipDescriptor,
} from '../src/features/nodeAnnotations/annotationChipDescriptor';
import { resolveChipColorsForDescriptor } from '../src/features/nodeAnnotations/annotationKindTokens';
import { buildAnnotationAriaLabel } from '../src/features/nodeAnnotations/annotationAriaLabel';

describe('UX-001.5 — descriptor accepts UX-001.5A source / category', () => {
  it('a machine-observation descriptor is valid', () => {
    const machine: AnnotationChipDescriptor = {
      id: 'mc-1',
      label: 'Recently moved on',
      kind: 'semantic',
      source: 'machine',
      category: 'semantic_referee', // UX-001.5A's MachineObservationSource value
    };
    expect(isAnnotationChipDescriptor(machine)).toBe(true);
  });

  it('a user-allegation descriptor is valid', () => {
    const allegation: AnnotationChipDescriptor = {
      id: 'al-1',
      label: 'Needs source',
      kind: 'flag',
      source: 'user',
      category: 'user_manual_tag', // UX-001.5A's UserAllegationSource value
    };
    expect(isAnnotationChipDescriptor(allegation)).toBe(true);
  });

  it('exports a single source vocabulary matching the roadmap normalization', () => {
    // The roadmap's NodeLabelKind uses 'machine_observation' / 'user_allegation';
    // UX-001.5A's adapter normalizes those suffixed values into the short
    // 'machine' / 'user' form. The vocabulary here is the destination side.
    expect(ANNOTATION_CHIP_SOURCES).toEqual(['machine', 'user']);
  });
});

describe('UX-001.5 — primitives render identically with vs without source / category', () => {
  const labelOnly: AnnotationChipDescriptor = {
    id: 'x',
    label: 'Source gap',
    kind: 'flag',
  };
  const withSource: AnnotationChipDescriptor = {
    ...labelOnly,
    source: 'machine',
    category: 'rule_001_advisory',
  };

  it('color resolution is identical', () => {
    expect(resolveChipColorsForDescriptor(labelOnly)).toEqual(
      resolveChipColorsForDescriptor(withSource),
    );
  });

  it('aria label composition is identical (source / category not surfaced at primitive layer)', () => {
    expect(buildAnnotationAriaLabel(labelOnly)).toEqual(
      buildAnnotationAriaLabel(withSource),
    );
  });
});

describe('UX-001.5 — normalizer preserves source + category through round-trip', () => {
  it('keeps source and category on a valid descriptor', () => {
    const result = normalizeAnnotationChipDescriptor({
      id: 'x',
      label: 'Source gap',
      kind: 'flag',
      source: 'machine',
      category: 'rule_001_advisory',
    });
    expect(result).not.toBeNull();
    expect(result?.source).toBe('machine');
    expect(result?.category).toBe('rule_001_advisory');
  });

  it('drops an unknown source value', () => {
    const result = normalizeAnnotationChipDescriptor({
      id: 'x',
      label: 'Source gap',
      source: 'unknown' as unknown as AnnotationChipDescriptor['source'],
      category: 'rule_001_advisory',
    });
    expect(result).not.toBeNull();
    expect(result?.source).toBeUndefined();
    expect(result?.category).toBe('rule_001_advisory'); // category is forward-compat string; preserved
  });

  it('preserves UX-001.5A normalized source values verbatim', () => {
    for (const source of ANNOTATION_CHIP_SOURCES) {
      const result = normalizeAnnotationChipDescriptor({
        id: 'x',
        label: 'L',
        source,
      });
      expect(result?.source).toBe(source);
    }
  });
});

describe('UX-001.5 — descriptor type is intentionally minimal (no UX-001.5A presentation slots)', () => {
  // This test exists primarily as documentation. UX-001.5A's NodeLabelMark
  // carries `defaultSurface`, `priority`, `actionable`, `confidence`, and
  // other presentation-model concerns that intentionally do NOT live on
  // AnnotationChipDescriptor. The descriptor is source-neutral; UX-001.5A's
  // presentation model is the wrapper that reads those fields.
  it('descriptor has only the fields named in §3 of the design', () => {
    const allFields: Array<keyof AnnotationChipDescriptor> = [
      'id',
      'label',
      'kind',
      'iconHint',
      'tooltip',
      'ariaLabel',
      'source',
      'category',
    ];
    // 8 fields total — id, label required + 6 optional (4 primitive +
    // 2 UX-001.5A forward-compat).
    expect(allFields).toHaveLength(8);
  });
});
