/**
 * REF-003 — Referee Card assembly helper.
 *
 * Pure TypeScript. No React. No Supabase. No network. No AI. No `Date.now`.
 * No fetch, no Edge read, no classifier call, no persistence.
 *
 * Maps a typed bundle of data the surface ALREADY holds (no new fetch) into
 * REF-002's frozen `BuildOpenIssueInput`. The surface populates the bundle
 * (`RefereeCardAssemblyInput`); `buildRefereeCardInput` is a total, pure
 * shape-mapper that the surface then feeds straight into the shipped
 * `buildOpenIssue(...)`.
 *
 * It does NOT call `selectBanner`, `adaptAllSourcesForNode`,
 * `deriveSuggestedMoves`, `buildActPopout`, or `buildOpenIssue` — the caller
 * supplies the already-adapted marks/banner, and `buildOpenIssue` runs the
 * Act / suggested joins internally (cdiscourse-doctrine §1/§4/§5/§9/§10a;
 * REF-001 ratified `fe35812`; REF-002 shipped contract).
 *
 * Doctrine that shapes the mapping:
 *   - The deterministic Constitution engine is the SOLE submission gate; this
 *     helper builds advisory render-time input only and is never in any
 *     submit path.
 *   - `sameSideAsParent` + `carriesSupportEvidence` default conservatively to
 *     `false` upstream: side alone never implies a `supports` relation.
 *   - Heat / popularity / engagement / virality / standing bands are NEVER
 *     mapped in (`standingBand` / `evidentiaryRisk` stay `null`).
 *   - Family J / sensitive gating + the Observation-vs-Allegation split live
 *     in REF-002; this helper only forwards the already-split, already-J-gated
 *     marks the caller adapted at the public `timeline_node` surface.
 */

import type { ArgumentType, ConstitutionRule } from '../../../domain/constitution/types';
import type {
  PointLifecycleSnapshot,
  PointLifecycleClusterSummary,
} from '../../lifecycle';
import type {
  ClusterMetadataSummary,
  MoveLinkageRecord,
  ManualTagCode,
  AutoMetadataCode,
} from '../../metadata';
import type { EvidenceDebt } from '../../evidence/evidenceDebtModel';
import type { SourceChainStatus } from '../../evidence/evidenceModel';
import type { NodeLabelMark } from '../../nodeLabels/nodeLabelTypes';
import type { BannerSelectionResult } from '../../refereeBanners/types';
import type { ActViewerRole } from '../oneBox/actPopoutModel';
import type { BuildOpenIssueInput } from '../../refereeLoop';

// The ONLY value import — used to OPEN-filter the node's evidence debts.
import { OPEN_EVIDENCE_DEBT_STATUSES } from '../../evidence/evidenceDebtModel';

/**
 * The bundle the surface assembles from data it already holds (all at render
 * time). Every field is sourced from an in-scope memo / prop; none triggers a
 * fetch, an Edge read, or a classifier call.
 */
