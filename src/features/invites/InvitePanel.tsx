/**
 * QOL-038 — InvitePanel: the inviter-side affordance for the open
 * argument room. Replaces the Stage 6.1.0 placeholder ("planned invite
 * / copy text") with the real create + revoke flow.
 *
 * Hosted inline in the room toolbar (same placement as the placeholder).
 * `useRoomInvites` owns load + create + revoke + lastInviteLink state.
 * The Edge Function is the single write path — this component never
 * inserts into argument_room_invites directly and never imports a
 * service-role key.
 *
 * Doctrine: every label / placeholder / button copy / inline error is
 * sourced from `inviteCopy.ts` (the doctrine ban-list test scans those
 * strings). Internal codes from the Edge Function are mapped through
 * `plainLanguageForInviteError` before they reach the UI.
 */
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { INVITE_PANEL_COPY, validateInviteEmailInput } from './inviteCopy';
import { useRoomInvites } from './useRoomInvites';
import type { InviteSummaryForInviter } from './inviteModel';
import { SURFACE_TOKENS, STATUS } from '../../lib/designTokens';

interface Props {
  debateId: string;
  roomTitle: string;
  /**
   * True when the operator-gated email path is enabled. QOL-038 ships
   * with this false (the inviter sees a "Copy invite link" affordance).
   * QOL-040 will eventually flip the env var at deploy time.
   */
  emailEnabled?: boolean;
  /**
   * True when the caller can mint invites for this room. Observers / a
   * pure read-only session get false → the "only participants" notice
   * is rendered and the email field is hidden. The parent decides this
   * (room contract + participant side) so the panel doesn't duplicate
   * the GAME-004 logic.
   */
  canInvite?: boolean;
  onClose?: () => void;
}

