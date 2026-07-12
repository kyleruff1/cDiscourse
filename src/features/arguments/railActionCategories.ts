/**
 * Rail action category model — extracted from `ArgumentSideActionRail.tsx`
 * to break the require cycle between that file and
 * `ObserverActionDockLayout.ts`.
 *
 * Both files now depend on this module; neither depends on the other for
 * these symbols. Pure TS, no React, no Supabase, no network.
 *
 * The cycle was diagnosed via the web bundle's runtime TDZ error:
 *   "Cannot access 'RAIL_ACTION_CATEGORIES' before initialization"
 * when ObserverActionDockLayout.ts read the constant during its own
 * module-init while ArgumentSideActionRail.tsx was mid-init waiting on
 * ObserverActionDockLayout.ts. Hermes / JSC on mobile tolerated the cycle;
 * the web bundler did not.
 *
 * Stage 6.4 / SC-001 / SC-005 / UX-001.4 contracts are preserved verbatim
 * — symbol names, shapes, and the 7-category ordering are unchanged. The
 * tests under `__tests__/railActionGrouping.test.ts`,
 * `sideActionDockCategoryGrouping.test.ts`, `sideActionDockMatrix.test.ts`,
 * `sideActionDockNoVerdictCopy.test.ts`,
 * `duplicateRailRemovalDisposition.test.ts`, and
 * `seamlessConversationEntry.test.ts` continue to import from
 * `./ArgumentSideActionRail` via re-export and remain passing.
 */

export type RailViewerRole = 'observer' | 'participant';
export type RailBubbleActor = 'self' | 'other' | 'bot' | 'admin' | 'unknown';

// UX-001.4 — RailActionCode union. The migrate-to-Act entries
// (ask_source, ask_quote, split_branch, flag, qualifiers,
// request_deletion, open_timeline) are no longer rendered by the rail;
// the entries were dispositioned per UX-001.4 design §1 Table B. The
// codes remain in the union for back-compat with the railActionToBubbleControl
// mapper (kept so existing callers / tests that still reference the
// codes do not break); the rail's OBSERVER_ACTIONS / PARTICIPANT_OTHER_ACTIONS
// / SELF_ACTIONS arrays no longer include them. Act is the canonical
// surface for migrated entries.
export type RailActionCode =
  // Observer set — preserve-as-shortcut (watch / join) + retain (share)
  | 'watch'
  | 'join_aff'
  | 'join_neg'
  // UX-001.4: ask_source migrated to Act (still in union for
  // railActionToBubbleControl back-compat).
  | 'ask_source'
  // UX-001.4: open_timeline migrated to Go's view_timeline entry.
  | 'open_timeline'
  | 'share'
  // Participant set (other bubble) — preserve-as-shortcut for reply / disagree
  | 'reply'
  | 'disagree'
  // UX-001.4: ask_quote migrated to Act (still in union for back-compat).
  | 'ask_quote'
  // UX-001.4: split_branch migrated to Act (branch_tangent entry).
  | 'split_branch'
  // UX-001.4: flag migrated to Act (direct group).
  | 'flag'
  // UX-001.4: qualifiers migrated to Act (view_qualifiers direct entry).
  | 'qualifiers'
  // UX-001.4: request_deletion migrated to Act (direct group).
  | 'request_deletion';

/**
 * SC-001 — Grouping taxonomy. The issue body specifies seven groups:
 * Watch/Observe · Join side · Reply · Evidence · Branch · Review/flag ·
 * Share. Every rail action carries one of these so a future UI pass
 * can render the expanded rail as ordered category sections.
 */
export type RailActionCategory =
  | 'watch_observe'
  | 'join_side'
  | 'reply'
  | 'evidence'
  | 'branch'
  | 'review_flag'
  | 'share';

export const RAIL_ACTION_CATEGORIES: readonly RailActionCategory[] = [
  'watch_observe',
  'join_side',
  'reply',
  'evidence',
  'branch',
  'review_flag',
  'share',
] as const;

export const RAIL_ACTION_CATEGORY_LABEL: Record<RailActionCategory, string> = {
  watch_observe: 'Watch / Observe',
  join_side: 'Join side',
  reply: 'Reply',
  evidence: 'Evidence',
  branch: 'Branch',
  review_flag: 'Review / Flag',
  share: 'Share',
};

export interface RailAction {
  code: RailActionCode;
  label: string;
  helper: string;
  category: RailActionCategory;
  tone?: 'primary' | 'warning' | 'critical' | 'neutral';
}

export type RailActionWithCategory = RailAction;

export interface RailActionGroup {
  category: RailActionCategory;
  label: string;
  actions: RailAction[];
}

/**
 * UX-PR-G (#920) P1-12 — rail codes the ROOM routes LOCALLY (no bubble-control
 * equivalent). `ArgumentRoom.handleRailAction` dispatches each of these itself
 * (join → onJoinSide, open_timeline → setMode, watch → documented no-op). Every
 * OTHER rendered rail code MUST resolve to a non-null `railActionToBubbleControl`.
 * The `railHandlerPresenceGuard` test asserts exactly that: no rail action can
 * ship without a handler. `share` was removed from the observer set (it was a
 * guaranteed no-op — rooms have no URLs), so it must NOT appear here.
 */
export const RAIL_LOCALLY_ROUTED_CODES: readonly RailActionCode[] = Object.freeze([
  'join_aff',
  'join_neg',
  'open_timeline',
  'watch',
]);

/**
 * Bucket a flat rail action list into ordered category groups. Skips
 * empty groups so the UI never renders an empty section.
 */
export function groupRailActionsByCategory(actions: readonly RailAction[]): RailActionGroup[] {
  const out: RailActionGroup[] = [];
  for (const cat of RAIL_ACTION_CATEGORIES) {
    const matched = actions.filter((a) => a.category === cat);
    if (matched.length > 0) {
      out.push({ category: cat, label: RAIL_ACTION_CATEGORY_LABEL[cat], actions: matched });
    }
  }
  return out;
}
