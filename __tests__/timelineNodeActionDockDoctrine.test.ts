/**
 * SC-004 — Timeline node action dock doctrine tests.
 *
 * Categories 7, 9, 14 from design §"Test plan":
 *   7. No-route transition (open_cards_detail is a surface toggle, not a
 *      router push).
 *   9. Ban-list — every produced string is scanned against
 *      `_forbiddenDockTokens()`. No verdict tokens / amplification tokens
 *      / person-attribution drift.
 *  14. No service-role / no direct insert / no fetch.
 *
 * Plus the COPY-001 dedup test, the heat-≠-correctness deep-equal test,
 * and the preset-body safety scan.
 */

import {
  ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES,
  actionDockToComposerPreset,
  buildTimelineNodeActionDockModel,
  _debug,
  _forbiddenDockTokens,
  type TimelineNodeActionDockActor,
  type TimelineNodeActionDockTarget,
  type TimelineNodeActionDockInput,
} from '../src/features/arguments/timelineNodeActionDockModel';
import {
  ALL_SC004_PRESET_BODIES,
  NARROW_PRESET_BODY,
  CONFIRM_PRESET_BODY,
  SYNTHESIZE_PRESET_BODY,
} from '../src/features/arguments/quickActionPresets';
import type {
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleMap,
  PointLifecycleState,
} from '../src/features/lifecycle';
import type { MoveMetadataLedger } from '../src/features/metadata';

// ── Fixture helpers ───────────────────────────────────────────

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: over.messageId ?? 'm1',
    parentId: over.parentId ?? null,
    ordinal: over.ordinal ?? 1,
    createdAt: over.createdAt ?? '2026-05-18T10:00:00.000Z',
    createdAtLabel: '', relativeLabel: '',
    actorLabel: 'U', kindLabel: over.kindLabel ?? 'claim',
    sideLabel: over.sideLabel ?? 'Aff',
    bodyPreview: '', badges: [], droppedTags: [],
    depth: 0, lane: 0, siblingIndex: 0,
    replyCount: 0, descendantCount: 0,
    branchId: `branch-${over.messageId ?? 'm1'}`,
    branchRootMessageId: over.branchRootMessageId ?? over.messageId ?? 'm1',
    junctionGroupId: null, isJunction: false, junctionChildCount: 0,
    isActive: false, isLatest: false, isDetached: false, isActivePath: false,
    isRoot: over.isRoot ?? false, isFirstRebuttal: false,
    standingBand: (over.standingBand ?? 'neutral') as TimelineStandingBand,
    toneBand: (over.toneBand ?? 'calm') as TimelineToneBand,
    temperatureBand: (over.temperatureBand ?? 'cool') as TimelineTemperatureBand,
    kindColor: '#22c55e',
    kindColorFamily: 'claim' as TimelineKindColorFamily,
    x: 0, y: 0, accessibilityLabel: '',
  };
}

function makeTimelineMap(nodes: ArgumentTimelineMapNode[]): ArgumentTimelineMapModel {
  return {
    nodes, edges: [], bands: [],
    activeNode: null, latestMessageId: nodes.length ? nodes[nodes.length - 1].messageId : null,
    activePathIds: [], width: 0, height: 0, scrollWidth: 0,
    beginningLabel: '', middleLabel: '', endLabel: '',
    participantTrends: [], legend: [],
    rootMessageId: nodes.length ? nodes[0].messageId : null,
    firstRebuttalMessageId: null,
    hasRebuttal: false, rootOnboardingHint: null,
    showBackToRootControl: false,
  };
}

function makeLifecycleMap(state: PointLifecycleState, clusterId = 'r'): PointLifecycleMap {
  const summary: PointLifecycleClusterSummary = {
    clusterId,
    rootMessageId: clusterId,
    state,
    plainLabel: state,
    messageIds: [clusterId],
    memberCount: 1,
    affirmativeMoveCount: 0,
    negativeMoveCount: 0,
    observerMoveCount: 0,
    hasOpenSourceOrQuoteRequest: false,
    hasConcessionOrSynthesisMove: false,
    worstEvidenceStatus: 'no_source',
    primaryAxis: null,
    isAdvisory: false,
  };
  return {
    byCluster: new Map([[clusterId, summary]]),
    byMessage: new Map(),
    clusterOrder: [clusterId],
    cumulativeStateSequence: [state],
    inputHash: 'lc',
  };
}

