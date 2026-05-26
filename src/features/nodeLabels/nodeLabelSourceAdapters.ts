/**
 * UX-001.5A — Source adapters.
 *
 * Six pure-TS adapter functions, one per source category. Each adapter
 * is deterministic: same input → same output. Source 1/2/3 emit
 * non-empty marks for present inputs; Source 4 and Source 5 (node-mount)
 * return `[]` UNCONDITIONALLY in v1 per the source-access audit + intent
 * brief Decisions 1, 2, 4 (binding).
 *
 * MCP-021B — Source 6 (raw classifier binaries) is now persisted-rows-
 * aware. It returns `[]` for every caller that does NOT supply the
 * optional `persistedClassifierRows` input (byte-equal pre-MCP-021B
 * behavior); when persisted rows ARE supplied, it delegates to
 * `mapPersistedObservationRowsToNodeLabelMarks`. The function never
 * calls MCP live; MCP-021C wires the live execution path separately
 * via a service-role Edge Function.
 *
 * Stop conditions inherited from UX-001.5A implementer prompt:
 *   - 17 (Source 4): emit non-empty here → HALT. Enforced at the
 *     function level (empty literal return).
 *   - 18 (Source 5 node-mount): emit non-empty here → HALT. Enforced
 *     at the function level (empty literal return).
 *
 * Doctrine anchor: cdiscourse-doctrine §10a — the schema boundary is
 * load-bearing. Adapters never collapse Observations and Allegations.
 *
 * Pure TS. No React. Source 6's MCP-021B path uses no Supabase / network
 * directly — the persisted rows are pre-fetched upstream by the room
 * loader and threaded in as a pure data input.
 */

import type { ManualTagCode, ManualTagEntry } from '../metadata/moveMetadataLedger';
import type { AutoMetadataCode } from '../metadata/moveMetadataLedger';
import type { PointLifecycleState } from '../lifecycle/pointLifecycleModel';
import { lookupMachineObservation } from './machineObservationRegistry';
import { USER_ALLEGATION_REGISTRY } from './userAllegationRegistry';
import type { NodeLabelMark } from './nodeLabelTypes';
import {
  mapPersistedObservationRowsToNodeLabelMarks,
  type MachineObservationPersistenceSurface,
} from './machineObservationPersistenceAdapter';

// ── Source 1 — Manual tags (User Allegations) ─────────────────────

export interface ManualTagAdapterInput {
  /** Hydrated rows from `pointTagsByArgumentId` for the active node. */
  manualTagEntries: ReadonlyArray<ManualTagEntry>;
  /** The message id this node corresponds to. */
  messageId: string;
}

/**
 * Adapter — Source 1 (manual tags). Pure.
 *
 * Maps each `ManualTagEntry` to a `NodeLabelMark` via the User Allegation
 * registry. Unknown codes (theoretically reachable if the schema gains a
 * new manual tag before this registry updates) are dropped — never echoed.
 *
 * Audit reference: `src/features/metadata/pointTagsApi.ts:150-174`
 * (`persistedTagsToManualTagEntries`) is the hydration path. This
 * adapter consumes the hydrated entries; it does NOT re-fetch.
 */
export function adaptManualTagSource(input: ManualTagAdapterInput): NodeLabelMark[] {
  const out: NodeLabelMark[] = [];
  if (!input || !Array.isArray(input.manualTagEntries)) return out;
  if (typeof input.messageId !== 'string' || input.messageId.length === 0) return out;
  for (const entry of input.manualTagEntries) {
    if (!entry || typeof entry.code !== 'string') continue;
    // Bounded cast — USER_ALLEGATION_REGISTRY only keys ManualTagCode; foreign
    // codes (theoretically possible if the schema gained a new tag before
    // this registry updated) produce undefined → drop silently.
    const registryEntry = USER_ALLEGATION_REGISTRY[entry.code as ManualTagCode];
    if (!registryEntry) continue; // Unknown code — drop, never echo.
    out.push({
      ...registryEntry,
      id: `user_allegation:manual_tag:${entry.code}:${input.messageId}`,
    });
  }
  return out;
}

// ── Source 2 — Auto metadata (Machine Observations) ───────────────

export interface AutoMetadataAdapterInput {
  /** Pre-derived auto-metadata code list for this node from
   *  `metadataLedger.byMessage.get(messageId).autoDerivedMetadata.map(e => e.code)`. */
  autoMetadataCodes: ReadonlyArray<AutoMetadataCode>;
  messageId: string;
}

