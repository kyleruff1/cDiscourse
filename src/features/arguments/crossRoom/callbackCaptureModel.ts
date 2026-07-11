/**
 * UX-COMPOSER-005 (#831) — callback capture model (pure TS).
 *
 * Owns the shape the composer-side capture flow produces (a verbatim line
 * pulled from a prior room the weaver read) and the pure helpers that clamp,
 * validate, and preview it. INV-1 (weaver-capture gate): an excerpt may only
 * originate from a move row RLS returned to the weaver — this model never
 * synthesizes an excerpt, and `isCaptureUsable` refuses an empty / self-room
 * capture, so the composer can never attach a fabricated echo.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */
import {
  MAX_CALLBACK_EXCERPT_CHARS,
  type CrossRoomCallback,
} from './crossRoomCallbackRef';
import { CALLBACK_COMPOSER_COPY, CALLBACK_GLYPH } from './callbackComposerCopy';

/** The return of the capture flow — one verbatim line + its origin room. */
export interface CallbackCaptureResult {
  /** The PRIOR settled room the line came from. */
  targetDebateId: string;
  /** The prior room title, snapshotted at capture time. */
  targetTitleSnapshot: string;
  /** The captured verbatim line (already clamped). */
  excerpt: string;
  /** The prior-room argument id the line came from (future deep-link). */
  capturedFromArgumentId: string | null;
}

/**
 * Trim + clamp a raw captured line to the persisted ceiling. Pure. This is the
 * same clamp `writeCrossRoomCallback` applies, so the previewed line matches
 * the persisted line exactly.
 */
export function clampCallbackExcerpt(raw: string): string {
  return String(raw ?? '').trim().slice(0, MAX_CALLBACK_EXCERPT_CHARS);
}

/**
 * Returns true only when a capture is attachable: a non-empty excerpt, a
 * non-empty target room id, and (when `currentDebateId` is supplied) not a
 * self-reference to the current room. INV-1: an empty authorized-moves list
 * can never yield a usable capture, so no fabricated echo is possible. Pure.
 */
export function isCaptureUsable(
  result: CallbackCaptureResult | null | undefined,
  currentDebateId?: string | null,
): boolean {
  if (!result) return false;
  const excerpt = clampCallbackExcerpt(result.excerpt);
  if (excerpt.length === 0) return false;
  if (typeof result.targetDebateId !== 'string' || result.targetDebateId.trim().length === 0) {
    return false;
  }
  if (currentDebateId && result.targetDebateId === currentDebateId) return false;
  return true;
}

/** Maps a usable capture into the draft-held `CrossRoomCallback` value. Pure. */
export function captureToCallback(result: CallbackCaptureResult): CrossRoomCallback {
  return {
    targetDebateId: result.targetDebateId,
    targetTitleSnapshot: result.targetTitleSnapshot,
    excerpt: clampCallbackExcerpt(result.excerpt),
    capturedFromArgumentId: result.capturedFromArgumentId ?? null,
  };
}

/** The inline draft-echo view-model rendered above the composer input. */
export interface CallbackEchoPreview {
  /** The shared woven-callback glyph. */
  glyph: string;
  /** The echo header ("Woven callback"). */
  header: string;
  /** The quoted prior line (clamped). */
  quotedLine: string;
  /** The origin line ("Callback to ..."). Empty when no title is known. */
  originLine: string;
  /** The remove-control screen-reader label. */
  removeA11yLabel: string;
}

/**
 * Builds the inline draft-echo preview for an attached callback. Deterministic;
 * no `Date.now()`, no network. Pure.
 */
export function deriveCallbackEchoPreview(callback: CrossRoomCallback): CallbackEchoPreview {
  const title = typeof callback.targetTitleSnapshot === 'string'
    ? callback.targetTitleSnapshot.trim()
    : '';
  return {
    glyph: CALLBACK_GLYPH,
    header: CALLBACK_COMPOSER_COPY.echoHeader,
    quotedLine: clampCallbackExcerpt(callback.excerpt),
    originLine: title.length > 0 ? CALLBACK_COMPOSER_COPY.echoOrigin(title) : '',
    removeA11yLabel: CALLBACK_COMPOSER_COPY.echoRemoveA11y,
  };
}
