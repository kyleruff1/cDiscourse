/**
 * EV-003 — Evidence Debt Tracker.
 *
 * Doctrine (verbatim from docs/designs/EV-003.md §1, §12):
 *
 *   "An evidence debt is a STRUCTURAL fact: a source was asked for and is
 *    owed. It is NEVER a verdict on who is right. Resolving a debt — even
 *    'accepted by both' — proves at most that a record exists and that both
 *    parties stopped asking; it never declares the original claim true. A
 *    debt never declares the original claim false either: an open debt means
 *    'this point lacks X', never 'this point is wrong'."
 *
 * What this model is:
 *   - A render-time derivation that, given a room's argument rows + the
 *     EV-001 artifact lists already derived from them, produces a list of
 *     EvidenceDebt records.
 *   - Pure TypeScript. No React. No Supabase. No network. No `Date.now()` —
 *     the staleness calculation takes an injected `nowMs`, exactly as
 *     `conversationGalleryModel.ts` does, so tests stay deterministic.
 *
 * What this model is NOT (design §4.1, §9):
 *   - It is NOT the point-standing `OpenIssueDebt` model. That is
 *     axis-pressure debt; this is source-obligation debt. This module
 *     imports NOTHING from `src/features/pointStanding/`.
 *   - It emits NO `PointStandingDelta`. An evidence debt is a visible
 *     obligation marker, not a scoring event.
 *   - It never enters `evaluateArgumentDraft`. A debt is advisory — it never
 *     blocks an ordinary reply, is never a flag, never disables Post.
 *   - It never reads heat / engagement / view counts / participant velocity.
 *     A debt's status is a pure function of the moves that open and answer it.
 *
 * Persistence: render-time derived in v1 (no `evidence_debt` table, no
 * migration). A later persistence card would store rows of the `EvidenceDebt`
 * shape and backfill via this same derivation. See design §14.
 */
import type { EvidenceArtifact, SourceChainStatus } from './evidenceModel';

// ── Enumerations ──────────────────────────────────────────────

/**
 * The kind of source obligation a request opens. A debt names WHAT was asked
 * for. Closed, exhaustive set — no UI surface may invent a sixth kind.
 *
 * NOTE: deliberately NOT suffixed `_needed`. The point-standing module's
 * axis-debt types (`source_needed`, `primary_record_needed`, …) are a
 * DIFFERENT model (see design §4.1). EV-003 never aliases them.
 */
export type EvidenceDebtKind =
  | 'source' // "Where did this come from?" — a link / citation / pointer.
  | 'quote' // "Quote the exact passage." — a verbatim excerpt of a known source.
  | 'receipt' // "Show the record itself." — a screenshot / document / transaction note.
  | 'context' // "Show the surrounding context." — the message/thread a claim leans on.
  | 'primary_record'; // "Reach a primary record." — the strongest ask; an inspectable original.

/**
 * The lifecycle status of one evidence debt. Strictly an OBLIGATION
 * observation — never a verdict. None of these values says the claim is
 * true or false; they say whether a source request is still owed.
 *
 *   requested              a request move exists; nothing has been attached in answer yet.
 *   supplied               a later move attached an artifact that answers the request,
 *                          but neither the asker nor both parties have acknowledged it.
 *   challenged             the asker (or a primary) contested the supplied artifact —
 *                          fed by QOL-037's `dispute_applicability` / a follow-up ask.
 *                          The obligation is live again.
 *   accepted_by_participant  ONE primary participant explicitly accepted the supplied artifact.
 *   accepted_by_both       BOTH primary participants explicitly accepted it. The obligation
 *                          is discharged. (User label "settled" — never "case closed".)
 *   unresolved             a request move exists, the asked party explicitly declined /
 *                          evaded. Distinct from `stale` (which is silence, not refusal).
 *   stale                  the debt has been open with NO answering or accepting move past
 *                          the dormancy threshold. Advisory only — never auto-acts.
 *   branched               the obligation moved onto a side-branch (a `split_branch` move
 *                          off the requested node). The debt is not closed; it is relocated.
 */
