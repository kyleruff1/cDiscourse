/**
 * VOICE-005 (issue 663) - Skia path-builder adapter.
 *
 * Iterates a readonly PathSegment[] in order and drives a duck-typed
 * SkiaPathLike surface (moveTo, lineTo, close). The parameter is the
 * local interface from pathSegment.types.ts, NOT a real Skia path type -
 * the follow-up React component passes an actual @shopify/react-native
 * -skia path builder which satisfies the interface structurally.
 *
 * Handcrafted commands, not the Skia string-to-path parser. The Skia
 * parser is outside our test surface; a Skia release upgrade could
 * silently change how it interprets M / L / Z (whitespace tolerance,
 * number precision, path-close semantics). Handcrafted commands
 * eliminate that parser dependency and preserve non-replayability
 * across upgrades. The doctrine scanner bans the parser entry-point
 * name in every visualizer file to prevent regression - see the guard
 * test for the exact literal that is disallowed.
 *
 * No numeric transform, no coordinate re-derivation, no reordering.
 * Given identical segments the emitted call sequence is byte-identical
 * across engines.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import type { PathSegment, SkiaPathLike } from './pathSegment.types';

export function applyPathSegmentsToSkiaPath(
  path: SkiaPathLike,
  segments: readonly PathSegment[],
): void {
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (seg.type === 'M') {
      path.moveTo(seg.x, seg.y);
    } else if (seg.type === 'L') {
      path.lineTo(seg.x, seg.y);
    } else {
      path.close();
    }
  }
}
