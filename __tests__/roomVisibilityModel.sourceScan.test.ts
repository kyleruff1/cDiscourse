/**
 * QOL-039 — Source-scan over roomVisibilityModel.ts. Asserts the pure-TS
 * purity: no React import, no Supabase import, no fetch / network, no AI
 * provider import, no service-role mention. Mirrors the existing
 * publicSeatModel + roomContractModel source-scan disciplines.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'src/features/debates/roomVisibilityModel.ts'),
  'utf8',
);

describe('roomVisibilityModel.ts — pure-TS purity', () => {
  it('does NOT import React', () => {
    expect(SRC).not.toMatch(/from\s+['"]react['"]/);
    expect(SRC).not.toMatch(/from\s+['"]react-native['"]/);
  });

  it('does NOT import Supabase or any client/network module', () => {
    expect(SRC).not.toMatch(/from\s+['"]@supabase\//);
    expect(SRC).not.toMatch(/from\s+['"][^'"]*\/supabase['"]/);
    expect(SRC).not.toMatch(/fetch\(/);
    expect(SRC).not.toMatch(/\.invoke\(/);
  });

  it('does NOT import any AI provider SDK', () => {
    expect(SRC).not.toMatch(/from\s+['"]@anthropic-ai/);
    expect(SRC).not.toMatch(/from\s+['"]openai/);
    expect(SRC).not.toMatch(/anthropic|xai|x-ai/i);
  });

  it('does NOT reference any service-role literal', () => {
    // The model lives client-side; the service-role key is forbidden here.
    expect(SRC).not.toMatch(/SERVICE_ROLE/);
  });

  it('does NOT reference Date.now() — timestamps are passed in', () => {
    // The Edge Function records timestamps; the pure model receives them.
    expect(SRC).not.toMatch(/Date\.now\(\)/);
  });

  it('contains no console.log', () => {
    expect(SRC).not.toMatch(/console\.log/);
  });

  it('imports from publicSeatModel and gameCopy only (deps are pure-TS too)', () => {
    const importLines = SRC.split('\n').filter((l) => l.startsWith('import '));
    for (const line of importLines) {
      // Allowed: relative imports to publicSeatModel and gameCopy.
      const isOk =
        line.includes("./publicSeatModel") ||
        line.includes("../arguments/gameCopy");
      expect(isOk).toBe(true);
    }
  });
});

describe('roomVisibilityModel.ts — doctrine guards', () => {
  it('the source contains zero verdict / popularity / shaming tokens', () => {
    const banned = [
      /\bwinner\b/i,
      /\bloser\b/i,
      /\bliar\b/i,
      /\bbad faith\b/i,
      /\bbooted\b/i,
      /\bunwanted (person|user)\b/i,
      /\bviral\b/i,
      /\btrending\b/i,
      /\bshame\b/i,
    ];
    for (const pattern of banned) {
      const matches = SRC.match(pattern) || [];
      expect(matches.length).toBe(0);
    }
  });

  it('explicitly documents the OD-1 decision (mod arm is RESERVED)', () => {
    expect(SRC).toContain('OD-1');
    expect(SRC).toContain('RESERVED');
    expect(SRC).toContain('QOL-040.2');
  });

  it('does NOT export any canTransitionToPublic surface', () => {
    expect(SRC).not.toMatch(/export\s+function\s+canTransitionToPublic/);
    expect(SRC).not.toMatch(/canTransitionToPublic\s*[:=]/);
  });
});
