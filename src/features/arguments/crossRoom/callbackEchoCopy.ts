/**
 * QUOTE-FORGE-002 (#842) — rendered-node callback echo copy (pure TS).
 *
 * The posted-move echo copy. It reuses the SHARED woven-callback vocabulary
 * from callbackComposerCopy (the glyph + header + origin phrasing) so a draft
 * echo (#831) and its posted node (#842) read as one family, and adds the
 * rendered-node-only strings (the lock line, the unavailable line, the a11y
 * hints + node a11y fragments).
 *
 * Doctrine (cdiscourse-doctrine 1-3, 9): the echo is a LINK identity, never a
 * verdict / standing / heat signal. The "Private ..." lock line describes the
 * prior ROOM QOL-042 access state (RLS-derived) — it never promises the excerpt
 * is secret (ruling R3). No verdict / amplification token; no internal code.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */
import { _forbiddenLinkedPriorTokens } from './linkedPriorArgumentCopy';
import { CALLBACK_COMPOSER_COPY, CALLBACK_GLYPH } from './callbackComposerCopy';

/** The rendered-node callback echo copy table. Frozen. */
export const CALLBACK_ECHO_COPY = Object.freeze({
  /** The shared woven-callback glyph. */
  glyph: CALLBACK_GLYPH,
  /** The shared identity label ("Woven callback"). */
  identityLabel: CALLBACK_COMPOSER_COPY.echoHeader,
  /** The shared origin line ("Callback to ..."). Authorized state. */
  origin: CALLBACK_COMPOSER_COPY.echoOrigin,
  /** The shared origin line for a title-only (locked) prior room. */
  lockedOrigin: CALLBACK_COMPOSER_COPY.echoOrigin,
  /** The title-only lock line — describes the prior ROOM access (not the excerpt). */
  lockLine:
    'Private — only its participants can open it. You can see the title here as context.',
  /** The unavailable state — the link / prior room could not be resolved. */
  unavailable: 'Linked prior argument is no longer available.',
  /** Screen-reader hint for a tappable authorized origin. */
  openOriginA11yHint: 'Opens the settled prior argument, read-only.',
  /** Screen-reader hint for a locked (title-only) origin. */
  lockedA11yHint: 'This prior argument is private. You are not a participant on it.',
  /** Timeline-node a11y fragment for a public / resolvable callback. */
  a11yFragmentPublic: 'callback to a prior argument',
  /** Timeline-node a11y fragment for a private (title-only) callback. */
  a11yFragmentPrivate: 'callback to a private prior argument',
} as const);

/** Every plain-string echo value, frozen — for ban-list tests (origin fns scanned separately). */
export const ALL_CALLBACK_ECHO_COPY: ReadonlyArray<string> = Object.freeze(
  (Object.values(CALLBACK_ECHO_COPY) as unknown[]).filter(
    (v): v is string => typeof v === 'string',
  ),
);

/** The forbidden tokens scanned by the echo copy test. Reuses the QOL-042 set. */
export function _forbiddenCallbackEchoTokens(): string[] {
  return _forbiddenLinkedPriorTokens();
}
