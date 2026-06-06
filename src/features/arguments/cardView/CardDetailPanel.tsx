/**
 * CARD-VIEW-DATA-001 — CardDetailPanel.
 *
 * The exploded Inspect detail rendered inline on the ACTIVE card, visible
 * BY DEFAULT (no tap). Non-active stacked cards never mount this panel.
 *
 * Affordance contract (card §1 / accessibility-targets):
 *   - The ONLY interactive affordance in this panel is the step-reference
 *     parent token (a real `Pressable` button inside `CardStepReferenceHeader`
 *     → jumps to the parent). Everything else — category / qualifier /
 *     classifier / evidence / standing / lifecycle / semantic-flag — is a
 *     DISPLAY-ONLY LABEL, never a pressable/outlined box.
 *   - Classifier observations render with confidence as PIPS (filled dots),
 *     never a raw number. Color is not the only signal — filled vs empty
 *     dots differ in fill AND border.
 *
 * Doctrine:
 *   - Machine observations are advisory, never verdicts ("What the referee
 *     noticed — advisory, not a verdict.").
 *   - Never renders `inactive_reason` or any "why hidden" copy (the model
 *     never carries it).
 *   - Plain language only; the model has already suppressed unknown codes.
 *
 * Reduce-motion safe: no animation (the panel is always-on, nothing toggles).
 * Pure presentational; no network, no AI, no state.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BORDER_WIDTH,
  RADIUS,
  SPACING,
  SURFACE_TOKENS,
  TYPOGRAPHY,
} from '../../../lib/designTokens';
import { CARD_CLASSIFIER_EVIDENCE_PREFIX } from './cardClassifierStripModel';
import { CardStepReferenceHeader } from './CardStepReferenceHeader';
import type {
  CardClassifierChip,
  CardClassifierStripModel,
} from './cardClassifierStripModel';
import type { CardDetailViewModel } from './cardDetailModel';

export interface CardDetailPanelProps {
  model: CardDetailViewModel;
  /** Re-activates the step-reference ancestor message. */
  onActivateAncestor?: (messageId: string) => void;
  testID?: string;
}

/** Confidence PIPS — up to 3 dots, `pips` filled. Display-only. Color is
 *  not the only signal: filled dots carry a solid fill + border, empty dots
 *  are a hollow ring; the screen-reader label carries the plain word. */
function ConfidencePips({
  pips,
  label,
}: {
  pips: 1 | 2 | 3 | null;
  label: string | null;
}): React.ReactElement | null {
  if (pips == null) return null;
  return (
    <View
      style={styles.pipsRow}
      accessibilityLabel={label ?? undefined}
      testID="card-detail-classifier-pips"
    >
      {[1, 2, 3].map((slot) => {
        const filled = slot <= pips;
        return (
          <View
            key={slot}
            style={[styles.pip, filled ? styles.pipFilled : styles.pipEmpty]}
          />
        );
      })}
    </View>
  );
}

/** A single classifier observation rendered as a DISPLAY-ONLY label (no
 *  button role, no press). The evidence span — when present — is shown
 *  inline as a label, not behind a tap. */
function ClassifierLabel({ chip }: { chip: CardClassifierChip }): React.ReactElement {
  return (
    <View
      style={styles.classifierRow}
      accessibilityRole="text"
      accessibilityLabel={chip.accessibilityLabel}
      testID={`card-detail-classifier-${chip.id}`}
    >
      <View style={styles.classifierHead}>
        <Text
          style={styles.glyph}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          ◎
        </Text>
        <Text style={styles.classifierLabelText}>{chip.label}</Text>
        <ConfidencePips pips={chip.confidencePips} label={chip.confidenceLabel} />
      </View>
      {chip.evidenceSpan ? (
        <Text style={styles.classifierEvidence} testID={`card-detail-classifier-evidence-${chip.id}`}>
          {`${CARD_CLASSIFIER_EVIDENCE_PREFIX} ${chip.evidenceSpan}`}
        </Text>
      ) : null}
    </View>
  );
}

