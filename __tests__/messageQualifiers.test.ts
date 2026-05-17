/**
 * Stage 6.1.5.1 — Message qualifier taxonomy tests.
 *
 * Pure-TS unit tests. No network. We assert:
 *  - Categories derive correctly from argument_type + body + flags.
 *  - Qualifiers derive correctly from axis + body lexemes + mixed flags +
 *    point-standing signals.
 *  - Primary qualifier picks the most informative single signal.
 *  - Labels are human-readable.
 *  - No label or nudge contains forbidden verdict tokens
 *    (winner / loser / truth / verdict / liar / dishonest / bad faith /
 *    manipulative / manipulation / extremist / propagandist).
 */

import {
  deriveMessageCategory,
  deriveMessageQualifiers,
  derivePrimaryQualifier,
  formatCategoryLabel,
  formatQualifierLabel,
  getQualifierUiNudge,
  _forbiddenVerdictTokens,
} from '../src/features/arguments/messageQualifiers';
import type { MessageCategory, MessageQualifier } from '../src/features/arguments/messageQualifiers';

describe('deriveMessageCategory', () => {
  it('thesis / claim → claim', () => {
    expect(deriveMessageCategory({ argumentType: 'thesis' })).toBe('claim');
    expect(deriveMessageCategory({ argumentType: 'claim' })).toBe('claim');
  });
  it('rebuttal / counter_rebuttal → challenge', () => {
    expect(deriveMessageCategory({ argumentType: 'rebuttal' })).toBe('challenge');
    expect(deriveMessageCategory({ argumentType: 'counter_rebuttal' })).toBe('challenge');
  });
  it('evidence → evidence', () => {
    expect(deriveMessageCategory({ argumentType: 'evidence' })).toBe('evidence');
  });
  it('clarification_request with receipt language → receipt_request', () => {
    expect(deriveMessageCategory({
      argumentType: 'clarification_request',
      body: 'Where is this from? Receipts, please.',
    })).toBe('receipt_request');
  });
  it('clarification_request with quote language → quote_request', () => {
    expect(deriveMessageCategory({
      argumentType: 'clarification_request',
      body: 'Quote the exact bit. Which part exactly?',
    })).toBe('quote_request');
  });
  it('clarification_request neutral → clarification', () => {
    expect(deriveMessageCategory({
      argumentType: 'clarification_request',
      body: 'Are you arguing about the late innings or the early ones?',
    })).toBe('clarification');
  });
  it('concession → concession', () => {
    expect(deriveMessageCategory({ argumentType: 'concession' })).toBe('concession');
  });
  it('synthesis → synthesis', () => {
    expect(deriveMessageCategory({ argumentType: 'synthesis' })).toBe('synthesis');
  });
  it('mixed-agreement flags → mixed_agreement (only if no concrete type wins)', () => {
    expect(deriveMessageCategory({
      argumentType: 'claim',
      mixedFlags: { mixedAgreementClass: 'broad_accept_narrow_decline' } as never,
    })).toBe('claim'); // explicit claim type wins
    expect(deriveMessageCategory({
      argumentType: null,
      mixedFlags: { mixedAgreementClass: 'broad_accept_narrow_decline' } as never,
    })).toBe('mixed_agreement');
  });
  it('tangent_or_joke override → tangent', () => {
    expect(deriveMessageCategory({
      argumentType: 'rebuttal',
      mixedFlags: { mixedAgreementClass: 'tangent_or_joke' } as never,
    })).toBe('tangent');
  });
  it('unresolved point-standing debt → unresolved_pressure', () => {
    expect(deriveMessageCategory({
      argumentType: 'rebuttal',
      pointStanding: { hasUnresolvedDebt: true, isRepairAttempt: false },
    })).toBe('unresolved_pressure');
  });
  it('repair signal → repair', () => {
    expect(deriveMessageCategory({
      argumentType: 'concession',
      pointStanding: { isRepairAttempt: true },
    })).toBe('repair');
  });
});

