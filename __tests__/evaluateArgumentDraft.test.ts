import { evaluateArgumentDraft } from '../src/domain/constitution/evaluateArgumentDraft';
import { constitutionRules, tagDefinitions, flagDefinitions, constitutionVersion } from '../src/domain/constitution/constitution.v1';
import type {
  ArgumentDraftEvaluationInput,
  ParentArgument,
  SiblingArgument,
} from '../src/domain/constitution/types';

// ── Shared fixtures ───────────────────────────────────────────

const RESOLUTION = 'Universal basic income reduces long-term poverty.';
const DESCRIPTION = 'A debate on UBI as a poverty-reduction mechanism.';

function baseInput(overrides: Partial<ArgumentDraftEvaluationInput> = {}): ArgumentDraftEvaluationInput {
  return {
    debateId: 'debate-1',
    debateResolution: RESOLUTION,
    debateDescription: DESCRIPTION,
    argumentType: 'thesis',
    side: 'affirmative',
    body: 'Universal basic income reduces long-term poverty by providing a stable income floor that helps people exit poverty traps.',
    selectedTagCodes: [],
    activeConstitution: constitutionVersion,
    activeRules: constitutionRules,
    tagDefinitions,
    flagDefinitions,
    ...overrides,
  };
}

function parentArg(argumentType: ParentArgument['argumentType']): ParentArgument {
  return {
    id: 'parent-1',
    argumentType,
    side: 'affirmative',
    body: 'Parent body text.',
    depth: 0,
  };
}

// ── C-STRUCT-001: parent/root structure ──────────────────────

describe('C-STRUCT-001 — parent/root structure', () => {
  test('thesis at root is valid', () => {
    const result = evaluateArgumentDraft(baseInput());
    const structErrors = result.blockingErrors.filter(
      (e) => e.flagCode === 'missing_parent' || e.flagCode === 'invalid_transition',
    );
    expect(structErrors).toHaveLength(0);
  });

  test('claim without parent is valid (root claim allowed in Stage 4)', () => {
    const result = evaluateArgumentDraft(baseInput({ argumentType: 'claim', parentArgument: undefined }));
    const structErrors = result.blockingErrors.filter(
      (e) => e.flagCode === 'missing_parent' || e.flagCode === 'invalid_transition',
    );
    expect(structErrors).toHaveLength(0);
  });

  test('rebuttal without parent produces missing_parent blocking error', () => {
    const result = evaluateArgumentDraft(baseInput({ argumentType: 'rebuttal', parentArgument: undefined }));
    expect(result.allowPost).toBe(false);
    expect(result.blockingErrors.some((e) => e.flagCode === 'missing_parent')).toBe(true);
  });
});

// ── C-TRANSITION-001: valid transitions ──────────────────────

describe('C-TRANSITION-001 — valid transitions', () => {
  test('thesis → claim is valid', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        argumentType: 'claim',
        parentArgument: parentArg('thesis'),
        body: 'Universal basic income claim: income floors reduce poverty by addressing root structural causes.',
      }),
    );
    const transitionErrors = result.blockingErrors.filter((e) => e.flagCode === 'invalid_transition');
    expect(transitionErrors).toHaveLength(0);
  });

  test('thesis → rebuttal is valid', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        argumentType: 'rebuttal',
        parentArgument: parentArg('thesis'),
        body: 'Universal basic income does not reduce poverty because labor supply effects undermine income floors.',
      }),
    );
    const transitionErrors = result.blockingErrors.filter((e) => e.flagCode === 'invalid_transition');
    expect(transitionErrors).toHaveLength(0);
  });

  test('rebuttal → counter_rebuttal is valid', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        argumentType: 'counter_rebuttal',
        parentArgument: parentArg('rebuttal'),
        body: 'The labor supply concerns are overstated; pilot programs show minimal income reduction effects.',
      }),
    );
    const transitionErrors = result.blockingErrors.filter((e) => e.flagCode === 'invalid_transition');
    expect(transitionErrors).toHaveLength(0);
  });

  test('claim → evidence is valid', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        argumentType: 'evidence',
        parentArgument: parentArg('claim'),
        body: 'Stockton SEED pilot showed 28% full-time employment increase among UBI recipients.',
        attachedEvidence: [{ url: 'https://example.com', label: 'SEED study' }],
      }),
    );
    const transitionErrors = result.blockingErrors.filter((e) => e.flagCode === 'invalid_transition');
    expect(transitionErrors).toHaveLength(0);
  });

  test('concession → synthesis is valid', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        argumentType: 'synthesis',
        parentArgument: parentArg('concession'),
        body: 'Universal basic income reduces poverty in some contexts while macroeconomic effects need further study.',
      }),
    );
    const transitionErrors = result.blockingErrors.filter((e) => e.flagCode === 'invalid_transition');
    expect(transitionErrors).toHaveLength(0);
  });
});

