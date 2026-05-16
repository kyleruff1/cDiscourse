/**
 * Stage 5.4 — normalized argument cache and viewport unit tests.
 * Pure functions only. No network, no Supabase, no React.
 */

import {
  EMPTY_CACHE,
  ROOT_KEY,
  mergeArguments,
  mergeRelations,
  markLoaded,
  isParentLoaded,
  getKnownChildCount,
} from '../src/features/arguments/argumentCache';
import {
  computeVisibleArgumentIds,
  computeFocusedPath,
  MAX_DISPLAY_DEPTH,
} from '../src/features/arguments/buildArgumentTree';
import {
  getArgumentRelationsForDisplay,
  getParentArgumentForComposer,
} from '../src/features/arguments/composerHandoff';
import { viewportReducer, buildInitialViewport } from '../src/features/arguments/argumentViewport';
import type { ArgumentRow, ArgumentRelations } from '../src/features/arguments/types';

// ── Fixtures ──────────────────────────────────────────────────

const DEBATE = 'd-00000000-0000-0000-0000-000000000001';
const USER = 'u-00000000-0000-0000-0000-000000000001';

function arg(
  id: string,
  parentId: string | null,
  depth = 0,
  overrides?: Partial<ArgumentRow>,
): ArgumentRow {
  return {
    id,
    debateId: DEBATE,
    parentId,
    authorId: USER,
    argumentType: 'claim',
    side: 'affirmative',
    body: `Body of ${id}`,
    depth,
    status: 'posted',
    targetExcerpt: null,
    disagreementAxis: null,
    railPayload: {},
    clientValidation: {},
    serverValidation: {},
    clientSubmissionId: null,
    createdAt: `2026-05-16T00:00:0${depth}.000Z`,
    updatedAt: `2026-05-16T00:00:0${depth}.000Z`,
    ...overrides,
  };
}

const RELATIONS_EMPTY: ArgumentRelations = { tags: [], flags: [], checks: [] };

// ── 1. Cache insert and merge ─────────────────────────────────

describe('argumentCache — mergeArguments', () => {
  test('inserts root arguments under ROOT_KEY', () => {
    const root1 = arg('r1', null, 0);
    const root2 = arg('r2', null, 0);
    const cache = mergeArguments(EMPTY_CACHE, [root1, root2]);
    expect(cache.childIdsByParentId[ROOT_KEY]).toEqual(['r1', 'r2']);
    expect(cache.argumentsById['r1']).toEqual(root1);
  });

  test('inserts child arguments under parent key', () => {
    let cache = mergeArguments(EMPTY_CACHE, [arg('r1', null, 0)]);
    cache = mergeArguments(cache, [arg('c1', 'r1', 1), arg('c2', 'r1', 1)]);
    expect(cache.childIdsByParentId['r1']).toEqual(['c1', 'c2']);
  });

  test('deduplicates: same id merged twice does not duplicate in child list', () => {
    const root = arg('r1', null, 0);
    let cache = mergeArguments(EMPTY_CACHE, [root]);
    cache = mergeArguments(cache, [root]);
    expect(cache.childIdsByParentId[ROOT_KEY]).toHaveLength(1);
  });

  test('updates existing row in argumentsById on re-merge', () => {
    const original = arg('r1', null, 0);
    let cache = mergeArguments(EMPTY_CACHE, [original]);
    const updated = { ...original, body: 'Updated body' };
    cache = mergeArguments(cache, [updated]);
    expect(cache.argumentsById['r1'].body).toBe('Updated body');
  });

  test('empty input returns same cache reference', () => {
    const cache = mergeArguments(EMPTY_CACHE, []);
    expect(cache).toBe(EMPTY_CACHE);
  });

  test('post-submit refresh: re-merging roots after a full re-fetch does not duplicate root IDs', () => {
    // Simulate: initial load, then refresh() re-fetches the same roots + new one
    const root1 = arg('r1', null, 0);
    const root2 = arg('r2', null, 0);
    const root3 = arg('r3', null, 0); // newly submitted argument

    let cache = mergeArguments(EMPTY_CACHE, [root1, root2]);
    // Refresh returns all three (server includes the new submission)
    cache = mergeArguments(cache, [root1, root2, root3]);

    const roots = cache.childIdsByParentId[ROOT_KEY] ?? [];
    expect(roots).toHaveLength(3);
    expect(roots).toContain('r1');
    expect(roots).toContain('r2');
    expect(roots).toContain('r3');
    // No duplicates
    expect(new Set(roots).size).toBe(roots.length);
  });
});

// ── 2. Child ordering ─────────────────────────────────────────

