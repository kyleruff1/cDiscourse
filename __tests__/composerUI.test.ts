import {
  getAllowedArgumentTypesForParent,
  getTagDefsForArgumentType,
} from '../src/features/arguments/composerHelpers';
import {
  constitutionRules,
  tagDefinitions,
  flagDefinitions,
  constitutionVersion,
  evaluateArgumentDraft,
} from '../src/domain/constitution';

// ── getAllowedArgumentTypesForParent ───────────────────────────

describe('getAllowedArgumentTypesForParent', () => {
  it('returns root-allowed types when parentType is null', () => {
    const result = getAllowedArgumentTypesForParent(null, constitutionRules);
    expect(result).toEqual(expect.arrayContaining(['thesis', 'claim']));
    expect(result).not.toContain('rebuttal');
    expect(result).not.toContain('evidence');
  });

  it('returns thesis children for thesis parent', () => {
    const result = getAllowedArgumentTypesForParent('thesis', constitutionRules);
    expect(result).toEqual(
      expect.arrayContaining(['claim', 'rebuttal', 'evidence', 'clarification_request']),
    );
    expect(result).not.toContain('counter_rebuttal');
    expect(result).not.toContain('concession');
    expect(result).not.toContain('synthesis');
  });

  it('returns claim children for claim parent', () => {
    const result = getAllowedArgumentTypesForParent('claim', constitutionRules);
    expect(result).toEqual(
      expect.arrayContaining(['evidence', 'rebuttal', 'clarification_request', 'concession']),
    );
    expect(result).not.toContain('thesis');
    expect(result).not.toContain('counter_rebuttal');
  });

  it('returns rebuttal children for rebuttal parent', () => {
    const result = getAllowedArgumentTypesForParent('rebuttal', constitutionRules);
    expect(result).toEqual(
      expect.arrayContaining(['counter_rebuttal', 'evidence', 'clarification_request', 'concession']),
    );
    expect(result).not.toContain('thesis');
    expect(result).not.toContain('claim');
  });

  it('returns counter_rebuttal children for counter_rebuttal parent', () => {
    const result = getAllowedArgumentTypesForParent('counter_rebuttal', constitutionRules);
    expect(result).toEqual(
      expect.arrayContaining(['rebuttal', 'evidence', 'clarification_request', 'concession']),
    );
  });

  it('returns evidence children for evidence parent', () => {
    const result = getAllowedArgumentTypesForParent('evidence', constitutionRules);
    expect(result).toEqual(expect.arrayContaining(['clarification_request', 'rebuttal']));
    expect(result.length).toBe(2);
  });

  it('returns concession children for concession parent', () => {
    const result = getAllowedArgumentTypesForParent('concession', constitutionRules);
    expect(result).toEqual(['synthesis']);
  });

  it('returns synthesis children for synthesis parent', () => {
    const result = getAllowedArgumentTypesForParent('synthesis', constitutionRules);
    expect(result).toEqual(expect.arrayContaining(['claim', 'clarification_request']));
  });

  it('falls back to thesis/claim when root_type_allowed rule is missing', () => {
    const rulesWithoutRoot = constitutionRules.filter((r) => r.code !== 'root_type_allowed');
    const result = getAllowedArgumentTypesForParent(null, rulesWithoutRoot);
    expect(result).toEqual(['thesis', 'claim']);
  });

  it('returns empty array when no transition rule exists for the parent type', () => {
    const rulesWithoutTransitions = constitutionRules.filter((r) => r.ruleType !== 'transition');
    const result = getAllowedArgumentTypesForParent('thesis', rulesWithoutTransitions);
    expect(result).toEqual([]);
  });
});

// ── getTagDefsForArgumentType ─────────────────────────────────

