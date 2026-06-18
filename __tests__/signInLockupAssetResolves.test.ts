/**
 * UX-BRAND-ASSETS-001 regression guard — Sign In lockup require path
 * resolves to a real file on disk.
 *
 * The defect: AuthScreen.tsx's `SIGNIN_LOCKUP = require('../../assets/...')`
 * resolved (from `src/features/auth/`) to a non-existent `src/assets/...`
 * path. Jest mocks PNG `require()` calls and TS/ESLint do not resolve asset
 * paths, so every green gate missed it — only the real Metro/web bundler
 * failed with "Unable to resolve module …".
 *
 * This test deliberately does NOT rely on jest's asset mock. It reads the
 * component source as text, extracts the require() path string, resolves it
 * relative to the component file's directory, and asserts the target file
 * EXISTS on disk. It FAILS on the old `../../` path and PASSES on the
 * corrected `../../../` path.
 *
 * All paths are computed from __dirname (this file lives at <repo>/__tests__)
 * — no hardcoded absolute paths, deterministic across machines and cwd.
 */
import * as path from 'path';
import * as fs from 'fs';

const repoRoot = path.resolve(__dirname, '..');

/**
 * Extract the first require('…') path string from a source file whose
 * assignment matches the given variable name.
 */
function extractRequirePath(sourceAbsPath: string, varName: string): string {
  const source = fs.readFileSync(sourceAbsPath, 'utf8');
  const re = new RegExp(`${varName}\\s*=\\s*require\\(\\s*['"]([^'"]+)['"]\\s*\\)`);
  const match = source.match(re);
  if (!match) {
    throw new Error(
      `Could not find a require() assignment for "${varName}" in ${sourceAbsPath}`
    );
  }
  return match[1];
}

describe('UX-BRAND-ASSETS-001 — Sign In lockup require path resolves on disk', () => {
  const authScreenAbsPath = path.join(repoRoot, 'src/features/auth/AuthScreen.tsx');

  it('AuthScreen.tsx source exists (sanity)', () => {
    expect(fs.existsSync(authScreenAbsPath)).toBe(true);
  });

  it('SIGNIN_LOCKUP require resolves to a real asset file', () => {
    const requirePath = extractRequirePath(authScreenAbsPath, 'SIGNIN_LOCKUP');
    const resolved = path.resolve(path.dirname(authScreenAbsPath), requirePath);
    expect(fs.existsSync(resolved)).toBe(true);
  });

  it('the resolved lockup asset is the committed repo-root branding PNG', () => {
    const requirePath = extractRequirePath(authScreenAbsPath, 'SIGNIN_LOCKUP');
    const resolved = path.resolve(path.dirname(authScreenAbsPath), requirePath);
    const expected = path.join(repoRoot, 'assets/branding/lockup-horizontal.png');
    expect(resolved).toBe(expected);
  });

  // Proves the disk-resolution guard generalizes: the header logo require
  // (a separate asset, deliberately untouched by this card) also resolves.
  it('AppHeader.tsx DEFAULT_LOGO require also resolves to a real asset file', () => {
    const appHeaderAbsPath = path.join(repoRoot, 'src/components/AppHeader.tsx');
    const requirePath = extractRequirePath(appHeaderAbsPath, 'DEFAULT_LOGO');
    const resolved = path.resolve(path.dirname(appHeaderAbsPath), requirePath);
    expect(fs.existsSync(resolved)).toBe(true);
  });
});
