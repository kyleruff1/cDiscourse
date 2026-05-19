/**
 * SC-004 — Timeline node action dock model (pure TypeScript).
 *
 * Owns:
 *   - The locked 16-code `TimelineNodeActionDockActionCode` vocabulary
 *     (15 roadmap §8 codes + the `expand_branch` collapsed-stub primitive).
 *   - The actor matrix (5 actors × 15 actions).
 *   - The lifecycle → primary action table (19 LIFE-001 states).
 *   - The manual tag → action promotion table (10 META-001 codes).
 *   - The source-chain → action override table (6 EV-001 statuses).
 *   - The composer-preset round-trip (`actionDockToComposerPreset`).
 *   - The COPY-001 disambiguation rule (cluster header vs move chips).
 *   - `_forbiddenDockTokens` (consumed by ban-list tests).
 *
 * Doctrine anchor — read this before changing anything:
 *
 *   1. **The dock RECOMMENDS, never BLOCKS.** Even `exhausted` /
 *      `archived_or_resolved` only re-order suggestions; ordinary `reply`
 *      stays available everywhere the actor matrix allows.
 *   2. **Lifecycle is play state, not truth.** No code path infers truth /
 *      winner / loser / correctness from a lifecycle, metadata, or evidence
 *      input. Wrong-but-loud and right-but-quiet produce identical dock
 *      models when move structure matches.
 *   3. **No verdict tokens in any user-facing copy.** Labels, helper copy,
 *      accessibility labels, preset bodies, all scanned by
 *      `_forbiddenDockTokens`.
 *   4. **No person-attribution drift.** Labels describe a move or a
 *      cluster. `ignored_by_negative` surfaces as "Negative did not respond"
 *      (cluster-level, factual) — never as an accusation.
 *   5. **No re-derivation of upstream signals.** The model consumes outputs
 *      (`PointLifecycleMap`, `MoveMetadataLedger`, `ClusterMetadataSummary`,
 *      `TimelineEvidenceContract`) only. Never value-imports
 *      `deriveMessageCategory`, `derivePrimaryQualifier`,
 *      `deriveMessageQualifiers`, `applyAntiAmplification`, `gradeChallenge`,
 *      `gradeRepair`, or `buildPointLifecycleMap`. Enforced by a
 *      forbidden-imports test.
 *   6. **The dock is the dispatch surface, never the post path.** It emits
 *      an action code + an optional `MoveDraftPatch`; the room shell
 *      threads those into the existing composer + `submit-argument` Edge
 *      Function. This file never imports `supabase`, `fetch`, any router,
 *      or any network primitive.
 *   7. **Heat ≠ correctness.** Standing band / tone band / temperature
 *      band from the surface model are NEVER read here.
 *
 * Pure TS. No React. No Supabase. No network. No async. No mutation of any
 * input. No new dependency. No AI inference.
 */

import type {
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
  BubbleControlsContext,
} from './argumentGameSurfaceModel';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleMap,
  PointLifecycleState,
} from '../lifecycle';
import { getPointLifecyclePlainLabel } from '../lifecycle';
import type {
  AutoMetadataCode,
  AutoMetadataEntry,
  ClusterMetadataSummary,
  ManualTagCode,
  ManualTagEntry,
  MoveLinkageRecord,
  MoveMetadataLedger,
} from '../metadata';
import {
  getAutoMetadataPlainLabel,
  getManualTagPlainLabel,
} from '../metadata';
import type {
  SourceChainStatus,
  TimelineEvidenceContract,
} from '../evidence/evidenceModel';
import type { ArgumentType } from '../../domain/constitution/types';
import type { MoveDraftPatch } from './conversationMoves';
import { quickActionToPreset, type QuickActionLabel } from './quickActionPresets';

// ── Public types — action vocabulary ───────────────────────────

/**
 * SC-004 — Action vocabulary surfaced by the timeline node action dock. 15
 * codes match roadmap §8 verbatim; `expand_branch` is a 16th UI primitive
 * (collapsed-stub target only) that NEVER appears in a participant's post
 * path.
 *
 * Doctrine: every code maps to either a composer preset (via
 * `actionDockToComposerPreset`) or a non-post dispatch (manual-tag
 * application / branch toggle / Cards-detail toggle / flag flow). No code
 * labels a person. No code claims truth.
 */
export type TimelineNodeActionDockActionCode =
  | 'reply'
  | 'challenge'
  | 'ask_source'
  | 'ask_quote'
  | 'clarify'
  | 'add_evidence'
  | 'narrow'
  | 'concede'
  | 'confirm'
  | 'mark_moved_on'
  | 'mark_ignored'
  | 'branch'
  | 'synthesize'
  | 'flag'
  | 'open_cards_detail'
  // Collapsed-stub-only UI primitive. Never offered on node / cluster targets.
  | 'expand_branch';

/** Frozen array of every action code. Tests + RULE-003 iterate this. */
export const ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES:
  ReadonlyArray<TimelineNodeActionDockActionCode> = Object.freeze([
    'reply',
    'challenge',
    'ask_source',
    'ask_quote',
    'clarify',
    'add_evidence',
    'narrow',
    'concede',
    'confirm',
    'mark_moved_on',
    'mark_ignored',
    'branch',
    'synthesize',
    'flag',
    'open_cards_detail',
    'expand_branch',
  ]);

/**
 * SC-004 reuses the existing 5-value actor union (mirrors
 * `ArgumentBubbleActor`) plus an explicit `observer` value. `admin` is
 * treated identically to `other` for action computation; admin review
 * lives on AdminArgumentsTab.
 */
export type TimelineNodeActionDockActor =
  | 'self'
  | 'other'
  | 'observer'
  | 'bot'
  | 'admin'
  | 'unknown';

/**
 * What the user selected on the timeline. Selection state lives in the
 * room shell; SC-004 reads this shape and produces the dock model.
 */
