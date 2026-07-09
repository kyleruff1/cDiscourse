/**
 * HOME-001 (#874) — ArgumentHome.tsx  ("Your table")
 *
 * The resume-first signed-in landing surface, behind the home_v2 flag. Top to
 * bottom: a your-turn strip (disputes waiting on you, one tap back into the
 * awaited node via the existing entry-hint pre-activation), opponent-forward
 * ongoing cards, one + Start CTA, a collapsed floor door to the public gallery,
 * and an activity module (the existing notification list, read-only reuse).
 *
 * NO new query / network: it re-runs the PURE buildConversationGalleryCards on
 * the already-loaded gallery inputs and projects them via the pure home model.
 * Zero Anthropic / xAI / X / Supabase call is added by this surface (AC6).
 *
 * Doctrine + a11y: no standing / band / winner / verdict is rendered; every
 * Pressable has role + label + state and meets 44px (visual or hitSlop); the
 * verb text (not color) carries the action; the your-turn ring is a STATIC ring
 * (reduce-motion safe); the 390px band reuses useHeaderBreakpoint / resolveBand.
 */
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  buildConversationGalleryCards,
  dedupeConversationCards,
  deriveGalleryEntryHint,
  type ConversationGalleryCard,
  type GalleryArgumentInput,
  type GalleryEntryHint,
} from '../debates/conversationGalleryModel';
import type { Debate, ParticipantSide } from '../debates/types';
import {
  buildArgumentHomeViewModel,
  collectUnreadDebateIds,
} from './homeModel';
import { ArgumentCard, type ArgumentCardState } from './ArgumentCard';
import { NotificationRow } from '../notifications/NotificationRow';
import {
  resolveDeepLink,
  type NotificationDeepLink,
  type RoomNotification,
} from '../notifications/notificationModel';
import { HOME_COPY } from '../arguments/gameCopy';
import { LoadingNotice } from '../../components/LoadingNotice';
import { EmptyState } from '../../components/EmptyState';
import { SURFACE_TOKENS, CONTROL, TOUCH_TARGET } from '../../lib/designTokens';
import { useHeaderBreakpoint } from '../../hooks/useHeaderBreakpoint';
import { CircleFilterRow } from '../circles/CircleFilterRow';
import {
  buildCircleIdIndex,
  filterArgumentHomeByCircle,
  type CircleLens,
} from '../circles/circleHomeFilter';

/** How many notifications the home activity module surfaces (bounded reuse). */
const ACTIVITY_MODULE_LIMIT = 5;

export interface ArgumentHomeProps {
  debates: Debate[];
  argumentsByDebateId: Record<string, GalleryArgumentInput[]>;
  currentUserId: string | null;
  isAdminViewer: boolean;
  notifications: RoomNotification[];
  unreadCount: number;
  notificationsLoading: boolean;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  /** Open a dispute with the awaited node pre-activated (J2 resume wiring). */
  onOpen: (
    debate: Debate,
    side: ParticipantSide | null,
    entryHint: GalleryEntryHint | null,
  ) => void;
  /**
   * Route to today's start page (START-001 mounts the sheet here). HOME-003
   * widens this to accept an optional circle id for the filtered-empty Start
   * CTA (backwards-compatible; a plain `() => void` handler still satisfies it).
   */
  onStart: (circleId?: string) => void;
  /** HOME-003 (#840) — the caller's circles (mapped in App.tsx from START-002). */
  circles?: CircleLens[];
  /** HOME-003 — optional loading flag for the circle read. */
  circlesLoading?: boolean;
  /** Open the public floor (gallery) — setGalleryLane('all'). */
  onOpenFloor: () => void;
  /** Open the demo corridor — reused trigger. */
  onOpenDemoCorridor: () => void;
  /** Existing notification deep-link handler (activity module). */
  onOpenNotificationDeepLink: (
    link: NotificationDeepLink,
    notification: RoomNotification,
  ) => void;
}

/** Ongoing (non-your-turn joined) card state: closed rooms rest, else waiting. */
function ongoingState(card: ConversationGalleryCard): ArgumentCardState {
  return card.openStatus !== 'open' ? 'resting' : 'waiting';
}

