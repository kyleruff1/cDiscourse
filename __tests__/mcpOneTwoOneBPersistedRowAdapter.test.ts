/**
 * MCP-021B — Test §8.3: persistence adapter row → NodeLabelMark.
 *
 * Pure-TS tests of `mapPersistedObservationRowsToNodeLabelMarks` in
 * `src/features/nodeLabels/machineObservationPersistenceAdapter.ts`.
 *
 * Doctrine:
 *   - Every dropped row is dropped silently (no throw, no log).
 *   - Returned marks have `kind: 'machine_observation'` always.
 *   - Plain-language fields are sourced from the MCP-021A definition
 *     registry, never echoed from the raw row.
 */

import {
  mapPersistedObservationRowsToNodeLabelMarks,
  type MachineObservationPersistenceSurface,
} from '../src/features/nodeLabels/machineObservationPersistenceAdapter';
import { MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY } from '../src/features/nodeLabels/machineObservationDefinitions';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import type { MachineObservationResultRow } from '../src/features/nodeLabels/machineObservationPersistenceTypes';

const ARGUMENT_ID = 'arg-fixture-1';

function makeRow(overrides: Partial<MachineObservationResultRow> = {}): MachineObservationResultRow {
  return {
    id: 'res-1',
    runId: 'run-1',
    debateId: 'deb-1',
    argumentId: ARGUMENT_ID,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    // `has_rebuttal` is one of the 26 `rendered_now` MCP-021A entries
    // (Family A). All three confidenceEligibility floors are 'high' for
    // this entry, so the row must use confidence 'high' to surface on
    // any surface. Tests that need a lower floor pick a different rawKey.
    rawKey: 'has_rebuttal',
    family: 'parent_relation',
    confidence: 'high',
    evidenceSpan: null,
    createdAt: '2026-05-26T00:00:00.000Z',
    ...overrides,
  };
}

const TIMELINE_OPTIONS = { argumentId: ARGUMENT_ID, surface: 'timeline_node' as const };
const INSPECT_OPTIONS = { argumentId: ARGUMENT_ID, surface: 'inspect' as const };
const SELECTED_OPTIONS = {
  argumentId: ARGUMENT_ID,
  surface: 'selected_context' as const,
};

describe('MCP-021B — adapter: valid-row happy path', () => {
  it('valid row → produces 1 NodeLabelMark with kind machine_observation', () => {
    const marks = mapPersistedObservationRowsToNodeLabelMarks([makeRow()], TIMELINE_OPTIONS);
    expect(marks).toHaveLength(1);
    expect(marks[0].kind).toBe('machine_observation');
  });

  it('mark.source preserves definition.source (auto_metadata for has_rebuttal)', () => {
    const marks = mapPersistedObservationRowsToNodeLabelMarks([makeRow()], TIMELINE_OPTIONS);
    expect(marks[0].source).toBe('auto_metadata');
  });

  it('mark.label === definition.label (plain language)', () => {
    const def = MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['has_rebuttal'];
    const marks = mapPersistedObservationRowsToNodeLabelMarks([makeRow()], TIMELINE_OPTIONS);
    expect(marks[0].label).toBe(def.label);
  });

  it('mark.shortLabel === definition.shortLabel', () => {
    const def = MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['has_rebuttal'];
    const marks = mapPersistedObservationRowsToNodeLabelMarks([makeRow()], TIMELINE_OPTIONS);
    expect(marks[0].shortLabel).toBe(def.shortLabel);
  });

  it('mark.description === definition.description', () => {
    const def = MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['has_rebuttal'];
    const marks = mapPersistedObservationRowsToNodeLabelMarks([makeRow()], TIMELINE_OPTIONS);
    expect(marks[0].description).toBe(def.description);
  });

  it('mark.id starts with the persisted prefix and embeds the row id', () => {
    const marks = mapPersistedObservationRowsToNodeLabelMarks(
      [makeRow({ id: 'res-zebra' })],
      TIMELINE_OPTIONS,
    );
    expect(marks[0].id).toBe(`machine_observation:persisted:res-zebra:${ARGUMENT_ID}`);
  });

  it('mark.confidence === row.confidence', () => {
    const marks = mapPersistedObservationRowsToNodeLabelMarks([makeRow()], TIMELINE_OPTIONS);
    expect(marks[0].confidence).toBe('high');
  });
});

