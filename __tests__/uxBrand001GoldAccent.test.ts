/**
 * UX-BRAND-001 — restrained gold accent system + sign-in premium polish.
 *
 * Gold is an ACCENT, not the palette. These guards keep it (a) present as
 * tokens, (b) contrast-safe where used as text, and (c) actually wired into the
 * sign-in value-prop + the secondary CTA — while the prior dark-on-dark
 * secondary-button label defect stays fixed and no internal copy leaks.
 *
 * Pure-token + source-scan tests (repo idiom). No render harness, no secrets.
 */
import fs from 'fs';
import path from 'path';
import { BRAND } from '../src/lib/designTokens';

// ── WCAG relative-luminance contrast (sRGB) ──────────────────────
function channelLinear(byteHex: string): number {
  const c = parseInt(byteHex, 16) / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.replace('#', ''));
  if (!m) throw new Error(`not a 6-digit hex: ${hex}`);
  return 0.2126 * channelLinear(m[1]) + 0.7152 * channelLinear(m[2]) + 0.0722 * channelLinear(m[3]);
}
function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
function isNearWhite(hex: string): boolean {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.replace('#', ''));
  return !!m && [m[1], m[2], m[3]].every((b) => parseInt(b, 16) >= 0xc0);
}
function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('UX-BRAND-001 gold accent tokens', () => {
  it('adds the restrained gold accent set to BRAND.accent', () => {
    expect(BRAND.accent.gold).toBeDefined();
    expect(BRAND.accent.goldMuted).toBeDefined();
    expect(BRAND.accent.goldDeep).toBeDefined();
    expect(BRAND.accent.goldSoft).toMatch(/^rgba\(/);
    expect(BRAND.accent.goldBorder).toMatch(/^rgba\(/);
  });

  it('gold text is contrast-safe on the dark app backdrop (>= AA, in fact >= AAA)', () => {
    const ratio = contrast(BRAND.accent.gold, BRAND.surface.app.bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5); // AA for normal text
    expect(ratio).toBeGreaterThanOrEqual(7); // AAA — it measures ~8.3:1
  });

  it('gold is a real accent, not near-white (it never washes into the cream)', () => {
    expect(isNearWhite(BRAND.accent.gold)).toBe(false);
    expect(isNearWhite(BRAND.accent.goldMuted)).toBe(false);
  });

  it('goldDeep stays readable on a LIGHT fill (reserved for that case)', () => {
    expect(contrast(BRAND.accent.goldDeep, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('UX-BRAND-001 sign-in premium polish', () => {
  const src = read('src/features/auth/AuthScreen.tsx');

  it('wires the gold accent into the value-prop lead', () => {
    // AUTH-GOOGLE-SSO-LAYOUT-001 (#780) removed the standalone gold accent rule
    // (the `auth-value-prop-accent` View) as purposeless/asymmetric. The gold
    // accent now lives in the value-prop LEAD only (BRAND.accent.gold), so the
    // accent-rule testID is asserted ABSENT.
    expect(src).toMatch(/BRAND\.accent\.gold\b/);
    expect(src).not.toMatch(/auth-value-prop-accent/);
    expect(src).not.toMatch(/valuePropAccent/);
  });

  it('uses a premium gold card surface + hairline (not raw light hex)', () => {
    expect(src).toMatch(/BRAND\.accent\.goldSoft/);
    expect(src).toMatch(/BRAND\.accent\.goldBorder/);
  });

  it('leaks no internal tooling/path and no verdict copy', () => {
    expect(src).not.toMatch(/Supabase Dashboard|docs\/|account-operations/);
    for (const t of ['winner', 'loser', 'liar', 'dishonest', 'bad faith', 'manipulative']) {
      expect(src.toLowerCase()).not.toContain(t);
    }
  });
});

describe('UX-BRAND-001 secondary CTA hierarchy (dark-on-dark defect fixed)', () => {
  const src = read('src/components/Button.tsx');

  it('no longer renders the secondary label as dark slate / light-gray border on the dark theme', () => {
    expect(src).not.toMatch(/#374151/); // old dark-on-dark label
    expect(src).not.toMatch(/#d1d5db/); // old light-gray border
  });

  it('the secondary button uses a readable cream label + a gold hairline', () => {
    expect(src).toMatch(/secondaryLabel:\s*\{\s*color:\s*BRAND\.text\.primary/);
    expect(src).toMatch(/secondary:\s*\{[^}]*BRAND\.accent\.goldBorder/);
  });
});
