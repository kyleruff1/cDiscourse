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
