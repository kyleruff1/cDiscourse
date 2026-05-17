/**
 * Engagement intelligence redaction tests.
 *
 * Asserts that anything we might commit goes through redactors that strip
 * handles, URLs, emails, secret-shape tokens, and that IDs become hashes.
 */
import {
  redactPublicText,
  redactHandles,
  redactUrls,
  redactEmails,
  redactPhoneNumbers,
  hashStableId,
  fingerprintText,
  assertNoSecretsInEngagementOutput,
  redactPotentialNames,
  normalizeWhitespace,
} from '../src/features/engagementIntelligence/redaction';

describe('redaction primitives', () => {
  it('redactHandles strips @handles', () => {
    expect(redactHandles('thanks @alice and @bob_42')).not.toMatch(/@alice/);
    expect(redactHandles('thanks @alice and @bob_42')).toContain('<handle>');
  });

  it('redactUrls strips http(s) URLs', () => {
    expect(redactUrls('see https://example.com/path?q=1 for more')).not.toContain('example.com/path');
  });

  it('redactEmails strips emails', () => {
    expect(redactEmails('contact bob@example.com')).not.toContain('bob@example.com');
  });

  it('redactPhoneNumbers strips phone-shape strings', () => {
    expect(redactPhoneNumbers('call +1 (415) 555-0199')).toContain('<phone>');
  });

  it('redactPublicText composes all redactors', () => {
    const s = redactPublicText('hi @alice see https://t.co/abc email bob@x.io call 415-555-0199 token=eyJabcdefghij.eyJxyz');
    expect(s).not.toMatch(/@alice/);
    expect(s).not.toContain('t.co/abc');
    expect(s).not.toContain('bob@x.io');
    expect(s).toContain('<phone>');
    expect(s).toContain('[redacted]');
  });

  it('hashStableId is deterministic and short', () => {
    const a = hashStableId('raw-tweet-id-12345');
    const b = hashStableId('raw-tweet-id-12345');
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
    expect(a).toMatch(/^[a-f0-9]{16}$/);
  });

  it('hashStableId is salt-sensitive', () => {
    expect(hashStableId('x', 's1')).not.toBe(hashStableId('x', 's2'));
  });

  it('fingerprintText normalizes case + whitespace before hashing', () => {
    expect(fingerprintText('Hello   World')).toBe(fingerprintText('hello world'));
  });

  it('normalizeWhitespace collapses runs', () => {
    expect(normalizeWhitespace('  a\n\tb   c ')).toBe('a b c');
  });

  it('assertNoSecretsInEngagementOutput throws on JWT-shape tokens', () => {
    expect(() => assertNoSecretsInEngagementOutput('header token=eyJabcdefghij.eyJxyzdef')).toThrow(/secret/i);
  });

  it('assertNoSecretsInEngagementOutput throws on plaintext emails', () => {
    expect(() => assertNoSecretsInEngagementOutput('contact bob@example.com')).toThrow(/email/i);
  });

  it('assertNoSecretsInEngagementOutput throws on @handles', () => {
    expect(() => assertNoSecretsInEngagementOutput('hi @alice')).toThrow(/handle/i);
  });

  it('redactPotentialNames replaces "First Last" pairs', () => {
    expect(redactPotentialNames('John Smith said yes')).toContain('<name>');
    expect(redactPotentialNames('open table')).not.toContain('<name>');
  });
});

describe('normalizeXSample (Node-side)', () => {
  const normalize = require('../scripts/engagement-intelligence/normalizeXSample.js');

  it('shortHash is deterministic', () => {
    const a = normalize.shortHash('abc');
    const b = normalize.shortHash('abc');
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });

  it('redact() strips handles, URLs, emails, and secret-shape tokens', () => {
    const s = normalize.redact('hi @bob see https://t.co/x mail bob@x.io Bearer eyJabcdefghij.eyJxyz');
    expect(s).not.toMatch(/@bob/);
    expect(s).not.toContain('t.co/x');
    expect(s).not.toContain('bob@x.io');
    expect(s).toContain('[redacted]');
  });

  it('normalizePublicPost hashes IDs and redacts text', () => {
    const norm = normalize.normalizePublicPost({
      id: '12345',
      text: 'check https://x.com/foo @alice please',
      created_at: '2026-05-17T00:00:00Z',
      lang: 'en',
      conversation_id: 'conv-99',
      author_id: 'au-1',
      public_metrics: { reply_count: 4, retweet_count: 2, quote_count: 1, like_count: 80 },
    });
    expect(norm.postIdHash).toHaveLength(16);
    expect(norm.textRedacted).not.toMatch(/@alice/);
    expect(norm.textRedacted).not.toContain('x.com/foo');
    expect(norm.publicMetrics.likeCount).toBe(80);
    expect(norm.rankSignals.popularityScore).toBeGreaterThan(0);
  });

  it('classifySafety excludes sensitive topics', () => {
    const s = normalize.classifySafety('Discussing self-harm in this thread');
    expect(s.shouldExclude).toBe(true);
    expect(s.exclusionReason).toBe('sensitive_topic');
  });

  it('buildReplyPair never carries raw post text outside redacted fields', () => {
    const root = normalize.normalizePublicPost({ id: 'A', text: 'root @alice', public_metrics: {} });
    const reply = normalize.normalizePublicPost({ id: 'B', text: 'reply https://t.co/x', public_metrics: {} });
    const pair = normalize.buildReplyPair(root, reply, 1);
    const text = JSON.stringify(pair);
    expect(text).not.toMatch(/@alice/);
    expect(text).not.toContain('t.co/x');
    expect(pair.pairId).toHaveLength(16);
  });
});
