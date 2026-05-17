/**
 * Stage 6.1.3.2 — X public-reply epidemiology scaffold types.
 *
 * Hard rules baked into this module:
 *  - Agreement and disagreement are separate scalars, not one axis.
 *  - The classifier never decides truth, never picks winners, never labels
 *    users as bad-faith / dishonest / liars / extremists / propagandists.
 *  - Every classified pair has `userReviewRequired: true` — outputs are
 *    advisory, not authoritative.
 *  - No protected-class attributes are inferred.
 */

export type EngagementSource = 'x_news' | 'x_recent_search' | 'fixture' | 'manual_synthetic';

/** A retrieved News Search story (`/2/news/search` family). Identity is hashed. */
export interface NewsStorySample {
  storyIdHash: string;
  source: EngagementSource;
  collectedAt: string;
  query: string;
  category: string | null;
  /** Redacted display name of the cluster; never raw. */
  nameRedacted: string | null;
  /** Redacted one-line summary if surfaced by the API. */
  summaryRedacted: string | null;
  hookRedacted: string | null;
  keywords: string[];
  /** Hashed IDs of `cluster_posts_results`. */
  clusterPostIdHashes: string[];
  contextTopics: string[];
  publicOnly: true;
}

export interface PublicMetrics {
  replyCount: number;
  repostCount: number;
  quoteCount: number;
  likeCount: number;
  viewCount?: number | null;
  bookmarkCount?: number | null;
}

export interface PublicPostSafety {
  shouldExclude: boolean;
  exclusionReason: string | null;
  sensitiveTopicPossible: boolean;
  privatePersonPossible: boolean;
  realAccusationPossible: boolean;
}

export interface PublicPostRankSignals {
  popularityScore: number;
  replyPressureScore: number;
  quotePressureScore: number;
  disagreementCandidateScore: number;
}

export interface PublicPostSample {
  postIdHash: string;
  source: EngagementSource;
  storyIdHash: string | null;
  collectedAt: string;
  createdAt: string | null;
  lang: string | null;
  /** Public post text with handles / URLs / emails stripped. Stable hash for dedupe. */
  textRedacted: string;
  textFingerprint: string;
  conversationIdHash: string | null;
  parentPostIdHash: string | null;
  /** Hashed; never raw username/id. */
  authorIdHash: string | null;
  publicMetrics: PublicMetrics;
  rankSignals: PublicPostRankSignals;
  safety: PublicPostSafety;
}

export interface ReplyPairSafety {
  shouldExclude: boolean;
  exclusionReason: string | null;
}

export interface ReplyPairSample {
  pairId: string;
  rootPostIdHash: string;
  replyPostIdHash: string;
  storyIdHash: string | null;
  rootTextRedacted: string;
  replyTextRedacted: string;
  rootMetrics: PublicMetrics;
  replyMetrics: PublicMetrics;
  replyRank: number;
  collectedAt: string;
  threadContext: {
    conversationIdHash: string | null;
    replyDepthEstimate: number;
    isDirectReply: boolean;
    hasQuoteReference: boolean;
  };
  safety: ReplyPairSafety;
}

// ── Stance vector ──────────────────────────────────────────────

export type PrimaryStance =
  | 'strong_agree'
  | 'weak_agree'
  | 'mixed_agree_disagree'
  | 'weak_disagree'
  | 'strong_disagree'
  | 'unclear'
  | 'tangent'
  | 'joke_or_meme'
  | 'receipt_request'
  | 'quote_request';

export type AgreementType =
  | 'premise'
  | 'evidence'
  | 'conclusion'
  | 'value'
  | 'framing'
  | 'context'
  | 'none';

export type DisagreementType =
  | 'fact'
  | 'definition'
  | 'causal'
  | 'value'
  | 'evidence'
  | 'logic'
  | 'scope'
  | 'framing'
  | 'none';

export type ReplyFunction =
  | 'support'
  | 'extend'
  | 'caveat'
  | 'rebut'
  | 'counterexample'
  | 'ask_source'
  | 'ask_quote'
  | 'ask_definition'
  | 'narrow_scope'
  | 'branch_tangent'
  | 'synthesize'
  | 'joke'
  | 'unclear';

export interface AgreementDisagreementVector {
  /** 0.0 – 1.0. Agreement strength. */
  agreementScore: number;
  /** 0.0 – 1.0. Disagreement strength. NOT 1 - agreementScore. */
  disagreementScore: number;
  /** min(agreementScore, disagreementScore) — high values = genuine mixed state. */
  coexistenceScore: number;
  /** 0.0 – 1.0. How unsure the classifier is. */
  uncertaintyScore: number;
  primaryStance: PrimaryStance;
  agreementType: AgreementType;
  disagreementType: DisagreementType;
  replyFunction: ReplyFunction;
  /** One short sentence describing only the observable language relation. */
  scalarRationale: string;
  /** ALWAYS true. Outputs are advisory. */
  userReviewRequired: true;
}

export type ClassifierSource = 'deterministic' | 'xai' | 'hybrid';
export type ConfidenceBand = 'low' | 'medium' | 'high';

