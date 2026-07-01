/**
 * UX-FLAGS-001 — friendlyFlagMap: coverage / shape / determinism.
 *
 * Asserts the mapping layer's contract: every production family A–I has ≥1
 * descriptor, J is excluded, happy paths per family resolve, unknown codes
 * suppress to null, normalization + de-dupe work, the clientSuppressed mirror
 * derivation is honest, own-bubble suppression is set on the challenge-adjacent
 * keys, and the table is frozen/deterministic.
 *
 * Pure-model test — imports the module directly, no React, no Supabase.
 */

import {
  friendlyFlagFor,
  friendlyFlagsFor,
  isOwnBubbleEligible,
  FRIENDLY_FLAG_DESCRIPTORS,
  ALL_FRIENDLY_FLAG_KEYS,
  FRIENDLY_FLAG_EXCLUDED_FAMILIES,
  CLIENT_SUPPRESSED_FLAG_FAMILIES,
  type FriendlyFlag,
  type FriendlyFlagKey,
} from '../src/features/feedbackFlags';
import {
  ALL_MACHINE_OBSERVATION_FAMILIES,
  type MachineObservationFamily,
} from '../src/features/nodeLabels/nodeLabelTypes';
import { getDefinitionsForFamily } from '../src/features/nodeLabels/machineObservationDefinitions';

/** One representative positive rawKey per production family (A–I). */
const HAPPY_PATH: Record<MachineObservationFamily, { rawKey: string; family: MachineObservationFamily }> =
  {
    parent_relation: { family: 'parent_relation', rawKey: 'acknowledges_parent_strength' },
    disagreement_axis: { family: 'disagreement_axis', rawKey: 'disputes_scope' },
    misunderstanding_repair: { family: 'misunderstanding_repair', rawKey: 'requests_clarification' },
    evidence_source_chain: { family: 'evidence_source_chain', rawKey: 'source_attached' },
    argument_scheme: { family: 'argument_scheme', rawKey: 'analogy_reasoning_present' },
    critical_question: { family: 'critical_question', rawKey: 'question_names_uncertainty' },
    resolution_progress: { family: 'resolution_progress', rawKey: 'concedes_narrow_point' },
    claim_clarity: { family: 'claim_clarity', rawKey: 'claim_present' },
    thread_topology: { family: 'thread_topology', rawKey: 'introduces_new_issue' },
    // J intentionally omitted — excluded family.
    sensitive_composer: { family: 'sensitive_composer', rawKey: 'uses_popularity_as_evidence' },
  };

const PRODUCTION_FAMILIES = ALL_MACHINE_OBSERVATION_FAMILIES.filter(
  (f) => !FRIENDLY_FLAG_EXCLUDED_FAMILIES.includes(f),
);

describe('UX-FLAGS-001 friendlyFlagMap — coverage', () => {
  it('every production family A–I has ≥1 descriptor; exactly 9 families; J absent', () => {
    const familiesWithDescriptor = new Set<MachineObservationFamily>();
    for (const key of ALL_FRIENDLY_FLAG_KEYS) {
      familiesWithDescriptor.add(FRIENDLY_FLAG_DESCRIPTORS[key].family);
    }
    expect(familiesWithDescriptor.size).toBe(9);
    for (const family of PRODUCTION_FAMILIES) {
      expect(familiesWithDescriptor.has(family)).toBe(true);
    }
    expect(familiesWithDescriptor.has('sensitive_composer')).toBe(false);
  });

  it('exposes the full closed set of friendly-flag keys', () => {
    // A=4, B=3, C=2, D=4, E=3, F=2, G=4, H=3, I=3 = 28 (the enumerated union in
    // the design table; the "27-value" prose label is an off-by-one in the doc).
    expect(ALL_FRIENDLY_FLAG_KEYS.length).toBe(28);
    expect(Object.keys(FRIENDLY_FLAG_DESCRIPTORS).length).toBe(28);
  });
});

