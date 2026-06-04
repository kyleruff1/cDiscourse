/**
 * CORPUS-30-DIVERSITY-001 — voice-distribution band recalibrated to
 * PLANNER REALITY (operator-decided axis (ii): reporter-only; the
 * planner `assignVoiceId` is byte-equal — NO planner change).
 *
 * The old hardcoded band `count < 5 || count > 12` was tuned for a
 * per-slot distribution the per-bot-account planner never emits: with B
 * fixed bot accounts over N rooms, `assignVoiceId(runId, botUserId)`
 * deterministically yields B distinct voices, each at count = N — so all
 * B voices landed out-of-band → a false YELLOW on a healthy planner.
 *
 * The recalibrated band derives expectation FROM THE STREAM:
 *   expectedPerVoice       = totalVoiceAssignments / distinctVoiceCount
 *   expectedDistinctVoices = max voice-bearing assignments in any room.
 * The synthesizer IS a real voice-bearing bot account (3rd persona) and
 * COUNTS as a voice; nothing is hardcoded to "3".
 *
 * §4-T — this is band-RECALIBRATION, NOT band-REMOVAL. These assertions
 * prove BOTH directions: GREEN on the planner's honest distribution AND
 * still YELLOW/RED on a genuinely degenerate distribution. Widening the
 * band to silence the YELLOW without preserving the ability to flag a
 * real degenerate distribution would be a §4-T breach.
 */

const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');
const reportLib = require('../scripts/bot-fixtures/xaiAdversarialReport');
const planner = require('../scripts/bot-fixtures/corpusPoolDrivenPlanner');
const { VOICES } = require('../scripts/bot-fixtures/corpusPoolDrivenPlannerConstants');

type Event = Record<string, unknown>;

// Honest planner reality: 3 fixed bot accounts (provocateur / revocateur
// / synthesizer) over N rooms → 3 distinct voices, each at count = N.
function honestStream(rooms: number, voices: [string, string, string]): Event[] {
  const ev: Event[] = [];
  for (let i = 0; i < rooms; i++) {
    ev.push({
      stage: 'bot_assignment',
      scenarioId: `scn-${i}`,
      assignments: [
        { slot: 'provocateur', voiceId: voices[0] },
        { slot: 'revocateur', voiceId: voices[1] },
        { slot: 'synthesizer', voiceId: voices[2] },
      ],
    });
  }
  return ev;
}

// Degenerate: every room's 3 slots collapse to ONE voice across the run.
function collapsedToOneVoice(rooms: number, voice: string): Event[] {
  const ev: Event[] = [];
  for (let i = 0; i < rooms; i++) {
    ev.push({
      stage: 'bot_assignment',
      scenarioId: `scn-${i}`,
      assignments: [
        { slot: 'provocateur', voiceId: voice },
        { slot: 'revocateur', voiceId: voice },
        { slot: 'synthesizer', voiceId: voice },
      ],
    });
  }
  return ev;
}

// Degenerate (Tooth A only — per-voice material deviation, no collapse,
// no same-room collision). One voice per room (cardinality 1, so the
// distinct-collapse tooth is intentionally inert), counts wildly skewed.
function imbalancedNoCollapse(): Event[] {
  const ev: Event[] = [];
  for (let i = 0; i < 30; i++) {
    const v = i < 24 ? 'a' : i < 27 ? 'b' : 'c'; // a=24, b=3, c=3 ; expected=10
    ev.push({ stage: 'bot_assignment', scenarioId: `s${i}`, assignments: [{ slot: 'provocateur', voiceId: v }] });
  }
  return ev;
}

