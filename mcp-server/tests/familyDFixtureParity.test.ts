/**
 * MCP-SERVER-005-FAMILY-D + MCP-BUILD2d — Family D fixture parser parity test.
 *
 * MCP-BUILD2d takes the Family D Subset 19 → 22 (> the 20-key per-response
 * cap), so the full family is served in 2 BATCHES (16 + 6). The fixtures
 * reflect this:
 *   - family-d-batch0-response (16 keys) + family-d-batch1-response (6 keys)
 *     are the actual WIRE responses; each MUST pass
 *     validateMcpBooleanObservationResponse (each ≤ 20).
 *   - family-d-canonical-response is now the MERGED 22-key reference (the
 *     Edge-side merge target). It exceeds the 20-key cap by design, so it is
 *     NOT a single wire response and is NOT passed through the cap validator;
 *     instead it is asserted to equal the disjoint UNION of the two batches.
 *
 * Both per-batch responses + the merged canonical MUST:
 *   - Use only rawKeys in FAMILY_D_RAW_KEYS (no Family A/B/C keys, no
 *     excluded deterministic keys)
 *   - Have evidenceSpan strings ≤ MAX_EVIDENCE_SPAN_CHARS (240)
 *   - Pass scanFamilyDBooleanResponseForBanList (no verdict tokens)
 *
 * The per-scenario + per-batch request fixtures MUST pass
 * validateFamilyBooleanRequest. The known-malformed and known-ban-list
 * fixtures MUST fail the corresponding validators (negative tests).
 *
 * This test file is robust to import order: it defensively registers
 * Family D into the singleton registry if (and only if) Family D has
 * not yet been registered. After Commit 4, familyRegistryInit.ts
 * already registers Family D, so the guard is a no-op.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
  MAX_EVIDENCE_SPAN_CHARS,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { scanFamilyDBooleanResponseForBanList } from '../lib/familyDBanListScan.ts';
import {
  FAMILY_D_RAW_KEYS,
  FAMILY_D_CLASSIFIER_SET_VERSION,
  FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS,
} from '../lib/familyDKeys.ts';
import '../lib/familyRegistryInit.ts'; // side-effect: register Family A + B + C + D
import { isFamilySupported, register } from '../lib/familyRegistry.ts';
import { validateFamilyBooleanRequest } from '../lib/familyBooleanRequestSchema.ts';

// Defensive: ensure Family D is registered (familyRegistryInit.ts has it
// after Commit 4; the guard makes this test self-sufficient).
if (!isFamilySupported('evidence_source_chain')) {
  register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });
}

const FIXTURE_DIR = new URL('../fixtures/', import.meta.url);

async function loadFixture(name: string): Promise<unknown> {
  const url = new URL(name, FIXTURE_DIR);
  const text = await Deno.readTextFile(url);
  return JSON.parse(text);
}

// ── MCP-BUILD2d batching: per-batch wire responses (each ≤ 20) ──
const BATCH_RESPONSE_FIXTURES = [
  { name: 'classify-argument-boolean-observations.family-d-batch0-response.json', count: 16 },
  { name: 'classify-argument-boolean-observations.family-d-batch1-response.json', count: 6 },
];

for (const { name, count } of BATCH_RESPONSE_FIXTURES) {
  Deno.test(`fixture: ${name} passes validator + ban-list (valid ≤20-key wire batch)`, async () => {
    const fixture = await loadFixture(name);
    const valid = validateMcpBooleanObservationResponse(fixture);
    if (!valid.ok) {
      throw new Error(`${name} failed validator: ${valid.path} — ${valid.detail}`);
    }
    const scan = scanFamilyDBooleanResponseForBanList(valid.value);
    if (!scan.ok) {
      throw new Error(`${name} failed ban-list scan at: ${scan.path}`);
    }
    assertEquals(valid.value.checkedRawKeys.length, count);
  });

  Deno.test(`fixture: ${name} uses only rawKeys in FAMILY_D_RAW_KEYS (no excluded / cross-family)`, async () => {
    const fixture = await loadFixture(name);
    const valid = validateMcpBooleanObservationResponse(fixture);
    if (!valid.ok) throw new Error(`${name} failed validator`);
    for (const rawKey of valid.value.checkedRawKeys) {
      if (!FAMILY_D_RAW_KEYS.includes(rawKey)) {
        throw new Error(`${name} uses unknown rawKey "${rawKey}" — must be in FAMILY_D_RAW_KEYS`);
      }
      if (FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS.includes(rawKey)) {
        throw new Error(`${name} uses EXCLUDED deterministic rawKey "${rawKey}" — Subset boundary violated`);
      }
    }
  });

  Deno.test(`fixture: ${name} classifierSetVersion is family-d-v1`, async () => {
    const fixture = (await loadFixture(name)) as Record<string, unknown>;
    const modelInfo = fixture.modelInfo as Record<string, unknown>;
    assertEquals(modelInfo.classifierSetVersion, 'family-d-v1');
  });
}

Deno.test('fixture: batch0 + batch1 are disjoint and their union is the full 22-key Subset (batching proof)', async () => {
  const b0 = (await loadFixture(
    'classify-argument-boolean-observations.family-d-batch0-response.json',
  )) as Record<string, unknown>;
  const b1 = (await loadFixture(
    'classify-argument-boolean-observations.family-d-batch1-response.json',
  )) as Record<string, unknown>;
  const k0 = b0.checkedRawKeys as string[];
  const k1 = b1.checkedRawKeys as string[];
  // disjoint
  for (const k of k0) {
    if (k1.includes(k)) throw new Error(`batch overlap on rawKey "${k}" — chunks must be disjoint`);
  }
  // union == 22 == full Subset
  const union = new Set([...k0, ...k1]);
  assertEquals(union.size, 22);
  assertEquals(new Set(FAMILY_D_RAW_KEYS), union);
  // sizes 16 + 6
  assertEquals(k0.length, 16);
  assertEquals(k1.length, 6);
});

Deno.test('fixture: family-d-canonical-response is the MERGED 22-key reference (= disjoint union of the 2 batches)', async () => {
  // The canonical response now represents the Edge-side MERGE TARGET. It
  // exceeds the 20-key cap by design (22 keys), so it is NOT passed through
  // validateMcpBooleanObservationResponse (which would reject it as
  // flag_count_too_high — the very reason batching exists). It is asserted to
  // be the union of the two valid per-batch wire responses + ban-list clean.
  const merged = (await loadFixture(
    'classify-argument-boolean-observations.family-d-canonical-response.json',
  )) as Record<string, unknown>;
  const b0 = (await loadFixture(
    'classify-argument-boolean-observations.family-d-batch0-response.json',
  )) as Record<string, unknown>;
  const b1 = (await loadFixture(
    'classify-argument-boolean-observations.family-d-batch1-response.json',
  )) as Record<string, unknown>;
  const mergedKeys = merged.checkedRawKeys as string[];
  assertEquals(mergedKeys.length, 22);
  assertEquals(new Set(mergedKeys), new Set(FAMILY_D_RAW_KEYS));
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
  assertEquals(modelInfo.classifierSetVersion, 'family-d-v1');
  for (const rawKey of mergedKeys) {
    if (!FAMILY_D_RAW_KEYS.includes(rawKey)) {
      throw new Error(`merged reference uses unknown rawKey "${rawKey}"`);
    }
    if (FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS.includes(rawKey)) {
      throw new Error(`merged reference uses EXCLUDED deterministic rawKey "${rawKey}"`);
    }
  }
});

Deno.test('fixture: family-d-canonical-response has the canonical positives (source_provided + provides_evidence + statistic_used)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-d-canonical-response.json',
  )) as Record<string, unknown>;
  const observations = fixture.observations as Record<string, boolean>;
  assertEquals(observations.source_provided, true);
  assertEquals(observations.provides_evidence, true);
  assertEquals(observations.statistic_used, true);
});

Deno.test('fixture: merged canonical + both batch responses have evidenceSpan strings ≤ MAX_EVIDENCE_SPAN_CHARS', async () => {
  // The merged canonical (22 keys) is read directly (it exceeds the 20-key
  // cap by design); the two batch responses are read directly too. All
  // evidenceSpan strings must be within the 240-char bound.
  const names = [
    'classify-argument-boolean-observations.family-d-canonical-response.json',
    'classify-argument-boolean-observations.family-d-batch0-response.json',
    'classify-argument-boolean-observations.family-d-batch1-response.json',
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

Deno.test('fixture: merged canonical response passes the Family D ban-list scan (no verdict tokens)', async () => {
  // Read directly (22 keys > cap); the ban-list scan operates per-string and
  // does not require a ≤20 wire shape.
  const merged = (await loadFixture(
    'classify-argument-boolean-observations.family-d-canonical-response.json',
  )) as Parameters<typeof scanFamilyDBooleanResponseForBanList>[0];
  const scan = scanFamilyDBooleanResponseForBanList(merged);
  if (!scan.ok) {
    throw new Error(`merged canonical failed ban-list scan at: ${scan.path}`);
  }
});

Deno.test('fixture: family-d-malformed-response FAILS validator (negative test)', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-d-malformed-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  assertEquals(valid.ok, false);
});

Deno.test('fixture: family-d-ban-list-response FAILS ban-list scan (negative test)', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-d-ban-list-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) {
    throw new Error('ban-list fixture should pass schema (only ban-list scan should reject)');
  }
  const scan = scanFamilyDBooleanResponseForBanList(valid.value);
  assertEquals(scan.ok, false);
  if (!scan.ok) {
    assertEquals(scan.path, 'evidenceSpan.evidence_gap_present');
  }
});

// The per-scenario request fixtures + the 2 per-batch request fixtures.
const REQUEST_FIXTURE_NAMES = [
  'classify-argument-boolean-observations.family-d-canonical-request.json',
  'classify-argument-boolean-observations.family-d-source-provided-request.json',
  'classify-argument-boolean-observations.family-d-evidence-gap-request.json',
  'classify-argument-boolean-observations.family-d-anecdote-used-request.json',
  'classify-argument-boolean-observations.family-d-no-evidence-request.json',
  'classify-argument-boolean-observations.family-d-batch0-request.json',
  'classify-argument-boolean-observations.family-d-batch1-request.json',
];

Deno.test('fixture: all Family D request fixtures (scenario + per-batch) pass request validator', async () => {
  for (const name of REQUEST_FIXTURE_NAMES) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const result = validateFamilyBooleanRequest(wrapper.input);
    if (!result.ok) {
      throw new Error(`${name} failed request validator: kind=${result.kind}`);
    }
  }
});

Deno.test('fixture: all Family D request fixtures target requestedFamilies=evidence_source_chain', async () => {
  for (const name of REQUEST_FIXTURE_NAMES) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const families = wrapper.input.requestedFamilies as string[];
    if (!families.includes('evidence_source_chain')) {
      throw new Error(`${name} should target 'evidence_source_chain' but got: ${JSON.stringify(families)}`);
    }
  }
});

Deno.test('fixture: all Family D request fixtures use only rawKeys in FAMILY_D_RAW_KEYS (no excluded deterministic, no cross-family)', async () => {
  for (const name of REQUEST_FIXTURE_NAMES) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const rawKeys = wrapper.input.requestedRawKeys as string[];
    for (const rawKey of rawKeys) {
      if (!FAMILY_D_RAW_KEYS.includes(rawKey)) {
        throw new Error(`${name} requests rawKey '${rawKey}' which is not in FAMILY_D_RAW_KEYS`);
      }
      if (FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS.includes(rawKey)) {
        throw new Error(`${name} requests EXCLUDED deterministic rawKey '${rawKey}'`);
      }
    }
  }
});

Deno.test('fixture: family-d-canonical-request requests all 22 rawKeys (full pre-chunk family request)', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-d-canonical-request.json',
  )) as { input: Record<string, unknown> };
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  assertEquals(rawKeys.length, 22);
});

Deno.test('fixture: per-batch requests are sized 16 + 6 (the chunk split)', async () => {
  const b0 = (await loadFixture(
    'classify-argument-boolean-observations.family-d-batch0-request.json',
  )) as { input: Record<string, unknown> };
  const b1 = (await loadFixture(
    'classify-argument-boolean-observations.family-d-batch1-request.json',
  )) as { input: Record<string, unknown> };
  assertEquals((b0.input.requestedRawKeys as string[]).length, 16);
  assertEquals((b1.input.requestedRawKeys as string[]).length, 6);
});

Deno.test('fixture: family-d-source-provided-request frames source citation (operator-visible signal)', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-d-source-provided-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = wrapper.input.currentText as string;
  if (!/EPA 2024/.test(moveText)) {
    throw new Error(`source-provided fixture should contain "EPA 2024" citation marker; got: ${moveText}`);
  }
  // source_provided + provides_evidence are the binding positives.
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  if (!rawKeys.includes('source_provided')) {
    throw new Error('source-provided fixture should request source_provided');
  }
  if (!rawKeys.includes('provides_evidence')) {
    throw new Error('source-provided fixture should request provides_evidence');
  }
});

Deno.test('fixture: family-d-evidence-gap-request frames a no-source statistical claim (anti-amplification signal)', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-d-evidence-gap-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = wrapper.input.currentText as string;
  // Statistical claim with no source.
  if (!/30%/.test(moveText) && !/dropped/.test(moveText)) {
    throw new Error(`evidence-gap fixture should contain statistical-claim marker; got: ${moveText}`);
  }
  // Anti-amplification anchor signal: "everyone knows" (popularity-as-evidence trap).
  if (!/everyone knows/i.test(moveText)) {
    throw new Error(
      `evidence-gap fixture should contain "everyone knows" popularity-trap marker; got: ${moveText}`,
    );
  }
});

Deno.test('fixture: family-d-anecdote-used-request frames a lived-experience single-case story (doctrine-risk signal)', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-d-anecdote-used-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = wrapper.input.currentText as string;
  if (!/When I worked/i.test(moveText)) {
    throw new Error(`anecdote-used fixture should contain lived-experience marker; got: ${moveText}`);
  }
  // The doctrine-risk: anecdote must NOT be framed as weakness in the
  // fixture text either. Anecdote is legitimate evidence in some contexts.
  if (/\bweak\b|\binferior\b|\bunreliable\b/i.test(moveText)) {
    throw new Error(`anecdote-used fixture should NOT frame anecdote as weakness; got: ${moveText}`);
  }
});

Deno.test('fixture: family-d-no-evidence-request frames Family C (offers_candidate_understanding) content (adversarial discriminator)', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-d-no-evidence-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = wrapper.input.currentText as string;
  // Per design §3 + decision provenance #6: the adversarial fixture is
  // Family C content. The Family D classifier MUST return all 19 keys
  // false on this content (verified at runtime in the Edge admin_validation
  // smoke). Operator-visible signal that the fixture encodes the intent.
  if (!/Are you saying/i.test(moveText)) {
    throw new Error(
      `no-evidence fixture should contain Family C "Are you saying" paraphrase marker; got: ${moveText}`,
    );
  }
  if (!/let me make sure/i.test(moveText)) {
    throw new Error(
      `no-evidence fixture should contain "let me make sure" Family C invitation marker; got: ${moveText}`,
    );
  }
});
