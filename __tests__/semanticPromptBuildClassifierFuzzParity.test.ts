/**
 * MCP-MOD-005 — `buildClassifierPrompt` fuzz-parity test.
 *
 * Behavior-preservation guard for the MCP-MOD-005 prompt-template refactor.
 * `buildClassifierPrompt` now iterates `SEMANTIC_CLASSIFIER_CATALOG` directly
 * rather than reading a per-id `CLASSIFIER_QUESTION_TEXT[id]` lookup table.
 * This test generates 50 random `requestedClassifiers` subsets from
 * `ALL_SEMANTIC_CLASSIFIER_IDS` using a SEEDED PRNG (fixed seed committed in
 * the file) and asserts the new function produces byte-identical output to a
 * LOCAL reference implementation that uses the pre-refactor per-id-lookup
 * approach.
 *
 * The reference implementation lives ONLY inside this test file — it never
 * leaks into production. It is a faithful reproduction of the pre-MCP-MOD-005
 * `buildClassifierPrompt`'s assembly mechanism: walk the request's
 * `requestedClassifiers` in caller order, de-duplicate while preserving
 * first-seen order, look up each id in a derived
 * `id → structuralQuestion` map, skip unknown ids silently.
 *
 * The new and old implementations differ in iteration source:
 *   - OLD: iterate `request.requestedClassifiers`, look up each id.
 *   - NEW: iterate `SEMANTIC_CLASSIFIER_CATALOG`, filter by request.
 *
 * Byte-identity holds when the request ALREADY lists ids in catalog order
 * (the typical wired-path call — `POST_SUBMIT_CLASSIFIER_SET` is declared in
 * catalog order). For requests whose ids are NOT in catalog order, the new
 * function emits them in catalog order, the old function emits them in caller
 * order — those bytes legitimately differ. The fuzz subsets here are drawn
 * from `ALL_SEMANTIC_CLASSIFIER_IDS` and KEEP catalog declaration order, so
 * the two implementations must produce identical bytes.
 *
 * The legacy helper is removed in the same PR after this test confirms
 * 50/50 match.
 *
 * Pure-TS. No network. No Supabase. No React. Uses the `_helpers/semanticRefereeDeno.ts`
 * Jest bridge to load the Deno modules.
 */
import {
  buildClassifierPrompt,
  DENO_SEMANTIC_CLASSIFIER_CATALOG,
  DENO_ALL_SEMANTIC_CLASSIFIER_IDS,
} from './_helpers/semanticRefereeDeno';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

/**
 * The fixed RNG seed committed in this test file (per the MCP-MOD-005 design
 * §9 risk mitigation: the fuzz test's RNG seed is non-deterministic →
 * seed with a fixed value committed in the test file).
 */
const RNG_SEED = 0xc0ffee_05;

/**
 * Deterministic seeded PRNG — Mulberry32. Returns a function that yields a
 * pseudo-random number in [0, 1) on each call.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pre-MCP-MOD-005 reference implementation of `buildClassifierPrompt` — kept
 * LOCAL to this test file so it never leaks into the public API. The
 * implementation walks `request.requestedClassifiers` in caller order, looks
 * each id up in a derived `id → structuralQuestion` table, and assembles the
 * full user-message string. Every byte other than the per-id question-line
 * loop matches the live function (instruction text, worked example, input
 * block).
 *
 * The reference reads the question text from `DENO_SEMANTIC_CLASSIFIER_CATALOG`
 * so any catalog wording change is automatically picked up — the lookup table
 * is built fresh per call.
 */
function legacyBuildClassifierPrompt(request: ClassifyMoveRequest): string {
  // Derive the legacy `id → structuralQuestion` table from the catalog. Same
  // shape `Object.fromEntries(SEMANTIC_CLASSIFIER_CATALOG.map(...))` produced
  // pre-MCP-MOD-005 (post-MCP-MOD-004 the lookup was already catalog-derived).
  const questionTable: Readonly<Record<string, string>> = Object.freeze(
    Object.fromEntries(
      DENO_SEMANTIC_CLASSIFIER_CATALOG.map((entry) => [entry.id, entry.structuralQuestion]),
    ) as Record<string, string>,
  );

  // Pre-refactor question-line loop: iterate the request, de-duplicate while
  // preserving first-seen order, skip unknown ids silently.
  const seen = new Set<string>();
  const questionLines: string[] = [];
  for (const id of request.requestedClassifiers) {
    if (seen.has(id)) continue;
    seen.add(id);
    const question = questionTable[id];
    if (question === undefined) continue;
    questionLines.push(`- ${id}: ${question}`);
  }

  const instruction = [
    'Answer each structural question above with 0 or 1 for the move below.',
    'Return ONLY a single JSON object — no prose, no markdown, no code fence,',
    'no chain-of-thought. The object must conform to the semantic-referee',
    'packet contract: a `binaries` array (one entry per requested classifier,',
    'each with `classifierId`, `value` 0 or 1, `confidence` low/medium/high,',
    'and a lowercase snake_case `reasonCode`), a `routeSuggestion`, a',
    '`frictionSuggestion`, and a `scoreHints` object of six integers 0..3.',
    '`routeSuggestion` MUST be exactly one of: "mainline", "vertical_chime_branch",',
    '"diagonal_tangent", "outer_realm", "cards_detail", "synthesis_lane",',
    '"no_route_change". `frictionSuggestion` MUST be exactly one of: "none",',
    '"soft_chip", "pre_send_pause", "ask_for_quote", "ask_for_source",',
    '"suggest_branch", "suggest_narrow", "cooldown_notice".',
    'Do not include any blocking, verdict, truth, or winner field.',
  ].join(' ');

  const exampleClassifierId = DENO_SEMANTIC_CLASSIFIER_CATALOG[0].id;
  const workedExample = [
    'Worked example of the packet shape (the values below are illustrative —',
    'choose your own values based on the structural questions; do not copy these',
    'verbatim):',
    '```json',
    '{',
    '  "binaries": [',
    '    {',
    `      "classifierId": "${exampleClassifierId}",`,
    '      "value": 1,',
    '      "confidence": "high",',
    '      "reasonCode": "parent_continuity_engaged"',
    '    }',
    '  ],',
    '  "routeSuggestion": "mainline",',
    '  "frictionSuggestion": "none",',
    '  "scoreHints": {',
    '    "continuityCredit": 2,',
    '    "evidencePressure": 1,',
    '    "branchHygiene": 1,',
    '    "synthesisReadiness": 0,',
    '    "sourceChainDebt": 0,',
    '    "unresolvedRedirectRisk": 0',
    '  }',
    '}',
    '```',
  ].join('\n');

  // Inline the redacted-input block — same shape as `seedPrompt.ts`'s
  // private `buildInputBlock`. Kept local so the reference never imports a
  // non-public symbol.
  const inputLines: string[] = ['Input to classify:'];
  const ctx = request.roomContext;
  if (ctx.debateMode) inputLines.push(`Room debate mode: ${ctx.debateMode}`);
  if (ctx.selectedAction) inputLines.push(`Selected action: ${ctx.selectedAction}`);
  if (ctx.selectedMoveType) inputLines.push(`Declared move type: ${ctx.selectedMoveType}`);
  if (ctx.side) inputLines.push(`Participant side: ${ctx.side}`);
  if (ctx.actorRole) inputLines.push(`Participant role: ${ctx.actorRole}`);
  if (request.parentBodyRedacted !== undefined) {
    inputLines.push(`Parent move (the move being replied to):\n${request.parentBodyRedacted}`);
  } else {
    inputLines.push('Parent move: none — this is a root move.');
  }
  inputLines.push(`Move to classify:\n${request.moveBodyRedacted}`);
  const inputBlock = inputLines.join('\n');

  return [
    'Structural questions for this move:',
    questionLines.join('\n'),
    '',
    instruction,
    '',
    workedExample,
    '',
    inputBlock,
  ].join('\n');
}

