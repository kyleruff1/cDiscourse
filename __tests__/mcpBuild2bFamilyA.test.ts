/**
 * MCP-BUILD2b — Family A (parent_relation) +3 booleans + mapping rows.
 *
 * Build 2b of the ratified MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001 Build-2
 * manifest (§1, Family A). Adds 3 parent-relation quality booleans to Family A
 * + their adopted mapping rows. This Jest suite mirrors the Family-B (Build 2a)
 * suite for the THR-4 forecast (§4 of the spawn card):
 *
 *   1. Client ≡ Edge parity for the 3 new definitions (byte-equal logic via
 *      the Deno bridge helper); unique rawKeys.
 *   2. The 3 new defs are deployed A-G rawKeys (reconciliation) + Family A is
 *      still productionEnabled (no familyRegistry flip).
 *   3. The new registry rules FIRE on the new positive rawKeys via
 *      evaluateObservationMapping; composite-supersedes respected.
 *   4. Verdict-free + describes-the-MOVE-not-the-author ban-list over the 3
 *      new defs + their mapping rows.
 *   5. Adversarial fixtures for acknowledges_parent_strength (a bare-attack
 *      move must NOT trip it; a strength-acknowledging disagreement does; it
 *      never labels the author).
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
  'acknowledges_parent_strength',
  'compares_parent_to_sibling_branch',
  'identifies_parent_scope_limit',
] as const;

const NEW_OBSERVATION_CODES = [
  'parent_relation.single_true.acknowledges_parent_strength',
  'parent_relation.single_false.acknowledges_parent_strength',
  'parent_relation.single_true.compares_parent_to_sibling_branch',
  'parent_relation.single_false.compares_parent_to_sibling_branch',
  'parent_relation.single_true.identifies_parent_scope_limit',
  'parent_relation.single_false.identifies_parent_scope_limit',
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

// A1-specific verdict tokens banned in the label + diagnostic (manifest §1).
const A1_BANNED_TOKENS = ['correct', 'true', 'wins'];

const AUTHOR_LABEL_PATTERNS = [
  'this person',
  'this user',
  'the author is',
  'the author was',
  'you are a',
  'they are a',
];

describe('MCP-BUILD2b — the 3 new Family A definitions exist + are well-formed', () => {
  it('Family A now contains exactly 19 definitions (16 baseline + 3 Build-2b)', () => {
    expect(getDefinitionsForFamily('parent_relation')).toHaveLength(19);
  });

  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" exists with family parent_relation + source ai_classifier`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def).not.toBeNull();
      expect(def?.family).toBe('parent_relation');
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

  it('the 3 new rawKeys are unique (no duplicate within Family A)', () => {
    const familyA = getDefinitionsForFamily('parent_relation');
    const keys = familyA.map((d) => d.rawKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const rawKey of NEW_RAW_KEYS) {
      expect(keys.filter((k) => k === rawKey)).toHaveLength(1);
    }
  });
});

describe('MCP-BUILD2b — client ≡ Edge mirror parity for the 3 new definitions', () => {
  it('Edge mirror Family A also has 19 definitions', () => {
    expect(edgeGetDefinitionsForFamily('parent_relation')).toHaveLength(19);
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

describe('MCP-BUILD2b — NO schema-version bump (byte-equal regression)', () => {
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

describe('MCP-BUILD2b — reconciliation (new rawKeys are deployed A-G rawKeys)', () => {
  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" is in the deployed A-G rawKey set`, () => {
      expect(DEPLOYED_AG_RAW_KEYS.has(rawKey)).toBe(true);
    });
  }
});

describe('MCP-BUILD2b — verdict-free + describes-the-MOVE-not-the-author (definitions)', () => {
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

describe('MCP-BUILD2b — acknowledges_parent_strength is fenced (verdict-adjacent A1)', () => {
  const def = lookupMachineObservationDefinition('acknowledges_parent_strength');

  it('its falsePositiveGuards declare it describes the MOVE, never the author', () => {
    expect(def).not.toBeNull();
    const guards = (def?.falsePositiveGuards ?? []).join(' ').toLowerCase();
    expect(guards).toContain('describes the move, never the author');
  });

  it('its guards state it never asserts the parent IS strong/right', () => {
    const guards = (def?.falsePositiveGuards ?? []).join(' ').toLowerCase();
    expect(guards).toContain('never says the parent is strong or right');
  });

  it('its guards frame ABSENCE as not-a-criticism (no ungracious-author implication)', () => {
    const guards = (def?.falsePositiveGuards ?? []).join(' ').toLowerCase();
    expect(guards).toContain('absence');
    expect(guards).toContain('never');
  });

  it('A1 label + booleanQuestion + diagnostic ban the verdict tokens correct/true/wins', () => {
    // The label, shortLabel, description, and booleanQuestion of the def, plus
    // the diagnostic/labels of every A1 mapping row, must not contain a
    // standalone "correct"/"true"/"wins" verdict token (manifest §1 A1 fence).
    const defFields = [
      def?.label,
      def?.shortLabel,
      def?.description,
      def?.booleanQuestion,
    ].filter((x): x is string => typeof x === 'string');
    const a1Rows = OBSERVATION_MAPPING_REGISTRY.filter(
      (r) =>
        r.requiredTrueFlags.includes('acknowledges_parent_strength') ||
        r.requiredFalseFlags.includes('acknowledges_parent_strength'),
    );
    const a1RowFields: string[] = [];
    for (const r of a1Rows) {
      a1RowFields.push(r.labelShort, r.labelNeutral, r.diagnosticSentence);
    }
    for (const field of [...defFields, ...a1RowFields]) {
      for (const banned of A1_BANNED_TOKENS) {
        const re = new RegExp(`\\b${banned}\\b`, 'i');
        expect(re.test(field)).toBe(false);
      }
    }
  });

  it('its positive examples include a strength-acknowledging disagreement (grants a point, then disagrees)', () => {
    const positives = (def?.positiveExamples ?? []).join(' ').toLowerCase();
    // A move that grants a point ("I accept that" / "I take that as given") then
    // disagrees.
    expect(positives).toContain('accept');
  });

  it('its negative examples include a bare-attack / no-acknowledgement move', () => {
    const negatives = (def?.negativeExamples ?? []).join(' ').toLowerCase();
    // A disagreement with no acknowledgement, or acknowledgement only — neither
    // trips the flag.
    expect(negatives).toContain('acknowledgement');
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

describe('MCP-BUILD2b — compares_parent_to_sibling_branch reliability carry-forward (A2)', () => {
  it('its doctrineNotes record the admin_validation precision / defer-if-noisy carry-forward', () => {
    const def = lookupMachineObservationDefinition('compares_parent_to_sibling_branch');
    const notes = (def?.doctrineNotes ?? []).join(' ').toLowerCase();
    expect(notes).toContain('reliability carry-forward');
    expect(notes).toContain('admin_validation');
    expect(notes).toContain('defer');
  });
});

describe('MCP-BUILD2b — new mapping rows fire via evaluateObservationMapping', () => {
  it('acknowledges_parent_strength single_true rule (MBOM-00019) fires in isolation', () => {
    // Evaluate the single rule alone so no richer composite supersedes it.
    const single = OBSERVATION_MAPPING_REGISTRY.find((r) => r.mappingId === 'MBOM-00019');
    expect(single).toBeDefined();
    const out = evaluateObservationMapping(
      ['acknowledges_parent_strength'],
      [single!],
      { surface: 'card' },
    );
    expect(out.some((m) => m.mappingId === 'MBOM-00019')).toBe(true);
  });

  it('lone acknowledges_parent_strength positive → its asymmetric pairs supersede the bare single', () => {
    // In the FULL registry, a lone acknowledges positive (with the other two
    // quality flags absent) trips the pair_true_false rules, which CONSUME
    // acknowledges_parent_strength and supersede the bare single MBOM-00019.
    const out = evaluateObservationMapping(
      ['acknowledges_parent_strength'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    expect(ids).toContain('MBOM-00459'); // acknowledges present, sibling-compare absent
    expect(ids).toContain('MBOM-00462'); // acknowledges present, scope-limit absent
    expect(ids).not.toContain('MBOM-00019'); // bare single superseded by the pairs
  });

  it('acknowledges_parent_strength absent → its single_false rule fires', () => {
    // Seed an unrelated deployed positive so the evaluator runs; the absence
    // of acknowledges_parent_strength trips the negative rule.
    const out = evaluateObservationMapping(
      ['challenges_parent'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    expect(out.some((m) => m.mappingId === 'MBOM-00020')).toBe(true);
  });

  it('all 3 quality booleans positive → the pair rules fire and supersede consumed singles', () => {
    const out = evaluateObservationMapping(
      [
        'acknowledges_parent_strength',
        'compares_parent_to_sibling_branch',
        'identifies_parent_scope_limit',
      ],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    // The pair_true_true rules consume the singles whose rawKey they include,
    // so the singles MBOM-00019/21/23 are superseded.
    expect(ids).toContain('MBOM-00458'); // acknowledges × compares
    expect(ids).toContain('MBOM-00461'); // acknowledges × identifies
    expect(ids).toContain('MBOM-00464'); // compares × identifies
    expect(ids).not.toContain('MBOM-00019'); // consumed
    expect(ids).not.toContain('MBOM-00021'); // consumed
    expect(ids).not.toContain('MBOM-00023'); // consumed
  });

  it('every emitted mark for the new rules is machine_observation + carries no gate field', () => {
    const out = evaluateObservationMapping(
      ['acknowledges_parent_strength', 'compares_parent_to_sibling_branch'],
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

describe('MCP-BUILD2b — mapping rows manifest + plain-language routing', () => {
  it('the manifest records exactly 15 adopted Build-2b Family A rules', () => {
    expect(OBSERVATION_MAPPING_ADOPTION_MANIFEST.build2bFamilyAAdoptedRules).toBe(15);
  });

  it('15 registry rules reference at least one of the 3 new rawKeys', () => {
    const newKeySet = new Set<string>(NEW_RAW_KEYS);
    const build2bRules = OBSERVATION_MAPPING_REGISTRY.filter((r) => {
      const flags = [...r.requiredTrueFlags, ...r.requiredFalseFlags];
      return flags.some((f) => newKeySet.has(f));
    });
    expect(build2bRules).toHaveLength(15);
    // Every flag in those rules is exactly one of the 3 new keys (the adopted
    // rows are scoped to the 3-flag subset per the design's adopt list).
    for (const rule of build2bRules) {
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
});
