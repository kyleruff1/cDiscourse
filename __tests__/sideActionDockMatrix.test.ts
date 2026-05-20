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

describe('SC-005 matrix — observer action set', () => {
  it('observer set is the six Stage 6.4 codes for EVERY bubbleActor', () => {
    const expected: RailActionCode[] = [
      'watch', 'join_aff', 'join_neg', 'ask_source', 'open_timeline', 'share',
    ];
    for (const actor of ALL_BUBBLE_ACTORS) {
      const codes = getRailActions('observer', actor).map((a) => a.code);
      expect(codes).toEqual(expected);
    }
  });

  it('the observer-node dock still resolves to the observer action set (label changes, set does not)', () => {
    // Stage 6.4 gives observers no per-bubble tactical actions; selecting a
    // node only changes the collapsed LABEL, never the action set.
    expect(deriveDockContext('observer', 'other', false)).toBe('observer_no_node');
    expect(deriveDockContext('observer', 'other', true)).toBe('observer_node');
    const noNodeSet = getRailActions('observer', 'other').map((a) => a.code);
    const nodeSet = getRailActions('observer', 'self').map((a) => a.code);
    expect(nodeSet).toEqual(noNodeSet);
  });
});

// ── 2. Own-bubble set (doctrine-critical) ───────────────────────

describe('SC-005 matrix — own-bubble action set', () => {
  it('own-bubble set is exactly [qualifiers, request_deletion]', () => {
    const codes = getRailActions('participant', 'self').map((a) => a.code);
    expect(codes).toEqual(['qualifiers', 'request_deletion']);
  });

  it('own-bubble set contains NO reply / disagree / flag / source / quote / branch / join / score code', () => {
    const codes = getRailActions('participant', 'self').map((a) => a.code);
    for (const forbidden of [
      'reply', 'disagree', 'flag', 'ask_source', 'ask_quote',
      'split_branch', 'join_aff', 'join_neg', 'watch', 'open_timeline', 'share',
    ]) {
      expect(codes).not.toContain(forbidden);
    }
  });

  it('own-bubble dock view model has no body-edit affordance and a single flat section', () => {
    const vm = buildExpandedDockViewModel(
      getRailActions('participant', 'self'),
      'participant',
      'self',
    );
    expect(vm.sections).toHaveLength(1);
    expect(vm.showCategoryHeaders).toBe(false);
    const labels = vm.sections.flatMap((s) => s.actions.map((a) => a.label.toLowerCase()));
    for (const banned of ['edit', 'reply', 'disagree', 'flag']) {
      expect(labels.some((l) => l.includes(banned))).toBe(false);
    }
  });
});

// ── 3. Participant-other set ────────────────────────────────────

describe('SC-005 matrix — participant-other action set', () => {
  it('participant-other set is the seven Stage 6.4 codes', () => {
    const codes = getRailActions('participant', 'other').map((a) => a.code);
    expect(codes).toEqual([
      'reply', 'disagree', 'ask_source', 'ask_quote', 'split_branch', 'flag', 'qualifiers',
    ]);
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
