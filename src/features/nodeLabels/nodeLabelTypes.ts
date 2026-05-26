/**
 * UX-001.5A — Node label type contracts (pure TypeScript).
 *
 * The source-of-truth taxonomy for node labels: Machine Observations
 * (system-derived) vs User Allegations (participant-applied). Together
 * with `machineObservationRegistry` + `userAllegationRegistry` they
 * define the v1 vocabulary; together with `nodeLabelSourceAdapters`
 * they define how upstream data populates the vocabulary; together with
 * `nodeLabelPresentationModel` they define the display caps and
 * surface-routing rules.
 *
 * Doctrine anchor (cdiscourse-doctrine §10a): the schema boundary is
 * load-bearing. Machine-created labels are Observations; user-created
 * labels are Allegations. Do NOT collapse the two into generic "tags".
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

/**
 * UX-001.5A — Top-level taxonomy. Two values only. Machine-created
 * labels are Observations; user-created labels are Allegations.
 *
 * Doctrine anchor (cdiscourse-doctrine §10a): the schema boundary is
 * load-bearing. Do NOT collapse into a generic "tags" bucket. The
 * descriptor's `source: 'machine' | 'user'` slot is the UX-001.5
 * primitive layer's view of the same boundary.
 */
export type NodeLabelKind = 'machine_observation' | 'user_allegation';

/**
 * UX-001.5A — Source provenance. Maps to `AnnotationChipDescriptor.category`
 * via the descriptor adapter. The audit established this exact 7-value
 * set; future_source covers Sources 4, 5-node-mount, 6 in v1.
 */
export type NodeLabelSource =
  | 'manual_tag' // Source 1 (User Allegation)
  | 'auto_metadata' // Source 2 (Machine Observation)
  | 'lifecycle' // Source 3 (Machine Observation)
  | 'semantic_referee' // Source 5 (composer-only in v1)
  | 'composition_mutation' // Source 4 (future_source v1)
  | 'ai_classifier' // Source 6 (future_source v1)
  | 'future_source'; // sentinel — never emitted by an adapter

/** UX-001.5A — Display surface routing. */
export type NodeLabelSurface =
  | 'timeline_node'
  | 'selected_context'
  | 'inspect'
  | 'composer'
  | 'hidden';

/** UX-001.5A — Per-registry-entry disposition gate. */
export type NodeLabelDisposition =
  | 'rendered_now'
  | 'inspect_only'
  | 'composer_only'
  | 'hidden_sensitive'
  | 'future_source'
  | 'intentionally_silent';

/**
 * UX-001.5A — Narrowed Machine Observation source subtype. Recommended by
 * the source-access audit for call-site narrowing convenience.
 * Additive — the load-bearing union is `NodeLabelSource`.
 */
export type MachineObservationSource = Extract<
  NodeLabelSource,
  | 'auto_metadata'
  | 'lifecycle'
  | 'semantic_referee'
  | 'composition_mutation'
  | 'ai_classifier'
>;

/**
 * UX-001.5A — Narrowed User Allegation source subtype. Recommended by
 * the source-access audit for call-site narrowing convenience.
 * Additive — the load-bearing union is `NodeLabelSource`.
 */
export type UserAllegationSource = Extract<NodeLabelSource, 'manual_tag'>;

/**
 * UX-001.5A — Canonical per-source-per-node mark. The adapter layer
 * produces these; the presentation model combines / dedupes / filters;
 * the descriptor adapter converts to `AnnotationChipDescriptor`.
 *
 * Pure JSON-serializable. No functions, no React, no Supabase.
 */
export interface NodeLabelMark {
  /** Stable React diffing key — `${kind}:${source}:${rawKey}:${nodeId}`. */
  id: string;

  /** Raw internal code (e.g. `creates_source_chain_gap`, `needs_source`).
   *  NEVER user-facing. */
  rawKey: string;

  /** Top-level taxonomy. */
  kind: NodeLabelKind;

  /** Source category. */
  source: NodeLabelSource;

