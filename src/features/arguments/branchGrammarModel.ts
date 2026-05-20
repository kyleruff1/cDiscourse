/**
 * BR-004 — Branch grammar model (pure TypeScript).
 *
 * Owns the **teachable direction grammar** that sits between BR-001's
 * topology classification and the timeline renderer. It answers two
 * questions:
 *
 *   1. Given a branch's structural origin / cause, which of the three
 *      teachable DIRECTIONS does it draw in — `mainline` (the horizontal
 *      OP <-> Primary Opponent 1v1 spine), `chime_in_vertical` (a new
 *      participant's perspective on the SAME topic), or `tangent_diagonal`
 *      (a side issue routed off the mainline so it cannot derail it)?
 *      A fourth pass-through value, `evidence_passthrough`, marks a branch
 *      BR-001 already styles as an evidence thread — BR-004 yields and
 *      does NOT restyle it.
 *   2. What does a COLLAPSED branch stub summarize — count, recency,
 *      unresolved items, and whether a principal engaged?
 *
 * Doctrine anchor — read this before changing anything in this file:
 *
 *   **A branch direction describes the STRUCTURAL POSITION of a move,
 *   never its truth, its heat, its popularity, or its author.** Vertical
 *   is not "better" than diagonal; diagonal is not "wrong"; the mainline
 *   is not "the correct path" — it is the OP<->Primary spine BY
 *   CONSTRUCTION. A tangent branch is "a side issue", never "a bad move"
 *   or "a dodge". `deriveBranchDirection` reads ONLY structural fields
 *   (topology classification, the evidence-thread boolean, explicit
 *   qualifier codes, advisory routing inputs). It NEVER reads heat,
 *   popularity, reply count, participant count, recency, or any
 *   strength / standing band — activity can never move a direction.
 *
 * Two-enum guard — do NOT merge these:
 *   - `RailBranchKind` (BR-001, `railSegmentModel.ts`) is the locked
 *     *topology* enum — `main | tangent | kink_start | kink_end |
 *     detached`. BR-004 reads it; it never modifies or extends it.
 *   - `BranchDirection` (this file) is BR-004's *grammar* enum —
 *     `mainline | chime_in_vertical | tangent_diagonal |
 *     evidence_passthrough`. Distinct on purpose.
 *
 * Separation of concerns:
 *   - BR-001 (`branchTopologyModel`) owns topology classification.
 *   - BR-003 (`tangentRoutingModel`) owns routing decisions.
 *   - BR-004 (this file) owns the grammar layer between them and the
 *     renderer. It reads BR-001's `RailBranchKind` and BR-003's
 *     `suggestedAction` as inputs — it never re-derives either, never
 *     calls `assessTangentRisk`, never reclassifies a topology edge.
 *   - `branchGrammarRenderContract.ts` owns the shape/position/stroke
 *     token mapping — split out so this grammar model never imports a
 *     render concern.
 *
 * Pure TS. No React. No Supabase. No network. No async. No AI. No
 * mutation of any input. No new dependency.
 */

import type {
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
} from './argumentGameSurfaceModel';
import type { RailBranchKind } from './railSegmentModel';
import type { RedirectSuggestedAction } from './tangentRoutingModel';
import type { ReadoutSelectionStatus } from './timelineSelectedReadoutModel';
import { BRANCH_GRAMMAR_COPY } from './gameCopy';
import { formatRelativeShort } from '../../lib/formatDateTime';

// ── MCP-010 lane vocabulary (consumed-as-a-type mirror) ──────────

/**
 * BR-004 — the lane a user chose, as recorded by MCP-010's semantic
 * override surface. MCP-010 is a **design-only card** at this worktree's
 * head — its `SemanticOverrideLane` type (`docs/designs/MCP-010.md` §0)
 * is specified but is "proposed — not yet code". BR-004 therefore
 * mirrors MCP-010's documented three-literal union locally rather than
 * importing a non-existent symbol. The literals are verbatim from
 * MCP-010 §0 (`'mainline' | 'branch' | 'tangent'`); MCP-010 §13 risk 4
 * explicitly keeps this union widenable, and the BR-004 design treats
 * the lane choice as an advisory routing input only. When the MCP-010
 * implementation card lands a real `SemanticOverrideLane` export, this
 * alias can be re-pointed at it with no behavior change. See the
 * "Implementer note" appended to `docs/designs/BR-004.md`.
 */
