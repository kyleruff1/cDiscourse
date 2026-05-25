/**
 * UX-001.3 — Composer "Acting on" derivation (pure TypeScript).
 *
 * The brief's coordination rule (§"The selected-message readout
 * coordination"):
 *   "the readout names what is selected; the composer names what the user
 *    is acting on; these are typically the same node but may diverge
 *    during type switches"
 *
 * UX-001.3 keeps the existing single source of truth for `activeMessageId`
 * in `ArgumentGameSurface.tsx`. The composer READS that id (via a new
 * optional prop) but never writes it. The composer's `parentArgument`
 * remains the source of truth for what the composer POSTS against.
 *
 * When `activeMessageId !== parentArgument.id`, the composer surfaces a
 * small "divergence cue" — composer-only, never in the readout panel.
 * UX-001.2's `TimelineSelectedReadoutPanel` is unchanged.
 *
 * Doctrine:
 *  - Pure TypeScript. No React. No Supabase. No network. No `Date.now()`.
 *  - No verdict tokens. The cue describes a STRUCTURAL state ("A
 *    different move is selected on the Timeline."), never a judgment.
 *  - No internal-code leaks (no `activeMessageId`, no `parentArgumentId`
 *    in user-facing strings).
 *
 * Pure TS. No new dependency.
 */

import type { BoxType } from '../oneBox/boxModel';

/** Inputs to the derivation. */
export interface ComposerActingOnInput {
  /**
   * The Timeline's currently-selected message id, or `null` when nothing
   * is selected. Read-only from `ArgumentGameSurface.activeMessageId`.
   */
  activeMessageId: string | null;
  /**
   * The composer's bound parent argument id, or `null` for a root-claim
   * context (no parent — the composer is composing the room's first
   * argument).
   */
  parentArgumentId: string | null;
  /** The composer's current box type — used for the per-mode main label. */
  boxType: BoxType;
  /**
   * A short body excerpt for the bound parent argument. The composer
   * builds this from `parentArgument.body.slice(0, N)` at the call
   * site; this model never imports React or query types. `null` when no
   * parent is bound.
   */
  parentBodyExcerpt: string | null;
  /**
   * The parent argument's Constitution type label (e.g. `'Claim'`,
   * `'Rebuttal'`), for the per-mode main label. `null` when no parent.
   */
  parentTypeLabel: string | null;
  /**
   * Optional debate context for root-claim mode. The composer's strip
   * names the new-room context when `boxType === 'root_claim'`. The
   * resolution excerpt is built at the call site.
   */
  resolutionExcerpt?: string | null;
  /**
   * Optional cluster context for `synthesize` mode. The composer's
   * strip names the cluster being synthesized.
   */
  clusterMemberCount?: number | null;
  /** Optional summary excerpt for the cluster, when relevant. */
  clusterSummaryExcerpt?: string | null;
  /**
   * Optional incoming-concession context for `respond_to_concession`
   * mode. The composer's strip names the conceded-points count.
   */
  conversationItemCount?: number | null;
  /** Optional target excerpt for evidence / concession-set targets. */
  conversationTargetExcerpt?: string | null;
}

/** Output of the derivation — drives the `ComposerContextStrip` render. */
export interface ComposerActingOnLabel {
  /**
   * The main one-line label shown in the compact target strip. Plain
   * English, ≤ ~140 characters before ellipsis. The composer applies
   * `numberOfLines={1}` + `ellipsizeMode="tail"`.
   */
  mainLabel: string;
  /**
   * A small advisory line shown ONLY when the Timeline's active node
   * differs from the composer's bound parent. `null` when they agree
   * (the typical case). The cue is composer-only — never duplicated in
   * the readout panel.
   *
   * Plain English. Structural ("A different move is selected on the
   * Timeline."), never accusatory.
   */
  divergenceCue: string | null;
}

/**
 * The divergence cue copy. Centralised so the doctrine ban-list test
 * can scan one string instead of chasing template literals.
 *
 * No verdict tokens: this describes a STATE of the Timeline (a different
 * node is selected), not a judgment about anyone.
 */
export const COMPOSER_DIVERGENCE_CUE =
  'A different move is selected on the Timeline.';

/**
 * Per-mode main-label templates. Each template builds a one-line
 * "Acting on" description suitable for the compact strip. Plain
 * English; no internal codes; no verdict tokens.
 *
 * The templates accept the already-truncated excerpts; truncation
 * happens at the call site so this pure model stays excerpt-length
 * neutral.
 */
