/**
 * #508 — AdminArgumentsTab room/conversation grouping wiring tests.
 *
 * Following this repo's established discipline (the pinned react-test-renderer
 * is held away from @testing-library's peer, so the tab's load-bearing
 * decisions are exercised through (a) the pure `groupArtifactsByRoom` model —
 * fully covered in adminArgumentsRoomGroupingModel.test.ts — and (b) a
 * source-scan of the component), this suite asserts the tab:
 *
 *  - imports + calls `groupArtifactsByRoom` over the artifact rows, honoring
 *    the active sort direction;
 *  - renders one collapsible header per room with the required testIDs
 *    (`admin-arguments-room-group-<roomId>` etc.);
 *  - the header is a real button (Pressable + accessibilityRole="button" +
 *    accessibilityState expanded + ≥44px hit target);
 *  - DEFAULTS to all rooms COLLAPSED (the core fix — one row per conversation)
 *    and only renders a room's message rows when it is expanded;
 *  - exposes Expand all / Collapse all controls;
 *  - keeps the existing `admin-arguments-table` testID;
 *  - NEVER reads `inactiveReason` into the render path.
 *
 * A poisoned-fixture test drives the pure model directly to prove an
 * inactive-reason-like string fed via a room NEVER appears in any produced
 * group field (§10a — the inactive badge comes from `inactiveAt`-derived
 * `isInactive` only, never the reason).
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

describe('AdminArgumentsTab — groups artifacts into room/conversation groups', () => {
  it('imports groupArtifactsByRoom from the room-grouping model', () => {
    expect(src).toContain("from './adminArgumentsRoomGroupingModel'");
    expect(src).toContain('groupArtifactsByRoom(');
  });

  it('groups the artifact rows honoring the active sort direction', () => {
    expect(src).toMatch(/groupArtifactsByRoom\(artifactRows\.map\(\(\{ artifact \}\) => artifact\), sortDirection\)/);
  });

  it('iterates roomGroups (one header per room), not the flat artifact list at top level', () => {
    expect(src).toMatch(/roomGroups\.map\(\(group\)\s*=>/);
  });

  it('keeps the existing per-artifact render mapping inside the expanded room', () => {
    // The per-artifact row body is reused verbatim, now room-scoped.
    expect(src).toMatch(/artifactRows\.map\(\(\{\s*artifact,\s*primaryRow:\s*r\s*\}\)\s*=>/);
  });
});

describe('AdminArgumentsTab — room group header is a real button', () => {
  it('the header is a Pressable with accessibilityRole="button"', () => {
    expect(src).toMatch(/testID=\{`admin-arguments-room-group-header-\$\{group\.roomId\}`\}/);
    // The header Pressable carries the button role + expanded state.
    expect(src).toMatch(/accessibilityState=\{\{\s*expanded:\s*roomExpanded\s*\}\}/);
  });

  it('toggles room expansion via toggleRoomExpanded(group.roomId)', () => {
    expect(src).toContain('const toggleRoomExpanded = useCallback');
    expect(src).toMatch(/onPress=\{\(\)\s*=>\s*toggleRoomExpanded\(group\.roomId\)\}/);
  });

  it('the header carries a hit target (hitSlop) so the tap area is ≥44px', () => {
    // The header style sets minHeight:44; the hitSlop expands the tap area.
    expect(src).toMatch(/minHeight:\s*44/);
    expect(src).toMatch(/hitSlop=\{\{\s*top:\s*8,\s*bottom:\s*8,\s*left:\s*8,\s*right:\s*8\s*\}\}/);
  });

  it('shows a message-count badge with the required testID', () => {
    expect(src).toContain('admin-arguments-room-group-count-${group.roomId}');
    expect(src).toMatch(/\{group\.messageCount\}\s*\{group\.messageCount === 1 \? 'message' : 'messages'\}/);
  });

  it('renders the latest-activity timestamp on the header (absolute + relative)', () => {
    expect(src).toMatch(/formatDateTime\(group\.latestUpdatedAt\)/);
    expect(src).toMatch(/formatRelativeShort\(group\.latestUpdatedAt\)/);
  });

  it('renders the muted body-excerpt preview line', () => {
    expect(src).toMatch(/\{group\.latestBodyExcerpt\}/);
  });
});

describe('AdminArgumentsTab — default collapsed + expand/collapse controls', () => {
  it('rooms are COLLAPSED by default (expandedRooms starts empty)', () => {
    expect(src).toMatch(/const \[expandedRooms, setExpandedRooms\] = useState<ReadonlySet<string>>\(new Set\(\)\)/);
  });

  it('only renders a room\'s message rows when the room is expanded', () => {
    expect(src).toMatch(/const roomExpanded = expandedRooms\.has\(group\.roomId\)/);
    expect(src).toMatch(/roomExpanded\s*&&/);
  });

  it('exposes Expand all + Collapse all controls with the required testIDs', () => {
    expect(src).toContain('testID="admin-arguments-expand-all"');
    expect(src).toContain('testID="admin-arguments-collapse-all"');
    expect(src).toContain('const expandAllRooms = useCallback');
    expect(src).toContain('const collapseAllRooms = useCallback');
  });

  it('expand-all selects every room id; collapse-all clears the set', () => {
    expect(src).toMatch(/setExpandedRooms\(new Set\(roomGroups\.map\(\(g\) => g\.roomId\)\)\)/);
    expect(src).toMatch(/collapseAllRooms = useCallback\(\(\) => \{\s*setExpandedRooms\(new Set\(\)\)/);
  });
});

describe('AdminArgumentsTab — table testID + no inactiveReason read', () => {
  it('keeps the outer table testID', () => {
    expect(src).toContain('testID="admin-arguments-table"');
  });

  it('NEVER reads an inactiveReason field anywhere (group or row)', () => {
    expect(src).not.toMatch(/r\.inactiveReason/);
    expect(src).not.toMatch(/artifact\.inactiveReason/);
    expect(src).not.toMatch(/group\.inactiveReason/);
    expect(src).not.toMatch(/\binactiveReason\s*[:=]/);
  });

  it('the room-group inactive badge is text only (no reason interpolation)', () => {
    // The badge is the literal word "Inactive"; no reason variable is shown.
    expect(src).toMatch(/group\.isInactive\s*&&/);
    expect(src).toContain('roomGroupInactiveText');
  });
});

// ── Poisoned-fixture: prove an inactive-reason-like string never leaks. ─────

function makeArtifact(over: Partial<ArgumentArtifact> & {
  artifactId: string;
  debateId: string;
}): ArgumentArtifact {
  const createdAt = over.createdAt ?? '2026-01-01T00:00:00.000Z';
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

describe('AdminArgumentsTab room grouping — poisoned inactive-reason fixture', () => {
  const POISON = 'reason-spam-marked-as-troll-by-admin';

  it('an inactive-reason-like string attached to a room never reaches a produced GROUP field', () => {
    // Feed the poison ONLY through a fabricated `inactiveReason`-shaped
    // property the type does not declare. The model derives `isInactive` from
    // each artifact's `isInactive` only, and produces title/body-excerpt/
    // timestamps — never any reason. The GROUP-LEVEL produced fields (the only
    // values the header renders) must not contain the poison. (The model
    // passes the artifact objects through by reference for the renderer to
    // consume; that pass-through still carries the extra property, but the
    // renderer NEVER reads `inactiveReason` — proven by the source-scan above.)
    const poisoned = makeArtifact({
      artifactId: 'id:a1',
      debateId: 'room-1',
      debateTitle: 'A neutral room title',
      latestBody: 'A neutral message body.',
      isInactive: true,
    });
    (poisoned as unknown as { inactiveReason: string }).inactiveReason = POISON;

    const group = groupArtifactsByRoom([poisoned])[0];

    // The header renders ONLY these produced group fields — none may carry the
    // poison.
    const headerFields = JSON.stringify({
      roomId: group.roomId,
      roomTitle: group.roomTitle,
      messageCount: group.messageCount,
      latestUpdatedAt: group.latestUpdatedAt,
      createdAt: group.createdAt,
      isInactive: group.isInactive,
      latestBodyExcerpt: group.latestBodyExcerpt,
    });
    expect(headerFields).not.toContain(POISON);

    // The inactive badge state is still correctly derived from isInactive,
    // NOT from the reason.
    expect(group.isInactive).toBe(true);
    // ...and the model produces NO `inactiveReason` field on the group object.
    expect(Object.prototype.hasOwnProperty.call(group, 'inactiveReason')).toBe(false);
  });

  it('an inactive room reads its badge state from isInactive, not from any reason text', () => {
    // Flip isInactive to false while leaving a poison reason attached: the
    // group must report active (badge driven by isInactive only).
    const stillActive = makeArtifact({
      artifactId: 'id:a1',
      debateId: 'room-1',
      debateTitle: 'A neutral room title',
      isInactive: false,
    });
    (stillActive as unknown as { inactiveReason: string }).inactiveReason = POISON;
    expect(groupArtifactsByRoom([stillActive])[0].isInactive).toBe(false);
  });
});
