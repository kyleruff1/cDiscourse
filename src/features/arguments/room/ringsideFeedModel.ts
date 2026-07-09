/**
 * ROOM-002 (#885) — ringsideFeedModel.
 *
 * Pure-TS projection that turns the data the orchestrator already holds
 * (ArgumentBubbleViewModel list + per-message enrichment) into Ringside card
 * view-models: kind-color spines, a quote/context chip, proof + owed-receipt
 * indicators, an inline branch pill, and ONE actor-aware action row per card.
 *
 * Doctrine (cdiscourse-doctrine, timeline-grammar):
 *   - Conversation-first: the card face carries NO standing / heat / classifier
 *     data. Those reads live behind the shared Inspect popout + the Map sidecar
 *     (ROOM-004). This model never derives standing / tone / temperature.
 *   - The action row REUSES two existing derivations: participant controls come
 *     from the view-model allowedControls (already actor-gated by
 *     getBubbleControlsForActor); observer actions are injected as a function so
 *     this pure model never imports the React rail component.
 *   - No verdict tokens. No AI. No Supabase. No network. No React.
 *
 * The kind-color spine is joined from the timeline node kindColorFamily (NOT
 * the display kindLabel, which is a phrase like counter-rebuttal that does not
 * map through the color family). The orchestrator injects the join function.
 */
import {
  TIMELINE_KIND_COLORS,
  type ArgumentBubbleActor,
  type ArgumentBubbleControl,
  type ArgumentBubbleViewModel,
  type TimelineKindColorFamily,
} from '../argumentGameSurfaceModel';
import type { RailAction, RailViewerRole } from '../railActionCategories';

/** One Ringside card, projected from data the orchestrator already holds. */
export interface RingsideCardViewModel {
  messageId: string;
  /** 1-based chronological index (from the view-model). */
  ordinal: number;
  /** Color-independent author label from the view-model actor. */
  actorLabel: string;
  actor: ArgumentBubbleActor;
  /** Side label (Aff / Neg / Obs / Mod / dash) from the view-model. */
  sideLabel: string;
  /** Human-facing argument-type label from the view-model. */
  kindLabel: string;
  /** Spine color family, joined from the timeline node. */
  kindColorFamily: TimelineKindColorFamily;
  /** TIMELINE_KIND_COLORS lookup for the family. */
  spineColor: string;
  /** Body text, already redacted upstream. */
  body: string;
  createdAtLabel: string;
  relativeLabel: string;
  /** parentHint — the reply-context excerpt (NOT the move own targetExcerpt). */
  quoteChip: string | null;
  /** Parent message id, joined from the timeline node. Drives the quote-chip
   *  ancestor activation. Null for a root move. */
  parentMessageId: string | null;
  /** Count of attached evidence artifacts for this move. */
  proofChipCount: number;
  /** True when an evidence debt is owed on this move. */
  owedReceiptChip: boolean;
  /** Reply / descendant count deep-link to the Map. Null when zero. */
  branchPill: RingsideBranchPill | null;
  /** Count of the calm friendly-flag surface for this card (active card only). */
  friendlyFlagCount: number;
  isActive: boolean;
  isLatest: boolean;
  /** actor === self. */
  isOwn: boolean;
  deletionRequested: boolean;
  /** The FULL actor-aware action contract for this card. */
  actionRow: RingsideActionRow;
}

export interface RingsideBranchPill {
  /** node.descendantCount (0 hides the pill). */
  descendantCount: number;
  /** Plain activity count, e.g. "3 replies". No heat / verdict framing. */
  label: string;
}

/** Actor-aware action row. Exactly one of the two variants is populated. */
export type RingsideActionRow =
  | { kind: 'participant'; controls: ArgumentBubbleControl[] }
  | { kind: 'observer'; actions: RailAction[] };

export interface RingsideFeedViewModel {
  cards: RingsideCardViewModel[];
  activeMessageId: string | null;
}

