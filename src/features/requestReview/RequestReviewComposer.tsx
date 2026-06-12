/**
 * REF-005 — RequestReviewComposer.
 *
 * The 3-step structured "Request review / Mark concern" composer overlay
 * (target quote → concern type → remedy). Presentational only: it consumes
 * the pure model (`requestReviewModel`) + RN primitives and emits
 * `onRouteToActEntry` / `onSendForModeratorReview` / `onCancel`. It owns NO
 * persistence, calls NO Supabase / fetch / AI, and NEVER hides, deletes, or
 * mutates any content.
 *
 * Doctrine surfaces (cdiscourse-doctrine §10a / §1):
 *   - It is shown ONLY on the actor's own composer surface; the host mounts
 *     it as a sibling overlay and never renders it on a target's node.
 *   - Person-directed concern types derive `moderator_visible`, never
 *     `public_after_review`. The live visibility readout reflects that; there
 *     is no UI affordance to mark a concern public.
 *   - Concern types are BOUNDED chips — there is NO free-text concern field,
 *     so a user cannot author a person-verdict characterization.
 *   - Moderator-queue remedies show "Nothing hides automatically." — a human
 *     moderator decides; the composer fires no hide path.
 *
 * Reduce-motion: there is no entrance / transition animation (the overlay
 * renders in place), so the §6.3 reduce-motion requirement is honored by
 * construction. Step transitions are announced via `announceForAccessibility`
 * (an SR announcement, not motion).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ActEntryId } from '../arguments/oneBox/actPopoutModel';
import {
  ALL_REVIEW_CONCERN_TYPES,
  ALL_REVIEW_REQUESTED_REMEDIES,
  CONCERN_TYPE_DESCRIPTIONS,
  CONCERN_TYPE_LABELS,
  REMEDY_LABELS,
  buildSubmittableConcern,
  canSubmitConcern,
  deriveConcernVisibility,
  routeRemedy,
  type ReviewConcernType,
  type ReviewRequestedRemedy,
  type StructuredConcernDraft,
} from './requestReviewModel';

// ── Authored copy (ban-scanned by requestReviewCopyBanList.test.ts) ─

/**
 * Every authored, user-facing string in this component. Kept as a flat
 * `Record<string, string>` so the ban-list test can iterate it directly (the
 * `CONCESSION_LIST_SECTION_COPY` / `FIST_BUMP_COPY` precedent). No verdict
 * token, no amplification token, no raw snake_case appears here.
 */
export const REQUEST_REVIEW_COMPOSER_COPY: Readonly<Record<string, string>> = Object.freeze({
  title: 'Request review',
  intro: 'Mark a concern about this move. Every concern is the same three steps.',
  step1Header: 'Step 1 of 3: quote the passage',
  step2Header: 'Step 2 of 3: choose a concern type',
  step3Header: 'Step 3 of 3: choose what you are asking for',
  quoteLabel: 'Quote the exact passage you are concerned about',
  quotePlaceholder: 'Paste or trim to the exact passage',
  quoteEmptyError: 'Add the exact passage before continuing.',
  step2Locked: 'Add a quote above to choose a concern type.',
  step3Locked: 'Choose a concern type above to choose what you are asking for.',
  visibilityHeader: 'Who sees this',
  readoutModeratorVisible: 'Only a moderator will see this until it is reviewed.',
  readoutModeratorHide: 'A moderator will decide whether to hide this. Nothing hides automatically.',
  readoutComposerOnly: 'This stays on your screen and opens a move.',
  submitLabel: 'Send concern',
  submitAccessibilityLabel: 'Send this concern',
  cancelLabel: 'Cancel',
  cancelAccessibilityLabel: 'Cancel and discard this concern',
  step2Announce: 'Step 2 of 3: choose a concern type.',
  step3Announce: 'Step 3 of 3: choose what you are asking for.',
});

// ── Props ──────────────────────────────────────────────────────────

export interface RequestReviewComposerProps {
  /** When false, the overlay renders nothing. */
  visible: boolean;
  /** The id of the move the concern is about. */
  targetNodeId: string;
  /** Optional seed for the quote field (the target move body / excerpt). */
  initialQuote?: string;
  /** Claim-level remedy → the host calls `enterBoxForActEntry(actEntryId)`. */
  onRouteToActEntry: (actEntryId: ActEntryId) => void;
  /** Moderator-queue remedy → the host calls the existing review callback. */
  onSendForModeratorReview: (draft: StructuredConcernDraft) => void;
  /** Cancel / dismiss the composer at any step. */
  onCancel: () => void;
  testID?: string;
}

// ── Component ──────────────────────────────────────────────────────

