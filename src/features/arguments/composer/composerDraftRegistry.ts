/**
 * UX-001.3 — Composer draft registry (pure TypeScript).
 *
 * Per-target × per-mode draft persistence for the OneBox composer.
 *
 * The brief's mode-switching contract requires: drafts are per-mode AND
 * per-target. Switching Reply → Add Evidence → Reply preserves the Reply
 * draft. The pre-UX-001.3 `boxModel.DraftBuffers` keys per-`BoxType` only
 * (one buffer per type, room-wide); UX-001.3 extends that keying to
 * `(targetKey, BoxType)` so the Reply draft for node A is separate from
 * the Reply draft for node B.
 *
 * Lifecycle:
 *  - Buffers persist across mode switches within the OneBox session.
 *  - The registry is reset when the user navigates to a different debate
 *    (the consuming hook owns that reset).
 *  - Cross-app-session persistence is explicitly deferred (brief §"Mode
 *    switching persistence rules": "Drafts do NOT need to persist across
 *    app sessions or page navigations").
 *
 * Doctrine:
 *  - Pure TypeScript. No React. No Supabase. No network. No `Date.now()`.
 *  - No verdict tokens in any field; every label is plain English.
 *  - Idempotent. Object.freeze every returned snapshot.
 *
 * Pure TS. No new dependency.
 */

import type { BoxType, Draft, DraftBuffers } from '../oneBox/boxModel';
import {
  ALL_BOX_TYPES,
  EMPTY_DRAFT,
  createEmptyDraftBuffers,
  isDraftEmpty,
} from '../oneBox/boxModel';

/**
 * The registry: `{ [targetKey]: DraftBuffers }`.
 * Buffers materialize lazily — a missing `targetKey` reads as `EMPTY_DRAFT`.
 */
export type ComposerDraftRegistry = Readonly<Record<string, DraftBuffers>>;

/**
 * Sentinel target key used for the root-claim context (no parent argument).
 * All other targets key on `argumentRow.id`.
 *
 * Underscore-bracketed so it cannot collide with any real argument id
 * (Supabase argument ids are uuids — no underscores).
 */
export const ROOT_TARGET_KEY = '__root__';

/**
 * Derive a registry target key from a parent argument id. `null` means
 * root-claim context.
 */
export function deriveTargetKey(parentId: string | null): string {
  return parentId ?? ROOT_TARGET_KEY;
}

/**
 * Build a fresh empty registry. Returns a frozen object; safe to share
 * across renders.
 */
export function createEmptyComposerDraftRegistry(): ComposerDraftRegistry {
  return Object.freeze({} as Record<string, DraftBuffers>);
}

/**
 * Read the draft at `(targetKey, boxType)`. Returns `EMPTY_DRAFT` when
 * no buffer exists for that key. Pure.
 */
export function getDraft(
  registry: ComposerDraftRegistry,
  targetKey: string,
  boxType: BoxType,
): Draft {
  const buffers = registry[targetKey];
  if (!buffers) return EMPTY_DRAFT;
  return buffers[boxType] ?? EMPTY_DRAFT;
}

/**
 * Write a draft at `(targetKey, boxType)`. Returns a NEW frozen registry;
 * never mutates the input.
 */
export function setDraft(
  registry: ComposerDraftRegistry,
  targetKey: string,
  boxType: BoxType,
  draft: Draft,
): ComposerDraftRegistry {
  const existing = registry[targetKey] ?? createEmptyDraftBuffers();
  // Spread + cast: spreading a Readonly<Record> produces a plain
  // Record we can mutate locally before freezing.
  const next: Record<BoxType, Draft> = { ...existing };
  next[boxType] = draft;
  const nextRegistry: Record<string, DraftBuffers> = { ...registry };
  nextRegistry[targetKey] = Object.freeze(next);
  return Object.freeze(nextRegistry);
}

/**
 * Clear the draft at `(targetKey, boxType)`. Sets the buffer to
 * `EMPTY_DRAFT`. If no buffer exists at `targetKey`, returns the input
 * unchanged.
 */
export function clearDraft(
  registry: ComposerDraftRegistry,
  targetKey: string,
  boxType: BoxType,
): ComposerDraftRegistry {
  if (!registry[targetKey]) return registry;
  return setDraft(registry, targetKey, boxType, EMPTY_DRAFT);
}

/**
 * Returns true iff every buffer in the registry is empty (no body, no
 * list items, no field values across any target × type pair).
 */
export function isRegistryEmpty(registry: ComposerDraftRegistry): boolean {
  for (const key of Object.keys(registry)) {
    const buffers = registry[key];
    if (!buffers) continue;
    for (const t of ALL_BOX_TYPES) {
      const draft = buffers[t] ?? EMPTY_DRAFT;
      if (!isDraftEmpty(draft)) return false;
    }
  }
  return true;
}

/**
 * Returns true iff a non-empty draft exists at `(targetKey, boxType)`.
 * Useful for "Resume your Reply" affordances.
 */
export function hasDraftAt(
  registry: ComposerDraftRegistry,
  targetKey: string,
  boxType: BoxType,
): boolean {
  return !isDraftEmpty(getDraft(registry, targetKey, boxType));
}

/**
 * Enumerate every `(targetKey, boxType)` pair that holds a non-empty
 * draft. Output order is stable: targetKey insertion order, then
 * `ALL_BOX_TYPES` order. Pure.
 */
export function listNonEmptyDrafts(
  registry: ComposerDraftRegistry,
): ReadonlyArray<{ targetKey: string; boxType: BoxType }> {
  const out: { targetKey: string; boxType: BoxType }[] = [];
  for (const key of Object.keys(registry)) {
    const buffers = registry[key];
    if (!buffers) continue;
    for (const t of ALL_BOX_TYPES) {
      const draft = buffers[t] ?? EMPTY_DRAFT;
      if (!isDraftEmpty(draft)) {
        out.push({ targetKey: key, boxType: t });
      }
    }
  }
  return Object.freeze(out);
}

/**
 * Drop every buffer attached to a given target key. Returns a NEW frozen
 * registry. Useful when a target is removed (e.g., the parent argument
 * was soft-deleted) and its drafts should not linger.
 */
export function dropTarget(
  registry: ComposerDraftRegistry,
  targetKey: string,
): ComposerDraftRegistry {
  if (!registry[targetKey]) return registry;
  const next: Record<string, DraftBuffers> = { ...registry };
  delete next[targetKey];
  return Object.freeze(next);
}
