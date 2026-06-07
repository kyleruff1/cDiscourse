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
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BORDER_WIDTH,
  RADIUS,
  SPACING,
  SURFACE_TOKENS,
  TOUCH_TARGET,
  TYPOGRAPHY,
} from '../../../lib/designTokens';
import { CARD_CLASSIFIER_EVIDENCE_PREFIX } from './cardClassifierStripModel';
import { CardStepReferenceHeader } from './CardStepReferenceHeader';
import type { CardClassifierChip } from './cardClassifierStripModel';
import type { CardDetailViewModel } from './cardDetailModel';
import {
  hubColumnLayout,
  type DetailFullTagsModel,
  type DetailParentComparisonBubble,
  type DetailStandingToneHeatStrip,
  type HubClassifierGroupsModel,
  type HubColumnRegion,
} from '../detail/argumentDetailModel';

/** Platform-OS values `hubColumnLayout` accepts. */
type HubPlatformOs = 'web' | 'ios' | 'android' | 'windows' | 'macos';

function resolvePlatformOs(override?: HubPlatformOs): HubPlatformOs {
  if (override) return override;
  const os = Platform.OS;
  if (os === 'web' || os === 'ios' || os === 'android' || os === 'windows' || os === 'macos') {
    return os;
  }
  return 'web';
}

export interface CardDetailPanelProps {
  model: CardDetailViewModel;
  /** Re-activates the step-reference ancestor message. Also fired by the
   *  off-center parent comparison-bubble reference (Slice 3). */
  onActivateAncestor?: (messageId: string) => void;
  /** Slice 3 — viewport width, drives the responsive 3-col / stacked layout.
   *  Omitted → stacked single column (back-compat with #516-era callers). */
  windowWidth?: number;
  /** Slice 3 — platform override for `hubColumnLayout` (tests). Defaults to
   *  the runtime `Platform.OS`. */
  platformOs?: HubPlatformOs;
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
 * CARD-VIEW-DETAIL-HUB-001 (Slice 3 — operator refinement) — the off-center,
 * above-centerpiece PARENT COMPARISON bubble. Upgrades the Slice-2 inline
 * parent-quote zone into a visually-distinct colored bubble so the reader can
 * tell, at a glance, that the parent is the OTHER party's move.
 *
 * Visual grammar (timeline-grammar + accessibility-targets):
 *   - The bubble color encodes the parent's ACTOR / SIDE (reusing the Timeline
 *     actor grammar) — NEVER a verdict / truth color. It is DIFFERENT from the
 *     current card's color so the two moves contrast.
 *   - The bubble sits ABOVE + OFF-CENTER the centerpiece (alignSelf flex-start
 *     + a small negative offset) so the centerpiece reads as the obvious focus.
 *   - The parent text renders ITALIC inside QUOTES.
 *   - Meaning is carried by SHAPE (off-center bubble + italic quote) AND the
 *     plain-language actor label + reference label — color is never the only
 *     signal (grayscale snapshot stays legible).
 *
 * The reference (`#N · kind`) is the ONLY interactive affordance here — a real
 * `Pressable` (role button, ≥44×44 via hitSlop) that switches the active card
 * to the parent (`onActivateAncestor`, Fork 7). Graceful degrade: a `none`
 * bubble (root / soft-deleted / RLS-hidden / out-of-slice parent) renders
 * NOTHING — never a "hidden because…" reason (§10a).
 */
