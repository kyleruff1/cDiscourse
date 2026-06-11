/**
 * OPS-MCP-FAMILY-VALIDATOR-REFACTOR — FamilyValidatorRegistry behavior tests.
 *
 * Uses the `createFamilyRegistry()` factory per design §3.1 and §5.3 so each
 * test instantiates a fresh registry and never pollutes the production
 * singleton. The 14 tests cover registry state, registration validation,
 * insertion order, frozen-snapshot semantics, and the polite
 * `isRawKeySupportedForFamily` predicate.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — registry encodes structural-observation
 *     groupings, never verdicts; the tests assert only shape and behavior.
 *   - test-discipline — pure-TS model coverage; each public function has
 *     unit tests including failure cases.
 */
import { assertEquals, assertThrows } from 'std/assert/mod.ts';
import { createFamilyRegistry } from '../lib/familyRegistry.ts';
import {
  FAMILY_A_RAW_KEYS,
  FAMILY_A_CLASSIFIER_SET_VERSION,
} from '../lib/familyAKeys.ts';
import {
  FAMILY_B_RAW_KEYS,
  FAMILY_B_CLASSIFIER_SET_VERSION,
} from '../lib/familyBKeys.ts';
import {
  FAMILY_C_RAW_KEYS,
  FAMILY_C_CLASSIFIER_SET_VERSION,
} from '../lib/familyCKeys.ts';

Deno.test('registry-newly-constructed-is-empty', () => {
  const registry = createFamilyRegistry();
  assertEquals(registry.getSupportedFamilies(), []);
  assertEquals(registry.isFamilySupported('parent_relation'), false);
});

Deno.test('registry-registers-family-a', () => {
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  assertEquals(registry.getSupportedFamilies(), ['parent_relation']);
  assertEquals(registry.isFamilySupported('parent_relation'), true);
});

Deno.test('registry-register-throws-on-double-registration', () => {
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  assertThrows(
    () => {
      registry.register('parent_relation', {
        rawKeys: new Set(FAMILY_A_RAW_KEYS),
        classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
      });
    },
    Error,
    'family already registered: parent_relation',
  );
});

Deno.test('registry-register-throws-on-empty-rawKeys', () => {
  const registry = createFamilyRegistry();
  assertThrows(
    () => {
      registry.register('parent_relation', {
        rawKeys: new Set<string>(),
        classifierSetVersion: 'family-a-v1',
      });
    },
    Error,
    'rawKeys must be non-empty Set',
  );
});

Deno.test('registry-register-throws-on-empty-classifierSetVersion', () => {
  const registry = createFamilyRegistry();
  assertThrows(
    () => {
      registry.register('parent_relation', {
        rawKeys: new Set(FAMILY_A_RAW_KEYS),
        classifierSetVersion: '',
      });
    },
    Error,
    'classifierSetVersion must be non-empty string',
  );
});

Deno.test('registry-getSupportedFamilies-returns-frozen-snapshot', () => {
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  const snapshot = registry.getSupportedFamilies();
  assertEquals(Object.isFrozen(snapshot), true);
  // Attempting to mutate the snapshot must throw (strict mode is implicit in
  // ES modules under Deno; pushing to a frozen array throws TypeError).
  assertThrows(() => {
    (snapshot as string[]).push('disagreement_axis');
  }, TypeError);
});

Deno.test('registry-getSupportedFamilies-preserves-insertion-order', () => {
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('fake_b', {
    rawKeys: new Set(['fake_key_b']),
    classifierSetVersion: 'fake-b-v1',
  });
  assertEquals(registry.getSupportedFamilies(), ['parent_relation', 'fake_b']);
});

Deno.test('registry-isFamilySupported-true-for-registered', () => {
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  assertEquals(registry.isFamilySupported('parent_relation'), true);
});

Deno.test('registry-isFamilySupported-false-for-unregistered', () => {
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  assertEquals(registry.isFamilySupported('disagreement_axis'), false);
  assertEquals(registry.isFamilySupported('not_a_family'), false);
});

Deno.test('registry-getRawKeysForFamily-returns-all-19-for-family-a', () => {
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  const keys = registry.getRawKeysForFamily('parent_relation');
  // MCP-BUILD2b: 16 → 19 Family A rawKeys (derived from FAMILY_A_RAW_KEYS).
  assertEquals(keys.size, 19);
  for (const binding of FAMILY_A_RAW_KEYS) {
    assertEquals(keys.has(binding), true);
  }
});

Deno.test('registry-getRawKeysForFamily-throws-for-unregistered-family', () => {
  const registry = createFamilyRegistry();
  assertThrows(
    () => {
      registry.getRawKeysForFamily('disagreement_axis');
    },
    Error,
    'family not registered: disagreement_axis',
  );
});

