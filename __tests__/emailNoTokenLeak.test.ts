/**
 * EMAIL-TRANSPORT-001 — test class 6: no raw token / secret / recipient leak.
 *
 * Source-scan (the Edge modules import Deno `.ts` chains, not tsc-loadable):
 *   - the render module places the token ONLY inside the redemption href, never
 *     as a standalone field or a "token:" label;
 *   - the EmailSendResult interface carries NO recipient/body/key;
 *   - the TransactionalEmailMessage interface carries NO token/secret field;
 *   - the orchestrator builds the message from { from, to, subject, html, text,
 *     replyTo? } only — no token field.
 */
import fs from 'fs';
import path from 'path';

const EMAIL_DIR = path.join(process.cwd(), 'supabase', 'functions', '_shared', 'email');
const TPL_SRC = fs.readFileSync(path.join(EMAIL_DIR, 'emailTemplates.ts'), 'utf8');
const PROVIDER_SRC = fs.readFileSync(path.join(EMAIL_DIR, 'emailProvider.ts'), 'utf8');
const ORCH_SRC = fs.readFileSync(path.join(EMAIL_DIR, 'sendTransactionalEmail.ts'), 'utf8');

/** Strip block + line comments so interface field scans ignore the
 *  doctrine-negation comments ("NO token field, NO secret field"). */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}
const PROVIDER_CODE = codeOnly(PROVIDER_SRC);

describe('render module — the token appears only inside the redemption href', () => {
  it('the redemption URL is consumed only via the escaped href (no standalone token field)', () => {
    // The only places the URL/token reaches output are the two hrefSafe hrefs +
    // the text "Open invitation: ${url}". There is no `token:` field anywhere.
    expect(TPL_SRC).toContain('href="${hrefSafe}"');
    expect(TPL_SRC).toContain('`Open invitation: ${url}`');
    expect(TPL_SRC).not.toMatch(/token:\s/);
    // The input type names redemptionUrl, never a bare `token` field.
    const inputIface = TPL_SRC.slice(
      TPL_SRC.indexOf('interface ArgumentRoomInviteEmailInput'),
      TPL_SRC.indexOf('interface ArgumentRoomInviteEmailInput') + 600,
    );
    expect(inputIface).toContain('redemptionUrl:');
    expect(inputIface).not.toMatch(/^\s*token:/m);
  });

  it('the render module never logs anything (pure)', () => {
    expect(TPL_SRC).not.toMatch(/console\./);
  });
});

describe('EmailSendResult — audit-safe (no recipient / body / key)', () => {
  it('the result interface declares only status + providerStatusClass', () => {
    const start = PROVIDER_CODE.indexOf('interface EmailSendResult');
    const block = PROVIDER_CODE.slice(start, PROVIDER_CODE.indexOf('}', start) + 1);
    const fieldNames = (block.match(/^\s*([a-zA-Z]+)\??:/gm) || []).map((s) => s.trim().replace(/\??:$/, ''));
    expect(fieldNames.sort()).toEqual(['providerStatusClass', 'status']);
  });
});

describe('TransactionalEmailMessage — no token / secret field', () => {
  it('the message interface carries to/from/replyTo/subject/html/text only', () => {
    const start = PROVIDER_CODE.indexOf('interface TransactionalEmailMessage');
    const block = PROVIDER_CODE.slice(start, PROVIDER_CODE.indexOf('}', start) + 1);
    expect(block).not.toMatch(/token/i);
    expect(block).not.toMatch(/apiKey/i);
    expect(block).not.toMatch(/secret/i);
    // The declared fields are exactly the audit-safe set.
    const fieldNames = (block.match(/^\s*([a-zA-Z]+)\??:/gm) || []).map((s) => s.trim().replace(/\??:$/, ''));
    expect(fieldNames.sort()).toEqual(['from', 'html', 'replyTo', 'subject', 'text', 'to']);
  });

  it('the orchestrator builds the message with no token field', () => {
    const msgBlock = ORCH_SRC.slice(ORCH_SRC.indexOf('const message: TransactionalEmailMessage'), ORCH_SRC.indexOf('return provider.send(message);'));
    expect(msgBlock).toContain('to,');
    expect(msgBlock).toContain('from,');
    expect(msgBlock).toContain('subject,');
    expect(msgBlock).toContain('html,');
    expect(msgBlock).toContain('text,');
    expect(msgBlock).not.toMatch(/token/i);
    expect(msgBlock).not.toMatch(/apiKey/i);
  });
});
