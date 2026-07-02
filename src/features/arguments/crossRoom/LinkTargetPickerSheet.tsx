/**
 * QUOTE-FORGE-001 — Link-target picker sheet (presentational).
 *
 * Opened from the timeline-header `Reference a prior argument` affordance.
 * Lists the caller-readable, locked prior rooms (segmented same-circle
 * first), captures an optional note, and creates a link. It performs NO
 * fetch itself — the room shell passes the built `LinkTargetPickerModel`
 * and the `onCreate` callback (the `useLinkedPriorRooms` hook owns both).
 *
 * Privacy (QOL-042 / QUOTE-FORGE-001 design §Picker):
 *   - The candidate list is exactly what RLS returned; this sheet never
 *     searches or widens it. There is no free-text search box.
 *   - A candidate carries a title only — no score, no standing, no heat.
 *   - Observers (non-participants of the CURRENT room) cannot create a
 *     link (INSERT RLS needs source-room participation); the affordance is
 *     disabled-with-visible-reason rather than surfacing a DB error.
 *
 * Accessibility (accessibility-targets):
 *   - Every Pressable is `accessibilityRole="button"` with a verbose
 *     label, `accessibilityState`, and a 44x44 target via `hitSlop`.
 *   - The note `TextInput` has an `accessibilityLabel`.
 *   - Colour is never the only signal — headers + text carry meaning.
 *   - `reduceMotionOverride` snaps the sheet open (no slide).
 *
 * No new dependency — RN primitives only.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LINKED_PRIOR_ARGUMENT_COPY } from './linkedPriorArgumentCopy';
import {
  MAX_LINK_NOTE_CHARS,
  type LinkTargetCandidate,
  type LinkTargetPickerModel,
} from './linkTargetPickerModel';

/** The outcome the room shell reports back after a create attempt. */
export interface LinkTargetCreateResult {
  ok: boolean;
  error?: string;
  duplicate?: boolean;
}

interface Props {
  visible: boolean;
  /** The segmented candidate model (already fetched + capped by the hook). */
  model: LinkTargetPickerModel | null;
  /** True while the candidate model is being fetched. */
  loadingCandidates: boolean;
  /**
   * True when the current viewer may create a link (participant of the
   * current room). False for an observer — the create controls disable
   * with a visible reason.
   */
  canCreate: boolean;
  /** Create a link to a candidate with the given note. */
  onCreate: (candidate: LinkTargetCandidate, note: string) => Promise<LinkTargetCreateResult>;
  /** Close the sheet. */
  onClose: () => void;
  /** PR-001 — snaps the sheet open when reduce-motion is on. */
  reduceMotionOverride?: boolean;
}

/** 44x44 hit target for the compact controls. */
const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

/** The observer-disabled reason — a visible, non-shaming explanation. */
const OBSERVER_DISABLED_REASON =
  'Join this argument to reference a prior one. Observers can read links but not add them.';

