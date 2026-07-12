/**
 * HOME-003 (#840) — circle-home filter (pure model).
 *
 * A circle is a LENS, not a screen: selecting a circle narrows the already-built
 * HOME-001 "Your table" view model (`buildArgumentHomeViewModel`'s `yourTurn`
 * strip + `ongoing` cards) down to the rooms that belong to that circle. This is
 * a pure PROJECTION over the card array HOME-001 already computed — it never
 * rebuilds cards, never re-runs `conversationGalleryModel` bucketing, and never
 * touches the network.
 *
 * EXACTNESS (orchestrator ruling R2): the match predicate is
 * `debate.circleId === selectedCircle.id`, using the `circle_id` START-002
 * stamps on the room. There is no participant-subset approximation and no member
 * user-ids are consumed — a privacy win (the shared circles module stays
 * identity-free: { id, name, memberCount, role }). Because the filter runs AFTER
 * `buildArgumentHomeViewModel` (whose D8 bot/fixture exclusion already ran), a
 * circle can never resurface an excluded fixture room — true by construction.
 *
 * Pure TypeScript: NO React, NO Supabase, NO network, NO AI. Inputs are never
 * mutated. Doctrine (cdiscourse-doctrine §1-§3): a circle is an access + memory
 * boundary; `memberCount` is a SIZE, never a ranking; nothing here reads heat,
 * temperament, amplification, engagement, or any standing / verdict.
 */
import type {
  ConversationGalleryCard,
  YourTurnItem,
} from '../debates/conversationGalleryModel';
import type { Debate } from '../debates/types';
// UX-PR-G (#920) P1-9c — the ONE fixture-tag registry (zero-dependency leaf).
import { looksLikeBotSeedTag, stripFixtureTag } from '../debates/fixtureTagRegistry';

/**
 * The narrow local view of a circle the home filter + chip row consume. The
 * `toCircleLens` adapter maps START-002's `MyCircleSummary` into this, so the
 * filter tolerates upstream signature differences.
 */
export interface CircleLens {
  id: string;
  name: string;
  /** Live member count — a SIZE, never a rating (drives the chip band). */
  memberCount: number;
}

/** Per-debate circle id (or null for a non-circle room). */
export type CircleIdByDebateId = ReadonlyMap<string, string | null>;

export interface FilterArgumentHomeByCircleInput {
  yourTurn: YourTurnItem[]; // from buildArgumentHomeViewModel
  ongoing: ConversationGalleryCard[]; // from buildArgumentHomeViewModel
  circleIdByDebateId: CircleIdByDebateId;
  /** null / undefined = "All" (no filter): the output is the input, unchanged. */
  selectedCircleId: string | null;
}

export interface CircleFilteredHome {
  yourTurn: YourTurnItem[];
  ongoing: ConversationGalleryCard[];
}

/**
 * Pure: build the per-debate circle-id index from the debates the home already
 * loaded. A room with no `circleId` maps to `null` (never matches a selected
 * circle).
 */
export function buildCircleIdIndex(
  debates: ReadonlyArray<Pick<Debate, 'id' | 'circleId'>>,
): CircleIdByDebateId {
  const map = new Map<string, string | null>();
  if (!Array.isArray(debates)) return map;
  for (const d of debates) {
    if (!d || typeof d.id !== 'string') continue;
    map.set(d.id, typeof d.circleId === 'string' ? d.circleId : null);
  }
  return map;
}

/**
 * Pure predicate: does this room belong to the selected circle? True iff the
 * room's stamped `circleId` equals the selected circle id. A null / absent
 * circle id never matches (a non-circle room is never in a circle lens).
 */
export function roomMatchesCircle(
  roomCircleId: string | null | undefined,
  selectedCircleId: string,
): boolean {
  return typeof roomCircleId === 'string' && roomCircleId === selectedCircleId;
}

/**
 * Pure projection: narrow the your-turn strip AND the ongoing cards to rooms in
 * the selected circle. Returns the SAME item references (a `.filter()`, never a
 * rebuild). When no circle is selected the input is returned UNCHANGED (same
 * references) so the lane is byte-identical to HOME-001. Never mutates inputs.
 */
export function filterArgumentHomeByCircle(
  input: FilterArgumentHomeByCircleInput,
): CircleFilteredHome {
  const { yourTurn, ongoing, circleIdByDebateId, selectedCircleId } = input;
  // "All" (no filter) => identity: same references, zero-diff to HOME-001.
  if (selectedCircleId === null || selectedCircleId === undefined) {
    return { yourTurn, ongoing };
  }
  return {
    yourTurn: yourTurn.filter((item) =>
      roomMatchesCircle(circleIdByDebateId.get(item.card.debateId), selectedCircleId),
    ),
    ongoing: ongoing.filter((card) =>
      roomMatchesCircle(circleIdByDebateId.get(card.debateId), selectedCircleId),
    ),
  };
}

/**
 * Tolerant adapter: map START-002's `MyCircleSummary` (or any { id, name,
 * memberCount } shape) into a `CircleLens`. `memberCount` is coerced to a
 * non-negative integer size (never a rating).
 */
export function toCircleLens(raw: {
  id: string;
  name: string;
  memberCount?: number;
}): CircleLens {
  const count =
    typeof raw.memberCount === 'number' && Number.isFinite(raw.memberCount) && raw.memberCount > 0
      ? Math.floor(raw.memberCount)
      : 0;
  return { id: raw.id, name: raw.name, memberCount: count };
}

/** UX-PR-G (#920) P1-9c — a picker row: label = display-stripped circle name. */
export interface PickerCircle {
  id: string;
  label: string;
  memberCount: number;
}

/**
 * UX-PR-G (#920) P1-9c — project the caller's circles for the circles picker:
 *   - `label = stripFixtureTag(name)` ALWAYS, so no raw fixture tag reaches a
 *     picker row (doctrine §9). A bare-tag name falls back to the raw name.
 *   - fixture-named circles are DROPPED for non-admins (mirrors the gallery /
 *     home fixture exclusion); admins keep them. In practice a real circle name
 *     never matches the fixture predicate (it needs a bracketed run-tag), so
 *     this is a defensive consistency guard, not a common path.
 *
 * `memberCount` is coerced to a non-negative integer (matching `toCircleLens`),
 * a SIZE and never a rating. Pure; never mutates the input.
 */
export function projectCirclesForPicker(
  circles: ReadonlyArray<{ id: string; name: string; memberCount: number }>,
  options: { isAdminViewer: boolean },
): PickerCircle[] {
  if (!Array.isArray(circles)) return [];
  const out: PickerCircle[] = [];
  for (const c of circles) {
    if (!c || typeof c.id !== 'string') continue;
    if (!options.isAdminViewer && looksLikeBotSeedTag(c.name)) continue;
    const count =
      typeof c.memberCount === 'number' && Number.isFinite(c.memberCount) && c.memberCount > 0
        ? Math.floor(c.memberCount)
        : 0;
    out.push({ id: c.id, label: stripFixtureTag(c.name) || c.name, memberCount: count });
  }
  return out;
}