export type SemanticOverrideLane = 'mainline' | 'branch' | 'tangent';

// ── BranchDirection — the new presentational enum ───────────────

/**
 * BR-004 — the teachable structural DIRECTION a branch draws in.
 * Distinct from BR-001's `RailBranchKind` topology enum. A direction
 * describes the STRUCTURAL POSITION of a branch on the board — never its
 * truth, heat, popularity, or author. Vertical is not "better" than
 * diagonal.
 */
export type BranchDirection =
  | 'mainline' //              horizontal — the OP <-> Primary Opponent 1v1 spine
  | 'chime_in_vertical' //     vertical offshoot — a new participant's perspective
  //                           on the SAME topic
  | 'tangent_diagonal' //      diagonal offshoot — a side issue routed off the
  //                           mainline so it cannot derail it
  | 'evidence_passthrough'; // PASS-THROUGH — this branch is already styled by
//                             BR-001 as an evidence thread (teal track, `main`
//                             rail style). BR-004 does NOT restyle it.

/** Frozen list of every direction. Tests iterate this. */
export const ALL_BRANCH_DIRECTIONS: ReadonlyArray<BranchDirection> = Object.freeze([
  'mainline',
  'chime_in_vertical',
  'tangent_diagonal',
  'evidence_passthrough',
]);

// ── TANGENT_DEPTH_CAP ───────────────────────────────────────────

/**
 * BR-004 — the deterministic offshoot depth at which a tangent branch
 * surfaces the "summarize this offshoot" advisory. Frozen constant; NO
 * AI involved in detecting it. "Offshoot depth" is the count of nested
 * tangent branches between the mainline and the branch (mainline = 0;
 * first tangent off the mainline = 1; tangent off that = 2; ...). When
 * depth >= `TANGENT_DEPTH_CAP`, `BranchGrammarNode.offshootDepthCapReached`
 * is `true`. The cap NEVER blocks, NEVER auto-collapses, NEVER
 * auto-summarizes — it only flips an advisory flag. OD-1 confirms the
 * value; proposed: 3.
 */
export const TANGENT_DEPTH_CAP = 3;

// ── BranchOrigin — the deterministic input to direction derivation ─

/**
 * BR-004 — the structural CAUSE a branch exists, fed to
 * `deriveBranchDirection`. Every field is read off data the timeline map
 * / BR-001 / BR-003 / MCP-010 already produced. BR-004 re-derives
 * nothing.
 */
export interface BranchOrigin {
  /** The branch's id (`ArgumentTimelineMapNode.branchId`). */
  branchId: string;
  /** The branch root message id (`ArgumentTimelineMapNode.branchRootMessageId`). */
  branchRootMessageId: string;
  /**
   * True when this branch IS the mainline — the branch the OP and the
   * Primary Opponent both sit on. Determined structurally: the branch
   * whose root has no parent (the opening claim) is the mainline branch.
   */
  isMainlineBranch: boolean;
  /**
   * BR-001's topology classification of the edge that ENTERS this branch
   * root (the inbound `RailBranchKind`). `main` => stays on mainline;
   * `kink_start` => a real branch leaves the spine here; `tangent` /
   * `kink_end` => interior / leaf of a kinked subtree; `detached` =>
   * parent missing.
   */
  inboundBranchKind: RailBranchKind;
  /**
   * True when BR-001's evidence-thread map flags this branch root's
   * subtree as an evidence thread. When true the direction is forced to
   * `evidence_passthrough`.
   */
  isEvidenceThread: boolean;
  /**
   * Whether the branch root carries an explicit tangent qualifier code
   * (`branch_this_off` / `tangent_or_joke`) in its `droppedTags`. Read
   * off the node — NOT re-derived.
   */
  hasTangentLexicalCode: boolean;
  /**
   * Optional advisory routing inputs. When present they REINFORCE the
   * topology read; they never override `isEvidenceThread` or the
   * mainline. Both are advisory per their own cards.
   *   - `routedSuggestedAction` — BR-003's `assessTangentRisk` result
   *     for the branch root's draft, if it was carried.
   *   - `userOverrideLane` — MCP-010's recorded user lane choice, if any.
   */
  routedSuggestedAction?: RedirectSuggestedAction | null;
  userOverrideLane?: SemanticOverrideLane | null;
}

// ── BranchGrammarNode — the per-branch grammar record ───────────

