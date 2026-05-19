/**
 * META-001 — Move tag / flag / metadata event ledger (pure TypeScript).
 *
 * Owns:
 *   - The locked 10-code `ManualTagCode` vocabulary (participant gameplay
 *     annotations).
 *   - The locked 16-code `AutoMetadataCode` vocabulary (deterministic
 *     observations about move structure).
 *   - The `MANUAL_TAG_ELIGIBILITY` matrix — who can apply which tag in
 *     which actor role / own-bubble combination.
 *   - The per-move `MoveLinkageRecord` shape.
 *   - The per-cluster `ClusterMetadataSummary` shape.
 *   - The per-tree `MoveMetadataLedger` shape + `metadataEvents` log.
 *   - The `LifecycleCausationEntry` shape produced by snapshot-diff.
 *   - The tree-level entry point `buildMoveMetadataLedger`.
 *   - Manual-tag operations: `applyManualTag` / `removeManualTag`.
 *   - Plain-language helpers `getManualTagPlainLabel` /
 *     `getAutoMetadataPlainLabel`.
 *   - `_forbiddenMetadataTokens` (consumed by ban-list tests).
 *
 * Doctrine anchor — read this before changing anything in this file:
 *
 *   1. **A manual tag is a participant annotation, never a verdict.** No tag
 *      may be inferred from truth / winner / loser / correctness, and no tag
 *      may be inferred from heat / popularity / engagement / virality /
 *      strength bands.
 *   2. **An auto-derived metadata code is an observation about move
 *      structure, never a truth claim.** `has_evidence` means an artifact is
 *      attached, not that the evidence is sufficient or correct.
 *   3. **A moderation flag is NOT a gameplay tag.** Manual tags live in this
 *      model; `public.flags` rows live in the existing moderation table.
 *      They never cross — by type, by name, by storage, or by UI surface.
 *      `userAppliedTags` and `semanticFlags` are structurally distinct
 *      fields on `MoveLinkageRecord`.
 *   4. **Heat / popularity / engagement / virality / strength bands NEVER
 *      feed any tag or metadata signal.** Wrong-but-loud and right-but-quiet
 *      produce identical ledgers when the move structure matches.
 *   5. **META-001 reads existing seams; it never re-derives.** It consumes
 *      `PointLifecycleSnapshot` / `PointLifecycleClusterSummary` from
 *      LIFE-001, `EvidenceArtifact` from EV-001, qualifier codes already
 *      populated on `node.droppedTags[].code`, and BR-001's branch identity.
 *      It does NOT call `deriveMessageCategory`, does NOT re-classify axis,
 *      and does NOT call `applyAntiAmplification`.
 *   6. **Auto-derived metadata is non-blocking.** No metadata signal
 *      prevents posting, auto-archives, auto-hides, or suppresses a reply.
 *      The ledger is advisory information for SC-004 / ST-002 / GAME-001 to
 *      surface.
 *
 * Pure TS. No React. No Supabase. No network. No async. No mutation of any
 * input. No new dependency. No AI inference.
 */

import type {
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
} from '../arguments/argumentGameSurfaceModel';
import type { EvidenceArtifact } from '../evidence/evidenceModel';
import type {
  PointLifecycleAxis,
  PointLifecycleClusterSummary,
  PointLifecycleMap,
  PointLifecycleSnapshot,
  PointLifecycleState,
} from '../lifecycle';
import { PLAIN_LANGUAGE_COPY } from '../arguments/gameCopy';
import {
  computeLifecycleCausationForMove,
} from './metadataEvents';
import {
  deriveAutoMetadataForMessage,
} from './autoMetadataModel';
import {
  isApplyAllowed,
  makeManualTagDedupeKey,
  MANUAL_TAG_ELIGIBILITY_TABLE,
} from './manualTagModel';

// ── Public types — manual tag vocabulary ──────────────────────

/**
 * META-001 — Manual user-applied gameplay tags. A participant marks a move
 * with a manual tag to annotate gameplay status. Each value is a gameplay
 * signal, NEVER a verdict. The 10 values match roadmap §7 verbatim.
 *
 * Doctrine: no tag may be inferred from truth / winner / loser / correctness.
 * No tag may be inferred from heat / popularity / engagement / virality /
 * strength bands. A manual tag is a participant annotation, not a moderation
 * flag — moderation flags live in `public.flags` and never appear in this
 * vocabulary.
 */
export type ManualTagCode =
  | 'needs_source'
  | 'needs_quote'
  | 'definition_issue'
  | 'scope_issue'
  | 'causal_mechanism'
  | 'evidence_debt'
  | 'concession_offered'
  | 'narrowed_claim'
  | 'tangent'
  | 'ready_for_synthesis';

/** Frozen array of every manual tag. Tests + RULE-003 iterate this. */
export const ALL_MANUAL_TAG_CODES: ReadonlyArray<ManualTagCode> = Object.freeze([
  'needs_source',
  'needs_quote',
  'definition_issue',
  'scope_issue',
  'causal_mechanism',
  'evidence_debt',
  'concession_offered',
  'narrowed_claim',
  'tangent',
  'ready_for_synthesis',
]);

// ── Public types — auto-derived metadata vocabulary ───────────

