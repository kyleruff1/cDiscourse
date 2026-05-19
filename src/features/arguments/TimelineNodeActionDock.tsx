/**
 * SC-004 — Timeline node action dock UI.
 *
 * Bottom dock anchored above the safe-area inset. Renders one primary
 * action button + a horizontal ScrollView of secondary action chips + a
 * cluster header strip + per-move chip area + a Close affordance.
 *
 * Reuses RN core primitives only: `Pressable`, `View`, `Text`,
 * `ScrollView`, `StyleSheet`, `AccessibilityInfo`. No new dependency,
 * no animation library, no popover library.
 *
 * The dock RECOMMENDS, never BLOCKS. Even disabled actions stay visible
 * (dimmed) and surface helper copy.
 *
 * Doctrine:
 *   - The component never calls Supabase, `fetch`, any router, or
 *     `Linking`.
 *   - Actions dispatch to the parent through `onAction` / `onOpenCardsDetail`
 *     / `onExpandBranch` / `onDismiss`. The parent owns the composer +
 *     `submit-argument` path.
 *   - Color is never the only signal. Primary vs secondary is also
 *     distinguished by shape (pill vs rect) + border weight. Disabled is
 *     also distinguished by reduced opacity + an a11y suffix "(unavailable)".
 */
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  TimelineNodeActionDockAction,
  TimelineNodeActionDockActionCode,
  TimelineNodeActionDockModel,
  TimelineNodeActionDockTarget,
} from './timelineNodeActionDockModel';

interface Props {
  /** The model produced by `buildTimelineNodeActionDockModel`. `null` =
   *  no selection; the component returns `null`. */
  model: TimelineNodeActionDockModel | null;
  /** Generic action dispatch. The room shell routes to the composer + the
   *  existing `submit-argument` Edge Function via the usual seam. */
  onAction?: (action: TimelineNodeActionDockActionCode, target: TimelineNodeActionDockTarget) => void;
  /** Surface toggle — open Cards-detail without a route push. */
  onOpenCardsDetail?: (target: TimelineNodeActionDockTarget) => void;
  /** BR-001 collapse toggle — used when the dock primary is `expand_branch`. */
  onExpandBranch?: (branchRootMessageId: string) => void;
  /** Dismiss the dock (sets `selectedTarget` to null in the room shell). */
  onDismiss?: () => void;
  /** True when the viewer cannot post (observer). The dock still renders;
   *  the action gating already accounts for this via the model. */
  isReadModeViewer?: boolean;
}

