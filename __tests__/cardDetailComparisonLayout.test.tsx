/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 3) — comparison-style centerpiece layout,
 * responsive multi-column, navigation, and the #14 disclosure regression.
 *
 * Covers the Slice 3 operator refinement + the ratified §7.1 invariant:
 *   - centerpiece (current card) present + prominent
 *   - parent bubble rendered ABOVE + off-center, DIFFERENT color from the
 *     current card, italic + quoted text, reference is a button that calls
 *     onActivateAncestor(parentId); root / unresolvable parent → no bubble
 *   - responsive 3-col (≥1024 web) vs stacked (narrow / native); same sections
 *   - #14: the Card renders ALL sections with NO "Full details" / expand and
 *     no accessibilityState.expanded; the Timeline projection STILL keeps its
 *     tap-to-reveal disclosure (source-scan, per repo discipline)
 *   - grayscale legibility (meaning carried by glyph / label, not color-only)
 *   - verdict-token ban-list recursive over rendered strings; no snake_case
 *
 * Uses @testing-library/react-native.
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CardDetailPanel } from '../src/features/arguments/cardView/CardDetailPanel';
import { buildCardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import {
  ACTOR_BUBBLE_COLOR,
  buildSectionSemanticFlags,
} from '../src/features/arguments/detail/argumentDetailModel';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import type { MachineObservationResultRow } from '../src/features/nodeLabels/machineObservationPersistenceTypes';
import type { CardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import type {
  ArgumentBubbleActor,
  ArgumentBubbleViewModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type {
  ClusterMetadataSummary,
  ManualTagCode,
  AutoMetadataCode,
  MoveLinkageRecord,
  MoveMetadataLedger,
} from '../src/features/metadata';
import type { PointLifecycleState } from '../src/features/lifecycle';

const ACTIVE = 'msg-active';
const PARENT = 'msg-parent';
const CLUSTER = 'cluster-1';

const BANNED = [
  'winner',
  'loser',
  'truth',
  'true',
  'false',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'correct',
  'incorrect',
];

function persistedRow(): MachineObservationResultRow {
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
  };
}

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: ACTIVE,
    parentId: PARENT,
    ordinal: 7,
    createdAt: '2026-05-26T12:00:00.000Z',
    createdAtLabel: '2026-05-26 12:00',
    relativeLabel: '2h ago',
    actorLabel: 'You',
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
    branchRootMessageId: CLUSTER,
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
    ordinal: 7,
    createdAtLabel: '2026-05-26 12:00',
    relativeLabel: '2h ago',
    body: 'Bike lanes do not improve safety in every district.',
    kindLabel: 'rebuttal',
    actor: 'self',
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

function semanticSection() {
  const meta: ClusterMetadataSummary = {
    clusterId: CLUSTER,
    manualTagCodes: ['needs_source'] as ManualTagCode[],
    autoMetadataCodes: ['has_evidence'] as AutoMetadataCode[],
    lifecycleState: 'open' as PointLifecycleState,
    lastManualTagAt: null,
    taggingParticipantCount: 0,
  };
  const move: MoveLinkageRecord = {
    messageId: CLUSTER,
    parentMessageId: null,
    rootPointId: CLUSTER,
    pointClusterId: CLUSTER,
    branchId: 'branch-1',
    targetExcerpt: null,
    disagreementAxis: null,
    semanticFlags: [],
    userAppliedTags: [],
    autoDerivedMetadata: [],
    lifecycleEventsCausedByMove: [],
  };
  const ledger: MoveMetadataLedger = {
    byMessage: new Map([[CLUSTER, move]]),
    byCluster: new Map([[CLUSTER, meta]]),
    metadataEvents: [],
    messageOrder: [CLUSTER],
    inputHash: 'comparison-layout-test',
  };
  return buildSectionSemanticFlags(ledger, CLUSTER, 'No lifecycle decision yet.', 'stack');
}

interface ModelOver {
  parentBodyPreview?: string | null;
  parentActor?: ArgumentBubbleActor | null;
  parentMessageId?: string | null;
  parentOrdinal?: number | null;
}

function model(over: ModelOver = {}): CardDetailViewModel {
  return buildCardDetailViewModel({
    activeMessageId: ACTIVE,
    chronologicalIds: [PARENT, ACTIVE],
    ordinalOf: (id) => (id === ACTIVE ? 7 : id === PARENT ? 6 : null),
    kindLabelOf: (id) => (id === ACTIVE ? 'rebuttal' : 'claim'),
    parentIdOf: (id) => (id === ACTIVE ? PARENT : null),
    categoryLabel: 'Rebuttal',
    qualifierLabels: ['Scope challenge'],
    persistedClassifierRows: [persistedRow()],
    manualTagEntries: [],
    autoMetadataCodes: ['has_evidence'],
    clusterState: 'rebutted',
    messageContribution: null,
    evidenceSources: [],
    evidenceDebtSummary: null,
    standingHint: 'Needs work',
    lifecycleState: 'sourced',
    flagLabels: ['Scope challenge'],
    standingToneHeatNode: fakeNode(),
    standingToneHeatViewModel: fakeViewModel(),
    structuralTagLabels: ['Side branch'],
    semanticFlagsSection: semanticSection(),
    // Slice 3 — parent comparison-bubble inputs (the parent is the OTHER side).
    parentBodyPreview:
      'parentBodyPreview' in over
        ? over.parentBodyPreview
        : 'We should narrow the scope to the downtown core.',
    parentOrdinal: 'parentOrdinal' in over ? over.parentOrdinal : 6,
    parentKindLabel: 'claim',
    parentMessageId: 'parentMessageId' in over ? over.parentMessageId : PARENT,
    parentActor: 'parentActor' in over ? over.parentActor : 'other',
    parentActorLabel: 'Other side',
  });
}

function roleOf(node: { props: { accessibilityRole?: string } }): string | undefined {
  return node.props.accessibilityRole;
}

/** Flatten an RN style prop into a single object for assertions. */
function flatStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...flatStyle(s) }),
      {},
    );
  }
  return (style ?? {}) as Record<string, unknown>;
}

