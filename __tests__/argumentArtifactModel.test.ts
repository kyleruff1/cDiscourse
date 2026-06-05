/**
 * ADMIN-ARGS-CANONICAL-001 — argumentArtifactModel unit tests.
 *
 * Pure-model coverage: each grouping-key precedence path; updateCount /
 * duplicateRunCount / latest-activity; determinism (N=10 JSON-equal);
 * empty / single / mixed inputs; the `deriveRevisionIsInactive` truth table;
 * sort + filter helpers. No React, no Supabase, no fetch.
 */
import {
  groupArgumentsIntoArtifacts,
  sortArtifactsByLatestActivity,
  filterArtifactsByQuery,
  deriveRevisionIsInactive,
  cleanArtifactTitleForDedupe,
  type ArtifactSourceRow,
} from '../src/features/arguments/argumentArtifactModel';

function row(overrides: Partial<ArtifactSourceRow> = {}): ArtifactSourceRow {
  const base: ArtifactSourceRow = {
    id: 'a1',
    debateId: 'd1',
    debateTitle: 'Bike lanes are better curb space',
    authorId: 'u1',
    body: 'Bike lanes improve safety for everyone on the road.',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    inactiveAt: null,
  };
  return { ...base, ...overrides };
}

describe('deriveRevisionIsInactive — truth table', () => {
  it('null inactiveAt ⇒ active (false)', () => {
    expect(deriveRevisionIsInactive({ inactiveAt: null })).toBe(false);
  });
  it('undefined / absent inactiveAt ⇒ active (false)', () => {
    expect(deriveRevisionIsInactive({})).toBe(false);
    expect(deriveRevisionIsInactive({ inactiveAt: undefined })).toBe(false);
  });
  it('non-null inactiveAt timestamp ⇒ inactive (true)', () => {
    expect(deriveRevisionIsInactive({ inactiveAt: '2026-06-04T00:00:00Z' })).toBe(true);
  });
});

describe('groupArgumentsIntoArtifacts — empty / single', () => {
  it('returns [] for empty input', () => {
    expect(groupArgumentsIntoArtifacts([])).toEqual([]);
  });
  it('returns [] for non-array input', () => {
    expect(groupArgumentsIntoArtifacts(null as unknown as ArtifactSourceRow[])).toEqual([]);
  });
  it('single row → one artifact, zero updates, one revision', () => {
    const out = groupArgumentsIntoArtifacts([row()]);
    expect(out).toHaveLength(1);
    expect(out[0].updateCount).toBe(0);
    expect(out[0].duplicateRunCount).toBe(0);
    expect(out[0].revisions).toHaveLength(1);
    expect(out[0].latestBody).toBe('Bike lanes improve safety for everyone on the road.');
    expect(out[0].isInactive).toBe(false);
  });
});

