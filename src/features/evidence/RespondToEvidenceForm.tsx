/**
 * QOL-037 — RespondToEvidenceForm.
 *
 * The structured-form body for the `respond_to_evidence` interaction: the
 * seven-choice radio group, a conditional required-clarification field, a
 * status-change preview line, and a Post button that disables (with a visible
 * reason) until the §5.1 clarification rule is satisfied.
 *
 * QOL-030 / QOL-032 fallback (design §11, §13): QOL-030's one-box composer
 * chassis is not yet built, so this form is a SELF-CONTAINED RN component that
 * any host can mount — `ArgumentComposer` today, QOL-030's `renderSchema`
 * later. It owns its own choice + clarification draft state; the host supplies
 * the target's data and receives the assembled `evidenceResponse` block via
 * `onPost`. It also renders the QOL-032 §E applicability read-view inline, so
 * the read-only path works before the Inspect popout ships.
 *
 * Doctrine (design §6.1, §9, §10, §12; cdiscourse-doctrine §1):
 *   - The required-clarification rule is a VALIDATION gate — it disables Post.
 *     Score never blocks; this is structural, like a forced-list item field.
 *   - The disabled Post button always shows a visible one-line reason — never
 *     a silent no-op.
 *   - `accept` is the only choice with no clarification field — it is hidden
 *     entirely (no empty box). The per-choice draft buffer keeps a non-accept
 *     clarification text parked when the user toggles to `accept` and back
 *     (edge case 3).
 *   - Own-evidence: the form is not offered to the evidence's author — it
 *     renders a read-only notice instead (design §9). The author fixes their
 *     own evidence with a new evidence move.
 *   - Observer: the Post action is disabled with "Join a side to respond".
 *   - Every string comes from `evidenceApplicabilityCopy` / the model's
 *     descriptors. This component authors no user-facing copy of its own.
 *   - Reduce-motion: the clarification show/hide skips `LayoutAnimation`
 *     (design §10 edge case 15).
 *
 * Pure presentation + local draft state. No Supabase, no network — the host
 * posts through the existing `submit-argument` flow.
 */
import React, { useCallback, useMemo, useState, type ReactElement } from 'react';
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  EVIDENCE_RESPONSE_CHOICES,
  validateEvidenceResponseDraft,
  previewApplicabilityTransition,
  summarizeApplicabilityChip,
  type EvidenceResponseChoice,
  type ApplicabilityStatus,
  type RespondToEvidenceViewModel,
} from './evidenceApplicabilityModel';
import {
  APPLICABILITY_PREVIEW_PREFIX,
  APPLICABILITY_PREVIEW_NO_CHANGE,
  APPLICABILITY_READ_VIEW_HEADING,
  CLAIMED_APPLICABILITY_LABEL,
  DISPUTED_APPLICABILITY_LABEL,
  APPLICABILITY_NOT_SPECIFIED,
  APPLICABILITY_NO_DISPUTE,
  CLARIFICATION_FIELD_LABEL,
  CLARIFICATION_FIELD_PLACEHOLDER,
  OWN_EVIDENCE_NOTICE,
  OBSERVER_RESPONSE_DISABLED_REASON,
} from './evidenceApplicabilityCopy';

/** The block the host attaches to the `submit-argument` draft on Post. */
export interface EvidenceResponseDraft {
  /** The evidence object this response targets. */
  evidenceArtifactId: string;
  /** The selected response choice. */
  choice: EvidenceResponseChoice;
  /** The clarification body (trimmed). '' only when `choice === 'accept'`. */
  clarificationBody: string;
}

/**
 * The viewer's role for this evidence object. Mirrors the QOL-030 role gate:
 *   - `participant` — a primary participant who is NOT the evidence author;
 *     may post a response.
 *   - `evidence_author` — the author of the evidence; the form is read-only
 *     (they fix their own evidence with a new evidence move, design §9).
 *   - `observer` — read-mode (Stage 6.4); the Post action is disabled.
 */
export type RespondToEvidenceViewerRole =
  | 'participant'
  | 'evidence_author'
  | 'observer';

