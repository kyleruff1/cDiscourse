/**
 * REF-002 — Open Issue model (the Disagreement Contract derivation).
 *
 * Pure TypeScript. No React. No Supabase. No network. No AI. No `Date.now`.
 *
 * Given the already-derived seams for ONE selected node — its lifecycle
 * state + axis, evidence debt, source-chain status, manual/auto metadata,
 * machine Observations, user Allegations, the seeded referee banner, the
 * suggested-moves input, and the Act-popout gate inputs — this model
 * derives ONE turn-level reading: the Open Issue (`DisagreementContract`)
 * — `relation · axis · burden · state · referee observation · next-best
 * moves` — deterministically, and emits no block.
 *
 * Doctrine that shapes every line (cdiscourse-doctrine §1/§4/§5/§9/§10a;
 * REF-001 ratified `fe35812`; operator ratification constraints 1–5):
 *   - The deterministic Constitution engine is the SOLE submission gate;
 *     this model is CONSULTATIVE, runs only AFTER an argument is stored,
 *     never re-validates or contradicts the engine, and emits no
 *     block/reject/route/delay.
 *   - `nextBestMoves` is always a SUBSET of the engine + role-gate
 *     survivors (`buildActPopout`), so the card can never present a button
 *     the engine would reject.
 *   - No emitted user-facing string carries a verdict / winner / loser /
 *     truth / person token; relation + state describe the MOVE's gameplay
 *     state, never its truth.
 *   - Heat / popularity / engagement / virality / standing bands are NEVER
 *     an input.
 *   - Machine Observations (`refereeObservations`) and user Allegations
 *     (`userAllegations`) stay SEPARATE fields, never merged. Family J
 *     (`sensitive_composer`, `productionEnabled: false`) is re-asserted out
 *     of `refereeObservations` even when a J mark is in the input.
 *   - `replies` is the internal FALLBACK relation only — never preferred
 *     over a more specific procedural relation, never clears a debt, never
 *     surfaces as raw internal copy.
 *   - `fact` is NOT an Open Issue axis; the three distinct `fact` sources
 *     map into the eight procedural axes by remedy/debt.
 *   - v1 is DERIVED-ONLY: no persistence, no migration, no Edge path.
 *
 * The model consumes `BannerSelectionResult` and NEVER calls `selectBanner`
 * — there is exactly one referee banner surface (operator constraint 5).
 */

// ── Type-only domain-union imports (no runtime coupling) ───────────
import type { ArgumentType, ConstitutionRule } from '../../domain/constitution/types';
import type { PointLifecycleState, PointLifecycleAxis } from '../lifecycle';
import type { ManualTagCode, AutoMetadataCode } from '../metadata';
import type { SourceChainStatus } from '../evidence/evidenceModel';
import type { EvidenceDebt, EvidenceDebtKind, EvidenceDebtStatus } from '../evidence/evidenceDebtModel';
import type { ActiveDisagreementKind } from '../concessions/activeDisagreement';
import type { NodeLabelMark, MachineObservationFamily } from '../nodeLabels/nodeLabelTypes';
import type { MoveChannel } from '../arguments/channelModel';
import type { CategoryReading } from '../refereeLedger/types';
import type { BannerSelectionResult } from '../refereeBanners/types';
import type {
  ActEntryId,
  ActViewerRole,
  ActPopoutGroup,
  ActPopoutEntry,
} from '../arguments/oneBox/actPopoutModel';
import type {
  SuggestionDerivationInput,
  SuggestedMoveCode,
} from '../arguments/suggestedMovesModel';

// ── Value imports (all pure / frozen — engine-safe boundaries) ─────
import { OPEN_EVIDENCE_DEBT_STATUSES } from '../evidence/evidenceDebtModel';
import { ALL_MACHINE_OBSERVATION_FAMILIES } from '../nodeLabels/nodeLabelTypes';
import { lookupMachineObservationDefinitionByCompoundKey } from '../nodeLabels/machineObservationDefinitions';
import { HUB_NON_PRODUCTION_FAMILIES } from '../arguments/detail/argumentDetailModel';
import { buildActPopout, flattenActPopout } from '../arguments/oneBox/actPopoutModel';
import { deriveSuggestedMoves } from '../arguments/suggestedMovesModel';

// ════════════════════════════════════════════════════════════════
// Public vocabularies (REF-001 froze these shapes; REF-002 implements)
// ════════════════════════════════════════════════════════════════

/**
 * The 8 Open Issue axes. DISTINCT from the 7-value constitution
 * `DisagreementAxis` (same name, different type) — `fact` is NOT an Open
 * Issue axis; fact-like inputs map into these eight by remedy/debt
 * (operator constraint 3).
 */
export type DisagreementAxis =
  | 'evidence'
  | 'definition'
  | 'scope'
  | 'causal'
  | 'logic'
  | 'value'
  | 'framing'
  | 'process';

/** The 9 relation values. `replies` is the internal FALLBACK. */
export type RelationToParent =
  | 'supports'
  | 'challenges'
  | 'asks_source'
  | 'asks_quote'
  | 'narrows'
  | 'branches'
  | 'concedes'
  | 'synthesizes'
  | 'replies';

