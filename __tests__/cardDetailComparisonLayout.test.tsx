/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 3) + CARD-VIEW-COMPARISON-POLISH-001 —
 * comparison-style centerpiece layout, responsive multi-column, navigation,
 * and the #14 disclosure regression.
 *
 * Covers the Slice 3 refinement, the COMPARISON-POLISH operator asks, and the
 * ratified §7.1 invariant:
 *   - the parent ("replying-to" / OPPONENT) bubble renders FIRST (at the TOP
 *     of the panel, before the current message's body + observations), with a
 *     TRUE-BLACK backdrop + a DOUBLE OUTLINE (outer ring + inner border) +
 *     a LARGER quote font; reference is a button that calls
 *     onActivateAncestor(parentId); root / unresolvable parent → no bubble
 *   - the current/own message centerpiece uses a DRAMATICALLY different,
 *     NON-BLACK backdrop from the parent bubble (high-contrast message-type
 *     differentiation), and renders the forwarded current message body
 *   - responsive 3-col (≥1024 web) vs stacked (narrow / native); same sections
 *   - #14: the Card renders ALL sections with NO "Full details" / expand and
 *     no accessibilityState.expanded; the Timeline projection STILL keeps its
 *     tap-to-reveal disclosure (source-scan, per repo discipline)
 *   - grayscale legibility (meaning carried by the "Replying to" framing +
 *     actor label + reference text, not color-only)
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
  PARENT_BUBBLE_BACKDROP,
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

  it('renders the parent bubble OFF-CENTER (alignSelf flex-start, pulled left)', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const bubble = getByTestId('card-detail-parent-bubble');
    expect(bubble).toBeTruthy();
    // The OUTER ring carries the positioning. Off-center: pulled to the left
    // with alignSelf flex-start.
    const style = flatStyle(bubble.props.style);
    expect(style.alignSelf).toBe('flex-start');
    expect(typeof style.marginLeft).toBe('number');
    expect(style.marginLeft as number).toBeLessThan(0);
  });

  // CARD-VIEW-COMPARISON-POLISH-001 — ask 1: the parent bubble is the FIRST
  // element of the panel (at the TOP), before the current message's body and
  // observations. Updated IN-PLACE from the prior "ABOVE the centerpiece"
  // wording — this is the new intended spec (parent banner at the very top of
  // the active card detail), not a relaxation.
  it('renders the parent bubble FIRST — at the top, before the current message body + observations', () => {
    const { getByTestId } = render(
      <CardDetailPanel model={model()} currentMessageBody="My rebuttal body." />,
    );
    const panel = getByTestId('card-detail-panel');
    // The parent-bubble slot is the FIRST child of the panel root.
    const firstChildTestId = (panel.props.children as Array<{ props?: { testID?: string } }>)[0]
      ?.props?.testID;
    expect(firstChildTestId).toBe('card-detail-parent-bubble-slot');
    // The slot contains the bubble; the current message body lives BELOW it in
    // the centerpiece card.
    expect(getByTestId('card-detail-parent-bubble')).toBeTruthy();
    expect(getByTestId('card-detail-current-message-body')).toBeTruthy();
  });

  // CARD-VIEW-COMPARISON-POLISH-001 — ask 2: BLACK backdrop + DOUBLE OUTLINE.
  // Updated IN-PLACE from the prior actor-`bg`/`border` single-fill assertion
  // to the new black-backdrop + double-outline structure (the new intended
  // spec), not a relaxation. The black fill denotes the message being replied
  // to (a message-type cue), never a verdict.
  it('gives the parent bubble a BLACK backdrop + a DOUBLE OUTLINE (outer ring + inner border)', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const ring = getByTestId('card-detail-parent-bubble'); // outer ring
    const inner = getByTestId('card-detail-parent-bubble-inner');
    const ringStyle = flatStyle(ring.props.style);
    const innerStyle = flatStyle(inner.props.style);

    // INNER bubble — TRUE-BLACK backdrop, distinct from any actor fill.
    expect(innerStyle.backgroundColor).toBe(PARENT_BUBBLE_BACKDROP);
    expect(innerStyle.backgroundColor).toBe('#000000');

    // DOUBLE OUTLINE — two concentric, separately-colored strokes:
    //   outer ring  → actor accent (`ring`)
    //   inner border→ deeper actor stroke (`border`)
    expect(ringStyle.borderColor).toBe(ACTOR_BUBBLE_COLOR.other.ring);
    expect(innerStyle.borderColor).toBe(ACTOR_BUBBLE_COLOR.other.border);
    expect(ringStyle.borderColor).not.toBe(innerStyle.borderColor);
    expect(typeof ringStyle.borderWidth).toBe('number');
    expect(ringStyle.borderWidth as number).toBeGreaterThan(0);
    expect(typeof innerStyle.borderWidth).toBe('number');
    expect(innerStyle.borderWidth as number).toBeGreaterThan(0);
  });

  // CARD-VIEW-COMPARISON-POLISH-001 — ask 3: DRAMATIC message-type contrast.
  // The parent bubble's BLACK backdrop vs the current message centerpiece's
  // distinct NON-BLACK surface is the core contrast.
  it('contrasts the parent bubble backdrop DRAMATICALLY with the current message centerpiece surface', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const inner = getByTestId('card-detail-parent-bubble-inner');
    const card = getByTestId('card-detail-centerpiece-card');
    const innerBackdrop = flatStyle(inner.props.style).backgroundColor;
    const cardSurface = flatStyle(card.props.style).backgroundColor;

    // The two message types use different backdrop tokens.
    expect(innerBackdrop).toBe('#000000');
    expect(cardSurface).not.toBe('#000000');
    expect(innerBackdrop).not.toBe(cardSurface);
    // The centerpiece carries an actor-accent (non-black) border so it reads as
    // a clearly different message type, not just a different shade.
    expect(flatStyle(card.props.style).borderColor).not.toBe(innerBackdrop);
  });

  // CARD-VIEW-COMPARISON-POLISH-001 — ask 2 + 4: LARGER parent quote font.
  it('renders the parent text ITALIC inside QUOTES, at a LARGER font', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const quote = getByTestId('card-detail-parent-bubble-quote');
    expect(quote.props.children).toBe(
      '“We should narrow the scope to the downtown core.”',
    );
    const quoteStyle = flatStyle(quote.props.style);
    expect(quoteStyle.fontStyle).toBe('italic');
    // Larger than the dense popout-body (12) baseline — a readable quote size.
    expect(typeof quoteStyle.fontSize).toBe('number');
    expect(quoteStyle.fontSize as number).toBeGreaterThanOrEqual(15);
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
  // VISUAL-SIMPLIFY-001 — the wide 3-column layout now applies INSIDE the
  // expansion (the collapsed default panel root is always a single stacked
  // column). Open the toggle first, then assert the expansion carries the row.
  it('lays out three columns on a wide web viewport (≥1024) inside the expansion, same sections present', () => {
    const { getByTestId } = render(
      <CardDetailPanel model={model()} windowWidth={1440} platformOs="web" />,
    );
    // The collapsed default panel root is a single stacked column.
    expect(flatStyle(getByTestId('card-detail-panel').props.style).flexDirection).not.toBe('row');
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    const expansion = getByTestId('card-detail-expansion');
    expect(flatStyle(expansion.props.style).flexDirection).toBe('row');
    // All three regions present.
    expect(getByTestId('card-detail-centerpiece')).toBeTruthy();
    expect(getByTestId('card-detail-classifier-column')).toBeTruthy();
    expect(getByTestId('card-detail-tags-column')).toBeTruthy();
  });

  it('stacks into a single column on a narrow web viewport, SAME sections present (in the expansion)', () => {
    const { getByTestId } = render(
      <CardDetailPanel model={model()} windowWidth={390} platformOs="web" />,
    );
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    const expansion = getByTestId('card-detail-expansion');
    expect(flatStyle(expansion.props.style).flexDirection).not.toBe('row');
    expect(getByTestId('card-detail-centerpiece')).toBeTruthy();
    expect(getByTestId('card-detail-classifier-column')).toBeTruthy();
    expect(getByTestId('card-detail-tags-column')).toBeTruthy();
  });

  it('stacks on native regardless of width (expansion is a single column)', () => {
    const { getByTestId } = render(
      <CardDetailPanel model={model()} windowWidth={1440} platformOs="ios" />,
    );
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    expect(flatStyle(getByTestId('card-detail-expansion').props.style).flexDirection).not.toBe(
      'row',
    );
  });

  it('renders all the inner detail sections in BOTH layouts (none dropped, in the expansion)', () => {
    for (const width of [390, 1440]) {
      const { getByTestId, unmount } = render(
        <CardDetailPanel model={model()} windowWidth={width} platformOs="web" />,
      );
      // The parent bubble is in the collapsed default; the rest are in the
      // expansion.
      expect(getByTestId('card-detail-parent-bubble')).toBeTruthy();
      fireEvent.press(getByTestId('card-detail-more-toggle'));
      // Centerpiece (demoted) sections.
      expect(getByTestId('card-detail-sth-zone')).toBeTruthy();
      expect(getByTestId('card-detail-evidence-zone')).toBeTruthy();
      // Flanking sections.
      expect(getByTestId('card-detail-classifier-zone')).toBeTruthy();
      expect(getByTestId('card-detail-full-tags-zone')).toBeTruthy();
      unmount();
    }
  });
});

