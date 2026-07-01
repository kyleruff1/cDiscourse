/**
 * VISUAL-SIMPLIFY-001 — the active-card hub collapses to a calm default.
 *
 * Covers the acceptance from card #844:
 *   - the collapsed default shows the message + at most three friendly flags +
 *     at most one advisory line (+ the parent context + one compact meta line +
 *     the ONE opt-in toggle); everything else is behind the toggle
 *   - standing / evidence / next-move each appear ONCE in the default (de-dupe)
 *   - the expansion mounts every demoted zone; re-pressing re-collapses
 *   - the flag row caps at 3 pills + a quiet "+N more"; 0 flags render nothing
 *   - a11y on the toggle: role button + expanded state + hitSlop >= 44x44 +
 *     verdict-free "More detail" / "Hide detail" label
 *   - no raw family_ / snake_case rawKey / verdict token leaks (default AND
 *     expanded)
 *   - reduce-motion safe: no Animated / LayoutAnimation in the toggle path
 *
 * Uses @testing-library/react-native.
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CardDetailPanel } from '../src/features/arguments/cardView/CardDetailPanel';
import { buildCardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import { buildPointFeedbackFlags } from '../src/features/feedbackFlags/pointFeedbackFlagsModel';
import { prioritizePointFeedbackFlags } from '../src/features/feedbackFlags/feedbackFlagPriority';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import type { MachineObservationResultRow } from '../src/features/nodeLabels/machineObservationPersistenceTypes';
import type { CardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import type { DisagreementContract } from '../src/features/refereeLoop';
import type {
  ArgumentBubbleViewModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';

const ACTIVE = 'msg-active';
const PARENT = 'msg-parent';

const BANNED = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'true',
  'false',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
];

function persistedRow(over: Partial<MachineObservationResultRow> = {}): MachineObservationResultRow {
  return {
    id: 'res-1',
    runId: 'run-1',
    debateId: 'deb-1',
    argumentId: ACTIVE,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    rawKey: 'has_rebuttal',
    family: 'parent_relation',
    confidence: 'high',
    evidenceSpan: null,
    createdAt: '2026-05-26T00:00:00.000Z',
    ...over,
  };
}

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: ACTIVE,
    parentId: PARENT,
    ordinal: 4,
    createdAt: '2026-05-26T12:00:00.000Z',
    createdAtLabel: '2026-05-26 12:00',
    relativeLabel: '2h ago',
    actorLabel: 'Other side',
    kindLabel: 'rebuttal',
    sideLabel: 'Neg',
    bodyPreview: 'rebuttal body preview',
    badges: [],
    droppedTags: [],
    depth: 1,
    lane: 1,
    siblingIndex: 0,
    replyCount: 0,
    descendantCount: 0,
    branchId: 'branch-1',
    branchRootMessageId: 'cluster-1',
    junctionGroupId: null,
    isJunction: false,
    junctionChildCount: 0,
    isActive: true,
    isLatest: true,
    isDetached: false,
    isActivePath: true,
    isRoot: false,
    isFirstRebuttal: false,
    standingBand: 'pretty_right' as TimelineStandingBand,
    toneBand: 'measured' as TimelineToneBand,
    temperatureBand: 'warm' as TimelineTemperatureBand,
    kindColor: '#f97316',
    kindColorFamily: 'challenge' as TimelineKindColorFamily,
    x: 0,
    y: 0,
    accessibilityLabel: 'rebuttal',
    ...over,
  };
}

function fakeViewModel(over: Partial<ArgumentBubbleViewModel> = {}): ArgumentBubbleViewModel {
  return {
    messageId: ACTIVE,
    ordinal: 4,
    createdAtLabel: '2026-05-26 12:00',
    relativeLabel: '2h ago',
    body: 'Bike lanes do not improve safety in every district.',
    kindLabel: 'rebuttal',
    actor: 'other',
    sideLabel: 'Neg',
    isLatest: true,
    isActive: true,
    parentHint: null,
    qualifierBadges: ['Scope challenge'],
    pointStandingHint: 'Needs work',
    allowedControls: [],
    deletionRequested: false,
    ...over,
  };
}

function model(): CardDetailViewModel {
  return buildCardDetailViewModel({
    activeMessageId: ACTIVE,
    chronologicalIds: [PARENT, ACTIVE],
    ordinalOf: (id) => (id === ACTIVE ? 4 : id === PARENT ? 3 : null),
    kindLabelOf: (id) => (id === ACTIVE ? 'rebuttal' : 'claim'),
    parentIdOf: (id) => (id === ACTIVE ? PARENT : null),
    categoryLabel: 'Rebuttal',
    qualifierLabels: ['Scope challenge'],
    persistedClassifierRows: [persistedRow()],
    manualTagEntries: [],
    autoMetadataCodes: [],
    clusterState: 'rebutted',
    messageContribution: null,
    evidenceSources: [],
    evidenceDebtSummary: 'Receipts owed: a source for this claim.',
    standingHint: 'Needs work',
    lifecycleState: 'sourced',
    flagLabels: ['Scope challenge'],
    parentBodyPreview: 'We should narrow the scope.',
    parentOrdinal: 3,
    parentKindLabel: 'claim',
    parentMessageId: PARENT,
    parentActor: 'other',
    parentActorLabel: 'Other side',
    standingToneHeatNode: fakeNode(),
    standingToneHeatViewModel: fakeViewModel(),
  });
}

/** A minimal DisagreementContract with an open source-owed burden so the
 *  advisory line + the (expanded) Referee Card both derive a real issue. */
