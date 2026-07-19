/**
 * UX-P2-2 (issue 935) — Era-A-prime chip-tint token migration guard.
 *
 * Two jobs, both byte-identity focused:
 *
 *  1. CHIP_TINT export contract — the three inset-chip SURFACE tints
 *     (quote / proof / marker) exist, aggregate into TOKENS, resolve via
 *     getToken, carry the documented hex values, and carry zero verdict /
 *     heat / popularity vocabulary.
 *
 *  2. No-new-hex migration guard — for each of the five named files the
 *     migration touched, the set of quoted color-hex literals still on disk
 *     equals that file KEEP_LIST exactly (bidirectional, so the list cannot
 *     rot), AND none of the three tints appears as a literal (they must be
 *     token references now). Plus a byte-value pin on every token the
 *     migration consumed: because token value === the literal it replaced,
 *     every StyleSheet output object is byte-identical at runtime.
 *
 * The scanner is self-contained (no import from src) so a production refactor
 * cannot silently disarm it; it mirrors cohesionPrinciple2Guard. The guard
 * scans ONLY the five explicit production files, never the tests dir, so this
 * file inline hexes (KEEP_LISTs, TINTS, seeded fixtures) are never self-scanned.
 * Comments are apostrophe-free for the doctrine scanner.
 *
 * Pure-TS, no React, no Supabase.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CHIP_TINT,
  SURFACE_TOKENS,
  TOKENS,
  getToken,
} from '../src/lib/designTokens';

const REPO = process.cwd();

// Every quoted color-hex literal in source, quote stripped and lowercased. The
// quote anchor (single, double, or backtick) cleanly excludes hex-shaped
// issue-ref comments (which are unquoted). 3-8 digits covers rgb / rgba /
// rrggbb / rrggbbaa. Identical to the cohesionPrinciple2Guard scanner.
function quotedColorHex(source: string): string[] {
  const m = source.match(/['"`]#[0-9a-fA-F]{3,8}\b/g) ?? [];
  return m.map((x) => x.slice(1).toLowerCase());
}

function uniqueHex(source: string): string[] {
  return [...new Set(quotedColorHex(source))];
}

// Offenders = on-disk unique hexes not on the file allowlist (plus any seeded
// extra). seeded lets the firing control inject a violation.
function offendersFor(source: string, keep: readonly string[], seeded = ''): string[] {
  return uniqueHex(`${source}\n${seeded}`).filter((h) => !keep.includes(h));
}

// The three chip tints MUST be token references in the five files, never
// literals. Any of these appearing quoted in a migrated file is a regression.
const TINTS = ['#111827', '#0c4a6e', '#1e3a5f'] as const;

// The five migrated files with their exact post-migration keep-lists (per the
// UX-P2-2 design per-file tables). RoomBoardLayout is hex-clean (empty list).
const KEEP_LISTS: Record<string, readonly string[]> = {
  'src/features/arguments/room/RingsideCard.tsx': [
    '#4338ca', '#1e293b', '#334155', '#6366f1', '#cbd5e1', '#475569',
    '#a5b4fc', '#bae6fd', '#0d9488', '#5eead4', '#f8fafc',
  ],
  'src/features/debates/ConversationGalleryScreen.tsx': [
    '#1e293b', '#94a3b8', '#7c2d12', '#fed7aa', '#9a3412', '#fde68a',
    '#7f1d1d', '#fecaca', '#f8fafc', '#1f2937', '#312e81', '#fff',
    '#1e1b4b', '#a5b4fc', '#78350f', '#fef3c7', '#134e4a', '#4c1d95',
    '#cbd5e1', '#064e3b',
  ],
  'src/features/arguments/RoomBoardLayout.tsx': [],
  'src/features/debates/RoomSettledNotice.tsx': [
    '#1f2937', '#475569', '#1e293b', '#fca5a5',
  ],
  'src/features/arguments/markers/TimestampMarker.tsx': [
    '#f8fafc', '#6366f1', '#a5b4fc', '#475569',
  ],
};

const MIGRATED_FILES = Object.keys(KEEP_LISTS);

function readFile(relPath: string): string {
  return readFileSync(join(REPO, relPath), 'utf8');
}

// ── CHIP_TINT export contract + byte values ─────────────────────

describe('UX-P2-2 — CHIP_TINT export contract', () => {
  it('exposes exactly quote / proof / marker with the documented hex values', () => {
    expect(CHIP_TINT).toEqual({ quote: '#111827', proof: '#0c4a6e', marker: '#1e3a5f' });
    expect(Object.keys(CHIP_TINT).sort()).toEqual(['marker', 'proof', 'quote']);
  });

  it('aggregates into TOKENS.chipTint and resolves via getToken', () => {
    expect(TOKENS.chipTint).toBe(CHIP_TINT);
    expect(getToken('chipTint.quote')).toBe('#111827');
    expect(getToken('chipTint.proof')).toBe('#0c4a6e');
    expect(getToken('chipTint.marker')).toBe('#1e3a5f');
  });
});

// ── Ban-list — no verdict / heat / popularity vocabulary ────────

describe('UX-P2-2 — CHIP_TINT ban-list', () => {
  const FORBIDDEN = [
    'winner', 'loser', 'truth', 'true', 'false', 'correct', 'liar',
    'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist',
    'hot', 'cold', 'viral', 'popular', 'trending', 'winning', 'losing',
  ];

  it('no CHIP_TINT key or hex value carries forbidden vocabulary', () => {
    const joined = [...Object.keys(CHIP_TINT), ...Object.values(CHIP_TINT)]
      .join(' ')
      .toLowerCase();
    for (const f of FORBIDDEN) {
      expect(joined).not.toContain(f);
    }
  });
});

// ── Byte-identity pins — every token the migration consumed ─────
//
// Because each token value === the literal it replaced, every migrated
// StyleSheet.create output object is byte-identical at runtime. A drift here
// fails loudly and proves the migration is no longer byte-identical.

describe('UX-P2-2 — byte-identity value pins (migration equals the literal it replaced)', () => {
  it('SURFACE_TOKENS values equal the literals they replaced', () => {
    expect(SURFACE_TOKENS.base).toBe('#020617');
    expect(SURFACE_TOKENS.elevated).toBe('#0b1220');
    expect(SURFACE_TOKENS.inputBg).toBe('#0b1220');
    expect(SURFACE_TOKENS.overlay).toBe('#0f172a');
    expect(SURFACE_TOKENS.border).toBe('#1e293b');
    expect(SURFACE_TOKENS.inputBorder).toBe('#334155');
    expect(SURFACE_TOKENS.placeholder).toBe('#64748b');
    expect(SURFACE_TOKENS.textMuted).toBe('#64748b');
    expect(SURFACE_TOKENS.textSecondary).toBe('#94a3b8');
    expect(SURFACE_TOKENS.textPrimary).toBe('#e2e8f0');
  });

  it('CHIP_TINT values equal the literals they replaced', () => {
    expect(CHIP_TINT.quote).toBe('#111827');
    expect(CHIP_TINT.proof).toBe('#0c4a6e');
    expect(CHIP_TINT.marker).toBe('#1e3a5f');
  });
});

// ── No-new-hex migration guard (bidirectional per-file keep-list) ─

describe('UX-P2-2 — no-new-hex guard for the five migrated files', () => {
  it('the guard covers exactly the five named migrated files', () => {
    expect(MIGRATED_FILES).toEqual([
      'src/features/arguments/room/RingsideCard.tsx',
      'src/features/debates/ConversationGalleryScreen.tsx',
      'src/features/arguments/RoomBoardLayout.tsx',
      'src/features/debates/RoomSettledNotice.tsx',
      'src/features/arguments/markers/TimestampMarker.tsx',
    ]);
  });

  it.each(MIGRATED_FILES)('%s: on-disk hexes and its keep-list are exactly in sync', (relPath) => {
    const source = readFile(relPath);
    const onDisk = uniqueHex(source);
    const keep = KEEP_LISTS[relPath];
    // Every on-disk hex is allowlisted (no NEW unlinked value).
    for (const h of onDisk) {
      expect(keep).toContain(h);
    }
    // Every keep-list entry is still on disk (the list cannot rot).
    for (const h of keep) {
      expect(onDisk).toContain(h);
    }
    // Sorted equality restates the bidirectional contract in one line.
    expect([...onDisk].sort()).toEqual([...keep].sort());
  });

  it.each(MIGRATED_FILES)('%s: none of the three chip tints appears as a literal', (relPath) => {
    const onDisk = uniqueHex(readFile(relPath));
    for (const t of TINTS) {
      expect(onDisk).not.toContain(t);
    }
  });

  it.each(MIGRATED_FILES)('%s: has zero offenders against its keep-list today', (relPath) => {
    expect(offendersFor(readFile(relPath), KEEP_LISTS[relPath])).toEqual([]);
  });
});

// ── Firing controls — the guard bites (not vacuously green) ──────

describe('UX-P2-2 — no-new-hex guard firing controls', () => {
  it('flags a re-introduced quoted color-hex outside the keep-list', () => {
    const ring = 'src/features/arguments/room/RingsideCard.tsx';
    const offenders = offendersFor(readFile(ring), KEEP_LISTS[ring], "x: '#abcabc'");
    expect(offenders).toContain('#abcabc');
  });

  it('detects a re-literalized chip tint via the tint scan', () => {
    expect(uniqueHex("x: '#111827'").filter((h) => (TINTS as readonly string[]).includes(h))).toEqual(['#111827']);
    expect(uniqueHex("x: '#0c4a6e'").filter((h) => (TINTS as readonly string[]).includes(h))).toEqual(['#0c4a6e']);
    expect(uniqueHex("x: '#1e3a5f'").filter((h) => (TINTS as readonly string[]).includes(h))).toEqual(['#1e3a5f']);
  });
});

// ── Must-NOT-fire control — no false positives on clean input ────

describe('UX-P2-2 — no-new-hex guard must-NOT-fire control', () => {
  it('does not flag an unquoted issue-ref comment (hex-shaped but unquoted)', () => {
    expect(quotedColorHex('// UX-P2-2 (issue 935) migration note')).toEqual([]);
  });

  it('does not flag a token reference', () => {
    expect(quotedColorHex('backgroundColor: CHIP_TINT.quote')).toEqual([]);
    expect(quotedColorHex('color: SURFACE_TOKENS.textPrimary')).toEqual([]);
  });
});
