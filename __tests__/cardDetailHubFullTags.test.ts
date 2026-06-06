/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 2, ask ii) — full semantic tags.
 *
 * Covers the design's §6.6 + OQ-ii:
 *   - manual + auto + structural + status tags surfaced
 *   - grouped by the §10a doctrine categories (Observations / Allegations /
 *     structural labels / status chips)
 *   - unknown codes suppressed (no snake_case leak)
 *   - parity with the sidecar chip labels (the SAME shared
 *     `buildSectionSemanticFlags` derivation feeds both surfaces)
 *
 * Pure-model test. No React, no Supabase.
 */

import {
  buildFullTags,
  buildSectionSemanticFlags,
  FULL_TAGS_GROUP_HEADING,
  type DetailSemanticFlagsSection,
} from '../src/features/arguments/detail/argumentDetailModel';
import { buildCardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import type {
  ClusterMetadataSummary,
  ManualTagCode,
  AutoMetadataCode,
  MoveLinkageRecord,
  MoveMetadataLedger,
} from '../src/features/metadata';
import type { PointLifecycleState } from '../src/features/lifecycle';

const CLUSTER = 'cluster-1';

function clusterMeta(over: Partial<ClusterMetadataSummary> = {}): ClusterMetadataSummary {
  return {
    clusterId: over.clusterId ?? CLUSTER,
    manualTagCodes: over.manualTagCodes ?? [],
    autoMetadataCodes: over.autoMetadataCodes ?? [],
    lifecycleState: (over.lifecycleState ?? 'open') as PointLifecycleState,
    lastManualTagAt: over.lastManualTagAt ?? null,
    taggingParticipantCount: over.taggingParticipantCount ?? 0,
  };
}

function moveLinkage(over: Partial<MoveLinkageRecord> = {}): MoveLinkageRecord {
  return {
    messageId: over.messageId ?? CLUSTER,
    parentMessageId: over.parentMessageId ?? null,
    rootPointId: over.rootPointId ?? CLUSTER,
    pointClusterId: over.pointClusterId ?? CLUSTER,
    branchId: over.branchId ?? 'branch-1',
    targetExcerpt: over.targetExcerpt ?? null,
    disagreementAxis: over.disagreementAxis ?? null,
    semanticFlags: over.semanticFlags ?? [],
    userAppliedTags: over.userAppliedTags ?? [],
    autoDerivedMetadata: over.autoDerivedMetadata ?? [],
    lifecycleEventsCausedByMove: over.lifecycleEventsCausedByMove ?? [],
  };
}

function ledger(meta: ClusterMetadataSummary): MoveMetadataLedger {
  return {
    byMessage: new Map<string, MoveLinkageRecord>([[CLUSTER, moveLinkage()]]),
    byCluster: new Map<string, ClusterMetadataSummary>([[CLUSTER, meta]]),
    metadataEvents: [],
    messageOrder: [CLUSTER],
    inputHash: 'full-tags-test',
  };
}

function sectionFor(
  meta: ClusterMetadataSummary,
  lifecycleLabel = 'No lifecycle decision yet.',
): DetailSemanticFlagsSection {
  return buildSectionSemanticFlags(ledger(meta), CLUSTER, lifecycleLabel, 'stack');
}

describe('CVDH-001 Slice 2 — buildFullTags grouping (OQ-ii)', () => {
  it('splits Observations (auto) from Allegations (manual) per §10a', () => {
    const meta = clusterMeta({
      manualTagCodes: ['needs_source'] as ManualTagCode[],
      autoMetadataCodes: ['has_evidence'] as AutoMetadataCode[],
    });
    const section = sectionFor(meta);
    const model = buildFullTags({
      semanticFlags: section,
      structuralLabels: [],
      statusLabels: [],
    });
    const observations = model.groups.find((g) => g.groupCode === 'observations');
    const allegations = model.groups.find((g) => g.groupCode === 'allegations');
    expect(observations).toBeDefined();
    expect(allegations).toBeDefined();
    expect(observations?.groupLabel).toBe(FULL_TAGS_GROUP_HEADING.observations);
    expect(allegations?.groupLabel).toBe(FULL_TAGS_GROUP_HEADING.allegations);
    // Allegation (manual) is the participant-applied "needs source" tag.
    expect(allegations?.tags.length).toBeGreaterThanOrEqual(1);
    expect(observations?.tags.length).toBeGreaterThanOrEqual(1);
  });

  it('surfaces structural + status groups when present', () => {
    const meta = clusterMeta({});
    const model = buildFullTags({
      semanticFlags: sectionFor(meta),
      structuralLabels: ['Side branch'],
      statusLabels: ['Rebuttal', 'Source attached'],
    });
    const structural = model.groups.find((g) => g.groupCode === 'structural');
    const status = model.groups.find((g) => g.groupCode === 'status');
    expect(structural?.tags.map((t) => t.label)).toEqual(['Side branch']);
    expect(status?.tags.map((t) => t.label)).toEqual(['Rebuttal', 'Source attached']);
  });

  it('groups are ordered Observations → Allegations → Structural → Status', () => {
    const meta = clusterMeta({
      manualTagCodes: ['needs_source'] as ManualTagCode[],
      autoMetadataCodes: ['has_evidence'] as AutoMetadataCode[],
    });
    const model = buildFullTags({
      semanticFlags: sectionFor(meta),
      structuralLabels: ['Side branch'],
      statusLabels: ['Rebuttal'],
    });
    expect(model.groups.map((g) => g.groupCode)).toEqual([
      'observations',
      'allegations',
      'structural',
      'status',
    ]);
  });

  it('no tags → empty model with a teaching empty state (not a verdict)', () => {
    const model = buildFullTags({
      semanticFlags: sectionFor(clusterMeta({})),
      structuralLabels: [],
      statusLabels: [],
    });
    expect(model.hasTags).toBe(false);
    expect(model.groups).toHaveLength(0);
    expect(model.emptyStateCopy.toLowerCase()).not.toContain('no issues');
  });

  it('dedupes + drops empty structural/status labels', () => {
    const model = buildFullTags({
      semanticFlags: sectionFor(clusterMeta({})),
      structuralLabels: ['Side branch', 'Side branch', '  ', ''],
      statusLabels: ['Open', 'Open'],
    });
    const structural = model.groups.find((g) => g.groupCode === 'structural');
    const status = model.groups.find((g) => g.groupCode === 'status');
    expect(structural?.tags.map((t) => t.label)).toEqual(['Side branch']);
    expect(status?.tags.map((t) => t.label)).toEqual(['Open']);
  });

  it('emits no snake_case internal-code leak in any rendered label', () => {
    const meta = clusterMeta({
      manualTagCodes: ['needs_source', 'scope_issue'] as ManualTagCode[],
      autoMetadataCodes: ['has_evidence', 'source_attached'] as AutoMetadataCode[],
    });
    const model = buildFullTags({
      semanticFlags: sectionFor(meta),
      structuralLabels: ['Side branch'],
      statusLabels: ['Rebuttal'],
    });
    for (const group of model.groups) {
      // Group heading is plain-language.
      expect(group.groupLabel).not.toMatch(/[a-z]+_[a-z]+/);
      for (const tag of group.tags) {
        // The rendered LABEL is plain-language; the id may be snake_case but
        // it is never rendered.
        expect(tag.label).not.toMatch(/[a-z]+_[a-z]+/);
      }
    }
  });
});

describe('CVDH-001 Slice 2 — parity with the sidecar chip labels', () => {
  it('the full-tags Observation/Allegation labels equal the shared chip labels', () => {
    const meta = clusterMeta({
      manualTagCodes: ['needs_source'] as ManualTagCode[],
      autoMetadataCodes: ['has_evidence', 'source_attached'] as AutoMetadataCode[],
    });
    const section = sectionFor(meta);
    const model = buildFullTags({
      semanticFlags: section,
      structuralLabels: [],
      statusLabels: [],
    });
    const fullTagLabels = model.groups
      .filter((g) => g.groupCode === 'observations' || g.groupCode === 'allegations')
      .flatMap((g) => g.tags.map((t) => t.label))
      .sort();
    const chipLabels = section.chips.map((c) => c.label).sort();
    expect(fullTagLabels).toEqual(chipLabels);
  });
});

describe('CVDH-001 Slice 2 — buildCardDetailViewModel folds the full tags + status', () => {
  it('the card detail surfaces a status group from category + lifecycle', () => {
    const m = buildCardDetailViewModel({
      activeMessageId: 'm-active',
      chronologicalIds: ['m-active'],
      ordinalOf: () => 1,
      kindLabelOf: () => 'claim',
      parentIdOf: () => null,
      categoryLabel: 'Rebuttal',
      qualifierLabels: [],
      persistedClassifierRows: [],
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'sourced',
      messageContribution: null,
      evidenceSources: [],
      evidenceDebtSummary: null,
      standingHint: null,
      lifecycleState: 'sourced',
      flagLabels: [],
      structuralTagLabels: ['Side branch'],
    });
    expect(m.fullTags.hasTags).toBe(true);
    const status = m.fullTags.groups.find((g) => g.groupCode === 'status');
    // Category ("Rebuttal") + lifecycle plain label ("Source attached").
    expect(status?.tags.map((t) => t.label)).toEqual(['Rebuttal', 'Source attached']);
    const structural = m.fullTags.groups.find((g) => g.groupCode === 'structural');
    expect(structural?.tags.map((t) => t.label)).toEqual(['Side branch']);
  });
});