Deno.test('registry-getClassifierSetVersion-returns-family-a-v1', () => {
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  assertEquals(registry.getClassifierSetVersion('parent_relation'), 'family-a-v1');
});

Deno.test('registry-isRawKeySupportedForFamily-true-for-all-19-keys', () => {
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  for (const key of FAMILY_A_RAW_KEYS) {
    assertEquals(registry.isRawKeySupportedForFamily('parent_relation', key), true);
  }
});

Deno.test('registry-isRawKeySupportedForFamily-false-for-sample-unsupported', () => {
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  // Fictional rawKey unknown to any family.
  assertEquals(
    registry.isRawKeySupportedForFamily('parent_relation', 'fictional_raw_key_xyz'),
    false,
  );
  // Family B candidate (disputes_scope) — not in Family A's set.
  assertEquals(
    registry.isRawKeySupportedForFamily('parent_relation', 'disputes_scope'),
    false,
  );
  // Correct family-keying: even a valid Family A key returns false when
  // queried under an unregistered family.
  assertEquals(
    registry.isRawKeySupportedForFamily('disagreement_axis', 'supports_parent'),
    false,
  );
});

// ─────────────────────────────────────────────────────────────────────────
// MCP-SERVER-003-FAMILY-B additions
// ─────────────────────────────────────────────────────────────────────────

Deno.test('registry-getSupportedFamilies-preserves-real-family-b-order', () => {
  // Upgrade of the fake_b precedent test: use real Family A + real Family B.
  // Per familyRegistry.ts:82-84, insertion order is preserved.
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  assertEquals(registry.getSupportedFamilies(), ['parent_relation', 'disagreement_axis']);
  // MCP-BUILD2a: 14 → 17 disagreement_axis booleans (derived from FAMILY_B_RAW_KEYS).
  assertEquals(registry.getRawKeysForFamily('disagreement_axis').size, 17);
  assertEquals(registry.getClassifierSetVersion('disagreement_axis'), 'family-b-v1');
});

Deno.test('registry-isRawKeySupportedForFamily-cross-family-rejection', () => {
  // With both real families registered, cross-family rawKey lookups must
  // return false. A Family A rawKey under 'disagreement_axis' is rejected;
  // a Family B rawKey under 'parent_relation' is rejected. Each family
  // recognizes only its own rawKey set.
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });

  // Family A key under Family B → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('disagreement_axis', 'supports_parent'),
    false,
  );
  // Family B key under Family A → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('parent_relation', 'disputes_definition'),
    false,
  );
  // Sanity: each family still supports its own keys.
  assertEquals(
    registry.isRawKeySupportedForFamily('parent_relation', 'supports_parent'),
    true,
  );
  assertEquals(
    registry.isRawKeySupportedForFamily('disagreement_axis', 'disputes_definition'),
    true,
  );
});

// ─────────────────────────────────────────────────────────────────────────
// MCP-SERVER-004-FAMILY-C additions
// ─────────────────────────────────────────────────────────────────────────

Deno.test('registry-getSupportedFamilies-preserves-three-family-order', () => {
  // Upgrade of the Family B precedent test: use real Family A + B + C.
  // Per familyRegistry.ts:82-84, insertion order is preserved.
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  assertEquals(
    registry.getSupportedFamilies(),
    ['parent_relation', 'disagreement_axis', 'misunderstanding_repair'],
  );
  // MCP-BUILD2c: 17 → 20 misunderstanding_repair rawKeys (derived from FAMILY_C_RAW_KEYS).
  assertEquals(registry.getRawKeysForFamily('misunderstanding_repair').size, 20);
  assertEquals(registry.getClassifierSetVersion('misunderstanding_repair'), 'family-c-v1');
});

Deno.test('registry-isRawKeySupportedForFamily-three-way-cross-family-rejection', () => {
  // With all three real families registered, cross-family rawKey lookups
  // must return false across every combination. Each family recognizes only
  // its own rawKey set.
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });

  // Family A key under Family C → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('misunderstanding_repair', 'supports_parent'),
    false,
  );
  // Family B key under Family C → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('misunderstanding_repair', 'disputes_definition'),
    false,
  );
  // Family C key under Family A → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('parent_relation', 'offers_candidate_understanding'),
    false,
  );
  // Family C key under Family B → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('disagreement_axis', 'offers_candidate_understanding'),
    false,
  );
  // Sanity: each family still supports its own keys.
  assertEquals(
    registry.isRawKeySupportedForFamily('misunderstanding_repair', 'offers_candidate_understanding'),
    true,
  );
});

