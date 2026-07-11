/**
 * UX-FLAGS-004 (#836) — flag-intent preset copy ban-list.
 *
 * Structurally cloned from friendlyFlagMapBanList.test.ts. Scans the three NEW
 * flag-intent preset bodies (ALL_FLAG_INTENT_PRESET_BODIES) AND all five intent
 * bodies as DERIVED from the production quickActionToPreset for:
 *   - verdict / truth tokens (cdiscourse-doctrine section 1),
 *   - no "proof" box token (the seed uses source / receipt language),
 *   - no internal-code / snake_case leak (section 9),
 *   - advisory framing (the prefill never asserts the machine flag is true).
 */
import {
  ALL_FLAG_INTENT_PRESET_BODIES,
  quickActionToPreset,
} from '../src/features/arguments/quickActionPresets';
import {
  FLAG_INTENT_TO_QUICK_ACTION,
  ALL_COMPOSER_INTENT_CODES,
} from '../src/features/feedbackFlags';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// Doctrine ban-list (superset of the friendlyFlagMap list) + the "proof" box
// token the design explicitly bans for the evidence-adjacent seed copy.
const BANNED_TOKENS = [
  'winner',
  'loser',
  'won',
  'lost',
  'win',
  'lose',
  'right',
  'wrong',
  'true',
  'false',
  'correct',
  'incorrect',
  'proof',
  'proven',
  'disproven',
  'fallacy',
  'liar',
  'lying',
  'dishonest',
  'bad faith',
  'manipulative',
  'propagandist',
  'extremist',
  'troll',
  'bot',
  'stupid',
  'idiot',
  'truth',
  'verdict',
];

/** Whole-word, case-insensitive scan. "lost" must not match "almost". */
function containsBannedToken(text: string): string | null {
  const lower = text.toLowerCase();
  for (const token of BANNED_TOKENS) {
    if (token.includes(' ')) {
      if (lower.includes(token)) return token;
    } else {
      const re = new RegExp(`\\b${token}\\b`, 'i');
      if (re.test(lower)) return token;
    }
  }
  return null;
}

/** Every flag-intent preset body, DERIVED from the production preset producer. */
function derivedIntentBodies(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const code of ALL_COMPOSER_INTENT_CODES) {
    const quickAction = FLAG_INTENT_TO_QUICK_ACTION[code];
    const preset = quickActionToPreset(quickAction, null);
    const body = preset?.body;
    if (typeof body === 'string') out.push({ where: `${code} (${quickAction})`, text: body });
  }
  return out;
}

describe('UX-FLAGS-004 preset copy — no verdict / truth / proof token', () => {
  it('the three NEW inline bodies carry no banned token', () => {
    ALL_FLAG_INTENT_PRESET_BODIES.forEach((body, i) => {
      const hit = containsBannedToken(body);
      expect(hit ? `body[${i}]: "${hit}"` : null).toBeNull();
    });
  });

  it('all five DERIVED intent bodies carry no banned token (production derivation)', () => {
    for (const { where, text } of derivedIntentBodies()) {
      const hit = containsBannedToken(text);
      expect(hit ? `${where}: "${hit}"` : null).toBeNull();
    }
  });

  it('every derived intent actually seeds a non-empty body (all five are pre-typed)', () => {
    const bodies = derivedIntentBodies();
    expect(bodies.length).toBe(ALL_COMPOSER_INTENT_CODES.length);
    for (const { where, text } of bodies) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(where.length).toBeGreaterThan(0);
    }
  });
});

describe('UX-FLAGS-004 preset copy — no internal code leaks into user copy', () => {
  it('no NEW inline body looks like an internal code or contains an underscore', () => {
    for (const body of ALL_FLAG_INTENT_PRESET_BODIES) {
      expect(looksLikeInternalCode(body)).toBe(false);
      expect(body.includes('_')).toBe(false);
    }
  });

  it('no derived intent body looks like an internal code or contains an underscore', () => {
    for (const { where, text } of derivedIntentBodies()) {
      expect(looksLikeInternalCode(text) ? where : null).toBeNull();
      expect(text.includes('_') ? `${where} has underscore` : null).toBeNull();
    }
  });
});

describe('UX-FLAGS-004 preset copy — advisory framing', () => {
  // The seed is the USER draft, an editable ask; it must never assert the machine
  // flag is authoritative ("you are wrong", "this is false", "the machine says").
  const ASSERTION_PHRASES = ['you are wrong', 'this is false', 'the machine', 'you lose', 'i win'];

  it('no body asserts the flag is authoritative', () => {
    for (const { where, text } of derivedIntentBodies()) {
      const lower = text.toLowerCase();
      for (const phrase of ASSERTION_PHRASES) {
        expect(lower.includes(phrase) ? `${where} asserts "${phrase}"` : null).toBeNull();
      }
    }
  });
});
