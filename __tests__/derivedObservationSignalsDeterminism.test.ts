/**
 * FEEDBACK-002 (#899) — determinism + frozen-output proof.
 *
 * Same input twice => deep-equal. Permuted node / observation order => identical
 * output. Every signal object + provenance + the output array are frozen.
 */
import {
  deriveDerivedObservationSignals,
  ALL_DERIVED_SIGNAL_CODES,
} from '../src/features/feedbackFlags/derivedObservationSignals';
import { richInput } from './derivedSignalsTestKit';

describe('FEEDBACK-002 — determinism', () => {
  it('the rich fixture fires all seven codes', () => {
    const out = deriveDerivedObservationSignals(richInput());
    const codes = new Set(out.map((s) => s.code));
    for (const code of ALL_DERIVED_SIGNAL_CODES) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it('same input twice => deep-equal', () => {
    const a = deriveDerivedObservationSignals(richInput());
    const b = deriveDerivedObservationSignals(richInput());
    expect(a).toEqual(b);
  });

  it('permuted node + observation order => identical output', () => {
    const input = richInput();
    const shuffled = {
      ...input,
      nodes: [...input.nodes].reverse(),
      moveMarks: [...input.moveMarks].reverse(),
      evidenceDebts: [...input.evidenceDebts].reverse(),
    };
    const base = deriveDerivedObservationSignals(input);
    const permuted = deriveDerivedObservationSignals(shuffled);
    expect(permuted).toEqual(base);
  });

  it('output is sorted by (code, scope-id)', () => {
    const out = deriveDerivedObservationSignals(richInput());
    const keyed = out.map((s) => {
      const scopeId =
        s.scope.kind === 'node'
          ? s.scope.argumentId
          : s.scope.kind === 'thread'
            ? s.scope.pointId
            : s.scope.debateId;
      return `${s.code}|${scopeId}`;
    });
    const sorted = [...keyed].sort();
    expect(keyed).toEqual(sorted);
  });

  it('every signal, provenance, and the output array are frozen', () => {
    const out = deriveDerivedObservationSignals(richInput());
    expect(Object.isFrozen(out)).toBe(true);
    for (const s of out) {
      expect(Object.isFrozen(s)).toBe(true);
      expect(Object.isFrozen(s.provenance)).toBe(true);
    }
  });
});
