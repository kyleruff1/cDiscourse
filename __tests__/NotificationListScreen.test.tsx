/**
 * QOL-040 — NotificationListScreen source-scan tests covering
 * the four states (loading / empty / error / populated) and the
 * "Mark all read" affordance gating.
 */
import fs from 'fs';
import path from 'path';
import { NOTIFICATION_LIST_COPY } from '../src/features/notifications/notificationCopy';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'notifications', 'NotificationListScreen.tsx'),
  'utf8',
);

describe('NotificationListScreen — state branches', () => {
  it('renders a loading pane when loading + zero rows', () => {
    expect(SRC).toMatch(/if \(loading && notifications\.length === 0\)/);
    expect(SRC).toContain("testID=\"notification-list-loading\"");
  });

  it('renders an error pane when error is set', () => {
    expect(SRC).toContain('if (error)');
    expect(SRC).toContain("testID=\"notification-list-error\"");
  });

  it('renders an empty pane when there are no rows', () => {
    expect(SRC).toContain("testID=\"notification-list-empty\"");
  });

  it('renders a populated FlatList when notifications.length > 0', () => {
    expect(SRC).toContain('FlatList<RoomNotification>');
    expect(SRC).toContain('data={notifications}');
  });
});

describe('NotificationListScreen — Mark all read', () => {
  it('the affordance is rendered ONLY when unreadCount > 0', () => {
    expect(SRC).toMatch(/unreadCount > 0 \?[\s\S]{0,400}Mark/);
  });

  it('the button has accessibilityRole="button" and a descriptive label', () => {
    const markAllIdx = SRC.indexOf("testID=\"notification-list-mark-all-read\"");
    expect(markAllIdx).toBeGreaterThan(-1);
    // Search backwards for the Pressable's a11y props.
    const region = SRC.slice(Math.max(0, markAllIdx - 600), markAllIdx);
    expect(region).toContain('accessibilityRole="button"');
    expect(region).toContain('accessibilityLabel=');
  });

  it('uses copy from NOTIFICATION_LIST_COPY (no hard-coded strings)', () => {
    // The label "Mark all read" must come from the copy table.
    expect(NOTIFICATION_LIST_COPY.markAllRead).toBe('Mark all read');
  });
});

describe('NotificationListScreen — non-navigable confirmation card', () => {
  it('renders a confirmation card when expandedId matches the row', () => {
    expect(SRC).toMatch(/expandedId === item\.id \?[\s\S]{0,400}testID=\{`notification-row-\$\{item\.id\}-confirmation`\}/);
  });

  it('the confirmation card uses accessibilityLiveRegion="polite"', () => {
    expect(SRC).toContain('accessibilityLiveRegion="polite"');
  });
});

describe('NotificationListScreen — header + accessibility', () => {
  it('declares the header as accessibilityRole="header"', () => {
    expect(SRC).toContain('accessibilityRole="header"');
  });

  it('renders a stable testID for the screen + header', () => {
    expect(SRC).toContain("testID=\"notification-list-screen\"");
    expect(SRC).toContain("testID=\"notification-list-header\"");
  });
});

describe('NotificationListScreen — refresh control', () => {
  it('wires pull-to-refresh to onRefresh prop', () => {
    expect(SRC).toContain('RefreshControl');
    expect(SRC).toContain('handleRefresh');
  });
});

describe('NotificationListScreen — tap routes a navigable notification through onOpenDeepLink', () => {
  it('handleRowPress resolves the deep link and calls onOpenDeepLink for navigable rows', () => {
    expect(SRC).toContain('resolveDeepLink(n)');
    expect(SRC).toContain('onOpenDeepLink(link, n)');
  });

  it('handleRowPress marks the row read on any tap (mark-on-engage)', () => {
    expect(SRC).toContain('void onMarkOneRead(n.id);');
  });

  it('handleRowPress expands the confirmation card when link is null', () => {
    expect(SRC).toMatch(/if \(link === null\)[\s\S]{0,400}setExpandedId/);
  });
});
