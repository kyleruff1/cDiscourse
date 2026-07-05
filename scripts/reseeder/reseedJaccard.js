/**
 * RESEED-001 — token-set Jaccard + near-verbatim threshold.
 *
 * `NEAR_VERBATIM_THRESHOLD` is a TWIN of the samey-move detector's
 * `SAMEY_MOVE_HIGH_PAIR_THRESHOLD = 0.60` in
 * `scripts/bot-fixtures/xaiAdversarialReport.js`. The `archive-cluster` pack
 * deliberately composes sibling bodies whose pairwise Jaccard >= this value so
 * the existing detector fires end-to-end.
 *
 * The value is duplicated here (0.60) because the source constant is
 * module-private in xaiAdversarialReport.js. `reseedArchiveCluster.jaccard`
 * pins twin-equality by SOURCE-SCAN (Node fs, since `rg` is unreliable in this
 * Git Bash env) — if the reused source constant ever changes, that test fails.
 *
 * `tokenSetJaccard` matches the detector's `sameyJaccardSets` semantics
 * (intersection / union of two token SETS).
 *
 * CommonJS / pure.
 */

// TWIN of xaiAdversarialReport.SAMEY_MOVE_HIGH_PAIR_THRESHOLD (0.60).
const NEAR_VERBATIM_THRESHOLD = 0.6;

/** Tokenize like the detector: lowercase, strip non-alnum, keep tokens len>=3. */
function tokenize(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
}

/**
 * Jaccard over two token SETS. Mirrors sameyJaccardSets():
 *   intersection / (|a| + |b| - intersection).
 * Accepts strings or Sets.
 */
function tokenSetJaccard(a, b) {
  const setA = a instanceof Set ? a : tokenize(a);
  const setB = b instanceof Set ? b : tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection += 1;
  const unionSize = setA.size + setB.size - intersection;
  return unionSize === 0 ? 0 : intersection / unionSize;
}

module.exports = {
  NEAR_VERBATIM_THRESHOLD,
  tokenSetJaccard,
  tokenize,
};
