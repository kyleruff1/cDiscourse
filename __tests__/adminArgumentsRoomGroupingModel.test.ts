/**
 * #508 — adminArgumentsRoomGroupingModel pure-model coverage.
 *
 * Covers: empty input → []; single room many artifacts → one group with
 * correct messageCount + latestUpdatedAt + min createdAt + excerpt; multiple
 * rooms → multiple groups sorted by latest activity; room title cleaned of the
 * corpus suffix; `isInactive` true ONLY when ALL artifacts inactive;
 * determinism (two calls JSON-equal); direction asc vs desc; input not
 * mutated; doctrine ban-list (no verdict tokens produced by the model itself).
 */
import {
  groupArtifactsByRoom,
  type AdminArgumentRoomGroup,
} from '../src/features/admin/adminArgumentsRoomGroupingModel';
import type { ArgumentArtifact } from '../src/features/arguments/argumentArtifactModel';

// ── Fixture builder ────────────────────────────────────────────────────────

function makeArtifact(over: Partial<ArgumentArtifact> & {
  artifactId: string;
  debateId: string;
}): ArgumentArtifact {
  const createdAt = over.createdAt ?? '2026-01-01T00:00:00.000Z';
  const latestUpdatedAt = over.latestUpdatedAt ?? createdAt;
  return {
    artifactId: over.artifactId,
    latestBody: over.latestBody ?? 'body text',
    authorId: over.authorId ?? 'author-1',
    debateId: over.debateId,
    debateTitle: over.debateTitle ?? null,
    debateInactiveAt: over.debateInactiveAt ?? null,
    latestUpdatedAt,
    createdAt,
    updateCount: over.updateCount ?? 0,
    observationCount: over.observationCount ?? { covered: 0, total: 0 },
    duplicateRunCount: over.duplicateRunCount ?? 0,
    qualifiers: over.qualifiers ?? [],
    isInactive: over.isInactive ?? false,
    revisions: over.revisions ?? [
      {
        revisionId: over.artifactId,
        body: over.latestBody ?? 'body text',
        updatedAt: latestUpdatedAt,
        createdAt,
        isInactive: over.isInactive ?? false,
      },
    ],
  };
}

describe('groupArtifactsByRoom — empty + degenerate input', () => {
  it('returns [] for an empty array', () => {
    expect(groupArtifactsByRoom([])).toEqual([]);
  });

  it('returns [] for a non-array input (defensive)', () => {
    expect(groupArtifactsByRoom(null as unknown as ArgumentArtifact[])).toEqual([]);
    expect(groupArtifactsByRoom(undefined as unknown as ArgumentArtifact[])).toEqual([]);
  });

  it('skips artifacts with a non-string debateId', () => {
    const bad = makeArtifact({ artifactId: 'a1', debateId: 'room-1' });
    // Force an invalid debateId at runtime.
    (bad as unknown as { debateId: unknown }).debateId = 42;
    expect(groupArtifactsByRoom([bad])).toEqual([]);
  });
});

describe('groupArtifactsByRoom — single room, many artifacts', () => {
  const artifacts = [
    makeArtifact({
      artifactId: 'id:a1',
      debateId: 'room-1',
      debateTitle: 'Should cars be banned downtown?',
      latestBody: 'First message — the oldest update.',
      createdAt: '2026-02-01T10:00:00.000Z',
      latestUpdatedAt: '2026-02-01T10:00:00.000Z',
    }),
    makeArtifact({
      artifactId: 'id:a2',
      debateId: 'room-1',
      debateTitle: 'Should cars be banned downtown?',
      latestBody: 'Newest message — the freshest activity in the room.',
      createdAt: '2026-02-02T09:00:00.000Z',
      latestUpdatedAt: '2026-02-05T12:30:00.000Z',
    }),
    makeArtifact({
      artifactId: 'id:a3',
      debateId: 'room-1',
      debateTitle: 'Should cars be banned downtown?',
      latestBody: 'Middle message.',
      createdAt: '2026-02-01T08:00:00.000Z',
      latestUpdatedAt: '2026-02-03T11:00:00.000Z',
    }),
  ];

  it('collapses to exactly one group', () => {
    const groups = groupArtifactsByRoom(artifacts);
    expect(groups).toHaveLength(1);
    expect(groups[0].roomId).toBe('room-1');
  });

  it('reports the correct messageCount (one per logical argument)', () => {
    expect(groupArtifactsByRoom(artifacts)[0].messageCount).toBe(3);
  });

  it('latestUpdatedAt = max across the group', () => {
    expect(groupArtifactsByRoom(artifacts)[0].latestUpdatedAt).toBe('2026-02-05T12:30:00.000Z');
  });

  it('createdAt = min across the group', () => {
    expect(groupArtifactsByRoom(artifacts)[0].createdAt).toBe('2026-02-01T08:00:00.000Z');
  });

  it('latestBodyExcerpt comes from the most-recently-updated artifact', () => {
    const g = groupArtifactsByRoom(artifacts)[0];
    expect(g.latestBodyExcerpt).toBe('Newest message — the freshest activity in the room.');
  });

  it('sorts artifacts within the group newest-activity-first (desc default)', () => {
    const ids = groupArtifactsByRoom(artifacts)[0].artifacts.map((a) => a.artifactId);
    expect(ids).toEqual(['id:a2', 'id:a3', 'id:a1']);
  });
});

