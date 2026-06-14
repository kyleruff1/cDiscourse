/**
 * UX-SIMPLIFY-002B — public-room active-seat clarity (pure model).
 *
 * Tests the "N of M active seats" summary + the readers-don't-use-seats note
 * over the existing seat-availability model. Active = For / Against / Host
 * (isActiveParticipantSide); readers/observers are uncapped and never consume a
 * seat. The cap is the single source of truth (roomActiveSeatCap), never a
 * literal. Observer/watch COUNT is intentionally NOT implemented here (see the
 * deferral note below).
 */
import {
  deriveSeatAvailability,
  buildSeatAvailabilityViewModel,
  formatActiveSeatSummary,
  isActiveParticipantSide,
  _forbiddenSeatClaimTokens,
} from '../src/features/debates/seatClaimModel';
import { SEAT_CLAIM_COPY } from '../src/features/arguments/gameCopy';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';
import type { ParticipantSide } from '../src/features/debates/types';

function avail(over: Partial<Parameters<typeof deriveSeatAvailability>[0]> = {}) {
  return deriveSeatAvailability({
    visibility: 'public',
    activeParticipantCount: 1,
    knownReservedInviteCount: 0,
    viewerSide: null,
    ...over,
  });
}

describe('UX-SIMPLIFY-002B formatActiveSeatSummary', () => {
  it('reads "N of M active seats" from the count + the cap (public cap = 5)', () => {
    expect(formatActiveSeatSummary(avail({ activeParticipantCount: 1 }))).toBe('1 of 5 active seats');
    expect(formatActiveSeatSummary(avail({ activeParticipantCount: 3 }))).toBe('3 of 5 active seats');
    expect(formatActiveSeatSummary(avail({ activeParticipantCount: 5 }))).toBe('5 of 5 active seats');
  });

  it('uses the room cap as the single source of truth (private cap = 2)', () => {
    expect(
      formatActiveSeatSummary(avail({ visibility: 'private', activeParticipantCount: 1 })),
    ).toBe('1 of 2 active seats');
  });

  it('counts the Host (moderator side) and the two debate sides as active', () => {
    // The active count is upstream (side <> observer); the model treats
    // For / Against / Host as active and observers/readers as not.
    expect(isActiveParticipantSide('moderator')).toBe(true);
    expect(isActiveParticipantSide('affirmative')).toBe(true);
    expect(isActiveParticipantSide('negative')).toBe(true);
    expect(isActiveParticipantSide('observer')).toBe(false);
    expect(isActiveParticipantSide(null)).toBe(false);
  });
});

describe('UX-SIMPLIFY-002B buildSeatAvailabilityViewModel — seat/voice clarity fields', () => {
  it('exposes the active-seats summary + the readers note', () => {
    const vm = buildSeatAvailabilityViewModel(avail({ activeParticipantCount: 2 }), null);
    expect(vm.activeSeatsLabel).toBe('2 of 5 active seats');
    expect(vm.readersNote).toBe('Readers do not use active seats');
    expect(vm.readersNote).toBe(SEAT_CLAIM_COPY.readersNote);
  });

  it('the Host viewer reads as in the argument (active), not watching', () => {
    const vm = buildSeatAvailabilityViewModel(avail({ activeParticipantCount: 3 }), 'moderator');
    expect(vm.viewerStateLabel).toBe("You're in this argument.");
  });

  it('a reader (null side) reads as watching', () => {
    const vm = buildSeatAvailabilityViewModel(avail({ activeParticipantCount: 3 }), null);
    expect(vm.viewerStateLabel).toBe("You're watching.");
  });

  it('folds the active-seats summary + readers note into the accessibility label', () => {
    const vm = buildSeatAvailabilityViewModel(avail({ activeParticipantCount: 2 }), null);
    expect(vm.accessibilityLabel).toContain('2 of 5 active seats');
    expect(vm.accessibilityLabel).toContain('Readers do not use active seats');
  });

  it('the new clarity copy is ban-list clean and carries no internal-code shape', () => {
    const banned = _forbiddenSeatClaimTokens();
    const sides: Array<ParticipantSide | null> = ['affirmative', 'negative', 'moderator', 'observer', null];
    for (let active = 0; active <= 6; active += 1) {
      for (const side of sides) {
        const vm = buildSeatAvailabilityViewModel(avail({ activeParticipantCount: active, viewerSide: side }), side);
        for (const text of [vm.activeSeatsLabel, vm.readersNote]) {
          const lower = text.toLowerCase();
          for (const token of banned) expect(lower).not.toContain(token);
          expect(looksLikeInternalCode(text)).toBe(false);
          expect(text).not.toContain('_');
          // No DETAIL enumeration tokens.
          expect(lower).not.toContain('cap=');
          expect(lower).not.toContain('active=');
        }
      }
    }
  });
});
