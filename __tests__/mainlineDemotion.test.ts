/**
 * BR-003 — mainline demotion + deterministic-no-AI + no-keyword + no-heat
 * doctrine tests.
 *
 * Covers `countRecentTangentMoves` (under / at / over threshold; per-side
 * filtering; topology-kind filtering), `buildMainlineDemotionAdvisory`
 * (active / inactive; reversal; person-free copy), the reversal behaviour
 * (no persisted demoted flag — re-counting clears it), and the doctrine
 * guarantees that `assessTangentRisk` is deterministic, never keyword-
 * gates on body text, and never reads heat / popularity.
 *
 * Pure-TS — no React, no Supabase, no network.
 */
import {
  REPEATED_OFF_PATH_THRESHOLD,
  assessTangentRisk,
  buildMainlineDemotionAdvisory,
  countRecentTangentMoves,
  type AssessTangentRiskInput,
  type TangentThreadContext,
  type TangentThreadMove,
} from '../src/features/arguments/tangentRoutingModel';
import type { ComposerDraft } from '../src/features/arguments/composerState';
import type { ArgumentRow } from '../src/features/arguments/types';
import type { RailBranchKind } from '../src/features/arguments/railSegmentModel';

// ── Fixtures ───────────────────────────────────────────────────

function makeDraft(overrides: Partial<ComposerDraft> = {}): ComposerDraft {
  return {
    draftId: 'draft-1',
    debateId: 'debate-1',
    parentId: 'parent-1',
    argumentType: 'claim',
    side: 'affirmative',
    body: 'A short clean reply about the resolution.',
    selectedTagCodes: [],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    updatedAt: '2026-05-20T00:00:00.000Z',
    dirty: true,
    ...overrides,
  };
}

function makeParent(): ArgumentRow {
  return {
    id: 'parent-1',
    debateId: 'debate-1',
    parentId: null,
    authorId: 'user-1',
    argumentType: 'thesis',
    side: 'affirmative',
    body: 'Parent claim body.',
    depth: 0,
    status: 'posted',
    targetExcerpt: null,
    disagreementAxis: null,
    railPayload: {},
    clientValidation: {},
    serverValidation: {},
    clientSubmissionId: null,
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:00.000Z',
  };
}

function move(
  side: 'affirmative' | 'negative' | null,
  inboundBranchKind: RailBranchKind,
  id = `m-${Math.random()}`,
): TangentThreadMove {
  return { messageId: id, side, inboundBranchKind };
}

function offPathContext(count: number): TangentThreadContext {
  const recentMoves: TangentThreadMove[] = [];
  for (let i = 0; i < count; i += 1) {
    recentMoves.push(move('affirmative', 'tangent', `off-${i}`));
  }
  return { authorSide: 'affirmative', recentMoves };
}

function makeInput(
  overrides: Partial<AssessTangentRiskInput> = {},
): AssessTangentRiskInput {
  return {
    draft: makeDraft(),
    parent: makeParent(),
    lifecycle: {
      parentSnapshot: null,
      parentClusterSummary: null,
      parentLinkage: null,
    },
    manualTags: [],
    ...overrides,
  };
}

// ── countRecentTangentMoves — threshold boundary ───────────────

describe('countRecentTangentMoves — threshold boundary (§7 #9)', () => {
  it('counts 2 off-path moves as 2 (under threshold)', () => {
    expect(countRecentTangentMoves(offPathContext(2))).toBe(2);
  });

  it('counts 3 off-path moves as 3 (at threshold)', () => {
    expect(countRecentTangentMoves(offPathContext(3))).toBe(3);
  });

  it('counts 5 off-path moves as 5 (over threshold)', () => {
    expect(countRecentTangentMoves(offPathContext(5))).toBe(5);
  });

  it('ignores the other side moves and the mainline moves', () => {
    const context: TangentThreadContext = {
      authorSide: 'affirmative',
      recentMoves: [
        move('affirmative', 'tangent'),
        move('negative', 'tangent'),
        move('affirmative', 'main'),
        move('affirmative', 'kink_start'),
      ],
    };
    expect(countRecentTangentMoves(context)).toBe(2);
  });

  it('counts a null authorSide only against null-side moves', () => {
    const context: TangentThreadContext = {
      authorSide: null,
      recentMoves: [move(null, 'tangent'), move('affirmative', 'tangent')],
    };
    expect(countRecentTangentMoves(context)).toBe(1);
  });
});

