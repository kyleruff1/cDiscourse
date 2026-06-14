/**
 * QOL-040 / EMAIL-TRANSPORT-001 — email-scaffold safety scan: no Authorization
 * header value, no API key, no recipient email is ever logged.
 *
 * Per cdiscourse-doctrine §6 (secrets policy) + E1.3.
 *
 * EMAIL-TRANSPORT-001 re-point: the Resend `fetch()` + the `Bearer ${apiKey}`
 * header MOVED out of `room-notifications/index.ts` into the shared
 * `supabase/functions/_shared/email/resendProvider.ts`. The Authorization-in-
 * place assertion FOLLOWS the code to that module (it is NOT dropped or
 * weakened). The room-notifications scans below stay: that file must STILL log
 * no Authorization / key / recipient.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'room-notifications', 'index.ts'),
  'utf8',
);

const PROVIDER_SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', '_shared', 'email', 'resendProvider.ts'),
  'utf8',
);

describe('room-notifications — no Authorization header value in any log', () => {
  it('no console.* line contains the substring "authorization" (case insensitive)', () => {
    const lines = SRC.split('\n');
    const offenders: string[] = [];
    for (const line of lines) {
      if (!line.match(/console\.(error|warn|info|debug|log)/)) continue;
      if (line.toLowerCase().includes('authorization')) offenders.push(line.trim());
    }
    expect(offenders).toEqual([]);
  });

  it('room-notifications no longer builds the Resend Authorization header (it moved to resendProvider.ts)', () => {
    // After the EMAIL-TRANSPORT-001 refactor the fetch + Bearer header live in
    // the shared provider. room-notifications must NOT carry the in-place header
    // any more — it delegates through sendTransactionalEmail.
    expect(SRC).not.toContain('Bearer ${apiKey}');
    expect(SRC).not.toContain('api.resend.com');
  });

  it('no console.* line references RESEND_API_KEY', () => {
    const lines = SRC.split('\n');
    const offenders: string[] = [];
    for (const line of lines) {
      if (!line.match(/console\.(error|warn|info|debug|log)/)) continue;
      if (line.includes('RESEND_API_KEY') || line.includes('apiKey')) offenders.push(line.trim());
    }
    expect(offenders).toEqual([]);
  });

  it('no console.* line interpolates a recipient email value', () => {
    const lines = SRC.split('\n');
    const offenders: string[] = [];
    for (const line of lines) {
      if (!line.match(/console\.(error|warn|info|debug|log)/)) continue;
      // The Edge Function uses `recipient` as the parameter
      // name; any console.* line that interpolates it (e.g.
      // `console.error('x', recipient)`) is an offender.
      // Defensive: also check for `recipientEmail` and `email`.
      const lower = line.toLowerCase();
      if (
        lower.includes('recipient') ||
        lower.includes('recipientemail') ||
        lower.match(/[^a-z0-9_]email[^a-z0-9_]/)
      ) {
        offenders.push(line.trim());
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ── EMAIL-TRANSPORT-001 — the Authorization-in-place assertion, re-pointed ──
describe('resendProvider — the Resend Authorization header is built in-place, never logged', () => {
  it('the Authorization header is built inside the headers object literal, NOT in a console log', () => {
    // The line `authorization: \`Bearer ${apiKey}\`` should appear inside a
    // fetch options object — not inside a console call. This is the same
    // assertion that previously pinned room-notifications/index.ts; it now
    // follows the code to resendProvider.ts.
    const bearerLines = PROVIDER_SRC.split('\n').filter((l) => l.includes('Bearer ${apiKey}'));
    expect(bearerLines.length).toBeGreaterThan(0);
    for (const line of bearerLines) {
      const lower = line.toLowerCase();
      expect(lower).not.toMatch(/console\./);
    }
  });

  it('POSTs to the Resend HTTP endpoint via fetch (no nodemailer, no SMTP socket)', () => {
    expect(PROVIDER_SRC).toContain('https://api.resend.com/emails');
    expect(PROVIDER_SRC).toContain('fetch(');
    // Comment-strip: the docstring saying "no nodemailer" is documentation, not
    // a runtime reference. Scan executable code only.
    const code = PROVIDER_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/nodemailer/i);
    expect(code).not.toMatch(/createTransport/);
  });

  it('no console.* line in resendProvider references the key, Authorization, recipient, or body', () => {
    const lines = PROVIDER_SRC.split('\n');
    for (const line of lines) {
      if (!line.match(/console\.(error|warn|info|debug|log)/)) continue;
      const lower = line.toLowerCase();
      expect(lower).not.toContain('authorization');
      expect(lower).not.toContain('apikey');
      expect(lower).not.toContain('resend_api_key');
      expect(lower).not.toContain('recipient');
    }
  });
});
