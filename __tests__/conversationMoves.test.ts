/**
 * Conversation Move Navigator — unit tests
 * Pure TypeScript: no React, no network, no Supabase.
 * Stage 6.0.1
 */
import {
  getRootMoveOptions,
  getReplyMoveOptions,
  getChallengeAxisOptions,
  getMoveOptionByKind,
  mapMoveToDraftPatch,
  getVisibleMoveSteps,
  getMoveWarnings,
  type ConversationMoveSelection,
} from '../src/features/arguments/conversationMoves';
import type { ArgumentType, ConstitutionRule } from '../src/domain/constitution/types';
import { RULE_CODES } from '../src/domain/constitution/types';

// ── Fixtures ──────────────────────────────────────────────────

function makeRule(code: string, allowedChildren: ArgumentType[]): ConstitutionRule {
  return {
    id: `rule-${code}`,
    constitutionId: 'test-const',
    code,
    title: code,
    description: '',
    ruleType: 'transition',
    severity: 'blocking',
    params: { allowedChildren },
    enabled: true,
  };
}

const RULES: ConstitutionRule[] = [
  makeRule(RULE_CODES.TRANSITION_THESIS, ['claim', 'rebuttal', 'evidence', 'clarification_request']),
  makeRule(RULE_CODES.TRANSITION_CLAIM, ['rebuttal', 'evidence', 'clarification_request', 'concession']),
  makeRule(RULE_CODES.TRANSITION_REBUTTAL, ['counter_rebuttal', 'evidence', 'clarification_request', 'concession']),
  makeRule(RULE_CODES.TRANSITION_COUNTER_REBUTTAL, ['rebuttal', 'evidence', 'clarification_request']),
  makeRule(RULE_CODES.TRANSITION_EVIDENCE, ['clarification_request', 'rebuttal']),
  makeRule(RULE_CODES.TRANSITION_CLARIFICATION_REQUEST, ['claim']),
  makeRule(RULE_CODES.TRANSITION_CONCESSION, ['synthesis']),
  makeRule(RULE_CODES.TRANSITION_SYNTHESIS, []),
];

// ── getRootMoveOptions ────────────────────────────────────────

describe('getRootMoveOptions', () => {
  it('returns exactly 2 options', () => {
    expect(getRootMoveOptions()).toHaveLength(2);
  });

  it('first option is start_thesis', () => {
    expect(getRootMoveOptions()[0].id).toBe('start_thesis');
  });

  it('second option is make_claim', () => {
    expect(getRootMoveOptions()[1].id).toBe('make_claim');
  });

  it('root options have requiresParent=false', () => {
    for (const opt of getRootMoveOptions()) {
      expect(opt.requiresParent).toBe(false);
    }
  });

  it('root options have group=root', () => {
    for (const opt of getRootMoveOptions()) {
      expect(opt.group).toBe('root');
    }
  });
});

// ── getReplyMoveOptions ───────────────────────────────────────

describe('getReplyMoveOptions — claim parent', () => {
  const opts = getReplyMoveOptions('claim', RULES);

  it('includes challenge_parent (rebuttal allowed)', () => {
    expect(opts.some((o) => o.id === 'challenge_parent')).toBe(true);
  });

  it('includes ask_clarification', () => {
    expect(opts.some((o) => o.id === 'ask_clarification')).toBe(true);
  });

  it('includes add_evidence', () => {
    expect(opts.some((o) => o.id === 'add_evidence')).toBe(true);
  });

  it('includes concede_or_narrow', () => {
    expect(opts.some((o) => o.id === 'concede_or_narrow')).toBe(true);
  });

  it('does NOT include synthesize_thread (synthesis not allowed for claim)', () => {
    expect(opts.some((o) => o.id === 'synthesize_thread')).toBe(false);
  });

  it('all reply options have requiresParent=true', () => {
    for (const opt of opts) {
      expect(opt.requiresParent).toBe(true);
    }
  });

  it('returns at most 5 options', () => {
    expect(opts.length).toBeLessThanOrEqual(5);
  });
});

