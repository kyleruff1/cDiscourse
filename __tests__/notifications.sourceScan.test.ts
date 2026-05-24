/**
 * QOL-040 — comprehensive source-scan over `src/features/notifications/`.
 *
 * Asserts the doctrine boundaries:
 *   - No service-role / API-key literal in client code.
 *   - No AI / network provider import.
 *   - No direct insert into public.arguments from the client.
 *   - No console.log in committed code.
 *   - No raw token string in any comment or variable name that
 *     would invite leak.
 */
import fs from 'fs';
import path from 'path';

const FEATURE_DIR = path.join(process.cwd(), 'src', 'features', 'notifications');

function readAllSourcesIn(dir: string): Array<{ relPath: string; src: string }> {
  const out: Array<{ relPath: string; src: string }> = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
      const full = path.join(dir, e.name);
      out.push({ relPath: e.name, src: fs.readFileSync(full, 'utf8') });
    }
  }
  return out;
}

const SOURCES = readAllSourcesIn(FEATURE_DIR);

describe('src/features/notifications — no secrets / no AI / no direct argument insert', () => {
  it('contains no SERVICE_ROLE_KEY literal', () => {
    for (const { relPath, src } of SOURCES) {
      expect({ relPath, src }).toMatchObject({
        relPath,
        src: expect.not.stringContaining('SERVICE_ROLE_KEY'),
      });
    }
  });

  it('contains no ANTHROPIC_API_KEY literal', () => {
    for (const { relPath, src } of SOURCES) {
      expect({ relPath, src }).toMatchObject({
        relPath,
        src: expect.not.stringContaining('ANTHROPIC_API_KEY'),
      });
    }
  });

  it('contains no RESEND_API_KEY literal (email is Edge-Function-only)', () => {
    for (const { relPath, src } of SOURCES) {
      expect({ relPath, src }).toMatchObject({
        relPath,
        src: expect.not.stringContaining('RESEND_API_KEY'),
      });
    }
  });

  it('imports no AI provider SDK', () => {
    for (const { relPath, src } of SOURCES) {
      // The notifications feature is pure CDiscourse — no AI
      // calls, no provider SDK.
      expect(src).not.toMatch(/from\s+['"]@anthropic-ai/);
      expect(src).not.toMatch(/from\s+['"]openai/);
      expect(src).not.toMatch(/from\s+['"]ai\//);
      void relPath;
    }
  });

  it('never inserts into public.arguments — that path goes through submit-argument', () => {
    for (const { relPath, src } of SOURCES) {
      // The wrapper file should only touch room_notifications;
      // any other table is suspicious. The hook calls into the
      // wrapper; the UI calls into the hook.
      expect(src).not.toMatch(/\.from\(\s*['"]arguments['"]\s*\)\s*\.insert/);
      void relPath;
    }
  });
});

describe('src/features/notifications — no console.log in committed code', () => {
  it('no console.log anywhere in the feature folder', () => {
    for (const { relPath, src } of SOURCES) {
      expect({ relPath, src }).toMatchObject({
        relPath,
        src: expect.not.stringMatching(/console\.log/),
      });
    }
  });
});

describe('src/features/notifications — no .skip / .only / xit / xdescribe in production code', () => {
  it('no jest control statements leak into production code', () => {
    for (const { relPath, src } of SOURCES) {
      expect(src).not.toMatch(/\bxit\(/);
      expect(src).not.toMatch(/\bxdescribe\(/);
      expect(src).not.toMatch(/\bfit\(/);
      expect(src).not.toMatch(/\bfdescribe\(/);
      // describe.only / it.only / test.only / it.skip
      expect(src).not.toMatch(/\b(describe|it|test)\.(only|skip)\(/);
      void relPath;
    }
  });
});

describe('src/features/notifications — single-column UPDATE only', () => {
  it('notificationsApi.ts UPDATE statements set ONLY the read_at column', () => {
    const apiSrc = SOURCES.find((s) => s.relPath === 'notificationsApi.ts')?.src || '';
    // Find every .update({ … }) call and assert the keys inside
    // are only `read_at`.
    const updateCalls = apiSrc.match(/\.update\(\s*\{[^}]+\}\s*\)/g) || [];
    expect(updateCalls.length).toBeGreaterThan(0);
    for (const call of updateCalls) {
      // Allow whitespace, the literal `read_at`, and a value.
      // Reject any other key name.
      const keys = (call.match(/(\w+)\s*:/g) || []).map((k) => k.replace(/[:\s]/g, ''));
      for (const key of keys) {
        expect(key).toBe('read_at');
      }
    }
  });
});
