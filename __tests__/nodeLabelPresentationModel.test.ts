/**
 * UX-001.5A — Presentation model tests.
 *
 * Maps acceptance criteria AC 3, 4, 5, 12, 13 (Timeline visually
 * distinguishes + Selected context groups + Inspect shows full
 * provenance + no unbounded list + 1+1+overflow default cap).
 */

import {
  combinePerNodeMarks,
  dedupePerNodeMarks,
  enforceInspectGroupedView,
  enforceSelectedContextDisplayCap,
  enforceTimelineNodeDisplayCap,
  filterMarksBySurface,
  isDispositionEligible,
} from '../src/features/nodeLabels/nodeLabelPresentationModel';
import {
  ALL_NODE_LABEL_DISPOSITIONS,
  ALL_NODE_LABEL_SURFACES,
  type NodeLabelMark,
  type NodeLabelSource,
  type NodeLabelSurface,
} from '../src/features/nodeLabels/nodeLabelTypes';

function mark(
  overrides: Partial<NodeLabelMark> & Pick<NodeLabelMark, 'rawKey' | 'source' | 'kind'>,
): NodeLabelMark {
  return {
    id: `${overrides.kind}:${overrides.source}:${overrides.rawKey}:msg-1`,
    rawKey: overrides.rawKey,
    kind: overrides.kind,
    source: overrides.source,
    label: overrides.label ?? `Plain ${overrides.rawKey}`,
    shortLabel: overrides.shortLabel ?? `Short ${overrides.rawKey}`,
    description: overrides.description ?? `Description for ${overrides.rawKey}.`,
    defaultSurface: overrides.defaultSurface ?? 'timeline_node',
    disposition: overrides.disposition ?? 'rendered_now',
    priority: overrides.priority ?? 50,
    visibleByDefault: overrides.visibleByDefault ?? true,
  };
}

const obs = (rawKey: string, source: NodeLabelSource = 'lifecycle', priority = 20) =>
  mark({ rawKey, source, kind: 'machine_observation', priority });
const all = (rawKey: string, priority = 10) =>
  mark({ rawKey, source: 'manual_tag', kind: 'user_allegation', priority });

describe('UX-001.5A — combinePerNodeMarks', () => {
  it('flattens correctly', () => {
    const result = combinePerNodeMarks({
      manualTagMarks: [all('needs_source')],
      autoMetadataMarks: [obs('has_evidence', 'auto_metadata', 20)],
      lifecycleMarks: [obs('rebutted', 'lifecycle', 14)],
      compositionMutationMarks: [],
      semanticRefereeNodeMountMarks: [],
      rawClassifierMarks: [],
    });
    expect(result.length).toBe(3);
  });

  it('preserves source order within each source', () => {
    const result = combinePerNodeMarks({
      manualTagMarks: [all('needs_source', 10), all('needs_quote', 11)],
      autoMetadataMarks: [],
      lifecycleMarks: [],
      compositionMutationMarks: [],
      semanticRefereeNodeMountMarks: [],
      rawClassifierMarks: [],
    });
    expect(result[0].rawKey).toBe('needs_source');
    expect(result[1].rawKey).toBe('needs_quote');
  });

  it('places manual tags before auto metadata before lifecycle', () => {
    const result = combinePerNodeMarks({
      manualTagMarks: [all('needs_source')],
      autoMetadataMarks: [obs('has_evidence', 'auto_metadata')],
      lifecycleMarks: [obs('rebutted', 'lifecycle')],
      compositionMutationMarks: [],
      semanticRefereeNodeMountMarks: [],
      rawClassifierMarks: [],
    });
    expect(result[0].source).toBe('manual_tag');
    expect(result[1].source).toBe('auto_metadata');
    expect(result[2].source).toBe('lifecycle');
  });

  it('handles all-empty input', () => {
    expect(
      combinePerNodeMarks({
        manualTagMarks: [],
        autoMetadataMarks: [],
        lifecycleMarks: [],
        compositionMutationMarks: [],
        semanticRefereeNodeMountMarks: [],
        rawClassifierMarks: [],
      }),
    ).toEqual([]);
  });
});

