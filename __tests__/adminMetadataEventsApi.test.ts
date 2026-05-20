/**
 * META-1C — Admin metadata-event audit log data layer tests.
 *
 * Covers:
 *  - `expandPointTagRowToEvents` — the pure row-to-events adapter (the core).
 *  - `loadMetadataAuditEvents` — the loader call shape + post-expansion sort.
 *  - actor-side enrichment via the `debate_participants` lookup.
 *  - `dedupeDebateOptions` / `loadAuditDebateOptions`.
 *  - the doctrine ban-list scan over emitted strings.
 *  - source-file safety (no service-role, no Authorization literal).
 *
 * The supabase module is mocked so the pure helpers + the loader's call
 * shape can be exercised without a native module or a live DB.
 */
import * as fs from 'fs';
import * as path from 'path';

// ── Supabase mock — a chainable query builder whose terminal result is
//    swapped per test via the module-scoped `mockState`. The state object is
//    `mock`-prefixed so the jest.mock factory may reference it. ──
type QueryResult = { data: unknown; error: { message: string } | null };

interface MockState {
  results: Record<string, QueryResult>;
  lastSelectString: string;
  lastEqArgs: Array<[string, unknown]>;
  lastLimit: number | null;
  lastInArgs: Array<[string, unknown]>;
}

const mockState: MockState = {
  results: {
    point_tags: { data: [], error: null },
    debate_participants: { data: [], error: null },
  },
  lastSelectString: '',
  lastEqArgs: [],
  lastLimit: null,
  lastInArgs: [],
};

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      builder.select = (s: string) => {
        if (table === 'point_tags') mockState.lastSelectString = s;
        return builder;
      };
      builder.eq = (col: string, val: unknown) => {
        mockState.lastEqArgs.push([col, val]);
        return builder;
      };
      builder.in = (col: string, val: unknown) => {
        mockState.lastInArgs.push([col, val]);
        return builder;
      };
      builder.order = () => builder;
      builder.limit = (n: number) => {
        mockState.lastLimit = n;
        return Promise.resolve(mockState.results[table] ?? { data: [], error: null });
      };
      // The debate_participants terminal call is `.in` → the builder is
      // also thenable so it can be awaited directly.
      (builder as { then?: unknown }).then = (resolve: (r: QueryResult) => unknown) =>
        resolve(mockState.results[table] ?? { data: [], error: null });
      return builder;
    },
  },
  SUPABASE_CONFIGURED: true,
}));

import {
  expandPointTagRowToEvents,
  loadMetadataAuditEvents,
  loadActorSides,
  dedupeDebateOptions,
  loadAuditDebateOptions,
  sortMetadataAuditEvents,
  asDebateSide,
  POINT_TAGS_AUDIT_SELECT,
  type RawPointTagAuditRow,
  type MetadataAuditEvent,
} from '../src/features/admin/adminMetadataEventsApi';
import {
  ALL_MANUAL_TAG_CODES,
  getManualTagPlainLabel,
  _forbiddenMetadataTokens,
} from '../src/features/metadata/moveMetadataLedger';

const repoRoot = process.cwd();

beforeEach(() => {
  mockState.results.point_tags = { data: [], error: null };
  mockState.results.debate_participants = { data: [], error: null };
  mockState.lastSelectString = '';
  mockState.lastEqArgs = [];
  mockState.lastLimit = null;
  mockState.lastInArgs = [];
});

// ── Fixture builder ───────────────────────────────────────────

function makeRow(overrides: Partial<RawPointTagAuditRow> = {}): RawPointTagAuditRow {
  return {
    id: 'pt-1',
    debate_id: 'deb-1',
    argument_id: 'arg-1',
    tag_code: 'needs_source',
    tagged_by: 'user-tagger',
    created_at: '2026-05-18T10:00:00.000Z',
    removed_at: null,
    removed_by: null,
    arguments: { id: 'arg-1', body: 'A claim that lacks any source.', side: 'affirmative', status: 'posted', debate_id: 'deb-1' },
    debates: { id: 'deb-1', title: 'Bike lanes resolution' },
    tagger: { id: 'user-tagger', display_name: 'Tagger Tess', role: 'user' },
    remover: null,
    ...overrides,
  };
}

