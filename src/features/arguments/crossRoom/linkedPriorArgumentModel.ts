/**
 * QOL-042 — Linked prior argument reference: content model (pure TS).
 *
 * A new argument room may reference an EARLIER SETTLED room as context.
 * This module owns the pure, deterministic shape of that reference and
 * the context-chip view-model the new room's timeline renders.
 *
 * The chip has THREE view states (QOL-042 design §6.2), driven by a
 * `LinkAccessState` the API client derives from what RLS returned:
 *
 *   A · `authorized`   — the viewer may see the prior room's content.
 *                        Title (live), settled state, coarse move count,
 *                        resolved-tangent count, both actions.
 *   B · `title_only`   — the viewer is NOT authorized; the prior room is
 *                        private. The SNAPSHOT title only — no counts, no
 *                        names, no body. "Open" is disabled with a reason;
 *                        "View context" is absent.
 *   C · `unavailable`  — the prior room / link could not be resolved at
 *                        all. A single neutral line; no title, no actions.
 *
 * Doctrine anchors (cdiscourse-doctrine §1 / §2 / §3, evidence-doctrine,
 * QOL-042 design §10):
 *
 *   - The link is CONTEXT, not a verdict. No relationship type, no score,
 *     no "supports / refutes" field; the chip never says the prior
 *     argument "won", "proved", or "was correct".
 *   - The move counts on the chip are ACTIVITY facts (how many moves the
 *     prior room has), never standing / score. Heat is never an input.
 *   - The access check is RLS-enforced server-side — this model only
 *     RENDERS the `LinkAccessState` the API client derived from the RLS
 *     outcome. It performs no fetch and makes no access decision.
 *   - Minimal disclosure: the title-only state shows ONLY the snapshot
 *     title. No body, no node text, no evidence, no participant identity.
 *   - Deterministic + pure. No `Date.now()`, no AI, no async, no network,
 *     no mutation of any input. Idempotent.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

import type { PointLifecycleState } from '../../lifecycle';
import { LINKED_PRIOR_ARGUMENT_COPY, getChipHeaderCopy } from './linkedPriorArgumentCopy';

// ── The link record ────────────────────────────────────────────

/**
 * One row of `public.argument_room_links` — a one-directional, immutable
 * reference from a SOURCE (new) room to a TARGET (prior, settled) room.
 * Mirrors the migration table (QOL-042 design §5.1 / §7.6).
 */
