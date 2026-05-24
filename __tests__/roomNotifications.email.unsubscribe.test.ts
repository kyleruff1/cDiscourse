/**
 * QOL-040 — the email body MUST NOT contain an unsubscribe link
 * or any "manage preferences" affordance in v1. Per E1.2a +
 * E3.4 + E7.1, the unsubscribe pathway is deferred along with
 * preferences. Adding a link that points nowhere would be more
 * confusing than shipping no link.
 *
 * This test is a defensive source-scan: a future engineer who
 * adds an unsubscribe link without also wiring the preferences
 * surface is caught.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'room-notifications', 'index.ts'),
  'utf8',
);

const ABSENT_TOKENS = [
  'unsubscribe',
  'opt out',
  'opt-out',
  'manage preferences',
  'manage your preferences',
  'preferences link',
  'mailing list',
];

describe('room-notifications email — no unsubscribe pathway in v1', () => {
  it('does not contain any unsubscribe-related token in any string literal', () => {
    // Extract every quoted string literal in the source so the
    // test does not false-positive on a JSDoc note that
    // legitimately mentions "unsubscribe was deferred".
    const literals: string[] = [];
    const re = /'([^'\\\n]*(?:\\.[^'\\\n]*)*)'|"([^"\\\n]*(?:\\.[^"\\\n]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(SRC)) !== null) {
      const lit = m[1] ?? m[2] ?? m[3] ?? '';
      if (lit) literals.push(lit.toLowerCase());
    }
    for (const lit of literals) {
      for (const token of ABSENT_TOKENS) {
        expect({ token, lit }).toMatchObject({
          token,
          lit: expect.not.stringContaining(token),
        });
      }
    }
  });

  it('the email body assembly does not link to an unsubscribe route', () => {
    // The body is assembled inside `maybeSendInviteEmail`. Scan
    // for /unsubscribe URL paths.
    expect(SRC).not.toMatch(/\/unsubscribe/i);
    expect(SRC).not.toMatch(/\/preferences/i);
  });
});
