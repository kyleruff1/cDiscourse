/**
 * MARK-002 (#894) — marker copy doctrine ban-list.
 *
 * Every marker string describes the MOMENT, never the person: no verdict or
 * person token appears in any MARKER_COPY string or any MARKER_ERROR_COPY
 * message. Unknown codes fall back, never echoed. A negative control proves the
 * scan can fail.
 */
import { MARKER_COPY, MARKER_ERROR_COPY, toMarkerErrorCode } from '../src/features/arguments/markers/markerCopy';

const BANNED = [
  'winner',
  'loser',
  'liar',
  'true',
  'false',
  'correct',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
];

function scan(strings: string[]): void {
  for (const s of strings) {
    for (const b of BANNED) {
      expect(s.toLowerCase()).not.toContain(b);
    }
  }
}

describe('markerCopy — no verdict / person tokens', () => {
  it('MARKER_COPY carries no banned token', () => {
    scan(Object.values(MARKER_COPY));
  });

  it('MARKER_ERROR_COPY carries no banned token', () => {
    scan(Object.values(MARKER_ERROR_COPY));
  });

  it('NEGATIVE CONTROL: the scan fires on a planted verdict token', () => {
    expect(() => scan(['You are the winner here'])).toThrow();
  });
});

describe('markerCopy — no raw internal code leaks to the UI', () => {
  it('no MARKER_ERROR_COPY message contains a snake_case code', () => {
    for (const msg of Object.values(MARKER_ERROR_COPY)) {
      // A snake_case internal code would carry an underscore between word chars.
      expect(msg).not.toMatch(/[a-z]_[a-z]/);
    }
  });

  it('toMarkerErrorCode maps a known code through and an unknown code to unknown', () => {
    expect(toMarkerErrorCode('quote_mismatch')).toBe('quote_mismatch');
    expect(toMarkerErrorCode('marker_cap_reached')).toBe('marker_cap_reached');
    expect(toMarkerErrorCode('some_brand_new_code')).toBe('unknown');
    expect(toMarkerErrorCode(undefined)).toBe('unknown');
  });
});
