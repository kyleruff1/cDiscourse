/**
 * GAL-001 — Gallery section copy table tests.
 *
 * Scans every `label`, `helperLine`, and `emptyCopy` string in
 * `GALLERY_SECTION_DEFINITIONS` for:
 *   - completeness (10 entries, one per union member, SECTION_ORDER match)
 *   - length budgets (label ≤ 64 chars + ≤ 8 tokens, helperLine ≤ 80,
 *     emptyCopy ≤ 120)
 *   - doctrine ban-list (no winner/loser/truth/proven/verdict/popular/
 *     trending/viral/correct/liar/dishonest/bad faith/manipulative/
 *     extremist/propagandist/troll/astroturfer)
 *   - plain-language guard (no snake_case internal codes leak)
 *   - heat-as-activity invariants (no popularity framing on liveness lanes)
 *
 * Pure-TS — no React, no Supabase, no network.
 */
import {
  GALLERY_SECTION_DEFINITIONS,
  SECTION_ORDER,
  type ConversationGallerySection,
} from '../src/features/debates/conversationGalleryModel';

/**
 * Tokens forbidden anywhere in label / helperLine / emptyCopy.
 *
 * `popular` / `popularity` are banned because doctrine §3 says popularity
 * is not evidence. `correct` / `incorrect` are banned because lanes
 * never claim a side is right. `truth` / `proven` / `verdict` are banned
 * for the same reason. `wrong` / `fail` are banned specifically to keep
 * the `logic_traps` lane from sliding into a "this side is wrong" framing.
 *
 * Tokens delimited by spaces (e.g. ` true `, ` right `) are scanned
 * with a word-boundary regex so common-English phrases like "right now"
 * or "true to form" do not produce false positives. Tokens without
 * spaces (e.g. `winner`, `popular`) match as substrings — these are
 * always doctrine-violating regardless of context.
 */
interface BannedToken {
  token: string;
  /**
   * Whether to apply word-boundary scanning. Used for short
   * everyday-English words that need precise matching.
   */
  wordBoundary: boolean;
}

const BANNED_TOKENS: ReadonlyArray<BannedToken> = Object.freeze([
  // Verdict tokens — substring scan
  { token: 'winner', wordBoundary: false },
  { token: 'winning', wordBoundary: false },
  { token: 'loser', wordBoundary: false },
  { token: 'losing', wordBoundary: false },
  { token: 'truth', wordBoundary: false },
  { token: 'proven', wordBoundary: false },
  { token: 'disproven', wordBoundary: false },
  { token: 'verdict', wordBoundary: false },
  { token: 'validated', wordBoundary: false },
  { token: 'correct', wordBoundary: false },
  { token: 'incorrect', wordBoundary: false },
  // Verdict tokens — word-boundary scan (avoid "true to form" / "won't" false hits)
  // Note: 'right' and 'wrong' are intentionally NOT in the ban-list because
  // they are routine English in plain-language UI copy (e.g. "right now",
  // "the wrong room") and never carry verdict semantics here. The verdict
  // family is covered by `winner`/`loser`/`proven`/`correct`/`validated` etc.
  { token: 'true', wordBoundary: true },
  { token: 'false', wordBoundary: true },
  { token: 'won', wordBoundary: true },
  { token: 'lost', wordBoundary: true },
  // Person-attribution slurs — substring scan
  { token: 'troll', wordBoundary: false },
  { token: 'liar', wordBoundary: false },
  { token: 'dishonest', wordBoundary: false },
  { token: 'bad faith', wordBoundary: false },
  { token: 'manipulative', wordBoundary: false },
  { token: 'extremist', wordBoundary: false },
  { token: 'propagandist', wordBoundary: false },
  { token: 'astroturfer', wordBoundary: false },
  // Popularity / engagement (doctrine §3) — substring scan
  { token: 'popular', wordBoundary: false },
  { token: 'popularity', wordBoundary: false },
  { token: 'trending', wordBoundary: false },
  { token: 'viral', wordBoundary: false },
  { token: 'virality', wordBoundary: false },
  { token: 'best room', wordBoundary: false },
  { token: 'worst room', wordBoundary: false },
] as const);

function hitsBanned(s: string, b: BannedToken): boolean {
  const lower = s.toLowerCase();
  const t = b.token.toLowerCase();
  if (b.wordBoundary) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    return re.test(lower);
  }
  return lower.includes(t);
}

// ──────────────────────────────────────────────────────────────
// Completeness
// ──────────────────────────────────────────────────────────────

