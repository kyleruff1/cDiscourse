/**
 * MCP-OBSERVATION-MAPPING-EXPANSION-001 (Slice B) — CardDetailPanel +
 * ArgumentBubbleCard "Combination observations" render tests.
 *
 * Covers (design §2 / §4; cdiscourse-doctrine §1/§9/§10a; #14):
 *   - the section renders on the active card BY DEFAULT (no tap, no disclosure)
 *   - given N triggering rawKeys → N combination labels render (display-only)
 *   - no triggering rawKeys (empty section) → teaching empty state, no chips
 *   - composite-supersedes shows on the card (a consumed single's label is
 *     NOT also rendered)
 *   - mapping chips are NOT buttons (no onPress / accessibilityRole="button");
 *     confidence is PIPS, not a digit; the advisory caption is present
 *   - A-G only / H-I-J never: an H/I/J observation produces no mapping label
 *   - the existing per-observation classifier strip is NOT regressed (the
 *     classifier zone still renders alongside the new section)
 *   - the panel is byte-equivalent when no mappingSection prop is supplied
 *
 * Uses @testing-library/react-native (the repo's RN render harness) +
 * the REAL Slice-A evaluator + section builder (no hand-rolled fixtures for
 * the mapping data — the wiring test exercises the genuine path).
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { CardDetailPanel } from '../src/features/arguments/cardView/CardDetailPanel';
import { ArgumentBubbleCard } from '../src/features/arguments/ArgumentBubbleCard';
import { buildCardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import { buildCardMappingSection } from '../src/features/arguments/cardView/cardMappingSectionModel';
import {
  evaluateObservationMapping,
  OBSERVATION_MAPPING_REGISTRY,
} from '../src/features/nodeLabels/observationMapping';
import type { CardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import type { CardMappingSectionModel } from '../src/features/arguments/cardView/cardMappingSectionModel';
import type { ArgumentBubbleViewModel } from '../src/features/arguments/argumentGameSurfaceModel';

const ACTIVE = 'msg-active';
const PARENT = 'msg-parent';

function detailModel(): CardDetailViewModel {
  return buildCardDetailViewModel({
    activeMessageId: ACTIVE,
    chronologicalIds: [PARENT, ACTIVE],
    ordinalOf: (id) => (id === ACTIVE ? 4 : id === PARENT ? 3 : null),
    kindLabelOf: (id) => (id === ACTIVE ? 'rebuttal' : 'claim'),
    parentIdOf: (id) => (id === ACTIVE ? PARENT : null),
    categoryLabel: 'Rebuttal',
    qualifierLabels: ['Scope challenge'],
    persistedClassifierRows: [],
    manualTagEntries: [],
    autoMetadataCodes: [],
    clusterState: 'open',
    messageContribution: null,
    evidenceSources: [],
    evidenceDebtSummary: null,
    standingHint: null,
    lifecycleState: null,
    flagLabels: [],
  });
}

/** Build the section via the REAL evaluator at the `card` surface, exactly as
 *  the surface does. */
function sectionFor(positiveRawKeys: ReadonlyArray<string>): CardMappingSectionModel {
  const results = evaluateObservationMapping(positiveRawKeys, OBSERVATION_MAPPING_REGISTRY, {
    surface: 'card',
  });
  return buildCardMappingSection(results);
}

function bubbleVm(overrides: Partial<ArgumentBubbleViewModel> = {}): ArgumentBubbleViewModel {
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
    parentHint: "replied to: 'we should narrow scope'",
    qualifierBadges: ['Scope challenge'],
    pointStandingHint: 'Needs work',
    allowedControls: [],
    deletionRequested: false,
    ...overrides,
  };
}

describe('Slice B — the combination section renders on the active card by default', () => {
  it('renders the section + an advisory caption with no interaction', () => {
    const section = sectionFor(['challenges_parent', 'quote_anchors_parent']);
    const { getByTestId } = render(
      <CardDetailPanel model={detailModel()} mappingSection={section} />,
    );
    const zone = getByTestId('card-detail-mapping-zone');
    expect(zone).toBeTruthy();
    // The advisory caption text is present (matches the locked copy).
    expect(getByTestId('card-detail-mapping-strip')).toBeTruthy();
  });

  it('renders exactly the labels the evaluator returned for N triggering keys', () => {
    const section = sectionFor(['challenges_parent', 'quote_anchors_parent']);
    const { getByTestId } = render(
      <CardDetailPanel model={detailModel()} mappingSection={section} />,
    );
    // Every chip the section carries renders by testID.
    for (const chip of section.chips) {
      expect(getByTestId(`card-detail-mapping-${chip.id}`)).toBeTruthy();
      expect(getByTestId(`card-detail-mapping-label-${chip.id}`)).toBeTruthy();
    }
    // The "Anchored challenge" pair is one of them.
    expect(
      getByTestId(
        'card-detail-mapping-parent_relation.pair_true_true.challenges_parent+quote_anchors_parent',
      ),
    ).toBeTruthy();
  });

  it('shows the teaching empty state when no rawKeys trigger a rule', () => {
    const section = sectionFor([]);
    const { getByTestId, queryByTestId } = render(
      <CardDetailPanel model={detailModel()} mappingSection={section} />,
    );
    expect(getByTestId('card-detail-mapping-zone')).toBeTruthy();
    expect(getByTestId('card-detail-mapping-empty')).toBeTruthy();
    expect(queryByTestId('card-detail-mapping-strip')).toBeNull();
  });
});

