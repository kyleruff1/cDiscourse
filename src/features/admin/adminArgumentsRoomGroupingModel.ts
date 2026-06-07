/**
 * #508 — Admin Arguments room/conversation grouping view-model.
 *
 * Pure TypeScript. NO React, NO Supabase, NO `fetch` import. This is the
 * room-level layer that sits ABOVE the canonical per-argument artifact model
 * (`src/features/arguments/argumentArtifactModel.ts`). The existing
 * `groupArgumentsIntoArtifacts` collapses literal duplicate runs / updates of
 * ONE logical argument into a single `ArgumentArtifact`; this module then
 * folds those artifacts into one collapsible group per room/conversation so
 * the Admin Arguments tab shows one header per room instead of one row per
 * message.
 *
 * Pattern mirrored: `src/features/debates/conversationGalleryModel.ts` →
 * `groupGalleryCardsBySection` (deterministic, pure, no React, stable
 * iteration order, identical input → JSON-equal output). We do NOT import
 * from or edit that module; it is the style reference.
 *
 * Doctrine (cdiscourse-doctrine §1/§3/§9/§10a):
 *   - The grouping is a NAVIGATION AID, never a verdict. A group header tells
 *     an admin WHERE messages live (which room), never whether their content
 *     is correct, popular, or trending.
 *   - `isInactive` is OR/AND-folded from each artifact's already-derived
 *     `isInactive` (which itself derives from `inactiveAt` ONLY). This module
 *     NEVER reads `inactiveReason` — that field is not present on the
 *     `ArgumentArtifact` input shape and never reaches a rendered surface.
 *   - Read path / presentation grouping only. No row hidden, hard-deleted,
 *     or rewritten. No truth/popularity/verdict field is produced.
 *   - Deterministic: no `Date.now()`, no `Math.random()`. Same input → output
 *     that is `JSON.stringify`-equal across calls.
 */

import {
  cleanArtifactTitleForDedupe,
  type ArgumentArtifact,
  type ArtifactSortDirection,
} from '../arguments/argumentArtifactModel';

// ── Output type (design §3A — EXACT). NO `inactiveReason`. ─────────────────

export interface AdminArgumentRoomGroup {
  /** The `debateId` shared by every artifact in the group. */
  roomId: string;
  /**
   * The first non-null `debateTitle` among the group's artifacts, run THROUGH
   * `cleanArtifactTitleForDedupe` so `[xai-adv …]` / `[stress …]` corpus
   * suffixes are stripped from the header. `null` when no artifact in the
   * room carries a (non-empty after cleaning) title.
   */
  roomTitle: string | null;
  /** Count of artifacts in the group (one per logical argument). */
  messageCount: number;
  /** max(latestUpdatedAt) across the group's artifacts. */
  latestUpdatedAt: string;
  /** min(createdAt) across the group's artifacts. */
  createdAt: string;
  /** true ONLY when EVERY artifact in the room is inactive. */
  isInactive: boolean;
  /**
   * ADMIN-CONV-INACTIVE-001 — the DEBATE-level (conversation) inactive
   * timestamp, surfaced from the artifacts' carried `debateInactiveAt` (first
   * non-null among the group's artifacts; all artifacts of one debate carry the
   * same value). NULL ⇒ the conversation is active. This is the WHOLE-room
   * (#514) inactivation state — DISTINCT from `isInactive` above, which folds
   * each individual statement's per-argument inactive state. NEVER an
   * `inactiveReason` (doctrine §10a — WHAT, never WHY).
   */
  debateInactiveAt: string | null;
  /**
   * Derived: `debateInactiveAt !== null`. Drives the room-header debate-inactive
   * badge + the Mark room inactive/active toggle. Pure/deterministic; never
   * reads `inactiveReason`.
   */
  isDebateInactive: boolean;
  /**
   * Single-line excerpt (≤140 chars) of the most-recently-updated artifact's
   * `latestBody`. Navigation preview only — never a verdict.
   */
  latestBodyExcerpt: string;
  /** The group's artifacts, sorted newest-activity-first (honoring direction). */
  artifacts: ArgumentArtifact[];
}

const EXCERPT_MAX = 140;

function timeMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Collapse a body to a single line and clamp to `EXCERPT_MAX` chars (with an
 * ellipsis when truncated). Navigation preview only.
 */
function toExcerpt(body: string | null | undefined): string {
  const s = String(body ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= EXCERPT_MAX) return s;
  return s.slice(0, EXCERPT_MAX - 1) + '…';
}

/**
 * Comparator over a numeric activity timestamp honoring `direction`, with a
 * stable id tie-break so output is deterministic.
 */
function compareByActivity(
  aMs: number,
  bMs: number,
  aId: string,
  bId: string,
  direction: ArtifactSortDirection,
): number {
  const delta = aMs - bMs;
  if (delta !== 0) return direction === 'asc' ? delta : -delta;
  if (aId < bId) return -1;
  if (aId > bId) return 1;
  return 0;
}

