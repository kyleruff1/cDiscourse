/**
 * ROOM-003 (#829) — pure bar-model matrix.
 *
 * Covers deriveEntryComposerDefaults (type inference clamped to the engine
 * allowed set + seat-derived side), sideForParticipantSeat, the bar layout
 * gate, the context-chip target, the blocked-flag selector, and the Q10
 * fast-path civility signal. Pure — no React, no Supabase, no render.
 */
import {
  deriveEntryComposerDefaults,
  sideForParticipantSeat,
  deriveEntryComposerBarLayout,
  deriveEntryComposerTarget,
  deriveEntryComposerBlockingFlag,
  deriveFastPathCivilitySignal,
  truncateChipExcerpt,
  ARGUMENT_ENTRY_COMPOSER_COPY,
} from '../src/features/arguments/composer/argumentEntryComposerModel';
import { getAllowedArgumentTypesForParent } from '../src/features/arguments/composerHelpers';
import { constitutionRules } from '../src/domain/constitution';
import type { ArgumentType } from '../src/features/arguments/types';
import type { ParticipantSide } from '../src/features/debates/types';
import type { EvaluationResult, EvaluationFlagDetail } from '../src/domain/constitution/types';
import { FLAG_CODES } from '../src/domain/constitution/types';

const RULES = constitutionRules;

// Every parent type the transition matrix defines, plus the root context.
const PARENT_TYPES: (ArgumentType | null)[] = [
  null,
  'thesis',
  'claim',
  'rebuttal',
  'counter_rebuttal',
  'evidence',
  'clarification_request',
  'concession',
  'synthesis',
];

// ── sideForParticipantSeat ─────────────────────────────────────

describe('ROOM-003 sideForParticipantSeat', () => {
  it('maps affirmative and negative directly', () => {
    expect(sideForParticipantSeat('affirmative')).toBe('affirmative');
    expect(sideForParticipantSeat('negative')).toBe('negative');
  });

  it('maps observer, moderator, and null to neutral', () => {
    expect(sideForParticipantSeat('observer')).toBe('neutral');
    expect(sideForParticipantSeat('moderator')).toBe('neutral');
    expect(sideForParticipantSeat(null)).toBe('neutral');
  });
});

// ── deriveEntryComposerDefaults ────────────────────────────────

