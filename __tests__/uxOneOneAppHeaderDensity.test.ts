/**
 * UX-001.1 — AppHeader density + useHeaderBreakpoint source contract
 * tests (Q4, Q6 verdicts).
 *
 * Source-scan tests that pin the in-place modification contract: every
 * Stage 1 + Stage 2 testID preserved verbatim, public surface exports
 * unchanged, the new band-aware tokens are referenced from source, and
 * the Stage 1 + Stage 2 anti-invariants (no animation lib, no router,
 * no hardcoded brand hex, no heavy shadow) all still hold.
 *
 * The existing `useHeaderBreakpoint.test.ts` covers source-scan
 * invariants for the prior hook surface; this file covers the NEW
 * UX-001.1 source surface (Band type export, resolveBand export,
 * band-aware token references).
 */
import fs from 'fs';
import path from 'path';
import { BRAND } from '../src/lib/designTokens';
import { APP_HEADER_HEIGHT, AppHeader } from '../src/components/AppHeader';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

// ── Q4 + Q6 — AppHeader source contract ─────────────────────────

describe('UX-001.1 — AppHeader source contract (Q4, Q6)', () => {
  const src = read('src/components/AppHeader.tsx');

  // ── Every Stage 1 + Stage 2 testID preserved verbatim ──
  it('Q6.1: preserves testID "app-header"', () => {
    expect(src).toMatch(/testID=['"]app-header['"]/);
  });

  it('Q6.2: preserves testID "app-header-home"', () => {
    expect(src).toMatch(/testID=['"]app-header-home['"]/);
  });

  it('Q6.3: preserves testID "app-header-logo-image"', () => {
    expect(src).toMatch(/testID=['"]app-header-logo-image['"]/);
  });

  it('Q6.4: preserves testID "app-header-logo-fallback"', () => {
    expect(src).toMatch(/testID=['"]app-header-logo-fallback['"]/);
  });

  it('Q6.5: preserves testID "app-header-right-slot"', () => {
    expect(src).toMatch(/testID=['"]app-header-right-slot['"]/);
  });

  it('Q6.6: preserves testID "app-header-divider"', () => {
    expect(src).toMatch(/testID=['"]app-header-divider['"]/);
  });

  // ── Public surface preserved ──
  it('Q6.7: exports AppHeader function', () => {
    expect(src).toMatch(/export function AppHeader\s*\(/);
    expect(typeof AppHeader).toBe('function');
  });

  it('Q6.8: exports APP_HEADER_HEIGHT constant', () => {
    expect(src).toMatch(/export const APP_HEADER_HEIGHT/);
    expect(APP_HEADER_HEIGHT).toBeDefined();
  });

  it('Q6.9: APP_HEADER_HEIGHT === BRAND.headerHeightPx (preserved invariant)', () => {
    expect(APP_HEADER_HEIGHT).toBe(BRAND.headerHeightPx);
  });

  // ── Q4 density contract — source reads new tokens ──
  it('Q4.10: source references BRAND.logoHeightByBand via useHeaderBreakpoint resolver path', () => {
    // The header reads `logoHeightPx` from the hook return; the hook
    // populates that from BRAND.logoHeightByBand. Either the header
    // references the resolved field name or the BRAND path directly.
    expect(src).toMatch(/logoHeightPx/);
  });

  it('Q4.11: source references BRAND.headerHeightByBand via useHeaderBreakpoint resolver path', () => {
    expect(src).toMatch(/headerHeightPx/);
  });

  it('Q4.12: source consumes `band` field from useHeaderBreakpoint', () => {
    expect(src).toMatch(/\bband\b/);
  });

  it('Q4.13: source imports Band type from useHeaderBreakpoint', () => {
    expect(src).toMatch(/import\s+type\s+\{\s*Band\s*\}/);
  });

  it('Q4.14: source declares per-band minWidth on the home pressable', () => {
    // The `getHomePressableMinWidth` helper returns 120 / 200 / 240
    // per band — pin all three values.
    expect(src).toMatch(/\b120\b/);
    expect(src).toMatch(/\b200\b/);
    expect(src).toMatch(/\b240\b/);
  });

  // ── Stage 1 + Stage 2 invariants preserved ──
  it('Q6.15: source does NOT import any animation library', () => {
    expect(src).not.toMatch(/from\s+['"]react-native-reanimated['"]/);
    expect(src).not.toMatch(/Animated\.View/);
    expect(src).not.toMatch(/LayoutAnimation/);
  });

  it('Q6.16: source does NOT import any router / navigation library', () => {
    expect(src).not.toMatch(/from\s+['"]@react-navigation\//);
    expect(src).not.toMatch(/from\s+['"]expo-router['"]/);
    expect(src).not.toMatch(/\bnavigation\.navigate\s*\(/);
  });

  it('Q6.17: hitSlop >= 8 on each edge of home pressable', () => {
    expect(src).toMatch(/hitSlop=\{\{[^}]*top:\s*8/);
    expect(src).toMatch(/hitSlop=\{\{[^}]*bottom:\s*8/);
    expect(src).toMatch(/hitSlop=\{\{[^}]*left:\s*8/);
    expect(src).toMatch(/hitSlop=\{\{[^}]*right:\s*8/);
  });

  it('Q6.18: source uses BRAND tokens for color (no hardcoded brand hex)', () => {
    expect(src).toMatch(/BRAND\.surface\.app\.bg/);
    expect(src).not.toMatch(/['"]#08060F['"]/);
  });

  it('Q6.19: source does NOT declare a heavy shadow (flat divider only)', () => {
    expect(src).not.toMatch(/shadowRadius:\s*[1-9]/);
    expect(src).not.toMatch(/elevation:\s*[1-9]/);
  });

  it('Q6.20: source does NOT import an icon library (RN primitives only)', () => {
    expect(src).not.toMatch(/from\s+['"]@expo\/vector-icons['"]/);
    expect(src).not.toMatch(/from\s+['"]react-native-vector-icons/);
  });
});

// ── Q1 + Q6 — useHeaderBreakpoint source contract ──────────────

describe('UX-001.1 — useHeaderBreakpoint source contract (Q1, Q6)', () => {
  const src = read('src/hooks/useHeaderBreakpoint.ts');

  it('Q1.21: source exports `Band` type', () => {
    expect(src).toMatch(/export\s+type\s+Band/);
  });

  it('Q1.22: source exports `resolveBand` pure helper', () => {
    expect(src).toMatch(/export\s+function\s+resolveBand/);
  });

  it('Q6.23: source still delegates to resolveHeaderBreakpoint (Stage 2 single-source-of-truth invariant)', () => {
    expect(src).toMatch(/export function useHeaderBreakpoint/);
    expect(src).toMatch(/resolveHeaderBreakpoint\s*\(/);
  });

  it('Q6.24: source reads BRAND.breakpoints for band resolution', () => {
    expect(src).toMatch(/BRAND\.breakpoints/);
  });

  it('Q6.25: source reads BRAND.logoHeightByBand / .headerHeightByBand for resolved sizes', () => {
    expect(src).toMatch(/BRAND\.logoHeightByBand/);
    expect(src).toMatch(/BRAND\.headerHeightByBand/);
  });
});