/**
 * Draw a random subset of `ALL_SEMANTIC_CLASSIFIER_IDS`, preserving catalog
 * declaration order. The subset size is uniform in [1, N]. Ids are filtered
 * in catalog order with a per-id Bernoulli draw, so the resulting subset's
 * order matches the catalog — this is the byte-identity precondition.
 */
function drawCatalogOrderedSubset(rng: () => number): readonly string[] {
  const ids = DENO_ALL_SEMANTIC_CLASSIFIER_IDS;
  const subset: string[] = [];
  for (const id of ids) {
    if (rng() < 0.5) subset.push(id);
  }
  // Guarantee at least one id — re-add the first catalog id if empty.
  if (subset.length === 0) subset.push(ids[0]);
  return subset;
}

/**
 * Build a deterministic `ClassifyMoveRequest` for the fuzz test. Bodies are
 * non-secret literals; the input block formatting is exercised end-to-end.
 */
function makeFuzzRequest(
  requestedClassifiers: readonly string[],
  index: number,
): ClassifyMoveRequest {
  return {
    roomId: `room-fuzz-${index}`,
    moveBodyRedacted: `[MOVE_BODY_${index}]`,
    parentBodyRedacted: index % 3 === 0 ? undefined : `[PARENT_BODY_${index}]`,
    roomContext: {
      debateMode: index % 2 === 0 ? 'standard' : undefined,
      selectedAction: index % 4 === 1 ? 'reply' : undefined,
      side: index % 5 === 2 ? 'observer' : undefined,
    } as ClassifyMoveRequest['roomContext'],
    requestedClassifiers: [...requestedClassifiers],
    contentHash: `hash-fuzz-${index}`,
  };
}

describe('MCP-MOD-005 — buildClassifierPrompt fuzz-parity', () => {
  it('produces byte-identical output to the legacy per-id-lookup reference across 50 random subsets', () => {
    const rng = mulberry32(RNG_SEED);
    const mismatches: Array<{ index: number; ids: readonly string[] }> = [];
    let totalRuns = 0;

    for (let i = 0; i < 50; i++) {
      const ids = drawCatalogOrderedSubset(rng);
      const request = makeFuzzRequest(ids, i);
      const actual = buildClassifierPrompt(request);
      const expected = legacyBuildClassifierPrompt(request);
      totalRuns += 1;
      if (actual !== expected) {
        mismatches.push({ index: i, ids });
      }
    }

    expect(totalRuns).toBe(50);
    expect(mismatches).toEqual([]);
  });

  it('produces stable output across repeated invocations with the same input', () => {
    const rng = mulberry32(RNG_SEED);
    const ids = drawCatalogOrderedSubset(rng);
    const request = makeFuzzRequest(ids, 0);
    const first = buildClassifierPrompt(request);
    const second = buildClassifierPrompt(request);
    const third = buildClassifierPrompt(request);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('emits no banned id outside the requested set across every fuzz subset', () => {
    const rng = mulberry32(RNG_SEED);
    for (let i = 0; i < 50; i++) {
      const ids = drawCatalogOrderedSubset(rng);
      const requested = new Set<string>(ids);
      const request = makeFuzzRequest(ids, i);
      const prompt = buildClassifierPrompt(request);
      for (const id of DENO_ALL_SEMANTIC_CLASSIFIER_IDS) {
        const hasLine = prompt.includes(`- ${id}:`);
        if (requested.has(id)) {
          expect(hasLine).toBe(true);
        } else {
          expect(hasLine).toBe(false);
        }
      }
    }
  });
});