/** Injected per-message join data. All pure functions the orchestrator owns. */
export interface RingsideFeedInput {
  viewModels: ArgumentBubbleViewModel[];
  viewerRole: RailViewerRole;
  activeMessageId: string | null;
  /**
   * Spine family for a message, joined from the timeline node. Defaults to
   * default (slate) when a node is missing.
   */
  kindColorFamilyFor: (messageId: string) => TimelineKindColorFamily;
  /** node.descendantCount for a message. Defaults handled by the caller. */
  descendantCountFor: (messageId: string) => number;
  /** Parent message id for a message, joined from the timeline node. Null at root. */
  parentMessageIdFor: (messageId: string) => string | null;
  /** Count of attached evidence artifacts for a message. */
  proofChipCountFor: (messageId: string) => number;
  /** True when an evidence debt is owed on the message. */
  owedReceiptFor: (messageId: string) => boolean;
  /**
   * Observer action set for an actor. Injected so this pure model never
   * imports the React rail. The orchestrator passes
   * (actor) => getRailActions(observer, actor).
   */
  observerActionsFor: (actor: ArgumentBubbleActor) => RailAction[];
  /**
   * Optional friendly-flag count for a message (active card only). Defaults
   * to 0 so a caller that does not thread flags still produces a valid model.
   */
  friendlyFlagCountFor?: (messageId: string) => number;
}

/** Build the plain branch-pill label. Activity count, never heat / verdict. */
export function buildBranchPill(descendantCount: number): RingsideBranchPill | null {
  const n = Number.isFinite(descendantCount) ? Math.max(0, Math.trunc(descendantCount)) : 0;
  if (n <= 0) return null;
  return { descendantCount: n, label: `${n} ${n === 1 ? 'reply' : 'replies'}` };
}

/** Build one card view-model from a bubble view-model + injected joins. */
function buildRingsideCard(
  vm: ArgumentBubbleViewModel,
  total: number,
  input: RingsideFeedInput,
): RingsideCardViewModel {
  const family = input.kindColorFamilyFor(vm.messageId);
  const spineColor = TIMELINE_KIND_COLORS[family] ?? TIMELINE_KIND_COLORS.default;
  const isOwn = vm.actor === 'self';
  const actionRow: RingsideActionRow =
    input.viewerRole === 'observer'
      ? { kind: 'observer', actions: input.observerActionsFor(vm.actor).slice() }
      : { kind: 'participant', controls: vm.allowedControls.slice() };
  const friendlyFlagCount = input.friendlyFlagCountFor
    ? Math.max(0, Math.trunc(input.friendlyFlagCountFor(vm.messageId)) || 0)
    : 0;
  return {
    messageId: vm.messageId,
    ordinal: vm.ordinal,
    actorLabel: actorLabelFor(vm.actor),
    actor: vm.actor,
    sideLabel: vm.sideLabel,
    kindLabel: vm.kindLabel,
    kindColorFamily: family,
    spineColor,
    body: vm.body,
    createdAtLabel: vm.createdAtLabel,
    relativeLabel: vm.relativeLabel,
    quoteChip: vm.parentHint ?? null,
    parentMessageId: input.parentMessageIdFor(vm.messageId) ?? null,
    proofChipCount: Math.max(0, Math.trunc(input.proofChipCountFor(vm.messageId)) || 0),
    owedReceiptChip: input.owedReceiptFor(vm.messageId) === true,
    branchPill: buildBranchPill(input.descendantCountFor(vm.messageId)),
    friendlyFlagCount,
    isActive: vm.isActive,
    isLatest: vm.isLatest,
    isOwn,
    deletionRequested: vm.deletionRequested,
    actionRow,
  };
}

/** Color-independent author label. Never depends on side or standing. */
export function actorLabelFor(actor: ArgumentBubbleActor): string {
  switch (actor) {
    case 'self':
      return 'You';
    case 'bot':
      return 'Bot';
    case 'admin':
      return 'Admin';
    case 'other':
    case 'unknown':
    default:
      return 'Other voice';
  }
}

/**
 * Build the full Ringside feed view-model. Pure projection; total ordering is
 * the caller-supplied view-model order (already chronological).
 */
export function buildRingsideFeed(input: RingsideFeedInput): RingsideFeedViewModel {
  if (!input || !Array.isArray(input.viewModels)) {
    return { cards: [], activeMessageId: null };
  }
  const total = input.viewModels.length;
  const cards = input.viewModels.map((vm) => buildRingsideCard(vm, total, input));
  return { cards, activeMessageId: input.activeMessageId ?? null };
}