/**
 * BR-004 — one record per branch. Pure derivation — no persisted shape.
 * Built by `buildBranchGrammarMap` from the timeline map + BR-001 maps.
 */
export interface BranchGrammarNode {
  /** `ArgumentTimelineMapNode.branchId`. */
  branchId: string;
  /** The teachable direction this branch draws in. */
  direction: BranchDirection;
  /** The branch root message id (the card's `originNodeId`). */
  originNodeId: string;
  /**
   * Distinct author count across the branch's messages. Derived by
   * counting unique `actorLabel` values among the branch's nodes.
   */
  participantCount: number;
  /**
   * ISO timestamp of the most-recent message in the branch — the max
   * `createdAt` across the branch's nodes. BR-004 computes this; the
   * timeline map supplies per-node `createdAt`.
   */
  lastActivityAt: string | null;
  /**
   * Count of branch messages that carry an UNRESOLVED-challenge
   * qualifier code in `droppedTags`, minus answering moves, clamped at
   * 0. A deterministic count over existing fields — NOT a LIFE-001
   * re-derive, NOT an axis classifier.
   */
  unresolvedAxisCount: number;
  /**
   * True when the OP OR the Primary Opponent has posted at least one
   * message inside this branch. For the mainline this is trivially true.
   */
  primaryPartyEngaged: boolean;
  /**
   * BR-004 — true when this branch is a tangent whose offshoot depth has
   * reached `TANGENT_DEPTH_CAP`. Drives the "summarize this offshoot"
   * advisory prompt. Deterministic; NO AI.
   */
  offshootDepthCapReached: boolean;
}

// ── CollapsedBranchSummary — the collapsed-stub contract ────────

/**
 * BR-004 — the four-field summary a COLLAPSED branch stub displays:
 * count . recency . unresolved . primary-party-engaged. Pure data; the
 * stub component renders it.
 */
export interface CollapsedBranchSummary {
  branchId: string;
  branchRootMessageId: string;
  direction: BranchDirection;
  /** Hidden message count inside the collapsed branch. */
  messageCount: number;
  /** Distinct participant count (`BranchGrammarNode.participantCount`). */
  participantCount: number;
  /** Most-recent activity timestamp (ISO) or null. */
  lastActivityAt: string | null;
  /** Plain-language relative recency, e.g. "active 2h ago". */
  recencyLabel: string;
  /** Count of unresolved items inside the branch. */
  unresolvedCount: number;
  /** True when OP or Primary Opponent has posted inside the branch. */
  primaryPartyEngaged: boolean;
  /** Plain-language one-line summary the stub renders. Ban-list-clean. */
  summaryLine: string;
  /** Full accessibility label — verbose. Plain English. */
  accessibilityLabel: string;
}

// ── BranchSelectionHandoff — the IX-004 hand-off shape ──────────

/**
 * BR-004 — the value the room shell passes to IX-004 when a branch (not
 * a single message) is selected. Shaped to IX-004's EXISTING inputs so
 * the panel needs zero changes — `branchRootMessageId` feeds IX-004's
 * existing selected-message channel verbatim; `status` is IX-004's
 * `ReadoutSelectionStatus`.
 */
export interface BranchSelectionHandoff {
  /** The message id IX-004's panel will show — the branch root. */
  branchRootMessageId: string;
  /** The IX-004 `ReadoutSelectionStatus` — always `'explicit'` for a
   *  deliberate branch click. */
  status: ReadoutSelectionStatus;
}

// ── Internal typed-field vocabularies (no body keyword reads) ────

/**
 * Qualifier codes that RAISE an unresolved item inside a branch. These
 * are the open-challenge family BR-001's `EVIDENCE_QUALIFIER_CODES`
 * reads off `droppedTags`; BR-004 reuses the same surface — it never
 * re-derives `MessageCategory`. Typed codes only; never the body text.
 */
const UNRESOLVED_CHALLENGE_CODES: ReadonlySet<string> = new Set([
  'evidence_challenge',
  'source_request',
  'quote_request',
  'ask_receipts',
  'quote_exact_bit',
  'challenge',
  'disagree',
]);

/**
 * Qualifier codes that ANSWER / RESOLVE an open item raised earlier in
 * the same branch. A later answering node drops the unresolved count.
 */
const ANSWERING_CODES: ReadonlySet<string> = new Set([
  'evidence',
  'concede',
  'synthesize',
  'confirm',
]);