  /** Plain-language standard label (e.g. "Source gap"). Routed through
   *  the relevant plain-label helper at adapter time. */
  label: string;

  /** Compact label for Timeline-node chips (shorter than `label`). */
  shortLabel: string;

  /** Plain-language explanation surfaced in tooltip / Inspect. */
  description: string;

  /** Per-registry default surface. */
  defaultSurface: NodeLabelSurface;

  /** Per-registry disposition gate. */
  disposition: NodeLabelDisposition;

  /** Priority for overflow ordering — lower = higher priority. */
  priority: number;

  /** True when the label is eligible for the default Timeline node strip. */
  visibleByDefault: boolean;

  /** Optional confidence band (AI-classifier-sourced entries only). */
  confidence?: 'low' | 'medium' | 'high';
}

/** Frozen array of every `NodeLabelKind` value. */
export const ALL_NODE_LABEL_KINDS: ReadonlyArray<NodeLabelKind> = Object.freeze([
  'machine_observation',
  'user_allegation',
]);

/** Frozen array of every `NodeLabelSource` value. */
export const ALL_NODE_LABEL_SOURCES: ReadonlyArray<NodeLabelSource> = Object.freeze([
  'manual_tag',
  'auto_metadata',
  'lifecycle',
  'semantic_referee',
  'composition_mutation',
  'ai_classifier',
  'future_source',
]);

/** Frozen array of every `NodeLabelSurface` value. */
export const ALL_NODE_LABEL_SURFACES: ReadonlyArray<NodeLabelSurface> = Object.freeze([
  'timeline_node',
  'selected_context',
  'inspect',
  'composer',
  'hidden',
]);

/** Frozen array of every `NodeLabelDisposition` value. */
export const ALL_NODE_LABEL_DISPOSITIONS: ReadonlyArray<NodeLabelDisposition> = Object.freeze([
  'rendered_now',
  'inspect_only',
  'composer_only',
  'hidden_sensitive',
  'future_source',
  'intentionally_silent',
]);

// ── MCP-021A — Machine Observation taxonomy (additive) ────────────

/**
 * MCP-021A — Family taxonomy for Machine Observations.
 *
 * Pure type alias. New enum, additive to existing NodeLabelSource etc.
 * The 10 families partition the 171 entries by phenomenon being observed.
 * Family J is the binding cap on sensitive composer-only entries (5;
 * see Trigger 10 in the design doc §10).
 *
 * Doctrine anchor (cdiscourse-doctrine §10a): every family is a
 * structural-observation grouping; no family encodes a verdict or a
 * judgment on the move's author.
 */
export type MachineObservationFamily =
  | 'parent_relation'           // Family A — 16 entries
  | 'disagreement_axis'         // Family B — 14 entries
  | 'misunderstanding_repair'   // Family C — 17 entries
  | 'evidence_source_chain'     // Family D — 27 entries
  | 'argument_scheme'           // Family E — 16 entries
  | 'critical_question'         // Family F — 14 entries
  | 'resolution_progress'       // Family G — 29 entries
  | 'claim_clarity'             // Family H — 12 entries
  | 'thread_topology'           // Family I — 21 entries
  | 'sensitive_composer';       // Family J — 5 entries (Trigger 10 cap)

/**
 * MCP-021A — Frozen array of all family codes for test enumeration.
 */
export const ALL_MACHINE_OBSERVATION_FAMILIES: ReadonlyArray<MachineObservationFamily> =
  Object.freeze([
    'parent_relation',
    'disagreement_axis',
    'misunderstanding_repair',
    'evidence_source_chain',
    'argument_scheme',
    'critical_question',
    'resolution_progress',
    'claim_clarity',
    'thread_topology',
    'sensitive_composer',
  ]);

/**
 * MCP-021A — Per-surface confidence threshold map for a registry entry.
 *
 * Each threshold is the minimum confidence level the entry will render
 * at on that surface; lower-confidence MCP results are dropped by the
 * sanitizer (see `mcpBooleanObservationSchema.ts`).
 *
 * Pure JSON-serializable.
 */
