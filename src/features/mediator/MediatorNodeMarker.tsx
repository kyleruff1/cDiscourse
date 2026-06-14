/**
 * UX-MEDIATOR-002 — Node-level mediator marker.
 *
 * A compact, READ-ONLY badge that shows the single primary mediator state for
 * a timeline node (the active node, in v1), beside the existing node-label
 * surface. Pure presentation over a pre-selected `NodeMediatorMarker`
 * (UX-MEDIATOR-002 helper over UX-MEDIATOR-001's board) — no derivation, no
 * network, no mutation, never a submission gate, no action verbs.
 *
 * Doctrine: the label is a plain-language atom (suppressed if it would read as
 * an internal code). `structured_impasse` gets a calm, geometry-distinct
 * treatment (a left rule), never color-only. RN primitives only.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BORDER_WIDTH, RADIUS, SPACING, SURFACE_TOKENS, TYPOGRAPHY } from '../../lib/designTokens';
import { looksLikeInternalCode } from '../arguments/gameCopy';
import type { NodeMediatorMarker } from './nodeMediatorMarkers';

export interface MediatorNodeMarkerProps {
  /** The pre-selected marker, or null to render nothing. */
  marker: NodeMediatorMarker | null;
  testID?: string;
}

export function MediatorNodeMarker({
  marker,
  testID,
}: MediatorNodeMarkerProps): React.ReactElement | null {
  if (!marker) return null;
  // Defensive: never render anything that reads as a raw internal code.
  const label = looksLikeInternalCode(marker.label) ? '' : marker.label;
  if (label.length === 0) return null;

  return (
    <View
      style={[styles.wrap, marker.isImpasse && styles.wrapImpasse]}
      testID={testID ?? `mediator-node-marker-${marker.nodeId}`}
    >
      <Text
        style={styles.label}
        numberOfLines={1}
        accessibilityRole="text"
        accessibilityLabel={`Mediator note: ${label}`}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    backgroundColor: SURFACE_TOKENS.raised,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.s,
    paddingVertical: 2,
  },
  // Structured impasse — a left rule (geometry, not color alone) marks the
  // calm terminal state distinctly from the actionable markers.
  wrapImpasse: {
    borderLeftWidth: 3,
    borderLeftColor: SURFACE_TOKENS.focusRing,
  },
  label: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    fontWeight: '700',
  },
});
