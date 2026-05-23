/**
 * QOL-041 — Concession forced-list model (pure TypeScript).
 *
 * The forced-list draft model for the QOL-030 `respond` box's concession
 * section. Each conceded point is its OWN row (not a sub-string of a body),
 * with an ordinal that preserves list order; the receiver's
 * `respond_to_concession` box later mirrors this set row-for-row (design
 * §1, §3 finding F1, §7.1).
 *
 * Doctrine anchors — read before changing anything (QOL-041 §11):
 *
 *   1. **Itemization is STRUCTURAL — no AI parsing** (one-box model
 *      decision D6, QOL-041 §7.1). The user types one point per field;
 *      this module never splits a paragraph and never calls a model.
 *   2. **A concession is a REPAIR, not a defeat** (point-standing-economy
 *      skill rule 1). No label here implies "loss", "winner", or any
 *      verdict on the conceding party.
 *   3. **Forced-list cap = 8 items** (design §15 Q1 default, surfaced).
 *      Beyond 8 the mirrored gradient list becomes unwieldy and a response
 *      conceding 9+ separate points is likely a structure problem better
 *      served by branching.
 *   4. **Conceding is OPTIONAL — only its itemization is forced when
 *      used** (design §9). A `respond` move with zero concession items is
 *      valid (pure refutation); only its STRUCTURE is forced when the
 *      conceding party adds at least one item.
 *   5. **Deterministic + pure.** No `Date.now()`, no AI, no async, no
 *      network, no mutation of any input. Idempotent.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

// ── Limits (design §7.1 / §15 Q1) ─────────────────────────────

/**
 * Maximum number of concession items in one `respond` move's section.
 * Per QOL-041 §15 Q1 default and the design's usability ceiling — beyond
 * 8 items the mirrored gradient list becomes unwieldy. The cap is
 * enforced HERE (client) and re-asserted by the Edge Function (defense
 * in depth).
 */
export const MAX_CONCESSION_ITEMS = 8;

/**
 * Maximum length of one concession item's text, in chars. Mirrors the
 * `item_text` CHECK on `concession_items` (design §5.1) — 600 chars is
 * enough for one specific conceded point without inviting the conceding
 * party to write a paragraph (which would defeat the itemization).
 */
export const MAX_CONCESSION_ITEM_LENGTH = 600;

// ── Draft shape (design §6 — pure-TS model) ───────────────────

/**
 * One concession-item draft row. `clientId` is a stable per-row identity
 * the UI uses as a list key — it has nothing to do with the eventual
 * `concession_items.id` UUID the server mints on insert. `text` is the
 * raw user input; trimming is the consumer's job (the postability
 * check + the migration CHECK both trim).
 */
export interface ConcessionItemDraft {
  /** A stable, client-side row key — UI list-key only. */
  clientId: string;
  /** Raw user input — trimmed by validators, never by the model. */
  text: string;
}

/**
 * The concession-list section's draft state. Immutable; every helper
 * returns a NEW state — no mutation. Shape mirrors what the QOL-030
 * `Draft.listItems` buffer carries when the box is `respond` (the room
 * shell maps it onto the `concession_items[]` payload on Post).
 */
export interface ConcessionListDraft {
  /** Ordered list of item drafts. Index = ordinal. */
  items: ReadonlyArray<ConcessionItemDraft>;
}

/** The empty starting draft. Frozen so callers can share one. */
export const EMPTY_CONCESSION_LIST_DRAFT: ConcessionListDraft = Object.freeze({
  items: Object.freeze<ConcessionItemDraft[]>([]),
});

// ── Pure helpers (add / remove / reorder / update) ────────────

/**
 * Adds an empty item to the end of the list. Returns the input
 * unchanged when the cap is already reached.
 *
 * `nextClientId` is the caller's responsibility — typically a stable
 * suffix-counter ("item-0", "item-1", …) or a UUID. The model never
 * mints ids itself (would couple it to a clock or RNG).
 */
export function addConcessionItem(
  draft: ConcessionListDraft,
  nextClientId: string,
): ConcessionListDraft {
  if (draft.items.length >= MAX_CONCESSION_ITEMS) return draft;
  if (typeof nextClientId !== 'string' || nextClientId.length === 0) return draft;
  return {
    items: Object.freeze([
      ...draft.items,
      Object.freeze<ConcessionItemDraft>({ clientId: nextClientId, text: '' }),
    ]),
  };
}

/**
 * Removes the item with the given `clientId`. Returns the input
 * unchanged when no such item exists (idempotent — repeated removes are
 * safe).
 */
export function removeConcessionItem(
  draft: ConcessionListDraft,
  clientId: string,
): ConcessionListDraft {
  const next = draft.items.filter((it) => it.clientId !== clientId);
  if (next.length === draft.items.length) return draft;
  return { items: Object.freeze(next) };
}

/**
 * Updates the text of one item, identified by `clientId`. Returns the
 * input unchanged when no such item exists OR when the proposed text
 * exceeds `MAX_CONCESSION_ITEM_LENGTH` (the cap is enforced HERE so the
 * UI cannot push the draft past the migration CHECK).
 *
 * Trimming is intentionally NOT done here — the raw text is kept so the
 * UI can render exactly what the user typed. The postability check + the
 * Edge Function trim before validating.
 */
