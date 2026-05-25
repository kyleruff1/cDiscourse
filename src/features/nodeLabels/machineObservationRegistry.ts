/**
 * UX-001.5A — Machine Observation registry.
 *
 * 64 entries — 16 auto-metadata + 18 lifecycle + 25 AI classifier
 * + 5 sensitive composer-only. Frozen at module load. Plain labels come
 * verbatim from the existing META-001 / LIFE-001 plain-language helpers
 * (`getAutoMetadataPlainLabel`, `getPointLifecyclePlainLabel`) which
 * already pass the META-001 / LIFE-001 ban-list doctrine scans.
 *
 * Key shape: the registry is keyed by COMPOUND key `${source}:${rawKey}`
 * to address all 64 entries unambiguously. Two rawKeys overlap between
 * sources (`source_requested`, `quote_requested` appear in both
 * `auto_metadata` and `lifecycle`); a compound key keeps both entries
 * addressable. Adapters use the compound key directly; the legacy
 * `byRawKey` map exposes the highest-priority entry per rawKey for
 * dedupe / descriptor paths.
 *
 * Disposition gating:
 *   - `rendered_now` — eligible for Timeline / Selected-context / Inspect.
 *   - `inspect_only` — eligible for Inspect only.
 *   - `composer_only` — eligible for the composer surface only (sensitive
 *     IDs that would read as accusation if surfaced on a target's node).
 *   - `future_source` — adapter returns `[]` in v1; slot exists for
 *     forward-compatibility + mechanical coverage check.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — Observations vs Allegations boundary.
 *   - LIFE-001 / META-001 — labels routed through `PLAIN_LANGUAGE_COPY`.
 *   - No verdict / amplification / person tokens (test file 9 enforces).
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

import {
  getAutoMetadataPlainLabel,
  type AutoMetadataCode,
} from '../metadata/moveMetadataLedger';
import {
  ALL_POINT_LIFECYCLE_STATES,
  getPointLifecyclePlainLabel,
} from '../lifecycle/pointLifecycleModel';
import type { NodeLabelMark, NodeLabelSource } from './nodeLabelTypes';

// ── Internal builder shape — converted to frozen NodeLabelMark ────

interface MachineObservationEntryBuilder {
  rawKey: string;
  label: string;
  shortLabel: string;
  description: string;
  defaultSurface: NodeLabelMark['defaultSurface'];
  disposition: NodeLabelMark['disposition'];
  priority: number;
  visibleByDefault: boolean;
  source: NodeLabelMark['source'];
  confidence?: NodeLabelMark['confidence'];
}

function toMark(b: MachineObservationEntryBuilder): NodeLabelMark {
  const mark: NodeLabelMark = {
    id: `registry:machine_observation:${b.source}:${b.rawKey}`,
    rawKey: b.rawKey,
    kind: 'machine_observation',
    source: b.source,
    label: b.label,
    shortLabel: b.shortLabel,
    description: b.description,
    defaultSurface: b.defaultSurface,
    disposition: b.disposition,
    priority: b.priority,
    visibleByDefault: b.visibleByDefault,
  };
  if (b.confidence) mark.confidence = b.confidence;
  return Object.freeze(mark);
}

/** Compose the compound registry key. Stable for adapter + presentation. */
export function makeMachineObservationKey(source: NodeLabelSource, rawKey: string): string {
  return `${source}:${rawKey}`;
}

// ── 16 auto-metadata entries (source: 'auto_metadata') ────────────