/**
 * META-001 — Auto-derived gameplay metadata. Observed deterministically from
 * the move stream + existing semantic-flag, qualifier, evidence-contract,
 * lifecycle, and branch-topology surfaces. Each value is an observation,
 * NEVER a truth claim. The 16 values match roadmap §5 verbatim.
 *
 * Doctrine: no code may be inferred from heat / popularity / engagement /
 * virality / strength bands / AI annotation. Auto metadata is non-blocking
 * advisory information.
 */
export type AutoMetadataCode =
  | 'has_reply'
  | 'has_rebuttal'
  | 'has_counter_rebuttal'
  | 'has_evidence'
  | 'source_requested'
  | 'quote_requested'
  | 'source_attached'
  | 'quote_attached'
  | 'participant_skipped_node'
  | 'no_response_after_n_turns'
  | 'repeated_axis_pressure'
  | 'branch_suggested'
  | 'branch_created'
  | 'point_stalled'
  | 'point_exhausted'
  | 'synthesis_candidate';

/** Frozen array of every auto metadata code. Tests + RULE-003 iterate this. */
export const ALL_AUTO_METADATA_CODES: ReadonlyArray<AutoMetadataCode> = Object.freeze([
  'has_reply',
  'has_rebuttal',
  'has_counter_rebuttal',
  'has_evidence',
  'source_requested',
  'quote_requested',
  'source_attached',
  'quote_attached',
  'participant_skipped_node',
  'no_response_after_n_turns',
  'repeated_axis_pressure',
  'branch_suggested',
  'branch_created',
  'point_stalled',
  'point_exhausted',
  'synthesis_candidate',
]);

// ── Eligibility matrix ────────────────────────────────────────

export interface ManualTagEligibilityRecord {
  /** True when the applier is the author of the message. */
  allowOnOwnBubble: boolean;
  /** True when the applier is a participant on a non-own bubble. */
  allowOnOtherBubble: boolean;
  /** True when the applier is an observer. v1: always false. */
  allowObserver: boolean;
  /** True when the applier is an admin. */
  allowAdmin: boolean;
}

/**
 * Eligibility matrix for manual-tag application. Per design §"Manual tag
 * vocabulary" — observers may NEVER apply tags in v1; own-bubble may apply
 * only `concession_offered`, `narrowed_claim`, `ready_for_synthesis`;
 * admins may apply all 10.
 *
 * Exported as a frozen constant so SC-004 + tests can read it directly.
 */
export const MANUAL_TAG_ELIGIBILITY: Readonly<Record<ManualTagCode, ManualTagEligibilityRecord>> =
  MANUAL_TAG_ELIGIBILITY_TABLE;

// ── Public types — applier eligibility context ────────────────

export type ManualTagActorRole =
  | 'participant_affirmative'
  | 'participant_negative'
  | 'observer'
  | 'admin';

export interface EligibilityContext {
  /** The viewer applying the tag. */
  applierUserId: string;
  /** The viewer's role on this room. */
  applierActorRole: ManualTagActorRole;
  /** True when `messageId` is the applier's own bubble (author === applier). */
  isOwnBubble: boolean;
}

// ── Public types — manual tag entry ───────────────────────────

/**
 * One manual tag application. The applier is identified by
 * `appliedByUserId` for audit (in the in-memory v1, this is the current
 * viewer id passed by the caller; v2 persistence would canonicalize via a
 * DB column).
 */
export interface ManualTagEntry {
  code: ManualTagCode;
  appliedByUserId: string;
  appliedByActorRole: ManualTagActorRole;
  appliedAt: string;
  /** Stable dedupe key. Equal to `${code}:${appliedByUserId}`. Multiple
   *  participants applying the same tag produce multiple entries; the same
   *  participant applying the same tag twice is idempotent. */
  dedupeKey: string;
  /** Optional free-text note from the applier (≤ 140 chars). v1 does NOT
   *  render this in any normal-user surface — reserved for v2 audit UI. */
  note?: string | null;
}

// ── Public types — auto metadata entry ────────────────────────

/**
 * One auto-derived metadata observation. Idempotent: re-running the deriver
 * with the same inputs produces the same set (no duplicate `code` entries).
 */
export interface AutoMetadataEntry {
  code: AutoMetadataCode;
  /** ISO-8601 timestamp the deriver computed. Stable across re-renders when
   *  the inputs are stable (driven by `inputHash`). */
  detectedAt: string;
  /** Names of the upstream signals that triggered the observation. Internal
   *  debug field — NEVER rendered in UI. Each entry is one of the existing
   *  field paths the deriver reads. Bounded to ≤ 4 entries per
   *  observation. */
  inputSignals: ReadonlyArray<string>;
}

// ── Public types — lifecycle causation entry ──────────────────

/**
 * One lifecycle-causation entry. Indicates this move caused a transition
 * at the per-message or per-cluster level by comparing pre-move and
 * post-move lifecycle maps (snapshot-diff). META-001 does NOT mutate
 * LIFE-001's output; the comparison is read-only.
 */
export interface LifecycleCausationEntry {
  /** What level changed. */
  level: 'message_contribution' | 'cluster_state';
  /** The cluster id at which the change occurred. */
  clusterId: string;
  /** Optional message id when level === 'message_contribution'. */
  messageId?: string | null;
  /** The state before this move. */
  fromState: PointLifecycleState;
  /** The state after this move. */
  toState: PointLifecycleState;
  /** Stable hash used by tests / dedupers. */
  causationKey: string;
}

