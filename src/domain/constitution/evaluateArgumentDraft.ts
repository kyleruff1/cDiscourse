import type {
  ArgumentDraftEvaluationInput,
  EvaluationResult,
  EvaluationFlagDetail,
  FlagToPersist,
  FlagCode,
  EvaluationSeverity,
  FlagStatus,
  ConstitutionRule,
} from './types';
import { RULE_CODES, FLAG_CODES } from './types';
import { isValidTransition } from './allowedTransitions';
import { computeExtendedTopicSatisfaction } from './topicSatisfaction';
import { runRailsChecks, railsEntryToFlagToPersist } from './railsChecks';

// ── Civility heuristic patterns ───────────────────────────────
const AD_HOMINEM_PATTERNS = [
  /\b(you('re| are) (stupid|dumb|idiot|ignorant|fool|moron|incompetent))\b/i,
  /\b(what (an|a) (idiot|moron|fool|clown))\b/i,
];

const INCIVILITY_PATTERNS = [
  /\b(shut up|go away|you('re| are) wrong because you)\b/i,
  /\b(f+u+c+k+|s+h+i+t+|a+s+s+h+o+l+e+|b+i+t+c+h+|d+a+m+n+)\b/i,
];

// ── Helpers ───────────────────────────────────────────────────

function findRule(rules: ConstitutionRule[], code: string): ConstitutionRule | undefined {
  return rules.find((r) => r.code === code && r.enabled);
}

function makeFlagDetail(
  ruleCode: string,
  flagCode: FlagCode,
  severity: EvaluationSeverity,
  message: string,
  payload: Record<string, unknown> = {},
): EvaluationFlagDetail {
  return { ruleCode, flagCode, severity, message, payload };
}

function makeFlagToPersist(
  flagCode: FlagCode,
  ruleCode: string,
  source: 'client_rules' | 'server_rules',
  severity: EvaluationSeverity,
  defaultStatus: FlagStatus,
  message: string,
  payload: Record<string, unknown> = {},
  confidence: number | null = null,
): FlagToPersist {
  return { flagCode, ruleCode, source, severity, defaultStatus, confidence, payload, message };
}

function similarityScore(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;

  const aWords = new Set(na.split(' '));
  const bWords = nb.split(' ');
  const overlap = bWords.filter((w) => aWords.has(w)).length;
  const union = new Set([...na.split(' '), ...nb.split(' ')]).size;
  return union === 0 ? 0 : overlap / union;
}

// ── Main evaluation function ──────────────────────────────────

export function evaluateArgumentDraft(input: ArgumentDraftEvaluationInput): EvaluationResult {
  const {
    debateResolution,
    debateDescription,
    parentArgument,
    existingSiblingArguments = [],
    argumentType,
    body,
    selectedTagCodes,
    attachedEvidence = [],
    activeRules,
    flagDefinitions,
    evaluationContext = 'client',
    target,
  } = input;

  const source: 'client_rules' | 'server_rules' =
    evaluationContext === 'server' ? 'server_rules' : 'client_rules';

  const blockingErrors: EvaluationFlagDetail[] = [];
  const warnings: EvaluationFlagDetail[] = [];
  const flagsToPersist: FlagToPersist[] = [];

  function getFlagDef(code: FlagCode) {
    return flagDefinitions.find((fd) => fd.code === code);
  }

  function addBlocking(detail: EvaluationFlagDetail, flagCode: FlagCode) {
    blockingErrors.push(detail);
    const def = getFlagDef(flagCode);
    flagsToPersist.push(
      makeFlagToPersist(
        flagCode,
        detail.ruleCode,
        source,
        detail.severity,
        def?.defaultStatus ?? 'open',
        detail.message,
        detail.payload,
      ),
    );
  }

  function addWarning(detail: EvaluationFlagDetail, flagCode: FlagCode, confidence?: number) {
    warnings.push(detail);
    const def = getFlagDef(flagCode);
    flagsToPersist.push(
      makeFlagToPersist(
        flagCode,
        detail.ruleCode,
        source,
        detail.severity,
        def?.defaultStatus ?? 'open',
        detail.message,
        detail.payload,
        confidence ?? null,
      ),
    );
  }

  // ── C-STRUCT-001: parent/root structure ───────────────────────
  const parentRequiredRule = findRule(activeRules, RULE_CODES.PARENT_REQUIRED);
  const rootTypeAllowedRule = findRule(activeRules, RULE_CODES.ROOT_TYPE_ALLOWED);

  // Support both camelCase (local) and snake_case (DB) param keys.
  const allowedRootTypes: string[] =
    (rootTypeAllowedRule?.params['allowedRootTypes'] as string[] | undefined) ??
    (rootTypeAllowedRule?.params['allowed_root_types'] as string[] | undefined) ??
    ['thesis'];

  if (!parentArgument) {
    if (!allowedRootTypes.includes(argumentType)) {
      if (parentRequiredRule) {
        const detail = makeFlagDetail(
          RULE_CODES.PARENT_REQUIRED,
          FLAG_CODES.MISSING_PARENT,
          'blocking',
          `A ${argumentType} argument requires a parent argument.`,
          { allowedRootTypes },
        );
        addBlocking(detail, FLAG_CODES.MISSING_PARENT);
      } else {
        // No parent_required rule, fall back to root_type_allowed block
        const detail = makeFlagDetail(
          RULE_CODES.ROOT_TYPE_ALLOWED,
          FLAG_CODES.INVALID_TRANSITION,
          'blocking',
          `${argumentType} is not allowed at root level. Allowed root types: ${allowedRootTypes.join(', ')}.`,
          { allowedRootTypes },
        );
        addBlocking(detail, FLAG_CODES.INVALID_TRANSITION);
      }
    }
  }

  // ── C-TRANSITION-001: valid transition from parent ────────────
  if (parentArgument) {
    const valid = isValidTransition(parentArgument.argumentType, argumentType, activeRules);
    if (!valid) {
      const transitionRuleCode = `transition_${parentArgument.argumentType}`;
      const detail = makeFlagDetail(
        transitionRuleCode,
        FLAG_CODES.INVALID_TRANSITION,
        'blocking',
        `${argumentType} is not a valid reply to ${parentArgument.argumentType}.`,
        { parentType: parentArgument.argumentType, childType: argumentType },
      );
      addBlocking(detail, FLAG_CODES.INVALID_TRANSITION);
    }
  }

  // ── C-LENGTH-001: body length bounds ─────────────────────────
  const lengthRule = findRule(activeRules, RULE_CODES.LENGTH_BODY);
  const minChars =
    typeof lengthRule?.params['minChars'] === 'number'
      ? lengthRule.params['minChars']
      : typeof lengthRule?.params['min_chars'] === 'number'
        ? lengthRule.params['min_chars']
        : 20;
  const maxChars =
    typeof lengthRule?.params['maxChars'] === 'number'
      ? lengthRule.params['maxChars']
      : typeof lengthRule?.params['max_chars'] === 'number'
        ? lengthRule.params['max_chars']
        : 2000;

  // Stage 6.2 UX rescue: only EMPTY body hard-blocks. A short-but-nonempty
  // body becomes an advisory warning.
  if (body.length === 0) {
    const detail = makeFlagDetail(
      RULE_CODES.LENGTH_BODY,
      FLAG_CODES.UNCLEAR_CLAIM,
      'blocking',
      `Argument body cannot be empty.`,
      { bodyLength: body.length, minChars, maxChars },
    );
    addBlocking(detail, FLAG_CODES.UNCLEAR_CLAIM);
  } else if (body.length < minChars) {
    const detail = makeFlagDetail(
      RULE_CODES.LENGTH_BODY,
      FLAG_CODES.UNCLEAR_CLAIM,
      'warning',
      `Short body — you can post, but a longer reply is usually clearer.`,
      { bodyLength: body.length, minChars, maxChars },
    );
    addWarning(detail, FLAG_CODES.UNCLEAR_CLAIM);
  } else if (body.length > maxChars) {
    const detail = makeFlagDetail(
      RULE_CODES.LENGTH_BODY,
      FLAG_CODES.EXCESSIVE_LENGTH,
      'blocking',
      `Argument body exceeds the maximum length (${body.length} chars; maximum ${maxChars}).`,
      { bodyLength: body.length, minChars, maxChars },
    );
    addBlocking(detail, FLAG_CODES.EXCESSIVE_LENGTH);
  }

  // ── C-EVIDENCE-001: evidence citation required ────────────────
  const evidenceRule = findRule(activeRules, RULE_CODES.EVIDENCE_SOURCE_REQUIRED);
  const isEvidenceType = argumentType === 'evidence';
  const hasEvidenceTag = selectedTagCodes.includes('evidence');
  if (evidenceRule && (isEvidenceType || hasEvidenceTag)) {
    const hasSource =
      attachedEvidence.length > 0 &&
      attachedEvidence.some((e) => (e.url && e.url.trim()) || (e.sourceText && e.sourceText.trim()));
    if (!hasSource) {
      const detail = makeFlagDetail(
        RULE_CODES.EVIDENCE_SOURCE_REQUIRED,
        FLAG_CODES.EVIDENCE_REQUIRED,
        'blocking',
        'Evidence arguments must include at least one source (URL or source text).',
      );
      addBlocking(detail, FLAG_CODES.EVIDENCE_REQUIRED);
    }
  }

  // ── C-TOPIC-001: lexical topic satisfaction (extended) ────────
  const topicSatisfactionCheck = computeExtendedTopicSatisfaction(
    body,
    debateResolution,
    debateDescription,
    parentArgument?.body,
    activeRules,
  );

  // Stage 6.2 UX rescue: off-topic is advisory only. Normal users should
  // not be blocked because a deterministic lexical score thinks the body
  // doesn't share enough words with the resolution.
  if (topicSatisfactionCheck.status === 'failed') {
    const detail = makeFlagDetail(
      RULE_CODES.TOPIC_SATISFACTION_LEXICAL,
      FLAG_CODES.OFF_TOPIC,
      'warning',
      `This may be drifting from the topic.`,
      {
        score: topicSatisfactionCheck.score,
        matchedTerms: topicSatisfactionCheck.matchedTerms,
        resolutionScore: topicSatisfactionCheck.resolutionScore,
        parentScore: topicSatisfactionCheck.parentScore,
      },
    );
    addWarning(detail, FLAG_CODES.OFF_TOPIC, topicSatisfactionCheck.score);
  } else if (topicSatisfactionCheck.status === 'weak') {
    const detail = makeFlagDetail(
      RULE_CODES.TOPIC_SATISFACTION_LEXICAL,
      FLAG_CODES.WEAK_TOPIC,
      'warning',
      `Argument has weak topic coverage (combined score ${(topicSatisfactionCheck.score * 100).toFixed(0)}%).`,
      {
        score: topicSatisfactionCheck.score,
        matchedTerms: topicSatisfactionCheck.matchedTerms,
        resolutionScore: topicSatisfactionCheck.resolutionScore,
        parentScore: topicSatisfactionCheck.parentScore,
      },
    );
    addWarning(detail, FLAG_CODES.WEAK_TOPIC, topicSatisfactionCheck.score);
  }

  // ── C-CIVILITY-001: civility heuristic ───────────────────────
  const civilityRule = findRule(activeRules, RULE_CODES.CIVILITY_HEURISTIC);
  if (civilityRule) {
    const isAdHominem = AD_HOMINEM_PATTERNS.some((p) => p.test(body));
    const isUncivil = INCIVILITY_PATTERNS.some((p) => p.test(body));

    if (isAdHominem) {
      const detail = makeFlagDetail(
        RULE_CODES.CIVILITY_HEURISTIC,
        FLAG_CODES.AD_HOMINEM,
        'review',
        'Possible personal attack detected. Please focus on arguments, not participants.',
      );
      addWarning(detail, FLAG_CODES.AD_HOMINEM);
    } else if (isUncivil) {
      const detail = makeFlagDetail(
        RULE_CODES.CIVILITY_HEURISTIC,
        FLAG_CODES.CIVILITY_RISK,
        'review',
        'Possible incivility detected. Please maintain respectful discourse.',
      );
      addWarning(detail, FLAG_CODES.CIVILITY_RISK);
    }
  }

  // ── C-DUPLICATE-001: sibling similarity ──────────────────────
  for (const sibling of existingSiblingArguments) {
    const score = similarityScore(body, sibling.body);
    if (score >= 0.7) {
      const detail = makeFlagDetail(
        RULE_CODES.DUPLICATE_SIBLING,
        FLAG_CODES.DUPLICATE,
        'warning',
        `This argument is very similar to an existing argument in the same thread (similarity: ${(score * 100).toFixed(0)}%).`,
        { siblingId: sibling.id, similarityScore: score },
      );
      addWarning(detail, FLAG_CODES.DUPLICATE, score);
      break;
    }
  }

  // ── C-RAIL-001–005: discourse rails ──────────────────────────
  const railsResult = runRailsChecks({
    argumentType,
    body,
    parentBody: parentArgument?.body,
    selectedTagCodes,
    target,
    activeRules,
    source,
  });

  for (const entry of railsResult.entries) {
    if (entry.kind === 'blocking') {
      blockingErrors.push(entry.detail);
    } else {
      warnings.push(entry.detail);
    }
    const def = getFlagDef(entry.flagCode);
    flagsToPersist.push(
      railsEntryToFlagToPersist(entry, source, def?.defaultStatus),
    );
  }

  // ── Tag normalization ─────────────────────────────────────────
  const { tagDefinitions } = input;
  const normalizedTags = selectedTagCodes.filter((code) =>
    tagDefinitions.some((td) => td.code === code && td.enabled),
  );

  // ── Build validation payloads ─────────────────────────────────
  const checkedAt = new Date().toISOString();
  const constitutionVersion = input.activeConstitution.version;
  const ruleCodesChecked = activeRules.filter((r) => r.enabled).map((r) => r.code);

  const clientValidationPayload = {
    checkedAt,
    constitutionVersion,
    ruleCodesChecked,
    flagCount: blockingErrors.length + warnings.length,
    blockingCount: blockingErrors.length,
  };

  const serverValidationPayload = {
    ...clientValidationPayload,
  };

  return {
    allowPost: blockingErrors.length === 0,
    blockingErrors,
    warnings,
    flagsToPersist,
    topicSatisfactionCheck,
    normalizedTags,
    clientValidationPayload,
    serverValidationPayload,
  };
}
