/**
 * INTEL-001 (#900) — dodge-chain derivation (pure TypeScript).
 *
 * A dodge-chain is a maximal run of >= 2 CONSECUTIVE `did_not_address` moves on
 * ONE thread. It is a friction / escalation reading (it replaces tone-guessing),
 * consumed by the engagement-lane heat term + the mediator "what remains
 * unresolved" weighting. It describes THREADS (argument-id runs) — NEVER a
 * person, NEVER a standing.
 *
 * Doctrine (point-standing-economy / evidence-doctrine anti-amplification):
 *  - This module imports NOTHING from pointStanding and emits NO score / delta /
 *    weight-into-standing field. A wall of `did_not_address` marks can feed heat
 *    and the mediator summary but can NEVER lower a claim's factual standing.
 *  - Thread-scoped only: no `created_by` / `authorId` / any person field is read.
 *
 * PURE: no React, no Supabase, no network, no Date.now, no Math.random, no
 * mutation. Total on empty input. Deterministic (any input order -> deep-equal).
 */

/** Minimal tree node the derivation needs (id + tree parent). */
export interface DodgeChainNodeInput {
  readonly id: string;
  readonly parentId: string | null;
}

/** One dodge-chain: a maximal head->leaf run of >= 2 consecutive unaddressed moves. */
export interface DodgeChain {
  /** The shallowest (head) node of the run — the chain's stable anchor. */
  readonly anchorArgumentId: string;
  /** Ordered head -> leaf. Length >= MIN_DODGE_CHAIN_LENGTH. Argument ids only. */
  readonly memberArgumentIds: readonly string[];
  /** Node count in the run (== memberArgumentIds.length), >= 2. */
  readonly length: number;
}

export interface DodgeChainDerivation {
  /** Maximal single-thread unaddressed paths (len >= 2), sorted deterministically. */
  readonly chains: readonly DodgeChain[];
  /** Distinct nodes participating in ANY chain (deduped — branch prefixes once). */
  readonly unaddressedChainNodeCount: number;
  /** Longest chain length in nodes (0 when no chain). */
  readonly longestChainLength: number;
  /** chains.length. */
  readonly chainCount: number;
}

/** A single dodge is not a chain. */
export const MIN_DODGE_CHAIN_LENGTH = 2;

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function deriveDodgeChains(input: {
  unaddressedMoveIds: readonly string[];
  nodes: readonly DodgeChainNodeInput[];
}): DodgeChainDerivation {
  const nodes = input.nodes ?? [];
  const nodeSet = new Set<string>();
  const parentOf = new Map<string, string | null>();
  for (const n of nodes) {
    if (!n || typeof n.id !== 'string') continue;
    nodeSet.add(n.id);
    parentOf.set(n.id, n.parentId ?? null);
  }

  // U = unaddressed nodes that are actually in the tree.
  const U = new Set<string>();
  for (const id of input.unaddressedMoveIds ?? []) {
    if (nodeSet.has(id)) U.add(id);
  }

  // A node c is linked to its parent in a chain iff c in U and parent(c) in U.
  const childrenOfU = new Map<string, string[]>();
  const heads: string[] = [];
  for (const c of U) {
    const p = parentOf.get(c) ?? null;
    if (p !== null && U.has(p)) {
      const arr = childrenOfU.get(p);
      if (arr) arr.push(c);
      else childrenOfU.set(p, [c]);
    } else {
      // parent null / outside the node set / not unaddressed => c is a head.
      heads.push(c);
    }
  }

  const chains: DodgeChain[] = [];
  const cap = nodeSet.size + 1; // parent-walk guard against a malformed cycle.
  for (const head of heads.sort(compareStrings)) {
    dfs(head, [], childrenOfU, chains, cap);
  }

  chains.sort((a, b) => {
    if (a.anchorArgumentId !== b.anchorArgumentId) {
      return compareStrings(a.anchorArgumentId, b.anchorArgumentId);
    }
    return compareStrings(a.memberArgumentIds.join(','), b.memberArgumentIds.join(','));
  });

  const distinct = new Set<string>();
  let longest = 0;
  for (const chain of chains) {
    for (const id of chain.memberArgumentIds) distinct.add(id);
    if (chain.length > longest) longest = chain.length;
  }

  return Object.freeze({
    chains: Object.freeze(chains),
    unaddressedChainNodeCount: distinct.size,
    longestChainLength: longest,
    chainCount: chains.length,
  });
}

function dfs(
  node: string,
  path: readonly string[],
  childrenOfU: ReadonlyMap<string, string[]>,
  out: DodgeChain[],
  cap: number,
): void {
  if (path.length > cap) return; // cycle guard.
  const nextPath = [...path, node];
  const children = (childrenOfU.get(node) ?? [])
    .filter((c) => !nextPath.includes(c))
    .sort(compareStrings);
  if (children.length === 0) {
    if (nextPath.length >= MIN_DODGE_CHAIN_LENGTH) {
      out.push(
        Object.freeze({
          anchorArgumentId: nextPath[0],
          memberArgumentIds: Object.freeze([...nextPath]),
          length: nextPath.length,
        }),
      );
    }
    return;
  }
  for (const child of children) {
    dfs(child, nextPath, childrenOfU, out, cap);
  }
}
