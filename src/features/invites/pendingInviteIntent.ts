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
 * So the intent lives in BOTH (a) the persisted session snapshot (when
 * a user is signed in, via sessionStorage.ts) AND (b) a dedicated
 * device-local AsyncStorage key under the well-known anon name
 * (`cdiscourse:pending-invite-intent`). Path (b) covers the
 * "anonymous → sign up → sign in" handshake where there is no user-keyed
 * snapshot to carry the intent.
 *
 * Doctrine:
 *  - 24h freshness window — a user who signed up, abandoned, and returned
 *    weeks later should NOT be silently redirected into a stale room.
 *    `loadFreshPendingInviteIntent` drops stale rows on read.
 *  - The token itself is NOT logged anywhere by this module; the only
 *    place it appears is in the persisted storage blob and the
 *    in-memory reducer state.
 *  - The pure helpers (build / parse / freshness) carry zero I/O. The
 *    persisted-storage helpers (load / save / clear) live below them
 *    and use the same AsyncStorage seam the rest of session/ uses.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidInviteTokenShape } from './inviteDeepLink';

/** AsyncStorage key for the device-local intent slot. */
export const PENDING_INVITE_INTENT_STORAGE_KEY = 'cdiscourse:pending-invite-intent';

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

// ── AUTH-GOOGLE-SSO-005 (#748) — resume decision ──────────────

/**
 * The resume decision for a callback-done transition. Either there is no
 * live intent (no gate), or there is one that should mount the gate and
 * may auto-accept once a session is in place.
 */
export type InviteResumeDecision =
  | { resume: false } // no live intent → no gate
  | { resume: true; token: string; autoAcceptEligible: boolean };

/**
 * AUTH-GOOGLE-SSO-005 (#748) — the resume DECISION for a callback-done
 * transition: given a (possibly null) loaded intent and the current
 * signed-in state, decide whether the InviteRedeemGate should mount and
 * whether the auto-accept will be eligible. Pure; no storage, no network.
 *
 * The `intent` is expected to have ALREADY been freshness-checked by the
 * loader (`loadPendingInviteIntentFromStorage` / `loadFreshPendingInviteIntent`),
 * so a non-null intent here is a live one.
 *
 * This is a TESTABLE MIRROR of the gate-mount decision, NOT a replacement
 * for it: the actual acceptance stays server-side in the gate's auto-accept
 * effect (`InviteRedeemGate.tsx` — fires on signed-in + viewerEmail +
 * pending). `autoAcceptEligible` mirrors that effect's gate condition
 * (signed-in + a viewer email present) so callers can reason about whether
 * the resume will fire optimistically. The email-binding match itself is
 * always decided server-side by `acceptRoomInvite`; this never sees the
 * bound address (no enumeration). The token is never logged by this module.
 */
export function decideInviteResume(input: {
  intent: PendingInviteIntent | null; // already freshness-checked by the loader
  signedIn: boolean;
  viewerEmail: string | null;
}): InviteResumeDecision {
  if (!input.intent) return { resume: false };
  return {
    resume: true,
    token: input.intent.token,
    // mirrors the gate's auto-accept condition (signed-in + viewerEmail set)
    autoAcceptEligible: input.signedIn && !!input.viewerEmail,
  };
}

// ── Persisted storage helpers ─────────────────────────────────

/**
 * Persist the intent to its dedicated AsyncStorage key. This survives
 * sign-in handshakes and cold starts where there is no user-keyed
 * snapshot to carry the intent (the anonymous → sign-up case).
 *
 * Storage failure is non-fatal: a freshly captured intent that fails
 * to persist is still live in React state; only the cold-start path
 * needs persistence to recover.
 */
export async function savePendingInviteIntentToStorage(
  intent: PendingInviteIntent,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PENDING_INVITE_INTENT_STORAGE_KEY,
      JSON.stringify(intent),
    );
  } catch {
    // Non-fatal — see doctrine.
  }
}

/**
 * Load + parse + freshness-check the persisted intent. Returns `null`
 * for missing / malformed / stale. NEVER throws.
 */
export async function loadPendingInviteIntentFromStorage(
  nowIso: string,
): Promise<PendingInviteIntent | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_INVITE_INTENT_STORAGE_KEY);
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    return loadFreshPendingInviteIntent(parsed, nowIso);
  } catch {
    return null;
  }
}

/** Remove the persisted intent. Idempotent. */
export async function clearPendingInviteIntentFromStorage(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_INVITE_INTENT_STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
}