Deno.test('registry-getRawKeysForFamily-returns-all-20-for-family-c', () => {
  const registry = createFamilyRegistry();
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  const keys = registry.getRawKeysForFamily('misunderstanding_repair');
  // MCP-BUILD2c: 17 → 20 misunderstanding_repair rawKeys.
  assertEquals(keys.size, 20);
  for (const binding of FAMILY_C_RAW_KEYS) {
    assertEquals(keys.has(binding), true);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// MCP-SERVER-005-FAMILY-D additions
// ─────────────────────────────────────────────────────────────────────────

Deno.test('registry-getSupportedFamilies-preserves-four-family-order', async () => {
  // MCP-SERVER-005-FAMILY-D adds the fourth family register() call.
  // Insertion order is preserved by the underlying Map; the
  // getSupportedFamilies() snapshot returns exactly
  // ['parent_relation', 'disagreement_axis', 'misunderstanding_repair',
  // 'evidence_source_chain'].
  const { FAMILY_D_RAW_KEYS, FAMILY_D_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyDKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  registry.register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });
  assertEquals(
    registry.getSupportedFamilies(),
    ['parent_relation', 'disagreement_axis', 'misunderstanding_repair', 'evidence_source_chain'],
  );
  assertEquals(registry.getRawKeysForFamily('evidence_source_chain').size, 22);
  assertEquals(registry.getClassifierSetVersion('evidence_source_chain'), 'family-d-v1');
});

Deno.test('registry-isRawKeySupportedForFamily-four-way-cross-family-rejection', async () => {
  // With all four real families registered, cross-family rawKey lookups
  // must return false across every combination. Each family recognizes
  // only its own rawKey set.
  const { FAMILY_D_RAW_KEYS, FAMILY_D_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyDKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  registry.register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });

  // Family A key under Family D → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('evidence_source_chain', 'supports_parent'),
    false,
  );
  // Family B key under Family D → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('evidence_source_chain', 'disputes_definition'),
    false,
  );
  // Family C key under Family D → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('evidence_source_chain', 'offers_candidate_understanding'),
    false,
  );
  // Family D key under Family A → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('parent_relation', 'source_provided'),
    false,
  );
  // Family D key under Family B → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('disagreement_axis', 'evidence_gap_present'),
    false,
  );
  // Family D key under Family C → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('misunderstanding_repair', 'burden_request_present'),
    false,
  );
  // Sanity: Family D supports its own keys.
  assertEquals(
    registry.isRawKeySupportedForFamily('evidence_source_chain', 'source_provided'),
    true,
  );
});

Deno.test('registry-getRawKeysForFamily-returns-all-22-for-family-d-Subset', async () => {
  const { FAMILY_D_RAW_KEYS, FAMILY_D_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyDKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });
  const keys = registry.getRawKeysForFamily('evidence_source_chain');
  // MCP-BUILD2d: 19 → 22 Family D Subset rawKeys (FAMILY_D_RAW_KEYS).
  assertEquals(keys.size, 22);
  for (const binding of FAMILY_D_RAW_KEYS) {
    assertEquals(keys.has(binding), true);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// MCP-SERVER-006-FAMILY-E additions
// ─────────────────────────────────────────────────────────────────────────

Deno.test('registry-getSupportedFamilies-preserves-five-family-order', async () => {
  // MCP-SERVER-006-FAMILY-E adds the fifth family register() call (uniform
  // ai_classifier; 19 keys post MCP-BUILD2e). Insertion order is preserved by the underlying
  // Map; the getSupportedFamilies() snapshot returns exactly
  // ['parent_relation', 'disagreement_axis', 'misunderstanding_repair',
  // 'evidence_source_chain', 'argument_scheme'].
  const { FAMILY_D_RAW_KEYS, FAMILY_D_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyDKeys.ts'
  );
  const { FAMILY_E_RAW_KEYS, FAMILY_E_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyEKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  registry.register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });
  registry.register('argument_scheme', {
    rawKeys: new Set(FAMILY_E_RAW_KEYS),
    classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION,
  });
  assertEquals(
    registry.getSupportedFamilies(),
    [
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
    ],
  );
  // MCP-BUILD2e: 16 → 19 argument_scheme rawKeys (derived from FAMILY_E_RAW_KEYS).
  assertEquals(registry.getRawKeysForFamily('argument_scheme').size, 19);
  assertEquals(registry.getClassifierSetVersion('argument_scheme'), 'family-e-v1');
});

Deno.test('registry-isRawKeySupportedForFamily-five-way-cross-family-rejection', async () => {
  // With all five real families registered, cross-family rawKey lookups
  // must return false across every combination. Each family recognizes
  // only its own rawKey set.
  const { FAMILY_D_RAW_KEYS, FAMILY_D_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyDKeys.ts'
  );
  const { FAMILY_E_RAW_KEYS, FAMILY_E_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyEKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  registry.register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });
  registry.register('argument_scheme', {
    rawKeys: new Set(FAMILY_E_RAW_KEYS),
    classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION,
  });

  // Family A key under Family E → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('argument_scheme', 'supports_parent'),
    false,
  );
  // Family B key under Family E → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('argument_scheme', 'disputes_definition'),
    false,
  );
  // Family C key under Family E → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('argument_scheme', 'offers_candidate_understanding'),
    false,
  );
  // Family D key under Family E → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('argument_scheme', 'source_provided'),
    false,
  );
  // Family E key under Family A → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('parent_relation', 'slippery_slope_reasoning_present'),
    false,
  );
  // Family E key under Family B → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('disagreement_axis', 'causal_reasoning_present'),
    false,
  );
  // Family E key under Family C → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('misunderstanding_repair', 'analogy_reasoning_present'),
    false,
  );
  // Family E key under Family D → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('evidence_source_chain', 'precedent_reasoning_present'),
    false,
  );
  // Sanity: Family E supports its own keys.
  assertEquals(
    registry.isRawKeySupportedForFamily('argument_scheme', 'slippery_slope_reasoning_present'),
    true,
  );
  assertEquals(
    registry.isRawKeySupportedForFamily('argument_scheme', 'causal_reasoning_present'),
    true,
  );
});