// ── expandPointTagRowToEvents — the pure adapter ──────────────

describe('expandPointTagRowToEvents — applied-only row', () => {
  it('removed_at null → exactly one applied event', () => {
    const events = expandPointTagRowToEvents(makeRow());
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.kind).toBe('applied');
    expect(e.eventId).toBe('pt-1:applied');
    expect(e.pointTagId).toBe('pt-1');
    expect(e.occurredAt).toBe('2026-05-18T10:00:00.000Z');
    expect(e.actorId).toBe('user-tagger');
    expect(e.actorDisplayName).toBe('Tagger Tess');
    expect(e.actorRole).toEqual({ appRole: 'user', debateSide: null });
  });

  it('maps debate title, argument excerpt, side, and tag code', () => {
    const e = expandPointTagRowToEvents(makeRow())[0];
    expect(e.debateTitle).toBe('Bike lanes resolution');
    expect(e.argumentExcerpt).toBe('A claim that lacks any source.');
    expect(e.argumentSide).toBe('affirmative');
    expect(e.tagCode).toBe('needs_source');
    expect(e.argumentDeleted).toBe(false);
  });

  it('reads appRole from the tagger embed (admin tagger)', () => {
    const e = expandPointTagRowToEvents(
      makeRow({ tagger: { id: 'user-tagger', display_name: 'Admin Ada', role: 'admin' } }),
    )[0];
    expect(e.actorRole?.appRole).toBe('admin');
  });

  it('coerces an unknown profiles.role to "user"', () => {
    const e = expandPointTagRowToEvents(
      makeRow({ tagger: { id: 'u', display_name: 'X', role: 'superhero' } }),
    )[0];
    expect(e.actorRole?.appRole).toBe('user');
  });

  it('normalizes a PostgREST single-element-array embed', () => {
    const e = expandPointTagRowToEvents(
      makeRow({
        debates: [{ id: 'deb-1', title: 'Array-wrapped title' }],
        tagger: [{ id: 'user-tagger', display_name: 'Wrapped', role: 'moderator' }],
      }),
    )[0];
    expect(e.debateTitle).toBe('Array-wrapped title');
    expect(e.actorDisplayName).toBe('Wrapped');
    expect(e.actorRole?.appRole).toBe('moderator');
  });
});

describe('expandPointTagRowToEvents — applied + removed row', () => {
  it('removed_at set → two events with correct timestamps + actors', () => {
    const events = expandPointTagRowToEvents(
      makeRow({
        removed_at: '2026-05-19T12:00:00.000Z',
        removed_by: 'user-remover',
        remover: { id: 'user-remover', display_name: 'Remover Rex', role: 'moderator' },
      }),
    );
    expect(events).toHaveLength(2);
    const applied = events.find((e) => e.kind === 'applied')!;
    const removed = events.find((e) => e.kind === 'removed')!;
    expect(applied.occurredAt).toBe('2026-05-18T10:00:00.000Z');
    expect(applied.actorId).toBe('user-tagger');
    expect(removed.eventId).toBe('pt-1:removed');
    expect(removed.occurredAt).toBe('2026-05-19T12:00:00.000Z');
    expect(removed.actorId).toBe('user-remover');
    expect(removed.actorDisplayName).toBe('Remover Rex');
    expect(removed.actorRole).toEqual({ appRole: 'moderator', debateSide: null });
  });

  it('removed_at set but removed_by null → removed event has null actor (edge case #5)', () => {
    const events = expandPointTagRowToEvents(
      makeRow({ removed_at: '2026-05-19T12:00:00.000Z', removed_by: null, remover: null }),
    );
    const removed = events.find((e) => e.kind === 'removed')!;
    expect(removed.actorId).toBeNull();
    expect(removed.actorDisplayName).toBeNull();
    expect(removed.actorRole).toBeNull();
  });
});

