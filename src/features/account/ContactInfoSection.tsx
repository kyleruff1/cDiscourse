/**
 * PR-004 — ContactInfoSection.
 *
 * Presentational component mounted inside AccountScreen's existing
 * card. Three rows:
 *   1. Initials avatar header row (InitialsAvatar — identity glyph).
 *   2. Display name edit row (replaces AccountScreen's prior inline edit).
 *   3. Email row with "Change email" affordance + verification-pending state.
 *
 * Optimistic UI (Q6 preserved from PR-003):
 * - Display name save updates local state, then writes; revert + inline
 *   error on failure.
 * - Email change writes via supabase.auth.updateUser; shows
 *   "Verification pending — {newEmail}" badge on success. The OLD email
 *   remains in the value row until the user clicks the verification link
 *   AND the auth listener fires (Supabase handles the trust boundary).
 *
 * Doctrine:
 *   - No <TextInput> for any non-edit field (no raw input for user_id,
 *     role, or email-while-not-editing).
 *   - Every Pressable: accessibilityRole + accessibilityLabel +
 *     accessibilityState + 44px min target.
 *   - Inline error <Text>: accessibilityLiveRegion="polite".
 *   - Internal codes never surface — every error code is mapped via
 *     messageForContactError or normalizeProfileError.
 *   - No AI provider import. No service-role. No raw email logging.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { InitialsAvatar } from './InitialsAvatar';
import { fetchCurrentAuthUser } from './accountApi';
import {
  messageForContactError,
  requestEmailChange,
  validateEmail,
  type PendingEmailChange,
} from './contactApi';
import { CONTROL, STATUS, SURFACE_TOKENS } from '../../lib/designTokens';

const DISPLAY_NAME_MIN = 1;
const DISPLAY_NAME_MAX = 60;
const AVATAR_SIZE = 80;

interface Props {
  userId: string | null;
  displayName: string | null;
  saving: boolean;
  saveError: string | null;
  /** Returns true on successful write; false (with saveError set) on failure. */
  onSaveDisplayName: (name: string) => Promise<boolean>;
}

type NameEditState = 'idle' | 'editing';

interface EmailEditState {
  mode: 'idle' | 'editing' | 'pending' | 'submitting';
  draft: string;
  inlineError: string | null;
  pending: PendingEmailChange | null;
}

const INITIAL_EMAIL_STATE: EmailEditState = {
  mode: 'idle',
  draft: '',
  inlineError: null,
  pending: null,
};

