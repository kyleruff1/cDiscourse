/**
 * MCP-SERVER-005-FAMILY-D — Family D fixture parser parity test.
 *
 * The canonical Family D response fixture + 5 per-scenario request
 * fixtures MUST:
 *   - Pass validateMcpBooleanObservationResponse (schema-valid) for the
 *     canonical response
 *   - Use only rawKeys in FAMILY_D_RAW_KEYS (no Family A/B/C keys, no
 *     excluded deterministic keys)
 *   - Have evidenceSpan strings ≤ MAX_EVIDENCE_SPAN_CHARS (240) for
 *     responses
 *   - Pass scanFamilyDBooleanResponseForBanList (no verdict tokens) for
 *     the canonical
 *   - Pass validateFamilyBooleanRequest for the 5 per-scenario request
 *     fixtures
 *
 * The known-malformed and known-ban-list fixtures MUST fail the
 * corresponding validators (negative tests).
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

Deno.test('fixture: family-d-canonical-response passes validator + ban-list', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-d-canonical-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) {
    throw new Error(`canonical fixture failed validator: ${valid.path} — ${valid.detail}`);
  }
  const scan = scanFamilyDBooleanResponseForBanList(valid.value);
  if (!scan.ok) {
    throw new Error(`canonical fixture failed ban-list scan at: ${scan.path}`);
  }
});

Deno.test('fixture: family-d-canonical-response uses only rawKeys in FAMILY_D_RAW_KEYS', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-d-canonical-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) throw new Error('canonical fixture failed validator');
  for (const rawKey of valid.value.checkedRawKeys) {
    if (!FAMILY_D_RAW_KEYS.includes(rawKey)) {
      throw new Error(
        `canonical fixture uses unknown rawKey "${rawKey}" — must be in FAMILY_D_RAW_KEYS`,
      );
    }
    if (FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS.includes(rawKey)) {
      throw new Error(
        `canonical fixture uses EXCLUDED deterministic rawKey "${rawKey}" — Subset boundary violated`,
      );
    }
  }
});

Deno.test('fixture: family-d-canonical-response classifierSetVersion is family-d-v1', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-d-canonical-response.json',
  )) as Record<string, unknown>;
  const modelInfo = fixture.modelInfo as Record<string, unknown>;
  assertEquals(modelInfo.classifierSetVersion, 'family-d-v1');
});

Deno.test('fixture: family-d-canonical-response has all 19 rawKeys', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-d-canonical-response.json',
  )) as Record<string, unknown>;
  const checkedRawKeys = fixture.checkedRawKeys as string[];
  assertEquals(checkedRawKeys.length, 19);
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

Deno.test('fixture: family-d-canonical-response evidenceSpan strings are all ≤ MAX_EVIDENCE_SPAN_CHARS', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-d-canonical-response.json',
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

Deno.test('fixture: 5 Family D per-scenario request fixtures all pass request validator', async () => {
  const requestNames = [
    'classify-argument-boolean-observations.family-d-canonical-request.json',
    'classify-argument-boolean-observations.family-d-source-provided-request.json',
    'classify-argument-boolean-observations.family-d-evidence-gap-request.json',
    'classify-argument-boolean-observations.family-d-anecdote-used-request.json',
    'classify-argument-boolean-observations.family-d-no-evidence-request.json',
  ];
  for (const name of requestNames) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const result = validateFamilyBooleanRequest(wrapper.input);
    if (!result.ok) {
      throw new Error(`${name} failed request validator: kind=${result.kind}`);
    }
  }
});

Deno.test('fixture: 5 Family D per-scenario request fixtures all target requestedFamilies=evidence_source_chain', async () => {
  const requestNames = [
    'classify-argument-boolean-observations.family-d-canonical-request.json',
    'classify-argument-boolean-observations.family-d-source-provided-request.json',
    'classify-argument-boolean-observations.family-d-evidence-gap-request.json',
    'classify-argument-boolean-observations.family-d-anecdote-used-request.json',
    'classify-argument-boolean-observations.family-d-no-evidence-request.json',
  ];
  for (const name of requestNames) {
    const wrapper = (await loadFixture(name)) as { input: Record<string, unknown> };
    const families = wrapper.input.requestedFamilies as string[];
    if (!families.includes('evidence_source_chain')) {
      throw new Error(`${name} should target 'evidence_source_chain' but got: ${JSON.stringify(families)}`);
    }
  }
});

Deno.test('fixture: 5 Family D per-scenario request fixtures use only rawKeys in FAMILY_D_RAW_KEYS (no excluded deterministic, no cross-family)', async () => {
  const requestNames = [
    'classify-argument-boolean-observations.family-d-canonical-request.json',
    'classify-argument-boolean-observations.family-d-source-provided-request.json',
    'classify-argument-boolean-observations.family-d-evidence-gap-request.json',
    'classify-argument-boolean-observations.family-d-anecdote-used-request.json',
    'classify-argument-boolean-observations.family-d-no-evidence-request.json',
  ];
  for (const name of requestNames) {
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

Deno.test('fixture: family-d-canonical-request requests all 19 rawKeys', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-d-canonical-request.json',
  )) as { input: Record<string, unknown> };
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  assertEquals(rawKeys.length, 19);
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
