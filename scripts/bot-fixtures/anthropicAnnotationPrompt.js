/**
 * Stage 6.1.5.1 — Anthropic annotation prompt builder.
 *
 * Builds system + user prompts that ask Anthropic to classify ONE argument
 * move as the schema shape defined in
 * `src/features/engagementIntelligence/anthropicArgumentAnnotations.ts`.
 *
 * Hard rules baked into every prompt:
 *  - You are NOT a truth engine, NOT a moderator, NOT a judge.
 *  - You DO NOT decide who is correct, who is winning, or who is losing.
 *  - You DO NOT label users as liar / dishonest / bad faith / manipulative /
 *    extremist / propagandist / stupid / idiot.
 *  - You DO NOT infer demographic / political / religious / health /
 *    sexuality / protected-class attributes.
 *  - You DO NOT recommend moderation actions.
 *  - You classify OBSERVABLE LANGUAGE only.
 *  - You output compact JSON only, no prose outside the JSON.
 *  - Every output sets `userReviewRequired: true`.
 *
 * CommonJS / pure — no network here.
 */

const SYSTEM_PROMPT = [
  'You annotate a single argument move (a reply in a debate game).',
  'You are NOT a truth engine, NOT a moderator, and NOT a judge.',
  'You DO NOT decide who is correct. You DO NOT decide who is winning or losing.',
  'You DO NOT call any speaker a liar, dishonest, bad faith, manipulative, extremist, propagandist, troll, bot, astroturfer, stupid, or an idiot.',
  'You DO NOT infer demographic, political party, religious, health, sexuality, race, ethnicity, or other protected-class attributes about any speaker.',
  'You DO NOT make moderation recommendations.',
  'You classify observable language only — what words say and how they relate to the parent move.',
  'When something is risky to label, use the suffix "_possible" or set uncertainty high. Prefer "unclear" over guessing.',
  // ── Anti-amplification doctrine ────────────────────────────────
  'CORE DOCTRINE (Stage 6.1.5.2): popularity is NOT evidence. Repetition is NOT evidence. Engagement velocity is NOT evidence. Political identity is NOT evidence.',
  'You MAY identify the political frame, issue family, or rhetorical camp of the TEXT for research and gameplay context.',
  'You MUST NOT treat political alignment, crowd agreement, or viral repetition as factual support.',
  '`politicalValence` describes the rhetorical frame of the TEXT, never the user. Do not infer party registration or ideology.',
  'Use "coordination risk" / "amplification risk" for content-pattern signals, never as a person label.',
  'Set platformSupportWarning=true whenever the claim should NOT receive point-standing credit without additional evidence (high amplification + low evidence, appeal to virality, unknown source chain, viral slogan repetition, factual allegation without quote/source).',
  // ── Output format ──────────────────────────────────────────────
  'You ALWAYS output compact JSON only, no prose outside the JSON.',
  'You ALWAYS set userReviewRequired: true.',
  'The label set is fixed; do not invent new categories or archetypes.',
].join(' ');

const RHETORICAL_ARCHETYPES = [
  'receipt_demander', 'quote_anchor_demander', 'definition_challenger',
  'scope_narrower', 'evidence_challenger', 'causal_challenger',
  'value_challenger', 'logic_challenger', 'framing_challenger',
  'counterexample_dropper', 'broad_agree_narrow_disagree',
  'narrow_agree_broad_disagree', 'concession_repairer',
  'performative_concession_possible', 'unresolved_debt_creator',
  'tangent_brancher', 'synthesis_closer', 'evasion_possible',
  'low_effort_agreement', 'low_effort_rebuttal', 'playful_pressure',
  'receipts_backed_claim', 'quote_supported_claim',
  'unsupported_bold_claim', 'topic_drift_possible',
  'branch_required_possible', 'unclear',
];

const MESSAGE_CATEGORIES = [
  'root_claim', 'supporting_claim', 'challenge', 'counter_challenge',
  'evidence', 'clarification', 'concession', 'synthesis', 'tangent',
  'repair', 'unclear',
];

const ISSUE_DEBT_AXES = [
  'fact', 'definition', 'causal', 'value', 'evidence', 'logic',
  'scope', 'framing', 'quote', 'source', 'none',
];

const REPAIR_SUGGESTIONS = [
  'provide_receipt', 'quote_exact_bit', 'define_term',
  'narrow_scope', 'concede_small_point', 'branch_thread',
  'synthesize', 'none',
];

const POLITICAL_ISSUE_FRAMES = [
  'election_process', 'governance', 'foreign_policy', 'economic_policy',
  'civil_rights', 'public_safety', 'institutional_trust', 'culture_war',
  'climate_energy', 'health_policy', 'labor_business',
  'technology_platforms', 'unclear', 'non_political',
];

const POLITICAL_VALENCES = [
  'pro_institutional', 'anti_institutional', 'left_leaning_frame',
  'right_leaning_frame', 'populist_frame', 'establishment_frame',
  'anti_media_frame', 'pro_media_frame', 'anti_platform_frame',
  'pro_platform_frame', 'unclear', 'not_applicable',
];

