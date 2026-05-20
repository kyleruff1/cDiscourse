/**
 * RULE-004 — Pause-before-send move review sheet.
 *
 * A thin presentational overlay shown by `ArgumentComposerDock` on the
 * Post intent when `buildPreSendReview` returns `shouldShowSheet: true`.
 * It renders a scrim + a panel above the composer body (NOT a second RN
 * <Modal> — nested modals are fragile on native; this is a
 * `position: absolute` overlay so the composer stays mounted behind it
 * and the draft is never lost).
 *
 * Doctrine (RULE-004 design §4.3 / §12):
 *  - The sheet NEVER blocks a post. "Post anyway" is always present
 *    UNLESS `review.hasStructuralBlock` is true — and that block is the
 *    Constitution engine's pre-existing structural validation, never a
 *    RULE-004 invention. RULE-004 adds zero blocking rules.
 *  - Advisories are info / soft only; the copy is non-punitive.
 *  - Every interactive element exposes role + label + a ≥ 44×44 target.
 *  - Reduce-motion: the sheet snaps (no slide / fade) when
 *    `reduceMotionOverride` is true.
 *  - Structural-block vs advisory sections are distinguishable by text /
 *    shape (separate headings + a leading marker glyph), not color alone.
 *
 * Pure-helper discipline: the sheet's load-bearing decisions are
 * extracted into exported pure helpers (mirrors `ChannelChipRow.tsx`)
 * so `__tests__/preSendReviewSheetUi.test.tsx` can exercise them without
 * an RN renderer.
 */
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  PRESEND_SHEET_COPY,
} from './gameCopy';
import {
  advisoryDefinition,
  type AdvisoryKind,
  type AdvisorySeverity,
  type AdvisoryTransformation,
  type PreSendAdvisory,
  type PreSendReview,
  type ReviewMode,
} from './preSendReviewModel';

// ── Pure helpers (exported for the UI test suite) ──────────────

/** Frozen hit-slop that lifts a small visual to a ≥ 44×44 tap target. */
export const PRESEND_HIT_SLOP = Object.freeze({
  top: 12,
  bottom: 12,
  left: 12,
  right: 12,
});

/**
 * Minimum visual height (logical px) of every sheet Pressable. With
 * `PRESEND_HIT_SLOP` the effective target is comfortably ≥ 44×44.
 */
export const PRESEND_MIN_TARGET = 44;

/**
 * "Post anyway" is visible IFF the review has NO structural block. A
 * structural block is the engine's pre-existing block — the user must
 * "Back to editing" to clear it; RULE-004 never lets a user bypass an
 * EXISTING structural block (it only ever lets them bypass an advisory).
 */
export function isPostAnywayVisible(review: PreSendReview): boolean {
  return review.hasStructuralBlock === false;
}

/** "Save draft" is always available — it never depends on block state. */
export function isSaveDraftVisible(): boolean {
  return true;
}

/**
 * Maps an `AdvisoryTransformation` to its plain-language button label.
 * READ from `PRESEND_SHEET_COPY` — never authored here.
 */
export function transformationButtonLabel(t: AdvisoryTransformation): string {
  switch (t) {
    case 'narrow':
      return PRESEND_SHEET_COPY.transformation_narrow;
    case 'branch_tangent':
      return PRESEND_SHEET_COPY.transformation_branch_tangent;
    case 'ask_source':
      return PRESEND_SHEET_COPY.transformation_ask_source;
    case 'add_quote':
      return PRESEND_SHEET_COPY.transformation_add_quote;
    case 'add_evidence':
      return PRESEND_SHEET_COPY.transformation_add_evidence;
    case 'save_draft':
      return PRESEND_SHEET_COPY.transformation_save_draft;
    case 'post_anyway':
      return PRESEND_SHEET_COPY.transformation_post_anyway;
    default:
      return PRESEND_SHEET_COPY.transformation_post_anyway;
  }
}

/**
 * Builds the screen-reader label for an advisory card. Verbose on
 * purpose — a screen-reader user gets one read per element. Severity is
 * spoken as a word so the info / soft distinction is not color-only.
 */
export function buildAdvisoryAccessibilityLabel(
  advisory: PreSendAdvisory,
): string {
  const severityWord =
    advisory.severity === 'soft' ? 'Worth a look' : 'Heads up';
  return `${severityWord}. ${advisory.plainLanguage}`;
}

/**
 * Strict-mode gating: in `strict` mode every `soft` advisory must be
 * explicitly dismissed before "Post anyway" enables. In `casual` mode
 * (v1, always) nothing gates "Post anyway". This is the ONLY behavioural
 * difference between the modes (RULE-004 design §4.5). The strict branch
 * is fully specified + tested but inert in v1 because the dock always
 * passes `mode: 'casual'` (OD-1).
 *
 * Returns true when "Post anyway" should be ENABLED.
 */
