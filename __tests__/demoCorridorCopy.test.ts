/**
 * DEMO-001 — Corridor copy doctrine scan.
 *
 * Pure. Scans every user-facing atom in CORRIDOR_COPY and CORRIDOR_STEPS for
 * banned verdict / person tokens (cdiscourse-doctrine §1) and for raw
 * snake_case type codes (REF-ADR-001 plain-move proof — §9). The four move
 * labels must read as the plain set, never `ask_source`-style codes.
 */
import { CORRIDOR_COPY, CORRIDOR_STEPS } from '../src/features/demoCorridor/corridorModel';

/** Every user-facing string the corridor renders. */
function allCopyAtoms(): string[] {
  const atoms: string[] = [];
  for (const v of Object.values(CORRIDOR_COPY)) {
    if (typeof v === 'string') atoms.push(v);
    else if (Array.isArray(v)) for (const line of v) atoms.push(line);
  }
  for (const step of CORRIDOR_STEPS) {
    for (const line of step.teachingLines) atoms.push(line);
    atoms.push(step.primaryAction.label, step.primaryAction.accessibilityLabel);
    for (const sa of step.secondaryActions) atoms.push(sa.label, sa.accessibilityLabel);
    for (const mm of step.moveMenu ?? []) atoms.push(mm.label, mm.accessibilityLabel);
  }
  return atoms;
}

const BANNED = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'truth',
  'untrue',
  'dishonest',
  'liar',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'verdict',
  'bad faith',
  'proof of',
];

describe('CORRIDOR_COPY — doctrine ban-list', () => {
  const atoms = allCopyAtoms();

  it('collects a non-trivial set of copy atoms', () => {
    expect(atoms.length).toBeGreaterThan(20);
  });

  it('no copy atom carries a banned verdict / person token', () => {
    for (const atom of atoms) {
      const lower = atom.toLowerCase();
      for (const b of BANNED) {
        expect(lower).not.toContain(b);
      }
    }
  });

  it('no copy atom uses the standalone words true / false', () => {
    for (const atom of atoms) {
      expect(atom.toLowerCase()).not.toMatch(/\b(true|false)\b/);
    }
  });

  it('no user-facing atom leaks a raw snake_case type / classifier code', () => {
    for (const atom of allCopyAtoms()) {
      expect(atom).not.toMatch(/\b[a-z]+_[a-z_]+\b/);
    }
  });
});

describe('CORRIDOR_COPY — plain moves (REF-ADR-001)', () => {
  it('the move-menu labels are the ratified plain set, not internal codes', () => {
    const chooseStep = CORRIDOR_STEPS.find((s) => s.kind === 'choose_move')!;
    const labels = (chooseStep.moveMenu ?? []).map((m) => m.label);
    expect(labels).toEqual([
      'Ask for a source',
      'Add evidence',
      'Narrow the scope',
      'Open a side issue',
    ]);
    for (const label of labels) {
      expect(label).not.toMatch(/_/);
    }
  });

  it('the entry + closing copy reads in plain language', () => {
    expect(CORRIDOR_COPY.entryLabel).toBe('See how it works');
    expect(CORRIDOR_COPY.closingPrimary).toBe('Jump into a real room');
    expect(CORRIDOR_COPY.closingPrimary).not.toMatch(/_/);
  });

  it('every step has a non-empty primary action label', () => {
    for (const step of CORRIDOR_STEPS) {
      expect(step.primaryAction.label.length).toBeGreaterThan(0);
      expect(step.primaryAction.accessibilityLabel.length).toBeGreaterThan(0);
    }
  });
});
