import {
  validateScenario,
  FORBIDDEN_TERMS,
  isValidScenario,
} from '../src/features/devFixtures/argumentScenarioValidation';
import type { FixtureScenario, FixtureMove } from '../src/features/devFixtures/argumentScenarioTypes';

// ── Minimal valid scenario used as test baseline ──────────────

const VALID_MOVE_SET: FixtureMove[] = [
  {
    moveId: 'm1', authorAlias: 'Alex', parentMoveId: null,
    moveKind: 'start_thesis', argumentType: 'thesis',
    body: 'Remote work removes the interruptions that are endemic to open offices and improves focus.',
    selectedTagCodes: [], expectedStatus: 'posted',
    displayMeta: { quoteAnchorCandidate: 'removes the interruptions' },
  },
  {
    moveId: 'm2', authorAlias: 'Blake', parentMoveId: 'm1',
    moveKind: 'challenge_parent', argumentType: 'rebuttal',
    disagreementAxis: 'evidence',
    targetExcerpt: 'removes the interruptions that are endemic to open offices',
    body: 'Remote work trades office interruptions for home interruptions.',
    selectedTagCodes: [], expectedStatus: 'posted',
  },
  {
    moveId: 'm3', authorAlias: 'Alex', parentMoveId: 'm2',
    moveKind: 'ask_clarification', argumentType: 'clarification_request',
    body: 'Are you arguing the improvement is zero on average, or that it is unevenly distributed?',
    selectedTagCodes: [], expectedStatus: 'posted',
  },
  {
    moveId: 'm4', authorAlias: 'Blake', parentMoveId: 'm3',
    moveKind: 'make_claim', argumentType: 'claim',
    body: 'That the benefit is unevenly distributed across worker setups.',
    selectedTagCodes: [], expectedStatus: 'posted',
  },
  {
    moveId: 'm5', authorAlias: 'Alex', parentMoveId: 'm2',
    moveKind: 'add_evidence', argumentType: 'evidence',
    body: 'A randomized Stanford study found remote workers showed 13% higher productivity in controlled conditions.',
    selectedTagCodes: [], expectedStatus: 'posted',
    evidence: { label: 'Stanford WFH Study', sourceText: 'Bloom et al. randomized experiment.' },
  },
  {
    moveId: 'm6', authorAlias: 'Blake', parentMoveId: 'm5',
    moveKind: 'concede_or_narrow', argumentType: 'concession',
    body: 'The Stanford study is solid. I will grant that for the right setup, remote work is a real improvement.',
    selectedTagCodes: [], expectedStatus: 'posted',
    displayMeta: { playfulLabel: 'Surrender completely' },
  },
  {
    moveId: 'm7', authorAlias: 'Charlie', parentMoveId: 'm1',
    moveKind: 'synthesize_thread', argumentType: 'synthesis',
    body: 'Both sides agree the benefit is real but conditional. The open question is how to make suitable conditions more accessible.',
    selectedTagCodes: [], expectedStatus: 'posted',
  },
];

const VALID_SCENARIO: FixtureScenario = {
  scenarioId: 'test-scenario',
  title: 'Remote Work Focus Test',
  resolution: 'Remote work improves deep-focus task performance.',
  category: 'everyday',
  personas: [
    { alias: 'Alex', side: 'affirmative', tone: 'calm' },
    { alias: 'Blake', side: 'negative', tone: 'skeptical' },
    { alias: 'Charlie', side: 'neutral', tone: 'conciliatory' },
  ],
  moves: VALID_MOVE_SET,
  expectedFlags: [],
  expectedTopicChecks: ['resolution_match'],
  expectedTurnStatuses: [],
  notes: 'Test fixture for validation suite.',
};

// ── Core validateScenario tests ───────────────────────────────

describe('validateScenario — valid scenario', () => {
  it('accepts the baseline valid scenario', () => {
    expect(validateScenario(VALID_SCENARIO)).toHaveLength(0);
  });

  it('isValidScenario returns true for valid scenario', () => {
    expect(isValidScenario(VALID_SCENARIO)).toBe(true);
  });

  it('isValidScenario returns false for null', () => {
    expect(isValidScenario(null)).toBe(false);
  });
});

describe('validateScenario — move ID uniqueness', () => {
  it('rejects duplicate move IDs', () => {
    const bad: FixtureScenario = {
      ...VALID_SCENARIO,
      moves: [...VALID_MOVE_SET, { ...VALID_MOVE_SET[0] }],
    };
    const errors = validateScenario(bad);
    expect(errors.some((e) => e.toLowerCase().includes('duplicate'))).toBe(true);
  });
});

