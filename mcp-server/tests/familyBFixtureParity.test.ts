/**
 * MCP-SERVER-003-FAMILY-B — Family B fixture parser parity test.
 *
 * The canonical Family B response fixture + 8 per-axis request fixtures MUST:
 *   - Pass validateMcpBooleanObservationResponse (schema-valid) for responses
 *   - Use only rawKeys in FAMILY_B_RAW_KEYS (no unknown keys)
 *   - Have evidenceSpan strings ≤ MAX_EVIDENCE_SPAN_CHARS (240) for responses
 *   - Pass scanFamilyBBooleanResponseForBanList (no verdict tokens) for the canonical
 *   - Pass validateFamilyBooleanRequest for the 8 per-axis request fixtures
 *
 * The known-malformed and known-ban-list fixtures MUST fail the
 * corresponding validators (negative tests).
 *
 * This test file is robust to import order: it defensively registers Family
 * B into the singleton registry if (and only if) Family B has not yet been
 * registered. Once Commit 4 ships `familyRegistryInit.ts` with the Family B
 * registration, the guard is a no-op.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
  MAX_EVIDENCE_SPAN_CHARS,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { scanFamilyBBooleanResponseForBanList } from '../lib/familyBBanListScan.ts';
import {
  FAMILY_B_RAW_KEYS,
  FAMILY_B_CLASSIFIER_SET_VERSION,
} from '../lib/familyBKeys.ts';
import '../lib/familyRegistryInit.ts'; // side-effect: register Family A (and Family B once Commit 4 lands)
import { isFamilySupported, register } from '../lib/familyRegistry.ts';
import { validateFamilyBooleanRequest } from '../lib/familyBooleanRequestSchema.ts';

// Defensive: ensure Family B is registered (Commit 4 will move this into
// familyRegistryInit.ts; until then the guard makes this test self-sufficient).
if (!isFamilySupported('disagreement_axis')) {
  register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });
}

const FIXTURE_DIR = new URL('../fixtures/', import.meta.url);

async function loadFixture(name: string): Promise<unknown> {
  const url = new URL(name, FIXTURE_DIR);
  const text = await Deno.readTextFile(url);
  return JSON.parse(text);
}

Deno.test('fixture: family-b-canonical-response passes validator + ban-list', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-b-canonical-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) {
    throw new Error(`canonical fixture failed validator: ${valid.path} — ${valid.detail}`);
  }
  const scan = scanFamilyBBooleanResponseForBanList(valid.value);
  if (!scan.ok) {
    throw new Error(`canonical fixture failed ban-list scan at: ${scan.path}`);
  }
});

Deno.test('fixture: family-b-canonical-response uses only rawKeys in FAMILY_B_RAW_KEYS', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-b-canonical-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) throw new Error('canonical fixture failed validator');
  for (const rawKey of valid.value.checkedRawKeys) {
    if (!FAMILY_B_RAW_KEYS.includes(rawKey)) {
      throw new Error(
        `canonical fixture uses unknown rawKey "${rawKey}" — must be in FAMILY_B_RAW_KEYS`,
      );
    }
  }
});

Deno.test('fixture: family-b-canonical-response classifierSetVersion is family-b-v1', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-b-canonical-response.json',
  )) as Record<string, unknown>;
  const modelInfo = fixture.modelInfo as Record<string, unknown>;
  assertEquals(modelInfo.classifierSetVersion, 'family-b-v1');
});

Deno.test('fixture: family-b-canonical-response has all 14 rawKeys', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-b-canonical-response.json',
  )) as Record<string, unknown>;
  const checkedRawKeys = fixture.checkedRawKeys as string[];
  assertEquals(checkedRawKeys.length, 14);
});

Deno.test('fixture: family-b-canonical-response has multi-axis positive (disagreement_present + disputes_fact + disputes_scope)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-b-canonical-response.json',
  )) as Record<string, unknown>;
  const observations = fixture.observations as Record<string, boolean>;
  assertEquals(observations.disagreement_present, true);
  assertEquals(observations.disputes_fact, true);
  assertEquals(observations.disputes_scope, true);
});

Deno.test('fixture: family-b-canonical-response evidenceSpan strings are all ≤ MAX_EVIDENCE_SPAN_CHARS', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-b-canonical-response.json',
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

Deno.test('fixture: family-b-malformed-response FAILS validator (negative test)', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-b-malformed-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  assertEquals(valid.ok, false);
});

Deno.test('fixture: family-b-ban-list-response FAILS ban-list scan (negative test)', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-b-ban-list-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) {
    throw new Error('ban-list fixture should pass schema (only ban-list scan should reject)');
  }
  const scan = scanFamilyBBooleanResponseForBanList(valid.value);
  assertEquals(scan.ok, false);
  if (!scan.ok) {
    assertEquals(scan.path, 'evidenceSpan.disputes_value_weighting');
  }
});

Deno.test('fixture: 8 Family B per-axis request fixtures all pass request validator', async () => {
  const requestNames = [
    'classify-argument-boolean-observations.family-b-no-disagreement-request.json',
    'classify-argument-boolean-observations.family-b-definition-dispute-request.json',
    'classify-argument-boolean-observations.family-b-fact-vs-applicability-request.json',
    'classify-argument-boolean-observations.family-b-value-weighting-request.json',
    'classify-argument-boolean-observations.family-b-relevance-with-reason-request.json',
    'classify-argument-boolean-observations.family-b-relevance-no-reason-request.json',
    'classify-argument-boolean-observations.family-b-multi-axis-request.json',
    'classify-argument-boolean-observations.family-b-doctrine-stress-request.json',
  ];
  for (const name of requestNames) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const result = validateFamilyBooleanRequest(wrapper.input);
    if (!result.ok) {
      throw new Error(`${name} failed request validator: kind=${result.kind}`);
    }
  }
});

Deno.test('fixture: 8 Family B per-axis request fixtures all target requestedFamilies=disagreement_axis', async () => {
  const requestNames = [
    'classify-argument-boolean-observations.family-b-no-disagreement-request.json',
    'classify-argument-boolean-observations.family-b-definition-dispute-request.json',
    'classify-argument-boolean-observations.family-b-fact-vs-applicability-request.json',
    'classify-argument-boolean-observations.family-b-value-weighting-request.json',
    'classify-argument-boolean-observations.family-b-relevance-with-reason-request.json',
    'classify-argument-boolean-observations.family-b-relevance-no-reason-request.json',
    'classify-argument-boolean-observations.family-b-multi-axis-request.json',
    'classify-argument-boolean-observations.family-b-doctrine-stress-request.json',
  ];
  for (const name of requestNames) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const families = wrapper.input.requestedFamilies as string[];
    if (!families.includes('disagreement_axis')) {
      throw new Error(`${name} should target 'disagreement_axis' but got: ${JSON.stringify(families)}`);
    }
  }
});

Deno.test('fixture: 8 Family B per-axis request fixtures use only rawKeys in FAMILY_B_RAW_KEYS', async () => {
  const requestNames = [
    'classify-argument-boolean-observations.family-b-no-disagreement-request.json',
    'classify-argument-boolean-observations.family-b-definition-dispute-request.json',
    'classify-argument-boolean-observations.family-b-fact-vs-applicability-request.json',
    'classify-argument-boolean-observations.family-b-value-weighting-request.json',
    'classify-argument-boolean-observations.family-b-relevance-with-reason-request.json',
    'classify-argument-boolean-observations.family-b-relevance-no-reason-request.json',
    'classify-argument-boolean-observations.family-b-multi-axis-request.json',
    'classify-argument-boolean-observations.family-b-doctrine-stress-request.json',
  ];
  for (const name of requestNames) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const rawKeys = wrapper.input.requestedRawKeys as string[];
    for (const rawKey of rawKeys) {
      if (!FAMILY_B_RAW_KEYS.includes(rawKey)) {
        throw new Error(`${name} requests rawKey '${rawKey}' which is not in FAMILY_B_RAW_KEYS`);
      }
    }
  }
});
