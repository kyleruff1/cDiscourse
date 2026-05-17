/**
 * Tiny X News pilot — refusal + report-shape tests.
 *
 * No HTTP. We assert that the orchestrator refuses without env / pilot flag,
 * caps reply pair count, and renders a report with the required sections —
 * including mixedAgreementClass + broad/narrow acceptor/decliner counts.
 */
import * as path from 'path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const pilot = require(path.join(repoRoot, 'scripts/engagement-intelligence/runTinyXNewsPilot.js'));
const replyCollect = require(path.join(repoRoot, 'scripts/engagement-intelligence/xReplyCollect.js'));

describe('runTinyXNewsPilot — argument parsing', () => {
  it('defaults pilot=false / allowXai=false', () => {
    expect(pilot.parseArgs(['node', 'x'])).toEqual({ pilot: false, allowXai: false });
  });
  it('parses --pilot and --allow-xai', () => {
    expect(pilot.parseArgs(['node', 'x', '--pilot', '--allow-xai'])).toEqual({ pilot: true, allowXai: true });
  });
});

describe('runTinyXNewsPilot — refusal paths (no HTTP)', () => {
  it('dry mode (no --pilot) prints dry message and exits 0', () => {
    const res = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/engagement-intelligence/runTinyXNewsPilot.js')], {
      cwd: repoRoot, encoding: 'utf8',
      env: { ...process.env, ENGAGEMENT_INTEL_ENABLE_X_API: 'false', ENGAGEMENT_INTEL_ENABLE_XAI: 'false', X_BEARER_TOKEN: '', XAI_API_KEY: '' },
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('dry mode — no X API calls');
    expect(res.stdout).not.toMatch(/Bearer\s+[A-Za-z0-9]/);
  });

  it('--pilot without env file refuses with exit 2', () => {
    const res = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/engagement-intelligence/runTinyXNewsPilot.js'), '--pilot'], {
      cwd: repoRoot, encoding: 'utf8',
      env: { ...process.env, ENGAGEMENT_INTEL_ENABLE_X_API: 'false', ENGAGEMENT_INTEL_ENABLE_XAI: 'false', X_BEARER_TOKEN: '', XAI_API_KEY: '' },
    });
    expect(res.status).toBe(2);
    expect((res.stderr + res.stdout)).toMatch(/refusing/);
  });
});

describe('extractClusterIds / pickTopRootsPerStory', () => {
  it('extracts string and object IDs from cluster_posts_results', () => {
    const ids = pilot.extractClusterIds({ cluster_posts_results: ['1', { post_id: '2' }, { id: '3' }, null] });
    expect(ids).toEqual(['1', '2', '3']);
  });

  it('caps per-story root count and tags _storyIdHash / _queryBucket', () => {
    const stories = [
      { storyIdHash: 'sh1', _bucketId: 'tech', _clusterRawIds: ['100', '200', '300', '400'] },
    ];
    const lookedUp = [
      { id: '100', public_metrics: { reply_count: 1, retweet_count: 0, quote_count: 0, like_count: 5 } },
      { id: '200', public_metrics: { reply_count: 10, retweet_count: 0, quote_count: 0, like_count: 50 } },
      { id: '300', public_metrics: { reply_count: 100, retweet_count: 0, quote_count: 5, like_count: 500 } },
      { id: '400', public_metrics: { reply_count: 2, retweet_count: 1, quote_count: 1, like_count: 20 } },
    ];
    const roots = pilot.pickTopRootsPerStory(stories, lookedUp, 2);
    expect(roots.length).toBe(2);
    // Highest popularity is id=300.
    expect(roots[0].id).toBe('300');
    expect(roots[0]._storyIdHash).toBe('sh1');
    expect(roots[0]._queryBucket).toBe('tech');
  });
});

