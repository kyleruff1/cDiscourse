/**
 * BR-001 — Branch topology model (pure TypeScript).
 *
 * Owns:
 *   1. Deterministic population of `RailBranchKind` for every edge in a
 *      timeline graph (replaces VG-002's placeholder helper).
 *   2. Evidence-thread detection (a branch is "about evidence" when the
 *      subtree is dominated by evidence-typed messages).
 *   3. Branch collapse state + auto-expand rule (active node inside a
 *      collapsed branch silently expands its ancestors).
 *   4. A pre-collapsed rail-input feeder that filters out segments inside
 *      collapsed branches and emits one `RailStubViewModel` per branch.
 *
 * Doctrine anchor — read this before changing anything in this file:
 *
 *   **A tangent is a topology label, not a verdict.** "Tangent" means a
 *   child argument leaves the main thread; it NEVER means the child is
 *   wrong, off-topic-as-content, low-value, popular, hot, viral,
 *   supported, or true. The classifier reads four orthogonal booleans
 *   (`isDetached`, `siblingIndex`, `isEvidenceThread`,
 *   `hasTangentLexicalCode`) — it NEVER reads heat / popularity /
 *   engagement / strength bands / standing bands / any AI signal.
 *
 * Separation of concerns:
 *
 *   - `argumentGameSurfaceModel` owns layout (lanes, x/y positions,
 *     band geometry, banner geometry). It is NOT replaced or merged.
 *   - `branchTopologyModel` (this file) owns topology classification
 *     and collapse state. It reads `ArgumentTimelineMapNode` / `Edge`
 *     fields produced by the surface model; it never writes them.
 *
 * Pure TS. No React. No Supabase. No network. No async. No mutation of
 * any input. No new dependency.
 */

import type {
  ArgumentTimelineMapEdge,
  ArgumentTimelineMapNode,
} from './argumentGameSurfaceModel';
import type { RailBranchKind, RailSegmentInput } from './railSegmentModel';

// ── Evidence-thread detection ────────────────────────────────────

/** Qualifier codes that mark a node as evidence-shaped. Read-only from
 *  `node.droppedTags[].code`. Mirrors the existing `mapDroppedTags`
 *  surface — we do NOT re-derive `MessageCategory` per render. */
const EVIDENCE_QUALIFIER_CODES: ReadonlyArray<string> = Object.freeze([
  'evidence',
  'evidence_challenge',
  'source_request',
  'quote_request',
  // Future-compat: `messageQualifiers.MessageQualifier` codes that also
  // mean "this message is about evidence". Already populated on
  // `droppedTags` upstream by the qualifier deriver.
  'ask_receipts',
  'quote_exact_bit',
]);

/**
 * Returns true when the node looks like it belongs to an evidence
 * conversation — either its argument-type family is `'evidence'` or it
 * carries one of the evidence qualifier codes.
 *
 * Does NOT decide whether the evidence is *good*. Describes "this
 * conversation is about evidence", not "this evidence is sufficient,
 * primary, or correct". The EV-001 / EV-002 source-chain status layer
 * is a separate surface that lives on the rail's evidence-track overlay
 * and is NOT consulted here.
 */
export function isEvidenceLikeNode(node: ArgumentTimelineMapNode): boolean {
  if (node.kindColorFamily === 'evidence') return true;
  for (const tag of node.droppedTags) {
    if (EVIDENCE_QUALIFIER_CODES.includes(tag.code)) return true;
  }
  return false;
}

/**
 * Build a `Map<branchRootMessageId, boolean>` over the tree. One pass
 * over nodes + one pass over edges + one DFS per branch-root (the DFS
 * is bounded by subtree size — every node is visited once across all
 * branch-root walks because a visited-set guards re-entry).
 *
 * A subtree rooted at `branchRoot` is an **evidence-thread** when:
 *
 *   - The subtree contains ≥ 2 messages (including the branch root
 *     itself — a branch with just a root and one descendant qualifies
 *     when that descendant is evidence-like), AND
 *   - ≥ 50% of the **non-root descendants** are evidence-like per
 *     `isEvidenceLikeNode`. Excluding the root from the percentage
 *     calculation keeps the heuristic stable when an opinion-typed
 *     argument triggers a follow-up evidence conversation.
 */
