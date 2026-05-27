/**
 * MCP-SERVER-004-FAMILY-C — Family C doctrine-fixture safety tests.
 *
 * Per design §4 — the 4 doctrine-risk Family C keys
 * (rejects_candidate_understanding, acknowledges_misread,
 * flags_term_ambiguity, clarified) require explicit framing guards:
 *   - rejects_candidate_understanding: NOT framed as "wrong" / "incorrect"
 *     / "not right". The rejector is saying "that is not what I meant,"
 *     not "you are wrong." Symmetric to confirms_understanding.
 *   - acknowledges_misread: NOT framed as a failure of the original author.
 *     Acknowledging a misread is constructive repair work, not a verdict.
 *   - flags_term_ambiguity: NOT framed as accusing the parent author of
 *     ambiguous / lazy / imprecise writing.
 *   - clarified (lifecycle): defaults FALSE with low confidence when only
 *     move text is visible.
 *
 * Per design §3 fixture-design — the no-repair adversarial fixture
 * (Family B disputes_generalization content) MUST produce 0 Family C
 * positives across all 17 keys when classifier is run. This file asserts
 * the fixture content encodes the design intent (the runtime model
 * behavior is verified in the Edge admin_validation smoke).
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateMcpBooleanObservationResponse,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { scanFamilyCBooleanResponseForBanList } from '../lib/familyCBanListScan.ts';

const FIXTURE_DIR = new URL('../fixtures/', import.meta.url);

async function loadFixture(name: string): Promise<unknown> {
  const url = new URL(name, FIXTURE_DIR);
  const text = await Deno.readTextFile(url);
  return JSON.parse(text);
}

Deno.test('doctrine: canonical fixture has no "wrong" / "incorrect" / "not right" in any evidenceSpan (rejects-candidate-understanding doctrine guard)', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-c-canonical-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) throw new Error('canonical fixture failed validator');
  for (const [rawKey, span] of Object.entries(valid.value.evidenceSpan)) {
    if (typeof span !== 'string') continue;
    // The rejects_candidate_understanding doctrine guard from design §4.1
    // forbids "wrong" / "not right" framing. The canonical fixture must
    // not encode this.
    if (/\bwrong\b/i.test(span)) {
      throw new Error(
        `canonical evidenceSpan.${rawKey} contains banned framing "wrong": ${span}`,
      );
    }
    if (/\bnot\s+right\b/i.test(span)) {
      throw new Error(
        `canonical evidenceSpan.${rawKey} contains banned framing "not right": ${span}`,
      );
    }
    // The ban-list catches `incorrect` standalone (not `incorrection`).
    if (/(?:^|[^a-z0-9])incorrect(?:[^a-z0-9]|$)/i.test(span)) {
      throw new Error(
        `canonical evidenceSpan.${rawKey} contains banned framing "incorrect": ${span}`,
      );
    }
  }
});

Deno.test('doctrine: canonical fixture has no "your fault" / "you were unclear" / "bad writing" framing (acknowledges-misread doctrine guard)', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-c-canonical-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) throw new Error('canonical fixture failed validator');
  for (const [rawKey, span] of Object.entries(valid.value.evidenceSpan)) {
    if (typeof span !== 'string') continue;
    // The acknowledges_misread doctrine guard from design §4.2 forbids
    // author-fault framing.
    if (/\byour\s+fault\b/i.test(span)) {
      throw new Error(
        `canonical evidenceSpan.${rawKey} contains banned framing "your fault": ${span}`,
      );
    }
    if (/\byou\s+were\s+unclear\b/i.test(span)) {
      throw new Error(
        `canonical evidenceSpan.${rawKey} contains banned framing "you were unclear": ${span}`,
      );
    }
    if (/\bbad\s+writing\b/i.test(span)) {
      throw new Error(
        `canonical evidenceSpan.${rawKey} contains banned framing "bad writing": ${span}`,
      );
    }
    if (/\byou\s+confused\s+me\b/i.test(span)) {
      throw new Error(
        `canonical evidenceSpan.${rawKey} contains banned framing "you confused me": ${span}`,
      );
    }
  }
});

Deno.test('doctrine: canonical fixture has no "lazy" / "imprecise" / "careless" framing (flags-term-ambiguity doctrine guard)', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-c-canonical-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) throw new Error('canonical fixture failed validator');
  for (const [rawKey, span] of Object.entries(valid.value.evidenceSpan)) {
    if (typeof span !== 'string') continue;
    if (/\blazy\b/i.test(span)) {
      throw new Error(
        `canonical evidenceSpan.${rawKey} contains banned framing "lazy": ${span}`,
      );
    }
    if (/\bimprecise\b/i.test(span)) {
      throw new Error(
        `canonical evidenceSpan.${rawKey} contains banned framing "imprecise": ${span}`,
      );
    }
    if (/\bcareless\b/i.test(span)) {
      throw new Error(
        `canonical evidenceSpan.${rawKey} contains banned framing "careless": ${span}`,
      );
    }
  }
});

Deno.test('doctrine: ban-list fixture (rejects_candidate_understanding propagandist) is rejected at evidenceSpan.rejects_candidate_understanding', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-c-ban-list-response.json',
  );
  const valid = validateMcpBooleanObservationResponse(fixture);
  if (!valid.ok) throw new Error('ban-list fixture should pass validator');
  const scan = scanFamilyCBooleanResponseForBanList(valid.value);
  assertEquals(scan.ok, false);
  if (!scan.ok) {
    assertEquals(scan.path, 'evidenceSpan.rejects_candidate_understanding');
  }
});

Deno.test('doctrine: canonical-request fixture frames offers_candidate_understanding without "you are wrong" hint', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-c-canonical-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = wrapper.input.currentText as string;
  // The canonical fixture move offers a candidate understanding without
  // verdict / wrong framing. Operator-visible signal that the fixture
  // encodes the intent.
  if (/\bwrong\b/i.test(moveText)) {
    throw new Error(
      `canonical-request fixture should NOT use "wrong" framing; got: ${moveText}`,
    );
  }
  // Must read as a paraphrase + invitation to correct.
  if (!/let me make sure/i.test(moveText)) {
    throw new Error(
      `canonical-request fixture should contain paraphrase + invitation-to-correct framing; got: ${moveText}`,
    );
  }
});

Deno.test('doctrine: candidate-understanding-request fixture frames rejection collaboratively (Not quite — I mean...)', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-c-candidate-understanding-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = wrapper.input.currentText as string;
  // The rejects_candidate_understanding positive case must frame the
  // rejection as collaborative grounding ("Not quite — I mean Y"), NOT
  // as "you are wrong". Operator-visible signal.
  if (/\byou\s+are\s+wrong\b/i.test(moveText)) {
    throw new Error(
      `candidate-understanding fixture should NOT use "you are wrong"; got: ${moveText}`,
    );
  }
  if (/\bnot\s+quite/i.test(moveText) === false) {
    throw new Error(
      `candidate-understanding fixture should contain collaborative-rejection framing "Not quite"; got: ${moveText}`,
    );
  }
});

Deno.test('doctrine: no-repair adversarial request fixture is Family B disputes_generalization content (proves Family C classifier discriminates)', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-c-no-repair-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = wrapper.input.currentText as string;
  // Per design §3 Fixture #5: the no-repair fixture is adversarial
  // disputes_generalization content. The Family C classifier MUST return
  // all 17 keys false (verified at runtime in the Edge admin_validation
  // smoke). Operator-visible signal that the fixture encodes the intent.
  if (!/generalization/i.test(moveText)) {
    throw new Error(
      `no-repair fixture should contain "generalization" trap; got: ${moveText}`,
    );
  }
  if (!/Australia/i.test(moveText)) {
    throw new Error(
      `no-repair fixture should contain Australia counter-example; got: ${moveText}`,
    );
  }
});

Deno.test('doctrine: clarification-cycle request fixture frames answers_clarification with substantive answer', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-c-clarification-cycle-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = wrapper.input.currentText as string;
  const parentText = wrapper.input.parentText as string;
  // The answers_clarification positive case must have a substantive answer
  // (not a counter-question, not an evasion). Parent must show a request.
  if (!/I asked what you meant/i.test(parentText)) {
    throw new Error(
      `clarification-cycle parent should signal a clarification request; got: ${parentText}`,
    );
  }
  if (!/I mean/i.test(moveText)) {
    throw new Error(
      `clarification-cycle move should contain substantive answer framing "I mean"; got: ${moveText}`,
    );
  }
});

Deno.test('doctrine: shared-definition request fixture frames confirms_shared_definition with explicit agreement', async () => {
  const wrapper = (await loadFixture(
    'classify-argument-boolean-observations.family-c-shared-definition-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = wrapper.input.currentText as string;
  const parentText = wrapper.input.parentText as string;
  // Parent must show a definition proposal. Move must confirm.
  if (!/Could we agree/i.test(parentText)) {
    throw new Error(
      `shared-definition parent should signal a definition proposal; got: ${parentText}`,
    );
  }
  if (!/Works for me/i.test(moveText)) {
    throw new Error(
      `shared-definition move should contain confirmation framing "Works for me"; got: ${moveText}`,
    );
  }
});