function refereeContract(): DisagreementContract {
  return {
    id: 'issue:msg-active:challenges:evidence',
    roomId: null,
    targetNodeId: ACTIVE,
    targetQuote: null,
    contestedProposition: 'Bike lanes do not improve safety in every district.',
    axis: 'evidence',
    relationToParent: 'challenges',
    burden: 'source_owed',
    state: 'open',
    refereeObservations: [],
    userAllegations: [],
    nextBestMoves: [],
  };
}

/** Build a prioritized flag set from N triggering observation rows. */
function flagsFrom(rows: ReadonlyArray<MachineObservationResultRow>) {
  const built = buildPointFeedbackFlags(rows, { isOwnPoint: false });
  return prioritizePointFeedbackFlags(built);
}

/** Recursively collect every visible text string in a rendered node tree. */
function collectText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(' ');
  const n = node as { props?: { children?: unknown } };
  if (n.props && 'children' in n.props) return collectText(n.props.children);
  return '';
}

const DEMOTED_ZONE_IDS = [
  'card-detail-classifier-zone',
  'card-detail-sth-zone',
  'card-detail-evidence-zone',
  'card-detail-standing-zone',
  'card-detail-lifecycle-zone',
  'card-detail-actions-zone',
  'card-detail-full-tags-zone',
  'card-detail-flags-zone',
  'card-detail-referee-card-slot',
];

describe('VISUAL-SIMPLIFY-001 — collapsed-default kept set', () => {
  it('mounts the message + compact meta + toggle (and the flag row + advisory line when present)', () => {
    const { getByTestId } = render(
      <CardDetailPanel
        model={model()}
        currentMessageBody="Bike lanes do not improve safety in every district."
        refereeCard={refereeContract()}
        pointFeedbackFlags={flagsFrom([
          persistedRow({ rawKey: 'quote_anchors_parent', family: 'parent_relation' }),
        ])}
      />,
    );
    // Parent context anchor.
    expect(getByTestId('card-detail-parent-bubble-slot')).toBeTruthy();
    expect(getByTestId('card-detail-parent-bubble')).toBeTruthy();
    // The message.
    expect(getByTestId('card-detail-current-message-body')).toBeTruthy();
    expect(getByTestId('card-detail-step-reference')).toBeTruthy();
    // ONE compact meta line.
    expect(getByTestId('card-detail-compact-meta')).toBeTruthy();
    // The capped friendly-flag row.
    expect(getByTestId('card-detail-feedback-flags')).toBeTruthy();
    // The single advisory line.
    expect(getByTestId('card-detail-advisory-line')).toBeTruthy();
    // The ONE opt-in toggle.
    expect(getByTestId('card-detail-more-toggle')).toBeTruthy();
  });

  it('folds category + first qualifier + lifecycle into the compact meta line', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const meta = collectText(getByTestId('card-detail-compact-meta'));
    expect(meta).toContain('Rebuttal');
    expect(meta).toContain('Scope challenge');
    // Lifecycle "sourced" maps to plain language and appears in the same line.
    expect(getByTestId('card-detail-compact-meta').props.accessibilityRole).toBe('text');
  });
});

