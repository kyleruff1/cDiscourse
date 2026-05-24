/**
 * QOL-038 — pure-model tests for `src/features/invites/pendingInviteIntent.ts`.
 *
 * Covers build / parse round-trip, freshness predicate, stale drop on
 * load, malformed handling, the never-throw contract of the parser, and
 * the AsyncStorage save/load/clear helpers (dedicated key so the intent
 * survives the anonymous → sign-up handshake where no user-keyed
 * snapshot is yet written).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  PENDING_INVITE_INTENT_FRESHNESS_MS,
  PENDING_INVITE_INTENT_STORAGE_KEY,
  buildPendingInviteIntent,
  clearPendingInviteIntentFromStorage,
  isPendingInviteIntentFresh,
  loadFreshPendingInviteIntent,
  loadPendingInviteIntentFromStorage,
  parsePendingInviteIntent,
  savePendingInviteIntentToStorage,
} from '../src/features/invites/pendingInviteIntent';

const GOOD_TOKEN = 'aB12345678901234567890123456789012345678901';

const NOW = '2026-05-24T12:00:00.000Z';
const ONE_HOUR_AGO = '2026-05-24T11:00:00.000Z';
const TWENTY_FIVE_HOURS_AGO = '2026-05-23T11:00:00.000Z';
const ONE_HOUR_AHEAD = '2026-05-24T13:00:00.000Z'; // clock skew

describe('buildPendingInviteIntent', () => {
  it('returns the captured intent for a valid token + timestamp', () => {
    expect(buildPendingInviteIntent(GOOD_TOKEN, NOW)).toEqual({
      token: GOOD_TOKEN,
      capturedAt: NOW,
    });
  });

  it('throws on bad token shape', () => {
    expect(() => buildPendingInviteIntent('too-short', NOW)).toThrow();
  });

  it('throws on bad timestamp', () => {
    expect(() => buildPendingInviteIntent(GOOD_TOKEN, 'not-a-date')).toThrow();
    expect(() => buildPendingInviteIntent(GOOD_TOKEN, '' as never)).toThrow();
  });
});

describe('parsePendingInviteIntent', () => {
  it('parses a valid serialised intent', () => {
    expect(parsePendingInviteIntent({ token: GOOD_TOKEN, capturedAt: NOW })).toEqual({
      token: GOOD_TOKEN,
      capturedAt: NOW,
    });
  });

  it('returns null for null / non-object', () => {
    expect(parsePendingInviteIntent(null)).toBeNull();
    expect(parsePendingInviteIntent('a string')).toBeNull();
    expect(parsePendingInviteIntent(123)).toBeNull();
    expect(parsePendingInviteIntent([])).toBeNull();
  });

  it('returns null when token is missing or bad-shape', () => {
    expect(parsePendingInviteIntent({ capturedAt: NOW })).toBeNull();
    expect(parsePendingInviteIntent({ token: 'too-short', capturedAt: NOW })).toBeNull();
    expect(parsePendingInviteIntent({ token: null, capturedAt: NOW })).toBeNull();
  });

  it('returns null when capturedAt is missing or malformed', () => {
    expect(parsePendingInviteIntent({ token: GOOD_TOKEN })).toBeNull();
    expect(parsePendingInviteIntent({ token: GOOD_TOKEN, capturedAt: 'nope' })).toBeNull();
    expect(parsePendingInviteIntent({ token: GOOD_TOKEN, capturedAt: 42 })).toBeNull();
  });
});

describe('isPendingInviteIntentFresh', () => {
  it('returns true for an intent captured within the window', () => {
    expect(isPendingInviteIntentFresh({ capturedAt: ONE_HOUR_AGO }, NOW)).toBe(true);
    expect(isPendingInviteIntentFresh({ capturedAt: NOW }, NOW)).toBe(true);
  });

  it('returns false for an intent older than the window', () => {
    expect(isPendingInviteIntentFresh({ capturedAt: TWENTY_FIVE_HOURS_AGO }, NOW)).toBe(false);
  });

  it('treats a future capturedAt (clock skew) as fresh', () => {
    expect(isPendingInviteIntentFresh({ capturedAt: ONE_HOUR_AHEAD }, NOW)).toBe(true);
  });

  it('returns false for malformed timestamps', () => {
    expect(isPendingInviteIntentFresh({ capturedAt: 'oops' }, NOW)).toBe(false);
    expect(isPendingInviteIntentFresh({ capturedAt: ONE_HOUR_AGO }, 'nope')).toBe(false);
  });

  it('exposes the freshness window as a positive constant <= 24h', () => {
    expect(PENDING_INVITE_INTENT_FRESHNESS_MS).toBe(24 * 60 * 60 * 1000);
    expect(PENDING_INVITE_INTENT_FRESHNESS_MS).toBeGreaterThan(0);
  });
});

describe('loadFreshPendingInviteIntent', () => {
  it('returns the parsed intent when it is well-formed and fresh', () => {
    expect(
      loadFreshPendingInviteIntent({ token: GOOD_TOKEN, capturedAt: ONE_HOUR_AGO }, NOW),
    ).toEqual({ token: GOOD_TOKEN, capturedAt: ONE_HOUR_AGO });
  });

  it('returns null for a stale intent', () => {
    expect(
      loadFreshPendingInviteIntent({ token: GOOD_TOKEN, capturedAt: TWENTY_FIVE_HOURS_AGO }, NOW),
    ).toBeNull();
  });

  it('returns null for a malformed intent', () => {
    expect(loadFreshPendingInviteIntent({ token: 'short', capturedAt: NOW }, NOW)).toBeNull();
    expect(loadFreshPendingInviteIntent(null, NOW)).toBeNull();
    expect(loadFreshPendingInviteIntent('garbage', NOW)).toBeNull();
  });
});

// ── AsyncStorage helpers ──────────────────────────────────────

describe('savePendingInviteIntentToStorage / load / clear', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('uses the dedicated PENDING_INVITE_INTENT_STORAGE_KEY (not the user-keyed snapshot)', () => {
    // The key is well-known so the anonymous → sign-up handshake can
    // find the intent regardless of the (still-null) user id.
    expect(PENDING_INVITE_INTENT_STORAGE_KEY).toBe('cdiscourse:pending-invite-intent');
  });

  it('round-trips a fresh intent through storage', async () => {
    const nowIso = new Date().toISOString();
    const fresh = { token: GOOD_TOKEN, capturedAt: nowIso };
    await savePendingInviteIntentToStorage(fresh);
    const loaded = await loadPendingInviteIntentFromStorage(nowIso);
    expect(loaded).toEqual(fresh);
  });

  it('drops a stale intent on load', async () => {
    const stale = {
      token: GOOD_TOKEN,
      capturedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    };
    await savePendingInviteIntentToStorage(stale);
    const loaded = await loadPendingInviteIntentFromStorage(new Date().toISOString());
    expect(loaded).toBeNull();
  });

  it('returns null for missing storage', async () => {
    const loaded = await loadPendingInviteIntentFromStorage(new Date().toISOString());
    expect(loaded).toBeNull();
  });

  it('clears the persisted intent', async () => {
    const fresh = { token: GOOD_TOKEN, capturedAt: new Date().toISOString() };
    await savePendingInviteIntentToStorage(fresh);
    await clearPendingInviteIntentFromStorage();
    const loaded = await loadPendingInviteIntentFromStorage(new Date().toISOString());
    expect(loaded).toBeNull();
  });

  it('tolerates corrupt persisted JSON', async () => {
    await AsyncStorage.setItem(PENDING_INVITE_INTENT_STORAGE_KEY, '{{not valid}}');
    const loaded = await loadPendingInviteIntentFromStorage(new Date().toISOString());
    expect(loaded).toBeNull();
  });
});