const EVIDENTIARY_RISKS = ['low', 'medium', 'high', 'unknown'];
const AMPLIFICATION_RISKS = ['none_observed', 'low', 'medium', 'high'];

const RECOMMENDED_GAME_TREATMENTS = [
  'allow_as_opinion_no_factual_credit', 'ask_for_receipt',
  'ask_for_quote_anchor', 'ask_for_scope_narrowing',
  'ask_for_primary_source', 'suggest_branch_to_context_thread',
  'mark_as_unresolved_issue_debt', 'allow_point_standing_after_evidence',
  'suppress_score_gain_for_amplification_only',
];

const SCHEMA_DESCRIPTION = `Return ONE JSON object with this shape (all keys required):

{
  "schemaVersion": 2,
  "moveId": string,
  "roomId": string | null,
  "scenarioId": string,
  "parentMoveId": string | null,
  "argumentType": string,
  "side": string,
  "messageCategory": one of ${JSON.stringify(MESSAGE_CATEGORIES)},
  "primaryRhetoricalArchetype": one of ${JSON.stringify(RHETORICAL_ARCHETYPES)},
  "secondaryRhetoricalArchetypes": array of values from the same set (may be empty),
  "opinionVector": {
    "broadAgreement": number 0..1,
    "narrowAgreement": number 0..1,
    "broadDisagreement": number 0..1,
    "narrowDisagreement": number 0..1,
    "coexistenceScore": number 0..1,
    "uncertaintyScore": number 0..1,
    "emotionalValence": one of ["positive","neutral","negative","mixed","unclear"],
    "heatLevel": one of ["cold","warm","hot","too_hot_possible"]
  },
  "agreementDisagreementVector": {
    "agreementScore": number 0..1,
    "disagreementScore": number 0..1,
    "coexistenceScore": number 0..1,
    "uncertaintyScore": number 0..1,
    "primaryStance": string,
    "agreementType": string,
    "disagreementType": string,
    "replyFunction": string,
    "scalarRationale": string,
    "userReviewRequired": true
  },
  "issueDebtSignal": {
    "axis": one of ${JSON.stringify(ISSUE_DEBT_AXES)},
    "created": boolean,
    "repaired": boolean,
    "unresolved": boolean,
    "repairSuggestion": one of ${JSON.stringify(REPAIR_SUGGESTIONS)}
  },
  "gameImplication": {
    "pressureCreated": boolean,
    "pressureAxis": one of ${JSON.stringify(ISSUE_DEBT_AXES)},
    "responderCanRecover": boolean,
    "concessionWouldHelp": boolean,
    "branchRecommended": boolean,
    "playableTensionScore": number 0..1,
    "suggestedUiNudge": string | null,
    "suggestedQualifierCode": string | null
  },
  "qualifierCodes": array of strings (snake_case),
  "categoryCodes": array of strings (snake_case),
  "evidenceSignals": {
    "asksForSource": boolean,
    "providesSource": boolean,
    "asksForQuote": boolean,
    "providesQuote": boolean,
    "evidenceSpecificity": one of ["none","vague","specific","receipts_backed"]
  },
  "threadSignals": {
    "parentResponsive": boolean,
    "topicDriftPossible": boolean,
    "branchCandidate": boolean,
    "depth": integer,
    "chainRole": one of ["root","pressure","repair","branch","closure","unclear"]
  },
  "modelJustification": {
    "shortReason": one sentence describing observable text features,
    "observableTextFeatures": array of short strings (verbatim or paraphrased),
    "uncertaintyNotes": array of short strings (empty if confident)
  },
  "deterministicRuleCandidate": {
    "shouldCreateRule": boolean,
    "ruleName": string | null,
    "ruleCondition": string | null,
    "uiNudge": string | null,
    "shouldSuppressScoreGainForAmplificationOnly": boolean,
    "shouldAskForPrimarySource": boolean,
    "shouldMarkEvidenceRiskHigh": boolean,
    "shouldShowAmplificationRiskBadge": boolean,
    "shouldTreatAsOpinionNoFactualCredit": boolean,
    "shouldCreateIssueDebtForUnsupportedClaim": boolean,
    "shouldOfferScopeNarrowingForPoliticalGeneralization": boolean,
    "shouldOfferQuoteAnchorForAllegation": boolean,
    "shouldBranchContextIfClaimNeedsBackground": boolean
  },
  "politicalIssueFrame": one of ${JSON.stringify(POLITICAL_ISSUE_FRAMES)},
  "politicalValence": one of ${JSON.stringify(POLITICAL_VALENCES)},
  "amplificationSignals": {
    "repeated_claim_language": boolean,
    "high_engagement_low_evidence": boolean,
    "slogan_or_chant_like": boolean,
    "copy_paste_risk": boolean,
    "outrage_hook": boolean,
    "link_without_receipt_context": boolean,
    "screenshot_without_primary_source": boolean,
    "appeal_to_crowd_size": boolean,
    "appeal_to_virality": boolean,
    "unknown_source_chain": boolean
  },
  "evidentiaryRisk": one of ${JSON.stringify(EVIDENTIARY_RISKS)},
  "amplificationRisk": one of ${JSON.stringify(AMPLIFICATION_RISKS)},
  "platformSupportWarning": boolean,
  "recommendedGameTreatment": one of ${JSON.stringify(RECOMMENDED_GAME_TREATMENTS)},
  "justification": string (1-3 sentences; observable text features only; do NOT make claims about the author; say "the text shows amplification-risk features" or "the claim relies on repetition / virality rather than evidence"; never "this is astroturfed"),
  "userReviewRequired": true
}

Use "unclear" liberally for ambiguous text. Use "_possible" suffix on archetypes when the signal is weak.
Set platformSupportWarning=true whenever high_engagement_low_evidence, appeal_to_virality, unknown_source_chain, evidentiaryRisk=high, or factual claim lacks a quote/source/evidence anchor, OR when a reply agrees with a viral claim without adding evidence, OR when a reply repeats a political slogan without narrowing or supporting the point.`;

