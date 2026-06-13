import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useArgumentViewport } from './useArgumentViewport';
import { ArgumentNode } from './ArgumentNode';
import { ArgumentPathBar } from './ArgumentPathBar';
import { ArgumentTimelineScreen } from './ArgumentTimelineScreen';
import { ArgumentGameSurface } from './ArgumentGameSurface';
import { getKnownChildCount } from './argumentCache';
import { LoadingNotice } from '../../components/LoadingNotice';
import { EmptyState } from '../../components/EmptyState';
import type { Debate } from '../debates/types';
import type { SeatAvailability } from '../debates/seatClaimModel';
import type { GalleryEntryHint } from '../debates/conversationGalleryModel';
import type { ArgumentRow } from './types';
import type { ArgumentMessageInput, ArgumentBubbleControl, ArgumentSurfaceMode } from './argumentGameSurfaceModel';
import type { TimelineDensityMode } from './timelineNodeVisualModel';
import type { MoveDraftPatch } from './conversationMoves';
import { useAppSession } from '../session/useAppSession';
import { useArgumentRoomMessages } from './useArgumentRoomMessages';
import { quickActionToPreset } from './quickActionPresets';
import { useSemanticReferee } from './useSemanticReferee';

/**
 * Stage 6.2 — Normal users only ever see `stack` or `timeline`. The
 * old `tree` and `tracks` paths remain wired for `__DEV__` and admin
 * tooling but are no longer reachable from the normal toolbar.
 */
export type ArgumentViewMode = 'tree' | 'timeline' | 'stack' | 'tracks';

interface Props {
  debate: Debate;
  onReply: (argumentId: string, argument: ArgumentRow) => void;
  /** Caller stores this ref and calls .current() to trigger a refresh from outside. */
  refreshRef?: React.MutableRefObject<(() => void) | null>;
  /** 'tree' (default) or 'timeline' track view. */
  viewMode?: ArgumentViewMode;
  /**
   * Stage 6.2 M7 — when a quick action fires from the sidecar/bubble, this
   * callback receives a typed composer preset that the room shell pushes
   * into the composer. Called BEFORE / alongside onReply.
   */
  onComposerPreset?: (preset: MoveDraftPatch | null) => void;
  /** Stage 6.4 / GAL-002 — entry hint passed from the Conversation Gallery. */
  entryHint?: GalleryEntryHint | null;
  /** Stage 6.4 — current viewer's participant side (null = observer entry). */
  participantSide?: string | null;
  /** Stage 6.4 — handler invoked when the in-room action rail picks Join Aff/Neg. */
  onJoinSide?: (side: 'affirmative' | 'negative') => void;
  /**
   * PR-001 — user's visual-density preference. Threaded into the
   * timeline map's `buildArgumentTimelineMap({ density })` call, which
   * drives VG-004's `resolveNodeGapPx`. Defaults to `'normal'`.
   */
  density?: TimelineDensityMode;
  /**
   * PR-001 — user's effective reduce-motion preference (the OS value
   * composed with the user's `system`/`on`/`off` override). When
   * supplied it replaces the timeline board's independent OS read.
   */
  reduceMotionOverride?: boolean;
  /**
   * SC-005 — optional "Start an argument" CTA. Threaded down to the side
   * action rail's expanded dock so the room has a single bottom action
   * surface (replaces App.tsx's separate bottom actionBar).
   */
  startArgumentAction?: { label: string; onPress: () => void } | null;
  /**
   * UX-001.3 — fires when the Timeline's active message changes. The
   * caller (App.tsx) passes this id to the composer dock so its
   * ComposerContextStrip can render a divergence cue when the
   * Timeline's selected node differs from the composer's bound parent.
   * Additive optional.
   */
  onActiveMessageChange?: (activeMessageId: string | null) => void;
  /**
   * UX-001.3 — fires when the user taps the persistent collapsed
   * composer strip below the score tracker. The caller opens the
   * composer dock in response. Additive optional; when omitted the
   * strip is not rendered.
   */
  onComposerExpand?: () => void;
  /**
   * UX-001.4 — fires when the user picks the Go popout's
   * `Leave argument` entry. The caller wires the existing
   * `handleLeaveRoom` path. NOT a new room-exit path. Additive
   * optional; when omitted, the Go entry renders disabled-with-reason.
   */
  onLeaveRoom?: () => void;
  /**
   * ARG-ROOM-005 — live public-room seat availability, derived by the room
   * shell (App.tsx). Forwarded verbatim to the game surface, which renders the
   * read-only seat strip + drives the rail's full-room state. Optional;
   * omitted => no strip, Join chips enabled (back-compat).
   */
  seatAvailability?: SeatAvailability | null;
}

