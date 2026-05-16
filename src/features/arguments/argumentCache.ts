import type {
  ArgumentCache,
  ArgumentRow,
  ArgumentTag,
  ArgumentRelations,
} from './types';

/** Sentinel key used in childIdsByParentId for top-level (root) arguments. */
export const ROOT_KEY = 'ROOT';

export const EMPTY_CACHE: ArgumentCache = {
  argumentsById: {},
  childIdsByParentId: {},
  tagsByArgumentId: {},
  flagsByArgumentId: {},
  checksByArgumentId: {},
  detachedArgumentIds: [],
  loadedParentIds: new Set(),
  loadedAtByParentId: {},
};

function detectDetached(
  argumentsById: Record<string, ArgumentRow>,
  existing: string[],
): string[] {
  const detached: string[] = [];
  for (const id of existing) {
    const arg = argumentsById[id];
    if (arg?.parentId && !argumentsById[arg.parentId]) {
      detached.push(id);
    }
  }
  return detached;
}

export function mergeArguments(cache: ArgumentCache, args: ArgumentRow[]): ArgumentCache {
  if (args.length === 0) return cache;

  const newById = { ...cache.argumentsById };
  const newChildIds = { ...cache.childIdsByParentId };

  for (const arg of args) {
    newById[arg.id] = arg;
    const parentKey = arg.parentId ?? ROOT_KEY;
    const existing = newChildIds[parentKey] ?? [];
    if (!existing.includes(arg.id)) {
      newChildIds[parentKey] = [...existing, arg.id];
    }
  }

  return {
    ...cache,
    argumentsById: newById,
    childIdsByParentId: newChildIds,
    detachedArgumentIds: detectDetached(newById, Object.keys(newById)),
  };
}

function dedupeById<T extends { argumentId: string }>(
  existing: T[],
  incoming: T[],
  key: keyof T,
): T[] {
  const seen = new Set(existing.map((x) => x[key] as string));
  return [...existing, ...incoming.filter((x) => !seen.has(x[key] as string))];
}

export function mergeRelations(cache: ArgumentCache, relations: ArgumentRelations): ArgumentCache {
  if (
    relations.tags.length === 0 &&
    relations.flags.length === 0 &&
    relations.checks.length === 0
  ) {
    return cache;
  }

  const newTags = { ...cache.tagsByArgumentId };
  for (const tag of relations.tags) {
    newTags[tag.argumentId] = dedupeById(
      newTags[tag.argumentId] ?? [],
      [tag],
      'tagCode' as keyof ArgumentTag,
    );
  }

  const newFlags = { ...cache.flagsByArgumentId };
  for (const flag of relations.flags) {
    const existing = newFlags[flag.argumentId] ?? [];
    if (!existing.some((f) => f.id === flag.id)) {
      newFlags[flag.argumentId] = [...existing, flag];
    }
  }

  const newChecks = { ...cache.checksByArgumentId };
  for (const check of relations.checks) {
    const existing = newChecks[check.argumentId] ?? [];
    if (!existing.some((c) => c.id === check.id)) {
      newChecks[check.argumentId] = [...existing, check];
    }
  }

  return {
    ...cache,
    tagsByArgumentId: newTags,
    flagsByArgumentId: newFlags,
    checksByArgumentId: newChecks,
  };
}

export function markLoaded(cache: ArgumentCache, parentKey: string): ArgumentCache {
  const newSet = new Set(cache.loadedParentIds);
  newSet.add(parentKey);
  return {
    ...cache,
    loadedParentIds: newSet,
    loadedAtByParentId: {
      ...cache.loadedAtByParentId,
      [parentKey]: new Date().toISOString(),
    },
  };
}

export function isParentLoaded(cache: ArgumentCache, parentKey: string): boolean {
  return cache.loadedParentIds.has(parentKey);
}

export function getKnownChildCount(cache: ArgumentCache, argumentId: string): number | null {
  const children = cache.childIdsByParentId[argumentId];
  if (!cache.loadedParentIds.has(argumentId)) return null;
  return children?.length ?? 0;
}
