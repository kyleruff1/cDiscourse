/**
 * VOICE-005 (issue 663) - defensive re-quantizer for live bucket arrays.
 *
 * The VOICE-004 reducer accumulates amplitudeBuckets on state during
 * accumulating without 8-bit quantization; the terminal fold in
 * makeArtifact applies Math.round(x * 255) / 255 exactly once. This
 * helper collapses a LIVE bucket array onto the same 256-level lattice
 * so the visualizer renders a mid-session frame byte-identically to the
 * finalized frame the artifact will carry.
 *
 * The mapping is idempotent: quantizeBucketsForRender applied twice
 * yields byte-identical output. Non-finite inputs (NaN, +/-Infinity)
 * clamp to 0, matching the reducer clamp posture (INV-B3) so an
 * upstream defect cannot silently be treated as a peak.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

function quantize8bit(x: number): number {
  return Math.round(x * 255) / 255;
}

export function quantizeBucketsForRender(
  buckets: readonly number[],
): readonly number[] {
  const out = new Array<number>(buckets.length);
  for (let i = 0; i < buckets.length; i += 1) {
    out[i] = quantize8bit(clamp01(buckets[i]));
  }
  return Object.freeze(out);
}
