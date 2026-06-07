import { StatusBar } from 'expo-status-bar';
import React, { useState, useRef } from 'react';
import {
  Pressable,
  SafeAreaView,
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
// QOL-040.3 — pure helper that builds the entry hint from a notification
// deep-link target. Lives in `src/features/debates/` because it produces
// the GalleryEntryHint that the room shell consumes; the NotificationDeepLink
// input is imported from the notifications module (read-only).
import { buildDeepLinkEntryHint } from './src/features/debates/deepLinkEntryHint';
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
// QOL-038 — invite surfaces. The InviteRedeemGate runs above MainAppShell
// when a deep-linked invite is in flight. UX-001.2 — the invite toolbar
// chip moved into DebateDetailHeader's overflow panel; the inline panel
// mount in MainAppShell is unchanged and is still toggled via
// `inviteOpen` state.
import { InviteRedeemGate } from './src/features/invites/InviteRedeemGate';
import {
  parseInviteDeepLink,
  buildPendingInviteIntent,
  loadPendingInviteIntentFromStorage,
  savePendingInviteIntentToStorage,
  clearPendingInviteIntentFromStorage,
} from './src/features/invites';
import type { ArgumentRow } from './src/features/arguments';
import type { ArgumentViewMode } from './src/features/arguments/ArgumentTreeScreen';
import type { MoveDraftPatch } from './src/features/arguments/conversationMoves';
import { TAB_LABELS, getVisibleTabs } from './src/features/arguments/roomNavigation';
import type { ArgumentRoomTab } from './src/features/arguments/roomNavigation';
import { ROOM_COPY } from './src/features/arguments/gameCopy';
// UX-001.2 — VIEW_MODE_COPY is consumed inside DebateDetailHeader's compact
// strip; App.tsx no longer renders the toggle so only the default is needed.
import { DEFAULT_VIEW_MODE } from './src/features/arguments/viewModeCopy';
// DevEnvironmentBanner mount removed — operator opted out of the persistent
// "Unverified build · no build metadata" ribbon during Stage 6.4 smoke work.
// The component itself (src/features/devEnvironment/DevEnvironmentBanner.tsx)
// is intact for later reinstatement if a release surface needs it again.
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
// QOL-040 — in-app notification surface. The badge sits on the
// Arguments tab; the list screen renders as a routed sub-screen
// when the user taps the badge. No push (v1 scope).
import {
  NotificationBadge,
  NotificationListScreen,
  useNotifications,
} from './src/features/notifications';
import type { NotificationDeepLink, RoomNotification } from './src/features/notifications';

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

  // ── QOL-038 — invite deep-link capture ─────────────────────
  // On cold start, parse window.location for an `/invite/<token>`
  // and capture it into the pendingInviteIntent slice + the
  // dedicated device-local storage key. The intent flows through
  // the SIGNED_OUT → SIGNED_IN reducer transition (the headline
  // preservation property in sessionReducer.ts) so the
  // accept-on-first-signed-in trigger can fire after a fresh
  // sign-up. Native scheme (cdiscourse://invite/<token>) capture
  // is left for a follow-up — Expo Linking integration is a
  // dependency-level change beyond this card.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const nowIso = new Date().toISOString();
      // 1) Parse the cold-start URL. Web only here; native path is
      //    follow-up. parseInviteDeepLink NEVER throws.
      let token: string | null = null;
      if (typeof window !== 'undefined' && window.location?.href) {
        const parsed = parseInviteDeepLink(window.location.href);
        if (parsed) token = parsed.token;
      }
      if (token) {
        try {
          const intent = buildPendingInviteIntent(token, nowIso);
          await savePendingInviteIntentToStorage(intent);
          if (!cancelled) dispatch({ type: 'SET_PENDING_INVITE_INTENT', intent });
        } catch {
          // Build can throw only on a bad token shape; the parser
          // already gates that, so a throw here means a corrupt URL —
          // ignore and let the app cold-start normally.
        }
        return;
      }
      // 2) No URL token — fall back to a persisted intent (e.g. from
      //    a prior cold start the user has not yet completed). The
      //    24h freshness drop is enforced inside the load helper.
      const persisted = await loadPendingInviteIntentFromStorage(nowIso);
      if (persisted && !cancelled) {
        dispatch({ type: 'SET_PENDING_INVITE_INTENT', intent: persisted });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentional empty deps: this is a cold-start one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The presence of a pendingInviteIntent (live) gates the
  // InviteRedeemGate above every other screen. The gate orchestrates
  // lookup_by_token → accept and calls back when done; this component
  // owns the post-success selectDebate hand-off via the gallery on the
  // first signed_in render.
  const pendingInviteIntent = state.snapshot.pendingInviteIntent;
  // When the gate succeeds it dispatches CLEAR + sets a one-shot
  // post-accept debate id so the next MainAppShell render can fold the
  // user into the room. The id lives in App-local React state because
  // the room-open call (selectDebate) lives inside MainAppShell.
  const [acceptedDebateId, setAcceptedDebateId] = React.useState<string | null>(null);

  const handleAcceptedInvite = React.useCallback(
    async (input: { debateId: string }) => {
      await clearPendingInviteIntentFromStorage();
      dispatch({ type: 'CLEAR_PENDING_INVITE_INTENT' });
      setAcceptedDebateId(input.debateId);
    },
    [dispatch],
  );

  const handleInviteExit = React.useCallback(async () => {
    await clearPendingInviteIntentFromStorage();
    dispatch({ type: 'CLEAR_PENDING_INVITE_INTENT' });
  }, [dispatch]);

  const handleInviteSignOutAndRetry = React.useCallback(async () => {
    // Sign out but keep the intent — the §6.5 "Sign in as someone
    // else" path. The reducer preserves the intent across SIGNED_OUT
    // (per the headline-preservation property).
    if (signedIn) {
      try {
        const { supabase } = await import('./src/lib/supabase');
        await supabase.auth.signOut();
      } catch {
        // ignore — signout failure leaves the user signed in, the
        // accept will still fail with email_mismatch, and the gate
        // will offer the retry again.
      }
    }
    dispatch({ type: 'SIGNED_OUT' });
  }, [dispatch, signedIn]);

  const handleInvitePromptSignIn = React.useCallback(() => {
    // The Auth screen renders next when status === 'signed_out'.
    // Nothing extra to do from the gate — the gate is dismissed by
    // virtue of the next render skipping it (it shows when status is
    // signed_out but only via the InviteRedeemGate branch below).
    dispatch({ type: 'SIGNED_OUT' });
  }, [dispatch]);

  let content: React.ReactNode;
  if (state.status === 'unconfigured') {
    content = <LoadingNotice message="Starting…" />;
  } else if (pendingInviteIntent) {
    // QOL-038 — InviteRedeemGate runs ABOVE both the AuthScreen and
    // MainAppShell when an invite is in flight. The gate decides
    // (a) whether to prompt sign-in, (b) whether to auto-accept,
    // (c) which §7.2 state to render. The escape hatch ("Go to my
    // arguments") clears the intent and drops the user on the
    // current AuthScreen / MainAppShell.
    content = (
      <InviteRedeemGate
        token={pendingInviteIntent.token}
        signedIn={signedIn}
        viewerEmail={contactEmail}
        onPromptSignIn={handleInvitePromptSignIn}
        onAccepted={handleAcceptedInvite}
        onExit={handleInviteExit}
        onSignOutAndRetry={handleInviteSignOutAndRetry}
      />
    );
  } else if (state.status === 'signed_out') {
    content = <AuthScreen />;
  } else {
    content = (
      <MainAppShell
        preferences={prefs}
        acceptedInviteDebateId={acceptedDebateId}
        onAcceptedInviteConsumed={() => setAcceptedDebateId(null)}
      />
    );
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

  // BRAND-001 — global dark backdrop. AppHeader docks at the top of every
  // screen. The DevEnvironmentBanner mount was removed (see import-block
  // note above); the component file is unchanged and can be remounted
  // when an operator wants the build-info ribbon back.
  return (
    <SafeAreaView style={styles.appRoot}>
      <AppHeader onHomePress={handleHomePress} rightSlot={preferencesTrigger} />
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
  /**
   * QOL-038 — debate id from a freshly-accepted invite. When non-null
   * on first render, the shell selects the debate (with the side stored
   * on the debate_participants row by the accept Edge Function) and
   * calls onAcceptedInviteConsumed so the parent clears it.
   */
  acceptedInviteDebateId?: string | null;
  onAcceptedInviteConsumed?: () => void;
}

function MainAppShell({
  preferences,
  acceptedInviteDebateId,
  onAcceptedInviteConsumed,
}: MainAppShellProps) {
  const { state, dispatch } = useAppSession();
  const { signOut, loading: signOutLoading } = useAuthSession();
  const [tab, setTab] = useState<ArgumentRoomTab>('arguments');
  const [replyTarget, setReplyTarget] = useState<{ id: string; argument: ArgumentRow } | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  // UX-001.3 — read-only Timeline active message id, surfaced from
  // ArgumentGameSurface via `onActiveMessageChange`. Passed to the
  // composer dock so its ComposerContextStrip can render a divergence
  // cue when the user has selected a different node than the composer
  // is bound to. Single source of truth stays in ArgumentGameSurface;
  // we just mirror it for the dock.
  const [timelineActiveMessageId, setTimelineActiveMessageId] = useState<string | null>(null);
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

  // QOL-040 — notification list + badge. The hook polls on
  // signed-in mount; the badge sits on the Arguments tab; the
  // list screen renders as an in-Arguments-tab sub-screen when
  // `notificationsOpen` is true. No router — the Stage 6.4
  // tab-host pattern is preserved.
  const notifications = useNotifications(state.snapshot.userId);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const handleOpenNotificationDeepLink = React.useCallback(
    (link: NotificationDeepLink, _n: RoomNotification): void => {
      // Close the list, then select the debate.
      // QOL-040.3 — Forward the notification's argumentId as a hint so
      // the room shell can pre-activate the specific move. The room
      // consumer (ArgumentGameSurface) falls back to the latest move if
      // the id is no longer in the loaded slice (soft-deleted, wrong
      // room, or RLS-hidden), so this is always safe. When the
      // notification has no specific move (`activeArgumentId` is null —
      // e.g. an `invite` or revoked `chime_in_rejected`), the helper
      // returns null and the room mounts with the latest move active as
      // before.
      setNotificationsOpen(false);
      const target = debates.find((d) => d.id === link.debateId);
      if (!target) return;
      const side = target.myParticipantSide ?? 'observer';
      setEntryHint(buildDeepLinkEntryHint(link));
      selectDebate(target, side);
    },
    [debates, selectDebate],
  );

  // Admin Arguments tab → open argument timeline. Mirrors the notification
  // deep-link handler: switch outer tab to Arguments, set view mode to
  // 'timeline', and pre-activate the specific argument via the entry-hint
  // mechanism. When the admin clicks a row whose room isn't in the loaded
  // `debates` slice (e.g. admin hasn't joined as observer yet), the handler
  // is a no-op rather than navigating somewhere broken.
  const handleOpenArgumentFromAdmin = React.useCallback(
    (debateId: string, argumentId: string): void => {
      const target = debates.find((d) => d.id === debateId);
      if (!target) return;
      const side = target.myParticipantSide ?? 'observer';
      setEntryHint({
        activate: 'latest',
        code: 'watch_first',
        verbPhrase: '',
        helperLine: '',
        presetKey: null,
        dockAction: null,
        entryHintForArgumentId: argumentId,
      });
      setViewMode('timeline');
      setTab('arguments');
      selectDebate(target, side);
    },
    [debates, selectDebate],
  );

  // QOL-038 — consume the accepted-invite hand-off. Wait until debates
  // is loaded (so the participant row from the accept step is in scope)
  // then select that debate with the side stored on the participant row.
  // The debate's `myParticipantSide` is populated by listDebates from
  // the freshly-inserted debate_participants row.
  React.useEffect(() => {
    if (!acceptedInviteDebateId) return;
    if (debatesLoading) return;
    const target = debates.find((d) => d.id === acceptedInviteDebateId);
    if (target) {
      // myParticipantSide is populated by listDebates from the
      // debate_participants row the accept Edge Function just inserted.
      // If the row hasn't synced yet, fall back to 'negative' — the
      // doctrine-safe responder default the accept step uses when the
      // room creator has no side row yet. The next refresh corrects it.
      const side = target.myParticipantSide ?? 'negative';
      selectDebate(target, side);
      onAcceptedInviteConsumed?.();
    } else {
      // The participant row may not be in the debates list yet (the
      // listDebates query runs once on mount; the accept step happened
      // moments before). A single explicit refresh + retry-on-next-render
      // handles the race.
      void refresh();
    }
    // Intentional: this effect must re-run when debates updates so the
    // first render after refresh() catches the target.
  }, [
    acceptedInviteDebateId,
    debates,
    debatesLoading,
    refresh,
    selectDebate,
    onAcceptedInviteConsumed,
  ]);

  const tabs = getVisibleTabs(currentProfile?.role ?? null, Boolean(__DEV__));

  const activeTab = tabs.includes(tab) ? tab : 'arguments';

  // UX-001.2 — Hide the global tab bar when a room is active. The strip in
  // DebateDetailHeader carries the room-exit affordance (Leave argument) so the
  // user can return to the gallery without the tab bar. When notifications is
  // open the room is not rendered, so `roomActive` is false there and the tab
  // bar remains visible (the QOL-040 flow is preserved).
  const roomActive =
    activeTab === 'arguments' && hasDebate && Boolean(currentDebate) && !notificationsOpen;

  const handleSignOut = async () => {
    await signOut();
    dispatch({ type: 'SIGNED_OUT' });
  };

  const handleStartArgument = () => {
    setReplyTarget(null);
    setComposerOpen(true);
  };

  // UX-001.3 — tap on the persistent collapsed composer strip. Opens
  // the dock against the currently-active Timeline message (if any),
  // else against the room root.
  const handleComposerExpand = () => {
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

      {/* Top tab bar. UX-001.2 — hidden when a room is active so the Timeline
          becomes the first substantive in-room object beneath the AppHeader
          plus one compact room/context strip. Restored on room exit. */}
      {!roomActive ? (
        <View style={styles.tabBar} testID="app-tab-bar">
          {tabs.map((t) => (
            <Pressable
              key={t}
              style={[styles.tab, activeTab === t && styles.tabActive]}
              onPress={() => { setTab(t); }}
              accessibilityRole="tab"
              accessibilityLabel={TAB_LABELS[t]}
            >
              <View style={styles.tabContent}>
                <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                  {TAB_LABELS[t]}
                </Text>
                {/* QOL-040 — unread-notification badge on the Arguments
                    tab only. Renders nothing when count === 0. */}
                {t === 'arguments' ? (
                  <View style={styles.tabBadgeSlot}>
                    <NotificationBadge unreadCount={notifications.unreadCount} />
                  </View>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.body}>
        {/* QOL-040 — notification list screen. Renders as a routed
            sub-screen on top of the Arguments tab when the user
            taps the "Notifications" trigger in the gallery
            toolbar. Closing the list returns to the gallery. */}
        {activeTab === 'arguments' && notificationsOpen && (
          <NotificationListScreen
            notifications={notifications.notifications}
            unreadCount={notifications.unreadCount}
            loading={notifications.loading}
            error={notifications.error}
            onRefresh={() => notifications.refresh()}
            onMarkOneRead={(id) => notifications.markOneRead(id)}
            onMarkAllRead={() => notifications.markAllRead()}
            onOpenDeepLink={handleOpenNotificationDeepLink}
          />
        )}
        {/* Arguments tab: Conversation Gallery (no room selected). */}
        {activeTab === 'arguments' && !hasDebate && !notificationsOpen && (
          <View style={styles.galleryWithToolbar}>
            {/* QOL-040 — gallery toolbar exposes the
                "Notifications" entry. The badge mirrors the tab
                badge so the unread count is visible at the
                gallery surface even when the user is already on
                the Arguments tab. */}
            <View style={styles.galleryToolbar}>
              <Pressable
                style={styles.notificationsTrigger}
                onPress={() => setNotificationsOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Open notifications"
                accessibilityHint="Shows your unread invites, replies, and other room activity."
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID="open-notifications-trigger"
              >
                <Text style={styles.notificationsTriggerText}>Notifications</Text>
                <View style={styles.tabBadgeSlot}>
                  <NotificationBadge unreadCount={notifications.unreadCount} testID="notification-badge-toolbar" />
                </View>
              </Pressable>
            </View>
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
              // NAV-START-ARGUMENT-001 Slice A — after the Start Argument
              // page creates a room (via the existing `create` path above),
              // open it into the surface the author chose. Internal view id
              // `stack` is the user-facing "Cards" view (see viewModeCopy).
              // The creator is the room moderator (createDebate auto-joins
              // them as moderator), so we select with that side.
              onCreatedWithSurface={(debate, surface) => {
                setEntryHint(null);
                setViewMode(surface === 'card' ? 'stack' : 'timeline');
                selectDebate(debate, 'moderator');
              }}
            />
          </View>
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
            the entry-hint micro-moment, and scroll position for free.
            QOL-040 — the room is hidden while the notification list
            sub-screen is open. */}
        {activeTab === 'arguments' && hasDebate && currentDebate && !notificationsOpen && (
          <View style={styles.debateRoom}>
            {/* UX-001.2 — compact room/context strip. Replaces the old
                two-row DebateDetailHeader + roomToolbar with a single-row
                strip that meets 48/56/64 per band. Carries the Timeline /
                Cards toggle, Leave control, status / side / private
                badges, and an overflow trigger for invite + make-private
                + dev chips + GAME-004 seat strip. */}
            <DebateDetailHeader
              debate={currentDebate}
              participantSide={participantSide}
              onLeave={handleLeaveRoom}
              roomContract={roomContract.viewModel ?? undefined}
              currentUserId={state.snapshot.userId}
              viewMode={viewMode}
              onSetViewMode={setViewMode}
              onToggleInvite={() => setInviteOpen((v) => !v)}
              inviteOpen={inviteOpen}
              onSetDevTreeMode={__DEV__ ? () => setViewMode('tree') : undefined}
              onSetDevTracksMode={__DEV__ ? () => setViewMode('tracks') : undefined}
            />

            {/* Invite panel (inline, collapsible) — QOL-038 rewrite.
                The panel uses useRoomInvites for the real Edge Function
                create + revoke flow. `canInvite` is true when the
                viewer is a primary participant (affirmative / negative)
                or the room creator — pure observers see a notice. */}
            {inviteOpen && (
              <View style={styles.invitePanelWrapper}>
                <InvitePanel
                  debateId={currentDebate.id}
                  roomTitle={currentDebate.title}
                  canInvite={
                    state.snapshot.userId === currentDebate.createdBy ||
                    participantSide === 'affirmative' ||
                    participantSide === 'negative'
                  }
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
              // UX-001.3 — mirror the Timeline's active id into App state
              // so the dock can show a divergence cue; render the
              // persistent collapsed composer strip via onComposerExpand.
              onActiveMessageChange={setTimelineActiveMessageId}
              onComposerExpand={handleComposerExpand}
              // UX-001.4 — Go popout's "Leave argument" entry calls the
              // existing handleLeaveRoom path (not a new room-exit path).
              onLeaveRoom={handleLeaveRoom}
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
              // UX-001.3 — read-only Timeline active id for divergence cue.
              activeMessageId={timelineActiveMessageId}
            />
          </View>
        )}

        {activeTab === 'account' && (
          <AccountScreen onSignOut={handleSignOut} signOutLoading={signOutLoading} />
        )}

        {activeTab === 'admin' && currentProfile?.role === 'admin' && (
          <AdminScreen onOpenArgumentTimeline={handleOpenArgumentFromAdmin} />
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
  tabContent: { flexDirection: 'row', alignItems: 'center' },
  tabText: { fontSize: 12, color: BRAND.text.muted, fontWeight: '500' },
  tabTextActive: { color: BRAND.text.primary },
  // QOL-040 — tab badge sits to the right of the tab label.
  tabBadgeSlot: { marginLeft: 6 },
  galleryWithToolbar: { flex: 1 },
  galleryToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  notificationsTrigger: {
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1f1c2c',
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationsTriggerText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.text.primary,
  },
  body: { flex: 1, backgroundColor: BRAND.surface.app.bg },
  debateRoom: { flex: 1, backgroundColor: BRAND.surface.app.bg },

  // UX-001.2 — the previous `roomToolbar` / `roomToolbarInner` / `roomLabel`
  // / `toolbarSep` / `toolbarChip` / `toolbarChipActive` / `toolbarChipText`
  // / `toolbarChipTextActive` styles were removed when the separate toolbar
  // row dissolved into the compact DebateDetailHeader strip. The Timeline /
  // Cards toggle, invite trigger, and dev chips now live in the strip's
  // single row + overflow panel.

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
