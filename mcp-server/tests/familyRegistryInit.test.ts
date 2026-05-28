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

Deno.test('familyRegistryInit-registers-family-b-on-import', () => {
  // MCP-SERVER-003-FAMILY-B added the second register() call. Family B must
  // be present in the singleton after the side-effect import.
  assertEquals(isFamilySupported('disagreement_axis'), true);
});

Deno.test('familyRegistryInit-registers-family-c-on-import', () => {
  // MCP-SERVER-004-FAMILY-C added the third register() call. Family C must
  // be present in the singleton after the side-effect import.
  assertEquals(isFamilySupported('misunderstanding_repair'), true);
});

Deno.test('familyRegistryInit-registers-family-d-on-import', () => {
  // MCP-SERVER-005-FAMILY-D added the fourth register() call (Subset path,
  // 19 ai_classifier rawKeys). Family D must be present in the singleton
  // after the side-effect import.
  assertEquals(isFamilySupported('evidence_source_chain'), true);
});

Deno.test('familyRegistryInit-registers-family-e-on-import', () => {
  // MCP-SERVER-006-FAMILY-E added the fifth register() call (uniform
  // ai_classifier path; 16 Walton argumentation schemes). Family E must
  // be present in the singleton after the side-effect import.
  assertEquals(isFamilySupported('argument_scheme'), true);
});

Deno.test('familyRegistryInit-registers-all-six-families-in-insertion-order', () => {
  // The singleton is shared across test files; however, init registers
  // exactly six families: Family A first, Family B second, Family C third,
  // Family D fourth, Family E fifth, Family F sixth. Other test files may
  // add fake families via createFamilyRegistry() factories (which yield
  // isolated instances and never touch the singleton). The singleton's
  // getSupportedFamilies() must remain exactly ['parent_relation',
  // 'disagreement_axis', 'misunderstanding_repair', 'evidence_source_chain',
  // 'argument_scheme', 'critical_question'] in the current server build.
  const families = getSupportedFamilies();
  assertEquals(
    families,
    [
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
    ],
  );
  assertEquals(families.length, 6);
});

Deno.test('familyRegistryInit-family-a-has-16-rawKeys', () => {
  const rawKeys = getRawKeysForFamily('parent_relation');
  assertEquals(rawKeys.size, 16);
});

Deno.test('familyRegistryInit-family-b-has-14-rawKeys', () => {
  const rawKeys = getRawKeysForFamily('disagreement_axis');
  assertEquals(rawKeys.size, 14);
});

Deno.test('familyRegistryInit-family-c-has-17-rawKeys', () => {
  const rawKeys = getRawKeysForFamily('misunderstanding_repair');
  assertEquals(rawKeys.size, 17);
});

Deno.test('familyRegistryInit-family-d-has-19-rawKeys-Subset', () => {
  const rawKeys = getRawKeysForFamily('evidence_source_chain');
  assertEquals(rawKeys.size, 19);
});

Deno.test('familyRegistryInit-family-e-has-16-rawKeys', () => {
  // MCP-SERVER-006-FAMILY-E ships 16 Walton (1995, 2008) argumentation
  // schemes, all uniform ai_classifier (no Subset filter).
  const rawKeys = getRawKeysForFamily('argument_scheme');
  assertEquals(rawKeys.size, 16);
});

Deno.test('familyRegistryInit-family-a-classifier-version-is-family-a-v1', () => {
  assertEquals(getClassifierSetVersion('parent_relation'), 'family-a-v1');
});

Deno.test('familyRegistryInit-family-b-classifier-version-is-family-b-v1', () => {
  assertEquals(getClassifierSetVersion('disagreement_axis'), 'family-b-v1');
});

Deno.test('familyRegistryInit-family-c-classifier-version-is-family-c-v1', () => {
  assertEquals(getClassifierSetVersion('misunderstanding_repair'), 'family-c-v1');
});

Deno.test('familyRegistryInit-family-d-classifier-version-is-family-d-v1', () => {
  assertEquals(getClassifierSetVersion('evidence_source_chain'), 'family-d-v1');
});

Deno.test('familyRegistryInit-family-e-classifier-version-is-family-e-v1', () => {
  assertEquals(getClassifierSetVersion('argument_scheme'), 'family-e-v1');
});

Deno.test('familyRegistryInit-initializeFamilyRegistry-is-idempotent', () => {
  // Second invocation must not throw (idempotent guard per design §5.2).
  // Without the guard, the underlying registry.register() would throw
  // 'family already registered: parent_relation'.
  initializeFamilyRegistry();
  initializeFamilyRegistry();
  // Still exactly six families registered, in the same insertion order.
  assertEquals(
    getSupportedFamilies(),
    [
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
    ],
  );
});

Deno.test('familyRegistryInit-registers-family-f-on-import', () => {
  // MCP-SERVER-007-FAMILY-F added the sixth register() call (uniform
  // ai_classifier path; 14 Walton/Toulmin/Peirce critical questions).
  // Family F must be present in the singleton after the side-effect import.
  assertEquals(isFamilySupported('critical_question'), true);
});

Deno.test('familyRegistryInit-family-f-has-14-rawKeys', () => {
  // MCP-SERVER-007-FAMILY-F ships 14 critical questions (Walton 1995/2008 +
  // Toulmin 1958 + Peirce abductive), all uniform ai_classifier
  // (no Subset filter; Stage 2B NOT REQUIRED per design §1).
  const rawKeys = getRawKeysForFamily('critical_question');
  assertEquals(rawKeys.size, 14);
});

Deno.test('familyRegistryInit-family-f-classifier-version-is-family-f-v1', () => {
  assertEquals(getClassifierSetVersion('critical_question'), 'family-f-v1');
});
