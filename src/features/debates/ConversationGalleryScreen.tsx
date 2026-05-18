/**
 * Stage 6.3 — ConversationGalleryScreen
 *
 * Card-based replacement for the sortable debates table. One card per
 * conversation/thread family (visually deduped); compact horizontal
 * mini-timeline; bucket chips; search; sort; pagination.
 *
 * Pure UI: receives `debates`, `argumentsByDebateId`, optional flag/tag/
 * participant maps as props. No Supabase calls, no Anthropic, no xAI.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Debate, CreateDebateInput, ParticipantSide } from './types';
import { CreateDebateForm } from './CreateDebateForm';
import { JoinDebatePanel } from './JoinDebatePanel';
import { LoadingNotice } from '../../components/LoadingNotice';
import { EmptyState } from '../../components/EmptyState';
import { ConversationMiniTimeline } from './ConversationMiniTimeline';
import { getBotOrTestDebateLabel } from '../devEnvironment';
import {
  BUCKET_DEFINITIONS,
  buildConversationGalleryCards,
  dedupeConversationCards,
  deriveConversationEntryHint,
  paginateConversationGalleryCards,
  sortConversationGalleryCards,
  type ConversationBucket,
  type ConversationGalleryCard,
  type ConversationSortMode,
  type GalleryArgumentInput,
  type GalleryFlagInput,
  type GalleryTagInput,
} from './conversationGalleryModel';

interface Props {
  debates: Debate[];
  argumentsByDebateId?: Record<string, GalleryArgumentInput[]>;
  flagsByArgumentId?: Record<string, GalleryFlagInput[]>;
  tagsByArgumentId?: Record<string, GalleryTagInput[]>;
  participantCountByDebateId?: Record<string, number>;
  joinedDebateIds?: Set<string> | string[];
  currentUserId?: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onCreate: (input: CreateDebateInput) => Promise<Debate | null>;
  onJoin: (debateId: string, side: ParticipantSide) => Promise<ParticipantSide | null>;
  /**
   * Stage 6.4: optional entry-hint argument lets the room shell pre-activate
   * the right message and show a micro-moment label. Existing callers can
   * ignore it.
   */
  onSelect: (debate: Debate, side: ParticipantSide, entryHint?: { activate: 'root' | 'latest' | 'first_open_challenge'; microMomentLabel: string }) => void;
}

const SORT_OPTIONS: { id: ConversationSortMode; label: string }[] = [
  { id: 'latest_activity', label: 'Latest activity' },
  { id: 'newest_created', label: 'Newest created' },
  { id: 'heat', label: 'Heat' },
  { id: 'needs_rebuttal_first', label: 'Needs rebuttal first' },
  { id: 'most_moves', label: 'Most moves' },
  { id: 'oldest_unresolved', label: 'Oldest unresolved' },
];

const PAGE_SIZE_OPTIONS = [12, 24, 48];

const HEAT_TONE: Record<ConversationGalleryCard['heatLevel'], { bg: string; fg: string; label: string }> = {
  cold: { bg: '#1e293b', fg: '#94a3b8', label: 'Cold' },
  warming: { bg: '#7c2d12', fg: '#fed7aa', label: 'Warming' },
  hot: { bg: '#9a3412', fg: '#fde68a', label: 'Hot' },
  overheated: { bg: '#7f1d1d', fg: '#fecaca', label: 'Overheated' },
};

const TEMPERAMENT_LABEL: Record<ConversationGalleryCard['temperament'], string> = {
  plain: 'Plain',
  curious: 'Curious',
  sharp: 'Sharp',
  pedantic: 'Pedantic',
  evidence_heavy: 'Evidence-heavy',
  source_chain_heavy: 'Source-chain-heavy',
  chaotic: 'Chaotic',
  near_resolution: 'Closing in',
};

const BUCKET_HEADLINE: Record<ConversationBucket, string> = {
  needs_rebuttal: 'Needs first rebuttal',
  gaining_heat: 'Heating up',
  hot_now: 'Hot now',
  source_chain_fight: 'Hot source-chain fight',
  evidence_fight: 'Evidence fight',
  definition_scope_fight: 'Definition trap',
  pedantic_plain: 'Quiet room',
  unresolved_deep_chain: 'Deep unresolved chain',
  resolved_or_synthesized: 'Resolved',
  my_rooms: 'Your room',
  all_open: 'Open room',
};