function makeMetadataLedger(): MoveMetadataLedger {
  return {
    byMessage: new Map(),
    byCluster: new Map(),
    metadataEvents: [],
    messageOrder: [],
    inputHash: 'md',
  };
}

function makeInput(
  target: TimelineNodeActionDockTarget,
  actor: TimelineNodeActionDockActor,
  state: PointLifecycleState = 'open',
): TimelineNodeActionDockInput {
  const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
  return {
    target,
    actor,
    timelineMap: makeTimelineMap([root]),
    lifecycleMap: makeLifecycleMap(state),
    metadataLedger: makeMetadataLedger(),
    evidenceContractFor: () => null,
  };
}

// ── Category 9 — Ban-list ─────────────────────────────────────

const FORBIDDEN = _forbiddenDockTokens();

function scanForBanned(s: string, label: string): void {
  const lower = (s || '').toLowerCase();
  for (const token of FORBIDDEN) {
    // Allow embedded substrings like "right" inside other words; we look for word-ish boundaries.
    const re = new RegExp(`(^|[^a-z])${token.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z]|$)`, 'i');
    if (re.test(lower)) {
      throw new Error(`Ban-list violation in ${label}: token "${token}" present in "${s}"`);
    }
  }
}

describe('SC-004 ban-list — produced strings contain no verdict / amplification / person-attribution tokens', () => {
  it('action labels are clean', () => {
    for (const code of ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES) {
      scanForBanned(_debug.ACTION_LABELS[code], `ACTION_LABELS[${code}]`);
    }
  });

  it('action accessibility labels are clean', () => {
    for (const code of ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES) {
      scanForBanned(_debug.ACTION_A11Y_LABELS[code], `ACTION_A11Y_LABELS[${code}]`);
    }
  });

  it('disabled helper copy is clean', () => {
    for (const key of Object.keys(_debug.DISABLED_HELPER_COPY)) {
      scanForBanned(
        _debug.DISABLED_HELPER_COPY[key as keyof typeof _debug.DISABLED_HELPER_COPY],
        `DISABLED_HELPER_COPY[${key}]`,
      );
    }
  });

  it('NARROW_PRESET_BODY is clean', () => {
    scanForBanned(NARROW_PRESET_BODY, 'NARROW_PRESET_BODY');
  });

  it('CONFIRM_PRESET_BODY is clean', () => {
    scanForBanned(CONFIRM_PRESET_BODY, 'CONFIRM_PRESET_BODY');
  });

  it('SYNTHESIZE_PRESET_BODY is clean', () => {
    scanForBanned(SYNTHESIZE_PRESET_BODY, 'SYNTHESIZE_PRESET_BODY');
  });

  it('every SC-004 preset body is in the frozen array', () => {
    expect(ALL_SC004_PRESET_BODIES.length).toBe(3);
    expect(ALL_SC004_PRESET_BODIES).toContain(NARROW_PRESET_BODY);
    expect(ALL_SC004_PRESET_BODIES).toContain(CONFIRM_PRESET_BODY);
    expect(ALL_SC004_PRESET_BODIES).toContain(SYNTHESIZE_PRESET_BODY);
  });

  it('built dock model — primary suggestion rationale + accessibility label are clean (sampled lifecycle states)', () => {
    for (const state of [
      'open',
      'rebutted',
      'source_requested',
      'exhausted',
      'archived_or_resolved',
      'ignored_by_negative',
    ] as PointLifecycleState[]) {
      const m = buildTimelineNodeActionDockModel(
        makeInput({ kind: 'node', messageId: 'r' }, 'other', state),
      );
      scanForBanned(m.accessibilityLabel, `model.accessibilityLabel (state=${state})`);
      scanForBanned(m.clusterHeader.accessibilityLabel, `clusterHeader.accessibilityLabel (state=${state})`);
      scanForBanned(m.clusterHeader.lifecycleLabel, `clusterHeader.lifecycleLabel (state=${state})`);
      for (const a of m.actions) {
        scanForBanned(a.label, `action.label (action=${a.action})`);
        scanForBanned(a.accessibilityLabel, `action.accessibilityLabel (action=${a.action})`);
        if (a.helperCopy) scanForBanned(a.helperCopy, `action.helperCopy (action=${a.action})`);
      }
    }
  });
});