// ── buildMainlineDemotionAdvisory ──────────────────────────────

describe('buildMainlineDemotionAdvisory — activation boundary', () => {
  it('is inactive at 2 off-path moves', () => {
    expect(buildMainlineDemotionAdvisory(offPathContext(2)).active).toBe(false);
  });

  it('is active at exactly the threshold', () => {
    const advisory = buildMainlineDemotionAdvisory(
      offPathContext(REPEATED_OFF_PATH_THRESHOLD),
    );
    expect(advisory.active).toBe(true);
    expect(advisory.offPathCount).toBe(REPEATED_OFF_PATH_THRESHOLD);
  });

  it('is active above the threshold', () => {
    expect(buildMainlineDemotionAdvisory(offPathContext(5)).active).toBe(true);
  });

  it('reversalActions include a direct-reply action', () => {
    const advisory = buildMainlineDemotionAdvisory(offPathContext(3));
    expect(advisory.reversalActions).toContain('ask_clarifying_question');
  });

  it('plainLanguage names the thread, not a participant', () => {
    const advisory = buildMainlineDemotionAdvisory(offPathContext(3));
    expect(advisory.plainLanguage.toLowerCase()).toContain('thread');
  });
});

// ── Reversal — no persisted flag ───────────────────────────────

describe('BR-003 — mainline demotion is reversible (§7 #10)', () => {
  it('clears automatically once a direct move drops the count below threshold', () => {
    const beforeReversal = buildMainlineDemotionAdvisory(offPathContext(3));
    expect(beforeReversal.active).toBe(true);

    // The next assessment uses a context where two of the three earlier
    // off-path moves have rolled out of the recent window and the side's
    // latest move is a direct (main) reply — count drops to 1.
    const afterReversal = buildMainlineDemotionAdvisory({
      authorSide: 'affirmative',
      recentMoves: [
        move('affirmative', 'tangent'),
        move('affirmative', 'main'),
        move('affirmative', 'main'),
      ],
    });
    expect(afterReversal.active).toBe(false);
  });
});

// ── Deterministic — no AI ──────────────────────────────────────

describe('BR-003 — assessTangentRisk is deterministic, no AI', () => {
  it('returns equal output across many calls of the same input', () => {
    const input = makeInput({
      tangentContext: offPathContext(4),
    });
    const first = assessTangentRisk(input);
    for (let i = 0; i < 20; i += 1) {
      expect(assessTangentRisk(input)).toEqual(first);
    }
  });
});

// ── No keyword gating on body text ─────────────────────────────

describe('BR-003 — never keyword-gates on raw body text (Stage 6.2)', () => {
  it('a charged-keyword body and a benign body of identical structure assess identically', () => {
    const chargedBody =
      'This is absolutely false propaganda and the other side is lying about everything.';
    const benignBody = 'A measured reply that engages the point above directly.';

    const charged = assessTangentRisk(
      makeInput({ draft: makeDraft({ body: chargedBody }) }),
    );
    const benign = assessTangentRisk(
      makeInput({ draft: makeDraft({ body: benignBody }) }),
    );
    expect(charged).toEqual(benign);
  });

  it('the words "tangent" / "branch" in the body do not raise a risk', () => {
    const result = assessTangentRisk(
      makeInput({
        draft: makeDraft({
          body: 'I want to branch off into a tangent about something else entirely.',
        }),
      }),
    );
    // Only typed tags / channels raise user_marked_tangent — not body text.
    expect(result.risk).toBe('none');
  });
});

// ── No heat / popularity signal ────────────────────────────────

describe('BR-003 — heat / popularity never raises a redirect risk', () => {
  it('two drafts identical in structure assess identically regardless of (mock) heat', () => {
    // railPayload is where any heat-shaped data would live — BR-003 never
    // reads it. Two parents differing only in railPayload yield the same
    // assessment.
    const coolParent = { ...makeParent(), railPayload: { heat: 0 } };
    const hotParent = { ...makeParent(), railPayload: { heat: 99 } };

    const cool = assessTangentRisk(makeInput({ parent: coolParent }));
    const hot = assessTangentRisk(makeInput({ parent: hotParent }));
    expect(cool).toEqual(hot);
  });
});
