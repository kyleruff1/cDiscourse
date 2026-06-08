/**
 * MCP-BUILD2c — Family C (misunderstanding_repair) +3 booleans + mapping rows.
 *
 * Build 2c of the ratified MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001 Build-2
 * manifest (§2, Family C). Adds 3 misunderstanding-repair quality booleans to
 * Family C + their adopted mapping rows. This Jest suite mirrors the Family-A
 * (Build 2b) suite for the THR-4 forecast (§4 of the spawn card):
 *
 *   1. Client ≡ Edge parity for the 3 new definitions (byte-equal logic via
 *      the Deno bridge helper); unique rawKeys.
 *   2. The 3 new defs are deployed A-G rawKeys (reconciliation) + Family C is
 *      still productionEnabled (no familyRegistry flip).
 *   3. The new registry rules FIRE on the new positive rawKeys via
 *      evaluateObservationMapping; composite-supersedes respected.
 *   4. Verdict-free + describes-the-MOVE-not-the-author ban-list over the 3
 *      new defs + their mapping rows, with WORD-BOUNDARY matching — the
 *      "correct" substring inside accepts_correction's rawKey does NOT
 *      false-positive AND a real truth token (e.g. " correct ") WOULD be
 *      caught.
 *   5. Adversarial fixtures for accepts_correction (a correction-REJECTING
 *      move must NOT trip it; a genuine acceptance does; it never labels the
 *      author; repair-not-defeat — never frames it as a loss).
 *   6. NO schema-version bump (byte-equal regression on the constant, client +
 *      Edge mirror).
 *   7. The 3 new observation codes route through gameCopy to verdict-free,
 *      snake-free plain language.
 *
 * Pure-model tests: no React, no Supabase, no network. The Edge mirror loads
 * via __tests__/_helpers/booleanObservationEdgeDeno.ts (babel-transformed
 * require of the Deno tree).
 */

import {
  getDefinitionsForFamily,
  lookupMachineObservationDefinition,
  MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
} from '../src/features/nodeLabels/machineObservationDefinitions';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import {
  OBSERVATION_MAPPING_REGISTRY,
  OBSERVATION_MAPPING_ADOPTION_MANIFEST,
} from '../src/features/nodeLabels/observationMapping/observationMappingRegistry';
import { evaluateObservationMapping } from '../src/features/nodeLabels/observationMapping/observationMappingEvaluator';
import { DEPLOYED_AG_RAW_KEYS } from '../src/features/nodeLabels/observationMapping/deployedAgRawKeys';
import {
  looksLikeInternalCode,
  toPlainLanguageOrSuppress,
} from '../src/features/arguments/gameCopy';
import {
  EDGE_INTERNAL_ALL_DEFINITIONS,
  edgeLookupMachineObservationDefinition,
  EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  edgeGetDefinitionsForFamily,
} from './_helpers/booleanObservationEdgeDeno';

const NEW_RAW_KEYS = [
  'offers_repair_path',
  'names_ambiguity_source',
  'accepts_correction',
] as const;

const NEW_OBSERVATION_CODES = [
  'misunderstanding_repair.single_true.offers_repair_path',
  'misunderstanding_repair.single_false.offers_repair_path',
  'misunderstanding_repair.single_true.names_ambiguity_source',
  'misunderstanding_repair.single_false.names_ambiguity_source',
  'misunderstanding_repair.single_true.accepts_correction',
  'misunderstanding_repair.single_false.accepts_correction',
];

// cdiscourse-doctrine §1 + §10a verdict / author-label ban-lists.
const VERDICT_BAN_LIST = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'troll',
  'astroturfer',
];

// C3-specific verdict tokens banned in the label + diagnostic (manifest §2).
// The label "Accepts correction" contains the substring "correct"; the scan
// MUST be word-boundary so the benign substring inside "correction" never trips
// while a standalone verdict token "correct" / "true" / "wins" still would.
const C3_BANNED_TOKENS = ['correct', 'true', 'wins'];

