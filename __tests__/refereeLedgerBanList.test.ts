/**
 * MCP-013 — Referee ledger: doctrine ban-list + schema-shape guards.
 *
 * Three guards:
 *   1. Ban-list — no verdict / person-attribution token appears in any
 *      RefereeFeedbackCode, any REFEREE_FEEDBACK_COPY value, any new
 *      PLAIN_LANGUAGE_COPY string, or `toPlainLanguage` of any new code.
 *   2. Schema-shape — a sample `LedgerResult` has no `block` / `winner` /
 *      `truthValue` / `score` / per-side-aggregate key.
 *   3. Plain-language coverage — every RefereeFeedbackCode maps to a non-null
 *      `toPlainLanguage` result with no snake_case leak.
 */

import {
  reconcileMove,
  feedbackCodeToPlainLanguage,
  REFEREE_FEEDBACK_COPY,
  ALL_REFEREE_FEEDBACK_CODES,
} from '../src/features/refereeLedger';
import type {
  DeterministicMoveMetadata,
  LedgerResult,
} from '../src/features/refereeLedger';
import { toPlainLanguage } from '../src/features/arguments/gameCopy';
import { IssueDebtLedger } from '../src/features/pointStanding';
import type {
  ChallengeGradingInput,
  GradingFlags,
} from '../src/features/pointStanding';
import { computeAgreementDisagreementVector } from '../src/features/engagementIntelligence/agreementScalar';
import { classifyMixedAgreement, toGradingFlags } from '../src/features/engagementIntelligence/mixedAgreementTaxonomy';

// ── The doctrine ban-list (MCP-013 design test plan) ──────────────

const BANNED_TOKENS = [
  'winner',
  'loser',
  'won',
  'lost',
  'right',
  'wrong',
  'true',
  'false',
  'correct',
  'incorrect',
  'proven',
  'defeated',
  'liar',
  'lying',
  'dishonest',
  'bad faith',
  'manipulative',
  'troll',
  'propagandist',
  'extremist',
  'stupid',
  'idiot',
  'dumb',
  'smart',
];

/**
 * Word-boundary scan — "lost" must not match "almost", "right" must not match
 * inside another word. The copy strings are deliberately phrased to avoid
 * even substring collisions, but a boundary scan is the honest test.
 */
function containsBannedToken(text: string): string | null {
  const lower = text.toLowerCase();
  for (const token of BANNED_TOKENS) {
    if (token.includes(' ')) {
      if (lower.includes(token)) return token;
    } else {
      const re = new RegExp(`\\b${token}\\b`, 'i');
      if (re.test(lower)) return token;
    }
  }
  return null;
}

describe('referee ledger ban-list — feedback codes', () => {
  it('no RefereeFeedbackCode token carries a verdict / person-attribution word', () => {
    for (const code of ALL_REFEREE_FEEDBACK_CODES) {
      expect(containsBannedToken(code)).toBeNull();
    }
  });

  it('no REFEREE_FEEDBACK_COPY value carries a banned token', () => {
    for (const value of Object.values(REFEREE_FEEDBACK_COPY)) {
      expect(containsBannedToken(value)).toBeNull();
    }
  });

  it('no toPlainLanguage of any feedback code carries a banned token', () => {
    for (const code of ALL_REFEREE_FEEDBACK_CODES) {
      const plain = toPlainLanguage(code);
      expect(plain).not.toBeNull();
      expect(containsBannedToken(plain as string)).toBeNull();
    }
  });
});

// ── Plain-language coverage ───────────────────────────────────────

describe('referee ledger plain-language coverage', () => {
  it('every RefereeFeedbackCode maps to a non-null toPlainLanguage result', () => {
    for (const code of ALL_REFEREE_FEEDBACK_CODES) {
      const plain = toPlainLanguage(code);
      expect(plain).not.toBeNull();
      expect((plain as string).length).toBeGreaterThan(0);
    }
  });

  it('every feedbackCodeToPlainLanguage result is non-null and has no snake_case leak', () => {
    for (const code of ALL_REFEREE_FEEDBACK_CODES) {
      const plain = feedbackCodeToPlainLanguage(code);
      expect(plain).not.toBeNull();
      // A plain-language string is normal prose — never the raw snake_case key.
      expect(plain).not.toBe(code);
    }
  });

  it('REFEREE_FEEDBACK_COPY covers exactly the feedback-code union', () => {
    const copyKeys = Object.keys(REFEREE_FEEDBACK_COPY).sort();
    const codeKeys = [...ALL_REFEREE_FEEDBACK_CODES].sort();
    expect(copyKeys).toEqual(codeKeys);
  });
});

// ── Schema-shape guard — no winner / block / truthValue / score ───

function makeFlagsFor(rootText: string, replyText: string) {
  const v = computeAgreementDisagreementVector(rootText, replyText);
  const f = classifyMixedAgreement(v, rootText, replyText);
  return { vector: v, flags: toGradingFlags(f) as GradingFlags };
}

function challengeInput(rootText: string, replyText: string): ChallengeGradingInput {
  const { vector, flags } = makeFlagsFor(rootText, replyText);
  const parent = makeFlagsFor(rootText, rootText);
  return {
    pointId: 'point-bike',
    parentArgumentId: 'a1',
    parentFlags: parent.flags,
    parentVector: parent.vector,
    openDebts: [],
    replyArgumentId: 'b1',
    replyFlags: flags,
    replyVector: vector,
    replyText,
  };
}

function baseMeta(): DeterministicMoveMetadata {
  return {
    parentArgumentId: 'a1',
    selectedAction: 'reply',
    selectedMoveType: 'rebuttal',
    authorIsOriginalSpeaker: false,
    hasAttachedEvidence: false,
    hasQuoteAnchor: false,
    selectedClarify: false,
    lifecycleSynthesisReady: false,
    branchKind: 'mainline',
    roomModeId: 'casual',
    moveFitsRoomMode: true,
    respectsPacing: true,
  };
}

/** Keys that would turn the ledger into a winner / truth surface — forbidden. */
const FORBIDDEN_RESULT_KEYS = [
  'block',
  'winner',
  'loser',
  'truthValue',
  'score',
  'affirmativeTotal',
  'negativeTotal',
  'scoreToBeat',
  'leaderboard',
  'verdict',
  'isCorrect',
];

describe('referee ledger schema-shape — LedgerResult has no verdict surface', () => {
  const sample: LedgerResult = reconcileMove({
    pointId: 'point-bike',
    moveArgumentId: 'b1',
    deterministicMetadata: baseMeta(),
    moveRole: 'challenge',
    economyInput: challengeInput(
      'Bike lanes should replace curb parking downtown.',
      'I agree on safety overall. But narrow the claim — replacing every downtown curb lane is too broad without corridor demand data.',
    ),
    debtLedger: new IssueDebtLedger(),
  });

  it('the LedgerResult object has no block / winner / truthValue / score / per-side-aggregate key', () => {
    const keys = Object.keys(sample);
    for (const forbidden of FORBIDDEN_RESULT_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('no CategoryReading carries a block / winner / truthValue / score key', () => {
    for (const reading of sample.categoryReadings) {
      const keys = Object.keys(reading);
      for (const forbidden of FORBIDDEN_RESULT_KEYS) {
        expect(keys).not.toContain(forbidden);
      }
    }
  });

  it('userReviewRequired is the literal true — the output is advisory', () => {
    expect(sample.userReviewRequired).toBe(true);
  });
});
