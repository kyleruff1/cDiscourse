/**
 * UX-MEDIATOR-002 — Mediator-state detail block (Inspect overlay).
 *
 * A small, READ-ONLY block rendered INSIDE the existing Inspect overlay (a
 * sibling of `NodeLabelInspectGroups`) that preserves the "why" behind the one
 * default node chip after the chip-soup collapse: the structural state label,
 * its plain-language helper sentence, and the next-useful-move pathway label.
 *
 * No intelligence is deleted by the one-chip collapse — it is relocated here.
 * This block carries the mediator structural state; `NodeLabelInspectGroups`
 * (its sibling) carries the Machine-Observation / User-Allegation detail. The
 * two stay separate (§10a) — this block never renders Observation/Allegation
 * chips itself.
 *
 * Doctrine: pure presentation over a pre-selected `NodeMediatorMarker`
 * (UX-MEDIATOR-002 helper) + already-derived helper / pathway copy
 * (UX-MEDIATOR-001 plain-language maps). No derivation, no network, no
 * mutation, never a submission gate, no verdict / person / intent copy. RN
 * primitives only; reuses existing tokens (no new hex literal). Renders
 * nothing when there is no actionable marker — exactly like the chip itself.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BORDER_WIDTH, RADIUS, SPACING, SURFACE_TOKENS, TYPOGRAPHY } from '../../lib/designTokens';
import { looksLikeInternalCode } from '../arguments/gameCopy';
import type { NodeMediatorMarker } from './nodeMediatorMarkers';

export interface MediatorNodeInspectDetailProps {
  /** The pre-selected primary-state marker, or null to render nothing. */
  marker: NodeMediatorMarker | null;
  /**
   * Plain-language helper sentence for the marker's state
   * (`helperForMediatorState`). What the state means + a neutral next step.
   */
  helper: string;
  /**
   * Plain-language label for the next-useful-move pathway step
   * (`plainLanguageForPathwayStep`), or null when no pathway is available
   * (e.g. structured impasse) — the row is then omitted.
   */
  nextMoveLabel: string | null;
  testID?: string;
}

/**
 * Read-only mediator-state detail for the active node, shown in Inspect.
 * Mirrors the one-chip suppression contract: null marker → null render, and a
 * label that reads as an internal code is suppressed.
 */
export function MediatorNodeInspectDetail({
  marker,
  helper,
  nextMoveLabel,
  testID,
}: MediatorNodeInspectDetailProps): React.ReactElement | null {
  if (!marker) return null;
  // Defensive: never render anything that reads as a raw internal code.
  const stateLabel = looksLikeInternalCode(marker.label) ? '' : marker.label;
  if (stateLabel.length === 0) return null;

  const safeHelper =
    typeof helper === 'string' && helper.length > 0 && !looksLikeInternalCode(helper)
      ? helper
      : '';
  const safeNextMove =
    typeof nextMoveLabel === 'string' &&
    nextMoveLabel.length > 0 &&
    !looksLikeInternalCode(nextMoveLabel)
      ? nextMoveLabel
      : '';

  const baseTestID = testID ?? `mediator-node-inspect-detail-${marker.nodeId}`;

  return (
    <View
      style={[styles.wrap, marker.isImpasse && styles.wrapImpasse]}
      testID={baseTestID}
    >
      <Text style={styles.groupHeader} accessibilityRole="header">
        Mediator state
      </Text>
      <Text
        style={styles.stateLabel}
        accessibilityRole="text"
        testID={`${baseTestID}-state`}
      >
        {stateLabel}
      </Text>
      {safeHelper.length > 0 ? (
        <Text
          style={styles.helper}
          accessibilityRole="text"
          testID={`${baseTestID}-helper`}
        >
          {safeHelper}
        </Text>
      ) : null}
      {safeNextMove.length > 0 ? (
        <Text
          style={styles.nextMove}
          accessibilityRole="text"
          testID={`${baseTestID}-next-move`}
        >
          {`What would help next: ${safeNextMove}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: SPACING.s,
    backgroundColor: SURFACE_TOKENS.elevated,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
  },
  // Structured impasse — a left rule (geometry, not color alone), mirroring
  // MediatorNodeMarker's calm terminal-state treatment.
  wrapImpasse: {
    borderLeftWidth: BORDER_WIDTH.lg,
    borderLeftColor: SURFACE_TOKENS.focusRing,
  },
  groupHeader: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.popoutHeading.fontSize,
    lineHeight: TYPOGRAPHY.popoutHeading.lineHeight,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  stateLabel: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    fontWeight: '700',
  },
  helper: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.inspectDetail.fontSize,
    lineHeight: TYPOGRAPHY.inspectDetail.lineHeight,
    fontWeight: '400',
    marginTop: SPACING.xs,
  },
  nextMove: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.inspectDetail.fontSize,
    lineHeight: TYPOGRAPHY.inspectDetail.lineHeight,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
});
