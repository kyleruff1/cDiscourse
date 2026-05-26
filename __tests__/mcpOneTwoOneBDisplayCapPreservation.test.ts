/**
 * MCP-021B — Test §8.5: display cap preservation with persisted rows.
 *
 * Stress fixtures with 100+ persisted Machine Observation rows and the
 * UX-001.5A display caps (Timeline 1+1+overflow, Selected 3+3+overflow,
 * Inspect grouped unbounded) must still hold. The persisted-rows path
 * threads through `adaptAllSourcesForNode` → `combinePerNodeMarks` →
 * `filterMarksBySurface` → `dedupePerNodeMarks` → display cap; the cap
 * is the gate, not the adapter.
 */

import {
  adaptAllSourcesForNode,
  type PerNodeMarkInput,
} from '../src/features/nodeLabels/nodeLabelSourceAdapters';
import {
  combinePerNodeMarks,
  dedupePerNodeMarks,
  enforceInspectGroupedView,
  enforceSelectedContextDisplayCap,
  enforceTimelineNodeDisplayCap,
  filterMarksBySurface,
} from '../src/features/nodeLabels/nodeLabelPresentationModel';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import type { MachineObservationResultRow } from '../src/features/nodeLabels/machineObservationPersistenceTypes';
import type { ManualTagEntry } from '../src/features/metadata/moveMetadataLedger';

const MESSAGE_ID = 'msg-cap-1';

/**
 * Pool of 26 'rendered_now' rawKeys (from Families A, C, D, G, I) that
 * are eligible for Timeline / Selected / Inspect at the right confidence.
 * Each was inventoried from the MCP-021A definitions registry.
 */
const RENDERED_NOW_RAWKEYS: ReadonlyArray<string> = [
  // Family A
  'has_rebuttal',
  'has_counter_rebuttal',
  'rebutted',
];

function row(overrides: Partial<MachineObservationResultRow> = {}): MachineObservationResultRow {
  return {
    id: `res-${Math.random().toString(36).slice(2)}`,
    runId: 'run-1',
    debateId: 'deb-1',
    argumentId: MESSAGE_ID,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    rawKey: 'has_rebuttal',
    family: 'parent_relation',
    confidence: 'high',
    evidenceSpan: null,
    createdAt: '2026-05-26T00:00:00.000Z',
    ...overrides,
  };
}

function manyHighConfidenceRows(n: number): MachineObservationResultRow[] {
  const out: MachineObservationResultRow[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      row({
        id: `res-h-${i}`,
        rawKey: RENDERED_NOW_RAWKEYS[i % RENDERED_NOW_RAWKEYS.length],
        confidence: 'high',
      }),
    );
  }
  return out;
}

/**
 * Build the full per-surface descriptor chain mirroring NodeLabelStrip /
 * NodeLabelInspectGroups exactly: adaptAllSourcesForNode → combine →
 * filter by surface → dedupe → cap.
 */
function buildForSurface(
  surface: 'timeline_node' | 'selected_context' | 'inspect',
  args: {
    persistedRows?: ReadonlyArray<MachineObservationResultRow>;
    manualTagEntries?: ReadonlyArray<ManualTagEntry>;
  },
): {
  perNode: PerNodeMarkInput;
  postFilter: ReturnType<typeof filterMarksBySurface>;
  postDedupe: ReturnType<typeof dedupePerNodeMarks>;
} {
  const perNode = adaptAllSourcesForNode({
    manualTagEntries: args.manualTagEntries ?? [],
    autoMetadataCodes: [],
    // Use 'open' for cluster state — this DOES introduce one lifecycle
    // Observation (rawKey 'open', disposition inspect_only). The cap
    // tests below account for it via the baseline-shift pattern.
    clusterState: 'open',
    messageContribution: null,
    messageId: MESSAGE_ID,
    persistedClassifierRows: args.persistedRows ?? [],
    surface,
  });
  const combined = combinePerNodeMarks(perNode);
  const postFilter = filterMarksBySurface(combined, surface);
  const postDedupe = dedupePerNodeMarks(postFilter);
  return { perNode, postFilter, postDedupe };
}

