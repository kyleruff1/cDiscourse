/**
 * UX-PR-D (#925) — cohesion principle #2 ratchet: tokens by reference.
 *
 * Principle #2 (COHESION section 8): a surface references a design token; it
 * never hardcodes a quoted color-hex literal that happens to match a token
 * value. This guard bans quoted color hex inside a SMALL, grep-verified-clean
 * set of Era-A canonical files so new hardcoded hex in a protected file fires.
 *
 * It is a RATCHET, not a whole-tree ban: the tree still carries ~1,169 hex
 * literals and the Era A-prime files hardcode hex on purpose (scheduled for
 * P2-2). Scanning those would redden CI immediately, which would be a defect.
 * So the scan set is fixed and explicit.
 *
 * Mirrors componentsDarkThemeGuard.test.ts: an explicit SCAN_SET, a pure
 * scanner, a firing negative control, and a must-NOT-fire control that proves
 * GitHub issue-ref comments (hex-shaped but UNQUOTED) are never flagged.
 *
 * Scanner hazard: RN colors are ALWAYS quoted string literals, so the regex is
 * quote-anchored. A bare-hex regex would false-fire on the issue-ref comments
 * (like the INTEL-002 comment tagged 901) that lead almost every scanned file.
 * The guard scans ONLY the explicit production SCAN_SET, never the tests dir,
 * so its own inline fixture hexes are never self-scanned.
 *
 * Pure-TS, no React, no Supabase, no import from src.
 */
import fs from 'fs';
import path from 'path';

const REPO = process.cwd();

// Every quoted color-hex literal in source, quote stripped and lowercased.
// The quote anchor (single, double, or backtick) is what cleanly excludes
// hex-shaped issue-ref comments. 3-8 digits covers rgb / rgba / rrggbb /
// rrggbbaa. The word boundary stops a longer identifier run.
function quotedColorHex(source: string): string[] {
  const m = source.match(/['"`]#[0-9a-fA-F]{3,8}\b/g) ?? [];
  return m.map((x) => x.slice(1).toLowerCase());
}

// The four Era-A canonical files, all grep-verified raw-color-hex-free today.
// AdminArgumentsTab is Era D (ops-console density, sanctioned per section 9.1);
// it is included because it is color-token-clean. This guard bans COLOR hex
// only; it says nothing about the sanctioned sub-10px fontSize (that is P2-6).
const SCAN_SET_P2: readonly string[] = [
  'src/features/home/ArgumentCard.tsx',
  'src/features/mediator/MediatorNodeMarker.tsx',
  'src/features/proof/ProofDrawer.tsx',
  'src/features/admin/AdminArgumentsTab.tsx',
];

describe('UX-PR-D principle #2 — Era-A files carry no quoted color-hex (tokens by reference)', () => {
  it('the scan set covers all four named Era-A canonical targets', () => {
    // Sanity, mirrors the PR-A scan-set-covers-every-target test.
    expect(SCAN_SET_P2).toEqual([
      'src/features/home/ArgumentCard.tsx',
      'src/features/mediator/MediatorNodeMarker.tsx',
      'src/features/proof/ProofDrawer.tsx',
      'src/features/admin/AdminArgumentsTab.tsx',
    ]);
    expect(SCAN_SET_P2).toHaveLength(4);
  });

  it.each(SCAN_SET_P2)('%s contains no quoted color-hex literal', (relPath) => {
    const source = fs.readFileSync(path.join(REPO, relPath), 'utf8');
    expect(quotedColorHex(source)).toEqual([]);
  });
});

// ── Firing control — the guard actually bites (not vacuously green) ──

describe('UX-PR-D principle #2 guard — firing negative control', () => {
  it('flags a re-introduced quoted color-hex literal', () => {
    expect(quotedColorHex("backgroundColor: '#0b1220'")).toEqual(['#0b1220']);
    expect(quotedColorHex('color: "#fff"')).toEqual(['#fff']);
    expect(quotedColorHex('accent: `#6366f1`')).toEqual(['#6366f1']);
  });

  it('flags every quoted hex in a multi-literal fixture', () => {
    const seeded = "a: '#4338ca', b: '#1e293b', c: '#0b1220'";
    expect(quotedColorHex(seeded)).toEqual(['#4338ca', '#1e293b', '#0b1220']);
  });
});

// ── Must-NOT-fire control — no false positives on clean input ──

describe('UX-PR-D principle #2 guard — must-NOT-fire control (no false positives)', () => {
  it('does not flag a GitHub issue-ref comment (hex-shaped but unquoted)', () => {
    expect(quotedColorHex('// INTEL-002 (#901) - KPI derivation')).toEqual([]);
    expect(quotedColorHex('// preserving the #654 intent')).toEqual([]);
    expect(quotedColorHex('// PROOF-002 (#889) attach path')).toEqual([]);
  });

  it('does not flag a token reference', () => {
    expect(quotedColorHex('color: SURFACE_TOKENS.textPrimary')).toEqual([]);
    expect(quotedColorHex('backgroundColor: SURFACE_TOKENS.raised')).toEqual([]);
  });
});
