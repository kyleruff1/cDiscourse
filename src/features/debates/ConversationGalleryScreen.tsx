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
import type { Debate, CreateDebateInput, CreatedRoom, ParticipantSide } from './types';
import type { JoinAttemptResult } from './useDebates';
// NAV-START-ARGUMENT-001 Slice A — the New Argument surface is replaced by
// the declaration-first Start Argument page. CreateDebateForm is no longer
// rendered here.
import { StartArgumentPage } from '../arguments/startArgument';
import type { StartArgumentSurface } from '../arguments/startArgument';
import { JoinDebatePanel } from './JoinDebatePanel';
import { LoadingNotice } from '../../components/LoadingNotice';
import { EmptyState } from '../../components/EmptyState';
import { ConversationMiniTimeline } from './ConversationMiniTimeline';
import { getBotOrTestDebateLabel } from '../devEnvironment';
import { BotRoomMarker } from './BotRoomMarker';
import { buildBotMarkingViewModel, looksLikeBotSeedTag } from './botRoomPolicyModel';
import {
  buildConversationGalleryCards,
  classifyCardToSection,
  dedupeConversationCards,
  deriveGalleryEntryHint,
  GALLERY_SECTION_DEFINITIONS,
  groupGalleryCardsBySection,
  paginateConversationGalleryCards,
  sortConversationGalleryCards,
  type ConversationBucket,
  type ConversationGalleryCard,
  type ConversationGallerySection,
  type ConversationSortMode,
  type GalleryArgumentInput,
  type GalleryEntryHint,
  type GalleryFlagInput,
  type GalleryTagInput,
  type GallerySectionDefinition,
} from './conversationGalleryModel';
// ARG-ROOM-006 — the access/feed/seat-state view-model. The gallery is a
// non-differential surface (no active/reserved counts loaded), so the deriver
// degrades public rooms to `public_open` and never enumerates reserved seats.
import { deriveRoomAccessView } from './roomAccessModel';
import { ROOM_VISIBILITY_COPY } from '../arguments/gameCopy';

