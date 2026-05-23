/**
 * QOL-041 — Active-disagreement derivation pure-model tests.
 *
 * Per QOL-041 design §10 test plan:
 *   - storyboard Step 8 case: agree + disagree_fact → `fact`
 *   - all-agree → `none`
 *   - all-agree/agree_with_caveat → `none`
 *   - fact > context > framing precedence
 *   - newest-argument-wins (older arguments are ignored)
 *
 * Pure TS. No React. No Supabase.
 */
import {
  deriveActiveDisagreement,
  activeDisagreementLabel,
  ACTIVE_DISAGREEMENT_LABEL,
  ALL_ACTIVE_DISAGREEMENT_KINDS,
  type ConcessionAcceptanceRow,
} from '../src/features/concessions/activeDisagreement';

// ── Helpers ────────────────────────────────────────────────────

function row(
  argumentId: string,
  level: ConcessionAcceptanceRow['acceptanceLevel'],
): ConcessionAcceptanceRow {
  return { argumentId, acceptanceLevel: level };
}

// ── ALL_ACTIVE_DISAGREEMENT_KINDS ──────────────────────────────

describe('ALL_ACTIVE_DISAGREEMENT_KINDS', () => {
  it('contains exactly the 4 design §5.3 kinds', () => {
    expect(ALL_ACTIVE_DISAGREEMENT_KINDS).toEqual(['none', 'framing', 'context', 'fact']);
  });

  it('every kind has a plain-language label', () => {
    for (const kind of ALL_ACTIVE_DISAGREEMENT_KINDS) {
      expect(ACTIVE_DISAGREEMENT_LABEL[kind]).toBeDefined();
      expect(ACTIVE_DISAGREEMENT_LABEL[kind].length).toBeGreaterThan(0);
    }
  });
});

// ── deriveActiveDisagreement — base cases ─────────────────────

describe('deriveActiveDisagreement — base cases', () => {
  it('empty input → none', () => {
    expect(deriveActiveDisagreement([])).toBe('none');
  });

  it('single all-agree set → none', () => {
    expect(deriveActiveDisagreement([row('a1', 'agree')])).toBe('none');
  });

  it('single all-agree-with-caveat set → none (caveat is a rider, not a dispute)', () => {
    // Per §5.3 rule 2: agree_with_caveat does NOT raise an axis.
    const out = deriveActiveDisagreement([row('a1', 'agree_with_caveat')]);
    expect(out).toBe('none');
  });

  it('mixed agree + agree_with_caveat → none', () => {
    const out = deriveActiveDisagreement([
      row('a1', 'agree'),
      row('a1', 'agree_with_caveat'),
    ]);
    expect(out).toBe('none');
  });
});

// ── deriveActiveDisagreement — storyboard Step 8 ──────────────

describe('deriveActiveDisagreement — storyboard §3 Step 8 case', () => {
  it('agree + disagree_fact → `fact` (the most material axis)', () => {
    // A: row 1 = agree, row 2 = disagree_fact (storyboard Step 8).
    const out = deriveActiveDisagreement([
      row('a1', 'agree'),
      row('a1', 'disagree_fact'),
    ]);
    expect(out).toBe('fact');
  });
});

// ── deriveActiveDisagreement — precedence ─────────────────────

describe('deriveActiveDisagreement — fact > context > framing precedence', () => {
  it('disagree_fact alone → fact', () => {
    expect(deriveActiveDisagreement([row('a1', 'disagree_fact')])).toBe('fact');
  });

  it('disagree_context alone → context', () => {
    expect(deriveActiveDisagreement([row('a1', 'disagree_context')])).toBe('context');
  });

  it('disagree_framing alone → framing', () => {
    expect(deriveActiveDisagreement([row('a1', 'disagree_framing')])).toBe('framing');
  });

  it('framing + fact → fact', () => {
    const out = deriveActiveDisagreement([
      row('a1', 'disagree_framing'),
      row('a1', 'disagree_fact'),
    ]);
    expect(out).toBe('fact');
  });

  it('context + framing → context', () => {
    const out = deriveActiveDisagreement([
      row('a1', 'disagree_framing'),
      row('a1', 'disagree_context'),
    ]);
    expect(out).toBe('context');
  });

  it('fact + context + framing → fact', () => {
    const out = deriveActiveDisagreement([
      row('a1', 'disagree_framing'),
      row('a1', 'disagree_context'),
      row('a1', 'disagree_fact'),
    ]);
    expect(out).toBe('fact');
  });
});

// ── deriveActiveDisagreement — newest-argument-wins ───────────

describe('deriveActiveDisagreement — newest-argument-wins', () => {
  it('older argument with disagree_fact is IGNORED if newest is all-agree', () => {
    // Caller passes NEWEST-FIRST: a2 (newest) has only agree rows; a1
    // (older) had disagree_fact. The derivation should follow the
    // newest argument only.
    const out = deriveActiveDisagreement([
      row('a2', 'agree'), // newest
      row('a1', 'disagree_fact'),
    ]);
    expect(out).toBe('none');
  });

  it('newest argument with disagree_framing OVERRIDES older disagree_fact', () => {
    const out = deriveActiveDisagreement([
      row('a2', 'disagree_framing'), // newest
      row('a1', 'disagree_fact'),
    ]);
    expect(out).toBe('framing');
  });

  it('multiple newest-argument rows are all considered (prefix-of-same-argumentId)', () => {
    const out = deriveActiveDisagreement([
      row('a2', 'agree'),
      row('a2', 'agree_with_caveat'),
      row('a2', 'disagree_fact'), // still part of a2 — picks fact
      row('a1', 'disagree_framing'),
    ]);
    expect(out).toBe('fact');
  });
});

// ── activeDisagreementLabel ────────────────────────────────────

describe('activeDisagreementLabel', () => {
  it('returns the plain-language string for every kind', () => {
    for (const kind of ALL_ACTIVE_DISAGREEMENT_KINDS) {
      expect(activeDisagreementLabel(kind)).toBe(ACTIVE_DISAGREEMENT_LABEL[kind]);
    }
  });
});
