import { StatusBar } from 'expo-status-bar';
import React, { useState, useRef } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { AppSessionProvider } from './src/features/session/AppSessionProvider';
import { useAppSession } from './src/features/session/useAppSession';
import { SessionDebugPanel } from './src/features/session/SessionDebugPanel';
import { AuthScreen } from './src/features/auth/AuthScreen';
// AUTH-CALLBACK-CONSUMER-001 — the Supabase invite/confirmation redirect lands
// on `/auth/callback`. AuthCallbackScreen consumes that URL into a session (or
// a plain recoverable error) and hosts the invited-user set-password step.
// isAuthCallbackPath is the pure path test captured synchronously at App boot.
import { AuthCallbackScreen } from './src/features/auth/AuthCallbackScreen';
import { isAuthCallbackPath } from './src/lib/auth/parseAuthCallbackUrl';
import { LoadingNotice } from './src/components/LoadingNotice';
import { useAuthSession } from './src/features/auth/useAuthSession';
import { DebateDetailHeader, useDebates, useCurrentDebate, useRoomContract } from './src/features/debates';
// ARG-ROOM-005 — public seat claiming: live active-participant count + the
// pure seat-availability model + the post-claim side-effect resolver.
import {
  useActiveParticipantCount,
  deriveSeatAvailability,
  resolveJoinSideEffect,
} from './src/features/debates';
import type { ParticipantSide } from './src/features/debates';
import { ConversationGalleryScreen } from './src/features/debates/ConversationGalleryScreen';
// HOME-001 (#874) — App.tsx is the intended SOLE consumer of the ASP feature
// flag registry: the nav seam owns the landing choice, so the flag read lives
// here (repo root), never inside src/features/** (that would trip the
// featureFlagsStaticEnv consumer guard AND couple a presentational component to
// global env state). See featureFlagsStaticEnv.test.ts allowlist.
import { isHomeV2Enabled } from './src/lib/featureFlags';
// ROOM-001 (#876) — App.tsx (the nav seam) is also the sole consumer of the
// room_exchange_v2 flag. SEPARATE import line by design: the
// featureFlagsStaticEnv pin matches the isHomeV2Enabled import EXACTLY, so this
// accessor must not merge into that specifier list. The boolean threads down
// as a prop; no src/features file imports featureFlags.
import { isRoomExchangeV2Enabled } from './src/lib/featureFlags';
// PROOF-002 (#889) — App.tsx (the sole flag consumer) reads the proof_drawer
// flag here and threads the boolean down as a prop. SEPARATE import line by
// design: the featureFlagsStaticEnv pin matches the isHomeV2Enabled import
// EXACTLY, so this accessor must not merge into that specifier list.
import { isProofDrawerEnabled } from './src/lib/featureFlags';
// MARK-002 (#894) — App.tsx (the sole flag consumer) reads the timestamp_rebuttals
// flag here and threads the boolean down as a prop. SEPARATE import line by
// design (the featureFlagsStaticEnv pin matches the isHomeV2Enabled import
// EXACTLY, so this accessor must not merge into that specifier list).
import { isTimestampRebuttalsEnabled } from './src/lib/featureFlags';
import { ProofDrawer, attachProof, detachProof } from './src/features/proof';
// MARK-002 (#894) — the narrow create-marker client seam + the pending scope type.
import { createMarkerScoped } from './src/features/arguments/markers/createMarkerApi';
import type { PendingMarkerScope } from './src/features/arguments/markers/timestampMarkerModel';
import type { ProofDrawerScope } from './src/features/proof';
import { ArgumentHome } from './src/features/home';
import type { GalleryEntryHint } from './src/features/debates/conversationGalleryModel';
// QOL-040.3 — pure helper that builds the entry hint from a notification
// deep-link target. Lives in `src/features/debates/` because it produces
// the GalleryEntryHint that the room shell consumes; the NotificationDeepLink
// input is imported from the notifications module (read-only).
import { buildDeepLinkEntryHint } from './src/features/debates/deepLinkEntryHint';
// ARG-ROOM-006 (item c) — pure deep-link access resolver + the cause-neutral
// "unavailable" notice. A requested room id absent from the RLS-filtered list
// resolves to `unavailable` (IDENTICAL for private-no-access and nonexistent —
// the no-enumeration guarantee). No RLS change; pure client logic.
import { resolveRoomDeepLinkAccess } from './src/features/debates/roomAccessModel';
import { RoomUnavailableNotice } from './src/features/debates/RoomUnavailableNotice';
import { useGalleryArguments } from './src/features/debates/useGalleryArguments';
import { ArgumentTreeScreen } from './src/features/arguments';
// START-001 (#827) — person-first start sheet + its recents hook. Mounts only
// behind home_v2 (see the startSheetActive branch below); the legacy
// StartArgumentPage stays the flag-off create surface.
import { StartArgumentSheet, PublicArgumentToggle } from './src/features/arguments/startArgument';
// Imported from its own module path (NOT the barrel) so the barrel stays
// supabase-free — the hook pulls src/lib/supabase transitively, and the barrel
// is imported by presentational consumers (ConversationGalleryScreen).
import { useRecentOpponents } from './src/features/arguments/startArgument/useRecentOpponents';
// START-002 (#839) — circles the caller is a live member of. Feeds the start
// sheet (a circle audience) and the HOME-003 circle-home filter lane. RLS-scoped
// SELECT-only read; no service role. A no-op ([]) when signed out / unconfigured.
import { useMyCircles } from './src/features/circles/useMyCircles';
// HOME-003 (#840) — map the shared circle summaries into the ArgumentHome
// filter lens (identity-free: id + name + size).
import { toCircleLens } from './src/features/circles/circleHomeFilter';
// COMPOSER-002 — the composer renders as an in-room dock, not a full-page
// "Your Move" screen swap. The room stays mounted behind the dock.
import { ArgumentComposerDock } from './src/features/arguments/ArgumentComposerDock';
// ROOM-003 (#829) — the one-bar entry composer. Mounted only when the
// room_exchange_v2 flag is on (rides the same threaded boolean as the
// ROOM-001 state rail); flag OFF leaves the dock-primary composer untouched.
import { ArgumentEntryComposer } from './src/features/arguments/composer/ArgumentEntryComposer';
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
  resolveColdStartInviteToken,
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
import { ROOM_COPY, SEAT_CLAIM_COPY } from './src/features/arguments/gameCopy';
// UX-001.2 — VIEW_MODE_COPY is consumed inside DebateDetailHeader's compact
// strip; App.tsx no longer renders the toggle so only the default is needed.
import { DEFAULT_VIEW_MODE } from './src/features/arguments/viewModeCopy';
// DevEnvironmentBanner mount removed — operator opted out of the persistent
// "Unverified build · no build metadata" ribbon during Stage 6.4 smoke work.
// The component itself (src/features/devEnvironment/DevEnvironmentBanner.tsx)
// is intact for later reinstatement if a release surface needs it again.
import { AppHeader } from './src/components/AppHeader';
// NAV-HEADER-INLINE-001 (refines NAV-START-ARGUMENT-001 Slice B) — the
// stylized primary nav (Start An Argument · Browse Arguments · My Arguments
// · Profile, plus About top-right + copyright lower-right) is mounted INSIDE
// the masthead via the AppHeader navSlot so the logo and the nav share one
// header container. State-only — drives the in-memory shell state via
// resolvePrimaryNavTransition; NO router (TL-003 / COMPOSER-002 invariant).
import {
  AppPrimaryNav,
  AboutScreen,
  deriveActivePrimaryNavSection,
  resolvePrimaryNavTransition,
  type PrimaryNavSection,
} from './src/features/navigation';
import type { ConversationGallerySection } from './src/features/debates/conversationGalleryModel';
// DEMO-001 — Recruitable Debate Demo Corridor. A deterministic, no-provider,
// no-spend first-run walkthrough reached from the gallery toolbar. Renders as
// a routed sub-screen (state-flag nav, mirroring `aboutOpen`); the production
// gallery / room are unchanged when the corridor is closed.
import { DemoCorridorScreen, CORRIDOR_COPY } from './src/features/demoCorridor';
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

  // AUTH-CALLBACK-CONSUMER-001 — capture a `/auth/callback` navigation
  // SYNCHRONOUSLY at first render (in the useState initializer, before any
  // effect runs) so the implicit-flow fragment token is read before anything
  // can strip or race it. Web-only: native (`typeof window === 'undefined'`)
  // never activates the branch, so iOS/Android boot is unchanged. The flag is
  // flipped off by the AuthCallbackScreen onDone callback after it clears the URL.
  const [authCallback, setAuthCallback] = useState<{ active: boolean; url: string }>(() => {
    if (typeof window === 'undefined') return { active: false, url: '' };
    const { pathname, href } = window.location;
    return isAuthCallbackPath(pathname) ? { active: true, url: href } : { active: false, url: '' };
  });

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

  // ── QOL-038 + ARG-ROOM-004 — invite deep-link / bridge capture ──
  // On cold start, parse window.location for an invite token in EITHER
  // shape and capture it into the pendingInviteIntent slice + the
  // dedicated device-local storage key:
  //   - QOL-038      `/invite/<token>` deep-link path (shared link), and
  //   - ARG-ROOM-004 `/auth/callback?invite=<token>` bridge query (the
  //     redirect a brand-new invitee lands on from the Supabase Auth
  //     invite email; the higher-priority AuthCallbackScreen runs first
  //     for the set-password step, then this captured intent drives the
  //     shipped auto-accept once the URL is cleared).
  // The intent flows through the SIGNED_OUT → SIGNED_IN reducer
  // transition (the headline preservation property in sessionReducer.ts)
  // so the accept-on-first-signed-in trigger can fire after a fresh
  // sign-up. Native scheme (cdiscourse://invite/<token>) capture is left
  // for a follow-up — Expo Linking integration is a dependency-level
  // change beyond this card.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const nowIso = new Date().toISOString();
      // 1) Resolve the cold-start token from either shape. Web only here;
      //    native path is follow-up. resolveColdStartInviteToken NEVER
      //    throws and reads only the query for the bridge (never the
      //    implicit-flow `#access_token=…` fragment secrets).
      let token: string | null = null;
      if (typeof window !== 'undefined' && window.location?.href) {
        token = resolveColdStartInviteToken(window.location.href);
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

  const handleInvitePromptSignIn = React.useCallback(
    (_input: { invitedEmail: string | null; preferSignUp: boolean }) => {
      // EMAIL-TRANSPORT-002 — the gate's primary new-user / sign-in paths
      // are now handled IN PLACE by InviteCredentialStep (the credential
      // step never leaves /invite). This callback remains the fallback for
      // the gate's session-expired-mid-accept recovery (AcceptErrorBranch
      // → SessionExpiredPrompt): drop to the generic AuthScreen. The
      // `invitedEmail` / `preferSignUp` hint is consumed here (no
      // enumeration — `invitedEmail` is always null from the gate, which
      // never learns the invited address; the hint exists for a future
      // invite-aware AuthScreen, explicitly out of scope this card).
      void _input;
      dispatch({ type: 'SIGNED_OUT' });
    },
    [dispatch],
  );

  // AUTH-GOOGLE-SSO-005 (#748) — when the /auth/callback consumer finishes
  // (e.g. a Google OAuth `?code=` return that established a session), re-read
  // the persisted invite intent and feed it into the gate DETERMINISTICALLY,
  // rather than depending on the empty-deps cold-start one-shot having already
  // resolved. Idempotent: if the cold-start effect already set the same intent,
  // SET_PENDING_INVITE_INTENT just re-sets the identical slice; if there is no
  // persisted intent (a normal Google sign-in with no invite), the load returns
  // null and we leave the gate un-mounted. Stale/malformed intents are dropped
  // inside the load helper. The token is never logged. setAuthCallback runs
  // FIRST so the flag flip is never delayed by the async load (the gate mounts
  // on the next render; the dispatched intent lands in the same or the
  // immediately-following commit, both before the gate's auto-accept effect,
  // which itself awaits lookupInviteByToken). The cold-start branch-2 re-read
  // (the empty-deps effect above) is RETAINED — the two paths are
  // complementary and both idempotent.
  const handleAuthCallbackDone = React.useCallback(async () => {
    setAuthCallback({ active: false, url: '' });
    try {
      const persisted = await loadPendingInviteIntentFromStorage(
        new Date().toISOString(),
      );
      if (persisted) {
        dispatch({ type: 'SET_PENDING_INVITE_INTENT', intent: persisted });
      }
    } catch {
      // Non-fatal — load never throws by contract; the try/catch is belt-and-
      // suspenders so a storage anomaly can never block leaving the callback.
    }
  }, [dispatch]);

  // BRAND-001 — Tapping the header logo deselects the active debate and
  // returns to the gallery. Implemented by re-dispatching SIGNED_IN
  // (the same path `useCurrentDebate.deselectDebate` uses). No router,
  // so the TL-003 no-route invariant is preserved.
  //
  // NAV-HEADER-INLINE-001 — declared above the `content` block so the
  // signed-in MainAppShell can receive it (and the gear) as props and host
  // the integrated masthead itself.
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

  let content: React.ReactNode;
  if (authCallback.active) {
    // AUTH-CALLBACK-CONSUMER-001 — highest priority. If we are on
    // /auth/callback, that is unambiguously the flow to run: the screen
    // consumes the URL into a session (or a plain recoverable error) and, for
    // an invited (passwordless) user, hosts the required set-password step.
    // On Continue / Return it clears the URL via history.replaceState and
    // flips this flag so AppRoot routes normally afterward. The session the
    // consume establishes flows through the existing AppSessionProvider
    // onAuthStateChange listener for free.
    content = (
      <AuthCallbackScreen
        capturedUrl={authCallback.url}
        // AUTH-GOOGLE-SSO-005 (#748) — deterministic invite-intent re-read on
        // callback-done (named callback, not the bare inline setAuthCallback)
        // so a Google `?code=` return resumes the invite gate deterministically.
        onDone={handleAuthCallbackDone}
      />
    );
  } else if (state.status === 'unconfigured') {
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
        onHomePress={handleHomePress}
        headerRightSlot={preferencesTrigger}
      />
    );
  }
  // NAV-HEADER-INLINE-001 — the signed-in shell owns its own masthead so
  // the primary nav can render INSIDE the AppHeader container (the masthead
  // carries the nav). AppRoot therefore renders the bare AppHeader only for
  // the non-shell session states (unconfigured / invite / callback), where
  // there is no authenticated primary nav to integrate. This avoids a
  // double header while keeping AppHeader mounted from App.tsx.
  // AUTH-CALLBACK-CONSUMER-001 — the callback screen is one of the non-shell
  // session states, so the bare AppHeader still docks above it (the shell owns
  // its own integrated masthead; the callback screen does not).
  //
  // UX-BRAND-ASSETS-002 — the plain `signed_out` AuthScreen is the ONE
  // non-shell state that NO LONGER docks the bare masthead. The Sign In
  // screen already carries the gold lockup inside its value-prop card, so a
  // second masthead lockup directly above it was a duplicative banner
  // (operator: "remove it fully"). The bare masthead still docks for the
  // loading (`unconfigured`), invite (`pendingInviteIntent`), and
  // `/auth/callback` states, which have no in-content brand mark of their own.
  const showRootHeader =
    authCallback.active ||
    state.status === 'unconfigured' ||
    Boolean(pendingInviteIntent);

  // BRAND-001 — global dark backdrop. AppHeader docks at the top of every
  // screen. The DevEnvironmentBanner mount was removed (see import-block
  // note above); the component file is unchanged and can be remounted
  // when an operator wants the build-info ribbon back.
  //
  // NAV-HEADER-INLINE-001 — for the signed-in shell the masthead (with the
  // integrated primary nav) is rendered INSIDE MainAppShell, so AppRoot
  // skips its bare AppHeader there to avoid a double header. The bare
  // header still renders for the unconfigured / invite / callback states.
  // UX-BRAND-ASSETS-002 — it no longer renders for the plain signed_out
  // (Sign In) state; that screen carries its own in-content gold lockup.
  return (
    <SafeAreaView style={styles.appRoot}>
      {showRootHeader ? (
        <AppHeader onHomePress={handleHomePress} rightSlot={preferencesTrigger} />
      ) : null}
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
  /**
   * NAV-HEADER-INLINE-001 — logo-tap handler, threaded from AppRoot so the
   * shell can host its own integrated masthead (logo + inline primary nav).
   * State-only deselect; no router.
   */
  onHomePress?: () => void;
  /**
   * NAV-HEADER-INLINE-001 — the header right slot (PR-001 preferences gear),
   * threaded from AppRoot so the gear keeps living at the right edge of the
   * masthead even though the masthead is now rendered by the shell.
   */
  headerRightSlot?: React.ReactNode;
}

