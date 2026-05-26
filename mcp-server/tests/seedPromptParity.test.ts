/**
 * Parity test — the server-side mirrors of the canonical semantic-referee
 * prompt sources must not drift from the upstream CDiscourse Deno files.
 *
 * Reads both files as source text and checks for byte-identical inclusion
 * of the system-prompt absolute rules + the structured-output instruction
 * keywords. A wording change in either tree without the mirror update is a
 * build failure.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { SEMANTIC_REFEREE_SYSTEM_PROMPT, SEED_PROMPT_VERSION } from '../lib/seedPrompt.ts';

const UPSTREAM_SYSTEM_PROMPT_PATH = new URL(
  '../../supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts',
  import.meta.url,
);
const UPSTREAM_SEED_PROMPT_PATH = new URL(
  '../../supabase/functions/_shared/semanticReferee/seedPrompt.ts',
  import.meta.url,
);

Deno.test('seedPrompt: SEED_PROMPT_VERSION matches upstream', async () => {
  const source = await Deno.readTextFile(UPSTREAM_SEED_PROMPT_PATH);
  if (!source.includes(`'${SEED_PROMPT_VERSION}'`)) {
    throw new Error(
      `Upstream seedPrompt.ts does not contain the SEED_PROMPT_VERSION literal '${SEED_PROMPT_VERSION}'`,
    );
  }
});

Deno.test('seedPrompt: system prompt absolute rules are byte-equal', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_SYSTEM_PROMPT_PATH);
  // The 7 absolute rules must appear verbatim in the upstream source.
  const absoluteRules = [
    'You do NOT decide who is right in a debate.',
    'You do NOT decide the winner of any debate.',
    'You do NOT assign a truth value to any claim.',
    'You do NOT treat popularity, engagement, or virality as evidence.',
    "You do NOT describe, judge, or label the person — only the move's structure.",
    'You do NOT recommend hiding, deleting, or modifying any content.',
    'You do NOT block an ordinary post — your output is advisory metadata only.',
  ];
  for (const rule of absoluteRules) {
    if (!upstream.includes(rule)) {
      throw new Error(`Upstream missing absolute rule: ${rule}`);
    }
    if (!SEMANTIC_REFEREE_SYSTEM_PROMPT.includes(rule)) {
      throw new Error(`Server mirror missing absolute rule: ${rule}`);
    }
  }
});

Deno.test('seedPrompt: structured-output instruction keywords are present', () => {
  const expected = [
    'Return strict JSON only.',
    'no prose, no markdown, no chain-of-thought',
    'Never include a blocking field, a truth field, a verdict field, or a winner field',
  ];
  for (const keyword of expected) {
    if (!SEMANTIC_REFEREE_SYSTEM_PROMPT.includes(keyword)) {
      throw new Error(`Server mirror missing structured-output keyword: ${keyword}`);
    }
  }
});

Deno.test('seedPrompt: classifier id catalog has 35 entries (catalog v1)', async () => {
  const { SEED_PROMPT_CATALOG } = await import('../lib/seedPrompt.ts');
  assertEquals(SEED_PROMPT_CATALOG.length, 35);
});
