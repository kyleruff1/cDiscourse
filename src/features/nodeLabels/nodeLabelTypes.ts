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