// ── deriveBranchDirection ───────────────────────────────────────

/**
 * Map a branch's structural origin / cause to its teachable direction.
 * Pure. Deterministic. Idempotent — same input -> identical output.
 *
 * Reads ONLY structural fields (topology classification, evidence-thread
 * boolean, explicit qualifier codes, advisory routing inputs). NEVER
 * reads heat, popularity, reply count, participant count, recency, or
 * any strength / standing band.
 *
 * Derivation order (first match wins):
 *  1. `evidence_passthrough` — `isEvidenceThread === true`. Evidence
 *     pass-through is sacred; it wins over everything, including an
 *     explicit tangent tag (BR-004 must not restyle evidence branches).
 *  2. `mainline` — `isMainlineBranch === true`. The OP<->Primary spine
 *     by construction; activity never changes it.
 *  3. `tangent_diagonal` — any explicit tangent signal:
 *       - `inboundBranchKind` is `tangent` or `kink_end`, OR
 *       - `hasTangentLexicalCode === true`, OR
 *       - `userOverrideLane === 'tangent'` (MCP-010 user override —
 *         checked BEFORE the BR-003 route so a disagreeing user override
 *         wins), OR
 *       - `routedSuggestedAction` is `send_to_side_branch` / `branch_this`.
 *  4. `chime_in_vertical` — `inboundBranchKind === 'kink_start'` and no
 *     tangent signal fired: a real branch leaves the spine, it is not a
 *     tagged/routed tangent, it is not the mainline.
 *  5. Default -> `chime_in_vertical` — a non-mainline, non-evidence,
 *     non-tangent branch with an unclassified inbound kind (defensive;
 *     e.g. `detached`). The conservative, non-accusatory default — a
 *     detached branch is treated as a chime-in, never guessed a tangent.
 */
export function deriveBranchDirection(origin: BranchOrigin): BranchDirection {
  // Rule 1 — evidence pass-through is sacred.
  if (origin.isEvidenceThread) return 'evidence_passthrough';

  // Rule 2 — the mainline is structural.
  if (origin.isMainlineBranch) return 'mainline';

  // Rule 3 — any explicit tangent signal. The MCP-010 user override is
  // checked before the BR-003 route so that, when both are present and
  // disagree, the user's explicit lane choice is authoritative.
  if (origin.inboundBranchKind === 'tangent' || origin.inboundBranchKind === 'kink_end') {
    return 'tangent_diagonal';
  }
  if (origin.hasTangentLexicalCode) return 'tangent_diagonal';
  if (origin.userOverrideLane === 'tangent') return 'tangent_diagonal';
  if (origin.userOverrideLane === 'branch' || origin.userOverrideLane === 'mainline') {
    // A user override that is NOT 'tangent' suppresses a disagreeing
    // BR-003 route below — the user override wins. 'branch' falls
    // through to rule 4 as a chime-in; 'mainline' is handled here only
    // for a non-mainline branch (a no-op fall-through) — rule 2 already
    // caught a true mainline branch, so we just continue to rule 4.
  } else if (
    origin.routedSuggestedAction === 'send_to_side_branch' ||
    origin.routedSuggestedAction === 'branch_this'
  ) {
    return 'tangent_diagonal';
  }

  // Rule 4 — a genuine branch leaves the spine here, not a tangent.
  if (origin.inboundBranchKind === 'kink_start') return 'chime_in_vertical';

  // Rule 5 — conservative default.
  return 'chime_in_vertical';
}

// ── buildBranchGrammarMap ───────────────────────────────────────

interface BranchAccumulator {
  branchId: string;
  rootNode: ArgumentTimelineMapNode | null;
  nodes: ArgumentTimelineMapNode[];
}

/**
 * Build one `BranchGrammarNode` per branch in the timeline map. Pure.
 * O(n) over node count. Frozen output. Never mutates its inputs.
 */
