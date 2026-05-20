/**
 * COMPOSER-002 — Dock accessibility + close affordances.
 *
 * Covers the accessibility-targets bar for the new dock chrome:
 *  - 44×44 tap targets (hitSlop / minWidth+minHeight) on the Cancel control,
 *  - accessibilityRole / accessibilityLabel on every Pressable,
 *  - accessibilityViewIsModal focus trap on the dock container,
 *  - reduce-motion fade path (no slide translate when reduced),
 *  - color-independent affordances (shape + text, not color alone),
 *  - the doctrine ban-list scan over the dock's user-facing copy.
 *
 * Source-scan discipline, matching the repo's component-test pattern.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const DOCK_SRC = fs.readFileSync(
  path.join(ROOT, 'src', 'features', 'arguments', 'ArgumentComposerDock.tsx'),
  'utf8',
);

// ── 1. Tap targets ─────────────────────────────────────────────

describe('COMPOSER-002 — dock controls meet the 44×44 tap target', () => {
  it('the Cancel Pressable carries hitSlop >= 14 on every edge', () => {
    const cancelBlock = DOCK_SRC.slice(
      DOCK_SRC.indexOf('argument-composer-dock-cancel') - 400,
      DOCK_SRC.indexOf('argument-composer-dock-cancel') + 80,
    );
    const slop = cancelBlock.match(/hitSlop=\{\{\s*top:\s*(\d+),\s*bottom:\s*(\d+),\s*left:\s*(\d+),\s*right:\s*(\d+)\s*\}\}/);
    expect(slop).not.toBeNull();
    const [, top, bottom, left, right] = slop!.map(Number);
    expect(top).toBeGreaterThanOrEqual(14);
    expect(bottom).toBeGreaterThanOrEqual(14);
    expect(left).toBeGreaterThanOrEqual(14);
    expect(right).toBeGreaterThanOrEqual(14);
  });

  it('the cancelButton style declares a 44×44 minimum effective target', () => {
    const styleBlock = DOCK_SRC.slice(DOCK_SRC.indexOf('cancelButton: {'));
    const minW = styleBlock.match(/minWidth:\s*(\d+)/);
    const minH = styleBlock.match(/minHeight:\s*(\d+)/);
    expect(minW).not.toBeNull();
    expect(minH).not.toBeNull();
    expect(Number(minW![1])).toBeGreaterThanOrEqual(44);
    expect(Number(minH![1])).toBeGreaterThanOrEqual(44);
  });
});

// ── 2. Roles + labels on interactive elements ──────────────────

describe('COMPOSER-002 — every dock Pressable exposes role + label', () => {
  it('the Cancel control is a button with a descriptive accessibilityLabel', () => {
    const cancelBlock = DOCK_SRC.slice(
      DOCK_SRC.indexOf('handleCancel}'),
      DOCK_SRC.indexOf('handleCancel}') + 400,
    );
    expect(cancelBlock).toMatch(/accessibilityRole="button"/);
    expect(cancelBlock).toMatch(/accessibilityLabel="Cancel and close composer"/);
  });

  it('every Pressable in the dock has an accessibilityRole', () => {
    // Count Pressables; the scrim is the only intentionally inert one and
    // it is hidden from accessibility (asserted below).
    const pressables = DOCK_SRC.match(/<Pressable/g) ?? [];
    const roles = DOCK_SRC.match(/accessibilityRole=/g) ?? [];
    // scrim Pressable is accessibilityElementsHidden — so roles === pressables - 1.
    expect(roles.length).toBeGreaterThanOrEqual(pressables.length - 1);
  });
});

// ── 3. Focus trap ──────────────────────────────────────────────

describe('COMPOSER-002 — the dock traps screen-reader focus while open', () => {
  it('the dock container declares accessibilityViewIsModal', () => {
    expect(DOCK_SRC).toMatch(/accessibilityViewIsModal/);
  });

  it('the dock panel exposes an accessibilityLabel for the dock root', () => {
    expect(DOCK_SRC).toMatch(/accessibilityLabel="Compose your move"/);
  });

  it('the inert scrim is hidden from assistive tech (not a focus stop)', () => {
    const scrimBlock = DOCK_SRC.slice(
      DOCK_SRC.indexOf('styles.scrim'),
      DOCK_SRC.indexOf('styles.scrim') + 320,
    );
    expect(scrimBlock).toMatch(/accessibilityElementsHidden/);
    expect(scrimBlock).toMatch(/importantForAccessibility="no-hide-descendants"/);
  });
});

// ── 4. Reduce-motion fade path ─────────────────────────────────

describe('COMPOSER-002 — reduce-motion disables the slide translate', () => {
  it('reads reduce-motion via AccessibilityInfo with the PR-001 override winning', () => {
    expect(DOCK_SRC).toMatch(/AccessibilityInfo\.isReduceMotionEnabled/);
    expect(DOCK_SRC).toMatch(/reduceMotionChanged/);
    expect(DOCK_SRC).toMatch(
      /typeof reduceMotionOverride === 'boolean'\s*\?\s*reduceMotionOverride/,
    );
  });

  it('when reduced motion is on, the panel style is opacity-only (no transform)', () => {
    // The animated-style memo: the reduced branch returns `{ opacity }`
    // with NO `transform`.
    expect(DOCK_SRC).toMatch(/if \(effectiveReducedMotion\) \{\s*return \{ opacity \};\s*\}/);
  });

  it('when reduced motion is on, the open animation snaps (setValue, no timing)', () => {
    expect(DOCK_SRC).toMatch(/if \(effectiveReducedMotion\) \{[\s\S]*?progress\.setValue/);
  });

  it('when reduced motion is off, a slide translate IS applied', () => {
    expect(DOCK_SRC).toMatch(/translateY:\s*translate/);
    expect(DOCK_SRC).toMatch(/translateX:\s*translate/);
  });
});

// ── 5. Color independence ──────────────────────────────────────

describe('COMPOSER-002 — dock affordances are recognizable without color', () => {
  it('the Cancel control carries a text label (not color-only)', () => {
    expect(DOCK_SRC).toMatch(/<Text style={styles\.cancelText}>Cancel<\/Text>/);
  });

  it('the drag handle is a shape (a sized bar), not a color swatch', () => {
    const handleBlock = DOCK_SRC.slice(DOCK_SRC.indexOf('dragHandle: {'));
    expect(handleBlock).toMatch(/width:\s*\d+/);
    expect(handleBlock).toMatch(/height:\s*\d+/);
    expect(handleBlock).toMatch(/borderRadius:\s*\d+/);
  });
});

// ── 6. Doctrine ban-list over the dock's user-facing copy ──────

describe('COMPOSER-002 — the dock surfaces no verdict / truth tokens', () => {
  // The dock's only new user-facing copy is the header label + Cancel.
  // cdiscourse-doctrine §1 / §9: no truth labels, no internal codes.
  const BANNED = [
    'winner',
    'loser',
    'liar',
    'correct',
    'incorrect',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'stupid',
    'idiot',
  ];

  // Extract the literal strings rendered inside <Text>...</Text>.
  const textLiterals = (DOCK_SRC.match(/<Text[^>]*>([^<{][^<]*)<\/Text>/g) ?? []).map((m) =>
    m.replace(/<Text[^>]*>/, '').replace(/<\/Text>/, ''),
  );
  // Extract accessibilityLabel string literals (also user-facing to SR users).
  const a11yLabels = (DOCK_SRC.match(/accessibilityLabel="([^"]+)"/g) ?? []).map((m) =>
    m.replace(/accessibilityLabel="/, '').replace(/"$/, ''),
  );
  const allCopy = [...textLiterals, ...a11yLabels];

  it('extracts at least the handle label + Cancel copy', () => {
    expect(allCopy.length).toBeGreaterThan(0);
    expect(allCopy.join(' ')).toMatch(/Cancel/);
  });

  it.each(BANNED)('no rendered string contains the banned token "%s"', (token) => {
    for (const copy of allCopy) {
      expect(copy.toLowerCase()).not.toContain(token);
    }
  });

  it('no rendered string leaks a snake_case internal code', () => {
    for (const copy of allCopy) {
      // testIDs are not in this set (they are not <Text> children or
      // accessibilityLabels). User-facing copy must be plain language.
      expect(copy).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});
