// Dev-only types for CDiscourse argument fixture scenarios.
// No secrets, no real user data. Safe to commit.

export type ScenarioCategory = 'sports' | 'pop_culture' | 'light_civic' | 'everyday';

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
  notes: string;
}
