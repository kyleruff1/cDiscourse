/**
 * ARG-ROOM-005 (#616) — seatClaimModel doctrine + source scan.
 *
 *  - SEAT_CLAIM_COPY + every produced string is ban-list clean (§1): "full" /
 *    "observe" are seat facts, never verdicts; no amplification / person tokens.
 *  - No count beyond the open-slot number is interpolated into any user-facing
 *    string — the 002 trigger DETAIL (cap=/active=/reserved=) is NEVER surfaced
 *    (§5, no enumeration).
 *  - The model is pure: it imports nothing from React / Supabase / network, and
 *    authors NO second cap literal (it derives the cap from roomActiveSeatCap →
 *    PUBLIC_ROOM_SEAT_CAP, pinned to 5).
 */
import fs from 'fs';
import path from 'path';
import {
  deriveSeatAvailability,
  buildSeatAvailabilityViewModel,
  _forbiddenSeatClaimTokens,
  type SeatAvailability,
} from '../src/features/debates/seatClaimModel';
import { SEAT_CLAIM_COPY } from '../src/features/arguments/gameCopy';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';
import type { ParticipantSide } from '../src/features/debates/types';

const BANNED = _forbiddenSeatClaimTokens();

/** Every string SEAT_CLAIM_COPY can emit, including interpolated counts. */
function allProducedStrings(): string[] {
  const out: string[] = [...Object.values(SEAT_CLAIM_COPY)];
  const sides: Array<ParticipantSide | null> = [
    'affirmative',
    'negative',
    'moderator',
    'observer',
    null,
  ];
  for (let active = 0; active <= 6; active += 1) {
    for (let reserved = 0; reserved <= 2; reserved += 1) {
      for (const viewerSide of sides) {
        const a: SeatAvailability = deriveSeatAvailability({
          visibility: 'public',
          activeParticipantCount: active,
          knownReservedInviteCount: reserved,
          viewerSide,
          reservedCountIsAuthoritative: true,
        });
        const vm = buildSeatAvailabilityViewModel(a, viewerSide);
        out.push(
          vm.openSeatsLabel,
          vm.fullRoomObserveNudge ?? '',
          vm.viewerStateLabel,
          vm.accessibilityLabel,
        );
      }
    }
  }
  return out.filter((s) => s.length > 0);
}

describe('ARG-ROOM-005 — SEAT_CLAIM_COPY ban-list (structural seat facts, never verdicts)', () => {
  it('no produced string contains a verdict / amplification / removal / person token', () => {
    for (const str of allProducedStrings()) {
      const lower = str.toLowerCase();
      for (const token of BANNED) {
        expect(lower).not.toContain(token);
      }
    }
  });

  it('no SEAT_CLAIM_COPY value looks like an internal code (no snake_case leak)', () => {
    for (const value of Object.values(SEAT_CLAIM_COPY)) {
      expect(looksLikeInternalCode(value)).toBe(false);
      expect(value).not.toContain('_');
    }
  });
});

describe('ARG-ROOM-005 — no DETAIL / count enumeration in user-facing strings', () => {
  it('never surfaces the trigger DETAIL tokens (cap= / active= / reserved=)', () => {
    for (const str of allProducedStrings()) {
      const lower = str.toLowerCase();
      expect(lower).not.toContain('cap=');
      expect(lower).not.toContain('active=');
      expect(lower).not.toContain('reserved=');
    }
  });

  it('only the open-slot count phrasing carries a number; the count copy uses a placeholder', () => {
    // The fixed strings carry no digit at all.
    expect(SEAT_CLAIM_COPY.openSeatsZero).not.toMatch(/\d/);
    expect(SEAT_CLAIM_COPY.fullRoomObserve).not.toMatch(/\d/);
    expect(SEAT_CLAIM_COPY.youAreActive).not.toMatch(/\d/);
    expect(SEAT_CLAIM_COPY.youAreWatching).not.toMatch(/\d/);
    // The "many" copy interpolates ONLY {count} — no literal count, no cap.
    expect(SEAT_CLAIM_COPY.openSeatsMany).toContain('{count}');
    expect(SEAT_CLAIM_COPY.openSeatsMany).not.toMatch(/\d/);
  });
});

// ── Pure-model source scan ──────────────────────────────────────

describe('ARG-ROOM-005 — seatClaimModel.ts is a pure model', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src/features/debates/seatClaimModel.ts'),
    'utf8',
  );

  // Strip comments + string literals so cap-literal / import scans never trip
  // on doc-comment prose ("5 public / 2 private") or coded tokens ('23505').
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""');

  it('imports nothing from React / Supabase / any network library', () => {
    expect(src).not.toMatch(/from\s+['"]react['"]/);
    expect(src).not.toMatch(/from\s+['"]react-native['"]/);
    expect(src).not.toMatch(/from\s+['"]@?supabase/);
    expect(src).not.toMatch(/lib\/supabase/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/XMLHttpRequest/);
  });

  it('derives the cap from the single source (roomActiveSeatCap) and authors NO second cap literal', () => {
    // It MUST use the shared seam …
    expect(code).toMatch(/roomActiveSeatCap\s*\(/);
    // … and MUST NOT hard-code 5 / 2 anywhere in executable code.
    expect(code).not.toMatch(/\b5\b/);
    expect(code).not.toMatch(/\b2\b/);
  });
});