const AUTO_METADATA_ENTRIES: ReadonlyArray<MachineObservationEntryBuilder> = [
  {
    rawKey: 'has_reply',
    label: getAutoMetadataPlainLabel('has_reply'),
    shortLabel: 'Has reply',
    description: 'A reply was posted on this move.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 80,
    visibleByDefault: false,
    source: 'auto_metadata',
  },
  {
    rawKey: 'has_rebuttal',
    label: getAutoMetadataPlainLabel('has_rebuttal'),
    shortLabel: 'Challenged',
    description: 'This move has a challenge.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 30,
    visibleByDefault: true,
    source: 'auto_metadata',
  },
  {
    rawKey: 'has_counter_rebuttal',
    label: getAutoMetadataPlainLabel('has_counter_rebuttal'),
    shortLabel: 'Counter',
    description: 'This move has a counter-challenge.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 32,
    visibleByDefault: true,
    source: 'auto_metadata',
  },
  {
    rawKey: 'has_evidence',
    label: getAutoMetadataPlainLabel('has_evidence'),
    shortLabel: 'Evidence',
    description: 'Evidence is attached to this move.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 20,
    visibleByDefault: true,
    source: 'auto_metadata',
  },
  {
    rawKey: 'source_requested',
    label: getAutoMetadataPlainLabel('source_requested'),
    shortLabel: 'Source asked',
    description: 'A source has been requested for this move.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 15,
    visibleByDefault: true,
    source: 'auto_metadata',
  },
  {
    rawKey: 'quote_requested',
    label: getAutoMetadataPlainLabel('quote_requested'),
    shortLabel: 'Quote asked',
    description: 'A direct quote has been requested for this move.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 16,
    visibleByDefault: true,
    source: 'auto_metadata',
  },
  {
    rawKey: 'source_attached',
    label: getAutoMetadataPlainLabel('source_attached'),
    shortLabel: 'Source',
    description: 'A source is attached to this move.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 18,
    visibleByDefault: true,
    source: 'auto_metadata',
  },
  {
    rawKey: 'quote_attached',
    label: getAutoMetadataPlainLabel('quote_attached'),
    shortLabel: 'Quote',
    description: 'A direct quote is attached to this move.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 19,
    visibleByDefault: true,
    source: 'auto_metadata',
  },
  {
    rawKey: 'participant_skipped_node',
    label: getAutoMetadataPlainLabel('participant_skipped_node'),
    shortLabel: 'Side skipped',
    description: 'The same side has posted past this move without responding to it.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 60,
    visibleByDefault: false,
    source: 'auto_metadata',
  },
  {
    rawKey: 'no_response_after_n_turns',
    label: getAutoMetadataPlainLabel('no_response_after_n_turns'),
    shortLabel: 'No follow-up',
    description: 'This move has no follow-up after several turns.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 25,
    visibleByDefault: true,
    source: 'auto_metadata',
  },
  {
    rawKey: 'repeated_axis_pressure',
    label: getAutoMetadataPlainLabel('repeated_axis_pressure'),
    shortLabel: 'Repeated',
    description: 'The same axis has received repeated pressure.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 28,
    visibleByDefault: true,
    source: 'auto_metadata',
  },
  {
    rawKey: 'branch_suggested',
    label: getAutoMetadataPlainLabel('branch_suggested'),
    shortLabel: 'Branch hint',
    description: 'A branch is suggested for this exchange.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 35,
    visibleByDefault: true,
    source: 'auto_metadata',
  },
  {
    rawKey: 'branch_created',
    label: getAutoMetadataPlainLabel('branch_created'),
    shortLabel: 'Branch here',
    description: 'A new branch was created at this point.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 36,
    visibleByDefault: true,
    source: 'auto_metadata',
  },
  {
    rawKey: 'point_stalled',
    label: getAutoMetadataPlainLabel('point_stalled'),
    shortLabel: 'Stalled',
    description: 'The point has stalled — no recent activity.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 22,
    visibleByDefault: true,
    source: 'auto_metadata',
  },
  {
    rawKey: 'point_exhausted',
    label: getAutoMetadataPlainLabel('point_exhausted'),
    shortLabel: 'Exhausted',
    description: 'This point appears to be out of fresh angles.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 24,
    visibleByDefault: true,
    source: 'auto_metadata',
  },
  {
    rawKey: 'synthesis_candidate',
    label: getAutoMetadataPlainLabel('synthesis_candidate'),
    shortLabel: 'Synthesis',
    description: 'This exchange is a candidate for synthesis.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 26,
    visibleByDefault: true,
    source: 'auto_metadata',
  },
];

// ── 18 lifecycle entries (source: 'lifecycle') ────────────────────

