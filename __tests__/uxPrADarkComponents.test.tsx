/**
 * UX-PR-A (#916) — dark-theme shared components: render + token + contrast.
 *
 * Proves the six re-skinned files (a) reference the shipped designTokens
 * (never a raw light hex), (b) resolve at render to the exact token
 * constant (so the test tracks a future token retune, not a frozen hex),
 * and (c) clear the WCAG AA contrast bar on the real dark shell. The
 * Button secondary variant is pinned UNCHANGED (R1 — it belongs to
 * UX-BRAND-001, not PR-A).
 *
 * Repo idiom: source-scan + light RTL render + a local WCAG contrast()
 * helper (no shared util exists — mirrors uxBrand001GoldAccent.test.ts /
 * darkSurfaceTokens.test.ts). Pure JSDOM.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render } from '@testing-library/react-native';
import { TextInputField } from '../src/components/TextInputField';
import { ErrorNotice } from '../src/components/ErrorNotice';
import { EmptyState } from '../src/components/EmptyState';
import { LoadingNotice } from '../src/components/LoadingNotice';
import { Button } from '../src/components/Button';
import { SURFACE_TOKENS, STATUS, CONTROL, BRAND, FORBIDDEN_TOKEN_TOKENS } from '../src/lib/designTokens';

// ── helpers ──────────────────────────────────────────────────────

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...flattenStyle(s) }), {});
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>;
  return {};
}

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

// WCAG relative-luminance contrast (sRGB) — handles upper/lowercase hex.
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
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// The real dark shell the components render on (BRAND.surface.app.bg).
const APP_BG = BRAND.surface.app.bg;

const SOURCES = {
  TextInputField: 'src/components/TextInputField.tsx',
  ErrorNotice: 'src/components/ErrorNotice.tsx',
  EmptyState: 'src/components/EmptyState.tsx',
  LoadingNotice: 'src/components/LoadingNotice.tsx',
  Button: 'src/components/Button.tsx',
  CreateDebateForm: 'src/features/debates/CreateDebateForm.tsx',
} as const;

// ── Source-scan: each file references the token layer ─────────────

describe('UX-PR-A source-scan — every file consumes designTokens', () => {
  it.each(Object.values(SOURCES))('%s imports the designTokens module', (rel) => {
    expect(read(rel)).toMatch(/from ['"][^'"]*lib\/designTokens['"]/);
  });

  it('TextInputField references inputBg + STATUS.danger, no raw light hex', () => {
    const src = read(SOURCES.TextInputField);
    expect(src).toMatch(/SURFACE_TOKENS\.inputBg/);
    expect(src).toMatch(/SURFACE_TOKENS\.textPrimary/);
    expect(src).toMatch(/SURFACE_TOKENS\.textSecondary/);
    expect(src).toMatch(/SURFACE_TOKENS\.placeholder/);
    expect(src).toMatch(/STATUS\.danger\.fg/);
    expect(src).not.toMatch(/#fff\b/);
    expect(src).not.toMatch(/#ef4444/);
  });

  it('ErrorNotice references STATUS.danger', () => {
    const src = read(SOURCES.ErrorNotice);
    expect(src).toMatch(/STATUS\.danger\.bg/);
    expect(src).toMatch(/STATUS\.danger\.fg/);
  });

  it('EmptyState references SURFACE_TOKENS text tokens', () => {
    const src = read(SOURCES.EmptyState);
    expect(src).toMatch(/SURFACE_TOKENS\.textPrimary/);
    expect(src).toMatch(/SURFACE_TOKENS\.textSecondary/);
  });

  it('LoadingNotice references focusRing + textSecondary', () => {
    const src = read(SOURCES.LoadingNotice);
    expect(src).toMatch(/SURFACE_TOKENS\.focusRing/);
    expect(src).toMatch(/SURFACE_TOKENS\.textSecondary/);
    expect(src).not.toMatch(/#6366f1/);
  });

  it('Button references CONTROL.primary + CONTROL.danger and has no #fff / flood literal', () => {
    const src = read(SOURCES.Button);
    expect(src).toMatch(/CONTROL\.primary\.bg/);
    expect(src).toMatch(/CONTROL\.primary\.fg/);
    expect(src).toMatch(/CONTROL\.danger\.bg/);
    expect(src).toMatch(/CONTROL\.danger\.fg/);
    expect(src).toMatch(/CONTROL\.danger\.borderColor/);
    // The spinner map so no bare white literal survives.
    expect(src).toMatch(/SPINNER_FG/);
    expect(src).not.toMatch(/#fff\b/);
    expect(src).not.toMatch(/#6366f1/);
    expect(src).not.toMatch(/#ef4444/);
  });

  it('Button secondary variant is byte-unchanged (R1 — UX-BRAND-001 pin)', () => {
    const src = read(SOURCES.Button);
    // Complements uxBrand001GoldAccent.test.ts — the secondary style + label
    // still point at the BRAND gold/cream, NOT CONTROL.secondary.
    expect(src).toMatch(/secondary:\s*\{[^}]*BRAND\.accent\.goldBorder/);
    expect(src).toMatch(/secondaryLabel:\s*\{\s*color:\s*BRAND\.text\.primary/);
    expect(src).not.toMatch(/CONTROL\.secondary/);
  });

  it('CreateDebateForm references the surface tokens the re-skin map names', () => {
    const src = read(SOURCES.CreateDebateForm);
    for (const token of [
      'SURFACE_TOKENS.textSecondary',
      'SURFACE_TOKENS.border',
      'SURFACE_TOKENS.elevated',
      'SURFACE_TOKENS.focusRing',
      'SURFACE_TOKENS.raised',
      'SURFACE_TOKENS.textMuted',
      'SURFACE_TOKENS.textPrimary',
    ]) {
      expect(src).toContain(token);
    }
  });
});

// ── Render: resolved styles equal the token constants ─────────────

describe('UX-PR-A render — TextInputField', () => {
  it('label resolves to textSecondary; input to textPrimary/inputBg/inputBorder; placeholder to placeholder', () => {
    const { getByText, getByLabelText } = render(
      <TextInputField label="Email" value="" onChangeText={() => {}} placeholder="you@example.com" />,
    );
    expect(flattenStyle(getByText('Email').props.style).color).toBe(SURFACE_TOKENS.textSecondary);
    const input = getByLabelText('Email');
    const inputStyle = flattenStyle(input.props.style);
    expect(inputStyle.color).toBe(SURFACE_TOKENS.textPrimary);
    expect(inputStyle.backgroundColor).toBe(SURFACE_TOKENS.inputBg);
    expect(inputStyle.borderColor).toBe(SURFACE_TOKENS.inputBorder);
    expect(input.props.placeholderTextColor).toBe(SURFACE_TOKENS.placeholder);
  });

  it('error state resolves the message + border to STATUS.danger.fg', () => {
    const { getByText, getByLabelText } = render(
      <TextInputField label="Email" value="x" onChangeText={() => {}} errorMessage="Required" />,
    );
    expect(flattenStyle(getByText('Required').props.style).color).toBe(STATUS.danger.fg);
    expect(flattenStyle(getByLabelText('Email').props.style).borderColor).toBe(STATUS.danger.fg);
  });

  it('disabled state resolves to the recessed base fill + textMuted', () => {
    const { getByLabelText } = render(
      <TextInputField label="Email" value="" onChangeText={() => {}} editable={false} />,
    );
    const style = flattenStyle(getByLabelText('Email').props.style);
    expect(style.backgroundColor).toBe(SURFACE_TOKENS.base);
    expect(style.color).toBe(SURFACE_TOKENS.textMuted);
  });
});

describe('UX-PR-A render — Button', () => {
  it('primary resolves label to CONTROL.primary.fg and fill to CONTROL.primary.bg', () => {
    const { getByText, getByTestId } = render(
      <Button label="Go" onPress={() => {}} testID="pr-btn" />,
    );
    expect(flattenStyle(getByText('Go').props.style).color).toBe(CONTROL.primary.fg);
    expect(flattenStyle(getByTestId('pr-btn').props.style).backgroundColor).toBe(CONTROL.primary.bg);
  });

  it('danger is a bordered quiet-outline: transparent fill + 1px maroon border + light-red label', () => {
    const { getByText, getByTestId } = render(
      <Button label="Delete" variant="danger" onPress={() => {}} testID="dg-btn" />,
    );
    const btn = flattenStyle(getByTestId('dg-btn').props.style);
    expect(btn.backgroundColor).toBe(CONTROL.danger.bg); // 'transparent'
    expect(btn.backgroundColor).toBe('transparent');
    expect(btn.borderWidth).toBe(1);
    expect(btn.borderColor).toBe(CONTROL.danger.borderColor);
    expect(flattenStyle(getByText('Delete').props.style).color).toBe(CONTROL.danger.fg);
  });

  it('secondary stays the UX-BRAND-001 gold ghost (R1 — unchanged at render)', () => {
    const { getByText, getByTestId } = render(
      <Button label="Cancel" variant="secondary" onPress={() => {}} testID="sc-btn" />,
    );
    const btn = flattenStyle(getByTestId('sc-btn').props.style);
    expect(btn.backgroundColor).toBe('transparent');
    expect(btn.borderColor).toBe(BRAND.accent.goldBorder);
    expect(flattenStyle(getByText('Cancel').props.style).color).toBe(BRAND.text.primary);
  });
});

describe('UX-PR-A render — ErrorNotice / EmptyState / LoadingNotice', () => {
  it('ErrorNotice message resolves to STATUS.danger.fg on the danger surface', () => {
    const { getByText } = render(<ErrorNotice message="Boom" />);
    const message = getByText('Boom');
    expect(flattenStyle(message.props.style).color).toBe(STATUS.danger.fg);
    // Walk up to the alert container View (skips any composite wrappers).
    let container: typeof message | null = message.parent;
    while (container && container.props?.accessibilityRole !== 'alert') {
      container = container.parent;
    }
    expect(container).not.toBeNull();
    const containerStyle = flattenStyle(container?.props.style);
    expect(containerStyle.backgroundColor).toBe(STATUS.danger.bg);
    expect(containerStyle.borderColor).toBe(STATUS.danger.fg);
  });

  it('EmptyState title resolves to textPrimary and body to textSecondary', () => {
    const { getByText } = render(<EmptyState title="Nothing here" body="Try again later" />);
    expect(flattenStyle(getByText('Nothing here').props.style).color).toBe(SURFACE_TOKENS.textPrimary);
    expect(flattenStyle(getByText('Try again later').props.style).color).toBe(SURFACE_TOKENS.textSecondary);
  });

  it('LoadingNotice message resolves to textSecondary', () => {
    const { getByText } = render(<LoadingNotice message="Loading things" />);
    expect(flattenStyle(getByText('Loading things').props.style).color).toBe(SURFACE_TOKENS.textSecondary);
  });
});

// ── Contrast: AA-critical pairs are jest-proven ───────────────────

describe('UX-PR-A contrast — body text clears the 4.5:1 AA bar', () => {
  it('TextInputField label (textSecondary) on the shell', () => {
    expect(contrast(SURFACE_TOKENS.textSecondary, APP_BG)).toBeGreaterThanOrEqual(4.5);
  });
  it('TextInputField input text (textPrimary) on inputBg', () => {
    expect(contrast(SURFACE_TOKENS.textPrimary, SURFACE_TOKENS.inputBg)).toBeGreaterThanOrEqual(4.5);
  });
  it('error text (STATUS.danger.fg) on the danger surface', () => {
    expect(contrast(STATUS.danger.fg, STATUS.danger.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('EmptyState title (textPrimary) + body (textSecondary) on the shell', () => {
    expect(contrast(SURFACE_TOKENS.textPrimary, APP_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(SURFACE_TOKENS.textSecondary, APP_BG)).toBeGreaterThanOrEqual(4.5);
  });
  it('CreateDebateForm helper + LoadingNotice text (textSecondary) on the shell', () => {
    expect(contrast(SURFACE_TOKENS.textSecondary, APP_BG)).toBeGreaterThanOrEqual(4.5);
  });
  it('primary button label (white) on the indigo-600 fill', () => {
    expect(contrast(CONTROL.primary.fg, CONTROL.primary.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('danger button label (light red) on the shell — carries the destructive meaning', () => {
    expect(contrast(CONTROL.danger.fg, APP_BG)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('UX-PR-A contrast — meaningful non-text UI clears the 3:1 bar', () => {
  it('CreateDebateForm selected border (focusRing) on the card surface', () => {
    expect(contrast(SURFACE_TOKENS.focusRing, SURFACE_TOKENS.elevated)).toBeGreaterThanOrEqual(3.0);
  });
  it('CreateDebateForm unselected glyph (textMuted) on the shell', () => {
    expect(contrast(SURFACE_TOKENS.textMuted, APP_BG)).toBeGreaterThanOrEqual(3.0);
  });
});

describe('UX-PR-A contrast — danger border is intentionally quiet (meaning carried by the label)', () => {
  it('the danger border is below 3:1 by design — NOT the state signal', () => {
    // The destructive meaning is carried by the light-red label (>= 4.5:1),
    // not this hairline, so color-independence / WCAG 1.4.11 hold.
    expect(contrast(CONTROL.danger.borderColor, APP_BG)).toBeLessThan(3.0);
    expect(contrast(CONTROL.danger.fg, APP_BG)).toBeGreaterThanOrEqual(4.5);
  });
});

// ── Doctrine ban-list ─────────────────────────────────────────────

describe('UX-PR-A doctrine — no verdict vocabulary in any re-skinned source', () => {
  it.each(Object.values(SOURCES))('%s contains no forbidden verdict token', (rel) => {
    const src = read(rel).toLowerCase();
    for (const banned of FORBIDDEN_TOKEN_TOKENS) {
      const wordRe = new RegExp(`\\b${banned.replace(/\s+/g, '\\s+')}\\b`, 'i');
      expect(wordRe.test(src)).toBe(false);
    }
  });
});
