/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 1) — shared argument-detail derivation.
 *
 * This is the SINGLE SOURCE for the per-node detail derivation that BOTH
 * the Timeline detail (`ArgumentReplySidecar`) and the Cards detail
 * (`CardDetailPanel` / its hub successor) consume. Fork 2 of the ratified
 * design ("share the model, project the view") makes this module the
 * no-fork foundation: the narrative/detail derivation lives in exactly ONE
 * place so the two surfaces can never drift apart.
 *
 * What this module owns (single canonical definition):
 *   - the band formatters `formatStandingLine` / `formatToneLine` /
 *     `formatHeatLine` (+ `PARENT_BODY_PREVIEW_CAP`),
 *   - the semantic-flag chip builder `buildSectionSemanticFlags` and its
 *     chip / section types.
 *
 * What this module re-exports (so both surfaces import from one place):
 *   - `buildStepReferenceLine` (from `../cardView/cardStepReferenceModel`),
 *   - `buildCardClassifierStrip` (from `../cardView/cardClassifierStripModel`),
 *   - `artifactsToEvidenceSources` (from `../cardView/cardDetailModel`).
 *
 * Slice 1 is a PURE REFACTOR. Behavior is byte-equal: the shared builders
 * emit exactly the strings the sidecar emitted before. The plain-language
 * band maps + the new hub asks (parent quote, S/T/H strip, all-families
 * classifiers, full tags) land in Slice 2 — NOT here.
 *
 * Doctrine (cdiscourse-doctrine + design §3):
 *   - Pure TS. No React. No Supabase. No network. No AI. No `Date.now()`,
 *     no `Math.random()`, no input mutation. Deterministic, JSON-serializable.
 *   - Display-only derivation; no callback / action / dispatch field.
 *   - `inactive_reason` / `inactive_by` are NOT fields on any shape here
 *     (the temporal-only `isInactive` is derived elsewhere from `inactiveAt`).
 *   - Semantic-flag chips route every label through RULE-003 helpers; no raw
 *     `snake_case` code is ever placed in a render-bound field.
 */

import type {
  ArgumentBubbleViewModel,
  ArgumentTimelineMapNode,
} from '../argumentGameSurfaceModel';
import type {
  AutoMetadataCode,
  ClusterMetadataSummary,
  ManualTagCode,
  MoveMetadataLedger,
} from '../../metadata';
import type { EvidenceArtifact } from '../../evidence/evidenceModel';
import {
  getAutoMetadataUx,
  getManualTagUx,
} from '../../rulesUx/lifecycleUxMap';

// ── Re-exported named pure builders (the ONE import surface) ──────────
//
// These builders physically live in their own modules under `cardView/`.
// Re-exporting them here gives BOTH the Timeline and Cards surfaces a
// single canonical place to import them from, so the shared detail
// derivation can never fork. The function references are identical to the
// source-module exports (verified by `argumentDetailParity.test.ts`).

export {
  buildStepReferenceLine,
  type BuildStepReferenceLineInput,
  type CardStepReferenceLine,
} from '../cardView/cardStepReferenceModel';

export {
  buildCardClassifierStrip,
  type BuildCardClassifierStripInput,
  type CardClassifierChip,
  type CardClassifierStripModel,
} from '../cardView/cardClassifierStripModel';

// ── Evidence sources (shared) ────────────────────────────────────────
//
// The canonical home for the evidence-source display labels and the
// `artifactsToEvidenceSources` builder. `cardView/cardDetailModel.ts`
// imports these back from here so the Cards surface and any other consumer
// share one definition (and there is no `detail → cardDetailModel` cycle).

/** One attached evidence source/quote rendered as a display label. */
export interface CardDetailEvidenceSource {
  /** Stable React key. */
  id: string;
  /** Plain-language label, e.g. "Source · nytimes.com" / "Quote attached". */
  label: string;
}

export interface CardDetailEvidenceZone {
  /** Attached sources/quotes as labels (display-only). */
  sources: ReadonlyArray<CardDetailEvidenceSource>;
  /** Plain-language evidence-debt summary, e.g. "Receipts owed: a source
   *  for this claim." null when no debt is owed. */
  debtSummary: string | null;
  /** Empty-state copy when there is no source AND no debt. */
  emptyStateCopy: string;
  /** True when at least one source is attached. */
  hasSource: boolean;
}

/** Plain-language kind word per evidence-artifact kind. Display-only; never
 *  a verdict, never a raw code. */