/** The 5 open-task burdens. */
export type IssueBurden =
  | 'source_owed'
  | 'quote_owed'
  | 'reply_owed'
  | 'clarification_owed'
  | 'none';

/** The 8 Open Issue states. */
export type IssueState =
  | 'open'
  | 'answered'
  | 'source_requested'
  | 'quote_requested'
  | 'narrowed'
  | 'conceded'
  | 'synthesis_ready'
  | 'moved_on';

/** Frozen enumerations — tests + REF-003 iterate these. */
export const ALL_DISAGREEMENT_AXES: ReadonlyArray<DisagreementAxis> = Object.freeze([
  'evidence',
  'definition',
  'scope',
  'causal',
  'logic',
  'value',
  'framing',
  'process',
]);

export const ALL_RELATIONS_TO_PARENT: ReadonlyArray<RelationToParent> = Object.freeze([
  'supports',
  'challenges',
  'asks_source',
  'asks_quote',
  'narrows',
  'branches',
  'concedes',
  'synthesizes',
  'replies',
]);

export const ALL_ISSUE_BURDENS: ReadonlyArray<IssueBurden> = Object.freeze([
  'source_owed',
  'quote_owed',
  'reply_owed',
  'clarification_owed',
  'none',
]);

export const ALL_ISSUE_STATES: ReadonlyArray<IssueState> = Object.freeze([
  'open',
  'answered',
  'source_requested',
  'quote_requested',
  'narrowed',
  'conceded',
  'synthesis_ready',
  'moved_on',
]);

// ── Output shapes (REF-001 lines 61–141) ──────────────────────────

export interface IssueObservation {
  /** banner `bannerCode` OR mark `rawKey` — NEVER user-visible raw. */
  sourceCode: string;
  /** plain-language line (banner.headline OR mark.label) — ban-list clean. */
  line: string;
  /** carried from the banner; null when mark-seeded. */
  toneGlyph: 'star' | 'arrow' | 'branch' | null;
  /** always — Allegations live in `userAllegations`. */
  kind: 'machine_observation';
}

export interface IssueAllegation {
  /** USER_ALLEGATION rawKey — NEVER user-visible raw. */
  sourceCode: string;
  /** plain-language label. */
  line: string;
  kind: 'user_allegation';
  visibility: 'public' | 'composer_only' | 'moderator_only';
}

export interface MoveSuggestion {
  /** a surviving ActEntryId, or the branch_tangent recovery entry. */
  actEntryId: ActEntryId;
  /** plain-language button label, read from the Act entry definition. */
  label: string;
  /** verbose a11y label, read from the Act entry definition. */
  accessibilityLabel: string;
  /** true when this replaced a gate-removed suggestion. */
  isRecoveryRoute: boolean;
  /** the recovered `SuggestedMoveCode` — diagnostic only. */
  recoveredFromCode: SuggestedMoveCode | null;
}

export interface DisagreementContract {
  /** `issue:<targetNodeId>:<relation>:<debtKind-or-axis>` — deterministic, never a DB row, never shown raw. */
  id: string;
  roomId: string | null;
  targetNodeId: string | null;
  /** exact quote/excerpt; NEVER AI-summarized. */
  targetQuote: string | null;
  /** deterministic truncation/excerpt; NO AI synthesis. */
  contestedProposition: string;
  axis: DisagreementAxis;
  relationToParent: RelationToParent;
  burden: IssueBurden;
  state: IssueState;
  /** ≤ 1 on the public card; Family J never present. */
  refereeObservations: ReadonlyArray<IssueObservation>;
  /** never merged into Observations. */
  userAllegations: ReadonlyArray<IssueAllegation>;
  /** 2–3; engine + role-gate survivors only. */
  nextBestMoves: ReadonlyArray<MoveSuggestion>;
}

/** Alias REF-001 used throughout. Both names export the same shape. */
export type OpenIssue = DisagreementContract;

// ── Input shape (REF-001 frozen `BuildOpenIssueInput`) ─────────────

export interface BuildOpenIssueInput {
  roomId: string | null;
  targetNodeId: string | null;

  // Relation sources (highest precedence first).
  selectedActEntryId: ActEntryId | null;
  selectedChannel: MoveChannel | null;
  storedArgumentType: ArgumentType | null;
  sameSideAsParent: boolean;
  carriesSupportEvidence: boolean;

  // Act-gate intersection inputs (buildActPopout runs internally).
  parentType: ArgumentType | null;
  viewerRole: ActViewerRole;
  rules: ReadonlyArray<ConstitutionRule>;

  // Axis / burden / state sources.
  lifecycleState: PointLifecycleState | null;
  lifecycleAxis: PointLifecycleAxis | null;
  /** pre-filtered to OPEN_EVIDENCE_DEBT_STATUSES (caller filters). */
  openEvidenceDebts: ReadonlyArray<EvidenceDebt>;
  sourceChainStatus: SourceChainStatus | null;
  manualTags: ReadonlyArray<ManualTagCode>;
  autoMetadata: ReadonlyArray<AutoMetadataCode>;
  activeDisagreementKind: ActiveDisagreementKind | null;

  // Observations / Allegations (production families A–I; J excluded).
  machineObservations: ReadonlyArray<NodeLabelMark>;
  bannerSelection: BannerSelectionResult | null;
  categoryReadings: ReadonlyArray<CategoryReading>;
  userAllegations: ReadonlyArray<NodeLabelMark>;