export type TimelineNodeActionDockTarget =
  | { kind: 'node'; messageId: string }
  | { kind: 'cluster'; branchRootMessageId: string }
  | { kind: 'collapsed_stub'; branchRootMessageId: string };

/**
 * Why an action is disabled. The dock surfaces helper copy keyed off this
 * code; the model never emits raw codes to the UI.
 *
 * Doctrine: disabled is never a verdict. `observer_must_join` invites,
 * `own_bubble` explains, `cluster_action_on_node` nudges,
 * `archived_resolved` informs. No code blames a user.
 */
export type TimelineNodeActionDockDisabledReason =
  | 'observer_must_join'
  | 'own_bubble'
  | 'cluster_action_on_node'
  | 'node_action_on_cluster'
  | 'archived_resolved'
  | 'detached_node'
  | 'evidence_already_attached'
  | 'quote_already_attached'
  | 'manual_tag_not_in_vocabulary'
  | 'collapsed_stub_must_expand';

/** Action record — the shape the component renders. */
export interface TimelineNodeActionDockAction {
  /** Action code. */
  action: TimelineNodeActionDockActionCode;
  /** Plain-language label (≤ 24 chars). */
  label: string;
  /** Verbose accessibility label for screen readers. ≤ 80 chars. */
  accessibilityLabel: string;
  /** Optional helper copy (e.g. "Join a side to ask quote"). */
  helperCopy?: string;
  /** True for the chosen primary action. */
  isPrimary: boolean;
  /** True when the action is rendered but cannot be invoked. */
  isDisabled: boolean;
  /** Reason an action is disabled — drives helper copy + a11y hint. */
  disabledReason?: TimelineNodeActionDockDisabledReason;
  /** Debug-only rationale code for AN-003. NEVER rendered in normal-user
   *  surfaces. */
  rationaleCode?: string;
}

/**
 * Cluster-level lifecycle / metadata strip rendered at the top of the
 * dock. SC-004 disambiguates `answered` (cluster lifecycle) vs `has_reply`
 * (move auto-metadata) by always rendering cluster-level codes here and
 * move-level codes in the per-move chip area (`moveChips`), never
 * side-by-side on the same line.
 */
export interface TimelineNodeActionDockClusterHeader {
  /** Plain-language lifecycle label (e.g. "Source requested"). */
  lifecycleLabel: string;
  /** Optional plain-language manual-tag aggregate ("Needs source + Definition
   *  fight"). Truncated at 64 chars. Empty string when no manual tags. */
  manualTagSummary: string;
  /** Optional plain-language auto-metadata aggregate. Truncated at 64
   *  chars. Empty string when no notable auto-metadata. */
  autoMetadataSummary: string;
  /** Plain-language evidence-chip label (from EV-001). Empty string when
   *  no contract. */
  evidenceLabel: string;
  /** Single-line accessibility label combining the four. */
  accessibilityLabel: string;
}

/**
 * Per-move chip data. Renders next to the selected node, NEVER on the
 * cluster header. Move-level `has_reply` / `has_rebuttal` / `source_attached`
 * etc. land here.
 */
export interface TimelineNodeActionDockMoveChip {
  /** Internal code for debug only. NEVER rendered. */
  code: string;
  /** Plain-language label. */
  label: string;
  /** Optional accessibility hint. */
  accessibilityHint?: string;
}

/**
 * The chosen primary action plus a debug-only rationale code that drives
 * AN-003 diagnostics + makes tests deterministic.
 */
export interface TimelineNodeActionDockPrimarySuggestion {
  action: TimelineNodeActionDockActionCode;
  /** Why this action was chosen. NEVER rendered in normal-user UI. */
  rationaleCode: string;
}

/** The dock model — the component's render contract. */
export interface TimelineNodeActionDockModel {
  /** The target this dock describes. */
  target: TimelineNodeActionDockTarget;
  /** The actor who will dispatch the action. */
  actor: TimelineNodeActionDockActor;
  /** Cluster id (= `branchRootMessageId`). */
  clusterId: string;
  /** Cluster header — always present. */
  clusterHeader: TimelineNodeActionDockClusterHeader;
  /** Per-move chips. Empty array for cluster / collapsed_stub targets. */
  moveChips: ReadonlyArray<TimelineNodeActionDockMoveChip>;
  /** The chosen primary action. */
  primarySuggestion: TimelineNodeActionDockPrimarySuggestion;
  /** Full ordered action list. The primary is `actions[0]`; secondary
   *  actions follow in roadmap §8 order minus the primary. Disabled
   *  actions are kept in the list — the component renders them dimmed
   *  with helper copy. */
  actions: ReadonlyArray<TimelineNodeActionDockAction>;
  /** Accessibility label for the dock root. */
  accessibilityLabel: string;
}

/** Inputs to the dock-model builder. */
export interface TimelineNodeActionDockInput {
  /** Selected target — node / cluster / collapsed stub. */
  target: TimelineNodeActionDockTarget;
  /** Actor classification. */
  actor: TimelineNodeActionDockActor;
  /** The full timeline surface model (already built by the room shell). */
  timelineMap: ArgumentTimelineMapModel;
  /** LIFE-001 lifecycle map. Read-only. */
  lifecycleMap: PointLifecycleMap;
  /** META-001 metadata ledger. Read-only. */
  metadataLedger: MoveMetadataLedger;
  /** EV-001 per-node contract builder. */
  evidenceContractFor: (messageId: string) => TimelineEvidenceContract | null;
  /** Existing controls context (for SC-002 parity). */
  controlsContext?: BubbleControlsContext;
  /** True when the viewer cannot post (observer). */
  isReadModeViewer?: boolean;
}

// ── Internal constants — locked tables ────────────────────────

/**
 * Lifecycle state → default primary action (participant-other, default
 * actor). Mirrors design §"Lifecycle matrix" verbatim. The fallback drives
 * the secondary list head when the primary is disabled by actor / target
 * rules.
 */
const LIFECYCLE_PRIMARY_ACTION_TABLE: Readonly<Record<
  PointLifecycleState,
  { primary: TimelineNodeActionDockActionCode; fallback: TimelineNodeActionDockActionCode; rationale: string }