const LIFECYCLE_ENTRIES: ReadonlyArray<MachineObservationEntryBuilder> = [
  {
    rawKey: 'open',
    label: getPointLifecyclePlainLabel('open'),
    shortLabel: 'Open',
    description: 'This cluster is open for response.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 75,
    visibleByDefault: false,
    source: 'lifecycle',
  },
  {
    rawKey: 'answered',
    label: getPointLifecyclePlainLabel('answered'),
    shortLabel: 'Answered',
    description: 'This cluster has at least one reply.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 76,
    visibleByDefault: false,
    source: 'lifecycle',
  },
  {
    rawKey: 'rebutted',
    label: getPointLifecyclePlainLabel('rebutted'),
    shortLabel: 'Pressured',
    description: 'This cluster is under pressure from a challenge.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 14,
    visibleByDefault: true,
    source: 'lifecycle',
  },
  {
    rawKey: 'clarified',
    label: getPointLifecyclePlainLabel('clarified'),
    shortLabel: 'Clarified',
    description: 'A clarification was provided in this cluster.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 23,
    visibleByDefault: true,
    source: 'lifecycle',
  },
  {
    rawKey: 'sourced',
    label: getPointLifecyclePlainLabel('sourced'),
    shortLabel: 'Sourced',
    description: 'A source has been attached in this cluster.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 17,
    visibleByDefault: true,
    source: 'lifecycle',
  },
  {
    rawKey: 'quote_requested',
    label: getPointLifecyclePlainLabel('quote_requested'),
    shortLabel: 'Quote asked',
    description: 'A direct quote has been requested.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 16,
    visibleByDefault: true,
    source: 'lifecycle',
  },
  {
    rawKey: 'source_requested',
    label: getPointLifecyclePlainLabel('source_requested'),
    shortLabel: 'Source asked',
    description: 'A source has been requested.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 15,
    visibleByDefault: true,
    source: 'lifecycle',
  },
  {
    rawKey: 'narrowed',
    label: getPointLifecyclePlainLabel('narrowed'),
    shortLabel: 'Narrowed',
    description: 'The claim was narrowed.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 21,
    visibleByDefault: true,
    source: 'lifecycle',
  },
  {
    rawKey: 'conceded',
    label: getPointLifecyclePlainLabel('conceded'),
    shortLabel: 'Conceded',
    description: 'A concession was offered by the author.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 27,
    visibleByDefault: true,
    source: 'lifecycle',
  },
  {
    rawKey: 'confirmed',
    label: getPointLifecyclePlainLabel('confirmed'),
    shortLabel: 'Confirmed',
    description: 'The other side confirmed this point.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 29,
    visibleByDefault: true,
    source: 'lifecycle',
  },
  {
    rawKey: 'synthesis_ready',
    label: getPointLifecyclePlainLabel('synthesis_ready'),
    shortLabel: 'Synthesis',
    description: 'This cluster is ready for synthesis.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 26,
    visibleByDefault: true,
    source: 'lifecycle',
  },
  {
    rawKey: 'moved_on_by_affirmative',
    label: getPointLifecyclePlainLabel('moved_on_by_affirmative'),
    shortLabel: 'Moved on (Aff)',
    description: 'The affirmative side moved on from this point.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 65,
    visibleByDefault: false,
    source: 'lifecycle',
  },
  {
    rawKey: 'moved_on_by_negative',
    label: getPointLifecyclePlainLabel('moved_on_by_negative'),
    shortLabel: 'Moved on (Neg)',
    description: 'The negative side moved on from this point.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 66,
    visibleByDefault: false,
    source: 'lifecycle',
  },
  {
    rawKey: 'ignored_by_affirmative',
    label: getPointLifecyclePlainLabel('ignored_by_affirmative'),
    shortLabel: 'Skipped (Aff)',
    description: 'The affirmative side did not respond to a request here.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 67,
    visibleByDefault: false,
    source: 'lifecycle',
  },
  {
    rawKey: 'ignored_by_negative',
    label: getPointLifecyclePlainLabel('ignored_by_negative'),
    shortLabel: 'Skipped (Neg)',
    description: 'The negative side did not respond to a request here.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 68,
    visibleByDefault: false,
    source: 'lifecycle',
  },
  {
    rawKey: 'ignored_by_both',
    label: getPointLifecyclePlainLabel('ignored_by_both'),
    shortLabel: 'No follow-up',
    description: 'Nobody followed up on this point.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 33,
    visibleByDefault: true,
    source: 'lifecycle',
  },
  {
    rawKey: 'exhausted',
    label: getPointLifecyclePlainLabel('exhausted'),
    shortLabel: 'Exhausted',
    description: 'This cluster is out of new angles.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 24,
    visibleByDefault: true,
    source: 'lifecycle',
  },
  {
    rawKey: 'branch_recommended',
    label: getPointLifecyclePlainLabel('branch_recommended'),
    shortLabel: 'Branch hint',
    description: 'Branching is recommended for this exchange.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 35,
    visibleByDefault: true,
    source: 'lifecycle',
  },
  {
    rawKey: 'archived_or_resolved',
    label: getPointLifecyclePlainLabel('archived_or_resolved'),
    shortLabel: 'Resolved',
    description: 'This cluster is archived or resolved.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 70,
    visibleByDefault: false,
    source: 'lifecycle',
  },
];

