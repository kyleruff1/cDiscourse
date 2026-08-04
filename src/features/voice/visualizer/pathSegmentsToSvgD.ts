/**
 * VOICE-005 (issue 663) - SVG d-string adapter.
 *
 * Joins a readonly PathSegment[] into an SVG path d string. Numbers are
 * pinned via Number.prototype.toFixed(3) at the join boundary so the
 * emitted string is byte-identical across V8, JSC, and Hermes, and
 * across locales (toFixed is locale-neutral per ECMA-262 - it always
 * uses U+002E as the decimal separator and never inserts a thousands
 * separator).
 *
 * The adapter never imports react-native-svg. The consuming React
 * component in the follow-up card is what feeds the string into an
 * <Svg><Path d={d}/></Svg> tree; that tree is out of scope for this
 * branch.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import type { PathSegment } from './pathSegment.types';

function fmt(n: number): string {
  // toFixed(3) is locale-neutral per ECMA-262. It returns 0.000 for -0
  // and applies IEEE-754 round-half-to-even. See test scenario 15.
  return n.toFixed(3);
}

export function pathSegmentsToSvgD(
  segments: readonly PathSegment[],
): string {
  const parts: string[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (seg.type === 'M') {
      parts.push('M' + fmt(seg.x) + ' ' + fmt(seg.y));
    } else if (seg.type === 'L') {
      parts.push('L' + fmt(seg.x) + ' ' + fmt(seg.y));
    } else {
      parts.push('Z');
    }
  }
  return parts.join(' ');
}
