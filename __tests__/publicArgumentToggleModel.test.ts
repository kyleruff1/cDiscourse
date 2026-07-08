/**
 * START-003 (#875) — publicArgumentToggleModel unit matrix (two-tap proof L1).
 *
 * Layers of the two-tap proof at the model level:
 *   3.1 transition invariant — no single event from `private` reaches
 *       `public_confirmed`;
 *   3.2 resolve invariant — resolveCreationVisibility(s) === 'public' iff
 *       s === 'public_confirmed';
 *   3.3 minimal-path length — no length-1 event sequence from `private` yields
 *       `public_confirmed`; [flip_on, confirm] (length 2) does.
 * Plus the full transition table, the switch/preview helpers, and a reuse
 * assertion that the created-public room derives `public_respondent_seat_open`
 * via the EXISTING oneToOneRoomModel deriver (no new deriver).
 */
import fs from 'fs';
import path from 'path';
import {
  nextPublicToggleState,
  resolveCreationVisibility,
  isPublicPreviewVisible,
  isSwitchOn,
  initialStateForVisibility,
  ALL_PUBLIC_TOGGLE_STATES,
  ALL_PUBLIC_TOGGLE_EVENTS,
  type PublicToggleState,
  type PublicToggleEvent,
} from '../src/features/arguments/startArgument/publicArgumentToggleModel';
import { deriveRoomOneToOneDisplayState } from '../src/features/debates/oneToOneRoomModel';

// ── Full transition table ───────────────────────────────────────

describe('nextPublicToggleState — full transition table', () => {
  const TABLE: Record<PublicToggleState, Record<PublicToggleEvent, PublicToggleState>> = {
    private: { flip_on: 'previewing_public', flip_off: 'private', confirm: 'private', dismiss: 'private' },
    previewing_public: { flip_on: 'previewing_public', flip_off: 'private', confirm: 'public_confirmed', dismiss: 'private' },
    public_confirmed: { flip_on: 'public_confirmed', flip_off: 'private', confirm: 'public_confirmed', dismiss: 'private' },
  };

  it('every (state, event) cell returns the design-decision-1 value', () => {
    for (const state of ALL_PUBLIC_TOGGLE_STATES) {
      for (const event of ALL_PUBLIC_TOGGLE_EVENTS) {
        expect(nextPublicToggleState(state, event)).toBe(TABLE[state][event]);
      }
    }
  });

  it('flip_off and dismiss retreat to private from ANY state', () => {
    for (const state of ALL_PUBLIC_TOGGLE_STATES) {
      expect(nextPublicToggleState(state, 'flip_off')).toBe('private');
      expect(nextPublicToggleState(state, 'dismiss')).toBe('private');
    }
  });

  it('fails closed to private for an unknown state/event', () => {
    expect(nextPublicToggleState('bogus' as PublicToggleState, 'flip_on')).toBe('private');
    expect(nextPublicToggleState('private', 'bogus' as PublicToggleEvent)).toBe('private');
  });
});

// ── Two-tap proof 3.1 — no single event reaches confirmed ───────

describe('two-tap proof 3.1 — no single event from private reaches public_confirmed', () => {
  it('for EVERY event, next(private, e) !== public_confirmed', () => {
    for (const event of ALL_PUBLIC_TOGGLE_EVENTS) {
      expect(nextPublicToggleState('private', event)).not.toBe('public_confirmed');
    }
  });
});

// ── Two-tap proof 3.2 — resolve invariant ───────────────────────

describe('two-tap proof 3.2 — resolveCreationVisibility', () => {
  it("returns 'public' iff the state is public_confirmed", () => {
    for (const state of ALL_PUBLIC_TOGGLE_STATES) {
      const expected = state === 'public_confirmed' ? 'public' : 'private';
      expect(resolveCreationVisibility(state)).toBe(expected);
    }
  });

  it("private and previewing_public both resolve to 'private'", () => {
    expect(resolveCreationVisibility('private')).toBe('private');
    expect(resolveCreationVisibility('previewing_public')).toBe('private');
  });
});

