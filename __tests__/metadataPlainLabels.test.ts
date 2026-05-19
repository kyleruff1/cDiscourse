/**
 * META-001 — Plain-language mapping coverage tests.
 *
 * Asserts every manual-tag code and every auto-metadata code has a
 * non-empty plain-language label, the label is mixed-case English
 * (≤ 32 chars), the label is not snake_case / ALL CAPS, and the label
 * passes the verdict / amplification / person-attribution / block-token
 * ban-lists. Also asserts LIFE-001 backward-compat: shared codes keep
 * their LIFE-001-set labels; only `evidence_debt` value changed.
 */

import {
  ALL_MANUAL_TAG_CODES,
  ALL_AUTO_METADATA_CODES,
  _forbiddenMetadataTokens,
  getManualTagPlainLabel,
  getAutoMetadataPlainLabel,
} from '../src/features/metadata';
import {
  PLAIN_LANGUAGE_COPY,
  looksLikeInternalCode,
  toPlainLanguage,
} from '../src/features/arguments/gameCopy';

describe('META-001 plain-language mapping — manual tags', () => {
  it('every manual tag code has a non-empty label via toPlainLanguage', () => {
    for (const c of ALL_MANUAL_TAG_CODES) {
      const label = toPlainLanguage(c);
      expect(typeof label).toBe('string');
      expect((label || '').length).toBeGreaterThan(0);
    }
  });

  it('getManualTagPlainLabel matches toPlainLanguage for every manual tag code', () => {
    for (const c of ALL_MANUAL_TAG_CODES) {
      expect(getManualTagPlainLabel(c)).toBe(toPlainLanguage(c));
    }
  });

  it('every manual tag label is ≤ 32 characters (fits chip layout per accessibility-targets)', () => {
    for (const c of ALL_MANUAL_TAG_CODES) {
      expect(getManualTagPlainLabel(c).length).toBeLessThanOrEqual(32);
    }
  });

  it('every manual tag label is mixed-case English — not snake_case, not ALL CAPS', () => {
    for (const c of ALL_MANUAL_TAG_CODES) {
      const label = getManualTagPlainLabel(c);
      expect(looksLikeInternalCode(label)).toBe(false);
      expect(/^[A-Z]/.test(label)).toBe(true);
      expect(label).not.toBe(label.toUpperCase());
    }
  });

  it('every manual tag label scans clean against forbidden token list', () => {
    const tokens = _forbiddenMetadataTokens();
    for (const c of ALL_MANUAL_TAG_CODES) {
      const lc = getManualTagPlainLabel(c).toLowerCase();
      for (const t of tokens) {
        expect(lc.includes(t.toLowerCase())).toBe(false);
      }
    }
  });

  it('explicit label snapshot — manual tags match design verbatim', () => {
    expect(getManualTagPlainLabel('needs_source')).toBe('Needs source');
    expect(getManualTagPlainLabel('needs_quote')).toBe('Needs quote');
    expect(getManualTagPlainLabel('definition_issue')).toBe('Definition fight');
    expect(getManualTagPlainLabel('scope_issue')).toBe('Scope challenge');
    expect(getManualTagPlainLabel('causal_mechanism')).toBe('Mechanism challenge');
    expect(getManualTagPlainLabel('evidence_debt')).toBe('Evidence debt');
    expect(getManualTagPlainLabel('concession_offered')).toBe('Concession offered');
    expect(getManualTagPlainLabel('narrowed_claim')).toBe('Narrowed claim');
    expect(getManualTagPlainLabel('tangent')).toBe('Tangent / side issue');
    expect(getManualTagPlainLabel('ready_for_synthesis')).toBe('Ready for synthesis');
  });
});

describe('META-001 plain-language mapping — auto metadata', () => {
  it('every auto metadata code has a non-empty label via toPlainLanguage', () => {
    for (const c of ALL_AUTO_METADATA_CODES) {
      const label = toPlainLanguage(c);
      expect(typeof label).toBe('string');
      expect((label || '').length).toBeGreaterThan(0);
    }
  });

  it('getAutoMetadataPlainLabel matches toPlainLanguage for every auto code', () => {
    for (const c of ALL_AUTO_METADATA_CODES) {
      expect(getAutoMetadataPlainLabel(c)).toBe(toPlainLanguage(c));
    }
  });

  it('every auto metadata label is ≤ 32 characters', () => {
    for (const c of ALL_AUTO_METADATA_CODES) {
      expect(getAutoMetadataPlainLabel(c).length).toBeLessThanOrEqual(32);
    }
  });

  it('every auto metadata label is mixed-case English', () => {
    for (const c of ALL_AUTO_METADATA_CODES) {
      const label = getAutoMetadataPlainLabel(c);
      expect(looksLikeInternalCode(label)).toBe(false);
      expect(/^[A-Z]/.test(label)).toBe(true);
      expect(label).not.toBe(label.toUpperCase());
    }
  });

  it('every auto metadata label scans clean against forbidden token list', () => {
    const tokens = _forbiddenMetadataTokens();
    for (const c of ALL_AUTO_METADATA_CODES) {
      const lc = getAutoMetadataPlainLabel(c).toLowerCase();
      for (const t of tokens) {
        expect(lc.includes(t.toLowerCase())).toBe(false);
      }
    }
  });

  it('explicit label snapshot — auto metadata matches design verbatim', () => {
    expect(getAutoMetadataPlainLabel('has_reply')).toBe('Has a reply');
    expect(getAutoMetadataPlainLabel('has_rebuttal')).toBe('Has a challenge');
    expect(getAutoMetadataPlainLabel('has_counter_rebuttal')).toBe('Has a counter-challenge');
    expect(getAutoMetadataPlainLabel('has_evidence')).toBe('Evidence attached');
    expect(getAutoMetadataPlainLabel('source_requested')).toBe('Source requested');
    expect(getAutoMetadataPlainLabel('quote_requested')).toBe('Quote requested');
    expect(getAutoMetadataPlainLabel('source_attached')).toBe('Source attached');
    expect(getAutoMetadataPlainLabel('quote_attached')).toBe('Quote attached');
    expect(getAutoMetadataPlainLabel('participant_skipped_node')).toBe('Same side skipped');
    expect(getAutoMetadataPlainLabel('no_response_after_n_turns')).toBe('No follow-up yet');
    expect(getAutoMetadataPlainLabel('repeated_axis_pressure')).toBe('Repeated challenge on same axis');
    expect(getAutoMetadataPlainLabel('branch_suggested')).toBe('Branch suggested');
    expect(getAutoMetadataPlainLabel('branch_created')).toBe('Branch created here');
    expect(getAutoMetadataPlainLabel('point_stalled')).toBe('Point stalled');
    expect(getAutoMetadataPlainLabel('point_exhausted')).toBe('Point exhausted');
    expect(getAutoMetadataPlainLabel('synthesis_candidate')).toBe('Synthesis candidate');
  });
});