describe('getTagDefsForArgumentType', () => {
  it('returns rebuttal tag for rebuttal type', () => {
    const result = getTagDefsForArgumentType('rebuttal', tagDefinitions);
    const codes = result.map((td) => td.code);
    expect(codes).toContain('rebuttal');
  });

  it('returns disagreement-axis tags for rebuttal type', () => {
    const result = getTagDefsForArgumentType('rebuttal', tagDefinitions);
    const axisTags = result.filter((td) => td.category === 'disagreement_axis');
    expect(axisTags.length).toBeGreaterThan(0);
    const codes = axisTags.map((td) => td.code);
    expect(codes).toContain('fact_disagreement');
    expect(codes).toContain('definition_disagreement');
    expect(codes).toContain('causal_disagreement');
    expect(codes).toContain('value_disagreement');
    expect(codes).toContain('evidence_challenge');
    expect(codes).toContain('logic_challenge');
  });

  it('returns disagreement-axis tags for counter_rebuttal type', () => {
    const result = getTagDefsForArgumentType('counter_rebuttal', tagDefinitions);
    const axisCodes = result
      .filter((td) => td.category === 'disagreement_axis')
      .map((td) => td.code);
    expect(axisCodes).toContain('fact_disagreement');
    expect(axisCodes).toContain('logic_challenge');
  });

  it('does not return rebuttal-specific tags for thesis type', () => {
    const result = getTagDefsForArgumentType('thesis', tagDefinitions);
    const codes = result.map((td) => td.code);
    expect(codes).not.toContain('rebuttal');
    expect(codes).not.toContain('fact_disagreement');
    expect(codes).not.toContain('counter_rebuttal');
  });

  it('returns scope_challenge for thesis, claim, and rebuttal', () => {
    expect(
      getTagDefsForArgumentType('thesis', tagDefinitions).map((td) => td.code),
    ).toContain('scope_challenge');
    expect(
      getTagDefsForArgumentType('claim', tagDefinitions).map((td) => td.code),
    ).toContain('scope_challenge');
    expect(
      getTagDefsForArgumentType('rebuttal', tagDefinitions).map((td) => td.code),
    ).toContain('scope_challenge');
  });

  it('does not return scope_challenge for evidence type', () => {
    const result = getTagDefsForArgumentType('evidence', tagDefinitions);
    const codes = result.map((td) => td.code);
    expect(codes).not.toContain('scope_challenge');
  });

  it('returns only evidence tag for evidence type', () => {
    const result = getTagDefsForArgumentType('evidence', tagDefinitions);
    const codes = result.map((td) => td.code);
    expect(codes).toContain('evidence');
    expect(codes).not.toContain('claim');
    expect(codes).not.toContain('rebuttal');
  });

  it('returns source_request and clarification for clarification_request type', () => {
    const result = getTagDefsForArgumentType('clarification_request', tagDefinitions);
    const codes = result.map((td) => td.code);
    expect(codes).toContain('source_request');
    expect(codes).toContain('clarification');
    expect(codes).toContain('evidence_challenge');
  });

  it('excludes disabled tag definitions', () => {
    const defsWithDisabled = [
      ...tagDefinitions,
      {
        code: 'disabled_tag',
        label: 'Disabled',
        description: '',
        category: 'test',
        allowedArgumentTypes: [],
        enabled: false,
      },
    ];
    const result = getTagDefsForArgumentType('thesis', defsWithDisabled);
    expect(result.map((td) => td.code)).not.toContain('disabled_tag');
  });

  it('includes tags with empty allowedArgumentTypes for any type', () => {
    const defsWithUniversal = [
      ...tagDefinitions,
      {
        code: 'universal_tag',
        label: 'Universal',
        description: '',
        category: 'meta',
        allowedArgumentTypes: [],
        enabled: true,
      },
    ];
    expect(
      getTagDefsForArgumentType('thesis', defsWithUniversal).map((td) => td.code),
    ).toContain('universal_tag');
    expect(
      getTagDefsForArgumentType('evidence', defsWithUniversal).map((td) => td.code),
    ).toContain('universal_tag');
  });
});

// ── evaluateArgumentDraft validation mapping ──────────────────

const BASE_INPUT = {
  debateId: 'debate-1',
  debateResolution: 'Cats are better than dogs',
  activeConstitution: constitutionVersion,
  activeRules: constitutionRules,
  tagDefinitions,
  flagDefinitions,
  evaluationContext: 'client' as const,
};

describe('evaluateArgumentDraft — validation mapping', () => {
  it('blocks a rebuttal posted at root level (no parent)', () => {
    const result = evaluateArgumentDraft({
      ...BASE_INPUT,
      argumentType: 'rebuttal',
      side: 'negative',
      body: 'This is a rebuttal argument that is long enough to pass the length check.',
      selectedTagCodes: [],
    });
    expect(result.allowPost).toBe(false);
    const codes = result.blockingErrors.map((e) => e.flagCode);
    expect(codes).toContain('missing_parent');
  });

  it('blocks a body that is too short', () => {
    const result = evaluateArgumentDraft({
      ...BASE_INPUT,
      argumentType: 'thesis',
      side: 'affirmative',
      body: 'Too short',
      selectedTagCodes: [],
    });
    expect(result.allowPost).toBe(false);
    const codes = result.blockingErrors.map((e) => e.flagCode);
    expect(codes).toContain('unclear_claim');
  });

  it('blocks an invalid transition (thesis cannot be a child of thesis)', () => {
    const result = evaluateArgumentDraft({
      ...BASE_INPUT,
      argumentType: 'thesis',
      side: 'affirmative',
      body: 'Cats are clearly superior pets because they are independent and low maintenance.',
      selectedTagCodes: [],
      parentArgument: {
        id: 'parent-1',
        argumentType: 'thesis',
        side: 'negative',
        body: 'Dogs are better than cats.',
        depth: 0,
      },
    });
    expect(result.allowPost).toBe(false);
    const codes = result.blockingErrors.map((e) => e.flagCode);
    expect(codes).toContain('invalid_transition');
  });

  it('allows post when body is long enough and type/parent are valid', () => {
    const result = evaluateArgumentDraft({
      ...BASE_INPUT,
      argumentType: 'thesis',
      side: 'affirmative',
      body: 'Cats are clearly superior pets because they are independent, low maintenance, and perfectly suited to modern lifestyles.',
      selectedTagCodes: [],
    });
    expect(result.blockingErrors.length).toBe(0);
  });

  it('issues warning when disagreement axis is missing for rebuttal', () => {
    const result = evaluateArgumentDraft({
      ...BASE_INPUT,
      argumentType: 'rebuttal',
      side: 'affirmative',
      body: 'Cats are self-sufficient and do not require constant attention like dogs do in most circumstances.',
      selectedTagCodes: [],
      parentArgument: {
        id: 'parent-1',
        argumentType: 'thesis',
        side: 'negative',
        body: 'Dogs are the best pets for companionship because they are loyal.',
        depth: 0,
      },
    });
    const warnCodes = result.warnings.map((w) => w.flagCode);
    // C-RAIL-002 fires unclear_claim warning when no disagreement-axis tag is selected
    expect(warnCodes).toContain('unclear_claim');
  });

  it('normalizedTags excludes unknown tag codes', () => {
    const result = evaluateArgumentDraft({
      ...BASE_INPUT,
      argumentType: 'thesis',
      side: 'affirmative',
      body: 'Cats are clearly superior pets because they are independent and low maintenance.',
      selectedTagCodes: ['claim', 'nonexistent_tag'],
    });
    expect(result.normalizedTags).toContain('claim');
    expect(result.normalizedTags).not.toContain('nonexistent_tag');
  });
});
