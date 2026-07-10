/**
 * MARK-002 (#894) — timestampMarkerModel pure-model tests.
 *
 * 100% public-function coverage (the pure-model bar): segmentPhrases (exact
 * offsets, empty body, trailing punctuation, no-boundary whole-body),
 * buildSourceSpanSegments (match + drift -> null), groupMarkersByTarget /
 * ByReply, formatMarkerChipLabel truncation, buildTimestampMarker live/orphaned.
 */
import {
  segmentPhrases,
  buildTimestampMarker,
  groupMarkersByTarget,
  groupMarkersByReply,
  buildSourceSpanSegments,
  formatMarkerChipLabel,
  type MarkerRow,
} from '../src/features/arguments/markers/timestampMarkerModel';

function row(overrides: Partial<MarkerRow> = {}): MarkerRow {
  return {
    id: 'm1',
    debate_id: 'd1',
    target_argument_id: 't1',
    reply_argument_id: null,
    created_by: 'u1',
    kind: 'rebuttal_anchor',
    span_start: 0,
    span_end: 4,
    span_unit: 'chars',
    quoted_text: 'Cars',
    created_at: '2026-07-11T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('segmentPhrases — exact offsets', () => {
  it('splits sentences with byte-exact offsets (slice === text)', () => {
    const body = 'Cars are bad. Bikes are good.';
    const phrases = segmentPhrases(body);
    expect(phrases.length).toBe(2);
    for (const p of phrases) {
      expect(body.slice(p.start, p.end)).toBe(p.text);
    }
    expect(phrases[0].text).toBe('Cars are bad.');
    expect(phrases[1].text).toBe('Bikes are good.');
  });

  it('returns one whole-content phrase when there is no sentence terminator', () => {
    const body = 'no punctuation here';
    const phrases = segmentPhrases(body);
    expect(phrases).toHaveLength(1);
    expect(phrases[0]).toEqual({ text: 'no punctuation here', start: 0, end: 19 });
  });

  it('keeps a trailing terminator run with its sentence', () => {
    const body = 'Really?! Yes.';
    const phrases = segmentPhrases(body);
    expect(phrases[0].text).toBe('Really?!');
    expect(body.slice(phrases[0].start, phrases[0].end)).toBe('Really?!');
    expect(phrases[1].text).toBe('Yes.');
  });

  it('returns an empty list for an empty or whitespace-only body', () => {
    expect(segmentPhrases('')).toEqual([]);
    expect(segmentPhrases('   \n\t ')).toEqual([]);
  });

  it('skips leading whitespace so every phrase starts on content', () => {
    const body = '   Hello world.';
    const phrases = segmentPhrases(body);
    expect(phrases[0].start).toBe(3);
    expect(body.slice(phrases[0].start, phrases[0].end)).toBe('Hello world.');
  });
});

describe('buildSourceSpanSegments', () => {
  it('splits the body into before / marked / after for an in-bounds span', () => {
    const body = 'Cars are bad because they pollute.';
    expect(buildSourceSpanSegments(body, { spanStart: 0, spanEnd: 4 })).toEqual({
      before: '',
      marked: 'Cars',
      after: ' are bad because they pollute.',
    });
  });

  it('returns null when offsets no longer index the body (drift)', () => {
    const body = 'short';
    expect(buildSourceSpanSegments(body, { spanStart: 0, spanEnd: 999 })).toBeNull();
    expect(buildSourceSpanSegments(body, { spanStart: 4, spanEnd: 2 })).toBeNull();
    expect(buildSourceSpanSegments(body, { spanStart: -1, spanEnd: 2 })).toBeNull();
  });
});

describe('groupMarkersByTarget / groupMarkersByReply', () => {
  it('groups by target argument id', () => {
    const rows = [row({ id: 'a', target_argument_id: 't1' }), row({ id: 'b', target_argument_id: 't1' }), row({ id: 'c', target_argument_id: 't2' })];
    const grouped = groupMarkersByTarget(rows);
    expect(grouped.t1.map((r) => r.id)).toEqual(['a', 'b']);
    expect(grouped.t2.map((r) => r.id)).toEqual(['c']);
  });

  it('groups by reply id and skips standalone markers (null reply)', () => {
    const rows = [
      row({ id: 'a', reply_argument_id: 'r1' }),
      row({ id: 'b', reply_argument_id: null }),
      row({ id: 'c', reply_argument_id: 'r1' }),
    ];
    const grouped = groupMarkersByReply(rows);
    expect(grouped.r1.map((r) => r.id)).toEqual(['a', 'c']);
    expect(Object.keys(grouped)).toEqual(['r1']);
  });
});

describe('formatMarkerChipLabel', () => {
  it('quote-wraps a short phrase', () => {
    expect(formatMarkerChipLabel('Cars are bad')).toBe('“Cars are bad”');
  });

  it('collapses whitespace and truncates a long phrase with an ellipsis', () => {
    const long = 'This is a very long quoted phrase that should be clamped to a chip width';
    const label = formatMarkerChipLabel(long);
    expect(label.startsWith('“')).toBe(true);
    expect(label.endsWith('”')).toBe(true);
    expect(label).toContain('…');
    expect(label.length).toBeLessThan(long.length);
  });

  it('handles empty input safely', () => {
    expect(formatMarkerChipLabel('')).toBe('“”');
  });
});

describe('buildTimestampMarker', () => {
  it('maps a row to a live view-model when the target exists', () => {
    const vm = buildTimestampMarker(row({ reply_argument_id: 'r1' }), { targetExists: true });
    expect(vm).toEqual({
      id: 'm1',
      targetArgumentId: 't1',
      replyArgumentId: 'r1',
      kind: 'rebuttal_anchor',
      spanStart: 0,
      spanEnd: 4,
      quotedText: 'Cars',
      state: 'live',
    });
  });

  it('marks the view-model orphaned when the target is gone (durable quotedText survives)', () => {
    const vm = buildTimestampMarker(row(), { targetExists: false });
    expect(vm.state).toBe('orphaned');
    expect(vm.quotedText).toBe('Cars');
  });
});
