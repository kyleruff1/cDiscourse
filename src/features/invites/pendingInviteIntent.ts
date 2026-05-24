/**
 * QOL-038 — the `pendingInviteIntent` session slice.
 *
 * The invitee can take many minutes (or hours) between tapping the email
 * link and finishing the sign-up + email-confirmation round trip. The
 * destination room must survive:
 *
 *   - a cold start mid-signup (app killed between tap and account creation)
 *   - the email-confirmation roundtrip (close tab, return via the
 *     Supabase confirmation email)
 *   - a browser restart on the same device
 *
 * So the intent lives in the **persisted** session snapshot, not React
 * state. This module owns the pure serialise/restore + freshness rules.
 *
 * Doctrine:
 *  - 24h freshness window — a user who signed up, abandoned, and returned
 *    weeks later should NOT be silently redirected into a stale room.
 *    `loadFreshPendingInviteIntent` drops stale rows on read.
 *  - The token itself is NOT logged anywhere by this module; the only
 *    place it appears is in the persisted snapshot blob (AsyncStorage /
 *    sessionStorage) and the in-memory reducer state.
 *  - All functions are pure. The impure storage layer is in
 *    sessionStorage.ts (AsyncStorage) — this module just describes the
 *    shape and the freshness predicate.
 */
import { isValidInviteTokenShape } from './inviteDeepLink';

/** The persisted intent shape, added to `AppSessionSnapshot`. */
export interface PendingInviteIntent {
  /**
   * The raw invite token. Carried through the auth round-trip and handed
   * to `lookupInviteByToken` / `acceptRoomInvite` when the first
   * signed-in state arrives.
   */
  token: string;
  /**
   * ISO-8601 capture time. Used by `isPendingInviteIntentFresh` to drop
   * intents older than `PENDING_INVITE_INTENT_FRESHNESS_MS`.
   */
  capturedAt: string;
}

/**
 * The freshness window for the local intent. 24 hours: long enough to
 * cover a typical email-confirmation roundtrip + reboot + browser restart;
 * short enough that an abandoned signup from weeks ago does not silently
 * redirect.
 *
 * Note: the TOKEN's TTL is separately 14 days (server-side, in
 * `argument_room_invites.expires_at`). A user returning after 24h can
 * still re-tap the email link and capture a fresh intent — the 24h drop
 * is a UX safety, not a hard cap on usable token life.
 */
export const PENDING_INVITE_INTENT_FRESHNESS_MS = 24 * 60 * 60 * 1000;

/**
 * Build a new intent for a freshly-parsed token. Throws on a bad token
 * shape — programmer error; the caller is expected to gate on
 * `parseInviteDeepLink` first.
 */
export function buildPendingInviteIntent(token: string, nowIso: string): PendingInviteIntent {
  if (!isValidInviteTokenShape(token)) {
    throw new Error('buildPendingInviteIntent: invalid token shape');
  }
  if (typeof nowIso !== 'string' || !Number.isFinite(Date.parse(nowIso))) {
    throw new Error('buildPendingInviteIntent: invalid timestamp');
  }
  return { token, capturedAt: nowIso };
}

/**
 * Validate the persisted shape after reading from storage. Returns the
 * intent unchanged if it parses, or `null` for any malformed input. NEVER
 * throws.
 */
export function parsePendingInviteIntent(raw: unknown): PendingInviteIntent | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!isValidInviteTokenShape(obj.token)) return null;
  if (typeof obj.capturedAt !== 'string') return null;
  if (!Number.isFinite(Date.parse(obj.capturedAt))) return null;
  return { token: obj.token, capturedAt: obj.capturedAt };
}

/**
 * True when `intent.capturedAt` is within `PENDING_INVITE_INTENT_FRESHNESS_MS`
 * of `nowIso`. Used by the reducer's accept-on-first-signed-in trigger to
 * decide whether to fire an `acceptRoomInvite` call for this intent.
 *
 * A future-dated `capturedAt` (clock skew) is treated as fresh; we never
 * drop a "too new" intent.
 */
export function isPendingInviteIntentFresh(
  intent: Pick<PendingInviteIntent, 'capturedAt'>,
  nowIso: string,
): boolean {
  const captured = Date.parse(intent.capturedAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(captured) || !Number.isFinite(now)) return false;
  if (captured > now) return true;
  return now - captured <= PENDING_INVITE_INTENT_FRESHNESS_MS;
}

/**
 * Load an intent from a snapshot blob and drop it if stale. The single
 * helper for the SessionProvider's "after a SNAPSHOT_RESTORED, check the
 * intent" branch. Returns `null` for missing, malformed, or stale.
 */
export function loadFreshPendingInviteIntent(
  raw: unknown,
  nowIso: string,
): PendingInviteIntent | null {
  const parsed = parsePendingInviteIntent(raw);
  if (!parsed) return null;
  if (!isPendingInviteIntentFresh(parsed, nowIso)) return null;
  return parsed;
}