export function ConversationGalleryScreen({
  debates,
  argumentsByDebateId,
  flagsByArgumentId,
  tagsByArgumentId,
  participantCountByDebateId,
  joinedDebateIds,
  currentUserId,
  loading,
  error,
  onRefresh,
  onCreate,
  onJoin,
  onSelect,
}: Props) {
  const [search, setSearch] = useState('');
  const [activeBucket, setActiveBucket] = useState<ConversationBucket | 'any'>('any');
  const [sortMode, setSortMode] = useState<ConversationSortMode>('latest_activity');
  const [pageSize, setPageSize] = useState<number>(12);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [showCreate, setShowCreate] = useState(false);
  const [joiningDebate, setJoiningDebate] = useState<Debate | null>(null);

  const allCards = useMemo(() => buildConversationGalleryCards({
    debates,
    argumentsByDebateId,
    flagsByArgumentId,
    tagsByArgumentId,
    participantCountByDebateId,
    joinedDebateIds,
    currentUserId,
  }), [debates, argumentsByDebateId, flagsByArgumentId, tagsByArgumentId, participantCountByDebateId, joinedDebateIds, currentUserId]);

  const dedupedCards = useMemo(() => dedupeConversationCards(allCards), [allCards]);
  const duplicatesCollapsed = allCards.length - dedupedCards.length;

  const filteredCards = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return dedupedCards.filter((c) => {
      if (activeBucket !== 'any' && c.bucket !== activeBucket) return false;
      if (needle && !c.searchText.includes(needle)) return false;
      return true;
    });
  }, [dedupedCards, activeBucket, search]);

  const sorted = useMemo(() => sortConversationGalleryCards(filteredCards, sortMode), [filteredCards, sortMode]);
  const paged = useMemo(() => paginateConversationGalleryCards(sorted, pageSize, pageIndex), [sorted, pageSize, pageIndex]);

  // Clamp page index when the result set shrinks.
  useEffect(() => {
    if (pageIndex > 0 && pageIndex >= paged.pageCount) setPageIndex(Math.max(0, paged.pageCount - 1));
  }, [pageIndex, paged.pageCount]);

  // Stage 6.4: the explicit JoinDebatePanel is kept mounted only when an
  // action genuinely requires picking a side (Join Aff / Join Neg from
  // the in-room action rail). Default gallery entry skips this panel.
  if (joiningDebate) {
    return (
      <JoinDebatePanel
        debate={joiningDebate}
        onJoin={async (side: ParticipantSide) => {
          const joinedSide = await onJoin(joiningDebate.id, side);
          if (joinedSide) {
            onSelect(joiningDebate, joinedSide);
            setJoiningDebate(null);
          }
        }}
        onCancel={() => setJoiningDebate(null)}
      />
    );
  }
  if (showCreate) {
    return (
      <CreateDebateForm
        onCancel={() => setShowCreate(false)}
        onSubmit={async (input: CreateDebateInput) => {
          const created = await onCreate(input);
          if (created) setShowCreate(false);
        }}
      />
    );
  }

  return (
    <View style={styles.container} testID="conversation-gallery-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Arguments</Text>
        <Text style={styles.subtitle}>Find a room to join</Text>
      </View>

      <View style={styles.controls}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={(v) => { setSearch(v); setPageIndex(0); }}
          placeholder="Search rooms (title, body, axis, frame)…"
          placeholderTextColor="#64748b"
          accessibilityLabel="Search rooms"
          testID="gallery-search-input"
        />
        <Pressable
          style={styles.newButton}
          onPress={() => setShowCreate(true)}
          accessibilityRole="button"
          accessibilityLabel="Start a new debate room"
          testID="gallery-new-room"
        >
          <Text style={styles.newButtonText}>+ New room</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bucketRow} contentContainerStyle={styles.bucketRowInner}>
        <BucketChip label="Any" active={activeBucket === 'any'} onPress={() => { setActiveBucket('any'); setPageIndex(0); }} testID="bucket-chip-any" />
        {BUCKET_DEFINITIONS.map((b) => (
          <BucketChip
            key={`chip-${b.id}`}
            label={b.label}
            active={activeBucket === b.id}
            onPress={() => { setActiveBucket(b.id); setPageIndex(0); }}
            testID={`bucket-chip-${b.id}`}
          />
        ))}
      </ScrollView>

      <View style={styles.sortRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRowInner}>
          {SORT_OPTIONS.map((o) => (
            <Pressable
              key={`sort-${o.id}`}
              style={[styles.sortChip, sortMode === o.id && styles.sortChipActive]}
              onPress={() => { setSortMode(o.id); setPageIndex(0); }}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${o.label}`}
              accessibilityState={{ selected: sortMode === o.id }}
              testID={`sort-chip-${o.id}`}
            >
              <Text style={[styles.sortChipText, sortMode === o.id && styles.sortChipTextActive]}>{o.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {paged.total} room{paged.total === 1 ? '' : 's'}
          {duplicatesCollapsed > 0 ? ` · ${duplicatesCollapsed} duplicate run${duplicatesCollapsed === 1 ? '' : 's'} collapsed` : ''}
        </Text>
        <View style={styles.pageSizeRow}>
          {PAGE_SIZE_OPTIONS.map((s) => (
            <Pressable
              key={`pgsize-${s}`}
              style={[styles.pageSizeChip, pageSize === s && styles.pageSizeChipActive]}
              onPress={() => { setPageSize(s); setPageIndex(0); }}
              accessibilityRole="button"
              accessibilityLabel={`Show ${s} per page`}
              testID={`page-size-${s}`}
            >
              <Text style={[styles.pageSizeText, pageSize === s && styles.pageSizeTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading && paged.page.length === 0 ? (
        <LoadingNotice message="Loading rooms…" />
      ) : null}
      {error ? (
        <Pressable style={styles.errorBanner} onPress={onRefresh} accessibilityRole="button" accessibilityLabel="Retry">
          <Text style={styles.errorText}>{error} — tap to retry</Text>
        </Pressable>
      ) : null}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {paged.page.length === 0 ? (
          <EmptyState
            title={emptyTitleForBucket(activeBucket)}
            body={emptyCopyForBucket(activeBucket)}
          />
        ) : null}
        {paged.page.map((card) => (
          <ConversationCard
            key={`card-${card.canonicalConversationKey}`}
            card={card}
            onPress={() => {
              const debate = debates.find((d) => d.id === card.debateId);
              if (!debate) return;
              // Stage 6.4: Observer-first entry. Existing participants
              // keep their actual side; everyone else enters as observer.
              // The in-room action rail is the ONLY join surface.
              const sideToUse: ParticipantSide = debate.myParticipantSide || 'observer';
              const entryHint = deriveConversationEntryHint(card);
              onSelect(debate, sideToUse, entryHint);
            }}
          />
        ))}
      </ScrollView>

      {paged.pageCount > 1 ? (
        <View style={styles.pagerRow} testID="gallery-pager">
          <Pressable
            style={[styles.pageButton, paged.pageIndex === 0 && styles.pageButtonDisabled]}
            onPress={() => setPageIndex((i) => Math.max(0, i - 1))}
            disabled={paged.pageIndex === 0}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
            testID="gallery-pager-prev"
          >
            <Text style={styles.pageButtonText}>‹ Prev</Text>
          </Pressable>
          <Text style={styles.pageStatus}>Page {paged.pageIndex + 1} of {paged.pageCount}</Text>
          <Pressable
            style={[styles.pageButton, paged.pageIndex >= paged.pageCount - 1 && styles.pageButtonDisabled]}
            onPress={() => setPageIndex((i) => Math.min(paged.pageCount - 1, i + 1))}
            disabled={paged.pageIndex >= paged.pageCount - 1}
            accessibilityRole="button"
            accessibilityLabel="Next page"
            testID="gallery-pager-next"
          >
            <Text style={styles.pageButtonText}>Next ›</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function BucketChip({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable
      style={[styles.bucketChip, active && styles.bucketChipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filter: ${label}`}
      accessibilityState={{ selected: active }}
      testID={testID}
    >
      <Text style={[styles.bucketChipText, active && styles.bucketChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function emptyTitleForBucket(b: ConversationBucket | 'any'): string {
  if (b === 'any') return 'No rooms found';
  const def = BUCKET_DEFINITIONS.find((d) => d.id === b);
  return def ? `No rooms in “${def.label}”` : 'No rooms';
}
function emptyCopyForBucket(b: ConversationBucket | 'any'): string {
  if (b === 'any') return 'Try a different bucket or clear search.';
  const def = BUCKET_DEFINITIONS.find((d) => d.id === b);
  return def ? def.emptyCopy : 'Try a different bucket.';
}

function ConversationCard({ card, onPress }: { card: ConversationGalleryCard; onPress: () => void }) {
  const tone = HEAT_TONE[card.heatLevel];
  const headline = BUCKET_HEADLINE[card.bucket];
  const tempLabel = TEMPERAMENT_LABEL[card.temperament];
  const botKindLabel = getBotOrTestDebateLabel(card.title);
  const accessibilityLabel = botKindLabel
    ? `${headline} · ${card.title} · Test room (${botKindLabel})`
    : `${headline} · ${card.title}`;
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={`gallery-card-${card.debateId}`}
    >
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeadlineWrap}>
          <Text style={styles.cardHeadline}>{headline}</Text>
        </View>
        {botKindLabel ? (
          <View style={styles.botPill} testID={`gallery-card-bot-${card.debateId}`}>
            <Text style={styles.botPillText}>{`Test · ${botKindLabel}`}</Text>
          </View>
        ) : null}
        <View style={[styles.heatPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.heatPillText, { color: tone.fg }]}>{tone.label}</Text>
        </View>
        <View style={styles.tempPill}>
          <Text style={styles.tempPillText}>{tempLabel}</Text>
        </View>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{card.title}</Text>
      <Text style={styles.starter} numberOfLines={1}>
        Started by {card.starterDisplayName}
        {card.duplicateCount > 1 ? ` · ${card.duplicateCount} duplicate runs collapsed` : ''}
      </Text>

      {card.firstPostExcerpt ? (
        <View style={styles.excerptBlock}>
          <Text style={styles.excerptLabel}>FIRST POST</Text>
          <Text style={styles.excerptText} numberOfLines={3}>{card.firstPostExcerpt}</Text>
        </View>
      ) : null}
      {card.latestPostExcerpt && card.latestPostExcerpt !== card.firstPostExcerpt ? (
        <View style={styles.excerptBlock}>
          <Text style={styles.excerptLabel}>LATEST · {card.latestPostAuthor}</Text>
          <Text style={styles.excerptText} numberOfLines={3}>{card.latestPostExcerpt}</Text>
        </View>
      ) : null}

      <ConversationMiniTimeline
        segments={card.timelinePreviewSegments}
        unresolved={Boolean(card.unresolvedReason)}
        resolved={Boolean(card.stopReason && /synthesis|concession|resolved/i.test(card.stopReason))}
        accessibilityPrefix={card.title}
      />

      <View style={styles.statsRow}>
        <Stat label="Moves" value={String(card.moveCount)} testID={`card-moves-${card.debateId}`} />
        <Stat label="Replies" value={String(card.rebuttalCount)} testID={`card-replies-${card.debateId}`} />
        <Stat label="Participants" value={String(card.participantCount)} testID={`card-participants-${card.debateId}`} />
      </View>

      {card.signals.length > 0 ? (
        <View style={styles.signalRow}>
          {card.signals.slice(0, 4).map((s) => (
            <View
              key={`sig-${card.debateId}-${s.code}`}
              style={[
                styles.signalChip,
                s.tone === 'critical' && styles.signalChipCritical,
                s.tone === 'warning' && styles.signalChipWarning,
                s.tone === 'positive' && styles.signalChipPositive,
              ]}
              testID={`card-signal-${s.code}`}
            >
              <Text style={styles.signalChipText}>{s.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <Text style={styles.actionText}>
          {card.hasUserJoined ? 'Continue →' : card.openStatus === 'open' ? 'Observe →' : 'Open →'}
        </Text>
        {!card.hasUserJoined && card.openStatus === 'open' ? (
          <Text style={styles.actionTextSecondary}>Jump in from inside</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function Stat({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View style={styles.statBlock} testID={testID}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  title: { color: '#f8fafc', fontSize: 22, fontWeight: '800' as const },
  subtitle: { color: '#94a3b8', fontSize: 12, marginTop: 2 },

  controls: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  search: { flex: 1, backgroundColor: '#0b1220', color: '#f8fafc', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#1f2937' },
  newButton: { backgroundColor: '#312e81', borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center' },
  newButtonText: { color: '#fff', fontWeight: '700' as const, fontSize: 12 },

  bucketRow: { marginTop: 10, maxHeight: 44 },
  bucketRowInner: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
  bucketChip: { backgroundColor: '#0b1220', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#1f2937' },
  bucketChipActive: { backgroundColor: '#312e81', borderColor: '#312e81' },
  bucketChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' as const },
  bucketChipTextActive: { color: '#fff' },

  sortRow: { marginTop: 8, maxHeight: 36 },
  sortRowInner: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
  sortChip: { backgroundColor: 'transparent', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#1f2937' },
  sortChipActive: { borderColor: '#a5b4fc', backgroundColor: '#1e1b4b' },
  sortChipText: { color: '#64748b', fontSize: 11, fontWeight: '700' as const },
  sortChipTextActive: { color: '#e2e8f0' },

  countRow: { paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countText: { color: '#64748b', fontSize: 11 },
  pageSizeRow: { flexDirection: 'row', gap: 4 },
  pageSizeChip: { backgroundColor: '#0b1220', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#1f2937' },
  pageSizeChipActive: { borderColor: '#a5b4fc' },
  pageSizeText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' as const },
  pageSizeTextActive: { color: '#e2e8f0' },

  errorBanner: { backgroundColor: '#7f1d1d', marginHorizontal: 16, marginTop: 8, padding: 8, borderRadius: 8 },
  errorText: { color: '#fecaca', fontSize: 12 },

  list: { flex: 1, marginTop: 8 },
  listContent: { padding: 12, gap: 10 },

  card: { backgroundColor: '#0b1220', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1f2937' },
  cardPressed: { borderColor: '#a5b4fc' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardHeadlineWrap: { flex: 1 },
  cardHeadline: { color: '#a5b4fc', fontWeight: '800' as const, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  heatPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  heatPillText: { fontSize: 10, fontWeight: '800' as const, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  tempPill: { backgroundColor: '#1f2937', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  tempPillText: { color: '#94a3b8', fontSize: 10, fontWeight: '700' as const },
  botPill: { backgroundColor: '#78350f', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  botPillText: { color: '#fef3c7', fontSize: 10, fontWeight: '800' as const, textTransform: 'uppercase' as const, letterSpacing: 0.4 },

  cardTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700' as const, marginTop: 6 },
  starter: { color: '#64748b', fontSize: 11, marginTop: 2 },

  excerptBlock: { marginTop: 8 },
  excerptLabel: { color: '#64748b', fontSize: 9, fontWeight: '800' as const, letterSpacing: 0.4 },
  excerptText: { color: '#cbd5e1', fontSize: 13, lineHeight: 18, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  statBlock: { alignItems: 'center' },
  statValue: { color: '#f8fafc', fontWeight: '800' as const, fontSize: 14 },
  statLabel: { color: '#64748b', fontSize: 10, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.4 },

  signalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  signalChip: { backgroundColor: '#1f2937', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  signalChipCritical: { backgroundColor: '#7f1d1d' },
  signalChipWarning: { backgroundColor: '#7c2d12' },
  signalChipPositive: { backgroundColor: '#064e3b' },
  signalChipText: { color: '#f8fafc', fontSize: 9, fontWeight: '700' as const },

  actionRow: { marginTop: 8, alignItems: 'flex-end' },
  actionText: { color: '#a5b4fc', fontWeight: '800' as const, fontSize: 12 },
  actionTextSecondary: { color: '#64748b', fontSize: 10, marginTop: 2 },

  pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 8, backgroundColor: '#0b1220', borderTopWidth: 1, borderTopColor: '#1f2937' },
  pageButton: { backgroundColor: '#1f2937', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  pageButtonDisabled: { opacity: 0.4 },
  pageButtonText: { color: '#e2e8f0', fontWeight: '700' as const, fontSize: 12 },
  pageStatus: { color: '#94a3b8', fontSize: 12 },
});
