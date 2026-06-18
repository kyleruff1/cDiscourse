/**
 * UX-COPY-001 — first-run clarity + product identity regression guards.
 *
 * Source/config-level checks (no render, no Supabase): the user-facing product
 * identity must read "CivilDiscourse" (not the Expo scaffold placeholder, not
 * the legacy "CDiscourse"), and the logged-out AuthScreen must carry the v4
 * first-run value proposition (high-trust room · mark/respond/see-what-remains ·
 * mediator-not-a-judge) — all ban-list-clean.
 *
 * CivilDiscourse v4 brand-identity deferral (card §4 / issue non-goals):
 *   - DISPLAY fields (`expo.name`, `expo.web.name`) ARE the user-visible OS /
 *     PWA / browser-tab label; UX-COPY-001 §3.6 changes them to CivilDiscourse.
 *   - The Expo `slug` is deploy / EAS / OTA identity (NOT user-facing copy) and
 *     stays `expo-scaffold` until a separate operator-gated migration. This
 *     guard asserts the slug is UNCHANGED so the deferral is enforced.
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
const brandCopySource = fs.readFileSync(
  path.join(ROOT, 'src', 'lib', 'brandCopy.ts'),
  'utf8',
);

describe('UX-COPY-001 — product identity (CivilDiscourse in display fields)', () => {
  it('expo.name is the CivilDiscourse display name, not the scaffold placeholder', () => {
    expect(appJson.expo.name).toBe('CivilDiscourse');
    expect(appJson.expo.name.toLowerCase()).not.toContain('scaffold');
  });

  it('expo.web.name (the web document title) is CivilDiscourse, not the scaffold placeholder', () => {
    expect(appJson.expo.web?.name).toBe('CivilDiscourse');
    expect(String(appJson.expo.web?.name).toLowerCase()).not.toContain('scaffold');
  });

  it('keeps the slug as deferred deploy/EAS identity (NOT renamed to civildiscourse)', () => {
    // slug is deploy identity; the v4 rename is operator-gated and deferred.
    // This guard enforces the deferral: the slug must remain the scaffold value.
    expect(appJson.expo.slug).toBe('expo-scaffold');
  });
});

describe('UX-COPY-001 — AuthScreen first-run value proposition', () => {
  it('renders a value-proposition block', () => {
    expect(authSource).toContain('testID="auth-value-prop"');
  });

  it('shows the CivilDiscourse brand + the v4 high-trust tagline + the three-beat line', () => {
    // The strings live in the brandCopy module and are referenced by name; the
    // AuthScreen wires the AUTH_FIRST_RUN_COPY block in.
    expect(authSource).toMatch(/AUTH_FIRST_RUN_COPY/);
    expect(brandCopySource).toContain('A high-trust room for hard conversations.');
    expect(brandCopySource).toContain(
      'Mark the point. Respond clearly. See what remains unresolved.',
    );
    expect(brandCopySource).toContain('CivilDiscourse');
  });

  it('uses the mediator-not-a-judge framing (never decides who is right)', () => {
    expect(brandCopySource).toMatch(/mediator, not a judge/i);
    expect(brandCopySource).toMatch(/never who’s right/i);
  });

  it('contains no scaffold placeholder copy', () => {
    expect(authSource.toLowerCase()).not.toContain('expo-scaffold');
    expect(brandCopySource.toLowerCase()).not.toContain('expo-scaffold');
  });

  it('contains no voice-first copy (voice is not shipped)', () => {
    expect(authSource.toLowerCase()).not.toContain('speak your response');
    expect(brandCopySource.toLowerCase()).not.toContain('speak your response');
  });

  it('value-prop copy carries no verdict / person-judgment / amplification tokens', () => {
    // The mediator-not-a-judge footer says the app NEVER decides "who's right";
    // that doctrine framing must not be false-flagged. The ban-list therefore
    // targets verdict ASSERTIONS, not the negated "never who's right" phrase.
    // Scan exported string VALUES only — the module's doc comment names the
    // doctrine vocabulary on purpose and must not be flagged.
    const block = brandCopySource
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        return !(trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'));
      })
      .join('\n')
      .toLowerCase();
    const banned = [
      'winner', 'loser', 'correct', 'incorrect', 'liar', 'dishonest',
      'bad faith', 'manipulative', 'extremist', 'verdict', 'proof', 'proven',
      'popular', 'trending', 'viral',
    ];
    for (const token of banned) {
      expect(block).not.toContain(token);
    }
    // "wrong" must not appear as a verdict; the v4 copy avoids it entirely.
    expect(block).not.toMatch(/\bwrong\b/);
    // A bare "you're right" / "is right" verdict is banned; "who’s right" (the
    // negated mediator framing) is the only permitted occurrence.
    const rightMatches = block.match(/right/g) ?? [];
    expect(rightMatches.length).toBe(1);
    expect(block).toContain('never who’s right');
  });
});
