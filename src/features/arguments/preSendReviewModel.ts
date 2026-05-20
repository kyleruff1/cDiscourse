/**
 * RULE-004 — Pause-before-send move review (advisory friction with payoff).
 *
 * A deterministic, pure-TS model that derives a short list of ADVISORIES
 * (info / soft, never blocking) for a composer draft on the Post intent,
 * plus a read-only PROJECTION of any structural block the Constitution
 * engine has ALREADY produced. The thin React sheet `PreSendReviewSheet`
 * renders this output; the dock owns the wiring.
 *
 * Doctrine (cdiscourse-doctrine — see RULE-004 design §0 / §12):
 *  - §1 — RULE-004 adds ZERO new blocking rules. The ONLY thing that can
 *    block a post is the deterministic structural validation that already
 *    exists (`evaluateArgumentDraft` → `blockingErrors`). This model READS
 *    that result and re-shapes it into `structuralBlocks[]` — it never
 *    produces a block of its own. `AdvisorySeverity` is exactly
 *    `'info' | 'soft'`; neither gates a post.
 *  - §1 / Stage 6.2 — no keyword-only gating. The model NEVER inspects
 *    raw body text for keyword matching. The one body read is a
 *    deterministic length / punctuation SHAPE read used only to raise an
 *    info / soft advisory — never to block.
 *  - §2 / §3 — heat / popularity are not signals. The model never reads a
 *    strength band, a heat value, a reply count, or any engagement metric.
 *  - §4 / §7 — no AI call. Deterministic pure TS. No Anthropic / xAI /
 *    client AI / Edge Function. RULE-006 owns semantic advisories.
 *  - §5 — pure models. This file imports TYPES + frozen copy tables only.
 *    No React, no Supabase, no network, no mutation, no async.
 *  - §9 — plain language. Every advisory / block string is read from a
 *    frozen `gameCopy` block; no snake_case leaks; no verdict /
 *    amplification / person-attribution tokens.
 *
 * RULE-005 reconciliation (design §4.4): the `channel_mismatch` advisory
 * ABSORBS RULE-005's already-shipped channel-mismatch advisory. The model
 * reuses RULE-005's `ChannelSuggestion` object (passed in) and its
 * `suggestion.rationale` copy line — it does NOT re-implement channel
 * logic and modifies neither `channelModel.ts` nor `ChannelChipRow.tsx`.
 */
import { FLAG_CODES } from '../../domain/constitution/types';
import type {
  EvaluationResult,
  EvaluationFlagDetail,
} from '../../domain/constitution/types';
import type { ComposerDraft } from './composerState';
import type { ArgumentRow } from './types';
import type { ChannelSuggestion } from './channelModel';
import type {
  PointLifecycleSnapshot,
  PointLifecycleClusterSummary,
} from '../lifecycle';
import type { MoveLinkageRecord } from '../metadata';
import type { QuickActionLabel } from './quickActionPresets';
import {
  PRESEND_ADVISORY_COPY,
  PRESEND_BLOCK_COPY,
} from './gameCopy';
import {
  assessTangentRisk,
  tangentAdvisoryPlainLanguage,
} from './tangentRoutingModel';
import type { AssessTangentRiskInput } from './tangentRoutingModel';

// ── Types ──────────────────────────────────────────────────────

/** RULE-004 — the structural observations a pre-send review can raise. */
export type AdvisoryKind =
  | 'broad_claim'
  | 'topic_drift'
  | 'asks_new_question'
  | 'no_source_attached'
  | 'depth_warning'
  | 'permanent_record_warning'
  | 'channel_mismatch' // absorbs RULE-005's channel-mismatch — see §0 D6.
  | 'tangent_redirect'; // BR-003 — structural redirect to a side branch.

/** Frozen list of every advisory kind. Tests iterate this. */
export const ALL_ADVISORY_KINDS: ReadonlyArray<AdvisoryKind> = Object.freeze([
  'broad_claim',
  'topic_drift',
  'asks_new_question',
  'no_source_attached',
  'depth_warning',
  'permanent_record_warning',
  'channel_mismatch',
  'tangent_redirect',
]);

