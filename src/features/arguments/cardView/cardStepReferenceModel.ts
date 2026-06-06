/**
 * CARD-VIEW-DATA-001 (Slice 1) — Step-reference header model.
 *
 * Pure-TS builder for the active card's "step reference" line — a single
 * plain-language sentence that orients the reader inside the thread:
 *
 *   - Reply move:   "Acting on #4 (rebuttal) · Replied to #3 (claim)"
 *   - Root move:    "Opening claim (#1)"
 *   - Unresolvable parent (soft-deleted / RLS-hidden / not in the loaded
 *     slice): "Acting on #4 (rebuttal)" — no dangling tappable token.
 *
 * The parent ordinal token (e.g. "#3") is the ONLY tappable span in the
 * line; tapping it re-activates the parent message via the existing
 * `onActivate` path (the surface threads `parentMessageId` into the
 * `onActivateAncestor` callback). The rest of the line is display-only
 * text.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §1 — no verdict / truth language; the line
 *     names POSITION + TYPE only ("rebuttal" / "claim"), never standing.
 *   - cdiscourse-doctrine §9 — kind labels are plain-language (the caller
 *     supplies `kindLabelOf`, which is already the plain `kindLabel` from
 *     the timeline view-model). No raw codes.
 *
 * Pure TS. No React. No Supabase. No network. No AI. No new dependency.
 */

export interface CardStepReferenceLine {
  /** Visible prose, e.g. "Acting on #4 (rebuttal) · Replied to #3 (claim)".
   *  Root → "Opening claim (#1)". */
  text: string;
  /** The parent ordinal token "#3", or null for root / unresolvable parent.
   *  Drives the single tappable span. */
  parentOrdinalToken: string | null;
  /** The parent message id to activate when the token is tapped, or null. */
  parentMessageId: string | null;
  /** Pre-built screen-reader label. */
  accessibilityLabel: string;
}

export interface BuildStepReferenceLineInput {
  /** The currently-active message id. */
  activeMessageId: string;
  /** Chronological message-id list (used to detect the root: ordinal 1). */
  chronologicalIds: ReadonlyArray<string>;
  /** 1-based ordinal lookup; returns null when the id is unknown. */
  ordinalOf: (id: string) => number | null;
  /** Plain-language kind label lookup ("rebuttal" / "claim" / …). */
  kindLabelOf: (id: string) => string;
  /** Parent message-id lookup; returns null for a root move. */
  parentIdOf: (id: string) => string | null;
}

/** Format a 1-based ordinal as an "#N" token. */
function ordinalToken(ordinal: number): string {
  return `#${ordinal}`;
}

/**
 * Build the step-reference line for the active card. Pure.
 *
 * Returns a safe display-only line for every degenerate input
 * (empty/unknown active id, unresolvable parent). Never throws and never
 * emits a tappable token without a resolvable `parentMessageId`.
 */
export function buildStepReferenceLine(
  input: BuildStepReferenceLineInput,
): CardStepReferenceLine {
  const empty: CardStepReferenceLine = {
    text: '',
    parentOrdinalToken: null,
    parentMessageId: null,
    accessibilityLabel: '',
  };
  if (
    !input ||
    typeof input.activeMessageId !== 'string' ||
    input.activeMessageId.length === 0
  ) {
    return empty;
  }

  const activeOrdinal = input.ordinalOf(input.activeMessageId);
  if (activeOrdinal == null) {
    // Active id not in the loaded slice — render nothing rather than a
    // misleading line.
    return empty;
  }
  const activeKind = sanitizeKindLabel(input.kindLabelOf(input.activeMessageId));
  const activeToken = ordinalToken(activeOrdinal);

  const parentId = input.parentIdOf(input.activeMessageId);

  // Root move — no parent. Ordinal 1 is the canonical root; we also treat
  // any move whose parent is null as an opening move.
  if (!parentId) {
    const text = `Opening ${activeKind} (${activeToken})`;
    return {
      text,
      parentOrdinalToken: null,
      parentMessageId: null,
      accessibilityLabel: `Opening ${activeKind}, message ${activeOrdinal}.`,
    };
  }

  const parentOrdinal = input.ordinalOf(parentId);
  // Unresolvable parent (soft-deleted / RLS-hidden / not in slice): keep
  // the "Acting on" clause, drop the "Replied to" clause, and emit NO
  // tappable token (parentMessageId stays null).
  if (parentOrdinal == null) {
    const text = `Acting on ${activeToken} (${activeKind})`;
    return {
      text,
      parentOrdinalToken: null,
      parentMessageId: null,
      accessibilityLabel: `Acting on message ${activeOrdinal}, a ${activeKind}.`,
    };
  }

  const parentKind = sanitizeKindLabel(input.kindLabelOf(parentId));
  const parentToken = ordinalToken(parentOrdinal);
  const text = `Acting on ${activeToken} (${activeKind}) · Replied to ${parentToken} (${parentKind})`;
  return {
    text,
    parentOrdinalToken: parentToken,
    parentMessageId: parentId,
    accessibilityLabel:
      `Acting on message ${activeOrdinal}, a ${activeKind}. ` +
      `Replied to message ${parentOrdinal}, a ${parentKind}. ` +
      `Tap to go to message ${parentOrdinal}.`,
  };
}

/**
 * Defensive plain-language normalization for the kind label. The caller
 * already supplies the plain `kindLabel` from the timeline view-model, but
 * this guards against an empty / whitespace-only label leaking into the
 * line (which would read as a broken sentence). Never echoes a raw code:
 * an empty label falls back to the neutral word "move".
 */
function sanitizeKindLabel(label: unknown): string {
  if (typeof label !== 'string') return 'move';
  const trimmed = label.replace(/\s+/g, ' ').trim();
  if (trimmed.length === 0) return 'move';
  return trimmed;
}