export interface ArgumentRoomLink {
  /** The link id. */
  id: string;
  /** The NEW room that carries the context chip. */
  sourceDebateId: string;
  /** The PRIOR settled room being referenced. */
  targetDebateId: string;
  /** `profiles.id` of the link author — an opaque id, never an email. */
  createdBy: string;
  /**
   * The prior room's title, snapshotted at link-creation time. ≤ 200
   * chars. This is what the title-only chip state renders for a viewer
   * who cannot read a private prior room. Title ONLY — never body / nodes.
   */
  targetTitleSnapshot: string;
  /** The link author's optional one-line reason. ≤ 280 chars. */
  note: string;
  /** Soft-remove flag — a removed link is excluded from every read. */
  isRemoved: boolean;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

// ── Access state ───────────────────────────────────────────────

/**
 * Which of the three chip states renders. The API client
 * (`argumentRoomLinksApi`) derives this from what the caller-scoped RLS
 * read returned — this module never decides it (QOL-042 design §6.2).
 *
 *  - `authorized`  — prior-room content is readable by the viewer.
 *  - `title_only`  — viewer not authorized; render the snapshot title only.
 *  - `unavailable` — the prior room / link is unresolvable.
 */
export type LinkAccessState = 'authorized' | 'title_only' | 'unavailable';

/** Frozen array of every access state. */
export const ALL_LINK_ACCESS_STATES: ReadonlyArray<LinkAccessState> = Object.freeze([
  'authorized',
  'title_only',
  'unavailable',
]);

// ── Prior-room summary (read-only input) ───────────────────────

/**
 * A read-only summary of the prior (target) room, supplied by the host
 * after the caller-scoped fetch. The model RENDERS this — it fetches
 * nothing. Every field is optional: for a `title_only` or `unavailable`
 * state most fields are simply absent (the RLS read returned nothing),
 * and the chip degrades automatically (QOL-042 design §6.2 / §6.4).
 */
export interface PriorRoomSummary {
  /**
   * The prior room's LIVE title, read from `debates` — present only when
   * the viewer is authorized (a non-participant gets zero `debates` rows
   * for a private room). When absent, the chip falls back to the link's
   * `targetTitleSnapshot`.
   */
  liveTitle?: string | null;
  /**
   * True when the prior room is private (QOL-039 visibility). With QOL-039
   * not yet shipped this is always `false` — the `title_only` state is
   * then unreachable but harmless (design §11). The flag drives the chip
   * header ("Linked prior private argument" vs "Linked prior argument").
   */
  isPrivate?: boolean;
  /**
   * Coarse count of moves in the prior room — an ACTIVITY fact, never a
   * score. Shown only in the `authorized` state. Absent / negative → the
   * count line is omitted.
   */
  moveCount?: number | null;
  /**
   * Count of resolved tangent nodes surfaced as context — an activity
   * fact. Shown only in the `authorized` state. Absent / negative → 0.
   */
  resolvedTangentCount?: number | null;
}

// ── A resolved-tangent context row ─────────────────────────────

/**
 * A resolved-tangent argument row from the prior room, as fetched through
 * the access-checked path. `buildLinkedTangentContext` formats a list of
 * these for the Inspect popout. The rows are ALWAYS ones the caller is
 * already authorized to read — RLS on `arguments` returns zero rows to a
 * title-only viewer, so a title-only caller simply passes an empty array
 * (QOL-042 design §6.4).
 */
export interface ResolvedTangentRow {
  /** The prior-room argument id — used for the tap-through to that node. */
  argumentId: string;
  /** A short, plain-language excerpt of the tangent node's body. */
  excerpt: string;
  /**
   * The node's LIFE-001 lifecycle stage. When LIFE-001 stage data is
   * available the formatter keeps only `archived_or_resolved` nodes (a
   * RESOLVED tangent — design §6.4). When the stage is `null` (LIFE-001
   * unavailable for this node) the formatter degrades to keeping the node
   * regardless — "all tangent-branch nodes", coarser but still correct
   * (design §14 Q4).
   */
  lifecycleStage: PointLifecycleState | null;
}

/**
 * One formatted resolved-tangent context entry for the Inspect popout.
 * Read-only — surfacing a prior tangent never copies / re-posts it; the
 * `argumentId` is only a tap-through target into the locked prior room.
 */
export interface LinkedTangentContextItem {
  /** The prior-room argument id — the tap-through target. */
  argumentId: string;
  /** The plain-language excerpt shown in the context list. */
  excerpt: string;
}

// ── The context chip view-model ────────────────────────────────

/**
 * One action on the context chip. The `Open prior argument` action is
 * always present (it may be disabled); `View context` is present only when
 * the viewer is authorized AND there is tangent context to show.
 */
export interface LinkedPriorChipAction {
  /** Stable action id. */
  id: 'open_prior' | 'view_context';
  /** Plain-language button label. */
  label: string;
  /**
   * True when the action is rendered but cannot be invoked. A disabled
   * action ALWAYS carries a `disabledReason` (QOL-031 doctrine: a disabled
   * entry shows a visible reason — never a silent omission).
   */
  isDisabled: boolean;
  /** One-line plain-language reason — present only when `isDisabled`. */
  disabledReason: string | null;
  /**
   * The verbose screen-reader label. Includes the disabled reason when
   * the action is disabled, so a screen-reader user gets the full picture
   * in one read (accessibility-targets).
   */
  accessibilityLabel: string;
}

/**
 * The linked-prior-argument context chip view-model — the room-level
 * context affordance the new room's timeline header renders above the
 * rail. `buildLinkedPriorArgumentChip` produces exactly one of the three
 * `LinkAccessState`-driven shapes.
 */
export interface LinkedPriorArgumentChip {
  /** The link id this chip renders. */
  linkId: string;
  /** Which of the three view states this chip is in. */
  accessState: LinkAccessState;
  /** The chip header copy — public vs private wording. */
  header: string;
  /**
   * The prior room's title. In `authorized` it is the live title (or the
   * snapshot if the live title was absent); in `title_only` it is the
   * snapshot title; in `unavailable` it is an empty string (no title
   * could be fetched).
   */
  title: string;
  /**
   * The chip sub-line. In `authorized` it states the settled state + a
   * coarse move count + a resolved-tangent count. In `title_only` it is
   * the neutral lock line. In `unavailable` it is empty (the header copy
   * already carries the whole message).
   */
  subLine: string;
  /**
   * The link author's optional `note`, rendered as a single muted line
   * beneath the title — present only in the `authorized` state and only
   * when the link carries a non-empty note. Empty string otherwise.
   */
  note: string;
  /**
   * The chip actions. `authorized` → `Open prior argument` (+ `View
   * context` when there is tangent context). `title_only` → only `Open
   * prior argument`, disabled with a reason. `unavailable` → no actions.
   */
  actions: ReadonlyArray<LinkedPriorChipAction>;
  /**
   * The verbose screen-reader label for the whole chip. Plain English,
   * no verdict token, no internal code.
   */
  accessibilityLabel: string;
}

// ── canCreateLink ──────────────────────────────────────────────

/**
 * Returns `true` only when a prior room is link-eligible — i.e. it is
 * SETTLED (`status = 'locked'`). A draft / open / archived room cannot be
 * referenced (QOL-042 design §6.3 / §8). The reference picker uses this
 * to list only settled rooms; the migration's
 * `link_target_must_be_locked` trigger is the server-side guard.
 *
 * Pure. Deterministic.
 */
export function canCreateLink(targetRoomStatus: string): boolean {
  return targetRoomStatus === 'locked';
}

// ── buildLinkedTangentContext ──────────────────────────────────

/**
 * Formats resolved-tangent rows from the prior room into a read-only
 * context list for the Inspect popout (QOL-042 design §6.4).
 *
 * This is a PURE FORMATTER — it performs NO fetch and makes NO access
 * decision. It is only ever called with rows the caller is already
 * authorized to read; for a `title_only` viewer the caller passes an
 * empty array (RLS on `arguments` returned zero rows), so the result is
 * simply empty — no special-casing.
 *
 * Resolved-tangent predicate (design §6.4 / §14 Q4):
 *   - When a row's `lifecycleStage` is a real LIFE-001 stage, only
 *     `archived_or_resolved` rows are kept — a RESOLVED tangent.
 *   - When a row's `lifecycleStage` is `null` (LIFE-001 stage unavailable
 *     for that node), the row is kept regardless — the degraded "all
 *     tangent-branch nodes" behaviour, coarser but still correct.
 *
 * Rows with a blank excerpt are dropped (defensive). Order is preserved
 * from the input. Pure; returns a new array; never mutates the input.
 */
export function buildLinkedTangentContext(
  resolvedTangentNodes: ReadonlyArray<ResolvedTangentRow>,
): LinkedTangentContextItem[] {
  if (!Array.isArray(resolvedTangentNodes)) return [];
  const out: LinkedTangentContextItem[] = [];
  for (const row of resolvedTangentNodes) {
    if (!row || typeof row.argumentId !== 'string' || row.argumentId.length === 0) {
      continue;
    }
    const excerpt = typeof row.excerpt === 'string' ? row.excerpt.trim() : '';
    if (excerpt.length === 0) continue;
    // Resolved-tangent predicate. A real stage must be archived_or_resolved;
    // a null stage degrades to "keep" (design §14 Q4).
    if (row.lifecycleStage !== null && row.lifecycleStage !== 'archived_or_resolved') {
      continue;
    }
    out.push({ argumentId: row.argumentId, excerpt });
  }
  return out;
}

// ── Sub-line builders ──────────────────────────────────────────

/**
 * Builds the `authorized`-state sub-line: the settled state plus a coarse
 * move count and a resolved-tangent count. Counts are ACTIVITY facts —
 * the copy never frames them as standing or score. Zero / absent counts
 * are simply omitted from the line.
 */
function buildAuthorizedSubLine(summary: PriorRoomSummary): string {
  const parts: string[] = ['Settled'];
  const moveCount =
    typeof summary.moveCount === 'number' && summary.moveCount > 0 ? summary.moveCount : 0;
  if (moveCount > 0) {
    parts.push(`${moveCount} ${moveCount === 1 ? 'move' : 'moves'}`);
  }
  const tangentCount =
    typeof summary.resolvedTangentCount === 'number' && summary.resolvedTangentCount > 0
      ? summary.resolvedTangentCount
      : 0;
  if (tangentCount > 0) {
    parts.push(
      `${tangentCount} resolved ${tangentCount === 1 ? 'tangent' : 'tangents'}`,
    );
  }
  return parts.join(' · ');
}

// ── buildLinkedPriorArgumentChip ───────────────────────────────

/** Inputs to `buildLinkedPriorArgumentChip`. */
export interface BuildLinkedPriorArgumentChipInput {
  /** The link row this chip renders. */
  link: ArgumentRoomLink;
  /**
   * A read-only summary of the prior room, from the caller-scoped fetch.
   * For `title_only` / `unavailable` states most fields are absent.
   */
  priorRoomSummary: PriorRoomSummary;
  /**
   * The viewer's access to the prior room's content, derived by the API
   * client from the RLS outcome (NOT decided here).
   */
  viewerAccess: LinkAccessState;
  /**
   * True when the `authorized` viewer has at least one resolved-tangent
   * context item — gates whether the `View context` action renders.
   * Defaults to `false`. Ignored for non-`authorized` states.
   */
  hasTangentContext?: boolean;
}

/**
 * Builds the linked-prior-argument context chip — exactly one of the
 * three `LinkAccessState`-driven shapes (QOL-042 design §6.2).
 *
 * State A `authorized`:
 *   - Title = live title, or the snapshot if the live title is absent.
 *   - Sub-line = "Settled · N moves · M resolved tangents" (counts are
 *     omitted when zero).
 *   - `note` rendered when the link carries one.
 *   - Actions = `Open prior argument` (enabled) + `View context` (only
 *     when `hasTangentContext`).
 *
 * State B `title_only`:
 *   - Title = the SNAPSHOT title only.
 *   - Sub-line = the neutral lock line. No counts, no names.
 *   - `note` is NOT shown (it could leak the link author's framing of a
 *     private room beyond the title) — empty string.
 *   - Actions = `Open prior argument` ONLY, disabled with a reason.
 *     `View context` is absent.
 *
 * State C `unavailable`:
 *   - Title = empty (none could be fetched).
 *   - Sub-line = empty; the header copy carries the whole message.
 *   - No actions.
 *
 * The chip header is "Linked prior private argument" whenever the prior
 * room is private (authorized or title-only) so the privacy of the cited
 * room is always legible. An `unavailable` chip uses the public header
 * wording in the unavailable copy (no private signal can be trusted when
 * nothing resolved).
 *
 * Pure. Deterministic. Idempotent. No AI, no network, no `Date.now()`.
 */
export function buildLinkedPriorArgumentChip(
  input: BuildLinkedPriorArgumentChipInput,
): LinkedPriorArgumentChip {
  const { link, priorRoomSummary, viewerAccess } = input;
  const isPrivate = priorRoomSummary.isPrivate === true;

  // ── State C — unavailable. ──
  if (viewerAccess === 'unavailable') {
    return {
      linkId: link.id,
      accessState: 'unavailable',
      header: LINKED_PRIOR_ARGUMENT_COPY.unavailable,
      title: '',
      subLine: '',
      note: '',
      actions: Object.freeze([]),
      accessibilityLabel: LINKED_PRIOR_ARGUMENT_COPY.unavailable,
    };
  }

  // ── State B — title_only. ──
  if (viewerAccess === 'title_only') {
    const header = getChipHeaderCopy(true);
    const title = link.targetTitleSnapshot.trim();
    const openAction: LinkedPriorChipAction = {
      id: 'open_prior',
      label: LINKED_PRIOR_ARGUMENT_COPY.openActionLabel,
      isDisabled: true,
      disabledReason: LINKED_PRIOR_ARGUMENT_COPY.openDisabledReason,
      accessibilityLabel: `${LINKED_PRIOR_ARGUMENT_COPY.openActionLabel} — unavailable. ${LINKED_PRIOR_ARGUMENT_COPY.openDisabledReason}`,
    };
    return {
      linkId: link.id,
      accessState: 'title_only',
      header,
      title,
      subLine: LINKED_PRIOR_ARGUMENT_COPY.titleOnlyLockLine,
      note: '',
      actions: Object.freeze([openAction]),
      accessibilityLabel:
        `${header}: ${title}. ${LINKED_PRIOR_ARGUMENT_COPY.titleOnlyLockLine}`,
    };
  }

  // ── State A — authorized. ──
  const header = getChipHeaderCopy(isPrivate);
  const liveTitle =
    typeof priorRoomSummary.liveTitle === 'string' ? priorRoomSummary.liveTitle.trim() : '';
  const title = liveTitle.length > 0 ? liveTitle : link.targetTitleSnapshot.trim();
  const subLine = buildAuthorizedSubLine(priorRoomSummary);
  const note = typeof link.note === 'string' ? link.note.trim() : '';

  const actions: LinkedPriorChipAction[] = [
    {
      id: 'open_prior',
      label: LINKED_PRIOR_ARGUMENT_COPY.openActionLabel,
      isDisabled: false,
      disabledReason: null,
      accessibilityLabel: `${LINKED_PRIOR_ARGUMENT_COPY.openActionLabel}, opens the settled prior argument read-only`,
    },
  ];
  if (input.hasTangentContext === true) {
    actions.push({
      id: 'view_context',
      label: LINKED_PRIOR_ARGUMENT_COPY.viewContextActionLabel,
      isDisabled: false,
      disabledReason: null,
      accessibilityLabel: `${LINKED_PRIOR_ARGUMENT_COPY.viewContextActionLabel}, shows the resolved tangents from the linked prior argument`,
    });
  }

  return {
    linkId: link.id,
    accessState: 'authorized',
    header,
    title,
    subLine,
    note,
    actions: Object.freeze(actions),
    accessibilityLabel: `${header}: ${title}. ${subLine}`,
  };
}