>> = Object.freeze({
  open: { primary: 'reply', fallback: 'challenge', rationale: 'lifecycle:open' },
  answered: { primary: 'challenge', fallback: 'clarify', rationale: 'lifecycle:answered' },
  rebutted: { primary: 'challenge', fallback: 'clarify', rationale: 'lifecycle:rebutted' },
  clarified: { primary: 'reply', fallback: 'challenge', rationale: 'lifecycle:clarified' },
  sourced: { primary: 'challenge', fallback: 'add_evidence', rationale: 'lifecycle:sourced' },
  quote_requested: { primary: 'ask_quote', fallback: 'clarify', rationale: 'lifecycle:quote_requested' },
  source_requested: { primary: 'ask_source', fallback: 'clarify', rationale: 'lifecycle:source_requested' },
  narrowed: { primary: 'confirm', fallback: 'challenge', rationale: 'lifecycle:narrowed' },
  conceded: { primary: 'confirm', fallback: 'synthesize', rationale: 'lifecycle:conceded' },
  confirmed: { primary: 'synthesize', fallback: 'reply', rationale: 'lifecycle:confirmed' },
  synthesis_ready: { primary: 'synthesize', fallback: 'confirm', rationale: 'lifecycle:synthesis_ready' },
  moved_on_by_affirmative: { primary: 'confirm', fallback: 'reply', rationale: 'lifecycle:moved_on_by_affirmative' },
  moved_on_by_negative: { primary: 'confirm', fallback: 'reply', rationale: 'lifecycle:moved_on_by_negative' },
  ignored_by_affirmative: { primary: 'reply', fallback: 'synthesize', rationale: 'lifecycle:ignored_by_affirmative' },
  ignored_by_negative: { primary: 'reply', fallback: 'synthesize', rationale: 'lifecycle:ignored_by_negative' },
  ignored_by_both: { primary: 'reply', fallback: 'synthesize', rationale: 'lifecycle:ignored_by_both' },
  exhausted: { primary: 'narrow', fallback: 'branch', rationale: 'lifecycle:exhausted' },
  branch_recommended: { primary: 'branch', fallback: 'narrow', rationale: 'lifecycle:branch_recommended' },
  archived_or_resolved: { primary: 'open_cards_detail', fallback: 'reply', rationale: 'lifecycle:archived_or_resolved' },
});

/**
 * Manual tag → action promotion. Mirrors design §"Manual tag → primary
 * action promotion" verbatim. When the selected target carries one of
 * these manual tags, the action listed here overrides the lifecycle
 * default.
 *
 * Doctrine: manual tags are participant intent; intent beats default.
 */
const MANUAL_TAG_ACTION_PROMOTION: Readonly<Record<
  ManualTagCode,
  { action: TimelineNodeActionDockActionCode; rationale: string }
>> = Object.freeze({
  needs_source: { action: 'ask_source', rationale: 'tag:needs_source' },
  needs_quote: { action: 'ask_quote', rationale: 'tag:needs_quote' },
  definition_issue: { action: 'clarify', rationale: 'tag:definition_issue' },
  scope_issue: { action: 'narrow', rationale: 'tag:scope_issue' },
  causal_mechanism: { action: 'challenge', rationale: 'tag:causal_mechanism' },
  evidence_debt: { action: 'add_evidence', rationale: 'tag:evidence_debt' },
  concession_offered: { action: 'confirm', rationale: 'tag:concession_offered' },
  narrowed_claim: { action: 'confirm', rationale: 'tag:narrowed_claim' },
  tangent: { action: 'branch', rationale: 'tag:tangent' },
  ready_for_synthesis: { action: 'synthesize', rationale: 'tag:ready_for_synthesis' },
});

/**
 * Source-chain status × default actor → primary action override.
 * Mirrors design §"Evidence / source-chain matrix" verbatim.
 */
const SOURCE_CHAIN_ACTION_TABLE: Readonly<Record<
  SourceChainStatus,
  { primary: TimelineNodeActionDockActionCode; secondary: TimelineNodeActionDockActionCode; rationale: string }
>> = Object.freeze({
  no_source: { primary: 'ask_source', secondary: 'open_cards_detail', rationale: 'evidence:no_source' },
  unverified: { primary: 'ask_source', secondary: 'add_evidence', rationale: 'evidence:unverified' },
  source_no_quote: { primary: 'ask_quote', secondary: 'add_evidence', rationale: 'evidence:source_no_quote' },
  source_and_quote: { primary: 'open_cards_detail', secondary: 'challenge', rationale: 'evidence:source_and_quote' },
  broken: { primary: 'ask_source', secondary: 'add_evidence', rationale: 'evidence:broken' },
  primary_present: { primary: 'open_cards_detail', secondary: 'challenge', rationale: 'evidence:primary_present' },
});

/**
 * Default secondary order — roadmap §8 with `reply`, `flag`, and
 * `open_cards_detail` appended at the end. The chosen primary is removed
 * before ordering.
 */
const DEFAULT_SECONDARY_ORDER: ReadonlyArray<TimelineNodeActionDockActionCode> = Object.freeze([
  'challenge',
  'ask_source',
  'ask_quote',
  'clarify',
  'add_evidence',
  'narrow',
  'concede',
  'confirm',
  'mark_moved_on',
  'mark_ignored',
  'branch',
  'synthesize',
  'reply',
  'flag',
  'open_cards_detail',
]);

/** SC-004 UI vocabulary — action labels. ≤ 24 chars each. Plain English. */
const ACTION_LABELS: Readonly<Record<TimelineNodeActionDockActionCode, string>> = Object.freeze({
  reply: 'Reply',
  challenge: 'Challenge',
  ask_source: 'Ask source',
  ask_quote: 'Ask quote',
  clarify: 'Clarify',
  add_evidence: 'Add evidence',
  narrow: 'Narrow',
  concede: 'Concede',
  confirm: 'Confirm',
  mark_moved_on: 'Mark moved on',
  mark_ignored: 'Mark ignored',
  branch: 'Branch',
  synthesize: 'Synthesize',
  flag: 'Flag',
  open_cards_detail: 'Open details',
  expand_branch: 'Expand branch',
});