export function ArgumentTreeScreen({ debate, onReply, refreshRef, viewMode = 'tree', onComposerPreset, entryHint, participantSide, onJoinSide, density, reduceMotionOverride, startArgumentAction, onActiveMessageChange, onComposerExpand, onLeaveRoom, seatAvailability }: Props) {
  const {
    cache,
    viewport,
    loading,
    error,
    expand,
    collapse,
    focus,
    unfocus,
    refresh,
  } = useArgumentViewport(debate.id);

  // Register refresh with the caller's ref so handleSubmitSuccess can trigger it.
  useEffect(() => {
    if (refreshRef) refreshRef.current = refresh;
  }, [refresh, refreshRef]);

  const { visibleArgumentIds, focusedPathIds, focusedArgumentId, expandedArgumentIds } = viewport;

  const isInitialLoad = loading && visibleArgumentIds.length === 0;

  if (isInitialLoad) {
    return <LoadingNotice message="Loading arguments…" />;
  }

  // `tracks` is the legacy lane/Tracks screen. Dev-only.
  if (viewMode === 'tracks') {
    return (
      <ArgumentTimelineScreen
        cache={cache}
        selectedArgumentId={viewport.selectedParentId}
        focusedArgumentId={focusedArgumentId}
        onSelectArgument={(id) => {
          const arg = cache.argumentsById[id];
          if (arg) onReply(id, arg);
        }}
      />
    );
  }

  // Stage 6.2 — Stack + Timeline (graphical map) share the same full-room
  // message source. The internal surface toggle inside ArgumentGameSurface
  // is what flips between Stack <-> Timeline-map visual modes; this prop
  // controls the INITIAL mode when the user enters via the room toolbar.
  if (viewMode === 'stack' || viewMode === 'timeline') {
    return (
      <FullRoomGameSurfaceMount
        debate={debate}
        onReply={onReply}
        refreshRef={refreshRef}
        initialMode={viewMode === 'timeline' ? 'timeline' : 'stack'}
        onComposerPreset={onComposerPreset}
        entryHint={entryHint}
        participantSide={participantSide}
        onJoinSide={onJoinSide}
        density={density}
        reduceMotionOverride={reduceMotionOverride}
        startArgumentAction={startArgumentAction}
        onActiveMessageChange={onActiveMessageChange}
        onComposerExpand={onComposerExpand}
        onLeaveRoom={onLeaveRoom}
        seatAvailability={seatAvailability}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.resolutionBar}>
        <Text style={styles.resolutionLabel}>Claim</Text>
        <Text style={styles.resolutionText} numberOfLines={2}>{debate.resolution}</Text>
      </View>

      {focusedPathIds.length > 0 && (
        <ArgumentPathBar
          pathIds={focusedPathIds}
          cache={cache}
          focusedArgumentId={focusedArgumentId}
          onTap={focus}
          onClear={unfocus}
        />
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={refresh} accessibilityRole="button" accessibilityLabel="Retry">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {!loading && visibleArgumentIds.length === 0 ? (
          <EmptyState
            title="No arguments yet"
            body="This argument has no posted moves yet. Be the first to submit."
          />
        ) : null}

        {visibleArgumentIds.map((id) => {
          const arg = cache.argumentsById[id];
          if (!arg) return null;
          const tags = cache.tagsByArgumentId[id] ?? [];
          const flags = cache.flagsByArgumentId[id] ?? [];
          const checks = cache.checksByArgumentId[id] ?? [];
          const childCount = getKnownChildCount(cache, id);
          const isExpanded = expandedArgumentIds.includes(id);
          const isFocused = id === focusedArgumentId;

          return (
            <ArgumentNode
              key={id}
              argument={arg}
              tags={tags}
              flags={flags}
              checks={checks}
              knownChildCount={childCount}
              isExpanded={isExpanded}
              isFocused={isFocused}
              depth={arg.depth}
              onExpand={() => expand(id)}
              onCollapse={() => collapse(id)}
              onFocus={() => focus(id)}
              onReply={() => onReply(id, arg)}
            />
          );
        })}

        {cache.detachedArgumentIds.length > 0 ? (
          <View style={styles.detachedBanner}>
            <Text style={styles.detachedText}>
              {cache.detachedArgumentIds.length} argument{cache.detachedArgumentIds.length > 1 ? 's' : ''} could not be placed in the tree (missing parent).
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  resolutionBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  resolutionLabel: { fontSize: 10, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  resolutionText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  errorText: { fontSize: 13, color: '#b91c1c', flex: 1 },
  retryText: { fontSize: 13, color: '#6366f1', fontWeight: '600', marginLeft: 12 },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 32 },
  detachedBanner: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginTop: 8,
  },
  detachedText: { fontSize: 12, color: '#92400e' },
});

// ── Stage 6.2 — FullRoomGameSurfaceMount ──────────────────────────────────
//
// Replaces the older `StackGameSurfaceMount` which read from `visibleArgumentIds`.
// This mount loads the FULL room of posted messages (one query, RLS-bound)
// and feeds them to the game surface. Stack and Timeline modes share this
// data; switching modes never reloads.

interface FullRoomGameSurfaceMountProps {
  debate: Debate;
  onReply: (argumentId: string, argument: ArgumentRow) => void;
  refreshRef?: React.MutableRefObject<(() => void) | null>;
  initialMode: ArgumentSurfaceMode;
  onComposerPreset?: (preset: MoveDraftPatch | null) => void;
  entryHint?: GalleryEntryHint | null;
  participantSide?: string | null;
  onJoinSide?: (side: 'affirmative' | 'negative') => void;
  /** PR-001 — visual-density preference. */
  density?: TimelineDensityMode;
  /** PR-001 — effective reduce-motion preference. */
  reduceMotionOverride?: boolean;
  /** SC-005 — "Start an argument" CTA folded into the side action rail. */
  startArgumentAction?: { label: string; onPress: () => void } | null;
  /** UX-001.3 — Timeline active-id read-out (one-way). */
  onActiveMessageChange?: (activeMessageId: string | null) => void;
  /** UX-001.3 — caller opens the composer dock when the strip is tapped. */
  onComposerExpand?: () => void;
  /** UX-001.4 — Go popout Leave-room callback (App.tsx::handleLeaveRoom). */
  onLeaveRoom?: () => void;
  /** ARG-ROOM-005 — public-room seat availability (forwarded to the surface). */
  seatAvailability?: SeatAvailability | null;
}

function FullRoomGameSurfaceMount({ debate, onReply, refreshRef, initialMode, onComposerPreset, entryHint, participantSide, onJoinSide, density, reduceMotionOverride, startArgumentAction, onActiveMessageChange, onComposerExpand, onLeaveRoom, seatAvailability }: FullRoomGameSurfaceMountProps) {
  const { state } = useAppSession();
  const currentUserId = state.snapshot.userId || null;

  const {
    messages: rows,
    tagsByArgumentId,
    flagsByArgumentId,
    pointTagsByArgumentId,
    persistedObservationsByArgumentId,
    loading,
    error,
    latestId,
    refresh,
  } = useArgumentRoomMessages(debate.id);

  // Register refresh so handleSubmitSuccess can trigger it from App.tsx.
  useEffect(() => {
    if (refreshRef) refreshRef.current = refresh;
  }, [refresh, refreshRef]);

  // MCP-019 — semantic-referee room hook (mock mode). Called once at the
  // room-shell level. It owns the client packet cache, the trigger gates,
  // the (single) classifyMove call path, and the resulting banner / override
  // state. The semantic layer is OFF by default — when the operator has not
  // enabled it the Edge Function returns `{ enabled: false }` and the hook
  // falls back silently with no user-visible error.
  const referee = useSemanticReferee();
  // The move id MCP-019 last classified — its banner / override surface is
  // shown while that move is the active one (a just-posted move auto-snaps
  // to active, so the banner appears on the move the user just posted).
  const [classifiedMoveId, setClassifiedMoveId] = useState<string | null>(null);
  // Message ids seen on a prior render. A move that appears for the FIRST
  // time, is authored by the current user, and is the new latest id is a
  // "the local user just posted this" signal — that, and only that, fires
  // `onMovePosted`. A refresh that brings in OTHER participants' messages
  // never triggers a classification (MCP-019 §4.2).
  const seenMoveIdsRef = useRef<Set<string>>(new Set());
  const refereeOnMovePosted = referee.onMovePosted;

  useEffect(() => {
    const seen = seenMoveIdsRef.current;
    const isFirstObservation = seen.size === 0;
    // Snapshot the previous seen set BEFORE adding this render's ids.
    const newlyArrived: typeof rows = [];
    for (const row of rows) {
      if (!seen.has(row.id)) {
        newlyArrived.push(row);
        seen.add(row.id);
      }
    }
    // On the very first room load every message is "new" — that is a load,
    // not a post. Only fire on a move that arrived AFTER the initial load.
    if (isFirstObservation || !latestId) {
      return;
    }
    const justPosted = newlyArrived.find(
      (r) => r.id === latestId && r.authorId != null && r.authorId === currentUserId,
    );
    if (!justPosted) {
      return;
    }
    const parentRow = justPosted.parentId
      ? rows.find((r) => r.id === justPosted.parentId)
      : undefined;
    setClassifiedMoveId(justPosted.id);
    // MCP-MOD-008 — assemble the room's prior moves (every move except the
    // just-posted one) in chronological order. The hook uses this to:
    //   1. Refuse classification when this is the author's FIRST move (the
    //      move-position gate from MCP-MOD-007).
    //   2. Build a stable alias map (A/B/C from distinct authors) for the
    //      priorMovesRedacted payload sent to the boundary.
    // `rows` is already chronologically ordered by `useArgumentRoomMessages`.
    const priorMoves = rows
      .filter((r) => r.id !== justPosted.id)
      .map((r) => ({ id: r.id, authorId: r.authorId, body: r.body }));
    // Fire-and-forget — the post already happened; this never blocks anything.
    void refereeOnMovePosted({
      roomId: debate.id,
      moveId: justPosted.id,
      parentId: justPosted.parentId ?? null,
      body: justPosted.body,
      parentBody: parentRow?.body ?? null,
      participantSide,
      authorId: justPosted.authorId,
      priorMoves,
      roomContext: {
        selectedMoveType: justPosted.argumentType ?? undefined,
        side:
          participantSide === 'affirmative' || participantSide === 'negative'
            ? participantSide
            : undefined,
      },
    });
  }, [rows, latestId, currentUserId, debate.id, participantSide, refereeOnMovePosted]);

  // The banner / override slice for the move MCP-019 last classified.
  const refereeMoveState = classifiedMoveId
    ? referee.getMoveState(classifiedMoveId)
    : null;

  const messages: ArgumentMessageInput[] = rows
    .filter((row) => row.status !== 'deleted')
    .map((row) => {
      // EV-002 — surface optional attached evidence from clientValidation
      // so the room shell can build the EV-001 artifact map per render.
      // Typed defensively; the JSONB shape is loose.
      const rawAttached = (row.clientValidation && typeof row.clientValidation === 'object'
        ? (row.clientValidation as { attachedEvidence?: unknown }).attachedEvidence
        : undefined);
      const attachedEvidence = Array.isArray(rawAttached)
        ? (rawAttached as Array<{ url?: string | null; label?: string | null; sourceText?: string | null; quote?: string | null }>)
        : null;
      return {
        id: row.id,
        debateId: row.debateId,
        parentId: row.parentId,
        authorId: row.authorId,
        argumentType: row.argumentType,
        side: row.side,
        body: row.body,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        qualifierLabels: (tagsByArgumentId[row.id] || []).map((t) => t.tagCode),
        attachedEvidence,
      };
    });

  const rootRow = messages.find((m) => m.parentId === null);

  const handleAction = (
    control: ArgumentBubbleControl,
    messageId: string,
    explicitPreset?: MoveDraftPatch | null,
  ) => {
    if (
      control === 'reply' ||
      control === 'disagree' ||
      control === 'ask_for_source' ||
      control === 'ask_for_quote' ||
      control === 'branch'
    ) {
      const arg = rows.find((r) => r.id === messageId);
      if (arg) {
        // Stage 6.2 M7 — push a typed composer preset BEFORE opening the
        // composer so it applies on first mount.
        //
        // COMPOSER-001 — when an upstream caller (the SC-004 dock dispatch)
        // already resolved a preset (e.g. NARROW / CONFIRM / SYNTHESIZE
        // bodies, or any other `actionDockToComposerPreset` result), use it
        // verbatim. Otherwise compute one from the bubble control just like
        // EV-002 does today. This is what wires the dock's narrow / confirm
        // / synthesize chips into the composer body.
        if (onComposerPreset) {
          const preset = explicitPreset !== undefined
            ? explicitPreset
            : (() => {
                const presetLabel =
                  control === 'disagree' ? 'challenge' :
                  control === 'ask_for_source' ? 'source' :
                  control === 'ask_for_quote' ? 'quote' :
                  control === 'branch' ? 'branch' :
                  'reply';
                return quickActionToPreset(presetLabel, arg.argumentType);
              })();
          onComposerPreset(preset);
        }
        onReply(messageId, arg);
      }
    }
  };

  if (loading && rows.length === 0) {
    return <LoadingNotice message="Loading arguments…" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={refresh} accessibilityRole="button" accessibilityLabel="Retry">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <ArgumentGameSurface
        debate={{ id: debate.id, title: debate.title, rootBody: rootRow?.body ?? null }}
        messages={messages}
        currentUserId={currentUserId}
        isAdmin={false}
        initialMode={initialMode}
        flagsByArgumentId={flagsByArgumentId}
        tagsByArgumentId={tagsByArgumentId}
        pointTagsByArgumentId={pointTagsByArgumentId}
        persistedObservationsByArgumentId={persistedObservationsByArgumentId}
        latestMessageId={latestId}
        onAction={handleAction}
        onRefresh={refresh}
        viewerRole={participantSide && participantSide !== 'observer' && participantSide !== 'moderator' ? 'participant' : 'observer'}
        participantSide={(participantSide || null) as never}
        onJoinSide={onJoinSide}
        entryHint={entryHint || undefined}
        density={density}
        reduceMotionOverride={reduceMotionOverride}
        startArgumentAction={startArgumentAction}
        onActiveMessageChange={onActiveMessageChange}
        onComposerExpand={onComposerExpand}
        composerResolution={debate.resolution ?? null}
        onLeaveRoom={onLeaveRoom}
        seatAvailability={seatAvailability}
        // MCP-019 — banner / override slice for the move just posted.
        // Both are null when the semantic layer is off (the v1 default).
        refereeBanner={refereeMoveState?.banner ?? null}
        overridePrompt={refereeMoveState?.overridePrompt ?? null}
        onConfirmOverride={(choice) => {
          if (classifiedMoveId) {
            referee.confirmOverride(classifiedMoveId, {
              chosenLane: choice.chosenLane,
              assertsAnswersParent: choice.assertsAnswersParent,
              overriddenByUserId: currentUserId ?? '',
              participantSide,
            });
          }
        }}
      />
    </View>
  );
}