function ParentComparisonBubble({
  bubble,
  onActivateAncestor,
}: {
  bubble: DetailParentComparisonBubble;
  onActivateAncestor?: (messageId: string) => void;
}): React.ReactElement | null {
  // Graceful degrade — no bubble for a root / unresolvable parent.
  if (bubble.kind === 'none') return null;

  const hasReference =
    bubble.referenceToken != null &&
    bubble.referenceLabel != null &&
    bubble.parentMessageId != null;

  return (
    <View
      style={[
        styles.parentBubble,
        { backgroundColor: bubble.color.bg, borderColor: bubble.color.border },
      ]}
      accessibilityLabel={bubble.accessibilityLabel}
      testID="card-detail-parent-bubble"
    >
      {/* Actor label — color-independent cue for WHO made the parent move. */}
      <Text
        style={[styles.parentBubbleActor, { color: bubble.color.accent }]}
        accessibilityRole="text"
        testID="card-detail-parent-bubble-actor"
      >
        {bubble.actorLabel}
      </Text>

      {/* Italic quote inside quote marks. Display-only. */}
      {bubble.quote.quote ? (
        <Text
          style={styles.parentBubbleQuote}
          accessibilityRole="text"
          testID="card-detail-parent-bubble-quote"
        >
          {`“${bubble.quote.quote}”`}
        </Text>
      ) : null}

      {/* Reference — the ONLY navigation affordance in the bubble. */}
      {hasReference ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Go to ${bubble.referenceLabel}`}
          onPress={() => {
            if (bubble.parentMessageId) onActivateAncestor?.(bubble.parentMessageId);
          }}
          hitSlop={TOUCH_TARGET.hitSlopAll}
          style={styles.parentBubbleRefPressable}
          testID="card-detail-parent-bubble-reference"
        >
          <Text style={[styles.parentBubbleRefText, { color: bubble.color.accent }]}>
            {bubble.referenceLabel}
          </Text>
        </Pressable>
      ) : (
        // Unresolvable navigation — show the reference label as display-only
        // text when present, but NEVER as a dangling tappable affordance.
        bubble.referenceLabel ? (
          <Text
            style={[styles.parentBubbleRefText, { color: bubble.color.accent }]}
            accessibilityRole="text"
            testID="card-detail-parent-bubble-reference-static"
          >
            {bubble.referenceLabel}
          </Text>
        ) : null
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
 * CARD-VIEW-DETAIL-HUB-001 (Slice 3) — the CENTERPIECE region. The obvious
 * focus of the page: the off-center parent comparison bubble ABOVE, then the
 * step reference + category + S/T/H strip + evidence + standing + lifecycle.
 *
 * EVERY section is visible by default — there is NO expand affordance, NO
 * collapsed disclosure (ratified §7.1 / check #14). The only Pressables are
 * navigation (the step-ref parent token + the comparison-bubble reference).
 */
function CenterpieceRegion({
  model,
  onActivateAncestor,
}: {
  model: CardDetailViewModel;
  onActivateAncestor?: (messageId: string) => void;
}): React.ReactElement {
  const { evidence } = model;
  return (
    <View style={styles.centerpieceRegion} testID="card-detail-centerpiece">
      {/* Slice 3 — the off-center colored parent COMPARISON bubble, ABOVE the
          centerpiece card. Degrades to nothing for a root / unresolvable
          parent. The reference is a navigation affordance (switch active card). */}
      <ParentComparisonBubble
        bubble={model.parentComparison}
        onActivateAncestor={onActivateAncestor}
      />

      {/* The centerpiece card content — visually the prominent focus. */}
      <View style={styles.centerpieceCard} testID="card-detail-centerpiece-card">
        {/* Zone 1 — step reference (the parent token is a navigation button). */}
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

        {/* CVDH-001 Slice 2, ask v — Standing / Tone / Heat strip (PRIMARY,
            visible by default; plain-language; describes the TEXT). */}
        {model.standingToneHeat ? (
          <StandingToneHeatZone strip={model.standingToneHeat} />
        ) : null}

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
      </View>
    </View>
  );
}

/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 3) — the CLASSIFIER column. On the wide
 * 3-col layout this is the right-flanking region; on stacked it follows the
 * centerpiece. Always visible by default.
 */
function ClassifierColumn({
  model,
}: {
  model: CardDetailViewModel;
}): React.ReactElement {
  return (
    <View style={styles.flankColumn} testID="card-detail-classifier-column">
      {/* CVDH-001 Slice 2, ask iii — all-families family-grouped classifier
          observations (A–G gated, uncapped). Stylized flags/labels/banners. */}
      <HubClassifierZone model={model.hubClassifier} />
    </View>
  );
}

/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 3) — the SEMANTIC-TAGS column. On the wide
 * 3-col layout this is the left-flanking region; on stacked it follows the
 * classifier column. Always visible by default.
 */
function TagsColumn({
  model,
}: {
  model: CardDetailViewModel;
}): React.ReactElement {
  return (
    <View style={styles.flankColumn} testID="card-detail-tags-column">
      {/* Zone 8 — semantic flags (display-only labels). Retained for
          backwards-compatible behavior; the CVDH-001 full-tags block below
          is the doctrine-grouped superset. */}
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

/**
 * The exploded card detail panel — the Cards HUB. Render ONLY on the active
 * card.
 *
 * Slice 3 — comparison-style centerpiece + responsive multi-column:
 *   - The active/current message is the OBVIOUS CENTERPIECE; the replied-to
 *     parent renders as an off-center colored COMPARISON bubble above it.
 *   - Wide web viewport (≥1024): THREE columns — tags · centerpiece ·
 *     classifier. Narrow / native: single stacked column, SAME sections in
 *     the SAME stable reading order (centerpiece → classifier → tags).
 *   - ALL sections are visible by default — NO expand affordance on the Card
 *     (ratified §7.1). The only Card Pressables are navigation.
 */
export function CardDetailPanel({
  model,
  onActivateAncestor,
  windowWidth,
  platformOs,
  testID,
}: CardDetailPanelProps): React.ReactElement {
  const layout = hubColumnLayout(
    typeof windowWidth === 'number' ? windowWidth : 0,
    resolvePlatformOs(platformOs),
  );
  const isThreeColumn = layout.mode === 'three_column';

  // The three region elements. Each carries a stable testID so a test can
  // assert presence + reading order regardless of visual placement.
  const regionFor = (region: HubColumnRegion): React.ReactElement => {
    switch (region) {
      case 'centerpiece':
        return (
          <CenterpieceRegion
            key="centerpiece"
            model={model}
            onActivateAncestor={onActivateAncestor}
          />
        );
      case 'classifier':
        return <ClassifierColumn key="classifier" model={model} />;
      case 'tags':
        return <TagsColumn key="tags" model={model} />;
      default:
        return <React.Fragment key={region} />;
    }
  };

  // STACKED (native + narrow web): render in the stable SR reading order
  // (centerpiece → classifier → tags) so source order == focus / SR order.
  //
  // WIDE (web ≥1024): render in the operator's VISUAL order (tags · centerpiece
  // · classifier) so the centerpiece is visually CENTERED between the two
  // flanking columns. Design §7.2 explicitly permits visual order to differ
  // from SR reading order here; the canonical reading order is carried by the
  // model (`layout.readingOrder`) and is the order used on every touch-first /
  // native viewport (which is always stacked).
  const renderOrder = isThreeColumn ? layout.visualOrder : layout.readingOrder;

  return (
    <View
      style={[styles.panel, isThreeColumn && styles.panelWide]}
      accessibilityLabel="Argument detail hub"
      testID={testID ?? 'card-detail-panel'}
    >
      {renderOrder.map((region) => regionFor(region))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: SPACING.s,
    gap: SPACING.s,
  },
  // Slice 3 — wide 3-column layout. The panel becomes a wrapping row; each
  // region is a column. `alignItems: flex-start` lets the centerpiece + the
  // flanking columns size to their content.
  panelWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: SPACING.l,
  },
  // Slice 3 — the centerpiece region: the off-center parent bubble ABOVE the
  // centerpiece card. On the wide layout it is the central, widest column.
  centerpieceRegion: {
    gap: SPACING.s,
    flexGrow: 2,
    flexShrink: 1,
    flexBasis: 320,
    minWidth: 260,
  },
  // The centerpiece card surface — visually elevated so it reads as the focus.
  centerpieceCard: {
    gap: SPACING.s,
    backgroundColor: SURFACE_TOKENS.overlay,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    padding: SPACING.m,
  },
  // Slice 3 — a flanking column (tags / classifier) in the wide layout.
  flankColumn: {
    gap: SPACING.s,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 220,
    minWidth: 180,
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
  // Slice 3 — the off-center, above-centerpiece parent COMPARISON bubble.
  // `alignSelf: flex-start` + the negative left margin push it OFF-CENTER (to
  // the left, above the centerpiece). The colored fill + stroke come from the
  // actor color (applied inline); the offset + italic quote carry the meaning
  // independent of color.
  parentBubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    marginLeft: -SPACING.s,
    marginBottom: SPACING.xs,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.md,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    gap: SPACING.xs,
  },
  parentBubbleActor: {
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  parentBubbleQuote: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
    fontStyle: 'italic',
  },
  parentBubbleRefPressable: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET.minSizePx,
    paddingVertical: 2,
  },
  parentBubbleRefText: {
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '700',
    textDecorationLine: 'underline',
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