// ── Two-tap proof 3.3 — minimal-path length ─────────────────────

describe('two-tap proof 3.3 — minimal path from private to public_confirmed', () => {
  it('no length-1 event sequence from private yields public_confirmed', () => {
    for (const event of ALL_PUBLIC_TOGGLE_EVENTS) {
      const s1 = nextPublicToggleState('private', event);
      expect(s1).not.toBe('public_confirmed');
    }
  });

  it('[flip_on, confirm] (length 2) reaches public_confirmed', () => {
    const s1 = nextPublicToggleState('private', 'flip_on');
    const s2 = nextPublicToggleState(s1, 'confirm');
    expect(s1).toBe('previewing_public');
    expect(s2).toBe('public_confirmed');
    expect(resolveCreationVisibility(s2)).toBe('public');
  });

  it('exhaustive: no length-2 path except [flip_on, confirm] reaches confirmed', () => {
    const reaching: string[] = [];
    for (const e1 of ALL_PUBLIC_TOGGLE_EVENTS) {
      for (const e2 of ALL_PUBLIC_TOGGLE_EVENTS) {
        const s = nextPublicToggleState(nextPublicToggleState('private', e1), e2);
        if (s === 'public_confirmed') reaching.push(`${e1},${e2}`);
      }
    }
    expect(reaching).toEqual(['flip_on,confirm']);
  });
});

// ── Helpers ─────────────────────────────────────────────────────

describe('isSwitchOn / isPublicPreviewVisible / initialStateForVisibility', () => {
  it('switch + preview are ON for previewing_public and public_confirmed, OFF for private', () => {
    expect(isSwitchOn('private')).toBe(false);
    expect(isPublicPreviewVisible('private')).toBe(false);
    for (const state of ['previewing_public', 'public_confirmed'] as PublicToggleState[]) {
      expect(isSwitchOn(state)).toBe(true);
      expect(isPublicPreviewVisible(state)).toBe(true);
    }
  });

  it('initialStateForVisibility maps public -> public_confirmed, else private', () => {
    expect(initialStateForVisibility('public')).toBe('public_confirmed');
    expect(initialStateForVisibility('private')).toBe('private');
  });
});

// ── Reuse assertion — created public room seat derivation ────────

describe('created-public-room reuse (existing oneToOneRoomModel deriver)', () => {
  it("public + open opponent seat derives public_respondent_seat_open", () => {
    expect(
      deriveRoomOneToOneDisplayState({ visibility: 'public', opponentSeatIsOpen: true }),
    ).toBe('public_respondent_seat_open');
  });

  it('private derives private_invited_access (no new deriver)', () => {
    expect(
      deriveRoomOneToOneDisplayState({ visibility: 'private', opponentSeatIsOpen: null }),
    ).toBe('private_invited_access');
  });
});

// ── Purity source-scan ──────────────────────────────────────────

describe('publicArgumentToggleModel.ts — purity', () => {
  const SRC = fs.readFileSync(
    path.join(process.cwd(), 'src/features/arguments/startArgument/publicArgumentToggleModel.ts'),
    'utf8',
  );

  it('is pure — no React, no Supabase, no gameCopy, no network', () => {
    expect(SRC).not.toMatch(/from\s+['"]react['"]/);
    expect(SRC).not.toMatch(/from\s+['"]react-native['"]/);
    expect(SRC).not.toMatch(/from\s+['"]@supabase\//);
    expect(SRC).not.toMatch(/from\s+['"][^'"]*gameCopy['"]/);
    expect(SRC).not.toMatch(/\.invoke\(/);
    expect(SRC).not.toMatch(/console\.log/);
    expect(SRC).not.toMatch(/SERVICE_ROLE/);
  });
});
