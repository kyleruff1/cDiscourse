/**
 * RESEED-001 — archive-cluster near-verbatim clustering.
 *   - at least one sibling pair with Jaccard >= NEAR_VERBATIM_THRESHOLD (0.60)
 *   - twin-equality: NEAR_VERBATIM_THRESHOLD === xaiAdversarialReport's
 *     SAMEY_MOVE_HIGH_PAIR_THRESHOLD (pinned by SOURCE-SCAN — the source
 *     constant is module-private; rg is unreliable here, so we use Node fs).
 *   - feeding the cluster's move_body_sample events to reseedDiversityChecks
 *     yields nearVerbatimCluster.severityBand !== 'green' (it fires).
 */
const fs = require('node:fs');
const path = require('node:path');
const { planPack } = require('../scripts/reseeder/reseedPackPlanner');
const { tokenSetJaccard, NEAR_VERBATIM_THRESHOLD } = require('../scripts/reseeder/reseedJaccard');
const { reseedDiversityChecks } = require('../scripts/reseeder/reseedReport');

const BANK = [
  { bankName: 'school-uniforms::debate.org::0007', topic: 'school uniforms', stance: 'PRO', premise: 'School uniforms reduce peer pressure over clothing and let students focus on learning rather than appearance across the school day for every student.', conclusion: 'school uniforms', sourceUrl: null, license: 'CC-BY-4.0', sourceId: 'S1', fetchedAt: '2026-07-05T00:00:00Z', ingestMode: 'args_me_live' },
  { bankName: 'nuclear-energy::debate.org::0009', topic: 'nuclear energy', stance: 'CON', premise: 'Nuclear energy carries long-term waste-storage risks that span thousands of years across many generations of storage.', conclusion: 'nuclear energy', sourceUrl: null, license: 'CC-BY-4.0', sourceId: 'S2', fetchedAt: '2026-07-05T00:00:00Z', ingestMode: 'args_me_live' },
];

describe('archive-cluster jaccard', () => {
  it('produces at least one sibling pair with Jaccard >= NEAR_VERBATIM_THRESHOLD', () => {
    const { scenarios } = planPack({ pack: 'archive-cluster', count: 1, seed: 'ac', runId: 'run', bank: BANK });
    const claims = scenarios[0].moves.filter((m: { argumentType: string; body: string }) => m.argumentType === 'claim').map((m: { body: string }) => m.body);
    let maxJ = 0;
    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        maxJ = Math.max(maxJ, tokenSetJaccard(claims[i], claims[j]));
      }
    }
    expect(maxJ).toBeGreaterThanOrEqual(NEAR_VERBATIM_THRESHOLD);
  });

  it('NEAR_VERBATIM_THRESHOLD is twin-equal to xaiAdversarialReport SAMEY_MOVE_HIGH_PAIR_THRESHOLD (source-scan)', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'bot-fixtures', 'xaiAdversarialReport.js'),
      'utf8',
    );
    const m = src.match(/SAMEY_MOVE_HIGH_PAIR_THRESHOLD\s*=\s*([0-9.]+)/);
    expect(m).not.toBeNull();
    const sourceValue = parseFloat(m[1]);
    expect(NEAR_VERBATIM_THRESHOLD).toBeCloseTo(sourceValue, 10);
  });

  it('reseedDiversityChecks nearVerbatimCluster fires (band !== green) on the cluster body samples', () => {
    // Build a >=50-sample body stream from several archive-cluster threads so
    // the sample floor is met AND the near-verbatim pairs are present.
    const { scenarios } = planPack({ pack: 'archive-cluster', count: 10, seed: 'ac', runId: 'run', bank: BANK });
    const events: Array<Record<string, unknown>> = [];
    for (const sc of scenarios) {
      for (const mv of sc.moves) {
        events.push({
          stage: 'move_body_sample',
          seedId: mv.seedId,
          threadIndex: mv.threadIndex,
          spineId: mv.spineId,
          voiceId: mv.voiceId,
          bankName: mv.bankName,
          optionIndex: mv.optionIndex,
          moveId: mv.moveId,
          bodySample: mv.body,
        });
      }
    }
    expect(events.length).toBeGreaterThanOrEqual(50);
    const checks = reseedDiversityChecks(events);
    expect(checks.nearVerbatimCluster.severityBand).not.toBe('green');
    expect(checks.nearVerbatimCluster.severityBand).not.toBe('n/a');
    expect(checks.nearVerbatimCluster.highPairs).toBeGreaterThan(0);
  });
});