describe('deriveMessageQualifiers — axis', () => {
  for (const axis of ['fact', 'definition', 'causal', 'value', 'evidence', 'logic', 'scope'] as const) {
    it(`rebuttal with axis=${axis} produces ${axis}_challenge`, () => {
      const q = deriveMessageQualifiers({ argumentType: 'rebuttal', disagreementAxis: axis });
      expect(q).toContain(`${axis}_challenge` as MessageQualifier);
    });
  }
});

describe('deriveMessageQualifiers — body lexemes', () => {
  it('"source for that?" → ask_receipts', () => {
    expect(deriveMessageQualifiers({ argumentType: 'clarification_request', body: 'Source for that?' }))
      .toContain('ask_receipts');
  });
  it('"quote the exact" or targetExcerpt → quote_exact_bit', () => {
    expect(deriveMessageQualifiers({ argumentType: 'clarification_request', body: 'Quote the exact bit.' }))
      .toContain('quote_exact_bit');
    expect(deriveMessageQualifiers({ argumentType: 'rebuttal', targetExcerpt: 'late innings', body: '' }))
      .toContain('quote_exact_bit');
  });
  it('axis=definition or "define X" → define_term', () => {
    expect(deriveMessageQualifiers({ argumentType: 'rebuttal', disagreementAxis: 'definition' }))
      .toContain('define_term');
    expect(deriveMessageQualifiers({ argumentType: 'clarification_request', body: 'Define successful first.' }))
      .toContain('define_term');
  });
  it('axis=scope or "too broad" → narrow_scope', () => {
    expect(deriveMessageQualifiers({ argumentType: 'rebuttal', disagreementAxis: 'scope' }))
      .toContain('narrow_scope');
    expect(deriveMessageQualifiers({ argumentType: 'rebuttal', body: 'That is too broad. Narrow the claim.' }))
      .toContain('narrow_scope');
  });
  it('"counterexample" → counterexample', () => {
    expect(deriveMessageQualifiers({ argumentType: 'rebuttal', body: 'Counterexample: the diner with a huge menu.' }))
      .toContain('counterexample');
  });
  it('"speaking of, off topic" → branch_this_off', () => {
    expect(deriveMessageQualifiers({ argumentType: 'claim', body: 'Speaking of, off topic — parking is bad.' }))
      .toContain('branch_this_off');
  });
});

describe('deriveMessageQualifiers — mixed-agreement class', () => {
  it('broad_accept_narrow_decline class → both class qualifier and mixed_agree_disagree', () => {
    const q = deriveMessageQualifiers({
      argumentType: 'rebuttal',
      mixedFlags: { mixedAgreementClass: 'broad_accept_narrow_decline', broadAcceptor: true, narrowDecliner: true } as never,
    });
    expect(q).toContain('broad_accept_narrow_decline');
    expect(q).toContain('mixed_agree_disagree');
  });
  it('tangent_or_joke class → tangent_or_joke', () => {
    expect(deriveMessageQualifiers({
      argumentType: 'claim',
      mixedFlags: { mixedAgreementClass: 'tangent_or_joke' } as never,
    })).toContain('tangent_or_joke');
  });
});

describe('deriveMessageQualifiers — concession shape', () => {
  it('concession + broadAcceptor + narrowDecliner → concede_small_point', () => {
    expect(deriveMessageQualifiers({
      argumentType: 'concession',
      mixedFlags: { broadAcceptor: true, narrowDecliner: true } as never,
    })).toContain('concede_small_point');
  });
  it('concession + broadDecliner → concede_broad_point', () => {
    expect(deriveMessageQualifiers({
      argumentType: 'concession',
      mixedFlags: { broadDecliner: true } as never,
    })).toContain('concede_broad_point');
  });
  it('synthesis with "open question" body → synthesize_open_question', () => {
    expect(deriveMessageQualifiers({
      argumentType: 'synthesis',
      body: 'I acknowledge the open question is whether scope generalizes.',
    })).toContain('synthesize_open_question');
  });
  it('synthesis default → synthesize_agreement', () => {
    expect(deriveMessageQualifiers({
      argumentType: 'synthesis',
      body: 'I acknowledge both sides converged on the late-inning point.',
    })).toContain('synthesize_agreement');
  });
});

