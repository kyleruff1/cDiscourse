/**
 * GAME-003 — argument mode model: shape, accessors, invariants.
 *
 * Pure-model tests — no React, no Supabase, no fetch. Covers every public
 * function in `argumentModeModel.ts` including failure cases, plus the two
 * cross-field invariants from the design's edge cases:
 *   - edge case 6: cooldownEnabled === (pacing.cooldownAfterSendSec > 0)
 *   - edge case 7: permanentRecordWarning === pacing.permanentRecordWarning
 */
import {
  ALL_ARGUMENT_MODES,
  MVP_ARGUMENT_MODES,
  DESIGN_ONLY_ARGUMENT_MODES,
  DEFAULT_ARGUMENT_MODE,
  ARGUMENT_MODE_TEMPLATES,
  argumentModeTemplate,
  argumentModeDefinition,
  isShippedMode,
  isSensitiveMode,
  coerceArgumentMode,
  argumentModeDisplayName,
  argumentModeDescription,
  buildModeRuleRows,
  reviewModeForArgumentMode,
  type ArgumentMode,
} from '../src/features/modes/argumentModeModel';
import { isNoPacingRule } from '../src/features/modes/pacingModel';

// ── Enum + list shape ──────────────────────────────────────────

describe('ArgumentMode lists', () => {
  it('ALL_ARGUMENT_MODES has exactly 13 entries', () => {
    expect(ALL_ARGUMENT_MODES).toHaveLength(13);
  });

  it('MVP_ARGUMENT_MODES has exactly 4 entries', () => {
    expect(MVP_ARGUMENT_MODES).toHaveLength(4);
  });

  it('DESIGN_ONLY_ARGUMENT_MODES has exactly 9 entries', () => {
    expect(DESIGN_ONLY_ARGUMENT_MODES).toHaveLength(9);
  });

  it('MVP and design-only sets are disjoint', () => {
    const designSet = new Set<ArgumentMode>(DESIGN_ONLY_ARGUMENT_MODES);
    for (const mvp of MVP_ARGUMENT_MODES) {
      expect(designSet.has(mvp)).toBe(false);
    }
  });

  it('MVP + design-only union equals ALL_ARGUMENT_MODES', () => {
    const union = new Set<ArgumentMode>([
      ...MVP_ARGUMENT_MODES,
      ...DESIGN_ONLY_ARGUMENT_MODES,
    ]);
    expect(union.size).toBe(13);
    for (const mode of ALL_ARGUMENT_MODES) {
      expect(union.has(mode)).toBe(true);
    }
  });

  it('the 4 named MVP modes are the MVP set', () => {
    expect([...MVP_ARGUMENT_MODES].sort()).toEqual(
      [
        'casual_disagreement',
        'court_record_strict',
        'debate_club',
        'internet_fact_check',
      ].sort(),
    );
  });

  it('DEFAULT_ARGUMENT_MODE is casual_disagreement and is an MVP mode', () => {
    expect(DEFAULT_ARGUMENT_MODE).toBe('casual_disagreement');
    expect(MVP_ARGUMENT_MODES).toContain(DEFAULT_ARGUMENT_MODE);
  });

  it('every list has no duplicate entries', () => {
    expect(new Set(ALL_ARGUMENT_MODES).size).toBe(ALL_ARGUMENT_MODES.length);
    expect(new Set(MVP_ARGUMENT_MODES).size).toBe(MVP_ARGUMENT_MODES.length);
    expect(new Set(DESIGN_ONLY_ARGUMENT_MODES).size).toBe(
      DESIGN_ONLY_ARGUMENT_MODES.length,
    );
  });
});

// ── argumentModeTemplate / argumentModeDefinition ──────────────

describe('argumentModeTemplate', () => {
  it('returns a template whose .mode matches the requested mode', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      expect(argumentModeTemplate(mode).mode).toBe(mode);
    }
  });

  it('status is "shipped" iff the mode is an MVP mode', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      const expected = MVP_ARGUMENT_MODES.includes(mode)
        ? 'shipped'
        : 'design_only';
      expect(argumentModeTemplate(mode).status).toBe(expected);
    }
  });

  it('every template definition has all 13 required fields with correct types', () => {
    const toneValues = ['loose', 'normal', 'strict'];
    const informalityValues = ['permissive', 'normal', 'restricted'];
    const semanticValues = ['off', 'metadata_only', 'metadata_and_chip'];
    const recordValues = ['on', 'off'];
    for (const mode of ALL_ARGUMENT_MODES) {
      const def = argumentModeTemplate(mode).definition;
      expect(toneValues).toContain(def.toneStrictness);
      expect(toneValues).toContain(def.evidenceStrictness);
      expect(informalityValues).toContain(def.allowedInformality);
      expect(typeof def.branchesEncouraged).toBe('boolean');
      expect(typeof def.sourceRequestsCentral).toBe('boolean');
      expect(typeof def.finalSynthesisExpected).toBe('boolean');
      expect(recordValues).toContain(def.permanentRecordWarning);
      expect(semanticValues).toContain(def.semanticClassification);
      expect(typeof def.cooldownEnabled).toBe('boolean');
      expect(typeof def.observerModeAllowed).toBe('boolean');
      expect(typeof def.inviteOnly).toBe('boolean');
      // pacing is a PacingRule object with its own fields.
      expect(def.pacing).toBeTruthy();
      expect(typeof def.pacing.cooldownAfterSendSec).toBe('number');
    }
  });

  it('throws on an unknown mode', () => {
    expect(() => argumentModeTemplate('not_a_mode' as ArgumentMode)).toThrow();
  });

  it('argumentModeDefinition equals argumentModeTemplate(mode).definition', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      expect(argumentModeDefinition(mode)).toBe(
        argumentModeTemplate(mode).definition,
      );
    }
  });

  it('argumentModeDefinition throws on an unknown mode', () => {
    expect(() =>
      argumentModeDefinition('not_a_mode' as ArgumentMode),
    ).toThrow();
  });
});

