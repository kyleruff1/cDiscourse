/**
 * MCP-SERVER-005-FAMILY-D — Family D doctrine-fixture safety tests.
 *
 * Per Stage 2B operator binding (recorded in design header) and intent
 * brief §4 — the 3 doctrine-risk Family D keys require explicit framing
 * guards:
 *   - anecdote_used: NOT framed as weakness. Anecdote is legitimate
 *     evidence in some contexts.
 *   - burden_request_present: NOT framed as a verdict on which side
 *     bears the burden.
 *   - evidence_gap_present: NOT framed as failure / dishonesty.
 *     Popularity / repetition / engagement are NOT evidence.
 *
 * This test runs in two layers:
 *   1. In-line prompt-entry inspection (Commit 4) — verifies the
 *      per-key falsePositiveGuards strings contain the verbatim doctrine
 *      guards from the operator brief, plus banned-token-free positive
 *      examples.
 *   2. Fixture-file inspection (Commit 5 expansion) — verifies the
 *      committed canonical response + per-scenario request fixtures
 *      encode the design intent. The fixture-file tests are added in
 *      familyDFixtureParity.test.ts and the integration tests there
 *      cross-check evidenceSpan content against the doctrine guards.
 */
import {
  FAMILY_D_PROMPT_ENTRIES,
} from '../lib/familyDKeys.ts';

Deno.test('doctrine: anecdote_used prompt entry positiveExample contains NO weakness framing', () => {
  // Stage 2B + intent brief §4.1: the anecdote_used positiveExample must
  // not encode "anecdote is weak". The example shows the structural form
  // (a single-case story) without any quality judgement.
  const entry = FAMILY_D_PROMPT_ENTRIES.find((e) => e.rawKey === 'anecdote_used');
  if (!entry) throw new Error('anecdote_used prompt entry missing');
  const corpus = [entry.positiveExample, entry.negativeExample, entry.booleanQuestion,
                  entry.positiveDefinition, entry.negativeDefinition].join('\n');
  const weaknessPatterns: RegExp[] = [
    /\bweak\b/i,
    /\bbad\b/i,
    /\binferior\b/i,
    /\blesser\b/i,
    /\bunreliable\b/i,
    /\bmerely\b/i,
  ];
  for (const re of weaknessPatterns) {
    if (re.test(corpus)) {
      throw new Error(
        `anecdote_used example/definition contains weakness framing matching ${re}: ${corpus}`,
      );
    }
  }
});

Deno.test('doctrine: anecdote_used falsePositiveGuards contains "NOT imply weakness" verbatim', () => {
  // Stage 2B + intent brief §4.1: the guards must explicitly tell the
  // model not to imply weakness.
  const entry = FAMILY_D_PROMPT_ENTRIES.find((e) => e.rawKey === 'anecdote_used');
  if (!entry) throw new Error('anecdote_used prompt entry missing');
  if (!entry.falsePositiveGuards.includes('copy must NOT imply weakness')) {
    throw new Error(
      `anecdote_used falsePositiveGuards missing "copy must NOT imply weakness". Got: ${entry.falsePositiveGuards}`,
    );
  }
  if (!entry.falsePositiveGuards.includes('anecdote is legitimate evidence in some contexts')) {
    throw new Error(
      `anecdote_used falsePositiveGuards missing "anecdote is legitimate evidence in some contexts". Got: ${entry.falsePositiveGuards}`,
    );
  }
});

Deno.test('doctrine: burden_request_present prompt entry positiveExample contains NO verdict framing', () => {
  // Stage 2B + intent brief §4.2: the positiveExample must not encode
  // which side actually bears the burden. The example shows the
  // structural request without adjudicating.
  const entry = FAMILY_D_PROMPT_ENTRIES.find((e) => e.rawKey === 'burden_request_present');
  if (!entry) throw new Error('burden_request_present prompt entry missing');
  const corpus = [entry.positiveExample, entry.negativeExample, entry.booleanQuestion,
                  entry.positiveDefinition, entry.negativeDefinition].join('\n');
  const verdictPatterns: RegExp[] = [
    /\bthe\s+burden\s+is\s+truly\b/i,
    /\bactually\s+bears\s+the\s+burden\b/i,
    /\bthe\s+right\s+answer\s+is\b/i,
    /\bwho\s+is\s+correct\b/i,
    /\bthe\s+correct\s+side\b/i,
  ];
  for (const re of verdictPatterns) {
    if (re.test(corpus)) {
      throw new Error(
        `burden_request_present example/definition contains verdict framing matching ${re}: ${corpus}`,
      );
    }
  }
});

Deno.test('doctrine: burden_request_present falsePositiveGuards contains "descriptively, not as a verdict" verbatim', () => {
  const entry = FAMILY_D_PROMPT_ENTRIES.find((e) => e.rawKey === 'burden_request_present');
  if (!entry) throw new Error('burden_request_present prompt entry missing');
  if (!entry.falsePositiveGuards.includes('descriptively, not as a verdict on which side is right')) {
    throw new Error(
      `burden_request_present falsePositiveGuards missing "descriptively, not as a verdict on which side is right". Got: ${entry.falsePositiveGuards}`,
    );
  }
});