const EVIDENCE_KIND_WORD: Record<EvidenceArtifact['kind'], string> = {
  url: 'Source',
  quote: 'Quote',
  source_text: 'Source',
  dataset: 'Dataset',
  screenshot_redacted: 'Screenshot',
  manual_citation: 'Citation',
  payment_screenshot: 'Payment record',
};

/** Trim a single label, returning null for empty/non-string. Pure. */
function cleanEvidenceLabel(label: string | null | undefined): string | null {
  if (typeof label !== 'string') return null;
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Map evidence artifacts → display-only source labels. The kind word is a
 * locked plain-language prefix; the artifact's own `label` is appended.
 * Pure; never throws, never mutates. Unknown kinds fall back to "Source".
 */
export function artifactsToEvidenceSources(
  artifacts: ReadonlyArray<EvidenceArtifact> | undefined,
): CardDetailEvidenceSource[] {
  if (!Array.isArray(artifacts)) return [];
  return artifacts
    .filter((a): a is EvidenceArtifact => Boolean(a && typeof a.id === 'string'))
    .map((a) => {
      const kindWord = EVIDENCE_KIND_WORD[a.kind] ?? 'Source';
      const detail = cleanEvidenceLabel(a.label);
      return {
        id: a.id,
        label: detail ? `${kindWord} · ${detail}` : kindWord,
      };
    });
}

// ── Shared constants ─────────────────────────────────────────────────

/**
 * Parent replied-to excerpt cap. The single canonical value used by both
 * surfaces' parent-quote derivation. (Slice 2 wires the parent quote onto
 * the Cards hub; the sidecar already truncates to this length today.)
 */
export const PARENT_BODY_PREVIEW_CAP = 120;

// ── Shared band formatters ───────────────────────────────────────────
//
// Slice 1: byte-equal with the sidecar's prior private formatters — they
// emit the raw band token (e.g. "Tone: calm"). Slice 2 introduces the
// plain-language band maps (design §6.4) on top of these shared formatters
// so the Cards strip and the Timeline strip can never diverge.

/**
 * Pre-formatted standing band line, e.g. "Standing: well_supported".
 * Slice 1 keeps the raw band token for byte-equality with the prior
 * sidecar behavior. The `viewModel` arg is retained for signature
 * stability (Slice 2 may route the standing band through plain-language).
 */
export function formatStandingLine(
  viewModel: ArgumentBubbleViewModel,
  node: ArgumentTimelineMapNode,
): string {
  void viewModel;
  return `Standing: ${node.standingBand}`;
}

/** Pre-formatted tone band line, e.g. "Tone: calm". */
export function formatToneLine(node: ArgumentTimelineMapNode): string {
  return `Tone: ${node.toneBand}`;
}

/** Pre-formatted heat / temperature band line, e.g. "Heat: cool". */
export function formatHeatLine(node: ArgumentTimelineMapNode): string {
  return `Heat: ${node.temperatureBand}`;
}

// ── Semantic-flag chip model (shared) ────────────────────────────────
//
// The canonical home for the semantic-flag chip + section types and the
// `buildSectionSemanticFlags` builder. `argumentReplySidecarModel.ts`
// re-exports these under its existing `SidecarSemanticFlagChip` /
// `SidecarSection_SemanticFlags` names so its public type surface is
// unchanged; the Cards hub (Slice 2) consumes them directly.

export interface DetailSemanticFlagChip {
  /** Stable id for keying. Equal to `${family}:${code}`. */
  id: string;
  family: 'manual_tag' | 'auto_metadata';
  /** Plain-language label, from RULE-003. */
  label: string;
  /** Plain-language helper line, from RULE-003. */
  helperLine: string;
  /** RULE-003 icon hint. */
  iconHint: string;
  /** Internal code. NEVER rendered. */
  sourceCode: ManualTagCode | AutoMetadataCode;
}

export interface DetailSemanticFlagsSection {
  kind: 'semantic_flags';
  /** True in Timeline mode. Consumer renders only a count + "Show details". */
  isCondensed: boolean;
  /** Chip count (same in both modes — only `isCondensed` flips). */
  totalCount: number;
  /** Full chip list. Consumer chooses condensation behavior. */
  chips: ReadonlyArray<DetailSemanticFlagChip>;
}

/** Surface discriminator for the semantic-flag condensation flip. Mirrors
 *  `SidecarViewMode` from `argumentReplySidecarModel.ts` without importing
 *  it (one-way dependency: the sidecar imports this module, not vice-versa). */
export type DetailViewMode = 'timeline' | 'stack';

function getMetadataForCluster(
  ledger: MoveMetadataLedger | null,
  clusterId: string | null,
): ClusterMetadataSummary | null {
  if (!ledger || !clusterId) return null;
  return ledger.byCluster.get(clusterId) ?? null;
}

/**
 * Build the semantic-flag chip strip for a cluster. Pure.
 *
 * COPY-001 R2 dedup applies: when a manual-tag chip and an auto-metadata
 * chip would render the same plain-language label, the manual tag wins
 * (explicit participant annotation beats auto observation). Across-band
 * dedup against the cluster lifecycle label is also applied so the
 * "Why it matters" line is not echoed in the flag strip.
 *
 * Byte-equal with the sidecar's prior private `buildSectionSemanticFlags`.
 */
export function buildSectionSemanticFlags(
  ledger: MoveMetadataLedger | null,
  clusterId: string | null,
  lifecycleLabel: string,
  viewMode: DetailViewMode,
): DetailSemanticFlagsSection {
  if (!ledger || !clusterId) {
    return {
      kind: 'semantic_flags',
      isCondensed: viewMode === 'timeline',
      totalCount: 0,
      chips: [],
    };
  }
  const clusterMeta = getMetadataForCluster(ledger, clusterId);
  if (!clusterMeta) {
    return {
      kind: 'semantic_flags',
      isCondensed: viewMode === 'timeline',
      totalCount: 0,
      chips: [],
    };
  }

  // Manual-tag chips first (explicit participant annotations beat auto).
  const manualChips: DetailSemanticFlagChip[] = [];
  const seenManualCodes = new Set<ManualTagCode>();
  for (const code of clusterMeta.manualTagCodes) {
    if (seenManualCodes.has(code)) continue;
    seenManualCodes.add(code);
    const ux = getManualTagUx(code);
    manualChips.push({
      id: `manual_tag:${code}`,
      family: 'manual_tag',
      label: ux.label,
      helperLine: ux.helperLine,
      iconHint: ux.iconHint,
      sourceCode: code,
    });
  }

  // Auto-metadata chips with COPY-001 R2 dedup against manual tags and
  // the cluster lifecycle label.
  const manualLabels = new Set<string>(manualChips.map((c) => c.label));
  const autoChips: DetailSemanticFlagChip[] = [];
  const seenAutoCodes = new Set<AutoMetadataCode>();
  for (const code of clusterMeta.autoMetadataCodes) {
    if (seenAutoCodes.has(code)) continue;
    seenAutoCodes.add(code);
    const ux = getAutoMetadataUx(code);
    // Dedup: manual tag wins over auto with the same label.
    if (manualLabels.has(ux.label)) continue;
    // Dedup against the cluster lifecycle label — the "Why it matters"
    // section already surfaces it.
    if (ux.label === lifecycleLabel) continue;
    autoChips.push({
      id: `auto_metadata:${code}`,
      family: 'auto_metadata',
      label: ux.label,
      helperLine: ux.helperLine,
      iconHint: ux.iconHint,
      sourceCode: code,
    });
  }

  // Also dedup manual-tag chips against the cluster lifecycle label.
  const dedupedManual = manualChips.filter((c) => c.label !== lifecycleLabel);

  const chips = [...dedupedManual, ...autoChips];
  return {
    kind: 'semantic_flags',
    isCondensed: viewMode === 'timeline',
    totalCount: chips.length,
    chips,
  };
}

// ── Superset detail view-model scaffold (Fork 2 / design §6.1) ───────
//
// The superset shape both surfaces will project from. SCAFFOLD ONLY in
// Slice 1 — the optional hub slices (parent quote, S/T/H strip,
// family-grouped classifiers, full tags) are populated in Slice 2. The
// scaffold pins the surface discriminator + the slice slot names now so
// the Slice 2 builder lands without re-shaping the type.

/** Detail surface discriminator (Fork 2). */
export type DetailSurface = 'timeline' | 'cards';

/**
 * Superset detail view-model (Fork 2 shape). Slice 1 declares the surface
 * discriminator + the slice slots; Slice 2 populates them. The optional
 * `?` slots are intentionally not built yet — the existing sidecar +
 * card-detail builders remain the live derivation in Slice 1.
 */
export interface ArgumentDetailViewModel {
  surface: DetailSurface;
  activeMessageId: string;
  /** Semantic-flag chips (shared derivation). */
  semanticFlags?: DetailSemanticFlagsSection;
}
