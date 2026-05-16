// MIRROR of src/domain/constitution/allowedTransitions.ts
// Only difference: imports use explicit .ts extensions for Deno compatibility.
// Keep in sync with the source file.
import type { ArgumentType, ConstitutionRule } from './types.ts';
import { RULE_CODES } from './types.ts';

const TRANSITION_RULE_MAP: Record<ArgumentType, string> = {
  thesis: RULE_CODES.TRANSITION_THESIS,
  claim: RULE_CODES.TRANSITION_CLAIM,
  rebuttal: RULE_CODES.TRANSITION_REBUTTAL,
  counter_rebuttal: RULE_CODES.TRANSITION_COUNTER_REBUTTAL,
  evidence: RULE_CODES.TRANSITION_EVIDENCE,
  clarification_request: RULE_CODES.TRANSITION_CLARIFICATION_REQUEST,
  concession: RULE_CODES.TRANSITION_CONCESSION,
  synthesis: RULE_CODES.TRANSITION_SYNTHESIS,
};

export function getAllowedReplies(
  parentType: ArgumentType,
  rules: ConstitutionRule[],
): ArgumentType[] {
  const ruleCode = TRANSITION_RULE_MAP[parentType];
  const rule = rules.find((r) => r.code === ruleCode && r.enabled);
  if (!rule) return [];
  const allowed = rule.params['allowedChildren'] ?? rule.params['allowed_reply_types'];
  if (!Array.isArray(allowed)) return [];
  return allowed as ArgumentType[];
}

export function isValidTransition(
  parentType: ArgumentType,
  childType: ArgumentType,
  rules: ConstitutionRule[],
): boolean {
  return getAllowedReplies(parentType, rules).includes(childType);
}

export function buildTransitionMatrix(
  rules: ConstitutionRule[],
): Partial<Record<ArgumentType, ArgumentType[]>> {
  const matrix: Partial<Record<ArgumentType, ArgumentType[]>> = {};
  for (const parentType of Object.keys(TRANSITION_RULE_MAP) as ArgumentType[]) {
    const allowed = getAllowedReplies(parentType, rules);
    if (allowed.length > 0) {
      matrix[parentType] = allowed;
    }
  }
  return matrix;
}
