/**
 * Stage 6.1.8 — ArgumentGameSurface
 *
 * Stack + Timeline orchestrator for the argument-room interaction surface.
 * Owns: surface mode, active message id, bubble view models, timeline
 * segments, action dispatch, deletion-request sheet.
 *
 * No service-role usage. No public.arguments mutation from this component.
 * Editing message bodies is not exposed.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArgumentBubbleStack } from './ArgumentBubbleStack';
import { ArgumentTimelineMap } from './ArgumentTimelineMap';
import { ArgumentBubbleActions } from './ArgumentBubbleActions';
import { buildSidecarViewModel } from './argumentReplySidecarModel';
import { TimelineSelectedReadoutPanel } from './TimelineSelectedReadoutPanel';
import {
  buildTimelineSelectedReadoutViewModel,
  type ReadoutSelectionStatus,
} from './timelineSelectedReadoutModel';
import { DeletionRequestSheet } from './DeletionRequestSheet';
import {
  buildArgumentBubbleViewModels,
  buildArgumentTimelineMap,
  getDisplayTitle,
  getLatestMessageId,
  getNextMessageId,
  getPreviousMessageId,
  sortMessagesChronologically,
  toggleSurfaceMode,
  type ArgumentBubbleControl,
  type ArgumentMessageInput,
  type ArgumentSurfaceMode,
} from './argumentGameSurfaceModel';
import { computeParticipantTrends } from './argumentScoreModel';
import type { TimelineDensityMode } from './timelineNodeVisualModel';
import { ArgumentScoreTracker } from './ArgumentScoreTracker';
import { ArgumentSideActionRail, railActionToBubbleControl } from './ArgumentSideActionRail';
import { VIEW_MODE_COPY } from './viewModeCopy';
import type { RailActionCode, RailViewerRole } from './ArgumentSideActionRail';
import type { ArgumentTag, ArgumentFlag } from './types';
import type { ParticipantSide } from '../debates/types';
import type { GalleryEntryHint } from '../debates/conversationGalleryModel';
import type { MoveDraftPatch } from './conversationMoves';
import type { ArgumentType } from '../../domain/constitution/types';
import {
  deriveEvidenceDebts,
  getNodeEvidenceDebtSummary,
  getTimelineEvidenceContract,
  type EvidenceArtifact,
  type EvidenceDebtArgumentInput,
  type NodeEvidenceDebtSummary,
  type TimelineEvidenceContract,
} from '../evidence';
import { buildArtifactsByMessageId } from './argumentGameSurfaceEvidence';
// SC-004 — Build the dock model + thread selection state into the
// timeline map. Lifecycle + metadata maps are built once per render and
// memoized by their inputHashes; the dock model is cheap (O(cluster
// members)) and rebuilds whenever the target / actor / upstream inputs
// change.
import { buildPointLifecycleMap } from '../lifecycle';
import { buildMoveMetadataLedger } from '../metadata';
import {
  applyManualTag,
  removeManualTag,
  persistedTagsToManualTagEntries,
  type ApplyManualTagResult,
} from '../metadata/pointTagsApi';
import type { ManualTagCode } from '../metadata';
import type { PersistedPointTag } from './types';
import {
  buildTimelineNodeActionDockModel,
  actionDockToComposerPreset,
  type TimelineNodeActionDockActionCode,
  type TimelineNodeActionDockActor,
  type TimelineNodeActionDockTarget,
} from './timelineNodeActionDockModel';
// MCP-019 — the deferred semantic-referee render components. Both render
// nothing when their props are absent / inert, so the surface is unchanged
// for a room with the semantic layer off (the v1 default).
import { RefereeBannerView } from '../refereeBanners/RefereeBannerView';
import type { BannerSelectionResult } from '../refereeBanners/types';
import {
  SemanticOverrideChoiceSheet,
  type SemanticOverrideChoice,
} from './SemanticOverrideChoiceSheet';
import type { SemanticOverridePrompt } from '../semanticOverride/types';

interface Props {
  debate: {
    id: string;
    title: string | null;
    /** Optional explicit root claim body. If null, falls back to the first chronological message's body. */
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
  /** Optional refresh trigger (e.g., the room hook's refresh). */
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
   * PR-001 — user's visual-density preference. Passed to
   * `buildArgumentTimelineMap({ density })`, which drives VG-004's
   * `resolveNodeGapPx`. Defaults to `'normal'` when omitted.
   */
  density?: TimelineDensityMode;
  /**
   * PR-001 — user's effective reduce-motion preference (OS value
   * composed with the user's override). When supplied it replaces the
   * timeline board's independent OS read.
   */
  reduceMotionOverride?: boolean;
  /**
   * SC-005 — optional "Start an argument" CTA folded into the side action
   * rail's expanded dock (replaces App.tsx's separate bottom actionBar).
   * When omitted, no CTA chip renders in the dock.
   */
  startArgumentAction?: { label: string; onPress: () => void } | null;
  /**
   * MCP-019 — the semantic-referee banner for the currently-active move, or
   * null. Rendered as a non-blocking strip anchored under the active node's
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
}

export function ArgumentGameSurface({
  debate,
  messages,
  currentUserId,
  isAdmin,
  initialMode,
  flagsByArgumentId,
  tagsByArgumentId,
  pointTagsByArgumentId,
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
}: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const sorted = useMemo(() => sortMessagesChronologically(messages || []), [messages]);
  const latestId = useMemo(() => latestIdHint ?? getLatestMessageId(sorted), [sorted, latestIdHint]);
  const [mode, setMode] = useState<ArgumentSurfaceMode>(initialMode || 'stack');
  // Stage 6.4: derive the initial active message from the entry hint, not
  // always the latest. needs_rebuttal cards open the root; source-chain
  // cards open the most-recent challenge/source-style move.
  const initialActiveId = useMemo<string | null>(() => {
    if (!sorted.length) return null;
    if (!entryHint) return latestId;
    if (entryHint.activate === 'root') return sorted[0].id;
    if (entryHint.activate === 'first_open_challenge') {
      for (let i = sorted.length - 1; i >= 0; i--) {
        const t = String(sorted[i].argumentType || '').toLowerCase();
        if (t === 'rebuttal' || t === 'counter_rebuttal' || t === 'clarification_request') return sorted[i].id;
      }
      return latestId;
    }
    return latestId;
  }, [sorted, latestId, entryHint]);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(initialActiveId);
  // IX-004 — companion state describing WHY the readout subject is what it
  // is. `activeMessageId` stays the single selection source of truth; this
  // value only labels the selection (entry-hint pre-activation, default
  // latest, an explicit user pick, or a stale auto-snap to latest). It
  // never picks the message — it only drives the readout's stale banner.
  const [selectionStatus, setSelectionStatus] = useState<ReadoutSelectionStatus>(
    entryHint ? 'entry_hint' : 'default_latest',
  );
  const [deletionTarget, setDeletionTarget] = useState<string | null>(null);
  // SC-004 — currently-selected target for the action dock. Null = no
  // selection, no dock. Mutually exclusive with the SC-002 popover; opening
  // the popover dismisses the dock and vice versa.
  const [selectedDockTarget, setSelectedDockTarget] = useState<TimelineNodeActionDockTarget | null>(null);
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
      // explicit user action resets the status back to 'explicit'.
      setActiveMessageId(latestId);
      setSelectionStatus('stale_fallback');
    }
  }, [latestId, activeMessageId, sorted]);

  // If the initialMode prop changes after mount (e.g., the user pressed a
  // different toolbar chip), reflect it in local state.
  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  const chronologicalIds = useMemo(() => sorted.map((m) => m.id), [sorted]);
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

  // Enrich messages with per-message tags + flags for the timeline map's
  // standing/tone inference.
  const enrichedMessages = useMemo(() => sorted.map((m) => ({
    ...m,
    tagCodes: (tagsByArgumentId?.[m.id] || []).map((t) => t.tagCode),
    flagCodes: (flagsByArgumentId?.[m.id] || []).map((f) => f.flagCode),
  })), [sorted, tagsByArgumentId, flagsByArgumentId]);

  const timelineMap = useMemo(() => buildArgumentTimelineMap({
    messages: enrichedMessages,
    currentUserId,
    activeMessageId,
    // VG-004 / PR-001 — explicit density. PR-001 threads the user's
    // visual-density preference here; `resolveNodeGapPx` falls back to
    // 'normal' (44px) when the preference is undefined.
    density: density ?? 'normal',
  }), [enrichedMessages, currentUserId, activeMessageId, density]);

  // EV-002 — Build the artifact map once per render from each message's
  // optional `attachedEvidence` payload (typed defensively). Empty /
  // missing payloads yield an empty list, which produces the `no_source`
  // form downstream. No service-role, no Supabase call.
  const artifactsByMessageId = useMemo<Record<string, ReadonlyArray<EvidenceArtifact>>>(
    () => buildArtifactsByMessageId(sorted),
    [sorted],
  );

  const evidenceContractFor = useCallback((messageId: string): TimelineEvidenceContract | null => {
    const arr = artifactsByMessageId[messageId];
    if (!arr) return null;
    const msg = sorted.find((m) => m.id === messageId);
    const argumentType = msg?.argumentType ?? null;
    return getTimelineEvidenceContract(argumentType, arr);
  }, [artifactsByMessageId, sorted]);

  // EV-003 — Derive the room's evidence debts once per render from the same
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

  const activeViewModel = useMemo(() => viewModels.find((v) => v.isActive) || null, [viewModels]);

  // SC-004 — Classify the actor for the dock from the currently-active
  // bubble. Observer comes from the resolved viewer role; otherwise we
  // mirror the bubble view-model's actor (mapped onto the dock's
  // observer-inclusive union).
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

  const handleToggleMode = useCallback(() => {
    setMode((m) => toggleSurfaceMode(m));
  }, []);

  // IX-004 — every explicit selection mutation (tap, Prev, Next, Latest,
  // Back-to-root, keyboard nav) marks the selection 'explicit' so a
  // lingering 'stale_fallback' banner is cleared the moment the user
  // moves on. Only the auto-snap on a vanished message stays
  // 'stale_fallback'.
  const handleActivate = useCallback((id: string) => {
    setActiveMessageId(id);
    setSelectionStatus('explicit');
  }, []);
  const handlePrev = useCallback(() => {
    const prev = getPreviousMessageId(chronologicalIds, activeMessageId);
    if (prev) {
      setActiveMessageId(prev);
      setSelectionStatus('explicit');
    }
  }, [chronologicalIds, activeMessageId]);
  const handleNext = useCallback(() => {
    const next = getNextMessageId(chronologicalIds, activeMessageId);
    if (next) {
      setActiveMessageId(next);
      setSelectionStatus('explicit');
    }
  }, [chronologicalIds, activeMessageId]);

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
  // dock's chosen scaffolding (e.g. `NARROW_PRESET_BODY`) lands in the
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
    // computation. For node targets that's the message's own type (the
    // composer treats the targeted message as its parent when replying);
    // for cluster / collapsed_stub targets we use the branch root's type.
    // null is safe — the SC-004 preset bodies for narrow / confirm /
    // synthesize don't depend on parent type; only `challenge` does.
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
      handleAction('flag', targetMessageId);
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

  const handleDeletionSuccess = useCallback(() => {
    // Caller is responsible for re-fetching deletionRequestedMap; we just close.
    setDeletionTarget(null);
  }, []);

  // SC-005 — mutual exclusion between the side action rail's dock and the
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
    if (expanded) setSelectedDockTarget(null);
  }, []);

  // META-1A — Persisted manual-tag write path. These route through the
  // apply-manual-tag Edge Function (the single write path; never a direct
  // client insert) and refresh the room on success so the persisted tag
  // hydrates the metadata ledger. No tag-apply UI control is wired yet —
  // SC-004 / TimelineNodeActionDock's tag affordance is a thin follow-up
  // card (META-1A's acceptance criterion "UI reflects persisted state" is
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

  const rootBody = debate.rootBody || (sorted.length > 0 ? sorted[0].body : null);
  const displayTitle = getDisplayTitle({ debateTitle: debate.title, rootBody });

  const latestKindLabel = activeViewModel?.kindLabel || 'message';
  const latestActor = activeViewModel?.actor || 'unknown';
  const latestRelative = activeViewModel?.relativeLabel || '';

  return (
    <View style={styles.container} accessibilityLabel="argument-game-surface" testID="argument-game-surface">
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2} accessibilityLabel="argument-display-title">
          {displayTitle}
        </Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Mode</Text>
          <Pressable
            onPress={handleToggleMode}
            style={[styles.modeChip, mode === 'stack' && styles.modeChipActive]}
            accessibilityRole="button"
            accessibilityLabel={`Switch surface mode. Currently ${mode}.`}
            testID="surface-mode-toggle"
          >
            <Text style={styles.modeChipText}>{mode === 'stack' ? VIEW_MODE_COPY.cards.label : VIEW_MODE_COPY.timeline.label}</Text>
          </Pressable>
          <Text style={styles.latestStatus} numberOfLines={1} accessibilityLabel="argument-latest-status">
            Latest: {latestKindLabel}
            {latestRelative ? ` · ${latestRelative}` : ''}
            {latestActor === 'self' ? ' · you' : ''}
          </Text>
        </View>
      </View>

      {entryHint?.verbPhrase ? (
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

      <View style={styles.body}>
        {mode === 'stack' ? (
          <>
            <ArgumentBubbleStack
              viewModels={viewModels}
              activeMessageId={activeMessageId}
              onActivate={handleActivate}
              onPrevious={handlePrev}
              onNext={handleNext}
              onToggleMode={handleToggleMode}
            />
            {/* Stage 6.4: legacy chip cluster is hidden in observer mode;
                the action rail below is the single entry point for both
                observer + participant flows. Participants still get the
                chip cluster for quick access on the active card. */}
            {activeViewModel && resolvedViewerRole === 'participant' ? (
              <ArgumentBubbleActions
                viewModel={activeViewModel}
                onAction={handleAction}
              />
            ) : null}
          </>
        ) : (
          <>
            <ArgumentScoreTracker trends={participantTrends} />
            {/* IX-004 — the selected-message readout is now a prominent,
                persistent panel ABOVE the timeline map (not the
                subordinate sidecar that used to render below it). It
                refreshes on every selection change and is the loud
                in-surface confirmation of which message is selected. */}
            <TimelineSelectedReadoutPanel viewModel={timelineReadoutViewModel} />
            <ArgumentTimelineMap
              map={timelineMap}
              onActivate={handleActivate}
              onPrev={handlePrev}
              onNext={handleNext}
              onJumpLatest={() => {
                if (latestId) {
                  setActiveMessageId(latestId);
                  setSelectionStatus('explicit');
                }
              }}
              onJumpToRoot={() => {
                if (timelineMap.rootMessageId) {
                  setActiveMessageId(timelineMap.rootMessageId);
                  setSelectionStatus('explicit');
                }
              }}
              onToggleMode={handleToggleMode}
              activeViewModel={activeViewModel}
              totalCount={timelineMap.nodes.length}
              onAction={handleAction}
              onOpenDetails={(id) => { setActiveMessageId(id); setSelectionStatus('explicit'); setMode('stack'); }}
              artifactsByMessageId={artifactsByMessageId}
              evidenceContractFor={evidenceContractFor}
              evidenceDebtSummaryFor={evidenceDebtSummaryFor}
              isReadModeViewer={resolvedViewerRole === 'observer'}
              selectedTarget={selectedDockTarget}
              actionDockModel={dockModel}
              actingOnLabel={timelineReadoutViewModel.actingOnShortLabel}
              onSelectTarget={setSelectedDockTarget}
              onActionDockAction={handleActionDockAction}
              onOpenCardsDetail={handleOpenCardsDetail}
              reduceMotionOverride={reduceMotionOverride}
            />
          </>
        )}
      </View>

      {/* MCP-019 — the semantic-referee surface for the active move. Both
          components render NOTHING when their prop is absent / inert, so a
          room with the semantic layer off (the v1 default) is unchanged.
          The banner is a non-blocking strip; the override sheet is inline
          (never a Modal, never a route push) — TL-003 / SC-003 doctrine. */}
      {refereeBanner ? (
        <RefereeBannerView result={refereeBanner} reduceMotionOverride={reduceMotionOverride} />
      ) : null}
      {overridePrompt && overridePrompt.shouldOffer ? (
        <SemanticOverrideChoiceSheet
          prompt={overridePrompt}
          onConfirm={(choice) => onConfirmOverride?.(choice)}
          reduceMotionOverride={reduceMotionOverride}
        />
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
        // (per the design's edge-case table) rather than "Actions on this
        // point" the moment the room mounts.
        hasSelectedNode={Boolean(selectedDockTarget)}
        isAnyPanelOpen={Boolean(selectedDockTarget)}
        onExpandedChange={handleRailExpandedChange}
        startArgumentAction={startArgumentAction}
      />

      {deletionTarget && (
        <DeletionRequestSheet
          visible
          debateId={debate.id}
          argumentId={deletionTarget}
          onClose={() => setDeletionTarget(null)}
          onSuccess={handleDeletionSuccess}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1f2937', backgroundColor: '#0b1220' },
  title: { color: '#f8fafc', fontSize: 17, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  statusLabel: { color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: '700' },
  modeChip: { backgroundColor: '#1f2937', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, minHeight: 28 },
  modeChipActive: { backgroundColor: '#312e81' },
  modeChipText: { color: '#e2e8f0', fontWeight: '700', fontSize: 12 },
  latestStatus: { color: '#94a3b8', fontSize: 11, flex: 1 },
  body: { flex: 1, paddingHorizontal: 8, paddingBottom: 8 },
  microMoment: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#1e1b4b', borderBottomWidth: 1, borderBottomColor: '#312e81' },
  microMomentText: { color: '#a5b4fc', fontSize: 12, fontWeight: '700' as const },
  microMomentHelper: { color: '#94a3b8', fontSize: 11, fontWeight: '400' as const, marginTop: 2 },
});
