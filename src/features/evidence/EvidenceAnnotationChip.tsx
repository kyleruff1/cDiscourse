/**
 * EV-005 — EvidenceAnnotationChip + EvidenceAnnotationStream.
 *
 * Presentational layer for the evidence-annotation surface. Renders inside
 * the EV-002 SourceChainPopover body, below "Inspect receipt".
 *
 * Doctrine:
 *   - Every chip describes a source / record, never a person. The label /
 *     helper come from the EV-005 plain-language copy map — no raw codes.
 *   - Color is supplementary: the chip's text label carries the full meaning
 *     (a grayscale test asserts color-independence).
 *   - No state, no network, no Supabase. Props are fully controlled by the
 *     parent (TimelineNodePopover owns sheet + submit state).
 *
 * Accessibility:
 *   - Chips are `accessibilityRole="text"` (not pressable in v1).
 *   - The status-chip header carries the count + status label.
 *   - The "Add an annotation" trigger + the synthesis-prompt row are
 *     `Pressable` with `accessibilityRole="button"` and a ≥44×44 hit target.
 *   - Observer mode renders the trigger / prompt disabled with the EV-002
 *     "Join a side to ..." helper.
 */
import React, { type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getEvidenceAnnotationHelper,
  getEvidenceAnnotationLabel,
  type AnnotationDepthCapResult,
  type EvidenceAnnotation,
  type EvidenceAnnotationSummary,
} from './evidenceModel';

// ── Observer helper (mirrors the EV-002 locked string family) ──

export const EVIDENCE_ANNOTATION_OBSERVER_HELPER = 'Join a side to add an annotation';

// ── Pure helpers (test-only consumers) ────────────────────────

/**
 * The chip's display string for one annotation — the plain-language kind
 * label, plus a short note suffix when a note is present. Pure.
 */
export function buildAnnotationChipLabel(annotation: EvidenceAnnotation): string {
  const base = getEvidenceAnnotationLabel(annotation.kind);
  const note = annotation.note?.trim();
  if (!note) return base;
  const short = note.length > 60 ? `${note.slice(0, 59)}…` : note;
  return `${base} — ${short}`;
}

/** The screen-reader label for one annotation chip. Pure. */
export function buildAnnotationChipAccessibilityLabel(annotation: EvidenceAnnotation): string {
  const label = getEvidenceAnnotationLabel(annotation.kind);
  const helper = getEvidenceAnnotationHelper(annotation.kind);
  const note = annotation.note?.trim();
  const depthFragment = annotation.depth === 1 ? ' Reply annotation.' : '';
  const noteFragment = note ? ` Note: ${note}.` : '';
  return `Annotation: ${label}. ${helper}${depthFragment}${noteFragment}`;
}

/** The screen-reader label for the derived status-chip header. Pure. */
export function buildAnnotationStatusChipAccessibilityLabel(
  summary: EvidenceAnnotationSummary,
): string {
  const countFragment =
    summary.count === 0
      ? 'No annotations'
      : `${summary.count} annotation${summary.count === 1 ? '' : 's'}`;
  return `Evidence annotations: ${summary.statusLabel}. ${countFragment}. ${summary.statusHelper}`;
}

// ── Tone → color tokens ───────────────────────────────────────

const TONE_BG: Record<EvidenceAnnotationSummary['tone'], string> = {
  neutral: '#1e293b',
  info: '#0c4a6e',
  attention: '#7c2d12',
  muted: '#1f2937',
};

const TONE_FG: Record<EvidenceAnnotationSummary['tone'], string> = {
  neutral: '#e2e8f0',
  info: '#bae6fd',
  attention: '#fed7aa',
  muted: '#cbd5e1',
};

// ── EvidenceAnnotationChip ────────────────────────────────────

export interface EvidenceAnnotationChipProps {
  annotation: EvidenceAnnotation;
  testIDSuffix?: string;
}

/** One chip for one EvidenceAnnotation. Read-only (not pressable in v1). */
export function EvidenceAnnotationChip({
  annotation,
  testIDSuffix,
}: EvidenceAnnotationChipProps): ReactElement {
  const label = buildAnnotationChipLabel(annotation);
  const accessibilityLabel = buildAnnotationChipAccessibilityLabel(annotation);
  const testID = `evidence-annotation-chip${testIDSuffix ? `-${testIDSuffix}` : ''}`;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      style={[styles.chip, annotation.depth === 1 && styles.chipNested]}
      testID={testID}
    >
      <Text style={styles.chipText} numberOfLines={2}>
        {annotation.depth === 1 ? `↳ ${label}` : label}
      </Text>
    </View>
  );
}

// ── EvidenceAnnotationStream ──────────────────────────────────

export interface EvidenceAnnotationStreamProps {
  summary: EvidenceAnnotationSummary;
  annotations: ReadonlyArray<EvidenceAnnotation>;
  depthCap: AnnotationDepthCapResult;
  /** Eligibility of the current viewer for adding a depth-0 annotation.
   *  When false, the "Add an annotation" trigger is hidden. */
  canAddAnnotation: boolean;
  /** Fires when the "Add an annotation" trigger is pressed. */
  onPressAddAnnotation?: () => void;
  /** Fires when the synthesis-prompt row is pressed (depth cap reached). */
  onPressSynthesisPrompt?: () => void;
  /** Observer mode — trigger + synthesis prompt render disabled with the
   *  EV-002 "Join a side to ..." helper. */
  isReadModeViewer?: boolean;
  messageId: string;
}

const ADD_ANNOTATION_TRIGGER_LABEL = 'Add an annotation';