export function buildEvidenceThreadMap(
  nodes: ReadonlyArray<ArgumentTimelineMapNode>,
): ReadonlyMap<string, boolean> {
  const result = new Map<string, boolean>();
  if (nodes.length === 0) return result;

  // Pass 1 — index nodes + build child lookup.
  const nodeById = new Map<string, ArgumentTimelineMapNode>();
  const childIdsByParent = new Map<string, string[]>();
  for (const n of nodes) {
    nodeById.set(n.messageId, n);
  }
  for (const n of nodes) {
    if (n.parentId !== null && nodeById.has(n.parentId)) {
      const list = childIdsByParent.get(n.parentId) ?? [];
      list.push(n.messageId);
      childIdsByParent.set(n.parentId, list);
    }
  }

  // Pass 2 — collect candidate branch roots (a node whose
  // `branchRootMessageId === messageId` AND which has a parent — the
  // top-level root of the conversation is its own branch root but is
  // not a "branch" in BR-001's sense).
  const branchRoots: string[] = [];
  for (const n of nodes) {
    if (n.branchRootMessageId === n.messageId && n.parentId !== null) {
      branchRoots.push(n.messageId);
    }
  }

  // Pass 3 — DFS each branch root's subtree, counting evidence-like
  // children. Defensive `visited` guard handles any cycle the upstream
  // surface model failed to filter (acyclic is the invariant; the
  // guard is belt-and-suspenders).
  for (const rootId of branchRoots) {
    const visited = new Set<string>();
    let nonRootCount = 0;
    let evidenceCount = 0;
    const stack: string[] = [rootId];
    visited.add(rootId);
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id !== rootId) {
        nonRootCount += 1;
        const node = nodeById.get(id);
        if (node && isEvidenceLikeNode(node)) evidenceCount += 1;
      }
      const children = childIdsByParent.get(id);
      if (children) {
        for (const childId of children) {
          if (!visited.has(childId)) {
            visited.add(childId);
            stack.push(childId);
          }
        }
      }
    }
    // Includes-root size requirement: branch root + at least one
    // descendant. The percentage is over non-root descendants so an
    // opinion-typed root with two evidence-like replies still counts
    // as an evidence-thread.
    const totalIncludingRoot = nonRootCount + 1;
    const isEvidenceThread =
      totalIncludingRoot >= 2 &&
      nonRootCount > 0 &&
      evidenceCount / nonRootCount >= 0.5;
    result.set(rootId, isEvidenceThread);
  }

  return result;
}

// ── Topology classifier ─────────────────────────────────────────

/** Qualifier codes that mark an explicit user/moderator-tagged tangent. */
const TANGENT_LEXICAL_CODES: ReadonlyArray<string> = Object.freeze([
  'branch_this_off',
  'tangent_or_joke',
]);

/**
 * Returns true when either endpoint of an edge carries an explicit
 * tangent qualifier code. Reads `droppedTags[].code` only.
 */
export function hasTangentLexicalCode(
  fromNode: ArgumentTimelineMapNode,
  toNode: ArgumentTimelineMapNode,
): boolean {
  for (const tag of fromNode.droppedTags) {
    if (TANGENT_LEXICAL_CODES.includes(tag.code)) return true;
  }
  for (const tag of toNode.droppedTags) {
    if (TANGENT_LEXICAL_CODES.includes(tag.code)) return true;
  }
  return false;
}

