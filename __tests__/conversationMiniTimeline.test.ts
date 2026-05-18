/**
 * Stage 6.3 — ConversationMiniTimeline pure-function tests.
 *
 * Tests the band-grouping helper that the mini rail uses to render
 * tinted underlays. The visual rendering itself is asserted by manual
 * browser-visual-test checks (see docs/browser-visual-test.md) since the
 * react-test-renderer peer dep is locked to 19.1.0 in this repo.
 */
import { groupSegmentsIntoBands } from '../src/features/debates/ConversationMiniTimeline';
import type { ConversationTimelinePreviewSegment } from '../src/features/debates/conversationGalleryModel';

function seg(i: number, family: ConversationTimelinePreviewSegment['kindFamily'], band: ConversationTimelinePreviewSegment['bandHighlight'] = null): ConversationTimelinePreviewSegment {
  return { ordinal: i, kindFamily: family, color: '#000', bandHighlight: band, isActive: false, isLatest: false };
}

describe('groupSegmentsIntoBands (mini timeline)', () => {
  it('returns no bands when no segments are highlighted', () => {
    expect(groupSegmentsIntoBands([seg(1, 'claim'), seg(2, 'challenge')])).toEqual([]);
  });

  it('returns one band for a single highlighted run', () => {
    const bands = groupSegmentsIntoBands([
      seg(1, 'claim'),
      seg(2, 'evidence', 'evidence_run'),
      seg(3, 'evidence', 'evidence_run'),
      seg(4, 'claim'),
    ]);
    expect(bands).toEqual([{ startIdx: 1, endIdx: 2, kind: 'evidence_run' }]);
  });

  it('separates two runs of different kinds', () => {
    const bands = groupSegmentsIntoBands([
      seg(1, 'challenge', 'first_clash'),
      seg(2, 'evidence', 'evidence_run'),
      seg(3, 'evidence', 'evidence_run'),
    ]);
    expect(bands).toEqual([
      { startIdx: 0, endIdx: 0, kind: 'first_clash' },
      { startIdx: 1, endIdx: 2, kind: 'evidence_run' },
    ]);
  });

  it('separates two runs of the same kind that are not contiguous', () => {
    const bands = groupSegmentsIntoBands([
      seg(1, 'evidence', 'evidence_run'),
      seg(2, 'evidence', 'evidence_run'),
      seg(3, 'claim'),
      seg(4, 'evidence', 'evidence_run'),
      seg(5, 'evidence', 'evidence_run'),
    ]);
    expect(bands).toHaveLength(2);
    expect(bands[0].endIdx).toBe(1);
    expect(bands[1].startIdx).toBe(3);
  });

  it('handles an empty segment list without throwing', () => {
    expect(groupSegmentsIntoBands([])).toEqual([]);
  });

  it('keeps a trailing run that reaches the end of the array', () => {
    const bands = groupSegmentsIntoBands([
      seg(1, 'claim'),
      seg(2, 'challenge', 'hot_zone'),
      seg(3, 'challenge', 'hot_zone'),
    ]);
    expect(bands).toEqual([{ startIdx: 1, endIdx: 2, kind: 'hot_zone' }]);
  });
});