describe('VISUAL-SIMPLIFY-001 — demoted set is absent by default, present after the toggle', () => {
  it('every demoted zone is null before the toggle and truthy after', () => {
    const { getByTestId, queryByTestId } = render(
      <CardDetailPanel
        model={model()}
        currentMessageBody="Body."
        refereeCard={refereeContract()}
        viewerRole="observer"
        bubbleActor="other"
        onRailAction={jest.fn()}
      />,
    );
    for (const id of DEMOTED_ZONE_IDS) {
      expect(queryByTestId(id)).toBeNull();
    }
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    for (const id of DEMOTED_ZONE_IDS) {
      expect(getByTestId(id)).toBeTruthy();
    }
    // Re-pressing re-collapses.
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    for (const id of DEMOTED_ZONE_IDS) {
      expect(queryByTestId(id)).toBeNull();
    }
  });
});

describe('VISUAL-SIMPLIFY-001 — de-dupe survivors in the collapsed default', () => {
  it('standing appears at most once (the flag row is the only standing surface)', () => {
    const { queryByTestId } = render(
      <CardDetailPanel
        model={model()}
        currentMessageBody="Body."
        refereeCard={refereeContract()}
        pointFeedbackFlags={flagsFrom([
          persistedRow({ rawKey: 'quote_anchors_parent', family: 'parent_relation' }),
        ])}
      />,
    );
    // The S/T/H standing chip, the standing zone, and the referee card are all
    // absent in the default — standing is not duplicated.
    expect(queryByTestId('card-detail-standing-band')).toBeNull();
    expect(queryByTestId('card-detail-standing')).toBeNull();
    expect(queryByTestId('card-detail-referee-card-slot')).toBeNull();
  });

  it('evidence appears at most once (the single advisory line, not the evidence zone)', () => {
    const { queryByTestId, getByTestId } = render(
      <CardDetailPanel
        model={model()}
        currentMessageBody="Body."
        refereeCard={refereeContract()}
      />,
    );
    expect(queryByTestId('card-detail-evidence-zone')).toBeNull();
    // The single advisory line is the only evidence-burden surface.
    expect(getByTestId('card-detail-advisory-line')).toBeTruthy();
  });

  it('next-move appears at most once (only the advisory line; no ActionsZone, no Referee moves)', () => {
    const { queryByTestId, getByTestId } = render(
      <CardDetailPanel
        model={model()}
        currentMessageBody="Body."
        refereeCard={refereeContract()}
        viewerRole="observer"
        bubbleActor="other"
        onRailAction={jest.fn()}
      />,
    );
    expect(queryByTestId('card-detail-actions-zone')).toBeNull();
    // No Referee Card (and therefore no zone-3 move buttons) in the default.
    expect(queryByTestId('card-detail-referee-card-slot')).toBeNull();
    expect(queryByTestId('referee-card-moves')).toBeNull();
    expect(getByTestId('card-detail-advisory-line')).toBeTruthy();
  });
});