/** Verbose accessibility label for each action. */
const ACTION_A11Y_LABELS: Readonly<Record<TimelineNodeActionDockActionCode, string>> = Object.freeze({
  reply: 'Reply to this move',
  challenge: 'Challenge this move',
  ask_source: 'Ask the speaker for a primary source',
  ask_quote: 'Ask the speaker to quote the exact passage',
  clarify: 'Ask for a clarification',
  add_evidence: 'Attach a piece of evidence',
  narrow: 'Narrow the scope of this point',
  concede: 'Concede this point',
  confirm: 'Confirm the repaired claim',
  mark_moved_on: 'Mark this point as moved on by a side',
  mark_ignored: 'Mark this point as not responded to',
  branch: 'Open a side issue from this point',
  synthesize: 'Summarise where this cluster landed',
  flag: 'Send this move to moderators for review',
  open_cards_detail: 'Open the cards detail view for this point',
  expand_branch: 'Expand this collapsed branch',
});

/** Helper copy keyed off disabled reason. */
const DISABLED_HELPER_COPY: Readonly<Record<TimelineNodeActionDockDisabledReason, string>> = Object.freeze({
  observer_must_join: 'Join a side to use this action.',
  own_bubble: 'This action is for replies on someone else\'s move.',
  cluster_action_on_node: 'Select the cluster to use this action.',
  node_action_on_cluster: 'Pick a specific message to use this action.',
  archived_resolved: 'This point is resolved. Open details to read.',
  detached_node: "This message isn't attached to the conversation tree yet.",
  evidence_already_attached: 'A source is already attached to this move.',
  quote_already_attached: 'A quote is already attached to this move.',
  manual_tag_not_in_vocabulary: 'This is coming in a later update. For now, use Reply to ask again or Synthesize to wrap up.',
  collapsed_stub_must_expand: 'Expand the branch first to act on a specific move.',
});

// ── Actor matrix ──────────────────────────────────────────────

interface ActorRule {
  /** True when this actor may invoke this action. */
  enabled: boolean;
  /** Disabled reason if not enabled. */
  reason?: TimelineNodeActionDockDisabledReason;
}

/**
 * Actor × action gate. The first filter applied to the action list. After
 * actor restriction, lifecycle / metadata / evidence refinement runs.
 *
 * Per design §"Actor matrix":
 *   - `mark_moved_on` / `mark_ignored` are DISABLED in v1 for every actor
 *     because META-001's ManualTagCode vocabulary does not include the
 *     side-explicit codes (META-001 patch candidate).
 *   - Observer may `ask_source` (Stage 6.4 rail honours this), `flag`
 *     (CLAUDE.md allows), and `open_cards_detail`. All other participant
 *     actions show with `observer_must_join`.
 *   - Self (own bubble) may apply META-001 own-bubble manual tags
 *     (`narrow` / `concede` / `synthesize`) and `open_cards_detail`. All
 *     other actions show with `own_bubble`.
 */
function actorRule(
  actor: TimelineNodeActionDockActor,
  action: TimelineNodeActionDockActionCode,
): ActorRule {
  // `open_cards_detail` is always enabled for every actor.
  if (action === 'open_cards_detail') return { enabled: true };

  // `expand_branch` is only meaningful on collapsed_stub targets, but the
  // actor matrix itself does not gate it — target validation does.
  if (action === 'expand_branch') return { enabled: true };

  // `mark_moved_on` / `mark_ignored` — v1 DISABLED for everyone.
  if (action === 'mark_moved_on' || action === 'mark_ignored') {
    if (actor === 'observer') return { enabled: false, reason: 'observer_must_join' };
    return { enabled: false, reason: 'manual_tag_not_in_vocabulary' };
  }

  if (actor === 'observer') {
    // Observer may ask_source (Stage 6.4) + flag (CLAUDE.md) + open_cards_detail.
    if (action === 'ask_source') return { enabled: true };
    if (action === 'flag') return { enabled: true };
    return { enabled: false, reason: 'observer_must_join' };
  }

  if (actor === 'self') {
    // Own-bubble allows narrow / concede / synthesize (META-001
    // eligibility) and open_cards_detail. Everything else is disabled.
    if (action === 'narrow' || action === 'concede' || action === 'synthesize') {
      return { enabled: true };
    }
    return { enabled: false, reason: 'own_bubble' };
  }

  // 'other' / 'bot' / 'admin' / 'unknown' → full participant set.
  return { enabled: true };
}

// ── Helpers — target resolution ───────────────────────────────

interface ResolvedTarget {
  clusterId: string;
  selectedNode: ArgumentTimelineMapNode | null;
  clusterSummary: PointLifecycleClusterSummary | null;
  clusterMetadata: ClusterMetadataSummary | null;
  moveLinkage: MoveLinkageRecord | null;
  evidenceContract: TimelineEvidenceContract | null;
  /** True when the node target is detached from the conversation tree. */
  isDetached: boolean;
}

function findNodeById(
  map: ArgumentTimelineMapModel,
  messageId: string,
): ArgumentTimelineMapNode | null {
  for (const n of map.nodes) {
    if (n.messageId === messageId) return n;
  }
  return null;
}

