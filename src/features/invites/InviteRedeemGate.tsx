/**
 * QOL-038 — InviteRedeemGate: the screen shown while a deep-linked
 * invite is being resolved. Sits between the deep-link parse (in
 * App.tsx) and the room open call.
 *
 * The gate orchestrates two Edge Function calls (lookup_by_token +
 * accept) but never mutates state on its own. The parent decides:
 *
 *  - what to do on a signed-out match (mount AuthScreen with the
 *    invited email pre-filled);
 *  - what to do on a signed-in match (mount and let the gate fire
 *    accept and call back with the debateId);
 *  - how to "go home" (clear the intent + drop to gallery).
 *
 * State machine:
 *
 *   resolving → lookup_by_token returns
 *     → 'pending'         + signed-out → SignedOutPrompt (Continue → AuthScreen)
 *                         + signed-in (email match)   → JoiningPanel (auto-fires accept)
 *                         + signed-in (email mismatch) → MismatchPanel
 *     → 'expired'                                     → ExpiredPanel
 *     → 'revoked'                                     → RevokedPanel
 *     → 'accepted'                                    → AlreadyUsedPanel
 *     → 'room_archived' (QOL-038 §17)                 → ArchivedPanel
 *     → 'room_closed'                                 → ClosedPanel
 *     → 404                                           → NotFoundPanel
 *     → network error                                 → NetworkPanel (Retry)
 *
 *  - "Go to my arguments" is the universal escape hatch — always present
 *    in every non-pending state, always clears the intent.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { LoadingNotice } from '../../components/LoadingNotice';
import {
  acceptRoomInvite,
  lookupInviteByToken,
  type LookupInviteByTokenResponse,
  type LookupInviteStatus,
} from './inviteApi';
import { INVITE_REDEEM_COPY, plainLanguageForInviteError } from './inviteCopy';
import { SURFACE_TOKENS, STATUS, CONTROL } from '../../lib/designTokens';

export interface InviteRedeemGateProps {
  token: string;
  /** True when a session is in place (used to pick prompt vs join). */
  signedIn: boolean;
  /** The signed-in user's email (lower-cased). null when signed out. */
  viewerEmail: string | null;
  /**
   * Called when the gate decides the invite cannot be auto-completed
   * and the parent should mount the AuthScreen with the invited email
   * pre-filled.
   */
  onPromptSignIn: (input: { invitedEmail: string | null; preferSignUp: boolean }) => void;
  /** Called when accept succeeds — parent calls selectDebate(debateId). */
  onAccepted: (input: { debateId: string }) => void;
  /** Called when the user picks "Go to my arguments" — parent clears intent + opens gallery. */
  onExit: () => void;
  /** Called when the user picks "Sign in as someone else" — parent triggers signOut, keeps intent. */
  onSignOutAndRetry?: () => void;
}

interface GateState {
  phase:
    | 'resolving'
    | 'lookup_ok'
    | 'lookup_error'
    | 'joining'
    | 'join_error'
    | 'joined';
  lookup: LookupInviteByTokenResponse | null;
  errorCode: string | null;
  acceptedDebateId: string | null;
}

const INITIAL: GateState = {
  phase: 'resolving',
  lookup: null,
  errorCode: null,
  acceptedDebateId: null,
};

