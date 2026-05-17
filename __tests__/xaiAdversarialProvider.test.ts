/**
 * Stage 6.1.7 — xAI adversarial provider abstraction tests.
 *
 * Never hits the real network. Mocks `fetchImpl`. Asserts:
 *   - Refuses without env + key + --pilot
 *   - Default provider is xai_responses, legacy_chat_search is opt-in
 *   - Sanitizer strips secrets + X identifiers from any logged string
 *   - No source file logs Authorization / Bearer values
 *   - Response body is cancelled / drained
 *   - Returns redacted topic candidates
 */
import * as fs from 'fs';
import * as path from 'path';

const provider = require('../scripts/engagement-intelligence/xaiAdversarialProvider');

describe('sanitizeForLog — strips secrets + X identifiers', () => {
  it('strips xai- / sk-ant- / sb_secret_ / JWT / Bearer / Authorization', () => {
    const dirty = 'failed Bearer sk-ant-abc123abc123abc123 xai-secret-1234567890 sb_secret_FAKE12345 Authorization: Bearer foo eyJhbGciOiJIUzI1NiJ9.payload.sig';
    const clean = provider.sanitizeForLog(dirty);
    expect(clean).not.toMatch(/sk-ant-abc/);
    expect(clean).not.toMatch(/xai-secret/);
    expect(clean).not.toMatch(/sb_secret_FAKE/);
    expect(clean).not.toMatch(/eyJhbGciOiJIUzI1NiJ9/);
    expect(clean).toMatch(/Bearer \[redacted\]/);
    expect(clean).toMatch(/Authorization: \[redacted\]/);
  });

  it('strips X handles, x.com URLs, t.co URLs, twitter.com URLs, emails', () => {
    const dirty = '@SomeHandle posted at https://x.com/x/status/12345 via https://t.co/abcd and twitter.com/foo, contact user@example.com';
    const clean = provider.sanitizeForLog(dirty);
    expect(clean).not.toMatch(/@SomeHandle/);
    expect(clean).not.toMatch(/x\.com/);
    expect(clean).not.toMatch(/t\.co/);
    expect(clean).not.toMatch(/twitter\.com/);
    expect(clean).not.toMatch(/user@example\.com/);
  });

  it('strips standalone 18-19 digit post-id-like strings', () => {
    const dirty = 'see post id 1834567890123456789 for receipts';
    const clean = provider.sanitizeForLog(dirty);
    expect(clean).not.toMatch(/1834567890123456789/);
    expect(clean).toContain('<x-id>');
  });
});

describe('Provider gating — both providers refuse without --pilot or env', () => {
  beforeEach(() => {
    delete process.env.XAI_API_KEY;
    delete process.env.ENGAGEMENT_INTEL_ENABLE_XAI;
  });

  it('xaiResponsesProvider refuses without --pilot', async () => {
    process.env.ENGAGEMENT_INTEL_ENABLE_XAI = 'true';
    process.env.XAI_API_KEY = 'xai-test-DUMMY-shouldneverleak';
    await expect(provider.xaiResponsesProvider({ topicHint: 'x', count: 3, pilot: false })).rejects.toThrow(/no_pilot_flag/);
  });

  it('xaiResponsesProvider refuses with explicit-empty XAI_API_KEY', async () => {
    process.env.ENGAGEMENT_INTEL_ENABLE_XAI = 'true';
    process.env.XAI_API_KEY = '';
    await expect(provider.xaiResponsesProvider({ topicHint: 'x', count: 3, pilot: true })).rejects.toThrow(/api_key_missing/);
  });

  it('legacyXaiChatSearchProvider refuses without --pilot', async () => {
    process.env.ENGAGEMENT_INTEL_ENABLE_XAI = 'true';
    process.env.XAI_API_KEY = 'xai-test-DUMMY-shouldneverleak';
    await expect(provider.legacyXaiChatSearchProvider({ topicHint: 'x', count: 3, pilot: false })).rejects.toThrow(/no_pilot_flag/);
  });

  it('pickProvider defaults to xai_responses and only switches on explicit legacy label', () => {
    expect(provider.pickProvider('xai_responses')).toBe(provider.xaiResponsesProvider);
    expect(provider.pickProvider(undefined)).toBe(provider.xaiResponsesProvider);
    expect(provider.pickProvider('nonsense')).toBe(provider.xaiResponsesProvider);
    expect(provider.pickProvider('legacy_chat_search')).toBe(provider.legacyXaiChatSearchProvider);
  });
});