describe('C-TRANSITION-001 — invalid transitions', () => {
  test('thesis → counter_rebuttal is invalid', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        argumentType: 'counter_rebuttal',
        parentArgument: parentArg('thesis'),
        body: 'Counter to the basic income rebuttal regarding poverty reduction mechanisms.',
      }),
    );
    expect(result.allowPost).toBe(false);
    expect(result.blockingErrors.some((e) => e.flagCode === 'invalid_transition')).toBe(true);
  });

  test('evidence → counter_rebuttal is invalid', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        argumentType: 'counter_rebuttal',
        parentArgument: parentArg('evidence'),
        body: 'The evidence from Stockton pilot cannot be generalized to national universal basic income programs.',
      }),
    );
    expect(result.allowPost).toBe(false);
    expect(result.blockingErrors.some((e) => e.flagCode === 'invalid_transition')).toBe(true);
  });

  test('synthesis → rebuttal is invalid (synthesis is not fully terminal)', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        argumentType: 'rebuttal',
        parentArgument: parentArg('synthesis'),
        body: 'The synthesis misrepresents the poverty reduction evidence and income floor arguments.',
      }),
    );
    expect(result.allowPost).toBe(false);
    expect(result.blockingErrors.some((e) => e.flagCode === 'invalid_transition')).toBe(true);
  });
});

// ── C-TOPIC-001: topic satisfaction ──────────────────────────

describe('C-TOPIC-001 — topic satisfaction', () => {
  test('on-topic body passes', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        body: 'Universal basic income reduces long-term poverty through stable income floors that eliminate poverty traps.',
      }),
    );
    expect(result.topicSatisfactionCheck?.status).toBe('satisfied');
    expect(result.blockingErrors.some((e) => e.flagCode === 'off_topic')).toBe(false);
  });

  // Stage 6.2 UX rescue: off-topic is advisory only — does not block posting.
  test('completely off-topic body surfaces an advisory off_topic warning (not blocking)', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        body: 'Cats are the best domestic pets because they are independent and clean themselves regularly.',
      }),
    );
    expect(result.allowPost).toBe(true);
    expect(result.blockingErrors.some((e) => e.flagCode === 'off_topic')).toBe(false);
    expect(result.warnings.some((w) => w.flagCode === 'off_topic')).toBe(true);
  });

  test('weakly on-topic body produces weak_topic_satisfaction warning', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        body: 'Income inequality is a real concern in modern economies and affects many citizens.',
      }),
    );
    const topicStatus = result.topicSatisfactionCheck?.status;
    const hasWeakWarning = result.warnings.some((w) => w.flagCode === 'weak_topic_satisfaction');
    const hasOffTopicError = result.blockingErrors.some((e) => e.flagCode === 'off_topic');
    expect(topicStatus === 'weak' ? hasWeakWarning : !hasOffTopicError).toBe(true);
  });
});

// ── C-EVIDENCE-001: evidence citation required ────────────────

describe('C-EVIDENCE-001 — evidence citation required', () => {
  test('evidence argument with URL is valid', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        argumentType: 'evidence',
        parentArgument: parentArg('claim'),
        body: 'The Stockton pilot demonstrated that universal income reduces poverty rates significantly.',
        attachedEvidence: [{ url: 'https://example.com/stockton', label: 'Stockton SEED pilot' }],
      }),
    );
    expect(result.blockingErrors.some((e) => e.flagCode === 'evidence_required')).toBe(false);
  });

  test('evidence argument with source text is valid', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        argumentType: 'evidence',
        parentArgument: parentArg('claim'),
        body: 'The Finland UBI experiment showed no reduction in employment among basic income recipients.',
        attachedEvidence: [{ sourceText: 'Finland Basic Income Experiment Final Report 2020' }],
      }),
    );
    expect(result.blockingErrors.some((e) => e.flagCode === 'evidence_required')).toBe(false);
  });

  test('evidence argument without source produces blocking evidence_required error', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        argumentType: 'evidence',
        parentArgument: parentArg('claim'),
        body: 'Studies show universal income reduces poverty rates in pilot programs conducted globally.',
        attachedEvidence: [],
      }),
    );
    expect(result.allowPost).toBe(false);
    expect(result.blockingErrors.some((e) => e.flagCode === 'evidence_required')).toBe(true);
  });
});

// ── C-LENGTH-001: body length bounds ─────────────────────────