/**
 * Adapter — Source 2 (auto metadata). Pure.
 *
 * Maps each `AutoMetadataCode` to a `NodeLabelMark` via the Machine
 * Observation registry's compound key (source: 'auto_metadata' + rawKey).
 * The deriver (`deriveAutoMetadataForMessage`) runs upstream — this
 * adapter ONLY reads pre-derived output. Per audit §Source 2, the
 * deriver is pure + deterministic; identical inputs across viewers
 * produce identical outputs.
 *
 * Doctrine: per `autoMetadataModel.ts:1-42`, no code is inferred from
 * heat / popularity / engagement / strength bands / AI annotation.
 */
export function adaptAutoMetadataSource(input: AutoMetadataAdapterInput): NodeLabelMark[] {
  const out: NodeLabelMark[] = [];
  if (!input || !Array.isArray(input.autoMetadataCodes)) return out;
  if (typeof input.messageId !== 'string' || input.messageId.length === 0) return out;
  for (const code of input.autoMetadataCodes) {
    if (typeof code !== 'string') continue;
    const registryEntry = lookupMachineObservation('auto_metadata', code);
    if (!registryEntry) continue;
    // Defensive — registry should never return a non-auto_metadata entry
    // for the 'auto_metadata' compound source. Belt-and-suspenders.
    if (registryEntry.source !== 'auto_metadata') continue;
    out.push({
      ...registryEntry,
      id: `machine_observation:auto_metadata:${code}:${input.messageId}`,
    });
  }
  return out;
}

// ── Source 3 — Lifecycle state (Machine Observations) ─────────────

export interface LifecycleAdapterInput {
  /** Cluster-level lifecycle state for this node's cluster. */
  clusterState: PointLifecycleState;
  /** Per-message contribution (often differs from cluster state). */
  messageContribution: PointLifecycleState | null;
  messageId: string;
}

/**
 * Adapter — Source 3 (lifecycle). Pure.
 *
 * Emits up to TWO marks per node: one for the cluster-level state and
 * (when distinct) one for the message-level contribution. The
 * presentation model dedupes if both resolve to the same `rawKey`.
 *
 * Doctrine: per `pointLifecycleModel.ts:75-78`, no state inferred from
 * truth / winner / loser / correctness / heat / popularity.
 * `ignored_by_*` states label a cluster on a side, NEVER a person.
 */
export function adaptLifecycleSource(input: LifecycleAdapterInput): NodeLabelMark[] {
  const out: NodeLabelMark[] = [];
  if (!input || typeof input.messageId !== 'string' || input.messageId.length === 0) {
    return out;
  }
  if (typeof input.clusterState === 'string' && input.clusterState.length > 0) {
    const clusterEntry = lookupMachineObservation('lifecycle', input.clusterState);
    if (clusterEntry && clusterEntry.source === 'lifecycle') {
      out.push({
        ...clusterEntry,
        id: `machine_observation:lifecycle:cluster:${input.clusterState}:${input.messageId}`,
      });
    }
  }
  if (
    input.messageContribution !== null &&
    typeof input.messageContribution === 'string' &&
    input.messageContribution.length > 0 &&
    input.messageContribution !== input.clusterState
  ) {
    const msgEntry = lookupMachineObservation('lifecycle', input.messageContribution);
    if (msgEntry && msgEntry.source === 'lifecycle') {
      out.push({
        ...msgEntry,
        id: `machine_observation:lifecycle:message:${input.messageContribution}:${input.messageId}`,
      });
    }
  }
  return out;
}

// ── Source 4 — Composition mutations (future_source v1) ───────────

export interface CompositionMutationAdapterInput {
  messageId: string;
  /** Reserved for future_source consumption. v1 ignores. */
  mutations?: ReadonlyArray<unknown>;
}

/**
 * Adapter — Source 4 (composition mutations). Pure.
 *
 * v1 returns `[]` UNCONDITIONALLY per:
 *   - Audit verdict (`docs/audits/UX-001.5A-source-access-audit.md`
 *     §Source 4): composition mutations populate `mutationsByMoveIdRef`
 *     (`src/features/arguments/useSemanticReferee.ts:325`) ONLY when the
 *     local viewer is the move's poster, and ONLY for the current
 *     session (in-memory React ref; not persisted). Cross-actor
 *     visibility limit is the load-bearing reason.
 *   - Intent brief Decision 1 (binding): "Source 4 adapter returns `[]`
 *     unconditionally in v1 (adapter-with-empty-fallback per roadmap
 *     line 125)."
 *
 * Implementer Stop Condition 17: emit non-empty here → HALT. The empty
 * literal return is enforced at the function level — no `if`-branch can
 * change it without an explicit code edit + a re-audit of audit
 * §Source 4.
 *
 * Do NOT change without filing UX-001.5B.
 */
export function adaptCompositionMutationSource(
  _input: CompositionMutationAdapterInput,
): NodeLabelMark[] {
  // future_source — see jsdoc above. Never returns non-empty in v1.
  return [];
}

// ── Source 5 — Semantic referee ───────────────────────────────────
//
// Two adapter functions — one for each disposition path. Composer-only
// is rendered_now in v1; node-mount is future_source.

