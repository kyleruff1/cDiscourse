/**
 * UX-001.5A — `NodeLabelInspectGroups` — Inspect-popout consumer.
 *
 * Renders the Inspect grouped view: a "Machine Observations" group +
 * a "User Allegations" group, each with `InspectGroupHeader` + a
 * dedicated `InspectSectionChipStrip`. Composes the read-only UX-001.5
 * primitives — does NOT introduce a new visual primitive (conditional
 * trigger 4: CLEAN).
 *
 * Pipeline:
 *   1. Run the three live source adapters.
 *   2. Combine, filter by inspect surface (composer_only excluded;
 *      inspect_only INCLUDED here unlike timeline_node).
 *   3. Dedupe within-kind.
 *   4. Build unbounded grouped view via `enforceInspectGroupedView`.
 *   5. Render two `InspectGroupHeader` + two `InspectSectionChipStrip`
 *      blocks.
 *
 * Doctrine:
 *   - Sensitive composer-only IDs NEVER render here (filter at step 2).
 *   - future_source codes NEVER render here.
 *   - Provenance preserved on every chip.
 *   - When BOTH groups are empty, renders nothing.
 *
 * Pure presentational. No internal state. No network. No new dependency.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { InspectGroupHeader } from '../nodeAnnotations/InspectGroupHeader';
import { InspectSectionChipStrip } from '../nodeAnnotations/InspectSectionChipStrip';
import type { AnnotationBand } from '../nodeAnnotations';
import type {
  AutoMetadataCode,
  ManualTagEntry,
} from '../metadata/moveMetadataLedger';
import type { PointLifecycleState } from '../lifecycle/pointLifecycleModel';
import { SPACING } from '../../lib/designTokens';
import { adaptAllSourcesForNode } from './nodeLabelSourceAdapters';
import {
  combinePerNodeMarks,
  dedupePerNodeMarks,
  enforceInspectGroupedView,
  filterMarksBySurface,
} from './nodeLabelPresentationModel';
import { toAnnotationChipDescriptors } from './nodeLabelDescriptorAdapter';

export interface NodeLabelInspectGroupsProps {
  /** Message id this group view is mounted for. */
  messageId: string;
  /** Manual-tag entries hydrated from `pointTagsByArgumentId`. */
  manualTagEntries: ReadonlyArray<ManualTagEntry>;
  /** Auto-metadata codes pre-derived for this message. */
  autoMetadataCodes: ReadonlyArray<AutoMetadataCode>;
  /** Cluster-level lifecycle state for this message's cluster. */
  clusterState: PointLifecycleState;
  /** Optional per-message contribution. */
  messageContribution: PointLifecycleState | null;
  /**
   * MCP-021B — Optional persisted Machine Observation result rows for
   * this message. Threaded into Source 6 with surface `'inspect'` (the
   * lower-confidence-floor path).
   */
  persistedClassifierRows?: ReadonlyArray<unknown>;
  /** Resolved band; defaults to `'tablet'`. */
  band?: AnnotationBand;
  /** Container style override. */
  style?: StyleProp<ViewStyle>;
  /** testID passthrough. */
  testID?: string;
}

interface InspectGroupsComputeResult {
  observationDescriptors: ReturnType<typeof toAnnotationChipDescriptors>;
  allegationDescriptors: ReturnType<typeof toAnnotationChipDescriptors>;
  observationCount: number;
  allegationCount: number;
}

/** Pure helper exported for testing. */
export function computeNodeLabelInspectGroups(props: {
  messageId: string;
  manualTagEntries: ReadonlyArray<ManualTagEntry>;
  autoMetadataCodes: ReadonlyArray<AutoMetadataCode>;
  clusterState: PointLifecycleState;
  messageContribution: PointLifecycleState | null;
  /** MCP-021B — optional persisted classifier rows, threaded into
   *  Source 6 via the additive aggregator parameter. */
  persistedClassifierRows?: ReadonlyArray<unknown>;
}): InspectGroupsComputeResult {
  if (typeof props.messageId !== 'string' || props.messageId.length === 0) {
    return {
      observationDescriptors: [],
      allegationDescriptors: [],
      observationCount: 0,
      allegationCount: 0,
    };
  }
  const perNode = adaptAllSourcesForNode({
    manualTagEntries: props.manualTagEntries,
    autoMetadataCodes: props.autoMetadataCodes,
    clusterState: props.clusterState,
    messageContribution: props.messageContribution,
    messageId: props.messageId,
    persistedClassifierRows: props.persistedClassifierRows,
    surface: 'inspect',
  });
  const combined = combinePerNodeMarks(perNode);
  const surfaceFiltered = filterMarksBySurface(combined, 'inspect');
  const deduped = dedupePerNodeMarks(surfaceFiltered);
  const grouped = enforceInspectGroupedView(deduped);
  return {
    observationDescriptors: toAnnotationChipDescriptors(grouped.observations),
    allegationDescriptors: toAnnotationChipDescriptors(grouped.allegations),
    observationCount: grouped.observations.length,
    allegationCount: grouped.allegations.length,
  };
}

/**
 * Inspect grouped view: "Machine Observations" + "User Allegations".
 * Renders nothing when both groups are empty.
 */
export function NodeLabelInspectGroups(
  props: NodeLabelInspectGroupsProps,
): React.ReactElement | null {
  const computed = useMemo(
    () =>
      computeNodeLabelInspectGroups({
        messageId: props.messageId,
        manualTagEntries: props.manualTagEntries,
        autoMetadataCodes: props.autoMetadataCodes,
        clusterState: props.clusterState,
        messageContribution: props.messageContribution,
        persistedClassifierRows: props.persistedClassifierRows,
      }),
    [
      props.messageId,
      props.manualTagEntries,
      props.autoMetadataCodes,
      props.clusterState,
      props.messageContribution,
      props.persistedClassifierRows,
    ],
  );

  if (computed.observationCount === 0 && computed.allegationCount === 0) {
    return null;
  }

  const baseTestID = props.testID ?? `node-label-inspect-groups-${props.messageId}`;

  return (
    <View style={[styles.container, props.style]} testID={baseTestID}>
      <View style={styles.group}>
        <InspectGroupHeader
          label="Machine Observations"
          count={computed.observationCount}
          testID={`${baseTestID}-observations-header`}
        />
        <InspectSectionChipStrip
          sectionId="flags"
          descriptors={computed.observationDescriptors}
          band={props.band}
          testID={`${baseTestID}-observations-strip`}
        />
      </View>
      <View style={styles.group}>
        <InspectGroupHeader
          label="User Allegations"
          count={computed.allegationCount}
          testID={`${baseTestID}-allegations-header`}
        />
        <InspectSectionChipStrip
          sectionId="flags"
          descriptors={computed.allegationDescriptors}
          band={props.band}
          testID={`${baseTestID}-allegations-strip`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.s,
  },
  group: {
    marginBottom: SPACING.s,
  },
});
