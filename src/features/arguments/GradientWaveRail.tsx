/**
 * VG-002 — Gradient wave rail React Native component.
 *
 * Replaces the inline `EdgeStrip` subcomponent in `ArgumentTimelineMap`.
 * Renders the 5-layer stacked-View visual the design specifies:
 *
 *   0. Base color band — 6 stacked `<View>`s along the strip.
 *   1. Tone wash — single semi-transparent overlay.
 *   2. Evidence-track texture — solid teal OR dotted alpha pattern.
 *   3. Branch / kink marker — optional angled stubs at start/end.
 *   4. Active-path glow — translucent overlay with shadow / elevation.
 *
 * No new dependency. No animation. Reduce-motion preference is not
 * relevant in v1 because nothing animates here. Future cards
 * (VG-004 / QOL-016) MUST read `AccessibilityInfo.isReduceMotionEnabled`
 * before adding any pulse / sweep / interpolation animation.
 *
 * Performance: this component renders ONLY the slice it is handed.
 * Virtualization is owned by the parent (`visibleSegmentSlice`); this
 * component does not re-add off-screen segments. Per-segment style is
 * memoized via the optional `styleCache` prop.
 *
 * Accessibility: every `<View>` is `pointerEvents="none"`. The rail
 * surface is not focusable; per-node a11y is delegated to the node
 * Pressables + EV-002's chip + popover. The rail's whole-rail
 * `accessibilityLabel` is built by the parent via
 * `buildWholeRailAccessibilityLabel(...)`.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  deriveRailSegmentStyle,
  type RailSegmentInput,
  type RailSegmentStyle,
} from './railSegmentModel';

export interface GradientWaveRailProps {
  /** Already-virtualized slice from `visibleSegmentSlice`. */
  segments: ReadonlyArray<RailSegmentInput>;
  /** Optional style cache passed in by the parent. The component reads
   *  cached styles by `segmentId`; on miss it derives + stores. */
  styleCache?: Map<string, RailSegmentStyle>;
}

/**
 * Internal: stable key for a single input's "shape". Used so the cache
 * invalidates when isActivePath / sourceChainStatus / branchKind / x,y
 * change for a given segmentId.
 */
function inputCacheKey(s: RailSegmentInput): string {
  return [
    s.segmentId,
    s.branchKind,
    s.sourceChainStatus,
    s.toneBand,
    s.temperatureBand,
    s.isActivePath ? '1' : '0',
    s.isFirstClash ? '1' : '0',
    s.x1.toFixed(1),
    s.y1.toFixed(1),
    s.x2.toFixed(1),
    s.y2.toFixed(1),
  ].join('|');
}

function resolveStyle(
  input: RailSegmentInput,
  cache?: Map<string, RailSegmentStyle>,
): RailSegmentStyle {
  if (!cache) return deriveRailSegmentStyle(input);
  const key = inputCacheKey(input);
  const hit = cache.get(key);
  if (hit) return hit;
  const next = deriveRailSegmentStyle(input);
  cache.set(key, next);
  return next;
}

interface RailSegmentViewProps {
  input: RailSegmentInput;
  style: RailSegmentStyle;
}

