/**
 * HOME-001 (#874) — ArgumentHome ("Your table") pure view-model composer.
 *
 * Pure TypeScript: NO React, NO Supabase, NO network, NO AI. It composes the
 * Slice-1 gallery primitives (isWaitingOnViewer / deriveYourTurn) into the home
 * surface view model over inputs that App.tsx has ALREADY loaded for the
 * gallery and the notification badge. HOME-001 adds zero call sites that touch
 * supabase / fetch / any *Api.ts wrapper (AC6 satisfied by construction).
 *
 * Doctrine (cdiscourse-doctrine §1-§3): the projection reads only structural
 * turn-state / recency / unread signals. It never reads heat, temperament,
 * amplification, engagement, view counts, or follower counts, and it never
 * surfaces a standing / band / winner / verdict. Fixture exclusion (bot /
 * corpus / reseed rooms) is a read-time client projection keyed by the RAW
 * title tag — never a DB mutation, never a popularity signal (§8).
 */
import {
  deriveYourTurn,
  type ConversationGalleryCard,
  type YourTurnItem,
} from '../debates/conversationGalleryModel';
// UX-PR-G (#920) — the fixture id-set collector was hoisted into the ONE
// zero-dependency fixture-tag registry. Re-export it here so the shipped export
// name (consumed via `src/features/home/index.ts` + App.tsx) is unchanged.
import { collectFixtureDebateIds } from '../debates/fixtureTagRegistry';
import type { Debate } from '../debates/types';
import type { RoomNotification } from '../notifications/notificationModel';

export { collectFixtureDebateIds };

export interface BuildArgumentHomeInput {
  /** The gallery cards, already built by buildConversationGalleryCards. */
  cards: ConversationGalleryCard[];
  /**
   * The raw debates. Used ONLY to test the raw `debate.title` for fixture
   * exclusion — `card.title` is already tag-stripped by cleanTitleForDedupe,
   * so the raw title is the correct string to test.
   */
  debates: Debate[];
  /** debateIds with an unread notification for the viewer (from notifications). */
  unreadDebateIds?: ReadonlySet<string>;
  /** Admins keep fixture rooms visible (AC5); non-admins get the filtered set. */
  isAdminViewer: boolean;
}

export interface ArgumentHomeViewModel {
  /** Disputes waiting on the viewer, ranked hint-verb -> unread -> recency. */
  yourTurn: YourTurnItem[];
  /**
   * The viewer's other participant rooms: joined cards that survive fixture
   * exclusion, minus the your-turn cards already surfaced, ranked by recency.
   */
  ongoing: ConversationGalleryCard[];
  /** True when the viewer has nothing waiting and nothing ongoing (J1). */
  isFirstRun: boolean;
}

/**
 * HOME-001 / UX-PR-G (#920) — the set of debateIds whose RAW title looks like a
 * bot / corpus / reseed fixture tag now lives in `fixtureTagRegistry`
 * (re-exported above as `collectFixtureDebateIds`). It is built from
 * `debate.title` (the un-cleaned string), because `card.title` has already had
 * the tag stripped by cleanTitleForDedupe and would therefore no longer match.
 */

/**
 * HOME-001 — pure: map the loaded notification list to the set of debateIds
 * that carry at least one unread notification (`readAt === null`).
 */
export function collectUnreadDebateIds(notifications: RoomNotification[]): Set<string> {
  const ids = new Set<string>();
  for (const n of notifications) {
    if (n.readAt === null) ids.add(n.debateId);
  }
  return ids;
}

/**
 * HOME-001 — recency comparator for the ongoing list: newest activity first,
 * total-order tie-break by debateId so the order is fully deterministic.
 */
function byRecencyThenId(a: ConversationGalleryCard, b: ConversationGalleryCard): number {
  const recA = a.sortKeys.latestActivityMs;
  const recB = b.sortKeys.latestActivityMs;
  if (recA !== recB) return recB - recA;
  if (a.debateId < b.debateId) return -1;
  if (a.debateId > b.debateId) return 1;
  return 0;
}

/**
 * HOME-001 — compose the ArgumentHome view model. Deterministic and
 * side-effect-free: the same input twice yields a deeply-equal result and the
 * input arrays are never mutated.
 */
export function buildArgumentHomeViewModel(
  input: BuildArgumentHomeInput,
): ArgumentHomeViewModel {
  const fixtureDebateIds = collectFixtureDebateIds(input.debates);
  const isAdmin = input.isAdminViewer === true;

  const yourTurn = deriveYourTurn(input.cards, {
    unreadDebateIds: input.unreadDebateIds,
    fixtureDebateIds,
    isAdminViewer: isAdmin,
  });

  const yourTurnIds = new Set(yourTurn.map((i) => i.card.debateId));

  const ongoing = input.cards
    .filter((card) => {
      if (!card.hasUserJoined) return false; // participant rooms only
      if (yourTurnIds.has(card.debateId)) return false; // already in the strip
      if (!isAdmin && fixtureDebateIds.has(card.debateId)) return false; // fixture exclusion
      return true;
    })
    .slice()
    .sort(byRecencyThenId);

  const isFirstRun = yourTurn.length === 0 && ongoing.length === 0;

  return { yourTurn, ongoing, isFirstRun };
}
