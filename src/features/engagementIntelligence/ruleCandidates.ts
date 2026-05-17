/**
 * Pure-TS builders for app rule candidates derived from a batch of reply
 * interpretations. The candidates are NEVER auto-wired into production; they
 * are written to a committable Markdown report and the operator decides
 * whether to turn any of them into Constitution rules / UI nudges.
 */

import type {
  AgreementType,
  AgreementDisagreementVector,
  DisagreementType,
  EpidemiologyAggregate,
  PrimaryStance,
  ReplyFunction,
  ReplyInterpretation,
  RuleCandidate,
} from './types';

const ALL_STANCES: PrimaryStance[] = [
  'strong_agree', 'weak_agree', 'mixed_agree_disagree', 'weak_disagree',
  'strong_disagree', 'unclear', 'tangent', 'joke_or_meme',
  'receipt_request', 'quote_request',
];

const ALL_AGREEMENT_TYPES: AgreementType[] = [
  'premise', 'evidence', 'conclusion', 'value', 'framing', 'context', 'none',
];

const ALL_DISAGREEMENT_TYPES: DisagreementType[] = [
  'fact', 'definition', 'causal', 'value', 'evidence', 'logic', 'scope', 'framing', 'none',
];

function bucketLabel(score: number): string {
  if (score < 0.2) return '0.0-0.2';
  if (score < 0.4) return '0.2-0.4';
  if (score < 0.6) return '0.4-0.6';
  if (score < 0.8) return '0.6-0.8';
  return '0.8-1.0';
}

function emptyDistribution<T extends string>(keys: T[]): Record<T, number> {
  const o = {} as Record<T, number>;
  for (const k of keys) o[k] = 0;
  return o;
}

export function summarizeAgreementEpidemiology(
  runId: string,
  source: EpidemiologyAggregate['source'],
  interpretations: ReplyInterpretation[],
  meta: { storyCount: number; rootPostCount: number; notes?: string },
): EpidemiologyAggregate {
  const stanceDistribution = emptyDistribution(ALL_STANCES);
  const disagreementTypeDistribution = emptyDistribution(ALL_DISAGREEMENT_TYPES);
  const agreementTypeDistribution = emptyDistribution(ALL_AGREEMENT_TYPES);
  const buckets: Record<string, number> = {};
  const replyFunctionCounts = new Map<ReplyFunction, number>();
  let excludedCount = 0;

  for (const i of interpretations) {
    if (i.excluded) { excludedCount++; continue; }
    const v = i.finalVector;
    stanceDistribution[v.primaryStance]++;
    disagreementTypeDistribution[v.disagreementType]++;
    agreementTypeDistribution[v.agreementType]++;
    const key = `${bucketLabel(v.agreementScore)} × ${bucketLabel(v.disagreementScore)}`;
    buckets[key] = (buckets[key] || 0) + 1;
    replyFunctionCounts.set(v.replyFunction, (replyFunctionCounts.get(v.replyFunction) || 0) + 1);
  }

  const topReplyFunctions = [...replyFunctionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([replyFunction, count]) => ({ replyFunction, count }));

  return {
    runId,
    collectedAt: new Date().toISOString(),
    source,
    storyCount: meta.storyCount,
    rootPostCount: meta.rootPostCount,
    replyPairCount: interpretations.length,
    excludedCount,
    stanceDistribution,
    agreementDisagreementHeatmap: { buckets },
    disagreementTypeDistribution,
    agreementTypeDistribution,
    topReplyFunctions,
    topRuleCandidates: rankRuleCandidates(buildRuleCandidatesFromAnalyses(interpretations)),
    notes: meta.notes || '',
  };
}