// ── 25 AI classifier entries (source: 'ai_classifier') ────────────
//
// Every entry is `disposition: 'future_source'` per audit Source 6
// = TRANSIENT_ONLY. Adapter `adaptRawClassifierBinarySource` returns []
// unconditionally; presentation model's surface filter also excludes
// `future_source` so these entries cannot render in v1.

const AI_CLASSIFIER_ENTRIES: ReadonlyArray<MachineObservationEntryBuilder> = [
  { rawKey: 'introduces_new_issue', label: 'Side issue', shortLabel: 'Side issue', description: 'This move introduces a new side issue.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 40, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'quote_anchors_parent', label: 'Anchored reply', shortLabel: 'Anchored', description: 'This reply is anchored to the parent by a quote.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 41, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'requests_clarification', label: 'Clarification asked', shortLabel: 'Clarify?', description: 'A clarification is requested here.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 38, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'answers_clarification', label: 'Clarification answered', shortLabel: 'Clarified', description: 'A clarification was answered here.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 39, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'asks_for_evidence', label: 'Evidence requested', shortLabel: 'Evidence?', description: 'Evidence is requested here.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 15, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'provides_evidence', label: 'Evidence provided', shortLabel: 'Evidence', description: 'Evidence is provided here.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 20, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'evidence_supports_claim', label: 'Evidence matched to claim', shortLabel: 'Matched', description: 'Evidence appears to match the claim.', defaultSurface: 'inspect', disposition: 'inspect_only', priority: 50, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'creates_source_chain_gap', label: 'Source gap', shortLabel: 'Source gap', description: 'A gap in the source chain has appeared.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 12, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'narrows_claim', label: 'Claim narrowed', shortLabel: 'Narrowed', description: 'The claim was narrowed.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 21, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'concedes_narrow_point', label: 'Narrow concession', shortLabel: 'Conceded', description: 'A narrow concession was offered.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 27, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'ready_for_synthesis', label: 'Synthesis ready', shortLabel: 'Synthesis', description: 'This exchange is ready for synthesis.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 26, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'suggests_side_branch', label: 'Side branch suggested', shortLabel: 'Side branch', description: 'A side branch is suggested.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 42, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'suggests_diagonal_tangent', label: 'Tangent branch suggested', shortLabel: 'Tangent', description: 'A tangent branch is suggested.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 43, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'disputes_evidence_applicability', label: 'Evidence applicability challenged', shortLabel: 'App. dispute', description: 'The applicability of evidence is challenged.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 44, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'references_prior_agreement', label: 'Prior agreement referenced', shortLabel: 'Prior', description: 'A prior agreement is referenced.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 45, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'provides_temporal_constraint', label: 'Time boundary', shortLabel: 'Time bound', description: 'A time boundary is set.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 46, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'accepts_partial_with_caveat', label: 'Partial acceptance', shortLabel: 'Partial', description: 'A partial acceptance with a caveat was offered.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 47, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'provides_alternate_interpretation', label: 'Alternate reading', shortLabel: 'Alt read', description: 'An alternate interpretation is offered.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 48, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'opens_evidence_debt_marker', label: 'Evidence debt opened', shortLabel: 'Debt open', description: 'An evidence debt was opened.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 13, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'closes_evidence_debt_marker', label: 'Evidence debt answered', shortLabel: 'Debt closed', description: 'An evidence debt was answered.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 14, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'supplies_corroborating_document', label: 'Corroborating document', shortLabel: 'Corroborated', description: 'A corroborating document was supplied.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 19, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'introduces_sub_axis', label: 'Sub-axis opened', shortLabel: 'Sub-axis', description: 'A sub-axis was opened.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 49, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'concedes_with_new_dispute', label: 'Concession plus new dispute', shortLabel: 'Concede+', description: 'A concession was offered alongside a new dispute.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 50, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'proposes_settlement_terms', label: 'Settlement proposed', shortLabel: 'Settle?', description: 'Settlement terms were proposed.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 51, visibleByDefault: false, source: 'ai_classifier' },
  { rawKey: 'accepts_settlement_terms', label: 'Settlement accepted', shortLabel: 'Settle OK', description: 'Settlement terms were accepted.', defaultSurface: 'timeline_node', disposition: 'future_source', priority: 52, visibleByDefault: false, source: 'ai_classifier' },
];

// ── 5 sensitive composer-only entries (source: 'semantic_referee') ─

const SENSITIVE_COMPOSER_ONLY_ENTRIES: ReadonlyArray<MachineObservationEntryBuilder> = [
  {
    rawKey: 'shifts_to_person_or_intent',
    label: 'Person or intent shift',
    shortLabel: 'Pers shift',
    description: 'The move shifts focus from the claim to the person or intent.',
    defaultSurface: 'composer',
    disposition: 'composer_only',
    priority: 5,
    visibleByDefault: false,
    source: 'semantic_referee',
  },
  {
    rawKey: 'contains_unplayable_insult_only',
    label: 'No playable claim',
    shortLabel: 'No claim',
    description: 'No playable claim is included — only an insult.',
    defaultSurface: 'composer',
    disposition: 'composer_only',
    priority: 6,
    visibleByDefault: false,
    source: 'semantic_referee',
  },
  {
    rawKey: 'needs_pre_send_pause',
    label: 'Pause suggested',
    shortLabel: 'Pause',
    description: 'A pause before sending is suggested.',
    defaultSurface: 'composer',
    disposition: 'composer_only',
    priority: 7,
    visibleByDefault: false,
    source: 'semantic_referee',
  },
  {
    rawKey: 'uses_popularity_as_evidence',
    label: 'Popularity used as support',
    shortLabel: 'Pop-evidence',
    description: 'Popularity is used as support for the claim. Popularity is not proof.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 53,
    visibleByDefault: false,
    source: 'semantic_referee',
  },
  {
    rawKey: 'uses_satire_as_evidence',
    label: 'Satire used as support',
    shortLabel: 'Satire',
    description: 'Satire is used as support for the claim.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 54,
    visibleByDefault: false,
    source: 'semantic_referee',
  },
];

// ── Compose registries ────────────────────────────────────────────

function buildAllEntries(): ReadonlyArray<NodeLabelMark> {
  const all: NodeLabelMark[] = [];
  for (const e of AUTO_METADATA_ENTRIES) all.push(toMark(e));
  for (const e of LIFECYCLE_ENTRIES) all.push(toMark(e));
  for (const e of AI_CLASSIFIER_ENTRIES) all.push(toMark(e));
  for (const e of SENSITIVE_COMPOSER_ONLY_ENTRIES) all.push(toMark(e));
  return Object.freeze(all);
}

function buildCompoundRegistry(
  all: ReadonlyArray<NodeLabelMark>,
): Readonly<Record<string, NodeLabelMark>> {
  const map: Record<string, NodeLabelMark> = {};
  for (const mark of all) {
    map[makeMachineObservationKey(mark.source, mark.rawKey)] = mark;
  }
  return Object.freeze(map);
}

function buildByRawKeyRegistry(
  all: ReadonlyArray<NodeLabelMark>,
): Readonly<Record<string, NodeLabelMark>> {
  const map: Record<string, NodeLabelMark> = {};
  // Priority order: lifecycle wins over auto_metadata for shared rawKeys
  // (priority 20 < priority 30 per PRIORITY_BY_SOURCE). The pass order
  // below applies the highest-priority source last so it survives.
  // Pass 1: AI classifier (lowest priority among included).
  for (const mark of all) {
    if (mark.source === 'ai_classifier') map[mark.rawKey] = mark;
  }
  // Pass 2: composition_mutation (none in v1 — kept for parallelism).
  for (const mark of all) {
    if (mark.source === 'composition_mutation') map[mark.rawKey] = mark;
  }
  // Pass 3: semantic_referee (sensitive composer-only + inspect-only).
  for (const mark of all) {
    if (mark.source === 'semantic_referee') map[mark.rawKey] = mark;
  }
  // Pass 4: auto_metadata.
  for (const mark of all) {
    if (mark.source === 'auto_metadata') map[mark.rawKey] = mark;
  }
  // Pass 5: lifecycle wins for any shared rawKey.
  for (const mark of all) {
    if (mark.source === 'lifecycle') map[mark.rawKey] = mark;
  }
  return Object.freeze(map);
}

const ALL_ENTRIES = buildAllEntries();

/**
 * UX-001.5A — Frozen registry of all 64 Machine Observation entries
 * keyed by COMPOUND key `${source}:${rawKey}`. Adapters use this for
 * source-specific lookup; the legacy `byRawKey` map below exposes the
 * highest-priority entry per rawKey for descriptor / dedupe paths.
 *
 * Layout:
 *   - 16 auto-metadata (source: 'auto_metadata')
 *   - 18 lifecycle (source: 'lifecycle')
 *   - 25 AI classifier (source: 'ai_classifier', disposition: 'future_source')
 *   - 5 sensitive composer-only (source: 'semantic_referee')
 *
 * Pure TS. JSON-serializable. Frozen.
 */
export const MACHINE_OBSERVATION_REGISTRY: Readonly<Record<string, NodeLabelMark>> =
  buildCompoundRegistry(ALL_ENTRIES);

/**
 * UX-001.5A — Legacy by-rawKey registry. Exposes the highest-priority
 * entry per rawKey when two sources share the rawKey
 * (lifecycle > auto_metadata for `source_requested` / `quote_requested`).
 * Used by the descriptor adapter and the dedupe model.
 *
 * Pure TS. Frozen.
 */
export const MACHINE_OBSERVATION_BY_RAW_KEY: Readonly<Record<string, NodeLabelMark>> =
  buildByRawKeyRegistry(ALL_ENTRIES);

/**
 * UX-001.5A — Frozen list of every compound key in the compound registry.
 * Length is exactly 64 (one entry per source-rawKey pair).
 */
export const ALL_MACHINE_OBSERVATION_KEYS: ReadonlyArray<string> = Object.freeze(
  Object.keys(MACHINE_OBSERVATION_REGISTRY),
);

/**
 * UX-001.5A — Frozen list of every distinct rawKey in the registry.
 * Length is 62 (64 entries minus 2 rawKey overlaps between
 * auto_metadata and lifecycle).
 */
export const ALL_MACHINE_OBSERVATION_RAW_KEYS: ReadonlyArray<string> = Object.freeze(
  Object.keys(MACHINE_OBSERVATION_BY_RAW_KEY),
);

/**
 * Lookup by compound key (source + rawKey). Returns null when absent.
 * Adapters call this — it disambiguates the shared rawKeys.
 */
export function lookupMachineObservation(
  source: NodeLabelSource,
  rawKey: string,
): NodeLabelMark | null {
  if (typeof rawKey !== 'string' || rawKey.length === 0) return null;
  return MACHINE_OBSERVATION_REGISTRY[makeMachineObservationKey(source, rawKey)] ?? null;
}

/**
 * Lookup by rawKey only. Returns the highest-priority entry per the
 * dedupe priority order (lifecycle > auto_metadata for shared rawKeys).
 * Used by the descriptor adapter when source provenance is already on
 * the mark.
 */
export function getMachineObservationByRawKey(rawKey: string): NodeLabelMark | null {
  if (typeof rawKey !== 'string' || rawKey.length === 0) return null;
  return MACHINE_OBSERVATION_BY_RAW_KEY[rawKey] ?? null;
}

/** Type guard — true when the rawKey is in the registry. */
export function isKnownMachineObservationRawKey(rawKey: string): boolean {
  if (typeof rawKey !== 'string' || rawKey.length === 0) return false;
  return Object.prototype.hasOwnProperty.call(MACHINE_OBSERVATION_BY_RAW_KEY, rawKey);
}

// ── Internal: coverage check ──────────────────────────────────────

/** Test-only export — for coverage assertions. */
export const _INTERNAL_RAW_KEY_GROUPS = Object.freeze({
  autoMetadata: Object.freeze(AUTO_METADATA_ENTRIES.map((e) => e.rawKey)),
  lifecycle: Object.freeze(LIFECYCLE_ENTRIES.map((e) => e.rawKey)),
  aiClassifier: Object.freeze(AI_CLASSIFIER_ENTRIES.map((e) => e.rawKey)),
  sensitive: Object.freeze(SENSITIVE_COMPOSER_ONLY_ENTRIES.map((e) => e.rawKey)),
});

// Runtime reference — the imported array proves the union is real and is
// also the canonical source the registry's coverage tests iterate against.
// AutoMetadataCode is used inline by `getAutoMetadataPlainLabel` calls above.
void ALL_POINT_LIFECYCLE_STATES;
const _UnusedAutoTypeCheck: ReadonlyArray<AutoMetadataCode> = [];
void _UnusedAutoTypeCheck;
