/**
 * EMAIL-TRANSPORT-001 — test class 1: getEmailProvider factory.
 *
 * `emailProvider.ts` imports `resendProvider.ts` (which reads the Deno global)
 * with a `.ts`-extension specifier, so it is NOT loadable into a tsc-checked
 * Jest test (the established Deno-Edge testing constraint — see
 * `inviteSchemas.test.ts` / `roomNotifications.edge.test.ts`). We SOURCE-SCAN
 * the factory's resolution rules; the runtime gate behavior is proven against
 * the orchestrator's structural ladder (emailMasterGate.test.ts) and the
 * provider request shape (resendProviderRequest.test.ts).
 */
import fs from 'fs';
import path from 'path';

const FACTORY_SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', '_shared', 'email', 'emailProvider.ts'),
  'utf8',
);
// Comment-stripped view: interface field scans must ignore the doctrine-negation
// comments ("carries NO recipient / NO secret") that legitimately name the
// forbidden tokens.
const FACTORY_CODE = FACTORY_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('getEmailProvider — provider selection rules', () => {
  it('defaults to the resend provider when CDISCOURSE_EMAIL_PROVIDER is unset', () => {
    expect(FACTORY_SRC).toMatch(/env\.CDISCOURSE_EMAIL_PROVIDER \|\| 'resend'/);
    // Provider id is normalized lower-case (case-insensitive selection).
    expect(FACTORY_SRC).toContain('.trim().toLowerCase()');
  });

  it('returns the resend provider only when RESEND_API_KEY is present', () => {
    const resendBlock = FACTORY_SRC.slice(
      FACTORY_SRC.indexOf("if (providerId === 'resend')"),
      FACTORY_SRC.indexOf("if (providerId === 'postmark')"),
    );
    expect(resendBlock).toContain('env.RESEND_API_KEY');
    expect(resendBlock).toMatch(/if \(!key\) return null;/);
    expect(resendBlock).toContain('return resendProvider;');
  });

  it('returns null for postmark (documented swap path; adapter not built this card)', () => {
    const postmarkBlock = FACTORY_SRC.slice(FACTORY_SRC.indexOf("if (providerId === 'postmark')"));
    expect(postmarkBlock).toMatch(/return null;/);
    expect(FACTORY_SRC).not.toMatch(/import .*postmarkProvider/);
  });

  it('returns null for an unrecognized provider id (final fallthrough)', () => {
    // After the resend + postmark branches, the function returns null.
    const tail = FACTORY_SRC.slice(FACTORY_SRC.lastIndexOf("if (providerId === 'postmark')"));
    expect(tail.trimEnd().endsWith('}')).toBe(true);
    expect((tail.match(/return null;/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('never reads a .env file (env is passed in, no fs / dotenv / readFile)', () => {
    expect(FACTORY_SRC).not.toMatch(/from\s+['"]fs['"]/);
    expect(FACTORY_SRC).not.toMatch(/from\s+['"]node:fs['"]/);
    expect(FACTORY_SRC).not.toMatch(/from\s+['"]dotenv['"]/);
    expect(FACTORY_SRC).not.toMatch(/readFileSync/);
  });

  it('never returns or logs the key value (presence-only check)', () => {
    expect(FACTORY_SRC).not.toMatch(/console\.\w+\([^)]*RESEND_API_KEY/);
    expect(FACTORY_SRC).toMatch(/const key = \(env\.RESEND_API_KEY \|\| ''\)\.trim\(\);/);
  });
});

describe('EmailSendResult — audit-safe shape', () => {
  it('the interface declares only status + providerStatusClass (no recipient/body/key)', () => {
    const start = FACTORY_CODE.indexOf('interface EmailSendResult');
    const block = FACTORY_CODE.slice(start, start + 300);
    expect(block).toContain('status:');
    expect(block).toContain('providerStatusClass?:');
    expect(block.toLowerCase()).not.toMatch(/recipient/);
    expect(block.toLowerCase()).not.toMatch(/\bto:/);
    expect(block.toLowerCase()).not.toMatch(/body/);
    expect(block.toLowerCase()).not.toMatch(/messageid/);
  });

  it('declares the neutral status values the design names', () => {
    for (const v of ['sent', 'not_configured', 'skipped_gate_off', 'failed_sanitized', 'blocked_banned_copy']) {
      expect(FACTORY_SRC).toContain(`'${v}'`);
    }
  });

  it('the TransactionalEmailMessage type carries no token/secret/internal-code field', () => {
    const start = FACTORY_CODE.indexOf('interface TransactionalEmailMessage');
    const block = FACTORY_CODE.slice(start, start + 500);
    expect(block).not.toMatch(/token/i);
    expect(block).not.toMatch(/apiKey/i);
    expect(block).not.toMatch(/secret/i);
  });
});
