/**
 * Exhaustive transition matrix tests.
 * Every combination of (parentType, childType) is tested against the v1 constitution.
 * Valid transitions must produce zero violation flags.
 * Invalid transitions must produce an INVALID_TRANSITION violation.
 */
import { validateTransition } from '../src/domain/constitution/engine';
import { constitutionV1 } from '../src/domain/constitution/v1';
import type { ArgumentTypeCode } from '../src/domain/constitution/types';

const c = constitutionV1;
const ALL_TYPES: ArgumentTypeCode[] = ['CLM', 'RBT', 'CRB', 'EVD', 'CLR', 'CON', 'SYN'];

// Build the complete expected transition matrix from v1
const VALID_TRANSITIONS: Partial<Record<ArgumentTypeCode, ArgumentTypeCode[]>> = {
  CLM: ['RBT', 'EVD', 'CLR', 'CON'],
  RBT: ['CRB', 'EVD', 'CLR', 'CON'],
  CRB: ['RBT', 'EVD', 'CLR'],
  EVD: ['CLR', 'RBT'],
  CLR: ['CLM'],
  CON: ['SYN'],
  SYN: [],
};

describe('Transition matrix — all valid transitions pass', () => {
  for (const [parent, children] of Object.entries(VALID_TRANSITIONS) as [
    ArgumentTypeCode,
    ArgumentTypeCode[],
  ][]) {
    for (const child of children) {
      it(`${parent} → ${child} is valid`, () => {
        const result = validateTransition(parent, child, c);
        expect(result.valid).toBe(true);
        expect(result.flags).toHaveLength(0);
      });
    }
  }
});

describe('Transition matrix — all invalid transitions are rejected', () => {
  for (const parent of ALL_TYPES) {
    const allowed = VALID_TRANSITIONS[parent] ?? [];
    const forbidden = ALL_TYPES.filter((t) => !allowed.includes(t));

    for (const child of forbidden) {
      it(`${parent} → ${child} is INVALID_TRANSITION violation`, () => {
        const result = validateTransition(parent, child, c);
        expect(result.valid).toBe(false);
        expect(result.flags[0].ruleId).toBe('INVALID_TRANSITION');
        expect(result.flags[0].severity).toBe('violation');
        expect(result.flags[0].authoritative).toBe(true);
      });
    }
  }
});

describe('Transition matrix — SYN is terminal (no allowed children)', () => {
  it('SYN has no valid child types', () => {
    expect(VALID_TRANSITIONS.SYN).toEqual([]);
  });

  for (const child of ALL_TYPES) {
    it(`SYN → ${child} is rejected`, () => {
      const result = validateTransition('SYN', child, c);
      expect(result.valid).toBe(false);
      expect(result.flags[0].ruleId).toBe('INVALID_TRANSITION');
    });
  }
});

describe('Transition matrix — constitution v1 counts', () => {
  it('has exactly 7 argument types', () => {
    expect(c.argumentTypes).toHaveLength(7);
    expect(c.argumentTypes.map((t) => t.code).sort()).toEqual(
      ['CLM', 'CLR', 'CON', 'CRB', 'EVD', 'RBT', 'SYN']
    );
  });

  it('has 7 entries in the transition matrix (including SYN terminal)', () => {
    expect(Object.keys(c.transitionMatrix)).toHaveLength(7);
  });

  it('total valid transitions equals 15', () => {
    const total = Object.values(c.transitionMatrix).reduce((sum, arr) => sum + arr.length, 0);
    expect(total).toBe(15);
  });
});