export interface RespondToEvidenceFormProps {
  /** The pure view-model from `buildRespondToEvidenceViewModel`. */
  viewModel: RespondToEvidenceViewModel;
  /** The viewer's role for this evidence object — drives the §9 gates. */
  viewerRole: RespondToEvidenceViewerRole;
  /** Called on a valid Post. The host attaches the block to the draft and
   *  posts through `submit-argument`. */
  onPost: (draft: EvidenceResponseDraft) => void;
  /**
   * EV-002 seed for `request_source`: when the user selects `request_source`
   * the host (or this form) seeds the clarification field with this body. When
   * omitted, the field starts empty and the §5.1 rule re-engages.
   */
  requestSourceSeedBody?: string;
  /** True under `AccessibilityInfo.isReduceMotionEnabled` — skips the
   *  clarification show/hide `LayoutAnimation`. */
  reduceMotion?: boolean;
  /** True while the host's `submit-argument` call is in flight — disables Post. */
  isSubmitting?: boolean;
  /** Test id prefix to disambiguate multiple forms. */
  testIDPrefix?: string;
}

const HIT_SLOP = Object.freeze({ top: 10, bottom: 10, left: 10, right: 10 });

/** Shown on the disabled Post button before any choice has been picked. */
export const PICK_A_RESPONSE_PROMPT = 'Pick a response above to continue.';

/**
 * Compose the preview line for a selected choice. Pure — exposed for tests.
 * When the choice changes no applicability status, the "no change" copy is
 * returned; otherwise the prefix is paired with the resulting chip label.
 */
export function composeApplicabilityPreviewLine(
  choice: EvidenceResponseChoice,
  currentStatus: ApplicabilityStatus,
): string {
  const nextStatus = previewApplicabilityTransition(choice, currentStatus);
  if (nextStatus === currentStatus) {
    return APPLICABILITY_PREVIEW_NO_CHANGE;
  }
  const chip = summarizeApplicabilityChip(nextStatus);
  return `${APPLICABILITY_PREVIEW_PREFIX}${chip.label}`;
}

/** The render decisions the form derives from its draft + role state. Pure. */
export interface RespondToEvidenceFormPlan {
  /** True when the conditional clarification field should render. Hidden for
   *  `accept` and before any choice is picked. */
  showsClarificationField: boolean;
  /** True when the Post button is disabled (role, in-flight, or §5.1 rule). */
  postDisabled: boolean;
  /** The visible disabled-Post reason, or null when Post is enabled. Never a
   *  silent no-op — a disabled Post always carries a reason. */
  disabledReason: string | null;
  /** The status-change preview line, or null before a choice is picked. */
  previewLine: string | null;
  /** True when the interactive form is replaced by a read-only view (the
   *  evidence author) — distinct from `postDisabled` (an observer still sees
   *  the form, just cannot post). */
  isReadOnlyView: boolean;
}

/** The draft + role inputs `planRespondToEvidenceForm` reads. Pure. */
export interface RespondToEvidenceFormPlanInput {
  viewerRole: RespondToEvidenceViewerRole;
  /** The currently selected choice, or null. */
  selectedChoice: EvidenceResponseChoice | null;
  /** The current clarification body for the selected choice (un-trimmed). */
  clarificationBody: string;
  /** The target's current applicability status, for the preview line. */
  currentApplicabilityStatus: ApplicabilityStatus;
  /** True while the host's `submit-argument` call is in flight. */
  isSubmitting: boolean;
}

/**
 * Decide what the `respond_to_evidence` form should render given its draft +
 * role. Pure data, no React — the component wires its render off this, and the
 * tests assert this matrix directly (mirrors EV-002's `planSourceChainPopover`).
 *
 * Role gates (design §9):
 *   - `evidence_author` → the interactive form is replaced by a read-only
 *     view; Post is not applicable.
 *   - `observer` → the form renders but Post is disabled with the join reason.
 *   - `participant` → the §5.1 clarification rule governs Post.
 */