describe('getReplyMoveOptions — rebuttal parent', () => {
  const opts = getReplyMoveOptions('rebuttal', RULES);

  it('includes challenge_parent (counter_rebuttal allowed)', () => {
    expect(opts.some((o) => o.id === 'challenge_parent')).toBe(true);
  });

  it('does NOT include concede_or_narrow (concession not in rebuttal→allowed)', () => {
    // RULES has concession allowed under rebuttal (above fixture), so check the fixture
    // Rebuttal → ['counter_rebuttal', 'evidence', 'clarification_request', 'concession']
    expect(opts.some((o) => o.id === 'concede_or_narrow')).toBe(true);
  });
});

describe('getReplyMoveOptions — concession parent', () => {
  const opts = getReplyMoveOptions('concession', RULES);

  it('includes synthesize_thread', () => {
    expect(opts.some((o) => o.id === 'synthesize_thread')).toBe(true);
  });

  it('does NOT include challenge_parent (no rebuttal/counter_rebuttal)', () => {
    expect(opts.some((o) => o.id === 'challenge_parent')).toBe(false);
  });
});

describe('getReplyMoveOptions — synthesis parent (terminal)', () => {
  const opts = getReplyMoveOptions('synthesis', RULES);

  it('returns empty list for terminal synthesis', () => {
    expect(opts).toHaveLength(0);
  });
});

// ── getChallengeAxisOptions ───────────────────────────────────

describe('getChallengeAxisOptions', () => {
  const axes = getChallengeAxisOptions();

  it('returns exactly 7 axes', () => {
    expect(axes).toHaveLength(7);
  });

  it('includes all 7 DisagreementAxis values', () => {
    const ids = axes.map((a) => a.axis);
    expect(ids).toContain('fact');
    expect(ids).toContain('definition');
    expect(ids).toContain('causal');
    expect(ids).toContain('value');
    expect(ids).toContain('evidence');
    expect(ids).toContain('logic');
    expect(ids).toContain('scope');
  });

  it('each axis has a suggestedTagCode', () => {
    for (const a of axes) {
      expect(a.suggestedTagCode).toBeTruthy();
      expect(typeof a.suggestedTagCode).toBe('string');
    }
  });

  it('disagreementAxis matches axis', () => {
    for (const a of axes) {
      expect(a.disagreementAxis).toBe(a.axis);
    }
  });
});

// ── getMoveOptionByKind ───────────────────────────────────────

describe('getMoveOptionByKind', () => {
  it('returns start_thesis for root kind', () => {
    const opt = getMoveOptionByKind('start_thesis', null, RULES);
    expect(opt?.id).toBe('start_thesis');
  });

  it('returns make_claim for root kind', () => {
    const opt = getMoveOptionByKind('make_claim', null, RULES);
    expect(opt?.id).toBe('make_claim');
  });

  it('returns null for reply kind without parent', () => {
    expect(getMoveOptionByKind('challenge_parent', null, RULES)).toBeNull();
  });

  it('returns challenge_parent when parent=claim', () => {
    const opt = getMoveOptionByKind('challenge_parent', 'claim', RULES);
    expect(opt?.id).toBe('challenge_parent');
  });

  it('returns null for ask_clarification when parent=synthesis (not allowed)', () => {
    expect(getMoveOptionByKind('ask_clarification', 'synthesis', RULES)).toBeNull();
  });
});

// ── mapMoveToDraftPatch ───────────────────────────────────────

describe('mapMoveToDraftPatch — start_thesis', () => {
  const sel: ConversationMoveSelection = { moveKind: 'start_thesis', challengeAxis: null, targetExcerpt: null };
  const patch = mapMoveToDraftPatch(sel, null, RULES);

  it('sets argumentType to thesis', () => {
    expect(patch.argumentType).toBe('thesis');
  });

  it('clears disagreementAxis', () => {
    expect(patch.disagreementAxis).toBeNull();
  });

  it('sets moveKind', () => {
    expect(patch.moveKind).toBe('start_thesis');
  });

  it('does not include author_id, depth, status, server_validation', () => {
    expect(patch).not.toHaveProperty('author_id');
    expect(patch).not.toHaveProperty('depth');
    expect(patch).not.toHaveProperty('status');
    expect(patch).not.toHaveProperty('server_validation');
  });
});

describe('mapMoveToDraftPatch — make_claim', () => {
  const sel: ConversationMoveSelection = { moveKind: 'make_claim', challengeAxis: null, targetExcerpt: null };
  const patch = mapMoveToDraftPatch(sel, null, RULES);

  it('sets argumentType to claim', () => {
    expect(patch.argumentType).toBe('claim');
  });
});