function resolveTarget(
  target: TimelineNodeActionDockTarget,
  timelineMap: ArgumentTimelineMapModel,
  lifecycleMap: PointLifecycleMap,
  metadataLedger: MoveMetadataLedger,
  evidenceContractFor: (messageId: string) => TimelineEvidenceContract | null,
): ResolvedTarget {
  if (target.kind === 'node') {
    const node = findNodeById(timelineMap, target.messageId);
    const clusterId = node?.branchRootMessageId ?? target.messageId;
    const summary = lifecycleMap.byCluster.get(clusterId) ?? null;
    const clusterMeta = metadataLedger.byCluster.get(clusterId) ?? null;
    const moveLink = metadataLedger.byMessage.get(target.messageId) ?? null;
    const evidence = evidenceContractFor(target.messageId);
    const isDetached = node ? (node.isDetached || (!node.isRoot && node.parentId === null)) : false;
    return {
      clusterId,
      selectedNode: node,
      clusterSummary: summary,
      clusterMetadata: clusterMeta,
      moveLinkage: moveLink,
      evidenceContract: evidence,
      isDetached,
    };
  }
  const clusterId = target.branchRootMessageId;
  const summary = lifecycleMap.byCluster.get(clusterId) ?? null;
  const clusterMeta = metadataLedger.byCluster.get(clusterId) ?? null;
  return {
    clusterId,
    selectedNode: null,
    clusterSummary: summary,
    clusterMetadata: clusterMeta,
    moveLinkage: null,
    evidenceContract: null,
    isDetached: false,
  };
}

// ── Helpers — cluster header ──────────────────────────────────

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '…';
}

/** Cluster header lifecycle label. Falls back to "Open for response" when
 *  the cluster summary is missing. */
function buildLifecycleLabel(summary: PointLifecycleClusterSummary | null): string {
  const state: PointLifecycleState = summary?.state ?? 'open';
  return getPointLifecyclePlainLabel(state);
}

