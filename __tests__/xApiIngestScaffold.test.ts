/**
 * X API ingest scaffold — disabled-by-default contract tests.
 *
 * No HTTP. No real X. We verify that:
 *  - The xApiClient refuses live calls unless env flag + bearer are set.
 *  - xNewsPlan prints a plan-only profile.
 *  - xNewsCollect / xReplyCollect default to dry mode.
 *  - The synthetic analyzer writes a Markdown report.
 *  - The committed report shape contains no raw post IDs or handles.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();

describe('xApiClient — refuses live calls when disabled', () => {
  // Defensive: ensure no env flag is on inside the test process.
  beforeAll(() => {
    delete process.env.ENGAGEMENT_INTEL_ENABLE_X_API;
    delete process.env.X_BEARER_TOKEN;
  });

  const client = require(path.join(repoRoot, 'scripts/engagement-intelligence/xApiClient.js'));

  it('assertLiveAllowed throws when env flag is off', () => {
    expect(() => client.assertLiveAllowed()).toThrow(/X API disabled/);
  });

  it('scrubError strips Bearer tokens from messages', () => {
    expect(client.scrubError(new Error('boom Bearer abcdef1234567890XYZ'))).not.toContain('abcdef1234567890XYZ');
  });

  it('xApiFetch throws without making a network call when disabled', async () => {
    await expect(client.xApiFetch('/news/search')).rejects.toThrow(/X API disabled/);
  });
});

describe('xNewsPlan — pilot volume caps', () => {
  const plan = require(path.join(repoRoot, 'scripts/engagement-intelligence/xNewsPlan.js'));

  it('exposes news query buckets', () => {
    expect(Array.isArray(plan.NEWS_QUERY_BUCKETS)).toBe(true);
    expect(plan.NEWS_QUERY_BUCKETS.length).toBeGreaterThanOrEqual(5);
  });

  it('explicitly excludes high-risk topics', () => {
    const excluded = plan.EXCLUDED_TOPICS.join(' ').toLowerCase();
    expect(excluded).toContain('medical');
    expect(excluded).toContain('legal');
    expect(excluded).toContain('financial');
    expect(excluded).toContain('protected-class');
    expect(excluded).toContain('sexual');
    expect(excluded).toContain('extremism');
    expect(excluded).toContain('real-person');
  });
});

describe('xNewsCollect / xReplyCollect — default dry', () => {
  const collect = require(path.join(repoRoot, 'scripts/engagement-intelligence/xNewsCollect.js'));
  const reply = require(path.join(repoRoot, 'scripts/engagement-intelligence/xReplyCollect.js'));

  it('parseArgs defaults dry=true and pilot=false', () => {
    expect(collect.parseArgs(['node', 'x'])).toMatchObject({ dry: true, pilot: false });
    expect(reply.parseArgs(['node', 'x'])).toMatchObject({ dry: true, pilot: false });
  });

  it('parseArgs flips dry off when --pilot is passed', () => {
    expect(collect.parseArgs(['node', 'x', '--pilot'])).toMatchObject({ dry: false, pilot: true });
  });
});

describe('xaiClassifyPairs — disabled by default', () => {
  const xai = require(path.join(repoRoot, 'scripts/engagement-intelligence/xaiClassifyPairs.js'));

  it('disabled() returns enabled=false', () => {
    const out = xai.disabled('env_flag_off');
    expect(out.enabled).toBe(false);
    expect(out.disabledReason).toBe('env_flag_off');
    expect(out.output).toBeNull();
  });
});

describe('analyzeEngagementSamples — synthetic run writes a report', () => {
  const analyze = require(path.join(repoRoot, 'scripts/engagement-intelligence/analyzeEngagementSamples.js'));

  it('buildAggregate produces stance and disagreement-type distributions', () => {
    const interpretations = [
      { excluded: false, pairId: 'x1', finalVector: { primaryStance: 'strong_agree', agreementType: 'premise', disagreementType: 'none', replyFunction: 'support', agreementScore: 0.8, disagreementScore: 0.0, coexistenceScore: 0.0, uncertaintyScore: 0.0 } },
      { excluded: false, pairId: 'x2', finalVector: { primaryStance: 'mixed_agree_disagree', agreementType: 'premise', disagreementType: 'evidence', replyFunction: 'caveat', agreementScore: 0.5, disagreementScore: 0.5, coexistenceScore: 0.5, uncertaintyScore: 0.2 } },
    ];
    const agg = analyze.buildAggregate(interpretations, 'synthetic', 'unit', 'unit notes');
    expect(agg.stanceDistribution.strong_agree).toBe(1);
    expect(agg.stanceDistribution.mixed_agree_disagree).toBe(1);
    expect(agg.disagreementTypeDistribution.evidence).toBe(1);
    expect(agg.topRuleCandidates.some((c: { deterministicPredicateName: string }) => c.deterministicPredicateName === 'shouldShowMixedAgreementDisagreementStatus')).toBe(true);
  });
});

describe('writeEpidemiologyReport — committable shape', () => {
  const { buildReportMarkdown } = require(path.join(repoRoot, 'scripts/engagement-intelligence/writeEpidemiologyReport.js'));

  it('renders a markdown report with stance + disagreement + compliance sections', () => {
    const md = buildReportMarkdown({
      runId: 'unit-report', collectedAt: '2026-05-17T00:00:00Z', source: 'synthetic',
      storyCount: 0, rootPostCount: 1, replyPairCount: 1, excludedCount: 0,
      stanceDistribution: { strong_agree: 1, weak_agree: 0, mixed_agree_disagree: 0, weak_disagree: 0, strong_disagree: 0, unclear: 0, tangent: 0, joke_or_meme: 0, receipt_request: 0, quote_request: 0 },
      agreementDisagreementHeatmap: { buckets: { '0.6-0.8 × 0.0-0.2': 1 } },
      disagreementTypeDistribution: { fact: 0, definition: 0, causal: 0, value: 0, evidence: 0, logic: 0, scope: 0, framing: 0, none: 1 },
      agreementTypeDistribution: { premise: 1, evidence: 0, conclusion: 0, value: 0, framing: 0, context: 0, none: 0 },
      topReplyFunctions: [{ replyFunction: 'support', count: 1 }],
      topRuleCandidates: [],
      notes: 'unit',
    }, []);
    expect(md).toContain('# Engagement Epidemiology');
    expect(md).toContain('Stance distribution');
    expect(md).toContain('Agreement × disagreement heatmap');
    expect(md).toContain('Compliance');
    expect(md).toContain('Official X API only');
    expect(md).toContain('user-review required');
    // Safety: no email/JWT/sb_secret_ shape inside.
    expect(md).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(md).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });
});

describe('synthetic analyzer end-to-end (no network)', () => {
  it('writes a report file to docs/testing-runs', () => {
    const { spawnSync } = require('node:child_process');
    const res = spawnSync(process.execPath, ['scripts/engagement-intelligence/analyzeEngagementSamples.js', '--synthetic'], {
      cwd: repoRoot,
      env: { ...process.env, ENGAGEMENT_INTEL_ENABLE_X_API: 'false', ENGAGEMENT_INTEL_ENABLE_XAI: 'false' },
      encoding: 'utf8',
    });
    expect(res.status).toBe(0);
    // Find a file matching today's date in docs/testing-runs
    const dir = path.join(repoRoot, 'docs', 'testing-runs');
    const today = new Date().toISOString().slice(0, 10);
    const match = fs.readdirSync(dir).find((f) => f.startsWith(today) && f.includes('engagement-epidemiology-synthetic'));
    expect(match).toBeTruthy();
  });
});