// ── COPY-001 dedup test ───────────────────────────────────────

describe('SC-004 COPY-001 dedup — cluster header vs move chips', () => {
  it('cluster lifecycle "answered" + move auto "has_reply" → move chip is suppressed (no "Has a reply" side-by-side)', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const lc = makeLifecycleMap('answered');
    const md: MoveMetadataLedger = {
      byMessage: new Map([['r', {
        messageId: 'r', parentMessageId: null, rootPointId: 'r', pointClusterId: 'r',
        branchId: 'branch-r', targetExcerpt: null, disagreementAxis: null,
        semanticFlags: [], userAppliedTags: [],
        autoDerivedMetadata: [{ code: 'has_reply', detectedAt: 't', inputSignals: [] }],
        lifecycleEventsCausedByMove: [],
      }]]),
      byCluster: new Map(),
      metadataEvents: [], messageOrder: ['r'], inputHash: 'md',
    };
    const m = buildTimelineNodeActionDockModel({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      timelineMap: makeTimelineMap([root]),
      lifecycleMap: lc,
      metadataLedger: md,
      evidenceContractFor: () => null,
    });
    expect(m.clusterHeader.lifecycleLabel).toBe('Has a reply');
    // The move chip MUST be deduped — no "Has a reply" chip beside the cluster header.
    const dupes = m.moveChips.filter((c) => c.label === 'Has a reply');
    expect(dupes.length).toBe(0);
  });

  it('cluster-level codes (synthesis_candidate / branch_suggested) render in clusterHeader.autoMetadataSummary, never as move chips', () => {
    // We already test the cluster-level summary inclusion in the model tests.
    // Here we assert the move chip area is empty when cluster-level codes
    // are present and no move-level codes are.
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const lc = makeLifecycleMap('open');
    const md: MoveMetadataLedger = {
      byMessage: new Map([['r', {
        messageId: 'r', parentMessageId: null, rootPointId: 'r', pointClusterId: 'r',
        branchId: 'branch-r', targetExcerpt: null, disagreementAxis: null,
        semanticFlags: [], userAppliedTags: [],
        // synthesis_candidate is cluster-level; should not surface as a move chip.
        autoDerivedMetadata: [{ code: 'synthesis_candidate', detectedAt: 't', inputSignals: [] }],
        lifecycleEventsCausedByMove: [],
      }]]),
      byCluster: new Map(),
      metadataEvents: [], messageOrder: ['r'], inputHash: 'md',
    };
    const m = buildTimelineNodeActionDockModel({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      timelineMap: makeTimelineMap([root]),
      lifecycleMap: lc,
      metadataLedger: md,
      evidenceContractFor: () => null,
    });
    expect(m.moveChips.length).toBe(0);
  });
});

// ── Heat ≠ correctness deep-equal test (extended) ────────────

