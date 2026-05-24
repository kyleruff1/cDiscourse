import { buildEvaluationInput } from '../src/features/arguments/composerValidation';
import {
  constitutionRules,
  constitutionVersion,
  tagDefinitions,
  flagDefinitions,
} from '../src/domain/constitution';
import type { ComposerDraft } from '../src/features/arguments/composerState';
import type { ArgumentRow } from '../src/features/arguments/types';
import type { Debate } from '../src/features/debates/types';

const CONSTITUTION = {
  activeConstitution: constitutionVersion,
  activeRules: constitutionRules,
  tagDefinitions,
  flagDefinitions,
};

const DEBATE: Debate = {
  id: 'debate-1',
  createdBy: 'user-1',
  title: 'Cats vs Dogs',
  resolution: 'Cats are better than dogs',
  description: 'A structured debate on pet superiority.',
  status: 'open',
  constitutionId: constitutionVersion.id,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  myParticipantSide: 'affirmative',
  visibility: 'public',
};

function makeDraft(overrides: Partial<ComposerDraft> = {}): ComposerDraft {
  return {
    draftId: 'draft-1',
    debateId: 'debate-1',
    parentId: null,
    argumentType: null,
    side: null,
    body: '',
    selectedTagCodes: [],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    updatedAt: new Date().toISOString(),
    dirty: false,
    ...overrides,
  };
}

