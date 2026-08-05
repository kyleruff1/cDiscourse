/**
 * VOICE-005 (issue 663) - path-segment types for the pure-TS visualizer.
 *
 * A PathSegment is a JSON-serializable primitive drawing command. The
 * geometry core bucketsToPathSegments emits a readonly PathSegment[]
 * that both the SVG joiner and the Skia adapter consume without any
 * shared imports of react-native-svg or @shopify/react-native-skia.
 *
 * Duck-typed local Skia surface (SkiaPathLike) lives in this file so no
 * consumer of the visualizer module needs a native import to describe
 * the adapter contract.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

export type PathSegment =
  | { readonly type: 'M'; readonly x: number; readonly y: number }
  | { readonly type: 'L'; readonly x: number; readonly y: number }
  | { readonly type: 'Z' };

export interface VisualizerLayout {
  readonly width: number;
  readonly height: number;
  readonly centerlineY?: number;
  readonly barGapPx?: number;
  readonly minBarWidthPx?: number;
}

// Duck-typed local Skia surface. NO import from @shopify/react-native-skia
// in this module. The composing React component in the follow-up card is
// what passes a real Skia path builder into the adapter; that builder
// satisfies this interface structurally.
export interface SkiaPathLike {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  close(): void;
}
