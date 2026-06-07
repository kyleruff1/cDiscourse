/**
 * NAV-START-ARGUMENT-001 Slice A — Start Argument framing taxonomy.
 *
 * Pure TypeScript. NO React, NO Supabase, NO network, NO AI imports.
 * Deterministic constants + types, unit-testable in isolation.
 *
 * ─────────────────────────────────────────────────────────────────
 * WHAT THIS IS (doctrine boundary):
 *
 * These options are SELF-DECLARED FRAMING METADATA the user chooses
 * about THEIR OWN opening move. They are NOT:
 *   - a machine classification of the message,
 *   - a validity / correctness / verdict judgment,
 *   - an input to scoring, point standing, or the rules engine.
 *
 * The Constitution rules engine (`src/lib/constitution/engine.ts`) stays
 * the sole submission gate. None of these selections influence whether a
 * move is accepted. They are author-facing framing labels only, surfaced
 * so the author can describe how they intend their own argument — they
 * never describe another person and never declare anyone right or wrong.
 *
 * Every label + description below is neutral, non-verdict copy. A ban-list
 * test asserts no verdict / suppression / moderation vocabulary leaks in.
 * ─────────────────────────────────────────────────────────────────
 *
 * Provenance of the option sets:
 *   - ARGUMENT_SCHEME_OPTIONS — a SMALL VERIFIED SUBSET of Walton-style
 *     argumentation schemes. The five named schemes are verified; we do
 *     NOT claim to enumerate the full scheme catalogue.
 *   - DISAGREEMENT_STRATEGY_OPTIONS — VERIFIED HiTODS strategy names only.
 *     HiTODS defines 18 strategies; this module ships only the verified
 *     subset and explicitly marks itself as NOT the complete 18-strategy
 *     list (see `DISAGREEMENT_STRATEGY_LIST_IS_COMPLETE`).
 *   - DISAGREEMENT_CAUSE_OPTIONS — three cause families (informant /
 *     information / uncertainty) describing WHY people might disagree.
 */

// ── Surface (drives the landing route after creation) ─────────────

/**
 * Which in-room board the author lands on after creating the room. The
 * SAME underlying argument record is created either way — the surface only
 * selects the view the author opens into:
 *   - `timeline` → the Timeline map view
 *   - `card`     → the focused card-inspection view
 */
export type StartArgumentSurface = 'timeline' | 'card';

export const ALL_START_ARGUMENT_SURFACES: ReadonlyArray<StartArgumentSurface> =
  Object.freeze(['timeline', 'card']);

// ── Argument scheme ───────────────────────────────────────────────

export type ArgumentSchemeId =
  | 'argument_from_example'
  | 'argument_from_cause_to_effect'
  | 'practical_reasoning'
  | 'argument_from_consequences'
  | 'argument_from_verbal_classification'
  | 'unspecified';

export interface TaxonomyOption<TId extends string> {
  /** Stable internal id — never shown raw to a user. */
  id: TId;
  /** User-facing label. Neutral, non-verdict. */
  label: string;
  /** User-facing one-line description. Neutral, non-verdict. */
  description: string;
}

/**
 * Verified Walton-style argumentation schemes (a SUBSET — not the full
 * catalogue). Plus the always-available `unspecified` "decide later".
 */
export const ARGUMENT_SCHEME_OPTIONS: ReadonlyArray<TaxonomyOption<ArgumentSchemeId>> =
  Object.freeze([
    {
      id: 'argument_from_example',
      label: 'Argument from example',
      description: 'Uses a particular case to support a broader pattern or generalization.',
    },
    {
      id: 'argument_from_cause_to_effect',
      label: 'Argument from cause to effect',
      description: 'Uses a cause, condition, or event to reason about a likely effect.',
    },
    {
      id: 'practical_reasoning',
      label: 'Practical reasoning',
      description: 'Connects a goal to an action that may help achieve it.',
    },
    {
      id: 'argument_from_consequences',
      label: 'Argument from consequences',
      description: 'Uses expected good or bad outcomes to support or oppose an action.',
    },
    {
      id: 'argument_from_verbal_classification',
      label: 'Argument from classification',
      description: 'Classifies a case by connecting its properties to a category.',
    },
    {
      id: 'unspecified',
      label: 'Not sure / decide later',
      description: 'Start without choosing an argument type.',
    },
  ]);