describe('groupArtifactsByRoom — multiple rooms sorted by latest activity', () => {
  const artifacts = [
    makeArtifact({
      artifactId: 'id:older',
      debateId: 'room-old',
      debateTitle: 'Quiet room',
      latestUpdatedAt: '2026-01-10T00:00:00.000Z',
    }),
    makeArtifact({
      artifactId: 'id:newest',
      debateId: 'room-active',
      debateTitle: 'Active room',
      latestUpdatedAt: '2026-03-01T00:00:00.000Z',
    }),
    makeArtifact({
      artifactId: 'id:mid',
      debateId: 'room-mid',
      debateTitle: 'Middle room',
      latestUpdatedAt: '2026-02-01T00:00:00.000Z',
    }),
  ];

  it('produces one group per distinct room', () => {
    expect(groupArtifactsByRoom(artifacts)).toHaveLength(3);
  });

  it('orders rooms by latest activity, most-recent first (desc default)', () => {
    const order = groupArtifactsByRoom(artifacts).map((g) => g.roomId);
    expect(order).toEqual(['room-active', 'room-mid', 'room-old']);
  });
});

describe('groupArtifactsByRoom — room title cleaned of corpus suffix', () => {
  it('strips a [xai-adv …] / [stress …] suffix from the header title', () => {
    const artifacts = [
      makeArtifact({
        artifactId: 'id:a1',
        debateId: 'room-1',
        debateTitle: 'Carbon tax debate [xai-adv 2026-05-25 seed-7]',
      }),
    ];
    expect(groupArtifactsByRoom(artifacts)[0].roomTitle).toBe('Carbon tax debate');
  });

  it('uses the first non-null title in input order, then cleans it', () => {
    const artifacts = [
      makeArtifact({ artifactId: 'id:a1', debateId: 'room-1', debateTitle: null }),
      makeArtifact({
        artifactId: 'id:a2',
        debateId: 'room-1',
        debateTitle: 'Real title [stress run-3]',
        latestUpdatedAt: '2026-04-01T00:00:00.000Z',
      }),
    ];
    expect(groupArtifactsByRoom(artifacts)[0].roomTitle).toBe('Real title');
  });

  it('returns null roomTitle when no artifact carries a non-empty cleaned title', () => {
    const artifacts = [
      makeArtifact({ artifactId: 'id:a1', debateId: 'room-1', debateTitle: null }),
      makeArtifact({ artifactId: 'id:a2', debateId: 'room-1', debateTitle: '   ' }),
    ];
    expect(groupArtifactsByRoom(artifacts)[0].roomTitle).toBeNull();
  });
});

describe('groupArtifactsByRoom — isInactive AND-fold', () => {
  it('is true ONLY when every artifact in the room is inactive', () => {
    const allInactive = [
      makeArtifact({ artifactId: 'id:a1', debateId: 'room-1', isInactive: true }),
      makeArtifact({ artifactId: 'id:a2', debateId: 'room-1', isInactive: true }),
    ];
    expect(groupArtifactsByRoom(allInactive)[0].isInactive).toBe(true);
  });

  it('is false when at least one artifact is still active', () => {
    const mixed = [
      makeArtifact({ artifactId: 'id:a1', debateId: 'room-1', isInactive: true }),
      makeArtifact({ artifactId: 'id:a2', debateId: 'room-1', isInactive: false }),
    ];
    expect(groupArtifactsByRoom(mixed)[0].isInactive).toBe(false);
  });

  it('is false for an all-active room', () => {
    const allActive = [
      makeArtifact({ artifactId: 'id:a1', debateId: 'room-1', isInactive: false }),
    ];
    expect(groupArtifactsByRoom(allActive)[0].isInactive).toBe(false);
  });
});

