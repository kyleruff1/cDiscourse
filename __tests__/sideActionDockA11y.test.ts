/**
 * SC-005 — Dock accessibility contract.
 *
 * Source-scan suite, matching the repo's component-test pattern
 * (`composerDockA11y.test.ts`). Covers the accessibility-targets bar:
 *  - 44×44 effective tap targets on every interactive element,
 *  - accessibilityRole / accessibilityLabel / accessibilityState on every
 *    Pressable,
 *  - the collapsed chip exposes { expanded: false }; the collapse control
 *    exposes { expanded: true },
 *  - category headers carry accessibilityRole="header",
 *  - the reduce-motion path uses no translateY slide,
 *  - web Escape collapses the dock; the chips activate via onPress
 *    (Enter/Space on a focused RN-web Pressable).
 */
import fs from 'fs';
import path from 'path';

const RAIL_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'features', 'arguments', 'ArgumentSideActionRail.tsx'),
  'utf8',
);

// ── 1. Tap targets ──────────────────────────────────────────────

describe('SC-005 a11y — 44×44 tap targets', () => {
  it('the collapsed chip style declares minHeight + minWidth >= 44', () => {
    const block = RAIL_SRC.slice(RAIL_SRC.indexOf('collapsedChip: {'));
    const minH = block.match(/minHeight:\s*(\d+)/);
    const minW = block.match(/minWidth:\s*(\d+)/);
    expect(minH).not.toBeNull();
    expect(minW).not.toBeNull();
    expect(Number(minH![1])).toBeGreaterThanOrEqual(44);
    expect(Number(minW![1])).toBeGreaterThanOrEqual(44);
  });

  it('the action chip style declares minHeight >= 44', () => {
    const block = RAIL_SRC.slice(RAIL_SRC.indexOf('actionChip: {'));
    const minH = block.match(/minHeight:\s*(\d+)/);
    expect(minH).not.toBeNull();
    expect(Number(minH![1])).toBeGreaterThanOrEqual(44);
  });

  it('the collapse control reaches a 44×44 effective target (minHeight/minWidth or hitSlop)', () => {
    const block = RAIL_SRC.slice(RAIL_SRC.indexOf('collapseControl: {'));
    const minH = block.match(/minHeight:\s*(\d+)/);
    const minW = block.match(/minWidth:\s*(\d+)/);
    expect(minH).not.toBeNull();
    expect(minW).not.toBeNull();
    expect(Number(minH![1])).toBeGreaterThanOrEqual(44);
    expect(Number(minW![1])).toBeGreaterThanOrEqual(44);
    // The collapse Pressable also carries a hitSlop on top of the style.
    const collapseBlock = RAIL_SRC.slice(
      RAIL_SRC.indexOf('rail-toggle-collapse') - 600,
      RAIL_SRC.indexOf('rail-toggle-collapse') + 120,
    );
    expect(collapseBlock).toMatch(/hitSlop=/);
  });
});

// ── 2. Roles + labels + states on interactive elements ──────────

describe('SC-005 a11y — every dock Pressable exposes role + label + state', () => {
  it('every Pressable carries an accessibilityRole', () => {
    const pressables = RAIL_SRC.match(/<Pressable/g) ?? [];
    const roles = RAIL_SRC.match(/accessibilityRole=/g) ?? [];
    // Every Pressable in the rail is interactive — no inert scrim here.
    expect(roles.length).toBeGreaterThanOrEqual(pressables.length);
  });

  it('the collapsed expand chip is a button with label + hint + expanded:false', () => {
    const block = RAIL_SRC.slice(
      RAIL_SRC.indexOf('rail-toggle-expand') - 600,
      RAIL_SRC.indexOf('rail-toggle-expand') + 80,
    );
    expect(block).toMatch(/accessibilityRole="button"/);
    expect(block).toMatch(/accessibilityLabel=\{collapsedLabel\.accessibilityLabel\}/);
    expect(block).toMatch(/accessibilityHint=\{collapsedLabel\.accessibilityHint\}/);
    expect(block).toMatch(/accessibilityState=\{\{\s*expanded:\s*false\s*\}\}/);
  });

  it('the collapse control is a button with accessibilityState expanded:true', () => {
    const block = RAIL_SRC.slice(
      RAIL_SRC.indexOf('rail-toggle-collapse') - 600,
      RAIL_SRC.indexOf('rail-toggle-collapse') + 120,
    );
    expect(block).toMatch(/accessibilityRole="button"/);
    expect(block).toMatch(/accessibilityLabel="Collapse actions"/);
    expect(block).toMatch(/accessibilityState=\{\{\s*expanded:\s*true\s*\}\}/);
  });

  it('each action chip is a button with an accessibilityLabel + accessibilityHint', () => {
    const block = RAIL_SRC.slice(
      RAIL_SRC.indexOf('rail-action-${a.code}') - 700,
      RAIL_SRC.indexOf('rail-action-${a.code}') + 120,
    );
    expect(block).toMatch(/accessibilityRole="button"/);
    expect(block).toMatch(/accessibilityLabel=\{a\.label\}/);
    expect(block).toMatch(/accessibilityHint=\{a\.helper\}/);
  });
});

