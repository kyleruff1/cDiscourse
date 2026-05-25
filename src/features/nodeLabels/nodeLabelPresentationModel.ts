/**
 * UX-001.5A — Presentation model + display caps.
 *
 * Pure-TS helpers that combine per-source mark arrays, dedupe by
 * kind/rawKey/text, filter by surface disposition, and enforce the
 * display caps for Timeline (1+1+overflow), Selected context (3+3+
 * overflow), and Inspect (unbounded grouped view).
 *
 * Doctrine anchor: cdiscourse-doctrine §10a — Machine Observations and
 * User Allegations are NEVER collapsed. Dedupe operates within a single
 * kind only; cross-kind same-text marks BOTH render.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

import type {
  NodeLabelDisposition,
  NodeLabelMark,
  NodeLabelSurface,
} from './nodeLabelTypes';
import type { PerNodeMarkInput } from './nodeLabelSourceAdapters';
import {
  comparePriorityThenAlphabetical,
  resolveSourceForDuplicateText,
} from './nodeLabelPriorityModel';

// ── Public result types ───────────────────────────────────────────

export interface TimelineDisplayResult {
  /** 0 or 1 Machine Observation. */
  observation: NodeLabelMark | null;
  /** 0 or 1 User Allegation. */
  allegation: NodeLabelMark | null;
  /** Count of marks hidden by the cap. */
  overflowCount: number;
}

export interface SelectedContextDisplayResult {
  /** Up to 3 Machine Observations. */
  observations: ReadonlyArray<NodeLabelMark>;
  /** Up to 3 User Allegations. */
  allegations: ReadonlyArray<NodeLabelMark>;
  /** Count of marks hidden by the cap. */
  overflowCount: number;
}

export interface InspectGroupedView {
  /** Unbounded; full provenance preserved. */
  observations: ReadonlyArray<NodeLabelMark>;
  /** Unbounded; full provenance preserved. */
  allegations: ReadonlyArray<NodeLabelMark>;
}

// ── combinePerNodeMarks ───────────────────────────────────────────

/**
 * Combine per-source mark arrays into a single flat array, preserving
 * source provenance for downstream display routing. Pure.
 *
 * Order: manualTag → autoMetadata → lifecycle → compositionMutation →
 * semanticRefereeNodeMount → rawClassifier. Within each source the
 * input order is preserved.
 */
export function combinePerNodeMarks(input: PerNodeMarkInput): NodeLabelMark[] {
  return [
    ...input.manualTagMarks,
    ...input.autoMetadataMarks,
    ...input.lifecycleMarks,
    ...input.compositionMutationMarks,
    ...input.semanticRefereeNodeMountMarks,
    ...input.rawClassifierMarks,
  ];
}

// ── dedupePerNodeMarks ────────────────────────────────────────────

/**
 * Dedupe marks. Pure. Rules:
 *
 *   - Same `kind` + same `rawKey` → keep the higher-priority source
 *     per `resolveSourceForDuplicateText` (`nodeLabelPriorityModel.ts`).
 *   - Same `kind` + same `label` text + different `source` → keep the
 *     higher-priority source; the other source is dropped from the chip
 *     strip but still appears in Inspect via the un-deduped path.
 *   - Different `kind` (Machine Observation vs User Allegation) with
 *     same text → BOTH are preserved (never collapsed).
 *
 * Doctrine: the kind boundary is load-bearing — cdiscourse-doctrine
 * §10a forbids collapsing across kinds.
 */
export function dedupePerNodeMarks(
  marks: ReadonlyArray<NodeLabelMark>,
): NodeLabelMark[] {
  if (!Array.isArray(marks) || marks.length === 0) return [];

  // Step 1: dedupe by (kind, rawKey) — pick the higher-priority entry.
  const byKindRaw = new Map<string, NodeLabelMark>();
  for (const mark of marks) {
    const key = `${mark.kind}|${mark.rawKey}`;
    const existing = byKindRaw.get(key);
    if (!existing) {
      byKindRaw.set(key, mark);
      continue;
    }
    byKindRaw.set(key, resolveSourceForDuplicateText(existing, mark));
  }

  // Step 2: dedupe by (kind, label text) — pick the higher-priority
  // entry. Different rawKey + same text within the same kind → keep one.
  const byKindLabel = new Map<string, NodeLabelMark>();
  for (const mark of byKindRaw.values()) {
    const key = `${mark.kind}|${mark.label.trim().toLowerCase()}`;
    const existing = byKindLabel.get(key);
    if (!existing) {
      byKindLabel.set(key, mark);
      continue;
    }
    byKindLabel.set(key, resolveSourceForDuplicateText(existing, mark));
  }

  // Stable output — sort by per-mark priority then source then label.
  return Array.from(byKindLabel.values()).sort(comparePriorityThenAlphabetical);
}

// ── filterMarksBySurface ──────────────────────────────────────────

