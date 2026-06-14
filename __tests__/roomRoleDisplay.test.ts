/**
 * UX-SIMPLIFY-002A — room participant-side display-label tests.
 *
 * Guards the de-collided role labels: the `moderator` SIDE (the room
 * creator/host, an active cap-counted seat) renders "Host" — NEVER "Observer".
 * "Observer"/"Watching" belongs to the genuine read-only `observer` side. The
 * per-room SIDE is proven orthogonal to the platform app-role `moderator`,
 * which stays "Moderator".
 */
import {
  ROOM_ROLE_DISPLAY_LABEL,
  plainLanguageForRoomRole,
} from '../src/features/debates/roomRoleDisplay';
import { toPlainLanguage } from '../src/features/arguments/gameCopy';
import type { ParticipantSide } from '../src/features/debates/types';

const ALL_SIDES: ParticipantSide[] = ['affirmative', 'negative', 'observer', 'moderator'];

describe('UX-SIMPLIFY-002A plainLanguageForRoomRole', () => {
  it('renders the room creator/host (moderator side) as "Host", never "Observer"', () => {
    expect(plainLanguageForRoomRole('moderator')).toBe('Host');
    expect(plainLanguageForRoomRole('moderator')).not.toBe('Observer');
  });

  it('renders the read-only observer side as "Watching"', () => {
    expect(plainLanguageForRoomRole('observer')).toBe('Watching');
  });

  it('renders the two active debate sides as For / Against', () => {
    expect(plainLanguageForRoomRole('affirmative')).toBe('For');
    expect(plainLanguageForRoomRole('negative')).toBe('Against');
  });

  it('treats a null/undefined side (pure reader) as the watcher label', () => {
    expect(plainLanguageForRoomRole(null)).toBe('Watching');
    expect(plainLanguageForRoomRole(undefined)).toBe('Watching');
  });

  it('agrees with the canonical PLAIN_LANGUAGE_COPY (no drift) for every side', () => {
    for (const side of ALL_SIDES) {
      expect(plainLanguageForRoomRole(side)).toBe(ROOM_ROLE_DISPLAY_LABEL[side]);
      expect(toPlainLanguage(side)).toBe(ROOM_ROLE_DISPLAY_LABEL[side]);
    }
  });

  it('no side label is a verdict / person-judgment token', () => {
    const banned = ['winner', 'loser', 'true', 'false', 'right', 'wrong', 'liar', 'verdict'];
    for (const side of ALL_SIDES) {
      const label = plainLanguageForRoomRole(side).toLowerCase();
      for (const token of banned) expect(label.includes(token)).toBe(false);
    }
  });

  // Orthogonality note: the per-room SIDE relabel here does NOT touch the
  // platform app-role display (`formatProfileRole`: moderator -> "Moderator",
  // user -> "Participant", admin -> "Admin"). That helper lives in
  // accountApi.ts (which pulls in the supabase client, so it is not imported
  // into this pure test) and is covered by accountProfile.test.ts. This card
  // changes neither accountApi nor ROLE_LABELS.
});