export interface RefereeCardAssemblyInput {
  roomId: string | null;
  activeMessageId: string | null;
  storedArgumentType: ArgumentType | null;
  parentType: ArgumentType | null;
  /** Active node `side` === parent node `side`. `false` when unknown — side
   *  alone never implies support. */
  sameSideAsParent: boolean;
  /** Active node carries support artifacts AND is evidence-shaped. Conservative
   *  `false` otherwise — feeds only the `replies → supports` upgrade. */
  carriesSupportEvidence: boolean;
  /** `boardActRole` — the engine + role-gate viewer classification. */
  viewerRole: ActViewerRole;
  /** `constitution.activeRules`. */
  rules: ReadonlyArray<ConstitutionRule>;
  /** `lifecycleMap.byMessage.get(activeMessageId)`. */
  lifecycleSnapshot: PointLifecycleSnapshot | null;
  clusterSummary: PointLifecycleClusterSummary | null;
  clusterMetadata: ClusterMetadataSummary | null;
  moveLinkage: MoveLinkageRecord | null;
  /** Every debt attached to the node; the helper OPEN-filters it. */
  openEvidenceDebts: ReadonlyArray<EvidenceDebt>;
  sourceChainStatus: SourceChainStatus | null;
  manualTagCodes: ReadonlyArray<ManualTagCode>;
  autoMetadataCodes: ReadonlyArray<AutoMetadataCode>;
  /** Machine-kind marks (auto-metadata + lifecycle + raw-classifier), adapted
   *  at the public `timeline_node` surface by `adaptAllSourcesForNode`. */
  machineObservationMarks: ReadonlyArray<NodeLabelMark>;
  /** User-kind marks (manual tags), adapted at the same surface. */
  userAllegationMarks: ReadonlyArray<NodeLabelMark>;
  /** The `refereeBanner` prop — consumed, never re-selected. */
  bannerSelection: BannerSelectionResult | null;
  /** Verbatim — no synthesis. */
  targetExcerpt: string | null;
  /** Active node quote anchor when present; `null` acceptable. */
  quoteAnchor: string | null;
  isOnSideBranch: boolean;
  isTangent: boolean;
  activePathDepth: number;
  isNoRebuttal: boolean;
}

/**
 * Total + pure. Returns `null` when `roomId` or `activeMessageId` is null (no
 * issue exists; no card mounts). Otherwise returns the REF-002
 * `BuildOpenIssueInput` for the active node.
 */
export function buildRefereeCardInput(
  input: RefereeCardAssemblyInput,
): BuildOpenIssueInput | null {
  if (input.roomId === null || input.activeMessageId === null) return null;

  // OPEN-filter the node's debts (REF-002 expects pre-filtered debts).
  const openEvidenceDebts = input.openEvidenceDebts.filter((d) =>
    OPEN_EVIDENCE_DEBT_STATUSES.includes(d.status),
  );

  return {
    roomId: input.roomId,
    targetNodeId: input.activeMessageId,

    // Post-storage card view — no live compose selection; relation derives
    // from the stored type / lifecycle.
    selectedActEntryId: null,
    selectedChannel: null,

    storedArgumentType: input.storedArgumentType,
    sameSideAsParent: input.sameSideAsParent,
    carriesSupportEvidence: input.carriesSupportEvidence,

    parentType: input.parentType,
    viewerRole: input.viewerRole,
    rules: input.rules,

    lifecycleState: input.lifecycleSnapshot?.clusterState ?? null,
    lifecycleAxis: input.lifecycleSnapshot?.axis ?? null,
    openEvidenceDebts,
    sourceChainStatus: input.sourceChainStatus,
    manualTags: input.manualTagCodes,
    autoMetadata: input.autoMetadataCodes,

    // Reserved tier-5 axis source — not derived at the surface in v1.
    activeDisagreementKind: null,

    machineObservations: input.machineObservationMarks,
    bannerSelection: input.bannerSelection,
    // Not consumed by any REF-002 derivation (banner already in bannerSelection).
    categoryReadings: [],
    userAllegations: input.userAllegationMarks,

    targetExcerpt: input.targetExcerpt,
    quoteAnchor: input.quoteAnchor,

    suggestionInput: {
      clusterSummary: input.clusterSummary,
      clusterMetadata: input.clusterMetadata,
      moveLinkage: input.moveLinkage,
      sourceChainStatus: input.sourceChainStatus,
      // Reserved heuristics — null/false by the SuggestionDerivationInput
      // contract. Heat / standing are NEVER an input.
      evidentiaryRisk: null,
      latestMoveType: null,
      activePathDepth: input.activePathDepth,
      isNoRebuttal: input.isNoRebuttal,
      stopReason: null,
      isOnSideBranch: input.isOnSideBranch,
      isTangent: input.isTangent,
      standingBand: null,
      maxSuggestions: 3,
    },
  };
}
