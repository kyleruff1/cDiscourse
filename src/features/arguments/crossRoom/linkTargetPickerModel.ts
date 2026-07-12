/**
 * QUOTE-FORGE-001 — Link-target picker model (pure TS).
 *
 * The create-link picker lists the PRIOR settled rooms a caller may
 * reference from the current room. This module owns the pure, deterministic
 * shape of that candidate list: segmentation (same-circle first), the
 * candidate cap, and the empty / more-not-shown flags. It performs NO
 * fetch — the caller-scoped query lives in `argumentRoomLinksApi`
 * (`listLinkTargetCandidates`). RLS on `debates` already returns only the
 * rooms the caller can read; this model never widens that set.
 *
 * Doctrine anchors (cdiscourse-doctrine §1 / §2 / §3, QOL-042 privacy,
 * QUOTE-FORGE-001 design §Picker):
 *
 *   - No verdict / truth field. A candidate carries a title and a circle
 *     id only — never a score, a standing, a heat value, or a "won /
 *     proved / correct" signal. The picker is a plain reference list.
 *   - No global search. The candidate set is exactly what RLS returned for
 *     the caller — this model only orders and caps it; it never expands it.
 *   - Circle segmentation is an activity fact, not a ranking. Same-circle
 *     rooms are grouped first for relevance, not because they are "better".
 *   - Deterministic + pure. No `Date.now()`, no AI, no async, no network,
 *     no mutation of any input. Idempotent.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

// UX-PR-G (#920) P1-9d — the ONE fixture-tag registry (zero-dependency leaf, no
// cycle). Fixture / bot / corpus / reseed rooms are stripped AND excluded from
// the weave picker for EVERYONE (orchestrator ruling R1 — no admin distinction:
// the weave is an ACTION surface, not a discovery surface, so admins lose no QA
// visibility; fixtures still appear in the admin gallery). The exclusion is
// display-side here, never a query change.
import { looksLikeBotSeedTag, stripFixtureTag } from '../../debates/fixtureTagRegistry';

// ── Candidate + model shapes ───────────────────────────────────

/**
 * One row a caller may reference: a locked, caller-readable prior room.
 * The API maps a `debates` row (`id`, `title`, `circle_id`) into this
 * shape; the caller-scoped `.select()` + `status='locked'` filter already
 * did the RLS + trigger-mirroring work.
 */
export interface LinkTargetCandidate {
  /** `debates.id` of the prior room. */
  debateId: string;
  /** `debates.title` — a live, caller-readable title. */
  title: string;
  /**
   * `debates.circle_id` — null for every room today (zero backfill). When
   * set AND equal to the current room's circle id, the candidate segments
   * into the same-circle group first.
   */
  circleId: string | null;
  /**
   * True when `circleId === the current room's circleId` and both are
   * non-null — set by `buildLinkTargetPickerModel`, never trusted from a
   * raw candidate.
   */
  sameCircle: boolean;
}

/** The segmented, ordered, capped candidate list the picker renders. */
export interface LinkTargetPickerModel {
  /** Same-circle candidates first (only populated when current circle set). */
  sameCircle: ReadonlyArray<LinkTargetCandidate>;
  /** Everything else the caller can see, recency-ordered by the query. */
  other: ReadonlyArray<LinkTargetCandidate>;
  /** True when the raw candidate count exceeded the cap and rows dropped. */
  moreNotShown: boolean;
  /** True when there are zero candidates (drives the pickerEmpty copy). */
  isEmpty: boolean;
}

/**
 * The maximum candidate rows the picker renders. The API fetches
 * `MAX_LINK_TARGET_CANDIDATES + 1` so the extra row flags `moreNotShown`
 * without a second count query.
 */
export const MAX_LINK_TARGET_CANDIDATES = 20;

/**
 * Max length of the link note the picker sheet accepts — mirrors the DB
 * CHECK and the api clamp (`MAX_LINK_NOTE_CHARS`). Duplicated here as a
 * pure constant so the presentational sheet does not import the api (which
 * pulls in the Supabase client).
 */
export const MAX_LINK_NOTE_CHARS = 280;

