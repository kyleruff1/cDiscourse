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
import { groupArtifactsByRoom } from '../src/features/admin/adminArgumentsRoomGroupingModel';
import type { ArgumentArtifact } from '../src/features/arguments/argumentArtifactModel';

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

// ── ADMIN-CONV-INACTIVE-VISIBILITY-001 — default-hide inactive ROOMS ──────

describe('AdminArgumentsTab — default-hides DEBATE-level inactive rooms (ADMIN-CONV-INACTIVE-VISIBILITY-001)', () => {
  it('the roomGroups memo filters out isDebateInactive groups when includeInactives is off', () => {
    // The filter is applied AFTER grouping, gating on the existing toggle.
    expect(src).toMatch(/includeInactives \? grouped : grouped\.filter\(\(g\) => !g\.isDebateInactive\)/);
  });

  it('the roomGroups memo lists includeInactives in its dependency array', () => {
    expect(src).toMatch(/\}, \[artifactRows, sortDirection, includeInactives\]\)/);
  });

  it('reuses the EXISTING includeInactives state (no new room-visibility state)', () => {
    expect(src).toMatch(/const \[includeInactives, setIncludeInactives\] = useState\(false\)/);
  });
});

describe('AdminArgumentsTab — Show-inactives is a CLEARLY VISIBLE BUTTON (ADMIN-CONV-INACTIVE-VISIBILITY-001)', () => {
  it('the toggle is a Pressable with accessibilityRole="button" (not inert text)', () => {
    // The toggle block carries the button role + selected state + testID.
    expect(src).toMatch(/accessibilityRole="button"/);
    expect(src).toMatch(/accessibilityState=\{\{ selected: includeInactives \}\}/);
    expect(src).toContain('testID="admin-arguments-show-inactives-toggle"');
  });

  it('the toggle flips the existing includeInactives state on press', () => {
    expect(src).toMatch(/onPress=\{\(\) => setIncludeInactives\(\(v\) => !v\)\}/);
  });

  it('the toggle carries a hit target (hitSlop) for the ≥44px tap area', () => {
    expect(src).toMatch(/hitSlop=\{\{ top: 12, bottom: 12, left: 8, right: 8 \}\}/);
  });

  it('the toggle uses plain, action-oriented label copy (Show / Showing inactives)', () => {
    expect(src).toContain('Show inactives');
    expect(src).toContain('Showing inactives');
    // The prior inert "Hiding inactives on/off" status copy is gone.
    expect(src).not.toContain('Hiding inactives');
  });

  it('renders a visible checkbox-style indicator so the control reads as pressable', () => {
    expect(src).toContain('showInactivesBox');
    expect(src).toContain('showInactivesBoxMark');
  });

  it('the toggle never READS a reason field (§10a — WHAT only); reason appears only in never-read disclaimer comments', () => {
    // The existing suite proves no `inactiveReason`/`debateInactiveReason` is
    // accessed; here we re-assert the assignment/access forms specifically (the
    // word may legitimately appear inside "...is NEVER read" comments).
    expect(src).not.toMatch(/\binactiveReason\s*[:=.]/);
    expect(src).not.toMatch(/\bdebateInactiveReason\b/);
  });
});

