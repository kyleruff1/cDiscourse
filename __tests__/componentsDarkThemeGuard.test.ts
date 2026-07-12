/**
 * UX-PR-A (#916) — directory-wide dark-theme grep-guard.
 *
 * The mature designTokens layer ships a full dark surface system, but a
 * body of pre-era shared components painted light-mode hexes on the dark
 * shell. PR-A re-skins them onto the tokens; THIS guard bans the light /
 * gray / flood hex family inside src/components/ (plus the one PR-A
 * target outside it, CreateDebateForm.tsx) so the drift cannot regress.
 *
 * Mirrors the darkSurfaceTokens.test.ts scanner idiom: a specific
 * BANNED_LIGHT_HEX ban-list plus an isNearWhite() channel catch-all for
 * any future near-white literal not yet enumerated. The scan set is a
 * dynamic readdir, so a NEW component added under src/components/ is
 * auto-covered without editing this file.
 *
 * Deliberately NOT banned (proved by the must-NOT-ban control below):
 * GitHub issue-ref comments that read as hex-shaped tokens (e.g. #654 /
 * #746 / #916) and legitimate dark literals (Screen.tsx #1f1c2c) — none
 * are in the ban-list and none are near-white.
 *
 * Pure-TS, no React, no Supabase.
 */
import fs from 'fs';
import path from 'path';

const REPO = process.cwd();
const COMPONENTS_DIR = path.join(REPO, 'src', 'components');

// ── Scan set: every ts/tsx under src/components/ (dynamic, so future
//    components are auto-covered) + the one PR-A target outside it. ──
const componentFiles: string[] = fs
  .readdirSync(COMPONENTS_DIR)
  .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
  .map((f) => path.posix.join('src', 'components', f))
  .sort();

const EXTRA_TARGETS: readonly string[] = ['src/features/debates/CreateDebateForm.tsx'];

const SCAN_SET: readonly string[] = [...componentFiles, ...EXTRA_TARGETS];

// ── The banned light / gray / flood hex family found across the six
//    re-skinned files (case-insensitive; stored lowercase). ──
const BANNED_LIGHT_HEX: readonly string[] = [
  '#fff',
  '#ffffff',
  '#fafafa',
  '#f4f4f4',
  '#f9fafb',
  '#f3f4f6',
  '#e5e7eb',
  '#fef2f2',
  '#fee2e2',
  '#fecaca',
  '#374151',
  '#111827',
  '#6b7280',
  '#9ca3af',
  '#d1d5db',
  '#991b1b',
  '#ddd',
  '#ccc',
  '#eee',
  '#444',
  '#666',
  '#888',
  '#222',
  '#333',
  '#555',
  '#999',
  '#6366f1',
  '#ef4444',
];

// Black drop shadows are correct on dark — precedent parity with
// darkSurfaceTokens.test.ts's ALLOWED_HEX.
const ALLOWED_HEX: readonly string[] = ['#000', '#000000'];

/** Expand a 3-digit hex to 6-digit; pass a 6-digit through; else null. */
function expandHex(hex: string): string | null {
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  if (m3) return `#${m3[1]}${m3[1]}${m3[2]}${m3[2]}${m3[3]}${m3[3]}`;
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  return null;
}

/** True when every channel byte of a hex is >= 0xc0 (a near-white). */
function isNearWhite(hex: string): boolean {
  const full = expandHex(hex);
  if (!full) return false;
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(full);
  if (!m) return false;
  return [m[1], m[2], m[3]].every((byte) => parseInt(byte, 16) >= 0xc0);
}

/** Every 3- or 6-digit hex literal in a source string (lowercased). */
function hexLiterals(source: string): string[] {
  const matches = source.match(/#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b/g) ?? [];
  return matches.map((h) => h.toLowerCase());
}

/** The banned / near-white hex offenders in a source string. */
function offendersIn(source: string): string[] {
  return hexLiterals(source).filter((lit) => {
    if (ALLOWED_HEX.includes(lit)) return false;
    return BANNED_LIGHT_HEX.includes(lit) || isNearWhite(lit);
  });
}

// ── The guard: no banned / near-white light hex in the scan set ──

describe('UX-PR-A — src/components/ carries no light-theme hex drift', () => {
  it('the scan set covers every re-skinned target', () => {
    // Sanity: the six PR-A files are all present in the scan set.
    for (const rel of [
      'src/components/TextInputField.tsx',
      'src/components/ErrorNotice.tsx',
      'src/components/EmptyState.tsx',
      'src/components/LoadingNotice.tsx',
      'src/components/Button.tsx',
      'src/features/debates/CreateDebateForm.tsx',
    ]) {
      expect(SCAN_SET).toContain(rel);
    }
  });

  it.each(SCAN_SET)('%s contains no banned light / gray / flood hex', (relPath) => {
    const source = fs.readFileSync(path.join(REPO, relPath), 'utf8');
    const offenders = offendersIn(source);
    expect(offenders).toEqual([]);
  });
});

// ── Firing control — the guard actually fires (not vacuously green) ──

describe('UX-PR-A guard — firing negative control', () => {
  it('flags a re-introduced light hex literal', () => {
    expect(offendersIn('label: { color: "#374151" }')).toEqual(['#374151']);
    expect(offendersIn('backgroundColor: "#ffffff"')).toEqual(['#ffffff']);
    expect(offendersIn('bg: "#fafafa"')).toEqual(['#fafafa']);
    expect(offendersIn('spinner: "#6366f1"')).toEqual(['#6366f1']);
    expect(offendersIn('flood: "#ef4444"')).toEqual(['#ef4444']);
  });

  it('isNearWhite catches an un-enumerated near-white literal', () => {
    expect(isNearWhite('#fafafa')).toBe(true);
    expect(isNearWhite('#e8f0ff')).toBe(true); // not in the ban-list, still caught
    expect(isNearWhite('#eee')).toBe(true); // 3-digit expands to #eeeeee
  });
});

// ── Must-NOT-ban control — legitimate dark literals stay green ──

describe('UX-PR-A guard — must-NOT-ban control (no false positives)', () => {
  it('does not flag GitHub issue-ref comments (#654 / #746 / #916)', () => {
    expect(offendersIn('// preserving the #654 intent')).toEqual([]);
    expect(offendersIn('// Added for AUTH-GOOGLE-SSO-003 (#746)')).toEqual([]);
    expect(offendersIn('// UX-PR-A (#916)')).toEqual([]);
    expect(isNearWhite('#654')).toBe(false);
    expect(isNearWhite('#746')).toBe(false);
    expect(isNearWhite('#916')).toBe(false);
  });

  it('does not flag Screen.tsx dark border #1f1c2c', () => {
    expect(offendersIn('borderColor: "#1f1c2c"')).toEqual([]);
    expect(isNearWhite('#1f1c2c')).toBe(false);
    expect(BANNED_LIGHT_HEX).not.toContain('#1f1c2c');
  });

  it('does not flag black drop shadows (#000 / #000000)', () => {
    expect(offendersIn('shadowColor: "#000"')).toEqual([]);
    expect(offendersIn('shadowColor: "#000000"')).toEqual([]);
  });
});