describe('validateScenario — parent references', () => {
  it('rejects moves with non-existent parent IDs', () => {
    const bad: FixtureScenario = {
      ...VALID_SCENARIO,
      moves: [
        ...VALID_MOVE_SET,
        {
          moveId: 'm8', authorAlias: 'Alex', parentMoveId: 'does-not-exist',
          moveKind: 'make_claim', argumentType: 'claim',
          body: 'Orphaned move body text here.',
          selectedTagCodes: [], expectedStatus: 'posted',
        },
      ],
    };
    const errors = validateScenario(bad);
    expect(errors.some((e) => e.includes('does-not-exist'))).toBe(true);
  });

  it('requires at least one root move (parentMoveId null)', () => {
    const noRoot: FixtureScenario = {
      ...VALID_SCENARIO,
      moves: VALID_MOVE_SET.map((m) => ({ ...m, parentMoveId: 'm1' })),
    };
    const errors = validateScenario(noRoot);
    expect(errors.some((e) => e.toLowerCase().includes('root'))).toBe(true);
  });
});

describe('validateScenario — move count', () => {
  it('rejects fewer than 6 moves', () => {
    const few: FixtureScenario = { ...VALID_SCENARIO, moves: VALID_MOVE_SET.slice(0, 4) };
    const errors = validateScenario(few);
    expect(errors.some((e) => e.toLowerCase().includes('few'))).toBe(true);
  });

  it('rejects more than 10 moves', () => {
    const extra = Array.from({ length: 4 }, (_, i) => ({
      ...VALID_MOVE_SET[3],
      moveId: `extra${i}`,
      parentMoveId: 'm1',
    }));
    const too_many: FixtureScenario = { ...VALID_SCENARIO, moves: [...VALID_MOVE_SET, ...extra] };
    const errors = validateScenario(too_many);
    expect(errors.some((e) => e.toLowerCase().includes('many'))).toBe(true);
  });
});

describe('validateScenario — challenge moves', () => {
  it('rejects challenge move without disagreementAxis or qualifierCode', () => {
    const bad: FixtureScenario = {
      ...VALID_SCENARIO,
      moves: VALID_MOVE_SET.map((m) =>
        m.moveKind === 'challenge_parent'
          ? { ...m, disagreementAxis: undefined, qualifierCode: undefined }
          : m,
      ),
    };
    const errors = validateScenario(bad);
    expect(errors.some((e) => e.toLowerCase().includes('challenge'))).toBe(true);
  });

  it('accepts challenge move with disagreementAxis only', () => {
    expect(validateScenario(VALID_SCENARIO)).toHaveLength(0);
  });
});

describe('validateScenario — required move kinds', () => {
  const REQUIRED_KINDS = [
    'challenge_parent',
    'ask_clarification',
    'add_evidence',
    'concede_or_narrow',
    'synthesize_thread',
  ] as const;

  for (const kind of REQUIRED_KINDS) {
    it(`rejects scenario missing move kind: ${kind}`, () => {
      const missing: FixtureScenario = {
        ...VALID_SCENARIO,
        moves: VALID_MOVE_SET.filter((m) => m.moveKind !== kind),
      };
      const errors = validateScenario(missing);
      expect(errors.some((e) => e.includes(kind) || e.toLowerCase().includes('few'))).toBe(true);
    });
  }
});

describe('validateScenario — quote anchors', () => {
  it('rejects scenario with no quote anchor candidate', () => {
    const noAnchor: FixtureScenario = {
      ...VALID_SCENARIO,
      moves: VALID_MOVE_SET.map((m) => ({
        ...m,
        targetExcerpt: undefined,
        displayMeta: { ...m.displayMeta, quoteAnchorCandidate: undefined },
      })),
    };
    const errors = validateScenario(noAnchor);
    expect(errors.some((e) => e.toLowerCase().includes('quote anchor'))).toBe(true);
  });

  it('rejects moves whose targetExcerpt does not appear in parent body', () => {
    const badExcerpt: FixtureScenario = {
      ...VALID_SCENARIO,
      moves: VALID_MOVE_SET.map((m) =>
        m.moveId === 'm2'
          ? { ...m, targetExcerpt: 'this phrase does not exist in m1 body at all' }
          : m,
      ),
    };
    const errors = validateScenario(badExcerpt);
    expect(errors.some((e) => e.toLowerCase().includes('targetexcerpt'))).toBe(true);
  });

  it('accepts targetExcerpt that appears verbatim in parent body', () => {
    expect(validateScenario(VALID_SCENARIO)).toHaveLength(0);
  });
});