export function isPostAnywayEnabled(
  review: PreSendReview,
  mode: ReviewMode,
  dismissedKinds: ReadonlySet<AdvisoryKind>,
): boolean {
  // A structural block always disables the post regardless of mode —
  // but in that case "Post anyway" is HIDDEN, not merely disabled.
  if (review.hasStructuralBlock) return false;
  if (mode !== 'strict') return true;
  // Strict: every soft advisory must be dismissed first.
  for (const advisory of review.advisories) {
    if (advisory.severity === 'soft' && !dismissedKinds.has(advisory.kind)) {
      return false;
    }
  }
  return true;
}

/**
 * The non-`post_anyway` transformations for an advisory — the actionable
 * suggestions. `post_anyway` is the sheet-level button, not a per-card
 * action, so the card itself only renders the actionable ones.
 */
export function actionableTransformations(
  kind: AdvisoryKind,
): ReadonlyArray<AdvisoryTransformation> {
  return advisoryDefinition(kind).suggested.filter((t) => t !== 'post_anyway');
}

// ── Component ──────────────────────────────────────────────────

export interface PreSendReviewSheetProps {
  visible: boolean;
  review: PreSendReview;
  /** Apply a transformation preset (maps via transformationToQuickAction). */
  onApplyTransformation: (t: AdvisoryTransformation) => void;
  /**
   * "Post anyway" — bypasses the review for this one post. Hidden if
   * `review.hasStructuralBlock`.
   */
  onPostAnyway: () => void;
  /** "Save draft" — always present. */
  onSaveDraft: () => void;
  /** "Back to editing" — closes the sheet, keeps the draft. */
  onBackToEditing: () => void;
  /** PR-001 effective reduce-motion (the dock already threads this). */
  reduceMotionOverride?: boolean;
  /** v1: always 'casual'. Drives strict-mode per-advisory dismiss (inert v1). */
  mode: ReviewMode;
  /**
   * Strict-mode (GAME-003, inert in v1) — kinds the user has explicitly
   * dismissed via the per-card "Got it" tap. Casual mode ignores this.
   */
  dismissedKinds?: ReadonlySet<AdvisoryKind>;
  /** Strict-mode dismiss handler (inert in v1). */
  onDismissAdvisory?: (kind: AdvisoryKind) => void;
}

const EMPTY_DISMISSED: ReadonlySet<AdvisoryKind> = new Set<AdvisoryKind>();