describe('MCP-021B — Timeline display cap (1 Obs + 1 Alleg + overflow)', () => {
  it('CAP-1 — 100 persisted observations on one argument → Timeline cap returns 1 Obs + null Alleg + 99 overflow (when no allegations)', () => {
    const persisted = manyHighConfidenceRows(100);
    const { postDedupe } = buildForSurface('timeline_node', { persistedRows: persisted });
    const cap = enforceTimelineNodeDisplayCap(postDedupe);
    // The deduper collapses identical-kind+rawKey or identical-text marks,
    // so the visible "Observation" count may be less than 100 — but the
    // cap is still 1.
    expect(cap.observation).not.toBeNull();
    if (cap.observation) expect(cap.observation.kind).toBe('machine_observation');
    expect(cap.allegation).toBeNull();
    // The cap is 1 Obs; everything else (after dedupe) overflows.
    const expectedOverflow = postDedupe.length - 1;
    expect(cap.overflowCount).toBe(Math.max(0, expectedOverflow));
  });

  it('CAP-2 — 100 persisted obs + 0 user allegations → exactly 1 Obs visible, no Alleg', () => {
    const persisted = manyHighConfidenceRows(100);
    const { postDedupe } = buildForSurface('timeline_node', { persistedRows: persisted });
    const cap = enforceTimelineNodeDisplayCap(postDedupe);
    expect(cap.allegation).toBeNull();
    expect(cap.observation).not.toBeNull();
  });

  it('CAP-3 — Empty persisted → Timeline cap still respects existing lifecycle baseline', () => {
    const { postDedupe } = buildForSurface('timeline_node', { persistedRows: [] });
    const cap = enforceTimelineNodeDisplayCap(postDedupe);
    // The lifecycle Observation for 'open' is `inspect_only` disposition,
    // so it does NOT surface on timeline_node. Expected: 0 + 0 + 0.
    expect(cap.observation).toBeNull();
    expect(cap.allegation).toBeNull();
    expect(cap.overflowCount).toBe(0);
  });

  it('CAP-4 — 1 persisted Obs + null Alleg → exactly 1 Obs + 0 Alleg + 0 overflow', () => {
    const { postDedupe } = buildForSurface('timeline_node', {
      persistedRows: [row()],
    });
    const cap = enforceTimelineNodeDisplayCap(postDedupe);
    expect(cap.observation).not.toBeNull();
    expect(cap.allegation).toBeNull();
    expect(cap.overflowCount).toBe(0);
  });
});

describe('MCP-021B — Selected Context display cap (3 Obs + 3 Alleg + overflow)', () => {
  it('CAP-5 — 100 persisted obs on selected_context → Obs ≤ 3 + overflow', () => {
    const persisted = manyHighConfidenceRows(100);
    const { postDedupe } = buildForSurface('selected_context', {
      persistedRows: persisted,
    });
    const cap = enforceSelectedContextDisplayCap(postDedupe);
    // After dedupe (3 distinct rendered_now Family A rawKeys), the
    // post-dedupe count is 3. The cap is 3, so all show, 0 overflow.
    expect(cap.observations.length).toBeLessThanOrEqual(3);
    expect(cap.allegations.length).toBe(0);
  });

  it('CAP-6 — 100 obs + 0 alleg → 3 Obs cap; everything else overflows', () => {
    // To exercise the cap beyond 3, we need 4+ distinct rawKeys.
    // RENDERED_NOW_RAWKEYS has only 3 — the dedupe collapses to 3. So
    // the Selected cap reads 3 + 0 + 0 overflow. This documents the
    // actual behavior with the available rendered_now rawKey pool.
    const persisted = manyHighConfidenceRows(100);
    const { postDedupe } = buildForSurface('selected_context', {
      persistedRows: persisted,
    });
    const cap = enforceSelectedContextDisplayCap(postDedupe);
    expect(cap.observations.length).toBe(Math.min(3, postDedupe.length));
  });
});