describe('argumentCache — child ordering', () => {
  test('children are listed in insertion order (API ordering preserved)', () => {
    const children = ['c3', 'c1', 'c2'].map((id) => arg(id, 'r1', 1));
    const cache = mergeArguments(EMPTY_CACHE, children);
    expect(cache.childIdsByParentId['r1']).toEqual(['c3', 'c1', 'c2']);
  });

  test('appending a new batch preserves prior ordering', () => {
    let cache = mergeArguments(EMPTY_CACHE, [arg('c1', 'r1', 1), arg('c2', 'r1', 1)]);
    cache = mergeArguments(cache, [arg('c3', 'r1', 1)]);
    expect(cache.childIdsByParentId['r1']).toEqual(['c1', 'c2', 'c3']);
  });
});

// ── 3. Missing parent detection ───────────────────────────────

describe('argumentCache — detached argument detection', () => {
  test('argument whose parent is absent is listed in detachedArgumentIds', () => {
    const orphan = arg('c1', 'missing-parent', 1);
    const cache = mergeArguments(EMPTY_CACHE, [orphan]);
    expect(cache.detachedArgumentIds).toContain('c1');
  });

  test('argument whose parent IS present is not detached', () => {
    let cache = mergeArguments(EMPTY_CACHE, [arg('r1', null, 0)]);
    cache = mergeArguments(cache, [arg('c1', 'r1', 1)]);
    expect(cache.detachedArgumentIds).not.toContain('c1');
  });
});

// ── 4. markLoaded / isParentLoaded ────────────────────────────