describe('VISUAL-SIMPLIFY-001 — the Card leads with a calm default behind ONE opt-in toggle', () => {
  // VISUAL-SIMPLIFY-001 deliberately reverses the CVDH-001 §7.1 "no disclosure
  // on the Card" invariant: the default room view is now message-first, with
  // the dense zones behind ONE opt-in "More detail" toggle. The Timeline keeps
  // its own separate disclosure (asserted below, unchanged).
  it('the Card collapses the dense sections by default; the expansion reveals them all', () => {
    const { getByTestId, queryByTestId, queryAllByText } = render(
      <CardDetailPanel model={model()} windowWidth={1440} platformOs="web" />,
    );
    // The parent bubble + the ONE toggle are in the collapsed default.
    expect(getByTestId('card-detail-parent-bubble')).toBeTruthy();
    expect(getByTestId('card-detail-more-toggle')).toBeTruthy();
    // The dense zones are absent in the collapsed default.
    expect(queryByTestId('card-detail-classifier-zone')).toBeNull();
    expect(queryByTestId('card-detail-full-tags-zone')).toBeNull();
    expect(queryByTestId('card-detail-sth-zone')).toBeNull();
    expect(queryByTestId('card-detail-evidence-zone')).toBeNull();

    // Opening the ONE toggle reveals every dense zone.
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    expect(getByTestId('card-detail-classifier-zone')).toBeTruthy();
    expect(getByTestId('card-detail-full-tags-zone')).toBeTruthy();
    expect(getByTestId('card-detail-sth-zone')).toBeTruthy();
    expect(getByTestId('card-detail-evidence-zone')).toBeTruthy();

    // The disclosure copy is the calm "More detail" / "Hide detail" pair; no
    // "Full details" / "Show details" framing leaks in.
    expect(queryAllByText(/full details/i)).toHaveLength(0);
    expect(queryAllByText(/show details/i)).toHaveLength(0);
  });

  it('the toggle carries accessibilityState.expanded that tracks the collapsed / expanded state', () => {
    const { getByTestId } = render(
      <CardDetailPanel model={model()} windowWidth={1440} platformOs="web" />,
    );
    const toggle = getByTestId('card-detail-more-toggle');
    expect(toggle.props.accessibilityRole).toBe('button');
    expect(toggle.props.accessibilityState).toEqual({ expanded: false });
    fireEvent.press(toggle);
    expect(getByTestId('card-detail-more-toggle').props.accessibilityState).toEqual({
      expanded: true,
    });
  });

  it('the Card buttons are navigation OR the ONE More detail / Hide detail toggle (nothing else)', () => {
    const { UNSAFE_root } = render(
      <CardDetailPanel model={model()} windowWidth={1440} platformOs="web" />,
    );
    const buttons = UNSAFE_root.findAll(
      (n: { props?: { accessibilityRole?: string } }) =>
        Boolean(n.props && n.props.accessibilityRole === 'button'),
    );
    // Each button is a navigation affordance ("Go to …") OR the collapse
    // toggle. None is a moderate / re-classify / verdict action.
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      const label = String(btn.props.accessibilityLabel ?? '');
      expect(label.toLowerCase()).toMatch(/go to|more detail|hide detail/);
    }
  });

  it('the Timeline projection STILL keeps its own tap-to-reveal disclosure (source scan, unchanged)', () => {
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
    // the accessibilityState.expanded contract — untouched by this card.
    expect(src).toMatch(/Hide full details/);
    expect(src).toMatch(/Show full details/);
    expect(src).toMatch(/accessibilityState=\{\{\s*expanded\s*\}\}/);
  });

  it('the CardDetailPanel source uses the calm "More detail" toggle (verdict-free copy)', () => {
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
    // VISUAL-SIMPLIFY-001 — the toggle copy is the calm pair; no "Full details"
    // framing is used.
    expect(src).not.toMatch(/Full details/i);
    expect(src).toMatch(/More detail/);
    expect(src).toMatch(/Hide detail/);
  });
});

