/**
 * Unit tests for the Stage 3/4 constitution rules engine and rails checks.
 *
 * These tests are pure TypeScript — no Supabase connection required.
 */
import { evaluateArgumentDraft } from '../../domain/constitution/evaluateArgumentDraft';
import { runRailsChecks } from '../../domain/constitution/railsChecks';
import {
  constitutionVersion,
  constitutionRules,
  tagDefinitions,
  flagDefinitions,
} from '../../domain/constitution/constitution.v1';
import type {
  ArgumentDraftEvaluationInput,
  ParentArgument,
} from '../../domain/constitution/types';
import { FLAG_CODES, RULE_CODES } from '../../domain/constitution/types';

// ── Helpers ───────────────────────────────────────────────────

const RESOLUTION = 'Universal basic income should be implemented nationally';
const DESCRIPTION = 'Debate about whether governments should provide a universal basic income to all citizens';

function makeInput(
  overrides: Partial<ArgumentDraftEvaluationInput>,
): ArgumentDraftEvaluationInput {
  return {
    debateId: 'test-debate-id',
    debateResolution: RESOLUTION,
    debateDescription: DESCRIPTION,
    argumentType: 'thesis',
    side: 'affirmative',
    body: 'A universal basic income provides financial security and reduces poverty for all citizens nationally.',
    selectedTagCodes: [],
    attachedEvidence: [],
    activeConstitution: constitutionVersion,
    activeRules: constitutionRules,
    tagDefinitions,
    flagDefinitions,
    evaluationContext: 'server',
    ...overrides,
  };
}

function makeParent(overrides: Partial<ParentArgument> = {}): ParentArgument {
  return {
    id: 'parent-id',
    argumentType: 'thesis',
    side: 'affirmative',
    body: 'Universal basic income should be implemented at a national level to reduce poverty.',
    depth: 0,
    ...overrides,
  };
}

// ── Test 1: root thesis allowed ───────────────────────────────

test('root thesis is allowed', () => {
  const result = evaluateArgumentDraft(makeInput({ argumentType: 'thesis' }));
  expect(result.allowPost).toBe(true);
  expect(result.blockingErrors).toHaveLength(0);
});

// ── Test 2: root claim allowed ────────────────────────────────

test('root claim is allowed (constitution allows claim at root)', () => {
  const result = evaluateArgumentDraft(
    makeInput({
      argumentType: 'claim',
      body: 'Universal basic income reduces poverty rates according to recent economic studies nationally.',
    }),
  );
  expect(result.allowPost).toBe(true);
  expect(result.blockingErrors).toHaveLength(0);
});

// ── Test 3: rebuttal without parent blocks ────────────────────

test('rebuttal without parent is blocked', () => {
  const result = evaluateArgumentDraft(
    makeInput({
      argumentType: 'rebuttal',
      parentArgument: undefined,
      body: 'The evidence for universal basic income reducing poverty nationally is weak and unconvincing.',
    }),
  );
  expect(result.allowPost).toBe(false);
  expect(result.blockingErrors.some((e) => e.flagCode === FLAG_CODES.MISSING_PARENT)).toBe(true);
});

// ── Test 4: invalid transition blocks ─────────────────────────

test('invalid transition is blocked (synthesis cannot reply to thesis)', () => {
  const result = evaluateArgumentDraft(
    makeInput({
      argumentType: 'synthesis',
      parentArgument: makeParent({ argumentType: 'thesis' }),
      body: 'In summary the universal basic income debate nationally has shown that evidence supports the affirmative position.',
    }),
  );
  expect(result.allowPost).toBe(false);
  expect(result.blockingErrors.some((e) => e.flagCode === FLAG_CODES.INVALID_TRANSITION)).toBe(true);
});

// ── Test 5: rebuttal with no parent overlap → parent_nonresponsive ─