// ── Public types — per-move linkage record ────────────────────

/**
 * META-001 — Per-move linkage trace. One record per non-deleted message in
 * the tree. Maps a move back to the point it acts on, the manual tags a
 * participant has applied, and the auto-derived metadata observed about
 * the move's structure.
 *
 * Pure data. JSON-serializable.
 *
 * Doctrine guardrails:
 *   - `userAppliedTags` is empty until a participant explicitly applies a
 *     tag (manual tags are participant-applied; no auto-population).
 *   - `autoDerivedMetadata` is computed from existing seams — never
 *     re-derived.
 *   - `lifecycleEventsCausedByMove` is a snapshot-diff result; it does NOT
 *     mutate LIFE-001.
 *   - `disagreementAxis` mirrors the existing field on the lifecycle
 *     snapshot; META-001 does NOT re-classify axis.
 */
export interface MoveLinkageRecord {
  /** Same as the message's `id` field on `public.arguments`. */
  messageId: string;
  /** Parent message id (null for root or detached). */
  parentMessageId: string | null;
  /** Root of the cluster this move belongs to. Equal to
   *  `node.branchRootMessageId` from the surface model. */
  rootPointId: string;
  /** Cluster id (= `node.branchRootMessageId`). Same shape as LIFE-001's
   *  cluster id. Synonym of `rootPointId` for v1; both kept for clarity. */
  pointClusterId: string;
  /** Branch id (= `node.branchId` from BR-001's surface model). */
  branchId: string;
  /** Optional target excerpt the move quoted from its parent. v1: null
   *  (the surface model does not yet expose this field). */
  targetExcerpt: string | null;
  /** The disagreement axis derived upstream (mirrors LIFE-001's
   *  `PointLifecycleSnapshot.axis`). Never re-derived by META-001. */
  disagreementAxis: PointLifecycleAxis | null;
  /** Existing semantic-flag codes from the upstream qualifier deriver.
   *  Reads only `node.droppedTags[].code`. Distinct from
   *  `userAppliedTags` — moderation flag codes (e.g. `'flag:civility'`)
   *  surface here but NEVER cross into the manual-tag layer. */
  semanticFlags: ReadonlyArray<string>;
  /** Manual tags a participant applied. Empty by default. */
  userAppliedTags: ReadonlyArray<ManualTagEntry>;
  /** Auto-derived metadata observed about this move's structure. */
  autoDerivedMetadata: ReadonlyArray<AutoMetadataEntry>;
  /** Lifecycle transitions this move caused at the per-message or
   *  per-cluster level (snapshot-diff). Empty when the move did not
   *  change any state. */
  lifecycleEventsCausedByMove: ReadonlyArray<LifecycleCausationEntry>;
}

// ── Public types — per-cluster summary ────────────────────────

/**
 * Cluster-level aggregate. Convenience for SC-004 / ST-002 — never
 * replaces LIFE-001's `PointLifecycleClusterSummary`; this is layered on
 * top.
 */
export interface ClusterMetadataSummary {
  clusterId: string;
  /** All distinct manual tag codes present on any member. */
  manualTagCodes: ReadonlyArray<ManualTagCode>;
  /** All distinct auto-derived codes present on any member. */
  autoMetadataCodes: ReadonlyArray<AutoMetadataCode>;
  /** The cluster's lifecycle state, copied from LIFE-001 for convenience.
   *  This is a READ — META-001 does NOT compute lifecycle. */
  lifecycleState: PointLifecycleState;
  /** Latest manual-tag application timestamp across members (ISO-8601).
   *  `null` when no manual tags have been applied. */
  lastManualTagAt: string | null;
  /** Count of distinct participants who have ever applied any tag in this
   *  cluster (derived from the `appliedByUserId` field). */
  taggingParticipantCount: number;
}

// ── Public types — metadata event ─────────────────────────────

/**
 * One metadata event. Fires when a code is added, removed, or transitions
 * state on a move. The event log is the basis for SC-004's "what changed"
 * affordance + ST-002's Cards-detail history + the HIST-001 follow-up.
 */
export interface MetadataEvent {
  /** Stable id derived from kind + code family + code + messageId + at. */
  eventId: string;
  /** What kind of event. */
  kind: 'add' | 'remove' | 'transition';
  /** Which code family. */
  codeFamily: 'manual_tag' | 'auto_metadata' | 'lifecycle_causation';
  /** The code that changed (manual tag code, auto metadata code, or
   *  `${fromState}->${toState}` for lifecycle_causation). */
  code: string;
  /** The message id the event is anchored to. */
  messageId: string;
  /** The cluster id (`branchRootMessageId`) the event applies to. */
  clusterId: string;
  /** ISO-8601 timestamp the event was observed. */
  at: string;
  /** Optional cause — internal debug field for AN-003 only; never rendered
   *  in normal-user surfaces. */
  cause?: string | null;
}

// ── Public types — per-tree ledger ────────────────────────────

/**
 * META-001 — Per-tree metadata ledger. Built once per render alongside
 * the timeline map + lifecycle map. Memoization is the caller's
 * responsibility (use `inputHash`).
 */
