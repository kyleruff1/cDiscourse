/**
 * UX-MEDIATOR-002 — one-primary-state-chip node markup + Inspect.
 *
 * The core acceptance test for the "collapse the chip soup" card:
 *   - the DEFAULT per-node view renders EXACTLY ONE primary state chip
 *     (`mediator-node-marker-active`); the old second-chip surface
 *     (`NodeLabelStrip`) is NO LONGER mounted in the default view;
 *   - an ordinary open/resolved node carries NO chip (suppression preserved);
 *   - the chip uses the v4 display vocabulary via `v4DisplayStateFor`
 *     (`definition_not_shared` renders "Definition not shared" — renamed by
 *     UX-MEDIATOR-004; the internal code is unchanged);
 *   - a chip-adjacent Inspect caret (O-2) is a 44×44 role=button that opens
 *     the existing Inspect overlay;
 *   - the relocated detail (Observation/Allegation groups + the new mediator
 *     state block) lives in the Inspect overlay — nothing is deleted;
 *   - sensitive composer-only Observations appear on NEITHER the chip NOR
 *     Inspect;
 *   - all rendered strings are ban-list clean.
 *
 * The full `ArgumentGameSurface` is verified by SOURCE-SCAN of its mount tree
 * (the repo pattern for that large, heavily-propped surface; see
 * `argumentGameSurfaceSemanticWiring.test.tsx` /
 * `NodeLabelInspectGroups.test.tsx`); the component behavior is verified by
 * rendering the real `MediatorNodeMarker` + `MediatorNodeInspectDetail` and by
 * exercising the pure `getNodeMediatorMarker` selector + the
 * `computeNodeLabelInspectGroups` feed.
 */
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render } from '@testing-library/react-native';
import { MediatorNodeMarker } from '../src/features/mediator/MediatorNodeMarker';
import { MediatorNodeInspectDetail } from '../src/features/mediator/MediatorNodeInspectDetail';
import { getNodeMediatorMarker } from '../src/features/mediator/nodeMediatorMarkers';
import {
  _forbiddenMediatorTokens,
  helperForMediatorState,
} from '../src/features/mediator';
import type {
  MediatorBoardState,
  MediatorMarkup,
  MediatorStateCode,
} from '../src/features/mediator';
import { computeNodeLabelInspectGroups } from '../src/features/nodeLabels/NodeLabelInspectGroups';

const SURFACE = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'arguments', 'room', 'ArgumentRoom.tsx'),
  'utf8',
);

function makeMarkup(
  p: Partial<MediatorMarkup> & { nodeId: string; primaryState: MediatorStateCode },
): MediatorMarkup {
  return {
    nodeId: p.nodeId,
    pointId: p.pointId ?? p.nodeId,
    primaryState: p.primaryState,
    deviation: p.deviation ?? null,
    evidenceDebtChipStatus: p.evidenceDebtChipStatus ?? null,
    confidence: p.confidence ?? 'medium',
  };
}