describe('argumentCache — loadedParentIds', () => {
  test('markLoaded adds key to loadedParentIds', () => {
    const cache = markLoaded(EMPTY_CACHE, ROOT_KEY);
    expect(isParentLoaded(cache, ROOT_KEY)).toBe(true);
  });

  test('unloaded parent returns false', () => {
    expect(isParentLoaded(EMPTY_CACHE, 'any-id')).toBe(false);
  });

  test('markLoaded records loadedAt timestamp', () => {
    const before = Date.now();
    const cache = markLoaded(EMPTY_CACHE, 'p1');
    const after = Date.now();
    const ts = new Date(cache.loadedAtByParentId['p1']).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ── 5. getKnownChildCount ─────────────────────────────────────

describe('argumentCache — getKnownChildCount', () => {
  test('returns null when parent has not been loaded', () => {
    const cache = mergeArguments(EMPTY_CACHE, [arg('r1', null, 0), arg('c1', 'r1', 1)]);
    expect(getKnownChildCount(cache, 'r1')).toBeNull();
  });

  test('returns count after parent is marked loaded', () => {
    let cache = mergeArguments(EMPTY_CACHE, [arg('r1', null, 0), arg('c1', 'r1', 1), arg('c2', 'r1', 1)]);
    cache = markLoaded(cache, 'r1');
    expect(getKnownChildCount(cache, 'r1')).toBe(2);
  });

  test('returns 0 for a loaded parent with no children', () => {
    const cache = markLoaded(EMPTY_CACHE, 'leaf');
    expect(getKnownChildCount(cache, 'leaf')).toBe(0);
  });
});

// ── 6. mergeRelations ─────────────────────────────────────────

describe('argumentCache — mergeRelations', () => {
  test('tags are grouped by argumentId', () => {
    const cache = mergeRelations(EMPTY_CACHE, {
      tags: [
        { argumentId: 'a1', tagCode: 't1', createdAt: '' },
        { argumentId: 'a1', tagCode: 't2', createdAt: '' },
        { argumentId: 'a2', tagCode: 't1', createdAt: '' },
      ],
      flags: [],
      checks: [],
    });
    expect(cache.tagsByArgumentId['a1']).toHaveLength(2);
    expect(cache.tagsByArgumentId['a2']).toHaveLength(1);
  });

  test('duplicate tags (same argumentId + tagCode) are not duplicated', () => {
    const tag = { argumentId: 'a1', tagCode: 't1', createdAt: '' };
    let cache = mergeRelations(EMPTY_CACHE, { tags: [tag], flags: [], checks: [] });
    cache = mergeRelations(cache, { tags: [tag], flags: [], checks: [] });
    expect(cache.tagsByArgumentId['a1']).toHaveLength(1);
  });

  test('empty relations returns same cache reference', () => {
    const cache = mergeRelations(EMPTY_CACHE, RELATIONS_EMPTY);
    expect(cache).toBe(EMPTY_CACHE);
  });
});

// ── 7. computeVisibleArgumentIds ──────────────────────────────

describe('buildArgumentTree — computeVisibleArgumentIds', () => {
  function buildCache() {
    let c = mergeArguments(EMPTY_CACHE, [arg('r1', null, 0), arg('r2', null, 0)]);
    c = mergeArguments(c, [arg('c1', 'r1', 1), arg('c2', 'r1', 1)]);
    c = mergeArguments(c, [arg('g1', 'c1', 2)]);
    return c;
  }

  test('only roots are visible when nothing is expanded', () => {
    const cache = buildCache();
    const ids = computeVisibleArgumentIds(cache, { expandedArgumentIds: [], collapsedArgumentIds: [] });
    expect(ids).toEqual(['r1', 'r2']);
  });

  test('children of an expanded root are visible', () => {
    const cache = buildCache();
    const ids = computeVisibleArgumentIds(cache, { expandedArgumentIds: ['r1'], collapsedArgumentIds: [] });
    expect(ids).toContain('c1');
    expect(ids).toContain('c2');
    expect(ids).not.toContain('g1');
  });

  test('grandchildren visible when both parent and grandparent expanded', () => {
    const cache = buildCache();
    const ids = computeVisibleArgumentIds(cache, {
      expandedArgumentIds: ['r1', 'c1'],
      collapsedArgumentIds: [],
    });
    expect(ids).toContain('g1');
  });

  test('collapsed node hides children even if also in expanded list', () => {
    const cache = buildCache();
    const ids = computeVisibleArgumentIds(cache, {
      expandedArgumentIds: ['r1'],
      collapsedArgumentIds: ['r1'],
    });
    expect(ids).not.toContain('c1');
  });
});

// ── 8. computeFocusedPath ─────────────────────────────────────

describe('buildArgumentTree — computeFocusedPath', () => {
  test('returns empty array for null focused id', () => {
    expect(computeFocusedPath(EMPTY_CACHE, null)).toEqual([]);
  });

  test('returns single item when focused argument is a root', () => {
    const cache = mergeArguments(EMPTY_CACHE, [arg('r1', null, 0)]);
    expect(computeFocusedPath(cache, 'r1')).toEqual(['r1']);
  });

  test('returns full path from root to focused argument', () => {
    let cache = mergeArguments(EMPTY_CACHE, [arg('r1', null, 0)]);
    cache = mergeArguments(cache, [arg('c1', 'r1', 1)]);
    cache = mergeArguments(cache, [arg('g1', 'c1', 2)]);
    expect(computeFocusedPath(cache, 'g1')).toEqual(['r1', 'c1', 'g1']);
  });

  test('stops at missing parent (detached subtree)', () => {
    const cache = mergeArguments(EMPTY_CACHE, [arg('c1', 'missing', 1)]);
    expect(computeFocusedPath(cache, 'c1')).toEqual(['c1']);
  });
});

// ── 9. Deep nesting guard ─────────────────────────────────────

describe('buildArgumentTree — deep nesting guard', () => {
  test(`nodes beyond MAX_DISPLAY_DEPTH (${MAX_DISPLAY_DEPTH}) are not rendered`, () => {
    let cache = EMPTY_CACHE;
    let parentId: string | null = null;
    const ids: string[] = [];
    for (let i = 0; i <= MAX_DISPLAY_DEPTH + 2; i++) {
      const id = `n${i}`;
      ids.push(id);
      cache = mergeArguments(cache, [arg(id, parentId, i)]);
      parentId = id;
    }
    const expanded = ids.map((id) => id);
    const visible = computeVisibleArgumentIds(cache, { expandedArgumentIds: expanded, collapsedArgumentIds: [] });
    // All nodes at depth 0..MAX_DISPLAY_DEPTH are visible; deeper ones are not.
    const visibleDepths = visible.map((id) => cache.argumentsById[id].depth);
    expect(Math.max(...visibleDepths)).toBeLessThanOrEqual(MAX_DISPLAY_DEPTH);
  });
});

// ── 10. Viewport persistence action (reducer integration) ─────

describe('session reducer — VIEWPORT_UPDATED preserves draft', () => {
  const { sessionReducer } = require('../src/features/session/sessionState');
  const DEBATE_ID = 'd-00000001';
  const USER_ID = 'u-00000001';

  test('VIEWPORT_UPDATED does not affect activeDraft', () => {
    const withDraft = sessionReducer(
      { status: 'composing', snapshot: { userId: USER_ID, selectedDebateId: DEBATE_ID, participantSide: 'affirmative', viewport: null, activeDraft: { draftId: 'dr1', debateId: DEBATE_ID, parentId: null, argumentType: 'claim', side: 'affirmative', body: 'important draft', selectedTagCodes: [], targetExcerpt: null, disagreementAxis: null, attachedEvidence: [], updatedAt: '', dirty: true }, pendingSubmission: null, lastSyncAt: null } },
      {
        type: 'VIEWPORT_UPDATED',
        viewport: {
          debateId: DEBATE_ID, focusedArgumentId: 'a1', selectedParentId: null, rootCursor: null,
          expandedArgumentIds: ['a1'], collapsedArgumentIds: [], lastLoadedAt: null, lastSeenArgumentId: 'a1',
        },
      },
    );
    expect(withDraft.snapshot.activeDraft?.body).toBe('important draft');
    expect(withDraft.snapshot.activeDraft?.dirty).toBe(true);
    expect(withDraft.snapshot.viewport?.focusedArgumentId).toBe('a1');
  });
});

// ── 11. getArgumentRelationsForDisplay ────────────────────────

describe('composerHandoff — getArgumentRelationsForDisplay', () => {
  test('returns empty relations for unknown argument', () => {
    const rel = getArgumentRelationsForDisplay(EMPTY_CACHE, 'unknown-id');
    expect(rel.tags).toEqual([]);
    expect(rel.flags).toEqual([]);
    expect(rel.checks).toEqual([]);
  });

  test('returns cached relations for a known argument', () => {
    const tag = { argumentId: 'a1', tagCode: 'claim', createdAt: '' };
    const cache = mergeRelations(EMPTY_CACHE, { tags: [tag], flags: [], checks: [] });
    const rel = getArgumentRelationsForDisplay(cache, 'a1');
    expect(rel.tags).toHaveLength(1);
    expect(rel.tags[0].tagCode).toBe('claim');
  });
});

// ── 12. getParentArgumentForComposer ──────────────────────────

describe('composerHandoff — getParentArgumentForComposer', () => {
  const BASE_VIEWPORT = buildInitialViewport(DEBATE, null, 25);

  test('returns null when selectedParentId is null', () => {
    expect(getParentArgumentForComposer(EMPTY_CACHE, BASE_VIEWPORT)).toBeNull();
  });

  test('returns null when selectedParentId is not in cache', () => {
    const viewport = { ...BASE_VIEWPORT, selectedParentId: 'missing' };
    expect(getParentArgumentForComposer(EMPTY_CACHE, viewport)).toBeNull();
  });

  test('returns the argument when selectedParentId is in cache', () => {
    const cache = mergeArguments(EMPTY_CACHE, [arg('r1', null, 0)]);
    const viewport = { ...BASE_VIEWPORT, selectedParentId: 'r1' };
    const result = getParentArgumentForComposer(cache, viewport);
    expect(result?.id).toBe('r1');
  });
});

// ── 13. SELECT_PARENT / CLEAR_PARENT reducer actions ─────────

describe('argumentViewport — SELECT_PARENT / CLEAR_PARENT', () => {
  const BASE_VIEWPORT = buildInitialViewport(DEBATE, null, 25);
  const INITIAL_STATE = { cache: EMPTY_CACHE, viewport: BASE_VIEWPORT };

  test('SELECT_PARENT sets selectedParentId', () => {
    const state = viewportReducer(INITIAL_STATE, { type: 'SELECT_PARENT', argumentId: 'r1' });
    expect(state.viewport.selectedParentId).toBe('r1');
  });

  test('CLEAR_PARENT resets selectedParentId to null', () => {
    let state = viewportReducer(INITIAL_STATE, { type: 'SELECT_PARENT', argumentId: 'r1' });
    state = viewportReducer(state, { type: 'CLEAR_PARENT' });
    expect(state.viewport.selectedParentId).toBeNull();
  });
});

// ── 14. Switching debates clears viewport ─────────────────────

describe('argumentViewport — switching debates', () => {
  test('buildInitialViewport returns fresh state when debateId does not match session', () => {
    const sessionViewport = {
      debateId: 'debate-A',
      focusedArgumentId: 'a1',
      selectedParentId: null,
      rootCursor: null,
      expandedArgumentIds: ['a1'],
      collapsedArgumentIds: [],
      lastLoadedAt: null,
      lastSeenArgumentId: 'a1',
    };
    const vp = buildInitialViewport('debate-B', sessionViewport, 25);
    expect(vp.focusedArgumentId).toBeNull();
    expect(vp.expandedArgumentIds).toEqual([]);
    expect(vp.debateId).toBe('debate-B');
  });

  test('buildInitialViewport restores session state when debateId matches', () => {
    const sessionViewport = {
      debateId: 'debate-A',
      focusedArgumentId: 'a1',
      selectedParentId: null,
      rootCursor: null,
      expandedArgumentIds: ['a1', 'a2'],
      collapsedArgumentIds: ['a3'],
      lastLoadedAt: null,
      lastSeenArgumentId: 'a1',
    };
    const vp = buildInitialViewport('debate-A', sessionViewport, 25);
    expect(vp.focusedArgumentId).toBe('a1');
    expect(vp.expandedArgumentIds).toEqual(['a1', 'a2']);
    expect(vp.collapsedArgumentIds).toEqual(['a3']);
  });
});