export type EvidenceDebtStatus =
  | 'requested'
  | 'supplied'
  | 'challenged'
  | 'accepted_by_participant'
  | 'accepted_by_both'
  | 'unresolved'
  | 'stale'
  | 'branched';

/** Frozen — every debt kind. Tests iterate this. Exactly 5 entries. */
export const ALL_EVIDENCE_DEBT_KINDS: ReadonlyArray<EvidenceDebtKind> = Object.freeze([
  'source',
  'quote',
  'receipt',
  'context',
  'primary_record',
]);

/** Frozen — every debt status. Tests iterate this. Exactly 8 entries. */
export const ALL_EVIDENCE_DEBT_STATUSES: ReadonlyArray<EvidenceDebtStatus> = Object.freeze([
  'requested',
  'supplied',
  'challenged',
  'accepted_by_participant',
  'accepted_by_both',
  'unresolved',
  'stale',
  'branched',
]);

/**
 * The subset of statuses that count as "still owed" — used by every roll-up.
 * `branched` is deliberately excluded: the obligation is relocated, not
 * ignored; the asker can follow the branch (design §6.4, §16.3).
 */
export const OPEN_EVIDENCE_DEBT_STATUSES: ReadonlyArray<EvidenceDebtStatus> = Object.freeze([
  'requested',
  'challenged',
  'unresolved',
  'stale',
]);

/**
 * Dormancy threshold: a `requested` debt with no answering move for this many
 * whole days is summarised as `stale`. Advisory only — never auto-acts.
 */
// TODO(EV-004): consider moving to constitution config.
export const STALE_DEBT_THRESHOLD_DAYS = 7;

// ── The debt record ───────────────────────────────────────────

/**
 * One evidence debt. Render-time-derived in v1 (no own table); a later
 * persistence card would store rows of this exact shape.
 *
 * DOCTRINE: this record is an OBLIGATION marker. It carries no truth value,
 * emits no PointStandingDelta, and is never read by the heat model.
 */
export interface EvidenceDebt {
  /**
   * Stable deterministic id. The derivation mints `<requestArgumentId>:debt`.
   * One request move opens at most one debt, so the request move's id
   * uniquely identifies the debt across reads.
   */
  id: string;
  /** The room this debt lives in. FK to public.debates.id (internal table name). */
  debateId: string;
  /**
   * The node the debt is ATTACHED to — the move whose claim now carries an
   * unmet source obligation. This is the PARENT of the request move, falling
   * back to the request move itself when the request has no parent.
   */
  nodeId: string;
  /** The request move that OPENED the debt. */
  requestArgumentId: string;
  debtKind: EvidenceDebtKind;
  /** The user who opened the debt (author of the request move). Null if unknown. */
  requestedByUserId: string | null;
  /** ISO-8601 — copied from the request move's created_at. */
  requestedAt: string;
  status: EvidenceDebtStatus;
  /**
   * The later move that supplied / resolved the debt, when one exists.
   * `undefined` while the debt is still `requested` / `stale`.
   */
  resolvedByNodeId?: string;
  /** ISO-8601 of the resolving move, when resolved. `undefined` otherwise. */
  resolvedAt?: string;
  /**
   * Whole-day age of the debt at derivation time (from `requestedAt` to the
   * injected `nowMs`). 0 for a debt opened today; never negative.
   */
  ageDays: number;
  /**
   * True when `status === 'stale'`. Duplicated as a boolean for cheap
   * filtering in the gallery roll-up.
   */
  isStale: boolean;
}

// ── Roll-up types ─────────────────────────────────────────────

