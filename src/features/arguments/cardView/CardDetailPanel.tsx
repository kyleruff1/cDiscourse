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
import { CardStepReferenceHeader } from './CardStepReferenceHeader';
import { RefereeCardView } from './RefereeCardView';
import type { RefereeNavVerb } from './RefereeCardView';
import type { DisagreementContract, MoveSuggestion } from '../../refereeLoop';
import type { CardClassifierChip } from './cardClassifierStripModel';
import type { CardMappingChip, CardMappingSectionModel } from './cardMappingSectionModel';
import type { CardDetailViewModel } from './cardDetailModel';
import {
  hubColumnLayout,
  type DetailFullTagsModel,
  type DetailParentComparisonBubble,
  type DetailStandingToneHeatStrip,
  type HubClassifierGroupsModel,
  type HubColumnRegion,
} from '../detail/argumentDetailModel';
import { getRailActions } from '../ArgumentSideActionRail';
import {
  RAIL_ACTION_CATEGORY_LABEL,
  groupRailActionsByCategory,
} from '../railActionCategories';
import type {
  RailActionCode,
  RailBubbleActor,
  RailViewerRole,
} from '../railActionCategories';

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
  /**
   * MCP-MAPPING-EXPANSION-001 (Slice B) — the observation-mapping evaluator's
   * `card`-surface results, formatted into the "Combination observations"
   * section by `buildCardMappingSection`. Computed by the surface
   * (`ArgumentGameSurface` → evaluateObservationMapping) and threaded through
   * the Stack → Card → Panel chain. Display-only, ADDITIVE: when omitted the
   * section does not render (byte-equivalent to the pre-Slice-B panel). The
   * existing per-observation classifier strip (`model.hubClassifier`) is
   * UNCHANGED — the combination section is a richer additive sibling.
   */
  mappingSection?: CardMappingSectionModel | null;
  /** Re-activates the step-reference ancestor message. Also fired by the
   *  off-center parent comparison-bubble reference (Slice 3). */
  onActivateAncestor?: (messageId: string) => void;
  /** Slice 3 — viewport width, drives the responsive 3-col / stacked layout.
   *  Omitted → stacked single column (back-compat with #516-era callers). */
  windowWidth?: number;
  /** Slice 3 — platform override for `hubColumnLayout` (tests). Defaults to
   *  the runtime `Platform.OS`. */
  platformOs?: HubPlatformOs;
  /** CARD-VIEW-COMPARISON-POLISH-001 — the current/own message body text,
   *  forwarded from the active card so the panel owns the vertical order:
   *  top parent bubble → current message body + observations. Omitted by
   *  direct-render callers/tests (the body then stays in the active card). */
  currentMessageBody?: string | null;
  /** CARD-VIEW-REFINE-001 — viewer role for the inline ActionsZone. The zone
   *  renders ONLY when BOTH `viewerRole` and `onRailAction` are supplied (the
   *  active-card path); display-only direct-render callers/tests omit them and
   *  get NO ActionsZone (byte-equivalent to the pre-REFINE panel). */
  viewerRole?: RailViewerRole;
  /** CARD-VIEW-REFINE-001 — bubble actor for the active message. Drives the
   *  actor-aware inline move set via `getRailActions(viewerRole, bubbleActor)`
   *  (the SAME single source of truth the side rail uses). */
  bubbleActor?: RailBubbleActor;
  /** CARD-VIEW-REFINE-001 — dispatch a rail action code for the active
   *  message via the SAME path the side rail uses. Required (with viewerRole)
   *  for the inline ActionsZone to render. */
  onRailAction?: (code: RailActionCode, ctx: { activeMessageId: string | null }) => void;
  /** REF-003 — the ACTIVE node's derived Open Issue (Disagreement Contract).
   *  When supplied, a full-width Referee Card slot renders ABOVE the raw
   *  classifier strip (between the parent-bubble slot and the render-order
   *  regions). Omitted → the slot renders nothing, byte-equivalent to the
   *  pre-REF-003 panel (#504's five zones unchanged). The card consumes ONLY
   *  the contract's plain-language view-model fields; it never mounts a second
   *  RefereeBannerView and never maps over raw observation marks. */
  refereeCard?: DisagreementContract | null;
  /** REF-003 — fired when a zone-3 next-move button is pressed on the Referee
   *  Card. v1 deep-links to the existing composer entry point; REF-004 swaps
   *  the surface handler for full Act-popout routing (this leaf prop is
   *  stable). Omitted → buttons render but pressing them is a no-op. */
  onRefereeMove?: (move: MoveSuggestion) => void;
  /** REF-004 — fired when a Referee Card navigation affordance is pressed
   *  ("View details" → 'inspect'; "Focus on board" → 'focus_on_board').
   *  Forwarded to the RefereeCardView slot. Omitted → the secondary
   *  affordance row does not render (byte-equivalent to REF-003). */
  onRefereeNavigate?: (verb: RefereeNavVerb) => void;
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
 *  inline as a label, not behind a tap.
 *
 *  CARD-VIEW-REFINE-001 — denser per-node feedback (layout only, no new
 *  evaluation):
 *   - renders the plain-language SOURCE-PROVENANCE badge ("From system
 *     metadata", …) beside the label (the chip already carries it; it was
 *     never rendered on the card before). The raw `category` code is NEVER
 *     shown — only the suppressed-on-unknown plain-language label.
 *   - on the WIDE layout the evidence span sits INLINE beside the label
 *     (one row, wrapping) instead of indented below — filling the
 *     horizontal columns the 3-col layout opens up.
 *  STILL display-only: this is an AI/classifier observation, so it stays a
 *  non-interactive `accessibilityRole="text"` label (doctrine §1 / §4). */
