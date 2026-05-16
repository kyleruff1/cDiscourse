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
import { getKnownChildCount } from './argumentCache';
import { LoadingNotice } from '../../components/LoadingNotice';
import { EmptyState } from '../../components/EmptyState';
import type { Debate } from '../debates/types';
import type { ArgumentRow } from './types';

export type ArgumentViewMode = 'tree' | 'timeline';

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
