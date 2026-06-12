/**
 * REF-003 — RefereeCardView.
 *
 * Renders REF-001's ratified three-zone Referee Card from REF-002's shipped
 * derivation, on the ACTIVE node's detail surface inside the existing
 * `CardDetailPanel` chassis. One coherent state per issue:
 *   - Zone 1: what this move is doing (the referee note / banner MEANING +
 *     a non-color tone glyph) OR a neutral teaching state.
 *   - Zone 2: what remains open (burden + axis, or the terminal-state line).
 *   - Zone 3: the 2–3 constructive next moves (engine + role-gate survivors).
 *
 * Pure presentational. No state, no network, no AI, no `selectBanner`, no
 * persistence. It consumes a `DisagreementContract` and derives its
 * `RefereeCardViewModel` in-component via the shipped
 * `buildRefereeCardViewModel` (REF-002 stays the single derivation owner).
 *
 * Doctrine (cdiscourse-doctrine §1/§4/§5/§9/§10a; REF-001):
 *   - Advisory, never a verdict. Derives at render time AFTER an argument is
 *     stored; never blocks a post; never says a user is wrong; never accuses
 *     motive; always offers a move (or collapses cleanly).
 *   - Zone 1 ABSORBS the referee-banner meaning — exactly one banner surface.
 *     The card renders the banner's voice as TEXT + a non-color tone glyph; it
 *     never mounts a second `RefereeBannerView` and never calls `selectBanner`.
 *   - Renders ONLY plain-language view-model fields. Raw family IDs / rawKeys /
 *     spans / `actEntryId` / `issue.id` / numeric confidence never reach the
 *     surface (those stay in Inspect — QOL-032).
 *   - Color is never the only signal: shape (tone glyph) + words carry the
 *     state; each move button has a visible border + text label.
 *   - Reduce-motion safe: the card is fully static (no Animated, no transition);
 *     `reduceMotionOverride` is accepted for parity and is a no-op.
 *
 * RN primitives only — `View` / `Text` / `Pressable`. No new dependency.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BORDER_WIDTH,
  RADIUS,
  SPACING,
  SURFACE_TOKENS,
  TOUCH_TARGET,
  TYPOGRAPHY,
} from '../../../lib/designTokens';
import type { DisagreementContract, MoveSuggestion } from '../../refereeLoop';
import { buildRefereeCardViewModel } from '../../refereeLoop';
import { CARD_CLASSIFIER_ADVISORY_CAPTION } from './cardClassifierStripModel';
// Glyph-char map ONLY — the non-color tone glyph (a SHAPE). The
// `RefereeBannerView` COMPONENT is intentionally NOT imported (zone 1 absorbs
// the banner meaning; the panel gains no second banner element). The
// no-second-banner test pins both the import and the absent testID.
import { BANNER_TONE_GLYPH_CHAR } from '../../refereeBanners/RefereeBannerView';

/**
 * Neutral teaching empty state — shown when the active move has no referee
 * observation AND the relation is the neutral `replies` fallback. Never an
 * error, never a blocker, never "clean" / "no issues" (which would read as a
 * verdict). Ban-list scanned. A locked sibling of `CARD_CLASSIFIER_EMPTY_STATE`.
 */
export const REFEREE_CARD_EMPTY_STATE = 'No referee notes yet on this move.';

/**
 * REF-004 — the two non-Act navigation verbs the card's secondary affordance
 * row dispatches: open Inspect on the active node, or focus the board on the
 * issue. Combined under ONE optional `onRefereeNavigate` prop to keep the
 * additive plumbing footprint to one prop per level.
 */
export type RefereeNavVerb = 'inspect' | 'focus_on_board';

export interface RefereeCardViewProps {
  /** The REF-002 derived issue for the ACTIVE node. The component derives the
   *  RefereeCardViewModel via the shipped `buildRefereeCardViewModel`. */
  issue: DisagreementContract;
  /** v1 deep-link handler for a zone-3 move button. REF-004 swaps the surface
   *  implementation for full Act-popout routing; this leaf signature is stable. */
  onMove?: (move: MoveSuggestion) => void;
  /** REF-004 — secondary navigation affordances (Inspect / Focus on board).
   *  When omitted, the secondary row does not render → byte-equivalent to
   *  REF-003 (pinned by the REF-003 direct-render suites). */
  onRefereeNavigate?: (verb: RefereeNavVerb) => void;
  /** Accepted for parity; the card never animates (reduce-motion is a no-op). */
  reduceMotionOverride?: boolean;
  testID?: string;
}

