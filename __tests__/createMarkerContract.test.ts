/**
 * MARK-002 (#894) §1 — create-marker pure contract module tests.
 *
 * Imports the Deno-side pure module `_shared/markerCreate.ts` directly (the
 * `_shared/proofAttach.ts` precedent) so the deterministic guards carry REAL
 * branch coverage: the kind vocabulary, the caps, the span-bounds validator, the
 * server-side quote verification (the Q5 + fabricated-quote guarantee), and the
 * server-slice snapshot. Also asserts no verdict token leaks into an exported
 * string (a marker quotes the point, never judges it).
 */
import {
  MARKER_KINDS,
  MARKER_QUOTE_MAX,
  MARKERS_PER_TARGET_PER_USER,
  isMarkerKind,
  verifyMarkerSpan,
  verifyQuoteMatch,
  sliceQuote,
} from '../supabase/functions/_shared/markerCreate';

describe('MARK-002 §1 — kind vocabulary', () => {
  it('MARKER_KINDS is exactly (rebuttal_anchor, note) — proof_excerpt deferred', () => {
    expect([...MARKER_KINDS]).toEqual(['rebuttal_anchor', 'note']);
  });

  it('isMarkerKind accepts the two shipped kinds and rejects everything else', () => {
    expect(isMarkerKind('rebuttal_anchor')).toBe(true);
    expect(isMarkerKind('note')).toBe(true);
    expect(isMarkerKind('proof_excerpt')).toBe(false);
    expect(isMarkerKind('voice_excerpt')).toBe(false);
    expect(isMarkerKind('')).toBe(false);
    expect(isMarkerKind('verdict')).toBe(false);
  });
});

describe('MARK-002 §1 — caps', () => {
  it('MARKER_QUOTE_MAX is 2000 and MARKERS_PER_TARGET_PER_USER is 20', () => {
    expect(MARKER_QUOTE_MAX).toBe(2000);
    expect(MARKERS_PER_TARGET_PER_USER).toBe(20);
  });
});

describe('MARK-002 §1 — verifyMarkerSpan', () => {
  const bodyLen = 20;

  it('accepts an in-bounds span', () => {
    expect(verifyMarkerSpan(bodyLen, 0, 5)).toEqual({ ok: true });
    expect(verifyMarkerSpan(bodyLen, 5, 20)).toEqual({ ok: true });
  });

  it('rejects a start past the end (inverted) as span_out_of_bounds', () => {
    expect(verifyMarkerSpan(bodyLen, 8, 3)).toEqual({ ok: false, issue: 'span_out_of_bounds' });
  });

  it('rejects a zero-length span (end === start) as span_out_of_bounds', () => {
    expect(verifyMarkerSpan(bodyLen, 5, 5)).toEqual({ ok: false, issue: 'span_out_of_bounds' });
  });

  it('rejects a negative start as span_out_of_bounds', () => {
    expect(verifyMarkerSpan(bodyLen, -1, 5)).toEqual({ ok: false, issue: 'span_out_of_bounds' });
  });

  it('rejects an end past the body length as span_out_of_bounds', () => {
    expect(verifyMarkerSpan(bodyLen, 10, 21)).toEqual({ ok: false, issue: 'span_out_of_bounds' });
  });

  it('rejects a non-integer offset as span_out_of_bounds', () => {
    expect(verifyMarkerSpan(bodyLen, 0.5, 5)).toEqual({ ok: false, issue: 'span_out_of_bounds' });
  });

  it('rejects a span longer than MARKER_QUOTE_MAX as span_too_long', () => {
    const longBody = MARKER_QUOTE_MAX + 100;
    expect(verifyMarkerSpan(longBody, 0, MARKER_QUOTE_MAX + 1)).toEqual({
      ok: false,
      issue: 'span_too_long',
    });
  });

  it('accepts a span exactly at MARKER_QUOTE_MAX', () => {
    const longBody = MARKER_QUOTE_MAX + 100;
    expect(verifyMarkerSpan(longBody, 0, MARKER_QUOTE_MAX)).toEqual({ ok: true });
  });
});

describe('MARK-002 §1 — sliceQuote', () => {
  it('returns the verbatim substring', () => {
    expect(sliceQuote('the quick brown fox', 4, 9)).toBe('quick');
    expect(sliceQuote('the quick brown fox', 0, 3)).toBe('the');
  });
});

describe('MARK-002 §1 — verifyQuoteMatch (Q5 + fabricated-quote AC)', () => {
  const body = 'Cars are bad because they pollute cities.';

  it('accepts an exact match of the server slice', () => {
    const start = 0;
    const end = 8; // "Cars are"
    expect(verifyQuoteMatch(body, start, end, body.slice(start, end))).toEqual({ ok: true });
  });

  it('rejects a fabricated quote that does not match the slice', () => {
    // The client claims the phrase says something it does not.
    expect(verifyQuoteMatch(body, 0, 8, 'Cars kill')).toEqual({
      ok: false,
      issue: 'quote_mismatch',
    });
  });

  it('is whitespace-sensitive (a trailing space does not match)', () => {
    const start = 0;
    const end = 4; // "Cars"
    expect(verifyQuoteMatch(body, start, end, 'Cars ')).toEqual({
      ok: false,
      issue: 'quote_mismatch',
    });
  });

  it('rejects stale offsets (body drift) as quote_mismatch', () => {
    const start = 9;
    const end = 12; // "bad"
    // The client cached a different phrase for these offsets.
    expect(verifyQuoteMatch(body, start, end, 'car')).toEqual({
      ok: false,
      issue: 'quote_mismatch',
    });
  });
});

describe('MARK-002 §1 — doctrine ban-list (no verdict token in exported strings)', () => {
  const BANNED = [
    'winner',
    'loser',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'correct',
  ];
  it('no exported kind or issue string carries a verdict/person token', () => {
    const strings = [
      ...MARKER_KINDS,
      // Exercise every issue branch to scan its literal.
      (verifyMarkerSpan(10, 5, 3) as { issue: string }).issue,
      (verifyMarkerSpan(10, 0, 9999) as { issue: string }).issue,
      (verifyQuoteMatch('abc', 0, 3, 'xyz') as { issue: string }).issue,
    ];
    for (const s of strings) {
      for (const b of BANNED) {
        expect(s.toLowerCase()).not.toContain(b);
      }
    }
  });
});
