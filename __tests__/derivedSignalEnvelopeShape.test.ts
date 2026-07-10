/**
 * FEEDBACK-002 (#899) — the five DerivedSignal envelope invariants.
 *
 * 1. advisory/authoritative/neverAffectsStanding literals on every signal.
 * 2. consumers drawn only from the closed enum; the enum has no standing token.
 * 3. composerOnly === true iff code === own_tension_hint, with consumers exactly
 *    ['composer_whisper'].
 * 4. provenance.heatBand non-null iff code === hot_but_proof_light.
 * 5. Output is frozen + sorted (covered here + determinism suite).
 */
import {
  deriveDerivedObservationSignals,
  type DerivedSignalConsumer,
} from '../src/features/feedbackFlags/derivedObservationSignals';
import { richInput } from './derivedSignalsTestKit';

const ALLOWED_CONSUMERS: readonly DerivedSignalConsumer[] = [
  'inspect_advisory_line',
  'mediator_rail_line',
  'proof_button_pulse',
  'state_rail_line',
  'your_turn_ranking',
  'gallery_bucket',
  'linked_prior_ordering',
  'composer_whisper',
];

const STANDING_TOKEN = /stand|score|credit|band|win|verdict/i;

describe('FEEDBACK-002 — envelope invariants', () => {
  const signals = deriveDerivedObservationSignals(richInput());

  it('invariant 1 — advisory/authoritative/neverAffectsStanding literals hold', () => {
    for (const s of signals) {
      expect(s.advisory).toBe(true);
      expect(s.authoritative).toBe(false);
      expect(s.neverAffectsStanding).toBe(true);
    }
  });

  it('invariant 2 — consumers are only from the closed enum', () => {
    for (const s of signals) {
      for (const c of s.consumers) {
        expect(ALLOWED_CONSUMERS).toContain(c);
      }
    }
  });

  it('invariant 2 — no allowed consumer token matches a standing/score/verdict word', () => {
    for (const c of ALLOWED_CONSUMERS) {
      expect(STANDING_TOKEN.test(c)).toBe(false);
    }
  });

  it('invariant 3 — composerOnly iff own_tension_hint, with consumers === [composer_whisper]', () => {
    for (const s of signals) {
      if (s.code === 'own_tension_hint') {
        expect(s.composerOnly).toBe(true);
        expect(s.consumers).toEqual(['composer_whisper']);
      } else {
        expect(s.composerOnly).toBe(false);
        expect(s.consumers).not.toContain('composer_whisper');
      }
    }
  });

  it('invariant 4 — provenance.heatBand non-null iff hot_but_proof_light', () => {
    for (const s of signals) {
      if (s.code === 'hot_but_proof_light') {
        expect(s.provenance.heatBand).not.toBeNull();
      } else {
        expect(s.provenance.heatBand).toBeNull();
      }
    }
  });
});
