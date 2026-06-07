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
  // 22 ai_classifier rawKeys post MCP-BUILD2d). Family D must be present in
  // the singleton after the side-effect import.
  assertEquals(isFamilySupported('evidence_source_chain'), true);
});

Deno.test('familyRegistryInit-registers-family-e-on-import', () => {
  // MCP-SERVER-006-FAMILY-E added the fifth register() call (uniform
  // ai_classifier path; 16 Walton argumentation schemes). Family E must
  // be present in the singleton after the side-effect import.
  assertEquals(isFamilySupported('argument_scheme'), true);
});

Deno.test('familyRegistryInit-registers-all-nine-families-in-insertion-order', () => {
  // The singleton is shared across test files; however, init registers
  // exactly nine families: Family A first, Family B second, Family C third,
  // Family D fourth, Family E fifth, Family F sixth, Family G seventh,
  // Family H eighth, Family I ninth. Other test files may add fake families
  // via createFamilyRegistry() factories (which yield isolated instances and
  // never touch the singleton). The singleton's getSupportedFamilies() must
  // remain exactly ['parent_relation', 'disagreement_axis',
  // 'misunderstanding_repair', 'evidence_source_chain', 'argument_scheme',
  // 'critical_question', 'resolution_progress', 'claim_clarity',
  // 'thread_topology'] in the current server build.
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
      'resolution_progress',
      'claim_clarity',
      'thread_topology',
    ],
  );
  assertEquals(families.length, 9);
});

Deno.test('familyRegistryInit-family-a-has-19-rawKeys', () => {
  // MCP-BUILD2b (Build-2 manifest §1): 16 → 19 parent_relation booleans.
  const rawKeys = getRawKeysForFamily('parent_relation');
  assertEquals(rawKeys.size, 19);
});

Deno.test('familyRegistryInit-family-b-has-17-rawKeys', () => {
  // MCP-BUILD2a (Build-2 addendum §5): 14 → 17 disagreement_axis booleans.
  const rawKeys = getRawKeysForFamily('disagreement_axis');
  assertEquals(rawKeys.size, 17);
});

Deno.test('familyRegistryInit-family-c-has-20-rawKeys', () => {
  // MCP-BUILD2c (Build-2 manifest §2): 17 → 20 misunderstanding_repair booleans.
  const rawKeys = getRawKeysForFamily('misunderstanding_repair');
  assertEquals(rawKeys.size, 20);
});

Deno.test('familyRegistryInit-family-d-has-22-rawKeys-Subset', () => {
  // MCP-BUILD2d (Build-2 manifest §3): 19 → 22 evidence_source_chain Subset
  // booleans. 22 > the 20-key cap, so the Edge serves Family D in 2 batches
  // (16 + 6); the registry still holds the full 22-key Subset.
  const rawKeys = getRawKeysForFamily('evidence_source_chain');
  assertEquals(rawKeys.size, 22);
});

Deno.test('familyRegistryInit-family-e-has-19-rawKeys', () => {
  // MCP-SERVER-006-FAMILY-E ships 16 Walton (1995, 2008) argumentation
  // schemes; MCP-BUILD2e (Build-2 manifest §4) adds 3 argument-structure
  // booleans → 19, all uniform ai_classifier (no Subset filter).
  const rawKeys = getRawKeysForFamily('argument_scheme');
  assertEquals(rawKeys.size, 19);
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
  // Still exactly nine families registered, in the same insertion order.
  assertEquals(
    getSupportedFamilies(),
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
});

Deno.test('familyRegistryInit-registers-family-f-on-import', () => {
  // MCP-SERVER-007-FAMILY-F added the sixth register() call (uniform
  // ai_classifier path; 14 Walton/Toulmin/Peirce critical questions + 3
  // MCP-BUILD2f question-quality booleans = 17).
  // Family F must be present in the singleton after the side-effect import.
  assertEquals(isFamilySupported('critical_question'), true);
});

Deno.test('familyRegistryInit-family-f-has-17-rawKeys', () => {
  // MCP-SERVER-007-FAMILY-F ships 14 critical questions (Walton 1995/2008 +
  // Toulmin 1958 + Peirce abductive); MCP-BUILD2f (Build-2 manifest §5) adds 3
  // question-quality booleans → 17, all uniform ai_classifier
  // (no Subset filter; Stage 2B NOT REQUIRED per design §1).
  const rawKeys = getRawKeysForFamily('critical_question');
  assertEquals(rawKeys.size, 17);
});

Deno.test('familyRegistryInit-family-f-classifier-version-is-family-f-v1', () => {
  assertEquals(getClassifierSetVersion('critical_question'), 'family-f-v1');
});

Deno.test('familyRegistryInit-registers-family-g-on-import', () => {
  // MCP-SERVER-008-FAMILY-G added the seventh register() call (ai_classifier
  // Subset path; 18 resolution-progress keys; the 12 deterministic
  // auto_metadata + lifecycle keys are excluded). Family G must be present
  // in the singleton after the side-effect import.
  assertEquals(isFamilySupported('resolution_progress'), true);
});

Deno.test('familyRegistryInit-family-g-has-18-rawKeys-Subset', () => {
  // MCP-SERVER-008-FAMILY-G ships the 18-key ai_classifier Subset per Stage
  // 2B operator binding (the 12 deterministic keys are excluded).
  const rawKeys = getRawKeysForFamily('resolution_progress');
  assertEquals(rawKeys.size, 18);
});

Deno.test('familyRegistryInit-family-g-classifier-version-is-family-g-v1', () => {
  assertEquals(getClassifierSetVersion('resolution_progress'), 'family-g-v1');
});

Deno.test('familyRegistryInit-registers-family-h-on-import', () => {
  // MCP-SERVER-009-FAMILY-H added the eighth register() call (uniform
  // ai_classifier path; 12 claim-clarity keys; 1 existing + 11 NEW). Family
  // H must be present in the singleton after the side-effect import.
  assertEquals(isFamilySupported('claim_clarity'), true);
});

Deno.test('familyRegistryInit-family-h-has-12-rawKeys', () => {
  // MCP-SERVER-009-FAMILY-H ships the 12-key ai_classifier UNIFORM set per
  // design §A.1.1 (no subset filter; H is uniform ai_classifier).
  const rawKeys = getRawKeysForFamily('claim_clarity');
  assertEquals(rawKeys.size, 12);
});

Deno.test('familyRegistryInit-family-h-classifier-version-is-family-h-v1', () => {
  assertEquals(getClassifierSetVersion('claim_clarity'), 'family-h-v1');
});

Deno.test('familyRegistryInit-registers-family-i-on-import', () => {
  // MCP-SERVER-010-FAMILY-I added the ninth register() call (ai_classifier
  // MIXED-source Subset path; 6 thread-topology keys; the 15 deterministic
  // auto_metadata + lifecycle keys are excluded). Family I must be present
  // in the singleton after the side-effect import.
  assertEquals(isFamilySupported('thread_topology'), true);
});

Deno.test('familyRegistryInit-family-i-has-6-rawKeys-Subset', () => {
  // MCP-SERVER-010-FAMILY-I ships the 6-key ai_classifier Subset per Stage
  // 2B operator binding (the 15 deterministic keys are excluded).
  const rawKeys = getRawKeysForFamily('thread_topology');
  assertEquals(rawKeys.size, 6);
});

Deno.test('familyRegistryInit-family-i-classifier-version-is-family-i-v1', () => {
  assertEquals(getClassifierSetVersion('thread_topology'), 'family-i-v1');
});