export function InviteRedeemGate(props: InviteRedeemGateProps) {
  const { token, signedIn, viewerEmail, onAccepted, onExit } = props;
  const [state, setState] = useState<GateState>(INITIAL);

  // 1) Resolve the token.
  const runLookup = useCallback(async () => {
    setState((s) => ({ ...s, phase: 'resolving', errorCode: null }));
    const result = await lookupInviteByToken({ token });
    if (!result.ok) {
      const code = result.error.error || 'invite_lookup_failed';
      setState({ phase: 'lookup_error', lookup: null, errorCode: code, acceptedDebateId: null });
      return;
    }
    setState({ phase: 'lookup_ok', lookup: result.data, errorCode: null, acceptedDebateId: null });
  }, [token]);

  useEffect(() => {
    void runLookup();
  }, [runLookup]);

  // 2) Auto-fire accept when conditions are right.
  const runAccept = useCallback(async () => {
    setState((s) => ({ ...s, phase: 'joining', errorCode: null }));
    const result = await acceptRoomInvite({ token });
    if (!result.ok) {
      setState((s) => ({ ...s, phase: 'join_error', errorCode: result.error.error || 'invite_action_failed' }));
      return;
    }
    setState((s) => ({ ...s, phase: 'joined', acceptedDebateId: result.data.debateId, errorCode: null }));
    onAccepted({ debateId: result.data.debateId });
  }, [onAccepted, token]);

  // Auto-fire accept on (signed-in + live pending + email match).
  useEffect(() => {
    if (state.phase !== 'lookup_ok') return;
    if (!state.lookup || state.lookup.status !== 'pending') return;
    if (!signedIn || !viewerEmail) return;
    // The email-match check is server-side (the security spine in
    // §5.5 step 4). The client can't see the invitee email from
    // lookup, so we optimistically attempt accept and the function
    // returns invite_email_mismatch on a mismatch.
    void runAccept();
  }, [state.phase, state.lookup, signedIn, viewerEmail, runAccept]);

  // ── Render branches ────────────────────────────────────────

  if (state.phase === 'resolving') {
    return (
      <Screen title="">
        <LoadingNotice message={INVITE_REDEEM_COPY.resolvingTitle} />
      </Screen>
    );
  }

  if (state.phase === 'lookup_error') {
    return (
      <NetworkPanel
        errorCode={state.errorCode}
        onRetry={runLookup}
        onExit={onExit}
      />
    );
  }

  if (state.phase === 'joining') {
    return (
      <Screen title="">
        <LoadingNotice message={INVITE_REDEEM_COPY.joiningTitle} />
      </Screen>
    );
  }

  if (state.phase === 'joined' && state.acceptedDebateId) {
    // Brief acknowledgement; the parent will swap the screen out.
    return (
      <Screen title="">
        <LoadingNotice message={INVITE_REDEEM_COPY.joiningTitle} />
      </Screen>
    );
  }

  if (state.phase === 'join_error') {
    return (
      <AcceptErrorBranch
        errorCode={state.errorCode}
        lookup={state.lookup}
        viewerEmail={viewerEmail}
        signedIn={signedIn}
        onPromptSignIn={() =>
          props.onPromptSignIn({ invitedEmail: null, preferSignUp: false })
        }
        onSignOutAndRetry={props.onSignOutAndRetry}
        onRetry={runAccept}
        onExit={onExit}
      />
    );
  }

  // lookup_ok branches
  const lookup = state.lookup;
  if (!lookup) {
    return <NotFoundPanel onExit={onExit} />;
  }
  return (
    <LookupOkBranch
      lookup={lookup}
      signedIn={signedIn}
      onPromptSignIn={() =>
        props.onPromptSignIn({ invitedEmail: null, preferSignUp: !signedIn })
      }
      onExit={onExit}
    />
  );
}

// ── Branch components ─────────────────────────────────────────

interface LookupOkBranchProps {
  lookup: LookupInviteByTokenResponse;
  signedIn: boolean;
  onPromptSignIn: () => void;
  onExit: () => void;
}

function LookupOkBranch({ lookup, signedIn, onPromptSignIn, onExit }: LookupOkBranchProps) {
  switch (lookup.status as LookupInviteStatus) {
    case 'pending':
      // Signed-in pending is handled by the auto-accept effect above;
      // the only render path here is signed-out → SignedOutPrompt.
      if (!signedIn) {
        return (
          <SignedOutPrompt
            roomTitle={lookup.room?.title || '(this argument)'}
            inviter={lookup.room?.invitedByDisplayName || 'A CDiscourse user'}
            onContinue={onPromptSignIn}
            onExit={onExit}
          />
        );
      }
      // Defensive — should be brief; the auto-accept fires immediately.
      return (
        <Screen title="">
          <LoadingNotice message={INVITE_REDEEM_COPY.joiningTitle} />
        </Screen>
      );
    case 'expired':
      return (
        <ExpiredPanel
          inviter={lookup.room?.invitedByDisplayName || 'the inviter'}
          onExit={onExit}
        />
      );
    case 'revoked':
      return <RevokedPanel onExit={onExit} />;
    case 'accepted':
      return <AlreadyUsedPanel onExit={onExit} />;
    case 'room_archived':
      // QOL-038 §17 — the soft-delete-via-status path.
      return (
        <ArchivedPanel
          inviter={lookup.room?.invitedByDisplayName || 'the inviter'}
          onExit={onExit}
        />
      );
    case 'room_closed':
      return <ClosedPanel onExit={onExit} />;
    default:
      return <NotFoundPanel onExit={onExit} />;
  }
}