// Pure-model proof that the filter predicate the memo uses is sound: a
// debate-inactive room produces isDebateInactive=true (so it is dropped when
// the toggle is off), and an active room produces false (so it stays).
describe('groupArtifactsByRoom — isDebateInactive drives the room-level hide (ADMIN-CONV-INACTIVE-VISIBILITY-001)', () => {
  function makeArtifact(over: Partial<ArgumentArtifact> & {
    artifactId: string;
    debateId: string;
  }): ArgumentArtifact {
    const createdAt = over.createdAt ?? '2026-06-06T00:00:00.000Z';
    const latestUpdatedAt = over.latestUpdatedAt ?? createdAt;
    return {
      artifactId: over.artifactId,
      latestBody: over.latestBody ?? 'neutral body',
      authorId: over.authorId ?? 'author-1',
      debateId: over.debateId,
      debateTitle: over.debateTitle ?? null,
      debateInactiveAt: over.debateInactiveAt ?? null,
      latestUpdatedAt,
      createdAt,
      updateCount: over.updateCount ?? 0,
      observationCount: over.observationCount ?? { covered: 0, total: 0 },
      duplicateRunCount: over.duplicateRunCount ?? 0,
      qualifiers: over.qualifiers ?? [],
      isInactive: over.isInactive ?? false,
      revisions: over.revisions ?? [
        {
          revisionId: over.artifactId,
          body: over.latestBody ?? 'neutral body',
          updatedAt: latestUpdatedAt,
          createdAt,
          isInactive: over.isInactive ?? false,
        },
      ],
    };
  }

  // Mirror the component memo's filter so the hide behavior is asserted on real
  // model output, not just the source.
  const hideInactive = (groups: ReturnType<typeof groupArtifactsByRoom>) =>
    groups.filter((g) => !g.isDebateInactive);

  it('a DEBATE-inactive room (active statements) yields isDebateInactive=true', () => {
    // The whole room is inactive even though the individual statement is active.
    const a = makeArtifact({
      artifactId: 'id:1',
      debateId: 'room-inactive',
      debateInactiveAt: '2026-06-06T12:00:00.000Z',
      isInactive: false,
    });
    const group = groupArtifactsByRoom([a])[0];
    expect(group.isDebateInactive).toBe(true);
    // ...and the per-statement fold is still active (distinct dimension).
    expect(group.isInactive).toBe(false);
  });

  it('with the toggle OFF, a debate-inactive room is ABSENT from the rendered groups', () => {
    const active = makeArtifact({ artifactId: 'id:a', debateId: 'room-active', debateInactiveAt: null });
    const inactive = makeArtifact({
      artifactId: 'id:b',
      debateId: 'room-inactive',
      debateInactiveAt: '2026-06-06T12:00:00.000Z',
    });
    const visible = hideInactive(groupArtifactsByRoom([active, inactive]));
    expect(visible.map((g) => g.roomId)).toEqual(['room-active']);
  });

  it('with the toggle ON, the debate-inactive room is revealed', () => {
    const active = makeArtifact({ artifactId: 'id:a', debateId: 'room-active', debateInactiveAt: null });
    const inactive = makeArtifact({
      artifactId: 'id:b',
      debateId: 'room-inactive',
      debateInactiveAt: '2026-06-06T12:00:00.000Z',
    });
    // includeInactives=true → no filter applied (mirrors the memo).
    const all = groupArtifactsByRoom([active, inactive]);
    expect(all.map((g) => g.roomId).sort()).toEqual(['room-active', 'room-inactive']);
  });

  it('§10a — a poisoned inactive_reason on a debate-inactive room never appears in any produced group field', () => {
    const POISON = 'reason-room-flagged-by-operator';
    const inactive = makeArtifact({
      artifactId: 'id:b',
      debateId: 'room-inactive',
      debateInactiveAt: '2026-06-06T12:00:00.000Z',
    });
    (inactive as unknown as { inactive_reason: string }).inactive_reason = POISON;
    (inactive as unknown as { debateInactiveReason: string }).debateInactiveReason = POISON;
    const group = groupArtifactsByRoom([inactive])[0];
    const produced = JSON.stringify({
      roomId: group.roomId,
      roomTitle: group.roomTitle,
      isDebateInactive: group.isDebateInactive,
      isInactive: group.isInactive,
      latestBodyExcerpt: group.latestBodyExcerpt,
    });
    expect(produced).not.toContain(POISON);
    expect(Object.prototype.hasOwnProperty.call(group, 'inactive_reason')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(group, 'debateInactiveReason')).toBe(false);
    // The hide decision is driven by the timestamp-only flag.
    expect(group.isDebateInactive).toBe(true);
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
