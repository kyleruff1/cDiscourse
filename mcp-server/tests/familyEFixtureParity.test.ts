/**
 * MCP-SERVER-006-FAMILY-E — Family E fixture parser parity test.
 *
 * The canonical Family E response fixture + 8 per-scenario request
 * fixtures MUST:
 *   - Pass validateMcpBooleanObservationResponse (schema-valid) for the
 *     canonical response
 *   - Use only rawKeys in FAMILY_E_RAW_KEYS (no Family A/B/C/D keys)
 *   - Have evidenceSpan strings ≤ MAX_EVIDENCE_SPAN_CHARS (240) for
 *     responses
 *   - Pass scanFamilyEBooleanResponseForBanList (no verdict tokens AND
 *     no Family-E-specific fallacy/weak/invalid/flawed/wrong tokens) for
 *     the canonical
 *   - Pass validateFamilyBooleanRequest for the 8 per-scenario request
 *     fixtures
 *   - 3 of the 8 request fixtures target slippery_slope_reasoning_present
 *     (amendment §2 BINDING)
 *
 * The known-malformed and known-ban-list fixtures MUST fail the
 * corresponding validators (negative tests).
 *
 * This test file is robust to import order: it defensively registers
 * Family E into the singleton registry if (and only if) Family E has
 * not yet been registered. After Commit 4, familyRegistryInit.ts
 * already registers Family E, so the guard is a no-op.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
  MAX_EVIDENCE_SPAN_CHARS,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { scanFamilyEBooleanResponseForBanList } from '../lib/familyEBanListScan.ts';
import {
  FAMILY_E_RAW_KEYS,
  FAMILY_E_CLASSIFIER_SET_VERSION,
} from '../lib/familyEKeys.ts';
import '../lib/familyRegistryInit.ts'; // side-effect: register Family A + B + C + D + E
import { isFamilySupported, register } from '../lib/familyRegistry.ts';
import { validateFamilyBooleanRequest } from '../lib/familyBooleanRequestSchema.ts';

// Defensive: ensure Family E is registered (familyRegistryInit.ts has it
// after Commit 4; the guard makes this test self-sufficient).
if (!isFamilySupported('argument_scheme')) {
  register('argument_scheme', {
    rawKeys: new Set(FAMILY_E_RAW_KEYS),
    classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION,
  });
}

const FIXTURE_DIR = new URL('../fixtures/', import.meta.url);

async function loadFixture(name: string): Promise<unknown> {
  const url = new URL(name, FIXTURE_DIR);
  const text = await Deno.readTextFile(url);
  return JSON.parse(text);
}

// All 8 binding request fixtures per design §4.
const REQUEST_FIXTURE_NAMES = [
  'classify-argument-boolean-observations.family-e-canonical-request.json',
  'classify-argument-boolean-observations.family-e-slippery-slope-clear-request.json',
  'classify-argument-boolean-observations.family-e-slippery-slope-adversarial-fallacy-word-request.json',
  'classify-argument-boolean-observations.family-e-slippery-slope-multi-scheme-request.json',
  'classify-argument-boolean-observations.family-e-causal-reasoning-request.json',
  'classify-argument-boolean-observations.family-e-analogy-reasoning-request.json',
  'classify-argument-boolean-observations.family-e-precedent-reasoning-request.json',
  'classify-argument-boolean-observations.family-e-no-scheme-adversarial-request.json',
];

Deno.test('fixture: family-e-canonical-response passes validator + ban-list', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-e-canonical-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) {
    throw new Error(`canonical fixture failed validator: ${valid.path} — ${valid.detail}`);
  }
  const scan = scanFamilyEBooleanResponseForBanList(valid.value);
  if (!scan.ok) {
    throw new Error(`canonical fixture failed ban-list scan at: ${scan.path}`);
  }
});

Deno.test('fixture: family-e-canonical-response uses only rawKeys in FAMILY_E_RAW_KEYS', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-e-canonical-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) throw new Error('canonical fixture failed validator');
  for (const rawKey of valid.value.checkedRawKeys) {
    if (!FAMILY_E_RAW_KEYS.includes(rawKey)) {
      throw new Error(
        `canonical fixture uses unknown rawKey "${rawKey}" — must be in FAMILY_E_RAW_KEYS`,
      );
    }
  }
});

Deno.test('fixture: family-e-canonical-response classifierSetVersion is family-e-v1', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-e-canonical-response.json',
  )) as Record<string, unknown>;
  const modelInfo = fixture.modelInfo as Record<string, unknown>;
  assertEquals(modelInfo.classifierSetVersion, 'family-e-v1');
});

Deno.test('fixture: family-e-canonical-response has all 16 rawKeys', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-e-canonical-response.json',
  )) as Record<string, unknown>;
  const checkedRawKeys = fixture.checkedRawKeys as string[];
  assertEquals(checkedRawKeys.length, 16);
});

Deno.test('fixture: family-e-canonical-response has the canonical positives (causal + example)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-e-canonical-response.json',
  )) as Record<string, unknown>;
  const observations = fixture.observations as Record<string, boolean>;
  assertEquals(observations.causal_reasoning_present, true);
  assertEquals(observations.example_reasoning_present, true);
  // slippery_slope should be false in the canonical (no chain in the text).
  assertEquals(observations.slippery_slope_reasoning_present, false);
});

Deno.test('fixture: family-e-canonical-response evidenceSpan strings are all ≤ MAX_EVIDENCE_SPAN_CHARS', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-e-canonical-response.json',
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

Deno.test('fixture: family-e-malformed-response FAILS validator (negative test)', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-e-malformed-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  assertEquals(valid.ok, false);
});

Deno.test('fixture: family-e-ban-list-response FAILS ban-list scan (negative test; "fallacy" smuggled)', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-e-ban-list-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) {
    throw new Error('ban-list fixture should pass schema (only ban-list scan should reject)');
  }
  const scan = scanFamilyEBooleanResponseForBanList(valid.value);
  assertEquals(scan.ok, false);
  if (!scan.ok) {
    assertEquals(scan.path, 'evidenceSpan.slippery_slope_reasoning_present');
  }
});

Deno.test('fixture: all 8 Family E per-scenario request fixtures pass request validator', async () => {
  for (const name of REQUEST_FIXTURE_NAMES) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const result = validateFamilyBooleanRequest(wrapper.input);
    if (!result.ok) {
      throw new Error(`${name} failed request validator: kind=${result.kind}`);
    }
  }
});

Deno.test('fixture: all 8 Family E per-scenario request fixtures target requestedFamilies=argument_scheme', async () => {
  for (const name of REQUEST_FIXTURE_NAMES) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const families = wrapper.input.requestedFamilies as string[];
    if (!families.includes('argument_scheme')) {
      throw new Error(`${name} should target 'argument_scheme' but got: ${JSON.stringify(families)}`);
    }
  }
});

Deno.test('fixture: all 8 Family E per-scenario request fixtures use only rawKeys in FAMILY_E_RAW_KEYS', async () => {
  for (const name of REQUEST_FIXTURE_NAMES) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const rawKeys = wrapper.input.requestedRawKeys as string[];
    for (const rawKey of rawKeys) {
      if (!FAMILY_E_RAW_KEYS.includes(rawKey)) {
        throw new Error(`${name} requests rawKey '${rawKey}' which is not in FAMILY_E_RAW_KEYS`);
      }
    }
  }
});

Deno.test('fixture: family-e-canonical-request requests all 16 rawKeys', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-e-canonical-request.json',
  )) as { input: Record<string, unknown> };
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  assertEquals(rawKeys.length, 16);
});

// ─────────────────────────────────────────────────────────────────────────
// Adversarial slippery_slope fixtures (amendment §2 BINDING)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('fixture: exactly 3 Family E request fixtures target slippery_slope (amendment §2 BINDING)', async () => {
  // Per amendment §2: ≥3 adversarial fixtures targeting slippery_slope.
  // The 3 binding fixtures are: clear, adversarial-fallacy-word, multi-scheme.
  let slipperySlopeCount = 0;
  const slipperySlopeFixtures: string[] = [];
  for (const name of REQUEST_FIXTURE_NAMES) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const rawKeys = wrapper.input.requestedRawKeys as string[];
    if (rawKeys.includes('slippery_slope_reasoning_present')) {
      slipperySlopeCount++;
      slipperySlopeFixtures.push(name);
    }
  }
  if (slipperySlopeCount < 3) {
    throw new Error(
      `Expected ≥3 Family E fixtures targeting slippery_slope_reasoning_present; got ${slipperySlopeCount}: ${slipperySlopeFixtures.join(', ')}`,
    );
  }
});

Deno.test('fixture: family-e-slippery-slope-clear-request frames an unambiguous chain (no fallacy word in input)', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-e-slippery-slope-clear-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = wrapper.input.currentText as string;
  // Clear chain pattern.
  if (!/expand to a second category, then a third, then a fourth/i.test(moveText)) {
    throw new Error(`slippery-slope-clear fixture should contain explicit chain pattern; got: ${moveText}`);
  }
  // No fallacy framing in input.
  if (/\bfallacy\b/i.test(moveText)) {
    throw new Error(`slippery-slope-clear fixture should NOT contain "fallacy" in input; got: ${moveText}`);
  }
});

Deno.test('fixture: family-e-slippery-slope-adversarial-fallacy-word-request DOES contain "fallacy" in input (amendment §2.2)', async () => {
  // The amendment §2.2 binding: this fixture deliberately contains the
  // word "fallacy" in the INPUT to test that the classifier does NOT echo
  // the framing in its OUTPUT.
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-e-slippery-slope-adversarial-fallacy-word-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = wrapper.input.currentText as string;
  if (!/\bfallacy\b/i.test(moveText)) {
    throw new Error(
      `slippery-slope-adversarial-fallacy-word fixture MUST contain "fallacy" in input per amendment §2.2; got: ${moveText}`,
    );
  }
  // And still frame a chain pattern.
  if (!/once a single category gets restricted, the next category follows/i.test(moveText)) {
    throw new Error(`adversarial fixture should still contain chain pattern; got: ${moveText}`);
  }
});

Deno.test('fixture: family-e-slippery-slope-multi-scheme-request requests slippery_slope + at least one other scheme (amendment §2.3)', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-e-slippery-slope-multi-scheme-request.json',
  )) as { input: Record<string, unknown> };
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  if (!rawKeys.includes('slippery_slope_reasoning_present')) {
    throw new Error('multi-scheme fixture should request slippery_slope_reasoning_present');
  }
  // At least one other scheme in the request.
  const otherSchemes = rawKeys.filter((k) => k !== 'slippery_slope_reasoning_present');
  if (otherSchemes.length === 0) {
    throw new Error('multi-scheme fixture should request at least one OTHER scheme beyond slippery_slope');
  }
});

Deno.test('fixture: family-e-no-scheme-adversarial-request requests all 16 keys (adversarial discriminator)', async () => {
  // The no-scheme adversarial fixture pure description; all 16 schemes
  // should return false on this content. The fixture requests all 16 keys.
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-e-no-scheme-adversarial-request.json',
  )) as { input: Record<string, unknown> };
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  assertEquals(rawKeys.length, 16);
});
