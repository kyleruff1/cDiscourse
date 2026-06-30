/**
 * COV-008 — ObserverActionDockLayout pure-model contract.
 *
 * This test exists because the 2026-06-30 coverage audit
 * (`docs/audits/COVERAGE-AUDIT-2026-06-30.md`, gap #8, MEDIUM) flagged
 * SC-005's four pure derivers — `deriveDockContext`,
 * `resolveObserverDockVariant`, `resolveSheetMaxHeightPx`, and
 * `buildExpandedDockViewModel` — as not having a canonical contract test
 * file named for the module they belong to.
 *
 * Two adjacent suites already exercise these functions:
 *   - `__tests__/sideActionDockCollapsed.test.ts`     (SC-005 breakpoint
 *                                                      + four-way context
 *                                                      + collapsed labels
 *                                                      + sheet cap)
 *   - `__tests__/sideActionDockCategoryGrouping.test.ts` (expanded VM
 *                                                          section order
 *                                                          + showHeader
 *                                                          + title)
 *
 * Both pass today (25 + 14 = 39 cousin assertions). Per the project's
 * "pure-model contract test" load-bearing pattern (see `railActionGrouping`,
 * `argumentScoreModel`, `pointStandingEngine`), each public module also
 * gets a contract file named for the module itself. Gap #8 calls for that
 * canonical anchor — locked at the layout module boundary, so future drift
 * to constants (`DOCK_SIDE_BREAKPOINT`, `SHEET_MAX_VIEWPORT_FRACTION`,
 * `SHEET_MIN_HEIGHT_PX`), to the four-way switch shape, or to the
 * `buildExpandedDockViewModel` output contract is caught by a test that
 * names the module under test.
 *
 * Invariants checked
 *   1. `deriveDockContext` is exhaustive over the 2x2x2 product of
 *      (viewerRole, bubbleActor, hasSelectedNode) — every input row maps
 *      to one of the four DockContext values, with the observer arms
 *      ignoring bubbleActor and the participant arms ignoring
 *      hasSelectedNode (per the doc comment in the source).
 *   2. `resolveObserverDockVariant` is monotonic across the
 *      DOCK_SIDE_BREAKPOINT (720): strictly below → 'sheet'; at or above
 *      → 'side'; non-finite or non-positive → 'side' (web static-export
 *      first-paint posture, per source comment).
 *   3. `resolveSheetMaxHeightPx` is bounded on the standard mobile range:
 *      390 (small phone) and 844 (large phone) both return a non-negative
 *      px value strictly less than the viewport and >= the documented
 *      floor (`SHEET_MIN_HEIGHT_PX`, 168). The 28% formula is enforced
 *      at viewport heights where the formula exceeds the floor.
 *   4. `buildExpandedDockViewModel` partitions its input by category in
 *      `RAIL_ACTION_CATEGORIES` order, never emits an empty section,
 *      sets `showCategoryHeaders` true iff sections.length >= 2, and
 *      derives the title strictly from (viewerRole, bubbleActor) — never
 *      from the action list.
 *   5. The collapsed-label primaries are ban-list-clean: no verdict tokens
 *      ('winner', 'loser', 'liar', 'truth', etc.) appear in primary,
 *      accessibilityLabel, or accessibilityHint for any DockContext.
 *
 * Pure TS. No React, no Supabase, no network. Loaded by jest like every
 * other model unit-test under `__tests__/`.
 *
 * References
 *   - Audit: docs/audits/COVERAGE-AUDIT-2026-06-30.md (Gap #8)
 *   - Tracking issue: COV-008 / #812
 *   - Source: src/features/arguments/ObserverActionDockLayout.ts
 *   - SC-005 design: docs/designs/SC-005.md (collapsed-by-default dock)
 *   - Reference PR (COV-001): #815 (submit-argument soft-rollback contract)
 */