Deno.test('registry-getRawKeysForFamily-returns-all-19-for-family-e', async () => {
  const { FAMILY_E_RAW_KEYS, FAMILY_E_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyEKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('argument_scheme', {
    rawKeys: new Set(FAMILY_E_RAW_KEYS),
    classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION,
  });
  const keys = registry.getRawKeysForFamily('argument_scheme');
  // MCP-BUILD2e: 16 → 19 argument_scheme rawKeys.
  assertEquals(keys.size, 19);
  for (const binding of FAMILY_E_RAW_KEYS) {
    assertEquals(keys.has(binding), true);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// MCP-SERVER-008-FAMILY-G additions (Family F is uniform ai_classifier; this
// file's incremental order tests jump from E to G, exercising the 7-family
// shape with all real family key sets).
// ─────────────────────────────────────────────────────────────────────────

Deno.test('registry-getSupportedFamilies-preserves-seven-family-order', async () => {
  // MCP-SERVER-008-FAMILY-G adds the seventh family register() call
  // (ai_classifier Subset; 21 keys after MCP-BUILD2g). Insertion order is preserved by the
  // underlying Map; the getSupportedFamilies() snapshot returns exactly the
  // seven-family list in registration order.
  const { FAMILY_D_RAW_KEYS, FAMILY_D_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyDKeys.ts'
  );
  const { FAMILY_E_RAW_KEYS, FAMILY_E_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyEKeys.ts'
  );
  const { FAMILY_F_RAW_KEYS, FAMILY_F_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyFKeys.ts'
  );
  const { FAMILY_G_RAW_KEYS, FAMILY_G_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyGKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  registry.register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });
  registry.register('argument_scheme', {
    rawKeys: new Set(FAMILY_E_RAW_KEYS),
    classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION,
  });
  registry.register('critical_question', {
    rawKeys: new Set(FAMILY_F_RAW_KEYS),
    classifierSetVersion: FAMILY_F_CLASSIFIER_SET_VERSION,
  });
  registry.register('resolution_progress', {
    rawKeys: new Set(FAMILY_G_RAW_KEYS),
    classifierSetVersion: FAMILY_G_CLASSIFIER_SET_VERSION,
  });
  assertEquals(
    registry.getSupportedFamilies(),
    [
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
      'resolution_progress',
    ],
  );
  assertEquals(registry.getRawKeysForFamily('resolution_progress').size, 21);
  assertEquals(registry.getClassifierSetVersion('resolution_progress'), 'family-g-v1');
});

Deno.test('registry-isRawKeySupportedForFamily-seven-way-cross-family-rejection', async () => {
  // With all seven real families registered, cross-family rawKey lookups
  // must return false across the Family G combinations. Each family
  // recognizes only its own rawKey set.
  const { FAMILY_D_RAW_KEYS, FAMILY_D_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyDKeys.ts'
  );
  const { FAMILY_E_RAW_KEYS, FAMILY_E_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyEKeys.ts'
  );
  const { FAMILY_F_RAW_KEYS, FAMILY_F_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyFKeys.ts'
  );
  const { FAMILY_G_RAW_KEYS, FAMILY_G_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyGKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  registry.register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });
  registry.register('argument_scheme', {
    rawKeys: new Set(FAMILY_E_RAW_KEYS),
    classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION,
  });
  registry.register('critical_question', {
    rawKeys: new Set(FAMILY_F_RAW_KEYS),
    classifierSetVersion: FAMILY_F_CLASSIFIER_SET_VERSION,
  });
  registry.register('resolution_progress', {
    rawKeys: new Set(FAMILY_G_RAW_KEYS),
    classifierSetVersion: FAMILY_G_CLASSIFIER_SET_VERSION,
  });

  // Family A key under Family G → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('resolution_progress', 'supports_parent'),
    false,
  );
  // Family B key under Family G → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('resolution_progress', 'disputes_definition'),
    false,
  );
  // Family C key under Family G → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('resolution_progress', 'offers_candidate_understanding'),
    false,
  );
  // Family D key under Family G → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('resolution_progress', 'source_provided'),
    false,
  );
  // Family E key under Family G → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('resolution_progress', 'slippery_slope_reasoning_present'),
    false,
  );
  // Family F key under Family G → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('resolution_progress', 'consequence_probability_unclear'),
    false,
  );
  // Family G key under Family A → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('parent_relation', 'concedes_broader_point'),
    false,
  );
  // Family G key under Family F → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('critical_question', 'synthesis_proposed'),
    false,
  );
  // Sanity: Family G supports its own keys.
  assertEquals(
    registry.isRawKeySupportedForFamily('resolution_progress', 'concedes_broader_point'),
    true,
  );
  assertEquals(
    registry.isRawKeySupportedForFamily('resolution_progress', 'synthesis_proposed'),
    true,
  );
});

