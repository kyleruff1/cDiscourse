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
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArgumentBubbleStack } from './ArgumentBubbleStack';
import { ArgumentTimelineMap } from './ArgumentTimelineMap';
import { ArgumentBubbleActions } from './ArgumentBubbleActions';
import { ArgumentReplySidecar } from './ArgumentReplySidecar';
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
import { ArgumentScoreTracker } from './ArgumentScoreTracker';
import { ArgumentSideActionRail, railActionToBubbleControl } from './ArgumentSideActionRail';
import { VIEW_MODE_COPY } from './viewModeCopy';
import type { RailActionCode, RailViewerRole } from './ArgumentSideActionRail';
import type { ArgumentTag, ArgumentFlag } from './types';
import type { ParticipantSide } from '../debates/types';

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
  /** Optional latest-message-id hint from the full-room loader (used to snap active when new messages arrive). */
  latestMessageId?: string | null;
  /** Optional map of (messageId → boolean) for "I have an open deletion request on this". */
  deletionRequestedMap?: Record<string, boolean>;
  /** Optional per-message category label (for timeline badges). */
  categoryLabelById?: Record<string, string | null>;
  /** Optional per-message qualifier label (for timeline badges). */
  qualifierLabelById?: Record<string, string | null>;
  /** Action handlers. Called with the canonical control name + message id. */
  onAction?: (control: ArgumentBubbleControl, messageId: string) => void;
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
  entryHint?: { activate: 'root' | 'latest' | 'first_open_challenge'; microMomentLabel: string };
}

export function ArgumentGameSurface({
  debate,
  messages,
  currentUserId,
  isAdmin,
  initialMode,
  flagsByArgumentId,
  tagsByArgumentId,
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
}: Props) {
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
  const [deletionTarget, setDeletionTarget] = useState<string | null>(null);
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
      setActiveMessageId(latestId);
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
  }), [enrichedMessages, currentUserId, activeMessageId]);

  const activeViewModel = useMemo(() => viewModels.find((v) => v.isActive) || null, [viewModels]);

  const participantTrends = useMemo(
    () => computeParticipantTrends({ messages: enrichedMessages, currentUserId }),
    [enrichedMessages, currentUserId],
  );

  const handleToggleMode = useCallback(() => {
    setMode((m) => toggleSurfaceMode(m));
  }, []);

  const handleActivate = useCallback((id: string) => setActiveMessageId(id), []);
  const handlePrev = useCallback(() => {
    const prev = getPreviousMessageId(chronologicalIds, activeMessageId);
    if (prev) setActiveMessageId(prev);
  }, [chronologicalIds, activeMessageId]);
  const handleNext = useCallback(() => {
    const next = getNextMessageId(chronologicalIds, activeMessageId);
    if (next) setActiveMessageId(next);
  }, [chronologicalIds, activeMessageId]);

  const handleAction = useCallback((control: ArgumentBubbleControl, messageId: string) => {
    if (control === 'request_deletion') {
      setDeletionTarget(messageId);
      return;
    }
    onAction?.(control, messageId);
  }, [onAction]);

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

      {entryHint?.microMomentLabel ? (
        <View style={styles.microMoment} testID="argument-micro-moment">
          <Text style={styles.microMomentText}>{entryHint.microMomentLabel}</Text>
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
            <ArgumentTimelineMap
              map={timelineMap}
              onActivate={handleActivate}
              onPrev={handlePrev}
              onNext={handleNext}
              onJumpLatest={() => latestId && setActiveMessageId(latestId)}
              onJumpToRoot={() => timelineMap.rootMessageId && setActiveMessageId(timelineMap.rootMessageId)}
              onToggleMode={handleToggleMode}
              activeViewModel={activeViewModel}
              totalCount={timelineMap.nodes.length}
              onAction={handleAction}
              onOpenDetails={(id) => { setActiveMessageId(id); setMode('stack'); }}
            />
            <ArgumentReplySidecar
              activeMessage={timelineMap.activeNode}
              activeViewModel={activeViewModel}
              parentNode={
                timelineMap.activeNode && timelineMap.activeNode.parentId
                  ? timelineMap.nodes.find((n) => n.messageId === timelineMap.activeNode!.parentId) || null
                  : null
              }
              totalCount={timelineMap.nodes.length}
              activePathIds={timelineMap.activePathIds}
              onAction={handleAction}
            />
          </>
        )}
      </View>

      {/* Stage 6.4 — Side action rail. Collapsed by default for observers. */}
      <ArgumentSideActionRail
        viewerRole={resolvedViewerRole}
        bubbleActor={activeViewModel?.actor || 'unknown'}
        participantSide={participantSide ?? null}
        activeMessageId={activeMessageId}
        onAction={handleRailAction}
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
});