describe('expandPointTagRowToEvents — defensive / edge cases', () => {
  it('tag_code outside ALL_MANUAL_TAG_CODES → event dropped', () => {
    expect(expandPointTagRowToEvents(makeRow({ tag_code: 'not_a_real_tag' }))).toEqual([]);
  });

  it('null id → returns [] without throwing (edge case #9)', () => {
    expect(expandPointTagRowToEvents(makeRow({ id: null }))).toEqual([]);
  });

  it('missing argument_id → returns []', () => {
    expect(expandPointTagRowToEvents(makeRow({ argument_id: null }))).toEqual([]);
  });

  it('missing created_at → returns []', () => {
    expect(expandPointTagRowToEvents(makeRow({ created_at: null }))).toEqual([]);
  });

  it('missing arguments embed → argumentExcerpt null, no crash', () => {
    const e = expandPointTagRowToEvents(makeRow({ arguments: null }))[0];
    expect(e.argumentExcerpt).toBeNull();
    expect(e.argumentSide).toBeNull();
    expect(e.argumentDeleted).toBe(false);
  });

  it('soft-deleted argument (status deleted) → argumentDeleted true (edge case #7)', () => {
    const e = expandPointTagRowToEvents(
      makeRow({
        arguments: { id: 'arg-1', body: 'Deleted move body.', side: 'negative', status: 'deleted', debate_id: 'deb-1' },
      }),
    )[0];
    expect(e.argumentDeleted).toBe(true);
    expect(e.argumentExcerpt).toBe('Deleted move body.');
  });

  it('argument in a different debate does not crash the adapter (edge case #8)', () => {
    const events = expandPointTagRowToEvents(
      makeRow({
        arguments: { id: 'arg-1', body: 'Mismatched debate body.', side: 'affirmative', status: 'posted', debate_id: 'OTHER-debate' },
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].argumentExcerpt).toBe('Mismatched debate body.');
  });

  it('whitespace-collapses and truncates a long body to ~160 chars', () => {
    const longBody = 'word '.repeat(80); // 400 chars
    const e = expandPointTagRowToEvents(
      makeRow({
        arguments: { id: 'arg-1', body: longBody, side: 'affirmative', status: 'posted', debate_id: 'deb-1' },
      }),
    )[0];
    expect(e.argumentExcerpt!.length).toBeLessThanOrEqual(160);
    expect(e.argumentExcerpt!.endsWith('…')).toBe(true);
    expect(e.argumentExcerpt).not.toMatch(/\s{2,}/);
  });

  it('tagPlainLabel equals getManualTagPlainLabel for all 10 codes', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      const e = expandPointTagRowToEvents(makeRow({ tag_code: code }))[0];
      expect(e.tagPlainLabel).toBe(getManualTagPlainLabel(code));
      expect(e.tagPlainLabel.length).toBeGreaterThan(0);
    }
  });
});

// ── asDebateSide ──────────────────────────────────────────────

describe('asDebateSide', () => {
  it('passes through the three debater sides', () => {
    expect(asDebateSide('affirmative')).toBe('affirmative');
    expect(asDebateSide('negative')).toBe('negative');
    expect(asDebateSide('observer')).toBe('observer');
  });

  it('coerces a moderator side to null (moderator surfaces via appRole)', () => {
    expect(asDebateSide('moderator')).toBeNull();
  });

  it('coerces null / unknown side to null', () => {
    expect(asDebateSide(null)).toBeNull();
    expect(asDebateSide('garbage')).toBeNull();
  });
});

// ── sortMetadataAuditEvents ───────────────────────────────────

