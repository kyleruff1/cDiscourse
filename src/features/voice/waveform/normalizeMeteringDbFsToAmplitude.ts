/**
 * VOICE-004 (issue 662) - canonical dBFS -> [0,1] mapping for the
 * waveform pipeline.
 *
 * Non-configurable. The metering adapter is required to call this
 * before dispatching level_sample to the reducer. The reducer itself
 * accepts only [0,1] input; INV-B3 in the reducer defensively clamps
 * anything out of range, but the adapter contract is that this helper
 * has already run.
 *
 * Contract:
 *   - -60 dBFS or below       -> 0 (silence floor)
 *   - 0 dBFS or above         -> 1 (clip)
 *   - non-finite (NaN, +/-Infinity) -> 0 (mirrors INV-B3 non-finite defense)
 *   - otherwise               -> (dbfs + 60) / 60
 *
 * The non-finite rule is load-bearing: without an explicit Number.isFinite
 * check, +Infinity would arithmetically map to +Infinity and then clamp to 1
 * (clip). We instead map every non-finite input to 0, matching the reducer
 * clamp posture and closing a covert-channel where an adapter that emits
 * Infinity would be treated as maximum signal.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

const DBFS_SILENCE_FLOOR = -60;
const DBFS_CLIP_CEILING = 0;

export function normalizeMeteringDbFsToAmplitude(dbfs: number): number {
  if (!Number.isFinite(dbfs)) return 0;
  if (dbfs <= DBFS_SILENCE_FLOOR) return 0;
  if (dbfs >= DBFS_CLIP_CEILING) return 1;
  return (dbfs - DBFS_SILENCE_FLOOR) / (DBFS_CLIP_CEILING - DBFS_SILENCE_FLOOR);
}