export function buildRuleCandidatesFromAnalyses(
  interpretations: ReplyInterpretation[],
): RuleCandidate[] {
  const out: RuleCandidate[] = [];
  const examplesByPredicate = new Map<string, string[]>();

  function addExample(predicate: string, pairId: string) {
    const list = examplesByPredicate.get(predicate) ?? [];
    if (list.length < 3) list.push(pairId);
    examplesByPredicate.set(predicate, list);
  }

  let receipts = 0, quotes = 0, scope = 0, define = 0, branch = 0, mixed = 0, concede = 0;

  for (const i of interpretations) {
    if (i.excluded) continue;
    const v = i.finalVector;
    if (v.replyFunction === 'ask_source') { receipts++; addExample('shouldPromptForReceipts', i.pairId); }
    if (v.replyFunction === 'ask_quote') { quotes++; addExample('shouldPromptQuoteExactBit', i.pairId); }
    if (v.replyFunction === 'narrow_scope' || v.disagreementType === 'scope') { scope++; addExample('shouldSuggestNarrowScope', i.pairId); }
    if (v.replyFunction === 'ask_definition' || v.disagreementType === 'definition') { define++; addExample('shouldSuggestDefineTerm', i.pairId); }
    if (v.replyFunction === 'branch_tangent') { branch++; addExample('shouldSuggestBranchThread', i.pairId); }
    if (v.coexistenceScore >= 0.4) { mixed++; addExample('shouldShowMixedAgreementDisagreementStatus', i.pairId); }
    if (v.agreementType !== 'none' && v.disagreementScore >= 0.3 && v.agreementScore >= 0.25) {
      concede++;
      addExample('shouldOfferConcedeSmallPoint', i.pairId);
    }
  }

  function push(
    predicate: string,
    targetAppSurface: RuleCandidate['targetAppSurface'],
    title: string,
    pattern: string,
    condition: string,
    risk: string[],
  ) {
    out.push({
      ruleId: `rc-${predicate}`,
      title,
      observedPattern: pattern,
      deterministicPredicateName: predicate,
      conditionDescription: condition,
      targetAppSurface,
      examplePairIds: examplesByPredicate.get(predicate) ?? [],
      riskNotes: risk,
      enabledByDefault: false,
    });
  }

  if (receipts > 0) push(
    'shouldPromptForReceipts',
    'evidence_prompt',
    'Offer receipts prompt when reply asks for source',
    `${receipts} replies asked for sources or evidence.`,
    'reply.replyFunction === ask_source OR reply contains evidence-request lexemes',
    ['Receipts prompt must not gate posting; advisory only.'],
  );
  if (quotes > 0) push(
    'shouldPromptQuoteExactBit',
    'quote_anchor',
    'Offer quote-anchor prompt when reply asks for the exact bit',
    `${quotes} replies requested a quote anchor.`,
    'reply.replyFunction === ask_quote OR reply contains quote-request lexemes',
    ['Do not auto-quote; let author pick which words anchor.'],
  );
  if (scope > 0) push(
    'shouldSuggestNarrowScope',
    'move_navigator',
    'Suggest narrow_scope move when scope challenge is detected',
    `${scope} replies challenged the scope (all/never/too broad/goalposts).`,
    'reply.disagreementType === scope OR reply.replyFunction === narrow_scope',
    ['Narrowing is a tactic, not a verdict.'],
  );
  if (define > 0) push(
    'shouldSuggestDefineTerm',
    'move_navigator',
    'Suggest define-term move when definition challenge is detected',
    `${define} replies asked for a definition.`,
    'reply.disagreementType === definition OR reply.replyFunction === ask_definition',
    ['Definitions are local to the room, not the project.'],
  );
  if (branch > 0) push(
    'shouldSuggestBranchThread',
    'branch_prompt',
    'Suggest branch_thread move when reply reads as tangent',
    `${branch} replies introduced a tangent or new topic.`,
    'reply.replyFunction === branch_tangent OR reply contains tangent lexemes',
    ['Branch must not delete the original thread.'],
  );
  if (mixed > 0) push(
    'shouldShowMixedAgreementDisagreementStatus',
    'resting_status',
    'Surface mixed-agreement state when coexistence is high',
    `${mixed} replies showed coexistence (both agreement and disagreement above 0.4).`,
    'reply.coexistenceScore >= 0.4',
    ['Mixed state is a UI cue, not a verdict on who is right.'],
  );
  if (concede > 0) push(
    'shouldOfferConcedeSmallPoint',
    'concession_prompt',
    'Offer concede-small-point prompt when reply both agrees on premise and disputes evidence',
    `${concede} replies showed partial agreement plus a substantive disagreement.`,
    'reply.agreementScore >= 0.25 AND reply.disagreementScore >= 0.3',
    ['Concession is offered as an option, never forced.'],
  );
  return out;
}

export function rankRuleCandidates(candidates: RuleCandidate[]): RuleCandidate[] {
  const score = (c: RuleCandidate) =>
    (c.examplePairIds.length || 0) +
    (c.targetAppSurface === 'move_navigator' ? 2 : 1);
  return [...candidates].sort((a, b) => score(b) - score(a));
}

/** Helper used by tests + report writer to surface the dominant stance per row. */
export function dominantDimensions(v: AgreementDisagreementVector): {
  agreement: AgreementType;
  disagreement: DisagreementType;
} {
  return { agreement: v.agreementType, disagreement: v.disagreementType };
}