describe('deriveMessageQualifiers — point-standing signals', () => {
  it('unresolved debt → unresolved_debt', () => {
    expect(deriveMessageQualifiers({
      argumentType: 'rebuttal',
      pointStanding: { hasUnresolvedDebt: true },
    })).toContain('unresolved_debt');
  });
  it('repair attempt → repair_attempt', () => {
    expect(deriveMessageQualifiers({
      argumentType: 'concession',
      pointStanding: { isRepairAttempt: true },
    })).toContain('repair_attempt');
  });
  it('evasion possible → evasion_possible', () => {
    expect(deriveMessageQualifiers({
      argumentType: 'claim',
      pointStanding: { isEvasionPossible: true },
    })).toContain('evasion_possible');
  });
});

describe('derivePrimaryQualifier', () => {
  it('picks class-level over axis-level', () => {
    const q = derivePrimaryQualifier({
      argumentType: 'rebuttal',
      disagreementAxis: 'scope',
      mixedFlags: { mixedAgreementClass: 'broad_accept_narrow_decline', broadAcceptor: true, narrowDecliner: true } as never,
    });
    expect(q).toBe('broad_accept_narrow_decline');
  });
  it('picks tactic over axis when class is absent', () => {
    const q = derivePrimaryQualifier({
      argumentType: 'rebuttal',
      disagreementAxis: 'scope',
      body: 'Receipts, please. Where is this from?',
    });
    expect(q).toBe('ask_receipts');
  });
  it('returns null when no signals are present', () => {
    expect(derivePrimaryQualifier({ argumentType: 'thesis' })).toBe(null);
  });
});

describe('label and nudge text', () => {
  const sampleCategories: MessageCategory[] = [
    'claim', 'challenge', 'evidence', 'clarification', 'concession', 'synthesis',
    'receipt_request', 'quote_request', 'mixed_agreement', 'branch_candidate',
    'tangent', 'repair', 'unresolved_pressure',
  ];
  const sampleQualifiers: MessageQualifier[] = [
    'fact_challenge', 'definition_challenge', 'causal_challenge', 'value_challenge',
    'evidence_challenge', 'logic_challenge', 'scope_challenge', 'ask_receipts',
    'quote_exact_bit', 'narrow_scope', 'define_term', 'counterexample',
    'concede_small_point', 'concede_broad_point', 'synthesize_agreement',
    'synthesize_open_question', 'branch_this_off', 'mixed_agree_disagree',
    'broad_accept_narrow_decline', 'narrow_accept_broad_decline', 'pure_accept',
    'pure_decline', 'tangent_or_joke', 'unresolved_debt', 'repair_attempt',
    'evasion_possible',
  ];

  it('every category has a non-empty human label', () => {
    for (const c of sampleCategories) {
      expect(formatCategoryLabel(c).length).toBeGreaterThan(0);
    }
  });

  it('every qualifier has a non-empty human label', () => {
    for (const q of sampleQualifiers) {
      expect(formatQualifierLabel(q).length).toBeGreaterThan(0);
    }
  });

  it('every qualifier has a non-empty UI nudge', () => {
    for (const q of sampleQualifiers) {
      expect(getQualifierUiNudge(q).length).toBeGreaterThan(0);
    }
  });

  it('NO label or nudge contains a forbidden verdict token', () => {
    const blob = [
      ...sampleCategories.map(formatCategoryLabel),
      ...sampleQualifiers.map(formatQualifierLabel),
      ...sampleQualifiers.map(getQualifierUiNudge),
    ].join(' ').toLowerCase();
    for (const banned of _forbiddenVerdictTokens()) {
      expect(blob).not.toContain(banned);
    }
  });
});