  // Excerpt sources.
  targetExcerpt: string | null;
  quoteAnchor: string | null;

  // next-best-moves source (passed straight to deriveSuggestedMoves).
  suggestionInput: SuggestionDerivationInput;
}

// ── View-model surface (issue #585 name primary; REF-001 aliased) ──

export interface RefereeCardViewModel {
  zone1RelationLine: string;
  zone1ToneGlyph: 'star' | 'arrow' | 'branch' | null;
  zone2OpenTaskLine: string;
  zone3Moves: ReadonlyArray<MoveSuggestion>;
  refereeNoteSentence: string;
  accessibilityLabel: string;
}

// ════════════════════════════════════════════════════════════════
// Frozen compact copy set (REF-001 §4B/§5 — ban-list-scanned atoms)
// ════════════════════════════════════════════════════════════════

export const RELATION_LABEL: Readonly<Record<RelationToParent, string>> = Object.freeze({
  supports: 'Supports the point',
  challenges: 'Challenges evidence',
  asks_source: 'Asks for source',
  asks_quote: 'Asks for quote',
  narrows: 'Narrows scope',
  branches: 'Branches a side issue',
  concedes: 'Concedes a point',
  synthesizes: 'Ready to synthesize',
  replies: 'Replies to the point',
});

export const BURDEN_LABEL: Readonly<Record<IssueBurden, string>> = Object.freeze({
  source_owed: 'Source owed',
  quote_owed: 'Quote owed',
  reply_owed: 'Reply owed',
  clarification_owed: 'Clarification owed',
  none: 'No open task',
});

export const ISSUE_STATE_LABEL: Readonly<Record<IssueState, string>> = Object.freeze({
  open: 'Open',
  answered: 'Answered',
  source_requested: 'Source requested',
  quote_requested: 'Quote requested',
  narrowed: 'Narrowed',
  conceded: 'Conceded',
  synthesis_ready: 'Ready to synthesize',
  moved_on: 'Moved on',
});

export const AXIS_LABEL: Readonly<Record<DisagreementAxis, string>> = Object.freeze({
  evidence: 'Evidence',
  definition: 'Definition',
  scope: 'Scope',
  causal: 'Cause',
  logic: 'Logic',
  value: 'Value',
  framing: 'Framing',
  process: 'Process',
});

/**
 * Terminal-state lines for zone 2 when `burden === 'none'`. Derived from
 * the frozen `ISSUE_STATE_LABEL` atoms (label + period) — no fresh copy.
 */
export const ISSUE_STATE_TERMINAL_LINE: Readonly<Record<IssueState, string>> = Object.freeze({
  open: 'Open.',
  answered: 'Answered.',
  source_requested: 'Source requested.',
  quote_requested: 'Quote requested.',
  narrowed: 'Narrowed.',
  conceded: 'Conceded.',
  synthesis_ready: 'Ready to synthesize.',
  moved_on: 'Moved on.',
});

// ════════════════════════════════════════════════════════════════
// Frozen derivation maps (REF-001 §4B normalization tables)
// ════════════════════════════════════════════════════════════════

/**
 * Tier 2 — explicit `disagreementAxis`: a specific Family B (`disagreement_axis`)
 * `disputes_*` machine observation → Open Issue axis. The generic
 * `disagreement_present` umbrella is intentionally absent (it falls to tier 5).
 */
const DISPUTES_AXIS_MAP: Readonly<Record<string, DisagreementAxis>> = Object.freeze({
  disputes_definition: 'definition',
  disputes_scope: 'scope',
  disputes_causal_link: 'causal',
  disputes_analogy: 'logic',
  disputes_value_weighting: 'value',
  disputes_decision_criterion: 'value',
  disputes_priority_order: 'value',
  disputes_relevance: 'framing',
  disputes_fact: 'evidence',
  disputes_evidence_applicability: 'evidence',
  disputes_interpretation: 'evidence',
  disputes_generalization: 'evidence',
});

/** Tier 3 — manual tag → axis. */
const MANUAL_TAG_AXIS: Readonly<Partial<Record<ManualTagCode, DisagreementAxis>>> = Object.freeze({
  definition_issue: 'definition',
  scope_issue: 'scope',
  narrowed_claim: 'scope',
  causal_mechanism: 'causal',
  needs_source: 'evidence',
  needs_quote: 'evidence',
  evidence_debt: 'evidence',
  tangent: 'process',
});

/**
 * Tier 4 — lifecycle axis → Open Issue axis. The receiver-stance `fact`
 * maps to EVIDENCE here (operator constraint 3). `unaxed` is intentionally
 * absent (no signal → fall through).
 */
const LIFECYCLE_AXIS_MAP: Readonly<Partial<Record<PointLifecycleAxis, DisagreementAxis>>> = Object.freeze({
  fact: 'evidence',
  evidence: 'evidence',
  source: 'evidence',
  quote: 'evidence',
  definition: 'definition',
  scope: 'scope',
  causal: 'causal',
  value: 'value',
  logic: 'logic',
});