export function planRespondToEvidenceForm(
  input: RespondToEvidenceFormPlanInput,
): RespondToEvidenceFormPlan {
  const {
    viewerRole,
    selectedChoice,
    clarificationBody,
    currentApplicabilityStatus,
    isSubmitting,
  } = input;

  const isAuthor = viewerRole === 'evidence_author';
  const isObserver = viewerRole === 'observer';

  // The author sees a read-only view, never the interactive form.
  if (isAuthor) {
    return {
      showsClarificationField: false,
      postDisabled: true,
      disabledReason: null,
      previewLine: null,
      isReadOnlyView: true,
    };
  }

  const showsClarificationField =
    selectedChoice != null && selectedChoice !== 'accept';

  const validation =
    selectedChoice != null
      ? validateEvidenceResponseDraft(selectedChoice, clarificationBody)
      : { isValid: false, blockingReason: null };

  const previewLine =
    selectedChoice != null
      ? composeApplicabilityPreviewLine(selectedChoice, currentApplicabilityStatus)
      : null;

  // Observer disable wins over the §5.1 rule — an observer cannot post at all.
  let disabledReason: string | null;
  if (isObserver) {
    disabledReason = OBSERVER_RESPONSE_DISABLED_REASON;
  } else if (selectedChoice == null) {
    disabledReason = PICK_A_RESPONSE_PROMPT;
  } else {
    disabledReason = validation.blockingReason;
  }

  const postDisabled =
    isObserver || isSubmitting || selectedChoice == null || !validation.isValid;

  return {
    showsClarificationField,
    postDisabled,
    // A disabled Post always carries a visible reason; an enabled Post has none.
    disabledReason: postDisabled ? disabledReason : null,
    previewLine,
    isReadOnlyView: false,
  };
}

/** One read-view field row — label above value, both as separate <Text>. */
function ReadField({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID: string;
}): ReactElement {
  return (
    <View style={styles.readField} testID={testID}>
      <Text style={styles.readFieldLabel}>{label}</Text>
      <Text style={styles.readFieldValue}>{value}</Text>
    </View>
  );
}

/**
 * The QOL-032 §E applicability read-view. Rendered inline here so the
 * read-only path works before the Inspect popout (QOL-032) ships. Shows the
 * status chip copy, the claimed applicability (QOL-036, "Not specified" when
 * absent — edge case 9), and the most-recent open dispute clarification.
 */
function ApplicabilityReadView({
  viewModel,
  testIDPrefix,
}: {
  viewModel: RespondToEvidenceViewModel;
  testIDPrefix: string;
}): ReactElement {
  const chip = summarizeApplicabilityChip(viewModel.currentApplicabilityStatus);
  const statusValue = chip.isVisible ? chip.label : APPLICABILITY_NOT_SPECIFIED;
  return (
    <View style={styles.readView} testID={`${testIDPrefix}-read-view`}>
      <Text style={styles.readHeading} accessibilityRole="header">
        {APPLICABILITY_READ_VIEW_HEADING}
      </Text>
      <ReadField
        label="Status"
        value={statusValue}
        testID={`${testIDPrefix}-read-status`}
      />
      <ReadField
        label={CLAIMED_APPLICABILITY_LABEL}
        value={viewModel.claimedApplicability ?? APPLICABILITY_NOT_SPECIFIED}
        testID={`${testIDPrefix}-read-claimed`}
      />
      <ReadField
        label={DISPUTED_APPLICABILITY_LABEL}
        value={viewModel.disputedApplicability ?? APPLICABILITY_NO_DISPUTE}
        testID={`${testIDPrefix}-read-disputed`}
      />
    </View>
  );
}