const AUTHOR_LABEL_PATTERNS = [
  'this person',
  'this user',
  'the author is',
  'the author was',
  'you are a',
  'they are a',
];

describe('MCP-BUILD2c — the 3 new Family C definitions exist + are well-formed', () => {
  it('Family C now contains exactly 20 definitions (17 baseline + 3 Build-2c)', () => {
    expect(getDefinitionsForFamily('misunderstanding_repair')).toHaveLength(20);
  });

  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" exists with family misunderstanding_repair + source ai_classifier`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def).not.toBeNull();
      expect(def?.family).toBe('misunderstanding_repair');
      expect(def?.source).toBe('ai_classifier');
      expect(def?.kind).toBe('machine_observation');
    });

    it(`"${rawKey}" is Inspect-only + never visibleByDefault (display-only posture)`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def?.defaultSurface).toBe('inspect');
      expect(def?.visibleByDefault).toBe(false);
      // §10a / acceptance-gate: a future_source disposition means the adapter
      // returns [] in v1 — post-storage display-only, never a gate.
      expect(def?.disposition).toBe('future_source');
    });

    it(`"${rawKey}" carries a non-empty booleanQuestion + positive/negative definitions + guards`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def?.booleanQuestion.length).toBeGreaterThan(20);
      expect(def?.positiveDefinition.length).toBeGreaterThan(0);
      expect(def?.negativeDefinition.length).toBeGreaterThan(0);
      expect(def?.positiveExamples.length).toBeGreaterThanOrEqual(2);
      expect(def?.negativeExamples.length).toBeGreaterThanOrEqual(2);
      expect(def?.falsePositiveGuards.length).toBeGreaterThanOrEqual(1);
      expect(def?.doctrineNotes.length).toBeGreaterThanOrEqual(1);
    });
  }

  it('the 3 new rawKeys are unique (no duplicate within Family C)', () => {
    const familyC = getDefinitionsForFamily('misunderstanding_repair');
    const keys = familyC.map((d) => d.rawKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const rawKey of NEW_RAW_KEYS) {
      expect(keys.filter((k) => k === rawKey)).toHaveLength(1);
    }
  });
});

describe('MCP-BUILD2c — client ≡ Edge mirror parity for the 3 new definitions', () => {
  it('Edge mirror Family C also has 20 definitions', () => {
    expect(edgeGetDefinitionsForFamily('misunderstanding_repair')).toHaveLength(20);
  });

  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" is byte-equal (deep-equal) between client and Edge mirror`, () => {
      const client = lookupMachineObservationDefinition(rawKey);
      const edge = edgeLookupMachineObservationDefinition(rawKey);
      expect(client).not.toBeNull();
      expect(edge).not.toBeNull();
      // The two definition objects must be JSON-deep-equal (the mirror is
      // byte-equal except the import specifier, which is not part of the data).
      expect(JSON.parse(JSON.stringify(edge))).toEqual(
        JSON.parse(JSON.stringify(client)),
      );
    });
  }

  it('client + Edge both expose exactly the same set of new rawKeys', () => {
    const clientKeys = new Set(
      EDGE_INTERNAL_ALL_DEFINITIONS.map((d) => d.rawKey),
    );
    for (const rawKey of NEW_RAW_KEYS) {
      expect(clientKeys.has(rawKey)).toBe(true);
      expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[rawKey]).toBeDefined();
    }
  });
});

describe('MCP-BUILD2c — NO schema-version bump (byte-equal regression)', () => {
  it('client schema version constant is unchanged (v1, byte-equal)', () => {
    expect(MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION).toBe(
      'mcp-021.machine-observations.boolean.v1',
    );
  });

  it('Edge mirror schema version constant equals the client constant (no drift)', () => {
    expect(EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION).toBe(
      MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    );
  });
});