describe('MCP-021B — adapter: silent drops', () => {
  it('unknown rawKey is dropped silently', () => {
    expect(
      mapPersistedObservationRowsToNodeLabelMarks(
        [makeRow({ rawKey: 'this_rawkey_does_not_exist' })],
        TIMELINE_OPTIONS,
      ),
    ).toEqual([]);
  });

  it('wrong schema_version is dropped silently', () => {
    expect(
      mapPersistedObservationRowsToNodeLabelMarks(
        [makeRow({ schemaVersion: 'mcp-021.machine-observations.boolean.v2' })],
        TIMELINE_OPTIONS,
      ),
    ).toEqual([]);
  });

  it('empty schema_version is dropped silently', () => {
    expect(
      mapPersistedObservationRowsToNodeLabelMarks(
        // Empty string fails isWellFormedResultRow check before schema-version compare.
        [{ ...makeRow(), schemaVersion: '' }],
        TIMELINE_OPTIONS,
      ),
    ).toEqual([]);
  });

  it('wrong argumentId is dropped silently (defensive)', () => {
    expect(
      mapPersistedObservationRowsToNodeLabelMarks(
        [makeRow({ argumentId: 'arg-other' })],
        TIMELINE_OPTIONS,
      ),
    ).toEqual([]);
  });

  it('invalid confidence value is dropped silently', () => {
    expect(
      mapPersistedObservationRowsToNodeLabelMarks(
        [{ ...makeRow(), confidence: 'maximum' as unknown as 'high' }],
        TIMELINE_OPTIONS,
      ),
    ).toEqual([]);
  });

  it('malformed row (missing rawKey) is dropped silently', () => {
    const rest: Record<string, unknown> = { ...makeRow() };
    delete rest.rawKey;
    expect(
      mapPersistedObservationRowsToNodeLabelMarks([rest], TIMELINE_OPTIONS),
    ).toEqual([]);
  });

  it('malformed row (rawKey === null) is dropped silently', () => {
    expect(
      mapPersistedObservationRowsToNodeLabelMarks(
        [{ ...makeRow(), rawKey: null as unknown as string }],
        TIMELINE_OPTIONS,
      ),
    ).toEqual([]);
  });

  it('row === null in array is dropped silently', () => {
    expect(
      mapPersistedObservationRowsToNodeLabelMarks([null, makeRow()], TIMELINE_OPTIONS),
    ).toHaveLength(1);
  });

  it('row === undefined in array is dropped silently', () => {
    expect(
      mapPersistedObservationRowsToNodeLabelMarks([undefined, makeRow()], TIMELINE_OPTIONS),
    ).toHaveLength(1);
  });
});

describe('MCP-021B — adapter: confidence floor', () => {
  it('confidence below per-surface floor for timeline_node is dropped', () => {
    // has_rebuttal has timelineMinConfidence: 'high'. 'low' < 'high' → dropped.
    expect(
      mapPersistedObservationRowsToNodeLabelMarks(
        [makeRow({ confidence: 'low' })],
        TIMELINE_OPTIONS,
      ),
    ).toEqual([]);
  });

  it('confidence below per-surface floor for selected_context is dropped (has_rebuttal: high)', () => {
    expect(
      mapPersistedObservationRowsToNodeLabelMarks(
        [makeRow({ confidence: 'medium' })],
        SELECTED_OPTIONS,
      ),
    ).toEqual([]);
  });

  it('confidence below per-surface floor for inspect is dropped (has_rebuttal: high)', () => {
    expect(
      mapPersistedObservationRowsToNodeLabelMarks(
        [makeRow({ confidence: 'medium' })],
        INSPECT_OPTIONS,
      ),
    ).toEqual([]);
  });

  it('confidence at the per-surface floor is accepted', () => {
    expect(
      mapPersistedObservationRowsToNodeLabelMarks(
        [makeRow({ confidence: 'high' })],
        TIMELINE_OPTIONS,
      ),
    ).toHaveLength(1);
  });
});