/**
 * Tier 5 — `ActiveDisagreementKind` → axis. The receiver-stance `fact` is
 * issue-focus language, NOT evidence, so it maps to FRAMING (operator
 * constraint 3). `none` is intentionally absent (no signal).
 */
const ACTIVE_DISAGREEMENT_AXIS: Readonly<Partial<Record<ActiveDisagreementKind, DisagreementAxis>>> = Object.freeze({
  framing: 'framing',
  context: 'framing',
  fact: 'framing',
});

/** Relation tier 1 — selected `ActEntryId` → relation. Total. */
const ACT_ENTRY_RELATION: Readonly<Record<ActEntryId, RelationToParent>> = Object.freeze({
  reply: 'replies',
  challenge: 'challenges',
  clarify: 'replies',
  add_evidence: 'supports',
  ask_source: 'asks_source',
  ask_quote: 'asks_quote',
  respond_to_evidence: 'replies',
  narrow: 'narrows',
  concede: 'concedes',
  confirm: 'supports',
  synthesize: 'synthesizes',
  respond_to_concession: 'replies',
  offer_concession: 'concedes',
  branch_tangent: 'branches',
  make_private: 'replies',
  flag: 'replies',
  request_deletion: 'replies',
  view_qualifiers: 'replies',
  watch: 'replies',
  join_for: 'replies',
  join_against: 'replies',
  chime_in: 'replies',
});

/** Relation tier 2 — `MoveChannel` → relation. Total. */
const CHANNEL_RELATION: Readonly<Record<MoveChannel, RelationToParent>> = Object.freeze({
  reply: 'replies',
  challenge: 'challenges',
  clarify: 'replies',
  ask_source: 'asks_source',
  ask_quote: 'asks_quote',
  add_evidence: 'supports',
  narrow: 'narrows',
  concede: 'concedes',
  confirm: 'supports',
  synthesize: 'synthesizes',
  branch_tangent: 'branches',
  meta_process: 'replies',
  evidence_interaction: 'replies',
  mode_specific: 'replies',
});

/** Relation tier 3 — stored `ArgumentType` → relation. Total. */
const ARG_TYPE_RELATION: Readonly<Record<ArgumentType, RelationToParent>> = Object.freeze({
  thesis: 'replies',
  claim: 'replies',
  rebuttal: 'challenges',
  counter_rebuttal: 'challenges',
  evidence: 'supports',
  clarification_request: 'replies',
  concession: 'concedes',
  synthesis: 'synthesizes',
});

/** Relation tier 4 — manual tag → relation. */
const MANUAL_TAG_RELATION: Readonly<Partial<Record<ManualTagCode, RelationToParent>>> = Object.freeze({
  concession_offered: 'concedes',
  narrowed_claim: 'narrows',
  ready_for_synthesis: 'synthesizes',
  tangent: 'branches',
  needs_source: 'asks_source',
  needs_quote: 'asks_quote',
  definition_issue: 'challenges',
  scope_issue: 'challenges',
  causal_mechanism: 'challenges',
  evidence_debt: 'challenges',
});

/** Relation tier 5 — lifecycle state transition → relation. */
const LIFECYCLE_RELATION: Readonly<Partial<Record<PointLifecycleState, RelationToParent>>> = Object.freeze({
  source_requested: 'asks_source',
  quote_requested: 'asks_quote',
  narrowed: 'narrows',
  conceded: 'concedes',
  synthesis_ready: 'synthesizes',
  branch_recommended: 'branches',
  rebutted: 'challenges',
});

/**
 * State step A — the 19-row lifecycle → `IssueState` base map. All 19 live
 * `PointLifecycleState` values are enumerated (operator constraint 4).
 */
const LIFECYCLE_STATE_MAP: Readonly<Record<PointLifecycleState, IssueState>> = Object.freeze({
  open: 'open',
  answered: 'answered',
  rebutted: 'answered',
  clarified: 'answered',
  sourced: 'answered',
  quote_requested: 'quote_requested',
  source_requested: 'source_requested',
  narrowed: 'narrowed',
  conceded: 'conceded',
  confirmed: 'answered',
  synthesis_ready: 'synthesis_ready',
  moved_on_by_affirmative: 'moved_on',
  moved_on_by_negative: 'moved_on',
  ignored_by_affirmative: 'moved_on',
  ignored_by_negative: 'moved_on',
  ignored_by_both: 'moved_on',
  exhausted: 'moved_on',
  branch_recommended: 'moved_on',
  archived_or_resolved: 'answered',
});

/**
 * `SuggestedMoveCode` → `ActEntryId` (REF-001 §"nextBestMoves" Step 1 —
 * exhaustive; test-pinned).
 */
export const SUGGESTED_CODE_TO_ACT_ENTRY: Readonly<Record<SuggestedMoveCode, ActEntryId>> = Object.freeze({
  ask_source: 'ask_source',
  ask_quote: 'ask_quote',
  narrow: 'narrow',
  concede: 'concede',
  confirm: 'confirm',
  challenge_mechanism: 'challenge',
  challenge_scope: 'narrow',
  branch_tangent: 'branch_tangent',
  synthesize: 'synthesize',
});

