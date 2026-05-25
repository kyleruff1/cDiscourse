/**
 * UX-001.5 — Inspect §6 flags section integration.
 *
 * End-to-end coverage from the builder → model → component:
 *   1. `buildInspectContent` emits both the legacy `semanticFlags`
 *      string array AND the new `semanticFlagsChips` descriptor array
 *      when the sidecar has chips.
 *   2. `buildInspectPopout` populates `bodyChips` on the §6 flags
 *      section when `content.semanticFlagsChips` is non-empty.
 *   3. `InspectPopout` renders via `InspectSectionChipStrip` when the
 *      built section has `bodyChips` (verified by source-scan; runtime
 *      render is not exercised — repo convention).
 *
 * Back-compat: when only the legacy `semanticFlags` string array is
 * supplied (no `semanticFlagsChips`), the §6 body renders as a joined
 * Text — identical to pre-UX-001.5 behavior. Existing fixtures stay
 * green (`__tests__/inspectPopoutModel.test.ts`,
 * `__tests__/inspectPopoutComponent.test.tsx`,
 * `__tests__/inspectContentBuilder.test.ts` — all assert string-path
 * behavior + still pass).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  buildInspectPopout,
  getInspectSection,
  type BuildInspectPopoutInput,
} from '../src/features/arguments/oneBox/inspectPopoutModel';
import { buildInspectContent } from '../src/features/arguments/oneBox/inspectContentBuilder';
import type { SidecarViewModel } from '../src/features/arguments/argumentReplySidecarModel';
import type { AnnotationChipDescriptor } from '../src/features/nodeAnnotations/annotationChipDescriptor';

// ── Inspect component source (for chip-strip mount source-scan) ──

const INSPECT_POPOUT_SRC = fs.readFileSync(
  path.join(
    process.cwd(),
    'src',
    'features',
    'arguments',
    'oneBox',
    'InspectPopout.tsx',
  ),
  'utf8',
);

// ── Fixture helpers ────────────────────────────────────────────

function emptyViewModel(): SidecarViewModel {
  // Minimum shape — only the section list matters for the builder. The
  // top-level `selectedNodeId` / `selectedNodeKind` are required by the
  // type and not exercised here.
  return {
    selectedNodeId: 'node-1',
    selectedNodeKind: 'argument',
    isEmpty: false,
    sections: [],
  } as unknown as SidecarViewModel;
}

function makeViewModelWithSemanticFlags(
  chips: Array<{
    id: string;
    family: 'manual_tag' | 'auto_metadata';
    label: string;
    helperLine?: string;
    iconHint?: string;
    sourceCode: string;
  }>,
): SidecarViewModel {
  const vm = emptyViewModel();
  return {
    ...vm,
    sections: [
      {
        kind: 'semantic_flags',
        isCondensed: false,
        totalCount: chips.length,
        chips: chips.map((c) => ({
          id: c.id,
          family: c.family,
          label: c.label,
          helperLine: c.helperLine ?? '',
          iconHint: c.iconHint ?? '',
          sourceCode: c.sourceCode,
        })),
      },
    ],
  } as unknown as SidecarViewModel;
}

// ── 1. Builder emits both legacy + chip descriptors ─────────────

describe('UX-001.5 — buildInspectContent emits both semanticFlags + semanticFlagsChips', () => {
  it('with two manual-tag chips, both fields populate', () => {
    const vm = makeViewModelWithSemanticFlags([
      {
        id: 'manual_tag:needs_source',
        family: 'manual_tag',
        label: 'Needs source',
        helperLine: 'A primary source is needed.',
        sourceCode: 'needs_source',
      },
      {
        id: 'auto_metadata:has_evidence',
        family: 'auto_metadata',
        label: 'Has evidence',
        helperLine: 'Evidence is attached.',
        sourceCode: 'has_evidence',
      },
    ]);
    const out = buildInspectContent({ sidecarViewModel: vm });
    expect(out.semanticFlags).toEqual(['Needs source', 'Has evidence']);
    expect(out.semanticFlagsChips).toBeDefined();
    expect(out.semanticFlagsChips?.length).toBe(2);
  });

  it('descriptors carry the adapter-mapped kind (flag for manual, lifecycle for auto)', () => {
    const vm = makeViewModelWithSemanticFlags([
      {
        id: 'manual_tag:needs_source',
        family: 'manual_tag',
        label: 'Needs source',
        sourceCode: 'needs_source',
      },
      {
        id: 'auto_metadata:has_evidence',
        family: 'auto_metadata',
        label: 'Has evidence',
        sourceCode: 'has_evidence',
      },
    ]);
    const out = buildInspectContent({ sidecarViewModel: vm });
    const byId = new Map(
      (out.semanticFlagsChips ?? []).map((d: AnnotationChipDescriptor) => [d.id, d]),
    );
    expect(byId.get('manual_tag:needs_source')?.kind).toBe('flag');
    expect(byId.get('auto_metadata:has_evidence')?.kind).toBe('lifecycle');
  });

  it('omits semanticFlagsChips when totalCount is 0', () => {
    const vm = emptyViewModel();
    const sectionedVm = {
      ...vm,
      sections: [
        {
          kind: 'semantic_flags',
          isCondensed: false,
          totalCount: 0,
          chips: [],
        },
      ],
    } as unknown as SidecarViewModel;
    const out = buildInspectContent({ sidecarViewModel: sectionedVm });
    expect(out.semanticFlagsChips).toBeUndefined();
    expect(out.semanticFlags).toBeUndefined();
  });

  it('preserves legacy semanticFlags emission for back-compat', () => {
    const vm = makeViewModelWithSemanticFlags([
      {
        id: 'manual_tag:needs_source',
        family: 'manual_tag',
        label: 'Needs source',
        sourceCode: 'needs_source',
      },
    ]);
    const out = buildInspectContent({ sidecarViewModel: vm });
    // The string array is still emitted — pre-UX-001.5 consumers keep working.
    expect(out.semanticFlags).toEqual(['Needs source']);
  });

  it('descriptor tooltip carries the sidecar chip helperLine', () => {
    const vm = makeViewModelWithSemanticFlags([
      {
        id: 'manual_tag:needs_source',
        family: 'manual_tag',
        label: 'Needs source',
        helperLine: 'A primary source is needed.',
        sourceCode: 'needs_source',
      },
    ]);
    const out = buildInspectContent({ sidecarViewModel: vm });
    expect(out.semanticFlagsChips?.[0]?.tooltip).toBe(
      'A primary source is needed.',
    );
  });
});

// ── 2. buildInspectPopout populates bodyChips on §6 flags ──────

describe('UX-001.5 — buildInspectPopout — §6 flags bodyChips additive field', () => {
  function input(
    over: Partial<BuildInspectPopoutInput> = {},
  ): BuildInspectPopoutInput {
    return {
      stage: 'open',
      content: over.content ?? {},
    };
  }

  it('§6 flags has bodyChips when semanticFlagsChips is non-empty', () => {
    const chips: AnnotationChipDescriptor[] = [
      { id: 'a', label: 'Needs source', kind: 'flag' },
      { id: 'b', label: 'Has evidence', kind: 'lifecycle' },
    ];
    const model = buildInspectPopout(
      input({ content: { semanticFlagsChips: chips } }),
    );
    const flagsSection = getInspectSection(model, 'flags');
    expect(flagsSection).not.toBeNull();
    expect(flagsSection?.bodyChips).toBeDefined();
    expect(flagsSection?.bodyChips?.length).toBe(2);
  });

  it('§6 flags has no bodyChips when semanticFlagsChips is absent', () => {
    const model = buildInspectPopout(input({ content: {} }));
    const flagsSection = getInspectSection(model, 'flags');
    expect(flagsSection?.bodyChips).toBeUndefined();
  });

  it('§6 flags has no bodyChips when semanticFlagsChips is empty', () => {
    const model = buildInspectPopout(
      input({ content: { semanticFlagsChips: [] } }),
    );
    const flagsSection = getInspectSection(model, 'flags');
    expect(flagsSection?.bodyChips).toBeUndefined();
  });

  it('§6 flags bodyChips is frozen for safety', () => {
    const chips: AnnotationChipDescriptor[] = [
      { id: 'a', label: 'Needs source', kind: 'flag' },
    ];
    const model = buildInspectPopout(
      input({ content: { semanticFlagsChips: chips } }),
    );
    const flagsSection = getInspectSection(model, 'flags');
    expect(Object.isFrozen(flagsSection?.bodyChips)).toBe(true);
  });

  it('§6 flags body string remains resolved even when bodyChips is set', () => {
    const chips: AnnotationChipDescriptor[] = [
      { id: 'a', label: 'Needs source', kind: 'flag' },
    ];
    const model = buildInspectPopout(
      input({
        content: {
          semanticFlags: ['Needs source'],
          semanticFlagsChips: chips,
        },
      }),
    );
    const flagsSection = getInspectSection(model, 'flags');
    // The body string is still set — preserves the screen-reader
    // fallback path + legacy string consumers.
    expect(flagsSection?.body).toBe('Needs source');
  });

  it('non-flags sections never receive bodyChips (v1 scope)', () => {
    const chips: AnnotationChipDescriptor[] = [
      { id: 'a', label: 'Needs source', kind: 'flag' },
    ];
    const model = buildInspectPopout(
      input({ content: { semanticFlagsChips: chips } }),
    );
    for (const section of model.sections) {
      if (section.id !== 'flags') {
        expect(section.bodyChips).toBeUndefined();
      }
    }
  });
});

// ── 3. InspectPopout renders chip strip when bodyChips is set ───

describe('UX-001.5 — InspectPopout renders chip strip when bodyChips is set (source-scan)', () => {
  it('imports InspectSectionChipStrip', () => {
    expect(INSPECT_POPOUT_SRC).toMatch(
      /from\s+['"]\.\.\/\.\.\/nodeAnnotations\/InspectSectionChipStrip['"]/,
    );
  });

  it('mounts InspectSectionChipStrip when section.bodyChips is non-empty', () => {
    expect(INSPECT_POPOUT_SRC).toMatch(
      /renderChipStrip\s*&&\s*section\.bodyChips\s*\?[\s\S]*?<InspectSectionChipStrip/,
    );
  });

  it('falls back to Text body when bodyChips is absent', () => {
    expect(INSPECT_POPOUT_SRC).toMatch(
      /<Text\s+style=\{styles\.sectionBodyText\}>\{section\.body\}/,
    );
  });

  it('chip strip mount is gated to the §6 flags section', () => {
    expect(INSPECT_POPOUT_SRC).toMatch(/section\.id\s*===\s*['"]flags['"]/);
  });

  it('chip strip carries a stable testID', () => {
    expect(INSPECT_POPOUT_SRC).toMatch(/inspect-popout-section-chips-/);
  });

  it('threads the band prop into the chip strip', () => {
    expect(INSPECT_POPOUT_SRC).toMatch(/band=\{band\}/);
  });
});

// ── 4. Inspect remains strictly read-only (UX-001.5 doctrine) ───

describe('UX-001.5 — Inspect chip strip is non-interactive (read-only)', () => {
  it('InspectPopout does NOT pass onChipPress to the chip strip', () => {
    // Inspect is read-only per design §4. The chip strip mount in
    // InspectPopout MUST NOT supply onChipPress.
    expect(INSPECT_POPOUT_SRC).not.toMatch(
      /<InspectSectionChipStrip[\s\S]*?onChipPress=/,
    );
  });
});