describe('MCP-021B — adapter: evidence_span', () => {
  it('evidenceSpan > 240 chars is truncated to 240 chars with ellipsis', () => {
    const span = 'a'.repeat(300);
    const marks = mapPersistedObservationRowsToNodeLabelMarks(
      [makeRow({ evidenceSpan: span })],
      TIMELINE_OPTIONS,
    );
    const got = (marks[0] as unknown as { evidenceSpan?: string }).evidenceSpan;
    expect(got).toBeDefined();
    expect(got).toHaveLength(240);
    expect(got!.endsWith('…')).toBe(true);
  });

  it('evidenceSpan exactly 240 chars is preserved verbatim', () => {
    const span = 'b'.repeat(240);
    const marks = mapPersistedObservationRowsToNodeLabelMarks(
      [makeRow({ evidenceSpan: span })],
      TIMELINE_OPTIONS,
    );
    expect((marks[0] as unknown as { evidenceSpan?: string }).evidenceSpan).toBe(span);
  });

  it('evidenceSpan === null is not present on the mark', () => {
    const marks = mapPersistedObservationRowsToNodeLabelMarks(
      [makeRow({ evidenceSpan: null })],
      TIMELINE_OPTIONS,
    );
    expect((marks[0] as unknown as { evidenceSpan?: string }).evidenceSpan).toBeUndefined();
  });

  it('evidenceSpan === empty string is not present on the mark', () => {
    const marks = mapPersistedObservationRowsToNodeLabelMarks(
      [makeRow({ evidenceSpan: '' })],
      TIMELINE_OPTIONS,
    );
    expect((marks[0] as unknown as { evidenceSpan?: string }).evidenceSpan).toBeUndefined();
  });
});

describe('MCP-021B — adapter: input boundaries', () => {
  it('rows === [] returns []', () => {
    expect(mapPersistedObservationRowsToNodeLabelMarks([], TIMELINE_OPTIONS)).toEqual([]);
  });

  it('rows === null returns []', () => {
    expect(mapPersistedObservationRowsToNodeLabelMarks(null, TIMELINE_OPTIONS)).toEqual([]);
  });

  it('rows === undefined returns []', () => {
    expect(mapPersistedObservationRowsToNodeLabelMarks(undefined, TIMELINE_OPTIONS)).toEqual([]);
  });

  it('options.argumentId === "" returns []', () => {
    expect(
      mapPersistedObservationRowsToNodeLabelMarks(
        [makeRow()],
        { ...TIMELINE_OPTIONS, argumentId: '' },
      ),
    ).toEqual([]);
  });

  it('options.argumentId === undefined returns []', () => {
    expect(
      mapPersistedObservationRowsToNodeLabelMarks(
        [makeRow()],
        { surface: 'timeline_node' } as unknown as { argumentId: string; surface: MachineObservationPersistenceSurface },
      ),
    ).toEqual([]);
  });

  it('invalid surface returns []', () => {
    expect(
      mapPersistedObservationRowsToNodeLabelMarks(
        [makeRow()],
        { argumentId: ARGUMENT_ID, surface: 'composer' as unknown as MachineObservationPersistenceSurface },
      ),
    ).toEqual([]);
  });
});

describe('MCP-021B — adapter: mixed valid/invalid', () => {
  it('two rows: one valid + one invalid → returns 1 mark', () => {
    const rows = [
      makeRow({ id: 'res-1' }),
      makeRow({ id: 'res-2', rawKey: 'unknown_key_xyz' }),
    ];
    const marks = mapPersistedObservationRowsToNodeLabelMarks(rows, TIMELINE_OPTIONS);
    expect(marks).toHaveLength(1);
    expect(marks[0].id).toContain('res-1');
  });

  it('defensive 20-input random-input battery never throws', () => {
    const variations: ReadonlyArray<unknown> = [
      null,
      undefined,
      {},
      { rawKey: 'has_rebuttal' },
      'a string',
      42,
      [],
      true,
      makeRow(),
      makeRow({ rawKey: 'unknown_x' }),
      makeRow({ confidence: 'invalid' as unknown as 'high' }),
      makeRow({ schemaVersion: 'wrong-version' }),
      makeRow({ argumentId: 'other' }),
      makeRow({ rawKey: '' }),
      makeRow({ id: '' }),
      makeRow({ evidenceSpan: 'a'.repeat(1000) }),
      makeRow({ family: 42 as unknown as string }),
      makeRow({ createdAt: '' }),
      makeRow({ runId: '' }),
      makeRow({ debateId: '' }),
    ];
    for (let i = 0; i < 20; i++) {
      const row = variations[i % variations.length];
      const out = mapPersistedObservationRowsToNodeLabelMarks([row], TIMELINE_OPTIONS);
      expect(Array.isArray(out)).toBe(true);
      expect(out.length).toBeLessThanOrEqual(1);
    }
  });
});
