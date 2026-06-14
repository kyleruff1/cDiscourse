/**
 * UX-COPY-001 — first-run clarity + product identity regression guards.
 *
 * Source/config-level checks (no render, no Supabase): the user-facing product
 * identity must not regress to the Expo scaffold placeholder, and the
 * logged-out AuthScreen must carry a ban-list-clean value proposition.
 *
 * Deliberately targets DISPLAY fields only. The Expo `slug` is deploy/EAS
 * identity (not user-facing copy) and is intentionally NOT gated here.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')) as {
  expo: { name: string; slug: string; web?: { name?: string } };
};
const authSource = fs.readFileSync(
  path.join(ROOT, 'src', 'features', 'auth', 'AuthScreen.tsx'),
  'utf8',
);

describe('UX-COPY-001 — product identity (no scaffold in user-facing display fields)', () => {
  it('expo.name is the product display name, not the scaffold placeholder', () => {
    expect(appJson.expo.name).toBe('CDiscourse');
    expect(appJson.expo.name.toLowerCase()).not.toContain('scaffold');
  });

  it('expo.web.name (the web document title) is not the scaffold placeholder', () => {
    expect(appJson.expo.web?.name).toBe('CDiscourse');
    expect(String(appJson.expo.web?.name).toLowerCase()).not.toContain('scaffold');
  });

  it('does NOT gate the slug (deploy/EAS identity, not user-facing display copy)', () => {
    // slug is intentionally preserved as deploy identity; this guard must never
    // fail the build on it. Asserting only that it remains a string.
    expect(typeof appJson.expo.slug).toBe('string');
  });
});

describe('UX-COPY-001 — AuthScreen first-run value proposition', () => {
  it('renders a value-proposition block', () => {
    expect(authSource).toContain('testID="auth-value-prop"');
  });

  it('explains specific points, evidence, and the unresolved state', () => {
    expect(authSource).toMatch(/specific point/i);
    expect(authSource).toMatch(/evidence/i);
    expect(authSource).toMatch(/unresolved/i);
  });

  it('contains no scaffold placeholder copy', () => {
    expect(authSource.toLowerCase()).not.toContain('expo-scaffold');
  });

  it('value-prop copy carries no verdict / person-judgment / amplification tokens', () => {
    const match = authSource.match(/testID="auth-value-prop"[\s\S]*?<\/View>/);
    expect(match).not.toBeNull();
    const block = (match ? match[0] : '').toLowerCase();
    const banned = [
      'winner', 'loser', 'correct', 'incorrect', 'liar', 'dishonest',
      'bad faith', 'manipulative', 'extremist', 'verdict', 'proof', 'proven',
      ' right', 'wrong', 'truth', 'popular', 'trending', 'viral',
    ];
    for (const token of banned) {
      expect(block).not.toContain(token);
    }
  });
});
