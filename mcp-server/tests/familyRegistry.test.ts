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

Deno.test('registry-getRawKeysForFamily-returns-all-16-for-family-a', () => {
  const registry = createFamilyRegistry();
  registry.register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
  const keys = registry.getRawKeysForFamily('parent_relation');
  assertEquals(keys.size, 16);
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

Deno.test('registry-isRawKeySupportedForFamily-true-for-all-16-keys', () => {
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
  assertEquals(registry.getRawKeysForFamily('disagreement_axis').size, 14);
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
  assertEquals(registry.getRawKeysForFamily('misunderstanding_repair').size, 17);
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

Deno.test('registry-getRawKeysForFamily-returns-all-17-for-family-c', () => {
  const registry = createFamilyRegistry();
  registry.register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
  const keys = registry.getRawKeysForFamily('misunderstanding_repair');
  assertEquals(keys.size, 17);
  for (const binding of FAMILY_C_RAW_KEYS) {
    assertEquals(keys.has(binding), true);
  }
});