describe('CVDH-001 Slice 3 — grayscale legibility + ban-list', () => {
  it('the parent bubble carries a color-INDEPENDENT "Replying to" framing + actor label + reference text', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    // Meaning ("Replying to", "Other side", "#6 · claim", the italic quote) is
    // carried by TEXT, not color — legible in a grayscale snapshot. The black
    // backdrop is a message-type cue ("the move being replied to"), so the
    // "Replying to" wording + actor label are what carry the meaning, NOT the
    // (constant) black fill.
    expect(getByTestId('card-detail-parent-bubble-replying-to').props.children).toBe('Replying to');
    expect(getByTestId('card-detail-parent-bubble-actor').props.children).toBe('Other side');
    expect(getByTestId('card-detail-parent-bubble-quote')).toBeTruthy();
    expect(getByTestId('card-detail-parent-bubble-reference')).toBeTruthy();
  });

  // CARD-VIEW-COMPARISON-POLISH-001 — ask 4: the current/own message body is
  // forwarded into the centerpiece and renders at a larger, readable font.
  it('renders the forwarded current message body at a LARGER, readable font', () => {
    const { getByTestId } = render(
      <CardDetailPanel model={model()} currentMessageBody="Bike lanes do not improve safety everywhere." />,
    );
    const body = getByTestId('card-detail-current-message-body');
    expect(body.props.children).toBe('Bike lanes do not improve safety everywhere.');
    const bodyStyle = flatStyle(body.props.style);
    expect(typeof bodyStyle.fontSize).toBe('number');
    expect(bodyStyle.fontSize as number).toBeGreaterThanOrEqual(15);
  });

  it('classifier confidence renders as PIPS, not a digit', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    expect(getByTestId('card-detail-classifier-pips')).toBeTruthy();
  });

  it('the advisory caption is present (advisory, not a verdict)', () => {
    const { getByText, getByTestId } = render(<CardDetailPanel model={model()} />);
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    expect(
      getByText('What the referee noticed — advisory, not a verdict.'),
    ).toBeTruthy();
  });

  it('no rendered string contains a verdict token or snake_case leak (default AND expanded)', () => {
    const { toJSON, getByTestId } = render(
      <CardDetailPanel model={model()} windowWidth={1440} platformOs="web" />,
    );
    // VISUAL-SIMPLIFY-001 — scan the FULL surface: open the expansion so the
    // classifier / mapping / tags strings are included in the walk.
    fireEvent.press(getByTestId('card-detail-more-toggle'));
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