/** Per-node roll-up — what the timeline node + Inspect §3 render. */
export interface NodeEvidenceDebtSummary {
  nodeId: string;
  /** Every debt attached to this node, in `requestedAt` order. */
  debts: ReadonlyArray<EvidenceDebt>;
  /** Count of debts whose status is "still owed". */
  openCount: number;
  /** Count of debts that are discharged (`accepted_by_both`). */
  settledCount: number;
  /** True when openCount > 0 — drives whether the node renders a debt chip. */
  hasOpenDebt: boolean;
  /**
   * The single status the node's chip displays when multiple debts are
   * attached — the worst-status-wins pick. `null` when the node has no
   * debts at all (no chip rendered).
   */
  chipStatus: EvidenceDebtStatus | null;
}

/** Per-room roll-up — what the gallery card + the room status line render. */
export interface RoomEvidenceDebtSummary {
  debateId: string;
  /** Total debts in the room across all nodes and all statuses. */
  totalCount: number;
  /** Debts that are still owed. */
  openCount: number;
  /** Debts that are `stale` specifically (subset of openCount). */
  staleCount: number;
  /** Debts that are `accepted_by_both`. */
  settledCount: number;
  /**
   * True when openCount > 0 — drives the gallery "Evidence requested"
   * indicator and the storyboard's "Evidence requested" room status line.
   */
  hasOpenEvidenceDebt: boolean;
  /**
   * Plain-language one-liner for the room status line / gallery card.
   * Locked copy — see ROOM_STATUS_LINE handling below.
   */
  statusLine: string;
}

/** The debt-chip display contract — the EvidenceDebtChip component binds to this. */
export interface EvidenceDebtChipContract {
  /** Plain-language label, ≤ 28 chars. Never a snake_case code, never a verdict token. */
  label: string;
  /** Plain-language helper, ≤ 90 chars. Empty string when not applicable. */
  helper: string;
  /** Logical tone — the renderer maps this to a color token. NOT a truth label. */
  tone: 'neutral' | 'info' | 'attention' | 'muted';
  /**
   * False for a node with no open debt — the chip is not rendered then
   * (no clutter on a node that carries no obligation).
   */
  isVisible: boolean;
  /** The underlying status — kept so consumers branch without re-deriving. Never rendered raw. */
  status: EvidenceDebtStatus;
  /** The debt kind, for the chip's kind word rendered in plain language. */
  debtKind: EvidenceDebtKind;
  /** Plain-language accessibility label, the full sentence a screen reader announces. */
  accessibilityLabel: string;
}

// ── Derivation input shapes ───────────────────────────────────

/**
 * The slice of a QOL-037 `EvidenceResponseRecord` EV-003 needs. EV-003 does
 * NOT import QOL-037's module (QOL-037 may not be built); it accepts this
 * structural-minimum shape so the two cards stay decoupled.
 */
export interface EvidenceResponseLite {
  /** One of QOL-037's choices, as a string. Unknown strings are ignored. */
  choice: string;
  /** The author of the response move — needed to count distinct accepting primaries. */
  respondedByUserId: string | null;
}

/**
 * The minimum a debt derivation needs. The model NEVER reads Supabase — the
 * caller fetches the room's argument rows and passes them in.
 */
export interface EvidenceDebtArgumentInput {
  id: string;
  debateId: string;
  parentId: string | null;
  authorId: string | null;
  /** ArgumentType string — e.g. 'clarification_request', 'evidence', 'rebuttal'. */
  argumentType: string | null;
  /** The participant side, when known. */
  side: string | null;
  createdAt: string;
  /**
   * The move's tag codes (from argument_tags). The derivation reads these to
   * classify a request move.
   */
  tagCodes: ReadonlyArray<string>;
  /**
   * EV-001 artifact list for this move — the SAME array EV-002 already builds
   * via `buildArtifactsByMessageId`. May be empty.
   */
  artifacts: ReadonlyArray<EvidenceArtifact>;
  /**
   * Optional QOL-037 evidence-response records carried on this move. Present
   * only when QOL-037 has shipped; the derivation degrades gracefully when
   * absent. Used to detect acceptance / challenge.
   */
  evidenceResponses?: ReadonlyArray<EvidenceResponseLite>;
  /**
   * Optional conversation-move kind hint (`split_branch`, etc.) when the
   * caller has it. Used to detect `branched`. Degrades gracefully when absent.
   */
  moveKindHint?: string | null;
}