/** Advisory severity. There is NO blocking severity — see §2. */
export type AdvisorySeverity = 'info' | 'soft';

/**
 * A transformation the user can take from an advisory card. `narrow` /
 * `branch_tangent` / `ask_source` / `add_quote` / `add_evidence` map onto
 * existing `quickActionPresets.QuickActionLabel`s (see §5.4). `save_draft`
 * and `post_anyway` are SHEET actions — they do NOT go through
 * quickActionPresets.
 */
export type AdvisoryTransformation =
  | 'narrow'
  | 'branch_tangent'
  | 'ask_source'
  | 'add_quote'
  | 'add_evidence'
  | 'save_draft'
  | 'post_anyway';

/** One advisory card in the pre-send review. */
export interface PreSendAdvisory {
  kind: AdvisoryKind;
  severity: AdvisorySeverity;
  /**
   * Ordered transformations offered on the card (2–3). The FIRST is the
   * primary suggestion; `post_anyway` is always present and always last.
   * Every advisory has at least one non-`post_anyway` transformation.
   */
  suggested: ReadonlyArray<AdvisoryTransformation>;
  /**
   * Plain-language one-liner. READ from a frozen copy table — never
   * authored at call time. Move-level language ("This may open a side
   * issue"), never person-level ("you are dodging").
   */
  plainLanguage: string;
}

/** Display kinds for an EXISTING structural block (see §0 D2). */
export type StructuralBlockKind =
  | 'empty_body'
  | 'invalid_transition'
  | 'evidence_without_source'
  | 'over_length'
  | 'cooldown_active'; // reserved — no producer in v1 (§0 D4).

/**
 * A structural block, projected READ-ONLY from `evaluateArgumentDraft`'s
 * `blockingErrors`. RULE-004 implements no block — it re-shapes one.
 */
export interface PreSendStructuralBlock {
  kind: StructuralBlockKind;
  /** Plain-language one-liner — read from gameCopy, never authored here. */
  plainLanguage: string;
}

/** v1: always 'casual'. Stable for GAME-003 (§0 D3). */
export type ReviewMode = 'casual' | 'strict';

/** The complete pre-send review — the model's single output. */
export interface PreSendReview {
  advisories: ReadonlyArray<PreSendAdvisory>;
  structuralBlocks: ReadonlyArray<PreSendStructuralBlock>;
  /**
   * True IFF `structuralBlocks` is non-empty. When true the sheet hides
   * "Post anyway" — an existing structural block genuinely prevents the
   * post (this is NOT a RULE-004 block; it is the engine's).
   */
  hasStructuralBlock: boolean;
  /**
   * True when the sheet should be shown at all: advisories non-empty OR
   * structuralBlocks non-empty. When false the dock posts straight through
   * with no sheet (ordinary clean reply — no friction).
   */
  shouldShowSheet: boolean;
}

/** Lightweight room context (resolution depth limit etc.). */
export interface PreSendRoomContext {
  /** Max nesting depth before `depth_warning` fires. Frozen default 6. */
  depthWarningThreshold: number;
}

/**
 * The parent's already-derived LIFE-001 / META-001 structures. All null
 * for a root draft. RULE-004 NEVER re-derives these — it reads what
 * LIFE-001 / META-001 already computed for the posted parent.
 */
export interface PreSendLifecycleContext {
  parentSnapshot: PointLifecycleSnapshot | null;
  parentClusterSummary: PointLifecycleClusterSummary | null;
  parentLinkage: MoveLinkageRecord | null;
}

