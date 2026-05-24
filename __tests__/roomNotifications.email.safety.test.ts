/**
 * QOL-040 — email-scaffold safety scan: no Authorization header
 * value, no API key, no recipient email is ever logged.
 *
 * Per cdiscourse-doctrine §6 (secrets policy) + E1.3.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'room-notifications', 'index.ts'),
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

  it('the Authorization header is built inside the headers object literal, NOT in a console log', () => {
    // The line `authorization: \`Bearer ${apiKey}\`` should
    // appear inside a fetch options object — not inside
    // console.error(`Authorization: …`).
    const bearerLines = SRC.split('\n').filter((l) => l.includes('Bearer ${apiKey}'));
    expect(bearerLines.length).toBeGreaterThan(0);
    for (const line of bearerLines) {
      const lower = line.toLowerCase();
      expect(lower).not.toMatch(/console\./);
    }
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

  it('the structured log entries on the email-send paths reference only short id + status', () => {
    // The two log entries are:
    //   - invite_email_send_failed: { inviteIdShort, status }
    //   - invite_email_send_exception: { inviteIdShort, message }
    // Neither should reference apiKey, body, or recipient email.
    for (const tag of ['invite_email_send_failed', 'invite_email_send_exception']) {
      const start = SRC.indexOf(tag);
      expect(start).toBeGreaterThan(-1);
      const block = SRC.slice(start, start + 400);
      expect(block.toLowerCase()).not.toMatch(/apikey/);
      expect(block.toLowerCase()).not.toMatch(/recipient/);
      // The body must not be in the log.
      expect(block).not.toContain('await res.text()');
    }
  });
});