interface AcceptErrorBranchProps {
  errorCode: string | null;
  lookup: LookupInviteByTokenResponse | null;
  viewerEmail: string | null;
  signedIn: boolean;
  onPromptSignIn: () => void;
  onSignOutAndRetry?: () => void;
  onRetry: () => void;
  onExit: () => void;
}

function AcceptErrorBranch(props: AcceptErrorBranchProps) {
  const { errorCode, lookup, viewerEmail, signedIn, onSignOutAndRetry, onExit } = props;
  // Map the specific Edge Function error code to the right panel.
  if (errorCode === 'invite_email_mismatch') {
    return (
      <MismatchPanel
        inviter={lookup?.room?.invitedByDisplayName || 'the inviter'}
        viewerEmail={viewerEmail || 'your address'}
        onSignOutAndRetry={onSignOutAndRetry}
        onExit={onExit}
      />
    );
  }
  if (errorCode === 'invite_expired') {
    return (
      <ExpiredPanel
        inviter={lookup?.room?.invitedByDisplayName || 'the inviter'}
        onExit={onExit}
      />
    );
  }
  if (errorCode === 'invite_revoked') return <RevokedPanel onExit={onExit} />;
  if (errorCode === 'invite_already_accepted') return <AlreadyUsedPanel onExit={onExit} />;
  if (errorCode === 'room_archived') {
    return (
      <ArchivedPanel
        inviter={lookup?.room?.invitedByDisplayName || 'the inviter'}
        onExit={onExit}
      />
    );
  }
  if (errorCode === 'room_closed' || errorCode === 'room_locked') {
    return <ClosedPanel onExit={onExit} />;
  }
  if (errorCode === 'invite_not_found') return <NotFoundPanel onExit={onExit} />;
  if (errorCode === 'unauthorized') {
    // The session expired mid-accept. Send the user back to sign in.
    return (
      <SignedOutPrompt
        roomTitle={lookup?.room?.title || '(this argument)'}
        inviter={lookup?.room?.invitedByDisplayName || 'A CDiscourse user'}
        onContinue={props.onPromptSignIn}
        onExit={onExit}
      />
    );
  }
  // Default to a retryable network panel for everything else.
  return (
    <NetworkPanel
      errorCode={errorCode}
      onRetry={signedIn ? props.onRetry : props.onPromptSignIn}
      onExit={onExit}
    />
  );
}

// ── Panel primitives ──────────────────────────────────────────

interface BasePanelProps {
  onExit: () => void;
}

function SignedOutPrompt(props: { roomTitle: string; inviter: string; onContinue: () => void } & BasePanelProps) {
  return (
    <PanelLayout
      title={INVITE_REDEEM_COPY.signedOutInvite(props.roomTitle, props.inviter)}
      primaryLabel={INVITE_REDEEM_COPY.signedOutContinueButton}
      onPrimary={props.onContinue}
      onExit={props.onExit}
    />
  );
}

function ExpiredPanel(props: { inviter: string } & BasePanelProps) {
  return (
    <PanelLayout
      heading={INVITE_REDEEM_COPY.expiredTitle}
      title={INVITE_REDEEM_COPY.expiredBody(props.inviter)}
      onExit={props.onExit}
    />
  );
}

function RevokedPanel(props: BasePanelProps) {
  return (
    <PanelLayout
      heading={INVITE_REDEEM_COPY.revokedTitle}
      title={INVITE_REDEEM_COPY.revokedBody}
      onExit={props.onExit}
    />
  );
}

function AlreadyUsedPanel(props: BasePanelProps) {
  return (
    <PanelLayout
      heading={INVITE_REDEEM_COPY.alreadyUsedTitle}
      title={INVITE_REDEEM_COPY.alreadyUsedBody}
      onExit={props.onExit}
    />
  );
}