Deno.test('registry-getRawKeysForFamily-returns-all-21-for-family-g-Subset', async () => {
  const { FAMILY_G_RAW_KEYS, FAMILY_G_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyGKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('resolution_progress', {
    rawKeys: new Set(FAMILY_G_RAW_KEYS),
    classifierSetVersion: FAMILY_G_CLASSIFIER_SET_VERSION,
  });
  const keys = registry.getRawKeysForFamily('resolution_progress');
  assertEquals(keys.size, 21);
  for (const binding of FAMILY_G_RAW_KEYS) {
    assertEquals(keys.has(binding), true);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// MCP-SERVER-009-FAMILY-H additions
// ─────────────────────────────────────────────────────────────────────────

Deno.test('registry-getSupportedFamilies-preserves-eight-family-order', async () => {
  // MCP-SERVER-009-FAMILY-H adds the eighth family register() call
  // (uniform ai_classifier; 12 keys). Insertion order is preserved by the
  // underlying Map; the getSupportedFamilies() snapshot returns exactly the
  // eight-family list in registration order.
  const { FAMILY_D_RAW_KEYS, FAMILY_D_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyDKeys.ts'
  );
  const { FAMILY_E_RAW_KEYS, FAMILY_E_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyEKeys.ts'
  );
  const { FAMILY_F_RAW_KEYS, FAMILY_F_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyFKeys.ts'
  );
  const { FAMILY_G_RAW_KEYS, FAMILY_G_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyGKeys.ts'
  );
  const { FAMILY_H_RAW_KEYS, FAMILY_H_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyHKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  registry.register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });
  registry.register('argument_scheme', {
    rawKeys: new Set(FAMILY_E_RAW_KEYS),
    classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION,
  });
  registry.register('critical_question', {
    rawKeys: new Set(FAMILY_F_RAW_KEYS),
    classifierSetVersion: FAMILY_F_CLASSIFIER_SET_VERSION,
  });
  registry.register('resolution_progress', {
    rawKeys: new Set(FAMILY_G_RAW_KEYS),
    classifierSetVersion: FAMILY_G_CLASSIFIER_SET_VERSION,
  });
  registry.register('claim_clarity', {
    rawKeys: new Set(FAMILY_H_RAW_KEYS),
    classifierSetVersion: FAMILY_H_CLASSIFIER_SET_VERSION,
  });
  assertEquals(
    registry.getSupportedFamilies(),
    [
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
      'resolution_progress',
      'claim_clarity',
    ],
  );
  assertEquals(registry.getRawKeysForFamily('claim_clarity').size, 12);
  assertEquals(registry.getClassifierSetVersion('claim_clarity'), 'family-h-v1');
});

Deno.test('registry-isRawKeySupportedForFamily-eight-way-cross-family-rejection', async () => {
  // With all eight real families registered, cross-family rawKey lookups
  // must return false across the Family H combinations. Each family
  // recognizes only its own rawKey set.
  const { FAMILY_D_RAW_KEYS, FAMILY_D_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyDKeys.ts'
  );
  const { FAMILY_E_RAW_KEYS, FAMILY_E_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyEKeys.ts'
  );
  const { FAMILY_F_RAW_KEYS, FAMILY_F_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyFKeys.ts'
  );
  const { FAMILY_G_RAW_KEYS, FAMILY_G_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyGKeys.ts'
  );
  const { FAMILY_H_RAW_KEYS, FAMILY_H_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyHKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  registry.register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });
  registry.register('argument_scheme', {
    rawKeys: new Set(FAMILY_E_RAW_KEYS),
    classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION,
  });
  registry.register('critical_question', {
    rawKeys: new Set(FAMILY_F_RAW_KEYS),
    classifierSetVersion: FAMILY_F_CLASSIFIER_SET_VERSION,
  });
  registry.register('resolution_progress', {
    rawKeys: new Set(FAMILY_G_RAW_KEYS),
    classifierSetVersion: FAMILY_G_CLASSIFIER_SET_VERSION,
  });
  registry.register('claim_clarity', {
    rawKeys: new Set(FAMILY_H_RAW_KEYS),
    classifierSetVersion: FAMILY_H_CLASSIFIER_SET_VERSION,
  });

  // Family A key under Family H → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('claim_clarity', 'supports_parent'),
    false,
  );
  // Family G key under Family H → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('claim_clarity', 'concedes_broader_point'),
    false,
  );
  // Family H key under Family A → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('parent_relation', 'claim_specificity_low'),
    false,
  );
  // Family H key under Family G → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('resolution_progress', 'claim_specificity_low'),
    false,
  );
  // Sanity: Family H supports its own keys.
  assertEquals(
    registry.isRawKeySupportedForFamily('claim_clarity', 'claim_specificity_low'),
    true,
  );
  assertEquals(
    registry.isRawKeySupportedForFamily('claim_clarity', 'conclusion_missing'),
    true,
  );
});