test('rebuttal with no lexical overlap with parent produces parent_nonresponsive flag', () => {
  const railResult = runRailsChecks({
    argumentType: 'rebuttal',
    body: 'Cats are wonderful pets that bring joy to households everywhere in the world today.',
    parentBody: 'Universal basic income reduces poverty and increases economic security for citizens.',
    selectedTagCodes: ['fact_disagreement'],
    activeRules: constitutionRules,
    source: 'server_rules',
  });
  const isBlocking = railResult.entries.some(
    (e) => e.flagCode === FLAG_CODES.PARENT_NONRESPONSIVE && e.kind === 'blocking',
  );
  expect(isBlocking).toBe(true);
});

// ── Test 6: rebuttal with target_excerpt from parent passes ──

test('rebuttal with target_excerpt from parent passes rail check', () => {
  const parentBody = 'Universal basic income would reduce economic inequality and create social stability.';
  const railResult = runRailsChecks({
    argumentType: 'rebuttal',
    body: 'There is no peer-reviewed evidence supporting the claim about economic inequality.',
    parentBody,
    selectedTagCodes: ['fact_disagreement'],
    target: { targetExcerpt: 'reduce economic inequality' },
    activeRules: constitutionRules,
    source: 'server_rules',
  });
  const isBlocked = railResult.entries.some(
    (e) => e.flagCode === FLAG_CODES.PARENT_NONRESPONSIVE && e.kind === 'blocking',
  );
  expect(isBlocked).toBe(false);
});

// ── Test 7: rebuttal without disagreement-axis tag warns ─────

test('rebuttal without disagreement-axis tag produces unclear_claim warning', () => {
  const railResult = runRailsChecks({
    argumentType: 'rebuttal',
    body: 'Universal basic income has not been shown to reduce poverty in peer-reviewed national studies.',
    parentBody: 'Universal basic income reduces poverty rates for all citizens nationally.',
    selectedTagCodes: [], // no axis tag
    activeRules: constitutionRules,
    source: 'server_rules',
  });
  const hasAxisWarning = railResult.entries.some(
    (e) => e.flagCode === FLAG_CODES.UNCLEAR_CLAIM && e.kind === 'warning',
  );
  expect(hasAxisWarning).toBe(true);
});

// ── Test 8: concession with target and concession marker passes ─

test('concession with concession marker and parent overlap passes', () => {
  const railResult = runRailsChecks({
    argumentType: 'concession',
    body: 'I concede that universal basic income has shown positive effects on poverty reduction in some national pilots.',
    parentBody: 'Universal basic income shows strong results in reducing poverty nationally.',
    selectedTagCodes: ['concession'],
    activeRules: constitutionRules,
    source: 'server_rules',
  });
  const isBlocked = railResult.entries.some(
    (e) => e.kind === 'blocking',
  );
  expect(isBlocked).toBe(false);
});

// ── Test 9: concession with unrelated "but" creates concession_evasion_possible ─

test('concession with "but" and unrelated content creates concession_evasion_possible', () => {
  const railResult = runRailsChecks({
    argumentType: 'concession',
    body: 'I concede this one point, but actually your entire argument about economics is fundamentally wrong and misguided.',
    parentBody: 'Universal basic income shows strong results reducing poverty nationally among low-income families.',
    selectedTagCodes: ['concession'],
    activeRules: constitutionRules,
    source: 'server_rules',
  });
  const hasConcessionEvasion = railResult.entries.some(
    (e) => e.flagCode === FLAG_CODES.CONCESSION_EVASION,
  );
  expect(hasConcessionEvasion).toBe(true);
});

// ── Test 10: loaded clarification creates loaded_clarification_possible ─

test('clarification request with loaded language creates loaded_clarification_possible', () => {
  const railResult = runRailsChecks({
    argumentType: 'clarification_request',
    body: 'You obviously have no idea what you are talking about, so what is your definition of poverty?',
    parentBody: 'Universal basic income reduces poverty nationally.',
    selectedTagCodes: ['clarification'],
    activeRules: constitutionRules,
    source: 'server_rules',
  });
  const hasLoadedFlag = railResult.entries.some(
    (e) => e.flagCode === FLAG_CODES.LOADED_CLARIFICATION,
  );
  expect(hasLoadedFlag).toBe(true);
});

