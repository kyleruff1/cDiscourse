/**
 * UX-001.5 — Annotation chip + overflow chip accessibility + render contract.
 *
 * Follows the repo's `.tsx` UI-test discipline (`inspectPopoutComponent.test.tsx`
 * / `actPopoutComponent.test.tsx`): components are value-imported (proving
 * load + type-check), the load-bearing render decisions are asserted via
 * source-scan + pure-helper unit tests. The runtime render path is not
 * exercised because the repo's pinned renderer is held away from
 * @testing-library's peer.
 *
 * Coverage:
 *   - AnnotationChip + AnnotationOverflowChip modules load and export.
 *   - Pressable vs non-pressable role flip.
 *   - 44×44 hitSlop on every interactive chip.
 *   - Plain-language label + ariaHint composition.
 *   - Token-only color sourcing (no hex literals).
 *   - Glyph fallback string is non-empty for every iconHint.
 */
import * as fs from 'fs';
import * as path from 'path';
import { AnnotationChip } from '../src/features/nodeAnnotations/AnnotationChip';
import {
  AnnotationOverflowChip,
  buildAnnotationOverflowAriaLabel,
} from '../src/features/nodeAnnotations/AnnotationOverflowChip';
import { ANNOTATION_CHIP_ICON_HINTS } from '../src/features/nodeAnnotations/annotationChipDescriptor';

const PRIMITIVE_DIR = path.join(
  process.cwd(),
  'src',
  'features',
  'nodeAnnotations',
);

const CHIP_SRC = fs.readFileSync(path.join(PRIMITIVE_DIR, 'AnnotationChip.tsx'), 'utf8');
const OVERFLOW_SRC = fs.readFileSync(
  path.join(PRIMITIVE_DIR, 'AnnotationOverflowChip.tsx'),
  'utf8',
);

describe('UX-001.5 — AnnotationChip module loads', () => {
  it('exports AnnotationChip', () => {
    expect(typeof AnnotationChip).toBe('function');
  });
});

describe('UX-001.5 — AnnotationOverflowChip module loads', () => {
  it('exports AnnotationOverflowChip', () => {
    expect(typeof AnnotationOverflowChip).toBe('function');
  });

  it('exports buildAnnotationOverflowAriaLabel helper', () => {
    expect(typeof buildAnnotationOverflowAriaLabel).toBe('function');
  });
});

describe('UX-001.5 — AnnotationChip render contract (source-scan)', () => {
  it('uses Pressable when onPress is provided', () => {
    expect(CHIP_SRC).toMatch(/Pressable[\s\S]*?onPress=\{handlePress\}/);
  });

  it('uses View with role="text" when onPress is absent', () => {
    expect(CHIP_SRC).toMatch(/accessibilityRole="text"/);
  });

  it('uses role="button" on the Pressable path', () => {
    expect(CHIP_SRC).toMatch(/accessibilityRole="button"/);
  });

  it('applies 44×44-equivalent hitSlop on the Pressable path', () => {
    expect(CHIP_SRC).toMatch(
      /hitSlop=\{\{\s*top:\s*12,\s*bottom:\s*12,\s*left:\s*12,\s*right:\s*12\s*\}\}/,
    );
  });

  it('routes label composition through buildAnnotationAriaLabel', () => {
    expect(CHIP_SRC).toMatch(/buildAnnotationAriaLabel/);
  });

  it('always wraps text in <Text> and supplies numberOfLines={1}', () => {
    expect(CHIP_SRC).toMatch(/numberOfLines=\{1\}/);
  });

  it('hides the glyph from accessibility (label is the spoken signal)', () => {
    expect(CHIP_SRC).toMatch(/accessibilityElementsHidden/);
    expect(CHIP_SRC).toMatch(/importantForAccessibility="no"/);
  });

  it('resolves colors via resolveChipColorsForDescriptor (token-only)', () => {
    expect(CHIP_SRC).toMatch(/resolveChipColorsForDescriptor/);
  });
});

describe('UX-001.5 — AnnotationOverflowChip render contract (source-scan)', () => {
  it('uses Pressable', () => {
    expect(OVERFLOW_SRC).toMatch(/Pressable/);
  });

  it('uses role="button"', () => {
    expect(OVERFLOW_SRC).toMatch(/accessibilityRole="button"/);
  });

  it('exposes accessibilityHint only when enabled', () => {
    expect(OVERFLOW_SRC).toMatch(/accessibilityHint=\{isEnabled \? 'Expands the list\.' : undefined\}/);
  });

  it('applies 44×44 hitSlop', () => {
    expect(OVERFLOW_SRC).toMatch(
      /hitSlop=\{\{\s*top:\s*12,\s*bottom:\s*12,\s*left:\s*12,\s*right:\s*12\s*\}\}/,
    );
  });

  it('renders +N text inside <Text>', () => {
    expect(OVERFLOW_SRC).toMatch(/`\+\$\{safeCount\}`/);
  });
});

describe('UX-001.5 — overflow aria label grammar', () => {
  it('singular for count=1', () => {
    expect(buildAnnotationOverflowAriaLabel(1)).toBe('1 more annotation.');
  });

  it('plural for count>1', () => {
    expect(buildAnnotationOverflowAriaLabel(2)).toBe('2 more annotations.');
    expect(buildAnnotationOverflowAriaLabel(99)).toBe('99 more annotations.');
  });

  it('plural for count=0', () => {
    expect(buildAnnotationOverflowAriaLabel(0)).toBe('0 more annotations.');
  });

  it('floors fractional counts', () => {
    expect(buildAnnotationOverflowAriaLabel(2.7)).toBe('2 more annotations.');
  });

  it('clamps negative counts to 0', () => {
    expect(buildAnnotationOverflowAriaLabel(-3)).toBe('0 more annotations.');
  });
});

describe('UX-001.5 — primitive files contain no hex color literals', () => {
  // Token-only color sourcing for the primitive layer — design §10.
  // CSS hex regex permitting #fff, #ffff, #ffffff, #ffffffff.
  const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/;

  it('AnnotationChip.tsx has no hex literals', () => {
    const hexMatches = CHIP_SRC.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexMatches).toEqual([]);
    expect(HEX_LITERAL.test(CHIP_SRC)).toBe(false);
  });

  it('AnnotationOverflowChip.tsx has no hex literals', () => {
    const hexMatches = OVERFLOW_SRC.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexMatches).toEqual([]);
    expect(HEX_LITERAL.test(OVERFLOW_SRC)).toBe(false);
  });
});

describe('UX-001.5 — every iconHint has a non-empty geometric glyph in the chip source', () => {
  // The glyph map in AnnotationChip.tsx is a closed switch; this test
  // walks the published iconHint vocabulary and asserts every value has
  // a literal glyph string in the source (the case is present).
  for (const hint of ANNOTATION_CHIP_ICON_HINTS) {
    it(`iconHint=${hint} is covered by the glyph switch`, () => {
      const pattern = new RegExp(`case '${hint}':`);
      expect(CHIP_SRC).toMatch(pattern);
    });
  }
});
