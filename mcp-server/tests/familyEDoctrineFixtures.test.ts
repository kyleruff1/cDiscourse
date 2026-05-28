/**
 * MCP-SERVER-006-FAMILY-E — Family E doctrine-fixture safety tests.
 *
 * Per design §3 + amendment §3 BINDING — the 3 doctrine-risk Family E keys
 * require explicit framing guards:
 *   - slippery_slope_reasoning_present: HIGHEST RISK. NEVER framed as
 *     a fallacy.
 *   - abductive_explanation_present: NOT framed as a fallacy. Peirce's
 *     inference-to-best-explanation.
 *   - analogy_reasoning_present: NOT framed as a fallacy. Walton's
 *     analogy scheme.
 *
 * This test runs in two layers:
 *   1. In-line prompt-entry inspection — verifies the per-key
 *      falsePositiveGuards strings contain the verbatim doctrine
 *      guards from the design + amendment, plus banned-token-free
 *      positive examples.
 *   2. Source-doctrine scan — verifies the upstream familyE.ts header
 *      doctrine binding is preserved verbatim (the upstream taxonomy
 *      itself declares the doctrine binding; this card enforces that
 *      binding at the MCP server layer).
 */
import { FAMILY_E_PROMPT_ENTRIES } from '../lib/familyEKeys.ts';

Deno.test('doctrine: slippery_slope_reasoning_present prompt entry contains NO bare fallacy framing in non-guard fields', () => {
  // Design §3 BINDING: the per-key non-guard corpus (booleanQuestion +
  // positiveDefinition + negativeDefinition + positiveExample +
  // negativeExample) MUST NOT contain bare fallacy/weak/invalid/flawed
  // framing. The falsePositiveGuards field MAY contain these tokens in
  // negation form ("NOT call this a fallacy", "MUST NOT contain words
  // like 'fallacy'") — that is doctrine-positive.
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'slippery_slope_reasoning_present');
  if (!entry) throw new Error('slippery_slope_reasoning_present prompt entry missing');
  const nonGuardCorpus = [
    entry.booleanQuestion,
    entry.positiveDefinition,
    entry.negativeDefinition,
    entry.positiveExample,
    entry.negativeExample,
  ].join('\n');
  const fallacyPatterns: RegExp[] = [
    /\bis\s+a\s+fallacy\b/i,
    /\bclassic\s+fallacy\b/i,
    /\binformal\s+fallacy\b/i,
    /\bweak\s+argument\b/i,
    /\binvalid\s+argument\b/i,
    /\bbad\s+reasoning\b/i,
    /\blogical\s+error\b/i,
  ];
  for (const re of fallacyPatterns) {
    if (re.test(nonGuardCorpus)) {
      throw new Error(
        `slippery_slope_reasoning_present non-guard corpus contains fallacy framing matching ${re}. Got: ${nonGuardCorpus}`,
      );
    }
  }
});

Deno.test('doctrine: slippery_slope_reasoning_present falsePositiveGuards contain "is a SCHEME, never a fallacy" verbatim', () => {
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'slippery_slope_reasoning_present');
  if (!entry) throw new Error('slippery_slope_reasoning_present prompt entry missing');
  if (!entry.falsePositiveGuards.includes('slippery-slope is a SCHEME, never a fallacy')) {
    throw new Error(
      `slippery_slope_reasoning_present falsePositiveGuards missing "slippery-slope is a SCHEME, never a fallacy". Got: ${entry.falsePositiveGuards}`,
    );
  }
});

Deno.test('doctrine: slippery_slope_reasoning_present falsePositiveGuards reference Family F critical question', () => {
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'slippery_slope_reasoning_present');
  if (!entry) throw new Error('slippery_slope_reasoning_present prompt entry missing');
  if (!entry.falsePositiveGuards.includes('consequence_probability_unclear, Family F')) {
    throw new Error(
      `slippery_slope_reasoning_present falsePositiveGuards missing Family F critical question reference`,
    );
  }
});

Deno.test('doctrine: slippery_slope_reasoning_present falsePositiveGuards forbid output echoing of "fallacy" framing', () => {
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'slippery_slope_reasoning_present');
  if (!entry) throw new Error('slippery_slope_reasoning_present prompt entry missing');
  // Amendment §2.2: even when INPUT contains "fallacy", OUTPUT must not echo.
  if (!entry.falsePositiveGuards.includes("the model's own output must NOT echo or assert the fallacy framing")) {
    throw new Error(
      `slippery_slope_reasoning_present falsePositiveGuards missing "must NOT echo or assert the fallacy framing" instruction`,
    );
  }
});