/**
 * Link-create eligibility for the viewer of the CURRENT (source) room.
 *
 * The INSERT RLS on argument_room_links requires source-room participation
 * via is_debate_participant, which is SIDE-AGNOSTIC. The side value
 * `moderator` is the ROOM HOST (the creator, a real seated participant per
 * ARG-ROOM-002) — the DB permits the host to create links, so only
 * `observer` (not seated) is excluded here. Do not reuse the rail
 * viewerRole exclusion, which serves a different purpose.
 *
 * Pure. Accepts the loose string type the screen props carry.
 */
export function canCreatePriorLink(participantSide: string | null | undefined): boolean {
  return !!participantSide && participantSide !== 'observer';
}

// ── buildLinkTargetPickerModel ─────────────────────────────────

/**
 * Builds the picker model from the caller-readable candidate list.
 *
 * Behavior (QUOTE-FORGE-001 design §Picker · Segmentation):
 *   - Same-circle candidates (`candidate.circleId === currentCircleId`,
 *     both non-null) go into `sameCircle`, preserving input order. The
 *     rest go into `other`, preserving input order.
 *   - When `currentCircleId` is null (every room today), `sameCircle` is
 *     empty and every candidate falls into `other` — the required "not
 *     empty-by-construction in today's data" behavior.
 *   - The current room id, if it somehow appears, is dropped defensively
 *     (the query already excludes it via `.neq('id', current)`).
 *   - The combined count is capped at `MAX_LINK_TARGET_CANDIDATES`. When
 *     the raw count (excluding the dropped current id / blanks) exceeded
 *     the cap, `moreNotShown` is true. Same-circle candidates are kept
 *     ahead of others when the cap trims.
 *   - `isEmpty` is true iff the combined rendered count is zero.
 *
 * Pure. Deterministic. Idempotent. Returns new arrays; never mutates input.
 */
export function buildLinkTargetPickerModel(
  candidates: ReadonlyArray<LinkTargetCandidate>,
  currentCircleId: string | null,
  currentDebateId?: string,
): LinkTargetPickerModel {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { sameCircle: [], other: [], moreNotShown: false, isEmpty: true };
  }

  const normalizedCircleId =
    typeof currentCircleId === 'string' && currentCircleId.length > 0
      ? currentCircleId
      : null;

  const sameCircle: LinkTargetCandidate[] = [];
  const other: LinkTargetCandidate[] = [];

  for (const raw of candidates) {
    if (!raw || typeof raw.debateId !== 'string' || raw.debateId.length === 0) {
      continue;
    }
    // Defensive: the query excludes the current room, but never re-admit it.
    if (currentDebateId && raw.debateId === currentDebateId) continue;

    // UX-PR-G (#920) P1-9d / R1 — exclude fixture / bot / corpus / reseed rooms
    // from the weave for EVERYONE (no admin distinction). Keyed on the RAW
    // title so a legit title merely containing a bracket is NOT dropped.
    if (looksLikeBotSeedTag(raw.title)) continue;

    // Display-strip the title unconditionally so no raw fixture tag ever
    // reaches a picker row. A non-fixture title is only whitespace-normalised.
    const title = typeof raw.title === 'string' ? stripFixtureTag(raw.title) : '';
    const circleId =
      typeof raw.circleId === 'string' && raw.circleId.length > 0 ? raw.circleId : null;
    const isSameCircle =
      normalizedCircleId !== null && circleId !== null && circleId === normalizedCircleId;

    const candidate: LinkTargetCandidate = {
      debateId: raw.debateId,
      title,
      circleId,
      sameCircle: isSameCircle,
    };
    if (isSameCircle) sameCircle.push(candidate);
    else other.push(candidate);
  }

  const rawRenderable = sameCircle.length + other.length;
  const moreNotShown = rawRenderable > MAX_LINK_TARGET_CANDIDATES;

  // Cap the combined list, keeping same-circle candidates ahead of others.
  let cappedSame = sameCircle;
  let cappedOther = other;
  if (moreNotShown) {
    if (sameCircle.length >= MAX_LINK_TARGET_CANDIDATES) {
      cappedSame = sameCircle.slice(0, MAX_LINK_TARGET_CANDIDATES);
      cappedOther = [];
    } else {
      cappedSame = sameCircle;
      cappedOther = other.slice(0, MAX_LINK_TARGET_CANDIDATES - sameCircle.length);
    }
  }

  const isEmpty = cappedSame.length + cappedOther.length === 0;

  return {
    sameCircle: cappedSame,
    other: cappedOther,
    moreNotShown,
    isEmpty,
  };
}