export interface SemanticRefereeComposerAdapterInput {
  /** Composer-only Observation codes the semantic-referee classifier
   *  fired positively for the just-posted move. */
  composerOnlyCodes: ReadonlyArray<string>;
  /** The just-posted move's id. */
  moveId: string;
}

/**
 * Adapter — Source 5 (composer-only path). Pure.
 *
 * Emits Machine Observations with `source: 'semantic_referee'` and
 * `disposition: 'composer_only'`. Output feeds
 * `RefereeBannerView.observationChips` AT THE CALL SITE (this adapter
 * does not mount anything).
 *
 * Sensitive IDs (`shifts_to_person_or_intent`,
 * `contains_unplayable_insult_only`, `needs_pre_send_pause`) are the
 * primary expected input; other composer_only entries can be added in
 * the registry without changing this adapter.
 *
 * Audit reference:
 * `src/features/refereeBanners/RefereeBannerView.tsx:85-101` already
 * exposes the `observationChips?: ReadonlyArray<AnnotationChipDescriptor>`
 * prop. The call-site wire (intent brief §"Read-only API boundaries")
 * passes these descriptors via the existing optional prop.
 */
export function adaptSemanticRefereeSourceComposer(
  input: SemanticRefereeComposerAdapterInput,
): NodeLabelMark[] {
  const out: NodeLabelMark[] = [];
  if (!input || !Array.isArray(input.composerOnlyCodes)) return out;
  if (typeof input.moveId !== 'string' || input.moveId.length === 0) return out;
  for (const code of input.composerOnlyCodes) {
    if (typeof code !== 'string') continue;
    const registryEntry = lookupMachineObservation('semantic_referee', code);
    if (!registryEntry) continue;
    if (registryEntry.disposition !== 'composer_only') continue;
    out.push({
      ...registryEntry,
      id: `machine_observation:semantic_referee:composer:${code}:${input.moveId}`,
    });
  }
  return out;
}

export interface SemanticRefereeNodeMountAdapterInput {
  messageId: string;
  /** Reserved for future_source consumption. v1 ignores. */
  refereePacket?: unknown;
}

/**
 * Adapter — Source 5 (node-mount path). Pure.
 *
 * v1 returns `[]` UNCONDITIONALLY per:
 *   - Audit verdict §Source 5: `refereeStateByMoveId` is React state
 *     populated only via the `onMovePosted` path
 *     (`useSemanticReferee.ts:419-426`); state is local-actor + just-
 *     posted-only; not visible to other viewers; not persisted across
 *     reloads.
 *   - Intent brief Decision 2 (binding): "Source 5 composer-only vs
 *     Timeline-node split: ACCEPTED for v1." Composer-only ships in v1;
 *     node-mount is future_source.
 *
 * Implementer Stop Condition 18: emit non-empty here → HALT.
 *
 * UX-001.5B (or equivalent persistence card) would wire this adapter
 * once classifier output rows persist. Until then this returns `[]`.
 */
export function adaptSemanticRefereeSourceNodeMount(
  _input: SemanticRefereeNodeMountAdapterInput,
): NodeLabelMark[] {
  return [];
}

// ── Source 6 — Raw classifier binaries (MCP-021B persisted) ───────

export interface RawClassifierBinaryAdapterInput {
  messageId: string;
  /** Reserved for future_source consumption; pre-MCP-021B callers ignored. */
  binaries?: ReadonlyArray<unknown>;
  /**
   * MCP-021B — Persisted Machine Observation result rows for THIS message,
   * pre-fetched by the room loader. When absent OR empty, the adapter
   * returns `[]` (byte-equal pre-MCP-021B behavior). When supplied with
   * valid rows, the adapter delegates to
   * `mapPersistedObservationRowsToNodeLabelMarks`. The pipeline never
   * calls MCP live; MCP-021C wires the live execution path separately.
   */
  persistedClassifierRows?: ReadonlyArray<unknown>;
  /**
   * MCP-021B — Target surface for confidence-floor gating. Defaults to
   * `'timeline_node'` for safety (highest confidence floor; least
   * surface noise). Inspect path can request `'inspect'` to permit
   * lower-confidence rows.
   */
  surface?: MachineObservationPersistenceSurface;
}

