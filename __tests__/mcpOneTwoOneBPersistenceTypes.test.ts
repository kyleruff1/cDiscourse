/**
 * MCP-021B — Persistence row type guards.
 *
 * Pure-TS tests of the type guards in
 * `src/features/nodeLabels/machineObservationPersistenceTypes.ts`. The
 * guards are the gate between Supabase-row-from-the-wire and a validated
 * `MachineObservationResultRow` / `MachineObservationRunRow` shape the
 * adapter consumes.
 *
 * Doctrine: every guard returns false (never throws) for malformed
 * inputs. The adapter relies on this to discard rows silently.
 */

import {
  isMachineObservationConfidence,
  isMachineObservationFamily,
  isMachineObservationRunStatus,
  isWellFormedResultRow,
  isWellFormedRunRow,
  type MachineObservationResultRow,
  type MachineObservationRunRow,
} from '../src/features/nodeLabels/machineObservationPersistenceTypes';
import { ALL_MACHINE_OBSERVATION_FAMILIES } from '../src/features/nodeLabels';

const VALID_RESULT: MachineObservationResultRow = {
  id: 'res-1',
  runId: 'run-1',
  debateId: 'deb-1',
  argumentId: 'arg-1',
  schemaVersion: 'mcp-021.machine-observations.boolean.v1',
  rawKey: 'has_rebuttal',
  family: 'parent_relation',
  confidence: 'high',
  evidenceSpan: null,
  createdAt: '2026-05-26T00:00:00.000Z',
};

const VALID_RUN: MachineObservationRunRow = {
  id: 'run-1',
  debateId: 'deb-1',
  argumentId: 'arg-1',
  schemaVersion: 'mcp-021.machine-observations.boolean.v1',
  requestedFamilies: ['parent_relation', 'evidence_source_chain'],
  providerKey: null,
  modelName: null,
  inputHash: null,
  status: 'success',
  failureReason: null,
  startedAt: '2026-05-26T00:00:00.000Z',
  completedAt: '2026-05-26T00:00:01.000Z',
  createdAt: '2026-05-26T00:00:01.000Z',
};

describe('MCP-021B — isMachineObservationConfidence', () => {
  it('accepts low / medium / high', () => {
    expect(isMachineObservationConfidence('low')).toBe(true);
    expect(isMachineObservationConfidence('medium')).toBe(true);
    expect(isMachineObservationConfidence('high')).toBe(true);
  });

  it('rejects every other value', () => {
    expect(isMachineObservationConfidence('')).toBe(false);
    expect(isMachineObservationConfidence('LOW')).toBe(false);
    expect(isMachineObservationConfidence('unknown')).toBe(false);
    expect(isMachineObservationConfidence(null)).toBe(false);
    expect(isMachineObservationConfidence(undefined)).toBe(false);
    expect(isMachineObservationConfidence(0)).toBe(false);
    expect(isMachineObservationConfidence(true)).toBe(false);
    expect(isMachineObservationConfidence({})).toBe(false);
  });
});

describe('MCP-021B — isMachineObservationRunStatus', () => {
  it('accepts success / failed / fallback', () => {
    expect(isMachineObservationRunStatus('success')).toBe(true);
    expect(isMachineObservationRunStatus('failed')).toBe(true);
    expect(isMachineObservationRunStatus('fallback')).toBe(true);
  });

  it('rejects every other value', () => {
    expect(isMachineObservationRunStatus('SUCCESS')).toBe(false);
    expect(isMachineObservationRunStatus('pending')).toBe(false);
    expect(isMachineObservationRunStatus('')).toBe(false);
    expect(isMachineObservationRunStatus(null)).toBe(false);
    expect(isMachineObservationRunStatus(undefined)).toBe(false);
  });
});

describe('MCP-021B — isMachineObservationFamily', () => {
  it('accepts every member of ALL_MACHINE_OBSERVATION_FAMILIES', () => {
    for (const family of ALL_MACHINE_OBSERVATION_FAMILIES) {
      expect(isMachineObservationFamily(family)).toBe(true);
    }
  });

  it('rejects non-member strings', () => {
    expect(isMachineObservationFamily('not_a_family')).toBe(false);
    expect(isMachineObservationFamily('')).toBe(false);
    expect(isMachineObservationFamily('PARENT_RELATION')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isMachineObservationFamily(null)).toBe(false);
    expect(isMachineObservationFamily(undefined)).toBe(false);
    expect(isMachineObservationFamily(0)).toBe(false);
    expect(isMachineObservationFamily({})).toBe(false);
  });
});