export interface MoveMetadataLedger {
  /** Frozen map keyed by messageId. One record per non-deleted message. */
  byMessage: ReadonlyMap<string, MoveLinkageRecord>;
  /** Frozen map keyed by clusterId. Aggregates manual + auto metadata
   *  across all members of the cluster. */
  byCluster: ReadonlyMap<string, ClusterMetadataSummary>;
  /** Chronological log of every metadata event emitted by the most recent
   *  ledger rebuild. */
  metadataEvents: ReadonlyArray<MetadataEvent>;
  /** Frozen list of message ids in chronological order. */
  messageOrder: ReadonlyArray<string>;
  /** Stable hash of the inputs. Memoization key for the room shell. */
  inputHash: string;
}

// ── Public types — auto-metadata config ───────────────────────

/**
 * Tuning constants for auto-metadata derivation. Conservative defaults;
 * GAME-001 may tune after AN-003 lands.
 */
export interface AutoMetadataConfig {
  /** Default 3. Used by `no_response_after_n_turns`. */
  noResponseTurnThreshold: number;
  /** Default 2. Used by `repeated_axis_pressure`. */
  repeatedAxisPressureThreshold: number;
  /** Default 3. Used by `participant_skipped_node`. */
  participantSkippedTurnThreshold: number;
}

export const DEFAULT_AUTO_METADATA_CONFIG: Readonly<AutoMetadataConfig> = Object.freeze({
  noResponseTurnThreshold: 3,
  repeatedAxisPressureThreshold: 2,
  participantSkippedTurnThreshold: 3,
});

// ── Plain-language helpers ────────────────────────────────────

/**
 * Direct typed lookup for the 10 manual tag codes. Returns the
 * plain-language label from `PLAIN_LANGUAGE_COPY` — the single source of
 * plain-language truth in the app.
 */
export function getManualTagPlainLabel(code: ManualTagCode): string {
  const copy = PLAIN_LANGUAGE_COPY as unknown as Record<string, string>;
  const value = copy[code];
  return typeof value === 'string' ? value : code;
}

/**
 * Direct typed lookup for the 16 auto metadata codes. Returns the
 * plain-language label from `PLAIN_LANGUAGE_COPY`.
 */
export function getAutoMetadataPlainLabel(code: AutoMetadataCode): string {
  const copy = PLAIN_LANGUAGE_COPY as unknown as Record<string, string>;
  const value = copy[code];
  return typeof value === 'string' ? value : code;
}

/**
 * Forbidden tokens scanned by ban-list tests. NOT a content filter.
 *
 * The list pulls together verdict / amplification / person-attribution
 * tokens that must never appear in any plain label, any inputSignals
 * entry, any cause string, or anywhere else in the ledger output.
 */
export function _forbiddenMetadataTokens(): string[] {
  return [
    // Verdict tokens
    'winner', 'loser', 'correct', 'incorrect', 'true', 'false',
    'liar', 'dishonest', 'bad faith', 'manipulative',
    'extremist', 'propagandist', 'troll', 'bot', 'astroturfer',
    'verdict', 'proof', 'proven', 'disproven', 'lost', 'defeated', 'won',
    // Amplification tokens
    'likes', 'retweets', 'shares', 'views', 'followers', 'verified',
    'engagement', 'amplification', 'trending', 'virality', 'popular', 'viral',
    // Block / prevent tokens (auto metadata must never block)
    'block', 'prevent', 'reject', 'forbid', 'disallow', 'denied',
  ];
}

// ── Tree-level entry point ────────────────────────────────────

/**
 * Inputs to `buildMoveMetadataLedger`. All seams are read-only.
 */
export interface BuildMoveMetadataLedgerInput {
  /** Already-built timeline map (BR-001-aware). */
  timelineMap: ArgumentTimelineMapModel;
  /** Already-built lifecycle map (LIFE-001). */
  lifecycleMap: PointLifecycleMap;
  /** EV-001 artifacts per messageId. Empty map when no artifacts. */
  artifactsByMessageId: ReadonlyMap<string, ReadonlyArray<EvidenceArtifact>>;
  /** Manual tag entries the caller has accumulated in memory. Keyed by
   *  messageId → list of tag entries. */
  manualTagsByMessageId: ReadonlyMap<string, ReadonlyArray<ManualTagEntry>>;
  /** Optional prior ledger from the last render. Used to diff events. */
  previousLedger?: MoveMetadataLedger | null;
  /** Previous lifecycle map — used for snapshot-diff causation. When the
   *  caller does not have one yet (first render), pass `null`. */
  previousLifecycleMap?: PointLifecycleMap | null;
  /** Optional auto-metadata config. Threshold tuning for GAME-001. */
  autoMetadataConfig?: AutoMetadataConfig;
  /** Optional clock for derivation timestamps. Defaults to ISO `now`. */
  detectedAt?: string;
}

/**
 * Build the per-tree ledger in three passes:
 *   Pass 1 — per-message linkage records (reads surface model + lifecycle
 *            map + lifecycle causation snapshot-diff).
 *   Pass 2 — auto-derived metadata observations (reads EV-001 artifacts +
 *            lifecycle + cluster state).
 *   Pass 3 — per-cluster aggregation + metadata-event log composition.
 *
 * Pure. Deterministic. O(n) where n = messages.
 */
