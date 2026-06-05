/**
 * ADMIN-ARGUMENTS-003 — Admin Arguments runTag filter model (pure TypeScript).
 *
 * No React. No Supabase. No network. No AI. A diagnostic / navigation aid that
 * classifies a debate title into one of the canonical bot-corpus run families
 * by reading the title suffix the corpus runners append, e.g.:
 *
 *   "Bike lanes are better [xai-adv 9018694f]"          → 'xai_adv'
 *   "Pitch clock changed pacing [ai-corpus fa17 #s7]"   → 'ai_corpus'
 *   "Sports debate [stress 2026-05-17 #scenario-7]"     → 'stress'
 *   "Foo [scenario-12 t03]"                              → 'scenario'
 *   "Bar [seed-pitch-clock]"                             → 'seed'
 *   "A normal user room with no suffix"                  → 'none'
 *
 * Doctrine (cdiscourse-doctrine §1/§2/§9):
 *   - The runTag is a NAVIGATION / DIAGNOSTIC signal, never a truth signal.
 *     "This room came from the xAI adversarial corpus" says nothing about
 *     whether any claim in it is correct, popular, or important. The filter
 *     lets an admin find a run; it never grades it.
 *   - Every user-facing label here is plain language. No internal validation
 *     code, no verdict token (winner / loser / true / false / liar / …).
 *
 * #476 forward-compat (CORPUS-30-RUNTAG-PERSIST):
 *   There is NO durable `run_tag` column on `public.arguments` /
 *   `argument_machine_observation_runs` at HEAD. Until #476 lands, the family
 *   is derived from the debate-title suffix via the EXISTING `debates(title)`
 *   JOIN the loader already performs — NO new query, NO new column, NO new
 *   index. `classifyRunFamily` takes a single `{ debateTitle }` context so the
 *   call site is identical whether the title comes from the title JOIN today or
 *   a durable column tomorrow. When #476 lands, a row's family can be read
 *   straight from the indexed column and the title heuristic becomes the
 *   fallback for legacy rows — the filter UI and the `RunFamily` union do not
 *   change. The existing `runTagSource.ts` seam in
 *   `src/features/adminClassifierHealth/` is the sibling abstraction for the
 *   classifier-health panel; this model is the Admin-Arguments-side filter
 *   bucket layer and reuses the same title-suffix convention.
 */

/**
 * The canonical run families an admin can filter the Arguments table by. The
 * suffix-free / human-authored rooms classify as `none`; `all` is the
 * unfiltered sentinel (not a row classification — only a filter value).
 */
export type RunFamily = 'xai_adv' | 'ai_corpus' | 'stress' | 'scenario' | 'seed' | 'none';

/** The filter value the toolbar holds — every family plus the `all` sentinel. */
export type RunTagFilterValue = RunFamily | 'all';

/** Ordered list of filter values for rendering the chip row (left → right). */
export const RUN_TAG_FILTER_VALUES: ReadonlyArray<RunTagFilterValue> = Object.freeze([
  'all',
  'xai_adv',
  'ai_corpus',
  'stress',
  'scenario',
  'seed',
  'none',
]);

/** Just the family classifications (excludes the `all` filter sentinel). */
export const RUN_FAMILIES: ReadonlyArray<RunFamily> = Object.freeze([
  'xai_adv',
  'ai_corpus',
  'stress',
  'scenario',
  'seed',
  'none',
]);

/**
 * Plain-language label for each filter value. Navigation framing only — these
 * describe WHERE a room came from, never a verdict about its content.
 */
export const RUN_TAG_FILTER_LABELS: Record<RunTagFilterValue, string> = {
  all: 'All rooms',
  xai_adv: 'xAI adversarial',
  ai_corpus: 'AI corpus',
  stress: 'Stress batch',
  scenario: 'Scenario',
  seed: 'Seed',
  none: 'Human / untagged',
};

/**
 * One-line plain-language description of each filter value, surfaced as the
 * helper line under the chip row. Diagnostic framing; no truth claim.
 */
export const RUN_TAG_FILTER_HINTS: Record<RunTagFilterValue, string> = {
  all: 'Show every room. No source filter applied.',
  xai_adv: 'Rooms seeded from the xAI adversarial thread corpus.',
  ai_corpus: 'Rooms seeded from an AI-driven corpus run.',
  stress: 'Rooms from a stress / load batch run.',
  scenario: 'Rooms built from a named scenario fixture.',
  seed: 'Rooms built from a seed-topic fixture.',
  none: 'Rooms with no corpus tag — typically authored by people.',
};

/**
 * Detect the family from the token leading a trailing `[...]` title suffix.
 * The token check is anchored to a bracket or hash boundary so a stray
 * mention of "stress" inside a claim body never mis-buckets a human room.
 *
 * Patterns are ordered most-specific first (`xai-adv` / `ai-corpus` before the
 * single-word families) so the dash-compound families win.
 */
const SUFFIX_FAMILY_PATTERNS: ReadonlyArray<{ family: RunFamily; pattern: RegExp }> = Object.freeze([
  // `[xai-adv …]`  /  `#xai-adv…`  — the xAI adversarial corpora.
  { family: 'xai_adv', pattern: /(?:\[|#)\s*xai-adv\b/i },
  // `[ai-corpus …]`  /  `#ai-corpus…` — the AI-driven corpus runner.
  { family: 'ai_corpus', pattern: /(?:\[|#)\s*ai-corpus\b/i },
  // `[stress …]` / `[stress-…]` / `#stress…` — stress / load batches.
  { family: 'stress', pattern: /(?:\[|#)\s*stress[\s\-\]]/i },
  // `[scenario-NN …]` / `#scenario-NN` — named scenario fixtures.
  { family: 'scenario', pattern: /(?:\[|#)\s*scenario[\s\-]/i },
  // `[seed-… ]` / `#seed-…` / `[ai-seed-…]` — seed-topic fixtures.
  { family: 'seed', pattern: /(?:\[|#)\s*(?:ai-)?seed[\s\-]/i },
]);

/**
 * Classify a debate title into a `RunFamily`. Returns `'none'` for a missing
 * / empty / suffix-free title (the common "real human room" case). Pure and
 * total — never throws.
 *
 * The context is an object (not a bare string) so the call site is stable when
 * #476 lands and the family can be read from a durable column instead.
 */
export function classifyRunFamily(
  context: { debateTitle: string | null | undefined },
): RunFamily {
  const title = context?.debateTitle;
  if (typeof title !== 'string' || title.trim().length === 0) return 'none';
  const trimmed = title.trim();
  for (const { family, pattern } of SUFFIX_FAMILY_PATTERNS) {
    if (pattern.test(trimmed)) return family;
  }
  return 'none';
}

/**
 * True when a row whose title classifies as `rowFamily` should be shown under
 * the active `filter`. The `all` sentinel shows everything; otherwise the
 * family must match exactly.
 */
export function runFamilyMatchesFilter(
  rowFamily: RunFamily,
  filter: RunTagFilterValue,
): boolean {
  if (filter === 'all') return true;
  return rowFamily === filter;
}

/** Narrow an unknown value to a `RunTagFilterValue`, falling back to `'all'`. */
export function coerceRunTagFilterValue(value: unknown): RunTagFilterValue {
  return typeof value === 'string'
    && (RUN_TAG_FILTER_VALUES as ReadonlyArray<string>).includes(value)
    ? (value as RunTagFilterValue)
    : 'all';
}