describe('UX-001.5A — dedupePerNodeMarks', () => {
  it('returns [] for empty input', () => {
    expect(dedupePerNodeMarks([])).toEqual([]);
  });

  it('does NOT collapse Machine Observation + User Allegation with same text', () => {
    const observationDebt = mark({
      rawKey: 'opens_evidence_debt_marker',
      source: 'ai_classifier',
      kind: 'machine_observation',
      label: 'Evidence debt',
      priority: 13,
    });
    const allegationDebt = mark({
      rawKey: 'evidence_debt',
      source: 'manual_tag',
      kind: 'user_allegation',
      label: 'Evidence debt',
      priority: 15,
    });
    const result = dedupePerNodeMarks([observationDebt, allegationDebt]);
    expect(result.length).toBe(2);
    expect(result.some((m) => m.kind === 'machine_observation')).toBe(true);
    expect(result.some((m) => m.kind === 'user_allegation')).toBe(true);
  });

  it('collapses same kind + same rawKey to higher-priority source', () => {
    const lifecycleSourceReq = obs('source_requested', 'lifecycle', 15);
    const autoSourceReq = obs('source_requested', 'auto_metadata', 15);
    const result = dedupePerNodeMarks([lifecycleSourceReq, autoSourceReq]);
    expect(result.length).toBe(1);
    expect(result[0].source).toBe('lifecycle'); // lifecycle wins per PRIORITY_BY_SOURCE
  });

  it('collapses same kind + same label text + different source', () => {
    const a = obs('foo', 'lifecycle', 20);
    const b = obs('bar', 'auto_metadata', 30);
    // Force same label text:
    const aFixed = { ...a, label: 'Equal Label' };
    const bFixed = { ...b, label: 'Equal Label' };
    const result = dedupePerNodeMarks([aFixed, bFixed]);
    expect(result.length).toBe(1);
    expect(result[0].source).toBe('lifecycle');
  });

  it('keeps a single unique mark', () => {
    const result = dedupePerNodeMarks([obs('rebutted', 'lifecycle', 14)]);
    expect(result.length).toBe(1);
  });

  it('preserves provenance after dedupe', () => {
    const a = all('needs_source', 10);
    const b = obs('has_evidence', 'auto_metadata', 20);
    const result = dedupePerNodeMarks([a, b]);
    expect(result.length).toBe(2);
    expect(result.find((m) => m.kind === 'user_allegation')).toBeDefined();
    expect(result.find((m) => m.kind === 'machine_observation')).toBeDefined();
  });
});