describe('sortMetadataAuditEvents', () => {
  function ev(eventId: string, occurredAt: string): MetadataAuditEvent {
    return {
      eventId, pointTagId: eventId, kind: 'applied', occurredAt,
      debateId: 'd', debateTitle: null, argumentId: 'a', argumentExcerpt: null,
      argumentSide: null, argumentDeleted: false, tagCode: 'tangent',
      tagPlainLabel: 'Tangent / side issue', actorId: null, actorDisplayName: null,
      actorRole: null,
    };
  }

  it('desc → newest first', () => {
    const out = sortMetadataAuditEvents(
      [ev('a', '2026-05-18T00:00:00.000Z'), ev('b', '2026-05-19T00:00:00.000Z')],
      'desc',
    );
    expect(out.map((e) => e.eventId)).toEqual(['b', 'a']);
  });

  it('asc → oldest first', () => {
    const out = sortMetadataAuditEvents(
      [ev('b', '2026-05-19T00:00:00.000Z'), ev('a', '2026-05-18T00:00:00.000Z')],
      'asc',
    );
    expect(out.map((e) => e.eventId)).toEqual(['a', 'b']);
  });

  it('uses eventId as a stable secondary key on tied timestamps (edge case #13)', () => {
    const same = '2026-05-18T00:00:00.000Z';
    const out = sortMetadataAuditEvents([ev('zzz', same), ev('aaa', same)], 'desc');
    expect(out.map((e) => e.eventId)).toEqual(['aaa', 'zzz']);
  });
});

// ── POINT_TAGS_AUDIT_SELECT shape ─────────────────────────────

describe('POINT_TAGS_AUDIT_SELECT — committed select string', () => {
  it('selects the eight point_tags columns', () => {
    for (const col of [
      'id', 'debate_id', 'argument_id', 'tag_code', 'tagged_by',
      'created_at', 'removed_at', 'removed_by',
    ]) {
      expect(POINT_TAGS_AUDIT_SELECT).toContain(col);
    }
  });

  it('embeds arguments, debates, and the two disambiguated profiles joins', () => {
    expect(POINT_TAGS_AUDIT_SELECT).toContain('arguments!inner');
    expect(POINT_TAGS_AUDIT_SELECT).toContain('debates!inner');
    expect(POINT_TAGS_AUDIT_SELECT).toContain('tagger:profiles!point_tags_tagged_by_fkey');
    expect(POINT_TAGS_AUDIT_SELECT).toContain('remover:profiles!point_tags_removed_by_fkey');
  });
});

// ── loadMetadataAuditEvents — loader behavior ─────────────────

