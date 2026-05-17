/**
 * Stage 6.1.5.2 — xAI X Search live seeder tests.
 *
 * Tests never hit the real xAI network. They mock `fetchImpl` and assert
 * gating, sanitization, and error handling.
 */
import * as fs from 'fs';
import * as path from 'path';

const seeder = require('../scripts/engagement-intelligence/xaiSeededStances');

describe('xaiSeededStances — gating contract', () => {
  beforeEach(() => {
    delete process.env.XAI_API_KEY;
    delete process.env.ENGAGEMENT_INTEL_ENABLE_XAI;
  });

  it('refuses without --pilot', async () => {
    process.env.ENGAGEMENT_INTEL_ENABLE_XAI = 'true';
    process.env.XAI_API_KEY = 'xai-test-key-DUMMY-shouldneverleak';
    await expect(seeder.loadXaiSeedsLive(3, {})).rejects.toThrow(/no_pilot_flag/);
  });

  it('refuses without enableXai env flag', async () => {
    process.env.XAI_API_KEY = 'xai-test-key-DUMMY-shouldneverleak';
    process.env.ENGAGEMENT_INTEL_ENABLE_XAI = 'false';
    await expect(seeder.loadXaiSeedsLive(3, { pilot: true })).rejects.toThrow(/env_flag_off/);
  });

  it('refuses without XAI_API_KEY', async () => {
    process.env.ENGAGEMENT_INTEL_ENABLE_XAI = 'true';
    // Explicit empty string masks any value in the local .env file
    // (matches the xaiAuthProbe.live-path semantic).
    process.env.XAI_API_KEY = '';
    await expect(seeder.loadXaiSeedsLive(3, { pilot: true })).rejects.toThrow(/api_key_missing/);
  });
});

describe('xaiSeededStances — successful response', () => {
  const MOCK_RESPONSE_TOPICS = [
    {
      topicId: 'ai-seed-climate-co2-2025',
      title: 'Carbon capture mandates accelerate or stall industrial decarbonization?',
      resolution: 'Mandatory carbon capture at point sources accelerates industrial decarbonization more than it stalls it.',
      resolutionKeywords: ['carbon', 'capture', 'industrial', 'mandate'],
      thesisFraming: 'Industrial point-source capture targets the densest emissions and gives utilities a near-term decarbonization path.',
      counterClaims: ['Carbon capture mandates divert capital from cheaper renewables and slow overall decarbonization.'],
      evidenceFacts: [{ label: 'IEA capture rollout', sourceText: 'Per the IEA report, installed capture capacity grew about 35% year-over-year in operating plants.' }],
      scopeNarrowings: ['heavy industry only', 'OECD countries only'],
      tangentHooks: ['Direct air capture economics — separate thread.'],
    },
  ];

  beforeEach(() => {
    process.env.XAI_API_KEY = 'xai-test-key-DUMMY-shouldneverleak';
    process.env.ENGAGEMENT_INTEL_ENABLE_XAI = 'true';
  });

  it('returns sanitized topic seeds from a successful 200 response', async () => {
    const fetchCalls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = async (url: string, init: RequestInit) => {
      fetchCalls.push({ url, init });
      return {
        status: 200,
        body: { cancel: async () => undefined },
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ topics: MOCK_RESPONSE_TOPICS }) } }],
        }),
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    };
    const seeds = await seeder.loadXaiSeedsLive(3, { pilot: true, fetchImpl });
    expect(seeds).toHaveLength(1);
    expect(seeds[0].topicId).toBe('ai-seed-climate-co2-2025');
    expect(seeds[0].evidenceFacts.length).toBe(1);
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toBe('https://api.x.ai/v1/chat/completions');
    expect((fetchCalls[0].init.headers as Record<string, string>).Authorization).toMatch(/^Bearer xai-test-key-DUMMY/);
    const sentBody = JSON.parse(fetchCalls[0].init.body as string);
    expect(sentBody.search_parameters.mode).toBe('on');
    expect(sentBody.search_parameters.sources[0].type).toBe('x');
    expect(sentBody.response_format.type).toBe('json_object');
  });

  it('strips X handles, URLs, and JWT-shape tokens from sanitized seeds', async () => {
    const dirty = [{
      topicId: 'ai-seed-test',
      title: 'See @somehandle and https://x.com/somehandle/status/123 for context',
      resolution: 'Visit https://t.co/abcd to learn more — token eyJpAyAyKpAyL.bb.cc inside.',
      resolutionKeywords: ['test'],
      thesisFraming: 'The handle @sourcebot makes a claim at https://x.com/sourcebot/status/9.',
      counterClaims: ['@anotherhandle disagrees.'],
      evidenceFacts: [{ label: 'src', sourceText: 'See https://x.com/x for receipt @feedhandle.' }],
      scopeNarrowings: [], tangentHooks: [],
    }];
    const fetchImpl = async () => ({
      status: 200,
      body: { cancel: async () => undefined },
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ topics: dirty }) } }] }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    const seeds = await seeder.loadXaiSeedsLive(3, { pilot: true, fetchImpl });
    const blob = JSON.stringify(seeds);
    expect(blob).not.toMatch(/@somehandle|@anotherhandle|@feedhandle|@sourcebot/);
    expect(blob).not.toMatch(/https:\/\/x\.com|https:\/\/t\.co|twitter\.com/);
    expect(blob).not.toMatch(/eyJpAyAyKpAyL/);
  });

  it('falls back closed on non-200 status (401)', async () => {
    const fetchImpl = async () => ({
      status: 401,
      body: { cancel: async () => undefined },
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    await expect(seeder.loadXaiSeedsLive(3, { pilot: true, fetchImpl })).rejects.toThrow(/xai_auth_failed_401/);
  });

  it('falls back closed on transport error and sanitizes the message', async () => {
    const fetchImpl = async () => { throw new Error('connection failed with key xai-leak-test-1234567890'); };
    let err: Error | null = null;
    try { await seeder.loadXaiSeedsLive(3, { pilot: true, fetchImpl }); } catch (e) { err = e as Error; }
    expect(err).toBeTruthy();
    expect(String(err!.message)).not.toMatch(/xai-leak-test/);
  });

  it('falls back closed when xAI returns an unparseable content payload', async () => {
    const fetchImpl = async () => ({
      status: 200,
      body: { cancel: async () => undefined },
      json: async () => ({ choices: [{ message: { content: 'not json at all' } }] }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    await expect(seeder.loadXaiSeedsLive(3, { pilot: true, fetchImpl })).rejects.toThrow(/xai_returned_unusable_payload/);
  });

  it('falls back closed when xAI returns 0 valid seeds after sanitize', async () => {
    const fetchImpl = async () => ({
      status: 200,
      body: { cancel: async () => undefined },
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ topics: [{ missing: 'fields' }] }) } }] }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    await expect(seeder.loadXaiSeedsLive(3, { pilot: true, fetchImpl })).rejects.toThrow(/xai_returned_no_seeds_after_sanitize/);
  });
});

