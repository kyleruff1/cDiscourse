import { ROOT_KEY } from './argumentCache';
import type { ArgumentCache, ArgumentViewportState, ArgumentRow } from './types';

/** Max depth rendered in the flat tree view without entering focus mode. */
export const MAX_DISPLAY_DEPTH = 6;

/**
 * Computes the ordered flat list of argument IDs to display given the current
 * cache and viewport. Root arguments are always included. Children of a node
 * are included when the node is in expandedArgumentIds (and not in
 * collapsedArgumentIds). Depth is capped at MAX_DISPLAY_DEPTH.
 */
export function computeVisibleArgumentIds(
  cache: ArgumentCache,
  viewport: Pick<ArgumentViewportState, 'expandedArgumentIds' | 'collapsedArgumentIds'>,
): string[] {
  const expanded = new Set(viewport.expandedArgumentIds);
  const collapsed = new Set(viewport.collapsedArgumentIds);
  const visible: string[] = [];

  function visit(parentKey: string, depth: number): void {
    if (depth > MAX_DISPLAY_DEPTH) return;
    const children = cache.childIdsByParentId[parentKey];
    if (!children) return;
    for (const id of children) {
      visible.push(id);
      if (!collapsed.has(id) && expanded.has(id)) {
        visit(id, depth + 1);
      }
    }
  }

  visit(ROOT_KEY, 0);
  return visible;
}

/**
 * Walks up the parentId chain to build the path from the focused argument
 * back to the root. Returns ids in root-first order.
 * Aborts if a parent is missing from the cache (detached subtree).
 */
export function computeFocusedPath(
  cache: ArgumentCache,
  focusedArgumentId: string | null,
): string[] {
  if (!focusedArgumentId) return [];

  const path: string[] = [];
  let current: string | null = focusedArgumentId;
  const visited = new Set<string>();

  while (current) {
    if (visited.has(current)) break;
    visited.add(current);
    const arg: ArgumentRow | undefined = cache.argumentsById[current];
    if (!arg) break;
    path.unshift(current);
    current = arg.parentId;
  }

  return path;
}
