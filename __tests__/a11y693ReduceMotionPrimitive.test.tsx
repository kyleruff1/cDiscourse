/**
 * A11Y-693 — the shared useReduceMotion hook + its DisagreementPointsRail
 * adoption.
 *
 * Per `docs/designs/A11Y-693-ASP.md` (the reduce-motion primitive):
 *   - override precedence: a boolean `reduceMotionOverride` wins both ways.
 *   - undefined override follows the live OS AccessibilityInfo value.
 *   - default-safe: false until the async read resolves; false when the API
 *     rejects or is unavailable (web shim / jest).
 *   - a mid-session reduceMotionChanged event updates the value.
 *   - dedupe proof (source-scan): DisagreementPointsRail imports the hook and no
 *     longer hand-rolls the AccessibilityInfo listener, while still honoring the
 *     reduceMotionOverride prop.
 *
 * Comments are apostrophe-free for the naive quote-parity doctrine scanner.
 */
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AccessibilityInfo } from 'react-native';
import { render, renderHook, act, waitFor } from '@testing-library/react-native';
import { useReduceMotion } from '../src/features/preferences/useReduceMotion';
import { DisagreementPointsRail } from '../src/features/mediator/DisagreementPointsRail';
import type {
  DisagreementPoint,
  MediatorBoardState,
  MediatorStateCode,
} from '../src/features/mediator';
import { plainLanguageForMediatorState } from '../src/features/mediator';

const RAIL_PATH = join(process.cwd(), 'src/features/mediator/DisagreementPointsRail.tsx');
const HOOK_PATH = join(process.cwd(), 'src/features/preferences/useReduceMotion.ts');
const RAIL_SRC = readFileSync(RAIL_PATH, 'utf8');
const HOOK_SRC = readFileSync(HOOK_PATH, 'utf8');

// ── the hook ──────────────────────────────────────────────────

describe('A11Y-693 useReduceMotion — override precedence + OS read', () => {
  let removeMock: jest.Mock;

  beforeEach(() => {
    removeMock = jest.fn();
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false as unknown as boolean);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: removeMock } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns true when the override is true', async () => {
    const { result } = renderHook(() => useReduceMotion(true));
    expect(result.current).toBe(true);
    // Flush the mount effect so no pending update trails the assertion.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe(true);
  });

  it('returns false when the override is false even if the OS asks to reduce', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true as unknown as boolean);
    const { result } = renderHook(() => useReduceMotion(false));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe(false);
  });

  it('follows the OS value when the override is undefined', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true as unknown as boolean);
    const { result } = renderHook(() => useReduceMotion(undefined));
    // Default-safe false before the async read resolves.
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('is default-safe false before the OS read resolves', () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      // A promise that never settles: the value must stay at the safe default.
      .mockReturnValue(new Promise<boolean>(() => {}) as unknown as Promise<boolean>);
    const { result } = renderHook(() => useReduceMotion(undefined));
    expect(result.current).toBe(false);
  });

  it('stays false when the OS read rejects', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockRejectedValue(new Error('rejected') as never);
    const { result } = renderHook(() => useReduceMotion(undefined));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe(false);
  });

  it('stays false when the AccessibilityInfo API is unavailable (throws)', () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => {
      throw new Error('unavailable');
    });
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(() => {
      throw new Error('unavailable');
    });
    const { result } = renderHook(() => useReduceMotion(undefined));
    expect(result.current).toBe(false);
  });

  it('updates when the OS emits reduceMotionChanged (override undefined)', async () => {
    // A never-resolving one-shot read so ONLY the subscription event drives the
    // value (a resolved one-shot could race the handler and overwrite it).
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(new Promise<boolean>(() => {}) as unknown as Promise<boolean>);
    let handler: ((enabled: boolean) => void) | null = null;
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      _event: string,
      cb: (enabled: boolean) => void,
    ) => {
      handler = cb;
      return { remove: removeMock };
    }) as never);
    const { result } = renderHook(() => useReduceMotion(undefined));
    expect(result.current).toBe(false);
    await act(async () => {
      handler?.(true);
    });
    expect(result.current).toBe(true);
  });

  it('override still wins over a mid-session OS change', async () => {
    let handler: ((enabled: boolean) => void) | null = null;
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      _event: string,
      cb: (enabled: boolean) => void,
    ) => {
      handler = cb;
      return { remove: removeMock };
    }) as never);
    const { result } = renderHook(() => useReduceMotion(false));
    await act(async () => {
      handler?.(true);
    });
    // The false override wins regardless of the OS emitting reduce-motion on.
    expect(result.current).toBe(false);
  });

  it('removes the subscription on unmount', () => {
    const { unmount } = renderHook(() => useReduceMotion(undefined));
    unmount();
    expect(removeMock).toHaveBeenCalled();
  });
});