function MainAppShell({
  preferences,
  acceptedInviteDebateId,
  onAcceptedInviteConsumed,
  onHomePress,
  headerRightSlot,
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
  // NAV-START-ARGUMENT-001 Slice B — global-header primary-nav shell state.
  // These three fields are plain in-memory state writes (no router):
  //  - galleryLane: the active Conversation Gallery lane. 'my_rooms' is the
  //    "My Arguments" view; 'all' is the full "Browse Arguments" gallery.
  //  - startArgumentOpen: whether the Start Argument page is showing.
  //  - aboutOpen: whether the public About screen is showing.
  // They are CONTROLLED into ConversationGalleryScreen / mounted screens so
  // the centered primary nav can drive the same surfaces the gallery's own
  // chips + "+ New room" button already drive.
  // HOME-001 (#874) — the ONE home_v2 flag read. It controls only (i) the
  // galleryLane initial value below and (ii) whether the ArgumentHome branch is
  // allowed to mount. Flag OFF => initial lane is 'all', 'home' is never set by
  // any code path, so the gallery landing renders byte-identically to today.
  const homeV2Enabled = isHomeV2Enabled();
  // ROOM-001 (#876) — default OFF. Threaded into ArgumentTreeScreen so the room
  // orchestrator mounts the ambient ArgumentStateRail only behind the flag.
  const roomExchangeV2Enabled = isRoomExchangeV2Enabled();
  // PROOF-002 (#889) — default OFF. Threaded into ArgumentTreeScreen (read-path
  // flip) + gates the Source-slot onOpenProof callback + the ProofDrawer mount.
  const proofDrawerEnabled = isProofDrawerEnabled();
  // MARK-002 (#894) — default OFF. Threaded into ArgumentTreeScreen (gates the
  // marker read + Ringside surface + phrase picker) and into the entry composer
  // (the composer_scope chip). OFF => no marker prop passed => byte-identical.
  const timestampRebuttalsEnabled = isTimestampRebuttalsEnabled();
  const { width: proofDrawerWidth, height: proofDrawerHeight } = useWindowDimensions();
  const [proofDrawerScope, setProofDrawerScope] = useState<ProofDrawerScope | null>(null);
  // MARK-002 — the pending marker scope (a picked phrase) during composition. The
  // marker mints post-submit (atomic mint + link, no orphans); null when no
  // phrase is scoped. Only ever set when the flag is on.
  const [pendingMarkerScope, setPendingMarkerScope] = useState<PendingMarkerScope | null>(null);
  // 'home' is deliberately NOT a ConversationGallerySection (that union drives
  // groupGalleryCardsBySection / gallery chips); it lives only in this
  // App.tsx-local lane state, so the gallery model is not perturbed.
  const [galleryLane, setGalleryLane] = useState<ConversationGallerySection | 'all' | 'home'>(
    homeV2Enabled ? 'home' : 'all',
  );
  const [startArgumentOpen, setStartArgumentOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  // DEMO-001 — whether the Recruitable Debate Demo Corridor is showing.
  // Mirrors `aboutOpen`: a state-flag routed sub-screen, no router. Production
  // never sets this except via the gallery-toolbar "See how it works" trigger.
  const [demoCorridorOpen, setDemoCorridorOpen] = useState(false);
  const refreshTreeRef = useRef<(() => void) | null>(null);

  const { debates, loading: debatesLoading, error: debatesError, refresh, create, join } = useDebates();
  const { currentDebate, selectDebate, deselectDebate } = useCurrentDebate(debates);
  const galleryArgs = useGalleryArguments(debates.map((d) => d.id));
  const { profile: currentProfile } = useAccountProfile(state.snapshot.userId);
  // START-001 (#827) — recent-opponent invites for the person-first sheet. The
  // hook is a no-op ([]) when the sheet is not mounted (unconfigured / signed
  // out); it never blocks and never enumerates other users (RLS-scoped read).
  const recentOpponents = useRecentOpponents(state.snapshot.userId || null);
  // START-002 (#839) — the caller's live circles. One RLS-scoped read shared by
  // the start sheet (circle audience) and the HOME-003 filter lane. A no-op ([])
  // when signed out / unconfigured; never blocks a surface.
  const myCircles = useMyCircles(state.snapshot.userId || null);

  const hasDebate = Boolean(state.snapshot.selectedDebateId);

  // QOL-040 — notification list + badge. The hook polls on
  // signed-in mount; the badge sits on the Arguments tab; the
  // list screen renders as an in-Arguments-tab sub-screen when
  // `notificationsOpen` is true. No router — the Stage 6.4
  // tab-host pattern is preserved.
  const notifications = useNotifications(state.snapshot.userId);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  // ARG-ROOM-006 (item c) — the cause-neutral "unavailable" notice for a deep
  // link whose room id is not in the RLS-filtered `debates` list.
  const [roomUnavailableOpen, setRoomUnavailableOpen] = useState(false);
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
      // ARG-ROOM-006 (item c) — if the room id is absent from the RLS-filtered
      // list, surface the cause-neutral "unavailable" notice instead of
      // silently dropping to the gallery. `unavailable` is IDENTICAL for a
      // private room the viewer cannot see AND a nonexistent/typo'd id — the
      // no-enumeration guarantee. No RLS change: QOL-039 already withheld it.
      const access = resolveRoomDeepLinkAccess({
        requestedDebateId: link.debateId,
        loadedDebateIds: debates.map((d) => d.id),
      });
      if (access.outcome === 'unavailable') {
        setRoomUnavailableOpen(true);
        return;
      }
      const target = debates.find((d) => d.id === link.debateId);
      if (!target) {
        // Defensive: `resolved` implies the id is present. If it somehow is
        // not, fall back to the same neutral notice (never a silent drop).
        setRoomUnavailableOpen(true);
        return;
      }
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

  // QUOTE-FORGE-001 — open a PRIOR settled argument room referenced by a
  // linked-prior chip. REUSES the exact deep-link mechanism the notification
  // + admin handlers use (resolveRoomDeepLinkAccess + debates.find +
  // selectDebate). An id absent from the RLS-filtered `debates` list drives
  // the same neutral "unavailable" notice (the no-enumeration guarantee) —
  // never a silent drop, never a new room-open path. Only reached for an
  // authorized chip (title_only / unavailable chips disable Open).
  const handleOpenPriorRoom = React.useCallback(
    (targetDebateId: string): void => {
      const access = resolveRoomDeepLinkAccess({
        requestedDebateId: targetDebateId,
        loadedDebateIds: debates.map((d) => d.id),
      });
      if (access.outcome === 'unavailable') {
        setRoomUnavailableOpen(true);
        return;
      }
      const target = debates.find((d) => d.id === targetDebateId);
      if (!target) {
        setRoomUnavailableOpen(true);
        return;
      }
      const side = target.myParticipantSide ?? 'observer';
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

  // MARK-002 (#894) — the room emitted a picked phrase scope. Hold it as client
  // state; the composer_scope chip renders it and the marker mints post-submit.
  const handleMarkerScopePicked = (scope: PendingMarkerScope) => {
    setPendingMarkerScope(scope);
  };
  const handleClearScopedMarker = () => {
    setPendingMarkerScope(null);
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

  // MARK-002 (#894) — the entry-composer submit variant: reset exactly like
  // handleSubmitSuccess, then mint + link a scoped marker to the just-posted
  // reply (post-submit, atomic, no orphans). The pinned dock composer keeps
  // handleSubmitSuccess (no id, no mint) so the COMPOSER-002 dock wiring stays
  // byte-identical. A mint failure never blocks the reply (already posted);
  // createMarkerScoped never throws.
  const handleEntrySubmitSuccess = (newArgumentId?: string) => {
    handleSubmitSuccess();
    const scope = pendingMarkerScope;
    setPendingMarkerScope(null);
    if (timestampRebuttalsEnabled && scope && newArgumentId && currentDebate) {
      void createMarkerScoped({
        debateId: currentDebate.id,
        scope,
        replyArgumentId: newArgumentId,
      }).then((result) => {
        // Converge the reply chip once the marker exists (the new reply id also
        // re-runs useMarkers via idsKey, but a refresh guarantees the read).
        if (result.ok) refreshTreeRef.current?.();
      });
    }
  };

  // PROOF-002 (#889) — open the source drawer from the composer Source slot.
  // Scopes to the authors OWN posted move (a real attach target) when the reply
  // target is that move; otherwise a draft scope (attach applies after posting).
  const openProofForDraft = () => {
    if (!currentDebate) return;
    const target = replyTarget;
    const isOwnPostedMove =
      !!target && target.argument.authorId === state.snapshot.userId && target.argument.status === 'posted';
    setProofDrawerScope(
      isOwnPostedMove
        ? { kind: 'argument', debateId: currentDebate.id, argumentId: target!.argument.id, owedDebtKind: null }
        : { kind: 'draft', debateId: currentDebate.id, argumentId: null },
    );
  };

  const handleLeaveRoom = () => {
    setComposerOpen(false);
    setReplyTarget(null);
    setInviteOpen(false);
    deselectDebate();
  };

  // NAV-START-ARGUMENT-001 Slice B — apply a primary-nav item's in-memory
  // transition. The pure model (resolvePrimaryNavTransition) names the
  // target state; this handler writes it. Every item returns to a top-level
  // surface, so it always closes the composer + any open room first. No
  // router, no Linking — purely setState calls (the no-route invariant).
  const handlePrimaryNav = React.useCallback(
    (section: PrimaryNavSection) => {
      const t = resolvePrimaryNavTransition(section);
      if (t.deselectRoom) {
        setComposerOpen(false);
        setReplyTarget(null);
        setInviteOpen(false);
        setNotificationsOpen(false);
        if (hasDebate) deselectDebate();
      }
      setTab(t.tab);
      setStartArgumentOpen(t.startArgumentOpen);
      setGalleryLane(t.galleryLane);
      setAboutOpen(t.aboutOpen);
    },
    [hasDebate, deselectDebate],
  );

  // Derive which primary nav item renders as active from the live shell
  // state. Pure — no side effects.
  const activePrimarySection = deriveActivePrimaryNavSection({
    tab: activeTab,
    hasDebate,
    startArgumentOpen,
    galleryLane,
    aboutOpen,
  });

  const participantSide = state.snapshot.participantSide;

  // GAME-004 — derive the 1v1 PvP room contract for the open room. The hook
  // is called unconditionally (Rules of Hooks); when no room is selected the
  // empty roomId makes it return `viewModel: null` and the header renders
  // unchanged.
  //
  // UX-ROOM-1V1-CHIMEIN-001A (design §5.1) — thread the PERSISTED
  // `currentDebate.visibility` into the contract so a private room reads
  // "Private 1:1" in the header seat strip. Previously `roomType` was omitted,
  // so the model defaulted to 'public' for EVERY room (a display bug — even a
  // private room showed the open public seat copy). `visibility` is already
  // loaded on `currentDebate` (it drives `seatAvailability` just below), so this
  // is pure display-data threading — no persistence / capacity / seat-claim
  // behavior changes. `RoomVisibility` ('public' | 'private') is exactly the
  // model's `RoomType`.
  const roomContract = useRoomContract({
    roomId: currentDebate?.id ?? '',
    initiatorUserId: currentDebate?.createdBy ?? '',
    openedAt: currentDebate?.createdAt ?? '',
    viewerUserId: state.snapshot.userId || null,
    options: { roomType: currentDebate?.visibility },
  });

  // ARG-ROOM-005 — live public-room seat availability. The hook is called
  // unconditionally (Rules of Hooks); an empty roomId yields a 0 count. The
  // seat-availability preview is derived ONLY for PUBLIC rooms (the claim flow
  // is a public-room feature). A public viewer always passes
  // knownReservedInviteCount = 0 — reserved invites are RLS-hidden, so a room
  // with a hidden reserved invite and one with a genuinely-open seat render
  // identically (no differential signal); the deployed ARG-ROOM-002 trigger
  // stays authoritative on claim.
  const seatCount = useActiveParticipantCount(currentDebate?.id ?? null);
  const seatAvailability =
    currentDebate && currentDebate.visibility === 'public'
      ? deriveSeatAvailability({
          visibility: 'public',
          activeParticipantCount: seatCount.activeParticipantCount,
          knownReservedInviteCount: 0,
          viewerSide: participantSide as ParticipantSide | null,
        })
      : null;

  // START-001 (#827) — whether the person-first StartArgumentSheet is the active
  // Arguments-tab surface. It requires home_v2 AND the start-open flag, and the
  // same not-over-a-subscreen guards the ArgumentHome / gallery blocks use. When
  // true it takes precedence: the ArgumentHome + gallery blocks below add
  // `&& !startSheetActive` so exactly one surface renders. Flag OFF =>
  // homeV2Enabled is false => startSheetActive is ALWAYS false => those guards
  // and the gallery `showCreate` all evaluate byte-identically to today, and the
  // legacy StartArgumentPage remains the create surface (no behavior change).
  const startSheetActive =
    homeV2Enabled &&
    startArgumentOpen &&
    activeTab === 'arguments' &&
    !hasDebate &&
    !notificationsOpen &&
    !aboutOpen &&
    !demoCorridorOpen;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="auto" />

      {/* NAV-HEADER-INLINE-001 — the masthead carries the primary nav. The
          large logo lockup (logo + anchored tagline) and the stylized
          primary nav (Start An Argument · Browse Arguments · My Arguments ·
          Profile, plus About top-right + copyright lower-right) share ONE
          AppHeader container — the nav is INSIDE the masthead, not a strip
          beneath it. Each item drives the in-memory shell state via
          handlePrimaryNav (no router). The Admin / Debug tabs stay in the
          role-gated secondary tab row below and are NEVER part of this
          public primary nav. */}
      <AppHeader
        // UX-ROOM-CHROME-002 — the signed-in shell masthead now renders in the
        // spatially-BALANCED variant: a larger, proportional gold lockup
        // (band-aware: phone 48 / tablet 88 / wide 112, still width-capped) so
        // the top-left brand zone reads as one composed region with the inline
        // nav as a composed companion — not a tiny floating block. It stays far
        // shorter than the prominent 296 px shell, so the active board / first
        // substantive content still dominates the screen. (Supersedes the
        // UX-ROOM-CHROME-001 slim-variant wiring here.) The bare/transient
        // <AppHeader> (unconfigured / invite / callback states) stays
        // prominent; AuthScreen / the Sign In hero are untouched.
        balanced
        onHomePress={onHomePress}
        rightSlot={headerRightSlot}
        navSlot={
          <AppPrimaryNav
            activeSection={activePrimarySection}
            onNavigate={handlePrimaryNav}
          />
        }
      />

      {/* Top tab bar. UX-001.2 — hidden when a room is active so the Timeline
          becomes the first substantive in-room object beneath the AppHeader
          plus one compact room/context strip. Restored on room exit. The
          About screen is a top-level public surface; the tab bar stays
          visible there. */}
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
        {/* DEMO-001 — Recruitable Debate Demo Corridor. Reached from the
            gallery-toolbar "See how it works" trigger. Renders above all
            Arguments-tab surfaces (mirrors `aboutOpen`); "Jump into a real
            room →" / Close returns to the live gallery (state-only, no
            router). Deterministic, no-provider, no-spend. */}
        {demoCorridorOpen && (
          <DemoCorridorScreen onExit={() => setDemoCorridorOpen(false)} />
        )}
        {/* NAV-START-ARGUMENT-001 Slice B — public About screen. Reached from
            the upper-right About item in the global header. Renders above all
            Arguments-tab surfaces; "Back" returns to the gallery (state-only,
            no router). Public — no admin / debug / classifier content. */}
        {!demoCorridorOpen && aboutOpen && (
          <AboutScreen onBack={() => handlePrimaryNav('browse_arguments')} />
        )}
        {/* QOL-040 — notification list screen. Renders as a routed
            sub-screen on top of the Arguments tab when the user
            taps the "Notifications" trigger in the gallery
            toolbar. Closing the list returns to the gallery. */}
        {!aboutOpen && !demoCorridorOpen && activeTab === 'arguments' && notificationsOpen && (
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
        {/* START-001 (#827) — person-first StartArgumentSheet. Mounts behind
            home_v2 in place of the legacy StartArgumentPage (which the gallery
            still shows when the flag is OFF). Takes precedence over the
            ArgumentHome + gallery blocks (they add `&& !startSheetActive`), so
            exactly one Arguments-tab surface renders. The create path is the
            SAME `create` the gallery uses; onCreated mirrors
            `onCreatedWithSurface` so the author lands in the chosen view. */}
        {startSheetActive && (
          <StartArgumentSheet
            onCreate={create}
            recents={recentOpponents.recents}
            recentsLoading={recentOpponents.loading}
            // START-002 (#839) — the caller's circles as picker rows (name +
            // structural size). Selecting one creates a private circle-scoped
            // room. [] when signed out / no circles (the slot collapses).
            circles={myCircles.circles.map((c) => ({
              id: c.id,
              label: c.name,
              memberCount: c.memberCount,
            }))}
            onCancel={() => setStartArgumentOpen(false)}
            onCreated={(debate, surface) => {
              setEntryHint(null);
              setStartArgumentOpen(false);
              setViewMode(surface === 'card' ? 'stack' : 'timeline');
              selectDebate(debate, 'moderator');
            }}
            // START-003 (#875) — the public two-tap ceremony fills the Advanced
            // slot. The toggle is controlled by the sheet-held visibility and
            // emits 'public' only on its confirm transition.
            renderPublicToggle={(toggleProps) => <PublicArgumentToggle {...toggleProps} />}
          />
        )}
        {/* HOME-001 (#874) — Arguments tab: ArgumentHome ("Your table") landing.
            Mounts ONLY when the home_v2 flag is on AND the lane is 'home'. The
            belt-and-braces homeV2Enabled guard means a stale 'home' lane value
            can never mount this with the flag off. Mutually exclusive with the
            gallery-with-toolbar block below (guarded by galleryLane !== 'home'),
            so the two never co-render. START-001 — `&& !startSheetActive` hides
            Home while the start sheet is open (flag-off: always true, no-op). */}
        {!aboutOpen && !demoCorridorOpen && activeTab === 'arguments' && !hasDebate && !notificationsOpen && !startSheetActive && galleryLane === 'home' && homeV2Enabled && (
          <ArgumentHome
            debates={debates}
            argumentsByDebateId={galleryArgs.argumentsByDebateId}
            currentUserId={state.snapshot.userId || null}
            isAdminViewer={currentProfile?.role === 'admin'}
            notifications={notifications.notifications}
            unreadCount={notifications.unreadCount}
            notificationsLoading={notifications.loading}
            loading={debatesLoading || galleryArgs.loading}
            error={debatesError || galleryArgs.error}
            onRefresh={() => { refresh(); galleryArgs.refresh(); }}
            // J2 resume — reuse the exact gallery onSelect hand-off so the
            // entryHint threads into the room shell via the shipped
            // activeMessageId / entryHintForArgumentId path.
            onOpen={(debate, side, hint) => {
              setEntryHint(hint || null);
              selectDebate(debate, side ?? 'observer');
            }}
            onStart={() => setStartArgumentOpen(true)}
            onOpenFloor={() => setGalleryLane('all')}
            onOpenDemoCorridor={() => setDemoCorridorOpen(true)}
            onOpenNotificationDeepLink={handleOpenNotificationDeepLink}
            // HOME-003 (#840) — circle filter lens data. Same one read the start
            // sheet uses, mapped to the identity-free CircleLens shape.
            circles={myCircles.circles.map(toCircleLens)}
            circlesLoading={myCircles.loading}
          />
        )}
        {/* Arguments tab: Conversation Gallery (no room selected).
            START-001 — `&& !startSheetActive` hides the gallery (and its legacy
            StartArgumentPage create surface) while the person-first sheet is
            open. Flag OFF: startSheetActive is always false, so this is a no-op
            and the gallery renders byte-identically to today. */}
        {!aboutOpen && !demoCorridorOpen && activeTab === 'arguments' && !hasDebate && !notificationsOpen && !startSheetActive && galleryLane !== 'home' && (
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
              {/* DEMO-001 — "See how it works" opens the Recruitable Debate
                  Demo Corridor (a deterministic, no-provider walkthrough).
                  Non-modal, observer-first posture (Stage 6.4): a plain
                  toolbar Pressable, not a "choose side" modal. */}
              <Pressable
                style={styles.notificationsTrigger}
                onPress={() => setDemoCorridorOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={CORRIDOR_COPY.entryAccessibilityLabel}
                accessibilityHint="A short guided walkthrough of one disagreement, using the real room."
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID="open-demo-corridor-trigger"
              >
                <Text style={styles.notificationsTriggerText}>{CORRIDOR_COPY.entryLabel}</Text>
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
                setStartArgumentOpen(false);
                setViewMode(surface === 'card' ? 'stack' : 'timeline');
                selectDebate(debate, 'moderator');
              }}
              // NAV-START-ARGUMENT-001 Slice B — the gallery's active lane and
              // Start Argument page visibility are CONTROLLED by the shell so
              // the global header's "Browse Arguments" / "My Arguments" /
              // "Start An Argument" items drive the same surfaces. The gallery
              // still reports its own chip / "+ New room" taps back so its
              // internal affordances keep working.
              // 'home' is peeled off by the branch guard above, so the cast is
              // safe: this block only renders when galleryLane !== 'home'.
              activeLane={galleryLane as ConversationGallerySection | 'all'}
              onActiveLaneChange={setGalleryLane}
              // START-001 (#827) — under home_v2 ALL start entries open the new
              // StartArgumentSheet (the startSheetActive branch above), so the
              // gallery must NOT also show the legacy StartArgumentPage. Gating
              // showCreate on `!homeV2Enabled` keeps the old page as the create
              // surface ONLY when the flag is OFF, where it is byte-identical to
              // `showCreate={startArgumentOpen}` (the previous behavior).
              showCreate={startArgumentOpen && !homeV2Enabled}
              onShowCreateChange={setStartArgumentOpen}
            />
          </View>
        )}

        {/* Arguments tab: room view.
            COMPOSER-002 — the room stays mounted while composing; the
            composer renders as an in-room dock overlay (below). Keeping
            ArgumentTreeScreen mounted preserves viewMode, the active node,
            the entry-hint micro-moment, and scroll position for free.
            QOL-040 — the room is hidden while the notification list
            sub-screen is open. NAV-START-ARGUMENT-001 Slice B — and while
            the public About screen is open. */}
        {!aboutOpen && !demoCorridorOpen && activeTab === 'arguments' && hasDebate && currentDebate && !notificationsOpen && (
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
              // ROOM-001 (#876) — ambient state rail wiring. All additive and
              // read-only: the flag gates the mount, roomContract carries the
              // already-derived turn label + seat state, roomVisibility is the
              // persisted room visibility, and onOpenRoomDetails reveals the
              // existing invite / room-details panel (an in-app state jump, no
              // route). Flag OFF => the rail subtree is never mounted.
              roomExchangeV2Enabled={roomExchangeV2Enabled}
              roomContract={roomContract.viewModel ?? undefined}
              roomVisibility={currentDebate.visibility}
              onOpenRoomDetails={() => setInviteOpen((v) => !v)}
              // PROOF-002 (#889) — read-path flip gate. Flag OFF => the room
              // fetches no proof_items rows and reads JSONB byte-identically.
              proofDrawerEnabled={proofDrawerEnabled}
              // MARK-002 (#894) — marker text-half gate + the picked-scope
              // callback. Flag OFF => useMarkers fetches nothing, no marker
              // surface mounts, no picker opens (byte-identical).
              timestampRebuttalsEnabled={timestampRebuttalsEnabled}
              onMarkerScopePicked={timestampRebuttalsEnabled ? handleMarkerScopePicked : undefined}
              // PR-001 — thread the user's visual-density preference into
              // the timeline map (drives VG-004's resolveNodeGapPx) and
              // the reduce-motion override (OS value composed with the
              // user's choice) into the timeline board.
              density={densityToTimelineMode(preferences.preferences.density)}
              reduceMotionOverride={preferences.effectiveReduceMotion}
              onJoinSide={async (side) => {
                if (!currentDebate) return;
                // ARG-ROOM-005 — classify the claim result. A full room (active
                // seats taken, or a reserved invite holding the last seat)
                // degrades GRACEFULLY to observe: stay in read mode, refresh the
                // seat strip so it reads "Room full — observe", and announce it
                // politely — never a dead-end, never a generic error.
                const result = await join(currentDebate.id, side);
                const effect = resolveJoinSideEffect(result);
                if (effect.kind === 'select_side') {
                  selectDebate(currentDebate, effect.side);
                } else if (effect.kind === 'full_room_observe') {
                  seatCount.refresh();
                  AccessibilityInfo.announceForAccessibility(SEAT_CLAIM_COPY.fullRoomObserve);
                }
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
              // ROOM-003 (#829) — with room_exchange_v2 ON the one-bar entry
              // composer is the primary compose surface, so suppress the
              // collapsed strip (ArgumentRoom renders no strip when this prop
              // is undefined). OFF keeps today collapsed-strip behavior.
              onComposerExpand={roomExchangeV2Enabled ? undefined : handleComposerExpand}
              // UX-001.4 — Go popout's "Leave argument" entry calls the
              // existing handleLeaveRoom path (not a new room-exit path).
              onLeaveRoom={handleLeaveRoom}
              // ARG-ROOM-005 — public seat availability drives the read-only
              // seat strip + the rail's full-room state (disabled Join chips +
              // observe nudge). Null for private rooms.
              seatAvailability={seatAvailability}
              // QUOTE-FORGE-001 — open a referenced prior settled argument
              // room. Reuses the existing deep-link mechanism.
              onOpenPriorRoom={handleOpenPriorRoom}
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

            {/* ROOM-003 (#829) — the one-bar entry composer. Mounted only
                with room_exchange_v2 ON (co-activates with the ROOM-001 state
                rail); it is the fast-path compose surface. Its Source + More
                affordances open the SAME shipped dock above via
                handleComposerExpand, so structure stays reachable and the
                pre-send review survives on the More path. The dock stays the
                primary composer with the flag OFF (this subtree unmounted). */}
            {roomExchangeV2Enabled ? (
              <ArgumentEntryComposer
                debate={currentDebate}
                selectedParentId={replyTarget?.id ?? null}
                parentArgument={replyTarget?.argument ?? null}
                activeMessageId={timelineActiveMessageId}
                participantSide={participantSide as ParticipantSide | null}
                reduceMotionOverride={preferences.effectiveReduceMotion}
                onOpenMore={handleComposerExpand}
                // PROOF-002 (#889) — with proof_drawer ON the Source slot opens
                // the drawer; OFF => undefined => the slot routes to More
                // (byte-identical). The composer never reads the flag registry.
                onOpenProof={proofDrawerEnabled ? openProofForDraft : undefined}
                // MARK-002 (#894) — the entry variant mints the scoped marker on
                // success; the dock above keeps handleSubmitSuccess unchanged.
                onSubmitSuccess={handleEntrySubmitSuccess}
                onClearParent={handleClearParent}
                // MARK-002 (#894) — the composer_scope chip + its clear. Null when
                // the flag is off or no phrase is scoped => byte-identical bar.
                scopedMarker={timestampRebuttalsEnabled ? pendingMarkerScope : null}
                onClearScopedMarker={timestampRebuttalsEnabled ? handleClearScopedMarker : undefined}
              />
            ) : null}

            {/* PROOF-002 (#889) — the source drawer, mounted as a sibling of the
                one-bar composer. Behind proof_drawer AND a live scope; OFF or
                no scope => never mounted (flag-off byte-identical). The write
                goes through the JWT-scoped attach-proof wrapper (no service
                role in the client). */}
            {proofDrawerEnabled && proofDrawerScope !== null ? (
              <ProofDrawer
                scope={proofDrawerScope}
                windowWidth={proofDrawerWidth}
                windowHeight={proofDrawerHeight}
                reduceMotion={preferences.effectiveReduceMotion}
                currentUserId={state.snapshot.userId}
                onAttach={async (input) => {
                  const result = await attachProof(input);
                  if (result.ok) refreshTreeRef.current?.();
                  return result;
                }}
                onDetach={detachProof}
                onClose={() => setProofDrawerScope(null)}
              />
            ) : null}
          </View>
        )}

        {!aboutOpen && activeTab === 'account' && (
          <AccountScreen onSignOut={handleSignOut} signOutLoading={signOutLoading} />
        )}

        {!aboutOpen && activeTab === 'admin' && currentProfile?.role === 'admin' && (
          <AdminScreen onOpenArgumentTimeline={handleOpenArgumentFromAdmin} />
        )}

        {!aboutOpen && activeTab === 'debug' && __DEV__ && <SessionDebugPanel />}
      </View>

      {/* ARG-ROOM-006 (item c) — deep-link "unavailable" notice. Cause-neutral;
          identical for a private room the viewer cannot see and a nonexistent
          id (no enumeration). Shown only when a deep link resolves away. */}
      <RoomUnavailableNotice
        visible={roomUnavailableOpen}
        onDismiss={() => setRoomUnavailableOpen(false)}
        reduceMotion={preferences.effectiveReduceMotion}
      />
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
