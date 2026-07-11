/**
 * UX-COMPOSER-005 (#831) — composer-side callback copy (pure TS).
 *
 * Every user-facing string on the composer-side callback surface — the insert
 * affordance, the capture sheet, the inline draft echo, the remove control,
 * and the link-attach failure notice — lives here in plain English (doctrine
 * 9). It also carries the shared "woven callback" vocabulary (glyph header +
 * origin phrasing) that #842's rendered node echo re-uses, so a draft echo and
 * its posted node read as one family.
 *
 * Doctrine anchors (cdiscourse-doctrine 1 / 2 / 3 / 9): the callback is a LINK
 * identity ("Woven callback" / "Callback to ..."), never a verdict, standing,
 * heat, or truth signal. "callback / woven / prior / from" carry no
 * verdict / amplification meaning. The banned box token "proof" is NOT used.
 * The "Private ..." lock line describes the prior ROOM QOL-042 access state
 * (RLS-derived) — it never promises the excerpt is secret (ruling R3). No
 * internal code (crossRoomCallback / client_validation / targetDebateId) ever
 * appears in a user string.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */
import { _forbiddenLinkedPriorTokens } from './linkedPriorArgumentCopy';

/** The shared woven-callback glyph. Color-independent link identity. */
export const CALLBACK_GLYPH = '⤴' as const;

/**
 * The composer-side callback copy table. A frozen record so callers share one
 * instance and tests can iterate every string. `echoOrigin` is a function
 * (interpolates a room title), scanned separately with a benign title.
 */
export const CALLBACK_COMPOSER_COPY = Object.freeze({
  /** The insert affordance label (the Callback slot in the entry bar). */
  insertAffordanceLabel: 'Weave a callback',
  /** The insert affordance verbose screen-reader label. */
  insertAffordanceA11y:
    'Weave a callback — pull an exact line from a settled prior argument into this draft',
  /** The capture sheet title (line pick step). */
  captureSheetTitle: 'Pick the line to call back',
  /** The capture sheet empty state (no readable moves in the picked room). */
  captureSheetEmpty: "You don't have any settled arguments to reference yet.",
  /** The room-pick step title — reuses the QOL-042 create-affordance phrasing. */
  captureRoomStepTitle: 'Reference a prior argument',
  /** The inline draft echo header (shared woven-callback identity). */
  echoHeader: 'Woven callback',
  /** The inline draft echo origin line — the shared "Callback to ..." phrasing. */
  echoOrigin: (title: string) => `Callback to “${title}”`,
  /** The remove-callback control label. */
  echoRemoveLabel: 'Remove callback',
  /** The remove-callback verbose screen-reader label. */
  echoRemoveA11y: 'Remove the woven callback from this draft',
  /** The capture-sheet lock line for a prior room the weaver cannot read. */
  lockedCaptureLine:
    'Private — only its participants can open it. You can see the title here as context.',
  /** Non-blocking notice when the post landed but the room link write failed. */
  linkAttachFailed: "Callback posted — couldn't attach the prior-room link. Retry.",
  /** The retry-link control label. */
  linkAttachRetryLabel: 'Retry link',
} as const);

/** A key of the composer-side callback copy table. */
export type CallbackComposerCopyKey = keyof typeof CALLBACK_COMPOSER_COPY;

/**
 * Every plain-string composer-callback value, frozen — for ban-list tests.
 * The `echoOrigin` function is excluded here and scanned separately with a
 * benign title.
 */
export const ALL_CALLBACK_COMPOSER_COPY: ReadonlyArray<string> = Object.freeze(
  (Object.values(CALLBACK_COMPOSER_COPY) as unknown[]).filter(
    (v): v is string => typeof v === 'string',
  ),
);

/**
 * The forbidden tokens scanned by `__tests__/callbackComposerCopy.test.ts`.
 * Reuses the QOL-042 linked-prior ban-list verbatim (verdict + amplification
 * tokens + the literal "access denied"). NOT a content filter — a doctrine
 * guard.
 */
export function _forbiddenCallbackComposerTokens(): string[] {
  return _forbiddenLinkedPriorTokens();
}