export function buildBranchGrammarMap(args: {
  /** The built timeline map — source of nodes, branch ids, createdAt. */
  timelineMap: ArgumentTimelineMapModel;
  /** BR-001's per-edge topology map (`buildBranchKindMap` output). */
  branchKindByEdgeId: ReadonlyMap<string, RailBranchKind>;
  /** BR-001's evidence-thread map (`buildEvidenceThreadMap` output). */
  evidenceThreadByBranchRoot: ReadonlyMap<string, boolean>;
  /** The room's principal actor labels — OP + Primary Opponent. */
  principalActorLabels: ReadonlyArray<string>;
  /** Optional advisory inputs keyed by `branchRootMessageId`. */
  routedSuggestedActionByBranchRoot?: ReadonlyMap<string, RedirectSuggestedAction>;
  userOverrideLaneByBranchRoot?: ReadonlyMap<string, SemanticOverrideLane>;
}): ReadonlyMap<string, BranchGrammarNode> {
  const result = new Map<string, BranchGrammarNode>();
  const nodes = args.timelineMap.nodes;
  if (nodes.length === 0) return result;

  const principalSet = new Set(args.principalActorLabels);

  // Index nodes for parent walks.
  const nodeById = new Map<string, ArgumentTimelineMapNode>();
  for (const n of nodes) nodeById.set(n.messageId, n);

  // The inbound RailBranchKind keyed by toMessageId — the branch root's
  // inbound edge has the branch root as its `toMessageId`. We need the
  // edges to map an edgeId-keyed kind to a toMessageId-keyed kind.
  const inboundKindByToMessageId = new Map<string, RailBranchKind>();
  for (const edge of args.timelineMap.edges) {
    const kind = args.branchKindByEdgeId.get(edge.edgeId);
    if (kind !== undefined) inboundKindByToMessageId.set(edge.toMessageId, kind);
  }

  // Pass 1 — group nodes by branchId.
  const branches = new Map<string, BranchAccumulator>();
  for (const n of nodes) {
    let acc = branches.get(n.branchId);
    if (!acc) {
      acc = { branchId: n.branchId, rootNode: null, nodes: [] };
      branches.set(n.branchId, acc);
    }
    acc.nodes.push(n);
    if (n.messageId === n.branchRootMessageId) acc.rootNode = n;
  }

  // Pass 2 — derive direction first for every branch (needed for the
  // offshoot-depth walk in pass 3).
  const directionByBranchId = new Map<string, BranchDirection>();
  for (const [branchId, acc] of branches) {
    const root = acc.rootNode ?? acc.nodes[0];
    const origin = buildBranchOrigin({
      branchId,
      rootNode: root,
      inboundKindByToMessageId,
      evidenceThreadByBranchRoot: args.evidenceThreadByBranchRoot,
      routedSuggestedActionByBranchRoot: args.routedSuggestedActionByBranchRoot,
      userOverrideLaneByBranchRoot: args.userOverrideLaneByBranchRoot,
    });
    directionByBranchId.set(branchId, deriveBranchDirection(origin));
  }

  // Pass 3 — aggregate the per-branch fields + the offshoot-depth flag.
  for (const [branchId, acc] of branches) {
    const root = acc.rootNode ?? acc.nodes[0];
    const direction = directionByBranchId.get(branchId) ?? 'chime_in_vertical';

    // participantCount — distinct actorLabel.
    const actors = new Set<string>();
    let lastActivityAt: string | null = null;
    let primaryPartyEngaged = false;
    for (const n of acc.nodes) {
      actors.add(n.actorLabel);
      if (n.createdAt && (lastActivityAt === null || n.createdAt > lastActivityAt)) {
        lastActivityAt = n.createdAt;
      }
      if (principalSet.has(n.actorLabel)) primaryPartyEngaged = true;
    }

    const unresolvedAxisCount = countUnresolvedItems(acc.nodes);

    const offshootDepthCapReached =
      direction === 'tangent_diagonal' &&
      computeOffshootDepth(root, nodeById, directionByBranchId) >= TANGENT_DEPTH_CAP;

    result.set(
      branchId,
      Object.freeze({
        branchId,
        direction,
        originNodeId: root.branchRootMessageId,
        participantCount: actors.size,
        lastActivityAt,
        unresolvedAxisCount,
        primaryPartyEngaged,
        offshootDepthCapReached,
      }),
    );
  }

  return result;
}