// ── Disagreement cluster + strategy (HiTODS, verified subset) ─────

export type DisagreementCluster =
  | 'high_responsiveness'
  | 'reasoned_low_threat'
  | 'low_responsiveness'
  | 'face_threatening_low_productivity';

export const DISAGREEMENT_CLUSTER_LABELS: Readonly<Record<DisagreementCluster, string>> =
  Object.freeze({
    high_responsiveness: 'Constructive disagreement',
    reasoned_low_threat: 'Reasoned low-threat disagreement',
    low_responsiveness: 'Low-responsiveness disagreement',
    face_threatening_low_productivity: 'High-friction disagreement',
  });

export const ALL_DISAGREEMENT_CLUSTERS: ReadonlyArray<DisagreementCluster> = Object.freeze([
  'high_responsiveness',
  'reasoned_low_threat',
  'low_responsiveness',
  'face_threatening_low_productivity',
]);

export type DisagreementStrategyId =
  | 'complex_counter_argument'
  | 'dismantle'
  | 'related_joking'
  | 'reasoned_direct_denial'
  | 'proposing_alternative'
  | 'deafening_silence'
  | 'agree_to_disagree'
  | 'breakdown_of_dialogicity'
  | 'unreasoned_direct_denial'
  | 'ordering'
  | 'irrelevancy_claim'
  | 'ironic_echoing'
  | 'blatant_or_aggressive_denial'
  | 'unspecified';

export interface DisagreementStrategyOption extends TaxonomyOption<DisagreementStrategyId> {
  /** The HiTODS cluster this verified strategy belongs to. */
  cluster: DisagreementCluster;
}

/**
 * VERIFIED HiTODS strategy names ONLY. HiTODS defines an 18-strategy
 * taxonomy; this list ships only the verified names plus the always-
 * available `unspecified` "decide later". It is intentionally NOT the
 * complete 18-strategy enumeration — see
 * `DISAGREEMENT_STRATEGY_LIST_IS_COMPLETE`.
 */
export const DISAGREEMENT_STRATEGY_OPTIONS: ReadonlyArray<DisagreementStrategyOption> =
  Object.freeze([
    {
      id: 'complex_counter_argument',
      cluster: 'high_responsiveness',
      label: 'Complex counter-argument',
      description: 'Detailed, grounded reasoning that addresses the other argument.',
    },
    {
      id: 'dismantle',
      cluster: 'high_responsiveness',
      label: 'Dismantle',
      description: 'Separately addresses parts of the other argument to challenge its reasoning.',
    },
    {
      id: 'related_joking',
      cluster: 'high_responsiveness',
      label: 'Related joking / tension release',
      description: 'Uses humor while staying connected to the disagreement.',
    },
    {
      id: 'reasoned_direct_denial',
      cluster: 'reasoned_low_threat',
      label: 'Reasoned direct denial',
      description: 'Direct disagreement supported by some reason.',
    },
    {
      id: 'proposing_alternative',
      cluster: 'reasoned_low_threat',
      label: 'Proposing an alternative',
      description: 'Offers another possible explanation, framing, or action.',
    },
    {
      id: 'deafening_silence',
      cluster: 'reasoned_low_threat',
      label: 'Silence / non-response',
      description: 'Disagreement, pause, or withdrawal expressed through non-response.',
    },
    {
      id: 'agree_to_disagree',
      cluster: 'low_responsiveness',
      label: 'Agree to disagree',
      description: 'Ends or suspends the exchange without resolving the issue.',
    },
    {
      id: 'breakdown_of_dialogicity',
      cluster: 'low_responsiveness',
      label: 'Breakdown of dialogicity',
      description: "Fails to engage the other speaker's core argument.",
    },
    {
      id: 'unreasoned_direct_denial',
      cluster: 'low_responsiveness',
      label: 'Unreasoned direct denial',
      description: 'Rejects a claim without meaningful support.',
    },
    {
      id: 'ordering',
      cluster: 'face_threatening_low_productivity',
      label: 'Ordering',
      description: 'Uses directive language that may heighten friction.',
    },
    {
      id: 'irrelevancy_claim',
      cluster: 'face_threatening_low_productivity',
      label: 'Irrelevancy claim',
      description: 'Dismisses the other argument as irrelevant.',
    },
    {
      id: 'ironic_echoing',
      cluster: 'face_threatening_low_productivity',
      label: 'Ironic echoing',
      description: 'Echoes the other argument with ironic or aggravating force.',
    },
    {
      id: 'blatant_or_aggressive_denial',
      cluster: 'face_threatening_low_productivity',
      label: 'Blatant or aggressive denial',
      description: 'Rejects the other position with high friction and little productive engagement.',
    },
    {
      id: 'unspecified',
      cluster: 'high_responsiveness',
      label: 'Not sure / decide later',
      description: 'Start without choosing a disagreement strategy.',
    },
  ]);

