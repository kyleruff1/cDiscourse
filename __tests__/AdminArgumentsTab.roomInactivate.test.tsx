/**
 * ADMIN-CONV-INACTIVE-001 — AdminArgumentsTab room-header (whole-conversation)
 * inactivation wiring tests.
 *
 * Following the established repo discipline (the pinned react-test-renderer is
 * held away from @testing-library's peer; the tab's load-bearing decisions are
 * exercised via the pure models + a source-scan of the component), this suite
 * asserts the room-header inactivation affordances:
 *
 *  - the tab imports + calls the #514 DEBATE-level wrappers
 *    (markDebateInactive / markDebateActive / bulkMarkDebate*);
 *  - a ROOM checkbox at the header selects the whole conversation via a SEPARATE
 *    `selectedRoomIds` scope (distinct from the per-argument `selectedIds`);
 *  - a per-room "Mark room inactive" / "Mark room active" action is wired to the
 *    single-debate wrappers with roomId == group.debateId (== group.roomId);
 *  - a ROOM bulk bar appears when ≥1 room is selected and routes to the bulk
 *    debate wrappers, respecting the debate bulk id cap;
 *  - a DEBATE-level inactive badge derives from `isDebateInactive`
 *    (`inactive_at`-only) — never a reason (§10a);
 *  - the existing per-ARGUMENT inactivation (per-row + argument bulk) is RETAINED;
 *  - the two selection scopes have distinct testIDs.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const src = fs.readFileSync(
  path.join(repoRoot, 'src/features/admin/AdminArgumentsTab.tsx'),
  'utf8',
);

describe('AdminArgumentsTab — imports the DEBATE-level wrappers', () => {
  it('imports from adminDebatesInactiveApi', () => {
    expect(src).toContain("from './adminDebatesInactiveApi'");
  });

  it('imports markDebateInactive / markDebateActive / bulk wrappers', () => {
    expect(src).toContain('markDebateInactive');
    expect(src).toContain('markDebateActive');
    expect(src).toContain('bulkMarkDebateInactive');
    expect(src).toContain('bulkMarkDebateActive');
  });

  it('imports the debate bulk id cap', () => {
    expect(src).toContain('ADMIN_BULK_DEBATE_INACTIVE_ID_CAP');
  });
});

describe('AdminArgumentsTab — room (parent) checkbox is a distinct selection scope', () => {
  it('renders the room-select checkbox testID at the header', () => {
    expect(src).toContain('testID={`admin-arguments-room-select-${group.roomId}`}');
  });

  it('uses a SEPARATE selectedRoomIds set (not the per-argument selectedIds)', () => {
    expect(src).toMatch(/const \[selectedRoomIds, setSelectedRoomIds\] = useState<ReadonlySet<string>>\(new Set\(\)\)/);
    expect(src).toContain('const toggleRoomSelect = useCallback');
  });

  it('the room checkbox has accessibilityRole="checkbox" + checked state', () => {
    expect(src).toMatch(/accessibilityState=\{\{\s*checked:\s*isRoomSelected\s*\}\}/);
  });

  it('toggles room selection via toggleRoomSelect(group.roomId)', () => {
    expect(src).toMatch(/onPress=\{\(\)\s*=>\s*toggleRoomSelect\(group\.roomId\)\}/);
  });
});

describe('AdminArgumentsTab — per-room Mark room inactive / active', () => {
  it('renders the per-room mark-inactive testID for active rooms', () => {
    expect(src).toContain('admin-arguments-room-inactivate-${group.roomId}');
  });

  it('renders the per-room mark-active testID for inactive rooms', () => {
    expect(src).toContain('admin-arguments-room-activate-${group.roomId}');
  });

  it('wires the per-room actions to the single-debate wrappers (roomId == debateId)', () => {
    expect(src).toMatch(/const handleRoomMarkInactive = useCallback/);
    expect(src).toMatch(/markDebateInactive\(roomId\)/);
    expect(src).toMatch(/const handleRoomMarkActive = useCallback/);
    expect(src).toMatch(/markDebateActive\(roomId\)/);
    expect(src).toMatch(/onPress=\{\(\)\s*=>\s*handleRoomMarkInactive\(group\.roomId\)\}/);
    expect(src).toMatch(/onPress=\{\(\)\s*=>\s*handleRoomMarkActive\(group\.roomId\)\}/);
  });

  it('the per-room action buttons are real buttons with hit targets', () => {
    expect(src).toMatch(/Mark room inactive/);
    expect(src).toMatch(/Mark room active/);
  });
});

describe('AdminArgumentsTab — room bulk bar', () => {
  it('renders the rooms bulk bar testID, gated on selectedRoomIds.size', () => {
    expect(src).toContain('testID="admin-arguments-rooms-bulk-bar"');
    expect(src).toMatch(/selectedRoomIds\.size\s*>\s*0\s*&&/);
  });

  it('shows a Rooms selected: N counter', () => {
    expect(src).toMatch(/Rooms selected:\s*\{selectedRoomIds\.size\}/);
  });

  it('renders Mark rooms inactive + Mark rooms active bulk actions', () => {
    expect(src).toContain('testID="admin-arguments-rooms-bulk-action-mark-inactive"');
    expect(src).toContain('testID="admin-arguments-rooms-bulk-action-mark-active"');
  });

  it('routes the room bulk to the bulk debate wrappers', () => {
    expect(src).toMatch(/bulkMarkDebateInactive\(roomBulkDialog\.ids,\s*reason\)/);
    expect(src).toMatch(/bulkMarkDebateActive\(roomBulkDialog\.ids,\s*reason\)/);
  });

  it('caps the room bulk id list at the debate cap', () => {
    expect(src).toMatch(/slice\(0,\s*ADMIN_BULK_DEBATE_INACTIVE_ID_CAP\)/);
  });

  it('renders a room bulk confirm dialog with confirm/cancel', () => {
    expect(src).toContain('testID="admin-arguments-rooms-bulk-confirm-dialog"');
    expect(src).toContain('testID="admin-arguments-rooms-bulk-confirm"');
    expect(src).toContain('testID="admin-arguments-rooms-bulk-cancel"');
  });
});

describe('AdminArgumentsTab — DEBATE-level inactive badge (WHAT, never WHY)', () => {
  it('derives the conversation-inactive badge from group.isDebateInactive', () => {
    expect(src).toMatch(/const roomDebateInactive = group\.isDebateInactive/);
    expect(src).toMatch(/roomDebateInactive\s*&&/);
  });

  it('renders the conversation-inactive badge testID', () => {
    expect(src).toContain('admin-arguments-room-conv-inactive-badge-${group.roomId}');
  });

  it('the badge is text-only — never interpolates any reason', () => {
    expect(src).toContain('Conversation inactive');
    // No DEBATE reason field is read anywhere in the component.
    expect(src).not.toMatch(/group\.debateInactiveReason/);
    expect(src).not.toMatch(/r\.debateInactiveReason/);
    expect(src).not.toMatch(/debateInactiveReason/);
    expect(src).not.toMatch(/debates\([^)]*inactive_reason/);
  });
});

describe('AdminArgumentsTab — per-ARGUMENT inactivation is RETAINED', () => {
  it('keeps the per-argument wrappers', () => {
    expect(src).toContain('markArgumentInactive');
    expect(src).toContain('markArgumentActive');
    expect(src).toContain('bulkMarkArgumentInactive');
    expect(src).toContain('bulkMarkArgumentActive');
  });

  it('keeps the per-row argument checkbox + per-row mark-inactive testIDs', () => {
    expect(src).toContain('testID={`admin-arguments-checkbox-${r.id}`}');
    expect(src).toContain('admin-arguments-row-mark-inactive-${r.id}');
    expect(src).toContain('admin-arguments-row-mark-active-${r.id}');
  });

  it('keeps the per-argument bulk bar testID', () => {
    expect(src).toContain('testID="admin-arguments-bulk-toolbar"');
  });

  it('the two selection scopes use distinct testID families (row vs room)', () => {
    // Per-argument selection keys on r.id; room selection keys on group.roomId.
    expect(src).toContain('admin-arguments-checkbox-${r.id}');
    expect(src).toContain('admin-arguments-room-select-${group.roomId}');
  });
});
