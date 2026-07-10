/**
 * ASP-EXTRACT-001 (Slice 2) — ExchangeView, the stack (feed) lens.
 *
 * A thin pass-through wrapper over the shipped ArgumentBubbleStack (the
 * mode === stack branch of the room surface). It renders the exact stack
 * sub-tree the orchestrator used to render inline: the ArgumentBubbleStack
 * plus the conditional participant ArgumentBubbleActions chip cluster.
 *
 * ExchangeView owns NO state, NO derivation, NO handler. Every value arrives
 * as a prop from the orchestrator (ArgumentRoom). The observer gate on the
 * action chips (activeViewModel and viewerRole === participant) moved here
 * verbatim with the JSX, so the rendered behavior is byte-identical to the
 * former inline branch. This is the future Ringside Exchange target; today a
 * faithful extraction.
 *
 * Doctrine: ExchangeView does NOT re-derive the mediator board (that stays a
 * single derivation in the orchestrator) and does NOT touch band / heat /
 * standing rendering. No verdict tokens. No AI. No Supabase. No service-role.
 */
import React from 'react';
import { ArgumentBubbleStack } from '../ArgumentBubbleStack';
import { ArgumentBubbleActions } from '../ArgumentBubbleActions';
import type {
  ArgumentBubbleControl,
  ArgumentBubbleViewModel,
} from '../argumentGameSurfaceModel';
import type { CardDetailViewModel } from '../cardView/cardDetailModel';
import type { CardMappingSectionModel } from '../cardView/cardMappingSectionModel';
import type { RailViewerRole } from '../railActionCategories';
import type { DisagreementContract, MoveSuggestion } from '../../refereeLoop';
import type { RefereeNavVerb } from '../cardView/RefereeCardView';
import type { PrioritizedPointFeedbackFlags } from '../../feedbackFlags';
// ASP-EXTRACT-001 (Slice 2) — the rail-action code type is sourced from the
// shared room action-code registry so both lenses reference ONE handle. It
// aliases the shipped RailActionCode; no new code enters the type system.
import type { RoomRailActionCode } from './roomActionCodes';
// ROOM-002 (#885) — the Ringside feed is the flag-on Exchange lens. It is a
// NEW sibling to the stack; the stack subtree stays as the flag-off else
// branch, byte-identical, so the flag-off render is regression-proof.
import { RingsideFeed } from './RingsideFeed';
import type { RingsideFeedViewModel } from './ringsideFeedModel';
// MARK-002 (#894) — marker maps + callbacks passed straight through to the
// Ringside feed (all additive optional; absent when the flag is off).
import type { MarkerRow } from '../markers/timestampMarkerModel';
// FEEDBACK-001 (#898) — ghost feedback bar props passed straight through to the
// Ringside feed (all additive optional; absent when move_marks is off).
import type { MoveMarkCode, ViewerMoveMarkState } from '../../feedback/moveMarksModel';

export interface ExchangeViewProps {
  // ArgumentBubbleStack core inputs (forwarded verbatim).
  viewModels: ArgumentBubbleViewModel[];
  activeMessageId: string | null;
  windowWidth: number;
  viewerRole: RailViewerRole;
  activeCardDetail: CardDetailViewModel | null;
  activeMappingSection: CardMappingSectionModel | null;
  activeRefereeCard: DisagreementContract | null;
  pointFeedbackFlags: PrioritizedPointFeedbackFlags | null;

  // The conditional participant chip cluster input.
  activeViewModel: ArgumentBubbleViewModel | null;

