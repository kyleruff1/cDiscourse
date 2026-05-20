/**
 * SC-005 — Category grouping + empty-category suppression.
 *
 * Covers `buildExpandedDockViewModel`: ordered sections, the
 * `showCategoryHeaders` rule (>= 2 non-empty sections), the per-section
 * header label, and the guarantee no empty section is ever emitted.
 */
import {
  buildExpandedDockViewModel,
} from '../src/features/arguments/ObserverActionDockLayout';
import {
  getRailActions,
  groupRailActionsByCategory,
  RAIL_ACTION_CATEGORIES,
  RAIL_ACTION_CATEGORY_LABEL,
} from '../src/features/arguments/ArgumentSideActionRail';

const OBSERVER_ACTIONS = getRailActions('observer', 'other');
const PARTICIPANT_OTHER_ACTIONS = getRailActions('participant', 'other');
const SELF_ACTIONS = getRailActions('participant', 'self');

// ── 1. Ordering ─────────────────────────────────────────────────

describe('SC-005 buildExpandedDockViewModel — section ordering', () => {
  it('participant-other sections follow RAIL_ACTION_CATEGORIES order', () => {
    const vm = buildExpandedDockViewModel(PARTICIPANT_OTHER_ACTIONS, 'participant', 'other');
    const cats = vm.sections.map((s) => s.category);
    // Expected: reply → evidence → branch → review_flag (the empty
    // watch_observe / join_side / share are skipped).
    expect(cats).toEqual(['reply', 'evidence', 'branch', 'review_flag']);
    // And each index strictly increases against the canonical order.
    const indices = cats.map((c) => RAIL_ACTION_CATEGORIES.indexOf(c));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });

  it('observer sections follow RAIL_ACTION_CATEGORIES order', () => {
    const vm = buildExpandedDockViewModel(OBSERVER_ACTIONS, 'observer', 'other');
    const cats = vm.sections.map((s) => s.category);
    expect(cats).toEqual(['watch_observe', 'join_side', 'evidence', 'share']);
  });
});

// ── 2. showCategoryHeaders rule ─────────────────────────────────

describe('SC-005 buildExpandedDockViewModel — showCategoryHeaders', () => {
  it('is true for the participant-other set (4 non-empty sections)', () => {
    const vm = buildExpandedDockViewModel(PARTICIPANT_OTHER_ACTIONS, 'participant', 'other');
    expect(vm.sections.length).toBeGreaterThanOrEqual(2);
    expect(vm.showCategoryHeaders).toBe(true);
  });

  it('is true for the observer set (4 non-empty sections)', () => {
    // Lock the actual section count from groupRailActionsByCategory so a
    // future taxonomy change cannot silently flip this.
    const sectionCount = groupRailActionsByCategory(OBSERVER_ACTIONS).length;
    expect(sectionCount).toBe(4);
    const vm = buildExpandedDockViewModel(OBSERVER_ACTIONS, 'observer', 'other');
    expect(vm.showCategoryHeaders).toBe(true);
  });

  it('is false for the own-bubble set (collapses to a single review_flag section)', () => {
    const sectionCount = groupRailActionsByCategory(SELF_ACTIONS).length;
    expect(sectionCount).toBe(1);
    const vm = buildExpandedDockViewModel(SELF_ACTIONS, 'participant', 'self');
    expect(vm.sections).toHaveLength(1);
    expect(vm.sections[0].category).toBe('review_flag');
    expect(vm.showCategoryHeaders).toBe(false);
  });

  it('is false for an empty action list', () => {
    const vm = buildExpandedDockViewModel([], 'participant', 'self');
    expect(vm.sections).toEqual([]);
    expect(vm.showCategoryHeaders).toBe(false);
  });
});

// ── 3. Header labels ────────────────────────────────────────────

describe('SC-005 buildExpandedDockViewModel — headerLabel', () => {
  it('each section headerLabel equals RAIL_ACTION_CATEGORY_LABEL[category]', () => {
    for (const actions of [OBSERVER_ACTIONS, PARTICIPANT_OTHER_ACTIONS, SELF_ACTIONS]) {
      const vm = buildExpandedDockViewModel(actions, 'participant', 'other');
      for (const section of vm.sections) {
        expect(section.headerLabel).toBe(RAIL_ACTION_CATEGORY_LABEL[section.category]);
      }
    }
  });
});

// ── 4. No empty section ─────────────────────────────────────────

describe('SC-005 buildExpandedDockViewModel — no empty section', () => {
  it('never emits a section with zero actions', () => {
    for (const actions of [OBSERVER_ACTIONS, PARTICIPANT_OTHER_ACTIONS, SELF_ACTIONS]) {
      const vm = buildExpandedDockViewModel(actions, 'observer', 'other');
      for (const section of vm.sections) {
        expect(section.actions.length).toBeGreaterThan(0);
      }
    }
  });

  it('the section action codes are a partition of the input action codes', () => {
    const vm = buildExpandedDockViewModel(PARTICIPANT_OTHER_ACTIONS, 'participant', 'other');
    const flattened = vm.sections.flatMap((s) => s.actions.map((a) => a.code));
    expect(new Set(flattened).size).toBe(flattened.length); // no dupes
    expect(new Set(flattened)).toEqual(
      new Set(PARTICIPANT_OTHER_ACTIONS.map((a) => a.code)),
    );
  });
});

// ── 5. Title strings ────────────────────────────────────────────

describe('SC-005 buildExpandedDockViewModel — title', () => {
  it('observer → "Observer actions"', () => {
    expect(buildExpandedDockViewModel(OBSERVER_ACTIONS, 'observer', 'other').title)
      .toBe('Observer actions');
  });

  it('participant-own → "On your message"', () => {
    expect(buildExpandedDockViewModel(SELF_ACTIONS, 'participant', 'self').title)
      .toBe('On your message');
  });

  it('participant-other → "On this message"', () => {
    expect(buildExpandedDockViewModel(PARTICIPANT_OTHER_ACTIONS, 'participant', 'other').title)
      .toBe('On this message');
  });
});