export function PreSendReviewSheet({
  visible,
  review,
  onApplyTransformation,
  onPostAnyway,
  onSaveDraft,
  onBackToEditing,
  mode,
  dismissedKinds,
  onDismissAdvisory,
}: PreSendReviewSheetProps) {
  const effectiveDismissed = dismissedKinds ?? EMPTY_DISMISSED;
  const postAnywayVisible = isPostAnywayVisible(review);
  const postAnywayEnabled = useMemo(
    () => isPostAnywayEnabled(review, mode, effectiveDismissed),
    [review, mode, effectiveDismissed],
  );

  if (!visible) return null;

  return (
    <View
      style={styles.overlay}
      accessibilityViewIsModal
      testID="pre-send-review-sheet"
    >
      {/* Inert scrim — tapping it does NOT close the sheet (Back to
          editing / Post anyway / Save draft are the deliberate paths). */}
      <Pressable
        style={styles.scrim}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onPress={() => undefined}
      />

      <View
        style={styles.panel}
        accessibilityViewIsModal
        accessibilityLabel={PRESEND_SHEET_COPY.header}
        testID="pre-send-review-panel"
      >
        <Text style={styles.header} accessibilityRole="header">
          {PRESEND_SHEET_COPY.header}
        </Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Structural blocks — the engine's pre-existing block, shown
              honestly. A leading "!" glyph + a distinct heading carry
              the meaning without relying on color. */}
          {review.structuralBlocks.length > 0 && (
            <View style={styles.section} testID="pre-send-blocks-section">
              <Text style={styles.blocksHeading}>
                {PRESEND_SHEET_COPY.blocksHeading}
              </Text>
              {review.structuralBlocks.map((block, idx) => (
                <View
                  key={`block-${block.kind}-${idx}`}
                  style={styles.blockCard}
                  testID={`pre-send-block-${block.kind}`}
                >
                  <Text style={styles.blockGlyph}>{'!'}</Text>
                  <Text style={styles.blockText}>{block.plainLanguage}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Advisories — info / soft cards. A leading "•" marker + the
              spoken severity word keep the section distinguishable from
              the blocks section without color. */}
          {review.advisories.length > 0 && (
            <View style={styles.section} testID="pre-send-advisories-section">
              <Text style={styles.advisoriesHeading}>
                {PRESEND_SHEET_COPY.advisoriesHeading}
              </Text>
              {review.advisories.map((advisory, idx) => {
                const dismissed = effectiveDismissed.has(advisory.kind);
                return (
                  <View
                    key={`advisory-${advisory.kind}-${idx}`}
                    style={styles.advisoryCard}
                    accessibilityLabel={buildAdvisoryAccessibilityLabel(advisory)}
                    testID={`pre-send-advisory-${advisory.kind}`}
                  >
                    <View style={styles.advisoryHeaderRow}>
                      <Text style={styles.advisoryGlyph}>{'•'}</Text>
                      <Text style={styles.advisoryText}>
                        {advisory.plainLanguage}
                      </Text>
                    </View>

                    {/* Actionable transformations — never `post_anyway`. */}
                    <View style={styles.transformationRow}>
                      {actionableTransformations(advisory.kind).map((t) => (
                        <Pressable
                          key={`${advisory.kind}-${t}`}
                          style={styles.transformationButton}
                          onPress={() => onApplyTransformation(t)}
                          accessibilityRole="button"
                          accessibilityLabel={transformationButtonLabel(t)}
                          hitSlop={PRESEND_HIT_SLOP}
                          testID={`pre-send-transformation-${advisory.kind}-${t}`}
                        >
                          <Text style={styles.transformationButtonText}>
                            {transformationButtonLabel(t)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {/* Strict-mode per-advisory dismiss (GAME-003, inert
                        in v1 — the dock always passes mode: 'casual'). */}
                    {mode === 'strict' &&
                    advisory.severity === 'soft' &&
                    onDismissAdvisory ? (
                      <Pressable
                        style={styles.dismissButton}
                        onPress={() => onDismissAdvisory(advisory.kind)}
                        accessibilityRole="button"
                        accessibilityLabel={`Got it — ${advisory.plainLanguage}`}
                        accessibilityState={{ selected: dismissed }}
                        hitSlop={PRESEND_HIT_SLOP}
                        testID={`pre-send-dismiss-${advisory.kind}`}
                      >
                        <Text style={styles.dismissButtonText}>
                          {dismissed ? 'Got it ✓' : 'Got it'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Footer actions. "Post anyway" is hidden when a structural
            block is present (the engine genuinely blocks the post). */}
        <View style={styles.footer}>
          <Pressable
            style={styles.secondaryButton}
            onPress={onBackToEditing}
            accessibilityRole="button"
            accessibilityLabel={PRESEND_SHEET_COPY.backToEditing}
            hitSlop={PRESEND_HIT_SLOP}
            testID="pre-send-back-to-editing"
          >
            <Text style={styles.secondaryButtonText}>
              {PRESEND_SHEET_COPY.backToEditing}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={onSaveDraft}
            accessibilityRole="button"
            accessibilityLabel={PRESEND_SHEET_COPY.saveDraft}
            hitSlop={PRESEND_HIT_SLOP}
            testID="pre-send-save-draft"
          >
            <Text style={styles.secondaryButtonText}>
              {PRESEND_SHEET_COPY.saveDraft}
            </Text>
          </Pressable>

          {postAnywayVisible ? (
            <Pressable
              style={[
                styles.primaryButton,
                !postAnywayEnabled && styles.primaryButtonDisabled,
              ]}
              onPress={onPostAnyway}
              disabled={!postAnywayEnabled}
              accessibilityRole="button"
              accessibilityLabel={PRESEND_SHEET_COPY.postAnyway}
              accessibilityState={{ disabled: !postAnywayEnabled }}
              hitSlop={PRESEND_HIT_SLOP}
              testID="pre-send-post-anyway"
            >
              <Text style={styles.primaryButtonText}>
                {PRESEND_SHEET_COPY.postAnyway}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// Severity is also indicated by the spoken accessibility label + glyph;
// `severityForKind` is exported so a future card can colour-code without
// re-deriving. Not used for any blocking decision.
export function severityForKind(advisory: PreSendAdvisory): AdvisorySeverity {
  return advisory.severity;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.55)',
  },
  panel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: '80%',
    paddingTop: 16,
  },
  header: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  section: {
    marginBottom: 14,
  },
  blocksHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  blockCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  blockGlyph: {
    fontSize: 14,
    fontWeight: '800',
    color: '#b91c1c',
    marginRight: 8,
    lineHeight: 20,
  },
  blockText: {
    flex: 1,
    fontSize: 13,
    color: '#7f1d1d',
    lineHeight: 20,
  },
  advisoriesHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  advisoryCard: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  advisoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  advisoryGlyph: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
    marginRight: 8,
    lineHeight: 20,
  },
  advisoryText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  transformationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  transformationButton: {
    minHeight: PRESEND_MIN_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
  },
  transformationButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338ca',
  },
  dismissButton: {
    minHeight: PRESEND_MIN_TARGET,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  dismissButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  secondaryButton: {
    minHeight: PRESEND_MIN_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  primaryButton: {
    minHeight: PRESEND_MIN_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#4338ca',
  },
  primaryButtonDisabled: {
    backgroundColor: '#a5b4fc',
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
