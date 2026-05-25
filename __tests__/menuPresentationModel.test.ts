/**
 * UX-001.4 — menuPresentationModel coverage.
 *
 * Pure-TS test suite for `resolveMenuPresentation`. Covers every
 * (band × menu × landscape-vs-portrait) combination plus the floor /
 * non-finite-input edge cases.
 */
import {
  resolveMenuPresentation,
  TABLET_LANDSCAPE_THRESHOLD,
  type MenuPresentationInput,
} from '../src/features/arguments/oneBox/menuPresentationModel';

const base: MenuPresentationInput = {
  band: 'phone',
  menu: 'act',
  windowWidth: 390,
  windowHeight: 844,
};

describe('resolveMenuPresentation — phone band', () => {
  it('returns sheet_bottom for Act on phone (50% height fraction)', () => {
    const out = resolveMenuPresentation({ ...base, menu: 'act' });
    expect(out.variant).toBe('sheet_bottom');
    expect(out.width).toBeNull();
    expect(out.maxHeight).toBe(Math.round(844 * 0.5));
  });

  it('returns sheet_bottom for Inspect on phone (50% height fraction)', () => {
    const out = resolveMenuPresentation({ ...base, menu: 'inspect' });
    expect(out.variant).toBe('sheet_bottom');
    expect(out.maxHeight).toBe(Math.round(844 * 0.5));
  });

  it('returns sheet_bottom for Go on phone (40% height fraction — Go shorter)', () => {
    const out = resolveMenuPresentation({ ...base, menu: 'go' });
    expect(out.variant).toBe('sheet_bottom');
    expect(out.maxHeight).toBe(Math.round(844 * 0.4));
  });
});

describe('resolveMenuPresentation — tablet portrait (< 1024 wide)', () => {
  it('returns sheet_bottom for Act on tablet portrait', () => {
    const out = resolveMenuPresentation({
      ...base,
      band: 'tablet',
      menu: 'act',
      windowWidth: 768,
      windowHeight: 1024,
    });
    expect(out.variant).toBe('sheet_bottom');
    expect(out.width).toBeNull();
    expect(out.maxHeight).toBe(Math.round(1024 * 0.5));
  });

  it('returns sheet_bottom for Inspect on tablet portrait', () => {
    const out = resolveMenuPresentation({
      ...base,
      band: 'tablet',
      menu: 'inspect',
      windowWidth: 768,
      windowHeight: 1024,
    });
    expect(out.variant).toBe('sheet_bottom');
    expect(out.maxHeight).toBe(Math.round(1024 * 0.5));
  });

  it('returns sheet_bottom for Go on tablet portrait (40% fraction)', () => {
    const out = resolveMenuPresentation({
      ...base,
      band: 'tablet',
      menu: 'go',
      windowWidth: 768,
      windowHeight: 1024,
    });
    expect(out.variant).toBe('sheet_bottom');
    expect(out.maxHeight).toBe(Math.round(1024 * 0.4));
  });
});

describe('resolveMenuPresentation — tablet landscape (>= 1024 wide)', () => {
  it('returns panel_anchored for Act on tablet landscape (width 360)', () => {
    const out = resolveMenuPresentation({
      ...base,
      band: 'tablet',
      menu: 'act',
      windowWidth: 1024,
      windowHeight: 1366,
    });
    expect(out.variant).toBe('panel_anchored');
    expect(out.width).toBe(360);
    expect(out.maxHeight).toBe(Math.round(1366 * 0.4));
  });

  it('returns panel_side for Inspect on tablet landscape (width 420)', () => {
    const out = resolveMenuPresentation({
      ...base,
      band: 'tablet',
      menu: 'inspect',
      windowWidth: 1024,
      windowHeight: 1366,
    });
    expect(out.variant).toBe('panel_side');
    expect(out.width).toBe(420);
    expect(out.maxHeight).toBe(Math.round(1366 * 0.6));
  });

  it('returns panel_side for Go on tablet landscape (width 320)', () => {
    const out = resolveMenuPresentation({
      ...base,
      band: 'tablet',
      menu: 'go',
      windowWidth: 1024,
      windowHeight: 1366,
    });
    expect(out.variant).toBe('panel_side');
    expect(out.width).toBe(320);
    expect(out.maxHeight).toBe(Math.round(1366 * 0.5));
  });

  it('TABLET_LANDSCAPE_THRESHOLD is exposed as 1024 (matches iPad Pro horizontal)', () => {
    expect(TABLET_LANDSCAPE_THRESHOLD).toBe(1024);
  });
});

