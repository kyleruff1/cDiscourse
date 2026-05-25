/**
 * UX-001.5 — Annotation kind/iconHint → designToken color mapping.
 *
 * Asserts:
 *   - every kind resolves to a triple whose values are tokens from
 *     `designTokens.ts` (never a free hex literal);
 *   - default kind is `'context'`;
 *   - `iconHint: 'warn' | 'check'` shifts only the border;
 *   - the per-band sizing tables expose the design §9 numbers;
 *   - `resolveBandValue` defaults to tablet for unknown bands.
 */
import {
  ARGUMENT,
  STATUS,
  SURFACE_TOKENS,
} from '../src/lib/designTokens';
import {
  ANNOTATION_BADGE_DIAMETER_BY_BAND,
  ANNOTATION_CHIP_HEIGHT_BY_BAND,
  ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND,
  ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND,
  resolveBandValue,
  resolveChipColors,
  resolveChipColorsForDescriptor,
} from '../src/features/nodeAnnotations/annotationKindTokens';
import {
  ANNOTATION_CHIP_KINDS,
  type AnnotationChipKind,
} from '../src/features/nodeAnnotations/annotationChipDescriptor';

/**
 * The set of permitted color values is the union of every token-derived
 * hex this resolver may return. The token-only assertion compares
 * against this set so the resolver cannot leak a free literal.
 */
const PERMITTED_COLORS: ReadonlyArray<string> = Object.freeze([
  SURFACE_TOKENS.base,
  SURFACE_TOKENS.elevated,
  SURFACE_TOKENS.overlay,
  SURFACE_TOKENS.raised,
  SURFACE_TOKENS.border,
  SURFACE_TOKENS.divider,
  SURFACE_TOKENS.textPrimary,
  SURFACE_TOKENS.textSecondary,
  SURFACE_TOKENS.textMuted,
  SURFACE_TOKENS.textInverse,
  SURFACE_TOKENS.inputBg,
  SURFACE_TOKENS.inputBorder,
  SURFACE_TOKENS.placeholder,
  SURFACE_TOKENS.focusRing,
  STATUS.neutral.bg,
  STATUS.neutral.fg,
  STATUS.warning.bg,
  STATUS.warning.fg,
  STATUS.danger.bg,
  STATUS.danger.fg,
  STATUS.info.bg,
  STATUS.info.fg,
  STATUS.success.bg,
  STATUS.success.fg,
  ARGUMENT.evidence.bg,
  ARGUMENT.evidence.fg,
  ARGUMENT.claim.bg,
  ARGUMENT.claim.fg,
  ARGUMENT.challenge.bg,
  ARGUMENT.challenge.fg,
  ARGUMENT.clarify.bg,
  ARGUMENT.clarify.fg,
  ARGUMENT.concede.bg,
  ARGUMENT.concede.fg,
  ARGUMENT.branch.bg,
  ARGUMENT.branch.fg,
]);

describe('UX-001.5 — resolveChipColors — token-only color sourcing', () => {
  it('every kind returns colors drawn from designTokens', () => {
    for (const kind of ANNOTATION_CHIP_KINDS) {
      const colors = resolveChipColors(kind);
      expect(PERMITTED_COLORS).toContain(colors.bg);
      expect(PERMITTED_COLORS).toContain(colors.fg);
      expect(PERMITTED_COLORS).toContain(colors.borderColor);
    }
  });

  it('returns context defaults when kind is undefined', () => {
    const defaults = resolveChipColors();
    expect(defaults.bg).toBe(STATUS.neutral.bg);
    expect(defaults.fg).toBe(STATUS.neutral.fg);
    expect(defaults.borderColor).toBe(SURFACE_TOKENS.border);
  });

  it('kind=state uses raised + textPrimary + border', () => {
    expect(resolveChipColors('state')).toEqual({
      bg: SURFACE_TOKENS.raised,
      fg: SURFACE_TOKENS.textPrimary,
      borderColor: SURFACE_TOKENS.border,
    });
  });

  it('kind=evidence uses ARGUMENT.evidence', () => {
    expect(resolveChipColors('evidence')).toEqual({
      bg: ARGUMENT.evidence.bg,
      fg: ARGUMENT.evidence.fg,
      borderColor: SURFACE_TOKENS.border,
    });
  });

  it('kind=flag uses warning border by default', () => {
    expect(resolveChipColors('flag')).toEqual({
      bg: SURFACE_TOKENS.elevated,
      fg: SURFACE_TOKENS.textPrimary,
      borderColor: STATUS.warning.bg,
    });
  });
});

