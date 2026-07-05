/**
 * RESEED-001 — voice rotation is PER THREAD, not per account.
 * The same bot pool is fixed; the voice a bot uses changes thread to thread.
 */
const { planPack, voiceForThread, VOICES } = require('../scripts/reseeder/reseedPackPlanner');

const BANK = [
  { bankName: 'a::debate.org::0001', topic: 'topic a', stance: 'PRO', premise: 'Topic A premise with enough words to render a body that clears the length floor comfortably here.', conclusion: 'topic a', sourceUrl: null, license: 'CC-BY-4.0', sourceId: 'A', fetchedAt: '2026-07-05T00:00:00Z', ingestMode: 'args_me_live' },
  { bankName: 'b::debate.org::0002', topic: 'topic b', stance: 'CON', premise: 'Topic B premise with enough words to render a body that clears the length floor comfortably here.', conclusion: 'topic b', sourceUrl: null, license: 'CC-BY-4.0', sourceId: 'B', fetchedAt: '2026-07-05T00:00:00Z', ingestMode: 'args_me_live' },
];

describe('voice rotation', () => {
  it('rotates over >= 2 distinct voices across enough threads', () => {
    const { scenarios } = planPack({ pack: 'baseline', count: 8, seed: 'vr', runId: 'run', bank: BANK });
    const voices = new Set(scenarios.map((s: { moves: Array<{ voiceId: string }> }) => s.moves[0].voiceId));
    expect(voices.size).toBeGreaterThanOrEqual(2);
    for (const v of voices) expect(VOICES).toContain(v);
  });

  it('keeps a single stable voice WITHIN one thread', () => {
    const { scenarios } = planPack({ pack: 'deep-thread', count: 4, seed: 'vr', runId: 'run', bank: BANK });
    for (const sc of scenarios) {
      const threadVoices = new Set(sc.moves.map((m: { voiceId: string }) => m.voiceId));
      expect(threadVoices.size).toBe(1);
    }
  });

  it('voiceForThread is deterministic and drawn from the fixed pool', () => {
    const v0 = voiceForThread('run', 'vr', 0);
    const v0again = voiceForThread('run', 'vr', 0);
    expect(v0).toBe(v0again);
    expect(VOICES).toContain(v0);
  });

  it('voice is a function of thread index, not of a fixed 3-bot account', () => {
    // Across many threads the voice must not be pinned to one constant value.
    const seen = new Set<string>();
    for (let t = 0; t < 12; t++) seen.add(voiceForThread('run', 'vr', t));
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });
});