function ClassifierZone({ strip }: { strip: CardClassifierStripModel }): React.ReactElement {
  return (
    <View style={styles.zone} testID="card-detail-classifier-zone">
      <Text style={styles.zoneCaption} accessibilityRole="text">
        {strip.advisoryCaption}
      </Text>
      {strip.hasSignals ? (
        <>
          {strip.chips.map((chip) => (
            <ClassifierLabel key={chip.id} chip={chip} />
          ))}
          {strip.overflowCount > 0 ? (
            <Text style={styles.muted} testID="card-detail-classifier-overflow">
              {`+${strip.overflowCount} more on this move`}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.muted} testID="card-detail-classifier-empty">
          {strip.emptyStateCopy}
        </Text>
      )}
    </View>
  );
}

/** A small display-only label chip (no role, no press). */
function LabelChip({ text, testID }: { text: string; testID?: string }): React.ReactElement {
  return (
    <View style={styles.labelChip} testID={testID}>
      <Text style={styles.labelChipText}>{text}</Text>
    </View>
  );
}

/**
 * The exploded card detail panel. Render ONLY on the active card.
 */
export function CardDetailPanel({
  model,
  onActivateAncestor,
  testID,
}: CardDetailPanelProps): React.ReactElement {
  const { evidence } = model;
  return (
    <View style={styles.panel} testID={testID ?? 'card-detail-panel'}>
      {/* Zone 1 — step reference (the parent token is the only button). */}
      <CardStepReferenceHeader
        line={model.stepReference}
        onActivateAncestor={onActivateAncestor}
        testID="card-detail-step-reference"
      />

      {/* Zone 2 — category + qualifier labels. */}
      {(model.categoryLabel || model.qualifierLabels.length > 0) ? (
        <View style={styles.chipRow} testID="card-detail-category-zone">
          {model.categoryLabel ? (
            <LabelChip text={model.categoryLabel} testID="card-detail-category" />
          ) : null}
          {model.qualifierLabels.map((q, i) => (
            <LabelChip key={`${q}-${i}`} text={q} testID={`card-detail-qualifier-${i}`} />
          ))}
        </View>
      ) : null}

      {/* Zone 4 — classifier strip (Zone 3 body is rendered by the card). */}
      <ClassifierZone strip={model.classifierStrip} />

      {/* Zone 5 — evidence sources + debt summary. */}
      <View style={styles.zone} testID="card-detail-evidence-zone">
        <Text style={styles.zoneHeading} accessibilityRole="text">
          Evidence
        </Text>
        {evidence.hasSource ? (
          evidence.sources.map((s) => (
            <LabelChip key={s.id} text={s.label} testID={`card-detail-evidence-source-${s.id}`} />
          ))
        ) : (
          <Text style={styles.muted} testID="card-detail-evidence-empty">
            {evidence.emptyStateCopy}
          </Text>
        )}
        {evidence.debtSummary ? (
          <Text style={styles.bodyText} testID="card-detail-evidence-debt">
            {evidence.debtSummary}
          </Text>
        ) : null}
      </View>

      {/* Zone 6 — point standing (advisory label). */}
      {model.standingLabel ? (
        <View style={styles.zone} testID="card-detail-standing-zone">
          <Text style={styles.zoneHeading} accessibilityRole="text">
            Standing
          </Text>
          <Text style={styles.bodyText} testID="card-detail-standing">
            {model.standingLabel}
          </Text>
        </View>
      ) : null}

      {/* Zone 7 — lifecycle (plain-language label). */}
      {model.lifecycleLabel ? (
        <View style={styles.zone} testID="card-detail-lifecycle-zone">
          <Text style={styles.zoneHeading} accessibilityRole="text">
            Lifecycle
          </Text>
          <LabelChip text={model.lifecycleLabel} testID="card-detail-lifecycle" />
        </View>
      ) : null}

      {/* Zone 8 — semantic flags (display-only labels). */}
      {model.flagLabels.length > 0 ? (
        <View style={styles.zone} testID="card-detail-flags-zone">
          <Text style={styles.zoneHeading} accessibilityRole="text">
            Notes
          </Text>
          <View style={styles.chipRow}>
            {model.flagLabels.map((f, i) => (
              <LabelChip key={`${f}-${i}`} text={f} testID={`card-detail-flag-${i}`} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: SPACING.s,
    gap: SPACING.s,
  },
  zone: {
    gap: SPACING.xs,
  },
  zoneHeading: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  zoneCaption: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
    fontStyle: 'italic',
  },
  bodyText: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
  },
  muted: {
    color: SURFACE_TOKENS.textMuted,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  labelChip: {
    alignSelf: 'flex-start',
    backgroundColor: SURFACE_TOKENS.elevated,
    borderRadius: RADIUS.sm,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    paddingHorizontal: SPACING.s,
    paddingVertical: 2,
  },
  labelChipText: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: TYPOGRAPHY.chipLabel.fontWeight,
  },
  classifierRow: {
    gap: 2,
  },
  classifierHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  glyph: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 13,
    lineHeight: 16,
  },
  classifierLabelText: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: TYPOGRAPHY.chipLabel.fontWeight,
    flexShrink: 1,
  },
  classifierEvidence: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
    marginLeft: SPACING.l,
  },
  pipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: BORDER_WIDTH.sm,
  },
  pipFilled: {
    backgroundColor: SURFACE_TOKENS.textPrimary,
    borderColor: SURFACE_TOKENS.textPrimary,
  },
  pipEmpty: {
    backgroundColor: 'transparent',
    borderColor: SURFACE_TOKENS.textMuted,
  },
});