export interface MachineObservationConfidenceEligibility {
  timelineMinConfidence: 'low' | 'medium' | 'high';
  selectedContextMinConfidence: 'low' | 'medium' | 'high';
  inspectMinConfidence: 'low' | 'medium' | 'high';
}

/**
 * MCP-021A — Verbose internal definition shape for a Machine Observation.
 *
 * Per the design doc §4 the implementer choice (a/b) was: keep
 * `NodeLabelMark` byte-equal and expose the extended fields via a
 * PARALLEL registry. This interface is the parallel-registry shape.
 *
 * EVERY entry in `MACHINE_OBSERVATION_DEFINITIONS_REGISTRY` MUST carry
 * all 8 verbose fields after Phase B backfill. Trigger 12 fires if any
 * entry lacks a field; the §8 test category 2 enforces.
 *
 * The verbose fields are NEVER user-facing — they live in the registry
 * for the MCP prompt + operator audit + per-rawKey ledger.
 *
 * Pure JSON-serializable. No React, Supabase, network.
 */
export interface MachineObservationDefinition {
  // ── Echo of NodeLabelMark fields (kept synced with the mark registry) ──

  /** Stable React diffing key — matches `NodeLabelMark.id`. */
  id: string;

  /** Internal classifier id (never user-facing). */
  rawKey: string;

  /** Top-level taxonomy (always 'machine_observation' for these). */
  kind: 'machine_observation';

  /** Source provenance. */
  source: NodeLabelSource;

  /** Plain-language standard label (Inspect-friendly). */
  label: string;

  /** Compact label for Timeline chips (≤20 chars). */
  shortLabel: string;

  /** Plain-language explanation (tooltip / Inspect). */
  description: string;

  /** Per-registry default surface. */
  defaultSurface: NodeLabelSurface;

  /** Per-registry disposition gate. */
  disposition: NodeLabelDisposition;

  /** Priority for overflow ordering — lower = higher priority. */
  priority: number;

  /** True when eligible for the default Timeline node strip. */
  visibleByDefault: boolean;

  /** Optional confidence band (carried only when the mark is emitted). */
  confidence?: 'low' | 'medium' | 'high';

  // ── MCP-021A new fields (BINDING; all 8 required per Trigger 12) ──

  /** Family classification. */
  family: MachineObservationFamily;

  /** The exact yes/no question the MCP server answers for a given move.
   *  Designed to be answerable from move + parent move only. NEVER
   *  user-facing. Length: 20-300 characters typical. */
  booleanQuestion: string;

  /** Verbose internal definition of what makes the boolean TRUE.
   *  Used by the MCP prompt; surfaced in operator audit; not user-facing.
   *  Length: 50-600 characters typical. */
  positiveDefinition: string;

  /** Verbose internal definition of what makes the boolean FALSE.
   *  Length: 50-600 characters typical. */
  negativeDefinition: string;

  /** 2-5 concrete examples that would return TRUE. Each entry is a
   *  short scenario / quote. Used by MCP prompt + tests. NEVER
   *  user-facing. */
  positiveExamples: ReadonlyArray<string>;

  /** 2-5 concrete near-misses that would return FALSE despite
   *  superficial similarity to TRUE cases. */
  negativeExamples: ReadonlyArray<string>;

  /** ≥1 pattern that looks positive but isn't (anti-hallucination
   *  guardrails for the MCP server prompt). Used by MCP prompt + tests. */
  falsePositiveGuards: ReadonlyArray<string>;

  /** ≥1 doctrine-anchor citation (cdiscourse-doctrine §X,
   *  point-standing-economy §Y, evidence-doctrine §Z). Tests enforce ≥1. */
  doctrineNotes: ReadonlyArray<string>;

  /** Confidence eligibility per rendering surface. */
  confidenceEligibility: MachineObservationConfidenceEligibility;
}