Deno.test('registry-getRawKeysForFamily-returns-all-12-for-family-h-uniform', async () => {
  const { FAMILY_H_RAW_KEYS, FAMILY_H_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyHKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('claim_clarity', {
    rawKeys: new Set(FAMILY_H_RAW_KEYS),
    classifierSetVersion: FAMILY_H_CLASSIFIER_SET_VERSION,
  });
  const keys = registry.getRawKeysForFamily('claim_clarity');
  assertEquals(keys.size, 12);
  for (const binding of FAMILY_H_RAW_KEYS) {
    assertEquals(keys.has(binding), true);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// MCP-SERVER-010-FAMILY-I additions (thread_topology; 6-key ai_classifier
// mixed-source Subset)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('registry-getSupportedFamilies-preserves-nine-family-order', async () => {
  // MCP-SERVER-010-FAMILY-I adds the ninth family register() call
  // (ai_classifier mixed-source Subset; 6 keys). Insertion order is
  // preserved by the underlying Map; the getSupportedFamilies() snapshot
  // returns exactly the nine-family list in registration order.
  const { FAMILY_D_RAW_KEYS, FAMILY_D_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyDKeys.ts'
  );
  const { FAMILY_E_RAW_KEYS, FAMILY_E_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyEKeys.ts'
  );
  const { FAMILY_F_RAW_KEYS, FAMILY_F_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyFKeys.ts'
  );
  const { FAMILY_G_RAW_KEYS, FAMILY_G_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyGKeys.ts'
  );
  const { FAMILY_H_RAW_KEYS, FAMILY_H_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyHKeys.ts'
  );
  const { FAMILY_I_RAW_KEYS, FAMILY_I_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyIKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  registry.register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });
  registry.register('argument_scheme', {
    rawKeys: new Set(FAMILY_E_RAW_KEYS),
    classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION,
  });
  registry.register('critical_question', {
    rawKeys: new Set(FAMILY_F_RAW_KEYS),
    classifierSetVersion: FAMILY_F_CLASSIFIER_SET_VERSION,
  });
  registry.register('resolution_progress', {
    rawKeys: new Set(FAMILY_G_RAW_KEYS),
    classifierSetVersion: FAMILY_G_CLASSIFIER_SET_VERSION,
  });
  registry.register('claim_clarity', {
    rawKeys: new Set(FAMILY_H_RAW_KEYS),
    classifierSetVersion: FAMILY_H_CLASSIFIER_SET_VERSION,
  });
  registry.register('thread_topology', {
    rawKeys: new Set(FAMILY_I_RAW_KEYS),
    classifierSetVersion: FAMILY_I_CLASSIFIER_SET_VERSION,
  });
  assertEquals(
    registry.getSupportedFamilies(),
    [
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
      'resolution_progress',
      'claim_clarity',
      'thread_topology',
    ],
  );
  assertEquals(registry.getRawKeysForFamily('thread_topology').size, 6);
  assertEquals(registry.getClassifierSetVersion('thread_topology'), 'family-i-v1');
});

Deno.test('registry-isRawKeySupportedForFamily-nine-way-cross-family-rejection', async () => {
  // With all nine real families registered, cross-family rawKey lookups must
  // return false across the Family I combinations. Each family recognizes
  // only its own rawKey set.
  const { FAMILY_D_RAW_KEYS, FAMILY_D_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyDKeys.ts'
  );
  const { FAMILY_E_RAW_KEYS, FAMILY_E_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyEKeys.ts'
  );
  const { FAMILY_F_RAW_KEYS, FAMILY_F_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyFKeys.ts'
  );
  const { FAMILY_G_RAW_KEYS, FAMILY_G_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyGKeys.ts'
  );
  const { FAMILY_H_RAW_KEYS, FAMILY_H_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyHKeys.ts'
  );
  const { FAMILY_I_RAW_KEYS, FAMILY_I_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyIKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  registry.register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });
  registry.register('argument_scheme', {
    rawKeys: new Set(FAMILY_E_RAW_KEYS),
    classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION,
  });
  registry.register('critical_question', {
    rawKeys: new Set(FAMILY_F_RAW_KEYS),
    classifierSetVersion: FAMILY_F_CLASSIFIER_SET_VERSION,
  });
  registry.register('resolution_progress', {
    rawKeys: new Set(FAMILY_G_RAW_KEYS),
    classifierSetVersion: FAMILY_G_CLASSIFIER_SET_VERSION,
  });
  registry.register('claim_clarity', {
    rawKeys: new Set(FAMILY_H_RAW_KEYS),
    classifierSetVersion: FAMILY_H_CLASSIFIER_SET_VERSION,
  });
  registry.register('thread_topology', {
    rawKeys: new Set(FAMILY_I_RAW_KEYS),
    classifierSetVersion: FAMILY_I_CLASSIFIER_SET_VERSION,
  });

  // Family A key under Family I → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('thread_topology', 'supports_parent'),
    false,
  );
  // Family H key under Family I → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('thread_topology', 'claim_specificity_low'),
    false,
  );
  // Family I key under Family A → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('parent_relation', 'introduces_new_issue'),
    false,
  );
  // Family I key under Family H → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('claim_clarity', 'introduces_new_issue'),
    false,
  );
  // An EXCLUDED deterministic Family I key under Family I → false
  // (mixed-source exclusion boundary; these are NOT in FAMILY_I_RAW_KEYS).
  assertEquals(
    registry.isRawKeySupportedForFamily('thread_topology', 'has_reply'),
    false,
  );
  assertEquals(
    registry.isRawKeySupportedForFamily('thread_topology', 'splits_thread'),
    false,
  );
  // Sanity: Family I supports its own keys.
  assertEquals(
    registry.isRawKeySupportedForFamily('thread_topology', 'introduces_new_issue'),
    true,
  );
  assertEquals(
    registry.isRawKeySupportedForFamily('thread_topology', 'compares_options'),
    true,
  );
});

