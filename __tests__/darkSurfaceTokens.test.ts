/**
 * BRAND-002 — App-wide dark surface cohesion pass.
 *
 * Verifies the new `SURFACE_TOKENS` + `CONTROL` token scale and proves
 * every converted screen references those tokens instead of raw light
 * hex literals. Pure-TS — no React, no Supabase.
 *
 * The contrast helpers (`relativeLuminance`, `contrastRatio`) are tiny
 * pure-TS functions defined here so the test pins WCAG ratios without
 * adding a production dependency.
 */
import fs from 'fs';
import path from 'path';
import {
  SURFACE_TOKENS,
  CONTROL,
  SURFACE,
  TOKENS,
  FORBIDDEN_TOKEN_TOKENS,
  getToken,
} from '../src/lib/designTokens';

const HEX_6 = /^#[0-9a-f]{6}$/i;

// ── WCAG contrast helpers (pure-TS, test-only) ───────────────────

/** sRGB relative luminance per WCAG 2.x. */
function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`relativeLuminance: not a 6-digit hex: ${hex}`);
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel(parseInt(m[1], 16));
  const g = channel(parseInt(m[2], 16));
  const b = channel(parseInt(m[3], 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors (1..21). */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── SURFACE_TOKENS structure ─────────────────────────────────────

describe('BRAND-002 SURFACE_TOKENS structure', () => {
  it('has exactly the 14 expected keys', () => {
    expect(Object.keys(SURFACE_TOKENS).sort()).toEqual(
      [
        'base',
        'border',
        'divider',
        'elevated',
        'focusRing',
        'inputBg',
        'inputBorder',
        'overlay',
        'placeholder',
        'raised',
        'textInverse',
        'textMuted',
        'textPrimary',
        'textSecondary',
      ].sort(),
    );
  });

  it('every value is a valid 6-digit hex', () => {
    for (const [key, value] of Object.entries(SURFACE_TOKENS)) {
      expect(value).toMatch(HEX_6);
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('is anchored to the existing room surface family', () => {
    // Proves the new scale is not a fork of the room palette.
    expect(SURFACE_TOKENS.base).toBe(SURFACE.base.bg);
    expect(SURFACE_TOKENS.elevated).toBe(SURFACE.elevated.bg);
    expect(SURFACE_TOKENS.overlay).toBe(SURFACE.overlay.bg);
  });
});

// ── CONTROL structure ────────────────────────────────────────────

describe('BRAND-002 CONTROL structure', () => {
  it('has primary / secondary / danger', () => {
    expect(Object.keys(CONTROL).sort()).toEqual(['danger', 'primary', 'secondary']);
  });

  it('danger.bg is transparent — the no-red-flood rule at the token level', () => {
    expect(CONTROL.danger.bg).toBe('transparent');
  });

  it('danger keeps a visible bordered treatment (borderColor + fg present)', () => {
    expect(CONTROL.danger.borderColor).toMatch(HEX_6);
    expect(CONTROL.danger.fg).toMatch(HEX_6);
  });

  it('primary fill + label are valid hex', () => {
    expect(CONTROL.primary.bg).toMatch(HEX_6);
    expect(CONTROL.primary.fg).toMatch(HEX_6);
    expect(CONTROL.primary.disabledBg).toMatch(HEX_6);
  });
});

// ── TOKENS aggregate + getToken wiring ───────────────────────────

describe('BRAND-002 TOKENS aggregate wiring', () => {
  it('TOKENS exposes surfaceTokens and control', () => {
    expect(TOKENS.surfaceTokens).toBe(SURFACE_TOKENS);
    expect(TOKENS.control).toBe(CONTROL);
  });

  it('getToken resolves the new dotted paths', () => {
    expect(getToken('surfaceTokens.elevated')).toBe(SURFACE_TOKENS.elevated);
    expect(getToken('surfaceTokens.focusRing')).toBe(SURFACE_TOKENS.focusRing);
    expect(getToken('control.danger.borderColor')).toBe(CONTROL.danger.borderColor);
    expect(getToken('control.primary.bg')).toBe(CONTROL.primary.bg);
  });
});

// ── Contrast pairs (WCAG AA — pinned) ────────────────────────────
//
// Ratios pinned here are the real WCAG 2.x measured values from the
// amended design's corrected contrast table (BRAND-002 design amendment,
// 2026-05-20). Body text + button labels are held to the 4.5:1 bar; the
// focus ring (meaningful non-text UI — required to identify the focused
// component) is held to 3:1. The decorative hairlines (`border` /
// `divider` / `inputBorder`) carry NO contrast-ratio bar — WCAG 1.4.11
// does not impose 3:1 on a card/input/table separator — so they are only
// pinned to the lighter-than-backdrop luminance ordering.

/** Two-decimal rounding so a pinned ratio reads as the design's table value. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

describe('BRAND-002 body text + button labels meet the 4.5:1 AA bar', () => {
  it('textPrimary on base / elevated / overlay >= 4.5:1 (body text)', () => {
    expect(round2(contrastRatio(SURFACE_TOKENS.textPrimary, SURFACE_TOKENS.base))).toBe(16.36);
    expect(round2(contrastRatio(SURFACE_TOKENS.textPrimary, SURFACE_TOKENS.elevated))).toBe(15.19);
    expect(round2(contrastRatio(SURFACE_TOKENS.textPrimary, SURFACE_TOKENS.overlay))).toBe(14.48);
    expect(contrastRatio(SURFACE_TOKENS.textPrimary, SURFACE_TOKENS.base)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(SURFACE_TOKENS.textPrimary, SURFACE_TOKENS.elevated)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(SURFACE_TOKENS.textPrimary, SURFACE_TOKENS.overlay)).toBeGreaterThanOrEqual(4.5);
  });

  it('textSecondary on base / elevated >= 4.5:1 (labels)', () => {
    expect(round2(contrastRatio(SURFACE_TOKENS.textSecondary, SURFACE_TOKENS.base))).toBe(7.87);
    expect(round2(contrastRatio(SURFACE_TOKENS.textSecondary, SURFACE_TOKENS.elevated))).toBe(7.3);
    expect(contrastRatio(SURFACE_TOKENS.textSecondary, SURFACE_TOKENS.base)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(SURFACE_TOKENS.textSecondary, SURFACE_TOKENS.elevated)).toBeGreaterThanOrEqual(4.5);
  });

  it('CONTROL.primary.fg (#ffffff) on primary.bg (#4f46e5) >= 4.5:1 (button label)', () => {
    expect(CONTROL.primary.fg).toBe('#ffffff');
    expect(CONTROL.primary.bg).toBe('#4f46e5');
    expect(round2(contrastRatio(CONTROL.primary.fg, CONTROL.primary.bg))).toBe(6.29);
    expect(contrastRatio(CONTROL.primary.fg, CONTROL.primary.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('CONTROL.danger.fg on base / elevated >= 4.5:1 (destructive label)', () => {
    expect(round2(contrastRatio(CONTROL.danger.fg, SURFACE_TOKENS.base))).toBe(10.63);
    expect(round2(contrastRatio(CONTROL.danger.fg, SURFACE_TOKENS.elevated))).toBe(9.86);
    expect(contrastRatio(CONTROL.danger.fg, SURFACE_TOKENS.base)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(CONTROL.danger.fg, SURFACE_TOKENS.elevated)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('BRAND-002 meaningful non-text UI meets the 3:1 AA bar', () => {
  it('textMuted on base / elevated >= 3.0:1 (large / non-body text only)', () => {
    expect(round2(contrastRatio(SURFACE_TOKENS.textMuted, SURFACE_TOKENS.base))).toBe(4.24);
    expect(round2(contrastRatio(SURFACE_TOKENS.textMuted, SURFACE_TOKENS.elevated))).toBe(3.93);
    expect(contrastRatio(SURFACE_TOKENS.textMuted, SURFACE_TOKENS.base)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(SURFACE_TOKENS.textMuted, SURFACE_TOKENS.elevated)).toBeGreaterThanOrEqual(3.0);
  });

  it('focusRing on base / elevated >= 3.0:1 (required to identify the focused component)', () => {
    expect(round2(contrastRatio(SURFACE_TOKENS.focusRing, SURFACE_TOKENS.base))).toBe(10.12);
    expect(round2(contrastRatio(SURFACE_TOKENS.focusRing, SURFACE_TOKENS.elevated))).toBe(9.39);
    expect(contrastRatio(SURFACE_TOKENS.focusRing, SURFACE_TOKENS.base)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(SURFACE_TOKENS.focusRing, SURFACE_TOKENS.elevated)).toBeGreaterThanOrEqual(3.0);
  });
});

describe('BRAND-002 decorative hairlines are lighter than their backdrop', () => {
  // WCAG 1.4.11 (Non-text Contrast) imposes a 3:1 bar only on non-text UI
  // *required to identify* a component or its state. A card outline, a
  // table-cell separator, and a resting (unfocused) input border do not
  // carry required information — they are decorative elevation. They carry
  // NO 3:1 ratio bar; the load-bearing assertion is the luminance ordering.
  it('border is lighter than base (decorative separator)', () => {
    expect(relativeLuminance(SURFACE_TOKENS.border)).toBeGreaterThan(
      relativeLuminance(SURFACE_TOKENS.base),
    );
  });

  it('divider is lighter than elevated (decorative separator)', () => {
    expect(relativeLuminance(SURFACE_TOKENS.divider)).toBeGreaterThan(
      relativeLuminance(SURFACE_TOKENS.elevated),
    );
  });

  it('inputBorder is lighter than inputBg (decorative input hairline)', () => {
    expect(relativeLuminance(SURFACE_TOKENS.inputBorder)).toBeGreaterThan(
      relativeLuminance(SURFACE_TOKENS.inputBg),
    );
  });

  it('stays below the 3:1 ceiling so each still reads as a quiet hairline', () => {
    // Documents intent: a hairline that hit 3:1 would become a bright line.
    expect(contrastRatio(SURFACE_TOKENS.border, SURFACE_TOKENS.base)).toBeLessThan(3.0);
    expect(contrastRatio(SURFACE_TOKENS.divider, SURFACE_TOKENS.elevated)).toBeLessThan(3.0);
    expect(contrastRatio(SURFACE_TOKENS.inputBorder, SURFACE_TOKENS.inputBg)).toBeLessThan(3.0);
  });
});

// ── Converted screens: no raw light hex ──────────────────────────

const CONVERTED_FILES: readonly string[] = [
  'src/features/account/AccountScreen.tsx',
  'src/features/admin/AdminScreen.tsx',
  'src/features/admin/AdminUsersTab.tsx',
  'src/features/admin/AdminArgumentsTab.tsx',
  'src/features/admin/AdminCreateUserForm.tsx',
  'src/features/admin/AdminViewAsTab.tsx',
  'src/features/admin/AdminHistoryTab.tsx',
  'src/features/admin/AdminBlocksTab.tsx',
  'src/features/admin/AdminBotUsersTab.tsx',
  'src/features/admin/AdminMetadataEventsTab.tsx',
  'src/features/admin/AdminUserDetailPanel.tsx',
  'src/features/invites/InvitePanel.tsx',
  'src/features/auth/AuthScreen.tsx',
  'src/features/arguments/ArgumentComposer.tsx',
  'src/features/arguments/ArgumentComposerDock.tsx',
  'src/features/arguments/ComposerTargetPanel.tsx',
  'src/features/arguments/ComposerValidationPanel.tsx',
  'src/features/arguments/ComposerDraftRecoveryNotice.tsx',
];

// Explicit banned light literals from the design's lookup table.
const BANNED_LIGHT_HEX: readonly string[] = [
  '#fff',
  '#ffffff',
  '#f9fafb',
  '#f3f4f6',
  '#e5e7eb',
  '#d1d5db',
  '#111827',
  '#f0fdf4',
  '#fef2f2',
  '#fffbeb',
];

// Black drop shadows are correct on dark and are exempt from the scan.
const ALLOWED_HEX: readonly string[] = ['#000', '#000000'];

/** All 3- or 6-digit hex literals occurring in a source string. */
function hexLiterals(source: string): string[] {
  const matches = source.match(/#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b/g) ?? [];
  return matches.map((h) => h.toLowerCase());
}

/** True when every one of the 3 channel bytes of a 6-digit hex is >= 0xc0. */
function isNearWhite(hex: string): boolean {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  return [m[1], m[2], m[3]].every((byte) => parseInt(byte, 16) >= 0xc0);
}

describe('BRAND-002 converted screens contain no raw light hex', () => {
  it.each(CONVERTED_FILES)('%s has no banned light hex literal', (relPath) => {
    const full = path.join(process.cwd(), relPath);
    const source = fs.readFileSync(full, 'utf8');
    const literals = hexLiterals(source);
    for (const lit of literals) {
      if (ALLOWED_HEX.includes(lit)) continue;
      expect(BANNED_LIGHT_HEX).not.toContain(lit);
    }
  });

  it.each(CONVERTED_FILES)('%s has no near-white hex literal (all channels >= 0xc0)', (relPath) => {
    const full = path.join(process.cwd(), relPath);
    const source = fs.readFileSync(full, 'utf8');
    const literals = hexLiterals(source);
    const offenders = literals.filter((lit) => !ALLOWED_HEX.includes(lit) && isNearWhite(lit));
    expect(offenders).toEqual([]);
  });
});

// ── Converted screens reference the token layer ──────────────────

describe('BRAND-002 converted screens reference the token layer', () => {
  it.each(CONVERTED_FILES)('%s imports designTokens and references a surface/control token', (relPath) => {
    const full = path.join(process.cwd(), relPath);
    const source = fs.readFileSync(full, 'utf8');
    expect(source).toMatch(/from ['"][^'"]*lib\/designTokens['"]/);
    expect(
      /\b(SURFACE_TOKENS|CONTROL|STATUS|BRAND)\b/.test(source),
    ).toBe(true);
  });
});

// ── Ban-list: new token keys stay structural ─────────────────────

describe('BRAND-002 new token keys carry no verdict vocabulary', () => {
  function wordBoundary(t: string): RegExp {
    return new RegExp(`\\b${t.replace(/\s+/g, '\\s+')}\\b`, 'i');
  }

  it('no SURFACE_TOKENS or CONTROL key matches a forbidden word', () => {
    const keys = [
      ...Object.keys(SURFACE_TOKENS),
      ...Object.keys(CONTROL),
      ...Object.values(CONTROL).flatMap((v) => Object.keys(v)),
    ];
    for (const k of keys) {
      for (const banned of FORBIDDEN_TOKEN_TOKENS) {
        expect(k).not.toMatch(wordBoundary(banned));
      }
    }
  });
});