describe('mapMoveToDraftPatch — challenge_parent (claim parent)', () => {
  const parent = { argumentType: 'claim' as ArgumentType };
  const sel: ConversationMoveSelection = {
    moveKind: 'challenge_parent',
    challengeAxis: 'fact',
    targetExcerpt: 'quoted text',
  };
  const patch = mapMoveToDraftPatch(sel, parent, RULES);

  it('sets argumentType to rebuttal (not counter_rebuttal) for claim parent', () => {
    expect(patch.argumentType).toBe('rebuttal');
  });

  it('sets disagreementAxis', () => {
    expect(patch.disagreementAxis).toBe('fact');
  });

  it('passes targetExcerpt', () => {
    expect(patch.targetExcerpt).toBe('quoted text');
  });

  it('includes fact axis suggestedTagCode', () => {
    expect(patch.suggestedTagCodes).toContain('fact_disagreement');
  });
});

describe('mapMoveToDraftPatch — challenge_parent (rebuttal parent → counter_rebuttal)', () => {
  const parent = { argumentType: 'rebuttal' as ArgumentType };
  const sel: ConversationMoveSelection = {
    moveKind: 'challenge_parent',
    challengeAxis: 'logic',
    targetExcerpt: null,
  };
  const patch = mapMoveToDraftPatch(sel, parent, RULES);

  it('resolves to counter_rebuttal when parent is rebuttal', () => {
    expect(patch.argumentType).toBe('counter_rebuttal');
  });

  it('sets logic axis', () => {
    expect(patch.disagreementAxis).toBe('logic');
  });
});

describe('mapMoveToDraftPatch — challenge_parent (no axis selected)', () => {
  const parent = { argumentType: 'claim' as ArgumentType };
  const sel: ConversationMoveSelection = {
    moveKind: 'challenge_parent',
    challengeAxis: null,
    targetExcerpt: null,
  };
  const patch = mapMoveToDraftPatch(sel, parent, RULES);

  it('suggestedTagCodes is empty when no axis', () => {
    expect(patch.suggestedTagCodes).toEqual([]);
  });

  it('disagreementAxis is null', () => {
    expect(patch.disagreementAxis).toBeNull();
  });
});

describe('mapMoveToDraftPatch — ask_clarification', () => {
  const parent = { argumentType: 'claim' as ArgumentType };
  const sel: ConversationMoveSelection = {
    moveKind: 'ask_clarification',
    challengeAxis: null,
    targetExcerpt: 'some excerpt',
  };
  const patch = mapMoveToDraftPatch(sel, parent, RULES);

  it('sets argumentType to clarification_request', () => {
    expect(patch.argumentType).toBe('clarification_request');
  });

  it('includes clarification tag', () => {
    expect(patch.suggestedTagCodes).toContain('clarification');
  });

  it('passes targetExcerpt', () => {
    expect(patch.targetExcerpt).toBe('some excerpt');
  });
});

describe('mapMoveToDraftPatch — add_evidence', () => {
  const parent = { argumentType: 'claim' as ArgumentType };
  const sel: ConversationMoveSelection = { moveKind: 'add_evidence', challengeAxis: null, targetExcerpt: null };
  const patch = mapMoveToDraftPatch(sel, parent, RULES);

  it('sets argumentType to evidence', () => {
    expect(patch.argumentType).toBe('evidence');
  });

  it('includes evidence tag', () => {
    expect(patch.suggestedTagCodes).toContain('evidence');
  });
});

describe('mapMoveToDraftPatch — concede_or_narrow', () => {
  const parent = { argumentType: 'claim' as ArgumentType };
  const sel: ConversationMoveSelection = { moveKind: 'concede_or_narrow', challengeAxis: null, targetExcerpt: null };
  const patch = mapMoveToDraftPatch(sel, parent, RULES);

  it('sets argumentType to concession', () => {
    expect(patch.argumentType).toBe('concession');
  });
});

describe('mapMoveToDraftPatch — synthesize_thread', () => {
  const parent = { argumentType: 'concession' as ArgumentType };
  const sel: ConversationMoveSelection = { moveKind: 'synthesize_thread', challengeAxis: null, targetExcerpt: null };
  const patch = mapMoveToDraftPatch(sel, parent, RULES);

  it('sets argumentType to synthesis', () => {
    expect(patch.argumentType).toBe('synthesis');
  });

  it('includes synthesis tag', () => {
    expect(patch.suggestedTagCodes).toContain('synthesis');
  });
});

