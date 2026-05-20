import { getAllowedReplies } from '../../domain/constitution/allowedTransitions';
import { computeVisibleArgumentIds } from './buildArgumentTree';
import type { ArgumentCache, ArgumentRow, ArgumentViewportState, ArgumentRelations } from './types';
import type { ArgumentType, ConstitutionRule } from '../../domain/constitution/types';
import type { ViewportAction } from './argumentViewport';

/** Action creator: select an argument as the reply target for the composer. */
export function selectReplyTarget(argumentId: string): ViewportAction {
  return { type: 'SELECT_PARENT', argumentId };
}

/** Action creator: clear the reply target (composer returns to root-level post). */
export function clearReplyTarget(): ViewportAction {
  return { type: 'CLEAR_PARENT' };
}

/**
 * Returns the allowed reply types for the composer given the current selectedParentId.
 * Returns root-level types when no parent is selected.
 * Requires the active constitution rules to compute allowed transitions.
 */
export function getAllowedReplyTypesForParent(
  cache: ArgumentCache,
  viewport: ArgumentViewportState,
  rules: ConstitutionRule[],
  rootAllowedTypes: ArgumentType[],
): ArgumentType[] {
  const { selectedParentId } = viewport;
  if (!selectedParentId) return rootAllowedTypes;
  const parent = cache.argumentsById[selectedParentId];
  if (!parent) return [];
  return getAllowedReplies(parent.argumentType as ArgumentType, rules);
}

/** Returns currently visible argument IDs — thin wrapper for components that only have cache+viewport. */
export function getVisibleArgumentIds(
  cache: ArgumentCache,
  viewport: ArgumentViewportState,
): string[] {
  return computeVisibleArgumentIds(cache, viewport);
}

/**
 * Returns tags, flags, and checks for a single argument, grouped for display.
 * Returns empty relations if the argument has no recorded relations.
 */
export function getArgumentRelationsForDisplay(
  cache: ArgumentCache,
  argumentId: string,
): ArgumentRelations {
  return {
    tags: cache.tagsByArgumentId[argumentId] ?? [],
    flags: cache.flagsByArgumentId[argumentId] ?? [],
    checks: cache.checksByArgumentId[argumentId] ?? [],
    // META-1A — the ArgumentCache (legacy viewport) does not track
    // persisted point_tags; the room-shell loader does. Empty here.
    pointTags: [],
  };
}

/**
 * Returns the parent argument the composer should reply to, or null if none selected.
 * Returns null when selectedParentId points to an argument not yet in the cache.
 */
export function getParentArgumentForComposer(
  cache: ArgumentCache,
  viewport: ArgumentViewportState,
): ArgumentRow | null {
  const { selectedParentId } = viewport;
  if (!selectedParentId) return null;
  return cache.argumentsById[selectedParentId] ?? null;
}