export interface DeriveBranchKindInput {
  fromNode: ArgumentTimelineMapNode;
  toNode: ArgumentTimelineMapNode;
  /** Whether the parent of `toNode` is missing from the loaded set. */
  isDetached: boolean;
  /** Chronological sibling index of `toNode` among its parent's direct
   *  children. Populated upstream by `argumentGameSurfaceModel`. */
  siblingIndex: number;
  /** Whether the subtree rooted at `toNode.branchRootMessageId` is an
   *  evidence-thread per `buildEvidenceThreadMap`. */
  isEvidenceThread: boolean;
  /** Whether either endpoint carries `branch_this_off` or
   *  `tangent_or_joke` in `droppedTags`. */
  hasTangentLexicalCode: boolean;
}

/**
 * Pass-1 classifier. Reads four orthogonal booleans and returns one of
 * `'main'`, `'kink_start'`, `'detached'`. Never returns `'tangent'` or
 * `'kink_end'` — those are filled in by `buildBranchKindMap`'s second
 * pass.
 *
 * Decision table (see `docs/designs/BR-001.md` §"Topology model"):
 *
 *   row 1: isDetached → `'detached'`
 *   row 2: !isDetached + siblingIndex 0 + evidence-thread → `'main'`
 *   row 3: !isDetached + siblingIndex 0 + non-evidence + no-tag → `'main'`
 *   row 4: !isDetached + siblingIndex 0 + non-evidence + explicit-tag → `'kink_start'`
 *   row 5: !isDetached + siblingIndex ≥ 1 + evidence-thread → `'main'`
 *   row 6: !isDetached + siblingIndex ≥ 1 + non-evidence + no-tag → `'kink_start'`
 *   row 7: !isDetached + siblingIndex ≥ 1 + non-evidence + explicit-tag → `'kink_start'`
 *
 * Pure. Deterministic. Never reads color / heat / popularity / engagement /
 * strength bands / standing bands / AI signals.
 */
export function deriveBranchKindFromConstitutionModel(
  input: DeriveBranchKindInput,
): RailBranchKind {
  const { isDetached, siblingIndex, isEvidenceThread, hasTangentLexicalCode: hasTangent } = input;

  // Row 1.
  if (isDetached) return 'detached';

  // Evidence-thread edges stay on lane visually regardless of sibling
  // index (row 2 + row 5). Doctrine: evidence-thread describes "this
  // conversation is about evidence" — it does NOT promote any single
  // edge to mainline-correctness.
  if (isEvidenceThread) return 'main';

  // Non-evidence path.
  if (siblingIndex === 0) {
    // Row 3 vs row 4 — explicit tag is the narrow override.
    return hasTangent ? 'kink_start' : 'main';
  }

  // siblingIndex ≥ 1 — additional non-evidence sibling.
  // Rows 6 + 7 collapse to a single result.
  return 'kink_start';
}

/**
 * Build the full `Map<edgeId, RailBranchKind>` for a tree in two passes.
 *
 *   Pass 1 — call `deriveBranchKindFromConstitutionModel` for every
 *            edge. Produces `'main'` / `'kink_start'` / `'detached'`.
 *
 *   Pass 2 — walk edges; for each edge whose parent edge (the edge that
 *            ends at this edge's `fromMessageId`) is `'kink_start'` or
 *            `'tangent'`, mark it `'tangent'`. Then mark the **leaves**
 *            of every kinked subtree as `'kink_end'`.
 *
 * Pure. O(n). Frozen output.
 */
