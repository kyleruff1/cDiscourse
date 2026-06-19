/**
 * UX-FEEDBACK-001 — Restrained static current-state progress notes (pure TS).
 *
 * Maps the CURRENT mediator display state (+ a small deterministic local
 * context) to ONE restrained, STATE-REFLECTIVE acknowledgement line, or to
 * `null` (the restraint default). It is the display layer for the doctrine that
 * "the reward is clarity, not applause."
 *
 * READ THIS BEFORE CHANGING ANY COPY — the operator RE-LOCKED scope:
 *
 *   - STATIC current-state CONFIRMATION ONLY. Every line describes a state the
 *     board IS in right now (a point IS anchored, a claim IS narrowed, a
 *     concession IS preserved, a source path IS identified, the next useful
 *     move IS this). NEVER a transition ("just narrowed", "now clearer", "moved
 *     forward", "clarified", "improved") — the board (`MediatorBoardState`) is a
 *     STATELESS re-projection of current state; it carries no before→after
 *     delta, so a "just happened" claim would be a lie. No temporal/transition
 *     phrasing is permitted (asserted by tests).
 *   - NO rating, like, vote, score, ranking, popularity, heat, leaderboard,
 *     streak, badge, trophy, applause, confetti, win/loss, truth/verdict,
 *     correctness, person/intent/credibility/honesty label, or "AI thinks".
 *   - NO persistence, NO event, NO write, NO transition-event detection. This
 *     is a pure projection of the already-derived board's CURRENT state.
 *   - Insufficient signal → `null` (render nothing; never overclaim).
 *   - `structured_impasse` → `null` here. The dignified impasse line
 *     ("The disagreement is preserved.") is OWNED by UX-IMPASSE-001 — this card
 *     CROSS-REFERENCES it and adds NO second impasse render.
 *
 * The reward is clarity, expressed the way a mediator marks the board cleanly —
 * never the way an app praises a user.
 *
 * Pure TS. No React. No Supabase. No fetch. No MCP. No clock. No randomness. No
 * mutation of any input. Deterministic — same input → same output.
 * JSON-serializable output. Imports NOTHING from the engine / pointStanding /
 * argumentScoreModel — gate-independence is structural.
 */
import type { V4MediatorStateCode } from './mediatorBoardTypes';
import { _forbiddenMediatorTokens } from './mediatorPlainLanguage';
import { nextMovesForState } from './nextMovesForState';

/**
 * One restrained current-state acknowledgement. DISPLAY ONLY — never persisted,
 * never a field on the board, never a write, never counted. It reflects the
 * CURRENT structural state ("the board is in a more-resolved shape now"), never
 * a transition ("this just happened"), never a rating, never a verdict.
 */
export interface MediatorProgressNote {
  /** Stable id for keys / testIDs (`progress-<kind>`). */
  id: string;
  /** Ban-list-clean acknowledgement line (the visible text). */
  line: string;
  /**
   * The restrained tone the renderer dresses the note with:
   *   - 'dignified' → restrained gold — a settled / completed structural shape.
   *   - 'progress'  → indigo — an active, more-resolved structural state.
   *   - 'neutral'   → no accent — a plain calm note.
   * Color is NEVER the only signal (geometry + text carry it in grayscale).
   */
  tone: 'dignified' | 'progress' | 'neutral';
}

/**
 * The small, deterministic LOCAL context the helper needs beyond the display
 * state. Every field is a CURRENT-STATE boolean already available on the
 * already-derived board (or a local UI selection event) — none is a transition,
 * none is persisted, none is a rating.
 */
export interface MediatorProgressContext {
  /**
   * Which surface is asking. The default-visible selection area asks for the
   * `'selection'` cue ("Point anchored."); the Inspect drawer asks for the
   * `'inspect'` structural notes (narrowed / concession / evidence / next-move).
   * This is a render-scope hint, never a transition.
   */
  surface?: 'selection' | 'inspect';
  /**
   * True when a non-root node is selected/anchored for composition (the local
   * selection event). Drives the "Point anchored." cue. Ephemeral, no
   * persistence. Root / no-selection → false → no cue.
   */
  isNodeAnchored?: boolean;
  /**
   * True when a concession is the current shape of this narrowed point (the
   * lifecycle landed as a preserved concession). Drives "Concession preserved."
   * over the plain "Claim narrowed." line. Same `narrowed` display state.
   */
  isConcessionPreserved?: boolean;
  /**
   * True when a source path EXISTS on this point right now (an evidence debt is
   * resolved / supplied / accepted — `!isOpen && !isBlocked`). A CURRENT state,
   * never "just resolved". Drives "Source path identified."
   */
  hasIdentifiedSourcePath?: boolean;
}

/** The frozen, operator-RE-LOCKED static current-state copy. Ban-list clean. */
const PROGRESS_COPY = Object.freeze({
  /** A non-root node is selected/anchored for composition (local cue). */
  anchored: 'Point anchored.',
  /** The point IS narrowed now (a smaller clash remains). */
  narrowed: 'Claim narrowed.',
  /** A concession IS the preserved current shape of the narrowed point. */
  concession: 'Concession preserved.',
  /** A source path EXISTS on this point now (a resolved/supplied debt). */
  sourcePath: 'Source path identified.',
  /** Static label PREFIX for the next-useful-move guidance (never temporal). */
  nextMovePrefix: 'Next useful move:',
});