describe('CVDH-001 Slice 3 — comparison-style centerpiece + parent bubble', () => {
  it('renders the centerpiece region with the current card as the focus', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    expect(getByTestId('card-detail-centerpiece')).toBeTruthy();
    expect(getByTestId('card-detail-centerpiece-card')).toBeTruthy();
  });

  it('renders the parent bubble ABOVE + OFF-CENTER the centerpiece', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const bubble = getByTestId('card-detail-parent-bubble');
    expect(bubble).toBeTruthy();
    const style = flatStyle(bubble.props.style);
    // Off-center: pulled to the left with alignSelf flex-start.
    expect(style.alignSelf).toBe('flex-start');
    expect(typeof style.marginLeft).toBe('number');
    expect(style.marginLeft as number).toBeLessThan(0);
  });

  it('colors the parent bubble with the parent actor color — DIFFERENT from the centerpiece card', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const bubble = getByTestId('card-detail-parent-bubble');
    const bubbleStyle = flatStyle(bubble.props.style);
    // Parent actor is 'other' → the indigo token, not the centerpiece surface.
    expect(bubbleStyle.backgroundColor).toBe(ACTOR_BUBBLE_COLOR.other.bg);
    expect(bubbleStyle.borderColor).toBe(ACTOR_BUBBLE_COLOR.other.border);

    const card = getByTestId('card-detail-centerpiece-card');
    const cardStyle = flatStyle(card.props.style);
    // The two surfaces are visually distinct colors.
    expect(bubbleStyle.backgroundColor).not.toBe(cardStyle.backgroundColor);
    expect(bubbleStyle.borderColor).not.toBe(cardStyle.borderColor);
  });

  it('renders the parent text ITALIC inside QUOTES', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const quote = getByTestId('card-detail-parent-bubble-quote');
    expect(quote.props.children).toBe(
      '“We should narrow the scope to the downtown core.”',
    );
    expect(flatStyle(quote.props.style).fontStyle).toBe('italic');
  });

  it('renders the parent reference (#N · kind) as a button that switches the active card', () => {
    const onActivateAncestor = jest.fn();
    const { getByTestId } = render(
      <CardDetailPanel model={model()} onActivateAncestor={onActivateAncestor} />,
    );
    const ref = getByTestId('card-detail-parent-bubble-reference');
    expect(roleOf(ref)).toBe('button');
    fireEvent.press(ref);
    expect(onActivateAncestor).toHaveBeenCalledTimes(1);
    expect(onActivateAncestor).toHaveBeenCalledWith(PARENT);
  });

  it('shows the reference label "#6 · claim" on the bubble', () => {
    const { getByText } = render(<CardDetailPanel model={model()} />);
    expect(getByText('#6 · claim')).toBeTruthy();
  });

  it('degrades to NO bubble for a root / unresolvable parent (no reason leak)', () => {
    const { queryByTestId } = render(
      <CardDetailPanel model={model({ parentBodyPreview: null })} />,
    );
    expect(queryByTestId('card-detail-parent-bubble')).toBeNull();
    expect(queryByTestId('card-detail-parent-bubble-reference')).toBeNull();
    expect(queryByTestId('card-detail-parent-bubble-quote')).toBeNull();
  });

  it('renders the reference as DISPLAY-ONLY (not tappable) when the parent id is missing', () => {
    const onActivateAncestor = jest.fn();
    const { queryByTestId, getByTestId } = render(
      <CardDetailPanel
        model={model({ parentMessageId: null })}
        onActivateAncestor={onActivateAncestor}
      />,
    );
    // No tappable reference; the static label renders instead.
    expect(queryByTestId('card-detail-parent-bubble-reference')).toBeNull();
    expect(getByTestId('card-detail-parent-bubble-reference-static')).toBeTruthy();
    expect(roleOf(getByTestId('card-detail-parent-bubble-reference-static'))).toBe('text');
  });
});

