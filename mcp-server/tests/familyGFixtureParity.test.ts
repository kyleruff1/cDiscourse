/**
 * MCP-SERVER-008-FAMILY-G + MCP-BUILD2g — Family G fixture parser parity test.
 *
 * MCP-BUILD2g takes the Family G Subset 18 → 21 (> the 20-key per-response
 * cap), so the full family is served in 2 BATCHES (16 + 5). The fixtures
 * reflect this (mirror Family D's MCP-BUILD2d batching shape):
 *   - family-g-batch0-response (16 keys) + family-g-batch1-response (5 keys)
 *     are the actual WIRE responses; each MUST pass
 *     validateMcpBooleanObservationResponse (each ≤ 20).
 *   - family-g-canonical-response is now the MERGED 21-key reference (the
 *     Edge-side merge target). It exceeds the 20-key cap by design, so it is
 *     NOT a single wire response and is NOT passed through the cap validator;
 *     instead it is asserted to equal the disjoint UNION of the two batches.
 *
 * Both per-batch responses + the merged canonical MUST:
 *   - Use only rawKeys in FAMILY_G_RAW_KEYS (no other-family keys, no
 *     excluded deterministic keys)
 *   - Have evidenceSpan strings ≤ MAX_EVIDENCE_SPAN_CHARS (240)
 *   - Pass scanFamilyGBooleanResponseForBanList (no verdict tokens)
 *
 * The per-batch request fixtures MUST pass validateFamilyBooleanRequest. This
 * proves G's 21-key Subset triggers batching end-to-end (21 → 2 batches → one
 * merged 21-key reference) with NO batching-infra change.
 *
 * This test file is robust to import order: it defensively registers Family G
 * into the singleton registry if (and only if) Family G has not yet been
 * registered.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
  MAX_EVIDENCE_SPAN_CHARS,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { scanFamilyGBooleanResponseForBanList } from '../lib/familyGBanListScan.ts';
import {
  FAMILY_G_RAW_KEYS,
  FAMILY_G_CLASSIFIER_SET_VERSION,
  FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS,
} from '../lib/familyGKeys.ts';
import '../lib/familyRegistryInit.ts'; // side-effect: register Family A..G
import { isFamilySupported, register } from '../lib/familyRegistry.ts';
import { validateFamilyBooleanRequest } from '../lib/familyBooleanRequestSchema.ts';

// Defensive: ensure Family G is registered (familyRegistryInit.ts has it; the
// guard makes this test self-sufficient).
if (!isFamilySupported('resolution_progress')) {
  register('resolution_progress', {
    rawKeys: new Set(FAMILY_G_RAW_KEYS),
    classifierSetVersion: FAMILY_G_CLASSIFIER_SET_VERSION,
  });
}

const FIXTURE_DIR = new URL('../fixtures/', import.meta.url);

async function loadFixture(name: string): Promise<unknown> {
  const url = new URL(name, FIXTURE_DIR);
  const text = await Deno.readTextFile(url);
  return JSON.parse(text);
}

// ── MCP-BUILD2g batching: per-batch wire responses (each ≤ 20) ──
const BATCH_RESPONSE_FIXTURES = [
  { name: 'classify-argument-boolean-observations.family-g-batch0-response.json', count: 16 },
  { name: 'classify-argument-boolean-observations.family-g-batch1-response.json', count: 5 },
];

for (const { name, count } of BATCH_RESPONSE_FIXTURES) {
  Deno.test(`fixture: ${name} passes validator + ban-list (valid ≤20-key wire batch)`, async () => {
    const fixture = await loadFixture(name);
    const valid = validateMcpBooleanObservationResponse(fixture);
    if (!valid.ok) {
      throw new Error(`${name} failed validator: ${valid.path} — ${valid.detail}`);
    }
    const scan = scanFamilyGBooleanResponseForBanList(valid.value);
    if (!scan.ok) {
      throw new Error(`${name} failed ban-list scan at: ${scan.path}`);
    }
    assertEquals(valid.value.checkedRawKeys.length, count);
  });

  Deno.test(`fixture: ${name} uses only rawKeys in FAMILY_G_RAW_KEYS (no excluded / cross-family)`, async () => {
    const fixture = await loadFixture(name);
    const valid = validateMcpBooleanObservationResponse(fixture);
    if (!valid.ok) throw new Error(`${name} failed validator`);
    for (const rawKey of valid.value.checkedRawKeys) {
      if (!FAMILY_G_RAW_KEYS.includes(rawKey)) {
        throw new Error(`${name} uses unknown rawKey "${rawKey}" — must be in FAMILY_G_RAW_KEYS`);
      }
      if (FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS.includes(rawKey)) {
        throw new Error(`${name} uses EXCLUDED deterministic rawKey "${rawKey}" — Subset boundary violated`);
      }
    }
  });

  Deno.test(`fixture: ${name} classifierSetVersion is family-g-v1`, async () => {
    const fixture = (await loadFixture(name)) as Record<string, unknown>;
    const modelInfo = fixture.modelInfo as Record<string, unknown>;
    assertEquals(modelInfo.classifierSetVersion, 'family-g-v1');
  });
}

Deno.test('fixture: batch0 + batch1 are disjoint and their union is the full 21-key Subset (batching proof)', async () => {
  const b0 = (await loadFixture(
    'classify-argument-boolean-observations.family-g-batch0-response.json',
  )) as Record<string, unknown>;
  const b1 = (await loadFixture(
    'classify-argument-boolean-observations.family-g-batch1-response.json',
  )) as Record<string, unknown>;
  const k0 = b0.checkedRawKeys as string[];
  const k1 = b1.checkedRawKeys as string[];
  // disjoint
  for (const k of k0) {
    if (k1.includes(k)) throw new Error(`batch overlap on rawKey "${k}" — chunks must be disjoint`);
  }
  // union == 21 == full Subset
  const union = new Set([...k0, ...k1]);
  assertEquals(union.size, 21);
  assertEquals(new Set(FAMILY_G_RAW_KEYS), union);
  // sizes 16 + 5
  assertEquals(k0.length, 16);
  assertEquals(k1.length, 5);
});

Deno.test('fixture: family-g-canonical-response is the MERGED 21-key reference (= disjoint union of the 2 batches)', async () => {
  // The canonical response now represents the Edge-side MERGE TARGET. It
  // exceeds the 20-key cap by design (21 keys), so it is NOT passed through
  // validateMcpBooleanObservationResponse (which would reject it as
  // flag_count_too_high — the very reason batching exists). It is asserted to
  // be the union of the two valid per-batch wire responses + ban-list clean.
  const merged = (await loadFixture(
    'classify-argument-boolean-observations.family-g-canonical-response.json',
  )) as Record<string, unknown>;
  const b0 = (await loadFixture(
    'classify-argument-boolean-observations.family-g-batch0-response.json',
  )) as Record<string, unknown>;
  const b1 = (await loadFixture(
    'classify-argument-boolean-observations.family-g-batch1-response.json',
  )) as Record<string, unknown>;
  const mergedKeys = merged.checkedRawKeys as string[];
  assertEquals(mergedKeys.length, 21);
  assertEquals(new Set(mergedKeys), new Set(FAMILY_G_RAW_KEYS));
  // every merged observation matches whichever batch carried that key
  const mergedObs = merged.observations as Record<string, boolean>;
  for (const src of [b0, b1]) {
    const obs = src.observations as Record<string, boolean>;
    for (const [k, v] of Object.entries(obs)) {
      assertEquals(mergedObs[k], v, `merged observation for ${k} must match its batch`);
    }
  }
  // classifierSetVersion preserved + no excluded / cross-family key
  const modelInfo = merged.modelInfo as Record<string, unknown>;
  assertEquals(modelInfo.classifierSetVersion, 'family-g-v1');
  for (const rawKey of mergedKeys) {
    if (!FAMILY_G_RAW_KEYS.includes(rawKey)) {
      throw new Error(`merged reference uses unknown rawKey "${rawKey}"`);
    }
    if (FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS.includes(rawKey)) {
      throw new Error(`merged reference uses EXCLUDED deterministic rawKey "${rawKey}"`);
    }
  }
});

Deno.test('fixture: family-g-canonical-response carries the 3 MCP-BUILD2g positives (records_remaining_disagreement + defines_next_evidence_needed + separates_normative_from_empirical)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-g-canonical-response.json',
  )) as Record<string, unknown>;
  const observations = fixture.observations as Record<string, boolean>;
  assertEquals(observations.records_remaining_disagreement, true);
  assertEquals(observations.defines_next_evidence_needed, true);
  assertEquals(observations.separates_normative_from_empirical, true);
});

Deno.test('fixture: merged canonical + both batch responses have evidenceSpan strings ≤ MAX_EVIDENCE_SPAN_CHARS', async () => {
  const names = [
    'classify-argument-boolean-observations.family-g-canonical-response.json',
    'classify-argument-boolean-observations.family-g-batch0-response.json',
    'classify-argument-boolean-observations.family-g-batch1-response.json',
  ];
  for (const name of names) {
    const fixture = (await loadFixture(name)) as Record<string, unknown>;
    const evidenceSpan = fixture.evidenceSpan as Record<string, unknown>;
    for (const [rawKey, span] of Object.entries(evidenceSpan)) {
      if (typeof span === 'string' && span.length > MAX_EVIDENCE_SPAN_CHARS) {
        throw new Error(
          `${name} evidenceSpan.${rawKey} length ${span.length} > MAX_EVIDENCE_SPAN_CHARS ${MAX_EVIDENCE_SPAN_CHARS}`,
        );
      }
    }
  }
});

Deno.test('fixture: merged canonical response passes the Family G ban-list scan (no verdict tokens)', async () => {
  const merged = (await loadFixture(
    'classify-argument-boolean-observations.family-g-canonical-response.json',
  )) as Parameters<typeof scanFamilyGBooleanResponseForBanList>[0];
  const scan = scanFamilyGBooleanResponseForBanList(merged);
  if (!scan.ok) {
    throw new Error(`merged canonical failed ban-list scan at: ${scan.path}`);
  }
});

// ── per-batch request fixtures pass the request validator ──
const BATCH_REQUEST_FIXTURES = [
  'classify-argument-boolean-observations.family-g-canonical-request.json',
  'classify-argument-boolean-observations.family-g-batch0-request.json',
  'classify-argument-boolean-observations.family-g-batch1-request.json',
];

Deno.test('fixture: all Family G batch + canonical request fixtures pass request validator', async () => {
  for (const name of BATCH_REQUEST_FIXTURES) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const result = validateFamilyBooleanRequest(wrapper.input);
    if (!result.ok) {
      throw new Error(`${name} failed request validator: kind=${result.kind}`);
    }
  }
});

Deno.test('fixture: all Family G request fixtures use only rawKeys in FAMILY_G_RAW_KEYS (no excluded deterministic, no cross-family)', async () => {
  for (const name of BATCH_REQUEST_FIXTURES) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const rawKeys = wrapper.input.requestedRawKeys as string[];
    for (const rawKey of rawKeys) {
      if (!FAMILY_G_RAW_KEYS.includes(rawKey)) {
        throw new Error(`${name} requests rawKey '${rawKey}' which is not in FAMILY_G_RAW_KEYS`);
      }
      if (FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS.includes(rawKey)) {
        throw new Error(`${name} requests EXCLUDED deterministic rawKey '${rawKey}'`);
      }
    }
  }
});

Deno.test('fixture: family-g-canonical-request requests all 21 rawKeys (full pre-chunk family request)', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-g-canonical-request.json',
  )) as { input: Record<string, unknown> };
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  assertEquals(rawKeys.length, 21);
});

Deno.test('fixture: per-batch requests are sized 16 + 5 (the chunk split)', async () => {
  const b0 = (await loadFixture(
    'classify-argument-boolean-observations.family-g-batch0-request.json',
  )) as { input: Record<string, unknown> };
  const b1 = (await loadFixture(
    'classify-argument-boolean-observations.family-g-batch1-request.json',
  )) as { input: Record<string, unknown> };
  assertEquals((b0.input.requestedRawKeys as string[]).length, 16);
  assertEquals((b1.input.requestedRawKeys as string[]).length, 5);
});
