/**
 * CORPUS-30-POOL-DRIVEN-PLANNER §10: bank-floor enforcement.
 */
import fs from 'node:fs';
import path from 'node:path';

const builder = require('../scripts/bot-fixtures/xaiAdversarialOptionBankBuilder');
const { BANK_FLOORS, ALL_BANK_NAMES } = require('../scripts/bot-fixtures/corpusPoolDrivenPlannerConstants');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANONICAL = path.join(REPO_ROOT, 'fixtures', 'bot-fixtures', 'option-bank-builder-canonical.json');

type AnyObj = Record<string, unknown>;

describe('CORPUS-30 option-bank builder — bank-floor enforcement', () => {
  it('canonical fixture produces seeds matching §4.2 minima for both rich and sparse scenarios', () => {
    const fx = JSON.parse(fs.readFileSync(CANONICAL, 'utf8'));
    const seeds = fx.events.map((e: AnyObj) => builder.buildSeedFromScenarioEvent(e)).filter(Boolean);
    expect(seeds.length).toBe(2);
    for (const seed of seeds) {
      // Every bank must meet (or exceed) its floor; mass-template generators
      // ensure that even the sparse scenario produces full banks.
      for (const name of ALL_BANK_NAMES) {
        const arr = seed.banks[name];
        expect(Array.isArray(arr)).toBe(true);
        expect(arr.length).toBeGreaterThanOrEqual((BANK_FLOORS as Record<string, number>)[name]);
      }
    }
  });

  it('marks bankShortfall=false when all banks meet their floor', () => {
    const fx = JSON.parse(fs.readFileSync(CANONICAL, 'utf8'));
    const seeds = fx.events.map((e: AnyObj) => builder.buildSeedFromScenarioEvent(e));
    for (const seed of seeds) {
      expect(seed.bankShortfall).toBe(false);
    }
  });

  it('handles a degenerate scenario_build with no candidateReplies + no selectedDissent (synthetic templates only)', () => {
    const seed = builder.buildSeedFromScenarioEvent({
      stage: 'scenario_build',
      sourcePost: { redactedText: 'A claim.', issueFrame: 'unknown' },
      sourceHash: 'h',
      candidateReplies: [],
      selectedDissent: null,
    });
    expect(seed).toBeTruthy();
    // Synthetic-default templates + paraphrase rules must still hit floors for
    // 5 of 6 banks; objection_options floor is 4, and the templates section
    // contributes 4; alternative_explanation contributes 3; etc.
    for (const name of ['opening_claim_options', 'evidence_pressure_options', 'alternative_explanation_options', 'concession_or_narrowing_options', 'resolution_pressure_options']) {
      const arr = seed.banks[name as string];
      expect(arr.length).toBeGreaterThanOrEqual((BANK_FLOORS as Record<string, number>)[name as string]);
    }
  });
});
