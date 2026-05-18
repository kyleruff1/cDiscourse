/**
 * SC-001 — Side action rail grouping + contract lock.
 *
 * Stage 6.4 already shipped the observer-first collapsed rail and the
 * three action sets (observer, participant-other, participant-self).
 * This test suite locks the contract — including the new SC-001
 * grouping taxonomy (Watch/Observe · Join side · Reply · Evidence ·
 * Branch · Review/flag · Share) — so future PRs can't silently regress
 * any of the acceptance criteria.
 */
import fs from 'fs';
import path from 'path';
import {
  getRailActions,
  groupRailActionsByCategory,
  RAIL_ACTION_CATEGORIES,
  RAIL_ACTION_CATEGORY_LABEL,
  type RailActionCategory,
} from '../src/features/arguments/ArgumentSideActionRail';

// ── Category taxonomy ────────────────────────────────────────────

describe('SC-001 rail action categories', () => {
  it('has exactly 7 categories matching the issue body', () => {
    expect(RAIL_ACTION_CATEGORIES).toHaveLength(7);
    expect(new Set(RAIL_ACTION_CATEGORIES)).toEqual(new Set<RailActionCategory>([
      'watch_observe', 'join_side', 'reply', 'evidence', 'branch', 'review_flag', 'share',
    ]));
  });

  it('category labels are plain language (no snake_case, no verdict tokens)', () => {
    const verdicts = /\b(winner|loser|truth|liar|dishonest|extremist|propagandist)\b/i;
    for (const cat of RAIL_ACTION_CATEGORIES) {
      const label = RAIL_ACTION_CATEGORY_LABEL[cat];
      expect(label).toBeTruthy();
      expect(label).not.toMatch(/[a-z]_[a-z]/);
      expect(label).not.toMatch(verdicts);
    }
  });
});

// ── Every action carries a category ──────────────────────────────

describe('SC-001 every rail action has a category', () => {
  it('observer actions all have a category', () => {
    for (const a of getRailActions('observer', 'other')) {
      expect(a.category).toBeTruthy();
      expect(RAIL_ACTION_CATEGORIES).toContain(a.category);
    }
  });
  it('participant-on-other actions all have a category', () => {
    for (const a of getRailActions('participant', 'other')) {
      expect(a.category).toBeTruthy();
      expect(RAIL_ACTION_CATEGORIES).toContain(a.category);
    }
  });
  it('participant-on-self actions all have a category', () => {
    for (const a of getRailActions('participant', 'self')) {
      expect(a.category).toBeTruthy();
      expect(RAIL_ACTION_CATEGORIES).toContain(a.category);
    }
  });
});

// ── Stage 6.4 contract still holds ───────────────────────────────

describe('SC-001 Stage 6.4 contract — action codes per viewer/actor', () => {
  it('observer set: watch / join_aff / join_neg / ask_source / open_timeline / share', () => {
    const codes = getRailActions('observer', 'other').map((a) => a.code);
    expect(codes).toEqual(['watch', 'join_aff', 'join_neg', 'ask_source', 'open_timeline', 'share']);
  });

  it('participant on other-bubble: reply / disagree / ask_source / ask_quote / split_branch / flag / qualifiers', () => {
    const codes = getRailActions('participant', 'other').map((a) => a.code);
    expect(codes).toEqual(['reply', 'disagree', 'ask_source', 'ask_quote', 'split_branch', 'flag', 'qualifiers']);
  });

  it('participant on OWN bubble: only qualifiers + request_deletion (no edit/disagree/flag/score)', () => {
    const codes = getRailActions('participant', 'self').map((a) => a.code);
    expect(codes).toEqual(['qualifiers', 'request_deletion']);
    for (const forbidden of ['reply', 'disagree', 'flag', 'ask_source', 'ask_quote', 'split_branch']) {
      expect(codes).not.toContain(forbidden);
    }
  });
});

// ── groupRailActionsByCategory ───────────────────────────────────