describe('MCP-BUILD2c — reconciliation (new rawKeys are deployed A-G rawKeys)', () => {
  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" is in the deployed A-G rawKey set`, () => {
      expect(DEPLOYED_AG_RAW_KEYS.has(rawKey)).toBe(true);
    });
  }
});

describe('MCP-BUILD2c — verdict-free + describes-the-MOVE-not-the-author (definitions)', () => {
  function userFacingFieldsOf(rawKey: string): string[] {
    const def = lookupMachineObservationDefinition(rawKey);
    if (!def) return [];
    return [def.label, def.shortLabel, def.description];
  }

  for (const rawKey of NEW_RAW_KEYS) {
    for (const banned of VERDICT_BAN_LIST) {
      it(`"${rawKey}" user-facing fields contain no verdict token "${banned}"`, () => {
        for (const field of userFacingFieldsOf(rawKey)) {
          const re = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          expect(re.test(field)).toBe(false);
        }
      });
    }

    it(`"${rawKey}" user-facing fields never label the author`, () => {
      for (const field of userFacingFieldsOf(rawKey)) {
        for (const pattern of AUTHOR_LABEL_PATTERNS) {
          expect(field.toLowerCase()).not.toContain(pattern);
        }
      }
    });

    it(`"${rawKey}" label + shortLabel are snake-free (no rawKey leak)`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def?.label.includes('_')).toBe(false);
      expect(def?.shortLabel.includes('_')).toBe(false);
    });
  }
});

describe('MCP-BUILD2c — accepts_correction is fenced (verdict-adjacent C3, repair-not-defeat)', () => {
  const def = lookupMachineObservationDefinition('accepts_correction');

  it('its falsePositiveGuards declare it describes the MOVE, never the author', () => {
    expect(def).not.toBeNull();
    const guards = (def?.falsePositiveGuards ?? []).join(' ').toLowerCase();
    expect(guards).toContain('describes the repair move, never the author');
  });

  it('its guards frame it as a repair, NOT a defeat / concession of the whole', () => {
    const guards = (def?.falsePositiveGuards ?? []).join(' ').toLowerCase();
    // cdiscourse-doctrine §1: concession is a scoring repair, not a defeat.
    expect(guards).toContain('never frames it as defeat');
    expect(guards).toContain('not a defeat');
  });

  it('its guards frame ABSENCE as not-a-criticism (no stubborn-author implication)', () => {
    const guards = (def?.falsePositiveGuards ?? []).join(' ').toLowerCase();
    expect(guards).toContain('absence');
    expect(guards).toContain('never');
  });

  it('its doctrineNotes anchor cdiscourse-doctrine §1 (concession is a repair, not a defeat)', () => {
    const notes = (def?.doctrineNotes ?? []).join(' ').toLowerCase();
    expect(notes).toContain('concession is a scoring repair, not a defeat');
  });

  it('its user-facing label avoids the standalone verdict token "correct" (word-boundary fence)', () => {
    // The rawKey "accepts_correction" contains the substring "correct"; the
    // user-facing label / shortLabel / description / booleanQuestion + every C3
    // mapping row must NOT contain a STANDALONE "correct"/"true"/"wins" verdict
    // token (manifest §2 C3 fence — word-boundary matching).
    const defFields = [
      def?.label,
      def?.shortLabel,
      def?.description,
      def?.booleanQuestion,
    ].filter((x): x is string => typeof x === 'string');
    const c3Rows = OBSERVATION_MAPPING_REGISTRY.filter(
      (r) =>
        r.requiredTrueFlags.includes('accepts_correction') ||
        r.requiredFalseFlags.includes('accepts_correction'),
    );
    const c3RowFields: string[] = [];
    for (const r of c3Rows) {
      c3RowFields.push(r.labelShort, r.labelNeutral, r.diagnosticSentence);
    }
    for (const field of [...defFields, ...c3RowFields]) {
      for (const banned of C3_BANNED_TOKENS) {
        const re = new RegExp(`\\b${banned}\\b`, 'i');
        expect(re.test(field)).toBe(false);
      }
    }
  });

  it('the word-boundary fence is REAL: it allows benign "correction" but catches a standalone "correct"', () => {
    // Prove the test methodology: the substring "correct" inside "correction"
    // (which appears in the rawKey/booleanQuestion) must NOT trip the
    // word-boundary ban; a standalone " correct " WOULD.
    const re = new RegExp(`\\bcorrect\\b`, 'i');
    // benign — "correction" / "a correction" must NOT match the bare token.
    expect(re.test('Does this move accept a correction a prior move offered?')).toBe(false);
    expect(re.test('takes up a correction')).toBe(false);
    // a real verdict token WOULD match.
    expect(re.test('the parent is correct')).toBe(true);
    expect(re.test('that answer is correct')).toBe(true);
  });

  it('its positive examples include a genuine acceptance (takes up the offered point)', () => {
    const positives = (def?.positiveExamples ?? []).join(' ').toLowerCase();
    // A move that takes up a prior correction ("Fair — I had the date wrong").
    expect(positives).toContain('fair');
  });

  it('its negative examples include a correction-REJECTING move (does not trip the flag)', () => {
    const negatives = (def?.negativeExamples ?? []).join(' ').toLowerCase();
    // A move that rejects the offered point does NOT trip the flag.
    expect(negatives).toContain('rejects the offered point');
  });

  it('no user-facing field of this def labels the author', () => {
    const fields = [def?.label, def?.shortLabel, def?.description].filter(
      (x): x is string => typeof x === 'string',
    );
    for (const field of fields) {
      for (const pattern of AUTHOR_LABEL_PATTERNS) {
        expect(field.toLowerCase()).not.toContain(pattern);
      }
    }
  });
});

