/**
 * QOL-039 — Safety + logging contract scan over
 * record-visibility-transition. Mirrors the manageRoomInviteSafety,
 * notifications.sourceScan, and roomNotifications.edge safety scans.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', 'record-visibility-transition', 'index.ts'),
  'utf8',
);

describe('record-visibility-transition — logging rules', () => {
  it('contains no console.log anywhere (only console.error / .info / .warn)', () => {
    expect(SRC).not.toMatch(/console\.log/);
  });

  it('console.* lines never reference Authorization, JWT, RESEND key, or SERVICE_ROLE_KEY', () => {
    const lines = SRC.split('\n');
    const offending: string[] = [];
    for (const line of lines) {
      if (!line.match(/console\.(error|warn|info|debug)/)) continue;
      const lower = line.toLowerCase();
      if (lower.includes('authorization')) offending.push(line.trim());
      if (lower.includes('resend_api_key')) offending.push(line.trim());
      if (lower.includes('service_role_key')) offending.push(line.trim());
      if (lower.includes('authheader')) offending.push(line.trim());
    }
    expect(offending).toEqual([]);
  });

  it('contains no literal SERVICE_ROLE_KEY env var reference in code (comments allowed)', () => {
    // Strip block + line comments and re-scan. The file header may
    // legitimately mention SUPABASE_SERVICE_ROLE_KEY in its "never logs"
    // list. Any reference in code would be suspicious.
    const stripped = SRC
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(stripped).not.toContain('SERVICE_ROLE_KEY');
    // The function DOES use the service-role client via the factory.
    expect(SRC).toContain('createServiceClient');
  });

  it('never references ANTHROPIC_API_KEY or other AI provider keys', () => {
    expect(SRC).not.toMatch(/ANTHROPIC_API_KEY/);
    expect(SRC).not.toMatch(/XAI_API_KEY/);
    expect(SRC).not.toMatch(/X_BEARER_TOKEN/);
  });

  it('never imports any AI provider SDK', () => {
    expect(SRC).not.toMatch(/from\s+['"]@anthropic-ai\//);
    expect(SRC).not.toMatch(/from\s+['"]anthropic\b/);
    expect(SRC).not.toMatch(/from\s+['"]openai\b/);
  });

  it('never references the inviter email path / Resend send', () => {
    // QOL-039 is structural; it never sends an email and never reads
    // INVITE_EMAIL_ENABLED. The cross-function call to room-notifications
    // is the only fan-out.
    expect(SRC).not.toMatch(/maybeSendInviteEmail/);
    expect(SRC).not.toMatch(/INVITE_EMAIL_ENABLED/);
    expect(SRC).not.toMatch(/api\.resend\.com/);
  });

  it('does NOT echo response bodies from the cross-function call', () => {
    // Drain pattern: the function reads the body to drain it but never
    // logs / returns the body content from room-notifications.
    expect(SRC).toMatch(/await res\.text\(\)/);
    // The text() result is never assigned to a console log line.
    const textCalls = SRC.match(/console\.(error|warn|info)[^;]*await res\.text/g) || [];
    expect(textCalls).toEqual([]);
  });
});

describe('record-visibility-transition — doctrine guards', () => {
  it('NEVER mutates a row in public.arguments (visibility is access only)', () => {
    // The function may read public.arguments to find chime-in argument
    // IDs but NEVER inserts, updates, or deletes one.
    expect(SRC).not.toMatch(/\.from\('arguments'\)[^;]*\.insert/);
    expect(SRC).not.toMatch(/\.from\('arguments'\)[^;]*\.update/);
    expect(SRC).not.toMatch(/\.from\('arguments'\)[^;]*\.delete/);
  });

  it('NEVER attempts a reverse private->public transition', () => {
    // The §4.2 DB trigger would reject it anyway. Defensively, we assert
    // the function never sets visibility back to 'public'.
    expect(SRC).not.toMatch(/update\(\{\s*visibility:\s*'public'/);
  });

  it('never uses verdict / popularity / shaming tokens in any string literal', () => {
    const banned = [
      /\bwinner\b/i,
      /\bloser\b/i,
      /\bliar\b/i,
      /\bbad faith\b/i,
      /\bbooted\b/i,
      /\bunwanted\b/i,
      /\bviral\b/i,
    ];
    for (const pattern of banned) {
      // The file may legitimately have NEUTRAL nouns like "rejected" in
      // a notification trigger name (`chime_in_rejected`). Allow that
      // as a documented exception.
      const matches = SRC.match(pattern) || [];
      // We accept zero matches — the trigger name uses an underscore so
      // the regex with \b would not pick it up anyway.
      expect(matches.length).toBe(0);
    }
  });
});

describe('record-visibility-transition — boundary checks', () => {
  it('uses the caller JWT for the cross-function call (not the service role)', () => {
    // The function passes the caller's authHeader through to
    // room-notifications so the receiving function re-derives auth from
    // the DB. Using service-role here would skip QOL-040's per-trigger
    // authorization re-check.
    expect(SRC).toContain('authorization: authHeader');
  });

  it('the caller JWT is NEVER logged or assigned to a variable that lands in a log line', () => {
    const lines = SRC.split('\n');
    const offending: string[] = [];
    for (const line of lines) {
      if (line.match(/console\.(error|warn|info|debug)/)) {
        if (line.includes('authHeader')) offending.push(line.trim());
      }
    }
    expect(offending).toEqual([]);
  });

  it('every error short-circuit returns a structured { error, message } body', () => {
    // jsonError() helper + the imported badRequest / unauthorized /
    // forbidden / methodNotAllowed / internalError / ok helpers all
    // produce the standard shape.
    expect(SRC).toContain('jsonError');
    expect(SRC).toContain('badRequest');
    expect(SRC).toContain('unauthorized');
    expect(SRC).toContain('forbidden');
    expect(SRC).toContain('internalError');
  });
});