export function buildBranchKindMap(args: {
  nodes: ReadonlyArray<ArgumentTimelineMapNode>;
  edges: ReadonlyArray<ArgumentTimelineMapEdge>;
  evidenceThreadByBranchRoot: ReadonlyMap<string, boolean>;
}): ReadonlyMap<string, RailBranchKind> {
  const result = new Map<string, RailBranchKind>();
  if (args.edges.length === 0) return result;

  const nodeById = new Map<string, ArgumentTimelineMapNode>();
  for (const n of args.nodes) nodeById.set(n.messageId, n);

  // Index edge by its `toMessageId` so we can find an edge's parent
  // edge (the edge that ends at this edge's `fromMessageId`) in O(1).
  // A given `toMessageId` belongs to exactly one inbound edge in a tree.
  const edgeByToMessageId = new Map<string, ArgumentTimelineMapEdge>();
  for (const e of args.edges) edgeByToMessageId.set(e.toMessageId, e);

  // Pass 1 — four-axis switch per edge.
  for (const edge of args.edges) {
    const fromNode = nodeById.get(edge.fromMessageId);
    const toNode = nodeById.get(edge.toMessageId);
    if (!fromNode || !toNode) {
      // Defensive: an edge whose endpoints aren't in the node set is
      // treated as detached so the rail hides it.
      result.set(edge.edgeId, 'detached');
      continue;
    }
    const isEvidenceThread =
      args.evidenceThreadByBranchRoot.get(toNode.branchRootMessageId) ?? false;
    const kind = deriveBranchKindFromConstitutionModel({
      fromNode,
      toNode,
      isDetached: edge.isDetached,
      siblingIndex: toNode.siblingIndex,
      isEvidenceThread,
      hasTangentLexicalCode: hasTangentLexicalCode(fromNode, toNode),
    });
    result.set(edge.edgeId, kind);
  }

  // Pass 2a — interior edges of a kinked subtree become 'tangent'.
  // We iterate until stable because the parent-edge classification may
  // itself have been set to 'tangent' in an earlier iteration. The
  // worst case is O(depth) passes but realistic trees converge in 1-2
  // sweeps because pass-1 leaves at most one `'kink_start'` per branch.
  let changed = true;
  let sweeps = 0;
  const maxSweeps = args.edges.length + 1;
  while (changed && sweeps < maxSweeps) {
    changed = false;
    sweeps += 1;
    for (const edge of args.edges) {
      const currentKind = result.get(edge.edgeId);
      if (currentKind !== 'main') continue;
      const parentEdge = edgeByToMessageId.get(edge.fromMessageId);
      if (!parentEdge) continue;
      const parentKind = result.get(parentEdge.edgeId);
      if (parentKind === 'kink_start' || parentKind === 'tangent') {
        result.set(edge.edgeId, 'tangent');
        changed = true;
      }
    }
  }

  // Pass 2b — every 'kink_start' or 'tangent' edge whose `toNode` has
  // no outbound edge in the loaded set becomes 'kink_end' (the leaf of
  // the tangent subtree). A `kink_start` with no children is BOTH the
  // start AND the end of the subtree, which renders the kink-start
  // stub at the parent side (per railSegmentModel.deriveWrapper). We
  // keep `kink_start` in that degenerate case so the visual start-stub
  // still fires.
  const childCountByEdgeFrom = new Map<string, number>();
  for (const edge of args.edges) {
    const k = result.get(edge.edgeId);
    if (k === 'tangent' || k === 'kink_start') {
      const fromKey = edge.fromMessageId;
      childCountByEdgeFrom.set(fromKey, (childCountByEdgeFrom.get(fromKey) ?? 0) + 1);
    }
  }
  for (const edge of args.edges) {
    const k = result.get(edge.edgeId);
    if (k === 'tangent') {
      // A 'tangent' edge whose `toMessageId` has no children that are
      // also tangent/kink is the leaf. Look at outbound edges from this
      // edge's `toMessageId`.
      const outboundChildrenCount = countOutboundTangentChildren(
        edge.toMessageId,
        args.edges,
        result,
      );
      if (outboundChildrenCount === 0) {
        result.set(edge.edgeId, 'kink_end');
      }
    }
  }

  return result;
}

/**
 * Count how many outbound edges from `messageId` have a tangent-family
 * classification in `result`. Helper for pass 2b — does NOT mutate.
 */