import {
  DOCK_SIDE_BREAKPOINT,
  SHEET_MAX_VIEWPORT_FRACTION,
  SHEET_MIN_HEIGHT_PX,
  buildCollapsedDockLabel,
  buildExpandedDockViewModel,
  deriveDockContext,
  resolveObserverDockVariant,
  resolveSheetMaxHeightPx,
  type DockContext,
  type DockLayoutVariant,
} from '../src/features/arguments/ObserverActionDockLayout';
import {
  RAIL_ACTION_CATEGORIES,
  RAIL_ACTION_CATEGORY_LABEL,
  type RailActionWithCategory,
  type RailBubbleActor,
  type RailViewerRole,
} from '../src/features/arguments/railActionCategories';

// ── Fixture: synthetic action list spanning multiple categories ────
//
// The view-model behaviour is independent of where the actions came
// from (Stage 6.4 `getRailActions` or any future derivation). We build
// a deterministic synthetic list here so the test pins the projection
// shape, not the rail's action-set policy. Cousin tests
// (`sideActionDockCategoryGrouping.test.ts`) already pin the real
// `getRailActions` outputs; this file deliberately does NOT depend on
// `ArgumentSideActionRail` so the layout module's contract is
// verifiable in isolation.
const A_WATCH: RailActionWithCategory = {
  code: 'watch',
  label: 'Watch',
  helper: 'Follow this conversation.',
  category: 'watch_observe',
};
const A_JOIN_AFF: RailActionWithCategory = {
  code: 'join_aff',
  label: 'Join For',
  helper: 'Take the affirmative side.',
  category: 'join_side',
};
const A_REPLY: RailActionWithCategory = {
  code: 'reply',
  label: 'Reply',
  helper: 'Respond to this message.',
  category: 'reply',
};
const A_SHARE: RailActionWithCategory = {
  code: 'share',
  label: 'Share',
  helper: 'Copy a link to this conversation.',
  category: 'share',
};

// ─── 1. deriveDockContext — exhaustive 2x2x2 truth table ─────────────

describe('COV-008 deriveDockContext — exhaustive four-way derivation', () => {
  // The four valid bubbleActor values for observer / participant arms.
  // Observer arm ignores bubbleActor; participant arm uses 'self' vs
  // anything-else to split own / other.
  const BUBBLE_ACTORS: RailBubbleActor[] = ['self', 'other', 'bot', 'admin', 'unknown'];

  it('observer + no selected node → observer_no_node (for EVERY bubbleActor)', () => {
    // The source comment is explicit: an observer ALWAYS gets the
    // observer action set regardless of bubbleActor. Only the
    // collapsed LABEL changes between observer_no_node and observer_node.
    for (const actor of BUBBLE_ACTORS) {
      expect(deriveDockContext('observer', actor, false)).toBe('observer_no_node');
    }
  });

  it('observer + selected node → observer_node (for EVERY bubbleActor)', () => {
    for (const actor of BUBBLE_ACTORS) {
      expect(deriveDockContext('observer', actor, true)).toBe('observer_node');
    }
  });

  it('participant on own bubble → participant_own (regardless of node selection)', () => {
    // The participant arm ignores hasSelectedNode — the actor identity
    // drives the split.
    expect(deriveDockContext('participant', 'self', false)).toBe('participant_own');
    expect(deriveDockContext('participant', 'self', true)).toBe('participant_own');
  });

  it('participant on a non-self bubble → participant_other (for every non-self actor)', () => {
    for (const actor of BUBBLE_ACTORS) {
      if (actor === 'self') continue;
      expect(deriveDockContext('participant', actor, false)).toBe('participant_other');
      expect(deriveDockContext('participant', actor, true)).toBe('participant_other');
    }
  });

  it('the output union is EXACTLY four values across the full input space', () => {
    // Cross-product enumeration — every (role, actor, hasNode) row
    // lands in {observer_no_node, observer_node, participant_own,
    // participant_other} and nothing else.
    const roles: RailViewerRole[] = ['observer', 'participant'];
    const observed = new Set<DockContext>();
    for (const role of roles) {
      for (const actor of BUBBLE_ACTORS) {
        for (const hasNode of [true, false]) {
          observed.add(deriveDockContext(role, actor, hasNode));
        }
      }
    }
    expect(observed).toEqual(
      new Set<DockContext>([
        'observer_no_node',
        'observer_node',
        'participant_own',
        'participant_other',
      ]),
    );
  });
});

