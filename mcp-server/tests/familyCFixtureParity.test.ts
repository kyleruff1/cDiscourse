/**
 * MCP-SERVER-004-FAMILY-C — Family C fixture parser parity test.
 *
 * The canonical Family C response fixture + 5 per-scenario request fixtures MUST:
 *   - Pass validateMcpBooleanObservationResponse (schema-valid) for the canonical response
 *   - Use only rawKeys in FAMILY_C_RAW_KEYS (no unknown keys)
 *   - Have evidenceSpan strings ≤ MAX_EVIDENCE_SPAN_CHARS (240) for responses
 *   - Pass scanFamilyCBooleanResponseForBanList (no verdict tokens) for the canonical
 *   - Pass validateFamilyBooleanRequest for the 5 per-scenario request fixtures
 *
 * The known-malformed and known-ban-list fixtures MUST fail the
 * corresponding validators (negative tests).
 *
 * This test file is robust to import order: it defensively registers Family
 * C into the singleton registry if (and only if) Family C has not yet been
 * registered. After Commit 4, familyRegistryInit.ts already registers
 * Family C, so the guard is a no-op.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
  MAX_EVIDENCE_SPAN_CHARS,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { scanFamilyCBooleanResponseForBanList } from '../lib/familyCBanListScan.ts';
import {
  FAMILY_C_RAW_KEYS,
  FAMILY_C_CLASSIFIER_SET_VERSION,
} from '../lib/familyCKeys.ts';
import '../lib/familyRegistryInit.ts'; // side-effect: register Family A + B + C
import { isFamilySupported, register } from '../lib/familyRegistry.ts';
import { validateFamilyBooleanRequest } from '../lib/familyBooleanRequestSchema.ts';

// Defensive: ensure Family C is registered (familyRegistryInit.ts has it
// after Commit 4; the guard makes this test self-sufficient).
if (!isFamilySupported('misunderstanding_repair')) {
  register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });
}

const FIXTURE_DIR = new URL('../fixtures/', import.meta.url);

async function loadFixture(name: string): Promise<unknown> {
  const url = new URL(name, FIXTURE_DIR);
  const text = await Deno.readTextFile(url);
  return JSON.parse(text);
}

Deno.test('fixture: family-c-canonical-response passes validator + ban-list', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-c-canonical-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) {
    throw new Error(`canonical fixture failed validator: ${valid.path} — ${valid.detail}`);
  }
  const scan = scanFamilyCBooleanResponseForBanList(valid.value);
  if (!scan.ok) {
    throw new Error(`canonical fixture failed ban-list scan at: ${scan.path}`);
  }
});

Deno.test('fixture: family-c-canonical-response uses only rawKeys in FAMILY_C_RAW_KEYS', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-c-canonical-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) throw new Error('canonical fixture failed validator');
  for (const rawKey of valid.value.checkedRawKeys) {
    if (!FAMILY_C_RAW_KEYS.includes(rawKey)) {
      throw new Error(
        `canonical fixture uses unknown rawKey "${rawKey}" — must be in FAMILY_C_RAW_KEYS`,
      );
    }
  }
});

Deno.test('fixture: family-c-canonical-response classifierSetVersion is family-c-v1', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-c-canonical-response.json',
  )) as Record<string, unknown>;
  const modelInfo = fixture.modelInfo as Record<string, unknown>;
  assertEquals(modelInfo.classifierSetVersion, 'family-c-v1');
});

Deno.test('fixture: family-c-canonical-response has all 20 rawKeys', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-c-canonical-response.json',
  )) as Record<string, unknown>;
  const checkedRawKeys = fixture.checkedRawKeys as string[];
  assertEquals(checkedRawKeys.length, 20);
});

Deno.test('fixture: family-c-canonical-response has the canonical positives (offers_candidate_understanding + other_initiates_repair)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-c-canonical-response.json',
  )) as Record<string, unknown>;
  const observations = fixture.observations as Record<string, boolean>;
  assertEquals(observations.offers_candidate_understanding, true);
  assertEquals(observations.other_initiates_repair, true);
});

Deno.test('fixture: family-c-canonical-response clarified is false with low confidence (lifecycle guard)', async () => {
  // Per design §2 and intent brief §4.3: the clarified lifecycle key
  // defaults to FALSE with low confidence when only move text is visible
  // (no cluster context). The canonical fixture must encode this.
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-c-canonical-response.json',
  )) as Record<string, unknown>;
  const observations = fixture.observations as Record<string, boolean>;
  const confidence = fixture.confidence as Record<string, string>;
  assertEquals(observations.clarified, false);
  assertEquals(confidence.clarified, 'low');
});

Deno.test('fixture: family-c-canonical-response evidenceSpan strings are all ≤ MAX_EVIDENCE_SPAN_CHARS', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-c-canonical-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) throw new Error('canonical fixture failed validator');
  for (const [rawKey, span] of Object.entries(valid.value.evidenceSpan)) {
    if (typeof span === 'string' && span.length > MAX_EVIDENCE_SPAN_CHARS) {
      throw new Error(
        `canonical evidenceSpan.${rawKey} length ${span.length} > MAX_EVIDENCE_SPAN_CHARS ${MAX_EVIDENCE_SPAN_CHARS}`,
      );
    }
  }
});

Deno.test('fixture: family-c-malformed-response FAILS validator (negative test)', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-c-malformed-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  assertEquals(valid.ok, false);
});

Deno.test('fixture: family-c-ban-list-response FAILS ban-list scan (negative test)', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-c-ban-list-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) {
    throw new Error('ban-list fixture should pass schema (only ban-list scan should reject)');
  }
  const scan = scanFamilyCBooleanResponseForBanList(valid.value);
  assertEquals(scan.ok, false);
  if (!scan.ok) {
    assertEquals(scan.path, 'evidenceSpan.rejects_candidate_understanding');
  }
});

Deno.test('fixture: 5 Family C per-scenario request fixtures all pass request validator', async () => {
  const requestNames = [
    'classify-argument-boolean-observations.family-c-canonical-request.json',
    'classify-argument-boolean-observations.family-c-clarification-cycle-request.json',
    'classify-argument-boolean-observations.family-c-candidate-understanding-request.json',
    'classify-argument-boolean-observations.family-c-shared-definition-request.json',
    'classify-argument-boolean-observations.family-c-no-repair-request.json',
  ];
  for (const name of requestNames) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const result = validateFamilyBooleanRequest(wrapper.input);
    if (!result.ok) {
      throw new Error(`${name} failed request validator: kind=${result.kind}`);
    }
  }
});

Deno.test('fixture: 5 Family C per-scenario request fixtures all target requestedFamilies=misunderstanding_repair', async () => {
  const requestNames = [
    'classify-argument-boolean-observations.family-c-canonical-request.json',
    'classify-argument-boolean-observations.family-c-clarification-cycle-request.json',
    'classify-argument-boolean-observations.family-c-candidate-understanding-request.json',
    'classify-argument-boolean-observations.family-c-shared-definition-request.json',
    'classify-argument-boolean-observations.family-c-no-repair-request.json',
  ];
  for (const name of requestNames) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const families = wrapper.input.requestedFamilies as string[];
    if (!families.includes('misunderstanding_repair')) {
      throw new Error(`${name} should target 'misunderstanding_repair' but got: ${JSON.stringify(families)}`);
    }
  }
});

Deno.test('fixture: 5 Family C per-scenario request fixtures use only rawKeys in FAMILY_C_RAW_KEYS', async () => {
  const requestNames = [
    'classify-argument-boolean-observations.family-c-canonical-request.json',
    'classify-argument-boolean-observations.family-c-clarification-cycle-request.json',
    'classify-argument-boolean-observations.family-c-candidate-understanding-request.json',
    'classify-argument-boolean-observations.family-c-shared-definition-request.json',
    'classify-argument-boolean-observations.family-c-no-repair-request.json',
  ];
  for (const name of requestNames) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const rawKeys = wrapper.input.requestedRawKeys as string[];
    for (const rawKey of rawKeys) {
      if (!FAMILY_C_RAW_KEYS.includes(rawKey)) {
        throw new Error(`${name} requests rawKey '${rawKey}' which is not in FAMILY_C_RAW_KEYS`);
      }
    }
  }
});

Deno.test('fixture: family-c-canonical-request requests all 20 rawKeys', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-c-canonical-request.json',
  )) as { input: Record<string, unknown> };
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  assertEquals(rawKeys.length, 20);
});