export function RequestReviewComposer(props: RequestReviewComposerProps) {
  const { visible, targetNodeId, initialQuote, onRouteToActEntry, onSendForModeratorReview, onCancel } =
    props;
  const testID = props.testID ?? 'request-review-composer';

  const [quote, setQuote] = useState<string>(initialQuote ?? '');
  const [concernType, setConcernType] = useState<ReviewConcernType | null>(null);
  const [remedy, setRemedy] = useState<ReviewRequestedRemedy | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const quoteFilled = quote.trim().length > 0;
  const currentStep: 1 | 2 | 3 = !quoteFilled ? 1 : concernType === null ? 2 : 3;

  // Announce step transitions to assistive tech (not motion).
  useEffect(() => {
    if (!visible) return;
    if (currentStep === 2) {
      AccessibilityInfo.announceForAccessibility(REQUEST_REVIEW_COMPOSER_COPY.step2Announce);
    } else if (currentStep === 3) {
      AccessibilityInfo.announceForAccessibility(REQUEST_REVIEW_COMPOSER_COPY.step3Announce);
    }
  }, [visible, currentStep]);

  const draft: Partial<StructuredConcernDraft> = useMemo(
    () => ({
      targetNodeId,
      targetQuote: quote,
      concernType: concernType ?? undefined,
      requestedRemedy: remedy ?? undefined,
    }),
    [targetNodeId, quote, concernType, remedy],
  );

  const submittable = canSubmitConcern(draft) && !submitted;

  // Live visibility derivation — never free-set; never `public_after_review`.
  const visibility =
    concernType !== null && remedy !== null
      ? deriveConcernVisibility(concernType, remedy)
      : null;
  const visibilityReadout = useMemo(() => {
    if (concernType === null || remedy === null || visibility === null) return null;
    if (visibility === 'composer_only') {
      return REQUEST_REVIEW_COMPOSER_COPY.readoutComposerOnly;
    }
    // moderator_visible
    const routing = routeRemedy(remedy);
    if (routing.kind === 'moderator_queue' && routing.queueAction === 'hide_pending_review') {
      return `${REQUEST_REVIEW_COMPOSER_COPY.readoutModeratorVisible} ${REQUEST_REVIEW_COMPOSER_COPY.readoutModeratorHide}`;
    }
    return REQUEST_REVIEW_COMPOSER_COPY.readoutModeratorVisible;
  }, [concernType, remedy, visibility]);

  const handleSubmit = useCallback(() => {
    if (submitted) return;
    const finalized = buildSubmittableConcern(draft);
    if (finalized === null) return;
    setSubmitted(true);
    const routing = routeRemedy(finalized.requestedRemedy);
    if (routing.kind === 'act_entry') {
      onRouteToActEntry(routing.actEntryId);
    } else {
      onSendForModeratorReview(finalized);
    }
  }, [submitted, draft, onRouteToActEntry, onSendForModeratorReview]);

  if (!visible) return null;

  return (
    <View
      style={styles.overlay}
      accessibilityLabel={REQUEST_REVIEW_COMPOSER_COPY.title}
      accessibilityViewIsModal
      testID={testID}
    >
      <ScrollView
        style={styles.panel}
        contentContainerStyle={styles.panelContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title} testID={`${testID}-title`}>
          {REQUEST_REVIEW_COMPOSER_COPY.title}
        </Text>
        <Text style={styles.intro}>{REQUEST_REVIEW_COMPOSER_COPY.intro}</Text>

        {/* ── Step 1 — Quote ── */}
        <Text style={styles.stepHeader} accessibilityRole="header">
          {REQUEST_REVIEW_COMPOSER_COPY.step1Header}
        </Text>
        <TextInput
          style={styles.quoteInput}
          value={quote}
          onChangeText={setQuote}
          placeholder={REQUEST_REVIEW_COMPOSER_COPY.quotePlaceholder}
          placeholderTextColor="#64748b"
          multiline
          accessibilityLabel={REQUEST_REVIEW_COMPOSER_COPY.quoteLabel}
          editable={!submitted}
          testID={`${testID}-quote-input`}
        />
        {!quoteFilled ? (
          <Text
            style={styles.error}
            accessibilityLiveRegion="polite"
            testID={`${testID}-quote-error`}
          >
            {REQUEST_REVIEW_COMPOSER_COPY.quoteEmptyError}
          </Text>
        ) : null}

        {/* ── Step 2 — Concern type ── */}
        <Text style={styles.stepHeader} accessibilityRole="header">
          {REQUEST_REVIEW_COMPOSER_COPY.step2Header}
        </Text>
        {!quoteFilled ? (
          <Text style={styles.locked} testID={`${testID}-step2-locked`}>
            {REQUEST_REVIEW_COMPOSER_COPY.step2Locked}
          </Text>
        ) : (
          <View style={styles.chipWrap} accessibilityRole="radiogroup">
            {ALL_REVIEW_CONCERN_TYPES.map((type) => {
              const checked = concernType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => !submitted && setConcernType(type)}
                  style={[styles.chip, checked && styles.chipChecked]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked, disabled: submitted }}
                  accessibilityLabel={CONCERN_TYPE_LABELS[type]}
                  accessibilityHint={CONCERN_TYPE_DESCRIPTIONS[type]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  disabled={submitted}
                  testID={`${testID}-concern-${type}`}
                >
                  <Text style={styles.chipGlyph}>{checked ? '✓ ' : '• '}</Text>
                  <Text style={[styles.chipText, checked && styles.chipTextChecked]}>
                    {CONCERN_TYPE_LABELS[type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {quoteFilled && concernType !== null ? (
          <Text style={styles.chipDesc} testID={`${testID}-concern-desc`}>
            {CONCERN_TYPE_DESCRIPTIONS[concernType]}
          </Text>
        ) : null}

        {/* ── Step 3 — Remedy ── */}
        <Text style={styles.stepHeader} accessibilityRole="header">
          {REQUEST_REVIEW_COMPOSER_COPY.step3Header}
        </Text>
        {concernType === null ? (
          <Text style={styles.locked} testID={`${testID}-step3-locked`}>
            {REQUEST_REVIEW_COMPOSER_COPY.step3Locked}
          </Text>
        ) : (
          <View style={styles.chipWrap} accessibilityRole="radiogroup">
            {ALL_REVIEW_REQUESTED_REMEDIES.map((r) => {
              const checked = remedy === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => !submitted && setRemedy(r)}
                  style={[styles.chip, checked && styles.chipChecked]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked, disabled: submitted }}
                  accessibilityLabel={REMEDY_LABELS[r]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  disabled={submitted}
                  testID={`${testID}-remedy-${r}`}
                >
                  <Text style={styles.chipGlyph}>{checked ? '✓ ' : '• '}</Text>
                  <Text style={[styles.chipText, checked && styles.chipTextChecked]}>
                    {REMEDY_LABELS[r]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Visibility readout (live, derived) ── */}
        {visibilityReadout !== null ? (
          <View style={styles.readoutBox} testID={`${testID}-visibility-readout`}>
            <Text style={styles.readoutHeader} accessibilityRole="header">
              {REQUEST_REVIEW_COMPOSER_COPY.visibilityHeader}
            </Text>
            <Text
              style={styles.readoutText}
              accessibilityLiveRegion="polite"
              testID={`${testID}-visibility-text`}
            >
              {visibilityReadout}
            </Text>
          </View>
        ) : null}

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            style={styles.cancelBtn}
            accessibilityRole="button"
            accessibilityLabel={REQUEST_REVIEW_COMPOSER_COPY.cancelAccessibilityLabel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID={`${testID}-cancel`}
          >
            <Text style={styles.cancelText}>{REQUEST_REVIEW_COMPOSER_COPY.cancelLabel}</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            style={[styles.submitBtn, !submittable && styles.submitBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={REQUEST_REVIEW_COMPOSER_COPY.submitAccessibilityLabel}
            accessibilityState={{ disabled: !submittable }}
            disabled={!submittable}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID={`${testID}-submit`}
          >
            <Text style={styles.submitText}>{REQUEST_REVIEW_COMPOSER_COPY.submitLabel}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2,6,23,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    zIndex: 50,
  },
  panel: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    backgroundColor: '#0b1220',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  panelContent: { padding: 16, gap: 8 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  intro: { color: '#cbd5e1', fontSize: 13, lineHeight: 18 },
  stepHeader: { color: '#e2e8f0', fontSize: 14, fontWeight: '700', marginTop: 10 },
  quoteInput: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  error: { color: '#fca5a5', fontSize: 12, marginTop: 2 },
  locked: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#475569',
    backgroundColor: '#0f172a',
  },
  chipChecked: { borderColor: '#38bdf8', borderWidth: 2.5, backgroundColor: '#0c4a6e' },
  chipGlyph: { color: '#e2e8f0', fontSize: 13, fontWeight: '800' },
  chipText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  chipTextChecked: { color: '#f0f9ff', fontWeight: '800' },
  chipDesc: { color: '#94a3b8', fontSize: 12, marginTop: 6, lineHeight: 17 },
  readoutBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  readoutHeader: { color: '#e2e8f0', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  readoutText: { color: '#cbd5e1', fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  cancelBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: '#e2e8f0', fontSize: 14, fontWeight: '700' },
  submitBtn: {
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#1e293b', opacity: 0.7 },
  submitText: { color: '#f8fafc', fontSize: 14, fontWeight: '800' },
});