describe('loadMetadataAuditEvents', () => {
  it('debateId null → returns [] with no query issued', async () => {
    const out = await loadMetadataAuditEvents({ debateId: null });
    expect(out).toEqual([]);
    expect(mockState.lastSelectString).toBe('');
    expect(mockState.lastLimit).toBeNull();
  });

  it('issues a point_tags select with the committed select + eq(debate_id) + limit', async () => {
    await loadMetadataAuditEvents({ debateId: 'deb-1' });
    expect(mockState.lastSelectString).toBe(POINT_TAGS_AUDIT_SELECT);
    expect(mockState.lastEqArgs).toContainEqual(['debate_id', 'deb-1']);
    expect(mockState.lastLimit).toBe(200);
  });

  it('clamps limit to the 1..500 range', async () => {
    await loadMetadataAuditEvents({ debateId: 'deb-1', limit: 9999 });
    expect(mockState.lastLimit).toBe(500);
    await loadMetadataAuditEvents({ debateId: 'deb-1', limit: 0 });
    expect(mockState.lastLimit).toBe(1);
  });

  it('error from the query → throws a wrapped error', async () => {
    mockState.results.point_tags = { data: null, error: { message: 'rls denied' } };
    await expect(loadMetadataAuditEvents({ debateId: 'deb-1' }))
      .rejects.toThrow(/loadMetadataAuditEvents failed: rls denied/);
  });

  it('expands an applied+removed row and sorts events by occurredAt across rows', async () => {
    // Row A: applied Mon, removed Fri. Row B: applied Wed.
    mockState.results.point_tags = {
      data: [
        makeRow({
          id: 'A',
          created_at: '2026-05-18T00:00:00.000Z', // Mon
          removed_at: '2026-05-22T00:00:00.000Z', // Fri
          removed_by: 'user-remover',
          remover: { id: 'user-remover', display_name: 'Rex', role: 'user' },
        }),
        makeRow({ id: 'B', created_at: '2026-05-20T00:00:00.000Z' }), // Wed
      ],
      error: null,
    };
    const out = await loadMetadataAuditEvents({ debateId: 'deb-1', sortDirection: 'asc' });
    // Mon (A applied) → Wed (B applied) → Fri (A removed): the removed event
    // interleaves with the unrelated row.
    expect(out.map((e) => e.eventId)).toEqual(['A:applied', 'B:applied', 'A:removed']);
  });

  it('default sort is desc (newest event first)', async () => {
    mockState.results.point_tags = {
      data: [
        makeRow({ id: 'A', created_at: '2026-05-18T00:00:00.000Z' }),
        makeRow({ id: 'B', created_at: '2026-05-20T00:00:00.000Z' }),
      ],
      error: null,
    };
    const out = await loadMetadataAuditEvents({ debateId: 'deb-1' });
    expect(out.map((e) => e.eventId)).toEqual(['B:applied', 'A:applied']);
  });

  it('enriches each event with the actor debate side from debate_participants', async () => {
    mockState.results.point_tags = {
      data: [makeRow({ id: 'A', tagged_by: 'user-tagger' })],
      error: null,
    };
    mockState.results.debate_participants = {
      data: [{ user_id: 'user-tagger', side: 'negative' }],
      error: null,
    };
    const out = await loadMetadataAuditEvents({ debateId: 'deb-1' });
    expect(out[0].actorRole?.debateSide).toBe('negative');
    expect(mockState.lastInArgs).toContainEqual(['user_id', ['user-tagger']]);
  });

  it('actor with no participant row → debateSide stays null (edge case #14)', async () => {
    mockState.results.point_tags = {
      data: [makeRow({ id: 'A', tagged_by: 'user-tagger' })],
      error: null,
    };
    mockState.results.debate_participants = { data: [], error: null };
    const out = await loadMetadataAuditEvents({ debateId: 'deb-1' });
    expect(out[0].actorRole?.debateSide).toBeNull();
  });
});

// ── loadActorSides ────────────────────────────────────────────

describe('loadActorSides', () => {
  it('empty actorIds → empty map, no query', async () => {
    const out = await loadActorSides('deb-1', []);
    expect(out.size).toBe(0);
  });

  it('maps each actor id to a typed side', async () => {
    mockState.results.debate_participants = {
      data: [
        { user_id: 'u1', side: 'affirmative' },
        { user_id: 'u2', side: 'moderator' }, // coerced to null
      ],
      error: null,
    };
    const out = await loadActorSides('deb-1', ['u1', 'u2']);
    expect(out.get('u1')).toBe('affirmative');
    expect(out.get('u2')).toBeNull();
  });

  it('query error → empty map (non-fatal)', async () => {
    mockState.results.debate_participants = { data: null, error: { message: 'boom' } };
    const out = await loadActorSides('deb-1', ['u1']);
    expect(out.size).toBe(0);
  });
});

// ── dedupeDebateOptions / loadAuditDebateOptions ──────────────

describe('dedupeDebateOptions', () => {
  it('de-dupes by debate_id and sorts by title', () => {
    const out = dedupeDebateOptions([
      { debate_id: 'd2', debates: { id: 'd2', title: 'Zebra room' } },
      { debate_id: 'd1', debates: { id: 'd1', title: 'Apple room' } },
      { debate_id: 'd2', debates: { id: 'd2', title: 'Zebra room' } },
    ]);
    expect(out).toEqual([
      { debateId: 'd1', title: 'Apple room' },
      { debateId: 'd2', title: 'Zebra room' },
    ]);
  });

  it('skips rows with no debate_id', () => {
    const out = dedupeDebateOptions([
      { debate_id: null, debates: null },
      { debate_id: 'd1', debates: { id: 'd1', title: 'Kept' } },
    ]);
    expect(out).toEqual([{ debateId: 'd1', title: 'Kept' }]);
  });

  it('handles a null title without crashing', () => {
    const out = dedupeDebateOptions([{ debate_id: 'd1', debates: { id: 'd1', title: null } }]);
    expect(out).toEqual([{ debateId: 'd1', title: null }]);
  });
});

