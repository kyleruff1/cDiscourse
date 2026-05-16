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
import { ArgumentTreeScreen, ArgumentComposer } from './src/features/arguments';
import { AccountScreen } from './src/features/account';
import { InvitePanel } from './src/features/invites/InvitePanel';
import type { ArgumentRow } from './src/features/arguments';
import type { ArgumentViewMode } from './src/features/arguments/ArgumentTreeScreen';
import { TAB_LABELS } from './src/features/arguments/roomNavigation';
import type { ArgumentRoomTab } from './src/features/arguments/roomNavigation';
import { ROOM_COPY } from './src/features/arguments/gameCopy';

// ── AppRoot: session-gated routing ────────────────────────────

function AppRoot() {
  const { state } = useAppSession();

  if (state.status === 'unconfigured') {
    return <LoadingNotice message="Starting…" />;
  }

  if (state.status === 'signed_out') {
    return <AuthScreen />;
  }

  return <MainAppShell />;
}

// ── MainAppShell: argument-first tab structure ────────────────

function MainAppShell() {
  const { state, dispatch } = useAppSession();
  const { signOut, loading: signOutLoading } = useAuthSession();
  const [tab, setTab] = useState<ArgumentRoomTab>('arguments');
  const [replyTarget, setReplyTarget] = useState<{ id: string; argument: ArgumentRow } | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ArgumentViewMode>('tree');
  const [inviteOpen, setInviteOpen] = useState(false);
  const refreshTreeRef = useRef<(() => void) | null>(null);

  const { debates, loading: debatesLoading, error: debatesError, refresh, create, join } = useDebates();
  const { currentDebate, selectDebate, deselectDebate } = useCurrentDebate(debates);

  const hasDebate = Boolean(state.snapshot.selectedDebateId);

  const tabs: ArgumentRoomTab[] = [
    'arguments',
    'account',
    ...(__DEV__ ? (['debug'] as ArgumentRoomTab[]) : []),
  ];

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
  };

  const handleSubmitSuccess = () => {
    setReplyTarget(null);
    setComposerOpen(false);
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
        {/* Arguments tab: debate list (no room selected) */}
        {activeTab === 'arguments' && !hasDebate && (
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
                {/* View toggle */}
                <Pressable
                  style={[styles.toolbarChip, viewMode === 'tree' && styles.toolbarChipActive]}
                  onPress={() => setViewMode('tree')}
                  accessibilityRole="button"
                  accessibilityLabel="Tree view"
                >
                  <Text style={[styles.toolbarChipText, viewMode === 'tree' && styles.toolbarChipTextActive]}>
                    Thread
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.toolbarChip, viewMode === 'timeline' && styles.toolbarChipActive]}
                  onPress={() => setViewMode('timeline')}
                  accessibilityRole="button"
                  accessibilityLabel="Timeline track view"
                >
                  <Text style={[styles.toolbarChipText, viewMode === 'timeline' && styles.toolbarChipTextActive]}>
                    Tracks
                  </Text>
                </Pressable>
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
          />
        )}

        {activeTab === 'account' && (
          <AccountScreen onSignOut={handleSignOut} signOutLoading={signOutLoading} />
        )}

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
  root: { flex: 1, backgroundColor: '#f9fafb' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6366f1' },
  tabText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  tabTextActive: { color: '#6366f1' },
  body: { flex: 1 },
  debateRoom: { flex: 1 },

  // Room toolbar (thread/tracks toggle + invite)
  roomToolbar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toolbarSep: {
    width: 1,
    height: 16,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 2,
  },
  toolbarChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  toolbarChipActive: {
    backgroundColor: '#ede9fe',
  },
  toolbarChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  toolbarChipTextActive: {
    color: '#6366f1',
    fontWeight: '700',
  },

  // Invite panel
  invitePanelWrapper: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  // Action bar (primary CTA + secondary moves)
  actionBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
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