/**
 * Adapter — Source 6 (raw classifier binaries). Pure.
 *
 * MCP-021B contract: returns `[]` for every existing caller that does
 * NOT supply `persistedClassifierRows` (backwards-compatible with the
 * pre-MCP-021B v1 behavior and with the MCP-021A invariance test). When
 * a caller DOES supply persisted rows, the adapter delegates to
 * `mapPersistedObservationRowsToNodeLabelMarks` which applies four
 * filters in order (schema_version → rawKey registry membership →
 * confidence floor → evidence_span truncation) and silently drops every
 * row that fails any filter.
 *
 * Pre-MCP-021B behavior preserved:
 *   - No `messageId` / empty `messageId` → `[]`
 *   - No `persistedClassifierRows` / empty → `[]`
 *   - Pre-existing callers that pass only `{ messageId, binaries }` →
 *     `[]` (the `binaries` slot remains reserved for future_source)
 *
 * Doctrine:
 *   - cdiscourse-doctrine §10a — emitted marks keep
 *     `kind: 'machine_observation'`; never `user_allegation`.
 *   - cdiscourse-doctrine §9 — labels are sourced from the MCP-021A
 *     definition registry; raw_keys never appear in user-facing copy.
 *   - cdiscourse-doctrine §3 — engagement / popularity / heat are NOT
 *     inputs; the persisted-rows path consumes only structural
 *     classifier output.
 */
export function adaptRawClassifierBinarySource(
  input: RawClassifierBinaryAdapterInput,
): NodeLabelMark[] {
  if (!input || typeof input.messageId !== 'string' || input.messageId.length === 0) {
    return [];
  }
  const persisted = input.persistedClassifierRows;
  if (!Array.isArray(persisted) || persisted.length === 0) {
    return [];
  }
  return mapPersistedObservationRowsToNodeLabelMarks(persisted, {
    argumentId: input.messageId,
    surface: input.surface ?? 'timeline_node',
  });
}

// ── Convenience aggregator ────────────────────────────────────────

export interface PerNodeMarkInput {
  manualTagMarks: ReadonlyArray<NodeLabelMark>;
  autoMetadataMarks: ReadonlyArray<NodeLabelMark>;
  lifecycleMarks: ReadonlyArray<NodeLabelMark>;
  /** v1 always [] — Source 4 future_source. */
  compositionMutationMarks: ReadonlyArray<NodeLabelMark>;
  /** v1 always [] — Source 5 node-mount future_source. */
  semanticRefereeNodeMountMarks: ReadonlyArray<NodeLabelMark>;
  /** MCP-021B: empty when no persisted rows are threaded into Source 6;
   *  populated when a caller passes `persistedClassifierRows` via
   *  `adaptAllSourcesForNode`. */
  rawClassifierMarks: ReadonlyArray<NodeLabelMark>;
}

/**
 * Aggregate per-node marks from every source. Used by `NodeLabelStrip`
 * (Timeline node) and `NodeLabelInspectGroups` (Inspect popout). Pure.
 *
 * The composer-only adapter is NOT called here — composer-only chips
 * flow through `RefereeBannerView.observationChips` via a separate
 * call-site wire in `ArgumentGameSurface.tsx`.
 *
 * MCP-021B — additive optional `persistedClassifierRows` + `surface`
 * inputs thread persisted Machine Observation rows through Source 6.
 * Pre-MCP-021B callers omit both and receive `[]` byte-equal for
 * `rawClassifierMarks` (preserves MCP-021A invariance contract).
 */
export function adaptAllSourcesForNode(input: {
  manualTagEntries: ReadonlyArray<ManualTagEntry>;
  autoMetadataCodes: ReadonlyArray<AutoMetadataCode>;
  clusterState: PointLifecycleState;
  messageContribution: PointLifecycleState | null;
  messageId: string;
  /** MCP-021B — Persisted Machine Observation rows for this message.
   *  Pre-MCP-021B callers may omit. */
  persistedClassifierRows?: ReadonlyArray<unknown>;
  /** MCP-021B — Surface gate for the raw-classifier adapter. Defaults
   *  to `'timeline_node'`. */
  surface?: MachineObservationPersistenceSurface;
}): PerNodeMarkInput {
  return {
    manualTagMarks: adaptManualTagSource({
      manualTagEntries: input.manualTagEntries,
      messageId: input.messageId,
    }),
    autoMetadataMarks: adaptAutoMetadataSource({
      autoMetadataCodes: input.autoMetadataCodes,
      messageId: input.messageId,
    }),
    lifecycleMarks: adaptLifecycleSource({
      clusterState: input.clusterState,
      messageContribution: input.messageContribution,
      messageId: input.messageId,
    }),
    // v1: Source 4 + Source 5 node-mount return [] unconditionally.
    compositionMutationMarks: adaptCompositionMutationSource({
      messageId: input.messageId,
    }),
    semanticRefereeNodeMountMarks: adaptSemanticRefereeSourceNodeMount({
      messageId: input.messageId,
    }),
    // MCP-021B: Source 6 returns [] when no persisted rows are threaded.
    rawClassifierMarks: adaptRawClassifierBinarySource({
      messageId: input.messageId,
      persistedClassifierRows: input.persistedClassifierRows,
      surface: input.surface,
    }),
  };
}