describe('SC-001 groupRailActionsByCategory', () => {
  it('produces ordered, non-empty groups for the observer set', () => {
    const groups = groupRailActionsByCategory(getRailActions('observer', 'other'));
    // All groups non-empty
    for (const g of groups) {
      expect(g.actions.length).toBeGreaterThan(0);
      expect(g.label).toBeTruthy();
    }
    // Order respects RAIL_ACTION_CATEGORIES order
    const seenCategories = groups.map((g) => g.category);
    const indices = seenCategories.map((c) => RAIL_ACTION_CATEGORIES.indexOf(c));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });

  it('observer set covers at least 4 of the 7 categories (watch_observe, join_side, evidence, share)', () => {
    const groups = groupRailActionsByCategory(getRailActions('observer', 'other'));
    const cats = new Set(groups.map((g) => g.category));
    for (const required of ['watch_observe', 'join_side', 'evidence', 'share'] as const) {
      expect(cats).toContain(required);
    }
  });

  it('participant-on-other covers reply / evidence / branch / review_flag', () => {
    const groups = groupRailActionsByCategory(getRailActions('participant', 'other'));
    const cats = new Set(groups.map((g) => g.category));
    for (const required of ['reply', 'evidence', 'branch', 'review_flag'] as const) {
      expect(cats).toContain(required);
    }
  });

  it('participant-on-self collapses to review_flag only (own bubble safety)', () => {
    const groups = groupRailActionsByCategory(getRailActions('participant', 'self'));
    expect(groups.map((g) => g.category)).toEqual(['review_flag']);
  });

  it('skips empty groups', () => {
    const groups = groupRailActionsByCategory([]);
    expect(groups).toEqual([]);
  });

  it('actions never appear in more than one group', () => {
    const groups = groupRailActionsByCategory(getRailActions('observer', 'other'));
    const allCodes: string[] = [];
    for (const g of groups) for (const a of g.actions) allCodes.push(a.code);
    expect(new Set(allCodes).size).toBe(allCodes.length);
  });
});

// ── Plain-language scan on labels + helpers ──────────────────────

describe('SC-001 rail copy is plain language', () => {
  const verdicts = /\b(winner|loser|truth|liar|dishonest|extremist|propagandist|stupid|idiot)\b/i;

  function scanAllRails() {
    return [
      ...getRailActions('observer', 'other'),
      ...getRailActions('participant', 'other'),
      ...getRailActions('participant', 'self'),
    ];
  }

  it('no rail action label contains a verdict token', () => {
    for (const a of scanAllRails()) {
      expect(a.label).not.toMatch(verdicts);
    }
  });

  it('no rail action helper contains a verdict token', () => {
    for (const a of scanAllRails()) {
      expect(a.helper).not.toMatch(verdicts);
    }
  });

  it('no category label contains a verdict token', () => {
    for (const cat of RAIL_ACTION_CATEGORIES) {
      expect(RAIL_ACTION_CATEGORY_LABEL[cat]).not.toMatch(verdicts);
    }
  });
});

// ── Collapsed-by-default observer rail ───────────────────────────

describe('SC-001 collapsed-by-default observer rail', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src/features/arguments/ArgumentSideActionRail.tsx'),
    'utf8',
  );

  it('rail initialises collapsed for observer viewers', () => {
    // The component picks `defaultCollapsed ?? (viewerRole === "observer")`.
    expect(src).toMatch(/defaultCollapsed\s*\?\?\s*\(viewerRole\s*===\s*['"]observer['"]\)/);
  });

  it('rail uses useState for collapse, not a route transition', () => {
    expect(src).toMatch(/useState\(initialCollapsed\)/);
    // Reaffirm TL-003: no navigation primitives in this file.
    expect(src).not.toMatch(/from\s+['"]@react-navigation\//);
    expect(src).not.toMatch(/from\s+['"]expo-router['"]/);
    expect(src).not.toMatch(/\bnavigation\.navigate\s*\(/);
  });
});
