/**
 * Engagement corpus — unit tests.
 *
 * Validates decision-trace classifiers, room scoring, redaction, and the
 * single-file Markdown corpus that runStressBatch emits in --corpus mode.
 */
import * as path from 'path';

const repoRoot = process.cwd();

const corpus = require(path.join(repoRoot, 'scripts/bot-fixtures/engagementCorpus.js'));
const generator = require(path.join(repoRoot, 'scripts/bot-fixtures/generateStressScenarios.js'));

type CorpusMove = {
  moveId: string;
  authorAlias: string;
  parentMoveId: string | null;
  moveKind: string;
  argumentType: string;
  disagreementAxis?: string | null;
  targetExcerpt?: string | null;
  body: string;
  selectedTagCodes: string[];
  evidence?: { label?: string; sourceText?: string } | null;
  expectedStatus?: string;
  expectedRestingStatus?: string | null;
  expectedClaimStanding?: string | null;
  displayMeta?: { branchCandidate?: boolean; playfulLabel?: string };
};

type CorpusScenario = {
  scenarioId: string;
  title: string;
  resolution: string;
  category: string;
  personas: { alias: string; side: string; tone?: string }[];
  moves: CorpusMove[];
  stressMeta?: { templateId?: string; topicId?: string };
};

function makeBasicScenario(): CorpusScenario {
  return {
    scenarioId: 'unit-test-1',
    title: 'magpies',
    resolution: 'magpies group murder crows',
    category: 'animal_taxonomy_weird',
    personas: [
      { alias: 'Alex', side: 'affirmative' },
      { alias: 'Jordan', side: 'negative' },
      { alias: 'Sam', side: 'neutral' },
    ],
    moves: [
      { moveId: 'm1', authorAlias: 'Alex', parentMoveId: null, moveKind: 'start_thesis', argumentType: 'thesis', body: 'magpies group murder crows opener.', selectedTagCodes: [] },
      { moveId: 'm2', authorAlias: 'Jordan', parentMoveId: 'm1', moveKind: 'challenge_parent', argumentType: 'rebuttal', disagreementAxis: 'scope', targetExcerpt: 'magpies group', body: 'Wrong scope. magpies group murder crows is too broad.', selectedTagCodes: [] },
    ],
  };
}

describe('engagementCorpus — classifiers', () => {
  it('classifies thesis as plant_claim', () => {
    expect(corpus.classifyDecisionIntent({ argumentType: 'thesis' })).toBe('plant_claim');
  });

  it('classifies branch-candidate as branch_tangent regardless of type', () => {
    expect(corpus.classifyDecisionIntent({ argumentType: 'claim', displayMeta: { branchCandidate: true } })).toBe('branch_tangent');
  });

  it('classifies rebuttal by axis', () => {
    expect(corpus.classifyDecisionIntent({ argumentType: 'rebuttal', disagreementAxis: 'scope' })).toBe('challenge_scope');
    expect(corpus.classifyDecisionIntent({ argumentType: 'rebuttal', disagreementAxis: 'fact' })).toBe('challenge_fact');
    expect(corpus.classifyDecisionIntent({ argumentType: 'counter_rebuttal', disagreementAxis: 'logic' })).toBe('challenge_logic');
  });

  it('classifies clarification by body keywords', () => {
    expect(corpus.classifyDecisionIntent({ argumentType: 'clarification_request', body: 'Quote the exact bit please.' })).toBe('quote_exact_bit');
    expect(corpus.classifyDecisionIntent({ argumentType: 'clarification_request', body: 'Receipts, please. Where is this source from?' })).toBe('request_receipts');
  });

  it('classifies evidence/concession/synthesis', () => {
    expect(corpus.classifyDecisionIntent({ argumentType: 'evidence', body: 'x' })).toBe('drop_receipts');
    expect(corpus.classifyDecisionIntent({ argumentType: 'concession', body: 'I grant narrow point' })).toBe('narrow_dispute');
    expect(corpus.classifyDecisionIntent({ argumentType: 'concession', body: 'I concede the small point' })).toBe('concede_small_point');
    expect(corpus.classifyDecisionIntent({ argumentType: 'synthesis', body: 'I acknowledge both sides' })).toBe('synthesize_thread');
  });

  it('spice level reflects sharp tokens', () => {
    expect(corpus.classifySpiceLevel({ body: 'That is a vibes-only claim.' })).toBe('hot');
    expect(corpus.classifySpiceLevel({ body: 'Receipts, please.' })).toBe('medium');
    expect(corpus.classifySpiceLevel({ body: 'A plain factual claim about magpies.' })).toBe('mild');
  });

  it('specificity rewards targetExcerpt and numbers/quotes', () => {
    expect(corpus.classifySpecificity({ targetExcerpt: 'the exact phrase' })).toBe('specific');
    expect(corpus.classifySpecificity({ body: 'Roughly 38% of teams agreed.' })).toBe('medium');
    expect(corpus.classifySpecificity({ body: 'A claim about pigeons.' })).toBe('vague');
  });

  it('pressure reflects argument type', () => {
    expect(corpus.estimatePressureApplied({ argumentType: 'rebuttal' })).toBe('high');
    expect(corpus.estimatePressureApplied({ argumentType: 'evidence' })).toBe('medium');
    expect(corpus.estimatePressureApplied({ argumentType: 'thesis' })).toBe('low');
  });

  it('getBotLane maps persona side', () => {
    expect(corpus.getBotLane('affirmative')).toBe('provocateur');
    expect(corpus.getBotLane('negative')).toBe('revocateur');
    expect(corpus.getBotLane('neutral')).toBe('synthesizer');
  });
});

