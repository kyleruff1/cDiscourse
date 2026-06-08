/**
 * MCP-BUILD2f — Family F (critical_question) +3 booleans + mapping rows.
 *
 * Build 2f of the ratified MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001 Build-2
 * manifest (§5, Family F). Adds 3 question-quality booleans to Family F + their
 * adopted mapping rows (the only family whose unlock set carries a
 * curated_triple). This Jest suite mirrors the Family-A/C/E (Build 2b/2c/2e)
 * suites for the THR-4 forecast (§4 of the spawn card):
 *
 *   1. Client ≡ Edge parity for the 3 new definitions (byte-equal logic via
 *      the Deno bridge helper); unique rawKeys.
 *   2. The 3 new defs are deployed A-G rawKeys (reconciliation) + Family F is
 *      still productionEnabled (no familyRegistry flip).
 *   3. The new registry rules FIRE on the new positive rawKeys via
 *      evaluateObservationMapping; composite-supersedes (incl. the triple)
 *      respected.
 *   4. Verdict-free + describes-the-MOVE-not-the-author ban-list over the 3
 *      new defs + their mapping rows, with WORD-BOUNDARY matching.
 *   5. The 3 new keys use the question_* prefix (manifest §5.2).
 *   6. Adversarial fixtures for question_invites_revision (F3, verdict-adjacent):
 *      an open improvement-seeking question DOES trip it; a gotcha/closure-framed
 *      question must NOT; it never labels the author; invites-revision-is-not-a-
 *      verdict (never frames the parent as wrong/weak or as NEEDING revision).
 *   7. NO schema-version bump (byte-equal regression on the constant, client +
 *      Edge mirror).
 *   8. The 16 new observation codes route through gameCopy to verdict-free,
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
  'question_names_uncertainty',
  'question_separates_claim_evidence',
  'question_invites_revision',
] as const;

const NEW_OBSERVATION_CODES = [
  'critical_question.single_true.question_names_uncertainty',
  'critical_question.single_false.question_names_uncertainty',
  'critical_question.single_true.question_separates_claim_evidence',
  'critical_question.single_false.question_separates_claim_evidence',
  'critical_question.single_true.question_invites_revision',
  'critical_question.single_false.question_invites_revision',
  'critical_question.pair_true_true.question_names_uncertainty.question_separates_claim_evidence',
  'critical_question.pair_true_false.question_names_uncertainty.no_claim_evidence_separation',
  'critical_question.pair_false_true.question_separates_claim_evidence.no_named_uncertainty',
  'critical_question.pair_true_true.question_names_uncertainty.question_invites_revision',
  'critical_question.pair_true_false.question_names_uncertainty.no_invites_revision',
  'critical_question.pair_false_true.question_invites_revision.no_named_uncertainty',
  'critical_question.pair_true_true.question_separates_claim_evidence.question_invites_revision',
  'critical_question.pair_true_false.question_separates_claim_evidence.no_invites_revision',
  'critical_question.pair_false_true.question_invites_revision.no_claim_evidence_separation',
  'critical_question.curated_triple.question_names_uncertainty.question_separates_claim_evidence.question_invites_revision',
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

// F3-specific verdict tokens banned in the label + diagnostic (manifest §5).
// "Invites revision" can read as "the parent is deficient and must be revised";
// the user-facing strings must NOT contain a standalone weakness verdict token.
const F3_BANNED_TOKENS = ['weak', 'wrong', 'flawed', 'invalid', 'fallacy', 'fallacious'];

const AUTHOR_LABEL_PATTERNS = [
  'this person',
  'this user',
  'the author is',
  'the author was',
  'you are a',
  'they are a',
  'reasons sloppily',
];

describe('MCP-BUILD2f — the 3 new Family F definitions exist + are well-formed', () => {
  it('Family F now contains exactly 17 definitions (14 baseline + 3 Build-2f)', () => {
    expect(getDefinitionsForFamily('critical_question')).toHaveLength(17);
  });

  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" exists with family critical_question + source ai_classifier`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def).not.toBeNull();
      expect(def?.family).toBe('critical_question');
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

    it(`"${rawKey}" uses the question_* prefix (manifest §5.2)`, () => {
      expect(rawKey.startsWith('question_')).toBe(true);
    });
  }

  it('the 3 new rawKeys are unique (no duplicate within Family F)', () => {
    const familyF = getDefinitionsForFamily('critical_question');
    const keys = familyF.map((d) => d.rawKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const rawKey of NEW_RAW_KEYS) {
      expect(keys.filter((k) => k === rawKey)).toHaveLength(1);
    }
  });
});

describe('MCP-BUILD2f — client ≡ Edge mirror parity for the 3 new definitions', () => {
  it('Edge mirror Family F also has 17 definitions', () => {
    expect(edgeGetDefinitionsForFamily('critical_question')).toHaveLength(17);
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
    const edgeKeys = new Set(EDGE_INTERNAL_ALL_DEFINITIONS.map((d) => d.rawKey));
    for (const rawKey of NEW_RAW_KEYS) {
      expect(edgeKeys.has(rawKey)).toBe(true);
      expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[rawKey]).toBeDefined();
    }
  });
});

describe('MCP-BUILD2f — NO schema-version bump (byte-equal regression)', () => {
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

describe('MCP-BUILD2f — reconciliation (new rawKeys are deployed A-G rawKeys)', () => {
  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" is in the deployed A-G rawKey set`, () => {
      expect(DEPLOYED_AG_RAW_KEYS.has(rawKey)).toBe(true);
    });
  }
});

describe('MCP-BUILD2f — verdict-free + describes-the-MOVE-not-the-author (definitions)', () => {
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

describe('MCP-BUILD2f — question_invites_revision is fenced (verdict-adjacent F3, invites-revision-not-a-verdict)', () => {
  const def = lookupMachineObservationDefinition('question_invites_revision');

  it('its falsePositiveGuards declare it describes the MOVE, never the author', () => {
    expect(def).not.toBeNull();
    const guards = (def?.falsePositiveGuards ?? []).join(' ').toLowerCase();
    expect(guards).toContain('describes the collaborative stance of the move');
    expect(guards).toContain('never the author');
  });

  it('its guards frame an open question as an invitation, NOT a verdict that the parent NEEDS revision', () => {
    const guards = (def?.falsePositiveGuards ?? []).join(' ').toLowerCase();
    // cdiscourse-doctrine §1: invites-revision-is-not-a-verdict.
    expect(guards).toContain('never asserts the parent is wrong, weak, or that the parent needs revision');
    expect(guards).toContain('an invitation to refine, not a judgment that refinement is required');
  });

  it('its guards reject gotcha questions dressed politely (stance not politeness)', () => {
    const guards = (def?.falsePositiveGuards ?? []).join(' ').toLowerCase();
    expect(guards).toContain('do not mark gotcha questions dressed politely');
    expect(guards).toContain('so you admit x?');
  });

  it('its doctrineNotes anchor cdiscourse-doctrine §1 (invites-revision-not-a-verdict)', () => {
    const notes = (def?.doctrineNotes ?? []).join(' ').toLowerCase();
    expect(notes).toContain('invites-revision-not-a-verdict');
    expect(notes).toContain('never that the parent is wrong/weak or needs revision');
  });

  it('its user-facing label + every F3 mapping row avoid standalone weakness verdict tokens', () => {
    const defFields = [def?.label, def?.shortLabel, def?.description].filter(
      (x): x is string => typeof x === 'string',
    );
    const f3Rows = OBSERVATION_MAPPING_REGISTRY.filter(
      (r) =>
        r.requiredTrueFlags.includes('question_invites_revision') ||
        r.requiredFalseFlags.includes('question_invites_revision'),
    );
    const f3RowFields: string[] = [];
    for (const r of f3Rows) {
      f3RowFields.push(r.labelShort, r.labelNeutral, r.diagnosticSentence);
    }
    for (const field of [...defFields, ...f3RowFields]) {
      for (const banned of F3_BANNED_TOKENS) {
        const re = new RegExp(`\\b${banned}\\b`, 'i');
        expect(re.test(field)).toBe(false);
      }
    }
  });

  it('adversarial: a gotcha/closure-framed question must NOT trip the single_true rule', () => {
    // The classifier returns question_invites_revision=false for a closure-framed
    // gotcha question ("So you admit X?"). The evaluator must then NOT emit any
    // rule that REQUIRES question_invites_revision, and may emit its single_false.
    const out = evaluateObservationMapping(
      ['question_names_uncertainty'], // some question quality present, but NOT invites_revision
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    const firedIds = new Set(out.map((m) => m.mappingId));
    // The question_invites_revision single_true (MBOM-00147) must NOT fire.
    expect(firedIds.has('MBOM-00147')).toBe(false);
    const requiresInvitesTrue = OBSERVATION_MAPPING_REGISTRY.filter(
      (r) => firedIds.has(r.mappingId) && r.requiredTrueFlags.includes('question_invites_revision'),
    );
    expect(requiresInvitesTrue).toHaveLength(0);
  });

  it('adversarial: an open improvement-seeking question DOES trip the single_true rule', () => {
    const single = OBSERVATION_MAPPING_REGISTRY.find((r) => r.mappingId === 'MBOM-00147');
    expect(single).toBeDefined();
    const out = evaluateObservationMapping(
      ['question_invites_revision'],
      [single!],
      { surface: 'card' },
    );
    expect(out.some((m) => m.mappingId === 'MBOM-00147')).toBe(true);
  });

  it('its positive examples include an open / improvement-seeking question', () => {
    const positives = (def?.positiveExamples ?? []).join(' ').toLowerCase();
    expect(positives).toContain('narrower version');
  });

  it('its negative examples include a closure / gotcha question (does not trip the flag)', () => {
    const negatives = (def?.negativeExamples ?? []).join(' ').toLowerCase();
    expect(negatives).toContain('no evidence');
  });
});

describe('MCP-BUILD2f — F1/F2 are not verdict-adjacent (no fence required)', () => {
  for (const rawKey of ['question_names_uncertainty', 'question_separates_claim_evidence'] as const) {
    it(`"${rawKey}" doctrineNotes anchor §10a structural framing (not a verdict)`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      const notes = (def?.doctrineNotes ?? []).join(' ').toLowerCase();
      expect(notes).toContain('§10a');
    });
  }
});

describe('MCP-BUILD2f — new mapping rows fire via evaluateObservationMapping', () => {
  it('question_names_uncertainty single_true rule (MBOM-00143) fires in isolation', () => {
    const single = OBSERVATION_MAPPING_REGISTRY.find((r) => r.mappingId === 'MBOM-00143');
    expect(single).toBeDefined();
    const out = evaluateObservationMapping(
      ['question_names_uncertainty'],
      [single!],
      { surface: 'card' },
    );
    expect(out.some((m) => m.mappingId === 'MBOM-00143')).toBe(true);
  });

  it('lone question_names_uncertainty positive → its asymmetric pairs supersede the bare single', () => {
    const out = evaluateObservationMapping(
      ['question_names_uncertainty'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    expect(ids).toContain('MBOM-01335'); // names-uncertainty present, separates-claim/evidence absent
    expect(ids).toContain('MBOM-01338'); // names-uncertainty present, invites-revision absent
    expect(ids).not.toContain('MBOM-00143'); // bare single superseded by the pairs
  });

  it('question_names_uncertainty absent → its single_false rule fires', () => {
    const out = evaluateObservationMapping(
      ['missing_warrant'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    expect(out.some((m) => m.mappingId === 'MBOM-00144')).toBe(true);
  });

  it('all 3 question-quality booleans positive → the curated_triple fires and supersedes the consumed singles', () => {
    const out = evaluateObservationMapping(
      [
        'question_names_uncertainty',
        'question_separates_claim_evidence',
        'question_invites_revision',
      ],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    // The curated_triple fires.
    expect(ids).toContain('MBOM-01343');
    // The intra-3 pair_true_true rows still render (pairs are not superseded by
    // the evaluator's single-only supersede pass).
    expect(ids).toContain('MBOM-01334'); // names × separates
    expect(ids).toContain('MBOM-01337'); // names × invites
    expect(ids).toContain('MBOM-01340'); // separates × invites
    // The 3 single_true rows are fully consumed → suppressed.
    expect(ids).not.toContain('MBOM-00143');
    expect(ids).not.toContain('MBOM-00145');
    expect(ids).not.toContain('MBOM-00147');
  });

  it('the curated_triple (MBOM-01343) requires exactly the 3 new F flags', () => {
    const triple = OBSERVATION_MAPPING_REGISTRY.find((r) => r.mappingId === 'MBOM-01343');
    expect(triple).toBeDefined();
    expect(triple?.ruleKind).toBe('curated_triple');
    expect([...(triple?.requiredTrueFlags ?? [])].sort()).toEqual(
      [...NEW_RAW_KEYS].sort(),
    );
    expect(triple?.requiredFalseFlags).toHaveLength(0);
  });

  it('every emitted mark for the new rules is machine_observation + carries no gate field', () => {
    const out = evaluateObservationMapping(
      ['question_names_uncertainty', 'question_separates_claim_evidence'],
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

describe('MCP-BUILD2f — mapping rows manifest + plain-language routing', () => {
  it('the manifest records exactly 16 adopted Build-2f Family F rules', () => {
    expect(OBSERVATION_MAPPING_ADOPTION_MANIFEST.build2fFamilyFAdoptedRules).toBe(16);
  });

  it('16 registry rules reference at least one of the 3 new rawKeys', () => {
    const newKeySet = new Set<string>(NEW_RAW_KEYS);
    const build2fRules = OBSERVATION_MAPPING_REGISTRY.filter((r) => {
      const flags = [...r.requiredTrueFlags, ...r.requiredFalseFlags];
      return flags.some((f) => newKeySet.has(f));
    });
    expect(build2fRules).toHaveLength(16);
    // Every flag in those rules is exactly one of the 3 new keys (the adopted
    // rows are scoped to the 3-flag subset per the design's adopt list).
    for (const rule of build2fRules) {
      for (const flag of [...rule.requiredTrueFlags, ...rule.requiredFalseFlags]) {
        expect(newKeySet.has(flag)).toBe(true);
      }
      // All Build-2f rows are critical_question (no cross-family in this card).
      expect(rule.familyKey).toBe('critical_question');
    }
  });

  it('exactly one Build-2f row is a curated_triple (the only family with one in its unlock set)', () => {
    const triples = OBSERVATION_MAPPING_REGISTRY.filter(
      (r) => r.familyKey === 'critical_question' && r.ruleKind === 'curated_triple',
    );
    expect(triples).toHaveLength(1);
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

  it('every F3 (question_invites_revision) plain-language string avoids weakness verdict tokens', () => {
    const f3Codes = NEW_OBSERVATION_CODES.filter((c) => c.includes('question_invites_revision'));
    expect(f3Codes.length).toBeGreaterThan(0);
    for (const code of f3Codes) {
      const mapped = toPlainLanguageOrSuppress(code);
      expect(mapped).not.toBeNull();
      for (const banned of F3_BANNED_TOKENS) {
        const re = new RegExp(`\\b${banned}\\b`, 'i');
        expect(re.test(mapped!)).toBe(false);
      }
    }
  });
});
