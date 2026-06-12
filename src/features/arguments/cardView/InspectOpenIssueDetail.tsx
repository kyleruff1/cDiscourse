/**
 * REF-004 — InspectOpenIssueDetail.
 *
 * Additive, read-only sibling overlay for the active Open Issue's full
 * detail. Mounted beside the Inspect popout exactly like the existing
 * `NodeLabelInspectGroups` / `MetadataDiffInspector` overlays (gated on
 * Inspect being open AND an active issue). It is the SINGLE home for the
 * issue's raw codes — REF-001's Inspect contract makes Inspect the only
 * place raw family IDs / rawKeys / `sourceCode`s may appear. The fixed
 * 7-section InspectPopout core (`inspectPopoutModel` / `InspectPopout`) is
 * UNTOUCHED.
 *
 * Two blocks:
 *   - Plain-language (top): relation · axis · burden · state — read from
 *     REF-002's frozen label maps (ban-list clean; carries no raw code).
 *   - Raw provenance (a clearly-diagnostic, Inspect-only sub-section):
 *     `rawIssueId` + each Observation / Allegation `sourceCode`. Empty →
 *     a one-line note (never a blank section, never a raw echo).
 *
 * Doctrine (cdiscourse-doctrine §9/§10a):
 *   - The plain block shows only plain language; raw `snake_case` codes
 *     live in the diagnostic raw block, inside Inspect, nowhere else.
 *   - Machine Observations and User Allegations stay SEPARATE lists.
 *   - No verdict / person token in any string (the raw block is labelled
 *     diagnostic; it never accuses).
 *
 * Pure presentational. RN primitives only — `View` / `Text` (no `Pressable`;
 * this is non-interactive detail). No state, no Supabase, no fetch, no AI.
 * Reduce-motion safe (fully static).
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
import type { DisagreementContract } from '../../refereeLoop';
import { buildInspectOpenIssueDetail } from '../oneBox/inspectContentBuilder';

/** Frozen copy atoms — ban-list scanned. No verdict / person token. */
export const INSPECT_OPEN_ISSUE_COPY = Object.freeze({
  /** Plain-language block sub-header. */
  plainHeader: 'Open issue',
  /** Diagnostic raw block sub-header — names it as Inspect-only. */
  rawHeader: 'Raw provenance (Inspect only)',
  /** Empty-state note when the issue carries no raw provenance. */
  emptyNote: 'No raw provenance on this issue.',
});

export interface InspectOpenIssueDetailProps {
  /** The REF-002 derived issue for the ACTIVE node. */
  issue: DisagreementContract;
  testID?: string;
}

export function InspectOpenIssueDetail({
  issue,
  testID,
}: InspectOpenIssueDetailProps): React.ReactElement | null {
  // Defensive: render nothing when there is no issue (the surface already
  // gates the mount on `refereeCardIssue != null`).
  if (issue == null) return null;

  const detail = buildInspectOpenIssueDetail(issue);
  const baseTestID = testID ?? 'inspect-open-issue-detail';

  return (
    <View style={styles.container} testID={baseTestID}>
      {/* ── Plain-language block (ban-list clean; no raw code) ── */}
      <Text
        style={styles.plainHeader}
        accessibilityRole="text"
        testID={`${baseTestID}-plain-header`}
      >
        {INSPECT_OPEN_ISSUE_COPY.plainHeader}
      </Text>
      <Text style={styles.plainLine} accessibilityRole="text" testID={`${baseTestID}-relation`}>
        {detail.relationLine}
      </Text>
      <Text style={styles.plainLine} accessibilityRole="text" testID={`${baseTestID}-axis`}>
        {detail.axisLine}
      </Text>
      <Text style={styles.plainLine} accessibilityRole="text" testID={`${baseTestID}-burden`}>
        {detail.burdenLine}
      </Text>
      <Text style={styles.plainLine} accessibilityRole="text" testID={`${baseTestID}-state`}>
        {detail.stateLine}
      </Text>

      {/* ── Raw provenance — INSPECT-ONLY diagnostic sub-section ── */}
      <View
        style={styles.rawBlock}
        accessibilityLabel="Diagnostic raw provenance for this open issue"
        testID={`${baseTestID}-raw-block`}
      >
        <Text
          style={styles.rawHeader}
          accessibilityRole="text"
          testID={`${baseTestID}-raw-header`}
        >
          {INSPECT_OPEN_ISSUE_COPY.rawHeader}
        </Text>
        {detail.hasRawProvenance ? (
          <>
            <Text style={styles.rawLine} accessibilityRole="text" testID={`${baseTestID}-raw-id`}>
              {detail.rawIssueId}
            </Text>
            {detail.rawObservationCodes.map((code, i) => (
              <Text
                key={`obs-${i}-${code}`}
                style={styles.rawLine}
                accessibilityRole="text"
                testID={`${baseTestID}-raw-observation-${i}`}
              >
                {code}
              </Text>
            ))}
            {detail.rawAllegationCodes.map((code, i) => (
              <Text
                key={`alg-${i}-${code}`}
                style={styles.rawLine}
                accessibilityRole="text"
                testID={`${baseTestID}-raw-allegation-${i}`}
              >
                {code}
              </Text>
            ))}
          </>
        ) : (
          <Text style={styles.rawLine} accessibilityRole="text" testID={`${baseTestID}-raw-empty`}>
            {INSPECT_OPEN_ISSUE_COPY.emptyNote}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.s,
    gap: SPACING.xs,
    backgroundColor: SURFACE_TOKENS.overlay,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    padding: SPACING.s,
  },
  plainHeader: {
    color: SURFACE_TOKENS.textMuted,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  plainLine: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
  },
  rawBlock: {
    marginTop: SPACING.xs,
    gap: SPACING.xs,
    borderTopWidth: BORDER_WIDTH.sm,
    borderTopColor: SURFACE_TOKENS.border,
    paddingTop: SPACING.xs,
  },
  rawHeader: {
    color: SURFACE_TOKENS.textMuted,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rawLine: {
    color: SURFACE_TOKENS.textMuted,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontFamily: 'monospace',
  },
});