export interface DeriveEvidenceDebtsInput {
  debateId: string;
  /** All argument rows for the room. Order irrelevant — the model sorts internally. */
  arguments: ReadonlyArray<EvidenceDebtArgumentInput>;
  /**
   * The two primary participant user ids, when known. Used to decide
   * `accepted_by_both` vs `accepted_by_participant`. When undefined or fewer
   * than 2, the model can still reach `accepted_by_participant` but never
   * `accepted_by_both`.
   */
  primaryParticipantUserIds?: ReadonlyArray<string>;
  /** Injected "now" for deterministic staleness. */
  nowMs: number;
  /** Dormancy threshold in days for `stale` derivation. Defaults to STALE_DEBT_THRESHOLD_DAYS. */
  staleThresholdDays?: number;
}

// ── Internal constants ────────────────────────────────────────

/**
 * Recognised request tag codes → the debt kind they open. Iteration order
 * IS the precedence order when a move carries more than one (design §6.1
 * rule 2).
 *
 * `source_request` / `quote_request` are emitted today by EV-002's
 * `quickActionToPreset`. The other three are reserved — emitted by the
 * QOL-030 `ask_source` box kind selector / a future EV-004 affordance.
 * EV-003 only READS all five.
 */
const REQUEST_TAG_TO_KIND: ReadonlyArray<readonly [string, EvidenceDebtKind]> = Object.freeze([
  ['source_request', 'source'],
  ['quote_request', 'quote'],
  ['receipt_request', 'receipt'], // reserved — emitted by QOL-030 ask_source kind selector.
  ['context_request', 'context'], // reserved — emitted by QOL-030 ask_source kind selector.
  ['primary_record_request', 'primary_record'], // reserved — emitted by QOL-030 ask_source kind selector.
]);

/** Tag codes that mark an explicit decline / evasion of a request. */
const DECLINE_TAG_CODES: ReadonlySet<string> = new Set(['source_declined', 'request_evaded']);

const DAY_MS = 86_400_000;

/**
 * Worst-status ordering for the node chip when multiple debts are attached
 * (most-attention-demanding first). Lower index = worse = wins.
 */
const STATUS_SEVERITY_ORDER: ReadonlyArray<EvidenceDebtStatus> = Object.freeze([
  'challenged',
  'unresolved',
  'stale',
  'requested',
  'branched',
  'supplied',
  'accepted_by_participant',
  'accepted_by_both',
]);

// ── Derivation helpers (pure, no injected clock) ──────────────

/** Parse an ISO-8601 to ms; NaN-safe → 0. */
function parseMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** True when a status is in OPEN_EVIDENCE_DEBT_STATUSES. */
function isOpenStatus(status: EvidenceDebtStatus): boolean {
  return OPEN_EVIDENCE_DEBT_STATUSES.includes(status);
}

/** Classify a move's request tags → the first matching debt kind, or null. */
function classifyRequestKind(tagCodes: ReadonlyArray<string>): EvidenceDebtKind | null {
  const lower = tagCodes.map((t) => String(t).toLowerCase());
  for (const [code, kind] of REQUEST_TAG_TO_KIND) {
    if (lower.includes(code)) return kind;
  }
  return null;
}

/** True when `tagCodes` carries an explicit decline / evasion code. */
function hasDeclineTag(tagCodes: ReadonlyArray<string>): boolean {
  return tagCodes.some((t) => DECLINE_TAG_CODES.has(String(t).toLowerCase()));
}

/** True when a move is a split-branch move (kind hint or argument type). */
function isBranchMove(move: EvidenceDebtArgumentInput): boolean {
  if (String(move.moveKindHint ?? '').toLowerCase() === 'split_branch') return true;
  return String(move.argumentType ?? '').toLowerCase() === 'split_branch';
}

