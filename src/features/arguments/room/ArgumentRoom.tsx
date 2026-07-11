/**
 * ASP-EXTRACT-001 (Slice 2) — ArgumentRoom, the room orchestrator.
 *
 * Stack + Timeline orchestrator for the argument-room interaction surface.
 * Owns: surface mode, active message id, bubble view models, timeline
 * segments, action dispatch, deletion-request sheet, and every derivation
 * and handler the room needs. The two lens bodies were carved out of the
 * col1 slot into sibling files: the stack (feed) lens is ExchangeView and
 * the timeline-map lens is MapView. This file keeps all state, all
 * derivations, all handlers, the RoomBoardLayout skeleton, and every shared
 * slot (topBanner / col2 / col2Footer / col3 / bottomChrome / overlays).
 * The col1 slot dispatches to ExchangeView or MapView by mode.
 *
 * ArgumentGameSurface.tsx is now a thin re-export shim over this file, so
 * every existing importer and every render test that imports the surface by
 * name stays valid with zero behavior change.
 *
 * The mediator board is derived exactly ONCE here and passed down; the two
 * view files never re-derive it. No service-role usage. No public.arguments
 * mutation from this component. Editing message bodies is not exposed.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useHeaderBreakpoint } from '../../../hooks/useHeaderBreakpoint';
// ASP-EXTRACT-001 (Slice 1) — the timeline-map lens, extracted from the
// mode === timeline col1 branch. A thin pass-through wrapper over
// ArgumentTimelineMap; owns no state / derivation / handler. The
// ArgumentTimelineMap component + the linked-prior create-affordance copy
// and styles now live in MapView, so they are no longer imported here.
import { MapView } from './MapView';
// ASP-EXTRACT-001 (Slice 2) — the stack (feed) lens, extracted from the
// mode === stack col1 branch. A thin pass-through wrapper over
// ArgumentBubbleStack plus the conditional participant ArgumentBubbleActions;
// owns no state / derivation / handler. Every value arrives as a prop.
import { ExchangeView } from './ExchangeView';
// QUOTE-FORGE-001 — linked prior argument chips built by the room shell.
import type { LinkedPriorArgumentChip } from '../crossRoom/linkedPriorArgumentModel';
import type { CallbackEchoViewModel } from '../crossRoom/callbackEchoModel';
// UX-BOARD-RAIL-002 — pure presentational band-driven board grid. Receives the
// already-built render-tree subtrees as slot props and arranges them into a
// 1 / 2 / 3-column board by the resident `headerBand`. No hook / handler /
// derivation lives in the wrapper; every mount stays textually in this file.
import { RoomBoardLayout } from '../RoomBoardLayout';
// UX-BOARD-RAIL-004 (SN-1) — pure presentational grouping wrapper that gives the
// three bottom-chrome surfaces (Open Issues · seat strip · side action) one calm,
// bordered board-bottom region. Zero behavior/data/semantics change.
import { BoardBottomChrome } from '../BoardBottomChrome';
// REF-005 — the structured "Request review / Mark concern" composer. A
// presentational sibling overlay (like the deletion sheet); it owns no
// persistence and fires no hide/delete path. The loose `flag` affordances
// route here instead of an immediate notify.
import { RequestReviewComposer } from '../../requestReview';
import {
  buildPointFeedbackFlags,
  PointFeedbackFlagsRow,
  DerivedSignalAdvisoryLines,
  deriveDerivedObservationSignals,
  selectInspectAdvisoryLines,
  selectMediatorRailOverlay,
  // UX-FLAGS-004 (#836) — resolve a flag key to its composer intent so a pill
  // tap can enter the shipped reply-with-preset lane pre-typed.
  flagIntentForKey,
  type DerivedSignal,
  type DerivedSignalNodeInput,
} from '../../feedbackFlags';
import { prioritizePointFeedbackFlags } from '../../feedbackFlags/feedbackFlagPriority';
import { buildSidecarViewModel } from '../argumentReplySidecarModel';
import { TimelineSelectedReadoutPanel } from '../TimelineSelectedReadoutPanel';
import {
  buildTimelineSelectedReadoutViewModel,
  type ReadoutSelectionStatus,
} from '../timelineSelectedReadoutModel';
import { DeletionRequestSheet } from '../DeletionRequestSheet';
import {
  buildArgumentBubbleViewModels,
  buildArgumentTimelineMap,
  deriveInitialActiveMessageId,
  getLatestMessageId,
  getNextMessageId,
  getPreviousMessageId,
  sortMessagesChronologically,
  toggleSurfaceMode,
  type ArgumentBubbleControl,
  type ArgumentMessageInput,
  type ArgumentSurfaceMode,
  type ArgumentTimelineMapNode,
} from '../argumentGameSurfaceModel';
import { computeParticipantTrends } from '../argumentScoreModel';
// UX-SELECTED-NODE-001 — restrained gold accent for the Act-dominant dock
// trigger. Existing UX-BRAND-001 token; no new hex.
import { BRAND } from '../../../lib/designTokens';
import { resolveStackKeyEffect } from '../stackKeyboardSwipeModel';
import type { TimelineDensityMode } from '../timelineNodeVisualModel';
import { ArgumentScoreTracker } from '../ArgumentScoreTracker';
import { ArgumentSideActionRail, getRailActions, railActionToBubbleControl } from '../ArgumentSideActionRail';
import type { RailActionCode, RailViewerRole } from '../ArgumentSideActionRail';
// ROOM-002 (#885) — the pure Ringside feed projection. Built here from the
// derivations the orchestrator already holds and passed into ExchangeView only
// when room_exchange_v2 is on.
import { buildRingsideFeed, type RingsideFeedViewModel } from './ringsideFeedModel';
// ROOM-004 (#886) — the pure Map node-action surface projection + the sidecar
// links footer. The surface is built here (the single reconciliation point)
// and passed into MapView; the footer mounts in col2 under the reused flags.
import { buildMapNodeActionSurface, type MapNodeActionSurface } from './mapNodeActionSurfaceModel';
import { MapNodeSidecarLinks } from './MapNodeSidecarLinks';
import { SeatAvailabilityStrip } from '../SeatAvailabilityStrip';
import { buildSeatAvailabilityViewModel } from '../../debates/seatClaimModel';
import type { SeatAvailability } from '../../debates/seatClaimModel';
import type { ArgumentTag, ArgumentFlag } from '../types';
import type { ParticipantSide } from '../../debates/types';
import type { GalleryEntryHint } from '../../debates/conversationGalleryModel';
import type { MoveDraftPatch } from '../conversationMoves';
import type { ArgumentType } from '../../../domain/constitution/types';
import {
  deriveEvidenceDebts,
  getNodeEvidenceDebtChip,
  getNodeEvidenceDebtSummary,
  getRoomEvidenceDebtSummary,
  getTimelineEvidenceContract,
  type EvidenceArtifact,
  type EvidenceDebtArgumentInput,
  type NodeEvidenceDebtSummary,
  type TimelineEvidenceContract,
} from '../../evidence';
import { buildArtifactsByMessageId } from '../argumentGameSurfaceEvidence';
import { useProofItems } from '../../proof/useProofItems';
// MARK-002 (#894) — the marker read hook + the phrase-picker sheet + the pending
// scope type. All gated by timestampRebuttalsEnabled (default off => the hook
// fetches nothing, the picker never mounts, every card renders byte-identically).
import { useMarkers } from '../markers/useMarkers';
import { MarkerPhrasePickerSheet } from '../markers/MarkerPhrasePickerSheet';
import type { PendingMarkerScope } from '../markers/timestampMarkerModel';
// FEEDBACK-001 (#898) — the move-marks hook + the ONE aggregate derivation + the
// ambient legend line. All gated by moveMarksEnabled (default off => the hook
// fetches nothing, the aggregate is null, the bar never mounts, and both aggregate
// surfaces are byte-identical to today).
import { useMoveMarks } from '../../feedback/useMoveMarks';
import { deriveMoveMarkAggregate, receiptsPromptMoveIds } from '../../feedback/moveMarkAggregateModel';
import { MOVE_MARKS_LEGEND_LINE } from '../../feedback/moveMarksCopy';
// CARD-VIEW-DATA-001 — exploded-detail builder for the active Cards-view
// card. Pure-TS; memoized below keyed on `activeMessageId` (+ upstream
// maps). The component is imported by ArgumentBubbleCard. No new fetch, no
// service-role, no AI — it consumes data the surface already holds.
import {
  artifactsToEvidenceSources,
  buildCardDetailViewModel,
} from '../cardView/cardDetailModel';
// MCP-MAPPING-EXPANSION-001 (Slice B) — wire the POST-STORAGE observation-
// mapping evaluator into the active Cards-view card. The surface derives the
// POSITIVE persisted rawKeys of the active node, runs the Slice-A evaluator
// at the `card` surface, and formats the results into the "Combination
// observations" section. Pure + memoized; the evaluator NEVER calls the
// classifier/network (it reads already-persisted booleans) and is NEVER in
// the submit path.
import { buildCardMappingSection } from '../cardView/cardMappingSectionModel';
import {
  evaluateObservationMapping,
  OBSERVATION_MAPPING_REGISTRY,
} from '../../nodeLabels/observationMapping';
// SC-004 — Build the dock model + thread selection state into the
// timeline map. Lifecycle + metadata maps are built once per render and
// memoized by their inputHashes; the dock model is cheap (O(cluster
// members)) and rebuilds whenever the target / actor / upstream inputs
// change.
import { buildPointLifecycleMap } from '../../lifecycle';
import { DisagreementPointsRail } from '../../mediator/DisagreementPointsRail';
// INTEL-001 (#900) — engagement-lane derivations for the mediator next-action
// tie-break. Pure TS; no pointStanding, no standing coupling, no person axis.
import { deriveDodgeChains, deriveRoomDebtAnswerRate } from '../../intel';
// VISUAL-SIMPLIFY-002 — reuse the shipped, ban-list-clean rail chrome title as
// the on-demand analysis-trigger label (no new gameCopy mapping required).
import { DISAGREEMENT_POINTS_RAIL_COPY } from '../../mediator/mediatorRailCopy';
import { deriveRoomMediatorBoardState } from '../../mediator/roomMediatorAdapter';
import { MediatorNodeMarker } from '../../mediator/MediatorNodeMarker';
// UX-MEDIATOR-002 — the relocated mediator-state detail block, mounted inside
// the existing Inspect overlay (sibling of NodeLabelInspectGroups) so the
// reasoning behind the one default chip is preserved on Inspect (no
// intelligence deleted).
import { MediatorNodeInspectDetail } from '../../mediator/MediatorNodeInspectDetail';
// UX-SELECTED-NODE-001 (O-4) — pure presentational wrapper that sections the
// four already-mounted Inspect siblings into the four named sections of the v4 drawer
// sections ("Why this state · Other structure notes · Move forward · History").
// Local Inspect-overlay presentation only; the siblings are composed, never
// modified; no board / topology change.
import { SelectedNodeInspectDrawer } from '../../mediator/SelectedNodeInspectDrawer';
import { getNodeMediatorMarker } from '../../mediator/nodeMediatorMarkers';
import { helperForMediatorState } from '../../mediator/mediatorPlainLanguage';
// UX-NEXT-MOVE-001 — "What would move this forward?" guidance for the active
// node, rendered in the existing SelectedNodeInspectDrawer "Move forward:" slot.
// Pure display: the move set is a deterministic function of the active node
// v4 display state (no re-derivation, no network/AI, no submit change).
import { MediatorNextMovesCard } from '../../mediator/MediatorNextMovesCard';
import { nextMovesForState } from '../../mediator/nextMovesForState';
import { v4DisplayStateFor } from '../../mediator/deriveMediatorBoardState';
// UX-FEEDBACK-001 — restrained STATIC current-state progress notes
// (display-only; no gamification, no transition language, no rating/score).
// `feedbackForMediatorProgress` maps the active node CURRENT display state
// (+ local current-state context) to one calm note; `MediatorProgressNote`
// renders it. Read-only projection of the already-derived board — no new
// derivation, no persistence, no transition detection, no submit change.
import { feedbackForMediatorProgress } from '../../mediator/feedbackForMediatorProgress';
import { MediatorProgressNote } from '../../mediator/MediatorProgressNote';
import { buildMoveMetadataLedger, getManualTagPlainLabel } from '../../metadata';
// META-1E — Cards-detail metadata diff inspector. Imported directly by path
// (the `../metadata` barrel stays React-free). Mounts as a sibling overlay
// beside NodeLabelInspectGroups when Inspect is open on a selected move.
import { MetadataDiffInspector } from '../../metadata/MetadataDiffInspector';
import {
  applyManualTag,
  removeManualTag,
  persistedTagsToManualTagEntries,
  type ApplyManualTagResult,
} from '../../metadata/pointTagsApi';
import { diffPointTagSets, pickLatestChange } from '../../metadata/pointTagsRealtime';
import type { ManualTagCode } from '../../metadata';
import { ROOM_REALTIME_COPY, looksLikeInternalCode } from '../gameCopy';
// ROOM-001 (#876) — ambient state rail + its pure model. Consumes the already
// derived mediatorBoard + evidenceDebts as precomputed counts; never re-derives.
import { ArgumentStateRail } from './ArgumentStateRail';
import { deriveArgumentStateRail } from './argumentStateRailModel';
import type { RoomContractViewModel } from '../../debates/roomContractModel';
import type { PersistedPointTag, MachineObservationResultRow } from '../types';
import {
  buildTimelineNodeActionDockModel,
  actionDockToComposerPreset,
  type TimelineNodeActionDockActionCode,
  type TimelineNodeActionDockActor,
  type TimelineNodeActionDockTarget,
} from '../timelineNodeActionDockModel';
// MCP-019 — the deferred semantic-referee render components. Both render
// nothing when their props are absent / inert, so the surface is unchanged
// for a room with the semantic layer off (the v1 default).
import { RefereeBannerView } from '../../refereeBanners/RefereeBannerView';
import type { BannerSelectionResult } from '../../refereeBanners/types';
// UX-001.3 — The persistent collapsed-composer strip mounted below the
// score tracker. Renders only when the parent supplies `onComposerExpand`
// so older callers that omit the prop see the surface unchanged.
import { CollapsedComposerStrip } from '../composer/CollapsedComposerStrip';
import type { BoxType } from '../oneBox/boxModel';
import type { ArgumentRow } from '../types';
import {
  SemanticOverrideChoiceSheet,
  type SemanticOverrideChoice,
} from '../SemanticOverrideChoiceSheet';
import type { SemanticOverridePrompt } from '../../semanticOverride/types';
// UX-001.4 — board-level Act / Inspect / Go menu mounts. The three
// menus share the QOL-030 Popout chassis; UX-001.4 wires them at the
// surface level (above both Stack and Timeline) so the same A/I/G
// shortcut + trigger contract covers both views. Inspect + Go were
// previously unmounted in production; Act has an additional in-composer
// mount (OneBox.tsx) for Cmd+K mode-switching that is preserved
// verbatim.
import { ActPopout } from '../oneBox/ActPopout';
import { InspectPopout } from '../oneBox/InspectPopout';
import { GoPopout } from '../oneBox/GoPopout';
import type {
  ActEntryId,
  ActTargetKind,
  ActViewerRole,
} from '../oneBox/actPopoutModel';
import { actEntryToQuickAction } from '../oneBox/actPopoutModel';
import type { GoJumpTarget, GoLens } from '../oneBox/goPopoutModel';
// REF-004 — map the IssueState of an active Open Issue onto an existing Go lens
// (dims, never hides). Pure model addition; no new FocusLensId.
import { issueStateToGoLens } from '../oneBox/goPopoutModel';
import { quickActionToPreset, type QuickActionLabel } from '../quickActionPresets';
import { deriveComposerActingOnLabel } from '../composer/composerActingOnModel';
import { useConstitution } from '../useConstitution';
import { buildInspectContent } from '../oneBox/inspectContentBuilder';
import {
  resolveMenuPresentation,
  type MenuBand,
} from '../oneBox/menuPresentationModel';
import {
  deriveMenuKeyBadgeContext,
  resolveKeyBadgeVisibility,
} from '../oneBox/menuKeyBadgeModel';
import { resolveBoardMenuKeyEffect } from '../boardMenuKeyboardModel';
import { buildTimelineMiniMapModel } from '../timelineMiniMapModel';
import type { ArgumentType as ConstitutionArgumentType } from '../../../domain/constitution/types';
// UX-001.5A — Node labels (Machine Observations + User Allegations).
// UI-only consumer of the pure-TS source adapters; owns no state, calls no
// Supabase, runs no AI provider. UX-MEDIATOR-002: NodeLabelStrip (the old
// per-node default-view second chip surface) is NO LONGER mounted in the
// default view — its Observation/Allegation content is relocated into
// NodeLabelInspectGroups, which mounts adjacent to the InspectPopout as a
// sibling overlay visible only when Inspect is open (per design §10.3
// alternative path — zero modification to InspectPopout.tsx or
// inspectContentBuilder.ts).
import {
  NodeLabelInspectGroups,
  adaptAllSourcesForNode,
  adaptSemanticRefereeSourceComposer,
  toAnnotationChipDescriptors,
} from '../../nodeLabels';
// UX-MEDIATOR-002 — NodeLabelStrip is no longer mounted in the DEFAULT view
// (its Observation/Allegation content is relocated into the Inspect overlay via
// NodeLabelInspectGroups). The component, its tests, and its nodeLabels export
// remain intact for a future selected-context surface; it is simply not
// imported here anymore (one primary state chip per node by default).
import type { AnnotationChipDescriptor } from '../../nodeAnnotations';
// REF-003 — Referee Card surface for the ACTIVE node. The surface derives the
// Open Issue (Disagreement Contract) at render time from data it already holds
// (no fetch, no Edge read, no classifier call, no persistence) via the pure
// assembly helper, then the shipped REF-002 `buildOpenIssue`. The card is
// advisory and NEVER in any submit path.
import { buildOpenIssue } from '../../refereeLoop';
import type { DisagreementContract, MoveSuggestion } from '../../refereeLoop';
import { buildRefereeCardInput } from '../cardView/refereeCardAssembly';
// REF-004 — the Inspect-only Open Issue detail sibling overlay + the Referee
// Card navigation-verb type. The overlay is the single home for the issue
// raw provenance; it mounts beside the existing Inspect sibling overlays.
import { InspectOpenIssueDetail } from '../cardView/InspectOpenIssueDetail';
import type { RefereeNavVerb } from '../cardView/RefereeCardView';
// REF-006-RAIL — the room-wide Open Issues rail. A PURE PROJECTION over many
// nodes already-derived OpenIssue objects: the REF-002 `buildOpenIssue` stays
// the single derivation home (the host builds each candidate issue via the
// same `buildRefereeCardInput` → `buildOpenIssue` path the active Referee Card
// uses); the rail only filters → orders → caps → shapes rows and reuses the
// shipped jump / Inspect / Act-move mechanics. No new routing, no derivation,
// no persistence. Display-only, post-storage, never in any submit path.
import { OpenIssuesRail } from '../openIssuesRail/OpenIssuesRail';
import {
  buildOpenIssuesLedger,
  CANDIDATE_SIGNAL_TAGS,
  CLOSED_LIFECYCLE_STATES,
  OPEN_ISSUES_RAIL_BUILD_CAP,
  // VISUAL-SIMPLIFY-002 — shipped ban-list-clean rail title reused as the
  // on-demand analysis-trigger label.
  OPEN_ISSUES_RAIL_COPY,
  type OpenIssueLedgerCandidate,
  type OpenIssueLedgerEntry,
  type OpenIssuesLedger,
} from '../openIssuesRail/openIssuesRailModel';

/**
 * VISUAL-SIMPLIFY-002 — which on-demand analysis surface is currently mounted.
 * `null` (the default) means NONE — the default room view is conversation-only
 * (spine + bubbles + composer + ≤3 friendly flags). Exactly one analysis
 * surface can be mounted at a time (structural mutual exclusion).
 */
type AnalysisSurfaceKey = 'disagreement' | 'open_issues' | 'readout' | null;

/** FEEDBACK-002 (#899) — the shared frozen empty result for the flag-off path. */
const EMPTY_DERIVED_SIGNALS: readonly DerivedSignal[] = Object.freeze([]);

