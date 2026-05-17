// Dev-only types for CDiscourse argument fixture scenarios.
// No secrets, no real user data. Safe to commit.

export type ScenarioCategory =
  | 'sports'
  | 'pop_culture'
  | 'light_civic'
  | 'everyday'
  // Stage 6.1.3 stress-test categories
  | 'animal_taxonomy_weird'
  | 'sports_hot_takes'
  | 'pop_culture_hot_takes'
  | 'everyday_absurd'
  | 'technology_everyday'
  | 'food_low_stakes'
  | 'design_product';

export type PersonaTone = 'calm' | 'playful' | 'skeptical' | 'conciliatory';

export type FixtureArgumentSide = 'affirmative' | 'negative' | 'neutral';

export type FixtureMoveKind =
  | 'start_thesis'
  | 'make_claim'
  | 'challenge_parent'
  | 'ask_clarification'
  | 'add_evidence'
  | 'concede_or_narrow'
  | 'synthesize_thread';

export type FixtureArgumentType =
  | 'thesis'
  | 'claim'
  | 'rebuttal'
  | 'counter_rebuttal'
  | 'evidence'
  | 'clarification_request'
  | 'concession'
  | 'synthesis';

export type FixtureDisagreementAxis =
  | 'fact'
  | 'definition'
  | 'causal'
  | 'value'
  | 'evidence'
  | 'logic'
  | 'scope';

export interface FixturePersona {
  alias: string;
  side: FixtureArgumentSide;
  tone: PersonaTone;
}

export interface FixtureEvidence {
  url?: string;
  label?: string;
  sourceText?: string;
}

export interface FixtureDisplayMeta {
  /** Friendly copy shown in UI — never affects internal codes. */
  playfulLabel?: string;
  /** Sentence or phrase in this move's body that is a good quote anchor candidate. */
  quoteAnchorCandidate?: string;
  /** Marks a move that is intentionally a branch/tangent anchor (stress fixtures). */
  branchCandidate?: boolean;
}

export interface FixtureMove {
  moveId: string;
  authorAlias: string;
  parentMoveId: string | null;
  moveKind: FixtureMoveKind;
  qualifierCode?: string | null;
  argumentType: FixtureArgumentType;
  disagreementAxis?: FixtureDisagreementAxis | null;
  /** Quote from parent body. Must appear verbatim in parent.body if parent exists. */
  targetExcerpt?: string | null;
  body: string;
  selectedTagCodes: string[];
  evidence?: FixtureEvidence | null;
  expectedStatus: string;
  /** Expected game resting status after this move is applied. */
  expectedRestingStatus?: string | null;
  /** Expected claim standing after this move is applied. */
  expectedClaimStanding?: string | null;
  displayMeta?: FixtureDisplayMeta;
}

export interface FixtureScenario {
  scenarioId: string;
  title: string;
  resolution: string;
  category: ScenarioCategory;
  personas: FixturePersona[];
  moves: FixtureMove[];
  expectedFlags: string[];
  expectedTopicChecks: string[];
  expectedTurnStatuses: string[];
  /** Final expected resting status of the room after all moves. */
  expectedFinalRestingStatus?: string;
  /** Final expected claim standing of the root claim after all moves. */
  expectedFinalClaimStanding?: string;
  /** True if a tangent/branch candidate exists in the scenario. */
  hasBranchCandidate?: boolean;
  notes: string;
}