// ─── 2. resolveObserverDockVariant — breakpoint monotonicity ─────────

describe('COV-008 resolveObserverDockVariant — breakpoint monotonicity', () => {
  // The source defines DOCK_SIDE_BREAKPOINT = 720. (The audit text
  // mentioned "768"; that was a typo — the constant under test is 720.
  // This test is anchored to the exported constant so a future shift
  // surfaces here.)
  it('exports DOCK_SIDE_BREAKPOINT as a finite positive number', () => {
    expect(Number.isFinite(DOCK_SIDE_BREAKPOINT)).toBe(true);
    expect(DOCK_SIDE_BREAKPOINT).toBeGreaterThan(0);
  });

  it('width strictly below the breakpoint → "sheet"', () => {
    expect(resolveObserverDockVariant(DOCK_SIDE_BREAKPOINT - 1)).toBe('sheet');
    expect(resolveObserverDockVariant(DOCK_SIDE_BREAKPOINT - 100)).toBe('sheet');
    expect(resolveObserverDockVariant(360)).toBe('sheet');
    expect(resolveObserverDockVariant(1)).toBe('sheet');
  });

  it('width at or above the breakpoint → "side"', () => {
    expect(resolveObserverDockVariant(DOCK_SIDE_BREAKPOINT)).toBe('side');
    expect(resolveObserverDockVariant(DOCK_SIDE_BREAKPOINT + 1)).toBe('side');
    expect(resolveObserverDockVariant(DOCK_SIDE_BREAKPOINT + 304)).toBe('side');
    expect(resolveObserverDockVariant(1920)).toBe('side');
  });

  it('non-finite or non-positive width → "side" (web static-export first paint posture)', () => {
    // The polished layout is the safer first paint, matching
    // resolveHeaderBreakpoint's non-positive = wide rule.
    expect(resolveObserverDockVariant(0)).toBe('side');
    expect(resolveObserverDockVariant(-1)).toBe('side');
    expect(resolveObserverDockVariant(-9999)).toBe('side');
    expect(resolveObserverDockVariant(Number.NaN)).toBe('side');
    expect(resolveObserverDockVariant(Number.POSITIVE_INFINITY)).toBe('side');
    expect(resolveObserverDockVariant(Number.NEGATIVE_INFINITY)).toBe('side');
  });

  it('the output union is EXACTLY {sheet, side} across a representative sweep', () => {
    const observed = new Set<DockLayoutVariant>();
    for (const w of [1, 100, 360, 719, 720, 721, 1024, 1920, 3840]) {
      observed.add(resolveObserverDockVariant(w));
    }
    expect(observed).toEqual(new Set<DockLayoutVariant>(['sheet', 'side']));
  });

  it('is monotonic across the breakpoint — once "side" wins it never returns "sheet" at larger widths', () => {
    // Probe a sorted sweep; the first 'side' index marks the
    // transition, and no subsequent index may return 'sheet'.
    const widths = [1, 50, 200, 360, 600, 719, 720, 800, 1024, 2048];
    const out = widths.map((w) => resolveObserverDockVariant(w));
    const firstSide = out.indexOf('side');
    expect(firstSide).toBeGreaterThanOrEqual(0);
    for (let i = firstSide; i < out.length; i++) {
      expect(out[i]).toBe('side');
    }
  });
});

// ─── 3. resolveSheetMaxHeightPx — bounded on the mobile range ────────

