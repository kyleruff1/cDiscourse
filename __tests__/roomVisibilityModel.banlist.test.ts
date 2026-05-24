/**
 * QOL-039 — Doctrine ban-list scan over ROOM_VISIBILITY_COPY + the
 * plain-language entries the toPlainLanguage routing exposes.
 *
 * "Make this argument private" is a STRUCTURAL access transition, never
 * a verdict, never a penalty, never shaming. Every string must be plain
 * English and ban-list-clean.
 */
import { ROOM_VISIBILITY_COPY } from '../src/features/debates/roomVisibilityModel';
import { toPlainLanguage } from '../src/features/arguments/gameCopy';
import { ALL_TRANSITION_REASONS } from '../src/features/debates/roomVisibilityModel';

/**
 * Doctrine ban-list. Mirrors the design's §11 + the universal
 * cdiscourse-doctrine §1-§3 vocabulary:
 *   - Truth verdicts: winner / loser / true / false / correct / liar /
 *     dishonest / bad faith / manipulative / extremist / propagandist.
 *   - Punishment / shaming framings: booted / kicked / removed (person) /
 *     rejected (person) / unwanted (person) / shame.
 *
 * Each token is matched as a word boundary, case-insensitive. The
 * substring `corrected` is allowed (e.g. "the path corrected" doesn't
 * appear in v1 but the substring `correct` is too brittle to forbid;
 * we use `\bcorrect\b` instead). Likewise `falsifiable` is allowed; we
 * use `\bfalse\b` instead.
 */
const BANNED_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /\bwinner\b/i,
  /\bloser\b/i,
  /\btrue\b/i,
  /\bfalse\b/i,
  /\bcorrect\b/i,
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
  // Popularity tokens — visibility is creator-chosen, never heat-driven.
  /\bviral\b/i,
  /\btrending\b/i,
]);

function collectAllCopyStrings(): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(ROOM_VISIBILITY_COPY)) {
    if (typeof value === 'string') {
      out.push(`${key}: ${value}`);
    }
  }
  return out;
}

describe('ROOM_VISIBILITY_COPY — doctrine ban-list scan', () => {
  it('every string is non-empty', () => {
    for (const entry of collectAllCopyStrings()) {
      const [, ...rest] = entry.split(': ');
      const v = rest.join(': ');
      expect(v.length).toBeGreaterThan(0);
    }
  });

  it.each(BANNED_PATTERNS.map((p) => [p.source, p]))(
    'no string contains banned pattern %s',
    (_label, pattern) => {
      for (const entry of collectAllCopyStrings()) {
        // Allowed: nothing in ROOM_VISIBILITY_COPY references the banned
        // tokens. If a future maintainer adds one, this test fires.
        expect(entry).not.toMatch(pattern);
      }
    },
  );

  it('contains zero snake_case fragments inside string values', () => {
    // A label that leaks `room_made_private` or similar would be a
    // doctrine violation (internal codes never reach the UI verbatim).
    for (const entry of collectAllCopyStrings()) {
      const [, ...rest] = entry.split(': ');
      const v = rest.join(': ');
      // Match e.g. `make_private`, `make_room_private`, but allow
      // ordinary apostrophes / hyphens. The Stage 6.4 looksLikeInternalCode
      // pattern is the canonical detector; we replicate its underscore
      // check here.
      expect(v).not.toMatch(/[a-z]_[a-z]/);
    }
  });

  it('never mentions "debate" in a user-facing string (terminology scrub)', () => {
    // Per QOL-035: user-facing copy says "argument" / "room", never
    // "debate". The internal table name stays internal.
    for (const entry of collectAllCopyStrings()) {
      // "debate" only appears as a value, not a key.
      const [, ...rest] = entry.split(': ');
      const v = rest.join(': ');
      expect(v).not.toMatch(/\bdebate\b/i);
    }
  });

  it('never says "game" in a user-facing string', () => {
    for (const entry of collectAllCopyStrings()) {
      const [, ...rest] = entry.split(': ');
      const v = rest.join(': ');
      expect(v).not.toMatch(/\bgame\b/i);
    }
  });
});

describe('ROOM_VISIBILITY_COPY — plain-language routing', () => {
  it('every TransitionReason resolves to a non-empty plain-language string', () => {
    for (const reason of ALL_TRANSITION_REASONS) {
      const plain = toPlainLanguage(reason);
      expect(plain).not.toBeNull();
      expect(typeof plain).toBe('string');
      expect((plain as string).length).toBeGreaterThan(0);
    }
  });

  it('plain-language reasons never contain snake_case', () => {
    for (const reason of ALL_TRANSITION_REASONS) {
      const plain = toPlainLanguage(reason);
      expect(plain).not.toMatch(/[a-z]_[a-z]/);
    }
  });

  it('plain-language reasons are ban-list-clean', () => {
    for (const reason of ALL_TRANSITION_REASONS) {
      const plain = toPlainLanguage(reason) as string;
      for (const pattern of BANNED_PATTERNS) {
        expect(plain).not.toMatch(pattern);
      }
    }
  });
});