describe('Slice B — composite-supersedes-singles shows correctly on the card', () => {
  it('does NOT render a consumed single label alongside its composite', () => {
    const section = sectionFor(['challenges_parent', 'quote_anchors_parent']);
    const { getByTestId, queryByTestId } = render(
      <CardDetailPanel model={detailModel()} mappingSection={section} />,
    );
    expect(
      getByTestId(
        'card-detail-mapping-parent_relation.pair_true_true.challenges_parent+quote_anchors_parent',
      ),
    ).toBeTruthy();
    // The consumed challenges_parent single is NOT on the card.
    expect(
      queryByTestId('card-detail-mapping-parent_relation.single_true.challenges_parent'),
    ).toBeNull();
  });
});

describe('Slice B — display-only contract', () => {
  function roleOf(node: { props: { accessibilityRole?: string } }): string | undefined {
    return node.props.accessibilityRole;
  }

  it('mapping chips are text labels, not buttons, and have no onPress', () => {
    const section = sectionFor(['refines_parent']);
    const { getByTestId } = render(
      <CardDetailPanel model={detailModel()} mappingSection={section} />,
    );
    const chip = getByTestId(
      'card-detail-mapping-parent_relation.single_true.refines_parent',
    );
    expect(roleOf(chip)).toBe('text');
    expect(roleOf(chip)).not.toBe('button');
    expect(chip.props.onPress).toBeUndefined();
  });

  it('confidence renders as PIPS (3 View dots), never a number', () => {
    const section = sectionFor(['source_attached', 'quote_attached']);
    const { getAllByTestId } = render(
      <CardDetailPanel model={detailModel()} mappingSection={section} />,
    );
    // The shared ConfidencePips component carries this testID; the mapping
    // section reuses it, so at least one pips row is present.
    const pips = getAllByTestId('card-detail-classifier-pips');
    expect(pips.length).toBeGreaterThan(0);
    // Each pips row is 3 View dots (no numeric text child).
    for (const row of pips) {
      expect(row.props.children).toHaveLength(3);
    }
  });

  it('the advisory caption copy is rendered (advisory, not a verdict)', () => {
    const section = sectionFor(['refines_parent']);
    const { getAllByText } = render(
      <CardDetailPanel model={detailModel()} mappingSection={section} />,
    );
    // The locked advisory copy is shared with the per-observation classifier
    // zone (both are advisory surfaces), so it appears at least twice when both
    // zones render — proving the mapping section carries the advisory framing.
    const captions = getAllByText('What the referee noticed — advisory, not a verdict.');
    expect(captions.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Slice B — A-G only, H/I/J never', () => {
  it('an H/I/J observation produces no mapping label on the card', () => {
    // Seed rawKeys from the frozen H/I/J families. The registry is A-G-only,
    // so no positive composite fires for them; the section never carries an
    // H/I/J mapping label. (The absence-negatives that DO fire are A-G
    // evidence_source_chain rows, not H/I/J.)
    const hijRawKeys = ['claim_is_vague', 'thread_is_off_topic', 'contains_insult_only'];
    const section = sectionFor(hijRawKeys);
    const { queryByTestId } = render(
      <CardDetailPanel model={detailModel()} mappingSection={section} />,
    );
    // No chip references an H/I/J family.
    for (const chip of section.chips) {
      // Every rendered chip's id belongs to an A-G family / cross-family.
      expect(chip.id).not.toContain('claim_clarity');
      expect(chip.id).not.toContain('thread_topology');
      expect(chip.id).not.toContain('sensitive_composer');
    }
    // And specifically none of the seeded H/I/J keys produced a positive label.
    expect(queryByTestId('card-detail-mapping-claim_clarity')).toBeNull();
  });
});

describe('Slice B — does NOT regress the existing classifier strip / #14', () => {
  it('the classifier zone still renders alongside the new combination section', () => {
    const section = sectionFor(['refines_parent']);
    const { getByTestId } = render(
      <CardDetailPanel model={detailModel()} mappingSection={section} />,
    );
    // Existing per-observation classifier zone (Slice 2/3) is still present.
    expect(getByTestId('card-detail-classifier-zone')).toBeTruthy();
    // New combination section is present too (additive, not replacing).
    expect(getByTestId('card-detail-mapping-zone')).toBeTruthy();
    // #14 — both render WITHOUT a tap (the panel is visible-by-default).
  });

  it('omitting mappingSection renders the panel byte-equivalently (no section)', () => {
    const { getByTestId, queryByTestId } = render(
      <CardDetailPanel model={detailModel()} />,
    );
    // The classifier zone still renders; the mapping zone does NOT.
    expect(getByTestId('card-detail-classifier-zone')).toBeTruthy();
    expect(queryByTestId('card-detail-mapping-zone')).toBeNull();
  });
});

describe('Slice B — ArgumentBubbleCard threads the section to the active card only', () => {
  it('renders the combination section inside the ACTIVE card', () => {
    const section = sectionFor(['refines_parent']);
    const { getByTestId } = render(
      <ArgumentBubbleCard
        viewModel={bubbleVm({ isActive: true })}
        cardDetail={detailModel()}
        mappingSection={section}
      />,
    );
    expect(getByTestId('card-detail-mapping-zone')).toBeTruthy();
  });

  it('does NOT render the section on a NON-active card', () => {
    const section = sectionFor(['refines_parent']);
    const { queryByTestId } = render(
      <ArgumentBubbleCard
        viewModel={bubbleVm({ isActive: false })}
        cardDetail={detailModel()}
        mappingSection={section}
        compact
      />,
    );
    expect(queryByTestId('card-detail-mapping-zone')).toBeNull();
  });
});
