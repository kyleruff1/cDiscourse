/**
 * MCP-OBSERVATION-MAPPING-EXPANSION-001 (Slice A) — the pure mapping evaluator.
 *
 * `evaluateObservationMapping(positiveRawKeys, rules, { surface })` reads a
 * move's already-persisted POSITIVE boolean rawKeys and emits richer,
 * combination-aware DISPLAY observations. It is the Track-1 engine from the
 * ratified design (docs/designs/MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001.md
 * §4).
 *
 * Contract (design §4.2):
 *   - POST-STORAGE: runs over already-persisted positives; never calls the
 *     classifier/provider; never appears in the submit/acceptance path.
 *   - DETERMINISTIC + PURE: same input set + same rules → JSON-equal output.
 *     No I/O, no Date.now, no Math.random, no mutation of inputs.
 *   - NO GATE: the output type carries no block/route/suppress/delay field.
 *   - ABSENCE SEMANTICS: a `requiredFalseFlags` rawKey is "absent" iff it is
 *     NOT in `positiveRawKeys` (the store has no row for a negative). A
 *     negative observation describes only that the classifier did not observe
 *     the positive — NEVER that the author failed.
 *
 * Composite-supersedes-singles (OQ-c, ratified §13c):
 *   composites SUPERSEDE the singles whose rawKeys they FULLY consume
 *   (curated_triple/cross_family > pair > single). A consumed single does not
 *   also render; only the highest-order rule covering a given rawKey set is
 *   emitted, plus any singles not consumed by a composite.
 *
 * Labels (design §4.4): each emitted code routes through
 * `gameCopy.toPlainLanguageOrSuppress`. When the code is mapped, that
 * plain-language string is the display label; when unmapped, the rule's
 * already-verdict-free `labelNeutral` is the display label (a raw snake_case
 * code can NEVER leak — `looksLikeInternalCode` would have to be true, which
 * the curated/adopted labels never are).
 *
 * Confidence (design §4.5): surfaced as a PIP LEVEL (low|medium|high), never
 * a number.
 *
 * Pure TS. No React, no Supabase, no network. JSON-serializable.
 */

import {
  looksLikeInternalCode,
  toPlainLanguageOrSuppress,
} from '../../arguments/gameCopy';
import type {
  EvaluateObservationMappingOptions,
  ObservationMappingResult,
  ObservationMappingRule,
} from './observationMappingTypes';

/** Specificity rank for the supersede rule — higher consumes lower. */
const RULE_KIND_SPECIFICITY: Record<ObservationMappingRule['ruleKind'], number> = {
  single_true: 1,
  single_false: 1,
  pair_true_true: 2,
  pair_true_false: 2,
  pair_false_true: 2,
  curated_triple: 3,
  cross_family: 3,
};

function normalizePositiveSet(
  positiveRawKeys: ReadonlySet<string> | ReadonlyArray<string> | null | undefined,
): ReadonlySet<string> {
  if (positiveRawKeys instanceof Set) return positiveRawKeys;
  if (Array.isArray(positiveRawKeys)) {
    const set = new Set<string>();
    for (const k of positiveRawKeys) {
      if (typeof k === 'string' && k.length > 0) set.add(k);
    }
    return set;
  }
  return new Set<string>();
}

/**
 * A rule fires when every `requiredTrueFlags` rawKey is PRESENT in the
 * positive set AND every `requiredFalseFlags` rawKey is ABSENT from it. An
 * empty `requiredTrueFlags` (a pure negative rule) fires on absence alone.
 */
function ruleFires(
  rule: ObservationMappingRule,
  positive: ReadonlySet<string>,
): boolean {
  // A rule with no constraints at all never fires (defensive — keeps the
  // evaluator from emitting a mark for a malformed row).
  if (rule.requiredTrueFlags.length === 0 && rule.requiredFalseFlags.length === 0) {
    return false;
  }
  for (const flag of rule.requiredTrueFlags) {
    if (!positive.has(flag)) return false;
  }
  for (const flag of rule.requiredFalseFlags) {
    if (positive.has(flag)) return false;
  }
  return true;
}

/** The POSITIVE rawKeys a fired rule "consumes" (its required-true set). */
function consumedPositiveFlags(rule: ObservationMappingRule): ReadonlyArray<string> {
  return rule.requiredTrueFlags;
}

