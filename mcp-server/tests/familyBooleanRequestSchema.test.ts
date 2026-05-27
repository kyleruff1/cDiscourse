/**
 * OPS-MCP-FAMILY-VALIDATOR-REFACTOR — Direct tests for validateFamilyBooleanRequest.
 *
 * These tests exercise the validator at the function-call boundary, asserting
 * byte-equal envelope shapes for every failure path documented in design §2.4.
 * The byte-equal preservation is the dominant risk per HALT #14; the 14
 * literal failure-string assertions below are the primary mitigation.
 *
 * The validator queries the production singleton registry; we ensure Family A
 * is registered at module load (defensive — Commit 3 introduces
 * `familyRegistryInit.ts` which is the canonical registration site; this
 * guard makes the test file robust to import order without double-registering).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — validator never produces verdict tokens;
 *     these tests assert only structural error envelopes.
 *   - test-discipline — byte-equal failure-string preservation across the
 *     11 validation rules listed in design §2.4.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { validateFamilyBooleanRequest } from '../lib/familyBooleanRequestSchema.ts';
import { isFamilySupported, register } from '../lib/familyRegistry.ts';
import {
  FAMILY_A_RAW_KEYS,
  FAMILY_A_CLASSIFIER_SET_VERSION,
} from '../lib/familyAKeys.ts';

// Ensure Family A is registered in the production singleton for these tests.
// Commit 3 will introduce familyRegistryInit.ts as the canonical registration
// site; this guard keeps the test self-sufficient and avoids a double-register
// throw if init happens elsewhere in the module graph.
if (!isFamilySupported('parent_relation')) {
  register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });
}

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1';

function validRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'test-node-1',
    parentNodeId: null,
    currentText: 'test body',
    parentText: null,
    threadContextExcerpt: 'test thread excerpt',
    requestedFamilies: ['parent_relation'],
    requestedRawKeys: ['supports_parent', 'challenges_parent'],
    definitions: {},
    timeoutMs: 12000,
    ...overrides,
  };
}

Deno.test('validateFamilyBooleanRequest-valid-family-a-request-passes', () => {
  const result = validateFamilyBooleanRequest(validRequest());
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.schemaVersion, SCHEMA_VERSION);
    assertEquals(result.value.nodeId, 'test-node-1');
    assertEquals(result.value.parentNodeId, null);
    assertEquals(result.value.currentText, 'test body');
    assertEquals(result.value.parentText, null);
    assertEquals(result.value.threadContextExcerpt, 'test thread excerpt');
    assertEquals(result.value.requestedFamilies, ['parent_relation']);
    assertEquals(result.value.requestedRawKeys, ['supports_parent', 'challenges_parent']);
    assertEquals(result.value.timeoutMs, 12000);
  }
});

Deno.test('validateFamilyBooleanRequest-empty-requestedRawKeys-array-accepted', () => {
  const result = validateFamilyBooleanRequest(validRequest({ requestedRawKeys: [] }));
  assertEquals(result.ok, true);
});

Deno.test('validateFamilyBooleanRequest-empty-requestedFamilies-array-accepted', () => {
  const result = validateFamilyBooleanRequest(validRequest({ requestedFamilies: [] }));
  assertEquals(result.ok, true);
});

Deno.test('validateFamilyBooleanRequest-rejects-non-object-with-invalid_params', () => {
  const result = validateFamilyBooleanRequest('string');
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, '$');
    assertEquals(result.detail, 'must be a plain object');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-bad-schemaVersion', () => {
  const result = validateFamilyBooleanRequest(validRequest({ schemaVersion: 'wrong' }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'schemaVersion');
    assertEquals(result.detail, `expected ${SCHEMA_VERSION}; got wrong`);
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-non-string-nodeId', () => {
  const result = validateFamilyBooleanRequest(validRequest({ nodeId: 123 }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'nodeId');
    assertEquals(result.detail, 'must be string');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-empty-nodeId', () => {
  const result = validateFamilyBooleanRequest(validRequest({ nodeId: '' }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'nodeId');
    assertEquals(result.detail, 'length below 1');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-oversized-nodeId', () => {
  const result = validateFamilyBooleanRequest(validRequest({ nodeId: 'x'.repeat(513) }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'nodeId');
    assertEquals(result.detail, 'length above 512');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-oversized-currentText', () => {
  const result = validateFamilyBooleanRequest(validRequest({ currentText: 'x'.repeat(8001) }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'currentText');
    assertEquals(result.detail, 'length above 8000');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-oversized-parentText', () => {
  const result = validateFamilyBooleanRequest(validRequest({ parentText: 'x'.repeat(8001) }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'parentText');
    assertEquals(result.detail, 'length above 8000');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-oversized-threadContextExcerpt', () => {
  const result = validateFamilyBooleanRequest(
    validRequest({ threadContextExcerpt: 'x'.repeat(8001) }),
  );
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'threadContextExcerpt');
    assertEquals(result.detail, 'length above 8000');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-unsupported-family-with-byte-equal-envelope', () => {
  const result = validateFamilyBooleanRequest(
    validRequest({ requestedFamilies: ['disagreement_axis'] }),
  );
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_family') {
    assertEquals(result.requestedFamilies, ['disagreement_axis']);
  } else {
    throw new Error('expected unsupported_family failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-unsupported-rawKey-with-byte-equal-envelope', () => {
  const result = validateFamilyBooleanRequest(
    validRequest({ requestedRawKeys: ['supports_parent', 'fictional_raw_key_xyz'] }),
  );
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'unsupported_rawKey') {
    // Only the unsupported one in the envelope; the supported one is filtered
    // out (matches pre-refactor behavior).
    assertEquals(result.unsupportedRawKeys, ['fictional_raw_key_xyz']);
  } else {
    throw new Error('expected unsupported_rawKey failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-non-plain-object-definitions', () => {
  const result = validateFamilyBooleanRequest(validRequest({ definitions: [] }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'definitions');
    assertEquals(result.detail, 'must be plain object');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-non-integer-timeoutMs', () => {
  const result = validateFamilyBooleanRequest(validRequest({ timeoutMs: 12.5 }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'timeoutMs');
    assertEquals(result.detail, 'must be integer');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-timeoutMs-below-1', () => {
  const result = validateFamilyBooleanRequest(validRequest({ timeoutMs: 0 }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'timeoutMs');
    assertEquals(result.detail, 'out of range 1..60000');
  } else {
    throw new Error('expected invalid_params failure');
  }
});

Deno.test('validateFamilyBooleanRequest-rejects-timeoutMs-above-60000', () => {
  const result = validateFamilyBooleanRequest(validRequest({ timeoutMs: 60001 }));
  assertEquals(result.ok, false);
  if (!result.ok && result.kind === 'invalid_params') {
    assertEquals(result.path, 'timeoutMs');
    assertEquals(result.detail, 'out of range 1..60000');
  } else {
    throw new Error('expected invalid_params failure');
  }
});
