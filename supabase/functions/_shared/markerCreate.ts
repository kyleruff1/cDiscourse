/**
 * MARK-002 (#894) — create-marker pure contract module.
 *
 * The single source of truth shared by the create-marker Edge Function AND the
 * jest contract test (__tests__/createMarkerContract.test.ts imports THIS file
 * directly, the _shared/proofAttach.ts precedent). It carries the marker kind
 * vocabulary, the span + quote caps, the span-bounds validator, and the
 * server-side quote-verification helper that is the load-bearing Q5 mitigation:
 * a client-supplied quote that does not match the target body slice is rejected,
 * and the SERVER slice is the value stored (never the client string).
 *
 * Why this file exists: Edge Functions run on Deno with a separate module graph
 * and cannot import from src/. This module mirrors the two authoritative rules:
 *   - MARKER_KINDS mirrors the CHECK-valid timestamp_markers.kind values shipped
 *     by migration 20260711000001 (rebuttal_anchor / note; proof_excerpt
 *     deferred).
 *   - sliceQuote / verifyQuoteMatch encode that quoted_text is a server snapshot
 *     of arguments.body, never a client string (MARK-001 SELECT-only rationale).
 *
 * Pure TypeScript. No Deno API, no Supabase, no network, no async, no mutation,
 * no console. Comments are apostrophe-free for scanner safety. No verdict token
 * appears in any exported string (a marker quotes the point, never judges it).
 */

// ── Marker kind vocabulary (matches the MARK-001 CHECK; proof_excerpt deferred) ──

export const MARKER_KINDS = ['rebuttal_anchor', 'note'] as const;
export type MarkerKind = (typeof MARKER_KINDS)[number];

/** True iff kind is one of the two verdict-free marker kinds this card mints. */
export function isMarkerKind(kind: string): kind is MarkerKind {
  return (MARKER_KINDS as ReadonlyArray<string>).includes(kind);
}

// ── Caps (Design Pass Q9 spirit + body-size) ───────────────────

/**
 * Max span length in chars. A whole-essay quote is disallowed: a marker quotes a
 * moment, not the whole move. Also the max stored quoted_text length.
 */
export const MARKER_QUOTE_MAX = 2000;

/** Non-deleted markers per target argument per caller. Advisory UX cap. */
export const MARKERS_PER_TARGET_PER_USER = 20;

// ── Span bounds validation ─────────────────────────────────────

export type MarkerSpanIssue = 'span_out_of_bounds' | 'span_too_long';

/**
 * Validate a char span against the target body length. Requires
 * 0 <= start < end <= bodyLength AND (end - start) <= MARKER_QUOTE_MAX. An
 * inverted or zero-length span (end <= start), a negative start, or an end past
 * the body is span_out_of_bounds; a span longer than the cap is span_too_long.
 */
export function verifyMarkerSpan(
  bodyLength: number,
  start: number,
  end: number,
): { ok: true } | { ok: false; issue: MarkerSpanIssue } {
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return { ok: false, issue: 'span_out_of_bounds' };
  }
  if (start < 0 || end <= start || end > bodyLength) {
    return { ok: false, issue: 'span_out_of_bounds' };
  }
  if (end - start > MARKER_QUOTE_MAX) {
    return { ok: false, issue: 'span_too_long' };
  }
  return { ok: true };
}

// ── Server-side quote snapshot + verification (Q5 + fabricated-quote AC) ──

/** The verbatim server snapshot of the span. This is what gets stored. */
export function sliceQuote(body: string, start: number, end: number): string {
  return body.slice(start, end);
}

/**
 * Verify the client-supplied quote matches the server slice EXACTLY. The client
 * quote is used ONLY to reject a mismatch (a fabricated quote or stale offsets);
 * it is never stored. Whitespace-sensitive by construction (a strict ===). The
 * caller stores sliceQuote(body, start, end), never the client string.
 */
export function verifyQuoteMatch(
  body: string,
  start: number,
  end: number,
  clientQuote: string,
): { ok: true } | { ok: false; issue: 'quote_mismatch' } {
  const serverQuote = sliceQuote(body, start, end);
  if (serverQuote === clientQuote) return { ok: true };
  return { ok: false, issue: 'quote_mismatch' };
}