describe('COV-008 resolveSheetMaxHeightPx — bounded on 390/844 and across the mobile range', () => {
  it('exports a SHEET_MIN_HEIGHT_PX floor and a SHEET_MAX_VIEWPORT_FRACTION of 0.28', () => {
    expect(SHEET_MIN_HEIGHT_PX).toBeGreaterThan(0);
    expect(SHEET_MAX_VIEWPORT_FRACTION).toBeCloseTo(0.28, 5);
  });

  it('390px viewport (small phone, e.g. iPhone SE width-equivalent height region) is bounded and floored', () => {
    // 390 * 0.28 = 109.2 → round = 109 → below floor 168 → clamps to
    // 168. The cap must still stay strictly below the viewport so the
    // sheet leaves a visible board slice.
    const h = resolveSheetMaxHeightPx(390);
    expect(h).toBeGreaterThanOrEqual(SHEET_MIN_HEIGHT_PX);
    expect(h).toBeLessThan(390);
    // Because 28% < floor, the floor wins exactly.
    expect(h).toBe(SHEET_MIN_HEIGHT_PX);
  });

  it('844px viewport (large phone, e.g. iPhone 14 Pro Max height region) is the rounded 28% formula', () => {
    // 844 * 0.28 = 236.32 → round = 236, comfortably above floor 168
    // and far below viewport. The 28% formula wins.
    const h = resolveSheetMaxHeightPx(844);
    expect(h).toBe(Math.round(844 * SHEET_MAX_VIEWPORT_FRACTION));
    expect(h).toBeGreaterThan(SHEET_MIN_HEIGHT_PX);
    expect(h).toBeLessThan(844);
    // Tight band: 236 ± 1 (rounding tolerance only).
    expect(h).toBeGreaterThanOrEqual(235);
    expect(h).toBeLessThanOrEqual(237);
  });

  it('never returns a value >= the viewport height across the mobile range (never full-screen)', () => {
    // Sweep covers very short to very tall mobile viewports; for every
    // one of them, the sheet leaves a visible board slice.
    for (const h of [120, 150, 200, 300, 400, 568, 667, 736, 812, 844, 932, 1024, 1366]) {
      const sheet = resolveSheetMaxHeightPx(h);
      expect(sheet).toBeLessThan(h);
      expect(sheet).toBeGreaterThan(0);
    }
  });

  it('returns the floor for non-positive / non-finite heights (no NaN, no negative)', () => {
    expect(resolveSheetMaxHeightPx(0)).toBe(SHEET_MIN_HEIGHT_PX);
    expect(resolveSheetMaxHeightPx(-1)).toBe(SHEET_MIN_HEIGHT_PX);
    expect(resolveSheetMaxHeightPx(-9999)).toBe(SHEET_MIN_HEIGHT_PX);
    expect(resolveSheetMaxHeightPx(Number.NaN)).toBe(SHEET_MIN_HEIGHT_PX);
    expect(resolveSheetMaxHeightPx(Number.POSITIVE_INFINITY)).toBe(SHEET_MIN_HEIGHT_PX);
    expect(resolveSheetMaxHeightPx(Number.NEGATIVE_INFINITY)).toBe(SHEET_MIN_HEIGHT_PX);
  });

  it('stays strictly below even a viewport SHORTER than the floor (cap leaves a visible slice)', () => {
    // 150 < 168 floor — the source clamps to a sub-viewport value so
    // the sheet never fills the screen.
    const h = resolveSheetMaxHeightPx(150);
    expect(h).toBeLessThan(150);
    expect(h).toBeGreaterThan(0);
  });

  it('above the floor crossover, the formula equals round(height * 0.28)', () => {
    // Floor crossover = ceil(168 / 0.28) = 600. At and above 600, the
    // formula wins exactly. Spot-check a handful.
    for (const h of [600, 700, 800, 900, 1000, 1200]) {
      expect(resolveSheetMaxHeightPx(h)).toBe(Math.round(h * SHEET_MAX_VIEWPORT_FRACTION));
    }
  });
});