Deno.test('registry-getRawKeysForFamily-returns-all-6-for-family-i-Subset', async () => {
  const { FAMILY_I_RAW_KEYS, FAMILY_I_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyIKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('thread_topology', {
    rawKeys: new Set(FAMILY_I_RAW_KEYS),
    classifierSetVersion: FAMILY_I_CLASSIFIER_SET_VERSION,
  });
  const keys = registry.getRawKeysForFamily('thread_topology');
  assertEquals(keys.size, 6);
  for (const binding of FAMILY_I_RAW_KEYS) {
    assertEquals(keys.has(binding), true);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// MCP-SERVER-011-FAMILY-J additions (sensitive_composer; 5-key semantic_referee
// SOURCE-UNIFORM set — no excluded list)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('registry-getSupportedFamilies-preserves-ten-family-order', async () => {
  // MCP-SERVER-011-FAMILY-J adds the tenth family register() call
  // (semantic_referee SOURCE-UNIFORM; 5 keys). Insertion order is preserved
  // by the underlying Map; the getSupportedFamilies() snapshot returns
  // exactly the ten-family list in registration order.
  const { FAMILY_D_RAW_KEYS, FAMILY_D_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyDKeys.ts'
  );
  const { FAMILY_E_RAW_KEYS, FAMILY_E_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyEKeys.ts'
  );
  const { FAMILY_F_RAW_KEYS, FAMILY_F_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyFKeys.ts'
  );
  const { FAMILY_G_RAW_KEYS, FAMILY_G_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyGKeys.ts'
  );
  const { FAMILY_H_RAW_KEYS, FAMILY_H_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyHKeys.ts'
  );
  const { FAMILY_I_RAW_KEYS, FAMILY_I_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyIKeys.ts'
  );
  const { FAMILY_J_RAW_KEYS, FAMILY_J_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyJKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  registry.register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });
  registry.register('argument_scheme', {
    rawKeys: new Set(FAMILY_E_RAW_KEYS),
    classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION,
  });
  registry.register('critical_question', {
    rawKeys: new Set(FAMILY_F_RAW_KEYS),
    classifierSetVersion: FAMILY_F_CLASSIFIER_SET_VERSION,
  });
  registry.register('resolution_progress', {
    rawKeys: new Set(FAMILY_G_RAW_KEYS),
    classifierSetVersion: FAMILY_G_CLASSIFIER_SET_VERSION,
  });
  registry.register('claim_clarity', {
    rawKeys: new Set(FAMILY_H_RAW_KEYS),
    classifierSetVersion: FAMILY_H_CLASSIFIER_SET_VERSION,
  });
  registry.register('thread_topology', {
    rawKeys: new Set(FAMILY_I_RAW_KEYS),
    classifierSetVersion: FAMILY_I_CLASSIFIER_SET_VERSION,
  });
  registry.register('sensitive_composer', {
    rawKeys: new Set(FAMILY_J_RAW_KEYS),
    classifierSetVersion: FAMILY_J_CLASSIFIER_SET_VERSION,
  });
  assertEquals(
    registry.getSupportedFamilies(),
    [
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
      'resolution_progress',
      'claim_clarity',
      'thread_topology',
      'sensitive_composer',
    ],
  );
  assertEquals(registry.getRawKeysForFamily('sensitive_composer').size, 5);
  assertEquals(registry.getClassifierSetVersion('sensitive_composer'), 'family-j-v1');
});

Deno.test('registry-isRawKeySupportedForFamily-ten-way-cross-family-rejection', async () => {
  // With all ten real families registered, cross-family rawKey lookups must
  // return false across the Family J combinations. Each family recognizes
  // only its own rawKey set (HALT #4 cross-family-leak prevention).
  const { FAMILY_D_RAW_KEYS, FAMILY_D_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyDKeys.ts'
  );
  const { FAMILY_E_RAW_KEYS, FAMILY_E_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyEKeys.ts'
  );
  const { FAMILY_F_RAW_KEYS, FAMILY_F_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyFKeys.ts'
  );
  const { FAMILY_G_RAW_KEYS, FAMILY_G_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyGKeys.ts'
  );
  const { FAMILY_H_RAW_KEYS, FAMILY_H_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyHKeys.ts'
  );
  const { FAMILY_I_RAW_KEYS, FAMILY_I_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyIKeys.ts'
  );
  const { FAMILY_J_RAW_KEYS, FAMILY_J_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyJKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  registry.register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  registry.register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });
  registry.register('argument_scheme', {
    rawKeys: new Set(FAMILY_E_RAW_KEYS),
    classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION,
  });
  registry.register('critical_question', {
    rawKeys: new Set(FAMILY_F_RAW_KEYS),
    classifierSetVersion: FAMILY_F_CLASSIFIER_SET_VERSION,
  });
  registry.register('resolution_progress', {
    rawKeys: new Set(FAMILY_G_RAW_KEYS),
    classifierSetVersion: FAMILY_G_CLASSIFIER_SET_VERSION,
  });
  registry.register('claim_clarity', {
    rawKeys: new Set(FAMILY_H_RAW_KEYS),
    classifierSetVersion: FAMILY_H_CLASSIFIER_SET_VERSION,
  });
  registry.register('thread_topology', {
    rawKeys: new Set(FAMILY_I_RAW_KEYS),
    classifierSetVersion: FAMILY_I_CLASSIFIER_SET_VERSION,
  });
  registry.register('sensitive_composer', {
    rawKeys: new Set(FAMILY_J_RAW_KEYS),
    classifierSetVersion: FAMILY_J_CLASSIFIER_SET_VERSION,
  });

  // Family A key under Family J → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('sensitive_composer', 'supports_parent'),
    false,
  );
  // Family I key under Family J → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('sensitive_composer', 'introduces_new_issue'),
    false,
  );
  // Family J key under Family A → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('parent_relation', 'shifts_to_person_or_intent'),
    false,
  );
  // Family J key under Family I → false.
  assertEquals(
    registry.isRawKeySupportedForFamily('thread_topology', 'uses_satire_as_evidence'),
    false,
  );
  // Sanity: Family J supports its own keys.
  assertEquals(
    registry.isRawKeySupportedForFamily('sensitive_composer', 'shifts_to_person_or_intent'),
    true,
  );
  assertEquals(
    registry.isRawKeySupportedForFamily('sensitive_composer', 'uses_popularity_as_evidence'),
    true,
  );
});

Deno.test('registry-getRawKeysForFamily-returns-all-5-for-family-j-uniform', async () => {
  const { FAMILY_J_RAW_KEYS, FAMILY_J_CLASSIFIER_SET_VERSION } = await import(
    '../lib/familyJKeys.ts'
  );
  const registry = createFamilyRegistry();
  registry.register('sensitive_composer', {
    rawKeys: new Set(FAMILY_J_RAW_KEYS),
    classifierSetVersion: FAMILY_J_CLASSIFIER_SET_VERSION,
  });
  const keys = registry.getRawKeysForFamily('sensitive_composer');
  assertEquals(keys.size, 5);
  for (const binding of FAMILY_J_RAW_KEYS) {
    assertEquals(keys.has(binding), true);
  }
});