export interface ReplyInterpretation {
  pairId: string;
  deterministicVector: AgreementDisagreementVector;
  xaiVector: AgreementDisagreementVector | null;
  finalVector: AgreementDisagreementVector;
  classifierSource: ClassifierSource;
  confidence: ConfidenceBand;
  labels: string[];
  ruleCandidates: RuleCandidate[];
  excluded: boolean;
  exclusionReason: string | null;
}

// ── Mixed-agreement taxonomy (Stage 6.1.3.3) ───────────────────

export type AgreementBreadth = 'none' | 'narrow' | 'medium' | 'broad';

export type MixedAgreementClass =
  | 'broad_accept_narrow_decline'
  | 'narrow_accept_broad_decline'
  | 'broad_accept_broad_decline'
  | 'narrow_accept_narrow_decline'
  | 'pure_accept'
  | 'pure_decline'
  | 'unclear_mixed'
  | 'tangent_or_joke';

export type SuggestedGameNudge =
  | 'ask_for_scope_boundary'
  | 'ask_for_source'
  | 'ask_for_definition'
  | 'split_tangent'
  | 'invite_concession'
  | 'invite_synthesis'
  | 'continue_rebuttal'
  | 'none';

export interface MixedAgreementFlags {
  broadAcceptor: boolean;
  narrowAcceptor: boolean;
  broadDecliner: boolean;
  narrowDecliner: boolean;
  acceptsMainConclusion: boolean;
  acceptsValueFrame: boolean;
  acceptsEvidence: boolean;
  acceptsContext: boolean;
  declinesScope: boolean;
  declinesEvidence: boolean;
  declinesDefinition: boolean;
  declinesCausalClaim: boolean;
  declinesLogic: boolean;
  declinesFraming: boolean;
  mixedAgreementClass: MixedAgreementClass;
  agreementBreadth: AgreementBreadth;
  disagreementBreadth: AgreementBreadth;
  /** 0..1 — high values mean "this reply has agreement AND a specific disagreement axis the app can offer a move around." Advisory only. */
  playableTensionScore: number;
  suggestedGameNudge: SuggestedGameNudge;
  /** Always true. Outputs are advisory; the app never auto-applies a verdict. */
  userReviewRequired: true;
}

/**
 * Subset of `MixedAgreementFlags` intended as the app-grading-system input.
 * Same field names — the production grading code only depends on these.
 */
export interface GradingFlags {
  broadAcceptor: boolean;
  narrowAcceptor: boolean;
  broadDecliner: boolean;
  narrowDecliner: boolean;
  mixedAgreementClass: MixedAgreementClass;
  playableTensionScore: number;
}

// ── App-rule candidates ────────────────────────────────────────

export type RuleTargetAppSurface =
  | 'move_navigator'
  | 'quote_anchor'
  | 'evidence_prompt'
  | 'branch_prompt'
  | 'concession_prompt'
  | 'synthesis_prompt'
  | 'resting_status'
  | 'bot_fixture_generation'
  | 'corpus_scoring';

export interface RuleCandidate {
  ruleId: string;
  title: string;
  observedPattern: string;
  /** Snake-or-camel-cased predicate name for a future TS function. Not auto-wired. */
  deterministicPredicateName: string;
  conditionDescription: string;
  targetAppSurface: RuleTargetAppSurface;
  /** Hashed example pair IDs. Never raw post IDs. */
  examplePairIds: string[];
  riskNotes: string[];
  enabledByDefault: false;
}

// ── Aggregate report ───────────────────────────────────────────

export interface EpidemiologyAggregate {
  runId: string;
  collectedAt: string;
  source: EngagementSource | 'synthetic' | 'x_api_pilot' | 'x_api_plus_xai';
  storyCount: number;
  rootPostCount: number;
  replyPairCount: number;
  excludedCount: number;
  stanceDistribution: Record<PrimaryStance, number>;
  agreementDisagreementHeatmap: {
    /** rows = agreement bucket, cols = disagreement bucket. */
    buckets: Record<string, number>;
  };
  disagreementTypeDistribution: Record<DisagreementType, number>;
  agreementTypeDistribution: Record<AgreementType, number>;
  topReplyFunctions: Array<{ replyFunction: ReplyFunction; count: number }>;
  topRuleCandidates: RuleCandidate[];
  notes: string;
}

// ── xAI request / response (advisory only) ─────────────────────

export interface XaiClassifierInput {
  rootTextRedacted: string;
  replyTextRedacted: string;
  rootMetrics: PublicMetrics;
  replyMetrics: PublicMetrics;
  deterministicVector: AgreementDisagreementVector;
}

export interface XaiClassifierOutput extends AgreementDisagreementVector {
  ruleCandidate?: {
    title: string;
    conditionDescription: string;
    deterministicPredicateName: string;
  };
}

export interface XaiInvocationResult {
  enabled: boolean;
  disabledReason?:
    | 'env_flag_off'
    | 'api_key_missing'
    | 'no_pilot_flag'
    | 'synthetic_only_mode';
  output: XaiClassifierOutput | null;
}
