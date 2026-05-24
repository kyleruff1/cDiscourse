/**
 * QOL-040 — NotificationBadge component tests.
 *
 * Source-scan + pure-helper discipline (mirrors BranchCollapseStub
 * pattern). The badge is small enough to test by inspecting the
 * component's source for its visual rules — count cap, "hide at
 * zero", accessibility label.
 */
import fs from 'fs';
import path from 'path';
import { NOTIFICATION_LIST_COPY } from '../src/features/notifications/notificationCopy';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'notifications', 'NotificationBadge.tsx'),
  'utf8',
);

describe('NotificationBadge — visual rules', () => {
  it('hides at zero (returns null when safeCount <= 0)', () => {
    expect(SRC).toMatch(/if \(safeCount <= 0\) return null;/);
  });

  it('caps the display at "9+" so layout does not drift', () => {
    expect(SRC).toMatch(/safeCount > 9 \? '9\+' : String\(safeCount\)/);
  });

  it('exposes an accessibilityLabel that names the count', () => {
    // The component reads NOTIFICATION_LIST_COPY.badgeAccessibilityLabel(safeCount).
    expect(SRC).toContain('badgeAccessibilityLabel(safeCount)');
  });

  it('the accessibility-label helper pluralises correctly', () => {
    expect(NOTIFICATION_LIST_COPY.badgeAccessibilityLabel(1)).toBe('1 unread notification');
    expect(NOTIFICATION_LIST_COPY.badgeAccessibilityLabel(2)).toBe('2 unread notifications');
    expect(NOTIFICATION_LIST_COPY.badgeAccessibilityLabel(9)).toBe('9 unread notifications');
  });

  it('the visible numeric is hidden from the screen reader (the parent label carries the count)', () => {
    expect(SRC).toMatch(/accessibilityElementsHidden=\{true\}/);
    expect(SRC).toMatch(/importantForAccessibility="no-hide-descendants"/);
  });

  it('declares a testID for in-app placement tests', () => {
    expect(SRC).toContain("testID = 'notification-badge'");
  });

  it('uses ≥18-px minimum visible size for legibility (no shrinking)', () => {
    expect(SRC).toMatch(/minWidth: 18/);
    expect(SRC).toMatch(/height: 18/);
  });
});

describe('NotificationBadge — doctrine', () => {
  it('does not embed an internal code or snake_case in any visibly-rendered string', () => {
    // Visible strings come from NOTIFICATION_LIST_COPY. The
    // only literal the component renders directly is the count
    // display itself (pure digits + "+"). Engineering literals
    // like `testID`, `style`, accessibility prop values, and
    // imports are not user-visible.
    //
    // We scan JSX child text positions only: any string literal
    // that appears immediately inside `<Text>…</Text>` is a
    // candidate. The component renders `{display}` (a variable,
    // not a literal). So the assertion is: there is NO bare
    // string literal child inside any `<Text>` element.
    const textChildMatches = SRC.match(/<Text[^>]*>\s*'[^']+'\s*<\/Text>/g) || [];
    expect(textChildMatches).toEqual([]);
    // The accessibility-label helper output (used by
    // accessibilityLabel={…}) is plain English, never
    // snake_case.
    expect(NOTIFICATION_LIST_COPY.badgeAccessibilityLabel(3)).not.toMatch(/_/);
  });
});