/** The model input. */
export interface PreSendReviewInput {
  /** The composer draft being reviewed (composerState.ComposerDraft). */
  draft: ComposerDraft;
  /** v1: always 'casual'. See §0 D3. */
  mode: ReviewMode;
  /** The parent argument row, or null for a root move. */
  parent: ArgumentRow | null;
  /** Lightweight room context (resolution depth limit etc.). */
  room: PreSendRoomContext;
  /**
   * The parent's already-derived LIFE-001 / META-001 structures. RULE-004
   * NEVER re-derives these — it reads what was already computed.
   */
  lifecycle: PreSendLifecycleContext;
  /**
   * The already-computed Constitution evaluation result for this draft.
   * RULE-004 reads `blockingErrors` + `warnings`; it never re-runs the
   * engine. `null` when the draft is too incomplete to evaluate (no
   * type / side) — the model then derives only draft-shape advisories.
   */
  evaluation: EvaluationResult | null;
  /**
   * RULE-005's channel suggestion for this draft, or null when no channel
   * is in play. Drives the `channel_mismatch` advisory.
   */
  channelSuggestion: ChannelSuggestion | null;
  /**
   * True when this is the first contentful post attempt in the current
   * dock session — drives `permanent_record_warning`. The dock owns this
   * flag (resets when the dock re-opens).
   */
  isFirstPostInSession: boolean;
  /**
   * BR-003 — context the tangent-risk assessment needs. Optional: when
   * omitted or null, `buildPreSendReview` skips derivation step 9 entirely
   * and behaves exactly as the merged RULE-004 model — the review is
   * byte-identical to the pre-BR-003 output. Additive — no existing caller
   * breaks. The caller (dock / composer) assembles this from the
   * already-loaded draft + parent + LIFE-001 / META-001 structures + the
   * BR-001 topology map; `tangentContext.draft` / `.parent` should mirror
   * this input's `draft` / `parent`.
   */
  tangentContext?: AssessTangentRiskInput | null;
}

// ── Frozen tuning constants ────────────────────────────────────

/**
 * Body length at or above which `broad_claim` fires (when no scope tag is
 * present). A deterministic SHAPE read — NOT keyword gating (§7 #5).
 */
export const BROAD_CLAIM_MIN_CHARS = 280;

/** Default `depth_warning` threshold when a room does not supply one. */
export const DEFAULT_DEPTH_WARNING_THRESHOLD = 6;

/** Frozen default room context — used when a caller omits one. */
export const DEFAULT_PRESEND_ROOM_CONTEXT: PreSendRoomContext = Object.freeze({
  depthWarningThreshold: DEFAULT_DEPTH_WARNING_THRESHOLD,
});

// ── Advisory definitions ───────────────────────────────────────

/** Static, frozen definition for one advisory kind. */
export interface AdvisoryDefinition {
  kind: AdvisoryKind;
  /** Severity in casual mode. `permanent_record_warning` overrides per mode. */
  baseSeverity: AdvisorySeverity;
  /** Ordered transformations; `post_anyway` always last. */
  suggested: ReadonlyArray<AdvisoryTransformation>;
}

function freezeDef(
  kind: AdvisoryKind,
  baseSeverity: AdvisorySeverity,
  suggested: AdvisoryTransformation[],
): AdvisoryDefinition {
  return Object.freeze({
    kind,
    baseSeverity,
    suggested: Object.freeze(suggested),
  });
}

/**
 * Frozen per-kind definition. Every advisory has ≥ 1 non-`post_anyway`
 * transformation and `post_anyway` is always present and always last.
 */
export const ADVISORY_DEFINITIONS: Readonly<
  Record<AdvisoryKind, AdvisoryDefinition>
