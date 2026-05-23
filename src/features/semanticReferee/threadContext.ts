/**
 * MCP-MOD-008 — Pure-TS helpers for the full-thread classifier context.
 *
 * Two pure helpers, both consumed by `useSemanticReferee.onMovePosted`:
 *
 *   1. `buildAuthorAliasMap` — turns a chronological prior-moves list into a
 *      stable, non-identifying alias map (`A`, `B`, `C`, ..., `Z`, `AA`, ...).
 *      Aliases are derived from the chronological order of distinct authors.
 *      No PII crosses through this function.
 *
 *   2. `assemblePriorMovesPayload` — turns raw prior-moves + the alias map +
 *      the per-batch token budget into the redacted, budget-bounded
 *      `PriorMoveContext[]` payload. Drops the OLDEST entries first when over
 *      budget; returns `[]` when even the move + parent alone overflow
 *      (graceful degradation to the pre-MCP-MOD-008 payload shape).
 *
 * The helpers live HERE (in `src/features/semanticReferee/`) and not in
 * `useSemanticReferee.ts` so the budget-handling test can exercise them
 * without dragging the React / Supabase / `@react-native-async-storage` chain
 * into the test runner. The hook re-exports them for `ArgumentTreeScreen.tsx`
 * convenience.
 *
 * This module is PURE TYPESCRIPT — no network, no React, no Supabase, no
 * `Deno`, no env, no `async`. Deterministic: the same input always yields
 * the same output.
 *
 * Doctrine (cdiscourse-doctrine §1, §6):
 *   - No user id, no display name, no email crosses the boundary. The alias
 *     map produces SHORT capital-letter aliases derived from chronological
 *     position only.
 *   - The function never produces a verdict, a truth value, or a person
 *     label — it only counts and labels positions.
 */
import { redactBody } from './clientRedaction';
import { isWithinBudget } from './tokenBudget';

/** One prior-move entry as the caller passes it to the helpers. */
export interface ThreadContextPriorMove {
  /** The prior move's id — used by the move-position helper and the alias map. */
  id: string;
  /** The prior move's author id — used to derive a stable chronological alias. */
  authorId: string;
  /** The prior move's body — the helper runs `redactBody` over it before output. */
  body: string;
}

/** One redacted prior-move entry as the helper hands it to the boundary. */
export interface RedactedPriorMove {
  /** Stable, non-identifying alias (A, B, C, ..., Z, AA, ...). */
  authorAlias: string;
  /** The prior move's body, redacted by the client first pass. */
  bodyRedacted: string;
}

/**
 * Build the chronological alias map for a room's prior moves.
 *
 * Aliases are STABLE and NON-IDENTIFYING. The N-th distinct author in
 * chronological order maps to the N-th alias from the sequence
 * `A, B, C, ..., Z, AA, AB, AC, ...` (the wrap-around handles the very rare
 * 26+ distinct-author case; out of scope to pre-optimize).
 *
 * The function NEVER returns a user id, a display name, a handle, or any
 * other PII. The map is derived per call and is local to the classify call;
 * it is not persisted.
 *
 * `currentAuthorId` (optional) is folded into the map at the chronological
 * position the author first appears in the combined sequence. This guarantees
 * the just-posted move's author also has an alias if the model needs to
 * refer to them via a downstream surface.
 */
export function buildAuthorAliasMap(
  priorMoves: ReadonlyArray<{ authorId: string }>,
  currentAuthorId: string | null | undefined,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  let nextIndex = 0;
  for (const move of priorMoves) {
    if (!map.has(move.authorId)) {
      map.set(move.authorId, aliasForIndex(nextIndex));
      nextIndex += 1;
    }
  }
  if (
    typeof currentAuthorId === 'string' &&
    currentAuthorId.length > 0 &&
    !map.has(currentAuthorId)
  ) {
    map.set(currentAuthorId, aliasForIndex(nextIndex));
  }
  return map;
}

/**
 * Map a 0-based index to a stable alias. `0 → 'A'`, `25 → 'Z'`, `26 → 'AA'`,
 * `27 → 'AB'`, ..., `51 → 'AZ'`, `52 → 'BA'`, etc. Pure spreadsheet-column
 * arithmetic. Total: handles the unbounded-index case without throwing.
 */
export function aliasForIndex(index: number): string {
  let n = index;
  let alias = '';
  do {
    alias = String.fromCharCode(65 + (n % 26)) + alias;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return alias;
}

/**
 * Turn raw prior-moves + the alias map into the redacted, budget-bounded
 * payload sent to the boundary. The function:
 *
 *   1. Redacts every prior-move body via the client redactor.
 *   2. Drops moves whose body is empty after redaction.
 *   3. Drops moves whose author is not in the alias map (defensive).
 *   4. Enforces the per-call token budget by dropping the OLDEST entries
 *      first until the payload fits — or returns an empty array if even the
 *      move + parent alone overflow (graceful degradation to the
 *      pre-MCP-MOD-008 payload shape; the hook still issues the call).
 *
 * Returns the `RedactedPriorMove[]` ready to attach to `ClassifyMoveRequest`
 * as `priorMovesRedacted`.
 */
export function assemblePriorMovesPayload(args: {
  priorMoves: ReadonlyArray<ThreadContextPriorMove>;
  authorAliases: ReadonlyMap<string, string>;
  moveBodyRedacted: string;
  parentBodyRedacted: string | undefined;
  requestedClassifiers: readonly string[];
}): ReadonlyArray<RedactedPriorMove> {
  const redacted: RedactedPriorMove[] = [];
  for (const move of args.priorMoves) {
    const bodyRedacted = redactBody(move.body);
    if (bodyRedacted.length === 0) continue;
    const alias = args.authorAliases.get(move.authorId);
    if (!alias) continue;
    redacted.push({ authorAlias: alias, bodyRedacted });
  }
  // Drop oldest first until the payload fits inside the budget. If even an
  // empty prior-moves array overflows the budget, return [] — the caller
  // proceeds with the pre-MCP-MOD-008 payload shape (graceful degradation;
  // the call is NOT skipped).
  while (redacted.length > 0) {
    const budget = isWithinBudget({
      moveBodyRedacted: args.moveBodyRedacted,
      parentBodyRedacted: args.parentBodyRedacted,
      requestedClassifiers: args.requestedClassifiers,
      priorMoveBodies: redacted.map((entry) => entry.bodyRedacted),
    });
    if (budget.ok) break;
    redacted.shift(); // drop oldest (chronologically first)
  }
  return redacted;
}