/**
 * Returns the restrained static current-state note for the active node, or
 * `null` (the restraint default). ONE note per call, chosen by a strict
 * precedence so the output is deterministic and total.
 *
 * Precedence (highest wins):
 *   selection surface:
 *     1. anchored        → "Point anchored." (local ephemeral cue)
 *   inspect surface:
 *     1. concession (on a `narrowed` point) → "Concession preserved."
 *     2. narrowed                          → "Claim narrowed."
 *     3. source path identified            → "Source path identified."
 *     4. a non-empty next-move set         → "Next useful move: <dominant move>"
 *   any surface:
 *     structured_impasse → `null` (cross-ref UX-IMPASSE-001; no second render)
 *     all other states / insufficient signal → `null`
 *
 * Pure + total over the nine display states. No transition, no diff, no
 * persisted flag, no write.
 */
export function feedbackForMediatorProgress(
  displayState: V4MediatorStateCode,
  ctx?: MediatorProgressContext,
): MediatorProgressNote | null {
  const surface = ctx?.surface ?? 'inspect';

  // Impasse is OWNED by UX-IMPASSE-001 — never a second render here.
  if (displayState === 'structured_impasse') return null;

  // ── Selection surface: the local ephemeral anchoring cue only ──
  if (surface === 'selection') {
    if (ctx?.isNodeAnchored === true) {
      return Object.freeze({
        id: 'progress-anchored',
        line: PROGRESS_COPY.anchored,
        tone: 'progress',
      });
    }
    return null;
  }

  // ── Inspect surface: state-reflective structural notes ──

  // Narrowed / concession share the `narrowed` current display state. A
  // preserved concession is dressed with the concession line; otherwise the
  // plain narrowed line. Both are CURRENT-state, never "just narrowed".
  if (displayState === 'narrowed') {
    if (ctx?.isConcessionPreserved === true) {
      return Object.freeze({
        id: 'progress-concession',
        line: PROGRESS_COPY.concession,
        tone: 'progress',
      });
    }
    return Object.freeze({
      id: 'progress-narrowed',
      line: PROGRESS_COPY.narrowed,
      tone: 'progress',
    });
  }

  // A source path EXISTS on this point now (a resolved/supplied/accepted debt).
  // Static framing only — never "just resolved" / "clarified".
  if (ctx?.hasIdentifiedSourcePath === true) {
    return Object.freeze({
      id: 'progress-source-path',
      line: PROGRESS_COPY.sourcePath,
      tone: 'dignified',
    });
  }

  // A static "Next useful move:" lead-in to the existing deterministic move set
  // (UX-NEXT-MOVE-001). Renders ONLY when a move set exists; the line is a
  // static label prefix + the dominant move's copy — never temporal.
  const moves = nextMovesForState(displayState);
  if (moves.length > 0) {
    return Object.freeze({
      id: 'progress-next-move',
      line: `${PROGRESS_COPY.nextMovePrefix} ${moves[0].label}`,
      tone: 'progress',
    });
  }

  return null;
}

/**
 * Temporal / transition tokens that must NEVER appear in a progress line. The
 * board is stateless — a "just happened" / before→after claim would be a lie.
 * Scanned by tests. NOT a content filter — a doctrine guard over this card's
 * OWN copy.
 */
const FEEDBACK_TRANSITION_TOKENS: ReadonlyArray<string> = Object.freeze([
  'just',
  'now',
  'cleaner',
  'clearer',
  'clarified',
  'moved forward',
  'moved the point',
  'moves the point',
  'improved',
  'better than',
  'before',
  'after',
  'previously',
  'used to',
  'has become',
  'became',
]);

/**
 * Applause / rating / popularity tokens that must NEVER appear in a progress
 * line. A progress note is a structural acknowledgement, NEVER a reward.
 */
const FEEDBACK_APPLAUSE_RATING_TOKENS: ReadonlyArray<string> = Object.freeze([
  'like',
  'likes',
  'upvote',
  'vote',
  'points',
  'point earned',
  'streak',
  'rank',
  'ranking',
  'leaderboard',
  'popular',
  'popularity',
  'applause',
  'congrat',
  'congratulations',
  'great job',
  'good job',
  'nice',
  'well done',
  'trophy',
  'badge',
  'confetti',
  'reputation',
]);

/**
 * Person-attribution tokens (mirrors the next-move guard). A note is about the
 * POINT's structure, never the person — these must never appear.
 */
const FEEDBACK_PERSON_ATTRIBUTION_TOKENS: ReadonlyArray<string> = Object.freeze([
  'you',
  'your',
  "you're",
  'yours',
  'they',
  'their',
  "they're",
  'theirs',
  'the user',
  'the author',
  'the poster',
  'the speaker',
  'the participant',
  'this person',
  'this user',
]);

/**
 * Test-only ban-list for the progress-note copy. Re-exports the mediator
 * ban-list PLUS the transition guard, the applause/rating guard, and the
 * person-attribution guard. A progress line can never imply a transition, a
 * rating, applause, or name a person. Not a content filter — a doctrine guard
 * over this card's OWN copy.
 */
export function _forbiddenFeedbackTokens(): string[] {
  const merged = new Set<string>(_forbiddenMediatorTokens());
  for (const t of FEEDBACK_TRANSITION_TOKENS) merged.add(t);
  for (const t of FEEDBACK_APPLAUSE_RATING_TOKENS) merged.add(t);
  for (const t of FEEDBACK_PERSON_ATTRIBUTION_TOKENS) merged.add(t);
  return Array.from(merged);
}
