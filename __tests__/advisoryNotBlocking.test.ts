/**
 * Stage 6.2 — Milestone 9: validation rails advisory contract.
 *
 * Asserts that the following are NEVER blocking for ordinary replies:
 *   - low topic score / weak topic satisfaction;
 *   - low parent lexical overlap;
 *   - missing target excerpt;
 *   - missing concession marker phrase;
 *   - missing clarification question structure;
 *   - missing disagreement axis;
 *   - short-but-nonempty body.
 *
 * And that these REMAIN blocking:
 *   - empty body;
 *   - over-max body;
 *   - invalid transition;
 *   - explicit Evidence post without source.
 */
import { evaluateArgumentDraft } from '../src/domain/constitution/evaluateArgumentDraft';
import { runRailsChecks } from '../src/domain/constitution/railsChecks';
import { FLAG_CODES } from '../src/domain/constitution/types';
import { constitutionRules, tagDefinitions, flagDefinitions, constitutionVersion } from '../src/domain/constitution/constitution.v1';
import type {
  ArgumentDraftEvaluationInput,
  ParentArgument,
} from '../src/domain/constitution/types';

const RESOLUTION = 'Universal basic income reduces long-term poverty.';
const DESCRIPTION = 'A debate on UBI as a poverty-reduction mechanism.';

function parent(argumentType: ParentArgument['argumentType'] = 'thesis'): ParentArgument {
  return { id: 'parent-1', argumentType, side: 'affirmative', body: 'Universal basic income reduces poverty over the long run.', depth: 0 };
}

function baseInput(overrides: Partial<ArgumentDraftEvaluationInput> = {}): ArgumentDraftEvaluationInput {
  return {
    debateId: 'debate-1',
    debateResolution: RESOLUTION,
    debateDescription: DESCRIPTION,
    parentArgument: parent('thesis'),
    argumentType: 'rebuttal',
    side: 'negative',
    body: 'Universal basic income does not reliably reduce poverty in pilot programs studied across multiple countries over the long run.',
    selectedTagCodes: ['fact_disagreement'],
    activeConstitution: constitutionVersion,
    activeRules: constitutionRules,
    tagDefinitions,
    flagDefinitions,
    ...overrides,
  };
}

describe('Stage 6.2 — advisory not blocking', () => {
  test('off-topic body posts; warning is recorded (not blocking)', () => {
    const result = evaluateArgumentDraft(baseInput({
      body: 'Cats are the best domestic pets because they are independent and self-clean regularly enough.',
    }));
    expect(result.allowPost).toBe(true);
    expect(result.warnings.some((w) => w.flagCode === 'off_topic')).toBe(true);
    expect(result.blockingErrors.some((e) => e.flagCode === 'off_topic')).toBe(false);
  });

  test('low parent overlap surfaces advisory warning, not blocking', () => {
    const railResult = runRailsChecks({
      argumentType: 'rebuttal',
      body: 'Cats are wonderful pets that bring joy to households everywhere in the world today nightly.',
      parentBody: 'Universal basic income reduces poverty and increases economic security for citizens nationwide.',
      selectedTagCodes: ['fact_disagreement'],
      activeRules: constitutionRules,
      source: 'server_rules',
    });
    expect(railResult.entries.find((e) => e.flagCode === FLAG_CODES.PARENT_NONRESPONSIVE && e.kind === 'blocking')).toBeUndefined();
    expect(railResult.entries.find((e) => e.flagCode === FLAG_CODES.PARENT_NONRESPONSIVE && e.kind === 'warning')).toBeTruthy();
  });

  test('missing concession marker on a concession does not block', () => {
    const railResult = runRailsChecks({
      argumentType: 'concession',
      body: 'The narrow scope of the bike-lane study seems reasonable, and we can move past this small detail now.',
      parentBody: 'Bike lanes reduce car traffic significantly across most studied urban environments.',
      selectedTagCodes: [],
      activeRules: constitutionRules,
      source: 'server_rules',
    });
    const hasBlocking = railResult.entries.some((e) => e.flagCode === FLAG_CODES.PARENT_NONRESPONSIVE && e.kind === 'blocking');
    expect(hasBlocking).toBe(false);
  });

  test('clarification without a question mark does not block', () => {
    const railResult = runRailsChecks({
      argumentType: 'clarification_request',
      body: 'I am thinking about the definition you used in your last paragraph and want more context generally.',
      parentBody: 'Universal basic income is best understood as a policy lever, not a moral judgement today.',
      selectedTagCodes: [],
      activeRules: constitutionRules,
      source: 'server_rules',
    });
    const hasBlocking = railResult.entries.some((e) => e.kind === 'blocking');
    expect(hasBlocking).toBe(false);
  });

  test('missing disagreement axis does not block', () => {
    const railResult = runRailsChecks({
      argumentType: 'rebuttal',
      body: 'The conclusion does not follow from the premises about universal basic income today reliably across cases.',
      parentBody: 'Universal basic income improves economic outcomes for low-income workers nationwide.',
      selectedTagCodes: [], // no axis
      activeRules: constitutionRules,
      source: 'server_rules',
    });
    expect(railResult.entries.some((e) => e.kind === 'blocking')).toBe(false);
  });

  test('short-but-nonempty body surfaces advisory warning, not blocking', () => {
    const result = evaluateArgumentDraft(baseInput({ body: 'Short.' }));
    expect(result.allowPost).toBe(true);
    expect(result.warnings.some((w) => w.flagCode === 'unclear_claim')).toBe(true);
  });
});

describe('Stage 6.2 — structural blocks remain', () => {
  test('empty body still blocks', () => {
    const result = evaluateArgumentDraft(baseInput({ body: '' }));
    expect(result.allowPost).toBe(false);
    expect(result.blockingErrors.some((e) => e.flagCode === 'unclear_claim')).toBe(true);
  });

  test('over-max body still blocks', () => {
    const longBody = 'Universal basic income reduces poverty in the long run. '.repeat(60);
    const result = evaluateArgumentDraft(baseInput({ body: longBody }));
    expect(result.allowPost).toBe(false);
    expect(result.blockingErrors.some((e) => e.flagCode === 'excessive_length')).toBe(true);
  });

  test('Evidence post without source still blocks', () => {
    const result = evaluateArgumentDraft(baseInput({
      argumentType: 'evidence',
      parentArgument: parent('claim'),
      body: 'Studies indicate universal basic income reduces poverty in pilot programs around the world consistently.',
      attachedEvidence: [],
    }));
    expect(result.allowPost).toBe(false);
    expect(result.blockingErrors.some((e) => e.flagCode === 'evidence_required')).toBe(true);
  });

  test('invalid transition still blocks', () => {
    const result = evaluateArgumentDraft(baseInput({
      argumentType: 'synthesis',
      parentArgument: parent('thesis'),
      body: 'In summary the universal basic income debate has shown that affirmative evidence is decisive globally consistently.',
    }));
    expect(result.allowPost).toBe(false);
    expect(result.blockingErrors.some((e) => e.flagCode === 'invalid_transition')).toBe(true);
  });
});
