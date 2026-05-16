import { mergeArguments, mergeRelations, markLoaded, ROOT_KEY } from './argumentCache';
import { computeVisibleArgumentIds, computeFocusedPath } from './buildArgumentTree';
import type {
  ArgumentCache,
  ArgumentViewportState,
  ArgumentRow,
  ArgumentRelations,
} from './types';
import type { DebateViewport } from '../session/types';

// ── Actions ───────────────────────────────────────────────────

export type ViewportAction =
  | { type: 'ROOTS_LOADED'; args: ArgumentRow[]; relations: ArgumentRelations }
  | { type: 'CHILDREN_LOADED'; parentId: string; args: ArgumentRow[]; relations: ArgumentRelations }
  | { type: 'FOCUS_LOADED'; focusedId: string; pathArgs: ArgumentRow[]; childArgs: ArgumentRow[]; relations: ArgumentRelations }
  | { type: 'EXPAND'; argumentId: string }
  | { type: 'COLLAPSE'; argumentId: string }
  | { type: 'FOCUS'; argumentId: string }
  | { type: 'UNFOCUS' }
  | { type: 'SELECT_PARENT'; argumentId: string }
  | { type: 'CLEAR_PARENT' }
  | { type: 'REFRESH_COMPLETE'; parentKey: string; args: ArgumentRow[]; relations: ArgumentRelations };

// ── Local state ───────────────────────────────────────────────

export interface ViewportLocalState {
  cache: ArgumentCache;
  viewport: ArgumentViewportState;
}

// ── Helpers ───────────────────────────────────────────────────

function recompute(
  cache: ArgumentCache,
  viewport: ArgumentViewportState,
): ArgumentViewportState {
  return {
    ...viewport,
    visibleArgumentIds: computeVisibleArgumentIds(cache, viewport),
    focusedPathIds: computeFocusedPath(cache, viewport.focusedArgumentId),
  };
}

function withoutId(ids: string[], id: string): string[] {
  return ids.filter((x) => x !== id);
}

// ── Reducer ───────────────────────────────────────────────────

export function viewportReducer(
  state: ViewportLocalState,
  action: ViewportAction,
): ViewportLocalState {
  switch (action.type) {
    case 'ROOTS_LOADED': {
      let cache = mergeArguments(state.cache, action.args);
      cache = mergeRelations(cache, action.relations);
      cache = markLoaded(cache, ROOT_KEY);
      const viewport = recompute(cache, state.viewport);
      return { cache, viewport };
    }

    case 'CHILDREN_LOADED': {
      let cache = mergeArguments(state.cache, action.args);
      cache = mergeRelations(cache, action.relations);
      cache = markLoaded(cache, action.parentId);
      const viewport = recompute(cache, state.viewport);
      return { cache, viewport };
    }

    case 'FOCUS_LOADED': {
      let cache = mergeArguments(state.cache, [
        ...action.pathArgs,
        ...action.childArgs,
      ]);
      cache = mergeRelations(cache, action.relations);
      cache = markLoaded(cache, action.focusedId);
      const viewport = recompute(cache, {
        ...state.viewport,
        focusedArgumentId: action.focusedId,
      });
      return { cache, viewport };
    }

    case 'EXPAND': {
      const expanded = state.viewport.expandedArgumentIds.includes(action.argumentId)
        ? state.viewport.expandedArgumentIds
        : [...state.viewport.expandedArgumentIds, action.argumentId];
      const collapsed = withoutId(state.viewport.collapsedArgumentIds, action.argumentId);
      const viewport = recompute(state.cache, { ...state.viewport, expandedArgumentIds: expanded, collapsedArgumentIds: collapsed });
      return { ...state, viewport };
    }

    case 'COLLAPSE': {
      const collapsed = state.viewport.collapsedArgumentIds.includes(action.argumentId)
        ? state.viewport.collapsedArgumentIds
        : [...state.viewport.collapsedArgumentIds, action.argumentId];
      const expanded = withoutId(state.viewport.expandedArgumentIds, action.argumentId);
      const viewport = recompute(state.cache, { ...state.viewport, collapsedArgumentIds: collapsed, expandedArgumentIds: expanded });
      return { ...state, viewport };
    }

    case 'FOCUS': {
      const viewport = recompute(state.cache, {
        ...state.viewport,
        focusedArgumentId: action.argumentId,
      });
      return { ...state, viewport };
    }

    case 'UNFOCUS': {
      const viewport = recompute(state.cache, {
        ...state.viewport,
        focusedArgumentId: null,
      });
      return { ...state, viewport };
    }

    case 'SELECT_PARENT': {
      return { ...state, viewport: { ...state.viewport, selectedParentId: action.argumentId } };
    }

    case 'CLEAR_PARENT': {
      return { ...state, viewport: { ...state.viewport, selectedParentId: null } };
    }

    case 'REFRESH_COMPLETE': {
      let cache = mergeArguments(state.cache, action.args);
      cache = mergeRelations(cache, action.relations);
      cache = markLoaded(cache, action.parentKey);
      const viewport = recompute(cache, state.viewport);
      return { cache, viewport };
    }

    default:
      return state;
  }
}

// ── Initial viewport builder ──────────────────────────────────

export function buildInitialViewport(
  debateId: string,
  sessionViewport: DebateViewport | null,
  pageSize: number,
): ArgumentViewportState {
  if (sessionViewport?.debateId === debateId) {
    return {
      debateId,
      focusedArgumentId: sessionViewport.focusedArgumentId,
      selectedParentId: sessionViewport.selectedParentId,
      rootCursor: sessionViewport.rootCursor,
      pageSize,
      expandedArgumentIds: sessionViewport.expandedArgumentIds,
      collapsedArgumentIds: sessionViewport.collapsedArgumentIds,
      visibleArgumentIds: [],
      focusedPathIds: [],
    };
  }
  return {
    debateId,
    focusedArgumentId: null,
    selectedParentId: null,
    rootCursor: null,
    pageSize,
    expandedArgumentIds: [],
    collapsedArgumentIds: [],
    visibleArgumentIds: [],
    focusedPathIds: [],
  };
}

/** Maps ArgumentViewportState back to the DebateViewport shape used in AppSession. */
export function toSessionViewport(vp: ArgumentViewportState, lastLoadedAt: string | null): DebateViewport {
  return {
    debateId: vp.debateId,
    focusedArgumentId: vp.focusedArgumentId,
    selectedParentId: vp.selectedParentId,
    rootCursor: vp.rootCursor,
    expandedArgumentIds: vp.expandedArgumentIds,
    collapsedArgumentIds: vp.collapsedArgumentIds,
    lastLoadedAt,
    lastSeenArgumentId: vp.focusedArgumentId,
  };
}
