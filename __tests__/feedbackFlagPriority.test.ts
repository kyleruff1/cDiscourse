/**
 * UX-FLAGS-003 — feedbackFlagPriority pure-model tests.
 *
 * Proves the display-budget module: deterministic tier ordering (actionable-
 * positive → actionable-prompt → descriptive → unknown), a hard cap that never
 * resolves above 3, a stable input-order tie-break, frozen same-reference
 * output, clean passthrough of `neverGrantsStanding`, and the doctrine invariant
 * that the module originates no user-facing strings (it only reorders / slices).
 */
import {
  prioritizePointFeedbackFlags,
  resolveVisibleFlagCap,
  DEFAULT_VISIBLE_FLAG_CAP,
  MIN_VISIBLE_FLAG_CAP,
} from '../src/features/feedbackFlags/feedbackFlagPriority';
import type { PointFeedbackFlagViewModel } from '../src/features/feedbackFlags/pointFeedbackFlagsModel';
import type { FriendlyFlagTone } from '../src/features/feedbackFlags/friendlyFlagMap';

function vm(
  id: string,
  tone: FriendlyFlagTone | string,
  extra: Partial<PointFeedbackFlagViewModel> = {},
): PointFeedbackFlagViewModel {
  return {
    id,
    label: extra.label ?? id,
    tone: tone as FriendlyFlagTone,
    neverGrantsStanding: extra.neverGrantsStanding ?? false,
    accessibilityLabel: extra.accessibilityLabel ?? `Note, ${id}`,
    family: extra.family ?? 'parent_relation',
    ...(extra.helper !== undefined ? { helper: extra.helper } : {}),
  };
}

describe('resolveVisibleFlagCap', () => {
  it('constants are the documented [1, 3] range', () => {
    expect(DEFAULT_VISIBLE_FLAG_CAP).toBe(3);
    expect(MIN_VISIBLE_FLAG_CAP).toBe(1);
  });

  it.each<[number | undefined, number]>([
    [undefined, 3],
    [NaN, 3],
    [Infinity, 3],
    [-Infinity, 3],
    [0, 1],
    [-4, 1],
    [1, 1],
    [2, 2],
    [2.7, 2],
    [3, 3],
    [9, 3],
    [1000, 3],
  ])('clamps cap %p → %p (never above 3)', (input, expected) => {
    expect(resolveVisibleFlagCap(input)).toBe(expected);
  });
});

describe('prioritizePointFeedbackFlags — tier ordering', () => {
  it('orders positive → prompt → descriptive and keeps two positives in input order', () => {
    const input = [
      vm('d1', 'descriptive'),
      vm('p1', 'positive'),
      vm('q1', 'prompt'),
      vm('p2', 'positive'),
    ];
    const { visible, suppressedCount } = prioritizePointFeedbackFlags(input);
    expect(visible.map((f) => f.id)).toEqual(['p1', 'p2', 'q1']); // cap 3
    expect(suppressedCount).toBe(1); // d1 dropped
  });

  it('an unknown / malformed tone sorts last (defensive, never throws)', () => {
    const input = [
      vm('weird', 'mysterious'),
      vm('q1', 'prompt'),
      vm('p1', 'positive'),
    ];
    const { visible } = prioritizePointFeedbackFlags(input);
    expect(visible.map((f) => f.id)).toEqual(['p1', 'q1', 'weird']);
  });
});