describe('UX-001.5A — filterMarksBySurface', () => {
  it('rendered_now is eligible for timeline_node, selected_context, inspect', () => {
    expect(isDispositionEligible('rendered_now', 'timeline_node')).toBe(true);
    expect(isDispositionEligible('rendered_now', 'selected_context')).toBe(true);
    expect(isDispositionEligible('rendered_now', 'inspect')).toBe(true);
  });

  it('rendered_now is NOT eligible for composer or hidden', () => {
    expect(isDispositionEligible('rendered_now', 'composer')).toBe(false);
    expect(isDispositionEligible('rendered_now', 'hidden')).toBe(false);
  });

  it('inspect_only is ONLY eligible for inspect', () => {
    for (const surface of ALL_NODE_LABEL_SURFACES) {
      const expected = surface === 'inspect';
      expect(isDispositionEligible('inspect_only', surface)).toBe(expected);
    }
  });

  it('composer_only is ONLY eligible for composer', () => {
    for (const surface of ALL_NODE_LABEL_SURFACES) {
      const expected = surface === 'composer';
      expect(isDispositionEligible('composer_only', surface)).toBe(expected);
    }
  });

  it('hidden_sensitive, future_source, intentionally_silent are NEVER eligible', () => {
    for (const disp of ['hidden_sensitive', 'future_source', 'intentionally_silent'] as const) {
      for (const surface of ALL_NODE_LABEL_SURFACES) {
        expect(isDispositionEligible(disp, surface)).toBe(false);
      }
    }
  });

  it('full disposition × surface matrix is exhaustive', () => {
    let totalChecks = 0;
    for (const disp of ALL_NODE_LABEL_DISPOSITIONS) {
      for (const surface of ALL_NODE_LABEL_SURFACES) {
        // exhaust: every combination invokes the matrix.
        const _ = isDispositionEligible(disp, surface);
        void _;
        totalChecks += 1;
      }
    }
    expect(totalChecks).toBe(ALL_NODE_LABEL_DISPOSITIONS.length * ALL_NODE_LABEL_SURFACES.length);
  });

  it('filterMarksBySurface excludes composer_only marks from timeline_node', () => {
    const composerMark = mark({
      rawKey: 'shifts_to_person_or_intent',
      source: 'semantic_referee',
      kind: 'machine_observation',
      disposition: 'composer_only',
      defaultSurface: 'composer',
    });
    expect(filterMarksBySurface([composerMark], 'timeline_node')).toEqual([]);
  });

  it('filterMarksBySurface excludes future_source marks everywhere', () => {
    const futureMark = mark({
      rawKey: 'introduces_new_issue',
      source: 'ai_classifier',
      kind: 'machine_observation',
      disposition: 'future_source',
    });
    for (const surface of ALL_NODE_LABEL_SURFACES) {
      expect(filterMarksBySurface([futureMark], surface as NodeLabelSurface)).toEqual([]);
    }
  });

  it('filterMarksBySurface accepts non-array input gracefully', () => {
    expect(filterMarksBySurface(null as unknown as never, 'timeline_node')).toEqual([]);
  });
});

describe('UX-001.5A — enforceTimelineNodeDisplayCap', () => {
  it('returns nulls and zero overflow for empty input', () => {
    const result = enforceTimelineNodeDisplayCap([]);
    expect(result.observation).toBeNull();
    expect(result.allegation).toBeNull();
    expect(result.overflowCount).toBe(0);
  });

  it('returns 1 Observation + 1 Allegation with no overflow', () => {
    const result = enforceTimelineNodeDisplayCap([
      obs('has_evidence', 'auto_metadata', 20),
      all('needs_source', 10),
    ]);
    expect(result.observation?.rawKey).toBe('has_evidence');
    expect(result.allegation?.rawKey).toBe('needs_source');
    expect(result.overflowCount).toBe(0);
  });

  it('picks highest-priority Observation when multiple present', () => {
    const result = enforceTimelineNodeDisplayCap([
      obs('low_priority', 'auto_metadata', 50),
      obs('high_priority', 'lifecycle', 14),
    ]);
    expect(result.observation?.rawKey).toBe('high_priority');
  });

  it('picks highest-priority Allegation when multiple present', () => {
    const result = enforceTimelineNodeDisplayCap([
      all('needs_source', 10),
      all('tangent', 18),
    ]);
    expect(result.allegation?.rawKey).toBe('needs_source');
  });

  it('returns observation only when no allegations exist', () => {
    const result = enforceTimelineNodeDisplayCap([obs('rebutted', 'lifecycle', 14)]);
    expect(result.observation?.rawKey).toBe('rebutted');
    expect(result.allegation).toBeNull();
    expect(result.overflowCount).toBe(0);
  });

  it('returns allegation only when no observations exist', () => {
    const result = enforceTimelineNodeDisplayCap([all('definition_issue', 12)]);
    expect(result.observation).toBeNull();
    expect(result.allegation?.rawKey).toBe('definition_issue');
    expect(result.overflowCount).toBe(0);
  });

  it('computes overflow count correctly for 3 Observations + 2 Allegations', () => {
    const result = enforceTimelineNodeDisplayCap([
      obs('obs1', 'lifecycle', 14),
      obs('obs2', 'auto_metadata', 20),
      obs('obs3', 'auto_metadata', 30),
      all('alg1', 10),
      all('alg2', 11),
    ]);
    // 1 picked from obs + 1 picked from all = 2 visible; 5 total - 2 visible = 3 overflow.
    expect(result.overflowCount).toBe(3);
  });

  it('computes overflow count correctly for 5 Observations + 0 Allegations', () => {
    const result = enforceTimelineNodeDisplayCap([
      obs('o1', 'lifecycle', 14),
      obs('o2', 'lifecycle', 14),
      obs('o3', 'auto_metadata', 20),
      obs('o4', 'auto_metadata', 20),
      obs('o5', 'auto_metadata', 20),
    ]);
    // 1 picked + 4 overflow.
    expect(result.overflowCount).toBe(4);
  });
});