export function RefereeCardView({
  issue,
  onMove,
  onRefereeNavigate,
  reduceMotionOverride,
  testID,
}: RefereeCardViewProps): React.ReactElement | null {
  // The reduce-motion prop is accepted for parity; the card never animates,
  // so honoring it is a no-op. Referenced so lint does not flag it unused and
  // a test can assert the contract.
  void reduceMotionOverride;

  // REF-002 is the single derivation owner — call the shipped mapper once for
  // every RENDERED string. `issue.refereeObservations.length` (presence only),
  // `issue.targetQuote`, and `issue.nextBestMoves` (handler payload) are read
  // off the contract; no raw mark / code is rendered.
  const vm = buildRefereeCardViewModel(issue);

  // Teaching state: no referee observation AND the neutral `replies` fallback
  // relation (no banner, no observation). Otherwise zone 1 shows the
  // observation/relation line.
  const showTeaching =
    issue.refereeObservations.length === 0 && issue.relationToParent === 'replies';

  const zone1Text = showTeaching ? REFEREE_CARD_EMPTY_STATE : vm.zone1RelationLine;
  const glyphChar =
    !showTeaching && vm.zone1ToneGlyph != null
      ? BANNER_TONE_GLYPH_CHAR[vm.zone1ToneGlyph]
      : null;

  const hasMoves = vm.zone3Moves.length > 0;

  // REF-004 — the secondary navigation affordance row renders only when the
  // surface opts in by supplying `onRefereeNavigate`. "Focus on board" is
  // additionally gated on a real target node (nothing to jump to otherwise).
  const showNav = onRefereeNavigate != null;
  const showFocus = showNav && issue.targetNodeId != null;

  return (
    <View
      style={styles.card}
      accessibilityLabel="Referee card"
      testID={testID ?? 'referee-card-view'}
    >
      {/* Advisory caption — reused, imported constant (can never drift). */}
      <Text style={styles.caption} accessibilityRole="text" testID="referee-card-caption">
        {CARD_CLASSIFIER_ADVISORY_CAPTION}
      </Text>

      {/* Optional "point under dispute" anchor — verbatim user text, quoted. */}
      {issue.targetQuote != null ? (
        <Text
          style={styles.anchor}
          accessibilityRole="text"
          accessibilityLabel={`Point under dispute: "${issue.targetQuote}"`}
          testID="referee-card-anchor"
        >
          {`Point under dispute: "${issue.targetQuote}"`}
        </Text>
      ) : null}

      {/* The note block (anchor + zone 1 + zone 2) is ONE screen-reader stop
          carrying the complete sentence; the visible children carry the same
          content. The tone glyph is hidden from the SR tree — the tone is in
          the words. */}
      <View
        style={styles.noteBlock}
        accessibilityRole="text"
        accessibilityLabel={vm.accessibilityLabel}
        testID="referee-card-note-block"
      >
        <View style={styles.zone1Row}>
          {glyphChar != null ? (
            <Text
              style={styles.glyph}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              testID="referee-card-tone-glyph"
            >
              {glyphChar}
            </Text>
          ) : null}
          <Text style={styles.zone1Text} testID="referee-card-zone1">
            {zone1Text}
          </Text>
        </View>
        <Text style={styles.zone2Text} testID="referee-card-zone2">
          {vm.zone2OpenTaskLine}
        </Text>
      </View>

      {/* Zone 3 — the 2–3 constructive next moves. Collapses (renders nothing)
          when empty (observer / own-bubble / no survivor). Each move is a
          separate focusable button. */}
      {hasMoves ? (
        <View style={styles.movesRow} testID="referee-card-moves">
          {vm.zone3Moves.map((move) => (
            <Pressable
              key={move.actEntryId}
              style={styles.moveButton}
              onPress={() => onMove?.(move)}
              accessibilityRole="button"
              accessibilityLabel={move.accessibilityLabel}
              accessibilityState={{ disabled: false }}
              hitSlop={TOUCH_TARGET.hitSlopAll}
              testID={`referee-card-move-${move.actEntryId}`}
            >
              <Text style={styles.moveLabel}>{move.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* REF-004 — secondary navigation affordance row (Inspect / Focus on
          board). Visually subordinate to the zone-3 moves; wraps on narrow
          viewports. Renders only when `onRefereeNavigate` is supplied. */}
      {showNav ? (
        <View style={styles.navRow} testID="referee-card-nav-row">
          <Pressable
            style={styles.navButton}
            onPress={() => onRefereeNavigate?.('inspect')}
            accessibilityRole="button"
            accessibilityLabel="View the full detail for this open issue"
            accessibilityState={{ disabled: false }}
            hitSlop={TOUCH_TARGET.hitSlopAll}
            testID="referee-card-nav-inspect"
          >
            <Text style={styles.navLabel}>View details</Text>
          </Pressable>
          {showFocus ? (
            <Pressable
              style={styles.navButton}
              onPress={() => onRefereeNavigate?.('focus_on_board')}
              accessibilityRole="button"
              accessibilityLabel="Focus the board on this open issue"
              accessibilityState={{ disabled: false }}
              hitSlop={TOUCH_TARGET.hitSlopAll}
              testID="referee-card-nav-focus"
            >
              <Text style={styles.navLabel}>Focus on board</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: SPACING.xs,
    backgroundColor: SURFACE_TOKENS.raised,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.md,
    borderColor: SURFACE_TOKENS.focusRing,
    padding: SPACING.m,
  },
  caption: {
    color: SURFACE_TOKENS.textMuted,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  anchor: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
    fontStyle: 'italic',
  },
  noteBlock: {
    gap: SPACING.xs,
  },
  zone1Row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
  },
  glyph: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.composer.fontSize,
    lineHeight: TYPOGRAPHY.composer.lineHeight,
    fontWeight: '700',
  },
  zone1Text: {
    flex: 1,
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.composer.fontSize,
    lineHeight: TYPOGRAPHY.composer.lineHeight,
    fontWeight: '700',
  },
  zone2Text: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
  },
  movesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  moveButton: {
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.md,
    borderColor: SURFACE_TOKENS.focusRing,
    backgroundColor: SURFACE_TOKENS.overlay,
  },
  moveLabel: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
    fontWeight: '700',
  },
  // REF-004 — secondary affordance row. Subordinate to the zone-3 moves:
  // transparent fill + lighter border + secondary text + chip-size label.
  navRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  navButton: {
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: 'transparent',
  },
  navLabel: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '600',
  },
});
