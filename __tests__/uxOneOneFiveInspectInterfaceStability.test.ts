/**
 * UX-001.5 — Inspect interface stability (additive-only change).
 *
 * Phase 4 framing pinned `InspectSectionContent` as the stable contract
 * for UX-001.5A. UX-001.5 extends it ADDITIVELY:
 *   - `semanticFlagsChips?: ReadonlyArray<AnnotationChipDescriptor>` on
 *     InspectSectionContent (new optional field; existing
 *     `semanticFlags?: ReadonlyArray<string>` stays valid).
 *   - `bodyChips?: ReadonlyArray<AnnotationChipDescriptor>` on
 *     InspectSection (new optional field on the model output).
 *
 * This suite asserts:
 *   1. The pre-UX-001.5 fixture shape (semanticFlags: string[]) still
 *      compiles + still drives the §6 body string verbatim (no
 *      regression).
 *   2. The new fixture shape (semanticFlagsChips: descriptor[]) drives
 *      the §6 bodyChips field.
 *   3. Both fields can coexist; chips win for rendering, string body
 *      remains for screen-reader fallback.
 *   4. UX-001.5A's source / category descriptor fields are accepted
 *      without affecting UX-001.5 behavior.
 */
import {
  buildInspectPopout,
  getInspectSection,
  type BuildInspectPopoutInput,
  type InspectSectionContent,
} from '../src/features/arguments/oneBox/inspectPopoutModel';
import type { AnnotationChipDescriptor } from '../src/features/nodeAnnotations/annotationChipDescriptor';

function defaultInput(over: Partial<BuildInspectPopoutInput> = {}): BuildInspectPopoutInput {
  return {
    stage: 'open',
    content: over.content ?? {},
  };
}

// ── 1. Pre-UX-001.5 fixture shape still works ─────────────────

describe('UX-001.5 — interface stability — pre-UX-001.5 string fixtures still pass', () => {
  it('semanticFlags: string[] still drives the §6 body verbatim', () => {
    const content: InspectSectionContent = {
      semanticFlags: ['Needs source', 'Has evidence'],
    };
    const model = buildInspectPopout(defaultInput({ content }));
    const flags = getInspectSection(model, 'flags');
    // Body is the joined string — identical to pre-UX-001.5 behavior.
    expect(flags?.body).toBe('Needs source · Has evidence');
    // No bodyChips populated because the new field isn't set.
    expect(flags?.bodyChips).toBeUndefined();
  });

  it('absent semanticFlags renders the §7 fallback body unchanged', () => {
    const model = buildInspectPopout(defaultInput({ content: {} }));
    const flags = getInspectSection(model, 'flags');
    expect(flags?.body).toBe('No semantic flags.');
    expect(flags?.bodyChips).toBeUndefined();
  });
});

// ── 2. New fixture shape (chips) drives bodyChips ──────────────

describe('UX-001.5 — interface stability — new semanticFlagsChips field', () => {
  it('semanticFlagsChips populates bodyChips on §6 flags', () => {
    const content: InspectSectionContent = {
      semanticFlagsChips: [
        { id: 'a', label: 'Needs source', kind: 'flag' },
        { id: 'b', label: 'Has evidence', kind: 'lifecycle' },
      ],
    };
    const model = buildInspectPopout(defaultInput({ content }));
    const flags = getInspectSection(model, 'flags');
    expect(flags?.bodyChips?.length).toBe(2);
    expect(flags?.bodyChips?.[0]?.id).toBe('a');
  });

  it('empty semanticFlagsChips does not populate bodyChips', () => {
    const content: InspectSectionContent = { semanticFlagsChips: [] };
    const model = buildInspectPopout(defaultInput({ content }));
    expect(getInspectSection(model, 'flags')?.bodyChips).toBeUndefined();
  });
});

// ── 3. Both fields coexist — chips render, body stays for fallback ──

describe('UX-001.5 — interface stability — coexistence rules', () => {
  it('with both semanticFlags + semanticFlagsChips, both render paths work', () => {
    const content: InspectSectionContent = {
      semanticFlags: ['Needs source', 'Has evidence'],
      semanticFlagsChips: [
        { id: 'a', label: 'Needs source', kind: 'flag' },
        { id: 'b', label: 'Has evidence', kind: 'lifecycle' },
      ],
    };
    const model = buildInspectPopout(defaultInput({ content }));
    const flags = getInspectSection(model, 'flags');
    // Chips populate (the chip-strip render path).
    expect(flags?.bodyChips?.length).toBe(2);
    // String body still resolves (the screen-reader fallback path).
    expect(flags?.body).toBe('Needs source · Has evidence');
  });
});

// ── 4. UX-001.5A forward-compat fields ─────────────────────────

describe('UX-001.5 — interface stability — UX-001.5A source/category forward-compat', () => {
  it('descriptors with source + category populate bodyChips identically to source-neutral', () => {
    const sourceNeutral: AnnotationChipDescriptor = {
      id: 'a',
      label: 'Needs source',
      kind: 'flag',
    };
    const sourceAware: AnnotationChipDescriptor = {
      ...sourceNeutral,
      source: 'machine',
      category: 'rule_001_advisory',
    };

    const modelNeutral = buildInspectPopout(
      defaultInput({ content: { semanticFlagsChips: [sourceNeutral] } }),
    );
    const modelAware = buildInspectPopout(
      defaultInput({ content: { semanticFlagsChips: [sourceAware] } }),
    );

    const flagsNeutral = getInspectSection(modelNeutral, 'flags');
    const flagsAware = getInspectSection(modelAware, 'flags');

    expect(flagsNeutral?.bodyChips?.length).toBe(1);
    expect(flagsAware?.bodyChips?.length).toBe(1);
    // Source + category are preserved through the model (UX-001.5A
    // will read them); UX-001.5's rendering is source-neutral.
    expect(flagsAware?.bodyChips?.[0]?.source).toBe('machine');
    expect(flagsAware?.bodyChips?.[0]?.category).toBe('rule_001_advisory');
    // Source-neutral path has no source field — confirms the
    // forward-compat slot is purely additive.
    expect(flagsNeutral?.bodyChips?.[0]?.source).toBeUndefined();
  });
});

// ── 5. The fixed seven-section set is unchanged ────────────────

describe('UX-001.5 — interface stability — fixed section set unchanged', () => {
  it('the model still returns exactly 7 sections regardless of chip presence', () => {
    const chips: AnnotationChipDescriptor[] = [
      { id: 'a', label: 'A', kind: 'flag' },
      { id: 'b', label: 'B', kind: 'flag' },
    ];
    const modelWith = buildInspectPopout(
      defaultInput({ content: { semanticFlagsChips: chips } }),
    );
    const modelWithout = buildInspectPopout(defaultInput({ content: {} }));
    expect(modelWith.sections.length).toBe(7);
    expect(modelWithout.sections.length).toBe(7);
  });

  it('the section ids are unchanged', () => {
    const chips: AnnotationChipDescriptor[] = [
      { id: 'a', label: 'A', kind: 'flag' },
    ];
    const model = buildInspectPopout(
      defaultInput({ content: { semanticFlagsChips: chips } }),
    );
    expect(model.sections.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        'says',
        'matters',
        'unresolved',
        'sits',
        'next_move',
        'flags',
        'evidence_detail',
      ]),
    );
  });
});
