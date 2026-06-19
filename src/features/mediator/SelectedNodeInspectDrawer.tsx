/**
 * UX-SELECTED-NODE-001 — SelectedNodeInspectDrawer (O-4 wrapper).
 *
 * A small, pure, READ-ONLY presentational wrapper that sections the FOUR
 * already-mounted Inspect sibling overlays of `ArgumentGameSurface` into the
 * v4 drawer's four named sections so they read as ONE coherent drawer:
 *
 *   - "Why this state"        → `MediatorNodeInspectDetail`   (whyThisState slot)
 *   - "Other structure notes" → `NodeLabelInspectGroups`      (structureNotes slot)
 *   - "Move forward:"         → the board pathway move (lives in the
 *                                MediatorNodeInspectDetail block today; the
 *                                section header carries the v4 vocabulary —
 *                                see moveForward slot, optional)
 *   - "History"               → `MetadataDiffInspector`       (history slot)
 *
 * The siblings themselves are COMPOSED (passed in as slots), never modified.
 * This wrapper adds ONLY the four section headers + the deep-provenance slot
 * (REF-004's `InspectOpenIssueDetail`, which has no header — it is the issue's
 * raw provenance, kept under "Other structure notes" as a sub-slot).
 *
 * Doctrine (cdiscourse-doctrine):
 *   - §1: read-only; imports nothing from the engine; gates nothing. The
 *     headers explain STRUCTURE ("Why this state"), never the person.
 *   - §9: every header is plain English; no internal code / snake_case.
 *   - §10a: the Observations-vs-Allegations separation is preserved by the
 *     `NodeLabelInspectGroups` slot itself; this wrapper never collapses them.
 *
 * RN primitives only (`View` / `Text`); reuses existing tokens (no new hex).
 * Headers are `<Text accessibilityRole="header">` so screen readers can
 * traverse the four sections. Each section is omitted cleanly when its slot
 * is null (a section with no content renders no header, no empty chrome).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BORDER_WIDTH, RADIUS, SPACING, SURFACE_TOKENS, TYPOGRAPHY } from '../../lib/designTokens';

export interface SelectedNodeInspectDrawerProps {
  /** "Why this state" content — the MediatorNodeInspectDetail block. */
  whyThisState?: React.ReactNode;
  /**
   * "Other structure notes" content — the NodeLabelInspectGroups overlay
   * (Machine Observations / User Allegations) plus, optionally, the REF-004
   * deep-provenance detail as a sub-slot.
   */
  structureNotes?: React.ReactNode;
  /** REF-004 deep provenance — rendered under "Other structure notes". */
  structureProvenance?: React.ReactNode;
  /**
   * "Move forward:" content — the board pathway move. Optional: when the
   * shipped MediatorNodeInspectDetail already carries the next-move line
   * (O-5 default), pass null and let the "Why this state" block render it;
   * the "Move forward:" header is then suppressed to avoid a dangling header.
   */
  moveForward?: React.ReactNode;
  /** "History" content — the MetadataDiffInspector block. */
  history?: React.ReactNode;
  testID?: string;
}

interface SectionProps {
  header: string;
  children: React.ReactNode;
  testID: string;
  headerTestID: string;
}

function DrawerSection({ header, children, testID, headerTestID }: SectionProps) {
  return (
    <View style={styles.section} testID={testID}>
      <Text
        style={styles.sectionHeader}
        accessibilityRole="header"
        testID={headerTestID}
      >
        {header}
      </Text>
      {children}
    </View>
  );
}

/**
 * Sections the four shipped Inspect siblings into the v4 drawer's four named
 * sections. Returns null when there is nothing to render at all (the host
 * already gates on `inspectVisible && activeMessageId`, but this keeps the
 * wrapper safe to mount unconditionally).
 */
export function SelectedNodeInspectDrawer({
  whyThisState,
  structureNotes,
  structureProvenance,
  moveForward,
  history,
  testID,
}: SelectedNodeInspectDrawerProps): React.ReactElement | null {
  const hasAny =
    whyThisState != null ||
    structureNotes != null ||
    structureProvenance != null ||
    moveForward != null ||
    history != null;
  if (!hasAny) return null;

  return (
    <View style={styles.drawer} testID={testID ?? 'selected-node-inspect-drawer'}>
      {whyThisState != null ? (
        <DrawerSection
          header="Why this state"
          testID="selected-node-inspect-section-why"
          headerTestID="selected-node-inspect-header-why"
        >
          {whyThisState}
        </DrawerSection>
      ) : null}

      {structureNotes != null || structureProvenance != null ? (
        <DrawerSection
          header="Other structure notes"
          testID="selected-node-inspect-section-structure"
          headerTestID="selected-node-inspect-header-structure"
        >
          {structureNotes}
          {structureProvenance}
        </DrawerSection>
      ) : null}

      {moveForward != null ? (
        <DrawerSection
          header="Move forward:"
          testID="selected-node-inspect-section-move"
          headerTestID="selected-node-inspect-header-move"
        >
          {moveForward}
        </DrawerSection>
      ) : null}

      {history != null ? (
        <DrawerSection
          header="History"
          testID="selected-node-inspect-section-history"
          headerTestID="selected-node-inspect-header-history"
        >
          {history}
        </DrawerSection>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    marginTop: SPACING.xs,
  },
  section: {
    marginBottom: SPACING.s,
  },
  // The section header is a distinct typographic level ABOVE the overlays'
  // own internal group headers (e.g. NodeLabelInspectGroups' "Machine
  // Observations"). A left rule (geometry, not color alone) marks it as a
  // section lead so it never reads as a duplicate of the inner group header.
  sectionHeader: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutHeading.fontSize,
    lineHeight: TYPOGRAPHY.popoutHeading.lineHeight,
    fontWeight: '800',
    marginBottom: SPACING.xs,
    paddingLeft: SPACING.s,
    borderLeftWidth: BORDER_WIDTH.lg,
    borderLeftColor: SURFACE_TOKENS.focusRing,
    borderTopLeftRadius: RADIUS.sm,
    borderBottomLeftRadius: RADIUS.sm,
  },
});
