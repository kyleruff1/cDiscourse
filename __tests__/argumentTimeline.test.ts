import {
  mapArgumentToTrackKind,
  buildArgumentTimeline,
  getTimelineLanes,
  getCorePath,
  getTangentCandidates,
  shouldShowBranchButton,
  TRACK_LANE_LABELS,
  TRACK_LANE_ORDER,
} from '../src/features/arguments/argumentTimeline';
import type { ArgumentRow, ArgumentCache, ArgumentFlag, TopicSatisfactionCheck } from '../src/features/arguments/types';

function makeArg(overrides: Partial<ArgumentRow>): ArgumentRow {
  return {
    id: 'arg1',
    debateId: 'debate1',
    parentId: null,
    authorId: 'user1',
    argumentType: 'claim',
    side: 'affirmative',
    body: 'Test body text',
    depth: 0,
    status: 'posted',
    targetExcerpt: null,
    disagreementAxis: null,
    railPayload: {},
    clientValidation: {},
    serverValidation: {},
    clientSubmissionId: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeCache(args: ArgumentRow[]): ArgumentCache {
  const argumentsById: Record<string, ArgumentRow> = {};
  const childIdsByParentId: Record<string, string[]> = {};
  for (const arg of args) {
    argumentsById[arg.id] = arg;
    if (arg.parentId) {
      if (!childIdsByParentId[arg.parentId]) childIdsByParentId[arg.parentId] = [];
      childIdsByParentId[arg.parentId].push(arg.id);
    }
  }
  return {
    argumentsById,
    childIdsByParentId,
    tagsByArgumentId: {},
    flagsByArgumentId: {},
    checksByArgumentId: {},
    detachedArgumentIds: [],
    loadedParentIds: new Set(),
    loadedAtByParentId: {},
  };
}

describe('argumentTimeline', () => {
  describe('mapArgumentToTrackKind', () => {
    it('maps thesis to core', () => {
      expect(mapArgumentToTrackKind(makeArg({ argumentType: 'thesis' }), [], [])).toBe('core');
    });

    it('maps claim to core', () => {
      expect(mapArgumentToTrackKind(makeArg({ argumentType: 'claim' }), [], [])).toBe('core');
    });

    it('maps rebuttal to counter', () => {
      expect(mapArgumentToTrackKind(makeArg({ argumentType: 'rebuttal' }), [], [])).toBe('counter');
    });

    it('maps counter_rebuttal to counter', () => {
      expect(mapArgumentToTrackKind(makeArg({ argumentType: 'counter_rebuttal' }), [], [])).toBe('counter');
    });

    it('maps evidence to receipts', () => {
      expect(mapArgumentToTrackKind(makeArg({ argumentType: 'evidence' }), [], [])).toBe('receipts');
    });

    it('maps clarification_request to clarification', () => {
      expect(mapArgumentToTrackKind(makeArg({ argumentType: 'clarification_request' }), [], [])).toBe('clarification');
    });

    it('maps concession to concession lane', () => {
      expect(mapArgumentToTrackKind(makeArg({ argumentType: 'concession' }), [], [])).toBe('concession');
    });

    it('maps synthesis to concession lane', () => {
      expect(mapArgumentToTrackKind(makeArg({ argumentType: 'synthesis' }), [], [])).toBe('concession');
    });

    it('maps off-track argument to tangent', () => {
      const flag: ArgumentFlag = {
        id: 'f1', debateId: 'debate1', argumentId: 'arg1',
        flagCode: 'off_track', ruleCode: null, source: 'client_rules',
        confidence: 0.9, status: 'open', createdAt: '2026-01-01T00:00:00Z',
      };
      expect(mapArgumentToTrackKind(makeArg({ argumentType: 'claim' }), [flag], [])).toBe('tangent');
    });

    it('does not map dismissed off-track flag to tangent', () => {
      const flag: ArgumentFlag = {
        id: 'f1', debateId: 'debate1', argumentId: 'arg1',
        flagCode: 'off_track', ruleCode: null, source: 'client_rules',
        confidence: 0.9, status: 'dismissed', createdAt: '2026-01-01T00:00:00Z',
      };
      expect(mapArgumentToTrackKind(makeArg({ argumentType: 'claim' }), [flag], [])).toBe('core');
    });

    it('maps weak topic check + depth>1 to tangent', () => {
      const check: TopicSatisfactionCheck = {
        id: 'c1', debateId: 'debate1', argumentId: 'arg1',
        method: 'lexical', score: 0.2, threshold: 0.5,
        status: 'weak', matchedTerms: [], missingTerms: [],
        createdAt: '2026-01-01T00:00:00Z',
      };
      expect(mapArgumentToTrackKind(makeArg({ argumentType: 'claim', depth: 2 }), [], [check])).toBe('tangent');
    });
  });

  describe('buildArgumentTimeline', () => {
    it('returns empty array for empty cache', () => {
      const cache = makeCache([]);
      const items = buildArgumentTimeline({ cache });
      expect(items).toHaveLength(0);
    });

    it('assigns core track to root claim', () => {
      const args = [makeArg({ id: 'a1', argumentType: 'claim' })];
      const cache = makeCache(args);
      const items = buildArgumentTimeline({ cache });
      expect(items[0].trackKind).toBe('core');
      expect(items[0].argumentId).toBe('a1');
    });

    it('assigns counter track to rebuttal', () => {
      const args = [
        makeArg({ id: 'a1', argumentType: 'claim' }),
        makeArg({ id: 'a2', argumentType: 'rebuttal', parentId: 'a1', depth: 1 }),
      ];
      const cache = makeCache(args);
      const items = buildArgumentTimeline({ cache });
      const rebuttal = items.find((i) => i.argumentId === 'a2');
      expect(rebuttal?.trackKind).toBe('counter');
    });

    it('assigns receipts track to evidence', () => {
      const args = [
        makeArg({ id: 'a1', argumentType: 'claim' }),
        makeArg({ id: 'a2', argumentType: 'evidence', parentId: 'a1', depth: 1 }),
      ];
      const cache = makeCache(args);
      const items = buildArgumentTimeline({ cache });
      const evidence = items.find((i) => i.argumentId === 'a2');
      expect(evidence?.trackKind).toBe('receipts');
    });

    it('marks branch recommended when off-track + children', () => {
      const args = [
        makeArg({ id: 'a1', argumentType: 'claim' }),
        makeArg({ id: 'a2', argumentType: 'claim', parentId: 'a1', depth: 1 }),
      ];
      const cache = makeCache(args);
      const flag: ArgumentFlag = {
        id: 'f1', debateId: 'debate1', argumentId: 'a1',
        flagCode: 'off_track', ruleCode: null, source: 'client_rules',
        confidence: 0.9, status: 'open', createdAt: '2026-01-01T00:00:00Z',
      };
      cache.flagsByArgumentId['a1'] = [flag];
      const items = buildArgumentTimeline({ cache });
      const a1 = items.find((i) => i.argumentId === 'a1');
      expect(a1?.isBranchRecommended).toBe(true);
    });
  });

  describe('getTimelineLanes', () => {
    it('groups items by track kind', () => {
      const args = [
        makeArg({ id: 'a1', argumentType: 'claim' }),
        makeArg({ id: 'a2', argumentType: 'rebuttal', parentId: 'a1', depth: 1 }),
        makeArg({ id: 'a3', argumentType: 'evidence', parentId: 'a1', depth: 1 }),
      ];
      const cache = makeCache(args);
      const items = buildArgumentTimeline({ cache });
      const lanes = getTimelineLanes(items);
      expect(lanes.core).toHaveLength(1);
      expect(lanes.counter).toHaveLength(1);
      expect(lanes.receipts).toHaveLength(1);
      expect(lanes.tangent).toHaveLength(0);
    });
  });

  describe('getCorePath', () => {
    it('returns only core items', () => {
      const args = [
        makeArg({ id: 'a1', argumentType: 'claim' }),
        makeArg({ id: 'a2', argumentType: 'rebuttal', parentId: 'a1', depth: 1 }),
      ];
      const cache = makeCache(args);
      const items = buildArgumentTimeline({ cache });
      expect(getCorePath(items)).toHaveLength(1);
      expect(getCorePath(items)[0].argumentId).toBe('a1');
    });
  });

  describe('getTangentCandidates', () => {
    it('returns tangent and branch-recommended items', () => {
      const args = [makeArg({ id: 'a1', argumentType: 'claim' })];
      const cache = makeCache(args);
      const flag: ArgumentFlag = {
        id: 'f1', debateId: 'debate1', argumentId: 'a1',
        flagCode: 'off_track', ruleCode: null, source: 'client_rules',
        confidence: 0.9, status: 'open', createdAt: '2026-01-01T00:00:00Z',
      };
      cache.flagsByArgumentId['a1'] = [flag];
      // Add a child so branch is recommended
      const args2 = [
        makeArg({ id: 'a1', argumentType: 'claim' }),
        makeArg({ id: 'a2', argumentType: 'claim', parentId: 'a1', depth: 1 }),
      ];
      const cache2 = makeCache(args2);
      cache2.flagsByArgumentId['a1'] = [flag];
      const items = buildArgumentTimeline({ cache: cache2 });
      const candidates = getTangentCandidates(items);
      expect(candidates.length).toBeGreaterThan(0);
    });
  });

  describe('TRACK_LANE_LABELS', () => {
    it('has a label for each lane kind', () => {
      for (const kind of TRACK_LANE_ORDER) {
        expect(TRACK_LANE_LABELS[kind]).toBeTruthy();
      }
    });
  });

  describe('shouldShowBranchButton', () => {
    it('returns true when off-track flag and depth > 1', () => {
      const arg = makeArg({ depth: 2 });
      const flag: ArgumentFlag = {
        id: 'f1', debateId: 'd1', argumentId: 'arg1',
        flagCode: 'off_track', ruleCode: null, source: 'client_rules',
        confidence: 0.9, status: 'open', createdAt: '2026-01-01T00:00:00Z',
      };
      expect(shouldShowBranchButton(arg, [flag], [])).toBe(true);
    });

    it('returns false at depth 0 even with off-track flag', () => {
      const arg = makeArg({ depth: 0 });
      const flag: ArgumentFlag = {
        id: 'f1', debateId: 'd1', argumentId: 'arg1',
        flagCode: 'off_track', ruleCode: null, source: 'client_rules',
        confidence: 0.9, status: 'open', createdAt: '2026-01-01T00:00:00Z',
      };
      expect(shouldShowBranchButton(arg, [flag], [])).toBe(false);
    });
  });
});