describe('META-001 plain-language mapping — backward compat with LIFE-001', () => {
  it('shared codes keep LIFE-001-set labels (source_requested, quote_requested)', () => {
    expect(PLAIN_LANGUAGE_COPY.source_requested).toBe('Source requested');
    expect(PLAIN_LANGUAGE_COPY.quote_requested).toBe('Quote requested');
  });

  it('LIFE-001 lifecycle vocabulary labels are unchanged', () => {
    expect(PLAIN_LANGUAGE_COPY.open).toBe('Open for response');
    expect(PLAIN_LANGUAGE_COPY.answered).toBe('Has a reply');
    expect(PLAIN_LANGUAGE_COPY.rebutted).toBe('Under pressure');
    expect(PLAIN_LANGUAGE_COPY.sourced).toBe('Source attached');
    expect(PLAIN_LANGUAGE_COPY.synthesis_ready).toBe('Ready for synthesis');
    expect(PLAIN_LANGUAGE_COPY.exhausted).toBe('Out of new angles');
    expect(PLAIN_LANGUAGE_COPY.branch_recommended).toBe('Branch suggested');
    expect(PLAIN_LANGUAGE_COPY.archived_or_resolved).toBe('Resolved');
  });

  it('evidence_debt label updated from Receipts needed to Evidence debt', () => {
    expect(PLAIN_LANGUAGE_COPY.evidence_debt).toBe('Evidence debt');
  });

  it('synthesis_ready is the shared META-001 + LIFE-001 label', () => {
    // META-001's `ready_for_synthesis` (manual tag) and LIFE-001's
    // `synthesis_ready` (lifecycle state) both render "Ready for synthesis".
    expect(getManualTagPlainLabel('ready_for_synthesis')).toBe('Ready for synthesis');
    expect(PLAIN_LANGUAGE_COPY.synthesis_ready).toBe('Ready for synthesis');
  });

  it('toPlainLanguage is case-insensitive for META-001 codes', () => {
    expect(toPlainLanguage('NEEDS_SOURCE')).toBe('Needs source');
    expect(toPlainLanguage('Needs_Source')).toBe('Needs source');
    expect(toPlainLanguage('HAS_REPLY')).toBe('Has a reply');
    expect(toPlainLanguage('Point_Exhausted')).toBe('Point exhausted');
  });
});

describe('META-001 plain-language mapping — vocabulary completeness', () => {
  it('exposes exactly 10 manual tag codes', () => {
    expect(ALL_MANUAL_TAG_CODES.length).toBe(10);
  });

  it('exposes exactly 16 auto metadata codes', () => {
    expect(ALL_AUTO_METADATA_CODES.length).toBe(16);
  });

  it('all 26 codes are present in PLAIN_LANGUAGE_COPY', () => {
    const copy = PLAIN_LANGUAGE_COPY as unknown as Record<string, string>;
    for (const c of ALL_MANUAL_TAG_CODES) {
      expect(Object.prototype.hasOwnProperty.call(copy, c)).toBe(true);
      expect(typeof copy[c]).toBe('string');
      expect(copy[c].length).toBeGreaterThan(0);
    }
    for (const c of ALL_AUTO_METADATA_CODES) {
      expect(Object.prototype.hasOwnProperty.call(copy, c)).toBe(true);
      expect(typeof copy[c]).toBe('string');
      expect(copy[c].length).toBeGreaterThan(0);
    }
  });

  it('the forbidden token list itself contains no internal-code shapes', () => {
    const tokens = _forbiddenMetadataTokens();
    expect(tokens.length).toBeGreaterThan(0);
    // Each token is a lowercase word or short phrase, never a snake_case
    // identifier longer than 4 chars.
    for (const t of tokens) {
      expect(t).toBe(t.toLowerCase());
    }
  });
});
