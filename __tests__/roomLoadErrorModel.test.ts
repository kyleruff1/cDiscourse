/**
 * UX-PR-B (#918) — deriveRoomLoadErrorStrip (pure model).
 *
 * The "renders once" invariant at the model layer: any number of failed sources
 * fold into ONE stable message + a canonically-ordered failure set. Zero errors
 * => hidden. The message is a fixed constant (never derived from the failure set)
 * so a live region announces it once; it is ban-list clean.
 */
import {
  deriveRoomLoadErrorStrip,
  type RoomLoadErrorInput,
} from '../src/features/arguments/room/roomLoadErrorModel';
import { ROOM_LOAD_ERROR_COPY } from '../src/features/arguments/gameCopy';

const SENTINEL = ROOM_LOAD_ERROR_COPY.hookError;

describe('deriveRoomLoadErrorStrip — visibility', () => {
  it('is hidden when every source is null', () => {
    const state = deriveRoomLoadErrorStrip([
      { source: 'proof', error: null },
      { source: 'markers', error: null },
      { source: 'move_marks', error: null },
      { source: 'chime_in', error: null },
    ]);
    expect(state.visible).toBe(false);
    expect(state.failedSources).toEqual([]);
  });

  it('is hidden for an empty input list', () => {
    const state = deriveRoomLoadErrorStrip([]);
    expect(state.visible).toBe(false);
    expect(state.failedSources).toEqual([]);
  });

  it('is visible with a single failed source and lists only that source', () => {
    const state = deriveRoomLoadErrorStrip([
      { source: 'proof', error: SENTINEL },
      { source: 'markers', error: null },
      { source: 'move_marks', error: null },
      { source: 'chime_in', error: null },
    ]);
    expect(state.visible).toBe(true);
    expect(state.failedSources).toEqual(['proof']);
  });
});

describe('deriveRoomLoadErrorStrip — renders-once invariant', () => {
  it('folds all four failures into ONE message + canonically-ordered sources', () => {
    const state = deriveRoomLoadErrorStrip([
      { source: 'chime_in', error: SENTINEL },
      { source: 'proof', error: SENTINEL },
      { source: 'move_marks', error: SENTINEL },
      { source: 'markers', error: SENTINEL },
    ]);
    expect(state.visible).toBe(true);
    // ONE stable message regardless of the four failures.
    expect(state.message).toBe(ROOM_LOAD_ERROR_COPY.stripMessage);
    // Canonical order, independent of the (shuffled) input order.
    expect(state.failedSources).toEqual(['proof', 'markers', 'move_marks', 'chime_in']);
  });

  it('emits the SAME message whether one source or all four fail', () => {
    const one = deriveRoomLoadErrorStrip([{ source: 'markers', error: SENTINEL }]);
    const all = deriveRoomLoadErrorStrip([
      { source: 'proof', error: SENTINEL },
      { source: 'markers', error: SENTINEL },
      { source: 'move_marks', error: SENTINEL },
      { source: 'chime_in', error: SENTINEL },
    ]);
    expect(one.message).toBe(all.message);
  });

  it('is order-independent for the failed subset', () => {
    const a = deriveRoomLoadErrorStrip([
      { source: 'move_marks', error: SENTINEL },
      { source: 'proof', error: SENTINEL },
    ]);
    const b = deriveRoomLoadErrorStrip([
      { source: 'proof', error: SENTINEL },
      { source: 'move_marks', error: SENTINEL },
    ]);
    expect(a.failedSources).toEqual(['proof', 'move_marks']);
    expect(b.failedSources).toEqual(a.failedSources);
  });

  it('ignores undefined-error inputs defensively', () => {
    const state = deriveRoomLoadErrorStrip([
      { source: 'proof', error: undefined as unknown as string | null },
      { source: 'markers', error: SENTINEL },
    ] as RoomLoadErrorInput[]);
    expect(state.failedSources).toEqual(['markers']);
  });

  it('returns a frozen output', () => {
    const state = deriveRoomLoadErrorStrip([{ source: 'proof', error: SENTINEL }]);
    expect(Object.isFrozen(state)).toBe(true);
  });
});

describe('deriveRoomLoadErrorStrip — doctrine (ban-list clean)', () => {
  const BANNED = [
    'winner',
    'loser',
    'correct',
    'incorrect',
    'true',
    'false',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'popular',
    'trending',
    'viral',
    'heat',
  ];

  it('the emitted message and every ROOM_LOAD_ERROR_COPY value carry no banned token', () => {
    const strings = [
      deriveRoomLoadErrorStrip([{ source: 'proof', error: SENTINEL }]).message,
      ...Object.values(ROOM_LOAD_ERROR_COPY),
    ];
    for (const str of strings) {
      const lower = str.toLowerCase();
      for (const token of BANNED) {
        expect(lower).not.toContain(token);
      }
      // No snake_case internal-code leak.
      expect(str).not.toContain('_');
    }
  });
});