function makeBoard(markups: MediatorMarkup[]): MediatorBoardState {
  const markupByNodeId: Record<string, MediatorMarkup> = {};
  for (const m of markups) markupByNodeId[m.nodeId] = m;
  return {
    debateId: 'debate-1',
    points: [],
    markupByNodeId,
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

function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object') return collectText((node as { children?: unknown }).children);
  return [];
}

describe('UX-MEDIATOR-002 — one chip per node by default (mount contract)', () => {
  it('mounts exactly one default-view chip — MediatorNodeMarker — gated on the marker', () => {
    // The default view renders the marker only when there IS a marker.
    expect(SURFACE).toMatch(
      /activeNodeMediatorMarker \?[\s\S]*?<MediatorNodeMarker[\s\S]*?testID="mediator-node-marker-active"/,
    );
  });

  it('does NOT mount NodeLabelStrip in the default view (the second chip surface is gone)', () => {
    // NodeLabelStrip is unmounted AND no longer imported into the surface.
    expect(SURFACE).not.toMatch(/<NodeLabelStrip/);
    expect(SURFACE).not.toMatch(/^\s*NodeLabelStrip,\s*$/m);
  });

  it('selects the chip ONCE from the already-derived board (single-derivation invariant)', () => {
    // The marker is selected in a single memo over `mediatorBoard` and reused.
    expect(SURFACE).toMatch(
      /const activeNodeMediatorMarker = useMemo\(\s*\(\) => getNodeMediatorMarker\(mediatorBoard, activeMessageId\)/,
    );
    // The default chip + the Inspect detail both consume that ONE selection.
    expect(SURFACE).toMatch(/marker=\{activeNodeMediatorMarker\}/);
  });

  it('projects the chip through the v4 display vocabulary (O-1 wired in the selector)', () => {
    const SELECTOR = fs.readFileSync(
      path.join(process.cwd(), 'src', 'features', 'mediator', 'nodeMediatorMarkers.ts'),
      'utf8',
    );
    expect(SELECTOR).toMatch(/import \{ v4DisplayStateFor \}/);
    expect(SELECTOR).toMatch(/v4DisplayStateFor\(best\)/);
  });
});

describe('UX-MEDIATOR-002 — chip-adjacent Inspect caret (O-2)', () => {
  it('renders a role=button caret with a clear label, opening Inspect', () => {
    expect(SURFACE).toMatch(/testID="mediator-node-inspect-caret"/);
    expect(SURFACE).toMatch(/onPress=\{handleNodeChipInspect\}/);
    expect(SURFACE).toMatch(/accessibilityLabel="Inspect this point"/);
    expect(SURFACE).toMatch(/accessibilityRole="button"[\s\S]*?testID="mediator-node-inspect-caret"/);
  });

  it('the caret carries a 44x44 effective target (hitSlop) and an expanded a11y state', () => {
    expect(SURFACE).toMatch(
      /hitSlop=\{\{ top: 12, bottom: 12, left: 12, right: 12 \}\}[\s\S]*?testID="mediator-node-inspect-caret"/,
    );
    expect(SURFACE).toMatch(/accessibilityState=\{\{ expanded: inspectVisible \}\}[\s\S]*?testID="mediator-node-inspect-caret"/);
  });

  it('the caret handler opens the SHIPPED Inspect plumbing (no new global state)', () => {
    expect(SURFACE).toMatch(
      /const handleNodeChipInspect = useCallback\(\(\) => \{\s*setBoardActVisible\(false\);\s*setGoVisible\(false\);\s*setInspectVisible\(true\);/,
    );
  });
});

describe('UX-MEDIATOR-002 — relocated detail lives in the Inspect overlay', () => {
  it('mounts MediatorNodeInspectDetail inside the inspectVisible && activeMessageId gate', () => {
    expect(SURFACE).toMatch(
      /\{inspectVisible && activeMessageId \?[\s\S]*?<MediatorNodeInspectDetail[\s\S]*?testID="mediator-node-inspect-detail-active"/,
    );
  });

  it('still mounts the Observation/Allegation groups overlay (nothing relocated away)', () => {
    expect(SURFACE).toMatch(
      /\{inspectVisible && activeMessageId \?[\s\S]*?<NodeLabelInspectGroups[\s\S]*?testID="ux001-5a-inspect-groups-overlay"/,
    );
  });

  it('the detail block is mounted ABOVE the groups overlay (reasoning first)', () => {
    const detailIdx = SURFACE.indexOf('testID="mediator-node-inspect-detail-active"');
    const groupsIdx = SURFACE.indexOf('testID="ux001-5a-inspect-groups-overlay"');
    expect(detailIdx).toBeGreaterThan(0);
    expect(groupsIdx).toBeGreaterThan(0);
    expect(detailIdx).toBeLessThan(groupsIdx);
  });
});

describe('UX-MEDIATOR-002 — one-chip behavior (rendered)', () => {
  it('an actionable node renders exactly one chip with the v4 label', () => {
    const board = makeBoard([makeMarkup({ nodeId: 'n1', primaryState: 'needs_evidence' })]);
    const marker = getNodeMediatorMarker(board, 'n1');
    const { getByTestId, getByText, queryAllByTestId } = render(
      <MediatorNodeMarker marker={marker} testID="mediator-node-marker-active" />,
    );
    expect(getByTestId('mediator-node-marker-active')).toBeTruthy();
    expect(getByText('Needs evidence')).toBeTruthy();
    // Exactly one marker element rendered.
    expect(queryAllByTestId('mediator-node-marker-active').length).toBe(1);
  });

  it('an ordinary open node carries NO chip (suppressed)', () => {
    const board = makeBoard([makeMarkup({ nodeId: 'n1', primaryState: 'open' })]);
    const marker = getNodeMediatorMarker(board, 'n1');
    expect(marker).toBeNull();
    expect(render(<MediatorNodeMarker marker={marker} />).toJSON()).toBeNull();
  });

  it('a resolved node carries NO chip (suppressed)', () => {
    const board = makeBoard([makeMarkup({ nodeId: 'n1', primaryState: 'resolved_or_settled' })]);
    expect(getNodeMediatorMarker(board, 'n1')).toBeNull();
  });

  it('definition_not_shared renders "Definition not shared" (renamed by UX-MEDIATOR-004)', () => {
    const board = makeBoard([makeMarkup({ nodeId: 'n1', primaryState: 'definition_not_shared' })]);
    const marker = getNodeMediatorMarker(board, 'n1');
    expect(marker?.label).toBe('Definition not shared');
    expect(marker?.label).not.toBe('Definition needed');
    const { getByText } = render(<MediatorNodeMarker marker={marker} />);
    expect(getByText('Definition not shared')).toBeTruthy();
  });
});

describe('UX-MEDIATOR-002 — Inspect detail reveals the preserved mediator reasoning', () => {
  it('renders the state label + helper + next-move pathway for the active node', () => {
    const board = makeBoard([makeMarkup({ nodeId: 'n1', primaryState: 'needs_evidence' })]);
    const marker = getNodeMediatorMarker(board, 'n1');
    const { getByText } = render(
      <MediatorNodeInspectDetail
        marker={marker}
        helper={helperForMediatorState(marker!.code)}
        nextMoveLabel="Provide a source"
      />,
    );
    expect(getByText('Needs evidence')).toBeTruthy();
    // UX-MEDIATOR-003 — needs-evidence helper refined to the person-neutral
    // "This point needs a source or record." structural-obligation copy.
    expect(getByText(helperForMediatorState('needs_evidence'))).toBeTruthy();
    expect(getByText('This point needs a source or record. A source would make this point easier to test.')).toBeTruthy();
    expect(getByText('What would help next: Provide a source')).toBeTruthy();
  });

  it('keeps the Observations/Allegations groups separate and labelled (§10a)', () => {
    // The Inspect groups overlay carries the two distinct headers — the
    // mediator detail block never collapses them into generic "tags".
    const result = computeNodeLabelInspectGroups({
      messageId: 'msg-1',
      manualTagEntries: [
        {
          code: 'needs_source' as never,
          appliedByUserId: 'u1',
          appliedByActorRole: 'participant_affirmative',
          appliedAt: '2026-05-25T12:00:00.000Z',
          dedupeKey: 'needs_source:u1',
        },
      ],
      autoMetadataCodes: ['has_evidence'],
      clusterState: 'rebutted',
      messageContribution: null,
    });
    expect(result.observationCount).toBeGreaterThan(0);
    expect(result.allegationCount).toBeGreaterThan(0);
  });
});

describe('UX-MEDIATOR-002 — nothing deleted (Inspect is uncapped)', () => {
  it('all machine Observations + user Allegations appear in Inspect (N+M > 2)', () => {
    const result = computeNodeLabelInspectGroups({
      messageId: 'msg-1',
      manualTagEntries: [
        { code: 'needs_source' as never, appliedByUserId: 'u1', appliedByActorRole: 'participant_affirmative', appliedAt: '2026-05-25T12:00:00.000Z', dedupeKey: 'needs_source:u1' },
        { code: 'definition_issue' as never, appliedByUserId: 'u1', appliedByActorRole: 'participant_affirmative', appliedAt: '2026-05-25T12:00:00.000Z', dedupeKey: 'definition_issue:u1' },
      ],
      autoMetadataCodes: ['has_evidence', 'has_rebuttal', 'branch_suggested'],
      clusterState: 'rebutted',
      messageContribution: 'sourced',
    });
    // The old timeline strip capped at 1 Observation + 1 Allegation + overflow;
    // Inspect shows everything (no cap).
    expect(result.observationCount).toBeGreaterThanOrEqual(3);
    expect(result.allegationCount).toBe(2);
    expect(result.observationCount + result.allegationCount).toBeGreaterThan(2);
  });
});

describe('UX-MEDIATOR-002 — sensitive Observation reaches NEITHER surface', () => {
  it('the chip never renders a composer-only sensitive observation code', () => {
    // The chip is fed ONLY by the mediator board's structural states — a
    // composer-only sensitive Observation code is not a mediator state, so it
    // is structurally impossible to surface on the chip. Render the full
    // 9 actionable states and assert none reads as a sensitive code.
    const sensitive = [
      'shifts_to_person_or_intent',
      'contains_unplayable_insult_only',
      'needs_pre_send_pause',
    ];
    const states: MediatorStateCode[] = [
      'structured_impasse', 'evidence_blocked', 'needs_evidence',
      'definition_not_shared', 'scope_mismatch', 'missing_mechanism', 'narrowed',
    ];
    for (const state of states) {
      const board = makeBoard([makeMarkup({ nodeId: 'n1', primaryState: state })]);
      const marker = getNodeMediatorMarker(board, 'n1');
      const tree = render(<MediatorNodeMarker marker={marker} />).toJSON();
      for (const text of collectText(tree)) {
        for (const s of sensitive) expect(text).not.toContain(s);
      }
    }
  });

  it('the Inspect overlay excludes composer-only sensitive Observation codes', () => {
    const result = computeNodeLabelInspectGroups({
      messageId: 'msg-1',
      manualTagEntries: [],
      autoMetadataCodes: ['has_evidence', 'has_rebuttal'],
      clusterState: 'rebutted',
      messageContribution: 'sourced',
    });
    for (const desc of [...result.observationDescriptors, ...result.allegationDescriptors]) {
      expect(desc.id).not.toMatch(/shifts_to_person_or_intent/);
      expect(desc.id).not.toMatch(/contains_unplayable_insult_only/);
      expect(desc.id).not.toMatch(/needs_pre_send_pause/);
    }
  });
});

describe('UX-MEDIATOR-002 — labels ban-list clean', () => {
  it('the chip + Inspect detail render no banned tokens and no snake_case', () => {
    const banned = _forbiddenMediatorTokens();
    const states: MediatorStateCode[] = [
      'structured_impasse', 'evidence_blocked', 'needs_evidence',
      'definition_not_shared', 'scope_mismatch', 'missing_mechanism', 'narrowed',
    ];
    for (const state of states) {
      const board = makeBoard([makeMarkup({ nodeId: 'n1', primaryState: state })]);
      const marker = getNodeMediatorMarker(board, 'n1');
      const chip = render(<MediatorNodeMarker marker={marker} />).toJSON();
      const detail = render(
        <MediatorNodeInspectDetail
          marker={marker}
          helper={helperForMediatorState(marker!.code)}
          nextMoveLabel="Provide a source"
        />,
      ).toJSON();
      // UX-MEDIATOR-003 — the blocked-state lead is the operator-locked temporal
      // copy "…not available right now." `right` (verdict) stays banned, but the
      // exact phrase "right now" is neutralized before the scan (temporal, not a
      // verdict; same word, indistinguishable by form).
      const safePhrases = ['right now'];
      for (const text of [...collectText(chip), ...collectText(detail)]) {
        const lower = text.toLowerCase();
        let scrubbed = lower;
        for (const phrase of safePhrases) scrubbed = scrubbed.split(phrase).join('');
        for (const token of banned) expect(scrubbed.includes(token)).toBe(false);
        expect(text).not.toMatch(/^[a-z]+_[a-z_]+$/); // no bare snake_case atom
      }
    }
  });
});
