/**
 * Discourse rails checks (C-RAIL-001 through C-RAIL-005).
 *
 * These checks enforce structural discourse norms — connection to the parent,
 * explicit disagreement framing, concession integrity, clarification purity,
 * and fact-confusion advisory.
 *
 * They do NOT judge who is correct. They do NOT censor disagreement.
 * Flags are named "possible" to avoid declaring intent as fact.
 */
import type {
  ArgumentType,
  ConstitutionRule,
  EvaluationFlagDetail,
  EvaluationSeverity,
  FlagCode,
  FlagPersistSource,
  FlagStatus,
  FlagToPersist,
  ArgumentTarget,
} from './types';
import { RULE_CODES, FLAG_CODES, TAG_CODES } from './types';

// ── Types ─────────────────────────────────────────────────────

export interface RailsCheckInput {
  argumentType: ArgumentType;
  body: string;
  parentBody?: string;
  selectedTagCodes: string[];
  target?: ArgumentTarget;
  activeRules: ConstitutionRule[];
  source: FlagPersistSource;
}

interface RailsFlagEntry {
  detail: EvaluationFlagDetail;
  kind: 'blocking' | 'warning';
  flagCode: FlagCode;
  confidence?: number;
}

export interface RailsCheckResult {
  entries: RailsFlagEntry[];
  railPayload: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────

function findRule(rules: ConstitutionRule[], code: string): ConstitutionRule | undefined {
  return rules.find((r) => r.code === code && r.enabled);
}

function tokenizeSimple(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
}

function overlapScore(a: string, b: string): number {
  const aTerms = tokenizeSimple(a);
  const bTerms = tokenizeSimple(b);
  if (aTerms.size === 0 || bTerms.size === 0) return 0;
  let overlap = 0;
  for (const t of aTerms) {
    if (bTerms.has(t)) overlap++;
  }
  return overlap / Math.min(aTerms.size, bTerms.size);
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

function makePersist(
  flagCode: FlagCode,
  ruleCode: string,
  source: FlagPersistSource,
  severity: EvaluationSeverity,
  defaultStatus: FlagStatus,
  message: string,
  payload: Record<string, unknown> = {},
  confidence: number | null = null,
): FlagToPersist {
  return { flagCode, ruleCode, source, severity, defaultStatus, confidence, payload, message };
}

const DISAGREEMENT_AXIS_TAGS = new Set([
  TAG_CODES.FACT_DISAGREEMENT,
  TAG_CODES.DEFINITION_DISAGREEMENT,
  TAG_CODES.CAUSAL_DISAGREEMENT,
  TAG_CODES.VALUE_DISAGREEMENT,
  TAG_CODES.EVIDENCE_CHALLENGE,
  TAG_CODES.LOGIC_CHALLENGE,
  TAG_CODES.SCOPE_CHALLENGE,
]);

// ── C-RAIL-001: Parent responsiveness ─────────────────────────

function checkParentResponsiveness(input: RailsCheckInput): RailsFlagEntry[] {
  const rule = findRule(input.activeRules, RULE_CODES.PARENT_RESPONSIVENESS_LEXICAL);
  if (!rule) return [];

  const appliesTo = (rule.params['appliesTo'] as string[] | undefined) ?? [
    'rebuttal', 'counter_rebuttal', 'evidence', 'clarification_request', 'concession', 'synthesis',
  ];
  if (!appliesTo.includes(input.argumentType)) return [];
  if (!input.parentBody) return [];

  // If target_excerpt is provided and appears in parent body, passes immediately.
  const excerpt = input.target?.targetExcerpt?.trim();
  if (excerpt && input.parentBody.includes(excerpt)) return [];

  const hardBlockThreshold =
    typeof rule.params['hardBlockThreshold'] === 'number' ? rule.params['hardBlockThreshold'] : 0.05;
  const warningThreshold =
    typeof rule.params['warningThreshold'] === 'number' ? rule.params['warningThreshold'] : 0.15;

  const score = overlapScore(input.body, input.parentBody);

  // Stage 6.2 UX rescue: low parent overlap is now advisory only. We never
  // block a normal reply just because lexical overlap with the parent is
  // tiny; the user may legitimately be responding to a sub-claim without
  // copying any word from it. The flag still persists for moderator review.
  if (score < hardBlockThreshold) {
    const detail = makeFlagDetail(
      RULE_CODES.PARENT_RESPONSIVENESS_LEXICAL,
      FLAG_CODES.PARENT_NONRESPONSIVE,
      'warning',
      `This may not clearly connect to the parent.`,
      { overlapScore: score, hardBlockThreshold },
    );
    return [{ detail, kind: 'warning', flagCode: FLAG_CODES.PARENT_NONRESPONSIVE, confidence: score }];
  }

  if (score < warningThreshold) {
    const detail = makeFlagDetail(
      RULE_CODES.PARENT_RESPONSIVENESS_LEXICAL,
      FLAG_CODES.TANGENT_SHIFT,
      'warning',
      `Argument has low lexical overlap with its parent (overlap: ${(score * 100).toFixed(0)}%). Consider adding a target_excerpt to clarify which part you are responding to.`,
      { overlapScore: score, warningThreshold },
    );
    return [{ detail, kind: 'warning', flagCode: FLAG_CODES.TANGENT_SHIFT, confidence: score }];
  }

  return [];
}

// ── C-RAIL-002: Disagreement axis required ────────────────────

function checkDisagreementAxis(input: RailsCheckInput): RailsFlagEntry[] {
  const rule = findRule(input.activeRules, RULE_CODES.DISAGREEMENT_AXIS_REQUIRED);
  if (!rule) return [];

  const appliesTo = (rule.params['appliesTo'] as string[] | undefined) ?? [
    'rebuttal', 'counter_rebuttal',
  ];
  if (!appliesTo.includes(input.argumentType)) return [];

  const axisTagCodes =
    (rule.params['axisTagCodes'] as string[] | undefined) ?? [...DISAGREEMENT_AXIS_TAGS];

  const hasAxisTag = input.selectedTagCodes.some((c) => axisTagCodes.includes(c));
  if (hasAxisTag) return [];

  // Also accept if disagreementAxis is declared in target
  if (input.target?.disagreementAxis) return [];

  const detail = makeFlagDetail(
    RULE_CODES.DISAGREEMENT_AXIS_REQUIRED,
    FLAG_CODES.UNCLEAR_CLAIM,
    'warning',
    `${input.argumentType} arguments should declare what kind of disagreement is being made. ` +
      `Add one of: ${axisTagCodes.slice(0, 4).join(', ')}, etc.`,
    { availableAxisTags: axisTagCodes },
  );
  return [{ detail, kind: 'warning', flagCode: FLAG_CODES.UNCLEAR_CLAIM }];
}

// ── C-RAIL-003: Concession integrity ─────────────────────────

function checkConcessionIntegrity(input: RailsCheckInput): RailsFlagEntry[] {
  const rule = findRule(input.activeRules, RULE_CODES.CONCESSION_INTEGRITY);
  if (!rule) return [];

  const appliesTo = (rule.params['appliesTo'] as string[] | undefined) ?? [
    'concession', 'synthesis',
  ];
  if (!appliesTo.includes(input.argumentType)) return [];
  if (!input.parentBody) return [];

  const lower = input.body.toLowerCase();

  const concessionMarkers = (rule.params['concessionMarkers'] as string[] | undefined) ?? [
    'i concede', 'i grant', 'i agree with', 'that point is valid',
    'you are right', "you're right", 'fair point', 'i acknowledge',
  ];

  const hasMarker = concessionMarkers.some((m) => lower.includes(m));

  // Stage 6.2 UX rescue: missing concession-marker phrase is advisory now.
  // Users should not have to mimic exact wording like "I concede" to post
  // a concession-style move.
  if (!hasMarker) {
    const detail = makeFlagDetail(
      RULE_CODES.CONCESSION_INTEGRITY,
      FLAG_CODES.PARENT_NONRESPONSIVE,
      'warning',
      `Optional: a concession reads more clearly with a phrase like "I grant" or "fair point".`,
      { concessionMarkers },
    );
    return [{ detail, kind: 'warning', flagCode: FLAG_CODES.PARENT_NONRESPONSIVE }];
  }

  // Check for evasion: "but/however" followed by low parent overlap in the post-conjunction text
  const evasionThreshold =
    typeof rule.params['evasionParentOverlapThreshold'] === 'number'
      ? rule.params['evasionParentOverlapThreshold']
      : 0.1;

  const evasionPatterns = (rule.params['evasionPatterns'] as string[] | undefined) ?? [
    '\\bbut\\b', '\\bhowever\\b', '\\bthat said\\b', '\\bnevertheless\\b',
  ];

  const evasionRegexes = evasionPatterns.map((p) => new RegExp(p, 'i'));
  const hasEvasionWord = evasionRegexes.some((r) => r.test(lower));

  if (hasEvasionWord) {
    const overlap = overlapScore(input.body, input.parentBody);
    if (overlap < evasionThreshold) {
      const detail = makeFlagDetail(
        RULE_CODES.CONCESSION_INTEGRITY,
        FLAG_CODES.CONCESSION_EVASION,
        'review',
        `This concession introduces a new dispute after "but/however" with low connection to the parent (overlap: ${(overlap * 100).toFixed(0)}%). ` +
          `This may narrow the dispute appropriately or may be drifting to an unrelated topic — marked for review.`,
        { overlapScore: overlap, evasionThreshold },
      );
      return [{ detail, kind: 'warning', flagCode: FLAG_CODES.CONCESSION_EVASION }];
    }
  }

  return [];
}

// ── C-RAIL-004: Clarification purity ─────────────────────────

function checkClarificationPurity(input: RailsCheckInput): RailsFlagEntry[] {
  const rule = findRule(input.activeRules, RULE_CODES.CLARIFICATION_PURITY);
  if (!rule) return [];

  const appliesTo = (rule.params['appliesTo'] as string[] | undefined) ?? ['clarification_request'];
  if (!appliesTo.includes(input.argumentType)) return [];

  const lower = input.body.toLowerCase();
  const hasQuestion = lower.includes('?') || /\b(what|why|how|where|when|who|which|can you|could you|do you|is it|please clarify|please define)\b/i.test(lower);

  const loadedPatterns = (rule.params['loadedPatterns'] as string[] | undefined) ?? [
    '\\byou obviously\\b', '\\byou clearly\\b', '\\byou always\\b',
    '\\byou never\\b',
  ];
  const loadedRegexes = loadedPatterns.map((p) => new RegExp(p, 'i'));
  const hasLoadedLanguage = loadedRegexes.some((r) => r.test(lower));

  if (hasLoadedLanguage) {
    const detail = makeFlagDetail(
      RULE_CODES.CLARIFICATION_PURITY,
      FLAG_CODES.LOADED_CLARIFICATION,
      'review',
      'This clarification request may contain loaded or accusatory language. Clarification requests should ask for a definition, source, scope, or missing premise.',
      { hasQuestion },
    );
    return [{ detail, kind: 'warning', flagCode: FLAG_CODES.LOADED_CLARIFICATION }];
  }

  // Stage 6.2 UX rescue: missing question structure on a clarification is
  // advisory only. The user might be asking for a definition or framing
  // rather than literally adding a "?".
  if (!hasQuestion) {
    const parentOverlap = input.parentBody ? overlapScore(input.body, input.parentBody) : 0;
    if (parentOverlap < 0.05) {
      const detail = makeFlagDetail(
        RULE_CODES.CLARIFICATION_PURITY,
        FLAG_CODES.PARENT_NONRESPONSIVE,
        'warning',
        'Optional: clarification reads more clearly when it ends with a question.',
        { hasQuestion, parentOverlap },
      );
      return [{ detail, kind: 'warning', flagCode: FLAG_CODES.PARENT_NONRESPONSIVE }];
    }
  }

  return [];
}

// ── C-RAIL-005: Fact confusion channel ───────────────────────

function checkFactConfusion(input: RailsCheckInput): RailsFlagEntry[] {
  const rule = findRule(input.activeRules, RULE_CODES.FACT_CONFUSION_CHANNEL);
  if (!rule) return [];

  const lower = input.body.toLowerCase();

  const uncertaintyPatterns = (rule.params['uncertaintyPatterns'] as string[] | undefined) ?? [
    '\\bmaybe\\b', '\\bperhaps\\b', '\\bi think\\b', '\\buncertain\\b',
    '\\bnot sure\\b', '\\bcould be\\b',
  ];
  const uncertaintyRegexes = uncertaintyPatterns.map((p) => new RegExp(p, 'i'));
  const hasUncertainty = uncertaintyRegexes.some((r) => r.test(lower));

  const triggerTags = (rule.params['triggerTags'] as string[] | undefined) ?? [
    'evidence_challenge', 'source_request',
  ];
  const hasFactTag = input.selectedTagCodes.some((c) => triggerTags.includes(c));

  if (!hasUncertainty && !hasFactTag) return [];

  // Advisory flag only — not a misconduct flag
  const detail = makeFlagDetail(
    RULE_CODES.FACT_CONFUSION_CHANNEL,
    FLAG_CODES.FACT_CONFUSION,
    'info',
    'This argument disputes a factual premise while also expressing uncertainty or requesting sources. ' +
      'This may indicate the core disagreement is about missing evidence or definitions rather than value or logic — advisory only.',
    { hasUncertainty, hasFactTag },
  );
  return [{ detail, kind: 'warning', flagCode: FLAG_CODES.FACT_CONFUSION }];
}

// ── Main entry point ──────────────────────────────────────────

export function runRailsChecks(input: RailsCheckInput): RailsCheckResult {
  const allEntries: RailsFlagEntry[] = [
    ...checkParentResponsiveness(input),
    ...checkDisagreementAxis(input),
    ...checkConcessionIntegrity(input),
    ...checkClarificationPurity(input),
    ...checkFactConfusion(input),
  ];

  const railPayload: Record<string, unknown> = {
    checksRun: [
      RULE_CODES.PARENT_RESPONSIVENESS_LEXICAL,
      RULE_CODES.DISAGREEMENT_AXIS_REQUIRED,
      RULE_CODES.CONCESSION_INTEGRITY,
      RULE_CODES.CLARIFICATION_PURITY,
      RULE_CODES.FACT_CONFUSION_CHANNEL,
    ],
    flagCount: allEntries.length,
    blockingCount: allEntries.filter((e) => e.kind === 'blocking').length,
  };

  return { entries: allEntries, railPayload };
}

/** Convert a RailsFlagEntry to a FlagToPersist for the DB. */
export function railsEntryToFlagToPersist(
  entry: RailsFlagEntry,
  source: FlagPersistSource,
  defaultStatusOverride?: FlagStatus,
): FlagToPersist {
  return makePersist(
    entry.flagCode,
    entry.detail.ruleCode,
    source,
    entry.detail.severity,
    defaultStatusOverride ?? (entry.kind === 'blocking' ? 'open' : 'open'),
    entry.detail.message,
    entry.detail.payload,
    entry.confidence ?? null,
  );
}
