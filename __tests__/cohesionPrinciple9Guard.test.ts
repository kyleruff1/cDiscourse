/**
 * UX-PR-D (#925) — cohesion principle #9 ratchet: red means app failure only.
 *
 * Principle #9 (COHESION section 8, commitment 9.5): red is reserved for
 * application failure and danger. It never signals a content state, so a red
 * chip can never read as "this claim is wrong". This guard bans crimson-red
 * hex in a defined set of content-state files, outside a documented per-file
 * allowlist of today known reds.
 *
 * It is a RATCHET: the current tree still misuses red in several places
 * (gallery maroon, flag red, standing-band gradient, legacy counter). Those
 * are scheduled for P1-7 and P2-9. So each known red is allowlisted per-file
 * and the guard fires only on a NEW red outside the allowlist. Orange / amber /
 * rust heat colors do NOT fire; they are a separate tone concern (P2-9 re-tone),
 * not a #9 red-failure concern.
 *
 * Mirrors componentsDarkThemeGuard.test.ts for the scan / firing structure and
 * a11y693MediatorBoardAxisGuard.test.tsx for the hexToRgb classifier (narrowed
 * to red-only). Helpers are self-contained (no import from src) so a production
 * refactor cannot silently disarm the guard. The guard scans ONLY the explicit
 * production SCAN_SET, never the tests dir, so its own inline red fixtures are
 * never self-scanned. Comments are apostrophe-free for the doctrine scanner.
 *
 * Pure-TS, no React, no Supabase.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const REPO = process.cwd();

// Every quoted color-hex literal in source, quote stripped and lowercased. The
// quote anchor excludes hex-shaped issue-ref comments (which are unquoted).
function quotedColorHex(source: string): string[] {
  const m = source.match(/['"`]#[0-9a-fA-F]{3,8}\b/g) ?? [];
  return m.map((x) => x.slice(1).toLowerCase());
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

// A crimson red: hue within 12 degrees of pure red, saturated, and bright
// enough to exclude near-gray. The sat >= 0.15 floor is what keeps light-red
// #fecaca in scope while excluding near-gray; orange / amber / rust (hue 15deg
// and up) fall out because they are a separate tone concern, not failure-red.
function isRedFamily(hex: string): boolean {
  const c = hexToRgb(hex);
  if (!c) return false;
  const { r, g, b } = c;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let H = 0;
  if (d !== 0) {
    if (max === r) H = 60 * (((g - b) / d) % 6);
    else if (max === g) H = 60 * ((b - r) / d + 2);
    else H = 60 * ((r - g) / d + 4);
  }
  if (H < 0) H += 360;
  const sat = max === 0 ? 0 : d / max;
  const nearRed = H <= 12 || H >= 348;
  return nearRed && sat >= 0.15 && max >= 80;
}

// The six content-state files carrying the COHESION section 6 red-doctrine debt.
const SCAN_SET_P9: readonly string[] = [
  'src/features/debates/ConversationGalleryScreen.tsx',
  'src/features/arguments/argumentGameSurfaceModel.ts',
  'src/features/arguments/argumentScoreModel.ts',
  'src/features/arguments/ArgumentScoreTracker.tsx',
  'src/features/arguments/ArgumentTimelineNode.tsx',
  'src/features/arguments/ArgumentTrack.tsx',
];

// Per-file allowlist of today known reds, each tagged with burn-down PR + role.
// A per-file map (not a flat set) so a known red appearing in a NEW file scope
// still fires. A burn-down PR that removes a red MUST shrink this map in the
// same PR; the allowlist-completeness test below fails loudly on a stale entry.
const ALLOWLIST_P9: Record<string, readonly string[]> = {
  // gallery: #7f1d1d/#fecaca serve BOTH a legit errorBanner/errorText (an
  //   app-failure red, correct per #9, KEEP) AND a content misuse (overheated
  //   heat pill, signalChipCritical) burned down in P2-9. Same hex, two roles;
  //   a hex-literal scan cannot separate them, so both are allowlisted.
  'src/features/debates/ConversationGalleryScreen.tsx': ['#7f1d1d', '#fecaca'], // P2-9 misuse / KEEP error surface
  // flag kind (#ef4444), standing-band gradient (#b91c1c), tone-hostile (#dc2626) — P1-7
  'src/features/arguments/argumentGameSurfaceModel.ts': ['#ef4444', '#b91c1c', '#dc2626'], // P1-7
  // UX-PR-F (issue 929) burned down the standing-band red duplicates: the byte-identical
  // local map in argumentScoreModel and the inline sparkline ternary in ArgumentScoreTracker
  // now reference the canonical STANDING_BAND_COLOR in argumentGameSurfaceModel (which keeps
  // its own #b91c1c allowlist entry above). No raw red literal remains in these two files, so
  // per the burn-down contract their allowlists shrink to empty here. P1-7 re-ramp still pending.
  'src/features/arguments/argumentScoreModel.ts': [], // standing-band dup removed — UX-PR-F, canonical single-source
  'src/features/arguments/ArgumentScoreTracker.tsx': [], // inline sparkline ternary retargeted to canonical keys — UX-PR-F
  'src/features/arguments/ArgumentTimelineNode.tsx': ['#ef4444'], // legacy TRACK_COLORS counter — P1-7 (Era C, also P3-3)
  'src/features/arguments/ArgumentTrack.tsx': ['#ef4444'], // legacy TRACK_ACCENT counter — P1-7 (Era C, also P3-3)
};

// Unique red-family hexes in a source string.
function redsIn(source: string): string[] {
  return [...new Set(quotedColorHex(source).filter(isRedFamily))];
}

// Red offenders for a file: on-disk reds (plus any seeded extra) minus the
// file allowlist. seeded lets the firing control inject a violation.
function offendersFor(relPath: string, seeded = ''): string[] {
  const src = `${readFileSync(join(REPO, relPath), 'utf8')}\n${seeded}`;
  const allow = ALLOWLIST_P9[relPath] ?? [];
  return redsIn(src).filter((h) => !allow.includes(h));
}

// ── The guard: no red offenders (post-allowlist) in the scan set ──

describe('UX-PR-D principle #9 — content-state files carry no red outside the allowlist', () => {
  it('the scan set covers all six content-state targets', () => {
    expect(SCAN_SET_P9).toHaveLength(6);
    // Object.keys, not toHaveProperty: the file paths contain dots, which
    // toHaveProperty would misread as a nested key path.
    const allowKeys = Object.keys(ALLOWLIST_P9);
    for (const rel of SCAN_SET_P9) {
      expect(allowKeys).toContain(rel);
    }
  });

  it.each(SCAN_SET_P9)('%s has no red-family hex outside its allowlist', (relPath) => {
    expect(offendersFor(relPath)).toEqual([]);
  });
});

// ── isRedFamily unit table (the verified hue list) ──

describe('UX-PR-D principle #9 — isRedFamily hue classifier', () => {
  it('classifies crimson reds as red-family', () => {
    for (const h of ['#7f1d1d', '#dc2626', '#ef4444', '#b91c1c', '#fecaca', '#ff0000']) {
      expect(isRedFamily(h)).toBe(true);
    }
  });

  it('classifies orange / amber / rust / pink / green / slate / indigo as NOT red-family', () => {
    for (const h of [
      '#7c2d12', // rust
      '#9a3412', // rust
      '#78350f', // rust
      '#f59e0b', // amber
      '#f97316', // orange
      '#facc15', // amber-yellow
      '#ec4899', // magenta
      '#10b981', // green (standing supported)
      '#1f2937', // slate neutral
      '#a5b4fc', // indigo focus ring
    ]) {
      expect(isRedFamily(h)).toBe(false);
    }
  });
});

// ── Firing control — the guard bites (not vacuously green) ──

describe('UX-PR-D principle #9 guard — firing negative control', () => {
  it('flags a new pure-red literal', () => {
    expect(quotedColorHex("chip: '#ff0000'").filter(isRedFamily)).toEqual(['#ff0000']);
    expect(isRedFamily('#dc2626')).toBe(true);
  });

  it('flags a red seeded into a scanned file outside its allowlist', () => {
    // argumentScoreModel allows only #b91c1c; a seeded #7f1d1d is an offender.
    expect(offendersFor('src/features/arguments/argumentScoreModel.ts', "x: '#7f1d1d'")).toEqual([
      '#7f1d1d',
    ]);
  });
});

// ── Must-NOT-fire control — heat / neutral colors are not offenders ──

describe('UX-PR-D principle #9 guard — must-NOT-fire control', () => {
  it('does not flag an orange heat pill', () => {
    expect(quotedColorHex("pill: '#f97316'").filter(isRedFamily)).toEqual([]);
  });

  it('does not flag amber / green / slate / indigo', () => {
    expect(isRedFamily('#f59e0b')).toBe(false);
    expect(isRedFamily('#10b981')).toBe(false);
    expect(isRedFamily('#1f2937')).toBe(false);
    expect(isRedFamily('#a5b4fc')).toBe(false);
  });
});

// ── Allowlist-completeness — the ratchet cannot rot ──

describe('UX-PR-D principle #9 guard — allowlist completeness', () => {
  it.each(SCAN_SET_P9)('%s: on-disk reds and allowlist are exactly in sync', (relPath) => {
    const onDisk = redsIn(readFileSync(join(REPO, relPath), 'utf8'));
    const allow = ALLOWLIST_P9[relPath] ?? [];
    // Every on-disk red is allowlisted (no unaccounted red).
    for (const h of onDisk) {
      expect(allow).toContain(h);
    }
    // Every allowlist entry is still on disk (no stale entry after a burn-down).
    for (const h of allow) {
      expect(onDisk).toContain(h);
    }
  });
});