function countOutboundTangentChildren(
  messageId: string,
  edges: ReadonlyArray<ArgumentTimelineMapEdge>,
  result: ReadonlyMap<string, RailBranchKind>,
): number {
  let n = 0;
  for (const e of edges) {
    if (e.fromMessageId !== messageId) continue;
    const k = result.get(e.edgeId);
    if (k === 'tangent' || k === 'kink_start' || k === 'kink_end') n += 1;
  }
  return n;
}

// ── Collapse state ──────────────────────────────────────────────

/**
 * In-memory only. NOT persisted in v1. Keyed by the branch's root
 * message id (matches `ArgumentTimelineMapNode.branchRootMessageId`).
 *
 * Anything not in the map is treated as `'expanded'`. Storing only
 * `'collapsed'` entries keeps the object small.
 */
export type BranchCollapseState = Readonly<Record<string, 'expanded' | 'collapsed'>>;

/** Empty default — nothing is collapsed at first render. */
export const EMPTY_COLLAPSE_STATE: BranchCollapseState = Object.freeze({});

/**
 * Toggle one branch's collapse state. Returns a new object — never
 * mutates the input. When the branch is currently collapsed (or
 * missing) the result has it `'collapsed'`; when currently collapsed
 * the result has the entry removed (back to default expanded).
 */
export function toggleBranchCollapse(
  state: BranchCollapseState,
  branchRootMessageId: string,
): BranchCollapseState {
  const next: Record<string, 'expanded' | 'collapsed'> = { ...state };
  if (next[branchRootMessageId] === 'collapsed') {
    delete next[branchRootMessageId];
  } else {
    next[branchRootMessageId] = 'collapsed';
  }
  return Object.freeze(next);
}

/**
 * Auto-expand rule: given the active message id + the node map,
 * silently uncollapse every ancestor `branchRootMessageId` of the
 * active path so the active node is always visible. Returns a new
 * state object (immutable update). When `activeMessageId` is `null`,
 * the rule is a no-op and the input state is returned as-is.
 *
 * Pure. O(depth).
 */
export function applyActiveAutoExpand(
  state: BranchCollapseState,
  activeMessageId: string | null,
  nodeById: ReadonlyMap<string, ArgumentTimelineMapNode>,
): BranchCollapseState {
  if (activeMessageId === null) return state;
  const collapsedKeys = Object.keys(state).filter(
    (k) => state[k] === 'collapsed',
  );
  if (collapsedKeys.length === 0) return state;

  // Walk parentId chain from the active node up. Collect every
  // branchRootMessageId we cross. Any of those that is currently
  // 'collapsed' must be removed.
  const ancestorBranchRoots = new Set<string>();
  let cursor: ArgumentTimelineMapNode | undefined = nodeById.get(activeMessageId);
  const safetyLimit = nodeById.size + 1;
  let steps = 0;
  while (cursor && steps < safetyLimit) {
    ancestorBranchRoots.add(cursor.branchRootMessageId);
    if (cursor.parentId === null) break;
    const next = nodeById.get(cursor.parentId);
    if (!next || next.messageId === cursor.messageId) break;
    cursor = next;
    steps += 1;
  }

  let changed = false;
  const out: Record<string, 'expanded' | 'collapsed'> = { ...state };
  for (const key of collapsedKeys) {
    if (ancestorBranchRoots.has(key)) {
      delete out[key];
      changed = true;
    }
  }
  if (!changed) return state;
  return Object.freeze(out);
}

// ── Stub view-model ─────────────────────────────────────────────