describe('grouping key (1) — same id, updatedAt !== createdAt folds as updates', () => {
  it('two rows with same id but different updatedAt fold into one artifact', () => {
    const r1 = row({ id: 'arg-x', createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-02T00:00:00Z', body: 'v2' });
    const r2 = row({ id: 'arg-x', createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-03T00:00:00Z', body: 'v3' });
    const out = groupArgumentsIntoArtifacts([r1, r2]);
    expect(out).toHaveLength(1);
    expect(out[0].artifactId).toBe('id:arg-x');
    expect(out[0].updateCount).toBe(1);
    // latest by updatedAt is v3.
    expect(out[0].latestBody).toBe('v3');
    expect(out[0].latestUpdatedAt).toBe('2026-06-03T00:00:00Z');
    // createdAt is the min across revisions.
    expect(out[0].createdAt).toBe('2026-06-01T00:00:00Z');
  });
});

describe('grouping key (2) — title-suffix-stripped lineage folds corpus siblings', () => {
  it('two unedited rows under suffix-tagged sibling titles + same body fold together', () => {
    const r1 = row({
      id: 'a', debateId: 'd1', body: 'Same claim text here for the corpus body excerpt.',
      debateTitle: 'Pitch clock changed pacing [xai-adv 9018694f c45188c5]',
      createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
    });
    const r2 = row({
      id: 'b', debateId: 'd2', body: 'Same claim text here for the corpus body excerpt.',
      debateTitle: 'Pitch clock changed pacing [ai-corpus fa172432 ai-seed]',
      createdAt: '2026-06-01T00:05:00Z', updatedAt: '2026-06-01T00:05:00Z',
    });
    const out = groupArgumentsIntoArtifacts([r1, r2]);
    expect(out).toHaveLength(1);
    expect(out[0].artifactId.startsWith('title:pitch clock changed pacing')).toBe(true);
    expect(out[0].duplicateRunCount).toBe(1);
  });

  it('different cleaned titles do NOT fold', () => {
    const r1 = row({ id: 'a', debateTitle: 'Topic one [stress-2026]', updatedAt: '2026-06-01T00:00:00Z', createdAt: '2026-06-01T00:00:00Z' });
    const r2 = row({ id: 'b', debateTitle: 'Topic two [stress-2026]', updatedAt: '2026-06-01T00:00:00Z', createdAt: '2026-06-01T00:00:00Z' });
    const out = groupArgumentsIntoArtifacts([r1, r2]);
    expect(out).toHaveLength(2);
  });
});

describe('grouping key (3) — fallback debateId + body excerpt when no title', () => {
  it('untitled unedited rows fold by debateId + body excerpt', () => {
    const r1 = row({ id: 'a', debateId: 'room-9', debateTitle: null, body: 'Identical fallback body content.', updatedAt: '2026-06-01T00:00:00Z', createdAt: '2026-06-01T00:00:00Z' });
    const r2 = row({ id: 'b', debateId: 'room-9', debateTitle: null, body: 'Identical fallback body content.', updatedAt: '2026-06-01T00:01:00Z', createdAt: '2026-06-01T00:01:00Z' });
    const out = groupArgumentsIntoArtifacts([r1, r2]);
    expect(out).toHaveLength(1);
    expect(out[0].artifactId.startsWith('room:room-9::body:')).toBe(true);
  });
});

describe('mixed inputs — distinct logical arguments stay distinct', () => {
  it('three unrelated rows produce three artifacts', () => {
    const out = groupArgumentsIntoArtifacts([
      row({ id: 'a', debateTitle: 'Alpha', body: 'Alpha body excerpt one', updatedAt: '2026-06-01T00:00:00Z', createdAt: '2026-06-01T00:00:00Z' }),
      row({ id: 'b', debateTitle: 'Beta', body: 'Beta body excerpt two', updatedAt: '2026-06-02T00:00:00Z', createdAt: '2026-06-02T00:00:00Z' }),
      row({ id: 'c', debateTitle: 'Gamma', body: 'Gamma body excerpt three', updatedAt: '2026-06-03T00:00:00Z', createdAt: '2026-06-03T00:00:00Z' }),
    ]);
    expect(out).toHaveLength(3);
  });
});

describe('observationCount — sourced verbatim, never fabricated', () => {
  it('renders {0,0} when the source row carries no coverage', () => {
    const out = groupArgumentsIntoArtifacts([row()]);
    expect(out[0].observationCount).toEqual({ covered: 0, total: 0 });
  });
  it('carries the real coverage when present on the latest revision', () => {
    const out = groupArgumentsIntoArtifacts([
      row({ observationCoverage: { covered: 5, total: 7 } }),
    ]);
    expect(out[0].observationCount).toEqual({ covered: 5, total: 7 });
  });
});

describe('qualifiers — union of tag codes, structural, de-duplicated', () => {
  it('folds and de-dups selectedTagCodes across revisions', () => {
    const r1 = row({ id: 'arg-q', updatedAt: '2026-06-01T12:00:00Z', createdAt: '2026-06-01T00:00:00Z', selectedTagCodes: ['quote_anchors_parent', 'introduces_new_issue'] });
    const r2 = row({ id: 'arg-q', updatedAt: '2026-06-02T00:00:00Z', createdAt: '2026-06-01T00:00:00Z', selectedTagCodes: ['introduces_new_issue', 'scope_narrowing'] });
    const out = groupArgumentsIntoArtifacts([r1, r2]);
    expect(out[0].qualifiers).toEqual(['quote_anchors_parent', 'introduces_new_issue', 'scope_narrowing']);
  });
});

describe('isInactive OR-fold — no-resurrect at the artifact level', () => {
  it('an inactive revision makes the artifact inactive even with an active sibling revision', () => {
    const r1 = row({ id: 'arg-i', updatedAt: '2026-06-01T12:00:00Z', createdAt: '2026-06-01T00:00:00Z', inactiveAt: '2026-06-05T00:00:00Z' });
    const r2 = row({ id: 'arg-i', updatedAt: '2026-06-02T00:00:00Z', createdAt: '2026-06-01T00:00:00Z', inactiveAt: null });
    const out = groupArgumentsIntoArtifacts([r1, r2]);
    expect(out[0].isInactive).toBe(true);
    // The inactive child keeps its own state — never cleared by the active sibling.
    const inactiveRev = out[0].revisions.find((rv) => rv.revisionId === 'arg-i' && rv.isInactive);
    expect(inactiveRev).toBeDefined();
    const activeRev = out[0].revisions.find((rv) => !rv.isInactive);
    expect(activeRev).toBeDefined();
  });
});

describe('determinism — same input ⇒ JSON-equal output over N=10', () => {
  it('produces byte-identical JSON across 10 runs', () => {
    const input = [
      row({ id: 'a', debateTitle: 'Alpha [stress-1]', body: 'shared body excerpt', updatedAt: '2026-06-01T00:00:00Z', createdAt: '2026-06-01T00:00:00Z' }),
      row({ id: 'a', debateTitle: 'Alpha [stress-1]', body: 'shared body v2', updatedAt: '2026-06-02T00:00:00Z', createdAt: '2026-06-01T00:00:00Z' }),
      row({ id: 'c', debateTitle: 'Beta', body: 'beta body excerpt', updatedAt: '2026-06-03T00:00:00Z', createdAt: '2026-06-03T00:00:00Z' }),
    ];
    const first = JSON.stringify(groupArgumentsIntoArtifacts(input));
    for (let i = 0; i < 10; i++) {
      expect(JSON.stringify(groupArgumentsIntoArtifacts(input))).toBe(first);
    }
  });
});

describe('sortArtifactsByLatestActivity', () => {
  it('desc puts most recent activity first; asc reverses', () => {
    const arts = groupArgumentsIntoArtifacts([
      row({ id: 'a', debateTitle: 'A', body: 'a body', updatedAt: '2026-06-01T00:00:00Z', createdAt: '2026-06-01T00:00:00Z' }),
      row({ id: 'b', debateTitle: 'B', body: 'b body', updatedAt: '2026-06-03T00:00:00Z', createdAt: '2026-06-03T00:00:00Z' }),
      row({ id: 'c', debateTitle: 'C', body: 'c body', updatedAt: '2026-06-02T00:00:00Z', createdAt: '2026-06-02T00:00:00Z' }),
    ]);
    const desc = sortArtifactsByLatestActivity(arts, 'desc').map((a) => a.latestUpdatedAt);
    expect(desc).toEqual(['2026-06-03T00:00:00Z', '2026-06-02T00:00:00Z', '2026-06-01T00:00:00Z']);
    const asc = sortArtifactsByLatestActivity(arts, 'asc').map((a) => a.latestUpdatedAt);
    expect(asc).toEqual(['2026-06-01T00:00:00Z', '2026-06-02T00:00:00Z', '2026-06-03T00:00:00Z']);
  });
  it('does not mutate the input array', () => {
    const arts = groupArgumentsIntoArtifacts([row()]);
    const before = arts.slice();
    sortArtifactsByLatestActivity(arts);
    expect(arts).toEqual(before);
  });
});

describe('filterArtifactsByQuery', () => {
  it('empty query returns all (copy, not the same reference)', () => {
    const arts = groupArgumentsIntoArtifacts([row()]);
    const out = filterArtifactsByQuery(arts, '   ');
    expect(out).toHaveLength(1);
    expect(out).not.toBe(arts);
  });
  it('matches on latest body, title, and qualifier code', () => {
    const arts = groupArgumentsIntoArtifacts([
      row({ id: 'a', debateTitle: 'Climate room', body: 'carbon tax claim', selectedTagCodes: ['scope_narrowing'], updatedAt: '2026-06-01T00:00:00Z', createdAt: '2026-06-01T00:00:00Z' }),
      row({ id: 'b', debateTitle: 'Sports room', body: 'pitch clock claim', updatedAt: '2026-06-02T00:00:00Z', createdAt: '2026-06-02T00:00:00Z' }),
    ]);
    expect(filterArtifactsByQuery(arts, 'carbon')).toHaveLength(1);
    expect(filterArtifactsByQuery(arts, 'sports')).toHaveLength(1);
    expect(filterArtifactsByQuery(arts, 'scope_narrowing')).toHaveLength(1);
    expect(filterArtifactsByQuery(arts, 'nonexistent-needle')).toHaveLength(0);
  });
});

describe('cleanArtifactTitleForDedupe — mirrors gallery dedupe', () => {
  it('strips the corpus suffix tags', () => {
    expect(cleanArtifactTitleForDedupe('Bike lanes [xai-adv 9018694f c45188c5]')).toBe('Bike lanes');
    expect(cleanArtifactTitleForDedupe('Pacing [ai-corpus fa172432 ai-seed]')).toBe('Pacing');
    expect(cleanArtifactTitleForDedupe('Sports [stress-2026-05-17 #scenario-7]')).toBe('Sports');
  });
  it('null / empty title ⇒ empty string', () => {
    expect(cleanArtifactTitleForDedupe(null)).toBe('');
    expect(cleanArtifactTitleForDedupe('')).toBe('');
  });
});
