/**
 * SC-005 — Stage 6.4 action-set regression lock.
 *
 * This is the doctrine guard that SC-005 changed LAYOUT only. It mirrors
 * the SC-001 contract lock (`railActionGrouping.test.ts`) from the SC-005
 * side: the observer set, the participant-other set, the own-bubble set,
 * and `railActionToBubbleControl` mappings must all be exactly as Stage
 * 6.4 shipped. If any assertion here fails a Stage 6.4 definition was
 * touched — back the change out.
 */
import {
  getRailActions,
  railActionToBubbleControl,
  type RailActionCode,
  type RailBubbleActor,
} from '../src/features/arguments/ArgumentSideActionRail';
import {
  deriveDockContext,
  buildExpandedDockViewModel,
} from '../src/features/arguments/ObserverActionDockLayout';

const ALL_BUBBLE_ACTORS: RailBubbleActor[] = ['self', 'other', 'bot', 'admin', 'unknown'];

// ── 1. Observer set ─────────────────────────────────────────────

describe('UX-001.4 matrix — observer action set (post-Act-consolidation)', () => {
  it('observer set is the four post-UX-001.4 codes for EVERY bubbleActor (ask_source / open_timeline migrated)', () => {
    const expected: RailActionCode[] = [
      'watch', 'join_aff', 'join_neg', 'share',
    ];
    for (const actor of ALL_BUBBLE_ACTORS) {
      const codes = getRailActions('observer', actor).map((a) => a.code);
      expect(codes).toEqual(expected);
    }
  });

  it('the observer-node dock still resolves to the observer action set (label changes, set does not)', () => {
    expect(deriveDockContext('observer', 'other', false)).toBe('observer_no_node');
    expect(deriveDockContext('observer', 'other', true)).toBe('observer_node');
    const noNodeSet = getRailActions('observer', 'other').map((a) => a.code);
    const nodeSet = getRailActions('observer', 'self').map((a) => a.code);
    expect(nodeSet).toEqual(noNodeSet);
  });
});

// ── 2. Own-bubble set (doctrine-critical) ───────────────────────

describe('UX-001.4 matrix — own-bubble action set (post-Act-consolidation)', () => {
  it('own-bubble set is empty (qualifiers + request_deletion migrated to Act)', () => {
    const codes = getRailActions('participant', 'self').map((a) => a.code);
    expect(codes).toEqual([]);
  });

  it('own-bubble set contains NO reply / disagree / flag / source / quote / branch / join / qualifiers / request_deletion code', () => {
    const codes = getRailActions('participant', 'self').map((a) => a.code);
    for (const forbidden of [
      'reply', 'disagree', 'flag', 'ask_source', 'ask_quote',
      'split_branch', 'join_aff', 'join_neg', 'watch', 'open_timeline', 'share',
      'qualifiers', 'request_deletion',
    ]) {
      expect(codes).not.toContain(forbidden);
    }
  });

  it('own-bubble dock view model has zero sections (collapsed label points to Act)', () => {
    const vm = buildExpandedDockViewModel(
      getRailActions('participant', 'self'),
      'participant',
      'self',
    );
    expect(vm.sections).toHaveLength(0);
    expect(vm.showCategoryHeaders).toBe(false);
  });
});

// ── 3. Participant-other set ────────────────────────────────────

describe('UX-001.4 matrix — participant-other action set (post-Act-consolidation)', () => {
  it('participant-other set is reply + disagree (5 codes migrated to Act)', () => {
    const codes = getRailActions('participant', 'other').map((a) => a.code);
    expect(codes).toEqual(['reply', 'disagree']);
  });

  it('participant-other set is identical for bot / admin / unknown bubble actors', () => {
    const base = getRailActions('participant', 'other').map((a) => a.code);
    for (const actor of ['bot', 'admin', 'unknown'] as RailBubbleActor[]) {
      expect(getRailActions('participant', actor).map((a) => a.code)).toEqual(base);
    }
  });
});

// ── 4. railActionToBubbleControl mappings unchanged ─────────────

describe('SC-005 matrix — railActionToBubbleControl', () => {
  it('maps all 13 codes to the exact Stage 6.4 bubble controls', () => {
    const mapping: Record<RailActionCode, string | null> = {
      watch: null,
      join_aff: null,
      join_neg: null,
      open_timeline: null,
      share: null,
      reply: 'reply',
      disagree: 'disagree',
      ask_source: 'ask_for_source',
      ask_quote: 'ask_for_quote',
      split_branch: 'branch',
      flag: 'flag',
      qualifiers: 'view_qualifiers',
      request_deletion: 'request_deletion',
    };
    for (const code of Object.keys(mapping) as RailActionCode[]) {
      expect(railActionToBubbleControl(code)).toBe(mapping[code]);
    }
  });
});