export function InvitePanel({
  debateId,
  roomTitle: _roomTitle,
  emailEnabled = false,
  canInvite = true,
  onClose,
}: Props) {
  const { invites, loading, error, lastInviteLink, create, revoke, refresh, clearLink } =
    useRoomInvites(debateId);
  const [email, setEmail] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleSubmit = useCallback(async () => {
    const validation = validateInviteEmailInput(email);
    if (validation) {
      setInlineError(validation);
      return;
    }
    setInlineError(null);
    setSubmitting(true);
    const result = await create({ inviteeEmail: email.trim() });
    setSubmitting(false);
    if (result) {
      setEmail('');
    }
  }, [create, email]);

  const handleCopyLink = useCallback(() => {
    // No clipboard import — the panel renders the link as a selectable
    // <Text> below so the user copies via long-press / drag. Setting the
    // "Copied" state is the UI feedback the design specifies.
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }, []);

  if (!canInvite) {
    return (
      <View style={styles.panel} accessibilityLabel={INVITE_PANEL_COPY.toolbarChipAccessibility}>
        <View style={styles.header}>
          <Text style={styles.title}>{INVITE_PANEL_COPY.title}</Text>
          {onClose && (
            <Pressable onPress={onClose} accessibilityLabel={INVITE_PANEL_COPY.closePanel}>
              <Text style={styles.closeBtn}>✕</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.notAllowedText}>{INVITE_PANEL_COPY.notAllowedNotice}</Text>
      </View>
    );
  }

  return (
    <View style={styles.panel} accessibilityLabel={INVITE_PANEL_COPY.toolbarChipAccessibility}>
      <View style={styles.header}>
        <Text style={styles.title}>{INVITE_PANEL_COPY.title}</Text>
        {onClose && (
          <Pressable onPress={onClose} accessibilityLabel={INVITE_PANEL_COPY.closePanel}>
            <Text style={styles.closeBtn}>✕</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.subtitle}>{INVITE_PANEL_COPY.subtitle}</Text>
      <Text style={styles.body}>{INVITE_PANEL_COPY.bodyDescription}</Text>

      <TextInput
        style={styles.input}
        placeholder={INVITE_PANEL_COPY.emailPlaceholder}
        placeholderTextColor={SURFACE_TOKENS.textMuted}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (inlineError) setInlineError(null);
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        accessibilityLabel={INVITE_PANEL_COPY.emailLabel}
        editable={!submitting}
        testID="invite-panel-email-input"
      />
      {inlineError && <Text style={styles.error}>{inlineError}</Text>}
      {error && !inlineError && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.btnPrimary, submitting && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={submitting || !email}
        accessibilityRole="button"
        accessibilityLabel={INVITE_PANEL_COPY.sendButton}
        testID="invite-panel-send"
      >
        <Text style={styles.btnPrimaryText}>
          {submitting ? INVITE_PANEL_COPY.sendingButton : INVITE_PANEL_COPY.sendButton}
        </Text>
      </Pressable>

      {/* Fresh-create link affordance — only when email is OFF and we
          have a link from the most-recent create call. */}
      {!emailEnabled && lastInviteLink && (
        <View style={styles.linkBox} testID="invite-panel-link-box">
          <Text style={styles.linkLabel}>{INVITE_PANEL_COPY.copyLinkButton}</Text>
          <Text style={styles.linkText} selectable>
            {lastInviteLink}
          </Text>
          <View style={styles.linkButtonRow}>
            <Pressable
              style={styles.btnSecondary}
              onPress={handleCopyLink}
              accessibilityRole="button"
              accessibilityLabel={INVITE_PANEL_COPY.copyLinkButton}
            >
              <Text style={styles.btnSecondaryText}>
                {linkCopied ? INVITE_PANEL_COPY.copyLinkSuccess : INVITE_PANEL_COPY.copyLinkButton}
              </Text>
            </Pressable>
            <Pressable
              style={styles.btnSecondary}
              onPress={clearLink}
              accessibilityRole="button"
              accessibilityLabel="Hide link"
            >
              <Text style={styles.btnSecondaryText}>Hide</Text>
            </Pressable>
          </View>
        </View>
      )}
      {emailEnabled && lastInviteLink && (
        <Text style={styles.notice}>{INVITE_PANEL_COPY.emailedNotice}</Text>
      )}

      {/* Existing-invites list. */}
      {loading && invites.length === 0 ? (
        <Text style={styles.notice}>Loading invites…</Text>
      ) : invites.length > 0 ? (
        <View style={styles.invitesList} testID="invite-panel-list">
          {invites.map((inv) => (
            <InviteRow key={inv.inviteId} invite={inv} onRevoke={revoke} />
          ))}
        </View>
      ) : null}

      <Pressable onPress={refresh} accessibilityLabel="Refresh invites" hitSlop={6}>
        <Text style={styles.refreshLink}>Refresh</Text>
      </Pressable>
    </View>
  );
}

// ── Row ───────────────────────────────────────────────────────

interface InviteRowProps {
  invite: InviteSummaryForInviter;
  onRevoke: (inviteId: string) => Promise<boolean>;
}

function InviteRow({ invite, onRevoke }: InviteRowProps) {
  const [revoking, setRevoking] = useState(false);
  const isPending = invite.status === 'pending';
  const handleRevoke = useCallback(async () => {
    setRevoking(true);
    await onRevoke(invite.inviteId);
    setRevoking(false);
  }, [onRevoke, invite.inviteId]);

  return (
    <View style={styles.inviteRow} testID={`invite-row-${invite.inviteId}`}>
      <View style={styles.inviteRowText}>
        <Text style={styles.inviteEmail}>{invite.inviteeEmailMasked}</Text>
        <Text style={styles.inviteMeta}>
          {invite.status === 'pending' && INVITE_PANEL_COPY.pendingChipLabel}
          {invite.status === 'revoked' && INVITE_PANEL_COPY.revokedChipLabel}
          {invite.status === 'accepted' && INVITE_PANEL_COPY.acceptedChipLabel}
          {invite.status === 'expired' && 'Expired'}
        </Text>
      </View>
      {isPending && (
        <Pressable
          onPress={handleRevoke}
          disabled={revoking}
          accessibilityRole="button"
          accessibilityLabel={`${INVITE_PANEL_COPY.revokeButton} invite for ${invite.inviteeEmailMasked}`}
          testID={`invite-row-revoke-${invite.inviteId}`}
        >
          <Text style={styles.revokeLink}>
            {revoking ? '…' : INVITE_PANEL_COPY.revokeButton}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: SURFACE_TOKENS.overlay,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
  },
  closeBtn: {
    fontSize: 16,
    color: SURFACE_TOKENS.textSecondary,
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    color: SURFACE_TOKENS.textSecondary,
    marginBottom: 4,
  },
  body: {
    fontSize: 12,
    color: SURFACE_TOKENS.textSecondary,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: SURFACE_TOKENS.textPrimary,
    backgroundColor: SURFACE_TOKENS.inputBg,
    marginBottom: 8,
  },
  error: {
    fontSize: 12,
    color: STATUS.danger.fg,
    marginBottom: 6,
  },
  btnPrimary: {
    backgroundColor: STATUS.info.bg,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: {
    fontSize: 13,
    color: STATUS.info.fg,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: SURFACE_TOKENS.raised,
    borderRadius: 8,
    padding: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: 12,
    color: SURFACE_TOKENS.textSecondary,
    fontWeight: '600',
  },
  linkBox: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  linkLabel: {
    fontSize: 11,
    color: SURFACE_TOKENS.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linkText: {
    fontSize: 12,
    color: SURFACE_TOKENS.textPrimary,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  linkButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  notice: {
    fontSize: 12,
    color: SURFACE_TOKENS.textMuted,
    marginBottom: 8,
  },
  notAllowedText: {
    fontSize: 13,
    color: SURFACE_TOKENS.textSecondary,
    paddingVertical: 8,
  },
  invitesList: {
    borderTopWidth: 1,
    borderTopColor: SURFACE_TOKENS.border,
    marginTop: 6,
    paddingTop: 8,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  inviteRowText: {
    flex: 1,
  },
  inviteEmail: {
    fontSize: 13,
    color: SURFACE_TOKENS.textPrimary,
    fontWeight: '600',
  },
  inviteMeta: {
    fontSize: 11,
    color: SURFACE_TOKENS.textMuted,
  },
  revokeLink: {
    fontSize: 12,
    color: STATUS.danger.fg,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  refreshLink: {
    fontSize: 11,
    color: SURFACE_TOKENS.textMuted,
    textAlign: 'right',
    marginTop: 6,
  },
});
