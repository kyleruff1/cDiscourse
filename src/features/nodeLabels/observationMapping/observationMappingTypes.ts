/**
 * MCP-OBSERVATION-MAPPING-EXPANSION-001 (Slice A) — type contracts for the
 * pure observation-mapping evaluator + the reviewed existing-boolean registry.
 *
 * Track 1 of the ratified GATE-A design
 * (docs/designs/MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001.md §4): a
 * declarative mapping registry of `ObservationMappingRule` rows, evaluated
 * POST-STORAGE against a single move's set of POSITIVE boolean rawKeys, that
 * emits richer combination-aware DISPLAY observations ("what the referee
 * noticed about this reply").
 *
 * Doctrine anchors (binding — design §3, the 9 invariants):
 *   - §1 (acceptance-gate): everything here is POST-storage display. No rule
 *     blocks/rejects/routes/delays a post. `engine.ts` is the sole gate.
 *   - §2 (display-only, never verdict, never author label): every label is
 *     about the MOVE/REPLY, advisory; never winner/loser/correctness; never
 *     "this person is X". Confidence surfaces as PIPS, never a number.
 *   - cdiscourse-doctrine §10a: all output is `machine_observation`; no
 *     `inactive_reason` / moderation-reason label is ever surfaced.
 *   - cdiscourse-doctrine §9: every label routes through
 *     `gameCopy.toPlainLanguageOrSuppress`; unknown codes are suppressed.
 *
 * Pure TS. No React, no Supabase, no network, no Date.now/Math.random,
 * no mutation. JSON-serializable. (Edge mirror + read-time wiring are
 * Slice B — NOT this slice.)
 */

import type { MachineObservationFamily } from '../nodeLabelTypes';

/**
 * Cross-family key — the `${familyA}+${familyB}` shape the candidate
 * artifact uses for `cross_family` rows (e.g.
 * `disagreement_axis+evidence_source_chain`). Kept as a branded string
 * alias; the registry only ever stores A-G combinations.
 */
export type CrossFamilyKey = string;

/**
 * The seven rule kinds from the candidate artifact's `rule_kind` column.
 *
 *   - `single_true`     — fires when one rawKey is POSITIVE.
 *   - `single_false`    — fires when one rawKey is ABSENT (no positive row).
 *   - `pair_true_true`  — both rawKeys positive.
 *   - `pair_true_false` — first positive, second absent (asymmetric).
 *   - `pair_false_true` — first absent, second positive (asymmetric).
 *   - `curated_triple`  — three rawKeys positive.
 *   - `cross_family`    — a combination spanning two A-G families.
 */
export type ObservationMappingRuleKind =
  | 'single_true'
  | 'single_false'
  | 'pair_true_true'
  | 'pair_true_false'
  | 'pair_false_true'
  | 'curated_triple'
  | 'cross_family';

/**
 * Per-rule surface-visibility posture (design §4.6 / §9). Card page loads +
 * shows detail by default; timeline shows the same detail behind tap-to-reveal.
 */
export type CardSurfaceVisibility = 'card_default_visible' | 'card_hidden';
export type TimelineSurfaceVisibility =
  | 'timeline_tap_to_reveal'
  | 'timeline_hidden';

/**
 * Confidence pip level (design §4.5). The artifact's numeric
 * `confidence_weight` is an INTERNAL ordering hint only — it is NEVER
 * surfaced as a number. The evaluator maps it to one of three pip levels.
 */
export type ConfidencePipLevel = 'low' | 'medium' | 'high';

/**
 * A single declarative mapping rule. Mirrors the candidate artifact's
 * columns (design §4.1). All label/diagnostic fields are verdict-free and
 * move-level; they pass the registry review-gate scan (§2.3 of the prompt /
 * §8.2 of the design).
 *
 * Pure data. JSON-serializable.
 */
export interface ObservationMappingRule {
  /** Stable rule id (e.g. `MBOM-00001` for adopted CSV rows, or
   *  `parent_relation.single_true.supports_parent` for curated rows). */
  readonly mappingId: string;

  /** The A-G family (or `${famA}+${famB}` for cross-family). */
  readonly familyKey: MachineObservationFamily | CrossFamilyKey;

  /** The rule kind. */
  readonly ruleKind: ObservationMappingRuleKind;

  /** rawKeys that MUST be present (positive) for the rule to fire. */
  readonly requiredTrueFlags: ReadonlyArray<string>;

  /** rawKeys that MUST be ABSENT (no positive row) for the rule to fire. */
  readonly requiredFalseFlags: ReadonlyArray<string>;

  /** The observation code routed through `gameCopy.toPlainLanguageOrSuppress`.
   *  Never user-facing raw; the registry's verdict-free `labelNeutral` is the
   *  default display label when the code has no gameCopy mapping. */
  readonly observationCode: string;

  /** Short verdict-free move-pattern label (chip-sized). */
  readonly labelShort: string;

  /** Verdict-free family-pattern label (the default display label). */
  readonly labelNeutral: string;

  /** Verdict-free one-line diagnostic sentence about the MOVE. */
  readonly diagnosticSentence: string;

  /** Ordering only — NOT a score, NOT a verdict. Lower = higher priority. */
  readonly displayPriority: number;

  /** INTERNAL ordering hint; surfaced ONLY as a pip level, never a number. */
  readonly confidencePip: ConfidencePipLevel;

  /** Card-surface posture. */
  readonly cardSurfaceVisibility: CardSurfaceVisibility;

  /** Timeline-surface posture. */
  readonly timelineSurfaceVisibility: TimelineSurfaceVisibility;

  /** The no-block/reject/suppress/route/delay note. Asserted present by the
   *  registry review-gate test. */
  readonly safetyNote: string;
}

/**
 * One emitted display mark. The evaluator's only output type — it carries NO
 * block/route/suppress/delay field (design §4.2 "No gate").
 *
 * Pure data. JSON-serializable.
 */
export interface ObservationMappingResult {
  /** The rule that fired. */
  readonly mappingId: string;

  /** The observation code (internal; routed through gameCopy for display). */
  readonly observationCode: string;

  /** The plain-language display label. Resolution order:
   *   1. `gameCopy.toPlainLanguageOrSuppress(observationCode)` when mapped;
   *   2. otherwise the rule's verdict-free `labelNeutral`.
   *  Never a raw snake_case code. */
  readonly displayLabel: string;

  /** Short chip label (verdict-free). */
  readonly shortLabel: string;

  /** Verdict-free diagnostic sentence about the MOVE. */
  readonly diagnosticSentence: string;

  /** The A-G family (or cross-family key). */
  readonly familyKey: MachineObservationFamily | CrossFamilyKey;

  /** The rule kind that fired. */
  readonly ruleKind: ObservationMappingRuleKind;

  /** Ordering only — lower = higher priority. */
  readonly displayPriority: number;

  /** Confidence as a pip level — NEVER a number. */
  readonly confidencePip: ConfidencePipLevel;

  /** Always 'machine_observation' (cdiscourse-doctrine §10a). */
  readonly kind: 'machine_observation';
}

/** The two display surfaces the evaluator filters by (prompt §2.1 signature). */
export type ObservationMappingSurface = 'card' | 'timeline';

export interface EvaluateObservationMappingOptions {
  readonly surface: ObservationMappingSurface;
}
