import type { ComposerDraft } from './composerState';
import type { ArgumentRow } from './types';
import type { Debate } from '../debates/types';
import type {
  ArgumentDraftEvaluationInput,
  ConstitutionVersion,
  ConstitutionRule,
  ConstitutionTagDef,
  ConstitutionFlagDef,
  ParentArgument,
} from '../../domain/constitution/types';

export interface ComposerConstitutionData {
  activeConstitution: ConstitutionVersion;
  activeRules: ConstitutionRule[];
  tagDefinitions: ConstitutionTagDef[];
  flagDefinitions: ConstitutionFlagDef[];
}

/**
 * Maps the current composer draft and debate context into the input shape
 * required by evaluateArgumentDraft. Returns null when required fields
 * (argumentType or side) are absent — callers should skip evaluation in
 * that case rather than passing an incomplete input.
 *
 * Pure function: no Supabase calls, no React imports.
 */
export function buildEvaluationInput(
  draft: ComposerDraft,
  debate: Debate,
  parentArgument: ArgumentRow | null,
  constitution: ComposerConstitutionData,
): ArgumentDraftEvaluationInput | null {
  if (!draft.argumentType || !draft.side) return null;

  const parent: ParentArgument | undefined = parentArgument
    ? {
        id: parentArgument.id,
        argumentType: parentArgument.argumentType,
        side: parentArgument.side,
        body: parentArgument.body,
        depth: parentArgument.depth,
      }
    : undefined;

  return {
    debateId: debate.id,
    debateResolution: debate.resolution,
    debateDescription: debate.description,
    parentArgument: parent,
    argumentType: draft.argumentType,
    side: draft.side,
    body: draft.body,
    selectedTagCodes: draft.selectedTagCodes,
    attachedEvidence: draft.attachedEvidence,
    activeConstitution: constitution.activeConstitution,
    activeRules: constitution.activeRules,
    tagDefinitions: constitution.tagDefinitions,
    flagDefinitions: constitution.flagDefinitions,
    evaluationContext: 'client',
    target: {
      targetExcerpt: draft.targetExcerpt ?? undefined,
      disagreementAxis: draft.disagreementAxis ?? undefined,
    },
  };
}