/** Build a `BranchOrigin` for one branch root. Internal helper. */
function buildBranchOrigin(args: {
  branchId: string;
  rootNode: ArgumentTimelineMapNode;
  inboundKindByToMessageId: ReadonlyMap<string, RailBranchKind>;
  evidenceThreadByBranchRoot: ReadonlyMap<string, boolean>;
  routedSuggestedActionByBranchRoot?: ReadonlyMap<string, RedirectSuggestedAction>;
  userOverrideLaneByBranchRoot?: ReadonlyMap<string, SemanticOverrideLane>;
}): BranchOrigin {
  const { rootNode } = args;
  const branchRootMessageId = rootNode.branchRootMessageId;
  // Defensive: a branch root whose inbound edge has no entry in the
  // topology map is treated as `detached` (rule 5 default applies).
  const inboundBranchKind =
    args.inboundKindByToMessageId.get(branchRootMessageId) ?? 'detached';
  const isMainlineBranch = rootNode.isRoot === true;
  const isEvidenceThread =
    args.evidenceThreadByBranchRoot.get(branchRootMessageId) ?? false;
  const hasTangentLexicalCode = nodeHasTangentLexicalCode(rootNode);
  const routedSuggestedAction =
    args.routedSuggestedActionByBranchRoot?.get(branchRootMessageId) ?? null;
  const userOverrideLane =
    args.userOverrideLaneByBranchRoot?.get(branchRootMessageId) ?? null;
  return {
    branchId: args.branchId,
    branchRootMessageId,
    isMainlineBranch,
    inboundBranchKind,
    isEvidenceThread,
    hasTangentLexicalCode,
    routedSuggestedAction,
    userOverrideLane,
  };
}

/** Explicit tangent qualifier codes — same family BR-001 reads. */
const TANGENT_LEXICAL_CODES: ReadonlySet<string> = new Set([
  'branch_this_off',
  'tangent_or_joke',
]);

/** Does this node carry an explicit tangent qualifier in `droppedTags`? */
function nodeHasTangentLexicalCode(node: ArgumentTimelineMapNode): boolean {
  for (const tag of node.droppedTags) {
    if (TANGENT_LEXICAL_CODES.has(tag.code)) return true;
  }
  return false;
}

/**
 * Count unresolved open items inside one branch's nodes. Pure,
 * deterministic. Walks the branch's nodes in chronological order
 * (`ordinal`): each open-challenge code raises the count; each later
 * answering code drops it. Result is clamped at 0.
 */
function countUnresolvedItems(nodes: ReadonlyArray<ArgumentTimelineMapNode>): number {
  const ordered = [...nodes].sort((a, b) => a.ordinal - b.ordinal);
  let raised = 0;
  let resolved = 0;
  for (const n of ordered) {
    for (const tag of n.droppedTags) {
      if (UNRESOLVED_CHALLENGE_CODES.has(tag.code)) raised += 1;
      else if (ANSWERING_CODES.has(tag.code)) resolved += 1;
    }
  }
  return Math.max(0, raised - resolved);
}

/**
 * Compute the offshoot depth of a branch — the count of nested tangent
 * branches between the mainline and this branch. The mainline is 0; a
 * first tangent off the mainline is 1; a tangent off that is 2; etc.
 * Walks the branch root's `parentId` chain, counting each DISTINCT
 * branch crossed whose direction is `tangent_diagonal` (including this
 * branch itself when it is a tangent). Pure; bounded by tree depth.
 */
function computeOffshootDepth(
  branchRoot: ArgumentTimelineMapNode,
  nodeById: ReadonlyMap<string, ArgumentTimelineMapNode>,
  directionByBranchId: ReadonlyMap<string, BranchDirection>,
): number {
  let depth = 0;
  const seenBranches = new Set<string>();
  let cursor: ArgumentTimelineMapNode | undefined = branchRoot;
  const safetyLimit = nodeById.size + 1;
  let steps = 0;
  while (cursor && steps < safetyLimit) {
    if (!seenBranches.has(cursor.branchId)) {
      seenBranches.add(cursor.branchId);
      if (directionByBranchId.get(cursor.branchId) === 'tangent_diagonal') {
        depth += 1;
      }
    }
    if (cursor.parentId === null) break;
    const next = nodeById.get(cursor.parentId);
    if (!next || next.messageId === cursor.messageId) break;
    cursor = next;
    steps += 1;
  }
  return depth;
}

// ── buildCollapsedBranchSummary ─────────────────────────────────

/**
 * Build the four-field collapsed-stub summary from a `BranchGrammarNode`
 * + its hidden message count. Pure. The hidden count comes from BR-001's
 * `buildCollapsedRailInputs` (`RailStubViewModel.hiddenMessageCount`) —
 * BR-004 does NOT re-count; it consumes BR-001's already-computed value.
 *
 * The visible `summaryLine` and `accessibilityLabel` are the only
 * user-facing strings — both ban-list-tested.
 */