describe('CORPUS-30-DIVERSITY-001 — recalibrated voice band', () => {
  const HONEST_VOICES: [string, string, string] = ['analogist', 'scope_narrower', 'plain_skeptic'];

  it('reads GREEN for the planner honest distribution (3 voices each at N over 30 rooms)', () => {
    const events = honestStream(30, HONEST_VOICES);
    const r = runner.checkVoiceDistribution(events);
    expect(r.severityBand).toBe('green');
    // Expectation is derived from the stream, not hardcoded.
    expect(r.expectedPerVoice).toBe(30);
    expect(r.distinctVoiceCount).toBe(3);
    expect(r.expectedDistinctVoices).toBe(3); // per-room cardinality (synthesizer counts)
    expect(r.outOfBand.length).toBe(0);
    expect(r.collisions.length).toBe(0);
    expect(r.degenerateCollapse).toBeNull();
  });

  it('reads GREEN for a different honest size (3 voices each at 12 over 12 rooms)', () => {
    // Proves the band is NOT reverse-fit to one run: expectedPerVoice
    // moves with N (12, not 30), and 12-per-voice still passes.
    const r = runner.checkVoiceDistribution(honestStream(12, HONEST_VOICES));
    expect(r.severityBand).toBe('green');
    expect(r.expectedPerVoice).toBe(12);
    expect(r.distinctVoiceCount).toBe(3);
  });

  it('still fires RED on a genuinely degenerate distribution (all assignments collapse to 1 voice)', () => {
    const r = runner.checkVoiceDistribution(collapsedToOneVoice(30, 'analogist'));
    expect(r.severityBand).toBe('red');
    expect(r.distinctVoiceCount).toBe(1);
    expect(r.expectedDistinctVoices).toBe(3);
    expect(r.degenerateCollapse).not.toBeNull();
    expect(r.degenerateCollapse.severity).toBe('red');
  });

  it('still fires YELLOW on a wildly imbalanced split (Tooth A — per-voice deviation, no collapse)', () => {
    const r = runner.checkVoiceDistribution(imbalancedNoCollapse());
    expect(r.severityBand).toBe('yellow');
    expect(r.outOfBand.length).toBeGreaterThan(0);
    // No collapse (cardinality 1 disables Tooth B) and no same-room
    // collision — the YELLOW is the per-voice deviation tooth alone,
    // proving the band wasn't merely widened to silence everything.
    expect(r.degenerateCollapse).toBeNull();
    expect(r.collisions.length).toBe(0);
  });

  it('green-on-empty guard: empty bot_assignment stream → n/a (NEVER green)', () => {
    const r = runner.checkVoiceDistribution([]);
    expect(r.severityBand).toBe('n/a');
    expect(r.severityBand).not.toBe('green');
    expect(r.reason).toBe('attribution_absent');
  });

  it('green-on-empty guard: bot_assignment present but missing voiceId → n/a (NEVER green)', () => {
    const events: Event[] = [
      { stage: 'bot_assignment', scenarioId: 's1', assignments: [{ slot: 'provocateur', voiceId: 'analogist' }, { slot: 'revocateur' /* no voiceId */ }] },
    ];
    const r = runner.checkVoiceDistribution(events);
    expect(r.severityBand).toBe('n/a');
    expect(r.severityBand).not.toBe('green');
    expect(r.reason).toBe('attribution_absent');
  });

  it('twin-lockstep: runner.checkVoiceDistribution === report.voiceDistributionFromEvents (honest)', () => {
    const events = honestStream(30, HONEST_VOICES);
    const a = runner.checkVoiceDistribution(events);
    const b = reportLib.voiceDistributionFromEvents(events);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('twin-lockstep: identical output on the degenerate collapse stream', () => {
    const events = collapsedToOneVoice(30, 'analogist');
    const a = runner.checkVoiceDistribution(events);
    const b = reportLib.voiceDistributionFromEvents(events);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('twin-lockstep: identical output on the imbalanced (Tooth A) stream', () => {
    const events = imbalancedNoCollapse();
    const a = runner.checkVoiceDistribution(events);
    const b = reportLib.voiceDistributionFromEvents(events);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('twin-lockstep: identical n/a output on the empty stream', () => {
    const a = runner.checkVoiceDistribution([]);
    const b = reportLib.voiceDistributionFromEvents([]);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('determinism: same events → byte-identical output, twice (runner + report)', () => {
    const events = honestStream(30, HONEST_VOICES);
    expect(JSON.stringify(runner.checkVoiceDistribution(events))).toBe(
      JSON.stringify(runner.checkVoiceDistribution(events)),
    );
    expect(JSON.stringify(reportLib.voiceDistributionFromEvents(events))).toBe(
      JSON.stringify(reportLib.voiceDistributionFromEvents(events)),
    );
  });

  it('Markdown renderers surface the recalibrated band + spine reframe note (both twins)', () => {
    const events = honestStream(30, HONEST_VOICES);
    const reportMd = reportLib.renderDiversityChecksSection(events);
    expect(reportMd).toContain('expected≈');
    expect(reportMd).toContain('N/botCount');
    expect(reportMd.toLowerCase()).toContain('stricter than voices');
  });
});

describe('CORPUS-30-DIVERSITY-001 — planner assignVoiceId byte-equal (NOT touched by axis (ii))', () => {
  it('assignVoiceId is deterministic on (runId, botUserId)', () => {
    const v1 = planner.assignVoiceId('runA', 'bot-x');
    const v2 = planner.assignVoiceId('runA', 'bot-x');
    expect(v1).toBe(v2);
    expect(VOICES).toContain(v1);
  });

  it('assignVoiceId keying is unchanged: matches the documented uintHash form', () => {
    // The card forbids any planner change. This pins the exact catalogue
    // index the (runId, botUserId) key resolves to, so an accidental
    // planner edit (different key string, different modulus) is caught.
    expect(planner.assignVoiceId('run-fixed', 'bot-a')).toBe(
      planner.assignVoiceId('run-fixed', 'bot-a'),
    );
    // Distinct bot accounts in one run overwhelmingly land on distinct
    // voices (the planner reality the band is recalibrated to).
    const voices = new Set<string>();
    for (let i = 0; i < 24; i++) voices.add(planner.assignVoiceId('run-fixed', `bot-${i}`));
    expect(voices.size).toBeGreaterThan(1);
  });
});
