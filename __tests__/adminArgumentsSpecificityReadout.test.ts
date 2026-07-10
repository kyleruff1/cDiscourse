/**
 * INTEL-002 (#901) — the specificity readout wiring + copy.
 *
 * Following the repo convention for AdminArgumentsTab (all existing admin-tab
 * suites are source-scans — "no native renderer in CI"; see
 * adminArguments.test.ts / AdminArgumentsTab.canonical.test.tsx), this verifies
 * the readout WIRING by source scan and the readout COPY behaviorally via the
 * pure copy module. Together they cover: the per-room chip + aggregate line +
 * caveat render with their testIDs, the KPI is derived from the intel model, and
 * the copy is honest for every state (No replies yet / literal N-of-M / caveat).
 */
import fs from 'fs';
import path from 'path';
import {
  SPECIFICITY_VISIBILITY_CAVEAT,
  roomSpecificityChipText,
  aggregateSpecificityText,
} from '../src/features/admin/adminSpecificityReadoutCopy';
import {
  deriveRoomSpecificityKpi,
  deriveAggregateSpecificityKpi,
  type SpecificityReplyInput,
} from '../src/features/intel/markerSpecificityModel';

const ROOT = process.cwd();
const TAB_SRC = fs.readFileSync(path.join(ROOT, 'src/features/admin/AdminArgumentsTab.tsx'), 'utf8');

function reply(id: string, parentId: string | null, argumentType = 'rebuttal'): SpecificityReplyInput {
  return { id, parentId, argumentType, status: 'posted', inactiveAt: null };
}

describe('INTEL-002 — AdminArgumentsTab readout wiring (source scan)', () => {
  it('derives the per-room + aggregate KPI from the intel model', () => {
    expect(TAB_SRC).toContain('deriveRoomSpecificityKpi(');
    expect(TAB_SRC).toContain('deriveAggregateSpecificityKpi(');
  });

  it('fetches active marker reply-links for the loaded rooms', () => {
    expect(TAB_SRC).toContain('loadRoomMarkerReplyLinks(');
  });

  it('renders the per-room specificity chip with its testID', () => {
    expect(TAB_SRC).toContain('admin-arguments-room-specificity-${group.roomId}');
    expect(TAB_SRC).toContain('roomSpecificityChipText(');
  });

  it('renders the aggregate line + caveat with their testIDs + a11y labels', () => {
    expect(TAB_SRC).toContain('admin-arguments-specificity-aggregate');
    expect(TAB_SRC).toContain('admin-arguments-specificity-caveat');
    expect(TAB_SRC).toContain('aggregateSpecificityText(');
    expect(TAB_SRC).toContain('SPECIFICITY_VISIBILITY_CAVEAT');
  });

  it('reads no per-person field in the KPI reply mapping (T-NP)', () => {
    // The reply mapping in the KPI memo maps r.id / r.parentId / r.argumentType /
    // r.status / r.inactiveAt — never r.authorId.
    const memoStart = TAB_SRC.indexOf('roomSpecificityByDebateId');
    const memoSlice = TAB_SRC.slice(memoStart, memoStart + 900);
    expect(memoSlice).not.toContain('authorId');
    expect(memoSlice).not.toContain('created_by');
  });
});

describe('INTEL-002 — readout copy for each state (behavioral)', () => {
  it('zero-replies room => "No replies yet"', () => {
    const kpi = deriveRoomSpecificityKpi({ debateId: 'd', replies: [reply('root', null, 'claim')], markers: [] });
    expect(roomSpecificityChipText(kpi)).toBe('No replies yet');
  });

  it('replies with zero visible markers => a literal 0-of-N count', () => {
    const kpi = deriveRoomSpecificityKpi({
      debateId: 'd',
      replies: [reply('r1', 'root'), reply('r2', 'root')],
      markers: [],
    });
    expect(roomSpecificityChipText(kpi)).toBe('0 of 2 replies pinned a moment');
  });

  it('N-of-M linked => a literal N-of-M count', () => {
    const kpi = deriveRoomSpecificityKpi({
      debateId: 'd',
      replies: [reply('r1', 'root'), reply('r2', 'root'), reply('r3', 'root')],
      markers: [{ replyArgumentId: 'r1', deletedAt: null }],
    });
    expect(roomSpecificityChipText(kpi)).toBe('1 of 3 replies pinned a moment');
  });

  it('aggregate line reports the pooled literal count across rooms', () => {
    const agg = deriveAggregateSpecificityKpi([
      deriveRoomSpecificityKpi({ debateId: 'a', replies: [reply('r1', 'root')], markers: [{ replyArgumentId: 'r1', deletedAt: null }] }),
      deriveRoomSpecificityKpi({ debateId: 'b', replies: [reply('r2', 'root'), reply('r3', 'root')], markers: [] }),
    ]);
    expect(aggregateSpecificityText(agg)).toBe('1 of 3 replies across 2 rooms pinned a moment');
  });

  it('the visibility caveat is present and honest (visible-only bound)', () => {
    expect(SPECIFICITY_VISIBILITY_CAVEAT).toBe('Counts reflect markers visible to you.');
  });
});
