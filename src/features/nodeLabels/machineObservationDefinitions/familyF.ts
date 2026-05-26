/**
 * MCP-021A — Family F (critical_question) definitions.
 *
 * Per design §3.6: 14 entries total. 0 existing + 14 NEW.
 * All defaultSurface 'inspect', disposition 'future_source',
 * source: 'ai_classifier'.
 *
 * BINDING doctrine for every Family F entry (per design §3.6):
 * every entry carries a falsePositiveGuards clause warning against
 * any "this argument is wrong / weak / fallacious" framing in
 * plain-language label / shortLabel / description. Family F flags
 * a CRITICAL QUESTION the move's reasoning has not yet answered;
 * it NEVER asserts the answer is unfavorable.
 *
 * Doctrine anchors per entry:
 *   - cdiscourse-doctrine §10a — critical-question flag is structural;
 *     never a verdict on argument quality.
 *   - Walton (1995, 2008) — every argument scheme has critical
 *     questions that probe its weaknesses without rejecting it.
 *   - MCP-020 audit §"Rejected labels" — this is the structural
 *     sibling to rejected `weak_argument` and `unsupported_claim`
 *     labels; the critical-question framing is what makes the
 *     surface safe.
 *
 * Confidence eligibility: medium for Inspect (per design §3.6 —
 * these are "absence" claims that need stronger confidence).
 */

import type { MachineObservationDefinition } from '../nodeLabelTypes';

const CRITICAL_INSPECT_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'high',
  selectedContextMinConfidence: 'medium',
  inspectMinConfidence: 'medium',
};

interface CriticalBuilder {
  rawKey: string;
  label: string;
  shortLabel: string;
  description: string;
  priority: number;
  booleanQuestion: string;
  positiveDefinition: string;
  negativeDefinition: string;
  positiveExamples: ReadonlyArray<string>;
  negativeExamples: ReadonlyArray<string>;
  falsePositiveGuards: ReadonlyArray<string>;
  doctrineNotes: ReadonlyArray<string>;
}

function buildCritical(b: CriticalBuilder): MachineObservationDefinition {
  return Object.freeze({
    id: `registry:machine_observation:ai_classifier:${b.rawKey}`,
    rawKey: b.rawKey,
    kind: 'machine_observation' as const,
    source: 'ai_classifier' as const,
    family: 'critical_question' as const,
    label: b.label,
    shortLabel: b.shortLabel,
    description: b.description,
    defaultSurface: 'inspect' as const,
    disposition: 'future_source' as const,
    priority: b.priority,
    visibleByDefault: false,

    booleanQuestion: b.booleanQuestion,
    positiveDefinition: b.positiveDefinition,
    negativeDefinition: b.negativeDefinition,
    positiveExamples: b.positiveExamples,
    negativeExamples: b.negativeExamples,
    falsePositiveGuards: b.falsePositiveGuards,
    doctrineNotes: b.doctrineNotes,
    confidenceEligibility: CRITICAL_INSPECT_ELIGIBILITY,
  });
}

// Standard doctrine note appended to every entry's falsePositiveGuards:
const COMMON_DOCTRINE_GUARD =
  'Do NOT mark TRUE as a verdict on argument quality; absence of an explicit X does not mean the argument is wrong. The critical question opens a productive inquiry, never a fault.';

