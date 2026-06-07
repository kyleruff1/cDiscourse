/**
 * GAL-001 — ConversationGalleryScreen lane filter contract tests.
 *
 * Follows the repo's static-source-scan convention (see
 * argumentReplySidecar.test.tsx / appHeaderTagline.test.tsx). The pure
 * model behavior is covered in `galleryLaneDerivation.test.ts` and
 * `gallerySectionCopy.test.ts`. This file enforces the screen-level
 * contract that GAL-001 specifies:
 *
 *   1. The lane chip row exists with one chip per lane (plus an "All
 *      lanes" chip) and uses the `lane-chip-` testID prefix.
 *   2. The bucket chip row has been removed (no `bucket-chip-` testIDs).
 *   3. `BUCKET_DEFINITIONS` is no longer referenced by the screen.
 *   4. The screen uses single-select filter state (`activeLane`).
 *   5. Lane chips set `accessibilityState.selected` and carry an
 *      `accessibilityHint` (so screen readers announce the helperLine
 *      before activation).
 *   6. Chips have `hitSlop` (>= 44px effective tap target per
 *      accessibility-targets §"Minimum bar").
 *   7. The screen does NOT import any AI / Supabase / network module.
 *   8. Lane sections render via `groupGalleryCardsBySection` in
 *      "all lanes" mode.
 *   9. The screen renders a `LaneSectionHeader` with both label and
 *      helperLine when a lane filter is active.
 *  10. The screen retains the observer-default entry contract
 *      (sideToUse = myParticipantSide || 'observer').
 */
import fs from 'fs';
import path from 'path';

const SCREEN_PATH = path.join(
  process.cwd(),
  'src',
  'features',
  'debates',
  'ConversationGalleryScreen.tsx',
);

function readSource(): string {
  return fs.readFileSync(SCREEN_PATH, 'utf8');
}

// ──────────────────────────────────────────────────────────────
// 1. Lane chip row exists; one chip per lane + "All lanes"
// ──────────────────────────────────────────────────────────────