describe('resolveMenuPresentation — wide band', () => {
  it('returns panel_anchored for Act on wide (35% × width 360)', () => {
    const out = resolveMenuPresentation({
      ...base,
      band: 'wide',
      menu: 'act',
      windowWidth: 1920,
      windowHeight: 1080,
    });
    expect(out.variant).toBe('panel_anchored');
    expect(out.width).toBe(360);
    expect(out.maxHeight).toBe(Math.round(1080 * 0.35));
  });

  it('returns panel_anchored for Inspect on wide (60% × width 420)', () => {
    const out = resolveMenuPresentation({
      ...base,
      band: 'wide',
      menu: 'inspect',
      windowWidth: 1920,
      windowHeight: 1080,
    });
    expect(out.variant).toBe('panel_anchored');
    expect(out.width).toBe(420);
    expect(out.maxHeight).toBe(Math.round(1080 * 0.6));
  });

  it('returns panel_anchored for Go on wide (50% × width 320)', () => {
    const out = resolveMenuPresentation({
      ...base,
      band: 'wide',
      menu: 'go',
      windowWidth: 1920,
      windowHeight: 1080,
    });
    expect(out.variant).toBe('panel_anchored');
    expect(out.width).toBe(320);
    expect(out.maxHeight).toBe(Math.round(1080 * 0.5));
  });
});

describe('resolveMenuPresentation — laptop / 1366x768 viewport', () => {
  it('Act at 1366x768 (tablet landscape) returns panel_anchored', () => {
    const out = resolveMenuPresentation({
      band: 'tablet',
      menu: 'act',
      windowWidth: 1366,
      windowHeight: 768,
    });
    expect(out.variant).toBe('panel_anchored');
    expect(out.maxHeight).toBe(Math.round(768 * 0.4));
  });

  it('Inspect at 1366x768 (tablet landscape) returns panel_side', () => {
    const out = resolveMenuPresentation({
      band: 'tablet',
      menu: 'inspect',
      windowWidth: 1366,
      windowHeight: 768,
    });
    expect(out.variant).toBe('panel_side');
    expect(out.maxHeight).toBe(Math.round(768 * 0.6));
  });

  it('Go at 1366x768 (tablet landscape) returns panel_side', () => {
    const out = resolveMenuPresentation({
      band: 'tablet',
      menu: 'go',
      windowWidth: 1366,
      windowHeight: 768,
    });
    expect(out.variant).toBe('panel_side');
    expect(out.maxHeight).toBe(Math.round(768 * 0.5));
  });
});

describe('resolveMenuPresentation — non-finite or zero inputs', () => {
  it('returns floor maxHeight for zero windowHeight', () => {
    const out = resolveMenuPresentation({
      band: 'phone',
      menu: 'act',
      windowWidth: 390,
      windowHeight: 0,
    });
    expect(out.maxHeight).toBe(200); // SHEET_MIN_HEIGHT_PX
  });

  it('returns floor maxHeight for negative windowHeight', () => {
    const out = resolveMenuPresentation({
      band: 'phone',
      menu: 'act',
      windowWidth: 390,
      windowHeight: -100,
    });
    expect(out.maxHeight).toBe(200);
  });

  it('returns floor maxHeight for NaN windowHeight', () => {
    const out = resolveMenuPresentation({
      band: 'phone',
      menu: 'act',
      windowWidth: 390,
      windowHeight: Number.NaN,
    });
    expect(out.maxHeight).toBe(200);
  });

  it('floors a very short phone viewport sheet height to 200', () => {
    const out = resolveMenuPresentation({
      band: 'phone',
      menu: 'act',
      windowWidth: 390,
      windowHeight: 300,
    });
    // 300 * 0.5 = 150 < 200 floor.
    expect(out.maxHeight).toBe(200);
  });
});

describe('resolveMenuPresentation — UX-001.2 offset cap preservation', () => {
  // Menus overlay (Modal) — they do not displace. The maxHeight values
  // must NEVER force the Timeline below its UX-001.2 offset cap. Since
  // the Modal sits ON TOP of the viewport, this is structural: no return
  // value subtracts from the timeline area. The test below makes the
  // overlay model explicit.
  const viewports = [
    { name: '390x844 (phone)', band: 'phone' as const, w: 390, h: 844 },
    { name: '1024x1366 (tablet portrait)', band: 'tablet' as const, w: 1024, h: 1366 },
    { name: '1366x768 (laptop)', band: 'tablet' as const, w: 1366, h: 768 },
    { name: '1920x1080 (wide)', band: 'wide' as const, w: 1920, h: 1080 },
  ];

  for (const v of viewports) {
    for (const menu of ['act', 'inspect', 'go'] as const) {
      it(`${menu} at ${v.name} returns a finite maxHeight ≤ windowHeight`, () => {
        const out = resolveMenuPresentation({
          band: v.band,
          menu,
          windowWidth: v.w,
          windowHeight: v.h,
        });
        expect(Number.isFinite(out.maxHeight)).toBe(true);
        expect(out.maxHeight).toBeGreaterThan(0);
        expect(out.maxHeight).toBeLessThanOrEqual(v.h);
      });
    }
  }
});
