/**
 * QOL-040 — email scaffold behaviour matrix tests for
 * `maybeSendInviteEmail` in supabase/functions/room-notifications/index.ts.
 *
 * The function file uses Deno-only imports and cannot be loaded
 * by Jest. We assert the four matrix cases by source-scanning
 * the helper's control-flow shape — the same pattern the
 * roomNotifications.edge.test.ts file uses.
 *
 * Matrix:
 *   1. INVITE_EMAIL_ENABLED unset or !== 'true' → 'not_configured', NO network call
 *   2. INVITE_EMAIL_ENABLED='true' + (RESEND_API_KEY missing OR INVITE_EMAIL_FROM missing) → 'not_configured', NO network call
 *   3. INVITE_EMAIL_ENABLED='true' + Resend 2xx → 'sent'
 *   4. INVITE_EMAIL_ENABLED='true' + Resend non-2xx OR exception → 'queued'
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'room-notifications', 'index.ts'),
  'utf8',
);

// Extract the maybeSendInviteEmail function body.
function helperBody(src: string): string {
  const start = src.indexOf('async function maybeSendInviteEmail');
  expect(start).toBeGreaterThan(-1);
  // End at the next top-level `async function` or `Deno.serve`.
  const nextDecl = (() => {
    const a = src.indexOf('async function ', start + 1);
    const b = src.indexOf('Deno.serve', start);
    if (a > 0 && (b < 0 || a < b)) return a;
    if (b > 0) return b;
    return src.length;
  })();
  return src.slice(start, nextDecl);
}

const HELPER = helperBody(SRC);

describe('maybeSendInviteEmail — matrix case 1: feature flag off → not_configured, no network call', () => {
  it('reads INVITE_EMAIL_ENABLED first', () => {
    // The very first env read must be the feature flag.
    const envReadMatches = HELPER.match(/Deno\.env\.get\('([^']+)'\)/g) || [];
    expect(envReadMatches.length).toBeGreaterThan(0);
    expect(envReadMatches[0]).toBe("Deno.env.get('INVITE_EMAIL_ENABLED')");
  });

  it('returns not_configured early when the flag is not the literal "true"', () => {
    expect(HELPER).toMatch(/enabled !== 'true'/);
    // The early return MUST come before the API key + from
    // reads, and before any fetch call.
    const enabledCheckIdx = HELPER.search(/enabled !== 'true'/);
    const fetchIdx = HELPER.indexOf('fetch(');
    expect(enabledCheckIdx).toBeLessThan(fetchIdx);
  });
});

describe('maybeSendInviteEmail — matrix case 2: flag on but key/from missing → not_configured, no network call', () => {
  it('checks RESEND_API_KEY and INVITE_EMAIL_FROM after the feature flag', () => {
    expect(HELPER).toContain("Deno.env.get('RESEND_API_KEY')");
    expect(HELPER).toContain("Deno.env.get('INVITE_EMAIL_FROM')");
  });

  it('returns not_configured when either is missing, BEFORE the fetch call', () => {
    expect(HELPER).toMatch(/if \(!apiKey \|\| !from\)/);
    const missingConfigIdx = HELPER.search(/if \(!apiKey \|\| !from\)/);
    const fetchIdx = HELPER.indexOf('fetch(');
    expect(missingConfigIdx).toBeGreaterThan(-1);
    expect(missingConfigIdx).toBeLessThan(fetchIdx);
  });

  it('logs a structured "missing configuration" entry on this path (no key value in the log)', () => {
    expect(HELPER).toContain('invite_email_missing_configuration');
    // The log payload must declare booleans for the presence of
    // api key / from, NOT the values themselves.
    const logBlock = HELPER.slice(
      HELPER.indexOf('invite_email_missing_configuration'),
      HELPER.indexOf('invite_email_missing_configuration') + 400,
    );
    expect(logBlock).toMatch(/hasApiKey: Boolean\(apiKey\)/);
    expect(logBlock).toMatch(/hasFrom: Boolean\(from\)/);
  });
});

describe('maybeSendInviteEmail — matrix case 3: 2xx → sent', () => {
  it('POSTs to Resend with the Authorization header built in-place', () => {
    expect(HELPER).toContain('https://api.resend.com/emails');
    expect(HELPER).toContain('Bearer ${apiKey}');
  });

  it("returns 'sent' on res.ok", () => {
    // After `if (!res.ok) { … return 'queued' }` the function
    // returns 'sent'.
    expect(HELPER).toMatch(/return 'sent';/);
  });
});

describe('maybeSendInviteEmail — matrix case 4: non-2xx → queued', () => {
  it("returns 'queued' on res.ok === false", () => {
    expect(HELPER).toMatch(/if \(!res\.ok\)/);
    const failIdx = HELPER.search(/if \(!res\.ok\)/);
    const queuedAfterFail = HELPER.indexOf("return 'queued'", failIdx);
    expect(queuedAfterFail).toBeGreaterThan(failIdx);
  });

  it('drains the response body without echoing it', () => {
    expect(HELPER).toContain('await res.text()');
  });

  it("returns 'queued' on fetch exception (catch branch)", () => {
    // Catch branch must return 'queued' (not 'sent', not throw).
    const catchIdx = HELPER.indexOf('catch (err)');
    expect(catchIdx).toBeGreaterThan(-1);
    const catchBlock = HELPER.slice(catchIdx, catchIdx + 400);
    expect(catchBlock).toContain("return 'queued'");
  });

  it('logs a structured "send failed" entry without echoing the body or the api key', () => {
    expect(HELPER).toContain('invite_email_send_failed');
    expect(HELPER).toContain('invite_email_send_exception');
    // The two structured log entries must not reference the API
    // key, the recipient email, or the response body.
    for (const tag of ['invite_email_send_failed', 'invite_email_send_exception']) {
      const start = HELPER.indexOf(tag);
      const block = HELPER.slice(start, start + 400);
      expect(block).not.toMatch(/apiKey/);
      expect(block).not.toMatch(/recipient/);
      // The body itself must not be interpolated.
      expect(block).not.toMatch(/await res\.text\(\)/);
    }
  });
});

describe('maybeSendInviteEmail — copy', () => {
  it('the email subject is neutral CDiscourse framing (no challenge / game)', () => {
    expect(HELPER).toContain("'You were invited to respond to an argument.'");
    // Subject must not contain banned framing.
    const subjectLine = HELPER.split('\n').find((l) => l.includes("'You were invited"));
    expect(subjectLine).toBeDefined();
    const lower = (subjectLine || '').toLowerCase();
    expect(lower).not.toMatch(/challenge/);
    expect(lower).not.toMatch(/game/);
    expect(lower).not.toMatch(/debate/);
  });

  it('uses QOL-035 terminology — "argument" not "debate" in user-facing copy', () => {
    // The subject and bodyText assembly must use "argument".
    // The variable name `roomTitle` is engineering — fine. The
    // user-visible strings ('Room:', the subject) must use
    // "argument".
    const subjectMatch = HELPER.match(/'You were invited[^']*'/);
    expect(subjectMatch).toBeDefined();
    expect((subjectMatch || [''])[0].toLowerCase()).toContain('argument');
  });
});

describe('maybeSendInviteEmail — InviteEmailStatus union shape', () => {
  it('matches QOL-038 contract: sent | not_configured | queued', () => {
    // The union literal must be exactly these three values, in
    // any order. We assert by checking each value present and
    // none beyond the three.
    expect(SRC).toMatch(/type InviteEmailStatus = 'sent' \| 'not_configured' \| 'queued'/);
    // The exhaustive check: no additional 'failed_sanitized' or
    // 'error' value — those are values used by
    // request-argument-deletion's helper but they were
    // deliberately NOT inherited (the QOL-038 contract is
    // sent | not_configured | queued).
    expect(SRC).not.toContain("'failed_sanitized'");
  });
});
