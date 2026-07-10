/**
 * FEEDBACK-002 (#899) — the anti-amplification pin (with firing negative
 * controls).
 *
 * Heat is the ONLY activity input and reaches EXACTLY one signal
 * (hot_but_proof_light). No signal touches standing. The consumer enum has no
 * standing/score/credit/band/verdict member. The module imports no pointStanding.
 */
import fs from 'fs';
import path from 'path';
import {
  deriveDerivedObservationSignals,
} from '../src/features/feedbackFlags/derivedObservationSignals';
import { baseInput, node, debt, richInput } from './derivedSignalsTestKit';

const ROOT = process.cwd();
const MODULE_SRC = fs.readFileSync(
  path.join(ROOT, 'src/features/feedbackFlags/derivedObservationSignals.ts'),
  'utf8',
);

describe('FEEDBACK-002 — anti-amplification: heat reaches exactly one signal', () => {
  it('provenance.heatBand is non-null ONLY on hot_but_proof_light', () => {
    const out = deriveDerivedObservationSignals(richInput());
    for (const s of out) {
      if (s.code === 'hot_but_proof_light') expect(s.provenance.heatBand).toBe('hot');
      else expect(s.provenance.heatBand).toBeNull();
    }
  });

  it('hot_but_proof_light consumers are a subset of {gallery_bucket}', () => {
    const out = deriveDerivedObservationSignals(richInput());
    const hot = out.find((s) => s.code === 'hot_but_proof_light');
    expect(hot).toBeDefined();
    for (const c of hot!.consumers) {
      expect(['gallery_bucket']).toContain(c);
    }
  });

  it('every signal declares neverAffectsStanding === true', () => {
    const out = deriveDerivedObservationSignals(richInput());
    for (const s of out) expect(s.neverAffectsStanding).toBe(true);
  });

  it('FIRING NEGATIVE CONTROL — heat alone (no open debt) produces NO signal', () => {
    const N = node({ argumentId: 'N', ordinal: 0, branchRootId: 'N' });
    const out = deriveDerivedObservationSignals(baseInput({ nodes: [N], heatBand: 'hot' }));
    expect(out).toEqual([]);
  });

  it('FIRING NEGATIVE CONTROL — the gate really requires the debt', () => {
    const N = node({ argumentId: 'N', ordinal: 0, branchRootId: 'N' });
    const withDebt = deriveDerivedObservationSignals(
      baseInput({
        nodes: [N],
        heatBand: 'hot',
        evidenceDebts: [debt({ nodeId: 'N', status: 'requested', debtKind: 'source' })],
      }),
    );
    expect(withDebt.map((s) => s.code)).toContain('hot_but_proof_light');
  });
});

describe('FEEDBACK-002 — the consumer enum is standing-free', () => {
  it('the DerivedSignalConsumer union in source has no standing/score/credit/band/verdict token', () => {
    // Extract the union text and scan it. A standing consumer would be a
    // doctrine violation the type system is meant to forbid.
    const match = MODULE_SRC.match(/export type DerivedSignalConsumer =([\s\S]*?);/);
    expect(match).not.toBeNull();
    const unionText = match![1];
    expect(/stand|score|credit|band|win|verdict/i.test(unionText)).toBe(false);
  });

  it('the module value-imports nothing from pointStanding', () => {
    expect(/from\s+['"][^'"]*pointStanding[^'"]*['"]/.test(MODULE_SRC)).toBe(false);
  });

  it('no signal object carries a standing/score/weight field', () => {
    const out = deriveDerivedObservationSignals(richInput());
    for (const s of out) {
      const keys = Object.keys(s);
      expect(keys).not.toContain('score');
      expect(keys).not.toContain('weight');
      expect(keys).not.toContain('standing');
      expect(keys).not.toContain('broadStandingDelta');
      expect(keys).not.toContain('narrowStandingDelta');
    }
  });
});
