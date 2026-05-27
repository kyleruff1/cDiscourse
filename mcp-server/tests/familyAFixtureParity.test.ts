/**
 * MCP-SERVER-002 — Family A fixture parser parity test.
 *
 * The 3 fixture-arg responses (arg1/arg2/arg3) and the canonical Family A
 * response fixture MUST:
 *   - Pass validateMcpBooleanObservationResponse (schema-valid)
 *   - Use only rawKeys in FAMILY_A_RAW_KEYS (no unknown keys)
 *   - Have evidenceSpan strings ≤ MAX_EVIDENCE_SPAN_CHARS (240)
 *   - Pass scanFamilyABooleanResponseForBanList (no verdict tokens)
 *
 * The known-malformed and known-ban-list fixtures MUST fail the
 * corresponding validators (negative tests).
 *
 * The 3 fixture requests MUST be valid Family A requests
 * (validateFamilyBooleanRequest returns ok=true).
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
  MAX_EVIDENCE_SPAN_CHARS,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { scanFamilyABooleanResponseForBanList } from '../lib/familyABanListScan.ts';
import { FAMILY_A_RAW_KEYS } from '../lib/familyAKeys.ts';
import '../lib/familyRegistryInit.ts'; // side-effect: register Family A
import { validateFamilyBooleanRequest } from '../lib/familyBooleanRequestSchema.ts';

const FIXTURE_DIR = new URL('../fixtures/', import.meta.url);

async function loadFixture(name: string): Promise<unknown> {
  const url = new URL(name, FIXTURE_DIR);
  const text = await Deno.readTextFile(url);
  return JSON.parse(text);
}

Deno.test('fixture: family-a-canonical-response passes validator + ban-list', async () => {
  const fixture = await loadFixture('classify-argument-boolean-observations.family-a-canonical-response.json');
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) {
    throw new Error(`canonical fixture failed validator: ${valid.path} — ${valid.detail}`);
  }
  const scan = scanFamilyABooleanResponseForBanList(valid.value);
  if (!scan.ok) {
    throw new Error(`canonical fixture failed ban-list scan at: ${scan.path}`);
  }
});

Deno.test('fixture: arg1-response (root) passes validator + ban-list', async () => {
  const fixture = await loadFixture('classify-argument-boolean-observations.arg1-response.json');
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) {
    throw new Error(`arg1 fixture failed validator: ${valid.path} — ${valid.detail}`);
  }
  const scan = scanFamilyABooleanResponseForBanList(valid.value);
  if (!scan.ok) {
    throw new Error(`arg1 fixture failed ban-list scan at: ${scan.path}`);
  }
});

Deno.test('fixture: arg2-response (depth 1 challenge) passes validator + ban-list', async () => {
  const fixture = await loadFixture('classify-argument-boolean-observations.arg2-response.json');
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) {
    throw new Error(`arg2 fixture failed validator: ${valid.path} — ${valid.detail}`);
  }
  const scan = scanFamilyABooleanResponseForBanList(valid.value);
  if (!scan.ok) {
    throw new Error(`arg2 fixture failed ban-list scan at: ${scan.path}`);
  }
});

Deno.test('fixture: arg3-response (depth 2 counter-rebuttal) passes validator + ban-list', async () => {
  const fixture = await loadFixture('classify-argument-boolean-observations.arg3-response.json');
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) {
    throw new Error(`arg3 fixture failed validator: ${valid.path} — ${valid.detail}`);
  }
  const scan = scanFamilyABooleanResponseForBanList(valid.value);
  if (!scan.ok) {
    throw new Error(`arg3 fixture failed ban-list scan at: ${scan.path}`);
  }
});

Deno.test('fixture: all 3 arg responses use rawKeys in FAMILY_A_RAW_KEYS', async () => {
  const fixtureNames = [
    'classify-argument-boolean-observations.arg1-response.json',
    'classify-argument-boolean-observations.arg2-response.json',
    'classify-argument-boolean-observations.arg3-response.json',
  ];
  for (const name of fixtureNames) {
    const fixture = await loadFixture(name);
    const valid = validateMcpBooleanObservationResponse(fixture);
    if (!valid.ok) {
      throw new Error(`${name} failed validator unexpectedly`);
    }
    for (const rawKey of valid.value.checkedRawKeys) {
      if (!FAMILY_A_RAW_KEYS.includes(rawKey)) {
        throw new Error(`${name} uses unknown rawKey "${rawKey}" — must be in FAMILY_A_RAW_KEYS`);
      }
    }
  }
});

Deno.test('fixture: all 3 arg responses have evidenceSpan ≤ MAX_EVIDENCE_SPAN_CHARS', async () => {
  const fixtureNames = [
    'classify-argument-boolean-observations.arg1-response.json',
    'classify-argument-boolean-observations.arg2-response.json',
    'classify-argument-boolean-observations.arg3-response.json',
  ];
  for (const name of fixtureNames) {
    const fixture = await loadFixture(name);
    const valid = validateMcpBooleanObservationResponse(fixture);
    if (!valid.ok) throw new Error(`${name} validator failed`);
    for (const [rawKey, span] of Object.entries(valid.value.evidenceSpan)) {
      if (typeof span === 'string' && span.length > MAX_EVIDENCE_SPAN_CHARS) {
        throw new Error(
          `${name} evidenceSpan.${rawKey} length ${span.length} > MAX_EVIDENCE_SPAN_CHARS ${MAX_EVIDENCE_SPAN_CHARS}`,
        );
      }
    }
  }
});

Deno.test('fixture: arg1 (root) has 0 positive parent-relation observations', async () => {
  const fixture = (await loadFixture('classify-argument-boolean-observations.arg1-response.json')) as Record<
    string,
    unknown
  >;
  const observations = fixture.observations as Record<string, boolean>;
  const positiveParentRelationKeys = [
    'supports_parent',
    'challenges_parent',
    'refines_parent',
    'extends_parent',
    'distinguishes_parent',
    'reframes_parent',
    'questions_parent',
    'summarizes_parent',
    'acknowledges_parent',
    'corrects_parent_detail',
    'contrasts_with_parent',
    'answers_parent_question',
    'quote_anchors_parent',
  ];
  for (const key of positiveParentRelationKeys) {
    if (observations[key] === true) {
      throw new Error(`arg1 (root) has unexpected positive ${key}=true — no parent should mean no positives`);
    }
  }
});

Deno.test('fixture: arg2 (depth 1 challenge) has challenges_parent=true', async () => {
  const fixture = (await loadFixture('classify-argument-boolean-observations.arg2-response.json')) as Record<
    string,
    unknown
  >;
  const observations = fixture.observations as Record<string, boolean>;
  assertEquals(observations.challenges_parent, true);
});

Deno.test('fixture: arg2 positive count is in [1, 3]', async () => {
  const fixture = (await loadFixture('classify-argument-boolean-observations.arg2-response.json')) as Record<
    string,
    unknown
  >;
  const observations = fixture.observations as Record<string, boolean>;
  // Exclude the auto_metadata/lifecycle keys which the model conservatively
  // reports as false-with-low-confidence (sanitized OUT at timeline surface).
  const parentRelationKeys = [
    'supports_parent',
    'challenges_parent',
    'refines_parent',
    'extends_parent',
    'distinguishes_parent',
    'reframes_parent',
    'questions_parent',
    'summarizes_parent',
    'acknowledges_parent',
    'corrects_parent_detail',
    'contrasts_with_parent',
    'answers_parent_question',
    'quote_anchors_parent',
  ];
  let positives = 0;
  for (const key of parentRelationKeys) {
    if (observations[key] === true) positives += 1;
  }
  if (positives < 1 || positives > 3) {
    throw new Error(`arg2 positive count ${positives} out of expected [1, 3] band`);
  }
});

Deno.test('fixture: arg3 positive count is in [2, 4]', async () => {
  const fixture = (await loadFixture('classify-argument-boolean-observations.arg3-response.json')) as Record<
    string,
    unknown
  >;
  const observations = fixture.observations as Record<string, boolean>;
  const parentRelationKeys = [
    'supports_parent',
    'challenges_parent',
    'refines_parent',
    'extends_parent',
    'distinguishes_parent',
    'reframes_parent',
    'questions_parent',
    'summarizes_parent',
    'acknowledges_parent',
    'corrects_parent_detail',
    'contrasts_with_parent',
    'answers_parent_question',
    'quote_anchors_parent',
  ];
  let positives = 0;
  for (const key of parentRelationKeys) {
    if (observations[key] === true) positives += 1;
  }
  if (positives < 2 || positives > 4) {
    throw new Error(`arg3 positive count ${positives} out of expected [2, 4] band`);
  }
});

Deno.test('fixture: family-a-malformed-response FAILS validator (negative test)', async () => {
  const fixture = await loadFixture('classify-argument-boolean-observations.family-a-malformed-response.json');
  const valid = validateMcpBooleanObservationResponse(fixture);
  assertEquals(valid.ok, false);
});

Deno.test('fixture: family-a-ban-list-response FAILS ban-list scan (negative test)', async () => {
  const fixture = await loadFixture('classify-argument-boolean-observations.family-a-ban-list-response.json');
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) {
    throw new Error('ban-list fixture should pass schema (only ban-list scan should reject)');
  }
  const scan = scanFamilyABooleanResponseForBanList(valid.value);
  assertEquals(scan.ok, false);
});

Deno.test('fixture: 3 Family A request fixtures pass request validator', async () => {
  const requestNames = [
    'classify-argument-boolean-observations.family-a-root-request.json',
    'classify-argument-boolean-observations.family-a-challenge-request.json',
    'classify-argument-boolean-observations.family-a-refine-request.json',
  ];
  for (const name of requestNames) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const result = validateFamilyBooleanRequest(wrapper.input);
    if (!result.ok) {
      throw new Error(`${name} failed request validator`);
    }
  }
});

Deno.test('fixture: unsupported-family-request returns kind=unsupported_family', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.unsupported-family-request.json',
  )) as { input: Record<string, unknown> };
  const result = validateFamilyBooleanRequest(wrapper.input);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.kind, 'unsupported_family');
  }
});