export const FAMILY_F_DEFINITIONS: ReadonlyArray<MachineObservationDefinition> = Object.freeze([
  buildCritical({
    rawKey: 'missing_warrant',
    label: 'Warrant not explicit',
    shortLabel: 'Warrant?',
    description: "The reasoning link between this move's grounds and its claim is not explicit.",
    priority: 250,
    booleanQuestion:
      'Does this move present a claim + grounds without making the warrant (the rule licensing claim from grounds) explicit?',
    positiveDefinition:
      "The move provides grounds (data / evidence / examples) and a claim, but the reasoning link between them is implicit. A reader could reasonably ask 'WHY does that ground support that claim?'.",
    negativeDefinition:
      '(a) Grounds + explicit warrant present, OR (b) pure question / clarification / paraphrase, OR (c) claim trivially entailed by ground, OR (d) pure value claim without empirical ground.',
    positiveExamples: Object.freeze([
      "Move: 'Crime dropped 30% since 2010 (FBI UCR) → therefore policing reform works.' (ground = data; claim = causal; warrant = ?)",
      "Move: 'Pittsburgh increased library funding and literacy rose → libraries cause literacy.' (no warrant for the causal inference)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Crime dropped after policy X — and the timing matches the rollout in 12 of 12 measured cities, with no other major intervention overlapping.' (warrant: timing + scope matching)",
      "Move: 'What do you mean by reform?' (pure question, no warrant required)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE just because the move is short; brevity is not absence-of-warrant.',
      'Do NOT mark TRUE for moves where the warrant is implicit-but-obvious (e.g., counting cases entails the count).',
      'Do NOT mark TRUE for value-claims that do not require an empirical warrant.',
      COMMON_DOCTRINE_GUARD,
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: missing-warrant observation NEVER implies the claim is false or unsupported.',
      "Plain-language framing: 'what would warrant this claim?', NEVER 'this claim is unwarranted'.",
      'Toulmin (1958): warrant is the rule licensing claim from grounds; absence of an explicit warrant is normal in compressed natural-language argumentation.',
      'MCP-020 audit §Rejected labels: structural sibling of `weak_argument` (rejected); critical-question framing is what makes this safe.',
    ]),
  }),

  buildCritical({
    rawKey: 'unstated_assumption',
    label: 'Unstated assumption',
    shortLabel: 'Assump?',
    description: 'This move relies on an assumption it does not state.',
    priority: 251,
    booleanQuestion:
      "Does this move's reasoning depend on an assumption that the move does not explicitly state?",
    positiveDefinition:
      "The move's reasoning requires a premise to hold, but the premise is not stated in the move. Identifying the assumption opens productive inquiry.",
    negativeDefinition:
      'The move states all premises explicitly, the move is a pure question / paraphrase, or the move uses a premise that is universally shared in the context.',
    positiveExamples: Object.freeze([
      "Move: 'EVs reduce pollution because they are electric.' (assumes the grid that powers them is cleaner)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'EVs reduce pollution if charged on a grid with <500g CO2/kWh — which most US grids are.' (assumption made explicit)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for assumptions that are universally shared and need not be stated.',
      'Do NOT mark TRUE for moves whose assumption is in the parent move.',
      COMMON_DOCTRINE_GUARD,
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: surfacing assumptions is productive; never implies bad faith.',
      'Toulmin (1958): backing — implicit premises are a normal feature of warrants.',
    ]),
  }),

  buildCritical({
    rawKey: 'authority_basis_missing',
    label: 'Authority basis missing',
    shortLabel: 'Auth?',
    description: 'This move appeals to an authority without grounding the appeal.',
    priority: 252,
    booleanQuestion:
      "Does this move appeal to an authority without naming the authority's specific expertise or basis for the claim at hand?",
    positiveDefinition:
      "The move cites 'experts say' / 'scientists agree' / 'leading economists' without naming who or what backs the appeal. Walton's critical question for the authority scheme.",
    negativeDefinition:
      'The move names the specific authority and the relevant expertise, OR does not use authority reasoning at all, OR cites the authority alongside the specific evidence the authority used.',
    positiveExamples: Object.freeze([
      "Move: 'Experts agree that this policy works.' (which experts; what is their basis?)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'The IPCC AR6 Working Group I (climate science) concludes that anthropogenic emissions are the dominant warming driver.' (specific authority + relevant expertise)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that name the authority and its expertise.',
      'Do NOT mark TRUE for moves that cite specific evidence alongside the authority.',
      COMMON_DOCTRINE_GUARD,
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: surfacing unsourced authority appeals is productive.',
      'Walton (1995): critical question for the expert authority scheme.',
    ]),
  }),

  buildCritical({
    rawKey: 'causal_mechanism_missing',
    label: 'Causal mechanism missing',
    shortLabel: 'Mech?',
    description: 'This move claims causation without proposing a mechanism.',
    priority: 253,
    booleanQuestion:
      'Does this move claim cause-and-effect without proposing a mechanism that explains how the cause produces the effect?',
    positiveDefinition:
      'The move asserts X causes Y but does not propose HOW: through what process, what intermediate steps. Walton critical question for causal scheme.',
    negativeDefinition:
      'The move proposes a mechanism (X causes Y through the process P), OR notes correlation without claiming causation, OR uses non-causal reasoning.',
    positiveExamples: Object.freeze([
      "Move: 'Library funding causes literacy gains.' (no mechanism proposed)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Library funding causes literacy gains through expanded program hours, more staff for tutoring, and broader book access.' (mechanism proposed)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that propose any mechanism (even hedged ones).',
      'Do NOT mark TRUE for moves that note correlation without claiming causation.',
      COMMON_DOCTRINE_GUARD,
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: surfacing unstated mechanism is productive critical question.',
      'Walton (1995): critical question for causal scheme.',
    ]),
  }),

  buildCritical({
    rawKey: 'analogy_mapping_missing',
    label: 'Analogy mapping missing',
    shortLabel: 'Map?',
    description: 'This move uses an analogy without specifying the mapping.',
    priority: 254,
    booleanQuestion:
      "Does this move use an analogy without specifying WHICH features of the source case map to the target case?",
    positiveDefinition:
      "The move draws an analogy (X is like Y) but does not specify what features of Y bear on X. Walton critical question for analogy scheme.",
    negativeDefinition:
      'The move specifies the mapping (X is like Y in respect R, which is relevant because...), OR does not use analogy at all.',
    positiveExamples: Object.freeze([
      "Move: 'Misinformation is like spam.' (no mapping specified — which features of spam?)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Misinformation is like spam in that both spread virally and respond to filtering at the platform layer; both have unclear cases at the margin.' (mapping specified)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that specify the mapping briefly.',
      'Do NOT mark TRUE for moves that do not use analogy.',
      COMMON_DOCTRINE_GUARD,
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: surfacing unmapped analogy is productive critical question.',
      'Walton (1995): critical question for analogy scheme.',
    ]),
  }),

  buildCritical({
    rawKey: 'example_representativeness_unclear',
    label: 'Example representativeness unclear',
    shortLabel: 'Rep?',
    description: 'This move uses examples without showing they are representative.',
    priority: 255,
    booleanQuestion:
      'Does this move use examples to support a generalization without showing the examples are representative of the relevant population?',
    positiveDefinition:
      "The move cites examples but does not address whether the examples generalize: 'Pittsburgh and Detroit show X' (do they?). Walton critical question for example scheme.",
    negativeDefinition:
      'The move addresses representativeness (cites that the examples are typical, or notes selection criteria), OR uses single-case reasoning, OR does not use example reasoning.',
    positiveExamples: Object.freeze([
      "Move: 'Pittsburgh, Detroit, and Indianapolis all show library funding boosts literacy.' (does this generalize?)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'In 12 of 15 mid-size US cities with sustained funding increases, literacy rose; the 3 outliers had concurrent program changes.' (representativeness addressed)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that address selection criteria.',
      'Do NOT mark TRUE for moves that note their examples are illustrative not exhaustive.',
      COMMON_DOCTRINE_GUARD,
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: surfacing unaddressed representativeness is productive.',
      'Walton (1995): critical question for example scheme.',
    ]),
  }),

  buildCritical({
    rawKey: 'consequence_probability_unclear',
    label: 'Consequence probability unclear',
    shortLabel: 'Prob?',
    description: 'This move predicts consequences without addressing their probability.',
    priority: 256,
    booleanQuestion:
      'Does this move predict consequences without addressing the probability that those consequences will occur?',
    positiveDefinition:
      "The move predicts an outcome ('X will lead to Y') without giving any sense of how likely Y is. Walton critical question for consequence + slippery-slope schemes.",
    negativeDefinition:
      "The move addresses probability (cites studies, gives base rates, hedges with modal language), OR is descriptive rather than predictive.",
    positiveExamples: Object.freeze([
      "Move: 'Carbon taxes will reduce emissions.' (how likely? by how much?)",
      "Move: 'If we ban X, that will normalize censorship.' (slippery-slope; probability of each step unaddressed)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Carbon taxes have reduced emissions in 12 of 15 cases with stable enforcement, by 5-10% over 5 years.' (probability addressed)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that hedge appropriately (probably, may, tends to).',
      'Do NOT mark TRUE for moves that are descriptive rather than predictive.',
      COMMON_DOCTRINE_GUARD,
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: surfacing unaddressed probability is productive critical question.',
      'Walton (1995): critical question for consequence + slippery-slope schemes.',
    ]),
  }),

  buildCritical({
    rawKey: 'definition_boundary_unclear',
    label: 'Definition boundary unclear',
    shortLabel: 'Bound?',
    description: 'This move applies a definition without showing the case fits within boundaries.',
    priority: 257,
    booleanQuestion:
      'Does this move apply a definition to a case without showing the case clearly falls within the definition\'s boundaries?',
    positiveDefinition:
      "The move applies a definition but the boundary case is debatable: 'libraries are infrastructure' — is this case clearly within the definition? Walton critical question for definition scheme.",
    negativeDefinition:
      'The move addresses the boundary explicitly (cites why the case fits), OR uses a clear case, OR does not use definition reasoning.',
    positiveExamples: Object.freeze([
      "Move: 'AI hiring tools fall under employment discrimination law.' (boundary unclear — is this clearly within?)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'AI hiring tools that produce disparate-impact outcomes fall under Title VII per the 1991 amendments and recent EEOC guidance, which explicitly contemplates this case.' (boundary addressed)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that address the boundary case.',
      'Do NOT mark TRUE for moves using clear cases at the definition\'s core.',
      COMMON_DOCTRINE_GUARD,
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: surfacing boundary cases is productive.',
      'Walton (1995): critical question for definition scheme.',
    ]),
  }),

  buildCritical({
    rawKey: 'criterion_weighting_unclear',
    label: 'Criterion weighting unclear',
    shortLabel: 'Weight?',
    description: 'This move applies multiple criteria without showing how they are weighted.',
    priority: 258,
    booleanQuestion:
      'Does this move apply multiple decision criteria without showing how they are weighted against each other?',
    positiveDefinition:
      "The move invokes more than one criterion (cost AND effectiveness; equity AND efficiency) but does not say how to weight them when they conflict.",
    negativeDefinition:
      'The move addresses the weighting (provides a weighting rule), OR uses a single criterion, OR does not invoke decision criteria.',
    positiveExamples: Object.freeze([
      "Move: 'Library funding should be cost-effective AND equitable.' (how weighted when they conflict?)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Library funding should be cost-effective subject to a minimum equity floor of equal per-capita access in lowest-income quintiles.' (weighting rule given)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that address the weighting rule.',
      'Do NOT mark TRUE for moves using a single criterion.',
      COMMON_DOCTRINE_GUARD,
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: surfacing weighting ambiguity is productive.',
      'Walton (1995): critical question for classification + decision-criterion schemes.',
    ]),
  }),

  buildCritical({
    rawKey: 'alternative_explanation_available',
    label: 'Alternative explanation available',
    shortLabel: 'Alt expl?',
    description: 'This move infers a cause without addressing alternative explanations.',
    priority: 259,
    booleanQuestion:
      'Does this move infer a cause from observed effects without addressing plausible alternative explanations?',
    positiveDefinition:
      "The move infers cause from effect (abductive reasoning) but does not address alternatives that could account for the same effect. Standard critical question for abductive reasoning.",
    negativeDefinition:
      'The move addresses alternatives (rules them out, weighs them), OR does not use abductive reasoning, OR uses controlled comparison that addresses confounds.',
    positiveExamples: Object.freeze([
      "Move: 'Library funding rose, then literacy rose — funding caused the gain.' (what about concurrent school improvements? demographic shifts?)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Library funding rose, then literacy rose. The only other major change was budget growth, but that did not flow to schools in this period — the library effect is most parsimonious.' (alternatives addressed)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that address alternatives.',
      'Do NOT mark TRUE for moves using controlled comparison.',
      COMMON_DOCTRINE_GUARD,
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: surfacing unaddressed alternatives is productive.',
      'Peirce: critical question for abductive reasoning.',
    ]),
  }),

  buildCritical({
    rawKey: 'counterexample_available',
    label: 'Counterexample available',
    shortLabel: 'CE?',
    description: 'This move advances a generalization where counterexamples are known.',
    priority: 260,
    booleanQuestion:
      'Does this move advance a generalization where there are known counterexamples not addressed in the move?',
    positiveDefinition:
      'The move makes a generalization (X is universally true, X always happens) but a counterexample exists in the public record. Standard critical question for generalization claims.',
    negativeDefinition:
      "The move addresses known counterexamples (rules them out, explains them as edge cases), OR avoids generalization, OR no known counterexamples exist.",
    positiveExamples: Object.freeze([
      "Move: 'Carbon taxes always reduce emissions.' (the Australia repeal case is a known counterexample)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Carbon taxes reduce emissions in jurisdictions where they remain in place; the Australia case shows the political-durability boundary.' (counterexample addressed)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that address counterexamples.',
      'Do NOT mark TRUE for moves that hedge appropriately.',
      COMMON_DOCTRINE_GUARD,
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: surfacing unaddressed counterexamples is productive.',
    ]),
  }),

  buildCritical({
    rawKey: 'scope_limit_unstated',
    label: 'Scope limit unstated',
    shortLabel: 'Scope?',
    description: 'This move makes a claim without stating its scope limits.',
    priority: 261,
    booleanQuestion:
      'Does this move make a claim without stating the population, time window, or setting limits within which the claim holds?',
    positiveDefinition:
      "The move states a claim without scope qualifiers: 'X is true' (everywhere? always? for all people?). Pairs with Family H claim_specificity_low.",
    negativeDefinition:
      "The move scopes the claim explicitly (in cities of >100K; over the 2015-2020 window; for non-emergency contexts), OR makes a universal claim that is genuinely intended as universal.",
    positiveExamples: Object.freeze([
      "Move: 'EVs reduce pollution.' (everywhere? always? all EVs? all pollution?)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'EVs reduce urban tailpipe pollution in cities with EV share >20% over 2018-2023.' (scope stated)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves with explicit scope qualifiers.',
      'Do NOT mark TRUE for moves whose scope is implied by the topic.',
      COMMON_DOCTRINE_GUARD,
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: surfacing scope ambiguity is productive; pairs with Family H claim_specificity_low.',
      'Toulmin (1958): qualifier — scope is a form of qualifier.',
    ]),
  }),

  buildCritical({
    rawKey: 'qualification_missing',
    label: 'Qualification missing',
    shortLabel: 'Qual?',
    description: 'This move makes an unqualified claim where qualification would be appropriate.',
    priority: 262,
    booleanQuestion:
      'Does this move state a claim without modal qualification ("usually", "often", "in most cases") in a context where the underlying evidence supports only qualified claims?',
    positiveDefinition:
      'The move asserts a claim categorically (X is Y) but the evidence base supports only qualified versions (X is usually Y; X is Y in most cases). Pairs with Family H modal_language_present (positive structural counterpart).',
    negativeDefinition:
      'The move uses modal language appropriately, OR the underlying claim is genuinely categorical (definitional, mathematical).',
    positiveExamples: Object.freeze([
      "Move: 'Library funding boosts literacy.' (the evidence supports 'usually' or 'in mid-size cities' — categorical assertion is over-confident)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Library funding usually boosts literacy in mid-size cities with sustained programs.' (appropriately qualified)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves with appropriate modal language.',
      'Do NOT mark TRUE for genuinely categorical claims (definitions, math).',
      COMMON_DOCTRINE_GUARD,
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: surfacing missing qualification is productive.',
      'Toulmin (1958): qualifier — claims often require modal markers; their absence opens critical inquiry.',
    ]),
  }),

  buildCritical({
    rawKey: 'comparison_baseline_missing',
    label: 'Comparison baseline missing',
    shortLabel: 'Base?',
    description: 'This move uses a comparison without specifying the baseline.',
    priority: 263,
    booleanQuestion:
      'Does this move use a comparison (better, more, larger, lower) without specifying the baseline of comparison?',
    positiveDefinition:
      "The move says 'X is better' / 'X is larger' / 'X is more effective' without naming what X is being compared to.",
    negativeDefinition:
      "The move specifies the baseline (X is more effective than Y; X is larger than the 2019 baseline), OR uses absolute claims that do not require comparison.",
    positiveExamples: Object.freeze([
      "Move: 'Carbon taxes are more effective.' (more than what?)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Carbon taxes are more effective than cap-and-trade in jurisdictions with weak enforcement capacity.' (baseline specified)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that specify the baseline.',
      'Do NOT mark TRUE for moves using absolute claims.',
      COMMON_DOCTRINE_GUARD,
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: surfacing missing baseline is productive structural critical question.',
    ]),
  }),
]);
