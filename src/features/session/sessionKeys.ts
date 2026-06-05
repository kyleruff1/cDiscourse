const PREFIX = 'cdiscourse';

export function sessionSnapshotKey(userId: string): string {
  return `${PREFIX}:session:${userId}`;
}

export function anonymousSessionKey(): string {
  return `${PREFIX}:session:anon`;
}

/** Full AsyncStorage key for a draft. */
export function draftKey(userId: string, draftId: string): string {
  return `${PREFIX}:draft:${userId}:${draftId}`;
}

/** Index key listing draftId strings for a user+debate pair. */
export function draftIndexKey(userId: string, debateId: string): string {
  return `${PREFIX}:draft-index:${userId}:${debateId}`;
}

/**
 * PR-001 — AsyncStorage key for the per-user "My preferences" blob.
 * `userId` is the signed-in user id, or the literal `anon` when signed
 * out (the popout is only reachable while signed in; the anon key is a
 * defensive fallback).
 */
export function userPreferencesKey(userId: string): string {
  return `${PREFIX}:preferences:${userId}`;
}

/**
 * PR-002 — AsyncStorage key for the per-user profile-tag blob. Mirrors
 * `userPreferencesKey`: `userId` is the signed-in user id, or the
 * literal `anon` when signed out (the popout is only reachable while
 * signed in; the anon key is a defensive fallback). A SEPARATE blob from
 * the preferences one — see the PR-002 design's §Reuse-vs-new decision.
 */
export function profileTagsKey(userId: string): string {
  return `${PREFIX}:profile-tags:${userId}`;
}

/**
 * ADMIN-ARGUMENTS-003 — AsyncStorage key for the device-local Admin
 * Arguments view-preference blob (density / sort / runTag filter /
 * participant kind / limit). `scope` is `admin` by default — these are
 * device-scoped table-view prefs, not per-user account data, so they are
 * keyed by a fixed admin scope rather than a user id. A SEPARATE blob from
 * the PR-001 preferences one. Pure-client; no server write.
 */
export function adminArgumentsPrefsKey(scope = 'admin'): string {
  return `${PREFIX}:admin-arguments-prefs:${scope}`;
}
