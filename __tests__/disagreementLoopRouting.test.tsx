/**
 * REF-004 — Act routing: card button → Act entry → box entry point.
 *
 * Pins the handoff matrix row by row:
 *   1. Each `referee-card-move-<actEntryId>` button fires `onMove` with the
 *      exact `MoveSuggestion` (the leaf contract REF-003 froze, unchanged).
 *   2. The PURE dispatch the surface's `enterBoxForActEntry` uses —
 *      `actEntryToQuickAction(actEntryId)` (the composer entry point) and
 *      `ACT_ENTRY_DEFINITIONS[actEntryId].opensBoxType` (the box type) —
 *      equals the matrix Act column for every constructive entry.
 *   3. Board-path equivalence: BOTH the board Act path
 *      (`handleBoardActSelectBoxType`) and the swapped card path
 *      (`handleRefereeMove`) delegate to the single `enterBoxForActEntry`
 *      bridge — same inputs → same box state (one code path, not two).
 *   4. The secondary affordance row renders only when `onRefereeNavigate` is
 *      supplied (byte-equivalent to REF-003 when omitted).
 *
 * Uses @testing-library/react-native (the repo's RN render harness).
 */

import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fireEvent, render } from '@testing-library/react-native';
import {
  RefereeCardView,
  type RefereeNavVerb,
} from '../src/features/arguments/cardView/RefereeCardView';
import {
  actEntryToQuickAction,
  _debug as actDebug,
  type ActEntryId,
} from '../src/features/arguments/oneBox/actPopoutModel';
import {
  buildOpenIssue,
  type DisagreementContract,
  type MoveSuggestion,
} from '../src/features/refereeLoop';
import { makeInput } from './fixtures/openIssueFixtures';

// ASP-EXTRACT-001 (Slice 2) — the surface split into room/; the Act handoff
// wiring this scans lives in the ArgumentRoom orchestrator.
const SURFACE_PATH = join(
  __dirname,
  '../src/features/arguments/room/ArgumentRoom.tsx',
);

/**
 * The handoff matrix resolved against the live `ACT_ENTRY_DEFINITIONS` +
 * `actEntryToQuickAction` (REF-004 design §"handoff matrix"). For each
 * constructive zone-3 entry: the composer entry point (quick action) and the
 * box it opens.
 */
const HANDOFF_MATRIX: ReadonlyArray<{
  actEntryId: ActEntryId;
  quickAction: string;
  opensBoxType: string;
}> = [
  { actEntryId: 'ask_source', quickAction: 'source', opensBoxType: 'ask_source' },
  { actEntryId: 'add_evidence', quickAction: 'evidence', opensBoxType: 'add_evidence' },
  { actEntryId: 'ask_quote', quickAction: 'quote', opensBoxType: 'ask_quote' },
  { actEntryId: 'narrow', quickAction: 'narrow', opensBoxType: 'narrow' },
  { actEntryId: 'concede', quickAction: 'concede', opensBoxType: 'respond' },
  { actEntryId: 'confirm', quickAction: 'confirm', opensBoxType: 'confirm' },
  { actEntryId: 'synthesize', quickAction: 'synthesize', opensBoxType: 'synthesize' },
  { actEntryId: 'branch_tangent', quickAction: 'branch', opensBoxType: 'branch_tangent' },
];

const ACT_DEFS = actDebug.ACT_ENTRY_DEFINITIONS as Record<
  ActEntryId,
  { label: string; accessibilityLabel: string; opensBoxType: string | null }
>;

/** A real contract base with crafted nextBestMoves covering the matrix. The
 *  card renders `issue.nextBestMoves` verbatim (buildRefereeCardViewModel sets
 *  `zone3Moves: issue.nextBestMoves`), so a crafted list renders one button per
 *  entry. */
function matrixIssue(): DisagreementContract {
  const base = buildOpenIssue(makeInput({}))!;
  const nextBestMoves: MoveSuggestion[] = HANDOFF_MATRIX.map((row) => ({
    actEntryId: row.actEntryId,
    label: ACT_DEFS[row.actEntryId].label,
    accessibilityLabel: ACT_DEFS[row.actEntryId].accessibilityLabel,
    isRecoveryRoute: false,
    recoveredFromCode: null,
  }));
  return { ...base, nextBestMoves };
}

const noop = (_verb: RefereeNavVerb): void => {};

describe('REF-004 routing — handoff matrix, pure dispatch per row', () => {
  it.each(HANDOFF_MATRIX.map((r) => [r.actEntryId, r] as const))(
    '%s → quickAction + opensBoxType match the matrix (the composer entry point)',
    (_id, row) => {
      // The composer entry point the surface's enterBoxForActEntry passes to
      // quickActionToPreset.
      expect(actEntryToQuickAction(row.actEntryId)).toBe(row.quickAction);
      // The box the entry opens.
      expect(ACT_DEFS[row.actEntryId].opensBoxType).toBe(row.opensBoxType);
    },
  );
});