/**
 * The constructive next-move pool for padding zone 3 (REF-001 trace 1–3
 * "pad with the next survivors"): the codomain of
 * `SUGGESTED_CODE_TO_ACT_ENTRY` ∪ `add_evidence`. `reply` / `clarify` /
 * direct / role entries are NOT padded — the card offers a constructive
 * next move, never a generic reply or a governance action.
 */
const PADDING_POOL: ReadonlySet<ActEntryId> = new Set<ActEntryId>([
  'ask_source',
  'ask_quote',
  'add_evidence',
  'narrow',
  'concede',
  'confirm',
  'challenge',
  'branch_tangent',
  'synthesize',
]);

// ════════════════════════════════════════════════════════════════
// Family-J / sensitive gating (operator constraint; REF-001 §sensitiveSurface)
// ════════════════════════════════════════════════════════════════

/**
 * Production families (A–I) DERIVED as the complement of the
 * `HUB_NON_PRODUCTION_FAMILIES` mirror over `ALL_MACHINE_OBSERVATION_FAMILIES`
 * — never a hard-coded roster, so a registry rename / new family flows
 * through the single mirror constant (mirrors `argumentDetailModel`'s gate).
 */
export const OPEN_ISSUE_PRODUCTION_FAMILIES: ReadonlyArray<MachineObservationFamily> = Object.freeze(
  ALL_MACHINE_OBSERVATION_FAMILIES.filter((f) => !HUB_NON_PRODUCTION_FAMILIES.includes(f)),
);

const PRODUCTION_FAMILY_SET: ReadonlySet<MachineObservationFamily> = new Set(
  OPEN_ISSUE_PRODUCTION_FAMILIES,
);

/** Resolve a mark's family; `'other'` when the (source, rawKey) pair is unknown. */
function resolveMarkFamily(mark: NodeLabelMark): MachineObservationFamily | 'other' {
  const def = lookupMachineObservationDefinitionByCompoundKey(mark.source, mark.rawKey);
  return def ? def.family : 'other';
}

/**
 * True when a mark's family is a production family (A–I) or an unknown
 * rawKey (`'other'`, kept as a generic observation, identical to the hub).
 * Family J (`sensitive_composer`) returns false → dropped before
 * `refereeObservations` is built.
 */
function isMarkAllowedFamily(mark: NodeLabelMark): boolean {
  const family = resolveMarkFamily(mark);
  if (family === 'other') return true;
  return PRODUCTION_FAMILY_SET.has(family);
}

// ════════════════════════════════════════════════════════════════
// Evidence-debt precedence (source-class before quote)
// ════════════════════════════════════════════════════════════════

const SOURCE_CLASS_DEBT_KINDS: ReadonlySet<EvidenceDebtKind> = new Set<EvidenceDebtKind>([
  'source',
  'receipt',
  'context',
  'primary_record',
]);

const OWED_DEBT_STATUS_SET: ReadonlySet<EvidenceDebtStatus> = new Set(OPEN_EVIDENCE_DEBT_STATUSES);

function isOwedDebt(debt: EvidenceDebt): boolean {
  return OWED_DEBT_STATUS_SET.has(debt.status);
}

/**
 * The highest-precedence still-owed evidence debt: any source-class debt
 * (source/receipt/context/primary_record) outranks a quote debt. Returns
 * `null` when no owed debt exists. Non-mutating (scans the read-only input).
 */
function selectHighestPrecedenceOpenDebt(
  debts: ReadonlyArray<EvidenceDebt>,
): EvidenceDebt | null {
  for (const d of debts) {
    if (isOwedDebt(d) && SOURCE_CLASS_DEBT_KINDS.has(d.debtKind)) return d;
  }
  for (const d of debts) {
    if (isOwedDebt(d) && d.debtKind === 'quote') return d;
  }
  return null;
}

// ════════════════════════════════════════════════════════════════
// Field derivations (each total, pure, deterministic)
// ════════════════════════════════════════════════════════════════

/** `axis` — `deriveOpenIssueAxis` (6-tier precedence, high → low). */
export function deriveOpenIssueAxis(input: BuildOpenIssueInput): DisagreementAxis {
  // Tier 1 — evidence / quote debt (every EvidenceDebtKind is evidence-resolvable).
  if (selectHighestPrecedenceOpenDebt(input.openEvidenceDebts) !== null) return 'evidence';
  const sc = input.sourceChainStatus;
  if (sc === 'no_source' || sc === 'broken' || sc === 'source_no_quote' || sc === 'unverified') {
    return 'evidence';
  }

  // Tier 2 — explicit disagreementAxis (specific Family B `disputes_*` mark).
  const disputeAxis = firstDisputesAxis(input.machineObservations);
  if (disputeAxis !== null) return disputeAxis;

  // Tier 3 — manual tag.
  for (const tag of input.manualTags) {
    const axis = MANUAL_TAG_AXIS[tag];
    if (axis) return axis;
  }

  // Tier 4 — lifecycle debt (axis).
  if (input.lifecycleAxis) {
    const axis = LIFECYCLE_AXIS_MAP[input.lifecycleAxis];
    if (axis) return axis;
  }

  // Tier 5 — semantic observation (Family B umbrella; activeDisagreementKind).
  if (hasFamilyBObservation(input.machineObservations)) return 'framing';
  if (input.activeDisagreementKind) {
    const axis = ACTIVE_DISAGREEMENT_AXIS[input.activeDisagreementKind];
    if (axis) return axis;
  }

  // Tier 6 — process fallback (never empty).
  return 'process';
}

