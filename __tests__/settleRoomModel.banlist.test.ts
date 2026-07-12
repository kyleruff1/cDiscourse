/**
 * SETTLE-001 (#911) — Doctrine ban-list scan over ROOM_SETTLE_COPY.
 *
 * Settling a room is a LIFECYCLE transition (open to locked and back), never
 * a verdict, never a punishment, never shaming. Every string must be plain
 * English and ban-list-clean. Mirrors roomVisibilityModel.banlist.test.ts,
 * and includes a FIRING negative control that proves the matcher is live.
 */
import { ROOM_SETTLE_COPY } from '../src/features/debates/settleRoomModel';

/**
 * Doctrine ban-list. Mirrors cdiscourse-doctrine §1-§3 vocabulary:
 *   - Truth / outcome verdicts: winner / loser / true / false / correct /
 *     verdict / decided / final / liar / dishonest / bad faith / manipulative
 *     / extremist / propagandist / score.
 *   - Punishment / shaming framings: booted / kicked / removed / rejected /
 *     unwanted / shame / punish.
 *   - Popularity tokens: viral / trending.
 */
const BANNED_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /\bwinner\b/i,
  /\bloser\b/i,
  /\btrue\b/i,
  /\bfalse\b/i,
  /\bcorrect\b/i,
  /\bverdict\b/i,
  /\bdecided\b/i,
  /\bfinal\b/i,
  /\bscore\b/i,
  /\bliar\b/i,
  /\bdishonest\b/i,
  /\bbad faith\b/i,
  /\bmanipulative\b/i,
  /\bextremist\b/i,
  /\bpropagandist\b/i,
  /\bbooted\b/i,
  /\bkicked\b/i,
  /\bremoved\b/i,
  /\brejected\b/i,
  /\bunwanted\b/i,
  /\bshame\b/i,
  /\bpunish/i,
  /\bviral\b/i,
  /\btrending\b/i,
]);

function collectAllCopyStrings(): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(ROOM_SETTLE_COPY)) {
    if (typeof value === 'string') {
      out.push(`${key}: ${value}`);
    }
  }
  return out;
}

describe('ROOM_SETTLE_COPY — doctrine ban-list scan', () => {
  it('has at least one copy string to scan', () => {
    expect(collectAllCopyStrings().length).toBeGreaterThan(0);
  });

  it('every string is non-empty', () => {
    for (const entry of collectAllCopyStrings()) {
      const [, ...rest] = entry.split(': ');
      expect(rest.join(': ').length).toBeGreaterThan(0);
    }
  });

  it.each(BANNED_PATTERNS.map((p) => [p.source, p] as const))(
    'no string contains banned pattern %s',
    (_label, pattern) => {
      for (const entry of collectAllCopyStrings()) {
        expect(entry).not.toMatch(pattern);
      }
    },
  );

  it('contains zero snake_case fragments inside string values (no code leak)', () => {
    for (const entry of collectAllCopyStrings()) {
      const [, ...rest] = entry.split(': ');
      expect(rest.join(': ')).not.toMatch(/[a-z]_[a-z]/);
    }
  });

  it('never mentions "debate" in a user-facing string (terminology scrub)', () => {
    for (const entry of collectAllCopyStrings()) {
      const [, ...rest] = entry.split(': ');
      expect(rest.join(': ')).not.toMatch(/\bdebate\b/i);
    }
  });

  it('never says "game" in a user-facing string', () => {
    for (const entry of collectAllCopyStrings()) {
      const [, ...rest] = entry.split(': ');
      expect(rest.join(': ')).not.toMatch(/\bgame\b/i);
    }
  });
});

describe('ROOM_SETTLE_COPY — firing negative control (the guard is live)', () => {
  // A deliberately-violating string must trip the SAME matcher set, proving
  // the ban-list is not a no-op that would pass on any input.
  const violators = [
    'This side is the winner.',
    'The argument is decided and final.',
    'Your score dropped to the loser tier.',
  ];

  it.each(violators)('flags the intentionally-violating string %s', (text) => {
    const tripped = BANNED_PATTERNS.some((pattern) => pattern.test(text));
    expect(tripped).toBe(true);
  });

  it('does NOT over-block the canonical settle copy', () => {
    const clean = [
      ROOM_SETTLE_COPY.action_settle_label,
      ROOM_SETTLE_COPY.notice_settled_title,
      ROOM_SETTLE_COPY.effect_no_new_joiners,
      ROOM_SETTLE_COPY.effect_existing_links_kept,
    ];
    for (const text of clean) {
      const tripped = BANNED_PATTERNS.some((pattern) => pattern.test(text));
      expect(tripped).toBe(false);
    }
  });
});