export function buildMoveMetadataLedger(
  input: BuildMoveMetadataLedgerInput,
): MoveMetadataLedger {
  const {
    timelineMap,
    lifecycleMap,
    artifactsByMessageId,
    manualTagsByMessageId,
    previousLedger,
    previousLifecycleMap,
  } = input;
  const config = input.autoMetadataConfig ?? DEFAULT_AUTO_METADATA_CONFIG;
  const detectedAt = input.detectedAt ?? new Date().toISOString();

  // Empty room — return empty ledger. The caller's memoization is keyed on
  // the input hash; an empty ledger reads as "no metadata".
  if (timelineMap.nodes.length === 0) {
    return {
      byMessage: new Map(),
      byCluster: new Map(),
      metadataEvents: Object.freeze([] as MetadataEvent[]),
      messageOrder: Object.freeze([] as string[]),
      inputHash: '',
    };
  }

  // Sort nodes chronologically (by ordinal). Matches LIFE-001's convention.
  const nodes = timelineMap.nodes.slice().sort((a, b) => a.ordinal - b.ordinal);
  const nodeById = new Map<string, ArgumentTimelineMapNode>();
  for (const n of nodes) nodeById.set(n.messageId, n);

  // Group nodes by cluster for descendant walks. Cluster id = branchRootMessageId.
  const clusterMembers = new Map<string, ArgumentTimelineMapNode[]>();
  for (const n of nodes) {
    const cid = n.branchRootMessageId;
    if (!clusterMembers.has(cid)) clusterMembers.set(cid, []);
    clusterMembers.get(cid)!.push(n);
  }

  // Pre-compute children + descendants per node (cluster-bounded).
  const childrenById = new Map<string, ArgumentTimelineMapNode[]>();
  for (const n of nodes) {
    if (n.parentId && nodeById.has(n.parentId)) {
      if (!childrenById.has(n.parentId)) childrenById.set(n.parentId, []);
      childrenById.get(n.parentId)!.push(n);
    }
  }

  // For each node, collect its descendants by walking children (DFS,
  // bounded by cluster size). Visited guard prevents accidental cycles.
  const descendantsById = new Map<string, ArgumentTimelineMapNode[]>();
  function descendantsOf(messageId: string): ArgumentTimelineMapNode[] {
    if (descendantsById.has(messageId)) return descendantsById.get(messageId)!;
    const out: ArgumentTimelineMapNode[] = [];
    const visited = new Set<string>();
    const stack: ArgumentTimelineMapNode[] = (childrenById.get(messageId) || []).slice();
    while (stack.length > 0) {
      const cur = stack.shift()!;
      if (visited.has(cur.messageId)) continue;
      visited.add(cur.messageId);
      out.push(cur);
      const kids = childrenById.get(cur.messageId) || [];
      for (const k of kids) stack.push(k);
    }
    descendantsById.set(messageId, out);
    return out;
  }

  // Pre-compute descendantContributions per node — a Map<messageId,
  // PointLifecycleState> over the descendants only. Used by auto-metadata
  // derivers.
  function descendantContributionsFor(messageId: string): ReadonlyMap<string, PointLifecycleState> {
    const out = new Map<string, PointLifecycleState>();
    const ds = descendantsOf(messageId);
    for (const d of ds) {
      const snap = lifecycleMap.byMessage.get(d.messageId);
      if (snap) out.set(d.messageId, snap.messageContribution);
    }
    return out;
  }

  // Pass 1 — per-message linkage records.
  const byMessage = new Map<string, MoveLinkageRecord>();
  const messageOrder: string[] = [];
  for (const n of nodes) {
    const snap: PointLifecycleSnapshot | null = lifecycleMap.byMessage.get(n.messageId) ?? null;
    const axis: PointLifecycleAxis | null = snap?.axis ?? null;
    const clusterId = n.branchRootMessageId;
    const clusterSummary: PointLifecycleClusterSummary | null =
      lifecycleMap.byCluster.get(clusterId) ?? null;

    const semanticFlags: string[] = [];
    const seenFlag = new Set<string>();
    for (const t of n.droppedTags) {
      const c = String(t.code || '').toLowerCase();
      if (!c) continue;
      if (seenFlag.has(c)) continue;
      seenFlag.add(c);
      semanticFlags.push(c);
    }

    // Manual tags: only carry over entries whose messageId exists in the
    // current tree. (Deleted-message tags drop silently here; the diff
    // logic emits a remove event downstream.)
    const rawTags = manualTagsByMessageId.get(n.messageId) || [];
    // Dedupe by dedupeKey defensively, preserving the first occurrence.
    const dedupedTags: ManualTagEntry[] = [];
    const seenKey = new Set<string>();
    for (const t of rawTags) {
      if (seenKey.has(t.dedupeKey)) continue;
      seenKey.add(t.dedupeKey);
      dedupedTags.push(t);
    }

    // Auto-derived metadata.
    const childNodes = childrenById.get(n.messageId) || [];
    const descendantNodes = descendantsOf(n.messageId);
    const artifacts = artifactsByMessageId.get(n.messageId) || [];
    const autoDerivedMetadata = clusterSummary
      ? deriveAutoMetadataForMessage({
          node: n,
          clusterSummary,
          messageSnapshot: snap,
          childNodes,
          descendantNodes,
          artifacts,
          detectedAt,
          autoMetadataConfig: config,
          descendantContributions: descendantContributionsFor(n.messageId),
          roomNodes: nodes,
        })
      : [];

    // Snapshot-diff causation.
    const lifecycleEventsCausedByMove = computeLifecycleCausationForMove({
      node: n,
      previousLifecycleMap: previousLifecycleMap ?? null,
      currentLifecycleMap: lifecycleMap,
    });

    const record: MoveLinkageRecord = {
      messageId: n.messageId,
      parentMessageId: n.parentId,
      rootPointId: clusterId,
      pointClusterId: clusterId,
      branchId: n.branchId,
      targetExcerpt: null,
      disagreementAxis: axis,
      semanticFlags: Object.freeze(semanticFlags),
      userAppliedTags: Object.freeze(dedupedTags),
      autoDerivedMetadata: Object.freeze(autoDerivedMetadata),
      lifecycleEventsCausedByMove: Object.freeze(lifecycleEventsCausedByMove),
    };
    byMessage.set(n.messageId, record);
    messageOrder.push(n.messageId);
  }

  // Pass 2 — per-cluster aggregation.
  const byCluster = new Map<string, ClusterMetadataSummary>();
  for (const [clusterId, members] of clusterMembers.entries()) {
    const manualSet = new Set<ManualTagCode>();
    const autoSet = new Set<AutoMetadataCode>();
    const participantSet = new Set<string>();
    let lastTagAt: string | null = null;
    for (const m of members) {
      const rec = byMessage.get(m.messageId);
      if (!rec) continue;
      for (const t of rec.userAppliedTags) {
        manualSet.add(t.code);
        participantSet.add(t.appliedByUserId);
        if (lastTagAt === null || t.appliedAt > lastTagAt) {
          lastTagAt = t.appliedAt;
        }
      }
      for (const a of rec.autoDerivedMetadata) {
        autoSet.add(a.code);
      }
    }
    const clusterSummary = lifecycleMap.byCluster.get(clusterId);
    const lifecycleState: PointLifecycleState = clusterSummary?.state ?? 'open';

    // Preserve declaration order of the codes to keep output deterministic.
    const manualCodes: ManualTagCode[] = [];
    for (const c of ALL_MANUAL_TAG_CODES) {
      if (manualSet.has(c)) manualCodes.push(c);
    }
    const autoCodes: AutoMetadataCode[] = [];
    for (const c of ALL_AUTO_METADATA_CODES) {
      if (autoSet.has(c)) autoCodes.push(c);
    }

    byCluster.set(clusterId, {
      clusterId,
      manualTagCodes: Object.freeze(manualCodes),
      autoMetadataCodes: Object.freeze(autoCodes),
      lifecycleState,
      lastManualTagAt: lastTagAt,
      taggingParticipantCount: participantSet.size,
    });
  }

  // Pass 3 — compose metadata events from the diff between previousLedger
  // and the new ledger we've just built.
  const metadataEvents = composeMetadataEvents({
    previousLedger: previousLedger ?? null,
    currentByMessage: byMessage,
    nodes,
    detectedAt,
  });

  const inputHash = computeInputHash({
    timelineMap,
    lifecycleMap,
    manualTagsByMessageId,
    artifactsByMessageId,
    config,
  });

  return {
    byMessage,
    byCluster,
    metadataEvents: Object.freeze(metadataEvents),
    messageOrder: Object.freeze(messageOrder),
    inputHash,
  };
}