> = Object.freeze({
  broad_claim: freezeDef('broad_claim', 'soft', [
    'narrow',
    'add_evidence',
    'post_anyway',
  ]),
  topic_drift: freezeDef('topic_drift', 'soft', [
    'narrow',
    'branch_tangent',
    'post_anyway',
  ]),
  asks_new_question: freezeDef('asks_new_question', 'soft', [
    'branch_tangent',
    'post_anyway',
  ]),
  no_source_attached: freezeDef('no_source_attached', 'soft', [
    'add_evidence',
    'add_quote',
    'post_anyway',
  ]),
  depth_warning: freezeDef('depth_warning', 'info', [
    'branch_tangent',
    'post_anyway',
  ]),
  permanent_record_warning: freezeDef('permanent_record_warning', 'info', [
    'save_draft',
    'post_anyway',
  ]),
  channel_mismatch: freezeDef('channel_mismatch', 'info', [
    'branch_tangent',
    'post_anyway',
  ]),
  // BR-003 — `soft` in casual mode; the suggested transformations are the
  // EXISTING `branch_tangent` ("Branch a side issue") + `post_anyway`.
  // BR-003 adds no new `AdvisoryTransformation` and no new `QuickActionLabel`.
  tangent_redirect: freezeDef('tangent_redirect', 'soft', [
    'branch_tangent',
    'post_anyway',
  ]),
});

/**
 * Returns the frozen static definition for an advisory kind. Pure O(1)
 * lookup. Throws on an unknown kind — the union makes that unreachable
 * from typed callers; the throw guards untyped boundaries.
 */
export function advisoryDefinition(kind: AdvisoryKind): AdvisoryDefinition {
  const def = ADVISORY_DEFINITIONS[kind];
  if (!def) {
    throw new Error(`advisoryDefinition: unknown advisory kind "${String(kind)}"`);
  }
  return def;
}

// ── Block flag-code projection ─────────────────────────────────

/**
 * Maps an EXISTING `evaluateArgumentDraft` blocking flag code to a
 * RULE-004 display `StructuralBlockKind`. Unknown codes project to
 * `invalid_transition` as a safe generic — they are still real engine
 * blocks; RULE-004 just lacks a specific display bucket.
 *
 * RULE-004 produces NO flag code — it re-shapes the engine's result.
 * `cooldown_active` has NO producer in v1 (§0 D4 — reserved).
 */
export function projectBlockKind(flagCode: string): StructuralBlockKind {
  switch (flagCode) {
    // An empty body is the one length condition that hard-blocks
    // (Stage 6.2 UX rescue made short-but-nonempty advisory only).
    case FLAG_CODES.UNCLEAR_CLAIM:
      return 'empty_body';
    case FLAG_CODES.EXCESSIVE_LENGTH:
      return 'over_length';
    case FLAG_CODES.EVIDENCE_REQUIRED:
      return 'evidence_without_source';
    case FLAG_CODES.INVALID_TRANSITION:
    case FLAG_CODES.MISSING_PARENT:
      return 'invalid_transition';
    default:
      // Still a real engine block — generic display bucket.
      return 'invalid_transition';
  }
}

// ── Transformation → preset bridge ─────────────────────────────

/**
 * Maps an `AdvisoryTransformation` to an existing
 * `quickActionPresets.QuickActionLabel`, or null for the two sheet-only
 * actions (`save_draft`, `post_anyway`). RULE-004 adds NO new
 * QuickActionLabel.
 */
export function transformationToQuickAction(
  t: AdvisoryTransformation,
): QuickActionLabel | null {
  switch (t) {
    case 'narrow':
      return 'narrow';
    case 'branch_tangent':
      return 'branch';
    case 'ask_source':
      return 'source';
    case 'add_quote':
      return 'quote';
    case 'add_evidence':
      return 'evidence';
    case 'save_draft':
    case 'post_anyway':
      return null;
    default:
      // Defensive — unreachable for the typed union.
      return null;
  }
}

// ── Internal derivation helpers ────────────────────────────────

/**
 * Qualifier codes that mean the draft already declares a scope-narrowing
 * intent — when any is present `broad_claim` does NOT fire (the user has
 * already narrowed). Typed codes only — never the body text.
 */
const SCOPE_NARROWING_CODES: ReadonlySet<string> = new Set([
  'scope_issue',
  'narrow_scope',
  'narrowed_claim',
  'scope_example',
]);

