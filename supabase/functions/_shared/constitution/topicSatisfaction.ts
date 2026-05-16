// MIRROR of src/domain/constitution/topicSatisfaction.ts
// Only difference: imports use explicit .ts extensions for Deno compatibility.
// Keep in sync with the source file.
import type { TopicSatisfactionResult, ConstitutionRule } from './types.ts';
import { RULE_CODES, FLAG_CODES } from './types.ts';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'can', 'that', 'this', 'these', 'those', 'it', 'its',
  'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'as',
  'than', 'then', 'when', 'where', 'which', 'who', 'whom', 'what', 'how',
  'if', 'unless', 'until', 'while', 'although', 'because', 'since', 'though',
  'their', 'they', 'them', 'we', 'our', 'i', 'my', 'you', 'your', 'he', 'she',
  'his', 'her', 'also', 'just', 'more', 'any', 'all', 'each', 'very',
]);

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[-']+|[-']+$/g, ''))
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

export function computeTopicSatisfaction(
  body: string,
  resolution: string,
  description: string | undefined,
  rules: ConstitutionRule[],
): TopicSatisfactionResult {
  const rule = rules.find(
    (r) => r.code === RULE_CODES.TOPIC_SATISFACTION_LEXICAL && r.enabled,
  );

  const threshold = typeof rule?.params['threshold'] === 'number' ? rule.params['threshold'] : 0.25;
  const offTopicThreshold =
    typeof rule?.params['offTopicThreshold'] === 'number'
      ? rule.params['offTopicThreshold']
      : typeof rule?.params['off_topic_threshold'] === 'number'
        ? rule.params['off_topic_threshold']
        : 0.1;

  const referenceText = description ? `${resolution} ${description}` : resolution;
  const referenceTerms = tokenize(referenceText);

  if (referenceTerms.size === 0) {
    return {
      method: 'lexical',
      score: 1,
      threshold,
      offTopicThreshold,
      status: 'not_applicable',
      matchedTerms: [],
      missingTerms: [],
      payload: { flagCode: null },
    };
  }

  const bodyTerms = tokenize(body);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const term of referenceTerms) {
    if (bodyTerms.has(term)) {
      matched.push(term);
    } else {
      missing.push(term);
    }
  }

  const score = matched.length / referenceTerms.size;

  let status: TopicSatisfactionResult['status'];
  let flagCode: string | null = null;

  if (score >= threshold) {
    status = 'satisfied';
  } else if (score >= offTopicThreshold) {
    status = 'weak';
    flagCode = FLAG_CODES.WEAK_TOPIC;
  } else {
    status = 'failed';
    flagCode = FLAG_CODES.OFF_TOPIC;
  }

  return {
    method: 'lexical',
    score,
    threshold,
    offTopicThreshold,
    status,
    matchedTerms: matched,
    missingTerms: missing,
    payload: { flagCode },
  };
}

export function computeExtendedTopicSatisfaction(
  body: string,
  resolution: string,
  description: string | undefined,
  parentBody: string | undefined,
  rules: ConstitutionRule[],
): TopicSatisfactionResult {
  const rule = rules.find(
    (r) => (r.code === RULE_CODES.TOPIC_SATISFACTION_LEXICAL) && r.enabled,
  );

  const threshold =
    typeof rule?.params['threshold'] === 'number' ? rule.params['threshold'] : 0.25;
  const offTopicThreshold =
    typeof rule?.params['offTopicThreshold'] === 'number'
      ? rule.params['offTopicThreshold']
      : typeof rule?.params['off_topic_threshold'] === 'number'
        ? rule.params['off_topic_threshold']
        : 0.1;

  const referenceText = description ? `${resolution} ${description}` : resolution;
  const referenceTerms = tokenize(referenceText);

  if (referenceTerms.size === 0) {
    return {
      method: 'lexical',
      score: 1,
      threshold,
      offTopicThreshold,
      status: 'not_applicable',
      matchedTerms: [],
      missingTerms: [],
      resolutionScore: 1,
      parentScore: null,
      combinedScore: 1,
      matchedResolutionTerms: [],
      missingResolutionTerms: [],
      matchedParentTerms: [],
      missingParentTerms: [],
      railMode: parentBody ? 'reply' : 'root',
      payload: { flagCode: null },
    };
  }

  const bodyTerms = tokenize(body);
  const matchedRes: string[] = [];
  const missingRes: string[] = [];

  for (const term of referenceTerms) {
    if (bodyTerms.has(term)) matchedRes.push(term);
    else missingRes.push(term);
  }

  const resolutionScore = matchedRes.length / referenceTerms.size;

  let parentScore: number | null = null;
  let matchedParentTerms: string[] = [];
  let missingParentTerms: string[] = [];

  if (parentBody) {
    const parentTerms = tokenize(parentBody);
    if (parentTerms.size > 0) {
      const mParent: string[] = [];
      const xParent: string[] = [];
      for (const term of parentTerms) {
        if (bodyTerms.has(term)) mParent.push(term);
        else xParent.push(term);
      }
      parentScore = mParent.length / parentTerms.size;
      matchedParentTerms = mParent;
      missingParentTerms = xParent;
    }
  }

  const railMode: 'root' | 'reply' = parentBody ? 'reply' : 'root';
  const combinedScore =
    parentScore !== null ? Math.min(resolutionScore, parentScore) : resolutionScore;

  let status: TopicSatisfactionResult['status'];
  let flagCode: string | null = null;

  if (combinedScore >= threshold) {
    status = 'satisfied';
  } else if (combinedScore >= offTopicThreshold) {
    status = 'weak';
    flagCode = FLAG_CODES.WEAK_TOPIC;
  } else {
    status = 'failed';
    flagCode = FLAG_CODES.OFF_TOPIC;
  }

  return {
    method: 'lexical',
    score: combinedScore,
    threshold,
    offTopicThreshold,
    status,
    matchedTerms: matchedRes,
    missingTerms: missingRes,
    resolutionScore,
    parentScore,
    combinedScore,
    matchedResolutionTerms: matchedRes,
    missingResolutionTerms: missingRes,
    matchedParentTerms,
    missingParentTerms,
    railMode,
    payload: {
      flagCode,
      resolutionScore,
      parentScore,
      combinedScore,
      railMode,
    },
  };
}