describe('xaiSeededStances — source-level safety', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'scripts/engagement-intelligence/xaiSeededStances.js'), 'utf8');

  it('never console.logs Authorization or Bearer values', () => {
    expect(src).not.toMatch(/console\.\w+\([^)]*Authorization[^)]*\$\{/);
    expect(src).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
  });

  it('forbids user labels in the system prompt', () => {
    expect(src).toMatch(/liar/);
    expect(src).toMatch(/propagandist/);
    expect(src).toMatch(/troll/);
    expect(src).toMatch(/bot/);
    expect(src).toMatch(/astroturfer/);
  });

  it('uses Live Search via search_parameters (xAI documented feature)', () => {
    expect(src).toMatch(/search_parameters/);
    expect(src).toMatch(/sources:\s*\[\{\s*type:\s*['"]x['"]/);
  });

  it('releases response body before exit on success path', () => {
    expect(src).toMatch(/releaseResponseBody/);
  });
});

describe('loadSeeds — mode routing', () => {
  it('synthetic mode never touches the network', async () => {
    const seeds = await seeder.loadSeeds({ mode: 'synthetic', count: 3 });
    expect(seeds.length).toBeGreaterThan(0);
    expect(seeds[0]).toEqual(expect.objectContaining({ topicId: expect.any(String), title: expect.any(String), resolution: expect.any(String) }));
  });

  it('xai_live mode without pilot rejects immediately', async () => {
    delete process.env.XAI_API_KEY;
    delete process.env.ENGAGEMENT_INTEL_ENABLE_XAI;
    await expect(seeder.loadSeeds({ mode: 'xai_live', count: 3 })).rejects.toThrow(/env_flag_off|no_pilot_flag|api_key_missing|env_file_missing/);
  });
});
