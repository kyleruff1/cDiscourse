/**
 * QUOTE-FORGE-002 (#842) — the rendered-node callback echo model (pure TS).
 *
 * Reads the per-move callback ref #831 persisted (client_validation, ruling R1)
 * and joins it to the already-resolved QOL-042 link (three-state access) to
 * produce ONE woven-echo view-model per callback move, shared by all three
 * surfaces (Timeline node badge, Stack card, Ringside card) — the mediator-board
 * single-derivation rule.
 *
 * Ruling R2: the join key is `targetDebateId` (one QOL-042 link per target
 * room, so equivalent to a link-id join). Ruling R3: the deriver forces
 * `echoedExcerpt = ''` for the title-only / unavailable arms — this is a
 * UX-consistency render treatment, NOT an RLS / privacy boundary (the excerpt
 * bytes still sit in the broadly-readable client_validation JSONB; the client
 * simply does not render them). A ref with no matching link row renders the
 * unavailable arm — never an excerpt without an authorized access state.
 *
 * Pure TS. No React. No Supabase. No network. No `Date.now()`. No AI.
 */
import { readCrossRoomCallback, type CrossRoomCallbackRef } from './crossRoomCallbackRef';
import { CALLBACK_ECHO_COPY } from './callbackEchoCopy';

/** The three-state access a callback echo can be in (reused from QOL-042). */
export type CallbackEchoAccessState = 'authorized' | 'title_only' | 'unavailable';

/** One resolved prior link, assembled by the room shell from useLinkedPriorRooms. */
export interface ResolvedPriorLink {
  /** The prior room id (the R2 join key). */
  targetDebateId: string;
  /** The viewer access to the prior room content (reused from the QOL-042 chip). */
  accessState: CallbackEchoAccessState;
  /** The prior room title (live-or-snapshot; '' when unavailable). */
  title: string;
}

/** One woven-echo decoration for one callback move. */
export interface CallbackEchoViewModel {
  /** The current-room move this echo decorates. */
  messageId: string;
  /** The prior room being echoed; drives nav. Null when not tappable. */
  targetDebateId: string | null;
  /** The three-state access (reused from the QOL-042 chip, not re-derived). */
  accessState: CallbackEchoAccessState;
  /** The shared woven-callback glyph. */
  glyph: string;
  /** The shared identity label ("Woven callback"). */
  identityLabel: string;
  /** Prior room title for the origin line. '' when unavailable. */
  originTitle: string;
  /**
   * The echoed prior line. PRESENT ONLY in `authorized`. '' in title_only /
   * unavailable — the R3 render-time suppression (UX consistency, NOT RLS).
   */
  echoedExcerpt: string;
  /** True in title_only — the origin renders as a locked line. */
  isLocked: boolean;
  /** True only in authorized with a resolvable target — tapping opens the room. */
  canOpenOrigin: boolean;
  /** Plain-English origin line (authorized / locked / unavailable copy). */
  originLine: string;
  /** Verbose screen-reader label for the whole echo — no verdict / snake_case / excerpt-in-title-only. */
  accessibilityLabel: string;
  /** Short a11y fragment appended to a timeline-node label. */
  a11yFragment: string;
}

/** Adapter: normalize the persisted client_validation blob into a ref | null (R1). */
export function readCallbackRef(clientValidation: unknown): CrossRoomCallbackRef | null {
  return readCrossRoomCallback(clientValidation);
}

/** The unavailable-arm VM (no link, or link unavailable). */
function unavailableEcho(messageId: string): CallbackEchoViewModel {
  return {
    messageId,
    targetDebateId: null,
    accessState: 'unavailable',
    glyph: CALLBACK_ECHO_COPY.glyph,
    identityLabel: CALLBACK_ECHO_COPY.identityLabel,
    originTitle: '',
    echoedExcerpt: '',
    isLocked: false,
    canOpenOrigin: false,
    originLine: CALLBACK_ECHO_COPY.unavailable,
    accessibilityLabel: `${CALLBACK_ECHO_COPY.identityLabel}. ${CALLBACK_ECHO_COPY.unavailable}`,
    a11yFragment: CALLBACK_ECHO_COPY.a11yFragmentPublic,
  };
}