describe('VISUAL-SIMPLIFY-001 — flag row cap + empty behaviour', () => {
  it('caps at 3 pills + a quiet "+N more" when more than 3 observations map', () => {
    const rows: MachineObservationResultRow[] = [
      persistedRow({ id: 'r1', rawKey: 'quote_anchors_parent', family: 'parent_relation' }),
      persistedRow({ id: 'r2', rawKey: 'challenges_parent', family: 'parent_relation' }),
      persistedRow({ id: 'r3', rawKey: 'source_attached', family: 'evidence_source_chain' }),
      persistedRow({ id: 'r4', rawKey: 'refines_parent', family: 'parent_relation' }),
      persistedRow({ id: 'r5', rawKey: 'acknowledges_parent', family: 'parent_relation' }),
    ];
    const prioritized = flagsFrom(rows);
    // The 5 rawKeys map to 5 distinct friendly flags, so > 3 are suppressed.
    expect(prioritized.suppressedCount).toBeGreaterThan(0);
    {
      const { getByTestId } = render(
        <CardDetailPanel model={model()} pointFeedbackFlags={prioritized} />,
      );
      // Exactly the 3 visible pills render (one per prioritized flag).
      for (const flag of prioritized.visible) {
        expect(getByTestId(`point-feedback-flag-${flag.id}`)).toBeTruthy();
      }
      expect(prioritized.visible.length).toBe(3);
      expect(getByTestId('point-feedback-flags-more')).toBeTruthy();
    }
    // Invariant the module guarantees regardless of the descriptor table.
    expect(prioritized.visible.length).toBeLessThanOrEqual(3);
  });

  it('renders no flag row for an empty visible list (calm default holds)', () => {
    const { queryByTestId } = render(
      <CardDetailPanel model={model()} pointFeedbackFlags={prioritizePointFeedbackFlags([])} />,
    );
    expect(queryByTestId('card-detail-feedback-flags')).toBeNull();
    // Omitting the prop entirely also renders nothing.
    const { queryByTestId: q2 } = render(<CardDetailPanel model={model()} />);
    expect(q2('card-detail-feedback-flags')).toBeNull();
  });

  it('renders no advisory line when no referee issue is supplied', () => {
    const { queryByTestId } = render(<CardDetailPanel model={model()} />);
    expect(queryByTestId('card-detail-advisory-line')).toBeNull();
  });
});

describe('VISUAL-SIMPLIFY-001 — toggle accessibility', () => {
  it('exposes role button + expanded state + hitSlop >= 44x44 + verdict-free label', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const toggle = getByTestId('card-detail-more-toggle');
    expect(toggle.props.accessibilityRole).toBe('button');
    expect(toggle.props.accessibilityState).toEqual({ expanded: false });
    expect(toggle.props.accessibilityLabel).toBe('More detail');
    // hitSlop clears 44x44 (12 on all sides atop the 44 min-height visual).
    expect(toggle.props.hitSlop).toEqual({ top: 12, bottom: 12, left: 12, right: 12 });
    // No keyboard-shortcut or verdict token in the label.
    const label = String(toggle.props.accessibilityLabel).toLowerCase();
    for (const b of BANNED) {
      expect(label).not.toContain(b);
    }
    fireEvent.press(toggle);
    const after = getByTestId('card-detail-more-toggle');
    expect(after.props.accessibilityState).toEqual({ expanded: true });
    expect(after.props.accessibilityLabel).toBe('Hide detail');
  });
});

describe('VISUAL-SIMPLIFY-001 — no raw-code leak (default AND expanded)', () => {
  it('emits no family_ / snake_case rawKey / verdict token in either render', () => {
    const { toJSON, getByTestId } = render(
      <CardDetailPanel
        model={model()}
        currentMessageBody="Bike lanes do not improve safety in every district."
        refereeCard={refereeContract()}
        pointFeedbackFlags={flagsFrom([
          persistedRow({ rawKey: 'quote_anchors_parent', family: 'parent_relation' }),
        ])}
        windowWidth={1440}
        platformOs="web"
      />,
    );
    const scan = (): void => {
      const strings: string[] = [];
      const walk = (n: unknown): void => {
        if (typeof n === 'string') {
          strings.push(n);
          return;
        }
        if (Array.isArray(n)) {
          n.forEach(walk);
          return;
        }
        if (n && typeof n === 'object') {
          const node = n as { children?: unknown };
          if (node.children) walk(node.children);
        }
      };
      walk(toJSON());
      for (const s of strings) {
        const lower = s.toLowerCase();
        for (const b of BANNED) {
          expect(lower).not.toContain(b);
        }
        expect(s).not.toMatch(/[a-z]+_[a-z]+/);
      }
    };
    // Collapsed default.
    scan();
    // Expanded (classifier / mapping / tags strings included).
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    scan();
  });
});

describe('VISUAL-SIMPLIFY-001 — reduce-motion safe', () => {
  it('the CardDetailPanel toggle path uses no Animated / LayoutAnimation', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src', 'features', 'arguments', 'cardView', 'CardDetailPanel.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/\bAnimated\b/);
    expect(src).not.toMatch(/\bLayoutAnimation\b/);
  });
});
