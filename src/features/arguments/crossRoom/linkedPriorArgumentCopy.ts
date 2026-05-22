/**
 * QOL-042 — Linked prior argument reference: user-facing copy (pure TS).
 *
 * Every string a user reads on the linked-prior-argument surface — the
 * context chip, the title-only lock line, the disabled "Open" reason, the
 * unavailable state, the create affordance, the picker empty state, and
 * the Inspect "From the linked prior argument" section header — lives
 * here, in plain English (QOL-042 design §6.5).
 *
 * Doctrine anchors (cdiscourse-doctrine §1 / §2 / §9, QOL-042 design §10):
 *
 *   - No verdict / truth copy. The link is CONTEXT, never a ruling. No
 *     "winner" / "loser" / "won" / "proved" / "true" / "false" /
 *     "case closed". The chip never says the prior argument was correct.
 *   - "argument" not "debate"; never "game". "Settled" is the only
 *     end-state word.
 *   - No "access denied" as an error verdict — the title-only state gives
 *     the viewer CONTEXT, not a wall. The lock line explains *why* without
 *     shaming.
 *   - No internal codes — every string is plain English. Scanned by
 *     `__tests__/linkedPriorArgumentCopy.test.ts`.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

/**
 * The linked-prior-argument copy table. A frozen record so callers share
 * one instance and tests can iterate every string.
 */
export const LINKED_PRIOR_ARGUMENT_COPY = Object.freeze({
  /** Chip header — the prior room is public (or the viewer is authorized). */
  chipHeaderPublic: 'Linked prior argument',
  /** Chip header — the prior room is private (authorized or title-only). */
  chipHeaderPrivate: 'Linked prior private argument',
  /**
   * Title-only lock line. Neutral — it explains why the content is not
   * shown and frames the title as context, never as a denial.
   */
  titleOnlyLockLine:
    'Private — only its participants can open it. You can see the title here as context.',
  /** Disabled "Open" reason — a private prior room the viewer cannot enter. */
  openDisabledReason:
    'This prior argument is private. You are not a participant on it.',
  /** The unavailable state — the link or prior room could not be resolved. */
  unavailable: 'Linked prior argument is no longer available.',
  /** The create affordance label (one-box root setup + room context row). */
  createAffordance: 'Reference a prior argument',
  /** The reference picker's empty state. */
  pickerEmpty: "You don't have any settled arguments to reference yet.",
  /** The Inspect popout section header for the linked-prior-argument detail. */
  inspectSectionHeader: 'From the linked prior argument',
  /** Shown in "View context" when the prior room has no resolved tangents. */
  noTangentContext: 'No tangents from the linked argument.',
  /**
   * Degraded-refresh note — the prior room context could not be refreshed
   * (offline / network failure); the chip renders from the cached title.
   */
  couldNotRefresh: "Couldn't refresh — showing the linked title from cache.",
  /** The "open the prior argument" action label. */
  openActionLabel: 'Open prior argument',
  /** The "view the resolved-tangent context" action label. */
  viewContextActionLabel: 'View context',
} as const);

/** A key of the linked-prior-argument copy table. */
export type LinkedPriorArgumentCopyKey = keyof typeof LINKED_PRIOR_ARGUMENT_COPY;

/** Every linked-prior-argument copy string, frozen — for ban-list tests. */
export const ALL_LINKED_PRIOR_ARGUMENT_COPY: ReadonlyArray<string> = Object.freeze(
  Object.values(LINKED_PRIOR_ARGUMENT_COPY),
);

/**
 * Returns the chip header for a prior room. Private prior rooms — whether
 * the viewer is authorized or title-only — use the "private" header so the
 * privacy of the cited room is always legible (QOL-042 design §6.5).
 *
 * Pure. Deterministic.
 */
export function getChipHeaderCopy(isPriorRoomPrivate: boolean): string {
  return isPriorRoomPrivate
    ? LINKED_PRIOR_ARGUMENT_COPY.chipHeaderPrivate
    : LINKED_PRIOR_ARGUMENT_COPY.chipHeaderPublic;
}

/**
 * The forbidden tokens scanned by `__tests__/linkedPriorArgumentCopy.test.ts`.
 * NOT a content filter — a doctrine guard. Mirrors `_forbiddenBoxTokens`
 * (QOL-030) so this surface is held to the same bar. The literal phrase
 * "access denied" is included: the title-only state must never read as a
 * denial verdict.
 */
export function _forbiddenLinkedPriorTokens(): string[] {
  return [
    // Verdict tokens.
    'winner',
    'loser',
    'won',
    'lost',
    'defeated',
    'correct',
    'incorrect',
    'true',
    'false',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'verdict',
    'proof',
    'proved',
    'proven',
    'disproven',
    'case closed',
    'access denied',
    'stupid',
    'idiot',
    // Amplification tokens.
    'likes',
    'retweets',
    'shares',
    'followers',
    'engagement',
    'amplification',
    'trending',
    'virality',
    'viral',
  ];
}
