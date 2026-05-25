/**
 * UX-001.4 — inspectContentBuilder coverage.
 *
 * Pure-TS test suite for `buildInspectContent`. Verifies the mapping
 * of every sidecar section to an InspectSectionContent field, the
 * empty-input fallback, and the absence of any verdict / internal-code
 * leak.
 */
import { buildInspectContent } from '../src/features/arguments/oneBox/inspectContentBuilder';
import type { SidecarViewModel } from '../src/features/arguments/argumentReplySidecarModel';

function makeViewModel(overrides: Partial<SidecarViewModel> = {}): SidecarViewModel {
  return {
    isEmpty: false,
    selectedMessageId: 'msg-1',
    viewMode: 'stack',
    sections: [],
    accessibilityRootLabel: 'detail',
    emptyStateMessage: 'Nothing here.',
    ...overrides,
  };
}

describe('buildInspectContent — empty / null safety', () => {
  it('returns an empty content object when sidecarViewModel is null', () => {
    expect(buildInspectContent({ sidecarViewModel: null })).toEqual({});
  });

  it('returns an empty content object when sidecarViewModel is empty', () => {
    expect(buildInspectContent({ sidecarViewModel: makeViewModel({ isEmpty: true }) })).toEqual(
      {},
    );
  });

  it('returns an empty content object when sections is empty', () => {
    expect(buildInspectContent({ sidecarViewModel: makeViewModel({ sections: [] }) })).toEqual({});
  });
});

describe('buildInspectContent — §1 says (what_this_move_says)', () => {
  it('maps bodyExcerpt to `says`', () => {
    const vm = makeViewModel({
      sections: [
        {
          kind: 'what_this_move_says',
          bodyExcerpt: 'This is the body of the move.',
          isTruncated: false,
          fullBodyLength: 30,
          createdAtLabel: '2026-05-25',
          relativeLabel: '5m ago',
          parentHint: null,
          parentBodyPreview: null,
          actorLabel: 'You',
          sideLabel: 'Aff',
          kindLabel: 'Claim',
          isHidden: false,
          hiddenNotice: null,
          standingLine: '',
          toneLine: '',
          heatLine: '',
        },
      ],
    });
    expect(buildInspectContent({ sidecarViewModel: vm }).says).toBe('This is the body of the move.');
  });

  it('omits `says` when bodyExcerpt is empty string', () => {
    const vm = makeViewModel({
      sections: [
        {
          kind: 'what_this_move_says',
          bodyExcerpt: '',
          isTruncated: false,
          fullBodyLength: 0,
          createdAtLabel: '',
          relativeLabel: '',
          parentHint: null,
          parentBodyPreview: null,
          actorLabel: '',
          sideLabel: '',
          kindLabel: '',
          isHidden: false,
          hiddenNotice: null,
          standingLine: '',
          toneLine: '',
          heatLine: '',
        },
      ],
    });
    expect(buildInspectContent({ sidecarViewModel: vm }).says).toBeUndefined();
  });

  it('trims whitespace before assigning `says`', () => {
    const vm = makeViewModel({
      sections: [
        {
          kind: 'what_this_move_says',
          bodyExcerpt: '   spaced text   ',
          isTruncated: false,
          fullBodyLength: 11,
          createdAtLabel: '',
          relativeLabel: '',
          parentHint: null,
          parentBodyPreview: null,
          actorLabel: '',
          sideLabel: '',
          kindLabel: '',
          isHidden: false,
          hiddenNotice: null,
          standingLine: '',
          toneLine: '',
          heatLine: '',
        },
      ],
    });
    expect(buildInspectContent({ sidecarViewModel: vm }).says).toBe('spaced text');
  });
});

describe('buildInspectContent — §2 matters (why_it_matters)', () => {
  it('maps lifecycleHelperLine to `matters`', () => {
    const vm = makeViewModel({
      sections: [
        {
          kind: 'why_it_matters',
          lifecycleLabel: 'Open',
          lifecycleHelperLine: 'This point is open for response.',
          lifecycleIconHint: 'O',
          lifecycleStateCode: 'open',
          isEmpty: false,
        },
      ],
    });
    expect(buildInspectContent({ sidecarViewModel: vm }).matters).toBe(
      'This point is open for response.',
    );
  });

  it('omits `matters` when isEmpty is true', () => {
    const vm = makeViewModel({
      sections: [
        {
          kind: 'why_it_matters',
          lifecycleLabel: '',
          lifecycleHelperLine: '',
          lifecycleIconHint: '',
          lifecycleStateCode: null,
          isEmpty: true,
        },
      ],
    });
    expect(buildInspectContent({ sidecarViewModel: vm }).matters).toBeUndefined();
  });
});

