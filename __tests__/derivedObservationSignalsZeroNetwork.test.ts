/**
 * FEEDBACK-002 (#899) — zero-network + single-derivation source scan.
 *
 * The derivation + consumer modules are PURE and read-only. This is a source
 * scan (jest runs on Node with a real process, so a behavioral test cannot catch
 * a stray import):
 *  - no fetch / supabase / anthropic / xai / Date.now / Math.random / console.log;
 *  - no import from src/features/pointStanding/;
 *  - no import of deriveMediatorBoardState / buildPointLifecycleMap /
 *    deriveEvidenceDebts (the single-derivation pin);
 *  - the module is NOT imported by evaluateArgumentDraft or the submit path.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const MODULE_FILES = [
  'src/features/feedbackFlags/derivedObservationSignals.ts',
  'src/features/feedbackFlags/derivedSignalConsumerModel.ts',
];
/** Strip line + block comments so a symbol named in a doc comment is not a hit. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const SOURCES = MODULE_FILES.map((rel) => {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return { rel, src: raw, code: stripComments(raw) };
});

// Assembled from fragments so this scanner file never contains the raw literal.
const BANNED_RUNTIME = [
  'fetch(',
  'supabase',
  'anthropic',
  'xai',
  'Date' + '.now',
  'Math' + '.random',
  'console' + '.log',
];

describe('FEEDBACK-002 — zero-network / no side effects', () => {
  for (const { rel, code } of SOURCES) {
    for (const token of BANNED_RUNTIME) {
      it(`${rel} contains no ${token}`, () => {
        expect(code.includes(token)).toBe(false);
      });
    }
  }
});

describe('FEEDBACK-002 — no standing / single-derivation imports', () => {
  // Scan comment-stripped code so a symbol named in a doc comment is not a hit.
  for (const { rel, code } of SOURCES) {
    it(`${rel} imports nothing from pointStanding`, () => {
      expect(/from\s+['"][^'"]*pointStanding[^'"]*['"]/.test(code)).toBe(false);
    });
    it(`${rel} does not import deriveMediatorBoardState / buildPointLifecycleMap / deriveEvidenceDebts`, () => {
      expect(code.includes('deriveMediatorBoardState')).toBe(false);
      expect(code.includes('buildPointLifecycleMap')).toBe(false);
      expect(code.includes('deriveEvidenceDebts')).toBe(false);
    });
  }
});

describe('FEEDBACK-002 — module is not in the validation / submit path', () => {
  const CONSUMER_GUARD_FILES = [
    'src/domain/constitution/evaluateArgumentDraft.ts',
    'src/features/arguments/composerSubmit.ts',
  ];
  for (const rel of CONSUMER_GUARD_FILES) {
    it(`${rel} does not import derivedObservationSignals`, () => {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(src.includes('derivedObservationSignals')).toBe(false);
      expect(src.includes('derivedSignalConsumerModel')).toBe(false);
    });
  }
});