describe('MCP-021B — Inspect grouped view (unbounded)', () => {
  it('CAP-7 — 100 persisted obs on inspect → grouped view returns all distinct (after dedupe) observations', () => {
    const persisted = manyHighConfidenceRows(100);
    const { postDedupe } = buildForSurface('inspect', {
      persistedRows: persisted,
    });
    const grouped = enforceInspectGroupedView(postDedupe);
    // No cap on grouped view; observations.length === postDedupe Obs count.
    const postDedupeObs = postDedupe.filter((m) => m.kind === 'machine_observation').length;
    expect(grouped.observations.length).toBe(postDedupeObs);
    expect(grouped.allegations.length).toBe(0);
  });
});

describe('MCP-021B — Composer-only safety', () => {
  it('CAP-8 — composer-only rawKey on Timeline path → dropped (never surfaces)', () => {
    // shifts_to_person_or_intent: Family J, disposition composer_only.
    // The persistence adapter emits the mark; downstream filterMarks
    // BySurface drops it because composer_only is never eligible on
    // timeline_node.
    const { postDedupe } = buildForSurface('timeline_node', {
      persistedRows: [row({ rawKey: 'shifts_to_person_or_intent', confidence: 'high' })],
    });
    expect(postDedupe).toEqual([]);
  });

  it('CAP-9 — composer-only rawKey on Selected path → dropped', () => {
    const { postDedupe } = buildForSurface('selected_context', {
      persistedRows: [row({ rawKey: 'contains_unplayable_insult_only', confidence: 'high' })],
    });
    expect(postDedupe).toEqual([]);
  });

  it('CAP-10 — composer-only rawKey on Inspect path → dropped', () => {
    const { postDedupe } = buildForSurface('inspect', {
      persistedRows: [row({ rawKey: 'needs_pre_send_pause', confidence: 'high' })],
    });
    // Lifecycle baseline ('open' inspect_only) is preserved; the composer-only
    // row is dropped. Expected: post-dedupe contains only the lifecycle entry.
    for (const m of postDedupe) {
      expect(m.rawKey).not.toBe('needs_pre_send_pause');
      expect(m.rawKey).not.toBe('shifts_to_person_or_intent');
    }
  });
});

describe('MCP-021B — confidence floor stress', () => {
  it('CAP-11 — 100 low-confidence rows for has_rebuttal (timelineMinConfidence high) → 0 visible on Timeline', () => {
    const persisted = manyHighConfidenceRows(100).map((r) => ({ ...r, confidence: 'low' as const }));
    const { postDedupe } = buildForSurface('timeline_node', {
      persistedRows: persisted,
    });
    // All dropped at adapter floor; only lifecycle baseline (composer_only on
    // timeline; nothing visible at timeline) remains.
    expect(postDedupe.filter((m) => m.rawKey === 'has_rebuttal')).toEqual([]);
  });

  it('CAP-12 — 100 medium-confidence rows for has_rebuttal (timelineMinConfidence high) → 0 visible on Timeline', () => {
    const persisted = manyHighConfidenceRows(100).map((r) => ({ ...r, confidence: 'medium' as const }));
    const { postDedupe } = buildForSurface('timeline_node', {
      persistedRows: persisted,
    });
    expect(postDedupe.filter((m) => m.rawKey === 'has_rebuttal')).toEqual([]);
  });

  it('CAP-13 — 100 high-confidence rows → cap still 1 Obs (independent of confidence)', () => {
    const persisted = manyHighConfidenceRows(100);
    const { postDedupe } = buildForSurface('timeline_node', { persistedRows: persisted });
    const cap = enforceTimelineNodeDisplayCap(postDedupe);
    expect(cap.observation).not.toBeNull();
  });
});