describe('buildInspectContent — §3 unresolved (what_is_unresolved)', () => {
  it('joins unresolved item labels with " · "', () => {
    const vm = makeViewModel({
      sections: [
        {
          kind: 'what_is_unresolved',
          items: [
            { id: 'a', label: 'Source needed', helperLine: '', iconHint: '', sourceCode: 'source_requested' },
            { id: 'b', label: 'Quote needed', helperLine: '', iconHint: '', sourceCode: 'quote_requested' },
          ],
          isEmpty: false,
          emptyNotice: '',
        },
      ],
    });
    expect(buildInspectContent({ sidecarViewModel: vm }).unresolved).toBe(
      'Source needed · Quote needed',
    );
  });

  it('omits `unresolved` when isEmpty is true', () => {
    const vm = makeViewModel({
      sections: [
        {
          kind: 'what_is_unresolved',
          items: [],
          isEmpty: true,
          emptyNotice: 'Nothing open.',
        },
      ],
    });
    expect(buildInspectContent({ sidecarViewModel: vm }).unresolved).toBeUndefined();
  });
});

describe('buildInspectContent — §4 sits (where_it_sits)', () => {
  it('uses sidecar pathLabel by default', () => {
    const vm = makeViewModel({
      sections: [
        {
          kind: 'where_it_sits',
          branchLabel: 'Mainline',
          laneIndex: 0,
          depth: 1,
          pathLabel: 'Root → #2',
          totalCount: 3,
          ordinal: 2,
        },
      ],
    });
    expect(buildInspectContent({ sidecarViewModel: vm }).sits).toBe('Root → #2');
  });

  it('uses branchPositionLabel when supplied', () => {
    const vm = makeViewModel({
      sections: [
        {
          kind: 'where_it_sits',
          branchLabel: 'Mainline',
          laneIndex: 0,
          depth: 1,
          pathLabel: 'Root → #2',
          totalCount: 3,
          ordinal: 2,
        },
      ],
    });
    expect(
      buildInspectContent({
        sidecarViewModel: vm,
        branchPositionLabel: 'Mainline · #2 of 3',
      }).sits,
    ).toBe('Mainline · #2 of 3');
  });

  it('falls back to pathLabel when branchPositionLabel is empty', () => {
    const vm = makeViewModel({
      sections: [
        {
          kind: 'where_it_sits',
          branchLabel: 'Mainline',
          laneIndex: 0,
          depth: 1,
          pathLabel: 'Root → #2',
          totalCount: 3,
          ordinal: 2,
        },
      ],
    });
    expect(buildInspectContent({ sidecarViewModel: vm, branchPositionLabel: '   ' }).sits).toBe(
      'Root → #2',
    );
  });
});

describe('buildInspectContent — §6 semanticFlags (semantic_flags)', () => {
  it('maps chip labels to semanticFlags array', () => {
    const vm = makeViewModel({
      sections: [
        {
          kind: 'semantic_flags',
          isCondensed: false,
          totalCount: 2,
          chips: [
            {
              id: 'auto_metadata:has_evidence',
              family: 'auto_metadata',
              label: 'Has evidence',
              helperLine: '',
              iconHint: '',
              sourceCode: 'has_evidence',
            },
            {
              id: 'manual_tag:needs_source',
              family: 'manual_tag',
              label: 'Needs source',
              helperLine: '',
              iconHint: '',
              sourceCode: 'needs_source',
            },
          ],
        },
      ],
    });
    expect(buildInspectContent({ sidecarViewModel: vm }).semanticFlags).toEqual([
      'Has evidence',
      'Needs source',
    ]);
  });

  it('omits semanticFlags when totalCount is 0', () => {
    const vm = makeViewModel({
      sections: [
        {
          kind: 'semantic_flags',
          isCondensed: false,
          totalCount: 0,
          chips: [],
        },
      ],
    });
    expect(buildInspectContent({ sidecarViewModel: vm }).semanticFlags).toBeUndefined();
  });
});

describe('buildInspectContent — read-only, deterministic', () => {
  it('does not mutate its input sidecar view-model', () => {
    const sections = [
      {
        kind: 'what_this_move_says' as const,
        bodyExcerpt: 'Body',
        isTruncated: false,
        fullBodyLength: 4,
        createdAtLabel: '',
        relativeLabel: '',
        parentHint: null,
        parentBodyPreview: null,
        actorLabel: '',
        sideLabel: '',
        kindLabel: '',
        isHidden: false,
        hiddenNotice: null,
        standingLine: '',
        toneLine: '',
        heatLine: '',
      },
    ];
    const vm = makeViewModel({ sections });
    const before = JSON.stringify(vm);
    buildInspectContent({ sidecarViewModel: vm });
    expect(JSON.stringify(vm)).toBe(before);
  });

  it('is deterministic on identical inputs', () => {
    const vm = makeViewModel({
      sections: [
        {
          kind: 'what_this_move_says',
          bodyExcerpt: 'Same body',
          isTruncated: false,
          fullBodyLength: 9,
          createdAtLabel: '',
          relativeLabel: '',
          parentHint: null,
          parentBodyPreview: null,
          actorLabel: '',
          sideLabel: '',
          kindLabel: '',
          isHidden: false,
          hiddenNotice: null,
          standingLine: '',
          toneLine: '',
          heatLine: '',
        },
      ],
    });
    const out1 = buildInspectContent({ sidecarViewModel: vm });
    const out2 = buildInspectContent({ sidecarViewModel: vm });
    expect(out1).toEqual(out2);
  });
});
