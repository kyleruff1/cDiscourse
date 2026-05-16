import { StatusBar } from 'expo-status-bar';
import React, { useState, useRef, useEffect } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AppSessionProvider } from './src/features/session/AppSessionProvider';
import { useAppSession } from './src/features/session/useAppSession';
import { SessionDebugPanel } from './src/features/session/SessionDebugPanel';
import { AuthScreen } from './src/features/auth/AuthScreen';
import { LoadingNotice } from './src/components/LoadingNotice';
import { useAuthSession } from './src/features/auth/useAuthSession';
import { DebateListScreen, DebateDetailHeader, useDebates, useCurrentDebate } from './src/features/debates';
import { ArgumentTreeScreen, ArgumentComposer } from './src/features/arguments';
import type { ArgumentRow } from './src/features/arguments';

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

// ── MainAppShell: signed-in tab structure ─────────────────────

type Tab = 'debates' | 'current_debate' | 'composer' | 'account' | 'debug';

function MainAppShell() {
  const { state, dispatch } = useAppSession();
  const { signOut, loading: signOutLoading } = useAuthSession();
  const [tab, setTab] = useState<Tab>('debates');
  const [replyTarget, setReplyTarget] = useState<{ id: string; argument: ArgumentRow } | null>(null);

  const { debates, loading: debatesLoading, error: debatesError, refresh, create, join } = useDebates();
  const { currentDebate, selectDebate, deselectDebate } = useCurrentDebate(debates);

  // Auto-switch to current_debate tab when a debate is newly selected.
  const prevSelectedDebateId = useRef<string | null>(null);
  useEffect(() => {
    const newId = state.snapshot.selectedDebateId;
    if (newId && newId !== prevSelectedDebateId.current) {
      setTab('current_debate');
    }
    prevSelectedDebateId.current = newId;
  }, [state.snapshot.selectedDebateId]);

  const hasDebate = Boolean(state.snapshot.selectedDebateId);
  const tabs: Tab[] = [
    'debates',
    ...(hasDebate ? (['current_debate', 'composer'] as Tab[]) : []),
    'account',
    ...(__DEV__ ? (['debug'] as Tab[]) : []),
  ];

  // Keep tab in sync: if debate closes and current tab is no longer available, reset.
  const activeTab = tabs.includes(tab) ? tab : 'debates';

  const handleSignOut = async () => {
    await signOut();
    dispatch({ type: 'SIGNED_OUT' });
  };

  const handleReply = (argumentId: string, argument: ArgumentRow) => {
    setReplyTarget({ id: argumentId, argument });
    setTab('composer');
  };

  const handleClearParent = () => {
    setReplyTarget(null);
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
        {activeTab === 'debates' && (
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
        {activeTab === 'current_debate' && currentDebate && (
          <View style={styles.debateRoom}>
            <DebateDetailHeader
              debate={currentDebate}
              participantSide={participantSide}
              onLeave={deselectDebate}
            />
            <ArgumentTreeScreen debate={currentDebate} onReply={handleReply} />
          </View>
        )}
        {activeTab === 'composer' && currentDebate && (
          <ArgumentComposer
            debate={currentDebate}
            selectedParentId={replyTarget?.id ?? null}
            parentArgument={replyTarget?.argument ?? null}
            onClearParent={handleClearParent}
          />
        )}
        {activeTab === 'account' && (
          <AccountTab onSignOut={handleSignOut} signOutLoading={signOutLoading} />
        )}
        {activeTab === 'debug' && __DEV__ && <SessionDebugPanel />}
      </View>
    </SafeAreaView>
  );
}

const TAB_LABELS: Record<Tab, string> = {
  debates: 'Debates',
  current_debate: 'Debate',
  composer: 'Compose',
  account: 'Account',
  debug: 'Debug',
};

// ── AccountTab ────────────────────────────────────────────────

interface AccountTabProps {
  onSignOut: () => Promise<void>;
  signOutLoading: boolean;
}

function AccountTab({ onSignOut, signOutLoading }: AccountTabProps) {
  const { state } = useAppSession();

  return (
    <View style={styles.accountTab}>
      <Text style={styles.accountTitle}>Account</Text>
      <Text style={styles.accountSub}>
        {state.snapshot.userId
          ? `User ID: …${state.snapshot.userId.slice(-8)}`
          : 'Signed in'}
      </Text>
      <Pressable
        onPress={onSignOut}
        disabled={signOutLoading}
        style={[styles.signOutButton, signOutLoading && styles.signOutDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text style={styles.signOutLabel}>{signOutLoading ? 'Signing out…' : 'Sign Out'}</Text>
      </Pressable>
    </View>
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
  accountTab: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  accountTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8 },
  accountSub: { fontSize: 14, color: '#6b7280', marginBottom: 32 },
  signOutButton: {
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    minWidth: 160,
    alignItems: 'center',
  },
  signOutDisabled: { opacity: 0.45 },
  signOutLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
