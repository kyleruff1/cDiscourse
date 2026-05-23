/**
 * MCP-014 / MCP-MOD-006 — Referee banner: classifier-id / feedback-code → banner maps.
 *
 * `CLASSIFIER_TO_BANNERS` is keyed off ALL 23 `SemanticClassifierId` catalog
 * v0 ids (MCP-011). `FEEDBACK_CODE_TO_BANNER` is keyed off ALL 22
 * `RefereeFeedbackCode` codes (MCP-013). Both are the authoritative maps from
 * already-classified metadata to a `bannerCode` in `REFEREE_BANNER_LIBRARY`.
 *
 * MCP-MOD-006 — single source of truth: `CLASSIFIER_TO_BANNERS` is now a
 * DERIVED VIEW over `SEMANTIC_CLASSIFIER_CATALOG`'s per-entry
 * `bannerCodePriorityList` field. The catalog (`semanticClassifierCatalog.ts`)
 * holds the full ordered candidate list per id; changing the priority list for
 * an id is now a single-file edit in the catalog. The parity test
 * (`__tests__/semanticClassifierCatalogParity.test.ts`) asserts each entry's
 * `bannerCode === bannerCodePriorityList[0]` so the primary stays in sync. The
 * fuzz-parity test (`__tests__/semanticBannerFuzzParity.test.ts`) asserts the
 * derived `CLASSIFIER_TO_BANNERS` produces byte-identical `selectBanner`
 * outputs versus a frozen pre-refactor reference for 50 random packets.
 *
 * `FEEDBACK_CODE_TO_BANNER` is unchanged — `RefereeFeedbackCode` is the
 * ledger's per-category code family, not a per-classifier code, so it is not
 * a per-id mapping under the catalog's purview.
 *
 * Documented deviation (MCP-014 design § "Documented deviation from MCP-008"):
 * MCP-008 §5 keyed the map off the 90 MCP-002 seed ids. That contract is
 * superseded — a real `SemanticBinarySample.classifierId` is the 23-id union,
 * so the map is keyed off `ALL_SEMANTIC_CLASSIFIER_IDS`. The coverage test
 * asserts the key set equals the catalog automatically.
 *
 * Pure TypeScript. No network. No Supabase. No React.
 */

import { SEMANTIC_CLASSIFIER_CATALOG } from '../../lib/constitution/semanticClassifierCatalog';
import type { SemanticClassifierId } from '../semanticReferee/semanticRefereeTypes';
import type { RefereeFeedbackCode } from '../refereeLedger/types';

/**
 * Each of the 23 catalog v0 classifier ids → an ordered list of candidate
 * `bannerCode`s. The first usable candidate after confidence handling wins
 * within its category. `contains_unplayable_insult_only` maps to `[]` — it is
 * an `INTENTIONALLY_SILENT_CLASSIFIERS` member (a routing signal, never a
 * banner; the move is never labelled "an insult").
 *
 * Derived from `SEMANTIC_CLASSIFIER_CATALOG[*].bannerCodePriorityList` —
 * the catalog is the single source of truth (MCP-MOD-006).
 */
export const CLASSIFIER_TO_BANNERS: Readonly<
  Record<SemanticClassifierId, readonly string[]>
> = Object.freeze(
  Object.fromEntries(
    SEMANTIC_CLASSIFIER_CATALOG.map((entry) => [
      entry.id,
      entry.bannerCodePriorityList,
    ]),
  ) as Record<SemanticClassifierId, readonly string[]>,
);

/**
 * Each of the 22 `RefereeFeedbackCode`s → exactly one `bannerCode`. A reading
 * is a richer, reconciled signal than a raw binary, so a single banner per
 * code is sufficient. `you_decide_the_lane` maps to the routing banner;
 * `selectBanner` also force-selects that banner for any `conflict_routed`
 * reading independently of this map.
 */
export const FEEDBACK_CODE_TO_BANNER: Readonly<
  Record<RefereeFeedbackCode, string>
> = Object.freeze({
  clean_parent_tie: 'continuity_clean_tie',
  partial_parent_tie: 'continuity_clean_tie_soft',
  answered_the_question: 'continuity_answers_question',
  question_still_open: 'continuity_answers_question_soft',
  source_attached: 'evidence_debt_source_attached',
  evidence_debt_open: 'evidence_debt_opened',
  evidence_connects: 'evidence_debt_resolved',
  evidence_needs_connecting: 'evidence_debt_connect_it',
  nicely_anchored: 'clever_rebuttal_anchored',
  nice_narrowing: 'synthesis_nice_narrowing',
  concession_noted: 'synthesis_narrow_concession_noted',
  broad_point_set_down: 'synthesis_narrow_concession_noted_soft',
  clarification_in_play: 'continuity_clarification_landed',
  almost_a_synthesis: 'synthesis_almost_there',
  synthesis_named: 'synthesis_shared_ground_named',
  clean_branch: 'branch_clean_branch',
  belongs_on_a_branch: 'branch_belongs_on_branch',
  back_to_the_claim: 'hot_take_keeps_it_about_the_claim',
  debt_resolved: 'evidence_debt_resolved',
  fits_the_room: 'mode_mismatch_fits_the_room',
  pacing_is_on: 'pacing_is_on_in_this_room',
  you_decide_the_lane: 'pacing_you_decide_the_lane',
});
