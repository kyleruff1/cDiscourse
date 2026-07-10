/**
 * FEEDBACK-002 (#899) — the two mandated consumer selectors.
 *
 * selectInspectAdvisoryLines: node + thread anchoring to the active node,
 * composer-only excluded, room-scoped signals excluded, deduped by code.
 * selectMediatorRailOverlay: only thread signals whose pointId is a board point,
 * at most one line per point, additive (never reorders).
 */
import {
  deriveDerivedObservationSignals,
} from '../src/features/feedbackFlags/derivedObservationSignals';
import {
  selectInspectAdvisoryLines,
  selectMediatorRailOverlay,
} from '../src/features/feedbackFlags/derivedSignalConsumerModel';
import { richInput } from './derivedSignalsTestKit';

describe('FEEDBACK-002 — selectInspectAdvisoryLines', () => {
  const signals = deriveDerivedObservationSignals(richInput());

  it('returns nothing when there is no active node', () => {
    expect(selectInspectAdvisoryLines(signals, null)).toEqual([]);
  });

  it('returns the node-anchored advisory line for the active node (proof_moment on M1)', () => {
    const lines = selectInspectAdvisoryLines(signals, 'M1');
    expect(lines.some((l) => l.code === 'proof_moment')).toBe(true);
  });

  it('surfaces a thread-anchored line for a member of the thread (dodge_chain on A3)', () => {
    const lines = selectInspectAdvisoryLines(signals, 'A3');
    expect(lines.some((l) => l.code === 'dodge_chain')).toBe(true);
  });

  it('never surfaces the composer-only own_tension_hint', () => {
    for (const id of ['M1', 'R1', 'A2', 'B2', 'A3', 'B3', 'X4', 'Y4']) {
      const lines = selectInspectAdvisoryLines(signals, id);
      expect(lines.some((l) => l.code === 'own_tension_hint')).toBe(false);
    }
  });

  it('never surfaces the room-scoped hot_but_proof_light on a node', () => {
    for (const id of ['M1', 'A3', 'X4']) {
      const lines = selectInspectAdvisoryLines(signals, id);
      expect(lines.some((l) => l.code === 'hot_but_proof_light')).toBe(false);
    }
  });

  it('de-dupes by code', () => {
    const lines = selectInspectAdvisoryLines(signals, 'M1');
    const codes = lines.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('FEEDBACK-002 — selectMediatorRailOverlay', () => {
  const signals = deriveDerivedObservationSignals(richInput());

  it('maps thread signals to their board point ids (P2 talking_past, P3 dodge_chain)', () => {
    const overlay = selectMediatorRailOverlay(signals, ['P2', 'P3']);
    expect(overlay.P2?.code).toBe('talking_past');
    expect(overlay.P3?.code).toBe('dodge_chain');
  });

  it('emits nothing for point ids not on the board', () => {
    const overlay = selectMediatorRailOverlay(signals, ['NOT_A_POINT']);
    expect(Object.keys(overlay)).toEqual([]);
  });

  it('emits nothing for an empty signal list (flag-off shape)', () => {
    const overlay = selectMediatorRailOverlay([], ['P2', 'P3']);
    expect(overlay).toEqual({});
  });

  it('is frozen', () => {
    const overlay = selectMediatorRailOverlay(signals, ['P2', 'P3']);
    expect(Object.isFrozen(overlay)).toBe(true);
  });
});