function buildMainLabel(input: ComposerActingOnInput): string {
  const typeLabel = input.parentTypeLabel ?? 'move';
  const excerpt = input.parentBodyExcerpt ?? '';
  // For modes that target a parent argument, we render in the form:
  //   "<verb> <typeLabel> · "<excerpt>…"
  // For modes without a parent (root_claim, synthesize, respond_to_concession),
  // we render the appropriate alternative.
  switch (input.boxType) {
    case 'root_claim': {
      const resolution = input.resolutionExcerpt ?? '';
      return resolution
        ? `New argument · "${resolution}"`
        : 'New argument';
    }
    case 'respond':
      // Reply / Challenge variant is decided by the composer header chip;
      // the strip just names the target as "Respond to <type>".
      return excerpt
        ? `Respond to ${typeLabel} · "${excerpt}"`
        : `Respond to ${typeLabel}`;
    case 'branch_tangent':
      return excerpt
        ? `Side issue off ${typeLabel} · "${excerpt}"`
        : `Side issue off ${typeLabel}`;
    case 'synthesize': {
      const count = input.clusterMemberCount ?? 0;
      const summary = input.clusterSummaryExcerpt ?? '';
      if (count > 0 && summary) {
        return `Synthesize ${count} move${count === 1 ? '' : 's'} · "${summary}"`;
      }
      if (count > 0) {
        return `Synthesize ${count} move${count === 1 ? '' : 's'}`;
      }
      return excerpt
        ? `Synthesize · "${excerpt}"`
        : 'Synthesize';
    }
    case 'add_evidence':
      return excerpt
        ? `Add evidence to ${typeLabel} · "${excerpt}"`
        : `Add evidence to ${typeLabel}`;
    case 'respond_to_evidence':
      return excerpt
        ? `Respond to evidence · "${excerpt}"`
        : 'Respond to evidence';
    case 'ask_source':
      return excerpt
        ? `Ask source for ${typeLabel} · "${excerpt}"`
        : `Ask source for ${typeLabel}`;
    case 'ask_quote':
      return excerpt
        ? `Ask quote for ${typeLabel} · "${excerpt}"`
        : `Ask quote for ${typeLabel}`;
    case 'clarify':
      return excerpt
        ? `Clarify ${typeLabel} · "${excerpt}"`
        : `Clarify ${typeLabel}`;
    case 'narrow':
      return excerpt
        ? `Narrow ${typeLabel} · "${excerpt}"`
        : `Narrow ${typeLabel}`;
    case 'confirm':
      return excerpt
        ? `Confirm ${typeLabel} · "${excerpt}"`
        : `Confirm ${typeLabel}`;
    case 'offer_concession':
      return excerpt
        ? `Offer concession on ${typeLabel} · "${excerpt}"`
        : `Offer concession on ${typeLabel}`;
    case 'respond_to_concession': {
      const count = input.conversationItemCount ?? 0;
      const target = input.conversationTargetExcerpt ?? '';
      const noun = count === 1 ? 'concession' : 'concessions';
      if (count > 0 && target) {
        return `Respond to ${count} ${noun} · "${target}"`;
      }
      if (count > 0) {
        return `Respond to ${count} ${noun}`;
      }
      return target
        ? `Respond to concession · "${target}"`
        : 'Respond to concession';
    }
    default: {
      // Exhaustiveness guard — unreachable for the typed union.
      const never: never = input.boxType;
      void never;
      return 'Composing';
    }
  }
}

/**
 * Derive the composer's acting-on label set.
 *
 * Pure. Deterministic. Idempotent on identical inputs.
 */
export function deriveComposerActingOnLabel(
  input: ComposerActingOnInput,
): ComposerActingOnLabel {
  const mainLabel = buildMainLabel(input);
  // The divergence cue fires only when BOTH ids are present and they
  // differ. Two `null`s (root-claim mode) → no cue; matching ids → no
  // cue; missing activeMessageId → no cue (the Timeline has nothing
  // selected, so there is nothing to diverge from).
  const divergenceCue =
    input.activeMessageId &&
    input.parentArgumentId &&
    input.activeMessageId !== input.parentArgumentId
      ? COMPOSER_DIVERGENCE_CUE
      : null;
  return { mainLabel, divergenceCue };
}