describe('MCP-021B — isWellFormedResultRow', () => {
  it('accepts a fully-populated valid row', () => {
    expect(isWellFormedResultRow(VALID_RESULT)).toBe(true);
  });

  it('accepts a row with evidenceSpan as a string', () => {
    expect(isWellFormedResultRow({ ...VALID_RESULT, evidenceSpan: 'short excerpt' })).toBe(true);
  });

  it('accepts a row with evidenceSpan as empty string', () => {
    expect(isWellFormedResultRow({ ...VALID_RESULT, evidenceSpan: '' })).toBe(true);
  });

  it('rejects null', () => {
    expect(isWellFormedResultRow(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isWellFormedResultRow(undefined)).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isWellFormedResultRow('row')).toBe(false);
    expect(isWellFormedResultRow(123)).toBe(false);
    expect(isWellFormedResultRow(true)).toBe(false);
  });

  it('rejects when id is missing', () => {
    const rest: Record<string, unknown> = { ...VALID_RESULT };
    delete rest.id;
    expect(isWellFormedResultRow(rest)).toBe(false);
  });

  it('rejects when id is empty string', () => {
    expect(isWellFormedResultRow({ ...VALID_RESULT, id: '' })).toBe(false);
  });

  it('rejects when runId is missing', () => {
    const rest: Record<string, unknown> = { ...VALID_RESULT };
    delete rest.runId;
    expect(isWellFormedResultRow(rest)).toBe(false);
  });

  it('rejects when debateId is missing', () => {
    const rest: Record<string, unknown> = { ...VALID_RESULT };
    delete rest.debateId;
    expect(isWellFormedResultRow(rest)).toBe(false);
  });

  it('rejects when argumentId is missing', () => {
    const rest: Record<string, unknown> = { ...VALID_RESULT };
    delete rest.argumentId;
    expect(isWellFormedResultRow(rest)).toBe(false);
  });

  it('rejects when schemaVersion is missing', () => {
    const rest: Record<string, unknown> = { ...VALID_RESULT };
    delete rest.schemaVersion;
    expect(isWellFormedResultRow(rest)).toBe(false);
  });

  it('rejects when rawKey is missing', () => {
    const rest: Record<string, unknown> = { ...VALID_RESULT };
    delete rest.rawKey;
    expect(isWellFormedResultRow(rest)).toBe(false);
  });

  it('rejects when rawKey is null', () => {
    expect(isWellFormedResultRow({ ...VALID_RESULT, rawKey: null })).toBe(false);
  });

  it('rejects when family is not a string', () => {
    expect(isWellFormedResultRow({ ...VALID_RESULT, family: 42 })).toBe(false);
  });

  it('rejects when confidence is not one of low/medium/high', () => {
    expect(isWellFormedResultRow({ ...VALID_RESULT, confidence: 'maximum' })).toBe(false);
    expect(isWellFormedResultRow({ ...VALID_RESULT, confidence: '' })).toBe(false);
    expect(isWellFormedResultRow({ ...VALID_RESULT, confidence: null })).toBe(false);
  });

  it('rejects when evidenceSpan is a non-string non-null value', () => {
    expect(isWellFormedResultRow({ ...VALID_RESULT, evidenceSpan: 42 })).toBe(false);
    expect(isWellFormedResultRow({ ...VALID_RESULT, evidenceSpan: {} })).toBe(false);
  });

  it('rejects when createdAt is missing', () => {
    const rest: Record<string, unknown> = { ...VALID_RESULT };
    delete rest.createdAt;
    expect(isWellFormedResultRow(rest)).toBe(false);
  });
});

describe('MCP-021B — isWellFormedRunRow', () => {
  it('accepts a fully-populated valid run row', () => {
    expect(isWellFormedRunRow(VALID_RUN)).toBe(true);
  });

  it('accepts a run row with completedAt === null (in-flight)', () => {
    expect(isWellFormedRunRow({ ...VALID_RUN, completedAt: null })).toBe(true);
  });

  it('accepts a run row with empty requestedFamilies', () => {
    expect(isWellFormedRunRow({ ...VALID_RUN, requestedFamilies: [] })).toBe(true);
  });

  it('rejects null', () => {
    expect(isWellFormedRunRow(null)).toBe(false);
  });

  it('rejects when requestedFamilies is not an array', () => {
    expect(isWellFormedRunRow({ ...VALID_RUN, requestedFamilies: 'parent_relation' })).toBe(false);
  });

  it('rejects when requestedFamilies contains a non-string', () => {
    expect(
      isWellFormedRunRow({ ...VALID_RUN, requestedFamilies: ['parent_relation', 42] }),
    ).toBe(false);
  });

  it('rejects when status is invalid', () => {
    expect(isWellFormedRunRow({ ...VALID_RUN, status: 'unknown' })).toBe(false);
  });

  it('rejects when providerKey is a non-string non-null value', () => {
    expect(isWellFormedRunRow({ ...VALID_RUN, providerKey: 42 })).toBe(false);
  });

  it('rejects when completedAt is a non-string non-null value', () => {
    expect(isWellFormedRunRow({ ...VALID_RUN, completedAt: 42 })).toBe(false);
  });
});