// ─── 4. buildExpandedDockViewModel — category grouping + showHeader ──

describe('COV-008 buildExpandedDockViewModel — category grouping + showHeader behaviour', () => {
  it('groups a multi-category action list in RAIL_ACTION_CATEGORIES order', () => {
    // Feed an intentionally OUT-OF-ORDER action list spanning four
    // distinct categories: share, watch_observe, reply, join_side.
    // The view model must reorder to the canonical category sequence.
    const actions: RailActionWithCategory[] = [A_SHARE, A_WATCH, A_REPLY, A_JOIN_AFF];
    const vm = buildExpandedDockViewModel(actions, 'observer', 'other');
    const cats = vm.sections.map((s) => s.category);
    expect(cats).toEqual(['watch_observe', 'join_side', 'reply', 'share']);
    // The order strictly respects RAIL_ACTION_CATEGORIES.
    const indices = cats.map((c) => RAIL_ACTION_CATEGORIES.indexOf(c));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });

  it('every section header label equals RAIL_ACTION_CATEGORY_LABEL[category]', () => {
    const vm = buildExpandedDockViewModel(
      [A_WATCH, A_JOIN_AFF, A_REPLY, A_SHARE],
      'observer',
      'other',
    );
    for (const section of vm.sections) {
      expect(section.headerLabel).toBe(RAIL_ACTION_CATEGORY_LABEL[section.category]);
    }
  });

  it('NEVER emits an empty section (categories with no matching actions are skipped)', () => {
    // Only watch_observe + share; reply / join / evidence / branch /
    // review_flag categories must be skipped, not emitted as empty.
    const vm = buildExpandedDockViewModel([A_WATCH, A_SHARE], 'observer', 'other');
    expect(vm.sections.map((s) => s.category)).toEqual(['watch_observe', 'share']);
    for (const section of vm.sections) {
      expect(section.actions.length).toBeGreaterThan(0);
    }
  });

  it('section actions are a partition of the input (no duplicates, no drops)', () => {
    const input: RailActionWithCategory[] = [A_WATCH, A_JOIN_AFF, A_REPLY, A_SHARE];
    const vm = buildExpandedDockViewModel(input, 'observer', 'other');
    const flat = vm.sections.flatMap((s) => s.actions.map((a) => a.code));
    expect(new Set(flat).size).toBe(flat.length);
    expect(new Set(flat)).toEqual(new Set(input.map((a) => a.code)));
  });

  it('showCategoryHeaders is TRUE when >= 2 sections are non-empty', () => {
    // Two distinct categories — header banding helps the reader.
    const vm = buildExpandedDockViewModel([A_WATCH, A_SHARE], 'observer', 'other');
    expect(vm.sections.length).toBe(2);
    expect(vm.showCategoryHeaders).toBe(true);
  });

  it('showCategoryHeaders is FALSE when exactly 1 section is non-empty', () => {
    // Single-category render reads more cleanly without a header.
    const vm = buildExpandedDockViewModel([A_REPLY], 'participant', 'other');
    expect(vm.sections.length).toBe(1);
    expect(vm.showCategoryHeaders).toBe(false);
  });

  it('showCategoryHeaders is FALSE for an empty action list (no sections)', () => {
    const vm = buildExpandedDockViewModel([], 'participant', 'self');
    expect(vm.sections).toEqual([]);
    expect(vm.showCategoryHeaders).toBe(false);
  });

  it('showCategoryHeaders flips at the 2-section boundary (1 → 2 transition)', () => {
    // Boundary check: one action → false; add a second category → true.
    const one = buildExpandedDockViewModel([A_WATCH], 'observer', 'other');
    const two = buildExpandedDockViewModel([A_WATCH, A_SHARE], 'observer', 'other');
    expect(one.showCategoryHeaders).toBe(false);
    expect(two.showCategoryHeaders).toBe(true);
  });

  it('multiple actions in the SAME category still count as ONE non-empty section', () => {
    // Two actions both in watch_observe → one section, headers off.
    const extraWatch: RailActionWithCategory = { ...A_WATCH, code: 'open_timeline' };
    const vm = buildExpandedDockViewModel([A_WATCH, extraWatch], 'observer', 'other');
    expect(vm.sections.length).toBe(1);
    expect(vm.sections[0].actions.length).toBe(2);
    expect(vm.showCategoryHeaders).toBe(false);
  });

  it('title is derived from (viewerRole, bubbleActor) — observer → "Observer actions"', () => {
    expect(
      buildExpandedDockViewModel([A_WATCH], 'observer', 'other').title,
    ).toBe('Observer actions');
    // Observer-arm ignores bubbleActor — same title for any actor.
    expect(
      buildExpandedDockViewModel([A_WATCH], 'observer', 'self').title,
    ).toBe('Observer actions');
  });

  it('title is derived from (viewerRole, bubbleActor) — participant on own → "On your message"', () => {
    expect(
      buildExpandedDockViewModel([], 'participant', 'self').title,
    ).toBe('On your message');
  });

  it('title is derived from (viewerRole, bubbleActor) — participant on other → "On this message"', () => {
    expect(
      buildExpandedDockViewModel([A_REPLY], 'participant', 'other').title,
    ).toBe('On this message');
    // The participant-other arm covers every non-self actor.
    expect(
      buildExpandedDockViewModel([A_REPLY], 'participant', 'bot').title,
    ).toBe('On this message');
  });

  it('title is INDEPENDENT of the action list (same role/actor → same title)', () => {
    // Critical contract: the title must NEVER depend on which actions
    // are present. A regression that derives the title from the action
    // set would surface here.
    const emptyVm = buildExpandedDockViewModel([], 'observer', 'other');
    const oneVm = buildExpandedDockViewModel([A_WATCH], 'observer', 'other');
    const fourVm = buildExpandedDockViewModel(
      [A_WATCH, A_JOIN_AFF, A_REPLY, A_SHARE],
      'observer',
      'other',
    );
    expect(emptyVm.title).toBe(oneVm.title);
    expect(oneVm.title).toBe(fourVm.title);
  });
});

