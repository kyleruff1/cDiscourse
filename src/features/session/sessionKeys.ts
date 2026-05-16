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