export function TimelineNodeActionDock({
  model,
  onAction,
  onOpenCardsDetail,
  onExpandBranch,
  onDismiss,
  isReadModeViewer: _isReadModeViewer,
}: Props) {
  // Reduce-motion preference (one read per mount). Future work: subscribe
  // to changes (`AccessibilityInfo.addEventListener('reduceMotionChanged'…)`)
  // — see SC-004 follow-up discovery #4.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    try {
      const maybe = AccessibilityInfo.isReduceMotionEnabled?.();
      if (maybe && typeof (maybe as Promise<boolean>).then === 'function') {
        (maybe as Promise<boolean>).then((v) => {
          if (mounted) setReduceMotion(!!v);
        }).catch(() => undefined);
      }
    } catch {
      /* swallow — some platforms (web shim, jest) lack this API */
    }
    return () => { mounted = false; };
  }, []);
  // Touch reduceMotion so unused-var linter is silent until SC-1A wires
  // an actual entrance animation. The dock's v1 layout has no slide-up.
  void reduceMotion;

  if (!model) return null;

  const primary = model.actions[0];
  const secondaries = model.actions.slice(1);

  function dispatch(action: TimelineNodeActionDockAction) {
    if (action.isDisabled) return;
    if (action.action === 'open_cards_detail') {
      onOpenCardsDetail?.(model!.target);
      return;
    }
    if (action.action === 'expand_branch') {
      if (model!.target.kind === 'collapsed_stub') {
        onExpandBranch?.(model!.target.branchRootMessageId);
      }
      return;
    }
    onAction?.(action.action, model!.target);
  }

  return (
    <View
      style={styles.root}
      accessibilityRole="menu"
      accessibilityLabel={model.accessibilityLabel}
      testID="timeline-node-action-dock"
    >
      {/* Cluster header strip */}
      <View style={styles.headerRow} accessibilityLabel={model.clusterHeader.accessibilityLabel}>
        <Text style={styles.lifecycleLabel} numberOfLines={1} testID="timeline-action-dock-lifecycle">
          {model.clusterHeader.lifecycleLabel}
        </Text>
        {model.clusterHeader.manualTagSummary ? (
          <Text style={styles.tagSummary} numberOfLines={1} testID="timeline-action-dock-manual-tags">
            {model.clusterHeader.manualTagSummary}
          </Text>
        ) : null}
        {model.clusterHeader.autoMetadataSummary ? (
          <Text style={styles.autoSummary} numberOfLines={1} testID="timeline-action-dock-auto-meta">
            {model.clusterHeader.autoMetadataSummary}
          </Text>
        ) : null}
        {model.clusterHeader.evidenceLabel ? (
          <Text style={styles.evidenceLabel} numberOfLines={1} testID="timeline-action-dock-evidence">
            {model.clusterHeader.evidenceLabel}
          </Text>
        ) : null}
      </View>

      {/* Move-level chips (COPY-001: never duplicates cluster header) */}
      {model.moveChips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsRow}
          testID="timeline-action-dock-move-chips"
        >
          {model.moveChips.map((chip) => (
            <View
              key={`mc-${chip.code}`}
              style={styles.moveChip}
              accessibilityLabel={chip.accessibilityHint ?? chip.label}
              testID={`timeline-action-dock-move-chip-${chip.code}`}
            >
              <Text style={styles.moveChipText} numberOfLines={1}>{chip.label}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {/* Primary action button — pill shape, large touch target */}
      <View style={styles.primaryRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={primary.accessibilityLabel}
          accessibilityState={{ disabled: primary.isDisabled }}
          accessibilityHint={primary.helperCopy}
          disabled={primary.isDisabled}
          onPress={() => dispatch(primary)}
          hitSlop={8}
          testID={`timeline-action-dock-primary-${primary.action}`}
          style={[
            styles.primaryButton,
            primary.isDisabled && styles.primaryButtonDisabled,
          ]}
        >
          <Text style={styles.primaryButtonText} numberOfLines={1}>
            {primary.label}
          </Text>
          {primary.helperCopy ? (
            <Text style={styles.primaryHelper} numberOfLines={1}>{primary.helperCopy}</Text>
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss the action dock"
          onPress={onDismiss}
          hitSlop={8}
          testID="timeline-action-dock-dismiss"
          style={styles.dismissChip}
        >
          <Text style={styles.dismissChipText}>✕</Text>
        </Pressable>
      </View>

      {/* Secondary action chips — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.secondaryRow}
        contentContainerStyle={styles.secondaryRowContent}
        testID="timeline-action-dock-secondaries"
      >
        {secondaries.map((a) => (
          <Pressable
            key={`sa-${a.action}`}
            accessibilityRole="button"
            accessibilityLabel={a.accessibilityLabel}
            accessibilityState={{ disabled: a.isDisabled }}
            accessibilityHint={a.helperCopy}
            disabled={a.isDisabled}
            onPress={() => dispatch(a)}
            hitSlop={8}
            testID={`timeline-action-dock-secondary-${a.action}`}
            style={[
              styles.secondaryChip,
              a.isDisabled && styles.secondaryChipDisabled,
            ]}
          >
            <Text
              style={[styles.secondaryChipText, a.isDisabled && styles.secondaryChipTextDisabled]}
              numberOfLines={1}
            >
              {a.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#0b1220',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  lifecycleLabel: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  tagSummary: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: '600',
  },
  autoSummary: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  evidenceLabel: {
    color: '#22d3ee',
    fontSize: 11,
    fontWeight: '600',
  },
  chipsRow: { marginVertical: 4 },
  moveChip: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
    minHeight: 28,
    justifyContent: 'center',
  },
  moveChipText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#312e81',
    borderRadius: 999, // pill
    borderWidth: 3,
    borderColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 56,
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  primaryHelper: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  dismissChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissChipText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryRow: { marginTop: 8 },
  secondaryRowContent: { gap: 8, paddingRight: 16 },
  secondaryChip: {
    backgroundColor: '#1f2937',
    borderRadius: 10, // rounded rect, distinct from primary pill
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryChipDisabled: {
    opacity: 0.4,
  },
  secondaryChipText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryChipTextDisabled: {
    fontStyle: 'italic' as const,
  },
});
