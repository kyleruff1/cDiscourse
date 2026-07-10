/**
 * FEEDBACK-002 (#899) — flag-off byte-identity proof for the derived-signal
 * advisory surfaces.
 *
 * With derived_signals OFF the room is byte-identical to today:
 *   - ArgumentRoom gates the derivedSignals memo on derivedSignalsEnabled and
 *     returns the frozen empty result, so selectInspectAdvisoryLines yields [] and
 *     selectMediatorRailOverlay yields {} => the DerivedSignalAdvisoryLines strip
 *     renders null and the DisagreementPointsRail overlay is empty;
 *   - App.tsx is the SOLE flag reader (isDerivedSignalsEnabled) and threads the
 *     boolean as a prop through ArgumentTreeScreen; no src/features file imports
 *     featureFlags.
 * With the flag ON the derivation runs and the two surfaces populate.
 *
 * Source-scan discipline (no runtime render), modeled on moveMarksFlagOff.
 */
import fs from 'fs';
import path from 'path';
import {
  deriveDerivedObservationSignals,
} from '../src/features/feedbackFlags/derivedObservationSignals';
import {
  selectInspectAdvisoryLines,
  selectMediatorRailOverlay,
} from '../src/features/feedbackFlags/derivedSignalConsumerModel';
import { baseInput } from './derivedSignalsTestKit';

const ROOT = process.cwd();
const APP_SRC = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
const TREE_SRC = fs.readFileSync(
  path.join(ROOT, 'src/features/arguments/ArgumentTreeScreen.tsx'),
  'utf8',
);
const ROOM_SRC = fs.readFileSync(
  path.join(ROOT, 'src/features/arguments/room/ArgumentRoom.tsx'),
  'utf8',
);

const FEEDBACK_002_FILES = [
  'src/features/feedbackFlags/derivedObservationSignals.ts',
  'src/features/feedbackFlags/derivedSignalConsumerModel.ts',
  'src/features/feedbackFlags/DerivedSignalAdvisoryLines.tsx',
];

describe('FEEDBACK-002 — App.tsx is the sole flag reader', () => {
  it('App.tsx reads isDerivedSignalsEnabled and threads derivedSignalsEnabled', () => {
    expect(APP_SRC).toContain('isDerivedSignalsEnabled');
    expect(APP_SRC).toMatch(/derivedSignalsEnabled\s*=\s*isDerivedSignalsEnabled\(\)/);
    expect(APP_SRC).toContain('derivedSignalsEnabled={derivedSignalsEnabled}');
  });

  it('ArgumentTreeScreen forwards derivedSignalsEnabled verbatim (no flag read)', () => {
    expect(TREE_SRC).toContain('derivedSignalsEnabled');
    expect(TREE_SRC).not.toContain('isDerivedSignalsEnabled');
  });

  it('ArgumentRoom consumes the prop (no featureFlags import)', () => {
    expect(ROOM_SRC).toContain('derivedSignalsEnabled');
    expect(/from\s+['"][^'"]*featureFlags['"]/.test(ROOM_SRC)).toBe(false);
    expect(ROOM_SRC.includes('isDerivedSignalsEnabled')).toBe(false);
  });

  it('no FEEDBACK-002 module imports featureFlags', () => {
    for (const rel of FEEDBACK_002_FILES) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(/from\s+['"][^'"]*featureFlags['"]/.test(src)).toBe(false);
    }
  });
});

describe('FEEDBACK-002 — flag-off derivation yields empty surfaces', () => {
  it('an empty derivation yields empty Inspect lines and empty rail overlay', () => {
    const signals = deriveDerivedObservationSignals(baseInput());
    expect(signals).toEqual([]);
    expect(selectInspectAdvisoryLines(signals, 'any-node')).toEqual([]);
    expect(selectMediatorRailOverlay(signals, ['P1', 'P2'])).toEqual({});
  });

  it('ArgumentRoom gates the memo on the derivedSignalsEnabled prop', () => {
    // The memo short-circuits to the frozen empty result when the flag is off.
    expect(ROOM_SRC).toMatch(/derivedSignalsEnabled\s*!==\s*true/);
    expect(ROOM_SRC).toContain('EMPTY_DERIVED_SIGNALS');
  });
});