function RailSegmentView({ input, style }: RailSegmentViewProps) {
  if (style.isHidden) return null;

  const segmentLen = style.wrapper.width / 6;
  const thickness = style.wrapper.height;

  const wrapperStyle = {
    position: 'absolute' as const,
    left: style.wrapper.left,
    top: style.wrapper.top,
    width: style.wrapper.width,
    height: thickness,
    transform: [{ rotateZ: `${style.wrapper.transformRotateZDeg}deg` }],
    transformOrigin: '0% 50%' as const,
    flexDirection: 'row' as const,
    opacity: style.wrapper.opacity,
    borderRadius: thickness,
    overflow: 'hidden' as const,
    ...(input.isFirstClash
      ? { borderWidth: 1, borderColor: '#fef3c7' as const }
      : null),
  };

  return (
    <View
      pointerEvents="none"
      testID={
        input.isFirstClash
          ? `timeline-edge-first-clash-${input.fromMessageId}-${input.toMessageId}`
          : `timeline-edge-${input.fromMessageId}-${input.toMessageId}`
      }
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={wrapperStyle}
    >
      {/* Layer 0 — base color band (6 stacked sub-strips) */}
      {style.baseSubStripColors.map((c, i) => (
        <View
          key={`${input.segmentId}-base-${i}`}
          pointerEvents="none"
          style={{ width: segmentLen, height: thickness, backgroundColor: c }}
        />
      ))}

      {/* Layer 1 — tone wash overlay (only when alpha > 0) */}
      {style.toneWash.alpha > 0 ? (
        <View
          pointerEvents="none"
          testID={`rail-tone-wash-${input.segmentId}`}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: style.wrapper.width,
            height: thickness,
            backgroundColor: style.toneWash.color,
            opacity: style.toneWash.alpha,
          }}
        />
      ) : null}

      {/* Layer 2 — evidence track */}
      {style.evidenceTrack && style.evidenceTrack.mode === 'solid' ? (
        <View
          pointerEvents="none"
          testID={`rail-evidence-track-${input.segmentId}`}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: style.wrapper.width,
            height: thickness,
            backgroundColor: style.evidenceTrack.color,
            opacity: style.evidenceTrack.alpha,
          }}
        />
      ) : null}

      {style.evidenceTrack && style.evidenceTrack.mode === 'dotted_pattern' ? (
        <View
          pointerEvents="none"
          testID={`rail-evidence-track-dotted-${input.segmentId}`}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: style.wrapper.width,
            height: thickness,
            flexDirection: 'row',
          }}
        >
          {style.evidenceTrack.alphaPattern.map((a, i) => (
            <View
              key={`${input.segmentId}-dot-${i}`}
              pointerEvents="none"
              style={{
                width: segmentLen,
                height: thickness,
                backgroundColor: style.evidenceTrack && style.evidenceTrack.mode === 'dotted_pattern' ? style.evidenceTrack.color : 'transparent',
                opacity: a,
              }}
            />
          ))}
        </View>
      ) : null}

      {/* Layer 3 — branch / kink stubs */}
      {style.wrapper.showKinkStartStub ? (
        <View
          pointerEvents="none"
          testID={`rail-kink-start-${input.segmentId}`}
          style={[styles.kinkStub, { left: 0, top: -1 }]}
        />
      ) : null}
      {style.wrapper.showKinkEndStub ? (
        <View
          pointerEvents="none"
          testID={`rail-kink-end-${input.segmentId}`}
          style={[styles.kinkStub, { right: 0, top: -1 }]}
        />
      ) : null}

      {/* Layer 4 — active-path glow */}
      {style.glow ? (
        <View
          pointerEvents="none"
          testID={`rail-glow-${input.segmentId}`}
          style={{
            position: 'absolute',
            left: -2,
            top: -2,
            width: style.wrapper.width + 4,
            height: thickness + 4,
            borderRadius: thickness + 4,
            shadowColor: style.glow.color,
            shadowOpacity: style.glow.shadowOpacity,
            shadowRadius: style.glow.shadowRadius,
            shadowOffset: { width: 0, height: 0 },
            elevation: style.glow.elevation,
            backgroundColor: 'transparent',
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * Gradient wave rail. Pure render over a (virtualized) `segments`
 * slice. The parent owns scroll, viewport, and slice derivation.
 *
 * NOTE for future cards: any animation MUST first read
 * `AccessibilityInfo.isReduceMotionEnabled()` and skip / shorten when
 * the user has opted out. v1 ships with zero animation; this comment
 * is the seam for that future work (see design § Reduce-motion
 * fallbacks).
 */
export function GradientWaveRail(props: GradientWaveRailProps): React.ReactElement {
  const { segments, styleCache } = props;
  const resolved = useMemo(() => {
    return segments.map((input) => ({
      input,
      style: resolveStyle(input, styleCache),
    }));
    // styleCache is a mutable Map by design; we deliberately re-resolve
    // each segment per render. The cache speeds up the per-segment work
    // without freezing the slice.
  }, [segments, styleCache]);

  return (
    <View pointerEvents="none" testID="gradient-wave-rail">
      {resolved.map(({ input, style }) => (
        <RailSegmentView key={input.segmentId} input={input} style={style} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  kinkStub: {
    position: 'absolute',
    width: 6,
    height: 6,
    backgroundColor: '#94a3b8',
    transform: [{ rotateZ: '45deg' }],
    borderRadius: 1,
  },
});
