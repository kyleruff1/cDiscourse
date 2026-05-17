/**
 * Stage 6.1.8 — DeletionRequestSheet
 *
 * Opened from an own-bubble's "Request deletion" action. Captures optional
 * reason and calls the `request-argument-deletion` Edge Function. Never
 * promises deletion — copy is explicit that an admin must review.
 */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { requestArgumentDeletion } from '../../lib/edgeFunctions';

interface Props {
  visible: boolean;
  debateId: string;
  argumentId: string;
  onClose: () => void;
  onSuccess?: (info: { requestId: string; status: string; emailStatus: string }) => void;
}

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; requestId: string; status: string; emailStatus: string }
  | { kind: 'error'; message: string };

export function DeletionRequestSheet({ visible, debateId, argumentId, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState('');
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  const handleSubmit = async () => {
    setState({ kind: 'submitting' });
    const trimmed = reason.trim().slice(0, 2000);
    const r = await requestArgumentDeletion({ debateId, argumentId, reason: trimmed || null });
    if (r.ok) {
      setState({ kind: 'success', requestId: r.data.requestId, status: r.data.status, emailStatus: r.data.emailStatus });
      onSuccess?.(r.data);
    } else {
      const parts = [r.error?.reason, r.error?.detail].filter(Boolean) as string[];
      const message = parts.length > 0
        ? `${r.error?.error || `error_${r.status}`} (${parts.join('; ')})`
        : (r.error?.error || `error_${r.status}`);
      setState({ kind: 'error', message });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityLabel="deletion-request-sheet" testID="deletion-request-sheet">
          <Text style={styles.title}>Request deletion of this message</Text>
          <Text style={styles.subtitle}>
            Posted messages cannot be edited. You can ask an admin to remove this one. Submitting this form does NOT delete the message — an admin must review and act.
          </Text>

          <TextInput
            style={styles.input}
            multiline
            placeholder="Optional reason (visible to admins only). Max 2000 characters."
            placeholderTextColor="#64748b"
            value={reason}
            onChangeText={(s) => setReason(s.slice(0, 2000))}
            accessibilityLabel="deletion-request-reason"
            editable={state.kind !== 'submitting' && state.kind !== 'success'}
            testID="deletion-request-reason"
          />
          <Text style={styles.charCount}>{reason.length} / 2000</Text>

          {state.kind === 'error' && (
            <Text style={styles.error} accessibilityLabel="deletion-request-error">
              Could not submit: {state.message}
            </Text>
          )}
          {state.kind === 'success' && (
            <View style={styles.successBlock} accessibilityLabel="deletion-request-success">
              <Text style={styles.successTitle}>Request recorded.</Text>
              <Text style={styles.successBody}>
                Status: <Text style={styles.successStrong}>{state.status}</Text>.{' '}
                {state.emailStatus === 'sent' && 'An admin notification email has been sent.'}
                {state.emailStatus === 'not_configured' && 'Admin email notifications are not configured yet.'}
                {state.emailStatus === 'failed_sanitized' && 'The notification email could not be sent; the request itself is recorded.'}
              </Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel deletion request"
              testID="deletion-request-cancel"
            >
              <Text style={styles.btnSecondaryText}>{state.kind === 'success' ? 'Close' : 'Cancel'}</Text>
            </Pressable>
            {state.kind !== 'success' && (
              <Pressable
                style={[styles.btn, styles.btnPrimary, state.kind === 'submitting' && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={state.kind === 'submitting'}
                accessibilityRole="button"
                accessibilityLabel="Submit deletion request"
                testID="deletion-request-submit"
              >
                <Text style={styles.btnPrimaryText}>
                  {state.kind === 'submitting' ? 'Submitting…' : 'Submit request'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0f172a', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: '#1f2937' },
  title: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#94a3b8', fontSize: 12, lineHeight: 16, marginBottom: 12 },
  input: { backgroundColor: '#020617', color: '#f8fafc', borderRadius: 10, padding: 12, minHeight: 80, fontSize: 13, borderWidth: 1, borderColor: '#1f2937', textAlignVertical: 'top' },
  charCount: { color: '#64748b', fontSize: 10, textAlign: 'right', marginTop: 2 },
  error: { color: '#fca5a5', backgroundColor: '#7f1d1d', borderRadius: 8, padding: 8, marginTop: 8, fontSize: 12 },
  successBlock: { marginTop: 8, padding: 10, backgroundColor: '#064e3b', borderRadius: 10 },
  successTitle: { color: '#a7f3d0', fontWeight: '700', fontSize: 13 },
  successStrong: { fontWeight: '700', color: '#ecfdf5' },
  successBody: { color: '#ecfdf5', fontSize: 12, marginTop: 4 },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, minHeight: 40 },
  btnPrimary: { backgroundColor: '#6366f1' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnSecondary: { backgroundColor: '#1f2937' },
  btnSecondaryText: { color: '#e2e8f0', fontWeight: '700' },
  btnDisabled: { opacity: 0.7 },
});