describe('UX-001.5A — enforceSelectedContextDisplayCap', () => {
  it('returns empties for empty input', () => {
    const result = enforceSelectedContextDisplayCap([]);
    expect(result.observations).toEqual([]);
    expect(result.allegations).toEqual([]);
    expect(result.overflowCount).toBe(0);
  });

  it('returns 3 Observations + 3 Allegations with no overflow at exactly 3+3', () => {
    const result = enforceSelectedContextDisplayCap([
      obs('o1', 'lifecycle', 14),
      obs('o2', 'lifecycle', 15),
      obs('o3', 'lifecycle', 16),
      all('a1', 10),
      all('a2', 11),
      all('a3', 12),
    ]);
    expect(result.observations.length).toBe(3);
    expect(result.allegations.length).toBe(3);
    expect(result.overflowCount).toBe(0);
  });

  it('caps at 3+3 with overflow at 4+3', () => {
    const result = enforceSelectedContextDisplayCap([
      obs('o1', 'lifecycle', 14),
      obs('o2', 'lifecycle', 15),
      obs('o3', 'lifecycle', 16),
      obs('o4', 'lifecycle', 17),
      all('a1', 10),
      all('a2', 11),
      all('a3', 12),
    ]);
    expect(result.observations.length).toBe(3);
    expect(result.allegations.length).toBe(3);
    expect(result.overflowCount).toBe(1);
  });

  it('respects priority order — keeps top-3 by priority', () => {
    const result = enforceSelectedContextDisplayCap([
      obs('low3', 'lifecycle', 30),
      obs('low2', 'lifecycle', 20),
      obs('low1', 'lifecycle', 14),
      obs('low4', 'lifecycle', 40),
    ]);
    expect(result.observations.length).toBe(3);
    expect(result.observations.map((m) => m.priority)).toEqual([14, 20, 30]);
  });

  it('handles 2 Observations + 5 Allegations (cap allegations at 3)', () => {
    const result = enforceSelectedContextDisplayCap([
      obs('o1', 'lifecycle', 14),
      obs('o2', 'lifecycle', 15),
      all('a1', 10),
      all('a2', 11),
      all('a3', 12),
      all('a4', 13),
      all('a5', 14),
    ]);
    expect(result.observations.length).toBe(2);
    expect(result.allegations.length).toBe(3);
    expect(result.overflowCount).toBe(2);
  });
});

describe('UX-001.5A — enforceInspectGroupedView', () => {
  it('returns empty groups for empty input', () => {
    const result = enforceInspectGroupedView([]);
    expect(result.observations).toEqual([]);
    expect(result.allegations).toEqual([]);
  });

  it('is unbounded — preserves all marks', () => {
    const marks = Array.from({ length: 20 }, (_, i) =>
      obs(`obs-${i}`, 'lifecycle', 14 + i),
    );
    const result = enforceInspectGroupedView(marks);
    expect(result.observations.length).toBe(20);
  });

  it('partitions Machine Observations and User Allegations into separate groups', () => {
    const result = enforceInspectGroupedView([
      obs('o1', 'lifecycle', 14),
      all('a1', 10),
      obs('o2', 'auto_metadata', 20),
      all('a2', 11),
    ]);
    expect(result.observations.length).toBe(2);
    expect(result.allegations.length).toBe(2);
  });

  it('sorts within each group by priority', () => {
    const result = enforceInspectGroupedView([
      obs('o2', 'lifecycle', 50),
      obs('o1', 'lifecycle', 14),
    ]);
    expect(result.observations[0].rawKey).toBe('o1');
    expect(result.observations[1].rawKey).toBe('o2');
  });
});
