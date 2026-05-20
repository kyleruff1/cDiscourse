import { StatusBar } from 'expo-status-bar';
import React, { useState, useRef } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppSessionProvider } from './src/features/session/AppSessionProvider';
import { useAppSession } from './src/features/session/useAppSession';
import { SessionDebugPanel } from './src/features/session/SessionDebugPanel';
import { AuthScreen } from './src/features/auth/AuthScreen';
import { LoadingNotice } from './src/components/LoadingNotice';
import { useAuthSession } from './src/features/auth/useAuthSession';
import { DebateListScreen, DebateDetailHeader, useDebates, useCurrentDebate, useRoomContract } from './src/features/debates';
import { ConversationGalleryScreen } from './src/features/debates/ConversationGalleryScreen';
import type { GalleryEntryHint } from './src/features/debates/conversationGalleryModel';
import { useGalleryArguments } from './src/features/debates/useGalleryArguments';
import { ArgumentTreeScreen } from './src/features/arguments';
// COMPOSER-002 — the composer renders as an in-room dock, not a full-page
// "Your Move" screen swap. The room stays mounted behind the dock.
import { ArgumentComposerDock } from './src/features/arguments/ArgumentComposerDock';
import { AccountScreen } from './src/features/account';
import { useAccountProfile } from './src/features/account/useAccountProfile';
import { fetchCurrentAuthUser } from './src/features/account/accountApi';
import { AdminScreen } from './src/features/admin';
import { InvitePanel } from './src/features/invites/InvitePanel';
import type { ArgumentRow } from './src/features/arguments';
import type { ArgumentViewMode } from './src/features/arguments/ArgumentTreeScreen';
import type { MoveDraftPatch } from './src/features/arguments/conversationMoves';
import { TAB_LABELS, getVisibleTabs } from './src/features/arguments/roomNavigation';
import type { ArgumentRoomTab } from './src/features/arguments/roomNavigation';
import { ROOM_COPY } from './src/features/arguments/gameCopy';
import { DEFAULT_VIEW_MODE, VIEW_MODE_COPY } from './src/features/arguments/viewModeCopy';
import { DevEnvironmentBanner } from './src/features/devEnvironment';
import { AppHeader } from './src/components/AppHeader';
import { BRAND } from './src/lib/designTokens';
// PR-001 — "My preferences" popout. The header gear opens a core Modal
// bottom-sheet of device-local UI preferences. No router, no new dep.
import { PreferencesPopout, useUserPreferences } from './src/features/preferences';
import type { UseUserPreferencesResult } from './src/features/preferences';
import { PREFERENCES_COPY } from './src/features/preferences/preferencesCopy';
import { densityToTimelineMode } from './src/features/preferences/userPreferencesModel';
// PR-002 — "Profile tags" popout. Reached via a row inside the PR-001
// preferences popout; mounted alongside it as a second core Modal.
import { ProfileTagPopout, useProfileTags } from './src/features/profileTags';

// ── AppRoot: session-gated routing ────────────────────────────