describe('UX-001.5 — resolveChipColors — iconHint border shifts', () => {
  it('iconHint=warn shifts border to warning regardless of kind', () => {
    for (const kind of ANNOTATION_CHIP_KINDS) {
      const colors = resolveChipColors(kind, 'warn');
      expect(colors.borderColor).toBe(STATUS.warning.bg);
    }
  });

  it('iconHint=check shifts border to success regardless of kind', () => {
    for (const kind of ANNOTATION_CHIP_KINDS) {
      const colors = resolveChipColors(kind, 'check');
      expect(colors.borderColor).toBe(STATUS.success.bg);
    }
  });

  it('iconHint=info / time / evidence / flag / cluster does NOT shift the border', () => {
    const hints: ReadonlyArray<'info' | 'time' | 'evidence' | 'flag' | 'cluster'> = [
      'info',
      'time',
      'evidence',
      'flag',
      'cluster',
    ];
    for (const hint of hints) {
      const colors = resolveChipColors('lifecycle', hint);
      expect(colors.borderColor).toBe(SURFACE_TOKENS.border);
    }
  });
});

describe('UX-001.5 — resolveChipColorsForDescriptor', () => {
  it('resolves kind + iconHint from descriptor', () => {
    expect(
      resolveChipColorsForDescriptor({ id: 'x', label: 'L', kind: 'flag', iconHint: 'warn' }),
    ).toEqual(resolveChipColors('flag', 'warn'));
  });

  it('returns context defaults when kind is absent', () => {
    expect(resolveChipColorsForDescriptor({ id: 'x', label: 'L' })).toEqual(
      resolveChipColors(),
    );
  });
});

describe('UX-001.5 — cross-viewport sizing tables', () => {
  it('strip max-visible: phone 3 / tablet 4 / wide 6', () => {
    expect(ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND).toEqual({
      phone: 3,
      tablet: 4,
      wide: 6,
    });
  });

  it('chip height: phone 28 / tablet 32 / wide 32', () => {
    expect(ANNOTATION_CHIP_HEIGHT_BY_BAND).toEqual({
      phone: 28,
      tablet: 32,
      wide: 32,
    });
  });

  it('badge diameter: phone 8 / tablet 10 / wide 10', () => {
    expect(ANNOTATION_BADGE_DIAMETER_BY_BAND).toEqual({
      phone: 8,
      tablet: 10,
      wide: 10,
    });
  });

  it('overflow min width: phone 28 / tablet 32 / wide 36', () => {
    expect(ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND).toEqual({
      phone: 28,
      tablet: 32,
      wide: 36,
    });
  });
});

describe('UX-001.5 — resolveBandValue', () => {
  it('returns the matching value for each known band', () => {
    expect(resolveBandValue(ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND, 'phone')).toBe(3);
    expect(resolveBandValue(ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND, 'tablet')).toBe(4);
    expect(resolveBandValue(ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND, 'wide')).toBe(6);
  });

  it('falls back to tablet for an undefined band', () => {
    expect(resolveBandValue(ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND, undefined)).toBe(4);
  });
});

describe('UX-001.5 — verdict-clean color rules', () => {
  it('no kind uses STATUS.danger as a primary background (no red traffic-light)', () => {
    for (const kind of ANNOTATION_CHIP_KINDS) {
      const colors = resolveChipColors(kind);
      expect(colors.bg).not.toBe(STATUS.danger.bg);
    }
  });

  it('no kind uses STATUS.success as a primary background (no green traffic-light)', () => {
    for (const kind of ANNOTATION_CHIP_KINDS) {
      const colors = resolveChipColors(kind);
      expect(colors.bg).not.toBe(STATUS.success.bg);
    }
  });
});

describe('UX-001.5 — exhaustive kind coverage by KIND_TOKEN_TABLE', () => {
  it('every published kind resolves to a defined triple', () => {
    for (const kind of ANNOTATION_CHIP_KINDS as ReadonlyArray<AnnotationChipKind>) {
      const colors = resolveChipColors(kind);
      expect(typeof colors.bg).toBe('string');
      expect(typeof colors.fg).toBe('string');
      expect(typeof colors.borderColor).toBe('string');
    }
  });
});