/**
 * Qualifier codes that mark the draft as a tangent / side-branch move —
 * one of the `asks_new_question` triggers.
 */
const TANGENT_TAG_CODES: ReadonlySet<string> = new Set([
  'branch_this_off',
  'tangent_or_joke',
  'tangent',
]);

/** Topic-coverage warning flag codes the engine raises as advisory. */
const TOPIC_DRIFT_FLAG_CODES: ReadonlySet<string> = new Set<string>([
  FLAG_CODES.OFF_TOPIC,
  FLAG_CODES.WEAK_TOPIC,
]);

function tagsHaveAny(
  tags: ReadonlyArray<string>,
  set: ReadonlySet<string>,
): boolean {
  for (const t of tags) {
    if (set.has(String(t).trim().toLowerCase())) return true;
  }
  return false;
}

/**
 * META-001 — does the parent's already-derived metadata recommend a
 * branch? Reads the auto-derived `branch_suggested` code only; never
 * re-derives. Returns false when no linkage is present (root draft).
 */
function parentSuggestsBranch(linkage: MoveLinkageRecord | null): boolean {
  if (!linkage) return false;
  for (const entry of linkage.autoDerivedMetadata) {
    if (entry.code === 'branch_suggested') return true;
  }
  return false;
}

/**
 * Deterministic body-SHAPE read: does the trimmed body end with a `?`.
 * This is a punctuation read, NOT keyword gating (§7 #5).
 */
function bodyEndsWithQuestion(body: string): boolean {
  return body.trim().endsWith('?');
}

/**
 * Builds a `PreSendAdvisory` from its frozen definition + severity. The
 * `plainLanguage` defaults to the frozen `PRESEND_ADVISORY_COPY` line for
 * the kind; an explicit `plainLanguageOverride` is used for advisories
 * whose copy lives in a sibling frozen block (BR-003's `tangent_redirect`
 * reads `TANGENT_ROUTING_COPY`, not `PRESEND_ADVISORY_COPY`).
 */
function buildAdvisory(
  kind: AdvisoryKind,
  severity: AdvisorySeverity,
  plainLanguageOverride?: string,
): PreSendAdvisory {
  const def = advisoryDefinition(kind);
  return {
    kind,
    severity,
    suggested: def.suggested,
    plainLanguage:
      plainLanguageOverride !== undefined
        ? plainLanguageOverride
        : PRESEND_ADVISORY_COPY[kind as keyof typeof PRESEND_ADVISORY_COPY],
  };
}

// ── buildPreSendReview ─────────────────────────────────────────

/**
 * Builds the complete pre-send review for a draft. Pure. Deterministic.
 * Idempotent. NO AI, NO network, NO mutation, NO async.
 *
 * Derivation order (the array order is the render order):
 *  1. structuralBlocks — project every `blockingError` flag code to a
 *     `StructuralBlockKind`. Sets `hasStructuralBlock`.
 *  2. no_source_attached — `evidence` type && no attached evidence.
 *  3. topic_drift — `evaluation.warnings` contains WEAK_TOPIC / OFF_TOPIC.
 *  4. broad_claim — body length ≥ BROAD_CLAIM_MIN_CHARS && no scope tag.
 *  5. asks_new_question — META-001 branch_suggested, OR a tangent tag, OR
 *     the body ends with `?` and the type is not clarification_request.
 *  6. depth_warning — parent depth + 1 ≥ room.depthWarningThreshold.
 *  7. channel_mismatch — channelSuggestion.isMismatch === true.
 *  8. permanent_record_warning — isFirstPostInSession === true.
 *
 * Never reads: strength bands, heat, reply counts, engagement, the raw
 * body text for keyword matching.
 */
