/**
 * EV-005 — AddAnnotationSheet.
 *
 * The interactive "Add an annotation" picker — a modal bottom-sheet built
 * from RN primitives only (`Modal` + `Pressable` scrim + `ScrollView` of
 * radio option rows + a `TextInput` note field + Confirm/Cancel).
 *
 * Doctrine:
 *   - Lists only the kinds eligible for the actor (own-bubble → 3 kinds;
 *     other-bubble + admin → 18). The parent derives `eligibleKinds`.
 *   - Each option label / helper comes from the EV-005 plain-language copy.
 *   - The note field carries the visible hint "Describe the source, not the
 *     person." — annotations describe the record, never accuse a person.
 *   - No Supabase import — persistence is the parent's job via
 *     `addEvidenceAnnotation`.
 *
 * Accessibility:
 *   - `Modal` with `accessibilityViewIsModal`; root `accessibilityRole="dialog"`.
 *   - Scrim is a full-bleed `Pressable` (`accessibilityLabel="Close"`).
 *   - Escape / outside-press / hardware back all close: `onRequestClose` →
 *     `onClose`; on web a `keydown` listener closes on Escape.
 *   - Option rows are `accessibilityRole="radio"` with `accessibilityState`;
 *     exactly one selected at a time; ≥44×44 hit target.
 *   - Confirm is disabled until a kind is selected and while submitting.
 *   - Submit failures render in a polite live region.
 *   - `reduceMotion` sets `animationType="none"`.
 */
import React, { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  getEvidenceAnnotationHelper,
  getEvidenceAnnotationLabel,
  type EvidenceAnnotationKind,
} from './evidenceModel';

export const ADD_ANNOTATION_NOTE_HINT = 'Describe the source, not the person.';
export const ADD_ANNOTATION_NOTE_LABEL = 'Optional note about this source';
export const ADD_ANNOTATION_NOTE_MAX_LENGTH = 140;

export interface AddAnnotationSheetProps {
  visible: boolean;
  /** Which kinds to offer — derived by the parent from eligibleAnnotationKinds
   *  over the viewer's actorRole + targetDepth. */
  eligibleKinds: ReadonlyArray<EvidenceAnnotationKind>;
  /** The artifact being annotated — shown in the sheet header. */
  evidenceArtifactLabel: string;
  /** Confirm. The parent persists via addEvidenceAnnotation. */
  onSubmit: (kind: EvidenceAnnotationKind, note: string | null) => void;
  /** Cancel / scrim-press / Escape / hardware back. */
  onClose: () => void;
  /** True while the parent's addEvidenceAnnotation call is in flight —
   *  disables Confirm, shows a busy state. */
  isSubmitting?: boolean;
  /** Set when the last submit failed — rendered inline, polite live region. */
  submitError?: string | null;
  /** True under AccessibilityInfo.isReduceMotionEnabled — sets
   *  Modal animationType="none". */
  reduceMotion?: boolean;
}

const HIT_SLOP = Object.freeze({ top: 10, bottom: 10, left: 10, right: 10 });