describe('engagementCorpus — redaction', () => {
  it('redacts email addresses', () => {
    const out = corpus.redactCorpusText('Contact alice@example.com please.');
    expect(out).not.toContain('alice@example.com');
    expect(out).toContain('<email>');
  });

  it('redacts JWT-shaped tokens', () => {
    const out = corpus.redactCorpusText('token=eyJabcdefghij.eyJhbGciOiJI');
    expect(out).toContain('[redacted]');
    expect(out).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });

  it('redacts Supabase secret keys', () => {
    const out = corpus.redactCorpusText('key=sb_secret_abc123def456');
    expect(out).toContain('[redacted]');
  });

  it('redacts password= lines', () => {
    const out = corpus.redactCorpusText('CDISCOURSE_BOT_A_PASSWORD=Tr0ub4dor!ZzZ');
    expect(out).not.toContain('Tr0ub4dor!ZzZ');
    expect(out).toContain('[redacted]');
  });
});

describe('engagementCorpus — buildDecisionTraceForMove', () => {
  it('returns intent, whyThisMove, whyThisParent, expectedCounter', () => {
    const s = makeBasicScenario();
    const trace = corpus.buildDecisionTraceForMove(s, s.moves[1], s.moves[0]);
    expect(trace.decisionIntent).toBe('challenge_scope');
    expect(typeof trace.whyThisMove).toBe('string');
    expect(trace.whyThisMove.length).toBeGreaterThan(0);
    expect(typeof trace.whyThisParent).toBe('string');
    expect(typeof trace.expectedCounter).toBe('string');
    expect(['low', 'medium', 'high']).toContain(trace.pressureApplied);
    expect(['mild', 'medium', 'hot']).toContain(trace.spiceLevel);
    expect(['vague', 'medium', 'specific']).toContain(trace.specificity);
  });
});

describe('engagementCorpus — scoreRoomEngagement', () => {
  it('returns 8 numeric scores and an average', () => {
    const s = makeBasicScenario();
    const res = corpus.scoreRoomEngagement(s, []);
    expect(Object.keys(res.scores).length).toBe(8);
    for (const v of Object.values(res.scores)) {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(5);
    }
    expect(typeof res.average).toBe('number');
    expect(typeof res.recommendedTune).toBe('string');
  });
});