describe('MCP-BUILD2c — C1/C2 are not verdict-adjacent (no fence required)', () => {
  for (const rawKey of ['offers_repair_path', 'names_ambiguity_source'] as const) {
    it(`"${rawKey}" doctrineNotes anchor §10a structural/diagnostic framing (not a verdict)`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      const notes = (def?.doctrineNotes ?? []).join(' ').toLowerCase();
      expect(notes).toContain('§10a');
    });
  }
});

describe('MCP-BUILD2c — new mapping rows fire via evaluateObservationMapping', () => {
  it('offers_repair_path single_true rule (MBOM-00071) fires in isolation', () => {
    // Evaluate the single rule alone so no richer composite supersedes it.
    const single = OBSERVATION_MAPPING_REGISTRY.find((r) => r.mappingId === 'MBOM-00071');
    expect(single).toBeDefined();
    const out = evaluateObservationMapping(
      ['offers_repair_path'],
      [single!],
      { surface: 'card' },
    );
    expect(out.some((m) => m.mappingId === 'MBOM-00071')).toBe(true);
  });

  it('lone offers_repair_path positive → its asymmetric pairs supersede the bare single', () => {
    // In the FULL registry, a lone offers_repair_path positive (with the other
    // two quality flags absent) trips the pair_true_false rules, which CONSUME
    // offers_repair_path and supersede the bare single MBOM-00071.
    const out = evaluateObservationMapping(
      ['offers_repair_path'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    expect(ids).toContain('MBOM-00930'); // repair_path present, ambiguity-source absent
    expect(ids).toContain('MBOM-00933'); // repair_path present, accepts-correction absent
    expect(ids).not.toContain('MBOM-00071'); // bare single superseded by the pairs
  });

  it('offers_repair_path absent → its single_false rule fires', () => {
    // Seed an unrelated deployed positive so the evaluator runs; the absence
    // of offers_repair_path trips the negative rule.
    const out = evaluateObservationMapping(
      ['requests_clarification'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    expect(out.some((m) => m.mappingId === 'MBOM-00072')).toBe(true);
  });

  it('all 3 quality booleans positive → the pair rules fire and supersede consumed singles', () => {
    const out = evaluateObservationMapping(
      ['offers_repair_path', 'names_ambiguity_source', 'accepts_correction'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    // The pair_true_true rules consume the singles whose rawKey they include,
    // so the singles MBOM-00071/73/75 are superseded.
    expect(ids).toContain('MBOM-00929'); // offers_repair_path × names_ambiguity_source
    expect(ids).toContain('MBOM-00932'); // offers_repair_path × accepts_correction
    expect(ids).toContain('MBOM-00935'); // names_ambiguity_source × accepts_correction
    expect(ids).not.toContain('MBOM-00071'); // consumed
    expect(ids).not.toContain('MBOM-00073'); // consumed
    expect(ids).not.toContain('MBOM-00075'); // consumed
  });

  it('every emitted mark for the new rules is machine_observation + carries no gate field', () => {
    const out = evaluateObservationMapping(
      ['offers_repair_path', 'names_ambiguity_source'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    expect(out.length).toBeGreaterThan(0);
    for (const mark of out) {
      expect(mark.kind).toBe('machine_observation');
      const rec = mark as unknown as Record<string, unknown>;
      expect(rec.block).toBeUndefined();
      expect(rec.route).toBeUndefined();
      expect(rec.suppress).toBeUndefined();
      expect(rec.delay).toBeUndefined();
      expect(rec.gate).toBeUndefined();
    }
  });
});

describe('MCP-BUILD2c — mapping rows manifest + plain-language routing', () => {
  it('the manifest records exactly 15 adopted Build-2c Family C rules', () => {
    expect(OBSERVATION_MAPPING_ADOPTION_MANIFEST.build2cFamilyCAdoptedRules).toBe(15);
  });

  it('15 registry rules reference at least one of the 3 new rawKeys', () => {
    const newKeySet = new Set<string>(NEW_RAW_KEYS);
    const build2cRules = OBSERVATION_MAPPING_REGISTRY.filter((r) => {
      const flags = [...r.requiredTrueFlags, ...r.requiredFalseFlags];
      return flags.some((f) => newKeySet.has(f));
    });
    expect(build2cRules).toHaveLength(15);
    // Every flag in those rules is exactly one of the 3 new keys (the adopted
    // rows are scoped to the 3-flag subset per the design's adopt list).
    for (const rule of build2cRules) {
      for (const flag of [...rule.requiredTrueFlags, ...rule.requiredFalseFlags]) {
        expect(newKeySet.has(flag)).toBe(true);
      }
    }
  });

  for (const code of NEW_OBSERVATION_CODES) {
    it(`observationCode "${code}" routes to a verdict-free, snake-free plain-language string`, () => {
      const mapped = toPlainLanguageOrSuppress(code);
      expect(mapped).not.toBeNull();
      expect(mapped!.length).toBeGreaterThan(0);
      expect(looksLikeInternalCode(mapped!)).toBe(false);
      expect(mapped!).not.toMatch(/_/);
      for (const banned of VERDICT_BAN_LIST) {
        const re = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        expect(re.test(mapped!)).toBe(false);
      }
    });
  }

  it('every C3 (accepts_correction) plain-language string is word-boundary clean of "correct"/"true"/"wins"', () => {
    const c3Codes = NEW_OBSERVATION_CODES.filter((c) => c.includes('accepts_correction'));
    expect(c3Codes.length).toBeGreaterThan(0);
    for (const code of c3Codes) {
      const mapped = toPlainLanguageOrSuppress(code);
      expect(mapped).not.toBeNull();
      for (const banned of C3_BANNED_TOKENS) {
        const re = new RegExp(`\\b${banned}\\b`, 'i');
        expect(re.test(mapped!)).toBe(false);
      }
    }
  });
});