// ── Metadata event composition (snapshot-diff of two ledgers) ─

function composeMetadataEvents(args: {
  previousLedger: MoveMetadataLedger | null;
  currentByMessage: ReadonlyMap<string, MoveLinkageRecord>;
  nodes: ReadonlyArray<ArgumentTimelineMapNode>;
  detectedAt: string;
}): MetadataEvent[] {
  const { previousLedger, currentByMessage, nodes, detectedAt } = args;
  const out: MetadataEvent[] = [];

  function mkEventId(
    kind: 'add' | 'remove' | 'transition',
    family: 'manual_tag' | 'auto_metadata' | 'lifecycle_causation',
    code: string,
    messageId: string,
    at: string,
  ): string {
    return `${kind}:${family}:${code}:${messageId}:${at}`;
  }

  function pushEvent(
    kind: 'add' | 'remove' | 'transition',
    family: 'manual_tag' | 'auto_metadata' | 'lifecycle_causation',
    code: string,
    messageId: string,
    clusterId: string,
    at: string,
    cause: string | null = null,
  ): void {
    out.push({
      eventId: mkEventId(kind, family, code, messageId, at),
      kind,
      codeFamily: family,
      code,
      messageId,
      clusterId,
      at,
      cause,
    });
  }

  for (const n of nodes) {
    const curr = currentByMessage.get(n.messageId);
    if (!curr) continue;
    const prev = previousLedger?.byMessage.get(n.messageId) ?? null;
    const clusterId = curr.pointClusterId;

    // Manual tag adds / removes — compare entry sets by dedupeKey.
    const prevTagKeys = new Set<string>();
    if (prev) {
      for (const t of prev.userAppliedTags) prevTagKeys.add(t.dedupeKey);
    }
    const currTagKeys = new Set<string>();
    for (const t of curr.userAppliedTags) currTagKeys.add(t.dedupeKey);
    for (const t of curr.userAppliedTags) {
      if (!prevTagKeys.has(t.dedupeKey)) {
        pushEvent('add', 'manual_tag', t.code, n.messageId, clusterId, t.appliedAt);
      }
    }
    if (prev) {
      for (const t of prev.userAppliedTags) {
        if (!currTagKeys.has(t.dedupeKey)) {
          pushEvent('remove', 'manual_tag', t.code, n.messageId, clusterId, detectedAt);
        }
      }
    }

    // Auto metadata flips on / off — compare code sets.
    const prevAutoCodes = new Set<string>();
    if (prev) {
      for (const a of prev.autoDerivedMetadata) prevAutoCodes.add(a.code);
    }
    const currAutoCodes = new Set<string>();
    for (const a of curr.autoDerivedMetadata) currAutoCodes.add(a.code);
    for (const a of curr.autoDerivedMetadata) {
      if (!prevAutoCodes.has(a.code)) {
        pushEvent('add', 'auto_metadata', a.code, n.messageId, clusterId, a.detectedAt);
      }
    }
    if (prev) {
      for (const a of prev.autoDerivedMetadata) {
        if (!currAutoCodes.has(a.code)) {
          pushEvent('remove', 'auto_metadata', a.code, n.messageId, clusterId, detectedAt);
        }
      }
    }

    // Lifecycle causation entries — every entry produced this render is a
    // "transition" event keyed on the causation key.
    const prevCausationKeys = new Set<string>();
    if (prev) {
      for (const lc of prev.lifecycleEventsCausedByMove) prevCausationKeys.add(lc.causationKey);
    }
    for (const lc of curr.lifecycleEventsCausedByMove) {
      if (!prevCausationKeys.has(lc.causationKey)) {
        pushEvent(
          'transition',
          'lifecycle_causation',
          `${lc.fromState}->${lc.toState}`,
          n.messageId,
          lc.clusterId,
          detectedAt,
        );
      }
    }
  }

  // Detect manual tags that were attached to messages now absent from the
  // tree (soft-delete or detached → cluster split). Emit one remove event
  // per orphaned tag with cause === 'message_deleted'.
  if (previousLedger) {
    for (const [messageId, prevRec] of previousLedger.byMessage.entries()) {
      if (currentByMessage.has(messageId)) continue;
      for (const t of prevRec.userAppliedTags) {
        pushEvent(
          'remove',
          'manual_tag',
          t.code,
          messageId,
          prevRec.pointClusterId,
          detectedAt,
          'message_deleted',
        );
      }
    }
  }

  return out;
}