describe('UX-FLAGS-001 friendlyFlagMap — J-exclusion', () => {
  it('returns null for a sample of J rawKeys (guard before rawKey lookup)', () => {
    const jDefs = getDefinitionsForFamily('sensitive_composer');
    expect(jDefs.length).toBeGreaterThan(0);
    for (const def of jDefs) {
      expect(friendlyFlagFor('sensitive_composer', def.rawKey)).toBeNull();
    }
  });

  it('has no J descriptor in the table', () => {
    for (const key of ALL_FRIENDLY_FLAG_KEYS) {
      expect(FRIENDLY_FLAG_DESCRIPTORS[key].family).not.toBe('sensitive_composer');
    }
  });
});

describe('UX-FLAGS-001 friendlyFlagMap — happy path per family', () => {
  for (const family of PRODUCTION_FAMILIES) {
    it(`maps a representative ${family} rawKey to a non-null flag`, () => {
      const { rawKey } = HAPPY_PATH[family];
      const flag = friendlyFlagFor(family, rawKey);
      expect(flag).not.toBeNull();
      expect(flag!.family).toBe(family);
      expect(flag!.label.length).toBeGreaterThan(0);
      expect(flag!.label).not.toContain('_');
      expect(flag!.label).not.toContain('.');
    });
  }
});

describe('UX-FLAGS-001 friendlyFlagMap — unknown → null', () => {
  it('garbage family → null', () => {
    expect(friendlyFlagFor('not_a_family', 'source_attached')).toBeNull();
  });
  it('garbage rawKey inside a mapped family → null', () => {
    expect(friendlyFlagFor('evidence_source_chain', 'totally_made_up_key')).toBeNull();
  });
  it('empty strings → null', () => {
    expect(friendlyFlagFor('', '')).toBeNull();
    expect(friendlyFlagFor('evidence_source_chain', '')).toBeNull();
  });
  it('null inputs → null', () => {
    expect(friendlyFlagFor(null as unknown as string, null as unknown as string)).toBeNull();
  });
});

describe('UX-FLAGS-001 friendlyFlagMap — normalization', () => {
  it('case/whitespace/dash variants resolve identically', () => {
    const canonical = friendlyFlagFor('evidence_source_chain', 'source_attached');
    const spaced = friendlyFlagFor('Evidence Source Chain', 'Source Attached');
    const dashed = friendlyFlagFor('evidence-source-chain', 'source-attached');
    expect(canonical).not.toBeNull();
    expect(spaced).toEqual(canonical);
    expect(dashed).toEqual(canonical);
  });
});

describe('UX-FLAGS-001 friendlyFlagMap — de-dupe fan-out', () => {
  it('two D rawKeys that both map to brought_receipts return exactly one flag', () => {
    const flags = friendlyFlagsFor([
      { family: 'evidence_source_chain', rawKey: 'source_attached' },
      { family: 'evidence_source_chain', rawKey: 'quote_attached' },
    ]);
    expect(flags.length).toBe(1);
    expect(flags[0].key).toBe('brought_receipts');
  });

  it('drops nulls and preserves input order', () => {
    const flags = friendlyFlagsFor([
      { family: 'sensitive_composer', rawKey: 'uses_popularity_as_evidence' }, // null (J)
      { family: 'thread_topology', rawKey: 'introduces_new_issue' }, // new_issue
      { family: 'resolution_progress', rawKey: 'concedes_narrow_point' }, // clean_concession
    ]);
    expect(flags.map((f) => f.key)).toEqual(['new_issue', 'clean_concession']);
  });

  it('empty input → []', () => {
    expect(friendlyFlagsFor([])).toEqual([]);
  });
});

describe('UX-FLAGS-001 friendlyFlagMap — negative reading suppression', () => {
  it('a *_false / no_* rawKey → null', () => {
    expect(friendlyFlagFor('evidence_source_chain', 'source_attached_false')).toBeNull();
    expect(friendlyFlagFor('claim_clarity', 'no_claim_present')).toBeNull();
    expect(friendlyFlagFor('parent_relation', 'not_supports_parent')).toBeNull();
  });
});

