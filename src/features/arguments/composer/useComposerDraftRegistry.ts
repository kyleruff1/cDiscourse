/**
 * UX-001.3 — useComposerDraftRegistry hook.
 *
 * React wrapper around the pure-TS `composerDraftRegistry`. Owns the
 * registry as component state, keyed by `debateId`: when the user
 * navigates to a different debate the registry zeroes (the brief
 * explicitly defers cross-room and cross-app-session persistence).
 *
 * The OneBox host calls:
 *   1. `readDraft(targetKey, boxType)` — restore a parked draft on
 *      mode switch.
 *   2. `writeDraft(targetKey, boxType, draft)` — park the active
 *      draft before re-typing the box.
 *   3. `hasDraft(targetKey, boxType)` — drive any "Resume draft"
 *      affordance.
 *   4. `snapshot` — read the entire registry (tests + parked-buffer
 *      indicator).
 *
 * Doctrine:
 *  - No new dependency.
 *  - No `console.log`.
 *  - Pure model behind the hook is in composerDraftRegistry.ts.
 */
import { useCallback, useRef, useState } from 'react';
import type { BoxType, Draft } from '../oneBox/boxModel';
import { isDraftEmpty } from '../oneBox/boxModel';
import {
  createEmptyComposerDraftRegistry,
  getDraft,
  setDraft,
  type ComposerDraftRegistry,
} from './composerDraftRegistry';

export interface UseComposerDraftRegistryResult {
  /** Read the draft at (targetKey, boxType). Returns EMPTY_DRAFT when none. */
  readDraft: (targetKey: string, boxType: BoxType) => Draft;
  /** Write a draft at (targetKey, boxType). */
  writeDraft: (targetKey: string, boxType: BoxType, draft: Draft) => void;
  /** True iff a non-empty draft exists at (targetKey, boxType). */
  hasDraft: (targetKey: string, boxType: BoxType) => boolean;
  /**
   * Snapshot of the full registry. Useful for tests + a future
   * "parked drafts" indicator. Frozen — safe to share across renders.
   */
  snapshot: ComposerDraftRegistry;
}

export function useComposerDraftRegistry(
  debateId: string,
): UseComposerDraftRegistryResult {
  const [registry, setRegistry] = useState<ComposerDraftRegistry>(
    createEmptyComposerDraftRegistry,
  );

  // When debateId changes, zero the registry — drafts are intra-room
  // per the brief's "do NOT need to persist across … page navigations"
  // clause. The guard runs during render so the next read already sees
  // a fresh registry; the `setRegistry` call schedules the state change.
  const lastDebateIdRef = useRef(debateId);
  if (lastDebateIdRef.current !== debateId) {
    lastDebateIdRef.current = debateId;
    // Reset is safe to call during render — React batches the state
    // update with the current render's effects.
    setRegistry(createEmptyComposerDraftRegistry());
  }

  const readDraft = useCallback(
    (targetKey: string, boxType: BoxType) => getDraft(registry, targetKey, boxType),
    [registry],
  );

  const writeDraft = useCallback(
    (targetKey: string, boxType: BoxType, draft: Draft) => {
      setRegistry((r) => setDraft(r, targetKey, boxType, draft));
    },
    [],
  );

  const hasDraft = useCallback(
    (targetKey: string, boxType: BoxType) =>
      !isDraftEmpty(getDraft(registry, targetKey, boxType)),
    [registry],
  );

  return {
    readDraft,
    writeDraft,
    hasDraft,
    snapshot: registry,
  };
}
