/**
 * Stress generator + stress validator unit tests.
 *
 * Loads the CommonJS bot-fixture modules via require(), generates a batch of
 * scenarios deterministically, and asserts that each one passes the stress
 * validator (transitions, concession markers, forbidden phrases, etc).
 */
import * as path from 'path';
import * as fs from 'fs';
import {
  validateStressScenario,
  ALLOWED_REPLIES,
  CONCESSION_MARKERS,
} from '../src/features/devFixtures/argumentScenarioValidation';
import type { FixtureScenario } from '../src/features/devFixtures/argumentScenarioTypes';

const repoRoot = process.cwd();

const generator = require(path.join(repoRoot, 'scripts/bot-fixtures/generateStressScenarios.js'));
const stressConfig = require(path.join(repoRoot, 'scripts/bot-fixtures/stressConfig.js'));
const spicyLanguage = require(path.join(repoRoot, 'scripts/bot-fixtures/spicyLanguage.js'));
const stressRunner = require(path.join(repoRoot, 'scripts/bot-fixtures/runStressBatch.js'));

describe('stress topic bank', () => {
  it('loads and has at least 6 categories', () => {
    const bank = JSON.parse(fs.readFileSync(stressConfig.TOPIC_BANK_PATH, 'utf8'));
    expect(bank.categories.length).toBeGreaterThanOrEqual(6);
  });

  it('every topic exposes resolutionKeywords, thesisFraming, counterClaims, evidenceFacts', () => {
    const bank = JSON.parse(fs.readFileSync(stressConfig.TOPIC_BANK_PATH, 'utf8'));
    for (const cat of bank.categories) {
      for (const t of cat.topics) {
        expect(Array.isArray(t.resolutionKeywords)).toBe(true);
        expect(typeof t.thesisFraming).toBe('string');
        expect(Array.isArray(t.counterClaims)).toBe(true);
        expect(Array.isArray(t.evidenceFacts)).toBe(true);
        expect(t.evidenceFacts.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('spicy language pool — safety invariants', () => {
  it('exports the forbidden-phrase set', () => {
    expect(Array.isArray(spicyLanguage.FORBIDDEN_PHRASES)).toBe(true);
    expect(spicyLanguage.FORBIDDEN_PHRASES.length).toBeGreaterThan(0);
    expect(spicyLanguage.FORBIDDEN_PHRASES).toEqual(expect.arrayContaining(['liar', 'bad faith', 'winner']));
  });

  it('every spicy challenge phrase attacks the move, not the person', () => {
    const personHostile = [
      'you are stupid', 'you are dumb', 'you are an idiot', 'you are lying',
      'you are dishonest', 'liar',
    ];
    const pools = [
      ...spicyLanguage.REVOCATEUR_CHALLENGES,
      ...spicyLanguage.QUOTE_DEMANDS,
      ...spicyLanguage.RECEIPT_DEMANDS,
      ...spicyLanguage.SCOPE_CHALLENGES,
      ...spicyLanguage.DEFINITION_CHALLENGES,
      ...spicyLanguage.PROVOCATEUR_OPENERS,
      ...spicyLanguage.OBVIOUS_COUNTER_TEEUPS,
      ...spicyLanguage.TANGENT_HOOKS,
      ...spicyLanguage.CONCESSION_NARROWERS,
      ...spicyLanguage.SYNTHESIS_PHRASES,
    ];
    for (const phrase of pools) {
      const lower = String(phrase).toLowerCase();
      for (const banned of personHostile) {
        expect(lower).not.toContain(banned);
      }
    }
  });
});

describe('stress generator — deterministic batch', () => {
  // Isolated temp dir so this suite doesn't race the engagementCorpus suite
  // (Jest runs test files in parallel workers).
  const TEMP_DIR = path.join(repoRoot, 'fixtures', 'generated-scenarios-stress-test');

  beforeAll(() => {
    if (fs.existsSync(TEMP_DIR)) {
      for (const f of fs.readdirSync(TEMP_DIR)) fs.unlinkSync(path.join(TEMP_DIR, f));
    }
    generator.generate({ count: 50, seed: 'stress-test-seed-2026', outputDir: TEMP_DIR });
  });

  afterAll(() => {
    if (fs.existsSync(TEMP_DIR)) {
      for (const f of fs.readdirSync(TEMP_DIR)) fs.unlinkSync(path.join(TEMP_DIR, f));
      try { fs.rmdirSync(TEMP_DIR); } catch { /* ignore */ }
    }
  });

  function loadScenarios(): FixtureScenario[] {
    return fs
      .readdirSync(TEMP_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(TEMP_DIR, f), 'utf8')));
  }

  it('produces exactly 50 scenarios on disk', () => {
    const files = fs.readdirSync(TEMP_DIR).filter((f) => f.endsWith('.json'));
    expect(files).toHaveLength(50);
  });

  it('every generated scenario has 10–15 moves', () => {
    for (const s of loadScenarios()) {
      expect(s.moves.length).toBeGreaterThanOrEqual(10);
      expect(s.moves.length).toBeLessThanOrEqual(15);
    }
  });

  it('span at least 6 distinct categories', () => {
    const cats = new Set(loadScenarios().map((s) => s.category));
    expect(cats.size).toBeGreaterThanOrEqual(6);
  });

  it('every scenario passes the stress validator', () => {
    const failures: string[] = [];
    for (const s of loadScenarios()) {
      const errs = validateStressScenario(s);
      if (errs.length > 0) failures.push(`${s.scenarioId}: ${errs.slice(0, 3).join(' | ')}`);
    }
    if (failures.length > 0) throw new Error(`Stress validation failures:\n${failures.join('\n')}`);
  });

  it('every child move uses a valid Constitution transition', () => {
    for (const s of loadScenarios()) {
      const typeById = new Map(s.moves.map((m) => [m.moveId, m.argumentType]));
      for (const m of s.moves) {
        if (m.parentMoveId === null) continue;
        const parentType = typeById.get(m.parentMoveId)!;
        const allowed = ALLOWED_REPLIES[parentType] || [];
        expect(allowed).toContain(m.argumentType);
      }
    }
  });

  it('every challenge move has a disagreement axis or qualifier', () => {
    for (const s of loadScenarios()) {
      const challenges = s.moves.filter((m) => m.moveKind === 'challenge_parent');
      for (const m of challenges) {
        expect(Boolean(m.disagreementAxis || m.qualifierCode)).toBe(true);
      }
    }
  });

  it('every concession AND synthesis body includes a concession marker', () => {
    for (const s of loadScenarios()) {
      for (const m of s.moves) {
        if (m.argumentType !== 'concession' && m.argumentType !== 'synthesis') continue;
        const lower = m.body.toLowerCase();
        const hit = CONCESSION_MARKERS.some((mk) => lower.includes(mk));
        expect(hit).toBe(true);
      }
    }
  });

  it('every scenario has at least one branch/tangent candidate or quote anchor', () => {
    for (const s of loadScenarios()) {
      const hasBranch = s.moves.some((m) => Boolean(m.displayMeta?.branchCandidate));
      const hasAnchor = s.moves.some(
        (m) => (m.targetExcerpt && m.targetExcerpt.length > 0) || (m.displayMeta?.quoteAnchorCandidate?.length ?? 0) > 0,
      );
      expect(hasBranch || hasAnchor).toBe(true);
    }
  });

  it('no generated body contains forbidden person-attack labels', () => {
    const banned = ['liar', 'bad faith', 'manipulative', 'dishonest', 'you are stupid', 'you are dumb', 'you are an idiot'];
    for (const s of loadScenarios()) {
      for (const m of s.moves) {
        const lower = m.body.toLowerCase();
        for (const b of banned) expect(lower).not.toContain(b);
      }
    }
  });

  it('no generated body uses "winner" or "loser" as system status', () => {
    for (const s of loadScenarios()) {
      for (const m of s.moves) {
        const lower = m.body.toLowerCase();
        expect(lower).not.toMatch(/\bwinner\b/);
        expect(lower).not.toMatch(/\bloser\b/);
      }
    }
  });

  it('deterministic: same seed produces the same scenarioIds', () => {
    const idsA = generator.generate({ count: 5, seed: 'determinism-check-A', outputDir: TEMP_DIR }).ids;
    const idsB = generator.generate({ count: 5, seed: 'determinism-check-A', outputDir: TEMP_DIR }).ids;
    expect(idsA).toEqual(idsB);
  });

  it('different seeds produce different scenarioIds (probabilistic)', () => {
    const idsA = generator.generate({ count: 5, seed: 'determinism-check-A', outputDir: TEMP_DIR }).ids;
    const idsB = generator.generate({ count: 5, seed: 'determinism-check-B', outputDir: TEMP_DIR }).ids;
    // At least one ID should differ across seeds (template index varies by RNG).
    const same = idsA.filter((id: string, i: number) => idsB[i] === id);
    expect(same.length).toBeLessThan(idsA.length);
  });
});

describe('stress runner — pure helpers', () => {
  it('summarize counts posted vs failed_422/403/500 vs skipped_missing_parent', () => {
    const runRecords = [
      {
        scenario: { category: 'sports_hot_takes' },
        roomId: 'r1',
        results: [
          { actualStatus: 'posted' },
          { actualStatus: 'posted' },
          { actualStatus: 'failed_422', errorDetail: 'length_body: too short' },
          { actualStatus: 'failed_403', errorDetail: 'You must join this debate before posting' },
          { actualStatus: 'skipped_missing_parent' },
        ],
      },
      {
        scenario: { category: 'design_product' },
        roomId: 'r2',
        results: [
          { actualStatus: 'posted' },
          { actualStatus: 'failed_500', errorDetail: 'unknown' },
        ],
      },
    ];
    const { totals, errorReasons, categoryFailures } = stressRunner.summarize(runRecords);
    expect(totals.rooms).toBe(2);
    expect(totals.roomsCreated).toBe(2);
    expect(totals.posted).toBe(3);
    expect(totals.failed_422).toBe(1);
    expect(totals.failed_403).toBe(1);
    expect(totals.failed_500).toBe(1);
    expect(totals.skipped_missing_parent).toBe(1);
    expect(totals.moves).toBe(7);
    expect(errorReasons.get('length_body')).toBe(1);
    expect(categoryFailures.get('sports_hot_takes')).toBe(2);
  });

  it('planScenario flags missing resolution overlap', () => {
    const scenario = {
      resolution: 'magpies group murder crows',
      moves: [
        { moveId: 'm1', parentMoveId: null, body: 'magpies group are loud and murder is harsh.' },
        { moveId: 'm2', parentMoveId: 'm1', body: 'totally unrelated cheese pickle words.' },
      ],
    };
    const issues = stressRunner.planScenario(scenario);
    expect(issues.some((s: string) => s.includes('resolution overlap'))).toBe(true);
  });

  it('planScenario passes when bodies share parent and resolution tokens', () => {
    const scenario = {
      resolution: 'magpies group murder crows',
      moves: [
        { moveId: 'm1', parentMoveId: null, body: 'magpies group should also be called murder like crows.' },
        { moveId: 'm2', parentMoveId: 'm1', body: 'magpies group murder framing is a stretch.' },
      ],
    };
    const issues = stressRunner.planScenario(scenario);
    expect(issues).toEqual([]);
  });
});

describe('stress validator — Constitution gate', () => {
  function baseScenario(extra: Partial<FixtureScenario> = {}): FixtureScenario {
    return {
      scenarioId: 'stress-mini',
      title: 'mini',
      resolution: 'magpies group murder crows',
      category: 'animal_taxonomy_weird',
      personas: [
        { alias: 'Alex', side: 'affirmative', tone: 'calm' },
        { alias: 'Jordan', side: 'negative', tone: 'skeptical' },
        { alias: 'Sam', side: 'neutral', tone: 'conciliatory' },
      ],
      expectedFlags: [],
      expectedTopicChecks: [],
      expectedTurnStatuses: [],
      notes: 'mini',
      moves: [],
      ...extra,
    };
  }

  it('rejects concession lacking a marker', () => {
    type Move = FixtureScenario['moves'][number];
    const claimMoves: Move[] = Array.from({ length: 10 }, (_, i) => ({
      moveId: `m${i + 1}`,
      authorAlias: 'Alex',
      parentMoveId: i === 0 ? null : `m${i}`,
      moveKind: 'make_claim',
      argumentType: 'claim',
      body: `magpies group murder crows note ${i}.`,
      selectedTagCodes: [],
      expectedStatus: 'posted',
    }));
    const concessionWithoutMarker: Move = {
      moveId: 'mC',
      authorAlias: 'Jordan',
      parentMoveId: 'm10',
      moveKind: 'concede_or_narrow',
      argumentType: 'concession',
      // no concession marker:
      body: 'I see what you mean about magpies group murder crows.',
      selectedTagCodes: [],
      expectedStatus: 'posted',
      displayMeta: { playfulLabel: 'mostly' },
    };
    const s = baseScenario({ moves: [...claimMoves, concessionWithoutMarker] });
    const errs = validateStressScenario(s);
    expect(errs.some((e) => e.includes('concession marker'))).toBe(true);
  });

  it('rejects invalid transition: concession after evidence', () => {
    type Move = FixtureScenario['moves'][number];
    const moves: Move[] = [
      { moveId: 'm1', authorAlias: 'A', parentMoveId: null, moveKind: 'start_thesis', argumentType: 'thesis', body: 'magpies group murder crows root.', selectedTagCodes: [], expectedStatus: 'posted' },
      { moveId: 'm2', authorAlias: 'A', parentMoveId: 'm1', moveKind: 'add_evidence', argumentType: 'evidence', body: 'magpies group murder crows evidence.', selectedTagCodes: [], expectedStatus: 'posted' },
      { moveId: 'm3', authorAlias: 'B', parentMoveId: 'm2', moveKind: 'concede_or_narrow', argumentType: 'concession', body: 'I grant magpies group murder crows narrow.', selectedTagCodes: [], expectedStatus: 'posted', displayMeta: { playfulLabel: 'sure' } },
    ];
    // Pad to 10 to clear minMoves
    for (let i = 4; i <= 11; i++) {
      moves.push({ moveId: `m${i}`, authorAlias: 'A', parentMoveId: 'm1', moveKind: 'make_claim', argumentType: 'claim', body: `magpies group murder crows ${i}.`, selectedTagCodes: [], expectedStatus: 'posted' } as Move);
    }
    const s = baseScenario({ moves });
    const errs = validateStressScenario(s);
    expect(errs.some((e) => e.includes('not a valid reply'))).toBe(true);
  });
});