/**
 * Group `ArgumentArtifact[]` into one `AdminArgumentRoomGroup` per room
 * (`artifact.debateId`). Deterministic: same input → JSON-equal output.
 *
 * - Groups are sorted by `latestUpdatedAt` honoring `direction` (default
 *   `'desc'` — most recently active room first), tie-broken by `roomId`.
 * - Artifacts within each group are sorted the same way, tie-broken by
 *   `artifactId`.
 * - `roomTitle` = first non-null `debateTitle` among the group's artifacts
 *   (in input order), run through `cleanArtifactTitleForDedupe`; `null` if
 *   none yields a non-empty cleaned title.
 * - `isInactive` is true ONLY when every artifact in the room is inactive
 *   (AND-fold of each artifact's already-derived `isInactive`). It NEVER
 *   reads `inactiveReason`.
 * - The input array is NOT mutated (each group's `artifacts` is a fresh
 *   sorted copy).
 */
export function groupArtifactsByRoom(
  artifacts: ArgumentArtifact[],
  direction: ArtifactSortDirection = 'desc',
): AdminArgumentRoomGroup[] {
  if (!Array.isArray(artifacts) || artifacts.length === 0) return [];

  // Stable first-seen ordering of room keys so the build is deterministic
  // regardless of Map iteration nuances; artifacts accumulate per room.
  const order: string[] = [];
  const groups = new Map<string, ArgumentArtifact[]>();
  for (const a of artifacts) {
    if (!a || typeof a.debateId !== 'string') continue;
    const key = a.debateId;
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
      order.push(key);
    }
    bucket.push(a);
  }

  const result: AdminArgumentRoomGroup[] = [];
  for (const roomId of order) {
    const bucket = groups.get(roomId)!;

    // Fresh sorted copy (input not mutated). Newest activity first by default.
    const sorted = bucket.slice().sort((a, b) =>
      compareByActivity(
        timeMs(a.latestUpdatedAt),
        timeMs(b.latestUpdatedAt),
        a.artifactId,
        b.artifactId,
        direction,
      ),
    );

    // roomTitle: first non-null debateTitle in INPUT order, cleaned of corpus
    // suffixes. We scan the original bucket order (input order), not the
    // activity-sorted order, so the title is stable regardless of `direction`.
    let roomTitle: string | null = null;
    for (const a of bucket) {
      if (a.debateTitle != null) {
        const cleaned = cleanArtifactTitleForDedupe(a.debateTitle);
        if (cleaned.length > 0) {
          roomTitle = cleaned;
          break;
        }
      }
    }

    // max(latestUpdatedAt) / min(createdAt) across the group's artifacts.
    let latestUpdatedAt = bucket[0].latestUpdatedAt;
    let latestMs = timeMs(latestUpdatedAt);
    let createdAt = bucket[0].createdAt;
    let createdMs = timeMs(createdAt);
    for (const a of bucket) {
      const uMs = timeMs(a.latestUpdatedAt);
      if (uMs > latestMs) {
        latestMs = uMs;
        latestUpdatedAt = a.latestUpdatedAt;
      }
      const cMs = timeMs(a.createdAt);
      if (cMs < createdMs) {
        createdMs = cMs;
        createdAt = a.createdAt;
      }
    }

    // isInactive: true ONLY when EVERY artifact is inactive (AND-fold of each
    // artifact's already-derived `isInactive`). Never reads `inactiveReason`.
    const isInactive = bucket.every((a) => a.isInactive === true);

    // ADMIN-CONV-INACTIVE-001 — debateInactiveAt: the DEBATE-level
    // (conversation) inactive timestamp. Every artifact of one debate carries
    // the same `debateInactiveAt`; we surface the first non-null among the
    // group's artifacts (in input order, so it is stable regardless of
    // `direction`). `isDebateInactive` derives from it ONLY. This is the
    // WHOLE-room (#514) state — distinct from `isInactive` above. Never reads
    // `inactiveReason` (§10a).
    let debateInactiveAt: string | null = null;
    for (const a of bucket) {
      if (a.debateInactiveAt != null) {
        debateInactiveAt = a.debateInactiveAt;
        break;
      }
    }
    const isDebateInactive = debateInactiveAt !== null;

    // Excerpt of the most-recently-updated artifact's latestBody. We pick the
    // max-activity artifact independent of `direction` so the preview is the
    // freshest message regardless of sort order.
    let freshest = bucket[0];
    let freshestMs = timeMs(freshest.latestUpdatedAt);
    for (const a of bucket) {
      const ms = timeMs(a.latestUpdatedAt);
      if (ms > freshestMs || (ms === freshestMs && a.artifactId < freshest.artifactId)) {
        freshestMs = ms;
        freshest = a;
      }
    }

    result.push({
      roomId,
      roomTitle,
      messageCount: sorted.length,
      latestUpdatedAt,
      createdAt,
      isInactive,
      debateInactiveAt,
      isDebateInactive,
      latestBodyExcerpt: toExcerpt(freshest.latestBody),
      artifacts: sorted,
    });
  }

  // Sort groups by latest activity honoring direction; tie-break by roomId.
  result.sort((a, b) =>
    compareByActivity(
      timeMs(a.latestUpdatedAt),
      timeMs(b.latestUpdatedAt),
      a.roomId,
      b.roomId,
      direction,
    ),
  );

  return result;
}