describe('CVDH-001 Slice 3 — responsive multi-column layout', () => {
  it('lays out three columns on a wide web viewport (≥1024), same sections present', () => {
    const { getByTestId } = render(
      <CardDetailPanel model={model()} windowWidth={1440} platformOs="web" />,
    );
    const panel = getByTestId('card-detail-panel');
    expect(flatStyle(panel.props.style).flexDirection).toBe('row');
    // All three regions present.
    expect(getByTestId('card-detail-centerpiece')).toBeTruthy();
    expect(getByTestId('card-detail-classifier-column')).toBeTruthy();
    expect(getByTestId('card-detail-tags-column')).toBeTruthy();
  });

  it('stacks into a single column on a narrow web viewport, SAME sections present', () => {
    const { getByTestId } = render(
      <CardDetailPanel model={model()} windowWidth={390} platformOs="web" />,
    );
    const panel = getByTestId('card-detail-panel');
    expect(flatStyle(panel.props.style).flexDirection).not.toBe('row');
    expect(getByTestId('card-detail-centerpiece')).toBeTruthy();
    expect(getByTestId('card-detail-classifier-column')).toBeTruthy();
    expect(getByTestId('card-detail-tags-column')).toBeTruthy();
  });

  it('stacks on native regardless of width', () => {
    const { getByTestId } = render(
      <CardDetailPanel model={model()} windowWidth={1440} platformOs="ios" />,
    );
    expect(flatStyle(getByTestId('card-detail-panel').props.style).flexDirection).not.toBe(
      'row',
    );
  });

  it('renders all the inner detail sections in BOTH layouts (none dropped)', () => {
    for (const width of [390, 1440]) {
      const { getByTestId, unmount } = render(
        <CardDetailPanel model={model()} windowWidth={width} platformOs="web" />,
      );
      // Centerpiece sections.
      expect(getByTestId('card-detail-parent-bubble')).toBeTruthy();
      expect(getByTestId('card-detail-sth-zone')).toBeTruthy();
      expect(getByTestId('card-detail-evidence-zone')).toBeTruthy();
      // Flanking sections.
      expect(getByTestId('card-detail-classifier-zone')).toBeTruthy();
      expect(getByTestId('card-detail-full-tags-zone')).toBeTruthy();
      unmount();
    }
  });
});