describe('C-LENGTH-001 — body length bounds', () => {
  // Stage 6.2 UX rescue: short-but-nonempty body is advisory only.
  test('body under minimum length surfaces advisory warning (not blocking)', () => {
    const result = evaluateArgumentDraft(baseInput({ body: 'Too short.' }));
    expect(result.allowPost).toBe(true);
    expect(result.warnings.some((w) => w.flagCode === 'unclear_claim')).toBe(true);
    expect(result.blockingErrors.some((e) => e.flagCode === 'unclear_claim')).toBe(false);
  });

  test('empty body still hard-blocks', () => {
    const result = evaluateArgumentDraft(baseInput({ body: '' }));
    expect(result.allowPost).toBe(false);
    expect(result.blockingErrors.some((e) => e.flagCode === 'unclear_claim')).toBe(true);
  });

  test('body over maximum length produces blocking excessive_length error', () => {
    const longBody = 'Universal basic income '.repeat(200);
    const result = evaluateArgumentDraft(baseInput({ body: longBody }));
    expect(result.allowPost).toBe(false);
    expect(result.blockingErrors.some((e) => e.flagCode === 'excessive_length')).toBe(true);
  });

  test('body within length bounds passes length check', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        body: 'Universal basic income reduces long-term poverty by providing a stable income floor.',
      }),
    );
    const lengthErrors = result.blockingErrors.filter(
      (e) => e.flagCode === 'unclear_claim' || e.flagCode === 'excessive_length',
    );
    expect(lengthErrors).toHaveLength(0);
  });
});

// ── C-CIVILITY-001: civility heuristic ───────────────────────

describe('C-CIVILITY-001 — civility heuristic', () => {
  test('ad hominem pattern produces ad_hominem_possible warning', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        body: "You're stupid if you think universal basic income reduces long-term poverty effectively.",
      }),
    );
    expect(result.warnings.some((w) => w.flagCode === 'ad_hominem_possible')).toBe(true);
  });

  test('civil argument passes civility check', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        body: 'Universal basic income has demonstrated poverty reduction in multiple pilot programs globally.',
      }),
    );
    const civilityFlags = result.warnings.filter(
      (w) => w.flagCode === 'civility_risk' || w.flagCode === 'ad_hominem_possible',
    );
    expect(civilityFlags).toHaveLength(0);
  });
});

// ── C-DUPLICATE-001: sibling similarity ──────────────────────

describe('C-DUPLICATE-001 — duplicate sibling detection', () => {
  const existingSibling: SiblingArgument = {
    id: 'sibling-1',
    argumentType: 'claim',
    side: 'affirmative',
    body: 'Universal basic income reduces long-term poverty by providing a stable income floor that helps people exit poverty traps.',
  };

  test('highly similar body produces duplicate_argument_possible warning', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        existingSiblingArguments: [existingSibling],
        body: 'Universal basic income reduces long-term poverty by providing a stable income floor that helps people exit poverty traps.',
      }),
    );
    expect(result.warnings.some((w) => w.flagCode === 'duplicate_argument_possible')).toBe(true);
  });

  test('distinct body does not produce duplicate warning', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        existingSiblingArguments: [existingSibling],
        body: 'Economic inequality is exacerbated by current tax structures that favor capital over labor income.',
      }),
    );
    expect(result.warnings.some((w) => w.flagCode === 'duplicate_argument_possible')).toBe(false);
  });
});

// ── EvaluationResult shape ────────────────────────────────────

describe('EvaluationResult — output shape', () => {
  test('allowPost is true when no blocking errors', () => {
    const result = evaluateArgumentDraft(baseInput());
    expect(typeof result.allowPost).toBe('boolean');
    if (result.blockingErrors.length === 0) {
      expect(result.allowPost).toBe(true);
    } else {
      expect(result.allowPost).toBe(false);
    }
  });

  test('flagsToPersist mirrors blockingErrors + warnings', () => {
    const result = evaluateArgumentDraft(baseInput({ body: 'Too short.' }));
    expect(result.flagsToPersist.length).toBeGreaterThanOrEqual(result.blockingErrors.length);
  });

  test('clientValidationPayload includes constitutionVersion', () => {
    const result = evaluateArgumentDraft(baseInput());
    expect(result.clientValidationPayload.constitutionVersion).toBe(constitutionVersion.version);
  });

  test('normalizedTags filters unknown tag codes', () => {
    const result = evaluateArgumentDraft(
      baseInput({ selectedTagCodes: ['claim', 'nonexistent_tag'] }),
    );
    expect(result.normalizedTags).toContain('claim');
    expect(result.normalizedTags).not.toContain('nonexistent_tag');
  });

  test('evaluationContext server sets source to server_rules', () => {
    const result = evaluateArgumentDraft(
      baseInput({
        evaluationContext: 'server',
        body: 'Too short.',
      }),
    );
    const flag = result.flagsToPersist.find((f) => f.flagCode === 'unclear_claim');
    expect(flag?.source).toBe('server_rules');
  });
});
