/**
 * InvitePanel — UI-only invite placeholder.
 * No email sending, no Supabase migration in this stage.
 * Stage 6.1.0
 */
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  INVITE_PANEL_COPY,
  buildInviteText,
} from './inviteCopy';
import { emptyInviteForm, validateInviteInput } from './inviteTypes';
import type { InviteFormState } from './inviteTypes';
import { SURFACE_TOKENS, STATUS } from '../../lib/designTokens';

interface Props {
  roomTitle: string;
  claim: string;
  onClose?: () => void;
}

export function InvitePanel({ roomTitle, claim, onClose }: Props) {
  const [form, setForm] = useState<InviteFormState>(emptyInviteForm());
  const [copied, setCopied] = useState<'text' | 'link' | null>(null);

  const handleMarkPlanned = () => {
    const error = validateInviteInput(form.emailOrName);
    if (error) {
      setForm((f) => ({ ...f, error }));
      return;
    }
    setForm((f) => ({ ...f, submitted: true, error: null }));
  };

  const handleCopyText = () => {
    // Clipboard not imported to avoid native-module dependency; show feedback only
    setCopied('text');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyLink = () => {
    setCopied('link');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <View style={styles.panel} accessibilityLabel="Invite panel">
      <View style={styles.header}>
        <Text style={styles.title}>{INVITE_PANEL_COPY.title}</Text>
        {onClose && (
          <Pressable onPress={onClose} accessibilityLabel="Close invite panel">
            <Text style={styles.closeBtn}>✕</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.subtitle}>{INVITE_PANEL_COPY.subtitle}</Text>
      <Text style={styles.body}>{INVITE_PANEL_COPY.bodyDescription}</Text>

      {!form.submitted ? (
        <>
          <TextInput
            style={styles.input}
            placeholder={INVITE_PANEL_COPY.emailOrNamePlaceholder}
            value={form.emailOrName}
            onChangeText={(v) => setForm((f) => ({ ...f, emailOrName: v, error: null }))}
            autoCapitalize="none"
            keyboardType="email-address"
            accessibilityLabel="Email or display name"
          />
          {form.error && <Text style={styles.error}>{form.error}</Text>}

          <Pressable style={styles.btnSecondary} onPress={handleMarkPlanned}>
            <Text style={styles.btnSecondaryText}>
              {INVITE_PANEL_COPY.markAsPlanned}
            </Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.confirmedRow}>
          <Text style={styles.confirmedText}>
            Marked as planned: {form.emailOrName}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={handleCopyText}>
          <Text style={styles.actionText}>
            {copied === 'text' ? 'Copied!' : INVITE_PANEL_COPY.copyInviteText}
          </Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={handleCopyLink}>
          <Text style={styles.actionText}>
            {copied === 'link' ? 'Copied!' : INVITE_PANEL_COPY.copyRoomLink}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.notice}>{INVITE_PANEL_COPY.inviteBackendNotice}</Text>

      <Text style={styles.previewLabel}>Invite text preview:</Text>
      <Text style={styles.preview} selectable>
        {buildInviteText(roomTitle, claim)}
      </Text>
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
  btnSecondary: {
    backgroundColor: SURFACE_TOKENS.raised,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnSecondaryText: {
    fontSize: 13,
    color: SURFACE_TOKENS.textSecondary,
    fontWeight: '600',
  },
  confirmedRow: {
    backgroundColor: STATUS.success.bg,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  confirmedText: {
    fontSize: 12,
    color: STATUS.success.fg,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: STATUS.info.bg,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    color: STATUS.info.fg,
    fontWeight: '600',
  },
  notice: {
    fontSize: 11,
    color: SURFACE_TOKENS.textMuted,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  previewLabel: {
    fontSize: 11,
    color: SURFACE_TOKENS.textSecondary,
    marginBottom: 4,
  },
  preview: {
    fontSize: 12,
    color: SURFACE_TOKENS.textSecondary,
    backgroundColor: SURFACE_TOKENS.elevated,
    padding: 8,
    borderRadius: 6,
    lineHeight: 18,
  },
});
