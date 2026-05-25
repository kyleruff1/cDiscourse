/**
 * VG-003 — Bootstrap-inspired design tokens.
 *
 * Tests the structure, completeness, and safety contract of the token
 * module. Pure-TS — no React, no Supabase.
 */
import fs from 'fs';
import path from 'path';
import {
  SPACING,
  RADIUS,
  STATUS,
  SURFACE,
  RAIL,
  ARGUMENT,
  TOKENS,
  FORBIDDEN_TOKEN_TOKENS,
  getToken,
} from '../src/lib/designTokens';

const HEX_6 = /^#[0-9a-f]{6}$/i;

// ── Structural completeness ──────────────────────────────────────

describe('VG-003 token structure', () => {
  it('SPACING has xs / s / m / l / xl', () => {
    expect(Object.keys(SPACING).sort()).toEqual(['l', 'm', 's', 'xl', 'xs']);
  });

  it('SPACING is monotonic increasing xs < s < m < l < xl', () => {
    expect(SPACING.xs).toBeLessThan(SPACING.s);
    expect(SPACING.s).toBeLessThan(SPACING.m);
    expect(SPACING.m).toBeLessThan(SPACING.l);
    expect(SPACING.l).toBeLessThan(SPACING.xl);
  });

  it('RADIUS has sm / md / lg / pill', () => {
    expect(Object.keys(RADIUS).sort()).toEqual(['lg', 'md', 'pill', 'sm']);
  });

  it('RADIUS.pill is a large sentinel for half-height clamping', () => {
    expect(RADIUS.pill).toBeGreaterThanOrEqual(500);
  });

  it('STATUS has info / warning / danger / success / neutral', () => {
    expect(Object.keys(STATUS).sort()).toEqual(['danger', 'info', 'neutral', 'success', 'warning']);
  });

  it('SURFACE has base / elevated / overlay', () => {
    expect(Object.keys(SURFACE).sort()).toEqual(['base', 'elevated', 'overlay']);
  });

  it('RAIL has active / inactive', () => {
    expect(Object.keys(RAIL).sort()).toEqual(['active', 'inactive']);
  });

  it('ARGUMENT has claim / challenge / evidence / clarify / concede / branch', () => {
    expect(Object.keys(ARGUMENT).sort()).toEqual(['branch', 'challenge', 'claim', 'clarify', 'concede', 'evidence']);
  });

  it('TOKENS aggregate contains all sixteen categories (UX-001.7 added touchTarget / focusRing / borderWidth / typography / spacingPresets)', () => {
    expect(Object.keys(TOKENS).sort()).toEqual([
      'argument',
      'borderWidth',     // UX-001.7
      'brand',
      'control',
      'focusRing',       // UX-001.7
      'glow',
      'radius',
      'rail',
      'receiptMark',
      'spacing',
      'spacingPresets',  // UX-001.7
      'status',
      'surface',
      'surfaceTokens',
      'touchTarget',     // UX-001.7
      'typography',      // UX-001.7
    ]);
  });
});

// ── Color shape validity ─────────────────────────────────────────

describe('VG-003 color shape validity', () => {
  it('every STATUS pair is a valid 6-digit hex bg + fg', () => {
    for (const [key, pair] of Object.entries(STATUS)) {
      expect(pair.bg).toMatch(HEX_6);
      expect(pair.fg).toMatch(HEX_6);
      expect(pair.bg.toLowerCase()).not.toBe(pair.fg.toLowerCase()); // distinct
      // satisfies key reference
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('every SURFACE entry has a valid hex bg', () => {
    for (const [key, val] of Object.entries(SURFACE)) {
      expect(val.bg).toMatch(HEX_6);
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('every RAIL entry has valid bg / fg / borderColor hex', () => {
    for (const [, val] of Object.entries(RAIL)) {
      expect(val.bg).toMatch(HEX_6);
      expect(val.fg).toMatch(HEX_6);
      expect(val.borderColor).toMatch(HEX_6);
    }
  });

  it('every ARGUMENT entry has a valid hex bg + fg', () => {
    for (const [, pair] of Object.entries(ARGUMENT)) {
      expect(pair.bg).toMatch(HEX_6);
      expect(pair.fg).toMatch(HEX_6);
    }
  });
});

// ── Ban-list ─────────────────────────────────────────────────────

describe('VG-003 ban-list — no truth/winner tokens in any name or hex value', () => {
  function wordBoundary(t: string): RegExp {
    return new RegExp(`\\b${t.replace(/\s+/g, '\\s+')}\\b`, 'i');
  }

  it('FORBIDDEN_TOKEN_TOKENS includes the canonical verdict tokens', () => {
    for (const t of ['winner', 'loser', 'truth', 'liar', 'dishonest']) {
      expect(FORBIDDEN_TOKEN_TOKENS).toContain(t);
    }
  });

  it('no token key contains a forbidden word', () => {
    const allKeys = [
      ...Object.keys(SPACING),
      ...Object.keys(RADIUS),
      ...Object.keys(STATUS),
      ...Object.keys(SURFACE),
      ...Object.keys(RAIL),
      ...Object.keys(ARGUMENT),
    ];
    for (const k of allKeys) {
      for (const banned of FORBIDDEN_TOKEN_TOKENS) {
        expect(k).not.toMatch(wordBoundary(banned));
      }
    }
  });
});

// ── No Bootstrap dependency ──────────────────────────────────────

describe('VG-003 no Bootstrap dependency was added', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const FORBIDDEN_DEPS = [
    'bootstrap',
    'react-bootstrap',
    'reactstrap',
    'bootstrap-react-native',
  ];

  it.each(FORBIDDEN_DEPS)('%s is not in package.json dependencies', (dep) => {
    expect(pkg.dependencies ?? {}).not.toHaveProperty(dep);
  });

  it.each(FORBIDDEN_DEPS)('%s is not in package.json devDependencies', (dep) => {
    expect(pkg.devDependencies ?? {}).not.toHaveProperty(dep);
  });
});

// ── getToken accessor ────────────────────────────────────────────

describe('VG-003 getToken accessor', () => {
  it('resolves dotted paths into the token tree', () => {
    expect(getToken('spacing.m')).toBe(SPACING.m);
    expect(getToken('radius.pill')).toBe(RADIUS.pill);
    expect(getToken('status.warning.bg')).toBe(STATUS.warning.bg);
    expect(getToken('argument.evidence.fg')).toBe(ARGUMENT.evidence.fg);
  });

  it('returns undefined for unknown paths', () => {
    expect(getToken('spacing.xxxl')).toBeUndefined();
    expect(getToken('not.a.real.path')).toBeUndefined();
    expect(getToken('')).toBeUndefined();
  });
});
