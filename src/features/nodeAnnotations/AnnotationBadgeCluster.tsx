/**
 * UX-001.5 — `AnnotationBadgeCluster` — multi-badge anchor.
 *
 * Groups up to `maxBadges` (default 3) `AnnotationBadge`s on a single
 * anchor point. Excess badges collapse to one `+N` badge.
 *
 * Doctrine:
 *   - Cluster summary label composed via `buildAnnotationAriaLabelForCluster`
 *     — a screen-reader user hears the count + each badge's label.
 *   - Color is supplementary; the badge layout itself is meaningful
 *     (cluster, stack, row).
 *   - All colors token-derived via the underlying `AnnotationBadge`;
 *     no hex literals.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SPACING } from '../../lib/designTokens';
import { AnnotationBadge } from './AnnotationBadge';
import { buildAnnotationAriaLabelForCluster } from './annotationAriaLabel';
import type {
  AnnotationChipDescriptor,
  AnnotationChipIconHint,
} from './annotationChipDescriptor';
import type { AnnotationBand } from './annotationKindTokens';

export interface AnnotationBadgeClusterMember {
  /** Stable key for keying + reduction. */
  key: string;
  /** Optional iconHint for the badge. */
  iconHint?: AnnotationChipIconHint;
  /** Optional kind for token color mapping. */
  kind?: AnnotationChipDescriptor['kind'];
  /** Required screen-reader label for this badge. */
  ariaLabel: string;
}

export type AnnotationBadgeClusterLayout = 'horizontal' | 'vertical' | 'stacked';

export interface AnnotationBadgeClusterProps {
  /** Up to maxBadges badges; excess collapses to one "+N" indicator. */
  badges: ReadonlyArray<AnnotationBadgeClusterMember>;
  /** Layout direction. `'stacked'` overlaps badges with a 4 px offset. */
  layout: AnnotationBadgeClusterLayout;
  /**
   * Maximum visible badges before "+N" collapse. Defaults to 3. The
   * "+N" badge counts as one slot, so a cluster of 5 with maxBadges=3
   * renders 2 badges + 1 "+3" badge.
   */
  maxBadges?: number;
  /** Band default for the underlying badge diameter. */
  band?: AnnotationBand;
  /** Caller-supplied container style. */
  style?: StyleProp<ViewStyle>;
  /** testID passthrough. */
  testID?: string;
}

/**
 * Multi-badge anchor.
 *
 * Pure layout container — every per-badge color decision is delegated
 * to `AnnotationBadge`. The container builds the cluster-level
 * `accessibilityLabel` so VoiceOver / TalkBack hears the summary.
 */
export function AnnotationBadgeCluster({
  badges,
  layout,
  maxBadges,
  band,
  style,
  testID,
}: AnnotationBadgeClusterProps) {
  const cap = typeof maxBadges === 'number' && maxBadges > 0 ? Math.floor(maxBadges) : 3;
  const safeBadges = useMemo(() => (Array.isArray(badges) ? badges : []), [badges]);
  const overflowCount = Math.max(0, safeBadges.length - cap);
  const visible = useMemo(() => {
    if (overflowCount === 0) return safeBadges;
    // Reserve one slot for the "+N" badge.
    return safeBadges.slice(0, Math.max(0, cap - 1));
  }, [safeBadges, overflowCount, cap]);
  const overflowDisplay = overflowCount > 0 ? overflowCount + (cap - 1 - visible.length) : 0;

  const ariaLabel = useMemo(
    () => buildAnnotationAriaLabelForCluster(safeBadges),
    [safeBadges],
  );

  if (safeBadges.length === 0) return null;

  const containerStyle: StyleProp<ViewStyle> =
    layout === 'vertical'
      ? styles.vertical
      : layout === 'stacked'
        ? styles.stacked
        : styles.horizontal;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={ariaLabel}
      style={[containerStyle, style]}
      testID={testID}
    >
      {visible.map((member, idx) => (
        <View
          key={member.key}
          style={[
            styles.badgeSlot,
            layout === 'stacked' && idx > 0 ? styles.stackedOffset : null,
          ]}
        >
          <AnnotationBadge
            ariaLabel={member.ariaLabel}
            iconHint={member.iconHint}
            kind={member.kind}
            band={band}
          />
        </View>
      ))}
      {overflowDisplay > 0 ? (
        <View
          style={[
            styles.badgeSlot,
            layout === 'stacked' ? styles.stackedOffset : null,
          ]}
        >
          <AnnotationBadge
            ariaLabel={`${overflowDisplay} more annotation${overflowDisplay === 1 ? '' : 's'}.`}
            iconHint="info"
            kind="context"
            band={band}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  horizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs - 1, // 3 px between badges per design §9
  },
  vertical: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: SPACING.xs - 1,
  },
  stacked: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedOffset: {
    marginLeft: -4, // 4 px overlap per design §2 #5
  },
});
