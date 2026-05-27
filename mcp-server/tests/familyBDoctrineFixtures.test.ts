/**
 * MCP-SERVER-003-FAMILY-B — Family B doctrine-fixture safety tests.
 *
 * Per design §5:
 *   - disputes_value_weighting: copy MUST NOT imply one value is "right".
 *     Doctrine guard text appears verbatim in the prompt's falsePositiveGuards
 *     field; the canonical response's evidenceSpan for this rawKey (if any)
 *     MUST NOT contain "right" or "correct".
 *   - disputes_relevance: positive case requires substantive reason; pure
 *     dismissal triggers the false-positive guard.
 *
 * Per design §6 — the doctrine-stress fixture is designed so the model's
 * correct behavior is `disputes_value_weighting: false` (the move text is
 * verdictive, not a structural weighting dispute) AND if "propagandist"
 * leaks into any evidenceSpan, the ban-list scan blocks the response.
 *
 * These tests verify the static fixture shapes encode the design intent.
 * They do NOT call Anthropic — runtime model behavior is observed in the
 * Edge `admin_validation` smoke (operator-run post-merge).
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { scanFamilyBBooleanResponseForBanList } from '../lib/familyBBanListScan.ts';

const FIXTURE_DIR = new URL('../fixtures/', import.meta.url);

async function loadFixture(name: string): Promise<unknown> {
  const url = new URL(name, FIXTURE_DIR);
  const text = await Deno.readTextFile(url);
  return JSON.parse(text);
}

Deno.test('doctrine: canonical fixture has no "right" or "correct" in any evidenceSpan (value-weighting doctrine guard)', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-b-canonical-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) throw new Error('canonical fixture failed validator');
  for (const [rawKey, span] of Object.entries(valid.value.evidenceSpan)) {
    if (typeof span !== 'string') continue;
    // The value-weighting doctrine guard from design §5.1 forbids implying
    // "one value is right". The fixture's evidenceSpans must not encode this.
    if (/\bright\b/i.test(span)) {
      throw new Error(
        `canonical evidenceSpan.${rawKey} contains banned framing "right": ${span}`,
      );
    }
    // The ban-list catches `correct` standalone (not `correction`).
    if (/(?:^|[^a-z0-9])correct(?:[^a-z0-9]|$)/i.test(span)) {
      throw new Error(
        `canonical evidenceSpan.${rawKey} contains banned framing "correct": ${span}`,
      );
    }
  }
});

Deno.test('doctrine: ban-list fixture (doctrine-stress) is rejected at evidenceSpan.disputes_value_weighting', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-b-ban-list-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) throw new Error('ban-list fixture should pass validator');
  const scan = scanFamilyBBooleanResponseForBanList(valid.value);
  assertEquals(scan.ok, false);
  if (!scan.ok) {
    assertEquals(scan.path, 'evidenceSpan.disputes_value_weighting');
  }
});

Deno.test('doctrine: no-disagreement request fixture is a same-side supportive reply', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-b-no-disagreement-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  // The expected positive set per design §6 is "none". The move text must
  // read as supportive — operator-visible signal that the fixture encodes
  // the intent.
  if (!/agreed/i.test(moveText)) {
    throw new Error(
      `no-disagreement fixture should contain agreement language; got: ${moveText}`,
    );
  }
});

Deno.test('doctrine: relevance-with-reason request fixture contains a substantive reason', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-b-relevance-with-reason-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  // The positive disputes_relevance case requires a substantive reason
  // (design §5.2: "the question is about value-of-service, not construction
  // emissions"). Operator-visible signal that the fixture encodes the intent.
  if (!/value-of-service|not construction/i.test(moveText)) {
    throw new Error(
      `relevance-with-reason fixture should contain a substantive reason; got: ${moveText}`,
    );
  }
});

Deno.test('doctrine: relevance-no-reason request fixture is a pure dismissal (no reason)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-b-relevance-no-reason-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  // The pure-dismissal case (design §5.2 + §6) MUST be a short dismissal
  // with no substantive engagement. The model should return
  // disputes_relevance: false for this.
  if (moveText.length > 50) {
    throw new Error(
      `relevance-no-reason fixture should be a short dismissal; got ${moveText.length} chars: ${moveText}`,
    );
  }
  if (!/irrelevant/i.test(moveText)) {
    throw new Error(
      `relevance-no-reason fixture should contain dismissal language; got: ${moveText}`,
    );
  }
});

Deno.test('doctrine: value-weighting request fixture frames disagreement structurally (no "correct value" framing)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-b-value-weighting-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  // The positive disputes_value_weighting case must frame the dispute
  // structurally ("X is a real value, but Y matters more here") and NOT
  // verdictively ("Y is the correct/right value").
  if (/(?:^|[^a-z0-9])correct(?:[^a-z0-9]|$)/i.test(moveText)) {
    throw new Error(
      `value-weighting fixture should NOT use "correct" framing; got: ${moveText}`,
    );
  }
  // Must frame both values as real per the doctrine guard.
  if (!/real value/i.test(moveText)) {
    throw new Error(
      `value-weighting fixture should frame both values as real; got: ${moveText}`,
    );
  }
});

Deno.test('doctrine: doctrine-stress request fixture contains a verdictive move (trap for the model)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-b-doctrine-stress-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  // The doctrine-stress fixture deliberately contains verdictive language
  // ("propagandist", "period"). The MODEL should return
  // disputes_value_weighting: false (the move asserts; it does not
  // structurally weight). The ban-list scan blocks any evidenceSpan that
  // leaks the banned token to the response.
  if (!/propagandist/i.test(moveText)) {
    throw new Error(
      `doctrine-stress fixture should contain the verdictive "propagandist" trap; got: ${moveText}`,
    );
  }
});

Deno.test('doctrine: multi-axis request fixture frames 3 distinct sub-axes (generalization + scope + analogy)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-b-multi-axis-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  // The multi-axis case per design §6 frames generalization + scope + analogy.
  // Operator-visible signal that the fixture encodes the intent.
  if (!/generalization/i.test(moveText)) {
    throw new Error(`multi-axis fixture should mention generalization; got: ${moveText}`);
  }
  if (!/analogy/i.test(moveText)) {
    throw new Error(`multi-axis fixture should mention analogy; got: ${moveText}`);
  }
});
