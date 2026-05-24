/**
 * QOL-040.3 — Build a `GalleryEntryHint` from a `NotificationDeepLink`.
 *
 * Pure, deterministic, side-effect-free. No React, no Supabase, no network.
 * Extracted so the App.tsx routing callback can be unit-tested without a
 * React-tree render.
 *
 * Behavior:
 *  - When `link.activeArgumentId` is a non-empty string, returns a minimal
 *    `GalleryEntryHint` carrying that id in `entryHintForArgumentId`. The
 *    room shell consumes the field first (and falls back to the existing
 *    `activate` policy when the id is not in the loaded slice).
 *  - When `link.activeArgumentId` is null or undefined, returns `null` so
 *    the App.tsx caller knows to `setEntryHint(null)` and let the room
 *    shell pick the latest move as today.
 *
 * Why empty `verbPhrase`: `ArgumentGameSurface.tsx` only renders the
 * micro-moment banner when `entryHint?.verbPhrase` is truthy. Empty string
 * is falsy → no banner. The notification path is silent; the gallery path
 * remains the only consumer that surfaces the banner (we don't want a
 * "Be the first rebuttal" banner appearing after a `concession_challenged`
 * deep-link, for example).
 *
 * Why `activate: 'latest'`: the new `entryHintForArgumentId` branch is
 * checked FIRST in `initialActiveId`. `activate: 'latest'` is only
 * consulted when the new field's id is absent from the loaded slice, at
 * which point "show the latest move" is exactly the requested fallback.
 *
 * Why `code: 'watch_first'`: a neutral, non-actionable code. The
 * notification-path hint never reaches the gallery card renderer (it is
 * threaded straight into the room shell via `setEntryHint`), so the
 * `code` value is unused except for analytics-style invariants. The
 * banner is suppressed by the empty `verbPhrase` regardless.
 *
 * Doctrine notes:
 *  - No verdict / popularity / amplification language is introduced. The
 *    helper carries only opaque ids.
 *  - The helper is pure; it cannot call AI, cannot read from the network,
 *    and cannot mutate any shared state.
 */
import type { NotificationDeepLink } from '../notifications';
import type { GalleryEntryHint } from './conversationGalleryModel';

export function buildDeepLinkEntryHint(
  link: NotificationDeepLink,
): GalleryEntryHint | null {
  if (!link.activeArgumentId) return null;
  return {
    activate: 'latest',  // safe fallback; only used if the id is not
                         // present in the loaded message slice
    code: 'watch_first', // neutral; the banner is suppressed below
    verbPhrase: '',      // empty → no micro-moment banner renders
    helperLine: '',
    presetKey: null,
    dockAction: null,
    entryHintForArgumentId: link.activeArgumentId,
  };
}