/** First Family B `disputes_*` mark whose rawKey is in the axis-normalization map. */
function firstDisputesAxis(marks: ReadonlyArray<NodeLabelMark>): DisagreementAxis | null {
  for (const mark of marks) {
    if (resolveMarkFamily(mark) !== 'disagreement_axis') continue;
    const axis = DISPUTES_AXIS_MAP[mark.rawKey];
    if (axis) return axis;
  }
  return null;
}

/** Any Family B (`disagreement_axis`) observation present — the tier-5 umbrella. */
function hasFamilyBObservation(marks: ReadonlyArray<NodeLabelMark>): boolean {
  for (const mark of marks) {
    if (resolveMarkFamily(mark) === 'disagreement_axis') return true;
  }
  return false;
}

/** `relationToParent` — `deriveOpenIssueRelation` (5-tier + reply-neutrality). */
export function deriveOpenIssueRelation(input: BuildOpenIssueInput): RelationToParent {
  // Each tier yields a SPECIFIC (non-`replies`) relation or null. `replies`
  // is never preferred over a more specific procedural relation (operator
  // constraint 2): a tier that only maps to `replies` falls through.
  const specific =
    relationFromActEntry(input.selectedActEntryId) ??
    relationFromChannel(input.selectedChannel) ??
    relationFromArgType(input.storedArgumentType) ??
    relationFromManualTags(input.manualTags) ??
    relationFromLifecycle(input.lifecycleState);

  let relation: RelationToParent = specific ?? 'replies';

  // Reply-neutrality upgrade (doctrine — side ≠ agreement). Applied ONLY
  // when the derived relation is the `replies` fallback; `carriesSupportEvidence`
  // is mandatory — side alone never implies support.
  if (relation === 'replies' && input.sameSideAsParent && input.carriesSupportEvidence) {
    relation = 'supports';
  }
  return relation;
}

function specificOrNull(relation: RelationToParent | undefined): RelationToParent | null {
  if (relation === undefined || relation === 'replies') return null;
  return relation;
}

function relationFromActEntry(id: ActEntryId | null): RelationToParent | null {
  if (id === null) return null;
  return specificOrNull(ACT_ENTRY_RELATION[id]);
}

function relationFromChannel(channel: MoveChannel | null): RelationToParent | null {
  if (channel === null) return null;
  return specificOrNull(CHANNEL_RELATION[channel]);
}

function relationFromArgType(type: ArgumentType | null): RelationToParent | null {
  if (type === null) return null;
  return specificOrNull(ARG_TYPE_RELATION[type]);
}

function relationFromManualTags(tags: ReadonlyArray<ManualTagCode>): RelationToParent | null {
  for (const tag of tags) {
    const relation = specificOrNull(MANUAL_TAG_RELATION[tag]);
    if (relation !== null) return relation;
  }
  return null;
}

function relationFromLifecycle(state: PointLifecycleState | null): RelationToParent | null {
  if (state === null) return null;
  return specificOrNull(LIFECYCLE_RELATION[state]);
}

/** States in which a challenge/ask is considered resolved (no reply owed). */
const NON_REPLY_OWED_STATES: ReadonlySet<IssueState> = new Set<IssueState>([
  'narrowed',
  'conceded',
  'synthesis_ready',
  'moved_on',
  'answered',
]);

/** `burden` — `deriveOpenIssueBurden` (evidence/quote > clarification > reply > none). */
export function deriveOpenIssueBurden(input: BuildOpenIssueInput): IssueBurden {
  // 1. Highest-precedence open evidence debt (source-class before quote).
  const debt = selectHighestPrecedenceOpenDebt(input.openEvidenceDebts);
  if (debt !== null) {
    return SOURCE_CLASS_DEBT_KINDS.has(debt.debtKind) ? 'source_owed' : 'quote_owed';
  }
  if (input.sourceChainStatus === 'no_source' || input.sourceChainStatus === 'broken') {
    return 'source_owed';
  }
  if (input.sourceChainStatus === 'source_no_quote') return 'quote_owed';

  // 2. Definition / clarify signal.
  if (hasClarifySignal(input)) return 'clarification_owed';

  // 3. Open / contested point awaiting a response. A bare `replies` relation
  //    never creates `reply_owed` and never clears a debt (operator constraint 2).
  const relation = deriveOpenIssueRelation(input);
  const state = deriveOpenIssueState(input);
  if (input.lifecycleState === 'open' || input.lifecycleState === 'rebutted') {
    return 'reply_owed';
  }
  if (
    !NON_REPLY_OWED_STATES.has(state) &&
    (relation === 'challenges' || relation === 'asks_source' || relation === 'asks_quote')
  ) {
    return 'reply_owed';
  }

  // 4. Terminal — no open task.
  return 'none';
}

function hasClarifySignal(input: BuildOpenIssueInput): boolean {
  return (
    input.manualTags.includes('definition_issue') ||
    input.lifecycleAxis === 'definition' ||
    input.selectedActEntryId === 'clarify' ||
    input.selectedChannel === 'clarify' ||
    input.storedArgumentType === 'clarification_request'
  );
}