// ── coerceArgumentMode ─────────────────────────────────────────

describe('coerceArgumentMode', () => {
  it('returns the mode unchanged for each valid id', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      expect(coerceArgumentMode(mode)).toBe(mode);
    }
  });

  it('returns DEFAULT_ARGUMENT_MODE for unknown / invalid input', () => {
    expect(coerceArgumentMode('')).toBe(DEFAULT_ARGUMENT_MODE);
    expect(coerceArgumentMode(null)).toBe(DEFAULT_ARGUMENT_MODE);
    expect(coerceArgumentMode(undefined)).toBe(DEFAULT_ARGUMENT_MODE);
    expect(coerceArgumentMode(42)).toBe(DEFAULT_ARGUMENT_MODE);
    expect(coerceArgumentMode({})).toBe(DEFAULT_ARGUMENT_MODE);
    expect(coerceArgumentMode('COURT')).toBe(DEFAULT_ARGUMENT_MODE);
    expect(coerceArgumentMode('casual disagreement')).toBe(
      DEFAULT_ARGUMENT_MODE,
    );
  });

  it('never throws on any input', () => {
    expect(() => coerceArgumentMode([])).not.toThrow();
    expect(() => coerceArgumentMode(Symbol('x') as unknown)).not.toThrow();
    expect(() => coerceArgumentMode(NaN)).not.toThrow();
  });
});

// ── isShippedMode / isSensitiveMode ────────────────────────────

describe('isShippedMode', () => {
  it('is true for the 4 MVP modes and false for the 9 stubs', () => {
    for (const mode of MVP_ARGUMENT_MODES) {
      expect(isShippedMode(mode)).toBe(true);
    }
    for (const mode of DESIGN_ONLY_ARGUMENT_MODES) {
      expect(isShippedMode(mode)).toBe(false);
    }
  });
});

describe('isSensitiveMode', () => {
  it('is true only for co_parenting_custody and relationship_repair', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      const expected =
        mode === 'co_parenting_custody' || mode === 'relationship_repair';
      expect(isSensitiveMode(mode)).toBe(expected);
    }
  });
});

// ── Cross-field invariants (edge cases 6 + 7) ──────────────────

describe('cross-field invariants', () => {
  it('cooldownEnabled === (pacing.cooldownAfterSendSec > 0) for all 13 modes', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      const def = argumentModeDefinition(mode);
      expect(def.cooldownEnabled).toBe(def.pacing.cooldownAfterSendSec > 0);
    }
  });

  it('permanentRecordWarning === pacing.permanentRecordWarning for all 13 modes', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      const def = argumentModeDefinition(mode);
      expect(def.permanentRecordWarning).toBe(
        def.pacing.permanentRecordWarning,
      );
    }
  });
});

// ── Pacing shape ───────────────────────────────────────────────

describe('mode pacing', () => {
  it('every mode pacing rule is a frozen object', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      expect(Object.isFrozen(argumentModeDefinition(mode).pacing)).toBe(true);
    }
  });

  it('the five no-pacing modes report isNoPacingRule true', () => {
    const noPacing: ArgumentMode[] = [
      'casual_disagreement',
      'internet_fact_check',
      'domestic_bickering',
      'historical_debate',
      'recollection_disconnect',
    ];
    for (const mode of noPacing) {
      expect(isNoPacingRule(argumentModeDefinition(mode).pacing)).toBe(true);
    }
  });

  it('court_record_strict carries the documented pacing values', () => {
    const pacing = argumentModeDefinition('court_record_strict').pacing;
    expect(pacing.cooldownAfterSendSec).toBe(120);
    expect(pacing.responseWindowSec).toBe(86400);
    expect(pacing.weightedByCooldown).toBe(true);
    expect(pacing.permanentRecordWarning).toBe('on');
  });

  it('debate_club carries the documented pacing values', () => {
    const pacing = argumentModeDefinition('debate_club').pacing;
    expect(pacing.cooldownAfterSendSec).toBe(30);
    expect(pacing.responseWindowSec).toBe(43200);
    expect(pacing.weightedByCooldown).toBe(false);
  });
});