describe('ROOM-003 deriveEntryComposerDefaults — type is always engine-allowed', () => {
  it('never returns a type outside getAllowedArgumentTypesForParent (all parents, both sides)', () => {
    for (const parentType of PARENT_TYPES) {
      for (const replyingToOwnMove of [false, true]) {
        const { argumentType } = deriveEntryComposerDefaults({
          parentType,
          participantSide: 'affirmative',
          replyingToOwnMove,
          rules: RULES,
        });
        const allowed = getAllowedArgumentTypesForParent(parentType, RULES);
        // Root and every matrix parent have a non-empty allowed set in v1.
        expect(allowed.length).toBeGreaterThan(0);
        expect(allowed).toContain(argumentType);
      }
    }
  });

  it('root context defaults to claim (thesis reserved for the Start flow)', () => {
    const d = deriveEntryComposerDefaults({
      parentType: null,
      participantSide: 'affirmative',
      replyingToOwnMove: false,
      rules: RULES,
    });
    expect(d.argumentType).toBe('claim');
  });

  it('reply to an opponent claim defaults to the natural counter (rebuttal)', () => {
    const d = deriveEntryComposerDefaults({
      parentType: 'claim',
      participantSide: 'negative',
      replyingToOwnMove: false,
      rules: RULES,
    });
    expect(d.argumentType).toBe('rebuttal');
    expect(d.side).toBe('negative');
  });

  it('reply to an opponent rebuttal defaults to counter_rebuttal', () => {
    const d = deriveEntryComposerDefaults({
      parentType: 'rebuttal',
      participantSide: 'negative',
      replyingToOwnMove: false,
      rules: RULES,
    });
    expect(d.argumentType).toBe('counter_rebuttal');
  });

  it('reply to an opponent counter_rebuttal defaults to rebuttal', () => {
    const d = deriveEntryComposerDefaults({
      parentType: 'counter_rebuttal',
      participantSide: 'affirmative',
      replyingToOwnMove: false,
      rules: RULES,
    });
    expect(d.argumentType).toBe('rebuttal');
  });

  it('continuation on the viewer own claim stays least-adversarial (clarification_request when claim is not an allowed child)', () => {
    // claim -> allowed children do NOT include claim, so the least-adversarial
    // fallback is clarification_request.
    const allowed = getAllowedArgumentTypesForParent('claim', RULES);
    expect(allowed).not.toContain('claim');
    const d = deriveEntryComposerDefaults({
      parentType: 'claim',
      participantSide: 'affirmative',
      replyingToOwnMove: true,
      rules: RULES,
    });
    expect(d.argumentType).toBe('clarification_request');
  });

  it('continuation on an own clarification_request stays claim (claim is an allowed child)', () => {
    const d = deriveEntryComposerDefaults({
      parentType: 'clarification_request',
      participantSide: 'affirmative',
      replyingToOwnMove: true,
      rules: RULES,
    });
    expect(d.argumentType).toBe('claim');
  });

  it('clamps a disallowed preferred type to the first allowed type (opponent reply to a concession -> synthesis)', () => {
    // concession -> allowed children is [synthesis] only; the preferred
    // rebuttal is disallowed, so it clamps to synthesis.
    const allowed = getAllowedArgumentTypesForParent('concession', RULES);
    expect(allowed).toEqual(['synthesis']);
    const d = deriveEntryComposerDefaults({
      parentType: 'concession',
      participantSide: 'affirmative',
      replyingToOwnMove: false,
      rules: RULES,
    });
    expect(d.argumentType).toBe('synthesis');
  });

  it('clamps to claim on an opponent reply to a synthesis (rebuttal disallowed)', () => {
    const allowed = getAllowedArgumentTypesForParent('synthesis', RULES);
    expect(allowed).toEqual(['claim', 'clarification_request']);
    const d = deriveEntryComposerDefaults({
      parentType: 'synthesis',
      participantSide: 'negative',
      replyingToOwnMove: false,
      rules: RULES,
    });
    expect(d.argumentType).toBe('claim');
  });

  it('degrades safely to claim when the allowed set is empty (degenerate constitution)', () => {
    const d = deriveEntryComposerDefaults({
      parentType: 'claim',
      participantSide: null,
      replyingToOwnMove: false,
      rules: [], // no transition rules -> getAllowedReplies returns []
    });
    expect(d.argumentType).toBe('claim');
    expect(d.side).toBe('neutral');
  });

  it('side follows the seat regardless of type inference', () => {
    const seats: [ParticipantSide | null, 'affirmative' | 'negative' | 'neutral'][] = [
      ['affirmative', 'affirmative'],
      ['negative', 'negative'],
      ['observer', 'neutral'],
      ['moderator', 'neutral'],
      [null, 'neutral'],
    ];
    for (const [seat, expected] of seats) {
      const d = deriveEntryComposerDefaults({
        parentType: 'claim',
        participantSide: seat,
        replyingToOwnMove: false,
        rules: RULES,
      });
      expect(d.side).toBe(expected);
    }
  });
});

// ── deriveEntryComposerTarget ──────────────────────────────────

describe('ROOM-003 deriveEntryComposerTarget', () => {
  it('root context reads New point and is not clearable', () => {
    const t = deriveEntryComposerTarget({ parentId: null, parentType: null, parentBody: null });
    expect(t.chipLabel).toBe(ARGUMENT_ENTRY_COMPOSER_COPY.chipNewPoint);
    expect(t.clearable).toBe(false);
  });

  it('a scoped parent reads Answering: <excerpt> and is clearable', () => {
    const t = deriveEntryComposerTarget({
      parentId: 'arg-1',
      parentType: 'claim',
      parentBody: 'Bike lanes make city streets measurably safer for everyone.',
    });
    expect(t.chipLabel.startsWith(ARGUMENT_ENTRY_COMPOSER_COPY.chipAnsweringPrefix)).toBe(true);
    expect(t.clearable).toBe(true);
    expect(t.parentType).toBe('claim');
  });

  it('truncateChipExcerpt collapses whitespace and clamps length', () => {
    expect(truncateChipExcerpt(null)).toBe('');
    expect(truncateChipExcerpt('  hello   world  ')).toBe('hello world');
    const long = 'x'.repeat(80);
    const out = truncateChipExcerpt(long, 10);
    expect(out.length).toBeLessThanOrEqual(10);
    expect(out.endsWith('…')).toBe(true);
  });
});

// ── deriveEntryComposerBarLayout ───────────────────────────────

function evalWith(allowPost: boolean, blocking: EvaluationFlagDetail[] = [], warnings: EvaluationFlagDetail[] = []): EvaluationResult {
  return {
    allowPost,
    blockingErrors: blocking,
    warnings,
    flagsToPersist: [],
    normalizedTags: [],
    clientValidationPayload: { checkedAt: 'x', constitutionVersion: 'v1', ruleCodesChecked: [], flagCount: 0, blockingCount: 0 },
    serverValidationPayload: { checkedAt: 'x', constitutionVersion: 'v1', ruleCodesChecked: [], flagCount: 0, blockingCount: 0 },
  };
}