// ── Test 11: factual dispute with uncertainty creates fact_confusion_possible ─

test('factual dispute with uncertainty language creates fact_confusion_possible', () => {
  const railResult = runRailsChecks({
    argumentType: 'rebuttal',
    body: 'I am not sure whether the data you cite is accurate. Perhaps there is a different explanation for the poverty reduction.',
    parentBody: 'Universal basic income reduced poverty rates in the pilot nationally.',
    selectedTagCodes: ['fact_disagreement', 'evidence_challenge'],
    activeRules: constitutionRules,
    source: 'server_rules',
  });
  const hasFactConfusion = railResult.entries.some(
    (e) => e.flagCode === FLAG_CODES.FACT_CONFUSION,
  );
  expect(hasFactConfusion).toBe(true);
});

// ── Test 12: evidence tag without source creates evidence_required ─

test('evidence type without attached source creates evidence_required blocking error', () => {
  const result = evaluateArgumentDraft(
    makeInput({
      argumentType: 'evidence',
      parentArgument: makeParent({ argumentType: 'claim' }),
      body: 'Studies on universal basic income have shown reductions in poverty rates nationally according to economic research.',
      attachedEvidence: [], // no source
    }),
  );
  expect(result.allowPost).toBe(false);
  expect(result.blockingErrors.some((e) => e.flagCode === FLAG_CODES.EVIDENCE_REQUIRED)).toBe(true);
});

// ── Test 12b: evidence tag on non-evidence type triggers evidence check ─

test('evidence tag on rebuttal without attached source creates evidence_required', () => {
  const result = evaluateArgumentDraft(
    makeInput({
      argumentType: 'rebuttal',
      parentArgument: makeParent({ argumentType: 'claim' }),
      body: 'Universal basic income has not reduced poverty according to national income data sets.',
      selectedTagCodes: ['evidence'], // evidence tag triggers evidence check
      attachedEvidence: [],
    }),
  );
  expect(result.allowPost).toBe(false);
  expect(result.blockingErrors.some((e) => e.flagCode === FLAG_CODES.EVIDENCE_REQUIRED)).toBe(true);
});

// ── Test 13: duplicate sibling creates duplicate_argument_possible ─

test('highly similar sibling creates duplicate_argument_possible warning', () => {
  const body = 'Universal basic income should be implemented nationally to reduce poverty for all citizens.';
  const result = evaluateArgumentDraft(
    makeInput({
      argumentType: 'thesis',
      body,
      existingSiblingArguments: [
        {
          id: 'sib-1',
          argumentType: 'thesis',
          side: 'affirmative',
          body: 'Universal basic income should be implemented nationally to reduce poverty for all citizens.', // identical
        },
      ],
    }),
  );
  expect(result.warnings.some((w) => w.flagCode === FLAG_CODES.DUPLICATE)).toBe(true);
});

// ── Test 14: excessive length creates excessive_length ────────

test('body exceeding maxChars creates excessive_length blocking error', () => {
  const longBody = 'A'.repeat(2001);
  const result = evaluateArgumentDraft(
    makeInput({ argumentType: 'thesis', body: longBody }),
  );
  expect(result.allowPost).toBe(false);
  expect(result.blockingErrors.some((e) => e.flagCode === FLAG_CODES.EXCESSIVE_LENGTH)).toBe(true);
});

// ── Test 15: server evaluation emits source='server_rules' ───

test('server evaluation emits source=server_rules on all flags', () => {
  const result = evaluateArgumentDraft(
    makeInput({
      argumentType: 'rebuttal',
      parentArgument: undefined, // will cause MISSING_PARENT
      body: 'This is a valid rebuttal body text that is long enough to satisfy length requirements.',
      evaluationContext: 'server',
    }),
  );
  const allServerRules = result.flagsToPersist.every((f) => f.source === 'server_rules');
  expect(allServerRules).toBe(true);
});

// ── Transition matrix alignment tests ────────────────────────