export interface Props {
  debate: {
    id: string;
    title: string | null;
    /** Optional explicit root claim body. If null, falls back to the body of the first chronological message. */
    rootBody?: string | null;
  };
  messages: ArgumentMessageInput[];
  currentUserId: string | null;
  isAdmin?: boolean;
  /** Optional initial surface mode (Stack default). */
  initialMode?: ArgumentSurfaceMode;
  /** Optional per-message non-dismissed flags from argument_flags. */
  flagsByArgumentId?: Record<string, ArgumentFlag[]>;
  /** Optional per-message tags from argument_tags. */
  tagsByArgumentId?: Record<string, ArgumentTag[]>;
  /**
   * META-1A — Optional per-message persisted manual-tag rows
   * (`public.point_tags`, active only). When supplied the surface hydrates
   * the metadata ledger with persisted tags instead of an empty map.
   */
  pointTagsByArgumentId?: Record<string, PersistedPointTag[]>;
  /**
   * MCP-021B — Optional per-message persisted Machine Observation result
   * rows (`public.argument_machine_observation_results`). When supplied
   * AND non-empty, the NodeLabelInspectGroups mount (Inspect overlay)
   * forwards them into the Source 6 adapter via
   * `adaptAllSourcesForNode({ persistedClassifierRows, surface })`. When
   * absent or empty for a message, Source 6 returns `[]` byte-equal
   * pre-MCP-021B.
   */
  persistedObservationsByArgumentId?: Record<string, MachineObservationResultRow[]>;
  /** Optional latest-message-id hint from the full-room loader (used to snap active when new messages arrive). */
  latestMessageId?: string | null;
  /** Optional map of (messageId → boolean) for "I have an open deletion request on this". */
  deletionRequestedMap?: Record<string, boolean>;
  /** Optional per-message category label (for timeline badges). */
  categoryLabelById?: Record<string, string | null>;
  /** Optional per-message qualifier label (for timeline badges). */
  qualifierLabelById?: Record<string, string | null>;
  /**
   * Action handlers. Called with the canonical control name + message id.
   *
   * COMPOSER-001 — Optional third `preset` argument is passed when the SC-004
   * timeline node action dock dispatches a move whose composer body / type
   * has already been resolved upstream (`narrow` / `confirm` / `synthesize` /
   * `concede` / `clarify` / `add_evidence` etc.). The room shell (caller)
   * uses it verbatim instead of computing a preset from the bubble control.
   * Existing callers that ignore the third argument are unaffected.
   */
  onAction?: (
    control: ArgumentBubbleControl,
    messageId: string,
    preset?: MoveDraftPatch | null,
  ) => void;
  /** Optional refresh trigger (e.g., the refresh from the room hook). */
  onRefresh?: () => void;
  /**
   * Stage 6.4 — Viewer role at entry. `observer` collapses the side action
   * rail and hides post / score / flag controls until the user expands it
   * and picks Join Aff / Join Neg.
   */
  viewerRole?: RailViewerRole;
  /** Participant side, when the user is already a participant. */
  participantSide?: ParticipantSide | null;
  /** Called when the user picks Join Aff / Join Neg in the action rail. */
  onJoinSide?: (side: 'affirmative' | 'negative') => void;
  /** Called when the user picks Share in the action rail. */
  onShareRoom?: () => void;
  /**
   * Optional smart-entry hint computed from the gallery card the user
   * opened. The room shell uses it to pre-activate the right message
   * and to show a small "micro-moment" hint near the timeline.
   */
  entryHint?: GalleryEntryHint;
  /**
   * PR-001 — the visual-density preference of the user. Passed to
   * `buildArgumentTimelineMap({ density })`, which drives the VG-004
   * `resolveNodeGapPx`. Defaults to normal when omitted.
   */
  density?: TimelineDensityMode;
  /**
   * PR-001 — the effective reduce-motion preference (OS value
   * composed with the user override). When supplied it replaces the
   * independent OS read of the timeline board.
   */
  reduceMotionOverride?: boolean;
  /**
   * SC-005 — optional "Start an argument" CTA folded into the expanded dock
   * of the side action rail (replaces the separate bottom actionBar in App.tsx).
   * When omitted, no CTA chip renders in the dock.
   */
  startArgumentAction?: { label: string; onPress: () => void } | null;
  /**
   * MCP-019 — the semantic-referee banner for the currently-active move, or
   * null. Rendered as a non-blocking strip anchored under the active node
   * readout (both Stack and Timeline modes). Absent → no banner; the surface
   * is byte-identical to the pre-MCP-019 render.
   */
  refereeBanner?: BannerSelectionResult | null;
  /**
   * MCP-019 — the semantic-referee override prompt for the active move, or
   * null. When `shouldOffer` is true an inline (non-modal) choice sheet
   * renders in the surface. Absent / `shouldOffer: false` → nothing.
   */
  overridePrompt?: SemanticOverridePrompt | null;
  /**
   * MCP-019 — called when the user confirms a lane in the override sheet.
   * The room shell builds the in-memory `SemanticOverrideRecord`; this
   * callback never moves score and never writes a flag.
   */
  onConfirmOverride?: (choice: SemanticOverrideChoice) => void;
  /**
   * UX-001.3 — fires when the Timeline `activeMessageId` changes. The
   * composer reads this id (one-way) so its `ComposerContextStrip` can
   * show a divergence cue when the user has selected a different node
   * than the composer is currently bound to. Additive optional; omitted
   * = no callback, no behavior change.
   */
  onActiveMessageChange?: (activeMessageId: string | null) => void;
  /**
   * UX-001.3 — fires when the user taps the persistent
   * `CollapsedComposerStrip` below the score tracker. The parent
   * (App.tsx) opens the composer dock in response. Additive optional;
   * omitted = the strip is NOT rendered (the surface is unchanged for
   * older callers).
   */
  onComposerExpand?: () => void;
  /**
   * UX-001.3 — additional context for the `CollapsedComposerStrip`
   * label. The strip can use this to render the room resolution in
   * the root_claim default case. Additive optional.
   */
  composerResolution?: string | null;
  /**
   * UX-001.4 — fires when the user picks the new Go popout
   * `Leave argument` entry. The caller (App.tsx) wires the existing
   * `handleLeaveRoom` path (deselectDebate + cleanup); this is NOT a
   * new room-exit path. Additive optional; the Go entry renders
   * disabled-with-reason when omitted (back-compat for older callers).
   */
  onLeaveRoom?: () => void;
  /**
   * ARG-ROOM-005 — live public-room seat availability, derived by the room
   * shell (App.tsx) from the active-participant count + the room visibility +
   * the side of the viewer. When present, the surface renders the read-only seat
   * strip and drives the full-room state of the rail (disabled Join chips + nudge).
   * Absent (older callers, private rooms, tests) => no strip, chips enabled
   * (byte-identical to the pre-ARG-ROOM-005 surface).
   */
  seatAvailability?: SeatAvailability | null;
  /**
   * QUOTE-FORGE-001 — linked prior argument context chips for THIS room,
   * built by the room shell with the pure buildLinkedPriorArgumentChip
   * model. Forwarded verbatim into the single ArgumentTimelineMap mount so
   * the already-wired chip row renders. Optional; omitting it (or an empty
   * array) renders nothing (back-compat, calm default).
   */
  linkedPriorChips?: ReadonlyArray<LinkedPriorArgumentChip>;
  /**
   * QUOTE-FORGE-001 — open a linked prior settled argument room. Fired by a
   * chip Open action; only reached for an authorized chip (title_only /
   * unavailable chips disable Open in the model).
   */
  onOpenLinkedPrior?: (linkId: string) => void;
  /**
   * QUOTE-FORGE-001 — open the Inspect popout section for a linked prior
   * argument. Fired by a chip View context action.
   */
  onViewLinkedPriorContext?: (linkId: string) => void;
  /**
   * QUOTE-FORGE-001 — open the create-link picker. When present, a single
   * lightweight Reference a prior argument affordance renders in the
   * timeline header. Omitting it hides the affordance (calm default).
   */
  onOpenLinkPicker?: () => void;
  /**
   * QUOTE-FORGE-002 (#842) — per-message woven-callback echo map, built ONCE by
   * the room shell (FullRoomGameSurfaceMount) from the move refs + resolved
   * QOL-042 links. Threaded to the Timeline (badge), the active Stack card
   * (banner), and the Ringside cards. Absent when quote_forge is off =>
   * byte-identical surfaces.
   */
  callbackEchoByMessageId?: Record<string, CallbackEchoViewModel>;
  /**
   * QUOTE-FORGE-002 (#842) — open a referenced prior room from a callback echo
   * origin. Reuses the shipped room-level nav channel (targetDebateId).
   */
  onOpenPriorRoom?: (targetDebateId: string) => void;
  /**
   * ROOM-001 (#876) — ambient ArgumentStateRail wiring. Additive optional. The
   * flag gates the mount (default OFF => rail never mounted, room byte-identical
   * to today); roomContract + roomVisibility feed the turn / visibility cue;
   * onOpenRoomDetails is an in-app state jump (never a route).
   */
  roomExchangeV2Enabled?: boolean;
  roomContract?: RoomContractViewModel;
  roomVisibility?: 'public' | 'private';
  onOpenRoomDetails?: () => void;
  /**
   * PROOF-002 (#889) — gates the read-path flip. Additive optional. When true
   * the room fetches proof_items rows (useProofItems) and feeds them into
   * buildArtifactsByMessageId (rows-first, JSONB fallback). Default/false =>
   * hook disabled => JSONB-only, byte-identical to today.
   */
  proofDrawerEnabled?: boolean;
  /**
   * MARK-002 (#894) — gates the marker text-half surface. Additive optional. When
   * true the room fetches timestamp_markers (useMarkers), renders the source-span
   * highlight + reply chips on Ringside cards, and offers the Respond to this
   * phrase-picker. Default/false => the hook fetches nothing and no marker surface
   * mounts (byte-identical to today).
   */
  timestampRebuttalsEnabled?: boolean;
  /**
   * MARK-002 — emits the picked phrase scope up to the room shell (App.tsx), which
   * scopes the composer and mints the marker on submit. The room owns the picker
   * (it holds the bodies); the shell owns the composer + the mint.
   */
  onMarkerScopePicked?: (scope: PendingMarkerScope) => void;
  /**
   * FEEDBACK-001 (#898) — gates the human move-mark surface. Additive optional.
   * When true the room fetches active move_marks (useMoveMarks), mounts the ghost
   * BooleanFeedbackBar on the active non-own participant move in both lenses, and
   * folds the ONE deriveMoveMarkAggregate into the two ambient surfaces (the
   * state-rail openPointCount + the Map legend line). Default/false => the hook
   * fetches nothing, the aggregate is null, no bar mounts (byte-identical).
   */
  moveMarksEnabled?: boolean;
  /**
   * FEEDBACK-002 (#899) — gates the derived-signal advisory surfaces (the Inspect
   * active-node advisory lines + the mediator rail overlay). Additive optional.
   * Default/false => the derivation returns empty, so both surfaces render nothing
   * (byte-identical). App.tsx is the sole flag reader; this arrives as a prop.
   */
  derivedSignalsEnabled?: boolean;
  /**
   * UX-FLAGS-004 (#836) — gates the tappability of the point feedback-flag pills.
   * Additive optional. Default/false => onFlagIntent stays undefined at both the
   * Timeline and Ringside mounts, so the pills render byte-identically to today
   * (non-tappable, role text). App.tsx is the sole flag reader; this arrives as a
   * prop.
   */
  feedbackFlagIntentsEnabled?: boolean;
}

/**
 * UX-FLAGS-004 (#836) — seats that may post. Mirrors the private predicate in
 * ArgumentEntryComposer (pinned, so it cannot be imported): a flag intent opens
 * a reply, so an observer / no-seat viewer never fires one. Kept module-level so
 * it is not re-created per render.
 */
function seatCanPostFlagIntent(side: ParticipantSide | null | undefined): boolean {
  return side === 'affirmative' || side === 'negative' || side === 'moderator';
}

