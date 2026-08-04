/**
 * VOICE-005 (issue 663) - barrel export for the pure-TS visualizer.
 *
 * The barrel is the sole public entry point. Consumers import from
 * @/features/voice/visualizer; sibling files are internal. No default
 * export.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

export type {
  PathSegment,
  VisualizerLayout,
  SkiaPathLike,
} from './pathSegment.types';

export { quantizeBucketsForRender } from './quantizeBucketsForRender';
export { bucketsToPathSegments } from './bucketsToPathSegments';
export { pathSegmentsToSvgD } from './pathSegmentsToSvgD';
export { applyPathSegmentsToSkiaPath } from './applyPathSegmentsToSkiaPath';
