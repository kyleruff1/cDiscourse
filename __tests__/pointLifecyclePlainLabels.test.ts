/**
 * LIFE-001 — Plain-language mapping coverage tests.
 *
 * Asserts every lifecycle state has a non-empty plain-language label, the
 * label is mixed-case English (≤ 32 chars), and the label passes the
 * verdict / amplification / person-attribution ban-lists.
 */

import {
  ALL_POINT_LIFECYCLE_STATES,
  _forbiddenLifecycleTokens,
  getPointLifecyclePlainLabel,
} from '../src/features/lifecycle';
import {
  looksLikeInternalCode,
  toPlainLanguage,
  PLAIN_LANGUAGE_COPY,
} from '../src/features/arguments/gameCopy';

describe('LIFE-001 plain-language mapping', () => {
  it('every lifecycle state has a non-empty label via toPlainLanguage', () => {
    for (const s of ALL_POINT_LIFECYCLE_STATES) {
      const label = toPlainLanguage(s);
      expect(typeof label).toBe('string');
      expect((label || '').length).toBeGreaterThan(0);
    }
  });

  it('getPointLifecyclePlainLabel matches toPlainLanguage for every state', () => {
    for (const s of ALL_POINT_LIFECYCLE_STATES) {
      const helper = getPointLifecyclePlainLabel(s);
      const direct = toPlainLanguage(s);
      expect(helper).toBe(direct);
    }
  });

  it('every label is ≤ 32 characters (fits chip layout per accessibility-targets)', () => {
    for (const s of ALL_POINT_LIFECYCLE_STATES) {
      const label = getPointLifecyclePlainLabel(s);
      expect(label.length).toBeLessThanOrEqual(32);
    }
  });

  it('every label is mixed-case English — not snake_case, not ALL CAPS', () => {
    for (const s of ALL_POINT_LIFECYCLE_STATES) {
      const label = getPointLifecyclePlainLabel(s);
      expect(looksLikeInternalCode(label)).toBe(false);
      // Has at least one uppercase letter at the start.
      expect(/^[A-Z]/.test(label)).toBe(true);
      // Does not look like ALL CAPS.
      expect(label).not.toBe(label.toUpperCase());
    }
  });

  it('synthesis_ready label is "Ready for synthesis" (LIFE-001 updated)', () => {
    expect(toPlainLanguage('synthesis_ready')).toBe('Ready for synthesis');
    expect(getPointLifecyclePlainLabel('synthesis_ready')).toBe('Ready for synthesis');
  });

  it('every label scans clean against the forbidden token list', () => {
    const tokens = _forbiddenLifecycleTokens();
    for (const s of ALL_POINT_LIFECYCLE_STATES) {
      const lc = getPointLifecyclePlainLabel(s).toLowerCase();
      for (const t of tokens) {
        expect(lc.includes(t.toLowerCase())).toBe(false);
      }
    }
  });

  it('backward compat — existing non-lifecycle codes still map', () => {
    expect(PLAIN_LANGUAGE_COPY['source_chain']).toBe('Source trail');
    // META-001 updated this label from 'Receipts needed' to 'Evidence debt'
    // to match the manual-tag vocabulary verbatim. The pipeline reads the
    // code, not the label, so no runner-side regression.
    expect(PLAIN_LANGUAGE_COPY['evidence_debt']).toBe('Evidence debt');
    expect(PLAIN_LANGUAGE_COPY['synthesis']).toBe('Resolved');
    expect(PLAIN_LANGUAGE_COPY['concession']).toBe('Conceded');
    expect(PLAIN_LANGUAGE_COPY['observer']).toBe('Watching');
    expect(PLAIN_LANGUAGE_COPY['moderator']).toBe('Observer');
  });

  it('all 18 + archived lifecycle states are present in PLAIN_LANGUAGE_COPY', () => {
    const copy = PLAIN_LANGUAGE_COPY as unknown as Record<string, string>;
    for (const s of ALL_POINT_LIFECYCLE_STATES) {
      expect(Object.prototype.hasOwnProperty.call(copy, s)).toBe(true);
      expect(typeof copy[s]).toBe('string');
      expect(copy[s].length).toBeGreaterThan(0);
    }
  });

  it('explicit label snapshot — labels match the LIFE-001 design verbatim', () => {
    expect(getPointLifecyclePlainLabel('open')).toBe('Open for response');
    expect(getPointLifecyclePlainLabel('answered')).toBe('Has a reply');
    expect(getPointLifecyclePlainLabel('rebutted')).toBe('Under pressure');
    expect(getPointLifecyclePlainLabel('clarified')).toBe('Clarified');
    expect(getPointLifecyclePlainLabel('sourced')).toBe('Source attached');
    expect(getPointLifecyclePlainLabel('quote_requested')).toBe('Quote requested');
    expect(getPointLifecyclePlainLabel('source_requested')).toBe('Source requested');
    expect(getPointLifecyclePlainLabel('narrowed')).toBe('Narrowed');
    expect(getPointLifecyclePlainLabel('conceded')).toBe('Conceded by author');
    expect(getPointLifecyclePlainLabel('confirmed')).toBe('Confirmed by other side');
    expect(getPointLifecyclePlainLabel('synthesis_ready')).toBe('Ready for synthesis');
    expect(getPointLifecyclePlainLabel('moved_on_by_affirmative')).toBe('Affirmative moved on');
    expect(getPointLifecyclePlainLabel('moved_on_by_negative')).toBe('Negative moved on');
    expect(getPointLifecyclePlainLabel('ignored_by_affirmative')).toBe('Affirmative did not respond');
    expect(getPointLifecyclePlainLabel('ignored_by_negative')).toBe('Negative did not respond');
    expect(getPointLifecyclePlainLabel('ignored_by_both')).toBe('Nobody followed up');
    expect(getPointLifecyclePlainLabel('exhausted')).toBe('Out of new angles');
    expect(getPointLifecyclePlainLabel('branch_recommended')).toBe('Branch suggested');
    expect(getPointLifecyclePlainLabel('archived_or_resolved')).toBe('Resolved');
  });

  it('toPlainLanguage is case-insensitive over lifecycle codes', () => {
    expect(toPlainLanguage('OPEN')).toBe('Open for response');
    expect(toPlainLanguage('Open')).toBe('Open for response');
    expect(toPlainLanguage('moved_on_by_AFFIRMATIVE')).toBe('Affirmative moved on');
  });
});