describe('GALLERY_SECTION_DEFINITIONS — completeness', () => {
  it('has exactly 10 entries', () => {
    expect(GALLERY_SECTION_DEFINITIONS.length).toBe(10);
  });

  it('has one entry per ConversationGallerySection union member', () => {
    const ids = GALLERY_SECTION_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(10);
    const expected: ConversationGallerySection[] = [
      'my_rooms', 'needs_rebuttal', 'jump_in', 'source_trail',
      'evidence_needed', 'definition_fights', 'logic_traps',
      'tangents_branches', 'almost_synthesis', 'quiet_beginner_rooms',
    ];
    for (const id of expected) {
      expect(ids).toContain(id);
    }
  });

  it('entry order matches SECTION_ORDER', () => {
    const defIds = GALLERY_SECTION_DEFINITIONS.map((d) => d.id);
    expect(defIds).toEqual([...SECTION_ORDER]);
  });

  it('every entry has non-empty label / helperLine / emptyCopy', () => {
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      expect(typeof d.label).toBe('string');
      expect(d.label.trim().length).toBeGreaterThan(0);
      expect(typeof d.helperLine).toBe('string');
      expect(d.helperLine.trim().length).toBeGreaterThan(0);
      expect(typeof d.emptyCopy).toBe('string');
      expect(d.emptyCopy.trim().length).toBeGreaterThan(0);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// Length budgets
// ──────────────────────────────────────────────────────────────

describe('GALLERY_SECTION_DEFINITIONS — length budgets', () => {
  it('label length ≤ 64 chars for every entry', () => {
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      expect(d.label.length).toBeLessThanOrEqual(64);
    }
  });

  it('label has ≤ 8 whitespace-separated tokens for every entry', () => {
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      const tokens = d.label.split(/\s+/).filter(Boolean);
      expect(tokens.length).toBeLessThanOrEqual(8);
    }
  });

  it('helperLine length ≤ 80 chars for every entry', () => {
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      expect(d.helperLine.length).toBeLessThanOrEqual(80);
    }
  });

  it('emptyCopy length ≤ 120 chars for every entry', () => {
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      expect(d.emptyCopy.length).toBeLessThanOrEqual(120);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// Ban-list scan (doctrine §1 / §3 / §9)
// ──────────────────────────────────────────────────────────────

describe('GALLERY_SECTION_DEFINITIONS — ban-list scan', () => {
  it('no label contains a banned token (case-insensitive)', () => {
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      for (const b of BANNED_TOKENS) {
        expect({ id: d.id, label: d.label, hit: hitsBanned(d.label, b) ? b.token : null })
          .toEqual({ id: d.id, label: d.label, hit: null });
      }
    }
  });

  it('no helperLine contains a banned token (case-insensitive)', () => {
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      for (const b of BANNED_TOKENS) {
        expect({ id: d.id, helperLine: d.helperLine, hit: hitsBanned(d.helperLine, b) ? b.token : null })
          .toEqual({ id: d.id, helperLine: d.helperLine, hit: null });
      }
    }
  });

  it('no emptyCopy contains a banned token (case-insensitive)', () => {
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      for (const b of BANNED_TOKENS) {
        expect({ id: d.id, emptyCopy: d.emptyCopy, hit: hitsBanned(d.emptyCopy, b) ? b.token : null })
          .toEqual({ id: d.id, emptyCopy: d.emptyCopy, hit: null });
      }
    }
  });

  it('hitsBanned correctly distinguishes word-boundary tokens from substring tokens', () => {
    // word-boundary 'true' should NOT match inside 'truthful' (which itself is banned by 'truth' substring).
    expect(hitsBanned('he was untruthful', { token: 'true', wordBoundary: true })).toBe(false);
    // But the standalone word does match.
    expect(hitsBanned('that is true', { token: 'true', wordBoundary: true })).toBe(true);
    // Substring scan catches 'popular' inside 'popularity'.
    expect(hitsBanned('a popularity contest', { token: 'popular', wordBoundary: false })).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// Plain-language guard (no internal codes)
// ──────────────────────────────────────────────────────────────

describe('GALLERY_SECTION_DEFINITIONS — plain-language guard', () => {
  it('no helperLine contains a snake_case identifier (no _ adjacent to letters)', () => {
    const snake = /[a-z]_[a-z]/i;
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      expect({ id: d.id, helperLine: d.helperLine, snake: snake.test(d.helperLine) }).toEqual({
        id: d.id, helperLine: d.helperLine, snake: false,
      });
    }
  });

  it('no label contains a snake_case identifier', () => {
    const snake = /[a-z]_[a-z]/i;
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      expect(snake.test(d.label)).toBe(false);
    }
  });

  it('no emptyCopy contains a snake_case identifier', () => {
    const snake = /[a-z]_[a-z]/i;
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      expect(snake.test(d.emptyCopy)).toBe(false);
    }
  });

  it('no string contains a raw lane id (no internal-code leak)', () => {
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      for (const id of SECTION_ORDER) {
        expect(d.label.includes(id)).toBe(false);
        expect(d.helperLine.includes(id)).toBe(false);
        expect(d.emptyCopy.includes(id)).toBe(false);
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────
// Heat-as-activity doctrine (§2)
// ──────────────────────────────────────────────────────────────

describe('GALLERY_SECTION_DEFINITIONS — heat as activity (doctrine §2)', () => {
  it('jump_in helperLine frames liveness as activity, not popularity', () => {
    const def = GALLERY_SECTION_DEFINITIONS.find((d) => d.id === 'jump_in')!;
    const helper = def.helperLine.toLowerCase();
    // Activity-style words allowed; popularity-style words banned.
    const activityWords = ['active', 'back-and-forth', 'moves', 'live', 'fresh move'];
    expect(activityWords.some((w) => helper.includes(w))).toBe(true);
    expect(helper).not.toContain('popular');
    expect(helper).not.toContain('trending');
    expect(helper).not.toContain('viral');
    expect(helper).not.toContain('important');
  });

  it('logic_traps helperLine describes move structure, not a verdict', () => {
    const def = GALLERY_SECTION_DEFINITIONS.find((d) => d.id === 'logic_traps')!;
    const helper = def.helperLine.toLowerCase();
    expect(helper).not.toContain('wrong');
    expect(helper).not.toContain('fail');
    expect(helper).not.toContain('losing');
    expect(helper).not.toContain('lost');
    expect(helper).not.toContain('liar');
    // "Same-axis pressure" / "repeated" are activity-structure language.
    const structureWords = ['axis', 'repeated', 'stuck', 'pressure'];
    expect(structureWords.some((w) => helper.includes(w))).toBe(true);
  });

  it('almost_synthesis helperLine describes structural convergence, not correctness', () => {
    const def = GALLERY_SECTION_DEFINITIONS.find((d) => d.id === 'almost_synthesis')!;
    const helper = def.helperLine.toLowerCase();
    expect(helper).not.toContain('correct');
    expect(helper).not.toContain('true');
    expect(helper).not.toContain('proven');
    expect(helper).not.toContain('won');
    const convergenceWords = ['converged', 'summarise', 'summarize', 'narrow', 'agreed'];
    expect(convergenceWords.some((w) => helper.includes(w))).toBe(true);
  });

  it('quiet_beginner_rooms helperLine frames quiet as low-activity, not "boring" / "bad"', () => {
    const def = GALLERY_SECTION_DEFINITIONS.find((d) => d.id === 'quiet_beginner_rooms')!;
    const helper = def.helperLine.toLowerCase();
    expect(helper).not.toContain('boring');
    expect(helper).not.toContain('dead');
    expect(helper).not.toContain('worthless');
    const friendlyWords = ['easy', 'low-activity', 'low activity', 'start'];
    expect(friendlyWords.some((w) => helper.includes(w))).toBe(true);
  });

  it('source_trail helperLine frames evidence dispute as activity, not a verdict on either side', () => {
    const def = GALLERY_SECTION_DEFINITIONS.find((d) => d.id === 'source_trail')!;
    const helper = def.helperLine.toLowerCase();
    expect(helper).not.toContain('proven');
    expect(helper).not.toContain('lying');
    expect(helper).not.toContain('liar');
    expect(helper).toMatch(/source|dispute/);
  });
});

// ──────────────────────────────────────────────────────────────
// Accessibility metadata sanity (chip hint usage)
// ──────────────────────────────────────────────────────────────

describe('GALLERY_SECTION_DEFINITIONS — accessibility metadata', () => {
  it('each definition.label is non-empty (chip primary text)', () => {
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      expect(d.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('each definition.helperLine is non-empty (used as accessibilityHint)', () => {
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      expect(d.helperLine.trim().length).toBeGreaterThan(0);
    }
  });

  it('each definition.emptyCopy is non-empty (shown in EmptyState when lane has no cards)', () => {
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      expect(d.emptyCopy.trim().length).toBeGreaterThan(0);
    }
  });

  it('labels are distinct', () => {
    const labels = GALLERY_SECTION_DEFINITIONS.map((d) => d.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('helperLines are distinct', () => {
    const lines = GALLERY_SECTION_DEFINITIONS.map((d) => d.helperLine);
    expect(new Set(lines).size).toBe(lines.length);
  });
});

// ──────────────────────────────────────────────────────────────
// Stability — frozen structure
// ──────────────────────────────────────────────────────────────

describe('GALLERY_SECTION_DEFINITIONS — frozen structure', () => {
  it('the catalogue array is frozen', () => {
    expect(Object.isFrozen(GALLERY_SECTION_DEFINITIONS)).toBe(true);
  });

  it('each entry is frozen', () => {
    for (const d of GALLERY_SECTION_DEFINITIONS) {
      expect(Object.isFrozen(d)).toBe(true);
    }
  });

  it('SECTION_ORDER is frozen', () => {
    expect(Object.isFrozen(SECTION_ORDER)).toBe(true);
  });
});
