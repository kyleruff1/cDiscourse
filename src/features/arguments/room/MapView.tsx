/**
 * ASP-EXTRACT-001 (Slice 1) — MapView, the timeline-map lens.
 *
 * A thin pass-through wrapper over the shipped ArgumentTimelineMap (the
 * mode === timeline branch of the room surface). It renders the exact
 * timeline sub-tree the orchestrator used to render inline: the
 * ArgumentTimelineMap plus the QUOTE-FORGE-001 create-link affordance.
 *
 * MapView owns NO state, NO derivation, NO handler. Every value arrives as
 * a prop from the orchestrator (ArgumentGameSurface for Slice 1). The three
 * timeline inline arrows (jump-latest, jump-to-root, open-details) and the
 * view-linked-prior-context arrow were lifted into named handlers in the
 * orchestrator and are passed here already-bound, so the rendered behavior
 * is byte-identical to the inline branch. This is the future Ringside
 * Exchange map target; today a faithful extraction.
 *
 * Doctrine: MapView does NOT re-derive the mediator board (that stays a
 * single derivation in the orchestrator) and does NOT touch band / heat /
 * standing rendering (it forwards the already-band-neutral map straight
 * through). No verdict tokens. No AI. No Supabase. No service-role.
 */
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { ArgumentTimelineMap } from '../ArgumentTimelineMap';
import type {
  ArgumentBubbleControl,
  ArgumentBubbleViewModel,
  ArgumentTimelineMapModel,
} from '../argumentGameSurfaceModel';
import type { EvidenceArtifact, NodeEvidenceDebtSummary, TimelineEvidenceContract } from '../../evidence';
import type {
  TimelineNodeActionDockActionCode,
  TimelineNodeActionDockModel,
  TimelineNodeActionDockTarget,
} from '../timelineNodeActionDockModel';
import type { LinkedPriorArgumentChip } from '../crossRoom/linkedPriorArgumentModel';
import { LINKED_PRIOR_ARGUMENT_COPY } from '../crossRoom/linkedPriorArgumentCopy';

export interface MapViewProps {
  // ArgumentTimelineMap core inputs (forwarded verbatim).
  map: ArgumentTimelineMapModel;
  activeViewModel: ArgumentBubbleViewModel | null;
  totalCount: number;
  artifactsByMessageId: Record<string, ReadonlyArray<EvidenceArtifact>>;
  selectedTarget: TimelineNodeActionDockTarget | null;
  actionDockModel: TimelineNodeActionDockModel | null;
  actingOnLabel: string | null;
  isReadModeViewer: boolean;
  reduceMotionOverride?: boolean;

  // Per-node lookups (defined once in the orchestrator).
  evidenceContractFor: (messageId: string) => TimelineEvidenceContract | null;
  evidenceDebtSummaryFor: (messageId: string) => NodeEvidenceDebtSummary | null;

  // Handlers (defined once in the orchestrator, passed already-bound).
  onActivate: (messageId: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onJumpLatest: () => void;
  onJumpToRoot: () => void;
  onToggleMode: () => void;
  onAction: (control: ArgumentBubbleControl, messageId: string) => void;
  onOpenDetails: (messageId: string) => void;
  onSelectTarget: (target: TimelineNodeActionDockTarget | null) => void;
  onActionDockAction: (action: TimelineNodeActionDockActionCode, target: TimelineNodeActionDockTarget) => void;
  onOpenCardsDetail: (target: TimelineNodeActionDockTarget) => void;

  // QUOTE-FORGE-001 linked-prior threading (all optional, back-compat safe).
  linkedPriorChips?: ReadonlyArray<LinkedPriorArgumentChip>;
  onOpenLinkedPrior?: (linkId: string) => void;
  onViewLinkedPriorContext?: (linkId: string) => void;
  // Drives the create-link affordance. Renders only when supplied, keeping
  // the default header calm.
  onOpenLinkPicker?: () => void;
}

/**
 * The timeline-map lens. Renders the ArgumentTimelineMap plus the optional
 * create-link affordance. Presentational only; every value is a prop.
 */
export function MapView(props: MapViewProps) {
  return (
    <>
      {/* UX-001.2 — Timeline is the first substantive board object
          under the AppHeader + compact strip. Score tracker and
          selected-readout move BELOW the Timeline so the rail
          appears within the brief hard cap (200 px wide / 168 px
          tablet / 128 px phone). */}
      <ArgumentTimelineMap
        map={props.map}
        onActivate={props.onActivate}
        onPrev={props.onPrev}
        onNext={props.onNext}
        onJumpLatest={props.onJumpLatest}
        onJumpToRoot={props.onJumpToRoot}
        onToggleMode={props.onToggleMode}
        activeViewModel={props.activeViewModel}
        totalCount={props.totalCount}
        onAction={props.onAction}
        onOpenDetails={props.onOpenDetails}
        artifactsByMessageId={props.artifactsByMessageId}
        evidenceContractFor={props.evidenceContractFor}
        evidenceDebtSummaryFor={props.evidenceDebtSummaryFor}
        isReadModeViewer={props.isReadModeViewer}
        selectedTarget={props.selectedTarget}
        actionDockModel={props.actionDockModel}
        actingOnLabel={props.actingOnLabel}
        onSelectTarget={props.onSelectTarget}
        onActionDockAction={props.onActionDockAction}
        onOpenCardsDetail={props.onOpenCardsDetail}
        reduceMotionOverride={props.reduceMotionOverride}
        // QUOTE-FORGE-001 — light the cross-room linked-prior wire.
        // The room shell loads the links and builds the chip view
        // models; the timeline already renders the chip row through
        // its own seams. title_only / unavailable chips disable Open
        // in the model, so onOpenLinkedPrior only fires for authorized
        // links.
        linkedPriorChips={props.linkedPriorChips}
        onOpenLinkedPrior={props.onOpenLinkedPrior}
        onViewLinkedPriorContext={props.onViewLinkedPriorContext}
      />
      {/* QUOTE-FORGE-001 — the create-link affordance is a single
          lightweight timeline-header entry that opens the picker
          sheet on demand. It renders only when the room shell
          supplies onOpenLinkPicker, keeping the default header calm. */}
      {props.onOpenLinkPicker ? (
        <Pressable
          onPress={props.onOpenLinkPicker}
          accessibilityRole="button"
          accessibilityLabel={LINKED_PRIOR_ARGUMENT_COPY.createAffordance}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="link-target-create-affordance-entry"
          style={styles.linkAffordance}
        >
          <Text style={styles.linkAffordanceGlyph}>{'⤴ '}</Text>
          <Text style={styles.linkAffordanceText}>
            {LINKED_PRIOR_ARGUMENT_COPY.createAffordance}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  linkAffordance: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 8,
    marginTop: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    minHeight: 32,
  },
  linkAffordanceGlyph: { color: '#a5b4fc', fontWeight: '800' as const, fontSize: 12 },
  linkAffordanceText: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' as const },
});