/**
 * Build the user prompt for one move. Includes:
 *  - The room's root claim (truncated if long)
 *  - The parent body if any (truncated)
 *  - A compact thread summary (oldest first)
 *  - The current move's argumentType + axis + body
 *  - The deterministic stance vector (so Anthropic can refine or override)
 */
function buildUserPrompt(input) {
  const lines = [];
  const trunc = (s, n) => {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    return t.length <= n ? t : t.slice(0, n - 1) + '…';
  };
  lines.push('Scenario context:');
  lines.push(`  scenarioId: ${input.scenarioId}`);
  lines.push(`  roomId: ${input.roomId ?? '(planned)'}`);
  lines.push(`  rootClaim: ${trunc(input.rootClaim, 320)}`);
  if (input.topicResolution) lines.push(`  resolution: ${trunc(input.topicResolution, 320)}`);
  if (Array.isArray(input.topicKeywords) && input.topicKeywords.length > 0) {
    lines.push(`  topicKeywords: ${input.topicKeywords.slice(0, 8).join(', ')}`);
  }
  lines.push('');
  lines.push('Compact thread so far (oldest first, parent → child):');
  if (Array.isArray(input.thread) && input.thread.length > 0) {
    for (const t of input.thread.slice(-12)) {
      lines.push(`  - ${t.moveId} ${t.argumentType}/${t.side} (parent=${t.parentMoveId || 'root'}): ${trunc(t.body, 140)}`);
    }
  } else {
    lines.push('  (this is the root move)');
  }
  lines.push('');
  if (input.parent) {
    lines.push('Parent of THIS move:');
    lines.push(`  parentMoveId: ${input.parent.moveId}`);
    lines.push(`  parentArgumentType: ${input.parent.argumentType}`);
    lines.push(`  parentBody: ${trunc(input.parent.body, 320)}`);
    if (input.targetExcerpt) lines.push(`  targetExcerptFromParent: "${trunc(input.targetExcerpt, 200)}"`);
    lines.push('');
  }
  lines.push('THIS move (annotate this one):');
  lines.push(`  moveId: ${input.moveId}`);
  lines.push(`  argumentType: ${input.argumentType}`);
  lines.push(`  side: ${input.side}`);
  if (input.disagreementAxis) lines.push(`  disagreementAxis: ${input.disagreementAxis}`);
  lines.push(`  body: ${trunc(input.body, 800)}`);
  if (input.evidence && (input.evidence.label || input.evidence.sourceText)) {
    lines.push(`  attachedEvidence: label="${trunc(input.evidence.label || '', 80)}" sourceText="${trunc(input.evidence.sourceText || '', 200)}"`);
  }
  if (input.deterministicVector) {
    lines.push('');
    lines.push('Deterministic stance vector (already computed locally — use as a hint, not as truth):');
    lines.push(`  ${JSON.stringify(input.deterministicVector)}`);
  }
  lines.push('');
  lines.push(SCHEMA_DESCRIPTION);
  lines.push('');
  lines.push('Output the JSON object only.');
  return lines.join('\n');
}

function buildAnnotationPrompt(input) {
  return {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input),
  };
}

module.exports = {
  SYSTEM_PROMPT,
  SCHEMA_DESCRIPTION,
  RHETORICAL_ARCHETYPES,
  MESSAGE_CATEGORIES,
  ISSUE_DEBT_AXES,
  REPAIR_SUGGESTIONS,
  POLITICAL_ISSUE_FRAMES,
  POLITICAL_VALENCES,
  EVIDENTIARY_RISKS,
  AMPLIFICATION_RISKS,
  RECOMMENDED_GAME_TREATMENTS,
  buildAnnotationPrompt,
  buildUserPrompt,
};