function buildManualTagSummary(clusterMeta: ClusterMetadataSummary | null): string {
  if (!clusterMeta || clusterMeta.manualTagCodes.length === 0) return '';
  const labels: string[] = [];
  for (const code of clusterMeta.manualTagCodes) {
    const label = getManualTagPlainLabel(code);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return truncate(labels.join(' + '), 64);
}

/**
 * Cluster-level auto-metadata aggregate. Per COPY-001: cluster-level
 * codes (`branch_suggested`, `point_stalled`, `repeated_axis_pressure`,
 * `synthesis_candidate`, `point_exhausted`, `branch_created`) belong here.
 * Move-level codes (`has_reply`, `has_rebuttal`, `source_attached`,
 * etc.) land in `moveChips`, never in this aggregate.
 */
const CLUSTER_LEVEL_AUTO_CODES: ReadonlyArray<AutoMetadataCode> = Object.freeze([
  'branch_suggested',
  'branch_created',
  'point_stalled',
  'point_exhausted',
  'repeated_axis_pressure',
  'synthesis_candidate',
]);

function buildAutoMetadataSummary(clusterMeta: ClusterMetadataSummary | null): string {
  if (!clusterMeta || clusterMeta.autoMetadataCodes.length === 0) return '';
  const labels: string[] = [];
  for (const code of clusterMeta.autoMetadataCodes) {
    if (!CLUSTER_LEVEL_AUTO_CODES.includes(code)) continue;
    const label = getAutoMetadataPlainLabel(code);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return truncate(labels.join(' + '), 64);
}

function buildEvidenceLabel(contract: TimelineEvidenceContract | null): string {
  if (!contract) return '';
  const chip = contract.receiptChip;
  if (!chip || !chip.label) return '';
  return chip.label;
}

function buildClusterHeader(
  summary: PointLifecycleClusterSummary | null,
  clusterMeta: ClusterMetadataSummary | null,
  evidenceContract: TimelineEvidenceContract | null,
): TimelineNodeActionDockClusterHeader {
  const lifecycleLabel = buildLifecycleLabel(summary);
  const manualTagSummary = buildManualTagSummary(clusterMeta);
  const autoMetadataSummary = buildAutoMetadataSummary(clusterMeta);
  const evidenceLabel = buildEvidenceLabel(evidenceContract);
  const parts = [lifecycleLabel];
  if (manualTagSummary) parts.push(manualTagSummary);
  if (autoMetadataSummary) parts.push(autoMetadataSummary);
  if (evidenceLabel) parts.push(evidenceLabel);
  const accessibilityLabel = `Cluster status: ${parts.join('. ')}.`;
  return {
    lifecycleLabel,
    manualTagSummary,
    autoMetadataSummary,
    evidenceLabel,
    accessibilityLabel,
  };
}

// ── Helpers — move chips (COPY-001 disambiguation) ────────────

/**
 * Move-level auto codes that land on per-move chips, NOT the cluster
 * header.
 */
const MOVE_LEVEL_AUTO_CODES: ReadonlyArray<AutoMetadataCode> = Object.freeze([
  'has_reply',
  'has_rebuttal',
  'has_counter_rebuttal',
  'has_evidence',
  'source_attached',
  'quote_attached',
  'source_requested',
  'quote_requested',
  'participant_skipped_node',
  'no_response_after_n_turns',
]);

/**
 * COPY-001 — `answered` (cluster lifecycle) and `has_reply` (move
 * auto-metadata) both render `"Has a reply"`. The dock suppresses the
 * move-chip when the cluster header already shows the same plain-language
 * label. This is the structural guarantee that protects COPY-001.
 */
function buildMoveChips(
  selectedNode: ArgumentTimelineMapNode | null,
  moveLinkage: MoveLinkageRecord | null,
  clusterLifecycleLabel: string,
): ReadonlyArray<TimelineNodeActionDockMoveChip> {
  if (!selectedNode || !moveLinkage) return [];
  const chips: TimelineNodeActionDockMoveChip[] = [];
  for (const entry of moveLinkage.autoDerivedMetadata) {
    const code = entry.code;
    if (!MOVE_LEVEL_AUTO_CODES.includes(code)) continue;
    const label = getAutoMetadataPlainLabel(code);
    // COPY-001 dedup — if the cluster header already shows this same
    // plain-language label, suppress the move chip.
    if (label && label === clusterLifecycleLabel) continue;
    chips.push({
      code,
      label,
      accessibilityHint: `Move-level: ${label}.`,
    });
  }
  return chips;
}

// ── Helpers — primary action selection ────────────────────────

interface PrimaryDecision {
  action: TimelineNodeActionDockActionCode;
  rationale: string;
}

/**
 * Manual-tag primary override. Returns null when the selected target
 * carries no recognised manual tag.
 *
 * Per design §"Composition rule": manual tag on selected target overrides
 * lifecycle default.
 */
function pickManualTagOverride(
  moveLinkage: MoveLinkageRecord | null,
  clusterMeta: ClusterMetadataSummary | null,
  isCluster: boolean,
): PrimaryDecision | null {
  // Node target: read the move's own manual tags.
  if (!isCluster && moveLinkage) {
    for (const entry of moveLinkage.userAppliedTags) {
      const promo = MANUAL_TAG_ACTION_PROMOTION[entry.code];
      if (promo) return { action: promo.action, rationale: promo.rationale };
    }
  }
  // Cluster target: read the cluster aggregate.
  if (isCluster && clusterMeta) {
    for (const code of clusterMeta.manualTagCodes) {
      const promo = MANUAL_TAG_ACTION_PROMOTION[code];
      if (promo) return { action: promo.action, rationale: promo.rationale };
    }
  }
  return null;
}

/**
 * Evidence-status override (node target only). Returns null when no
 * contract is available.
 */
function pickEvidenceOverride(
  evidence: TimelineEvidenceContract | null,
): PrimaryDecision | null {
  if (!evidence) return null;
  const status = evidence.receiptChip?.status;
  if (!status) return null;
  const rec = SOURCE_CHAIN_ACTION_TABLE[status];
  if (!rec) return null;
  return { action: rec.primary, rationale: rec.rationale };
}

/**
 * Order of resolution (per design §"Public functions"):
 *   1. Validate target — detached / collapsed_stub / archived etc.
 *   2. Lifecycle-default primary.
 *   3. Manual-tag override on selected target.
 *   4. Evidence-status refinement.
 *   5. Auto-metadata refinement (only re-orders secondaries — never
 *      overrides primary; exception: `point_exhausted` mirrors lifecycle
 *      `exhausted`).
 *   6. Compose action list (primary first, secondaries in roadmap §8
 *      order minus primary).
 */
function pickPrimaryAction(
  target: TimelineNodeActionDockTarget,
  resolved: ResolvedTarget,
  actor: TimelineNodeActionDockActor,
): PrimaryDecision {
  // Collapsed-stub: always expand_branch.
  if (target.kind === 'collapsed_stub') {
    return { action: 'expand_branch', rationale: 'target:collapsed_stub' };
  }

  // Detached node: open_cards_detail.
  if (resolved.isDetached) {
    return { action: 'open_cards_detail', rationale: 'target:detached_node' };
  }

  const isCluster = target.kind === 'cluster';

  // Lifecycle default.
  const lifecycleState = resolved.clusterSummary?.state ?? 'open';
  const lifecycleEntry = LIFECYCLE_PRIMARY_ACTION_TABLE[lifecycleState];
  let decision: PrimaryDecision = {
    action: lifecycleEntry.primary,
    rationale: lifecycleEntry.rationale,
  };

  // Manual-tag override beats lifecycle default.
  const manualOverride = pickManualTagOverride(
    resolved.moveLinkage,
    resolved.clusterMetadata,
    isCluster,
  );
  if (manualOverride) decision = manualOverride;

  // Evidence-status refinement on node targets only.
  if (!isCluster && resolved.evidenceContract) {
    const evidenceOverride = pickEvidenceOverride(resolved.evidenceContract);
    if (evidenceOverride) decision = evidenceOverride;
  }

  // Observer-specific guidance: observer participant actions surface
  // `open_cards_detail` as the primary if the lifecycle would have
  // recommended a participant-only action and the actor is observer.
  if (actor === 'observer' && decision.action !== 'ask_source'
      && decision.action !== 'flag' && decision.action !== 'open_cards_detail') {
    // Observer's primary path is `open_cards_detail` (always enabled);
    // however we keep `ask_source` when the lifecycle / evidence promoted
    // it (Stage 6.4 honours observer ask_source).
    decision = { action: 'open_cards_detail', rationale: 'actor:observer' };
  }

  // Self (own bubble): if the lifecycle suggested an other-participant
  // action that doesn't apply to own-bubble (e.g. `challenge`), fall back
  // to `open_cards_detail`. Own-bubble allowed actions stay as-is.
  if (actor === 'self') {
    if (decision.action !== 'narrow' && decision.action !== 'concede'
        && decision.action !== 'synthesize'
        && decision.action !== 'open_cards_detail') {
      decision = { action: 'open_cards_detail', rationale: 'actor:self' };
    }
  }

  return decision;
}

// ── Helpers — action list composition ─────────────────────────

/**
 * Compute disabled state for an action × target × actor combination.
 * Layered on top of the actor matrix gate.
 */
function gateActionForTarget(
  action: TimelineNodeActionDockActionCode,
  target: TimelineNodeActionDockTarget,
  resolved: ResolvedTarget,
): ActorRule {
  // Collapsed-stub: every action except expand_branch + open_cards_detail
  // is disabled with `collapsed_stub_must_expand`.
  if (target.kind === 'collapsed_stub') {
    if (action === 'expand_branch') return { enabled: true };
    if (action === 'open_cards_detail') return { enabled: true };
    return { enabled: false, reason: 'collapsed_stub_must_expand' };
  }

  // Detached node: every action except open_cards_detail is disabled.
  if (resolved.isDetached) {
    if (action === 'open_cards_detail') return { enabled: true };
    return { enabled: false, reason: 'detached_node' };
  }

  // Archived / resolved cluster: every action except open_cards_detail
  // and reply is disabled with `archived_resolved` reason. reply stays
  // enabled — the dock RECOMMENDS, never BLOCKS.
  const lifecycleState = resolved.clusterSummary?.state ?? null;
  if (lifecycleState === 'archived_or_resolved') {
    if (action === 'open_cards_detail') return { enabled: true };
    if (action === 'reply') return { enabled: true };
    return { enabled: false, reason: 'archived_resolved' };
  }

  // Cluster target: node-scoped actions are disabled with
  // `node_action_on_cluster`.
  if (target.kind === 'cluster') {
    if (action === 'ask_source' || action === 'ask_quote') {
      return { enabled: false, reason: 'node_action_on_cluster' };
    }
  }

  // Node target: cluster-scoped actions disabled with `cluster_action_on_node`.
  if (target.kind === 'node') {
    if (action === 'synthesize') {
      return { enabled: false, reason: 'cluster_action_on_node' };
    }
    // Evidence already attached → ask_source disabled on this move.
    if (action === 'ask_source' && resolved.moveLinkage) {
      for (const e of resolved.moveLinkage.autoDerivedMetadata) {
        if (e.code === 'source_attached' || e.code === 'has_evidence') {
          return { enabled: false, reason: 'evidence_already_attached' };
        }
      }
    }
    if (action === 'ask_quote' && resolved.moveLinkage) {
      for (const e of resolved.moveLinkage.autoDerivedMetadata) {
        if (e.code === 'quote_attached') {
          return { enabled: false, reason: 'quote_already_attached' };
        }
      }
    }
  }

  // expand_branch is only meaningful on collapsed_stub (handled above).
  if (action === 'expand_branch') {
    return { enabled: false, reason: 'collapsed_stub_must_expand' };
  }

  return { enabled: true };
}

function combineGates(actor: ActorRule, target: ActorRule): ActorRule {
  // If either gate disables, prefer the more specific reason (target).
  if (!actor.enabled && !target.enabled) {
    return { enabled: false, reason: target.reason ?? actor.reason };
  }
  if (!actor.enabled) return actor;
  if (!target.enabled) return target;
  return { enabled: true };
}

function buildActionRecord(
  action: TimelineNodeActionDockActionCode,
  isPrimary: boolean,
  gate: ActorRule,
  rationale: string,
): TimelineNodeActionDockAction {
  const label = ACTION_LABELS[action];
  const a11y = ACTION_A11Y_LABELS[action];
  const isDisabled = !gate.enabled;
  const helperCopy = isDisabled && gate.reason ? DISABLED_HELPER_COPY[gate.reason] : undefined;
  const accessibilityLabel = isPrimary
    ? `${label} — primary suggested action. ${a11y}.`
    : isDisabled && helperCopy
      ? `${label} (unavailable). ${a11y}.`
      : `${label}. ${a11y}.`;
  return {
    action,
    label,
    accessibilityLabel,
    helperCopy,
    isPrimary,
    isDisabled,
    disabledReason: gate.reason,
    rationaleCode: rationale,
  };
}

/**
 * Order secondaries per `DEFAULT_SECONDARY_ORDER` with `point_exhausted` /
 * `synthesis_candidate` / `branch_suggested` / `repeated_axis_pressure`
 * promotions on cluster metadata. Auto metadata never overrides primary;
 * it only re-orders secondaries.
 */
function reorderSecondaries(
  primary: TimelineNodeActionDockActionCode,
  clusterMeta: ClusterMetadataSummary | null,
): TimelineNodeActionDockActionCode[] {
  const base = DEFAULT_SECONDARY_ORDER.filter((a) => a !== primary);
  if (!clusterMeta) return base.slice();
  const codes = new Set<AutoMetadataCode>(clusterMeta.autoMetadataCodes);
  const promotions: TimelineNodeActionDockActionCode[] = [];
  if (codes.has('synthesis_candidate')) promotions.push('synthesize');
  if (codes.has('point_stalled')) promotions.push('synthesize');
  if (codes.has('repeated_axis_pressure')) {
    promotions.push('narrow');
    promotions.push('branch');
  }
  if (codes.has('branch_suggested')) promotions.push('branch');
  if (codes.has('has_rebuttal')) promotions.push('challenge');
  // Dedupe + remove primary.
  const dedupedPromotions: TimelineNodeActionDockActionCode[] = [];
  const seen = new Set<TimelineNodeActionDockActionCode>();
  for (const p of promotions) {
    if (p === primary) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    dedupedPromotions.push(p);
  }
  // Move promoted items to the front of the base list (preserving the
  // rest of the order). Each promotion that is already in `base` is moved
  // forward; if it's not in `base` (shouldn't happen), skip.
  const remaining = base.filter((a) => !dedupedPromotions.includes(a));
  return [...dedupedPromotions.filter((p) => base.includes(p)), ...remaining];
}

// ── Public functions ──────────────────────────────────────────

/**
 * Build the full dock model for a selected target.
 *
 * Pure. Deterministic. O(cluster members) on a tight code path.
 */
export function buildTimelineNodeActionDockModel(
  input: TimelineNodeActionDockInput,
): TimelineNodeActionDockModel {
  const resolved = resolveTarget(
    input.target,
    input.timelineMap,
    input.lifecycleMap,
    input.metadataLedger,
    input.evidenceContractFor,
  );

  const primary = pickPrimaryAction(input.target, resolved, input.actor);

  // Compose action list: primary first, secondaries in roadmap §8 order
  // minus primary.
  const secondaries = reorderSecondaries(primary.action, resolved.clusterMetadata);
  // The primary's actor-rule rationale is overridden by the upstream
  // decision rationale (lifecycle / tag / evidence / target / actor).
  const ordered: TimelineNodeActionDockActionCode[] = [primary.action, ...secondaries];

  // For collapsed_stub: keep only expand_branch + open_cards_detail in
  // the action list; the rest are disabled regardless.
  // For detached node: keep only open_cards_detail enabled.

  const actions: TimelineNodeActionDockAction[] = ordered.map((code, idx) => {
    const actorGate = actorRule(input.actor, code);
    const targetGate = gateActionForTarget(code, input.target, resolved);
    const gate = combineGates(actorGate, targetGate);
    const isPrimary = idx === 0;
    const rationale = isPrimary
      ? primary.rationale
      : `secondary:${code}`;
    // If the primary itself was gated off, surface its disabled state but
    // keep it at slot 0. The component picks the first enabled action as
    // the visually prominent button OR falls back to rendering the
    // disabled primary with helper copy.
    return buildActionRecord(code, isPrimary, gate, rationale);
  });

  const clusterHeader = buildClusterHeader(
    resolved.clusterSummary,
    resolved.clusterMetadata,
    resolved.evidenceContract,
  );

  const moveChips = buildMoveChips(
    resolved.selectedNode,
    resolved.moveLinkage,
    clusterHeader.lifecycleLabel,
  );

  // Dock root accessibility label.
  const targetDesc = describeTargetForA11y(input.target, resolved);
  const accessibilityLabel = `Actions for ${targetDesc}, cluster status: ${clusterHeader.lifecycleLabel}.`;

  return {
    target: input.target,
    actor: input.actor,
    clusterId: resolved.clusterId,
    clusterHeader,
    moveChips,
    primarySuggestion: {
      action: primary.action,
      rationaleCode: primary.rationale,
    },
    actions,
    accessibilityLabel,
  };
}

function describeTargetForA11y(
  target: TimelineNodeActionDockTarget,
  resolved: ResolvedTarget,
): string {
  if (target.kind === 'collapsed_stub') return 'collapsed branch';
  if (target.kind === 'cluster') return 'this cluster';
  if (resolved.selectedNode) {
    const ord = resolved.selectedNode.ordinal;
    return `message ${ord}`;
  }
  return 'this point';
}

/**
 * Compute the primary suggestion only (no secondaries). Lightweight path
 * for GAL-002 / gallery surfaces that want the suggestion without paying
 * the full action-list cost.
 */
export function getPrimaryTimelineNodeAction(
  input: TimelineNodeActionDockInput,
): TimelineNodeActionDockPrimarySuggestion {
  const resolved = resolveTarget(
    input.target,
    input.timelineMap,
    input.lifecycleMap,
    input.metadataLedger,
    input.evidenceContractFor,
  );
  const primary = pickPrimaryAction(input.target, resolved, input.actor);
  return {
    action: primary.action,
    rationaleCode: primary.rationale,
  };
}

/**
 * Map an action code + target to a composer preset (MoveDraftPatch).
 *
 * For post-producing actions (`challenge` / `ask_source` / `ask_quote` /
 * `clarify` / `add_evidence` / `concede` / `narrow` / `confirm` /
 * `synthesize`) this delegates to EV-002's `quickActionToPreset`.
 *
 * Returns `null` for non-post actions: `reply` (composer opens with no
 * forced type), `branch` (branch flow opens its own UI), `mark_moved_on`,
 * `mark_ignored`, `flag` (existing moderation flow), `open_cards_detail`
 * (surface toggle), `expand_branch` (BR-001 toggle).
 *
 * NOTE: SC-004 does not re-author preset bodies. The bodies live in
 * `quickActionPresets.ts` and are exported as
 * `NARROW_PRESET_BODY` / `CONFIRM_PRESET_BODY` / `SYNTHESIZE_PRESET_BODY`.
 */
export function actionDockToComposerPreset(
  action: TimelineNodeActionDockActionCode,
  target: TimelineNodeActionDockTarget,
  parentType: ArgumentType | null,
): MoveDraftPatch | null {
  // The target discriminator is reserved for future SC-004 extensions;
  // v1 routes purely on `action`. Touch it to silence unused-parameter
  // warnings.
  void target;

  const map: Partial<Record<TimelineNodeActionDockActionCode, QuickActionLabel>> = {
    challenge: 'challenge',
    ask_source: 'source',
    ask_quote: 'quote',
    clarify: 'clarify',
    add_evidence: 'evidence',
    concede: 'concede',
    narrow: 'narrow',
    confirm: 'confirm',
    synthesize: 'synthesize',
  };
  const label = map[action];
  if (!label) return null;
  return quickActionToPreset(label, parentType);
}

// ── Ban-list — forbidden tokens ───────────────────────────────

/**
 * Forbidden tokens scanned by ban-list tests. NOT a content filter.
 *
 * The list pulls together verdict / amplification / person-attribution
 * tokens that must never appear in any plain label, helper copy,
 * accessibility label, preset body, or rationale code.
 */
export function _forbiddenDockTokens(): string[] {
  return [
    // Verdict tokens.
    'winner', 'loser', 'correct', 'incorrect', 'true', 'false',
    'liar', 'dishonest', 'bad faith', 'manipulative',
    'extremist', 'propagandist', 'troll', 'astroturfer',
    'verdict', 'proof', 'proven', 'disproven', 'validated',
    'lost', 'defeated', 'won', 'right', 'wrong',
    // Amplification tokens.
    'likes', 'retweets', 'shares', 'followers',
    'engagement', 'amplification', 'trending', 'virality', 'viral',
    // Block / prevent tokens (the dock RECOMMENDS, never BLOCKS).
    'forbid', 'disallow',
  ];
}

// ── _debug namespace — internal table access for tests ────────

/**
 * Internal table access for tests. NOT part of the public API.
 *
 * The leading underscore signals "test-only"; production code should
 * never read from this namespace.
 */
export const _debug = Object.freeze({
  LIFECYCLE_PRIMARY_ACTION_TABLE,
  MANUAL_TAG_ACTION_PROMOTION,
  SOURCE_CHAIN_ACTION_TABLE,
  DEFAULT_SECONDARY_ORDER,
  ACTION_LABELS,
  ACTION_A11Y_LABELS,
  DISABLED_HELPER_COPY,
  CLUSTER_LEVEL_AUTO_CODES,
  MOVE_LEVEL_AUTO_CODES,
  actorRule,
});

// Touch unused types so the linter knows we intentionally exposed them
// for downstream consumers (ST-002, GAME-001, RULE-003, GAL-002, AN-003).
void (null as unknown as ManualTagEntry);
void (null as unknown as AutoMetadataEntry);
