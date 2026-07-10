/**
 * FEEDBACK-002 (#899) — the two mandated derived-signal consumer selectors
 * (pure TypeScript).
 *
 * This card wires exactly two surfaces (doc 10 section 4 "signals move
 * furniture; they never add new furniture"):
 *   1. `selectInspectAdvisoryLines` — calm advisory lines for the Inspect
 *      active-node disclosure (rendered next to PointFeedbackFlagsRow).
 *   2. `selectMediatorRailOverlay` — dodge_chain + talking_past overlay lines
 *      keyed to an ALREADY-derived board point (additive; never reorders).
 *
 * All user-facing copy lives in ONE place (DERIVED_SIGNAL_LINE_COPY) so the
 * ban-list test has a single surface to scan, mirroring moveMarksCopy /
 * gameCopy. No code leak, no verdict token, no person attribution. Pure TS:
 * no React, no Supabase, no network, no clock. Apostrophe-free comments.
 */
import type {
  DerivedSignal,
  DerivedSignalCode,
  DerivedSignalConsumer,
} from './derivedObservationSignals';

/** A rendered advisory line — ban-list clean, no raw code, no verdict token. */
export interface DerivedSignalLine {
  readonly code: DerivedSignalCode;
  readonly text: string;
  readonly accessibilityLabel: string;
}

/**
 * Plain-language copy per code. Advisory offers, never verdicts. dodge_chain
 * never says "evading"; talking_past names neither person. hot_but_proof_light
 * describes the ROOM state.
 */
export const DERIVED_SIGNAL_LINE_COPY: Readonly<
  Record<DerivedSignalCode, { readonly text: string; readonly accessibilityLabel: string }>
> = Object.freeze({
  proof_moment: Object.freeze({
    text: 'A receipt would carry this point further.',
    accessibilityLabel: 'Advisory: a source on your own move would carry this point further.',
  }),
  hot_but_proof_light: Object.freeze({
    text: 'This room is active, but receipts are still pending.',
    accessibilityLabel: 'Advisory: this room is active while a source request is still open.',
  }),
  talking_past: Object.freeze({
    text: 'You two may be arguing different claims — pin the claim.',
    accessibilityLabel: 'Advisory: the exchange may be about different claims; pin the claim.',
  }),
  resolution_window: Object.freeze({
    text: 'Synthesis may be on the table.',
    accessibilityLabel: 'Advisory: a synthesis or settlement may be on the table.',
  }),
  callback_worthy: Object.freeze({
    text: 'This line is worth quoting back later.',
    accessibilityLabel: 'Advisory: this move is good callback material to quote back later.',
  }),
  own_tension_hint: Object.freeze({
    text: 'This may cut against your earlier point — reconcile or branch.',
    accessibilityLabel: 'Advisory: this draft may cut against your earlier point; reconcile or branch.',
  }),
  dodge_chain: Object.freeze({
    text: 'This point is still open after a few exchanges.',
    accessibilityLabel: 'Advisory: this point remains open after several exchanges.',
  }),
});

function lineFor(code: DerivedSignalCode): DerivedSignalLine {
  const copy = DERIVED_SIGNAL_LINE_COPY[code];
  return Object.freeze({ code, text: copy.text, accessibilityLabel: copy.accessibilityLabel });
}

function reaches(signal: DerivedSignal, consumer: DerivedSignalConsumer): boolean {
  return signal.consumers.includes(consumer);
}

/** True when the signal is anchored to (or contains) the given argument id. */
function anchoredToNode(signal: DerivedSignal, argumentId: string): boolean {
  const s = signal.scope;
  if (s.kind === 'node') return s.argumentId === argumentId;
  if (s.kind === 'thread') {
    return s.anchorArgumentId === argumentId || s.memberArgumentIds.includes(argumentId);
  }
  return false; // room-scoped signals are not tied to a single node.
}

/**
 * Node-scoped + thread-scoped advisory LINES for the Inspect active-node
 * disclosure. Returns nothing (frozen empty) when there is no active node.
 * composer-only signals are NEVER surfaced here (own_tension_hint stays hidden).
 * Deterministic order: input signal order (already sorted by the deriver),
 * de-duped by code.
 */
export function selectInspectAdvisoryLines(
  signals: readonly DerivedSignal[],
  activeArgumentId: string | null,
): readonly DerivedSignalLine[] {
  if (!activeArgumentId) return Object.freeze([]);
  const out: DerivedSignalLine[] = [];
  const seen = new Set<DerivedSignalCode>();
  for (const signal of signals) {
    if (signal.composerOnly) continue;
    if (!reaches(signal, 'inspect_advisory_line')) continue;
    if (!anchoredToNode(signal, activeArgumentId)) continue;
    if (seen.has(signal.code)) continue;
    seen.add(signal.code);
    out.push(lineFor(signal.code));
  }
  return Object.freeze(out);
}

/**
 * dodge_chain + talking_past overlay lines keyed to an ALREADY-derived board
 * point id. NEVER reorders points; additive only. A signal maps to a point when
 * its thread scope pointId is in `boardPointIds`. At most one line per point
 * (first wins, deterministic by input order).
 */
export function selectMediatorRailOverlay(
  signals: readonly DerivedSignal[],
  boardPointIds: readonly string[],
): Readonly<Record<string, DerivedSignalLine>> {
  const pointSet = new Set(boardPointIds);
  const out: Record<string, DerivedSignalLine> = {};
  for (const signal of signals) {
    if (signal.composerOnly) continue;
    if (!reaches(signal, 'mediator_rail_line')) continue;
    if (signal.scope.kind !== 'thread') continue;
    const pointId = signal.scope.pointId;
    if (!pointSet.has(pointId)) continue;
    if (out[pointId]) continue;
    out[pointId] = lineFor(signal.code);
  }
  return Object.freeze(out);
}