/**
 * Does an artifact discharge a debt of `kind`? This is the EV-001 contract
 * "EV-003 will use `kind` + `sourceChainStatus` as the close-condition",
 * made concrete (design §6.2). Reads EV-001's existence axis ONLY here, and
 * ONLY as a close-condition input named by the debt's own kind.
 */
function artifactDischarges(kind: EvidenceDebtKind, artifact: EvidenceArtifact): boolean {
  const status: SourceChainStatus = artifact.sourceChainStatus;
  const hasQuote = typeof artifact.quote === 'string' && artifact.quote.trim().length > 0;
  const hasSourceText =
    typeof artifact.sourceText === 'string' && artifact.sourceText.trim().length > 0;

  switch (kind) {
    case 'source':
      return (
        (artifact.kind === 'url' ||
          artifact.kind === 'source_text' ||
          artifact.kind === 'dataset' ||
          artifact.kind === 'manual_citation') &&
        (status === 'source_no_quote' ||
          status === 'source_and_quote' ||
          status === 'primary_present')
      );
    case 'quote':
      return hasQuote && (status === 'source_and_quote' || status === 'primary_present');
    case 'receipt':
      return (
        artifact.kind === 'screenshot_redacted' ||
        artifact.kind === 'source_text'
      ) && status !== 'no_source';
    case 'context':
      return (hasSourceText || hasQuote) && status !== 'no_source';
    case 'primary_record':
      return status === 'primary_present';
  }
}

/** True when any artifact on `move` discharges a debt of `kind`. */
function moveSuppliesKind(move: EvidenceDebtArgumentInput, kind: EvidenceDebtKind): boolean {
  return move.artifacts.some((a) => artifactDischarges(kind, a));
}

/**
 * Build a parent-id lookup and an "is M a descendant of / reply to D's
 * subtree" check. Reuses the same parent-walk shape `buildArgumentTree`
 * uses — no new traversal primitive.
 */
function buildSubtreeMembership(
  moves: ReadonlyArray<EvidenceDebtArgumentInput>,
): (descendantId: string, ancestorIds: ReadonlyArray<string>) => boolean {
  const parentById = new Map<string, string | null>();
  for (const m of moves) parentById.set(m.id, m.parentId);

  return (descendantId: string, ancestorIds: ReadonlyArray<string>): boolean => {
    const targets = new Set(ancestorIds);
    let cursor: string | null = descendantId;
    // Walk up to the root; a cycle guard caps the walk at the move count.
    let guard = 0;
    while (cursor !== null && guard <= parentById.size) {
      if (targets.has(cursor)) return true;
      cursor = parentById.get(cursor) ?? null;
      guard += 1;
    }
    return false;
  };
}

// ── deriveEvidenceDebts — the core derivation ─────────────────

/**
 * Derive every evidence debt in a room from its argument rows. Pure,
 * deterministic, side-effect-free. The single entry point for EV-003.
 *
 * Returns debts in `requestedAt` ascending order (ties broken by
 * `requestArgumentId` string order) so the output is stable across reads.
 */
