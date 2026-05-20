/**
 * MCP-014 — Referee feedback banner library: type contract.
 *
 * Layer 4 of the semantic-referee architecture. The banner library turns
 * already-classified move metadata (a `SemanticRefereePacket` from MCP-011
 * and/or a `LedgerResult.categoryReadings` from MCP-013) into ONE short,
 * encouraging, non-verdict banner about the MOVE — never the person.
 *
 * This file is PURE TYPESCRIPT — type declarations + one `const` array only.
 * It has NO runtime import; it imports types only (`import type`) from
 * MCP-011 / MCP-013. Same constraint as `src/lib/constitution/engine.ts`,
 * `src/features/pointStanding/`, and `src/features/refereeLedger/`.
 *
 * Doctrine (MCP-014 design § "Doctrine self-check"):
 *   - A banner describes a structural play property of the MOVE; it carries
 *     no verdict / winner / loser / truth / right / wrong token.
 *   - A banner inherits `authoritative: false`; the model never reads
 *     `authoritative` and never escalates a 0/1 binary into a hard claim.
 *   - Popularity / heat is never an input and never praised as evidence.
 *   - A low-confidence input produces a SOFTER banner or NO banner — never a
 *     confident-sounding line.
 *   - A raw `classifierId` / `feedbackCode` / `bannerCode` never reaches a
 *     user surface; an unmapped code is suppressed, not echoed.
 *   - A banner never blocks posting and never auto-acts.
 */

import type {
  SemanticClassifierId,
  SemanticConfidence,
} from '../semanticReferee/semanticRefereeTypes';
import type {
  LedgerConfidence,
  ReconciliationOutcome,
  RefereeFeedbackCode,
} from '../refereeLedger/types';

// ── Core unions (MCP-008 §4, MCP-014 design "Data model") ─────────

/**
 * The 12 issue-named banner categories (MCP-008 §4). A category groups
 * banners by what the MOVE did; it is NOT a score category and NOT a verdict.
 */
export type RefereeBannerCategory =
  | 'continuity'
  | 'evidence_debt'
  | 'hot_take'
  | 'clever_rebuttal'
  | 'source_chain_gap'
  | 'branch_suggestion'
  | 'tangent_suggestion'
  | 'synthesis_readiness'
  | 'quote_needed'
  | 'mechanism_needed'
  | 'mode_mismatch'
  | 'pacing_cooldown';

/** Every `RefereeBannerCategory` value — for the tests' coverage scans. */
export const ALL_REFEREE_BANNER_CATEGORIES: readonly RefereeBannerCategory[] = [
  'continuity',
  'evidence_debt',
  'hot_take',
  'clever_rebuttal',
  'source_chain_gap',
  'branch_suggestion',
  'tangent_suggestion',
  'synthesis_readiness',
  'quote_needed',
  'mechanism_needed',
  'mode_mismatch',
  'pacing_cooldown',
];

/**
 * Three tone bands (MCP-008 §6). The band is the only thing the render layer
 * needs to pick an icon + a text prefix; it is never expressed by color alone.
 */
export type RefereeBannerTone = 'celebratory' | 'nudge' | 'routing_hint';

/**
 * A non-color tone marker — shape, not color (accessibility-targets,
 * timeline-grammar "shape carries the meaning").
 */
export type RefereeBannerToneGlyph = 'star' | 'arrow' | 'branch';

/**
 * Confidence a banner is allowed to express — read from the packet/reading,
 * never invented. Reuses the SAME three-value vocabulary as MCP-011's
 * `SemanticConfidence` and MCP-013's `LedgerConfidence`.
 */
export type RefereeBannerConfidence = 'low' | 'medium' | 'high';

// ── RefereeBanner — one library entry (MCP-008 §4) ────────────────

export interface RefereeBanner {
  /** Stable internal id — snake_case. Added to PLAIN_LANGUAGE_COPY. NEVER user-visible raw. */
  bannerCode: string;
  category: RefereeBannerCategory;
  tone: RefereeBannerTone;
  /** The visible banner line. <= 64 chars. Ban-list clean. A complete clause. */
  headline: string;
  /** Optional second line — a concrete suggested move. <= 80 chars. Ban-list clean. */
  helperLine?: string;
  /** Non-color tone marker the render layer shows. */
  toneGlyph: RefereeBannerToneGlyph;
  /**
   * The complete screen-reader sentence (MCP-008 §8.1). Always a full sentence
   * with the tone stated in words. Built by `buildBannerAccessibilityLabel` and
   * frozen into the library entry at module load.
   */
  accessibilityLabel: string;
  /**
   * Minimum confidence at which this banner may show. A banner whose effective
   * confidence falls below this is softened or suppressed (confidence rule).
   */
  minConfidence: RefereeBannerConfidence;
  /**
   * The bannerCode of this banner's softened sibling, or null. When the source
   * confidence is below `minConfidence`, `selectBanner` swaps to the sibling. A
   * softened banner itself has `softenedSiblingCode: null` and
   * `minConfidence: 'low'`.
   */
  softenedSiblingCode: string | null;
}

// ── Selection input / result (MCP-008 §4, MCP-014 deviation note) ─

/**
 * The deterministic selection input — built UPSTREAM from a
 * `SemanticRefereePacket` and/or a `LedgerResult`. The banner library NEVER
 * reads a raw conversation.
 */
export interface BannerSelectionInput {
  /**
   * The packet's binaries that read `value === 1`, in packet order. Read-only.
   * `classifierId` is a `SemanticClassifierId` (the 23-id catalog).
   */
  positiveBinaries: ReadonlyArray<{
    classifierId: SemanticClassifierId;
    confidence: SemanticConfidence; // 'low' | 'medium' | 'high'
  }>;
  /** The ledger's category readings, if a `LedgerResult` is available. Read-only. */
  categoryReadings: ReadonlyArray<{
    feedbackCode: RefereeFeedbackCode; // a MCP-013 RefereeFeedbackCode
    confidence: LedgerConfidence; // 'low' | 'medium' | 'high'
    outcome: ReconciliationOutcome; // a MCP-013 ReconciliationOutcome
    requiresUserChoice: boolean;
  }>;
}

/** The selection result — at most ONE banner per move (MCP-008 §5.4). */
export interface BannerSelectionResult {
  /** The chosen banner, or null when nothing is worth surfacing / all suppressed. */
  banner: RefereeBanner | null;
  /** Why this banner won (or why none did) — dev/debug + tests, NEVER user-visible. */
  selectionTrace: string;
}
