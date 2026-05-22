/**
 * QOL-042 — linkedPriorArgumentModel pure-model tests.
 *
 * Covers `buildLinkedPriorArgumentChip` (three view states),
 * `canCreateLink`, `buildLinkedTangentContext`, and determinism.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_LINK_ACCESS_STATES,
  buildLinkedPriorArgumentChip,
  buildLinkedTangentContext,
  canCreateLink,
  type ArgumentRoomLink,
  type BuildLinkedPriorArgumentChipInput,
  type ResolvedTangentRow,
} from '../src/features/arguments/crossRoom/linkedPriorArgumentModel';
import { LINKED_PRIOR_ARGUMENT_COPY } from '../src/features/arguments/crossRoom/linkedPriorArgumentCopy';

// ── Fixtures ───────────────────────────────────────────────────

const baseLink: ArgumentRoomLink = Object.freeze({
  id: 'link-1',
  sourceDebateId: 'room-new',
  targetDebateId: 'room-prior',
  createdBy: 'user-a',
  targetTitleSnapshot: 'Dishes after the camping week',
  note: 'Same door-unlocked issue as before',
  isRemoved: false,
  createdAt: '2026-05-01T00:00:00.000Z',
});

function buildInput(
  overrides: Partial<BuildLinkedPriorArgumentChipInput>,
): BuildLinkedPriorArgumentChipInput {
  return {
    link: baseLink,
    priorRoomSummary: {},
    viewerAccess: 'authorized',
    ...overrides,
  };
}

// ── ALL_LINK_ACCESS_STATES ─────────────────────────────────────

describe('ALL_LINK_ACCESS_STATES', () => {
  it('lists exactly the three access states', () => {
    expect([...ALL_LINK_ACCESS_STATES].sort()).toEqual(
      ['authorized', 'title_only', 'unavailable'].sort(),
    );
  });
});

// ── buildLinkedPriorArgumentChip — State A (authorized) ─────────

describe('buildLinkedPriorArgumentChip — State A authorized', () => {
  it('produces title + counts + both actions when there is tangent context', () => {
    const chip = buildLinkedPriorArgumentChip(
      buildInput({
        viewerAccess: 'authorized',
        priorRoomSummary: {
          liveTitle: 'Dishes after the camping week',
          moveCount: 6,
          resolvedTangentCount: 1,
        },
        hasTangentContext: true,
      }),
    );
    expect(chip.accessState).toBe('authorized');
    expect(chip.header).toBe(LINKED_PRIOR_ARGUMENT_COPY.chipHeaderPublic);
    expect(chip.title).toBe('Dishes after the camping week');
    expect(chip.subLine).toBe('Settled · 6 moves · 1 resolved tangent');
    const actionIds = chip.actions.map((a) => a.id);
    expect(actionIds).toEqual(['open_prior', 'view_context']);
    expect(chip.actions.every((a) => !a.isDisabled)).toBe(true);
  });

  it('omits the View context action when there is no tangent context', () => {
    const chip = buildLinkedPriorArgumentChip(
      buildInput({
        viewerAccess: 'authorized',
        priorRoomSummary: { liveTitle: 'A prior room', moveCount: 3 },
        hasTangentContext: false,
      }),
    );
    expect(chip.actions.map((a) => a.id)).toEqual(['open_prior']);
  });

  it('prefers the live title over the snapshot title', () => {
    const chip = buildLinkedPriorArgumentChip(
      buildInput({
        viewerAccess: 'authorized',
        priorRoomSummary: { liveTitle: 'Edited live title' },
      }),
    );
    expect(chip.title).toBe('Edited live title');
  });

  it('falls back to the snapshot title when the live title is absent', () => {
    const chip = buildLinkedPriorArgumentChip(
      buildInput({ viewerAccess: 'authorized', priorRoomSummary: {} }),
    );
    expect(chip.title).toBe('Dishes after the camping week');
  });

  it('renders the link note as a muted line when present', () => {
    const chip = buildLinkedPriorArgumentChip(
      buildInput({ viewerAccess: 'authorized', priorRoomSummary: { liveTitle: 'x' } }),
    );
    expect(chip.note).toBe('Same door-unlocked issue as before');
  });

  it('omits counts that are zero / absent (Settled stays alone)', () => {
    const chip = buildLinkedPriorArgumentChip(
      buildInput({ viewerAccess: 'authorized', priorRoomSummary: { liveTitle: 'x' } }),
    );
    expect(chip.subLine).toBe('Settled');
  });

  it('uses the private header when the prior room is private + authorized', () => {
    const chip = buildLinkedPriorArgumentChip(
      buildInput({
        viewerAccess: 'authorized',
        priorRoomSummary: { liveTitle: 'x', isPrivate: true },
      }),
    );
    expect(chip.header).toBe(LINKED_PRIOR_ARGUMENT_COPY.chipHeaderPrivate);
  });

  it('singularizes "move" and "tangent" for a count of 1', () => {
    const chip = buildLinkedPriorArgumentChip(
      buildInput({
        viewerAccess: 'authorized',
        priorRoomSummary: { liveTitle: 'x', moveCount: 1, resolvedTangentCount: 1 },
      }),
    );
    expect(chip.subLine).toBe('Settled · 1 move · 1 resolved tangent');
  });
});

// ── buildLinkedPriorArgumentChip — State B (title_only) ─────────

describe('buildLinkedPriorArgumentChip — State B title_only', () => {
  const chip = buildLinkedPriorArgumentChip(
    buildInput({
      link: { ...baseLink, targetTitleSnapshot: 'March practice-room rent' },
      viewerAccess: 'title_only',
      priorRoomSummary: { isPrivate: true },
    }),
  );

  it('renders ONLY the snapshot title — no counts, no names', () => {
    expect(chip.accessState).toBe('title_only');
    expect(chip.title).toBe('March practice-room rent');
    expect(chip.subLine).toBe(LINKED_PRIOR_ARGUMENT_COPY.titleOnlyLockLine);
  });

  it('does not surface the link note (it could leak the author framing)', () => {
    expect(chip.note).toBe('');
  });

  it('uses the private header', () => {
    expect(chip.header).toBe(LINKED_PRIOR_ARGUMENT_COPY.chipHeaderPrivate);
  });

  it('exposes only the Open action, disabled with a reason', () => {
    expect(chip.actions).toHaveLength(1);
    const open = chip.actions[0];
    expect(open.id).toBe('open_prior');
    expect(open.isDisabled).toBe(true);
    expect(open.disabledReason).toBe(LINKED_PRIOR_ARGUMENT_COPY.openDisabledReason);
  });

  it('the View context action is absent (nothing to show)', () => {
    expect(chip.actions.some((a) => a.id === 'view_context')).toBe(false);
  });

  it('the disabled Open action carries its reason in the a11y label', () => {
    expect(chip.actions[0].accessibilityLabel).toContain(
      LINKED_PRIOR_ARGUMENT_COPY.openDisabledReason,
    );
  });
});

// ── buildLinkedPriorArgumentChip — State C (unavailable) ────────

describe('buildLinkedPriorArgumentChip — State C unavailable', () => {
  const chip = buildLinkedPriorArgumentChip(
    buildInput({ viewerAccess: 'unavailable' }),
  );

  it('renders a single neutral line, no title, no actions', () => {
    expect(chip.accessState).toBe('unavailable');
    expect(chip.header).toBe(LINKED_PRIOR_ARGUMENT_COPY.unavailable);
    expect(chip.title).toBe('');
    expect(chip.subLine).toBe('');
    expect(chip.note).toBe('');
    expect(chip.actions).toHaveLength(0);
  });
});

// ── canCreateLink ──────────────────────────────────────────────

describe('canCreateLink', () => {
  it('is true only for a settled (locked) target room', () => {
    expect(canCreateLink('locked')).toBe(true);
  });

  it('is false for draft / open / archived', () => {
    expect(canCreateLink('draft')).toBe(false);
    expect(canCreateLink('open')).toBe(false);
    expect(canCreateLink('archived')).toBe(false);
  });

  it('is false for an unknown status', () => {
    expect(canCreateLink('')).toBe(false);
    expect(canCreateLink('whatever')).toBe(false);
  });
});

// ── buildLinkedTangentContext ──────────────────────────────────

describe('buildLinkedTangentContext', () => {
  it('returns an empty list given zero rows (the title-only path)', () => {
    expect(buildLinkedTangentContext([])).toEqual([]);
  });

  it('returns an empty list for a non-array input (defensive)', () => {
    expect(buildLinkedTangentContext(null as unknown as ResolvedTangentRow[])).toEqual([]);
  });

  it('formats resolved-tangent rows into context items', () => {
    const rows: ResolvedTangentRow[] = [
      { argumentId: 'a1', excerpt: 'The door was left unlocked', lifecycleStage: 'archived_or_resolved' },
      { argumentId: 'a2', excerpt: 'And the porch light too', lifecycleStage: 'archived_or_resolved' },
    ];
    expect(buildLinkedTangentContext(rows)).toEqual([
      { argumentId: 'a1', excerpt: 'The door was left unlocked' },
      { argumentId: 'a2', excerpt: 'And the porch light too' },
    ]);
  });

  it('keeps only archived_or_resolved nodes when a real LIFE-001 stage is present', () => {
    const rows: ResolvedTangentRow[] = [
      { argumentId: 'a1', excerpt: 'resolved tangent', lifecycleStage: 'archived_or_resolved' },
      { argumentId: 'a2', excerpt: 'still-open tangent', lifecycleStage: 'open' },
      { argumentId: 'a3', excerpt: 'rebutted tangent', lifecycleStage: 'rebutted' },
    ];
    expect(buildLinkedTangentContext(rows).map((i) => i.argumentId)).toEqual(['a1']);
  });

  it('degrades to keep a node when its LIFE-001 stage is null (design Q4)', () => {
    const rows: ResolvedTangentRow[] = [
      { argumentId: 'a1', excerpt: 'tangent without a stage', lifecycleStage: null },
    ];
    expect(buildLinkedTangentContext(rows).map((i) => i.argumentId)).toEqual(['a1']);
  });

  it('drops rows with a blank excerpt or missing argumentId', () => {
    const rows: ResolvedTangentRow[] = [
      { argumentId: 'a1', excerpt: '   ', lifecycleStage: null },
      { argumentId: '', excerpt: 'no id', lifecycleStage: null },
      { argumentId: 'a3', excerpt: 'kept', lifecycleStage: null },
    ];
    expect(buildLinkedTangentContext(rows).map((i) => i.argumentId)).toEqual(['a3']);
  });

  it('trims the excerpt text', () => {
    const rows: ResolvedTangentRow[] = [
      { argumentId: 'a1', excerpt: '  padded excerpt  ', lifecycleStage: null },
    ];
    expect(buildLinkedTangentContext(rows)[0].excerpt).toBe('padded excerpt');
  });
});

// ── Determinism ────────────────────────────────────────────────

describe('linkedPriorArgumentModel — determinism', () => {
  it('buildLinkedPriorArgumentChip returns equal output for equal input', () => {
    const input = buildInput({
      viewerAccess: 'authorized',
      priorRoomSummary: { liveTitle: 'x', moveCount: 4, resolvedTangentCount: 2 },
      hasTangentContext: true,
    });
    expect(buildLinkedPriorArgumentChip(input)).toEqual(buildLinkedPriorArgumentChip(input));
  });

  it('does not mutate the input link or summary', () => {
    const link = { ...baseLink };
    const summary = { liveTitle: 'x', moveCount: 4 };
    buildLinkedPriorArgumentChip({ link, priorRoomSummary: summary, viewerAccess: 'authorized' });
    expect(link).toEqual(baseLink);
    expect(summary).toEqual({ liveTitle: 'x', moveCount: 4 });
  });

  it('does not reference Date.now (no time-dependence in the model code)', () => {
    // The model file must be pure — a source scan over the CODE (comments
    // stripped, since the docstring legitimately says "no Date.now()")
    // guards against a future regression introducing a time dependency.
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'src/features/arguments/crossRoom/linkedPriorArgumentModel.ts'),
      'utf8',
    );
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line: string) => line.replace(/\/\/.*$/, ''))
      .join('\n');
    expect(code).not.toMatch(/Date\.now\(/);
    expect(code).not.toMatch(/new Date\(/);
  });
});