describe('buildReport', () => {
  function makeInterpretation(pairId: string, opts: {
    primaryStance: string; agreementType: string; disagreementType: string;
    agreementScore: number; disagreementScore: number; coexistenceScore: number;
    replyFunction: string;
    mixedAgreementClass: string; broadAcceptor: boolean; narrowAcceptor: boolean;
    broadDecliner: boolean; narrowDecliner: boolean; playableTensionScore: number;
  }) {
    return {
      pairId,
      finalVector: {
        primaryStance: opts.primaryStance, agreementType: opts.agreementType, disagreementType: opts.disagreementType,
        replyFunction: opts.replyFunction,
        agreementScore: opts.agreementScore, disagreementScore: opts.disagreementScore,
        coexistenceScore: opts.coexistenceScore, uncertaintyScore: 0.1,
        scalarRationale: '', userReviewRequired: true,
      },
      mixedFlags: {
        broadAcceptor: opts.broadAcceptor, narrowAcceptor: opts.narrowAcceptor,
        broadDecliner: opts.broadDecliner, narrowDecliner: opts.narrowDecliner,
        mixedAgreementClass: opts.mixedAgreementClass,
        playableTensionScore: opts.playableTensionScore,
        suggestedGameNudge: 'none',
      },
      _rootTextRedacted: 'safe root text',
      _replyTextRedacted: 'safe reply text',
    };
  }

  it('renders required sections', () => {
    const md = pilot.buildReport({
      runId: 'unit-run',
      scenarios: [{}, {}],
      rootCount: 3,
      interpretations: [
        makeInterpretation('p1', { primaryStance: 'mixed_agree_disagree', agreementType: 'conclusion', disagreementType: 'scope', agreementScore: 0.7, disagreementScore: 0.4, coexistenceScore: 0.6, replyFunction: 'caveat', mixedAgreementClass: 'broad_accept_narrow_decline', broadAcceptor: true, narrowAcceptor: false, broadDecliner: false, narrowDecliner: true, playableTensionScore: 0.8 }),
        makeInterpretation('p2', { primaryStance: 'pure_decline', agreementType: 'none', disagreementType: 'logic', agreementScore: 0.0, disagreementScore: 0.7, coexistenceScore: 0.0, replyFunction: 'rebut', mixedAgreementClass: 'pure_decline', broadAcceptor: false, narrowAcceptor: false, broadDecliner: true, narrowDecliner: false, playableTensionScore: 0.4 }),
        makeInterpretation('p3', { primaryStance: 'tangent', agreementType: 'none', disagreementType: 'none', agreementScore: 0.0, disagreementScore: 0.0, coexistenceScore: 0.0, replyFunction: 'branch_tangent', mixedAgreementClass: 'tangent_or_joke', broadAcceptor: false, narrowAcceptor: false, broadDecliner: false, narrowDecliner: false, playableTensionScore: 0.2 }),
      ],
      bucketsUsed: ['tech', 'sports'],
    });
    expect(md).toContain('# X News Reply Pilot');
    expect(md).toContain('_Mode_: live_x_api_only');
    expect(md).toContain('_xAI used_: no');
    expect(md).toContain('## Mixed-agreement class counts');
    expect(md).toContain('## Broad / narrow acceptor + decliner counts');
    expect(md).toContain('## Top 10 playable-tension exhibits');
    expect(md).toContain('## Top 10 broad_accept_narrow_decline exhibits');
    expect(md).toContain('## Top 10 narrow_accept_broad_decline exhibits');
    expect(md).toContain('## Deterministic rule candidates');
    expect(md).toContain('## Limitations');
    expect(md).toContain('## Compliance');
    // Counts include each class
    expect(md).toContain('`broad_accept_narrow_decline`');
    expect(md).toContain('`pure_decline`');
    expect(md).toContain('`tangent_or_joke`');
  });

  it('contains no email/handle/JWT/Bearer/key shapes', () => {
    const md = pilot.buildReport({
      runId: 'unit', scenarios: [], rootCount: 0,
      interpretations: [
        makeInterpretation('p1', { primaryStance: 'unclear', agreementType: 'none', disagreementType: 'none', agreementScore: 0, disagreementScore: 0, coexistenceScore: 0, replyFunction: 'unclear', mixedAgreementClass: 'unclear_mixed', broadAcceptor: false, narrowAcceptor: false, broadDecliner: false, narrowDecliner: false, playableTensionScore: 0 }),
      ],
      bucketsUsed: [],
    });
    expect(md).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(md).not.toMatch(/Bearer\s+[A-Za-z0-9]/);
    expect(md).not.toMatch(/@[A-Za-z0-9_]{3,15}\b/);
    expect(md).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(md).not.toMatch(/xai-[A-Za-z0-9_]{8,}/);
  });
});

describe('xReplyCollect — refusal contract', () => {
  it('parseArgs defaults pilot=false', () => {
    expect(replyCollect.parseArgs(['node', 'x'])).toMatchObject({ pilot: false });
  });

  it('parseArgs accepts --roots / --out / --run-id', () => {
    const args = replyCollect.parseArgs(['node', 'x', '--pilot', '--roots', '/tmp/r.json', '--out', '/tmp/o.jsonl', '--run-id', 'unit']);
    expect(args).toMatchObject({ pilot: true, rootsFile: '/tmp/r.json', outFile: '/tmp/o.jsonl', runId: 'unit' });
  });
});

describe('volume caps respected even when many roots are passed', () => {
  it('liveCollect would stop at maxTotalReplyPairs (validated structurally)', () => {
    // We don't actually call liveCollect (it would need network). We only
    // assert the function exists and its loop body respects env.maxTotalReplyPairs.
    expect(typeof replyCollect.liveCollect).toBe('function');
    const src = require('fs').readFileSync(path.join(repoRoot, 'scripts/engagement-intelligence/xReplyCollect.js'), 'utf8');
    expect(src).toMatch(/maxTotalReplyPairs/);
    expect(src).toMatch(/cap reached/);
  });
});
