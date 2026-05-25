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

describe('UX-001.4 buildExpandedDockViewModel — section ordering', () => {
  it('participant-other sections: only reply remains after UX-001.4 migration', () => {
    const vm = buildExpandedDockViewModel(PARTICIPANT_OTHER_ACTIONS, 'participant', 'other');
    const cats = vm.sections.map((s) => s.category);
    // UX-001.4 — evidence, branch, review_flag categories migrated to Act.
    expect(cats).toEqual(['reply']);
    // And each index strictly increases against the canonical order.
    const indices = cats.map((c) => RAIL_ACTION_CATEGORIES.indexOf(c));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });

  it('observer sections: watch_observe / join_side / share (UX-001.4 migrated evidence)', () => {
    const vm = buildExpandedDockViewModel(OBSERVER_ACTIONS, 'observer', 'other');
    const cats = vm.sections.map((s) => s.category);
    expect(cats).toEqual(['watch_observe', 'join_side', 'share']);
  });
});

// ── 2. showCategoryHeaders rule ─────────────────────────────────

describe('UX-001.4 buildExpandedDockViewModel — showCategoryHeaders', () => {
  it('is false for the participant-other set (only 1 section after migration)', () => {
    const vm = buildExpandedDockViewModel(PARTICIPANT_OTHER_ACTIONS, 'participant', 'other');
    // After UX-001.4 migration, participant-other has only 1 non-empty
    // section (reply); showCategoryHeaders flips to false because the
    // single-section render reads more cleanly without a header.
    expect(vm.sections.length).toBe(1);
    expect(vm.showCategoryHeaders).toBe(false);
  });

  it('is true for the observer set (3 non-empty sections after UX-001.4 migration)', () => {
    const sectionCount = groupRailActionsByCategory(OBSERVER_ACTIONS).length;
    expect(sectionCount).toBe(3);
    const vm = buildExpandedDockViewModel(OBSERVER_ACTIONS, 'observer', 'other');
    expect(vm.showCategoryHeaders).toBe(true);
  });

  it('is false for the own-bubble set (empty after UX-001.4 migration)', () => {
    const sectionCount = groupRailActionsByCategory(SELF_ACTIONS).length;
    expect(sectionCount).toBe(0);
    const vm = buildExpandedDockViewModel(SELF_ACTIONS, 'participant', 'self');
    expect(vm.sections).toHaveLength(0);
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