  // Handlers (defined once in the orchestrator, passed already-bound).
  onActivate: (messageId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleMode: () => void;
  onActivateAncestor: (messageId: string) => void;
  onRailAction: (code: RoomRailActionCode, ctx: { activeMessageId: string | null }) => void;
  onRefereeMove: (move: MoveSuggestion, ctx: { activeMessageId: string | null }) => void;
  onRefereeNavigate: (verb: RefereeNavVerb, ctx: { activeMessageId: string | null }) => void;
  onBubbleAction: (control: ArgumentBubbleControl, messageId: string) => void;

  // ROOM-002 (#885) — flag-on Ringside re-weight. All optional so the flag-off
  // callers are unaffected. When roomExchangeV2Enabled is true AND ringsideFeed
  // is supplied, ExchangeView renders the Ringside feed; otherwise it renders
  // the stack subtree unchanged.
  roomExchangeV2Enabled?: boolean;
  ringsideFeed?: RingsideFeedViewModel | null;
  /** Branch-pill deep-link from a Ringside card into the Map lens. */
  onOpenMap?: () => void;
  /** Effective reduce-motion, threaded for symmetry (the feed is transform-free). */
  reduceMotion?: boolean;
  // MARK-002 (#894) — marker maps + callbacks, passed straight to the Ringside
  // feed. All absent when timestamp_rebuttals is off => byte-identical.
  markersByTargetId?: Record<string, ReadonlyArray<MarkerRow>>;
  markersByReplyId?: Record<string, ReadonlyArray<MarkerRow>>;
  isMarkerTargetLoaded?: (targetArgumentId: string) => boolean;
  onRespondToThis?: (messageId: string) => void;
  onOpenMarkerSource?: (targetArgumentId: string, markerId: string) => void;
  // FEEDBACK-001 (#898) — ghost feedback bar props, passed straight to the
  // Ringside feed. All absent when move_marks is off => byte-identical.
  moveMarksEnabled?: boolean;
  viewerMoveMarksFor?: (argumentId: string) => ViewerMoveMarkState;
  moveMarkErrorFor?: (argumentId: string) => string | undefined;
  showMoveMarkReceiptsFor?: (argumentId: string) => boolean;
  onMarkMove?: (argumentId: string, code: MoveMarkCode) => void;
  onUnmarkMove?: (argumentId: string, code: MoveMarkCode) => void;
}

/**
 * The stack (feed) lens. Renders the ArgumentBubbleStack plus the conditional
 * participant ArgumentBubbleActions. Presentational only; every value is a
 * prop.
 */
export function ExchangeView(props: ExchangeViewProps) {
  // ROOM-002 (#885) — flag-on renders the Ringside feed. The stack subtree
  // below is preserved verbatim as the flag-off else branch (byte-identical),
  // which keeps the argumentGameSurfaceSemanticWiring ArgumentBubbleStack pin
  // green and makes the flag-off render regression-proof. Every value the feed
  // needs is already a prop; the action row reuses onBubbleAction (participant)
  // and onRailAction (observer), the SAME handlers the stack path dispatches.
  if (props.roomExchangeV2Enabled && props.ringsideFeed) {
    return (
      <RingsideFeed
        feed={props.ringsideFeed}
        viewerRole={props.viewerRole}
        onActivate={props.onActivate}
        onActivateAncestor={props.onActivateAncestor}
        onCardAction={props.onBubbleAction}
        onRailAction={props.onRailAction}
        onOpenMap={props.onOpenMap ?? props.onToggleMode}
        pointFeedbackFlags={props.pointFeedbackFlags}
        reduceMotion={props.reduceMotion}
        markersByTargetId={props.markersByTargetId}
        markersByReplyId={props.markersByReplyId}
        isMarkerTargetLoaded={props.isMarkerTargetLoaded}
        onRespondToThis={props.onRespondToThis}
        onOpenMarkerSource={props.onOpenMarkerSource}
        moveMarksEnabled={props.moveMarksEnabled}
        viewerMoveMarksFor={props.viewerMoveMarksFor}
        moveMarkErrorFor={props.moveMarkErrorFor}
        showMoveMarkReceiptsFor={props.showMoveMarkReceiptsFor}
        onMarkMove={props.onMarkMove}
        onUnmarkMove={props.onUnmarkMove}
      />
    );
  }
  return (
    <>
            <ArgumentBubbleStack
              viewModels={props.viewModels}
              activeMessageId={props.activeMessageId}
              onActivate={props.onActivate}
              onPrevious={props.onPrevious}
              onNext={props.onNext}
              onToggleMode={props.onToggleMode}
              // CARD-VIEW-DATA-001 — exploded detail for the active card,
              // built once per activeMessageId above. The step-ref ancestor
              // tap reuses the single shared selection path (handleActivate),
              // so card + timeline selection never desync.
              activeCardDetail={props.activeCardDetail}
              // MCP-MAPPING-EXPANSION-001 (Slice B) — combination observations
              // for the active card, computed POST-STORAGE from the active
              // positive rawKeys of the active node above. Display-only; forwarded
              // active card only (the Stack gates on isActive).
              activeMappingSection={props.activeMappingSection}
              onActivateAncestor={props.onActivateAncestor}
              // CVDH-001 Slice 3 — viewport width drives the responsive hub
              // 3-col / stacked layout on the active card.
              windowWidth={props.windowWidth}
              // CARD-VIEW-REFINE-001 — inline "Actions on this point" zone on
              // the active card. The set is derived from the SAME
              // getRailActions(viewerRole, bubbleActor) the side rail uses;
              // dispatch goes through the SAME handleRailAction path, so the
              // inline subset and the rail can never diverge. These are USER
              // MOVES (Constitution-governed), not classifier verdicts.
              viewerRole={props.viewerRole}
              onRailAction={props.onRailAction}
              // REF-003 — the synthesized Referee Card for the active card,
              // derived POST-STORAGE above. Display-only; the Stack forwards it
              // to the active card only. Zone-3 moves deep-link through the
              // existing composer entry point (handleRefereeMove).
              activeRefereeCard={props.activeRefereeCard}
              onRefereeMove={props.onRefereeMove}
              // REF-004 — Inspect ("View details") + Go ("Focus on board")
              // verbs. Routes to the existing Inspect popout / setGoLens path;
              // no new write path.
              onRefereeNavigate={props.onRefereeNavigate}
              // VISUAL-SIMPLIFY-001 — the prioritized friendly flags for the
              // active point, computed once above and forwarded to the active
              // card as the single calm standing surface in the collapsed
              // default. Same derivation the timeline-path flag row consumes.
              pointFeedbackFlags={props.pointFeedbackFlags}
            />
            {/* Stage 6.4: legacy chip cluster is hidden in observer mode;
                the action rail below is the single entry point for both
                observer + participant flows. Participants still get the
                chip cluster for quick access on the active card. */}
            {props.activeViewModel && props.viewerRole === 'participant' ? (
              <ArgumentBubbleActions
                viewModel={props.activeViewModel}
                onAction={props.onBubbleAction}
              />
            ) : null}
    </>
  );
}