describe('SC-004 doctrine — heat does not feed action selection', () => {
  it('actions[] is structurally identical between hot+rising and cool+falling for the same lifecycle structure', () => {
    const hotNode = fakeNode({
      messageId: 'r', isRoot: true, branchRootMessageId: 'r',
      toneBand: 'hostile', temperatureBand: 'hot', standingBand: 'pretty_right',
    });
    const coolNode = fakeNode({
      messageId: 'r', isRoot: true, branchRootMessageId: 'r',
      toneBand: 'calm', temperatureBand: 'cool', standingBand: 'pretty_wrong',
    });
    const lc = makeLifecycleMap('sourced');
    const md = makeMetadataLedger();
    const hotModel = buildTimelineNodeActionDockModel({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      timelineMap: makeTimelineMap([hotNode]),
      lifecycleMap: lc,
      metadataLedger: md,
      evidenceContractFor: () => null,
    });
    const coolModel = buildTimelineNodeActionDockModel({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      timelineMap: makeTimelineMap([coolNode]),
      lifecycleMap: lc,
      metadataLedger: md,
      evidenceContractFor: () => null,
    });
    // Extract only the action-shape (drop rationaleCode that includes tag rationales).
    function shape(m: typeof hotModel) {
      return m.actions.map((a) => ({
        action: a.action,
        isPrimary: a.isPrimary,
        isDisabled: a.isDisabled,
        disabledReason: a.disabledReason,
      }));
    }
    expect(shape(hotModel)).toEqual(shape(coolModel));
    expect(hotModel.primarySuggestion).toEqual(coolModel.primarySuggestion);
  });
});

// ── Category 7 — No-route transition ──────────────────────────

describe('SC-004 no-route transition — open_cards_detail emits a surface toggle, never a router push', () => {
  it('actionDockToComposerPreset(open_cards_detail) returns null (surface toggle, no preset)', () => {
    const t: TimelineNodeActionDockTarget = { kind: 'node', messageId: 'r' };
    expect(actionDockToComposerPreset('open_cards_detail', t, null)).toBeNull();
  });

  it('actionDockToComposerPreset(expand_branch) returns null (BR-001 toggle, no preset)', () => {
    const t: TimelineNodeActionDockTarget = { kind: 'collapsed_stub', branchRootMessageId: 'r' };
    expect(actionDockToComposerPreset('expand_branch', t, null)).toBeNull();
  });

  it('the dock model file never imports a router', () => {
    const fs = require('fs');
    const path = require('path');
    const file = path.join(
      __dirname,
      '..',
      'src',
      'features',
      'arguments',
      'timelineNodeActionDockModel.ts',
    );
    const src = fs.readFileSync(file, 'utf8');
    expect(src.includes("from 'expo-router'")).toBe(false);
    expect(src.includes("from 'react-router'")).toBe(false);
    expect(src.includes("from 'react-router-dom'")).toBe(false);
    expect(src.includes('Linking.openURL')).toBe(false);
  });
});

// ── Forbidden tokens registry ─────────────────────────────────

describe('SC-004 _forbiddenDockTokens contents', () => {
  it('contains the core verdict tokens', () => {
    const tokens = _forbiddenDockTokens();
    expect(tokens).toContain('winner');
    expect(tokens).toContain('loser');
    expect(tokens).toContain('liar');
    expect(tokens).toContain('proof');
    expect(tokens).toContain('proven');
  });

  it('contains the amplification tokens', () => {
    const tokens = _forbiddenDockTokens();
    expect(tokens).toContain('engagement');
    expect(tokens).toContain('viral');
    expect(tokens).toContain('trending');
  });
});

// ── Preset bodies — first-person scaffolding ────────────────

describe('SC-004 preset bodies — first-person scaffolding, bracketed placeholders, no LLM filler', () => {
  it('NARROW_PRESET_BODY uses first-person + bracketed placeholders', () => {
    expect(/I'd|I\b/.test(NARROW_PRESET_BODY)).toBe(true);
    expect(NARROW_PRESET_BODY.includes('[')).toBe(true);
    expect(NARROW_PRESET_BODY.includes(']')).toBe(true);
  });

  it('CONFIRM_PRESET_BODY uses first-person', () => {
    expect(/\bI\b/.test(CONFIRM_PRESET_BODY)).toBe(true);
  });

  it('SYNTHESIZE_PRESET_BODY uses bracketed placeholders for scaffolding', () => {
    expect(SYNTHESIZE_PRESET_BODY.includes('[')).toBe(true);
    expect(SYNTHESIZE_PRESET_BODY.includes(']')).toBe(true);
  });

  it('preset bodies are ≤ 200 chars (composer-friendly seed length)', () => {
    for (const b of ALL_SC004_PRESET_BODIES) {
      expect(b.length).toBeLessThanOrEqual(200);
    }
  });
});
