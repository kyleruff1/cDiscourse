/**
 * MCP-019 — `clientRedaction` tests.
 *
 * `redactBody` is the conservative client-side first-pass redactor (Defect 2).
 * These tests cover the four PII shapes it strips, ordinary-prose passthrough,
 * idempotence, the null / non-string guard, and a source-scan that proves no
 * contiguous real-key-shaped literal sits in the source file.
 */
import * as fs from 'fs';
import * as path from 'path';
import { redactBody, _redactionPatternCount } from '../src/features/semanticReferee/clientRedaction';

describe('redactBody — PII shapes are stripped', () => {
  it('strips an @handle-shape token', () => {
    const out = redactBody('I think @somehandle is wrong about lanes.');
    expect(out).not.toContain('@somehandle');
    expect(out).toContain('[redacted]');
  });

  it('strips an http(s) URL including its path', () => {
    const out = redactBody('See https://example.com/path?q=1 for the data.');
    expect(out).not.toContain('https://example.com');
    expect(out).toContain('[redacted]');
  });

  it('strips a bare x.com / t.co host', () => {
    const out = redactBody('posted at x.com/someuser/status earlier');
    expect(out).not.toContain('x.com/someuser');
    expect(out).toContain('[redacted]');
  });

  it('strips an email-shape string', () => {
    const out = redactBody('contact me at person.name@mail.example to discuss');
    expect(out).not.toContain('person.name@mail.example');
    expect(out).toContain('[redacted]');
  });

  it('strips a long digit run (phone / id shape)', () => {
    const out = redactBody('the post id was 1234567890123456 in the thread');
    expect(out).not.toContain('1234567890123456');
    expect(out).toContain('[redacted]');
  });

  it('strips a secret-shape token assembled at runtime', () => {
    // Assemble the key shape here so this TEST file carries no literal either.
    const secret = 's' + 'k-' + 'ant-' + 'A'.repeat(20);
    const out = redactBody(`leaked ${secret} oops`);
    expect(out).not.toContain(secret);
    expect(out).toContain('[redacted]');
  });
});

describe('redactBody — ordinary prose is preserved', () => {
  it('leaves a normal argument body intact', () => {
    const body = 'Bike lanes reduce car traffic because cyclists replace short car trips.';
    expect(redactBody(body)).toBe(body);
  });

  it('does not redact a short number (years, counts)', () => {
    const body = 'In 2024 the city added 12 new lanes.';
    expect(redactBody(body)).toBe(body);
  });

  it('does not redact an email-less @ used as "at" prose with whitespace', () => {
    // "meet @ 3pm" — the @ is followed by whitespace, not a handle.
    const body = 'meet @ 3pm to argue';
    expect(redactBody(body)).toBe(body);
  });
});

describe('redactBody — guards and idempotence', () => {
  it('returns "" for null / undefined / non-string input', () => {
    expect(redactBody(null)).toBe('');
    expect(redactBody(undefined)).toBe('');
    // @ts-expect-error — defensive runtime guard for a non-string input.
    expect(redactBody(42)).toBe('');
  });

  it('returns "" for an empty string', () => {
    expect(redactBody('')).toBe('');
  });

  it('is idempotent — redactBody(redactBody(x)) === redactBody(x)', () => {
    const inputs = [
      'See https://example.com and email a@b.co and @handle and 1234567890123.',
      'plain prose with nothing to redact',
      '',
    ];
    for (const input of inputs) {
      const once = redactBody(input);
      expect(redactBody(once)).toBe(once);
    }
  });

  it('never throws on adversarial input', () => {
    expect(() => redactBody('@'.repeat(500))).not.toThrow();
    expect(() => redactBody('http://'.repeat(200))).not.toThrow();
  });
});

describe('clientRedaction — pattern table + source hygiene', () => {
  it('_redactionPatternCount is non-zero', () => {
    expect(_redactionPatternCount()).toBeGreaterThan(0);
  });

  it('the source file contains no contiguous real-key-shaped literal', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/features/semanticReferee/clientRedaction.ts'),
      'utf8',
    );
    // The secret prefixes must be fragment-assembled — no contiguous literal.
    expect(src).not.toMatch(/sk-ant-/);
    expect(src).not.toMatch(/\bxai-/);
    expect(src).not.toMatch(/\bBearer /);
    expect(src).not.toMatch(/sb_secret_/);
  });

  it('the source imports no React / react-native / Supabase', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/features/semanticReferee/clientRedaction.ts'),
      'utf8',
    );
    // Scan only `import` statements — a doc comment that says "no Supabase"
    // is accurate documentation, not a dependency.
    const importLines = src
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line));
    expect(importLines.length).toBe(0);
    expect(src).not.toMatch(/from ['"]react['"]/);
    expect(src).not.toMatch(/from ['"]react-native['"]/);
    expect(src).not.toMatch(/from ['"][^'"]*supabase[^'"]*['"]/i);
  });
});