describe('loadAuditDebateOptions', () => {
  it('returns sorted de-duped options from the point_tags query', async () => {
    mockState.results.point_tags = {
      data: [
        { debate_id: 'd2', debates: { id: 'd2', title: 'Beta' } },
        { debate_id: 'd1', debates: { id: 'd1', title: 'Alpha' } },
        { debate_id: 'd2', debates: { id: 'd2', title: 'Beta' } },
      ],
      error: null,
    };
    const out = await loadAuditDebateOptions();
    expect(out).toEqual([
      { debateId: 'd1', title: 'Alpha' },
      { debateId: 'd2', title: 'Beta' },
    ]);
  });

  it('error → throws a wrapped error', async () => {
    mockState.results.point_tags = { data: null, error: { message: 'nope' } };
    await expect(loadAuditDebateOptions()).rejects.toThrow(/loadAuditDebateOptions failed: nope/);
  });
});

// ── Doctrine ban-list ─────────────────────────────────────────

describe('doctrine — fact-only ban-list', () => {
  const banned = _forbiddenMetadataTokens();

  it('no manual-tag plain label contains a forbidden token', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      const label = getManualTagPlainLabel(code).toLowerCase();
      for (const tok of banned) {
        expect(label).not.toContain(tok);
      }
    }
  });

  it('every MODEL-emitted MetadataAuditEvent string is ban-list clean', () => {
    // The model's OWN strings are `kind` (applied/removed — event facts) and
    // `tagPlainLabel` (from gameCopy). Debate title / argument excerpt are
    // author-controlled content, not model output, so they are not scanned
    // here. The model strings must contain zero forbidden token.
    for (const code of ALL_MANUAL_TAG_CODES) {
      const events = expandPointTagRowToEvents(
        makeRow({
          tag_code: code,
          removed_at: '2026-05-19T12:00:00.000Z',
          removed_by: 'user-remover',
          remover: { id: 'user-remover', display_name: 'R', role: 'user' },
        }),
      );
      expect(events).toHaveLength(2);
      for (const e of events) {
        const modelStrings = `${e.kind} ${e.tagPlainLabel}`.toLowerCase();
        for (const tok of banned) {
          expect(modelStrings).not.toContain(tok);
        }
      }
    }
  });
});

// ── Source-file safety ────────────────────────────────────────

describe('adminMetadataEventsApi — source-file safety', () => {
  const src = fs.readFileSync(
    path.join(repoRoot, 'src/features/admin/adminMetadataEventsApi.ts'),
    'utf8',
  );

  it('uses the shared supabase client — no createClient / service-role', () => {
    expect(src).toContain("from '../../lib/supabase'");
    expect(src).not.toMatch(/createClient\(/);
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(src).not.toMatch(/serviceRoleKey/);
    expect(src).not.toMatch(/ANTHROPIC_API_KEY/);
  });

  it('does not bypass RLS with an .rpc() call', () => {
    expect(src).not.toMatch(/\.rpc\(/);
  });

  it('reads point_tags, debate_participants — never writes them', () => {
    expect(src).toContain(".from('point_tags')");
    expect(src).toContain(".from('debate_participants')");
    expect(src).not.toMatch(/\.insert\(/);
    expect(src).not.toMatch(/\.update\(/);
    expect(src).not.toMatch(/\.delete\(/);
    expect(src).not.toMatch(/\.upsert\(/);
  });

  it('never logs Authorization headers or bearer values', () => {
    expect(src).not.toMatch(/console\.(log|error|warn)/);
    expect(src).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
  });
});