export function buildPreSendReview(input: PreSendReviewInput): PreSendReview {
  const { draft, mode, parent, room, lifecycle, evaluation, channelSuggestion } =
    input;

  const advisories: PreSendAdvisory[] = [];
  const structuralBlocks: PreSendStructuralBlock[] = [];

  // ── 1. structuralBlocks — read-only projection of the engine's result.
  if (evaluation) {
    for (const err of evaluation.blockingErrors as EvaluationFlagDetail[]) {
      const kind = projectBlockKind(err.flagCode);
      structuralBlocks.push({
        kind,
        plainLanguage: PRESEND_BLOCK_COPY[kind],
      });
    }
  }
  const hasStructuralBlock = structuralBlocks.length > 0;

  // ── 2. no_source_attached — evidence type with nothing attached.
  if (
    draft.argumentType === 'evidence' &&
    draft.attachedEvidence.length === 0
  ) {
    advisories.push(
      buildAdvisory('no_source_attached', advisoryDefinition('no_source_attached').baseSeverity),
    );
  }

  // ── 3. topic_drift — the engine already flagged weak / off-topic.
  if (evaluation) {
    const hasTopicDriftWarning = evaluation.warnings.some((w) =>
      TOPIC_DRIFT_FLAG_CODES.has(w.flagCode),
    );
    if (hasTopicDriftWarning) {
      advisories.push(
        buildAdvisory('topic_drift', advisoryDefinition('topic_drift').baseSeverity),
      );
    }
  }

  // ── 4. broad_claim — long body, no scope-narrowing qualifier.
  // Deterministic length SHAPE read (§7 #5) — never a keyword scan.
  if (
    draft.body.length >= BROAD_CLAIM_MIN_CHARS &&
    !tagsHaveAny(draft.selectedTagCodes, SCOPE_NARROWING_CODES)
  ) {
    advisories.push(
      buildAdvisory('broad_claim', advisoryDefinition('broad_claim').baseSeverity),
    );
  }

  // ── 5. asks_new_question — META-001 branch_suggested OR a tangent tag
  // OR a `?`-shaped body on a non-clarification draft.
  const metaBranchSuggested = parentSuggestsBranch(lifecycle.parentLinkage);
  const draftHasTangentTag = tagsHaveAny(
    draft.selectedTagCodes,
    TANGENT_TAG_CODES,
  );
  const questionShape =
    bodyEndsWithQuestion(draft.body) &&
    draft.argumentType !== 'clarification_request';
  const asksNewQuestionFired =
    metaBranchSuggested || draftHasTangentTag || questionShape;
  if (asksNewQuestionFired) {
    advisories.push(
      buildAdvisory(
        'asks_new_question',
        advisoryDefinition('asks_new_question').baseSeverity,
      ),
    );
  }

  // ── 6. depth_warning — the move would sit deep in the chain.
  if (parent !== null && parent.depth + 1 >= room.depthWarningThreshold) {
    advisories.push(
      buildAdvisory('depth_warning', advisoryDefinition('depth_warning').baseSeverity),
    );
  }

  // ── 7. channel_mismatch — RULE-005's deterministic mismatch flag.
  // Absorbs RULE-005's already-shipped advisory; same `isMismatch`
  // condition that fires the inline chip-row advisory (§4.4 de-dup).
  if (channelSuggestion !== null && channelSuggestion.isMismatch === true) {
    advisories.push(
      buildAdvisory(
        'channel_mismatch',
        advisoryDefinition('channel_mismatch').baseSeverity,
      ),
    );
  }

  // ── 8. permanent_record_warning — honest, non-fear-based. In strict
  // mode it upgrades to `soft` (the ONLY place `mode` is read).
  if (input.isFirstPostInSession === true) {
    const severity: AdvisorySeverity = mode === 'strict' ? 'soft' : 'info';
    advisories.push(buildAdvisory('permanent_record_warning', severity));
  }

  // ── 9. tangent_redirect — BR-003. Calls assessTangentRisk on the
  // draft + parent. When the assessment's `risk` is 'possible' OR
  // 'strong', append a `tangent_redirect` advisory. When `risk` is
  // 'none', append nothing. When `tangentContext` is omitted or null,
  // step 9 is a NO-OP — the review is byte-identical to merged RULE-004
  // (§3.3, §7 #5).
  //
  // De-dup with `asks_new_question` (§3.4 / §7 #6): when the tangent
  // assessment fired PURELY because of `user_marked_tangent` (a tangent
  // qualifier tag) AND `asks_new_question` already fired for that same
  // tag, the `tangent_redirect` advisory is SUPPRESSED — the user sees
  // one card, not two, for one tag. `tangent_redirect` is appended only
  // when its reason carries axis-mismatch / no-signal / mode-demands /
  // repeated-off-path information `asks_new_question` does not.
  if (input.tangentContext !== undefined && input.tangentContext !== null) {
    const tangentAssessment = assessTangentRisk(input.tangentContext);
    const isUserMarkedOnly =
      tangentAssessment.reason === 'user_marked_tangent';
    const dedupSuppressed = isUserMarkedOnly && asksNewQuestionFired;
    if (
      (tangentAssessment.risk === 'possible' ||
        tangentAssessment.risk === 'strong') &&
      !dedupSuppressed
    ) {
      advisories.push(
        buildAdvisory(
          'tangent_redirect',
          advisoryDefinition('tangent_redirect').baseSeverity,
          tangentAdvisoryPlainLanguage(tangentAssessment),
        ),
      );
    }
  }

  return {
    advisories,
    structuralBlocks,
    hasStructuralBlock,
    shouldShowSheet: advisories.length > 0 || structuralBlocks.length > 0,
  };
}

