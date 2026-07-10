/**
 * FEEDBACK-002 (#899) — copy ban-list (with a firing negative control).
 *
 * Every string in DERIVED_SIGNAL_LINE_COPY, and every DerivedSignalLine
 * text/accessibilityLabel produced by the two selectors over the rich fixture,
 * is scanned for verdict/person tokens, snake_case leak, and raw code leak.
 * dodge_chain copy must not say "evad" / "dodge"; talking_past must name neither
 * person.
 */
import {
  deriveDerivedObservationSignals,
  ALL_DERIVED_SIGNAL_CODES,
} from '../src/features/feedbackFlags/derivedObservationSignals';
import {
  DERIVED_SIGNAL_LINE_COPY,
  selectInspectAdvisoryLines,
  selectMediatorRailOverlay,
  type DerivedSignalLine,
} from '../src/features/feedbackFlags/derivedSignalConsumerModel';
import { _forbiddenVerdictTokens } from '../src/features/feedbackFlags/friendlyFlagMap';
import { richInput } from './derivedSignalsTestKit';

const BANNED = _forbiddenVerdictTokens();

function assertClean(text: string): void {
  const lower = text.toLowerCase();
  for (const token of BANNED) {
    expect(lower.includes(token)).toBe(false);
  }
  // No snake_case leak / no raw DerivedSignalCode value.
  expect(/_/.test(text)).toBe(false);
  for (const code of ALL_DERIVED_SIGNAL_CODES) {
    expect(text.includes(code)).toBe(false);
  }
}

describe('FEEDBACK-002 — copy ban-list', () => {
  it('every DERIVED_SIGNAL_LINE_COPY string is ban-list clean', () => {
    for (const code of ALL_DERIVED_SIGNAL_CODES) {
      const copy = DERIVED_SIGNAL_LINE_COPY[code];
      assertClean(copy.text);
      assertClean(copy.accessibilityLabel);
    }
  });

  it('every selector-produced line is ban-list clean', () => {
    const signals = deriveDerivedObservationSignals(richInput());
    const lines: DerivedSignalLine[] = [];
    // Cover node + thread anchored inspect lines across the fired nodes.
    for (const id of ['M1', 'X4', 'Y4', 'A3', 'A2']) {
      for (const l of selectInspectAdvisoryLines(signals, id)) lines.push(l);
    }
    const overlay = selectMediatorRailOverlay(signals, ['P2', 'P3']);
    for (const pointId of Object.keys(overlay)) lines.push(overlay[pointId]);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      assertClean(l.text);
      assertClean(l.accessibilityLabel);
    }
  });

  it('dodge_chain copy never says "evad" or "dodge"', () => {
    const copy = DERIVED_SIGNAL_LINE_COPY.dodge_chain;
    expect(copy.text.toLowerCase()).not.toContain('evad');
    expect(copy.text.toLowerCase()).not.toContain('dodge');
    expect(copy.accessibilityLabel.toLowerCase()).not.toContain('evad');
    expect(copy.accessibilityLabel.toLowerCase()).not.toContain('dodge');
  });

  it('talking_past copy names neither person (no you-are attribution)', () => {
    const copy = DERIVED_SIGNAL_LINE_COPY.talking_past;
    expect(copy.text.toLowerCase()).not.toContain('you are');
    expect(copy.text.toLowerCase()).not.toContain('they are');
  });

  it('FIRING NEGATIVE CONTROL — the ban scanner rejects a known-bad string', () => {
    expect(() => assertClean('the winner is clear')).toThrow();
  });
});
