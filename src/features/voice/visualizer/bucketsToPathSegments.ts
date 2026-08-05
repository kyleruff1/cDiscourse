/**
 * VOICE-005 (issue 663) - pure geometry core for the waveform visualizer.
 *
 * bucketsToPathSegments turns an amplitude bucket array into a readonly
 * PathSegment[] describing a mirrored-bar shape around a horizontal
 * centerline. Two adapters consume the segments: pathSegmentsToSvgD
 * emits an SVG d string; applyPathSegmentsToSkiaPath drives a duck-typed
 * SkiaPathLike. Neither adapter is imported here.
 *
 * Purity contract (enforced by the doctrine source-scan guard):
 *   - Pure function of (buckets, layout). No external state.
 *   - No clock reads, no pseudo-random-number generator calls, no
 *     animation-frame callbacks, no timer APIs.
 *   - Only the four IEEE-754 basic operators (+ - * /) and the six
 *     legal Math helpers (round, max, min, floor, ceil, abs). No
 *     trigonometric, transcendental, or square-root helpers.
 *   - The output is frozen so callers cannot silently mutate.
 *
 * Defensive layout:
 *   - width, height must be finite and > 0. Otherwise return an empty
 *     segment array (no throw). Non-finite / negative centerlineY,
 *     barGapPx, minBarWidthPx fall back to safe defaults.
 *
 * Empty case:
 *   - Zero buckets emits a centerline stroke (M 0 cy L width cy). This
 *     is the mic-on-before-speaking cue the composing component renders
 *     while the reducer sits in accumulating with no samples yet.
 *
 * Mirrored-bar layout:
 *   - For N buckets and layout width W, rawBarWidth = W / N and
 *     barWidth = max(rawBarWidth - barGapPx, minBarWidthPx). Bars step
 *     by rawBarWidth (so the row exactly spans W); the drawn width is
 *     barWidth (so gaps remain visible).
 *   - For bucket i at amplitude b, halfH = (b * height) / 2 and the
 *     rectangle is M(x, cy - halfH) L(x + barWidth, cy - halfH)
 *     L(x + barWidth, cy + halfH) L(x, cy + halfH) Z.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import type { PathSegment, VisualizerLayout } from './pathSegment.types';
import { quantizeBucketsForRender } from './quantizeBucketsForRender';

const DEFAULT_BAR_GAP_PX = 1;
const DEFAULT_MIN_BAR_WIDTH_PX = 0.5;

function safeCenterline(centerline: number | undefined, height: number): number {
  if (centerline === undefined) return height / 2;
  if (!Number.isFinite(centerline)) return height / 2;
  if (centerline <= 0) return 0;
  if (centerline >= height) return height;
  return centerline;
}

function safeBarGap(gap: number | undefined): number {
  if (gap === undefined) return DEFAULT_BAR_GAP_PX;
  if (!Number.isFinite(gap)) return DEFAULT_BAR_GAP_PX;
  if (gap < 0) return DEFAULT_BAR_GAP_PX;
  return gap;
}

function safeMinBarWidth(minWidth: number | undefined): number {
  if (minWidth === undefined) return DEFAULT_MIN_BAR_WIDTH_PX;
  if (!Number.isFinite(minWidth)) return DEFAULT_MIN_BAR_WIDTH_PX;
  if (minWidth <= 0) return DEFAULT_MIN_BAR_WIDTH_PX;
  return minWidth;
}

export function bucketsToPathSegments(
  buckets: readonly number[],
  layout: VisualizerLayout,
): readonly PathSegment[] {
  // Layout preconditions. Degenerate layouts return an empty segment
  // list without throwing so a visualizer host during mount/unmount can
  // never crash on a transient zero-width measurement.
  if (!Number.isFinite(layout.width) || layout.width <= 0) {
    return Object.freeze([]);
  }
  if (!Number.isFinite(layout.height) || layout.height <= 0) {
    return Object.freeze([]);
  }

  const cy = safeCenterline(layout.centerlineY, layout.height);
  const barGapPx = safeBarGap(layout.barGapPx);
  const minBarWidthPx = safeMinBarWidth(layout.minBarWidthPx);

  const q = quantizeBucketsForRender(buckets);

  // Empty buckets: mic-on-before-speaking centerline cue.
  if (q.length === 0) {
    const out: PathSegment[] = [
      { type: 'M', x: 0, y: cy },
      { type: 'L', x: layout.width, y: cy },
    ];
    return Object.freeze(out);
  }

  const rawBarWidth = layout.width / q.length;
  const barWidthCandidate = rawBarWidth - barGapPx;
  const barWidth =
    barWidthCandidate >= minBarWidthPx ? barWidthCandidate : minBarWidthPx;

  const segments: PathSegment[] = [];
  for (let i = 0; i < q.length; i += 1) {
    const b = q[i];
    const halfH = (b * layout.height) / 2;
    const yTop = cy - halfH;
    const yBot = cy + halfH;
    const xLeft = i * rawBarWidth;
    const xRight = xLeft + barWidth;
    segments.push({ type: 'M', x: xLeft, y: yTop });
    segments.push({ type: 'L', x: xRight, y: yTop });
    segments.push({ type: 'L', x: xRight, y: yBot });
    segments.push({ type: 'L', x: xLeft, y: yBot });
    segments.push({ type: 'Z' });
  }
  return Object.freeze(segments);
}