describe('validateScenario — playful labels', () => {
  it('rejects scenario with no playful concession label', () => {
    const noPlayful: FixtureScenario = {
      ...VALID_SCENARIO,
      moves: VALID_MOVE_SET.map((m) => ({
        ...m,
        displayMeta: { ...m.displayMeta, playfulLabel: undefined },
      })),
    };
    const errors = validateScenario(noPlayful);
    expect(errors.some((e) => e.toLowerCase().includes('playful'))).toBe(true);
  });
});

describe('validateScenario — forbidden terms', () => {
  for (const term of FORBIDDEN_TERMS) {
    it(`rejects body containing "${term}"`, () => {
      const bad: FixtureScenario = {
        ...VALID_SCENARIO,
        moves: VALID_MOVE_SET.map((m, i) =>
          i === 0 ? { ...m, body: `This move body mentions ${term} and should fail.` } : m,
        ),
      };
      const errors = validateScenario(bad);
      expect(errors.some((e) => e.includes(term))).toBe(true);
    });
  }

  it('rejects email addresses in any field', () => {
    const bad: FixtureScenario = {
      ...VALID_SCENARIO,
      moves: VALID_MOVE_SET.map((m, i) =>
        i === 0 ? { ...m, body: `Contact test@example.com for details.` } : m,
      ),
    };
    const errors = validateScenario(bad);
    expect(errors.some((e) => e.toLowerCase().includes('email'))).toBe(true);
  });

  it('rejects service-role key pattern', () => {
    const bad: FixtureScenario = {
      ...VALID_SCENARIO,
      notes: 'SUPABASE_SERVICE_ROLE=eyJsomefaketokenhere',
    };
    const errors = validateScenario(bad);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects "password" keyword in any text', () => {
    const bad: FixtureScenario = {
      ...VALID_SCENARIO,
      moves: VALID_MOVE_SET.map((m, i) =>
        i === 0 ? { ...m, body: 'Set your password and log in.' } : m,
      ),
    };
    const errors = validateScenario(bad);
    expect(errors.some((e) => e.toLowerCase().includes('password'))).toBe(true);
  });
});

// ── Committed fixture files ───────────────────────────────────

describe('committed fixture files', () => {
  const files = [
    { path: '../fixtures/argument-scenarios/sports-play-in.json', id: 'sports-play-in' },
    { path: '../fixtures/argument-scenarios/pop-culture-trailers.json', id: 'pop-culture-trailers' },
    { path: '../fixtures/argument-scenarios/light-civic-bike-lanes.json', id: 'light-civic-bike-lanes' },
    { path: '../fixtures/argument-scenarios/everyday-remote-work.json', id: 'everyday-remote-work' },
    // MCP-CAT-001-FIXTURE-002 (#453) — runnable under-exercised-id coverage fixture.
    {
      path: '../fixtures/argument-scenarios/catalog-coverage-satire-popularity-routing.json',
      id: 'catalog-coverage-satire-popularity-routing',
    },
  ];

  for (const { path, id } of files) {
    it(`${id} passes validation`, () => {
      const scenario = require(path) as FixtureScenario;
      const errors = validateScenario(scenario);
      if (errors.length > 0) {
        throw new Error(`Validation failed for ${id}:\n${errors.join('\n')}`);
      }
      expect(errors).toHaveLength(0);
    });

    it(`${id} root move has no parent`, () => {
      const scenario = require(path) as FixtureScenario;
      const roots = scenario.moves.filter((m) => m.parentMoveId === null);
      expect(roots.length).toBeGreaterThanOrEqual(1);
    });

    it(`${id} non-root moves have parentMoveId`, () => {
      const scenario = require(path) as FixtureScenario;
      const nonRoots = scenario.moves.filter((m) => m.parentMoveId !== null);
      for (const m of nonRoots) {
        expect(m.parentMoveId).toBeTruthy();
      }
    });

    it(`${id} challenge moves have disagreementAxis`, () => {
      const scenario = require(path) as FixtureScenario;
      const challenges = scenario.moves.filter((m) => m.moveKind === 'challenge_parent');
      for (const m of challenges) {
        expect(m.disagreementAxis ?? m.qualifierCode).toBeTruthy();
      }
    });
  }
});
