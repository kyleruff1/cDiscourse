/**
 * UX-001.2 — Compact room/context strip height per band (Q12 cat 3).
 *
 * The strip's max height is 48 / 56 / 64 per band (per the brief and
 * the design's Q4 arithmetic). The component reads `useHeaderBreakpoint`
 * and chooses a band-aware sizing object; this test verifies the sizing
 * math via the same logic used inside `DebateDetailHeader` (the band ↔
 * sizing function is pure and could be extracted, but here we duplicate
 * the contract since the function is currently file-local).
 *
 * The test approach is source-scan plus a band ↔ height arithmetic check
 * (paddingVertical * 2 + rowMinHeight + borderBottomWidth) so the strip's
 * height contract is mechanically verifiable without mounting the full
 * RN-web shell.
 */
import fs from 'fs';
import path from 'path';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

const HEADER_SRC = read('src/features/debates/DebateDetailHeader.tsx');

interface BandHeights {
  containerPaddingVertical: number;
  rowMinHeight: number;
}

// Mirror of the file-local `bandSizing(band)` mapping. If
// `DebateDetailHeader` changes its numeric mapping, this constant must
// move; the source-scan test below pins the source-of-truth.
const BAND_HEIGHTS: Record<'phone' | 'tablet' | 'wide', BandHeights> = {
  phone: { containerPaddingVertical: 4, rowMinHeight: 36 },
  tablet: { containerPaddingVertical: 6, rowMinHeight: 38 },
  wide: { containerPaddingVertical: 8, rowMinHeight: 42 },
};

const STRIP_CAP = { phone: 48, tablet: 56, wide: 64 };
const BORDER_BOTTOM = 1;

describe('UX-001.2 — compact strip height arithmetic per band', () => {
  for (const band of ['phone', 'tablet', 'wide'] as const) {
    it(`${band}: containerPaddingVertical*2 + rowMinHeight + borderBottom <= ${STRIP_CAP[band]}`, () => {
      const h = BAND_HEIGHTS[band];
      const total = h.containerPaddingVertical * 2 + h.rowMinHeight + BORDER_BOTTOM;
      expect(total).toBeLessThanOrEqual(STRIP_CAP[band]);
    });
  }
});

describe('UX-001.2 — band sizing literals exist in the source', () => {
  it('phone sizing uses paddingVertical 4 + minHeight 36', () => {
    // The bandSizing branch for phone returns these literal values.
    expect(HEADER_SRC).toMatch(/band === 'phone'/);
    expect(HEADER_SRC).toMatch(/containerPaddingVertical:\s*4/);
    expect(HEADER_SRC).toMatch(/rowMinHeight:\s*36/);
  });

  it('tablet sizing uses paddingVertical 6 + minHeight 38', () => {
    expect(HEADER_SRC).toMatch(/band === 'tablet'/);
    expect(HEADER_SRC).toMatch(/containerPaddingVertical:\s*6/);
    expect(HEADER_SRC).toMatch(/rowMinHeight:\s*38/);
  });

  it('wide sizing uses paddingVertical 8 + minHeight 42', () => {
    expect(HEADER_SRC).toMatch(/containerPaddingVertical:\s*8/);
    expect(HEADER_SRC).toMatch(/rowMinHeight:\s*42/);
  });
});

describe('UX-001.2 — useHeaderBreakpoint is consumed', () => {
  it('the compact strip reads useHeaderBreakpoint().band', () => {
    expect(HEADER_SRC).toMatch(/import\s*\{\s*useHeaderBreakpoint[\s\S]*?\}\s*from\s*'\.\.\/\.\.\/hooks\/useHeaderBreakpoint'/);
    expect(HEADER_SRC).toMatch(/const\s*\{\s*band\s*\}\s*=\s*useHeaderBreakpoint\(\)/);
  });
});

describe('UX-001.2 — strip content allowlist', () => {
  it('exposes Leave / Title / Timeline-Cards toggle / overflow controls', () => {
    // Per Q4 — left-to-right reading order: leave, title, status chip,
    // side chip, private badge, toggle, overflow.
    expect(HEADER_SRC).toContain('testID="debate-detail-leave"');
    expect(HEADER_SRC).toContain('testID="debate-detail-title"');
    expect(HEADER_SRC).toContain('testID="debate-detail-toggle-timeline"');
    expect(HEADER_SRC).toContain('testID="debate-detail-toggle-cards"');
    expect(HEADER_SRC).toContain('testID="debate-detail-overflow-trigger"');
  });

  it('the title uses numberOfLines={1} + ellipsizeMode="tail" (Timeline gets priority)', () => {
    expect(HEADER_SRC).toMatch(/numberOfLines=\{1\}/);
    expect(HEADER_SRC).toMatch(/ellipsizeMode="tail"/);
  });

  it('the status chip is gated on the band (only shown on tablet/wide)', () => {
    expect(HEADER_SRC).toMatch(/showStatusChip:\s*false/);
    expect(HEADER_SRC).toMatch(/showStatusChip:\s*true/);
  });

  it('the side chip is gated on the band (only shown on tablet/wide)', () => {
    expect(HEADER_SRC).toMatch(/showSideChip:\s*false/);
    expect(HEADER_SRC).toMatch(/showSideChip:\s*true/);
  });
});

describe('UX-001.2 — toggle accessibilityState exposes the selected mode', () => {
  it('the timeline chip uses accessibilityState.selected', () => {
    expect(HEADER_SRC).toMatch(/accessibilityState=\{\{\s*selected:\s*viewMode === 'timeline'/);
  });

  it('the cards chip uses accessibilityState.selected', () => {
    expect(HEADER_SRC).toMatch(/accessibilityState=\{\{\s*selected:\s*viewMode === 'stack'/);
  });
});

describe('UX-001.2 — overflow trigger accessibilityState exposes expanded', () => {
  it('overflow Pressable carries accessibilityState.expanded', () => {
    expect(HEADER_SRC).toMatch(/accessibilityState=\{\{\s*expanded:\s*overflowOpen\s*\}\}/);
  });
});