describe('REF-004 routing — button press fires onMove with the exact MoveSuggestion', () => {
  it.each(HANDOFF_MATRIX.map((r) => [r.actEntryId] as const))(
    'pressing referee-card-move-%s calls onMove(move) for that entry',
    (actEntryId) => {
      const issue = matrixIssue();
      const move = issue.nextBestMoves.find((m) => m.actEntryId === actEntryId)!;
      const onMove = jest.fn();
      const { getByTestId } = render(
        <RefereeCardView issue={issue} onMove={onMove} onRefereeNavigate={noop} />,
      );
      fireEvent.press(getByTestId(`referee-card-move-${actEntryId}`));
      expect(onMove).toHaveBeenCalledTimes(1);
      expect(onMove).toHaveBeenCalledWith(move);
      // The payload carries the entry id the surface routes through
      // enterBoxForActEntry(move.actEntryId).
      expect(onMove.mock.calls[0][0].actEntryId).toBe(actEntryId);
    },
  );

  it('every rendered move button is enabled (an engine+role survivor by construction)', () => {
    const issue = matrixIssue();
    const { getByTestId } = render(<RefereeCardView issue={issue} onRefereeNavigate={noop} />);
    for (const move of issue.nextBestMoves) {
      const btn = getByTestId(`referee-card-move-${move.actEntryId}`);
      expect(btn.props.accessibilityState).toEqual({ disabled: false });
    }
  });
});

describe('REF-004 routing — secondary affordance row gating', () => {
  it('renders "View details" + "Focus on board" when onRefereeNavigate is supplied (and targetNodeId set)', () => {
    const issue = matrixIssue();
    expect(issue.targetNodeId).not.toBeNull();
    const { getByTestId } = render(<RefereeCardView issue={issue} onRefereeNavigate={noop} />);
    expect(getByTestId('referee-card-nav-row')).toBeTruthy();
    expect(getByTestId('referee-card-nav-inspect')).toBeTruthy();
    expect(getByTestId('referee-card-nav-focus')).toBeTruthy();
  });

  it('omits the affordance row entirely when onRefereeNavigate is absent (byte-equivalent to REF-003)', () => {
    const { queryByTestId } = render(<RefereeCardView issue={matrixIssue()} />);
    expect(queryByTestId('referee-card-nav-row')).toBeNull();
    expect(queryByTestId('referee-card-nav-inspect')).toBeNull();
    expect(queryByTestId('referee-card-nav-focus')).toBeNull();
  });

  it('"Focus on board" hides when targetNodeId is null; "View details" still renders', () => {
    const issue = { ...matrixIssue(), targetNodeId: null };
    const { getByTestId, queryByTestId } = render(
      <RefereeCardView issue={issue} onRefereeNavigate={noop} />,
    );
    expect(getByTestId('referee-card-nav-inspect')).toBeTruthy();
    expect(queryByTestId('referee-card-nav-focus')).toBeNull();
  });

  it('pressing the affordances dispatches inspect / focus_on_board', () => {
    const issue = matrixIssue();
    const onNav = jest.fn();
    const { getByTestId } = render(<RefereeCardView issue={issue} onRefereeNavigate={onNav} />);
    fireEvent.press(getByTestId('referee-card-nav-inspect'));
    fireEvent.press(getByTestId('referee-card-nav-focus'));
    expect(onNav).toHaveBeenNthCalledWith(1, 'inspect');
    expect(onNav).toHaveBeenNthCalledWith(2, 'focus_on_board');
  });
});

describe('REF-004 routing — board-path equivalence (single enterBoxForActEntry bridge)', () => {
  const src = readFileSync(SURFACE_PATH, 'utf8');

  it('defines exactly one enterBoxForActEntry useCallback bridge', () => {
    const occurrences = src.match(/const enterBoxForActEntry = useCallback/g) ?? [];
    expect(occurrences).toHaveLength(1);
    // The bridge uses the SAME actEntryToQuickAction → quickActionToPreset →
    // handleAction('reply', …) sequence the board Act path always used.
    expect(src).toMatch(/actEntryToQuickAction\(entryId\)/);
    expect(src).toMatch(/quickActionToPreset\(/);
    // ASP-EXTRACT-003 (#871) — this pin now matches the REAL bridge code line
    // (handleAction with the resolved messageId), not the comment literal it
    // previously matched. The de-apostrophize pass rewrote that comment prose,
    // which contained the exact activeMessageId ?? '' spelling; the actual
    // enterBoxForActEntry body dispatches handleAction('reply', messageId, preset)
    // where messageId = targetMessageId ?? activeMessageId ?? ''. Pinning the
    // code path is strictly more correct than pinning comment prose.
    expect(src).toMatch(/handleAction\('reply', messageId, preset\)/);
  });

  it('handleRefereeMove delegates to enterBoxForActEntry (the swapped card path)', () => {
    expect(src).toMatch(/enterBoxForActEntry\(move\.actEntryId\)/);
  });

  it('handleBoardActSelectBoxType delegates to enterBoxForActEntry then closes the menu', () => {
    expect(src).toMatch(/enterBoxForActEntry\(entryId\);\s*\n\s*setBoardActVisible\(false\)/);
  });

  it('the swapped handleRefereeMove is a pure delegate (no direct submit / Edge call)', () => {
    // The board-Act mount-site scan already guards the file-level imports.
    // Here: the swapped card path adds NO submit call of its own — it only
    // delegates to enterBoxForActEntry, which opens the composer (no write).
    expect(src).not.toMatch(/submitArgument\(/);
    // The handler body delegates rather than calling the composer entry helper
    // directly (the v1 inline `actEntryToQuickAction(move.actEntryId)` path is
    // gone — only the bridge calls actEntryToQuickAction(entryId)).
    expect(src).not.toMatch(/actEntryToQuickAction\(move\.actEntryId\)/);
  });
});
