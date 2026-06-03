/**
 * CORPUS-30-POOL-DRIVEN-PLANNER §10: voiceId + spineId determinism + no-repeat-prior.
 */
const planner = require('../scripts/bot-fixtures/corpusPoolDrivenPlanner');
const { VOICES, SPINES } = require('../scripts/bot-fixtures/corpusPoolDrivenPlannerConstants');

describe('CORPUS-30 voice / spine assignment', () => {
  it('voiceId is deterministic on (runId, botUserId)', () => {
    const v1 = planner.assignVoiceId('runA', 'bot-x');
    const v2 = planner.assignVoiceId('runA', 'bot-x');
    expect(v1).toBe(v2);
    expect(VOICES).toContain(v1);
  });

  it('voiceId differs across bots in the same run (overwhelmingly)', () => {
    const voices = new Set<string>();
    for (let i = 0; i < 24; i++) voices.add(planner.assignVoiceId('runA', `bot-${i}`));
    expect(voices.size).toBeGreaterThan(1);
  });

  it('spineId is deterministic on (runId, threadIndex, moveIndex)', () => {
    const s1 = planner.assignSpineId('runA', 3, 5, null);
    const s2 = planner.assignSpineId('runA', 3, 5, null);
    expect(s1).toBe(s2);
    expect(SPINES).toContain(s1);
  });

  it('spineId(t, m) !== spineId(t, m-1) (no-repeat-prior constraint)', () => {
    for (let t = 0; t < 30; t++) {
      let prev: string | null = null;
      for (let m = 1; m <= 10; m++) {
        const s: string = planner.assignSpineId('runA', t, m, prev);
        if (prev !== null) expect(s).not.toBe(prev);
        prev = s;
      }
    }
  });

  it('assignVoiceId throws on empty inputs', () => {
    expect(() => planner.assignVoiceId('', 'bot-x')).toThrow();
    expect(() => planner.assignVoiceId('runA', '')).toThrow();
  });

  it('assignSpineId throws on bad indices', () => {
    expect(() => planner.assignSpineId('runA', -1, 1, null)).toThrow();
    expect(() => planner.assignSpineId('runA', 0, 0, null)).toThrow();
  });
});
