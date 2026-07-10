/**
 * QA-001 (#692) — J6 spine: rebut a timestamped phrase (TEXT half).
 *
 * This is the ordered-handoff spine for J6's text-marker half. It composes the
 * REAL timestamp-marker model chain in user-visible order and asserts the
 * handoff between steps — step N's output is literally the input step N+1
 * consumes — plus the durable-quote fallback that survives span drift and target
 * soft-deletion. No unit branch coverage is re-asserted here; the unit owners are:
 *   - timestampMarkerModel.test.ts   (per-function branch coverage)
 *   - markerFlagOff.test.tsx         (flag-off byte-identity)
 *   - markerCopyBanList.test.ts      (copy doctrine)
 *
 * BLOCKED ON #863: the AUDIO half of J6 (one-time playback gate, karaoke
 * transcript, long-press waveform span) has no shipped surface and is NOT
 * scripted here. It is documented as unarmed in docs/qa/journey-gate-j1-j10.md
 * and the manifest asserts it claims no spine and carries the #863 marker.
 *
 * Pure model; no RNTL render (the full interaction walk is markJ6TextFlow.test.tsx,
 * which this spine does not duplicate). The .tsx extension matches the manifest.
 */
import {
  segmentPhrases,
  formatMarkerChipLabel,
  buildSourceSpanSegments,
  buildTimestampMarker,
  type MarkerRow,
} from '../src/features/arguments/markers/timestampMarkerModel';
import { MARKER_COPY } from '../src/features/arguments/markers/markerCopy';

const TARGET_BODY = 'Cars are bad. Bikes are good.';
const TARGET_ID = 'target-1';
const REPLY_ID = 'reply-1';

/** Build the persisted marker row from a picked phrase (mirrors the mint payload). */
function rowFromPhrase(phrase: { start: number; end: number; text: string }): MarkerRow {
  return {
    id: 'm1',
    debate_id: 'd1',
    target_argument_id: TARGET_ID,
    reply_argument_id: REPLY_ID,
    created_by: 'u1',
    kind: 'rebuttal_anchor',
    span_start: phrase.start,
    span_end: phrase.end,
    span_unit: 'chars',
    quoted_text: phrase.text,
    created_at: '2026-07-11T00:00:00.000Z',
    deleted_at: null,
  };
}

describe('QA-001 J6 (text) — the ordered phrase-to-marker handoff', () => {
  it('step 1: segmentPhrases returns offset-exact phrases (body.slice round-trips)', () => {
    const phrases = segmentPhrases(TARGET_BODY);
    expect(phrases).toHaveLength(2);
    for (const p of phrases) {
      expect(TARGET_BODY.slice(p.start, p.end)).toBe(p.text);
    }
    expect(phrases[0].text).toBe('Cars are bad.');
  });

  it('step 2: the picked phrase text becomes the curly-quoted chip label', () => {
    const phrase = segmentPhrases(TARGET_BODY)[0];
    const label = formatMarkerChipLabel(phrase.text);
    // Curly double quotes wrap the clamped quote; the phrase text flows straight through.
    expect(label).toBe('“Cars are bad.”');
  });

  it('step 3: the phrase offsets flow through the row into the highlighted span', () => {
    const phrase = segmentPhrases(TARGET_BODY)[0];
    const row = rowFromPhrase(phrase);
    // The persisted span indexes the target body; the marked slice equals the quote.
    const segments = buildSourceSpanSegments(TARGET_BODY, {
      spanStart: row.span_start,
      spanEnd: row.span_end,
    });
    expect(segments).not.toBeNull();
    expect(segments?.marked).toBe(row.quoted_text);
    expect(segments?.before).toBe('');
    expect(segments?.after).toBe(' Bikes are good.');
  });

  it('step 4: a live marker renders scoped to its reply, carrying the durable quote', () => {
    const phrase = segmentPhrases(TARGET_BODY)[0];
    const vm = buildTimestampMarker(rowFromPhrase(phrase), { targetExists: true });
    expect(vm.state).toBe('live');
    expect(vm.replyArgumentId).toBe(REPLY_ID);
    expect(vm.targetArgumentId).toBe(TARGET_ID);
    expect(vm.quotedText).toBe('Cars are bad.');
  });
});

describe('QA-001 J6 (text) — span drift falls back to the durable quote', () => {
  it('buildSourceSpanSegments returns null when the offsets no longer index the body', () => {
    const phrase = segmentPhrases(TARGET_BODY)[0];
    const row = rowFromPhrase(phrase);
    // The target move was edited down to a shorter body; the stored span is now out of range.
    const EDITED_SHORTER_BODY = 'Cars.';
    const drifted = buildSourceSpanSegments(EDITED_SHORTER_BODY, {
      spanStart: row.span_start,
      spanEnd: row.span_end,
    });
    expect(drifted).toBeNull();
    // Even with no highlight, the durable quoted_text still yields a chip label.
    expect(formatMarkerChipLabel(row.quoted_text)).toBe('“Cars are bad.”');
  });
});

describe('QA-001 J6 (text) — orphaned after the target move is soft-deleted', () => {
  it('the marker resolves to orphaned but keeps the stored quote (tombstone copy)', () => {
    const phrase = segmentPhrases(TARGET_BODY)[0];
    const orphan = buildTimestampMarker(rowFromPhrase(phrase), { targetExists: false });
    expect(orphan.state).toBe('orphaned');
    // The durable quotedText survives even though the target is gone.
    expect(orphan.quotedText).toBe('Cars are bad.');
    // The rendered tombstone label is the shipped copy, never a verdict about the author.
    expect(MARKER_COPY.orphanedLabel).toBe('Quoted move was removed');
  });
});

describe('QA-001 J6 (text) — empty-input edge', () => {
  it('an empty body yields no phrases (nothing to pick)', () => {
    expect(segmentPhrases('')).toEqual([]);
    expect(segmentPhrases('   \n\t ')).toEqual([]);
  });
});