export function RespondToEvidenceForm({
  viewModel,
  viewerRole,
  onPost,
  requestSourceSeedBody,
  reduceMotion = false,
  isSubmitting = false,
  testIDPrefix = 'respond-to-evidence',
}: RespondToEvidenceFormProps): ReactElement {
  const [selectedChoice, setSelectedChoice] = useState<EvidenceResponseChoice | null>(
    null,
  );
  // Per-choice draft buffer (edge case 3): the clarification text for
  // non-accept choices is parked here, keyed by choice, so toggling to
  // `accept` and back does not destroy what the user typed.
  const [clarificationByChoice, setClarificationByChoice] = useState<
    Partial<Record<EvidenceResponseChoice, string>>
  >({});

  // Own-evidence + observer roles never see the interactive form.
  const isAuthor = viewerRole === 'evidence_author';
  const isObserver = viewerRole === 'observer';
  const isReadOnly = isAuthor || isObserver;

  const currentClarification =
    selectedChoice != null ? clarificationByChoice[selectedChoice] ?? '' : '';

  // All render decisions flow from the pure planner — the component never
  // re-derives gating logic, so the helper and the UI cannot drift.
  const plan = useMemo(
    () =>
      planRespondToEvidenceForm({
        viewerRole,
        selectedChoice,
        clarificationBody: currentClarification,
        currentApplicabilityStatus: viewModel.currentApplicabilityStatus,
        isSubmitting,
      }),
    [viewerRole, selectedChoice, currentClarification, viewModel.currentApplicabilityStatus, isSubmitting],
  );

  const selectChoice = useCallback(
    (choice: EvidenceResponseChoice) => {
      if (!reduceMotion) {
        // Animate the clarification field show/hide. Skipped under
        // reduce-motion — the field then snaps (design §10 edge case 15).
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setSelectedChoice(choice);
      // `request_source` seeds the clarification body from EV-002's preset the
      // first time it is selected (design §6.1). The user may edit it after.
      if (choice === 'request_source' && requestSourceSeedBody) {
        setClarificationByChoice((prev) =>
          prev.request_source === undefined
            ? { ...prev, request_source: requestSourceSeedBody }
            : prev,
        );
      }
    },
    [reduceMotion, requestSourceSeedBody],
  );

  const setClarification = useCallback(
    (text: string) => {
      if (selectedChoice == null) return;
      setClarificationByChoice((prev) => ({ ...prev, [selectedChoice]: text }));
    },
    [selectedChoice],
  );

  const handlePost = useCallback(() => {
    if (plan.postDisabled || selectedChoice == null) return;
    onPost({
      evidenceArtifactId: viewModel.evidenceArtifactId,
      choice: selectedChoice,
      clarificationBody:
        selectedChoice === 'accept' ? '' : currentClarification.trim(),
    });
  }, [
    plan.postDisabled,
    selectedChoice,
    onPost,
    viewModel.evidenceArtifactId,
    currentClarification,
  ]);

  // ── Own-evidence read-only path (design §9) ──
  if (isAuthor) {
    return (
      <View style={styles.container} testID={`${testIDPrefix}-form`}>
        <Text style={styles.ownEvidenceNotice} testID={`${testIDPrefix}-own-notice`}>
          {OWN_EVIDENCE_NOTICE}
        </Text>
        <ApplicabilityReadView viewModel={viewModel} testIDPrefix={testIDPrefix} />
      </View>
    );
  }

  return (
    <View style={styles.container} testID={`${testIDPrefix}-form`}>
      {/* The applicability read-view — always shown so both parties see the
          claimed vs disputed applicability (storyboard Step 7). */}
      <ApplicabilityReadView viewModel={viewModel} testIDPrefix={testIDPrefix} />

      {/* The seven-choice radio group. */}
      <View
        accessibilityRole="radiogroup"
        style={styles.choiceGroup}
        testID={`${testIDPrefix}-choice-group`}
      >
        <ScrollView
          style={styles.choiceScroll}
          contentContainerStyle={styles.choiceList}
        >
          {EVIDENCE_RESPONSE_CHOICES.map((descriptor) => {
            const selected = selectedChoice === descriptor.choice;
            return (
              <Pressable
                key={descriptor.choice}
                onPress={() => selectChoice(descriptor.choice)}
                disabled={isObserver}
                accessibilityRole="radio"
                accessibilityLabel={descriptor.label}
                accessibilityHint={descriptor.helper}
                accessibilityState={{ selected, disabled: isObserver }}
                hitSlop={HIT_SLOP}
                style={[styles.choiceRow, selected && styles.choiceRowSelected]}
                testID={`${testIDPrefix}-choice-${descriptor.choice}`}
              >
                <View style={styles.choiceMark}>
                  <Text style={styles.choiceMarkText}>{selected ? '●' : '○'}</Text>
                </View>
                <View style={styles.choiceTextBlock}>
                  <Text style={styles.choiceLabel} numberOfLines={1}>
                    {descriptor.label}
                  </Text>
                  <Text style={styles.choiceHelper} numberOfLines={2}>
                    {descriptor.helper}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Conditional required clarification field — hidden for `accept`. */}
      {plan.showsClarificationField ? (
        <View style={styles.clarificationBlock} testID={`${testIDPrefix}-clarification-block`}>
          <Text style={styles.clarificationLabel}>{CLARIFICATION_FIELD_LABEL}</Text>
          <TextInput
            value={currentClarification}
            onChangeText={setClarification}
            multiline
            editable={!isReadOnly && !isSubmitting}
            accessibilityLabel={CLARIFICATION_FIELD_LABEL}
            placeholder={CLARIFICATION_FIELD_PLACEHOLDER}
            placeholderTextColor="#64748b"
            style={styles.clarificationInput}
            testID={`${testIDPrefix}-clarification-input`}
          />
        </View>
      ) : null}

      {/* Status-change preview line. */}
      {plan.previewLine ? (
        <Text style={styles.previewLine} testID={`${testIDPrefix}-preview`}>
          {plan.previewLine}
        </Text>
      ) : null}

      {/* The disabled-Post reason — always visible, never a silent no-op. */}
      {plan.postDisabled && plan.disabledReason ? (
        <Text
          accessibilityLiveRegion="polite"
          style={styles.disabledReason}
          testID={`${testIDPrefix}-disabled-reason`}
        >
          {plan.disabledReason}
        </Text>
      ) : null}

      {/* Post. */}
      <Pressable
        onPress={handlePost}
        disabled={plan.postDisabled}
        accessibilityRole="button"
        accessibilityLabel="Post response"
        accessibilityState={{ disabled: plan.postDisabled, busy: isSubmitting }}
        hitSlop={HIT_SLOP}
        style={[styles.postBtn, plan.postDisabled && styles.postBtnDisabled]}
        testID={`${testIDPrefix}-post`}
      >
        <Text style={styles.postText}>{isSubmitting ? 'Posting…' : 'Post'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  // Read-view.
  readView: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  readHeading: { color: '#f8fafc', fontSize: 13, fontWeight: '800' },
  readField: { gap: 1 },
  readFieldLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '700' },
  readFieldValue: { color: '#e2e8f0', fontSize: 12, lineHeight: 16 },
  // Choice group.
  choiceGroup: { gap: 4 },
  choiceScroll: { maxHeight: 300 },
  choiceList: { gap: 6, paddingVertical: 2 },
  choiceRow: {
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
  choiceRowSelected: { borderColor: '#38bdf8', backgroundColor: '#0c2942' },
  choiceMark: { width: 18, alignItems: 'center', paddingTop: 1 },
  choiceMarkText: { color: '#7dd3fc', fontSize: 13, fontWeight: '800' },
  choiceTextBlock: { flex: 1, gap: 2 },
  choiceLabel: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  choiceHelper: { color: '#94a3b8', fontSize: 11, lineHeight: 15 },
  // Clarification field.
  clarificationBlock: { gap: 4 },
  clarificationLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  clarificationInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  // Preview + disabled reason.
  previewLine: { color: '#bae6fd', fontSize: 11, fontWeight: '600' },
  disabledReason: { color: '#fca5a5', fontSize: 12, fontWeight: '600' },
  // Post.
  postBtn: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#0c4a6e',
  },
  postBtnDisabled: { opacity: 0.5 },
  postText: { color: '#f8fafc', fontSize: 13, fontWeight: '800' },
  // Own-evidence notice.
  ownEvidenceNotice: { color: '#cbd5e1', fontSize: 12, fontStyle: 'italic' },
});