// ── Manual tag operations ─────────────────────────────────────

export interface ApplyManualTagInput {
  /** The ledger we're updating. */
  ledger: MoveMetadataLedger;
  /** The message to tag. */
  messageId: string;
  /** The tag code. */
  code: ManualTagCode;
  /** The applier + eligibility context. */
  eligibility: EligibilityContext;
  /** ISO-8601 timestamp the caller assigns. */
  appliedAt: string;
  /** Optional free-text note (≤ 140 chars). */
  note?: string | null;
}

/**
 * Apply a manual tag to a move. Returns a NEW ledger (immutable update).
 * Returns the input ledger reference-equal when:
 *   - Eligibility fails (e.g., observer applying any tag, own-bubble
 *     applying a non-own-allowed tag).
 *   - The tag is already present for this applier (dedupe).
 *   - The messageId does not exist in the ledger.
 *
 * Eligibility-refused calls emit a debug-only `MetadataEvent` with
 * `cause: 'eligibility_refused'` (not surfaced to UI). The same call
 * pattern is used for `cause: 'unknown_message_id'`.
 *
 * Note on the return contract: when the call is refused, the function
 * returns the *original ledger reference*. The debug event is NOT
 * appended to that ledger's `metadataEvents` (that would mutate the
 * frozen ledger). Callers that want refusal events must observe the
 * eligibility through `isApplyAllowed` directly before calling.
 */
export function applyManualTag(input: ApplyManualTagInput): MoveMetadataLedger {
  const { ledger, messageId, code, eligibility, appliedAt, note } = input;

  // Eligibility refused → return previous ledger reference-equal.
  if (!isApplyAllowed(code, eligibility)) {
    return ledger;
  }

  // Unknown message id → return previous ledger reference-equal.
  const existing = ledger.byMessage.get(messageId);
  if (!existing) {
    return ledger;
  }

  const dedupeKey = makeManualTagDedupeKey(code, eligibility.applierUserId);

  // Same applier already applied this code → dedupe; return reference-equal.
  for (const t of existing.userAppliedTags) {
    if (t.dedupeKey === dedupeKey) return ledger;
  }

  const newTag: ManualTagEntry = {
    code,
    appliedByUserId: eligibility.applierUserId,
    appliedByActorRole: eligibility.applierActorRole,
    appliedAt,
    dedupeKey,
    note: typeof note === 'string' ? note.slice(0, 140) : note ?? null,
  };

  const newUserAppliedTags = [...existing.userAppliedTags, newTag];
  const newRecord: MoveLinkageRecord = {
    ...existing,
    userAppliedTags: Object.freeze(newUserAppliedTags),
  };

  const newByMessage = new Map(ledger.byMessage);
  newByMessage.set(messageId, newRecord);

  // Update cluster aggregate.
  const newByCluster = rebuildClusterAggregateForMessage({
    clusterId: existing.pointClusterId,
    byMessage: newByMessage,
    previous: ledger.byCluster,
  });

  // Compose a single 'add' event.
  const event: MetadataEvent = {
    eventId: `add:manual_tag:${code}:${messageId}:${appliedAt}`,
    kind: 'add',
    codeFamily: 'manual_tag',
    code,
    messageId,
    clusterId: existing.pointClusterId,
    at: appliedAt,
    cause: null,
  };

  return {
    byMessage: newByMessage,
    byCluster: newByCluster,
    metadataEvents: Object.freeze([...ledger.metadataEvents, event]),
    messageOrder: ledger.messageOrder,
    inputHash: ledger.inputHash,
  };
}

