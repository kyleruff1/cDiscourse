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
 * UX-001.7 refactor (Workstream 4, preferred path):
 *   - The bespoke chip body is replaced by the UX-001.5
 *     `AnnotationChip` primitive. Tone (`neutral`/`info`/`attention`/`muted`)
 *     maps to `AnnotationChipDescriptor.iconHint`:
 *       attention → 'warn' (border shade STATUS.warning)
 *       info      → 'info' (border shade unchanged; glyph carries the cue)
 *       neutral/muted → undefined (no glyph; label-only)
 *   - Depth `↳` indicator preserved via the descriptor's `label` prefix
 *     (caller-side prepend) — no new primitive feature.
 *   - The EV-005-specific affordances (status chip header, add-trigger,
 *     observer notice, synthesis-prompt) are PRESERVED VERBATIM as the
 *     compound EV-005 shell — the primitives are not general-purpose for
 *     those patterns.
 *   - `STREAM_HIT_SLOP` constant replaced by the canonical
 *     `TOUCH_TARGET.hitSlopAll` token; runtime value byte-identical.
 *   - Public prop surface (`EvidenceAnnotationChipProps`,
 *     `EvidenceAnnotationStreamProps`) preserved verbatim. Sole
 *     production consumer `SourceChainPopover.tsx` untouched.
 *
 * Accessibility:
 *   - Chips are `accessibilityRole="text"` (not pressable in v1) — the
 *     primitive `AnnotationChip` honors this when no `onPress` is passed.
 *   - The status-chip header carries the count + status label.
 *   - The "Add an annotation" trigger + the synthesis-prompt row are
 *     `Pressable` with `accessibilityRole="button"` and a >=44x44 hit
 *     target via `TOUCH_TARGET.hitSlopAll`.
 *   - Observer mode renders the trigger / prompt disabled with the EV-002
 *     "Join a side to ..." helper.
 */
import React, { type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { STATUS, SURFACE_TOKENS, TOUCH_TARGET } from '../../lib/designTokens';
// STATUS is referenced via STATUS.neutral.bg / STATUS.neutral.fg (the
// muted-tone palette resolves to existing app tokens by byte equality).
import { AnnotationChip } from '../nodeAnnotations/AnnotationChip';
import type { AnnotationChipDescriptor } from '../nodeAnnotations/annotationChipDescriptor';
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

/**
 * UX-001.7 Workstream 4 — build the `AnnotationChipDescriptor` for one
 * `EvidenceAnnotation`. Pure helper. Maps:
 *   - id: stable `annotation.id`
 *   - label: depth-prefixed plain-language label (`↳ ` for depth 1)
 *   - kind: `'evidence'` (uses the existing `ARGUMENT.evidence` family)
 *   - iconHint: undefined (depth carrier is the prefix glyph; the chip
 *     stays label-only to preserve prior visual behavior)
 *   - ariaLabel: explicit screen-reader override from
 *     `buildAnnotationChipAccessibilityLabel` so the existing tests still
 *     verify the same a11y label string.
 *
 * Pure. Deterministic. No allocation beyond the returned object.
 */
export function buildAnnotationDescriptor(
  annotation: EvidenceAnnotation,
): AnnotationChipDescriptor {
  const baseLabel = buildAnnotationChipLabel(annotation);
  const label = annotation.depth === 1 ? `↳ ${baseLabel}` : baseLabel;
  return {
    id: annotation.id,
    label,
    kind: 'evidence',
    ariaLabel: buildAnnotationChipAccessibilityLabel(annotation),
  };
}

// ── Tone → color palette (runtime byte-equivalent) ────────────
//
// Status-chip header tone palette. Per UX-001.7 Workstream 4
// "zero-runtime-diff" requirement, EVERY value here is byte-identical
// to the pre-refactor literal. Where the prior color exactly matched
// a shared token, the token reference replaces the literal (annotated
// as `=== '#xxxxxx'`); where the prior literal did NOT match a shared
// token, the literal is preserved verbatim.
//
// Audit:
//   neutral   '#1e293b' === SURFACE_TOKENS.border       → token
//   neutral   '#e2e8f0' === SURFACE_TOKENS.textPrimary  → token
//   info      '#0c4a6e' → NO matching token (kept literal)
//   info      '#bae6fd' → NO matching token (kept literal)
//   attention '#7c2d12' → NO matching token (STATUS.warning.bg is
//             '#78350f' — different shade; kept literal to preserve
//             byte-identical runtime color)
//   attention '#fed7aa' → NO matching token (STATUS.warning.fg is
//             '#fde68a' — different shade; kept literal)
//   muted     '#1f2937' === STATUS.neutral.bg           → token
//   muted     '#cbd5e1' === STATUS.neutral.fg           → token

const TONE_BG: Record<EvidenceAnnotationSummary['tone'], string> = {
  neutral: SURFACE_TOKENS.border,
  info: '#0c4a6e',
  attention: '#7c2d12',
  muted: STATUS.neutral.bg,
};

const TONE_FG: Record<EvidenceAnnotationSummary['tone'], string> = {
  neutral: SURFACE_TOKENS.textPrimary,
  info: '#bae6fd',
  attention: '#fed7aa',
  muted: STATUS.neutral.fg,
};

// ── EvidenceAnnotationChip ────────────────────────────────────

export interface EvidenceAnnotationChipProps {
  annotation: EvidenceAnnotation;
  testIDSuffix?: string;
}

/**
 * One chip for one EvidenceAnnotation. Read-only (not pressable in v1).
 *
 * UX-001.7 — Now renders via the `AnnotationChip` primitive instead of
 * a bespoke `<View><Text>`. Public prop surface unchanged; runtime
 * behavior (a11y role + label + depth indicator) preserved.
 */
export function EvidenceAnnotationChip({
  annotation,
  testIDSuffix,
}: EvidenceAnnotationChipProps): ReactElement {
  const descriptor = buildAnnotationDescriptor(annotation);
  const testID = `evidence-annotation-chip${testIDSuffix ? `-${testIDSuffix}` : ''}`;
  return (
    <AnnotationChip
      descriptor={descriptor}
      style={annotation.depth === 1 ? styles.chipNested : undefined}
      testID={testID}
    />
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

/**
 * A >=44x44 hit target for the small Pressables — UX-001.7 canonical
 * touch-target token. Byte-equivalent to the prior local
 * `{ top: 12, bottom: 12, left: 12, right: 12 }` literal.
 */
const STREAM_HIT_SLOP = TOUCH_TARGET.hitSlopAll;

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

      {/* The annotation chips — now AnnotationChip primitive instances. */}
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
  // UX-001.7 — The bespoke `chip` + `chipText` styles are removed; the
  // chip body is now rendered by the AnnotationChip primitive. The
  // depth-1 nesting indent is preserved here via the `chipNested`
  // wrapper style applied through the AnnotationChip `style` prop.
  chipNested: { marginLeft: 14 },
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
