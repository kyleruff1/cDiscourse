import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSessionSnapshot, ComposerDraftSession } from './types';
import { sessionSnapshotKey, anonymousSessionKey, draftKey, draftIndexKey } from './sessionKeys';
import {
  loadFreshPendingInviteIntent,
  type PendingInviteIntent,
} from '../invites/pendingInviteIntent';

// ── Snapshot ───────────────────────────────────────────────────

export async function loadSessionSnapshot(
  userId: string | null,
): Promise<AppSessionSnapshot | null> {
  try {
    const key = userId ? sessionSnapshotKey(userId) : anonymousSessionKey();
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    // QOL-038 — defensively normalise the pendingInviteIntent slot. An
    // older persisted snapshot (pre-QOL-038) has no field; treat missing
    // as null. A present field is parsed and dropped if stale (24h
    // window from pendingInviteIntent.ts).
    const obj = parsed as AppSessionSnapshot & { pendingInviteIntent?: unknown };
    const nowIso = new Date().toISOString();
    const freshIntent: PendingInviteIntent | null =
      obj.pendingInviteIntent !== undefined
        ? loadFreshPendingInviteIntent(obj.pendingInviteIntent, nowIso)
        : null;
    return { ...obj, pendingInviteIntent: freshIntent };
  } catch {
    return null;
  }
}

export async function saveSessionSnapshot(
  userId: string | null,
  snapshot: AppSessionSnapshot,
): Promise<void> {
  try {
    const key = userId ? sessionSnapshotKey(userId) : anonymousSessionKey();
    await AsyncStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // Storage failure is non-fatal — session restarts fresh on next open.
  }
}

export async function clearSessionSnapshot(userId: string | null): Promise<void> {
  try {
    const key = userId ? sessionSnapshotKey(userId) : anonymousSessionKey();
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ── Drafts ─────────────────────────────────────────────────────

export async function loadDraft(
  userId: string,
  draftId: string,
): Promise<ComposerDraftSession | null> {
  try {
    const raw = await AsyncStorage.getItem(draftKey(userId, draftId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as ComposerDraftSession;
  } catch {
    return null;
  }
}

export async function saveDraft(userId: string, draft: ComposerDraftSession): Promise<void> {
  try {
    await AsyncStorage.setItem(draftKey(userId, draft.draftId), JSON.stringify(draft));
    const idxKey = draftIndexKey(userId, draft.debateId);
    const existingRaw = await AsyncStorage.getItem(idxKey);
    const ids: string[] = existingRaw
      ? (JSON.parse(existingRaw) as unknown as string[]).filter(
          (id): id is string => typeof id === 'string',
        )
      : [];
    if (!ids.includes(draft.draftId)) {
      await AsyncStorage.setItem(idxKey, JSON.stringify([...ids, draft.draftId]));
    }
  } catch {
    // Storage failure is non-fatal.
  }
}

export async function deleteDraft(
  userId: string,
  draftId: string,
  debateId: string,
): Promise<void> {
  try {
    await AsyncStorage.removeItem(draftKey(userId, draftId));
    const idxKey = draftIndexKey(userId, debateId);
    const existingRaw = await AsyncStorage.getItem(idxKey);
    if (existingRaw) {
      const ids = (JSON.parse(existingRaw) as unknown as string[]).filter(
        (id) => id !== draftId,
      );
      await AsyncStorage.setItem(idxKey, JSON.stringify(ids));
    }
  } catch {
    // ignore
  }
}

/** Returns draftId strings for all drafts saved under a debate. */
export async function listDraftKeysForDebate(
  userId: string,
  debateId: string,
): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(draftIndexKey(userId, debateId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}