export function updateConcessionItemText(
  draft: ConcessionListDraft,
  clientId: string,
  nextText: string,
): ConcessionListDraft {
  if (typeof nextText !== 'string') return draft;
  if (nextText.length > MAX_CONCESSION_ITEM_LENGTH) return draft;
  let mutated = false;
  const next = draft.items.map((it) => {
    if (it.clientId !== clientId) return it;
    if (it.text === nextText) return it;
    mutated = true;
    return Object.freeze<ConcessionItemDraft>({ clientId: it.clientId, text: nextText });
  });
  if (!mutated) return draft;
  return { items: Object.freeze(next) };
}

/**
 * Moves the item at `fromIndex` to `toIndex` (drag-reorder support).
 * Returns the input unchanged when either index is out of range OR when
 * the move is a no-op. The list ordinal is the index, so a UI reorder is
 * a simple array splice.
 */
export function reorderConcessionItem(
  draft: ConcessionListDraft,
  fromIndex: number,
  toIndex: number,
): ConcessionListDraft {
  const n = draft.items.length;
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return draft;
  if (fromIndex < 0 || fromIndex >= n) return draft;
  if (toIndex < 0 || toIndex >= n) return draft;
  if (fromIndex === toIndex) return draft;
  const copy = draft.items.slice();
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return { items: Object.freeze(copy) };
}

// ── Validation + payload shape ────────────────────────────────

/**
 * One reason a concession-list draft cannot be posted as-is. The reasons
 * are PLAIN-LANGUAGE prose — they appear directly in the box's inline
 * "single visible reason" affordance (QOL-030 doctrine: never a silently
 * disabled Post).
 *
 * - `empty_item`     — at least one item has only whitespace text
 *                      ("This point is empty — fill it in or remove it").
 * - `over_cap`       — somehow more than 8 items (defense against
 *                      out-of-band UI input; the helpers prevent this).
 * - `over_length`    — at least one item exceeds 600 chars (same).
 *
 * `valid` is true when ALL items are non-empty and within length, AND
 * the list size is within the cap. An EMPTY list is VALID (the
 * concession section is optional; pure refutations post fine).
 */
export type ConcessionListIssue = 'empty_item' | 'over_cap' | 'over_length';

export interface ConcessionListValidation {
  valid: boolean;
  /** Distinct issues, ordered. */
  issues: ReadonlyArray<ConcessionListIssue>;
  /**
   * The first plain-language reason to render in the "single visible
   * reason" line. `null` when `valid`.
   */
  firstReason: string | null;
}

const FIRST_REASON_BY_ISSUE: Readonly<Record<ConcessionListIssue, string>> = Object.freeze({
  empty_item: 'This point is empty — fill it in or remove it.',
  over_cap: `You can include up to ${MAX_CONCESSION_ITEMS} conceded points in one response.`,
  over_length: `One conceded point is too long — keep each one under ${MAX_CONCESSION_ITEM_LENGTH} characters.`,
});

/**
 * Validates the draft. EMPTY drafts are VALID — the concession section
 * is optional (a `respond` move with zero conceded points is a pure
 * refutation, design §9). When at least one item is present, every item
 * must be non-whitespace and within the length cap, and the list size
 * must be within the cap.
 *
 * Returns issues in a stable order: `empty_item`, then `over_cap`, then
 * `over_length` — `firstReason` is the highest-priority one to surface.
 *
 * Pure. Total. Returns the same shape for the same input.
 */
export function validateConcessionListDraft(
  draft: ConcessionListDraft,
): ConcessionListValidation {
  const issues: ConcessionListIssue[] = [];
  if (draft.items.length > MAX_CONCESSION_ITEMS) issues.push('over_cap');
  let sawEmpty = false;
  let sawOverLength = false;
  for (const it of draft.items) {
    const trimmed = it.text.trim();
    if (trimmed.length === 0 && !sawEmpty) {
      issues.push('empty_item');
      sawEmpty = true;
    }
    if (it.text.length > MAX_CONCESSION_ITEM_LENGTH && !sawOverLength) {
      issues.push('over_length');
      sawOverLength = true;
    }
  }
  const valid = issues.length === 0;
  const firstReason = valid ? null : FIRST_REASON_BY_ISSUE[issues[0]];
  return {
    valid,
    issues: Object.freeze(issues),
    firstReason,
  };
}

/**
 * The payload row shape the Edge Function expects in
 * `concession_items[]` on a `respond` submission. Pure shape — this model
 * does NOT send the request itself; the room shell builds the `submit-
 * argument` body. `ordinal` is the array index in the posted order.
 */
export interface ConcessionItemPayload {
  ordinal: number;
  item_text: string;
}

/**
 * Builds the `concession_items[]` payload from a validated draft. Skips
 * items whose trimmed text is empty (defensive — the postability check
 * should have caught this; this guard prevents an empty row from being
 * silently inserted on a buggy caller). Ordinals are CONTIGUOUS starting
 * from 0 over the non-empty items. Item text is TRIMMED (the migration
 * CHECK trims; this matches).
 *
 * Pure. Total. Returns the same shape for the same input.
 */
export function buildConcessionItemsPayload(
  draft: ConcessionListDraft,
): ReadonlyArray<ConcessionItemPayload> {
  const out: ConcessionItemPayload[] = [];
  let ordinal = 0;
  for (const it of draft.items) {
    const trimmed = it.text.trim();
    if (trimmed.length === 0) continue;
    out.push({ ordinal, item_text: trimmed });
    ordinal += 1;
  }
  return Object.freeze(out);
}