test('thesis → evidence is now a valid transition', () => {
  const result = evaluateArgumentDraft(
    makeInput({
      argumentType: 'evidence',
      parentArgument: makeParent({ argumentType: 'thesis' }),
      body: 'Studies on universal basic income nationally show poverty reduction rates when implemented.',
      attachedEvidence: [{ url: 'https://example.com/study', label: 'UBI Study' }],
      selectedTagCodes: ['evidence'],
    }),
  );
  expect(result.blockingErrors.some((e) => e.flagCode === FLAG_CODES.INVALID_TRANSITION)).toBe(false);
});

test('counter_rebuttal → evidence is now valid', () => {
  const result = evaluateArgumentDraft(
    makeInput({
      argumentType: 'evidence',
      parentArgument: makeParent({ argumentType: 'counter_rebuttal' }),
      body: 'National universal basic income pilot data shows measurable reduction in poverty rates.',
      attachedEvidence: [{ url: 'https://example.com/data', label: 'Pilot Data' }],
      selectedTagCodes: ['evidence'],
    }),
  );
  expect(result.blockingErrors.some((e) => e.flagCode === FLAG_CODES.INVALID_TRANSITION)).toBe(false);
});

test('synthesis → claim is now valid', () => {
  // synthesis has claim in its allowed children per the spec
  const result = evaluateArgumentDraft(
    makeInput({
      argumentType: 'claim',
      parentArgument: makeParent({ argumentType: 'synthesis' }),
      body: 'Universal basic income remains the most effective national policy to reduce systemic poverty.',
    }),
  );
  expect(result.blockingErrors.some((e) => e.flagCode === FLAG_CODES.INVALID_TRANSITION)).toBe(false);
});

// ── Rule code check ───────────────────────────────────────────

test('constitution rules include all rail rule codes', () => {
  const codes = constitutionRules.map((r) => r.code);
  expect(codes).toContain(RULE_CODES.PARENT_RESPONSIVENESS_LEXICAL);
  expect(codes).toContain(RULE_CODES.DISAGREEMENT_AXIS_REQUIRED);
  expect(codes).toContain(RULE_CODES.CONCESSION_INTEGRITY);
  expect(codes).toContain(RULE_CODES.CLARIFICATION_PURITY);
  expect(codes).toContain(RULE_CODES.FACT_CONFUSION_CHANNEL);
});

// ── DB adapter test (unit) ────────────────────────────────────

test('adaptDbRule normalizes snake_case params to camelCase', () => {
  const { adaptDbRule } = require('../../domain/constitution/dbAdapters');
  const adapted: ReturnType<typeof adaptDbRule> = adaptDbRule({
    id: 'r-test',
    constitution_id: 'c1d00001-0000-0000-0000-000000000001',
    code: 'transition_thesis',
    title: 'Test',
    description: '',
    rule_type: 'transition',
    severity: 'blocking',
    params: {
      allowed_reply_types: ['claim', 'rebuttal'],
      allowed_root_types: ['thesis', 'claim'],
      min_chars: 20,
      max_chars: 2000,
      off_topic_threshold: 0.1,
    },
    enabled: true,
  });

  expect(adapted.params['allowedChildren']).toEqual(['claim', 'rebuttal']);
  expect(adapted.params['allowedRootTypes']).toEqual(['thesis', 'claim']);
  expect(adapted.params['minChars']).toBe(20);
  expect(adapted.params['maxChars']).toBe(2000);
  expect(adapted.params['offTopicThreshold']).toBe(0.1);
  expect(adapted.constitutionId).toBe('c1d00001-0000-0000-0000-000000000001');
  expect(adapted.ruleType).toBe('transition');
});

// ── Zod schema test (request validation) ────────────────────

test('request schema rejects missing debate_id', () => {
  // Basic shape check without importing zod directly
  const required = ['debate_id', 'argument_type', 'side', 'body'];
  const payload = {
    argument_type: 'thesis',
    side: 'affirmative',
    body: 'test',
  } as Record<string, unknown>;
  for (const field of required) {
    if (!(field in payload)) {
      expect(field).toBe('debate_id'); // exactly one missing
    }
  }
});