function passesSurfaceFilter(
  rule: ObservationMappingRule,
  surface: EvaluateObservationMappingOptions['surface'],
): boolean {
  if (surface === 'card') return rule.cardSurfaceVisibility === 'card_default_visible';
  if (surface === 'timeline') {
    return rule.timelineSurfaceVisibility === 'timeline_tap_to_reveal';
  }
  return false;
}

/**
 * Resolve the display label for a rule. Routes the observationCode through
 * gameCopy; falls back to the verdict-free `labelNeutral` when the code is
 * unmapped. Never returns a raw internal code.
 */
function resolveDisplayLabel(rule: ObservationMappingRule): string {
  const mapped = toPlainLanguageOrSuppress(rule.observationCode);
  if (mapped !== null && mapped.length > 0 && !looksLikeInternalCode(mapped)) {
    return mapped;
  }
  return rule.labelNeutral;
}

function toResult(rule: ObservationMappingRule): ObservationMappingResult {
  return {
    mappingId: rule.mappingId,
    observationCode: rule.observationCode,
    displayLabel: resolveDisplayLabel(rule),
    shortLabel: rule.labelShort,
    diagnosticSentence: rule.diagnosticSentence,
    familyKey: rule.familyKey,
    ruleKind: rule.ruleKind,
    displayPriority: rule.displayPriority,
    confidencePip: rule.confidencePip,
    kind: 'machine_observation',
  };
}

/** Stable ordering: displayPriority asc, then mappingId lexicographic. */
function compareForOutput(a: ObservationMappingRule, b: ObservationMappingRule): number {
  if (a.displayPriority !== b.displayPriority) {
    return a.displayPriority - b.displayPriority;
  }
  if (a.mappingId < b.mappingId) return -1;
  if (a.mappingId > b.mappingId) return 1;
  return 0;
}

/**
 * Evaluate the mapping registry against a move's positive booleans.
 *
 * @param positiveRawKeys  the move's POSITIVE boolean rawKeys (one per
 *                         persisted observation row). Set or array; unknown /
 *                         empty strings are ignored.
 * @param rules            the declarative mapping registry (already reviewed +
 *                         reconciled to deployed rawKeys).
 * @param options.surface  'card' | 'timeline' — surface-visibility filter.
 * @returns                ordered display marks (composite-supersedes-singles
 *                         already applied). Never mutates inputs. `[]` for
 *                         empty / no-fire input.
 */
export function evaluateObservationMapping(
  positiveRawKeys: ReadonlySet<string> | ReadonlyArray<string> | null | undefined,
  rules: ReadonlyArray<ObservationMappingRule> | null | undefined,
  options: EvaluateObservationMappingOptions,
): ReadonlyArray<ObservationMappingResult> {
  if (!Array.isArray(rules) || rules.length === 0) return [];
  if (!options || (options.surface !== 'card' && options.surface !== 'timeline')) {
    return [];
  }
  const positive = normalizePositiveSet(positiveRawKeys);
  if (positive.size === 0) return [];

  // Pass 1: collect every rule that fires AND passes the surface filter.
  const fired: ObservationMappingRule[] = [];
  for (const rule of rules) {
    if (!ruleFires(rule, positive)) continue;
    if (!passesSurfaceFilter(rule, options.surface)) continue;
    fired.push(rule);
  }
  if (fired.length === 0) return [];

  // Pass 2: composite-supersedes-singles. A single is consumed iff some
  // strictly-higher-specificity fired rule includes that single's lone
  // positive rawKey in its required-true set. Consumed singles are dropped.
  // (Negatives — single_false — consume no positive rawKey, so they are never
  // suppressed by this rule; they render alongside composites.)
  const singles = fired.filter((r) => r.ruleKind === 'single_true');
  const composites = fired.filter((r) => RULE_KIND_SPECIFICITY[r.ruleKind] >= 2);

  const consumedByComposite = new Set<string>();
  for (const composite of composites) {
    for (const flag of consumedPositiveFlags(composite)) {
      consumedByComposite.add(flag);
    }
  }

  const survivingSingleIds = new Set<string>();
  for (const single of singles) {
    // single_true always has exactly one required-true flag.
    const flag = single.requiredTrueFlags[0];
    if (flag === undefined) continue;
    if (!consumedByComposite.has(flag)) survivingSingleIds.add(single.mappingId);
  }

  const survivors = fired.filter((r) => {
    if (r.ruleKind === 'single_true') return survivingSingleIds.has(r.mappingId);
    return true;
  });

  // Pass 3: stable ordering, then map to results.
  return Object.freeze(
    [...survivors].sort(compareForOutput).map(toResult),
  );
}
