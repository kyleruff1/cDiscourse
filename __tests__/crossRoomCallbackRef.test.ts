/**
 * UX-COMPOSER-005 (#831) / QUOTE-FORGE-002 (#842) — the shared persisted-ref
 * contract. Real-derivation: runs the production write/read, never a fixture
 * echo of the expected output. Every negative control is a FIRING control (a
 * malformed blob that yields null, not a vacuous pass).
 */
import {
  writeCrossRoomCallback,
  readCrossRoomCallback,
  CROSS_ROOM_CALLBACK_KEY,
  MAX_CALLBACK_EXCERPT_CHARS,
  MAX_CALLBACK_TITLE_SNAPSHOT_CHARS,
  type CrossRoomCallback,
} from '../src/features/arguments/crossRoom/crossRoomCallbackRef';

function makeCallback(overrides: Partial<CrossRoomCallback> = {}): CrossRoomCallback {
  return {
    targetDebateId: 'debate-prior-1',
    targetTitleSnapshot: 'Bike-lane baseline',
    excerpt: 'Protected lanes reduce collisions on arterials.',
    capturedFromArgumentId: 'arg-9',
    ...overrides,
  };
}

describe('writeCrossRoomCallback', () => {
  it('merges the ref under crossRoomCallback and preserves existing keys', () => {
    const existing = { evidenceResponse: { foo: 1 }, other: 'keep' };
    const out = writeCrossRoomCallback(existing, makeCallback());
    expect(out.evidenceResponse).toEqual({ foo: 1 });
    expect(out.other).toBe('keep');
    const ref = out[CROSS_ROOM_CALLBACK_KEY] as Record<string, unknown>;
    expect(ref).toEqual({
      targetDebateId: 'debate-prior-1',
      excerpt: 'Protected lanes reduce collisions on arterials.',
      targetTitleSnapshot: 'Bike-lane baseline',
      capturedFromArgumentId: 'arg-9',
      v: 1,
    });
  });

  it('accepts an undefined client_validation and returns a fresh object', () => {
    const out = writeCrossRoomCallback(undefined, makeCallback());
    expect(out[CROSS_ROOM_CALLBACK_KEY]).toBeDefined();
  });

  it('does NOT mutate the input client_validation object', () => {
    const existing = { evidenceResponse: { foo: 1 } };
    const snapshot = JSON.parse(JSON.stringify(existing));
    writeCrossRoomCallback(existing, makeCallback());
    expect(existing).toEqual(snapshot);
    expect(existing).not.toHaveProperty(CROSS_ROOM_CALLBACK_KEY);
  });

  it('clamps the excerpt to the persisted ceiling and trims', () => {
    const long = 'x'.repeat(MAX_CALLBACK_EXCERPT_CHARS + 50);
    const out = writeCrossRoomCallback(undefined, makeCallback({ excerpt: `   ${long}   ` }));
    const ref = out[CROSS_ROOM_CALLBACK_KEY] as { excerpt: string };
    expect(ref.excerpt.length).toBe(MAX_CALLBACK_EXCERPT_CHARS);
  });

  it('clamps the title snapshot to its ceiling and trims', () => {
    const long = 't'.repeat(MAX_CALLBACK_TITLE_SNAPSHOT_CHARS + 20);
    const out = writeCrossRoomCallback(undefined, makeCallback({ targetTitleSnapshot: long }));
    const ref = out[CROSS_ROOM_CALLBACK_KEY] as { targetTitleSnapshot: string };
    expect(ref.targetTitleSnapshot.length).toBe(MAX_CALLBACK_TITLE_SNAPSHOT_CHARS);
  });

  it('defaults a missing capturedFromArgumentId to null and tags v:1', () => {
    const out = writeCrossRoomCallback(undefined, makeCallback({ capturedFromArgumentId: null }));
    const ref = out[CROSS_ROOM_CALLBACK_KEY] as { capturedFromArgumentId: unknown; v: number };
    expect(ref.capturedFromArgumentId).toBeNull();
    expect(ref.v).toBe(1);
  });

  it('is deterministic — same input yields deep-equal output twice', () => {
    const a = writeCrossRoomCallback({ keep: true }, makeCallback());
    const b = writeCrossRoomCallback({ keep: true }, makeCallback());
    expect(a).toEqual(b);
  });
});

describe('readCrossRoomCallback', () => {
  it('round-trips a written ref', () => {
    const blob = writeCrossRoomCallback(undefined, makeCallback());
    const ref = readCrossRoomCallback(blob);
    expect(ref).toEqual({
      targetDebateId: 'debate-prior-1',
      excerpt: 'Protected lanes reduce collisions on arterials.',
      targetTitleSnapshot: 'Bike-lane baseline',
      capturedFromArgumentId: 'arg-9',
      v: 1,
    });
  });

  it.each<[string, unknown]>([
    ['undefined', undefined],
    ['null', null],
    ['a non-object', 'not-an-object'],
    ['a number', 42],
    ['an empty object', {}],
    ['crossRoomCallback null', { crossRoomCallback: null }],
    ['crossRoomCallback a string', { crossRoomCallback: 'x' }],
    ['empty targetDebateId', { crossRoomCallback: { targetDebateId: '', excerpt: 'x', v: 1 } }],
    ['missing excerpt', { crossRoomCallback: { targetDebateId: 'd', v: 1 } }],
    ['non-string excerpt', { crossRoomCallback: { targetDebateId: 'd', excerpt: 5, v: 1 } }],
    ['wrong v', { crossRoomCallback: { targetDebateId: 'd', excerpt: 'x', v: 2 } }],
    ['missing v', { crossRoomCallback: { targetDebateId: 'd', excerpt: 'x' } }],
  ])('returns null (firing negative control) for %s', (_label, input) => {
    expect(readCrossRoomCallback(input)).toBeNull();
  });

  it('never throws on hostile input', () => {
    expect(() => readCrossRoomCallback({ crossRoomCallback: { targetDebateId: {}, v: 1 } })).not.toThrow();
    expect(() => readCrossRoomCallback([])).not.toThrow();
  });

  it('clamps excerpt / title defensively on read', () => {
    const blob = {
      crossRoomCallback: {
        targetDebateId: 'd',
        excerpt: 'e'.repeat(MAX_CALLBACK_EXCERPT_CHARS + 10),
        targetTitleSnapshot: 't'.repeat(MAX_CALLBACK_TITLE_SNAPSHOT_CHARS + 10),
        v: 1,
      },
    };
    const ref = readCrossRoomCallback(blob);
    expect(ref?.excerpt.length).toBe(MAX_CALLBACK_EXCERPT_CHARS);
    expect(ref?.targetTitleSnapshot.length).toBe(MAX_CALLBACK_TITLE_SNAPSHOT_CHARS);
  });
});