function ArchivedPanel(props: { inviter: string } & BasePanelProps) {
  // QOL-038 §17 — the soft-delete-via-status path.
  return (
    <PanelLayout
      heading={INVITE_REDEEM_COPY.roomArchivedTitle}
      title={INVITE_REDEEM_COPY.roomArchivedBody(props.inviter)}
      onExit={props.onExit}
      testID="invite-redeem-room-archived"
    />
  );
}

function ClosedPanel(props: BasePanelProps) {
  return (
    <PanelLayout
      heading={INVITE_REDEEM_COPY.roomClosedTitle}
      title={INVITE_REDEEM_COPY.roomClosedBody}
      onExit={props.onExit}
    />
  );
}

function NotFoundPanel(props: BasePanelProps) {
  return (
    <PanelLayout
      heading={INVITE_REDEEM_COPY.notFoundTitle}
      title={INVITE_REDEEM_COPY.notFoundBody}
      onExit={props.onExit}
    />
  );
}

function MismatchPanel(props: {
  inviter: string;
  viewerEmail: string;
  onSignOutAndRetry?: () => void;
} & BasePanelProps) {
  return (
    <PanelLayout
      heading={INVITE_REDEEM_COPY.emailMismatchTitle}
      title={INVITE_REDEEM_COPY.emailMismatchBody(props.inviter, props.viewerEmail)}
      primaryLabel={
        props.onSignOutAndRetry ? INVITE_REDEEM_COPY.emailMismatchSignInElse : undefined
      }
      onPrimary={props.onSignOutAndRetry}
      onExit={props.onExit}
    />
  );
}

function NetworkPanel(props: {
  errorCode: string | null;
  onRetry: () => void;
} & BasePanelProps) {
  const body =
    plainLanguageForInviteError(props.errorCode) || INVITE_REDEEM_COPY.networkErrorBody;
  return (
    <PanelLayout
      heading={INVITE_REDEEM_COPY.networkErrorTitle}
      title={body}
      primaryLabel={INVITE_REDEEM_COPY.retryButton}
      onPrimary={props.onRetry}
      onExit={props.onExit}
    />
  );
}

// ── Shared layout ─────────────────────────────────────────────

interface PanelLayoutProps {
  heading?: string;
  title: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  onExit: () => void;
  testID?: string;
}

function PanelLayout(props: PanelLayoutProps) {
  return (
    <Screen title="">
      <ScrollView contentContainerStyle={styles.layoutBody} testID={props.testID}>
        {props.heading && <Text style={styles.layoutHeading}>{props.heading}</Text>}
        <Text style={styles.layoutTitle}>{props.title}</Text>
        <View style={styles.layoutButtons}>
          {props.primaryLabel && props.onPrimary && (
            <Pressable
              style={styles.btnPrimary}
              onPress={props.onPrimary}
              accessibilityRole="button"
              accessibilityLabel={props.primaryLabel}
              testID="invite-redeem-primary-button"
            >
              <Text style={styles.btnPrimaryText}>{props.primaryLabel}</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.btnSecondary}
            onPress={props.onExit}
            accessibilityRole="button"
            accessibilityLabel={INVITE_REDEEM_COPY.goHomeButton}
            testID="invite-redeem-exit-button"
          >
            <Text style={styles.btnSecondaryText}>{INVITE_REDEEM_COPY.goHomeButton}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  layoutBody: {
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  layoutHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
    textAlign: 'center',
  },
  layoutTitle: {
    fontSize: 15,
    color: SURFACE_TOKENS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  layoutButtons: {
    width: '100%',
    gap: 10,
    marginTop: 12,
  },
  btnPrimary: {
    backgroundColor: CONTROL.primary.bg,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: CONTROL.primary.fg,
    fontWeight: '700',
    fontSize: 14,
  },
  btnSecondary: {
    backgroundColor: SURFACE_TOKENS.raised,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: SURFACE_TOKENS.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
});
// `STATUS` is imported for tokens consistency with the rest of the
// invites surface; it isn't used in styles right now but keeps the
// dependency chain stable if future doctrine work routes through it.
void STATUS;