/**
 * Remove a manual tag previously applied by the same user. Idempotent —
 * removing a non-present tag returns the ledger reference-equal.
 */
export function removeManualTag(args: {
  ledger: MoveMetadataLedger;
  messageId: string;
  code: ManualTagCode;
  applierUserId: string;
  removedAt?: string;
}): MoveMetadataLedger {
  const { ledger, messageId, code, applierUserId } = args;
  const removedAt = args.removedAt ?? new Date().toISOString();

  const existing = ledger.byMessage.get(messageId);
  if (!existing) return ledger;

  const dedupeKey = makeManualTagDedupeKey(code, applierUserId);
  const next: ManualTagEntry[] = [];
  let removed = false;
  for (const t of existing.userAppliedTags) {
    if (t.dedupeKey === dedupeKey) {
      removed = true;
      continue;
    }
    next.push(t);
  }
  if (!removed) return ledger;

  const newRecord: MoveLinkageRecord = {
    ...existing,
    userAppliedTags: Object.freeze(next),
  };
  const newByMessage = new Map(ledger.byMessage);
  newByMessage.set(messageId, newRecord);

  const newByCluster = rebuildClusterAggregateForMessage({
    clusterId: existing.pointClusterId,
    byMessage: newByMessage,
    previous: ledger.byCluster,
  });

  const event: MetadataEvent = {
    eventId: `remove:manual_tag:${code}:${messageId}:${removedAt}`,
    kind: 'remove',
    codeFamily: 'manual_tag',
    code,
    messageId,
    clusterId: existing.pointClusterId,
    at: removedAt,
    cause: null,
  };

  return {
    byMessage: newByMessage,
    byCluster: newByCluster,
    metadataEvents: Object.freeze([...ledger.metadataEvents, event]),
    messageOrder: ledger.messageOrder,
    inputHash: ledger.inputHash,
  };
}

// ── Internal — cluster aggregate rebuild ──────────────────────

function rebuildClusterAggregateForMessage(args: {
  clusterId: string;
  byMessage: ReadonlyMap<string, MoveLinkageRecord>;
  previous: ReadonlyMap<string, ClusterMetadataSummary>;
}): Map<string, ClusterMetadataSummary> {
  const { clusterId, byMessage, previous } = args;
  const next = new Map(previous);
  const prevSummary = previous.get(clusterId);
  const manualSet = new Set<ManualTagCode>();
  const autoSet = new Set<AutoMetadataCode>();
  const participantSet = new Set<string>();
  let lastTagAt: string | null = null;
  for (const rec of byMessage.values()) {
    if (rec.pointClusterId !== clusterId) continue;
    for (const t of rec.userAppliedTags) {
      manualSet.add(t.code);
      participantSet.add(t.appliedByUserId);
      if (lastTagAt === null || t.appliedAt > lastTagAt) lastTagAt = t.appliedAt;
    }
    for (const a of rec.autoDerivedMetadata) {
      autoSet.add(a.code);
    }
  }
  const manualCodes: ManualTagCode[] = [];
  for (const c of ALL_MANUAL_TAG_CODES) {
    if (manualSet.has(c)) manualCodes.push(c);
  }
  const autoCodes: AutoMetadataCode[] = [];
  for (const c of ALL_AUTO_METADATA_CODES) {
    if (autoSet.has(c)) autoCodes.push(c);
  }
  next.set(clusterId, {
    clusterId,
    manualTagCodes: Object.freeze(manualCodes),
    autoMetadataCodes: Object.freeze(autoCodes),
    lifecycleState: prevSummary?.lifecycleState ?? 'open',
    lastManualTagAt: lastTagAt,
    taggingParticipantCount: participantSet.size,
  });
  return next;
}

// ── Internal — input hash ─────────────────────────────────────

function computeInputHash(args: {
  timelineMap: ArgumentTimelineMapModel;
  lifecycleMap: PointLifecycleMap;
  manualTagsByMessageId: ReadonlyMap<string, ReadonlyArray<ManualTagEntry>>;
  artifactsByMessageId: ReadonlyMap<string, ReadonlyArray<EvidenceArtifact>>;
  config: AutoMetadataConfig;
}): string {
  const { timelineMap, lifecycleMap, manualTagsByMessageId, artifactsByMessageId, config } = args;
  const lastNode = timelineMap.nodes[timelineMap.nodes.length - 1];
  const lastId = lastNode ? lastNode.messageId : '';
  const lastCreated = lastNode ? lastNode.createdAt : '';
  let manualCount = 0;
  for (const v of manualTagsByMessageId.values()) manualCount += v.length;
  const cfgSig = [
    config.noResponseTurnThreshold,
    config.repeatedAxisPressureThreshold,
    config.participantSkippedTurnThreshold,
  ].join('|');
  return `n=${timelineMap.nodes.length}|last=${lastId}@${lastCreated}|l=${lifecycleMap.inputHash}|mt=${manualCount}|a=${artifactsByMessageId.size}|c=${cfgSig}`;
}