// ── 3. Category headers announce as headers ─────────────────────

describe('SC-005 a11y — category headers', () => {
  it('the section header Text carries accessibilityRole="header"', () => {
    const block = RAIL_SRC.slice(
      RAIL_SRC.indexOf('rail-section-header-${section.category}') - 400,
      RAIL_SRC.indexOf('rail-section-header-${section.category}') + 60,
    );
    expect(block).toMatch(/accessibilityRole="header"/);
  });

  it('the dock title Text carries accessibilityRole="header"', () => {
    const block = RAIL_SRC.slice(
      RAIL_SRC.indexOf('expandedViewModel.title') - 400,
      RAIL_SRC.indexOf('expandedViewModel.title') + 60,
    );
    expect(block).toMatch(/accessibilityRole="header"/);
  });
});

// ── 4. Reduce-motion = no slide ─────────────────────────────────

describe('SC-005 a11y — reduce-motion fallback', () => {
  it('reads an effective reduce-motion value (override wins over the OS read)', () => {
    expect(RAIL_SRC).toMatch(/reduceMotionOverride/);
    expect(RAIL_SRC).toMatch(/AccessibilityInfo\.isReduceMotionEnabled/);
    expect(RAIL_SRC).toMatch(/effectiveReducedMotion/);
  });

  it('snaps (no Animated.timing) when reduce-motion is on or the dock is side-anchored', () => {
    // The animation effect early-returns with progress.setValue when
    // effectiveReducedMotion is true OR the variant is the anchored side
    // dock — no translateY slide is started.
    const block = RAIL_SRC.slice(
      RAIL_SRC.indexOf('// ── narrow-sheet slide animation'),
      RAIL_SRC.indexOf('// ── web Escape key'),
    );
    expect(block).toMatch(/effectiveReducedMotion\s*\|\|\s*variant\s*===\s*['"]side['"]/);
    expect(block).toMatch(/progress\.setValue/);
  });

  it('the slide transform is only applied for the narrow sheet when motion is allowed', () => {
    expect(RAIL_SRC).toMatch(
      /variant\s*===\s*['"]sheet['"]\s*&&\s*!effectiveReducedMotion/,
    );
    // translateY is the only transform — and it is gated by the guard above.
    expect(RAIL_SRC).toMatch(/translateY:/);
  });
});

// ── 5. Web keyboard nav ─────────────────────────────────────────

describe('SC-005 a11y — web keyboard navigation', () => {
  it('Escape collapses the expanded dock (web-only keydown listener)', () => {
    const block = RAIL_SRC.slice(
      RAIL_SRC.indexOf('// ── web Escape key'),
      RAIL_SRC.indexOf('// ── web Escape key') + 700,
    );
    expect(block).toMatch(/Platform\.OS\s*!==\s*['"]web['"]/);
    expect(block).toMatch(/event\.key\s*===\s*['"]Escape['"]/);
    expect(block).toMatch(/setExpanded\(false\)/);
  });

  it('chips activate via onPress — Enter/Space on a focused RN-web Pressable', () => {
    // RN-web Pressables are focusable and Enter/Space already fire onPress;
    // no custom key trap is added. The action chip dispatches via onPress.
    expect(RAIL_SRC).toMatch(/onPress=\{\(\)\s*=>\s*handleActionPress\(a\.code\)\}/);
  });
});