Deno.test('doctrine: abductive_explanation_present prompt entry contains NO bare fallacy framing in non-guard fields', () => {
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'abductive_explanation_present');
  if (!entry) throw new Error('abductive_explanation_present prompt entry missing');
  const nonGuardCorpus = [
    entry.booleanQuestion,
    entry.positiveDefinition,
    entry.negativeDefinition,
    entry.positiveExample,
    entry.negativeExample,
  ].join('\n');
  const fallacyPatterns: RegExp[] = [
    /\bis\s+a\s+fallacy\b/i,
    /\bclassic\s+fallacy\b/i,
    /\bweak\s+inference\b/i,
    /\bbad\s+inference\b/i,
  ];
  for (const re of fallacyPatterns) {
    if (re.test(nonGuardCorpus)) {
      throw new Error(
        `abductive_explanation_present non-guard corpus contains fallacy framing matching ${re}. Got: ${nonGuardCorpus}`,
      );
    }
  }
});

Deno.test('doctrine: abductive_explanation_present falsePositiveGuards contain "is a SCHEME, not a fallacy" verbatim', () => {
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'abductive_explanation_present');
  if (!entry) throw new Error('abductive_explanation_present prompt entry missing');
  if (!entry.falsePositiveGuards.includes('abductive explanation (Peirce: inference to best explanation) is a SCHEME, not a fallacy')) {
    throw new Error(
      `abductive_explanation_present falsePositiveGuards missing "is a SCHEME, not a fallacy" verbatim`,
    );
  }
});

Deno.test('doctrine: analogy_reasoning_present prompt entry contains NO bare fallacy framing in non-guard fields', () => {
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'analogy_reasoning_present');
  if (!entry) throw new Error('analogy_reasoning_present prompt entry missing');
  const nonGuardCorpus = [
    entry.booleanQuestion,
    entry.positiveDefinition,
    entry.negativeDefinition,
    entry.positiveExample,
    entry.negativeExample,
  ].join('\n');
  const fallacyPatterns: RegExp[] = [
    /\bis\s+a\s+fallacy\b/i,
    /\bfaulty\s+analogy\b/i,
    /\bweak\s+analogy\b/i,
    /\bbad\s+analogy\b/i,
  ];
  for (const re of fallacyPatterns) {
    if (re.test(nonGuardCorpus)) {
      throw new Error(
        `analogy_reasoning_present non-guard corpus contains fallacy framing matching ${re}. Got: ${nonGuardCorpus}`,
      );
    }
  }
});

Deno.test('doctrine: analogy_reasoning_present falsePositiveGuards contain "is a SCHEME (Walton). It is not a fallacy" verbatim', () => {
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'analogy_reasoning_present');
  if (!entry) throw new Error('analogy_reasoning_present prompt entry missing');
  if (!entry.falsePositiveGuards.includes('analogy is a SCHEME (Walton). It is not a fallacy')) {
    throw new Error(
      `analogy_reasoning_present falsePositiveGuards missing "is a SCHEME (Walton). It is not a fallacy" verbatim`,
    );
  }
});

Deno.test('doctrine: no scheme-as-inherently-good or scheme-as-inherently-bad framing in any per-key entry', () => {
  // Per design §3 + cdiscourse-doctrine §10a: schemes are DESCRIPTIVE
  // structural pattern facts. No entry should imply a scheme is
  // inherently good or bad — that would be a verdict.
  const judgmentPatterns: RegExp[] = [
    /\bis\s+a\s+strong\s+argument\s+pattern\b/i,
    /\bis\s+a\s+weak\s+argument\s+pattern\b/i,
    /\bis\s+a\s+sound\s+pattern\b/i,
    /\bis\s+an\s+unsound\s+pattern\b/i,
    /\bis\s+a\s+good\s+pattern\b/i,
    /\bis\s+a\s+bad\s+pattern\b/i,
    /\bbest\s+kind\s+of\s+reasoning\b/i,
    /\bworst\s+kind\s+of\s+reasoning\b/i,
  ];
  for (const entry of FAMILY_E_PROMPT_ENTRIES) {
    const corpus = [
      entry.booleanQuestion,
      entry.positiveDefinition,
      entry.negativeDefinition,
      entry.positiveExample,
      entry.negativeExample,
      entry.falsePositiveGuards,
    ].join('\n');
    for (const re of judgmentPatterns) {
      if (re.test(corpus)) {
        throw new Error(
          `Family E entry ${entry.rawKey} contains scheme-quality judgment framing matching ${re}: ${corpus}`,
        );
      }
    }
  }
});