describe('engagementCorpus — Markdown corpus builder', () => {
  // Isolated dir so this suite doesn't race the stressGenerator suite.
  const TEMP_DIR = path.join(repoRoot, 'fixtures', 'generated-scenarios-corpus-test');

  beforeAll(() => {
    const fsMod = require('fs');
    if (fsMod.existsSync(TEMP_DIR)) {
      for (const f of fsMod.readdirSync(TEMP_DIR)) fsMod.unlinkSync(path.join(TEMP_DIR, f));
    }
    generator.generate({ count: 10, seed: 'corpus-test-2026', outputDir: TEMP_DIR });
  });

  afterAll(() => {
    const fsMod = require('fs');
    if (fsMod.existsSync(TEMP_DIR)) {
      for (const f of fsMod.readdirSync(TEMP_DIR)) fsMod.unlinkSync(path.join(TEMP_DIR, f));
      try { fsMod.rmdirSync(TEMP_DIR); } catch { /* ignore */ }
    }
  });

  function loadTen() {
    const fs = require('fs');
    return fs
      .readdirSync(TEMP_DIR)
      .filter((f: string) => f.endsWith('.json'))
      .sort()
      .map((f: string) => JSON.parse(fs.readFileSync(path.join(TEMP_DIR, f), 'utf8')));
  }

  it('writes a single markdown that contains all rooms', () => {
    const scenarios = loadTen();
    const md = corpus.buildEngagementCorpusMarkdown({
      runId: 'unit-1', dateIso: '2026-05-17T00:00:00Z', mode: 'dry',
      scenarios,
      roomResults: scenarios.map(() => ({ roomId: null, results: [] })),
    });
    for (let i = 1; i <= scenarios.length; i++) {
      expect(md).toContain(`# Room ${String(i).padStart(2, '0')} of ${scenarios.length}`);
    }
  });

  it('includes full move bodies', () => {
    const scenarios = loadTen().slice(0, 3);
    const md = corpus.buildEngagementCorpusMarkdown({
      runId: 'unit-2', dateIso: '2026-05-17T00:00:00Z', mode: 'dry',
      scenarios,
      roomResults: scenarios.map(() => ({ roomId: null, results: [] })),
    });
    for (const s of scenarios) {
      for (const m of s.moves) {
        // Body lines are quoted with "> "
        const snippet = m.body.slice(0, 30);
        expect(md).toContain(snippet);
      }
    }
  });

  it('includes decisionIntent, whyThisMove, expectedCounter for every move', () => {
    const scenarios = loadTen().slice(0, 2);
    const md = corpus.buildEngagementCorpusMarkdown({
      runId: 'unit-3', dateIso: '2026-05-17T00:00:00Z', mode: 'dry',
      scenarios,
      roomResults: scenarios.map(() => ({ roomId: null, results: [] })),
    });
    const totalMoves = scenarios.reduce((acc: number, s: CorpusScenario) => acc + s.moves.length, 0);
    const intentMatches = (md.match(/decisionIntent:/g) || []).length;
    const whyMatches = (md.match(/whyThisMove:/g) || []).length;
    const counterMatches = (md.match(/expectedCounter:/g) || []).length;
    expect(intentMatches).toBe(totalMoves);
    expect(whyMatches).toBe(totalMoves);
    expect(counterMatches).toBe(totalMoves);
  });

  it('includes per-room engagement score tables and Recommended tune', () => {
    const scenarios = loadTen().slice(0, 3);
    const md = corpus.buildEngagementCorpusMarkdown({
      runId: 'unit-4', dateIso: '2026-05-17T00:00:00Z', mode: 'dry',
      scenarios,
      roomResults: scenarios.map(() => ({ roomId: null, results: [] })),
    });
    expect((md.match(/### Room engagement scores/g) || []).length).toBe(scenarios.length);
    expect((md.match(/\*\*Recommended tune:\*\*/g) || []).length).toBe(scenarios.length);
  });

  it('dry mode writes "planned" status, not posted', () => {
    const scenarios = loadTen().slice(0, 2);
    const md = corpus.buildEngagementCorpusMarkdown({
      runId: 'unit-5', dateIso: '2026-05-17T00:00:00Z', mode: 'dry',
      scenarios,
      roomResults: scenarios.map(() => ({ roomId: null, results: [] })),
    });
    expect(md).toContain('`planned`');
    expect(md).not.toMatch(/`posted \(HTTP/);
  });

  it('live mode reflects posted statuses', () => {
    const scenarios = loadTen().slice(0, 1);
    const md = corpus.buildEngagementCorpusMarkdown({
      runId: 'unit-6', dateIso: '2026-05-17T00:00:00Z', mode: 'live',
      scenarios,
      roomResults: [{ roomId: 'room-1', results: scenarios[0].moves.map((m: CorpusMove) => ({ moveId: m.moveId, actualStatus: 'posted', httpStatus: 201, argumentId: `arg-${m.moveId}` })) }],
    });
    expect(md).toContain('posted (HTTP 201)');
  });

  it('does not leak emails, JWTs, sb_secret_, password values', () => {
    const scenarios: CorpusScenario[] = [
      {
        scenarioId: 'leak-test',
        title: 'leak test',
        resolution: 'leak test resolution',
        category: 'everyday',
        personas: [{ alias: 'Alex', side: 'affirmative' }],
        moves: [{
          moveId: 'm1',
          authorAlias: 'Alex',
          parentMoveId: null,
          moveKind: 'start_thesis',
          argumentType: 'thesis',
          body: 'Hot take. Contact bob@example.com with token eyJabcdefghij.eyJhbGciOiJI and password=Sup3r$ecret!',
          selectedTagCodes: [],
        }],
      },
    ];
    const md = corpus.buildEngagementCorpusMarkdown({
      runId: 'unit-leak', dateIso: '2026-05-17T00:00:00Z', mode: 'dry',
      scenarios,
      roomResults: [{ roomId: null, results: [] }],
    });
    expect(md).not.toContain('bob@example.com');
    expect(md).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(md).not.toContain('Sup3r$ecret!');
    expect(md).toContain('<email>');
    expect(md).toContain('[redacted]');
  });

  it('no body contains forbidden person-attack phrases', () => {
    const scenarios = loadTen();
    const md = corpus.buildEngagementCorpusMarkdown({
      runId: 'unit-forbidden', dateIso: '2026-05-17T00:00:00Z', mode: 'dry',
      scenarios,
      roomResults: scenarios.map(() => ({ roomId: null, results: [] })),
    }).toLowerCase();
    for (const term of ['liar', 'bad faith', 'manipulative', 'dishonest', 'you are stupid', 'you are dumb']) {
      expect(md).not.toContain(term);
    }
  });

  it('no body uses "winner" or "loser" as system status', () => {
    const scenarios = loadTen();
    const md = corpus.buildEngagementCorpusMarkdown({
      runId: 'unit-status', dateIso: '2026-05-17T00:00:00Z', mode: 'dry',
      scenarios,
      roomResults: scenarios.map(() => ({ roomId: null, results: [] })),
    }).toLowerCase();
    expect(md).not.toMatch(/\bwinner\b/);
    expect(md).not.toMatch(/\bloser\b/);
  });

  it('deterministic: same seed produces the same corpus markdown', () => {
    const fs = require('fs');
    const localDir = path.join(repoRoot, 'fixtures', 'generated-scenarios-corpus-det-test');
    if (fs.existsSync(localDir)) for (const f of fs.readdirSync(localDir)) fs.unlinkSync(path.join(localDir, f));
    generator.generate({ count: 5, seed: 'corpus-determinism-seed', outputDir: localDir });
    const load = () => fs.readdirSync(localDir).filter((f: string) => f.endsWith('.json')).sort().map((f: string) => JSON.parse(fs.readFileSync(path.join(localDir, f), 'utf8')));
    const a = corpus.buildEngagementCorpusMarkdown({
      runId: 'det-A', dateIso: '2026-05-17T00:00:00Z', mode: 'dry',
      scenarios: load(),
      roomResults: load().map(() => ({ roomId: null, results: [] })),
    });
    generator.generate({ count: 5, seed: 'corpus-determinism-seed', outputDir: localDir });
    const b = corpus.buildEngagementCorpusMarkdown({
      runId: 'det-A', dateIso: '2026-05-17T00:00:00Z', mode: 'dry',
      scenarios: load(),
      roomResults: load().map(() => ({ roomId: null, results: [] })),
    });
    // Cleanup
    if (fs.existsSync(localDir)) {
      for (const f of fs.readdirSync(localDir)) fs.unlinkSync(path.join(localDir, f));
      try { fs.rmdirSync(localDir); } catch { /* ignore */ }
    }
    expect(a).toBe(b);
  });

  it('every template instantiation includes at least one of each required move kind across the corpus', () => {
    const scenarios = loadTen();
    const seenKinds = new Set<string>();
    for (const s of scenarios) {
      for (const m of s.moves) seenKinds.add(m.moveKind);
    }
    for (const required of ['challenge_parent', 'ask_clarification', 'add_evidence', 'concede_or_narrow', 'synthesize_thread']) {
      expect(seenKinds.has(required)).toBe(true);
    }
  });

  it('JSONL events are safe and structured', () => {
    const scenarios = loadTen().slice(0, 2);
    const events = corpus.buildEngagementCorpusJsonlEvents({
      runId: 'unit-jsonl', dateIso: '2026-05-17T00:00:00Z', mode: 'dry',
      scenarios,
      roomResults: scenarios.map(() => ({ roomId: null, results: [] })),
    });
    expect(events.length).toBe(scenarios.reduce((a: number, s: CorpusScenario) => a + s.moves.length, 0));
    for (const e of events) {
      expect(typeof e.scenarioId).toBe('string');
      expect(typeof e.moveId).toBe('string');
      expect(typeof e.decisionIntent).toBe('string');
      // No raw email-shape strings anywhere in the event
      const json = JSON.stringify(e);
      expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      expect(json).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    }
  });
});