export function AddAnnotationSheet({
  visible,
  eligibleKinds,
  evidenceArtifactLabel,
  onSubmit,
  onClose,
  isSubmitting = false,
  submitError = null,
  reduceMotion = false,
}: AddAnnotationSheetProps): ReactElement {
  const [selectedKind, setSelectedKind] = useState<EvidenceAnnotationKind | null>(null);
  const [note, setNote] = useState('');

  // Reset local state each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setSelectedKind(null);
      setNote('');
    }
  }, [visible]);

  // Web: Escape closes the sheet. (Native: Modal.onRequestClose covers back.)
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const handler = (e: { key?: string }) => {
      if (e.key === 'Escape') onClose();
    };
    const g = globalThis as unknown as {
      addEventListener?: (t: string, h: (e: { key?: string }) => void) => void;
      removeEventListener?: (t: string, h: (e: { key?: string }) => void) => void;
    };
    g.addEventListener?.('keydown', handler);
    return () => g.removeEventListener?.('keydown', handler);
  }, [visible, onClose]);

  const handleConfirm = useCallback(() => {
    if (!selectedKind || isSubmitting) return;
    const trimmed = note.trim();
    onSubmit(selectedKind, trimmed.length > 0 ? trimmed : null);
  }, [selectedKind, isSubmitting, note, onSubmit]);

  const confirmDisabled = selectedKind === null || isSubmitting;
  const charCount = note.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      testID="add-annotation-modal"
    >
      {/* Full-bleed scrim — pressing it closes the sheet. */}
      <Pressable
        style={styles.scrim}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        testID="add-annotation-scrim"
      >
        {/* Inner Pressable swallows presses so a tap on the sheet body does
            not bubble to the scrim. */}
        <Pressable
          style={styles.sheet}
          accessibilityViewIsModal
          accessibilityRole="none"
          onPress={() => undefined}
          testID="add-annotation-sheet"
        >
          <View accessibilityRole="header" style={styles.headerRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Add an annotation
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={HIT_SLOP}
              style={styles.headerCloseBtn}
              testID="add-annotation-header-close"
            >
              <Text style={styles.headerCloseText}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.headerSubtitle} numberOfLines={2}>
            {`Describe this source: ${evidenceArtifactLabel}`}
          </Text>

          <ScrollView
            style={styles.optionScroll}
            contentContainerStyle={styles.optionList}
            testID="add-annotation-option-list"
          >
            {eligibleKinds.map((kind) => {
              const selected = selectedKind === kind;
              const label = getEvidenceAnnotationLabel(kind);
              const helper = getEvidenceAnnotationHelper(kind);
              return (
                <Pressable
                  key={kind}
                  onPress={() => setSelectedKind(kind)}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityHint={helper}
                  accessibilityState={{ selected }}
                  hitSlop={HIT_SLOP}
                  style={[styles.optionRow, selected && styles.optionRowSelected]}
                  testID={`add-annotation-option-${kind}`}
                >
                  <View style={styles.optionMark}>
                    <Text style={styles.optionMarkText}>{selected ? '●' : '○'}</Text>
                  </View>
                  <View style={styles.optionTextBlock}>
                    <Text style={styles.optionLabel} numberOfLines={1}>
                      {label}
                    </Text>
                    <Text style={styles.optionHelper} numberOfLines={2}>
                      {helper}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Optional note field. */}
          <View style={styles.noteBlock}>
            <Text style={styles.noteHint} numberOfLines={1}>
              {ADD_ANNOTATION_NOTE_HINT}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={ADD_ANNOTATION_NOTE_MAX_LENGTH}
              multiline
              accessibilityLabel={ADD_ANNOTATION_NOTE_LABEL}
              placeholder="Add a short note (optional)"
              placeholderTextColor="#64748b"
              style={styles.noteInput}
              testID="add-annotation-note-input"
            />
            <Text style={styles.noteCount} testID="add-annotation-note-count">
              {`${charCount}/${ADD_ANNOTATION_NOTE_MAX_LENGTH}`}
            </Text>
          </View>

          {/* Submit failure — polite live region. */}
          {submitError ? (
            <Text
              accessibilityLiveRegion="polite"
              style={styles.submitError}
              testID="add-annotation-error"
            >
              {submitError}
            </Text>
          ) : null}

          {/* Cancel / Confirm. */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={HIT_SLOP}
              style={[styles.actionBtn, styles.cancelBtn]}
              testID="add-annotation-cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={confirmDisabled}
              accessibilityRole="button"
              accessibilityLabel="Confirm annotation"
              accessibilityState={{ disabled: confirmDisabled, busy: isSubmitting }}
              hitSlop={HIT_SLOP}
              style={[styles.actionBtn, styles.confirmBtn, confirmDisabled && styles.confirmBtnDisabled]}
              testID="add-annotation-confirm"
            >
              <Text style={styles.confirmText}>{isSubmitting ? 'Adding…' : 'Confirm'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0b1220',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 18,
    maxHeight: '86%',
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '800', flex: 1 },
  headerCloseBtn: { paddingHorizontal: 6, minHeight: 36, justifyContent: 'center' },
  headerCloseText: { color: '#94a3b8', fontSize: 20, fontWeight: '800' },
  headerSubtitle: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },
  optionScroll: { maxHeight: 320 },
  optionList: { gap: 6, paddingVertical: 4 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 44,
  },
  optionRowSelected: { borderColor: '#38bdf8', backgroundColor: '#0c2942' },
  optionMark: { width: 18, alignItems: 'center', paddingTop: 1 },
  optionMarkText: { color: '#7dd3fc', fontSize: 13, fontWeight: '800' },
  optionTextBlock: { flex: 1, gap: 2 },
  optionLabel: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  optionHelper: { color: '#94a3b8', fontSize: 11, lineHeight: 15 },
  noteBlock: { gap: 4 },
  noteHint: { color: '#cbd5e1', fontSize: 11, fontStyle: 'italic' },
  noteInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  noteCount: { color: '#64748b', fontSize: 10, alignSelf: 'flex-end' },
  submitError: { color: '#fca5a5', fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  cancelBtn: { backgroundColor: '#1f2937' },
  cancelText: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  confirmBtn: { backgroundColor: '#0c4a6e' },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { color: '#f8fafc', fontSize: 13, fontWeight: '800' },
});