function CandidateRow({
  candidate,
  selected,
  disabled,
  onSelect,
}: {
  candidate: LinkTargetCandidate;
  selected: boolean;
  disabled: boolean;
  onSelect: (candidate: LinkTargetCandidate) => void;
}) {
  const title = candidate.title.trim().length > 0 ? candidate.title.trim() : 'Untitled prior argument';
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        onSelect(candidate);
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Reference the prior argument: ${title}${selected ? ', selected' : ''}`}
      accessibilityState={{ selected, disabled }}
      hitSlop={HIT_SLOP}
      testID={`link-target-candidate-${candidate.debateId}`}
      style={[styles.candidate, selected && styles.candidateSelected, disabled && styles.candidateDisabled]}
    >
      <Text style={styles.candidateMark}>{selected ? '◉' : '○'}</Text>
      <Text style={styles.candidateTitle} numberOfLines={2}>
        {title}
      </Text>
    </Pressable>
  );
}

export function LinkTargetPickerSheet({
  visible,
  model,
  loadingCandidates,
  canCreate,
  onCreate,
  onClose,
  reduceMotionOverride,
}: Props) {
  const [selected, setSelected] = useState<LinkTargetCandidate | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the transient state each time the sheet is (re)opened.
  useEffect(() => {
    if (visible) {
      setSelected(null);
      setNote('');
      setSubmitting(false);
      setError(null);
    }
  }, [visible]);

  const isEmpty = !model || model.isEmpty;

  const handleSubmit = async () => {
    if (!selected || !canCreate || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await onCreate(selected, note.trim().slice(0, MAX_LINK_NOTE_CHARS));
    setSubmitting(false);
    if (result.ok) {
      // Duplicate is idempotent success — close calmly; refresh shows the chip.
      onClose();
      return;
    }
    setError(result.error ?? 'Could not reference that prior argument.');
  };

  const animationType = reduceMotionOverride === true ? 'none' : 'slide';

  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="link-target-picker-sheet">
          <Text style={styles.title} testID="link-target-create-affordance">
            {LINKED_PRIOR_ARGUMENT_COPY.createAffordance}
          </Text>
          <Text style={styles.subtitle}>
            Reference a settled prior argument as context for this room. Only settled arguments you
            can open are listed.
          </Text>

          {!canCreate ? (
            <Text style={styles.observerReason} testID="link-target-observer-reason">
              {OBSERVER_DISABLED_REASON}
            </Text>
          ) : null}

          {loadingCandidates ? (
            <Text style={styles.notice}>Loading prior arguments…</Text>
          ) : isEmpty ? (
            <Text style={styles.notice} testID="link-target-empty">
              {LINKED_PRIOR_ARGUMENT_COPY.pickerEmpty}
            </Text>
          ) : (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {model && model.sameCircle.length > 0 ? (
                <View>
                  <Text style={styles.sectionHeader} testID="link-target-same-circle-header">
                    In this circle
                  </Text>
                  {model.sameCircle.map((candidate) => (
                    <CandidateRow
                      key={candidate.debateId}
                      candidate={candidate}
                      selected={selected?.debateId === candidate.debateId}
                      disabled={!canCreate || submitting}
                      onSelect={setSelected}
                    />
                  ))}
                </View>
              ) : null}
              {model && model.other.length > 0 ? (
                <View>
                  {model.sameCircle.length > 0 ? (
                    <Text style={styles.sectionHeader}>Other settled arguments</Text>
                  ) : null}
                  {model.other.map((candidate) => (
                    <CandidateRow
                      key={candidate.debateId}
                      candidate={candidate}
                      selected={selected?.debateId === candidate.debateId}
                      disabled={!canCreate || submitting}
                      onSelect={setSelected}
                    />
                  ))}
                </View>
              ) : null}
              {model && model.moreNotShown ? (
                <Text style={styles.moreNotShown} testID="link-target-more-not-shown">
                  More settled arguments exist than shown here. The most recent are listed first.
                </Text>
              ) : null}
            </ScrollView>
          )}

          {!isEmpty && canCreate ? (
            <>
              <TextInput
                style={styles.noteInput}
                multiline
                placeholder="Optional note (why this prior argument matters). Max 280 characters."
                placeholderTextColor="#64748b"
                value={note}
                onChangeText={(s) => setNote(s.slice(0, MAX_LINK_NOTE_CHARS))}
                accessibilityLabel="Optional note for the referenced prior argument"
                editable={!submitting}
                testID="link-target-note-input"
              />
              <Text style={styles.charCount}>
                {note.length} / {MAX_LINK_NOTE_CHARS}
              </Text>
            </>
          ) : null}

          {error ? (
            <Text style={styles.error} testID="link-target-error">
              {error}
            </Text>
          ) : null}

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel referencing a prior argument"
              accessibilityState={{ disabled: false }}
              hitSlop={HIT_SLOP}
              testID="link-target-cancel"
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                styles.btnPrimary,
                (!selected || !canCreate || submitting) && styles.btnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selected || !canCreate || submitting}
              accessibilityRole="button"
              accessibilityLabel="Reference the selected prior argument"
              accessibilityState={{ disabled: !selected || !canCreate || submitting }}
              hitSlop={HIT_SLOP}
              testID="link-target-submit"
            >
              <Text style={styles.btnPrimaryText}>
                {submitting ? 'Referencing…' : 'Reference'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0f172a',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#1f2937',
    maxHeight: '80%',
  },
  title: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#94a3b8', fontSize: 12, lineHeight: 16, marginBottom: 12 },
  observerReason: {
    color: '#fcd34d',
    backgroundColor: '#422006',
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    marginBottom: 10,
  },
  notice: { color: '#94a3b8', fontSize: 13, paddingVertical: 12 },
  list: { maxHeight: 260, marginBottom: 8 },
  sectionHeader: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 6,
    minHeight: 44,
  },
  candidateSelected: { borderColor: '#6366f1', backgroundColor: '#312e81' },
  candidateDisabled: { opacity: 0.6 },
  candidateMark: { color: '#a5b4fc', fontSize: 16, fontWeight: '800' },
  candidateTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '600', flex: 1 },
  moreNotShown: { color: '#64748b', fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  noteInput: {
    backgroundColor: '#020617',
    color: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    minHeight: 64,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#1f2937',
    textAlignVertical: 'top',
  },
  charCount: { color: '#64748b', fontSize: 10, textAlign: 'right', marginTop: 2 },
  error: { color: '#fca5a5', backgroundColor: '#7f1d1d', borderRadius: 8, padding: 8, marginTop: 8, fontSize: 12 },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, minHeight: 44, justifyContent: 'center' },
  btnPrimary: { backgroundColor: '#6366f1' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnSecondary: { backgroundColor: '#1f2937' },
  btnSecondaryText: { color: '#e2e8f0', fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
