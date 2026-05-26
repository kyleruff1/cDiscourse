/**
 * MCP-021B — Test §8.4: Source 6 adapter with persisted rows.
 *
 * Pure-TS tests of the updated `adaptRawClassifierBinarySource` and the
 * `adaptAllSourcesForNode` aggregator pass-through. Asserts the
 * backwards-compatibility contract: every existing-shape input still
 * returns `[]` (byte-equal MCP-021A invariance) and persisted-rows
 * inputs return marks per spec.
 */

import {
  adaptAllSourcesForNode,
  adaptRawClassifierBinarySource,
} from '../src/features/nodeLabels/nodeLabelSourceAdapters';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import type { MachineObservationResultRow } from '../src/features/nodeLabels/machineObservationPersistenceTypes';

const MESSAGE_ID = 'msg-source-six-1';

function makeRow(overrides: Partial<MachineObservationResultRow> = {}): MachineObservationResultRow {
  return {
    id: 'res-1',
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

describe('MCP-021B — Source 6 backwards-compat invariance', () => {
  it('S6-1 — no persistedClassifierRows → returns [] (byte-equal pre-MCP-021B)', () => {
    expect(adaptRawClassifierBinarySource({ messageId: MESSAGE_ID })).toEqual([]);
  });

  it('S6-2 — empty persistedClassifierRows → returns []', () => {
    expect(
      adaptRawClassifierBinarySource({
        messageId: MESSAGE_ID,
        persistedClassifierRows: [],
      }),
    ).toEqual([]);
  });

  it('S6-3 — valid persistedClassifierRows + missing messageId → returns []', () => {
    expect(
      adaptRawClassifierBinarySource({
        messageId: '',
        persistedClassifierRows: [makeRow()],
      }),
    ).toEqual([]);
  });
});

describe('MCP-021B — Source 6 persisted-rows happy path', () => {
  it('S6-4 — valid persistedClassifierRows + valid messageId → returns marks', () => {
    const marks = adaptRawClassifierBinarySource({
      messageId: MESSAGE_ID,
      persistedClassifierRows: [makeRow()],
    });
    expect(marks).toHaveLength(1);
    expect(marks[0].kind).toBe('machine_observation');
  });

  it('S6-5 — single valid row → returns array of 1 mark', () => {
    const marks = adaptRawClassifierBinarySource({
      messageId: MESSAGE_ID,
      persistedClassifierRows: [makeRow()],
    });
    expect(marks).toHaveLength(1);
  });

  it('S6-6 — two valid rows with distinct rawKeys → returns array of 2 marks', () => {
    const marks = adaptRawClassifierBinarySource({
      messageId: MESSAGE_ID,
      persistedClassifierRows: [
        makeRow({ id: 'res-1', rawKey: 'has_rebuttal' }),
        makeRow({ id: 'res-2', rawKey: 'has_counter_rebuttal' }),
      ],
    });
    expect(marks).toHaveLength(2);
  });

  it('S6-7 — mixed valid + invalid → returns only valid marks', () => {
    const marks = adaptRawClassifierBinarySource({
      messageId: MESSAGE_ID,
      persistedClassifierRows: [
        makeRow({ id: 'res-1' }),
        makeRow({ id: 'res-2', rawKey: 'unknown_xyz' }),
        makeRow({ id: 'res-3', schemaVersion: 'wrong-version' }),
        makeRow({ id: 'res-4', confidence: 'invalid' as unknown as 'high' }),
      ],
    });
    expect(marks).toHaveLength(1);
    expect(marks[0].id).toContain('res-1');
  });

  it('S6-8 — all invalid → returns []', () => {
    const marks = adaptRawClassifierBinarySource({
      messageId: MESSAGE_ID,
      persistedClassifierRows: [
        makeRow({ rawKey: 'unknown_a' }),
        makeRow({ rawKey: 'unknown_b' }),
      ],
    });
    expect(marks).toEqual([]);
  });
});

describe('MCP-021B — Source 6 defensive input handling', () => {
  it('S6-9 — persistedClassifierRows === null → returns []', () => {
    expect(
      adaptRawClassifierBinarySource({
        messageId: MESSAGE_ID,
        persistedClassifierRows: null as unknown as ReadonlyArray<unknown>,
      }),
    ).toEqual([]);
  });

  it('S6-10 — persistedClassifierRows === { not: an array } → returns []', () => {
    expect(
      adaptRawClassifierBinarySource({
        messageId: MESSAGE_ID,
        persistedClassifierRows: { not: 'array' } as unknown as ReadonlyArray<unknown>,
      }),
    ).toEqual([]);
  });
});

describe('MCP-021B — Source 6 surface gating', () => {
  it('S6-11 — surface defaults to timeline_node (highest floor) when omitted', () => {
    // has_rebuttal has timelineMinConfidence === 'high'; a 'low'-confidence
    // row should be dropped when surface defaults to 'timeline_node'.
    const marks = adaptRawClassifierBinarySource({
      messageId: MESSAGE_ID,
      persistedClassifierRows: [makeRow({ confidence: 'low' })],
    });
    expect(marks).toEqual([]);
  });

  it('S6-12 — surface "inspect" admits lower-confidence rows for the same rawKey', () => {
    // has_rebuttal has inspectMinConfidence === 'high'. So 'low' is still
    // dropped on inspect. Pick a different rawKey that has a lower
    // inspect floor: refines_parent (Family A, future_source) has
    // inspectMinConfidence: 'low'. But future_source disposition is
    // filtered by the surface filter, not the adapter. The adapter only
    // checks the confidence-floor gate — so a future_source row at low
    // confidence DOES pass the adapter's per-surface gate and is emitted;
    // it would be filtered at the presentation pipeline downstream.
    // Pick `quote_anchors_parent` (Family A, ai_classifier, future_source,
    // inspectMinConfidence: 'low').
    const marks = adaptRawClassifierBinarySource({
      messageId: MESSAGE_ID,
      surface: 'inspect',
      persistedClassifierRows: [
        makeRow({ rawKey: 'quote_anchors_parent', confidence: 'low' }),
      ],
    });
    // The adapter emits the mark; downstream presentation pipeline
    // filters based on disposition (future_source). We only test the
    // adapter here.
    expect(marks).toHaveLength(1);
    expect(marks[0].rawKey).toBe('quote_anchors_parent');
  });

  it('S6-13 — surface "selected_context" applies its floor correctly', () => {
    // has_rebuttal selectedContextMinConfidence === 'high'; 'medium' < 'high' → drop.
    const marks = adaptRawClassifierBinarySource({
      messageId: MESSAGE_ID,
      surface: 'selected_context',
      persistedClassifierRows: [makeRow({ confidence: 'medium' })],
    });
    expect(marks).toEqual([]);
  });
});

describe('MCP-021B — Source 6 pre-MCP-021B input invariance battery', () => {
  it('S6-14 — pre-MCP-021B input { messageId: "any" } still returns []', () => {
    expect(adaptRawClassifierBinarySource({ messageId: 'any' })).toEqual([]);
  });

  it('S6-15 — pre-MCP-021B input { messageId: "", binaries: [] } still returns []', () => {
    expect(adaptRawClassifierBinarySource({ messageId: '', binaries: [] })).toEqual([]);
  });

  it('S6-16 — pre-MCP-021B input { messageId: "x", binaries: [{}] } still returns []', () => {
    expect(adaptRawClassifierBinarySource({ messageId: 'x', binaries: [{}] })).toEqual([]);
  });

  it('S6-17 — pre-MCP-021B input { messageId: "x", binaries: [{ raw_key: "..." }] } still returns []', () => {
    expect(
      adaptRawClassifierBinarySource({
        messageId: 'x',
        binaries: [{ raw_key: 'splits_thread', present: true }],
      }),
    ).toEqual([]);
  });

  it('S6-18 — varied messageIds without persisted rows still return []', () => {
    const cases = ['', 'a', 'message-1', 'message-uuid-123', 'special-!@#$%'];
    for (const messageId of cases) {
      expect(adaptRawClassifierBinarySource({ messageId })).toEqual([]);
    }
  });

  it('S6-19 — varied binaries shapes without persistedClassifierRows still return []', () => {
    const binariesBattery: ReadonlyArray<ReadonlyArray<unknown> | undefined> = [
      undefined,
      [],
      [{}],
      [{}, {}],
      [{ foo: 'bar' }],
      [null as unknown as Record<string, unknown>],
      [{ raw_key: 'never_emitted' }],
    ];
    for (const binaries of binariesBattery) {
      const input =
        binaries === undefined ? { messageId: 'm' } : { messageId: 'm', binaries };
      expect(adaptRawClassifierBinarySource(input)).toEqual([]);
    }
  });

  it('S6-20 — random battery of 20 pre-MCP-021B inputs all return []', () => {
    for (let i = 0; i < 20; i++) {
      const binaries = i % 2 === 0 ? [] : [{ index: i }];
      expect(
        adaptRawClassifierBinarySource({ messageId: `msg-${i}`, binaries }),
      ).toEqual([]);
    }
  });

  it('S6-21 — explicit { persistedClassifierRows: undefined } still returns []', () => {
    expect(
      adaptRawClassifierBinarySource({
        messageId: MESSAGE_ID,
        persistedClassifierRows: undefined,
      }),
    ).toEqual([]);
  });
});

describe('MCP-021B — adaptAllSourcesForNode pass-through', () => {
  it('S6-22 — pre-MCP-021B caller without persistedClassifierRows gets rawClassifierMarks === []', () => {
    const out = adaptAllSourcesForNode({
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
      messageId: MESSAGE_ID,
    });
    expect(out.rawClassifierMarks).toEqual([]);
  });

  it('S6-23 — caller with persistedClassifierRows gets non-empty rawClassifierMarks', () => {
    const out = adaptAllSourcesForNode({
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
      messageId: MESSAGE_ID,
      persistedClassifierRows: [makeRow()],
    });
    expect(out.rawClassifierMarks).toHaveLength(1);
    expect(out.rawClassifierMarks[0].kind).toBe('machine_observation');
  });

  it('S6-24 — surface gate threaded through adaptAllSourcesForNode', () => {
    // selected_context with 'medium' confidence on high-floor entry → drop
    const out = adaptAllSourcesForNode({
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
      messageId: MESSAGE_ID,
      surface: 'selected_context',
      persistedClassifierRows: [makeRow({ confidence: 'medium' })],
    });
    expect(out.rawClassifierMarks).toEqual([]);
  });
});
