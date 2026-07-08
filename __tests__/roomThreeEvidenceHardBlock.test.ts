/**
 * ROOM-003 (#829) — evidence hard-block preserved (HARD AC, no bypass).
 *
 * C-EVIDENCE-001 (EVIDENCE_SOURCE_REQUIRED) still blocks an evidence-typed
 * draft with no source on the fast path. This proves it at the engine + model
 * level the bar consumes: allowPost false -> the bar blocked-flag selector
 * surfaces evidence_required and deriveEntryComposerBarLayout.canSend is
 * false; adding a source flips both. There is no fast-path bypass.
 */
import {
  evaluateArgumentDraft,
  constitutionVersion,
  constitutionRules,
  tagDefinitions,
  flagDefinitions,
} from '../src/domain/constitution';
import { buildEvaluationInput } from '../src/features/arguments/composerValidation';
import {
  deriveEntryComposerBlockingFlag,
  deriveEntryComposerBarLayout,
} from '../src/features/arguments/composer/argumentEntryComposerModel';
import { FLAG_CODES } from '../src/domain/constitution/types';
import type { ComposerDraft } from '../src/features/arguments/composerState';
import type { ArgumentRow } from '../src/features/arguments/types';
import type { Debate } from '../src/features/debates/types';

const DEBATE: Debate = {
  id: 'debate-1',
  createdBy: 'host-1',
  title: 'Bike lanes',
  resolution: 'City streets should add protected bike lanes on arterials.',
  description: 'A debate about street safety and protected bike lanes.',
  status: 'open',
  constitutionId: 'const-1',
  createdAt: '2026-07-08T00:00:00.000Z',
  updatedAt: '2026-07-08T00:00:00.000Z',
  myParticipantSide: 'affirmative',
  visibility: 'public',
};

const PARENT_CLAIM: ArgumentRow = {
  id: 'arg-parent',
  debateId: DEBATE.id,
  parentId: null,
  authorId: 'other-user',
  argumentType: 'claim',
  side: 'negative',
  body: 'Protected bike lanes make arterial streets safer for everyone.',
  depth: 0,
  status: 'posted',
  targetExcerpt: null,
  disagreementAxis: null,
  railPayload: {},
  clientValidation: {},
  serverValidation: {},
  clientSubmissionId: null,
  createdAt: '2026-07-08T00:00:00.000Z',
  updatedAt: '2026-07-08T00:00:00.000Z',
};

const CONSTITUTION = {
  activeConstitution: constitutionVersion,
  activeRules: constitutionRules,
  tagDefinitions,
  flagDefinitions,
};

function evidenceDraft(overrides: Partial<ComposerDraft> = {}): ComposerDraft {
  return {
    draftId: 'draft-1',
    debateId: DEBATE.id,
    parentId: PARENT_CLAIM.id,
    argumentType: 'evidence',
    side: 'affirmative',
    body: 'The city quarterly report shows weeknight ridership rose after the pilot lanes opened.',
    selectedTagCodes: [],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    updatedAt: '2026-07-08T00:00:00.000Z',
    dirty: true,
    ...overrides,
  };
}

function evaluate(draft: ComposerDraft) {
  const input = buildEvaluationInput(draft, DEBATE, PARENT_CLAIM, CONSTITUTION);
  if (!input) throw new Error('expected a non-null evaluation input');
  return evaluateArgumentDraft(input);
}

describe('ROOM-003 evidence hard-block — no fast-path bypass', () => {
  it('an evidence draft with no source is blocked (allowPost false)', () => {
    const evaluation = evaluate(evidenceDraft());
    expect(evaluation.allowPost).toBe(false);
  });

  it('the bar blocked-flag selector surfaces evidence_required for the no-source case', () => {
    const evaluation = evaluate(evidenceDraft());
    const flag = deriveEntryComposerBlockingFlag(evaluation);
    expect(flag?.flagCode).toBe(FLAG_CODES.EVIDENCE_REQUIRED);
  });

  it('the bar canSend is false while the evidence source is missing (Send disabled)', () => {
    const evaluation = evaluate(evidenceDraft());
    const layout = deriveEntryComposerBarLayout({
      bodyLength: evidenceDraft().body.trim().length,
      evaluation,
      hasParent: true,
    });
    expect(layout.canSend).toBe(false);
  });

  it('attaching a source flips the gate — allowPost true, no blocking flag, canSend true', () => {
    const draft = evidenceDraft({
      attachedEvidence: [
        { url: 'https://example.test/report', label: 'Quarterly report', sourceText: 'Ridership rose 18 percent.' },
      ],
    });
    const evaluation = evaluate(draft);
    expect(evaluation.allowPost).toBe(true);
    expect(deriveEntryComposerBlockingFlag(evaluation)).toBeNull();
    const layout = deriveEntryComposerBarLayout({
      bodyLength: draft.body.trim().length,
      evaluation,
      hasParent: true,
    });
    expect(layout.canSend).toBe(true);
  });
});
