/**
 * UX-P2-6 (issue 939) - sub-10px type floor ratchet.
 *
 * A UX audit found user-facing fontSize callsites rendering below 10px, where
 * small chrome labels (chip labels, type badges, band captions, table subtext)
 * lose legibility. UX-P2-6 lifted every such VISIBLE user-facing site to a 10px
 * floor - micro-labels reference TYPOGRAPHY.microLabel.fontSize (10); plain
 * captions use a literal 10. THIS guard walks the whole user-facing source tree
 * and fails if any fontSize in the 2-9 band reappears, so the sweep cannot
 * regress and a future omission is caught (completeness enforcement).
 *
 * Two deliberate carve-outs, both documented in the design:
 *   - src/features/admin/** sub-10 sites are a sanctioned Era-D ops-console
 *     density exception (blessed by the P2-2 guard comment). The walk skips any
 *     path segment named admin.
 *   - fontSize values 0 and 1 are RESERVED sentinels for intentionally
 *     non-visible text (icon-only header presentation at designTokens header
 *     phone; the visually-hidden screen-reader live region in
 *     TimelineSelectedReadoutPanel). Raising them would be an a11y regression,
 *     so the flagged band is 2-9 (NOT a naive single-digit class).
 *
 * Mirrors cohesionPrinciple2Guard (pure scanner + firing control + must-NOT-fire
 * control) and the recursive-readdir idiom from componentsDarkThemeGuard. Unlike
 * the fixed-SCAN_SET cohesion ratchet, this guard walks the whole user-facing
 * tree so new sub-10 sites are auto-caught.
 *
 * Pure-TS, no React, no Supabase, no import from src.
 */
import fs from 'fs';
import path from 'path';

const REPO = process.cwd();
const SRC_DIR = path.join(REPO, 'src');

// Directory segments that are outside the user-facing floor: the sanctioned
// admin console, and the tests dir (src/__tests__/constitution exists and its
// fixtures must never be walked). The repo has no app/ dir.
const SKIP_DIR_SEGMENTS = new Set(['admin', '__tests__']);

// ── Pure scanner: extract-then-range. Anchors on the literal word fontSize,
//    captures the numeric literal after `fontSize:` (object form) or
//    `fontSize={` (JSX-prop form), then flags values in the 2-9 band. Values 0
//    and 1 are reserved sentinels and are NOT flagged; 10+ is the floor and
//    passes. Anchoring on fontSize means lineHeight / letterSpacing numbers
//    never match. ──
const FONT_SIZE_RE = /fontSize\s*(?::\s*|=\s*\{\s*)(\d+)/g;
function subFloorFontSizes(source: string): number[] {
  const out: number[] = [];
  for (const m of source.matchAll(FONT_SIZE_RE)) {
    const n = Number(m[1]);
    if (n >= 2 && n <= 9) out.push(n);
  }
  return out;
}

// ── Recursive walk of src/ for ts/tsx, skipping the carve-out segments. ──
function walkSource(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIR_SEGMENTS.has(entry.name)) continue;
      found.push(...walkSource(path.join(dir, entry.name)));
      continue;
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      found.push(path.join(dir, entry.name));
    }
  }
  return found;
}

const scannedFiles: string[] = walkSource(SRC_DIR)
  .map((abs) => path.relative(REPO, abs).split(path.sep).join('/'))
  .sort();

// ── The guard: no fontSize in the 2-9 band anywhere in the user-facing tree ──