describe('CVDH-001 Slice 3 — #14 Card-visible vs Timeline-disclosed regression', () => {
  it('the Card renders ALL sections with NO expand / disclosure (no accessibilityState.expanded)', () => {
    const { getByTestId, queryAllByText, toJSON } = render(
      <CardDetailPanel model={model()} windowWidth={1440} platformOs="web" />,
    );
    // All sections are visible by default — no tap needed.
    expect(getByTestId('card-detail-parent-bubble')).toBeTruthy();
    expect(getByTestId('card-detail-classifier-zone')).toBeTruthy();
    expect(getByTestId('card-detail-full-tags-zone')).toBeTruthy();
    expect(getByTestId('card-detail-sth-zone')).toBeTruthy();
    expect(getByTestId('card-detail-evidence-zone')).toBeTruthy();

    // No "Full details" / "Show details" / "Hide details" expand control.
    expect(queryAllByText(/full details/i)).toHaveLength(0);
    expect(queryAllByText(/show details/i)).toHaveLength(0);
    expect(queryAllByText(/hide details/i)).toHaveLength(0);

    // No node in the Card tree carries accessibilityState.expanded.
    const serialized = JSON.stringify(toJSON());
    expect(serialized).not.toContain('"expanded"');
  });

  it('the ONLY Card buttons are navigation (parent-bubble reference + step-ref token)', () => {
    const { UNSAFE_root } = render(
      <CardDetailPanel model={model()} windowWidth={1440} platformOs="web" />,
    );
    const buttons = UNSAFE_root.findAll(
      (n: { props?: { accessibilityRole?: string } }) =>
        Boolean(n.props && n.props.accessibilityRole === 'button'),
    );
    // Each button is a navigation affordance: the comparison-bubble reference
    // and/or the step-reference parent token. None is a moderate / expand /
    // re-classify action.
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      const label = String(btn.props.accessibilityLabel ?? '');
      expect(label.toLowerCase()).toMatch(/go to/);
    }
  });

  it('the Timeline projection STILL keeps its tap-to-reveal disclosure (source scan)', () => {
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        'src',
        'features',
        'arguments',
        'TimelineSelectedReadoutPanel.tsx',
      ),
      'utf8',
    );
    // The Timeline page retains its collapsed "full details" disclosure +
    // the accessibilityState.expanded contract — Card != Timeline posture.
    expect(src).toMatch(/Hide full details/);
    expect(src).toMatch(/Show full details/);
    expect(src).toMatch(/accessibilityState=\{\{\s*expanded\s*\}\}/);
  });

  it('the CardDetailPanel source has NO "Full details" expand affordance', () => {
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        'src',
        'features',
        'arguments',
        'cardView',
        'CardDetailPanel.tsx',
      ),
      'utf8',
    );
    expect(src).not.toMatch(/Full details/i);
    expect(src).not.toMatch(/accessibilityState=\{\{\s*expanded/);
  });
});

describe('CVDH-001 Slice 3 — grayscale legibility + ban-list', () => {
  it('the parent bubble carries a color-INDEPENDENT actor label + reference text', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    // Meaning ("Other side", "#6 · claim", the italic quote) is carried by
    // TEXT, not color — legible in a grayscale snapshot.
    expect(getByTestId('card-detail-parent-bubble-actor').props.children).toBe('Other side');
    expect(getByTestId('card-detail-parent-bubble-quote')).toBeTruthy();
    expect(getByTestId('card-detail-parent-bubble-reference')).toBeTruthy();
  });

  it('classifier confidence renders as PIPS, not a digit', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    expect(getByTestId('card-detail-classifier-pips')).toBeTruthy();
  });

  it('the advisory caption is present (advisory, not a verdict)', () => {
    const { getByText } = render(<CardDetailPanel model={model()} />);
    expect(
      getByText('What the referee noticed — advisory, not a verdict.'),
    ).toBeTruthy();
  });

  it('no rendered string contains a verdict token or snake_case leak', () => {
    const { toJSON } = render(
      <CardDetailPanel model={model()} windowWidth={1440} platformOs="web" />,
    );
    const tree = toJSON();
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
    walk(tree);
    for (const s of strings) {
      const lower = s.toLowerCase();
      for (const b of BANNED) {
        expect(lower).not.toContain(b);
      }
      // No snake_case internal-code leak in a rendered string.
      expect(s).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});