/**
 * Derive one echo VM for a move. Pure, deterministic. Returns null when the
 * move is not a callback (no / malformed ref) so it renders as an ordinary
 * reply.
 */
export function deriveCallbackEcho(input: {
  messageId: string;
  ref: CrossRoomCallbackRef | null;
  link: ResolvedPriorLink | null;
}): CallbackEchoViewModel | null {
  const { messageId, ref, link } = input;
  if (!ref || typeof ref.targetDebateId !== 'string' || ref.targetDebateId.length === 0) {
    return null;
  }

  // No matching link row (post-success link write failed / soft-removed) or the
  // link itself is unavailable => the unavailable arm (R3: never an excerpt
  // without an authorized access state).
  if (!link || link.accessState === 'unavailable') {
    return unavailableEcho(messageId);
  }

  const title = typeof link.title === 'string' ? link.title.trim() : '';

  if (link.accessState === 'title_only') {
    // R3: suppress the excerpt at render for UX consistency (NOT an RLS gate).
    return {
      messageId,
      targetDebateId: null,
      accessState: 'title_only',
      glyph: CALLBACK_ECHO_COPY.glyph,
      identityLabel: CALLBACK_ECHO_COPY.identityLabel,
      originTitle: title,
      echoedExcerpt: '',
      isLocked: true,
      canOpenOrigin: false,
      originLine: CALLBACK_ECHO_COPY.lockedOrigin(title),
      // The excerpt is deliberately NOT in the a11y label for title_only.
      accessibilityLabel:
        `${CALLBACK_ECHO_COPY.identityLabel}. ${CALLBACK_ECHO_COPY.lockedOrigin(title)}. ` +
        `${CALLBACK_ECHO_COPY.lockedA11yHint}`,
      a11yFragment: CALLBACK_ECHO_COPY.a11yFragmentPrivate,
    };
  }

  // Authorized.
  const excerpt = typeof ref.excerpt === 'string' ? ref.excerpt.trim() : '';
  const canOpen = link.targetDebateId != null && link.targetDebateId.length > 0;
  return {
    messageId,
    targetDebateId: canOpen ? link.targetDebateId : null,
    accessState: 'authorized',
    glyph: CALLBACK_ECHO_COPY.glyph,
    identityLabel: CALLBACK_ECHO_COPY.identityLabel,
    originTitle: title,
    echoedExcerpt: excerpt,
    isLocked: false,
    canOpenOrigin: canOpen,
    originLine: CALLBACK_ECHO_COPY.origin(title),
    accessibilityLabel: `${CALLBACK_ECHO_COPY.identityLabel}. ${CALLBACK_ECHO_COPY.origin(title)}`,
    a11yFragment: CALLBACK_ECHO_COPY.a11yFragmentPublic,
  };
}

/**
 * Build the per-message echo map ONCE for the room. Only callback moves get an
 * entry (a non-callback move has NO key). Pure, deterministic.
 */
export function buildCallbackEchoesByMessageId(input: {
  moves: ReadonlyArray<{ messageId: string; ref: CrossRoomCallbackRef | null }>;
  linksByTargetDebateId: ReadonlyMap<string, ResolvedPriorLink>;
}): Record<string, CallbackEchoViewModel> {
  const out: Record<string, CallbackEchoViewModel> = {};
  for (const move of input.moves) {
    if (!move || !move.ref) continue;
    const link = input.linksByTargetDebateId.get(move.ref.targetDebateId) ?? null;
    const vm = deriveCallbackEcho({ messageId: move.messageId, ref: move.ref, link });
    if (vm) out[move.messageId] = vm;
  }
  return out;
}