describe('UX-P2-6 - user-facing source carries no sub-10 (2-9) fontSize', () => {
  it('discovers a non-empty file list that includes a known target and excludes admin', () => {
    expect(scannedFiles.length).toBeGreaterThan(0);
    expect(scannedFiles).toContain('src/features/debates/DebateListScreen.tsx');
    // The admin console + tests dir are carved out of the walk. The check is
    // path-SEGMENT equality (matching SKIP_DIR_SEGMENTS), so the sibling
    // adminClassifierHealth dir (segment name is not admin) stays in scope.
    expect(scannedFiles.some((f) => f.split('/').includes('admin'))).toBe(false);
    expect(scannedFiles.some((f) => f.split('/').includes('__tests__'))).toBe(false);
  });

  it.each(scannedFiles)('%s has no fontSize in the 2-9 band', (relPath) => {
    const source = fs.readFileSync(path.join(REPO, relPath), 'utf8');
    expect(subFloorFontSizes(source)).toEqual([]);
  });
});

// ── Firing control - the guard actually bites (not vacuously green) ──

describe('UX-P2-6 guard - firing negative control', () => {
  it('flags a re-introduced sub-floor fontSize (object form)', () => {
    expect(subFloorFontSizes('appliedTag: { fontSize: 9 }')).toEqual([9]);
    expect(subFloorFontSizes('glyph: { fontSize: 8 }')).toEqual([8]);
    expect(subFloorFontSizes('badge: { fontSize:9 }')).toEqual([9]);
  });

  it('flags the JSX-prop form', () => {
    expect(subFloorFontSizes('<Text style={{ fontSize: 9 }} />')).toEqual([9]);
    expect(subFloorFontSizes('fontSize={9}')).toEqual([9]);
    expect(subFloorFontSizes('fontSize={ 8 }')).toEqual([8]);
  });

  it('flags every sub-floor literal in a multi-literal fixture', () => {
    const seeded = 'a: { fontSize: 9 }, b: { fontSize: 8 }';
    expect(subFloorFontSizes(seeded)).toEqual([9, 8]);
  });
});

// ── Must-NOT-fire control - no false positives on clean input ──

describe('UX-P2-6 guard - must-NOT-fire control (no false positives)', () => {
  it('does not flag the 10px floor or any value at or above it', () => {
    expect(subFloorFontSizes('fontSize: 10')).toEqual([]);
    expect(subFloorFontSizes('fontSize: 11')).toEqual([]);
    expect(subFloorFontSizes('fontSize: 12')).toEqual([]);
    expect(subFloorFontSizes('fontSize: 28')).toEqual([]);
  });

  it('does not flag a token reference (no digit after the colon)', () => {
    expect(subFloorFontSizes('fontSize: TYPOGRAPHY.microLabel.fontSize')).toEqual([]);
    expect(subFloorFontSizes('fontSize: BRAND.typography.header.wide.fontSize')).toEqual([]);
  });

  it('does not flag the 0 and 1 reserved sentinels', () => {
    // Icon-only header presentation; visually-hidden live-region text.
    expect(subFloorFontSizes('phone: { fontSize: 0, lineHeight: 0 }')).toEqual([]);
    expect(subFloorFontSizes('liveRegionText: { fontSize: 1 }')).toEqual([]);
  });

  it('does not flag lineHeight / letterSpacing numbers', () => {
    expect(subFloorFontSizes('lineHeight: 9')).toEqual([]);
    expect(subFloorFontSizes('letterSpacing: 0.4')).toEqual([]);
    expect(subFloorFontSizes('glyph: { color: BRAND.text.muted, lineHeight: 9 }')).toEqual([]);
  });

  it('the walk exclusion keeps a synthetic admin-path source out of scope', () => {
    // The scanner would flag this string in isolation, proving the exclusion
    // (not the scanner) is what protects the sanctioned admin sites.
    const adminSource = 'headerCellSubtext: { fontSize: 9, color: X }';
    expect(subFloorFontSizes(adminSource)).toEqual([9]);
    const adminRel = 'src/features/admin/AdminUsersTab.tsx';
    const segments = adminRel.split('/');
    expect(segments.some((s) => SKIP_DIR_SEGMENTS.has(s))).toBe(true);
    expect(scannedFiles).not.toContain(adminRel);
  });
});