/**
 * Resolves the plain-language line a `channel_mismatch` advisory should
 * show. RULE-004 PREFERS RULE-005's `suggestion.rationale` verbatim so
 * the inline chip-row advisory and the sheet advisory say the SAME
 * sentence (design §4.4 #2). Falls back to the frozen
 * `PRESEND_ADVISORY_COPY.channel_mismatch` line only when the suggestion
 * is null — which it never is when a mismatch actually fired.
 */
export function channelMismatchPlainLanguage(
  channelSuggestion: ChannelSuggestion | null,
): string {
  if (
    channelSuggestion !== null &&
    typeof channelSuggestion.rationale === 'string' &&
    channelSuggestion.rationale.trim().length > 0
  ) {
    return channelSuggestion.rationale;
  }
  return PRESEND_ADVISORY_COPY.channel_mismatch;
}

// ── Ban-list support ───────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/preSendReviewBanList.test.ts`.
 * NOT a content filter. Mirrors `_forbiddenChannelTokens` /
 * `_forbiddenMetadataTokens` / `_forbiddenLifecycleTokens` so RULE-004
 * copy is held to the same bar.
 *
 * Punitive tokens (dodge / evade / avoid) are included so the
 * non-punitive requirement is enforced; fear tokens (judged / punished)
 * are included so the `permanent_record_warning` honesty requirement is
 * enforced (design §8 / acceptance criteria).
 */
export function _forbiddenPreSendTokens(): string[] {
  return [
    // Verdict tokens
    'winner',
    'loser',
    'correct',
    'incorrect',
    'true',
    'false',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'troll',
    'bot',
    'astroturfer',
    'verdict',
    'proof',
    'proven',
    'disproven',
    'lost',
    'defeated',
    'won',
    'right',
    'wrong',
    'validated',
    // Amplification tokens
    'likes',
    'retweets',
    'shares',
    'views',
    'followers',
    'verified',
    'engagement',
    'amplification',
    'trending',
    'virality',
    'popular',
    'viral',
    // Block / prevent tokens (an advisory must never block)
    'block',
    'prevent',
    'reject',
    'forbid',
    'disallow',
    'denied',
    // Non-punitive guard — copy describes the move, never the person
    'dodge',
    'dodging',
    'evade',
    'evading',
    'evasion',
    'avoiding',
    // Fear guard — permanent_record_warning is honest, not fear-based
    'judged',
    'judgement',
    'judgment',
    'punished',
    'punishment',
    'damage',
  ];
}