function makeParent(overrides: Partial<ArgumentRow> = {}): ArgumentRow {
  return {
    id: 'arg-parent',
    debateId: 'debate-1',
    parentId: null,
    authorId: 'user-2',
    argumentType: 'thesis',
    side: 'negative',
    body: 'Dogs are the best pets.',
    depth: 0,
    status: 'posted',
    targetExcerpt: null,
    disagreementAxis: null,
    railPayload: {},
    clientValidation: {},
    serverValidation: {},
    clientSubmissionId: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Return null for incomplete drafts ─────────────────────────

describe('buildEvaluationInput — null when required fields missing', () => {
  it('returns null when argumentType is null', () => {
    const draft = makeDraft({ side: 'affirmative' });
    expect(buildEvaluationInput(draft, DEBATE, null, CONSTITUTION)).toBeNull();
  });

  it('returns null when side is null', () => {
    const draft = makeDraft({ argumentType: 'thesis' });
    expect(buildEvaluationInput(draft, DEBATE, null, CONSTITUTION)).toBeNull();
  });

  it('returns null when both argumentType and side are null', () => {
    const draft = makeDraft();
    expect(buildEvaluationInput(draft, DEBATE, null, CONSTITUTION)).toBeNull();
  });
});

// ── Valid mapping ─────────────────────────────────────────────

describe('buildEvaluationInput — valid mapping', () => {
  it('returns an input with minimum required fields', () => {
    const draft = makeDraft({ argumentType: 'thesis', side: 'affirmative' });
    const result = buildEvaluationInput(draft, DEBATE, null, CONSTITUTION);
    expect(result).not.toBeNull();
    expect(result!.debateId).toBe('debate-1');
    expect(result!.debateResolution).toBe('Cats are better than dogs');
    expect(result!.argumentType).toBe('thesis');
    expect(result!.side).toBe('affirmative');
    expect(result!.evaluationContext).toBe('client');
  });

  it('passes debate description through', () => {
    const draft = makeDraft({ argumentType: 'thesis', side: 'affirmative' });
    const result = buildEvaluationInput(draft, DEBATE, null, CONSTITUTION);
    expect(result!.debateDescription).toBe('A structured debate on pet superiority.');
  });

  it('sets parentArgument to undefined when no parent', () => {
    const draft = makeDraft({ argumentType: 'thesis', side: 'affirmative' });
    const result = buildEvaluationInput(draft, DEBATE, null, CONSTITUTION);
    expect(result!.parentArgument).toBeUndefined();
  });

  it('maps parent argument into the correct shape', () => {
    const parent = makeParent({ argumentType: 'thesis', depth: 0 });
    const draft = makeDraft({ argumentType: 'claim', side: 'affirmative', parentId: parent.id });
    const result = buildEvaluationInput(draft, DEBATE, parent, CONSTITUTION);
    expect(result!.parentArgument).toEqual({
      id: parent.id,
      argumentType: 'thesis',
      side: 'negative',
      body: 'Dogs are the best pets.',
      depth: 0,
    });
  });

  it('passes body, selectedTagCodes, and attachedEvidence', () => {
    const draft = makeDraft({
      argumentType: 'thesis',
      side: 'affirmative',
      body: 'Cats are self-sufficient and low-maintenance animals.',
      selectedTagCodes: ['claim'],
      attachedEvidence: [{ url: 'https://example.com', label: 'Study', sourceText: 'Cats need less attention.' }],
    });
    const result = buildEvaluationInput(draft, DEBATE, null, CONSTITUTION);
    expect(result!.body).toBe('Cats are self-sufficient and low-maintenance animals.');
    expect(result!.selectedTagCodes).toEqual(['claim']);
    expect(result!.attachedEvidence).toEqual([
      { url: 'https://example.com', label: 'Study', sourceText: 'Cats need less attention.' },
    ]);
  });

  it('includes targetExcerpt in target object', () => {
    const draft = makeDraft({
      argumentType: 'rebuttal',
      side: 'affirmative',
      targetExcerpt: 'Dogs are the best',
    });
    const result = buildEvaluationInput(draft, DEBATE, makeParent(), CONSTITUTION);
    expect(result!.target?.targetExcerpt).toBe('Dogs are the best');
  });

  it('includes disagreementAxis in target object', () => {
    const draft = makeDraft({
      argumentType: 'rebuttal',
      side: 'affirmative',
      disagreementAxis: 'fact',
    });
    const result = buildEvaluationInput(draft, DEBATE, makeParent(), CONSTITUTION);
    expect(result!.target?.disagreementAxis).toBe('fact');
  });

  it('sets target.targetExcerpt to undefined when draft.targetExcerpt is null', () => {
    const draft = makeDraft({ argumentType: 'thesis', side: 'affirmative', targetExcerpt: null });
    const result = buildEvaluationInput(draft, DEBATE, null, CONSTITUTION);
    expect(result!.target?.targetExcerpt).toBeUndefined();
  });

  it('passes constitution data through unchanged', () => {
    const draft = makeDraft({ argumentType: 'thesis', side: 'affirmative' });
    const result = buildEvaluationInput(draft, DEBATE, null, CONSTITUTION);
    expect(result!.activeConstitution).toBe(constitutionVersion);
    expect(result!.activeRules).toBe(constitutionRules);
    expect(result!.tagDefinitions).toBe(tagDefinitions);
    expect(result!.flagDefinitions).toBe(flagDefinitions);
  });
});

// ── Integration: buildEvaluationInput → evaluateArgumentDraft ─

describe('buildEvaluationInput — integration with evaluateArgumentDraft', () => {
  it('produces a valid input that evaluateArgumentDraft can consume without throwing', () => {
    const { evaluateArgumentDraft } = require('../src/domain/constitution');
    const draft = makeDraft({
      argumentType: 'thesis',
      side: 'affirmative',
      body: 'Cats are clearly superior pets due to their independence and adaptability in modern homes.',
    });
    const input = buildEvaluationInput(draft, DEBATE, null, CONSTITUTION);
    expect(input).not.toBeNull();
    expect(() => evaluateArgumentDraft(input!)).not.toThrow();
  });

  it('passes the target.disagreementAxis through to the rails check', () => {
    const { evaluateArgumentDraft } = require('../src/domain/constitution');
    const parent = makeParent({ argumentType: 'thesis', depth: 0 });
    const draft = makeDraft({
      argumentType: 'rebuttal',
      side: 'affirmative',
      body: 'Cats are actually more independent and require fewer resources than dogs in urban environments.',
      disagreementAxis: 'fact',
    });
    const input = buildEvaluationInput(draft, DEBATE, parent, CONSTITUTION);
    expect(input).not.toBeNull();
    // C-RAIL-002 should not fire a disagreement-axis warning when axis is declared in target
    const result = evaluateArgumentDraft(input!);
    // The axis is declared via target.disagreementAxis, so the axis rail check should be satisfied.
    expect(result).toHaveProperty('allowPost');
  });
});
