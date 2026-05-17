import React, { useEffect } from 'react';
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
import type { ArgumentRow } from './types';
import type { ArgumentMessageInput, ArgumentBubbleControl, ArgumentSurfaceMode } from './argumentGameSurfaceModel';
import type { MoveDraftPatch } from './conversationMoves';
import { useAppSession } from '../session/useAppSession';
import { useArgumentRoomMessages } from './useArgumentRoomMessages';
import { quickActionToPreset } from './quickActionPresets';

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
}

export function ArgumentTreeScreen({ debate, onReply, refreshRef, viewMode = 'tree', onComposerPreset }: Props) {
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
            body="This debate has no posted arguments. Be the first to submit."
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
}

function FullRoomGameSurfaceMount({ debate, onReply, refreshRef, initialMode, onComposerPreset }: FullRoomGameSurfaceMountProps) {
  const { state } = useAppSession();
  const currentUserId = state.snapshot.userId || null;

  const {
    messages: rows,
    tagsByArgumentId,
    flagsByArgumentId,
    loading,
    error,
    latestId,
    refresh,
  } = useArgumentRoomMessages(debate.id);

  // Register refresh so handleSubmitSuccess can trigger it from App.tsx.
  useEffect(() => {
    if (refreshRef) refreshRef.current = refresh;
  }, [refresh, refreshRef]);

  const messages: ArgumentMessageInput[] = rows
    .filter((row) => row.status !== 'deleted')
    .map((row) => ({
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
    }));

  const rootRow = messages.find((m) => m.parentId === null);

  const handleAction = (control: ArgumentBubbleControl, messageId: string) => {
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
        if (onComposerPreset) {
          const presetLabel =
            control === 'disagree' ? 'challenge' :
            control === 'ask_for_source' ? 'source' :
            control === 'ask_for_quote' ? 'quote' :
            control === 'branch' ? 'branch' :
            'reply';
          const preset = quickActionToPreset(presetLabel, arg.argumentType);
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
        latestMessageId={latestId}
        onAction={handleAction}
        onRefresh={refresh}
      />
    </View>
  );
}