export function ArgumentHome(props: ArgumentHomeProps): React.ReactElement {
  const {
    debates,
    argumentsByDebateId,
    currentUserId,
    isAdminViewer,
    notifications,
    notificationsLoading,
    loading,
    error,
    onRefresh,
    onOpen,
    onStart,
    onOpenFloor,
    onOpenDemoCorridor,
    onOpenNotificationDeepLink,
    circles = [],
    circlesLoading = false,
  } = props;

  const { band } = useHeaderBreakpoint();
  const isPhone = band === 'phone';

  // HOME-003 (#840) — circle-home filter lens. `null` = "All" (no filter): the
  // lane is byte-identical to HOME-001.
  const [selectedCircleId, setSelectedCircleId] = React.useState<string | null>(null);

  // Re-run the PURE gallery build on the already-loaded inputs, then dedupe —
  // exactly what ConversationGalleryScreen does. No new query.
  const cards = useMemo(
    () =>
      dedupeConversationCards(
        buildConversationGalleryCards({
          debates,
          argumentsByDebateId,
          currentUserId,
        }),
      ),
    [debates, argumentsByDebateId, currentUserId],
  );

  const unreadDebateIds = useMemo(() => collectUnreadDebateIds(notifications), [notifications]);

  const vm = useMemo(
    () =>
      buildArgumentHomeViewModel({
        cards,
        debates,
        unreadDebateIds,
        isAdminViewer,
      }),
    [cards, debates, unreadDebateIds, isAdminViewer],
  );

  const debateById = useMemo(() => {
    const m = new Map<string, Debate>();
    for (const d of debates) m.set(d.id, d);
    return m;
  }, [debates]);

  // HOME-003 — per-debate circle id index (from the widened debates load), and
  // the circle-filtered projection. The filter runs AFTER the VM (D8 fixture
  // exclusion already applied), so a circle can never resurface an excluded
  // fixture room. When no circle is selected the filter returns the VM's own
  // references unchanged (zero-diff to HOME-001).
  const circleIdByDebateId = useMemo(() => buildCircleIdIndex(debates), [debates]);
  const filtered = useMemo(
    () =>
      filterArgumentHomeByCircle({
        yourTurn: vm.yourTurn,
        ongoing: vm.ongoing,
        circleIdByDebateId,
        selectedCircleId,
      }),
    [vm, circleIdByDebateId, selectedCircleId],
  );
  const circleFilterActive = selectedCircleId !== null;
  const filteredEmpty =
    circleFilterActive && filtered.yourTurn.length === 0 && filtered.ongoing.length === 0;
  const showCircleRow = !circlesLoading && circles.length > 0;

  const openCard = useCallback(
    (card: ConversationGalleryCard, entryHint: GalleryEntryHint): void => {
      const debate = debateById.get(card.debateId);
      if (!debate) return;
      onOpen(debate, debate.myParticipantSide ?? card.mySide ?? null, entryHint);
    },
    [debateById, onOpen],
  );

  const handleNotificationPress = useCallback(
    (n: RoomNotification): void => {
      const link = resolveDeepLink(n);
      if (link === null) return; // non-navigable rows are read-only here
      onOpenNotificationDeepLink(link, n);
    },
    [onOpenNotificationDeepLink],
  );

  if (loading && cards.length === 0) {
    return (
      <View style={styles.root} testID="argument-home">
        <LoadingNotice />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.root} testID="argument-home">
        <EmptyState
          title="We could not load your table."
          body={error}
          actionLabel="Try again"
          onAction={onRefresh}
        />
      </View>
    );
  }

  const contentPadding = isPhone ? 12 : 16;
  const stripCardWidth = isPhone ? 280 : 320;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { padding: contentPadding }]}
      testID="argument-home"
    >
      {vm.isFirstRun ? (
        <FirstRunEmptyState
          onStart={onStart}
          onOpenFloor={onOpenFloor}
          onOpenDemoCorridor={onOpenDemoCorridor}
        />
      ) : (
        <>
          {/* HOME-003 — circle filter lens above the content it narrows. */}
          {showCircleRow ? (
            <CircleFilterRow
              circles={circles}
              selectedCircleId={selectedCircleId}
              onSelect={setSelectedCircleId}
            />
          ) : null}

          {filteredEmpty ? (
            <View style={styles.circleEmpty} testID="home-circle-empty">
              <Text style={styles.circleEmptyHeadline}>{HOME_COPY.circleFilterEmptyHeadline}</Text>
              <Text style={styles.circleEmptyBody}>{HOME_COPY.circleFilterEmptyBody}</Text>
              <Pressable
                onPress={() => onStart(selectedCircleId ?? undefined)}
                accessibilityRole="button"
                accessibilityLabel={HOME_COPY.circleFilterStartCta}
                accessibilityState={{}}
                hitSlop={TOUCH_TARGET.hitSlopCompact}
                style={({ pressed }) => [styles.startCta, pressed && styles.pressed]}
                testID="home-circle-empty-start"
              >
                <Text style={styles.startCtaText}>{HOME_COPY.circleFilterStartCta}</Text>
              </Pressable>
            </View>
          ) : null}

          {!filteredEmpty && filtered.yourTurn.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading} accessibilityRole="header">
                {HOME_COPY.yourTurnHeading}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                accessibilityRole="list"
                contentContainerStyle={styles.strip}
                testID="home-your-turn-strip"
              >
                {filtered.yourTurn.map((item) => (
                  <View key={item.card.debateId} style={{ width: stripCardWidth }}>
                    <ArgumentCard
                      card={item.card}
                      entryHint={item.entryHint}
                      viewerId={currentUserId}
                      state="your_turn"
                      onPress={() => openCard(item.card, item.entryHint)}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {!filteredEmpty && filtered.ongoing.length > 0 ? (
            <View style={styles.section} testID="home-ongoing-list">
              <Text style={styles.sectionHeading} accessibilityRole="header">
                {HOME_COPY.ongoingHeading}
              </Text>
              {filtered.ongoing.map((card) => {
                const entryHint = deriveGalleryEntryHint(card);
                return (
                  <ArgumentCard
                    key={card.debateId}
                    card={card}
                    entryHint={entryHint}
                    viewerId={currentUserId}
                    state={ongoingState(card)}
                    onPress={() => openCard(card, entryHint)}
                  />
                );
              })}
            </View>
          ) : null}

          {/* One primary CTA. */}
          <Pressable
            onPress={() => onStart()}
            accessibilityRole="button"
            accessibilityLabel={HOME_COPY.startCta}
            accessibilityState={{}}
            hitSlop={TOUCH_TARGET.hitSlopCompact}
            style={({ pressed }) => [styles.startCta, pressed && styles.pressed]}
            testID="home-start-cta"
          >
            <Text style={styles.startCtaText}>+ {HOME_COPY.startCta}</Text>
          </Pressable>

          {/* The floor door — collapsed entry to the public gallery. */}
          <Pressable
            onPress={onOpenFloor}
            accessibilityRole="button"
            accessibilityLabel={HOME_COPY.floorDoorA11yLabel}
            accessibilityHint={HOME_COPY.floorDoorA11yHint}
            accessibilityState={{}}
            hitSlop={TOUCH_TARGET.hitSlopCompact}
            style={({ pressed }) => [styles.floorDoor, pressed && styles.pressed]}
            testID="home-floor-door"
          >
            <View style={styles.floorDoorTextWrap}>
              <Text style={styles.floorDoorLabel}>{HOME_COPY.floorDoorLabel}</Text>
              <Text style={styles.floorDoorSub}>{HOME_COPY.floorDoorSublabel}</Text>
            </View>
            <Text style={styles.floorDoorChevron}>›</Text>
          </Pressable>

          {/* Activity module — bounded reuse of the existing notification list. */}
          <View style={styles.section} testID="home-activity-module">
            <Text style={styles.sectionHeading} accessibilityRole="header">
              {HOME_COPY.activityHeading}
            </Text>
            {notificationsLoading && notifications.length === 0 ? (
              <LoadingNotice />
            ) : notifications.length === 0 ? (
              <Text style={styles.activityEmpty}>No recent activity.</Text>
            ) : (
              notifications
                .slice(0, ACTIVITY_MODULE_LIMIT)
                .map((n) => (
                  <NotificationRow key={n.id} notification={n} onPress={handleNotificationPress} />
                ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/** J1 first-run empty state: exactly three verbs + start-first + demo link. */
function FirstRunEmptyState({
  onStart,
  onOpenFloor,
  onOpenDemoCorridor,
}: {
  onStart: () => void;
  onOpenFloor: () => void;
  onOpenDemoCorridor: () => void;
}): React.ReactElement {
  return (
    <View style={styles.emptyState} testID="home-empty-state">
      <Text style={styles.emptyHeadline}>{HOME_COPY.firstRunHeadline}</Text>

      <View style={styles.verbRow}>
        <VerbButton
          label={HOME_COPY.verbResume}
          hint="Find a public dispute to jump into."
          onPress={onOpenFloor}
          testID="home-empty-verb-resume"
        />
        <VerbButton
          label={HOME_COPY.verbStartWithSomeone}
          hint="Open the start page to begin a new argument."
          onPress={onStart}
          testID="home-empty-verb-start"
        />
        <VerbButton
          label={HOME_COPY.verbWatchFloor}
          hint={HOME_COPY.floorDoorA11yHint}
          onPress={onOpenFloor}
          testID="home-empty-verb-floor"
        />
      </View>

      <Pressable
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel={HOME_COPY.startFirstArgument}
        accessibilityState={{}}
        hitSlop={TOUCH_TARGET.hitSlopCompact}
        style={({ pressed }) => [styles.startCta, pressed && styles.pressed]}
        testID="home-empty-start-first"
      >
        <Text style={styles.startCtaText}>{HOME_COPY.startFirstArgument}</Text>
      </Pressable>

      <Pressable
        onPress={onOpenDemoCorridor}
        accessibilityRole="button"
        accessibilityLabel={HOME_COPY.seeARealOne}
        accessibilityHint="A short guided walkthrough of one disagreement, using the real room."
        accessibilityState={{}}
        hitSlop={TOUCH_TARGET.hitSlopCompact}
        style={({ pressed }) => [styles.demoLink, pressed && styles.pressed]}
        testID="home-demo-corridor-link"
      >
        <Text style={styles.demoLinkText}>{HOME_COPY.seeARealOne}</Text>
      </Pressable>
    </View>
  );
}

function VerbButton({
  label,
  hint,
  onPress,
  testID,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  testID: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{}}
      hitSlop={TOUCH_TARGET.hitSlopCompact}
      style={({ pressed }) => [styles.verbButton, pressed && styles.pressed]}
      testID={testID}
    >
      <Text style={styles.verbButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SURFACE_TOKENS.base,
  },
  content: {
    gap: 18,
  },
  section: {
    gap: 8,
  },
  sectionHeading: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  strip: {
    gap: 10,
    paddingRight: 4,
  },
  startCta: {
    minHeight: TOUCH_TARGET.minSizePx,
    backgroundColor: CONTROL.primary.bg,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  startCtaText: {
    color: CONTROL.primary.fg,
    fontSize: 15,
    fontWeight: '700',
  },
  floorDoor: {
    minHeight: TOUCH_TARGET.minSizePx,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SURFACE_TOKENS.elevated,
    borderColor: SURFACE_TOKENS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  floorDoorTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  floorDoorLabel: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  floorDoorSub: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  floorDoorChevron: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 22,
    marginLeft: 12,
  },
  activityEmpty: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 13,
    paddingVertical: 8,
  },
  // HOME-003 — circle filtered-empty block (never a dead end).
  circleEmpty: {
    gap: 8,
    paddingVertical: 16,
    alignItems: 'flex-start',
  },
  circleEmptyHeadline: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  circleEmptyBody: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.85,
  },
  // First-run empty state.
  emptyState: {
    gap: 14,
    paddingVertical: 24,
    alignItems: 'stretch',
  },
  emptyHeadline: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  verbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  verbButton: {
    minHeight: TOUCH_TARGET.minSizePx,
    backgroundColor: SURFACE_TOKENS.elevated,
    borderColor: SURFACE_TOKENS.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  verbButtonText: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  demoLink: {
    minHeight: TOUCH_TARGET.minSizePx,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  demoLinkText: {
    color: SURFACE_TOKENS.focusRing,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
