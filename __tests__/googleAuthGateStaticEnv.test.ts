/**
 * AUTH-GOOGLE-SSO-GATE-FIX-001 (#776) — static-env source guard.
 *
 * Jest runs on Node, which has a real `process.env`, so a behavioral test cannot
 * catch the actual defect: babel-preset-expo inlines `EXPO_PUBLIC_*` values ONLY
 * for STATIC member expressions (`process.env.EXPO_PUBLIC_X`). A DYNAMIC computed
 * read (`process.env[varName]`) is left un-inlined and resolves to `undefined`
 * in the web bundle, which forced the Google SSO gate OFF even when the Netlify
 * flag was set to 'true'.
 *
 * This is therefore a SOURCE-SCAN guard (mirrors the source-scan idiom in
 * __tests__/authScreenProviderRegion.test.tsx): it asserts the production read is
 * the static dot form and that NO dynamic `process.env[` access remains. It is
 * the real regression guard — Metro inlining is invisible to jest's runtime.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const GATE_SOURCE = fs.readFileSync(
  path.join(ROOT, 'src', 'features', 'auth', 'googleAuthGate.ts'),
  'utf8',
);

describe('AUTH-GOOGLE-SSO-GATE-FIX-001 (#776) — googleAuthGate static env access', () => {
  it('reads the flag via STATIC dot access (so Expo/Metro inlines it on web)', () => {
    // Expo web only inlines EXPO_PUBLIC_* for static `process.env.X` member
    // expressions; this literal is what makes the gate work in the web bundle.
    expect(GATE_SOURCE).toContain('process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED');
  });

  it('contains NO dynamic process.env[...] access (un-inlined on web → the #776 defect)', () => {
    // A dynamic computed read is NOT inlined by babel-preset-expo and resolves to
    // undefined in the web bundle. Banning the syntax prevents the regression.
    expect(GATE_SOURCE).not.toMatch(/process\.env\[/);
  });
});
