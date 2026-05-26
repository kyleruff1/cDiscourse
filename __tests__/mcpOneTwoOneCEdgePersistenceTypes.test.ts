/**
 * MCP-021C-EDGE — Test: persistence types extended for run_mode.
 *
 * Pure-TS tests of the new `MachineObservationRunMode` enum,
 * `isMachineObservationRunMode` guard, and the `runMode` field added to
 * `MachineObservationRunRow`.
 *
 * Doctrine:
 *   - run_mode mirrors the migration's CHECK constraint exactly: two
 *     values, no superset, no aliases.
 *   - run_mode discriminates PURPOSE; it never labels participant or
 *     content (cdiscourse-doctrine §1, §10a).
 */

import {
  ALL_MACHINE_OBSERVATION_RUN_MODES,
  isMachineObservationRunMode,
  isWellFormedRunRow,
  type MachineObservationRunMode,
  type MachineObservationRunRow,
} from '../src/features/nodeLabels/machineObservationPersistenceTypes';

const VALID_RUN_PRODUCTION: MachineObservationRunRow = {
  id: 'run-1',
  debateId: 'deb-1',
  argumentId: 'arg-1',
  schemaVersion: 'mcp-021.machine-observations.boolean.v1',
  requestedFamilies: ['parent_relation'],
  providerKey: 'mcp:classify_argument_boolean_observations',
  modelName: 'operator-mcp-server',
  inputHash: 'mcp-abcd1234',
  status: 'success',
  failureReason: null,
  startedAt: '2026-05-26T00:00:00.000Z',
  completedAt: '2026-05-26T00:00:01.000Z',
  createdAt: '2026-05-26T00:00:01.000Z',
  runMode: 'production',
};

const VALID_RUN_ADMIN_VALIDATION: MachineObservationRunRow = {
  ...VALID_RUN_PRODUCTION,
  id: 'run-2',
  runMode: 'admin_validation',
};

describe('MCP-021C-EDGE — ALL_MACHINE_OBSERVATION_RUN_MODES', () => {
  it('RM-1 — contains exactly production and admin_validation', () => {
    expect(ALL_MACHINE_OBSERVATION_RUN_MODES).toEqual(['production', 'admin_validation']);
  });

  it('RM-2 — has length 2', () => {
    expect(ALL_MACHINE_OBSERVATION_RUN_MODES).toHaveLength(2);
  });

  it('RM-3 — is frozen (no mutation after definition)', () => {
    expect(Object.isFrozen(ALL_MACHINE_OBSERVATION_RUN_MODES)).toBe(true);
  });

  it('RM-4 — every entry is a non-empty string', () => {
    for (const mode of ALL_MACHINE_OBSERVATION_RUN_MODES) {
      expect(typeof mode).toBe('string');
      expect(mode.length).toBeGreaterThan(0);
    }
  });
});

describe('MCP-021C-EDGE — isMachineObservationRunMode', () => {
  it('RM-5 — accepts production', () => {
    expect(isMachineObservationRunMode('production')).toBe(true);
  });

  it('RM-6 — accepts admin_validation', () => {
    expect(isMachineObservationRunMode('admin_validation')).toBe(true);
  });

  it('RM-7 — rejects PRODUCTION (case sensitive)', () => {
    expect(isMachineObservationRunMode('PRODUCTION')).toBe(false);
    expect(isMachineObservationRunMode('Admin_Validation')).toBe(false);
  });

  it('RM-8 — rejects unknown strings', () => {
    expect(isMachineObservationRunMode('staging')).toBe(false);
    expect(isMachineObservationRunMode('test')).toBe(false);
    expect(isMachineObservationRunMode('audit')).toBe(false);
    expect(isMachineObservationRunMode('')).toBe(false);
  });

  it('RM-9 — rejects non-strings', () => {
    expect(isMachineObservationRunMode(null)).toBe(false);
    expect(isMachineObservationRunMode(undefined)).toBe(false);
    expect(isMachineObservationRunMode(0)).toBe(false);
    expect(isMachineObservationRunMode(true)).toBe(false);
    expect(isMachineObservationRunMode({})).toBe(false);
    expect(isMachineObservationRunMode(['production'])).toBe(false);
  });
});

describe('MCP-021C-EDGE — isWellFormedRunRow accepts runMode', () => {
  it('RM-10 — accepts a production run row', () => {
    expect(isWellFormedRunRow(VALID_RUN_PRODUCTION)).toBe(true);
  });

  it('RM-11 — accepts an admin_validation run row', () => {
    expect(isWellFormedRunRow(VALID_RUN_ADMIN_VALIDATION)).toBe(true);
  });

  it('RM-12 — rejects a row missing runMode', () => {
    const rest: Record<string, unknown> = { ...VALID_RUN_PRODUCTION };
    delete rest.runMode;
    expect(isWellFormedRunRow(rest)).toBe(false);
  });

  it('RM-13 — rejects a row with invalid runMode value', () => {
    expect(
      isWellFormedRunRow({ ...VALID_RUN_PRODUCTION, runMode: 'staging' }),
    ).toBe(false);
  });

  it('RM-14 — rejects a row with non-string runMode', () => {
    expect(
      isWellFormedRunRow({ ...VALID_RUN_PRODUCTION, runMode: 42 }),
    ).toBe(false);
    expect(
      isWellFormedRunRow({ ...VALID_RUN_PRODUCTION, runMode: null }),
    ).toBe(false);
  });
});

describe('MCP-021C-EDGE — run mode doctrine (no verdict tokens)', () => {
  const BANNED_VERDICT_TOKENS = [
    'winner',
    'loser',
    'liar',
    'true',
    'false',
    'correct',
    'incorrect',
    'dishonest',
    'bad_faith',
    'manipulative',
    'extremist',
    'propagandist',
    'truth',
    'verdict',
    'proof',
  ];

  it('RM-15 — no run mode value carries a verdict token', () => {
    for (const mode of ALL_MACHINE_OBSERVATION_RUN_MODES) {
      const lower = mode.toLowerCase();
      for (const banned of BANNED_VERDICT_TOKENS) {
        expect(lower).not.toContain(banned);
      }
    }
  });
});

describe('MCP-021C-EDGE — type contract (MachineObservationRunMode)', () => {
  it('RM-16 — production is assignable to MachineObservationRunMode', () => {
    const m: MachineObservationRunMode = 'production';
    expect(m).toBe('production');
  });

  it('RM-17 — admin_validation is assignable to MachineObservationRunMode', () => {
    const m: MachineObservationRunMode = 'admin_validation';
    expect(m).toBe('admin_validation');
  });
});
