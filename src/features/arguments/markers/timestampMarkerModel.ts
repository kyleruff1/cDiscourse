/**
 * MARK-002 (#894) — TimestampMarker pure model.
 *
 * No React, no Supabase, no env, no network, no wall clock. Every function is a
 * pure projection so it is unit-testable in isolation. It carries the marker row
 * shape (the SELECT-shaped timestamp_markers row), the view-model seam the
 * TimestampMarker chip renders, the deterministic phrase segmenter that powers
 * the honest v1 gesture (the phrase-picker sheet), the source-span highlight
 * segmenter, and the two grouping helpers the room read hook feeds.
 *
 * Doctrine: a marker quotes the point, never judges it. Nothing here reads or
 * writes a score, a strength band, heat, or popularity; there is no verdict
 * field. Comments are apostrophe-free (the uxOneOneTwoDoctrine quote-parity
 * gotcha); the copy STRINGS may carry typographic quotes.
 */

import type { MarkerKind } from '../../../lib/edgeFunctions';

/** The SELECT-shaped timestamp_markers row (snake case, as the hook reads it). */
export interface MarkerRow {
  id: string;
  debate_id: string;
  target_argument_id: string;
  reply_argument_id: string | null;
  created_by: string;
  kind: MarkerKind;
  span_start: number;
  span_end: number;
  span_unit: 'chars';
  quoted_text: string;
  created_at: string;
  deleted_at: string | null;
}

/** The three placements the ONE TimestampMarker component renders. */
export type MarkerPlacement = 'source_span' | 'reply_reference' | 'composer_scope';

/** live = the target is present; orphaned = the target was soft-deleted. */
export type MarkerState = 'live' | 'orphaned';

/** The camelCase view-model the TimestampMarker chip consumes. */
export interface TimestampMarkerViewModel {
  id: string;
  targetArgumentId: string;
  replyArgumentId: string | null;
  kind: MarkerKind;
  spanStart: number;
  spanEnd: number;
  quotedText: string;
  state: MarkerState;
}

/** Client-only pending scope during composition (no row exists yet). */
export interface PendingMarkerScope {
  targetArgumentId: string;
  spanStart: number;
  spanEnd: number;
  quote: string;
}

/** One selectable phrase in the picker, with exact char offsets into body. */
export interface PhraseSpan {
  text: string;
  start: number;
  end: number;
}

const SENTENCE_TERMINATORS = new Set(['.', '!', '?']);

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === '\f' || ch === '\v';
}

/**
 * Deterministic sentence-ish segmenter with EXACT char offsets. Pure, no lib.
 * Each returned phrase satisfies body.slice(phrase.start, phrase.end) ===
 * phrase.text, so a picked span matches the server slice byte-for-byte. A body
 * with no sentence terminator yields ONE phrase covering the whole content run;
 * an empty or whitespace-only body yields an empty list (the picker then offers
 * a Whole move fallback). Leading whitespace is skipped so a phrase always
 * starts on content; a trailing terminator run stays with its sentence.
 */
export function segmentPhrases(body: string): PhraseSpan[] {
  const phrases: PhraseSpan[] = [];
  if (typeof body !== 'string') return phrases;
  const n = body.length;
  let i = 0;
  while (i < n) {
    while (i < n && isWhitespace(body[i])) i++;
    if (i >= n) break;
    const start = i;
    let end = i;
    while (end < n) {
      const ch = body[end];
      end++;
      if (SENTENCE_TERMINATORS.has(ch)) {
        while (end < n && SENTENCE_TERMINATORS.has(body[end])) end++;
        if (end >= n || isWhitespace(body[end])) break;
      }
    }
    const text = body.slice(start, end);
    if (text.trim().length > 0) {
      phrases.push({ text, start, end });
    }
    i = end;
  }
  return phrases;
}

/** Build the chip view-model from a row. orphaned when the target is gone. */
export function buildTimestampMarker(
  row: MarkerRow,
  opts: { targetExists: boolean },
): TimestampMarkerViewModel {
  return {
    id: row.id,
    targetArgumentId: row.target_argument_id,
    replyArgumentId: row.reply_argument_id,
    kind: row.kind,
    spanStart: row.span_start,
    spanEnd: row.span_end,
    quotedText: row.quoted_text,
    state: opts.targetExists ? 'live' : 'orphaned',
  };
}

/** Group rows by their quoted (target) argument id. */
export function groupMarkersByTarget(rows: readonly MarkerRow[]): Record<string, MarkerRow[]> {
  const out: Record<string, MarkerRow[]> = {};
  for (const row of rows) {
    const key = row.target_argument_id;
    if (!out[key]) out[key] = [];
    out[key].push(row);
  }
  return out;
}

/** Group rows by the reply that consumed them (skips standalone markers). */
export function groupMarkersByReply(rows: readonly MarkerRow[]): Record<string, MarkerRow[]> {
  const out: Record<string, MarkerRow[]> = {};
  for (const row of rows) {
    const key = row.reply_argument_id;
    if (!key) continue;
    if (!out[key]) out[key] = [];
    out[key].push(row);
  }
  return out;
}

/**
 * Split a target body into the (before, marked, after) runs for the source-span
 * highlight. Returns null when the stored offsets no longer index the body
 * (drift) so the chip falls back to the durable quotedText without a highlight.
 */
export function buildSourceSpanSegments(
  body: string,
  m: { spanStart: number; spanEnd: number },
): { before: string; marked: string; after: string } | null {
  if (typeof body !== 'string') return null;
  const { spanStart, spanEnd } = m;
  if (
    !Number.isInteger(spanStart) ||
    !Number.isInteger(spanEnd) ||
    spanStart < 0 ||
    spanEnd <= spanStart ||
    spanEnd > body.length
  ) {
    return null;
  }
  return {
    before: body.slice(0, spanStart),
    marked: body.slice(spanStart, spanEnd),
    after: body.slice(spanEnd),
  };
}

/** Max chars of the quoted phrase shown inside a chip. */
const CHIP_QUOTE_MAX = 40;

/**
 * Truncate + typographic-quote-wrap a quoted phrase for the chip label. Collapses
 * internal whitespace to keep the single-line chip tidy; adds an ellipsis when
 * clamped. The forward chevron the reply chip shows is added by the component.
 */
export function formatMarkerChipLabel(quotedText: string): string {
  const collapsed = (quotedText ?? '').replace(/\s+/g, ' ').trim();
  const clamped =
    collapsed.length <= CHIP_QUOTE_MAX
      ? collapsed
      : collapsed.slice(0, Math.max(0, CHIP_QUOTE_MAX - 1)).trimEnd() + '…';
  return '“' + clamped + '”';
}
