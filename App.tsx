import { StatusBar } from 'expo-status-bar';
import React, { useState, useRef } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AppSessionProvider } from './src/features/session/AppSessionProvider';
import { useAppSession } from './src/features/session/useAppSession';
import { SessionDebugPanel } from './src/features/session/SessionDebugPanel';
import { AuthScreen } from './src/features/auth/AuthScreen';
import { LoadingNotice } from './src/components/LoadingNotice';
import { useAuthSession } from './src/features/auth/useAuthSession';
import { DebateListScreen, DebateDetailHeader, useDebates, useCurrentDebate } from './src/features/debates';
import { ArgumentTreeScreen, ArgumentComposer } from './src/features/arguments';
import { AccountScreen } from './src/features/account';
import type { ArgumentRow } from './src/features/arguments';
import { TAB_LABELS } from './src/features/arguments/roomNavigation';
import type { ArgumentRoomTab } from './src/features/arguments/roomNavigation';

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
    deselectDebate();
  };

  const participantSide = state.snapshot.participantSide;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="auto" />

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
        {/* Arguments tab: debate list when no room selected */}
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

        {/* Arguments tab: room view (tree + start bar) */}
        {activeTab === 'arguments' && hasDebate && currentDebate && !composerOpen && (
          <View style={styles.debateRoom}>
            <DebateDetailHeader
              debate={currentDebate}
              participantSide={participantSide}
              onLeave={handleLeaveRoom}
            />
            <ArgumentTreeScreen
              debate={currentDebate}
              onReply={handleReply}
              refreshRef={refreshTreeRef}
            />
            <View style={styles.startBar}>
              <Pressable
                style={styles.startButton}
                onPress={handleStartArgument}
                accessibilityRole="button"
                accessibilityLabel="Start an argument"
              >
                <Text style={styles.startButtonText}>+ Start an argument</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Arguments tab: inline composer (replaces tree while open) */}
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
  startBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 12,
  },
  startButton: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  startButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
