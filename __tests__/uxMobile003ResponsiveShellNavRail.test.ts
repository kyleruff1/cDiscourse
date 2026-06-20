/**
 * UX-MOBILE-003 — responsive shell / nav / rail regression guards.
 *
 * The 2026-06-15 live DOM report was reconciled against current origin/main
 * (which includes PR #654 / UX-MOBILE-001) and found to be substantially STALE:
 * every "overflow / off-screen / leak" finding is either already fixed by #654
 * or was never a real current-main defect (misread render branches). No
 * production layout defect remained, so this card adds NO layout code — it
 * PINS the already-correct responsive behavior so it cannot silently regress.
 *
 * Pure-resolver guards + source-scan guards (the repo idiom). No render harness,
 * no useWindowDimensions mock, no secrets, no auth, no production data.
 */
import fs from 'fs';
import path from 'path';
import {
  resolveObserverDockVariant,
  resolveSheetMaxHeightPx,
  DOCK_SIDE_BREAKPOINT,
} from '../src/features/arguments/ObserverActionDockLayout';
import { resolveMastheadLogoHeightPx } from '../src/components/AppHeader';
import type { Band } from '../src/hooks/useHeaderBreakpoint';

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

const PHONE_WIDTHS = [320, 360, 390, 414];
const TABLET_WIDE: Array<[number, Band]> = [
  [600, 'tablet'],
  [768, 'tablet'],
  [1024, 'tablet'],
  [1280, 'wide'],
];

describe('UX-MOBILE-003 — rails are a reachable bottom sheet on phone (report "off-screen rails" is stale)', () => {
  it('resolveObserverDockVariant returns "sheet" for every phone/tablet width below 720', () => {
    for (const w of [...PHONE_WIDTHS, 600, 719]) {
      expect(resolveObserverDockVariant(w)).toBe('sheet');
    }
  });

  it('returns "side" only at >= 720 (and on the SSR non-positive first paint)', () => {
    expect(resolveObserverDockVariant(DOCK_SIDE_BREAKPOINT)).toBe('side'); // 720
    expect(resolveObserverDockVariant(1024)).toBe('side');
    expect(resolveObserverDockVariant(0)).toBe('side');
    expect(resolveObserverDockVariant(-1)).toBe('side');
  });

  it('the bottom sheet is never full-screen (a slice of board stays reachable)', () => {
    for (const h of [480, 667, 844, 1024]) {
      expect(resolveSheetMaxHeightPx(h)).toBeLessThan(h);
    }
  });
});

describe('UX-MOBILE-003 / UX-BRAND-ASSETS-002 — masthead logo stays viewport-safe across device targets', () => {
  // QUICK-BRAND-LOCKUP-002 — the masthead logo is the gold horizontal lockup
  // (aspect ≈ 2.807, was 1.5). The rendered width is height × aspect, and
  // the height is capped by the available width on every band so it can
  // never overflow / create an edge gutter.
  const MASTHEAD_ASPECT = 960 / 342;
  it('the phone logo rendered width never exceeds the viewport at 320/360/390/414', () => {
    for (const w of PHONE_WIDTHS) {
      const h = resolveMastheadLogoHeightPx('phone', w);
      expect(h * MASTHEAD_ASPECT).toBeLessThanOrEqual(w); // width = height × aspect
    }
  });

  it('stays viewport-safe on tablet/wide (prominent where it fits, else fitted to width)', () => {
    for (const [w, band] of TABLET_WIDE) {
      const h = resolveMastheadLogoHeightPx(band, w);
      // Never larger than the prominent decision, never wider than the viewport.
      expect(h).toBeLessThanOrEqual(288);
      expect(h * MASTHEAD_ASPECT).toBeLessThanOrEqual(w);
    }
  });
});

describe('UX-MOBILE-003 — responsive shell structure is pinned (report "1467px fixed body" is stale)', () => {
  it('the gallery container + search are flex-fluid, not fixed-width (no body-overflow source)', () => {
    const src = read('src/features/debates/ConversationGalleryScreen.tsx');
    expect(src).toMatch(/container:\s*\{\s*flex:\s*1/);
    expect(src).toMatch(/search:\s*\{\s*flex:\s*1/);
    // Filter + sort chip rows are contained horizontal scrollers (reachable,
    // never a body-overflow source).
    expect((src.match(/horizontal\b/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('the primary nav wraps and stacks on phone (no nav-caused body overflow)', () => {
    const nav = read('src/features/navigation/AppPrimaryNav.tsx');
    expect(nav).toMatch(/flexWrap:\s*'wrap'/);
    expect(nav).toMatch(/flexDirection:\s*'column'/); // rootPhone column stack
    const header = read('src/components/AppHeader.tsx');
    expect(header).toMatch(/navSlotPhone[\s\S]{0,120}width:\s*'100%'/);
  });

  it('no primary end-user surface renders a 1px-font element (report finding does not exist)', () => {
    for (const rel of [
      'src/features/debates/ConversationGalleryScreen.tsx',
      'src/features/arguments/ArgumentGameSurface.tsx',
      'src/features/arguments/ArgumentTimelineMap.tsx',
    ]) {
      expect(read(rel)).not.toMatch(/fontSize:\s*1\b/);
    }
  });
});