export function buildCollapsedBranchSummary(args: {
  grammarNode: BranchGrammarNode;
  hiddenMessageCount: number;
}): CollapsedBranchSummary {
  const { grammarNode } = args;
  const messageCount = Math.max(0, args.hiddenMessageCount);
  const participantCount = Math.max(0, grammarNode.participantCount);
  const unresolvedCount = Math.max(0, grammarNode.unresolvedAxisCount);
  const recencyLabel = formatRecencyLabel(grammarNode.lastActivityAt);

  const summaryLine = assembleSummaryLine({
    direction: grammarNode.direction,
    messageCount,
    participantCount,
    unresolvedCount,
    recencyLabel,
    primaryPartyEngaged: grammarNode.primaryPartyEngaged,
  });

  const accessibilityLabel = assembleAccessibilityLabel({
    direction: grammarNode.direction,
    messageCount,
    participantCount,
    unresolvedCount,
    recencyLabel,
    primaryPartyEngaged: grammarNode.primaryPartyEngaged,
  });

  return {
    branchId: grammarNode.branchId,
    branchRootMessageId: grammarNode.originNodeId,
    direction: grammarNode.direction,
    messageCount,
    participantCount,
    lastActivityAt: grammarNode.lastActivityAt,
    recencyLabel,
    unresolvedCount,
    primaryPartyEngaged: grammarNode.primaryPartyEngaged,
    summaryLine,
    accessibilityLabel,
  };
}

/** Plain-language relative recency, e.g. "active 2h ago". Never a raw
 *  timestamp; never an internal code. Empty/null -> "no activity yet". */
function formatRecencyLabel(lastActivityAt: string | null, nowMs?: number): string {
  const rel = formatRelativeShort(lastActivityAt, nowMs);
  if (rel === '') return BRANCH_GRAMMAR_COPY.recency_none;
  return `active ${rel}`;
}

/** The plain-language label for a direction, or '' for the evidence
 *  pass-through (BR-004 does not relabel evidence branches). */
export function branchDirectionLabel(direction: BranchDirection): string {
  switch (direction) {
    case 'mainline':
      return BRANCH_GRAMMAR_COPY.direction_mainline;
    case 'chime_in_vertical':
      return BRANCH_GRAMMAR_COPY.direction_chime_in_vertical;
    case 'tangent_diagonal':
      return BRANCH_GRAMMAR_COPY.direction_tangent_diagonal;
    case 'evidence_passthrough':
    default:
      return '';
  }
}

interface SummaryFragmentArgs {
  direction: BranchDirection;
  messageCount: number;
  participantCount: number;
  unresolvedCount: number;
  recencyLabel: string;
  primaryPartyEngaged: boolean;
}

function repliesFragment(count: number): string {
  if (count === 1) return BRANCH_GRAMMAR_COPY.summary_replies_one;
  return BRANCH_GRAMMAR_COPY.summary_replies_many.replace('{count}', String(count));
}

function peopleFragment(count: number): string {
  if (count === 1) return BRANCH_GRAMMAR_COPY.summary_people_one;
  return BRANCH_GRAMMAR_COPY.summary_people_many.replace('{count}', String(count));
}

function openFragment(count: number): string {
  if (count === 0) return BRANCH_GRAMMAR_COPY.summary_no_open;
  if (count === 1) return BRANCH_GRAMMAR_COPY.summary_open_one;
  return BRANCH_GRAMMAR_COPY.summary_open_many.replace('{count}', String(count));
}

/** Assemble the visible one-line summary. Direction label first when one
 *  exists; the four fields follow, separated by " · ". */
function assembleSummaryLine(a: SummaryFragmentArgs): string {
  const parts: string[] = [];
  const label = branchDirectionLabel(a.direction);
  if (label !== '') parts.push(label);
  parts.push(repliesFragment(a.messageCount));
  parts.push(peopleFragment(a.participantCount));
  parts.push(a.recencyLabel);
  parts.push(openFragment(a.unresolvedCount));
  parts.push(
    a.primaryPartyEngaged
      ? BRANCH_GRAMMAR_COPY.summary_principals_in
      : BRANCH_GRAMMAR_COPY.summary_principals_out,
  );
  return parts.join(' · ');
}

/** Assemble the verbose accessibility label — a full plain-English
 *  sentence describing the direction + all four fields + "Tap to
 *  expand". No internal code, no verdict token. */
