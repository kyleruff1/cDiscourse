/**
 * OPS-MCP-FAMILY-VALIDATOR-REFACTOR — Family registry init module tests.
 *
 * These tests target the production singleton (via the side-effect import of
 * `familyRegistryInit.ts`). The init module is idempotent — re-calling
 * `initializeFamilyRegistry()` after the first invocation is a no-op, which
 * the last test asserts.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — init registers structural-observation
 *     groupings; the tests assert only registration shape and counts.
 *   - test-discipline — init module is part of the validator surface;
 *     covered with dedicated unit tests.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { initializeFamilyRegistry } from '../lib/familyRegistryInit.ts';
import {
  getClassifierSetVersion,
  getRawKeysForFamily,
  getSupportedFamilies,
  isFamilySupported,
} from '../lib/familyRegistry.ts';

Deno.test('familyRegistryInit-registers-family-a-on-import', () => {
  // The import above triggered the top-of-file side effect, which calls
  // initializeFamilyRegistry() once. Family A must be present in the singleton.
  assertEquals(isFamilySupported('parent_relation'), true);
});

Deno.test('familyRegistryInit-registers-only-family-a', () => {
  // The singleton is shared across test files; however, init registers only
  // Family A. Other test files may add fake families via createFamilyRegistry()
  // factories (which yield isolated instances and never touch the singleton).
  // So the singleton's getSupportedFamilies() must remain exactly
  // ['parent_relation'] in the current server build.
  const families = getSupportedFamilies();
  assertEquals(families, ['parent_relation']);
  assertEquals(families.length, 1);
});

Deno.test('familyRegistryInit-family-a-has-16-rawKeys', () => {
  const rawKeys = getRawKeysForFamily('parent_relation');
  assertEquals(rawKeys.size, 16);
});

Deno.test('familyRegistryInit-family-a-classifier-version-is-family-a-v1', () => {
  assertEquals(getClassifierSetVersion('parent_relation'), 'family-a-v1');
});

Deno.test('familyRegistryInit-initializeFamilyRegistry-is-idempotent', () => {
  // Second invocation must not throw (idempotent guard per design §5.2).
  // Without the guard, the underlying registry.register() would throw
  // 'family already registered: parent_relation'.
  initializeFamilyRegistry();
  initializeFamilyRegistry();
  // Still exactly one family registered.
  assertEquals(getSupportedFamilies(), ['parent_relation']);
});
