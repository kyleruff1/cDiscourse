/**
 * QOL-030 — Popout chassis contract (Popout / PopoutEntry / PopoutGroup).
 *
 * Design §9 test plan, "Chassis" bullet — focus trap, `Esc`,
 * reduce-motion instant, 44px targets.
 *
 * Follows the repo's UI-test discipline (PreSendReviewSheet /
 * EvidenceDebtChip): the load-bearing render decision is extracted into a
 * pure helper (`buildPopoutEntryAccessibilityLabel`) and exercised
 * directly; the component wiring (roles, hit slop, focus trap, scrim,
 * reduce-motion snap, color-independence) is asserted by a static
 * source-scan. `.tsx` extension matches the sibling chassis test files.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_POPOUT_ENTRY_KINDS,
  PADDED_HIT_SLOP,
  POPOUT_ENTRY_MIN_HEIGHT,
  buildPopoutEntryAccessibilityLabel,
} from '../src/features/arguments/oneBox/PopoutEntry';
import { POPOUT_FLASH_DURATION_MS } from '../src/features/arguments/oneBox/Popout';

const ONEBOX_DIR = path.join(process.cwd(), 'src', 'features', 'arguments', 'oneBox');
const POPOUT_SRC = fs.readFileSync(path.join(ONEBOX_DIR, 'Popout.tsx'), 'utf8');
const ENTRY_SRC = fs.readFileSync(path.join(ONEBOX_DIR, 'PopoutEntry.tsx'), 'utf8');
const GROUP_SRC = fs.readFileSync(path.join(ONEBOX_DIR, 'PopoutGroup.tsx'), 'utf8');

// ── 1. PopoutEntry accessibility-label helper ──────────────────

describe('QOL-030 chassis — buildPopoutEntryAccessibilityLabel', () => {
  it('returns the plain label when nothing special applies', () => {
    expect(buildPopoutEntryAccessibilityLabel({ label: 'Reply' })).toBe('Reply');
  });

  it('prefers an explicit accessibilityLabel over the visible label', () => {
    expect(
      buildPopoutEntryAccessibilityLabel({ label: 'Reply', accessibilityLabel: 'Reply to this move' }),
    ).toBe('Reply to this move');
  });

  it('prefixes "Suggested." for a promoted entry', () => {
    expect(buildPopoutEntryAccessibilityLabel({ label: 'Reply', isPromoted: true })).toBe(
      'Suggested. Reply',
    );
  });

  it('appends "(unavailable: reason)" for a disabled entry with a reason', () => {
    expect(
      buildPopoutEntryAccessibilityLabel({
        label: 'Ask quote',
        isDisabled: true,
        disabledReason: 'Join a side to use this action.',
      }),
    ).toBe('Ask quote (unavailable: Join a side to use this action.)');
  });

  it('appends a bare "(unavailable)" for a disabled entry with no reason', () => {
    expect(buildPopoutEntryAccessibilityLabel({ label: 'Flag', isDisabled: true })).toBe(
      'Flag (unavailable)',
    );
  });

  it('combines the promoted prefix and disabled suffix', () => {
    expect(
      buildPopoutEntryAccessibilityLabel({
        label: 'Add evidence',
        isPromoted: true,
        isDisabled: true,
        disabledReason: 'No longer applicable.',
      }),
    ).toBe('Suggested. Add evidence (unavailable: No longer applicable.)');
  });
});

// ── 2. PopoutEntry — vocabulary + tap target ───────────────────

describe('QOL-030 chassis — PopoutEntry vocabulary + tap target', () => {
  it('exposes the 5 entry kinds', () => {
    expect([...ALL_POPOUT_ENTRY_KINDS].sort()).toEqual(
      ['box-opening', 'direct', 'inspect', 'navigate', 'role-change'].sort(),
    );
  });

  it('the minimum row height clears 44px', () => {
    expect(POPOUT_ENTRY_MIN_HEIGHT).toBeGreaterThanOrEqual(44);
  });

  it('the padded hit-slop is non-zero on every edge', () => {
    expect(PADDED_HIT_SLOP.top).toBeGreaterThan(0);
    expect(PADDED_HIT_SLOP.bottom).toBeGreaterThan(0);
    expect(PADDED_HIT_SLOP.left).toBeGreaterThan(0);
    expect(PADDED_HIT_SLOP.right).toBeGreaterThan(0);
  });

  it('the entry row is a Pressable with role + state', () => {
    expect(ENTRY_SRC).toMatch(/<Pressable/);
    expect(ENTRY_SRC).toMatch(/accessibilityRole="button"/);
    expect(ENTRY_SRC).toMatch(/accessibilityState=\{\{ disabled: isDisabled \}\}/);
  });

  it('the entry row carries the padded hit-slop', () => {
    expect(ENTRY_SRC).toMatch(/hitSlop=\{PADDED_HIT_SLOP\}/);
  });

  it('a disabled entry stays visible with a one-line reason (no silent omission)', () => {
    // The reason text is rendered when isDisabled && disabledReason.
    expect(ENTRY_SRC).toMatch(/isDisabled && disabledReason \?/);
    expect(ENTRY_SRC).toMatch(/styles\.disabledReason/);
  });

  it('a disabled entry drops its onPress (cannot be invoked)', () => {
    expect(ENTRY_SRC).toMatch(/onPress=\{isDisabled \? undefined : onPress\}/);
    expect(ENTRY_SRC).toMatch(/disabled=\{isDisabled\}/);
  });
});

// ── 3. PopoutEntry — color independence ────────────────────────

describe('QOL-030 chassis — PopoutEntry color independence', () => {
  it('every entry kind has a distinct leading glyph (shape, not color)', () => {
    // KIND_GLYPH maps each kind to a glyph; promotion adds a ★ marker.
    expect(ENTRY_SRC).toMatch(/KIND_GLYPH/);
    expect(ENTRY_SRC).toMatch(/'box-opening':/);
    expect(ENTRY_SRC).toMatch(/isPromoted \? '★ ' : ''/);
  });

  it('promotion emphasis is text-weight, not color', () => {
    // labelPromoted bumps fontWeight; rowPromoted swaps to a raised
    // surface — never a verdict color.
    expect(ENTRY_SRC).toMatch(/labelPromoted/);
    expect(ENTRY_SRC).toMatch(/fontWeight: '800'/);
  });

  it('the label is always a <Text> (text carries the meaning)', () => {
    expect(ENTRY_SRC).toMatch(/<Text[^>]*style=\{\[\s*styles\.label/);
  });

  it('does not import an icon library (uses <Text> glyphs)', () => {
    expect(ENTRY_SRC).not.toMatch(/from ['"]@expo\/vector-icons/);
    expect(ENTRY_SRC).not.toMatch(/react-native-vector-icons/);
  });
});

// ── 4. PopoutGroup — header suppression + empty group ──────────

describe('QOL-030 chassis — PopoutGroup', () => {
  it('renders nothing for an empty group (no stray header)', () => {
    expect(GROUP_SRC).toMatch(/if \(entries\.length === 0\) return null;/);
  });

  it('suppresses the header when showHeader is false', () => {
    expect(GROUP_SRC).toMatch(/showHeader \?/);
  });

  it('the group exposes accessibilityRole="menu"', () => {
    expect(GROUP_SRC).toMatch(/accessibilityRole="menu"/);
  });

  it('the header is a <Text> with the header role', () => {
    expect(GROUP_SRC).toMatch(/accessibilityRole="header"/);
  });

  it('renders one PopoutEntry per entry', () => {
    expect(GROUP_SRC).toMatch(/<PopoutEntry key=\{key\}/);
  });
});

// ── 5. Popout — flash duration in the design band ──────────────

describe('QOL-030 chassis — Popout flash duration', () => {
  it('the flash duration is inside the design 120-160 ms band', () => {
    expect(POPOUT_FLASH_DURATION_MS).toBeGreaterThanOrEqual(120);
    expect(POPOUT_FLASH_DURATION_MS).toBeLessThanOrEqual(160);
  });
});

// ── 6. Popout — focus trap + Esc + back ────────────────────────

describe('QOL-030 chassis — Popout focus trap + close paths', () => {
  it('the popout panel declares accessibilityViewIsModal (focus trap)', () => {
    expect(POPOUT_SRC).toMatch(/accessibilityViewIsModal/);
  });

  it('native hardware-back closes via Modal onRequestClose', () => {
    expect(POPOUT_SRC).toMatch(/onRequestClose=\{onClose\}/);
  });

  it('web Escape closes the popout', () => {
    expect(POPOUT_SRC).toMatch(/event\.key === 'Escape'/);
    expect(POPOUT_SRC).toMatch(/onCloseRef\.current\(\)/);
  });

  it('the Escape listener is scoped to visible + web only', () => {
    expect(POPOUT_SRC).toMatch(/if \(!visible\) return;/);
    expect(POPOUT_SRC).toMatch(/if \(Platform\.OS !== 'web'\) return;/);
  });

  it('the close control is a 44x44 Pressable with role + label', () => {
    const closeBlock = POPOUT_SRC.slice(
      POPOUT_SRC.indexOf('one-box-popout-close') - 420,
      POPOUT_SRC.indexOf('one-box-popout-close') + 40,
    );
    expect(closeBlock).toMatch(/accessibilityRole="button"/);
    expect(closeBlock).toMatch(/accessibilityLabel=\{`Close \$\{title\}`\}/);
    const styleBlock = POPOUT_SRC.slice(POPOUT_SRC.indexOf('closeButton: {'));
    expect(Number(styleBlock.match(/minWidth:\s*(\d+)/)![1])).toBeGreaterThanOrEqual(44);
    expect(Number(styleBlock.match(/minHeight:\s*(\d+)/)![1])).toBeGreaterThanOrEqual(44);
  });
});

// ── 7. Popout — board-non-blocking scrim ───────────────────────

describe('QOL-030 chassis — Popout board-non-blocking scrim', () => {
  it('the scrim is a low-opacity veil (does not hide the board)', () => {
    // The backdrop colour is a low-alpha rgba — the board stays visible.
    const backdropBlock = POPOUT_SRC.slice(POPOUT_SRC.indexOf('backdrop: {'));
    const rgba = backdropBlock.match(/rgba\(2,6,23,([0-9.]+)\)/);
    expect(rgba).not.toBeNull();
    expect(Number(rgba![1])).toBeLessThan(0.5);
  });

  it('the panel caps below full-screen so the board stays visible', () => {
    const panelBlock = POPOUT_SRC.slice(POPOUT_SRC.indexOf('panel: {'));
    expect(panelBlock).toMatch(/maxHeight: '72%'/);
  });

  it('tapping the scrim dismisses the popout', () => {
    // Unlike the composer dock (inert scrim), a popout scrim closes.
    const scrimBlock = POPOUT_SRC.slice(
      POPOUT_SRC.indexOf('one-box-popout-scrim') - 320,
      POPOUT_SRC.indexOf('one-box-popout-scrim') + 40,
    );
    expect(scrimBlock).toMatch(/onPress=\{handleClose\}/);
  });

  it('the scrim is hidden from assistive tech (Esc / close are the labelled paths)', () => {
    const scrimBlock = POPOUT_SRC.slice(
      POPOUT_SRC.indexOf('styles.scrim'),
      POPOUT_SRC.indexOf('styles.scrim') + 320,
    );
    expect(scrimBlock).toMatch(/accessibilityElementsHidden/);
    expect(scrimBlock).toMatch(/importantForAccessibility="no-hide-descendants"/);
  });
});

// ── 8. Popout — reduce-motion ──────────────────────────────────

describe('QOL-030 chassis — Popout reduce-motion', () => {
  it('reads reduce-motion via AccessibilityInfo with the caller override winning', () => {
    expect(POPOUT_SRC).toMatch(/AccessibilityInfo\.isReduceMotionEnabled/);
    expect(POPOUT_SRC).toMatch(/reduceMotionChanged/);
    expect(POPOUT_SRC).toMatch(
      /typeof reduceMotionOverride === 'boolean'\s*\?\s*reduceMotionOverride/,
    );
  });

  it('when reduce-motion is on, the open animation snaps (setValue, no timing)', () => {
    expect(POPOUT_SRC).toMatch(/if \(effectiveReducedMotion\) \{\s*progress\.setValue/);
  });

  it('when reduce-motion is on, the panel style is opacity-only (no transform)', () => {
    expect(POPOUT_SRC).toMatch(/if \(effectiveReducedMotion\) \{\s*return \{ opacity \};\s*\}/);
  });

  it('when reduce-motion is off, a flash translate IS applied', () => {
    expect(POPOUT_SRC).toMatch(/translateY: translate/);
  });
});

// ── 9. Doctrine — chassis authors no flash-menu copy ───────────

describe('QOL-030 chassis — doctrine: no verdict copy, no AI, no network', () => {
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
  ];

  const allSrc = [POPOUT_SRC, ENTRY_SRC, GROUP_SRC];

  it.each(BANNED)('no chassis source contains the verdict token "%s"', (token) => {
    for (const src of allSrc) {
      // Scan rendered <Text> literals + accessibilityLabel literals.
      const textLiterals = (src.match(/<Text[^>]*>([^<{][^<]*)<\/Text>/g) ?? []).join(' ');
      const a11y = (src.match(/accessibilityLabel=["'`][^"'`]+["'`]/g) ?? []).join(' ');
      expect(`${textLiterals} ${a11y}`.toLowerCase()).not.toContain(token);
    }
  });

  it('the chassis imports no Supabase / network / AI primitive', () => {
    for (const src of allSrc) {
      expect(src).not.toMatch(/from ['"].*supabase/);
      expect(src).not.toMatch(/\bfetch\(/);
      expect(src).not.toMatch(/anthropic|openai|x\.ai/i);
    }
  });
});