/**
 * HONESTY FLAG: this is NOT the complete 18-strategy HiTODS list.
 *
 * We ship only the VERIFIED strategy names. A test asserts this flag is
 * `false` and that the verified-id set matches exactly, so the module can
 * never silently over-claim full HiTODS coverage if more names are added
 * without re-verification.
 */
export const DISAGREEMENT_STRATEGY_LIST_IS_COMPLETE = false;

/** Total strategy count HiTODS defines (for the honesty assertion only). */
export const HITODS_TOTAL_STRATEGY_COUNT = 18;

/** The verified strategy ids (excluding `unspecified`, the UI escape hatch). */
export const VERIFIED_DISAGREEMENT_STRATEGY_IDS: ReadonlyArray<DisagreementStrategyId> =
  Object.freeze([
    'complex_counter_argument',
    'dismantle',
    'related_joking',
    'reasoned_direct_denial',
    'proposing_alternative',
    'deafening_silence',
    'agree_to_disagree',
    'breakdown_of_dialogicity',
    'unreasoned_direct_denial',
    'ordering',
    'irrelevancy_claim',
    'ironic_echoing',
    'blatant_or_aggressive_denial',
  ]);

// ── Disagreement cause ────────────────────────────────────────────

export type DisagreementCauseId =
  | 'informant_related'
  | 'information_related'
  | 'uncertainty_related'
  | 'unspecified';

export const DISAGREEMENT_CAUSE_OPTIONS: ReadonlyArray<TaxonomyOption<DisagreementCauseId>> =
  Object.freeze([
    {
      id: 'informant_related',
      label: 'Informant-related',
      description:
        'Disagreement may come from who is speaking, their expertise, incentives, trustworthiness, role, or perspective.',
    },
    {
      id: 'information_related',
      label: 'Information-related',
      description:
        'Disagreement may come from different evidence, definitions, interpretations, sources, or claims.',
    },
    {
      id: 'uncertainty_related',
      label: 'Uncertainty-related',
      description:
        'Disagreement may come from complexity, incomplete evidence, probability, changing knowledge, or unresolved uncertainty.',
    },
    {
      id: 'unspecified',
      label: 'Not sure / decide later',
      description: 'Start without choosing a cause.',
    },
  ]);

// ── Draft shape ───────────────────────────────────────────────────

/**
 * The author's self-declared opening framing. `declaration` is required;
 * `initialSurface` chooses the landing view; the three taxonomy fields are
 * OPTIONAL framing metadata (default `unspecified` / undefined). None of
 * these fields gate submission — the rules engine does.
 */
export interface StartArgumentDraft {
  declaration: string;
  initialSurface: StartArgumentSurface;
  argumentScheme?: ArgumentSchemeId;
  disagreementStrategy?: DisagreementStrategyId;
  disagreementCause?: DisagreementCauseId;
}

// ── Helpers ───────────────────────────────────────────────────────

/** True when the declaration has at least one non-whitespace character. */
export function isStartArgumentDraftSubmittable(
  draft: Pick<StartArgumentDraft, 'declaration'>,
): boolean {
  return draft.declaration.trim().length > 0;
}

/**
 * Group the verified disagreement-strategy options by their HiTODS cluster,
 * preserving option order within each cluster. Used by the page to render
 * the strategy selector under cluster headings. Pure — derives from the
 * frozen option list only.
 */
export function groupDisagreementStrategiesByCluster(): ReadonlyArray<{
  cluster: DisagreementCluster;
  clusterLabel: string;
  options: ReadonlyArray<DisagreementStrategyOption>;
}> {
  return ALL_DISAGREEMENT_CLUSTERS.map((cluster) => ({
    cluster,
    clusterLabel: DISAGREEMENT_CLUSTER_LABELS[cluster],
    options: DISAGREEMENT_STRATEGY_OPTIONS.filter((o) => o.cluster === cluster),
  }));
}
