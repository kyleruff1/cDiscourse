/**
 * QOL-023 — static scan: no auth-redirect call site may hardcode localhost.
 *
 * The only legitimate `http://localhost` literal in the auth-redirect path is
 * the documented dev-fallback constant inside buildAuthRedirectUrl.ts. Any
 * other occurrence under src/features/auth/ or src/features/admin/ would mean
 * a deployed auth email could point at localhost — the exact defect QOL-023
 * fixes. devEnvironmentModel.ts is a separate, pre-existing allowlist entry
 * (legitimate environment classification, not auth-redirect construction).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC_ROOT = resolve(__dirname, '..', 'src');

// Files that are ALLOWED to contain the `http://localhost` literal.
// Keep this list tight — every entry weakens the guard.
const LOCALHOST_ALLOWLIST = [
  // The documented dev-fallback constant (DEV_FALLBACK_ORIGIN) + comments.
  join('src', 'lib', 'auth', 'buildAuthRedirectUrl.ts'),
  // Pre-existing, predates QOL-023: legitimate environment classification
  // (startsWith('http://localhost') + the 'localhost' enum). NOT auth-redirect
  // construction — intentionally allowlisted so a reviewer sees it.
  join('src', 'features', 'devEnvironment', 'devEnvironmentModel.ts'),
];

function walkTsFiles(dir: string, acc: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(full, acc);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
    ) {
      acc.push(full);
    }
  }
  return acc;
}

// Repo-relative path with forward-slash separators normalized to the platform.
function relPath(absolute: string): string {
  const repoRoot = resolve(__dirname, '..');
  return absolute.slice(repoRoot.length + 1);
}

describe('noLocalhostInProdAuthPaths — static scan', () => {
  const allTsFiles = walkTsFiles(SRC_ROOT, []);

  it('the file walker actually visited the source tree (vacuous-pass guard)', () => {
    // A misconfigured walker that scans nothing would make every assertion
    // below pass vacuously. Require a realistic file count and a non-empty
    // allowlist as a negative control.
    expect(allTsFiles.length).toBeGreaterThan(50);
    expect(LOCALHOST_ALLOWLIST.length).toBeGreaterThan(0);
  });

  it('the localhost literal appears only in allowlisted files', () => {
    const offenders: string[] = [];
    for (const file of allTsFiles) {
      if (statSync(file).isDirectory()) continue;
      const contents = readFileSync(file, 'utf8');
      if (!contents.includes('http://localhost')) continue;
      const rel = relPath(file);
      if (!LOCALHOST_ALLOWLIST.includes(rel)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no http://localhost literal appears under src/features/auth/', () => {
    const authFiles = allTsFiles.filter((f) =>
      relPath(f).startsWith(join('src', 'features', 'auth') + require('node:path').sep),
    );
    expect(authFiles.length).toBeGreaterThan(0);
    for (const file of authFiles) {
      const contents = readFileSync(file, 'utf8');
      expect({ file: relPath(file), hasLocalhost: contents.includes('http://localhost') }).toEqual({
        file: relPath(file),
        hasLocalhost: false,
      });
    }
  });

  it('no http://localhost literal appears under src/features/admin/', () => {
    const adminFiles = allTsFiles.filter((f) =>
      relPath(f).startsWith(join('src', 'features', 'admin') + require('node:path').sep),
    );
    expect(adminFiles.length).toBeGreaterThan(0);
    for (const file of adminFiles) {
      const contents = readFileSync(file, 'utf8');
      expect({ file: relPath(file), hasLocalhost: contents.includes('http://localhost') }).toEqual({
        file: relPath(file),
        hasLocalhost: false,
      });
    }
  });

  it('buildAuthRedirectUrl.ts is the only file under src/lib/auth/ with the localhost literal', () => {
    const authLibFiles = allTsFiles.filter((f) =>
      relPath(f).startsWith(join('src', 'lib', 'auth') + require('node:path').sep),
    );
    expect(authLibFiles.length).toBeGreaterThan(0);
    for (const file of authLibFiles) {
      const rel = relPath(file);
      const contents = readFileSync(file, 'utf8');
      const expectLocalhost = rel === join('src', 'lib', 'auth', 'buildAuthRedirectUrl.ts');
      expect({ file: rel, hasLocalhost: contents.includes('localhost') }).toEqual({
        file: rel,
        hasLocalhost: expectLocalhost,
      });
    }
  });

  it('no 127.0.0.1 literal appears under src/features/auth/ or src/features/admin/', () => {
    const pathSep = require('node:path').sep;
    const targetFiles = allTsFiles.filter((f) => {
      const rel = relPath(f);
      return (
        rel.startsWith(join('src', 'features', 'auth') + pathSep) ||
        rel.startsWith(join('src', 'features', 'admin') + pathSep)
      );
    });
    expect(targetFiles.length).toBeGreaterThan(0);
    for (const file of targetFiles) {
      const contents = readFileSync(file, 'utf8');
      expect({ file: relPath(file), hasLoopback: contents.includes('127.0.0.1') }).toEqual({
        file: relPath(file),
        hasLoopback: false,
      });
    }
  });
});