describe('ConversationGalleryScreen — lane chip row', () => {
  it('declares a lane-chip-all chip for the "All lanes" reset', () => {
    expect(readSource()).toMatch(/testID="lane-chip-all"/);
  });

  it('renders one chip per lane id via GALLERY_SECTION_DEFINITIONS.map', () => {
    const src = readSource();
    expect(src).toMatch(/GALLERY_SECTION_DEFINITIONS\.map/);
    expect(src).toMatch(/testID={`lane-chip-\$\{def\.id\}`}/);
  });

  it('binds the chip onPress to setActiveLane', () => {
    expect(readSource()).toMatch(/setActiveLane\(/);
  });

  it('declares a LaneChip component (replaces the Stage 6.3 BucketChip)', () => {
    expect(readSource()).toMatch(/function LaneChip\(/);
  });

  it('declares a LaneSectionHeader component', () => {
    expect(readSource()).toMatch(/function LaneSectionHeader\(/);
  });
});

// ──────────────────────────────────────────────────────────────
// 2. Bucket chip row removed
// ──────────────────────────────────────────────────────────────

describe('ConversationGalleryScreen — bucket chip row removed', () => {
  it('does not declare a BucketChip component', () => {
    expect(readSource()).not.toMatch(/function BucketChip\(/);
  });

  it('does not emit any bucket-chip- testID', () => {
    expect(readSource()).not.toMatch(/testID=["']bucket-chip-/);
    expect(readSource()).not.toMatch(/testID=\{`bucket-chip-/);
  });

  it('does not import BUCKET_DEFINITIONS', () => {
    expect(readSource()).not.toMatch(/BUCKET_DEFINITIONS/);
  });

  it('does not maintain an activeBucket useState', () => {
    expect(readSource()).not.toMatch(/setActiveBucket/);
    expect(readSource()).not.toMatch(/activeBucket/);
  });

  it('does not declare the legacy emptyTitleForBucket / emptyCopyForBucket helpers', () => {
    expect(readSource()).not.toMatch(/emptyTitleForBucket/);
    expect(readSource()).not.toMatch(/emptyCopyForBucket/);
  });
});

// ──────────────────────────────────────────────────────────────
// 3. Single-select filter state
// ──────────────────────────────────────────────────────────────

describe('ConversationGalleryScreen — single-select filter state', () => {
  it('maintains a single activeLane useState with a typed union', () => {
    const src = readSource();
    expect(src).toMatch(/useState<ConversationGallerySection \| 'all'>/);
    expect(src).toMatch(/'all'/);
  });

  it('resets pageIndex to 0 on lane change', () => {
    // After setActiveLane(...) the screen calls setPageIndex(0).
    expect(readSource()).toMatch(/setPageIndex\(0\)/);
  });

  it('toggles lane back to "all" when the same chip is tapped', () => {
    // NAV-START-ARGUMENT-001 Slice B — the active lane became a
    // controlled/uncontrolled hybrid (the shell can drive it from the
    // global header), so `setActiveLane` is now a plain value setter rather
    // than a React updater. The toggle-back-to-'all' BEHAVIOR is unchanged;
    // the expression reads the resolved `activeLane` instead of `prev`.
    expect(readSource()).toMatch(/activeLane === def\.id \? 'all' : def\.id/);
  });
});

// ──────────────────────────────────────────────────────────────
// 4. Lane chip accessibility contract
// ──────────────────────────────────────────────────────────────

describe('ConversationGalleryScreen — lane chip accessibility', () => {
  it('lane chips declare accessibilityRole="button"', () => {
    expect(readSource()).toMatch(/accessibilityRole="button"/);
  });

  it('lane chips declare an accessibilityState reflecting active', () => {
    expect(readSource()).toMatch(/accessibilityState=\{\{ selected: active \}\}/);
  });

  it('lane chips declare an accessibilityHint (the lane helperLine)', () => {
    expect(readSource()).toMatch(/accessibilityHint=\{helperLine\}/);
  });

  it('lane chips declare a hitSlop sufficient to reach 44px effective tap target', () => {
    // Visual chip height ~32 + hitSlop top/bottom 8 each = ~48 effective.
    expect(readSource()).toMatch(/hitSlop=\{\{ top: 8, bottom: 8, left: 6, right: 6 \}\}/);
  });

  it('LaneChip accessibilityLabel uses plain-language "Filter by <lane>" or "Show all lanes"', () => {
    const src = readSource();
    expect(src).toMatch(/accessibilityLabel="Show all lanes"/);
    expect(src).toMatch(/accessibilityLabel=\{`Filter by \$\{def\.label\}`\}/);
  });
});

// ──────────────────────────────────────────────────────────────
// 5. Lane section rendering
// ──────────────────────────────────────────────────────────────

describe('ConversationGalleryScreen — lane section rendering', () => {
  it('uses groupGalleryCardsBySection when activeLane is "all"', () => {
    expect(readSource()).toMatch(/groupGalleryCardsBySection\(paged\.page\)/);
  });

  it('uses classifyCardToSection in the filter predicate when a single lane is active', () => {
    expect(readSource()).toMatch(/classifyCardToSection\(c\)/);
  });

  it('renders a LaneSectionHeader per non-empty lane with a stable testID', () => {
    expect(readSource()).toMatch(/gallery-lane-header-/);
    expect(readSource()).toMatch(/gallery-lane-section-/);
  });

  it('LaneSectionHeader renders both label and helperLine', () => {
    const src = readSource();
    expect(src).toMatch(/<Text style=\{styles\.laneHeaderLabel\}>\{def\.label\}<\/Text>/);
    expect(src).toMatch(/<Text style=\{styles\.laneHeaderHelper\}/);
  });
});

// ──────────────────────────────────────────────────────────────
// 6. Observer-default entry preserved (GAL-002 / Stage 6.4 contract)
// ──────────────────────────────────────────────────────────────

describe('ConversationGalleryScreen — observer-default entry preserved', () => {
  it('defaults sideToUse to "observer" when the user has no joined side', () => {
    expect(readSource()).toMatch(/debate\.myParticipantSide \|\| 'observer'/);
  });

  it('still calls deriveGalleryEntryHint when opening a card', () => {
    expect(readSource()).toMatch(/deriveGalleryEntryHint\(card\)/);
  });
});

// ──────────────────────────────────────────────────────────────
// 7. No AI / Supabase / network imports
// ──────────────────────────────────────────────────────────────

describe('ConversationGalleryScreen — boundary enforcement', () => {
  const FORBIDDEN_IMPORTS: ReadonlyArray<RegExp> = [
    /from\s+['"]@supabase\/supabase-js['"]/,
    /from\s+['"]@anthropic-ai\/sdk['"]/,
    /from\s+['"]anthropic['"]/,
    /from\s+['"]xai['"]/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bDate\.now\s*\(/,
    /\bMath\.random\s*\(/,
    /\bconsole\.log\b/,
    /SUPABASE_SERVICE_ROLE_KEY/,
    /ANTHROPIC_API_KEY/,
  ];

  it.each(FORBIDDEN_IMPORTS)('does not contain pattern %s', (pattern) => {
    expect(readSource()).not.toMatch(pattern);
  });
});

// ──────────────────────────────────────────────────────────────
// 8. Plain-language guard on screen-authored strings
// ──────────────────────────────────────────────────────────────

describe('ConversationGalleryScreen — plain-language guard', () => {
  const BANNED_USER_STRINGS: ReadonlyArray<string> = Object.freeze([
    'winner', 'loser', 'verdict', 'popularity', 'trending', 'viral',
    'liar', 'dishonest', 'bad faith', 'manipulative', 'extremist',
    'propagandist', 'astroturfer', 'troll', 'proven', 'disproven',
  ]);

  it.each(BANNED_USER_STRINGS)('does not author the user-facing string "%s"', (token) => {
    // Tokens are also banned inside the legacy BUCKET_HEADLINE map (still
    // referenced by the card view; that map's strings are Stage 6.3 copy
    // and remain doctrine-clean).
    expect(readSource().toLowerCase()).not.toContain(token.toLowerCase());
  });
});

// ──────────────────────────────────────────────────────────────
// 9. Render mode coverage — the screen acknowledges both modes
// ──────────────────────────────────────────────────────────────

describe('ConversationGalleryScreen — render mode coverage', () => {
  it('has a branch for the single-lane filter mode (activeLane !== "all")', () => {
    expect(readSource()).toMatch(/activeLane !== 'all'/);
  });

  it('has a branch for the all-lanes mode', () => {
    expect(readSource()).toMatch(/activeLane === 'all'|activeLane !== 'all' \? \(/);
  });

  it('exposes a stable testID for the lane filter chip row container', () => {
    expect(readSource()).toMatch(/accessibilityLabel="Play lane filters"/);
  });
});

// ──────────────────────────────────────────────────────────────
// 10. Type-level guards — the screen still exports ConversationGalleryScreen
// ──────────────────────────────────────────────────────────────

describe('ConversationGalleryScreen — exports', () => {
  it('exports ConversationGalleryScreen', () => {
    expect(readSource()).toMatch(/export function ConversationGalleryScreen\(/);
  });

  it('imports the new GAL-001 model symbols', () => {
    const src = readSource();
    expect(src).toMatch(/classifyCardToSection/);
    expect(src).toMatch(/GALLERY_SECTION_DEFINITIONS/);
    expect(src).toMatch(/groupGalleryCardsBySection/);
  });
});
