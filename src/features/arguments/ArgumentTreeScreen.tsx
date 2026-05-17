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
import type { ArgumentRow, ArgumentCache } from './types';
import type { ArgumentMessageInput, ArgumentBubbleControl } from './argumentGameSurfaceModel';
import { useAppSession } from '../session/useAppSession';

export type ArgumentViewMode = 'tree' | 'timeline' | 'stack';

interface Props {
  debate: Debate;
  onReply: (argumentId: string, argument: ArgumentRow) => void;
  /** Caller stores this ref and calls .current() to trigger a refresh from outside. */
  refreshRef?: React.MutableRefObject<(() => void) | null>;
  /** 'tree' (default) or 'timeline' track view. */
  viewMode?: ArgumentViewMode;
}

export function ArgumentTreeScreen({ debate, onReply, refreshRef, viewMode = 'tree' }: Props) {
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

  if (viewMode === 'timeline') {
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

  if (viewMode === 'stack') {
    return (
      <StackGameSurfaceMount
        debate={debate}
        cache={cache}
        visibleArgumentIds={visibleArgumentIds}
        onReply={onReply}
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

// ── Stage 6.1.8 — StackGameSurfaceMount adapter ────────────────────────────
//
// Shapes the existing ArgumentCache into ArgumentMessageInput[] for the new
// Stack + Timeline interaction surface. No service-role usage. No body
// mutation. The "Reply" action dispatches the existing onReply handler so
// the composer flow remains the source of truth for posting.

interface StackGameSurfaceMountProps {
  debate: Debate;
  cache: ArgumentCache;
  visibleArgumentIds: string[];
  onReply: (argumentId: string, argument: ArgumentRow) => void;
}

function StackGameSurfaceMount({ debate, cache, visibleArgumentIds, onReply }: StackGameSurfaceMountProps) {
  const { state } = useAppSession();
  const currentUserId = state.snapshot.userId || null;

  // Use the visible argument ids (loaded so far) — feeds the same data the
  // tree view sees. The game surface sorts them chronologically internally.
  const messages: ArgumentMessageInput[] = visibleArgumentIds
    .map((id) => cache.argumentsById[id])
    .filter((row): row is ArgumentRow => Boolean(row) && row.status !== 'deleted')
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
    }));

  // Find the root claim for fallback display title.
  const rootRow = messages.find((m) => m.parentId === null);
  const handleAction = (control: ArgumentBubbleControl, messageId: string) => {
    if (control === 'reply' || control === 'disagree' || control === 'ask_for_source' || control === 'ask_for_quote' || control === 'branch') {
      const arg = cache.argumentsById[messageId];
      if (arg) onReply(messageId, arg);
    }
    // 'flag', 'view_qualifiers', 'request_deletion' are handled inside the
    // game surface (request_deletion opens the modal sheet automatically).
  };

  return (
    <ArgumentGameSurface
      debate={{ id: debate.id, title: debate.title, rootBody: rootRow?.body ?? null }}
      messages={messages}
      currentUserId={currentUserId}
      isAdmin={false}
      onAction={handleAction}
    />
  );
}