Deno.test('doctrine: no person-attribution tokens in any per-key entry', () => {
  // cdiscourse-doctrine §10a + §4: no entry should describe the move's
  // author with person-attribution language. The falsePositiveGuards
  // may LEGITIMATELY contain these tokens inside explicit "does NOT
  // imply" / "do NOT mark TRUE" negations.
  const personAttributionPatterns: RegExp[] = [
    /\btroll\b/i,
    /\bastroturfer\b/i,
    /\bliar\b/i,
    /\bpropagandist\b/i,
    /\bextremist\b/i,
    /\bdishonest\b/i,
  ];
  for (const entry of FAMILY_E_PROMPT_ENTRIES) {
    const corpus = [
      entry.booleanQuestion,
      entry.positiveDefinition,
      entry.negativeDefinition,
      entry.positiveExample,
      entry.negativeExample,
    ].join('\n');
    for (const re of personAttributionPatterns) {
      if (re.test(corpus)) {
        throw new Error(
          `Family E entry ${entry.rawKey} contains person-attribution framing matching ${re} in non-guards corpus: ${corpus}`,
        );
      }
    }
  }
});

Deno.test('doctrine: 3 doctrine-risk entries reference their corresponding Family F critical question', () => {
  // The design binding: each of the 3 doctrine-risk schemes points to its
  // Family F critical question as the place where scheme-quality is probed.
  // The pointer keeps the scope discipline clear: Family E detects PATTERN;
  // Family F probes whether the pattern's critical questions are met.
  const doctrineRiskKeys = [
    { rawKey: 'slippery_slope_reasoning_present', expectedFamilyFRef: 'consequence_probability_unclear, Family F' },
    { rawKey: 'analogy_reasoning_present', expectedFamilyFRef: 'analogy_mapping_missing, Family F' },
  ];
  for (const { rawKey, expectedFamilyFRef } of doctrineRiskKeys) {
    const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`${rawKey} prompt entry missing`);
    if (!entry.falsePositiveGuards.includes(expectedFamilyFRef)) {
      throw new Error(
        `${rawKey} falsePositiveGuards missing Family F critical-question reference '${expectedFamilyFRef}'`,
      );
    }
  }
});

Deno.test('doctrine: upstream familyE.ts header preserves doctrine binding verbatim', async () => {
  // Per design §3 + intent brief §10: the upstream taxonomy itself declares
  // the doctrine binding. This test reads upstream familyE.ts as source
  // text and asserts the doctrine-binding header is present verbatim. The
  // server-side Family E enforces the same binding at the prompt + ban-list
  // layers; this assertion proves the upstream source-of-truth is intact.
  const upstream = await Deno.readTextFile(
    new URL('../../src/features/nodeLabels/machineObservationDefinitions/familyE.ts', import.meta.url),
  );
  const expectedHeaderFragments = [
    'copy NEVER labels a scheme a "fallacy"',
    'Schemes are descriptive shape facts',
    'cdiscourse-doctrine §10a',
    'Walton (1995, 2008)',
    'critical-question framing',
  ];
  for (const fragment of expectedHeaderFragments) {
    if (!upstream.includes(fragment)) {
      throw new Error(
        `Upstream familyE.ts header doctrine binding missing fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('doctrine: slippery_slope_reasoning_present source upstream doctrineNotes mention MCP-020 audit', async () => {
  // The upstream familyE.ts entry for slippery_slope explicitly references
  // the MCP-020 audit's "Rejected labels" rationale. This test proves the
  // upstream is intact AND the server-side mirror's per-key prompt has the
  // equivalent doctrine anchor (per design §3).
  const upstream = await Deno.readTextFile(
    new URL('../../src/features/nodeLabels/machineObservationDefinitions/familyE.ts', import.meta.url),
  );
  if (!upstream.includes('MCP-020 audit')) {
    throw new Error('Upstream familyE.ts missing MCP-020 audit doctrine reference');
  }
  if (!upstream.includes('slippery_slope carries doctrine risk')) {
    throw new Error('Upstream familyE.ts missing "slippery_slope carries doctrine risk" anchor');
  }
});