describe('UX-FLAGS-001 friendlyFlagMap — clientSuppressed', () => {
  it('every A–I descriptor is clientSuppressed:false at ship (mirror empty)', () => {
    expect(CLIENT_SUPPRESSED_FLAG_FAMILIES.length).toBe(0);
    for (const key of ALL_FRIENDLY_FLAG_KEYS) {
      expect(FRIENDLY_FLAG_DESCRIPTORS[key].clientSuppressed).toBe(false);
    }
  });

  it('clientSuppressed is DERIVED from the mirror, not hard-coded', () => {
    const flag = friendlyFlagFor('thread_topology', 'introduces_new_issue');
    expect(flag).not.toBeNull();
    expect(flag!.clientSuppressed).toBe(
      CLIENT_SUPPRESSED_FLAG_FAMILIES.includes('thread_topology'),
    );
  });
});

describe('UX-FLAGS-001 friendlyFlagMap — own-bubble suppression', () => {
  const SUPPRESSED: FriendlyFlagKey[] = [
    'direct_challenge',
    'disagrees_on_scope',
    'disagrees_on_facts',
    'could_be_more_specific',
  ];
  const ELIGIBLE: FriendlyFlagKey[] = ['nice_bridge', 'brought_receipts', 'clean_concession'];

  it('challenge-adjacent keys are ownBubbleSuppressed:true', () => {
    for (const key of SUPPRESSED) {
      expect(FRIENDLY_FLAG_DESCRIPTORS[key].ownBubbleSuppressed).toBe(true);
      expect(isOwnBubbleEligible(FRIENDLY_FLAG_DESCRIPTORS[key])).toBe(false);
    }
  });

  it('positive/descriptive keys are ownBubbleSuppressed:false', () => {
    for (const key of ELIGIBLE) {
      expect(FRIENDLY_FLAG_DESCRIPTORS[key].ownBubbleSuppressed).toBe(false);
      expect(isOwnBubbleEligible(FRIENDLY_FLAG_DESCRIPTORS[key])).toBe(true);
    }
  });
});

describe('UX-FLAGS-001 friendlyFlagMap — actionable ↔ composerIntent', () => {
  it('actionable:true ⟺ non-null composerIntent; actionable:false ⟺ null', () => {
    for (const key of ALL_FRIENDLY_FLAG_KEYS) {
      const flag = FRIENDLY_FLAG_DESCRIPTORS[key];
      if (flag.actionable) {
        expect(flag.composerIntent).not.toBeNull();
        expect(typeof flag.composerIntent).toBe('string');
      } else {
        expect(flag.composerIntent).toBeNull();
      }
    }
  });
});

describe('UX-FLAGS-001 friendlyFlagMap — Family D no-standing invariant', () => {
  it('every Family D descriptor carries neverGrantsStanding:true', () => {
    const dFlags = ALL_FRIENDLY_FLAG_KEYS.map((k) => FRIENDLY_FLAG_DESCRIPTORS[k]).filter(
      (f) => f.family === 'evidence_source_chain',
    );
    expect(dFlags.length).toBeGreaterThan(0);
    for (const flag of dFlags) {
      expect(flag.neverGrantsStanding).toBe(true);
    }
  });
});

describe('UX-FLAGS-001 friendlyFlagMap — determinism', () => {
  it('friendlyFlagFor twice returns deep-equal', () => {
    const a = friendlyFlagFor('resolution_progress', 'concedes_narrow_point');
    const b = friendlyFlagFor('resolution_progress', 'concedes_narrow_point');
    expect(a).toEqual(b);
  });

  it('the descriptor table is frozen', () => {
    expect(Object.isFrozen(FRIENDLY_FLAG_DESCRIPTORS)).toBe(true);
    const sample: FriendlyFlag = FRIENDLY_FLAG_DESCRIPTORS.nice_bridge;
    expect(Object.isFrozen(sample)).toBe(true);
  });
});