export function ArgumentRoom({
  debate,
  messages,
  currentUserId,
  isAdmin,
  initialMode,
  flagsByArgumentId,
  tagsByArgumentId,
  pointTagsByArgumentId,
  persistedObservationsByArgumentId,
  latestMessageId: latestIdHint,
  deletionRequestedMap,
  categoryLabelById: _categoryLabelById,
  qualifierLabelById: _qualifierLabelById,
  onAction,
  onRefresh: _onRefresh,
  viewerRole,
  participantSide,
  onJoinSide,
  onShareRoom,
  entryHint,
  density,
  reduceMotionOverride,
  startArgumentAction,
  refereeBanner,
  overridePrompt,
  onConfirmOverride,
  onActiveMessageChange,
  onComposerExpand,
  composerResolution,
  onLeaveRoom,
  seatAvailability,
  linkedPriorChips,
  onOpenLinkedPrior,
  onViewLinkedPriorContext,
  onOpenLinkPicker,
  callbackEchoByMessageId,
  onOpenPriorRoom,
  roomExchangeV2Enabled,
  roomContract,
  roomVisibility,
  onOpenRoomDetails,
  proofDrawerEnabled,
  timestampRebuttalsEnabled,
  onMarkerScopePicked,
  moveMarksEnabled,
  derivedSignalsEnabled,
  feedbackFlagIntentsEnabled,
}: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // ARG-ROOM-005 — read-only seat-availability display + rail full-room state.
  // Verdict-free; built from the pure model, never re-derived here. Null when
  // the room shell does not surface seats (private rooms, older callers).
  const seatAvailabilityViewModel = seatAvailability
    ? buildSeatAvailabilityViewModel(seatAvailability, participantSide ?? null)
    : null;
  // UX-001.4 — band drives the per-menu presentation variant via
  // `menuPresentationModel.resolveMenuPresentation`. The UX-001.1
  // useHeaderBreakpoint is the single source of truth for the band.
  const { band: headerBand } = useHeaderBreakpoint();
  const menuBand: MenuBand = headerBand;
  // UX-BOARD-RAIL-002 — the Disagreement Points ledger is a collapsed-pill
  // bottom SHEET on phone (byte-identical to today) and a persistent docked
  // PANE on tablet/wide. Derived adjacent to the band; the band itself is the
  // column-count authority (passed straight into RoomBoardLayout). No new
  // breakpoint helper, no second band read.
  const boardPresentation: 'sheet' | 'pane' = headerBand === 'phone' ? 'sheet' : 'pane';
  // UX-001.4 — constitution rules thread into the board-level Act mount
  // (the Act 3-gate engine filter requires them). Pulled once at the
  // surface level so both the in-composer and the board-level mounts
  // consume identical rules (single source of truth).
  const constitution = useConstitution();
  const sorted = useMemo(() => sortMessagesChronologically(messages || []), [messages]);
  const latestId = useMemo(() => latestIdHint ?? getLatestMessageId(sorted), [sorted, latestIdHint]);
  const [mode, setMode] = useState<ArgumentSurfaceMode>(initialMode || 'stack');
  // Stage 6.4: derive the initial active message from the entry hint, not
  // always the latest. needs_rebuttal cards open the root; source-chain
  // cards open the most-recent challenge/source-style move.
  //
  // QOL-040.3 — Honour `entryHint.entryHintForArgumentId` FIRST when set
  // (notification deep-link path). The pure-TS deriver
  // (`deriveInitialActiveMessageId`) returns that id when it is present
  // in the loaded slice and falls through to the `activate` policy when
  // it is absent (soft-deleted / wrong-room / RLS-hidden). The natural
  // composition of debate-list RLS + argument-row RLS + soft-delete
  // filter (`useArgumentRoomMessages` only loads posted rows)
  // makes `sorted.find(...)` returning undefined the single gate for
  // every inaccessible case.
  const initialActiveId = useMemo<string | null>(() => {
    // QOL-040.3 — Dev-only diagnostic for the rare fallback case. No PII;
    // only opaque ids. The pure deriver is silent; the warn lives here so
    // the unit tests (which call the deriver directly) do not have to
    // assert on a logging side effect.
    if (
      __DEV__ &&
      sorted.length > 0 &&
      entryHint?.entryHintForArgumentId &&
      !sorted.find((m) => m.id === entryHint.entryHintForArgumentId)
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        '[QOL-040.3] Notification hint argument not in loaded slice; ' +
        'falling back to latest move.',
        { debateId: sorted[0]?.debateId, hintId: entryHint.entryHintForArgumentId },
      );
    }
    return deriveInitialActiveMessageId(sorted, latestId, entryHint);
  }, [sorted, latestId, entryHint]);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(initialActiveId);
  // IX-004 — companion state describing WHY the readout subject is what it
  // is. `activeMessageId` stays the single selection source of truth; this
  // value only labels the selection (entry-hint pre-activation, default
  // latest, an explicit user pick, or a stale auto-snap to latest). It
  // never picks the message — it only drives the readout stale banner.
  const [selectionStatus, setSelectionStatus] = useState<ReadoutSelectionStatus>(
    entryHint ? 'entry_hint' : 'default_latest',
  );
  const [deletionTarget, setDeletionTarget] = useState<string | null>(null);
  // REF-005 — target message id for the structured Request-review composer.
  // Null = composer closed. Opening it replaces the old loose `flag` notify;
  // the composer decides routing on submit (claim-level → disagreement loop;
  // moderator-queue → the existing review callback). Nothing hides here.
  const [requestReviewTarget, setRequestReviewTarget] = useState<string | null>(null);
  // SC-004 — currently-selected target for the action dock. Null = no
  // selection, no dock. Mutually exclusive with the SC-002 popover; opening
  // the popover dismisses the dock and vice versa.
  const [selectedDockTarget, setSelectedDockTarget] = useState<TimelineNodeActionDockTarget | null>(null);
  // REF-006-RAIL — bottom-chrome single-owner coordination. The Open Issues
  // rail and the side action rail are mutually exclusive: when one expands the
  // other force-collapses (via its `isAnyPanelOpen` prop). Both default false
  // so the surface is byte-identical when neither rail is expanded.
  const [openIssuesRailExpanded, setOpenIssuesRailExpanded] = useState(false);
  const [sideRailExpanded, setSideRailExpanded] = useState(false);
  // UX-MEDIATOR-005 — Disagreement Points rail expanded state. Third member of
  // the single-owner bottom-rail mutual-exclusion group; defaults false so the
  // surface is byte-identical when the rail is collapsed.
  const [disagreementPointsRailExpanded, setDisagreementPointsRailExpanded] = useState(false);
  // VISUAL-SIMPLIFY-002 — the default room view leads with the conversation;
  // deep analysis is ONE TAP AWAY, never in the default line of sight. This
  // single selector is the PARENT GATE deciding whether an analysis surface is
  // even mounted. Default `null` → nothing mounted on EVERY band (phone /
  // tablet / wide). A single key (not three booleans) makes "two analysis
  // surfaces open at once" unrepresentable → structural mutual exclusion,
  // reusing the discipline the Act/Inspect/Go menus already follow.
  //
  // The existing `disagreementPointsRailExpanded` / `openIssuesRailExpanded` /
  // `sideRailExpanded` booleans are RETAINED: the child rails still own their
  // own expand/collapse for the `isAnyPanelOpen` OR-terms. `activeAnalysisSurface`
  // only decides whether the pane/sheet is mounted at all.
  const [activeAnalysisSurface, setActiveAnalysisSurface] =
    useState<AnalysisSurfaceKey>(null);
  // UX-001.2 — microMoment dismissed on first meaningful Timeline interaction.
  // The banner is transient: it shows on deep-link entry (driven by
  // `entryHint.verbPhrase`) and disappears the moment the user activates a
  // node, presses Prev / Next / Latest / Back-to-root, or toggles Timeline /
  // Cards. The dismiss flag DOES NOT trigger on initial render, on a
  // microMoment re-render, on a change to `entryHint` itself (a new
  // deep-link should re-show the banner), or on a scroll inside the
  // Timeline that does not change selection. The render condition extends
  // to `{entryHint?.verbPhrase && !microMomentDismissed ? ... : null}`.
  const [microMomentDismissed, setMicroMomentDismissed] = useState(false);
  // UX-001.4 — board-level Act / Inspect / Go menu visibility state.
  // The three are mutually exclusive (the keyboard handler closes any
  // currently-open menu before opening another; the chassis Modal stack
  // also handles the case visually).
  const [boardActVisible, setBoardActVisible] = useState(false);
  const [inspectVisible, setInspectVisible] = useState(false);
  const [goVisible, setGoVisible] = useState(false);
  // UX-001.4 — current Lens of the Go popout. Local state because the lens
  // is a render-mode preference owned by the surface, not threaded
  // through from App.tsx (a Lens dims rendering — it does NOT mutate
  // any timeline data).
  const [goLens, setGoLens] = useState<GoLens>('none');
  // Resolved viewer role: explicit prop, else infer from participant side.
  const resolvedViewerRole: RailViewerRole = viewerRole
    ?? (participantSide && participantSide !== 'observer' && participantSide !== 'moderator' ? 'participant' : 'observer');

  // When new messages arrive, keep the active selection on the LATEST.
  useEffect(() => {
    if (!activeMessageId && latestId) {
      setActiveMessageId(latestId);
      return;
    }
    if (activeMessageId && !sorted.find((m) => m.id === activeMessageId)) {
      // Active message disappeared (e.g., admin removal). Snap to latest.
      // IX-004 — mark the snap as a stale fallback so the readout panel
      // shows the "That message is no longer here" banner. The next
      // explicit user action resets the status back to the explicit state.
      setActiveMessageId(latestId);
      setSelectionStatus('stale_fallback');
    }
  }, [latestId, activeMessageId, sorted]);

  // If the initialMode prop changes after mount (e.g., the user pressed a
  // different toolbar chip), reflect it in local state.
  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  // UX-001.2 — A new entryHint resets the microMoment so a fresh deep-link
  // re-shows the banner. Keyed on `entryHint?.verbPhrase` so an entryHint
  // whose verb phrase did not change (e.g. an identity-stable object with
  // a new helperLine but the same verb) still re-shows; a state-only
  // change to the room (new messages, a tag, etc.) does NOT reset.
  useEffect(() => {
    setMicroMomentDismissed(false);
  }, [entryHint?.verbPhrase]);

  // UX-001.3 — One-way notification of activeMessageId changes. The
  // composer reads the id via this callback so its ComposerContextStrip
  // can surface a divergence cue when the user has selected a different
  // node on the Timeline than the composer is bound to. We do NOT
  // mutate `activeMessageId` from the composer — this is read-only
  // wiring. Effect is no-op when the prop is absent.
  useEffect(() => {
    if (onActiveMessageChange) {
      onActiveMessageChange(activeMessageId);
    }
  }, [activeMessageId, onActiveMessageChange]);

  const chronologicalIds = useMemo(() => sorted.map((m) => m.id), [sorted]);

  // PROOF-002 (#889) — optional proof_items rows for the read-path flip. The
  // hook fetches nothing and returns {} when proofDrawerEnabled is falsy (the
  // flag-off path), so buildArtifactsByMessageId below falls back to the JSONB
  // path byte-identically. Additive; no service-role, no write.
  const { proofItemsByMessageId } = useProofItems(debate.id, chronologicalIds, proofDrawerEnabled === true);

  // MARK-002 (#894) — markers for the loaded moves, grouped by target + by reply.
  // The hook fetches nothing and returns empty maps when the flag is off, so the
  // Ringside cards render byte-identically. refetch converges the reply chip after
  // a post + mint (a new reply id also re-runs the effect via idsKey).
  const { markersByTargetId, markersByReplyId } = useMarkers(
    debate.id,
    chronologicalIds,
    timestampRebuttalsEnabled === true,
  );
  // The set of loaded message ids drives the orphaned tombstone (a reply chip
  // whose quoted move is no longer in the room).
  const loadedIdSet = useMemo(() => new Set(chronologicalIds), [chronologicalIds]);
  const isMarkerTargetLoaded = useCallback(
    (targetArgumentId: string) => loadedIdSet.has(targetArgumentId),
    [loadedIdSet],
  );
  // MARK-002 — the phrase-picker target (the non-own card being quoted). Null =
  // the picker is closed. Only ever set when the flag is on.
  const [markerPickerTargetId, setMarkerPickerTargetId] = useState<string | null>(null);
  const handleRespondToThis = useCallback((messageId: string) => {
    setMarkerPickerTargetId(messageId);
  }, []);
  const handleCancelMarkerPicker = useCallback(() => {
    setMarkerPickerTargetId(null);
  }, []);
  const handlePickMarkerScope = useCallback(
    (scope: PendingMarkerScope) => {
      setMarkerPickerTargetId(null);
      onMarkerScopePicked?.(scope);
    },
    [onMarkerScopePicked],
  );

  const parentLookup = useCallback((parentId: string) => {
    const p = sorted.find((m) => m.id === parentId);
    return p ? p.body : null;
  }, [sorted]);

  const viewModels = useMemo(() => buildArgumentBubbleViewModels({
    messages: sorted,
    currentUserId,
    isAdmin: Boolean(isAdmin),
    activeMessageId,
    deletionRequestedMap,
    parentHintLookup: parentLookup,
  }), [sorted, currentUserId, isAdmin, activeMessageId, deletionRequestedMap, parentLookup]);

  // Enrich messages with per-message tags + flags for the standing/tone
  // inference of the timeline map.
  const enrichedMessages = useMemo(() => sorted.map((m) => ({
    ...m,
    tagCodes: (tagsByArgumentId?.[m.id] || []).map((t) => t.tagCode),
    flagCodes: (flagsByArgumentId?.[m.id] || []).map((f) => f.flagCode),
  })), [sorted, tagsByArgumentId, flagsByArgumentId]);

  const timelineMap = useMemo(() => buildArgumentTimelineMap({
    messages: enrichedMessages,
    currentUserId,
    activeMessageId,
    // VG-004 / PR-001 — explicit density. PR-001 threads the
    // visual-density preference here; `resolveNodeGapPx` falls back to
    // normal (44px) when the preference is undefined.
    density: density ?? 'normal',
  }), [enrichedMessages, currentUserId, activeMessageId, density]);

  // REF-006-RAIL — O(1) lookup maps. Replace the O(n) `sorted.find` /
  // `timelineMap.nodes.find` scans in the per-node referee assembly (and the
  // active-node parent-type derivation) with constant-time `Map.get` — a free
  // de-quadratic win and the prerequisite for per-candidate assembly without
  // O(n²) cost.
  const messageById = useMemo(() => {
    const m = new Map<string, ArgumentMessageInput>();
    for (const msg of sorted) m.set(msg.id, msg);
    return m;
  }, [sorted]);
  const nodeByMessageId = useMemo(() => {
    const m = new Map<string, ArgumentTimelineMapNode>();
    for (const n of timelineMap.nodes) m.set(n.messageId, n);
    return m;
  }, [timelineMap]);
  // REF-006-RAIL — chronological position (recency) per message id. Higher =
  // more recent. Built once from `chronologicalIds`; the rail recency-desc
  // tiebreak reads this (never heat / popularity / a strength band).
  const recencyIndexById = useMemo(() => {
    const m = new Map<string, number>();
    chronologicalIds.forEach((id, i) => m.set(id, i));
    return m;
  }, [chronologicalIds]);

  // EV-002 — Build the artifact map once per render from the optional
  // `attachedEvidence` payload of each message (typed defensively). Empty /
  // missing payloads yield an empty list, which produces the `no_source`
  // form downstream. No service-role, no Supabase call.
  const artifactsByMessageId = useMemo<Record<string, ReadonlyArray<EvidenceArtifact>>>(
    () => buildArtifactsByMessageId(sorted, proofItemsByMessageId),
    [sorted, proofItemsByMessageId],
  );

  const evidenceContractFor = useCallback((messageId: string): TimelineEvidenceContract | null => {
    const arr = artifactsByMessageId[messageId];
    if (!arr) return null;
    const msg = sorted.find((m) => m.id === messageId);
    const argumentType = msg?.argumentType ?? null;
    return getTimelineEvidenceContract(argumentType, arr);
  }, [artifactsByMessageId, sorted]);

  // EV-003 — Derive the room evidence debts once per render from the same
  // already-fetched rows (tag codes carry the request signal; the EV-001
  // artifact map carries the resolution signal). Pure, deterministic — the
  // injected `nowMs` keeps the staleness calc honest. No new fetch, no
  // service-role, no Supabase write. A debt is advisory only.
  const evidenceDebts = useMemo(() => {
    const debtArguments: EvidenceDebtArgumentInput[] = sorted.map((m) => ({
      id: m.id,
      debateId: debate.id,
      parentId: m.parentId,
      authorId: m.authorId ?? null,
      argumentType: m.argumentType ?? null,
      side: m.side ?? null,
      createdAt: m.createdAt,
      tagCodes: (tagsByArgumentId?.[m.id] || []).map((t) => t.tagCode),
      artifacts: artifactsByMessageId[m.id] ?? [],
    }));
    return deriveEvidenceDebts({
      debateId: debate.id,
      arguments: debtArguments,
      nowMs: Date.now(),
    });
  }, [sorted, debate.id, tagsByArgumentId, artifactsByMessageId]);

  // EV-003 — Per-node debt summary lookup threaded into the timeline popover.
  const evidenceDebtSummaryFor = useCallback(
    (messageId: string): NodeEvidenceDebtSummary | null =>
      getNodeEvidenceDebtSummary(messageId, evidenceDebts),
    [evidenceDebts],
  );

  // FEEDBACK-001 (#898) — the room-shell move-marks seam. The hook fetches the
  // ACTIVE move_marks rows for the loaded moves (the SELECT-only read), holds each
  // viewer own per-move state for the ghost bar, and exposes optimistic
  // onMark / onUnmark. It fetches nothing and returns empty data when
  // moveMarksEnabled is falsy (the flag-off path), so the aggregate memo below is
  // null and every surface is byte-identical.
  const moveMarks = useMoveMarks({
    debateId: debate.id,
    argumentIds: chronologicalIds,
    viewerId: currentUserId,
    enabled: moveMarksEnabled === true,
  });
  // The ONE aggregate derivation both ambient surfaces consume. Null when off.
  const moveMarkAggregate = useMemo(
    () => (moveMarksEnabled ? deriveMoveMarkAggregate(moveMarks.activeRows) : null),
    [moveMarksEnabled, moveMarks.activeRows],
  );
  // Contextual receipts trigger: the ghost bar shows the "Receipts?" option when
  // the opponent move already owes a source (an open evidence debt). Reuses the
  // existing debt signal; a mark is procedural, never a verdict.
  const showMoveMarkReceiptsFor = useCallback(
    (argumentId: string): boolean => getNodeEvidenceDebtSummary(argumentId, evidenceDebts).hasOpenDebt,
    [evidenceDebts],
  );

  // SC-004 — Convert the record-shaped artifacts map to a ReadonlyMap form
  // for the lifecycle / metadata builders, which prefer that interface.
  const artifactsByMessageIdMap = useMemo(() => {
    const m = new Map<string, ReadonlyArray<EvidenceArtifact>>();
    for (const k of Object.keys(artifactsByMessageId)) m.set(k, artifactsByMessageId[k]);
    return m;
  }, [artifactsByMessageId]);

  // SC-004 — Build LIFE-001 lifecycle map once per timelineMap change.
  // Memoization key is the timelineMap reference (already memoized above).
  const lifecycleMap = useMemo(
    () => buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: artifactsByMessageIdMap,
    }),
    [timelineMap, artifactsByMessageIdMap],
  );

  // INTEL-001 (#900) — engagement-lane weighting for the mediator next-action
  // tie-break, derived from the SAME marks aggregate + tree + debts the room
  // already holds (no new fetch). Gated on moveMarksEnabled: OFF => undefined =>
  // the board (incl. inputHash) is byte-identical. It only re-orders WHICH open
  // point nextAction names; it never touches standing.
  const mediatorWeightingSignals = useMemo(() => {
    if (!moveMarksEnabled || !moveMarkAggregate) return undefined;
    const nodes = timelineMap.nodes.map((n) => ({ id: n.messageId, parentId: n.parentId }));
    const dodge = deriveDodgeChains({
      unaddressedMoveIds: moveMarkAggregate.unaddressedMoveIds,
      nodes,
    });
    const debtAnswer = deriveRoomDebtAnswerRate({ debateId: debate.id, debts: evidenceDebts });
    return {
      pressuredNodeIds: dodge.chains.flatMap((c) => c.memberArgumentIds),
      unresolvedDebtPressure: 1 - (debtAnswer.answerRate ?? 1),
    };
  }, [moveMarksEnabled, moveMarkAggregate, timelineMap, evidenceDebts, debate.id]);

  // UX-MEDIATOR-005 — Read-only mediator board for the Disagreement Points
  // rail. A pure projection over the data already built in-room (timeline map,
  // LIFE-001 lifecycle map, EV-003 evidence debts, persisted A–I observations).
  // No new fetch, no mutation, never a submission gate. The adapter delegates to
  // the merged deriveMediatorBoardState (UX-MEDIATOR-001) — no duplicated logic.
  const mediatorBoard = useMemo(
    () => deriveRoomMediatorBoardState({
      debateId: debate.id,
      timelineMap,
      lifecycle: lifecycleMap,
      evidenceDebts,
      persistedObservationsByArgumentId: persistedObservationsByArgumentId ?? null,
      activeNodeId: activeMessageId,
      // INTEL-001 (#900) — undefined when move_marks OFF => byte-identical board.
      weightingSignals: mediatorWeightingSignals,
    }),
    [debate.id, timelineMap, lifecycleMap, evidenceDebts, persistedObservationsByArgumentId, activeMessageId, mediatorWeightingSignals],
  );

  // FEEDBACK-002 (#899) — the derived cross-family advisory signals. A pure fold
  // over data ALREADY in-room (timeline structure, persisted A-I observations,
  // move-marks, evidence debts). It NEVER re-derives the mediator board / debts;
  // the two selectors below compose over this output at display time. Gated on
  // derivedSignalsEnabled (App.tsx is the sole flag reader). Flag OFF => empty
  // => both surfaces render nothing => byte-identical.
  const derivedSignals = useMemo<readonly DerivedSignal[]>(() => {
    if (derivedSignalsEnabled !== true) return EMPTY_DERIVED_SIGNALS;
    const msgById = new Map(sorted.map((m) => [m.id, m]));
    const nodes: DerivedSignalNodeInput[] = timelineMap.nodes.map((n) => {
      const msg = msgById.get(n.messageId);
      const authorId = msg?.authorId ?? null;
      const actor: 'self' | 'other' | 'unknown' =
        authorId && currentUserId && authorId === currentUserId
          ? 'self'
          : authorId
            ? 'other'
            : 'unknown';
      return {
        argumentId: n.messageId,
        parentId: n.parentId,
        branchRootId: n.branchRootMessageId,
        authorId,
        side: msg?.side ?? null,
        ordinal: n.ordinal,
        actor,
      };
    });
    const observationsByArgumentId: Record<string, { family: string; rawKey: string }[]> = {};
    const obsMap = persistedObservationsByArgumentId ?? {};
    for (const argumentId of Object.keys(obsMap)) {
      const rows = obsMap[argumentId];
      if (!rows) continue;
      observationsByArgumentId[argumentId] = rows.map((r) => ({
        family: String(r.family),
        rawKey: r.rawKey,
      }));
    }
    return deriveDerivedObservationSignals({
      debateId: debate.id,
      nodes,
      observationsByArgumentId,
      evidenceDebts,
      moveMarks: moveMarksEnabled ? moveMarks.activeRows : [],
      // The room does not derive a deterministic heat band; pass null (safe
      // under-fire: hot_but_proof_light stays dormant and its only consumer is
      // the gallery bucket, not wired here). No popularity input ever enters.
      heatBand: null,
      draftContext: null,
    });
  }, [
    derivedSignalsEnabled,
    timelineMap,
    sorted,
    currentUserId,
    persistedObservationsByArgumentId,
    evidenceDebts,
    moveMarksEnabled,
    moveMarks.activeRows,
    debate.id,
  ]);

  // FEEDBACK-002 surface 1 — advisory lines for the Inspect active-node
  // disclosure. Empty (no active node / flag off) => nothing renders.
  const inspectAdvisoryLines = useMemo(
    () => selectInspectAdvisoryLines(derivedSignals, activeMessageId),
    [derivedSignals, activeMessageId],
  );
  // FEEDBACK-002 surface 2 — mediator rail overlay keyed to the ALREADY-derived
  // board points (dodge_chain / talking_past). Additive; never reorders the
  // board. Empty when flag off.
  const mediatorAdvisoryOverlay = useMemo(
    () => selectMediatorRailOverlay(derivedSignals, mediatorBoard.points.map((p) => p.id)),
    [derivedSignals, mediatorBoard],
  );

  // ROOM-001 (#876) — ambient state rail counts + model. Both counts READ the
  // board / debts derived above (no second board derivation). The live-point
  // rule matches the DisagreementPointsRail selectLivePoints rule so the counts
  // never drift. Read-only projection: no fetch, no write, never a submit gate.
  const openPointCount = useMemo(() => {
    const base = mediatorBoard.points.filter((p) => p.state !== 'resolved_or_settled').length;
    // FEEDBACK-001 (#898) surface #1: did_not_address chains contribute to the
    // ambient open-points reading (never a per-message counter). Flag OFF =>
    // aggregate null => base unchanged => byte-identical.
    if (!moveMarkAggregate) return base;
    return base + moveMarkAggregate.unaddressedMoveIds.length;
  }, [mediatorBoard, moveMarkAggregate]);
  const receiptsOwedCount = useMemo(() => {
    const base = getRoomEvidenceDebtSummary(debate.id, evidenceDebts).openCount;
    // FEEDBACK-001 (#898) surface #1: a claim with 2+ receipts_requested marks
    // reads as receipts-owed (Output 9 proof-prompt). Flag OFF => byte-identical.
    if (!moveMarkAggregate) return base;
    return base + receiptsPromptMoveIds(moveMarkAggregate).length;
  }, [debate.id, evidenceDebts, moveMarkAggregate]);
  const stateRailModel = useMemo(
    () =>
      deriveArgumentStateRail({
        viewerRole: resolvedViewerRole,
        participantSide: participantSide ?? null,
        turnLabel: roomContract?.turnLabel ?? null,
        visibility: roomVisibility ?? 'private',
        opponentSeatIsOpen: roomContract?.opponentSeat.isOpen ?? false,
        openPointCount,
        receiptsOwedCount,
      }),
    [resolvedViewerRole, participantSide, roomContract, roomVisibility, openPointCount, receiptsOwedCount],
  );

  // UX-MEDIATOR-002 — the SINGLE primary state chip for the active node,
  // selected ONCE from the already-derived board (single-derivation invariant:
  // the board is consumed, never re-derived). Shared by the default-view chip,
  // the chip-adjacent Inspect caret, and the Inspect detail block so all three
  // read the same one state. Null for ordinary open/resolved nodes (no chip).
  const activeNodeMediatorMarker = useMemo(
    () => getNodeMediatorMarker(mediatorBoard, activeMessageId),
    [mediatorBoard, activeMessageId],
  );

  // UX-MEDIATOR-002 — plain-language detail for the active node mediator
  // state, surfaced in the Inspect overlay (relocated from the default-view
  // chip soup). Helper sentence from the state; the next-useful-move label is
  // the first AVAILABLE pathway step for the point of the node (same read the
  // Disagreement Points rail uses) — null when no pathway is available
  // (e.g. structured impasse).
  const activeNodeMediatorDetail = useMemo(() => {
    if (!activeNodeMediatorMarker || !activeMessageId) {
      return { helper: '', nextMoveLabel: null as string | null };
    }
    const helper = helperForMediatorState(activeNodeMediatorMarker.code);
    const pointId = mediatorBoard.markupByNodeId?.[activeMessageId]?.pointId ?? null;
    const pathway = pointId ? mediatorBoard.pathwaysByPointId?.[pointId] : undefined;
    const step = pathway?.steps.find((s) => s.available) ?? null;
    return { helper, nextMoveLabel: step ? step.plainLabel : null };
  }, [activeNodeMediatorMarker, activeMessageId, mediatorBoard]);

  // UX-NEXT-MOVE-001 — the ordered "What would move this forward?" move set for
  // the active node. A pure function of the v4 DISPLAY state of the marker (the
  // marker code is already projected; v4DisplayStateFor is idempotent on it and
  // satisfies the type). No board re-derivation, no network/AI, no mutation.
  // Empty when there is no actionable marker, or when the state is terminal
  // (resolved_or_settled) — the card then renders nothing.
  const activeNodeNextMoves = useMemo(() => {
    if (!activeNodeMediatorMarker) return [];
    const displayState = v4DisplayStateFor(activeNodeMediatorMarker.code);
    if (displayState === 'resolved_or_settled') return [];
    return nextMovesForState(displayState);
  }, [activeNodeMediatorMarker]);

  // UX-FEEDBACK-001 — restrained STATIC current-state progress notes for the
  // active node, derived from the ALREADY-derived board (single-derivation
  // invariant; never re-derived). Two scoped reads, both pure projections of
  // CURRENT state (no transition, no diff, no persistence, no write):
  //   - the default-visible SELECTION cue ("Point anchored.") — fires on the
  //     local node-selection event for a non-root node; null for root / none.
  //   - the Inspect structural note ("Claim narrowed." / "Concession
  //     preserved." / "Source path identified." / "Next useful move: …") —
  //     reflects the active node CURRENT display state + current-state context
  //     (a preserved concession is the `conceded` lifecycle shape; a source path
  //     EXISTS when a debt on the point is resolved now — `!isOpen && !isBlocked`).
  // Impasse is OWNED by UX-IMPASSE-001 — the helper returns null there (no
  // second render). The reward is clarity, not applause: most states return null.
  const activeNodeProgressSelectionNote = useMemo(() => {
    if (!activeMessageId) return null;
    const node = timelineMap.nodes.find((n) => n.messageId === activeMessageId);
    const isNodeAnchored = node != null && node.isRoot !== true;
    // The display state is irrelevant to the anchoring cue (a local UI event);
    // pass the active marker display state when present, else the neutral open state.
    const displayState = activeNodeMediatorMarker
      ? v4DisplayStateFor(activeNodeMediatorMarker.code)
      : 'open';
    if (displayState === 'resolved_or_settled') return null;
    return feedbackForMediatorProgress(displayState, {
      surface: 'selection',
      isNodeAnchored,
    });
  }, [activeMessageId, timelineMap, activeNodeMediatorMarker]);

  const activeNodeProgressInspectNote = useMemo(() => {
    if (!activeNodeMediatorMarker || !activeMessageId) return null;
    const displayState = v4DisplayStateFor(activeNodeMediatorMarker.code);
    if (displayState === 'resolved_or_settled') return null;
    const clusterState = lifecycleMap.byMessage.get(activeMessageId)?.clusterState ?? null;
    const isConcessionPreserved = clusterState === 'conceded';
    const pointId = mediatorBoard.markupByNodeId?.[activeMessageId]?.pointId ?? null;
    const hasIdentifiedSourcePath = pointId != null
      ? mediatorBoard.evidenceDebts.some(
          (d) => d.pointId === pointId && !d.isOpen && !d.isBlocked,
        )
      : false;
    return feedbackForMediatorProgress(displayState, {
      surface: 'inspect',
      isConcessionPreserved,
      hasIdentifiedSourcePath,
    });
  }, [activeNodeMediatorMarker, activeMessageId, lifecycleMap, mediatorBoard]);

  // META-1A — Convert persisted point_tags rows into the META-001
  // ManualTagEntry map the metadata ledger consumes. Empty input (META-1A
  // not deployed yet, or no tags applied) yields an empty map — identical
  // behavior to the pre-META-1A placeholder.
  const manualTagsByMessageId = useMemo(
    () => {
      const allRows: PersistedPointTag[] = [];
      if (pointTagsByArgumentId) {
        for (const key of Object.keys(pointTagsByArgumentId)) {
          const rows = pointTagsByArgumentId[key];
          if (rows) allRows.push(...rows);
        }
      }
      return persistedTagsToManualTagEntries(allRows);
    },
    [pointTagsByArgumentId],
  );

  // SC-004 — Build META-001 metadata ledger once per lifecycleMap change.
  // META-1A — hydrates persisted manual tags from `pointTagsByArgumentId`.
  const metadataLedger = useMemo(
    () => buildMoveMetadataLedger({
      timelineMap,
      lifecycleMap,
      artifactsByMessageId: artifactsByMessageIdMap,
      manualTagsByMessageId,
    }),
    [timelineMap, lifecycleMap, artifactsByMessageIdMap, manualTagsByMessageId],
  );

  // UX-001.5A — Composer-only observation chips for RefereeBannerView.
  // The referee state does NOT (currently) expose a dedicated
  // composerOnlyCodes slot — see design §14 Risk 1. The adapter
  // gracefully degrades to [] when no codes are present, which makes
  // RefereeBannerView render exactly as before. When upstream wires a
  // codes feed, the adapter automatically converts each composer_only
  // entry into a properly-prefixed Observation chip.
  const uxOneOneFiveAComposerObservationChips = useMemo<
    ReadonlyArray<AnnotationChipDescriptor>
  >(() => {
    if (!refereeBanner || !activeMessageId) return [];
    // refereeBanner.composerOnlyCodes is reserved for a future upstream
    // wire (per design §14 Risk 1). Until then the adapter input is
    // composerOnlyCodes: [] → empty descriptor list → banner unchanged.
    const composerOnlyCodes: ReadonlyArray<string> = [];
    const marks = adaptSemanticRefereeSourceComposer({
      composerOnlyCodes,
      moveId: activeMessageId,
    });
    return toAnnotationChipDescriptors(marks);
  }, [refereeBanner, activeMessageId]);

  // UX-001.3 — Derive the CollapsedComposerStrip preview target. The
  // strip names the parent of the next compose action so the user always
  // sees what they would be acting on, even with the dock closed.
  // When the Timeline has an active node, default to `respond` mode;
  // otherwise (no active node) default to `root_claim` mode.
  const composerStripBoxType: BoxType = activeMessageId ? 'respond' : 'root_claim';
  const composerStripParent: ArgumentRow | null = useMemo(() => {
    if (!activeMessageId) return null;
    const msg = sorted.find((m) => m.id === activeMessageId);
    if (!msg) return null;
    // Build a minimal ArgumentRow stand-in from the in-memory message.
    // The strip only reads id / body / argumentType for its label —
    // the unused fields are filled with safe defaults.
    return {
      id: msg.id,
      debateId: msg.debateId,
      parentId: msg.parentId,
      authorId: msg.authorId ?? '',
      argumentType: (msg.argumentType as ArgumentRow['argumentType']) ?? 'claim',
      side: (msg.side as ArgumentRow['side']) ?? 'neutral',
      body: msg.body,
      depth: 0,
      status: 'posted',
      targetExcerpt: null,
      disagreementAxis: null,
      railPayload: {},
      clientValidation: {},
      serverValidation: {},
      clientSubmissionId: null,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt ?? msg.createdAt,
    };
  }, [activeMessageId, sorted]);

  // META-1B — Screen-reader announcement when persisted manual-tag state
  // changes (a participant in this room or another tab applied / removed
  // a tag). Silent visually — the tag simply appears in the ledger via the
  // existing read path; the announcement is the screen-reader equivalent
  // of that appearance. Move-anchored, NEVER person-anchored (no slot for
  // tagger identity in `ROOM_REALTIME_COPY`). Skips the first render to
  // avoid announcing the initial load. Doctrine-clean: the label comes
  // from `getManualTagPlainLabel` (META-001 plain-language only).
  const prevPointTagsRef = useRef<Record<string, PersistedPointTag[]> | null>(null);
  useEffect(() => {
    const prev = prevPointTagsRef.current;
    const curr = pointTagsByArgumentId || {};
    prevPointTagsRef.current = curr;
    if (prev === null) return; // initial render; do not announce
    const diff = diffPointTagSets(prev, curr);
    if (diff.added.length === 0 && diff.removed.length === 0) return;
    const latest = pickLatestChange(diff);
    if (!latest) return;
    const label = getManualTagPlainLabel(latest.row.tagCode);
    const message =
      latest.kind === 'apply'
        ? ROOM_REALTIME_COPY.tagAppliedAnnouncement(label)
        : ROOM_REALTIME_COPY.tagRemovedAnnouncement(label);
    try {
      AccessibilityInfo.announceForAccessibility(message);
    } catch {
      // Never throws to the user; the announcement is best-effort.
    }
  }, [pointTagsByArgumentId]);

  const activeViewModel = useMemo(() => viewModels.find((v) => v.isActive) || null, [viewModels]);

  // SC-004 — Classify the actor for the dock from the currently-active
  // bubble. Observer comes from the resolved viewer role; otherwise we
  // mirror the actor of the bubble view-model (mapped onto the
  // observer-inclusive union of the dock).
  const dockActor: TimelineNodeActionDockActor = useMemo(() => {
    if (resolvedViewerRole === 'observer') return 'observer';
    const ba = activeViewModel?.actor;
    if (ba === 'self') return 'self';
    if (ba === 'bot') return 'bot';
    if (ba === 'admin') return 'admin';
    if (ba === 'unknown') return 'unknown';
    return 'other';
  }, [resolvedViewerRole, activeViewModel?.actor]);

  // SC-004 — Build the dock model whenever selection / actor / upstream
  // inputs change. Returns null when no target is selected (component
  // renders nothing).
  const dockModel = useMemo(() => {
    if (!selectedDockTarget) return null;
    return buildTimelineNodeActionDockModel({
      target: selectedDockTarget,
      actor: dockActor,
      timelineMap,
      lifecycleMap,
      metadataLedger,
      evidenceContractFor,
      isReadModeViewer: resolvedViewerRole === 'observer',
    });
  }, [selectedDockTarget, dockActor, timelineMap, lifecycleMap, metadataLedger, evidenceContractFor, resolvedViewerRole]);

  const participantTrends = useMemo(
    () => computeParticipantTrends({ messages: enrichedMessages, currentUserId }),
    [enrichedMessages, currentUserId],
  );

  // IX-004 — Selected-message readout. The SC-003 sidecar view-model is
  // built once per render (reused, not rebuilt — IX-004 introduces no new
  // standing / lifecycle / metadata derivation). The readout projection
  // adds the direct-reply count + the "Acting on:" short label + the
  // stale-fallback banner on top of it.
  const sidecarViewModel = useMemo(
    () =>
      buildSidecarViewModel({
        activeNode: timelineMap.activeNode,
        activeViewModel,
        parentNode:
          timelineMap.activeNode && timelineMap.activeNode.parentId
            ? timelineMap.nodes.find((n) => n.messageId === timelineMap.activeNode!.parentId) || null
            : null,
        totalCount: timelineMap.nodes.length,
        activePathIds: timelineMap.activePathIds,
        lifecycleMap,
        metadataLedger,
        viewMode: mode,
      }),
    [timelineMap, activeViewModel, lifecycleMap, metadataLedger, mode],
  );

  const timelineReadoutViewModel = useMemo(
    () =>
      buildTimelineSelectedReadoutViewModel({
        sidecar: sidecarViewModel,
        timelineMap,
        selectedMessageId: activeMessageId,
        status: selectionStatus,
      }),
    [sidecarViewModel, timelineMap, activeMessageId, selectionStatus],
  );

  // UX-SELECTED-NODE-001 (§6 / row §9.3) — the parent message of the active node
  // id, read off the ALREADY-built timeline map (no new derivation, no fetch).
  // Drives the read-only "Go to parent point" jump on the responding-to
  // anchor. null at the root (no parent) → the affordance is omitted cleanly.
  const activeParentMessageId = useMemo(
    () => timelineMap.activeNode?.parentId ?? null,
    [timelineMap],
  );

  // ── CARD-VIEW-DATA-001 — active-card exploded detail model ──
  //
  // Built ONCE per `activeMessageId` change (plus its upstream maps), NOT
  // per stack item. The Stack forwards it to the active card only, which
  // renders it inline BY DEFAULT (no tap) — the Cards page is the
  // "data readily loaded and visible by default" surface. No new fetch,
  // no service-role, no AI.
  const cardDetailOrdinalOf = useCallback((id: string): number | null => {
    const vm = viewModels.find((v) => v.messageId === id);
    return vm ? vm.ordinal : null;
  }, [viewModels]);
  const cardDetailKindLabelOf = useCallback((id: string): string => {
    const vm = viewModels.find((v) => v.messageId === id);
    return vm ? vm.kindLabel : 'move';
  }, [viewModels]);
  const cardDetailParentIdOf = useCallback((id: string): string | null => {
    const msg = sorted.find((m) => m.id === id);
    return msg ? (msg.parentId ?? null) : null;
  }, [sorted]);

  const activeCardDetail = useMemo(() => {
    if (!activeMessageId) return null;
    // Zone 5 — evidence sources + a plain-language debt summary. The debt
    // chip contract is locked plain-language copy (never a raw code).
    const debtSummary = getNodeEvidenceDebtSummary(activeMessageId, evidenceDebts);
    const debtChip = getNodeEvidenceDebtChip(debtSummary);
    const evidenceDebtSummary =
      debtChip.isVisible
        ? [debtChip.label, debtChip.helper].filter((s) => s && s.length > 0).join(' — ')
        : null;
    // Zone 8 — semantic-flag labels: reuse the sidecar semantic_flags
    // section chip labels (already plain-language, §10a-safe).
    const flagSection = sidecarViewModel.sections.find(
      (s) => s.kind === 'semantic_flags',
    );
    const flagLabels =
      flagSection && flagSection.kind === 'semantic_flags'
        ? flagSection.chips.map((c) => c.label)
        : [];

    // ── CARD-VIEW-DETAIL-HUB-001 (Slice 2) — new threaded hub inputs ──
    //
    // ask i — parent quote: resolve the parent node bodyPreview off the
    // ALREADY-COMPUTED `timelineMap` (no fetch; replicates the sidecar
    // parent lookup at argumentReplySidecarModel.ts). null when the parent
    // is soft-deleted / RLS-hidden / out-of-slice → neutral degrade.
    const activeNode =
      timelineMap.nodes.find((n) => n.messageId === activeMessageId) ?? null;
    const parentNode =
      activeNode && activeNode.parentId
        ? timelineMap.nodes.find((n) => n.messageId === activeNode.parentId) ?? null
        : null;
    const parentBodyPreview = parentNode ? parentNode.bodyPreview ?? null : null;

    // CVDH-001 Slice 3 — parent COMPARISON bubble inputs (operator
    // refinement). The parent ordinal / kind / actorLabel come off the
    // already-computed timeline node; the raw `actor` enum (which drives the
    // distinct bubble color per timeline-grammar) comes off the parent
    // bubble view-model. All read off in-scope memos — no fetch.
    const parentViewModel = parentNode
      ? viewModels.find((v) => v.messageId === parentNode.messageId) ?? null
      : null;
    const parentActor = parentViewModel?.actor ?? null;
    const parentOrdinal = parentNode ? parentNode.ordinal : null;
    const parentKindLabel = parentNode ? parentNode.kindLabel : null;
    const parentActorLabel = parentNode ? parentNode.actorLabel : null;
    const parentMessageId = parentNode ? parentNode.messageId : null;

    // ask ii — structural labels: the dropped-tag qualifiers of the node, already
    // plain-language on the timeline node. Defensive: drop any value that
    // still looks like an internal code (never echo a raw code).
    const structuralTagLabels = (activeNode?.droppedTags ?? [])
      .map((t) => t.label)
      .filter((label) => label.length > 0 && !looksLikeInternalCode(label));

    return buildCardDetailViewModel({
      activeMessageId,
      chronologicalIds,
      ordinalOf: cardDetailOrdinalOf,
      kindLabelOf: cardDetailKindLabelOf,
      parentIdOf: cardDetailParentIdOf,
      categoryLabel: _categoryLabelById?.[activeMessageId] ?? null,
      qualifierLabels: activeViewModel?.qualifierBadges ?? [],
      persistedClassifierRows:
        persistedObservationsByArgumentId?.[activeMessageId] ?? [],
      manualTagEntries: manualTagsByMessageId.get(activeMessageId) ?? [],
      autoMetadataCodes:
        metadataLedger.byMessage
          .get(activeMessageId)
          ?.autoDerivedMetadata.map((entry) => entry.code) ?? [],
      clusterState:
        lifecycleMap.byMessage.get(activeMessageId)?.clusterState ?? 'open',
      messageContribution:
        lifecycleMap.byMessage.get(activeMessageId)?.messageContribution ?? null,
      evidenceSources: artifactsToEvidenceSources(artifactsByMessageId[activeMessageId]),
      evidenceDebtSummary,
      standingHint: activeViewModel?.pointStandingHint ?? null,
      lifecycleState:
        lifecycleMap.byMessage.get(activeMessageId)?.clusterState ?? null,
      flagLabels,
      // CVDH-001 Slice 2 — hub asks i / ii / iii / v.
      parentBodyPreview,
      standingToneHeatNode: activeNode,
      standingToneHeatViewModel: activeViewModel ?? null,
      structuralTagLabels,
      semanticFlagsSection:
        flagSection && flagSection.kind === 'semantic_flags' ? flagSection : null,
      // CVDH-001 Slice 3 — parent comparison-bubble inputs (operator refinement).
      parentOrdinal,
      parentKindLabel,
      parentMessageId,
      parentActor,
      parentActorLabel,
    });
  }, [
    activeMessageId,
    chronologicalIds,
    cardDetailOrdinalOf,
    cardDetailKindLabelOf,
    cardDetailParentIdOf,
    _categoryLabelById,
    activeViewModel,
    persistedObservationsByArgumentId,
    manualTagsByMessageId,
    metadataLedger,
    lifecycleMap,
    artifactsByMessageId,
    evidenceDebts,
    sidecarViewModel,
    timelineMap,
    viewModels,
  ]);

  // ── MCP-MAPPING-EXPANSION-001 (Slice B) — combination observations ──
  //
  // POST-STORAGE, DISPLAY-ONLY. For the ACTIVE node only: derive the set of
  // POSITIVE persisted rawKeys (one per persisted machine-observation row —
  // absence of a row IS the negative, per the persistence schema), run the
  // Slice-A evaluator at the `card` surface against the reviewed A-G registry,
  // and format the results into the "Combination observations" section. The
  // evaluator reads already-persisted booleans; it NEVER calls the classifier
  // / network and is NEVER in the submit/acceptance path (engine.ts is the
  // sole gate). Memoized on the persisted rows of the active node so it recomputes
  // only when the active node or its observations change.
  const activeMappingSection = useMemo(() => {
    if (!activeMessageId) return null;
    const rows = persistedObservationsByArgumentId?.[activeMessageId] ?? [];
    const positiveRawKeys = rows
      .map((r) => r.rawKey)
      .filter((k): k is string => typeof k === 'string' && k.length > 0);
    const results = evaluateObservationMapping(
      positiveRawKeys,
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    return buildCardMappingSection(results);
  }, [activeMessageId, persistedObservationsByArgumentId]);

  // ── UX-FLAGS-002 / UX-FLAGS-003 — point-level friendly feedback flags ──
  //
  // POST-STORAGE, DISPLAY-ONLY, sibling to `activeMappingSection`. For the
  // ACTIVE node only: read the persisted machine-observation rows already
  // resident here and route them through the #850 descriptor layer (via the
  // #851 pure adapter) into a small calm list of renderable feedback-flag view
  // models. Own-bubble challenge-adjacent suppression uses the resident
  // `activeViewModel.actor === self` signal (unknown → not own → no
  // over-suppression). This never calls the classifier / network and is never
  // in the submit path.
  //
  // The 1–3 cap / priority lands HERE (#835): the #851 adapter is deliberately
  // uncapped, and `prioritizePointFeedbackFlags` is the downstream owner of the
  // display budget. The memo now yields a PrioritizedPointFeedbackFlags object
  // (`{ visible, suppressedCount }`), consumed only at the render site below.
  const activePointFeedbackFlags = useMemo(() => {
    if (!activeMessageId) return prioritizePointFeedbackFlags([]);
    const rows = persistedObservationsByArgumentId?.[activeMessageId] ?? [];
    const built = buildPointFeedbackFlags(rows, {
      isOwnPoint: activeViewModel?.actor === 'self',
    });
    return prioritizePointFeedbackFlags(built);
  }, [activeMessageId, persistedObservationsByArgumentId, activeViewModel?.actor]);

  // ROOM-002 (#885) — the Ringside feed projection. Built ONLY when
  // room_exchange_v2 is on (else null, so the flag-off path wastes no
  // derivation). A pure join over structures already derived above: the bubble
  // view-models carry the actor-gated allowedControls; the timeline node
  // carries the kind color family, descendant count, and parent id; the
  // artifact map carries the proof count; the evidence-debt summary carries the
  // owed-receipt signal; getRailActions supplies the observer set. No standing,
  // heat, or classifier data reaches the card face.
  const ringsideFeed = useMemo<RingsideFeedViewModel | null>(() => {
    if (!roomExchangeV2Enabled) return null;
    return buildRingsideFeed({
      viewModels,
      viewerRole: resolvedViewerRole,
      activeMessageId,
      kindColorFamilyFor: (id) => nodeByMessageId.get(id)?.kindColorFamily ?? 'default',
      descendantCountFor: (id) => nodeByMessageId.get(id)?.descendantCount ?? 0,
      parentMessageIdFor: (id) => nodeByMessageId.get(id)?.parentId ?? null,
      proofChipCountFor: (id) => artifactsByMessageId[id]?.length ?? 0,
      owedReceiptFor: (id) => getNodeEvidenceDebtSummary(id, evidenceDebts).hasOpenDebt,
      observerActionsFor: (actor) => getRailActions('observer', actor),
      friendlyFlagCountFor: (id) =>
        id === activeMessageId ? activePointFeedbackFlags.visible.length : 0,
      // QUOTE-FORGE-002 (#842) — inject the woven-callback echo join. Undefined
      // map (quote_forge off) => null for every card => byte-identical Ringside.
      callbackEchoFor: (id) => callbackEchoByMessageId?.[id] ?? null,
    });
  }, [
    roomExchangeV2Enabled,
    viewModels,
    resolvedViewerRole,
    activeMessageId,
    nodeByMessageId,
    artifactsByMessageId,
    evidenceDebts,
    activePointFeedbackFlags,
    callbackEchoByMessageId,
  ]);

  // ROOM-004 (#886) — the Map node-action surface. Built ONLY when
  // room_exchange_v2 is on AND a node target is selected (the popover
  // supersedes the SC-004 node dock). It MIRRORS the Ringside card exactly
  // (R1): participant viewers get the SAME activeViewModel.allowedControls the
  // card renders (own node reduces to qualifiers + request deletion via
  // getBubbleControlsForActor), dispatched through handleBubbleAction; observers
  // get the getRailActions observer set, dispatched through handleRailAction.
  // Plus the low-density sidecar links + open-point membership line (a read-only
  // projection of the already-derived mediator board, never re-derived). Null
  // when off / no node selected.
  const mapNodeActionSurface = useMemo<MapNodeActionSurface | null>(() => {
    if (!roomExchangeV2Enabled) return null;
    if (!activeMessageId) return null;
    if (selectedDockTarget?.kind !== 'node') return null;
    const pointId = mediatorBoard.markupByNodeId?.[activeMessageId]?.pointId ?? null;
    const point = pointId ? mediatorBoard.points.find((p) => p.id === pointId) ?? null : null;
    const isOpenPointMember = Boolean(point && point.state !== 'resolved_or_settled');
    const actor = activeViewModel?.actor ?? 'unknown';
    return buildMapNodeActionSurface({
      activeMessageId,
      viewerRole: resolvedViewerRole,
      actor,
      participantControls: activeViewModel?.allowedControls ?? [],
      observerActions: getRailActions('observer', actor),
      actingOnShortLabel: timelineReadoutViewModel.actingOnShortLabel,
      isOpenPointMember,
    });
  }, [
    roomExchangeV2Enabled,
    activeMessageId,
    selectedDockTarget,
    mediatorBoard,
    resolvedViewerRole,
    activeViewModel?.actor,
    activeViewModel?.allowedControls,
    timelineReadoutViewModel,
  ]);

  // ── UX-001.4 — Board-level Act / Inspect / Go derivations ──
  //
  // The three mounts below consume already-resident client state. None
  // adds a backend call, none introduces a new write path, and none
  // touches the engine / role / stage gates inside `actPopoutModel`.
  // UX-001.4 is presentation + wiring only.

  // The lifecycle stage of the active node drives the Act stage promotion and
  // the Inspect emphasized-section pull. `null` when no node is selected
  // or LIFE-001 has no entry for the cluster.
  const activeClusterId = useMemo(() => {
    if (!activeMessageId) return null;
    const node = timelineMap.nodes.find((n) => n.messageId === activeMessageId);
    return node?.branchRootMessageId ?? activeMessageId;
  }, [activeMessageId, timelineMap]);
  const activeStage = useMemo(() => {
    if (!activeClusterId) return null;
    return lifecycleMap.byCluster.get(activeClusterId)?.state ?? null;
  }, [activeClusterId, lifecycleMap]);

  // The parent argument type of the active node — the Act hard engine gate
  // keys off it. `null` for a root-claim context (no parent) and when
  // no node is selected (Act on the room itself).
  const activeParentType = useMemo<ConstitutionArgumentType | null>(() => {
    if (!activeMessageId) return null;
    // REF-006-RAIL — O(1) map lookups replace the prior O(n) finds (byte-equiv).
    const node = nodeByMessageId.get(activeMessageId);
    if (!node) return null;
    const parentMsg = node.parentId ? messageById.get(node.parentId) : null;
    return (parentMsg?.argumentType ?? null) as ConstitutionArgumentType | null;
  }, [activeMessageId, nodeByMessageId, messageById]);

  // Board-level Act mount: target kind + role classification. `actor`
  // is the canonical view-model field — `self` means own bubble.
  const boardActTargetKind: ActTargetKind = activeMessageId ? 'node' : 'room';
  const boardActRole: ActViewerRole = useMemo(() => {
    if (resolvedViewerRole === 'observer') return 'observer';
    if (activeViewModel?.actor === 'self') return 'own_bubble';
    return 'participant_other';
  }, [resolvedViewerRole, activeViewModel?.actor]);

  // ── REF-003 — Referee Card issue for the ACTIVE node ──
  //
  // DERIVED-ONLY, POST-STORAGE, DISPLAY-ONLY. Memoized on the SAME upstream
  // maps as `activeCardDetail` (+ the constitution rules + the refereeBanner
  // prop) so a late classifier result (a new `persistedObservationsByArgumentId`
  // entry or an updated `refereeBanner`) re-derives the card on the next
  // render — no imperative refresh, no subscription. The assembly helper is
  // pure (no fetch, no Edge, no classifier call); the REF-002 `buildOpenIssue`
  // runs the Act / suggested joins internally with the engine + role hard
  // gates. The card is NEVER in any submit path. `null` when no active node.
  // REF-006-RAIL — per-node parent argument type (O(1)). Generalizes
  // `activeParentType` to an arbitrary message so the candidate assembly and
  // the move bridge can resolve a target parent type without scanning.
  const parentTypeForMessage = useCallback(
    (messageId: string): ArgumentType | null => {
      const node = nodeByMessageId.get(messageId);
      const parentMsg = node && node.parentId ? messageById.get(node.parentId) : null;
      return (parentMsg?.argumentType ?? null) as ArgumentType | null;
    },
    [nodeByMessageId, messageById],
  );

  // REF-006-RAIL — the EXTRACTED active-node assembly body, parameterized by
  // `messageId` + `bannerSelection`. The active-node Referee Card memo and the
  // rail per-candidate builds share ONE code path (no duplicated gathering).
  // The active node passes its real `refereeBanner`; candidate nodes pass
  // `bannerSelection: null` (which keeps the candidate memo independent of
  // `activeMessageId` — candidate issues never depend on the active node
  // banner). Byte-equivalent to the prior inline body for the active node.
  const assembleRefereeCardInputForMessage = useCallback(
    (messageId: string, bannerSelection: BannerSelectionResult | null) => {
      const lifecycleSnapshot = lifecycleMap.byMessage.get(messageId) ?? null;
      const clusterId = lifecycleSnapshot?.clusterId ?? null;
      const clusterSummary = clusterId
        ? lifecycleMap.byCluster.get(clusterId) ?? null
        : null;
      const clusterMetadata = clusterId
        ? metadataLedger.byCluster.get(clusterId) ?? null
        : null;
      const moveLinkage = metadataLedger.byMessage.get(messageId) ?? null;

      // All debts attached to the node; the assembly helper OPEN-filters.
      const nodeDebts = getNodeEvidenceDebtSummary(messageId, evidenceDebts).debts;

      // Source-chain status — the worst evidence status of the cluster (a real
      // SourceChainStatus); null when no cluster summary exists.
      const sourceChainStatus = clusterSummary?.worstEvidenceStatus ?? null;

      // Side comparison vs the parent (off the stored rows). Conservative
      // `false` when either side is unknown — side alone never implies support.
      const activeMsg = messageById.get(messageId) ?? null;
      const parentMsg =
        activeMsg && activeMsg.parentId
          ? messageById.get(activeMsg.parentId) ?? null
          : null;
      const sameSideAsParent =
        activeMsg != null &&
        parentMsg != null &&
        activeMsg.side != null &&
        parentMsg.side != null &&
        activeMsg.side === parentMsg.side;

      // carriesSupportEvidence — has support artifacts AND is evidence-shaped.
      const artifacts = artifactsByMessageId[messageId] ?? [];
      const carriesSupportEvidence =
        artifacts.length > 0 && activeMsg?.argumentType === 'evidence';

      const manualTagEntries = manualTagsByMessageId.get(messageId) ?? [];
      const manualTagCodes = manualTagEntries.map((e) => e.code);
      const autoMetadataCodes =
        metadataLedger.byMessage
          .get(messageId)
          ?.autoDerivedMetadata.map((entry) => entry.code) ?? [];

      // Adapt the per-node marks at the PUBLIC `timeline_node` surface (already
      // Family-J-gated). Split machine-kind vs user-kind (REF-002 keeps
      // Observations and Allegations separate; the rail renders zero Allegations).
      const perNode = adaptAllSourcesForNode({
        manualTagEntries,
        autoMetadataCodes,
        clusterState: lifecycleSnapshot?.clusterState ?? 'open',
        messageContribution: lifecycleSnapshot?.messageContribution ?? null,
        messageId,
        persistedClassifierRows:
          persistedObservationsByArgumentId?.[messageId] ?? [],
        surface: 'timeline_node',
      });
      const machineObservationMarks = [
        ...perNode.autoMetadataMarks,
        ...perNode.lifecycleMarks,
        ...perNode.rawClassifierMarks,
      ];
      const userAllegationMarks = perNode.manualTagMarks;

      // Reserved / conservative suggestion inputs (the `SuggestionDerivationInput`
      // contract marks them "reserved"; zone 3 pads regardless).
      const node = nodeByMessageId.get(messageId) ?? null;
      const isOnSideBranch = node ? node.lane !== 0 : false;
      const isTangent =
        manualTagCodes.includes('tangent') ||
        autoMetadataCodes.includes('branch_suggested');
      const activePathDepth = node?.depth ?? 0;
      const isNoRebuttal =
        Boolean(lifecycleSnapshot?.opensRequest) ||
        autoMetadataCodes.includes('no_response_after_n_turns');

      return buildRefereeCardInput({
        roomId: debate.id,
        activeMessageId: messageId,
        storedArgumentType: (activeMsg?.argumentType ?? null) as ArgumentType | null,
        parentType: parentTypeForMessage(messageId),
        sameSideAsParent,
        carriesSupportEvidence,
        viewerRole: boardActRole,
        rules: constitution.activeRules,
        lifecycleSnapshot,
        clusterSummary,
        clusterMetadata,
        moveLinkage,
        openEvidenceDebts: nodeDebts,
        sourceChainStatus,
        manualTagCodes,
        autoMetadataCodes,
        machineObservationMarks,
        userAllegationMarks,
        bannerSelection,
        targetExcerpt: activeMsg?.body ?? null,
        quoteAnchor: null,
        isOnSideBranch,
        isTangent,
        activePathDepth,
        isNoRebuttal,
      });
    },
    [
      lifecycleMap,
      metadataLedger,
      evidenceDebts,
      artifactsByMessageId,
      manualTagsByMessageId,
      persistedObservationsByArgumentId,
      messageById,
      nodeByMessageId,
      boardActRole,
      constitution.activeRules,
      debate.id,
      parentTypeForMessage,
    ],
  );

  const refereeCardIssue = useMemo<DisagreementContract | null>(() => {
    if (!activeMessageId) return null;
    const assembled = assembleRefereeCardInputForMessage(activeMessageId, refereeBanner ?? null);
    if (!assembled) return null;
    return buildOpenIssue(assembled);
  }, [activeMessageId, assembleRefereeCardInputForMessage, refereeBanner]);

  // REF-006-RAIL — the candidate build (memoized on the data maps but NOT on
  // `activeMessageId`). Layer 1 is a cheap O(n) pre-filter (lifecycle / debt /
  // tag presence — no `buildOpenIssue`, no `adaptAllSourcesForNode`); only the
  // ≤ K most-recent survivors are assembled + built (each `bannerSelection:
  // null`, so the build never depends on the active node banner). Changing
  // the active node does NOT rebuild these issues.
  const openIssueCandidates = useMemo<{
    built: ReadonlyArray<{ issue: DisagreementContract; recencyIndex: number }>;
    omittedCandidateCount: number;
  }>(() => {
    // Layer 1 — cheap candidate pre-filter (a conservative superset).
    const candidateIds: string[] = [];
    for (const node of timelineMap.nodes) {
      const id = node.messageId;
      const hasOpenDebt = getNodeEvidenceDebtSummary(id, evidenceDebts).hasOpenDebt;
      const clusterState = lifecycleMap.byMessage.get(id)?.clusterState ?? 'open';
      const lifecycleOpen = !CLOSED_LIFECYCLE_STATES.has(clusterState);
      const manualCodes = (manualTagsByMessageId.get(id) ?? []).map((e) => e.code);
      const autoCodes =
        metadataLedger.byMessage.get(id)?.autoDerivedMetadata.map((e) => e.code) ?? [];
      const hasLiveTag =
        manualCodes.some((c) => CANDIDATE_SIGNAL_TAGS.has(c)) ||
        autoCodes.some((c) => CANDIDATE_SIGNAL_TAGS.has(c));
      if (hasOpenDebt || lifecycleOpen || hasLiveTag) candidateIds.push(id);
    }

    // Cap at the K most-recent candidates (recency = chronological position).
    const indexed = candidateIds.map((id) => ({
      id,
      recencyIndex: recencyIndexById.get(id) ?? -1,
    }));
    indexed.sort((a, b) => b.recencyIndex - a.recencyIndex);
    const capped = indexed.slice(0, OPEN_ISSUES_RAIL_BUILD_CAP);
    const omittedCandidateCount = indexed.length - capped.length;

    // Layer 1.5 — build each capped candidate OpenIssue (bannerSelection: null).
    const built: Array<{ issue: DisagreementContract; recencyIndex: number }> = [];
    for (const { id, recencyIndex } of capped) {
      const assembled = assembleRefereeCardInputForMessage(id, null);
      if (!assembled) continue;
      const issue = buildOpenIssue(assembled);
      if (issue) built.push({ issue, recencyIndex });
    }
    return { built, omittedCandidateCount };
  }, [
    timelineMap,
    evidenceDebts,
    lifecycleMap,
    manualTagsByMessageId,
    metadataLedger,
    recencyIndexById,
    assembleRefereeCardInputForMessage,
  ]);

  // REF-006-RAIL — the thin ledger overlay: apply the cheap `isActive` flag,
  // then filter (`isOpenIssue`) → order → cap → shape in the pure iterator.
  // Depends on `activeMessageId` (the cheap overlay) but NOT on the expensive
  // candidate build, so selection changes re-run only this O(K log K) pass.
  const openIssuesLedger = useMemo<OpenIssuesLedger>(() => {
    const candidates: OpenIssueLedgerCandidate[] = openIssueCandidates.built.map(
      ({ issue, recencyIndex }) => ({
        issue,
        recencyIndex,
        isActive: issue.targetNodeId === activeMessageId,
      }),
    );
    return buildOpenIssuesLedger(candidates, {
      maxEntries: OPEN_ISSUES_RAIL_BUILD_CAP,
      omittedCandidateCount: openIssueCandidates.omittedCandidateCount,
    });
  }, [openIssueCandidates, activeMessageId]);

  // "Acting on" label for the board-level Act mount. The composer
  // `composerActingOnModel.deriveComposerActingOnLabel` is the same
  // helper the UX-001.3 `ComposerContextStrip` consumes; reusing it
  // keeps the Act header and the composer compact strip synchronized.
  // `null` when no node is selected.
  const boardActActingOnLabel = useMemo<string | null>(() => {
    if (!activeMessageId) return null;
    const msg = sorted.find((m) => m.id === activeMessageId);
    if (!msg) return null;
    const bodyExcerpt = msg.body ? msg.body.slice(0, 80) : null;
    const parentTypeLabel = msg.argumentType ? msg.argumentType : null;
    const label = deriveComposerActingOnLabel({
      activeMessageId,
      parentArgumentId: activeMessageId,
      boxType: 'respond',
      parentBodyExcerpt: bodyExcerpt,
      parentTypeLabel,
    });
    return label.mainLabel;
  }, [activeMessageId, sorted]);

  // Inspect content — composed from the sidecar view-model the surface
  // already builds. Pure-TS builder; no backend.
  const inspectContent = useMemo(() => {
    return buildInspectContent({ sidecarViewModel });
  }, [sidecarViewModel]);

  // Inspect prev / next traversal — wraps the existing chronological
  // navigation. `null` at the ends (no wrap, per IX-003).
  const inspectHasPrev = useMemo(
    () => Boolean(getPreviousMessageId(chronologicalIds, activeMessageId)),
    [chronologicalIds, activeMessageId],
  );
  const inspectHasNext = useMemo(
    () => Boolean(getNextMessageId(chronologicalIds, activeMessageId)),
    [chronologicalIds, activeMessageId],
  );

  // Go mini-map model — built once per timelineMap change. Empty
  // collapse state (every branch expanded) matches the existing
  // behavior; BR-001 wiring is a separate follow-up.
  const goMiniMap = useMemo(
    () => buildTimelineMiniMapModel({ timelineMap }),
    [timelineMap],
  );
  // Full-coverage viewport window — the board-level Go mount does not
  // (yet) thread per-scroll viewport state through; a full-coverage
  // window keeps the mini-map region indicator faithful for now.
  const goViewportWindow = useMemo(
    () => ({ xStartFraction: 0, xEndFraction: 1, coversAll: true }),
    [],
  );

  // ── UX-001.4 — Menu presentation per band ──
  const actPresentation = useMemo(
    () => resolveMenuPresentation({
      band: menuBand,
      menu: 'act',
      windowWidth,
      windowHeight,
    }),
    [menuBand, windowWidth, windowHeight],
  );
  const inspectPresentation = useMemo(
    () => resolveMenuPresentation({
      band: menuBand,
      menu: 'inspect',
      windowWidth,
      windowHeight,
    }),
    [menuBand, windowWidth, windowHeight],
  );
  const goPresentation = useMemo(
    () => resolveMenuPresentation({
      band: menuBand,
      menu: 'go',
      windowWidth,
      windowHeight,
    }),
    [menuBand, windowWidth, windowHeight],
  );

  // ── UX-001.4 — Key-badge context (browser keyboard vs touch) ──
  const keyBadgeContext = useMemo(
    () => deriveMenuKeyBadgeContext({
      platformOs: Platform.OS as 'web' | 'ios' | 'android' | 'windows' | 'macos',
      windowWidth,
    }),
    [windowWidth],
  );
  const showKeyBadges = useMemo(
    () => resolveKeyBadgeVisibility({
      context: keyBadgeContext,
      reduceMotion: reduceMotionOverride === true,
    }),
    [keyBadgeContext, reduceMotionOverride],
  );

  const handleToggleMode = useCallback(() => {
    setMode((m) => toggleSurfaceMode(m));
    // UX-001.2 — Toggling Timeline / Cards is a meaningful interaction.
    setMicroMomentDismissed(true);
  }, []);

  // IX-004 — every explicit selection mutation (tap, Prev, Next, Latest,
  // Back-to-root, keyboard nav) marks the selection explicit so a
  // lingering stale-fallback banner is cleared the moment the user
  // moves on. Only the auto-snap on a vanished message stays in the
  // stale-fallback state.
  // UX-001.2 — Every explicit selection move also dismisses the
  // microMoment banner (transient on first meaningful interaction).
  const handleActivate = useCallback((id: string) => {
    setActiveMessageId(id);
    setSelectionStatus('explicit');
    setMicroMomentDismissed(true);
  }, []);
  // MARK-002 (#894) — deep-link a reply reference chip to its quoted source span.
  // Reuses the single selection path (setActiveMessageId) so the target card
  // activates and renders its source-span highlight in FULL body context (the Q5
  // mitigation). A no-op when the target is not in the loaded slice (graceful).
  const handleOpenMarkerSource = useCallback(
    (targetArgumentId: string, _markerId: string) => {
      if (loadedIdSet.has(targetArgumentId)) {
        setActiveMessageId(targetArgumentId);
        setSelectionStatus('explicit');
        setMicroMomentDismissed(true);
      }
    },
    [loadedIdSet],
  );
  // UX-SELECTED-NODE-001 (§6 / §9.3) — "Go to parent point". A READ-ONLY
  // navigation jump that selects the parent of the active node — the SAME
  // setActiveMessageId path the 005 rail "View in timeline" jump uses. No
  // routing-semantics change, no submit, no write. Returns early at the root
  // (no parent), where the affordance is not rendered anyway.
  const handleGoToParentPoint = useCallback(() => {
    if (!activeParentMessageId) return;
    setActiveMessageId(activeParentMessageId);
    setSelectionStatus('explicit');
    setMicroMomentDismissed(true);
  }, [activeParentMessageId]);
  const handlePrev = useCallback(() => {
    const prev = getPreviousMessageId(chronologicalIds, activeMessageId);
    if (prev) {
      setActiveMessageId(prev);
      setSelectionStatus('explicit');
      setMicroMomentDismissed(true);
    }
  }, [chronologicalIds, activeMessageId]);
  const handleNext = useCallback(() => {
    const next = getNextMessageId(chronologicalIds, activeMessageId);
    if (next) {
      setActiveMessageId(next);
      setSelectionStatus('explicit');
      setMicroMomentDismissed(true);
    }
  }, [chronologicalIds, activeMessageId]);
  // CARD-VIEW-REFINE-001 — Home / End in Stack mode jump to the oldest /
  // newest move chronologically (the stack is an ordered fan, not a DAG).
  const handleFirst = useCallback(() => {
    const first = chronologicalIds[0] ?? null;
    if (first && first !== activeMessageId) {
      setActiveMessageId(first);
      setSelectionStatus('explicit');
      setMicroMomentDismissed(true);
    }
  }, [chronologicalIds, activeMessageId]);
  const handleLast = useCallback(() => {
    const last = chronologicalIds[chronologicalIds.length - 1] ?? null;
    if (last && last !== activeMessageId) {
      setActiveMessageId(last);
      setSelectionStatus('explicit');
      setMicroMomentDismissed(true);
    }
  }, [chronologicalIds, activeMessageId]);

  // ASP-EXTRACT-001 (Slice 1) — the three timeline inline arrows and the
  // view-linked-prior-context arrow were lifted out of the mode === timeline
  // col1 branch into these named handlers so MapView can receive them as
  // props. Each body is copied verbatim from the former inline arrow; the
  // behavior is identical. UX-001.2 — meaningful Timeline interactions
  // dismiss the microMoment banner.
  const handleJumpLatest = useCallback(() => {
    if (latestId) {
      setActiveMessageId(latestId);
      setSelectionStatus('explicit');
      setMicroMomentDismissed(true);
    }
  }, [latestId]);
  const handleJumpToRoot = useCallback(() => {
    if (timelineMap.rootMessageId) {
      setActiveMessageId(timelineMap.rootMessageId);
      setSelectionStatus('explicit');
      setMicroMomentDismissed(true);
    }
  }, [timelineMap]);
  const handleOpenDetailsFromTimeline = useCallback((id: string) => {
    setActiveMessageId(id);
    setSelectionStatus('explicit');
    setMode('stack');
    setMicroMomentDismissed(true);
  }, []);
  // The View context action opens the Inspect popout, whose From the
  // linked prior argument section already exists. This is the smallest
  // sufficient affordance. If the room shell supplies its own handler it
  // takes precedence.
  const handleViewLinkedPriorContext = useCallback((linkId: string) => {
    if (onViewLinkedPriorContext) onViewLinkedPriorContext(linkId);
    else setInspectVisible(true);
  }, [onViewLinkedPriorContext]);

  const handleAction = useCallback((
    control: ArgumentBubbleControl,
    messageId: string,
    preset?: MoveDraftPatch | null,
  ) => {
    if (control === 'request_deletion') {
      setDeletionTarget(messageId);
      return;
    }
    onAction?.(control, messageId, preset);
  }, [onAction]);

  // REF-005 — bubble / popover control interceptor. The `flag` control opens
  // the structured Request-review composer (by setting the target message id)
  // instead of firing the loose handleAction flag notify; every other
  // control delegates to the existing handleAction path unchanged. Used by the
  // active-bubble chip cluster AND the timeline node popover (both previously
  // routed a bare `flag` straight to the host). `setRequestReviewTarget` is a
  // stable state setter, so it is not a hook dependency.
  const handleBubbleAction = useCallback((
    control: ArgumentBubbleControl,
    messageId: string,
    preset?: MoveDraftPatch | null,
  ) => {
    if (control === 'flag') {
      setRequestReviewTarget(messageId);
      return;
    }
    handleAction(control, messageId, preset);
  }, [handleAction]);

  // SC-004 — Dock action dispatch. Maps the 15-code SC-004 vocabulary onto
  // the existing handleAction path (which routes to the composer +
  // submit-argument Edge Function) plus the BR-001 / Cards-detail surface
  // toggles. Never inserts directly into public.arguments. Never invokes a
  // router.
  //
  // COMPOSER-001 — `narrow` / `confirm` / `synthesize` (and the other
  // composer-preset actions: `concede` / `clarify` / `add_evidence` /
  // `challenge` / `ask_source` / `ask_quote`) thread the
  // `actionDockToComposerPreset` result through the optional `preset`
  // argument on `handleAction`. The room shell uses the supplied preset
  // verbatim instead of recomputing one from the bubble control, so the
  // chosen scaffolding of the dock (e.g. `NARROW_PRESET_BODY`) lands in the
  // composer body field on mount. The user can still edit before submit.
  const handleActionDockAction = useCallback((
    action: TimelineNodeActionDockActionCode,
    target: TimelineNodeActionDockTarget,
  ) => {
    // Resolve a target message id for control dispatch. For cluster /
    // collapsed_stub targets we use the branchRoot.
    const targetMessageId =
      target.kind === 'node' ? target.messageId : target.branchRootMessageId;

    // COMPOSER-001 — Resolve the parent argumentType for the preset
    // computation. For node targets that is the own type of the message (the
    // composer treats the targeted message as its parent when replying);
    // for cluster / collapsed_stub targets we use the branch root type.
    // null is safe — the SC-004 preset bodies for narrow / confirm /
    // synthesize do not depend on parent type; only challenge does.
    const targetMsg = sorted.find((m) => m.id === targetMessageId) || null;
    const parentType = (targetMsg?.argumentType ?? null) as ArgumentType | null;
    const preset = actionDockToComposerPreset(action, target, parentType);

    if (action === 'open_cards_detail') {
      // Surface toggle — switch to Stack/Cards mode and activate the message.
      if (target.kind === 'node') {
        setActiveMessageId(targetMessageId);
        setSelectionStatus('explicit');
      }
      setMode('stack');
      setSelectedDockTarget(null);
      return;
    }
    if (action === 'expand_branch') {
      // BR-001 toggle is handled inside ArgumentTimelineMap via the
      // onExpandBranch prop. No room-shell action needed.
      setSelectedDockTarget(null);
      return;
    }
    if (action === 'flag') {
      // REF-005 — open the structured composer instead of the loose notify.
      setRequestReviewTarget(targetMessageId);
      return;
    }
    if (action === 'reply') {
      // `reply` produces no preset (composer opens with no forced type).
      handleAction('reply', targetMessageId, null);
      return;
    }
    if (action === 'challenge') {
      handleAction('disagree', targetMessageId, preset);
      return;
    }
    if (action === 'ask_source') {
      handleAction('ask_for_source', targetMessageId, preset);
      return;
    }
    if (action === 'ask_quote') {
      handleAction('ask_for_quote', targetMessageId, preset);
      return;
    }
    if (action === 'branch') {
      handleAction('branch', targetMessageId, null);
      return;
    }
    // COMPOSER-001 — narrow / concede / confirm / synthesize / clarify /
    // add_evidence have no dedicated bubble control. We dispatch through
    // `reply` (which opens the composer) but pass the
    // `actionDockToComposerPreset` patch via the optional third argument,
    // so the room shell threads the patch into `onComposerPreset` and the
    // composer applies it on mount.
    handleAction('reply', targetMessageId, preset);
  }, [handleAction, sorted]);

  // SC-004 — Open Cards-detail surface toggle. Never a router push.
  const handleOpenCardsDetail = useCallback((target: TimelineNodeActionDockTarget) => {
    const targetMessageId =
      target.kind === 'node' ? target.messageId : target.branchRootMessageId;
    setActiveMessageId(targetMessageId);
    setSelectionStatus('explicit');
    setMode('stack');
    setSelectedDockTarget(null);
  }, []);

  // Stage 6.4 — Action rail action dispatch. Routes rail-only codes
  // (join_aff, join_neg, share, open_timeline, watch) locally; bubble
  // controls reuse the existing handleAction path.
  const handleRailAction = useCallback((code: RailActionCode, ctx: { activeMessageId: string | null }) => {
    if (code === 'join_aff') { onJoinSide?.('affirmative'); return; }
    if (code === 'join_neg') { onJoinSide?.('negative'); return; }
    if (code === 'open_timeline') { if (mode !== 'timeline') setMode('timeline'); return; }
    if (code === 'watch') { /* no-op: observer stays observer */ return; }
    if (code === 'share') { onShareRoom?.(); return; }
    const ctrl = railActionToBubbleControl(code);
    if (ctrl && ctx.activeMessageId) handleAction(ctrl, ctx.activeMessageId);
  }, [onJoinSide, onShareRoom, mode, handleAction]);

  // ROOM-004 (#886) — J9. Answer this from the Map jumps to the Exchange lens
  // (setMode stack) and opens the composer scoped to the selected node
  // (handleAction reply). The Map selection id is preserved into Exchange, so
  // the flow is at most two taps: select the node, then Answer this. No new
  // write path; reuses the EXISTING handleAction reply route.
  const handleAnswerThisFromMap = useCallback(() => {
    if (!activeMessageId) return;
    setMode('stack');
    handleAction('reply', activeMessageId);
  }, [activeMessageId, handleAction]);

  // REF-004 — the SINGLE Act entry→box bridge. Extracted verbatim from the
  // board-Act `handleBoardActSelectBoxType` body so "Act changes the issue" is
  // ONE code path: `actEntryToQuickAction(entryId)` → `quickActionToPreset` →
  // the reply handleAction on the active message with the preset (the EXISTING
  // composer-open path; no submit, no new preset, no new fetch, no engine/role
  // gate call). A `null` quickAction (the non-padded `reply` /
  // `respond_to_concession` / `offer_concession` entries) opens the composer
  // with no forced preset — identical to the board Act path.
  // REF-006-RAIL — generalized with optional explicit target args. Existing
  // call sites pass no extra args → `targetMessageId`/`targetParentType` are
  // undefined → the active message fallback / `activeParentType` (byte-identical
  // behavior). The Open Issues rail passes an explicit target node + its
  // parent type so a move can open the composer on a NON-active node.
  const enterBoxForActEntry = useCallback(
    (entryId: ActEntryId, targetMessageId?: string, targetParentType?: ArgumentType | null) => {
      const messageId = targetMessageId ?? activeMessageId ?? '';
      const parentType = targetParentType !== undefined ? targetParentType : activeParentType;
      const quickAction = actEntryToQuickAction(entryId);
      const preset =
        quickAction !== null
          ? quickActionToPreset(quickAction as QuickActionLabel, parentType)
          : null;
      handleAction('reply', messageId, preset);
    },
    [activeMessageId, activeParentType, handleAction],
  );

  // UX-FLAGS-004 (#836) — the shared quick-action to reply-with-preset tail. Both
  // enterBoxForActEntry (above) and handleFlagIntent (below) reach the composer
  // through the SAME shipped handleAction('reply', messageId, preset) dispatch,
  // so a flag tap behaves exactly like the rail Ask-source tap.
  const enterBoxForQuickAction = useCallback(
    (quickAction: QuickActionLabel, messageId: string, parentType: ArgumentType | null) => {
      const preset = quickActionToPreset(quickAction, parentType);
      handleAction('reply', messageId, preset);
    },
    [handleAction],
  );

  // UX-FLAGS-004 (#836) — a feedback-flag pill tap. Resolves the flag key to its
  // composer intent (null for non-actionable / unknown => no-op) and opens the
  // composer pre-typed against the flagged move = the active node. The row / card
  // only receive this handler when the flag + actor gate below is satisfied, so
  // it never fires on the viewer own move or for an observer.
  const handleFlagIntent = useCallback(
    (flagKey: string) => {
      if (!activeMessageId) return;
      const resolved = flagIntentForKey(flagKey);
      if (!resolved) return;
      enterBoxForQuickAction(resolved.quickAction, activeMessageId, activeParentType);
    },
    [activeMessageId, activeParentType, enterBoxForQuickAction],
  );

  // UX-FLAGS-004 (#836) — the actor gate. Only a seated participant / host,
  // viewing another author active move, with the flag on, gets a live handler.
  // Otherwise undefined => inert pills (byte-identical). Both lenses fire the
  // SAME handler through the SAME handleAction (view is a lens, not a capability
  // gate). RingsideCard additionally applies its own per-card participant gate.
  const flagIntentHandler =
    feedbackFlagIntentsEnabled === true &&
    seatCanPostFlagIntent(participantSide) &&
    activeViewModel?.actor !== 'self'
      ? handleFlagIntent
      : undefined;

  // REF-003 → REF-004 — zone-3 next-move dispatch from the Referee Card, now
  // routed through the SAME `enterBoxForActEntry` bridge the board Act mount
  // uses (no parallel composer path). Recovery routes (`branch_tangent`,
  // engine-valid by construction) arrive here too and enter the engine-valid
  // branch box. The leaf `RefereeCardView.onMove` signature is unchanged
  // (REF-003 handler-swap contract).
  const handleRefereeMove = useCallback(
    (move: MoveSuggestion, _ctx: { activeMessageId: string | null }) => {
      enterBoxForActEntry(move.actEntryId);
    },
    [enterBoxForActEntry],
  );

  const handleDeletionSuccess = useCallback(() => {
    // Caller is responsible for re-fetching deletionRequestedMap; we just close.
    setDeletionTarget(null);
  }, []);

  // SC-005 — mutual exclusion between the side action rail dock and the
  // SC-002/SC-004 timeline node selection. Expanding the rail clears the
  // node-action target (one-open-at-a-time); selecting a node target
  // collapses the rail reactively via the `isAnyPanelOpen` prop the rail
  // already receives. This extends the existing single-owner pattern; it
  // adds no competing exclusion mechanism. (Implementer note: the design
  // floated a parent-owned `railExpanded` boolean — but the rail is the
  // source of truth for its own expansion, so the parent only needs to
  // clear the node target here and feed `isAnyPanelOpen` back. Carrying a
  // separate `railExpanded` state would be dead duplication.)
  const handleRailExpandedChange = useCallback((expanded: boolean) => {
    // REF-006-RAIL — also track the side rail expansion so the Open Issues
    // rail can mutually exclude it (two bottom rails never both expand).
    setSideRailExpanded(expanded);
    if (expanded) {
      setSelectedDockTarget(null);
      // VISUAL-SIMPLIFY-002 — the side action rail and an analysis surface must
      // never both own the screen. Expanding the rail dismisses any open
      // analysis surface (extending the shipped single-owner discipline).
      setActiveAnalysisSurface(null);
    }
  }, []);

  // VISUAL-SIMPLIFY-002 — summon (or dismiss) an on-demand analysis surface.
  // Toggle semantics: pressing the same trigger twice closes it. Opening any
  // surface also clears the node dock target (extends the existing exclusion),
  // so a summoned analysis surface and a node action dock never coexist. The
  // parent gate is the ONLY authority on whether the pane/sheet is mounted; the
  // child rails keep owning their own collapsed/expanded state for the
  // `isAnyPanelOpen` OR-terms.
  const handleOpenAnalysisSurface = useCallback((key: Exclude<AnalysisSurfaceKey, null>) => {
    setActiveAnalysisSurface((cur) => (cur === key ? null : key));
    setSelectedDockTarget(null);
    // VISUAL-SIMPLIFY-002 — summoning the Disagreement pane or the Mediator
    // readout also force-collapses the Open Issues rail so only one analysis
    // surface is expanded at a time (the selector is the single owner; the
    // rail keeps its own boolean in sync for the `isAnyPanelOpen` OR-terms).
    // NOTE: no apostrophes in this comment — the uxOneOneTwoDoctrine ban-list
    // scanner uses a naive quote-parity STRING_RE and a lone apostrophe here
    // flips string parsing for the rest of the file.
    if (key !== 'open_issues') setOpenIssuesRailExpanded(false);
  }, []);

  // VISUAL-SIMPLIFY-002 — the dismiss paths are: (a) pressing the same trigger
  // again (the toggle in `handleOpenAnalysisSurface`), (b) collapsing the
  // Disagreement rail via its own collapse control (routed through
  // `onExpandedChange(false)` → `setActiveAnalysisSurface(null)` on the mount),
  // and (c) opening the side action rail (`handleRailExpandedChange`). No
  // standalone close handler is needed.

  // REF-006-RAIL — the Open Issues rail expand/collapse coordinator. Mirrors
  // `handleRailExpandedChange`: expanding the Open Issues rail clears the node
  // dock target AND force-collapses the side action rail (via its
  // `isAnyPanelOpen` prop). Both rails stay collapsed-by-default.
  const handleOpenIssuesRailExpandedChange = useCallback((expanded: boolean) => {
    setOpenIssuesRailExpanded(expanded);
    if (expanded) {
      setSelectedDockTarget(null);
      // VISUAL-SIMPLIFY-002 — expanding the Open Issues rail claims the single
      // analysis-surface slot, so any other summoned analysis surface (the
      // Disagreement pane or the Mediator readout) unmounts. Collapsing it
      // releases the slot back to null.
      setActiveAnalysisSurface('open_issues');
    } else {
      setActiveAnalysisSurface((cur) => (cur === 'open_issues' ? null : cur));
    }
  }, []);

  // REF-006-RAIL — Open Issues rail "Go to point" (jump). Reuses the
  // `handleRefereeFocusIssue` mechanics for an ARBITRARY target node: set the
  // active node, switch to Timeline so the lens can dim, and apply the
  // issue state-derived Go lens. Reads ONLY the procedural IssueState.
  const handleOpenIssueFocus = useCallback(
    (entry: OpenIssueLedgerEntry) => {
      if (!entry.targetNodeId) return;
      setActiveMessageId(entry.targetNodeId);
      setSelectionStatus('explicit');
      setMicroMomentDismissed(true);
      if (mode !== 'timeline') setMode('timeline');
      setGoLens(issueStateToGoLens(entry.state));
    },
    [mode],
  );

  // UX-MEDIATOR-002 — chip-adjacent Inspect caret (O-2). Opens the SHIPPED
  // Inspect overlay for the ALREADY-active node (the chip shows the primary
  // state of the active node), reusing the same setInspectVisible plumbing the
  // Act/Inspect/Go dock and the Open Issues rail use. Mutual exclusion: closes
  // Act/Go first (single open popout). Read-only; never a submission gate.
  const handleNodeChipInspect = useCallback(() => {
    setBoardActVisible(false);
    setGoVisible(false);
    setInspectVisible(true);
  }, []);

  // REF-006-RAIL — Open Issues rail "Details" (Inspect). Sets the active node
  // and opens the SHIPPED Inspect popout; the `InspectOpenIssueDetail` sibling
  // overlay re-derives on the new active node. Read-only for every role.
  const handleOpenIssueInspect = useCallback((entry: OpenIssueLedgerEntry) => {
    if (!entry.targetNodeId) return;
    setActiveMessageId(entry.targetNodeId);
    setSelectionStatus('explicit');
    setInspectVisible(true);
  }, []);

  // REF-006-RAIL — Open Issues rail next-move chip. Routes through the SAME
  // `enterBoxForActEntry` bridge the board Act mount + Referee Card use, with
  // the row target node + its parent type. The move is an engine + role
  // survivor by construction (REF-002 `nextBestMoves`), so the composer can
  // never open a box the engine would reject.
  const handleOpenIssueMove = useCallback(
    (entry: OpenIssueLedgerEntry, move: MoveSuggestion) => {
      if (!entry.targetNodeId) return;
      setActiveMessageId(entry.targetNodeId);
      setSelectionStatus('explicit');
      enterBoxForActEntry(move.actEntryId, entry.targetNodeId, parentTypeForMessage(entry.targetNodeId));
    },
    [enterBoxForActEntry, parentTypeForMessage],
  );

  // ── UX-001.4 — Board menu callbacks ──
  //
  // The board-level Act mount routes box-opening entries through the
  // existing composer + draft-registry path (reuses the UX-001.3
  // quickActionPresets + actEntryToQuickAction). Direct entries route
  // through the existing `handleAction` callback the rail / dock
  // already use. Role-change entries route through `onJoinSide` or
  // stay no-op for `watch` / `chime_in` (the surface is
  // observer-by-default; explicit join is the only state change).
  // None of these introduces a new write path.

  const handleBoardActSelectBoxType = useCallback(
    (entryId: ActEntryId) => {
      // REF-004 — delegate to the shared `enterBoxForActEntry` bridge (the
      // extracted body: actEntryToQuickAction(entryId) → quickActionToPreset →
      // the reply handleAction on the active message with the preset), then close the
      // board Act menu. Behavior is byte-equivalent to the pre-REF-004 inline
      // body (the prior active-message conditional collapses to the same
      // active-message fallback).
      enterBoxForActEntry(entryId);
      setBoardActVisible(false);
    },
    [enterBoxForActEntry],
  );

  const handleBoardActDirectAction = useCallback(
    (entryId: ActEntryId) => {
      // Direct entries route through the existing handleAction path
      // the rail / dock already wire. `flag` / `view_qualifiers` /
      // `request_deletion` are the canonical bubble controls; the
      // other direct entries (`make_private`) are room-scoped and not
      // wired through this surface (DebateDetailHeader owns them).
      if (entryId === 'flag' && activeMessageId) {
        // REF-005 — open the structured composer instead of the loose notify.
        setRequestReviewTarget(activeMessageId);
      } else if (entryId === 'view_qualifiers' && activeMessageId) {
        handleAction('view_qualifiers', activeMessageId);
      } else if (entryId === 'request_deletion' && activeMessageId) {
        handleAction('request_deletion', activeMessageId);
      }
      // `make_private` is owned by DebateDetailHeader. The Act
      // popout role gate already filters this entry on the room
      // target; if it surfaces on a node it is a no-op.
      setBoardActVisible(false);
    },
    [activeMessageId, handleAction],
  );

  const handleBoardActRoleChange = useCallback(
    (entryId: ActEntryId) => {
      // Role-change entries route through onJoinSide (the existing
      // App.tsx wiring) for join_for / join_against; watch / chime_in
      // remain no-ops in this surface (the user is already an
      // observer; chime-in is a public-room seat operation owned by
      // GAME-005). The menu stays open so the host can re-open Act
      // after the seat change (design §3.6).
      if (entryId === 'join_for') {
        onJoinSide?.('affirmative');
      } else if (entryId === 'join_against') {
        onJoinSide?.('negative');
      }
      // Close after dispatch — the host can re-open via the trigger.
      setBoardActVisible(false);
    },
    [onJoinSide],
  );

  // Inspect → Act handoff. Closes Inspect (the chassis handles that
  // via its own onClose call after onHandoffToAct returns) and opens
  // Act on the SAME selected node. The actEntryId is surfaced via the
  // popout accessibility label; v1 does not scroll/focus the specific
  // entry inside Act (deferred per design §4.4).
  const handleInspectHandoffToAct = useCallback(
    (_entryId: ActEntryId) => {
      setInspectVisible(false);
      setBoardActVisible(true);
    },
    [],
  );

  // Go view / density / lens callbacks. View toggle ↔ mode (Cards /
  // Timeline). Density is owned upstream (PR-001) — the Go density
  // entries are present but currently no-ops (the host already
  // controls density via the props). Lens is local to the surface.
  const handleGoJump = useCallback(
    (target: GoJumpTarget) => {
      if (target === 'root' && timelineMap.rootMessageId) {
        setActiveMessageId(timelineMap.rootMessageId);
        setSelectionStatus('explicit');
        setMicroMomentDismissed(true);
      } else if (target === 'latest' && latestId) {
        setActiveMessageId(latestId);
        setSelectionStatus('explicit');
        setMicroMomentDismissed(true);
      }
      // hot_zone / branch_list / leave_room — leave_room is handled
      // by the GoPopout directly via the onLeaveRoom prop; hot_zone /
      // branch_list are advisory in v1 (no host wiring yet).
      setGoVisible(false);
    },
    [latestId, timelineMap.rootMessageId],
  );

  // REF-004 — Inspect handoff. Opens the EXISTING Inspect popout on the active
  // node; the InspectOpenIssueDetail sibling overlay (gated on inspectVisible +
  // the active issue) then renders the full detail of the issue + its Inspect-only
  // raw provenance. Read-only for every role (no Act routing fires here).
  const handleRefereeInspect = useCallback(() => {
    setInspectVisible(true);
  }, []);

  // REF-004 — Go handoff. Jumps to the target node of the issue and focuses the
  // board by the state-derived lens of the issue (`issueStateToGoLens`). A lens DIMS
  // timeline nodes, so the board is switched to timeline view first; the lens
  // can never hide a node (shipped applyTimelineLens has no hidden emphasis).
  // The affordance hides when `targetNodeId == null`, so this is never reached
  // with a null target — the guard is defensive. Reads ONLY the procedural
  // IssueState (no heat / popularity / strength signal).
  const handleRefereeFocusIssue = useCallback(() => {
    const issue = refereeCardIssue;
    if (issue == null || issue.targetNodeId == null) return;
    // Jump half — the existing activation path (mirrors handleGoJump).
    setActiveMessageId(issue.targetNodeId);
    setSelectionStatus('explicit');
    setMicroMomentDismissed(true);
    // A lens dims TIMELINE nodes — the board must be in timeline view to read.
    if (mode !== 'timeline') setMode('timeline');
    // Filter half — the existing setGoLens path the GoPopout onSelectLens uses.
    setGoLens(issueStateToGoLens(issue.state));
  }, [refereeCardIssue, mode]);

  // REF-004 — thin dispatcher threading the two non-Act verbs through the
  // single `onRefereeNavigate` prop the plumbing chain carries.
  const handleRefereeNavigate = useCallback(
    (verb: RefereeNavVerb, _ctx: { activeMessageId: string | null }) => {
      if (verb === 'inspect') handleRefereeInspect();
      else handleRefereeFocusIssue();
    },
    [handleRefereeInspect, handleRefereeFocusIssue],
  );

  // ── UX-001.4 — A / I / G keyboard handler (web only) ──
  //
  // Pure-TS resolver decides the effect; the host dispatches. The
  // composerFocused check is read indirectly via the keyboard
  // resolver input — `useComposerFocusContext` lives on the
  // composer side, so this surface uses a simpler signal: the
  // composer is "focused" when an open menu is NOT the cause and a
  // text input has focus. Since this surface does not host the
  // composer, the conservative default is to treat the board as
  // focused when the surface itself is mounted; the own shortcut
  // handler of the composer already returns none when it is not focused, so
  // the only collision is a TextInput inside the surface (none in v1).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined' || !document.addEventListener) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      // The composer focus context lives in ArgumentComposerDock.
      // This handler runs at the surface level; we approximate
      // composerFocused by checking if the focused element is a
      // text input / contenteditable (the composer TextInput is
      // the only such element rendered while the room is mounted).
      const activeEl = document.activeElement as HTMLElement | null;
      const composerFocused =
        !!activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable === true);
      const hasOpenMenu = boardActVisible || inspectVisible || goVisible;
      const effect = resolveBoardMenuKeyEffect({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        composerFocused,
        hasOpenMenu,
      });
      switch (effect.type) {
        case 'open_act':
          event.preventDefault();
          // Menu mutual exclusion — close other menus first.
          setInspectVisible(false);
          setGoVisible(false);
          setBoardActVisible(true);
          return;
        case 'open_inspect':
          event.preventDefault();
          setBoardActVisible(false);
          setGoVisible(false);
          setInspectVisible(true);
          return;
        case 'open_go':
          event.preventDefault();
          setBoardActVisible(false);
          setInspectVisible(false);
          setGoVisible(true);
          return;
        case 'close_open_menu':
          event.preventDefault();
          setBoardActVisible(false);
          setInspectVisible(false);
          setGoVisible(false);
          return;
        case 'none':
        default:
          return;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [boardActVisible, inspectVisible, goVisible]);

  // ── CARD-VIEW-REFINE-001 — Stack-mode ←/→ (+ Home/End) keyboard nav ──
  //
  // Document-level keydown ACTIVE ONLY in Stack (Cards) mode (mode === stack)
  // so it never double-fires with the own ArrowLeft/Right handler of the Timeline.
  // ArrowLeft → previous (older) move; ArrowRight → next (newer) move;
  // Home/End → oldest/newest. Chronological prev/next is correct for the
  // stack — this deliberately does NOT use the Timeline DAG navigation.
  //
  // Bails (→ no-op) when the composer (a focused TextInput / contentEditable)
  // owns the keystroke OR a board menu/overlay is open — the pure resolver
  // encodes both guards. This is a plain document listener (NOT a router); the
  // composerDockNoRoute / inRoomNoRoute invariants hold (no navigation import).
  useEffect(() => {
    if (mode !== 'stack') return;
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined' || !document.addEventListener) return;
    const handleStackKeyDown = (event: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const composerFocused =
        !!activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable === true);
      const hasOpenMenu = boardActVisible || inspectVisible || goVisible;
      const effect = resolveStackKeyEffect({
        key: event.key,
        composerFocused,
        hasOpenMenu,
      });
      switch (effect) {
        case 'prev':
          event.preventDefault();
          handlePrev();
          return;
        case 'next':
          event.preventDefault();
          handleNext();
          return;
        case 'first':
          event.preventDefault();
          handleFirst();
          return;
        case 'last':
          event.preventDefault();
          handleLast();
          return;
        case 'none':
        default:
          return;
      }
    };
    document.addEventListener('keydown', handleStackKeyDown);
    return () => document.removeEventListener('keydown', handleStackKeyDown);
  }, [
    mode,
    boardActVisible,
    inspectVisible,
    goVisible,
    handlePrev,
    handleNext,
    handleFirst,
    handleLast,
  ]);

  // META-1A — Persisted manual-tag write path. These route through the
  // apply-manual-tag Edge Function (the single write path; never a direct
  // client insert) and refresh the room on success so the persisted tag
  // hydrates the metadata ledger. No tag-apply UI control is wired yet —
  // SC-004 / the TimelineNodeActionDock tag affordance is a thin follow-up
  // card (the META-1A acceptance criterion "UI reflects persisted state" is
  // met by the read path above). These callbacks are exposed so that
  // follow-up control can call them without re-plumbing the Edge Function.
  const handleApplyManualTag = useCallback(async (
    messageId: string,
    tagCode: ManualTagCode,
  ): Promise<ApplyManualTagResult> => {
    const result = await applyManualTag({
      debateId: debate.id,
      argumentId: messageId,
      tagCode,
    });
    if (result.ok) _onRefresh?.();
    return result;
  }, [debate.id, _onRefresh]);

  const handleRemoveManualTag = useCallback(async (
    messageId: string,
    tagCode: ManualTagCode,
  ): Promise<ApplyManualTagResult> => {
    const result = await removeManualTag({
      debateId: debate.id,
      argumentId: messageId,
      tagCode,
    });
    if (result.ok) _onRefresh?.();
    return result;
  }, [debate.id, _onRefresh]);
  // Referenced here so the exposed write-path callbacks are retained until
  // the follow-up tag-apply control is wired. (Read path is already live.)
  void handleApplyManualTag;
  void handleRemoveManualTag;

  return (
    // UX-BOARD-RAIL-002 — the room shell is now a band-driven 1 / 2 / 3-column
    // board. RoomBoardLayout is a PURE flex grid: it places the already-built
    // subtrees below into column slots. Every `<Component …>` JSX subtree stays
    // TEXTUALLY inside this `return` (passed as element children), so every
    // testID / handler / prop-wire substring the source-scan suites read stays
    // in this file. The single mediator-board derivation (above) is consumed by
    // all columns and never re-derived. On phone the wrapper renders one
    // vertical column (byte-identical to today); the col3 rail is a collapsed
    // bottom sheet (presentation sheet). On tablet/wide the rail docks as a
    // persistent pane. col1 JSX is emitted BEFORE col2 JSX in source order
    // (uxOneOneTwoChromeLayerRemovals indexOf pins).
    <RoomBoardLayout
      band={headerBand}
      accessibilityLabel="argument-game-surface"
      testID="argument-game-surface"
      topBanner={
        <>
          {/* ROOM-001 (#876) — ambient state rail ABOVE the microMoment, gated
              behind room_exchange_v2 (flag OFF => never mounted, topBanner
              byte-identical). Deep-links are in-app state jumps (never a route).
              */}
          {roomExchangeV2Enabled ? (
            <ArgumentStateRail
              model={stateRailModel}
              onOpenMap={() => {
                if (mode !== 'timeline') setMode('timeline');
              }}
              onOpenDebts={() => handleOpenAnalysisSurface('disagreement')}
              onOpenRoomDetails={onOpenRoomDetails}
              reduceMotion={reduceMotionOverride === true}
            />
          ) : null}
          {/* UX-001.2 — microMoment banner. Repositioned out of the old
              ArgumentGameSurface.header (which was deleted) so it now sits
              directly under the AppHeader + compact strip. The banner is
              transient: it dismisses on the first meaningful Timeline
              interaction (handleActivate / handlePrev / handleNext /
              handleToggleMode / onJumpLatest / onJumpToRoot). The visual
              treatment, copy, accessibility behavior, and triggering logic
              are unchanged from QOL-040.3 — only the persistence model is
              updated. A new entryHint re-shows the banner. */}
          {entryHint?.verbPhrase && !microMomentDismissed ? (
          <View
            style={styles.microMoment}
            testID="argument-micro-moment"
            accessibilityLabel={
              entryHint.helperLine && entryHint.helperLine !== entryHint.verbPhrase
                ? `${entryHint.verbPhrase}. ${entryHint.helperLine}`
                : entryHint.verbPhrase
            }
          >
            <Text style={styles.microMomentText}>{entryHint.verbPhrase}</Text>
            {entryHint.helperLine && entryHint.helperLine !== entryHint.verbPhrase ? (
              <Text style={styles.microMomentHelper}>{entryHint.helperLine}</Text>
            ) : null}
          </View>
          ) : null}
        </>
      }
      col1={
        // col1 — the argument path (spine). Both body modes: the bubble stack
        // (+ participant bubble actions) OR the horizontal timeline map. The
        // supporting panels (readout / score / chip / composer) move into col2
        // below; on phone the single-column wrapper re-stacks them directly
        // beneath this body, preserving the vertical order used today.
        <View style={styles.body}>
          {mode === 'stack' ? (
          // ASP-EXTRACT-001 (Slice 2) — the mode === stack body is now the
          // ExchangeView lens. Every value is forwarded verbatim as a prop;
          // the ArgumentBubbleStack sub-tree and the conditional participant
          // ArgumentBubbleActions moved into ExchangeView unchanged, so the
          // rendered output is byte-identical to the former inline branch.
          // The styles.body wrapper stays here (a RoomBoardLayout col1
          // concern), so the slot tree is unchanged. The observer gate on the
          // action chips moved with the JSX into ExchangeView.
          <ExchangeView
            viewModels={viewModels}
            activeMessageId={activeMessageId}
            onActivate={handleActivate}
            onPrevious={handlePrev}
            onNext={handleNext}
            onToggleMode={handleToggleMode}
            activeCardDetail={activeCardDetail}
            activeMappingSection={activeMappingSection}
            onActivateAncestor={handleActivate}
            windowWidth={windowWidth}
            viewerRole={resolvedViewerRole}
            onRailAction={handleRailAction}
            activeRefereeCard={refereeCardIssue}
            onRefereeMove={handleRefereeMove}
            onRefereeNavigate={handleRefereeNavigate}
            pointFeedbackFlags={activePointFeedbackFlags}
            activeViewModel={activeViewModel}
            onBubbleAction={handleBubbleAction}
            // UX-FLAGS-004 (#836) — Ringside flag-intent handler. Undefined unless
            // the flag + actor gate is met; RingsideCard additionally applies its
            // per-card participant gate (parity with the FEEDBACK-001 ghost bar).
            onFlagIntent={flagIntentHandler}
            // ROOM-002 (#885) — flag-on Ringside re-weight. ringsideFeed is null
            // when the flag is off, so ExchangeView renders the stack subtree
            // byte-identical. onOpenMap forces the Map lens for branch-pill
            // deep-links; reduceMotion is threaded for symmetry.
            roomExchangeV2Enabled={roomExchangeV2Enabled}
            ringsideFeed={ringsideFeed}
            onOpenMap={() => setMode('timeline')}
            reduceMotion={reduceMotionOverride === true}
            // MARK-002 (#894) — marker maps + callbacks. Empty maps + undefined
            // callbacks when the flag is off => the Ringside cards render
            // byte-identically. onRespondToThis is only wired when the flag is on.
            markersByTargetId={markersByTargetId}
            markersByReplyId={markersByReplyId}
            isMarkerTargetLoaded={isMarkerTargetLoaded}
            onRespondToThis={timestampRebuttalsEnabled ? handleRespondToThis : undefined}
            onOpenMarkerSource={timestampRebuttalsEnabled ? handleOpenMarkerSource : undefined}
            // FEEDBACK-001 (#898) — the ghost feedback bar props for the Ringside
            // active card. All undefined when the flag is off => byte-identical.
            moveMarksEnabled={moveMarksEnabled}
            viewerMoveMarksFor={moveMarksEnabled ? moveMarks.viewerMoveMarksFor : undefined}
            moveMarkErrorFor={moveMarksEnabled ? moveMarks.moveMarkErrorFor : undefined}
            showMoveMarkReceiptsFor={moveMarksEnabled ? showMoveMarkReceiptsFor : undefined}
            onMarkMove={moveMarksEnabled ? moveMarks.onMark : undefined}
            onUnmarkMove={moveMarksEnabled ? moveMarks.onUnmark : undefined}
            // QUOTE-FORGE-002 (#842) — the active-card woven-callback echo +
            // open-prior-room nav. Null map (quote_forge off) => byte-identical.
            activeCallbackEcho={
              activeMessageId ? callbackEchoByMessageId?.[activeMessageId] ?? null : null
            }
            onOpenPriorRoom={onOpenPriorRoom}
          />
        ) : (
          // ASP-EXTRACT-001 (Slice 1) — the mode === timeline body is now the
          // MapView lens. Every prop is forwarded verbatim; the three former
          // inline arrows (jump-latest / jump-to-root / open-details) and the
          // view-linked-prior-context arrow were lifted to named orchestrator
          // handlers above and are passed here already-bound. Behavior is
          // byte-identical to the former inline branch. The styles.body
          // wrapper stays here (a RoomBoardLayout col1 concern), so the slot
          // tree is unchanged.
          <MapView
            map={timelineMap}
            onActivate={handleActivate}
            onPrev={handlePrev}
            onNext={handleNext}
            onJumpLatest={handleJumpLatest}
            onJumpToRoot={handleJumpToRoot}
            onToggleMode={handleToggleMode}
            activeViewModel={activeViewModel}
            totalCount={timelineMap.nodes.length}
            onAction={handleBubbleAction}
            onOpenDetails={handleOpenDetailsFromTimeline}
            artifactsByMessageId={artifactsByMessageId}
            evidenceContractFor={evidenceContractFor}
            evidenceDebtSummaryFor={evidenceDebtSummaryFor}
            isReadModeViewer={resolvedViewerRole === 'observer'}
            selectedTarget={selectedDockTarget}
            // ROOM-004 (#886) — SC-004 node-dock supersession. Under flag-on,
            // a node selection hands the dock to null so the ROOM-004 popover
            // is the single node-action surface; cluster / collapsed_stub
            // targets keep the dock (expand_branch preserved). Flag-off passes
            // dockModel unchanged, so the SC-004 dock is byte-identical.
            actionDockModel={
              roomExchangeV2Enabled && selectedDockTarget?.kind === 'node' ? null : dockModel
            }
            actingOnLabel={timelineReadoutViewModel.actingOnShortLabel}
            onSelectTarget={setSelectedDockTarget}
            onActionDockAction={handleActionDockAction}
            onOpenCardsDetail={handleOpenCardsDetail}
            reduceMotionOverride={reduceMotionOverride}
            callbackEchoByMessageId={callbackEchoByMessageId}
            linkedPriorChips={linkedPriorChips}
            onOpenLinkedPrior={onOpenLinkedPrior}
            onViewLinkedPriorContext={handleViewLinkedPriorContext}
            onOpenLinkPicker={onOpenLinkPicker}
            // ROOM-004 (#886) — the node action popover surface + its bindings.
            // R1 mirroring: onPopoverControl dispatches participant controls
            // through the SAME handleBubbleAction the Ringside card uses, and
            // onPopoverAction dispatches observer codes through the SAME
            // handleRailAction the Exchange rail uses (parity handler identity
            // on BOTH paths). onAnswerThis is the J9 jump; onPopoverClose clears
            // the node selection (matches the dock dismissal). Absent surface
            // => nothing new renders.
            nodeActionPopover={mapNodeActionSurface}
            onPopoverControl={(control) => {
              if (activeMessageId) handleBubbleAction(control, activeMessageId);
            }}
            onPopoverAction={(code) => handleRailAction(code, { activeMessageId })}
            onAnswerThis={handleAnswerThisFromMap}
            onPopoverOpenDetails={
              activeMessageId ? () => handleOpenDetailsFromTimeline(activeMessageId) : undefined
            }
            onPopoverClose={() => setSelectedDockTarget(null)}
            // FEEDBACK-001 (#898) — the SAME ghost feedback bar props for the Map
            // node popover (parity). All undefined when the flag is off =>
            // byte-identical.
            moveMarksEnabled={moveMarksEnabled}
            viewerMoveMarksFor={moveMarksEnabled ? moveMarks.viewerMoveMarksFor : undefined}
            moveMarkErrorFor={moveMarksEnabled ? moveMarks.moveMarkErrorFor : undefined}
            showMoveMarkReceiptsFor={moveMarksEnabled ? showMoveMarkReceiptsFor : undefined}
            onMarkMove={moveMarksEnabled ? moveMarks.onMark : undefined}
            onUnmarkMove={moveMarksEnabled ? moveMarks.onUnmark : undefined}
          />
        )}
        </View>
      }
      col2={
        // col2 — the supporting panels for the active node. These render only
        // in Timeline mode (unchanged: Stack mode surfaces this detail in the
        // active card itself). On phone the single-column wrapper places this
        // immediately below the col1 body; on tablet they ride in the left
        // spine; on wide they own the middle column. The JSX is MOVED, not
        // changed — same props, same handlers, same testIDs. col2 JSX is
        // emitted AFTER the col1 ArgumentTimelineMap in source order, so the
        // uxOneOneTwoChromeLayerRemovals indexOf pins (TimelineMap before
        // ScoreTracker / Readout) still hold.
        mode === 'timeline' ? (
          <>
            {/* UX-001.2 — Compact selected-message readout below the
                Timeline. IX-004's accessibilityLiveRegion + selection
                announcement + stale-banner behavior are preserved
                verbatim inside the panel; the `compact` prop renders
                the 5-line summary plus an expand trigger that opens the
                6-section sidecar inline. */}
            <TimelineSelectedReadoutPanel
              viewModel={timelineReadoutViewModel}
              compact
              onGoToParent={activeParentMessageId ? handleGoToParentPoint : undefined}
            />
            {/* UX-FLAGS-002 — small calm row of point-level friendly feedback
                flags for the active node. Renders NOTHING when there are no
                flags (the default room stays visually calm). Derived
                POST-STORAGE above from the active node's persisted MCP rows,
                routed through the #850 descriptor layer, then capped to <= 3 by
                the #835 priority module; no composer wiring. */}
            <PointFeedbackFlagsRow
              flags={activePointFeedbackFlags.visible}
              suppressedCount={activePointFeedbackFlags.suppressedCount}
              // UX-FLAGS-004 (#836) — undefined unless the flag + actor gate is
              // met => inert pills (byte-identical). The reply targets the active
              // node = the flagged move.
              onFlagIntent={flagIntentHandler}
            />
            {/* FEEDBACK-002 (#899) — calm derived-signal advisory lines for the
                active node, composed at display time over the derived signals.
                Empty (flag off / no active-node signal) => renders null =>
                byte-identical. Never a verdict, never a submit gate. */}
            <DerivedSignalAdvisoryLines lines={inspectAdvisoryLines} />
            {/* ROOM-004 (#886) — the low-density sidecar deep-link footer.
                Mounts AFTER the reused readout + flags (never before MapView),
                gated on room_exchange_v2 + a supplied surface. Answer this is
                the J9 jump; Open disagreement points reuses the existing
                analysis toggle. Flag-off => not mounted, col2 byte-identical. */}
            {roomExchangeV2Enabled && mapNodeActionSurface ? (
              <MapNodeSidecarLinks
                surface={mapNodeActionSurface}
                onAnswerThis={handleAnswerThisFromMap}
                onOpenDebts={() => handleOpenAnalysisSurface('disagreement')}
                reduceMotion={reduceMotionOverride === true}
                // MARK-002 (#894) — reply chips for the active node (parity with
                // the Ringside card). Empty when the flag is off => byte-identical.
                replyMarkersForActiveNode={
                  activeMessageId ? markersByReplyId[activeMessageId] : undefined
                }
                isMarkerTargetLoaded={isMarkerTargetLoaded}
                onOpenMarkerSource={timestampRebuttalsEnabled ? handleOpenMarkerSource : undefined}
              />
            ) : null}
            {/* UX-FEEDBACK-001 — default-visible STATIC current-state cue near
                the selected-node responding-to anchor. "Point anchored." is a
                local ephemeral acknowledgement that the response is bound to a
                non-root point — read-only, no persistence, no rating, no
                transition. Renders nothing for root / no selection (the helper
                returns null). The reward is clarity, not applause. */}
            <MediatorProgressNote
              note={activeNodeProgressSelectionNote}
              testID="mediator-progress-note-selection"
            />
            {/* UX-001.2 — Score tracker repositioned below the Timeline
                (was above). The component itself is unchanged — only
                its mount site moves.
                VISUAL-SIMPLIFY-002 — the readout is now ON-DEMAND: it mounts
                only when the "Mediator readout" analysis surface is summoned.
                The default room view leads with the conversation, so the always-
                on readout is gone from the default line of sight. The JSX
                substring `<ArgumentScoreTracker trends={participantTrends} />`
                is preserved byte-identical inside the ternary (mount-site pins
                on uxOneOneTwoChromeLayerRemovals hold). */}
            {activeAnalysisSurface === 'readout' ? (
              <ArgumentScoreTracker trends={participantTrends} />
            ) : null}
            {/* UX-MEDIATOR-002 — ONE primary state chip per node (default
                view). The compact node-level mediator marker for the active
                node, projected through v4DisplayStateFor (the UX-MEDIATOR-001
                v4 nine-state vocabulary). Read-only, exactly one primary state
                (priority-selected ONCE from the already-derived board
                markupByNodeId — single-derivation invariant), suppressed for
                ordinary open/resolved nodes. The old NodeLabelStrip
                second-chip surface (Observation/Allegation chips + overflow)
                is UNMOUNTED here — its content is relocated into the existing
                Inspect overlay (NodeLabelInspectGroups) so the default view
                shows one state + one move, not chip soup. A chip-adjacent
                Inspect caret (O-2) opens that detail one tap away; it renders
                only when there IS a chip. The chip itself stays non-interactive
                (a read-only text badge); the caret carries the button role +
                a 44x44 target. Self-hides entirely when no actionable state. */}
            {activeNodeMediatorMarker ? (
              <View style={styles.nodeChipRow} testID="mediator-node-chip-row">
                <MediatorNodeMarker
                  marker={activeNodeMediatorMarker}
                  testID="mediator-node-marker-active"
                />
                <Pressable
                  onPress={handleNodeChipInspect}
                  accessibilityRole="button"
                  accessibilityLabel="Inspect this point"
                  accessibilityHint="Opens the full mediator state, machine observations and user allegations for this point."
                  accessibilityState={{ expanded: inspectVisible }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.nodeChipInspectCaret}
                  testID="mediator-node-inspect-caret"
                >
                  <Text style={styles.nodeChipInspectCaretText}>Inspect</Text>
                </Pressable>
              </View>
            ) : null}
            {/* UX-001.3 — Persistent collapsed-composer strip. Sits
                below the score tracker so the user always sees what
                the next compose action would act on. Mounts only when
                the parent supplies `onComposerExpand` (room-active
                only). The strip's height (56 / 64 / 72 px per band)
                lives BELOW the Timeline and contributes ZERO to the
                first-row offset — UX-001.2's caps are unaffected. */}
            {onComposerExpand ? (
              <CollapsedComposerStrip
                boxType={composerStripBoxType}
                parentArgument={composerStripParent}
                resolution={composerResolution ?? null}
                onExpand={onComposerExpand}
              />
            ) : null}
          </>
        ) : null
      }
      col2Footer={
        <>
      {/* UX-001.4 — Board-level Act / Inspect / Go trigger row. Sits
          between the Timeline body and the side-action rail. A small,
          unobtrusive row of three buttons; on browser viewports it
          shows the A / I / G key badges. On native / touch viewports
          the badges are hidden but the buttons remain tappable. The
          three buttons share the same accessibility pattern (button
          role + descriptive label + a11y state). */}
      <View style={styles.menuTriggerRow} testID="board-menu-trigger-row">
        <Pressable
          onPress={() => {
            setInspectVisible(false);
            setGoVisible(false);
            setBoardActVisible((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityLabel={
            showKeyBadges
              ? 'Open Act menu. Keyboard shortcut: A.'
              : 'Open Act menu'
          }
          accessibilityState={{ expanded: boardActVisible }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.menuTriggerButton, styles.menuTriggerButtonDominant]}
          testID="board-menu-trigger-act"
        >
          <Text style={[styles.menuTriggerLabel, styles.menuTriggerLabelDominant]}>Act</Text>
          {showKeyBadges ? (
            <View style={styles.menuTriggerBadge}>
              <Text
                style={styles.menuTriggerBadgeText}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                A
              </Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => {
            setBoardActVisible(false);
            setGoVisible(false);
            setInspectVisible((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityLabel={
            showKeyBadges
              ? 'Open Inspect menu. Keyboard shortcut: I.'
              : 'Open Inspect menu'
          }
          accessibilityState={{ expanded: inspectVisible }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.menuTriggerButton}
          testID="board-menu-trigger-inspect"
        >
          <Text style={styles.menuTriggerLabel}>Inspect</Text>
          {showKeyBadges ? (
            <View style={styles.menuTriggerBadge}>
              <Text
                style={styles.menuTriggerBadgeText}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                I
              </Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => {
            setBoardActVisible(false);
            setInspectVisible(false);
            setGoVisible((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityLabel={
            showKeyBadges
              ? 'Open Go menu. Keyboard shortcut: G.'
              : 'Open Go menu'
          }
          accessibilityState={{ expanded: goVisible }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.menuTriggerButton}
          testID="board-menu-trigger-go"
        >
          <Text style={styles.menuTriggerLabel}>Go</Text>
          {showKeyBadges ? (
            <View style={styles.menuTriggerBadge}>
              <Text
                style={styles.menuTriggerBadgeText}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                G
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* VISUAL-SIMPLIFY-002 — calm, plain-language on-demand analysis triggers.
          The default room view leads with the conversation; these three
          verdict-free buttons summon the deep-analysis surfaces one tap away and
          dismiss them again (toggle). Each carries a text label (color is never
          the sole signal), a descriptive accessibilityLabel, an
          accessibilityState.expanded reflecting whether its surface is mounted,
          and a ≥44 px target (menuTriggerButton minHeight 44 + hitSlop). No new
          animation — the surfaces snap mount/unmount (reduce-motion safe). */}
      <View style={styles.analysisTriggerRow} testID="board-analysis-trigger-row">
        <Pressable
          onPress={() => handleOpenAnalysisSurface('disagreement')}
          accessibilityRole="button"
          accessibilityLabel="Open disagreement points"
          accessibilityHint="Shows the room's live disagreement points. Opens on request; hidden by default."
          accessibilityState={{ expanded: activeAnalysisSurface === 'disagreement' }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.menuTriggerButton}
          testID="board-menu-trigger-disagreement"
        >
          <Text style={styles.menuTriggerLabel}>{DISAGREEMENT_POINTS_RAIL_COPY.title}</Text>
        </Pressable>
        <Pressable
          onPress={() => handleOpenAnalysisSurface('open_issues')}
          accessibilityRole="button"
          accessibilityLabel="Open the open issues list"
          accessibilityHint="Shows points that need a source, a quote, a reply, or are ready to wrap up. Opens on request; hidden by default."
          accessibilityState={{ expanded: activeAnalysisSurface === 'open_issues' }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.menuTriggerButton}
          testID="board-menu-trigger-openissues"
        >
          <Text style={styles.menuTriggerLabel}>{OPEN_ISSUES_RAIL_COPY.railTitle}</Text>
        </Pressable>
        <Pressable
          onPress={() => handleOpenAnalysisSurface('readout')}
          accessibilityRole="button"
          accessibilityLabel="Open mediator readout"
          accessibilityHint="Shows the mediator readout for the room. Opens on request; hidden by default."
          accessibilityState={{ expanded: activeAnalysisSurface === 'readout' }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.menuTriggerButton}
          testID="board-menu-trigger-readout"
        >
          <Text style={styles.menuTriggerLabel}>Mediator readout</Text>
        </Pressable>
      </View>

      {/* UX-001.4 — Board-level Act popout mount. Coexists with the
          in-composer mount (OneBox.tsx) — that's the Cmd+K type
          switcher path UX-001.3 owns. The 3-gate model
          (buildActPopout) is untouched; this mount just renders the
          existing model output on a different trigger surface. */}
      <ActPopout
        visible={boardActVisible}
        onClose={() => setBoardActVisible(false)}
        targetKind={boardActTargetKind}
        role={boardActRole}
        stage={activeStage}
        parentType={activeParentType}
        rules={constitution.activeRules}
        onSelectBoxType={handleBoardActSelectBoxType}
        onDirectAction={handleBoardActDirectAction}
        onRoleChange={handleBoardActRoleChange}
        reduceMotionOverride={reduceMotionOverride}
        actingOnLabel={boardActActingOnLabel}
        maxHeightOverride={actPresentation.maxHeight}
        panelWidthOverride={actPresentation.width}
        testID="board-act-popout"
      />

      {/* UX-001.4 — Inspect popout mount. Previously unmounted in
          production (component + tests existed but no mount site).
          STRICTLY READ-ONLY — no Supabase, no fetch, no router. The §5
          hand-off chip closes Inspect and opens Act on the same node. */}
      <InspectPopout
        visible={inspectVisible}
        onClose={() => setInspectVisible(false)}
        stage={activeStage}
        content={inspectContent}
        onHandoffToAct={handleInspectHandoffToAct}
        onPrev={inspectHasPrev ? handlePrev : undefined}
        onNext={inspectHasNext ? handleNext : undefined}
        hasPrev={inspectHasPrev}
        hasNext={inspectHasNext}
        reduceMotionOverride={reduceMotionOverride}
        maxHeightOverride={inspectPresentation.maxHeight}
        panelWidthOverride={inspectPresentation.width}
        testID="board-inspect-popout"
      />
      {/* UX-SELECTED-NODE-001 (O-4) — the four already-mounted Inspect sibling
          overlays are now sectioned into the v4 drawer's four named sections
          via the SelectedNodeInspectDrawer wrapper. The siblings (and every
          one of their existing testIDs + props) are COMPOSED, never modified:
          each is passed verbatim into a named slot. The wrapper adds ONLY the
          four section headers ("Why this state · Other structure notes · Move
          forward · History") so the overlays read as ONE coherent drawer.
          Read-only; no board / topology / derivation change. The inline
          next-move line stays inside MediatorNodeInspectDetail under "Why this
          state" (the one-glance headline). UX-NEXT-MOVE-001 fills the standalone
          "Move forward:" slot with the richer "What would move this forward?"
          card (the full ordered move set) — display-only guidance that routes to
          no new action; the slot self-suppresses when the move set is empty.

          UX-MEDIATOR-002 — the mediator-state detail block preserves the
          reasoning behind the one default chip (structural state + helper +
          next-useful-move). UX-001.5A — NodeLabelInspectGroups keeps the §10a
          Observation/Allegation separation. META-1E — MetadataDiffInspector is
          the structural-change history. REF-004 — InspectOpenIssueDetail is
          the issue's raw provenance, kept under "Other structure notes". */}
      {inspectVisible && activeMessageId ? (
        <SelectedNodeInspectDrawer
          testID="selected-node-inspect-drawer"
          whyThisState={
            <MediatorNodeInspectDetail
              marker={activeNodeMediatorMarker}
              helper={activeNodeMediatorDetail.helper}
              nextMoveLabel={activeNodeMediatorDetail.nextMoveLabel}
              testID="mediator-node-inspect-detail-active"
            />
          }
          structureNotes={
            <NodeLabelInspectGroups
              messageId={activeMessageId}
              manualTagEntries={manualTagsByMessageId.get(activeMessageId) ?? []}
              autoMetadataCodes={
                metadataLedger.byMessage
                  .get(activeMessageId)
                  ?.autoDerivedMetadata.map((entry) => entry.code) ?? []
              }
              clusterState={
                lifecycleMap.byMessage.get(activeMessageId)?.clusterState ?? 'open'
              }
              messageContribution={
                lifecycleMap.byMessage.get(activeMessageId)?.messageContribution ?? null
              }
              persistedClassifierRows={
                persistedObservationsByArgumentId?.[activeMessageId] ?? []
              }
              testID="ux001-5a-inspect-groups-overlay"
            />
          }
          structureProvenance={
            refereeCardIssue != null ? (
              <InspectOpenIssueDetail
                issue={refereeCardIssue}
                testID="ref004-inspect-open-issue-detail"
              />
            ) : null
          }
          moveForward={
            activeNodeProgressInspectNote != null || activeNodeNextMoves.length > 0 ? (
              <>
                {/* UX-FEEDBACK-001 — Inspect-only STATIC current-state note,
                    rendered as a quiet lead above the next-move card. One of
                    Claim-narrowed / Concession-preserved / Source-path-identified
                    / Next-useful-move — reflects the active node CURRENT display
                    state, never a transition. Read-only, no rating, no
                    persistence. Null renders nothing. */}
                <MediatorProgressNote
                  note={activeNodeProgressInspectNote}
                  testID="mediator-progress-note-inspect"
                />
                {activeNodeNextMoves.length > 0 ? (
                  <MediatorNextMovesCard
                    moves={activeNodeNextMoves}
                    testID="mediator-next-moves-card"
                  />
                ) : null}
              </>
            ) : null
          }
          history={
            <MetadataDiffInspector
              messageId={activeMessageId}
              events={metadataLedger.metadataEvents}
              testID="metadata-diff-inspector"
            />
          }
        />
      ) : null}

      {/* UX-001.4 — Go popout mount. Previously unmounted in
          production. The leave-room entry routes through the existing
          onLeaveRoom callback (App.tsx::handleLeaveRoom path) — NOT a
          new room-exit path. Jump-to-root / Jump-to-latest reuse the
          existing setActiveMessageId path; view / density / lens are
          presentation toggles only (no write). */}
      <GoPopout
        visible={goVisible}
        onClose={() => setGoVisible(false)}
        miniMap={goMiniMap}
        viewportWindow={goViewportWindow}
        view={mode === 'timeline' ? 'timeline' : 'cards'}
        density={density ?? 'normal'}
        lens={goLens}
        onJump={handleGoJump}
        onMiniMapJump={() => { /* board-level Go does not (yet) thread mini-map jumps */ }}
        onSelectView={(view) => {
          if (view === 'timeline') setMode('timeline');
          else setMode('stack');
          setGoVisible(false);
          setMicroMomentDismissed(true);
        }}
        onSelectDensity={() => { /* density is owned upstream (PR-001) */ }}
        onSelectLens={(lens) => setGoLens(lens)}
        onLeaveRoom={onLeaveRoom}
        reduceMotionOverride={reduceMotionOverride}
        maxHeightOverride={goPresentation.maxHeight}
        panelWidthOverride={goPresentation.width}
        testID="board-go-popout"
      />
        </>
      }
      col3={
        /* UX-MEDIATOR-005 — Disagreement Points rail. Read-only ledger of the
           room's live disagreement points (one structural state badge each)
           with a one-line "what would help next?" + a "View in timeline" jump.
           Pure projection over MediatorBoardState (UX-MEDIATOR-001) — read-only,
           never a submission gate; the only verb is a navigation jump.
           UX-BOARD-RAIL-002 — `presentation` is `'sheet'` on phone (collapsed-
           pill bottom sheet) and `'pane'` on tablet/wide (a docked column).
           VISUAL-SIMPLIFY-002 — the pane/sheet is now ON-DEMAND: col3 is `null`
           in the default room view (no permanent 380 px docked column on
           tablet/wide, nothing in the phone stack), and the rail mounts only
           while the Disagreement Points analysis surface is summoned. The
           mediator board is still derived ONCE upstream (`mediatorBoard`) and
           passed in here — the on-demand mount NEVER moves or duplicates the
           derivation into a drawer. Collapsing the rail (its own collapse
           control) routes back through `onExpandedChange(false)` to unmount the
           surface, returning to conversation-only. */
        activeAnalysisSurface === 'disagreement' ? (
          <DisagreementPointsRail
            board={mediatorBoard}
            viewerRole={resolvedViewerRole}
            activeNodeId={activeMessageId}
            windowWidth={windowWidth}
            windowHeight={windowHeight}
            reduceMotionOverride={reduceMotionOverride}
            // FEEDBACK-001 (#898) surface #2: an ambient room-level line when at
            // least one move has been marked unanswered. Absent when the flag is
            // off / no unanswered marks => byte-identical. Never a per-node count.
            marksLegendLine={
              moveMarkAggregate && moveMarkAggregate.unaddressedMoveIds.length > 0
                ? MOVE_MARKS_LEGEND_LINE
                : undefined
            }
            // FEEDBACK-002 (#899) — additive advisory overlay keyed by board
            // point id (dodge_chain / talking_past). Empty when the flag is off
            // => byte-identical; never reorders or re-derives the board.
            advisoryOverlayByPointId={mediatorAdvisoryOverlay}
            // VISUAL-SIMPLIFY-002 — the rail is summoned expanded (the user asked
            // for it). On the phone sheet this opens it immediately rather than
            // as a second collapsed pill; on the tablet/wide pane it is the
            // shipped expanded-by-default behavior.
            defaultCollapsed={false}
            isAnyPanelOpen={Boolean(selectedDockTarget) || openIssuesRailExpanded || sideRailExpanded}
            onExpandedChange={(expanded) => {
              setDisagreementPointsRailExpanded(expanded);
              // VISUAL-SIMPLIFY-002 — collapsing the rail dismisses the summoned
              // surface entirely, back to conversation-only.
              if (!expanded) setActiveAnalysisSurface(null);
            }}
            onJump={(nodeId) => {
              setActiveMessageId(nodeId);
              setSelectionStatus('explicit');
              // VISUAL-SIMPLIFY-002 — jumping to a point is a navigation move;
              // return the view to the conversation once the user has jumped.
              setActiveAnalysisSurface(null);
            }}
            presentation={boardPresentation}
          />
        ) : null
      }
      bottomChrome={
        /* UX-BOARD-RAIL-004 (SN-1) — group the three bottom-chrome surfaces
           (Open Issues · seat strip · side action) into ONE calm, bordered
           board-bottom region. The wrapper is pure presentational (a single
           bordered View); every child subtree below stays textually in-file
           with identical props, testIDs, conditional render guards, and
           `isAnyPanelOpen` OR-terms, in the source order Open Issues → seat →
           Side Action. No behavior / data / semantics change. */
        <BoardBottomChrome>
      {/* REF-006-RAIL — the room-wide Open Issues ledger. Collapsed-by-default
          bottom chrome (below the Timeline), mounted as a sibling IMMEDIATELY
          above the side action rail. Reuses the SC-005 dock chassis layout;
          its three verbs (jump / Inspect / Act move) route through the shipped
          handlers. Mutual exclusion with the side action rail reuses the
          shipped single-owner pattern (`isAnyPanelOpen` + `onExpandedChange`).
          It sits below the Timeline, so it contributes ZERO to the UX-001.2
          first-row offset cap. UX-BOARD-RAIL-002 leaves the OR-terms here
          UNCHANGED (the docked pane ignores isAnyPanelOpen; DEFER the rewire). */}
      <OpenIssuesRail
        ledger={openIssuesLedger}
        windowWidth={windowWidth}
        windowHeight={windowHeight}
        reduceMotionOverride={reduceMotionOverride}
        isAnyPanelOpen={Boolean(selectedDockTarget) || sideRailExpanded || disagreementPointsRailExpanded}
        onExpandedChange={handleOpenIssuesRailExpandedChange}
        onJump={handleOpenIssueFocus}
        onInspect={handleOpenIssueInspect}
        onMove={handleOpenIssueMove}
      />

      {/* ARG-ROOM-005 — read-only public seat-availability strip. Open-slot
          count / "Room full — observe" + the viewer's own state line. Counts
          only, never identities. Rendered only when the room shell surfaces
          seats (public rooms). */}
      {seatAvailabilityViewModel ? (
        <SeatAvailabilityStrip viewModel={seatAvailabilityViewModel} />
      ) : null}

      {/* Stage 6.4 / SC-005 — Side action rail. Collapsed by default for
          observers; SC-005 renders it as a contextual dock (side-anchored
          on wide viewports, a capped bottom sheet on narrow ones) and folds
          the old App.tsx actionBar "Start an argument" CTA in. */}
      <ArgumentSideActionRail
        viewerRole={resolvedViewerRole}
        bubbleActor={activeViewModel?.actor || 'unknown'}
        participantSide={participantSide ?? null}
        activeMessageId={activeMessageId}
        onAction={handleRailAction}
        windowWidth={windowWidth}
        windowHeight={windowHeight}
        reduceMotionOverride={reduceMotionOverride}
        // SC-005 — "selected node" means an EXPLICIT SC-002/SC-004 node
        // selection, not the always-present default-active message. This
        // is what keeps the default room-entry collapsed label "Watch"
        // (per the edge-case table of the design) rather than "Actions on this
        // point" the moment the room mounts.
        hasSelectedNode={Boolean(selectedDockTarget)}
        // REF-006-RAIL — also force-collapse when the Open Issues rail is
        // expanded (two bottom rails never both expand). `openIssuesRailExpanded`
        // defaults false → byte-identical when the rail is collapsed.
        isAnyPanelOpen={Boolean(selectedDockTarget) || openIssuesRailExpanded || disagreementPointsRailExpanded}
        onExpandedChange={handleRailExpandedChange}
        startArgumentAction={startArgumentAction}
        // ARG-ROOM-005 — when the room is full the Join For / Join Against
        // chips render disabled + a verdict-free observe nudge; Watch stays
        // enabled. Undefined (no seatAvailability) => chips enabled.
        canClaimActiveSeat={seatAvailability ? seatAvailability.canClaimActiveSeat : undefined}
        fullRoomNotice={seatAvailabilityViewModel?.fullRoomObserveNudge ?? null}
      />
        </BoardBottomChrome>
      }
      overlays={
        <>
      {/* MCP-019 — the semantic-referee surface for the active move. Both
          components render NOTHING when their prop is absent / inert, so a
          room with the semantic layer off (the v1 default) is unchanged.
          The banner is a non-blocking strip; the override sheet is inline
          (never a Modal, never a route push) — TL-003 / SC-003 doctrine. */}
      {refereeBanner ? (
        <RefereeBannerView
          result={refereeBanner}
          reduceMotionOverride={reduceMotionOverride}
          observationChips={uxOneOneFiveAComposerObservationChips}
        />
      ) : null}
      {overridePrompt && overridePrompt.shouldOffer ? (
        <SemanticOverrideChoiceSheet
          prompt={overridePrompt}
          onConfirm={(choice) => onConfirmOverride?.(choice)}
          reduceMotionOverride={reduceMotionOverride}
        />
      ) : null}

      {deletionTarget && (
        <DeletionRequestSheet
          visible
          debateId={debate.id}
          argumentId={deletionTarget}
          onClose={() => setDeletionTarget(null)}
          onSuccess={handleDeletionSuccess}
        />
      )}

      {/* REF-005 — the structured "Request review / Mark concern" composer.
          A composer-side sibling overlay (like the deletion sheet); it is
          shown only on the actor's own surface and never on a target's node.
          On submit it routes via the SHIPPED disagreement loop (claim-level
          remedies) or the EXISTING, unchanged "Send for review" callback
          (moderator-queue remedies). It owns no persistence and fires no
          hide/delete path — REF-005B adds the persisted moderator queue. */}
      {requestReviewTarget && (
        <RequestReviewComposer
          visible
          targetNodeId={requestReviewTarget}
          initialQuote={sorted.find((m) => m.id === requestReviewTarget)?.body ?? ''}
          onRouteToActEntry={(actEntryId) => {
            // Claim-level remedy → the SAME enterBoxForActEntry bridge the
            // board Act mount + REF-003/REF-004 Referee Card use. The
            // resulting move is engine-gated like any ordinary post.
            enterBoxForActEntry(actEntryId);
            setRequestReviewTarget(null);
          }}
          onSendForModeratorReview={() => {
            // v1 interim: the existing, unchanged "Send for review" callback
            // (the flag handleAction → host onAction). Nothing hides
            // automatically; a human moderator acts. REF-005B replaces this
            // with the persisted, RLS-gated moderator concern queue.
            if (requestReviewTarget) handleAction('flag', requestReviewTarget);
            setRequestReviewTarget(null);
          }}
          onCancel={() => setRequestReviewTarget(null)}
          testID="request-review-composer"
        />
      )}

      {/* MARK-002 (#894) — the phrase picker. markerPickerTargetId is only ever
          set when timestampRebuttalsEnabled is on (handleRespondToThis is wired
          only then), so this overlay never mounts with the flag off. The target
          body is the offset authority; picking a phrase emits the scope up to the
          room shell, which scopes the composer + mints the marker on submit. */}
      {markerPickerTargetId ? (
        <MarkerPhrasePickerSheet
          targetArgumentId={markerPickerTargetId}
          targetBody={messageById.get(markerPickerTargetId)?.body ?? ''}
          windowWidth={windowWidth}
          onPick={handlePickMarkerScope}
          onCancel={handleCancelMarkerPicker}
          reduceMotion={reduceMotionOverride === true}
        />
      ) : null}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  // UX-001.2 — the old `header`, `title`, `statusRow`, `statusLabel`,
  // `modeChip`, `modeChipActive`, `modeChipText`, `latestStatus` style
  // entries were removed when the ArgumentGameSurface.header block was
  // deleted. The title + mode toggle moved to the compact strip in
  // DebateDetailHeader; the "Latest: …" line is subsumed by the
  // "what this move says" line of the selected-readout panel.
  // UX-BOARD-READABILITY-001 (2026-06-19): col1 gutters 8 -> 12 (matches the
  // strip paddingHorizontal:12) so the timeline/stack content has calmer side
  // air. Surface-local; col1/col2 JSX order + board derivation unchanged.
  body: { flex: 1, paddingHorizontal: 12, paddingBottom: 12 },
  microMoment: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#1e1b4b', borderBottomWidth: 1, borderBottomColor: '#312e81' },
  // UX-001.4 — small horizontal row of Act / Inspect / Go triggers.
  // Sits between the Timeline body and the side action rail. Each
  // button is 44px+ tall (visual + hitSlop) and groups label + optional
  // key badge inline. The row uses the same #0b1220 surface as the
  // rail so they read as a single bottom-anchored chrome stack.
  menuTriggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    // UX-BOARD-READABILITY-001 (2026-06-19): even vertical rhythm — the dock had
    // an asymmetric 8/4 that read as cramped at the bottom. 4 -> 8. Labels/routing
    // (Act/Inspect/Go) + board-menu-trigger-* testIDs unchanged.
    paddingBottom: 8,
    backgroundColor: '#0b1220',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  // VISUAL-SIMPLIFY-002 — the on-demand analysis-trigger row. A calm, wrapping
  // row of verdict-free buttons that summon the deep-analysis surfaces (each
  // reuses menuTriggerButton for its ≥44 px target). Sits directly below the
  // Act/Inspect/Go row; no border of its own so the two read as one calm strip.
  analysisTriggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: '#0b1220',
  },
  menuTriggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 44,
    backgroundColor: '#1f2937',
    borderRadius: 8,
  },
  // UX-SELECTED-NODE-001 (row 10, O-3) — Act is the visually DOMINANT
  // trigger in the Act/Inspect/Go dock: a restrained gold accent fill +
  // gold border so "respond" reads as the primary move. Styling only —
  // routing, popout model, and key-badge gating are untouched. Inspect +
  // Go stay the resting `menuTriggerButton` (≥44px). The dominance is
  // carried by fill + border (color) AND a heavier label weight (non-color)
  // so it survives grayscale.
  menuTriggerButtonDominant: {
    backgroundColor: BRAND.accent.goldSoft,
    borderWidth: 1,
    borderColor: BRAND.accent.goldBorder,
    paddingHorizontal: 16,
  },
  menuTriggerLabel: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  menuTriggerLabelDominant: {
    color: BRAND.accent.gold,
    fontSize: 14,
    fontWeight: '800' as const,
  },
  menuTriggerBadge: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#0b1220',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTriggerBadgeText: {
    color: '#cbd5e1',
    // UX-BOARD-READABILITY-001 (2026-06-19): A/I/G key badges 10 -> 11; box
    // minWidth/minHeight unchanged.
    fontSize: 11,
    fontWeight: '700' as const,
    fontFamily: 'monospace',
  },
  microMomentText: { color: '#a5b4fc', fontSize: 12, fontWeight: '700' as const },
  microMomentHelper: { color: '#94a3b8', fontSize: 11, fontWeight: '400' as const, marginTop: 2 },
  // ASP-EXTRACT-001 (Slice 1) — the QUOTE-FORGE-001 create-link affordance
  // styles (linkAffordance / linkAffordanceGlyph / linkAffordanceText) moved
  // into MapView alongside the affordance JSX. They are no longer referenced
  // here.
  // UX-MEDIATOR-002 — one-chip row: the single primary state chip + the
  // chip-adjacent Inspect caret (O-2). Rendered only when there IS a chip.
  nodeChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  // The caret visual size + hitSlop (12) lift the effective tap target well
  // above 44x44 (minHeight 32 + 12*2 = 56). role=button + label live on the
  // Pressable; the chip itself stays non-interactive text.
  nodeChipInspectCaret: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0b1220',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeChipInspectCaretText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' as const },
});