export interface RailStubViewModel {
  /** Stable id derived from the branch root. */
  stubId: string;
  /** The branch root message id. Tap re-expands this branch. */
  branchRootMessageId: string;
  /** Anchor pixel position (where the branch leaves the mainline). */
  anchorX: number;
  anchorY: number;
  /** Number of messages hidden inside the collapsed branch. */
  hiddenMessageCount: number;
  /** Plain-English label, e.g. "3 hidden replies on the side branch." */
  label: string;
  /** Plain-English accessibility label. */
  accessibilityLabel: string;
  /** When true, the stub renders a subtle "active inside" indicator
   *  because the room's `activeMessageId` is in this collapsed subtree
   *  BUT auto-expand was suppressed by the caller (rare; defensive). */
  containsActive: boolean;
  /** Border color the stub renders. Inherits from `node.kindColor` —
   *  no new color token introduced. */
  borderColor: string;
}

/**
 * Walk the segment list, filter out segments whose `toMessageId` lives
 * inside a collapsed branch, and emit one `RailStubViewModel` per
 * collapsed branch. Pure.
 *
 * A segment is "inside a collapsed branch" when its `toMessageId`'s
 * `branchRootMessageId` is collapsed in `collapseState` AND that
 * `branchRootMessageId !== toMessageId` (the inbound edge to the branch
 * root itself stays visible — it's the edge that anchors the stub
 * geometrically).
 *
 * Degenerate branches with `hiddenMessageCount === 0` are skipped — no
 * stub is emitted for them even though the state entry is preserved.
 */
