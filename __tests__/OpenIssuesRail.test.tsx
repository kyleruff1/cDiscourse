/**
 * REF-006-RAIL — OpenIssuesRail render + routing (React Testing Library).
 *
 *   - collapsed-by-default chip shows the count badge; expand reveals rows;
 *     collapse hides them.
 *   - row tap fires `onJump(entry)`; Details fires `onInspect(entry)`; a move
 *     chip fires `onMove(entry, move)` with the correct MoveSuggestion.
 *   - empty ledger renders the teaching empty state.
 *   - overflow renders "+N more" and expands the cap on press.
 *   - observer ledger (empty nextBestMoves) renders rows with no move chips.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OpenIssuesRail } from '../src/features/arguments/openIssuesRail/OpenIssuesRail';
import {
  buildOpenIssuesLedger,
  OPEN_ISSUES_RAIL_COPY,
  type OpenIssueLedgerEntry,
} from '../src/features/arguments/openIssuesRail/openIssuesRailModel';
import { OPEN_ISSUES_RAIL_INITIAL_ROWS } from '../src/features/arguments/openIssuesRail/OpenIssuesRail';
import { makeRailCandidate, makeRailIssue, makeRailMove } from './fixtures/openIssuesRailFixtures';

const NOOP = () => {};

function ledgerOf(...candidates: ReturnType<typeof makeRailCandidate>[]) {
  return buildOpenIssuesLedger(candidates, { maxEntries: 48 });
}

describe('REF-006-RAIL OpenIssuesRail — collapsed default', () => {
  it('renders the collapsed chip (count badge), not the rows, by default', () => {
    const ledger = ledgerOf(
      makeRailCandidate(makeRailIssue({ id: 'a', burden: 'source_owed' }), 2),
      makeRailCandidate(makeRailIssue({ id: 'b', burden: 'reply_owed' }), 1),
    );
    const { getByTestId, queryByTestId } = render(
      <OpenIssuesRail ledger={ledger} onJump={NOOP} onInspect={NOOP} onMove={NOOP} />,
    );
    const toggle = getByTestId('open-issues-rail-toggle');
    expect(toggle.props.accessibilityState).toEqual({ expanded: false });
    // The count badge text reflects totalOpenCount.
    expect(getByTestId('open-issues-rail-toggle')).toBeTruthy();
    // Rows are not mounted while collapsed.
    expect(queryByTestId('open-issues-rail-row-a')).toBeNull();
  });

  it('the collapsed chip text contains the label + the open count', () => {
    const ledger = ledgerOf(makeRailCandidate(makeRailIssue({ id: 'a', burden: 'reply_owed' }), 1));
    const { getByText } = render(
      <OpenIssuesRail ledger={ledger} onJump={NOOP} onInspect={NOOP} onMove={NOOP} />,
    );
    // The chip's visible text carries the plain label and the "· 1".
    expect(getByText(`${OPEN_ISSUES_RAIL_COPY.collapsedLabel} · 1 ▾`)).toBeTruthy();
  });

  it('expands on chip press and collapses again on the collapse control', () => {
    const ledger = ledgerOf(makeRailCandidate(makeRailIssue({ id: 'a', burden: 'reply_owed' }), 1));
    const { getByTestId, queryByTestId } = render(
      <OpenIssuesRail ledger={ledger} onJump={NOOP} onInspect={NOOP} onMove={NOOP} />,
    );
    fireEvent.press(getByTestId('open-issues-rail-toggle'));
    expect(getByTestId('open-issues-rail-row-a')).toBeTruthy();
    fireEvent.press(getByTestId('open-issues-rail-collapse'));
    expect(queryByTestId('open-issues-rail-row-a')).toBeNull();
    expect(getByTestId('open-issues-rail-toggle')).toBeTruthy();
  });
});

describe('REF-006-RAIL OpenIssuesRail — routing through the shipped verbs', () => {
  it('row tap fires onJump(entry)', () => {
    const onJump = jest.fn();
    const ledger = ledgerOf(makeRailCandidate(makeRailIssue({ id: 'a', burden: 'reply_owed' }), 1));
    const { getByTestId } = render(
      <OpenIssuesRail ledger={ledger} defaultCollapsed={false} onJump={onJump} onInspect={NOOP} onMove={NOOP} />,
    );
    fireEvent.press(getByTestId('open-issues-rail-row-a'));
    expect(onJump).toHaveBeenCalledTimes(1);
    const arg = onJump.mock.calls[0][0] as OpenIssueLedgerEntry;
    expect(arg.key).toBe('a');
    expect(arg.targetNodeId).toBe('node-1');
  });

  it('Details fires onInspect(entry)', () => {
    const onInspect = jest.fn();
    const ledger = ledgerOf(makeRailCandidate(makeRailIssue({ id: 'a', burden: 'reply_owed' }), 1));
    const { getByTestId } = render(
      <OpenIssuesRail ledger={ledger} defaultCollapsed={false} onJump={NOOP} onInspect={onInspect} onMove={NOOP} />,
    );
    fireEvent.press(getByTestId('open-issues-rail-details-a'));
    expect(onInspect).toHaveBeenCalledTimes(1);
    expect((onInspect.mock.calls[0][0] as OpenIssueLedgerEntry).key).toBe('a');
  });

  it('a move chip fires onMove(entry, move) with the correct MoveSuggestion', () => {
    const onMove = jest.fn();
    const move = makeRailMove('ask_source', 'Ask for a source');
    const ledger = ledgerOf(
      makeRailCandidate(makeRailIssue({ id: 'a', burden: 'source_owed', nextBestMoves: [move] }), 1),
    );
    const { getByTestId } = render(
      <OpenIssuesRail ledger={ledger} defaultCollapsed={false} onJump={NOOP} onInspect={NOOP} onMove={onMove} />,
    );
    fireEvent.press(getByTestId('open-issues-rail-move-a-ask_source'));
    expect(onMove).toHaveBeenCalledTimes(1);
    const [entryArg, moveArg] = onMove.mock.calls[0];
    expect((entryArg as OpenIssueLedgerEntry).key).toBe('a');
    expect((moveArg as typeof move).actEntryId).toBe('ask_source');
  });

  it('tapping a move chip does NOT also fire onJump (siblings, not nested)', () => {
    const onJump = jest.fn();
    const onMove = jest.fn();
    const move = makeRailMove('narrow', 'Narrow the scope');
    const ledger = ledgerOf(
      makeRailCandidate(makeRailIssue({ id: 'a', burden: 'reply_owed', nextBestMoves: [move] }), 1),
    );
    const { getByTestId } = render(
      <OpenIssuesRail ledger={ledger} defaultCollapsed={false} onJump={onJump} onInspect={NOOP} onMove={onMove} />,
    );
    fireEvent.press(getByTestId('open-issues-rail-move-a-narrow'));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onJump).not.toHaveBeenCalled();
  });
});

describe('REF-006-RAIL OpenIssuesRail — empty + active + observer + overflow', () => {
  it('an empty ledger renders the teaching empty state', () => {
    const ledger = buildOpenIssuesLedger([]); // isEmpty
    const { getByTestId, getByText, queryByTestId } = render(
      <OpenIssuesRail ledger={ledger} defaultCollapsed={false} onJump={NOOP} onInspect={NOOP} onMove={NOOP} />,
    );
    expect(getByTestId('open-issues-rail-empty')).toBeTruthy();
    expect(getByText(OPEN_ISSUES_RAIL_COPY.emptyPrimary)).toBeTruthy();
    expect(queryByTestId('open-issues-rail-scroll')).toBeNull();
  });

  it('highlights the active row only (geometry + selected state)', () => {
    const ledger = ledgerOf(
      makeRailCandidate(makeRailIssue({ id: 'a', burden: 'source_owed' }), 2, true),
      makeRailCandidate(makeRailIssue({ id: 'b', burden: 'reply_owed' }), 1, false),
    );
    const { getByTestId, queryByTestId } = render(
      <OpenIssuesRail ledger={ledger} defaultCollapsed={false} onJump={NOOP} onInspect={NOOP} onMove={NOOP} />,
    );
    expect(getByTestId('open-issues-rail-row-a').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('open-issues-rail-row-b').props.accessibilityState).toEqual({ selected: false });
    // The active row carries the grayscale-legible "Currently active" word.
    expect(getByTestId('open-issues-rail-active-a')).toBeTruthy();
    expect(queryByTestId('open-issues-rail-active-b')).toBeNull();
  });

  it('observer ledger (empty nextBestMoves) renders rows with NO move chips', () => {
    const ledger = ledgerOf(
      makeRailCandidate(makeRailIssue({ id: 'a', burden: 'reply_owed', nextBestMoves: [] }), 1),
    );
    const { getByTestId, queryByTestId } = render(
      <OpenIssuesRail ledger={ledger} defaultCollapsed={false} onJump={NOOP} onInspect={NOOP} onMove={NOOP} />,
    );
    // The row + Details still render (informative, read-only); no move chip.
    expect(getByTestId('open-issues-rail-row-a')).toBeTruthy();
    expect(getByTestId('open-issues-rail-details-a')).toBeTruthy();
    expect(queryByTestId('open-issues-rail-move-a-ask_source')).toBeNull();
  });

  it('renders "+N more" past the initial display limit and reveals all on press', () => {
    const count = OPEN_ISSUES_RAIL_INITIAL_ROWS + 3;
    const candidates = Array.from({ length: count }, (_, i) =>
      makeRailCandidate(makeRailIssue({ id: `i${i}`, burden: 'reply_owed' }), i),
    );
    const ledger = buildOpenIssuesLedger(candidates, { maxEntries: 48 });
    const { getByTestId, getByText, queryByTestId } = render(
      <OpenIssuesRail ledger={ledger} defaultCollapsed={false} onJump={NOOP} onInspect={NOOP} onMove={NOOP} />,
    );
    const overflow = getByTestId('open-issues-rail-overflow');
    expect(getByText(`+3 ${OPEN_ISSUES_RAIL_COPY.overflowWord}`)).toBeTruthy();
    fireEvent.press(overflow);
    // After expanding, the overflow control is gone and the previously-hidden
    // rows are mounted.
    expect(queryByTestId('open-issues-rail-overflow')).toBeNull();
    expect(getByTestId(`open-issues-rail-row-i${count - 1}`)).toBeTruthy();
  });
});

describe('REF-006-RAIL OpenIssuesRail — mutual exclusion + reduce-motion props', () => {
  it('force-collapses when isAnyPanelOpen is true even if not collapsed', () => {
    const ledger = ledgerOf(makeRailCandidate(makeRailIssue({ id: 'a', burden: 'reply_owed' }), 1));
    const { getByTestId, queryByTestId } = render(
      <OpenIssuesRail
        ledger={ledger}
        defaultCollapsed={false}
        isAnyPanelOpen
        onJump={NOOP}
        onInspect={NOOP}
        onMove={NOOP}
      />,
    );
    // Expanded is suppressed → only the collapsed chip renders.
    expect(getByTestId('open-issues-rail-toggle')).toBeTruthy();
    expect(queryByTestId('open-issues-rail-row-a')).toBeNull();
  });

  it('notifies onExpandedChange when the user expands and collapses', () => {
    const onExpandedChange = jest.fn();
    const ledger = ledgerOf(makeRailCandidate(makeRailIssue({ id: 'a', burden: 'reply_owed' }), 1));
    const { getByTestId } = render(
      <OpenIssuesRail
        ledger={ledger}
        onExpandedChange={onExpandedChange}
        onJump={NOOP}
        onInspect={NOOP}
        onMove={NOOP}
      />,
    );
    fireEvent.press(getByTestId('open-issues-rail-toggle'));
    expect(onExpandedChange).toHaveBeenLastCalledWith(true);
    fireEvent.press(getByTestId('open-issues-rail-collapse'));
    expect(onExpandedChange).toHaveBeenLastCalledWith(false);
  });
});