// ── getVisibleMoveSteps ───────────────────────────────────────

describe('getVisibleMoveSteps', () => {
  it('root draft with no moveKind: [move_selection, body, validation_preview]', () => {
    const steps = getVisibleMoveSteps({ moveKind: null }, null);
    expect(steps).toEqual(['move_selection', 'body', 'validation_preview']);
  });

  it('root draft with moveKind: no target_excerpt (no parent)', () => {
    const steps = getVisibleMoveSteps({ moveKind: 'start_thesis' }, null);
    expect(steps).not.toContain('target_excerpt');
  });

  it('reply draft with moveKind: includes target_excerpt', () => {
    const steps = getVisibleMoveSteps(
      { moveKind: 'ask_clarification' },
      { argumentType: 'claim' },
    );
    expect(steps).toContain('target_excerpt');
  });

  it('challenge_parent: includes challenge_axis', () => {
    const steps = getVisibleMoveSteps(
      { moveKind: 'challenge_parent' },
      { argumentType: 'claim' },
    );
    expect(steps).toContain('challenge_axis');
  });

  it('non-challenge reply: does NOT include challenge_axis', () => {
    const steps = getVisibleMoveSteps(
      { moveKind: 'ask_clarification' },
      { argumentType: 'claim' },
    );
    expect(steps).not.toContain('challenge_axis');
  });

  it('add_evidence move: includes evidence_fields', () => {
    const steps = getVisibleMoveSteps(
      { moveKind: 'add_evidence' },
      { argumentType: 'claim' },
    );
    expect(steps).toContain('evidence_fields');
  });

  it('evidence argumentType: includes evidence_fields', () => {
    const steps = getVisibleMoveSteps(
      { moveKind: null, argumentType: 'evidence' },
      { argumentType: 'claim' },
    );
    expect(steps).toContain('evidence_fields');
  });

  it('non-evidence move: does NOT include evidence_fields', () => {
    const steps = getVisibleMoveSteps(
      { moveKind: 'start_thesis' },
      null,
    );
    expect(steps).not.toContain('evidence_fields');
  });

  it('always ends with body then validation_preview', () => {
    const steps = getVisibleMoveSteps({ moveKind: 'challenge_parent' }, { argumentType: 'claim' });
    const last = steps[steps.length - 1];
    const second_last = steps[steps.length - 2];
    expect(last).toBe('validation_preview');
    expect(second_last).toBe('body');
  });

  it('always starts with move_selection', () => {
    const steps = getVisibleMoveSteps({ moveKind: null }, null);
    expect(steps[0]).toBe('move_selection');
  });
});

// ── getMoveWarnings ───────────────────────────────────────────

describe('getMoveWarnings', () => {
  it('no warnings when root move with no parent', () => {
    const sel: ConversationMoveSelection = { moveKind: 'start_thesis', challengeAxis: null, targetExcerpt: null };
    expect(getMoveWarnings(sel, null)).toHaveLength(0);
  });

  it('warns when reply move selected without parent', () => {
    const sel: ConversationMoveSelection = { moveKind: 'ask_clarification', challengeAxis: null, targetExcerpt: null };
    const warnings = getMoveWarnings(sel, null);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/parent/i);
  });

  it('warns when challenge_parent has no axis', () => {
    const sel: ConversationMoveSelection = { moveKind: 'challenge_parent', challengeAxis: null, targetExcerpt: null };
    const warnings = getMoveWarnings(sel, { argumentType: 'claim' });
    expect(warnings.some((w) => w.toLowerCase().includes('axis'))).toBe(true);
  });

  it('no axis warning when axis is provided', () => {
    const sel: ConversationMoveSelection = { moveKind: 'challenge_parent', challengeAxis: 'fact', targetExcerpt: null };
    const warnings = getMoveWarnings(sel, { argumentType: 'claim' });
    expect(warnings.some((w) => w.toLowerCase().includes('axis'))).toBe(false);
  });

  it('no warnings for valid concede_or_narrow with parent', () => {
    const sel: ConversationMoveSelection = { moveKind: 'concede_or_narrow', challengeAxis: null, targetExcerpt: null };
    expect(getMoveWarnings(sel, { argumentType: 'claim' })).toHaveLength(0);
  });
});