describe('ROOM-003 deriveEntryComposerBarLayout', () => {
  it('all slots render in every state', () => {
    const layout = deriveEntryComposerBarLayout({ bodyLength: 0, evaluation: null, hasParent: false });
    expect(layout.showContextChip).toBe(true);
    expect(layout.showProofSlot).toBe(true);
    expect(layout.showMicSlot).toBe(true);
    expect(layout.showMoreButton).toBe(true);
  });

  it('canSend is false with an empty body even when the engine allows the post', () => {
    expect(deriveEntryComposerBarLayout({ bodyLength: 0, evaluation: evalWith(true), hasParent: true }).canSend).toBe(false);
  });

  it('canSend is false when the engine blocks the post', () => {
    expect(deriveEntryComposerBarLayout({ bodyLength: 50, evaluation: evalWith(false), hasParent: true }).canSend).toBe(false);
  });

  it('canSend is false when there is no evaluation yet', () => {
    expect(deriveEntryComposerBarLayout({ bodyLength: 50, evaluation: null, hasParent: true }).canSend).toBe(false);
  });

  it('canSend is true only when the body is non-empty AND the engine allows the post', () => {
    expect(deriveEntryComposerBarLayout({ bodyLength: 50, evaluation: evalWith(true), hasParent: true }).canSend).toBe(true);
  });
});

// ── deriveEntryComposerBlockingFlag ────────────────────────────

describe('ROOM-003 deriveEntryComposerBlockingFlag', () => {
  it('returns null when nothing blocks', () => {
    expect(deriveEntryComposerBlockingFlag(null)).toBeNull();
    expect(deriveEntryComposerBlockingFlag(evalWith(true))).toBeNull();
  });

  it('surfaces the first blocking flag code + message when the engine blocks', () => {
    const blocking: EvaluationFlagDetail = {
      ruleCode: 'evidence_source_required',
      flagCode: FLAG_CODES.EVIDENCE_REQUIRED,
      severity: 'blocking',
      message: 'Evidence arguments must include at least one source (URL or source text).',
      payload: {},
    };
    const out = deriveEntryComposerBlockingFlag(evalWith(false, [blocking]));
    expect(out?.flagCode).toBe(FLAG_CODES.EVIDENCE_REQUIRED);
    expect(out?.message.length).toBeGreaterThan(0);
  });
});

// ── deriveFastPathCivilitySignal (Q10, advisory-only) ──────────

describe('ROOM-003 deriveFastPathCivilitySignal', () => {
  it('reports no advisory for a null evaluation or a clean post', () => {
    expect(deriveFastPathCivilitySignal(null)).toEqual({ hadCivilityAdvisory: false, flagCodes: [] });
    expect(deriveFastPathCivilitySignal(evalWith(true))).toEqual({ hadCivilityAdvisory: false, flagCodes: [] });
  });

  it('fires on an ad-hominem review advisory', () => {
    const adHominem: EvaluationFlagDetail = {
      ruleCode: 'civility_heuristic',
      flagCode: FLAG_CODES.AD_HOMINEM,
      severity: 'review',
      message: 'Possible personal attack detected.',
      payload: {},
    };
    const out = deriveFastPathCivilitySignal(evalWith(true, [], [adHominem]));
    expect(out.hadCivilityAdvisory).toBe(true);
    expect(out.flagCodes).toContain(FLAG_CODES.AD_HOMINEM);
  });

  it('fires on a civility-risk review advisory', () => {
    const risk: EvaluationFlagDetail = {
      ruleCode: 'civility_heuristic',
      flagCode: FLAG_CODES.CIVILITY_RISK,
      severity: 'review',
      message: 'Possible incivility detected.',
      payload: {},
    };
    const out = deriveFastPathCivilitySignal(evalWith(true, [], [risk]));
    expect(out.hadCivilityAdvisory).toBe(true);
  });

  it('ignores non-civility warnings and non-review severities', () => {
    const offTopic: EvaluationFlagDetail = {
      ruleCode: 'topic_satisfaction_lexical',
      flagCode: FLAG_CODES.OFF_TOPIC,
      severity: 'warning',
      message: 'This may be drifting from the topic.',
      payload: {},
    };
    expect(deriveFastPathCivilitySignal(evalWith(true, [], [offTopic])).hadCivilityAdvisory).toBe(false);
  });
});
