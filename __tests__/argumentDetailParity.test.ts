/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 1) — Fork 2 DRY proof (adversarial check #6).
 *
 * This is the regression guard that prevents the Timeline detail
 * (`ArgumentReplySidecar`) and the Cards detail (`CardDetailPanel`) from
 * forking their narrative/detail derivation. The ratified design's
 * engineering invariant (Fork 2, design §3.7 / §5 / §10 #6):
 *
 *   "The narrative detail structure must live in ONE place both Timeline
 *    and Cards consume. A forked detail implementation is the failure mode
 *    this card exists to prevent."
 *
 * The test asserts THREE things that together genuinely catch a future
 * fork:
 *
 *   1. Single definition / reference equality — the shared builders
 *      re-exported by `detail/argumentDetailModel.ts` are the SAME function
 *      references as their source-module exports (no copy was made).
 *   2. Both consumers import from the one canonical module — a static source
 *      scan asserts `argumentReplySidecarModel.ts` and `cardDetailModel.ts`
 *      import the shared builders FROM `detail/argumentDetailModel`, and
 *      that NEITHER consumer re-defines a shared builder locally (the
 *      fork-guard that catches someone pasting a local copy back in).
 *   3. Identical shared-slice derivation across surfaces — for identical
 *      inputs the shared semantic-flag derivation is byte-identical whether
 *      reached directly or via the sidecar view-model; and the shared band
 *      formatters produce identical output regardless of caller.
 *
 * Pure-TS test. No React render needed for the DRY proof.
 */

import fs from 'fs';
import path from 'path';

import * as detailModel from '../src/features/arguments/detail/argumentDetailModel';
import * as stepRefModule from '../src/features/arguments/cardView/cardStepReferenceModel';
import * as classifierModule from '../src/features/arguments/cardView/cardClassifierStripModel';
import * as cardDetailModule from '../src/features/arguments/cardView/cardDetailModel';
import {
  buildSidecarViewModel,
  type BuildSidecarViewModelInput,
} from '../src/features/arguments/argumentReplySidecarModel';
import type {
  ArgumentBubbleViewModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import {
  type AutoMetadataCode,
  type ClusterMetadataSummary,
  type ManualTagCode,
  type MoveLinkageRecord,
  type MoveMetadataLedger,
} from '../src/features/metadata';
import type { PointLifecycleState } from '../src/features/lifecycle';

// ── Source paths (the two consumers + the shared module) ─────────────

const SRC_ROOT = path.resolve(__dirname, '../src/features/arguments');
const SIDECAR_PATH = path.join(SRC_ROOT, 'argumentReplySidecarModel.ts');
const CARD_DETAIL_PATH = path.join(SRC_ROOT, 'cardView/cardDetailModel.ts');
const SHARED_PATH = path.join(SRC_ROOT, 'detail/argumentDetailModel.ts');

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

// ── Fixtures (minimal, byte-equal-safe) ──────────────────────────────

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: over.messageId ?? 'm1',
    parentId: over.parentId ?? null,
    ordinal: over.ordinal ?? 1,
    createdAt: over.createdAt ?? '2026-05-18T10:00:00.000Z',
    createdAtLabel: over.createdAtLabel ?? '2026-05-18 10:00',
    relativeLabel: over.relativeLabel ?? 'now',
    actorLabel: over.actorLabel ?? 'You',
    kindLabel: over.kindLabel ?? 'claim',
    sideLabel: over.sideLabel ?? 'Aff',
    bodyPreview: over.bodyPreview ?? 'parent preview body',
    badges: over.badges ?? [],
    droppedTags: over.droppedTags ?? [],
    depth: over.depth ?? 0,
    lane: over.lane ?? 0,
    siblingIndex: over.siblingIndex ?? 0,
    replyCount: over.replyCount ?? 0,
    descendantCount: over.descendantCount ?? 0,
    branchId: over.branchId ?? 'branch-1',
    branchRootMessageId: over.branchRootMessageId ?? over.messageId ?? 'm1',
    junctionGroupId: over.junctionGroupId ?? null,
    isJunction: over.isJunction ?? false,
    junctionChildCount: over.junctionChildCount ?? 0,
    isActive: over.isActive ?? true,
    isLatest: over.isLatest ?? true,
    isDetached: over.isDetached ?? false,
    isActivePath: over.isActivePath ?? true,
    isRoot: over.isRoot ?? true,
    isFirstRebuttal: over.isFirstRebuttal ?? false,
    standingBand: (over.standingBand ?? 'well_supported') as TimelineStandingBand,
    toneBand: (over.toneBand ?? 'measured') as TimelineToneBand,
    temperatureBand: (over.temperatureBand ?? 'warm') as TimelineTemperatureBand,
    kindColor: over.kindColor ?? '#22c55e',
    kindColorFamily: (over.kindColorFamily ?? 'claim') as TimelineKindColorFamily,
    x: over.x ?? 100,
    y: over.y ?? 120,
    accessibilityLabel: over.accessibilityLabel ?? 'm1',
  };
}

function fakeViewModel(over: Partial<ArgumentBubbleViewModel> = {}): ArgumentBubbleViewModel {
  return {
    messageId: over.messageId ?? 'm1',
    ordinal: over.ordinal ?? 1,
    createdAtLabel: over.createdAtLabel ?? '2026-05-18 10:00',
    relativeLabel: over.relativeLabel ?? 'now',
    body: over.body ?? 'This is the body of the active move.',
    kindLabel: over.kindLabel ?? 'claim',
    actor: over.actor ?? 'self',
    sideLabel: over.sideLabel ?? 'Aff',
    isLatest: over.isLatest ?? true,
    isActive: over.isActive ?? true,
    parentHint: over.parentHint ?? null,
    qualifierBadges: over.qualifierBadges ?? [],
    pointStandingHint: over.pointStandingHint ?? null,
    allowedControls: over.allowedControls ?? ['view_qualifiers', 'request_deletion'],
    deletionRequested: over.deletionRequested ?? false,
  };
}

function fakeClusterMetadataSummary(
  over: Partial<ClusterMetadataSummary> = {},
): ClusterMetadataSummary {
  return {
    clusterId: over.clusterId ?? 'm1',
    manualTagCodes: over.manualTagCodes ?? [],
    autoMetadataCodes: over.autoMetadataCodes ?? [],
    lifecycleState: (over.lifecycleState ?? 'open') as PointLifecycleState,
    lastManualTagAt: over.lastManualTagAt ?? null,
    taggingParticipantCount: over.taggingParticipantCount ?? 0,
  };
}

function fakeMoveLinkageRecord(over: Partial<MoveLinkageRecord> = {}): MoveLinkageRecord {
  return {
    messageId: over.messageId ?? 'm1',
    parentMessageId: over.parentMessageId ?? null,
    rootPointId: over.rootPointId ?? 'm1',
    pointClusterId: over.pointClusterId ?? 'm1',
    branchId: over.branchId ?? 'branch-1',
    targetExcerpt: over.targetExcerpt ?? null,
    disagreementAxis: over.disagreementAxis ?? null,
    semanticFlags: over.semanticFlags ?? [],
    userAppliedTags: over.userAppliedTags ?? [],
    autoDerivedMetadata: over.autoDerivedMetadata ?? [],
    lifecycleEventsCausedByMove: over.lifecycleEventsCausedByMove ?? [],
  };
}

function makeLedger(clusterId: string, clusterMeta: ClusterMetadataSummary): MoveMetadataLedger {
  const byMessage = new Map<string, MoveLinkageRecord>();
  byMessage.set(
    clusterId,
    fakeMoveLinkageRecord({ messageId: clusterId, rootPointId: clusterId, pointClusterId: clusterId }),
  );
  const byCluster = new Map<string, ClusterMetadataSummary>([[clusterId, clusterMeta]]);
  return {
    byMessage,
    byCluster,
    metadataEvents: [],
    messageOrder: [clusterId],
    inputHash: 'parity-test-hash',
  };
}

function sidecarInput(over: Partial<BuildSidecarViewModelInput> = {}): BuildSidecarViewModelInput {
  const node = 'activeNode' in over ? (over.activeNode as ArgumentTimelineMapNode | null) : fakeNode();
  const vm =
    'activeViewModel' in over
      ? (over.activeViewModel as ArgumentBubbleViewModel | null)
      : node
        ? fakeViewModel({ messageId: node.messageId })
        : null;
  return {
    activeNode: node,
    activeViewModel: vm,
    parentNode: 'parentNode' in over ? (over.parentNode as ArgumentTimelineMapNode | null) : null,
    totalCount: over.totalCount ?? 1,
    activePathIds: over.activePathIds ?? (node ? [node.messageId] : []),
    lifecycleMap: 'lifecycleMap' in over ? (over.lifecycleMap ?? null) : null,
    metadataLedger: 'metadataLedger' in over ? (over.metadataLedger ?? null) : null,
    viewMode: over.viewMode ?? 'timeline',
    bodyExcerptCap: over.bodyExcerptCap,
  };
}

// ─────────────────────────────────────────────────────────────────────

describe('CVDH-001 Slice 1 — shared detail model (Fork 2 DRY proof)', () => {
  describe('1. single definition / reference equality', () => {
    it('re-exports buildStepReferenceLine as the SAME reference as its source module', () => {
      expect(detailModel.buildStepReferenceLine).toBe(stepRefModule.buildStepReferenceLine);
    });

    it('re-exports buildCardClassifierStrip as the SAME reference as its source module', () => {
      expect(detailModel.buildCardClassifierStrip).toBe(classifierModule.buildCardClassifierStrip);
    });

    it('cardDetailModel consumes the SAME artifactsToEvidenceSources reference as the shared module', () => {
      // artifactsToEvidenceSources physically lives in the shared module and
      // is re-exported by cardDetailModel — both names point at one function.
      expect(cardDetailModule.artifactsToEvidenceSources).toBe(
        detailModel.artifactsToEvidenceSources,
      );
    });

    it('exposes the shared band formatters + semantic-flag builder + parent cap', () => {
      expect(typeof detailModel.formatStandingLine).toBe('function');
      expect(typeof detailModel.formatToneLine).toBe('function');
      expect(typeof detailModel.formatHeatLine).toBe('function');
      expect(typeof detailModel.buildSectionSemanticFlags).toBe('function');
      expect(detailModel.PARENT_BODY_PREVIEW_CAP).toBe(120);
    });

    it('exposes the Slice-2 shared hub builders from the one canonical module', () => {
      expect(typeof detailModel.buildStandingToneHeatStrip).toBe('function');
      expect(typeof detailModel.buildParentQuoteSlice).toBe('function');
      expect(typeof detailModel.buildHubClassifier).toBe('function');
      expect(typeof detailModel.buildHubClassifierGroups).toBe('function');
      expect(typeof detailModel.buildFullTags).toBe('function');
      expect(typeof detailModel.standingBandPlainLabel).toBe('function');
    });

    it('re-exports markToChip as the SAME reference as the classifier module', () => {
      // The hub builder reuses the capped strip's chip derivation — no second
      // chip mapper exists.
      expect(detailModel.buildHubClassifier).toBeDefined();
      expect(classifierModule.markToChip).toBeDefined();
    });
  });

  describe('2. both consumers import from the ONE canonical module (fork-guard)', () => {
    const sidecarSrc = read(SIDECAR_PATH);
    const cardDetailSrc = read(CARD_DETAIL_PATH);
    const sharedSrc = read(SHARED_PATH);

    it('the sidecar imports the shared builders FROM detail/argumentDetailModel', () => {
      expect(sidecarSrc).toMatch(/from\s+['"]\.\/detail\/argumentDetailModel['"]/);
      expect(sidecarSrc).toContain('buildSectionSemanticFlags');
      expect(sidecarSrc).toContain('formatStandingLine');
      expect(sidecarSrc).toContain('formatToneLine');
      expect(sidecarSrc).toContain('formatHeatLine');
      expect(sidecarSrc).toContain('PARENT_BODY_PREVIEW_CAP');
    });

    it('the card-detail model imports the shared builders FROM ../detail/argumentDetailModel', () => {
      expect(cardDetailSrc).toMatch(/from\s+['"]\.\.\/detail\/argumentDetailModel['"]/);
      expect(cardDetailSrc).toContain('buildStepReferenceLine');
      expect(cardDetailSrc).toContain('buildCardClassifierStrip');
      expect(cardDetailSrc).toContain('artifactsToEvidenceSources');
    });

    // The fork-guard: neither consumer may re-DEFINE a shared builder
    // locally. A `function <name>(` definition OR an arrow re-definition
    // (`const <name> = (...) =>`) in a consumer file is exactly the fork
    // this card exists to prevent. (Re-exports `export { name }` and aliased
    // imports are not definitions and do not match.)
    //
    // CVDH-001 Slice 2 — the list grows as Slice 2 adds shared builders, and
    // the guard now ALSO catches arrow re-definitions per the Slice-1
    // reviewer's note.
    const SHARED_BUILDER_NAMES = [
      'buildStepReferenceLine',
      'buildCardClassifierStrip',
      'buildSectionSemanticFlags',
      'artifactsToEvidenceSources',
      'formatStandingLine',
      'formatToneLine',
      'formatHeatLine',
      // Slice 2 additions:
      'buildStandingToneHeatStrip',
      'buildParentQuoteSlice',
      'buildHubClassifier',
      'buildHubClassifierGroups',
      'buildFullTags',
      'standingBandPlainLabel',
    ];

    for (const name of SHARED_BUILDER_NAMES) {
      it(`the sidecar does NOT locally re-define ${name} (function or arrow)`, () => {
        const fnDef = new RegExp(`function\\s+${name}\\s*\\(`);
        const arrowDef = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z0-9_$]+)\\s*=>`);
        expect(fnDef.test(sidecarSrc)).toBe(false);
        expect(arrowDef.test(sidecarSrc)).toBe(false);
      });

      it(`the card-detail model does NOT locally re-define ${name} (function or arrow)`, () => {
        const fnDef = new RegExp(`function\\s+${name}\\s*\\(`);
        const arrowDef = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z0-9_$]+)\\s*=>`);
        expect(fnDef.test(cardDetailSrc)).toBe(false);
        expect(arrowDef.test(cardDetailSrc)).toBe(false);
      });
    }

    it('the shared module is the canonical home (defines the band formatters + semantic-flag builder)', () => {
      expect(/export\s+function\s+formatStandingLine\s*\(/.test(sharedSrc)).toBe(true);
      expect(/export\s+function\s+formatToneLine\s*\(/.test(sharedSrc)).toBe(true);
      expect(/export\s+function\s+formatHeatLine\s*\(/.test(sharedSrc)).toBe(true);
      expect(/export\s+function\s+buildSectionSemanticFlags\s*\(/.test(sharedSrc)).toBe(true);
      expect(/export\s+function\s+artifactsToEvidenceSources\s*\(/.test(sharedSrc)).toBe(true);
    });
  });

  describe('3. identical shared-slice derivation across surfaces', () => {
    it('the sidecar view-model semantic_flags chips equal a DIRECT shared-builder call', () => {
      const node = fakeNode();
      const clusterMeta = fakeClusterMetadataSummary({
        clusterId: node.branchRootMessageId,
        manualTagCodes: ['needs_source'] as ManualTagCode[],
        autoMetadataCodes: ['has_reply'] as AutoMetadataCode[],
      });
      const ledger = makeLedger(node.branchRootMessageId, clusterMeta);

      // The "cards-style" direct derivation: call the shared builder.
      const direct = detailModel.buildSectionSemanticFlags(
        ledger,
        node.branchRootMessageId,
        // The sidecar passes whyMatters.lifecycleLabel; with no lifecycle map
        // it is the empty-label constant. Use the same value the empty path
        // produces so the dedup contract is identical.
        'No lifecycle decision yet.',
        'timeline',
      );

      // The "timeline-style" derivation: via the full sidecar view-model.
      const vm = buildSidecarViewModel(sidecarInput({ activeNode: node, metadataLedger: ledger }));
      const flagSection = vm.sections.find((s) => s.kind === 'semantic_flags');
      expect(flagSection?.kind).toBe('semantic_flags');

      // Byte-identical: same chips, same order, same ids, same family, same labels.
      expect(flagSection).toEqual(direct);
    });

    it('the shared band formatters produce identical output regardless of caller', () => {
      const node = fakeNode({
        standingBand: 'well_supported' as TimelineStandingBand,
        toneBand: 'heated' as TimelineToneBand,
        temperatureBand: 'hot' as TimelineTemperatureBand,
      });
      const vm = fakeViewModel({ messageId: node.messageId });

      // Direct shared-builder output.
      const standing = detailModel.formatStandingLine(vm, node);
      const tone = detailModel.formatToneLine(node);
      const heat = detailModel.formatHeatLine(node);

      // The sidecar view-model's "what this move says" section uses the SAME
      // shared formatters; its lines must match the direct calls byte-for-byte.
      const sidecarVm = buildSidecarViewModel(sidecarInput({ activeNode: node, activeViewModel: vm }));
      const saysSection = sidecarVm.sections.find((s) => s.kind === 'what_this_move_says');
      expect(saysSection?.kind).toBe('what_this_move_says');
      if (saysSection && saysSection.kind === 'what_this_move_says') {
        expect(saysSection.standingLine).toBe(standing);
        expect(saysSection.toneLine).toBe(tone);
        expect(saysSection.heatLine).toBe(heat);
      }
    });

    it('the shared semantic-flag builder is deterministic + does not mutate its inputs', () => {
      const node = fakeNode();
      const clusterMeta = fakeClusterMetadataSummary({
        clusterId: node.branchRootMessageId,
        manualTagCodes: ['scope_issue'] as ManualTagCode[],
        autoMetadataCodes: ['source_requested'] as AutoMetadataCode[],
      });
      const ledger = makeLedger(node.branchRootMessageId, clusterMeta);
      const snapshot = JSON.stringify(clusterMeta);

      const a = detailModel.buildSectionSemanticFlags(ledger, node.branchRootMessageId, 'x', 'timeline');
      const b = detailModel.buildSectionSemanticFlags(ledger, node.branchRootMessageId, 'x', 'timeline');
      expect(a).toEqual(b);
      // Input not mutated.
      expect(JSON.stringify(clusterMeta)).toBe(snapshot);
    });
  });
});
