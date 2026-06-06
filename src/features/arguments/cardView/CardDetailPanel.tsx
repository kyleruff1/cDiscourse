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
import type { CardClassifierChip } from './cardClassifierStripModel';
import type { CardDetailViewModel } from './cardDetailModel';
import type {
  DetailFullTagsModel,
  DetailParentQuoteSlice,
  DetailStandingToneHeatStrip,
  HubClassifierGroupsModel,
} from '../detail/argumentDetailModel';

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

/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 2, ask iii) — the all-families,
 * family-grouped, UNCAPPED classifier zone for the Cards hub. Display-only.
 *
 * The heading is NEUTRAL ("Classifier observations") — never "Add Classifier"
 * (that implies a mutation). The advisory caption stays "What the referee
 * noticed — advisory, not a verdict." Each group has a plain-language family
 * heading; chips keep confidence PIPS + evidence spans. Only A–G families
 * survive the model's explicit family gate, so H/I/J never render here.
 */
function HubClassifierZone({
  model,
}: {
  model: HubClassifierGroupsModel;
}): React.ReactElement {
  return (
    <View style={styles.zone} testID="card-detail-classifier-zone">
      <Text style={styles.zoneHeading} accessibilityRole="text">
        Classifier observations
      </Text>
      <Text style={styles.zoneCaption} accessibilityRole="text">
        {model.advisoryCaption}
      </Text>
      {model.hasSignals ? (
        model.groups.map((group) => (
          <View
            key={group.familyCode}
            style={styles.zone}
            testID={`card-detail-classifier-group-${group.familyCode}`}
          >
            <Text
              style={styles.classifierFamilyHeading}
              accessibilityRole="text"
              testID={`card-detail-classifier-family-${group.familyCode}`}
            >
              {group.familyLabel}
            </Text>
            {group.chips.map((chip) => (
              <ClassifierLabel key={chip.id} chip={chip} />
            ))}
          </View>
        ))
      ) : (
        <Text style={styles.muted} testID="card-detail-classifier-empty">
          {model.emptyStateCopy}
        </Text>
      )}
    </View>
  );
}

/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 2, ask i) — the italic replied-to parent
 * quote. Display-only. Graceful degrade: when the parent is unresolvable the
 * neutral placeholder renders — NEVER an invented quote, NEVER a
 * "hidden because…" reason.
 */
function ParentQuoteZone({
  slice,
}: {
  slice: DetailParentQuoteSlice;
}): React.ReactElement {
  return (
    <View style={styles.zone} testID="card-detail-parent-quote-zone">
      <Text style={styles.zoneHeading} accessibilityRole="text">
        Replied to
      </Text>
      {slice.isAvailable && slice.quote ? (
        <Text
          style={styles.parentQuote}
          accessibilityRole="text"
          testID="card-detail-parent-quote"
        >
          {slice.quote}
        </Text>
      ) : (
        <Text
          style={styles.muted}
          accessibilityRole="text"
          testID="card-detail-parent-quote-unavailable"
        >
          {slice.unavailableLabel}
        </Text>
      )}
    </View>
  );
}

/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 2, ask v) — the Standing / Tone / Heat
 * strip. Display-only, plain-language. The caption frames the strip as a
 * reading of the TEXT, not a judgment of the author.
 */
function StandingToneHeatZone({
  strip,
}: {
  strip: DetailStandingToneHeatStrip;
}): React.ReactElement {
  return (
    <View style={styles.zone} testID="card-detail-sth-zone">
      <Text style={styles.zoneHeading} accessibilityRole="text">
        {strip.caption}
      </Text>
      <View style={styles.bandRow}>
        <View style={styles.bandChip} testID="card-detail-standing-band">
          <Text style={styles.bandValue}>{strip.standingLine}</Text>
        </View>
        <View style={styles.bandChip} testID="card-detail-tone-band">
          <Text style={styles.bandValue}>{strip.toneLine}</Text>
        </View>
        <View style={styles.bandChip} testID="card-detail-heat-band">
          <Text style={styles.bandValue}>{strip.heatLine}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 2, ask ii) — the full semantic-tag block,
 * grouped by the §10a doctrine categories (Observations / Allegations /
 * Structural labels / Status). Display-only labels; neutral language.
 */
function FullTagsZone({
  model,
}: {
  model: DetailFullTagsModel;
}): React.ReactElement {
  return (
    <View style={styles.zone} testID="card-detail-full-tags-zone">
      <Text style={styles.zoneHeading} accessibilityRole="text">
        Tags
      </Text>
      {model.hasTags ? (
        model.groups.map((group) => (
          <View
            key={group.groupCode}
            style={styles.zone}
            testID={`card-detail-tags-group-${group.groupCode}`}
          >
            <Text
              style={styles.tagsGroupHeading}
              accessibilityRole="text"
              testID={`card-detail-tags-group-heading-${group.groupCode}`}
            >
              {group.groupLabel}
            </Text>
            <View style={styles.chipRow}>
              {group.tags.map((tag) => (
                <LabelChip
                  key={tag.id}
                  text={tag.label}
                  testID={`card-detail-tag-${tag.id}`}
                />
              ))}
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.muted} testID="card-detail-full-tags-empty">
          {model.emptyStateCopy}
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

      {/* CVDH-001 Slice 2, ask i — italic replied-to parent quote (PRIMARY,
          visible by default; neutral degrade when unresolvable). */}
      <ParentQuoteZone slice={model.parentQuote} />

      {/* CVDH-001 Slice 2, ask v — Standing / Tone / Heat strip (PRIMARY,
          visible by default; plain-language; describes the TEXT). */}
      {model.standingToneHeat ? (
        <StandingToneHeatZone strip={model.standingToneHeat} />
      ) : null}

      {/* CVDH-001 Slice 2, ask iii — all-families family-grouped classifier
          observations (A–G gated, uncapped). Replaces the ≤3 capped strip on
          the hub. Zone 3 body is rendered by the card itself. */}
      <HubClassifierZone model={model.hubClassifier} />

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

      {/* Zone 8 — semantic flags (display-only labels). Retained for
          backwards-compatible behavior; the CVDH-001 full-tags block below
          is the doctrine-grouped superset (Observations / Allegations /
          Structural / Status). */}
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

      {/* CVDH-001 Slice 2, ask ii — full semantic tags, doctrine-grouped
          (SECONDARY, visible by default). */}
      <FullTagsZone model={model.fullTags} />
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
  classifierFamilyHeading: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '600',
  },
  tagsGroupHeading: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '600',
  },
  parentQuote: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
    fontStyle: 'italic',
  },
  bandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  bandChip: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderRadius: RADIUS.sm,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    paddingHorizontal: SPACING.s,
    paddingVertical: 2,
  },
  bandValue: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: TYPOGRAPHY.chipLabel.fontWeight,
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