function AppRoot() {
  const { state, dispatch } = useAppSession();

  // PR-001 — the signed-in user id drives the device-local preference
  // blob and the display-name account write. Null while signed out.
  // "Signed in" is any state past the unconfigured / signed_out gate —
  // the same condition that picks `MainAppShell` for `content` below.
  const userId = state.snapshot.userId;
  const signedIn =
    state.status !== 'unconfigured' && state.status !== 'signed_out';

  // PR-001 — preferences hook + popout open state live at the root so
  // the header trigger and the popout overlay share one source of
  // truth. The hook tolerates a null userId defensively.
  const prefs = useUserPreferences(userId);
  const accountProfile = useAccountProfile(userId);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [contactEmail, setContactEmail] = useState<string | null>(null);

  // PR-002 — device-local profile-tag selection + the second popout's
  // open state. The hook tolerates a null userId defensively, mirroring
  // useUserPreferences. The tag popout layers above the preferences one.
  const profileTags = useProfileTags(userId);
  const [profileTagsOpen, setProfileTagsOpen] = useState(false);

  // PR-001 — read the contact email once for read-only display.
  React.useEffect(() => {
    let cancelled = false;
    if (!signedIn) {
      setContactEmail(null);
      return;
    }
    void fetchCurrentAuthUser().then((u) => {
      if (!cancelled) setContactEmail(u?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn, userId]);

  let content: React.ReactNode;
  if (state.status === 'unconfigured') {
    content = <LoadingNotice message="Starting…" />;
  } else if (state.status === 'signed_out') {
    content = <AuthScreen />;
  } else {
    content = <MainAppShell preferences={prefs} />;
  }

  // BRAND-001 — Tapping the header logo deselects the active debate and
  // returns to the gallery. Implemented by re-dispatching SIGNED_IN
  // (the same path `useCurrentDebate.deselectDebate` uses). No router,
  // so the TL-003 no-route invariant is preserved.
  const handleHomePress = React.useCallback(() => {
    if (userId) {
      dispatch({ type: 'SIGNED_IN', userId });
    }
  }, [dispatch, userId]);

  // PR-001 — the header gear. Only rendered while signed in (the popout
  // is a signed-in self-service surface only).
  const preferencesTrigger = signedIn ? (
    <Pressable
      testID="preferences-trigger"
      onPress={() => setPreferencesOpen(true)}
      accessibilityRole="button"
      accessibilityLabel={PREFERENCES_COPY.triggerLabel}
      accessibilityHint={PREFERENCES_COPY.triggerHint}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={styles.preferencesTrigger}
    >
      <Text style={styles.preferencesTriggerGlyph}>⚙</Text>
    </Pressable>
  ) : undefined;

  // BRAND-001 — global dark backdrop. AppHeader docks above the dev
  // banner so it persists on every screen. DevEnvironmentBanner renders
  // null in production.
  return (
    <SafeAreaView style={styles.appRoot}>
      <AppHeader onHomePress={handleHomePress} rightSlot={preferencesTrigger} />
      <DevEnvironmentBanner />
      <View style={styles.appRootContent}>{content}</View>
      {signedIn ? (
        <PreferencesPopout
          visible={preferencesOpen}
          onClose={() => setPreferencesOpen(false)}
          userId={userId}
          displayName={accountProfile.profile?.displayName ?? null}
          displayNameSaving={accountProfile.saving}
          displayNameSaveError={accountProfile.saveError}
          onSaveDisplayName={accountProfile.updateDisplayName}
          contactEmail={contactEmail}
          preferences={prefs.preferences}
          effectiveReduceMotion={prefs.effectiveReduceMotion}
          osReduceMotion={prefs.osReduceMotion}
          onUpdatePreference={prefs.updatePreference}
          onOpenProfileTags={() => setProfileTagsOpen(true)}
          profileTagCount={profileTags.count}
        />
      ) : null}
      {/* PR-002 — the second core Modal layers above the preferences
          popout. Closing it returns to the preferences popout intact. */}
      {signedIn ? (
        <ProfileTagPopout
          visible={profileTagsOpen}
          onClose={() => setProfileTagsOpen(false)}
          selection={profileTags.selection}
          count={profileTags.count}
          atLimit={profileTags.atLimit}
          onToggleTag={profileTags.toggleTag}
          onClearTags={profileTags.clearTags}
          reduceMotion={prefs.effectiveReduceMotion}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ── MainAppShell: argument-first tab structure ────────────────

interface MainAppShellProps {
  /** PR-001 — device-local UI preferences, lifted from AppRoot. */
  preferences: UseUserPreferencesResult;
}

function MainAppShell({ preferences }: MainAppShellProps) {
  const { state, dispatch } = useAppSession();
  const { signOut, loading: signOutLoading } = useAuthSession();
  const [tab, setTab] = useState<ArgumentRoomTab>('arguments');
  const [replyTarget, setReplyTarget] = useState<{ id: string; argument: ArgumentRow } | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  // TL-001 — Timeline is the default landing mode. Cards remains a toggle.
  // Active-message state is shared across modes, so switching preserves the
  // currently active node.
  const [viewMode, setViewMode] = useState<ArgumentViewMode>(DEFAULT_VIEW_MODE);
  const [inviteOpen, setInviteOpen] = useState(false);
  // Stage 6.2 M7 — preset draft patch from sidecar/bubble quick action.
  // Reset on composer close so the next open starts fresh.
  const [composerPreset, setComposerPreset] = useState<MoveDraftPatch | null>(null);
  // Stage 6.4: entry hint set by the Conversation Gallery when the user
  // opens a card. Tells the room shell which message to activate first
  // and what one-line "micro-moment" prompt to show.
  const [entryHint, setEntryHint] = useState<GalleryEntryHint | null>(null);
  const refreshTreeRef = useRef<(() => void) | null>(null);

  const { debates, loading: debatesLoading, error: debatesError, refresh, create, join } = useDebates();
  const { currentDebate, selectDebate, deselectDebate } = useCurrentDebate(debates);
  const galleryArgs = useGalleryArguments(debates.map((d) => d.id));
  const { profile: currentProfile } = useAccountProfile(state.snapshot.userId);

  const hasDebate = Boolean(state.snapshot.selectedDebateId);

  const tabs = getVisibleTabs(currentProfile?.role ?? null, Boolean(__DEV__));

  const activeTab = tabs.includes(tab) ? tab : 'arguments';

  const handleSignOut = async () => {
    await signOut();
    dispatch({ type: 'SIGNED_OUT' });
  };

  const handleStartArgument = () => {
    setReplyTarget(null);
    setComposerOpen(true);
  };

  const handleReply = (argumentId: string, argument: ArgumentRow) => {
    setReplyTarget({ id: argumentId, argument });
    setComposerOpen(true);
  };

  const handleClearParent = () => {
    setReplyTarget(null);
  };

  const handleComposerClose = () => {
    setReplyTarget(null);
    setComposerOpen(false);
    setComposerPreset(null);
  };

  const handleSubmitSuccess = () => {
    setReplyTarget(null);
    setComposerOpen(false);
    setComposerPreset(null);
    refreshTreeRef.current?.();
  };

  const handleLeaveRoom = () => {
    setComposerOpen(false);
    setReplyTarget(null);
    setInviteOpen(false);
    deselectDebate();
  };

  const participantSide = state.snapshot.participantSide;

  // GAME-004 — derive the 1v1 PvP room contract for the open room. The hook
  // is called unconditionally (Rules of Hooks); when no room is selected the
  // empty roomId makes it return `viewModel: null` and the header renders
  // unchanged. `roomType` has no persisted source in v1 — it defaults to
  // 'public' inside the model, which keeps the opponent seat open and
  // claimable (the doctrine-safe default; see docs/designs/GAME-004.md).
  const roomContract = useRoomContract({
    roomId: currentDebate?.id ?? '',
    initiatorUserId: currentDebate?.createdBy ?? '',
    openedAt: currentDebate?.createdAt ?? '',
    viewerUserId: state.snapshot.userId || null,
  });

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="auto" />

      {/* Top tab bar */}
      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => { setTab(t); }}
            accessibilityRole="tab"
            accessibilityLabel={TAB_LABELS[t]}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {TAB_LABELS[t]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.body}>
        {/* Arguments tab: Conversation Gallery (no room selected). */}
        {activeTab === 'arguments' && !hasDebate && (
          <ConversationGalleryScreen
            debates={debates}
            argumentsByDebateId={galleryArgs.argumentsByDebateId}
            currentUserId={state.snapshot.userId || null}
            loading={debatesLoading || galleryArgs.loading}
            error={debatesError || galleryArgs.error}
            onRefresh={() => { refresh(); galleryArgs.refresh(); }}
            onCreate={create}
            onJoin={join}
            onSelect={(debate, side, hint) => {
              setEntryHint(hint || null);
              selectDebate(debate, side);
            }}
          />
        )}
        {/* Old sortable table is dev-only behind the chip; keep mount path so
            admin / tests can still reach it via a separate route if needed. */}
        {false && activeTab === 'arguments' && !hasDebate && (
          <DebateListScreen
            debates={debates}
            loading={debatesLoading}
            error={debatesError}
            onRefresh={refresh}
            onCreate={create}
            onJoin={join}
            onSelect={selectDebate}
          />
        )}

        {/* Arguments tab: room view.
            COMPOSER-002 — the room stays mounted while composing; the
            composer renders as an in-room dock overlay (below). Keeping
            ArgumentTreeScreen mounted preserves viewMode, the active node,
            the entry-hint micro-moment, and scroll position for free. */}
        {activeTab === 'arguments' && hasDebate && currentDebate && (
          <View style={styles.debateRoom}>
            {/* Room header */}
            <DebateDetailHeader
              debate={currentDebate}
              participantSide={participantSide}
              onLeave={handleLeaveRoom}
              roomContract={roomContract.viewModel ?? undefined}
            />

            {/* Gamified room toolbar */}
            <View style={styles.roomToolbar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.roomToolbarInner}
              >
                <Text style={styles.roomLabel}>{ROOM_COPY.title}</Text>
                <View style={styles.toolbarSep} />
                {/* View toggle — Timeline (primary) + Cards (deeper inspection). */}
                <Pressable
                  style={[styles.toolbarChip, viewMode === 'stack' && styles.toolbarChipActive]}
                  onPress={() => setViewMode('stack')}
                  accessibilityRole="button"
                  accessibilityLabel={VIEW_MODE_COPY.cards.accessibilityLabel}
                  accessibilityHint={VIEW_MODE_COPY.cards.accessibilityHint}
                  testID="room-toolbar-stack"
                >
                  <Text style={[styles.toolbarChipText, viewMode === 'stack' && styles.toolbarChipTextActive]}>
                    {VIEW_MODE_COPY.cards.label}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.toolbarChip, viewMode === 'timeline' && styles.toolbarChipActive]}
                  onPress={() => setViewMode('timeline')}
                  accessibilityRole="button"
                  accessibilityLabel={VIEW_MODE_COPY.timeline.accessibilityLabel}
                  accessibilityHint={VIEW_MODE_COPY.timeline.accessibilityHint}
                  testID="room-toolbar-timeline"
                >
                  <Text style={[styles.toolbarChipText, viewMode === 'timeline' && styles.toolbarChipTextActive]}>
                    {VIEW_MODE_COPY.timeline.label}
                  </Text>
                </Pressable>
                {__DEV__ && (
                  <>
                    <Pressable
                      style={[styles.toolbarChip, viewMode === 'tree' && styles.toolbarChipActive]}
                      onPress={() => setViewMode('tree')}
                      accessibilityRole="button"
                      accessibilityLabel="Tree view (dev)"
                      testID="room-toolbar-tree-dev"
                    >
                      <Text style={[styles.toolbarChipText, viewMode === 'tree' && styles.toolbarChipTextActive]}>
                        Thread (dev)
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.toolbarChip, viewMode === 'tracks' && styles.toolbarChipActive]}
                      onPress={() => setViewMode('tracks')}
                      accessibilityRole="button"
                      accessibilityLabel="Tracks lane view (dev)"
                      testID="room-toolbar-tracks-dev"
                    >
                      <Text style={[styles.toolbarChipText, viewMode === 'tracks' && styles.toolbarChipTextActive]}>
                        Tracks (dev)
                      </Text>
                    </Pressable>
                  </>
                )}
                <View style={styles.toolbarSep} />
                {/* Invite */}
                <Pressable
                  style={styles.toolbarChip}
                  onPress={() => setInviteOpen((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel="Invite a challenger"
                >
                  <Text style={styles.toolbarChipText}>
                    {inviteOpen ? 'Close invite' : 'Invite'}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>

            {/* Invite panel (inline, collapsible) */}
            {inviteOpen && (
              <View style={styles.invitePanelWrapper}>
                <InvitePanel
                  roomTitle={currentDebate.title}
                  claim={currentDebate.resolution}
                  onClose={() => setInviteOpen(false)}
                />
              </View>
            )}

            {/* Argument tree or timeline */}
            <ArgumentTreeScreen
              debate={currentDebate}
              onReply={handleReply}
              refreshRef={refreshTreeRef}
              viewMode={viewMode}
              onComposerPreset={setComposerPreset}
              entryHint={entryHint}
              participantSide={participantSide}
              // PR-001 — thread the user's visual-density preference into
              // the timeline map (drives VG-004's resolveNodeGapPx) and
              // the reduce-motion override (OS value composed with the
              // user's choice) into the timeline board.
              density={densityToTimelineMode(preferences.preferences.density)}
              reduceMotionOverride={preferences.effectiveReduceMotion}
              onJoinSide={async (side) => {
                if (!currentDebate) return;
                const joined = await join(currentDebate.id, side);
                if (joined) selectDebate(currentDebate, joined);
              }}
              // SC-005 — the old separate bottom actionBar is gone; the
              // "Start an argument" CTA now folds into the side action
              // rail's expanded dock, so the room has a single bottom
              // action surface.
              startArgumentAction={{
                label: ROOM_COPY.startArgument,
                onPress: handleStartArgument,
              }}
            />

            {/* COMPOSER-002 — in-room composer dock. Overlays the room
                surface; the room itself stays mounted behind it so the
                view mode, active node, micro-moment, and scroll position
                survive a compose-cancel round trip. `composerOpen` now
                toggles the dock instead of swapping the screen. */}
            <ArgumentComposerDock
              visible={composerOpen}
              debate={currentDebate}
              selectedParentId={replyTarget?.id ?? null}
              parentArgument={replyTarget?.argument ?? null}
              onClearParent={handleClearParent}
              onSubmitSuccess={handleSubmitSuccess}
              onClose={handleComposerClose}
              initialPatch={composerPreset}
              reduceMotionOverride={preferences.effectiveReduceMotion}
            />
          </View>
        )}

        {activeTab === 'account' && (
          <AccountScreen onSignOut={handleSignOut} signOutLoading={signOutLoading} />
        )}

        {activeTab === 'admin' && currentProfile?.role === 'admin' && <AdminScreen />}

        {activeTab === 'debug' && __DEV__ && <SessionDebugPanel />}
      </View>
    </SafeAreaView>
  );
}

// ── Root export ───────────────────────────────────────────────

export default function App() {
  return (
    <AppSessionProvider>
      <AppRoot />
    </AppSessionProvider>
  );
}

const styles = StyleSheet.create({
  // BRAND-001 — `surface.app` (#08060F) is the global app backdrop that
  // matches the CivilDiscourse logo's black field. `surface.appElevated`
  // is the one-step-up tone for cards / rails / sidecar.
  appRoot: { flex: 1, backgroundColor: BRAND.surface.app.bg },
  appRootContent: { flex: 1, backgroundColor: BRAND.surface.app.bg },
  root: { flex: 1, backgroundColor: BRAND.surface.app.bg },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: BRAND.surface.appElevated.bg,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1c2c',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6366f1' },
  tabText: { fontSize: 12, color: BRAND.text.muted, fontWeight: '500' },
  tabTextActive: { color: BRAND.text.primary },
  body: { flex: 1, backgroundColor: BRAND.surface.app.bg },
  debateRoom: { flex: 1, backgroundColor: BRAND.surface.app.bg },

  // Room toolbar (thread/tracks toggle + invite)
  roomToolbar: {
    backgroundColor: BRAND.surface.appElevated.bg,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1c2c',
  },
  roomToolbarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  roomLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toolbarSep: {
    width: 1,
    height: 16,
    backgroundColor: '#2a2538',
    marginHorizontal: 2,
  },
  toolbarChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#1f1c2c',
  },
  toolbarChipActive: {
    backgroundColor: '#312e81',
  },
  toolbarChipText: {
    fontSize: 12,
    color: BRAND.text.muted,
    fontWeight: '500',
  },
  toolbarChipTextActive: {
    color: BRAND.text.primary,
    fontWeight: '700',
  },

  // Invite panel
  invitePanelWrapper: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: BRAND.surface.appElevated.bg,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1c2c',
  },

  // SC-005 — the separate bottom actionBar (and its actionBar /
  // actionBarInner / actionPrimary / actionPrimaryText styles) was
  // removed: the "Start an argument" CTA now folds into the side action
  // rail's expanded dock, so the room has a single bottom action surface.

  // PR-001 — header preferences gear. ≥ 44×44 effective target via
  // hitSlop; the glyph is intentionally simple text (no icon dep).
  preferencesTrigger: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.surface.appElevated.bg,
  },
  preferencesTriggerGlyph: {
    color: BRAND.text.primary,
    fontSize: 18,
  },
});