/** A ≥44×44 hit target for the small Pressables. */
const STREAM_HIT_SLOP = Object.freeze({ top: 12, bottom: 12, left: 12, right: 12 });

/**
 * Read-only vertical list of annotation chips + the derived status-chip
 * header, the "Add an annotation" trigger (for eligible viewers), and the
 * depth-cap synthesis-prompt row.
 */
export function EvidenceAnnotationStream({
  summary,
  annotations,
  depthCap,
  canAddAnnotation,
  onPressAddAnnotation,
  onPressSynthesisPrompt,
  isReadModeViewer = false,
  messageId,
}: EvidenceAnnotationStreamProps): ReactElement {
  const statusAccessibilityLabel = buildAnnotationStatusChipAccessibilityLabel(summary);
  const showsTrigger = canAddAnnotation && !isReadModeViewer;
  const showsObserverTriggerNotice = canAddAnnotation && isReadModeViewer;

  return (
    <View style={styles.stream} testID={`evidence-annotation-stream-${messageId}`}>
      {/* Derived status-chip header. */}
      <View
        accessibilityRole="text"
        accessibilityLabel={statusAccessibilityLabel}
        style={[styles.statusChip, { backgroundColor: TONE_BG[summary.tone] }]}
        testID={`annotation-status-chip-${messageId}`}
      >
        <Text style={[styles.statusLabel, { color: TONE_FG[summary.tone] }]} numberOfLines={1}>
          {summary.statusLabel}
          {summary.count > 0 ? ` · ${summary.count}` : ''}
        </Text>
        <Text style={[styles.statusHelper, { color: TONE_FG[summary.tone] }]} numberOfLines={2}>
          {summary.statusHelper}
        </Text>
      </View>

      {/* The annotation chips. */}
      {annotations.length > 0 ? (
        <View style={styles.chipList} testID={`evidence-annotation-chips-${messageId}`}>
          {annotations.map((a, i) => (
            <EvidenceAnnotationChip key={a.id} annotation={a} testIDSuffix={`${messageId}-${i}`} />
          ))}
        </View>
      ) : null}

      {/* The "Add an annotation" trigger for eligible viewers. */}
      {showsTrigger ? (
        <Pressable
          onPress={onPressAddAnnotation}
          accessibilityRole="button"
          accessibilityLabel={ADD_ANNOTATION_TRIGGER_LABEL}
          accessibilityHint="Opens a picker to attach a descriptive note to this source."
          hitSlop={STREAM_HIT_SLOP}
          style={styles.addTrigger}
          testID={`add-annotation-trigger-${messageId}`}
        >
          <Text style={styles.addTriggerText} numberOfLines={1}>
            {`+ ${ADD_ANNOTATION_TRIGGER_LABEL}`}
          </Text>
        </Pressable>
      ) : null}

      {/* Observer sees the trigger disabled with the EV-002 helper. */}
      {showsObserverTriggerNotice ? (
        <View
          accessibilityRole="text"
          accessibilityLabel={EVIDENCE_ANNOTATION_OBSERVER_HELPER}
          style={[styles.addTrigger, styles.addTriggerDisabled]}
          testID={`add-annotation-observer-${messageId}`}
        >
          <Text style={styles.observerHelper} numberOfLines={2}>
            {EVIDENCE_ANNOTATION_OBSERVER_HELPER}
          </Text>
        </View>
      ) : null}

      {/* Depth cap reached → synthesis-prompt row instead of a deeper add. */}
      {depthCap.showsSynthesisPrompt ? (
        isReadModeViewer ? (
          <View
            accessibilityRole="text"
            accessibilityLabel={`${depthCap.synthesisPromptLabel}. ${EVIDENCE_ANNOTATION_OBSERVER_HELPER}`}
            accessibilityState={{ disabled: true }}
            style={[styles.synthesisPrompt, styles.synthesisPromptDisabled]}
            testID={`annotation-synthesis-prompt-${messageId}`}
          >
            <Text style={styles.synthesisPromptText} numberOfLines={2}>
              {depthCap.synthesisPromptLabel}
            </Text>
            <Text style={styles.observerHelper} numberOfLines={1}>
              {EVIDENCE_ANNOTATION_OBSERVER_HELPER}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={onPressSynthesisPrompt}
            accessibilityRole="button"
            accessibilityLabel={depthCap.synthesisPromptLabel}
            accessibilityHint="Opens the composer to write a synthesis move for this evidence thread."
            hitSlop={STREAM_HIT_SLOP}
            style={styles.synthesisPrompt}
            testID={`annotation-synthesis-prompt-${messageId}`}
          >
            <Text style={styles.synthesisPromptText} numberOfLines={2}>
              {depthCap.synthesisPromptLabel}
            </Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stream: { gap: 6, marginTop: 6 },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
  },
  statusLabel: { fontSize: 12, fontWeight: '700' },
  statusHelper: { fontSize: 11, lineHeight: 14 },
  chipList: { gap: 4 },
  chip: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  chipNested: { marginLeft: 14, backgroundColor: '#111c30' },
  chipText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  addTrigger: {
    backgroundColor: '#0c4a6e',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  addTriggerDisabled: { backgroundColor: '#1f2937', opacity: 0.7 },
  addTriggerText: { color: '#f8fafc', fontSize: 12, fontWeight: '700' },
  observerHelper: { color: '#94a3b8', fontSize: 11, fontStyle: 'italic' },
  synthesisPrompt: {
    backgroundColor: '#3730a3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
    gap: 2,
  },
  synthesisPromptDisabled: { backgroundColor: '#1f2937', opacity: 0.7 },
  synthesisPromptText: { color: '#e0e7ff', fontSize: 12, fontWeight: '700' },
});