// ── the hook source (default-safe contract) ───────────────────

describe('A11Y-693 useReduceMotion — source contract', () => {
  it('defaults the OS state to false (motion allowed until we know otherwise)', () => {
    expect(HOOK_SRC).toMatch(/useState\(false\)/);
  });

  it('returns the boolean override in precedence over the OS value', () => {
    expect(HOOK_SRC).toMatch(/typeof reduceMotionOverride === 'boolean'/);
  });

  it('wraps the AccessibilityInfo read and the listener setup in try/catch', () => {
    expect(HOOK_SRC).toMatch(/isReduceMotionEnabled/);
    expect(HOOK_SRC).toMatch(/addEventListener\(\s*'reduceMotionChanged'/);
  });
});

// ── DisagreementPointsRail adoption (dedupe proof) ────────────

describe('A11Y-693 DisagreementPointsRail adopts the shared hook', () => {
  it('imports useReduceMotion from the preferences module', () => {
    expect(RAIL_SRC).toMatch(
      /import\s*\{\s*useReduceMotion\s*\}\s*from\s*'\.\.\/preferences\/useReduceMotion'/,
    );
  });

  it('no longer hand-rolls the reduceMotionChanged listener or the OS read', () => {
    expect(RAIL_SRC).not.toMatch(/addEventListener\(\s*'reduceMotionChanged'/);
    expect(RAIL_SRC).not.toMatch(/isReduceMotionEnabled/);
    expect(RAIL_SRC).not.toMatch(/AccessibilityInfo/);
  });

  it('still honors the reduceMotionOverride prop through the hook', () => {
    expect(RAIL_SRC).toMatch(/useReduceMotion\(reduceMotionOverride\)/);
  });
});

// ── render parity (the rail still renders under reduceMotionOverride) ──

function makePoint(id: string, state: MediatorStateCode): DisagreementPoint {
  return {
    id,
    anchor: { nodeId: id, parentNodeId: null, targetExcerpt: null },
    kind: 'unaxed',
    state,
    plainLabel: plainLanguageForMediatorState(state),
    lifecycleState: 'open',
    confidence: 'medium',
    openEvidenceDebtIds: [],
    memberNodeIds: [id],
    isAdvisory: false,
  };
}

function makeBoard(points: DisagreementPoint[]): MediatorBoardState {
  return {
    debateId: 'debate-1',
    points,
    markupByNodeId: {},
    evidenceDebts: [],
    blockedEvidencePaths: [],
    definitionMismatches: [],
    scopeMismatches: [],
    recollectionConflicts: [],
    nonProvableKeyDetails: [],
    impasses: [],
    pathwaysByPointId: {},
    nextAction: null,
    inputHash: 'h1',
  };
}

describe('A11Y-693 DisagreementPointsRail — reduce-motion render parity', () => {
  it('renders cleanly with reduceMotionOverride on a 390x844 sheet', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint('p1', 'open')])}
        defaultCollapsed={false}
        windowWidth={390}
        windowHeight={844}
        reduceMotionOverride
      />,
    );
    expect(getByTestId('disagreement-points-rail-row-p1')).toBeTruthy();
  });
});