// ─── 5. Doctrine: collapsed labels are ban-list-clean ────────────────

describe('COV-008 collapsed label copy — doctrine ban-list scan', () => {
  // Universal CDiscourse doctrine: no verdict tokens in any user-facing
  // string. The cousin file `sideActionDockNoVerdictCopy.test.ts` covers
  // the rail action labels; this one covers the four collapsed-dock
  // strings derived inside ObserverActionDockLayout.
  const VERDICTS =
    /\b(winner|loser|truth|liar|dishonest|extremist|propagandist|stupid|idiot|correct|wrong|true|false)\b/i;
  const CONTEXTS: DockContext[] = [
    'observer_no_node',
    'observer_node',
    'participant_own',
    'participant_other',
  ];

  it('every collapsed primary string is free of verdict tokens', () => {
    for (const ctx of CONTEXTS) {
      expect(buildCollapsedDockLabel(ctx).primary).not.toMatch(VERDICTS);
    }
  });

  it('every accessibilityLabel and accessibilityHint is free of verdict tokens', () => {
    for (const ctx of CONTEXTS) {
      const label = buildCollapsedDockLabel(ctx);
      expect(label.accessibilityLabel).not.toMatch(VERDICTS);
      expect(label.accessibilityHint).not.toMatch(VERDICTS);
    }
  });

  it('every collapsed primary string is non-empty and contains no snake_case leak', () => {
    for (const ctx of CONTEXTS) {
      const label = buildCollapsedDockLabel(ctx);
      expect(label.primary.length).toBeGreaterThan(0);
      // A_b style snake_case leak (internal validation codes must NEVER
      // appear in UI) — plain English only.
      expect(label.primary).not.toMatch(/[a-z]_[a-z]/);
    }
  });
});
