/**
 * QOL-039 — supabase/config.toml registers the
 * record-visibility-transition function with verify_jwt = true.
 *
 * Source-scan style. The Edge Function is JWT-required because the
 * authorization gate is creator-only (OD-1) and the audit row records the
 * triggering user identity.
 */
import fs from 'fs';
import path from 'path';

const CONFIG_SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'config.toml'),
  'utf8',
);

describe('supabase/config.toml — record-visibility-transition', () => {
  it('declares the [functions.record-visibility-transition] block', () => {
    expect(CONFIG_SRC).toContain('[functions.record-visibility-transition]');
  });

  it('sets verify_jwt = true for record-visibility-transition', () => {
    // Find the block header + the immediately following section. The
    // next section starts with a new bracket-header on its own line.
    const idx = CONFIG_SRC.indexOf('[functions.record-visibility-transition]');
    expect(idx).toBeGreaterThanOrEqual(0);
    // Slice past the header itself, then read until the next `[` on
    // its own line.
    const tail = CONFIG_SRC.slice(idx + '[functions.record-visibility-transition]'.length);
    const nextSectionIdx = tail.search(/\n\[/);
    const block = nextSectionIdx >= 0 ? tail.slice(0, nextSectionIdx) : tail;
    expect(block).toMatch(/verify_jwt = true/);
  });

  it('does NOT set verify_jwt = false (the function requires a JWT, OD-1)', () => {
    const idx = CONFIG_SRC.indexOf('[functions.record-visibility-transition]');
    const tail = CONFIG_SRC.slice(idx + '[functions.record-visibility-transition]'.length);
    const nextSectionIdx = tail.search(/\n\[/);
    const block = nextSectionIdx >= 0 ? tail.slice(0, nextSectionIdx) : tail;
    expect(block).not.toMatch(/verify_jwt = false/);
  });
});