describe('xaiResponsesProvider — successful response', () => {
  beforeEach(() => {
    process.env.ENGAGEMENT_INTEL_ENABLE_XAI = 'true';
    process.env.XAI_API_KEY = 'xai-test-DUMMY-shouldneverleak';
  });

  it('returns sanitized topics from a 200 Responses payload (output_text path)', async () => {
    const fetchImpl = async () => ({
      status: 200,
      body: { cancel: async () => undefined },
      json: async () => ({
        output_text: JSON.stringify({
          topics: [
            { topicBucket: 'civic-test', sourceClaimSummary: 'Test claim',
              sourceClaimType: 'claim', sourceTextRedacted: 'A test excerpt about civic discourse.',
              providerRank: 1, providerConfidence: 0.7, citationRefs: ['cit-1'] },
          ],
        }),
      }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    const r = await provider.xaiResponsesProvider({ topicHint: 'civic', count: 5, pilot: true, fetchImpl });
    expect(r.provider).toBe('xai_responses');
    expect(r.rawTopics).toHaveLength(1);
    expect(r.rawTopics[0].topicBucket).toBe('civic-test');
  });

  it('returns sanitized topics from a 200 Responses payload (output array path)', async () => {
    const fetchImpl = async () => ({
      status: 200,
      body: { cancel: async () => undefined },
      json: async () => ({
        output: [{ content: [{ text: JSON.stringify({ topics: [{ topicBucket: 'energy', sourceClaimSummary: 'X', sourceTextRedacted: 'Y' }] }) }] }],
      }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    const r = await provider.xaiResponsesProvider({ topicHint: 'energy', count: 5, pilot: true, fetchImpl });
    expect(r.rawTopics[0].topicBucket).toBe('energy');
  });

  it('throws redacted error on transport failure (no key leak)', async () => {
    const fetchImpl = async () => { throw new Error('boom xai-test-DUMMY-shouldneverleak'); };
    let err: Error | null = null;
    try { await provider.xaiResponsesProvider({ topicHint: 'x', count: 3, pilot: true, fetchImpl }); } catch (e) { err = e as Error; }
    expect(err).toBeTruthy();
    expect(err!.message).not.toMatch(/xai-test-DUMMY-shouldneverleak/);
  });

  it('throws on non-200 status', async () => {
    const fetchImpl = async () => ({
      status: 429, body: { cancel: async () => undefined }, arrayBuffer: async () => new ArrayBuffer(0),
    });
    await expect(provider.xaiResponsesProvider({ topicHint: 'x', count: 3, pilot: true, fetchImpl })).rejects.toThrow(/http_429/);
  });

  it('throws when the JSON payload cannot be extracted', async () => {
    const fetchImpl = async () => ({
      status: 200, body: { cancel: async () => undefined },
      json: async () => ({ output_text: 'not json' }), arrayBuffer: async () => new ArrayBuffer(0),
    });
    await expect(provider.xaiResponsesProvider({ topicHint: 'x', count: 3, pilot: true, fetchImpl })).rejects.toThrow(/responses_returned_unusable_payload/);
  });
});

describe('Source file — provider hygiene', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'scripts/engagement-intelligence/xaiAdversarialProvider.js'), 'utf8');

  it('does not console.log Authorization / Bearer values', () => {
    expect(src).not.toMatch(/console\.\w+\([^)]*Authorization[^)]*\$\{/);
    expect(src).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
  });

  it('uses Responses + x_search tool by default', () => {
    expect(src).toMatch(/tools:\s*\[\{\s*type:\s*['"]x_search['"]/);
    expect(src).toContain('/v1/responses');
  });

  it('exposes both providers + a pickProvider that defaults to xai_responses', () => {
    expect(src).toMatch(/xaiResponsesProvider/);
    expect(src).toMatch(/legacyXaiChatSearchProvider/);
    expect(src).toMatch(/return xaiResponsesProvider/);
  });

  it('releases the response body before propagating status', () => {
    expect(src).toMatch(/releaseResponseBody/);
  });

  it('forbids user labels in system prompt', () => {
    for (const t of ['liar', 'propagandist', 'extremist', 'troll', 'bot', 'astroturfer', 'bad-faith', 'dishonest', 'manipulative']) {
      expect(src).toContain(t);
    }
  });
});