// ── semanticClassification default ─────────────────────────────

describe('semanticClassification', () => {
  it('is "off" for the five fail-closed modes', () => {
    const offModes: ArgumentMode[] = [
      'casual_disagreement',
      'domestic_bickering',
      'co_parenting_custody',
      'recollection_disconnect',
      'relationship_repair',
    ];
    for (const mode of offModes) {
      expect(argumentModeDefinition(mode).semanticClassification).toBe('off');
    }
  });

  it('internet_fact_check is the only metadata_and_chip MVP mode', () => {
    expect(
      argumentModeDefinition('internet_fact_check').semanticClassification,
    ).toBe('metadata_and_chip');
  });
});

// ── buildModeRuleRows ──────────────────────────────────────────

describe('buildModeRuleRows', () => {
  it('returns a non-empty frozen array for every mode', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      const rows = buildModeRuleRows(mode);
      expect(Object.isFrozen(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
    }
  });

  it('every row label and value is a non-empty string with no underscore', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      for (const row of buildModeRuleRows(mode)) {
        expect(typeof row.label).toBe('string');
        expect(row.label.length).toBeGreaterThan(0);
        expect(typeof row.value).toBe('string');
        expect(row.value.length).toBeGreaterThan(0);
        expect(row.label).not.toContain('_');
        expect(row.value).not.toContain('_');
      }
    }
  });

  it('the row id set is identical across all 13 modes (stable schema)', () => {
    const reference = buildModeRuleRows(ALL_ARGUMENT_MODES[0])
      .map((r) => r.id)
      .sort();
    for (const mode of ALL_ARGUMENT_MODES) {
      const ids = buildModeRuleRows(mode)
        .map((r) => r.id)
        .sort();
      expect(ids).toEqual(reference);
    }
  });

  it('each row object is frozen', () => {
    for (const row of buildModeRuleRows('casual_disagreement')) {
      expect(Object.isFrozen(row)).toBe(true);
    }
  });

  it('is deterministic — two calls deep-equal', () => {
    expect(buildModeRuleRows('court_record_strict')).toEqual(
      buildModeRuleRows('court_record_strict'),
    );
  });

  it('a no-pacing mode shows the no-time-limit pacing row', () => {
    const pacingRow = buildModeRuleRows('casual_disagreement').find(
      (r) => r.id === 'pacing',
    );
    expect(pacingRow?.value.toLowerCase()).toContain('no time limits');
  });

  it('a paced mode shows the short-pause pacing row', () => {
    const pacingRow = buildModeRuleRows('court_record_strict').find(
      (r) => r.id === 'pacing',
    );
    expect(pacingRow?.value.toLowerCase()).toContain('pause');
  });
});

// ── Display name / description ─────────────────────────────────

describe('argumentModeDisplayName / argumentModeDescription', () => {
  it('display names are non-empty strings for all 13 modes', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      const name = argumentModeDisplayName(mode);
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('display names are unique across the 13 modes', () => {
    const names = ALL_ARGUMENT_MODES.map((m) => argumentModeDisplayName(m));
    expect(new Set(names).size).toBe(13);
  });

  it('descriptions are non-empty strings for all 13 modes', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      const desc = argumentModeDescription(mode);
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(0);
    }
  });
});

// ── reviewModeForArgumentMode ──────────────────────────────────

describe('reviewModeForArgumentMode', () => {
  it('restricted-informality modes map to "strict"', () => {
    expect(reviewModeForArgumentMode('court_record_strict')).toBe('strict');
    expect(reviewModeForArgumentMode('research_evidence_review')).toBe(
      'strict',
    );
  });

  it('all other modes map to "casual"', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      if (
        mode === 'court_record_strict' ||
        mode === 'research_evidence_review'
      ) {
        continue;
      }
      expect(reviewModeForArgumentMode(mode)).toBe('casual');
    }
  });
});

// ── Frozen-object guards (edge case 9) ─────────────────────────

describe('immutability', () => {
  it('ARGUMENT_MODE_TEMPLATES is frozen', () => {
    expect(Object.isFrozen(ARGUMENT_MODE_TEMPLATES)).toBe(true);
  });

  it('a sample template + definition are frozen', () => {
    const template = argumentModeTemplate('casual_disagreement');
    expect(Object.isFrozen(template)).toBe(true);
    expect(Object.isFrozen(template.definition)).toBe(true);
  });
});

// ── Determinism ────────────────────────────────────────────────

describe('determinism', () => {
  it('argumentModeDefinition returns the same frozen object reference each call', () => {
    expect(argumentModeDefinition('debate_club')).toBe(
      argumentModeDefinition('debate_club'),
    );
  });
});
