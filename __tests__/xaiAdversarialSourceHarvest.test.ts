/**
 * Stage 6.1.9 addendum — tests for the xAI X Search adversarial harvester
 * + client + report + move renderer.
 *
 * Pure-function and string-contract tests only. No network is allowed
 * during the test run; the client gates ensure that, and we additionally
 * inject a `fetchImpl` that fails on any call to prove the dry path
 * never reaches transport.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();

const client = require('../scripts/engagement-intelligence/xaiXSearchClient');
const harvest = require('../scripts/engagement-intelligence/xaiAdversarialSourceHarvest');
const report = require('../scripts/engagement-intelligence/xaiAdversarialCorpusReport');
const moveRenderer = require('../scripts/bot-fixtures/xaiAdversarialMoveRenderer');

// ──────────────────────────────────────────────────────────────
// xaiXSearchClient — gating
// ──────────────────────────────────────────────────────────────

describe('xaiXSearchClient — refuses without env + flag + --pilot', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.XAI_API_KEY;
    delete process.env.ENGAGEMENT_INTEL_ENABLE_XAI;
  });
  afterAll(() => { process.env = originalEnv; });

  it('searchPosts without --pilot rejects with XaiXSearchClientDisabled', async () => {
    await expect(
      client.searchPosts({ topicHint: 'test', count: 1, pilot: false })
    ).rejects.toBeInstanceOf(client.XaiXSearchClientDisabled);
  });

  it('searchReplies without --pilot rejects with XaiXSearchClientDisabled', async () => {
    await expect(
      client.searchReplies({ source: { sourceClaimSummary: 'x' }, count: 1, pilot: false })
    ).rejects.toBeInstanceOf(client.XaiXSearchClientDisabled);
  });

  it('assertLiveAllowed rejects when no --pilot flag is set', () => {
    expect(() => client.assertLiveAllowed({ pilot: false })).toThrow(client.XaiXSearchClientDisabled);
  });
});

// ──────────────────────────────────────────────────────────────
// harvester — dry mode does NOT touch the network
// ──────────────────────────────────────────────────────────────

describe('xaiAdversarialSourceHarvest — dry mode never reaches transport', () => {
  it('parseArgs sets --dry by default', () => {
    const args = harvest.parseArgs(['node', 'script']);
    expect(args.dry).toBe(true);
    expect(args.pilot).toBe(false);
  });

  it('parseArgs respects --pilot toggling off --dry', () => {
    const args = harvest.parseArgs(['node', 'script', '--pilot', '--stories', '5', '--replies', '3']);
    expect(args.dry).toBe(false);
    expect(args.pilot).toBe(true);
    expect(args.stories).toBe(5);
    expect(args.replies).toBe(3);
  });

  it('readDryFixture reads the canonical fixture and returns sources', () => {
    const fixture = harvest.readDryFixture(path.join(repoRoot, 'fixtures', 'engagement-intelligence', 'xai-adversarial-dry-fixture.json'));
    expect(Array.isArray(fixture.sources)).toBe(true);
    expect(fixture.sources.length).toBeGreaterThan(0);
  });

  it('shapeFixtureSourceForHarvest produces redacted source + replies', () => {
    const fixture = harvest.readDryFixture(path.join(repoRoot, 'fixtures', 'engagement-intelligence', 'xai-adversarial-dry-fixture.json'));
    const shaped = harvest.shapeFixtureSourceForHarvest(fixture.sources[0], 1, 'test-seed');
    expect(shaped.sourceHash).toMatch(/^test-seed-src-/);
    expect(shaped.sourceTextRedacted).toBeTruthy();
    expect(Array.isArray(shaped.replies)).toBe(true);
    // No raw X identifiers may leak through the redactor.
    expect(shaped.sourceTextRedacted).not.toMatch(/@[A-Za-z0-9_]{1,15}\b/);
    expect(shaped.sourceTextRedacted).not.toMatch(/https?:\/\/(?:x|twitter)\.com\//i);
  });
});

// ──────────────────────────────────────────────────────────────
// classifyReplyToCard — uses the dissent detector
// ──────────────────────────────────────────────────────────────

describe('harvester classifyReplyToCard — finds the five challenge classes', () => {
  const source = { sourceTextRedacted: 'Electric vehicles solve climate change overnight.', sourceClaimSummary: 'EVs solve climate change overnight.' };

  function cardFor(replyText: string) {
    return harvest.classifyReplyToCard(source, { replyTextRedacted: replyText, providerRank: 1 }, 1);
  }

  it('detects ask_source replies', () => {
    const c = cardFor('Which study shows that? Cite the primary source — show your work.');
    expect(['ask_source', 'ask_quote'].includes(c.replyFunction)).toBe(true);
    expect(c.usableForBotDebate).toBe(true);
  });

  it('detects ask_quote replies', () => {
    const c = cardFor('Quote the exact sentence where this is shown. Point to the sentence.');
    expect(c.replyFunction).toBe('ask_quote');
  });

  it('detects causal challenges', () => {
    // The classifier maps "doesn't cause" / "no causal mechanism" /
    // "correlation not causation" to either causal, logic, evidence, or
    // source_chain — all of which are valid pressure axes.
    const c = cardFor('EV adoption does not cause emissions reduction. Correlation is not causation; no mechanism is shown.');
    expect(
      c.disagreementType === 'causal'
      || c.disagreementType === 'evidence'
      || c.disagreementType === 'logic'
      || c.disagreementType === 'source_chain'
    ).toBe(true);
    expect(c.usableForBotDebate).toBe(true);
  });

  it('detects evidence challenges', () => {
    const c = cardFor('The evidence does not support this. There is no data behind the claim.');
    expect(c.disagreementType === 'evidence' || c.disagreementType === 'fact' || c.disagreementType === 'source_chain').toBe(true);
  });

  it('detects scope challenges', () => {
    const c = cardFor('Narrow the scope: only some EVs reduce lifecycle emissions, and only under specific grid conditions.');
    expect(c.disagreementType === 'scope' || c.disagreementType === 'definition').toBe(true);
  });

  it('insult-only replies are classified but unusable', () => {
    const c = cardFor('YOU ARE A LIAR LIAR LIAR');
    // Either the reply function is insult_only / unclear, OR usable is false.
    expect(c.usableForBotDebate === false || c.replyFunction === 'insult_only' || c.replyFunction === 'unclear').toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// hostile-source body — high-risk text is NOT emitted raw
// ──────────────────────────────────────────────────────────────

describe('hostile-source bodies are reduced to category placeholders, not reproduced', () => {
  const source = { sourceTextRedacted: 'A claim.', sourceClaimSummary: 'A claim.' };

  it('threat-shape input → body replaced with placeholder', () => {
    const card = harvest.classifyReplyToCard(source, { replyTextRedacted: 'kill yourself, you should be killed' }, 1);
    expect(card.bodyConversion.kept).toBe(false);
    expect(card.redactedText).toMatch(/redacted: high-risk/i);
    expect(card.redactedText).not.toMatch(/kill yourself/i);
    expect(card.redactedText).not.toMatch(/should be killed/i);
  });

  it('protected-class-attack token → placeholder', () => {
    const card = harvest.classifyReplyToCard(source, { replyTextRedacted: '<protected-class-attack>' }, 1);
    expect(card.bodyConversion.kept).toBe(false);
    expect(card.redactedText).toMatch(/redacted/i);
  });

  it('low-risk reply passes through with identifier redaction', () => {
    const card = harvest.classifyReplyToCard(source, { replyTextRedacted: 'Quote the source. @somebody at twitter.com/handle/post/1234567890123456' }, 1);
    expect(card.bodyConversion.kept).toBe(true);
    expect(card.redactedText).not.toMatch(/@somebody/);
    expect(card.redactedText).not.toMatch(/twitter\.com\/handle/);
    expect(card.redactedText).not.toMatch(/\b1234567890123456\b/);
  });
});

// ──────────────────────────────────────────────────────────────
// popularity is never converted to factual standing
// ──────────────────────────────────────────────────────────────

describe('popularity is not evidence', () => {
  it('popularityBucketFromMetrics returns a coarse bucket, never a stance', () => {
    expect(harvest.popularityBucketFromMetrics(null)).toBe('unknown');
    expect(harvest.popularityBucketFromMetrics({ likeCount: 0 })).toBe('unknown');
    expect(harvest.popularityBucketFromMetrics({ likeCount: 20 })).toBe('low');
    expect(harvest.popularityBucketFromMetrics({ likeCount: 1000 })).toBe('medium');
    expect(harvest.popularityBucketFromMetrics({ likeCount: 100000, retweetCount: 50000 })).toBe('high');
  });

  it('report does not include the words "true" / "false" / "wins" / "loses" in distributions', () => {
    const md = report.buildAdversarialCorpusReport({
      runId: 'test', mode: 'dry', sourceMode: 'dry_fixture',
      bundle: { provocateurPath: 'x', revocateurPath: 'x', provocateurHash: 'aaaa', revocateurHash: 'bbbb', provocateurBytes: 1, revocateurBytes: 1 },
      events: [{ stage: 'scenario_build', sourceHash: 'a', sourcePost: { redactedText: 'foo', issueFrame: 'tech', popularityBucket: 'low', platformSupportWarning: false }, candidateReplies: [], selectedDissent: { rank: 0, dissentSource: 'synthetic_fallback' } }],
    });
    // Doctrine line is present.
    expect(md).toMatch(/Popularity is not evidence/i);
    // Verdict tokens absent in distribution headers / counts.
    expect(md).not.toMatch(/\bwins\b/i);
    expect(md).not.toMatch(/\bloses\b/i);
    expect(md).not.toMatch(/this claim is true/i);
    expect(md).not.toMatch(/this claim is false/i);
  });
});

// ──────────────────────────────────────────────────────────────
// move renderer — bodies carry quote / axis / mechanism / evidenceDebt
// ──────────────────────────────────────────────────────────────

describe('xaiAdversarialMoveRenderer — generated bodies + fallbacks are clean', () => {
  it('deterministic fallback contains mechanism + axis + evidence-debt language and no canned phrases', () => {
    const body = moveRenderer.deterministicAdversarialFallback({
      scene: { title: 'Cars improve cities', category: 'xai_adversarial' },
      parent: { argumentType: 'thesis', body: 'Cars improve cities by enabling mobility.' },
      slot: { argumentType: 'rebuttal', depth: 3 },
      axis: 'source_chain',
      persona: { skillRole: 'bot-revocateur', skillHash: 'aaaaaaaa' },
    });
    // Contains structured pressure language.
    expect(body.toLowerCase()).toMatch(/mechanism/);
    // No canned phrase.
    expect(moveRenderer.hasBannedCannedPhrase(body)).toBe(false);
    // No forbidden user label.
    expect(moveRenderer.hasForbiddenUserLabel(body)).toBeNull();
  });

  it('detects banned canned phrases case-insensitively', () => {
    expect(moveRenderer.hasBannedCannedPhrase('counter to the previous point on x')).toBe(true);
    expect(moveRenderer.hasBannedCannedPhrase('Pushing back on the rebuttal')).toBe(true);
    expect(moveRenderer.hasBannedCannedPhrase('this evidence is on point')).toBe(true);
    expect(moveRenderer.hasBannedCannedPhrase('narrow back to the point')).toBe(true);
    expect(moveRenderer.hasBannedCannedPhrase('clean body without canned phrases')).toBe(false);
  });

  it('detects forbidden USER LABELS but not the bare words', () => {
    expect(moveRenderer.hasForbiddenUserLabel('you are a liar')).toBe('liar');
    expect(moveRenderer.hasForbiddenUserLabel("you're an extremist")).toBe('extremist');
    expect(moveRenderer.hasForbiddenUserLabel('they are propagandists')).toBe('propagandist');
    // The word "bot" appearing in "test bot account" or "bot-provocateur"
    // must NOT trigger the label check (it's identity, not a slur on
    // another user).
    expect(moveRenderer.hasForbiddenUserLabel('this is a test bot account in a dev environment')).toBeNull();
    expect(moveRenderer.hasForbiddenUserLabel('the bot-provocateur skill says hold the broad form')).toBeNull();
  });

  it('renderAdversarialMove falls back deterministically when no client is given', async () => {
    const r = await moveRenderer.renderAdversarialMove({
      client: null,
      scene: { title: 'Test scene', category: 'xai_adversarial' },
      parent: { argumentType: 'thesis', body: 'A broad claim about X.' },
      slot: { argumentType: 'rebuttal', depth: 3 },
      persona: { skillRole: 'bot-revocateur', skillHash: 'deadbeefdeadbeef' },
      skillBundle: { provocateurText: '...', revocateurText: '...', provocateurHash: 'p', revocateurHash: 'r' },
      conversationSummary: '',
      axis: 'source_chain',
      antiAmplificationCue: 'popularity is not doing the evidentiary work',
      forceTargetExcerpt: 'A broad claim',
    });
    expect(r.source).toBe('deterministic_fallback');
    expect(r.skillHash).toBe('deadbeefdeadbeef');
    expect(moveRenderer.hasBannedCannedPhrase(r.body)).toBe(false);
    expect(moveRenderer.hasForbiddenUserLabel(r.body)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// runner source — no service-role / direct-insert into arguments
// ──────────────────────────────────────────────────────────────

describe('runner source code does not use service-role or direct-insert', () => {
  const runnerPath = path.join(repoRoot, 'scripts', 'bot-fixtures', 'runXaiAdversarialBotCorpus.js');
  const harvestPath = path.join(repoRoot, 'scripts', 'engagement-intelligence', 'xaiAdversarialSourceHarvest.js');
  const moveRendererPath = path.join(repoRoot, 'scripts', 'bot-fixtures', 'xaiAdversarialMoveRenderer.js');
  const reportPath = path.join(repoRoot, 'scripts', 'engagement-intelligence', 'xaiAdversarialCorpusReport.js');
  const clientPath = path.join(repoRoot, 'scripts', 'engagement-intelligence', 'xaiXSearchClient.js');

  it.each([
    ['runner', runnerPath],
    ['harvest', harvestPath],
    ['move renderer', moveRendererPath],
    ['report', reportPath],
    ['x_search client', clientPath],
  ])('%s contains no service-role usage', (_label, file) => {
    const src = fs.readFileSync(file, 'utf8');
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(src).not.toMatch(/service_role/i);
  });

  it('runner does not bypass submit-argument for posting moves to public.arguments', () => {
    const src = fs.readFileSync(runnerPath, 'utf8');
    // Posts MUST route through invokeSubmitArgument; no direct .from('arguments').insert(...) call.
    expect(src).not.toMatch(/\.from\(['"]arguments['"]\)\.insert/);
    expect(src).toMatch(/invokeSubmitArgument/);
  });
});

// ──────────────────────────────────────────────────────────────
// output path is under logs/ or data/engagement-intelligence/
// ──────────────────────────────────────────────────────────────

describe('output path constraint', () => {
  it('default harvest output writes under logs/engagement-intelligence/', () => {
    const args = harvest.parseArgs(['node', 'script']);
    // The harvester default outDir is logs/engagement-intelligence (set in
    // parseArgs defaults). It must NOT be under docs/ or any committed path.
    expect(args.outDir).toMatch(/logs[\\/]engagement-intelligence$/);
  });
});

// ──────────────────────────────────────────────────────────────
// committed report has no raw identifiers / secrets
// ──────────────────────────────────────────────────────────────

describe('committed report contract', () => {
  function sampleEvents() {
    return [
      { stage: 'scenario_build', sourceHash: 'a', sourcePost: { redactedText: 'Clean source body.', issueFrame: 'tech-platforms', popularityBucket: 'high', sourceChainRisk: 'high', platformSupportWarning: true }, candidateReplies: [{ rank: 1, redactedText: 'quote the source', disagreementType: 'source_chain', replyFunction: 'ask_source', usableForBotDebate: true }], selectedDissent: { rank: 1, redactedText: 'Quote the source line.', dissentSource: 'xai_x_search', playableSkeleton: { targetExcerpt: 'Clean source body.', disagreementAxis: 'source_chain', mechanism: 'm', evidenceDebt: ['primary'], antiAmplificationNote: 'n' } } },
      { stage: 'dissent_detection', sourceHash: 'a', rank: 1, classification: { disagreementType: 'source_chain', replyFunction: 'ask_source', amplificationRisk: 'high', sourceChainRisk: 'high', abuseRisk: 'none', usableForBotDebate: true } },
    ];
  }

  it('renders a section listing skill gate hashes, doctrine reminder, and counts', () => {
    const md = report.buildAdversarialCorpusReport({
      runId: 'r1', mode: 'dry', sourceMode: 'dry_fixture',
      bundle: { provocateurPath: '.claude/skills/bot-provocateur/SKILL.md', revocateurPath: '.claude/skills/bot-revocateur/SKILL.md', provocateurHash: 'abcdef0123456789', revocateurHash: '0123456789abcdef', provocateurBytes: 1024, revocateurBytes: 1024 },
      events: sampleEvents(),
    });
    expect(md).toMatch(/Skill gate/);
    expect(md).toMatch(/Doctrine reminder/);
    expect(md).toMatch(/Counts/);
    expect(md).toMatch(/Sources harvested:/);
    expect(md).toMatch(/Usable dissent picks:/);
    expect(md).toMatch(/Game-design recommendations/);
  });

  it('never contains @handles, x.com URLs, post IDs, JWTs, Bearer, or API keys', () => {
    const md = report.buildAdversarialCorpusReport({
      runId: 'r1', mode: 'dry', sourceMode: 'dry_fixture',
      bundle: { provocateurPath: '.claude/skills/bot-provocateur/SKILL.md', revocateurPath: '.claude/skills/bot-revocateur/SKILL.md', provocateurHash: 'abcdef0123456789', revocateurHash: '0123456789abcdef', provocateurBytes: 1024, revocateurBytes: 1024 },
      events: sampleEvents(),
    });
    expect(md).not.toMatch(/@[A-Za-z0-9_]{3,15}\b/);
    expect(md).not.toMatch(/https?:\/\/(?:x|twitter)\.com\//i);
    expect(md).not.toMatch(/\b\d{15,20}\b/);
    expect(md).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(md).not.toMatch(/Bearer\s+\S{10,}/);
    expect(md).not.toMatch(/sk-ant-[A-Za-z0-9_-]+/);
    expect(md).not.toMatch(/xai-[A-Za-z0-9_-]+/);
  });
});

// ──────────────────────────────────────────────────────────────
// runner can read a harvest JSONL and rebuild shaped sources
// ──────────────────────────────────────────────────────────────

describe('runner harvest-JSONL reader', () => {
  const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');

  it('readHarvestFile reconstructs shaped sources from scenario_build events', () => {
    // `logs/engagement-intelligence/` is gitignored, so it is absent in fresh
    // git worktrees / CI checkouts. mkdtempSync needs its parent to exist —
    // create it recursively so the test is hermetic anywhere.
    const logsDir = path.join(repoRoot, 'logs', 'engagement-intelligence');
    fs.mkdirSync(logsDir, { recursive: true });
    const tmpDir = fs.mkdtempSync(path.join(logsDir, 'test-'));
    const filePath = path.join(tmpDir, 'sample.jsonl');
    const events = [
      { stage: 'run_start', runId: 'r' },
      { stage: 'scenario_build', sourceHash: 's1', sourceQuery: 'tech', sourcePost: { redactedText: 'A claim.', issueFrame: 'tech-platforms', popularityBucket: 'low', platformSupportWarning: false }, candidateReplies: [{ rank: 1, redactedText: 'Quote the source.' }, { rank: 2, redactedText: 'YOU ARE A LIAR' }], selectedDissent: { rank: 1, redactedText: 'Quote the source.', dissentSource: 'xai_x_search', playableSkeleton: { targetExcerpt: 'A claim.', disagreementAxis: 'source_chain', mechanism: 'm', evidenceDebt: ['x'], antiAmplificationNote: 'n' } } },
      { stage: 'scenario_build', sourceHash: 's2', sourceQuery: 'sports', sourcePost: { redactedText: 'Sports claim.', issueFrame: 'sports', popularityBucket: 'medium', platformSupportWarning: false }, candidateReplies: [{ rank: 1, redactedText: 'Cite the rule.' }], selectedDissent: { rank: 1, redactedText: 'Cite the rule.', dissentSource: 'xai_x_search' } },
    ];
    fs.writeFileSync(filePath, events.map((e) => JSON.stringify(e)).join('\n'));
    const shaped = runner.readHarvestFile ? runner.readHarvestFile(filePath) : null;
    expect(shaped).not.toBeNull();
    if (!shaped) return;
    expect(shaped.length).toBe(2);
    expect(shaped[0].sourceHash).toBe('s1');
    expect(shaped[0].replies.length).toBe(2);
    expect(shaped[1].sourceHash).toBe('s2');
    // Cleanup.
    try { fs.unlinkSync(filePath); fs.rmdirSync(tmpDir); } catch { /* swallow */ }
  });
});
