/**
 * QOL-041 — Acceptance gradient pure-model tests.
 *
 * Per QOL-041 design §10 test plan:
 *   - the 5-level enum is exactly the taxonomy set
 *   - acceptanceRequiresClarification true for all four non-`agree`
 *     levels, false for `agree`
 *   - ACCEPTANCE_TO_CONCESSION_EFFECT maps every level and only to
 *     known ConcessionEffect families
 *
 * Pure TS. No React. No Supabase.
 */
import {
  ALL_ACCEPTANCE_LEVELS,
  ACCEPTANCE_LEVEL_COPY,
  ACCEPTANCE_TO_CONCESSION_EFFECT,
  acceptanceRequiresClarification,
  _forbiddenAcceptanceGradientTokens,
  type AcceptanceLevel,
} from '../src/features/concessions/acceptanceGradient';
import { CONCESSION_EFFECT_WEIGHTS } from '../src/features/pointStanding/concessionEffects';

// ── The 5-level enum ───────────────────────────────────────────

describe('ALL_ACCEPTANCE_LEVELS — the vocabulary', () => {
  it('contains exactly 5 levels in the design-§7.2 order', () => {
    expect(ALL_ACCEPTANCE_LEVELS).toEqual([
      'agree',
      'agree_with_caveat',
      'disagree_framing',
      'disagree_context',
      'disagree_fact',
    ]);
    expect(ALL_ACCEPTANCE_LEVELS).toHaveLength(5);
  });

  it('is frozen — the vocabulary cannot drift at runtime', () => {
    expect(Object.isFrozen(ALL_ACCEPTANCE_LEVELS)).toBe(true);
  });
});

// ── Plain-language copy ────────────────────────────────────────

describe('ACCEPTANCE_LEVEL_COPY — plain-language map', () => {
  it('has an entry for every level', () => {
    for (const level of ALL_ACCEPTANCE_LEVELS) {
      expect(ACCEPTANCE_LEVEL_COPY[level]).toBeDefined();
      expect(ACCEPTANCE_LEVEL_COPY[level].label.length).toBeGreaterThan(0);
      expect(ACCEPTANCE_LEVEL_COPY[level].helper.length).toBeGreaterThan(0);
    }
  });

  it('every label is ≤ 32 chars (segment + chip budget)', () => {
    for (const level of ALL_ACCEPTANCE_LEVELS) {
      expect(ACCEPTANCE_LEVEL_COPY[level].label.length).toBeLessThanOrEqual(32);
    }
  });

  it('every helper line is ≤ 80 chars (a11y label budget)', () => {
    for (const level of ALL_ACCEPTANCE_LEVELS) {
      expect(ACCEPTANCE_LEVEL_COPY[level].helper.length).toBeLessThanOrEqual(80);
    }
  });

  it('uses the verbatim labels from design §7.2', () => {
    expect(ACCEPTANCE_LEVEL_COPY.agree.label).toBe('Agree');
    expect(ACCEPTANCE_LEVEL_COPY.agree_with_caveat.label).toBe('Agree with caveat');
    expect(ACCEPTANCE_LEVEL_COPY.disagree_framing.label).toBe('Disagree based on framing');
    expect(ACCEPTANCE_LEVEL_COPY.disagree_context.label).toBe('Disagree based on context');
    expect(ACCEPTANCE_LEVEL_COPY.disagree_fact.label).toBe('Disagree based on fact');
  });
});

// ── acceptanceRequiresClarification ────────────────────────────

describe('acceptanceRequiresClarification — F3 conditional', () => {
  it('returns false ONLY for agree', () => {
    expect(acceptanceRequiresClarification('agree')).toBe(false);
  });

  it('returns true for every non-agree level', () => {
    const nonAgree: AcceptanceLevel[] = [
      'agree_with_caveat',
      'disagree_framing',
      'disagree_context',
      'disagree_fact',
    ];
    for (const level of nonAgree) {
      expect(acceptanceRequiresClarification(level)).toBe(true);
    }
  });

  it('exhausts the union (every level produces a boolean)', () => {
    for (const level of ALL_ACCEPTANCE_LEVELS) {
      const v = acceptanceRequiresClarification(level);
      expect(typeof v).toBe('boolean');
    }
  });
});

// ── Vocabulary bridge → ConcessionEffect ───────────────────────

describe('ACCEPTANCE_TO_CONCESSION_EFFECT — the vocabulary bridge', () => {
  it('maps every level', () => {
    for (const level of ALL_ACCEPTANCE_LEVELS) {
      expect(ACCEPTANCE_TO_CONCESSION_EFFECT[level]).toBeDefined();
    }
  });

  it('maps every level to a KNOWN ConcessionEffect (the shipped enum)', () => {
    // The 6 shipped ConcessionEffect values, taken from the imported
    // weights table — drift here means the bridge is pointing at a
    // value the engine no longer has.
    const knownEffects = new Set(Object.keys(CONCESSION_EFFECT_WEIGHTS));
    for (const level of ALL_ACCEPTANCE_LEVELS) {
      expect(knownEffects.has(ACCEPTANCE_TO_CONCESSION_EFFECT[level])).toBe(true);
    }
  });

  it('maps agree + agree_with_caveat to the same explicit family', () => {
    // Per design §4: the caveat is a rider, not a fresh ConcessionEffect.
    expect(ACCEPTANCE_TO_CONCESSION_EFFECT.agree).toBe(
      ACCEPTANCE_TO_CONCESSION_EFFECT.agree_with_caveat,
    );
  });

  it('maps every non-agree disagree level to the performative family', () => {
    // Per design §4: the offered concession did not function as a repair.
    expect(ACCEPTANCE_TO_CONCESSION_EFFECT.disagree_framing).toBe(
      'performative_concession_no_repair',
    );
    expect(ACCEPTANCE_TO_CONCESSION_EFFECT.disagree_context).toBe(
      'performative_concession_no_repair',
    );
    expect(ACCEPTANCE_TO_CONCESSION_EFFECT.disagree_fact).toBe(
      'performative_concession_no_repair',
    );
  });

  it('the bridge contains NO numeric / delta value', () => {
    // QOL-041 stores level + clarification only. The bridge is a label
    // map, not a scoreboard. Per design §4 doctrine guard.
    for (const level of ALL_ACCEPTANCE_LEVELS) {
      expect(typeof ACCEPTANCE_TO_CONCESSION_EFFECT[level]).toBe('string');
    }
  });
});

// ── Ban-list ───────────────────────────────────────────────────

describe('_forbiddenAcceptanceGradientTokens — doctrine guard', () => {
  it('returns a non-empty all-lowercase list', () => {
    const list = _forbiddenAcceptanceGradientTokens();
    expect(list.length).toBeGreaterThan(0);
    for (const t of list) expect(t).toBe(t.toLowerCase());
  });

  it('contains the QOL-041 §10 / §11 must-block tokens', () => {
    const list = _forbiddenAcceptanceGradientTokens();
    expect(list).toContain('winner');
    expect(list).toContain('loser');
    expect(list).toContain('liar');
    expect(list).toContain('verdict');
    expect(list).toContain('truth');
    expect(list).toContain('correct');
    expect(list).toContain('game');
  });
});