export function deriveEvidenceDebts(
  input: DeriveEvidenceDebtsInput,
): ReadonlyArray<EvidenceDebt> {
  const moves = Array.isArray(input.arguments) ? input.arguments : [];
  const staleThresholdDays =
    typeof input.staleThresholdDays === 'number' && input.staleThresholdDays >= 0
      ? input.staleThresholdDays
      : STALE_DEBT_THRESHOLD_DAYS;
  const primaryIds = new Set(
    (input.primaryParticipantUserIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    ),
  );

  // Chronological move order (ties broken by id) — stable, deterministic.
  const sorted = moves.slice().sort((a, b) => {
    const ta = parseMs(a.createdAt);
    const tb = parseMs(b.createdAt);
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const isInSubtree = buildSubtreeMembership(sorted);

  const debts: EvidenceDebt[] = [];

  for (const move of sorted) {
    const debtKind = classifyRequestKind(move.tagCodes);
    if (debtKind === null) continue; // not a request move — opens no debt.

    const nodeId = move.parentId ?? move.id; // rule 3: attach to asked-about node.
    const requestedAtMs = parseMs(move.createdAt);
    const ageDays = Math.max(0, Math.floor((input.nowMs - requestedAtMs) / DAY_MS));

    // The subtree the answer must land on / under.
    const subtreeAnchors: ReadonlyArray<string> = [nodeId, move.id];

    // ── Resolution scan (design §6.2). Examine later moves chronologically. ──
    let status: EvidenceDebtStatus = 'requested';
    let resolvedByNodeId: string | undefined;
    let resolvedAt: string | undefined;
    const distinctAccepters = new Set<string>();

    for (const later of sorted) {
      if (parseMs(later.createdAt) <= requestedAtMs) continue; // only LATER moves.
      if (later.id === move.id) continue;
      if (!isInSubtree(later.id, subtreeAnchors)) continue; // must answer this debt.

      // 1. Branch off the node — the obligation is relocated.
      if (isBranchMove(later) && later.parentId === nodeId) {
        status = 'branched';
        resolvedByNodeId = later.id;
        resolvedAt = later.createdAt;
        continue;
      }

      // 2. Explicit decline / evasion (recognised tag only — never NLP).
      if (hasDeclineTag(later.tagCodes)) {
        status = 'unresolved';
        resolvedByNodeId = later.id;
        resolvedAt = later.createdAt;
        continue;
      }

      // 3. An answering artifact that discharges the debt kind.
      if (moveSuppliesKind(later, debtKind)) {
        // Only move forward from `requested` — once `supplied`/accepted, a
        // re-supply does not regress the ladder but does keep the latest
        // supplying move as the resolver.
        if (status === 'requested' || status === 'challenged' || status === 'supplied') {
          status = 'supplied';
        }
        resolvedByNodeId = later.id;
        resolvedAt = later.createdAt;
        continue;
      }

      // 4. QOL-037 evidence-response records (acceptance / challenge).
      const responses = later.evidenceResponses ?? [];
      for (const resp of responses) {
        const choice = String(resp.choice ?? '').toLowerCase();
        if (choice === 'accept') {
          const accepterId = resp.respondedByUserId;
          // An accept with no identifiable responder cannot count toward
          // acceptance — we cannot tell which participant accepted.
          if (accepterId === null || accepterId === undefined) continue;
          // Any identifiable accepter counts as one distinct participant; the
          // accepted_by_both tip below still requires two CONFIRMED primaries.
          distinctAccepters.add(accepterId);
          const bothPrimaries =
            primaryIds.size >= 2 &&
            [...distinctAccepters].filter((id) => primaryIds.has(id)).length >= 2;
          status = bothPrimaries ? 'accepted_by_both' : 'accepted_by_participant';
          resolvedByNodeId = later.id;
          resolvedAt = later.createdAt;
        } else if (choice === 'dispute_applicability' || choice === 'request_source') {
          // Reopens the obligation — including after accepted_by_both
          // (the monotonic-with-reopen exception, design §6.2).
          status = 'challenged';
          resolvedByNodeId = later.id;
          resolvedAt = later.createdAt;
        }
      }
    }

    // ── Staleness — derived last, only for a still-`requested` debt. ──
    let isStale = false;
    if (status === 'requested' && ageDays >= staleThresholdDays) {
      status = 'stale';
      isStale = true;
    }

    const debt: EvidenceDebt = {
      id: `${move.id}:debt`,
      debateId: input.debateId,
      nodeId,
      requestArgumentId: move.id,
      debtKind,
      requestedByUserId: move.authorId ?? null,
      requestedAt: move.createdAt,
      status,
      ageDays,
      isStale,
      ...(resolvedByNodeId !== undefined ? { resolvedByNodeId } : {}),
      ...(resolvedAt !== undefined ? { resolvedAt } : {}),
    };
    debts.push(debt);
  }

  // Sort by requestedAt asc, ties by requestArgumentId string order.
  debts.sort((a, b) => {
    const ta = parseMs(a.requestedAt);
    const tb = parseMs(b.requestedAt);
    if (ta !== tb) return ta - tb;
    return a.requestArgumentId < b.requestArgumentId
      ? -1
      : a.requestArgumentId > b.requestArgumentId
        ? 1
        : 0;
  });

  return debts;
}

// ── Roll-ups ──────────────────────────────────────────────────

/** Pick the worst (most-attention-demanding) status of a debt list. */
function worstStatus(debts: ReadonlyArray<EvidenceDebt>): EvidenceDebtStatus | null {
  if (debts.length === 0) return null;
  let best: EvidenceDebtStatus | null = null;
  let bestIndex = STATUS_SEVERITY_ORDER.length;
  for (const d of debts) {
    const idx = STATUS_SEVERITY_ORDER.indexOf(d.status);
    const safeIdx = idx < 0 ? STATUS_SEVERITY_ORDER.length - 1 : idx;
    if (safeIdx < bestIndex) {
      bestIndex = safeIdx;
      best = d.status;
    }
  }
  return best;
}

/**
 * Per-node roll-up. Pure. A `nodeId` with no debts → openCount 0,
 * hasOpenDebt false, chipStatus null, debts [].
 */
export function getNodeEvidenceDebtSummary(
  nodeId: string,
  allDebts: ReadonlyArray<EvidenceDebt>,
): NodeEvidenceDebtSummary {
  const debts = (Array.isArray(allDebts) ? allDebts : [])
    .filter((d) => d.nodeId === nodeId)
    .slice()
    .sort((a, b) => {
      const ta = parseMs(a.requestedAt);
      const tb = parseMs(b.requestedAt);
      if (ta !== tb) return ta - tb;
      return a.requestArgumentId < b.requestArgumentId
        ? -1
        : a.requestArgumentId > b.requestArgumentId
          ? 1
          : 0;
    });

  let openCount = 0;
  let settledCount = 0;
  for (const d of debts) {
    if (isOpenStatus(d.status)) openCount += 1;
    if (d.status === 'accepted_by_both') settledCount += 1;
  }

  return {
    nodeId,
    debts,
    openCount,
    settledCount,
    hasOpenDebt: openCount > 0,
    chipStatus: worstStatus(debts),
  };
}

/**
 * Per-room roll-up. Pure. Drives the gallery indicator + the room status line.
 */
export function getRoomEvidenceDebtSummary(
  debateId: string,
  allDebts: ReadonlyArray<EvidenceDebt>,
): RoomEvidenceDebtSummary {
  const debts = (Array.isArray(allDebts) ? allDebts : []).filter(
    (d) => d.debateId === debateId,
  );

  let openCount = 0;
  let staleCount = 0;
  let settledCount = 0;
  for (const d of debts) {
    if (isOpenStatus(d.status)) openCount += 1;
    if (d.status === 'stale') staleCount += 1;
    if (d.status === 'accepted_by_both') settledCount += 1;
  }

  const totalCount = debts.length;
  let statusLine = '';
  if (openCount > 0) {
    statusLine = 'Evidence requested';
  } else if (settledCount > 0) {
    statusLine = 'Evidence settled';
  } else {
    statusLine = '';
  }

  return {
    debateId,
    totalCount,
    openCount,
    staleCount,
    settledCount,
    hasOpenEvidenceDebt: openCount > 0,
    statusLine,
  };
}

// ── Chip copy (plain-language matrix — locked) ────────────────

/** The plain-language word for a debt kind. Never a snake_case code. */
const DEBT_KIND_WORD: Readonly<Record<EvidenceDebtKind, string>> = Object.freeze({
  source: 'source',
  quote: 'quote',
  receipt: 'receipt',
  context: 'context',
  primary_record: 'primary record',
});

/** The plain-language word for a debt kind. Never a snake_case code. */
export function evidenceDebtKindWord(kind: EvidenceDebtKind): string {
  return DEBT_KIND_WORD[kind];
}

interface DebtChipCopyEntry {
  label: string;
  /** Helper template — `{kind}` is substituted with the plain-language word. */
  helperTemplate: string;
  tone: EvidenceDebtChipContract['tone'];
}

/**
 * The locked v1 chip copy. Every string is an OBLIGATION observation — never
 * a verdict. The ban-list test asserts every produced string. `case closed`
 * is forbidden; `settled` is used at discharge.
 */
const DEBT_CHIP_COPY: Readonly<Record<EvidenceDebtStatus, DebtChipCopyEntry>> = Object.freeze({
  requested: Object.freeze({
    label: 'Source requested',
    helperTemplate: 'Someone asked for the {kind} behind this. It has not been supplied yet.',
    tone: 'info',
  }),
  supplied: Object.freeze({
    label: 'Evidence attached',
    helperTemplate: 'A {kind} was attached in answer. The asker has not weighed in yet.',
    tone: 'info',
  }),
  challenged: Object.freeze({
    label: 'Supplied evidence questioned',
    helperTemplate: 'The {kind} that was attached is being questioned. The request is open again.',
    tone: 'attention',
  }),
  accepted_by_participant: Object.freeze({
    label: 'Accepted by one side',
    helperTemplate: 'One participant accepted the {kind}. The other has not weighed in.',
    tone: 'info',
  }),
  accepted_by_both: Object.freeze({
    label: 'Settled by both',
    helperTemplate: 'Both participants accepted the {kind}. This request is settled.',
    tone: 'neutral',
  }),
  unresolved: Object.freeze({
    label: 'Still unresolved',
    helperTemplate: 'The {kind} was asked for and the request has not been met.',
    tone: 'attention',
  }),
  stale: Object.freeze({
    label: 'Source still owed',
    helperTemplate:
      'A {kind} was asked for a while ago and is still owed. Asking again or branching is a good move.',
    tone: 'muted',
  }),
  branched: Object.freeze({
    label: 'Moved to a branch',
    helperTemplate: 'This {kind} request is being worked out on a side branch.',
    tone: 'muted',
  }),
});

/**
 * Build the debt-chip display contract for ONE status + kind. Pure.
 * Every status produces a visible chip — the "no debt" case is handled by
 * `getNodeEvidenceDebtChip` returning an `isVisible:false` contract.
 */
export function summarizeEvidenceDebtChip(
  status: EvidenceDebtStatus,
  debtKind: EvidenceDebtKind,
): EvidenceDebtChipContract {
  const copy = DEBT_CHIP_COPY[status];
  const kindWord = DEBT_KIND_WORD[debtKind];
  const helper = copy.helperTemplate.replace('{kind}', kindWord);
  return {
    label: copy.label,
    helper,
    tone: copy.tone,
    isVisible: true,
    status,
    debtKind,
    accessibilityLabel: `${copy.label}. ${helper}`,
  };
}

/**
 * Build the chip contract for a whole node (worst-status pick). Pure.
 * Returns an `isVisible:false` contract when the node has no debts at all.
 */
export function getNodeEvidenceDebtChip(
  summary: NodeEvidenceDebtSummary,
): EvidenceDebtChipContract {
  if (summary.chipStatus === null || summary.debts.length === 0) {
    return {
      label: '',
      helper: '',
      tone: 'muted',
      isVisible: false,
      // A node with no debts has no real status; `requested` is an inert
      // placeholder that is never rendered (isVisible is false).
      status: 'requested',
      debtKind: 'source',
      accessibilityLabel: '',
    };
  }
  // The kind shown is the kind of the worst-status debt (the one the chip
  // status reflects). Falls back to the first debt's kind defensively.
  const worst = summary.debts.find((d) => d.status === summary.chipStatus);
  const kind = worst ? worst.debtKind : summary.debts[0].debtKind;
  return summarizeEvidenceDebtChip(summary.chipStatus, kind);
}