function assembleAccessibilityLabel(a: SummaryFragmentArgs): string {
  const label = branchDirectionLabel(a.direction);
  const lead = label !== '' ? `${label} branch.` : 'Evidence branch.';
  const replies = repliesFragment(a.messageCount);
  const people = peopleFragment(a.participantCount);
  const open = openFragment(a.unresolvedCount);
  const principals = a.primaryPartyEngaged
    ? BRANCH_GRAMMAR_COPY.summary_principals_in
    : BRANCH_GRAMMAR_COPY.summary_principals_out;
  return `${lead} ${replies}, ${people}, ${a.recencyLabel}, ${open}, ${principals}. Tap to expand.`;
}

// ── resolveBranchSelectionHandoff ───────────────────────────────

/**
 * Resolve a branch click into the IX-004 hand-off shape. Returns the
 * branch root message id + `status: 'explicit'`. Returns `null` when the
 * `branchId` is unknown (defensive). This is pure local state — it
 * triggers NO route transition.
 */
export function resolveBranchSelectionHandoff(
  branchId: string,
  grammarMap: ReadonlyMap<string, BranchGrammarNode>,
): BranchSelectionHandoff | null {
  const node = grammarMap.get(branchId);
  if (!node) return null;
  return {
    branchRootMessageId: node.originNodeId,
    status: 'explicit',
  };
}

// ── Advisory-input bridges ──────────────────────────────────────

/**
 * Map a BR-003 `RedirectSuggestedAction` to the `BranchDirection` a
 * routed move should land in. BR-004 consumes BR-003's output; it does
 * NOT re-run `assessTangentRisk`.
 *   continue                -> 'mainline'
 *   send_to_side_branch     -> 'tangent_diagonal'
 *   branch_this             -> 'tangent_diagonal'
 *   ask_clarifying_question -> 'mainline'  (a clarification re-aims at
 *                                           the parent — it stays on
 *                                           the spine)
 */
export function suggestedActionToBranchDirection(
  action: RedirectSuggestedAction,
): BranchDirection {
  switch (action) {
    case 'send_to_side_branch':
    case 'branch_this':
      return 'tangent_diagonal';
    case 'continue':
    case 'ask_clarifying_question':
      return 'mainline';
    default:
      // Defensive — unreachable for the typed union.
      return 'mainline';
  }
}

/**
 * Map an MCP-010 `SemanticOverrideLane` to a `BranchDirection`. MCP-010's
 * lane choice is an advisory routing input.
 *   'mainline' -> 'mainline'
 *   'branch'   -> 'chime_in_vertical'  (a deliberate branch that is not
 *                                       a tangent — i.e. a chime-in)
 *   'tangent'  -> 'tangent_diagonal'
 */
export function overrideLaneToBranchDirection(
  lane: SemanticOverrideLane,
): BranchDirection {
  switch (lane) {
    case 'mainline':
      return 'mainline';
    case 'branch':
      return 'chime_in_vertical';
    case 'tangent':
      return 'tangent_diagonal';
    default:
      // Defensive — unreachable for the typed union.
      return 'chime_in_vertical';
  }
}

// ── Ban-list support ────────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/branchGrammarNoVerdict.test.ts`.
 * NOT a content filter. Mirrors `_forbiddenTangentTokens` so BR-004 copy
 * is held to the same bar: verdict tokens, amplification tokens, and
 * person-attribution tokens. A branch direction describes a STRUCTURAL
 * position — every produced string describes the branch / the thread,
 * never the person, never a verdict.
 */
export function _forbiddenBranchGrammarTokens(): string[] {
  return [
    // Verdict tokens
    'winner',
    'loser',
    'correct',
    'incorrect',
    'true',
    'false',
    'right',
    'wrong',
    'won',
    'lost',
    'defeated',
    'proven',
    'disproven',
    'verdict',
    'proof',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'validated',
    // Amplification tokens
    'popular',
    'trending',
    'viral',
    'virality',
    'engagement',
    'likes',
    'retweets',
    'shares',
    'views',
    'followers',
    // Person-attribution / punitive tokens
    'dodge',
    'dodging',
    'evade',
    'evading',
    'evasion',
    'troll',
    'bot',
    'astroturfer',
    // Block / prevent tokens (a grammar layer must never block)
    'block',
    'prevent',
    'reject',
    'forbid',
    'disallow',
  ];
}