Deno.test('doctrine: evidence_gap_present prompt entry positiveExample contains NO failure framing', () => {
  // Stage 2B + intent brief §4.3: the positiveExample must not encode
  // failure / dishonesty. Examples are structural cases (no source +
  // factual claim).
  const entry = FAMILY_D_PROMPT_ENTRIES.find((e) => e.rawKey === 'evidence_gap_present');
  if (!entry) throw new Error('evidence_gap_present prompt entry missing');
  const corpus = [entry.positiveExample, entry.negativeExample, entry.booleanQuestion,
                  entry.positiveDefinition, entry.negativeDefinition].join('\n');
  const failurePatterns: RegExp[] = [
    /\bauthor\s+failed\b/i,
    /\bthe\s+move\s+is\s+false\b/i,
    /\bthe\s+move\s+is\s+lying\b/i,
    /\bproves\s+the\s+claim\s+is\s+wrong\b/i,
    /\bbecause\s+the\s+author\s+is\s+lying\b/i,
  ];
  for (const re of failurePatterns) {
    if (re.test(corpus)) {
      throw new Error(
        `evidence_gap_present example/definition contains failure framing matching ${re}: ${corpus}`,
      );
    }
  }
});

Deno.test('doctrine: evidence_gap_present falsePositiveGuards contains anti-amplification anchor verbatim', () => {
  const entry = FAMILY_D_PROMPT_ENTRIES.find((e) => e.rawKey === 'evidence_gap_present');
  if (!entry) throw new Error('evidence_gap_present prompt entry missing');
  if (!entry.falsePositiveGuards.includes('Popularity / repetition / engagement are NOT evidence')) {
    throw new Error(
      `evidence_gap_present falsePositiveGuards missing anti-amplification anchor. Got: ${entry.falsePositiveGuards}`,
    );
  }
  if (!entry.falsePositiveGuards.includes('does NOT imply the move is dishonest, low-quality, or manipulative')) {
    throw new Error(
      `evidence_gap_present falsePositiveGuards missing "does NOT imply dishonest/low-quality/manipulative" guard. Got: ${entry.falsePositiveGuards}`,
    );
  }
});

Deno.test('doctrine: no popularity-as-evidence framing in any per-key entry (except as negation in evidence_gap_present)', () => {
  // Stage 2B + design §6: only the evidence_gap_present entry should
  // discuss popularity-as-evidence (and only in negation form). No other
  // entry should treat popularity as evidence.
  const popularityAsEvidencePatterns: RegExp[] = [
    /\bwidely\s+believed\s+counts\b/i,
    /\bviral\s+claims\s+are\s+evidence\b/i,
    /\bif\s+enough\s+people\s+say/i,
    /\beveryone\s+knows\s+counts\s+as/i,
  ];
  for (const entry of FAMILY_D_PROMPT_ENTRIES) {
    const corpus = [entry.booleanQuestion, entry.positiveDefinition, entry.negativeDefinition,
                    entry.positiveExample, entry.negativeExample, entry.falsePositiveGuards].join('\n');
    for (const re of popularityAsEvidencePatterns) {
      if (re.test(corpus)) {
        throw new Error(
          `Family D entry ${entry.rawKey} contains popularity-as-evidence framing matching ${re}: ${corpus}`,
        );
      }
    }
  }
});

Deno.test('doctrine: no person-attribution tokens in any per-key entry except as negation', () => {
  // cdiscourse-doctrine §10a + §4: no entry should describe the move's
  // author with person-attribution language (troll, bot, astroturfer,
  // liar, propagandist, extremist, bad faith, manipulative). The
  // falsePositiveGuards may LEGITIMATELY contain these tokens inside
  // explicit "does NOT imply" / "do NOT mark TRUE" negations.
  const personAttributionPatterns: RegExp[] = [
    /\btroll\b/i,
    /\bastroturfer\b/i,
    /\bliar\b/i,
    /\bpropagandist\b/i,
    /\bextremist\b/i,
  ];
  for (const entry of FAMILY_D_PROMPT_ENTRIES) {
    const corpus = [entry.booleanQuestion, entry.positiveDefinition, entry.negativeDefinition,
                    entry.positiveExample, entry.negativeExample].join('\n');
    for (const re of personAttributionPatterns) {
      if (re.test(corpus)) {
        throw new Error(
          `Family D entry ${entry.rawKey} contains person-attribution framing matching ${re} in non-guards corpus: ${corpus}`,
        );
      }
    }
  }
});

Deno.test('doctrine: source_chain_repair entry framed as recovery-positive (NOT framed as fixing an error)', () => {
  // source_chain_repair is a Family D positive recovery move per
  // evidence-doctrine. It must NOT be framed as the author admitting an
  // error or a mistake — it is structural chain completion.
  const entry = FAMILY_D_PROMPT_ENTRIES.find((e) => e.rawKey === 'source_chain_repair');
  if (!entry) throw new Error('source_chain_repair prompt entry missing');
  const corpus = [entry.booleanQuestion, entry.positiveDefinition, entry.negativeDefinition,
                  entry.positiveExample, entry.negativeExample].join('\n');
  const errorPatterns: RegExp[] = [
    /\bauthor\s+admits\s+the\s+error\b/i,
    /\bauthor\s+admits\s+the\s+mistake\b/i,
    /\bfixing\s+their\s+mistake\b/i,
  ];
  for (const re of errorPatterns) {
    if (re.test(corpus)) {
      throw new Error(
        `source_chain_repair entry contains error-correction framing matching ${re}: ${corpus}`,
      );
    }
  }
});