describe('groupArtifactsByRoom — direction', () => {
  const artifacts = [
    makeArtifact({ artifactId: 'id:a1', debateId: 'room-a', latestUpdatedAt: '2026-01-01T00:00:00.000Z' }),
    makeArtifact({ artifactId: 'id:b1', debateId: 'room-b', latestUpdatedAt: '2026-02-01T00:00:00.000Z' }),
    makeArtifact({ artifactId: 'id:c1', debateId: 'room-c', latestUpdatedAt: '2026-03-01T00:00:00.000Z' }),
  ];

  it('desc (default) puts the most recently active room first', () => {
    expect(groupArtifactsByRoom(artifacts, 'desc').map((g) => g.roomId)).toEqual(['room-c', 'room-b', 'room-a']);
  });

  it('asc puts the oldest room first', () => {
    expect(groupArtifactsByRoom(artifacts, 'asc').map((g) => g.roomId)).toEqual(['room-a', 'room-b', 'room-c']);
  });

  it('asc reverses the within-group artifact order too', () => {
    const sameRoom = [
      makeArtifact({ artifactId: 'id:a1', debateId: 'room-1', latestUpdatedAt: '2026-01-01T00:00:00.000Z' }),
      makeArtifact({ artifactId: 'id:a2', debateId: 'room-1', latestUpdatedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    expect(groupArtifactsByRoom(sameRoom, 'asc')[0].artifacts.map((a) => a.artifactId)).toEqual(['id:a1', 'id:a2']);
    expect(groupArtifactsByRoom(sameRoom, 'desc')[0].artifacts.map((a) => a.artifactId)).toEqual(['id:a2', 'id:a1']);
  });
});

describe('groupArtifactsByRoom — determinism + non-mutation', () => {
  const artifacts = [
    makeArtifact({ artifactId: 'id:a1', debateId: 'room-1', debateTitle: 'T', latestUpdatedAt: '2026-02-05T00:00:00.000Z' }),
    makeArtifact({ artifactId: 'id:a2', debateId: 'room-1', debateTitle: 'T', latestUpdatedAt: '2026-02-01T00:00:00.000Z' }),
    makeArtifact({ artifactId: 'id:b1', debateId: 'room-2', debateTitle: 'U', latestUpdatedAt: '2026-03-01T00:00:00.000Z' }),
  ];

  it('two calls on the same input produce JSON-equal output', () => {
    const first = JSON.stringify(groupArtifactsByRoom(artifacts));
    const second = JSON.stringify(groupArtifactsByRoom(artifacts));
    expect(first).toEqual(second);
  });

  it('does not mutate the input array or its order', () => {
    const snapshot = artifacts.map((a) => a.artifactId);
    groupArtifactsByRoom(artifacts);
    expect(artifacts.map((a) => a.artifactId)).toEqual(snapshot);
  });

  it('does not mutate the artifact objects', () => {
    const before = JSON.stringify(artifacts);
    groupArtifactsByRoom(artifacts);
    expect(JSON.stringify(artifacts)).toEqual(before);
  });
});

describe('groupArtifactsByRoom — excerpt clamping', () => {
  it('clamps a long body to ≤140 chars with an ellipsis and a single line', () => {
    const long = 'word '.repeat(80) + 'END';
    const g = groupArtifactsByRoom([
      makeArtifact({ artifactId: 'id:a1', debateId: 'room-1', latestBody: long }),
    ])[0];
    expect(g.latestBodyExcerpt.length).toBeLessThanOrEqual(140);
    expect(g.latestBodyExcerpt.endsWith('…')).toBe(true);
    expect(g.latestBodyExcerpt).not.toContain('\n');
  });

  it('collapses internal whitespace/newlines to single spaces', () => {
    const g = groupArtifactsByRoom([
      makeArtifact({ artifactId: 'id:a1', debateId: 'room-1', latestBody: 'line one\n\n  line   two' }),
    ])[0];
    expect(g.latestBodyExcerpt).toBe('line one line two');
  });
});

describe('ADMIN-CONV-INACTIVE-001 — debateInactiveAt + isDebateInactive (DEBATE-level)', () => {
  it('isDebateInactive is false when no artifact carries a debateInactiveAt', () => {
    const g = groupArtifactsByRoom([
      makeArtifact({ artifactId: 'id:a1', debateId: 'room-1' }),
      makeArtifact({ artifactId: 'id:a2', debateId: 'room-1' }),
    ])[0];
    expect(g.debateInactiveAt).toBeNull();
    expect(g.isDebateInactive).toBe(false);
  });

  it('isDebateInactive is true when an artifact carries a debateInactiveAt; surfaces the timestamp', () => {
    const g = groupArtifactsByRoom([
      makeArtifact({
        artifactId: 'id:a1',
        debateId: 'room-1',
        debateInactiveAt: '2026-06-05T00:00:00.000Z',
      }),
      makeArtifact({
        artifactId: 'id:a2',
        debateId: 'room-1',
        debateInactiveAt: '2026-06-05T00:00:00.000Z',
      }),
    ])[0];
    expect(g.debateInactiveAt).toBe('2026-06-05T00:00:00.000Z');
    expect(g.isDebateInactive).toBe(true);
  });

  it('surfaces the first non-null debateInactiveAt in input order (stable across direction)', () => {
    const artifacts = [
      makeArtifact({ artifactId: 'id:a1', debateId: 'room-1', debateInactiveAt: null }),
      makeArtifact({ artifactId: 'id:a2', debateId: 'room-1', debateInactiveAt: '2026-06-05T00:00:00.000Z' }),
    ];
    expect(groupArtifactsByRoom(artifacts, 'desc')[0].debateInactiveAt).toBe('2026-06-05T00:00:00.000Z');
    expect(groupArtifactsByRoom(artifacts, 'asc')[0].debateInactiveAt).toBe('2026-06-05T00:00:00.000Z');
  });

  it('is INDEPENDENT of the per-statement isInactive fold (a room can be debate-inactive while statements are active)', () => {
    const g = groupArtifactsByRoom([
      makeArtifact({
        artifactId: 'id:a1',
        debateId: 'room-1',
        isInactive: false,                       // per-statement: active
        debateInactiveAt: '2026-06-05T00:00:00.000Z', // DEBATE-level: inactive
      }),
    ])[0];
    expect(g.isInactive).toBe(false);        // per-statement fold unchanged
    expect(g.isDebateInactive).toBe(true);   // whole-conversation state
  });

  it('NEVER produces an inactiveReason field on the group (§10a)', () => {
    const g = groupArtifactsByRoom([
      makeArtifact({ artifactId: 'id:a1', debateId: 'room-1', debateInactiveAt: '2026-06-05T00:00:00.000Z' }),
    ])[0];
    expect(Object.prototype.hasOwnProperty.call(g, 'inactiveReason')).toBe(false);
    expect(JSON.stringify(g)).not.toContain('inactiveReason');
    expect(JSON.stringify(g)).not.toContain('inactive_reason');
  });

  it('is deterministic for the debate-level fields (two calls JSON-equal)', () => {
    const artifacts = [
      makeArtifact({ artifactId: 'id:a1', debateId: 'room-1', debateInactiveAt: '2026-06-05T00:00:00.000Z' }),
      makeArtifact({ artifactId: 'id:b1', debateId: 'room-2', debateInactiveAt: null }),
    ];
    const first = groupArtifactsByRoom(artifacts).map((g) => `${g.roomId}:${g.debateInactiveAt}:${g.isDebateInactive}`);
    const second = groupArtifactsByRoom(artifacts).map((g) => `${g.roomId}:${g.debateInactiveAt}:${g.isDebateInactive}`);
    expect(first).toEqual(second);
  });
});

describe('groupArtifactsByRoom — doctrine ban-list (model produces no verdict)', () => {
  const BANNED = ['winner', 'loser', 'liar', 'dishonest', 'bad faith', 'correct', 'true ', 'false ', 'propagandist', 'extremist'];

  it('never injects a verdict token into any produced field', () => {
    const groups: AdminArgumentRoomGroup[] = groupArtifactsByRoom([
      makeArtifact({ artifactId: 'id:a1', debateId: 'room-1', debateTitle: 'A neutral room title', latestBody: 'A neutral message body.' }),
    ]);
    const blob = JSON.stringify(groups).toLowerCase();
    // The model copies through user-supplied title/body verbatim; it must not
    // ADD any verdict vocabulary of its own. Our neutral fixture lets us scan
    // the entire produced structure for leakage.
    for (const token of BANNED) {
      expect(blob).not.toContain(token);
    }
  });
});