interface Props {
  debates: Debate[];
  argumentsByDebateId?: Record<string, GalleryArgumentInput[]>;
  flagsByArgumentId?: Record<string, GalleryFlagInput[]>;
  tagsByArgumentId?: Record<string, GalleryTagInput[]>;
  participantCountByDebateId?: Record<string, number>;
  /**
   * INTEL-001 (#900) — OPTIONAL per-debate unaddressed argument ids from the
   * gated gallery move_marks read (supplied only when the move_marks flag is on;
   * the read itself lives in the App-level hook, never in this screen).
   * Absent => the deriver omits the dodge-chain heat term => heat byte-identical.
   */
  unaddressedMoveIdsByDebateId?: Record<string, readonly string[]>;
  joinedDebateIds?: Set<string> | string[];
  currentUserId?: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  // ARG-ROOM-008 — resolves to a `CreatedRoom` (debate + one-time inviteLink)
  // so StartArgumentPage can render the create-time copy-link box once. The
  // gallery passes this straight through to the page.
  onCreate: (input: CreateDebateInput) => Promise<CreatedRoom | null>;
  onJoin: (debateId: string, side: ParticipantSide) => Promise<JoinAttemptResult>;
  /**
   * Stage 6.4: optional entry-hint argument lets the room shell pre-activate
   * the right message and show a micro-moment label. Existing callers can
   * ignore it.
   */
  onSelect: (debate: Debate, side: ParticipantSide, entryHint?: GalleryEntryHint) => void;
  /**
   * NAV-START-ARGUMENT-001 Slice A: after the Start Argument page creates a
   * room, the caller opens that room into the surface the author chose
   * (timeline → Timeline view; card → Cards view). Optional — when omitted,
   * the gallery just dismisses the page on create.
   */
  onCreatedWithSurface?: (debate: Debate, surface: StartArgumentSurface) => void;
  /**
   * NAV-START-ARGUMENT-001 Slice B — shell-driven lane filter. When
   * provided, the gallery's active lane is owned by the shell (so the
   * global header's "My Arguments" / "Browse Arguments" items can drive
   * it); the gallery reports user lane-chip taps via `onActiveLaneChange`.
   * When BOTH are omitted the gallery falls back to internal lane state
   * (the Slice-A behavior is unchanged for every existing caller). This is
   * the standard React managed/unmanaged hybrid — no router involved.
   */
  activeLane?: ConversationGallerySection | 'all';
  onActiveLaneChange?: (lane: ConversationGallerySection | 'all') => void;
  /**
   * NAV-START-ARGUMENT-001 Slice B — shell-driven Start Argument page
   * visibility. When provided, the header's "Start An Argument" item opens
   * the Start Argument page via shell state; the gallery reports open/close
   * via `onShowCreateChange`. Omitting both keeps the internal-state
   * behavior (the gallery's own "+ New room" button still works).
   */
  showCreate?: boolean;
  onShowCreateChange?: (open: boolean) => void;
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
  unaddressedMoveIdsByDebateId,
  joinedDebateIds,
  currentUserId,
  loading,
  error,
  onRefresh,
  onCreate,
  onJoin,
  onSelect,
  onCreatedWithSurface,
  activeLane: activeLaneProp,
  onActiveLaneChange,
  showCreate: showCreateProp,
  onShowCreateChange,
}: Props) {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<ConversationSortMode>('latest_activity');
  const [pageSize, setPageSize] = useState<number>(12);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [joiningDebate, setJoiningDebate] = useState<Debate | null>(null);

  // NAV-START-ARGUMENT-001 Slice B — managed/unmanaged hybrid for the
  // active lane and the Start Argument page visibility. When the shell
  // supplies the value (header-driven nav), it is the source of truth and
  // local state mirrors it for the unmanaged fallback path; when the
  // shell omits it, the gallery owns it internally exactly as before.
  const [activeLaneLocal, setActiveLaneLocal] =
    useState<ConversationGallerySection | 'all'>('all');
  const activeLane = activeLaneProp ?? activeLaneLocal;
  const setActiveLane = (next: ConversationGallerySection | 'all') => {
    setActiveLaneLocal(next);
    onActiveLaneChange?.(next);
  };

  const [showCreateLocal, setShowCreateLocal] = useState(false);
  const showCreate = showCreateProp ?? showCreateLocal;
  const setShowCreate = (next: boolean) => {
    setShowCreateLocal(next);
    onShowCreateChange?.(next);
  };

  const allCards = useMemo(() => buildConversationGalleryCards({
    debates,
    argumentsByDebateId,
    flagsByArgumentId,
    tagsByArgumentId,
    participantCountByDebateId,
    unaddressedMoveIdsByDebateId,
    joinedDebateIds,
    currentUserId,
  }), [debates, argumentsByDebateId, flagsByArgumentId, tagsByArgumentId, participantCountByDebateId, unaddressedMoveIdsByDebateId, joinedDebateIds, currentUserId]);

  const dedupedCards = useMemo(() => dedupeConversationCards(allCards), [allCards]);
  const duplicatesCollapsed = allCards.length - dedupedCards.length;

  const filteredCards = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return dedupedCards.filter((c) => {
      if (activeLane !== 'all' && classifyCardToSection(c) !== activeLane) return false;
      if (needle && !c.searchText.includes(needle)) return false;
      return true;
    });
  }, [dedupedCards, activeLane, search]);

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
          // ARG-ROOM-005 — a full room degrades to observe (handled in the
          // room shell); the gallery panel only opens the room on a taken seat.
          const { side: joinedSide } = await onJoin(joiningDebate.id, side);
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
    // NAV-START-ARGUMENT-001 Slice A — declaration-first Start Argument page
    // replaces the old New Argument form. `onCreate` is the SAME existing
    // creation path; the chosen surface flows to the room shell so the
    // author lands in the matching view.
    return (
      <StartArgumentPage
        onCancel={() => setShowCreate(false)}
        onCreate={onCreate}
        onCreated={(created, surface) => {
          setShowCreate(false);
          onCreatedWithSurface?.(created, surface);
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
          accessibilityLabel="Start a new argument room"
          testID="gallery-new-room"
        >
          <Text style={styles.newButtonText}>+ New room</Text>
        </Pressable>
      </View>

      {/* GAL-001 — Play-lane filter chip row. Single-select, observer-safe.
          Replaces the Stage 6.3 bucket chip row; buckets remain as internal
          classification on `ConversationGalleryCard.bucket` and feed lane
          derivation but are no longer user-selectable on the gallery UI. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bucketRow}
        contentContainerStyle={styles.laneRowContent}
        accessibilityLabel="Play lane filters"
      >
        <LaneChip
          label="All lanes"
          helperLine="Show every play lane."
          active={activeLane === 'all'}
          onPress={() => { setActiveLane('all'); setPageIndex(0); }}
          testID="lane-chip-all"
          accessibilityLabel="Show all lanes"
        />
        {GALLERY_SECTION_DEFINITIONS.map((def) => (
          <LaneChip
            key={`lane-chip-${def.id}`}
            label={def.label}
            helperLine={def.helperLine}
            active={activeLane === def.id}
            onPress={() => {
              setActiveLane(activeLane === def.id ? 'all' : def.id);
              setPageIndex(0);
            }}
            testID={`lane-chip-${def.id}`}
            accessibilityLabel={`Filter by ${def.label}`}
          />
        ))}
      </ScrollView>

      <View style={styles.sortRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRowContent}>
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
            title={emptyTitleForLane(activeLane)}
            body={emptyCopyForLane(activeLane)}
          />
        ) : null}
        {/* GAL-001 — Render mode 1: single lane filter active. Show the lane
            header (label + helperLine) above the paginated cards. */}
        {activeLane !== 'all' && paged.page.length > 0 ? (
          <LaneSectionHeader laneId={activeLane} testID={`gallery-lane-header-${activeLane}`} />
        ) : null}
        {activeLane !== 'all' ? (
          paged.page.map((card) => (
            <ConversationCard
              key={`card-${card.canonicalConversationKey}`}
              card={card}
              onPress={() => {
                const debate = debates.find((d) => d.id === card.debateId);
                if (!debate) return;
                const sideToUse: ParticipantSide = debate.myParticipantSide || 'observer';
                const entryHint = deriveGalleryEntryHint(card);
                onSelect(debate, sideToUse, entryHint);
              }}
            />
          ))
        ) : (
          /* GAL-001 — Render mode 2: all lanes. Render the paginated card
             set grouped by lane; each non-empty lane gets a section header. */
          groupGalleryCardsBySection(paged.page).map((group) => (
            <View key={`lane-section-${group.id}`} style={styles.laneSection} testID={`gallery-lane-section-${group.id}`}>
              <LaneSectionHeader laneId={group.id} testID={`gallery-lane-header-${group.id}`} />
              {group.cards.map((card) => (
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
                    const entryHint = deriveGalleryEntryHint(card);
                    onSelect(debate, sideToUse, entryHint);
                  }}
                />
              ))}
            </View>
          ))
        )}
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

/**
 * GAL-001 — Lane filter chip. Replaces the Stage 6.3 BucketChip.
 *
 * Accessibility:
 *  - role=button, label is "Filter by <lane name>" (or "Show all lanes"),
 *    state.selected mirrors the active state, hint is the lane helperLine
 *    so screen readers announce what the lane means before activation.
 *  - hitSlop lifts the visual ~32px height to ~48px effective hit target
 *    (>= 44 per accessibility-targets §"Minimum bar").
 */
function LaneChip({
  label,
  helperLine,
  active,
  onPress,
  testID,
  accessibilityLabel,
}: {
  label: string;
  helperLine: string;
  active: boolean;
  onPress: () => void;
  testID: string;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      style={[styles.bucketChip, active && styles.bucketChipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={helperLine}
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      testID={testID}
    >
      <Text style={[styles.bucketChipText, active && styles.bucketChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/**
 * GAL-001 — Lane section header. Renders the lane label and helper line
 * above a lane's card list (single-lane filter mode or "all lanes" mode).
 * Pure presentational — looks up the copy by lane id.
 */
function LaneSectionHeader({ laneId, testID }: { laneId: ConversationGallerySection; testID: string }) {
  const def: GallerySectionDefinition | undefined = GALLERY_SECTION_DEFINITIONS.find((d) => d.id === laneId);
  if (!def) return null;
  return (
    <View style={styles.laneHeader} testID={testID}>
      <Text style={styles.laneHeaderLabel}>{def.label}</Text>
      <Text style={styles.laneHeaderHelper} numberOfLines={2}>{def.helperLine}</Text>
    </View>
  );
}

function emptyTitleForLane(laneId: ConversationGallerySection | 'all'): string {
  if (laneId === 'all') return 'No rooms found';
  const def = GALLERY_SECTION_DEFINITIONS.find((d) => d.id === laneId);
  return def ? `No rooms in “${def.label}”` : 'No rooms';
}

function emptyCopyForLane(laneId: ConversationGallerySection | 'all'): string {
  if (laneId === 'all') return 'Try a different lane or clear search.';
  const def = GALLERY_SECTION_DEFINITIONS.find((d) => d.id === laneId);
  return def ? def.emptyCopy : 'Try a different lane.';
}

function ConversationCard({ card, onPress }: { card: ConversationGalleryCard; onPress: () => void }) {
  const tone = HEAT_TONE[card.heatLevel];
  const headline = BUCKET_HEADLINE[card.bucket];
  const tempLabel = TEMPERAMENT_LABEL[card.temperament];
  const botKindLabel = getBotOrTestDebateLabel(card.title);
  // ARG-ROOM-006 (items a/e/f) — access view from the card's visibility +
  // status. The gallery loads no active/reserved counts, so counts are null:
  // the deriver degrades public rooms to `public_open` (never enumerates a
  // reserved seat it cannot see). `isMember` is the gallery's `hasUserJoined`.
  const accessView = deriveRoomAccessView({
    visibility: card.visibility === 'private' ? 'private' : 'public',
    openStatus: card.openStatus,
    isMember: card.hasUserJoined,
    activeCount: null,
    reservedCount: null,
  });
  // Private chrome (pill fill + a11y) is sourced from the access VIEW, not raw
  // visibility: a private room the viewer is not a member of (private_no_access —
  // the RLS-bypass defense seam, or a member whose join has not yet propagated)
  // must show NO "Private" pill/label, matching its empty badge (no enumeration).
  // Only a confirmed member (private_member) gets the private chrome.
  const isPrivate = accessView.state === 'private_member';
  // private_no_access has an EMPTY badge (badgeLabel === ''); give it a neutral
  // (empty) a11y rather than the public helper, so it neither announces "private"
  // (enumeration) nor falsely implies the room is public.
  const visibilityA11y = isPrivate
    ? ROOM_VISIBILITY_COPY.badge_private_a11y
    : accessView.badgeLabel
      ? ROOM_VISIBILITY_COPY.option_public_helper
      : '';
  /*
   * GAME-008 — the gallery card has the title but no loaded per-author bot
   * hints, so it uses the design's documented no-query degraded fallback:
   * a deterministic title-tag convention. A bot-seeded title => a synthetic
   * BotMarkingViewModel with isBotSeededRoom true and no participant
   * markings (the per-participant marker is mounted in-room where hints are
   * available). The marker renders nothing when the title carries no tag.
   */
  const botMarkingViewModel = useMemo(
    () =>
      buildBotMarkingViewModel({
        roomId: card.debateId,
        roomType: 'public',
        arguments: looksLikeBotSeedTag(card.title)
          ? [
              {
                id: `${card.debateId}-root`,
                parentId: null,
                authorId: `${card.debateId}-bot-seed`,
                argumentType: 'thesis',
                body: '',
                status: 'posted',
                createdAt: new Date(0).toISOString(),
                isBot: true,
              },
            ]
          : [],
        botHintsByUserId: looksLikeBotSeedTag(card.title)
          ? [{ userId: `${card.debateId}-bot-seed`, isBot: true }]
          : [],
      }),
    [card.debateId, card.title],
  );
  const accessibilityLabel = botKindLabel
    ? `${accessView.badgeLabel} · ${headline} · ${card.title} · Test room (${botKindLabel})`
    : `${accessView.badgeLabel} · ${headline} · ${card.title}`;
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
        {/* ARG-ROOM-006 (item f) — public/private access badge. Text carries
            the meaning (color is not the only signal). */}
        <View
          style={[styles.visibilityPill, isPrivate && styles.visibilityPillPrivate]}
          accessibilityLabel={visibilityA11y}
          testID={`gallery-card-visibility-${card.debateId}`}
        >
          <Text style={styles.visibilityPillText}>{accessView.badgeLabel}</Text>
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

      {/* GAME-008 — non-alarming "test room" marker for a bot-seeded room. */}
      {botMarkingViewModel.roomMarkerLabel.length > 0 ? (
        <View style={styles.botRoomMarkerRow}>
          <BotRoomMarker viewModel={botMarkingViewModel} context="gallery" />
        </View>
      ) : null}

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

      {/* ARG-ROOM-006 (items e/f) — plain-language access/seat line. Observers
          stay uncapped: a "full" public card still reads observe-friendly. */}
      <Text style={styles.accessLine} testID={`gallery-card-access-${card.debateId}`}>
        {accessView.accessLine}
      </Text>

      <View style={styles.actionRow}>
        <Text style={styles.actionText}>{accessView.actionLabel}</Text>
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
  laneRowContent: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
  bucketChip: { backgroundColor: '#0b1220', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#1f2937' },
  bucketChipActive: { backgroundColor: '#312e81', borderColor: '#312e81' },
  bucketChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' as const },
  bucketChipTextActive: { color: '#fff' },

  sortRow: { marginTop: 8, maxHeight: 36 },
  sortRowContent: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
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

  // GAL-001 — Per-lane section in the "all lanes" render mode.
  laneSection: { gap: 8 },
  laneHeader: { paddingTop: 4, paddingBottom: 2 },
  laneHeaderLabel: { color: '#e2e8f0', fontSize: 14, fontWeight: '800' as const, letterSpacing: 0.2 },
  laneHeaderHelper: { color: '#94a3b8', fontSize: 11, marginTop: 2 },

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
  // ARG-ROOM-006 — public/private access badge. Public + private use distinct
  // fills AND distinct text, so meaning survives a grayscale snapshot.
  visibilityPill: { backgroundColor: '#134e4a', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  visibilityPillPrivate: { backgroundColor: '#4c1d95' },
  visibilityPillText: { color: '#e2e8f0', fontSize: 10, fontWeight: '800' as const, textTransform: 'uppercase' as const, letterSpacing: 0.4 },

  cardTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700' as const, marginTop: 6 },
  starter: { color: '#64748b', fontSize: 11, marginTop: 2 },
  botRoomMarkerRow: { marginTop: 6 },

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

  accessLine: { color: '#94a3b8', fontSize: 11, lineHeight: 16, marginTop: 8 },
  actionRow: { marginTop: 8, alignItems: 'flex-end' },
  actionText: { color: '#a5b4fc', fontWeight: '800' as const, fontSize: 12 },
  actionTextSecondary: { color: '#64748b', fontSize: 10, marginTop: 2 },

  pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 8, backgroundColor: '#0b1220', borderTopWidth: 1, borderTopColor: '#1f2937' },
  pageButton: { backgroundColor: '#1f2937', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  pageButtonDisabled: { opacity: 0.4 },
  pageButtonText: { color: '#e2e8f0', fontWeight: '700' as const, fontSize: 12 },
  pageStatus: { color: '#94a3b8', fontSize: 12 },
});