export function ContactInfoSection({
  userId,
  displayName,
  saving,
  saveError,
  onSaveDisplayName,
}: Props) {
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [nameEdit, setNameEdit] = useState<NameEditState>('idle');
  const [nameDraft, setNameDraft] = useState('');
  const [nameInlineError, setNameInlineError] = useState<string | null>(null);
  const [emailEdit, setEmailEdit] = useState<EmailEditState>(INITIAL_EMAIL_STATE);

  // Resolve initial email + refresh whenever auth state changes (e.g.
  // user clicks verification link in their inbox and returns).
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const u = await fetchCurrentAuthUser();
      if (active && u) {
        setCurrentEmail(u.email);
        // If the auth-resolved email now matches the pending newEmail,
        // verification succeeded — clear the pending badge.
        setEmailEdit((prev) => {
          if (
            prev.pending &&
            u.email &&
            u.email.toLowerCase() === prev.pending.newEmail.toLowerCase()
          ) {
            return INITIAL_EMAIL_STATE;
          }
          return prev;
        });
      }
    };
    void refresh();
    return () => {
      active = false;
    };
  }, [userId]);

  // ── Display name handlers ───────────────────────────────────

  const handleNameEditStart = useCallback(() => {
    setNameDraft(displayName ?? '');
    setNameEdit('editing');
    setNameInlineError(null);
  }, [displayName]);

  const handleNameSave = useCallback(async () => {
    const trimmed = nameDraft.trim();
    if (trimmed.length < DISPLAY_NAME_MIN) {
      setNameInlineError('Enter a display name.');
      return;
    }
    if (trimmed.length > DISPLAY_NAME_MAX) {
      setNameInlineError(`Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`);
      return;
    }
    setNameInlineError(null);
    const ok = await onSaveDisplayName(trimmed);
    if (ok) {
      setNameEdit('idle');
    }
  }, [nameDraft, onSaveDisplayName]);

  const handleNameCancel = useCallback(() => {
    setNameEdit('idle');
    setNameInlineError(null);
  }, []);

  // ── Email handlers ──────────────────────────────────────────

  const handleEmailEditStart = useCallback(() => {
    setEmailEdit({
      mode: 'editing',
      draft: '',
      inlineError: null,
      pending: null,
    });
  }, []);

  const handleEmailChangeText = useCallback((next: string) => {
    setEmailEdit((prev) => ({ ...prev, draft: next, inlineError: null }));
  }, []);

  const handleEmailSubmit = useCallback(async () => {
    const draft = emailEdit.draft;
    const v = validateEmail(draft);
    if (!v.ok) {
      setEmailEdit((prev) => ({
        ...prev,
        inlineError: messageForContactError('invalid_email'),
      }));
      return;
    }
    setEmailEdit((prev) => ({ ...prev, mode: 'submitting', inlineError: null }));
    const result = await requestEmailChange(draft);
    if (result.ok) {
      setEmailEdit({
        mode: 'pending',
        draft: '',
        inlineError: null,
        pending: result.data,
      });
    } else {
      setEmailEdit((prev) => ({
        ...prev,
        mode: 'editing',
        inlineError: result.message,
      }));
    }
  }, [emailEdit.draft]);

  const handleEmailCancel = useCallback(() => {
    setEmailEdit(INITIAL_EMAIL_STATE);
  }, []);

  const handleEmailCancelPending = useCallback(() => {
    // Clears the LOCAL pending badge. The verification email has
    // already been sent by Supabase; if the user clicks the link later,
    // auth.users.email will rotate and onAuthStateChange will reflect
    // the new email on next navigation / refetch.
    setEmailEdit(INITIAL_EMAIL_STATE);
  }, []);

  // ── Computed ────────────────────────────────────────────────

  const nameSaveEnabled =
    nameDraft.trim().length >= DISPLAY_NAME_MIN &&
    nameDraft.trim() !== (displayName ?? '').trim() &&
    !saving;

  const emailSubmitEnabled =
    emailEdit.draft.trim().length > 0 &&
    validateEmail(emailEdit.draft).ok &&
    emailEdit.mode === 'editing';

  const isEmailSubmitting = emailEdit.mode === 'submitting';
  const isEmailPending = emailEdit.mode === 'pending' && emailEdit.pending !== null;

  // ── Render ──────────────────────────────────────────────────

  return (
    <View testID="contact-info-section" style={styles.container}>
      {/* Initials avatar header row */}
      <View style={styles.avatarRow}>
        <View testID="contact-initials-avatar">
          <InitialsAvatar
            displayName={displayName}
            seed={userId}
            size={AVATAR_SIZE}
          />
        </View>
        <View style={styles.avatarMeta}>
          <Text style={styles.avatarMetaTitle}>Your avatar</Text>
          <Text style={styles.avatarMetaHint}>
            Built from your display name and your account id. Update your name to change it.
          </Text>
        </View>
      </View>

      {/* Display name row */}
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Display name</Text>
        {nameEdit === 'editing' ? (
          <View style={styles.editBlock}>
            <TextInput
              testID="contact-display-name-input"
              value={nameDraft}
              onChangeText={setNameDraft}
              style={styles.input}
              autoFocus
              autoCapitalize="words"
              maxLength={DISPLAY_NAME_MAX}
              accessibilityLabel="Display name"
            />
            <View style={styles.editActions}>
              <Pressable
                testID="contact-display-name-save-button"
                onPress={handleNameSave}
                disabled={!nameSaveEnabled}
                style={[styles.primaryBtn, !nameSaveEnabled && styles.btnDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Save display name"
                accessibilityState={{ disabled: !nameSaveEnabled, busy: saving }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.primaryBtnText}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
              <Pressable
                testID="contact-display-name-cancel-button"
                onPress={handleNameCancel}
                disabled={saving}
                style={[styles.secondaryBtn, saving && styles.btnDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Cancel display name edit"
                accessibilityState={{ disabled: saving }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
            </View>
            {nameInlineError && (
              <Text
                testID="contact-display-name-error"
                style={styles.errorText}
                accessibilityLiveRegion="polite"
              >
                {nameInlineError}
              </Text>
            )}
            {saveError && !nameInlineError && (
              <Text
                testID="contact-display-name-save-error"
                style={styles.errorText}
                accessibilityLiveRegion="polite"
              >
                {saveError}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.valueRow}>
            <Text
              testID="contact-display-name-value"
              style={styles.fieldValue}
              numberOfLines={1}
            >
              {displayName ?? <Text style={styles.placeholder}>Not set</Text>}
            </Text>
            <Pressable
              testID="contact-display-name-edit-button"
              onPress={handleNameEditStart}
              style={styles.editBtn}
              accessibilityRole="button"
              accessibilityLabel="Edit display name"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Email row */}
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Email</Text>
        {emailEdit.mode === 'editing' || isEmailSubmitting ? (
          <View style={styles.editBlock}>
            <TextInput
              testID="contact-email-input"
              value={emailEdit.draft}
              onChangeText={handleEmailChangeText}
              style={styles.input}
              autoFocus
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              accessibilityLabel="New email address"
              editable={!isEmailSubmitting}
            />
            <View style={styles.editActions}>
              <Pressable
                testID="contact-email-submit-button"
                onPress={handleEmailSubmit}
                disabled={!emailSubmitEnabled || isEmailSubmitting}
                style={[
                  styles.primaryBtn,
                  (!emailSubmitEnabled || isEmailSubmitting) && styles.btnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Submit new email address"
                accessibilityState={{
                  disabled: !emailSubmitEnabled || isEmailSubmitting,
                  busy: isEmailSubmitting,
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isEmailSubmitting ? (
                  <ActivityIndicator color={CONTROL.primary.fg} />
                ) : (
                  <Text style={styles.primaryBtnText}>Send verification</Text>
                )}
              </Pressable>
              <Pressable
                testID="contact-email-cancel-button"
                onPress={handleEmailCancel}
                disabled={isEmailSubmitting}
                style={[styles.secondaryBtn, isEmailSubmitting && styles.btnDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Cancel email edit"
                accessibilityState={{ disabled: isEmailSubmitting }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
            </View>
            {emailEdit.inlineError && (
              <Text
                testID="contact-email-error"
                style={styles.errorText}
                accessibilityLiveRegion="polite"
              >
                {emailEdit.inlineError}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.editBlock}>
            <View style={styles.valueRow}>
              <Text
                testID="contact-email-value"
                style={styles.fieldValue}
                numberOfLines={1}
              >
                {currentEmail ?? <Text style={styles.placeholder}>Loading…</Text>}
              </Text>
              {!isEmailPending && (
                <Pressable
                  testID="contact-email-change-button"
                  onPress={handleEmailEditStart}
                  style={styles.editBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Change email"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.editBtnText}>Change email</Text>
                </Pressable>
              )}
            </View>
            {isEmailPending && emailEdit.pending && (
              <View style={styles.pendingBlock}>
                <Text
                  testID="contact-email-verify-pending"
                  style={styles.pendingText}
                  accessibilityLiveRegion="polite"
                >
                  Check your inbox to confirm the new email: {emailEdit.pending.newEmail}.
                </Text>
                <Pressable
                  testID="contact-email-cancel-pending-button"
                  onPress={handleEmailCancelPending}
                  style={styles.secondaryBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel pending email change"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.secondaryBtnText}>Cancel pending change</Text>
                </Pressable>
                <Text style={styles.pendingHelper}>
                  If you already clicked the verification link in your inbox, the email change
                  still applies.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    gap: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.divider,
  },
  avatarMeta: {
    flex: 1,
    gap: 4,
  },
  avatarMetaTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SURFACE_TOKENS.textPrimary,
  },
  avatarMetaHint: {
    fontSize: 12,
    color: SURFACE_TOKENS.textSecondary,
    lineHeight: 18,
  },
  fieldRow: {
    paddingVertical: 4,
  },
  fieldLabel: {
    fontSize: 13,
    color: SURFACE_TOKENS.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 13,
    color: SURFACE_TOKENS.textPrimary,
    fontWeight: '600',
    flex: 1,
    maxWidth: '65%',
  },
  placeholder: {
    color: SURFACE_TOKENS.textMuted,
    fontStyle: 'italic',
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editBlock: {
    marginTop: 4,
    gap: 8,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: SURFACE_TOKENS.textPrimary,
    backgroundColor: SURFACE_TOKENS.inputBg,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 44,
    backgroundColor: CONTROL.primary.bg,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: CONTROL.primary.fg,
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE_TOKENS.elevated,
  },
  secondaryBtnText: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  editBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: SURFACE_TOKENS.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {
    fontSize: 13,
    color: CONTROL.primary.bg,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: STATUS.danger.fg,
    marginTop: 2,
  },
  pendingBlock: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: STATUS.warning.fg,
    backgroundColor: STATUS.warning.bg,
    gap: 8,
  },
  pendingText: {
    fontSize: 13,
    color: STATUS.warning.fg,
    fontWeight: '600',
    lineHeight: 18,
  },
  pendingHelper: {
    fontSize: 11,
    color: STATUS.warning.fg,
    lineHeight: 16,
  },
});
