/**
 * UX-001.5A — `NodeLabelStrip` — Timeline-node consumer.
 *
 * Renders the Timeline-node display: 1 Machine Observation chip + 1
 * User Allegation chip + overflow indicator. Composes the read-only
 * UX-001.5 `AnnotationChipStrip` primitive — does NOT introduce a new
 * visual primitive (conditional trigger 4: CLEAN).
 *
 * Pipeline:
 *   1. Run the three live source adapters (manual_tag, auto_metadata,
 *      lifecycle) through `adaptAllSourcesForNode`.
 *   2. Combine via `combinePerNodeMarks` → flat array.
 *   3. Filter by surface (timeline_node) via `filterMarksBySurface` →
 *      composer_only / future_source excluded.
 *   4. Dedupe via `dedupePerNodeMarks` → within-kind only.
 *   5. Cap via `enforceTimelineNodeDisplayCap` → 1 + 1 + overflow.
 *   6. Convert each visible mark to `AnnotationChipDescriptor` via the
 *      descriptor adapter. When overflowCount > 0, append synthetic
 *      placeholder descriptors and configure AnnotationChipStrip's
 *      maxVisible so its built-in overflow chip surfaces the count.
 *
 * Doctrine:
 *   - Sensitive composer-only IDs NEVER render here (filter at step 3).
 *   - future_source codes NEVER render here.
 *   - Provenance preserved: each chip's source = 'machine' | 'user';
 *     ariaLabel prefix carries the same.
 *
 * Pure presentational. No internal state. No network. No new dependency.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { AnnotationChipStrip } from '../nodeAnnotations/AnnotationChipStrip';
import type {
  AnnotationBand,
  AnnotationChipDescriptor,
} from '../nodeAnnotations';
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
  enforceTimelineNodeDisplayCap,
  filterMarksBySurface,
} from './nodeLabelPresentationModel';
import { toAnnotationChipDescriptor } from './nodeLabelDescriptorAdapter';

export interface NodeLabelStripProps {
  /** Message id this strip is mounted for. */
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
   * this message. When supplied AND non-empty, Source 6 emits derived
   * marks; when absent / empty, Source 6 returns `[]` byte-equal.
   */
  persistedClassifierRows?: ReadonlyArray<unknown>;
  /** Resolved band; defaults to `'tablet'`. */
  band?: AnnotationBand;
  /** v1: chips are non-interactive; reserved for future override. */
  onChipPress?: undefined;
  /** Container style override. */
  style?: StyleProp<ViewStyle>;
  /** testID passthrough. */
  testID?: string;
}

interface TimelineComputeResult {
  descriptors: AnnotationChipDescriptor[];
  maxVisible: number;
  visibleCount: number;
}

/** Pure helper exported for testing. */
export function computeNodeLabelStripDescriptors(props: {
  messageId: string;
  manualTagEntries: ReadonlyArray<ManualTagEntry>;
  autoMetadataCodes: ReadonlyArray<AutoMetadataCode>;
  clusterState: PointLifecycleState;
  messageContribution: PointLifecycleState | null;
  /** MCP-021B — optional persisted classifier rows, threaded into
   *  Source 6 via the additive aggregator parameter. */
  persistedClassifierRows?: ReadonlyArray<unknown>;
}): TimelineComputeResult {
  if (typeof props.messageId !== 'string' || props.messageId.length === 0) {
    return { descriptors: [], maxVisible: 0, visibleCount: 0 };
  }
  const perNode = adaptAllSourcesForNode({
    manualTagEntries: props.manualTagEntries,
    autoMetadataCodes: props.autoMetadataCodes,
    clusterState: props.clusterState,
    messageContribution: props.messageContribution,
    messageId: props.messageId,
    persistedClassifierRows: props.persistedClassifierRows,
    surface: 'timeline_node',
  });
  const combined = combinePerNodeMarks(perNode);
  const surfaceFiltered = filterMarksBySurface(combined, 'timeline_node');
  const deduped = dedupePerNodeMarks(surfaceFiltered);
  const cap = enforceTimelineNodeDisplayCap(deduped);

  const visible: AnnotationChipDescriptor[] = [];
  if (cap.observation) visible.push(toAnnotationChipDescriptor(cap.observation));
  if (cap.allegation) visible.push(toAnnotationChipDescriptor(cap.allegation));

  if (cap.overflowCount === 0) {
    return {
      descriptors: visible,
      maxVisible: visible.length,
      visibleCount: visible.length,
    };
  }

  // Trigger AnnotationChipStrip's overflow chip: when descriptors.length
  // > maxVisible, strip renders (maxVisible - 1) chips + overflow chip
  // for (descriptors.length - (maxVisible - 1)). To render visible.length
  // chips + overflow chip for cap.overflowCount, we need:
  //   maxVisible = visible.length + 1
  //   descriptors.length = visible.length + cap.overflowCount + 1
  // Placeholder descriptors satisfy the strip's shape requirements; the
  // strip never renders them as chips because they fall into the slice
  // beyond maxVisible - 1.
  const placeholders: AnnotationChipDescriptor[] = Array.from(
    { length: cap.overflowCount + 1 },
    (_, i) => ({
      id: `node-label-overflow-placeholder-${props.messageId}-${i}`,
      label: '·',
    }),
  );
  return {
    descriptors: [...visible, ...placeholders],
    maxVisible: visible.length + 1,
    visibleCount: visible.length,
  };
}

/**
 * Timeline-node label strip. Renders nothing when no marks apply at
 * the timeline_node surface.
 */
export function NodeLabelStrip(props: NodeLabelStripProps): React.ReactElement | null {
  const computed = useMemo(
    () =>
      computeNodeLabelStripDescriptors({
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

  if (computed.descriptors.length === 0) {
    return null;
  }

  return (
    <View
      style={[styles.container, props.style]}
      testID={props.testID ?? `node-label-strip-${props.messageId}`}
    >
      <AnnotationChipStrip
        descriptors={computed.descriptors}
        maxVisible={computed.maxVisible}
        band={props.band}
        sectionId="flags"
        testID={`${props.testID ?? `node-label-strip-${props.messageId}`}-chips`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.xs,
  },
});