describe('prioritizePointFeedbackFlags — cap + suppressedCount', () => {
  it('hard cap default: 5 in → 3 visible, suppressedCount 2', () => {
    const input = [
      vm('p1', 'positive'),
      vm('p2', 'positive'),
      vm('q1', 'prompt'),
      vm('d1', 'descriptive'),
      vm('d2', 'descriptive'),
    ];
    const { visible, suppressedCount } = prioritizePointFeedbackFlags(input);
    expect(visible.length).toBe(3);
    expect(suppressedCount).toBe(2);
  });

  it('under cap: 2 in → 2 visible, suppressedCount 0', () => {
    const { visible, suppressedCount } = prioritizePointFeedbackFlags([
      vm('p1', 'positive'),
      vm('q1', 'prompt'),
    ]);
    expect(visible.length).toBe(2);
    expect(suppressedCount).toBe(0);
  });

  it('exactly cap: 3 in → 3 visible, suppressedCount 0', () => {
    const { visible, suppressedCount } = prioritizePointFeedbackFlags([
      vm('p1', 'positive'),
      vm('q1', 'prompt'),
      vm('d1', 'descriptive'),
    ]);
    expect(visible.length).toBe(3);
    expect(suppressedCount).toBe(0);
  });

  it('caller cap clamps end-to-end and never exceeds 3', () => {
    const five = [
      vm('p1', 'positive'),
      vm('p2', 'positive'),
      vm('q1', 'prompt'),
      vm('d1', 'descriptive'),
      vm('d2', 'descriptive'),
    ];
    expect(prioritizePointFeedbackFlags(five, 0).visible.length).toBe(1);
    expect(prioritizePointFeedbackFlags(five, -4).visible.length).toBe(1);
    expect(prioritizePointFeedbackFlags(five, 2).visible.length).toBe(2);
    expect(prioritizePointFeedbackFlags(five, 2.7).visible.length).toBe(2);
    expect(prioritizePointFeedbackFlags(five, 9).visible.length).toBe(3);
    expect(prioritizePointFeedbackFlags(five, NaN).visible.length).toBe(3);
    expect(prioritizePointFeedbackFlags(five, undefined).visible.length).toBe(3);
    // suppressedCount tracks the resolved cap.
    expect(prioritizePointFeedbackFlags(five, 1).suppressedCount).toBe(4);
    expect(prioritizePointFeedbackFlags(five, 2).suppressedCount).toBe(3);
  });
});

describe('prioritizePointFeedbackFlags — determinism + stability', () => {
  const input = [
    vm('d1', 'descriptive'),
    vm('p1', 'positive'),
    vm('q1', 'prompt'),
    vm('p2', 'positive'),
  ];

  it('same input twice → deeply equal output', () => {
    const a = prioritizePointFeedbackFlags(input);
    const b = prioritizePointFeedbackFlags(input);
    expect(a).toEqual(b);
    expect(a.visible.map((f) => f.id)).toEqual(b.visible.map((f) => f.id));
  });

  it('two equal-tone flags preserve input order (tie-break by original index)', () => {
    const twoPositives = [vm('first', 'positive'), vm('second', 'positive')];
    const { visible } = prioritizePointFeedbackFlags(twoPositives);
    expect(visible.map((f) => f.id)).toEqual(['first', 'second']);
    // Reversed input reverses output — proves order comes from input, not id.
    const reversed = prioritizePointFeedbackFlags([
      vm('second', 'positive'),
      vm('first', 'positive'),
    ]);
    expect(reversed.visible.map((f) => f.id)).toEqual(['second', 'first']);
  });
});

describe('prioritizePointFeedbackFlags — empty / null / frozen', () => {
  it.each([[[]], [null], [undefined]])(
    'non-list / empty %p → { visible: [], suppressedCount: 0 }',
    (input) => {
      const result = prioritizePointFeedbackFlags(input as never);
      expect(result.visible).toEqual([]);
      expect(result.suppressedCount).toBe(0);
    },
  );

  it('visible is frozen', () => {
    const { visible } = prioritizePointFeedbackFlags([vm('p1', 'positive')]);
    expect(Object.isFrozen(visible)).toBe(true);
  });

  it('surviving VMs are the SAME references from input (no copy / mutation)', () => {
    const a = vm('p1', 'positive');
    const b = vm('q1', 'prompt');
    const { visible } = prioritizePointFeedbackFlags([a, b]);
    expect(visible[0]).toBe(a);
    expect(visible[1]).toBe(b);
  });

  it('passes neverGrantsStanding through unchanged', () => {
    const flag = vm('receipt', 'prompt', { neverGrantsStanding: true });
    const { visible } = prioritizePointFeedbackFlags([flag]);
    expect(visible[0].neverGrantsStanding).toBe(true);
    expect(visible[0]).toBe(flag);
  });
});

describe('prioritizePointFeedbackFlags — originates no user-facing strings', () => {
  it('every visible string field is byte-identical to the input (only reorders / slices)', () => {
    const input = [
      vm('d1', 'descriptive', { label: 'Alpha', helper: 'Alpha helper', accessibilityLabel: 'Note, Alpha' }),
      vm('p1', 'positive', { label: 'Beta', accessibilityLabel: 'Positive, Beta' }),
    ];
    const { visible } = prioritizePointFeedbackFlags(input);
    // The module changed no text — only the reference set and its order.
    const byId = new Map(input.map((f) => [f.id, f]));
    for (const f of visible) {
      const src = byId.get(f.id)!;
      expect(f.label).toBe(src.label);
      expect(f.helper).toBe(src.helper);
      expect(f.accessibilityLabel).toBe(src.accessibilityLabel);
    }
  });
});
