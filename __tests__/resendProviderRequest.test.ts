/**
 * EMAIL-TRANSPORT-001 — test class 8: the Resend HTTP adapter request shape.
 *
 * `resendProvider.ts` reads the Deno global, so (per the established Deno-Edge
 * testing constraint) we source-scan the adapter for: the endpoint URL, the
 * Authorization:Bearer header built in-place, the body `{ from, to:[...],
 * reply_to, subject, html, text }`, the 2xx→sent / non-2xx→failed_sanitized +
 * class / throw→network_error mapping, and the body-drained-not-echoed posture.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', '_shared', 'email', 'resendProvider.ts'),
  'utf8',
);

describe('resendProvider — request shape', () => {
  it('POSTs to the Resend HTTP endpoint', () => {
    expect(SRC).toContain("const RESEND_ENDPOINT = 'https://api.resend.com/emails';");
    expect(SRC).toMatch(/fetch\(RESEND_ENDPOINT, \{/);
    expect(SRC).toMatch(/method: 'POST'/);
  });

  it('builds the Authorization: Bearer header in-place (key never assigned to a logged var)', () => {
    const authLine = SRC.split('\n').find((l) => l.includes('Bearer ${apiKey}'));
    expect(authLine).toBeDefined();
    expect(authLine?.toLowerCase()).not.toMatch(/console\./);
    expect(SRC).toContain("'content-type': 'application/json'");
  });

  it('reads RESEND_API_KEY from Deno.env and gates a missing key to not_configured (no fetch)', () => {
    expect(SRC).toContain("Deno.env.get('RESEND_API_KEY')");
    const keyIdx = SRC.indexOf("Deno.env.get('RESEND_API_KEY')");
    const guardIdx = SRC.indexOf("if (!apiKey)");
    const fetchIdx = SRC.indexOf('fetch(RESEND_ENDPOINT');
    expect(keyIdx).toBeLessThan(guardIdx);
    expect(guardIdx).toBeLessThan(fetchIdx);
    expect(SRC).toMatch(/if \(!apiKey\) \{[\s\S]{0,80}?return \{ status: 'not_configured' \};/);
  });

  it('sends the body { from, to:[to], subject, html, text } + conditional reply_to', () => {
    expect(SRC).toContain('from: message.from,');
    expect(SRC).toContain('to: [message.to],');
    expect(SRC).toContain('subject: message.subject,');
    expect(SRC).toContain('html: message.html,');
    expect(SRC).toContain('text: message.text,');
    expect(SRC).toMatch(/if \(message\.replyTo\) payload\.reply_to = message\.replyTo;/);
  });
});

describe('resendProvider — outcome mapping', () => {
  it('2xx → sent + ok', () => {
    expect(SRC).toMatch(/return \{ status: 'sent', providerStatusClass: 'ok' \};/);
  });

  it('non-2xx → failed_sanitized with a 4xx/5xx class, body drained not echoed', () => {
    expect(SRC).toContain('if (!res.ok)');
    expect(SRC).toMatch(/res\.status >= 500 \? 'provider_5xx' : 'provider_4xx'/);
    expect(SRC).toMatch(/return \{ status: 'failed_sanitized', providerStatusClass \};/);
    // The body is drained inside a try/catch without being assigned/logged.
    expect(SRC).toMatch(/try \{ await res\.text\(\); \} catch/);
    expect(SRC).not.toMatch(/console\.\w+\([^)]*res\.text/);
  });

  it('thrown fetch → failed_sanitized + network_error', () => {
    expect(SRC).toMatch(/catch \{[\s\S]{0,120}?return \{ status: 'failed_sanitized', providerStatusClass: 'network_error' \};/);
  });

  it('the success body is also drained (best-effort) so nothing is echoed', () => {
    // Two `await res.text()` drains: the !res.ok branch + the success branch.
    const drains = (SRC.match(/await res\.text\(\)/g) || []).length;
    expect(drains).toBeGreaterThanOrEqual(2);
  });
});

describe('resendProvider — audit-safe + no leak', () => {
  it('the provider has no console.* at all (nothing to leak)', () => {
    expect(SRC).not.toMatch(/console\./);
  });

  it('returns only status + providerStatusClass (no recipient/body/key/messageId)', () => {
    const returns = SRC.match(/return \{ status:[^}]*\};/g) || [];
    expect(returns.length).toBeGreaterThan(0);
    for (const r of returns) {
      expect(r.toLowerCase()).not.toMatch(/recipient/);
      expect(r.toLowerCase()).not.toMatch(/messageid/);
      expect(r.toLowerCase()).not.toMatch(/apikey/);
      expect(r).not.toMatch(/\bto:/);
    }
  });
});
