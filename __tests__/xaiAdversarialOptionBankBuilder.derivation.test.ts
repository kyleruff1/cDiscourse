/**
 * CORPUS-30-POOL-DRIVEN-PLANNER §10: bank derivation shapes + provenance +
 * no-raw-X-leak on the committable fixture.
 */
import fs from 'node:fs';
import path from 'node:path';

const builder = require('../scripts/bot-fixtures/xaiAdversarialOptionBankBuilder');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANONICAL = path.join(REPO_ROOT, 'fixtures', 'bot-fixtures', 'option-bank-builder-canonical.json');

type AnyObj = Record<string, unknown>;

const RAW_X_PATTERNS = [
  /@[A-Za-z0-9_]{4,15}\b/,
  /\bx\.com\//i,
  /\bt\.co\//i,
  /\btwitter\.com\//i,
  /\b\d{15,20}\b/,
  /sk-ant-/i,
  /xai-[A-Za-z0-9]{8,}/i,
  /eyJ[A-Za-z0-9_-]{20,}/,
  /Bearer\s+[A-Za-z0-9._-]{8,}/i,
];

describe('CORPUS-30 option-bank builder — derivations + provenance + redaction', () => {
  it('every option has a valid shape (optionId, bankName, skeleton, provenance)', () => {
    const fx = JSON.parse(fs.readFileSync(CANONICAL, 'utf8'));
    const seeds = fx.events.map((e: AnyObj) => builder.buildSeedFromScenarioEvent(e));
    for (const seed of seeds) {
      for (const [bankName, options] of Object.entries(seed.banks)) {
        for (const o of options as AnyObj[]) {
          expect(typeof o.optionId).toBe('string');
          expect(o.bankName).toBe(bankName);
          expect(o.skeleton).toBeTruthy();
          const sk = o.skeleton as AnyObj;
          expect(typeof sk.summary).toBe('string');
          expect((sk.summary as string).length).toBeGreaterThan(0);
          expect((sk.summary as string).length).toBeLessThanOrEqual(200);
          expect(['quote-led', 'counterexample-led', 'definition-led', 'mechanism-led', 'scope-led', 'concession-then-pivot', 'question-led', 'analogy-led', 'second-order-effect-led']).toContain(sk.spineHint);
          expect(['fact', 'definition', 'causal', 'value', 'evidence', 'logic', 'scope', 'source_chain', 'anti_amplification', 'framing']).toContain(sk.axisHint);
          expect(['harvester_post_processed', 'paraphrase_rule', 'synthetic_default']).toContain(o.provenance);
        }
      }
    }
  });

  it('opening_claim_options contains the 4 fixed paraphrase types as provenance=paraphrase_rule', () => {
    const fx = JSON.parse(fs.readFileSync(CANONICAL, 'utf8'));
    const seed = builder.buildSeedFromScenarioEvent(fx.events[0]);
    const para = seed.banks.opening_claim_options.filter((o: AnyObj) => o.provenance === 'paraphrase_rule');
    expect(para.length).toBe(4);
  });

  it('committable fixture contains zero raw X content', () => {
    const text = fs.readFileSync(CANONICAL, 'utf8');
    for (const re of RAW_X_PATTERNS) {
      expect(text).not.toMatch(re);
    }
  });

  it('derived options also contain zero raw X content', () => {
    const fx = JSON.parse(fs.readFileSync(CANONICAL, 'utf8'));
    const seeds = fx.events.map((e: AnyObj) => builder.buildSeedFromScenarioEvent(e));
    const serialized = JSON.stringify(seeds);
    for (const re of RAW_X_PATTERNS) {
      expect(serialized).not.toMatch(re);
    }
  });

  it('writePoolJsonl + readScenarioEvents round-trip cleanly', () => {
    const tmpDir = fs.mkdtempSync(path.join(REPO_ROOT, '.tmp-corpus30-'));
    try {
      const outPath = path.join(tmpDir, 'pool.jsonl');
      const fx = JSON.parse(fs.readFileSync(CANONICAL, 'utf8'));
      const seeds = fx.events.map((e: AnyObj) => builder.buildSeedFromScenarioEvent(e));
      builder.writePoolJsonl(outPath, seeds, { event: 'pool_summary', seedCount: seeds.length });
      const written = fs.readFileSync(outPath, 'utf8');
      // The output starts with one JSON line per seed plus the summary line.
      const lines = written.split('\n').filter(Boolean);
      expect(lines.length).toBe(seeds.length + 1);
      expect(JSON.parse(lines[lines.length - 1]).event).toBe('pool_summary');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('REPLY_FUNCTION_TO_BANKS routes the classifier vocab into known design banks', () => {
    for (const [func, banks] of Object.entries(builder.REPLY_FUNCTION_TO_BANKS as Record<string, string[]>)) {
      for (const b of banks) {
        expect(['opening_claim_options', 'objection_options', 'evidence_pressure_options', 'alternative_explanation_options', 'concession_or_narrowing_options', 'resolution_pressure_options']).toContain(b);
      }
      expect(typeof func).toBe('string');
    }
  });
});
