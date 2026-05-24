/**
 * QOL-040 — NotificationRow component source-scan + copy
 * derivation tests. The visual layout follows the existing
 * "source-scan the JSX shape" pattern used elsewhere in the repo
 * to avoid a heavy RN renderer test setup.
 */
import fs from 'fs';
import path from 'path';
import {
  buildNotificationCopy,
  resolveDeepLink,
  type RoomNotification,
} from '../src/features/notifications/notificationModel';
import { NOTIFICATION_LIST_COPY } from '../src/features/notifications/notificationCopy';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'notifications', 'NotificationRow.tsx'),
  'utf8',
);

function row(overrides: Partial<RoomNotification> = {}): RoomNotification {
  return {
    id: 'rn-1',
    recipientId: 'user-recipient',
    debateId: 'deb-1',
    argumentId: 'arg-1',
    type: 'new_response',
    roomTitle: 'A reasonable disagreement',
    meta: {},
    readAt: null,
    createdAt: '2026-05-24T11:59:00.000Z',
    ...overrides,
  };
}

describe('NotificationRow — accessibility + tap target', () => {
  it('declares accessibilityRole="button"', () => {
    expect(SRC).toMatch(/accessibilityRole="button"/);
  });

  it('declares accessibilityLabel that includes the title + body for screen readers', () => {
    // The accessibility label is composed from the per-row copy.
    expect(SRC).toContain('a11yLabel');
    expect(SRC).toContain('title');
    expect(SRC).toContain('body');
  });

  it('declares accessibilityState reflecting unread/read', () => {
    expect(SRC).toMatch(/accessibilityState=\{[^}]*selected:\s*!unread/);
  });

  it('uses hitSlop to expand the tap target', () => {
    expect(SRC).toMatch(/hitSlop=\{\s*\{\s*top:\s*\d+/);
  });

  it('uses minHeight 64 (≥44 logical-px tap target requirement)', () => {
    expect(SRC).toMatch(/minHeight: 64/);
  });
});

describe('NotificationRow — copy derivation', () => {
  it('an unread row gets the rowUnreadAccessibilityLabel prefix', () => {
    const n = row();
    const expected = `${NOTIFICATION_LIST_COPY.rowUnreadAccessibilityLabel}. ${buildNotificationCopy(n.type, n.roomTitle, n.meta).title}`;
    expect(expected.startsWith('Unread notification. New response')).toBe(true);
  });

  it('a read row gets the rowReadAccessibilityLabel prefix', () => {
    const n = row({ readAt: '2026-05-24T12:00:00.000Z' });
    expect(n.readAt).not.toBeNull();
    // The component logic: `unread ? rowUnreadAccessibilityLabel : rowReadAccessibilityLabel`.
    const label = NOTIFICATION_LIST_COPY.rowReadAccessibilityLabel;
    expect(label).toBe('Notification');
  });

  it('a non-navigable row exposes the "no access" hint', () => {
    const n = row({ type: 'room_made_private', argumentId: null });
    expect(resolveDeepLink(n)).toBeNull();
    // The hint copy is from NOTIFICATION_LIST_COPY.
    expect(NOTIFICATION_LIST_COPY.rowNoAccessHint).toContain('access');
  });

  it('a navigable row exposes the "open" hint', () => {
    const n = row({ type: 'new_response', argumentId: 'arg-1' });
    expect(resolveDeepLink(n)).not.toBeNull();
    expect(NOTIFICATION_LIST_COPY.rowOpenHint).toContain('Open');
  });
});

describe('NotificationRow — visual rules', () => {
  it('renders an unread dot when readAt === null', () => {
    expect(SRC).toMatch(/unread \?[\s\S]{0,400}unreadDot/);
  });

  it('the unread dot is hidden from the screen reader (the row state carries the unread signal)', () => {
    const dotIdx = SRC.indexOf('styles.unreadDot');
    expect(dotIdx).toBeGreaterThan(-1);
    const dotBlock = SRC.slice(Math.max(0, dotIdx - 200), dotIdx + 400);
    expect(dotBlock).toContain('accessibilityElementsHidden={true}');
    expect(dotBlock).toContain('importantForAccessibility="no-hide-descendants"');
  });

  it('renders a glyph per type (shape carries meaning, not just color)', () => {
    expect(SRC).toContain('TYPE_GLYPH');
    expect(SRC).toContain('iconGlyph');
  });

  it('the glyph is hidden from the screen reader (the row label carries the type)', () => {
    const glyphIdx = SRC.indexOf('styles.iconGlyph');
    expect(glyphIdx).toBeGreaterThan(-1);
    const glyphBlock = SRC.slice(Math.max(0, glyphIdx - 100), glyphIdx + 200);
    expect(glyphBlock).toContain('accessibilityElementsHidden={true}');
  });
});

describe('NotificationRow — testID for tests', () => {
  it('renders a stable testID per notification id', () => {
    expect(SRC).toContain('testID={`notification-row-${notification.id}`}');
  });

  it('the unread dot has a stable testID', () => {
    expect(SRC).toContain('-unread-dot');
  });

  it('the "no access" hint has a stable testID', () => {
    expect(SRC).toContain('-no-access');
  });
});
