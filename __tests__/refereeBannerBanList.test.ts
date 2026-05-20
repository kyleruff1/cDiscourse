/**
 * MCP-014 — Referee banner library: doctrine ban-list (acceptance criterion).
 *
 * Scans EVERY headline, EVERY helperLine, EVERY accessibilityLabel, and EVERY
 * bannerCode in the full library against the doctrine ban-list. Also enforces:
 *   - no user-facing field looks like an internal code,
 *   - no bannerCode string leaks verbatim into a user-facing field,
 *   - no popularity-as-praise (a popularity token implies a not-proof phrase),
 *   - no second-person belittling construction,
 *   - the RefereeBanner schema carries no verdict-shaped key,
 *   - every softened sibling headline hedges.
 */

import {
  REFEREE_BANNER_LIBRARY,
} from '../src/features/refereeBanners';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// ── The doctrine ban-list (MCP-014 design test plan) ──────────────

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
  'proven',
  'disproven',
  'defeated',
  'beat',
  'crush',
  'liar',
  'lying',
  'dishonest',
  'bad faith',
  'manipulative',
  'troll',
  'bot',
  'astroturfer',
  'propagandist',
  'extremist',
  'stupid',
  'idiot',
  'dumb',
  'smart',
  'clueless',
  'pathetic',
  'ignorant',
];

/**
 * Whole-word, case-insensitive scan. "lost" must not match "almost"; "win"
 * must not match "winning" mid-word — but "winning" is itself caught by the
 * `win` whole-word? No: `win` whole-word does not match `winning`. The library
 * is phrased to avoid even substring drift; a boundary scan is the honest test.
 */
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

/** Every user-facing string in the library, flattened with a label. */
function userFacingStrings(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const banner of REFEREE_BANNER_LIBRARY) {
    out.push({ where: `${banner.bannerCode}.headline`, text: banner.headline });
    out.push({
      where: `${banner.bannerCode}.accessibilityLabel`,
      text: banner.accessibilityLabel,
    });
    if (banner.helperLine !== undefined) {
      out.push({
        where: `${banner.bannerCode}.helperLine`,
        text: banner.helperLine,
      });
    }
  }
  return out;
}

describe('MCP-014 ban-list — no verdict / person token in any banner string', () => {
  it('no headline / helperLine / accessibilityLabel carries a banned token', () => {
    for (const { where, text } of userFacingStrings()) {
      const hit = containsBannedToken(text);
      expect(hit ? `${where}: "${hit}"` : null).toBeNull();
    }
  });

  it('no bannerCode carries a banned token', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      const hit = containsBannedToken(banner.bannerCode);
      expect(hit ? `${banner.bannerCode}: "${hit}"` : null).toBeNull();
    }
  });
});

describe('MCP-014 ban-list — no raw code reaches a banner surface', () => {
  it('no user-facing field looks like an internal code', () => {
    for (const { where, text } of userFacingStrings()) {
      expect(looksLikeInternalCode(text) ? where : null).toBeNull();
    }
  });

  it('no bannerCode appears verbatim inside any user-facing field', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      for (const other of REFEREE_BANNER_LIBRARY) {
        expect(banner.headline.includes(other.bannerCode)).toBe(false);
        expect(banner.accessibilityLabel.includes(other.bannerCode)).toBe(false);
        if (banner.helperLine !== undefined) {
          expect(banner.helperLine.includes(other.bannerCode)).toBe(false);
        }
      }
    }
  });
});

describe('MCP-014 ban-list — popularity is never praised as evidence', () => {
  const POPULARITY_TOKENS = [
    'popular',
    'popularity',
    'trending',
    'viral',
    'everyone agrees',
    'most people',
  ];
  const NOT_PROOF_PHRASES = [
    "isn't proof",
    'not proof',
    'not evidence',
    "what's the source",
  ];

  it('a banner string naming popularity also names that it is not proof', () => {
    for (const { where, text } of userFacingStrings()) {
      const lower = text.toLowerCase();
      const namesPopularity = POPULARITY_TOKENS.some((t) => lower.includes(t));
      if (!namesPopularity) continue;
      const namesNotProof = NOT_PROOF_PHRASES.some((p) => lower.includes(p));
      expect(namesNotProof ? null : `${where} praises popularity`).toBeNull();
    }
  });
});

describe('MCP-014 ban-list — no second-person belittling', () => {
  it('no string belittles the reader with a "you are wrong"-shaped construction', () => {
    const BELITTLING =
      /you('re| are) (wrong|losing|behind|bad|clueless|pathetic|ignorant)/i;
    for (const { where, text } of userFacingStrings()) {
      expect(BELITTLING.test(text) ? where : null).toBeNull();
    }
  });
});

describe('MCP-014 ban-list — RefereeBanner schema has no verdict surface', () => {
  it('a sampled RefereeBanner has no block / winner / truthValue / score / authoritative key', () => {
    const sample = REFEREE_BANNER_LIBRARY[0];
    const keys = Object.keys(sample);
    for (const forbidden of [
      'block',
      'winner',
      'loser',
      'truthValue',
      'score',
      'authoritative',
      'verdict',
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe('MCP-014 ban-list — softened siblings hedge', () => {
  const HEDGE_TOKENS = ['looks like', 'might', 'reads as', 'may'];

  it('every softened sibling headline contains a hedge token', () => {
    // A softened sibling is any entry that is the target of a softenedSiblingCode.
    const siblingCodes = new Set(
      REFEREE_BANNER_LIBRARY.map((b) => b.softenedSiblingCode).filter(
        (c): c is string => c !== null,
      ),
    );
    for (const banner of REFEREE_BANNER_LIBRARY) {
      if (!siblingCodes.has(banner.bannerCode)) continue;
      const lower = banner.headline.toLowerCase();
      const hasHedge = HEDGE_TOKENS.some((t) => lower.includes(t));
      expect(hasHedge ? null : `${banner.bannerCode} does not hedge`).toBeNull();
    }
  });
});