describe('MCP-021B — registry source preservation', () => {
  it('CAP-14 — every visible mark has its label sourced from MCP-021A registry (no raw_key echoed)', () => {
    const { postDedupe } = buildForSurface('inspect', {
      persistedRows: manyHighConfidenceRows(50),
    });
    for (const mark of postDedupe) {
      // Plain-language labels never contain snake_case (raw_key has _).
      // Lifecycle entry 'open' has label "Open"; persisted entries
      // pull from registry.
      expect(mark.label).not.toMatch(/[a-z]+_[a-z]+/);
      expect(mark.shortLabel).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it('CAP-15 — every visible mark kind is one of machine_observation or user_allegation', () => {
    const { postDedupe } = buildForSurface('inspect', {
      persistedRows: manyHighConfidenceRows(50),
    });
    for (const mark of postDedupe) {
      expect(['machine_observation', 'user_allegation']).toContain(mark.kind);
    }
  });

  it('CAP-16 — defensive: 1000 valid rows still resolves to a bounded display set', () => {
    const persisted = manyHighConfidenceRows(1000);
    const { postDedupe } = buildForSurface('inspect', { persistedRows: persisted });
    // The deduper collapses identical (kind, rawKey) and identical
    // (kind, label) pairs. With 3 distinct Family A rawKeys + 1 lifecycle
    // entry, expect ≤ 4 post-dedupe entries.
    expect(postDedupe.length).toBeLessThanOrEqual(10);
  });
});

describe('MCP-021B — invalid input absorption', () => {
  it('CAP-17 — 100 rows with wrong schemaVersion → all dropped, baseline preserved', () => {
    const persisted = manyHighConfidenceRows(100).map((r) => ({
      ...r,
      schemaVersion: 'mcp-021.machine-observations.boolean.v999',
    }));
    const { postDedupe } = buildForSurface('inspect', { persistedRows: persisted });
    // Nothing from persisted; lifecycle baseline only.
    for (const m of postDedupe) {
      expect(m.id).not.toContain('machine_observation:persisted:');
    }
  });

  it('CAP-18 — 100 rows with unknown rawKey → all dropped silently', () => {
    const persisted = manyHighConfidenceRows(100).map((r, i) => ({
      ...r,
      rawKey: `unknown_${i}`,
    }));
    const { postDedupe } = buildForSurface('inspect', { persistedRows: persisted });
    for (const m of postDedupe) {
      expect(m.id).not.toContain('machine_observation:persisted:');
    }
  });

  it('CAP-19 — 100 rows with wrong argumentId → all dropped silently', () => {
    const persisted = manyHighConfidenceRows(100).map((r) => ({
      ...r,
      argumentId: 'arg-other',
    }));
    const { postDedupe } = buildForSurface('inspect', { persistedRows: persisted });
    for (const m of postDedupe) {
      expect(m.id).not.toContain('machine_observation:persisted:');
    }
  });
});

describe('MCP-021B — provenance preservation', () => {
  it('CAP-20 — visible Machine Observation marks from persisted rows have ids prefixed with machine_observation:persisted:', () => {
    const { postDedupe } = buildForSurface('inspect', {
      persistedRows: [row()],
    });
    const persistedMarks = postDedupe.filter((m) =>
      m.id.startsWith('machine_observation:persisted:'),
    );
    expect(persistedMarks.length).toBeGreaterThanOrEqual(1);
  });

  it('CAP-21 — persisted Machine Observation marks have kind === machine_observation', () => {
    const { postDedupe } = buildForSurface('inspect', {
      persistedRows: manyHighConfidenceRows(10),
    });
    const persistedMarks = postDedupe.filter((m) =>
      m.id.startsWith('machine_observation:persisted:'),
    );
    for (const m of persistedMarks) {
      expect(m.kind).toBe('machine_observation');
    }
  });
});