/** `state` — `deriveOpenIssueState` (19-row base map, then debt override). */
export function deriveOpenIssueState(input: BuildOpenIssueInput): IssueState {
  // Step A — base map from lifecycleState (null → default `open`).
  const base: IssueState = input.lifecycleState
    ? LIFECYCLE_STATE_MAP[input.lifecycleState]
    : 'open';

  // Step B — open-debt override (debt outranks lifecycle resolution; fires
  // even when the base map yielded `answered`).
  const debt = selectHighestPrecedenceOpenDebt(input.openEvidenceDebts);
  if (debt !== null) {
    return SOURCE_CLASS_DEBT_KINDS.has(debt.debtKind) ? 'source_requested' : 'quote_requested';
  }
  return base;
}

// ── nextBestMoves (= suggestions ∩ surviving Act entries, then padded) ──

const DEFAULT_MAX_MOVES = 3;

function resolveMaxMoves(max: number | undefined): number {
  if (max === undefined || !Number.isFinite(max)) return DEFAULT_MAX_MOVES;
  if (max <= 0) return 0;
  return Math.floor(max);
}

/**
 * `nextBestMoves` join (REF-001 §"nextBestMoves semantics"):
 *   1. Map each `SuggestedMoveCode` → `ActEntryId`.
 *   2. For each suggested move (priority order): a surviving mapped entry is
 *      emitted; a gate-removed one surfaces the `branch_tangent` recovery
 *      route (or is dropped when branch_tangent is itself gated out — never
 *      a rejected button).
 *   3. Pad with the next constructive Act survivors (render order) toward
 *      `maxMoves`, so the card shows a useful 2–3 moves.
 *
 * `nextBestMoves ⊆ buildActPopout survivors` always — the doctrine
 * invariant the `.actGateParity` tests pin.
 */
export function deriveNextBestMoves(args: {
  suggestionInput: SuggestionDerivationInput;
  actGroups: ActPopoutGroup[];
  maxMoves?: number;
}): MoveSuggestion[] {
  const maxMoves = resolveMaxMoves(args.maxMoves);
  if (maxMoves <= 0) return [];

  const flat = flattenActPopout(args.actGroups);
  const survivorById = new Map<ActEntryId, ActPopoutEntry>();
  for (const entry of flat) survivorById.set(entry.id, entry);

  const out: MoveSuggestion[] = [];
  const emitted = new Set<ActEntryId>();

  function emit(entry: ActPopoutEntry, isRecoveryRoute: boolean, recoveredFromCode: SuggestedMoveCode | null): void {
    out.push({
      actEntryId: entry.id,
      label: entry.label,
      accessibilityLabel: entry.accessibilityLabel,
      isRecoveryRoute,
      recoveredFromCode,
    });
    emitted.add(entry.id);
  }

  // Step 1 + 2 — map + intersect (recovery route for gate-removed).
  const suggested = deriveSuggestedMoves(args.suggestionInput);
  for (const sm of suggested) {
    if (out.length >= maxMoves) break;
    const targetId = SUGGESTED_CODE_TO_ACT_ENTRY[sm.code];
    const survivor = survivorById.get(targetId);
    if (survivor) {
      if (!emitted.has(targetId)) emit(survivor, false, null);
      continue;
    }
    // Gate-removed → recovery route (branch_tangent), or dropped.
    const branch = survivorById.get('branch_tangent');
    if (branch && !emitted.has('branch_tangent')) emit(branch, true, sm.code);
  }

  // Step 3 — pad with remaining constructive Act survivors (render order).
  for (const entry of flat) {
    if (out.length >= maxMoves) break;
    if (emitted.has(entry.id)) continue;
    if (!PADDING_POOL.has(entry.id)) continue;
    emit(entry, false, null);
  }

  return out;
}

// ── Excerpt derivations (verbatim — NEVER AI-summarized) ───────────

const CONTESTED_PROPOSITION_CAP = 160;

/** Prefer the exact `quoteAnchor`; else the exact `targetExcerpt`; else null. */
function deriveTargetQuote(input: BuildOpenIssueInput): string | null {
  if (input.quoteAnchor !== null && input.quoteAnchor.length > 0) return input.quoteAnchor;
  if (input.targetExcerpt !== null && input.targetExcerpt.length > 0) return input.targetExcerpt;
  return null;
}

/** Deterministic excerpt — `quoteAnchor ?? targetExcerpt ?? ''`, ≤ 160 chars. */
function deriveContestedProposition(input: BuildOpenIssueInput): string {
  const raw = input.quoteAnchor ?? input.targetExcerpt ?? '';
  return truncateAtWordBoundary(raw, CONTESTED_PROPOSITION_CAP);
}

function truncateAtWordBoundary(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  const base = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return `${base.trimEnd()}…`;
}

// ── Observation / Allegation builders ──────────────────────────────

/**
 * `refereeObservations` — ≤ 1 on the public card; Family J never present.
 * The banner is CONSUMED, never re-selected (operator constraint 5).
 */
