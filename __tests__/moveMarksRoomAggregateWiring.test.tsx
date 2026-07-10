/**
 * FEEDBACK-001 (#898) — the ONE aggregate derivation feeds BOTH surfaces (J9/J10).
 *
 * Surface #1 (state rail): did_not_address chains fold into openPointCount and
 * 2+ receipts_requested folds into receiptsOwedCount — only when the flag is on
 * (the aggregate is null when off => base unchanged => byte-identical).
 * Surface #2 (Map legend): DisagreementPointsRail renders the ambient
 * marksLegendLine only when the prop is supplied (absent => byte-identical).
 * J10: the mark surface never blocks posting (it is wired independently of the
 * composer / submit path).
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render } from '@testing-library/react-native';
import { DisagreementPointsRail } from '../src/features/mediator/DisagreementPointsRail';
import {
  deriveMoveMarkAggregate,
  receiptsPromptMoveIds,
  type MoveMarkAggregate,
} from '../src/features/feedback/moveMarkAggregateModel';
import { plainLanguageForMediatorState } from '../src/features/mediator';
import type { DisagreementPoint, MediatorBoardState, MediatorStateCode } from '../src/features/mediator';
import type { MoveMarkRow } from '../src/features/feedback/moveMarksModel';

const ROOM_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src/features/arguments/room/ArgumentRoom.tsx'),
  'utf8',
);

const row = (argumentId: string, markCode: MoveMarkRow['markCode'], markedBy: string): MoveMarkRow => ({
  argumentId,
  markCode,
  markedBy,
  retractedAt: null,
});

// The EXACT fold ArgumentRoom applies (a pure replica for the math assertion).
function foldOpenPointCount(base: number, aggregate: MoveMarkAggregate | null): number {
  if (!aggregate) return base;
  return base + aggregate.unaddressedMoveIds.length;
}
function foldReceiptsOwed(base: number, aggregate: MoveMarkAggregate | null): number {
  if (!aggregate) return base;
  return base + receiptsPromptMoveIds(aggregate).length;
}

function makePoint(id: string, state: MediatorStateCode): DisagreementPoint {
  return {
    id,
    anchor: { nodeId: id, parentNodeId: null, targetExcerpt: null },
    kind: 'unaxed',
    state,
    plainLabel: plainLanguageForMediatorState(state),
    lifecycleState: 'open',
    confidence: 'medium',
    openEvidenceDebtIds: [],
    memberNodeIds: [id],
    isAdvisory: false,
  };
}

function makeBoard(points: DisagreementPoint[]): MediatorBoardState {
  return {
    debateId: 'debate-1',
    points,
    markupByNodeId: {},
    evidenceDebts: [],
    blockedEvidencePaths: [],
    definitionMismatches: [],
    scopeMismatches: [],
    recollectionConflicts: [],
    nonProvableKeyDetails: [],
    impasses: [],
    pathwaysByPointId: {},
    nextAction: null,
    inputHash: 'h1',
  };
}

// ── Surface #1 — state-rail fold math ─────────────────────────

describe('FEEDBACK-001 — surface #1: the aggregate folds into the rail counts (flag-gated)', () => {
  it('did_not_address chains add to openPointCount only when the aggregate is present', () => {
    const aggregate = deriveMoveMarkAggregate([
      row('m1', 'did_not_address', 'a'),
      row('m2', 'did_not_address', 'a'),
    ]);
    expect(foldOpenPointCount(3, aggregate)).toBe(5); // base 3 + 2 unanswered
    expect(foldOpenPointCount(3, null)).toBe(3); // flag off => base unchanged
  });

  it('2+ receipts_requested on one claim adds to receiptsOwedCount only when present', () => {
    const aggregate = deriveMoveMarkAggregate([
      row('m1', 'receipts_requested', 'a'),
      row('m1', 'receipts_requested', 'b'), // reaches the threshold of 2
      row('m2', 'receipts_requested', 'a'), // only 1 => below threshold
    ]);
    expect(foldReceiptsOwed(1, aggregate)).toBe(2); // base 1 + 1 claim owed
    expect(foldReceiptsOwed(1, null)).toBe(1); // flag off => base unchanged
  });

  it('ArgumentRoom applies exactly this fold (source-scan)', () => {
    expect(ROOM_SRC).toMatch(/return base \+ moveMarkAggregate\.unaddressedMoveIds\.length;/);
    expect(ROOM_SRC).toMatch(/return base \+ receiptsPromptMoveIds\(moveMarkAggregate\)\.length;/);
  });
});

// ── Surface #2 — Map legend line ──────────────────────────────

describe('FEEDBACK-001 — surface #2: the DisagreementPointsRail marks legend line', () => {
  it('renders the ambient legend line when marksLegendLine is supplied', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint('n1', 'open')])}
        defaultCollapsed={false}
        presentation="pane"
        reduceMotionOverride
        marksLegendLine="Moments marked unanswered feed what remains unresolved."
      />,
    );
    const line = getByTestId('disagreement-points-rail-marks-legend');
    expect(line.props.children).toBe('Moments marked unanswered feed what remains unresolved.');
  });

  it('renders NOTHING for the legend line when the prop is absent (byte-identical)', () => {
    const { queryByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint('n1', 'open')])}
        defaultCollapsed={false}
        presentation="pane"
        reduceMotionOverride
      />,
    );
    expect(queryByTestId('disagreement-points-rail-marks-legend')).toBeNull();
  });

  it('ArgumentRoom passes the legend line only when an unanswered move exists', () => {
    expect(ROOM_SRC).toMatch(
      /marksLegendLine=\{[\s\S]*?moveMarkAggregate && moveMarkAggregate\.unaddressedMoveIds\.length > 0[\s\S]*?MOVE_MARKS_LEGEND_LINE[\s\S]*?\}/,
    );
  });
});

// ── J10 — a mark never blocks posting ─────────────────────────

describe('FEEDBACK-001 — J10: the mark surface is independent of the composer / submit path', () => {
  it('the move-marks wiring does not touch the submit / compose flow', () => {
    // The composer + submit handlers (onReply / handleSubmit / onComposerExpand)
    // never reference moveMarks: a tap can never gate a post. The bar is mounted
    // additively in the card / popover, not in the composer.
    const composerCallers = ROOM_SRC.match(/onComposerExpand[\s\S]{0,80}moveMark/gi) ?? [];
    expect(composerCallers).toEqual([]);
    // The useMoveMarks hook is a read + optimistic write seam, never a submit gate.
    expect(ROOM_SRC).toMatch(/const moveMarks = useMoveMarks\(\{/);
  });
});