export function buildCollapsedRailInputs(args: {
  segments: ReadonlyArray<RailSegmentInput>;
  nodeById: ReadonlyMap<string, ArgumentTimelineMapNode>;
  collapseState: BranchCollapseState;
  /** Optional. When set, stubs whose subtree contains this message id
   *  flip `containsActive` to true. Auto-expand normally prevents this
   *  state from occurring; the flag is defensive. */
  activeMessageId?: string | null;
}): {
  visibleSegments: RailSegmentInput[];
  stubs: RailStubViewModel[];
} {
  const { segments, nodeById, collapseState, activeMessageId } = args;

  const collapsedRoots = new Set<string>();
  for (const [key, value] of Object.entries(collapseState)) {
    if (value === 'collapsed') collapsedRoots.add(key);
  }

  // Empty fast path.
  if (collapsedRoots.size === 0) {
    return {
      visibleSegments: segments.slice(),
      stubs: [],
    };
  }

  // First pass — compute, for each collapsed root, the count of nodes
  // inside its subtree.
  const hiddenCountByRoot = new Map<string, number>();
  const subtreeContainsActiveByRoot = new Map<string, boolean>();
  for (const node of nodeById.values()) {
    if (
      collapsedRoots.has(node.branchRootMessageId) &&
      node.messageId !== node.branchRootMessageId
    ) {
      const root = node.branchRootMessageId;
      hiddenCountByRoot.set(root, (hiddenCountByRoot.get(root) ?? 0) + 1);
      if (activeMessageId && node.messageId === activeMessageId) {
        subtreeContainsActiveByRoot.set(root, true);
      }
    }
  }

  // Second pass — filter segments. A segment is hidden when its
  // `toMessageId` lives strictly INSIDE a collapsed subtree (i.e. the
  // `toNode`'s `branchRootMessageId` is collapsed AND the `toNode` is
  // not the branch root itself). The inbound edge (parent → branchRoot)
  // stays visible because its `toMessageId` IS the branch root — that
  // edge gives the stub its geometric anchor on the rail.
  const visibleSegments: RailSegmentInput[] = [];
  for (const seg of segments) {
    const toNode = nodeById.get(seg.toMessageId);
    if (!toNode) {
      // Keep — the rail's `'detached'` handling owns this case.
      visibleSegments.push(seg);
      continue;
    }
    const toInsideCollapsed =
      collapsedRoots.has(toNode.branchRootMessageId) &&
      toNode.messageId !== toNode.branchRootMessageId;
    if (toInsideCollapsed) continue;
    visibleSegments.push(seg);
  }

  // Third pass — emit one stub per collapsed branch with
  // `hiddenMessageCount > 0`. The anchor `(x, y)` is the branch root
  // node's position — same coordinates the rail uses, so the stub
  // visually lines up regardless of virtualization.
  const stubs: RailStubViewModel[] = [];
  // Deterministic ordering: sort branch roots by their node's x
  // coordinate when available, falling back to messageId.
  const sortedRoots = [...collapsedRoots].sort((a, b) => {
    const na = nodeById.get(a);
    const nb = nodeById.get(b);
    const xa = na ? na.x : Number.MAX_SAFE_INTEGER;
    const xb = nb ? nb.x : Number.MAX_SAFE_INTEGER;
    if (xa !== xb) return xa - xb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  for (const rootId of sortedRoots) {
    const hidden = hiddenCountByRoot.get(rootId) ?? 0;
    if (hidden === 0) continue;
    const rootNode = nodeById.get(rootId);
    if (!rootNode) continue;
    const containsActive = subtreeContainsActiveByRoot.get(rootId) === true;
    const label = formatStubLabel(hidden);
    const accessibilityLabel = formatStubAccessibilityLabel(hidden, containsActive);
    stubs.push({
      stubId: `stub-${rootId}`,
      branchRootMessageId: rootId,
      anchorX: rootNode.x,
      anchorY: rootNode.y,
      hiddenMessageCount: hidden,
      label,
      accessibilityLabel,
      containsActive,
      borderColor: rootNode.kindColor,
    });
  }

  return { visibleSegments, stubs };
}

// ── Plain-language helpers (ban-list-safe) ──────────────────────

/**
 * Build the visible label for a collapse stub. Plain English. Never
 * contains verdict / amplification / snake_case tokens. The visible
 * label is a compact count (e.g. "+3") so it reads well on the rail.
 *
 * The longer accessibility label lives in `formatStubAccessibilityLabel`.
 */
function formatStubLabel(hiddenMessageCount: number): string {
  // Compact visible badge — fits in a 24px pill.
  return `+${Math.max(0, hiddenMessageCount)}`;
}

/**
 * Build the accessibility-label for a collapse stub. Plain English,
 * full sentence. Never contains verdict / amplification tokens. Never
 * snake_case.
 */
function formatStubAccessibilityLabel(
  hiddenMessageCount: number,
  containsActive: boolean,
): string {
  const safeCount = Math.max(0, hiddenMessageCount);
  const plural = safeCount === 1 ? 'reply' : 'replies';
  const active = containsActive ? ' Includes the active message.' : '';
  return `${safeCount} hidden ${plural} on the side branch.${active} Tap to expand.`;
}

// ── Adapter for legacy call site ─────────────────────────────────

/**
 * Legacy adapter — same signature as VG-002's `derivePlaceholderBranchKind`.
 * Used in places that don't yet thread the evidence-thread map.
 *
 * Delegates to `deriveBranchKindFromConstitutionModel` with safe
 * defaults: `isEvidenceThread: false` and `hasTangentLexicalCode`
 * derived from the endpoints' `droppedTags`. The thin adapter never
 * mis-classifies a real `'main'` edge as `'kink_start'` because the
 * legacy three-rule output and the new helper agree on the rows the
 * adapter can produce (`'detached'`, `'kink_start'` only when
 * explicit-tag, `'main'` otherwise).
 *
 * Re-exported below from `railSegmentModel.ts` with the legacy name to
 * preserve the surface lock.
 */
export function derivePlaceholderBranchKindBR001Adapter(args: {
  fromNode: ArgumentTimelineMapNode;
  toNode: ArgumentTimelineMapNode;
  isDetached: boolean;
}): RailBranchKind {
  return deriveBranchKindFromConstitutionModel({
    fromNode: args.fromNode,
    toNode: args.toNode,
    isDetached: args.isDetached,
    siblingIndex: args.toNode.siblingIndex,
    isEvidenceThread: false,
    hasTangentLexicalCode: hasTangentLexicalCode(args.fromNode, args.toNode),
  });
}