/**
 * Filter marks by their disposition gate + the target surface. Pure.
 *
 * Disposition gating:
 *   - `rendered_now` — eligible for `timeline_node`, `selected_context`,
 *     and `inspect` surfaces.
 *   - `inspect_only` — eligible for `inspect` surface ONLY.
 *   - `composer_only` — eligible for `composer` surface ONLY. NEVER
 *     surfaces on `timeline_node` / `selected_context` / `inspect`.
 *   - `hidden_sensitive` — never surfaces anywhere in v1.
 *   - `future_source` — never surfaces anywhere in v1.
 *   - `intentionally_silent` — never surfaces.
 */
export function filterMarksBySurface(
  marks: ReadonlyArray<NodeLabelMark>,
  targetSurface: NodeLabelSurface,
): NodeLabelMark[] {
  if (!Array.isArray(marks)) return [];
  const out: NodeLabelMark[] = [];
  for (const mark of marks) {
    if (isDispositionEligible(mark.disposition, targetSurface)) {
      out.push(mark);
    }
  }
  return out;
}

/**
 * Pure helper — true when a disposition value is eligible for the
 * target surface. Exported for tests.
 */
export function isDispositionEligible(
  disposition: NodeLabelDisposition,
  targetSurface: NodeLabelSurface,
): boolean {
  switch (disposition) {
    case 'rendered_now':
      return (
        targetSurface === 'timeline_node' ||
        targetSurface === 'selected_context' ||
        targetSurface === 'inspect'
      );
    case 'inspect_only':
      return targetSurface === 'inspect';
    case 'composer_only':
      return targetSurface === 'composer';
    case 'hidden_sensitive':
    case 'future_source':
    case 'intentionally_silent':
      return false;
    default: {
      const _exhaustive: never = disposition;
      void _exhaustive;
      return false;
    }
  }
}

// ── Display caps ──────────────────────────────────────────────────

/**
 * Enforce Timeline-node display cap: 1 Observation + 1 Allegation +
 * overflow indicator showing the count of hidden marks. Pure.
 *
 * Selection rule:
 *   1. Partition marks into Observations + Allegations.
 *   2. Pick the highest-priority Observation (lowest priority number).
 *   3. Pick the highest-priority Allegation.
 *   4. overflowCount = filtered.length - selected.length.
 */
export function enforceTimelineNodeDisplayCap(
  marks: ReadonlyArray<NodeLabelMark>,
): TimelineDisplayResult {
  if (!Array.isArray(marks) || marks.length === 0) {
    return { observation: null, allegation: null, overflowCount: 0 };
  }
  const sorted = [...marks].sort(comparePriorityThenAlphabetical);
  let observation: NodeLabelMark | null = null;
  let allegation: NodeLabelMark | null = null;
  for (const mark of sorted) {
    if (!observation && mark.kind === 'machine_observation') {
      observation = mark;
    } else if (!allegation && mark.kind === 'user_allegation') {
      allegation = mark;
    }
    if (observation && allegation) break;
  }
  const selectedCount = (observation ? 1 : 0) + (allegation ? 1 : 0);
  const overflowCount = Math.max(0, sorted.length - selectedCount);
  return { observation, allegation, overflowCount };
}

/**
 * Enforce Selected-context display cap: 3 Observations + 3 Allegations +
 * overflow. Pure.
 */
export function enforceSelectedContextDisplayCap(
  marks: ReadonlyArray<NodeLabelMark>,
): SelectedContextDisplayResult {
  if (!Array.isArray(marks) || marks.length === 0) {
    return { observations: [], allegations: [], overflowCount: 0 };
  }
  const sorted = [...marks].sort(comparePriorityThenAlphabetical);
  const observations: NodeLabelMark[] = [];
  const allegations: NodeLabelMark[] = [];
  for (const mark of sorted) {
    if (mark.kind === 'machine_observation' && observations.length < 3) {
      observations.push(mark);
    } else if (mark.kind === 'user_allegation' && allegations.length < 3) {
      allegations.push(mark);
    }
  }
  const overflowCount = Math.max(0, sorted.length - observations.length - allegations.length);
  return { observations, allegations, overflowCount };
}

/**
 * Build Inspect grouped view: unbounded; full provenance preserved.
 * Pure.
 */
export function enforceInspectGroupedView(
  marks: ReadonlyArray<NodeLabelMark>,
): InspectGroupedView {
  if (!Array.isArray(marks) || marks.length === 0) {
    return { observations: [], allegations: [] };
  }
  const sorted = [...marks].sort(comparePriorityThenAlphabetical);
  const observations: NodeLabelMark[] = [];
  const allegations: NodeLabelMark[] = [];
  for (const mark of sorted) {
    if (mark.kind === 'machine_observation') {
      observations.push(mark);
    } else if (mark.kind === 'user_allegation') {
      allegations.push(mark);
    }
  }
  return { observations, allegations };
}
