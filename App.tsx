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
import { DebateListScreen, DebateDetailHeader, useDebates, useCurrentDebate } from './src/features/debates';
import { ConversationGalleryScreen } from './src/features/debates/ConversationGalleryScreen';
import type { GalleryEntryHint } from './src/features/debates/conversationGalleryModel';
import { useGalleryArguments } from './src/features/debates/useGalleryArguments';
import { ArgumentTreeScreen, ArgumentComposer } from './src/features/arguments';
import { AccountScreen } from './src/features/account';
import { useAccountProfile } from './src/features/account/useAccountProfile';
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

// ── AppRoot: session-gated routing ────────────────────────────

function AppRoot() {
  const { state, dispatch } = useAppSession();

  let content: React.ReactNode;
  if (state.status === 'unconfigured') {
    content = <LoadingNotice message="Starting…" />;
  } else if (state.status === 'signed_out') {
    content = <AuthScreen />;
  } else {
    content = <MainAppShell />;
  }

  // BRAND-001 — Tapping the header logo deselects the active debate and
  // returns to the gallery. Implemented by re-dispatching SIGNED_IN
  // (the same path `useCurrentDebate.deselectDebate` uses). No router,
  // so the TL-003 no-route invariant is preserved.
  const userId = state.snapshot.userId;
  const handleHomePress = React.useCallback(() => {
    if (userId) {
      dispatch({ type: 'SIGNED_IN', userId });
    }
  }, [dispatch, userId]);

  // BRAND-001 — global dark backdrop. AppHeader docks above the dev
  // banner so it persists on every screen. DevEnvironmentBanner renders
  // null in production.
  return (
    <SafeAreaView style={styles.appRoot}>
      <AppHeader onHomePress={handleHomePress} />
      <DevEnvironmentBanner />
      <View style={styles.appRootContent}>{content}</View>
    </SafeAreaView>
  );
}

// ── MainAppShell: argument-first tab structure ────────────────

function MainAppShell() {
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

        {/* Arguments tab: room view */}
        {activeTab === 'arguments' && hasDebate && currentDebate && !composerOpen && (
          <View style={styles.debateRoom}>
            {/* Room header */}
            <DebateDetailHeader
              debate={currentDebate}
              participantSide={participantSide}
              onLeave={handleLeaveRoom}
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
              onJoinSide={async (side) => {
                if (!currentDebate) return;
                const joined = await join(currentDebate.id, side);
                if (joined) selectDebate(currentDebate, joined);
              }}
            />

            {/* Gamified action bar */}
            <View style={styles.actionBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.actionBarInner}
              >
                <Pressable
                  style={styles.actionPrimary}
                  onPress={handleStartArgument}
                  accessibilityRole="button"
                  accessibilityLabel="button-start-argument"
                >
                  <Text style={styles.actionPrimaryText}>
                    {ROOM_COPY.startArgument}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        )}

        {/* Arguments tab: inline composer (replaces room while open) */}
        {activeTab === 'arguments' && hasDebate && currentDebate && composerOpen && (
          <ArgumentComposer
            debate={currentDebate}
            selectedParentId={replyTarget?.id ?? null}
            parentArgument={replyTarget?.argument ?? null}
            onClearParent={handleClearParent}
            onSubmitSuccess={handleSubmitSuccess}
            onClose={handleComposerClose}
            initialPatch={composerPreset}
          />
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

  // Action bar (primary CTA + secondary moves)
  actionBar: {
    backgroundColor: BRAND.surface.appElevated.bg,
    borderTopWidth: 1,
    borderTopColor: '#1f1c2c',
    paddingVertical: 10,
  },
  actionBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  actionPrimary: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  actionPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