function buildRefereeObservations(input: BuildOpenIssueInput): IssueObservation[] {
  const banner = input.bannerSelection?.banner ?? null;
  if (banner) {
    return [
      {
        sourceCode: banner.bannerCode,
        line: banner.headline,
        toneGlyph: banner.toneGlyph,
        kind: 'machine_observation',
      },
    ];
  }
  // Else one summarized production-family mark (J dropped first), lowest priority.
  const allowed = input.machineObservations.filter(isMarkAllowedFamily);
  if (allowed.length === 0) return [];
  const chosen = allowed
    .slice()
    .sort((a, b) => a.priority - b.priority || (a.rawKey < b.rawKey ? -1 : a.rawKey > b.rawKey ? 1 : 0))[0];
  return [
    {
      sourceCode: chosen.rawKey,
      line: chosen.label,
      toneGlyph: null,
      kind: 'machine_observation',
    },
  ];
}

/** `userAllegations` — never merged into Observations; person-directed stays off the public card. */
function buildUserAllegations(input: BuildOpenIssueInput): IssueAllegation[] {
  return input.userAllegations.map((mark) => ({
    sourceCode: mark.rawKey,
    line: mark.label,
    kind: 'user_allegation' as const,
    visibility: deriveAllegationVisibility(mark),
  }));
}

function deriveAllegationVisibility(
  mark: NodeLabelMark,
): 'public' | 'composer_only' | 'moderator_only' {
  if (mark.disposition === 'composer_only' || mark.defaultSurface === 'composer') {
    return 'composer_only';
  }
  if (mark.disposition === 'hidden_sensitive') return 'moderator_only';
  return 'public';
}

// ════════════════════════════════════════════════════════════════
// Public entry points
// ════════════════════════════════════════════════════════════════

/**
 * Derives the Open Issue for one selected node. Total + deterministic +
 * pure. Returns `null` when `roomId` or `targetNodeId` is null (no issue
 * object exists; no card mounts).
 */
export function buildOpenIssue(input: BuildOpenIssueInput): DisagreementContract | null {
  if (input.roomId === null || input.targetNodeId === null) return null;

  const axis = deriveOpenIssueAxis(input);
  const relationToParent = deriveOpenIssueRelation(input);
  const burden = deriveOpenIssueBurden(input);
  const state = deriveOpenIssueState(input);

  const debt = selectHighestPrecedenceOpenDebt(input.openEvidenceDebts);
  const idDiscriminator: string = debt ? debt.debtKind : axis;
  const id = `issue:${input.targetNodeId}:${relationToParent}:${idDiscriminator}`;

  // The Act survivors universe — `buildActPopout` runs internally with the
  // engine + role hard gates and the lifecycle stage soft-promote.
  const actGroups = buildActPopout({
    targetKind: 'node',
    role: input.viewerRole,
    stage: input.lifecycleState,
    parentType: input.parentType,
    rules: input.rules,
  });
  const nextBestMoves = deriveNextBestMoves({
    suggestionInput: input.suggestionInput,
    actGroups,
    maxMoves: DEFAULT_MAX_MOVES,
  });

  return {
    id,
    roomId: input.roomId,
    targetNodeId: input.targetNodeId,
    targetQuote: deriveTargetQuote(input),
    contestedProposition: deriveContestedProposition(input),
    axis,
    relationToParent,
    burden,
    state,
    refereeObservations: buildRefereeObservations(input),
    userAllegations: buildUserAllegations(input),
    nextBestMoves,
  };
}

/** Composes the per-burden + axis open-task line from frozen plain atoms. */
function burdenAxisLine(burden: IssueBurden, axis: DisagreementAxis): string {
  return `${BURDEN_LABEL[burden]} · ${AXIS_LABEL[axis]}`;
}

/**
 * Pure view-model mapping — CONSUMES the contract, never re-derives.
 * Never calls `selectBanner`; never re-implements banner selection
 * (operator constraint 5).
 */
export function openIssueToRefereeCard(issue: DisagreementContract): RefereeCardViewModel {
  const obs0 = issue.refereeObservations[0];
  const relationLabel = RELATION_LABEL[issue.relationToParent];

  const middle =
    issue.burden !== 'none'
      ? `The open task is ${BURDEN_LABEL[issue.burden]}.`
      : ISSUE_STATE_TERMINAL_LINE[issue.state];

  const moveLabels = issue.nextBestMoves.map((m) => m.label);
  const movesClause = moveLabels.length > 0 ? ` Best next moves: ${moveLabels.join(' · ')}.` : '';
  const a11yMovesClause =
    moveLabels.length > 0 ? ` Suggested next moves: ${moveLabels.join(', ')}.` : '';

  return {
    zone1RelationLine: obs0 ? obs0.line : relationLabel,
    zone1ToneGlyph: obs0 ? obs0.toneGlyph : null,
    zone2OpenTaskLine:
      issue.burden !== 'none'
        ? burdenAxisLine(issue.burden, issue.axis)
        : ISSUE_STATE_TERMINAL_LINE[issue.state],
    zone3Moves: issue.nextBestMoves,
    refereeNoteSentence: `Referee note: ${relationLabel}. ${middle}${movesClause}`,
    accessibilityLabel: `Referee note. ${relationLabel}. ${middle}${a11yMovesClause}`,
  };
}

/** REF-001 compatibility alias — both names export the same mapping. */
export const buildRefereeCardViewModel = openIssueToRefereeCard;