function ClassifierLabel({
  chip,
  isWide,
}: {
  chip: CardClassifierChip;
  isWide?: boolean;
}): React.ReactElement {
  // The framed display string (attribution frame + verbatim span in curly
  // quotes) is built ONCE in `markToChip` (single source of truth for the
  // capped strip + the uncapped hub). The view just renders it.
  const evidenceText = chip.evidenceSpanFramed;
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
        {/* Source-provenance badge — plain language only; suppressed when the
            code is unknown (sourceProvenanceLabel === null). */}
        {chip.sourceProvenanceLabel ? (
          <View
            style={styles.provenanceBadge}
            testID={`card-detail-classifier-provenance-${chip.id}`}
          >
            <Text style={styles.provenanceBadgeText}>{chip.sourceProvenanceLabel}</Text>
          </View>
        ) : null}
        {/* Wide layout — evidence span INLINE beside the label. */}
        {isWide && evidenceText ? (
          <Text
            style={styles.classifierEvidenceInline}
            numberOfLines={2}
            testID={`card-detail-classifier-evidence-${chip.id}`}
          >
            {evidenceText}
          </Text>
        ) : null}
      </View>
      {/* Stacked layout — evidence span indented BELOW the label. */}
      {!isWide && evidenceText ? (
        <Text style={styles.classifierEvidence} testID={`card-detail-classifier-evidence-${chip.id}`}>
          {evidenceText}
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
 * heading; chips keep confidence PIPS + evidence spans. Only A–I families
 * survive the model's explicit family gate (only Family J /
 * `sensitive_composer` is excluded), so J never renders here.
 */
function HubClassifierZone({
  model,
  isWide,
}: {
  model: HubClassifierGroupsModel;
  /** CARD-VIEW-REFINE-001 — when wide (3-col), family chip strips wrap
   *  HORIZONTALLY and evidence sits inline beside the label, filling the
   *  horizontal columns the layout opens up. */
  isWide?: boolean;
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
            {/* CARD-VIEW-REFINE-001 — chips spread into a HORIZONTAL strip
                that WRAPS (was a vertical stack), so the dense per-node
                signal fills the columns. */}
            <View
              style={styles.classifierChipStrip}
              testID={`card-detail-classifier-strip-${group.familyCode}`}
            >
              {group.chips.map((chip) => (
                <ClassifierLabel key={chip.id} chip={chip} isWide={isWide} />
              ))}
            </View>
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
 * MCP-MAPPING-EXPANSION-001 (Slice B) — the "Combination observations" section.
 *
 * Renders the observation-mapping evaluator's `card`-surface results as a NEW,
 * ADDITIVE display-only section beside the per-observation classifier zone.
 * Each chip is a richer COMBINATION label (e.g. "Anchored challenge" =
 * challenges_parent + quote_anchors_parent); the evaluator has already applied
 * composite-supersedes-singles, so a single consumed by a composite is not
 * also surfaced here.
 *
 * Doctrine (design §2 / §3 invariant 2; cdiscourse-doctrine §1 / §9 / §10a):
 *   - Every chip is a DISPLAY-ONLY label (`accessibilityRole="text"`) — NOT a
 *     Pressable, NO onPress, NO button role. The mapping chips are observations,
 *     not user moves.
 *   - Confidence is rendered as PIPS (filled/empty dots), NEVER a number.
 *   - The advisory caption frames the section ("what the referee noticed —
 *     advisory, not a verdict.").
 *   - Empty / none → a teaching empty state (never "clean" / "no issues").
 *   - Production families only (A–I); the frozen Family J (`sensitive_composer`)
 *     is dropped by the defensive gate. No `inactive_reason`.
 *
 * Visible by default on the active card (check #14 — no tap, no disclosure).
 */
function CombinationObservationChip({
  chip,
}: {
  chip: CardMappingChip;
}): React.ReactElement {
  return (
    <View
      style={styles.mappingRow}
      accessibilityRole="text"
      accessibilityLabel={chip.accessibilityLabel}
      testID={`card-detail-mapping-${chip.id}`}
    >
      <View style={styles.mappingHead}>
        <Text
          style={styles.glyph}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          ◎
        </Text>
        <Text style={styles.mappingLabelText} testID={`card-detail-mapping-label-${chip.id}`}>
          {chip.label}
        </Text>
        <ConfidencePips pips={chip.confidencePips} label={chip.confidenceLabel} />
      </View>
      {chip.diagnosticSentence.length > 0 ? (
        <Text
          style={styles.mappingDiagnostic}
          testID={`card-detail-mapping-diagnostic-${chip.id}`}
        >
          {chip.diagnosticSentence}
        </Text>
      ) : null}
    </View>
  );
}

function CombinationObservationsZone({
  section,
  isWide,
}: {
  section: CardMappingSectionModel;
  /** CARD-VIEW-REFINE-001 parity — on the wide (3-col) layout the chips wrap
   *  HORIZONTALLY, matching the per-observation classifier strip. */
  isWide?: boolean;
}): React.ReactElement {
  return (
    <View style={styles.zone} testID="card-detail-mapping-zone">
      <Text style={styles.zoneHeading} accessibilityRole="text">
        {section.heading}
      </Text>
      <Text style={styles.zoneCaption} accessibilityRole="text">
        {section.advisoryCaption}
      </Text>
      {section.hasSignals ? (
        <View
          style={isWide ? styles.classifierChipStrip : styles.zone}
          testID="card-detail-mapping-strip"
        >
          {section.chips.map((chip) => (
            <CombinationObservationChip key={chip.id} chip={chip} />
          ))}
        </View>
      ) : (
        <Text style={styles.muted} testID="card-detail-mapping-empty">
          {section.emptyStateCopy}
        </Text>
      )}
    </View>
  );
}

/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 3) + CARD-VIEW-COMPARISON-POLISH-001 — the
 * TOP-OF-CARD PARENT ("replying-to" / OPPONENT) COMPARISON bubble. Renders as
 * the FIRST element of the active card detail so the reader sees, at the very
 * top, the move they are answering before their own move.
 *
 * Visual grammar (timeline-grammar + accessibility-targets):
 *   - The bubble has a TRUE-BLACK backdrop (`bubble.color.backdrop`) — a
 *     visually heavy, DRAMATICALLY different fill from the current message's
 *     (non-black) centerpiece surface. Black denotes "the message being
 *     replied to" (a MESSAGE-TYPE cue), NEVER a verdict / truth signal.
 *   - A DOUBLE OUTLINE wraps the bubble: an OUTER ring (`bubble.color.ring`,
 *     the actor accent) around an INNER border (`bubble.color.border`, the
 *     deeper actor stroke). The two concentric strokes are the distinct
 *     double border the operator asked for; they also color-encode the parent
 *     ACTOR independently of the constant black fill.
 *   - The bubble sits OFF-CENTER (alignSelf flex-start + a small negative
 *     offset) so the current centerpiece below it reads as the focus.
 *   - The parent text renders ITALIC inside QUOTES, at a LARGER font.
 *   - Meaning is carried by SHAPE (the off-center bubble + italic quote) AND
 *     the plain-language "Replying to" framing + actor label + reference label
 *     — color is never the only signal (grayscale snapshot stays legible).
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

  // DOUBLE OUTLINE — the OUTER ring carries the actor accent stroke; the
  // INNER bubble carries the black backdrop + the deeper actor border stroke.
  // The `testID="card-detail-parent-bubble"` stays on the OUTER element so the
  // existing layout/accessibility assertions keep resolving the bubble.
  return (
    <View
      style={[styles.parentBubbleRing, { borderColor: bubble.color.ring }]}
      accessibilityLabel={bubble.accessibilityLabel}
      testID="card-detail-parent-bubble"
    >
      <View
        style={[
          styles.parentBubble,
          { backgroundColor: bubble.color.backdrop, borderColor: bubble.color.border },
        ]}
        testID="card-detail-parent-bubble-inner"
      >
        {/* "Replying to" framing — color-independent MESSAGE-TYPE cue that the
            black bubble is the move being answered, not a verdict. */}
        <Text
          style={styles.parentBubbleReplyingTo}
          accessibilityRole="text"
          testID="card-detail-parent-bubble-replying-to"
        >
          Replying to
        </Text>

        {/* Actor label — color-independent cue for WHO made the parent move. */}
        <Text
          style={[styles.parentBubbleActor, { color: bubble.color.accent }]}
          accessibilityRole="text"
          testID="card-detail-parent-bubble-actor"
        >
          {bubble.actorLabel}
        </Text>

        {/* Italic quote inside quote marks, LARGER font. Display-only. */}
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
 * CARD-VIEW-REFINE-001 — "Actions on this point" exploded INLINE on the
 * active card, parallel to Evidence / Standing / Lifecycle.
 *
 * DOCTRINE (stated plainly): these chips are real `Pressable`s on purpose.
 * They are USER MOVES governed by the Constitution engine (reply / disagree /
 * join / share / …), NOT classifier or AI verdicts. The display-only /
 * no-verdict rule (§1 / §4) applies to AI flags + classifier/tag chips —
 * which STAY non-interactive — NOT to the viewer's own move set. The action
 * set is the SAME single source of truth the side rail uses
 * (`getRailActions(viewerRole, bubbleActor)`), so the inline subset and the
 * rail can never diverge. Dispatch goes through `onRailAction` (the SAME
 * `handleRailAction` path), so join / share / watch resolve identically to
 * the rail.
 *
 * Renders nothing when the actor-aware set is empty (own bubble after the
 * UX-001.4 migration → the deep set stays in Act; this is the high-frequency
 * subset, not a full Act replacement).
 *
 * a11y: each chip is a ≥44×44 button with a descriptive label + the helper
 * demoted to `accessibilityHint`. No animation (reduce-motion safe — nothing
 * toggles).
 */
function ActionsZone({
  viewerRole,
  bubbleActor,
  onRailAction,
  activeMessageId,
}: {
  viewerRole: RailViewerRole;
  bubbleActor: RailBubbleActor;
  onRailAction: (code: RailActionCode, ctx: { activeMessageId: string | null }) => void;
  activeMessageId: string | null;
}): React.ReactElement | null {
  const actions = getRailActions(viewerRole, bubbleActor);
  if (actions.length === 0) return null;
  const groups = groupRailActionsByCategory(actions);

  return (
    <View style={styles.zone} testID="card-detail-actions-zone">
      <Text style={styles.zoneHeading} accessibilityRole="text">
        Actions on this point
      </Text>
      <Text style={styles.zoneCaption} accessibilityRole="text">
        Your moves — these change the debate.
      </Text>
      {groups.map((group) => (
        <View
          key={`actions-group-${group.category}`}
          style={styles.zone}
          testID={`card-detail-actions-group-${group.category}`}
        >
          <Text
            style={styles.actionsGroupHeading}
            accessibilityRole="text"
            testID={`card-detail-actions-group-heading-${group.category}`}
          >
            {RAIL_ACTION_CATEGORY_LABEL[group.category]}
          </Text>
          <View style={styles.chipRow}>
            {group.actions.map((a) => (
              <Pressable
                key={`card-detail-action-${a.code}`}
                style={[
                  styles.actionChip,
                  a.tone === 'primary' && styles.actionChipPrimary,
                  a.tone === 'warning' && styles.actionChipWarning,
                  a.tone === 'critical' && styles.actionChipCritical,
                ]}
                onPress={() => onRailAction(a.code, { activeMessageId })}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                accessibilityHint={a.helper}
                hitSlop={TOUCH_TARGET.hitSlopAll}
                testID={`card-detail-action-${a.code}`}
              >
                <Text style={styles.actionChipText} numberOfLines={1}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 3) + CARD-VIEW-COMPARISON-POLISH-001 — the
 * CENTERPIECE region: the CURRENT / OWN message. The parent comparison bubble
 * has been hoisted ABOVE this region to the panel root (it is now the FIRST
 * element of the whole card), so this region is the "my move" centerpiece:
 * the current message body (when forwarded), then the step reference +
 * category + S/T/H strip + evidence + standing + lifecycle.
 *
 * The centerpiece card uses a DRAMATICALLY DIFFERENT (non-black) backdrop +
 * actor-accent border from the parent bubble's true-black fill, so the reader
 * instantly reads "this is my move" vs "the move I am answering". The contrast
 * is a MESSAGE-TYPE cue, never a verdict (timeline-grammar / doctrine §1).
 *
 * EVERY section is visible by default — there is NO expand affordance, NO
 * collapsed disclosure (ratified §7.1 / check #14). The only Pressables are
 * navigation (the step-ref parent token + the comparison-bubble reference).
 */
function CenterpieceRegion({
  model,
  currentMessageBody,
  onActivateAncestor,
  viewerRole,
  bubbleActor,
  onRailAction,
}: {
  model: CardDetailViewModel;
  /** CARD-VIEW-COMPARISON-POLISH-001 — the current/own message body text,
   *  forwarded from the active card so the body + observations sit together
   *  BELOW the top parent bubble. Omitted by direct-render callers/tests. */
  currentMessageBody?: string | null;
  onActivateAncestor?: (messageId: string) => void;
  /** CARD-VIEW-REFINE-001 — inline ActionsZone inputs. The zone renders only
   *  when all three are present (the active-card path). */
  viewerRole?: RailViewerRole;
  bubbleActor?: RailBubbleActor;
  onRailAction?: (code: RailActionCode, ctx: { activeMessageId: string | null }) => void;
}): React.ReactElement {
  const { evidence } = model;
  return (
    <View style={styles.centerpieceRegion} testID="card-detail-centerpiece">
      {/* The centerpiece card content — the current/own message; visually the
          prominent focus and a DRAMATICALLY different surface from the black
          parent bubble above it. */}
      <View style={styles.centerpieceCard} testID="card-detail-centerpiece-card">
        {/* CARD-VIEW-COMPARISON-POLISH-001 — "Your move" framing + the current
            message body, at a larger, readable font. Color-independent cue
            (the label text) that this is the responder's own move. */}
        {typeof currentMessageBody === 'string' && currentMessageBody.length > 0 ? (
          <View style={styles.zone} testID="card-detail-current-message-zone">
            <Text style={styles.currentMessageLabel} accessibilityRole="text">
              Your move
            </Text>
            <Text
              style={styles.currentMessageBody}
              accessibilityRole="text"
              testID="card-detail-current-message-body"
            >
              {currentMessageBody}
            </Text>
          </View>
        ) : null}

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

        {/* CARD-VIEW-REFINE-001 — "Actions on this point" exploded INLINE,
            parallel to Evidence / Standing / Lifecycle. Renders ONLY when the
            active-card path supplies viewerRole + bubbleActor + onRailAction.
            These are USER MOVES (real Pressables) — NOT classifier verdicts;
            the display-only rule does not apply to the viewer's move set. The
            message id is bound by the card's onRailAction closure, so the
            placeholder here is null. */}
        {viewerRole && bubbleActor && onRailAction ? (
          <ActionsZone
            viewerRole={viewerRole}
            bubbleActor={bubbleActor}
            onRailAction={onRailAction}
            activeMessageId={null}
          />
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
  mappingSection,
  isWide,
}: {
  model: CardDetailViewModel;
  /** MCP-MAPPING-EXPANSION-001 (Slice B) — the combination-observations
   *  section. Renders BELOW the per-observation classifier zone (additive).
   *  Omitted → the section does not render. */
  mappingSection?: CardMappingSectionModel | null;
  isWide?: boolean;
}): React.ReactElement {
  return (
    <View style={styles.flankColumn} testID="card-detail-classifier-column">
      {/* CVDH-001 Slice 2, ask iii — all-families family-grouped classifier
          observations (A–I gated, uncapped). Stylized flags/labels/banners.
          CARD-VIEW-REFINE-001 — wide layout spreads chips horizontally + puts
          evidence inline. NOT REGRESSED by Slice B — the combination section
          below is an ADDITIVE richer-label sibling. */}
      <HubClassifierZone model={model.hubClassifier} isWide={isWide} />
      {/* MCP-MAPPING-EXPANSION-001 (Slice B) — combination observations. The
          evaluator already applies composite-supersedes-singles, so a single
          consumed by a composite is surfaced ONLY as the combination label
          here, never twice. Display-only; visible by default (check #14). */}
      {mappingSection ? (
        <CombinationObservationsZone section={mappingSection} isWide={isWide} />
      ) : null}
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
 * Slice 3 + CARD-VIEW-COMPARISON-POLISH-001 — comparison-style centerpiece +
 * responsive multi-column:
 *   - The parent ("replying-to" / OPPONENT) comparison bubble is the FIRST
 *     element of the whole panel (full-width banner at the TOP in BOTH the
 *     stacked AND wide layouts), with a true-black backdrop + double outline +
 *     larger quote font. Below it the current/own message is the centerpiece,
 *     on a DRAMATICALLY different (non-black) surface.
 *   - Wide web viewport (≥1024): THREE columns — tags · centerpiece ·
 *     classifier — beneath the full-width parent banner. Narrow / native:
 *     single stacked column, SAME sections in the SAME stable reading order
 *     (parent bubble → centerpiece → classifier → tags).
 *   - ALL sections are visible by default — NO expand affordance on the Card
 *     (ratified §7.1). The only Card Pressables are navigation.
 */
export function CardDetailPanel({
  model,
  mappingSection,
  onActivateAncestor,
  windowWidth,
  platformOs,
  currentMessageBody,
  viewerRole,
  bubbleActor,
  onRailAction,
  refereeCard,
  onRefereeMove,
  onRefereeNavigate,
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
            currentMessageBody={currentMessageBody}
            onActivateAncestor={onActivateAncestor}
            viewerRole={viewerRole}
            bubbleActor={bubbleActor}
            onRailAction={onRailAction}
          />
        );
      case 'classifier':
        return (
          <ClassifierColumn
            key="classifier"
            model={model}
            mappingSection={mappingSection}
            isWide={isThreeColumn}
          />
        );
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
      {/* CARD-VIEW-COMPARISON-POLISH-001 — the parent ("replying-to") bubble is
          the FIRST element of the panel: a full-width banner at the TOP in both
          layouts (the wrapper takes the whole first flex row in the wide
          layout, so the three columns wrap beneath it). Degrades to nothing for
          a root / unresolvable parent (the wrapper still renders empty, which
          is inert). */}
      <View style={styles.parentBubbleSlot} testID="card-detail-parent-bubble-slot">
        <ParentComparisonBubble
          bubble={model.parentComparison}
          onActivateAncestor={onActivateAncestor}
        />
      </View>
      {/* REF-003 — the synthesized one-state Referee Card, a full-width band
          ABOVE the raw classifier strip in BOTH the stacked and wide layouts
          (REF-001's "synthesized layer above #504's raw classifier strip").
          Renders only when the surface supplies a derived issue for the active
          node; omitted → nothing (the slot is inert), so #504's five zones are
          byte-unchanged. */}
      {refereeCard != null ? (
        <View style={styles.refereeCardSlot} testID="card-detail-referee-card-slot">
          <RefereeCardView
            issue={refereeCard}
            onMove={onRefereeMove}
            onRefereeNavigate={onRefereeNavigate}
            testID="referee-card-view"
          />
        </View>
      ) : null}
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
  // CARD-VIEW-COMPARISON-POLISH-001 — the full-width slot that holds the top
  // parent ("replying-to") bubble. `flexBasis: '100%'` forces the slot to take
  // the entire first flex row in the wide layout so the three columns wrap
  // beneath it; in the stacked layout it is simply the first column-child.
  parentBubbleSlot: {
    flexBasis: '100%',
    width: '100%',
  },
  // REF-003 — the full-width slot that holds the synthesized Referee Card.
  // `flexBasis: '100%'` forces the slot to take the entire flex row in the
  // wide layout so the render-order columns wrap BENEATH it (the card sits
  // above the raw classifier strip in both layouts).
  refereeCardSlot: {
    flexBasis: '100%',
    width: '100%',
  },
  // Slice 3 — the centerpiece region: the current/own message centerpiece card.
  // On the wide layout it is the central, widest column (beneath the top parent
  // banner).
  centerpieceRegion: {
    gap: SPACING.s,
    flexGrow: 2,
    flexShrink: 1,
    flexBasis: 320,
    minWidth: 260,
  },
  // CARD-VIEW-COMPARISON-POLISH-001 — the current/own message centerpiece card.
  // A DRAMATICALLY different, NON-BLACK surface (the elevated indigo-tinted
  // `raised` tone) with an actor-accent (indigo focus-ring) border, so it reads
  // as a clearly different MESSAGE TYPE from the black parent bubble above. The
  // contrast is a message-type cue, never a verdict (doctrine §1).
  centerpieceCard: {
    gap: SPACING.s,
    backgroundColor: SURFACE_TOKENS.raised,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.md,
    borderColor: SURFACE_TOKENS.focusRing,
    padding: SPACING.m,
  },
  // The current/own message "Your move" label — color-independent cue that
  // this is the responder's own move (vs the black "Replying to" bubble).
  currentMessageLabel: {
    color: SURFACE_TOKENS.focusRing,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  // The current/own message body — LARGER, readable font (the operator asked
  // for legible card text). Sized above the popout-body scale.
  currentMessageBody: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 16,
    lineHeight: 23,
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
  // CARD-VIEW-COMPARISON-POLISH-001 — section labels bumped one step (12/16)
  // above the prior chip-label size for legibility on the dense card.
  zoneHeading: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.roomStrip.fontSize,
    lineHeight: TYPOGRAPHY.roomStrip.lineHeight,
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
  // CARD-VIEW-REFINE-001 — inline ActionsZone group heading + chips. These
  // chips are USER MOVES (real buttons), styled distinctly from the
  // display-only label chips so a reader can tell an action from a label.
  actionsGroupHeading: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '600',
  },
  actionChip: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    paddingHorizontal: SPACING.m,
    minHeight: TOUCH_TARGET.minSizePx,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChipPrimary: {
    backgroundColor: SURFACE_TOKENS.focusRing,
    borderColor: SURFACE_TOKENS.focusRing,
  },
  actionChipWarning: { backgroundColor: '#9a3412', borderColor: '#9a3412' },
  actionChipCritical: { backgroundColor: '#7f1d1d', borderColor: '#7f1d1d' },
  actionChipText: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
    fontWeight: '700',
  },
  tagsGroupHeading: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '600',
  },
  // CARD-VIEW-COMPARISON-POLISH-001 — the OUTER ring of the parent bubble's
  // DOUBLE OUTLINE. `alignSelf: flex-start` + the small negative left margin
  // keep the bubble OFF-CENTER (to the left) so the centerpiece below reads as
  // the focus. The ring borderColor is the actor accent (applied inline); the
  // ring radius is one step larger than the inner bubble so the two strokes
  // read as concentric. The off-center offset + italic quote carry meaning
  // independent of color.
  parentBubbleRing: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    marginLeft: -SPACING.s,
    marginBottom: SPACING.s,
    borderRadius: RADIUS.lg + 4,
    borderWidth: BORDER_WIDTH.md,
    padding: 3,
  },
  // The INNER bubble — the TRUE-BLACK backdrop + the deeper actor border
  // stroke (both applied inline). The black fill is visually heavier than the
  // centerpiece surface, so the two message types contrast dramatically.
  parentBubble: {
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.md,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    gap: SPACING.xs,
  },
  // "Replying to" framing — small caps cue above the actor label.
  parentBubbleReplyingTo: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  parentBubbleActor: {
    fontSize: TYPOGRAPHY.roomStrip.fontSize,
    lineHeight: TYPOGRAPHY.roomStrip.lineHeight,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  // LARGER quoted parent text (the operator asked for a bigger parent quote).
  // Sized above the popout-body + current-body scale so the quote is the most
  // prominent text in the bubble.
  parentBubbleQuote: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 17,
    lineHeight: 25,
    fontStyle: 'italic',
  },
  parentBubbleRefPressable: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET.minSizePx,
    paddingVertical: 2,
  },
  parentBubbleRefText: {
    fontSize: TYPOGRAPHY.roomStrip.fontSize,
    lineHeight: TYPOGRAPHY.roomStrip.lineHeight,
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
  // CARD-VIEW-COMPARISON-POLISH-001 — band / body / chip text bumped one step
  // for legibility (the operator reported the card was hard to read).
  bandValue: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
    fontWeight: '600',
  },
  bodyText: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.composer.fontSize,
    lineHeight: TYPOGRAPHY.composer.lineHeight,
  },
  muted: {
    color: SURFACE_TOKENS.textMuted,
    fontSize: TYPOGRAPHY.composer.fontSize,
    lineHeight: TYPOGRAPHY.composer.lineHeight,
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
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
    fontWeight: '600',
  },
  // CARD-VIEW-REFINE-001 — the per-family chip strip wraps horizontally.
  classifierChipStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.s,
  },
  classifierRow: {
    gap: 2,
    flexShrink: 1,
  },
  classifierHead: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  // CARD-VIEW-REFINE-001 — source-provenance badge (plain language only).
  provenanceBadge: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderRadius: RADIUS.sm,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 1,
  },
  provenanceBadgeText: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '600',
  },
  // CARD-VIEW-REFINE-001 — evidence span shown INLINE (wide layout).
  classifierEvidenceInline: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
    flexShrink: 1,
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
  // MCP-MAPPING-EXPANSION-001 (Slice B) — combination-observation chip rows.
  // Mirror the classifier row layout so the additive section reads as one
  // coherent advisory surface beside the per-observation strip.
  mappingRow: {
    gap: 2,
    flexShrink: 1,
  },
  mappingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  mappingLabelText: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: TYPOGRAPHY.chipLabel.fontWeight,
    flexShrink: 1,
  },
  mappingDiagnostic: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
    flexShrink: 1,
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
